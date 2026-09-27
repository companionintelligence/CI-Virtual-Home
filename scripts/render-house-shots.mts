#!/usr/bin/env -S node --experimental-strip-types
// Headless product-shot renderer + shot QA for HouseSpec houses.
//
//   pnpm run shots [--house <id>[,<id>…]] [--shot door-to-core,orbit,…]
//        [--res 1080] [--aspect 16:9] [--fps 60] [--out video/houses] [--jobs 1]
//   (node --experimental-strip-types scripts/render-house-shots.mts — any cwd; --out is relative to the cwd)
//        [--poster-only] [--skip-existing] [--qa-only] [--no-gate] [--software]
//
// For every house × shot it opens room-creator.html?house=<id>&shot=<type> in headless Chromium (Playwright)
// and drives the page's own scene:
//
//   1. QA gate — window.__houseShotQA samples the shot's camera path against the built house (wall clips,
//      floor clips, entering through a wall instead of the door, ending outside the hero room, Core out of
//      frame or occluded on the last frame). Errors skip the render and are recorded in the manifest; --no-gate
//      renders anyway. --qa-only runs just this for every house × shot, writes <out>/qa.json, exits 1 on errors.
//   2. Deterministic capture — window.__houseRenderBegin/Frames/End step the spline one frame at a time
//      (frame i = t of i / (N - 1), N = fps × duration) and hand each frame back as a JPEG (q 0.95). No
//      MediaRecorder, no rAF, no wall clock: the output is byte-identical run to run and whether the machine
//      renders at 60 fps or 0.3 fps, and 4K only costs time. Frames stream into one ffmpeg per shot (image2pipe →
//      H.264 CRF 18, bitexact), so there is no WebM intermediate; the poster (t = 0.55) and the final frame are
//      two of those frames.
//
// <out>/manifest.json is merged, not replaced: entries are keyed by house × shot, rewritten after every shot (a
// crash keeps what already rendered), and a run only touches the houses/shots it was asked for. --skip-existing
// lists a house × shot whose poster/mp4 already exist without re-rendering it. --jobs N renders N houses at once
// (N pages, N ffmpegs; the Metal path takes ~3× before the GPU saturates). Each shot gets one retry on a fresh
// browser context; a shot that fails twice is recorded with an `error` and the run exits 1 at the end.
//
// Playwright resolves from a local install, $PLAYWRIGHT_MODULE, or the newest copy in ~/.npm/_npx; run
// `npx playwright install chromium` once if none is found. ffmpeg must be on PATH.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'video', 'houses');
const RES = args.res || '1080';
const ASPECT = args.aspect || '16:9';
const FPS = parseInt(args.fps || '60', 10);
const JOBS = Math.max(1, parseInt(args.jobs || '1', 10));
const SHOTS = (args.shot || 'door-to-core,orbit').split(',').map(s => s.trim()).filter(Boolean);
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/houses/index.json'), 'utf8'));
const HOUSES = args.house ? args.house.split(',') : index.houses.map(h => h.id);
const POSTER_ONLY = args['poster-only'] === 'true';
const SKIP_EXISTING = args['skip-existing'] === 'true';
const QA_ONLY = args['qa-only'] === 'true';
const GATE = args['no-gate'] !== 'true';
const JPEG_QUALITY = 0.95;   // intermediate frames; x264 CRF 18 below is the visible quality floor
const FRAMES_PER_CALL = 24;  // frames handed back per page.evaluate (≈ 6 MB of base64 at 1080p)

