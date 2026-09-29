#!/usr/bin/env -S node --experimental-strip-types
// Fixture houses: the specs each stream proves its features on (plan §2.0 — streams never edit content/houses/),
// rendered to stills with a frame-hash, outside the 150 goldens.
//
//   pnpm run fixtures [--fixture s0-seams,kit-doors] [--update] [--record <stream>] [--res 360] [--profile auto] [--no-qa]
//   (node --experimental-strip-types scripts/test-fixtures.mts — any cwd)
//
// test/fixtures/houses/<id>.json is a HouseSpec like any other; name it after its stream ("kit-…", "arch-…",
// "compose-…", "site-…", "shot-…"; "s0-…" for the harness's own). For each fixture this:
//   1. validates it — the schema and every scripts/validate/*.mts plugin — and fails on an error;
//   2. builds it in the editor exactly as a real house (the harness's server answers content/houses/<id>.json from
//      test/fixtures/houses/, so the page needs no hook), runs the scene QA and the shot QA of the shots it renders,
//      and fails on an error (a fixture may say "qa": false for a demo the v1 camera cannot fly);
//   3. renders its stills through the video path (composer, GTAO, SMAA, 2× supersampling), 640 × 360 by default —
//      door-to-core @0.55 and @1, orbit @0.55, hero-reveal @1, core-orbit @0.55 unless it lists its own — writes
//      them to test/fixtures/out/<profile>/<id>/ (gitignored) to be LOOKED AT, and compares each frame's sha256
//      with test/fixtures/hashes/<profile>/<id>.json — one file per fixture, so two streams' fixtures never share
//      one. A stream blesses its OWN new or changed fixture with `--fixture <id> --update`, on purpose, like a
//      golden. A frame of ANOTHER stream's fixture (the harness's s0-seams, say) that the branch is meant to move is
//      declared in the golden ledger instead (scripts/golden-ledger.mts: test/goldens/expected-diffs/<stream>.json,
//      its moved hash written by `--record <stream>`); any other hash that moved is a failure.
//
// An optional "fixture" block in the spec steers it: { "note": "what it shows", "frames": { "orbit": [0.55] },
// "qa": false }. The builder ignores unknown top-level keys, so the block never reaches the render.
//
// Frames are hashed raw (RGBA off the GL context, no JPEG). A cold browser's first context renders a hair
// differently (scripts/test-frame-hash.mts), so a throwaway context renders one frame of THE SAME fixture before its frames are
// kept — each fixture warms its own shaders, so its hashes do not depend on which fixtures ran before it (a fixture whose
// materials the previous one had not compiled differed by one pixel, one level, and only when it ran second).
//
// Exit: 0 all pass · 1 a fixture failed validation, QA or its hash, or has no hash · 2 a harness error
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { encodePNG } from './vendor/png.mjs';
import { validate } from './validate-house-spec.mts';
import { loadLedger, causes, streamName, streamFile, writeStreamLedger, ledgerDir } from './golden-ledger.mts';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses');
const RES = args.res || '360';
const UPDATE = args.update === 'true';
const RECORD = args.record && args.record !== 'true' ? streamName(args.record + '.json') : null;   // --record s1
if (args.record === 'true') { console.error('--record needs a stream: --record s1'); process.exit(2); }
if (RECORD && UPDATE) { console.error('--record (a moved frame of another stream\'s fixture) and --update (bless your own) are separate runs'); process.exit(2); }
const QA = args['no-qa'] !== 'true';
const PROFILES = {
  'macos-metal': { platform: 'darwin', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  'linux-swiftshader': { platform: 'linux', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--no-sandbox', '--hide-scrollbars'] },
};
const PROFILE = args.profile && args.profile !== 'auto' ? args.profile : process.env.HOUSE_GOLDEN_PROFILE || Object.keys(PROFILES).find(k => PROFILES[k].platform === process.platform) || `${process.platform}-unknown`;
if (!PROFILES[PROFILE]) { console.error(`unknown profile "${PROFILE}"`); process.exit(2); }
const HASHES = path.join(ROOT, 'test', 'fixtures', 'hashes', PROFILE);   // <id>.json per fixture
const OUT = path.join(ROOT, 'test', 'fixtures', 'out', PROFILE);
const DEFAULT_FRAMES = { 'door-to-core': [0.55, 1], 'orbit': [0.55], 'hero-reveal': [1], 'core-orbit': [0.55] };

const all = fs.existsSync(FIXTURES) ? fs.readdirSync(FIXTURES).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort() : [];
const ids = args.fixture ? args.fixture.split(',').filter(Boolean) : all;
for (const id of ids) if (!all.includes(id)) { console.error(`no fixture ${id} in ${path.relative(process.cwd(), FIXTURES)}`); process.exit(2); }
if (!ids.length) { console.log('no fixtures'); process.exit(0); }
const real = new Set(fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')));
// the golden ledger's fixture frames (its golden frames are test-goldens.mts's to judge)
const ledger = loadLedger(ROOT, k => real.has(k.split('/')[0]) || all.includes(k.split('/')[0]));
if (ledger.problems.length) { console.error(`the golden ledger (${path.relative(process.cwd(), ledgerDir(ROOT))}):\n  ${ledger.problems.join('\n  ')}`); process.exit(2); }
if (RECORD && !ledger.byStream.has(RECORD)) { console.error(`--record ${args.record}: no ${path.relative(process.cwd(), path.join(ledgerDir(ROOT), streamFile(RECORD) + '.json'))} — declare the frames it moves there first`); process.exit(2); }

// ---- 1. validate
let failed = 0;
const specs = {};
for (const id of ids) {
  const file = path.join(FIXTURES, `${id}.json`), rel = path.relative(process.cwd(), file);
  let spec; try { spec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`✗ ${rel}: invalid JSON — ${e.message}`); failed++; continue; }
  if (real.has(id)) { console.log(`✗ ${rel}: "${id}" is also a real house — a fixture needs its own id`); failed++; continue; }
  const { errors, warnings } = validate(spec, rel);
  errors.forEach(e => console.log('  ERROR ' + e)); warnings.forEach(w => console.log('  warn  ' + w));
  if (errors.length) { console.log(`✗ ${rel}  (${errors.length} errors)`); failed++; continue; }
  specs[id] = spec;
}

// ---- 2 + 3. build, QA, render (the same font handling as test-goldens.mts: the repo's own woff2, waited for)
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
const FONT_FILES = { 'manrope': 'manrope-latin-var.woff2', 'jetbrains-mono': 'jetbrains-mono-latin-var.woff2' };
const fontCss = p => `
@font-face{font-family:'Manrope';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Plus Jakarta Sans';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'JetBrains Mono';src:url('http://127.0.0.1:${p}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const font = url.startsWith('/__fonts/') && FONT_FILES[url.slice('/__fonts/'.length)];
  const fx = url.match(/^\/content\/houses\/([a-z0-9-]+)\.json$/);   // a fixture answers as a house
  const f = font ? path.join(ROOT, 'assets', 'fonts', font) : fx && specs[fx[1]] ? path.join(FIXTURES, `${fx[1]}.json`) : path.join(ROOT, url);
  if ((!font && !f.startsWith(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILES[PROFILE].args });

async function openHouse(id) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss(port) }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://localhost:${port}/room-creator.html?house=${id}&res=${RES}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
  const missing = await page.evaluate(async () => {
    const want = ['Manrope', 'Plus Jakarta Sans', 'JetBrains Mono'];
    await Promise.all(want.map(f => document.fonts.load(`16px "${f}"`).catch(() => {})));
    await document.fonts.ready;
    return want.filter(f => !document.fonts.check(`16px "${f}"`));
  });
  if (missing.length) throw new Error(`fonts never loaded: ${missing.join(', ')}`);
  await page.evaluate(r => { (window as any).__houseSupersample = 2; return (window as any).__houseComposerWarm({ res: r }); }, RES);
  return { ctx, page, errs };
}
const renderFrame = (page, shot, t) => page.evaluate(([shot, res, t]) => {
  const info = __houseRenderBegin({ shot, res, fps: 60 });
  const i = Math.round(t * (info.frames - 1));
  __houseRenderFrames(i, 1, 1.0);
  const gl = __houseDebug().renderer.getContext();
  const px = new Uint8Array(info.w * info.h * 4);
  gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  __houseRenderEnd();
  let s = ''; for (let k = 0; k < px.length; k += 8192) s += String.fromCharCode.apply(null, px.subarray(k, k + 8192));
  return { w: info.w, h: info.h, b64: btoa(s) };
}, [shot, RES, t]);

const hashFile = id => path.join(HASHES, `${id}.json`);
const stored = Object.assign({}, ...ids.map(id => fs.existsSync(hashFile(id)) ? JSON.parse(fs.readFileSync(hashFile(id), 'utf8')) : {}));
const hashes = { ...stored };
const recordedNow = {};   // key → hash, for --record
const rows = [];
const built = Object.keys(specs);
try {
  for (const id of built) {
    const spec = specs[id], fx = spec.fixture || {};
    const frames = fx.frames || DEFAULT_FRAMES;
    // the throwaway context: one frame of this very fixture through a cold pipeline, never kept
    try { const w = await openHouse(id); await renderFrame(w.page, 'orbit', 0.55); await w.ctx.close(); } catch { /* the load below reports it */ }
    let h;
    try { h = await openHouse(id); } catch (e) { console.log(`✗ ${id}  load: ${e.message.split('\n')[0]}`); failed++; continue; }
    const { page, ctx, errs } = h;
    let bad = 0;
    if (QA && fx.qa !== false) {
      const qa = await page.evaluate(shots => {
        const w = window as any, scene = w.__houseSceneQA();
        return { scene, shots: shots.map(s => w.__houseShotQA(s)) };
      }, Object.keys(frames));
      const list = [...qa.scene.errors.map(e => ['ERROR', 'scene', e]), ...qa.scene.warnings.map(e => ['warn ', 'scene', e]),
        ...qa.shots.flatMap(q => [...q.errors.map(e => ['ERROR', q.shot, e]), ...q.warnings.map(e => ['warn ', q.shot, e])])];
      for (const [lv, where, e] of list) console.log(`  ${lv} ${id} ${where}${e.t !== undefined ? ` t=${e.t}` : ''} ${e.code} — ${e.message}`);
      bad += list.filter(([lv]) => lv === 'ERROR').length;
    }
    for (const [shot, ts] of Object.entries(frames) as Array<[string, number[]]>) for (const t of ts) {
      const key = `${id}/${shot}@${t}`;
      const fr = await renderFrame(page, shot, t);
      const raw = Buffer.from(fr.b64, 'base64'), stride = fr.w * 4, px = Buffer.alloc(raw.length);
      for (let y = 0; y < fr.h; y++) raw.copy(px, y * stride, (fr.h - 1 - y) * stride, (fr.h - y) * stride);   // bottom-up → top-down
      const hash = crypto.createHash('sha256').update(px).digest('hex').slice(0, 16);
      fs.mkdirSync(path.join(OUT, id), { recursive: true });
      fs.writeFileSync(path.join(OUT, id, `${shot}@${String(t).replace('.', '_')}.png`), encodePNG(px, fr.w, fr.h));
      const was = stored[key], declared = ledger.entries.get(key);
      // a declared frame (the ledger): it must move, to exactly what a declaring stream recorded
      let state = UPDATE ? (was === hash ? 'unchanged' : was ? 'updated' : 'added') : !was ? 'no hash' : was === hash ? 'pass' : 'changed';
      if (!UPDATE && was && declared) {
        const mine = RECORD && declared.find(e => e.stream === RECORD);
        state = was === hash ? 'unmoved' : mine ? 'recorded' : declared.some(e => e.hash[PROFILE] === hash) ? 'expected'
          : declared.some(e => e.hash[PROFILE]) ? 'elsewhere' : 'unrecorded';
        if (state === 'recorded') recordedNow[key] = hash;
      }
      if (UPDATE) hashes[key] = hash;
      if (['no hash', 'changed', 'unmoved', 'unrecorded', 'elsewhere'].includes(state)) bad++;
      rows.push({ key, hash, state });
      const why = state === 'changed' ? ` (was ${was})` : state === 'unmoved' ? ` — declared (${causes(declared)}), but it matches its hash`
        : state === 'unrecorded' ? ` — declared (${causes(declared)}), its moved hash not recorded on ${PROFILE}: pnpm run fixtures --record ${streamFile(declared[0].stream)} --fixture ${id}`
        : state === 'elsewhere' ? ` — declared (${causes(declared)}), but it moved to something other than what was recorded` : state === 'expected' || state === 'recorded' ? ` (${causes(declared)})` : '';
      console.log(`  ${['pass', 'unchanged', 'expected', 'recorded'].includes(state) ? '✓' : UPDATE ? '~' : '✗'} ${key}  ${hash}  ${state}${why}`);
    }
    if (errs.length) { console.log(`  ERROR ${id}: page error — ${errs[0]}`); bad++; }
    console.log(`${bad ? '✗' : '✓'} ${id}${fx.note ? ` — ${fx.note}` : ''}`);
    if (bad) failed++;
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
if (UPDATE) {
  // each fixture run here gets its own file, holding exactly the frames it rendered
  fs.mkdirSync(HASHES, { recursive: true });
  for (const id of built) {
    const mine = Object.fromEntries(rows.filter(r => r.key.startsWith(`${id}/`)).map(r => [r.key, r.hash]).sort(([a], [b]) => a.localeCompare(b)));
    if (!Object.keys(mine).length) continue;
    fs.writeFileSync(hashFile(id), JSON.stringify(mine, null, 1) + '\n');
    console.log(`→ ${path.relative(process.cwd(), hashFile(id))}`);
  }
}
if (RECORD && Object.keys(recordedNow).length) {
  const data = { ...ledger.byStream.get(RECORD) };
  for (const [k, h] of Object.entries(recordedNow)) data[k] = { ...data[k], hash: { ...(data[k].hash || {}), [PROFILE]: h } };
  writeStreamLedger(ROOT, RECORD, data);
  console.log(`→ ${Object.keys(recordedNow).length} moved hash(es) recorded for ${RECORD} in ${path.relative(process.cwd(), path.join(ledgerDir(ROOT), streamFile(RECORD) + '.json'))}`);
}
console.log(`\n${ids.length} fixture(s), ${rows.length} frames → ${path.relative(process.cwd(), OUT)}: ${failed ? `${failed} failed` : 'all pass'}`);
if (!UPDATE && rows.some(r => r.state === 'no hash')) console.log('A fixture frame with no hash is not being checked: bless it with  pnpm run fixtures --update');
process.exit(failed ? 1 : 0);
