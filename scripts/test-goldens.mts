#!/usr/bin/env -S node --experimental-strip-types
// Golden-image gate for the HouseSpec product shots (review item 4).
//
//   pnpm run goldens [--house aurora,mirage] [--shot door-to-core,orbit,hero-reveal]
//        [--profile auto] [--update] [--jobs 3] [--timeout 60000]
//        [--threshold 0.1] [--ratio 0.001] [--mae 0.01] [--out <root>/test/diff]
//
// For every house × shot it renders a small, fixed set of frames through the SAME path the video uses —
// __houseRenderBegin / __houseRenderFrames / __houseRenderEnd, so the composer, GTAO, SMAA, 2× supersampling
// and tone mapping are all in play — reads the raw RGBA back off the GL context (no JPEG in the loop) and
// compares it to a committed baseline with pixelmatch.
//
// Why it is worth having: a re-lay of 30 houses, or a one-line change to a material, currently only fails if
// the shot QA's camera path happens to notice. Nothing catches "the lawn went grey" or "the roof stopped
// casting". scripts/test-frame-hash.mts proves two runs of the SAME tree agree; this proves this tree still
// agrees with the tree we blessed. Run the hash test first — a baseline against a non-deterministic renderer
// is worthless.
//
// FRAMES picks four frames a house: the poster of each shot, plus the last frame of the two shots that end
// framed on the Core. 120 baselines at 640 × 360 is ~11 MB, which is what makes committing them reasonable.
//
// This runs on a developer's machine, not in CI. 120 frames through a software rasteriser cost an hour of
// GitHub Actions per push, which is not what that budget is for; `pnpm run check` (scripts/check-house.mts)
// runs it, and the four checks around it, in a couple of minutes on a GPU.
//
// Baselines are per renderer profile, because a GPU is part of the render: test/goldens/<profile>/.
// A profile with no baselines at all exits 3 ("nothing to compare against") rather than reporting 120
// regressions — that is the signal to bless a set for this machine on purpose, with --update.
//
// Exit codes:  0 pass · 1 one or more frames differ, or one has no baseline · 2 a frame failed to render
//               3 the profile has no baselines at all
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import pixelmatch from './vendor/pixelmatch.mjs';
import { encodePNG, decodePNG } from './vendor/png.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return a;
}, []));

// Resolved from this file, not the cwd: a gate that guessed its tree from where it was launched resolved
// nothing when launched from anywhere else, and every frame "errored".
const ROOT = path.resolve(import.meta.dirname, '..');
if (!fs.existsSync(path.join(ROOT, 'room-creator.html'))) { console.error(`no room-creator.html in ${ROOT}`); process.exit(2); }
const RES = args.res || '360';
const FPS = 60;
const JOBS = Math.max(1, parseInt(args.jobs || '3', 10));
// Building a house takes seconds on a GPU and the better part of a minute on a CPU rasteriser under load, so
// the load budget is a flag: the default suits a GPU, and a software rasteriser wants several times more.
const LOAD_MS = Math.max(10000, parseInt(args.timeout || '60000', 10));
const UPDATE = args.update === 'true';
const THRESHOLD = Number(args.threshold ?? 0.1);     // pixelmatch per-pixel YIQ threshold — three.js's value
const RATIO = Number(args.ratio ?? 0.001);           // ≤ 0.1 % of pixels may differ — three.js's value
// pixelmatch answers "did anything MOVE". Its threshold is a perceptual distance applied per pixel, so a
// shift smaller than that distance is invisible to it — everywhere at once. Measured: raising one preset's
// key light by 2 %, the sort of one-value drift a gate exists to catch, moved 1 pixel of 230 400 at
// threshold 0.1 and still only 43 at 0.005. No ratio can be set tight enough to catch that without catching
// noise instead.
//
// So the gate also asks "did everything move a little": the mean absolute channel difference over the whole
// frame. Measured on this pipeline at 640 × 360, over two separate browser launches:
//
//   unchanged tree      mae 0.0000   max Δ 0      (bit-exact — the renderer really is deterministic)
//   key light +2 %      mae 0.014 … 0.173   max Δ 48–50
//
// so the floor is zero and the smallest real signal is 0.014. 0.01 sits between them with room to spare —
// a few stray Δ1 pixels of GPU wobble would read about 0.00003. Raise it with --mae if a driver update ever
// makes that untrue; the two metrics are reported separately so it is obvious which one fired.
const MAE = Number(args.mae ?? 0.01);                // mean |Δ| per channel, 0–255

