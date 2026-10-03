// Shared by the sky live check and by the look/perf captures: open the live player in Chromium on the real GPU WITHOUT the
// registry's features (?no=sky,ao,water,…: those would change the picture between two renders) and install the sky feature by hand (assets/realism-sky.ts's `feature.install(ctx)`), so a
// check can hold the page's plain picture, the handle and the order of events. The page's own frame loop keeps running;
// this adds only the context the feature asks for. (Lives in lib/ so test:live does not run it as a check.)
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export type Opened = { page: any; ctx: any; errors: string[] };

export async function openPlayer(browser: any, origin: string, house: string, { query = '', dpr = 1, width = 1280, height = 720 } = {}): Promise<Opened> {
  const { stubGoogleFonts } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push('pageerror ' + e.message.split('\n')[0]));
  page.on('console', (m: any) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await stubGoogleFonts(page, origin);
  const OTHERS = 'sky,ao,water,grass,assets,frame';   // (every registry feature: the harness installs the sky itself; the glass's fresnel stays on, it is part of what is checked)
  const q = /(^|&)no=/.test(query) ? query.replace(/(^|&)no=/, `$1no=${OTHERS},`) : (query ? query + '&' : '') + `no=${OTHERS}`;
  await page.goto(`${origin}/room-creator.html?mode=view&house=${house}&shot=orbit&play=0&${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000 });
  return { page, ctx, errors };
}

// Install the sky in the open player. Returns when the feature has applied. `window.__sky` is the handle.
export async function installSky(page: any, { tier = 1, no = [] as string[], apply = true } = {}): Promise<any> {
  return page.evaluate(async ({ tier, no, apply }: any) => {
    const w = window as any;
    const dbg = w.__houseDebug();
    const url: string = '/assets/realism-sky.js';   // (a variable: tsc must not resolve it, it is the page's module)
    const mod: any = await import(url);
    const house = new URLSearchParams(location.search).get('house') || 'aurora';
    const ctx = {
      THREE: w.__THREE, scene: dbg.scene, renderer: dbg.renderer, camera: dbg.camera,
      no: new Set(no), tier: () => tier, houseId: () => house,
      lighting: () => w.__houseLighting,
      onLighting: (cb: (d: any) => void) => { const f = (e: any) => cb(e.detail); window.addEventListener('house:lighting', f); return () => window.removeEventListener('house:lighting', f); },
      markDirty: () => { document.dispatchEvent(new Event('fullscreenchange')); },
      now: () => performance.now() / 1000,
    };
    const handle = await mod.default.install(ctx);
    w.__sky = handle; w.__skyCtx = ctx;
    if (!handle) return { installed: false };
    if (apply) handle.apply();
    const loop = (ms: number) => { if (w.__sky === handle) { try { handle.tick(0, ms / 1000, ctx.camera); } catch { /* */ } requestAnimationFrame(loop); } };
    requestAnimationFrame(loop);
    return { installed: true, stats: handle.stats() };
  }, { tier, no, apply });
}

export const settle = (page: any, n = 3) => page.evaluate((n: number) => new Promise<void>(r => { const f = (i: number) => i <= 0 ? r() : requestAnimationFrame(() => f(i - 1)); f(n); }), n);
