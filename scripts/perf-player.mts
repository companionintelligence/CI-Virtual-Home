#!/usr/bin/env -S node --experimental-strip-types
// Runtime profile of the live player (room-creator.html?mode=view) — a benchmark, not a gate.
//
//   node --experimental-strip-types scripts/perf-player.mts [--mode bench|attr|load|raf|profile|census] [options]
//   (from a scratch copy: add --root <repo checkout with node_modules>; --json <file> keeps every row; --headed true to watch)
//   --query <string>   appended to the player URL, e.g. --query no=glass,lightguard,shadowcache,batch,compile: switches a
//                      live-only feature off for A/B (the player's ?no= kill switches), or --query 'no=glass&foo=1'.
//                      The player rewrites the address bar once up: confirm with performance.getEntriesByType('navigation')[0].name, not page.url()
//                      The live-realism tier is pinned with --query q=0|1|2 (assets/viewer-quality.ts); every bench row's note ends with
//                      `fx t<tier>[installed features]` and a `# effects` line prints the probe, the ladder's moves and each feature's stats.
//   --out <file.md>    the run as markdown: a header line (date, commit, uptime, dpr, throttle, query) and the rows as a table
//
// It drives the real player in Chromium with the real GPU flags (portal-lib's LAUNCH_ARGS: --use-angle=metal on a Mac),
// at a fixed 1280 x 720 viewport, served like scripts/test-portal.mts serves it (portal-lib's serve()). Nothing in the
// repo is edited: every measurement hook is injected from here (an init script wraps requestAnimationFrame; after the
// house is built, renderer.render is wrapped on the instance). The wrappers are outside the product frame: they read
// performance.now around it and never feed a value back into what is drawn.
//
// MODES
//   bench   (default) frame timing while, in the player:
//             shot   the shot plays (--shot, default door-to-core) from t = 0 for --window ms
//             orbit  the camera is dragged with the mouse (the player's free camera, OrbitControls under it) at a fixed
//                    2 px per frame, for --frames frames, from the shot 'orbit' at t = 0 (the opening view)
//             idle   paused, nothing dirty, --idle ms
//             hq     as shot, with the "Best quality" composer on (--hq)
//           per frame: the rAF delta (median / p95 / worst), the CPU time inside the page's rAF callback (the player's
//           frame(): controls, dressing, applySplineFrame, render) and inside renderer.render alone, the GPU time of
//           renderer.render from EXT_disjoint_timer_query_webgl2 when the browser has it, and renderer.info (calls,
//           triangles of the main pass incl. the transmission pass, programs, geometries, textures). The player's own
//           pixel-ratio adaptation is locked off (--adapt keeps it) so a row is one resolution.
//           Also (--sync, default on) a synchronous "throughput" figure: N renders of a fixed orbiting camera in a
//           tight loop, one readPixels at the end, wall time / N — it does not stop at the display's 60 Hz like the
//           rAF deltas do, so it shows headroom. shadow = one third of frames (what the player does while moving) or
//           every frame (a still frame).
//           Matrix:  --houses a,b  --defaults 1,2  --dpr 2,1  --throttle 1,4   (CDP CPU throttling, 4 = a weak CPU)
//           --defaults 2 serves the spec with "defaults": 2 through a Playwright route (content/houses is not touched).
//           A fixture id (test/fixtures/houses/<id>.json) works too: it is added to the gallery index and served from there.
//   attr    attribution: for the houses in --houses, one page session each, interleaved rounds (--rounds), every
//           experiment applied on top of the same fixed camera and timed in the synchronous loop, restored afterwards:
//           pixel ratio, shadow policy (off / cached / every 3rd / every frame / 2048 map / PCF), lights (none / no
//           spots), glass (hidden / transmission 0), transparent, roofs / storeys / site / world / furniture / walls
//           hidden, matrixWorldAutoUpdate frozen, frustum culling off, roof alphaHash off, tone mapping off, and --noaa
//           (a second page from a scratch copy of room-creator.html with antialias flipped: pass --noaa-html <file>;
//           make it with: sed 's/antialias: true/antialias: false/' room-creator.html > room-creator.noaa.html, next to the original).
//           --view exterior|interior|fly picks the camera (exterior = the shot 'orbit' at t 0; interior = door-to-core at 0.55;
//           fly = the player's free camera after pressing F, turned in place). --exps a,b,c picks experiments (BENCH_EXP.EXP has them all,
//           plus pr025 = the CPU floor and combos T_spots, T_pr15, noLights_T ...).
//           NOTE the tight loop does not present: on the heaviest houses it reads about 2.5x FASTER than the player's presented
//           rAF frames (cocoon: 34 ms vs 91 ms). Use it for ratios between knobs, use bench 'orbit' / raf for absolute frame times.
//   raf     A/B between our own presented requestAnimationFrame loop (one renderer.render per frame, camera turning) and the
//           player itself with its free camera dragged, per experiment; --variants a.html,b.html serves scratch copies of the page
//           (e.g. antialias or preserveDrawingBuffer flipped); --mute true silences the player's own renders while our loop runs
//           (without it the player also renders in the same frame and the own-loop rows count two renders).
//   profile a V8 CPU profile (CDP, 0.2 ms) of the same two loops: top functions by self time, and material.version bumps per frame.
//   census  no timing: lights by kind, shadow casters, meshes, materials, glass, renderer context attributes, per house x --defaults.
//   load    time to first frame and to interactive, network cold, plus JS heap, per house (--runs).
//
// OUTPUT  a table on stdout; --json <file> writes every row. `uptime` is printed at the start and after every row: a
// timing taken while the load average moved by more than 2x is flagged (~) and should be re-run.
//
// NOISE  The machine is shared. Take the median of >= 5 runs (--runs), interleave A/B (attr mode does), and record the load.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

// scripts/ inside the repo when this file lives there; --root <repo> from anywhere else (a scratch copy)
const HERE = import.meta.dirname;
const args = ((argv: string[]) => { const o: Record<string, string> = {}; argv.forEach((a, i) => { if (a.startsWith('--')) o[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; }); return o; })(process.argv.slice(2));
const ROOT = path.resolve(args.root || (fs.existsSync(path.join(HERE, 'portal-lib.mts')) ? path.join(HERE, '..') : path.join(HERE, 'wt')));
const { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));

