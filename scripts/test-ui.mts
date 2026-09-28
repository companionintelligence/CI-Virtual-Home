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
  const needMain = ['hooks', 'qa', 'transport', 'overlays', 'url', 'walls', 'catalog', 'edit', 'picker', 'modes'].some(want);
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
      ok(hits.length === 1 && /sectional/i.test(hits[0]), `the search finds across categories ("sofa": ${hits.join(', ')})`);
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
