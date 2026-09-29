#!/usr/bin/env -S node --experimental-strip-types
// The defaults-2 look, measured in the page (plan Completeness A1; the fleet check found golden hour and dusk turning
// white walls pink and a blue wall grey): a plain white wall and a kept cobalt wall are rendered under `day`,
// `golden` and `dusk` with the sun fixed on their facade (lighting.sunBearing 180), look 1 (defaults 1) against look 2
// (`defaults: 2`), and the colour of a patch of each is read off the composed still. Look 2 must keep the white
// wall near-neutral at every hour (well below what look 1 does to it at golden hour and dusk), and keep the cobalt
// hue and saturation (palette.keep 'wall'): the hour changes the light, not the house.
// @check-house — runs in the gate after the goldens (about a minute: a page load a look)
//
//   node --experimental-strip-types scripts/test-kit-look.mts          (any cwd; Playwright's Chromium)
//
// Each case is a fixture (test/fixtures/houses/s1-kit-look.json, s1-kit-cladding.json) served under a probe id with
// its defaults and lighting swapped, so the two looks differ in nothing else.
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

const PRESETS = ['day', 'golden', 'dusk'];
// a bare patch of wall on the south facade (between openings), where the camera looks square at it
const CASES = [
  { key: 'white', fixture: 's1-kit-look', patch: [0.75, 1.5, 4.5], mod: (s: any) => { s.palette = { ...s.palette, keep: ['accent'], restraint: 1 }; } },   // restraint pinned: the test measures the light, not defaults 2's palette (0.4), which leaves the fixture's warm white its own tint
  { key: 'cobalt', fixture: 's1-kit-cladding', patch: [0, 4.2, 4.0], mod: (_s: any) => {} },   // palette.keep: wall, roof, accent
];
const specs = new Map<string, any>();
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
  const m = u.match(/^\/content\/houses\/(s1-kit-look-probe-[a-z0-9-]+)\.json$/);
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

type Px = { rgb: number[]; chroma: number; hue: number; luma: number };
const px = ([R, G, B]: number[]): Px => {
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  let h = 0; if (mx !== mn) { h = mx === R ? ((G - B) / (mx - mn)) % 6 : mx === G ? (B - R) / (mx - mn) + 2 : (R - G) / (mx - mn) + 4; h = (h * 60 + 360) % 360; }
  return { rgb: [R, G, B], chroma: (mx - mn) / mx, hue: h, luma: 0.2126 * R + 0.7152 * G + 0.0722 * B };
};
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const seen: Record<string, Record<number, Record<string, Px>>> = {};
try {
  for (const c of CASES) for (const look of [1, 2]) {
    const id = `s1-kit-look-probe-${c.key}-${look}`;
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', `${c.fixture}.json`), 'utf8'));
    s.id = id; s.defaults = look; s.lighting = { preset: 'day', sunBearing: 180 }; delete s.fixture; c.mod(s); specs.set(id, s);
    const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    const errs: string[] = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.goto(`http://127.0.0.1:${port}/room-creator.html?house=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id, { timeout: 180000 });
    await page.evaluate(() => (window as any).__houseComposerWarm({ res: '360' }));
    for (const preset of PRESETS) {
      const rgb: number[] = await page.evaluate(async ({ preset, patch }) => {
        const w = window as any;
        w.__houseSetLighting(preset);
        const cam = w.__houseDebug().camera;
        cam.position.set(patch[0], patch[1], patch[2] + 7); cam.lookAt(patch[0], patch[1], patch[2]); cam.fov = 30; cam.updateProjectionMatrix();
        const img = new Image(); img.src = w.__houseSnapshot({ res: '360', dressing: { walls: 'up', roof: 'on' }, quality: 0.95 }); await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const g = cv.getContext('2d')!; g.drawImage(img, 0, 0);
        const S = 24, d = g.getImageData(Math.round(img.width / 2) - S / 2, Math.round(img.height / 2) - S / 2, S, S).data;
        let R = 0, G = 0, B = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
        const n = d.length / 4; return [R / n, G / n, B / n];
      }, { preset, patch: c.patch });
      ((seen[c.key] ||= {})[look] ||= {})[preset] = px(rgb);
    }
    if (errs.length) { console.log(`✗ ${c.key} look ${look}: page errors: ${errs.join(' | ')}`); process.exitCode = 1; }
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); if (!ok) bad++; };
const f = (p: Px) => `rgb ${p.rgb.map(v => v.toFixed(0)).join(',')} chroma ${p.chroma.toFixed(3)} hue ${p.hue.toFixed(0)}`;
for (const preset of PRESETS) console.log(`  white wall ${preset.padEnd(6)} look 1 ${f(seen.white[1][preset])}   look 2 ${f(seen.white[2][preset])}`);
for (const preset of PRESETS) console.log(`  cobalt wall ${preset.padEnd(6)} look 1 ${f(seen.cobalt[1][preset])}   look 2 ${f(seen.cobalt[2][preset])}`);

// the white wall: neutral at every hour under look 2, and clearly less tinted than look 1 at golden hour and dusk
for (const preset of PRESETS) {
  const a = seen.white[1][preset], b = seen.white[2][preset], cap = preset === 'day' ? 0.03 : preset === 'golden' ? 0.05 : 0.06;
  check(b.chroma <= cap, `white wall, ${preset}: look 2 is near-neutral (chroma ${b.chroma.toFixed(3)} ≤ ${cap})`, f(b));
  if (preset !== 'day') check(b.chroma <= a.chroma * 0.6, `white wall, ${preset}: look 2 tints it at most 60 % as much as look 1 (${b.chroma.toFixed(3)} vs ${a.chroma.toFixed(3)})`);
}
// the kept cobalt wall: the hue stays blue and the saturation stays high at every hour under look 2, never below look 1's
const day = seen.cobalt[2].day;
for (const preset of PRESETS) {
  const a = seen.cobalt[1][preset], b = seen.cobalt[2][preset];
  check(hueGap(b.hue, day.hue) <= 15, `cobalt wall (palette.keep), ${preset}: look 2 keeps its hue (${b.hue.toFixed(0)}° against ${day.hue.toFixed(0)}° at noon)`);
  check(b.chroma >= 0.5 && b.chroma >= a.chroma - 0.02, `cobalt wall (palette.keep), ${preset}: look 2 keeps its saturation (${b.chroma.toFixed(3)}; look 1 ${a.chroma.toFixed(3)})`);
}
console.log(`${bad ? '✗' : '✓'} the look: ${bad} wrong`);
process.exit(bad || process.exitCode ? 1 : 0);
