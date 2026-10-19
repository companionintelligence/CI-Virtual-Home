// The film script's plain helpers: where things are, how a family's three inputs are read and joined, the strings the film prints that are not in
// the family's file, films.json, and the size guard. Pure Node: no browser, no ffmpeg (those are mux.mts and qa.mts), so scripts/test-film.mts can
// import it without a GPU. Owner: video-tool.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { joinRuntime, voiceShaOf, type RuntimeStory } from '../../assets/story/runtime.js';
import type { Story, VoiceLock, BakeLock } from '../../assets/story/types.js';
import { FILM_KEYS, type FilmKey } from '../../assets/story/film/layout.js';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
/** the authored files, the locks and the films.json: content/families, or $CI_STORY_FAMILIES_DIR (the voice-over tool's switch, kept the same) */
export const familiesDir = (): string => process.env.CI_STORY_FAMILIES_DIR ? path.resolve(process.env.CI_STORY_FAMILIES_DIR) : path.join(ROOT, 'content', 'families');
/** rendered films: outside git (gitignored like video/houses) and outside dist */
export const videoDir = (): string => process.env.CI_FILM_OUT ? path.resolve(process.env.CI_FILM_OUT) : path.join(ROOT, 'video', 'families');
export const filmsJsonPath = (): string => path.join(familiesDir(), 'films.json');

/** Cloudflare Pages caps a file at 25 MiB; a web film is held to 24 so a few bytes of headers never decide it. */
export const WEB_MAX_BYTES = 24 * 1024 * 1024;
export const FILM_BASE_URL_ENV = 'FILM_BASE_URL';

export const sha256 = (data: string | Uint8Array): string => crypto.createHash('sha256').update(data).digest('hex');
export const hash10 = (data: string | Uint8Array): string => sha256(data).slice(0, 10);
export const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---- the names ---------------------------------------------------------------------------------------------------------------------------
export const aspectLabel = (k: FilmKey): string => (k === '16x9' ? '16:9' : '9:16');
/** the web file's name: content-hashed, so it can be cached for a year wherever it is hosted */
export const webFileName = (slug: string, k: FilmKey, bytes: Uint8Array): string => `${slug}.${k}.${hash10(bytes)}.mp4`;
export const posterFileName = (k: FilmKey, bytes: Uint8Array): string => (k === '16x9' ? 'poster' : 'poster-9x16') + `.${hash10(bytes)}.jpg`;
export const vttFileName = (bytes: Uint8Array): string => `captions.${hash10(bytes)}.vtt`;
export const FILM_FILE_RE = /^(?<slug>[a-z][a-z0-9-]*)\.(?<aspect>16x9|9x16)\.(?<hash>[0-9a-f]{10})\.mp4$/;

// ---- reading a family -----------------------------------------------------------------------------------------------------------------------
export type Family = { slug: string; story: Story; voice: VoiceLock; bake: BakeLock; rs: RuntimeStory; shas: { story: string; voice: string; bake: string } };

/** The film needs all three of a family's files, and a bake made from THIS voice lock (else the offsets under the sound are someone else's). */
export async function loadFamily(slug: string): Promise<Family> {
  const dir = familiesDir(), p = (ext: string) => path.join(dir, `${slug}${ext}`);
  for (const [ext, how] of [['.json', 'the authored story'], ['.voice.json', `the voice lock (pnpm run story:voice -- ${slug})`], ['.bake.json', `the bake lock (pnpm run story:bake -- ${slug})`]]) {
    if (!fs.existsSync(p(ext))) throw new Error(`${slug}: no ${how}: ${path.relative(ROOT, p(ext))}`);
  }
  const story: Story = readJson(p('.json')), voice: VoiceLock = readJson(p('.voice.json')), bake: BakeLock = readJson(p('.bake.json'));
  if (bake.durations !== 'voice') throw new Error(`${slug}: the bake lock used estimated durations; record the voice (pnpm run story:voice -- ${slug}) and bake again`);
  const now = await voiceShaOf(story, voice);
  if (bake.voiceSha !== now) throw new Error(`${slug}: the bake lock was made from a different voice lock; run pnpm run story:bake -- ${slug}`);
  const rs = joinRuntime(story, voice, bake);
  return { slug, story, voice, bake, rs, shas: { story: sha256(fs.readFileSync(p('.json'))), voice: sha256(fs.readFileSync(p('.voice.json'))), bake: sha256(fs.readFileSync(p('.bake.json'))) } };
}

