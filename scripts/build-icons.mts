#!/usr/bin/env -S node --experimental-strip-types
// Renders the site's raster icons from the brand mark (assets/brand/ci-logo-mark.svg, the CI canon's mark) into
// portal/icons/, with Chromium (the repo's pinned Playwright), so no image library is added:
//
//   pnpm run portal:icons
//
//   portal/icons/favicon.ico            16, 32 and 48 px PNGs in one ICO (what a browser asks for at /favicon.ico)
//   portal/icons/icon-192.png, icon-512.png   the manifest's icons (the mark on a transparent ground)
//   portal/icons/apple-touch-icon.png   180 px, on the canon's light ground (iOS paints transparency black)
//
// The files are committed, like the thumbnails: portal:build copies them (and puts favicon.ico and
// apple-touch-icon.png at the site's root too, where crawlers and browsers look first). Re-run this after the mark changes.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright } from './portal-lib.mts';

const OUT = path.join(ROOT, 'portal', 'icons');
const svg = fs.readFileSync(path.join(ROOT, 'assets', 'brand', 'ci-logo-mark.svg'));
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;
const GROUND = '#f3faf7';   // the canon's light --background, as portal/gallery.css has it

const pw = await loadPlaywright();
const browser = await pw.chromium.launch();
async function render(size: number, opts: { ground?: string; inset?: number } = {}): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const inner = Math.round(size * (1 - 2 * (opts.inset || 0)));
  await page.setContent(`<!doctype html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${opts.ground || 'transparent'}"><img src="${src}" width="${inner}" height="${inner}" style="display:block"></body>`);
  await page.waitForFunction(() => (document.querySelector('img') as HTMLImageElement).complete);
  const png: Buffer = await page.screenshot({ type: 'png', omitBackground: !opts.ground });
  await ctx.close();
  return png;
}

// an ICO is a small directory followed by the images; modern browsers read PNG entries
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map(i => i.png)]);
}

try {
  fs.mkdirSync(OUT, { recursive: true });
  const small = await Promise.all([16, 32, 48].map(async size => ({ size, png: await render(size) })));
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico(small));
  fs.writeFileSync(path.join(OUT, 'icon-192.png'), await render(192));
  fs.writeFileSync(path.join(OUT, 'icon-512.png'), await render(512));
  fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), await render(180, { ground: GROUND, inset: 0.16 }));
  for (const f of fs.readdirSync(OUT).sort()) console.log(`portal/icons/${f}  ${fs.statSync(path.join(OUT, f)).size} bytes`);
} finally {
  await browser.close();
}
