// assets/xr/comfort.ts : the rules that keep a person comfortable, as code.
//
//   No smooth motion. The person is moved only by a blink (XrRig.moveTo: black, move, back) or turned only by a snap (XrRig.snapTurn). The one
//   exception is the OPTIONAL continuous walk below, off by default, which gets a vignette that tightens with speed.
//   No camera moves the person did not make. Nothing in this module writes the camera; the rig group is the only thing that moves, and by blinks.
//   Snap turn: 30 degrees about the HEAD (the rig does that: a turn about the rig's origin would swing a person standing 40 cm off-centre sideways),
//   on a thumbstick pushed sideways, once per push (the stick must come back to rest before the next), never while a blink is running.
//   Wall guard: a person who walks into a wall in their living room (the headset knows the room, not the house) would see through it. When the
//   head is within 8 cm of a wall in plan, or inside a piece of furniture, a black quad in front of the eyes fades up over 0.4 s, and down over
//   0.25 s when they step back. It is a different quad from the blink's, so a blink and the guard never fight over one alpha.
//   Height: a seated person on a floor-level space has their eyes at 1.2 m; the rig's heightOffset raises the world's floor under them so the
//   house is the right size. It is set once at the start when the head is plainly low, and only if the UI has not set one.
import type { V3, XrFrame, XrInput, XrRig } from './host.js';
import type { XrNav } from './nav.js';
import { BODY } from './nav.js';

export const COMFORT = {
  snapDeg: 30, snapOn: 0.7, snapOff: 0.35, snapCross: 0.5, snapMinMs: 250,
  guardUpS: 0.4, guardDownS: 0.25,
  walkSpeed: 1.4, walkBody: 0.22,
  seatedBelow: 1.3, seatedAbove: 0.6, eye: 1.6,
};
export interface ComfortOptions {
  /** smooth walking on the left stick: OFF by default (a smooth move is the one that makes people sick) */
  continuous: boolean; speed: number; vignette: boolean; snapDeg: number;
}
export interface Comfort {
  options: ComfortOptions;
  tick(f: XrFrame): void;
  /** turn by one snap, about the head (what the stick does; also for the wrist menu's arrows) */
  snap(dir: 1 | -1): Promise<unknown> | null;
  /** is this source's stick being used for walking (so teleport leaves it alone) */
  walking(sourceId: number): boolean;
  /** measure the head and set the rig's height offset if the person is plainly seated; returns the offset applied */
  autoHeight(): number;
  state(): { guard: number; vignette: number; snaps: number; offset: number };
  stop(): void;
}

