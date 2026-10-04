#!/usr/bin/env -S node --experimental-strip-types
// Review sheets for baked models, rendered in the repo's own renderer (room-creator.html's prop sheet: the three-quarter view, the neutral floor,
// the house's role colours), optionally next to a Blender render of the SOURCE object so the two can be compared at a glance.
//
//   node --experimental-strip-types scripts/bake/sheet.mts [--ids box-carton,nightstand-a] [--baked all|1|0] [--out sheet.jpg] [--sources] [--res 540]
//   node --experimental-strip-types scripts/bake/sheet.mts --compare nightstand-a       procedural (?baked=0) next to baked (?baked=all), same view
//
// One browser, one job (the machine is shared): this starts a headless Chromium on the Metal backend, renders the types in one call and closes it.
// Sheets default to video/props/ (gitignored); --out says otherwise. The source renders (--sources) read THREEDINSIDE_ROOT and are Blender
// Workbench renders of the unmodified source objects, flat shaded in their own material colours; they never enter the repo.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { REPO, readManifest } from './lib.mts';

const args = process.argv.slice(2);
const opt = (n: string, d: string | null = null) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (n: string) => args.includes('--' + n);
const manifest = readManifest();
const BLENDER = process.env.BLENDER || '/Applications/Blender 4.5.app/Contents/MacOS/Blender';
const SOURCE_ROOT = process.env.THREEDINSIDE_ROOT || '/Users/liam/devel/_staging/3dinside';
const ids = (opt('ids') || opt('compare') || manifest.models.map((m: any) => m.id).join(',')).split(',');
const entries = ids.map(id => { const e = manifest.models.find((m: any) => m.id === id); if (!e) throw new Error(`no manifest entry ${id}`); return e; });
const OUT = opt('out') || path.join(REPO, 'video', 'props', 'baked-sheet.jpg');
const RES = opt('res') || '540';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  const { pathToFileURL } = await import('node:url');
  const cands: string[] = [];
  if (process.env.PLAYWRIGHT_MODULE) cands.push(process.env.PLAYWRIGHT_MODULE);
  for (const c of cands) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch { /* next */ } }
  throw new Error('playwright is not resolvable');
}
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => { const f = path.join(REPO, decodeURIComponent(new URL(req.url!, 'http://x').pathname)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

async function render(mode: string, types: string[], params: Record<string, any> = {}): Promise<Record<string, any>> {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  page.on('pageerror', e => console.error('page error', e.message));
  await page.goto(`http://localhost:${port}/room-creator.html?baked=${mode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof (window as any).__housePropSheet === 'function');
  const out = await page.evaluate(async ({ types, res, params }) => (window as any).__housePropSheet(types, { res, params }), { types, res: RES, params });
  await page.close();
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-sheet-'));
const tiles: Array<{ file: string; label: string }> = [];
const types = entries.map((e: any) => e.prop_type);
if (opt('stretch')) {
  // the nine-slice at 0.75x, 1x and 1.35x of each declared size (the catalog's probe points), and just outside the range
  const e = entries[0], fit = e.stats && e.fit ? e.fit : e.fit || {};
  const native: Record<string, number> = {};
  for (const [p, f] of Object.entries(fit) as any) native[p] = (e.stats.box[f.axis === 'x' ? 3 : f.axis === 'y' ? 4 : 5] - e.stats.box[f.axis === 'x' ? 0 : f.axis === 'y' ? 1 : 2]);
  for (const [p, f] of Object.entries(fit) as any) for (const m of [f.range[0] / native[p], 0.75, 1, 1.35, f.range[1] / native[p]]) {
    const v = +(native[p] * m).toFixed(3), shots = await render(opt('baked', 'all')!, [e.prop_type], { [e.prop_type]: { [p]: v } });
    const sh = shots[e.prop_type]; if (!sh || sh.error) { console.log(`x ${p}=${v}: ${sh ? sh.error : 'none'}`); continue; }
    const f2 = path.join(tmp, `${e.id}-${p}-${v}.jpg`); fs.writeFileSync(f2, Buffer.from(sh.jpg, 'base64'));
    console.log(`${e.id} ${p}=${v}: ${sh.size[0]} x ${sh.size[2]} m, ${sh.size[1]} m tall`);
    tiles.push({ file: f2, label: `${p}=${v}` });
  }
  entries.length = 0;
}
const modes = flag('compare') || opt('compare') ? ['0', 'all'] : [opt('baked', 'all')!];
for (const mode of modes) {
  const shots = await render(mode, types);
  for (const e of entries) {
    const s = shots[e.prop_type];
    if (!s || s.error) { console.log(`x ${e.id} (?baked=${mode}): ${s ? s.error : 'no render'}`); continue; }
    const f = path.join(tmp, `${e.id}-${mode}.jpg`); fs.writeFileSync(f, Buffer.from(s.jpg, 'base64'));
    console.log(`${e.id} ?baked=${mode}: ${s.size[0]} x ${s.size[2]} m, ${s.size[1]} m tall`);
    if (flag('sources')) { const src = sourceRender(e); if (src) tiles.push({ file: src, label: `${e.id} source` }); }
    tiles.push({ file: f, label: `${e.id} ${mode === '0' ? 'procedural' : 'baked'}` });
  }
}
await browser.close(); server.close();

/** A Blender Workbench render of the entry's source objects (with their children) in the same three-quarter view. */
function sourceRender(e: any): string | null {
  const out = path.join(tmp, `${e.id}-source.png`);
  const py = path.join(import.meta.dirname, 'source_render.py');
  const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', py, '--', path.join(SOURCE_ROOT, e.src.file), out, e.src.objects.join(','), RES, (e.pose && e.pose.front) || '+Y', String((e.pose && e.pose.yaw) || 0)], { encoding: 'utf8' });
  if (!fs.existsSync(out)) { console.log(`x source render of ${e.id} failed: ${(r.stdout || '').split('\n').filter(l => /Error|Traceback/.test(l)).join(' ')}`); return null; }
  return out;
}

if (tiles.length) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const cols = Number(opt('cols', String(Math.min(tiles.length, flag('sources') ? 2 : 3))));
  const inputs = tiles.flatMap(t => ['-i', t.file]);
  const fc = tiles.map((t, i) => `[${i}:v]scale=480:270:force_original_aspect_ratio=decrease,pad=484:274:(ow-iw)/2:(oh-ih)/2:color=0xdddddd,drawtext=text='${t.label}':x=8:y=h-22:fontsize=15:fontcolor=0x222222[v${i}]`).join(';') + ';' +
    tiles.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % cols) * 484}_${Math.floor(i / cols) * 274}`).join('|')}:fill=black`;
  let r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-q:v', '3', OUT], { encoding: 'utf8' });
  if (r.status !== 0) {   // an ffmpeg without drawtext: the same sheet without labels
    const fc2 = tiles.map((_, i) => `[${i}:v]scale=480:270:force_original_aspect_ratio=decrease,pad=484:274:(ow-iw)/2:(oh-ih)/2:color=0xdddddd[v${i}]`).join(';') + ';' + tiles.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % cols) * 484}_${Math.floor(i / cols) * 274}`).join('|')}:fill=black`;
    r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc2, '-q:v', '3', OUT], { encoding: 'utf8' });
    if (r.status === 0) console.log('(no drawtext in this ffmpeg: tiles are in the order ' + tiles.map(t => t.label).join(', ') + ')');
  }
  if (r.status !== 0) console.error(r.stderr); else console.log(`${tiles.length} tiles -> ${OUT}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
