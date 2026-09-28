#!/usr/bin/env -S node --experimental-strip-types
// End-to-end check of the built portal, served the way GitHub Pages serves it: dist/ under /ci-virtual-home/.
//
//   pnpm run build && pnpm run portal:build && pnpm run portal:test [--dir dist] [--base /ci-virtual-home/]
//        [--house aurora,lakecabin,mirage] [--shots test/portal] [--headed]
//
//   gallery   30 cards, every thumbnail decoded, the static hero figures match the data, no link forces
//             autoplay, card names carry no Sims jargon and are distinct, hovering a card warms the player (not
//             room-creator.html itself), search / storeys / tag filters narrow and clear (and the tag counts follow
//             the storeys filter), a card opens the player; the built pages' link previews are the site's, with
//             absolute images; 1440 × 900 and 390 × 844
//   player    for each --house: builds, lists its shots from the presets, plays (t advances), pauses (Space),
//             Space on a focused button presses that button, scrubs (a click on the scrubber lands there),
//             switches shot (URL follows), switches the time of day (the page's lighting follows), shows the
//             path (P), flies (F, W moves the camera, Q never takes it under the lot, a drag turns it, Esc puts it
//             back on the shot; the free-camera bar is inert until then, and at 1280 px it clears the title; every
//             shot chip shows from 768 px up), ends a shot on the end card, copies a share link — homes/<id>.html,
//             whose preview tags name the home — that reopens at the same moment, and steps to the next home;
//             1440 × 900 and 390 × 844 (touch, where
//             the tools are in the More sheet and the seek bar is a 44 px target). The gallery and the player ask
//             no third party for anything (no Google Fonts)
//   motion    with the system set to reduce motion, a home opened from the gallery (or with play=1) holds still
//   failures  an id no home has: the error card at once, no spec request, no editor scene built behind it; a
//             module that does not download (viewer.js, house-builder.js) and a browser with WebGL 1 only: a
//             card that says so, with a way back, instead of an endless loader
//   editor    room-creator.html without ?mode=view still shows the editor and never mounts the player
//
// Any console error, page error or failed request on any page fails the run (the failure cases allow exactly the
// ones they cause). Screenshots land in --shots (gitignored test/portal/ by default) so a person can look at what
// passed. Exit 0 only when everything did.
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

