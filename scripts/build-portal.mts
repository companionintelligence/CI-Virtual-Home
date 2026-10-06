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
//   <out>/homes/<id>.html            a home's own page (scripts/portal-pages.mts), served at /homes/<id>: its name, what
//                                    it is, its picture, a way into the player, the Companion Core callout, and the
//                                    title, description and thumbnail for link previews (Slack, iMessage, social cards
//                                    never run the player's script, so room-creator.html's static title is all they
//                                    would see). It is also what the player's share button hands out: a link that
//                                    carries a moment (shot, t, tod) forwards to room-creator?mode=view&house=<id> with
//                                    the link's query. Its image is portal/previews/<id>.jpg (1200 × 630 JPEG: LinkedIn
//                                    and some others read no WebP). og:image and og:url are absolute, as unfurlers
//                                    want: the site's address is --site-url, else $SITE_URL, else the live site
//                                    (https://homes.ci.computer/); ci.yml passes a pull request's preview address
//   <out>/404.html, robots.txt, sitemap.xml
//                                    a real 404 page (Pages answers unknown paths with it and a 404 status), robots.txt
//                                    (Allow: / and the Sitemap line) and a sitemap of the gallery and every home's page; every
//                                    page also gets a canonical link, twitter title/description/image and JSON-LD
//   <out>/favicon.ico, apple-touch-icon.png
//                                    the icons at the root, where browsers and crawlers look first (the rest are in portal/icons/)
//   <out>/_headers                   Cloudflare Pages' header rules (portal/_headers): Cache-Control max-age=0 with
//                                    must-revalidate on every file, because the modules below are not fingerprinted
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE,
//                                    fonts/*.woff2 with their licences, brand/
//   <out>/content/houses/            <id>.json and index.json — the specs the page builds (not the .plan.json twins)
//
// The gallery's list of homes is also written into the built index.html (a visitor without JavaScript, and a crawler that does not run
// it, see the homes and can follow each to its page; gallery.js replaces them), and the built pages link each other without
// ".html", as Cloudflare Pages serves them (the file-name address answers a 308).
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No
// goldens, scripts, scenes, videos or TypeScript sources go out. The build refuses to run on stale or missing
// compiled assets (a .ts newer than its .js), and checks that every house in index.json has a spec and a
// thumbnail, that nothing the HTML links is missing from the output, and that the gallery's static hero figures
// (what a crawler or a visitor without JavaScript reads) are the ones gallery.js computes from index.json, that the hand-written
// copy's "thirty" is the number of homes, and that every built page carries the Companion Core, download, docs and main-site links.
//
// Only the paths it writes are replaced in <out>; anything else there (dist/models from export:core) is left.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, serve } from './portal-lib.mts';
import {
  type House, LINKS, SITE_NAME, PLAYER_TITLE, HERO_ALT, TITLE_MAX, TWITTER_SITE, esc, numberWord, capital, galleryCards, galleryHomeIndex, galleryLd, homeDescription, homeLd, homePage, homeTitle, homeUrl, notFoundPage, playerLd,
} from './portal-pages.mts';

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
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', 'homes', '_headers', '.nojekyll', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'apple-touch-icon.png'];
fs.mkdirSync(OUT, { recursive: true });
for (const o of OWNED) fs.rmSync(path.join(OUT, o), { recursive: true, force: true });

// 2. pages, and Cloudflare Pages' header rules (portal/_headers: every file is revalidated, so a deploy never leaves
//    a visitor with the new page and the old modules)
copy('index.html');
copy('room-creator.html');
copy(path.join('portal', '_headers'), '_headers');
// the icons a browser or a crawler asks for at the root (portal/icons/, scripts/build-icons.mts, has the rest)
copy(path.join('portal', 'icons', 'favicon.ico'), 'favicon.ico');
copy(path.join('portal', 'icons', 'apple-touch-icon.png'), 'apple-touch-icon.png');

// 3. portal: styles, script, the hero, the thumbnails, the icons and the manifest
for (const f of walk('portal', f => /\.(css|js|webp|jpg|png|ico|webmanifest)$/.test(f))) copy(f);

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
if (!fs.existsSync(path.join(ROOT, 'portal', 'hero.jpg'))) problems.push('no portal/hero.jpg (the site\'s link-preview image): pnpm run portal:thumbs --house aurora');

