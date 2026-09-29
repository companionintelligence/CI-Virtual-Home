#!/usr/bin/env -S node --experimental-strip-types
// One catalog for every consumer. Builds every item type — the page's ITEMS and the registry's props — alone in
// headless Chromium, measures its box, and writes content/house-catalog.json:
//   { types: { <type>: { footprint: [w, d], height, box, meshes (the draw calls it costs), surface, source: 'page'|'registry', params, tags, iso, place } },
//     patterns: { rugs: […], art: […] } }
// house-builder's obstacle rule, the validator and generate_house_iso.py read it,
// so a prop's size is stated once (by its geometry) instead of copied by hand into six places. A registry prop's
// params / tags / surface / iso are its definition's (assets/props/*.ts); a page type's are assets/item-meta.ts's
// (item-map.ts's ITEM_PARAMS and SURFACE_ITEMS) — one shape either way. `place` is the type's placement metadata
// (assets/props/placement.ts, and props/page-place.ts for the page builders: what it backs onto, the clear floor it
// needs, what it faces, its group, programs, styles, roles — plan S3). It also writes content/house-styles.json, the
// composer's style bundles (assets/house-styles.ts) for every other consumer. S3 is the only branch that commits either
// file (plan §2.0).
//
// It also writes assets/props/measured.ts: each type's MEASURED box (x0, z0, x1, z1, y0, y1) and how that box grows with the
// params that size it (`fit`: w, d, l, r, h, probed at two values and stated as slope and offset per axis, with the edge that stays
// put), so the composer's sizeOf() is the built geometry's own box — a bed whose headboard is 0.24 m wider than its `w`, a plant
// whose leaves stand off its origin — and not a declared footprint that drifts from it.
//   pnpm run catalog      (node --experimental-strip-types scripts/build-prop-catalog.mts — any cwd)
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const ROOT = path.resolve(import.meta.dirname, '..');
const { PROPS } = await import(path.join(ROOT, 'assets', 'props', 'index.js'));
const { pageItemDef } = await import(path.join(ROOT, 'assets', 'item-meta.js'));
const { ITEM_PARAMS } = await import(path.join(ROOT, 'assets', 'item-map.js'));
const { PLACEMENT } = await import(path.join(ROOT, 'assets', 'props', 'placement.js'));
const { RUG_PATTERNS, ART_MOTIFS } = await import(path.join(ROOT, 'assets', 'props', 'patterns.js'));
const { STYLES } = await import(path.join(ROOT, 'assets', 'house-styles.js'));
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
// the spec keys each type honours (a registry prop's params, a page builder's ITEM_PARAMS): which of w, d, l, r, h to probe
const paramMap: Record<string, string[]> = {};
for (const [t, ps] of Object.entries(ITEM_PARAMS)) paramMap[t] = [...(ps as string[])];
for (const [t, d] of PROPS as Map<string, any>) paramMap[t] = [...(d.params || [])];
const foliage = Object.keys(paramMap).filter(t => (PLACEMENT[t] && PLACEMENT[t].group === 'plant') || (PROPS.get(t) && PROPS.get(t).foliage));
const measured: Record<string, any> = await page.evaluate(({ paramMap, foliage }) => {
  // measure without rendering: build each type and take its box
  const hb = window.__houseBuilderRef; const out = {};
  const types = [...Object.keys(hb.ITEMS), ...hb.PROPS.keys()];
  for (const t of types) {
    try {
      const pal = { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' };
      const boxOf = (params) => { const o = hb.buildProp(t, params, pal); if (!o) return null; o.updateMatrixWorld(true); return new window.__THREE.Box3().setFromObject(o); };
      const b = boxOf({}); if (!b) continue;
      // (a plant's leaves lean a different way in every one, seeded per item: its box is the union over a dozen seeds, or a lean the sample
      // did not have would stand in a wall)
      if (foliage.includes(t)) for (const sd of 'abcdefghijkl') { const o = hb.buildProp(t, {}, pal, sd); if (!o) continue; o.updateMatrixWorld(true); b.union(new window.__THREE.Box3().setFromObject(o)); }
      let meshes = 0; { const o = hb.buildProp(t, {}, pal); o.traverse(m => { if (m.isMesh) meshes++; }); }
      out[t] = { box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(3)), meshes, source: hb.PROPS.has(t) ? 'registry' : 'page' };
      // how the box grows with each param that sizes it: probed at three values round the box's own extent (a builder clamps a
      // width it thinks too small, so a fixed 0.9 m says nothing about a 3 m sofa), per axis a line (slope, offset) and which edge
      // holds; an axis whose middle probe is not on the line between the outer two is left alone (it is not linear there)
      const params = paramMap[t] || [];
      const fit = {};
      const AX = { x: [0, 3], y: [1, 4], z: [2, 5] }, ext0 = { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
      for (const k of ['w', 'd', 'l', 'r', 'h']) {
        if (!params.includes(k)) continue;
        const c = k === 'w' ? ext0.x : k === 'r' ? ext0.x / 2 : k === 'h' ? ext0.y : ext0.z;
        if (!(c >= 0.1)) continue;
        const vs = [0.75, 1, 1.35].map(m => Math.round(c * m * 100) / 100);
        let bs; try { bs = vs.map(v => boxOf({ [k]: v })); } catch (e) { continue; }
        if (bs.some(x => !x)) continue;
        const A = bs.map(x => x.min.toArray().concat(x.max.toArray())), f = {};
        for (const [ax, [i0, i1]] of Object.entries(AX)) {
          const e = A.map(a => a[i1] - a[i0]), s = (e[2] - e[0]) / (vs[2] - vs[0]);
          if (Math.abs(s) < 0.15) continue;
          if (Math.abs(e[1] - (e[0] + s * (vs[1] - vs[0]))) > 0.02) continue;
          const off = e[0] - s * vs[0], mid = A.map(a => (a[i0] + a[i1]) / 2);
          const anchor = Math.abs(mid[2] - mid[0]) < 0.02 ? 'mid' : Math.abs(A[2][i0] - A[0][i0]) < 0.02 ? 'min' : Math.abs(A[2][i1] - A[0][i1]) < 0.02 ? 'max' : 'mid';
          f[ax] = [+s.toFixed(3), +off.toFixed(3), anchor];
        }
        if (Object.keys(f).length) fit[k] = f;
      }
      if (Object.keys(fit).length) out[t].fit = fit;
    }
    catch (e) { out[t] = { error: e.message }; }
  }
  return out;
}, { paramMap, foliage });
await browser.close(); server.close();
const types = {};
for (const [t, m] of Object.entries(measured)) {
  if (m.error) { console.log(`✗ ${t}: ${m.error}`); continue; }
  const [x0, y0, z0, x1, y1, z1] = m.box; const def = m.source === 'registry' ? PROPS.get(t) : pageItemDef(t);
  const pl = PLACEMENT[t] || null, place = pl ? (({ size, params, ...rest }) => rest)(pl) : null;
  types[t] = { footprint: [+(x1 - x0).toFixed(2), +(z1 - z0).toFixed(2)], height: +(y1 - y0).toFixed(2), box: m.box, meshes: m.meshes, surface: !!(def && def.surface), source: m.source, params: def ? def.params : [], tags: def ? def.tags : [], iso: def && def.iso ? def.iso : null, place };
}
const out = path.join(ROOT, 'content', 'house-catalog.json');
fs.writeFileSync(out, JSON.stringify({ generated: 'build-prop-catalog.mjs', types, patterns: { rugs: RUG_PATTERNS, art: ART_MOTIFS } }, null, 1));
console.log(`${Object.keys(types).length} types → ${out}`);
// the composer's measured sizes (assets/props/measured.ts): generated with the catalog, so the two cannot disagree
{
  const rows: string[] = [];
  for (const t of Object.keys(types).sort()) {
    const m = measured[t]; let [x0, y0, z0, x1, y1, z1] = m.box;
    // foliage leans a different way in every plant (its leaves are seeded per item): the box is the widest reach either side, about
    // the origin, so a plant never stands in a wall or a neighbour by the lean it happened to get
    if ((PLACEMENT[t] && PLACEMENT[t].group === 'plant') || (PROPS.get(t) && PROPS.get(t).foliage)) { const hx = Math.max(Math.abs(x0), Math.abs(x1)), hz = Math.max(Math.abs(z0), Math.abs(z1)); x0 = -hx; x1 = hx; z0 = -hz; z1 = hz; }
    rows.push(`  ${JSON.stringify(t)}: { b: [${+x0.toFixed(3)}, ${+z0.toFixed(3)}, ${+x1.toFixed(3)}, ${+z1.toFixed(3)}], y: [${y0}, ${y1}]${m.fit ? `, fit: ${JSON.stringify(m.fit)}` : ''} },`);
  }
  const ts = `// GENERATED by scripts/build-prop-catalog.mts (pnpm run catalog) — do not edit.
// The measured box of every item type built alone with its default params — b: [x0, z0, x1, z1] and y: [y0, y1] in the item's own frame
// (metres, +z its front) — and how it grows with the params that size it: fit[param][axis] = [slope, offset, the edge that holds],
// so a box at a given param is slope × value + offset along that axis. assets/room-geo.ts sizeOf() reads this before any declared footprint.
export type Fit = Record<string, Partial<Record<'x' | 'y' | 'z', [number, number, 'mid' | 'min' | 'max']>>>;
export interface Measured { b: [number, number, number, number]; y: [number, number]; fit?: Fit }
export const MEASURED: Record<string, Measured> = {
${rows.join('\n')}
};
`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'props', 'measured.ts'), ts);
  console.log(`${rows.length} measured boxes → assets/props/measured.ts`);
}
const stylesOut = path.join(ROOT, 'content', 'house-styles.json');
fs.writeFileSync(stylesOut, JSON.stringify({ generated: 'build-prop-catalog.mts from assets/house-styles.ts', styles: STYLES }, null, 1) + '\n');
console.log(`${Object.keys(STYLES).length} style bundles → ${stylesOut}`);
