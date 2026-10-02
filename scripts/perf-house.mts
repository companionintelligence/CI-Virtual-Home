#!/usr/bin/env -S node --experimental-strip-types
// Build and QA timings against their budgets (plan Completeness A4). Report-only: over budget is a warning, never a
// failure — the numbers are for each stream's PR to quote against main's, not a gate.
//
//   node --experimental-strip-types scripts/perf-house.mts [--house aurora,mirage,vanilla | --all] [--runs 1]
//        [--shot door-to-core,orbit,hero-reveal,core-orbit] [--out test/qa/perf.json] [--baseline] [--planner v2]
//   --planner v2 plans door-to-core, hero-reveal and walkthrough on spline planner v2 (S5): the planning is inside `build` (shotsFor),
//   its QA is `shotQA`; the budgets are the same. Never combine with --baseline (the baseline is the v1 fleet).
//
// Budgets, per house, on this machine:
//   build   ≤ 3 s     houseBuilder.build(spec) + shotsFor(spec, anchors): the main thread is blocked for all of it
//   track   ≤ 1 s     window.__houseShotTrack(shot), per shot
//   shotQA  ≤ 0.5 s   window.__houseShotQA(shot), per shot
// It also reports load: navigation → houseReady (fetch, the page's own start-up, the build).
//
// The build is timed without touching the page: an init script wraps build and shotsFor on the builder object the
// page publishes as window.__houseBuilderRef, before loadHouse first calls them. Timings use the wall clock, which is
// fine here — nothing a frame depends on is timed or changed. The machine may be shared: a load average is printed
// with the numbers, and a busy machine inflates them all.
//
// Writes test/qa/perf.json (gitignored) and prints each number's delta against the committed baseline,
// test/perf/baseline.json (the reference machine's run at S0: its load and core count are recorded beside it), or,
// without one, against the previous run. A stream PR quotes those deltas. --baseline writes this run as the
// baseline — on the reference machine, at integration, not on a stream branch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES_DIR = path.join(ROOT, 'content', 'houses');
const ALL = fs.readdirSync(HOUSES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
const HOUSES = args.all === 'true' ? ALL : (args.house || 'aurora,mirage,vanilla').split(',').filter(Boolean);
const SHOTS = (args.shot || 'door-to-core,orbit,hero-reveal,core-orbit').split(',').filter(Boolean);
const RUNS = Math.max(1, parseInt(args.runs || '1', 10));
const PLANNER = args.planner && args.planner !== 'true' ? `&planner=${encodeURIComponent(args.planner)}` : '';
if (PLANNER && args.baseline === 'true') { console.error('--baseline records the v1 fleet: drop --planner'); process.exit(2); }
const OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'test', 'qa', 'perf.json');
export const BUDGET = { buildMs: 3000, trackMs: 1000, shotQAMs: 500, shotsForMs: 1500 };   // (shotsForMs: under --planner v2, the planning of the three films inside `build` — reported apart, because `track` below only reads what it made)

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { pathToFileURL } = await import('node:url');
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable'); process.exit(2);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

// wraps build / shotsFor on the builder the page publishes, before the page first calls them
const INIT = () => {
  const w = window as any; w.__housePerf = { build: [], shots: [] };
  let ref = null;
  Object.defineProperty(w, '__houseBuilderRef', {
    configurable: true,
    get: () => ref,
    set: v => {
      ref = v;
      for (const k of ['build', 'shotsFor']) {
        const fn = v[k];
        v[k] = function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { w.__housePerf[k === 'build' ? 'build' : 'shots'].push(performance.now() - t); } };
      }
    },
  });
};

