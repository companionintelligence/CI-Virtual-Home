// assets/xr/rig.ts : the only thing that ever moves the person (XrRig, assets/xr/host.ts).
//
// persCamera becomes a child of one Group for the length of a session. In WebXR the camera's pose is the headset's: three's
// WebXRManager rewrites camera.matrix from the device pose every render, so anything written to camera.position is lost,
// and moving the camera is not how a person is moved. They are moved by moving this group, and only ever by a blink: the
// view fades to black (a quad child of the camera, 90 to 120 ms), the group moves on a frame whose alpha is 1, the view
// fades back in (140 to 160 ms). A smooth move is what makes people sick; there is no such path here, by design.
//
// The group rotates about the HEAD, not about its own origin. A snap turn about the origin would swing a person standing
// 40 cm from the origin 40 cm sideways; rotating about the head leaves them where they stand (rig.position += R(a) h - R(b) h,
// h the head's position in tracking space).
//
// Time is the XR frame's own (the `time` argument of the XR animation callback), never a wall clock, and the blink advances
// only from tick(): a hidden session (no frames) holds a blink where it is instead of finishing it unseen.
import type { BlinkOptions, BlinkResult, V3, XrRig } from './host.js';

export const EYE_HEIGHT_M = 1.6;   // a standing eye height, for a tracking space with no floor ('local'): where the head started is taken to be this high
const OUT_MS = 120, IN_MS = 140;   // = presenter.ts XR_COMFORT.blinkOutMs / blinkInMs
const REDUCED_MS = 80;             // reduced motion keeps the blink (a cut without it is worse) but shortens it
const TURN_OUT_MS = 50, TURN_IN_MS = 90;

export interface XrRigImpl extends XrRig {
  /** put the group in the scene and the camera under it (session start); the inverse is detach() */
  attach(): void;
  detach(): void;
  /** advance the blink machine; `now` is the XR frame time in ms. Call once per XR frame BEFORE the render. */
  tick(now: number): void;
  /** move without a fade: only while the view is already black (the entry veil). Resolves next tick. */
  placeInstant(target: { feet: V3; yawDeg?: number }): void;
  /** a tracking space with no floor ('local'): where the head started is taken to be `EYE_HEIGHT_M` above the floor */
  setEyeBase(headLocalY: number): void;
  busy(): boolean;
  /** frames ticked so far (BlinkResult.swapFrame counts these) */
  frame(): number;
}

