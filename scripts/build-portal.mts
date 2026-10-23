#!/usr/bin/env -S node --experimental-strip-types
// Assembles the web portal for Cloudflare Pages: exactly the files the site loads, nothing else.
//
//   pnpm run build && pnpm run portal:build [--out dist] [--site-url https://homes.ci.computer/] [--families <dir>] [--strict-families] [--stale-report]
//   pnpm run portal:preview [--port 8081] [--tailscale | --host <ipv4>]   build, then serve <out> at http://127.0.0.1:8081/ci-virtual-home/
//                                         (--tailscale: also on this machine's Tailscale address, so other devices on the tailnet can open it; never 0.0.0.0)
//
//   <out>/index.html                 the front page: the families and their homes (portal/gallery.css + gallery.js + campaign.js,
//                                    portal/thumbs/, the hero's picture), its link-preview image (portal/hero.jpg) and URL made absolute
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
//   <out>/family/<slug>.html         a fictional family's page (scripts/story/site.mts), served at /family/<slug>: who they are, the
//                                    scenes of their tour, the apps they run, a link to the tour (room-creator?mode=view&house=<id>
//                                    &family=<slug>) and fine print naming the home they live in, linked to homes/<id>. One page per
//                                    CURRENT family (scripts/story/site.mts, "stale families"), under the same rules as a home's page
//   <out>/story/ audio/ film/ portal/og/ portal/fonts/
//                                    the tour's data and pictures, every name carrying a content hash except story/manifest.json
//                                    (scripts/story/site.mts and scripts/story/ship/*.mts). The player loads the tour only for ?family=
//   <out>/404.html, robots.txt, sitemap.xml
//                                    a real 404 page (Pages answers unknown paths with it and a 404 status), robots.txt
//                                    (Allow: / and the Sitemap line) and a sitemap of the gallery, every home's page and every family's page; every
//                                    page also gets a canonical link, twitter title/description/image and JSON-LD
//   <out>/favicon.ico, apple-touch-icon.png
//                                    the icons at the root, where browsers and crawlers look first (the rest are in portal/icons/)
//   <out>/_headers                   Cloudflare Pages' header rules (portal/_headers): Cache-Control max-age=0 with
//                                    must-revalidate on every file, because the modules below are not fingerprinted
//   <out>/assets/**/*.js             the compiled engine (not the .ts), vendor/three with its LICENSE,
//                                    fonts/*.woff2 with their licences, brand/
//   <out>/content/houses/            <id>.json and index.json: the specs the page builds (not the .plan.json twins), REDACTED: no `author`,
//                                    no `source`, and `name` is the portal's name for the home (scripts/portal-redact.mts)
//
// The front page's cards are also written into the built index.html (a visitor without JavaScript, and a crawler that does not run
// it, see the families, each linking its page, and the homes with no family, each linking its own; gallery.js adopts the families' cards and
// replaces the plain ones; the `front page` blocks and scripts/portal-front.mts), and the built pages link each other without
// ".html", as Cloudflare Pages serves them (the file-name address answers a 308). A campaign's tags are never in the built hrefs:
// portal/campaign.js adds them in the browser.
//
// The story pieces (family pages, the tour's data, the sitemap's family entries) are added by scripts/story/site.mts through ONE call
// (step 5c2) and held to the same checks (step 7). Where the story is told is up to the homes' own front page: see FRONT PAGE HOOK below.
//
// Everything the site references is relative, so the same tree works at / and under /ci-virtual-home/. No
// goldens, scripts, scenes, videos or TypeScript sources go out. The build refuses to run on stale or missing
// compiled assets (a .ts newer than its .js), and checks that every house in index.json has a spec and a
// thumbnail, that nothing the HTML links is missing from the output, and that the gallery's static hero figures
// (what a crawler or a visitor without JavaScript reads) are the ones gallery.js computes from index.json, that the hand-written
// copy's "thirty" is the number of homes, and that every built page carries the Companion Core, download, docs and main-site links.
//
// Nothing credits a builder or names the build a home was written from, anywhere in the output (step 8): the specs' `author` and
// `source` stay in the repository as internal records and are redacted from what is shipped, and the guard reads every text file of
// the output for the builders' handles (derived from the specs), the word "Sims", "Base Game" and "BG " and fails the build on a hit.
//
// Only the paths it writes are replaced in <out>; anything else there (dist/models from export:core) is left.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, serve, tailscaleAddress } from './portal-lib.mts';
import { redactIndex, redactSpecText, guardOutput, GUARD_ALLOW } from './portal-redact.mts';
import {
  type House, LINKS, SITE_NAME, PLAYER_TITLE, HERO_ALT, TITLE_MAX, TWITTER_SITE, esc, numberWord, capital, galleryCards, galleryHomeIndex, galleryLd, homeDescription, homeLd, homePage, homeTitle, homeUrl, notFoundPage, playerLd,
} from './portal-pages.mts';
import { buildStorySite } from './story/site.mts';
// ---- front page ----
import { HERO, readFamilies, frontCards, meetFamily, homesWithoutFamily, readStories, landerFamilies, proofBlock, coreFigure, swapBlock, appsNamed, heroCount } from './portal-front.mts';
import { MEET_MARKER } from './portal-pages.mts';
import { finePrint, finePrintHtml, missingFinePrint } from './story/lib/fine-print.mts';
import { computeLander, readInputs as landerInputs, familiesWord } from './story/lib/lander.mts';
import { landerChecks, landerHeadChecks } from './story/lib/lander-check.mts';
import { displayName } from '../assets/home-names.js';

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
const OWNED = ['index.html', 'room-creator.html', 'assets', 'content', 'portal', 'homes', 'family', 'story', 'audio', 'film', '_headers', '.nojekyll', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'apple-touch-icon.png'];
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