// Resolve playwright: local install → $PLAYWRIGHT_MODULE → newest copy in the npx cache (~/.npm/_npx).
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { pathToFileURL } = await import('node:url');
  const os = await import('node:os');
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const p = path.join(npx, d, 'node_modules', 'playwright');
    if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p);
  }
  candidates.sort((a, b) => { const v = p => { try { return JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version; } catch { return '0'; } }; return v(b).localeCompare(v(a), undefined, { numeric: true }); });
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable — run `npx playwright install chromium` once (this also caches the module), or set PLAYWRIGHT_MODULE=/path/to/node_modules/playwright');
  process.exit(2);
}
const playwright = await loadPlaywright();
if (!POSTER_ONLY && !QA_ONLY && spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg is not on PATH'); process.exit(2); }

// --- tiny static server for the repo root (ES modules + fetch need http, not file://)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

await new Promise<void>(resolve => server.listen(0, () => resolve()));
const port = (server.address() as import('node:net').AddressInfo).port;

// GPU first (ANGLE/Metal on macOS renders a 1080p frame in a few ms); SwiftShader is the software fallback —
// correct output, just slow, since capture is stepped and never depends on the frame rate.
const gpuArgs = process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle', '--use-angle=default'];
const launchArgs = args.software === 'true'
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : gpuArgs;
const browser = await playwright.chromium.launch({
  headless: true,
  args: [...launchArgs, '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required']
});

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const key = (e: any) => `${e.id}/${e.shot}`;
// merge with whatever a previous run left — keyed by house × shot, so partial re-runs fill gaps
const prior = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const manifest: Map<string, any> = new Map((prior?.shots || []).map((e: any) => [key(e), e]));
function writeManifest() {
  if (QA_ONLY) return;
  const shots = [...manifest.values()].sort((a, b) => HOUSES.indexOf(a.id) - HOUSES.indexOf(b.id) || a.id.localeCompare(b.id) || SHOTS.indexOf(a.shot) - SHOTS.indexOf(b.shot));
  fs.writeFileSync(manifestPath, JSON.stringify({ generated: new Date().toISOString(), res: RES, aspect: ASPECT, fps: FPS, shots }, null, 2) + '\n');
}
const probeDuration = f => { const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]); return parseFloat(p.stdout?.toString()) || null; };
const have = f => fs.existsSync(f) && fs.statSync(f).size > 0;

