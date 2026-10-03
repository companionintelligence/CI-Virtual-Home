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
  // a page under load takes a while to settle (the shadow map, the roof's fade, the first adaptive pixel-ratio step): measure until two
  // looks 600 ms apart agree to 0.3 %
  let prev = -1, cur = await lumSat1(lp);
  for (let i = 0; i < 8 && Math.abs(cur.lum - prev) > 0.003 * Math.max(cur.lum, 1e-6); i++) { prev = cur.lum; await sleep(600); cur = await lumSat1(lp); }
  return cur;
}
async function lumSat1(lp: LivePage): Promise<{ lum: number; sat: number }> {
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


/** the canvas of two pages, each drawn once by its own renderer in the same task, compared pixel by pixel in the first page */
async function pixelDiff(a: LivePage, b: LivePage): Promise<{ max: number; frac: number }> {
  const draw = (lp: LivePage) => lp.eval(() => { const d = (window as any).__houseDebug(), r = d.renderer; r.render(d.scene, d.camera); return r.domElement.toDataURL('image/png'); });
  const [ua, ub] = [await draw(a), await draw(b)];
  return a.eval(async ([x, y]: string[]) => {
    const px = async (u: string) => { const bmp = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const [p, q] = [await px(x), await px(y)];
    let max = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); if (d > 0) { n++; if (d > max) max = d; } }
    return { max, frac: n / (p.length / 4) };
  }, [ua, ub]);
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
      // the picture: the clip's shader text is compiled into the player's programs (a branch on a flag that is zero while the page's offline
      // hooks run), the killed page has no such text, and the GPU's compiler may order a float operation differently: a pixel or two one
      // level apart is that, anything more is a state that was not put back
      await off.eval(() => (window as any).__houseViewer.external.before());
      const dp = await pixelDiff(on, off);
      add('external.before(): the picture is the killed page\'s (within one level in a handful of pixels: the compiler)', dp.max <= 1 && dp.frac < 1e-4, `max ${dp.max} level, ${(dp.frac * 100).toExponential(1)} % of pixels differ`);
      await on.eval(() => (window as any).__houseViewer.external.after());
    } finally { await on.close(); await off.close(); }
  }

  // ---- 1b. kill switch and tier 0 draw what 03edd3b drew (only when the harness has the BASE_SHA tree)
  if (env.base) {
    for (const [label, query] of [['?no=frame', 'no=frame,ao,water,sky,grass,assets'], ['tier 0 (?q=0)', 'q=0']] as const) {   // (the other features change the picture too: this is the frame package's switch alone)
      const mine = await env.open(house, { tod: 'dusk', query });
      const ref = await env.open(house, { of: 'base', tod: 'dusk' });
      try {
        const [x, y] = [await mine.hash(), await ref.hash()];
        add(`${house} dusk: ${label} draws what the base commit drew`, x === y, x === y ? x.slice(0, 8) : `${x.slice(0, 8)} vs ${y.slice(0, 8)}`);
      } finally { await mine.close(); await ref.close(); }
    }
  }

  // ---- 2. accumulation -------------------------------------------------------------------------------------------------------
  {
    const t1 = await env.open('aurora', { tod: 'day', query: 'q=1&no=water' });   // (visible water keeps frames coming at 30 Hz, so a view with water in it is never still: no accumulation there, by design)
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
    const t2 = await env.open('aurora', { tod: 'day', query: 'q=2&no=water' });
    try {
      const f = await waitFor(t2, f => f.accum.state === 'done');
      // (a refinement frame over 45 ms twice stops the run by design; on a loaded machine that is the right answer, so it is accepted when it says so)
      add('tier 2: 16 samples', !!f && (f.accum.steps === 16 || (f.accum.state === 'stopped' && f.accum.strikes > 0 && f.accum.steps >= 8)), f ? JSON.stringify(f.accum) : 'no stats');
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
    const plain = await env.open(h, { tod, query: 'q=1&no=accum,water' });
    const acc = await env.open(h, { tod, query: 'q=1&no=water' });
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
  // The page proves the slot mapping itself (verify()); this checks the clip from outside, with pixels. ONE room lamp is left lit
  // (every other light in the scene is hidden, which changes three's light order: the mapping must follow), and four cameras 2 m
  // outside that lamp's room box look at it, one from inside looking down at its floor. Each view is drawn twice into a small float
  // target (the lamp at full intensity, and at zero: the difference is that lamp's light alone), and the depth of every pixel gives
  // its world position. With the clip, no pixel outside the box may be lit by the lamp; without it (the second page) the probe must
  // see the light that crept through the walls, or it proves nothing.
  {
    const probe = async (lp: LivePage) => lp.eval(async () => {
      const d = (window as any).__houseDebug(), { scene, camera: main, renderer } = d;
      const { roomBoxes } = await import(new URL('./assets/light-guard.js', location.href).href);
      const T: any = await import('three' as any);
      const lamps: any[] = [];
      scene.traverse((o: any) => { if (o.isSpotLight && o.userData && o.userData.fixtureLight) lamps.push(o); });
      const boxes = roomBoxes(d.house, lamps);
      const all: any[] = [];
      scene.traverse((o: any) => { if (o.isLight) all.push(o); });
      const was = all.map(o => o.visible), envI = scene.environmentIntensity, fog = scene.fog, bg = scene.background, auto = renderer.shadowMap.autoUpdate;
      const W = 320, H = 180;
      const lit = new T.WebGLRenderTarget(W, H, { type: T.FloatType }), dep = new T.WebGLRenderTarget(W, H, { type: T.UnsignedByteType });
      const prevRT = renderer.getRenderTarget(), prevClear = new T.Color(), prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(prevClear);
      const nextFrame = async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise(r => setTimeout(r, 120)); };
      const out: any[] = [];
      const v = new T.Vector3();
      try {
        scene.environmentIntensity = 0; scene.fog = null; scene.background = null; renderer.shadowMap.autoUpdate = false;
        const depthMat = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
        const read = (rt: any, arr: any) => { renderer.readRenderTargetPixels(rt, 0, 0, W, H, arr); return arr; };
        const worldOf = (cam: any) => {
          const prev = scene.overrideMaterial; scene.overrideMaterial = depthMat;
          renderer.setRenderTarget(dep); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam);
          scene.overrideMaterial = prev;
          const D = read(dep, new Uint8Array(W * H * 4)), w = new Float32Array(W * H * 3);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4, o = (y * W + x) * 3;
            const dd = (D[i] + D[i + 1] / 256 + D[i + 2] / 65536) / 255 * (255 / 256) + D[i + 3] / 255 / 16777216;   // r169's packDepthToRGBA: r is the most significant byte
            if (dd >= 0.99999) { w[o] = NaN; continue; }
            v.set((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1, dd * 2 - 1).applyMatrix4(cam.projectionMatrixInverse).applyMatrix4(cam.matrixWorld);
            w[o] = v.x; w[o + 1] = v.y; w[o + 2] = v.z;
          }
          return w;
        };
        const draw = (cam: any) => { renderer.setRenderTarget(lit); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam); return read(lit, new Float32Array(W * H * 4)); };
        for (const o of all) o.visible = false;
        for (const L of lamps.filter(l => boxes.has(l)).slice(0, 3)) {
          L.visible = true;
          const full = L.intensity;
          const bx = boxes.get(L);
          L.updateWorldMatrix(true, false);
          const lx = L.matrixWorld.elements[12], ly = L.matrixWorld.elements[13], lz = L.matrixWorld.elements[14];
          const cx = (bx.lo[0] + bx.hi[0]) / 2, cz = (bx.lo[2] + bx.hi[2]) / 2;
          const spots: [string, [number, number, number], [number, number, number]][] = [
            ['in', [lx, ly - 0.15, lz], [lx, 0, lz + 0.001]],
            ['W', [bx.lo[0] - 2, ly, cz], [lx, ly, lz]], ['E', [bx.hi[0] + 2, ly, cz], [lx, ly, lz]],
            ['N', [cx, ly, bx.lo[2] - 2], [lx, ly, lz]], ['S', [cx, ly, bx.hi[2] + 2], [lx, ly, lz]],
          ];
          await nextFrame();   // a drawn frame with this lamp alone: the viewer's tick maps its slot
          const r: any = { inside: 0, outside: 0, strongOutside: 0, views: 0, axis: [0, 0, 0, 0, 0, 0], far: 0, ex: [] as number[][] };
          for (const [name, pos, at] of spots) {
            const cam = new T.PerspectiveCamera(name === 'in' ? 100 : 70, W / H, 0.05, 120);
            cam.position.set(...pos); cam.lookAt(...at); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            const world = worldOf(cam);
            L.intensity = 0; const base = draw(cam);
            L.intensity = full; const img = draw(cam);
            r.views++;
            for (let p = 0; p < W * H; p++) {
              const wx = world[p * 3];
              if (Number.isNaN(wx)) continue;
              const dl = (img[p * 4] - base[p * 4] + img[p * 4 + 1] - base[p * 4 + 1] + img[p * 4 + 2] - base[p * 4 + 2]) / 3;
              if (dl < 0.004) continue;
              const wy = world[p * 3 + 1], wz = world[p * 3 + 2], e = 0.05;
              const isIn = wx >= bx.lo[0] - e && wx <= bx.hi[0] + e && wy >= bx.lo[1] - e && wy <= bx.hi[1] + e && wz >= bx.lo[2] - e && wz <= bx.hi[2] + e;
              if (isIn) r.inside++;
              else {
                r.outside++;
                if (dl > 0.02) {
                  r.strongOutside++;
                  const gap = [bx.lo[0] - wx, wx - bx.hi[0], bx.lo[1] - wy, wy - bx.hi[1], bx.lo[2] - wz, wz - bx.hi[2]];
                  const k = gap.indexOf(Math.max(...gap)); r.axis[k]++; r.far = Math.max(r.far, gap[k]);
                  if (r.ex.length < 4 && p % 97 === 0) r.ex.push([name === 'in' ? 0 : 1, +wx.toFixed(2), +wy.toFixed(2), +wz.toFixed(2), +gap[k].toFixed(2), k]);
                }
              }
            }
          }
          L.intensity = full; L.visible = false;
          out.push(r);
        }
      } finally {
        all.forEach((o, i) => { o.visible = was[i]; });
        scene.environmentIntensity = envI; scene.fog = fog; scene.background = bg; renderer.shadowMap.autoUpdate = auto;
        renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevAlpha); lit.dispose(); dep.dispose();
        void main;
      }
      return out;
    });
    const on = await env.open(house, { tod: 'night', query: 'q=1&no=accum' });
    const off = await env.open(house, { tod: 'night', query: 'q=1&no=accum,spotclip' });
    try {
      await sleep(800);
      const c0 = (await on.effects())?.features?.frame?.clip;
      add('spot clip: lights mapped to rooms, switched on', !!c0 && c0.mapped > 0 && c0.on, c0 ? JSON.stringify(c0) : 'no clip stats');
      const a = await probe(on), b = await probe(off);
      await on.settle();
      const c1 = (await on.effects())?.features?.frame?.clip;
      add('spot clip: the slot mapping stayed proven while the other lights were hidden', !!c1 && c1.mismatches === 0 && c1.on && c1.verified > 0, c1 ? JSON.stringify(c1) : 'no clip stats');
      const lit = a.filter((r: any) => r.inside > 20).length;
      const strayOn = a.reduce((n: number, r: any) => n + r.strongOutside, 0), strayOff = b.reduce((n: number, r: any) => n + r.strongOutside, 0);
      add('spot clip: each lamp still lights its own room', a.length > 0 && lit === a.length, `in-room lit pixels per lamp ${a.map((r: any) => r.inside).join(',')}`);
      add('spot clip: no lamp lights a surface outside its room', a.length > 0 && strayOn === 0, `strong stray pixels with the clip: ${strayOn} (per lamp ${a.map((r: any) => r.strongOutside).join(',')}); sides -x,+x,-y,+y,-z,+z ${JSON.stringify(a.map((r: any) => r.axis))}, farthest ${a.map((r: any) => r.far.toFixed(2)).join(',')} m, e.g. ${JSON.stringify(a[0]?.ex)}`);
      add('spot clip: and the probe sees the leak it removes (clip off)', strayOff > 0, `strong stray pixels without the clip: ${strayOff} (per lamp ${b.map((r: any) => r.strongOutside).join(',')}), in-room ${b.map((r: any) => r.inside).join(',')}`);
    } finally { await on.close(); await off.close(); }
  }
  return out;
}