// 3. portal: styles, script, the hero, the thumbnails, the icons and the manifest. (portal/og/ and portal/fonts/ are the story's:
//    scripts/story/site.mts ships them under a hash of their content, which _headers lets a cache keep for a year)
for (const f of walk('portal', f => /\.(css|js|webp|jpg|png|ico|webmanifest)$/.test(f) && !f.startsWith(path.join('portal', 'og') + path.sep))) copy(f);

// ---- campaign link rules ---- portal/campaign.json (portal/campaign.js reads it at run time; README -> Campaign link rules): a short authored list of
// {match, to, from, until} mappings for the sanctioned ci.computer links, EMPTY by default. It is copied as it is (it is not a script or a style, so
// the walk above did not take it) and held to campaign.js's own validator, so a rule that has expired, runs too long or names anything but the three
// sanctioned addresses fails the build and a stale rule cannot live forever. The built pages never carry the mapped address (step 7).
{
  const cj = path.join(ROOT, 'portal', 'campaign.json');
  if (!fs.existsSync(cj)) problems.push('missing portal/campaign.json');
  else {
    copy(path.join('portal', 'campaign.json'));
    try {
      const sandbox: Record<string, any> = {};
      (await import('node:vm')).runInNewContext(fs.readFileSync(path.join(ROOT, 'portal', 'campaign.js'), 'utf8'), sandbox, { filename: 'portal/campaign.js' });
      problems.push(...sandbox.CICampaign.validate(JSON.parse(fs.readFileSync(cj, 'utf8')), new Date().toISOString().slice(0, 10)));
    } catch (err) { problems.push(`portal/campaign.json: ${(err as Error).message}`); }
  }
}

// ---- app media ---- (scripts/story/lib/media.mts, scripts/story/build-app-media.mts, reference/story/story-v2.md "App media")
// The real logos and screenshots under portal/apps/ and portal/ci/, every one named <name>.<hash10>.webp. Step 3's walk copied every .webp under portal/,
// these two folders included, so what it copied is taken back out and only the files content/story/app-media.json names are shipped (portal/_headers keeps
// these two folders for a year: nothing un-hashed may be in them). The manifest is held to its rules here (the files exist, are named by their hash,
// fit their budgets, carry alt text and the exact captions), and an app a family uses that has no entry is a warning that lists the apps.
const appMedia = await (async () => {
  const media = await import('./story/lib/media.mts');
  const left = (d: string): string[] => fs.existsSync(d) ? fs.readdirSync(d).flatMap(n => { const f = path.join(d, n); return fs.statSync(f).isDirectory() ? left(f) : [f]; }) : [];
  for (const d of ['apps', 'ci']) {
    for (const f of left(path.join(OUT, 'portal', d))) { files--; bytes -= fs.statSync(f).size; }
    fs.rmSync(path.join(OUT, 'portal', d), { recursive: true, force: true });
  }
  const manifest = media.readMedia(ROOT);
  if (!manifest) { console.log(`app media: no ${media.MANIFEST} (pnpm run story:media): the pages show no logos or screenshots`); return { media, manifest, named: new Map<string, string>() }; }
  problems.push(...media.checkManifest(manifest, ROOT).map(p => `app media: ${p}`));
  // the files the manifest names, and what each one is (the page check below needs the caption of a screenshot)
  const named = new Map<string, string>();
  for (const a of Object.values(manifest.apps)) { if (a.logo) named.set(a.logo.file, ''); if (a.shot) named.set(a.shot.file, a.shot.caption); }
  for (const s of [...manifest.ci.hub, ...manifest.ci.portal]) named.set(s.file, s.caption);
  for (const rel of named.keys()) copy(rel);
  const stale = media.staleApps(manifest, ROOT);
  // a push to main builds strict (--strict-families / CI_STORY_STRICT=1): an app a story or a persona pool names with no manifest entry is then an error, so a
  // manifest that fell behind the stories cannot be deployed unnoticed (scripts/test-app-media.mts holds the same line in the quick gates, with no sibling repo needed)
  if (stale.length && (args['strict-families'] === 'true' || process.env.CI_STORY_STRICT === '1')) problems.push(`app media: ${stale.length} app${stale.length === 1 ? '' : 's'} a family or a persona pool names ${stale.length === 1 ? 'has' : 'have'} no entry in ${media.MANIFEST} (--strict-families wants every app covered; pnpm run story:media): ${stale.join(', ')}`);
  console.log(`app media: ${named.size} files shipped (${manifest.rejected.length} candidates rejected, see ${media.MANIFEST})${stale.length ? `\n  warning: ${stale.length} app${stale.length === 1 ? '' : 's'} a family uses ${stale.length === 1 ? 'has' : 'have'} no entry in ${media.MANIFEST} (pnpm run story:media): ${stale.join(', ')}` : ''}`);
  return { media, manifest, named };
})();
// ---- end app media ----

