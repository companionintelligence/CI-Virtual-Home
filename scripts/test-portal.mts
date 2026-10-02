#!/usr/bin/env -S node --experimental-strip-types
// End-to-end check of the built site, served under a sub-path (dist/ at /ci-virtual-home/), where a root-relative URL fails.
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` after portal work
//
//   pnpm run build && pnpm run portal:build [--allow-partial] && pnpm run portal:test [--dir dist] [--base /ci-virtual-home/]
//        [--family slug,slug,slug] [--shots test/portal] [--only static,gallery,pages,previews,caching,player,motion,failures,editor,webkit,hooks] [--headed] [--webkit]
//
//   static    (no browser) T1 the leak scan: no home name, builder, Sims reference or internal id in any file or file name;
//             T2 the slugs and routes (unique, the pattern, every family page, the sitemap, the 301 lines); T3 the copy lint;
//             T4 every app is in the Companion Hub catalog; T9 the landing's weight (JS + CSS + HTML + JSON against the budget
//             and the ceiling; no audio, video, three.js or engine module before an interaction); T10 the offline renderers
//             are untouched (assets/*.ts differs from origin/main only in viewer.ts and new site or story files)
//   gallery   the family cards (title, address, a hashed 640 × 360 thumbnail, the avatars and app chips, the tour link), the
//             household facet and the ten topic chips with live counts, the search, the filters in the URL, hovering warms the
//             player, a card opens its family page and the tour; the phone's filter sheet; 1440 × 900 and 390 × 844
//   pages     a family page reads without JavaScript (its transcript is every beat); an in-repo accessibility audit of the
//             landing and a family page at both sizes (names, landmarks, headings, contrast); the link previews
//   player    for each --family: builds, opens on the Orbit, lists its shots, plays, pauses, scrubs, switches shot and hour,
//             shows the path, flies, ends a shot on the end card, copies a share link to the family page that reopens at the
//             same moment, and steps to the next family; the page names the family and shows the disclosure; 1440 and 390
//   motion    with the system set to reduce motion, a family opened from the landing holds still
//   failures  an address no family has: the error card at once, no spec request, nothing echoed; old ?house= links land on
//             ?family= and never show the id; a module that does not download, and WebGL 1 only: a card, not a loader
//   caching   the headers (revalidate everything, keep the hashed folders), every hashed file name, the import maps
//   editor    in dist/ the editor page sends a visitor to the landing; from a checkout it is still the editor
//   webkit    Safari's engine, when Playwright's WebKit for the pinned version is installed (required with --webkit)
//   hooks     every scripts/story/portal-tests/*.mts (the tour, the voice and the films add theirs there)
//
// Any console error, page error or failed request on any page fails the run (the failure cases allow exactly the ones they
// cause). The page makes no third-party request and sets no cookie. Screenshots land in --shots (gitignored test/portal/) so
// a person can look at what passed. Exit 0 only when everything did.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from './portal-lib.mts';
import { leakScan, walkFiles, needles, scanText } from './story/check-leaks.mts';
import { copyLint } from './story/check-copy.mts';
import { TEST_GLOB } from './story/hooks.ts';
import type { TestCtx } from './story/hooks.ts';
import { storyFiles, readJson, legacyKey, HOUSEHOLD_LABEL, TOPIC_LABEL, TOPICS, slugProblem } from './story/site-lib.mts';
import { FICTIONAL_LINE, BETA_LINE } from '../assets/story/types.ts';

const args = parseArgs(process.argv.slice(2));
const DIR = path.resolve(args.dir || path.join(ROOT, 'dist'));
const BASE = args.base || '/ci-virtual-home/';
const SHOTS = path.resolve(args.shots || path.join(ROOT, 'test', 'portal'));
if (!fs.existsSync(path.join(DIR, 'index.html'))) { console.error(`no portal in ${DIR}: pnpm run portal:build`); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });

// what the build wrote: the manifest, the card data, the casting (for the legacy-link test; the ids stay in this process)
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'story', 'manifest.json'), 'utf8'));
const CARDS: any[] = JSON.parse(fs.readFileSync(path.join(DIR, manifest.families), 'utf8')).families;
const casting: Record<string, any> = Object.fromEntries(readJson(path.join(ROOT, 'content', 'story', 'casting.json')).families.map((f: any) => [f.slug, f]));
const SLUGS: string[] = (args.family && args.family !== 'true' ? args.family.split(',') : CARDS.slice(0, 3).map(c => c.slug)).filter(Boolean);
const FAMILIES_DIR = args.families && args.families !== 'true' ? path.resolve(args.families) : (storyFiles(path.join(ROOT, 'content', 'families')).length ? path.join(ROOT, 'content', 'families') : path.join(ROOT, 'test', 'fixtures', 'site', 'families'));
const titleOf = (slug: string): string => CARDS.find(c => c.slug === slug).title;
const cardOf = (slug: string): any => CARDS.find(c => c.slug === slug);

const srv = await serve(DIR, BASE);
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const sleep = (ms: number): Promise<void> => new Promise<void>(r => setTimeout(r, ms));

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
// T1, the dynamic half: what the page looks like once it has run (the DOM, the tab, the attributes, the meta tags)
const LEAK_NEEDLES = needles();
const dynamicLeaks = async (page: any, where: string, code = false): Promise<void> => {
  const text: string = await page.evaluate(() => `${document.title}\n${document.documentElement.outerHTML}`);
  const found = scanText(text, where, LEAK_NEEDLES, { code });
  ok(found.length === 0, `T1 ${where}: nothing in the running page names a home, a builder or an id${found.length ? ': ' + found.slice(0, 3).join(' | ') : ''}`);
};
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

// ------------------------------------------------------------------ static: T1 to T4, T9, T10 (no browser)
function staticChecks() {
  console.log('\nstatic');
  const found = leakScan(DIR);
  ok(found.length === 0, `T1 leak scan: nothing in ${walkFiles(DIR).length} files names a home, a builder, a Sims build or an internal id${found.length ? ': ' + found.slice(0, 6).join(' | ') : ''}`);
  const slugs = CARDS.map(c => c.slug);
  const badSlugs = slugs.map(slugProblem).filter(Boolean);
  ok(new Set(slugs).size === slugs.length && badSlugs.length === 0, `T2 ${slugs.length} slugs: unique, the pattern, none with a creator in it${badSlugs.length ? ' (' + badSlugs[0] + ')' : ''}`);
  const pagesMissing = slugs.filter(s => !fs.existsSync(path.join(DIR, 'family', `${s}.html`)));
  ok(pagesMissing.length === 0, `T2 every family has a page (family/<slug>.html)${pagesMissing.length ? ': missing ' + pagesMissing.join(', ') : ''}`);
  const sitemap = fs.readFileSync(path.join(DIR, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(locs.length === slugs.length + 2 && slugs.every(s => locs.some(l => l.endsWith(`/family/${s}`))) && locs.some(l => l.endsWith('/credits.html')), `T2 the sitemap lists ${locs.length} URLs (the landing, ${slugs.length} families, the credits)`);
  ok(/Sitemap:|Disallow: \//.test(fs.readFileSync(path.join(DIR, 'robots.txt'), 'utf8')), 'T2 robots.txt names the sitemap (or, on a preview, keeps crawlers out)');
  const redirects = fs.readFileSync(path.join(DIR, '_redirects'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  ok(redirects.length === slugs.length * 2 && redirects.every(l => /^\/homes\/[a-z0-9-]+(\.html)? \/family\/[a-z-]+ 301$/.test(l)), `T2 ${redirects.length} 301 lines send the old share pages to the family pages`);
  const legacy = JSON.parse(fs.readFileSync(path.join(DIR, manifest.legacy), 'utf8'));
  ok(slugs.every(s => legacy[legacyKey(casting[s].house)] === s) && Object.keys(legacy).every(k => /^[0-9a-f]{12}$/.test(k)), 'T2 the old ?house= links map to slugs by the first 12 hex of a SHA-256, never by the id');
  const fam = copyLint({ dir: DIR, families: FAMILIES_DIR });
  ok(fam.length === 0, `T3/T4 copy lint and apps: the pages, the card data and every app are clean${fam.length ? ': ' + fam.slice(0, 5).join(' | ') : ''}`);

  // T9: the landing's first load, as the files say it (the browser measures the same in gallery())
  const index = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const sizeOf = (u: string): number => { try { return fs.statSync(path.join(DIR, u.split('?')[0].replace(/^\.\//, ''))).size; } catch { return 0; } };
  const css = [...index.matchAll(/href="(\.\/portal\/[^"]+\.css[^"]*)"/g)].map(m => sizeOf(m[1]));
  const js = [...index.matchAll(/src="(\.\/portal\/[^"]+\.js[^"]*)"/g)].map(m => sizeOf(m[1]));
  const data = sizeOf(manifest.families);
  const total = Buffer.byteLength(index) + css.reduce((a, b) => a + b, 0) + js.reduce((a, b) => a + b, 0) + data;
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  ok(total <= 400 * 1024, `T9 the landing's JS, CSS, HTML and card data are ${kb(total)} raw (HTML ${kb(Buffer.byteLength(index))}, CSS ${kb(css.reduce((a, b) => a + b, 0))}, JS ${kb(js.reduce((a, b) => a + b, 0))}, data ${kb(data)}; the ceiling is 400 KB, the plan's target 103 KB at thirty families)`);
  const fp = sizeOf(`family/${slugs[0]}.html`);
  ok(fs.statSync(path.join(DIR, 'family', `${slugs[0]}.html`)).size <= 60 * 1024, `T9 a family page is ${kb(fp)} of HTML`);

  // T10: the offline renderers are untouched
  try {
    const diff = execFileSync('git', ['diff', '--name-status', 'origin/main', '--', 'assets'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
    const bad = diff.filter(l => { const [st, f] = l.split('\t'); return !(f === 'assets/viewer.ts' || (st === 'A' && /^assets\/(site|story)\//.test(f)) || /^assets\/(site|story)\//.test(f)); });
    ok(bad.length === 0, `T10 the engine is as it was: assets/ differs from origin/main only in viewer.ts and the site and story files${bad.length ? ' (also: ' + bad.join(', ') + ')' : ''}`);
  } catch { console.log('  skipped T10: git has no origin/main here'); }
}

// ------------------------------------------------------------------ an accessibility audit, in the page (axe-core is MPL-2.0, which the repo's licence rule does not take)
// Names, landmarks, headings, labels, ids and the contrast of every visible piece of text against what is behind it.
const AUDIT = () => {
  const out: string[] = [];
  const issue = (m: string) => { if (out.length < 12) out.push(m); };
  const cv = document.createElement('canvas').getContext('2d')!;
  const rgba = (c: string): [number, number, number, number] => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top: number[], under: number[]) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const backdrop = (el: Element): number[] => {
    const stack: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bg = rgba(cs.backgroundColor);
      if (bg[3] > 0) stack.push(bg);
      if (bg[3] >= 1) break;
      if (e === document.documentElement) break;
    }
    let acc: number[] = rgba(getComputedStyle(document.body).backgroundColor);
    if (acc[3] < 1) acc = [255, 255, 255, 1];
    for (const l of stack.reverse()) acc = over(l, acc);
    return acc;
  };
  if (!document.documentElement.lang) issue('no lang on <html>');
  if (document.querySelectorAll('main').length !== 1) issue('not exactly one <main>');
  if (document.querySelectorAll('h1').length !== 1) issue(`${document.querySelectorAll('h1').length} h1s`);
  for (const sel of ['header', 'footer', 'nav']) if (!document.querySelector(sel)) issue(`no <${sel}>`);
  let last = 0;
  for (const h of Array.from(document.querySelectorAll('h1,h2,h3,h4'))) { const l = Number(h.tagName[1]); if (last && l > last + 1) issue(`heading jumps from h${last} to h${l}: ${(h.textContent || '').trim().slice(0, 30)}`); last = l; }
  const ids = new Map<string, number>(); for (const e of Array.from(document.querySelectorAll('[id]'))) ids.set(e.id, (ids.get(e.id) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) issue(`the id ${id} is used ${n} times`);
  for (const i of Array.from(document.querySelectorAll('img'))) if (!i.hasAttribute('alt')) issue(`an image without alt: ${i.getAttribute('src')}`);
  const visible = (e: Element) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const e of Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role="radio"]'))) {
    if (!visible(e)) continue;
    const name = (e.getAttribute('aria-label') || '').trim() || (e.textContent || '').trim() || (e as HTMLInputElement).placeholder || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || (e.closest('label')?.textContent || '').trim() || (e.querySelector('img[alt]')?.getAttribute('alt') || '');
    if (!String(name).trim()) issue(`${e.tagName.toLowerCase()} without a name: ${(e.outerHTML || '').slice(0, 80)}`);
  }
  // contrast: every text node with visible ink
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !(n.textContent || '').trim()) continue;
    seen.add(el);
    if (!visible(el) || el.closest('.sr,script,style,svg,[hidden],[inert]')) continue;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none' || (el.closest('.hero-badge,.poster-badge,.hero-play,.poster-play'))) continue;   // text on a picture sits on its own scrim; the og images and the badges are checked by eye
    const fg = rgba(cs.color), bg = backdrop(el);
    const f = over(fg, bg);
    const l1 = lum(f[0], f[1], f[2]), l2 = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need && Number(cs.opacity) >= 1) issue(`contrast ${ratio.toFixed(2)} (needs ${need}) for "${(n.textContent || '').trim().slice(0, 36)}" in <${el.tagName.toLowerCase()} class="${el.className}">`);
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) issue(`the page scrolls sideways (${document.documentElement.scrollWidth} px in ${window.innerWidth})`);
  return out;
};

// ------------------------------------------------------------------ gallery
async function gallery(viewport: { width: number; height: number }, mobile: boolean, label: string) {
  console.log(`\ngallery ${label}`);
  const { page, errors, thirdParty, requests, close } = await open(viewport, mobile);
  const sizes: { url: string; type: string; n: number }[] = [];
  page.on('response', async (r: any) => { try { sizes.push({ url: r.url(), type: r.headers()['content-type'] || '', n: (await r.body()).length }); } catch { /* a redirect has no body */ } });
  const staticHtml = await (await fetch(srv.url('index.html'))).text();
  const staticStats = ['families', 'people', 'stories'].map(k => (staticHtml.match(new RegExp(`data-stat="${k}">([^<]*)<`)) || [])[1]);
  await page.goto(srv.url('index.html'));
  await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
  await dynamicLeaks(page, 'the landing');
  const first = requests.map((u: string) => u.replace(srv.origin, ''));
  const noEngine = !first.some((u: string) => /three\.module|\/assets\/(house-builder|viewer)|\.m4a|\.mp4|\/audio\/|\/film\/|story\/[a-z-]+\.[0-9a-f]{10}\.json/.test(u) && !/story\/(families|legacy)\./.test(u));
  ok(noEngine, 'T9 before an interaction the landing loads no audio, no video, no three.js, no engine module and no story');
  await sleep(300);
  const jsCssHtml = sizes.filter(s => /text\/html|javascript|text\/css|json/.test(s.type) && s.url.startsWith(srv.origin)).reduce((a, s) => a + s.n, 0);
  ok(jsCssHtml <= 400 * 1024, `T9 the landing's first load is ${(jsCssHtml / 1024).toFixed(1)} KB of HTML, JS, CSS and JSON (ceiling 400 KB; the plan's target 103 KB)`);
  const imgBytes = sizes.filter(s => /^image\//.test(s.type)).reduce((a, s) => a + s.n, 0);
  console.log(`  (images on the first screen: ${(imgBytes / 1024).toFixed(0)} KB; plan: 900 KB with everything)`);

  const total = CARDS.length;
  const cards = await page.$$eval('#grid .card', (els: Element[]) => els.length);
  ok(cards === total, `${cards} family cards`);
  const liveStats = await page.$$eval('[data-stat]', (els: Element[]) => els.map(e => e.textContent));
  ok(JSON.stringify(liveStats) === JSON.stringify(staticStats), `the static hero figures are the data's (${staticStats.join(' / ')})`);
  const titles: string[] = await page.$$eval('#grid .card h3', (els: Element[]) => els.map(e => e.textContent || ''));
  const n = needles();
  ok(titles.length === total && new Set(titles).size === total && titles.every(t => /^The .+ family$/.test(t)) && !titles.some(t => n.names.some(x => t.toLowerCase().includes(x.toLowerCase()))), `card titles are "The <Surname> family", all distinct, none a home's name (${titles.slice(0, 3).join(', ')}, …)`);
  const households: string[] = await page.$$eval('#household [data-household]', (els: Element[]) => els.map(e => (e.firstChild!.textContent || '').trim()));
  ok(households.join('|') === ['Any', ...Object.values(HOUSEHOLD_LABEL)].join('|'), `the household facet reads ${households.join(' · ')}`);
  const topics: string[] = await page.$$eval('#topics [data-topic]', (els: Element[]) => els.map(e => (e.firstChild!.textContent || '').trim()));
  ok(topics.join('|') === TOPICS.map(t => TOPIC_LABEL[t]).join('|'), `the ten topic chips read ${topics.join(' · ')}`);
  ok(!(await page.$('#builds')) && (await page.textContent('body'))!.includes(FICTIONAL_LINE) && (await page.textContent('body'))!.includes(BETA_LINE), 'no builds list; the fictional-family and the beta lines are on the page');
  const hrefs: { slug: string; title: string; tour: string }[] = await page.$$eval('#grid .card', (els: Element[]) => els.map(e => ({ slug: (e as HTMLElement).dataset.slug!, title: e.querySelector('h3 a')!.getAttribute('href')!, tour: e.querySelector('a.tour')!.getAttribute('href')! })));
  ok(hrefs.every(h => h.title === `./family/${h.slug}` && !/house=|homes\/|content\/houses/.test(h.title + h.tour) && h.tour === `./room-creator.html?mode=view&family=${h.slug}` && !h.tour.includes('play=')), `${hrefs.length} title links and ${hrefs.length} tour links go to family/<slug> and the player by slug (no house=, no autoplay)`);
  await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('#grid img')).every(i => i.complete), null, { timeout: 20000 });
  const decoded = await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.filter(i => i.naturalWidth === 640 && i.naturalHeight === 360 && /\.[0-9a-f]{10}\.webp$/.test(i.currentSrc)).length);
  ok(decoded === total, `${decoded} of ${total} thumbnails decoded at 640 × 360 under hashed names`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await shot(page, `landing-${label}`);
  await page.evaluate(() => document.getElementById('families')!.scrollIntoView());
  await sleep(400);
  await shot(page, `landing-${label}-families`);
  const visible = () => page.$$eval('#grid .card', (els: HTMLElement[]) => els.filter(e => !e.hidden).length);
  if (!mobile) {
    // a pointer over a card warms three.js, the engine (by the hash the player will use) and that family's spec, never room-creator.html
    const before = requests.length;
    await page.hover('#grid .card:nth-child(2) h3 a');
    await sleep(1800);
    const warmed: string[] = requests.slice(before).map((u: string) => u.replace(srv.origin, ''));
    const slug2 = hrefs[1].slug;
    const viewerUrl = await page.evaluate(() => JSON.parse(document.querySelector('script[type="importmap"]')!.textContent!).imports['./assets/viewer.js']);
    ok(warmed.some(u => u.includes('assets/vendor/three/three.module.min.js')) && warmed.some(u => u.endsWith(viewerUrl.replace(/^\./, ''))) && warmed.some(u => u.includes(`content/homes/${slug2}.`)) && !warmed.some(u => u.includes('room-creator')), `hovering a card warms ${warmed.length} files (the engine by its hash, that family's spec), not the page`);
    ok(await page.$$eval('link[rel="prefetch"]', (ls: Element[]) => ls.length) === 0, 'and with plain fetches: no <link rel="prefetch"> (the live zone refuses those with a 503)');
  }

  // search: a name only one family has
  const probe = cardOf(hrefs[0].slug).members[0].name;
  const sharers = CARDS.filter(c => `${c.title} ${c.address} ${c.tagline} ${c.members.map((m: any) => m.name + ' ' + (m.companion || '')).join(' ')} ${c.apps.map((a: any) => a.name).join(' ')} ${(c.rooms || []).join(' ')}`.toLowerCase().includes(probe.toLowerCase())).length;
  await page.fill('#q', probe);
  await sleep(250);
  const found = await visible();
  ok(found === sharers && found >= 1 && (total < 3 || found < total), `search "${probe}" narrows to ${found} (the data says ${sharers})`);
  ok((await page.evaluate(() => location.search)).includes('q='), 'the search is in the URL');
  await page.fill('#q', '');
  await sleep(250);
  // the facets: the household chosen, the topic counts follow it
  const hh = cardOf(hrefs[0].slug).household;
  const expectCount = (t: string, household: string): number => CARDS.filter(c => c.topics.includes(t) && (!household || c.household === household)).length;
  const topicCounts = async (): Promise<Record<string, number>> => Object.fromEntries(await page.$$eval('#topics [data-topic]', (els: HTMLElement[]) => els.map(e => [e.dataset.topic, Number(e.querySelector('small')!.textContent)])));
  const all = await topicCounts();
  ok(TOPICS.every(t => all[t] === expectCount(t, '')), `the topic chips count the families (${TOPICS.map(t => all[t]).join(', ')})`);
  if (mobile) { await page.tap('#filters-open'); await sleep(300); }
  await page.click(`#household [data-household="${hh}"]`);
  await sleep(150);
  const some = await topicCounts();
  ok(TOPICS.every(t => some[t] === expectCount(t, hh)) && (await page.evaluate(() => location.search)).includes(`household=${hh}`), `choosing "${HOUSEHOLD_LABEL[hh as keyof typeof HOUSEHOLD_LABEL]}" re-counts the topics and writes household= to the URL`);
  if (mobile) { await page.tap('#sheet-done'); await sleep(300); }
  ok((await visible()) === CARDS.filter(c => c.household === hh).length, `and shows ${CARDS.filter(c => c.household === hh).length} of them`);
  if (mobile) { await page.tap('#filters-open'); await sleep(300); }
  const tchip = TOPICS.find(t => expectCount(t, hh) > 0 && expectCount(t, hh) < CARDS.filter(c => c.household === hh).length) || TOPICS.find(t => expectCount(t, hh) > 0)!;
  await page.click(`#topics [data-topic="${tchip}"]`);
  await sleep(150);
  ok((await page.getAttribute(`#topics [data-topic="${tchip}"]`, 'aria-pressed')) === 'true' && (await page.evaluate(() => location.search)).includes(`topic=${tchip}`), `a topic chip presses and writes topic= to the URL (${tchip})`);
  if (mobile) { await page.tap('#sheet-clear'); await sleep(200); await page.tap('#sheet-done'); await sleep(300); ok(await page.evaluate(() => document.activeElement?.id === 'filters-open'), 'the sheet closes and focus returns to the Filters button'); }
  else { await page.click('#clear-top'); }
  await sleep(150);
  ok((await visible()) === total, `clearing the filters shows all ${total}`);
  await page.fill('#q', 'zzzz-no-such-family');
  await sleep(250);
  ok(await page.isVisible('#empty'), 'no match shows the empty state');
  await page.click('#clear');
  ok((await visible()) === total, 'its Clear shows them all again');
  if (!mobile) {
    await page.keyboard.press('/');
    ok(await page.evaluate(() => document.activeElement?.id === 'q'), '/ focuses the search');
    await page.keyboard.press('Escape');
  }
  // a card opens the family's page, and the page the tour
  await page.click('#grid .card:nth-child(2) h3 a');
  await page.waitForURL(new RegExp(`/family/${hrefs[1].slug}$`), { timeout: 15000 });
  await dynamicLeaks(page, 'a family page');
  ok((await page.textContent('h1')) === titleOf(hrefs[1].slug) && (await page.title()) === `${titleOf(hrefs[1].slug)} · Companion Core`, `a card opens ${titleOf(hrefs[1].slug)}'s page, titled "${await page.title()}"`);
  await page.click('.stage-actions a.btn-primary');
  await page.waitForURL(/room-creator\.html\?mode=view&family=/, { waitUntil: 'commit', timeout: 30000 });
  await viewerReady(page);
  ok(true, `and "Take the tour" opens the player (family=${new URL(page.url()).searchParams.get('family')})`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  ok(thirdParty.length === 0, `the landing, a family page and the player ask no third party for anything${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
  ok((await page.context().cookies()).length === 0, 'and set no cookie');
  await close();
}

// ------------------------------------------------------------------ the pages: no JavaScript needed, accessible, link previews
async function pages() {
  console.log('\npages');
  const slug = SLUGS[0];
  {
    // a family page reads with JavaScript off: its transcript is every beat of the tour
    const { page, close } = await open({ width: 1440, height: 900 }, false, { javaScriptEnabled: false });
    await page.goto(srv.url(`family/${slug}`));
    const beats = await page.$$eval('li.beat', (els: Element[]) => els.length);
    ok(beats === cardOf(slug).beats && (await page.textContent('h1')) === titleOf(slug), `without JavaScript the page reads: ${beats} beats in the transcript under "${titleOf(slug)}"`);
    ok(await page.isVisible('a.poster') && await page.isVisible(`a.btn-primary[href$="family=${slug}"]`), 'and the poster and "Take the tour" are there');
    await close();
  }
  for (const [vp, mobile, label] of [[{ width: 1440, height: 900 }, false, '1440'], [{ width: 390, height: 844 }, true, '390']] as const) {
    for (const target of ['index.html', `family/${slug}`, 'credits.html']) {
      const { page, errors, close } = await open(vp, mobile);
      await page.goto(srv.url(target));
      if (target === 'index.html') await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
      await sleep(400);
      const issues: string[] = await page.evaluate(AUDIT);
      ok(issues.length === 0, `accessibility audit of ${target === 'index.html' ? 'the landing' : target.startsWith('family') ? 'a family page' : 'the credits'} at ${label}${issues.length ? ': ' + issues.join(' | ') : ''}`);
      if (target === `family/${slug}`) await shot(page, `family-${label}`);
      if (target === 'index.html' && mobile) { await page.tap('.menu-btn'); await sleep(200); ok(await page.isVisible('#site-nav') && (await page.getAttribute('.menu-btn', 'aria-expanded')) === 'true', 'the phone menu opens'); await page.keyboard.press('Escape'); ok(!(await page.isVisible('#site-nav')), 'and Esc closes it'); }
      ok(errors.length === 0, `no console errors on ${target}${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
  }
  // the same pages in the dark scheme (the canon has two themes; a colour that only works in one is a bug)
  for (const target of ['index.html', `family/${slug}`]) {
    const { page, close } = await open({ width: 1440, height: 900 }, false, { colorScheme: 'dark' });
    await page.goto(srv.url(target));
    if (target === 'index.html') await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
    await sleep(400);
    const issues: string[] = await page.evaluate(AUDIT);
    ok(issues.length === 0, `accessibility audit of ${target === 'index.html' ? 'the landing' : 'a family page'}, dark scheme${issues.length ? ': ' + issues.join(' | ') : ''}`);
    await shot(page, `${target === 'index.html' ? 'landing' : 'family'}-dark`);
    await close();
  }
}

// ------------------------------------------------------------------ link previews of the built pages
async function previews() {
  console.log('\nlink previews');
  const head = (html: string) => html.slice(0, html.indexOf('</head>'));
  const tag = (h: string, p: string, attr = 'property') => (h.match(new RegExp(`<meta ${attr}="${p}" content="([^"]*)"`)) || [])[1] || '';
  const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const imageOk = async (abs: string): Promise<boolean> => {
    // the absolute address is the site's own (https://homes.ci.computer/...): fetch the same path from the served build
    const rel = new URL(abs).pathname.replace(/^\//, '');
    const res = await fetch(srv.url(rel)); const b = new Uint8Array(await res.arrayBuffer());
    return res.ok && b[0] === 0xff && b[1] === 0xd8;
  };
  const landing = head(await (await fetch(srv.url('index.html'))).text());
  const player = head(await (await fetch(srv.url('room-creator.html'))).text());
  ok(/^https?:\/\//.test(tag(landing, 'og:image')) && /portal\/og\/home[.-][^/]*\.jpg$/.test(tag(landing, 'og:image')) && tag(landing, 'og:image:width') === '1200' && tag(landing, 'og:image:height') === '630' && await imageOk(tag(landing, 'og:image')), `the landing previews with its 1200 × 630 JPEG (${tag(landing, 'og:image').replace(/^.*\/portal/, 'portal')})`);
  ok(tag(landing, 'og:title') === 'Uncloud your life with Companion Core home servers' && /summary_large_image/.test(landing) && /rel="canonical"/.test(landing) && (tag(landing, 'description', 'name').length <= 160), 'its title is the owner\'s, its description fits, it has a canonical and a large-image card');
  const ld = [...landing.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  ok(ld.some(x => x['@type'] === 'CollectionPage' && x.mainEntity.itemListElement.length === CARDS.length) && !JSON.stringify(ld).match(/Person|Review|Testimonial/), `its JSON-LD lists ${CARDS.length} family pages and has no Person, Review or Testimonial`);
  ok(tag(player, 'og:image') === tag(landing, 'og:image') && tag(player, 'og:site_name') === tag(landing, 'og:site_name') && /name="robots" content="noindex/.test(player), 'the player previews with the landing\'s image and site name, and says noindex');
  const noInline = player.replace(/<script>[\s\S]*?<\/script>/g, '');
  const staticHead = noInline.slice(0, noInline.indexOf('<script'));
  ok(!/Room Creator|Sims|Pascal|Virtual homes/.test(staticHead) && /<title>Uncloud your life/.test(staticHead), `room-creator.html's static head is the site's, not the editor's (${(staticHead.match(/<title>([^<]*)/) || [])[1]})`);
  const titlesSeen = new Set<string>();
  for (const c of CARDS) {
    const html = await (await fetch(srv.url(`family/${c.slug}`))).text();
    const h = head(html);
    const h1 = unesc((html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || '');
    const title = unesc((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    titlesSeen.add(title);
    const good = h1 === c.title && unesc(tag(h, 'og:title')) === h1 && title === `${h1} · Companion Core` && new URL(tag(h, 'og:url')).pathname.endsWith(`/family/${c.slug}`) && tag(h, 'og:url') === (h.match(/rel="canonical" href="([^"]*)"/) || [])[1]
      && unesc(tag(h, 'description', 'name')).includes(FICTIONAL_LINE) && unesc(tag(h, 'og:description')).includes(FICTIONAL_LINE) && /\.(jpg)$/.test(tag(h, 'og:image')) && await imageOk(tag(h, 'og:image'))
      && unesc(tag(h, 'og:image:alt')).includes(FICTIONAL_LINE);
    let ldOk = false; try { const j = JSON.parse((h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]); ldOk = j['@type'] === 'WebPage' && !/Person|Review/.test(JSON.stringify(j)); } catch { /* reported */ }
    if (!good || !ldOk) ok(false, `${c.slug}: head tags are wrong (h1 "${h1}", title "${title}", og:title "${tag(h, 'og:title')}", json-ld ${ldOk})`);
  }
  ok(titlesSeen.size === CARDS.length, `${CARDS.length} family pages have ${titlesSeen.size} distinct titles, each its H1 + " · Companion Core", with a canonical, a disclosure in the description and a JPEG preview`);
}

// ------------------------------------------------------------------ caching of the built site
// The engine's modules are not fingerprinted by file name, and a browser (or the custom domain's zone, which rewrote
// Cache-Control to four hours whatever the origin said) can keep an old copy of one while the page that asks for it is new:
// the player then stops with "This home could not be opened". Two things keep that from happening: portal/_headers asks for
// revalidation, and the pages name every module by a hash of its content, so an old copy is never the one asked for. The files
// whose NAME carries a hash are the opposite case: they never change, and may be kept for a year.
async function caching() {
  console.log('\ncaching');
  const file = path.join(DIR, '_headers');
  ok(fs.existsSync(file), 'dist/_headers is there (Cloudflare Pages reads it from the site root)');
  if (fs.existsSync(file)) {
    const blocks: { rule: string; lines: string[] }[] = [];
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) { if (!l.trim() || l.trim().startsWith('#')) continue; if (!/^\s/.test(l)) blocks.push({ rule: l.trim(), lines: [] }); else blocks[blocks.length - 1]?.lines.push(l.trim()); }
    const cc = (b: { lines: string[] }) => (b.lines.find(x => /^cache-control\s*:/i.test(x)) || '').split(':').slice(1).join(':').trim();
    const all = blocks.find(b => b.rule === '/*');
    ok(!!all && /(^|[ ,])max-age=0([ ,]|$)/.test(cc(all)) && /must-revalidate/.test(cc(all)), `everything is revalidated by default (/*: ${all ? cc(all) : 'no rule'})`);
    const HASHED = ['/audio/*', '/film/*', '/portal/thumbs/*', '/portal/posters/*', '/portal/og/*', '/portal/fonts/*', '/content/homes/*', '/story/families.*', '/story/legacy.*'];
    const extra = blocks.filter(b => b.rule !== '/*');
    ok(extra.every(b => HASHED.includes(b.rule) && /immutable/.test(cc(b)) && /max-age=31536000/.test(cc(b)) && b.lines.includes('! Cache-Control')), `the only other rules are immutable ones for the hashed folders (${extra.map(b => b.rule).join(' ')})`);
    ok(!extra.some(b => /manifest|\.js|\.css|\.html/.test(b.rule)), 'story/manifest.json, the pages, the scripts and the styles are never in one');
  }
  // every file in a hashed folder carries a 10-hex hash
  const unhashed: string[] = [];
  for (const dir of ['audio', 'film', 'portal/thumbs', 'portal/posters', 'portal/og', 'portal/fonts', 'content/homes', 'story']) {
    if (!fs.existsSync(path.join(DIR, dir))) continue;
    for (const f of walkFiles(DIR, dir)) if (!/\.[0-9a-f]{10}\.[a-z0-9]+$/.test(f) && !/(^|\/)manifest\.json$/.test(f) && !/LICENSE/.test(f)) unhashed.push(f);
  }
  ok(unhashed.length === 0, `every file in audio, film, thumbs, posters, og, fonts, content/homes and story has a content hash in its name${unhashed.length ? ' (without: ' + unhashed.slice(0, 3).join(', ') + ')' : ''}`);
  const hash = (rel: string): string => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, rel))).digest('hex').slice(0, 10);
  const walkDir = (dirRel: string): string[] => fs.readdirSync(path.join(DIR, dirRel)).flatMap(n => { const r = `${dirRel}/${n}`; return fs.statSync(path.join(DIR, r)).isDirectory() ? walkDir(r) : [r]; });
  const modules = walkDir('assets').filter(f => f.endsWith('.js') && !f.startsWith('assets/vendor/'));
  const mapOf = (page: string): Record<string, string> => { try { return JSON.parse((fs.readFileSync(path.join(DIR, page), 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/) || [])[1] || '{}').imports || {}; } catch { return {}; } };
  {
    const map = mapOf('room-creator.html');
    const wrong = modules.filter(m => map[`./${m}`] !== `./${m}?v=${hash(m)}`);
    ok(modules.length > 50 && wrong.length === 0, `room-creator.html: the import map names all ${modules.length} modules by the hash of their content${wrong.length ? ` (wrong: ${wrong.slice(0, 3).join(', ')})` : ''}`);
    ok(map.three && map['three/addons/'], 'room-creator.html: three.js and its addons are still in the import map');
    const warm = mapOf('index.html');
    ok(warm['./assets/viewer.js'] === `./assets/viewer.js?v=${hash('assets/viewer.js')}` && warm['./assets/house-builder.js'] === `./assets/house-builder.js?v=${hash('assets/house-builder.js')}`, 'index.html: its import map names the two modules it warms by their hash');
  }
  for (const page of ['index.html', 'room-creator.html', 'credits.html', `family/${SLUGS[0]}.html`]) {
    const html = fs.readFileSync(path.join(DIR, page), 'utf8');
    const bare = [...html.matchAll(/(?:src|href)="(\.\.?\/(?:assets|portal)\/[^"?#]+\.(?:js|css))"/g)].map(m => m[1]).filter(u => !u.includes('/vendor/'));
    ok(bare.length === 0, `${page}: every script and stylesheet carries a content hash${bare.length ? ` (without: ${bare.slice(0, 3).join(', ')})` : ''}`);
  }
  // in a browser: the player pulls every module by its hash...
  {
    const { page, errors, requests, close } = await open({ width: 1280, height: 800 });
    await page.goto(srv.url(`room-creator.html?mode=view&family=${SLUGS[0]}`));
    await viewerReady(page);
    const asked = requests.filter(u => /\/assets\/.*\.js(\?|$)/.test(u) && !/\/assets\/vendor\//.test(u));
    const bare = asked.filter(u => !/[?&]v=[0-9a-f]{10}$/.test(u));
    ok(asked.length > 50 && bare.length === 0, `the player pulls ${asked.length} modules, each by its hash${bare.length ? ` (without: ${bare.slice(0, 3).join(', ')})` : ''}`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  // ...so whatever an old build left in the browser's cache under the plain URLs is never used
  {
    const { page, errors, close } = await open({ width: 1280, height: 800 });
    let poisoned = 0;
    await page.route((u: URL) => /\/assets\/.*\.js$/.test(u.pathname) && !/\/assets\/vendor\//.test(u.pathname) && !u.searchParams.has('v'), (r: any) => { poisoned++; return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("a stale module was used")' }); });
    await page.goto(srv.url(`room-creator.html?mode=view&family=${SLUGS[0]}`));
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
  await page.goto(srv.url(`room-creator.html?mode=view&family=${id}&play=1`));
  await sleep(250);
  await shot(page, `player-${id}-${label}-loading`);
  await viewerReady(page);
  ok(true, `built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await dynamicLeaks(page, `the tour (${id})`, true);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.creator-topbar')!).display === 'none'), 'editor chrome is hidden');
  const chips = await page.$$eval('.vh-shots .vh-chip', (els: HTMLElement[]) => els.map(e => ({ key: e.dataset.shot, label: e.querySelector('span')!.textContent })));
  const presetShots = await page.evaluate(() => { const s = (window as any).__houseDebug().house.shots; return [...new Set(Object.values(s))].length; });
  ok(chips.length === presetShots && chips.length >= 4, `${chips.length} shots listed from the house's presets (${chips.map((c: any) => c.label).join(', ')})`);
  ok(new URL(page.url()).searchParams.get('shot') === 'orbit' && (await page.getAttribute('.vh-shots .vh-chip[data-shot="orbit"]', 'aria-pressed')) === 'true', 'a link without shot= opens on the Orbit');
  const shownName = ((await page.textContent('.vh-name')) || '').trim();
  ok(shownName === titleOf(id) && (await page.title()) === `${shownName} · Companion Core`, `the player names the family "${shownName}" (tab: ${await page.title()})`);
  ok(((await page.textContent('.vh-meta')) || '').includes(FICTIONAL_LINE) && ((await page.textContent('.vh-meta')) || '').includes(cardOf(id).address.split(',')[0]) || mobile, 'the title bar carries the disclosure (and, off a phone, the address)');
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
  const endCard = await page.isVisible('.vh-end') && await page.isVisible('.vh-end [data-act="next"]') && await page.isVisible('.vh-end a[href^="https://ci.computer"]');
  ok(endCard, `the end of the shot offers ${(await page.$$eval('.vh-end button:not([hidden])', (bs: Element[]) => bs.map(b => (b.textContent || '').trim()))).join(', ')}`);
  await dynamicLeaks(page, `the end card (${id})`, true);
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
    ok(!!u && u.pathname === `${BASE}family/${id}` && u.searchParams.has('t') && u.searchParams.has('shot') && u.searchParams.has('tod'), `share copies ${link.replace(srv.origin, '')}`);
    if (u) {
      const sharePage = await (await fetch(link)).text();
      const name = (await page.textContent('.vh-name'))!.trim();
      const tag = (p: string) => (sharePage.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1] || '';
      const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      ok(unesc(tag('og:title')) === name && /portal\/og\/[a-z-]+[.-][^/]*\.jpg$/.test(tag('og:image')) && tag('og:image:type') === 'image/jpeg' && unesc(tag('og:description')).includes(FICTIONAL_LINE) && !/Room Creator|house=/.test(sharePage), `the share page previews as "${unesc(tag('og:title'))}" with its JPEG preview`);
      const { page: p2, errors: e2, close: c2 } = await open(viewport, mobile);
      await p2.goto(link);
      await viewerReady(p2);
      ok(new URL(p2.url()).pathname === `${BASE}room-creator.html` && new URL(p2.url()).searchParams.get('family') === id && !new URL(p2.url()).searchParams.has('house'), 'the family page forwards to the player, on family=<slug>');
      const t2 = await scrubT(p2);
      ok(Math.abs(t2 - Number(u.searchParams.get('t'))) < 0.002 && (await p2.getAttribute('.vh', 'data-playing')) === '0', `the link opens paused at t = ${t2.toFixed(3)}`);
      ok(e2.length === 0, `no console errors on the shared link${e2.length ? ': ' + e2.join(' | ') : ''}`);
      await c2();
    }
    // next family
    const name0 = await page.textContent('.vh-name');
    await page.click('[data-act="next"]');
    await page.waitForFunction((n: string) => document.documentElement.dataset.viewer === 'ready' && document.querySelector('.vh-name')!.textContent !== n, name0, { timeout: 90000 });
    ok(true, `next family: ${await page.textContent('.vh-name')}`);
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
  await page.click(`#grid .card[data-slug="${id}"] a.tour`);
  await viewerReady(page);
  const a = await scrubT(page); await sleep(900); const b = await scrubT(page);
  ok((await page.getAttribute('.vh', 'data-playing')) === '0' && a === 0 && b === 0, 'a family opened from the landing holds still');
  await page.goto(srv.url(`room-creator.html?mode=view&family=${id}&play=1`));
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
  const slug = SLUGS[0];
  {
    // an address no family has: the error at once, no spec request, nothing built, the address not echoed
    const { page, errors, requests, close } = await open({ width: 1440, height: 900 });
    const t0 = Date.now();
    await page.goto(srv.url('room-creator.html?mode=view&family=zzz-nope'));
    await page.waitForSelector('.vh[data-state="error"] .vh-error:not([hidden])', { timeout: 60000 });
    const msg = await page.textContent('.vh-error-msg');
    await sleep(1200);
    const built = await page.evaluate(() => { const d = (window as any).__houseDebug && (window as any).__houseDebug(); return !!(d && d.house); });
    const specAsked = requests.some(u => u.includes('/content/homes/'));
    const unexpected = errors.filter(e => !/status of 404/.test(e));
    ok(/There is no family at this address/.test(msg || '') && !/zzz-nope/.test(msg || ''), `an unknown family: "${msg}" in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    ok(!built && !specAsked && unexpected.length === 0, `no spec request, nothing built, no stray error${unexpected.length ? ': ' + unexpected.join(' | ') : ''}`);
    ok(!(await page.evaluate(() => document.body.outerHTML)).includes('zzz-nope') && !(await page.title()).includes('zzz'), 'and the address is not echoed in the page or the tab');
    await shot(page, 'failure-unknown-family');
    await close();
  }
  {
    // an old link: ?house=<id> lands on ?family=<slug> and the id never stays in the address bar or on the page
    const id = casting[slug].house;
    const { page, errors, close } = await open({ width: 1440, height: 900 });
    await page.goto(srv.url(`room-creator.html?mode=view&house=${id}&shot=orbit`));
    await page.waitForFunction((s: string) => new URL(location.href).searchParams.get('family') === s, slug, { timeout: 5000 }).catch(async (e: Error) => { console.log(`   (address: ${await page.evaluate(() => location.search)}; errors: ${errors.join(' | ')})`); throw e; });
    await viewerReady(page);
    const u = new URL(page.url());
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    ok(!u.searchParams.has('house') && u.searchParams.get('shot') === 'orbit' && !html.includes(`house=${id}`) && (await page.textContent('.vh-name')) === titleOf(slug), `an old ?house= link lands on ?family=${slug} (the shot kept), shows "${titleOf(slug)}", and the id is nowhere`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
    const bad = await open({ width: 1440, height: 900 });
    await bad.page.goto(srv.url('room-creator.html?mode=view&house=not-a-home-id'));
    await bad.page.waitForSelector('.vh[data-state="error"] .vh-error:not([hidden])', { timeout: 60000 });
    ok(!(await bad.page.textContent('.vh-error-msg'))!.includes('not-a-home-id'), 'an old link to no family shows the error without repeating the id');
    await bad.close();
  }
  for (const file of ['viewer.js', 'house-builder.js']) {
    const { page, close } = await open({ width: 1440, height: 900 });
    await page.route((u: URL) => u.pathname.endsWith(`/assets/${file}`), (r: any) => r.abort());   // (by path: the URL carries a ?v= hash)
    await page.goto(srv.url(`room-creator.html?mode=view&family=${slug}`));
    const card = await page.waitForSelector('.vh-fail', { timeout: 60000 }).catch(() => null);
    const state = await page.evaluate(() => document.documentElement.dataset.viewer);
    ok(!!card && state === 'failed' && (await page.isVisible('.vh-fail a[href="./index.html#families"]')) && (await page.isVisible('.vh-fail button')), `${file} not downloading: a card with Try again and See all families (${state})`);
    ok(!/Room Creator|Sims/.test(await page.title()) && await page.isVisible('.vh-boot-back'), `the tab says "${await page.title()}", and a back arrow shows`);
    await shot(page, `failure-${file.replace('.js', '')}`);
    await close();
  }
  {
    // the family list not downloading: the landing says so, with a way to try again, and the retry works
    const { page, close } = await open({ width: 1440, height: 900 });
    let block = true;
    await page.route((u: URL) => /\/story\/families\./.test(u.pathname), (r: any) => (block ? r.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }) : r.continue()));
    await page.goto(srv.url('index.html'));
    await page.waitForFunction(() => document.documentElement.dataset.gallery === 'failed', null, { timeout: 20000 });
    ok(await page.isVisible('#failed') && !(await page.isVisible('#grid')), 'the family list not downloading: the landing says so, with a way to try again');
    block = false;
    await page.click('#retry');
    await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
    ok((await page.$$eval('#grid .card', (e: Element[]) => e.length)) === CARDS.length, '… and Try again brings the families');
    await close();
  }
  {
    // the manifest not downloading: the player's card, not a loader
    const { page, close } = await open({ width: 1440, height: 900 });
    await page.route((u: URL) => u.pathname.endsWith('/story/manifest.json'), (r: any) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
    await page.goto(srv.url(`room-creator.html?mode=view&family=${slug}`));
    await page.waitForSelector('.vh[data-state="error"] .vh-error:not([hidden])', { timeout: 60000 });
    ok(true, `story/manifest.json not downloading: "${await page.textContent('.vh-error-msg')}"`);
    await close();
  }
  {
    // three.js r169 needs WebGL 2; a browser with WebGL 1 only must be told so, not left on the loader
    const b1 = await pw.chromium.launch({ headless: args.headed !== 'true', args: [...LAUNCH_ARGS, '--disable-webgl2'] });
    const { page, close } = await open({ width: 1440, height: 900 }, false, {}, b1);
    await page.goto(srv.url(`room-creator.html?mode=view&family=${slug}`));
    const card = await page.waitForSelector('.vh-fail', { timeout: 30000 }).catch(() => null);
    const [gl1, gl2, state] = await page.evaluate(() => { const c = () => document.createElement('canvas'); return [!!c().getContext('webgl'), !!c().getContext('webgl2'), document.documentElement.dataset.viewer]; });
    ok(!!card && state === 'no-webgl' && gl1 && !gl2 && /WebGL 2/.test((await page.textContent('.vh-fail')) || ''), `WebGL 1 only: "${((await page.textContent('.vh-fail h2')) || '').trim()}"`);
    await shot(page, 'failure-webgl1');
    await close();
    await b1.close();
    // and the family page needs none of it
    const b2 = await pw.chromium.launch({ headless: true, args: [...LAUNCH_ARGS, '--disable-webgl', '--disable-webgl2'] });
    const c2 = await open({ width: 1440, height: 900 }, false, {}, b2);
    await c2.page.goto(srv.url(`family/${slug}`));
    ok((await c2.page.$$eval('li.beat', (e: Element[]) => e.length)) === cardOf(slug).beats, 'with WebGL off, the family page still shows its whole transcript');
    await c2.close();
    await b2.close();
  }
}

// ------------------------------------------------------------------ the editor is the editor in a checkout, and is not served on the site
async function editor() {
  console.log('\neditor');
  {
    // in dist/ the editor page sends a visitor to the landing at once
    const { page, close } = await open({ width: 1440, height: 900 });
    await page.goto(srv.url('room-creator.html'), { waitUntil: 'commit' });
    await page.waitForURL(new RegExp(`${BASE}index\\.html`), { timeout: 2000 }).then(() => ok(true, 'in dist/, room-creator.html without ?mode=view ends at the landing within 2 s'), () => ok(false, 'in dist/, room-creator.html without ?mode=view did not reach the landing in 2 s'));
    await close();
  }
  // from a checkout (the repository served as it is) the editor is still the editor: needs the compiled assets (pnpm run build)
  const checkout = await serve(ROOT, '/');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  await stubGoogleFonts(page, checkout.origin);
  const id = casting[SLUGS[0]].house;
  await page.goto(checkout.url(`room-creator.html?house=${id}`));
  await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 90000 });
  await sleep(500);
  ok(!(await page.$('.vh')) && !(await page.evaluate(() => document.documentElement.dataset.mode)), 'from a checkout, no player without ?mode=view');
  ok(await page.isVisible('.creator-topbar') && await page.isVisible('#animation-dock'), 'the editor chrome is there');
  ok(await page.evaluate(() => typeof (window as any).__houseRenderFrames === 'function' && typeof (window as any).__houseSetLighting === 'function'), 'the __house* hooks are there');
  await shot(page, 'editor-1440');
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
  await checkout.close();
}

// ------------------------------------------------------------------ WebKit
// The site is public, and Safari is where WebGL, touch and video differ most from Chromium. Playwright's WebKit must be the
// revision the pinned Playwright expects (another revision does not start), so this runs when that build is installed, says so
// and moves on when it is not, and fails on a missing build only when asked for with --webkit.
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
      ok(cards === CARDS.length, `WebKit landing: ${cards} cards`);
      await shot(page, 'webkit-landing');
      ok(errors.length === 0, `WebKit landing: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
    {
      const { page, errors, close } = await open({ width: 1440, height: 900 }, false, wk, b);
      await page.goto(srv.url(`room-creator.html?mode=view&family=${SLUGS[0]}&shot=orbit`));
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
  } finally { await b.close(); }
}

// ------------------------------------------------------------------ the seam: every scripts/story/portal-tests/*.mts
async function hooks() {
  const dir = path.join(ROOT, TEST_GLOB);
  const list = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mts')).sort() : [];
  if (!list.length) return;
  const ctx: TestCtx = {
    ROOT, OUT: DIR, base: srv.url(), url: (p = '') => srv.url(p), browser, pw, families: { v: 1, families: CARDS }, manifest,
    open: (viewport, mobile = false, extra = {}) => open(viewport, mobile, extra), check: ok, shot, sleep,
  };
  for (const f of list) {
    console.log(`\n${f.replace(/\.mts$/, '')} (scripts/story/portal-tests)`);
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    await mod.default(ctx);
  }
}

const only = args.only && args.only !== 'true' ? new Set(args.only.split(',')) : null;   // e.g. --only failures,previews
const run = (name: string): boolean => !only || only.has(name);
try {
  if (run('static')) staticChecks();
  if (run('gallery')) { await gallery({ width: 1440, height: 900 }, false, '1440'); await gallery({ width: 390, height: 844 }, true, '390'); }
  if (run('pages')) await pages();
  if (run('previews')) await previews();
  if (run('caching')) await caching();
  if (run('player')) { for (const [i, id] of SLUGS.entries()) await player(id, { width: 1440, height: 900 }, false, '1440', i === 0); await player(SLUGS[0], { width: 390, height: 844 }, true, '390', false); }
  if (run('motion')) await motion(SLUGS[0]);
  if (run('failures')) await failureCases();
  if (run('editor')) await editor();
  if (run('webkit')) await webkit();
  if (run('hooks')) await hooks();
} catch (err) {
  failures++;
  console.error(`\n\x1b[31m${(err as Error).stack || err}\x1b[0m`);
} finally {
  await browser.close();
  await srv.close();
}
console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed · screenshots in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
process.exit(failures ? 1 : 0);
