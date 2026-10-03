#!/usr/bin/env -S node --experimental-strip-types
// pnpm run test:live: the live-player realism effects (assets/realism*.ts, viewer-*.ts), on the real GPU.
//
//   pnpm run test:live [--base <dir|auto|none>] [--houses aurora,cocoon,…] [--tods day,dusk,night] [--only <key>] [--quick]
//   --base    a checkout of the commit the player must still equal when every effect is off (BASE_SHA, a built tree:
//             pnpm install && pnpm run build). `auto` (default) makes a detached worktree of it under the temp dir and
//             builds it; `none` skips the comparison with it.
//   --only    run one package's scripts/live-checks/<key>.mts and nothing else (env.base is null unless --base is given too)
//   --quick   two houses, day only
//
// Built-in checks (every one is a hash of the player's canvas, drawn on this machine's GPU, so it is a comparison
// between two pages and never against a stored value):
//   a  kill-switch identity   ?no=realism draws the same pixels as BASE_SHA, for the houses × times of day
//   b  external-render identity  the page's __houseRender* hooks refuse in the player (VIEW_MODE), so the contract they
//      stand for is checked on the two functions behind them: with every effect on, viewer.external.before() leaves the
//      scene drawing the same pixels as ?no=realism at shot positions 0, 200/719 and 1 (and after() brings the effects back)
//   c  no console error, page error, shader-link error or GL warning on any page opened here
//   d  renderer.info.memory returns to its first value after switching homes there and back
//   e  git diff --quiet test/goldens/expected-diffs (the six ledgers stay as they are)
// then every scripts/live-checks/<key>.mts: `export default async function check(env): Promise<Result[]>`.
// @check-house skip — it needs a GPU and a second (built) tree of BASE_SHA and takes minutes: run pnpm run test:live after realism work
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, type Served } from './portal-lib.mts';

export const BASE_SHA = '03edd3b';
export type Result = { name: string; ok: boolean; detail?: string };
export type LivePage = {
  page: any;
  /** console errors, page errors, shader-link errors and GL warnings seen so far */
  errors: string[];
  /** window.__houseViewer.effects: tier, probe, installed features and their stats */
  effects(): Promise<any>;
  /** sha256 of the canvas after one draw of the scene by the page's renderer (what a plain frame is), in the same task */
  hash(): Promise<string>;
  /** the data URL behind hash(): one draw of the scene by the page's renderer, as a PNG (for a comparison with a tolerance) */
  pngUrl(): Promise<string>;
  /** sha256 of a screenshot of the canvas (the player's last frame, effects and all; the controls are hidden). NOT stable from run
   *  to run, even on one unchanged tree (what the last frame caught depends on timing: measured, three loads of 03edd3b gave
   *  three hashes), so use it to look, and hash() to compare. */
  shotHash(): Promise<string>;
  /** a PNG of the canvas to disk (for the look sheets) */
  save(file: string): Promise<void>;
  /** run a function in the page */
  eval<T = any>(fn: (...a: any[]) => T, ...a: any[]): Promise<T>;
  /** two animation frames and a beat: the player has drawn what was asked */
  settle(): Promise<void>;
  close(): Promise<void>;
};
export type LiveEnv = {
  ROOT: string;
  tree: Served;
  /** the BASE_SHA tree, when --base gave one */
  base: Served | null;
  /** open the player: house, hour and query (e.g. 'q=1&no=water'); of = 'base' opens BASE_SHA's tree */
  open(house: string, o?: { tod?: string; query?: string; shot?: string; t?: number; of?: 'tree' | 'base'; w?: number; h?: number; dpr?: number }): Promise<LivePage>;
  houses: string[];
  tods: string[];
};

