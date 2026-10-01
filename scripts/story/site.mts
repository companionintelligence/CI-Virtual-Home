// The story site's part of `pnpm run portal:build`: everything that turns thirty authored families into the public
// pages. One call from scripts/build-portal.mts (replacing its old steps 5 to 5d).
//
//   content/families/<slug>.json      the authored stories (or --families <dir>)
//   content/houses/<id>.json          the specs, which ship sanitised (name, author, source, emoji, $schema removed)
//   portal/thumbs, previews, og, hero the committed pictures, which ship under their slug with a content hash
//
//   -> <out>/content/homes/<slug>.<hash10>.json            the sanitised spec the player builds
//      <out>/portal/{thumbs,posters,og}/<slug>.<hash10>.*  pictures (and portal/hero.<hash10>.webp, portal/og/home.<hash10>.jpg)
//      <out>/portal/fonts/*.<hash10>.woff2                 Archivo Black (the hashed name is written into site.css)
//      <out>/story/families.<hash10>.json                  the landing's card data (type FamiliesIndex)
//      <out>/story/legacy.<hash10>.json                    old ?house=<id> links: sha256(id)[0..12] -> slug
//      <out>/story/manifest.json                           the one un-hashed data file (type SiteManifest)
//      <out>/family/<slug>.html, credits.html, index.html  static pages
//      <out>/sitemap.xml, robots.txt, _redirects
//      <out>/room-creator.html                             the player: window.__VH_PUBLIC=1, the site's head, noindex
//   and whatever scripts/story/ship/*.mts add (audio, the runtime story, films) through the ShipCtx seam.
//
// Public means no home name, no builder, no Sims reference and no internal house id on any page, in any URL or file
// name (scripts/story/check-leaks.mts and portal:test scan for them). The ONE residual is the `id` value inside a
// sanitised spec (it seeds the geometry, so it cannot change) and the legacy `_redirects` lines.
//
// A production build (the site's address is https://homes.ci.computer/) needs all thirty families. Any other address
// (a preview, a checkout) builds whatever families exist, with noindex; with none it builds the three test families in
// test/fixtures/site/families so the pipeline always has something to run on. `--allow-partial` says so out loud.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FamiliesIndex, SiteManifest } from '../../assets/story/types.ts';
import type { ShipCtx, ShipFn, ManifestKey } from './hooks.ts';
import { SHIP_GLOB } from './hooks.ts';
import {
  hash10, legacyKey, esc, readJson, slugProblem, sanitiseSpec, loadAll, storyFiles, landingOrder, cardOf, topicsOf, TOPICS, FEATURED,
  ogKey, ogText, disclosure,
} from './site-lib.mts';
import type { Card } from './site-lib.mts';
import * as pg from './pages.mts';
import { needles } from './check-leaks.mts';

const walkOut = (dir: string): string[] => fs.existsSync(dir) ? fs.readdirSync(dir).flatMap(n => { const p = path.join(dir, n); return fs.statSync(p).isDirectory() ? walkOut(p) : [p]; }) : [];
const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** One pattern for everything check-leaks.mts looks for in prose: builders, Sims builds, names, and ids with a creator in them. */
function leakNeedle(root: string): RegExp {
  const n = needles(root);
  return new RegExp([...n.names, ...n.fragmentIds, 'Sims 4', 'The Sims', 'SimsTree', 'Base Game'].map(reEsc).join('|'), 'i');
}

export const PROD_HOST = 'homes.ci.computer';

/**
 * Take out of a shipped script the COMMENTS that name a home, a builder, a Sims build or an id (a whole `//` line, a
 * trailing `// ...`, a block or HTML comment). The engine's source comments cite the specs they were tuned on ("familyhouse-nora
 * L1", "Villa Mesa Mariposa"); they are history for the repo, and the public site is not the place. Code is never touched:
 * a needle in code is a finding for scripts/story/check-leaks.mts, not something to hide.
 */
