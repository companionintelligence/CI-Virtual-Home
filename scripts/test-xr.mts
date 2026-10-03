#!/usr/bin/env -S node --experimental-strip-types
// The WebXR gate: drives the live player in ONE Chromium with Meta's IWER (Immersive Web Emulation Runtime) as the headset, and
// runs the cases in scripts/xr-tests/*.mts.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
//
//   pnpm run build && pnpm run portal:build && pnpm run xr:test [-- --only 00] [--house cutestarter] [--device quest3,vision]
//        [--dir dist] [--driver auto|session|bed] [--require-session] [--ref-dir <dist of the reference commit>] [--shots <dir>]
//        [--json <file>] [--timeout 300000] [--list]
//
//   --only      comma list: a file prefix ("00", "10-session"), a case id ("T-X7") or a substring of either
//   --device    quest3 | quest2 | vision | all (comma list); default quest3. A case lists the devices it is meaningful on
//   --driver    auto (default): drive the product's own XR module when the built tree has one, else the in-page bed
//               (scripts/xr-harness/xrbed.js) and SAY SO in the result; session: the product's, or fail; bed: always the bed
//   --require-session   a case that needs the product's session fails instead of skipping when the tree has no XR modules
//               (the merge step runs with it; on a tree that has assets/xr/ a missing session fails regardless)
//
// One Chromium at a time (cases run in order, never in parallel), one retry for a timeout or a crash, never for a failed
// expectation. Any pageerror or console.error on a page fails the case unless the case declared it expected (a negative
// control). Exit 0 only when nothing failed; skips are listed. Emulation proves lifecycle, state restore, hit-testing and the
// request stream; it does NOT prove frame time, legibility, comfort or thermals: reference/XR-DEVICE-CHECKLIST.md does.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT, SUBPATH, DEVICES, Fail, Skip, loadPlaywright, LAUNCH_ARGS, serve, openPage, treeHasXr, parseArgs, iwerVersion,
  isCase, type Case, type Ctx, type Device, type OpenOpts, type P, type Tree, type Driver,
} from './xr-harness/lib.mts';
import { makeFakeXrTree, type FakeOpts } from './xr-harness/fake-xr.mts';

const args = parseArgs(process.argv.slice(2));
const only = args.only && args.only !== 'true' ? String(args.only).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : null;
const HOUSE = args.house && args.house !== 'true' ? args.house : 'cutestarter';
const DRIVER = (args.driver && args.driver !== 'true' ? args.driver : 'auto') as Driver;
const REQUIRE = args['require-session'] === 'true';
const FAKE = args['fake-xr'] === 'true';
const TIMEOUT = Number(args.timeout || 300000);
const SHOTS = path.resolve(args.shots && args.shots !== 'true' ? args.shots : path.join(ROOT, 'test', 'xr'));
const DIST = path.resolve(args.dir && args.dir !== 'true' ? args.dir : path.join(ROOT, 'dist'));
const wantDevices: Device[] = !args.device || args.device === 'true' ? ['quest3']
  : args.device === 'all' ? DEVICES.slice() : String(args.device).split(',').map(s => s.trim() === 'visionpro' ? 'vision' : s.trim()) as Device[];
for (const d of wantDevices) if (!DEVICES.includes(d)) { console.error(`unknown --device ${d} (quest3, quest2, vision, all)`); process.exit(2); }

// ---------------------------------------------------------------------------------------------------------------- discovery
const TESTS = path.join(import.meta.dirname, 'xr-tests');
const files = fs.existsSync(TESTS) ? fs.readdirSync(TESTS).filter(f => f.endsWith('.mts')).sort() : [];
type Entry = { file: string; c: Case };
const entries: Entry[] = [];
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(TESTS, f)).href);
  for (const v of Object.values(mod)) if (isCase(v)) entries.push({ file: f, c: v });
}
const selected = entries.filter(({ file, c }) => !only || only.some(o => file.toLowerCase().startsWith(o) || file.toLowerCase().includes(o) || c.id.toLowerCase() === o || c.id.toLowerCase().includes(o)));
if (args.list === 'true') { for (const { file, c } of entries) console.log(`${file.padEnd(22)} ${c.id.padEnd(14)} ${(c.devices || ['any']).join(',').padEnd(18)} ${c.title}`); process.exit(0); }
if (!selected.length) { console.error(`no case matches --only ${args.only} (${entries.length} cases in ${files.length} files; --list shows them)`); process.exit(2); }

// ---------------------------------------------------------------------------------------------------------------- servers and browser
const trees: Partial<Record<'dist' | 'root', Tree>> = {};
const temps: string[] = [];
async function tree(name: 'dist' | 'root'): Promise<Tree> {
  if (trees[name]) return trees[name]!;
  const dir = name === 'dist' ? DIST : ROOT, base = name === 'dist' ? SUBPATH : '/';
  if (!fs.existsSync(path.join(dir, 'room-creator.html'))) { throw new Fail(`no ${path.join(dir, 'room-creator.html')}: run pnpm run build && pnpm run portal:build`); }
  // --fake-xr: run every case against a copy of dist/ with a FAKE product module (fake-xr.mts): validates the harness's session path
  // before the real assets/xr/ exists. It is never a substitute for the real tree: the result line says "fake".
  const used = name === 'dist' && FAKE ? makeFakeXrTree(dir, {}) : dir;
  if (used !== dir) temps.push(used);
  const srv = await serve(used, base);
  return (trees[name] = { dir: used, base, srv, hasXr: treeHasXr(used), name });
}

