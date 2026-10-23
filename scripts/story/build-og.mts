#!/usr/bin/env -S node --experimental-strip-types
// The link-preview images of the story site: one 1200 x 630 JPEG per family and one for the landing, drawn in Chromium's
// 2D canvas (no WebGL, no GPU) over the pictures `pnpm run portal:thumbs` already made.
//
//   pnpm run portal:og [--families <dir>] [--only <slug,slug>] [--out portal/og]
//
//   portal/og/<slug>.jpg   the family's picture (portal/previews/<house>.jpg) under a left scrim, with
//                          COMPANION CORE · FICTIONAL FAMILY, "The <Surname> family" in Archivo Black, the invented
//                          address, the tagline, the CI mark with "Uncloud your life." bottom left and the pill
//                          "Fictional family. Real software." bottom right
//   portal/og/home.jpg     the same for the landing, over portal/hero.jpg
//   portal/og/manifest.json  { <slug>: { key, file } } where key = hash of the text drawn + the picture under it
//
// Commit the output. scripts/story/site.mts refuses a production build when a family's key no longer matches its text
// and picture (the story changed, or the thumbnails were re-rendered): run this again. No home name, builder or id is in
// the picture or in its file name. Kicker, title and address sit inside the centred 630 px square, so a square crop of
// the card (some feeds do that) still reads. At most 150 KB each.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT as REPO, parseArgs, loadPlaywright } from '../portal-lib.mts';
import { loadAll, storyFiles, ogKey, ogText, type OgText } from './site-lib.mts';
import { FICTIONAL_LINE } from '../../assets/story/types.ts';
import { capital, numberWord } from '../portal-pages.mts';

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(REPO, args.out && args.out !== 'true' ? args.out : path.join('portal', 'og'));
const dir = path.resolve(REPO, args.families && args.families !== 'true' ? args.families : path.join('content', 'families'));
const only = args.only && args.only !== 'true' ? new Set(args.only.split(',')) : null;
const fixtureDir = path.join(REPO, 'test', 'fixtures', 'site', 'families');
const L = loadAll(REPO, storyFiles(dir).length ? dir : fixtureDir);
const MAX_KB = 150;

const b64 = (p: string): string => fs.readFileSync(p).toString('base64');
const fonts = {
  display: `data:font/woff2;base64,${b64(path.join(REPO, 'portal', 'fonts', 'archivo-black.woff2'))}`,
  sans: `data:font/woff2;base64,${b64(path.join(REPO, 'assets', 'fonts', 'manrope-latin-var.woff2'))}`,
  mark: `data:image/svg+xml;base64,${b64(path.join(REPO, 'assets', 'brand', 'ci-logo-mark.svg'))}`,
};

type Job = { name: string; base: string; text: OgText };
const jobs: Job[] = [];
for (const s of L.stories) {
  if (only && !only.has(s.slug)) continue;
  const house = L.casting[s.slug]?.house;
  const base = path.join(REPO, 'portal', 'previews', `${house}.jpg`);
  if (!house || !fs.existsSync(base)) { console.error(`${s.slug}: no preview picture (pnpm run portal:thumbs)`); process.exitCode = 1; continue; }
  jobs.push({ name: s.slug, base, text: ogText('family', s) });
}
if (!only || only.has('home')) jobs.push({ name: 'home', base: path.join(REPO, 'portal', 'hero.jpg'), text: ogText('home', capital(numberWord(L.stories.length))) });

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent('<canvas id="c" width="1200" height="630"></canvas>');
await page.evaluate(async (f: typeof fonts) => {
  const add = async (family: string, src: string, weight: string) => { const ff = new FontFace(family, `url(${src})`, { weight }); await ff.load(); (document as any).fonts.add(ff); };
  await add('OG Archivo', f.display, '400');
  await add('OG Manrope', f.sans, '200 800');
}, fonts);

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest: Record<string, { key: string; file: string }> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

