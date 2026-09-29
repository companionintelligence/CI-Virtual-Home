#!/usr/bin/env -S node --experimental-strip-types
// The composer runs in the page at build time and in Node (compose-house.mts, the fleet metrics, the tests): they must
// make the same rooms (plan S3 "stable across runs and Node vs browser"). This builds each S3 fixture in headless
// Chromium exactly as the editor does, reads what the builder composed (anchors.compose, the source of <id>.plan.json's
// `compose` key), and compares it, item for item, with assets/room-composer.js's composeHouse run on the same spec in
// Node. It also checks the page's composition is the same on a second load, and that a fixture's composed rooms are
// what test/fixtures/compose/<id>.json blessed (a hash per room, so a change to the composer shows up here as a room
// that moved — bless on purpose with `--update`, like a golden).
//
//   node --experimental-strip-types scripts/test-compose-parity.mts [--fixture a,b] [--update]
//
// Exit: 0 all agree · 1 a room differs · 2 a harness error
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2), UPDATE = argv.includes('--update');
const only = (() => { const i = argv.indexOf('--fixture'); return i >= 0 ? argv[i + 1].split(',') : null; })();
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses'), BLESSED = path.join(ROOT, 'test', 'fixtures', 'compose');
const ids = fs.readdirSync(FIXTURES).filter(f => /^s3-compose-.*\.json$/.test(f)).map(f => f.replace(/\.json$/, '')).filter(id => !only || only.includes(id)).sort();
if (!ids.length) { console.log('no s3-compose fixtures'); process.exit(0); }

const { composeHouse } = await import(pathToFileURL(path.join(ROOT, 'assets', 'room-composer.js')).href);
const specs = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8'))]));

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const cands: string[] = [];
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) cands.push(p); }
  for (const c of cands) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch {} }
  return null;
}
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url!, 'http://x').pathname), fx = url.match(/^\/content\/houses\/([a-z0-9-]+)\.json$/);
  const f = fx && specs[fx[1]] ? path.join(FIXTURES, `${fx[1]}.json`) : path.join(ROOT, url);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
if (!pw) { console.error('playwright is not resolvable'); process.exit(2); }
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

const hash = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
let failed = 0;
const failedPlan: string[] = [];
const inPage = async (id: string) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://localhost:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
  const out = await page.evaluate(async () => {
    const a = (window as any).__houseDebug().house.anchors;
    const { planOf } = await import(new URL('assets/plan-export/index.js', location.href).href);
    const plan = planOf(a).compose as any;
    return { rooms: (a.compose || []).map((c: any) => ({ level: c.level, name: c.name, program: c.program, style: c.style, items: c.items })), plan: plan ? plan.rooms.length : 0 };
  });
  await ctx.close();
  return out as { rooms: Array<{ level: string; name: string; program: string; style: string; items: any[] }>; plan: number };
};
try {
  for (const id of ids) {
    const spec = JSON.parse(JSON.stringify(specs[id])), nodeRes = composeHouse(spec);
    const node: Array<{ level: string; name: string; items: any[] }> = [];
    for (const lv of spec.levels || []) for (const room of lv.rooms || []) if (nodeRes.has(room)) node.push({ level: lv.id, name: room.name, items: nodeRes.get(room).items });
    const pa = await inPage(id), pb = await inPage(id), a = pa.rooms, b = pb.rooms;
    if (pa.plan !== a.length) failedPlan.push(`${id}: <id>.plan.json's compose key has ${pa.plan} rooms, the builder composed ${a.length}`);
    const bad: string[] = [];
    if (a.length !== node.length) bad.push(`the page composed ${a.length} rooms, Node ${node.length}`);
    node.forEach((n, i) => { const p = a[i]; if (!p || p.name !== n.name) bad.push(`room ${i}: ${p ? p.name : 'missing'} vs ${n.name}`); else if (JSON.stringify(p.items) !== JSON.stringify(n.items)) bad.push(`"${n.name}": the page and Node differ (${p.items.length} vs ${n.items.length} items, ${hash(p.items)} vs ${hash(n.items)})`); });
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push('two loads of the page composed different rooms');
    // the blessed composition: one hash per room
    const now = Object.fromEntries(node.map(n => [`${n.level}/${n.name}`, hash(n.items)]));
    const file = path.join(BLESSED, `${id}.json`);
    if (UPDATE) { fs.mkdirSync(BLESSED, { recursive: true }); fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n'); }
    else if (!fs.existsSync(file)) bad.push(`no blessed composition (test/fixtures/compose/${id}.json): node scripts/test-compose-parity.mts --update`);
    else { const was = JSON.parse(fs.readFileSync(file, 'utf8')); for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) if (was[k] !== now[k]) bad.push(`"${k}" is ${now[k] ? 'now ' + now[k] : 'gone'} (blessed ${was[k] || 'absent'}): the composer changed this room — bless on purpose with --update`); }
    if (bad.length) { failed++; console.log(`✗ ${id}`); bad.slice(0, 8).forEach(m => console.log(`    ${m}`)); }
    else console.log(`✓ ${id}: ${node.length} rooms, ${node.reduce((s, n) => s + n.items.length, 0)} items — the page (twice) and Node agree${UPDATE ? '; blessed' : ' with the blessed composition'}`);
  }
} finally { await browser.close(); server.close(); }
for (const m of failedPlan) { failed++; console.log(`✗ ${m}`); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall agree (and plan.json\'s compose key carries the composed rooms)');
process.exit(failed ? 1 : 0);