async function openHouse(page, id, shot) {
  // domcontentloaded, not load: room-creator links Google Fonts, and `load` would block on that fetch.
  await page.goto(`http://localhost:${port}/room-creator.html?house=${id}&shot=${shot}&res=${RES}&aspect=${ASPECT}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 60000 });
  // SMAAPass decodes its area/search lookups asynchronously, so the first frame through a fresh composer is
  // measurably wrong (~220 px, max channel delta 246 at 640×360 — see room-creator.html's own comment on
  // __houseComposerWarm). Each call here is a fresh page.goto, which resets the page-scoped composer cache, so
  // every house needs this, not just the capture scripts that already call it (test-goldens.mts,
  // test-frame-hash.mts). Without it, frame 0 of every shot's output — the shipped poster.jpg under
  // --poster-only — carried the cold-composer artefact.
  await page.evaluate(([res, aspect]) => window.__houseComposerWarm({ res, aspect }), [RES, ASPECT]);
}

async function shotQA(page, shot) {
  return page.evaluate(s => window.__houseShotQA(s), shot);
}

// Scene QA reads the built house once per run, not per shot: the dressing took, nothing is buried in a
// wall, the planting is not on a grid.
async function sceneQA(page) {
  return page.evaluate(() => window.__houseSceneQA());
}

// Stream N stepped frames into ffmpeg; returns { frames, duration, posterPath, finalPath, mp4 }.
async function captureShot(page, id, shot, dir) {
  const info = await page.evaluate(o => window.__houseRenderBegin(o), { shot, res: RES, aspect: ASPECT, fps: FPS });
  const posterPath = path.join(dir, `${shot}.poster.jpg`), finalPath = path.join(dir, `${shot}.final.jpg`);
  const posterIdx = Math.round(0.55 * (info.frames - 1));
  const grab = (from, count) => page.evaluate(([f, c, q]) => window.__houseRenderFrames(f, c, q), [from, count, JPEG_QUALITY]);
  try {
    if (POSTER_ONLY) {
      fs.writeFileSync(posterPath, Buffer.from((await grab(posterIdx, 1))[0], 'base64'));
      fs.writeFileSync(finalPath, Buffer.from((await grab(info.frames - 1, 1))[0], 'base64'));
      return { ...info, posterPath, finalPath, mp4: null };
    }
    const mp4 = path.join(dir, `${shot}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-an', '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
      '-flags', '+bitexact', '-fflags', '+bitexact', mp4], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', (d: any) => ffErr += d);
    const ffDone = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${ffErr.trim()}`))); });
    const write = (buf: any) => new Promise<void>(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', () => r()));
    try {
      // fetch the next batch while ffmpeg chews on this one
      let next = grab(0, FRAMES_PER_CALL);
      for (let from = 0; from < info.frames; from += FRAMES_PER_CALL) {
        const frames = await next;
        if (from + FRAMES_PER_CALL < info.frames) next = grab(from + FRAMES_PER_CALL, FRAMES_PER_CALL);
        for (let k = 0; k < frames.length; k++) {
          const buf = Buffer.from(frames[k], 'base64'), i = from + k;
          if (i === posterIdx) fs.writeFileSync(posterPath, buf);
          if (i === info.frames - 1) fs.writeFileSync(finalPath, buf);
          await write(buf);
        }
      }
      ff.stdin.end();
      await ffDone;
    } catch (e) { ff.kill('SIGKILL'); throw e; }
    return { ...info, posterPath, finalPath, mp4 };
  } finally {
    await page.evaluate(() => window.__houseRenderEnd()).catch(() => {});
  }
}

async function renderShot(page, id, shot, dir) {
  await openHouse(page, id, shot);
  const qa = await shotQA(page, shot);
  const qaSummary = { errors: qa.errors, warnings: qa.warnings };
  if (qa.errors.length && GATE) { const e: any = new Error(`qa: ${qa.errors.map(x => x.code).join(', ')}`); e.qa = qaSummary; e.gated = true; throw e; }
  const r = await captureShot(page, id, shot, dir);
  return {
    id, shot, res: RES, aspect: ASPECT, fps: FPS, frames: r.frames, duration: r.duration,
    poster: path.relative(OUT, r.posterPath), final: path.relative(OUT, r.finalPath),
    mp4: r.mp4 ? path.relative(OUT, r.mp4) : null, webm: null, qa: qaSummary
  };
}

// --- work loop: JOBS workers pull houses off one queue; each house gets a fresh context
const queue = [...HOUSES];
const failures = [], qaReport = [], sceneReport = [];
const log = (id, shot, msg) => console.log(`${JOBS > 1 ? `[${id}] ` : ''}▶ ${id} / ${shot} … ${msg}`);

async function worker() {
  let ctx = null, page = null;
  const freshPage = async () => {
    if (ctx) await ctx.close().catch(() => {});
    ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page = await ctx.newPage();
    page.on('pageerror', e => console.error('  page error:', e.message));
  };
  for (let id = queue.shift(); id; id = queue.shift()) {
    const dir = path.join(OUT, id); if (!QA_ONLY) fs.mkdirSync(dir, { recursive: true });
    await freshPage();
    for (const shot of SHOTS) {
      const t0 = Date.now();
      if (QA_ONLY) {
        try {
          await openHouse(page, id, shot);
          if (shot === SHOTS[0]) { const sq = await sceneQA(page); sceneReport.push(sq); log(id, 'scene', sq.errors.length ? `✗ ${sq.errors.map(e => e.code).join(', ')}` : sq.warnings.length ? `✓ (${sq.warnings.length} warn)` : '✓'); }
          const qa = await shotQA(page, shot); qaReport.push(qa);
          log(id, shot, qa.errors.length ? `✗ ${qa.errors.map(e => e.code).join(', ')}` : qa.warnings.length ? `✓ (${qa.warnings.length} warn)` : '✓');
        }
        catch (e) { qaReport.push({ id, shot, errors: [{ code: 'crash', t: 0, message: e.message.split('\n')[0] }], warnings: [] }); log(id, shot, `✗ crash: ${e.message.split('\n')[0]}`); }
        continue;
      }
      const posterPath = path.join(dir, `${shot}.poster.jpg`), mp4Path = path.join(dir, `${shot}.mp4`);
      if (SKIP_EXISTING && have(posterPath) && (POSTER_ONLY || have(mp4Path))) {
        const prev = manifest.get(`${id}/${shot}`) || {};
        const entry = { ...prev, id, shot, res: RES, aspect: ASPECT, fps: prev.fps || FPS, duration: prev.duration || (have(mp4Path) ? probeDuration(mp4Path) : null), poster: path.relative(OUT, posterPath), final: have(path.join(dir, `${shot}.final.jpg`)) ? path.relative(OUT, path.join(dir, `${shot}.final.jpg`)) : prev.final || null, mp4: POSTER_ONLY ? prev.mp4 || null : path.relative(OUT, mp4Path), webm: null };
        delete entry.error; manifest.set(key(entry), entry); writeManifest();
        log(id, shot, 'exists, skipped'); continue;
      }
      let entry = null, lastErr = null;
      for (let attempt = 1; attempt <= 2 && !entry; attempt++) {
        try { entry = await renderShot(page, id, shot, dir); }
        catch (e) {
          lastErr = e;
          if (e.gated) break;   // a QA failure is a spec problem, not a flake — no retry
          console.error(`\n  attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
          if (attempt < 2) await freshPage();
        }
      }
      const renderSeconds = +((Date.now() - t0) / 1000).toFixed(1);
      if (entry) { entry.renderSeconds = renderSeconds; manifest.set(key(entry), entry); log(id, shot, `done in ${renderSeconds}s${entry.qa.warnings.length ? ` (${entry.qa.warnings.length} qa warn)` : ''}`); }
      else {
        const err = { id, shot, res: RES, aspect: ASPECT, error: lastErr?.message.split('\n')[0] || 'unknown', qa: lastErr?.qa, renderSeconds };
        manifest.set(key(err), err); failures.push(err); log(id, shot, lastErr?.gated ? `GATED — ${err.error}` : `FAILED after ${renderSeconds}s`);
      }
      writeManifest();
    }
  }
  if (ctx) await ctx.close().catch(() => {});
}

