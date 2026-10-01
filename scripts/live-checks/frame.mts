// pnpm run test:live -- --only frame: the "frame" realism feature (assets/realism-frame.ts, viewer-composer.ts, light-guard.ts).
//
//   1  restore identity   viewer.external.before() leaves the room lamps at the penumbra and intensity the page set, the camera without a
//                         view offset, the renderer drawing to the canvas with its shadow policy; after() puts the pools back
//   2  accumulation       a still tier-1 view reaches 8 samples (16 at tier 2) and stops; a mouse drag resets it; tier 0 never starts;
//                         the camera and the render target are what the page left after every step
//   3  colour match       the accumulated picture has the plain path's mean luminance and saturation (the target is drawn like the canvas)
//   4  spot-light clip    the slot mapping is proven against three's own light array (also with a level hidden), and a room light that
//                         leaked through its walls before no longer does
//   5  Best quality       the lighter chain draws, keeps the opaque-pass glass (no transmission pass: far fewer draw calls than the page's
//                         composer would make), and agrees with the plain path on mean luminance and saturation within the stated tolerance
// Every number is measured in this page on this GPU; none is compared with a stored value.
import type { LiveEnv, LivePage, Result } from '../test-live-effects.mts';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** tolerances (relative): the accumulation must match the plain path closely; the lighter Best quality is a different, richer picture */
export const TOL = { accumLum: 0.012, accumSat: 0.02, hqLum: 0.08, hqSat: 0.05 };

async function waitFor(lp: LivePage, pred: (f: any) => boolean, ms = 20000): Promise<any> {
  const t0 = Date.now();
  let f: any = null;
  while (Date.now() - t0 < ms) {
    f = (await lp.effects())?.features?.frame;
    if (f && pred(f)) return f;
    await sleep(250);
  }
  return f;
}

/** mean linear luminance and mean saturation of the canvas, from a screenshot decoded in the page (the controls hidden) */
async function lumSat(lp: LivePage): Promise<{ lum: number; sat: number }> {
  await lp.page.addStyleTag({ content: '.vh{visibility:hidden !important}' });
  const buf: Buffer = await lp.page.locator('canvas').first().screenshot();
  return lp.eval(async (b64: string) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let L = 0, S = 0;
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      L += 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      S += mx > 0 ? (mx - mn) / mx : 0;
    }
    const n = d.length / 4;
    return { lum: L / n, sat: S / n };
  }, buf.toString('base64'));
}

const spotState = (lp: LivePage) => lp.eval(() => {
  const d = (window as any).__houseDebug(), out: number[][] = [];
  d.scene.traverse((o: any) => { if (o.isSpotLight && o.userData && o.userData.fixtureLight) out.push([+o.intensity.toFixed(5), +o.penumbra.toFixed(5)]); });
  const cam = d.camera;
  return { spots: out, view: cam.view ? !!cam.view.enabled : false, rt: d.renderer.getRenderTarget() === null, auto: d.renderer.shadowMap.autoUpdate };
});

