#!/usr/bin/env -S node --experimental-strip-types
// What does a headset draw? A census of the XR bake (assets/xr/bake.ts) on the real houses, in plain Chromium with no WebXR runtime.
//
//   node --experimental-strip-types scripts/xr-bake-census.mts [--houses a,b] [--tiers gen1,gen2,tethered,vision] [--json file] [--check true]
//                                                              [--frames 40] [--noscreen true] [--keep-going true]
//   pnpm run xr:census   (if the xr-test package has added the script; this file does not edit package.json)
//
// For each house it loads the live player (room-creator.html?mode=view, the Door-to-Core shot at t 0.55, paused, like the prototype this
// replaces), puts a stereo ArrayCamera at the shot's eye (two eyes 64 mm apart, 96 degrees vertical, 1344 x 1408 per eye:
// a Quest 3 at scale 0.8), and counts what one frame submits at eight headings (45 degrees apart: the person can look anywhere):
//
//   as shipped   the 2D player's scene as it is (its static batch included), world and all
//   merge only   the bake with nothing culled (lodRadius unbounded): the prototype's number (median 98 per eye, worst heading 130)
//   <tier>       the bake as xr-session applies it: tier budget, LOD radius, light rationing, shadow size. "fits" means the average
//                over the eight headings is within the tier's calls (at the refresh start), triangles, programs and texture budgets;
//                "worst" is the worst heading, which is what a person who turns around gets.
//
// Per-eye draws = renderer.info.render.calls / 2 (r169 has no multiview, so a stereo render is two draws per object). The JS cost is the
// median of --frames stereo renderer.render calls into the full-size MSAA target, one readPixels at the end to drain the GPU.
//
// --check fails (exit 1) when, on the gen2 tier, the median per-eye draw count of the merge-only row regresses more than 10 percent from
// the recorded values (98 average heading, 130 worst heading), or any house's restore leaves a different draw count behind.
// It is a regression guard and a report: the machine is shared, so counts (exact) gate and milliseconds (noisy) only inform.
//
// Honest limits: CPU numbers are from whatever machine this runs on (the M2 Max in the plan); the GPU cost of fragments, lights and
// overdraw on a tiler is NOT measured. IWER / a headset is needed for that.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, houseIds, parseArgs } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));
const args = parseArgs(process.argv.slice(2));
const HOUSES: string[] = args.houses ? args.houses.split(',') : houseIds();
const TIERS: string[] = (args.tiers || 'gen1,gen2,tethered,vision').split(',');
const FRAMES = Number(args.frames || 30);
const RECORDED = { avg: 98, worst: 130 };      // the prototype's medians over the 30 houses (r-xr-platform merge experiment), per eye
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const srv = await serve(ROOT, '/');
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
console.log(`census: ${HOUSES.length} houses, tiers ${TIERS.join(',')}, uptime ${os.loadavg().map(n => n.toFixed(0)).join('/')} (1/5/15 min load)`);

type Row = Record<string, any>;
const rows: Row[] = [];
let failed = 0;

