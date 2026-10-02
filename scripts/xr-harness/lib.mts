// The XR test harness: serve a built tree, drive ONE Chromium at a time with Meta's IWER (Immersive Web Emulation Runtime)
// installed before the page's scripts, open the live player in a headset profile, enter and end a session, tick frames, snapshot
// and compare the renderer, check blink comfort, and record every request. scripts/test-xr.mts runs the cases; scripts/xr-tests/*.mts
// are the cases. See reference/XR-DEVICE-CHECKLIST.md for what an emulation cannot prove (frame time, legibility, comfort, thermals).
//
// WHAT IS REAL AND WHAT IS NOT. Real: the browser, WebGL, three.js r169's WebXRManager, the page's code, the request stream.
// Emulated (IWER): navigator.xr, the XRSession/XRFrame/XRView objects, the headset and controller poses, input events. Not
// exercised: XRWebGLBinding (IWER does not provide it, so the layers path Quest and Chrome >= 147 take is never run), dom-overlay
// (so immersive-ar is untestable), real compositor timing, foveation, MSAA resolve. IWER quirks worked around here: `select` fires
// before `selectstart`; frames keep arriving while the session is `hidden`; it overrides navigator.userAgent.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, ROOT, parseArgs } from '../portal-lib.mts';

export { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, ROOT, parseArgs };
export const HERE = import.meta.dirname;
export const SUBPATH = '/ci-virtual-home/';              // dist is served under a sub-path, as portal:test does, so a root-relative XR URL fails here too
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type Device = 'quest3' | 'quest2' | 'vision' | 'none';
export const DEVICES: Device[] = ['quest3', 'quest2', 'vision'];

/** A failed expectation (as opposed to a crash or a timeout, which the runner retries once). */
export class Fail extends Error { constructor(msg: string) { super(msg); this.name = 'Fail'; } }
/** A case that cannot run on this tree/device and says why (counted, printed, never silently passed). */
export class Skip extends Error { constructor(msg: string) { super(msg); this.name = 'Skip'; } }

// ------------------------------------------------------------------------------------------------------------ IWER and devices
const IWER_PATH = path.join(ROOT, 'node_modules', 'iwer', 'build', 'iwer.min.js');
let iwerJs: string | null = null;
export function iwerSource(): string {
  if (!iwerJs) {
    if (!fs.existsSync(IWER_PATH)) throw new Error('iwer is not installed: pnpm install (it is a pinned devDependency, test only)');
    iwerJs = fs.readFileSync(IWER_PATH, 'utf8');
  }
  return iwerJs;
}
export function iwerVersion(): string { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'iwer', 'package.json'), 'utf8')).version; }
const read = (f: string) => fs.readFileSync(path.join(HERE, f), 'utf8');
export const PROBE_JS = () => read('probe.js');
export const BED_JS = () => read('xrbed.js');

/** The init script that installs the device's runtime. quest3 / quest2 are IWER's own profiles; vision is patched (vision.js). */
export function deviceInit(device: Device): string {
  if (device === 'none') return '';
  if (device === 'vision') return read('vision.js');
  const profile = device === 'quest3' ? 'metaQuest3' : 'metaQuest2';
  return `(() => { const I = window.IWER; const d = new I.XRDevice(I.${profile}, { stereoEnabled: true }); d.installRuntime({ forceInstall: true }); window.__xrdev = d; window.__xrdevice = ${JSON.stringify(device)}; })();`;
}

// ------------------------------------------------------------------------------------------------------------ trees and servers
export type Tree = { dir: string; base: string; srv: Awaited<ReturnType<typeof serve>>; hasXr: boolean; name: 'dist' | 'root' };

/** Does this built tree contain the XR modules at all? (decides whether a case that needs the product's session can run) */
export function treeHasXr(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'assets', 'xr', 'entry.js')) && fs.existsSync(path.join(dir, 'assets', 'xr', 'session.js'));
}

// ------------------------------------------------------------------------------------------------------------ pages
export type Req = { url: string; type: string; at: number; i: number };
export interface P {
  ctx: any; page: any; tree: Tree; device: Device; url: string;
  errors: string[]; warnings: string[]; requests: Req[];
  /** a negative control caused errors on purpose: remove the ones matching `re` from `errors` and return them, so the case can assert they happened */
  expect(re: RegExp): string[];
  mark(): number;                                         // an index into `requests`
  since(mark: number): Req[];
  close(): Promise<void>;
}

export interface OpenOpts {
  tree: Tree; device?: Device; house?: string; query?: string; viewport?: { width: number; height: number }; dpr?: number;
  kind?: 'player' | 'editor' | 'gallery'; init?: string; wait?: boolean; touch?: boolean;
}

