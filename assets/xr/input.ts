// assets/xr/input.ts : XrInput (assets/xr/host.ts) : what the person's hands, controllers and eyes are doing, keyed by INPUT SOURCE.
//
// Never by controller index. three's WebXRManager hands out controller slots in the order sources arrive: on a Quest with controllers
// slot 0 is the left and slot 1 the right, but with hand tracking granted on visionOS slots 0 and 1 are the hands and the transient
// pointers (one per pinch, born at selectstart and gone at selectend) are 2 and 3, and a headset that loses a hand re-deals them. So
// this module reads `session.inputSources` itself, gives each XRInputSource object an id that lives as long as the object does, and
// takes its pose from `frame.getPose(source.targetRaySpace)`. Events arrive with `event.inputSource`, which maps straight back.
//
// The kinds of source, and what each can do (InputSourceInfo says which):
//   tracked-pointer + gamepad   Quest Touch, Pico, Index, WMR: ray, thumbstick, trigger, squeeze, A/B (X/Y), haptics, hover
//   tracked-pointer + hand      Quest hand tracking: the ray is the system's pinch ray (emulated from shoulder and pinch, not a finger
//                               pointing), select = pinch, joints for drawing; no gamepad, no haptics; hover works
//   gaze                        a Cardboard-class tap or a headset button: the ray is the head's forward; select = the tap; hover works
//                               (it is just the head), and a dwell ring presses what the head rests on
//   transient-pointer           visionOS Safari: exists ONLY while pinching; no hover (the ray is born with the pinch), no gamepad
//   screen                      a touch in immersive-ar: select only
// The desktop Gamepad API (viewer-pad.ts) is the 2D player's and is not touched here.
//
// RayTargets (panels at priority 100, stair rings at 50, the floor at 0) are asked in priority order each frame for every source that has
// a ray; the highest priority hit wins, the nearer one on a tie. The press goes to the target the ray was on at selectstart and the release
// to that same target, with `hit` null if the ray has left it.
import type { InputSourceInfo, Ray, RayHit, RayTarget, V3, XrFrame, XrHost, XrInput, XrRig } from './host.js';

export type ButtonName = 'trigger' | 'squeeze' | 'primary' | 'secondary' | 'thumbstick';
// xr-standard mapping (https://immersive-web.github.io/webxr-gamepads-module/): 0 trigger, 1 squeeze, 2 touchpad, 3 thumbstick, 4 A/X, 5 B/Y
const BUTTON_INDEX: Record<ButtonName, number> = { trigger: 0, squeeze: 1, thumbstick: 3, primary: 4, secondary: 5 };
const DEAD = 0.12;
export const DWELL_MS = 1200;

export interface Pointing { target: RayTarget; hit: RayHit }
export interface XrInputImpl extends XrInput {
  /** the controller's grip (where the hand holds it), world space, or null */
  gripPose(sourceId: number): { pos: V3; quat: [number, number, number, number] } | null;
  /** 25 joint matrices (16 floats each, tracking space) of a hand, or null; computed only for sources someone asked about */
  joints(sourceId: number): Float32Array | null;
  wantJoints(sourceId: number, on: boolean): void;
  /** gaze dwell: progress 0 to 1 on the target the head rests on, null when not dwelling */
  dwell(sourceId: number): { progress: number; target: RayTarget } | null;
  /** has any transient-pointer source been seen this session (visionOS: the system draws the hands) */
  sawTransient(): boolean;
  /** drop every press (the system menu, a lost session): targets get onRelease(null, cancelled) */
  cancelAll(): void;
  /** forget everything and take the listeners off the session. Idempotent. */
  dispose(): void;
}

interface Pad { pressed: boolean; prev: boolean }
interface Src {
  id: number; src: any; info: InputSourceInfo;
  ray: Ray | null; rayAt: number; grip: { pos: V3; quat: [number, number, number, number] } | null;
  axes: [number, number] | null; pads: Partial<Record<ButtonName, Pad>>;
  selecting: boolean; selSeen: number; startSeen: boolean;
  press: Pointing | null; point: Pointing | null; hovered: RayTarget | null;
  dwell: { target: RayTarget | null; ms: number; fired: boolean };
  joints: Float32Array | null; wantJoints: boolean;
  gone: boolean; lostAt: number;
}
type Ev = { type: 'selectstart' | 'selectend' | 'select' | 'squeezestart' | 'squeezeend'; src: any };

