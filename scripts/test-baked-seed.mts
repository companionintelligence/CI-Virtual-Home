#!/usr/bin/env -S node --experimental-strip-types
// Neutrality of the baked layer, measured in the page (BAKE stream; PLAN 5.4 acceptance). The layer is installed on every page load (assets/props/baked.ts is
// the last import of the registry), so before anything is switched on it must change NOTHING:
//
//   1. default switches == ?baked=0   the scene graph is identical (every placed item: type, order, world matrix, mesh count, every material colour,
//                                     every geometry's vertex count and box) and so are the pixels of two frames, in 6 houses (pixels in 2).
//                                     No house references a type the baked layer adds, and the one replace model (nightstand-a) is disabled.
//   2. ?baked=all, in place           with the replace model forced on, the ONLY objects that differ are the nightstands: every other item has the
//                                     same order, matrix and colours. That is the seed proof: a nightstand's rng stream is the Nth registry prop
//                                     of the house whether it draws from it or not, so replacing a type in place moved no other prop's stream.
//   3. no fallbacks                   window.__bakedFallbacks stays 0 in every mode.
//
// @check-house — runs in the gate after the goldens (about a minute: a page load a mode and a house)
//
//   node --experimental-strip-types scripts/test-baked-seed.mts [--houses aurora,cutestarter,...] [--pixels aurora,cutestarter] [--res 360]
// Exit 0 when every comparison holds.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((a: any[], x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const HOUSES = (args.houses || 'aurora,cutestarter,seraphine,riverbend,mediterranean,lakecabin').split(',');
const PIXELS = (args.pixels || 'aurora,cutestarter').split(',');
const RES = args.res || '360', FRAMES = [0, 330];
const ROOT = path.resolve(import.meta.dirname, '..');
const PROFILE = { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] };

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  const { pathToFileURL } = await import('node:url'); const os = await import('node:os');
  const cands: string[] = []; if (process.env.PLAYWRIGHT_MODULE) cands.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) cands.push(p); }
  for (const c of cands) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch { /* next */ } }
  console.error('playwright is not resolvable'); process.exit(2);
}
// the repo's own faces (a run that raced Google Fonts differently is a different picture), as test-frame-hash.mts does
const FONT_FILES: Record<string, string> = { manrope: 'manrope-latin-var.woff2', 'jetbrains-mono': 'jetbrains-mono-latin-var.woff2' };
const fontCss = (p: number) => `@font-face{font-family:'Manrope';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Plus Jakarta Sans';src:url('http://127.0.0.1:${p}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'JetBrains Mono';src:url('http://127.0.0.1:${p}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
  const font = url.startsWith('/__fonts/') && FONT_FILES[url.slice('/__fonts/'.length)];
  const f = font ? path.join(ROOT, 'assets', 'fonts', font) : path.join(ROOT, url);
  if ((!font && !f.startsWith(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILE.args });

interface Snap { items: any[]; fallbacks: number; px: Buffer[] }
/** One house in one mode: the placed items' signature (and, when asked, two frames' pixels). */
async function snap(house: string, mode: string, pixels: boolean): Promise<Snap> {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss(port) }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${port}/room-creator.html?house=${house}&shot=door-to-core&baked=${mode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, house);
  const items = await page.evaluate(() => {
    const r = (v: number) => Math.round(v * 1e5) / 1e5, out: any[] = [];
    (window as any).__houseDebug().scene.traverse((o: any) => {
      if (!o.userData || !o.userData.itemType) return;
      o.updateMatrixWorld(true);
      const meshes: any[] = []; o.traverse((m: any) => { if (m.isMesh) { const g = m.geometry; g.computeBoundingBox(); const b = g.boundingBox; meshes.push([m.material && m.material.color ? m.material.color.getHex() : -1, g.attributes.position.count, [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(r), m.name]); } });
      out.push({ type: o.userData.itemType, room: o.userData.room, m: o.matrixWorld.elements.map(r), baked: o.children.some((c: any) => c.userData && c.userData.bakedId) || !!o.userData.bakedId, meshes });
    });
    return out;
  });
  let px: Buffer[] = [];
  if (pixels) {
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.evaluate(r => (window as any).__houseComposerWarm({ res: r }), RES);
    const b64 = await page.evaluate(([shot, res, frames]: any) => {
      const w: any = window, r = w.__houseRenderBegin({ shot, res, fps: 60 }), gl = w.__houseDebug().renderer.getContext();
      const out = frames.map((i: number) => { w.__houseRenderFrames(Math.min(i, r.frames - 1), 1, 1.0); const p = new Uint8Array(r.w * r.h * 4); gl.readPixels(0, 0, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, p); let s = ''; for (let k = 0; k < p.length; k += 0x8000) s += String.fromCharCode(...p.subarray(k, k + 0x8000)); return btoa(s); });
      w.__houseRenderEnd(); return out;
    }, ['door-to-core', RES, FRAMES]);
    px = b64.map((s: string) => Buffer.from(s, 'base64'));
  }
  const fallbacks = await page.evaluate(() => (window as any).__bakedFallbacks || 0);
  await ctx.close();
  if (errors.length) throw new Error(`${house} ?baked=${mode}: page errors: ${errors.join('; ')}`);
  return { items, fallbacks, px };
}

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : ` — ${detail}`}`); if (!ok) failed++; };
const sig = (items: any[]) => items.map(i => JSON.stringify([i.type, i.room, i.m, i.meshes]));
const pxDiff = (A: Buffer, B: Buffer) => { let n = 0, max = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d) { n++; if (d > max) max = d; } } return { n, max, ratio: n / (A.length / 4) }; };

