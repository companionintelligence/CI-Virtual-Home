// Ship step for the interactive tour: joins each family's story, voice lock and bake lock into the one file the player reads, and
// tells the manifest where it is.
//
// scripts/story/site.mts loads every file in this folder (alphabetical) and
// calls its default export with a ShipCtx (STORY-BIBLE section 14).
//
//   dist/story/<slug>.<hash10>.json     joinRuntime(story, voice lock, bake lock) (assets/story/runtime.ts): the authored story without its
//                                       anchors and notes, each clip's URL and word timings, the beats' poses, the timeline and the
//                                       camera track. Named by the hash of its bytes; immutable. Registered as byFamily[slug].story.
//   portal/story.css                    the tour's stylesheet. It is copied by build-portal.mts with the other stylesheets; this step puts
//                                       its fingerprint (`portal/story.css?v=<hash10>`) in each story file as `css`, which is how the
//                                       tour's own <link> asks for the version that goes with it (the player's modules and sheets are
//                                       fingerprinted the same way, by build-portal.mts, for the pages it can see).
//
// A family needs a bake lock (content/families/<slug>.bake.json, from `pnpm run story:bake`) to have a tour; without one it is not an error
// on a development build (the player plays the Orbit, as it always has) and it is on the production site. A lock that no longer matches the
// spec, the story, the roles table or the voice it was made from is stale: also a problem on production, a note elsewhere.
//
// NO NARRATION YET. A family that has no voice lock at all (no content/families/<slug>.voice.json) is a captions-only tour, on purpose, in
// this pass and on the production site: its bake lock has `durations: "estimated"` (reading time: 150 words a minute of speech, 200 of
// card; the bake's own estimate), the runtime story has no `audio`, the player starts it with captions and says nothing about sound, and the
// manifest carries `narration: false` for it so a page, a test or a film can tell. It is not a problem and not a note. What is still a
// problem on production is a voice lock that exists but does not cover every clip while the bake is estimated (a half-recorded family).
//
// Where the files are: content/families/, or $CI_STORY_FAMILIES_DIR (the voice-over tool's own convention), or, for a family whose story
// is one of the test families (test/fixtures/site/families), beside that story.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { joinRuntime, inputShas, staleReasons, allClipsReal } from '../../../assets/story/runtime.js';
import type { Story, VoiceLock, BakeLock } from '../../../assets/story/types.ts';
import type { ShipCtx } from '../hooks.ts';
import { appMedia, readMedia } from '../lib/media.mts';

const hash10 = (b: string | Uint8Array): string => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);
const readJson = (f: string): any => JSON.parse(fs.readFileSync(f, 'utf8'));

export const CSS_SOURCE = path.join('portal', 'story.css');

/** where this family's generated files live */
export function familyDir(root: string, slug: string): string {
  if (process.env.CI_STORY_FAMILIES_DIR) return path.resolve(process.env.CI_STORY_FAMILIES_DIR);
  const main = path.join(root, 'content', 'families');
  if (fs.existsSync(path.join(main, `${slug}.json`))) return main;
  return path.join(root, 'test', 'fixtures', 'site', 'families');
}

