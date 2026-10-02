#!/usr/bin/env -S node --experimental-strip-types
// Live check for the sky and the glass (assets/viewer-sky.ts, assets/realism-sky.ts, assets/viewer-glass.ts).
// @check-house skip — a live-player check on the real GPU, run by `pnpm run test:live` (realism-core's runner) or by hand:
//   node --experimental-strip-types scripts/live-checks/sky.mts [--houses aurora,lakecabin] [--seam-max 2]
// It opens the player (?mode=view) in Chromium on the real GPU, installs the sky through the registry's own feature
// module, and checks four things:
//   1. restore identity — after restore() (what viewer.beforeExternalRender calls) scene.background, scene.environment and
//      scene.environmentIntensity are the page's own objects and values again, the dome is out of the scene, and a plain
//      render of the same camera is pixel-identical to the one taken before the sky existed; apply() brings it back;
//      `?no=sky` installs nothing; Best quality (setHq) hands the page's sky back and takes it up again.
//   2. the horizon seam — the dome's colours against the page's own backdrop function (skyEquirect, below 'backdrop', the
//      function installSkyFog fogs toward): CIE76 colour difference per preset over the band 0 to 5 degrees above the
//      horizon and over the whole ground half, away from the sun (>= 70 degrees round the sky), must stay under --seam-max.
//   3. caching — a time-of-day switch seen before is a pointer swap (no bake), an unseen one bakes once after the debounce,
//      a burst of lighting events bakes once, and the environment swap compiles at most the dome's and the bakers' programs.
//   4. the glass — the swap (createGlassSwap) patches the panes, restore() takes every trace of the patch off again.
import path from 'node:path'; import crypto from 'node:crypto'; import { spawnSync } from 'node:child_process';
import { ROOT, openPlayer, installSky, settle } from './lib/sky-harness.mts';

const args: Record<string, string> = {};
process.argv.slice(2).forEach((x, i, v) => { if (x.startsWith('--')) args[x.slice(2)] = v[i + 1] && !v[i + 1].startsWith('--') ? v[i + 1] : 'true'; });
const HOUSES = (args.houses || 'aurora,lakecabin').split(',');
const SEAM_MAX = Number(args['seam-max'] || 2);
const PRESETS = ['day', 'golden', 'dusk', 'night'];

/** `pnpm run test:live` imports this file: run the standalone check in a child process and report its ok / FAIL lines */
export default async function check(env: { ROOT: string }): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', import.meta.filename], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 1800000, cwd: env.ROOT });
  const out: { name: string; ok: boolean; detail?: string }[] = [];
  for (const line of (r.stdout || '').split('\n')) { const m = /^(ok  |FAIL) (.*)$/.exec(line); if (m) out.push({ name: m[2].trim(), ok: m[1] === 'ok  ' }); }
  if (r.status !== 0 && !out.some(o => !o.ok)) out.push({ name: `sky live check exited ${r.status}`, ok: false, detail: (r.stderr || r.stdout || '').slice(-300) });
  if (!out.length) out.push({ name: 'sky live check printed nothing', ok: false });
  return out;
}
if (path.resolve(process.argv[1] || '') === import.meta.filename) await standalone();

