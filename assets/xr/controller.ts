// assets/xr/controller.ts : the headset's frame-rate controller, and the budget gate on the first stereo frames.
//
// A headset has to hold its refresh rate (72 to 120 Hz) or the person feels it, so quality here follows a measured frame
// time, in a fixed order, slowly:
//
//   after 1 s of warm-up, windows of 2 s; a window is "over" when the median XR frame delta is more than 1.25 periods (the
//   compositor is repeating frames) or a fifth of the deltas are more than 1.5 periods; one step down per over window, then
//   half a window to settle:
//     1. fixed foveation up (cheap, the edges of the eye buffer render coarser)           renderer.xr.setFoveation
//     2. the viewport scale down: XRView.requestViewportScale(1, .85, .7, .6) where the browser has it, never below the tier's
//        framebuffer range. r169 cannot change framebufferScaleFactor while presenting, so this is the only resolution lever.
//     3. the LOD radius smaller (bake.refocus reads budget.lodRadiusM), twice
//     4. stop, with a comfort notice
//   Once, after 10 s with no over window, the LAST step is taken back (a hitch at a shader compile is not a verdict).
//   Where the tier offers a higher refresh rate (Quest 3 class: 72 start, 90 up) it is asked for once, after 12 s clean with the
//   CPU well under the shorter period; if a window is over afterwards the rate goes back before anything else is shed.
//
// The gate is separate: after the first stereo frames renderer.info is read against XrBudget (calls, triangles, programs and the
// bake's texture bytes). Over means a smaller LOD radius, twice; still over means the home is too detailed for this headset and
// the session ends with a sentence that says so. It is enforced only when the bake did something (a stub bake leaves the 2D
// house in place, and a budget for a house that was not cheapened would refuse everything).
import type { XrBudget } from '../platform-types.js';
import type { BakeReport, XrBake } from './host.js';

const WARM_MS = 1000, WIN_MS = 2000, SETTLE_MS = 1000, RESTORE_MS = 10_000, RATE_UP_MS = 12_000;
const median = (a: number[]): number => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

export interface XrControllerState {
  stage: number; steps: string[]; applied: string[]; stopped: boolean; restored: boolean; rateHz: number; foveation: number | null; viewportScale: number;
  windows: Array<{ t: number; medianMs: number; late: number; cpuMs: number; over: boolean; action: string }>;
  gate: { checked: boolean; enforced: boolean; calls: number; tris: number; programs: number; limit: number; tightened: number };
}
export type GateResult = 'pending' | 'ok' | 'tightened' | 'too-detailed' | 'unmeasured';

export interface XrController {
  /** every XR frame: its time (ms), this callback's CPU ms (the render submission), the XRFrame (viewport scale needs it) */
  tick(time: number, cpuMs: number, xrFrame: any): void;
  /** call a few frames after the first live stereo frame (and again after a 'tightened'): reads renderer.info against the budget */
  gate(): GateResult;
  /** a standalone session promoted gen1 to gen2: the numbers it is held to change */
  setBudget(b: XrBudget): void;
  state(): XrControllerState;
}

