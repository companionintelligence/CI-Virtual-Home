// Live-player realism: frame quality. Idle temporal accumulation, softer lamp pools, room-clipped spot lights, and the player's
// lighter Best quality. The thin eager entry; the heavy part is assets/viewer-composer.ts (loaded lazily) and the shader side of the
// clip is assets/light-guard.ts. Registered in assets/realism.ts's TABLE. See the contract at the top of that file and
// README.md -> "Live realism (the player)" -> frame.
//
// FOUR PARTS, TIERED. The handle is installed at every tier (minTier 0) because the Best-quality chain is wanted on weak devices
// most: the page's own is the film's renderer and halves their frame rate. What runs depends on ctx.tier(), read live:
//
//   tier 0   only the lighter Best quality (render(true) when the user turns it on). Everything else is exactly today's page.
//   tier 1   + lamp pools (the room spots' penumbra raised to 0.8, intensity regained to hold the room's level), + the spot lights clipped to their rooms,
//            + idle accumulation, 8 jittered frames.
//   tier 2   the same, 16 frames.
//
// Accumulation and the Best-quality chain cost nothing while the camera moves in the plain path: accumulation runs only after the
// view has been still ~250 ms and nothing else wants a frame (the registry's idle() hook), and the Best-quality chain only when
// asked for. The lamp pools and the clip are uniforms and a few instructions in the spot loop.
//
// RESTORE. restore() puts the spot lights' penumbra and intensity back, switches the clip off (its uniform), and drops the
// accumulation, so the page's offline hooks see the scene as built. The camera's view offset and the render target are put back inside
// every draw (viewer-composer.ts), not in restore().
import type { RealismFeature, RealismCtx, RealismHandle } from './realism.js';
import { createSpotClip, spotClipInstalled, type SpotClip } from './light-guard.js';

const STILL_MS = 250;           // the view has been still this long: start accumulating
const SLOW_FRAME_S = 0.045;     // a refinement frame this slow (twice in a row) stops the accumulation
const FREE_AFTER_S = 8;           // the accumulation's targets (two half-float images of the canvas) are given back after this long without a step
const SLOW_STRIKES = 3;         // …and after this many such stops in a session it is switched off for the session

// ---- lamp pools --------------------------------------------------------------------------------------------------------------
// fixtures.ts hangs one warm SpotLight per room (penumbra 0.45, intensity base x lampGain), sized so the floor under it gets a set
// illuminance. Its full-strength inner cone is wide (55 % of the beam), so the walls near the lamp clip to white and the pool's edge
// reads as a near-hard ellipse. Raising the penumbra to 0.8 shrinks the inner cone to 20 % and turns the edge into a long smooth
// falloff, but that alone takes about 40 % of the light out of the room (measured: mean luminance of lit interiors -16 %, see the
// README). The intensity is raised again to hold most of it: the walls near the lamp (where the inverse-square term and a full-strength
// cone met) stay below white, the floor keeps its level to within ~10 %.
export const POOL = { penumbra: 0.8, intensity: 1.2 };

type Lamp = { light: any; pen0: number; raw: number; set: number };

function createLamps(scene: any) {
  let lamps: Lamp[] = [];
  let on = false;
  const find = () => {
    const out: Lamp[] = [];
    scene.traverse((o: any) => { if (o.isSpotLight && o.userData && o.userData.fixtureLight) out.push({ light: o, pen0: o.penumbra, raw: o.intensity, set: o.intensity }); });
    return out;
  };
  const put = (l: Lamp) => { l.raw = l.light.intensity; l.light.intensity = l.raw * POOL.intensity; l.set = l.light.intensity; l.light.penumbra = POOL.penumbra; };
  const take = (l: Lamp) => {
    l.light.penumbra = l.pen0;
    if (l.light.intensity === l.set) l.light.intensity = l.raw;   // (still ours; if fixtures wrote a new gain since, that one is the raw value)
  };
  return {
    apply() { if (on) return; on = true; lamps = find(); for (const l of lamps) { l.pen0 = l.light.penumbra; put(l); } },
    restore() { if (!on) return; on = false; for (const l of lamps) take(l); },
    /** fixtures.applyLampGain rewrites light.intensity on every lighting change; scale what it wrote */
    tick() { if (!on) return; for (const l of lamps) if (l.light.intensity !== l.set) { l.raw = l.light.intensity; l.light.intensity = l.raw * POOL.intensity; l.set = l.light.intensity; } },
    rescan() { const was = on; if (was) this.restore(); lamps = []; if (was) this.apply(); },
    get count() { return lamps.length; },
    get on() { return on; },
  };
}

