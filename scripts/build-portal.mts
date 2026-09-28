#!/usr/bin/env -S node --experimental-strip-types
// Assembles the web portal for GitHub Pages: exactly the files the site loads, nothing else.
//
//   pnpm run build && pnpm run portal:build [--out dist]
//   pnpm run portal:preview [--port 8081]   build, then serve <out> at http://127.0.0.1:8081/ci-virtual-home/
//
//   <out>/index.html                 the gallery (portal/gallery.css + gallery.js, portal/thumbs/, portal/hero.webp)
//   <out>/room-creator.html          the player (?mode=view: portal/viewer.css + assets/viewer.js) and the editor
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE,
//                                    fonts/*.woff2 with their licences, brand/
//   <out>/content/houses/            <id>.json and index.json — the specs the page builds (not the .plan.json twins)
//   <out>/.nojekyll                  Pages serves the tree as it is
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No
// goldens, scripts, scenes, videos or TypeScript sources go out. The build refuses to run on stale or missing
// compiled assets (a .ts newer than its .js), and checks that every house in index.json has a spec and a
// thumbnail and that nothing the HTML links is missing from the output.
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
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', '.nojekyll'];
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
for (const p of ['index.html', 'room-creator.html']) scan(p, /(?:href|src)="([^"]+)"/g);
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
