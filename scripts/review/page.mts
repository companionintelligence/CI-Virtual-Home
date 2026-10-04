// One browser session on one house, set up the way every determinism-sensitive capture in this repo is (CLAUDE.md, Determinism):
// the pinned macOS Metal profile, Google Fonts stubbed with assets/fonts/ and awaited, the composer warmed after houseReady (SMAA's
// lookups decode asynchronously), supersample 2. Used by capture.mts, cost.mts, test-build-neutrality.mts and check-prop-drift.mts.
//
// A cold browser's first context renders a hair differently (scripts/test-frame-hash.mts), so `openHouse` can be told to burn a
// throwaway context first (`warm: true`): one frame of THE SAME house through a cold pipeline, never kept, as test-fixtures.mts does.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, loadPlaywright, stubGoogleFonts } from '../portal-lib.mts';

/** the tree the page is served from: this checkout, or REVIEW_SERVE_ROOT (a copy with a deliberate change in it: how the rig proves it can see one) */
export const SERVE_ROOT = process.env.REVIEW_SERVE_ROOT ? path.resolve(process.env.REVIEW_SERVE_ROOT) : ROOT;

export const PROFILE = { name: 'macos-metal', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] };

export interface Session {
  srv: Awaited<ReturnType<typeof serve>>;
  browser: any;
  version: string;
  open: (house: string, opts?: OpenOpts) => Promise<House>;
  /** the editor with no house loaded (the prop sheet's page): enough to build any type alone with `__houseBuilderRef.buildProp` */
  openBare: () => Promise<House>;
  close: () => Promise<void>;
}
export interface OpenOpts { /** serve this JSON file in place of content/houses/<house>.json for this page (a composed copy; the repo file is never touched) */ spec?: string; query?: string; res?: string; tod?: string | null; warmFrame?: boolean; viewport?: { width: number; height: number }; composer?: boolean }
export interface House { page: any; ctx: any; errors: string[]; house: string; close: () => Promise<void> }

export async function startSession(): Promise<Session> {
  const srv = await serve(SERVE_ROOT, '/');
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: PROFILE.args });
  const version = browser.version();
  async function open(house: string, o: OpenOpts = {}): Promise<House> {
    const { query = '', res = '720', tod = null, viewport = { width: 1600, height: 900 }, composer = true } = o;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message.split('\n')[0]));
    await stubGoogleFonts(page, srv.origin);
    if (o.spec) { const body = fs.readFileSync(path.resolve(o.spec), 'utf8'); await page.route((u: URL) => u.pathname.endsWith(`/content/houses/${house}.json`), (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body })); }
    await page.goto(srv.url(`room-creator.html?house=${encodeURIComponent(house)}${query ? '&' + query.replace(/^&/, '') : ''}`), { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
    await page.evaluate(async () => {
      const want = ['Manrope', 'Plus Jakarta Sans', 'JetBrains Mono'];
      await Promise.all(want.map(f => document.fonts.load(`16px "${f}"`).catch(() => {})));
      await document.fonts.ready;
    });
    if (tod) await page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
    if (composer) await page.evaluate((r: string) => { (window as any).__houseSupersample = 2; return (window as any).__houseComposerWarm({ res: r }); }, res);
    return { page, ctx, errors, house, close: () => ctx.close() };
  }
  async function openBare(): Promise<House> {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message.split('\n')[0]));
    await stubGoogleFonts(page, srv.origin);
    await page.goto(srv.url('room-creator.html'), { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => typeof (window as any).__housePropSheet === 'function' && !!(window as any).__houseBuilderRef, null, { timeout: 240000 });
    return { page, ctx, errors, house: '', close: () => ctx.close() };
  }
  return { srv, browser, version, open, openBare, close: async () => { await browser.close(); await srv.close(); } };
}

/** run a throwaway context on `house` and let one composed frame through it, so the kept context does not meet a cold shader pipeline */
export async function burnColdContext(s: Session, house: string, res = '720') {
  const w = await s.open(house, { res });
  try { await w.page.evaluate((r: string) => (window as any).__houseSnapshot({ res: r, quality: 0.5 }), res); } finally { await w.close(); }
}

/** the rooms of the loaded house as the page sees them (the spec's, with the storey's y) */
export async function roomsOf(page: any): Promise<Array<{ li: number; lv: string; y: number; name: string; program: string | null; b: { x: number; z: number; w: number; d: number } }>> {
  return page.evaluate(() => {
    const d = (window as any).__houseDebug(), s = d.house.spec;
    return s.levels.map((lv: any, li: number) => (lv.rooms || []).map((r: any) => ({ li, lv: lv.id, y: lv.y || 0, name: r.name, program: r.program || null, b: { x: r.bounds.x, z: r.bounds.z, w: r.bounds.w, d: r.bounds.d } }))).flat();
  });
}

export const here = (...p: string[]) => path.join(ROOT, ...p);