const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(JOBS, HOUSES.length) }, worker));
await browser.close(); server.close();

if (QA_ONLY) {
  fs.mkdirSync(OUT, { recursive: true });
  const bad = qaReport.filter(q => q.errors.length), warned = qaReport.filter(q => !q.errors.length && q.warnings.length);
  const sceneBad = sceneReport.filter(q => q.errors.length);
  fs.writeFileSync(path.join(OUT, 'qa.json'), JSON.stringify({ generated: new Date().toISOString(), shots: qaReport, scenes: sceneReport }, null, 2) + '\n');
  for (const q of sceneReport) for (const e of q.errors) console.log(`  ERROR ${q.id}/scene ${e.code}: ${e.message}`);
  for (const q of qaReport) for (const e of q.errors) console.log(`  ERROR ${q.id}/${q.shot} t=${e.t} ${e.code}: ${e.message}`);
  for (const q of sceneReport) for (const w of q.warnings) console.log(`  warn  ${q.id}/scene ${w.code}: ${w.message}`);
  for (const q of qaReport) for (const w of q.warnings) console.log(`  warn  ${q.id}/${q.shot} t=${w.t} ${w.code}: ${w.message}`);
  const sceneWarns = sceneReport.reduce((n, q) => n + q.warnings.length, 0);
  console.log(`\n${qaReport.length} shots checked in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${bad.length} with errors, ${warned.length} with warnings only`);
  console.log(`${sceneReport.length} scenes checked: ${sceneBad.length} with errors, ${sceneWarns} warnings → ${path.join(OUT, 'qa.json')}`);
  process.exit(bad.length || sceneBad.length ? 1 : 0);
}
writeManifest();
console.log(`\n${manifest.size} entries → ${manifestPath} in ${((Date.now() - t0) / 1000).toFixed(0)}s${failures.length ? ` — ${failures.length} FAILED: ${failures.map(key).join(', ')}` : ''}`);
process.exit(failures.length ? 1 : 0);