export function stripLeakyComments(text: string, needle: RegExp): string {
  const has = (s: string): boolean => needle.test(s);
  let out = text.replace(/\/\*[\s\S]*?\*\//g, m => (has(m) ? '' : m)).replace(/<!--[\s\S]*?-->/g, m => (has(m) ? '' : m));
  out = out.split('\n').map(line => {
    if (!has(line)) return line;
    if (/^\s*\/\//.test(line)) return null;
    const m = /^(.*?[;,{}()\]]\s*)\/\/(?!\/).*$/.exec(line);   // a code line with a trailing comment (a "//" inside a string has a quote before it)
    return m && !/['"`][^'"`]*$/.test(m[1]) && !has(m[1]) ? m[1].trimEnd() : line;
  }).filter((l): l is string => l !== null).join('\n');
  return out;
}
export type BuildArgs = Record<string, string>;
export type SiteResult = { files: number; bytes: number; partial: boolean; noindex: boolean; families: number };

export async function buildStorySite(o: { ROOT: string; OUT: string; SITE: string; args: BuildArgs; problems: string[]; track: (rel: string) => void }): Promise<SiteResult> {
  const { ROOT, OUT, SITE, args, problems, track } = o;
  let files = 0, bytes = 0;
  const problem = (m: string): void => { problems.push(m); };
  const posix = (p: string): string => p.split(path.sep).join('/');
  const put = (rel: string, data: Uint8Array | string): string => {
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    track(posix(rel)); files++; bytes += typeof data === 'string' ? Buffer.byteLength(data) : data.length;
    return posix(rel);
  };
  const putHashed = (srcAbs: string, dstDir: string, name?: string): string => {
    const buf = fs.readFileSync(srcAbs);
    const base = name || path.basename(srcAbs).replace(/\.[0-9a-f]{10}(\.[^.]+)$/, '$1');
    const ext = path.extname(base);
    return put(path.join(dstDir, `${base.slice(0, base.length - ext.length)}.${hash10(buf)}${ext}`), buf);
  };

  // ---- which families, and how many
  const isProd = new URL(SITE).host === PROD_HOST;
  const asked = args['allow-partial'] === 'true';
  let dir = path.resolve(ROOT, args.families && args.families !== 'true' ? args.families : path.join('content', 'families'));
  let usingFixtures = false;
  // (a production build never falls back: a site with three test families must not reach the live address)
  const partialOk = asked || !isProd;
  if (!storyFiles(dir).length && partialOk) { dir = path.join(ROOT, 'test', 'fixtures', 'site', 'families'); usingFixtures = true; }
  const L = loadAll(ROOT, dir);
  const { stories, casting, claims, catalog } = L;
  const castingCount = Object.keys(casting).length;
  const partial = stories.length < castingCount;
  if (partial && !partialOk) problem(`${stories.length} of ${castingCount} families: the production site (https://${PROD_HOST}/) needs all of them (content/families/<slug>.json); a development or preview build can say --allow-partial`);
  if (!stories.length) { problem(`no families in ${path.relative(ROOT, dir)}`); return { files, bytes, partial, noindex: true, families: 0 }; }
  if (usingFixtures) console.log(`story: no families in content/families yet, so this build uses the ${stories.length} test families in test/fixtures/site/families (noindex)`);
  else if (partial) console.log(`story: ${stories.length} of ${castingCount} families (a partial build: noindex)`);
  const noindex = !isProd || partial || usingFixtures;

  // ---- checks on each family (the validator does the rest: pnpm run story:validate)
  const seen = new Set<string>();
  for (const s of stories) {
    const sp = slugProblem(s.slug); if (sp) problem(sp);
    if (seen.has(s.slug)) problem(`two families share the slug ${s.slug}`); seen.add(s.slug);
    const c = casting[s.slug];
    if (!c) { problem(`${s.slug}: not in content/story/casting.json`); continue; }
    if (s.house !== c.house) problem(`${s.slug}: its house is not the one the casting gives it`);
    if (s.schema !== 'family/v1' || s.fictional !== true) problem(`${s.slug}: not a family/v1 file with fictional: true`);
    for (const b of s.beats) {
      if (b.app && !catalog[b.app.id]) problem(`${s.slug}/${b.id}: the app ${b.app.id} is not in the Companion Hub catalog snapshot`);
      else if (b.app && (catalog[b.app.id] as any).inLiveStore === false) problem(`${s.slug}/${b.id}: the app ${b.app.id} is not in the live store`);
    }
  }

  // ---- the order, the pictures, the cards
  const order = landingOrder(stories);
  const sorted = order.map(slug => stories.find(s => s.slug === slug)!);
  const ogManifestPath = path.join(ROOT, 'portal', 'og', 'manifest.json');
  const ogManifest: Record<string, { key: string; file: string }> = fs.existsSync(ogManifestPath) ? readJson(ogManifestPath) : {};
  const pic = (rel: string): string => path.join(ROOT, rel);
  const urls: Record<string, { spec: string; thumb: string; poster: string; og: string }> = {};
  let ogMissing = 0;
  for (const s of sorted) {
    const house = casting[s.slug]?.house; if (!house) continue;
    const specSrc = pic(path.join('content', 'houses', `${house}.json`));
    if (!fs.existsSync(specSrc)) { problem(`${s.slug}: its house has no spec`); continue; }
    const san = sanitiseSpec(fs.readFileSync(specSrc, 'utf8'));
    if (san.problem) problem(`${s.slug}: ${san.problem}`);
    const spec = put(path.join('content', 'homes', `${s.slug}.${hash10(san.text)}.json`), san.text);
    const need = (rel: string, hint: string): string => { if (!fs.existsSync(pic(rel))) { problem(`${s.slug}: no ${rel}: ${hint}`); return ''; } return pic(rel); };
    const t = need(path.join('portal', 'thumbs', `${house}.webp`), 'pnpm run portal:thumbs'), pv = need(path.join('portal', 'previews', `${house}.jpg`), 'pnpm run portal:thumbs');
    const thumb = t ? putHashed(t, path.join('portal', 'thumbs'), `${s.slug}.webp`) : '';
    const poster = pv ? putHashed(pv, path.join('portal', 'posters'), `${s.slug}.jpg`) : '';
    // the link-preview image: committed by `pnpm run portal:og`, whose manifest says what text and picture it was drawn from
    let og = '';
    const ogFile = pic(path.join('portal', 'og', `${s.slug}.jpg`)), entry = ogManifest[s.slug];
    const fresh = fs.existsSync(ogFile) && pv && entry && entry.key === ogKey(ogText('family', s), fs.readFileSync(pv));
    if (fresh) og = putHashed(ogFile, path.join('portal', 'og'), `${s.slug}.jpg`);
    else { ogMissing++; if (isProd && !partial) problem(`${s.slug}: its link-preview image is missing or stale: pnpm run portal:og`); }
    urls[s.slug] = { spec, thumb, poster, og };
  }
  const homeBase = pic(path.join('portal', 'hero.jpg')), homeOgFile = pic(path.join('portal', 'og', 'home.jpg'));
  let homeOg = '';
  if (fs.existsSync(homeOgFile) && fs.existsSync(homeBase) && ogManifest.home && ogManifest.home.key === ogKey(ogText('home'), fs.readFileSync(homeBase))) homeOg = putHashed(homeOgFile, path.join('portal', 'og'), 'home.jpg');
  else if (isProd && !partial) problem('the landing\'s link-preview image is missing or stale: pnpm run portal:og');
  if (!homeOg || ogMissing) {
    // a preview still unfurls: every page falls back to the plain hero (no text on it, but nothing wrong on it either)
    if (fs.existsSync(homeBase)) { const f = putHashed(homeBase, path.join('portal', 'og'), 'home-plain.jpg'); homeOg ||= f; for (const slug of Object.keys(urls)) urls[slug].og ||= f; }
    if (!isProd || partial) console.log(`story: ${ogMissing || 'the landing\'s'} link-preview image${ogMissing === 1 ? ' is' : 's are'} not current (pnpm run portal:og); the plain hero stands in`);
  }
  const heroSrc = pic(path.join('portal', 'hero.webp'));
  const hero = fs.existsSync(heroSrc) && stories.some(s => s.slug === FEATURED) ? putHashed(heroSrc, 'portal', 'hero.webp') : '';
  if (!hero && urls[order[0]]) console.log('story: the featured family is not here, so the landing hero shows the first family\'s picture');
  const cards: Card[] = sorted.map(s => cardOf(s, { catalog, order, thumb: urls[s.slug]?.thumb || '', og: urls[s.slug]?.og || '' }));
  const cardBy = Object.fromEntries(cards.map(c => [c.slug, c]));

  // ---- fonts: Archivo Black, shipped under a hashed name that the stylesheet is told
  const fontSrc = pic(path.join('portal', 'fonts', 'archivo-black.woff2'));
  let fontUrl = '';
  if (fs.existsSync(fontSrc)) fontUrl = putHashed(fontSrc, path.join('portal', 'fonts'), 'archivo-black.woff2');
  else problem('portal/fonts/archivo-black.woff2 is missing');
  if (fs.existsSync(pic(path.join('portal', 'fonts', 'LICENSE-Archivo-Black.txt')))) put(path.join('portal', 'fonts', 'LICENSE-Archivo-Black.txt'), fs.readFileSync(pic(path.join('portal', 'fonts', 'LICENSE-Archivo-Black.txt'))));   // (OFL: the licence travels with the font)
  const css = path.join(OUT, 'portal', 'site.css');
  if (fs.existsSync(css) && fontUrl) fs.writeFileSync(css, fs.readFileSync(css, 'utf8').replace('fonts/archivo-black.woff2', fontUrl.replace(/^portal\//, '')));

  // ---- the data files
  const familiesIndex: FamiliesIndex = { v: 1, families: cards };
  const familiesUrl = put(path.join('story', `families.${hash10(JSON.stringify(familiesIndex))}.json`), JSON.stringify(familiesIndex));
  const legacy: Record<string, string> = {};
  for (const s of stories) { const c = casting[s.slug]; if (c) legacy[legacyKey(c.house)] = s.slug; }
  const legacyUrl = put(path.join('story', `legacy.${hash10(JSON.stringify(legacy))}.json`), JSON.stringify(legacy));
  const manifest: SiteManifest = { v: 1, families: familiesUrl, legacy: legacyUrl, byFamily: {} };
  for (const s of sorted) manifest.byFamily[s.slug] = { spec: urls[s.slug]?.spec || '', story: '', poster: urls[s.slug]?.poster || '', og: urls[s.slug]?.og || '', audio: {} };

  // ---- the seams: every scripts/story/ship/*.mts adds its files and registers their URLs
  const registerKey = (slug: string, key: ManifestKey, url: string): void => {
    const m = manifest.byFamily[slug]; if (!m) { problem(`ship: ${slug} is not a family of this build`); return; }
    if (key.startsWith('audio:')) m.audio[key.slice(6)] = url;
    else if (key.startsWith('film.')) { m.film ||= { durationMs: 0, bytes: 0 }; (m.film as any)[key.slice(5)] = url; }
    else (m as any)[key] = url;
  };
  const ctx: ShipCtx = {
    ROOT, OUT, site: SITE, partial: partial || usingFixtures, stories: sorted, casting,
    addHashed: (src, dstDir) => putHashed(src, dstDir),
    addFile: (rel, data) => put(rel, data),
    register: registerKey,
    registerFilm: (slug, film) => { const m = manifest.byFamily[slug]; if (m) m.film = { ...(m.film || {}), ...film }; },
    problem,
  };
  const shipDir = path.join(ROOT, SHIP_GLOB);
  for (const f of fs.existsSync(shipDir) ? fs.readdirSync(shipDir).filter(f => f.endsWith('.mts')).sort() : []) {
    try { const mod = await import(pathToFileURL(path.join(shipDir, f)).href); await (mod.default as ShipFn)(ctx); }
    catch (err) { problem(`scripts/story/ship/${f}: ${(err as Error).message}`); }
  }

  // ---- the pages
  const favSlug = order[0];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i], u = urls[s.slug]; if (!u) continue;
    const html = pg.familyPage({
      s, card: cardBy[s.slug], prev: cards[(i + cards.length - 1) % cards.length], next: cards[(i + 1) % cards.length], site: SITE, claims, catalog,
      poster: u.poster, og: new URL(u.og, SITE).href, noindex, film: manifest.byFamily[s.slug].film && (manifest.byFamily[s.slug].film!.src169 || manifest.byFamily[s.slug].film!.src916) ? manifest.byFamily[s.slug].film : undefined,
    });
    put(path.join('family', `${s.slug}.html`), html);
  }
  put('credits.html', pg.creditsPage(claims, SITE, noindex));

  // index.html: the template's markers become the data-driven parts
  {
    const featured = cardBy[favSlug];
    const rooms = pg.pickRooms(sorted, order, catalog);
    const people = cards.reduce((a, c) => a + c.members.length, 0);
    const storyCount = cards.reduce((a, c) => a + c.beats, 0);
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sub = (marker: string, text: string): void => { if (!html.includes(marker)) problem(`index.html: no ${marker}`); html = html.split(marker).join(text); };
    sub('<!-- @head -->', pg.landingHead({ site: SITE, families: familiesUrl, og: new URL(homeOg, SITE).href, noindex, cards, hero: hero || urls[favSlug]?.thumb || '' }));
    sub('<!-- @header -->', pg.header('./'));
    sub('<!-- @footer -->', pg.footer('./', claims));
    sub('<!-- @steps -->', pg.stepsHtml());
    sub('<!-- @filters -->', pg.filtersHtml());
    sub('<!-- @rooms -->', pg.roomsHtml(rooms));
    sub('<!-- @noscript -->', pg.noscriptList(cards));
    sub('<!-- @disclosures -->', ['fictional-family', 'scripted-scenes', 'stylised-art', 'beta-short', 'internet-steps', 'synthetic-voice', 'names-owners', 'apps-availability']
      .map(id => `<li>${esc(disclosure(claims, id))}</li>`).join('\n          '));
    sub('@hero-src', `./${hero || urls[favSlug]?.thumb || ''}`);
    sub('@hero-alt', `An aerial view of the ${featured.surname} family home, drawn in 3D.`);
    sub('@hero-title', featured.title);
    sub('@hero-slug', featured.slug);
    sub('@families-url', familiesUrl);
    html = html.replace(/(data-stat="families">)[^<]*/, `$1${cards.length}`).replace(/(data-stat="people">)[^<]*/, `$1${people}`).replace(/(data-stat="stories">)[^<]*/, `$1${storyCount}`);
    put('index.html', html);
  }

  // the player: public mode, the site's own head, noindex (a tour link copied from the address bar unfurls as the site)
  {
    const rcPath = path.join(OUT, 'room-creator.html');
    let rc = fs.readFileSync(rcPath, 'utf8');
    if (!/<head[^>]*>/.test(rc)) problem('room-creator.html has no <head>');
    rc = rc.replace(/<head[^>]*>/, tag => `${tag}\n  <script>window.__VH_PUBLIC=1;</script>`);
    const og = new URL(homeOg, SITE).href;
    const head = `<title>${esc(pg.LANDING_TITLE)}</title>
  <meta name="description" content="${esc(pg.LANDING_DESC)}">
  <meta name="robots" content="noindex,follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${pg.SITE_NAME}">
  <meta property="og:title" content="${esc(pg.LANDING_TITLE)}">
  <meta property="og:description" content="${esc(pg.LANDING_DESC)}">
  <meta property="og:image" content="${esc(og)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">`;
    const before = rc;
    rc = rc.replace(/<title>[^<]*<\/title>\s*<meta name="description" content="[^"]*">/, () => head);
    if (rc === before) problem('room-creator.html: its static <title> and description were not found to replace');
    if (/Room Creator|SimsTree|Pascal Editor|Virtual homes/.test(rc.slice(0, rc.indexOf('<script type="importmap">')).replace(/<script>[\s\S]*?<\/script>/g, ''))) problem('room-creator.html: the static head still names the editor');
    const map = rc.indexOf('<script type="importmap">');
    if (map < 0 || /\bimport\(|type="module"|rel="modulepreload"/.test(rc.slice(0, map).replace(/<script>[\s\S]*?<\/script>/g, ''))) problem('room-creator.html: a module is loaded before the import map');
    // The page is the editor's too, and its code and comments carry words the public site does not: the editor's own name
    // and the gallery the specs were written from. The editor is not reachable here (the head script sends it to the landing),
    // so these are only text.
    rc = rc.replace(/Virtual homes editor/g, 'Editor').replace(/Virtual homes/g, 'Companion Core').replace(/SimsTree/g, 'gallery');
    const needle = leakNeedle(ROOT);
    rc = stripLeakyComments(rc, needle);
    fs.writeFileSync(rcPath, rc);
    for (const f of walkOut(path.join(OUT, 'assets'))) {
      if (!f.endsWith('.js') || f.includes(`${path.sep}vendor${path.sep}`)) continue;
      const t = fs.readFileSync(f, 'utf8'), u = stripLeakyComments(t, needle);
      if (u !== t) fs.writeFileSync(f, u);
    }
    // assets/home-names.js is the repo's map from a spec to a name and a builder's credit. room-creator.html imports it
    // statically, so a stub with the same exports ships in its place (the real one never leaves the repo).
    const stub = `// The public build's stand-in for assets/home-names.ts: a home is a family here, named by the family list, never by a spec.
export const buildName = (h) => ((h && h.name) || '').trim();
export const displayName = (h) => ((h && h.name) || 'Family');
export const buildCredit = () => '';
`;
    put(path.join('assets', 'home-names.js'), stub);
  }

  // ---- crawlers and the old links
  put('sitemap.xml', pg.sitemap(SITE, order, new Date().toISOString().slice(0, 10)));
  put('robots.txt', pg.robots(SITE, noindex));
  // Old share pages (homes/<id>.html) were never served by the new site: Cloudflare Pages answers these 301s. The query
  // string is forwarded by Pages' _redirects only if the first preview deploy shows it is (see README, "Pages checks").
  const redirects = stories.flatMap(s => { const h = casting[s.slug].house; return [`/homes/${h}.html /family/${s.slug} 301`, `/homes/${h} /family/${s.slug} 301`]; });
  put('_redirects', `# Old per-home share pages, now family pages. Generated by scripts/story/site.mts; nothing else lives here.\n${redirects.join('\n')}\n`);

  // ---- hand the manifest to the player, the tour and the film
  put(path.join('story', 'manifest.json'), JSON.stringify(manifest));

  // ---- the topic floor: a chip that would show fewer than ten families is a hole in the writing (STORY-BIBLE section 5)
  if (!partial && !usingFixtures) {
    for (const t of TOPICS) { const n = sorted.filter(s => topicsOf(s).includes(t)).length; if (n < 10) problem(`topic ${t} appears in ${n} families, fewer than ten`); }
  }
  return { files, bytes, partial, noindex, families: stories.length };
}