const feature: RealismFeature = {
  key: 'frame',
  phase: 'post-batch',
  minTier: 0,
  async install(ctx: RealismCtx): Promise<RealismHandle | null> {
    const { renderer, scene, camera } = ctx;
    // ?no=<part> switches one part off for A/B timing and for the live check: accum (idle accumulation), lamppool (the softer pools),
    // spotclip (the room clip; the shader text is left out too, see light-guard.ts), hqlite (Best quality goes back to the page's composer)
    const off = (k: string) => ctx.no.has(k);
    const lamps = createLamps(scene);
    const clip: SpotClip | null = spotClipInstalled() && !off('spotclip') ? createSpotClip({ scene, renderer, house: () => ctx.house() }) : null;

    let kit: import('./viewer-composer.js').FrameKit | null = null;
    let kitFailed = false;
    // the heavy part loads in the background: nothing here waits for it
    const floatOk = !!(renderer.extensions && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')));
    const kitP = floatOk && !(off('hqlite') && off('accum')) ? import('./viewer-composer.js').then(m => {
      kit = m.createFrameKit({ THREE: ctx.THREE, renderer, scene, camera, house: () => ctx.house(), lighting: () => ctx.lighting(), bakedAo: () => bakedAo });
      if (hqOn) kit.hqWarm();
      (window as any).__vhKit = kit; // TEMP-DEBUG
      ctx.markDirty();
    }, err => { kitFailed = true; console.warn('realism: the frame kit could not be loaded', err); }) : Promise.resolve();
    void kitP;

    let applied = false, partsOn = false, hqOn = false;
    let bakedAo = false, aoCheck = 0;
    // ---- accumulation
    type Acc = 'off' | 'running' | 'done' | 'stopped';
    let acc: Acc = 'off';
    let want = false;                       // idle() asked for a step; render() takes it
    let slow = 0, strikes = 0, banned = false;
    let lastStepT = 0;
    let steps = 0, lastDt = 0, stepsTotal = 0, resets = 0, skipped = '';
    const pose = new Float64Array(32);       // the camera (world + projection) the accumulation started from
    const takePose = () => { pose.set(camera.matrixWorld.elements, 0); pose.set(camera.projectionMatrix.elements, 16); };
    const samePose = (): boolean => { const a = camera.matrixWorld.elements, b = camera.projectionMatrix.elements; for (let i = 0; i < 16; i++) if (a[i] !== pose[i] || b[i] !== pose[16 + i]) return false; return true; };
    const frames = (): number => (ctx.tier() >= 2 ? 16 : 8);
    let lastReset = '';
    const resetAcc = (why = '') => { if (acc !== 'off') { resets++; lastReset = why; } acc = 'off'; want = false; slow = 0; steps = 0; if (kit) kit.accReset(); };
    const syncParts = () => {
      const t = ctx.tier();
      const should = applied && t >= 1;
      if (should === partsOn) return;
      partsOn = should;
      if (should) { if (!off('lamppool')) lamps.apply(); clip?.apply(); } else { lamps.restore(); clip?.restore(); resetAcc('parts'); }
      ctx.markDirty();
    };

    const plainDraw = () => { const rt = renderer.getRenderTarget(); renderer.setRenderTarget(null); renderer.render(scene, camera); renderer.setRenderTarget(rt); };

    const handle: RealismHandle = {
      apply() { applied = true; syncParts(); },
      restore() {
        applied = false;
        lamps.restore(); clip?.restore(); partsOn = false;
        resetAcc('restore');
      },
      sync() { lamps.rescan(); clip?.rescan(); resetAcc('sync'); },
      tick(dt, _t, cam) {
        lastDt = dt;
        syncParts();
        if (!partsOn) return;
        lamps.tick();
        if (kit && acc !== 'running' && ctx.now() - lastStepT > FREE_AFTER_S && kit.stats().accum.allocated) kit.accFree();
        if (clip) {
          if (!clip.verify(cam)) { ctx.markDirty(); }
          clip.update(cam);
        }
        if (acc === 'running' && dt > SLOW_FRAME_S) {
          if (++slow >= 2) {
            acc = 'stopped';
            if (++strikes >= SLOW_STRIKES) banned = true;
          }
        } else if (acc === 'running') slow = 0;
        if ((++aoCheck & 31) === 0) {
          try { bakedAo = !!(window as any).__houseViewer?.effects?.features?.ao?.applied; } catch { bakedAo = false; }
        }
      },
      idle(ms) {
        if (!partsOn || hqOn || banned || !kit || off('accum')) return false;
        if (acc === 'done' || acc === 'stopped') {
          if (!samePose()) { resetAcc('pose'); return false; }
          return false;
        }
        if (acc === 'off') {
          if (ms < STILL_MS) return false;
          takePose(); acc = 'running'; steps = 0;
        } else if (!samePose()) { resetAcc('pose'); return false; }
        want = true;
        return true;
      },
      render(hq) {
        if (hq) {
          if (!hqOn || off('hqlite')) return false;
          if (!kit || kitFailed) { if (!kit && !kitFailed) { plainDraw(); return true; } return false; }
          try {
            if (kit.hqRender(camera)) return true;
          } finally { /* the kit puts its targets back itself */ }
          plainDraw(); ctx.markDirty();   // SMAA's lookups are still decoding: a plain frame now, the chain next
          return true;
        }
        if (!want) { if (acc !== 'off') resetAcc('draw'); return false; }
        want = false;
        if (!kit || acc !== 'running') return false;
        const n = kit.accStep(camera, steps === 0);
        steps = n; stepsTotal++; lastStepT = ctx.now();
        if (n >= frames()) acc = 'done';
        return true;
      },
      keepsOpaqueGlass() { return hqOn && !kitFailed && floatOk && !off('hqlite'); },
      setHq(on) {
        hqOn = on;
        resetAcc('hq');
        if (on && kit) kit.hqWarm();
        if (!on && kit) kit.hqFree();   // (a few hundred MB of targets at retina sizes: give them back)
      },
      dispose() {
        lamps.restore(); clip?.restore();
        if (kit) { kit.dispose(); kit = null; }
      },
      stats() {
        return {
          parts: partsOn, tier: ctx.tier(), hq: hqOn,
          lamps: lamps.count, pool: POOL,
          clip: clip ? clip.stats() : null,
          accum: { state: acc, lastReset, steps, frames: frames(), total: stepsTotal, resets, strikes, banned, skipped, lastDtMs: Math.round(lastDt * 1000) },
          kit: kit ? kit.stats() : { loaded: false, failed: kitFailed },
        };
      },
    };
    return handle;
  },
};
export default feature;
