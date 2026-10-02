// assets/xr/loop.ts : what runs once per XR frame, in order.
//
//   rig.tick       the blink machine, from the XR frame's own time
//   veil phase     (while the headset view is being prepared) the status card; nothing else, so the 2D house is never drawn in stereo
//   live phase     input, locomotion, ui, then the story's clock (bus.frame) and the house's own animations, then ONE
//                  renderer.render(scene, camera): straight into the XR framebuffer, no composer, no best-quality path, no
//                  realism pass. The EffectComposer cannot draw into an XR layer, and nothing it does fits a headset's budget.
//   controller     the frame-rate controller and the budget gate read what this frame cost
//
// Time. `dt` comes from the XR time argument (ms) and is clamped to 0.1 s; THREE.Clock is never used (a hidden session or a
// breakpoint would hand it a huge delta). The XR animation callback is `renderer.xr.setAnimationLoop(cb)`: NOT
// `renderer.setAnimationLoop`, which also starts a second, window-rAF loop that calls cb with no frame (measured: 102 stray calls).
//
// The sun's shadow map is static for the whole session (the house does not move; the person does): autoUpdate off, one redraw on
// the first live frame and whenever the bake is told the lighting, a roof or a door changed (XrBake.shadowNeedsUpdate sets
// renderer.shadowMap.needsUpdate). The PC tier redraws it every third frame, which is still once per render() call: one shadow
// render covers both eyes, so it never changes between them.
import type { XrBake, XrFrame, XrInput, XrLocomotion, XrUi } from './host.js';
import type { XrBudget } from '../platform-types.js';
import type { XrHud } from './hud.js';
import type { XrRigImpl } from './rig.js';
import type { GateResult, XrController } from './controller.js';

export type LoopPhase = 'veil' | 'live' | 'stopped';
export interface XrModules { input: XrInput; loco: XrLocomotion; ui: XrUi; bake: XrBake }

export interface XrLoop {
  callback(time: number, xrFrame: any): void;
  phase(): LoopPhase;
  setPhase(p: LoopPhase): void;
  /** resolves with the first XR frame (the pose exists from here) */
  firstFrame: Promise<void>;
  /** gather the Cores and screens of the (now baked) scene: they are animated as the editor's animate() animates them */
  collect(): void;
  stats(): { frames: number; liveFrames: number; cpuP50: number; cpuP95: number; deltaP50: number; calls: number; tris: number; programs: number; geometries: number; textures: number; errors: Record<string, number> };
  /** frames since the loop entered the live phase */
  liveFrames(): number;
  /** the last XR frame's time in ms (0 before the first) */
  now(): number;
  /** resolves once `n` more XR frames have been drawn (the entry steps yield on this, so the veil keeps painting between them) */
  after(n: number): Promise<void>;
}

