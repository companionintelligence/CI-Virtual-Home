// pnpm run test:live --only water: the live water (assets/viewer-water.ts, viewer-ocean.ts, realism-water.ts).
//
//  1. it installs: water meshes are patched at tier 1, the live water is opaque, the lake and a pool each have a clone
//  2. restore identity: after viewer.external.before() the canvas equals ?no=water's (tier 1 and 2), after() brings it back
//  3. ?no=water leaves no feature and no clone behind
//  4. fallback ladder: q=1 has no ocean, q=2 has it, ?no=ocean and a missing EXT_color_buffer_float (?waterdebug=noext) and a
//     sim that fails mid-run all end on the analytic layers with a clean console and water still drawn
//  5. time purity: ocean.update(t) twice reads back identically, another t differs
//  6. the FFT's rms height is within +-30% of a CPU-integrated spectrum of the same wind and tile
// A check returns { name, ok, detail }[]; the console-error check (c) of test-live-effects.mts covers every page opened here.
import type { LiveEnv, Result } from '../test-live-effects.mts';

const G = 9.81, KM = 370, CM = 0.23;
const sq = (x: number) => x * x;
const omegaOf = (k: number) => Math.sqrt(G * k * (1 + sq(k / KM)));

/** the expected variance of the height field (m^2): the same spectrum as the shader, summed over the grid by the CPU */
function expectedRms(N: number, tile: number, wind: [number, number]): number {
  const lw = Math.hypot(wind[0], wind[1]), Om = 0.84, kp = G * sq(Om / lw), cp = omegaOf(kp) / kp;
  const z0 = 0.000037 * sq(lw) / G * Math.pow(lw / cp, 0.9), uStar = 0.41 * lw / Math.log(10 / z0);
  const alpham = 0.01 * (uStar < CM ? 1 + Math.log(uStar / CM) : 1 + 3 * Math.log(uStar / CM));
  const dk = 2 * Math.PI / tile; let v = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const n = i < N / 2 ? i : i - N, m = j < N / 2 ? j : j - N;
    if (!n && !m) continue;
    const Kx = dk * n, Kz = dk * m, k = Math.hypot(Kx, Kz), cc = omegaOf(k) / k;
    const Lpm = Math.exp(-1.25 * sq(kp / k)), gamma = 1.7, sigma = 0.08 * (1 + 4 * Math.pow(Om, -3));
    const Gam = Math.exp(-sq(Math.sqrt(k / kp) - 1) / 2 * sq(sigma)), Jp = Math.pow(gamma, Gam);
    const Fp = Lpm * Jp * Math.exp(-Om / Math.sqrt(10) * (Math.sqrt(k / kp) - 1)), alphap = 0.006 * Math.sqrt(Om), Bl = 0.5 * alphap * cp / cc * Fp;
    const Fm = Math.exp(-0.25 * sq(k / KM - 1)), Bh = 0.5 * alpham * CM / cc * Fm * Lpm;
    const a0 = Math.log(2) / 4, am = 0.13 * uStar / CM, Delta = Math.tanh(a0 + 4 * Math.pow(cc / cp, 2.5) + am * Math.pow(CM / cc, 2.5));
    const cosPhi = (wind[0] * Kx + wind[1] * Kz) / (lw * k);
    const S = (1 / (2 * Math.PI)) * Math.pow(k, -4) * (Bl + Bh) * (1 + Delta * (2 * cosPhi * cosPhi - 1));
    v += 2 * S * dk * dk;   // E|h(k,t)|^2 = E|h0(k)|^2 + E|h0(-k)|^2 = 2 * S * dk^2
  }
  return Math.sqrt(v);
}

