#!/usr/bin/env -S node --experimental-strip-types
// End-to-end check of the built portal, served under a sub-path (dist/ at /ci-virtual-home/), where a
// root-relative URL fails.
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` after portal work
//
//   pnpm run build && pnpm run portal:build && pnpm run portal:test [--dir dist] [--base /ci-virtual-home/]
//        [--house aurora,lakecabin,mirage] [--shots test/portal] [--headed]
//
//   gallery   30 cards, every thumbnail decoded, the static hero figures match the data, no link forces
//             autoplay, card names carry no Sims jargon and are distinct, hovering a card warms the player (not
//             room-creator.html itself), search / storeys / tag filters narrow and clear (and the tag counts follow
//             the storeys filter), the footer credits every build by its own title, a card opens the player; the
//             built pages' link previews are the site's, with absolute JPEG images; 1440 × 900 and 390 × 844
//   player    for each --house: builds, opens on the Orbit, lists its shots from the presets, plays (t advances),
//             pauses (Space),
//             Space on a focused button presses that button, scrubs (a click on the scrubber lands there),
//             switches shot (URL follows), switches the time of day (the page's lighting follows), shows the
//             path (P), flies (F, W moves the camera, Q never takes it under the lot, a drag turns it, Esc puts it
//             back on the shot; the free-camera bar is inert until then, and at 1280 px it clears the title; every
//             shot chip shows from 768 px up), ends a shot on the end card, which does not cover the Core (at 390 ×
//             844 and turned to 844 × 390 too), copies a share link — homes/<id>.html,
//             whose preview tags name the home — that reopens at the same moment, and steps to the next home;
//             1440 × 900 and 390 × 844 (touch, where
//             the tools are in the More sheet and the seek bar is a 44 px target). The gallery and the player ask
//             no third party for anything (no Google Fonts)
//   motion    with the system set to reduce motion, a home opened from the gallery (or with play=1) holds still
//   failures  an id no home has: the error card at once, no spec request, no editor scene built behind it; a
//             module that does not download (viewer.js, house-builder.js) and a browser with WebGL 1 only: a
//             card that says so, with a way back, instead of an endless loader; a refused third-party tag (the
//             analytics) or a missing script the player outlives: no card over a home that plays; the names module
//             (home-names.js) not downloading: the gallery still lists the homes, and the player's tab never
//             shows a spec's Sims title
//   pages     the built site's own pages, without a browser's help: the gallery lists its 30 homes in the HTML itself (each
//             linking its page), a home's page names and shows the home and offers the player, a shared moment forwards
//             to the player, /robots.txt is text/plain, /sitemap.xml lists the gallery and every home, an unknown path
//             answers 404 with the 404 page, the icons and the manifest are served, and every page carries the Companion
//             Core, download, docs and main-site links
//   caching   dist/_headers revalidates every file (max-age=0, must-revalidate), and the pages name every module and
//             stylesheet by a hash of its content (import map + ?v=): the player pulls each module by its hash, and with
//             every un-hashed module URL poisoned (an old build in the browser's cache) it still starts
//   editor    room-creator.html without ?mode=view still shows the editor and never mounts the player
//   webkit    Safari's engine, when Playwright's WebKit for the pinned version is installed: the gallery, the player
//             (plays, pauses, scrubs) and the editor (builds a home, hooks there), with no console error. Skipped with
//             a line saying so when it is not (pnpm exec playwright install webkit); required with --webkit
//
// Any console error, page error or failed request on any page fails the run (the failure cases allow exactly the
// ones they cause). Screenshots land in --shots (gitignored test/portal/ by default) so a person can look at what
// passed. Exit 0 only when everything did.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from './portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
const DIR = path.resolve(args.dir || path.join(ROOT, 'dist'));
const BASE = args.base || '/ci-virtual-home/';
const HOUSES = (args.house || 'aurora,lakecabin,mirage').split(',').filter(Boolean);
const SHOTS = path.resolve(args.shots || path.join(ROOT, 'test', 'portal'));
if (!fs.existsSync(path.join(DIR, 'index.html'))) { console.error(`no portal in ${DIR}: pnpm run portal:build`); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });

const srv = await serve(DIR, BASE);
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Ctx = { page: any; errors: string[]; thirdParty: string[]; requests: string[]; close: () => Promise<void> };
async function open(viewport: { width: number; height: number }, mobile = false, extra: Record<string, unknown> = {}, b: any = browser): Promise<Ctx> {
  const ctx = await b.newContext({
    viewport, deviceScaleFactor: mobile ? 3 : 2, isMobile: mobile, hasTouch: mobile,
    permissions: ['clipboard-read', 'clipboard-write'], ...extra,
  });
  const page = await ctx.newPage();
  const errors: string[] = [], thirdParty: string[] = [], requests: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('response', (r: any) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r: any) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push(`request failed ${r.url()}`); });
  page.on('request', (r: any) => { const u = r.url(); requests.push(u); if (!u.startsWith(srv.origin) && !u.startsWith('data:') && !u.startsWith('blob:')) thirdParty.push(u); });
  await stubGoogleFonts(page, srv.origin);
  return { page, errors, thirdParty, requests, close: () => ctx.close() };
}
const shot = async (page: any, name: string) => { await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const viewerReady = (page: any) => page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 90000 });
const scrubT = (page: any): Promise<number> => page.$eval('.vh-scrub input', (e: HTMLInputElement) => Number(e.value) / 1000);
// a tool on a phone lives in the More sheet: open it first (on a wider screen the tools are in the dock)
async function tapTool(page: any, act: string) {
  if (await page.isVisible('[data-act="more"]') && (await page.getAttribute('[data-act="more"]', 'aria-expanded')) !== 'true') { await page.tap('[data-act="more"]'); await sleep(300); }
  await page.tap(`.vh-tools [data-act="${act}"]`);
}
const setScrub = (page: any, v: number) => page.$eval('.vh-scrub input', (e: HTMLInputElement, v: number) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const camPos = (page: any): Promise<number[]> => page.evaluate(() => { const c = (window as any).__houseDebug().camera; return [c.position.x, c.position.y, c.position.z]; });
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// how much of the Companion Core's box on the screen the end card covers (0…1; -1 when either is not there)
const coreCover = (page: any): Promise<number> => page.evaluate(() => {
  const d = (window as any).__houseDebug(), cam = d.camera, core = d.scene.getObjectByName('Companion Core (Hero)');
  const end = document.querySelector('.vh-end') as HTMLElement;
  if (!core || !end || end.hidden) return -1;
  const cb = (document.getElementById('three-canvas') as HTMLCanvasElement).getBoundingClientRect();
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  core.updateMatrixWorld(true);
  core.traverse((m: any) => {
    if (!m.isMesh || !m.geometry) return;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const v = new cam.position.constructor(x, y, z).applyMatrix4(m.matrixWorld).project(cam);
      const px = cb.left + ((v.x + 1) / 2) * cb.width, py = cb.top + ((1 - v.y) / 2) * cb.height;
      l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py);
    }
  });
  l = Math.max(l, cb.left); r = Math.min(r, cb.right); t = Math.max(t, cb.top); b = Math.min(b, cb.bottom);
  const e = end.getBoundingClientRect();
  return (Math.max(0, Math.min(e.right, r) - Math.max(e.left, l)) * Math.max(0, Math.min(e.bottom, b) - Math.max(e.top, t))) / Math.max(1, (r - l) * (b - t));
});

// ------------------------------------------------------------------ gallery
async function gallery(viewport: { width: number; height: number }, mobile: boolean, label: string) {
  console.log(`\ngallery ${label}`);
  const { page, errors, thirdParty, requests, close } = await open(viewport, mobile);
  // the hero figures a visitor without JavaScript (or a crawler) reads, before gallery.js replaces them
  const staticStats = await (await fetch(srv.url('index.html'))).text().then(t => ['homes', 'builders', 'area'].map(k => (t.match(new RegExp(`data-stat="${k}">([^<]*)<`)) || [])[1]));
  await page.goto(srv.url('index.html'));
  await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
  const cards = await page.$$eval('#grid .card', (els: Element[]) => els.length);
  ok(cards === 30, `${cards} cards`);
  const liveStats = await page.$$eval('[data-stat]', (els: Element[]) => els.map(e => e.textContent));
  ok(JSON.stringify(liveStats) === JSON.stringify(staticStats), `the static hero figures are the data's (${staticStats.join(' / ')})`);
  const titles: string[] = await page.$$eval('#grid .card h3', (els: Element[]) => els.map(e => e.textContent || ''));
  ok(titles.length === 30 && !titles.some(t => /base\s*game|basegame|\bBG\b/i.test(t)) && new Set(titles).size === 30, `card names carry no Sims jargon and are all distinct (${titles.slice(0, 3).join(', ')}, …)`);
  const storeysLabels = await page.$$eval('#storeys button', (els: Element[]) => els.map(e => e.textContent));
  ok(storeysLabels.join('|') === 'Any|1|2|3+', `the storeys filter reads ${storeysLabels.join(' · ')}`);
  const credits: string[] = await page.$$eval('#builds-list li', (els: Element[]) => els.map(e => e.textContent || ''));
  ok(credits.length === 30 && credits.some(c => /after “Base Game Modern Home” by SimsWithNora/.test(c)), `the footer credits every build by its own title (${credits.find(c => /Base Game Modern Home”/.test(c)) || credits[0]})`);
  const hrefs: string[] = await page.$$eval('#grid .card a, #hero-play, #hero-media', (els: HTMLAnchorElement[]) => els.map(a => a.href));
  ok(hrefs.length === 32 && hrefs.every(h => !new URL(h).searchParams.has('play')), 'no gallery link forces autoplay (the player decides, and honours reduced motion)');
  // the cards go to the player; the homes' own pages are linked from the footer, in the rendered DOM a crawler that runs the page reads
  const pageLinks: string[] = await page.$$eval('a[href*="homes/"]', (els: HTMLAnchorElement[]) => els.map(a => new URL(a.href).pathname));
  ok(pageLinks.length === 30 && new Set(pageLinks).size === 30 && pageLinks.every(h => h.startsWith(`${BASE}homes/`)), `once gallery.js has run, the page links all ${new Set(pageLinks).size} homes' own pages (the footer's list: ${pageLinks[0].replace(BASE, '')} … ${pageLinks[29].replace(BASE, '')})`);
  // load every thumbnail (lazy ones too) and check each decoded
  await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('#grid img')).every(i => i.complete), null, { timeout: 20000 });
  const decoded = await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.filter(i => i.naturalWidth === 640 && i.naturalHeight === 360).length);
  ok(decoded === 30, `${decoded} of 30 thumbnails decoded at 640 × 360`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await shot(page, `gallery-${label}`);
  const visible = () => page.$$eval('#grid .card', (els: HTMLElement[]) => els.filter(e => !e.hidden).length);
  if (!mobile) {
    // a pointer over a card warms three.js, the engine and that home's spec — never room-creator.html, whose player URL
    // carries a query and so could never be served from that request. They are ordinary fetches (a prefetch is refused with
    // a 503 by the live zone), and the engine's modules are asked for by the hash the player will use
    const before = requests.length;
    await page.hover('#grid .card:nth-child(5) a');
    await sleep(1500);
    const warmed: string[] = requests.slice(before).map((u: string) => u.replace(srv.origin, '')).filter((u: string) => /\/(assets|content)\//.test(u));
    const id5 = await page.$eval('#grid .card:nth-child(5)', (e: HTMLElement) => e.dataset.id);
    const viewerUrl = await page.evaluate(() => JSON.parse(document.querySelector('script[type="importmap"]')!.textContent!).imports['./assets/viewer.js']);
    ok(warmed.some(u => u.includes('assets/vendor/three/three.module.min.js')) && warmed.some(u => u.includes(`content/houses/${id5}.json`)) && warmed.some(u => u.endsWith(viewerUrl.replace(/^\.\//, ''))) && !warmed.some(u => u.includes('room-creator')), `hovering a card warms ${warmed.length} files (the engine by its hash), not the page`);
    ok(await page.$$eval('link[rel="prefetch"]', (ls: Element[]) => ls.length) === 0, 'and with plain fetches: no <link rel="prefetch"> (the live zone refuses those with a 503)');
  }
  await page.fill('#q', 'brick');
  await sleep(250);
  const brick = await visible();
  ok(brick > 0 && brick < 30, `search "brick" narrows to ${brick}`);
  ok((await page.evaluate(() => location.search)).includes('q=brick'), 'the search is in the URL');
  await page.fill('#q', '');
  await sleep(250);   // the search input is debounced: let the cleared query land before the next filter
  const tagCounts = () => page.$$eval('#tags .tag', (els: HTMLElement[]) => els.map(e => `${e.dataset.tag} ${e.querySelector('small')!.textContent}${(e as HTMLButtonElement).disabled ? ' off' : ''}`).join(', '));
  const countsAll = await tagCounts();
  await page.click('#storeys button[data-storeys="1"]');
  const one = await visible();
  ok(one > 0 && one < 30, `1 storey narrows to ${one}`);
  const countsOne = await tagCounts();
  ok(countsOne !== countsAll, `the style tags count what the storeys filter leaves (${countsOne})`);
  await page.click('#storeys button[data-storeys=""]');
  const tag = await page.$('#tags .tag');
  if (tag) { await tag.click(); const n = await visible(); ok(n > 0 && n < 30, `a style tag narrows to ${n}`); await tag.click(); }
  await page.fill('#q', 'zzzz-no-such-home');
  await sleep(250);
  ok(await page.isVisible('#empty'), 'no match shows the empty state');
  await page.click('#clear');
  ok((await visible()) === 30, 'clear filters shows all 30');
  if (!mobile) {
    await page.evaluate(() => document.getElementById('homes')!.scrollIntoView());
    await sleep(400);
    await shot(page, `gallery-${label}-grid`);
  } else {
    await page.evaluate(() => window.scrollTo(0, 1100));
    await sleep(400);
    await shot(page, `gallery-${label}-scrolled`);
  }
  // the hero's Core line points at the band that says what it is
  await page.click('.core-more');
  await sleep(200);
  ok(await page.evaluate(() => location.hash === '#core' && document.getElementById('core')!.matches('.cta-band')), 'the hero\'s "What is the Companion Core?" goes to the band that says');
  // a card opens the player
  await page.click('#grid .card:nth-child(2) a');
  // the navigation, not its load event (three.js and the engine are part of that, and a loaded machine takes a
  // while over them); viewerReady below waits for the player itself
  await page.waitForURL(/room-creator\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
  await viewerReady(page);
  ok(true, `a card opens the player (${new URL(page.url()).searchParams.get('house')})`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  ok(thirdParty.length === 0, `the gallery and the player ask no third party for anything${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ the built site's own pages
async function pages() {
  console.log('\npages');
  const get = async (p: string) => { const r = await fetch(srv.url(p), { redirect: 'manual' }); return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text() }; };
  const index = JSON.parse(fs.readFileSync(path.join(DIR, 'content', 'houses', 'index.json'), 'utf8'));
  const ids: string[] = index.houses.map((h: { id: string }) => h.id);
  const links = ['https://ci.computer', 'https://ci.computer/core', 'https://ci.computer/download', 'https://docs.ci.computer/docs/apps-available/first-party-apps'];

  // the gallery's HTML, as a crawler or a visitor without JavaScript gets it
  const gallery = await get('index.html');
  const listed = [...gallery.text.matchAll(/<li class="card" data-id="([^"]+)"><a href="\.\/homes\/([^"]+)"/g)];
  ok(listed.length === ids.length && listed.every(m => m[1] === m[2]) && listed.map(m => m[1]).join() === ids.join(), `the gallery's HTML lists all ${listed.length} homes, each linking its page (./homes/<id>)`);
  ok(links.every(l => gallery.text.includes(`href="${l}"`)) && gallery.text.includes('href="https://ci.computer/privacy-policy"') && gallery.text.includes('href="https://ci.computer/terms-of-service"'), 'and carries the main site, /core, /download, the docs, privacy and terms');
  // one callout, not four: the header, the band and the footer offer Buy and Download (the hero only says what the Core is, and
  // points at the band), the main site is linked from the header and the footer, and no sentence is said twice
  const count = (t: string, url: string) => t.split(`href="${url}"`).length - 1;
  ok(count(gallery.text, links[1]) === 3 && count(gallery.text, links[2]) === 3 && count(gallery.text, links[0]) === 2, `the gallery offers Buy Companion Core ${count(gallery.text, links[1])}×, Download ${count(gallery.text, links[2])}× and links ci.computer ${count(gallery.text, links[0])}×`);
  const sentences = [...gallery.text.matchAll(/The small computer on (?:your|the) desk/g)].length;
  ok(sentences === 1, `"The small computer on your desk …" is said once on the gallery (${sentences})`);
  const heroLinks = [...gallery.text.matchAll(/id="hero-(?:play|media)" href="([^"]+)"/g)].map(m => m[1]);
  ok(heroLinks.length === 2 && heroLinks.every(h => h.startsWith('./room-creator?mode=view')), 'its hero links go to the player without .html');

  // a home's own page
  const aurora = await get('homes/aurora');
  const h1 = (aurora.text.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1];
  ok(aurora.status === 200 && h1 === 'Aurora' && /<img src="\.\.\/portal\/previews\/aurora\.jpg" alt="[^"]+" width="1200" height="630"/.test(aurora.text) && aurora.text.includes('href="../room-creator?mode=view&amp;house=aurora"'), `/homes/aurora is a page of its own: <h1>${h1}</h1>, its picture, a way into the player`);
  ok(/<link rel="canonical" href="https:\/\/homes\.ci\.computer\/homes\/aurora">/.test(aurora.text) && /"@type":"BreadcrumbList"/.test(aurora.text) && links.every(l => aurora.text.includes(`href="${l}"`)), 'with its canonical, a breadcrumb in JSON-LD and the four links');
  // every home's title fits a search result and is its own
  const homeTitles: string[] = [];
  for (const id of ids) homeTitles.push(((await get(`homes/${id}`)).text.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const longest = homeTitles.reduce((a, t) => (t.length > a.length ? t : a), '');
  ok(homeTitles.length === ids.length && new Set(homeTitles).size === ids.length && longest.length <= 60, `the ${ids.length} homes' titles are all different and at most 60 characters (the longest: "${longest}", ${longest.length})`);
  const direct = await get('homes/aurora.html');
  ok(direct.status === 200, '… and homes/aurora.html is served too (Pages answers it with a 308 to the address above)');

  // the player and the editor are one file: out of the index in its own HTML, with the four links where JavaScript is off
  const rc = await get('room-creator.html');
  ok(links.every(l => rc.text.includes(`href="${l}"`)) && /<noscript>/.test(rc.text), 'room-creator.html (the player and the editor) carries the four links in its own HTML, in a <noscript> for a visitor without JavaScript');
  ok((rc.text.match(/<meta name="robots"/g) || []).length === 1 && /<meta name="robots" content="noindex, follow">/.test(rc.text) && !/<link rel="canonical"/.test(rc.text), 'and is noindex, follow in that HTML (nothing has to run for a crawler to know), with no canonical to contradict it');

  // robots, sitemap, 404, icons, manifest
  const robots = await get('robots.txt');
  ok(robots.status === 200 && /^text\/plain/.test(robots.type) && /^Sitemap: https:\/\/\S+\/sitemap\.xml$/m.test(robots.text), `robots.txt is text/plain and names the sitemap`);
  const sitemap = await get('sitemap.xml');
  const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(sitemap.status === 200 && locs.length === ids.length + 1 && ids.every(id => locs.some(l => l.endsWith(`/homes/${id}`))) && !locs.some(l => /\.html$/.test(l)), `sitemap.xml lists the gallery and ${locs.length - 1} homes, none with .html`);
  const missing = await get('no-such-page');
  ok(missing.status === 404 && /<title>Page not found/.test(missing.text) && /<h1>Page not found<\/h1>/.test(missing.text) && links.every(l => missing.text.includes(`href="${l}"`)), 'an unknown path answers 404 with the 404 page, which links the four');
  ok(['og:url', 'og:image:width', 'og:image:height', 'og:image:alt'].every(p => missing.text.includes(`property="${p}"`)) && missing.text.includes('name="twitter:image:alt"') && gallery.text.includes('name="twitter:image:alt"'), 'the 404 page and the gallery carry og:url (the 404), the image\'s size and alt, and twitter:image:alt');
  const ico = await fetch(srv.url('favicon.ico')), apple = await fetch(srv.url('apple-touch-icon.png'));
  const icoBytes = new Uint8Array(await ico.arrayBuffer()), appleBytes = new Uint8Array(await apple.arrayBuffer());
  ok(ico.ok && icoBytes[2] === 1 && apple.ok && appleBytes[1] === 0x50 && appleBytes[2] === 0x4e, '/favicon.ico (an ICO) and /apple-touch-icon.png (a PNG) are served at the root');
  const manifest = JSON.parse((await get('portal/site.webmanifest')).text);
  const iconsThere = (manifest.icons || []).every((i: { src: string }) => fs.existsSync(path.join(DIR, 'portal', i.src)));
  ok(manifest.name && manifest.icons?.length >= 2 && iconsThere, `the web manifest names the site and its ${manifest.icons?.length} icons, which exist`);
  const headers = fs.readFileSync(path.join(DIR, '_headers'), 'utf8');
  ok(/frame-ancestors/.test(headers) && /Permissions-Policy/.test(headers) && /https:\/\/:project\.pages\.dev\/\*\s+X-Robots-Tag: noindex/.test(headers) && !/script-src|default-src/.test(headers), '_headers: frame-ancestors, a Permissions-Policy, noindex on the pages.dev addresses, and no script-src to trip the analytics snippet');

  // a shared moment forwards to the player; the page without one stays
  {
    const { page, errors, close } = await open({ width: 1280, height: 800 });
    await page.goto(srv.url('homes/aurora'));
    await sleep(600);
    ok(new URL(page.url()).pathname === `${BASE}homes/aurora` && (await page.$eval('h1', (e: Element) => e.textContent)) === 'Aurora', 'a home\'s page without a shared moment stays on the page');
    await page.screenshot({ path: path.join(SHOTS, 'home-page-1280.png') });
    ok(await page.isVisible('.cta-band a[href="https://ci.computer/core"]') && await page.isVisible('.site-head a[href="https://ci.computer/core"]'), 'its header and its band offer the Companion Core');
    await page.click('.hero-cta .btn-primary');
    await page.waitForURL(/room-creator\?mode=view&house=aurora/, { waitUntil: 'commit', timeout: 30000 });
    await viewerReady(page);
    ok(true, 'Open in 3D starts the player');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  {
    // the player and the editor stay out of the index (each home's own page is what a search engine finds)
    const { page, errors, close } = await open({ width: 1280, height: 800 });
    await page.goto(srv.url('room-creator?mode=view&house=aurora'));
    await viewerReady(page);
    await sleep(300);
    ok((await page.$$('meta[name="robots"]')).length === 1 && await page.$eval('meta[name="robots"]', (e: HTMLMetaElement) => e.content) === 'noindex, follow' && await page.$('link[rel="canonical"]') === null, 'the player is out of the index, once, with no canonical (the home\'s page is what a search engine finds)');
    await page.goto(srv.url('room-creator?house=aurora'));
    await page.waitForFunction(() => document.documentElement.dataset.houseReady === 'aurora', null, { timeout: 90000 });
    ok((await page.$$('meta[name="robots"]')).length === 1 && /^noindex/.test(await page.$eval('meta[name="robots"]', (e: HTMLMetaElement) => e.content)), 'the editor is noindex, and its script adds no second tag to the one in the HTML');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
}

// ------------------------------------------------------------------ link previews of the built pages
async function previews() {
  console.log('\nlink previews');
  const head = (html: string) => html.slice(0, html.indexOf('</head>'));
  const gallery = head(await (await fetch(srv.url('index.html'))).text());
  const player = head(await (await fetch(srv.url('room-creator.html'))).text());
  const og = (h: string, p: string) => (h.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1] || '';
  ok(/^https?:\/\//.test(og(gallery, 'og:image')) && og(gallery, 'og:image').endsWith('portal/hero.jpg') && og(gallery, 'og:image:type') === 'image/jpeg' && /summary_large_image/.test(gallery), `the gallery previews with its hero, a JPEG (${og(gallery, 'og:image')})`);
  ok(og(player, 'og:image').endsWith('portal/hero.jpg') && og(player, 'og:site_name') === og(gallery, 'og:site_name'), `the player previews with the same image and site name (${og(player, 'og:site_name')})`);
  // the import map (~8 KB) comes after the charset, the title and the preview tags, not before them
  const raw = await (await fetch(srv.url('index.html'))).text();
  ok(raw.search(/<meta charset/i) < 1024 && raw.indexOf('<meta property="og:title"') < 4096 && raw.indexOf('<meta name="twitter:image:alt"') < raw.indexOf('type="importmap"') && raw.indexOf('type="importmap"') < raw.indexOf('rel="modulepreload"'), `the gallery's charset (byte ${raw.search(/<meta charset/i)}) and preview tags (og:title at ${raw.indexOf('<meta property="og:title"')}) come before its import map (${raw.indexOf('type="importmap"')}), which comes before the first module`);
  const jpeg = await fetch(srv.url('portal/hero.jpg'));
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  ok(jpeg.ok && bytes[0] === 0xff && bytes[1] === 0xd8, 'portal/hero.jpg is served, and is a JPEG');
  const staticHead = player.slice(0, player.indexOf('<script'));
  ok(!/Room Creator|SimsTree|Pascal/.test(staticHead) && /<title>Virtual homes/.test(staticHead) && /^https?:\/\//.test(og(player, 'og:image')), `room-creator.html's static head is the site's, not the editor's (${(staticHead.match(/<title>([^<]*)/) || [])[1]})`);
}

// ------------------------------------------------------------------ caching of the built site
// The engine's modules are not fingerprinted by file name, and a browser (or the custom domain's zone, which rewrote
// Cache-Control to four hours whatever the origin said) can keep an old copy of one while the page that asks for it is new:
// the player then stops with "This home could not be opened". Two things keep that from happening: portal/_headers asks for
// revalidation, and the pages name every module by a hash of its content, so an old copy is never the one asked for.
async function caching() {
  console.log('\ncaching');
  const file = path.join(DIR, '_headers');
  ok(fs.existsSync(file), 'dist/_headers is there (Cloudflare Pages reads it from the site root)');
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const rules = lines.filter(l => !/^\s/.test(l)), values = lines.filter(l => /^\s+cache-control\s*:/i.test(l)).map(l => l.split(':').slice(1).join(':').trim());
    ok(rules.includes('/*'), 'a rule for every path (/*)');
    ok(values.length > 0 && values.every(v => /(^|[ ,])max-age=0([ ,]|$)/.test(v) && /must-revalidate/.test(v)), `every Cache-Control rule is max-age=0, must-revalidate (${values.join(' | ') || 'none'})`);
  }

  const hash = (rel: string): string => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, rel))).digest('hex').slice(0, 10);
  const walkDir = (dirRel: string): string[] => fs.readdirSync(path.join(DIR, dirRel)).flatMap(n => { const r = `${dirRel}/${n}`; return fs.statSync(path.join(DIR, r)).isDirectory() ? walkDir(r) : [r]; });
  const modules = walkDir('assets').filter(f => f.endsWith('.js') && !f.startsWith('assets/vendor/'));
  for (const page of ['index.html', 'room-creator.html']) {
    const html = fs.readFileSync(path.join(DIR, page), 'utf8');
    let map: Record<string, string> = {};
    try { map = JSON.parse((html.match(/<script type="importmap">([\s\S]*?)<\/script>/) || [])[1] || '{}').imports || {}; } catch { /* reported below */ }
    const wrong = modules.filter(m => map[`./${m}`] !== `./${m}?v=${hash(m)}`);
    ok(modules.length > 50 && wrong.length === 0, `${page}: the import map names all ${modules.length} modules by the hash of their content${wrong.length ? ` (wrong: ${wrong.slice(0, 3).join(', ')})` : ''}`);
    const bare = [...html.matchAll(/(?:src|href)="(\.\/(?:assets|portal)\/[^"?#]+\.(?:js|css))"/g)].map(m => m[1]).filter(u => !u.includes('/vendor/'));
    ok(bare.length === 0, `${page}: every script, stylesheet and module preload carries a content hash${bare.length ? ` (without: ${bare.slice(0, 3).join(', ')})` : ''}`);
    if (page === 'room-creator.html') ok(map.three && map['three/addons/'], "room-creator.html: three.js and its addons are still in the import map");
  }

  // in a browser: the player pulls every module by its hash...
  {
    const { page, errors, requests, close } = await open({ width: 1280, height: 800 });
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    await viewerReady(page);
    const asked = requests.filter(u => /\/assets\/.*\.js(\?|$)/.test(u) && !/\/assets\/vendor\//.test(u));
    const bare = asked.filter(u => !/[?&]v=[0-9a-f]{10}$/.test(u));
    ok(asked.length > 50 && bare.length === 0, `the player pulls ${asked.length} modules, each by its hash${bare.length ? ` (without: ${bare.slice(0, 3).join(', ')})` : ''}`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  // ...so whatever an old build left in the browser's cache under the plain URLs is never used. Poison every plain module
  // URL: the player must start without touching one (this is the failure that stopped every home after the first deploy)
  {
    const { page, errors, close } = await open({ width: 1280, height: 800 });
    let poisoned = 0;
    await page.route((u: URL) => /\/assets\/.*\.js$/.test(u.pathname) && !/\/assets\/vendor\//.test(u.pathname) && !u.searchParams.has('v'), (r: any) => { poisoned++; return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("a stale module was used")' }); });
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    const state = await viewerReady(page).then(() => 'ready').catch(() => 'not ready');
    ok(state === 'ready' && poisoned === 0 && errors.length === 0, `with every un-hashed module URL poisoned, the player still starts and never asks for one (${state}, ${poisoned} asked${errors.length ? ': ' + errors[0] : ''})`);
    await close();
  }
}

// ------------------------------------------------------------------ player
async function player(id: string, viewport: { width: number; height: number }, mobile: boolean, label: string, full: boolean) {
  console.log(`\nplayer ${id} ${label}`);
  const { page, errors, thirdParty, close } = await open(viewport, mobile);
  const t0 = Date.now();
  await page.goto(srv.url(`room-creator.html?mode=view&house=${id}&play=1`));
  await sleep(250);
  await shot(page, `player-${id}-${label}-loading`);
  await viewerReady(page);
  ok(true, `built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.creator-topbar')!).display === 'none'), 'editor chrome is hidden');
  if (!mobile) {
    // the help panel carries the main site, buy, download and docs, each opening a tab (the shot keeps playing here)
    await page.click('.vh-top [data-act="help"]');
    const helpLinks = await page.$$eval('.vh-help-links a', (as: HTMLAnchorElement[]) => as.map(a => ({ href: a.href, tab: a.target === '_blank' && /noopener/.test(a.rel), shown: a.getBoundingClientRect().height > 0 })));
    ok(JSON.stringify(helpLinks.map((l: any) => l.href)) === JSON.stringify(['https://ci.computer/', 'https://ci.computer/core', 'https://ci.computer/download', 'https://docs.ci.computer/docs/apps-available/first-party-apps']) && helpLinks.every((l: any) => l.tab && l.shown), `the About panel links ci.computer, /core, /download and the docs, each in a new tab`);
    ok(await page.isVisible('.vh-help-keys') && /Companion Core/.test((await page.textContent('.vh-help-about')) || ''), 'and says what the Companion Core is, then lists the keyboard shortcuts');
    await page.click('.vh-help [data-act="help"]');
  } else {
    // a phone has no "?" key and no mouse: the same panel is in the More sheet (More > About), with 44 px links and no keyboard list
    await tapTool(page, 'help');
    await sleep(300);
    const sheet = await page.$$eval('.vh-help-links a', (as: HTMLAnchorElement[]) => as.map(a => ({ href: a.href, h: Math.round(a.getBoundingClientRect().height), tab: a.target === '_blank' && /noopener/.test(a.rel) })));
    ok(await page.isVisible('.vh-help') && JSON.stringify(sheet.map((l: any) => l.href)) === JSON.stringify(['https://ci.computer/', 'https://ci.computer/core', 'https://ci.computer/download', 'https://docs.ci.computer/docs/apps-available/first-party-apps']) && sheet.every((l: any) => l.tab && l.h >= 44), `on a phone, More > About opens the panel with ci.computer, /core, /download and the docs, each a ${sheet.map((l: any) => l.h).join('/')} px tap target`);
    ok(!(await page.isVisible('.vh-help-keys')) && (await page.$eval('.vh-help', (e: HTMLElement) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })), 'without the keyboard list, and inside the screen');
    await shot(page, `player-${id}-${label}-about`);
    await page.tap('.vh-help [data-act="help"]');
    await sleep(200);
    ok(!(await page.isVisible('.vh-help')), 'and its close button puts it away');
  }
  const chips = await page.$$eval('.vh-shots .vh-chip', (els: HTMLElement[]) => els.map(e => ({ key: e.dataset.shot, label: e.querySelector('span')!.textContent })));
  const presetShots = await page.evaluate(() => { const s = (window as any).__houseDebug().house.shots; return [...new Set(Object.values(s))].length; });
  ok(chips.length === presetShots && chips.length >= 4, `${chips.length} shots listed from the house's presets (${chips.map((c: any) => c.label).join(', ')})`);
  ok(new URL(page.url()).searchParams.get('shot') === 'orbit' && (await page.getAttribute('.vh-shots .vh-chip[data-shot="orbit"]', 'aria-pressed')) === 'true', 'a link without shot= opens on the Orbit');
  const shownName = ((await page.textContent('.vh-name')) || '').trim();
  ok(!/base\s*game|basegame|\bBG\b/i.test(shownName) && (await page.title()) === `${shownName} · Virtual homes`, `the player names the home "${shownName}" (tab: ${await page.title()})`);
  const seekH = await page.$eval('.vh-scrub input', (e: HTMLElement) => e.getBoundingClientRect().height);
  ok(seekH >= (mobile ? 44 : 32), `the seek bar is a ${Math.round(seekH)} px target`);
  ok(await page.$eval('.vh-flybar', (e: any) => e.inert && getComputedStyle(e).visibility === 'hidden'), 'the free-camera bar is inert and hidden until flying');
  // play: t advances. A loaded machine can spend most of the shot between "ready" and here (and a shot that has
  // run to its end has stopped), so start it again from the top first: every check below then has room either side
  await page.keyboard.press('Home');
  if ((await page.getAttribute('.vh', 'data-playing')) !== '1') await page.keyboard.press('Space');
  const a = await scrubT(page); await sleep(1200); const b = await scrubT(page);
  ok(b > a, `playing advances t (${a.toFixed(3)} → ${b.toFixed(3)})`);
  if (!mobile) await page.mouse.move(viewport.width / 2, viewport.height / 3);
  await shot(page, `player-${id}-${label}-playing`);
  // pause
  if (mobile) {
    // a touch screen fades the controls IDLE_TOUCH_MS (4 s) into a shot, and a tap on the scene brings them back; a
    // loaded machine spends longer than that on the screenshot above, and the play button is then, correctly,
    // unreachable (the canvas takes the tap). Wake them the way a person would, then press it.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await page.evaluate(() => document.querySelector('.vh')!.classList.contains('vh-idle'))) await page.touchscreen.tap(viewport.width / 2, viewport.height / 3);
      try { await page.tap('.vh-play', { timeout: 4000 }); break; } catch (e) { if (attempt === 2) throw e; }
    }
  } else await page.keyboard.press('Space');
  await sleep(150);
  const c = await scrubT(page); await sleep(600); const d = await scrubT(page);
  ok(Math.abs(d - c) < 1e-6 && (await page.getAttribute('.vh', 'data-playing')) === '0', 'pause holds t');
  if (!mobile) {
    // Space on a keyboard-focused button is that button's key (here Path), not play/pause
    await page.focus('[data-act="path"]');
    await page.keyboard.press('Space');
    await sleep(150);
    const pressed = await page.getAttribute('[data-act="path"]', 'aria-pressed'), stillPaused = await page.getAttribute('.vh', 'data-playing');
    await page.keyboard.press('Space');
    await sleep(100);
    ok(pressed === 'true' && stillPaused === '0' && (await page.getAttribute('[data-act="path"]', 'aria-pressed')) === 'false' && (await page.getAttribute('.vh', 'data-playing')) === '0', 'Space on a focused button presses it and leaves playback alone');
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  }
  // scrub: a click on the track lands where it was clicked, and the readout follows. The target is whichever of
  // 30 % or 70 % is further from where the pause landed, so the readout always has somewhere to go
  const box = await page.$eval('.vh-scrub input', (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const before = await page.textContent('.vh-now');
  const aim = Math.abs(d - 0.7) > Math.abs(d - 0.3) ? 0.7 : 0.3;
  await page.mouse.click(box.x + box.w * aim, box.y + box.h / 2);
  await sleep(200);
  const st = await scrubT(page);
  ok(Math.abs(st - aim) < 0.03, `scrub lands at t = ${st.toFixed(3)} (clicked at ${aim})`);
  ok((await page.textContent('.vh-now')) !== before, `the time readout follows (${await page.textContent('.vh-now')})`);
  // switch shot
  const orbit = chips.find((x: any) => x.key === 'orbit') || chips[1];
  await page.click(`.vh-shots .vh-chip[data-shot="${orbit.key}"]`);
  await sleep(300);
  ok((await page.getAttribute(`.vh-shots .vh-chip[data-shot="${orbit.key}"]`, 'aria-pressed')) === 'true' && new URL(page.url()).searchParams.get('shot') === orbit.key, `switches to ${orbit.label} (URL follows)`);
  ok(await page.evaluate(() => (window as any).__houseDebug().presets && document.querySelector('.vh-dur')!.textContent!.length > 0), 'the shot duration is shown');
  // the camera flies the house's own preset: at t = 0 it stands on the preset's first eye point
  for (const key of ['orbit', 'door-to-core']) {
    if (!chips.some((x: any) => x.key === key)) continue;
    await page.click(`.vh-shots .vh-chip[data-shot="${key}"]`);
    if ((await page.getAttribute('.vh', 'data-playing')) === '1') await page.click('.vh-play');
    if (mobile) await page.$eval('.vh-scrub input', (e: HTMLInputElement) => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    else await page.keyboard.press('Home');
    await sleep(200);
    const [cam, first] = await page.evaluate((k: string) => { const d = (window as any).__houseDebug(); const p = d.presets[`house:${d.house.id}:${k}`].eyePoints[0]; return [d.camera.position.toArray(), [p.x, p.y, p.z]]; }, key);
    ok(dist(cam, first) < 1e-3, `${key} at t = 0 is the preset's first eye point (${dist(cam, first).toFixed(4)} m)`);
  }
  // time of day
  await page.click('.vh-tods .vh-chip[data-tod="night"]');
  await sleep(300);
  ok((await page.evaluate(() => (window as any).__houseLighting.preset)) === 'night' && new URL(page.url()).searchParams.get('tod') === 'night', 'night lights the house (URL follows)');
  await page.click('.vh-tods .vh-chip[data-tod="golden"]');
  await sleep(200);
  ok((await page.evaluate(() => (window as any).__houseLighting.preset)) === 'golden', 'golden hour');
  // path
  if (mobile) await tapTool(page, 'path'); else await page.keyboard.press('p');
  await sleep(250);
  ok(await page.evaluate(() => { const o = (window as any).__houseDebug().scene.getObjectByName('viewer: camera path'); return !!o && o.visible; }), 'the camera path is drawn in the scene');
  await page.click('.vh-shots .vh-chip[data-shot="door-to-core"]');
  await sleep(250);
  if (!mobile) await page.keyboard.press('Space');
  else await page.tap('.vh-play');
  await sleep(250);
  await page.click('.vh-tods .vh-chip[data-tod="day"]');
  await sleep(1400);
  await shot(page, `player-${id}-${label}-path`);
  // fly
  if (mobile) await tapTool(page, 'fly'); else await page.keyboard.press('f');
  await sleep(200);
  ok((await page.getAttribute('.vh', 'data-fly')) === '1' && (await page.$eval('.vh-flybar', (e: any) => !e.inert)), 'fly mode on');
  if (!mobile && full) {
    // the free-camera bar has its own row: at a common laptop width it clears the title and the actions
    await page.setViewportSize({ width: 1280, height: 800 });
    await sleep(300);
    const clear = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const fb = r('.vh-flybar'), hit = (b: DOMRect) => !(fb.right <= b.left || b.right <= fb.left || fb.bottom <= b.top || b.bottom <= fb.top);
      return !hit(r('.vh-title')) && !hit(r('.vh-actions'));
    });
    ok(clear, 'at 1280 px the free-camera bar clears the title and the actions');
    // the full dock's shot chips all show (none hidden past the row's fade) from 761 px up
    const clipped: number[] = [];
    for (const width of [768, 900, 1012, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await sleep(250);
      if (await page.evaluate(() => {
        const sh = document.querySelector('.vh-shots')!, box = sh.getBoundingClientRect(), pad = parseFloat(getComputedStyle(sh).paddingRight);
        return sh.lastElementChild!.getBoundingClientRect().right > box.right - pad + 0.5;
      })) clipped.push(width);
    }
    ok(!clipped.length, `every shot chip shows at 768, 900, 1012 and 1024 px${clipped.length ? ` (clipped at ${clipped.join(', ')})` : ''}`);
    await page.setViewportSize(viewport);
    await sleep(300);
  }
  if (!mobile) {
    const p0 = await camPos(page);
    await page.keyboard.down('w'); await sleep(500); await page.keyboard.up('w');
    const p1 = await camPos(page);
    ok(dist(p0, p1) > 0.5, `W flies forward ${dist(p0, p1).toFixed(2)} m`);
    await page.keyboard.down('e'); await sleep(300); await page.keyboard.up('e');
    const p2 = await camPos(page);
    ok(p2[1] > p1[1] + 0.3, 'E rises');
    // Q sinks, down to the lot's ground and no further
    await page.keyboard.down('q'); await sleep(2500); await page.keyboard.up('q');
    const p3 = await camPos(page);
    ok(p3[1] < p2[1] - 0.3 && p3[1] >= 0.249, `Q sinks to the ground and stops there (y = ${p3[1].toFixed(2)} m)`);
    await page.keyboard.down('e'); await sleep(400); await page.keyboard.up('e');
  }
  // overview opens the house (cutaway) and frames the path from above
  const beforeOverview = await camPos(page);
  if (mobile) await page.tap('[data-act="overview"]'); else await page.keyboard.press('o');
  await sleep(1400);
  const afterOverview = await camPos(page);
  ok(dist(beforeOverview, afterOverview) > 1 && (await page.getAttribute('[data-act="cutaway"]', 'aria-pressed')) === 'true', `overview lifts the camera ${dist(beforeOverview, afterOverview).toFixed(1)} m and opens the cutaway`);
  ok(await page.evaluate(() => { const s = (window as any).__houseDebug().scene; let roofs = 0, shown = 0; s.traverse((o: any) => { if (o.userData && o.userData.isRoof) { roofs++; if (o.visible) shown++; } }); return roofs === 0 || shown === 0; }), 'the cutaway takes the roofs off');
  await shot(page, `player-${id}-${label}-overview`);
  // drag turns the view
  const q0 = await page.evaluate(() => (window as any).__houseDebug().camera.quaternion.toArray());
  const cx = viewport.width / 2, cy = viewport.height * 0.4;
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', cx, cy); for (let i = 1; i <= 10; i++) { await touch('touchMove', cx - i * 12, cy + i * 2); await sleep(16); } await touch('touchEnd', 0, 0);
  } else {
    await page.mouse.move(cx, cy); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(cx - i * 18, cy + i * 3); await sleep(16); } await page.mouse.up();
  }
  await sleep(500);
  const q1 = await page.evaluate(() => (window as any).__houseDebug().camera.quaternion.toArray());
  ok(q0.some((v: number, i: number) => Math.abs(v - q1[i]) > 0.01), 'a drag turns the free camera');
  // play while flying: the ghost camera moves along the path
  const g0 = await page.evaluate(() => (window as any).__houseDebug().scene.getObjectByName('viewer: shot camera').position.toArray());
  await page.click('.vh-play');
  await sleep(900);
  const g1 = await page.evaluate(() => (window as any).__houseDebug().scene.getObjectByName('viewer: shot camera').position.toArray());
  ok(dist(g0, g1) > 0.05 && (await page.evaluate(() => (window as any).__houseDebug().scene.getObjectByName('viewer: shot camera').visible)), 'playing while flying moves the ghost camera along the path');
  await page.click('.vh-play');
  await sleep(200);
  await shot(page, `player-${id}-${label}-fly`);
  // back to the shot: Esc puts the camera where the ghost is (the shot's own camera at this t)
  const ghostAt = await page.evaluate(() => (window as any).__houseDebug().scene.getObjectByName('viewer: shot camera').position.toArray());
  if (mobile) await page.tap('[data-act="exit-fly"]'); else await page.keyboard.press('Escape');
  await sleep(300);
  const back = await camPos(page);
  ok((await page.getAttribute('.vh', 'data-fly')) === '0' && dist(back, ghostAt) < 1e-3, `Esc returns to the shot (camera ${dist(back, ghostAt).toFixed(4)} m from the shot's pose)`);
  // the end of the shot: a card with a way on (the next home, another shot, what the Core is), not a dead end
  await page.click('.vh-shots .vh-chip[data-shot="door-to-core"]');
  if ((await page.getAttribute('.vh', 'data-playing')) === '1') await page.click('.vh-play');
  await setScrub(page, 1000);
  await sleep(300);
  const endCard = await page.isVisible('.vh-end') && await page.isVisible('.vh-end [data-act="next"]') && await page.isVisible('.vh-end a[href="https://ci.computer/core"]') && await page.isVisible('.vh-end a[href="https://ci.computer/download"]');
  ok(endCard, `the end of the shot offers ${(await page.$$eval('.vh-end button:not([hidden])', (bs: Element[]) => bs.map(b => (b.textContent || '').trim()))).join(', ')}, and the Core and the download`);
  const endLinks = await page.$$eval('.vh-end a', (as: HTMLAnchorElement[]) => as.map(a => ({ href: a.href, tab: a.target === '_blank' && /noopener/.test(a.rel), name: (a.textContent || '').replace(/\s+/g, ' ').trim() })));
  ok(endLinks.length === 2 && endLinks.every((l: any) => l.tab && /\(opens in a new tab\)/.test(l.name)), `the end card's two links open a tab with noopener and say so (${endLinks.map((l: any) => l.name).join(' | ')})`);
  const endSizes: number[] = await page.$$eval('.vh-end-links a', (as: HTMLAnchorElement[]) => as.map(a => Math.round(a.getBoundingClientRect().height)));
  ok(endSizes.length === 2 && endSizes.every(h => h >= (mobile ? 44 : 32)), `the end card's two links are ${endSizes.join(' and ')} px tall targets (at least ${mobile ? 44 : 32})`);
  const cover = await coreCover(page);
  ok(cover >= 0 && cover < 0.05, `the end card covers ${Math.round(cover * 100)} % of the Core`);
  if (mobile) {
    // the phone turned on its side: the card spans the dock just under the Core unless it moves off it
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await sleep(700);
    const coverL = await coreCover(page);
    ok(coverL >= 0 && coverL < 0.05 && await page.isVisible('.vh-end [data-act="next"]'), `turned to ${viewport.height} × ${viewport.width}, the end card covers ${Math.round(coverL * 100)} % of the Core (${await page.getAttribute('.vh', 'data-end-side') || 'centred'})`);
    await shot(page, `player-${id}-${label}-end-landscape`);
    await page.setViewportSize(viewport);
    await sleep(500);
  }
  await setScrub(page, 500);
  await sleep(200);
  ok(!(await page.isVisible('.vh-end')), 'the end card goes when the shot is moved back');
  await shot(page, `player-${id}-${label}-back`);
  if (full) {
    // share: the copied link is the home's share page (its preview tags name the home: a link unfurler never runs
    // the player), and it reopens the player at the same moment
    await page.click('[data-act="share"]');
    await sleep(300);
    const link: string = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    const u = link ? new URL(link) : null;
    ok(!!u && u.pathname === `${BASE}homes/${id}` && u.searchParams.has('t') && u.searchParams.has('shot') && u.searchParams.has('tod'), `share copies ${link.replace(srv.origin, '')} (no .html: Pages would answer that with a redirect)`);
    if (u) {
      const sharePage = await (await fetch(link)).text();
      const name = (await page.textContent('.vh-name'))!.trim();
      const tag = (p: string) => (sharePage.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1] || '';
      const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      ok(unesc(tag('og:title')) === `${name} · Virtual homes · Companion Intelligence` && tag('og:image').endsWith(`portal/previews/${id}.jpg`) && tag('og:image:type') === 'image/jpeg' && tag('og:description').length > 20 && !/Room Creator/.test(sharePage), `the share page previews as "${unesc(tag('og:title'))}" with its JPEG preview`);
      const { page: p2, errors: e2, close: c2 } = await open(viewport, mobile);
      await p2.goto(link);
      await viewerReady(p2);
      ok(new URL(p2.url()).pathname === `${BASE}room-creator` && new URL(p2.url()).searchParams.get('house') === id, 'the share link forwards to the player');
      const t2 = await scrubT(p2);
      ok(Math.abs(t2 - Number(u.searchParams.get('t'))) < 0.002 && (await p2.getAttribute('.vh', 'data-playing')) === '0', `the link opens paused at t = ${t2.toFixed(3)}`);
      ok(e2.length === 0, `no console errors on the shared link${e2.length ? ': ' + e2.join(' | ') : ''}`);
      await c2();
    }
    // next home
    const name0 = await page.textContent('.vh-name');
    await page.click('[data-act="next"]');
    await page.waitForFunction((n: string) => document.documentElement.dataset.viewer === 'ready' && document.querySelector('.vh-name')!.textContent !== n, name0, { timeout: 90000 });
    ok(true, `next home: ${await page.textContent('.vh-name')}`);
    await sleep(1500);
    await shot(page, `player-${id}-${label}-next`);
  }
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  ok(thirdParty.length === 0, `no third-party requests${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ reduced motion
async function motion(id: string) {
  console.log('\nmotion (prefers-reduced-motion: reduce)');
  const { page, errors, close } = await open({ width: 1440, height: 900 }, false, { reducedMotion: 'reduce' });
  await page.goto(srv.url('index.html'));
  await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
  await page.click(`#grid .card[data-id="${id}"] a`);
  await viewerReady(page);
  const a = await scrubT(page); await sleep(900); const b = await scrubT(page);
  ok((await page.getAttribute('.vh', 'data-playing')) === '0' && a === 0 && b === 0, 'a home opened from the gallery holds still');
  await page.goto(srv.url(`room-creator.html?mode=view&house=${id}&play=1`));
  await viewerReady(page);
  await sleep(600);
  ok((await page.getAttribute('.vh', 'data-playing')) === '0', 'so does a link that says play=1');
  await page.keyboard.press('Space');
  await sleep(600);
  ok((await page.getAttribute('.vh', 'data-playing')) === '1' && (await scrubT(page)) > 0, 'Play still plays');
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ failures: each shows a card, never an endless loader
async function failureCases() {
  console.log('\nfailures');
  {
    const { page, errors, requests, close } = await open({ width: 1440, height: 900 });
    const t0 = Date.now();
    await page.goto(srv.url('room-creator.html?mode=view&house=nope'));
    await page.waitForSelector('.vh[data-state="error"] .vh-error:not([hidden])', { timeout: 60000 });
    const msg = await page.textContent('.vh-error-msg');
    await sleep(1500);
    const built = await page.evaluate(() => { const d = (window as any).__houseDebug && (window as any).__houseDebug(); return !!(d && d.house); });
    const specAsked = requests.some(u => u.includes('/content/houses/nope.json'));
    const unexpected = errors.filter(e => !/portal\/thumbs\/nope\.webp|status of 404/.test(e));
    const posterAsks = requests.filter(u => u.includes('/portal/thumbs/nope.webp')).length;
    ok(/no home called “nope”/.test(msg || '') && !built && !specAsked, `an unknown id: "${msg}" in ${((Date.now() - t0) / 1000).toFixed(1)} s, no spec request, nothing built`);
    // the first paint may ask for the poster once, before index.json says there is no such home; nothing after it
    ok(posterAsks <= 1 && unexpected.length === 0, `an unknown id costs at most one poster 404 (${posterAsks} poster request${posterAsks === 1 ? '' : 's'}${(posterAsks > 1 || unexpected.length) ? ': ' + errors.join(' | ') : ''})`);
    await shot(page, 'failure-unknown-id');
    await close();
  }
  for (const file of ['viewer.js', 'house-builder.js']) {
    const { page, close } = await open({ width: 1440, height: 900 });
    await page.route((u: URL) => u.pathname.endsWith(`/assets/${file}`), (r: any) => r.abort());   // (by path: the URL carries a ?v= hash)
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    const card = await page.waitForSelector('.vh-fail', { timeout: 60000 }).catch(() => null);
    const state = await page.evaluate(() => document.documentElement.dataset.viewer);
    ok(!!card && state === 'failed' && (await page.isVisible('.vh-fail a[href="./"]')) && (await page.isVisible('.vh-fail button')), `${file} not downloading: a card with Try again and See all homes (${state})`);
    ok(!/Room Creator|SimsTree/.test(await page.title()) && await page.isVisible('.vh-boot-back'), `the tab says "${await page.title()}", and a back arrow shows`);
    await shot(page, `failure-${file.replace('.js', '')}`);
    await close();
  }
  // A <script> that fails to download fires its error at the window, whoever's script it is, and the head script
  // listens for it. The production page carries two third-party tags (Google's gtag, which the deploy injects, and
  // Cloudflare's beacon, which the zone does; neither is in dist/), and a content blocker, a DNS filter or a work
  // profile refuses them. That is not the player failing, and a card over a home that plays ("This home could not
  // be opened", on every home) is the bug. Both cases hold the player's mount back (viewer.js answers 1.5 s late) so
  // the error is certain to come before it.
  for (const c of [
    // never: the card must not appear even for a moment (the player's own mount would clear a stale one, and that is the second case)
    { name: 'a refused third-party tag (googletagmanager.com)', src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST0000', abort: true, never: true },
    { name: 'a missing script of the site\'s own, which the player outlives', src: './assets/__missing-for-test.js', abort: false, never: false },
  ]) {
    const { page, close } = await open({ width: 1440, height: 900 });
    if (c.abort) await page.route((u: URL) => u.hostname === 'www.googletagmanager.com', (r: any) => r.abort());
    await page.route((u: URL) => u.pathname.endsWith('/assets/viewer.js'), async (r: any) => { await sleep(1500); await r.continue(); });
    await page.addInitScript((src: string) => {
      new MutationObserver(() => { if (document.querySelector('.vh-fail')) (window as any).__cardSeen = true; }).observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); });
    }, c.src);
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    await viewerReady(page);
    await sleep(500);
    const cards = await page.$$eval('.vh-fail', (els: Element[]) => els.length);
    const seen = await page.evaluate(() => !!(window as any).__cardSeen);
    ok(cards === 0 && (!c.never || !seen) && (await page.isVisible('.vh-scrub')), `${c.name}: the player mounts and plays with no failure card (${cards} card${cards === 1 ? '' : 's'}${c.never ? `, ${seen ? 'one showed on the way' : 'none on the way'}` : ''})`);
    await shot(page, `failure-script-${c.src.startsWith('http') ? 'third-party' : 'own-missing'}`);
    await close();
  }
  {
    // the portal's names not downloading: the gallery still lists the homes (it imports them when it runs, with a
    // fallback), and the player, which cannot start without them, shows its card under the site's title rather
    // than a spec's Sims one
    const { page, close } = await open({ width: 1440, height: 900 });
    await page.route((u: URL) => u.pathname.endsWith('/assets/home-names.js'), (r: any) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
    await page.goto(srv.url('index.html'));
    const listed = await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 }).then(() => true).catch(() => false);
    const cards = await page.$$eval('#grid .card:not(.skel)', (els: Element[]) => els.length);
    const jargon = await page.$$eval('#grid .card h3', (els: Element[]) => els.filter(e => /base\s*game|basegame|\bBG\b/i.test(e.textContent || '')).length);
    ok(listed && cards === 30 && jargon === 0, `home-names.js not downloading: the gallery still lists ${cards} homes (${jargon} with Sims jargon)`);
    await shot(page, 'failure-names-gallery');
    await page.goto(srv.url('room-creator.html?mode=view&house=cocoon'));
    const card = await page.waitForSelector('.vh-fail', { timeout: 60000 }).catch(() => null);
    await sleep(500);
    const title = await page.title();
    ok(!!card && !/base\s*game/i.test(title), `… and the player shows its card, its tab "${title}"`);
    await shot(page, 'failure-names-player');
    await close();
  }
  {
    // three.js r169 needs WebGL 2; a browser with WebGL 1 only must be told so, not left on the loader
    const b1 = await pw.chromium.launch({ headless: args.headed !== 'true', args: [...LAUNCH_ARGS, '--disable-webgl2'] });
    const { page, close } = await open({ width: 1440, height: 900 }, false, {}, b1);
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    const card = await page.waitForSelector('.vh-fail', { timeout: 30000 }).catch(() => null);
    const [gl1, gl2, state] = await page.evaluate(() => { const c = () => document.createElement('canvas'); return [!!c().getContext('webgl'), !!c().getContext('webgl2'), document.documentElement.dataset.viewer]; });
    ok(!!card && state === 'no-webgl' && gl1 && !gl2 && /WebGL 2/.test((await page.textContent('.vh-fail')) || ''), `WebGL 1 only: "${((await page.textContent('.vh-fail h2')) || '').trim()}"`);
    await shot(page, 'failure-webgl1');
    await close();
    await b1.close();
  }
}

// ------------------------------------------------------------------ the editor is still the editor
async function editor() {
  console.log('\neditor');
  const { page, errors, close } = await open({ width: 1440, height: 900 });
  await page.goto(srv.url('room-creator.html?house=aurora'));
  await page.waitForFunction(() => document.documentElement.dataset.houseReady === 'aurora', null, { timeout: 90000 });
  await sleep(500);
  ok(!(await page.$('.vh')) && !(await page.evaluate(() => document.documentElement.dataset.mode)), 'no player without ?mode=view');
  ok(await page.isVisible('.creator-topbar') && await page.isVisible('#animation-dock'), 'the editor chrome is there');
  ok(await page.evaluate(() => typeof (window as any).__houseRenderFrames === 'function' && typeof (window as any).__houseSetLighting === 'function'), 'the __house* hooks are there');
  await shot(page, 'editor-1440');
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ WebKit
// The portal is public, and Safari is where WebGL, touch and video differ most from Chromium. Playwright's WebKit must
// be the revision the pinned Playwright expects (another revision does not start), so this runs when that build is
// installed, says so and moves on when it is not, and fails on a missing build only when asked for with --webkit.
// Chromium's clipboard permissions do not exist there; the flags for Chromium's GPU do not either.
async function webkit() {
  console.log('\nwebkit');
  const wanted = args.webkit === 'true';
  const skip = (why: string) => { if (wanted) ok(false, `WebKit: ${why}`); else console.log(`  skipped: ${why}`); };
  let exe = '';
  try { exe = pw.webkit.executablePath(); } catch { /* this Playwright has no WebKit */ }
  if (!exe || !fs.existsSync(exe)) { skip('Playwright\'s WebKit is not installed for this version (pnpm exec playwright install webkit)'); return; }
  let b: any;
  try { b = await pw.webkit.launch({ headless: args.headed !== 'true', timeout: 60000 }); } catch (e) { skip(`it would not start (${String((e as Error).message).split('\n')[0]})`); return; }
  const wk = { permissions: [] as string[] };
  try {
    {
      const { page, errors, close } = await open({ width: 1440, height: 900 }, false, wk, b);
      await page.goto(srv.url('index.html'));
      await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 30000 });
      const cards = await page.$$eval('#grid .card', (els: Element[]) => els.length);
      ok(cards === 30, `WebKit gallery: ${cards} cards`);
      await shot(page, 'webkit-gallery');
      ok(errors.length === 0, `WebKit gallery: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
    {
      const { page, errors, close } = await open({ width: 1440, height: 900 }, false, wk, b);
      await page.goto(srv.url(`room-creator.html?mode=view&house=${HOUSES[0]}&shot=orbit`));
      await viewerReady(page);
      await page.mouse.move(700, 300);
      await page.click('.vh-play');
      const a = await scrubT(page); await sleep(900); const c = await scrubT(page);
      ok(c > a, `WebKit player: plays (t ${a.toFixed(3)} → ${c.toFixed(3)})`);
      await page.click('.vh-play'); await sleep(200);
      const p1 = await scrubT(page); await sleep(500); const p2 = await scrubT(page);
      ok(Math.abs(p2 - p1) < 1e-6, 'WebKit player: pauses and holds');
      await shot(page, 'webkit-player');
      ok(errors.length === 0, `WebKit player: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
    {
      const { page, errors, close } = await open({ width: 1440, height: 900 }, false, wk, b);
      await page.goto(srv.url('room-creator.html?house=aurora'));
      await page.waitForFunction(() => document.documentElement.dataset.houseReady === 'aurora', null, { timeout: 120000 });
      await sleep(500);
      ok(await page.isVisible('.creator-topbar') && await page.evaluate(() => typeof (window as any).__houseRenderFrames === 'function'), 'WebKit editor: builds a home, chrome and hooks are there');
      const enc = await page.evaluate(() => typeof (window as any).VideoEncoder);
      console.log(`  (WebCodecs VideoEncoder in this WebKit: ${enc})`);
      await shot(page, 'webkit-editor');
      ok(errors.length === 0, `WebKit editor: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
  } finally { await b.close(); }
}

try {
  await gallery({ width: 1440, height: 900 }, false, '1440');
  await gallery({ width: 390, height: 844 }, true, '390');
  await pages();
  await previews();
  await caching();
  for (const [i, id] of HOUSES.entries()) await player(id, { width: 1440, height: 900 }, false, '1440', i === 0);
  await player(HOUSES[0], { width: 390, height: 844 }, true, '390', false);
  await motion(HOUSES[0]);
  await failureCases();
  await editor();
  await webkit();
} catch (err) {
  failures++;
  console.error(`\n\x1b[31m${(err as Error).stack || err}\x1b[0m`);
} finally {
  await browser.close();
  await srv.close();
}
console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed · screenshots in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
process.exit(failures ? 1 : 0);