for (const j of jobs) {
  const base = fs.readFileSync(j.base);
  const url: string = await page.evaluate(async ({ base64, t, mark, pill, maxKb }: { base64: string; t: Job['text']; mark: string; pill: string; maxKb: number }) => {
    const c = document.getElementById('c') as HTMLCanvasElement, g = c.getContext('2d')!;
    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    g.drawImage(await load(`data:image/jpeg;base64,${base64}`), 0, 0, 1200, 630);
    // the scrim: the picture's left side goes dark so the words sit on a calm ground (4.5:1 for the small text)
    const grad = g.createLinearGradient(0, 0, 1200 * 0.78, 0);
    grad.addColorStop(0, 'rgba(4,22,32,0.9)'); grad.addColorStop(0.72, 'rgba(4,22,32,0.84)'); grad.addColorStop(1, 'rgba(4,22,32,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 1200, 630);
    g.fillStyle = 'rgba(4,22,32,0.45)'; g.fillRect(0, 520, 1200, 110);
    const wrap = (text: string, font: string, width: number, maxLines: number): string[] => {
      g.font = font;
      const words = text.split(/\s+/), lines: string[] = [];
      let line = '';
      for (const w of words) { const next = line ? `${line} ${w}` : w; if (g.measureText(next).width > width && line) { lines.push(line); line = w; } else line = next; }
      if (line) lines.push(line);
      return lines.slice(0, maxLines);
    };
    const X = 300, W = 560;                                   // inside the centred 630 px square (285 to 915)
    g.textBaseline = 'alphabetic'; g.fillStyle = '#c5e8dc';
    g.font = '800 22px "OG Manrope"';
    (g as any).letterSpacing = '2px';
    g.fillText(t.kicker, X, 128);
    (g as any).letterSpacing = '0px';
    g.fillStyle = '#f2f8fa';
    let size = 64, lines = wrap(t.title, `${size}px "OG Archivo"`, W, 3);
    while (lines.length > 2 && size > 44) { size -= 4; lines = wrap(t.title, `${size}px "OG Archivo"`, W, 3); }
    lines = lines.slice(0, 2);
    g.font = `${size}px "OG Archivo"`;
    let y = 128 + 20 + size;
    for (const l of lines) { g.fillText(l, X, y); y += size * 1.08; }
    g.fillStyle = '#e8f2f4'; g.font = '600 28px "OG Manrope"';
    y += 10; g.fillText(t.line1, X, y);
    g.font = '600 30px "OG Manrope"'; g.fillStyle = '#d4e3e7';
    y += 22;
    for (const l of wrap(t.line2, g.font, W + 30, 2)) { y += 40; g.fillText(l, X, y); }
    // bottom left: the mark and the sign-off; bottom right: the disclosure, on every image
    const m = await load(mark);
    g.drawImage(m, 60, 560, 40, 40);
    g.fillStyle = '#e8f2f4'; g.font = '700 24px "OG Manrope"';
    g.fillText('Uncloud your life.', 114, 589);
    g.font = '700 22px "OG Manrope"';
    const w = g.measureText(pill).width + 40;
    g.fillStyle = '#c5e8dc'; g.beginPath(); g.roundRect(1140 - w, 556, w, 44, 22); g.fill();
    g.fillStyle = '#041620'; g.fillText(pill, 1140 - w + 20, 586);
    let q = 0.9, out = '';
    for (; q >= 0.4; q -= 0.05) { out = c.toDataURL('image/jpeg', q); if ((out.length - 23) * 0.75 <= maxKb * 1024) break; }
    return out;
  }, { base64: base.toString('base64'), t: j.text, mark: fonts.mark, pill: FICTIONAL_LINE, maxKb: MAX_KB });
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  const file = `${j.name}.jpg`;
  fs.writeFileSync(path.join(OUT, file), buf);
  manifest[j.name] = { key: ogKey(j.text, base), file };
  console.log(`  ${path.relative(REPO, path.join(OUT, file))}  ${(buf.length / 1024).toFixed(1)} KB`);
}
fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
await browser.close();
