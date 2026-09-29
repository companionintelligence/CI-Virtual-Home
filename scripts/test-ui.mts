#!/usr/bin/env -S node --experimental-strip-types
// The editor (room-creator.html without ?mode=view), driven end to end in Chromium: plan §6 and S6's acceptance.
//
//   pnpm run build && node --experimental-strip-types scripts/test-ui.mts [--only layout,record,…] [--headed] [--shots test/ui]
//
//   gates     no alert() or confirm(); no literal colour outside the token blocks (the page's CSS and markup, and
//             assets/ui/); only Manrope and JetBrains Mono requested; no emoji in the chrome (markup, assets/ui/, and
//             the chrome's text once a home is built)
//   layout    1280 × 800, 1440 × 900, 768 × 1024 and 390 × 844, dark and light, Edit and Review: the viewport is at
//             least 60 %, 55 %, 100 % and 100 % of the width, no horizontal scroll, a screenshot of each (--shots)
//   hooks     every __house* hook the gates and the portal use is still there
//   qa        the checks run (?qa=1): the badge's counts are the gates' own, a finding jumps the timeline to its t,
//             the timeline carries its markers, its bands and its event ticks
//   transport Space plays and pauses; ← → step a frame of 60 fps (Shift: a second); Home / End
//   overlays  the plan inset draws and follows the camera up a storey; the camera path draws over the view and a
//             rendered frame is the same with it on or off; the safe frame fits the view
//   url       ?house=&shot=&t=&lighting=&mode= is written as they change and a reload restores all five
//   walls     the wall modes and the floor filter: a storey view hides what is above it and every roof, keeps the
//             world, and a shot never sees it
//   catalog   the search finds across categories and says when nothing matches; the time of day follows the control
//   edit      Backspace on a home's own part does nothing; adding from the catalog, a material edit and a delete
//             undo and redo
//   picker    the home picker searches, opens a home by keyboard, and the title and the URL follow
//   modes     Review hides the catalog and the tools and shows the shot cards; Edit brings them back
//   drawers   768 × 1024: the inspector is a drawer over the viewport
//   topbar    from 360 to 1440 px, Edit and Review: no two pieces of the top bar overlap, none is cut off or spills
//   a11y      1280 × 800, dark and light, Edit and Review: every text meets WCAG AA contrast against what is really
//             drawn behind it (sampled off a screenshot with the glyphs hidden), every control is at least 24 px,
//             the scene outliner is one tab stop; the dialogs' buttons are whole on a phone
//   outliner  the scene is a tree (storeys, rooms, parts) that searches, opens to the selection and takes the arrow keys
//   props     the house catalog is the fifth tab and part of every search; a prop with wall metadata sets against a wall
//   photo     a reference photo lays over the view, wipes, and never reaches a rendered frame
//   compare   every home at one shot: posters draw through the film's renderer, differ, the editor's home comes back
//             at its shot and moment, and the sheet saves
//   still     4K 16:9 is 3840 × 2160 and 4K 9:16 is 2160 × 3840 (the PNGs as downloaded); a transparent cutout has
//             an alpha channel; the viewport is its own size again after
//   record    a 12 s door-to-core at 30 fps: 360 frames, 12.00 s (ffprobe), each sampled frame hashing the same as
//             __houseRenderFrames draws it before encoding, and decoding to within 40 dB PSNR of it
//
// Any console error or page error fails the run. Needs a GPU (it renders through the film's composer) and, for the
// recording, ffmpeg and ffprobe. Exit 0 only when everything passed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { decodePNG } from './vendor/png.mjs';
import { loadPlaywright, LAUNCH_ARGS, FONT_FILES } from './portal-lib.mts';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, [] as string[][]));
const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses');
const SHOTS = path.resolve(args.shots || path.join(ROOT, 'test', 'ui'));
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const want = (k: string) => !ONLY || ONLY.has(k);
const TWO = 's6-editor-storeys', ONE = 's6-editor-single';
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string) => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const EMOJI = /\p{Extended_Pictographic}/u;

