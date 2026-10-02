#!/usr/bin/env -S node --experimental-strip-types
// Every check the house pipeline has, in one command, on this machine.
//
//   pnpm run check [--house aurora,mirage] [--jobs 2] [--res 360] [--update-goldens]
//   pnpm run check:quick                                   # assets + specs + shots + the quick tests
//   pnpm run test:node                                     # only the quick tests: pure Node, no GPU, no browser (CI runs this)
//   node --experimental-strip-types scripts/check-house.mts [--quick] [--house …] [--jobs 2] [--res 360] [--update-goldens]
//
// Works from any cwd: every path resolves from this file's own location.
//
// CI (.github/workflows/ci.yml) runs build, typecheck, validate, the floor-plan-graph test, `test:node` (the quick tests below,
// which need no GPU) and the portal build — steps 0 and 1 and the quick part of 5. 150 frames through a software rasteriser
// cost the better part of an hour of GitHub Actions per push — measured, twice — and that is not what the
// runner budget is for. On a machine with a GPU the same work is a couple of minutes, so it runs here, before
// you push.
//
//   0. assets     build-house-assets.mts    — compiles assets/*.ts (the three.js engine) to the .js
//                                             room-creator.html's browser-native ES modules actually load
//   1. specs      validate-house-spec.mts   — 30 HouseSpecs against the schema, the catalog and the registry
//   2. shots      render-house-shots.mts    — camera paths through walls, floors, furniture, and the Core kept
//                                             in frame through its orbits; and the scene gate: dressing,
//                                             clashes, planting. Again on planner v2 (shots:v2: QA v2 on its three films)
//   3. determinism test-frame-hash.mts      — two runs of THIS tree must agree (door-to-core, then core-orbit, then planner v2's door-to-core)
//   4. goldens    test-goldens.mts          — this tree must still agree with the tree we blessed, less the frames
//                                             test/goldens/expected-diffs/ declares as moving (the ledger)
//   5. test:*     scripts/test-*.mts        — every test script, found by glob (plan Completeness C8), so a stream
//                                             adds its test by adding the file, never by editing this one. A file
//                                             steers itself with a directive in its first lines:
//                                               // @check-house skip — <why>     not run here (e.g. a step above)
//                                               // @check-house node-test        run under `node --test`
//                                               // @check-house quick            also run by --quick
//                                               // @check-house advisory — <why> runs and reports, cannot fail the
//                                               //                              gate (a test that is red on main
//                                               //                              too, until the fix that greens it lands)
//   6. perf       perf-house.mts            — build / track / shot-QA timings against their budgets (plan A4), on planner v1 and
//                                             again on planner v2 (perf:v2: planning its three films, QA on each):
//                                             report-only, it never fails the gate (`--no-perf` skips it)
//
// The order is a dependency chain, not a preference: goldens compared against a renderer that is not
// deterministic are noise, so a failed determinism check skips them rather than reporting a hundred lies.
// --quick skips determinism, goldens, the slow tests and perf: the fast loop while you are still editing (assets, specs, shots and the
// quick tests). --node runs only the quick tests, none of which start a browser.
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
const NODE_ONLY = flag('node');   // the quick test scripts only: what CI can run without a GPU
const houseArgs = HOUSE ? ['--house', HOUSE] : [];
const QA_OUT = path.join(ROOT, 'test', 'qa');
// One resolution, passed explicitly to both steps below. test-goldens.mts's own default happens to be '360'
// and test-frame-hash.mts's is '720' — leaving goldens on its implicit default while overriding determinism's
// only matched by coincidence; if either script's default ever changes, determinism would silently verify a
// different resolution than goldens capture at, which is exactly the situation these two steps run in this
// order to prevent.
const RES = val('res', '360');