export default async function shipPlayer(ctx: ShipCtx): Promise<void> {
  const cssPath = path.join(ctx.ROOT, CSS_SOURCE);
  if (!fs.existsSync(cssPath)) { ctx.problem(`player: ${CSS_SOURCE} is missing`); return; }
  const css = `portal/story.css?v=${hash10(fs.readFileSync(cssPath))}`;
  const table = readJson(path.join(ctx.ROOT, 'content', 'story', 'roles.json'));
  const strict = !ctx.partial;           // the production site: every family has a fresh, voiced tour
  const media = readMedia(ctx.ROOT);     // story v2: the real logos (absent manifest: the card wears none)
  let made = 0, bytes = 0;
  const silent: string[] = [];
  for (const story of ctx.stories as Story[]) {
    const slug = story.slug, dir = familyDir(ctx.ROOT, slug);
    const lockPath = path.join(dir, `${slug}.bake.json`), voicePath = path.join(dir, `${slug}.voice.json`);
    if (!fs.existsSync(lockPath)) {
      if (strict) ctx.problem(`player: ${slug} has no bake lock (${path.relative(ctx.ROOT, lockPath)}): pnpm run story:bake -- ${slug}`);
      else console.log(`player: ${slug} has no bake lock, so it has no tour (pnpm run story:bake -- ${slug})`);
      continue;
    }
    const bake: BakeLock = readJson(lockPath);
    const voice: VoiceLock | null = fs.existsSync(voicePath) ? readJson(voicePath) : null;
    try {
      // is the lock still the camera for this house and this story
      const house = story.house, specPath = path.join(ctx.ROOT, 'content', 'houses', `${house}.json`), planPath = path.join(ctx.ROOT, 'content', 'houses', `${house}.plan.json`);
      const real = allClipsReal(story, voice);
      const now = await inputShas({ specText: fs.readFileSync(specPath, 'utf8'), world: readJson(planPath).shots.world, table, story, voice, real: bake.durations === 'voice' ? real : false });
      const why = staleReasons(bake, now, real);
      if (why.length) {
        const msg = `player: ${slug}'s bake lock is stale (${why.join('; ')}): pnpm run story:bake -- ${slug}`;
        if (strict) ctx.problem(msg); else console.log(`${msg}; it has no tour in this build`);
        continue;
      }
      const captionsOnly = bake.durations !== 'voice' && !voice;       // no voice-over yet: the intended state of this pass (see the header)
      if (bake.durations !== 'voice' && !captionsOnly) {
        const msg = `player: ${slug}'s bake lock has estimated durations, not the voice's (a voice lock exists but does not cover every clip)`;
        if (strict) { ctx.problem(`${msg}; record the voice (pnpm run story:voice -- ${slug}) and bake again`); continue; }
        console.log(`${msg} (a draft tour: fine here, refused on the production site)`);
      }
      const rs: any = joinRuntime(story, voice, bake);
      // the clips, as URLs. audio.mts ships them from content/families (or $CI_STORY_FAMILIES_DIR); a family whose files sit elsewhere (the test
      // families) is shipped here, by the same call: a clip is named by the hash of its bytes, so shipping it twice is the same file.
      for (const [id, c] of Object.entries<any>(rs.audio)) {
        const src = path.join(dir, slug, c.file);
        if (!fs.existsSync(src)) { delete rs.audio[id]; if (strict) ctx.problem(`player: ${slug}/${id}: ${path.relative(ctx.ROOT, src)} is missing`); continue; }
        const url = ctx.addHashed(src, `audio/${slug}`);
        ctx.register(slug, `audio:${id}`, url);
        c.file = url;
      }
      // (the bake's notes name beats and pose problems: they are for the person baking, not the page)
      if (rs.track && rs.track.stats) rs.track.stats.notes = [];
      rs.css = css;
      // story v2: the real logos of the apps this tour names, so the card can wear one beside the chip that names the app (a screenshot is never in the tour)
      if (media) {
        const ids = new Set<string>();
        for (const b of story.beats) { if (b.app) ids.add(b.app.id); for (const w of b.with || []) ids.add(w); }
        const entries = [...ids].sort().map(id => [id, appMedia(media, id)] as const).filter(([, a]) => a && a.logo);
        if (entries.length) rs.media = Object.fromEntries(entries.map(([id, a]) => [id, { name: a!.name, logo: { file: a!.logo!.file, w: a!.logo!.w, h: a!.logo!.h, alt: a!.logo!.alt } }]));
      }
      const text = JSON.stringify(rs);
      const url = ctx.addFile(`story/${slug}.${hash10(text)}.json`, text);
      ctx.register(slug, 'story', url);
      const narrated = Object.keys(rs.audio).length > 0;
      ctx.setNarration(slug, narrated);
      if (!narrated) silent.push(slug);
      made++; bytes += Buffer.byteLength(text);
    } catch (err) {
      ctx.problem(`player: ${slug}: ${(err as Error).message}`);
    }
  }
  console.log(`player: ${made} tour${made === 1 ? '' : 's'}, ${(bytes / 1024).toFixed(0)} KB of story data, stylesheet ${css}`);
  if (silent.length) console.log(`player: ${silent.length} of the ${made} tours have no narration yet and run on captions (manifest narration: false): ${silent.slice(0, 6).join(', ')}${silent.length > 6 ? ', ...' : ''}`);
}