export function createLoop(o: {
  renderer: any; scene: any; camera: any; rig: XrRigImpl; hud: XrHud;
  frameSubs: Set<(f: XrFrame) => void>;
  modules(): XrModules | null; controller(): XrController | null; budget(): XrBudget;
  onGate(r: GateResult): void; onError(where: string, e: unknown): void;
}): XrLoop {
  const { renderer, scene, camera, rig, hud } = o;
  let phase: LoopPhase = 'veil', frames = 0, live = 0, prev: number | null = null, nextGate = 4, wasBusy = false, screenSeconds = 30;   // 30 = room-creator's LIVE_SCREEN_START: screens start in their steady state
  let resolveFirst!: () => void; const firstFrame = new Promise<void>(r => { resolveFirst = r; });
  let cores: any[] = [], screens: any[] = [];
  const waiters: Array<[number, () => void]> = [];
  const cpuRing: number[] = [], dRing: number[] = [], bad: Record<string, number> = {}, off = new Set<string>();

  // a module that throws is logged once and skipped after 120 consecutive-ish failures; one broken panel must not freeze a headset
  function safe(name: string, fn: () => void) {
    if (off.has(name)) return;
    try { fn(); } catch (e) {
      bad[name] = (bad[name] || 0) + 1;
      if (bad[name] === 1) o.onError(name, e);
      if (bad[name] >= 120) { off.add(name); console.warn(`xr: ${name} stopped after repeated errors`); }
    }
  }
  const push = (a: number[], v: number) => { a.push(v); if (a.length > 240) a.shift(); };
  const pct = (a: number[], p: number): number => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

  function collect() {
    cores = []; screens = [];
    scene.traverse((ob: any) => { const u = ob.userData; if (u) { if (u.core) cores.push(u.core); if (u.screen) screens.push(u.screen); } });
  }

  function callback(time: number, xrFrame: any) {
    if (phase === 'stopped') return;
    const c0 = performance.now();
    frames++;
    if (frames === 1) resolveFirst();
    for (let i = waiters.length - 1; i >= 0; i--) if (frames >= waiters[i][0]) waiters.splice(i, 1)[0][1]();
    const dt = prev === null ? 1 / 72 : Math.min(0.1, Math.max(0, (time - prev) / 1000));
    if (prev !== null) push(dRing, time - prev);
    prev = time;
    rig.tick(time);
    const head = rig.head();
    const f: XrFrame = { time, dt, xrFrame, head, presenting: true };
    try {
      if (phase === 'veil') {
        hud.veilFrame(head, time);
        rig.group.updateMatrixWorld(true);     // the camera hangs under the rig, which the veil scene does not own: bring its matrices up to date
        renderer.render(hud.veilScene, camera);
      } else {
        const m = o.modules();
        if (m) {
          safe('input', () => m.input.update(f));
          safe('locomotion', () => m.loco.tick(f));
          safe('ui', () => m.ui.tick(f));
        }
        const busy = rig.busy();
        if (wasBusy && !busy) hud.placeChip(head, time);     // the person was moved: the chip comes with them
        wasBusy = busy;
        hud.tick(time);
        // the Cores' fans and the screens, as room-creator's animate() does for the 2D player
        for (const c of cores) safe('core', () => { c.setPower(1, false); c.tick(dt); });
        screenSeconds += dt; for (const s of screens) safe('screen', () => s.setTime(screenSeconds));
        for (const cb of o.frameSubs) safe('onFrame', () => cb(f));
        const sh = renderer.shadowMap;
        sh.autoUpdate = false;
        if (live === 0 || (o.budget().sunShadow.refresh === 'every-3rd' && live % 3 === 0)) sh.needsUpdate = true;
        renderer.render(scene, camera);
        live++;
        if (live === nextGate) {
          const r = o.controller()?.gate() ?? 'unmeasured';
          nextGate = r === 'tightened' ? live + 6 : Infinity;
          o.onGate(r);
        }
      }
    } catch (e) {
      phase = 'stopped'; o.onError('render', e);
      return;
    }
    const cpu = performance.now() - c0;
    push(cpuRing, cpu);
    o.controller()?.tick(time, cpu, xrFrame);
  }

  return {
    callback,
    phase: () => phase,
    setPhase(p) {
      phase = p;
      if (p === 'live') { live = 0; nextGate = 4; wasBusy = false; }
      if (p === 'stopped') for (const w of waiters.splice(0)) w[1]();   // nobody waits on a frame that will not come
    },
    firstFrame,
    collect,
    liveFrames: () => live,
    now: () => prev ?? 0,
    after: (n: number) => new Promise<void>(r => { waiters.push([frames + n, r]); }),
    stats() {
      const i = renderer.info;
      return {
        frames, liveFrames: live, cpuP50: pct(cpuRing, 0.5), cpuP95: pct(cpuRing, 0.95), deltaP50: pct(dRing, 0.5),
        calls: i.render.calls, tris: i.render.triangles, programs: i.programs ? i.programs.length : 0, geometries: i.memory.geometries, textures: i.memory.textures, errors: { ...bad },
      };
    },
  };
}