function meanAbsDiff(a, b) {
  let sum = 0, maxd = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); sum += d; if (d > maxd) maxd = d; }
    n += 3;
  }
  return { mae: sum / n, maxd };
}
const DIFF_OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'test', 'diff');   // beside the goldens, which .gitignore covers

// A GPU is part of the render, so a baseline belongs to the stack that produced it.
//
// linux-swiftshader is kept for a Linux machine without a usable GPU: SwiftShader ships inside the Chromium
// Playwright downloads, so the rasteriser is pinned by the Playwright version rather than by whatever mesa
// the box happens to carry. It is not the lavapipe recipe three.js publishes — that one reaches Lavapipe
// through Dawn/WebGPU and this pipeline is WebGL2 (r169 WebGLRenderer + EffectComposer + GTAO + SMAA).
// Expect it to be slow: an hour for 120 frames, against a couple of minutes on a GPU.
const PROFILES = {
  'macos-metal': { platform: 'darwin', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  'linux-swiftshader': { platform: 'linux', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--no-sandbox', '--hide-scrollbars'] },
};
const PROFILE = args.profile && args.profile !== 'auto' ? args.profile
  : process.env.HOUSE_GOLDEN_PROFILE
  || Object.keys(PROFILES).find(k => PROFILES[k].platform === process.platform)
  || `${process.platform}-unknown`;
if (!PROFILES[PROFILE]) { console.error(`unknown profile "${PROFILE}" (${Object.keys(PROFILES).join(', ')})`); process.exit(2); }
const GOLDEN_DIR = path.join(ROOT, 'test', 'goldens', PROFILE);

// t per shot. The poster frame is what ships; the last frame is the one the shot QA already judges for Core
// framing, so a regression there is worth a picture as well as an assertion.
const FRAMES = {
  'door-to-core': [0.55, 1],
  'orbit': [0.55],
  'hero-reveal': [1],
};
const SHOTS = (args.shot || Object.keys(FRAMES).join(',')).split(',').filter(Boolean);
for (const s of SHOTS) if (!FRAMES[s]) { console.error(`no golden frames defined for shot "${s}" (${Object.keys(FRAMES).join(', ')})`); process.exit(2); }

const HOUSES = (args.house || fs.readdirSync(path.join(ROOT, 'content', 'houses'))
  .filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json'))
  .map(f => f.replace(/\.json$/, '')).join(',')).split(',').filter(Boolean);

const goldenPath = (house, shot, t) => path.join(GOLDEN_DIR, house, `${shot}@${String(t).replace('.', '_')}.png`);

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { pathToFileURL } = await import('node:url'); const os = await import('node:os');
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
  candidates.sort((a, b) => { const v = p => { try { return JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version; } catch { return '0'; } }; return v(b).localeCompare(v(a), undefined, { numeric: true }); });
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable — npx playwright install chromium'); process.exit(2);
}

// room-creator.html pulls Manrope / Plus Jakarta Sans / JetBrains Mono off fonts.googleapis.com with
// display=swap, and the Companion Core's screen is a 2D-canvas texture that fillText()s in those families.
// Nothing in the page awaits document.fonts.ready, so whether a face had arrived by the captured frame is a
// race against the network — which is no basis for a baseline. The gate serves the repo's own woff2 instead
// and waits for them, so the frame is the same on a plane as it is on the desk.
const FONT_FILES = { 'manrope': 'manrope-latin-var.woff2', 'jetbrains-mono': 'jetbrains-mono-latin-var.woff2' };
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
// The stylesheet is fulfilled AT the fonts.googleapis.com origin, so a relative src would resolve against
// Google, not against us — these have to be absolute, which means built after the server has its port.
// Plus Jakarta Sans is not in assets/fonts/; it is mapped to Manrope so the family at least resolves to a
// deterministic face rather than to whatever the host machine calls a default sans.
const fontCss = port => `
@font-face{font-family:'Manrope';src:url('http://127.0.0.1:${port}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Plus Jakarta Sans';src:url('http://127.0.0.1:${port}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'JetBrains Mono';src:url('http://127.0.0.1:${port}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const font = url.startsWith('/__fonts/') && FONT_FILES[url.slice('/__fonts/'.length)];
  const f = font ? path.join(FONT_DIR, font) : path.join(ROOT, url);
  if ((!font && !f.startsWith(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(res);
});
for (const f of Object.values(FONT_FILES)) if (!fs.existsSync(path.join(FONT_DIR, f))) { console.error(`missing ${path.join(FONT_DIR, f)} — the gate serves the repo's own faces rather than Google's`); process.exit(2); }
await new Promise<void>(resolve => server.listen(0, () => resolve()));
const port = (server.address() as import('node:net').AddressInfo).port;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILES[PROFILE].args });

// A baseline belongs to a browser build as much as to a GPU: a different Chromium revision is a different
// rasteriser and a different text shaper. PROFILE.json records which one produced the set, so a mismatch
// reads as one line rather than as 120 mysterious diffs. It warns instead of failing — a newer Chromium
// usually renders these frames identically, and being told is enough to explain it when it does not.
const MANIFEST = path.join(GOLDEN_DIR, 'PROFILE.json');
const identity = { profile: PROFILE, chromium: browser.version(), args: PROFILES[PROFILE].args, res: RES, fps: FPS, frames: FRAMES, supersample: 2 };
if (!UPDATE && fs.existsSync(MANIFEST)) {
  const was = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (was.chromium !== identity.chromium) console.log(`note: baselines were taken on Chromium ${was.chromium}; this run is ${identity.chromium}`);
  if (JSON.stringify(was.args) !== JSON.stringify(identity.args)) console.log(`note: baselines were taken with different launch flags:\n  was:  ${(was.args || []).join(' ')}\n  now:  ${identity.args.join(' ')}`);
}

// Baseline coverage is decided before anything renders: an unbaselined profile is a different situation from
// a failing one, and saying so is the difference between "go baseline this" and "you broke 120 shots".
const expected = HOUSES.flatMap(h => SHOTS.flatMap(s => FRAMES[s].map(t => goldenPath(h, s, t))));
const present = expected.filter(p => fs.existsSync(p));
if (!UPDATE && present.length === 0) {
  console.error(`no baselines for profile "${PROFILE}" under ${path.relative(process.cwd(), GOLDEN_DIR)}`);
  console.error(`run:  pnpm run goldens:update --profile ${PROFILE}`);
  await browser.close(); server.close(); process.exit(3);
}

const results = [];
const queue = [...HOUSES];
const t0 = Date.now();

async function worker() {
  let ctx = null, page = null;
  // A load that times out leaves its navigation in flight, and the next goto on that page is then rejected
  // with "interrupted by another navigation to <the previous house>" — so ONE slow house used to take every
  // house after it on the same worker down with it. Measured on a software rasteriser, that cascade cost 92
  // of 120 frames. Recovery is a fresh context, not another go on the poisoned one.
  const freshPage = async () => {
    if (ctx) await ctx.close().catch(() => {});
    ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page = await ctx.newPage();
    page.on('pageerror', e => console.error(`  page error: ${e.message.split('\n')[0]}`));
    // Google's stylesheet becomes our own @font-face over the repo's woff2; the gstatic fetches it would have
    // triggered are refused, so nothing in a golden depends on the network.
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss(port) }));
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
  };
  await freshPage();
  for (let house = queue.shift(); house; house = queue.shift()) {
    // One page load a house, not one a frame: loading is most of the cost (~6 s), and every shot's spline is
    // already built by the time houseReady goes up — __houseRenderBegin takes the shot by name.
    let loaded = false;
    try {
      await page.goto(`http://localhost:${port}/room-creator.html?house=${house}&shot=${SHOTS[0]}&res=${RES}`, { waitUntil: 'domcontentloaded', timeout: LOAD_MS });
      await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, house, { timeout: LOAD_MS });
      // The screen texture is drawn with these faces; a frame captured mid-swap is a different picture.
      const fonts = await page.evaluate(async () => {
        const want = ['Manrope', 'Plus Jakarta Sans', 'JetBrains Mono'];
        // A webface no element currently uses is never fetched, so fonts.ready resolves with nothing loaded
        // and check() answers false. Ask for them by name first, then wait.
        await Promise.all(want.map(f => document.fonts.load(`16px "${f}"`).catch(() => {})));
        await document.fonts.ready;
        return want.filter(f => !document.fonts.check(`16px "${f}"`));
      });
      if (fonts.length) throw new Error(`fonts never loaded: ${fonts.join(', ')}`);
      // The composer's SMAA lookups decode asynchronously, so the first frame through a fresh composer is a
      // different picture from every one after it. Without this the baselines would encode the order the
      // frames happened to be captured in: `--shot orbit` alone then reports 220 differing pixels and
      // mae 0.23 against an unmodified tree, 23× the bar the gate is set at.
      // Pinned BEFORE warming, not just before capture: composerFor's cache key includes the supersample
      // factor, and the unpinned size heuristic (ss=1 above 1920×1080) would otherwise diverge from this
      // pinned value the moment --res exceeds 1080p, silently rebuilding an unwarmed composer for the frame
      // that actually gets captured.
      await page.evaluate(r => { window.__houseSupersample = 2; return window.__houseComposerWarm({ res: r }); }, RES);
      loaded = true;
    } catch (e) {
      for (const shot of SHOTS) for (const t of FRAMES[shot]) results.push({ house, shot, t, state: 'error', message: `load: ${e.message.split('\n')[0]}` });
      console.log(`  ✗ ${house}  load failed: ${e.message.split('\n')[0]}`);
      await freshPage();   // never carry a half-navigated page into the next house
    }
    if (!loaded) continue;
    for (const shot of SHOTS) {
      for (const t of FRAMES[shot]) {
        const label = `${house}/${shot}@${t}`;
        try {
          const shot_ = await page.evaluate(([shot, res, t, fps]) => {
            // already pinned before the warm-up above; not re-pinned here, so warm and capture always agree
            const info = __houseRenderBegin({ shot, res, fps });
            const i = Math.round(t * (info.frames - 1));
            __houseRenderFrames(i, 1, 1.0);                       // renders through the composer, exactly as the video does
            const gl = __houseDebug().renderer.getContext();
            const px = new Uint8Array(info.w * info.h * 4);
            gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            __houseRenderEnd();
            let s = ''; for (let k = 0; k < px.length; k += 8192) s += String.fromCharCode.apply(null, px.subarray(k, k + 8192));
            return { w: info.w, h: info.h, frame: i, of: info.frames, b64: btoa(s) };
          }, [shot, RES, t, FPS]);

          // readPixels hands back rows bottom-up; flip once here so the committed PNG is the right way up and
          // a human can open it.
          const raw = Buffer.from(shot_.b64, 'base64');
          const stride = shot_.w * 4, actual = Buffer.alloc(raw.length);
          for (let y = 0; y < shot_.h; y++) raw.copy(actual, y * stride, (shot_.h - 1 - y) * stride, (shot_.h - y) * stride);

          const gp = goldenPath(house, shot, t);
          if (UPDATE) {
            const png = encodePNG(actual, shot_.w, shot_.h);
            const before = fs.existsSync(gp) ? fs.readFileSync(gp) : null;
            fs.mkdirSync(path.dirname(gp), { recursive: true });
            fs.writeFileSync(gp, png);
            const state = !before ? 'added' : Buffer.compare(before, png) === 0 ? 'unchanged' : 'updated';
            results.push({ house, shot, t, state, bytes: png.length });
            console.log(`  ${state === 'added' ? '+' : state === 'updated' ? '~' : '='} ${label}  ${(png.length / 1024).toFixed(0)} KB`);
            continue;
          }

          if (!fs.existsSync(gp)) { results.push({ house, shot, t, state: 'missing' }); console.log(`  ? ${label}  no baseline`); continue; }
          const golden = decodePNG(fs.readFileSync(gp));
          if (golden.width !== shot_.w || golden.height !== shot_.h) {
            results.push({ house, shot, t, state: 'size', message: `baseline is ${golden.width}×${golden.height}, rendered ${shot_.w}×${shot_.h}` });
            console.log(`  ✗ ${label}  size mismatch`); continue;
          }
          const diff = Buffer.alloc(actual.length);
          const differing = pixelmatch(golden.data, actual, diff, shot_.w, shot_.h, { threshold: THRESHOLD });
          const ratio = differing / (shot_.w * shot_.h);
          const { mae, maxd } = meanAbsDiff(golden.data, actual);
          if (ratio <= RATIO && mae <= MAE) {
            results.push({ house, shot, t, state: 'pass', differing, ratio, mae, maxd });
            console.log(`  ✓ ${label}${differing ? `  ${differing} px (${(ratio * 100).toFixed(3)} %)` : ''}${mae > 0 ? `  mae ${mae.toFixed(4)}` : ''}`);
          } else {
            fs.mkdirSync(DIFF_OUT, { recursive: true });
            const stem = path.join(DIFF_OUT, `${house}-${shot}@${String(t).replace('.', '_')}`);
            fs.writeFileSync(`${stem}.actual.png`, encodePNG(actual, shot_.w, shot_.h));
            fs.writeFileSync(`${stem}.expected.png`, encodePNG(golden.data, shot_.w, shot_.h));
            fs.writeFileSync(`${stem}.diff.png`, encodePNG(diff, shot_.w, shot_.h));
            const why = ratio > RATIO && mae > MAE ? 'moved and shifted' : ratio > RATIO ? 'moved' : 'shifted';
            results.push({ house, shot, t, state: 'differ', why, differing, ratio, mae, maxd, diff: path.relative(process.cwd(), `${stem}.diff.png`) });
            console.log(`  ✗ ${label}  ${why}: ${differing} px (${(ratio * 100).toFixed(3)} % / ${(RATIO * 100).toFixed(3)} %), mae ${mae.toFixed(2)} (/ ${MAE}), max Δ${maxd} → ${path.relative(process.cwd(), stem)}.diff.png`);
          }
        } catch (e) {
          results.push({ house, shot, t, state: 'error', message: e.message.split('\n')[0] });
          console.log(`  ✗ ${label}  ${e.message.split('\n')[0]}`);
        }
      }
    }
  }
  if (ctx) await ctx.close().catch(() => {});
}