async function standalone(): Promise<void> {
const { loadPlaywright, LAUNCH_ARGS, serve } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));
const pw = await loadPlaywright();
const srv = await serve(ROOT, '/');
const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
let fails = 0;
const ok = (cond: any, what: string, detail = '') => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${detail ? '  ' + detail : ''}`); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// the pixels of one plain render of the player's scene with the player's camera, as a hash (same task as the render,
// so the drawing buffer is still there)
const RENDER_HASH = () => {
  const w: any = window, dbg = w.__houseDebug();
  dbg.renderer.render(dbg.scene, dbg.camera);
  const c = document.createElement('canvas'); const src = document.querySelector('canvas') as HTMLCanvasElement;
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619) >>> 0;
  return h.toString(16);
};

try {
  // ---- ?no=sky installs nothing -------------------------------------------------------------------------------------------
  {
    const { page, errors } = await openPlayer(browser, srv.origin, HOUSES[0], { dpr: 1 });
    const r = await installSky(page, { tier: 1, no: ['sky'] });
    ok(r.installed === false, '?no=sky: the feature installs nothing');
    ok(errors.filter(e => !/favicon|Failed to load resource/.test(e)).length === 0, 'no page errors on load', errors.slice(0, 2).join(' | '));
    await page.context().close();
  }

  for (const house of HOUSES) {
    console.log(`\n== ${house}`);
    const { page, errors } = await openPlayer(browser, srv.origin, house, { dpr: 1 });
    const setTod = async (t: string) => { await page.click(`.vh-chip-tod[data-tod="${t}"]`); await settle(page, 3); };

    // ---- 1. restore identity, per preset ---------------------------------------------------------------------------------
    for (const tod of PRESETS) {
      // what the page does before an offline render: hand the sky back. The page then re-lights with its own pointers.
      await page.evaluate(() => { const h = (window as any).__sky; if (h) h.restore(); });
      await setTod(tod);
      const before = await page.evaluate(() => {
        const w: any = window, dbg = w.__houseDebug(), s = dbg.scene;
        w.__pageSky = { bg: s.background, env: s.environment, inten: s.environmentIntensity };
        return { inten: s.environmentIntensity };
      });
      const hashBefore = await page.evaluate(`(${RENDER_HASH.toString()})()`);
      if (tod === PRESETS[0]) await installSky(page, { tier: 1, apply: false });
      const res = await page.evaluate(async (hashFn: string) => {
        const w: any = window, s = w.__houseDebug().scene, h = w.__sky;
        // the page's own pointers right now (the player was re-lit by the chip click above)
        w.__pageSky = { bg: s.background, env: s.environment, inten: s.environmentIntensity };
        h.apply(); h.sync();
        const live = { dome: !!s.getObjectByName('Sky dome'), envSwapped: s.environment !== w.__pageSky.env, bgSwapped: s.background !== w.__pageSky.bg, inten: s.environmentIntensity };
        const hashSky = (0, eval)(hashFn)();
        h.restore();
        const back = { bg: s.background === w.__pageSky.bg, env: s.environment === w.__pageSky.env, inten: s.environmentIntensity === w.__pageSky.inten, dome: !!s.getObjectByName('Sky dome') };
        let stray = 0; s.traverse((o: any) => { if (o.userData && o.userData.liveSky) stray++; });
        const hashAfter = (0, eval)(hashFn)();
        h.apply();
        return { live, back, stray, hashSky, hashAfter, again: !!s.getObjectByName('Sky dome') };
      }, `(${RENDER_HASH.toString()})`);
      ok(res.live.dome && res.live.bgSwapped, `${tod}: apply() puts the dome in and swaps the background`);
      ok(res.live.envSwapped, `${tod}: apply() swaps the environment`, `intensity ${before.inten.toFixed(3)} -> ${res.live.inten.toFixed(3)} (x${(res.live.inten / before.inten).toFixed(3)})`);
      ok(res.back.bg && res.back.env && res.back.inten && !res.back.dome && res.stray === 0, `${tod}: restore() gives the page's background, environment and strength back, dome gone`);
      ok(res.hashAfter === hashBefore, `${tod}: a plain render after restore() is pixel-identical to the one before the sky existed`, `${hashBefore} / ${res.hashAfter}`);
      ok(res.hashSky !== hashBefore, `${tod}: the sky changes the picture while on`);
      ok(res.again, `${tod}: apply() after restore() puts the dome back`);
    }

    // ---- Best quality hands the page's sky back --------------------------------------------------------------------------
    {
      const r = await page.evaluate(() => {
        const w: any = window, s = w.__houseDebug().scene, h = w.__sky;
        const page0 = { bg: s.background, env: s.environment };
        h.setHq(true);
        const off = !s.getObjectByName('Sky dome') && s.environment !== null;
        h.setHq(false);
        return { off, on: !!s.getObjectByName('Sky dome'), moved: page0.env !== s.environment };
      });
      ok(r.off && r.on, 'setHq(true) takes the dome out, setHq(false) puts it back');
    }

    // ---- 2. the horizon seam ---------------------------------------------------------------------------------------------
    for (const tod of PRESETS) {
      await setTod(tod); await sleep(300);
      const seam = await page.evaluate(async () => {
        const w: any = window, T = w.__THREE, h = w.__sky, L = w.__houseLighting;
        const env: any = await import('/assets/environment.js' as string);
        const W = 512, H = 256;
        const probe = h.probe(W, H);
        if (!probe) return null;
        // the old backdrop, with the page's own function and the page's own look handling
        const p0 = env.TIME_OF_DAY[L.preset], sun = L.sun;
        const old = env.skyEquirect(T, p0, sun, { width: W, height: H, below: 'backdrop' });
        const half = T.DataUtils.fromHalfFloat;
        // CIE76 on linear sRGB clipped to 0..1
        const lab = (r: number, g: number, b: number) => {
          const c = (v: number) => Math.min(1, Math.max(0, v));
          r = c(r); g = c(g); b = c(b);
          const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
          const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
          return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
        };
        const sd = new T.Vector3(sun[0], sun[1], sun[2]).normalize();
        let bandMax = 0, bandSum = 0, bandN = 0, gndMax = 0, gndSum = 0, gndN = 0, nearSunMax = 0;
        for (let y = 0; y < H; y++) {
          const lat = ((y + 0.5) / H - 0.5) * Math.PI, elev = lat * 180 / Math.PI;
          if (elev > 5) continue;
          for (let x = 0; x < W; x++) {
            const phi = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
            const cosA = Math.cos(phi) * Math.cos(lat) * sd.x + Math.sin(lat) * sd.y + Math.sin(phi) * Math.cos(lat) * sd.z;
            const i = (y * W + x) * 4;
            const a = lab(probe.data[i], probe.data[i + 1], probe.data[i + 2]), b = lab(half(old.image.data[i]), half(old.image.data[i + 1]), half(old.image.data[i + 2]));
            const dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            if (cosA < Math.cos(70 * Math.PI / 180)) {
              if (elev >= 0) { bandMax = Math.max(bandMax, dE); bandSum += dE; bandN++; } else { gndMax = Math.max(gndMax, dE); gndSum += dE; gndN++; }
            } else nearSunMax = Math.max(nearSunMax, dE);
          }
        }
        old.dispose();
        return { bandMax, bandMean: bandSum / bandN, gndMax, gndMean: gndSum / gndN, nearSunMax };
      });
      ok(seam && seam.bandMax <= SEAM_MAX && seam.gndMax <= SEAM_MAX, `${tod}: horizon seam, dE76 max ${seam ? seam.bandMax.toFixed(2) : '?'} (0-5 deg band, mean ${seam ? seam.bandMean.toFixed(2) : '?'}), ground ${seam ? seam.gndMax.toFixed(2) : '?'} (mean ${seam ? seam.gndMean.toFixed(2) : '?'}), near the sun (the page's lobe plus the halo and disc) ${seam ? seam.nearSunMax.toFixed(1) : '?'}  [<= ${SEAM_MAX} away from the sun]`);
    }

    // ---- 3. caching ------------------------------------------------------------------------------------------------------
    {
      const c = await page.evaluate(async () => {
        const w: any = window, s = w.__houseDebug().scene, h = w.__sky, R = w.__houseDebug().renderer;
        const sleepP = (ms: number) => new Promise(r => setTimeout(r, ms));
        const set = (p: string) => w.__houseSetLighting(p);
        const out: any = {};
        // a fresh sky: install a second handle's worth of state by disposing and recreating the cache with the same module
        h.restore(); h.dispose();
        const mod: any = await import('/assets/realism-sky.js' as string);
        const h2 = await mod.feature.install(w.__skyCtx); w.__sky = h2;
        h2.apply();
        const prog0 = R.info.programs.length;
        await sleepP(300);
        const b0 = h2.stats().bakes;
        for (const p of ['day', 'golden', 'dusk', 'night']) { set(p); await sleepP(250); }
        out.firstPass = h2.stats().bakes - b0;                 // up to 4 bakes (one is the current preset's, already baked on apply)
        const b1 = h2.stats().bakes, hits1 = h2.stats().hits;
        // a revisit is a pointer swap in the same task as the lighting event
        set('day');
        const texNow = s.environment;
        out.sync = h2.stats().bakes === b1 && h2.stats().hits > hits1;
        await sleepP(200);
        out.noTimerBake = h2.stats().bakes === b1;
        set('night'); set('golden'); set('dusk'); set('day'); set('night'); set('day'); await sleepP(300);
        out.burstBakes = h2.stats().bakes - b1;
        // a burst of unseen suns bakes once, after the debounce
        const L0 = w.__houseLighting;
        const bb = h2.stats().bakes;
        for (let k = 0; k < 12; k++) window.dispatchEvent(new CustomEvent('house:lighting', { detail: { ...L0, sun: [0.5 + k * 0.01, 0.6, 0.3] } }));
        await sleepP(60);
        const midBakes = h2.stats().bakes - bb;
        await sleepP(400);
        out.stormBakes = h2.stats().bakes - bb; out.stormBefore = midBakes;
        out.cached = h2.stats().cached;
        // programs: the swap must not recompile the scene's materials (the dome and the bakers add a few)
        R.render(s, w.__houseDebug().camera);
        out.progDelta = R.info.programs.length - prog0;
        out.bakeMs = h2.stats().bakeMs; out.pmremMs = h2.stats().pmremMs; out.ratio = h2.stats().ratio;
        set('day'); await sleepP(200);
        return out;
      });
      ok(c.firstPass <= 4, `caching: the four times of day bake at most once each (${c.firstPass})`);
      ok(c.sync && c.noTimerBake, 'caching: a time of day seen before is a pointer swap (no bake, no timer)');
      ok(c.burstBakes === 0, `caching: six quick switches between baked times bake ${c.burstBakes}`);
      ok(c.stormBefore === 0 && c.stormBakes <= 1, `caching: twelve lighting events in a row bake ${c.stormBakes} (${c.stormBefore} before the debounce)`);
      ok(c.cached <= 4, `caching: at most 4 baked targets are kept (${c.cached})`);
      ok(c.progDelta <= 4, `programs: the environment swap and the dome add ${c.progDelta} programs (<= 4)`);
      console.log(`     last bake ${c.bakeMs.toFixed(1)} ms + PMREM ${c.pmremMs.toFixed(1)} ms, exposure ratio ${c.ratio.toFixed(3)}`);
    }

    // ---- 4. the glass patch and its undo ---------------------------------------------------------------------------------
    {
      // the player's own swap is on (viewer.ts applies it before the first frame): its panes carry the marker and the patch
      const g = await page.evaluate(() => {
        const w: any = window, s = w.__houseDebug().scene;
        const seen = new Set(); let n = 0, patched = 0, transmissive = 0;
        s.traverse((o: any) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !seen.has(m) && m.isMeshPhysicalMaterial) {
          seen.add(m);
          if (m.userData && m.userData.__glassOrig) { n++; if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) patched++; }
          else if (m.transmission > 0) transmissive++;
        } });
        return { n, patched, transmissive };
      });
      ok(g.n > 0 && g.patched === g.n && g.transmissive === 0, `glass: every swapped pane (${g.n}) carries the fresnel patch, none is left transmissive`, `patched ${g.patched}, transmissive ${g.transmissive}`);
    }
    {
      // restore() of the player's swap, through a real swap on a fresh scene object: transmission, colour and the patch all go
      const g = await page.evaluate(async () => {
        const w: any = window, T = w.__THREE;
        const mod: any = await import('/assets/viewer-glass.js' as string);
        const scene = new T.Scene();
        const m = new T.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.32, roughness: 0.06, transmission: 0.85 });
        scene.add(new T.Mesh(new T.PlaneGeometry(1, 1), m));
        const orig = { t: m.transmission, o: m.opacity, c: m.color.getHex() };
        const sw = mod.createGlassSwap(T, scene, true);
        sw.apply();
        const on = { t: m.transmission, patched: Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile'), key: typeof m.customProgramCacheKey === 'function' && /fresnel/.test(m.customProgramCacheKey()) };
        sw.restore();
        return { orig, on, off: { t: m.transmission, o: m.opacity, c: m.color.getHex(), own: Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') || Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') } };
      });
      ok(g.on.t === 0 && g.on.patched && g.on.key, 'glass: apply() zeroes transmission and patches the shader');
      ok(g.off.t === g.orig.t && g.off.o === g.orig.o && g.off.c === g.orig.c && !g.off.own, 'glass: restore() puts transmission, opacity, colour back and takes the patch off');
    }
    ok(errors.filter(e => !/favicon|Failed to load resource/.test(e)).length === 0, `${house}: no page errors or warnings`, errors.slice(0, 3).join(' | '));
    await page.context().close();
  }
} finally {
  await browser.close(); await srv.close();
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall sky checks passed');
process.exit(fails ? 1 : 0);
}
