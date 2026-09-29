#!/usr/bin/env -S node --experimental-strip-types
// The site's geometry, probed where it was once wrong: small specs on the harness's house, built in the page as a house is,
// each asked one question by a ray or a bounding box — the questions two reviewers found the builder answering badly:
//   nest         a terrace only partly over a lower one has its wall down to the ground where it overhangs
//   skip         a terrace's rail runs along the part of its edge the house does not cover
//   rot-car      a rotated car's recorded solid is the car's own box (turned), not the box round the turned car
//   canal        a canal round a corner: the quay of one side does not run on across the water of the other
//   street-water water on the street's own side lies across the street, not under the road
//   hill         a hillside's neighbours stand on their pads: their floors within 15 cm of the ground at every corner
//   pool         water raised or set into a terrace cuts the lot and the terrace: the ray finds the pool's floor
//   steps        a flight that overruns a terrace stands under its top; a steps { n } on a terraced lot keeps its n
//   paths        two overlapping paths of two surfaces stand at different heights
//   wall         a garden wall's outer corner is closed
//   solids       a terrace's solid carries x, z, w, d, rot (and no retaining wall where the ground is a bank)
//   sunken       a terrace with no height above the ground is refused by the validator
//   node --experimental-strip-types scripts/test-site-geometry.mts [--case nest,hill]    (any cwd; run `pnpm run build` first)
// Exit 0 when every case holds; 1 otherwise; 2 on a harness error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { validate } from './validate-house-spec.mts';

const args: Record<string, string> = Object.fromEntries(process.argv.slice(2).reduce((a: string[][], x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('-') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's0-seams.json'), 'utf8'));   // a plain house: x −5…5, z −4…4, entry S
const FOOT = [[-14, -14], [-3, -14], [-3, -6], [-14, -6]];   // a terrace behind the house's west half

