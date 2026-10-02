#!/usr/bin/env -S node --experimental-strip-types
// Gallery thumbnails for the portal: one aerial ¾ exterior per house, roofs on, walls up, in the house's own
// light, through the same composer the videos use (GTAO, bloom, grade, SMAA, 2× supersampling).
//
//   pnpm run portal:thumbs [--house aurora,mirage] [--hero aurora] [--no-hero] [--max-kb 60] [--out portal/thumbs]
//
//   portal/thumbs/<id>.webp     640 × 360, ≤ --max-kb (quality stepped down until it fits)
//   portal/hero.webp            1600 × 900 of --hero (default: the featured family's house, the one the landing's hero shows), ≤ 190 KB
//   portal/previews/<id>.jpg    1200 × 630 JPEG, ≤ 110 KB: the link-preview image of the home's share page
//   portal/hero.jpg             1200 × 630 JPEG of the hero, ≤ 170 KB: the base of the landing's link preview (pnpm run portal:og)
//
// The previews are JPEG, not WebP, and 1.91:1: that is what every unfurler takes (LinkedIn reads no WebP), and
// the size they show large. They are the same framing, rendered at 720p and cropped top and bottom.
//
// The camera stands in front of the entry (anchors.entry.out is the door's outward normal), swung 34° away from
// the side the time-of-day rig puts the sun on (so the façade takes the light and the flank the camera also sees
// falls into shade), 34° up, far enough back for the bounds to fill the frame: the aerial ¾ framing of the look
// reviews, aimed per house instead of at one fixed bearing. SIDE below flips a house by hand; THUMB_SIDE=1|-1
// in the environment forces one side for every house, for comparing the two.
// Rendering is __houseSnapshot (a JPEG at q 1.0 of one composer frame); the page re-encodes it to WebP or JPEG
// itself (canvas.toDataURL), so nothing here needs an image library. The frames are deterministic, so
// re-running on an unchanged tree rewrites the same files.
//
// Commit the output: the gallery never runs WebGL, so these files ARE the gallery.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, houseIds } from './portal-lib.mts';
import { FEATURED } from './story/site-lib.mts';

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || path.join(ROOT, 'portal', 'thumbs'));
const PREVIEWS = path.join(path.dirname(OUT), 'previews');
const HOUSES = args.house ? args.house.split(',').filter(Boolean) : houseIds();
// the landing's hero is the featured family's home (scripts/story/site-lib.mts FEATURED); the pictures keep the house's own name
// here because this tool is internal and its output is renamed by slug, with a hash, when the site is built
const featuredHouse = ((): string => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'casting.json'), 'utf8')).families.find((f: { slug: string }) => f.slug === FEATURED).house; } catch { return 'aurora'; } })();
const HERO = args['no-hero'] === 'true' ? null : (args.hero || featuredHouse);
const MAX_KB = Number(args['max-kb'] || 60);
const HERO_MAX_KB = Number(args['hero-max-kb'] || 190);
const HERO_TOD = args['hero-tod'] || null;   // e.g. golden; default: the house's own hour
// Houses where the side away from the sun hides what the house is about, picked by eye from a contact sheet of
// both sides (lakecabin's glass solarium faces the sun's side).
const SIDE: Record<string, number> = { lakecabin: -1 };

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEWS, { recursive: true });
const srv = await serve(ROOT, '/');
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });

type Shot = { res: string; w: number; h: number; maxKb: number; file: string; tod?: string | null; tight?: number; type?: 'webp' | 'jpeg' };
async function render(id: string, shots: Shot[]): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e: Error) => console.error(`  ${id}: page error: ${e.message.split('\n')[0]}`));
  await stubGoogleFonts(page, srv.origin);
  try {
    await page.goto(srv.url(`room-creator.html?house=${encodeURIComponent(id)}`), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    const side = Number(process.env.THUMB_SIDE || SIDE[id] || 0);
    if (side) await page.evaluate((v: number) => { (window as any).__thumbSide = v; }, side);
    const own: string | null = await page.evaluate(() => (window as any).__houseLighting?.preset || null);
    for (const s of shots) {
      // a shot with no hour of its own is in the house's (a hero at --hero-tod does not carry over to the next)
      const want = s.tod || own;
      if (want && want !== await page.evaluate(() => (window as any).__houseLighting?.preset)) await page.evaluate((tod: string) => (window as any).__houseSetLighting(tod), want);
      await page.evaluate((res: string) => (window as any).__houseComposerWarm({ res }), s.res);
      const out = await page.evaluate(async ({ res, w, h, maxKb, tight = 1, type = 'webp' }: Shot) => {
        const W = window as any;
        const d = W.__houseDebug(), a = d.house.anchors, b = a.bounds;
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
        const out = (a.entry && a.entry.out) || [0, 1];
        // bearing of the entry's outward normal, measured like look.mjs's azimuth (from +z toward +x)
        const front = Math.atan2(out[0], out[1]) * 180 / Math.PI;
        // The rig swings the sun round from the entry bearing (TIME_OF_DAY sun.swing), so the front is lit. Stand
        // on the other side of the front from the sun: the façade takes the light and the flank the camera also
        // sees falls into shade, which is what gives a small picture its depth.
        const sun = W.__houseLighting && W.__houseLighting.sun;
        let side = 1;
        if (sun) { const d = Math.atan2(sun[0], sun[2]) * 180 / Math.PI - front; side = -Math.sign(((d + 540) % 360) - 180) || 1; }
        if (W.__thumbSide) side = W.__thumbSide;
        const az = (front + side * 34) * Math.PI / 180, el = 34 * Math.PI / 180, dist = (span * 1.45 + 5) * tight;
        const cam = d.camera;
        cam.position.set(cx + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, cz + Math.cos(az) * Math.cos(el) * dist);
        cam.lookAt(cx, 1.0, cz);
        cam.fov = 38; cam.updateProjectionMatrix();
        const jpeg = W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality: 1 });
        const img = new Image(); img.src = jpeg; await img.decode();
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        // a target wider than the 16:9 render (a 1.91:1 preview) takes the middle band of it
        const sw = img.width, sh = Math.min(img.height, Math.round(img.width * h / w));
        const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
        let q = 0.86, url = '';
        for (; q >= 0.4; q -= 0.04) { url = c.toDataURL(`image/${type}`, q); if ((url.length - 23) * 0.75 <= maxKb * 1024) break; }
        return { url, q: +q.toFixed(2) };
      }, s);
      if (!out.url.startsWith(`data:image/${s.type || 'webp'}`)) throw new Error(`this Chromium cannot encode ${s.type || 'webp'}`);
      const buf = Buffer.from(out.url.slice(out.url.indexOf(',') + 1), 'base64');
      fs.writeFileSync(s.file, buf);
      console.log(`  ${path.relative(ROOT, s.file)}  ${(buf.length / 1024).toFixed(1)} KB  q ${out.q}`);
    }
  } finally {
    await ctx.close();
  }
}

// the hero, as the gallery shows it and as a link preview
const heroShots = (): Shot[] => [
  { res: '1080', w: 1600, h: 900, maxKb: HERO_MAX_KB, file: path.join(ROOT, 'portal', 'hero.webp'), tod: HERO_TOD, tight: 1.08 },
  { res: '1080', w: 1200, h: 630, maxKb: 170, file: path.join(ROOT, 'portal', 'hero.jpg'), tod: HERO_TOD, tight: 1.08, type: 'jpeg' },
];
let failed = 0;
for (const id of HOUSES) {
  const shots: Shot[] = [{ res: '360', w: 640, h: 360, maxKb: MAX_KB, file: path.join(OUT, `${id}.webp`) }];
  if (id === HERO) shots.push(heroShots()[0]);
  shots.push({ res: '720', w: 1200, h: 630, maxKb: 110, file: path.join(PREVIEWS, `${id}.jpg`), type: 'jpeg' });
  if (id === HERO) shots.push(heroShots()[1]);
  try { await render(id, shots); } catch (err) { failed++; console.error(`  ${id}: ${(err as Error).message}`); }
}
if (HERO && !HOUSES.includes(HERO)) {
  try { await render(HERO, heroShots()); } catch (err) { failed++; console.error(`  hero ${HERO}: ${(err as Error).message}`); }
}
await browser.close();
await srv.close();
console.log(failed ? `${failed} failed` : `${HOUSES.length} thumbnails${HERO ? ' and the hero' : ''} written`);
process.exit(failed ? 1 : 0);