export default async function check(env: LiveEnv): Promise<Result[]> {
  const out: Result[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const house = 'lakecabin';   // a lake plane, a pond; the pools are checked on aurora below

  // ---- 1 & 3: it installs, and ?no=water leaves nothing
  {
    const lp = await env.open('aurora', { query: 'q=1&waterdebug=1' });
    try {
      const fx = await lp.effects();
      const w = fx && fx.features && fx.features.water;
      add('aurora q=1: the water feature is installed and applied', !!w && w.applied === true, JSON.stringify(w || null).slice(0, 160));
      const state = await lp.eval(() => {
        const d = (window as any).__houseDebug(); let live = 0, opaque = 0, transparentLeft = 0;
        d.scene.traverse((o: any) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m && m.userData && m.userData.__waterOrig) { live++; if (!m.transparent && m.opacity === 1 && m.depthWrite) opaque++; }
            else if (m && m.userData && m.userData.surface === 'water' && m.transparent) transparentLeft++;
          }
        });
        return { live, opaque, transparentLeft };
      });
      add('the live water materials are opaque with depth write', state.live > 0 && state.live === state.opaque, `${state.opaque}/${state.live}`);
      add('no transparent kit water is left in the plain path', state.transparentLeft === 0, String(state.transparentLeft));
    } finally { await lp.close(); }
    const off = await env.open('aurora', { query: 'q=1&no=water' });
    try {
      const fx = await off.effects();
      const left = await off.eval(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.userData && m.userData.__waterOrig) n++; }); return n; });
      add('?no=water: no feature, no live material', !(fx && fx.features && fx.features.water) && left === 0);
    } finally { await off.close(); }
  }

  // ---- 2: restore identity, tier 1 and tier 2 (the houses with a pool and with a lake)
  for (const [h, q] of [['aurora', 'q=1'], ['lakecabin', 'q=2'], ['lakecabin', 'q=1']] as const) {
    // (a fresh GPU context draws its first transmission-pass frame of a house differently from the ones after it, measured:
    // one sacrificial page per house and tier takes that)
    { const w = await env.open(h, { query: `${q}&no=water` }); await w.eval(() => (window as any).__houseViewer.external.before()); await w.hash(); await w.close(); }
    const on = await env.open(h, { query: `${q}&waterdebug=1` });
    const off = await env.open(h, { query: `${q}&no=water` });
    try {
      const drawn = await on.shotHash(), drawnOff = await off.shotHash();
      add(`${h} ${q}: the water changes the picture`, drawn !== drawnOff);
      await on.eval(() => (window as any).__houseViewer.external.before());
      await off.eval(() => (window as any).__houseViewer.external.before());
      let [x, y] = [await on.hash(), await off.hash()];
      // (the first draw of a fresh GPU context through the transmission pass can differ from the ones after it: look again once)
      if (x !== y) [x, y] = [await on.hash(), await off.hash()];
      add(`${h} ${q}: restored water equals ?no=water`, x === y, x === y ? x.slice(0, 8) : `${x.slice(0, 8)} vs ${y.slice(0, 8)}`);
      await on.eval(() => (window as any).__houseViewer.external.after());
      const back = await on.effects();
      add(`${h} ${q}: after() applies it again`, !!(back.features.water && back.features.water.applied));
    } finally { await on.close(); await off.close(); }
  }

  // ---- 4: the fallback ladder
  {
    const stat = async (query: string) => {
      const lp = await env.open(house, { query: `${query}&waterdebug=1` });
      try {
        // give the lazy ocean import time to settle
        await lp.page.waitForFunction(() => { const w = (window as any).__houseWater; if (!w) return true; const s = w.stats().ocean; return s !== 'loading'; }, null, { timeout: 30000 }).catch(() => {});
        await lp.settle();
        const s = await lp.eval(() => (window as any).__houseWater && (window as any).__houseWater.stats());
        const h = await lp.shotHash();
        return { s, h, errors: lp.errors.slice() };
      } finally { await lp.close(); }
    };
    const t1 = await stat('q=1'), t2 = await stat('q=2'), noOcean = await stat('q=2&no=ocean'), noExt = await stat('q=2&waterdebug=noext');
    add('q=1: analytic layers only (no ocean)', !!t1.s && t1.s.ocean === 'none' && t1.s.tier === 1, JSON.stringify(t1.s && { o: t1.s.ocean, t: t1.s.tier }));
    add('q=2: the FFT ocean is on the lake', !!t2.s && t2.s.ocean === 'on' && t2.s.tier === 2, JSON.stringify(t2.s && { o: t2.s.ocean, t: t2.s.tier, st: t2.s.oceanStats }));
    add('q=2 ?no=ocean: analytic layers', !!noOcean.s && noOcean.s.ocean === 'none');
    add('q=2 without EXT_color_buffer_float: falls back, no console error', !!noExt.s && noExt.s.ocean === 'failed' && noExt.errors.length === 0, JSON.stringify(noExt.s && noExt.s.oceanReason));
    // a sim that fails after it started: forced through the debug hook
    const lp = await env.open(house, { query: 'q=2&waterdebug=1' });
    try {
      await lp.page.waitForFunction(() => (window as any).__houseWater && (window as any).__houseWater.stats().ocean === 'on', null, { timeout: 30000 });
      const before = await lp.shotHash();
      await lp.eval(() => (window as any).__houseWater.failOcean());
      await lp.settle();
      const s = await lp.eval(() => (window as any).__houseWater.stats());
      const after = await lp.shotHash();
      add('a failing sim drops the lake to the analytic layers and keeps drawing', s.ocean === 'failed' && after !== before && lp.errors.length === 0, JSON.stringify({ o: s.ocean }));
    } finally { await lp.close(); }
  }

  // ---- 5 & 6: time purity and the spectrum
  {
    const lp = await env.open(house, { query: 'q=2&waterdebug=1' });
    try {
      await lp.page.waitForFunction(() => (window as any).__houseWater && (window as any).__houseWater.stats().ocean === 'on', null, { timeout: 30000 });
      const r = await lp.eval(() => {
        const w = (window as any).__houseWater, o = w.ocean(), cam = (window as any).__houseDebug().camera;
        const sig = (a: Float32Array) => { let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= Math.round(a[i] * 1e5) | 0; h = Math.imul(h, 16777619) >>> 0; } return h; };
        const rms = (a: Float32Array) => { let m = 0; for (const x of a) m += x; m /= a.length; let v = 0; for (const x of a) v += (x - m) * (x - m); return Math.sqrt(v / a.length); };
        o.update(3.7, cam, true, true); const a = o.readback();
        o.update(41.3, cam, true, true); const b = o.readback();
        o.update(3.7, cam, true, true); const c = o.readback();
        const rs = [3.7, 17.2, 41.3, 90.1, 150.5].map(t => { o.update(t, cam, true, true); return rms(o.readback()); });
        return { same: sig(a) === sig(c), differs: sig(a) !== sig(b), rms: rs, N: o.N, tile: o.tile, wind: o.stats().wind };
      });
      add('time purity: update(t) twice reads back identically', r.same);
      add('another t is another sea', r.differs);
      const exp = expectedRms(r.N, r.tile, r.wind as [number, number]);
      const mean = r.rms.reduce((s: number, x: number) => s + x, 0) / r.rms.length;
      add('FFT rms height within +-30% of the CPU-integrated spectrum', Math.abs(mean / exp - 1) <= 0.3, `gpu ${mean.toFixed(3)} m (per t: ${r.rms.map((x: number) => x.toFixed(3)).join(' ')}) vs cpu ${exp.toFixed(3)} m`);
    } finally { await lp.close(); }
  }
  return out;
}