export function createRig(o: { THREE: any; renderer: any; scene: any; camera: any; reducedMotion?: boolean }): XrRigImpl {
  const { THREE, renderer, scene, camera } = o;
  const group = new THREE.Group(); group.name = 'xr: rig';
  const Y = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), fwd = new THREE.Vector3(), q = new THREE.Quaternion();
  let feetY = 0, baseY = 0, heightOffset = 0, frameNo = 0, nowMs = 0;

  // ---- the fade: a black quad a hand in front of the eyes, drawn over everything. It is a child of the camera, which three
  // places at the head each frame; near is 0.1 for the session, so 0.3 m is inside the frustum, and 8 x 8 m covers a 170 degree view.
  const fadeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  fadeMesh.name = 'xr: fade'; fadeMesh.renderOrder = 9999; fadeMesh.frustumCulled = false; fadeMesh.visible = false;
  fadeMesh.position.set(0, 0, -0.3); fadeMesh.userData.xrOverlay = true; fadeMesh.raycast = () => {};
  let alpha = 0;
  const fade = {
    set(v: number) { alpha = Math.max(0, Math.min(1, v)); fadeMesh.material.opacity = alpha; fadeMesh.visible = alpha > 0.002; },
    get: () => alpha,
  };

  // ---- the head, in tracking space (the XR pose of THIS frame, which three has decomposed into the eye cameras before the
  // animation callback runs) and in the world (through the group)
  const hl = new THREE.Vector3(), hq = new THREE.Quaternion();
  function readHead(): void {
    const xr = renderer.xr, eyes = xr.isPresenting ? xr.getCamera().cameras : [];
    if (eyes.length) {
      hl.set(0, 0, 0); for (const e of eyes) hl.add(e.position); hl.multiplyScalar(1 / eyes.length);
      hq.copy(xr.getCamera().quaternion);
    } else { hl.copy(camera.position); hq.copy(camera.quaternion); }   // not presenting (a test ticking by hand): the camera's pose under the group
  }
  const yawOf = (quat: any): number => { fwd.set(0, 0, -1).applyQuaternion(quat); return Math.atan2(-fwd.x, -fwd.z); };
  function head() {
    readHead(); group.updateMatrixWorld(true);
    a.copy(hl); group.localToWorld(a);
    q.copy(group.quaternion).multiply(hq); fwd.set(0, 0, -1).applyQuaternion(q);
    return { pos: [a.x, a.y, a.z] as V3, dir: [fwd.x, fwd.y, fwd.z] as V3, yawDeg: (Math.atan2(-fwd.x, -fwd.z) * 180) / Math.PI };
  }

  // ---- the move itself. `yaw` (radians, optional): the world direction the head should face afterwards.
  function place(feet: V3, yaw: number | undefined): { moved: number; turned: number } {
    readHead(); group.updateMatrixWorld(true);
    const before = group.localToWorld(a.copy(hl)).clone(), yawBefore = group.rotation.y + yawOf(hq);
    const theta = yaw === undefined ? group.rotation.y : yaw - yawOf(hq);
    group.rotation.set(0, theta, 0);
    b.set(hl.x, 0, hl.z).applyAxisAngle(Y, theta);                                 // where the head would be with the group at the origin
    feetY = feet[1];
    group.position.set(feet[0] - b.x, feet[1] + baseY + heightOffset, feet[2] - b.z);
    group.updateMatrixWorld(true);
    const after = group.localToWorld(a.copy(hl));
    const turned = (((group.rotation.y + yawOf(hq) - yawBefore) * 180) / Math.PI + 540) % 360 - 180;
    return { moved: before.distanceTo(after), turned: Math.abs(turned) };
  }
  function turn(deltaRad: number): { moved: number; turned: number } {
    readHead(); group.updateMatrixWorld(true);
    const old = group.rotation.y;
    a.set(hl.x, 0, hl.z).applyAxisAngle(Y, old);
    b.set(hl.x, 0, hl.z).applyAxisAngle(Y, old + deltaRad);
    group.position.x += a.x - b.x; group.position.z += a.z - b.z;                   // keep the head where it is
    group.rotation.y = old + deltaRad; group.updateMatrixWorld(true);
    return { moved: 0, turned: Math.abs((deltaRad * 180) / Math.PI) };
  }

  // ---- the blink machine
  type Job = {
    kind: 'move' | 'turn'; feet?: V3; yaw?: number; delta?: number;
    outMs: number; inMs: number; instant: boolean; faceYaw: boolean;
    signal?: AbortSignal; resolve(r: BlinkResult): void;
    phase: 'wait' | 'out' | 'hold' | 'in'; t0: number; started: number; swapFrame: number; moved: number; turned: number;
  };
  const jobs: Job[] = [];
  let cur: Job | null = null;
  const reduced = !!o.reducedMotion;

  function enqueue(j: Omit<Job, 'phase' | 't0' | 'started' | 'swapFrame' | 'moved' | 'turned' | 'resolve'>): Promise<BlinkResult> {
    return new Promise<BlinkResult>(resolve => {
      jobs.push({ ...j, resolve, phase: 'wait', t0: 0, started: 0, swapFrame: -1, moved: 0, turned: 0 } as Job);
    });
  }
  const done = (j: Job) => { cur = null; j.resolve({ ms: Math.max(0, nowMs - j.started), headMovedM: j.moved, yawTurnedDeg: j.turned, swapFrame: j.swapFrame }); };
  function swap(j: Job) {
    const r = j.kind === 'turn' ? turn(j.delta!) : place(j.feet!, j.faceYaw ? j.yaw : undefined);
    j.moved = r.moved; j.turned = r.turned; j.swapFrame = frameNo;
  }

  function tick(now: number) {
    nowMs = now; frameNo++;
    if (!cur) { cur = jobs.shift() || null; if (cur) { cur.started = cur.t0 = now; cur.phase = cur.instant ? 'hold' : 'out'; } }
    const j = cur; if (!j) return;
    if (j.signal?.aborted && (j.phase === 'wait' || j.phase === 'out')) { j.phase = 'in'; j.inMs = Math.max(j.inMs, 1); j.t0 = now - (1 - alpha) * j.inMs; j.moved = 0; j.turned = 0; }   // cancelled before the move: fade back in from where it is, nobody moves
    if (j.phase === 'out') {
      fade.set(j.outMs <= 0 ? 1 : (now - j.t0) / j.outMs);
      if (alpha >= 1) j.phase = 'hold';                              // this frame is drawn black; the move waits for the next one
    } else if (j.phase === 'hold') {
      swap(j);                                                       // alpha is 1 for this frame too: the person sees nothing move
      if (j.instant) { done(j); return; }
      j.phase = 'in'; j.t0 = now;
    } else if (j.phase === 'in') {
      fade.set(1 - (now - j.t0) / Math.max(1, j.inMs));
      if (alpha <= 0) done(j);
    }
  }

  const ms = (out: number, inn: number, opt?: BlinkOptions) => reduced ? [REDUCED_MS, REDUCED_MS] : [opt?.outMs ?? out, opt?.inMs ?? inn];
  const rig: XrRigImpl = {
    group,
    head,
    moveTo(target, opt) {
      const [outMs, inMs] = ms(OUT_MS, IN_MS, opt);
      return enqueue({
        kind: 'move', feet: target.feet, yaw: target.yawDeg === undefined ? undefined : (target.yawDeg * Math.PI) / 180,
        outMs, inMs, instant: opt?.blink === false, faceYaw: target.yawDeg !== undefined && opt?.faceStandYaw !== false, signal: opt?.signal,
      });
    },
    snapTurn(dir, deg = 30) {
      const [outMs, inMs] = ms(TURN_OUT_MS, TURN_IN_MS);
      return enqueue({ kind: 'turn', delta: (-dir * deg * Math.PI) / 180, outMs, inMs, instant: false, faceYaw: false });
    },
    fade,
    get heightOffset() { return heightOffset; },
    set heightOffset(v: number) {
      if (v === heightOffset) return;
      heightOffset = v;
      // the height changes behind a blink like every other move of the person, in place
      readHead(); a.copy(hl); group.updateMatrixWorld(true); group.localToWorld(a);
      void enqueue({ kind: 'move', feet: [a.x, feetY, a.z], outMs: OUT_MS, inMs: IN_MS, instant: false, faceYaw: false });
    },
    floorY: () => feetY,
    attach() {
      if (group.parent !== scene) scene.add(group);
      group.add(camera); camera.add(fadeMesh);
      fade.set(0);
    },
    detach() {
      for (const j of jobs.splice(0)) j.resolve({ ms: 0, headMovedM: 0, yawTurnedDeg: 0, swapFrame: -1 });   // nobody waits on a blink that will not come
      if (cur) { const c = cur; cur = null; c.resolve({ ms: 0, headMovedM: 0, yawTurnedDeg: 0, swapFrame: -1 }); }
      camera.remove(fadeMesh); fade.set(0);
      fadeMesh.geometry.dispose(); fadeMesh.material.dispose();
      group.remove(camera); group.removeFromParent();
    },
    tick,
    placeInstant(t) {
      jobs.unshift({
        kind: 'move', feet: t.feet, yaw: t.yawDeg === undefined ? undefined : (t.yawDeg * Math.PI) / 180, outMs: 0, inMs: 0, instant: true, faceYaw: t.yawDeg !== undefined,
        resolve: () => {}, phase: 'wait', t0: 0, started: 0, swapFrame: -1, moved: 0, turned: 0,
      } as Job);
    },
    setEyeBase(headLocalY) { baseY = EYE_HEIGHT_M - headLocalY; },
    busy: () => !!cur || jobs.length > 0,
    frame: () => frameNo,
  };
  return rig;
}