export function playerUrl(tree: Tree, house: string, query = ''): string {
  // the defaults are the opening view, paused; a case's own query (shot=, t=, no=, xrtier=, …) overrides them rather than repeating them
  const q = new URLSearchParams({ mode: 'view', house, shot: 'orbit', play: '0' });
  for (const [k, v] of new URLSearchParams(query)) q.set(k, v);
  return `${tree.srv.url('room-creator.html')}?${q.toString().replace(/%2C/g, ',')}`;
}

export async function openPage(browser: any, o: OpenOpts): Promise<P> {
  const { tree, device = 'quest3', house = 'cutestarter', query = '', viewport = { width: 1280, height: 720 }, dpr = 1, kind = 'player', init = '', wait = true } = o;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: !!o.touch });
  const page = await ctx.newPage();
  const errors: string[] = [], warnings: string[] = [], requests: Req[] = [];
  const t0 = Date.now();
  page.on('pageerror', (e: Error) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m: any) => { const t = m.text(); if (m.type() === 'error') errors.push(`console.error: ${t.slice(0, 240)}`); else if (m.type() === 'warning') warnings.push(t.slice(0, 240)); });
  page.on('request', (r: any) => requests.push({ url: r.url(), type: r.resourceType(), at: Date.now() - t0, i: requests.length }));
  // Nothing may reach the real network: a request to any other origin is recorded (above) and then refused. The fonts stub (a page
  // route, which wins over this context route) answers Google Fonts the way every capture does, with the repo's own woff2.
  await ctx.route((u: URL) => /^https?:$/.test(u.protocol) && u.origin !== tree.srv.origin, (r: any) => r.abort('blockedbyclient'));
  await page.addInitScript(iwerSource());
  const dev = deviceInit(device);
  if (dev) await page.addInitScript(dev);
  await page.addInitScript(PROBE_JS());
  if (init) await page.addInitScript(init);
  await stubGoogleFonts(page, tree.srv.origin);
  const url = kind === 'gallery' ? tree.srv.url('index.html') + (query ? '?' + query : '')
    : kind === 'editor' ? `${tree.srv.url('room-creator.html')}?house=${house}&shot=door-to-core&res=360${query ? '&' + query : ''}`
      : playerUrl(tree, house, query);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 });
  if (wait) {
    if (kind === 'player') await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000, polling: 100 });
    else if (kind === 'editor') await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000, polling: 100 });
    else await page.waitForLoadState('load', { timeout: 60000 });
  }
  const p: P = {
    ctx, page, tree, device, url, errors, warnings, requests,
    expect(re) { const hit = errors.filter(e => re.test(e)); for (const e of hit) errors.splice(errors.indexOf(e), 1); return hit; },
    mark: () => requests.length,
    since: (m) => requests.slice(m),
    close: async () => { await ctx.close().catch(() => {}); },
  };
  return p;
}