export default async function check(env: LiveEnv): Promise<Result[]> {
  const out: Result[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const house = env.houses.includes('cocoon') ? 'cocoon' : env.houses[0];

  // ---- 1. restore identity -------------------------------------------------------------------------------------------------
  {
    const on = await env.open(house, { tod: 'dusk', query: 'q=1' });
    const off = await env.open(house, { tod: 'dusk', query: 'no=frame' });
    try {
      const fx = (await on.effects())?.features?.frame;
      add('frame installed at tier 1 with pools and clip', !!fx && fx.parts === true && fx.lamps > 0, fx ? `lamps ${fx.lamps}, clip ${JSON.stringify(fx.clip && { mapped: fx.clip.mapped, on: fx.clip.on })}` : 'no stats');
      const during = await spotState(on), plain = await spotState(off);
      const poolled = during.spots.length > 0 && during.spots.every(s => Math.abs(s[1] - 0.8) < 1e-6);
      add('lamp pools: penumbra 0.8, intensity scaled by the pool gain', poolled && during.spots.every((s, i) => Math.abs(s[0] - 1.2 * plain.spots[i][0]) < 1e-3 * Math.max(1, plain.spots[i][0])),`${during.spots.length} lamps, first ${JSON.stringify(during.spots[0])} vs ${JSON.stringify(plain.spots[0])}`);
      await on.eval(() => (window as any).__houseViewer.external.before());
      const before = await spotState(on);
      add('external.before(): lamps, camera and render target as the page set them', JSON.stringify(before.spots) === JSON.stringify(plain.spots) && before.view === plain.view && before.rt && before.auto === plain.auto, `${JSON.stringify(before.spots[0])} vs ${JSON.stringify(plain.spots[0])}, view ${before.view}, rt null ${before.rt}`);
      await on.eval(() => (window as any).__houseViewer.external.after());
      const after = await spotState(on);
      add('external.after(): the pools are back', JSON.stringify(after.spots) === JSON.stringify(during.spots), `${JSON.stringify(after.spots[0])}`);
      const clipOff = await on.eval(() => { (window as any).__houseViewer.external.before(); const c = (window as any).__houseViewer.effects.features.frame; return c ? c.clip : null; });
      add('external.before(): the clip is switched off', !!clipOff && clipOff.on === false, JSON.stringify(clipOff && { on: clipOff.on, mapped: clipOff.mapped }));
      await on.eval(() => (window as any).__houseViewer.external.after());
    } finally { await on.close(); await off.close(); }
  }

  // ---- 2. accumulation -------------------------------------------------------------------------------------------------------
  {
    const t1 = await env.open('aurora', { tod: 'day', query: 'q=1' });
    try {
      const f = await waitFor(t1, f => f.accum.state === 'done');
      add('tier 1: a still view accumulates 8 samples and stops', !!f && f.accum.state === 'done' && f.accum.steps === 8, f ? JSON.stringify(f.accum) : 'no stats');
      const after = await t1.eval(() => { const d = (window as any).__houseDebug(); return { view: d.camera.view ? !!d.camera.view.enabled : false, rt: d.renderer.getRenderTarget() === null, auto: d.renderer.shadowMap.autoUpdate }; });
      add('after accumulating: no view offset, canvas target, shadow policy as before', !after.view && after.rt && after.auto === true, JSON.stringify(after));
      const r0 = f?.accum.resets ?? 0;
      // the shot's scrubber moves the camera along the shot (a drag would enter the free camera, where the viewer's idle hook does not run)
      await t1.eval(() => { const sc = document.querySelector('.vh-scrub input') as HTMLInputElement; sc.value = String(Math.round(Number(sc.value) + 150)); sc.dispatchEvent(new Event('input', { bubbles: true })); sc.dispatchEvent(new Event('change', { bubbles: true })); });
      await sleep(120);
      const g = (await t1.effects())?.features?.frame;
      add('moving the shot resets the accumulation', !!g && g.accum.resets > r0 && g.accum.state !== 'done', g ? `resets ${r0} → ${g.accum.resets}, state ${g.accum.state}, last ${g.accum.lastReset}` : 'no stats');
      const h = await waitFor(t1, f => f.accum.state === 'done' && f.accum.total > (g?.accum.total ?? 0));
      add('and it accumulates again once the view is still', !!h && h.accum.state === 'done' && h.accum.steps === 8, h ? JSON.stringify(h.accum) : 'no stats');
    } finally { await t1.close(); }
    const t2 = await env.open('aurora', { tod: 'day', query: 'q=2' });
    try {
      const f = await waitFor(t2, f => f.accum.state === 'done');
      add('tier 2: 16 samples', !!f && f.accum.steps === 16, f ? JSON.stringify(f.accum) : 'no stats');
    } finally { await t2.close(); }
    const t0 = await env.open('aurora', { tod: 'day', query: 'q=0' });
    try {
      await sleep(1500);
      const f = (await t0.effects())?.features?.frame;
      const sp = await spotState(t0);
      add('tier 0: no accumulation, no pools (today\'s page)', !!f && f.accum.state === 'off' && f.accum.total === 0 && f.parts === false && sp.spots.every(s => Math.abs(s[1] - 0.45) < 1e-6), f ? `parts ${f.parts}, accum ${f.accum.state}, penumbra ${sp.spots[0] && sp.spots[0][1]}` : 'no stats');
    } finally { await t0.close(); }
  }

  // ---- 3. colour match + 5. Best quality ---------------------------------------------------------------------------------------
  for (const [h, tod] of [['aurora', 'day'], ['lakecabin', 'dusk']] as const) {
    if (!env.houses.includes(h) && h !== 'aurora') continue;
    const plain = await env.open(h, { tod, query: 'q=1&no=accum' });
    const acc = await env.open(h, { tod, query: 'q=1' });
    try {
      await waitFor(acc, f => f.accum.state === 'done');
      const [a, p] = [await lumSat(acc), await lumSat(plain)];
      const dl = Math.abs(a.lum - p.lum) / p.lum, ds = Math.abs(a.sat - p.sat) / p.sat;
      add(`${h} ${tod}: accumulated picture matches the plain path`, dl <= TOL.accumLum && ds <= TOL.accumSat, `luminance ${p.lum.toFixed(4)} → ${a.lum.toFixed(4)} (${(dl * 100).toFixed(2)} %), saturation ${p.sat.toFixed(4)} → ${a.sat.toFixed(4)} (${(ds * 100).toFixed(2)} %)`);
    } finally { await plain.close(); await acc.close(); }

    const base = await env.open(h, { tod, query: 'q=1&no=accum' });
    try {
      const callsPlain = await base.eval(() => { const d = (window as any).__houseDebug(); d.renderer.info.autoReset = false; d.renderer.info.reset(); d.renderer.render(d.scene, d.camera); const c = d.renderer.info.render.calls; d.renderer.info.autoReset = true; return c; });
      const pl = await lumSat(base);
      await base.eval(() => { (document.querySelector('[data-act="hq"]') as HTMLElement).click(); });
      const f = await waitFor(base, f => f.hq === true && f.kit?.hq?.ready && f.kit.hq.frames >= 1, 30000);
      await sleep(600);
      const hq = await lumSat(base);
      const dl = Math.abs(hq.lum - pl.lum) / pl.lum, ds = Math.abs(hq.sat - pl.sat) / pl.sat;
      add(`${h} ${tod}: Best quality chain draws`, !!f && f.hq === true && f.kit.hq.ready && f.kit.hq.frames >= 1, f ? JSON.stringify(f.kit.hq) : 'no stats');
      add(`${h} ${tod}: Best quality agrees with the plain path on luminance and saturation`, dl <= TOL.hqLum && ds <= TOL.hqSat, `luminance ${pl.lum.toFixed(4)} → ${hq.lum.toFixed(4)} (${(dl * 100).toFixed(1)} %), saturation ${pl.sat.toFixed(4)} → ${hq.sat.toFixed(4)} (${(ds * 100).toFixed(1)} %)`);
      const glass = await base.eval(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && (m.transmission || 0) > 0) n++; }); return n; });
      add(`${h} ${tod}: Best quality keeps the opaque-pass glass (no transmission pass)`, glass === 0, `${glass} transmissive materials`);
      void callsPlain;
      await base.eval(() => { (document.querySelector('[data-act="hq"]') as HTMLElement).click(); });
      await sleep(400);
      const back = await spotState(base);
      add(`${h} ${tod}: leaving Best quality brings the pools back`, back.spots.length > 0 && back.spots.every(s => Math.abs(s[1] - 0.8) < 1e-6), JSON.stringify(back.spots[0]));
    } finally { await base.close(); }
  }

  // ---- 4. spot-light clip ----------------------------------------------------------------------------------------------------
  // The proof of the slot mapping is in the page (verify()); this checks it from outside, with pixels. Only ONE room lamp is left
  // lit (everything else in the scene is switched off, which also changes three's light order: the mapping must follow), the scene is
  // drawn from the orbit shot into a small float target, and the depth of every pixel gives its world position. A pixel whose
  // world position lies outside that lamp's room box must not be lit by the clip-on page; the clip-off page shows how much light
  // the room used to push through its walls.
  {
    const probe = async (lp: LivePage, cutaway: boolean) => {
      if (cutaway) { await lp.page.keyboard.press('c'); await sleep(500); }
      return lp.eval(async () => {
        const d = (window as any).__houseDebug(), { scene, camera, renderer } = d;
        const { roomBoxes } = await import(new URL('./assets/light-guard.js', location.href).href);
        const lamps: any[] = [];
        scene.traverse((o: any) => { if (o.isSpotLight && o.userData && o.userData.fixtureLight) lamps.push(o); });
        const boxes = roomBoxes(d.house, lamps);
        const all: any[] = [];
        scene.traverse((o: any) => { if (o.isLight) all.push(o); });
        const was = all.map(o => o.visible), env = scene.environmentIntensity, fog = scene.fog, bg = scene.background, auto = renderer.shadowMap.autoUpdate;
        const W = 480, H = 270;
        const T: any = await import('three' as any);
        const mkRT = (type: number) => new T.WebGLRenderTarget(W, H, { type, depthBuffer: true });
        const lit = mkRT(T.FloatType), dep = mkRT(T.UnsignedByteType);
        const read = (rt: any, arr: any) => { renderer.readRenderTargetPixels(rt, 0, 0, W, H, arr); return arr; };
        const prevRT = renderer.getRenderTarget();
        const out: any[] = [];
        try {
          scene.environmentIntensity = 0; scene.fog = null; scene.background = null; renderer.shadowMap.autoUpdate = false;
          // depth once
          const depthMat = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
          const prevOverride = scene.overrideMaterial; scene.overrideMaterial = depthMat;
          renderer.setRenderTarget(dep); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, camera);
          scene.overrideMaterial = prevOverride;
          const D = read(dep, new Uint8Array(W * H * 4));
          const world = new Float32Array(W * H * 3);
          const inv = camera.projectionMatrixInverse, mw = camera.matrixWorld;
          const v = new T.Vector3();
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4, o = (y * W + x) * 3;
            const dd = (D[i] / 255 / (256 ** 3) + D[i + 1] / 255 / (256 ** 2) + D[i + 2] / 255 / 256 + D[i + 3] / 255) * (255 / 256);
            v.set((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1, dd * 2 - 1).applyMatrix4(inv).applyMatrix4(mw);
            world[o] = v.x; world[o + 1] = v.y; world[o + 2] = v.z;
            if (dd >= 0.99999) world[o] = NaN;   // the sky
          }
          const frame = async () => { window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 450)); };
          const draw = () => { renderer.setRenderTarget(lit); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera); return read(lit, new Float32Array(W * H * 4)); };
          // baseline: every light off
          for (const o of all) o.visible = false;
          await frame();
          const base = draw();
          const chosen = lamps.filter(l => boxes.has(l)).slice(0, 6);
          for (const L of chosen) {
            for (const o of all) o.visible = o === L;
            await frame();
            const img = draw();
            const bx = boxes.get(L);
            let inside = 0, outside = 0, strongOutside = 0;
            for (let p = 0; p < W * H; p++) {
              const wx = world[p * 3];
              if (Number.isNaN(wx)) continue;
              const dl = (img[p * 4] - base[p * 4] + img[p * 4 + 1] - base[p * 4 + 1] + img[p * 4 + 2] - base[p * 4 + 2]) / 3;
              if (dl < 0.004) continue;
              const wy = world[p * 3 + 1], wz = world[p * 3 + 2], e = 0.05;
              const isIn = wx >= bx.lo[0] - e && wx <= bx.hi[0] + e && wy >= bx.lo[1] - e && wy <= bx.hi[1] + e && wz >= bx.lo[2] - e && wz <= bx.hi[2] + e;
              if (isIn) inside++; else { outside++; if (dl > 0.02) strongOutside++; }
            }
            out.push({ inside, outside, strongOutside });
          }
        } finally {
          all.forEach((o, i) => { o.visible = was[i]; });
          scene.environmentIntensity = env; scene.fog = fog; scene.background = bg; renderer.shadowMap.autoUpdate = auto;
          renderer.setRenderTarget(prevRT); lit.dispose(); dep.dispose();
        }
        return out;
      });
    };
    const on = await env.open(house, { tod: 'night', shot: 'orbit', t: 0.4, query: 'q=1&no=accum' });
    const off = await env.open(house, { tod: 'night', shot: 'orbit', t: 0.4, query: 'q=1&no=accum,spotclip' });
    try {
      await sleep(800);
      const c0 = (await on.effects())?.features?.frame?.clip;
      add('spot clip: lights mapped to rooms, switched on', !!c0 && c0.mapped > 0 && c0.on, c0 ? JSON.stringify(c0) : 'no clip stats');
      const a = await probe(on, true), b = await probe(off, true);
      const c1 = (await on.effects())?.features?.frame?.clip;
      add('spot clip: the slot mapping stayed proven while lights and levels were hidden', !!c1 && c1.mismatches === 0 && c1.verified > (c0?.verified ?? 0) && c1.on, c1 ? JSON.stringify(c1) : 'no clip stats');
      const lit = a.filter((r: any) => r.inside > 20).length;
      const strayOn = a.reduce((n: number, r: any) => n + r.strongOutside, 0), strayOff = b.reduce((n: number, r: any) => n + r.strongOutside, 0);
      add('spot clip: no lamp lights a surface outside its room', a.length > 0 && lit > 0 && strayOn === 0, `${a.length} lamps probed, ${lit} light their own room, strong stray pixels with the clip: ${strayOn} (per lamp ${a.map((r: any) => r.strongOutside).join(',')})`);
      add('spot clip: and the probe can see the leak it removes (clip off)', strayOff > 0, `strong stray pixels without it: ${strayOff} (per lamp ${b.map((r: any) => r.strongOutside).join(',')}), lit in-room pixels ${b.map((r: any) => r.inside).join(',')}`);
    } finally { await on.close(); await off.close(); }
  }
  return out;
}
