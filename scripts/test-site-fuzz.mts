#!/usr/bin/env -S node --experimental-strip-types
// The site builder against specs nobody wrote by hand: seeded random lots (a context, water on some sides, a ground, a
// street) carrying random site items of every type — plantings of every kind and mix, terraces, decks, pools, fences,
// stairs, paths, props — dropped over a real house's massing, wherever they land (over the house, off the lot, on each
// other). Each is built in the page exactly as a house is, and must:
//   · validate without an error (the validator plugin's lints are warnings, and expected on such specs)
//   · build with no page error, no item dropped (anchors.siteDropped), and no scene-QA error
//   · leave no NaN or Infinity in its instances, solids, edges or geometry
//   · build the same twice: the site instances and solids of a fresh page are identical
// The specs are a pure function of the seed (mulberry32), so a failure names a seed that fails the same way every run.
//
//   node --experimental-strip-types scripts/test-site-fuzz.mts [--n 12] [--seed 100] [--rerun 3] [--keep <dir>]    (any cwd)
//   --keep writes each spec to <dir>/fuzz-<seed>.json (a failing one is always kept in test/qa/site-fuzz/)
// Exit 0 when every spec passes, 1 otherwise, 2 on a harness error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { validate } from './validate-house-spec.mts';

const args: Record<string, string> = Object.fromEntries(process.argv.slice(2).reduce((a: string[][], x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses');
const N = Math.max(1, +(args.n || 12)), SEED0 = +(args.seed || 100), RERUN = Math.min(N, +(args.rerun ?? 3));
const FAIL_DIR = path.join(ROOT, 'test', 'qa', 'site-fuzz');

const mulberry = (a: number) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BASES = ['vanilla', 'onestory', 'mediterranean', 'familyhome', 'cocoon', 'starter18k', 'lakecabin', 'modernhouse1'];
const SPECIES = ['round', 'oval', 'conical', 'broad', 'birch', 'maple', 'cypress', 'willow', 'cherry', 'olive', 'fan-palm', 'shade', 'layered'];
const FORMS = ['hydrangea', 'fern', 'topiary-ball', 'topiary-cone', 'agave', 'yucca', 'boxwood', 'grass', 'flowering', 'mound', 'spreading', 'columnar', 'rosemary', 'hosta', 'broadleaf', 'succulent', 'cactus', 'groundcover', 'silver', 'sedum'];
const MIX = ['cottage', 'modern', 'mediterranean', 'desert', 'woodland', 'tropical', 'formal', 'meadow'];
const PROPS = ['patio-set', 'lounger-set', 'hammock', 'bbq-grill', 'fire-bowl', 'outdoor-sofa', 'umbrella-table', 'bird-bath', 'mailbox', 'bicycle', 'swing-set', 'sandbox', 'trampoline', 'dog-house', 'wheelbarrow', 'garden-fountain', 'picnic-table', 'patio-heater'];

/** A random site spec: a real house's massing on an S4 lot with random items — a pure function of the seed. */
function generate(seed: number) {
  const r = mulberry(seed), U = (a: number, b: number) => a + (b - a) * r(), I = (a: number, b: number) => Math.floor(U(a, b + 1)), P = <T,>(a: T[]): T => a[Math.floor(r() * a.length)], R2 = (v: number) => Math.round(v * 100) / 100;
  const base = JSON.parse(fs.readFileSync(path.join(HOUSES, P(BASES) + '.json'), 'utf8'));
  const id = `fuzz-${seed}`, spec: any = { ...base, id, name: id };
  const W = R2(U(20, 40)), D = R2(U(20, 36)), lot: any = { w: W, d: D, ground: P(['lawn', 'lawn', 'meadow', 'gravel', 'desert']) };
  if (r() < 0.8) lot.context = P(['suburb', 'city', 'forest', 'desert', 'waterfront', 'rural', 'hillside']);
  if (r() < 0.5) lot.water = r() < 0.5 ? P(['lake', 'river', 'canal', 'sea']) : { kind: P(['lake', 'river', 'canal', 'sea']), sides: [...new Set([P(['N', 'S', 'E', 'W']), P(['N', 'S', 'E', 'W'])])], width: R2(U(6, 30)), farBank: P(['trees', 'houses', 'hills', 'none']), edge: P(['bank', 'wall', 'beach']) };
  if (r() < 0.3) lot.street = P(['S', 'N', 'E', 'W', 'none']);
  if (r() < 0.3) lot.setback = R2(U(2, 9));
  if (r() < 0.3) lot.sidewalk = P<any>(['concrete', 'brick', 'stone', 'flagstone', 'pavers', 'gravel', 'slate', 'none', { material: 'brick', width: 2.4 }]);
  if (r() < 0.3) lot.streetFurniture = r() < 0.2 ? 'none' : [P(['bench', 'hydrant', 'bollard', 'bike-rack']), P(['bench', 'hydrant'])];
  spec.lot = lot; if (r() < 0.5) spec.defaults = 2;
  const at = (m = 0.9): number[] => [R2(U(-W / 2 * m, W / 2 * m)), R2(U(-D / 2 * m, D / 2 * m))];
  const pts = (n: number, m = 0.9) => Array.from({ length: n }, () => at(m));
  const poly = (n = I(3, 7), m = 0.8) => { const c = at(m), rr = U(1.5, 6); return Array.from({ length: n }, (_, k) => { const a = k / n * 2 * Math.PI + U(-0.3, 0.3), q = rr * U(0.6, 1.2); return [R2(c[0] + Math.cos(a) * q), R2(c[1] + Math.sin(a) * q)]; }); };
  const col = () => '#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0');
  const maybe = <T,>(p: number, f: () => T): T | undefined => r() < p ? f() : undefined;
  const gens: Array<() => any> = [
    () => ({ type: 'tree', at: at(), species: P(SPECIES), h: R2(U(2, 12)), spread: maybe(0.4, () => R2(U(0.5, 2))) }),
    () => ({ type: 'shrub', at: at(), form: P(FORMS), r: R2(U(0.3, 1.6)), h: maybe(0.3, () => R2(U(0.3, 2.5))) }),
    () => ({ type: 'flowers', at: at(), kind: P(['lavender', 'daisy', 'tulip', 'allium', 'rose', 'bloom']), r: R2(U(0.3, 1.2)), color: maybe(0.4, col) }),
    () => ({ type: 'rock', at: at(), r: R2(U(0.2, 1.2)) }),
    () => r() < 0.5 ? ({ type: 'bed', poly: poly(), smooth: maybe(0.5, () => true), edge: maybe(0.4, () => P<any>([{ color: col(), h: 0.06, w: 0.1 }, 'none'])) }) : ({ type: 'bed', at: at(), w: R2(U(1, 6)), d: R2(U(0.6, 3)), rot: maybe(0.3, () => I(0, 359)) }),
    () => ({ type: 'path', path: pts(I(2, 6)), w: R2(U(0.6, 2.2)), smooth: maybe(0.5, () => true), meander: maybe(0.25, () => R2(U(0.2, 1.2))), surface: maybe(0.7, () => P(['gravel', 'flagstone', 'stepping', 'brick', 'concrete', 'decking', 'terracotta'])), color: maybe(0.3, col) }),
    () => ({ type: 'hedge', path: pts(I(2, 5)), h: R2(U(0.6, 2.4)), smooth: maybe(0.4, () => true) }),
    () => ({ type: 'scatter', at: at(), w: R2(U(3, 10)), d: R2(U(3, 8)), n: I(3, 25), species: [P(['shrub', 'flowers', 'rock', 'tree']), P(['shrub', 'flowers', 'rock'])], layout: maybe(0.5, () => 'poisson') }),
    () => ({ type: 'grove', at: at(), r: R2(U(2, 6)), n: I(3, 14), species: P(SPECIES) }),
    () => ({ type: 'patio', ...(r() < 0.5 ? { poly: poly(), smooth: maybe(0.5, () => true) } : { at: at(), w: R2(U(2, 7)), d: R2(U(2, 6)) }), surface: maybe(0.6, () => P(['concrete', 'gravel', 'brick', 'terracotta', 'stone'])), color: maybe(0.3, col) }),
    () => ({ type: 'driveway', ...(r() < 0.5 ? { poly: poly(), smooth: maybe(0.5, () => 0.3) } : { at: at(), w: R2(U(2.5, 5)), d: R2(U(4, 10)) }), surface: maybe(0.6, () => P(['concrete', 'gravel', 'brick'])) }),
    () => ({ type: 'pool', ...(r() < 0.3 ? { poly: poly(I(4, 8)), shape: 'poly', smooth: maybe(0.5, () => true) } : { at: at(), w: R2(U(3, 10)), d: R2(U(2, 5)), shape: maybe(0.8, () => P(['rect', 'lap', 'kidney', 'free', 'round', 'basin'])) }), coping: maybe(0.6, () => ({ w: R2(U(0.2, 0.5)), material: P(['stone', 'concrete']), color: col() })), y: maybe(0.3, () => R2(U(-0.2, 3))), island: maybe(0.15, () => ({ w: 1.2, d: 1.2, plants: P(['topiary-ball', 'lavender', 'tree']) })), fountains: maybe(0.15, () => I(1, 4)) }),
    () => ({ type: 'pond', ...(r() < 0.5 ? { poly: poly(I(5, 9)), smooth: maybe(0.5, () => true) } : { at: at(), w: R2(U(3, 9)), d: R2(U(2, 6)), shape: 'organic' }) }),
    () => ({ type: 'deck', at: at(), w: R2(U(2, 8)), d: R2(U(2, 6)), h: R2(U(0.1, 1.2)), y: maybe(0.4, () => R2(U(0, 4))), posts: maybe(0.5, () => r() < 0.5), rails: maybe(0.6, () => P<any>(['all', 'none', ['N', 'E'], { sides: ['N', 'S'], style: P(['glass', 'cable', 'timber']), color: col() }])), rot: maybe(0.3, () => P([0, 90, 180, 270, 45])) }),
    () => ({ type: 'steps', at: at(), w: R2(U(0.8, 2.5)), rot: P([0, 90, 180, 270]), h: maybe(0.6, () => R2(U(0.2, 2.5))), d: maybe(0.3, () => R2(U(0.6, 2.5))), n: maybe(0.3, () => I(1, 12)), rail: maybe(0.3, () => P<any>([true, 'timber', { style: 'metal', color: col() }])) }),
    () => ({ type: 'fence', ...(r() < 0.5 ? { path: pts(I(2, 5)), smooth: maybe(0.3, () => true) } : { from: at(), to: at() }), style: P(['picket', 'privacy', 'slat-h', 'post-rail', 'metal', 'glass', 'stone-wall']), h: maybe(0.4, () => R2(U(0.5, 3))), y: maybe(0.2, () => R2(U(0, 3))), color: maybe(0.4, col) }),
    () => ({ type: 'wall-low', path: pts(I(2, 4)), surface: P(['stone', 'brick', 'stucco', 'render', 'concrete']), h: R2(U(0.3, 1.5)), cap: maybe(0.3, col), t: maybe(0.3, () => R2(U(0.15, 0.5))), smooth: maybe(0.3, () => true) }),
    () => ({ type: 'gazebo', at: at(), r: R2(U(1.4, 3)), color: maybe(0.6, col), trim: maybe(0.4, col) }),
    () => ({ type: P(['pergola', 'cabana']), at: at(), w: R2(U(3, 7)), d: R2(U(2.5, 5)), h: maybe(0.4, () => R2(U(2.2, 3.2))), climber: maybe(0.4, () => P(['wisteria', 'vine', 'rose', 'none'])), rot: maybe(0.3, () => P([0, 90])) }),
    () => ({ type: P(['greenhouse', 'garden-beds', 'firepit', 'loungers', 'bench', 'car', 'planter', 'monkeybars', 'hottub', 'turtle-pool']), at: at(), w: maybe(0.4, () => R2(U(1, 5))), d: maybe(0.4, () => R2(U(1, 4))), r: maybe(0.3, () => R2(U(0.6, 1.6))), count: maybe(0.3, () => I(2, 8)), rot: maybe(0.4, () => I(0, 359)), y: maybe(0.1, () => R2(U(0, 3))) }),
    () => ({ type: 'terrace', poly: poly(I(4, 7), 0.7), y: R2(U(0.3, 2.8)), smooth: maybe(0.4, () => R2(U(0.2, 0.5))), id: maybe(0.3, () => 't' + I(0, 9)), edge: maybe(0.8, () => P<any>(['retaining', 'planted', 'slope', 'rail', { kind: 'retaining', material: P(['stone', 'stucco', 'brick', 'concrete', 'timber']), color: col() }, { kind: 'rail', material: 'stone', rail: P(['glass', 'timber', 'metal']) }])) }),
    () => ({ type: 'stair', from: [...at(), maybe(0.7, () => R2(U(0, 1)))], to: [...at(), R2(U(0.5, 4))], w: R2(U(0.8, 2)), style: P(['stone', 'concrete', 'timber', 'steel']), rail: maybe(0.6, () => P<any>([true, 'glass', 'timber'])) }),
    () => ({ type: P(['rill', 'channel']), at: at(), w: R2(U(0.3, 1.5)), d: R2(U(1, 8)), rot: P([0, 90, 30]) }),
    () => ({ type: 'string-lights', path: pts(I(2, 4)), h: R2(U(2, 3.5)), sag: maybe(0.4, () => R2(U(0.1, 0.6))), posts: maybe(0.3, () => false) }),
    () => ({ type: 'climber', species: P(['ivy', 'wisteria', 'rose']), from: at(), to: at(), h: R2(U(1.5, 6)) }),
    () => ({ type: 'planting', kind: 'foundation', along: P(['facade:S', 'facade:S,E', 'facade:all', 'facade:N', 'facade:W,S']), mix: P(MIX), layers: maybe(0.4, () => I(1, 3)), density: maybe(0.3, () => R2(U(0.4, 2))), depth: maybe(0.4, () => R2(U(0.8, 3))), bloom: maybe(0.2, () => [col(), col()]) }),
    () => ({ type: 'planting', kind: 'border', along: pts(I(2, 5)), side: P(['left', 'right']), mix: P(MIX), depth: R2(U(0.8, 3)) }),
    () => ({ type: 'planting', kind: 'meadow', poly: poly(I(3, 7)), mix: P(MIX), density: maybe(0.3, () => R2(U(0.4, 2))) }),
    () => ({ type: 'planting', kind: 'grove', poly: poly(I(3, 7)), mix: P(MIX), species: maybe(0.6, () => [P(SPECIES), P(SPECIES)]) }),
    () => ({ type: P(PROPS), at: at(), rot: maybe(0.5, () => I(0, 359)), y: maybe(0.1, () => R2(U(0, 3))), color: maybe(0.2, col) }),
  ];
  const site: any[] = [], n = I(10, 34);
  for (let i = 0; i < n; i++) { const it = P(gens)(); for (const k of Object.keys(it)) if (it[k] === undefined) delete it[k]; site.push(it); }
  const paths = site.map((s, i) => ({ s, i })).filter(x => x.s.type === 'path'), ter = site.map((s, i) => ({ s, i })).filter(x => x.s.type === 'terrace');
  if (paths.length && r() < 0.7) site.push({ type: 'planting', kind: 'walk', along: `path:${P(paths).i}`, mix: P(MIX), depth: R2(U(0.6, 1.6)) });
  if (ter.length && r() < 0.7) site.push({ type: 'planting', kind: 'terrace', along: `terrace:${P(ter).i}`, mix: P(MIX) });
  spec.site = site;
  return spec;
}

const seeds = Array.from({ length: N }, (_, i) => SEED0 + i);
const specs = new Map<string, any>(seeds.map(s => [`fuzz-${s}`, generate(s)]));
const keep = args.keep && args.keep !== 'true' ? path.resolve(args.keep) : null;
if (keep) { fs.mkdirSync(keep, { recursive: true }); for (const [id, sp] of specs) fs.writeFileSync(path.join(keep, id + '.json'), JSON.stringify(sp)); }

// ---- the validator: no errors (its lints are warnings and expected here)
let failed = 0;
const problems = new Map<string, string[]>();
const flag = (id: string, m: string) => { (problems.get(id) || problems.set(id, []).get(id)!).push(m); };
for (const [id, sp] of specs) { const { errors } = validate(sp, `${id}.json`); for (const e of errors) flag(id, `validator: ${e}`); }

// ---- the builder, in the page
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
  const u = decodeURIComponent(new URL(req.url!, 'http://x').pathname), m = /^\/content\/houses\/(fuzz-\d+)\.json$/.exec(u);
  if (m && specs.has(m[1])) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(specs.get(m[1]))); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const PROFILE_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--no-sandbox'];
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILE_ARGS });