type Step = { key: string; script: string; args: string[]; quick?: boolean; needs?: string; nodeTest?: boolean; advisory?: boolean };
// scripts/test-*.mts, each steered by its own "@check-house" directive (header)
const testSteps: Step[] = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => /^test-.+\.mts$/.test(f)).sort().flatMap(f => {
  const head = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8').split('\n').slice(0, 40).join('\n');
  const words = [...head.matchAll(/@check-house\s+([a-z-]+)/g)].map(m => m[1]);   // one directive a line
  if (words.includes('skip')) return [];
  return [{ key: `test:${f.replace(/^test-|\.mts$/g, '')}`, script: S(f), args: [], quick: words.includes('quick') ? undefined : false, nodeTest: words.includes('node-test'), advisory: words.includes('advisory') }];
});
const steps: Step[] = [
  { key: 'assets', script: S('build-house-assets.mts'), args: [] },
  { key: 'specs', script: S('validate-house-spec.mts'), args: [] },
  { key: 'shots', script: S('render-house-shots.mts'), args: ['--qa-only', '--shot', 'door-to-core,orbit,hero-reveal,core-orbit', '--jobs', JOBS!, '--out', QA_OUT, ...houseArgs] },
  // planner v2 (S5, off by default): the same houses planned on it in the page, QA v2 on every film (door-to-core, hero-reveal, walkthrough), and its frames as deterministic as v1's. The default is v1 until the flip at
  // integration; these keep v2 honest meanwhile, in the gate and not only in test-shot-planner.mts (which plans in Node and compares the page's track).
  { key: 'shots:v2', script: S('render-house-shots.mts'), args: ['--qa-only', '--planner', 'v2', '--shot', 'door-to-core,hero-reveal,walkthrough', '--jobs', JOBS!, '--out', path.join(QA_OUT, 'v2'), ...houseArgs], quick: false },
  { key: 'determinism', script: S('test-frame-hash.mts'), args: ['--res', RES!, '--frames', '0,200,719', ...(HOUSE ? ['--house', HOUSE.split(',')[0]] : [])], quick: false },
  // the 8 s product orbit, stepped as random access too (its own path function, not door-to-core's)
  { key: 'determinism:core-orbit', script: S('test-frame-hash.mts'), args: ['--res', RES!, '--shot', 'core-orbit', '--frames', '0,240,479', ...(HOUSE ? ['--house', HOUSE.split(',')[0]] : [])], quick: false },
  { key: 'determinism:v2', script: S('test-frame-hash.mts'), args: ['--res', RES!, '--planner', 'v2', '--frames', '0,200,450', ...(HOUSE ? ['--house', HOUSE.split(',')[0]] : [])], quick: false },
  { key: 'goldens', script: S('test-goldens.mts'), args: ['--res', RES!, '--jobs', JOBS!, ...(flag('update-goldens') ? ['--update'] : []), ...houseArgs], quick: false, needs: 'determinism,determinism:core-orbit' },
  ...testSteps,
  ...(flag('no-perf') ? [] : [
    { key: 'perf', script: S('perf-house.mts'), args: HOUSE ? ['--house', HOUSE] : [], quick: false, advisory: true },
    // planner v2 as well (S5, off by default): the planning of its three films inside `build` and each film's QA, against the same budgets — the v1 step above never plans a v2 film
    { key: 'perf:v2', script: S('perf-house.mts'), args: [...(HOUSE ? ['--house', HOUSE] : []), '--planner', 'v2', '--shot', 'door-to-core,hero-reveal,walkthrough', '--out', path.join(QA_OUT, 'perf-v2.json')], quick: false, advisory: true },
  ]),
];

type Result = Step & { state: 'pass' | 'fail' | 'warn' | 'skipped'; why?: string; code?: number | null; secs?: string };
const results: Result[] = [];
for (const step of steps) {
  if (flag('quick') && step.quick === false) { results.push({ ...step, state: 'skipped', why: '--quick' }); continue; }
  if (NODE_ONLY && !(step.key.startsWith('test:') && step.quick !== false)) { results.push({ ...step, state: 'skipped', why: '--node: the quick tests only' }); continue; }
  const failedNeed = (step.needs || '').split(',').find(n => n && results.find(r => r.key === n)?.state === 'fail');
  if (failedNeed) {
    results.push({ ...step, state: 'skipped', why: `${failedNeed} failed — a baseline compared against a renderer that disagrees with itself is noise` });
    continue;
  }
  console.log(`\n\x1b[1m── ${step.key} ──\x1b[0m ${step.script} ${step.args.join(' ')}`);
  const t = Date.now();
  const r = spawnSync(process.execPath, ['--experimental-strip-types', ...(step.nodeTest ? ['--test'] : []), step.script, ...step.args], { stdio: 'inherit' });
  // an advisory step (perf) reports; it cannot fail the gate
  results.push({ ...step, state: r.status === 0 ? 'pass' : step.advisory ? 'warn' : 'fail', code: r.status, secs: ((Date.now() - t) / 1000).toFixed(0) });
}

console.log('\n\x1b[1m── summary ──\x1b[0m');
for (const r of results) {
  const mark = r.state === 'pass' ? '\x1b[32m✓\x1b[0m' : r.state === 'fail' ? '\x1b[31m✗\x1b[0m' : r.state === 'warn' ? '\x1b[33m!\x1b[0m' : '\x1b[2m–\x1b[0m';
  const note = r.state === 'skipped' ? `skipped (${r.why})` : `${r.state}${r.code ? ` (exit ${r.code})` : ''} in ${r.secs}s`;
  console.log(`  ${mark} ${r.key.padEnd(22)} ${note}`);
}
const failed = results.filter(r => r.state === 'fail'), advisory = results.filter(r => r.state === 'warn');
const also = advisory.length ? ` (${advisory.map(r => r.key).join(', ')}: advisory, did not finish cleanly)` : '';
// an advisory step counts on neither side: it is reported beside the tally, never in it
const gating = results.filter(r => r.state === 'pass' || r.state === 'fail').length;
if (failed.length) console.log(`\n\x1b[31m${failed.length} of ${gating} checks failed.\x1b[0m${also}`);
else console.log(`\n\x1b[32mAll ${gating} checks passed.\x1b[0m${also}`);
process.exit(failed.length ? 1 : 0);
