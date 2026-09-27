#!/usr/bin/env -S node --experimental-strip-types
// Every check the house pipeline has, in one command, on this machine.
//
//   pnpm run check [--house aurora,mirage] [--jobs 2] [--res 360] [--update-goldens]
//   pnpm run check:quick                                   # assets + specs + shots only
//   node --experimental-strip-types scripts/check-house.mts [--quick] [--house …] [--jobs 2] [--res 360] [--update-goldens]
//
// Works from any cwd: every path resolves from this file's own location.
//
// Only the first two steps run in CI (.github/workflows/ci.yml). 120 frames through a software rasteriser
// cost the better part of an hour of GitHub Actions per push — measured, twice — and that is not what the
// runner budget is for. On a machine with a GPU the same work is a couple of minutes, so it runs here, before
// you push.
//
//   0. assets     build-house-assets.mts    — compiles assets/*.ts (the three.js engine) to the .js
//                                             room-creator.html's browser-native ES modules actually load
//   1. specs      validate-house-spec.mts   — 30 HouseSpecs against the schema, the catalog and the registry
//   2. shots      render-house-shots.mts    — camera paths through walls, floors, furniture; and the scene
//                                             gate: dressing, clashes, planting
//   3. determinism test-frame-hash.mts      — two runs of THIS tree must agree
//   4. goldens    test-goldens.mts          — this tree must still agree with the tree we blessed
//
// The order is a dependency chain, not a preference: goldens compared against a renderer that is not
// deterministic are noise, so a failed determinism check skips them rather than reporting a hundred lies.
// --quick stops after the shot gate, which is the fast pair worth running while you are still editing.
//
// Exit 0 only when everything that ran passed. Child steps run under --experimental-strip-types too, since
// they are .mts files themselves and Node (as of this repo's minimum, 22.15) does not strip types by default.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n: string): boolean => argv.includes(`--${n}`);
const val = (n: string, d: string | null): string | null => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const ROOT = path.resolve(import.meta.dirname, '..');
if (!fs.existsSync(path.join(ROOT, 'room-creator.html'))) { console.error(`no room-creator.html in ${ROOT}`); process.exit(2); }
const S = (n: string): string => path.relative(process.cwd(), path.join(ROOT, 'scripts', n)) || n;

const HOUSE = val('house', null), JOBS = val('jobs', '2');
const houseArgs = HOUSE ? ['--house', HOUSE] : [];
const QA_OUT = path.join(ROOT, 'test', 'qa');
// One resolution, passed explicitly to both steps below. test-goldens.mts's own default happens to be '360'
// and test-frame-hash.mts's is '720' — leaving goldens on its implicit default while overriding determinism's
// only matched by coincidence; if either script's default ever changes, determinism would silently verify a
// different resolution than goldens capture at, which is exactly the situation these two steps run in this
// order to prevent.
const RES = val('res', '360');

type Step = { key: string; script: string; args: string[]; quick?: boolean; needs?: string };
const steps: Step[] = [
  { key: 'assets', script: S('build-house-assets.mts'), args: [] },
  { key: 'specs', script: S('validate-house-spec.mts'), args: [] },
  { key: 'shots', script: S('render-house-shots.mts'), args: ['--qa-only', '--shot', 'door-to-core,orbit,hero-reveal', '--jobs', JOBS!, '--out', QA_OUT, ...houseArgs] },
  { key: 'determinism', script: S('test-frame-hash.mts'), args: ['--res', RES!, '--frames', '0,200,719', ...(HOUSE ? ['--house', HOUSE.split(',')[0]] : [])], quick: false },
  { key: 'goldens', script: S('test-goldens.mts'), args: ['--res', RES!, '--jobs', JOBS!, ...(flag('update-goldens') ? ['--update'] : []), ...houseArgs], quick: false, needs: 'determinism' },
];

type Result = Step & { state: 'pass' | 'fail' | 'skipped'; why?: string; code?: number | null; secs?: string };
const results: Result[] = [];
for (const step of steps) {
  if (flag('quick') && step.quick === false) { results.push({ ...step, state: 'skipped', why: '--quick' }); continue; }
  if (step.needs && results.find(r => r.key === step.needs)?.state === 'fail') {
    results.push({ ...step, state: 'skipped', why: `${step.needs} failed — a baseline compared against a renderer that disagrees with itself is noise` });
    continue;
  }
  console.log(`\n\x1b[1m── ${step.key} ──\x1b[0m ${step.script} ${step.args.join(' ')}`);
  const t = Date.now();
  const r = spawnSync(process.execPath, ['--experimental-strip-types', step.script, ...step.args], { stdio: 'inherit' });
  results.push({ ...step, state: r.status === 0 ? 'pass' : 'fail', code: r.status, secs: ((Date.now() - t) / 1000).toFixed(0) });
}

console.log('\n\x1b[1m── summary ──\x1b[0m');
for (const r of results) {
  const mark = r.state === 'pass' ? '\x1b[32m✓\x1b[0m' : r.state === 'fail' ? '\x1b[31m✗\x1b[0m' : '\x1b[2m–\x1b[0m';
  const note = r.state === 'skipped' ? `skipped (${r.why})` : `${r.state}${r.code ? ` (exit ${r.code})` : ''} in ${r.secs}s`;
  console.log(`  ${mark} ${r.key.padEnd(12)} ${note}`);
}
const failed = results.filter(r => r.state === 'fail');
if (failed.length) console.log(`\n\x1b[31m${failed.length} of ${results.filter(r => r.state !== 'skipped').length} checks failed.\x1b[0m`);
else console.log(`\n\x1b[32mAll ${results.filter(r => r.state !== 'skipped').length} checks passed.\x1b[0m`);
process.exit(failed.length ? 1 : 0);