await Promise.all(Array.from({ length: Math.min(JOBS, HOUSES.length) }, worker));
await browser.close();
server.close();

const by = s => results.filter(r => r.state === s);
const secs = ((Date.now() - t0) / 1000).toFixed(0);
fs.mkdirSync(path.join(ROOT, 'test'), { recursive: true });
const reportPath = path.join(ROOT, 'test', `goldens.${PROFILE}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  profile: PROFILE, res: RES, size: `${RES === '360' ? '640×360' : RES}`, threshold: THRESHOLD, ratio: RATIO, mae: MAE,
  houses: HOUSES.length, shots: SHOTS, frames: FRAMES, update: UPDATE,
  // the gate's own identity: change any of it and every baseline is expected to move
  gate: crypto.createHash('sha256').update(JSON.stringify({ RES, FPS, FRAMES, THRESHOLD, RATIO, MAE, profile: PROFILE })).digest('hex').slice(0, 12),
  results,
}, null, 2) + '\n');

if (UPDATE) {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(identity, null, 2) + '\n');
  const bytes = results.reduce((n, r) => n + (r.bytes || 0), 0);
  console.log(`\n${results.length} baselines for "${PROFILE}" in ${secs}s: ${by('added').length} added, ${by('updated').length} updated, ${by('unchanged').length} unchanged — ${(bytes / 1048576).toFixed(1)} MB total`);
  console.log(`→ ${path.relative(process.cwd(), GOLDEN_DIR)}  (report: ${path.relative(process.cwd(), reportPath)})`);
  process.exit(by('error').length ? 2 : 0);
}

const differ = by('differ'), errors = by('error').concat(by('size')), missing = by('missing');
console.log(`\n${results.length} frames against "${PROFILE}" in ${secs}s: ${by('pass').length} pass, ${differ.length} differ, ${missing.length} without a baseline, ${errors.length} errored`);
// An LFS pointer checked out as text is a .png that is not an image, and it is the likeliest way this gate
// goes wrong on a fresh machine — so name it rather than reporting 120 decode failures.
if (errors.some(e => /not a PNG/.test(e.message || ''))) console.log(`\nSome baselines are not PNGs. If this is a fresh clone, they are Git LFS pointers:  git lfs install && git lfs pull`);
if (differ.length) {
  console.log(`\ndiffers:`);
  for (const r of differ.sort((a, b) => (b.mae - a.mae) || (b.ratio - a.ratio))) console.log(`  ${r.why.padEnd(18)} ${(r.ratio * 100).toFixed(3).padStart(7)} %  mae ${r.mae.toFixed(2).padStart(6)}  ${r.house}/${r.shot}@${r.t}  ${r.diff}`);
  console.log(`\nIf the change was intended, re-baseline:  pnpm run goldens:update`);
}
if (missing.length) {
  // Not a pass. A frame nobody has blessed is a frame nobody is checking, and the ways to get here — a new
  // house, a new shot, a half-finished re-baseline, a deleted file — are exactly the ways coverage rots
  // silently. (A profile with NO baselines at all is the different, louder case handled above with exit 3.)
  console.log(`\n${missing.length} frames have no baseline:`);
  for (const r of missing) console.log(`  ${r.house}/${r.shot}@${r.t}`);
  console.log(`Add them with:  pnpm run goldens:update`);
}
console.log(`report: ${path.relative(process.cwd(), reportPath)}`);
process.exit(errors.length ? 2 : (differ.length || missing.length) ? 1 : 0);
