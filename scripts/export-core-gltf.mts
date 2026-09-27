#!/usr/bin/env -S node --experimental-strip-types
// Exports the Companion Core 3D model (room-creator.html's AssetFactory.createCompanionCore) as glTF binary.
//
//   node --experimental-strip-types scripts/export-core-gltf.mts [--finish chalk,charcoal] [--pose prone,upright] [--out dist/models]
//
// Opens room-creator.html headless (same static server + Playwright resolution as render-house-shots.mts), builds
// each finish × pose on its own, powered on, and writes <out>/companion-core-<finish>-<pose>.glb via three's
// GLTFExporter (vendored at assets/vendor/three/exporters, same r169 as the core). Units are metres; +Y up; the
// front faces −Z at rotation 0 like every asset in the library. The fan rotor is the node named "fan rotor".
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
// dist/ is gitignored: the .glb is a deliverable for consumers (CI-Common keeps the published copies), not source
const OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'dist', 'models');
const FINISHES = (args.finish || 'chalk,charcoal').split(',');
const POSES = (args.pose || 'prone,upright').split(',');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { pathToFileURL } = await import('node:url'); const os = await import('node:os');
  const npx = path.join(os.homedir(), '.npm', '_npx'); const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable — run `npx playwright install chromium` once'); process.exit(2);
}
const playwright = await loadPlaywright();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise<void>(resolve => server.listen(0, () => resolve()));
const port = (server.address() as import('node:net').AddressInfo).port;
const browser = await playwright.chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); page.on('pageerror', e => console.error('  page error:', e.message));
await page.goto(`http://localhost:${port}/room-creator.html?house=aurora`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.dataset.houseReady === 'aurora', null, { timeout: 60000 });
fs.mkdirSync(OUT, { recursive: true });
for (const finish of FINISHES) for (const pose of POSES) {
  const b64 = await page.evaluate(o => window.__houseExportCore(o), { finish, pose });
  const file = path.join(OUT, `companion-core-${finish}-${pose}.glb`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
await browser.close(); server.close();