/** every slug with a bake lock (the film needs one): `--all` */
export function filmableSlugs(): string[] {
  const dir = familiesDir();
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.bake.json')).map(f => f.replace(/\.bake\.json$/, '')).sort() : [];
}
export const clipPath = (slug: string, file: string): string => path.join(familiesDir(), slug, file);

// ---- the strings a film prints that are not in the family's file ---------------------------------------------------------------------------
export type Claims = { disclosures: Array<{ id: string; text: string }> };
export const loadClaims = (): Claims => readJson(path.join(ROOT, 'content', 'story', 'claims.json'));
const disclosure = (c: Claims, id: string): string => { const d = c.disclosures.find(x => x.id === id); if (!d) throw new Error(`claims.json has no disclosure "${id}"`); return d.text; };

/** Does a film beat name Hermes or OpenClaw? Then its end card carries the attribution line (claims.json: attribution-agents). */
export function namesAgentRuntime(rs: RuntimeStory, partIds: string[]): boolean {
  for (const id of partIds) {
    const b = rs.beats.find(x => x.id === id); if (!b) continue;
    if (b.agent) return true;
    if (b.app && (b.app.id === 'ci-hermes' || b.app.id === 'ci-openclaw')) return true;
    if ((b.with || []).some(a => a === 'ci-hermes' || a === 'ci-openclaw')) return true;
  }
  return false;
}
export type FilmText = {
  title: { heading: string; address: string; tagline: string; fictional: string };
  end: { signoff: string; url: string; fictional: string; lines: string[] };
  badge: string;
  names: Record<string, string>;
};
export function filmText(rs: RuntimeStory, claims: Claims = loadClaims()): FilmText {
  const fam = rs.family, fictional = disclosure(claims, 'fictional-family');
  const lines = [disclosure(claims, 'beta-short'), disclosure(claims, 'scripted-scenes'), disclosure(claims, 'stylised-art'), disclosure(claims, 'synthetic-voice')];
  if (namesAgentRuntime(rs, rs.film.parts.map(p => p.id))) lines.push(disclosure(claims, 'attribution-agents'));
  const url = rs.closing.cta.url.replace(/^https?:\/\//, '');
  const names: Record<string, string> = {}; for (const m of rs.members) names[m.id] = m.companion ? m.companion.name : m.name;
  return {
    title: { heading: `The ${fam.surname} family`, address: `${fam.address.line}, ${fam.address.place}`, tagline: fam.tagline, fictional },
    end: { signoff: 'UnCloud your life.', url, fictional, lines }, badge: fictional, names,
  };
}

// ---- films.json -------------------------------------------------------------------------------------------------------------------------------
export type FilmAspect = {
  /** the web file's name (content-hashed); the URL is FILM_BASE_URL + '/' + file, decided when the site is built */
  file: string; sha256: string; bytes: number; width: number; height: number; durationMs: number;
  /** relative to content/families/<slug>/ : the committed poster */
  poster: string;
  loudness: { I: number; TP: number };
};
export type FilmEntry = {
  durationMs: number;
  /** a hash of everything the film was made from, so a stale film is found without rendering */
  inputsSha: string;
  /** relative to content/families/<slug>/ : the WebVTT captions (committed; small enough to ship with the site) */
  vtt: string;
  aspects: Partial<Record<FilmKey, FilmAspect>>;
};
export type FilmsFile = { v: 1; families: Record<string, FilmEntry> };

export function readFilms(): FilmsFile {
  const f = filmsJsonPath();
  return fs.existsSync(f) ? readJson(f) : { v: 1, families: {} };
}
export function writeFilms(films: FilmsFile) {
  const sorted: FilmsFile = { v: 1, families: Object.fromEntries(Object.keys(films.families).sort().map(k => [k, films.families[k]])) };
  fs.mkdirSync(path.dirname(filmsJsonPath()), { recursive: true });
  fs.writeFileSync(filmsJsonPath(), JSON.stringify(sorted, null, 2) + '\n');
}

/** Problems with a films.json (an empty list: it is well formed). Used by the tests and by the ship step. */
export function filmsProblems(films: FilmsFile, opts: { maxBytes?: number } = {}): string[] {
  const why: string[] = [], max = opts.maxBytes ?? WEB_MAX_BYTES;
  if (!films || films.v !== 1 || typeof films.families !== 'object') return ['films.json: not { v: 1, families: {} }'];
  for (const [slug, e] of Object.entries(films.families)) {
    const at = (m: string) => why.push(`films.json ${slug}: ${m}`);
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) at('the slug is not a public slug');
    if (!(e.durationMs > 0)) at('no duration');
    if (!/^[0-9a-f]{64}$/.test(e.inputsSha || '')) at('no inputsSha');
    if (!/^film\/captions\.[0-9a-f]{10}\.vtt$/.test(e.vtt || '')) at('vtt must be film/captions.<hash10>.vtt');
    const keys = Object.keys(e.aspects || {});
    if (!keys.length) at('no aspect');
    for (const k of keys) {
      const a = (e.aspects as any)[k] as FilmAspect;
      if (!FILM_KEYS.includes(k as FilmKey)) { at(`unknown aspect ${k}`); continue; }
      const m = FILM_FILE_RE.exec(a.file || '');
      if (!m || m.groups!.slug !== slug || m.groups!.aspect !== k) at(`${k}: file ${a.file} is not ${slug}.${k}.<hash10>.mp4`);
      else if (!/^[0-9a-f]{64}$/.test(a.sha256 || '') || a.sha256.slice(0, 10) !== m.groups!.hash) at(`${k}: the hash in the file name is not the sha256's first ten`);
      if (!(a.bytes > 0)) at(`${k}: no bytes`); else if (a.bytes > max) at(`${k}: ${(a.bytes / 1048576).toFixed(1)} MiB is over the ${(max / 1048576).toFixed(0)} MiB limit`);
      if (!(a.width > 0 && a.height > 0)) at(`${k}: no size`);
      if (k === '16x9' && a.width <= a.height) at('16x9 is not landscape'); if (k === '9x16' && a.width >= a.height) at('9x16 is not portrait');
      if (!(a.durationMs > 0)) at(`${k}: no duration`);
      if (!new RegExp(`^film/${k === '16x9' ? 'poster' : 'poster-9x16'}\\.[0-9a-f]{10}\\.jpg$`).test(a.poster || '')) at(`${k}: poster must be film/${k === '16x9' ? 'poster' : 'poster-9x16'}.<hash10>.jpg`);
      if (!a.loudness || !Number.isFinite(a.loudness.I)) at(`${k}: no loudness`);
    }
  }
  return why;
}

