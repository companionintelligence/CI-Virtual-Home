// The platform block of the player (viewer.ts mounts it once, before its frame-rate controller): what assets/platform.ts says this
// device is, turned into what the player does about it. Player only: the editor, the recorder, the goldens and the thumbs never load it.
//
//   at mount     the start pixel ratio for the tier (min(devicePixelRatio, budget.dprStart), then the drawing buffer held to
//                budget.bufferMpx, which only bites on an ultrawide or a 5K screen), the sun's map size, and the page's data-tier /
//                data-form for CSS. All through the renderer, BEFORE viewer.ts's ADAPT reads the ratio, so ADAPT is not edited:
//                it sheds from where this left off and, on a desktop-high device, from exactly where it always did.
//   per frame    tick(delta), the first line of viewer.ts's frame(): the promotion mobile-low -> mobile-high (6 s at 58 fps with
//                ADAPT settled, the same bar as ADAPT's own step back up; reverted for the session after 3 s under the floor),
//                eco (a 30 fps cap with one toast, only once ADAPT has settled at ratio 1 and a 2 s window is still under the floor;
//                lifted once after 5 s of headroom), the buffer cap again when the window changes, and the sun's shadow map on a
//                phone (redrawn on a lighting change, or at 4 Hz while the view moves, not every third frame).
//   on the side  WebGL context loss (a paused player stayed blank after a restore until any input), the touch controls (coarse
//                devices, the first time the free camera is entered) and the gamepad (when one connects). Both are dynamic imports.
//
// ?no=platform turns all of it off and the player is what it was before this file. Nothing here feeds a rendered product frame.
import { getPlatform, onPlatformChange, probeXr, refinePlatform, setPageTier } from './platform.js';
import { PAGE_TIERS } from './platform-types.js';
import type { PageTier } from './platform-types.js';

/** The bar for a promotion is ADAPT's own step back up (viewer.ts: upFps 58 for upAfter 6 s); scripts/test-platform.mts keeps them equal. */
export const PROMOTE_FPS = 58;
export const PROMOTE_SECONDS = 6;
const REVERT_SECONDS = 3, ECO_SECONDS = 2, ECO_LIFT_SECONDS = 5, ECO_FRAME = 0.0285, WINDOW = 0.5, SHADOW_HZ = 4;

/** The pixel ratio held so that the drawing buffer (CSS size x ratio squared) stays within `mpx` megapixels. Never below 0.5. */
export function capRatio(pr: number, w: number, h: number, mpx: number): number {
  if (!(w > 0 && h > 0)) return pr;
  const max = Math.sqrt((mpx * 1e6) / (w * h));
  return pr <= max ? pr : Math.max(0.5, max);
}

/** What the player lets this module ask of it: small closures over viewer.ts's own state, so nothing here reaches into it. */
export type TierAct = {
  playPause(): void; shot(step: number): void; tod(): void; back(): void; enter(): void; poke(): void;
  flying(): boolean; moving(): boolean; settled(): boolean; ratio(): number; dirty(): void;
  restored(): void;     // after a context restore: glass, lights, a frame
};
export type TierCtx = { api: any; no: Set<string>; root: HTMLElement; toast(msg: string, ms?: number): void; act: TierAct; reducedMotion: boolean };
export type Platform = { tick(delta: number): number; state(): Record<string, unknown> };

const OFF: Platform = { tick: (d) => d, state: () => ({ off: true }) };