// 4. the engine: compiled modules, three.js (whole vendored tree: modules plus LICENSE), fonts, brand
for (const f of sources) copy(f.replace(/\.ts$/, '.js'));
for (const f of walk(path.join('assets', 'vendor'), f => /\.js$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'fonts'), f => /\.woff2$|LICENSE/.test(f))) copy(f);
for (const f of walk(path.join('assets', 'brand'), () => true)) copy(f);

// 5. the specs, redacted (scripts/portal-redact.mts): the repository's `author`, `source` and filed title stay in the repository; what is
// shipped carries the portal's name for each home and no builder. `index` below stays the repository's own (the pages written here
// take names from it through displayName, and nothing of it is written out as it is).
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8'));
const ship = (toRel: string, text: string): void => {
  const to = path.join(OUT, toRel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, text);
  files++; bytes += Buffer.byteLength(text);
};
ship(path.join('content', 'houses', 'index.json'), `${JSON.stringify(redactIndex(index), null, 2)}\n`);
for (const h of index.houses || []) {
  const specFile = path.join(ROOT, 'content', 'houses', `${h.id}.json`);
  if (!fs.existsSync(specFile)) problems.push(`missing ${rel(specFile)}`);
  else {
    const red = redactSpecText(fs.readFileSync(specFile, 'utf8'));
    // a reader that still calls displayName on the shipped name must get the same name back
    if (displayName({ id: h.id, name: red.name }) !== red.name) problems.push(`${h.id}: displayName of its display name "${red.name}" is not itself`);
    ship(path.join('content', 'houses', `${h.id}.json`), red.text);
  }
  if (!fs.existsSync(path.join(ROOT, 'portal', 'thumbs', `${h.id}.webp`))) problems.push(`no thumbnail for ${h.id}: pnpm run portal:thumbs --house ${h.id}`);
  if (!fs.existsSync(path.join(ROOT, 'portal', 'previews', `${h.id}.jpg`))) problems.push(`no link-preview image for ${h.id}: pnpm run portal:thumbs --house ${h.id}`);
}
if (!fs.existsSync(path.join(ROOT, 'portal', 'hero.jpg'))) problems.push('no portal/hero.jpg (the site\'s link-preview image): pnpm run portal:thumbs --house aurora');

// 5b. the front page's numbers are words the build writes from the data (the families word in the hero and the description, the count line above the
// families), never typed in index.html: a spelled number or a figure in the source would go stale when a home is added, so the build refuses one.
const houses: House[] = index.houses || [];
const COUNT_WORD = numberWord(houses.length);
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, ' ');
  if (/\bdata-stat=/.test(html)) problems.push('index.html: a data-stat figure (the lander writes its counts as words, from the data)');
  const word = body.match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|(?:twen|thir|for|fif|six|seven|eigh|nine)ty(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|(?:thir|four|fif|six|seven|eigh|nine)teen) (?:fictional |homes?\b|famil)/i);
  if (word) problems.push(`index.html: the count "${word[0].trim()}" is typed in the source (portal-front.mts writes it from the data)`);
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
  else fs.writeFileSync(rc, text.replace('</head>', () => [
    '  <meta name="vh-share" content="homes/">',
    // The player carries the ad's tags too (portal/campaign.js; the source page is the editor's and is not touched). A deferred classic script in the head runs
    // after the page is parsed and before the module at the end of the body, so the tags are read before the player writes its address; the player draws
    // its end card and About panel later, and campaign.js tags those links as they arrive and when they are clicked. The fingerprinting step below names the file by its hash.
    // Without JavaScript nothing of the editor or the player can be used: the page shows the message in its <noscript> and nothing under it.
    '  <script src="./portal/campaign.js" defer data-cfasync="false"></script>',
    '  <noscript><style>body > :not(noscript) { display: none !important; }</style></noscript>',
    '</head>',
  ].join('\n')));
}

