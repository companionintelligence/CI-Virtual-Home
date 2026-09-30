#!/usr/bin/env -S node --experimental-strip-types
// rooms[].program in the page (plan Completeness C2 and C9): S3's room program decides the fixtures' room kind, and in a
// room that has one the fixtures place ceiling fixtures only — S3's composer dresses its own lamps, so the halo-lamp
// re-dress leaves them alone; the lamps a composed room DOES have (the registry's floor, arc, tripod and table lamps)
// take their room's head like any room's, since retoning a lamp adds none. Read off anchors.fixtures, the stats the
// fixtures module keeps: the same house built with no program, with a program on every room, and with an 'outdoor'
// program on its hall (no ceiling, so nothing hangs and no light is placed there). Also read here: the registry lamps'
// heads (three or more kinds), and the door ids the fixture authors (openings[].id / partitions[].id → anchors.doors).
// @check-house — runs in the gate after the goldens (about 30 s: a page load a case)
//
//   node --experimental-strip-types scripts/test-kit-program.mts          (any cwd; Playwright's Chromium)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const npx = path.join(os.homedir(), '.npm', '_npx'), c: string[] = [];
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) c.push(p); }
  for (const p of c) { try { return await import(pathToFileURL(path.join(p, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable'); process.exit(2);
}
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's1-kit-look.json'), 'utf8'));   // defaults 2, eleven rooms
delete base.fixture;
const programOf = (name: string) => /kitchen|dining/i.test(name) ? 'kitchen-dining' : /bed|nursery|kids/i.test(name) ? 'bed-primary' : /bath/i.test(name) ? 'bath' : /study|den/i.test(name) ? 'study' : /hall|landing/i.test(name) ? 'hall' : 'living';
const VARIANTS: Record<string, (s: any) => void> = {
  none: () => {},
  all: s => { for (const l of s.levels) for (const r of l.rooms) r.program = programOf(r.name); },
  outdoor: s => { s.levels[0].rooms[0].program = 'outdoor'; },   // the hall
};
const specs = new Map<string, any>();
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
  const m = u.match(/^\/content\/houses\/(s1-kit-program-[a-z]+)\.json$/);
  if (m && specs.has(m[1])) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(specs.get(m[1]))); }
  const f = path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' } as any)[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const stats: Record<string, any> = {}, errs: string[] = [];
try {
  for (const [name, mod] of Object.entries(VARIANTS)) {
    const id = `s1-kit-program-${name}`, s = JSON.parse(JSON.stringify(base)); s.id = id; mod(s); specs.set(id, s);
    const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.goto(`http://127.0.0.1:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
    stats[name] = await page.evaluate(() => {
      const d = (window as any).__houseDebug(), a = d.house.anchors, heads: Record<string, number> = {};
      d.scene.traverse(o => { const t = o.userData && o.userData.itemType; if (t && /^(floor|arc-floor|tripod-floor|table)-lamp$/.test(t)) { let kind = 'drum'; o.traverse(m => { const mm = /^Lamp Head \((\w+)\)$/.exec(m.name || ''); if (mm) kind = mm[1]; }); heads[kind] = (heads[kind] || 0) + 1; } });
      return { ...JSON.parse(JSON.stringify(a.fixtures)), registryHeads: heads, doorIds: (a.doors || []).map(x => x.id) };
    });
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); if (!ok) bad++; };
const { none, all, outdoor } = stats;
console.log(`  no program   ${JSON.stringify(none)}\n  all rooms    ${JSON.stringify(all)}\n  hall outdoor ${JSON.stringify(outdoor)}`);
check(!errs.length, 'every variant builds without a page error', errs.join('\n    '));
check(none.halos > 0 && all.halos < none.halos, `a program on every room keeps the halo-lamp re-dress off in those rooms (halos ${none.halos} → ${all.halos})`);
check(Object.keys(none.registryHeads).length >= 3, `the registry's lamps take three or more heads (${JSON.stringify(none.registryHeads)})`);
check(Object.keys(all.registryHeads).length >= 3, `…and a composed room's lamps take their room's head too (${JSON.stringify(all.registryHeads)}; the seed is the house's id, so the picks differ from the variant above)`);
for (const id of ['front:L', 'front:R', 'pass:L', 'pass:R', 'kitchen-pass:L', 'kitchen-pass:R']) check(none.doorIds.includes(id), `door id ${id} reaches anchors.doors`);
check(new Set(none.doorIds).size === none.doorIds.length, `every door id is unique (${none.doorIds.length} doors)`);
check(all.recessed === none.recessed && all.pendants === none.pendants, `…while its ceiling fixtures stay (recessed ${all.recessed} of ${none.recessed}, pendants ${all.pendants} of ${none.pendants})`);
check(outdoor.recessed < none.recessed && outdoor.lights < none.lights, `an 'outdoor' program hangs nothing and lights nothing (recessed ${none.recessed} → ${outdoor.recessed}, lights ${none.lights} → ${outdoor.lights})`);
console.log(`${bad ? '✗' : '✓'} program: ${bad} wrong`);
process.exit(bad ? 1 : 0);
