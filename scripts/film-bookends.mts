#!/usr/bin/env -S node --experimental-strip-types
// Optional: brand-identical intro and outro cards from CI-Common's product-video kit (`ci-video`), for a family film that wants the house bookends.
//
//   CI_VIDEO_KIT=/path/to/CI-Common/packages/video-kit node --experimental-strip-types scripts/film-bookends.mts
//
// OFF BY DEFAULT. With CI_VIDEO_KIT unset this prints that it was skipped and exits 0, which is what `pnpm run story:film` relies on: the film's own title card and
// end card (assets/story/film/cards.ts) are complete without it. The kit is NEVER a dependency of this repo (no @companionintelligence/video-kit in package.json); it
// is a tool on the owner's machine, found only through the environment variable.
//
// What this does today, and what it does not: it finds the kit and runs the kit's own `doctor` (Node, FFmpeg, Playwright, HyperFrames, fonts), so a machine that
// cannot render bookends says so before a render is tried. It does NOT yet scaffold a storyboard per family or composite the cards into a film: that needs a kit
// project per family (ci-video init, a storyboard with the title and end card scenes, narration adopted from the voice lock) and has not been built or run here.
// Owner: video-tool.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const KIT_ENV = 'CI_VIDEO_KIT';
export type Bookends = { skipped: true; why: string } | { skipped: false; kit: string; doctor: { ok: boolean; output: string } };

/** Look for the kit; never throw. `skipped` is the normal answer. */
export function bookends(env: Record<string, string | undefined> = process.env): Bookends {
  const kit = env[KIT_ENV];
  if (!kit) return { skipped: true, why: `${KIT_ENV} is not set; the film uses its own title and end cards` };
  const bin = path.join(path.resolve(kit), 'bin', 'ci-video.ts');
  if (!fs.existsSync(bin)) return { skipped: true, why: `${KIT_ENV}=${kit} has no bin/ci-video.ts; skipped` };
  const r = spawnSync(process.execPath, ['--experimental-strip-types', bin, 'doctor'], { cwd: path.resolve(kit), encoding: 'utf8', timeout: 120000 });
  return { skipped: false, kit: path.resolve(kit), doctor: { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const b = bookends();
  if ('why' in b) console.log(`bookends: ${b.why}`);
  else { console.log(`bookends: kit at ${b.kit}\n${b.doctor.output}`); console.log(b.doctor.ok ? 'bookends: the kit is ready; per-family bookend projects are not wired yet (see the header of this file)' : 'bookends: the kit reports problems; fix them first'); process.exit(b.doctor.ok ? 0 : 1); }
}