const args = parseArgs(process.argv.slice(2));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const sha = (s: string | Buffer): string => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
/** two PNG data URLs compared pixel by pixel: how many pixels differ and by how many levels at most */
async function pngDiff(a: string, b: string): Promise<{ n: number; total: number; max: number }> {
  const { decodePNG } = await import('./vendor/png.mjs');
  const A = decodePNG(Buffer.from(a.slice(a.indexOf(',') + 1), 'base64')), B = decodePNG(Buffer.from(b.slice(b.indexOf(',') + 1), 'base64'));
  if (A.width !== B.width || A.height !== B.height) return { n: Infinity, total: A.width * A.height, max: 255 };
  let n = 0, max = 0;
  for (let i = 0; i < A.width * A.height; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.data[i * 4 + c] - B.data[i * 4 + c]));
    if (d) { n++; if (d > max) max = d; }
  }
  return { n, total: A.width * A.height, max };
}
// check (b)'s tolerance: a restored page whose shader programs carry a patch the killed page's do not (the frame package's spot
// clip, restored to "off" but still compiled in) may differ by one level in a handful of pixels (frame.mts measures 2e-4 %).
const RESTORE_TOL = { fraction: 1e-4, levels: 2 };
const NOISE = /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL|Failed to load resource: net::ERR_FAILED.*fonts\./;