// ------------------------------------------------------------------ gates (static)
if (want('gates')) {
  console.log('\ngates');
  const page = fs.readFileSync(path.join(ROOT, 'room-creator.html'), 'utf8');
  const uiDir = path.join(ROOT, 'assets', 'ui');
  const uiFiles = fs.readdirSync(uiDir).filter(f => f.endsWith('.ts')).map(f => path.join(uiDir, f));
  const code = (f: string) => fs.readFileSync(f, 'utf8');
  const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, '');
  const dialogCalls = [page, ...[...uiFiles, path.join(ROOT, 'assets', 'viewer.ts'), path.join(ROOT, 'assets', 'visibility.ts')].map(code)].map(noComments).join('\n').match(/\b(alert|confirm|prompt)\s*\(/g) || [];
  ok(!dialogCalls.length, `no alert(), confirm() or prompt() in the editor and assets/ui (${dialogCalls.length})`);
  // the editor's CSS, less its two token blocks (the canon mirrored: :root and the light set), holds no colour literal
  const style = page.slice(page.indexOf('<style>'), page.indexOf('</style>'));
  const rootStart = style.indexOf(':root {'), rootEnd = style.indexOf('\n    }', rootStart);
  const lightStart = style.indexOf('@media (prefers-color-scheme: light)'), lightEnd = style.indexOf('\n    }\n', style.indexOf('\n      }', lightStart));
  const rest = noComments(style.slice(0, rootStart) + style.slice(rootEnd, lightStart) + style.slice(lightEnd));
  const hexCss = rest.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  ok(rootStart > 0 && lightStart > 0 && !hexCss.length, `no literal hex in the editor's CSS outside the token blocks${hexCss.length ? ': ' + hexCss.slice(0, 5).join(' ') : ''}`);
  const body = noComments(page.slice(page.indexOf('<body>'), page.indexOf('<script type="module">')));
  const hexMarkup = [...(body.match(/style="[^"]*#[0-9a-fA-F]{3,8}\b[^"]*"/g) || []), ...(body.match(/(?:fill|stroke|color)="#[0-9a-fA-F]{3,8}"/g) || [])];
  ok(!hexMarkup.length, `no literal hex in the markup's styles${hexMarkup.length ? ': ' + hexMarkup.slice(0, 3).join(' ') : ''}`);
  const hexUi = uiFiles.flatMap(f => (noComments(code(f)).match(/['"`][^'"`\n]*#[0-9a-fA-F]{3,8}\b[^'"`\n]*['"`]/g) || []).map(m => `${path.basename(f)}: ${m}`));
  ok(!hexUi.length, `no literal hex in assets/ui/${hexUi.length ? ': ' + hexUi.slice(0, 3).join(' | ') : ''}`);
  const fontsUrl = (page.match(/fonts\.googleapis\.com\/css2\?([^"']+)/) || [])[1] || '';
  const families = [...fontsUrl.matchAll(/family=([^:&]+)(?::wght@([\d;]+))?/g)].map(m => [decodeURIComponent(m[1].replace(/\+/g, ' ')), m[2] || '']);
  ok(families.length === 2 && families[0][0] === 'Manrope' && families[1][0] === 'JetBrains Mono' && families[0][1].split(';').every(w => ['200', '400', '500', '600', '700'].includes(w)),
    `only Manrope (${families[0]?.[1]}) and JetBrains Mono are requested`);
  const emojiMarkup = [...body.matchAll(/>([^<]+)</g)].map(m => m[1]).filter(t => EMOJI.test(t));
  ok(!emojiMarkup.length, `no emoji in the markup${emojiMarkup.length ? ': ' + emojiMarkup.slice(0, 3).join(' ') : ''}`);
  const emojiUi = uiFiles.filter(f => EMOJI.test(noComments(code(f))));
  ok(!emojiUi.length, `no emoji in assets/ui/${emojiUi.length ? ': ' + emojiUi.map(f => path.basename(f)).join(', ') : ''}`);
  ok(!/Room Creator|SimsTree|Pascal/i.test(page.slice(0, page.indexOf('<script'))) && !/>[^<]*(Pascal|SimsTree)[^<]*</.test(body), 'no Pascal or SimsTree in the head, the title or the chrome');
  // the shot gallery (video/houses/index.html) keeps the same canon: tokens, no emoji, no Room Creator
  const gal = fs.readFileSync(path.join(ROOT, 'video', 'houses', 'index.html'), 'utf8');
  const galStyle = gal.slice(gal.indexOf('<style>'), gal.indexOf('</style>')), galTokens = galStyle.indexOf('*, *::before');
  const galHex = noComments(galStyle.slice(galTokens)).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const galText = noComments(gal.slice(gal.indexOf('<body>')));
  ok(galTokens > 0 && !galHex.length && !EMOJI.test(galText) && !/Room Creator/.test(galText) && !/Plus Jakarta/.test(gal), `the shot gallery: no literal hex below its tokens, no emoji, no Room Creator, no Plus Jakarta Sans${galHex.length ? ' (' + galHex.slice(0, 3).join(' ') + ')' : ''}`);
}

// ------------------------------------------------------------------ the browser
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const fixtureIds = new Set(fs.readdirSync(FIXTURES).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')));
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  const font = url.startsWith('/__fonts/') && FONT_FILES[url.slice('/__fonts/'.length)];
  const fx = url.match(/^\/content\/houses\/([a-z0-9-]+)\.json$/);   // a fixture answers as a house
  const f = font ? path.join(ROOT, 'assets', 'fonts', font) : fx && fixtureIds.has(fx[1]) ? path.join(FIXTURES, `${fx[1]}.json`) : path.join(ROOT, url);
  if ((!font && !f.startsWith(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
const origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });
const fontCss = `@font-face{font-family:'Manrope';src:url('${origin}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}@font-face{font-family:'JetBrains Mono';src:url('${origin}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;

type Ctx = { page: any; errors: string[]; close: () => Promise<void> };
async function open(query: string, viewport = { width: 1280, height: 800 }, scheme: 'dark' | 'light' = 'dark'): Promise<Ctx> {
  const mobile = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: scheme, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('response', (r: any) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
  await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
  await page.goto(`${origin}/room-creator.html${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.houseReady || (window as any).__houseUi?.state().scene, null, { timeout: 120000 });
  await page.waitForFunction(() => !document.documentElement.dataset.building, null, { timeout: 120000 });
  await sleep(600);
  return { page, errors, close: () => ctx.close() };
}
const shot = (page: any, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const state = (page: any) => page.evaluate(() => (window as any).__houseUi.state());
const query = (page: any) => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
const canvasInk = (page: any, sel: string) => page.$eval(sel, (c: HTMLCanvasElement) => { const g = c.getContext('2d')!; if (!c.width || !c.height) return 0; const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (c.width * c.height); });
const noErrors = (c: Ctx, where: string) => ok(c.errors.length === 0, `no console errors ${where}${c.errors.length ? ': ' + c.errors.slice(0, 3).join(' | ') : ''}`);

try {
  // ---------------------------------------------------------------- layout: sizes × schemes × modes
  if (want('layout')) {
    for (const [w, h, min] of [[1280, 800, 0.6], [1440, 900, 0.55], [768, 1024, 1], [390, 844, 1]] as Array<[number, number, number]>) {
      for (const scheme of ['dark', 'light'] as const) {
        console.log(`\nlayout ${w} × ${h} ${scheme}`);
        const c = await open(`?house=${TWO}`, { width: w, height: h }, scheme);
        for (const mode of ['edit', 'review']) {
          await c.page.evaluate((m: string) => (window as any).__houseUi.setUiMode(m), mode);
          await sleep(350);
          const m = await c.page.evaluate(() => { const r = document.getElementById('viewport-box')!.getBoundingClientRect(); return { vw: r.width, iw: innerWidth, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth }; });
          ok(m.vw / m.iw >= min - 1e-3 && m.sw <= m.iw && m.bw <= m.iw, `${mode}: viewport ${Math.round(m.vw)} of ${m.iw} px (${Math.round(100 * m.vw / m.iw)} %, at least ${min * 100} %), no horizontal scroll`);
          await shot(c.page, `${w}x${h}-${scheme}-${mode}`);
        }
        if (w === 1280 && scheme === 'dark') {
          // the chrome's own text, once built: no emoji anywhere in it
          const text = await c.page.evaluate(() => ['header.creator-topbar', 'aside.catalog-sidebar', 'aside.inspector-sidebar', '#animation-dock', '.viewport-overlay-top'].map(s => (document.querySelector(s) as HTMLElement)?.innerText || '').join('\n') + Array.from(document.querySelectorAll('select option')).map(o => o.textContent).join('\n'));
          ok(!EMOJI.test(text), 'no emoji in the chrome once a home is built');
          // labels at least 10.6 px (the canon's floor), controls named
          const small = await c.page.evaluate(() => Array.from(document.querySelectorAll('header *, aside *, #animation-dock *, .viewport-overlay-top *, .viewport-hud-angles *')).filter(e => { const el = e as HTMLElement; return el.offsetParent && el.childNodes.length && Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 10.6; }).map(e => `${(e as HTMLElement).className || e.tagName}: ${getComputedStyle(e).fontSize}`));
          ok(!small.length, `every label at least 10.6 px${small.length ? ': ' + small.slice(0, 4).join(' | ') : ''}`);
          const unnamed = await c.page.evaluate(() => Array.from(document.querySelectorAll('button, input, select, [role="tab"]')).filter(e => { const el = e as HTMLElement; if (!el.offsetParent) return false; const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el as HTMLInputElement).labels?.length || el.textContent!.trim() || el.title; return !name; }).map(e => (e as HTMLElement).id || (e as HTMLElement).className));
          ok(!unnamed.length, `every control has a name${unnamed.length ? ': ' + unnamed.slice(0, 5).join(', ') : ''}`);
        }
        if (w === 390) {
          const hh = await c.page.$eval('header.creator-topbar', (e: HTMLElement) => e.getBoundingClientRect().height);
          ok(hh > 80, `the phone's top bar is two rows (${Math.round(hh)} px)`);
          // (the timeline's markers are 24 px dots, spread along the bar; their hit area is 44 px: .rc-tl-mark::before)
          const targets = await c.page.evaluate(() => Array.from(document.querySelectorAll('header button, header a, #animation-dock button, #animation-dock select')).filter(e => (e as HTMLElement).offsetParent && !e.classList.contains('rc-tl-mark')).filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(e => `${e.id || e.className} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
          ok(targets.length === 0, `touch targets at least 44 px on a phone${targets.length ? ': ' + targets.join(', ') : ''}`);
        }
        noErrors(c, `(${w} × ${h} ${scheme})`);
        await c.close();
      }
    }
  }

  // ---------------------------------------------------------------- the editor at 1280 × 800
  const needMain = ['hooks', 'qa', 'transport', 'overlays', 'url', 'walls', 'catalog', 'outliner', 'props', 'photo', 'edit', 'picker', 'modes'].some(want);
  if (needMain) {
    console.log(`\neditor 1280 × 800 (${TWO}, ?qa=1)`);
    let c = await open(`?house=${TWO}&qa=1`);
    const { page } = c;
    if (want('hooks')) {
      const hooks = await page.evaluate(() => ['__houseRenderBegin', '__houseRenderFrames', '__houseRenderEnd', '__houseComposerWarm', '__houseSnapshot', '__houseShotQA', '__houseSceneQA', '__houseShotTrack', '__houseShotDuration', '__houseDebug', '__houseSetLighting', '__housePropSheet', '__houseExportCore', '__houseCoreFactory', '__houseAssetFactory', '__houseBuilderRef', 'houseContactSheet'].filter(k => typeof (window as any)[k] === 'undefined'));
      ok(!hooks.length, `every __house* hook is there${hooks.length ? ' (missing ' + hooks.join(', ') + ')' : ''}`);
      ok(typeof (await page.evaluate(() => typeof (window as any).__houseSceneQA.register)) === 'string' && (await page.evaluate(() => typeof (window as any).__houseSceneQA.register)) === 'function', '__houseSceneQA.register is there');
    }

    if (want('qa')) {
      await page.waitForFunction(() => ['pass', 'warn', 'error'].includes(document.getElementById('btn-qa')!.dataset.state!), null, { timeout: 120000 });
      const ui = await page.evaluate(() => { const q = (window as any).__houseUi.qa(); return { issues: q.issues, badge: document.getElementById('btn-qa')!.dataset.state, err: +document.getElementById('qa-n-err-v')!.textContent!, warn: +document.getElementById('qa-n-warn-v')!.textContent! }; });
      const gates = await page.evaluate(() => { const w = window as any; const s = w.__houseSceneQA(); const shots = ['door-to-core', 'orbit', 'hero-reveal', 'core-orbit'].map((x: string) => w.__houseShotQA(x)); return { e: s.errors.length + shots.reduce((a: number, q: any) => a + q.errors.length, 0), w: s.warnings.length + shots.reduce((a: number, q: any) => a + q.warnings.length, 0) }; });
      ok(ui.err === gates.e && ui.warn === gates.w, `the badge counts the gates' own findings (${ui.err} errors, ${ui.warn} warnings; the gates say ${gates.e} and ${gates.w})`);
      const timed = ui.issues.find((i: any) => i.shot === 'door-to-core' && i.t !== null);
      if (timed) {
        await page.click('#btn-qa');
        await page.click(`#qa-list .qa-jump`);
        await sleep(300);
        const st = await state(page);
        ok(Math.abs(st.t - ui.issues.filter((i: any) => i.t !== null)[0].t) < 1e-6 && !st.playing, `a finding jumps the timeline to its t (${st.t.toFixed(3)})`);
        const markers = await page.$$eval('.rc-tl-qa', (els: Element[]) => els.length);
        ok(markers > 0, `the timeline carries its QA markers (${markers})`);
      } else ok(false, 'the storeys fixture has a timed finding (its door-to-core orbit-swing-back warning)');
      await page.selectOption('#spline-preset-select', `house:${TWO}:door-to-core`);
      await sleep(400);
      const tl = await page.evaluate(() => ({ bands: document.querySelector('.rc-tl')!.getAttribute('data-bands'), events: document.querySelectorAll('.rc-tl-event').length, n: (window as any).__houseUi.timeline.bands.length }));
      ok(tl.bands === 'phases' && tl.n >= 3 && tl.events >= 2, `the timeline has bands (${tl.bands}: ${tl.n}) and event ticks (${tl.events})`);
      ok((await canvasInk(page, '.rc-tl-spark')) > 0.01 && (await canvasInk(page, '.rc-tl-bands')) > 0.5, 'the sparklines and the bands are drawn');
      // v2 beats, when the planner bakes them (S5): the same timeline draws them as beats
      const beats = await page.evaluate(() => { const u = (window as any).__houseUi; const tr = (window as any).__houseShotTrack('door-to-core'); tr.beats = [{ name: 'establish', t0: 0, t1: 1.8 }, { name: 'approach', t0: 1.8, t1: 3.1 }, { name: 'route', t0: 3.1, t1: 9 }, { name: 'power', t0: 9, t1: 12 }]; u.timeline.setShot({ track: tr, phases: [], qa: [], duration: tr.duration }); return { kind: document.querySelector('.rc-tl')!.getAttribute('data-bands'), n: u.timeline.bands.length, beat: u.timeline.bands[0].beat }; });
      ok(beats.kind === 'beats' && beats.n === 4 && beats.beat, 'a v2 track\'s beats draw as beats');
      await page.selectOption('#spline-preset-select', `house:${TWO}:orbit`); await page.selectOption('#spline-preset-select', `house:${TWO}:door-to-core`);
      await sleep(300);
    }

    if (want('transport')) {
      await page.focus('body');
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await page.keyboard.press('Space');
      await sleep(700);
      let st = await state(page);
      ok(st.playing && st.t > 0.02, `Space plays (t ${st.t.toFixed(3)})`);
      await page.keyboard.press('Space');
      st = await state(page);
      ok(!st.playing, 'Space pauses');
      await page.evaluate(() => { const i = (window as any).__houseUi.timeline.input; i.value = String(Math.round(0.5 * +i.max)); i.dispatchEvent(new Event('input')); });
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      const t0 = (await state(page)).t;
      await page.keyboard.press('ArrowRight');
      st = await state(page);
      ok(Math.abs(st.t - (t0 + 1 / (60 * st.duration))) < 1e-9, `→ steps one frame of 60 fps (${((st.t - t0) * st.duration * 60).toFixed(3)} frames)`);
      await page.keyboard.press('Shift+ArrowLeft');
      const st2 = await state(page);
      ok(Math.abs(st2.t - (st.t - 1 / st.duration)) < 1e-9, 'Shift ← steps back a second');
      await page.keyboard.press('End');
      ok((await state(page)).t === 1, 'End goes to the end');
      await page.keyboard.press('Home');
      ok((await state(page)).t === 0, 'Home goes to the start');
      const label = await page.getAttribute('#btn-play-pause', 'aria-label');
      ok(label === 'Play' && (await page.getAttribute('#btn-play-pause', 'aria-pressed')) === 'false', 'the play button says what it does');
    }

    if (want('overlays')) {
      await page.keyboard.press('m');
      await sleep(300);
      ok(await page.isVisible('#plan-inset'), 'M shows the plan inset');
      await page.evaluate(() => (window as any).__houseUi.timeline.input.dispatchEvent(new Event('input')));
      await page.evaluate(() => { const i = (window as any).__houseUi.timeline.input; i.value = '0'; i.dispatchEvent(new Event('input')); });
      await sleep(300);
      const l0 = await page.textContent('#plan-inset-level');
      const ink0 = await canvasInk(page, '#plan-inset-canvas');
      await page.evaluate(() => { const i = (window as any).__houseUi.timeline.input; i.value = String(Math.round(0.82 * +i.max)); i.dispatchEvent(new Event('input')); });
      await sleep(300);
      const l1 = await page.textContent('#plan-inset-level');
      ok(ink0 > 0.05 && /Ground/.test(l0) && /Upper/.test(l1), `the plan inset draws (${Math.round(ink0 * 100)} % inked) and follows the camera up a storey ("${l0}" → "${l1}")`);
      await shot(page, 'overlays-plan-inset');
      // showcase rooms (S5's spec.showcase): tinted when the spec names them
      await page.evaluate(() => { const d = (window as any).__houseDebug(); d.house.spec.showcase = ['Office']; (window as any).__houseUi.planInset.setHouse(d.house.spec, d.house.anchors); });
      ok((await canvasInk(page, '#plan-inset-canvas')) > 0.05, 'the plan inset takes a spec\'s showcase rooms');
      // the camera path: over the view, never in a frame
      const frameHash = () => page.evaluate(async () => { const w = window as any; const info = w.__houseRenderBegin({ shot: 'door-to-core', res: '360', fps: 30 }); await w.__houseComposerWarm({ res: '360' }); w.__houseRenderFrames(100, 1, null); const gl = w.__houseDebug().renderer.getContext(); const px = new Uint8Array(info.w * info.h * 4); gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px); w.__houseRenderEnd(); const d = await crypto.subtle.digest('SHA-256', px); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16); });
      const off = await frameHash();
      await page.keyboard.press('p');
      await sleep(400);
      ok(await page.isVisible('#path-overlay') && (await canvasInk(page, '#path-overlay')) > 0.0005, 'P draws the camera path over the view');
      const on = await frameHash();
      ok(on === off, `a rendered frame is the same with the path on (${on} = ${off})`);
      await shot(page, 'overlays-path');
      await page.selectOption('#safe-frame-select', '9:16');
      await sleep(200);
      const sf = await page.evaluate(() => { const b = document.getElementById('safe-frame-box')!.getBoundingClientRect(), v = document.getElementById('viewport-box')!.getBoundingClientRect(); return { w: b.width, h: b.height, vh: v.height }; });
      ok(Math.abs(sf.w / sf.h - 9 / 16) < 0.01 && Math.abs(sf.h - sf.vh) < 1.5, `the 9:16 safe frame is ${Math.round(sf.w)} × ${Math.round(sf.h)}`);
      await shot(page, 'overlays-safe-frame');
      await page.selectOption('#safe-frame-select', '');
      await page.keyboard.press('p'); await page.keyboard.press('m');
    }

    if (want('url')) {
      await page.selectOption('#spline-preset-select', `house:${TWO}:orbit`);
      await sleep(200);
      await page.evaluate(() => { const i = (window as any).__houseUi.timeline.input; i.value = String(Math.round(0.4 * +i.max)); i.dispatchEvent(new Event('input')); });
      await page.click('#tod-seg [data-tod="dusk"]');
      await page.click('#btn-mode-review');
      await sleep(600);
      const q = await query(page);
      ok(q.house === TWO && q.shot === 'orbit' && Math.abs(+q.t - 0.4) < 1e-3 && q.lighting === 'dusk' && q.mode === 'review', `the URL follows: ${new URLSearchParams(q).toString()}`);
      const url = await page.evaluate(() => location.search);
      await c.close();
      c = await open(url.replace(/&?qa=1/, ''));
      const st = await state(c.page);
      const lit = await c.page.evaluate(() => (window as any).__houseLighting.preset);
      ok(st.shot === `house:${TWO}:orbit` && Math.abs(st.t - 0.4) < 1e-3 && lit === 'dusk' && st.mode === 'review', `a reload restores the home, the shot, t, the time of day and the mode (${st.shot}, ${st.t.toFixed(3)}, ${lit}, ${st.mode})`);
      ok((await c.page.title()).startsWith('S6 Editor Three Storeys'), `the title names the home ("${await c.page.title()}")`);
      await c.page.evaluate(() => (window as any).__houseUi.setUiMode('edit'));
      await c.page.click('#tod-seg [data-tod="auto"]');
    }
    const p2 = c.page;

    if (want('walls')) {
      const vis = () => p2.evaluate(() => { const v = (window as any).__houseVisibility, placed = (window as any).__houseUi.placed(); return { roofs: v.trackedRoofs.filter((r: any) => r.visible).length, roofN: v.trackedRoofs.length, layerHidden: placed.filter((o: any) => o.userData.layerHidden).length, ground: placed.filter((o: any) => o.userData.role === 'ground').every((o: any) => o.visible), upper: placed.filter((o: any) => o.userData.role === 'item' && o.position.y > 5).filter((o: any) => o.visible).length }; });
      await p2.keyboard.press('Escape');   // take the camera back from the shot (the editor's own dressing)
      await p2.click('#btn-wall-up'); await sleep(100);
      let v = await vis();
      ok(v.roofN > 0 && v.roofs === v.roofN, `Up shows the roofs (${v.roofs} of ${v.roofN})`);
      const floors = await p2.$$eval('#floor-layer-ctrl-group .btn-ctrl', (bs: Element[]) => bs.map(b => b.textContent!.trim()));
      ok(floors.join(',') === 'All,L1,L2,L3', `one floor button a storey (${floors.join(' ')})`);
      await p2.click('#floor-layer-ctrl-group [data-layer="0"]'); await sleep(100);
      v = await vis();
      ok(v.roofs === 0 && v.layerHidden > 0 && v.upper === 0 && v.ground, `L1 hides the storeys above and every roof, and keeps the world (${v.layerHidden} hidden)`);
      await p2.click('#btn-wall-cutaway'); await p2.click('#btn-wall-up'); await sleep(100);
      v = await vis();
      ok(v.roofs === 0, 'a wall mode change keeps the roofs off in a storey view');
      // a shot never sees the filter
      await p2.evaluate(() => { const i = (window as any).__houseUi.timeline.input; i.value = String(Math.round(0.5 * +i.max)); i.dispatchEvent(new Event('input')); });
      v = await vis();
      ok(v.layerHidden === 0, 'a shot\'s frame puts back what the floor filter hid');
      await p2.keyboard.press('Escape');
      v = await vis();
      ok(v.layerHidden > 0 && (await state(p2)).wallMode === 'up', 'taking the camera back re-applies the filter and the wall mode');
      await p2.click('#btn-layer-all'); await sleep(100);
      v = await vis();
      ok(v.layerHidden === 0 && v.roofs === v.roofN, 'All brings every storey and the roofs back (walls up)');
      await p2.click('#btn-wall-down'); await sleep(100);
      ok((await vis()).roofs === 0 && (await state(p2)).wallMode === 'down', 'Down hides the roofs');
      await p2.click('#btn-cam-top'); await sleep(200);
      await p2.click('#btn-wall-up'); await sleep(100);
      ok((await vis()).roofs === 0 && (await state(p2)).plan, 'Plan view hides the roofs, whatever the wall mode');
      await shot(p2, 'walls-plan-view');
      await p2.click('#btn-cam-iso'); await sleep(100);
      ok((await vis()).roofs > 0, 'leaving Plan puts them back');
      await p2.click('#btn-wall-cutaway');
    }

    if (want('catalog')) {
      if (!(await p2.isVisible('#catalog-search-input'))) await p2.click('#tab-devices');   // below 1440 px the panel folds into the rail
      await p2.fill('#catalog-search-input', 'sofa');
      await sleep(150);
      const hits = await p2.$$eval('#catalog-items-list .catalog-item-card', (els: Element[]) => els.map(e => e.textContent!.trim()));
      ok(hits.some(h => /sectional/i.test(h)) && hits.length <= 3, `the search finds across categories, the house catalog's props too ("sofa": ${hits.join(', ')})`);
      await p2.fill('#catalog-search-input', 'zzz');
      await sleep(100);
      ok(await p2.isVisible('#catalog-empty'), 'the search says when nothing matches');
      await p2.fill('#catalog-search-input', '');
      await p2.click('#tod-seg [data-tod="night"]');
      ok((await p2.evaluate(() => (window as any).__houseLighting.preset)) === 'night', 'the time of day follows the control');
      await p2.fill('#slider-sun-bearing', '90');
      await p2.dispatchEvent('#slider-sun-bearing', 'input');
      const sun = await p2.evaluate(() => (window as any).__houseLighting.sun);
      await p2.click('#tod-seg [data-tod="auto"]');
      const home = await p2.evaluate(() => [(window as any).__houseLighting.preset, (window as any).__houseDebug().house.spec.lighting]);
      ok(home[0] === home[1] && Array.isArray(sun), `"Own" puts the home's own time of day back (${home[0]}); the sun turns (${sun.map((v: number) => v.toFixed(2)).join(', ')})`);
      await p2.fill('#slider-sun-bearing', '0'); await p2.dispatchEvent('#slider-sun-bearing', 'input');
    }

    if (want('outliner')) {
      await p2.click('#btn-mode-edit').catch(() => {});
      await p2.fill('#outliner-search', ''); await sleep(150);
      const groups: string[] = await p2.$$eval('#scene-outliner-box [role="treeitem"][aria-level="1"]', (els: Element[]) => els.map(e => (e.textContent || '').trim().replace(/\s+/g, ' ')));
      ok(groups.length >= 3 && groups.some(g => /Ground/i.test(g)) && groups.some(g => /Lot and world/.test(g)), `the scene is a tree of storeys: ${groups.join(' · ')}`);
      ok((await p2.$$eval('#scene-outliner-box [tabindex="0"]', (els: Element[]) => els.length)) === 1, 'the tree is one tab stop (roving focus), not one for every part');
      await p2.fill('#outliner-search', 'sofa'); await sleep(200);
      const rows: string[] = await p2.$$eval('#scene-outliner-box .outliner-item', (els: Element[]) => els.map(e => (e.textContent || '').trim()));
      ok(rows.length === 1 && /sectional/i.test(rows[0]) && (await p2.$$eval('#scene-outliner-box [aria-expanded="true"]', (els: Element[]) => els.length)) >= 2, `the search narrows the tree and opens what it finds (${rows.join(', ')})`);
      await p2.fill('#outliner-search', ''); await sleep(150);
      // a part picked in the scene shows in the tree, its groups opened
      await p2.evaluate(() => { const u = (window as any).__houseUi; u.select(u.placed().find((o: any) => o.userData.generated && o.userData.room && o.userData.role === 'item')); });
      await sleep(300);
      const sel = await p2.$$eval('#scene-outliner-box .outliner-item[aria-selected="true"]', (els: Element[]) => els.length);
      ok(sel === 1, 'a part picked in the scene is selected in the tree, its room opened');
      // keys: ← closes a group, → opens it, ↓ moves on, Enter selects; none of it steps the film or plays it
      await p2.evaluate(() => (window as any).__houseUi.select(null)); await sleep(200);
      const t0 = (await state(p2)).t;
      await p2.focus('#scene-outliner-box [data-key="L0"]');
      await p2.keyboard.press('ArrowLeft'); await sleep(100);
      const closed = await p2.getAttribute('#scene-outliner-box [data-key="L0"]', 'aria-expanded');
      await p2.keyboard.press('ArrowRight'); await sleep(100);
      const opened = await p2.getAttribute('#scene-outliner-box [data-key="L0"]', 'aria-expanded');
      await p2.keyboard.press('ArrowDown'); await p2.keyboard.press('ArrowDown'); await p2.keyboard.press('ArrowRight');
      await sleep(100);
      const row = await p2.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('role'));
      ok(closed === 'false' && opened === 'true' && row === 'treeitem', `← closes a group, → opens it, ↓ moves on (${closed}, ${opened}, ${row})`);
      await p2.keyboard.press('Enter'); await p2.keyboard.press('Space');
      await sleep(150);
      const after = await state(p2);
      ok(Math.abs(after.t - t0) < 1e-9 && !after.playing, 'the tree\'s keys stay in the tree: they do not step or play the film');
      await p2.evaluate(() => (window as any).__houseUi.select(null));
    }

    if (want('props')) {
      if (!(await p2.isVisible('#catalog-search-input'))) await p2.click('#tab-devices');
      await p2.click('#tab-props');
      await p2.waitForFunction(() => document.querySelectorAll('#catalog-items-list .catalog-item-card').length > 100, null, { timeout: 20000 });
      const n = await p2.$$eval('#catalog-items-list .catalog-item-card', (els: Element[]) => els.length);
      ok(n >= 150, `the house catalog is the fifth tab (${n} props)`);
      await p2.fill('#catalog-search-input', 'lamp'); await sleep(200);
      const heads: string[] = await p2.$$eval('#catalog-items-list .catalog-group-h', (els: Element[]) => els.map(e => e.textContent || ''));
      ok(heads.includes('Props') && heads.includes('Devices'), `a search reads the props too (${heads.join(', ')})`);
      await p2.fill('#catalog-search-input', 'wingback'); await sleep(200);
      const n0 = await p2.evaluate(() => (window as any).__houseUi.placed().length);
      await p2.click('#catalog-items-list .catalog-item-card >> nth=0'); await sleep(250);
      const added = await p2.evaluate(() => { const u = (window as any).__houseUi, o = u.selected(); return { n: u.placed().length, name: o && o.name, gen: o && o.userData.generated }; });
      ok(added.n === n0 + 1 && /wingback/i.test(added.name) && !added.gen, `a prop from the house catalog is placed and is the person's own (${added.name})`);
      await p2.keyboard.press('ControlOrMeta+z');
      // a prop whose metadata says it stands against a wall is set against the nearest outside wall, facing in
      const snap = await p2.evaluate(() => { const u = (window as any).__houseUi; return { n: u.wallSnap({ x: 0.2, z: -2.6 }, 0, [1.0, 0.8]), e: u.wallSnap({ x: 3.7, z: 0.3 }, 0, [1.0, 0.6]), far: u.wallSnap({ x: 0, z: 0 }, 0, [1, 1]) }; });
      ok(snap.n && Math.abs(snap.n.z - (-3.88 + 0.4)) < 0.06 && Math.abs(snap.n.rotY) < 1e-6 && Math.abs(snap.n.x - 0.2) < 1e-6, `against the north wall: back to it, facing south (z ${snap.n && snap.n.z.toFixed(2)}, turn ${snap.n && snap.n.rotY.toFixed(2)})`);
      ok(snap.e && Math.abs(snap.e.x - (4.88 - 0.3)) < 0.06 && Math.abs(snap.e.rotY + Math.PI / 2) < 1e-6, `against the east wall: facing west (x ${snap.e && snap.e.x.toFixed(2)}, turn ${snap.e && snap.e.rotY.toFixed(2)})`);
      ok(snap.far === null, 'mid-room, nothing to set it against');
      await p2.fill('#catalog-search-input', '');
    }

    if (want('photo')) {
      const frameHash = () => p2.evaluate(async () => { const w = window as any; const info = w.__houseRenderBegin({ shot: 'door-to-core', res: '360', fps: 30 }); await w.__houseComposerWarm({ res: '360' }); w.__houseRenderFrames(60, 1, null); const gl = w.__houseDebug().renderer.getContext(); const px = new Uint8Array(info.w * info.h * 4); gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px); w.__houseRenderEnd(); const d = await crypto.subtle.digest('SHA-256', px); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16); });
      const off = await frameHash();
      await p2.setInputFiles('#ref-file', path.join(ROOT, 'portal', 'previews', 'aurora.jpg'));
      await p2.waitForFunction(() => { const i = document.getElementById('ref-img') as HTMLImageElement; return i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
      const vis = await p2.evaluate(() => ({ overlay: !(document.getElementById('ref-overlay') as HTMLElement).hidden, panel: !(document.getElementById('ref-panel') as HTMLElement).hidden, pressed: document.getElementById('btn-ref-photo')!.getAttribute('aria-pressed'), src: (document.getElementById('ref-img') as HTMLImageElement).src.slice(0, 5) }));
      ok(vis.overlay && vis.panel && vis.pressed === 'true' && vis.src === 'blob:', 'a photo chosen from a file lies over the view, as a local object URL (never saved)');
      await p2.evaluate(() => { const i = document.getElementById('ref-wipe') as HTMLInputElement; i.value = '40'; i.dispatchEvent(new Event('input')); });
      const clip = await p2.evaluate(() => getComputedStyle(document.getElementById('ref-img')!).clipPath);
      ok(/inset\(0(px)? (\d+(\.\d+)?px|\d+%) 0(px)? 0(px)?\)/.test(clip), `the wipe clips it from the right (${clip})`);
      const on = await frameHash();
      ok(on === off, `a rendered frame is the same with the photo on (${on} = ${off})`);
      await shot(p2, 'photo-overlay');
      await p2.click('#ref-remove');
      ok(await p2.evaluate(() => (document.getElementById('ref-overlay') as HTMLElement).hidden && !(document.getElementById('ref-img') as HTMLImageElement).getAttribute('src')), 'Remove takes it away');
    }

    if (want('edit')) {
      const n0 = await p2.evaluate(() => (window as any).__houseUi.placed().length);
      await p2.evaluate(() => { const u = (window as any).__houseUi; u.select(u.placed().find((o: any) => o.userData.generated && o.userData.role === 'item')); });
      await p2.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await p2.keyboard.press('Backspace');
      await sleep(200);
      const n1 = await p2.evaluate(() => (window as any).__houseUi.placed().length);
      ok(n1 === n0 && (await p2.evaluate(() => !!(window as any).__houseUi.selected()?.parent)), 'Backspace on a home\'s own part does nothing');
      ok(await p2.isDisabled('#btn-delete-selected'), 'the delete button is off for a home\'s own part');
      if (!(await p2.isVisible('#catalog-items-list'))) await p2.click('#tab-devices');
      await p2.click('#tab-interiors');
      await p2.click('#catalog-items-list .catalog-item-card >> nth=0');
      await sleep(200);
      const n2 = await p2.evaluate(() => (window as any).__houseUi.placed().length);
      ok(n2 === n0 + 1, 'the catalog adds an item');
      const r0 = await p2.evaluate(() => { const o = (window as any).__houseUi.selected(); let m: any; o.traverse((c: any) => { if (!m && c.isMesh) m = c.material; }); return m.roughness; });
      await p2.fill('#slider-roughness', '0.9');   // (fill fires input and change, as a drag does)
      const rough = () => p2.evaluate(() => { const o = (window as any).__houseUi.selected(); let m: any; o.traverse((c: any) => { if (!m && c.isMesh) m = c.material; }); return m.roughness; });
      ok(Math.abs((await rough()) - 0.9) < 1e-6, 'the roughness slider edits the selection');
      await p2.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await p2.keyboard.press('ControlOrMeta+z');
      ok(Math.abs((await rough()) - r0) < 1e-6, `undo restores the edit (roughness ${r0})`);
      ok(Number(await p2.inputValue('#slider-roughness')) === Math.round(r0 * 20) / 20 || Math.abs(Number(await p2.inputValue('#slider-roughness')) - r0) < 0.03, 'the slider shows the selection\'s own value');
      await p2.keyboard.press('ControlOrMeta+z');
      ok((await p2.evaluate(() => (window as any).__houseUi.placed().length)) === n0, 'undo takes the added item away again');
      await p2.keyboard.press('ControlOrMeta+Shift+z');
      ok((await p2.evaluate(() => (window as any).__houseUi.placed().length)) === n0 + 1, 'redo brings it back');
      await p2.keyboard.press('ControlOrMeta+d');
      ok((await p2.evaluate(() => (window as any).__houseUi.placed().length)) === n0 + 2 && /copy/.test(await p2.textContent('#inspector-selected-details')), 'Ctrl/Cmd D duplicates (and the inspector and the outliner show the copy)');
      await p2.keyboard.press('Delete');
      ok((await p2.evaluate(() => (window as any).__houseUi.placed().length)) === n0 + 1, 'Delete deletes what you added');
      await shot(p2, 'edit-selection');
    }

    if (want('modes')) {
      await p2.click('#btn-mode-review'); await sleep(300);
      const r = await p2.evaluate(() => ({ cat: !!(document.getElementById('catalog') as HTMLElement).offsetParent, tools: !!(document.querySelector('.transform-gizmo-hud') as HTMLElement).offsetParent, cards: document.querySelectorAll('.shot-card').length }));
      ok(!r.cat && !r.tools && r.cards >= 4, `Review hides the catalog and the tools, and lists the shots (${r.cards} cards)`);
      await shot(p2, 'mode-review');
      await p2.click('#btn-mode-edit'); await sleep(300);
      ok(await p2.isVisible('.transform-gizmo-hud'), 'Edit brings the tools back');
    }

    if (want('picker')) {
      await p2.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await p2.keyboard.press('g');
      await sleep(300);
      ok(await p2.isVisible('#gallery-dialog'), 'G opens the home picker');
      const all = await p2.$$eval('#gallery-grid .rc-home-card', (els: Element[]) => els.length);
      await p2.keyboard.type('mirage');
      await sleep(150);
      const hits = await p2.$$eval('#gallery-grid .rc-home-card', (els: Element[]) => els.map(e => e.querySelector('.rc-home-name')!.textContent));
      ok(all === 30 && hits.length === 1, `the picker lists the 30 homes and searches them ("mirage": ${hits.join(', ')})`);
      await shot(p2, 'picker');
      await p2.keyboard.press('ArrowDown');
      await p2.keyboard.press('Enter');
      await p2.waitForFunction(() => document.documentElement.dataset.houseReady === 'mirage', null, { timeout: 120000 });
      await sleep(500);
      const q = await query(p2);
      ok(q.house === 'mirage' && /Mirage/.test(await p2.title()) && /Mirage/.test(await p2.textContent('#house-picker-name')), `the keyboard opens a home; the URL (${q.house}), the title and the picker follow`);
    }
    noErrors(c, 'in the editor');
    await c.close();
  }

  // ---------------------------------------------------------------- drawers at 768
  if (want('drawers')) {
    console.log('\ndrawers 768 × 1024');
    const c = await open(`?house=${ONE}`, { width: 768, height: 1024 });
    await c.page.click('#btn-toggle-inspector');
    await sleep(350);
    const d = await c.page.evaluate(() => { const r = document.getElementById('inspector')!.getBoundingClientRect(); return { open: document.getElementById('inspector')!.dataset.drawer, x: r.right, iw: innerWidth, scrim: !!(document.getElementById('drawer-scrim') as HTMLElement).offsetParent }; });
    ok(d.open === 'open' && Math.abs(d.x - d.iw) < 1 && d.scrim, 'the inspector opens as a drawer over the viewport');
    await shot(c.page, 'drawers-768-inspector');
    await c.page.click('#drawer-scrim', { position: { x: 20, y: 400 } });
    await sleep(300);
    ok(!(await c.page.getAttribute('#inspector', 'data-drawer')), 'the scrim closes it');
    noErrors(c, '(drawers)');
    await c.close();
  }

  // ---------------------------------------------------------------- the top bar, at every width
  if (want('topbar')) {
    console.log('\ntopbar');
    const c = await open(`?house=${ONE}`, { width: 1280, height: 800 });
    const { page } = c;
    const bad: string[] = [];
    for (const mode of ['edit', 'review']) for (const w of [360, 390, 430, 520, 600, 640, 700, 768, 820, 900, 1000, 1100, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.evaluate((m: string) => (window as any).__houseUi.setUiMode(m), mode);
      await sleep(200);
      const r = await page.evaluate(() => {
        const hdr = document.querySelector('header')!;
        const kids = Array.from(hdr.querySelectorAll(':scope > *')).filter(e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.display !== 'none' && !e.classList.contains('topbar-spacer'); });
        const name = (e: Element) => (e as HTMLElement).id || String((e as HTMLElement).className).split(' ')[0];
        const rects = kids.map(e => ({ n: name(e), b: e.getBoundingClientRect() }));
        const over: string[] = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i].b, b = rects[j].b; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) over.push(`${rects[i].n}×${rects[j].n}`); }
        return { over, cut: rects.filter(x => x.b.right > innerWidth + 0.5 || x.b.left < -0.5).map(x => x.n), spill: kids.filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'hidden').map(name), sw: hdr.scrollWidth - hdr.clientWidth };
      });
      if (r.over.length || r.cut.length || r.spill.length || r.sw > 0) bad.push(`${mode} ${w}: ${JSON.stringify(r)}`);
    }
    ok(bad.length === 0, `the top bar never overlaps, is cut off or spills, from 360 to 1440 px in Edit and Review${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
    noErrors(c, '(top bar)');
    await c.close();
  }

  // ---------------------------------------------------------------- accessibility: contrast, targets, the phone's dialogs
  if (want('a11y')) {
    // The contrast of every text against what is really behind it: hide every glyph, screenshot, and sample the pixels
    // under each text box; the ratio is the text's colour (with its own alpha and its ancestors' opacity) over the worst
    // sampled background. What is covered by a dialog, a drawer or its scrim is not on screen and is skipped.
    const lum = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const failing = async (page: any) => {
      const els = await page.evaluate(() => {
        const out: any[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const t = (n.textContent || '').trim(); if (!t) continue;
          const el = n.parentElement!;
          if (!el || el.closest('.rc-sr, script, style, [hidden], option, [inert]')) continue;
          let hidden = false, op = 1;
          for (let a: Element | null = el; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) { hidden = true; break; } op *= +cs.opacity; }
          if (hidden) continue;
          const range = document.createRange(); range.selectNodeContents(n); const r = range.getBoundingClientRect();
          if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.left > innerWidth || r.top > innerHeight) continue;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2, top = document.elementFromPoint(cx, cy);
          if (!top || !(el.contains(top) || top.contains(el))) continue;
          // scrolled out of a panel that clips it: not on screen
          let clipped = false;
          for (let a = el.parentElement; a && a !== document.body && !clipped; a = a.parentElement) {
            const s = getComputedStyle(a);
            if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
            const ar = a.getBoundingClientRect();
            if (cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom) clipped = true;
          }
          if (clipped) continue;
          const cs = getComputedStyle(el);
          out.push({ t: t.slice(0, 32), x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, op, disabled: !!el.closest(':disabled, [disabled], [aria-disabled="true"]') });
        }
        return out;
      });
      const style = await page.addStyleTag({ content: '*{color:transparent !important;text-shadow:none !important;-webkit-text-fill-color:transparent !important;caret-color:transparent !important}' });
      const png = decodePNG(await page.screenshot());
      await style.evaluate((e: HTMLElement) => e.remove());
      const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/)!; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
      const bad: string[] = [];
      for (const e of els) {
        if (e.disabled) continue;   // WCAG exempts an inactive control
        const [r, g, b, a0] = parse(e.color), a = a0 * e.op;
        const x0 = Math.max(0, Math.floor(e.x)), y0 = Math.max(0, Math.floor(e.y)), x1 = Math.min(png.width - 1, Math.ceil(e.x + e.w)), y1 = Math.min(png.height - 1, Math.ceil(e.y + e.h));
        let worst = 99;
        for (let y = y0; y <= y1; y += Math.max(1, Math.floor((y1 - y0) / 4))) for (let x = x0; x <= x1; x += Math.max(1, Math.floor((x1 - x0) / 12))) {
          const i = (y * png.width + x) * 4, br = png.data[i], bg = png.data[i + 1], bb = png.data[i + 2];
          const l1 = lum(r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)), l2 = lum(br, bg, bb);
          worst = Math.min(worst, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
        }
        const large = e.size >= 24 || (e.size >= 18.66 && e.weight >= 700);
        if (worst < (large ? 3 : 4.5)) bad.push(`"${e.t}" ${worst.toFixed(2)}`);
      }
      return { bad, n: els.length };
    };
    for (const scheme of ['dark', 'light'] as const) {
      console.log(`\na11y 1280 × 800 ${scheme}`);
      const c = await open(`?house=${TWO}`, { width: 1280, height: 800 }, scheme);
      const { page } = c;
      for (const mode of ['edit', 'review']) {
        await page.evaluate((m: string) => (window as any).__houseUi.setUiMode(m), mode);
        await sleep(300);
        const r = await failing(page);
        ok(r.bad.length === 0, `${mode}: ${r.n} texts all meet WCAG AA contrast against what is drawn behind them${r.bad.length ? ': ' + r.bad.slice(0, 6).join(' | ') : ''}`);
        const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role="tab"], [role="treeitem"]')).filter(e => { const el = e as HTMLElement; if (getComputedStyle(el).visibility === 'hidden') return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false; if (el.closest('[hidden], [inert], .rc-sr') || /rc-tl-mark/.test(String(el.className))) return false; return r.width < 23.5 || r.height < 23.5; }).map(e => `${(e as HTMLElement).id || (e as HTMLElement).className} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
        ok(small.length === 0, `${mode}: every control is at least 24 × 24 px (WCAG 2.5.8)${small.length ? ': ' + small.slice(0, 5).join(', ') : ''}`);
      }
      const tabs = await page.$$eval('#scene-outliner-box [role="treeitem"]', (els: Element[]) => els.filter(e => (e as HTMLElement).tabIndex >= 0).length);
      ok(tabs <= 1, `the scene outliner is ${tabs} tab stop`);
      noErrors(c, `(a11y ${scheme})`);
      await c.close();
    }
    // the dialogs' own buttons are whole on a phone (the top bar's icon-only rule once squashed them)
    console.log('\na11y 390 × 844: the dialogs');
    const c = await open(`?house=${ONE}`, { width: 390, height: 844 });
    for (const [open_, dlg, primary] of [['#btn-open-export', '#export-dialog', '#btn-confirm-download-png'], ['#btn-open-video-export', '#video-dialog', '#btn-start-record-video']]) {
      await c.page.click(open_);
      await sleep(400);
      const m = await c.page.evaluate(([d, p]: string[]) => { const b = document.querySelector(p) as HTMLElement, r = b.getBoundingClientRect(), dr = (document.querySelector(d) as HTMLElement).getBoundingClientRect(); return { w: r.width, sw: b.scrollWidth, cw: b.clientWidth, inside: r.left >= dr.left - 1 && r.right <= dr.right + 1, text: (b.textContent || '').trim() }; }, [dlg, primary]);
      ok(m.sw <= m.cw + 1 && m.inside && m.w > 90, `${dlg}: "${m.text}" is whole on a phone (${Math.round(m.w)} px)`);
      await c.page.keyboard.press('Escape'); await sleep(200);
    }
    // a still's preview is a picture once it is drawn, and a spinner before, never a broken-image caption
    await c.page.click('#btn-open-export');
    await c.page.waitForFunction(() => { const i = document.getElementById('export-preview-img') as HTMLImageElement; return !i.hidden && i.complete && i.naturalWidth > 0; }, null, { timeout: 60000 });
    ok(await c.page.evaluate(() => (document.getElementById('export-preview-wait') as HTMLElement).hidden), 'the still\'s preview replaces its "drawing" note when it is there');
    noErrors(c, '(a11y phone)');
    await c.close();
  }

  // ---------------------------------------------------------------- compare homes
  if (want('compare')) {
    console.log('\ncompare');
    const c = await open(`?house=${ONE}&shot=orbit&t=0.3`, { width: 1280, height: 800 });
    const { page } = c;
    const before = await state(page);
    await page.click('#btn-house-picker');
    await page.click('#gallery-compare');
    await sleep(300);
    ok(await page.isVisible('#compare-dialog') && (await page.$$eval('#compare-grid .rc-compare-card', (els: Element[]) => els.length)) === 30, 'the picker opens Compare homes: 30 homes, none drawn yet');
    ok((await page.inputValue('#compare-shot')) === 'orbit' && Math.abs(Number(await page.inputValue('#compare-t')) - 30) <= 1, 'it starts from the shot and the moment on screen');
    await page.evaluate(() => (window as any).__houseUi.compare.run(['aurora', 'mirage']));
    const cards = await page.$$eval('#compare-grid .rc-compare-card', (els: HTMLElement[]) => els.filter(e => e.dataset.state === 'done').map(e => ({ name: e.querySelector('.rc-home-name')!.textContent, w: (e.querySelector('img') as HTMLImageElement).naturalWidth, src: (e.querySelector('img') as HTMLImageElement).src.slice(-60) })));
    ok(cards.length === 2 && cards.every(k => k.w === 640) && cards[0].src !== cards[1].src, `two posters drawn at 640 × 360 and different (${cards.map(k => k.name).join(', ')})`);
    await shot(page, 'compare');
    const after = await state(page), q = await query(page);
    ok(q.house === ONE && after.shot === before.shot && Math.abs(after.t - before.t) < 1e-3, `the editor's home is back at its shot and moment (${q.house}, ${after.shot}, ${after.t.toFixed(3)})`);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#compare-sheet')]);
    const file = path.join(SHOTS, 'compare-sheet.png'); await dl.saveAs(file);
    const png = decodePNG(fs.readFileSync(file));
    ok(png.width > 1000 && png.height > 250 && /^homes-orbit-.*at-30-.*\.png$/.test(dl.suggestedFilename()), `the sheet saves as one PNG (${png.width} × ${png.height}, ${dl.suggestedFilename()})`);
    await page.keyboard.press('Escape'); await sleep(200);
    noErrors(c, '(compare)');
    await c.close();
  }

  // ---------------------------------------------------------------- still export
  if (want('still')) {
    console.log('\nstill');
    const c = await open(`?house=${ONE}`, { width: 1280, height: 800 });
    const { page } = c;
    const exportOne = async (aspect: string, res: string, bg: string) => {
      await page.click('#btn-open-export');
      await page.click(`#export-aspect-seg [data-aspect="${aspect}"]`);
      await page.selectOption('#export-res-select', res);
      await page.selectOption('#export-bg-select', bg);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#btn-confirm-download-png')]);
      const file = path.join(SHOTS, `still-${aspect.replace(':', 'x')}-${res}-${bg}.png`);
      await dl.saveAs(file);
      return { file, name: dl.suggestedFilename(), png: decodePNG(fs.readFileSync(file)) };
    };
    const a = await exportOne('16:9', '2160', 'scene');
    ok(a.png.width === 3840 && a.png.height === 2160 && !/:/.test(a.name) && /-dusk-/.test(a.name), `4K 16:9 is ${a.png.width} × ${a.png.height} (${a.name})`);
    const b = await exportOne('9:16', '2160', 'scene');
    ok(b.png.width === 2160 && b.png.height === 3840, `4K 9:16 is ${b.png.width} × ${b.png.height}`);
    const t = await exportOne('16:9', '1080', 'transparent');
    let clear = 0, solid = 0;
    for (let i = 3; i < t.png.data.length; i += 4) { if (t.png.data[i] === 0) clear++; else if (t.png.data[i] === 255) solid++; }
    ok(t.png.width === 1920 && clear > 0.05 * t.png.width * t.png.height && solid > 0.05 * t.png.width * t.png.height, `a transparent cutout has an alpha channel (${Math.round(100 * clear / (t.png.width * t.png.height))} % clear)`);
    const after = await page.evaluate(() => { const r = (window as any).__houseDebug().renderer, v = document.getElementById('viewport-box')!.getBoundingClientRect(); return { cw: r.domElement.clientWidth, vw: Math.round(v.width), bg: !!(window as any).__houseDebug().scene.background }; });
    ok(Math.abs(after.cw - after.vw) <= 1 && after.bg, 'the viewport is its own size again after, with its sky');
    noErrors(c, '(still)');
    await c.close();
  }

  // ---------------------------------------------------------------- record
  if (want('record')) {
    console.log('\nrecord');
    {
      // Cancel: a film stopped part-way leaves the page as it found it, and nothing downloads
      const c = await open(`?house=${ONE}`, { width: 1280, height: 800 });
      const { page } = c;
      let downloaded = 0; page.on('download', () => { downloaded++; });
      const before = await page.evaluate(() => { const r = (window as any).__houseDebug().renderer; return [r.domElement.clientWidth, r.domElement.clientHeight]; });
      await page.click('#btn-open-video-export');
      await page.selectOption('#video-res-select', '720');
      await page.selectOption('#video-fps-select', '30');
      await page.click('#btn-start-record-video');
      await page.waitForSelector('.rc-toast-progress .rc-toast-btn', { timeout: 60000 });
      await page.waitForFunction(() => /Frame \d+ of/.test(document.querySelector('.rc-toast-detail')?.textContent || ''), null, { timeout: 60000 });
      await page.click('.rc-toast-progress .rc-toast-btn');
      await page.waitForFunction(() => /cancelled/i.test(document.getElementById('toasts')!.textContent || ''), null, { timeout: 30000 });
      await page.waitForFunction(() => !(document.getElementById('workspace') as any).inert, null, { timeout: 10000 });
      await sleep(400);
      const after = await page.evaluate(() => { const r = (window as any).__houseDebug().renderer; return { size: [r.domElement.clientWidth, r.domElement.clientHeight], recording: (window as any).__houseUi.state().recording, bar: !!document.querySelector('.rc-toast-progress') }; });
      ok(downloaded === 0 && !after.bar && !after.recording && after.size[0] === before[0] && after.size[1] === before[1], `Cancel stops the film: no file, no progress note, the page is not locked and the viewport is ${after.size.join(' × ')} again`);
      noErrors(c, '(record cancel)');
      await c.close();
    }
    const has = (b: string) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0;
    if (!has('ffmpeg') || !has('ffprobe')) ok(false, 'ffmpeg and ffprobe are installed (the recording is checked with them)');
    else {
      const c = await open(`?house=${ONE}`, { width: 1280, height: 800 });
      const { page } = c;
      await page.click('#btn-open-video-export');
      await page.selectOption('#video-spline-preset-sync', `house:${ONE}:door-to-core`);
      await page.selectOption('#video-res-select', '720');
      await page.selectOption('#video-aspect-select', '16:9');
      await page.selectOption('#video-fps-select', '30');
      await page.waitForFunction(() => /frames · H\.264|frames · VP9/.test(document.getElementById('video-summary')!.textContent!), null, { timeout: 20000 });
      const summary = await page.textContent('#video-summary');
      ok(/^1280 × 720 · 30 fps · 12\.00 s · 360 frames · H\.264 in MP4/.test(summary), `the dialog says what comes out: ${summary}`);
      await shot(page, 'record-dialog');
      const t0 = Date.now();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 900000 }), page.click('#btn-start-record-video')]);
      const file = path.join(os.tmpdir(), `vh-ui-${process.pid}.mp4`);
      await dl.saveAs(file);
      const rec = await page.evaluate(() => { const r = (window as any).__lastRecording; return { name: r.name, frames: r.frames, fps: r.fps, duration: r.duration, kind: r.kind, codec: r.codec, hashes: r.frameHashes, w: r.width, h: r.height }; });
      console.log(`    recorded in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${rec.name} (${rec.codec})`);
      ok(rec.kind === 'h264' && /\.mp4$/.test(rec.name) && !/:/.test(rec.name), `H.264 in an MP4 named ${rec.name}`);
      const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);
      const v = probe.streams[0];
      ok(v.codec_name === 'h264' && Number(v.nb_read_frames) === 360 && v.width === 1280 && v.height === 720, `ffprobe: ${v.codec_name}, ${v.nb_read_frames} frames, ${v.width} × ${v.height}`);
      ok(Math.abs(Number(probe.format.duration) - 12) <= 1 / 30 + 1e-6, `ffprobe: ${probe.format.duration} s (12.00 ± 1 frame)`);
      // the frames as __houseRenderFrames draws them, raw off the GL context
      const idx = [0, 90, 180, 270, 359];
      const raw: Array<{ i: number; b64: string }> = await page.evaluate(async (ids: number[]) => {
        const w = window as any, out: any[] = [];
        const info = w.__houseRenderBegin({ shot: 'door-to-core', res: '720', aspect: '16:9', fps: 30 });
        await w.__houseComposerWarm({ res: '720', aspect: '16:9' });
        const gl = w.__houseDebug().renderer.getContext(), px = new Uint8Array(info.w * info.h * 4);
        for (const i of ids) {
          w.__houseRenderFrames(i, 1, null);
          gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let s = ''; for (let k = 0; k < px.length; k += 8192) s += String.fromCharCode.apply(null, px.subarray(k, k + 8192) as any);
          out.push({ i, b64: btoa(s) });
        }
        w.__houseRenderEnd();
        return out;
      }, idx);
      const W = 1280, H = 720;
      const decode = (i: number) => spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${i}),scale=in_color_matrix=auto:in_range=auto,format=rgba`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 64 << 20 }).stdout as Buffer;
      for (const { i, b64 } of raw) {
        const px = Buffer.from(b64, 'base64');
        const hash = crypto.createHash('sha256').update(px).digest('hex').slice(0, 16);
        const dec = decode(i);
        let se = 0, n = 0;
        for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4, dst = y * W * 4; for (let x = 0; x < W * 4; x += 4) for (let k = 0; k < 3; k++) { const d = px[src + x + k] - dec[dst + x + k]; se += d * d; n++; } }
        const psnr = 10 * Math.log10(255 * 255 / (se / n));
        ok(hash === rec.hashes[i] && dec.length === W * H * 4 && psnr >= 40, `frame ${i}: hashed before encoding as __houseRenderFrames draws it (${hash}), decodes at ${psnr.toFixed(1)} dB`);
      }
      fs.rmSync(file, { force: true });
      noErrors(c, '(record)');
      await c.close();
    }
  }
} catch (err) {
  failures++;
  console.error(`\n\x1b[31m${(err as Error).stack || err}\x1b[0m`);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed · screenshots in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
process.exit(failures ? 1 : 0);