const MODE = args.mode || 'bench';
const HOUSES = (args.houses || 'cutestarter').split(',').filter(Boolean);
const DEFAULTS = (args.defaults || '1').split(',').map(Number);
const DPRS = (args.dpr || '2').split(',').map(Number);
const THROTTLES = (args.throttle || '1').split(',').map(Number);
const SCENARIOS = (args.scenarios || 'shot,orbit,idle').split(',').filter(Boolean);
const RUNS = Number(args.runs || 5);
const WINDOW = Number(args.window || 5000), FRAMES = Number(args.frames || 240), IDLE = Number(args.idle || 2000);
const SHOT = args.shot || 'door-to-core';
const SYNC = args.sync !== 'false', SYNC_FRAMES = Number(args['sync-frames'] || 40), ADAPT = args.adapt === 'true';
const W = 1280, H = 720;
const DIR = path.resolve(args.dir || ROOT), BASE = args.base || '/';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const load1 = () => os.loadavg()[0];
const out: any[] = [];
const QUERY = String(args.query || '').replace(/^[?&]+/, '');
// every tab-separated line that is not a '#' header is a table row (the first is the header); the rest goes to --out as text
const tsv: string[][] = [], plain: string[] = [];
const log = (s: string) => { console.log(s); if (s.startsWith('#')) return; if (s.includes('\t')) tsv.push(s.split('\t')); else if (s.trim()) plain.push(s); };
const median = (a: number[]) => { const b = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const pct = (a: number[], p: number) => { const b = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');

// ------------------------------------------------------------------------------------------ the injected script
// Runs before the page's own scripts. Defines window.__bench. Everything here is measurement plumbing; the experiments
// (attr mode) live in BENCH_EXP below and are only called by this script.
const INIT = `(() => {
  const B = window.__bench = { on: false, inCb: false, frames: [], cur: null, sink: null, pending: [], hooked: false, gpu: true, pre: null, lockedPR: 0, ext: null, drag: null, lt: [], firstDraw: 0, firstRenderEnd: 0, readyAt: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (!B.on) return cb(ts);
    B.poll();
    let f = B.cur && B.cur.ts === ts ? B.cur : null;
    if (!f) { f = B.cur = { ts, cpu: 0, renders: [] }; B.frames.push(f); if (B.pre) B.pre(f); }
    const t0 = performance.now(); B.inCb = true;
    try { return cb(ts); } finally { B.inCb = false; f.cpu += performance.now() - t0; }
  });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) B.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  B.poll = () => {
    if (!B.pending.length) return;
    const gl = B.gl, ext = B.ext; let disj = false;
    try { disj = !!gl.getParameter(ext.GPU_DISJOINT_EXT); } catch (e) {}
    while (B.pending.length) {
      const p = B.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      p.rec.gpu = disj ? null : gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(p.q); B.pending.shift();
    }
  };
  B.settle = async () => { for (let i = 0; i < 200 && B.pending.length; i++) { await new Promise(r => setTimeout(r, 16)); B.poll(); } };
  B.install = () => {
    if (B.hooked) return;
    const d = window.__houseDebug(); const r = d.renderer, gl = r.getContext();
    B.r = r; B.gl = gl; B.scene = d.scene; B.camera = d.camera; B.THREE = window.__THREE;
    B.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const orig = r.render.bind(r); let depth = 0, t0 = 0, q = null;
    r.render = function (s, c) {
      if (B.suppress && !B.own && depth === 0) return;   // raf mode: the player's own render is muted while our loop runs
      if (depth++ === 0) { t0 = performance.now(); q = null; if (B.gpu && B.ext && B.pending.length < 24) { q = gl.createQuery(); gl.beginQuery(B.ext.TIME_ELAPSED_EXT, q); } }
      try { return orig(s, c); }
      finally {
        if (--depth === 0) {
          const cpu = performance.now() - t0;
          if (q) gl.endQuery(B.ext.TIME_ELAPSED_EXT);
          const info = r.info;
          const rec = { cpu, gpu: null, calls: info.render.calls, tris: info.render.triangles, programs: info.programs ? info.programs.length : 0, geos: info.memory.geometries, tex: info.memory.textures, own: !!B.own };
          if (q) B.pending.push({ q, rec });
          if (!B.firstRenderEnd) B.firstRenderEnd = performance.now();
          if (B.on && B.inCb && B.cur) B.cur.renders.push(rec); else if (B.sink) B.sink.push(rec);
        }
      }
    };
    const spr = r.setPixelRatio.bind(r);
    r.setPixelRatio = (v) => { if (B.lockedPR) return; return spr(v); };
    B.setPR = (v) => { const l = B.lockedPR; B.lockedPR = 0; spr(v); B.lockedPR = l; };
    B.hooked = true;
  };
  B.lockPR = (v) => { B.setPR(v); B.lockedPR = v; };
  // the drag: a real pointerdown from the driver, then one synthetic pointermove per frame
  B.startDrag = (x, y, dx, dy) => { B.drag = { x, y, dx, dy, n: 0 }; B.pre = () => {
    const D = B.drag; if (!D) return; D.n++;
    const c = document.getElementById('three-canvas');
    c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1, button: 0, clientX: D.x + D.dx * D.n, clientY: D.y + D.dy * D.n }));
  }; };
  B.stopDrag = () => { B.drag = null; B.pre = null; };
  B.begin = () => { B.frames = []; B.cur = null; B.sink = []; B.on = true; };
  B.end = async () => { B.on = false; await B.settle(); const fr = B.frames; B.frames = []; return fr; };
  // ---- load timings (load mode): the first draw call of the page, and when the player says it is ready
  if (window.__benchLoad) {
    const P = WebGL2RenderingContext.prototype, de = P.drawElements;
    P.drawElements = function () { if (!B.firstDraw) B.firstDraw = performance.now(); return de.apply(this, arguments); };
    const mo = new MutationObserver(() => { if (document.documentElement.dataset.viewer === 'ready' && !B.readyAt) { B.readyAt = performance.now(); try { B.install(); } catch (e) {} } });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-viewer'] }));
  }
})();`;

// ---- throughput loop and experiments, defined in the page after B.install() (evaluated once per page) ----
const BENCH_EXP = `(() => {
  const B = window.__bench, THREE = B.THREE, r = B.r, gl = B.gl, scene = B.scene, camera = B.camera;
  const Y = new THREE.Vector3(0, 1, 0);
  // the fixed camera: yaw about a pivot by 0.5 deg a frame. exterior: the pivot is where the view ray meets the ground;
  // interior: the camera's own position (a turn on the spot)
  B.setView = (kind) => {
    camera.updateMatrixWorld(true);
    const p0 = camera.position.clone(), q0 = camera.quaternion.clone();
    const d = camera.getWorldDirection(new THREE.Vector3());
    let pivot = p0.clone();
    if (kind === 'exterior' && d.y < -0.05) pivot = p0.clone().addScaledVector(d, -p0.y / d.y);
    B.view = { p0, q0, pivot };
  };
  B.pose = (i) => {
    const v = B.view, a = ((i % 720) * 0.5) * Math.PI / 180, R = new THREE.Quaternion().setFromAxisAngle(Y, a);
    camera.position.copy(v.p0).sub(v.pivot).applyQuaternion(R).add(v.pivot); camera.quaternion.copy(v.q0).premultiply(R); camera.updateMatrixWorld(true);
  };
  B.restoreView = () => { camera.position.copy(B.view.p0); camera.quaternion.copy(B.view.q0); camera.updateMatrixWorld(true); };
  const sync = () => { const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  // shadow: 'third' (the player while moving), 'every' (a still frame), 'never' (a cached map)
  B.throughput = async ({ frames = 40, warm = 6, shadow = 'third', gpu = true } = {}) => {
    const rec = []; B.sink = rec; B.on = false; B.gpu = gpu;
    const auto = r.shadowMap.autoUpdate;
    const one = (i) => { B.pose(i); r.shadowMap.autoUpdate = shadow === 'every' || (shadow === 'third' && i % 3 === 0); r.render(scene, camera); };
    for (let i = 0; i < warm; i++) one(i);
    sync(); await B.settle(); rec.length = 0;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) one(warm + i);
    sync(); const wall = performance.now() - t0;
    r.shadowMap.autoUpdate = auto; B.restoreView(); await B.settle(); B.sink = null;
    return { thr: wall / frames, cpu: rec.map(x => x.cpu), gpu: rec.map(x => x.gpu), calls: rec.length ? rec[rec.length - 1].calls : 0, tris: rec.length ? rec[rec.length - 1].tris : 0, programs: rec.length ? rec[rec.length - 1].programs : 0, geos: rec.length ? rec[rec.length - 1].geos : 0, tex: rec.length ? rec[rec.length - 1].tex : 0 };
  };
  // shadow pass count: one render with autoReset off sums the shadow pass into info; minus the main pass = the shadow pass
  B.passCounts = () => {
    B.pose(0);
    const i = r.info, ar = i.autoReset, auto = r.shadowMap.autoUpdate;
    i.autoReset = false; i.reset(); r.shadowMap.autoUpdate = true; r.shadowMap.needsUpdate = true; r.render(scene, camera); const tot = { calls: i.render.calls, tris: i.render.triangles };
    i.reset(); r.shadowMap.autoUpdate = false; r.render(scene, camera); const main = { calls: i.render.calls, tris: i.render.triangles };
    i.autoReset = ar; i.reset(); r.shadowMap.autoUpdate = auto; B.restoreView();
    return { mainCalls: main.calls, mainTris: main.tris, shadowCalls: tot.calls - main.calls, shadowTris: tot.tris - main.tris };
  };
  // ---- experiments: each { on(), off(), shadow? } ; off() restores exactly
  const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  const lights = []; scene.traverse(o => { if (o.isLight) lights.push(o); });
  const matsOf = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
  const allMats = new Set(); for (const m of meshes) for (const x of matsOf(m)) allMats.add(x);
  const isRoot = (o) => { let a = o; while (a.parent && a.parent !== scene) a = a.parent; return a; };
  const under = (o, pred) => { for (let a = o; a && a !== scene; a = a.parent) if (pred(a)) return true; return false; };
  const bbox = new THREE.Box3();
  const hider = (pred) => { let hid = []; return { on() { hid = []; const seen = new Set(); for (const c of scene.children) { if (c.isLight || c.userData.isHelper || seen.has(c)) continue; seen.add(c); if (pred(c) && c.visible) { c.visible = false; hid.push(c); } } B.lastHidden = hid.length; }, off() { for (const c of hid) c.visible = true; hid = []; } }; };
  const hideMeshes = (pred) => { let hid = []; return { on() { hid = []; for (const m of meshes) if (m.visible && pred(m)) { m.visible = false; hid.push(m); } B.lastHidden = hid.length; }, off() { for (const m of hid) m.visible = true; hid = []; } }; };
  const restoreAll = (m, v) => { for (const k in v) m[k] = v[k]; };
  const matFlag = (pred, set, restore) => { let hit = []; return { on() { hit = []; for (const m of allMats) if (pred(m)) { hit.push([m, restore(m)]); set(m); m.needsUpdate = true; } B.lastHidden = hit.length; }, off() { for (const [m, v] of hit) { restoreAll(m, v); m.needsUpdate = true; } hit = []; } }; };
  const glass = (m) => (m.transmission || 0) > 0;
  const sun = lights.find(l => l.isDirectionalLight && l.castShadow);
  const worldY = (c) => { bbox.setFromObject(c); return bbox.isEmpty() ? [0, 0] : [bbox.min.y, bbox.max.y]; };
  const sunSize = sun && sun.shadow.mapSize.x;
  B.EXP = {
    base: { on() {}, off() {} },
    pr15: { on() { B.setPR(1.5); r.setSize(${W}, ${H}, false); }, off() { B.setPR(B.basePR); r.setSize(${W}, ${H}, false); } },
    pr1: { on() { B.setPR(1); r.setSize(${W}, ${H}, false); }, off() { B.setPR(B.basePR); r.setSize(${W}, ${H}, false); } },
    shadowEvery: { shadow: 'every', on() {}, off() {} },
    shadowCached: { shadow: 'never', on() {}, off() {} },
    shadowsOff: { on() { r.shadowMap.enabled = false; for (const m of allMats) m.needsUpdate = true; }, off() { r.shadowMap.enabled = true; for (const m of allMats) m.needsUpdate = true; } },
    sunMap2048: { on() { if (sun) { sun.shadow.mapSize.set(2048, 2048); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; } }, off() { if (sun) { sun.shadow.mapSize.set(sunSize, sunSize); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; } } },
    shadowPCF: { on() { r.shadowMap.type = THREE.PCFShadowMap; for (const m of allMats) m.needsUpdate = true; }, off() { r.shadowMap.type = THREE.PCFSoftShadowMap; for (const m of allMats) m.needsUpdate = true; } },
    noLights: { on() { this.h = lights.filter(l => l.visible); for (const l of this.h) l.visible = false; B.lastHidden = this.h.length; }, off() { for (const l of this.h) l.visible = true; } },
    noSpots: { on() { this.h = lights.filter(l => l.visible && (l.isSpotLight || l.isPointLight)); for (const l of this.h) l.visible = false; B.lastHidden = this.h.length; }, off() { for (const l of this.h) l.visible = true; } },
    glassHidden: hideMeshes(m => matsOf(m).some(glass)),
    transmission0: matFlag(glass, m => { m.transmission = 0; }, m => ({ transmission: m.transmission })),
    transparentHidden: hideMeshes(m => matsOf(m).some(x => x.transparent && !glass(x))),
    roofsHidden: hider(c => under(c, a => a.userData && (a.userData.isRoof || a.userData.isCeiling))),
    upperHidden: hider(c => { if (c.userData.world || c.userData.isRoof) return false; const [lo] = worldY(c); return lo > 2.6; }),
    siteHidden: hider(c => c.userData.siteType || (c.name && /^Lot /.test(c.name))),
    worldHidden: hider(c => !!c.userData.world),
    furnitureHidden: hider(c => !!c.userData.itemType),
    wallsHidden: hider(c => !!c.userData.isWall),
    matrixFrozen: { on() { scene.updateMatrixWorld(true); this.p = scene.matrixWorldAutoUpdate; scene.matrixWorldAutoUpdate = false; }, off() { scene.matrixWorldAutoUpdate = this.p; } },
    cullOff: { on() { this.h = meshes.filter(m => m.frustumCulled); for (const m of this.h) m.frustumCulled = false; }, off() { for (const m of this.h) m.frustumCulled = true; } },
    roofAlphaHashOff: matFlag(m => m.alphaHash, m => { m.alphaHash = false; }, m => ({ alphaHash: true })),
    toneMapOff: { on() { this.p = r.toneMapping; r.toneMapping = THREE.NoToneMapping; for (const m of allMats) m.needsUpdate = true; }, off() { r.toneMapping = this.p; for (const m of allMats) m.needsUpdate = true; } },
  };
  // the CPU floor: a 0.25 pixel ratio makes the fragment work negligible, what is left is submission and vertex work
  B.EXP.pr025 = { on() { B.setPR(0.25); r.setSize(${W}, ${H}, false); }, off() { B.setPR(B.basePR); r.setSize(${W}, ${H}, false); } };
  const combo = (names) => ({ on() { for (const n of names) B.EXP[n].on(); B.lastHidden = 0; }, off() { for (const n of names.slice().reverse()) B.EXP[n].off(); } });
  B.EXP.T_spots = combo(['transmission0', 'noSpots']);
  B.EXP.T_pr15 = combo(['transmission0', 'pr15']);
  B.EXP.T_pr15_shadowCached = { shadow: 'never', ...combo(['transmission0', 'pr15']) };
  B.EXP.noLights_pr025 = combo(['noLights', 'pr025']);
  B.EXP.noLights_T = combo(['noLights', 'transmission0']);
  // a frame loop of our own in requestAnimationFrame (presented, like the player's, but none of the player's per-frame logic):
  // the camera turns 0.5 deg a frame, one renderer.render per frame
  B.rafRun = (frames, shadow = 'third') => new Promise(res => {
    let i = 0; B.begin(); B.suppress = !!B.muteplayer;
    const step = () => { if (i >= frames) { B.suppress = false; r.shadowMap.autoUpdate = true; res(0); return; } B.pose(i); r.shadowMap.autoUpdate = shadow === 'every' || (shadow === 'third' && i % 3 === 0); B.own = true; try { r.render(scene, camera); } finally { B.own = false; } i++; requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  B.expOn = (n) => { B.EXP[n].on(); const h = B.lastHidden; B.lastHidden = 0; return h; };
  B.expOff = (n) => B.EXP[n].off();
  B.basePR = r.getPixelRatio();
  B.runExp = async (name, o = {}) => {
    const e = B.EXP[name]; e.on(); const hid = B.lastHidden; B.lastHidden = 0;
    try { const res = await B.throughput({ frames: o.frames || 40, warm: o.warm || 8, shadow: e.shadow || 'third' }); const pc = o.counts ? (B.passCounts()) : null; res.hidden = hid; res.pass = pc; return res; }
    finally { e.off(); }
  };
})();`;

// ------------------------------------------------------------------------------------------ opening a player
const srv = await serve(DIR, BASE);
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });
process.on('SIGINT', async () => { try { await browser.close(); } catch { /* */ } process.exit(130); });