async function build(id: string) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } }), page = await ctx.newPage(), errs: string[] = [];
  page.on('pageerror', e => errs.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`); });
  await page.route('https://fonts.googleapis.com/**', rt => rt.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', rt => rt.abort());
  const out: any = { id, errs };
  try {
    await page.goto(`http://localhost:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
    Object.assign(out, await page.evaluate(() => {
      const w = window as any, d = w.__houseDebug(), a = d.house.anchors, bad: string[] = [];
      const chk = (v: any, p: string) => { if (typeof v === 'number') { if (!isFinite(v)) bad.push(p); } else if (v && typeof v === 'object') for (const k in v) chk(v[k], p + '.' + k); };
      chk(a.siteInstances, 'instances'); chk(a.siteSolids, 'solids'); chk(a.siteEdges, 'edges');
      let nonfinite = 0;
      d.scene.traverse((o: any) => { if (o.isMesh && o.geometry.attributes.position) { const arr = o.geometry.attributes.position.array; for (let i = 0; i < arr.length; i += 61) if (!isFinite(arr[i])) { nonfinite++; break; } } });
      let qa: any; try { const r = w.__houseSceneQA(); qa = { errors: (r.errors || []).map((x: any) => `${x.code}: ${x.message}`) }; } catch (e) { qa = { crash: String(e) }; }
      const h = (s: string) => { let x = 0; for (let i = 0; i < s.length; i++) x = (Math.imul(31, x) + s.charCodeAt(i)) | 0; return x; };
      return { dropped: a.siteDropped || [], bad, nonfinite, qa, sig: h(JSON.stringify(a.siteInstances) + JSON.stringify(a.siteSolids) + JSON.stringify(a.siteEdges)), ninst: (a.siteInstances || []).length };
    }));
  } catch (e) { out.crash = String(e).split('\n')[0]; }
  await ctx.close();
  return out;
}
async function pool<T>(list: string[], k: number, fn: (id: string) => Promise<T>) { const q = [...list], res: T[] = []; await Promise.all(Array.from({ length: k }, async () => { while (q.length) res.push(await fn(q.shift()!)); })); return res; }

