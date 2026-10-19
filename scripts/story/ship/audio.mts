// Ship step for the voice-over: copies each family's clips into the site and tells the manifest where they are.
//
// landing-site's scripts/story/site.mts loads every file in this folder and calls its default export with a ShipCtx (STORY-BIBLE
// section 14, and scripts/story/hooks.ts on the landing-site branch). It codes against the part of ShipCtx it uses, structurally, so
// it needs no import from a file that is not on this branch; `ShipFn` from hooks.ts is assignable to the default export below.
//
//   dist/audio/<slug>/<clipId>.<hash10>.m4a      ctx.addHashed(src, 'audio/<slug>'): the clips are already named by the hash of
//                                                their bytes, and addHashed strips a hash from the name and puts the same one
//                                                back, so the URL equals the committed file name (checked below)
//   ctx.register(slug, 'audio:<clipId>', url)    url is relative to the site root, no leading slash
//
// It checks as it copies: the file must exist, its bytes must hash to the lock's sha256 and to the hash in its name, and the lock
// must be current for the story (nothing recorded from older text). Anything else is ctx.problem(...), which fails the build.
import fs from 'node:fs';
import path from 'node:path';
import { familiesDir, clipsOf, loadStory, lockSlugs, readLock, sha256, statusOf, CLIP_FILE_RE } from '../../voice/lib.mts';

/** The part of ShipCtx this step uses. */
export interface AudioShipCtx {
  addHashed(srcAbs: string, dstDir: string): string;
  register(slug: string, key: `audio:${string}`, url: string): void;
  problem(msg: string): void;
  /** The stories being published (an array or a slug-keyed object); absent means every family that has a lock. */
  stories?: unknown;
}

function publishedSlugs(stories: unknown): Set<string> | null {
  if (!stories) return null;
  const list = Array.isArray(stories) ? stories : stories instanceof Map ? [...stories.values()] : Object.values(stories as object);
  return new Set(list.map(s => (s as { slug?: string }).slug).filter((s): s is string => typeof s === 'string'));
}

export default async function shipAudio(ctx: AudioShipCtx): Promise<void> {
  const only = publishedSlugs(ctx.stories);
  const slugs = lockSlugs().filter(s => !only || only.has(s));
  if (only) for (const s of only) if (!slugs.includes(s)) console.log(`audio: ${s} has no voice lock yet; its tour plays with captions only`);
  let files = 0, bytes = 0;
  for (const slug of slugs) {
    const lock = readLock(slug)!;
    let story;
    try { story = loadStory(slug); } catch { ctx.problem(`audio: ${slug}.voice.json has no story file ${slug}.json beside it`); continue; }
    const expected = clipsOf(story);
    const stale = statusOf(slug, expected, lock).filter(s => !s.ok);
    for (const s of stale) ctx.problem(`audio: ${slug}/${s.id} is stale (${s.why.join(', ')}); run: pnpm run story:voice -- ${slug} --stale`);
    for (const id of Object.keys(lock.clips)) if (!expected.some(e => e.id === id)) ctx.problem(`audio: ${slug}/${id} is in the lock but not in the story; run: pnpm run story:voice -- ${slug} --stale`);
    for (const e of expected) {
      const c = lock.clips[e.id];
      if (!c) continue;                                   // reported as stale above
      const name = path.basename(c.file);
      const src = path.join(familiesDir(), slug, c.file);
      if (!fs.existsSync(src)) continue;                  // reported as stale (file) above
      const data = fs.readFileSync(src);
      const m = CLIP_FILE_RE.exec(name);
      if (!m || m.groups!.hash !== sha256(data).slice(0, 10)) { ctx.problem(`audio: ${slug}/${name} is not named by the hash of its bytes`); continue; }
      const url = ctx.addHashed(src, `audio/${slug}`);
      if (path.basename(url) !== name) { ctx.problem(`audio: ${slug}/${name} was shipped as ${url}; the hash in the name must survive`); continue; }
      ctx.register(slug, `audio:${e.id}`, url);
      files++; bytes += data.length;
    }
  }
  console.log(`audio: ${files} clip(s), ${(bytes / 1024).toFixed(0)} KB, from ${slugs.length} family lock(s)`);
}
