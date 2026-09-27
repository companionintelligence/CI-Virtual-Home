#!/usr/bin/env -S node --experimental-strip-types
// One catalog for every consumer. Builds every item type — the page's ITEMS and the registry's props — alone in
// headless Chromium, measures its box, and writes content/house-catalog.json:
//   { types: { <type>: { footprint: [w, d], height, surface, source: 'page'|'registry', params, tags, iso } } }
// house-builder's obstacle rule, the validator and generate_house_iso.py read it,
// so a prop's size is stated once (by its geometry) instead of copied by hand into six places.
//   pnpm run catalog      (node --experimental-strip-types scripts/build-prop-catalog.mts — any cwd)
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const ROOT = path.resolve(import.meta.dirname, '..');
const { PROPS } = await import(path.join(ROOT, 'assets', 'props', 'index.js'));
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise<void>(resolve => server.listen(0, () => resolve()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.goto(`http://localhost:${port}/room-creator.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__housePropSheet === 'function');
const measured: Record<string, any> = await page.evaluate(() => {
  // measure without rendering: build each type and take its box
  const hb = window.__houseBuilderRef; const out = {};
  const types = [...Object.keys(hb.ITEMS), ...hb.PROPS.keys()];
  for (const t of types) {
    try { const o = hb.buildProp(t, {}, { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' }); if (!o) continue; o.updateMatrixWorld(true); const b = new window.__THREE.Box3().setFromObject(o); out[t] = { box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(3)), source: hb.PROPS.has(t) ? 'registry' : 'page' }; }
    catch (e) { out[t] = { error: e.message }; }
  }
  return out;
});
await browser.close(); server.close();
const types = {};
for (const [t, m] of Object.entries(measured)) {
  if (m.error) { console.log(`✗ ${t}: ${m.error}`); continue; }
  const [x0, y0, z0, x1, y1, z1] = m.box; const def = PROPS.get(t);
  types[t] = { footprint: [+(x1 - x0).toFixed(2), +(z1 - z0).toFixed(2)], height: +(y1 - y0).toFixed(2), box: m.box, surface: !!(def && def.surface) || ['curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers'].includes(t), source: m.source, params: def ? def.params : [], tags: def ? def.tags : [], iso: def && def.iso ? def.iso : null };
}
const out = path.join(ROOT, 'content', 'house-catalog.json');
fs.writeFileSync(out, JSON.stringify({ generated: 'build-prop-catalog.mjs', types }, null, 1));
console.log(`${Object.keys(types).length} types → ${out}`);