// 5b. the gallery's static hero figures must be the data's (gallery.js stats(): homes, distinct builders, floor
// area rounded to 10 m²), or a visitor sees them change as the page hydrates and a crawler keeps the wrong ones; and the
// hand-written copy's count in words ("Walk into thirty homes", "Thirty homes, each built live …") must be the number of homes
// (the generated pages take the word from the data, this one is written by hand)
const houses: House[] = index.houses || [];
const COUNT_WORD = numberWord(houses.length);
{
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
  const h1 = (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || '';
  const description = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  if (!new RegExp(`\\b${COUNT_WORD}\\b`, 'i').test(h1)) problems.push(`index.html: the heading "${h1}" does not say "${COUNT_WORD}", the number of homes in index.json`);
  if (!description.startsWith(`${capital(COUNT_WORD)} homes`)) problems.push(`index.html: the description does not start "${capital(COUNT_WORD)} homes", the number of homes in index.json`);
}

// 5c. a home's own page: homes/<id>.html, one per home (portal-pages.mts, see the header), and the tag that tells the player they exist
const SITE = ((args['site-url'] && args['site-url'] !== 'true' ? args['site-url'] : '') || process.env.SITE_URL || 'https://homes.ci.computer/').replace(/\/?$/, '/');
{
  fs.mkdirSync(path.join(OUT, 'homes'), { recursive: true });
  for (const h of houses) {
    if (!/^[a-z0-9-]+$/.test(h.id)) { problems.push(`house id ${JSON.stringify(h.id)} is not [a-z0-9-]: no page for it`); continue; }
    const page = homePage(h, SITE);
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
// bar: on the site it is the player's title and description and the site's hero instead. The editor works the same; only
// its tab title differs on the deployed site. The gallery also gets its list of homes written in, and its links lose the
// ".html" Cloudflare Pages would answer with a 308.
{
  const hero = new URL('portal/hero.jpg', SITE).href;
  const ix = path.join(OUT, 'index.html');
  let gallery = fs.readFileSync(ix, 'utf8');
  const rel = '<meta property="og:image" content="./portal/hero.jpg">';
  if (!gallery.includes(rel)) problems.push('index.html: no relative og:image for the hero to make absolute');
  gallery = gallery.replace(rel, `<meta property="og:image" content="${esc(hero)}">\n  <meta property="og:url" content="${esc(SITE)}">`);

  // the list of homes, in place of the placeholders (which stay in the source: the page is served as it is in a checkout)
  const list = /(<ul class="grid" id="grid")( aria-busy="true")?>[\s\S]*?<\/ul>/;
  if (!list.test(gallery)) problems.push('index.html: no <ul class="grid" id="grid"> to write the homes into');
  else gallery = gallery.replace(list, (_m, open: string) => `${open}>\n        ${galleryCards(houses)}\n      </ul>`);
  // every home's own page, linked from the footer (the cards go to the player; gallery.js leaves this list as it is)
  const marker = /<!-- foot-homes:[\s\S]*?-->/;
  if (!marker.test(gallery)) problems.push('index.html: no <!-- foot-homes: --> marker to write the list of the homes\' pages at');
  else gallery = gallery.replace(marker, () => galleryHomeIndex(houses));
  // links without ".html", and the mark gallery.js reads to do the same for the cards it draws
  gallery = gallery.replace(/href="\.\/room-creator\.html\?/g, 'href="./room-creator?');
  gallery = gallery.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', m => `${m}\n  <meta name="vh-clean-urls" content="1">`);
  fs.writeFileSync(ix, gallery);

  const rc = path.join(OUT, 'room-creator.html');
  let page = fs.readFileSync(rc, 'utf8');
  const galleryDesc = (gallery.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  const alt = (gallery.match(/<meta property="og:image:alt" content="([^"]*)">/) || [])[1] || '';
  const playerDesc = `Fly through one of ${COUNT_WORD} virtual homes in 3D, built live in your browser from one spec file. Change the hour and meet the Companion Core.`;
  // The player and the editor are one file, a viewer and a tool rather than pages to find: out of the index in the page's own
  // HTML, where a crawler that never runs the page's script reads it (the pages to find are the gallery and each home's page,
  // which link the player). "follow": the links on the page, the way back to the gallery and the Core's, still count.
  const head = `<title>${esc(PLAYER_TITLE)}</title>
  <meta name="description" content="${esc(playerDesc)}">
  <meta name="robots" content="noindex, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(PLAYER_TITLE)}">
  <meta property="og:description" content="${esc(playerDesc)}">
  <meta property="og:image" content="${esc(hero)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${alt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${TWITTER_SITE}">
  <meta name="twitter:image:alt" content="${alt}">`;
  const before = page;
  page = page.replace(/<title>[^<]*<\/title>\s*<meta name="description" content="[^"]*">/, () => head);
  if (page === before) problems.push('room-creator.html: its static <title> and description were not found to replace');
  if (!galleryDesc || !alt) problems.push('index.html: no description or og:image:alt to carry over');
  if (/Room Creator|SimsTree|Pascal Editor/.test(page.slice(0, page.indexOf('<script')))) problems.push('room-creator.html: the static head still names the editor');
  // a module asked for before the import map makes a browser without multiple-import-map support drop the map
  // (and three.js with it): only Chromium would still start
  const map = page.indexOf('<script type="importmap">');
  if (map < 0 || /\bimport\(|type="module"|rel="modulepreload"/.test(page.slice(0, map))) problems.push('room-creator.html: a module is loaded before the import map');
  fs.writeFileSync(rc, page);
}

// 5d2. search and sharing hygiene on every page the site serves: a canonical link, the twitter card's own title, description and
// image, og:url where a page has none, and JSON-LD (portal-pages.mts: the publisher, the site, the list of homes, a home's
// page and its breadcrumb; the player is out of the index, so it gets the twitter tags and the publisher but no canonical); then
// robots.txt, sitemap.xml and a real 404.html. Cloudflare Pages serves pages without their .html
// (homes/aurora.html answers 308 → homes/aurora), so the canonical and sitemap forms are the extensionless ones. The site's only
// CSP is frame-ancestors (portal/_headers), which restricts no script, so the inline JSON-LD needs no header. Idempotent: it
// runs over the copies above, and a tag a page already has is never added twice.
{
  const hero = new URL('portal/hero.jpg', SITE).href;
  // `canonical` is null for a page that is not to be found (the player and the editor: noindex, so no canonical). The link and preview
  // tags go straight after the page's last og:/twitter: tag, near the top of the head (a link unfurler that reads only the first few
  // KB of a page must meet them), the JSON-LD at the end of it.
  const seo = (file: string, canonical: string | null, ld: string): string => {
    const fp = path.join(OUT, file);
    let page = fs.readFileSync(fp, 'utf8');
    const meta = (re: RegExp): string => (page.match(re) || [])[1] || '';
    const title = meta(/<title>([^<]*)<\/title>/);
    const desc = meta(/<meta name="description" content="([^"]*)">/);
    const image = meta(/<meta property="og:image" content="([^"]*)">/) || esc(hero);
    if (!title || !desc) { problems.push(`${file}: no <title> or description for its link-preview tags`); return page; }
    const add: string[] = [];
    if (canonical && !/<link rel="canonical"/.test(page)) add.push(`<link rel="canonical" href="${esc(canonical)}">`);
    if (canonical && !/<meta property="og:url"/.test(page)) add.push(`<meta property="og:url" content="${esc(canonical)}">`);
    if (!/<meta name="twitter:title"/.test(page)) add.push(`<meta name="twitter:title" content="${title}">`);
    if (!/<meta name="twitter:description"/.test(page)) add.push(`<meta name="twitter:description" content="${desc}">`);
    if (!/<meta name="twitter:image"/.test(page)) add.push(`<meta name="twitter:image" content="${image}">`);
    const headEnd = page.indexOf('</head>');
    if (headEnd < 0) { problems.push(`${file}: no </head> for its search tags`); return page; }
    if (add.length) {
      const last = [...page.slice(0, headEnd).matchAll(/<meta (?:property="og:|name="twitter:)[^>]*>/g)].pop();
      if (!last) { problems.push(`${file}: no og: or twitter: tag to put its search tags after`); return page; }
      const at = (last.index ?? 0) + last[0].length;
      page = `${page.slice(0, at)}\n  ${add.join('\n  ')}${page.slice(at)}`;
    }
    if (!/application\/ld\+json/.test(page)) page = page.replace('</head>', () => `  ${ld}\n</head>`);
    fs.writeFileSync(fp, page);
    return page;
  };
  const galleryTitle = (fs.readFileSync(path.join(OUT, 'index.html'), 'utf8').match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const galleryDesc = (fs.readFileSync(path.join(OUT, 'index.html'), 'utf8').match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  seo('index.html', SITE, galleryLd(SITE, houses, galleryTitle, galleryDesc.replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
  seo('room-creator.html', null, playerLd(SITE));
  for (const h of houses) {
    const file = path.join('homes', `${h.id}.html`);
    if (fs.existsSync(path.join(OUT, file))) seo(file, homeUrl(SITE, h.id), homeLd(SITE, h, new URL(`portal/previews/${h.id}.jpg`, SITE).href, homeTitle(h), homeDescription(h)));
  }

  // robots.txt and sitemap.xml: the gallery and one page per home. The player (room-creator) is a viewer for them, not a page
  // of its own: it is noindex in its own HTML (above), so it is not listed.
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', SITE).href}\n`);
  const urls = [SITE, ...houses.filter(h => /^[a-z0-9-]+$/.test(h.id)).map(h => homeUrl(SITE, h.id))];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);

  // 404.html: Pages answers an unknown path with it and a 404 status (without one it answers 200 with the gallery)
  fs.writeFileSync(path.join(OUT, '404.html'), notFoundPage(SITE, COUNT_WORD));
  files += 3;
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
    else {
      // just before the first module the page asks for: after <meta charset>, the title and the preview tags, which a parser's
      // prescan and an unfurler that reads a page's first few KB must reach before the ~8 KB of the map
      const at = page.search(/<link\b[^>]*rel="modulepreload"|<script\b[^>]*type="module"/);
      if (at < 0) problems.push('index.html: nothing loads a module, so there is no place for its import map');
      else page = `${page.slice(0, at)}${importMapBlock(moduleMap)}\n  ${page.slice(at)}`;
    }
    fs.writeFileSync(ix, retag(page, 'index.html'));
  }
  // the pages in homes/ sit one level down: their stylesheet is ../portal/gallery.css
  for (const f of walkOut('homes', f => f.endsWith('.html'))) {
    const fp = path.join(OUT, f);
    const page = fs.readFileSync(fp, 'utf8').replace(/((?:src|href)=")\.\.\/((?:assets|portal)\/[^"?#]+\.(?:js|css))(")/g, (whole, a: string, file: string, z: string) => {
      if (isVendor(file)) return whole;
      if (!hashes.has(file)) { problems.push(`${f}: ../${file} is not in the output, so it cannot be fingerprinted`); return whole; }
      return `${a}../${file}?v=${hashes.get(file)}${z}`;
    });
    fs.writeFileSync(fp, page);
    const left = [...page.matchAll(/(?:src|href)="(\.\.\/(?:assets|portal)\/[^"?#]+\.(?:js|css))"/g)].map(x => x[1]);
    if (left.length) problems.push(`${f}: still names ${left.slice(0, 3).join(', ')} without a content hash`);
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
// (an address without an extension is a page, as Cloudflare Pages serves them: ./homes/aurora is homes/aurora.html)
for (const r of refs) if (!fs.existsSync(path.join(OUT, r)) && !fs.existsSync(path.join(OUT, `${r}.html`))) problems.push(`${r} is linked but not in ${rel(OUT)}`);
// a root-relative URL would escape the /ci-virtual-home/ sub-path
const homePages = fs.existsSync(path.join(OUT, 'homes')) ? fs.readdirSync(path.join(OUT, 'homes')).map(f => path.join('homes', f)) : [];
for (const p of ['index.html', 'room-creator.html', ...homePages, ...walk('portal', f => /\.(css|js)$/.test(f))]) {
  const text = fs.readFileSync(path.join(OUT, p), 'utf8');
  const bad = text.match(/(?:href|src)="\/(?!\/)[^"]*"|url\("?\/(?!\/)[^")]*"?\)|fetch\(['"`]\/(?!\/)/);
  if (bad) problems.push(`${p}: root-relative URL ${bad[0]} breaks under a sub-path`);
}

// 7. what the built pages must carry. These are checks on the output, so a change that drops one fails ci.yml's portal:build,
// not only a local portal:test.
{
  const read = (f: string): string => fs.readFileSync(path.join(OUT, f), 'utf8');
  const tag = (t: string, re: RegExp): string => (t.match(re) || [])[1] || '';
  const alt = (t: string): string => tag(t, /<meta property="og:image:alt" content="([^"]*)">/);
  const titles = new Map<string, string>();
  // what every page's head owes a crawler and a link unfurler, whatever its kind: a title a search result does not cut, the charset
  // inside the first 1024 bytes (a parser's prescan), the preview tags inside the first 4 KB (an unfurler may read no more), and a
  // twitter:image:alt wherever there is an og:image
  const headChecks = (f: string, t: string, title: string): string[] => {
    const out: string[] = [];
    const entities = (v: string): string => v.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (entities(title).length > TITLE_MAX) out.push(`${f}: the title "${title}" is ${entities(title).length} characters; a search result cuts it at about ${TITLE_MAX}`);
    const charset = t.search(/<meta charset=/i);
    if (charset < 0 || charset > 1024) out.push(`${f}: <meta charset> is at byte ${charset}, past the 1024 a parser's prescan reads`);
    const og = t.indexOf('<meta property="og:image"');
    if (og < 0 || og > 4096) out.push(`${f}: the og:image tag is at byte ${og}, past the first 4 KB a link unfurler may stop at`);
    if (og >= 0 && !/<meta name="twitter:image:alt" /.test(t)) out.push(`${f}: an og:image but no twitter:image:alt`);
    return out;
  };
  const pages = ['index.html', ...homePages, '404.html'];
  const need: [string, string][] = [['Companion Intelligence', LINKS.site], ['Buy Companion Core', LINKS.core], ['Download Companion', LINKS.download], ['the docs', LINKS.docs]];
  for (const f of pages) {
    const t = read(f);
    for (const [what, url] of need) if (!t.includes(`href="${url}"`)) problems.push(`${f}: no link to ${what} (${url})`);
    if (/href="https:\/\/ci\.computer\/(core|download)[?#]/.test(t)) problems.push(`${f}: a link to /core or /download carries a query or fragment; link them exactly as ${LINKS.core} and ${LINKS.download}`);
    if (f !== '404.html') for (const url of [LINKS.privacy, LINKS.terms]) if (!t.includes(`href="${url}"`)) problems.push(`${f}: no link to ${url} (the footer's privacy and terms)`);
    // a link that opens a tab must not hand it this page
    for (const a of t.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) if (!/rel="[^"]*noopener/.test(a)) problems.push(`${f}: ${a.slice(0, 80)} opens a tab without rel="noopener"`);
    // Cloudflare's Rocket Loader rewrites every script it is not told to leave alone and runs it late (after the first paint)
    for (const m of t.matchAll(/<script\b([^>]*)>/g)) if (!/type="(importmap|application\/ld\+json)"|data-cfasync="false"/.test(m[1])) problems.push(`${f}: ${m[0].slice(0, 80)} lacks data-cfasync="false"`);
    for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { problems.push(`${f}: its JSON-LD is not valid JSON`); } }
    if ((t.match(/<h1\b/g) || []).length !== 1 || (t.match(/<main\b/g) || []).length !== 1) problems.push(`${f}: it needs exactly one <h1> and one <main>`);
    if (f !== '404.html' && !/<link rel="canonical"/.test(t)) problems.push(`${f}: no canonical link`);
    const title = tag(t, /<title>([^<]*)<\/title>/), desc = tag(t, /<meta name="description" content="([^"]*)">/);
    if (!title || !desc) problems.push(`${f}: no title or description`);
    problems.push(...headChecks(f, t, title));
    if (f.startsWith(`homes${path.sep}`)) {
      if (tag(t, /<meta property="og:title" content="([^"]*)">/) !== title || tag(t, /<meta name="twitter:title" content="([^"]*)">/) !== title) problems.push(`${f}: <title>, og:title and twitter:title are not one string`);
      if (desc.replace(/&quot;|&amp;|&lt;|&gt;/g, '.').length > 160) problems.push(`${f}: the description is over 160 characters and will be cut in a search result`);
      if (titles.has(title)) problems.push(`${f}: the title "${title}" is also ${titles.get(title)}'s`);
      titles.set(title, f);
    }
  }
  // the player, which is out of the index in its own HTML, and says where to go on without JavaScript (its <noscript>)
  {
    const t = read('room-creator.html');
    for (const [what, url] of need) if (!t.includes(`href="${url}"`)) problems.push(`room-creator.html: no link to ${what} (${url}) in its own HTML`);
    if (!/<meta name="robots" content="noindex, follow">/.test(t)) problems.push('room-creator.html: no <meta name="robots" content="noindex, follow"> in its own HTML');
    if (/<link rel="canonical"/.test(t)) problems.push('room-creator.html: a canonical link on a page that is noindex');
    problems.push(...headChecks('room-creator.html', t, tag(t, /<title>([^<]*)<\/title>/)));
  }
  // the gallery's static list is the data's, and its links need no ".html"
  const g = read('index.html');
  const homeIndex = (g.match(/<nav class="foot-homes"[\s\S]*?<\/nav>/) || [''])[0];
  const indexed = [...homeIndex.matchAll(/<a href="\.\/homes\/([^"]+)">/g)].map(m => decodeURIComponent(m[1]));
  if (indexed.join() !== houses.map(h => h.id).join()) problems.push(`index.html: the footer lists ${indexed.length} homes' own pages, index.json has ${houses.length}`);
  if (alt(g) !== HERO_ALT) problems.push('index.html: its og:image:alt is not HERO_ALT (portal-pages.mts), which the 404 page uses');
  const listed = [...g.matchAll(/<li class="card" data-id="([^"]+)"/g)].map(m => m[1]);
  if (listed.join() !== houses.map(h => h.id).join()) problems.push(`index.html: the static list of homes (${listed.length}) is not index.json's (${houses.length})`);
  if (/href="[^"]*room-creator\.html/.test(g)) problems.push('index.html: a link still names room-creator.html (Cloudflare Pages answers it with a 308)');
  // nothing links the gallery by its file name either: ./index.html is answered with a 308 to ./
  for (const f of [...pages, 'room-creator.html']) if (/href="[^"]*\bindex\.html/.test(read(f))) problems.push(`${f}: a link names index.html (Cloudflare Pages answers it with a 308); link ./ or ../`);
  if (!/<meta name="vh-clean-urls"/.test(g)) problems.push('index.html: no vh-clean-urls mark for gallery.js');
  // the player's end card and help panel carry the same four addresses (assets/viewer.ts)
  const viewer = read(path.join('assets', 'viewer.js'));
  for (const url of [LINKS.site, LINKS.core, LINKS.download, LINKS.docs]) if (!viewer.includes(url)) problems.push(`assets/viewer.js: no ${url} (the end card and the help panel)`);
  if (viewer.includes('index.html')) problems.push('assets/viewer.js: names index.html (the player\'s way back is ./: Cloudflare Pages answers index.html with a 308)');
  // titles are distinct across the site's own pages too
  for (const f of ['index.html', 'room-creator.html']) { const t = tag(read(f), /<title>([^<]*)<\/title>/); if (titles.has(t)) problems.push(`${f}: its title "${t}" is also ${titles.get(t)}'s`); titles.set(t, f); }
}

if (problems.length) { console.error(problems.map(p => `  ✗ ${p}`).join('\n')); process.exit(1); }
console.log(`portal: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${rel(OUT)}/`);

// --serve: preview the tree under a sub-path, which proves every URL in it is relative
if (args.serve === 'true') {
  const srv = await serve(OUT, '/ci-virtual-home/', Number(args.port || 8081));
  console.log(`preview: ${srv.url()}  (Ctrl-C to stop)`);
}
