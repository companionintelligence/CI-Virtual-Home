#!/usr/bin/env -S node --experimental-strip-types
// End-to-end check of the built portal, served the way GitHub Pages serves it: dist/ under /ci-virtual-home/.
//
//   pnpm run build && pnpm run portal:build && pnpm run portal:test [--dir dist] [--base /ci-virtual-home/]
//        [--house aurora,lakecabin,mirage] [--shots test/portal] [--headed]
//
//   gallery   30 cards, every thumbnail decoded, search / storeys / tag filters narrow and clear, a card opens
//             the player; 1440 × 900 and 390 × 844
//   player    for each --house: builds, lists its shots from the presets, plays (t advances), pauses (Space),
//             scrubs (a click on the scrubber lands there), switches shot (URL follows), switches the time of
//             day (the page's lighting follows), shows the path (P), flies (F, W moves the camera, a drag turns
//             it, Esc puts it back on the shot), copies a share link that reopens at the same moment, and
//             steps to the next home; 1440 × 900 and 390 × 844 (touch)
//   editor    room-creator.html without ?mode=view still shows the editor and never mounts the player
//
// Any console error, page error or failed request on any page fails the run. Screenshots land in --shots
// (gitignored test/portal/ by default) so a person can look at what passed. Exit 0 only when everything did.
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

type Ctx = { page: any; errors: string[]; close: () => Promise<void> };
async function open(viewport: { width: number; height: number }, mobile = false): Promise<Ctx> {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: mobile ? 3 : 2, isMobile: mobile, hasTouch: mobile,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('response', (r: any) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r: any) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push(`request failed ${r.url()}`); });
  await stubGoogleFonts(page, srv.origin);
  return { page, errors, close: () => ctx.close() };
}
const shot = async (page: any, name: string) => { await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const viewerReady = (page: any) => page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 90000 });
const scrubT = (page: any): Promise<number> => page.$eval('.vh-scrub input', (e: HTMLInputElement) => Number(e.value) / 1000);
const camPos = (page: any): Promise<number[]> => page.evaluate(() => { const c = (window as any).__houseDebug().camera; return [c.position.x, c.position.y, c.position.z]; });
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ------------------------------------------------------------------ gallery
async function gallery(viewport: { width: number; height: number }, mobile: boolean, label: string) {
  console.log(`\ngallery ${label}`);
  const { page, errors, close } = await open(viewport, mobile);
  await page.goto(srv.url('index.html'));
  await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
  const cards = await page.$$eval('#grid .card', (els: Element[]) => els.length);
  ok(cards === 30, `${cards} cards`);
  // load every thumbnail (lazy ones too) and check each decoded
  await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('#grid img')).every(i => i.complete), null, { timeout: 20000 });
  const decoded = await page.$$eval('#grid img', (imgs: HTMLImageElement[]) => imgs.filter(i => i.naturalWidth === 640 && i.naturalHeight === 360).length);
  ok(decoded === 30, `${decoded} of 30 thumbnails decoded at 640 × 360`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await shot(page, `gallery-${label}`);
  const visible = () => page.$$eval('#grid .card', (els: HTMLElement[]) => els.filter(e => !e.hidden).length);
  await page.fill('#q', 'brick');
  await sleep(250);
  const brick = await visible();
  ok(brick > 0 && brick < 30, `search "brick" narrows to ${brick}`);
  ok((await page.evaluate(() => location.search)).includes('q=brick'), 'the search is in the URL');
  await page.fill('#q', '');
  await page.click('#storeys button[data-storeys="1"]');
  const one = await visible();
  ok(one > 0 && one < 30, `1 storey narrows to ${one}`);
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
  await page.waitForURL(/room-creator\.html\?mode=view/, { timeout: 10000 });
  await viewerReady(page);
  ok(true, `a card opens the player (${new URL(page.url()).searchParams.get('house')})`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await close();
}

// ------------------------------------------------------------------ player
async function player(id: string, viewport: { width: number; height: number }, mobile: boolean, label: string, full: boolean) {
  console.log(`\nplayer ${id} ${label}`);
  const { page, errors, close } = await open(viewport, mobile);
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
  // play: t advances
  const a = await scrubT(page); await sleep(1200); const b = await scrubT(page);
  ok(b > a, `playing advances t (${a.toFixed(3)} → ${b.toFixed(3)})`);
  if (!mobile) await page.mouse.move(viewport.width / 2, viewport.height / 3);
  await shot(page, `player-${id}-${label}-playing`);
  // pause
  if (mobile) await page.tap('.vh-play'); else await page.keyboard.press('Space');
  await sleep(150);
  const c = await scrubT(page); await sleep(600); const d = await scrubT(page);
  ok(Math.abs(d - c) < 1e-6 && (await page.getAttribute('.vh', 'data-playing')) === '0', 'pause holds t');
  // scrub: a click at 70 % of the track lands near t = 0.7, and the readout follows
  const box = await page.$eval('.vh-scrub input', (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const before = await page.textContent('.vh-now');
  await page.mouse.click(box.x + box.w * 0.7, box.y + box.h / 2);
  await sleep(200);
  const st = await scrubT(page);
  ok(Math.abs(st - 0.7) < 0.03, `scrub lands at t = ${st.toFixed(3)}`);
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
  if (mobile) await page.tap('[data-act="path"]'); else await page.keyboard.press('p');
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
  if (mobile) await page.tap('[data-act="fly"]'); else await page.keyboard.press('f');
  await sleep(200);
  ok((await page.getAttribute('.vh', 'data-fly')) === '1', 'fly mode on');
  if (!mobile) {
    const p0 = await camPos(page);
    await page.keyboard.down('w'); await sleep(500); await page.keyboard.up('w');
    const p1 = await camPos(page);
    ok(dist(p0, p1) > 0.5, `W flies forward ${dist(p0, p1).toFixed(2)} m`);
    await page.keyboard.down('e'); await sleep(300); await page.keyboard.up('e');
    const p2 = await camPos(page);
    ok(p2[1] > p1[1] + 0.3, 'E rises');
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
  if (full) {
    // share: the copied link reopens at the same moment
    await page.click('[data-act="share"]');
    await sleep(300);
    const link: string = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    const u = link ? new URL(link) : null;
    ok(!!u && u.pathname.startsWith(BASE) && u.searchParams.get('house') === id && u.searchParams.has('t') && u.searchParams.has('shot') && u.searchParams.has('tod'), `share copies ${link.replace(srv.origin, '')}`);
    if (u) {
      const { page: p2, errors: e2, close: c2 } = await open(viewport, mobile);
      await p2.goto(link);
      await viewerReady(p2);
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
  await close();
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
  for (const [i, id] of HOUSES.entries()) await player(id, { width: 1440, height: 900 }, false, '1440', i === 0);
  await player(HOUSES[0], { width: 390, height: 844 }, true, '390', false);
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