type Case = { id: string; lot?: any; site: any[]; probe?: string; expect?: (r: any) => string | null; validate?: (errors: string[]) => string | null };
// (the probe runs in the page with `ray`, `scene`, `T` (three), `spec`, `anchors` in scope and returns what `expect` judges)
const RAY = `
  const d = __houseDebug(), scene = d.scene, T = window.__THREE, spec = d.house.spec, anchors = d.house.anchors;
  scene.updateMatrixWorld(true);
  const meshes = []; scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh) return; for (let p = o; p; p = p.parent) if (p.visible === false) return; meshes.push(o); });
  const RC = new T.Raycaster();
  const nameOf = o => { const parts = []; for (let p = o; p && p !== scene; p = p.parent) if (p.name) parts.push(p.name); return parts.join(' / '); };
  const ray = (ox, oy, oz, dx, dy, dz, n = 3) => { RC.set(new T.Vector3(ox, oy, oz), new T.Vector3(dx, dy, dz).normalize()); return RC.intersectObjects(meshes, false).slice(0, n).map(h => ({ name: nameOf(h.object), x: +h.point.x.toFixed(3), y: +h.point.y.toFixed(3), z: +h.point.z.toFixed(3), dist: +h.distance.toFixed(3) })); };
  const down = (x, z, n = 3) => ray(x, 200, z, 0, -1, 0, n);
  const boxOf = o => new T.Box3().setFromObject(o);
`;
const CASES: Case[] = [
  { id: 'nest', lot: { w: 34, d: 30, ground: 'lawn' },
    site: [{ type: 'terrace', id: 'A', poly: FOOT, y: 0.9, edge: { kind: 'retaining', material: 'stone' } }, { type: 'terrace', id: 'B', poly: [[-9, -12], [2, -12], [2, -8], [-9, -8]], y: 1.8, edge: { kind: 'retaining', material: 'stone' } }],
    // B stands 5 m past A's east edge: a ray at 0.45 m, from the east, along z = −10, meets B's east wall (x = 2), not A's (x = −3)
    probe: `return { hit: ray(8, 0.45, -10, -1, 0, 0, 1)[0] };`,
    expect: r => (r.hit && /Terrace/.test(r.hit.name) && r.hit.x > 1.9 ? null : `the ray at 0.45 m from the east meets ${r.hit ? r.hit.name + ' at x ' + r.hit.x : 'nothing'} (B's wall at x = 2 stops at A's top, hanging over the lot)`) },
  { id: 'skip', lot: { w: 34, d: 30, ground: 'lawn' },
    site: [{ type: 'terrace', poly: [[-14, -4], [10, -4], [10, -14], [-14, -14]], y: 0.9, edge: { kind: 'rail', material: 'stone', rail: 'glass' } }],
    // the terrace's south edge runs along the house (x −5…5) and past it either side: the rail is there past the house
    probe: `return { west: ray(-9, 1.5, 3, 0, 0, -1, 1)[0], east: ray(8, 1.5, 3, 0, 0, -1, 1)[0] };`,
    expect: r => (r.west && /Glass/.test(r.west.name) && r.west.z > -4.6 && r.east && /Glass/.test(r.east.name) && r.east.z > -4.6 ? null : `no glass rail along the south edge (z −4) past the house (west ${r.west ? r.west.name + ' at z ' + r.west.z : 'nothing'}, east ${r.east ? r.east.name + ' at z ' + r.east.z : 'nothing'})`) },
  { id: 'rot-car', site: [{ type: 'car', at: [-8, 8], rot: 90 }],
    probe: `
      const sol = (anchors.siteSolids || []).find(s => s.kind === 'car'); if (!sol) return { none: true };
      let mesh = null; scene.children.forEach(o => { if (!o.userData || o.userData.category !== 'Site') return; const b = boxOf(o); if (b.isEmpty()) return; const c = b.getCenter(new T.Vector3()); if (Math.hypot(c.x + 8, c.z - 8) < 0.7 && b.max.x - b.min.x < 10) mesh = b; });
      const a = sol.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), hx = c * sol.w / 2 + s * sol.d / 2, hz = s * sol.w / 2 + c * sol.d / 2;
      return { solid: [sol.x - hx, sol.z - hz, sol.x + hx, sol.z + hz].map(v => +v.toFixed(2)), mesh: mesh ? [mesh.min.x, mesh.min.z, mesh.max.x, mesh.max.z].map(v => +v.toFixed(2)) : null };`,
    expect: r => (r.none || !r.mesh ? 'no car solid or mesh found' : r.solid.every((v: number, i: number) => Math.abs(v - r.mesh[i]) < 0.08) ? null : `the solid covers ${JSON.stringify(r.solid)} but the car ${JSON.stringify(r.mesh)}`) },
  { id: 'canal', lot: { w: 30, d: 26, ground: 'lawn', water: { kind: 'canal', sides: ['N', 'W'], edge: 'wall', farBank: 'none' } }, site: [],
    // x = −15.5 is the west bank; z = −19 is inside the north canal's water: what is there is water, not the west quay
    probe: `return { hit: down(-15.5, -19, 1)[0], hit2: down(-19, -13.5, 1)[0] };`,
    expect: r => (r.hit && /canal/.test(r.hit.name) && r.hit2 && /canal/.test(r.hit2.name) ? null : `over the other side's water the ground is ${r.hit ? r.hit.name : 'nothing'} / ${r.hit2 ? r.hit2.name : 'nothing'} (a quay across the water)`) },
  { id: 'street-water', lot: { w: 30, d: 30, ground: 'lawn', water: { kind: 'river', sides: ['S'], width: 20, edge: 'bank' } }, site: [],
    probe: `
      let info = null; scene.traverse(o => { if (o.userData && o.userData.worldInfo) info = o.userData.worldInfo; });
      const st = info.street, mid = (st.zLot + st.zFar) / 2;
      return { under: down(0, mid, 8).map(h => h.name), beyond: down(0, st.zFar + 3, 1)[0], zFar: st.zFar };`,
    expect: r => (r.under.length && !r.under.some((n: string) => /river|floor|bank/.test(n)) && r.beyond && /river/.test(r.beyond.name) ? null : `across the street: under the road ${JSON.stringify(r.under)}, beyond it ${r.beyond ? r.beyond.name : 'nothing'} (the river runs under the road)`) },
  { id: 'hill', lot: { w: 30, d: 24, ground: 'lawn', context: 'hillside' }, site: [],
    probe: `
      const ground = []; let plinth = null;
      scene.traverse(o => { if (!o.isMesh) return; if (o.name === 'World · hill' || o.name === 'World · ground') ground.push(o); if (o.name === 'World · plinth') plinth = o; });
      const gy = (x, z) => { RC.set(new T.Vector3(x, 300, z), new T.Vector3(0, -1, 0)); const h = RC.intersectObjects(ground, false); return h.length ? h[0].point.y : null; };
      const out = []; if (plinth) { const p = plinth.geometry.attributes.position, w = new T.Vector3();
        for (let b = 0; b + 36 <= p.count; b += 36) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, z0 = 1e9, z1 = -1e9; for (let i = b; i < b + 36; i++) { w.fromBufferAttribute(p, i).applyMatrix4(plinth.matrixWorld); x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z); }
          const cs = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => gy(x, z)); if (cs.some(v => v === null)) continue;
          out.push({ x: +((x0 + x1) / 2).toFixed(1), z: +((z0 + z1) / 2).toFixed(1), off: +Math.max(y0 - Math.min(...cs), Math.max(...cs) - y0).toFixed(2) }); } }
      return { plinth: !!plinth, houses: out };`,
    expect: r => (!r.plinth || !r.houses.length ? 'no neighbour plinths found' : r.houses.every((h: any) => h.off <= 0.15) ? null : `neighbours off the ground: ${r.houses.filter((h: any) => h.off > 0.15).map((h: any) => `(${h.x}, ${h.z}) by ${h.off} m`).join(', ')}`) },
  { id: 'pool', lot: { w: 34, d: 30, ground: 'lawn' },
    site: [{ type: 'pool', shape: 'kidney', at: [8, 9], w: 6, d: 3.5, y: 0.25 }, { type: 'terrace', poly: FOOT, y: 0.9, edge: 'retaining' }, { type: 'pool', shape: 'rect', at: [-8.5, -10], w: 5, d: 2.5, coping: { w: 0.3 } }],
    // a raised pool's floor is found under the lot's plane; a pool set into a terrace has its floor, not the terrace's grass, under it
    probe: `const dry = (x, z) => down(x, z, 4).find(h => !/^Water/.test(h.name)); return { raised: dry(8, 9), terrace: dry(-8.5, -10) };`,
    expect: r => (r.raised && /Pool floor/.test(r.raised.name) && r.raised.y < -1 && r.terrace && /Pool floor/.test(r.terrace.name) && r.terrace.y < 0 ? null : `first hits: raised pool ${r.raised ? r.raised.name + ' ' + r.raised.y : 'nothing'}, pool in the terrace ${r.terrace ? r.terrace.name + ' ' + r.terrace.y : 'nothing'}`) },
  { id: 'steps', lot: { w: 34, d: 30, ground: 'lawn' },
    site: [{ type: 'terrace', poly: FOOT, y: 0.9, edge: 'retaining' }, { type: 'steps', at: [-8.5, -4.9], w: 1.6 }, { type: 'steps', at: [10, 8], w: 1.2, n: 12 }],
    probe: `
      const groups = []; scene.traverse(o => { if (o.name === 'Steps' && o.children.length) groups.push(o); });
      const climbing = groups.find(g => Math.abs(g.parent.position.x + 8.5) < 0.1 || Math.abs(boxOf(g).getCenter(new T.Vector3()).x + 8.5) < 0.8), flat = groups.find(g => Math.abs(boxOf(g).getCenter(new T.Vector3()).x - 10) < 1);
      return { top: climbing ? +boxOf(climbing).max.y.toFixed(3) : null, n: flat ? flat.children.length : null };`,
    expect: r => (r.top !== null && r.top <= 0.9 - 0.004 && r.n === 12 ? null : `the climbing flight's top is ${r.top} (must stand under the terrace's 0.9); the plain flight has ${r.n} treads (n = 12)`) },
  { id: 'paths', site: [{ type: 'path', path: [[0, 6], [0, 12]], w: 1.4, surface: 'brick', smooth: true }, { type: 'path', path: [[0, 6], [0, 12]], w: 1.4, surface: 'concrete', smooth: true }],
    probe: `
      const tops = {}; scene.traverse(o => { if (o.isMesh && o.name === 'Path surface') { const k = nameOf(o).match(/Path \\((\\w+)\\)/); if (k) tops[k[1]] = +boxOf(o).max.y.toFixed(4); } });
      return tops;`,
    expect: r => (typeof r.brick === 'number' && typeof r.concrete === 'number' && r.concrete - r.brick >= 0.003 ? null : `the paths' tops are ${JSON.stringify(r)} (the later must stand 4 mm higher)`) },
  { id: 'wall', site: [{ type: 'wall-low', path: [[-6, 8], [0, 8], [0, 12]], t: 0.3, h: 0.6, surface: 'stone' }],
    // the outer corner of the bend (0.15 east, 0.15 north of the vertex) is under wall, not the notch two runs leave
    probe: `return { corner: down(0.13, 7.87, 1)[0] };`,
    expect: r => (r.corner && /wall/i.test(r.corner.name) && r.corner.y > 0.5 ? null : `the outer corner of the bend is ${r.corner ? r.corner.name + ' at y ' + r.corner.y : 'open'}`) },
  { id: 'solids', site: [{ type: 'terrace', poly: [[-14, -14], [-6, -14], [-6, -8], [-14, -8]], y: 0.7, edge: 'slope' }, { type: 'terrace', poly: [[6, -14], [12, -14], [12, -8], [6, -8]], y: 0.7, edge: 'retaining' }],
    probe: `return { solids: (anchors.siteSolids || []).filter(s => s.kind === 'terrace' || s.kind === 'retaining').map(s => ({ kind: s.kind, site: s.site, x: s.x, z: s.z, w: s.w, d: s.d, rot: s.rot, bank: s.bank })) };`,
    expect: r => {
      const t = r.solids.filter((s: any) => s.kind === 'terrace'), ret = r.solids.filter((s: any) => s.kind === 'retaining');
      if (t.length !== 2 || t.some((s: any) => ![s.x, s.z, s.w, s.d, s.rot].every((v: any) => typeof v === 'number'))) return `a terrace solid lacks x, z, w, d or rot: ${JSON.stringify(t)}`;
      if (!(t.find((s: any) => s.site === 0).bank > 0)) return 'a sloped terrace does not record its bank';
      if (ret.some((s: any) => s.site === 0)) return 'a sloped terrace has retaining walls where the ground is a bank';
      return ret.some((s: any) => s.site === 1) ? null : 'a retaining terrace has no retaining solid';
    } },
  { id: 'sunken', site: [{ type: 'terrace', poly: FOOT, y: -0.6 }], validate: errs => (errs.some(e => /terrace/.test(e)) ? null : 'a terrace below the ground validates') },
];