// the first context on a cold browser renders a hair differently (test-frame-hash.mts measured it): one throwaway before anything is compared
await snap(PIXELS[0] || HOUSES[0], '1', true);
let nightstandHouses = 0;
for (const house of HOUSES) {
  const px = PIXELS.includes(house);
  const off = await snap(house, '0', px), def = await snap(house, '1', px), all = await snap(house, 'all', false);
  console.log(`${house}: ${def.items.length} placed items`);
  const a = sig(off.items), b = sig(def.items);
  check(a.length === b.length && a.every((s, i) => s === b[i]), 'default switches build the scene graph of ?baked=0 (type, order, matrix, colours, geometry)', `${a.length} vs ${b.length} items; first difference at ${a.findIndex((s, i) => s !== b[i])}`);
  if (px) FRAMES.forEach((f, i) => { const d = pxDiff(off.px[i], def.px[i]); check(d.n === 0 || (d.max <= 8 && d.ratio <= 0.0001), `pixels of frame ${f} at ${RES}p equal ?baked=0`, `${d.n} px differ (max ${d.max}, ${(d.ratio * 100).toFixed(4)} %)`); });
  check(def.items.every(i => !i.baked) || def.items.filter(i => i.baked).every(i => i.type === 'cardboard-box' || i.type === 'medicine-cabinet'), 'no item is baked by default except the (unreferenced) types the layer adds');
  // ?baked=all: the nightstand is replaced in place, nothing else may move
  const N = (i: any) => i.type === 'nightstand';
  const aOther = sig(def.items.filter(i => !N(i))), bOther = sig(all.items.filter(i => !N(i)));
  const nDef = def.items.filter(N).length, nAll = all.items.filter(N);
  nightstandHouses += nDef ? 1 : 0;
  check(def.items.length === all.items.length && nDef === nAll.length, '?baked=all keeps the item count and the nightstand count', `${def.items.length}/${nDef} vs ${all.items.length}/${nAll.length}`);
  check(aOther.length === bOther.length && aOther.every((s, i) => s === bOther[i]), `?baked=all: every item that is not a nightstand is identical (order, matrix, colours): ${aOther.length} items, ${nDef} nightstand${nDef === 1 ? '' : 's'} replaced`, `first difference at ${aOther.findIndex((s, i) => s !== bOther[i])}`);
  check(nAll.every(i => i.baked) && def.items.filter(N).every(i => !i.baked), 'the replaced nightstands are the baked ones');
  check(off.fallbacks === 0 && def.fallbacks === 0 && all.fallbacks === 0, '__bakedFallbacks is 0 in every mode', `${off.fallbacks}/${def.fallbacks}/${all.fallbacks}`);
}
check(nightstandHouses >= 2, `the seed proof had nightstands to replace (${nightstandHouses} of ${HOUSES.length} houses)`);
await browser.close(); server.close();
console.log(failed ? `${failed} check(s) failed` : 'the baked layer is neutral: default = ?baked=0, and an in-place replacement moves nothing else');
process.exit(failed ? 1 : 0);
