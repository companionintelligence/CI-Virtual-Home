#!/usr/bin/env -S node --experimental-strip-types
// Prop contact sheet: builds each prop alone and tiles the renders, with the measured size under each.
//   node --experimental-strip-types scripts/prop-sheet.mts --types side-table,table-lamp [--out sheet.jpg] [--cols 4]
//   node --experimental-strip-types scripts/prop-sheet.mts --module decor    # every type assets/props/decor.js registers
//   node --experimental-strip-types scripts/prop-sheet.mts --all             # the whole registry
// Sheets land in video/props/ (gitignored) unless --out says otherwise.
// Also prints each prop's measured size against its declared footprint/height (a mismatch is a bug in the prop).
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { spawnSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const { PROPS } = await import(path.join(ROOT, 'assets', 'props', 'index.js'));
let types = [];
if (args.types) types = args.types.split(',');
else if (args.module) { const src = fs.readFileSync(path.join(ROOT, 'assets', 'props', `${args.module}.js`), 'utf8'); types = [...src.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{/gm)].map(m => m[1]); }
else if (args.all) types = [...PROPS.keys()];
if (!types.length) { console.error('nothing to draw: --types, --module or --all'); process.exit(2); }
const OUT = args.out || path.join(ROOT, 'video', 'props', `${args.module || 'sheet'}.jpg`);
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
page.on('pageerror', e => console.error('page error', e.message));
await page.goto(`http://localhost:${port}/room-creator.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__housePropSheet === 'function');
const shots = await page.evaluate(types => window.__housePropSheet(types, { res: '540' }), types);
await browser.close(); server.close();
fs.mkdirSync(path.join(ROOT, 'video'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(ROOT, 'video', 'props-')); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tiles = [];
for (const t of types) {
  const s = shots[t];
  if (!s || s.error) { console.log(`✗ ${t}: ${s ? s.error : 'no render'}`); continue; }
  const f = path.join(tmp, `${t}.jpg`); fs.writeFileSync(f, Buffer.from(s.jpg, 'base64')); tiles.push({ t, f, s });
  const def = PROPS.get(t); const [fw, fd] = def ? def.footprint : [null, null];
  const flag = def && (Math.abs(s.size[0] - fw) > 0.15 || Math.abs(s.size[2] - fd) > 0.15 || Math.abs(s.size[1] - def.height) > 0.15) ? '  ← declared ' + JSON.stringify({ footprint: def.footprint, height: def.height }) : '';
  console.log(`${flag ? '△' : '✓'} ${t}: ${s.size[0]} × ${s.size[2]} m, ${s.size[1]} m tall${flag}`);
}
if (tiles.length) {
  const cols = Number(args.cols || 4), rows = Math.ceil(tiles.length / cols);
  const inputs = tiles.flatMap(x => ['-i', x.f]);
  const fc = tiles.map((x, i) => `[${i}:v]scale=480:270,pad=484:274:2:2:color=black[v${i}]`).join(';') + ';' + tiles.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % cols) * 484}_${Math.floor(i / cols) * 274}`).join('|')}:fill=black`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-q:v', '4', OUT], { encoding: 'utf8' });
  if (r.status !== 0) console.error(r.stderr); else console.log(`${tiles.length} props → ${OUT} (${cols} per row, in the order given)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
