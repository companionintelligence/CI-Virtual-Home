#!/usr/bin/env -S node --experimental-strip-types
// The player on the devices it is for: phones, tablets and desktops of every size the platform plan names, in light and dark, through the real
// built portal (dist/) in one Chromium. Per cell: the page does not scroll sideways, every control is a big enough target (44 px with a finger,
// 24 px with a mouse), the dock stays on the screen and its shot chips do not run under Play, the canvas's backing store is within the tier's
// drawing-buffer budget, the tier is the one the device row says, the viewport asks for the notch (viewport-fit=cover), there is no console error
// and no request to anyone but the page's own server. One screenshot per cell is kept for a person to look at.
// @check-house skip — needs the built dist and a GPU browser; run `pnpm run portal:build && pnpm run platform:test`
//
//   pnpm run portal:build && pnpm run platform:test [--dir dist] [--house cutestarter] [--shots test/platform] [--only iphone15,desktop-4k]
//
// NOT provable here: real iOS Safari (no matching Playwright WebKit is installed), real notch insets (env() is 0 in emulation), thermals, a real
// phone's GPU. The device's renderer is this machine's; the tier rows for real renderer strings are scripts/test-platform.mts.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from './portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
const DIR = path.resolve(args.dir || path.join(ROOT, 'dist'));
const HOUSE = args.house || 'cutestarter';
const SHOTS = path.resolve(args.shots || path.join(ROOT, 'test', 'platform'));
const ONLY = (args.only || '').split(',').filter(Boolean);
if (!fs.existsSync(path.join(DIR, 'index.html'))) { console.error(`no portal in ${DIR}: pnpm run portal:build`); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });

type Dev = { id: string; w: number; h: number; dpr: number; touch: boolean; family: 'mobile' | 'desktop' };
const DEVICES: Dev[] = [
  { id: 'iphone15', w: 393, h: 852, dpr: 3, touch: true, family: 'mobile' },
  { id: 'iphone-se', w: 375, h: 667, dpr: 2, touch: true, family: 'mobile' },
  { id: 'pixel8', w: 412, h: 915, dpr: 2.6, touch: true, family: 'mobile' },
  { id: 'galaxy-s23', w: 360, h: 780, dpr: 3, touch: true, family: 'mobile' },
  { id: 'phone-landscape', w: 844, h: 390, dpr: 3, touch: true, family: 'mobile' },
  { id: 'ipad-pro-portrait', w: 834, h: 1194, dpr: 2, touch: true, family: 'mobile' },
  { id: 'ipad-pro-landscape', w: 1194, h: 834, dpr: 2, touch: true, family: 'mobile' },
  { id: 'desktop-1280', w: 1280, h: 800, dpr: 1, touch: false, family: 'desktop' },
  { id: 'desktop-1440', w: 1440, h: 900, dpr: 2, touch: false, family: 'desktop' },
  { id: 'desktop-1080p', w: 1920, h: 1080, dpr: 1, touch: false, family: 'desktop' },
  { id: 'desktop-4k', w: 3840, h: 2160, dpr: 1, touch: false, family: 'desktop' },
  { id: 'ultrawide', w: 3440, h: 1440, dpr: 1, touch: false, family: 'desktop' },
];

const srv = await serve(DIR, '/ci-virtual-home/');
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });
let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };

for (const d of DEVICES) {
  if (ONLY.length && !ONLY.includes(d.id)) continue;
  for (const scheme of ['light', 'dark'] as const) {
    console.log(`${d.id} ${d.w}x${d.h} @${d.dpr} ${d.touch ? 'touch' : 'mouse'} ${scheme}`);
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, isMobile: d.touch, hasTouch: d.touch, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors: string[] = [], foreign: string[] = [];
    page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
    page.on('response', (r: any) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('request', (r: any) => { const u = r.url(); if (!u.startsWith(srv.origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u); });
    await stubGoogleFonts(page, srv.origin);
    await page.goto(srv.url(`room-creator.html?mode=view&house=${HOUSE}&play=0`), { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(({ touch }) => {
      const v: any = (window as any).__houseViewer, de = document.documentElement, cv = document.querySelector('canvas') as HTMLCanvasElement;
      const small: string[] = [];
      const min = touch ? 44 : 24;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.vh button, .vh a, .vh input[type="range"]'))) {
        const cs = getComputedStyle(el), b = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || b.width === 0 || b.height === 0 || el.closest('[hidden], [inert]')) continue;
        if (Math.min(b.width, b.height) + 0.5 < min) small.push(`${el.dataset.act || el.className} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      const dock = document.querySelector('.vh-dock')!.getBoundingClientRect();
      const chips = document.querySelector('.vh-row-chips')!.getBoundingClientRect(), play = document.querySelector('.vh-play')!.getBoundingClientRect();
      const overlapV = chips.bottom > play.top + 1 && chips.top < play.bottom - 1, overlapH = chips.right > play.left + 1 && chips.left < play.right - 1;
      return {
        overflowX: Math.max(de.scrollWidth, document.body.scrollWidth) - innerWidth, small,
        buffer: cv.width * cv.height, tier: v.platform && v.platform.tier, form: v.platform && v.platform.form, budget: v.platform && v.platform.budget,
        renderer: v.platform && v.platform.signals.gl.renderer,
        dockInside: dock.left >= -0.5 && dock.right <= innerWidth + 0.5 && dock.bottom <= innerHeight + 0.5,
        chipsClear: !(overlapV && overlapH),
        cover: /viewport-fit=cover/.test((document.querySelector('meta[name="viewport"]') as HTMLMetaElement).content),
        dataTier: de.dataset.tier, ratio: v.pixelRatio,
      };
    }, { touch: d.touch });
    const soft = /swiftshader|llvmpipe/i.test(r.renderer || '');
    const wantTier = d.family === 'mobile' || soft ? 'mobile-low' : 'desktop-high';
    ok(r.overflowX <= 0, `no horizontal overflow (${r.overflowX})`);
    ok(r.small.length === 0, `every control is at least ${d.touch ? 44 : 24} px${r.small.length ? ': ' + r.small.slice(0, 4).join(', ') : ''}`);
    ok(r.dockInside, 'the dock is inside the screen');
    ok(r.chipsClear, 'the shot chips do not run under Play');
    ok(r.cover, 'the viewport asks for the notch (viewport-fit=cover)');
    ok(r.tier === wantTier && r.dataTier === wantTier, `tier ${r.tier} (wanted ${wantTier}; ${r.form}, ratio ${r.ratio})`);
    ok(r.buffer <= r.budget.bufferMpx * 1e6 * 1.03, `canvas ${(r.buffer / 1e6).toFixed(2)} Mpx within ${r.budget.bufferMpx} Mpx`);
    ok(errors.length === 0, `no console error${errors.length ? ': ' + errors[0] : ''}`);
    ok(foreign.length === 0, `no third-party request${foreign.length ? ': ' + foreign[0] : ''}`);
    await page.screenshot({ path: path.join(SHOTS, `${d.id}-${scheme}.png`) });
    await ctx.close();
  }
}

// ---- WebGL context loss (defect P1): a PAUSED player stayed blank after a loss and a restore until any input arrived. Lose the context through
// WEBGL_lose_context, restore it 400 ms later, touch nothing, and look at the picture: it must be drawn again and be the one it was.
async function contextLossCell(query: string, label: string, assertDrawn: boolean): Promise<void> {
  if (ONLY.length && !ONLY.includes('context-loss')) return;
  console.log(`context loss ${label}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  await stubGoogleFonts(page, srv.origin);
  await page.goto(srv.url(`room-creator.html?mode=view&house=${HOUSE}&play=0${query}`), { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  // the picture as numbers: the canvas's own screenshot, decoded in the page (a screenshot is the compositor's view, so it sees a blank canvas as blank)
  const look = async () => {
    const png = (await page.locator('canvas').first().screenshot()).toString('base64');
    return page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 64; c.height = 40;
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0, 64, 40);
      return Array.from(g.getImageData(0, 0, 64, 40).data);
    }, png);
  };
  const spread = (a: number[]) => { let m = 0, v = 0, n = a.length / 4; for (let i = 0; i < a.length; i += 4) m += a[i] + a[i + 1] + a[i + 2]; m /= n * 3; for (let i = 0; i < a.length; i += 4) v += (a[i] + a[i + 1] + a[i + 2] - 3 * m) ** 2; return Math.sqrt(v / n / 3); };
  const before = await look();
  const verdict = await page.evaluate(() => new Promise<string>((res) => {
    const cv = document.querySelector('canvas') as HTMLCanvasElement, gl = cv.getContext('webgl2') as WebGL2RenderingContext, ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return res('no WEBGL_lose_context');
    let lost = false;
    cv.addEventListener('webglcontextlost', () => { lost = true; }, { once: true });
    ext.loseContext();
    setTimeout(() => { ext.restoreContext(); setTimeout(() => res(lost ? 'ok' : 'the context was never lost'), 400); }, 400);
  }));
  await page.waitForTimeout(1200);   // no input of any kind in between
  const after = await look();
  let diff = 0; for (let i = 0; i < before.length; i += 4) diff += (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2])) / 3;
  diff /= before.length / 4;
  const st = await page.evaluate(() => { const v: any = (window as any).__houseViewer; return v && v.platformState ? v.platformState() : null; });
  console.log(`  before: spread ${spread(before).toFixed(1)}; after: spread ${spread(after).toFixed(1)}, mean difference ${diff.toFixed(1)}/255; ${JSON.stringify(st)}`);
  ok(verdict === 'ok', `the context was lost and restored (${verdict})`);
  if (assertDrawn) {
    ok(spread(before) > 8, 'there was a picture to lose');
    ok(spread(after) > 8, 'the paused player drew itself again after the restore, without input');
    ok(diff < 14, `and it is the same picture (mean difference ${diff.toFixed(1)}/255)`);
    ok(st && st.restored >= 1 && st.lost >= 1, 'the platform block counted the loss and the restore');
    ok(errors.length === 0, `no console error${errors.length ? ': ' + errors[0] : ''}`);
    await page.screenshot({ path: path.join(SHOTS, 'context-restored.png') });
  } else console.log(`  (control, not asserted: ?no=platform is the player as it was; here the paused picture ${spread(after) <= 8 ? 'stayed blank' : diff < 14 ? 'came back the same' : 'came back different (the sky and glass were not rebuilt)'})`);
  await ctx.close();
}
await contextLossCell('', 'with the platform block', true);
await contextLossCell('&no=platform', 'control, ?no=platform', false);

await browser.close(); await srv.close();
console.log(`\nplatform matrix: ${passes} passed, ${failures} failed. Screenshots in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
process.exit(failures ? 1 : 0);