const W = Math.min(3, Math.max(1, os.cpus().length >> 2));
const first = await pool([...specs.keys()], W, build);
first.sort((a: any, b: any) => +a.id.slice(5) - +b.id.slice(5));
for (const r of first as any[]) {
  if (r.crash) flag(r.id, `did not build: ${r.crash}`);
  for (const e of r.errs) flag(r.id, e);
  if (r.dropped && r.dropped.length) flag(r.id, `no builder built ${r.dropped.map((d: any) => `site[${d.site}] ${d.type}`).join(', ')}`);
  if (r.bad && r.bad.length) flag(r.id, `non-finite numbers in ${r.bad.slice(0, 4).join(', ')}`);
  if (r.nonfinite) flag(r.id, `${r.nonfinite} mesh(es) with non-finite vertices`);
  if (r.qa && (r.qa.crash || (r.qa.errors && r.qa.errors.length))) flag(r.id, `scene QA: ${r.qa.crash || r.qa.errors.join(' | ')}`);
}
// determinism: a fresh page builds the same site
const again = await pool((first as any[]).filter(r => !r.crash).slice(0, RERUN).map(r => r.id), W, build);
for (const a of again as any[]) { const b = (first as any[]).find(r => r.id === a.id); if (a.sig !== b.sig) flag(a.id, 'builds differently on a second run (site instances / solids / edges differ)'); }
await browser.close(); server.close();

for (const r of first as any[]) {
  const ps = problems.get(r.id);
  console.log(`  ${ps ? '✗' : '✓'} ${r.id}  ${r.ninst ?? '?'} instances${ps ? '' : ''}`);
  if (ps) { failed++; for (const p of ps) console.log(`      ${p}`); fs.mkdirSync(FAIL_DIR, { recursive: true }); fs.writeFileSync(path.join(FAIL_DIR, `${r.id}.json`), JSON.stringify(specs.get(r.id), null, 1)); }
}
console.log(failed ? `\n${failed} of ${N} random site specs failed (kept in ${path.relative(process.cwd(), FAIL_DIR)})` : `\n✓ ${N} random site specs build clean, none dropped, all finite; ${(again as any[]).length} rebuilt identically`);
process.exit(failed ? 1 : 0);