const load = os.loadavg().map(x => +x.toFixed(1));
const results = [];
for (const house of HOUSES) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', rt => rt.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', rt => rt.abort());
    await page.addInitScript(INIT);
    const t0 = Date.now();
    try {
      await page.goto(`http://localhost:${port}/room-creator.html?house=${house}${PLANNER}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, house, { timeout: 180000 });
      const loadMs = Date.now() - t0;
      const m = await page.evaluate(shots => {
        const w = window as any, out: any = { build: w.__housePerf.build[0] ?? null, shots: w.__housePerf.shots[0] ?? null, track: {}, qa: {} };
        for (const s of shots) {
          let t = performance.now();
          try { w.__houseShotTrack(s); out.track[s] = performance.now() - t; } catch { out.track[s] = null; }
          t = performance.now();
          try { w.__houseShotQA(s); out.qa[s] = performance.now() - t; } catch { out.qa[s] = null; }
        }
        return out;
      }, SHOTS);
      runs.push({ loadMs, buildMs: m.build === null ? null : m.build + (m.shots || 0), builderMs: m.build, shotsForMs: m.shots, trackMs: m.track, shotQAMs: m.qa });
    } catch (e) {
      runs.push({ error: e.message.split('\n')[0] });
    }
    await ctx.close();
  }
  // the fastest run of each measure (the least disturbed by whatever else the machine is doing)
  const ok = runs.filter(r => !r.error);
  const min = (f: (r: any) => number | null) => { const v = ok.map(f).filter(x => typeof x === 'number'); return v.length ? Math.min(...v) : null; };
  const rec: any = { house, runs: runs.length, error: ok.length ? undefined : runs[0].error,
    loadMs: min(r => r.loadMs), buildMs: min(r => r.buildMs), builderMs: min(r => r.builderMs), shotsForMs: min(r => r.shotsForMs),
    trackMs: Object.fromEntries(SHOTS.map(s => [s, min(r => r.trackMs[s])])), shotQAMs: Object.fromEntries(SHOTS.map(s => [s, min(r => r.shotQAMs[s])])) };
  results.push(rec);
}
await browser.close(); server.close();

// ---- report
const BASELINE = path.join(ROOT, 'test', 'perf', 'baseline.json');
const readJson = (f: string) => fs.existsSync(f) ? (() => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } })() : null;
const baseline = args.baseline === 'true' || PLANNER ? null : readJson(BASELINE);   // (the committed baseline is the v1 fleet: a v2 run is compared with its own previous run)
const prev = baseline || readJson(OUT), prevName = baseline ? `the baseline (${path.relative(process.cwd(), BASELINE)}: load ${(baseline.load || []).join(' ')} on ${baseline.cores} cores)` : path.relative(process.cwd(), OUT);
const prevOf = (h: string) => prev && (prev.results || []).find(r => r.house === h);
const f0 = (v: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v)}`);
const delta = (v: number | null, p: number | null) => (v === null || p === null || p === undefined ? '' : ` (${v - p >= 0 ? '+' : ''}${Math.round(v - p)})`);
const warnings = [];
console.log(`perf — ${HOUSES.length} house(s) × ${RUNS} run(s), fastest shown, ms; load average ${load.join(' ')} on ${os.cpus().length} cores`);
console.log(`budgets: build ≤ ${BUDGET.buildMs}, track ≤ ${BUDGET.trackMs} a shot, shot QA ≤ ${BUDGET.shotQAMs} a shot${PLANNER ? `, planning the three v2 films (the shots part of build) ≤ ${BUDGET.shotsForMs}` : ''}${prev ? `; (Δ) against ${prevName} of ${prev.when}` : ''}`);
if (PLANNER) console.log('(under --planner v2 the planner runs inside build, in shotsFor: `track` reads the film it made, so the cost of a film is the shots figure; a loaded machine inflates both)');
for (const r of results) {
  if (r.error) { console.log(`  ${r.house.padEnd(18)} ERROR ${r.error}`); warnings.push(`${r.house}: ${r.error}`); continue; }
  const p = prevOf(r.house);
  const parts = [`load ${f0(r.loadMs)}${delta(r.loadMs, p && p.loadMs)}`, `build ${f0(r.buildMs)}${delta(r.buildMs, p && p.buildMs)} (${f0(r.builderMs)} + shots ${f0(r.shotsForMs)})`];
  if (r.buildMs > BUDGET.buildMs) warnings.push(`${r.house}: build ${Math.round(r.buildMs)} ms > ${BUDGET.buildMs}`);
  if (PLANNER && r.shotsForMs > BUDGET.shotsForMs) warnings.push(`${r.house}: planning the films (shots in build) ${Math.round(r.shotsForMs)} ms > ${BUDGET.shotsForMs}`);
  for (const s of SHOTS) {
    parts.push(`${s} track ${f0(r.trackMs[s])}${delta(r.trackMs[s], p && p.trackMs && p.trackMs[s])} qa ${f0(r.shotQAMs[s])}${delta(r.shotQAMs[s], p && p.shotQAMs && p.shotQAMs[s])}`);
    if (r.trackMs[s] > BUDGET.trackMs) warnings.push(`${r.house}/${s}: track ${Math.round(r.trackMs[s])} ms > ${BUDGET.trackMs}`);
    if (r.shotQAMs[s] > BUDGET.shotQAMs) warnings.push(`${r.house}/${s}: shot QA ${Math.round(r.shotQAMs[s])} ms > ${BUDGET.shotQAMs}`);
  }
  console.log(`  ${r.house.padEnd(18)} ${parts.join(' · ')}`);
}
if (warnings.length) { console.log(`\n${warnings.length} over budget (report-only):`); for (const w of warnings) console.log(`  warn  ${w}`); }
else console.log('\nall within budget');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const record = JSON.stringify({ when: new Date().toISOString(), load, cores: os.cpus().length, budget: BUDGET, shots: SHOTS, results }, null, 1) + '\n';
fs.writeFileSync(OUT, record);
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
if (args.baseline === 'true') { fs.mkdirSync(path.dirname(BASELINE), { recursive: true }); fs.writeFileSync(BASELINE, record); console.log(`→ ${path.relative(process.cwd(), BASELINE)} (the baseline)`); }
process.exit(0);
