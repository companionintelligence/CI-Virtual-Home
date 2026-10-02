#!/usr/bin/env -S node --experimental-strip-types
// Assembles the public site for Cloudflare Pages: exactly the files it loads, nothing else.
//
//   pnpm run build && pnpm run portal:build [--out dist] [--site-url https://homes.ci.computer/] [--families <dir>] [--allow-partial]
//   pnpm run portal:preview [--port 8081]   build, then serve <out> at http://127.0.0.1:8081/ci-virtual-home/
//
// The site is thirty fictional families, not the homes the specs were written from, so the part of this build that knows
// about them lives in scripts/story/site.mts (one call, step 5) and this file keeps the engine, the stylesheets and scripts,
// the content hashes, and the checks that nothing is missing or extra:
//
//   <out>/index.html, family/<slug>.html, credits.html      the landing, one page per family, the credits (site.mts)
//   <out>/room-creator.html          the player only (?mode=view&family=<slug>): window.__VH_PUBLIC=1 sends the editor
//                                    page back to the landing, and its static head is the site's, with noindex
//   <out>/story/ content/homes/ portal/{thumbs,posters,og,fonts}/ audio/ film/   data and pictures, every name carrying
//                                    a content hash except story/manifest.json (site.mts and scripts/story/ship/*.mts)
//   <out>/_headers _redirects robots.txt sitemap.xml
//   <out>/portal/*.css *.js          the site's styles and scripts
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE, fonts, brand
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No goldens, scripts,
// scenes, videos, TypeScript sources or content/houses go out (the specs ship sanitised under content/homes/). The build
// refuses to run on stale or missing compiled assets (a .ts newer than its .js), and fails when a page links something that
// is not in the output or the output holds a file nothing asked for.
//
// Only the paths it writes are replaced in <out>; anything else there (dist/models from export:core) is left.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, serve } from './portal-lib.mts';
import { buildStorySite } from './story/site.mts';

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || path.join(ROOT, 'dist'));
const rel = (p: string): string => path.relative(ROOT, p) || '.';
const problems: string[] = [];
let files = 0, bytes = 0;
const shipped = new Set<string>();   // every file written, as a path under <out>: the allowlist the last check holds the output to

function copy(fromRel: string, toRel = fromRel): void {
  const from = path.join(ROOT, fromRel), to = path.join(OUT, toRel);
  if (!fs.existsSync(from)) { problems.push(`missing ${fromRel}`); return; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  shipped.add(toRel.split(path.sep).join('/'));
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
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', 'homes', 'family', 'story', 'audio', 'film', 'credits.html', 'sitemap.xml', 'robots.txt', '_redirects', '_headers', '.nojekyll'];
fs.mkdirSync(OUT, { recursive: true });
for (const o of OWNED) fs.rmSync(path.join(OUT, o), { recursive: true, force: true });

// 2. pages, and Cloudflare Pages' header rules (portal/_headers: every file is revalidated, so a deploy never leaves
//    a visitor with the new page and the old modules)
copy('room-creator.html');
copy(path.join('portal', '_headers'), '_headers');

// 3. the site's styles and scripts (pictures and fonts ship with a content hash, from site.mts)
for (const f of walk('portal', f => /\.(css|js)$/.test(f))) copy(f);

// 4. the engine: compiled modules, three.js (whole vendored tree: modules plus LICENSE), fonts, brand
for (const f of sources) copy(f.replace(/\.ts$/, '.js'));
for (const f of walk(path.join('assets', 'vendor'), f => /\.js$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'fonts'), f => /\.woff2$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'brand'), () => true)) copy(f);