/** the 24 MiB guard on one file */
export function sizeGuard(bytes: number, what: string, max = WEB_MAX_BYTES): string | null {
  return bytes > max ? `${what} is ${(bytes / 1048576).toFixed(2)} MiB; a web film must stay under ${(max / 1048576).toFixed(0)} MiB (Cloudflare Pages caps a file at 25 MiB)` : null;
}

/** A hash of everything a film is made from: the three files, the code that draws it and the claims it prints. A change in any makes it stale. */
export function toolSha(): string {
  const files: string[] = [];
  const add = (dir: string, re: RegExp) => { if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (re.test(f)) files.push(path.join(dir, f)); };
  add(path.join(ROOT, 'assets', 'story', 'film'), /\.ts$/);
  add(path.join(ROOT, 'scripts', 'film'), /\.mts$/);
  files.push(path.join(ROOT, 'scripts', 'render-family-film.mts'), path.join(ROOT, 'content', 'story', 'claims.json'), path.join(ROOT, 'assets', 'story', 'track.ts'), path.join(ROOT, 'assets', 'story', 'place.ts'));
  const h = crypto.createHash('sha256');
  for (const f of files) if (fs.existsSync(f)) h.update(path.relative(ROOT, f)).update(fs.readFileSync(f));
  return h.digest('hex');
}
export const inputsShaOf = (fam: Family, res: number, tool = toolSha()): string => sha256(JSON.stringify([fam.shas.story, fam.shas.voice, fam.shas.bake, tool, res]));
