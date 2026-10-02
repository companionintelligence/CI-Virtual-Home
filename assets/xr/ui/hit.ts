// assets/xr/ui/hit.ts : where a ray meets a flat panel. THREE-free (arrays in, arrays out), so the same maths runs in the headset, in
// the placement solver and in Node tests.
//
// A panel is a plane with a centre, a yaw (radians about +y) and a tilt (degrees, positive = the panel leans to face a head ABOVE it).
// Its three.js object is `mesh.rotation.set(rx, yaw, 0)` with `rotation.order = 'YXZ'` and `rx = -tilt`, which is what panelBasis()
// reproduces, so the mesh and the hit test cannot disagree (the Node test builds a real Object3D and compares).
import type { V3 } from '../presenter.js';

export interface Basis { r: V3; u: V3; n: V3 }
const RAD = Math.PI / 180;

/** right, up and facing-normal of a panel with this yaw (rad) and tilt (deg) */
export function panelBasis(yaw: number, tiltDeg: number): Basis {
  const a = -tiltDeg * RAD, sy = Math.sin(yaw), cy = Math.cos(yaw), sa = Math.sin(a), ca = Math.cos(a);
  return { r: [cy, 0, -sy], u: [sa * sy, ca, sa * cy], n: [ca * sy, -sa, ca * cy] };
}

export interface PanelRayHit {
  dist: number; point: V3;
  /** three.js PlaneGeometry uv: (0,0) bottom-left of the panel, (1,1) top-right */
  uv: [number, number];
  /** metres from the panel centre along its right and up axes */
  local: [number, number];
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The front face only: a ray that comes from behind a panel does not hit it (a card is never a thing to press from the other side). */
export function rayPanel(origin: V3, dir: V3, centre: V3, b: Basis, wM: number, hM: number, maxDist = Infinity, slackM = 0): PanelRayHit | null {
  const dn = dot(dir, b.n);
  if (!(dn < -1e-6)) return null;
  const t = ((centre[0] - origin[0]) * b.n[0] + (centre[1] - origin[1]) * b.n[1] + (centre[2] - origin[2]) * b.n[2]) / dn;
  if (!(t > 0) || t > maxDist) return null;
  const px = origin[0] + dir[0] * t, py = origin[1] + dir[1] * t, pz = origin[2] + dir[2] * t;
  const dx = px - centre[0], dy = py - centre[1], dz = pz - centre[2];
  const lx = dx * b.r[0] + dy * b.r[1] + dz * b.r[2], ly = dx * b.u[0] + dy * b.u[1] + dz * b.u[2];
  if (Math.abs(lx) > wM / 2 + slackM || Math.abs(ly) > hM / 2 + slackM) return null;
  return { dist: t, point: [px, py, pz], uv: [lx / wM + 0.5, ly / hM + 0.5], local: [lx, ly] };
}

/** uv to canvas pixels (the canvas's y runs down) */
export const uvToPx = (uv: [number, number], w: number, h: number): [number, number] => [uv[0] * w, (1 - uv[1]) * h];

export interface PxRect { x: number; y: number; w: number; h: number }
/** the rect (or null) that holds a canvas pixel, growing every rect by `slackPx` so a target is never smaller than the person can hit; the nearest centre wins on overlap */
export function rectAt<T extends PxRect>(rects: readonly T[], x: number, y: number, slackPx = 0): T | null {
  let best: T | null = null, bd = Infinity;
  for (const r of rects) {
    if (x < r.x - slackPx || x > r.x + r.w + slackPx || y < r.y - slackPx || y > r.y + r.h + slackPx) continue;
    const d = Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2));
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