async function fakeTree(o: FakeOpts = {}): Promise<Tree> {
  if (!fs.existsSync(path.join(DIST, 'room-creator.html'))) throw new Fail(`no ${DIST}/room-creator.html: run pnpm run build && pnpm run portal:build`);
  if (treeHasXr(DIST)) throw new Skip('dist/ already has the real assets/xr/: a fake module cannot be layered on it (the fake variants are the harness\'s check of T-LAZY before the real module exists)');
  const dir = makeFakeXrTree(DIST, o); temps.push(dir);
  const srv = await serve(dir, SUBPATH); extra.push(srv);
  return { dir, base: SUBPATH, srv, hasXr: treeHasXr(dir), name: 'dist' };
}
const extra: Awaited<ReturnType<typeof serve>>[] = [];

const pw = await loadPlaywright();
let browser: any = null;
async function launch() { if (browser) await browser.close().catch(() => {}); browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS }); }
await launch();

// ---------------------------------------------------------------------------------------------------------------- run
type Result = { id: string; file: string; device: Device; state: 'pass' | 'fail' | 'skip'; ms: number; msg?: string; notes: Record<string, any>; retried?: boolean };
const results: Result[] = [];
const INFRA = /Timeout|timed out|Target (page|closed|crashed)|browser has been closed|Browser closed|crash|Protocol error|Execution context was destroyed/i;

async function runOne({ file, c }: Entry, device: Device, attempt: number): Promise<Result> {
  const t0 = Date.now(); const pages: P[] = []; const notes: Record<string, any> = {}; const forgiven: RegExp[] = [];
  const t: Ctx = {
    device, house: HOUSE, driver: DRIVER, args, shots: SHOTS,
    tree, fake: fakeTree,
    async open(o) { const tr = o.tree || await tree(o.treeName || 'dist'); const p = await openPage(browser, { house: HOUSE, device, ...o, tree: tr }); pages.push(p); return p; },
    check(cond, msg) { if (!cond) throw new Fail(msg); },
    note(k, v) { notes[k] = v; },
    skip(reason) { throw new Skip(reason); },
    forgive(re) { forgiven.push(re); },
    needsProduct(tr) {
      if (DRIVER === 'bed' || tr.hasXr) return;
      if (REQUIRE) throw new Fail(`this tree has no assets/xr/ (entry.js, session.js), and --require-session was given`);
      throw new Skip('this tree has no assets/xr/ yet; the case needs the product\'s XR module (it runs once xr-session is merged)');
    },
    async screenshot(p, name) { fs.mkdirSync(SHOTS, { recursive: true }); const f = path.join(SHOTS, `${name}.png`); await p.page.screenshot({ path: f }); return f; },
  };
  let state: Result['state'] = 'pass', msg: string | undefined;
  const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout: case exceeded ${TIMEOUT} ms`)), TIMEOUT));
  try {
    await Promise.race([c.run(t), timer]);
    // any uncaught error or console.error on any page the case opened fails it, unless the case consumed it with p.expect()
    const bad = pages.flatMap(p => p.errors).filter(e => !forgiven.some(re => re.test(e)));
    if (bad.length) throw new Fail(`${bad.length} page error(s): ${bad.slice(0, 3).join(' | ')}`);
  } catch (e: any) {
    if (e instanceof Skip) { state = 'skip'; msg = e.message; }
    else if (e instanceof Fail) { state = 'fail'; msg = e.message; }
    else if (attempt === 0 && INFRA.test(String(e && e.message))) { for (const p of pages) await p.close().catch(() => {}); await launch(); return runOne({ file, c }, device, 1).then(r => ({ ...r, retried: true })); }
    else { state = 'fail'; msg = `${e && e.name || 'Error'}: ${String(e && e.message || e).split('\n')[0]}`; }
  } finally { for (const p of pages) await p.close().catch(() => {}); }
  return { id: c.id, file, device, state, ms: Date.now() - t0, msg, notes };
}

console.log(`xr:test${FAKE ? ' (FAKE product module: harness validation only)' : ''}  iwer ${iwerVersion()}  house ${HOUSE}  devices ${wantDevices.join(',')}  driver ${DRIVER}  ${selected.length} case(s)`);
try {
  for (const e of selected) {
    for (const device of wantDevices) {
      if (e.c.devices && !e.c.devices.includes(device)) continue;
      const r = await runOne(e, device, 0);
      results.push(r);
      const tag = r.state === 'pass' ? 'PASS' : r.state === 'skip' ? 'SKIP' : 'FAIL';
      const nn = Object.entries(r.notes).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ');
      console.log(`${tag}  ${e.c.id.padEnd(14)} ${device.padEnd(7)} ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${e.c.title}${r.retried ? '  (retried once)' : ''}`);
      if (nn) console.log(`      ${nn}`);
      if (r.msg) console.log(`      ${r.state === 'fail' ? 'because: ' : ''}${r.msg}`);
    }
  }
} finally {
  await browser.close().catch(() => {});
  for (const tr of Object.values(trees)) await tr!.srv.close().catch(() => {});
  for (const s of extra) await s.close().catch(() => {});
  for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
}

const n = (s: string) => results.filter(r => r.state === s).length;
console.log(`\nxr:test  ${n('pass')} passed, ${n('fail')} failed, ${n('skip')} skipped`);
if (args.json && args.json !== 'true') fs.writeFileSync(path.resolve(args.json), JSON.stringify({ iwer: iwerVersion(), house: HOUSE, driver: DRIVER, results }, null, 1));
process.exit(n('fail') ? 1 : 0);