async function main(): Promise<number> {
  const playwright = await loadPlaywright();
  const quick = args.quick === 'true';
  const houses = (args.houses || (quick ? 'aurora,cocoon' : 'aurora,cocoon,lakecabin,mirage,vanilla')).split(',').filter(Boolean);
  const tods = (args.tods || (quick ? 'day' : 'day,dusk,night')).split(',').filter(Boolean);
  const only = args.only && args.only !== 'true' ? args.only : '';

  // ---- the trees
  let baseDir: string | null = null, madeBase = false;
  const wantBase = (args.base || (only ? 'none' : 'auto')) !== 'none';   // (--only skips the BASE_SHA tree unless --base asks for it)
  if (wantBase) {
    if (args.base && args.base !== 'auto' && args.base !== 'true') baseDir = path.resolve(args.base);
    else {
      baseDir = path.join(os.tmpdir(), `ci-virtual-home-base-${BASE_SHA}`);
      if (!fs.existsSync(path.join(baseDir, 'assets', 'viewer.js'))) {
        console.log(`# making a ${BASE_SHA} tree at ${baseDir} (once; pnpm install + build)`);
        if (!fs.existsSync(baseDir)) execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', baseDir, BASE_SHA], { stdio: 'inherit' });
        execSync('pnpm install --frozen-lockfile --prefer-offline && pnpm run build', { cwd: baseDir, stdio: 'inherit' });
        madeBase = true;
      }
    }
  }
  const tree = await serve(ROOT, '/');
  const base = baseDir ? await serve(baseDir, '/') : null;
  const browser = await playwright.chromium.launch({ args: LAUNCH_ARGS });
  const allErrors: string[] = [];
  const pages: LivePage[] = [];

  // The first page a fresh Chromium draws through the transmission pass (glass restored) comes out a few pixels different
  // from every page after it (same tree, same query; measured), so one sacrificial page does that first and is closed.
  let warmed = false;
  const env: LiveEnv = {
    ROOT, tree, base, houses, tods,
    async open(house, o = {}) {
      if (!warmed) {
        warmed = true;
        const w = await env.open(house, { query: 'no=realism' });
        await w.eval(() => (window as any).__houseViewer.external.before());
        await w.hash(); await w.close();
        pages.pop();
      }
      const srv = o.of === 'base' ? base : tree;
      if (!srv) throw new Error('no --base tree to open');
      const ctx = await browser.newContext({ viewport: { width: o.w || 1280, height: o.h || 720 }, deviceScaleFactor: o.dpr || 1 });
      const page = await ctx.newPage();
      const errors: string[] = [];
      const keep = (s: string) => { if (!NOISE.test(s)) { errors.push(s); allErrors.push(`${house}${o.query ? ` ?${o.query}` : ''}: ${s}`); } };
      page.on('console', (m: any) => {
        const t = m.type(), text = m.text();
        if (t === 'error') keep(`console: ${text.slice(0, 240)}`);
        else if (t === 'warning' && /GL|shader|WebGL|THREE\.WebGLProgram|program/i.test(text)) keep(`warning: ${text.slice(0, 240)}`);
      });
      page.on('pageerror', (e: any) => keep(`pageerror: ${String(e && e.message).slice(0, 240)}`));
      await stubGoogleFonts(page, srv.origin);
      const q = new URLSearchParams({ mode: 'view', house, play: '0' });
      if (o.shot) q.set('shot', o.shot);
      if (o.t !== undefined) q.set('t', String(o.t));
      if (o.tod) q.set('tod', o.tod);
      const url = `${srv.url('room-creator.html')}?${q.toString()}${o.query ? `&${o.query}` : ''}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000 });
      if ((await page.evaluate(() => document.documentElement.dataset.viewer)) !== 'ready') throw new Error(`the player did not open ${house}`);
      const lp: LivePage = {
        page, errors,
        effects: () => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__houseViewer.effects || null))),
        settle: async () => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(250); },
        pngUrl: () => page.evaluate(() => {
          const d = (window as any).__houseDebug(), r = d.renderer;
          r.render(d.scene, d.camera);
          return r.domElement.toDataURL('image/png') as string;   // same task as the draw: the drawing buffer is still there
        }),
        hash: async () => sha(await lp.pngUrl()),
        shotHash: async () => {
          await page.addStyleTag({ content: '.vh{visibility:hidden !important}' });
          return sha(await page.locator('canvas').first().screenshot());
        },
        save: async (file) => { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.addStyleTag({ content: '.vh{visibility:hidden !important}' }); await page.locator('canvas').first().screenshot({ path: file }); },
        eval: (fn, ...a) => page.evaluate(fn as any, ...a),
        close: async () => { await ctx.close(); },
      };
      pages.push(lp);
      await lp.settle();
      return lp;
    },
  };

  const results: Result[] = [];
  const add = (name: string, ok: boolean, detail?: string) => { results.push({ name, ok, detail }); console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };
  const section = (s: string) => console.log(`\n${s}`);
  const setTod = (lp: LivePage, tod: string) => lp.eval((t: string) => (window as any).__houseSetLighting(t), tod).then(() => lp.settle());
  const t0 = Date.now();
  console.log(`# test:live  ${new Date().toISOString()}  uptime ${execSync('uptime').toString().trim()}\n# houses ${houses.join(',')}  tods ${tods.join(',')}  base ${baseDir || 'none'}`);

  try {
    if (!only) {
      // ---- a. kill-switch identity against BASE_SHA
      section('a. ?no=realism draws what ' + BASE_SHA + ' drew');
      if (!base) console.log('  (skipped: --base none)');
      else for (const h of houses) {
        const mine = await env.open(h, { query: 'no=realism' });
        const ref = await env.open(h, { of: 'base' });
        try {
          for (const tod of tods) {
            await setTod(mine, tod); await setTod(ref, tod);
            const [x, y] = [await mine.hash(), await ref.hash()];
            add(`${h} ${tod}`, x === y, x === y ? x.slice(0, 8) : `${x.slice(0, 8)} vs ${y.slice(0, 8)}`);
          }
        } finally { await mine.close(); await ref.close(); }
      }

      // ---- b. restore is exact
      section('b. the effects restore exactly (what beforeExternalRender / afterExternalRender do)');
      for (const h of houses) {
        const on = await env.open(h, { query: 'q=2' });
        const off = await env.open(h, { query: 'no=realism' });
        try {
          const refuses = await on.eval(() => { try { (window as any).__houseRenderBegin({ shot: 'orbit' }); return false; } catch { return true; } });
          add(`${h}: the offline hooks refuse in the player`, refuses);
          for (const k of [0, 200 / 719, 1]) {
            for (const lp of [on, off]) await lp.eval((t: number) => { const s = document.querySelector('.vh-scrub input') as HTMLInputElement; s.value = String(Math.round(t * 1000)); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, k);
            await on.settle(); await off.settle();
            await on.eval(() => (window as any).__houseViewer.external.before());
            await off.eval(() => (window as any).__houseViewer.external.before());
            // a restore that had to undo the static batch leaves the scene unbatched (what a product frame draws): the killed page is
            // put in the same state, since merged and unmerged meshes may differ in the last bit of a vertex
            const unbatched = await on.eval(() => !(window as any).__houseViewer.batch);
            const undid = unbatched && await off.eval(() => { const v = (window as any).__houseViewer; if (!v.batch) return false; v.batchOn(false); return true; });
            const [pa, pb] = [await on.pngUrl(), await off.pngUrl()];
            if (undid) await off.eval(() => (window as any).__houseViewer.batchOn(true));
            await on.eval(() => (window as any).__houseViewer.external.after());
            await off.eval(() => (window as any).__houseViewer.external.after());
            const [x, y] = [sha(pa), sha(pb)];
            if (x === y) add(`${h}: t=${k.toFixed(3)} restored equals killed`, true, x.slice(0, 8));
            else {
              const d = await pngDiff(pa, pb), frac = d.n / d.total;
              add(`${h}: t=${k.toFixed(3)} restored equals killed${undid ? ' (both unbatched)' : ''}`, frac <= RESTORE_TOL.fraction && d.max <= RESTORE_TOL.levels, `${x.slice(0, 8)} vs ${y.slice(0, 8)}: ${d.n} of ${d.total} pixels differ (${(frac * 100).toExponential(1)} %), by at most ${d.max} levels; tolerance ${RESTORE_TOL.fraction * 100} % and ${RESTORE_TOL.levels}`);
            }
          }
        } finally { await on.close(); await off.close(); }
      }

      // ---- d. memory returns after switching homes
      section('d. renderer.info.memory returns to baseline after switching homes');
      {
        const lp = await env.open(houses[0], { query: 'q=2&no=accum' });   // (an accumulation run holds two targets for its first seconds)
        try {
          const mem = () => lp.eval(() => { const m = (window as any).__houseDebug().renderer.info.memory; return { geometries: m.geometries, textures: m.textures }; });
          await sleep(3500);   // (the features' downloads land after the first frame; a swap frees the procedural textures it replaces)
          const m0 = await mem();
          const name = () => lp.eval(() => document.querySelector('.vh-name')!.textContent);
          for (const key of [']', ']', '[', '[']) {
            const before = await name();
            await lp.page.keyboard.press(key);
            await lp.page.waitForFunction((n: string | null) => document.documentElement.dataset.viewer === 'ready' && document.querySelector('.vh-name')!.textContent !== n, before, { timeout: 120000 });
            await lp.settle();
          }
          await sleep(3500);
          const m1 = await mem();
          add('geometries and textures back to the first load', m1.geometries === m0.geometries && m1.textures === m0.textures, `${m0.geometries}/${m0.textures} → ${m1.geometries}/${m1.textures}`);
        } finally { await lp.close(); }
      }
    }

    // ---- every package's own checks
    const dir = path.join(ROOT, 'scripts', 'live-checks');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.mts') && (!only || f === `${only}.mts`)).sort();
    for (const f of files) {
      section(`${f.replace(/\.mts$/, '')}  (scripts/live-checks/${f})`);
      try {
        const mod = await import(pathToFileURL(path.join(dir, f)).href);
        if (typeof mod.default !== 'function') { add(`${f}: no default export`, false); continue; }
        for (const r of (await mod.default(env)) as Result[]) add(r.name, r.ok, r.detail);
      } catch (err) { add(`${f} threw`, false, String((err as Error)?.message || err).slice(0, 300)); }
    }
  } finally {
    await browser.close();
    await tree.close(); if (base) await base.close();
  }

  if (!only) {
    // ---- c. the console stayed clean on every page opened above
    section('c. no console errors, page errors, shader-link errors or GL warnings');
    add(`${pages.length} pages opened`, allErrors.length === 0, allErrors.length ? `${allErrors.length}: ${allErrors.slice(0, 3).join(' | ')}` : undefined);
    // ---- e. the ledgers
    section('e. the golden ledgers are untouched');
    let clean = true;
    try { execFileSync('git', ['-C', ROOT, 'diff', '--quiet', 'HEAD', '--', 'test/goldens/expected-diffs']); } catch { clean = false; }
    add('git diff --quiet test/goldens/expected-diffs', clean);
  }
  void madeBase;
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length ? `\x1b[31m${failed.length} failed\x1b[0m, ` : ''}${results.length - failed.length} passed in ${Math.round((Date.now() - t0) / 1000)} s`);
  return failed.length ? 1 : 0;
}

process.exit(await main());