// ------------------------------------------------------------------------------------------------------------ requests
const pathOf = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
const underBase = (tree: Tree, u: string) => { const p = pathOf(u); return p.startsWith(tree.base) ? p.slice(tree.base.length) : p.replace(/^\//, ''); };

/** Requests to anything but the page's own origin (data: and blob: are not requests to anyone). */
export function foreign(requests: Req[], origin: string): Req[] {
  return requests.filter(r => /^https?:/i.test(r.url) && !r.url.startsWith(origin));
}
export const xrRequests = (tree: Tree, requests: Req[]) => requests.filter(r => /^assets\/xr\//.test(underBase(tree, r.url)));
export const rel = underBase;

/** gzip size of a served file, level 9, from the served tree (the harness serves static files, so this is what a CDN would compress). */
export function gzipOf(tree: Tree, relPath: string): number {
  const f = path.join(tree.dir, relPath.split('?')[0]);
  try { return fs.statSync(f).isFile() ? zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length : 0; } catch { return 0; }
}
export function brotliOf(tree: Tree, relPath: string): number {
  const f = path.join(tree.dir, relPath.split('?')[0]);
  try { return fs.statSync(f).isFile() ? zlib.brotliCompressSync(fs.readFileSync(f), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length : 0; } catch { return 0; }
}
/** Sum of gzip sizes of the first-load text assets (js, css, html, json) among these requests, deduplicated by path. */
export function textWeight(tree: Tree, requests: Req[]): { total: number; brotli: number; files: Record<string, number> } {
  const files: Record<string, number> = {}; let brotli = 0;
  for (const r of requests) {
    const p = underBase(tree, r.url).split('?')[0];
    if (!/\.(js|mjs|css|html|json)$/.test(p) && p !== '') continue;
    if (!(p in files)) { files[p || 'index.html'] = gzipOf(tree, p || 'index.html'); brotli += brotliOf(tree, p || 'index.html'); }
  }
  return { total: Object.values(files).reduce((a, b) => a + b, 0), brotli, files };
}

// ------------------------------------------------------------------------------------------------------------ sessions
export type Driver = 'auto' | 'session' | 'bed';
export interface Entered { driver: 'session' | 'bed'; tier?: any; mode: string }

/** True when the page carries the product's own XR session API. (xr-session mounts it lazily after the player is ready.) */
export async function hasProductXr(p: P, waitMs = 0): Promise<boolean> {
  const probe = () => p.page.evaluate(() => !!((window as any).__houseViewer && (window as any).__houseViewer.xr));
  const until = Date.now() + waitMs;
  for (;;) { if (await probe()) return true; if (Date.now() >= until) return false; await sleep(100); }
}

const ENTER_SELECTORS = ['[data-xr-enter]', 'button[aria-label*="Enter VR" i]', 'button:has-text("Enter VR")', '[role=button]:has-text("Enter VR")'];
export async function findEnterButton(p: P): Promise<any | null> {
  for (const s of ENTER_SELECTORS) { const l = p.page.locator(s).filter({ visible: true }).first(); if (await l.count().catch(() => 0)) return l; }
  return null;
}

/**
 * Start an immersive-vr session. With the product's XR module present this is what a person does: click Enter VR (a real
 * user gesture), then wait for the module to report `running`. With no XR module in the tree (or driver 'bed'), the in-page bed
 * (xrbed.js) starts the session instead and the case result says so. `viaButton:false` calls xr.enter('vr') directly.
 */
export async function enterSession(p: P, o: { driver?: Driver; viaButton?: boolean; timeoutMs?: number; bed?: any } = {}): Promise<Entered> {
  const { driver = 'auto', viaButton = true, timeoutMs = 120000 } = o;
  const product = driver !== 'bed' && p.tree.hasXr && await hasProductXr(p, 15000);
  if (driver === 'session' && !product) throw new Fail('driver "session" asked for, but the page has no window.__houseViewer.xr (is this tree built from a branch with assets/xr/ and was ?no=xr passed?)');
  if (product) {
    const btn = viaButton ? await findEnterButton(p) : null;
    if (btn) await btn.click({ timeout: 20000 });
    else await p.page.evaluate(() => (window as any).__houseViewer.xr.enter('vr'));
    try { await p.page.waitForFunction(() => { const x = (window as any).__houseViewer.xr; return x.state === 'running' || x.state === 'idle' && (window as any).__xrh.ended > 0; }, null, { timeout: timeoutMs, polling: 100 }); }
    catch { throw new Fail(`the XR session never reached "running" within ${timeoutMs} ms (state: ${await p.page.evaluate(() => (window as any).__houseViewer.xr.state)})`); }
    const st = await p.page.evaluate(() => { const x = (window as any).__houseViewer.xr; return { state: x.state, tier: x.tier, mode: x.mode }; });
    if (st.state !== 'running') throw new Fail('the XR session started and ended at once');
    return { driver: 'session', tier: st.tier, mode: st.mode || 'vr' };
  }
  await p.page.evaluate(BED_JS());
  const r = await p.page.evaluate(async (opts: any) => { await (window as any).__bed.start(opts || {}); return true; }, o.bed || {});
  void r;
  return { driver: 'bed', mode: 'vr' };
}

export async function endSession(p: P, e: Entered, why = 'test'): Promise<void> {
  if (e.driver === 'session') await p.page.evaluate(async (w: string) => { await (window as any).__houseViewer.xr.end(w); }, why);
  else await p.page.evaluate(async () => (window as any).__bed.stop());
  await p.page.waitForFunction(() => !(window as any).__houseDebug().renderer.xr.isPresenting, null, { timeout: 30000, polling: 50 });
}

/** Wait for n more XR frames to be delivered to the page (counted by probe.js on the session's requestAnimationFrame). Never polls on rAF: a headset page's rAF is paused. */
export async function tickFrames(p: P, n: number, timeoutMs = 60000): Promise<number> {
  const start = await p.page.evaluate(() => (window as any).__xrh.frames);
  try { await p.page.waitForFunction((t: number) => (window as any).__xrh.frames >= t, start + n, { timeout: timeoutMs, polling: 20 }); }
  catch { throw new Fail(`only ${(await p.page.evaluate(() => (window as any).__xrh.frames)) - start} of ${n} XR frames arrived in ${timeoutMs} ms`); }
  return start + n;
}

export async function xrFrames(p: P): Promise<number> { return p.page.evaluate(() => (window as any).__xrh.frames); }

/** Per-eye state of the current XR camera: viewport, world position, fov, and the eye-to-eye distance in metres. */
export async function eyes(p: P): Promise<{ n: number; vp: number[][]; pos: number[][]; fovy: number[]; ipd: number; canvas: [number, number] }> {
  return p.page.evaluate(() => {
    const r = (window as any).__houseDebug().renderer; const cams = r.xr.getCamera().cameras;
    const pos = cams.map((c: any) => c.matrixWorld.elements.slice(12, 15));
    const d = pos.length > 1 ? Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1], pos[0][2] - pos[1][2]) : 0;
    return { n: cams.length, vp: cams.map((c: any) => c.viewport.toArray()), pos, fovy: cams.map((c: any) => 2 * Math.atan(1 / c.projectionMatrix.elements[5]) * 180 / Math.PI), ipd: d, canvas: [r.domElement.width, r.domElement.height] as [number, number] };
  });
}

// ------------------------------------------------------------------------------------------------------------ snapshot / equal
/**
 * Everything the T-X6a restore test compares. Taken by rendering ONE mono frame and reading the default framebuffer back in the
 * same task (the drawing buffer is not preserved), so `calls`, `tris` and `hash` describe the same frame. Runs in the page.
 */
export function snapshotFn() {
  const { renderer, scene, camera } = (window as any).__houseDebug(); const gl = renderer.getContext(); const cv = renderer.domElement;
  renderer.info.autoReset = true; renderer.info.reset(); renderer.render(scene, camera);
  const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
  const w = cv.width, h = cv.height; const buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let hash = 2166136261; for (let i = 0; i < buf.length; i += 7) { hash ^= buf[i]; hash = Math.imul(hash, 16777619) >>> 0; }
  const r5 = (x: number) => +x.toFixed(5);
  return {
    render: { calls, tris, hash, w, h },
    camera: { fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, aspect: r5(camera.aspect), view: camera.view ? JSON.stringify(camera.view) : null, proj: camera.projectionMatrix.elements.map(r5), parent: camera.parent && camera.parent.type, parentName: camera.parent && camera.parent.name, pos: camera.position.toArray().map(r5), quat: camera.quaternion.toArray().map(r5), layers: camera.layers.mask },
    renderer: {
      pr: renderer.getPixelRatio(), size: renderer.getSize(new (window as any).__THREE.Vector2()).toArray(), css: [cv.clientWidth, cv.clientHeight], tone: renderer.toneMapping, exposure: renderer.toneMappingExposure,
      shadowEnabled: renderer.shadowMap.enabled, shadowAuto: renderer.shadowMap.autoUpdate, shadowType: renderer.shadowMap.type, xrEnabled: renderer.xr.enabled, presenting: renderer.xr.isPresenting,
      localClip: renderer.localClippingEnabled, sort: renderer.sortObjects, outputColorSpace: renderer.outputColorSpace, autoClear: renderer.autoClear,
      fixedFoveation: renderer.xr.getFoveation ? renderer.xr.getFoveation() ?? null : null, framebufferScale: null,
      canvasStyle: cv.getAttribute('style'), canvasParent: cv.parentElement && (cv.parentElement.className + '|' + cv.parentElement.id),
    },
    scene: { kids: scene.children.length },
    memory: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
  };
}
export type Snapshot = ReturnType<typeof snapshotFn>;
export const snapshot = (p: P): Promise<Snapshot> => p.page.evaluate(snapshotFn);

export interface Diff { group: string; key: string; before: any; after: any; kind: 'changed' | 'leak' | 'shrunk' }
/** Field-by-field comparison. Memory counts may shrink (a disposed panel) but never grow (a leak); everything else must be equal. */
export function equal(a: Snapshot, b: Snapshot): Diff[] {
  const out: Diff[] = [];
  for (const g of Object.keys(a) as (keyof Snapshot)[]) {
    for (const k of Object.keys((a as any)[g])) {
      const x = (a as any)[g][k], y = (b as any)[g][k];
      if (JSON.stringify(x) === JSON.stringify(y)) continue;
      if (g === 'memory') out.push({ group: g, key: k, before: x, after: y, kind: y > x ? 'leak' : 'shrunk' });
      else out.push({ group: g, key: k, before: x, after: y, kind: 'changed' });
    }
  }
  return out;
}
export const fmtDiff = (d: Diff[]) => d.map(x => `${x.group}.${x.key}: ${JSON.stringify(x.before)} -> ${JSON.stringify(x.after)}${x.kind === 'leak' ? ' (leak)' : ''}`).join('; ');

/** Snapshot until two in a row agree (the page's own adaptive controller may still be settling), or throw Fail. */
export async function settledSnapshot(p: P, tries = 6, gapMs = 600): Promise<Snapshot> {
  let prev = await snapshot(p);
  for (let i = 0; i < tries; i++) {
    await sleep(gapMs);
    const cur = await snapshot(p);
    if (equal(prev, cur).filter(d => d.kind !== 'shrunk').length === 0) return cur;
    prev = cur;
  }
  throw new Fail('the page never settled: two snapshots of an idle player still differ, so a restore comparison would mean nothing' + ' (' + fmtDiff(equal(prev, await snapshot(p))) + ')');
}

// ------------------------------------------------------------------------------------------------------------ blink comfort
export function startComfort(p: P): Promise<void> { return p.page.evaluate(() => { (window as any).__xrh.comfort = { on: true, log: [] }; }); }
export interface ComfortReport { frames: number; moves: number; movesWhileVisible: number; worst: number; noFade: number }
/**
 * The invariant: the head's WORLD position changes only on frames where the fade alpha is 1. A step above maxStepM between two
 * sampled frames counts as a move; a move on a frame whose alpha is below 0.995 (or where no fade exists at all) is a violation.
 * The 3 mm default is above the emulated head's idle jitter (zero) and far below a teleport (metres) or a smooth walk (cm a frame).
 */
export async function comfortReport(p: P, maxStepM = 0.003): Promise<ComfortReport> {
  return p.page.evaluate((m: number) => {
    const log = ((window as any).__xrh.comfort || { log: [] }).log as { f: number; a: number | null; p: number[] }[];
    let moves = 0, bad = 0, worst = 0, noFade = 0;
    for (let i = 1; i < log.length; i++) {
      const a = log[i - 1], b = log[i]; const d = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
      if (d <= m) continue; moves++;
      if (b.a === null) { noFade++; bad++; worst = Math.max(worst, d); } else if (b.a < 0.995) { bad++; worst = Math.max(worst, d); }
    }
    return { frames: log.length, moves, movesWhileVisible: bad, worst, noFade };
  }, maxStepM);
}
export const stopComfort = (p: P) => p.page.evaluate(() => { (window as any).__xrh.comfort = null; });

// ------------------------------------------------------------------------------------------------------------ misc
export const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');

/** Poll a page expression until it is truthy (never on rAF). */
export async function until(p: P, fn: () => any, what: string, timeoutMs = 20000, arg?: any): Promise<void> {
  try { await p.page.waitForFunction(fn, arg, { timeout: timeoutMs, polling: 25 }); } catch { throw new Fail(`timed out after ${timeoutMs} ms waiting for ${what}`); }
}

// ------------------------------------------------------------------------------------------------------------ case API (what scripts/xr-tests/*.mts export; the runner is scripts/test-xr.mts)
export interface Ctx {
  device: Device; house: string; driver: Driver; args: Record<string, string>; shots: string;
  /** a built tree served by the runner: 'dist' (portal:build, under /ci-virtual-home/) or 'root' (the repo, as the goldens serve it) */
  tree(name: 'dist' | 'root'): Promise<Tree>;
  /** open a page (one Chromium, a fresh context); it is closed after the case and its errors judged */
  open(o: Omit<OpenOpts, 'tree'> & { tree?: Tree; treeName?: 'dist' | 'root' }): Promise<P>;
  check(cond: any, msg: string): void;                                   // a failed expectation (Fail), after recording it was checked
  note(key: string, value: any): void;                                   // a measurement printed with the result
  skip(reason: string): never;
  /** a negative control caused errors on purpose: ignore page errors matching this when the case ends (everything else still fails it) */
  forgive(re: RegExp): void;
  needsProduct(tree: Tree): void;                                        // skip (or fail, per --require-session) when the tree has no XR modules
  screenshot(p: P, name: string): Promise<string>;
  /** a served copy of dist/ with a FAKE product XR module added (fake-xr.mts), for validating the checks themselves */
  fake(o?: { eager?: boolean; heavy?: boolean; cdn?: boolean }): Promise<Tree>;
}
/** `timeoutMs`: a case that loads the player many times (the lazy-loading checks do ~16 loads) says so, instead of the whole run's limit growing for everyone */
export interface Case { id: string; title: string; devices?: Device[]; timeoutMs?: number; run(t: Ctx): Promise<void> }
export const defineCase = (c: Case): Case => c;
export const isCase = (v: any): v is Case => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.run === 'function';