export function createComfort(d: {
  THREE: any; camera: any; input: XrInput; rig: XrRig; nav(): XrNav | null; busy(): boolean; options?: Partial<ComfortOptions>;
}): Comfort {
  const { THREE, camera, input, rig } = d;
  const options: ComfortOptions = { continuous: false, speed: COMFORT.walkSpeed, vignette: true, snapDeg: COMFORT.snapDeg, ...d.options };

  // ---- the quads (children of the camera, nearer than the blink's)
  const guardMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const guard = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), guardMat);
  guard.name = 'xr: wall guard'; guard.position.set(0, 0, -0.25); guard.renderOrder = 9998; guard.frustumCulled = false; guard.visible = false; guard.userData.xrOverlay = true; guard.raycast = () => {};
  // the vignette: black at the edge of the view, clear in the middle (a radial gradient; its strength is the mesh's opacity)
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  { const g = cv.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 18, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const vigTex = new THREE.CanvasTexture(cv); vigTex.generateMipmaps = false; vigTex.minFilter = THREE.LinearFilter;
  const vigMat = new THREE.MeshBasicMaterial({ map: vigTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), vigMat);
  vig.name = 'xr: vignette'; vig.position.set(0, 0, -0.2); vig.renderOrder = 9997; vig.frustumCulled = false; vig.visible = false; vig.userData.xrOverlay = true; vig.raycast = () => {};
  camera.add(guard, vig);

  let g = 0, vg = 0, snaps = 0, lastSnap = -1e9, offset = 0;
  const armed = new Set<number>();    // sources whose stick has come back to rest since their last snap
  let walker: number | null = null;   // the source whose stick walks (the left hand's)

  function snap(dir: 1 | -1) {
    if (d.busy()) return null;
    snaps++;
    return rig.snapTurn(dir, options.snapDeg);
  }
  function autoHeight(): number {
    if (rig.heightOffset !== 0) return rig.heightOffset;
    const h = rig.head().pos[1] - rig.floorY();
    if (h > COMFORT.seatedAbove && h < COMFORT.seatedBelow) { offset = COMFORT.eye - h; rig.heightOffset = offset; }
    return offset;
  }

  // ---- the walk (optional): head-relative, 1.4 m/s, stopped by the same body rules as a teleport target
  function walk(f: XrFrame, id: number, ax: [number, number]) {
    const nav = d.nav(); if (!nav || d.busy()) return 0;
    const sp = Math.hypot(ax[0], ax[1]); if (sp < 0.15) return 0;
    const yaw = (f.head.yawDeg * Math.PI) / 180, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    const k = options.speed * Math.min(1, sp) * f.dt;
    const mx = (fx * -ax[1] + rx * ax[0]) / sp * k, mz = (fz * -ax[1] + rz * ax[0]) / sp * k;
    const p = f.head.pos, y = rig.floorY();
    const ok = (x: number, z: number) => nav.walkFree(p[0], p[2], x, z, y) && nav.stand(x, z, y).clearance >= COMFORT.walkBody && nav.wallDistance(x, f.head.pos[1], z) >= COMFORT.walkBody * 0.8;
    // slide along a wall: try the full step, then each axis alone
    let dx = mx, dz = mz;
    if (!ok(p[0] + dx, p[2] + dz)) { if (ok(p[0] + dx, p[2])) dz = 0; else if (ok(p[0], p[2] + dz)) dx = 0; else { dx = 0; dz = 0; } }
    if (dx === 0 && dz === 0) return 0;
    rig.group.position.x += dx; rig.group.position.z += dz;
    void id;
    return Math.hypot(dx, dz) / Math.max(1e-3, f.dt);
  }

  function tick(f: XrFrame) {
    const nav = d.nav();
    // ---- sticks: snap turn (sideways) and, if enabled, the walk (left hand)
    walker = null;
    for (const info of input.sources()) {
      if (!info.hasThumbstick || info.isHand) continue;
      const ax = input.axes(info.id); if (!ax) continue;
      if (Math.abs(ax[0]) < COMFORT.snapOff) armed.add(info.id);
      if (options.continuous && info.handedness === 'left') { walker = info.id; continue; }
      if (armed.has(info.id) && Math.abs(ax[0]) > COMFORT.snapOn && Math.abs(ax[1]) < COMFORT.snapCross && f.time - lastSnap > COMFORT.snapMinMs && !d.busy()) {
        armed.delete(info.id); lastSnap = f.time; snap(ax[0] > 0 ? 1 : -1);
      }
    }
    let speed = 0;
    if (options.continuous && walker !== null) { const ax = input.axes(walker); if (ax) speed = walk(f, walker, ax); }
    // ---- the wall guard
    let want = 0;
    if (nav && !d.busy()) {
      const [x, y, z] = f.head.pos;
      if (nav.wallDistance(x, y, z) < BODY.wallGuard || nav.insideItem(x, y, z)) want = 1;
    }
    g += want > g ? Math.min(want - g, f.dt / COMFORT.guardUpS) : -Math.min(g - want, f.dt / COMFORT.guardDownS);
    guardMat.opacity = g; guard.visible = g > 0.003;
    // ---- the vignette follows walking speed: nothing at rest, 0.55 at full speed
    const vwant = options.vignette && options.continuous ? Math.min(1, speed / options.speed) * 0.55 : 0;
    vg += (vwant - vg) * Math.min(1, f.dt * 6);
    vigMat.opacity = vg; vig.visible = vg > 0.01;
  }

  return {
    options, tick, snap, autoHeight,
    walking: id => options.continuous && walker === id,
    state: () => ({ guard: g, vignette: vg, snaps, offset }),
    stop() {
      camera.remove(guard, vig);
      guard.geometry.dispose(); guardMat.dispose(); vig.geometry.dispose(); vigMat.dispose(); vigTex.dispose();
      if (offset !== 0 && rig.heightOffset === offset) { /* the rig is detached next; its offset dies with it */ }
    },
  };
}
export type { V3 };