export function createInput(host: XrHost, rig: XrRig): XrInputImpl {
  const THREE = host.THREE;
  const renderer = host.renderer;
  const session: any = renderer.xr.getSession ? renderer.xr.getSession() : null;
  const byObj = new WeakMap<object, Src>();
  const all: Src[] = [];
  let nextId = 1, transient = false, disposed = false;
  const targets: RayTarget[] = [];
  const listeners: Record<'sources' | 'menu' | 'cancel', Set<() => void>> = { sources: new Set(), menu: new Set(), cancel: new Set() };
  const emit = (k: 'sources' | 'menu' | 'cancel') => { for (const cb of [...listeners[k]]) { try { cb(); } catch (e) { console.warn('xr input listener', e); } } };
  const queue: Ev[] = [];
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), qg = new THREE.Quaternion(), d = new THREE.Vector3();
  let lastFrame: any = null, frameNo = 0;

  // ---- sources
  function infoOf(src: any, id: number): InputSourceInfo {
    const gp = src.gamepad, mode = src.targetRayMode as InputSourceInfo['targetRayMode'];
    const axes = gp && gp.axes ? gp.axes.length : 0;
    return {
      id, handedness: src.handedness === 'left' || src.handedness === 'right' ? src.handedness : 'none', targetRayMode: mode,
      hasThumbstick: axes >= 4 || (axes === 2 && !!gp && gp.mapping !== 'xr-standard'), isHand: !!src.hand,
      hover: mode !== 'transient-pointer' && mode !== 'screen',
      haptics: !!(gp && ((gp.hapticActuators && gp.hapticActuators.length) || gp.vibrationActuator)),
    };
  }
  function ensure(src: any): Src {
    let s = byObj.get(src);
    if (s) return s;
    const id = nextId++;
    s = {
      id, src, info: infoOf(src, id), ray: null, rayAt: 0, grip: null, axes: null, pads: {}, selecting: false, selSeen: -1, startSeen: false,
      press: null, point: null, hovered: null, dwell: { target: null, ms: 0, fired: false }, joints: null, wantJoints: false, gone: false, lostAt: 0,
    };
    if (src.targetRayMode === 'transient-pointer') transient = true;
    byObj.set(src, s); all.push(s);
    return s;
  }
  function refresh(): boolean {
    let changed = false;
    const live: any[] = session ? Array.from(session.inputSources || []) : [];
    for (const src of live) { if (!byObj.has(src)) changed = true; const s = ensure(src); s.gone = false; }
    for (const s of all) if (!live.includes(s.src) && !s.gone) { s.gone = true; changed = true; }
    // a gamepad can arrive after the source (Quest builds it a frame late): refresh what the source is when the facts change
    for (const s of all) if (!s.gone) {
      const fresh = infoOf(s.src, s.id);
      if (fresh.hasThumbstick !== s.info.hasThumbstick || fresh.haptics !== s.info.haptics || fresh.isHand !== s.info.isHand || fresh.handedness !== s.info.handedness) { s.info = fresh; changed = true; }
    }
    return changed;
  }

  // ---- poses (tracking space to world, through the rig)
  function worldRay(pose: any): Ray {
    const p = pose.transform.position, o = pose.transform.orientation;
    v.set(p.x, p.y, p.z).applyMatrix4(rig.group.matrixWorld);
    q.set(o.x, o.y, o.z, o.w); rig.group.getWorldQuaternion(qg); q.premultiply(qg);
    d.set(0, 0, -1).applyQuaternion(q);
    return { origin: [v.x, v.y, v.z], dir: [d.x, d.y, d.z] };
  }
  function readPoses(frame: any, now: number) {
    const ref = renderer.xr.getReferenceSpace();
    rig.group.updateMatrixWorld(true);
    for (const s of all) {
      if (s.gone) continue;
      const src = s.src;
      if (frame && ref) {
        try {
          const pose = src.targetRaySpace ? frame.getPose(src.targetRaySpace, ref) : null;
          if (pose) { s.ray = worldRay(pose); s.rayAt = now; } else if (now - s.rayAt > 150) s.ray = null;   // a blink of lost tracking keeps the last ray for 150 ms
          const gp = src.gripSpace ? frame.getPose(src.gripSpace, ref) : null;
          if (gp) {
            const p = gp.transform.position, o = gp.transform.orientation;
            v.set(p.x, p.y, p.z).applyMatrix4(rig.group.matrixWorld);
            q.set(o.x, o.y, o.z, o.w); rig.group.getWorldQuaternion(qg); q.premultiply(qg);
            s.grip = { pos: [v.x, v.y, v.z], quat: [q.x, q.y, q.z, q.w] };
          } else s.grip = null;
          if (s.wantJoints && src.hand) {
            const buf = s.joints || (s.joints = new Float32Array(25 * 16));
            if (!(frame.fillPoses && frame.fillPoses(src.hand.values(), ref, buf))) s.joints = null;
          }
        } catch { s.ray = null; }
      }
      const gp = src.gamepad;
      if (gp) {
        const a = gp.axes || [];
        const ax = a.length >= 4 ? (Math.abs(a[2]) + Math.abs(a[3]) > 0 || Math.abs(a[0]) + Math.abs(a[1]) === 0 ? [a[2], a[3]] : [a[0], a[1]]) : a.length >= 2 ? [a[0], a[1]] : null;
        s.axes = ax ? [Math.abs(ax[0]) < DEAD ? 0 : ax[0], Math.abs(ax[1]) < DEAD ? 0 : ax[1]] : null;
        for (const name of Object.keys(BUTTON_INDEX) as ButtonName[]) {
          const b = gp.buttons && gp.buttons[BUTTON_INDEX[name]];
          const pad = s.pads[name] || (s.pads[name] = { pressed: false, prev: false });
          pad.prev = pad.pressed; pad.pressed = !!(b && (b.pressed || b.value > 0.6));
        }
      } else s.axes = null;
      // the select state stands in for the trigger on sources with no gamepad (hands, gaze, transient)
      if (!gp || !gp.buttons || !gp.buttons.length) {
        const pad = s.pads.trigger || (s.pads.trigger = { pressed: false, prev: false });
        pad.prev = pad.pressed; pad.pressed = s.selecting;
      }
    }
  }

  // ---- targets
  const ordered = (): RayTarget[] => targets.filter(t => t.enabled).sort((a, b) => b.priority - a.priority);
  function pick(ray: Ray): Pointing | null {
    let best: Pointing | null = null;
    for (const t of ordered()) {
      if (best && t.priority < best.target.priority) break;
      const h = t.hit(ray);
      if (h && (!best || t.priority > best.target.priority || h.dist < best.hit.dist)) best = { target: t, hit: h };
    }
    return best;
  }
  const buzz = (s: Src, i: number, ms: number) => {
    if (!s.info.haptics) return;
    const gp = s.src.gamepad;
    try {
      if (gp.hapticActuators && gp.hapticActuators[0] && gp.hapticActuators[0].pulse) void gp.hapticActuators[0].pulse(i, ms);
      else if (gp.vibrationActuator) void gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: i, weakMagnitude: i });
    } catch { /* a controller that cannot buzz */ }
  };

  function doPress(s: Src) {
    s.selecting = true;
    if (s.press) return;
    const p = s.point;
    if (p) { s.press = p; try { p.target.onPress?.(s.id, p.hit); } catch (e) { console.warn('xr target press', e); } buzz(s, 0.25, 20); }
  }
  function doRelease(s: Src, cancelled: boolean) {
    s.selecting = false;
    const pr = s.press; if (!pr) return;
    s.press = null;
    const now = s.point && s.point.target === pr.target ? s.point.hit : null;
    try { pr.target.onRelease?.(s.id, cancelled ? null : now, cancelled); } catch (e) { console.warn('xr target release', e); }
  }

  function drain() {
    for (const e of queue.splice(0)) {
      const s = byObj.get(e.src); if (!s) continue;
      if (e.type === 'selectstart') { s.startSeen = true; doPress(s); }
      else if (e.type === 'selectend') doRelease(s, false);
      else if (e.type === 'select') s.selSeen = frameNo;   // see the end of update(): it is a click on its own only for a runtime that sends no start/end pair
    }
  }

  function update(f: XrFrame) {
    if (disposed) return;
    const now = f.time; frameNo++;
    if (refresh()) emit('sources');
    lastFrame = f.xrFrame;
    readPoses(f.xrFrame, now);
    // pointing, for everything with a ray
    for (const s of all) {
      s.point = s.ray && !s.gone ? pick(s.ray) : null;
    }
    drain();
    for (const s of all) {
      // hover: onHover(id, hit) every frame the ray is on a target (the hit moves with the hand; a panel wants its uv), onHover(id, null) once on leaving.
      // Sources with no hover (transient-pointer, screen) never hear of it.
      const t = s.info.hover && s.point ? s.point.target : null;
      if (t !== s.hovered) {
        if (s.hovered) try { s.hovered.onHover?.(s.id, null); } catch { /* ignore */ }
        s.hovered = t;
        if (t) { try { t.onHover?.(s.id, s.point!.hit); } catch { /* ignore */ } if (t.priority >= 50) buzz(s, 0.12, 10); }
      } else if (t && s.point) { try { t.onHover?.(s.id, s.point.hit); } catch { /* ignore */ } }
      // gaze dwell: the head resting on something that can be pressed presses it
      if (s.info.targetRayMode === 'gaze' && !s.gone) {
        const p = s.point && s.point.target.priority >= 50 ? s.point : null;
        if (!p || p.target !== s.dwell.target) { s.dwell.target = p ? p.target : null; s.dwell.ms = 0; s.dwell.fired = false; }
        else if (!s.dwell.fired) {
          s.dwell.ms += f.dt * 1000;
          if (s.dwell.ms >= DWELL_MS) { s.dwell.fired = true; const hold = s.selecting; doPress(s); if (!hold) doRelease(s, false); }
        }
      } else if (s.dwell.target) { s.dwell.target = null; s.dwell.ms = 0; }
      if (s.pads.secondary && s.pads.secondary.pressed && !s.pads.secondary.prev) emit('menu');
      // `select` follows selectstart in a browser and precedes it in Meta's emulator: with a start seen (before or within two frames) it is the
      // pair's own; with none it is a whole click from a runtime that sends no start/end
      if (s.selSeen >= 0) {
        if (s.startSeen) { s.selSeen = -1; s.startSeen = false; }
        else if (frameNo - s.selSeen >= 2) { s.selSeen = -1; if (!s.press) { doPress(s); doRelease(s, false); } }
      }
    }
    // sources that left: a press in flight is cancelled (the hand was lost), the id is retired
    for (let i = all.length - 1; i >= 0; i--) {
      const s = all[i]; if (!s.gone) continue;
      if (s.press) doRelease(s, true);
      if (s.hovered) { try { s.hovered.onHover?.(s.id, null); } catch { /* ignore */ } s.hovered = null; }
      byObj.delete(s.src); all.splice(i, 1);
    }
  }

  // ---- session events
  const onEv = (type: Ev['type']) => (e: any) => { if (e && e.inputSource) { ensure(e.inputSource); queue.push({ type, src: e.inputSource }); } };
  const hSS = onEv('selectstart'), hSE = onEv('selectend'), hS = onEv('select'), hQS = onEv('squeezestart'), hQE = onEv('squeezeend');
  const hVis = () => { if (session && session.visibilityState && session.visibilityState !== 'visible') api.cancelAll(); };
  const hEnd = () => api.cancelAll();
  if (session) {
    session.addEventListener('selectstart', hSS); session.addEventListener('selectend', hSE); session.addEventListener('select', hS);
    session.addEventListener('squeezestart', hQS); session.addEventListener('squeezeend', hQE);
    session.addEventListener('visibilitychange', hVis); session.addEventListener('end', hEnd);
  }

  const find = (id: number) => all.find(s => s.id === id && !s.gone) || null;
  const api: XrInputImpl = {
    sources: () => all.filter(s => !s.gone).map(s => s.info),
    rayPose(id) { const s = find(id); return s ? s.ray : null; },
    axes(id) { const s = find(id); return s ? s.axes : null; },
    button(id, name) {
      const s = find(id); if (!s) return null;
      const p = s.pads[name]; if (!p) return name === 'trigger' ? { pressed: s.selecting, edge: 0 } : null;
      return { pressed: p.pressed, edge: p.pressed === p.prev ? 0 : p.pressed ? 1 : -1 };
    },
    haptic(id, intensity, ms) { const s = find(id); if (s) buzz(s, intensity, ms); },
    addTarget(t) {
      targets.push(t);
      return () => { const i = targets.indexOf(t); if (i >= 0) targets.splice(i, 1); for (const s of all) if (s.press && s.press.target === t) doRelease(s, true); };
    },
    pointing(id) { const s = find(id); return s ? s.point : null; },
    on(ev, cb) { listeners[ev].add(cb); return () => { listeners[ev].delete(cb); }; },
    update,
    gripPose(id) { const s = find(id); return s ? s.grip : null; },
    joints(id) { const s = find(id); return s ? s.joints : null; },
    wantJoints(id, on) { const s = find(id); if (s) s.wantJoints = on; },
    dwell(id) { const s = find(id); if (!s || !s.dwell.target || s.dwell.fired) return null; return { progress: Math.min(1, s.dwell.ms / DWELL_MS), target: s.dwell.target }; },
    sawTransient: () => transient,
    cancelAll() {
      let any = false;
      for (const s of all) if (s.press) { doRelease(s, true); any = true; }
      queue.length = 0;
      if (any) emit('cancel');
    },
    dispose() {
      if (disposed) return;
      api.cancelAll(); disposed = true;
      if (session) {
        session.removeEventListener('selectstart', hSS); session.removeEventListener('selectend', hSE); session.removeEventListener('select', hS);
        session.removeEventListener('squeezestart', hQS); session.removeEventListener('squeezeend', hQE);
        session.removeEventListener('visibilitychange', hVis); session.removeEventListener('end', hEnd);
      }
      all.length = 0; targets.length = 0; for (const k of Object.keys(listeners) as Array<keyof typeof listeners>) listeners[k].clear();
      void lastFrame;
    },
  };
  return api;
}