for (const house of HOUSES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); await stubGoogleFonts(page, srv.origin);
  const errors: string[] = [];
  page.on('pageerror', (e: any) => errors.push(String(e.message || e)));
  try {
    await page.goto(`${srv.url('room-creator.html')}?mode=view&house=${house}&shot=door-to-core&play=0&t=0.55`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => (document.documentElement as any).dataset.viewer === 'ready', null, { timeout: 240000 });
    const res = await page.evaluate(async (o: any) => {
      const w = window as any;
      const d = w.__houseDebug(), r = d.renderer, scene = d.scene, camera = d.camera, THREE = w.__THREE, gl = r.getContext();
      const { createBake } = await import(new URL('./assets/xr/bake.js', location.href).href);
      const T = await import(new URL('./assets/platform-types.js', location.href).href);
      const host = { THREE, renderer: r, scene, camera, canvas: r.domElement, controls: null, api: {}, houseId: () => d.house.id, anchors: () => d.house.anchors, markDirty() {}, toast() {}, now: () => performance.now(), params: new URLSearchParams(o.hostParams || ''), no: new Set<string>() };
      const sync = () => { const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      const head: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
      // ---- the reference stereo rig: Quest 3 at scale 0.8, 8 headings from the player's own camera orientation
      const ew = 1344, eh = 1408, ipd = 0.064;
      const mk = (x: number) => { const c = new THREE.PerspectiveCamera(96, ew / eh, 0.1, 160); c.position.copy(camera.position); c.quaternion.copy(camera.quaternion); c.translateX(x); c.updateMatrixWorld(true); c.viewport = new THREE.Vector4(x < 0 ? 0 : ew, 0, ew, eh); return c; };
      const L = mk(-ipd / 2), R = mk(ipd / 2); const ac = new THREE.ArrayCamera([L, R]); ac.position.copy(camera.position); ac.quaternion.copy(camera.quaternion); ac.updateMatrixWorld(true);
      ac.projectionMatrix.copy(L.projectionMatrix); ac.projectionMatrixInverse.copy(L.projectionMatrix.clone().invert());
      const rt = new THREE.WebGLRenderTarget(ew * 2, eh, { samples: 0, colorSpace: r.outputColorSpace }); rt.isXRRenderTarget = true;   // as WebXRManager marks its own target, so the programs are the XR frame's (no MSAA: it changes the GPU cost, not the draw count or the JS)
      const Y = new THREE.Vector3(0, 1, 0);
      const measure = (frames: number) => {
        const prt = r.getRenderTarget(), au = r.shadowMap.autoUpdate, nu = r.shadowMap.needsUpdate, xe = r.xr.enabled;
        r.xr.enabled = false; r.setRenderTarget(rt); r.shadowMap.autoUpdate = false;
        const q0 = [L.quaternion.clone(), R.quaternion.clone(), ac.quaternion.clone()], p0 = [L.position.clone(), R.position.clone()];
        const calls: number[] = [], tris: number[] = [];
        for (let k = 0; k < 8; k++) {
          const q = new THREE.Quaternion().setFromAxisAngle(Y, k * Math.PI / 4);
          for (const [c, i] of [[L, 0], [R, 1]] as any) { c.position.copy(camera.position).add(new THREE.Vector3(i ? ipd / 2 : -ipd / 2, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(q)); c.quaternion.copy(camera.quaternion).premultiply(q); c.updateMatrixWorld(true); }
          ac.quaternion.copy(camera.quaternion).premultiply(q); ac.updateMatrixWorld(true);
          r.render(scene, ac); calls.push(r.info.render.calls / 2); tris.push(r.info.render.triangles / 2);
        }
        L.position.copy(p0[0]); R.position.copy(p0[1]); L.quaternion.copy(q0[0]); R.quaternion.copy(q0[1]); ac.quaternion.copy(q0[2]); L.updateMatrixWorld(true); R.updateMatrixWorld(true); ac.updateMatrixWorld(true);
        // JS submission: the heading the shot looks along
        r.render(scene, ac); r.render(scene, ac); sync();
        const cpu: number[] = []; for (let i = 0; i < frames; i++) { const a = performance.now(); r.render(scene, ac); cpu.push(performance.now() - a); } sync(); cpu.sort((a, b) => a - b);
        r.setRenderTarget(prt); r.shadowMap.autoUpdate = au; r.shadowMap.needsUpdate = nu; r.xr.enabled = xe;
        const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
        return { avg: avg(calls), worst: Math.max(...calls), trisAvg: avg(tris), trisWorst: Math.max(...tris), cpuMed: cpu[cpu.length >> 1], cpuMin: cpu[0] };
      };
      const snap = () => {
        const vis: Record<string, boolean> = {}; let n = 0; scene.traverse((x: any) => { x.userData.__census = n++; vis[x.userData.__census] = x.visible; });
        const lights: boolean[] = []; scene.traverse((x: any) => { if (x.isLight) lights.push(x.visible); });
        return { n, vis: JSON.stringify(vis), lights: lights.join(), auto: r.shadowMap.autoUpdate, size: scene.children.length };
      };
      const out: any = { houseId: d.house.id, load: 0 };
      out.shipped = measure(o.frames);
      const before = snap();
      out.tiers = {};
      // merge-only: nothing culled, nothing refused
      const infinite = (b: any) => ({ ...b, lodRadiusM: 1e6, callsSubmitted: { 72: 1e9, 90: 1e9, 120: 1e9 }, trisSubmitted: 1e12, programs: 1e6, textureMB: 1e6 });
      const names: Record<string, any> = { gen1: T.XR_TIERS['standalone-gen1'], gen2: T.XR_TIERS['standalone-gen2'], tethered: T.XR_TIERS.tethered, vision: T.XR_TIERS.vision };
      const runs: Array<[string, any]> = [['merge-only', infinite(names.gen2)], ...o.tiers.map((t: string) => [t, names[t]] as [string, any])];
      for (const [label, budget] of runs) {
        const bake = createBake(host);
        const t0 = performance.now();
        const rep = await bake.apply(budget, head);
        const det = bake.detail();
        const m = measure(o.frames);
        const lim = budget.callsSubmitted[budget.refreshHz.start] / 2;
        out.tiers[label] = { report: rep, detail: det, ...m, limit: lim, fits: m.avg <= lim && m.trisAvg * 2 <= budget.trisSubmitted, fitsWorst: m.worst <= lim, applyMs: performance.now() - t0 };
        // restore, twice (idempotent), and the scene must be what it was
        bake.restore(); bake.restore();
        const after = snap();
        out.tiers[label].restored = after.vis === before.vis && after.lights === before.lights && after.auto === before.auto && after.size === before.size;
      }
      const again = measure(Math.min(o.frames, 8));
      out.afterRestore = { avg: again.avg, worst: again.worst, same: again.avg === out.shipped.avg && again.worst === out.shipped.worst };
      rt.dispose();
      return out;
    }, { frames: FRAMES, tiers: TIERS, hostParams: args.params && args.params !== 'true' ? args.params : '' });
    res.load = os.loadavg()[0];
    res.errors = errors;
    rows.push(res);
    const f = (x: any) => x ? `${x.avg.toFixed(0)}/${x.worst.toFixed(0)}` : '-';
    const t = (name: string) => { const x = res.tiers[name]; return x ? `${name} ${f(x)}${x.fits ? '' : '*'} p${x.report.programs} ${x.cpuMed.toFixed(1)}ms` : ''; };
    console.log(`${house.padEnd(16)} shipped ${f(res.shipped)} ${res.shipped.cpuMed.toFixed(1)}ms | merge ${f(res.tiers['merge-only'])} ${res.tiers['merge-only'].cpuMed.toFixed(1)}ms | ${TIERS.map(t).join(' | ')} | restore ${Object.values(res.tiers).every((x: any) => x.restored) && res.afterRestore.same ? 'exact' : 'DIFFERS'} | load ${res.load.toFixed(0)}`);
    if (errors.length) console.log('   page errors:', errors.slice(0, 3).join(' | '));
  } catch (err: any) {
    failed++;
    console.log(`${house.padEnd(16)} FAILED: ${String(err && err.message || err).slice(0, 300)}`);
    if (args['keep-going'] !== 'true') { await ctx.close(); break; }
  }
  await ctx.close();
}
await browser.close(); await srv.close();

// ------------------------------------------------------------------------------------------------------------ the table per tier
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const ok = rows.filter(r => r.tiers);
if (ok.length) {
  console.log(`\n=== per-eye draws, median over ${ok.length} houses (average heading / worst heading) ===`);
  const line = (label: string, get: (r: Row) => any) => {
    const x = ok.map(get).filter(Boolean);
    console.log(`${label.padEnd(12)} ${median(x.map(v => v.avg)).toFixed(0).padStart(4)} / ${median(x.map(v => v.worst)).toFixed(0).padStart(4)}   JS ${median(x.map(v => v.cpuMed)).toFixed(2)} ms`);
  };
  line('as shipped', r => r.shipped);
  line('merge-only', r => r.tiers['merge-only']);
  console.log(`(recorded prototype: ${RECORDED.avg} / ${RECORDED.worst})`);
  for (const t of TIERS) {
    const x = ok.map(r => r.tiers[t]).filter(Boolean);
    if (!x.length) continue;
    const fit = x.filter(v => v.fits).length, fitW = x.filter(v => v.fitsWorst).length;
    const lim = x[0].limit;
    console.log(`${t.padEnd(12)} ${median(x.map(v => v.avg)).toFixed(0).padStart(4)} / ${median(x.map(v => v.worst)).toFixed(0).padStart(4)}   limit ${lim}/eye   fits ${fit}/${x.length} (average heading)   ${fitW}/${x.length} (worst heading)   programs median ${median(x.map(v => v.report.programs)).toFixed(0)} max ${Math.max(...x.map(v => v.report.programs))}   texture MB max ${Math.max(...x.map(v => v.report.textureMB))}   apply ms median ${median(x.map(v => v.applyMs)).toFixed(0)}`);
    const over = ok.filter(r => r.tiers[t] && !r.tiers[t].fits).map(r => `${r.houseId}(${r.tiers[t].avg.toFixed(0)}/${r.tiers[t].worst.toFixed(0)})`);
    if (over.length) console.log(`             too detailed: ${over.join(', ')}`);
  }
  const shipped = median(ok.map(r => r.shipped.cpuMed)), gen2 = median(ok.map(r => r.tiers.gen2 && r.tiers.gen2.cpuMed).filter(Boolean));
  if (gen2) console.log(`JS submission, median renderer.render: as shipped ${shipped.toFixed(2)} ms -> gen2 bake ${gen2.toFixed(2)} ms  (${(shipped / gen2).toFixed(1)}x lower)   load ${os.loadavg().map(n => n.toFixed(0)).join('/')}`);
}
if (args.json) fs.writeFileSync(path.resolve(args.json), JSON.stringify({ when: new Date().toISOString(), load: os.loadavg(), rows }, null, 1));

if (args.check === 'true') {
  const g = ok.map(r => r.tiers['merge-only']).filter(Boolean);
  const avg = median(g.map(v => v.avg)), worst = median(g.map(v => v.worst));
  const problems: string[] = [];
  if (avg > RECORDED.avg * 1.1) problems.push(`median per-eye draws (average heading) ${avg.toFixed(0)} > ${(RECORDED.avg * 1.1).toFixed(0)} (recorded ${RECORDED.avg} + 10 percent)`);
  if (worst > RECORDED.worst * 1.1) problems.push(`median per-eye draws (worst heading) ${worst.toFixed(0)} > ${(RECORDED.worst * 1.1).toFixed(0)} (recorded ${RECORDED.worst} + 10 percent)`);
  for (const r of ok) { if (!Object.values(r.tiers).every((x: any) => x.restored) || !r.afterRestore.same) problems.push(`${r.houseId}: restore left the scene different`); if (r.errors.length) problems.push(`${r.houseId}: page error ${r.errors[0]}`); }
  if (failed) problems.push(`${failed} house(s) failed to run`);
  if (problems.length) { console.log('\nCENSUS FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\ncensus check: ok');
}
process.exit(failed ? 1 : 0);
