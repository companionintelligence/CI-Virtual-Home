#!/usr/bin/env -S node --experimental-strip-types
// The hero surfaces, built in the page and measured (plan S1 acceptance): the Core on a credenza, an island at all
// four rotations, a console and a counter stands with coreBox.minY on the piece's real top (±5 mm — it is exact),
// never on the turntable, the bowl, the faucet or the cooktop; on the island ≥ 0.35 m from the faucet and the
// cooktop and on the user side at every rotation; and the scene QA's hero-float passes. The default desk and shelf
// stay where they were (feet 4 mm into the top).
// @check-house — runs in the gate after the goldens (about a minute: one page load a case)
//
//   node --experimental-strip-types scripts/test-kit-hero.mts          (any cwd; Playwright's Chromium)
//
// Each case is test/fixtures/houses/s1-kit-hero-island.json with its hero swapped, served under a probe id.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const npx = path.join(os.homedir(), '.npm', '_npx'), c = [];
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) c.push(p); }
  for (const p of c) { try { return await import(pathToFileURL(path.join(p, 'index.mjs')).href); } catch {} }
  console.error('playwright is not resolvable'); process.exit(2);
}
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's1-kit-hero-island.json'), 'utf8'));
// hero.at for each surface: backed onto the north wall (z −3), or free in the room (the island)
const CASES: Array<{ name: string; hero: any; tol?: number }> = [
  { name: 'credenza', hero: { surface: 'credenza', at: [2.6, -2.675], rot: 0 } },
  ...[0, 90, 180, 270].map(rot => ({ name: `island@${rot}`, hero: { surface: 'island', at: [1.8, 0.2], rot } })),
  { name: 'console', hero: { surface: 'console', at: [2.6, -2.725], rot: 0 } },
  { name: 'counter', hero: { surface: 'counter', at: [2.6, -2.59], rot: 0 } },
  { name: 'desk (default)', hero: { surface: 'desk', at: [2.6, -2.55], rot: 0 }, tol: 0.005 },
  { name: 'shelf (default)', hero: { surface: 'shelf', at: [2.6, -2.55], rot: 0 }, tol: 0.005 },
];
// the island cases keep the fixture's kitchen (its own stools: the hero island must bring none); the others stand
// in an empty room, so nothing but their own piece is under the Core
const specFor = (i: number) => {
  const s = JSON.parse(JSON.stringify(base)); s.id = `s1-kit-hero-probe-${i}`; s.hero = { level: 'l1', device: 'charcoal', pose: 'prone', ...CASES[i].hero };
  if (CASES[i].hero.surface !== 'island') s.levels[0].rooms[0].items = [];
  return s;
};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = u.match(/^\/content\/houses\/s1-kit-hero-probe-(\d+)\.json$/);
  if (m) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(specFor(+m[1]))); }
  const f = path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, () => r()));
const port = (server.address() as import('node:net').AddressInfo).port;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let failed = 0;
try {
  for (let i = 0; i < CASES.length; i++) {
    const id = `s1-kit-hero-probe-${i}`, c = CASES[i];
    const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    const errs: string[] = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.goto(`http://127.0.0.1:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const d = (window as any).__houseDebug(), h = d.house.anchors.hero, T = (window as any).__THREE;
      const qa = (window as any).__houseSceneQA();
      const floatIssues = [...(qa.errors || []), ...(qa.warnings || [])].filter(x => x.code === 'hero-float').map(x => x.message);
      const out: any = { coreBox: h.coreBox, top: h.surfaceTop, type: h.surfaceType || h.surface, fwd: h.fwd, floatIssues };
      const s = h.surfaceObj;
      if (s && out.type === 'kitchen-island') {
        // the Core's centre in the island's own frame, against its faucet (0.45, 0.15) and cooktop (x −0.75…−0.05, z ±0.24)
        s.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(s.matrixWorld).invert();
        const b = h.coreBox, c = new T.Vector3((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2).applyMatrix4(inv);
        const hw = 0.116, hd = 0.1025;   // the Core's half footprint, aligned with the island's axes
        const rectGap = (x0, x1, z0, z1) => Math.hypot(Math.max(0, x0 - (c.x + hw), (c.x - hw) - x1), Math.max(0, z0 - (c.z + hd), (c.z - hd) - z1));
        out.faucet = rectGap(0.435, 0.465, 0.135, 0.165);
        out.cooktop = rectGap(-0.75, -0.05, -0.24, 0.24);
        const centre = new T.Vector3(); s.getWorldPosition(centre);
        out.userSide = ((b.minX + b.maxX) / 2 - centre.x) * h.fwd[0] + ((b.minZ + b.maxZ) / 2 - centre.z) * h.fwd[1];
        let stools = 0; s.traverse(m => { if (m.isMesh && m.geometry && m.geometry.parameters && m.geometry.parameters.radiusTop === 0.18) stools++; });
        out.stools = stools;
      }
      return out;
    });
    const tol = c.tol ?? 0.005, gap = r.coreBox.minY - r.top;
    const bad: string[] = [];
    if (errs.length) bad.push(`page errors: ${errs.join(' | ')}`);
    if (Math.abs(gap) > tol) bad.push(`coreBox.minY ${r.coreBox.minY} vs top ${r.top} (${(gap * 1000).toFixed(1)} mm)`);
    if (r.floatIssues.length) bad.push(`hero-float: ${r.floatIssues.join('; ')}`);
    if (r.faucet !== undefined && r.faucet < 0.35 - 1e-6) bad.push(`${r.faucet.toFixed(3)} m from the faucet (≥ 0.35)`);
    if (r.cooktop !== undefined && r.cooktop < 0.35 - 1e-6) bad.push(`${r.cooktop.toFixed(3)} m from the cooktop (≥ 0.35)`);
    if (r.userSide !== undefined && r.userSide <= 0) bad.push(`on the far side of the island (${r.userSide.toFixed(3)} m along the user's direction)`);
    if (r.stools) bad.push(`the island brought ${r.stools} stools into a room that has its own`);
    const extra = r.faucet !== undefined ? `, faucet ${r.faucet.toFixed(2)} m, cooktop ${r.cooktop.toFixed(2)} m, user side +${r.userSide.toFixed(2)} m` : '';
    console.log(`${bad.length ? '✗' : '✓'} ${c.name.padEnd(16)} ${String(r.type).padEnd(15)} top ${r.top.toFixed(3)}  Core ${r.coreBox.minY.toFixed(3)} (${(gap * 1000).toFixed(1)} mm)${extra}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
    if (bad.length) failed++;
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
console.log(failed ? `\n${failed} of ${CASES.length} hero surfaces failed` : `\nall ${CASES.length} hero surfaces stand on their tops`);
process.exit(failed ? 1 : 0);