export function createController(o: {
  renderer: any; session: any; budget: XrBudget; bake: XrBake; head(): [number, number, number]; notice(text: string): void; log(...a: any[]): void; callsOverride?: number | null;
}): XrController {
  const { renderer, session } = o;
  let budget = o.budget;
  const xr = renderer.xr;
  const hasVS = typeof (globalThis as any).XRView !== 'undefined' && typeof (globalThis as any).XRView.prototype.requestViewportScale === 'function';
  const rateOf = (): number => (typeof session.frameRate === 'number' && session.frameRate > 0 ? session.frameRate : budget.refreshHz.start);
  let rate = rateOf(), period = 1000 / rate;

  // ---- the ladder
  type Step = { name: string; apply(): void; undo(): void };
  const st: XrControllerState = {
    stage: 0, steps: [], applied: [], stopped: false, restored: false, rateHz: rate,
    foveation: budget.foveation ? budget.foveation.start : null, viewportScale: 1,
    windows: [], gate: { checked: false, enforced: false, calls: 0, tris: 0, programs: 0, limit: 0, tightened: 0 },
  };
  let scaleDirty = false;
  const fov = (to: number): Step => { let was = 0; return { name: `foveation ${to.toFixed(2)}`, apply() { was = st.foveation ?? to; st.foveation = to; xr.setFoveation(to); }, undo() { st.foveation = was; xr.setFoveation(was); } }; };
  const vs = (to: number): Step => { let was = 1; return { name: `viewport ${to}`, apply() { was = st.viewportScale; st.viewportScale = to; scaleDirty = true; }, undo() { st.viewportScale = was; scaleDirty = true; } }; };
  const lod = (): Step => { let was = 0; return { name: 'lod', apply() { was = budget.lodRadiusM; budget.lodRadiusM = Math.max(6, budget.lodRadiusM * 0.8); }, undo() { budget.lodRadiusM = was; } }; };
  const steps: Step[] = [];
  let ladderFor: any = null;
  // built on the first frame, when the layer exists: only a layer that has `fixedFoveation` can be told to use more of it
  const buildLadder = () => {
    steps.length = 0;
    const layer = xr.getBaseLayer?.();
    ladderFor = layer;
    if (budget.foveation && layer && 'fixedFoveation' in layer) {
      const f = budget.foveation; for (let v = f.start + 0.17; v < f.max - 0.01; v += 0.17) steps.push(fov(v)); if (f.max > f.start) steps.push(fov(f.max));
    }
    if (hasVS) for (const s of [0.85, 0.7, 0.6]) if (budget.framebufferScale.start * s >= budget.framebufferScale.min - 1e-6) steps.push(vs(s));
    steps.push(lod(), lod());
    st.steps = steps.map(s => s.name);
  };

  // ---- the windows
  let last: number | null = null, t0 = -1, winStart = -1, lastChange = -1e9, cleanFrom = -1;
  let deltas: number[] = [], cpu: number[] = [], rateRaised = false, rateTried = false;
  const bake = o.bake;
  const raiseRate = (hz: number): boolean => {
    try { const f = session.updateTargetFrameRate; if (typeof f !== 'function' || !(session.supportedFrameRates && Array.from(session.supportedFrameRates).includes(hz))) return false; void f.call(session, hz).catch?.(() => {}); } catch { return false; }
    rate = hz; period = 1000 / hz; st.rateHz = hz; return true;
  };
  function evaluate(time: number) {
    const med = median(deltas), late = deltas.length ? deltas.filter(d => d > 1.5 * period).length / deltas.length : 0, cpuMed = median(cpu);
    const over = deltas.length >= 20 && (med > 1.25 * period || late > 0.2);
    let action = '';
    if (over && time - lastChange >= SETTLE_MS && !st.stopped) {
      if (rateRaised) { raiseRate(budget.refreshHz.start); rateRaised = false; action = `rate back to ${budget.refreshHz.start}`; }
      else if (st.stage < steps.length) { const s = steps[st.stage++]; s.apply(); st.applied.push(s.name); action = s.name; if (s.name === 'lod') bake.refocus(o.head()); }
      else { st.stopped = true; action = 'stop'; o.notice('This home is demanding for your headset. The picture may stutter.'); }
      lastChange = time; cleanFrom = -1;
    } else if (!over) {
      if (cleanFrom < 0) cleanFrom = time;
      if (st.stage > 0 && !st.restored && time - cleanFrom >= RESTORE_MS && !st.stopped) {   // once: take the last step back
        const s = steps[--st.stage]; s.undo(); st.applied.pop(); st.restored = true; action = `restore ${s.name}`; if (s.name === 'lod') bake.refocus(o.head()); cleanFrom = time;
      } else if (st.stage === 0 && !rateTried && budget.refreshHz.allowUp > budget.refreshHz.start && time - cleanFrom >= RATE_UP_MS && cpuMed < 0.55 * (1000 / budget.refreshHz.allowUp)) {
        rateTried = true; if (raiseRate(budget.refreshHz.allowUp)) { rateRaised = true; action = `rate up to ${budget.refreshHz.allowUp}`; lastChange = time; }
      }
    }
    st.windows.push({ t: Math.round(time), medianMs: Math.round(med * 100) / 100, late: Math.round(late * 100) / 100, cpuMs: Math.round(cpuMed * 100) / 100, over, action });
    if (st.windows.length > 60) st.windows.shift();
    if (action) o.log('xr controller:', action, { medianMs: med, late, cpuMs: cpuMed });
  }

  return {
    tick(time, cpuMs, xrFrame) {
      if (ladderFor === null) buildLadder();
      if (scaleDirty || st.viewportScale !== 1) {   // (the request is per view and may not outlive its frame: ask again every frame until it is back at 1)
        try {
          const pose = xrFrame?.getViewerPose?.(xr.getReferenceSpace());
          if (pose) for (const v of pose.views) v.requestViewportScale?.(st.viewportScale);
          if (st.viewportScale === 1) scaleDirty = false;
        } catch { /* a view that refuses a scale keeps the one it has */ }
      }
      if (last !== null) { const d = time - last; if (d > 0 && d < 500) { deltas.push(d); cpu.push(cpuMs); } }
      last = time;
      if (t0 < 0) { t0 = time; return; }
      if (time - t0 < WARM_MS) { deltas = []; cpu = []; winStart = time; return; }
      if (session.visibilityState && session.visibilityState !== 'visible') { deltas = []; cpu = []; winStart = time; return; }   // a system overlay throttles frames; that is not the house
      if (winStart < 0) winStart = time;
      if (time - winStart >= WIN_MS) { evaluate(time); deltas = []; cpu = []; winStart = time; }
    },
    gate() {
      const rep: BakeReport | null = bake.report();
      const enforced = !!rep && (rep.cells > 0 || rep.mergedMeshes > 0);
      const info = renderer.info;
      const calls = info.render.calls, tris = info.render.triangles, programs = info.programs ? info.programs.length : 0;
      const hz = rate, keys = Object.keys(budget.callsSubmitted).map(Number).sort((a, b) => a - b);
      const key = keys.find(k => k >= hz - 0.5) ?? keys[keys.length - 1];
      const limit = o.callsOverride ?? budget.callsSubmitted[key];
      Object.assign(st.gate, { checked: true, enforced, calls, tris, programs, limit });
      o.log('xr budget:', { calls, tris, programs, limit, trisLimit: budget.trisSubmitted, programsLimit: budget.programs, enforced, bake: rep });
      if (!enforced) return 'unmeasured';
      const over = calls > limit || tris > budget.trisSubmitted || programs > budget.programs || (rep!.overBudget !== null && rep!.overBudget.what === 'textureMB');
      if (!over) return 'ok';
      if (st.gate.tightened >= 2) return 'too-detailed';
      st.gate.tightened++;
      budget.lodRadiusM = Math.max(6, budget.lodRadiusM * 0.7);
      bake.refocus(o.head());
      return 'tightened';
    },
    setBudget(b) {
      // gen1 to gen2: keep what the controller has already moved (foveation, viewport scale) and take the new ceilings
      const kept = budget.lodRadiusM; budget = b; budget.lodRadiusM = Math.max(kept, b.lodRadiusM);
      const applied = st.applied.slice(), stage = st.stage; buildLadder(); st.stage = Math.min(stage, steps.length); st.applied = applied;
    },
    state: () => st,
  };
}
