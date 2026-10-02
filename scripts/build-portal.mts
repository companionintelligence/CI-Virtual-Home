#!/usr/bin/env -S node --experimental-strip-types
// Assembles the web portal for Cloudflare Pages: exactly the files the site loads, nothing else.
//
//   pnpm run build && pnpm run portal:build [--out dist] [--site-url https://homes.ci.computer/]
//   pnpm run portal:preview [--port 8081]   build, then serve <out> at http://127.0.0.1:8081/ci-virtual-home/
//
//   <out>/index.html                 the gallery (portal/gallery.css + gallery.js, portal/thumbs/, portal/hero.webp),
//                                    its link-preview image (portal/hero.jpg) and URL made absolute
//   <out>/room-creator.html          the player (?mode=view: portal/viewer.css + assets/viewer.js) and the editor,
//                                    plus one tag: <meta name="vh-share" content="homes/">, which tells the player
//                                    the share pages below exist. Its static title and description are the site's
//                                    (with preview tags), not the editor's: a player URL copied from the address bar
//                                    unfurls as the site, never as the editor
//   <out>/homes/<id>.html            what the player's share button hands out: a page with the home's own title,
//                                    description and thumbnail for link previews (Slack, iMessage, social cards
//                                    never run the player's script, so room-creator.html's static title is all they
//                                    would see), which forwards to room-creator.html?mode=view&house=<id> with the
//                                    link's query. Its image is portal/previews/<id>.jpg (1200 × 630 JPEG: LinkedIn
//                                    and some others read no WebP). og:image and og:url are absolute, as unfurlers
//                                    want: the site's address is --site-url, else $SITE_URL, else the live site
//                                    (https://homes.ci.computer/); ci.yml passes a pull request's preview address
//   <out>/_headers                   Cloudflare Pages' header rules (portal/_headers): Cache-Control max-age=0 with
//                                    must-revalidate on every file, because the modules below are not fingerprinted;
//                                    one year and immutable on the content-hashed binaries (assets/media, content/ao)
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE,
//                                    fonts/*.woff2 with their licences, brand/
//   <out>/content/houses/            <id>.json and index.json — the specs the page builds (not the .plan.json twins)
//   <out>/assets/media/<key>/        the CC0 textures and props the manifest (files.json) lists, each named by a hash of its
//   <out>/content/ao/                content; and the baked occlusion volumes content/ao/manifest.json lists, with it
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No
// goldens, scripts, scenes, videos or TypeScript sources go out. The build refuses to run on stale or missing
// compiled assets (a .ts newer than its .js), and checks that every house in index.json has a spec and a
// thumbnail, that nothing the HTML links is missing from the output, and that the gallery's static hero figures
// (what a crawler or a visitor without JavaScript reads) are the ones gallery.js computes from index.json.
//
// Only the paths it writes are replaced in <out>; anything else there (dist/models from export:core) is left.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, serve } from './portal-lib.mts';
import { checkBinaryAssets } from './portal-assets.mts';
import { aoProblems } from './ao-files.mts';
import { displayName, buildCredit } from '../assets/home-names.js';

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

// 1. start from a clean copy of what this script owns (.nojekyll: an older build wrote it for GitHub Pages; now it is only
//    cleared out of a dist/ that still has one)
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', 'homes', '_headers', '.nojekyll'];
fs.mkdirSync(OUT, { recursive: true });
for (const o of OWNED) fs.rmSync(path.join(OUT, o), { recursive: true, force: true });

// 2. pages, and Cloudflare Pages' header rules (portal/_headers: every file is revalidated, so a deploy never leaves
//    a visitor with the new page and the old modules)
copy('index.html');
copy('room-creator.html');
copy(path.join('portal', '_headers'), '_headers');

// 3. portal: styles, script, the hero and the thumbnails
for (const f of walk('portal', f => /\.(css|js|webp|jpg)$/.test(f))) copy(f);

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
  if (!fs.existsSync(path.join(ROOT, 'portal', 'previews', `${h.id}.jpg`))) problems.push(`no link-preview image for ${h.id}: pnpm run portal:thumbs --house ${h.id}`);
}
// 5a. every home has a baked AO volume (scripts/ao-files.mts; the files themselves ship below, with the other binaries)
problems.push(...aoProblems(path.join(ROOT, 'content', 'ao'), (index.houses || []).map((h: { id: string }) => h.id)));
if (!fs.existsSync(path.join(ROOT, 'portal', 'hero.jpg'))) problems.push('no portal/hero.jpg (the site\'s link-preview image): pnpm run portal:thumbs --house aurora');

