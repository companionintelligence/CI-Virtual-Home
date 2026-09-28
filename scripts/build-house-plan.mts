#!/usr/bin/env -S node --experimental-strip-types
// Writes content/houses/<id>.plan.json — what the three.js builder resolved from the spec that the Python twins
// cannot derive themselves: the seeded site instances (assets/site.js: trees of every species, shrubs, flowers,
// rocks, beds, hedges, paths, scatters, groves) as world boxes with shape and colour. generate_house_iso.py draws
// from it. One key per stream (assets/plan-export/: site, kit, and arch / compose / shots once those streams
// export anything). Run after editing specs or the site kit, before the isometrics:
//   pnpm run plans [--house id[,id…]] [--out <dir>]      (node --experimental-strip-types scripts/build-house-plan.mts — any cwd)
// --out writes the plans somewhere else (fleet-audit.mts --built: test/qa/plans), leaving the committed ones alone.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses');
const ids = args.house ? args.house.split(',') : JSON.parse(fs.readFileSync(path.join(HOUSES, 'index.json'), 'utf8')).houses.map(h => h.id);
const OUT_DIR = args.out && args.out !== 'true' ? path.resolve(args.out) : HOUSES;
fs.mkdirSync(OUT_DIR, { recursive: true });
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
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
let n = 0;
for (const id of ids) {
  await page.goto(`http://localhost:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id);
  // assets/plan-export/ picks each stream's key off the anchors, in the page (its URL built at run time, so the
  // Node type-check does not try to resolve it from scripts/)
  const plan: Record<string, any> = await page.evaluate(async () => { const { planOf } = await import(new URL('assets/plan-export/index.js', location.href).href); return planOf(__houseDebug().house.anchors); });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.plan.json`), JSON.stringify({ id, generated: 'build-house-plan.mjs', ...plan }));
  console.log(`${id}: ${(plan.site || []).length} site instances${Object.keys(plan).length > 2 ? ` (+ ${Object.keys(plan).filter(k => k !== 'site' && k !== 'kit').join(', ')})` : ''}`); n++;
}
await browser.close(); server.close();
console.log(`${n} plans → ${OUT_DIR}`);
