#!/usr/bin/env -S node --experimental-strip-types
// Assembles the web portal for GitHub Pages: exactly the files the site loads, nothing else.
//
//   pnpm run build && pnpm run portal:build [--out dist] [--site-url https://…/ci-virtual-home/]
//   pnpm run portal:preview [--port 8081]   build, then serve <out> at http://127.0.0.1:8081/ci-virtual-home/
//
//   <out>/index.html                 the gallery (portal/gallery.css + gallery.js, portal/thumbs/, portal/hero.webp)
//   <out>/room-creator.html          the player (?mode=view: portal/viewer.css + assets/viewer.js) and the editor,
//                                    plus one tag: <meta name="vh-share" content="homes/">, which tells the player
//                                    the share pages below exist
//   <out>/homes/<id>.html            what the player's share button hands out: a page with the home's own title,
//                                    description and thumbnail for link previews (Slack, iMessage, social cards
//                                    never run the player's script, so room-creator.html's static title is all they
//                                    would see), which forwards to room-creator.html?mode=view&house=<id> with the
//                                    link's query. --site-url makes og:image absolute, as unfurlers want; the
//                                    Pages workflow passes the site's address
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE,
//                                    fonts/*.woff2 with their licences, brand/
//   <out>/content/houses/            <id>.json and index.json — the specs the page builds (not the .plan.json twins)
//   <out>/.nojekyll                  Pages serves the tree as it is
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No
// goldens, scripts, scenes, videos or TypeScript sources go out. The build refuses to run on stale or missing
// compiled assets (a .ts newer than its .js), and checks that every house in index.json has a spec and a
// thumbnail, that nothing the HTML links is missing from the output, and that the gallery's static hero figures
// (what a crawler or a visitor without JavaScript reads) are the ones gallery.js computes from index.json.
//
// Only the paths it writes are replaced in <out>; anything else there (dist/models from export:core) is left.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, serve } from './portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || path.join(ROOT, 'dist'));
const rel = (p: string): string => path.relative(ROOT, p) || '.';
const problems: string[] = [];
let files = 0, bytes = 0;

function copy(fromRel: string, toRel = fromRel): void {
  const from = path.join(ROOT, fromRel), to = path.join(OUT, toRel);
  if (!fs.existsSync(from)) { problems.push(`missing ${fromRel}`); return; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files++; bytes += fs.statSync(to).size;
}
function walk(dirRel: string, keep: (f: string) => boolean): string[] {
  const out: string[] = [];
  const dir = path.join(ROOT, dirRel);
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const r = path.join(dirRel, name);
    if (fs.statSync(path.join(ROOT, r)).isDirectory()) out.push(...walk(r, keep));
    else if (keep(r)) out.push(r);
  }
  return out;
}

// 0. the compiled engine must exist and be current
const sources = walk('assets', f => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.startsWith(path.join('assets', 'vendor')));
const stale = sources.filter(ts => { const js = path.join(ROOT, ts.replace(/\.ts$/, '.js')); return !fs.existsSync(js) || fs.statSync(js).mtimeMs < fs.statSync(path.join(ROOT, ts)).mtimeMs; });
if (stale.length) { console.error(`compiled assets are missing or older than their source (${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ', …' : ''}): run pnpm run build first`); process.exit(2); }

// 1. start from a clean copy of what this script owns
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', 'homes', '.nojekyll'];
fs.mkdirSync(OUT, { recursive: true });
for (const o of OWNED) fs.rmSync(path.join(OUT, o), { recursive: true, force: true });

// 2. pages
copy('index.html');
copy('room-creator.html');

// 3. portal: styles, script, the hero and the thumbnails
for (const f of walk('portal', f => /\.(css|js|webp)$/.test(f))) copy(f);

// 4. the engine: compiled modules, three.js (whole vendored tree: modules plus LICENSE), fonts, brand
for (const f of sources) copy(f.replace(/\.ts$/, '.js'));
for (const f of walk(path.join('assets', 'vendor'), f => /\.js$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'fonts'), f => /\.woff2$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'brand'), () => true)) copy(f);

// 5. the specs
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8'));
copy(path.join('content', 'houses', 'index.json'));
for (const h of index.houses || []) {
  copy(path.join('content', 'houses', `${h.id}.json`));
  if (!fs.existsSync(path.join(ROOT, 'portal', 'thumbs', `${h.id}.webp`))) problems.push(`no thumbnail for ${h.id}: pnpm run portal:thumbs --house ${h.id}`);
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// 5b. the gallery's static hero figures must be the data's (gallery.js stats(): homes, distinct builders, floor
// area rounded to 10 m²), or a visitor sees them change as the page hydrates and a crawler keeps the wrong ones
{
  const houses: { author?: string; areaSqm?: number }[] = index.houses || [];
  const want: Record<string, string> = {
    homes: String(houses.length),
    builders: String(new Set(houses.map(h => h.author).filter(Boolean)).size),
    area: new Intl.NumberFormat('en').format(Math.round(houses.reduce((a, h) => a + (h.areaSqm || 0), 0) / 10) * 10),
  };
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const [k, v] of Object.entries(want)) {
    const got = html.match(new RegExp(`data-stat="${k}">([^<]*)<`));
    if (!got) problems.push(`index.html: no data-stat="${k}" figure`);
    else if (got[1] !== v) problems.push(`index.html: the static ${k} figure is ${got[1]}, index.json says ${v}`);
  }
}

