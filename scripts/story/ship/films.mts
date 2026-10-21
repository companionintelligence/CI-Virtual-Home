// Ship step for the family films: tells the site's manifest about each family's film and copies the small files that go WITH the site.
//
// What ships, and what does not:
//   dist/film/<slug>/poster.<hash10>.jpg      the 16:9 poster (ctx.addHashed; the file is already named by its hash)       -> manifest film.poster
//   dist/film/<slug>/captions.<hash10>.vtt    the WebVTT captions (same-origin, so a <track> needs no CORS)                 -> manifest film.vtt
//   Both ship ONLY for a family whose film is linked (FILM_BASE_URL set): the site carries exactly the files its pages load, so a build with no film host adds nothing.
//   the films themselves are NOT copied: about 1 GB for sixty of them, over Cloudflare Pages' 25 MiB per file, and CI has no GPU or LFS to make them.
//   They live at FILM_BASE_URL (R2 or Stream: the owner's choice), under the content-hashed names films.json records:
//                                              $FILM_BASE_URL/<slug>.<aspect>.<hash10>.mp4                                    -> manifest film.src169, film.src916
// A silent film (`sound: false` in films.json: captioned, no audio stream; its file is <slug>.<aspect>.silent.<hash10>.mp4) is a film like any other here.
// The family page shows its film only when the manifest has a source for it, so a family with no entry in content/families/films.json, or a
// build with FILM_BASE_URL unset, simply has no film button.
//
// Coded against the part of ShipCtx it uses (scripts/story/hooks.ts), structurally, like scripts/story/ship/audio.mts.
import fs from 'node:fs';
import path from 'node:path';
import { familiesDir, readFilms, filmsProblems, loadFamily, inputsShaOf, FILM_BASE_URL_ENV } from '../../film/lib.mts';

export interface FilmShipCtx {
  addHashed(srcAbs: string, dstDir: string): string;
  register(slug: string, key: 'film.src916' | 'film.src169' | 'film.vtt' | 'film.poster', url: string): void;
  registerFilm(slug: string, film: { durationMs: number; bytes: number }): void;
  problem(msg: string): void;
  stories?: unknown;
}
const slugsOf = (stories: unknown): Set<string> | null => {
  if (!stories) return null;
  const list = Array.isArray(stories) ? stories : stories instanceof Map ? [...stories.values()] : Object.values(stories as object);
  return new Set(list.map(s => (s as { slug?: string }).slug).filter((s): s is string => typeof s === 'string'));
};

export default async function shipFilms(ctx: FilmShipCtx): Promise<void> {
  const films = readFilms(), only = slugsOf(ctx.stories);
  for (const w of filmsProblems(films)) ctx.problem(w);
  const base = (process.env[FILM_BASE_URL_ENV] || '').replace(/\/+$/, '');
  if (base && !/^https:\/\//.test(base)) ctx.problem(`films: ${FILM_BASE_URL_ENV} must be an https:// address (got ${base})`);
  let n = 0, hosted = 0;
  for (const [slug, e] of Object.entries(films.families)) {
    if (only && !only.has(slug)) continue;
    const dir = path.join(familiesDir(), slug);
    const ship = (rel: string, key: 'film.vtt' | 'film.poster') => {
      const src = path.join(dir, rel);
      if (!fs.existsSync(src)) { ctx.problem(`films: ${slug}: ${rel} is in films.json but not on disk (pnpm run story:film -- ${slug})`); return false; }
      const url = ctx.addHashed(src, `film/${slug}`);
      if (path.basename(url) !== path.basename(rel)) { ctx.problem(`films: ${slug}: ${rel} was shipped as ${url}; the hash in the name must survive`); return false; }
      ctx.register(slug, key, url); return true;
    };
    n++;
    if (!base) continue;
    const a169 = e.aspects['16x9'];
    if (!ship(e.vtt, 'film.vtt') || !(a169 ? ship(a169.poster, 'film.poster') : true)) continue;
    // is the film still the film of this story? Warn, do not fail: the film is hosted elsewhere and a copy edit should not stop a site build
    try {
      const fam = await loadFamily(slug, { silent: e.sound === false });     // (a silent film is compared with its own inputs: the bake lock, no voice)
      if (inputsShaOf(fam, a169 ? a169.height : 1080) !== e.inputsSha) console.log(`films: ${slug}: the film is older than its story, voice, bake or the film code (pnpm run story:film -- ${slug})`);
    } catch (err: any) { console.log(`films: ${slug}: cannot check freshness: ${err.message}`); }
    if (a169) ctx.register(slug, 'film.src169', `${base}/${a169.file}`);
    if (e.aspects['9x16']) ctx.register(slug, 'film.src916', `${base}/${e.aspects['9x16']!.file}`);
    ctx.registerFilm(slug, { durationMs: e.durationMs, bytes: (a169 || e.aspects['9x16']!).bytes });
    hosted++;
  }
  console.log(`films: ${n} family film(s) in films.json; ${base ? `${hosted} linked to ${base}` : `${FILM_BASE_URL_ENV} is not set, so no family page shows a film`}`);
}
