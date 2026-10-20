#!/usr/bin/env -S node --experimental-strip-types
// Golden-image gate for the HouseSpec product shots (review item 4).
// @check-house skip — check-house runs it as its goldens step
//
//   pnpm run goldens [--house aurora,mirage] [--shot door-to-core,orbit,hero-reveal]
//        [--profile auto] [--update] [--record <stream>] [--jobs 3] [--timeout 60000]
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
// FRAMES picks five frames a house: the poster of each shot, plus the last frame of the two shots that end
// framed on the Core. 150 baselines at 640 × 360 is ~14 MB, which is what makes committing them reasonable.
//
// This runs on a developer's machine, not in CI. 150 frames through a software rasteriser cost an hour of
// GitHub Actions per push, which is not what that budget is for; `pnpm run check` (scripts/check-house.mts)
// runs it, and the four checks around it, in a couple of minutes on a GPU.
//
// Baselines are per renderer profile, because a GPU is part of the render: test/goldens/<profile>/.
// A profile with no baselines at all exits 3 ("nothing to compare against") rather than reporting 150
// regressions — that is the signal to bless a set for this machine on purpose, with --update.
//
// The golden ledger (plan Completeness I; scripts/golden-ledger.mts has the whole contract). Goldens are never
// re-blessed on a stream branch, so a branch whose change is MEANT to move frames declares each one in its own
// stream's file, test/goldens/expected-diffs/<stream>.json:
//
//   { "vanilla/door-to-core@1": { "cause": "monitor pole moved behind the screen" }, … }
//
// and records what each moved TO with `--record <stream>` (the render, beside the ledger, in LFS). A declared frame
// passes as "expected" when it matches a declaring stream's recorded frame, with this gate's own tolerance (its diff
// against the baseline is still written for review); an undeclared frame that moved fails as before; and a declared
// frame fails when it did NOT move ("unmoved" — the fix stopped taking effect, or the entry is stale), was never
// recorded here ("unrecorded"), or moved to something else ("elsewhere" — a regression on top of the declared change).
// Entries for frames this run does not render (--house / --shot) are not judged. The one re-bless at integration
// empties the folder.
//
// Exit codes:  0 pass · 1 one or more frames differ unexpectedly, are declared but unmoved / unrecorded / moved
//               elsewhere, or have no baseline · 2 a frame failed to render, or the ledger is malformed
//               3 the profile has no baselines
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import pixelmatch from './vendor/pixelmatch.mjs';
import { encodePNG, decodePNG } from './vendor/png.mjs';
import { loadLedger, pendingPath, causes, streamName, streamFile, ledgerDir, type LedgerEntry } from './golden-ledger.mts';

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
const RECORD = args.record && args.record !== 'true' ? streamName(args.record + '.json') : null;   // --record s1
if (args.record === 'true') { console.error('--record needs a stream: --record s1'); process.exit(2); }
if (RECORD && UPDATE) { console.error('--record and --update are two different things: record a branch\'s moved frames, or re-bless the baselines'); process.exit(2); }
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
// Expect it to be slow: an hour for 150 frames, against a couple of minutes on a GPU.
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
  'core-orbit': [0.55],
};
const SHOTS = (args.shot || Object.keys(FRAMES).join(',')).split(',').filter(Boolean);
for (const s of SHOTS) if (!FRAMES[s]) { console.error(`no golden frames defined for shot "${s}" (${Object.keys(FRAMES).join(', ')})`); process.exit(2); }

const HOUSES = (args.house || fs.readdirSync(path.join(ROOT, 'content', 'houses'))
  .filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json'))
  .map(f => f.replace(/\.json$/, '')).join(',')).split(',').filter(Boolean);

const goldenPath = (house, shot, t) => path.join(GOLDEN_DIR, house, `${shot}@${String(t).replace('.', '_')}.png`);