// 5a. binary assets (assets/media/** the CC0 textures and props, content/ao/** the baked occlusion volumes): only files that
// carry their content hash in their name and are listed by their owner's manifest go out, and nothing else under those
// directories (scripts/portal-assets.mts has the rules and the reasons; test-binary-guard.mts proves them). The import map
// below fingerprints modules only, so a binary's name is its cache key.
{
  const bin = checkBinaryAssets(ROOT);
  problems.push(...bin.problems);
  if (!bin.problems.length) for (const f of bin.ship) copy(f);
  if (bin.files) console.log(`portal: ${bin.files} binary files (${(bin.mediaBytes / 1048576).toFixed(1)} MB under assets/media), content-hashed and listed`);
}

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
const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SITE = ((args['site-url'] && args['site-url'] !== 'true' ? args['site-url'] : '') || process.env.SITE_URL || 'https://homes.ci.computer/').replace(/\/?$/, '/');
const SITE_TITLE = 'Virtual homes · Companion Intelligence';
const SITE_NAME = 'Companion Intelligence';   // og:site_name on every page: the title says which part of it
{
  const site = SITE;
  const shortStyle = (s?: string): string => (s || '').split(/[:;,(]| with | over | under /)[0].trim();
  fs.mkdirSync(path.join(OUT, 'homes'), { recursive: true });
  for (const h of index.houses || []) {
    if (!/^[a-z0-9-]+$/.test(h.id)) { problems.push(`house id ${JSON.stringify(h.id)} is not [a-z0-9-]: no share page`); continue; }
    const player = `../room-creator.html?mode=view&house=${h.id}`;
    const image = new URL(`portal/previews/${h.id}.jpg`, site).href;
    const style = shortStyle(h.style);
    const name = displayName(h);
    // the credit names the build by its own title where the portal's name differs from it ("After the Sims 4
    // build “Base Game Modern Home” by SimsWithNora"): the unfurl is somewhere a visitor can read it
    const credit = buildCredit(h);
    const desc = `${style ? `${style}. ` : ''}${credit ? `${credit}. ` : ''}Built live in 3D in your browser: fly its camera paths and change the hour.`;
    const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(name)} · Virtual homes</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(name)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(`An aerial view of ${name}`)}">
  <meta property="og:url" content="${esc(new URL(`homes/${h.id}.html`, site).href)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="../assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <script>location.replace(${JSON.stringify(player)} + (location.search ? '&' + location.search.slice(1) : '') + location.hash);</script>
</head>
<body>
  <p><a href="${esc(player)}">Open ${esc(name)} in 3D</a></p>
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

// 5d. link previews for the site's own pages. The gallery's og:image is relative in the source (a checkout has no
// address); here it becomes the site's, with og:url. room-creator.html's static head is the editor's (its title
// and a description naming the editor), which is all an unfurler reads of a player URL copied from the address
// bar: on the site it is the site's title, description and hero instead. The editor works the same; only its
// tab title differs on the deployed site.
{
  const hero = new URL('portal/hero.jpg', SITE).href;
  const ix = path.join(OUT, 'index.html');
  let gallery = fs.readFileSync(ix, 'utf8');
  const rel = '<meta property="og:image" content="./portal/hero.jpg">';
  if (!gallery.includes(rel)) problems.push('index.html: no relative og:image for the hero to make absolute');
  gallery = gallery.replace(rel, `<meta property="og:image" content="${esc(hero)}">\n  <meta property="og:url" content="${esc(SITE)}">`);
  fs.writeFileSync(ix, gallery);

  const rc = path.join(OUT, 'room-creator.html');
  let page = fs.readFileSync(rc, 'utf8');
  const desc = (gallery.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  const head = `<title>${esc(SITE_TITLE)}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(SITE_TITLE)}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${esc(hero)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">`;
  const before = page;
  page = page.replace(/<title>[^<]*<\/title>\s*<meta name="description" content="[^"]*">/, () => head);
  if (page === before) problems.push('room-creator.html: its static <title> and description were not found to replace');
  if (/Room Creator|SimsTree|Pascal Editor/.test(page.slice(0, page.indexOf('<script')))) problems.push('room-creator.html: the static head still names the editor');
  // a module asked for before the import map makes a browser without multiple-import-map support drop the map
  // (and three.js with it): only Chromium would still start
  const map = page.indexOf('<script type="importmap">');
  if (map < 0 || /\bimport\(|type="module"|rel="modulepreload"/.test(page.slice(0, map))) problems.push('room-creator.html: a module is loaded before the import map');
  fs.writeFileSync(rc, page);
}

// 5e. name every module and stylesheet by a hash of its content. The files are not fingerprinted by name (assets/viewer.js is
// the same URL on every deploy), and nothing server-side can be relied on to keep a browser from reusing a stale copy:
// portal/_headers asks for revalidation, but the custom domain's zone can rewrite Cache-Control to hours whatever the
// origin says (it did: homes.ci.computer served .js at max-age=14400 beside pages.dev's max-age=0). A visitor then ran the
// NEW page against OLD modules and every home stopped with "This home could not be opened". So the page itself, which is
// never cached, says which version of each file it wants:
//   - modules: the import map (the page's own, in room-creator.html; one added to index.html) maps each plain URL to
//     ./assets/x.js?v=<hash>. A module's relative imports resolve to the plain URL, which the map rewrites, so a module
//     never needs to know its neighbours' hashes and a change to one file changes only its own URL
//   - <script src> and <link href> to portal/*.js|css and assets/*.js get ?v=<hash> directly
// vendor/three is left alone: it changes only when someone upgrades it on purpose.
{
  const hashOf = (fileRel: string): string => crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, fileRel))).digest('hex').slice(0, 10);
  const walkOut = (dirRel: string, keep: (f: string) => boolean): string[] => {
    const dir = path.join(OUT, dirRel);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).flatMap(name => {
      const r = path.join(dirRel, name);
      return fs.statSync(path.join(OUT, r)).isDirectory() ? walkOut(r, keep) : keep(r) ? [r] : [];
    });
  };
  const isVendor = (f: string): boolean => f.split(path.sep).slice(0, 2).join('/') === 'assets/vendor';
  const modules = walkOut('assets', f => f.endsWith('.js') && !isVendor(f)).map(f => f.split(path.sep).join('/')).sort();
  const sheetsAndScripts = walkOut('portal', f => /\.(js|css)$/.test(f)).map(f => f.split(path.sep).join('/')).sort();
  const hashes = new Map<string, string>([...modules, ...sheetsAndScripts].map(f => [f, hashOf(f)]));
  const versioned = (f: string): string => `./${f}?v=${hashes.get(f)}`;
  const moduleMap: Record<string, string> = Object.fromEntries(modules.map(f => [`./${f}`, versioned(f)]));

  const importMapBlock = (imports: Record<string, string>): string => `<script type="importmap">\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}\n  </script>`;
  const retag = (html: string, name: string): string => html.replace(/((?:src|href)=")(\.\/(?:assets|portal)\/[^"?#]+\.(?:js|css))(")/g, (whole, a: string, url: string, z: string) => {
    const f = url.slice(2);
    if (isVendor(f)) return whole;
    if (!hashes.has(f)) { problems.push(`${name}: ${url} is not in the output, so it cannot be fingerprinted`); return whole; }
    return `${a}${versioned(f)}${z}`;
  });

  // room-creator.html: add to the page's own import map (three.js and its addons stay as they are)
  {
    const rc = path.join(OUT, 'room-creator.html');
    let page = fs.readFileSync(rc, 'utf8');
    const m = page.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!m) problems.push('room-creator.html: no import map to add the module hashes to');
    else {
      let own: Record<string, string> = {};
      try { own = JSON.parse(m[1]).imports || {}; } catch { problems.push('room-creator.html: its import map is not valid JSON'); }
      page = page.replace(m[0], () => importMapBlock({ ...own, ...moduleMap }));
    }
    fs.writeFileSync(rc, retag(page, 'room-creator.html'));
  }
  // index.html: the gallery imports a module of the engine (assets/home-names.js) and had no import map; it goes before
  // anything that loads a module
  {
    const ix = path.join(OUT, 'index.html');
    let page = fs.readFileSync(ix, 'utf8');
    if (/<script type="importmap">/.test(page)) problems.push('index.html: it already has an import map; merge the module hashes into it');
    else if (!/<head[^>]*>/.test(page)) problems.push('index.html: no <head> to put the import map in');
    else page = page.replace(/<head[^>]*>/, tag => `${tag}\n  ${importMapBlock(moduleMap)}`);
    fs.writeFileSync(ix, retag(page, 'index.html'));
  }
  // nothing the pages name may be left un-hashed
  for (const name of ['index.html', 'room-creator.html']) {
    const left = [...fs.readFileSync(path.join(OUT, name), 'utf8').matchAll(/(?:src|href)="(\.\/(?:assets|portal)\/[^"?#]+\.(?:js|css))"/g)].map(x => x[1]).filter(u => !isVendor(u.slice(2)));
    if (left.length) problems.push(`${name}: still names ${left.slice(0, 3).join(', ')} without a content hash`);
  }
  console.log(`portal: ${modules.length} modules and ${sheetsAndScripts.length} portal scripts/styles named by content hash`);
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

// --serve: preview the tree under a sub-path, which proves every URL in it is relative
if (args.serve === 'true') {
  const srv = await serve(OUT, '/ci-virtual-home/', Number(args.port || 8081));
  console.log(`preview: ${srv.url()}  (Ctrl-C to stop)`);
}