// 5c2. the families: a page each (family/<slug>), the tour's data and files, the manifest the player reads (scripts/story/site.mts).
// A family that is not current is skipped and reported, not an error, unless --strict-families (see site.mts). Its pages are held to
// the homes' pages' rules in step 7, and listed in the sitemap below.
//
// FRONT PAGE HOOK. The gallery (index.html, portal/gallery.js) is the front page: families first, the homes that have no current family
// after them. `story.cards` is the cards (type FamiliesIndex, also written to story/families.<hash>.json and named by
// story/manifest.json) and `story.built` the pages; the block below turns them into what the front page and the homes' pages need,
// step 5d writes the cards into index.html and step 7 holds the result to the same rules as the homes' own pages (scripts/portal-front.mts).
const story = await buildStorySite({ ROOT, OUT, SITE, args, problems, houses });
files += story.files; bytes += story.bytes;
const familyPages = story.built.map(b => b.file);

// ---- front page ----
// The families the front page tells (static HTML in index.html, at step 5d), the hero's tour, and "Meet the family" on the home each
// one lives in. Only current families are here (story.built); a home with none keeps its plain card and its page without the block.
const front = readFamilies({ ROOT, dir: path.resolve(ROOT, args.families && args.families !== 'true' ? args.families : path.join('content', 'families')), built: story.built, cards: story.cards });
const heroFamily = front.find(f => f.slug === HERO.slug && f.house === HERO.house);
if (!heroFamily) console.log(`front: the hero's tour is the ${HERO.slug} family, which is not current (pnpm run story:validate -- ${HERO.slug}): the hero plays its home`);
// the lander's choices (content/story/lander.json, scripts/story/lib/lander.mts): the pairs the page may show, the chooser's chips, the featured families, the proof
const landerFiles = landerInputs(ROOT);
const lander = computeLander({ root: ROOT, stories: readStories({ dir: path.resolve(ROOT, args.families && args.families !== 'true' ? args.families : path.join('content', 'families')), built: story.built }), families: landerFamilies(front), houses, files: landerFiles });
for (const line of lander.log) console.log(line);
for (const e of lander.check.errors) problems.push(e);
for (const w of lander.check.warnings) { console.log(`front: ${w}`); if (story.strict) problems.push(`${w} (--strict-families wants the plan to hold)`); }
for (const n of lander.featured.notes) { console.log(`front: ${n}`); if (story.strict) problems.push(`featured families: ${n}`); }
for (const h of houses) {
  const file = path.join(OUT, 'homes', `${h.id}.html`);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(MEET_MARKER)) { problems.push(`homes/${h.id}.html: no meet-family marker for the family block`); continue; }
  const f = front.find(x => x.house === h.id);
  fs.writeFileSync(file, text.replace(MEET_MARKER, () => (f ? meetFamily(f) : '')));
}
{
  // The homes with no current family keep a plain card (it opens the player) and a page of their own. Some are declared so by the cast plan (the
  // apartments: no family has moved in); that is the plan's say and never a failure. A home that is neither current nor declared is a family that
  // went stale (listed under "story:" above) or a home the plan does not know (cast-lint's error); --strict-families makes either an error.
  const none = houses.filter(h => !front.some(f => f.house === h.id));
  const declared = homesWithoutFamily(ROOT), planned = none.filter(h => h.id in declared), other = none.filter(h => !(h.id in declared));
  console.log(`front: ${front.length} famil${front.length === 1 ? 'y' : 'ies'} on the front page, ${none.length} home${none.length === 1 ? '' : 's'} with none`);
  if (planned.length) console.log(`front: ${planned.length} of them ${planned.length === 1 ? 'has' : 'have'} no family yet by the cast plan (content/story/cast-plan.json homesWithoutFamily), a plain card and a page of ${planned.length === 1 ? 'its' : 'their'} own, no tour: ${planned.map(h => h.id).join(', ')}`);
  if (other.length) console.log(`front: ${other.length} ${other.length === 1 ? 'has' : 'have'} no current family and ${other.length === 1 ? 'is' : 'are'} not declared without one (a stale family: see story: above; or pnpm run story:cast-lint): ${other.map(h => h.id).join(', ')}`);
  if (story.strict) for (const h of other) problems.push(`front: ${h.id} has no current family and is not in the cast plan's homesWithoutFamily (--strict-families wants the whole cast there)`);
}
// ---- end front page ----

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

  // the head: the message and the Core in the title, the count in words in the description. claims.json's words and the data's; the source holds neither
  {
    const msg = Object.values(lander.messages)[0];
    if (msg) {
      const title = `${msg.text.replace(/\.$/, '')} · Companion Core`;
      const desc = `A Companion Core is a small personal server that runs local AI and your household's apps. ${familiesWord(front.length)} show how. Fictional family. Real software.`;
      const swap = (re: RegExp, to: string, what: string): void => { if (!re.test(gallery)) problems.push(`index.html: no ${what} to write`); else gallery = gallery.replace(re, () => to); };
      swap(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, '<title>');
      swap(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`, 'description');
      swap(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`, 'og:title');
      swap(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`, 'og:description');
    }
  }
  // ---- front page ---- the cards: the featured families' (the plan's six that pass the gate) in the first list, everything else in the second, which sits in a
  // native <details> (static HTML: a crawler, a visitor without JavaScript and an in-app browser with a slow script see every family and every home; gallery.js adopts them)
  const cards = frontCards(houses, front, lander, galleryCards);
  const list = /(<ul class="grid" id="grid" aria-label="[^"]*")( aria-busy="true")?>[\s\S]*?<\/ul>/;
  if (!list.test(gallery)) problems.push('index.html: no <ul class="grid" id="grid" aria-label="…"> to write the featured families into');
  else gallery = gallery.replace(list, (_m, open: string) => `${open}>\n        ${cards.featured}\n      </ul>`);
  const rest = /(<ul class="grid grid-rest" id="grid-rest"[^>]*)><\/ul>/;
  if (!rest.test(gallery)) problems.push('index.html: no <ul class="grid grid-rest" id="grid-rest"></ul> to write the other families and homes into');
  else gallery = gallery.replace(rest, (_m, open: string) => `${open}>\n        ${cards.rest}\n      </ul>`);
  // ---- front page ---- the hero tours the Brennan family (index.html's source says so); without a current one it plays the home
  if (!gallery.includes(`house=${HERO.house}&amp;family=${HERO.slug}"`)) problems.push(`index.html: the hero's tour link is not house=${HERO.house}&family=${HERO.slug} (content/story/lander.json hero)`);
  else if (!heroFamily) gallery = gallery.split(`&amp;family=${HERO.slug}"`).join('"');
  // ---- end front page ----
  // ---- the lander ---- (reference/story/lander.md): the blocks and the words, written at their markers in index.html. A claim and the fine print are claims.json's words, never
  // retyped; the lists are the plan's and the families'. The Core's own picture (portal/stage/<house>/) is the band's when its frames are committed.
  {
    const at = (marker: RegExp, html: string, what: string): void => {
      if (!marker.test(gallery)) problems.push(`index.html: no <!-- ${what}: --> marker to write ${what} at`);
      else gallery = gallery.replace(marker, () => html);
    };
    const claimText = new Map(landerFiles.claims.allowedClaims.map((c) => [c.id, c.text]));
    gallery = gallery.replace(/<!-- claim:([a-z0-9-]+) -->/g, (_m, id: string) => {
      const t = claimText.get(id);
      if (t === undefined) { problems.push(`index.html: <!-- claim:${id} --> names no claim in claims.json`); return ''; }
      return esc(t);
    });
    at(/<!-- lander-hero-count:[\s\S]*?-->/, esc(heroCount(front.length)), 'lander-hero-count');
    at(/<!-- lander-proof:[\s\S]*?-->/, proofBlock(lander, front), 'lander-proof');
    const disclosure = (id: string): string => landerFiles.claims.disclosures.find((d) => d.id === id)?.text ?? '';
    const heroHome = heroFamily?.house ?? HERO.house;
    const fig = coreFigure(ROOT, heroHome, 'The Companion Core on a writing desk in the Library, drawn in 3D.', disclosure('stylised-art'));
    at(/<!-- lander-core-fig:[\s\S]*?-->/, fig, 'lander-core-fig');
    if (fig) gallery = gallery.replace('<section class="cta-band" id="core"', () => '<section class="cta-band has-fig" id="core"');
    at(/<!-- lander-swap:[\s\S]*?-->/, swapBlock(lander, front), 'lander-swap');
    at(/<!-- lander-count:[\s\S]*?-->/, esc(lander.count), 'lander-count');
    at(/<!-- lander-apps:[\s\S]*?-->/, appsNamed(front), 'lander-apps');
    // the fine print: the hero's chip, the band's lines (the stylised-art line is the figure's caption when there is a figure), the footer's
    at(/<!-- fine-hero:[\s\S]*?-->/, `<div class="hero-chips">${finePrint('lander-hero').html.replace('<p data-fine="fictional-family">', '<p class="fiction-label" data-fine="fictional-family">')}</div>`, 'fine-hero');
    at(/<!-- fine-core:[\s\S]*?-->/, finePrintHtml(finePrint('lander-core').items.filter((i) => i.id !== 'stylised-art' || !fig), { cls: 'cta-note' }), 'fine-core');
    at(/<!-- fine-foot:[\s\S]*?-->/, `<div class="foot-notes">${finePrint('lander-footer').html}</div>`, 'fine-foot');
  }
  // ---- end the lander ----
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
  const playerDesc = `Fly through one of ${COUNT_WORD} virtual homes in 3D in your browser and meet the Companion Core.`;
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
  seo('index.html', SITE, galleryLd(SITE, lander.featured.slugs.flatMap((slug) => { const f = front.find((x) => x.slug === slug); return f ? [{ url: new URL(`family/${slug}`, SITE).href, name: f.title }] : []; }), galleryTitle, galleryDesc.replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
  seo('room-creator.html', null, playerLd(SITE));
  for (const h of houses) {
    const file = path.join('homes', `${h.id}.html`);
    if (fs.existsSync(path.join(OUT, file))) seo(file, homeUrl(SITE, h.id), homeLd(SITE, h, new URL(`portal/previews/${h.id}.jpg`, SITE).href, homeTitle(h), homeDescription(h)));
  }

  // robots.txt and sitemap.xml: the gallery, one page per home and one per family. The player (room-creator) is a viewer for them, not a page
  // of its own: it is noindex in its own HTML (above), so it is not listed.
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', SITE).href}\n`);
  const urls = [SITE, ...houses.filter(h => /^[a-z0-9-]+$/.test(h.id)).map(h => homeUrl(SITE, h.id)), ...story.built.map(b => b.url)];
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
  // the pages in homes/ and family/ sit one level down: their stylesheet is ../portal/gallery.css (a family's, ../portal/site.css)
  for (const f of [...walkOut('homes', f => f.endsWith('.html')), ...walkOut('family', f => f.endsWith('.html'))]) {
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

// ---- front page ---- the 404 page is served at any depth, so it names portal/campaign.js by the site's absolute address (portal-pages.mts);
// it gets the content hash the other pages' copies got above, so a returning visitor never runs an old script from a cache
{
  const f = path.join(OUT, '404.html');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, 'portal', 'campaign.js'))).digest('hex').slice(0, 10);
  const text = fs.readFileSync(f, 'utf8');
  const next = text.replace(/(<script src="[^"]*\/portal\/campaign\.js)(")/, `$1?v=${hash}$2`);
  if (next === text) problems.push('404.html: no portal/campaign.js to name by a content hash');
  fs.writeFileSync(f, next);
}
// ---- end front page ----

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
for (const p of ['index.html', 'room-creator.html', ...(fs.existsSync(path.join(OUT, 'homes')) ? fs.readdirSync(path.join(OUT, 'homes')).map(f => path.join('homes', f)) : []), ...familyPages]) scan(p, /(?:href|src)="([^"]+)"/g);
for (const p of ['index.html', 'room-creator.html']) scan(p, /from '(\.[^']+)'/g);
for (const p of walk('portal', f => f.endsWith('.css'))) scan(p, /url\("?(\.[^")]+)"?\)/g);
// (an address without an extension is a page, as Cloudflare Pages serves them: ./homes/aurora is homes/aurora.html)
for (const r of refs) if (!fs.existsSync(path.join(OUT, r)) && !fs.existsSync(path.join(OUT, `${r}.html`))) problems.push(`${r} is linked but not in ${rel(OUT)}`);
// a root-relative URL would escape the /ci-virtual-home/ sub-path
const homePages = fs.existsSync(path.join(OUT, 'homes')) ? fs.readdirSync(path.join(OUT, 'homes')).map(f => path.join('homes', f)) : [];
for (const p of ['index.html', 'room-creator.html', ...homePages, ...familyPages, ...walk('portal', f => /\.(css|js)$/.test(f))]) {
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
  const pages = ['index.html', ...homePages, ...familyPages, '404.html'];
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
    if (f.startsWith(`homes${path.sep}`) || f.startsWith(`family${path.sep}`)) {
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
  // ---- front page ---- the static list is each current family's card, in the story's order, then a card for each home with no current
  // family (so every home is still there once: index.json's homes), and the campaign script, the family links and the tour are in it
  const listed = [...g.matchAll(/<li class="card[^"]*" data-id="([^"]+)"/g)].map(m => m[1]).filter(id => id !== '');
  const byFam = (slug: string): string => front.find(f => f.slug === slug)?.house ?? '';
  const wanted = [...lander.featured.slugs.map(byFam), ...front.filter(f => !lander.featured.slugs.includes(f.slug)).map(f => f.house), ...houses.filter(h => !front.some(f => f.house === h.id)).map(h => h.id)];
  if (listed.join() !== wanted.join()) problems.push(`index.html: the static cards (${listed.length}) are not the current families then the homes with none (${wanted.length})`);
  if (new Set(houses.map(h => h.id)).size !== new Set(listed).size) problems.push(`index.html: the static cards cover ${new Set(listed).size} of index.json's ${houses.length} homes`);
  for (const f of front) if (!g.includes(`<a href="./family/${f.slug}" data-campaign `)) problems.push(`index.html: the ${f.slug} family's card does not link ./family/${f.slug}`);
  if (front.length && !/<div class="jobs" id="personas"[^>]*>[\s\S]*?<button/.test(g)) problems.push('index.html: families, but no job chips');
  problems.push(...landerChecks(g, { data: lander, claims: landerFiles.claims, services: landerFiles.services, apps: landerFiles.apps, links: { site: LINKS.site, core: LINKS.core, download: LINKS.download, docs: LINKS.docs },
    missingFine: (html, surface) => missingFinePrint(html, surface).map(String) }));
  { const m = Object.values(lander.messages)[0]; if (m) problems.push(...landerHeadChecks(g, m.text)); }
  if (!/<script src="\.\/portal\/campaign\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/.test(g)) problems.push('index.html: no portal/campaign.js (with its content hash, defer and data-cfasync="false")');
  // the player loads it too, before the module that writes its address (the page's one module is at the end of its body)
  { const rcText = read('room-creator.html'), at = rcText.search(/<script src="\.\/portal\/campaign\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/), mod = rcText.search(/<script type="module"/);
    if (at < 0) problems.push('room-creator.html: no portal/campaign.js (with its content hash, defer and data-cfasync="false")');
    else if (mod >= 0 && at > mod) problems.push('room-creator.html: portal/campaign.js comes after the first module');
    if (!/<noscript><style>body > :not\(noscript\)/.test(rcText)) problems.push('room-creator.html: no <noscript> style that leaves only the message when JavaScript is off'); }
  for (const f of ['404.html', ...homePages.filter(p => p.endsWith('.html'))]) if (!/<script src="[^"]*\/portal\/campaign\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/.test(read(f))) problems.push(`${f}: no portal/campaign.js (with its content hash, defer and data-cfasync="false")`);
  // a campaign's tags are added in the browser, never in the built page: every link to ci.computer is exactly as step 7 above requires
  for (const f of [...pages, 'room-creator.html']) if (/href="https:\/\/ci\.computer\/?[?#]/.test(read(f))) problems.push(`${f}: a link to ci.computer carries a query or fragment (portal/campaign.js adds a campaign's tags at run time)`);
  // ---- end front page ----
  if (/href="[^"]*room-creator\.html/.test(g)) problems.push('index.html: a link still names room-creator.html (Cloudflare Pages answers it with a 308)');
  // nothing links the gallery by its file name either: ./index.html is answered with a 308 to ./
  for (const f of [...pages, 'room-creator.html']) if (/href="[^"]*\bindex\.html/.test(read(f))) problems.push(`${f}: a link names index.html (Cloudflare Pages answers it with a 308); link ./ or ../`);
  if (!/<meta name="vh-clean-urls"/.test(g)) problems.push('index.html: no vh-clean-urls mark for gallery.js');
  // the player's end card and help panel carry the same four addresses (assets/viewer.ts)
  const viewer = read(path.join('assets', 'viewer.js'));
  for (const url of [LINKS.site, LINKS.core, LINKS.download, LINKS.docs]) if (!viewer.includes(url)) problems.push(`assets/viewer.js: no ${url} (the end card and the help panel)`);
  if (viewer.includes('index.html')) problems.push('assets/viewer.js: names index.html (the player\'s way back is ./: Cloudflare Pages answers index.html with a 308)');
  // a family's page: the tour link carries its house and itself, the fine print names the home and links its page (and credits no
  // one), and what the player reads (story/manifest.json) lists exactly the families that have a page
  {
    const m = JSON.parse(read(path.join('story', 'manifest.json')));
    if (!fs.existsSync(path.join(OUT, m.families))) problems.push(`story/manifest.json: ${m.families} is not in the output`);
    if (Object.keys(m.byFamily).join() !== story.built.map(b => b.slug).join()) problems.push('story/manifest.json lists other families than the ones that have a page');
    for (const b of story.built) {
      const t = read(b.file);
      if (!t.includes(`href="../room-creator?mode=view&amp;house=${encodeURIComponent(b.house)}&amp;family=${b.slug}"`)) problems.push(`${b.file}: no link to the tour (room-creator?mode=view&house=<id>&family=<slug>)`);
      if (!t.includes('<p class="home-note">The home is <a href="../homes/' + b.house + '">')) problems.push(`${b.file}: no fine print that names the home and links homes/${b.house}`);
      if (/home-credit|\bCredit:/i.test(t)) problems.push(`${b.file}: a credit line on a family page (no builder is credited on the site)`);
      if (!fs.existsSync(path.join(OUT, 'homes', `${b.house}.html`))) problems.push(`${b.file}: its home has no page (homes/${b.house})`);
      if (!/<link rel="canonical" href="[^"]+\/family\/[a-z-]+">/.test(t)) problems.push(`${b.file}: its canonical is not family/<slug>`);
      if (m.byFamily[b.slug].house !== b.house) problems.push(`story/manifest.json: ${b.slug} names another house than its page does`);
    }
  }
  // titles are distinct across the site's own pages too
  for (const f of ['index.html', 'room-creator.html']) { const t = tag(read(f), /<title>([^<]*)<\/title>/); if (titles.has(t)) problems.push(`${f}: its title "${t}" is also ${titles.get(t)}'s`); titles.set(t, f); }
}

// ---- app media ---- what the built pages do with the media: every <img> of a file under portal/apps/ or portal/ci/ names a file the manifest
// shipped and that is in the output, has alt text, its width and height and a loading attribute (lazy on the front page, which loads none above the
// fold), and a screenshot's page carries its caption; and the manifest's own words (alt text, captions, reasons) pass the credit guard.
{
  const { media, manifest, named } = appMedia;
  if (manifest) {
    const red = await import('./portal-redact.mts');
    problems.push(...red.scanText(media.MANIFEST, fs.readFileSync(path.join(ROOT, media.MANIFEST), 'utf8'), red.guardTerms(red.builderHandles(ROOT))).map(p => `credit guard: ${p}`));
    const pages = ['index.html', ...homePages, ...familyPages, '404.html'].filter(p => fs.existsSync(path.join(OUT, p))).map(p => ({ file: p.split(path.sep).join('/'), html: fs.readFileSync(path.join(OUT, p), 'utf8') }));
    const checked = media.checkPageImages(pages, named, f => fs.existsSync(path.join(OUT, f)));
    problems.push(...checked.problems);
    const shown = checked.shown;
    console.log(`app media: ${shown} image${shown === 1 ? '' : 's'} on the built pages, each checked for alt, size, loading and caption`);
  }
}
// ---- end app media ----

// 8. nothing in the output credits a builder or names the build a home was written from (scripts/portal-redact.mts has the rule and
// the guard): every text file of the output, the shipped specs and the family and story JSON included, is read for the builders'
// handles (derived from the specs' `author` fields, never listed), the word "Sims", "Base Game" and "BG ". The allowlist is empty.
{
  const g = guardOutput(OUT, ROOT);
  problems.push(...g.problems.map(p => `credit guard: ${p}`));
  console.log(`credit guard: ${g.files} text files read for ${g.handles} builder handles, "Sims", "Base Game" and "BG "${GUARD_ALLOW.length ? ` (${GUARD_ALLOW.length} allowed)` : ', nothing allowed'}${g.problems.length ? `: ${g.problems.length} hit${g.problems.length === 1 ? '' : 's'}` : ': clean'}`);
}

if (problems.length) { console.error(problems.map(p => `  ✗ ${p}`).join('\n')); process.exit(1); }
console.log(`portal: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${rel(OUT)}/`);

// --serve: preview the tree under a sub-path, which proves every URL in it is relative
if (args.serve === 'true') {
  // ---- tailscale ---- `--tailscale` also listens on this machine's Tailscale address (and only that one besides the loopback), so a phone or laptop on the
  // same tailnet opens the preview; `--host <ipv4>` listens on that one address instead. Without either, the loopback address only, as before.
  const ts = args.tailscale === 'true' ? await tailscaleAddress() : null;
  if (args.tailscale === 'true' && !ts) { console.error('preview: --tailscale needs the tailscale command, running, with an IPv4 address (tailscale ip -4)'); process.exit(1); }
  const extra = ts ? [ts.ip] : (args.host && args.host !== 'true' ? [args.host] : []);
  const srv = await serve(OUT, '/ci-virtual-home/', Number(args.port || 8081), extra);
  console.log(`preview: ${srv.url()}  (Ctrl-C to stop)`);
  for (const o of srv.also) console.log(`preview on the tailnet: ${o}${srv.base}${ts?.dns ? `   or   http://${ts.dns}:${srv.port}${srv.base}` : ''}`);
  // ---- end tailscale ----
}
