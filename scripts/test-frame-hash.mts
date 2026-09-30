#!/usr/bin/env -S node --experimental-strip-types
// Determinism test for the house renderer: the same frames rendered in two fresh browser contexts must agree.
// @check-house skip — check-house runs it as its determinism steps
// Every re-lay and every rendering change is measured against goldens, and goldens are only meaningful if two
// runs of the same tree agree — so this runs first. Raw RGBA is read back from the canvas (no JPEG in the loop);
// a frame passes when no pixel differs by more than --tol (8/255) and fewer than --ratio (0.01 %) differ at
// all — GPU rasterisation is allowed a few one-level wobbles, content is not.
//   pnpm run frame-hash [--house aurora] [--shot door-to-core] [--frames 0,330,719]
//        [--res 720] [--tol 8] [--ratio 0.0001] [--profile auto] [--cold] [--planner v2]
//   (node --experimental-strip-types scripts/test-frame-hash.mts — any cwd)
// Exit 0 when every frame agrees, 1 otherwise.
//
// --profile picks the renderer, sharing test-goldens.mts's table: determinism has to be measured on the
// stack that will produce the baselines. This script used to hard-code ANGLE Metal, which would have
// certified a renderer the golden gate never used on any machine that was not a Mac.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import crypto from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const HOUSE = args.house || 'aurora', SHOT = args.shot || 'door-to-core', RES = args.res || '720';
// --planner v2 forces spline planner v2 (S5) on the page, so the determinism of its frames is proved as v1's are
const PLANNER = args.planner && args.planner !== 'true' ? `&planner=${encodeURIComponent(args.planner)}` : '';
const FRAMES = (args.frames || '0,330,719').split(',').map(Number);
const TOL = Number(args.tol || 8), RATIO = Number(args.ratio || 0.0001);
// Same table as scripts/test-goldens.mts — keep them in step.
const PROFILES = {
  'macos-metal': { platform: 'darwin', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  'linux-swiftshader': { platform: 'linux', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--no-sandbox', '--hide-scrollbars'] },
};
const PROFILE = args.profile && args.profile !== 'auto' ? args.profile
  : process.env.HOUSE_GOLDEN_PROFILE
  || Object.keys(PROFILES).find(k => PROFILES[k].platform === process.platform)
  || `${process.platform}-unknown`;
if (!PROFILES[PROFILE]) { console.error(`unknown profile "${PROFILE}" (${Object.keys(PROFILES).join(', ')})`); process.exit(2); }
const ROOT = path.resolve(import.meta.dirname, '..');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { pathToFileURL } = await import('node:url'); const os = await import('node:os');
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
  candidates.sort((a, b) => { const v = p => { try { return JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version; } catch { return '0'; } }; return v(b).localeCompare(v(a), undefined, { numeric: true }); });
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable'); process.exit(2);
}
// Same font handling as test-goldens.mts, and for the same reason: room-creator.html pulls its faces off
// fonts.googleapis.com with display=swap and the Core's screen is a canvas texture that draws text in them,
// so two runs that raced the network differently are two different pictures — which is precisely what this
// script exists to rule out. Serve the repo's own woff2 and wait for them.
const FONT_FILES = { 'manrope': 'manrope-latin-var.woff2', 'jetbrains-mono': 'jetbrains-mono-latin-var.woff2' };
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const fontCss = p => `
@font-face{font-family:'Manrope';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Plus Jakarta Sans';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'JetBrains Mono';src:url('http://127.0.0.1:${p}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const font = url.startsWith('/__fonts/') && FONT_FILES[url.slice('/__fonts/'.length)];
  const f = font ? path.join(FONT_DIR, font) : path.join(ROOT, url);
  // same containment check as test-goldens.mts's server — without it a `..`-containing request path can
  // escape ROOT and serve an arbitrary file from the host filesystem
  if ((!font && !f.startsWith(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  // the stylesheet is fulfilled at Google's origin, so the font fetch is cross-origin and needs CORS
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>(resolve => server.listen(0, () => resolve()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILES[PROFILE].args });

async function run() {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss(port) }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://localhost:${port}/room-creator.html?house=${HOUSE}&shot=${SHOT}${PLANNER}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, HOUSE);
  const missing = await page.evaluate(async () => {
    const want = ['Manrope', 'Plus Jakarta Sans', 'JetBrains Mono'];
    await Promise.all(want.map(f => document.fonts.load(`16px "${f}"`).catch(() => {})));
    await document.fonts.ready;
    return want.filter(f => !document.fonts.check(`16px "${f}"`));
  });
  if (missing.length) throw new Error(`fonts never loaded: ${missing.join(', ')}`);
  // The composer's SMAA lookups decode asynchronously; without this the first frame of a run is a different
  // picture from the same frame in the other run, and the two runs disagree for a reason that is not the tree.
  await page.evaluate(r => window.__houseComposerWarm({ res: r }), RES);
  const frames = await page.evaluate(([shot, res, frames]) => {
    const r = __houseRenderBegin({ shot, res, fps: 60 }); const gl = __houseDebug().renderer.getContext();
    const out = frames.map(i => { __houseRenderFrames(Math.min(i, r.frames - 1), 1, 1.0); const px = new Uint8Array(r.w * r.h * 4); gl.readPixels(0, 0, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = ''; for (let k = 0; k < px.length; k += 8192) s += String.fromCharCode.apply(null, px.subarray(k, k + 8192)); return btoa(s); });
    __houseRenderEnd(); return { w: r.w, h: r.h, out };
  }, [SHOT, RES, FRAMES]);
  await ctx.close();
  return { w: frames.w, h: frames.h, px: frames.out.map(b64 => Buffer.from(b64, 'base64')) };
}
// A cold browser renders its FIRST context a hair differently from every later one: measured on macos-metal
// (aurora, door-to-core), run 1 ≠ run 2 = run 3 bit for bit, the difference lives only at SMAA edge decisions
// fed by GTAO (disable SMAA and runs 1 and 2 are identical; the SMAA lookups decode identically), and the
// untouched baseline already failed frame 480 this way. That is the GPU process warming up, not the tree
// disagreeing with itself, so one throwaway context is rendered before the compared pair. --cold skips it.
if (args.cold !== 'true') await run();
const a = await run(), b = await run();
await browser.close(); server.close();
let ok = true;
FRAMES.forEach((f, i) => {
  const A = a.px[i], B = b.px[i]; let maxd = 0, n = 0;
  for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d) { n++; if (d > maxd) maxd = d; } }
  const ratio = n / (A.length / 4), pass = maxd <= TOL && ratio <= RATIO; if (!pass) ok = false;
  const hash = crypto.createHash('sha256').update(A).digest('hex').slice(0, 12);
  console.log(`${pass ? '✓' : '✗'} ${HOUSE}/${SHOT}${PLANNER ? ` (planner ${args.planner})` : ''} frame ${f}  ${hash}  ${n === 0 ? 'identical' : `${n} px differ (max Δ${maxd}, ${(ratio * 100).toFixed(4)} %)`}`);
});
console.log(ok ? `deterministic (${PROFILE})` : `NOT deterministic (${PROFILE})`);
process.exit(ok ? 0 : 1);