// ------------------------------------------------------------------ gallery
async function gallery(viewport: { width: number; height: number }, mobile: boolean, label: string) {
  console.log(`\ngallery ${label}`);
  const { page, errors, thirdParty, close } = await open(viewport, mobile);
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
  const hrefs: string[] = await page.$$eval('#grid .card a, #hero-play, #hero-media', (els: HTMLAnchorElement[]) => els.map(a => a.href));
  ok(hrefs.length === 32 && hrefs.every(h => !new URL(h).searchParams.has('play')), 'no gallery link forces autoplay (the player decides, and honours reduced motion)');
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
    // a pointer over a card warms three.js, the engine and that home's spec — never room-creator.html, whose
    // player URL carries a query and so could never be served from that prefetch
    await page.hover('#grid .card:nth-child(5) a');
    await sleep(200);
    const warmed: string[] = await page.$$eval('link[rel="prefetch"]', (ls: HTMLLinkElement[]) => ls.map(l => l.getAttribute('href') || ''));
    const id5 = await page.$eval('#grid .card:nth-child(5)', (e: HTMLElement) => e.dataset.id);
    ok(warmed.includes('./assets/vendor/three/three.module.min.js') && warmed.includes(`./content/houses/${id5}.json`) && !warmed.some(h => h.includes('room-creator')), `hovering a card warms ${warmed.length} files, not the page`);
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
  // a card opens the player
  await page.click('#grid .card:nth-child(2) a');
  // the navigation, not its load event (three.js and the engine are part of that, and a loaded machine takes a
  // while over them); viewerReady below waits for the player itself
  await page.waitForURL(/room-creator\.html\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
  await viewerReady(page);
  ok(true, `a card opens the player (${new URL(page.url()).searchParams.get('house')})`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  ok(thirdParty.length === 0, `the gallery and the player ask no third party for anything${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ link previews of the built pages
async function previews() {
  console.log('\nlink previews');
  const head = (html: string) => html.slice(0, html.indexOf('</head>'));
  const gallery = head(await (await fetch(srv.url('index.html'))).text());
  const player = head(await (await fetch(srv.url('room-creator.html'))).text());
  const og = (h: string, p: string) => (h.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1] || '';
  ok(/^https?:\/\//.test(og(gallery, 'og:image')) && og(gallery, 'og:image').endsWith('portal/hero.webp') && /summary_large_image/.test(gallery), `the gallery previews with its hero (${og(gallery, 'og:image')})`);
  const staticHead = player.slice(0, player.indexOf('<script'));
  ok(!/Room Creator|SimsTree|Pascal/.test(staticHead) && /<title>Virtual homes/.test(staticHead) && /^https?:\/\//.test(og(player, 'og:image')), `room-creator.html's static head is the site's, not the editor's (${(staticHead.match(/<title>([^<]*)/) || [])[1]})`);
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
  const chips = await page.$$eval('.vh-shots .vh-chip', (els: HTMLElement[]) => els.map(e => ({ key: e.dataset.shot, label: e.querySelector('span')!.textContent })));
  const presetShots = await page.evaluate(() => { const s = (window as any).__houseDebug().house.shots; return [...new Set(Object.values(s))].length; });
  ok(chips.length === presetShots && chips.length >= 4, `${chips.length} shots listed from the house's presets (${chips.map((c: any) => c.label).join(', ')})`);
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
  if (mobile) await page.tap('.vh-play'); else await page.keyboard.press('Space');
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
    ok(!!u && u.pathname === `${BASE}homes/${id}.html` && u.searchParams.has('t') && u.searchParams.has('shot') && u.searchParams.has('tod'), `share copies ${link.replace(srv.origin, '')}`);
    if (u) {
      const sharePage = await (await fetch(link)).text();
      const name = (await page.textContent('.vh-name'))!.trim();
      const tag = (p: string) => (sharePage.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1] || '';
      const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      ok(unesc(tag('og:title')) === name && tag('og:image').endsWith(`portal/thumbs/${id}.webp`) && tag('og:description').length > 20 && !/Room Creator/.test(sharePage), `the share page previews as "${unesc(tag('og:title'))}" with its thumbnail`);
      const { page: p2, errors: e2, close: c2 } = await open(viewport, mobile);
      await p2.goto(link);
      await viewerReady(p2);
      ok(new URL(p2.url()).pathname === `${BASE}room-creator.html` && new URL(p2.url()).searchParams.get('house') === id, 'the share page forwards to the player');
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
    await page.route(`**/assets/${file}`, (r: any) => r.abort());
    await page.goto(srv.url('room-creator.html?mode=view&house=aurora'));
    const card = await page.waitForSelector('.vh-fail', { timeout: 60000 }).catch(() => null);
    const state = await page.evaluate(() => document.documentElement.dataset.viewer);
    ok(!!card && state === 'failed' && (await page.isVisible('.vh-fail a[href="./index.html"]')) && (await page.isVisible('.vh-fail button')), `${file} not downloading: a card with Try again and See all homes (${state})`);
    ok(!/Room Creator|SimsTree/.test(await page.title()) && await page.isVisible('.vh-boot-back'), `the tab says "${await page.title()}", and a back arrow shows`);
    await shot(page, `failure-${file.replace('.js', '')}`);
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

try {
  await gallery({ width: 1440, height: 900 }, false, '1440');
  await gallery({ width: 390, height: 844 }, true, '390');
  await previews();
  for (const [i, id] of HOUSES.entries()) await player(id, { width: 1440, height: 900 }, false, '1440', i === 0);
  await player(HOUSES[0], { width: 390, height: 844 }, true, '390', false);
  await motion(HOUSES[0]);
  await failureCases();
  await editor();
} catch (err) {
  failures++;
  console.error(`\n\x1b[31m${(err as Error).stack || err}\x1b[0m`);
} finally {
  await browser.close();
  await srv.close();
}
console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed · screenshots in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
process.exit(failures ? 1 : 0);