const only = args.case ? new Set(args.case.split(',')) : null;
const cases = CASES.filter(c => !only || only.has(c.id));
const specs = new Map<string, any>(cases.map(c => { const s = JSON.parse(JSON.stringify(BASE)); s.id = `sg-${c.id}`; delete s.fixture; if (c.lot) s.lot = c.lot; s.site = c.site; return [s.id, s]; }));
let fails = 0;
const say = (ok: boolean, id: string, msg: string) => { console.log(`  ${ok ? '✓' : '✗'} ${id}${msg ? ` — ${msg}` : ''}`); if (!ok) fails++; };

// ---- the validator cases need no page
for (const c of cases.filter(c => c.validate)) { const { errors } = validate(specs.get(`sg-${c.id}`), `sg-${c.id}.json`); const why = c.validate!(errors.map((e: any) => (typeof e === 'string' ? e : e.message))); say(!why, c.id, why || 'refused'); }

// ---- the rest: built in the page and probed
const pageCases = cases.filter(c => c.probe);
if (pageCases.length) {
  async function loadPlaywright() {
    try { return await import('playwright'); } catch {}
    const { pathToFileURL } = await import('node:url');
    const candidates: string[] = [];
    if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
    const npx = path.join(os.homedir(), '.npm', '_npx');
    if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
    for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
    console.error('playwright is not resolvable'); process.exit(2);
  }
  const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.hdr': 'application/octet-stream' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url!, 'http://x').pathname), m = /^\/content\/houses\/(sg-[a-z0-9-]+)\.json$/.exec(u);
    if (m && specs.has(m[1])) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(specs.get(m[1]))); }
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise<void>(r => server.listen(0, () => r()));
  const port = (server.address() as import('node:net').AddressInfo).port;
  const pw = await loadPlaywright();
  const PROFILE_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
  const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILE_ARGS });
  for (const c of pageCases) {
    const id = `sg-${c.id}`, ctx = await browser.newContext({ viewport: { width: 800, height: 500 } }), page = await ctx.newPage(), errs: string[] = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.route('https://fonts.googleapis.com/**', rt => rt.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', rt => rt.abort());
    try {
      await page.goto(`http://localhost:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
      const result = await page.evaluate(`(async () => { ${RAY} ${c.probe} })()`);
      const why = errs.length ? `page error: ${errs[0]}` : c.expect!(result);
      say(!why, c.id, why || '');
    } catch (e) { say(false, c.id, `did not run: ${String(e).split('\n')[0]}`); }
    await ctx.close();
  }
  await browser.close(); server.close();
}
console.log(fails ? `\n${fails} of ${cases.length} geometry cases failed` : `\n✓ ${cases.length} geometry cases hold`);
process.exit(fails ? 1 : 0);