// 5c. share pages: homes/<id>.html, one per home (see the header), and the tag that tells the player they exist
{
  const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const site = args['site-url'] && args['site-url'] !== 'true' ? args['site-url'].replace(/\/?$/, '/') : '';
  const shortStyle = (s?: string): string => (s || '').split(/[:;,(]| with | over | under /)[0].trim();
  fs.mkdirSync(path.join(OUT, 'homes'), { recursive: true });
  for (const h of index.houses || []) {
    if (!/^[a-z0-9-]+$/.test(h.id)) { problems.push(`house id ${JSON.stringify(h.id)} is not [a-z0-9-]: no share page`); continue; }
    const player = `../room-creator.html?mode=view&house=${h.id}`;
    const image = site ? new URL(`portal/thumbs/${h.id}.webp`, site).href : `../portal/thumbs/${h.id}.webp`;
    const style = shortStyle(h.style);
    const desc = `${style ? `${style}. ` : ''}${h.author ? `After a Sims 4 build by ${h.author}. ` : ''}Built live in 3D in your browser: fly its camera paths and change the hour.`;
    const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(h.name)} · Companion virtual homes</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Companion virtual homes">
  <meta property="og:title" content="${esc(h.name)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:type" content="image/webp">
  <meta property="og:image:width" content="640">
  <meta property="og:image:height" content="360">
  <meta property="og:image:alt" content="${esc(`An aerial view of ${h.name}`)}">${site ? `\n  <meta property="og:url" content="${esc(new URL(`homes/${h.id}.html`, site).href)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="../assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <script>location.replace(${JSON.stringify(player)} + (location.search ? '&' + location.search.slice(1) : '') + location.hash);</script>
</head>
<body>
  <p><a href="${esc(player)}">Open ${esc(h.name)} in 3D</a></p>
</body>
</html>
`;
    fs.writeFileSync(path.join(OUT, 'homes', `${h.id}.html`), page);
    files++; bytes += page.length;
  }
  const rc = path.join(OUT, 'room-creator.html');
  const text = fs.readFileSync(rc, 'utf8');
  if (!text.includes('</head>')) problems.push('room-creator.html has no </head> for the share tag');
  else fs.writeFileSync(rc, text.replace('</head>', '  <meta name="vh-share" content="homes/">\n</head>'));
}

// 6. every relative URL the pages and stylesheets name must be in the output (a query or a fragment is fine)
const refs = new Set<string>();
const scan = (fileRel: string, re: RegExp): void => {
  const text = fs.readFileSync(path.join(OUT, fileRel), 'utf8');
  for (const m of text.matchAll(re)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|#|\$\{|javascript:)/.test(u) || u.includes('${')) continue;
    const clean = u.split(/[?#]/)[0];
    if (!clean) continue;
    refs.add(path.normalize(path.join(path.dirname(fileRel), clean)));
  }
};
for (const p of ['index.html', 'room-creator.html', ...(fs.existsSync(path.join(OUT, 'homes')) ? fs.readdirSync(path.join(OUT, 'homes')).map(f => path.join('homes', f)) : [])]) scan(p, /(?:href|src)="([^"]+)"/g);
for (const p of ['index.html', 'room-creator.html']) scan(p, /from '(\.[^']+)'/g);
for (const p of walk('portal', f => f.endsWith('.css'))) scan(p, /url\("?(\.[^")]+)"?\)/g);
for (const r of refs) if (!fs.existsSync(path.join(OUT, r))) problems.push(`${r} is linked but not in ${rel(OUT)}`);
// a root-relative URL would escape the /ci-virtual-home/ sub-path
for (const p of ['index.html', 'room-creator.html', ...walk('portal', f => /\.(css|js)$/.test(f))]) {
  const text = fs.readFileSync(path.join(OUT, p), 'utf8');
  const bad = text.match(/(?:href|src)="\/(?!\/)[^"]*"|url\("?\/(?!\/)[^")]*"?\)|fetch\(['"`]\/(?!\/)/);
  if (bad) problems.push(`${p}: root-relative URL ${bad[0]} breaks under a sub-path`);
}

if (problems.length) { console.error(problems.map(p => `  ✗ ${p}`).join('\n')); process.exit(1); }
console.log(`portal: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${rel(OUT)}/`);

// --serve: preview the tree the way Pages will serve it, under the repository's sub-path
if (args.serve === 'true') {
  const srv = await serve(OUT, '/ci-virtual-home/', Number(args.port || 8081));
  console.log(`preview: ${srv.url()}  (Ctrl-C to stop)`);
}