// 5. the story site: the families' pages, the sanitised specs, the pictures, the data, the manifest and the player's public head
const SITE = ((args['site-url'] && args['site-url'] !== 'true' ? args['site-url'] : '') || process.env.SITE_URL || 'https://homes.ci.computer/').replace(/\/?$/, '/');
{
  const r = await buildStorySite({ ROOT, OUT, SITE, args, problems, track: f => { shipped.add(f); } });
  files += r.files; bytes += r.bytes;
}
if (problems.length) { console.error(problems.map(p => `  ✗ ${p}`).join('\n')); process.exit(1); }   // (the steps below read the pages it writes)

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
  const versioned = (f: string, prefix = './'): string => `${prefix}${f}?v=${hashes.get(f)}`;
  const moduleMap: Record<string, string> = Object.fromEntries(modules.map(f => [`./${f}`, versioned(f)]));
  // the landing warms three.js, the builder and the player when a card is pointed at (portal/gallery.js), by the URL the
  // player will ask for: these two are the only modules it names, so its import map holds only them
  const WARM = ['assets/house-builder.js', 'assets/viewer.js'];
  const warmMap: Record<string, string> = Object.fromEntries(WARM.map(f => [`./${f}`, versioned(f)]));

  const importMapBlock = (imports: Record<string, string>): string => `<script type="importmap">\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}\n  </script>`;
  const retag = (html: string, name: string): string => html.replace(/((?:src|href)=")((?:\.\.?\/)(?:assets|portal)\/[^"?#]+\.(?:js|css))(")/g, (whole, a: string, url: string, z: string) => {
    const f = url.replace(/^\.\.?\//, '');
    if (isVendor(f)) return whole;
    if (!hashes.has(f)) { problems.push(`${name}: ${url} is not in the output, so it cannot be fingerprinted`); return whole; }
    return `${a}${versioned(f, url.slice(0, url.length - f.length))}${z}`;
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
  // index.html: no module of its own is imported, but the warm-up needs the player's hashed URLs; the map goes before
  // anything that loads a module
  {
    const ix = path.join(OUT, 'index.html');
    let page = fs.readFileSync(ix, 'utf8');
    if (/<script type="importmap">/.test(page)) problems.push('index.html: it already has an import map; merge the module hashes into it');
    else if (!/<head[^>]*>/.test(page)) problems.push('index.html: no <head> to put the import map in');
    else page = page.replace(/<head[^>]*>/, tag => `${tag}\n  ${importMapBlock(warmMap)}`);
    fs.writeFileSync(ix, retag(page, 'index.html'));
  }
  // the static pages (the families', the credits) link the same stylesheets and script, one folder up for a family
  const staticPages = [...(fs.existsSync(path.join(OUT, 'family')) ? fs.readdirSync(path.join(OUT, 'family')).map(f => path.join('family', f)) : []), 'credits.html'];
  for (const name of staticPages) fs.writeFileSync(path.join(OUT, name), retag(fs.readFileSync(path.join(OUT, name), 'utf8'), name));
  // nothing the pages name may be left un-hashed
  for (const name of ['index.html', 'room-creator.html', ...staticPages]) {
    const left = [...fs.readFileSync(path.join(OUT, name), 'utf8').matchAll(/(?:src|href)="(\.\.?\/(?:assets|portal)\/[^"?#]+\.(?:js|css))"/g)].map(x => x[1]).filter(u => !isVendor(u.replace(/^\.\.?\//, '')));
    if (left.length) problems.push(`${name}: still names ${left.slice(0, 3).join(', ')} without a content hash`);
  }
  console.log(`portal: ${modules.length} modules and ${sheetsAndScripts.length} portal scripts/styles named by content hash`);
}

// 6. every relative URL the pages and stylesheets name must be in the output (a query or a fragment is fine)
const refs = new Set<string>();
const scan = (fileRel: string, re: RegExp, map: (u: string) => string = u => u): void => {
  const text = fs.readFileSync(path.join(OUT, fileRel), 'utf8');
  for (const m of text.matchAll(re)) {
    const u = map(m[1]);
    if (/^(https?:|data:|mailto:|#|\$\{|javascript:)/.test(u) || u.includes('${')) continue;
    const clean = u.split(/[?#]/)[0];
    if (!clean) continue;
    refs.add(path.normalize(path.join(path.dirname(fileRel), clean)));
  }
};
const pages = ['index.html', 'room-creator.html', 'credits.html', ...(fs.existsSync(path.join(OUT, 'family')) ? fs.readdirSync(path.join(OUT, 'family')).map(f => path.join('family', f)) : [])];
// (the pages link a family extensionless, `family/<slug>` and `./<slug>` from one family to the next, which the host serves
// from <slug>.html)
const sub = (u: string, from: string): string => u.replace(/^([^?#]*)([?#].*)?$/, (_, p: string, rest = '') => (from.startsWith('family') ? /^\.\/[a-z-]+$/.test(p) : /^(\.\/)?family\/[a-z-]+$/.test(p)) ? `${p}.html${rest}` : u);
for (const p of pages) scan(p, /(?:href|src)="([^"]+)"/g, u => sub(u, p));
for (const p of ['index.html', 'room-creator.html']) scan(p, /from '(\.[^']+)'/g);
for (const p of walk('portal', f => f.endsWith('.css'))) scan(p, /url\("?(\.[^")]+)"?\)/g);
for (const r of refs) if (!fs.existsSync(path.join(OUT, r))) problems.push(`${r} is linked but not in ${rel(OUT)}`);
// a root-relative URL would escape the /ci-virtual-home/ sub-path
for (const p of [...pages, ...walk('portal', f => /\.(css|js)$/.test(f))]) {
  const text = fs.readFileSync(path.join(OUT, p), 'utf8');
  const bad = text.match(/(?:href|src)="\/(?!\/)[^"]*"|url\("?\/(?!\/)[^")]*"?\)|fetch\(['"`]\/(?!\/)/);
  if (bad) problems.push(`${p}: root-relative URL ${bad[0]} breaks under a sub-path`);
}

// 7. the allowlist: every file in the output is one this build wrote (what the site loads, nothing else), and nothing it wrote is gone
{
  const onDisk = new Set<string>();
  const sweep = (relDir: string): void => {
    const dir = path.join(OUT, relDir);
    if (!fs.existsSync(dir)) return;
    for (const n of fs.readdirSync(dir)) { const r = relDir ? `${relDir}/${n}` : n; if (fs.statSync(path.join(OUT, r)).isDirectory()) sweep(r); else onDisk.add(r); }
  };
  for (const o of OWNED) { if (fs.existsSync(path.join(OUT, o))) { if (fs.statSync(path.join(OUT, o)).isDirectory()) sweep(o); else onDisk.add(o); } }
  const extra = [...onDisk].filter(f => !shipped.has(f)), missing = [...shipped].filter(f => !onDisk.has(f));
  if (extra.length) problems.push(`${extra.length} file${extra.length === 1 ? '' : 's'} in ${rel(OUT)} nothing asked for: ${extra.slice(0, 4).join(', ')}${extra.length > 4 ? ', …' : ''}`);
  if (missing.length) problems.push(`${missing.length} file${missing.length === 1 ? '' : 's'} the build wrote are gone: ${missing.slice(0, 4).join(', ')}`);
}

if (problems.length) { console.error(problems.map(p => `  ✗ ${p}`).join('\n')); process.exit(1); }
console.log(`portal: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${rel(OUT)}/`);

// --serve: preview the tree under a sub-path, which proves every URL in it is relative
if (args.serve === 'true') {
  const srv = await serve(OUT, '/ci-virtual-home/', Number(args.port || 8081));
  console.log(`preview: ${srv.url()}  (Ctrl-C to stop)`);
}