// the golden ledger (header; scripts/golden-ledger.mts): frame key → the streams that declare it. Fixture keys are
// test-fixtures.mts's to judge; here they only have to name a fixture.
const frameKey = (house, shot, t) => `${house}/${shot}@${t}`;
const LEDGER_DIR = ledgerDir(ROOT);
const GOLDEN_KEYS = new Set(fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json'))
  .map(f => f.replace(/\.json$/, '')).flatMap(h => Object.entries(FRAMES).flatMap(([s, ts]) => ts.map(t => frameKey(h, s, t)))));
const FIXTURE_IDS = new Set(fs.existsSync(path.join(ROOT, 'test', 'fixtures', 'houses')) ? fs.readdirSync(path.join(ROOT, 'test', 'fixtures', 'houses')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')) : []);
const ledger = loadLedger(ROOT, k => GOLDEN_KEYS.has(k) || FIXTURE_IDS.has(k.split('/')[0]));
if (ledger.problems.length) { console.error(`the golden ledger (${path.relative(process.cwd(), LEDGER_DIR)}):\n  ${ledger.problems.join('\n  ')}`); process.exit(2); }
const LEDGER = new Map([...ledger.entries].filter(([k]) => GOLDEN_KEYS.has(k)));   // key → LedgerEntry[]
if (RECORD && !ledger.byStream.has(RECORD)) { console.error(`--record ${args.record}: no ${path.relative(process.cwd(), path.join(LEDGER_DIR, streamFile(RECORD) + '.json'))} — declare the frames it moves there first`); process.exit(2); }
// does `actual` match a recorded frame within the gate's tolerance?
function sameFrame(recorded, actual, w, h) {
  if (recorded.width !== w || recorded.height !== h) return false;
  const ratio = pixelmatch(recorded.data, actual, null, w, h, { threshold: THRESHOLD }) / (w * h);
  return ratio <= RATIO && meanAbsDiff(recorded.data, actual).mae <= MAE;
}

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
// reads as one line rather than as 150 mysterious diffs. It warns instead of failing — a newer Chromium
// usually renders these frames identically, and being told is enough to explain it when it does not.
const MANIFEST = path.join(GOLDEN_DIR, 'PROFILE.json');
const identity = { profile: PROFILE, chromium: browser.version(), args: PROFILES[PROFILE].args, res: RES, fps: FPS, frames: FRAMES, supersample: 2 };
if (!UPDATE && fs.existsSync(MANIFEST)) {
  const was = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (was.chromium !== identity.chromium) console.log(`note: baselines were taken on Chromium ${was.chromium}; this run is ${identity.chromium}`);
  if (JSON.stringify(was.args) !== JSON.stringify(identity.args)) console.log(`note: baselines were taken with different launch flags:\n  was:  ${(was.args || []).join(' ')}\n  now:  ${identity.args.join(' ')}`);
}

// Baseline coverage is decided before anything renders: an unbaselined profile is a different situation from
// a failing one, and saying so is the difference between "go baseline this" and "you broke 150 shots".
const expected = HOUSES.flatMap(h => SHOTS.flatMap(s => FRAMES[s].map(t => goldenPath(h, s, t))));
const present = expected.filter(p => fs.existsSync(p));
// Does this profile have baselines at all (any PNG under its folder)? Not the same question as "do these houses": a home added to the
// collection (the apartments, reference/APARTMENTS.md) has none on a profile that holds the other 30.
const profileHasBaselines = fs.existsSync(GOLDEN_DIR) && fs.readdirSync(GOLDEN_DIR, { withFileTypes: true }).some(d => d.isDirectory() && fs.readdirSync(path.join(GOLDEN_DIR, d.name)).some(f => f.endsWith('.png')));
if (!UPDATE && !profileHasBaselines) {
  console.error(`no baselines for profile "${PROFILE}" under ${path.relative(process.cwd(), GOLDEN_DIR)}`);
  console.error(`run:  pnpm run goldens:update --profile ${PROFILE}`);
  await browser.close(); server.close(); process.exit(3);
}

const results = [];
// A house that has no baseline frame at all (of the shots asked for) is not rendered: there is nothing to compare it with, and the gate never
// blesses a frame by itself. It is reported once, by name, as a house without a baseline, and the run fails (a frame nobody has blessed is a frame
// nobody is checking). Blessing is a decision made on the machine of the committed profile, and only for the houses named: --update --house <ids>.
const unbaselined = UPDATE ? [] : HOUSES.filter(h => !SHOTS.some(s => FRAMES[s].some(t => fs.existsSync(goldenPath(h, s, t)))));
for (const h of unbaselined) for (const s of SHOTS) for (const t of FRAMES[s]) results.push({ house: h, shot: s, t, state: 'missing', whole: true });
if (unbaselined.length) {
  console.log(`\n${unbaselined.length} house${unbaselined.length === 1 ? ' has' : 's have'} no golden baseline on "${PROFILE}" (${present.length ? `the profile holds ${new Set(fs.readdirSync(GOLDEN_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)).size} other houses` : 'and none of the houses asked for has one'}): ${unbaselined.join(', ')}`);
  console.log(`  not rendered and not blessed here; to cover ${unbaselined.length === 1 ? 'it' : 'them'}, on the machine of the committed profile (${fs.existsSync(MANIFEST) ? 'test/goldens/' + PROFILE + '/PROFILE.json' : PROFILE}):`);
  console.log(`    pnpm run goldens:update --house ${unbaselined.join(',')}   (then look at the frames, and commit them)\n`);
}
const queue = HOUSES.filter(h => !unbaselined.includes(h));
const t0 = Date.now();

async function worker() {
  let ctx = null, page = null;
  // A load that times out leaves its navigation in flight, and the next goto on that page is then rejected
  // with "interrupted by another navigation to <the previous house>" — so ONE slow house used to take every
  // house after it on the same worker down with it. Measured on a software rasteriser, that cascade cost 92
  // of 150 frames. Recovery is a fresh context, not another go on the poisoned one.
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
          const key = frameKey(house, shot, t), declared: LedgerEntry[] | undefined = LEDGER.get(key);
          if (ratio <= RATIO && mae <= MAE && declared) {
            results.push({ house, shot, t, state: 'unmoved', differing, ratio, mae, maxd, cause: causes(declared) });
            console.log(`  ✗ ${label}  unmoved: the ledger says it moves (${causes(declared)}), and it matches its baseline`);
          } else if (ratio <= RATIO && mae <= MAE) {
            results.push({ house, shot, t, state: 'pass', differing, ratio, mae, maxd });
            console.log(`  ✓ ${label}${differing ? `  ${differing} px (${(ratio * 100).toFixed(3)} %)` : ''}${mae > 0 ? `  mae ${mae.toFixed(4)}` : ''}`);
          } else {
            fs.mkdirSync(DIFF_OUT, { recursive: true });
            const stem = path.join(DIFF_OUT, `${house}-${shot}@${String(t).replace('.', '_')}`);
            fs.writeFileSync(`${stem}.actual.png`, encodePNG(actual, shot_.w, shot_.h));
            fs.writeFileSync(`${stem}.expected.png`, encodePNG(golden.data, shot_.w, shot_.h));
            fs.writeFileSync(`${stem}.diff.png`, encodePNG(diff, shot_.w, shot_.h));
            const why = ratio > RATIO && mae > MAE ? 'moved and shifted' : ratio > RATIO ? 'moved' : 'shifted';
            // a declared frame: did it move to what a declaring stream recorded? (--record: record it now, for that stream)
            let state = 'differ', note = '';
            if (declared) {
              const mine = RECORD && declared.find(e => e.stream === RECORD);
              if (mine) {
                const pp = pendingPath(ROOT, RECORD, PROFILE, key);
                fs.mkdirSync(path.dirname(pp), { recursive: true }); fs.writeFileSync(pp, encodePNG(actual, shot_.w, shot_.h));
                state = 'recorded'; note = ` (recorded for ${RECORD} → ${path.relative(process.cwd(), pp)})`;
              } else {
                const recs = declared.map(e => ({ e, pp: pendingPath(ROOT, e.stream, PROFILE, key) })).filter(r => fs.existsSync(r.pp));
                const hit = recs.find(r => sameFrame(decodePNG(fs.readFileSync(r.pp)), actual, shot_.w, shot_.h));
                state = hit ? 'expected' : recs.length ? 'elsewhere' : 'unrecorded';
                note = hit ? ` (expected — ${causes(declared)})`
                  : recs.length ? ` — declared (${causes(declared)}), but it moved to something other than what ${recs.map(r => r.e.stream).join(' / ')} recorded`
                  : ` — declared (${causes(declared)}), but its moved frame is not recorded on ${PROFILE}: pnpm run goldens --record ${streamFile(declared[0].stream)} --house ${house}`;
                if (!hit && recs.length) fs.writeFileSync(`${stem}.recorded.png`, fs.readFileSync(recs[0].pp));
              }
            }
            results.push({ house, shot, t, state, why, differing, ratio, mae, maxd, diff: path.relative(process.cwd(), `${stem}.diff.png`), ...(declared ? { cause: causes(declared) } : {}) });
            console.log(`  ${state === 'expected' || state === 'recorded' ? '≈' : '✗'} ${label}  ${why}${note}: ${differing} px (${(ratio * 100).toFixed(3)} % / ${(RATIO * 100).toFixed(3)} %), mae ${mae.toFixed(2)} (/ ${MAE}), max Δ${maxd} → ${path.relative(process.cwd(), stem)}.diff.png`);
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

await Promise.all(Array.from({ length: Math.min(JOBS, Math.max(1, queue.length)) }, worker));
await browser.close();
server.close();

const by = s => results.filter(r => r.state === s);
const secs = ((Date.now() - t0) / 1000).toFixed(0);
fs.mkdirSync(path.join(ROOT, 'test'), { recursive: true });
const reportPath = path.join(ROOT, 'test', `goldens.${PROFILE}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  profile: PROFILE, res: RES, size: `${RES === '360' ? '640×360' : RES}`, threshold: THRESHOLD, ratio: RATIO, mae: MAE,
  houses: HOUSES.length, shots: SHOTS, frames: FRAMES, update: UPDATE, record: RECORD, ledger: LEDGER.size,
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
  if (ledger.entries.size) console.log(`note: the ledger still lists ${ledger.entries.size} expected diff(s) — a re-bless takes them in, so empty ${path.relative(process.cwd(), LEDGER_DIR)} (the entries and their recorded frames) in the same commit`);
  process.exit(by('error').length ? 2 : 0);
}

const differ = by('differ'), errors = by('error').concat(by('size')), missing = by('missing'), expectedDiffs = by('expected'), unmoved = by('unmoved');
const unrecorded = by('unrecorded'), elsewhere = by('elsewhere'), recorded = by('recorded');
if (RECORD) {
  // a frame this stream no longer declares keeps no recorded frame (only among the frames this run rendered)
  const mine = ledger.byStream.get(RECORD) || {}, rendered = new Set(results.map(r => frameKey(r.house, r.shot, r.t)));
  for (const k of rendered) if (!mine[k] && GOLDEN_KEYS.has(k)) { const pp = pendingPath(ROOT, RECORD, PROFILE, k); if (fs.existsSync(pp)) { fs.rmSync(pp); console.log(`  - ${k}  no longer declared by ${RECORD}: its recorded frame is removed`); } }
}
console.log(`\n${results.length} frames against "${PROFILE}" in ${secs}s: ${by('pass').length} pass, ${expectedDiffs.length} expected (ledger)${RECORD ? `, ${recorded.length} recorded for ${RECORD}` : ''}, ${differ.length} differ, ${unmoved.length + unrecorded.length + elsewhere.length} declared but unmoved / unrecorded / moved elsewhere, ${missing.length} without a baseline, ${errors.length} errored`);
// An LFS pointer checked out as text is a .png that is not an image, and it is the likeliest way this gate
// goes wrong on a fresh machine — so name it rather than reporting 150 decode failures.
if (errors.some(e => /not a PNG/.test(e.message || ''))) console.log(`\nSome baselines are not PNGs. If this is a fresh clone, they are Git LFS pointers:  git lfs install && git lfs pull`);
if (differ.length) {
  console.log(`\ndiffers:`);
  for (const r of differ.sort((a, b) => (b.mae - a.mae) || (b.ratio - a.ratio))) console.log(`  ${r.why.padEnd(18)} ${(r.ratio * 100).toFixed(3).padStart(7)} %  mae ${r.mae.toFixed(2).padStart(6)}  ${r.house}/${r.shot}@${r.t}  ${r.diff}`);
  console.log(`\nIf the change was intended, re-baseline:  pnpm run goldens:update`);
}
if (expectedDiffs.length || recorded.length) {
  console.log(`\nexpected (declared in ${path.relative(process.cwd(), LEDGER_DIR)}, matching what was recorded):`);
  for (const r of expectedDiffs.concat(recorded)) console.log(`  ${r.why.padEnd(18)} ${(r.ratio * 100).toFixed(3).padStart(7)} %  mae ${r.mae.toFixed(2).padStart(6)}  ${r.house}/${r.shot}@${r.t}  ${r.cause}${r.state === 'recorded' ? '  (recorded now)' : ''}`);
}
if (unmoved.length) {
  console.log(`\n${unmoved.length} frames the ledger declares as moving match their baselines — the change did not take, or the entry is stale:`);
  for (const r of unmoved) console.log(`  ${r.house}/${r.shot}@${r.t}  ${r.cause}`);
}
if (unrecorded.length) {
  console.log(`\n${unrecorded.length} declared frames moved, but nobody recorded what they moved to on ${PROFILE} — look at the diffs, then record them:  pnpm run goldens --record <stream>`);
  for (const r of unrecorded) console.log(`  ${r.house}/${r.shot}@${r.t}  ${r.cause}  ${r.diff}`);
}
if (elsewhere.length) {
  console.log(`\n${elsewhere.length} declared frames moved to something other than what was recorded (a regression on top of the declared change, or two streams meeting — record again, with both causes):`);
  for (const r of elsewhere) console.log(`  ${r.house}/${r.shot}@${r.t}  ${r.cause}  ${r.diff}`);
}
if (missing.length) {
  // Not a pass. A frame nobody has blessed is a frame nobody is checking, and the ways to get here — a new
  // house, a new shot, a half-finished re-baseline, a deleted file — are exactly the ways coverage rots
  // silently. (A profile with NO baselines at all is the different, louder case handled above with exit 3.)
  const partial = missing.filter(r => !r.whole);
  if (unbaselined.length) console.log(`\n${unbaselined.length} house${unbaselined.length === 1 ? '' : 's'} without a baseline (${unbaselined.length * SHOTS.reduce((n, sh) => n + FRAMES[sh].length, 0)} frames), listed above: pnpm run goldens:update --house ${unbaselined.join(',')}`);
  if (partial.length) {
    console.log(`\n${partial.length} frames have no baseline:`);
    for (const r of partial) console.log(`  ${r.house}/${r.shot}@${r.t}`);
    console.log(`Add them with:  pnpm run goldens:update --house ${[...new Set(partial.map(r => r.house))].join(',')}`);
  }
}
console.log(`report: ${path.relative(process.cwd(), reportPath)}`);
process.exit(errors.length ? 2 : (differ.length || missing.length || unmoved.length || unrecorded.length || elsewhere.length) ? 1 : 0);