const FIXTURE_DIR = path.join(ROOT, 'test', 'fixtures', 'houses');
const isFixture = (id: string) => fs.existsSync(path.join(FIXTURE_DIR, `${id}.json`)) && !fs.existsSync(path.join(ROOT, 'content', 'houses', `${id}.json`));

type Opened = { page: any; ctx: any; cdp: any; errors: string[]; bytes: { n: number; b: number }; close: () => Promise<void> };
async function openPlayer(house: string, { defaults = 1, dpr = 2, throttle = 1, shot = SHOT, t = 0, htmlFile = 'room-creator.html', loadMode = false, cold = false } = {}): Promise<Opened> {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors: string[] = [], bytes = { n: 0, b: 0 };
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', () => { bytes.n++; });
  if (loadMode) await page.addInitScript('window.__benchLoad = true;');
  await page.addInitScript(INIT);
  await stubGoogleFonts(page, srv.origin);
  // defaults 2 and fixtures: served through a route; the repo's content/houses is never written
  const fixture = isFixture(house);
  let slot = house;
  if (fixture) {
    // the player only opens ids the gallery index lists: add the fixture there, and serve its spec
    await page.route('**/content/houses/index.json', async (r: any) => {
      const res = await r.fetch(); const j = await res.json();
      j.houses.push({ ...j.houses[0], id: house, name: house, author: 'fixture' });
      await r.fulfill({ response: res, body: JSON.stringify(j), contentType: 'application/json' });
    });
  }
  if (fixture || defaults === 2) {
    const file = fixture ? path.join(FIXTURE_DIR, `${house}.json`) : path.join(ROOT, 'content', 'houses', `${house}.json`);
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (defaults === 2) spec.defaults = 2;
    await page.route(`**/content/houses/${slot}.json`, (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(spec) }));
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); cdp.on('Network.loadingFinished', (e: any) => { bytes.b += e.encodedDataLength || 0; });
  if (cold) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const url = `${srv.url(htmlFile)}?mode=view&house=${house}&shot=${shot}&play=0${t ? `&t=${t}` : ''}${QUERY ? `&${QUERY}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000 });
  const state = await page.evaluate(() => document.documentElement.dataset.viewer);
  if (state !== 'ready') throw new Error(`the player did not open ${house}: ${await page.evaluate(() => document.querySelector('.vh-error-msg')?.textContent)}`);
  return { page, ctx, cdp, errors, bytes, close: () => ctx.close() };
}
async function settleAfterOpen(o: Opened, lockPR: number | null) {
  const { page } = o;
  await page.evaluate(() => (window as any).__bench.install());
  // the player has already drawn its first frame (unhooked); ask for another: the scrubber's input makes it dirty
  await setScrub(page, 0);
  // the first frame compiles the programs (a synchronous second or so): wait until it is drawn and the page idles
  await page.waitForFunction(() => (window as any).__bench.firstRenderEnd > 0, null, { timeout: 120000 });
  await sleep(600);
  if (lockPR && !ADAPT) await page.evaluate((v: number) => (window as any).__bench.lockPR(v), lockPR);
}
// warm the programs the shot will need: scrub through it once (each scrub is a rendered frame), and back to the start
async function warmShot(page: any) {
  for (const v of [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 0]) {
    await page.$eval('.vh-scrub input', (e: HTMLInputElement, v: number) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
}
const scrubT = (page: any): Promise<number> => page.$eval('.vh-scrub input', (e: HTMLInputElement) => Number(e.value) / 1000);
async function setScrub(page: any, v: number) {
  await page.$eval('.vh-scrub input', (e: HTMLInputElement, v: number) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// ------------------------------------------------------------------------------------------ summaries
type Frame = { ts: number; cpu: number; renders: { own?: boolean; cpu: number; gpu: number | null; calls: number; tris: number; programs: number; geos: number; tex: number }[] };
function summarize(frames: Frame[], dropFirst = 3, ownOnly = false) {
  // ownOnly: count only the renders the benchmark's own loop made (the player may render in the same frame too)
  const fr = frames.slice(dropFirst).map(f => (ownOnly ? { ...f, renders: f.renders.filter((r: any) => r.own) } : f));
  const dts: number[] = []; for (let i = 1; i < fr.length; i++) dts.push(fr[i].ts - fr[i - 1].ts);
  const rendered = fr.filter(f => f.renders.length);
  const sum = (f: Frame, k: 'cpu' | 'calls' | 'tris') => f.renders.reduce((a, r) => a + r[k], 0);
  const gpus = rendered.map(f => (f.renders.every(r => r.gpu != null) ? f.renders.reduce((a, r) => a + (r.gpu as number), 0) : NaN));
  const last = rendered.length ? rendered[rendered.length - 1].renders[rendered[rendered.length - 1].renders.length - 1] : null;
  return {
    n: fr.length, rendered: rendered.length,
    fps: dts.length ? 1000 / (dts.reduce((a, b) => a + b, 0) / dts.length) : NaN,
    dtMed: median(dts), dtP95: pct(dts, 0.95), dtMax: Math.max(...dts, 0),
    cpuFrameMed: median(rendered.map(f => f.cpu)), cpuFrameP95: pct(rendered.map(f => f.cpu), 0.95),
    cpuRenderMed: median(rendered.map(f => sum(f, 'cpu'))), gpuMed: median(gpus), gpuP95: pct(gpus, 0.95),
    calls: median(rendered.map(f => sum(f, 'calls'))), tris: median(rendered.map(f => sum(f, 'tris'))),
    programs: last ? last.programs : 0, geos: last ? last.geos : 0, tex: last ? last.tex : 0,
    idleCpuMed: median(fr.map(f => f.cpu)),
  };
}
const medRows = (rows: any[]) => { const o: any = {}; for (const k of Object.keys(rows[0])) o[k] = k === 'note' ? rows[rows.length - 1][k] : median(rows.map(r => r[k])); o.runs = rows.length; return o; };

async function scenarioRun(o: Opened, sc: string): Promise<any> {
  const { page } = o;
  const B = () => page.evaluate(() => 0);
  if (sc === 'shot' || sc === 'hq') {
    await setScrub(page, 0);
    await page.evaluate(() => (window as any).__bench.begin());
    await page.keyboard.press(' ');                       // Space: play
    await sleep(WINDOW);
    const t1 = await scrubT(page);
    await page.keyboard.press(' ');                       // pause
    const fr: Frame[] = await page.evaluate(() => (window as any).__bench.end());
    const prNote = await page.evaluate(() => { const v = (window as any).__houseViewer; return v ? ` pr ${v.pixelRatio}${v.settled ? ' settled' : ''}` : ''; });
    return { ...summarize(fr), note: `t ${t1.toFixed(2)}${prNote}` };
  }
  if (sc === 'orbit') {
    // the opening view of the Orbit shot, paused at t 0 (loaded that way: shot=orbit is set by the caller)
    const cx = W / 2, cy = H * 0.45;
    await page.mouse.move(cx, cy);
    const p0: number[] = await page.evaluate(() => (window as any).__bench.camera.position.toArray());
    await page.evaluate(() => (window as any).__bench.begin());
    await page.mouse.down();
    await page.evaluate(([x, y]: number[]) => (window as any).__bench.startDrag(x, y, 2, 0), [cx, cy]);
    await page.waitForFunction((n: number) => (window as any).__bench.drag && (window as any).__bench.drag.n >= n, FRAMES + 3, { timeout: 120000, polling: 50 });
    await page.evaluate(() => (window as any).__bench.stopDrag());
    await page.mouse.up();
    const fr: Frame[] = await page.evaluate(() => (window as any).__bench.end());
    const p1: number[] = await page.evaluate(() => (window as any).__bench.camera.position.toArray());
    const prNote = await page.evaluate(() => { const v = (window as any).__houseViewer; return v ? ` pr ${v.pixelRatio}${v.settled ? ' settled' : ''}` : ''; });
    return { ...summarize(fr), note: `moved ${Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).toFixed(1)} m${prNote}` };
  }
  if (sc === 'idle') {
    await page.evaluate(() => (window as any).__bench.begin());
    await sleep(IDLE);
    const fr: Frame[] = await page.evaluate(() => (window as any).__bench.end());
    return summarize(fr, 2);
  }
  throw new Error('scenario ' + sc);
}

// ------------------------------------------------------------------------------------------ mode: bench
async function bench() {
  log(`# perf-player bench  ${new Date().toISOString()}  root ${ROOT}\n# uptime ${execSync('uptime').toString().trim()}\n# viewport ${W}x${H}, runs ${RUNS}, window ${WINDOW} ms, orbit ${FRAMES} frames, adapt ${ADAPT ? 'on' : 'locked'}`);
  const hdr = ['house', 'dflt', 'dpr', 'cpu', 'scenario', 'fps', 'dt med', 'p95', 'max', 'frame cpu', 'render cpu', 'gpu', 'calls', 'tris(k)', 'prog', 'geo', 'tex', 'thr ms', 'rend%', 'idle cpu', 'note', 'load'];
  log(hdr.join('\t'));
  for (const house of HOUSES) for (const defaults of DEFAULTS) for (const dpr of DPRS) for (const thr of THROTTLES) {
    const l0 = load1();
    let o: Opened | null = null;
    try {
      const rowsBy: Record<string, any[]> = {};
      const sync: Record<string, any[]> = {};
      const scs = SCENARIOS.filter(s => s !== 'orbit' && s !== 'hq');
      const wantOrbit = SCENARIOS.includes('orbit'), wantHq = SCENARIOS.includes('hq');
      // shot / idle / sync from the shot's own page load, the orbit from an Orbit load, HQ last (it builds the composer)
      o = await openPlayer(house, { defaults, dpr, throttle: thr, shot: SHOT });
      await settleAfterOpen(o, Math.min(dpr, 2));
      await warmShot(o.page);
      for (let i = 0; i < RUNS; i++) {
        for (const sc of scs) (rowsBy[sc] ||= []).push(await scenarioRun(o, sc));
      }
      if (SYNC) {
        await o.page.evaluate(BENCH_EXP);
        for (const view of ['exterior', 'interior']) {
          if (view === 'interior') { await setScrub(o.page, 550); } else { await setScrub(o.page, 0); }
          // bench: the shot's frame 0 (outside the door) and frame 0.55 (inside), turning on the spot / round the ground point
          await o.page.evaluate((v: string) => (window as any).__bench.setView(v), view);
          for (const shadow of ['third', 'every']) {
            const res: any[] = [];
            for (let i = 0; i < RUNS; i++) { const r = await o.page.evaluate((s: string) => (window as any).__bench.throughput({ frames: 40, warm: 6, shadow: s }), shadow); res.push({ thr: r.thr, cpu: median(r.cpu), gpu: median(r.gpu), calls: r.calls, tris: r.tris, programs: r.programs, geos: r.geos, tex: r.tex }); }
            (sync[`sync-${view === 'exterior' ? 't0' : 't55'}-${shadow}`] ||= []).push(...res);
          }
        }
        await setScrub(o.page, 0);
      }
      // the live-realism report (assets/realism.ts) of the page just measured: the tier it settled on and what installed
      let fxNote = '';
      const fxOf = async (page: any) => {
        const fx = await page.evaluate(() => { const e = (window as any).__houseViewer?.effects; return e ? { tier: e.tier, ceiling: e.probe.ceiling, why: e.probe.reasons, probeMs: e.probe.ms, installed: e.installed, failed: e.failed, moves: e.ladder.moves, features: e.features } : null; }).catch(() => null);
        fxNote = fx ? ` fx t${fx.tier}${fx.installed.length ? `[${fx.installed.join(',')}]` : ''}${fx.failed.length ? ` FAILED ${fx.failed.map((f: any) => f.key).join(',')}` : ''}${fx.moves.length ? ` moves ${fx.moves.join(';')}` : ''}` : '';
        if (fx) log(`# effects ${house}: ${JSON.stringify(fx)}`);
      };
      await fxOf(o.page);
      const rowOut = (label: string, s: any, extra: any = {}) => {
        const row = { house, defaults, dpr, throttle: thr, scenario: label, ...s, ...extra, load: [+l0.toFixed(0), +load1().toFixed(0)] };
        row.note = `${row.note || ''}${fxNote}`.trim();
        out.push(row);
        log([house, defaults, dpr, thr, label, f1(s.fps), f1(s.dtMed), f1(s.dtP95), f1(s.dtMax), f1(s.cpuFrameMed), f1(s.cpuRenderMed), f1(s.gpuMed), Math.round(s.calls), f1(s.tris / 1000), s.programs, s.geos, s.tex, f1(row.thr), Number.isFinite(s.rendered) ? `${Math.round(100 * s.rendered / s.n)}` : '-', f1(s.idleCpuMed), row.note || '', `${row.load[0]}->${row.load[1]}${row.load[1] > 2 * row.load[0] || row.load[0] > 2 * row.load[1] ? ' ~' : ''}`].join('\t'));
      };
      for (const sc of scs) rowOut(sc, medRows(rowsBy[sc]));
      for (const k of Object.keys(sync)) { const m = medRows(sync[k]); rowOut(k, { fps: 1000 / m.thr, dtMed: m.thr, dtP95: NaN, dtMax: NaN, cpuFrameMed: NaN, cpuRenderMed: m.cpu, gpuMed: m.gpu, calls: m.calls, tris: m.tris, programs: m.programs, geos: m.geos, tex: m.tex }, { thr: m.thr }); }
      await o.close(); o = null;
      if (wantOrbit) {
        o = await openPlayer(house, { defaults, dpr, throttle: thr, shot: 'orbit' });
        await settleAfterOpen(o, Math.min(dpr, 2));
        await warmShot(o.page);
        const rows: any[] = [];
        for (let i = 0; i < RUNS; i++) {
          // back to the opening view between runs: reload the shot's frame 0 and leave the free camera
          await o.page.keyboard.press('Escape'); await setScrub(o.page, 0);
          rows.push(await scenarioRun(o, 'orbit'));
        }
        await fxOf(o.page);
        rowOut('orbit', medRows(rows));
        await o.close(); o = null;
      }
      if (wantHq) {
        o = await openPlayer(house, { defaults, dpr, throttle: thr, shot: SHOT });
        await settleAfterOpen(o, Math.min(dpr, 2));
        await warmShot(o.page);
        await o.page.click('[data-act="hq"]');
        await o.page.waitForFunction(() => document.querySelector('[data-act="hq"]')!.getAttribute('aria-busy') !== 'true', null, { timeout: 120000 });
        await sleep(1500);
        const rows: any[] = [];
        for (let i = 0; i < Math.max(2, Math.ceil(RUNS / 2)); i++) rows.push(await scenarioRun(o, 'hq'));
        await fxOf(o.page);
        rowOut('hq', medRows(rows));
        await o.close(); o = null;
      }
    } catch (e: any) {
      log(`${house} d${defaults} dpr${dpr} cpu${thr}: FAILED ${String(e.message).split('\n')[0]}`);
      out.push({ house, defaults, dpr, throttle: thr, error: String(e.message).split('\n')[0] });
      try { await o?.close(); } catch { /* */ }
    }
  }
}

// ------------------------------------------------------------------------------------------ mode: attr
const EXPERIMENTS = (args.exps || 'base,pr15,pr1,noAA,shadowEvery,shadowCached,shadowsOff,sunMap2048,shadowPCF,noLights,noSpots,glassHidden,transmission0,transparentHidden,roofsHidden,upperHidden,siteHidden,worldHidden,furnitureHidden,wallsHidden,matrixFrozen,cullOff,roofAlphaHashOff,toneMapOff').split(',');
async function attr() {
  const ROUNDS = Number(args.rounds || 5);
  const views = (args.view || 'exterior') === 'both' ? ['exterior', 'interior'] : (args.view || 'exterior').split(',');
  const dpr = DPRS[0];
  log(`# perf-player attr  ${new Date().toISOString()}  root ${ROOT}\n# uptime ${execSync('uptime').toString().trim()}\n# dpr ${dpr}, rounds ${ROUNDS}, views ${views.join('/')}, 40 frames per timing after 8 warm frames, sync loop, camera turning 0.5 deg a frame`);
  log(['house', 'defaults', 'view', 'experiment', 'thr ms', 'min', 'max', 'cpu med', 'cpu p95', 'gpu med', 'main calls', 'main tris(k)', 'shadow calls', 'hidden', 'load'].join('\t'));
  for (const house of HOUSES) for (const defaults of DEFAULTS) for (const view of views) {
    let A: Opened | null = null, N: Opened | null = null;
    try {
      const shot = view === 'interior' ? 'door-to-core' : 'orbit', t = view === 'interior' ? 0.55 : 0;
      A = await openPlayer(house, { defaults, dpr, shot, t });
      await settleAfterOpen(A, dpr);
      // fly: the player's free camera (what a drag or F does): the house is dressed for where you are (walls up, roof on) and the path shows
      if (view === 'fly') { await A.page.keyboard.press('f'); await A.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(400); }
      await A.page.evaluate(BENCH_EXP);
      await A.page.evaluate((v: string) => (window as any).__bench.setView(v === 'fly' ? 'exterior' : v), view);
      const hasNoAA = EXPERIMENTS.includes('noAA') && args['noaa-html'];
      if (hasNoAA) {
        N = await openPlayer(house, { defaults, dpr, shot, t, htmlFile: args['noaa-html'] });
        await settleAfterOpen(N, dpr);
        if (view === 'fly') { await N.page.keyboard.press('f'); await N.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(400); }
        await N.page.evaluate(BENCH_EXP);
        await N.page.evaluate((v: string) => (window as any).__bench.setView(v === 'fly' ? 'exterior' : v), view);
      }
      const names = EXPERIMENTS.filter(x => x !== 'noAA' || hasNoAA);
      const acc: Record<string, any[]> = {};
      const counts: Record<string, any> = {};
      const l0 = load1();
      for (let round = 0; round < ROUNDS; round++) {
        // rotate the order each round so a slow drift does not sit on one experiment
        const order = names.map((_, i) => names[(i + round * 5) % names.length]);
        for (const name of order) {
          const target = name === 'noAA' ? N! : A!; const exp = name === 'noAA' ? 'base' : name;
          const res = await target.page.evaluate(([e, c]: [string, boolean]) => (window as any).__bench.runExp(e, { counts: c }), [exp, round === 0]);
          (acc[name] ||= []).push(res);
          if (round === 0) counts[name] = res.pass;
        }
      }
      const l1 = load1();
      for (const name of names) {
        const rs = acc[name]; const thr = rs.map(r => r.thr);
        const row = { house, defaults, view, experiment: name, thr: median(thr), thrMin: Math.min(...thr), thrMax: Math.max(...thr), cpuMed: median(rs.flatMap(r => r.cpu)), cpuP95: pct(rs.flatMap(r => r.cpu), 0.95), gpuMed: median(rs.flatMap(r => r.gpu)), calls: counts[name]?.mainCalls ?? rs[0].calls, tris: counts[name]?.mainTris ?? rs[0].tris, shadowCalls: counts[name]?.shadowCalls, hidden: rs[0].hidden, rounds: rs.length, load: [+l0.toFixed(0), +l1.toFixed(0)] };
        out.push(row);
        log([house, defaults, view, name, f1(row.thr), f1(row.thrMin), f1(row.thrMax), f1(row.cpuMed), f1(row.cpuP95), f1(row.gpuMed), row.calls, f1(row.tris / 1000), row.shadowCalls ?? '-', row.hidden ?? '-', `${row.load[0]}->${row.load[1]}`].join('\t'));
      }
    } catch (e: any) { log(`${house} d${defaults} ${view}: FAILED ${String(e.message).split('\n')[0]}`); out.push({ house, defaults, view, error: String(e.message) }); }
    finally { try { await A?.close(); await N?.close(); } catch { /* */ } }
  }
}

// ------------------------------------------------------------------------------------------ mode: load
async function loadMode() {
  log(`# perf-player load  ${new Date().toISOString()}\n# uptime ${execSync('uptime').toString().trim()}`);
  log(['house', 'dpr', 'run', 'dcl', 'ready', 'first draw', 'first render end', 'tti', 'blocking', 'longest task', 'heap MB', 'heap +8s MB', 'requests', 'KB', 'load'].join('\t'));
  for (const house of HOUSES) for (const dpr of DPRS) {
    const rows: any[] = [];
    for (let i = 0; i < RUNS; i++) {
      const l0 = load1();
      const o = await openPlayer(house, { dpr, loadMode: true, cold: true, shot: 'orbit' });
      try {
        await o.page.waitForFunction(() => (window as any).__bench.firstRenderEnd > 0, null, { timeout: 120000 });
        await sleep(2500);
        const m = await o.cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
        await o.cdp.send('Performance.enable');
        const heap = async () => { const r = await o.cdp.send('Performance.getMetrics'); return (r.metrics.find((x: any) => x.name === 'JSHeapUsedSize')?.value || 0) / 1048576; };
        const heap1 = await heap();
        const r = await o.page.evaluate(() => {
          const B = (window as any).__bench, nav = performance.getEntriesByType('navigation')[0] as any;
          return { dcl: nav.domContentLoadedEventEnd, ready: B.readyAt, firstDraw: B.firstDraw, firstRenderEnd: B.firstRenderEnd, lt: B.lt };
        });
        // TTI: the end of the last long task that starts before the first 1 s quiet window after the first render
        let tti = r.firstRenderEnd; const lts: number[][] = r.lt.filter((x: number[]) => x[0] + x[1] >= r.firstRenderEnd - 1 || x[0] >= r.ready - 1).sort((a: number[], b: number[]) => a[0] - b[0]);
        for (const [s, d] of lts) if (s - tti < 1000 && s >= r.firstRenderEnd - 1) tti = Math.max(tti, s + d);
        const blocking = r.lt.reduce((a: number, [, d]: number[]) => a + Math.max(0, d - 50), 0), longest = Math.max(0, ...r.lt.map((x: number[]) => x[1]));
        await sleep(8000);
        const heap2 = await heap();
        const row = { house, dpr, dcl: r.dcl, ready: r.ready, firstDraw: r.firstDraw, firstRenderEnd: r.firstRenderEnd, tti, blocking, longest, heap1, heap2, requests: o.bytes.n, kb: o.bytes.b / 1024, load: [+l0.toFixed(0), +load1().toFixed(0)] };
        rows.push(row); out.push({ ...row, run: i });
        log([house, dpr, i, f1(r.dcl), f1(r.ready), f1(r.firstDraw), f1(r.firstRenderEnd), f1(tti), f1(blocking), f1(longest), f1(heap1), f1(heap2), o.bytes.n, f1(o.bytes.b / 1024), row.load.join('->')].join('\t'));
      } catch (e: any) {
        // a run that never got there (a host sleep, a stalled driver) is an error row, not a crash of the whole mode
        log(`${house}\t${dpr}\t${i}\tFAILED ${String(e.message).split('\n')[0]}`); out.push({ house, dpr, run: i, error: String(e.message) });
      } finally { await o.close(); }
    }
    if (!rows.length) { out.push({ house, dpr, median: true, error: 'no run finished' }); continue; }
    const M = (k: string) => median(rows.map(r => r[k]));
    log(`${house}\tdpr ${dpr}\tMEDIAN of ${rows.length}\tdcl ${f1(M('dcl'))}\tready ${f1(M('ready'))}\tfirstDraw ${f1(M('firstDraw'))}\tfirstRenderEnd ${f1(M('firstRenderEnd'))}\ttti ${f1(M('tti'))}\tblocking ${f1(M('blocking'))}\theap ${f1(M('heap1'))}/${f1(M('heap2'))} MB\treq ${M('requests')}\tKB ${f1(M('kb'))}`);
    out.push({ house, dpr, median: true, ...Object.fromEntries(['dcl', 'ready', 'firstDraw', 'firstRenderEnd', 'tti', 'blocking', 'longest', 'heap1', 'heap2', 'requests', 'kb'].map(k => [k, M(k)])) });
  }
}

// ------------------------------------------------------------------------------------------ mode: raf
// Where the player's frame goes beyond renderer.render in the tight loop: per (page variant x experiment), in the same
// state (--view fly by default), the frame time of (a) our own requestAnimationFrame loop calling renderer.render once
// a frame (presented, no player logic) and (b) the player itself with the free camera dragged (player logic + present).
// Variants are html files served next to room-creator.html (scratch copies with a renderer flag flipped: --variants a.html,b.html).
async function rafMode() {
  const ROUNDS = Number(args.rounds || 3), N = Number(args['raf-frames'] || 90), dpr = DPRS[0];
  const variants = (args.variants || 'room-creator.html').split(',');
  const exps = (args.exps || 'base').split(',');
  const view = args.view || 'fly';
  log(`# perf-player raf  ${new Date().toISOString()}\n# uptime ${execSync('uptime').toString().trim()}\n# dpr ${dpr}, rounds ${ROUNDS}, ${N} frames per loop after 12 warm, view ${view}`);
  log(['house', 'variant', 'experiment', 'loop', 'fps', 'dt med', 'p95', 'max', 'render cpu', 'frame cpu', 'calls', 'load'].join('\t'));
  for (const house of HOUSES) {
    const pages: Opened[] = [];
    try {
      for (const v of variants) {
        const shot = view === 'interior' ? 'door-to-core' : 'orbit', t = view === 'interior' ? 0.55 : 0;
        const o = await openPlayer(house, { dpr, shot, t, htmlFile: v });
        await settleAfterOpen(o, dpr);
        if (view === 'fly') { await o.page.keyboard.press('f'); await o.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(400); }
        await o.page.evaluate(BENCH_EXP);
        await o.page.evaluate((m: boolean) => { (window as any).__bench.muteplayer = m; }, args.mute === 'true');
        await o.page.evaluate((k: string) => (window as any).__bench.setView(k === 'fly' ? 'exterior' : k), view);
        pages.push(o);
      }
      const acc: Record<string, any[]> = {};
      for (let round = 0; round < ROUNDS; round++) {
        for (let vi = 0; vi < variants.length; vi++) for (const e of exps.map((_, i) => exps[(i + round) % exps.length])) {
          const o = pages[vi], page = o.page;
          await page.evaluate((n: string) => (window as any).__bench.expOn(n), e);
          await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
          // (a) our own loop
          await page.evaluate((n: number) => (window as any).__bench.rafRun(n), 12);   // warm (compiles what the experiment changed)
          await page.evaluate(() => (window as any).__bench.end());
          await page.evaluate((n: number) => (window as any).__bench.rafRun(n), N);
          let fr: Frame[] = await page.evaluate(() => (window as any).__bench.end());
          (acc[`${variants[vi]}|${e}|own-loop`] ||= []).push(summarize(fr, 0, true));
          await page.evaluate(() => (window as any).__bench.restoreView());
          // (b) the player, free camera dragged
          const cx = W / 2, cy = H * 0.45;
          await page.mouse.move(cx, cy);
          await page.evaluate(() => (window as any).__bench.begin());
          await page.mouse.down();
          await page.evaluate(([x, y]: number[]) => (window as any).__bench.startDrag(x, y, 2, 0), [cx, cy]);
          await page.waitForFunction((n: number) => (window as any).__bench.drag && (window as any).__bench.drag.n >= n, N + 12, { timeout: 120000, polling: 50 });
          await page.evaluate(() => (window as any).__bench.stopDrag());
          await page.mouse.up();
          fr = await page.evaluate(() => (window as any).__bench.end());
          (acc[`${variants[vi]}|${e}|player-drag`] ||= []).push(summarize(fr, 12));
          await page.evaluate((n: string) => (window as any).__bench.expOff(n), e);
          await page.evaluate(() => (window as any).__bench.restoreView());
        }
      }
      const l1 = load1();
      for (const [k, rows] of Object.entries(acc)) {
        const [v, e, loop] = k.split('|'); const m = medRows(rows);
        out.push({ house, variant: v, experiment: e, loop, ...m });
        log([house, v, e, loop, f1(m.fps), f1(m.dtMed), f1(m.dtP95), f1(m.dtMax), f1(m.cpuRenderMed), f1(m.cpuFrameMed), Math.round(m.calls), l1.toFixed(0)].join('\t'));
      }
    } catch (e: any) { log(`${house}: FAILED ${String(e.message).split('\n')[0]}`); }
    finally { for (const o of pages) { try { await o.close(); } catch { /* */ } } }
  }
}

// ------------------------------------------------------------------------------------------ mode: profile
// A V8 CPU profile (CDP Profiler, 0.2 ms sampling) of the page's main thread over N frames of (a) our own requestAnimationFrame
// loop calling renderer.render and (b) the player with the free camera dragged, same house, same state (--view fly): the top
// functions by self time. Where a frame's milliseconds are spent inside three.js and the player, not a GPU number.
// It also counts, per frame of the drag, how many material.version bumps (needsUpdate) and visibility flips the player made.
async function profileMode() {
  const N = Number(args['raf-frames'] || 90), dpr = DPRS[0], view = args.view || 'fly', top = Number(args.top || 18);
  log(`# perf-player profile  ${new Date().toISOString()}\n# uptime ${execSync('uptime').toString().trim()}\n# dpr ${dpr}, ${N} frames, view ${view}`);
  for (const house of HOUSES) {
    const shot = view === 'interior' ? 'door-to-core' : 'orbit', t = view === 'interior' ? 0.55 : 0;
    const o = await openPlayer(house, { dpr, shot, t });
    try {
      await settleAfterOpen(o, dpr);
      if (view === 'fly') { await o.page.keyboard.press('f'); await o.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(400); }
      await o.page.evaluate(BENCH_EXP);
      await o.page.evaluate((k: string) => (window as any).__bench.setView(k === 'fly' ? 'exterior' : k), view);
      // bumps: sum of material versions, count of visible meshes, at each frame start (B.pre)
      await o.page.evaluate(() => {
        const B = (window as any).__bench, mats = new Set<any>(), meshes: any[] = [];
        B.scene.traverse((m: any) => { if (m.isMesh) { meshes.push(m); for (const x of (Array.isArray(m.material) ? m.material : [m.material])) mats.add(x); } });
        B.watch = { mats: [...mats], meshes, log: [] as number[][] };
        B.sample = () => { let v = 0; for (const m of B.watch.mats) v += m.version; let vis = 0; for (const m of B.watch.meshes) if (m.visible) vis++; return [v, vis, B.r.info.programs.length]; };
      });
      const prof = async (label: string, run: () => Promise<void>) => {
        const cdp = o.cdp;
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
        await run();   // warm
        const s0 = await o.page.evaluate(() => (window as any).__bench.sample());
        await cdp.send('Profiler.start');
        await run();
        const { profile } = await cdp.send('Profiler.stop');
        const s1 = await o.page.evaluate(() => (window as any).__bench.sample());
        const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]));
        const self = new Map<string, number>(); let total = 0;
        profile.samples.forEach((id: number, i: number) => { const n = byId.get(id), dt = profile.timeDeltas[i] / 1000; const cf = n.callFrame; const k = `${cf.functionName || '(anon)'}  ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + dt); total += dt; });
        log(`\n${house} ${label}: ${total.toFixed(0)} ms sampled over ${N} frames (${(total / N).toFixed(1)} ms/frame); material.version bumps ${s1[0] - s0[0]}, visible meshes ${s0[1]} -> ${s1[1]}, programs ${s0[2]} -> ${s1[2]}`);
        for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) log(`  ${(v / N).toFixed(2).padStart(7)} ms/frame ${((100 * v) / total).toFixed(0).padStart(3)}%  ${k}`);
        out.push({ house, label, msPerFrame: total / N, bumps: s1[0] - s0[0], top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => [k, v / N]) });
      };
      await prof('own-loop', async () => { await o.page.evaluate((n: number) => (window as any).__bench.rafRun(n), N); await o.page.evaluate(() => (window as any).__bench.end()); await o.page.evaluate(() => (window as any).__bench.restoreView()); });
      const cx = W / 2, cy = H * 0.45;
      await prof('player-drag', async () => {
        await o.page.mouse.move(cx, cy);
        await o.page.evaluate(() => (window as any).__bench.begin());
        await o.page.mouse.down();
        await o.page.evaluate(([x, y]: number[]) => (window as any).__bench.startDrag(x, y, 2, 0), [cx, cy]);
        await o.page.waitForFunction((n: number) => (window as any).__bench.drag && (window as any).__bench.drag.n >= n, N, { timeout: 120000, polling: 50 });
        await o.page.evaluate(() => (window as any).__bench.stopDrag());
        await o.page.mouse.up();
        await o.page.evaluate(() => (window as any).__bench.end());
        await o.page.evaluate(() => (window as any).__bench.restoreView());
      });
    } catch (e: any) { log(`${house}: FAILED ${String(e.message).split('\n')[0]}`); } finally { await o.close(); }
  }
}

// ------------------------------------------------------------------------------------------ mode: census
// What is in the scene the player renders (deterministic, no timing): lights by kind, shadow casters, meshes, materials,
// transmissive / transparent ones, the renderer's context attributes and shadow settings. One row per --houses x --defaults.
async function census() {
  log(`# perf-player census  ${new Date().toISOString()}\n# uptime ${execSync('uptime').toString().trim()}`);
  log(['house', 'dflt', 'lights', 'visible', 'spot', 'point', 'dir', 'other', 'casters', 'sunMap', 'shadowType', 'meshes', 'visMeshes', 'materials', 'glassMeshes', 'transpMeshes', 'castMeshes', 'antialias', 'pdb', 'canvasPx'].join('\t'));
  for (const house of HOUSES) for (const d of DEFAULTS) {
    const o = await openPlayer(house, { defaults: d, dpr: 2, shot: 'orbit' });
    try {
      await o.page.evaluate(() => (window as any).__bench.install());
      const c = await o.page.evaluate(() => {
        const B = (window as any).__bench, sc = B.scene, r = B.r;
        const L: any[] = [], M: any[] = []; sc.traverse((x: any) => { if (x.isLight) L.push(x); if (x.isMesh) M.push(x); });
        const mats = new Set<any>(); for (const m of M) for (const x of (Array.isArray(m.material) ? m.material : [m.material])) mats.add(x);
        const sun = L.find(l => l.isDirectionalLight && l.castShadow);
        const ca = B.gl.getContextAttributes();
        return { lights: L.length, visible: L.filter(l => l.visible).length, spot: L.filter(l => l.isSpotLight).length, point: L.filter(l => l.isPointLight).length, dir: L.filter(l => l.isDirectionalLight).length, other: L.filter(l => !l.isSpotLight && !l.isPointLight && !l.isDirectionalLight).length, casters: L.filter(l => l.castShadow).length, sunMap: sun ? sun.shadow.mapSize.x : 0, shadowType: r.shadowMap.type, meshes: M.length, visMeshes: M.filter(m => m.visible).length, materials: mats.size, glass: M.filter(m => (Array.isArray(m.material) ? m.material : [m.material]).some((x: any) => x && x.transmission > 0)).length, transp: M.filter(m => (Array.isArray(m.material) ? m.material : [m.material]).some((x: any) => x && x.transparent && !(x.transmission > 0))).length, cast: M.filter(m => m.castShadow).length, aa: ca.antialias, pdb: ca.preserveDrawingBuffer, cw: r.domElement.width + 'x' + r.domElement.height };
      });
      out.push({ house, defaults: d, ...c });
      log([house, d, c.lights, c.visible, c.spot, c.point, c.dir, c.other, c.casters, c.sunMap, c.shadowType, c.meshes, c.visMeshes, c.materials, c.glass, c.transp, c.cast, c.aa, c.pdb, c.cw].join('\t'));
    } catch (e: any) { log(`${house} d${d}: FAILED ${String(e.message).split('\n')[0]}`); } finally { await o.close(); }
  }
}

// --out: the header line puts the load beside every timing, the rows are what the mode printed
function writeMarkdown(file: string) {
  const sh = (c: string) => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return '?'; } };
  const commit = `${sh('git rev-parse --short HEAD')}${sh('git status --porcelain') ? ' (dirty)' : ''}`;
  const head = `${new Date().toISOString()} | commit ${commit} | uptime ${sh('uptime')} | dpr ${DPRS.join(',')} | throttle ${THROTTLES.join(',')} | mode ${MODE} | houses ${HOUSES.join(',')} | defaults ${DEFAULTS.join(',')} | runs ${RUNS} | query ${QUERY || '-'}`;
  const md: string[] = [`# perf-player ${MODE}`, '', head, ''];
  if (tsv.length) {
    const n = Math.max(...tsv.map(r => r.length)), cell = (r: string[], i: number) => (r[i] ?? '').replace(/\|/g, '/');
    const row = (r: string[]) => `| ${Array.from({ length: n }, (_, i) => cell(r, i)).join(' | ')} |`;
    md.push(row(tsv[0]), `|${' --- |'.repeat(n)}`, ...tsv.slice(1).map(row), '');
  }
  if (plain.length) md.push('```', ...plain, '```', '');
  fs.writeFileSync(path.resolve(file), md.join('\n'));
}

try {
  if (MODE === 'bench') await bench(); else if (MODE === 'attr') await attr(); else if (MODE === 'load') await loadMode(); else if (MODE === 'raf') await rafMode(); else if (MODE === 'profile') await profileMode(); else if (MODE === 'census') await census(); else throw new Error(`--mode ${MODE}`);
} finally {
  if (args.out && args.out !== 'true') writeMarkdown(args.out);
  if (args.json) fs.writeFileSync(path.resolve(args.json), JSON.stringify({ when: new Date().toISOString(), uptime: execSync('uptime').toString().trim(), args, rows: out }, null, 1));
  await browser.close(); await srv.close();
}