export function mountPlatform(c: TierCtx): Platform {
  if (c.no.has('platform')) return OFF;
  const { api, act } = c, renderer = api.renderer, canvas: HTMLCanvasElement = api.canvas, html = document.documentElement;
  const profile = refinePlatform(renderer.getContext());
  const budget = () => profile.budget;
  const dpr = () => window.devicePixelRatio || 1;
  const state = { eco: false, ecoLifts: 0, promoted: false, noPromote: false, lost: 0, restored: 0, capped: false, shadowRedraws: 0 };

  // ---- the data the CSS and the tests read
  const mark = () => { html.dataset.tier = profile.tier; html.dataset.form = profile.form; };
  mark();
  onPlatformChange(mark);
  if (!profile.overrides.noXr) probeXr().catch(() => {});

  // ---- the start pixel ratio: through the renderer, before viewer.ts's ADAPT reads it
  const baseRatio = () => Math.min(dpr(), budget().dprStart);
  const fitRatio = () => capRatio(baseRatio(), canvas.clientWidth, canvas.clientHeight, budget().bufferMpx);
  const start = fitRatio();
  if (Math.abs(start - renderer.getPixelRatio()) > 1e-3 && canvas.clientWidth > 0) { renderer.setPixelRatio(start); renderer.setSize(canvas.clientWidth, canvas.clientHeight); }

  // ---- the sun's map: the page made it 4096 for the editor; the tier's size is set once here, before a first frame is drawn
  let sun: any = null;
  api.scene.traverse((o: any) => { if (!sun && o.isDirectionalLight && o.castShadow) sun = o; });
  const setSun = (n: number) => {
    if (!sun || sun.shadow.mapSize.x === n) return;
    const was = sun.shadow.mapSize.x;
    sun.shadow.mapSize.set(n, n);
    sun.shadow.dispose(); sun.shadow.map = null; sun.shadow.mapPass = null;   // three allocates a new target at the new size on the next draw
    sun.shadow.normalBias *= was / n;   // the page sized the offset in texels of the old map (room-creator.html refitShadow); later refits read the new width
    act.dirty();
  };
  const sunMode = () => { if (sun) sun.shadow.autoUpdate = budget().shadowRefresh !== 'on-change'; };
  setSun(budget().shadowMap); sunMode();

  // ---- context loss (defect P1: after a loss and a restore a paused player stayed blank until any input). three's own handlers
  // preventDefault and stop its render calls; the player has to ask for a frame again, and the PMREM sky and the glass copies are GPU state
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); lost = true; state.lost++;
    (window as any).__houseViewer?.xr?.end?.('context-lost');   // (optional chaining: the XR module is a lazy import this file knows nothing of)
  });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; state.restored++; act.restored(); act.dirty(); });

  // ---- frame-rate windows, counted only while the view moves (a paused player has no frame rate)
  let winT = 0, winN = 0, okT = 0, lowT = 0, ecoT = 0, headT = 0, acc = 0, period = 1 / 60, slowSeen = false;
  let sizeDirty = true, lastCap = 0, shadowT = 0, sunSig = 0, ecoToasted = false, wasMoving = false;
  new ResizeObserver(() => { sizeDirty = true; }).observe(canvas);
  addEventListener('resize', () => { sizeDirty = true; });

  const setRatio = (pr: number) => {
    const s = (window as any).__houseViewer;
    if (s && typeof s.setPixelRatio === 'function') s.setPixelRatio(pr);   // viewer.ts's own (the seam), so ADAPT's variable follows
    else { renderer.setPixelRatio(pr); renderer.setSize(canvas.clientWidth, canvas.clientHeight); act.dirty(); }
  };
  // a tier move: the budget changes under the ratio and the sun's map, so both follow it (one reallocation each)
  const move = (t: PageTier, why: string) => { setPageTier(t, why); setRatio(fitRatio()); setSun(budget().shadowMap); sunMode(); };

  let touch: { tick(dt: number): void } | null = null, pad: { tick(dt: number): void } | null = null, loadingTouch = false, loadingPad = false;
  const fp = () => ({ api, root: c.root, toast: c.toast, act, reducedMotion: c.reducedMotion, profile });
  const loadPad = () => { if (pad || loadingPad) return; loadingPad = true; import('./viewer-pad.js').then(m => { pad = m.mountPad(fp()); }).catch(e => console.warn('viewer: gamepad support did not load', e)); };
  if (profile.can.gamepad) { addEventListener('gamepadconnected', loadPad); if (profile.signals.input.gamepads > 0) loadPad(); }

  let bound = false;
  const tick = (raw: number): number => {
    if (!bound) {   // (window.__houseViewer exists by the first frame: the mirror for the tests and the perf harness)
      const s = (window as any).__houseViewer;
      if (s) { bound = true; s.platform = profile; s.platformState = () => ({ ...state }); }
    }
    if (lost) return -1;
    const moving = act.moving();
    if (act.flying() && profile.can.touchFly && !touch && !loadingTouch) {
      loadingTouch = true;
      import('./viewer-touch.js').then(m => { touch = m.mountTouch(fp()); }).catch(e => console.warn('viewer: touch controls did not load', e));
    }
    if (touch) touch.tick(Math.min(raw, 0.1));
    if (pad) pad.tick(Math.min(raw, 0.1));

    if (sizeDirty) {
      sizeDirty = false;
      const want = fitRatio(), cur = act.ratio();
      // held to the buffer cap when the window grew past it; given back (up to the tier's start) when it shrank again
      if (cur > want + 1e-3) { setRatio(want); lastCap = want; state.capped = true; }
      else if (state.capped && Math.abs(cur - lastCap) < 1e-3 && want > cur + 1e-3) { setRatio(want); lastCap = want; if (want >= baseRatio() - 1e-3) state.capped = false; }
    }

    // the sun's shadow on a phone: not redrawn every third moving frame but at 4 Hz, and at once when the light changes or the view stops
    if (sun && budget().shadowRefresh === 'on-change') {
      const sig = sun.position.x + sun.position.y * 3 + sun.position.z * 7 + sun.intensity * 11 + sun.color.r * 13 + sun.color.g * 17 + sun.color.b * 19;
      shadowT += raw;
      if (!moving || sig !== sunSig || shadowT >= 1 / SHADOW_HZ) { sun.shadow.needsUpdate = true; shadowT = 0; sunSig = sig; state.shadowRedraws++; }
    }

    if (!moving) { winT = winN = 0; acc = 0; wasMoving = false; return raw; }
    if (!wasMoving) { wasMoving = true; winT = winN = 0; }
    if (raw > 0.25) { winT = winN = 0; return raw; }   // a tab that slept: no frame rate to read

    // eco: every second frame only marks dirty. The raw rAF gaps are kept apart from the delta the shot advances by, so time stays true.
    if (state.eco) {
      period = Math.max(0.004, Math.min(period, raw));
      if (raw > period * 1.5) slowSeen = true;
      headT += raw;
      if (headT >= ECO_LIFT_SECONDS) {
        if (!slowSeen && state.ecoLifts === 0) { state.eco = false; state.ecoLifts = 1; acc = 0; ecoT = 0; headT = 0; return raw; }
        headT = 0; slowSeen = false;
      }
      acc += raw;
      if (acc < ECO_FRAME) return -1;
      const d = acc; acc = 0;
      return d;
    }

    winT += raw; winN++;
    if (winT < WINDOW || winN < 12) return raw;
    const fps = winN / winT, span = winT;
    winT = winN = 0;
    period = Math.max(0.004, Math.min(period, 1 / Math.max(fps, 1)));
    const b = budget();

    if (profile.tier === 'mobile-low' && profile.ceiling === 'mobile-high' && !state.noPromote && act.settled()) {
      okT = fps >= PROMOTE_FPS ? okT + span : 0;
      if (okT >= PROMOTE_SECONDS) { okT = 0; state.promoted = true; lowT = 0; move('mobile-high', 'promoted: 6 s at 58 fps'); return raw; }
    } else if (state.promoted && profile.tier === 'mobile-high') {
      lowT = fps < b.fpsFloor ? lowT + span : 0;
      if (lowT >= REVERT_SECONDS) { lowT = 0; state.promoted = false; state.noPromote = true; move('mobile-low', 'reverted: 3 s under the floor'); return raw; }
    }
    // eco waits for ADAPT: at ratio 1, settled, and still under the floor for a whole window
    if (b.eco && act.settled() && act.ratio() <= 1 + 1e-3) {
      ecoT = fps < b.fpsFloor ? ecoT + span : 0;
      if (ecoT >= ECO_SECONDS) {
        ecoT = 0; state.eco = true; headT = 0; slowSeen = false; acc = 0;
        if (!ecoToasted) { ecoToasted = true; c.toast('Playing at 30 frames a second to keep your device cool.', 3600); }
      }
    } else ecoT = 0;
    return raw;
  };
  return { tick, state: () => ({ ...state, tier: profile.tier, ceiling: profile.ceiling, lost }) };
}
