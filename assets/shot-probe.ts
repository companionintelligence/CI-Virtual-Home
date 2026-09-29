// Probes for the spline planner v2 and QA v2 (plan §3.5 visibility, §3.13 composition): sight lines, the 9-ray
// visibility test, the 7 × 5 ray grid over the frustum, the Core's unoccluded share, and a camera's projection —
// all against the ShotWorld's boxes through its index (assets/shot-world.ts), so they run in Node exactly as in the
// page. The ray caster is injected: `createProbe(index)` takes the world index; a caller could hand in another one
// with the same raycast() (three-mesh-bvh in the page), but the planner uses the box caster everywhere so a track
// baked in Node is the page's.
//
// Owner: S5 (shot). THREE-free.
import { K, rayPlanes, indoors, type WorldIndex, type ShotWorld, type Box6 } from './shot-world.js';

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const v3 = { sub, len, norm, cross, dot };

/** a camera looking from eye at target (roll 0), vertical fov in degrees, aspect w/h */
export type Cam = { eye: V3; fwd: V3; right: V3; up: V3; tanV: number; tanH: number };
export function camera(eye: V3, target: V3, fovDeg: number, aspect = 16 / 9): Cam {
  const fwd = norm(sub(target, eye));
  let right = cross(fwd, [0, 1, 0]); if (len(right) < 1e-6) right = [1, 0, 0]; right = norm(right);
  const up = cross(right, fwd);
  const tanV = Math.tan(fovDeg * Math.PI / 360);
  return { eye, fwd, right, up, tanV, tanH: tanV * aspect };
}
/** NDC of a world point ([x, y] in −1…1 inside the frame, z the depth along fwd; depth ≤ 0 → behind) */
export function project(c: Cam, p: V3): [number, number, number] {
  const d = sub(p, c.eye), z = dot(d, c.fwd);
  if (z <= 1e-6) return [NaN, NaN, z];
  return [dot(d, c.right) / (z * c.tanH), dot(d, c.up) / (z * c.tanV), z];
}
/** the direction of the ray through NDC (x, y) */
export function rayDir(c: Cam, x: number, y: number): V3 {
  return norm([c.fwd[0] + c.right[0] * x * c.tanH + c.up[0] * y * c.tanV, c.fwd[1] + c.right[1] * x * c.tanH + c.up[1] * y * c.tanV, c.fwd[2] + c.right[2] * x * c.tanH + c.up[2] * y * c.tanV]);
}
/** a box's 8 corners projected: { minX, maxX, minY, maxY } in NDC, or null when any corner is behind the eye */
export function projectBox(c: Cam, b: Box6) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
    const p = project(c, [x, y, z]); if (!(p[2] > 0)) return null;
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  return { minX: x0, maxX: x1, minY: y0, maxY: y1 };
}

/** what stands behind the Core at the press, as the fleet audit classes it (plan §3.14: no class above 40 % of the houses) */
export function bgClass(kind: number, name: string): string {
  if (kind === K.monitor) return 'screen';
  if (kind === K.glass || /window|curtain|glass|blind/i.test(name)) return 'window';
  if (/fire|hearth|mantel|chimney|stove/i.test(name)) return 'fireplace';
  if (/book|shelv|shelf|library/i.test(name)) return 'bookcase';
  if (/plant|palm|tree|fern|ivy|monstera|fiddle|orchid|shrub|bamboo|cactus|succulent|flower|herb|hedge|foliage/i.test(name)) return 'greenery';
  if (/art|frame|poster|painting|mirror|canvas|picture/i.test(name)) return 'art';
  if (kind === K.wall) return 'wall';
  return 'other';
}
// what a sight line is stopped by: every solid but glass (and, while the roof is on, the roofs)
const SIGHT = (roofs: boolean) => (k: number) => k !== K.glass && k !== K.hull && k !== K.walk && (roofs || k !== K.roof);

export function createProbe(index: WorldIndex) {
  const world: ShotWorld = index.world;
  /** the first thing a ray meets (boxes, then floors, ceilings and the ground): { t, k (0 for a plane), plane, i } */
  // (a planted thing's box that stands inside a storey is not a sight line's business: world-index siteInside)
  const skipInside = (skip?: (i: number) => boolean) => (i: number) => (i >= 0 && index.siteInside[i] === 1) || (!!skip && skip(i));
  function cast(o: V3, d: V3, tmax: number, roofs = false, skip?: (i: number) => boolean) {
    const h = index.raycast(o[0], o[1], o[2], d[0], d[1], d[2], tmax, SIGHT(roofs), indoors(world, o[0], o[1], o[2]) ? skipInside(skip) : skip);
    const p = rayPlanes(world, o[0], o[1], o[2], d[0], d[1], d[2], h ? h.t : tmax);
    if (p) return { t: p.t, k: 0, plane: p.kind, i: -1, n: p.kind, nrm: [0, d[1] < 0 ? 1 : -1, 0] as V3 };
    if (h) return { t: h.t, k: h.k, plane: null, i: h.i, n: h.n, nrm: [h.nx, h.ny, h.nz] as V3 };
    return null;
  }
  /** is the segment from a to b clear (nothing solid between, the ends' own 5 cm excepted)? */
  function clear(a: V3, b: V3, roofs = false, skip?: (i: number) => boolean) {
    const d = sub(b, a), L = len(d); if (L < 0.1) return true;
    const h = cast(a, norm(d), L - 0.05, roofs, skip);
    return !h || h.t < 0.05;
  }
  /** §3.5: the share of 9 rays from eye to points round a subject (± r across and up) that arrive unoccluded */
  function visibility(eye: V3, subject: V3, r = 0.15, roofs = false, skip?: (i: number) => boolean) {
    const d = norm(sub(subject, eye));
    let side = cross(d, [0, 1, 0]); if (len(side) < 1e-6) side = [1, 0, 0]; side = norm(side);
    const up = cross(side, d);
    let ok = 0;
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      const p: V3 = [subject[0] + side[0] * a * r + up[0] * b * r, subject[1] + side[1] * a * r + up[1] * b * r, subject[2] + side[2] * a * r + up[2] * b * r];
      if (clear(eye, p, roofs, skip)) ok++;
    }
    return ok / 9;
  }
  /** §3.13: a 7 × 5 grid of rays over the frustum — what each hits, how far, on which plane */
  function rayGrid(c: Cam, roofs = false, far = 60) {
    const out: Array<{ t: number; k: number; plane: string | null; key: string; i: number; x: number; y: number }> = [];
    for (let yi = 0; yi < 5; yi++) for (let xi = 0; xi < 7; xi++) {
      const x = -1 + (2 * xi + 1) / 7, y = -1 + (2 * yi + 1) / 5;
      const d = rayDir(c, x * 0.95, y * 0.95), h = cast(c.eye, d, far, roofs);
      if (!h) { out.push({ t: Infinity, k: -1, plane: 'sky', key: 'sky', i: -1, x, y }); continue; }
      // which plane: an axis and a rounded coordinate (several pier boxes of one wall are one plane)
      const p: V3 = [c.eye[0] + d[0] * h.t, c.eye[1] + d[1] * h.t, c.eye[2] + d[2] * h.t];
      const ax = Math.abs(h.nrm[0]) > 0.7 ? 0 : Math.abs(h.nrm[1]) > 0.7 ? 1 : Math.abs(h.nrm[2]) > 0.7 ? 2 : -1;
      const key = ax < 0 ? `o${h.i}` : `${ax}:${Math.round((p as number[])[ax] * 10)}:${Math.sign((h.nrm as number[])[ax])}`;
      out.push({ t: h.t, k: h.k, plane: h.plane, key, i: h.i, x, y });
    }
    return out;
  }
  /** a frame's composition from its ray grid: the largest share of rays on one plane within `near` metres, the share
   *  of sky, the share of the frame a foreground occluder (anything within 0.8 m of the lens) covers */
  function composition(c: Cam, roofs = false, near = 1.5) {
    const g = rayGrid(c, roofs);
    const byPlane = new Map<string, number>();
    let sky = 0, fore = 0, ground = 0;
    for (const r of g) {
      if (r.key === 'sky') { sky++; continue; }
      if (r.plane === 'ground') ground++;
      if (r.t < 0.8 && r.k !== 0) fore++;
      if (r.t <= near && (r.k === K.wall || r.k === 0 || r.k === K.rail)) byPlane.set(r.key, (byPlane.get(r.key) || 0) + 1);
    }
    let blank = 0; for (const v of byPlane.values()) blank = Math.max(blank, v);
    const nearWall = (d: number) => g.filter(r => r.t <= d && (r.k === K.wall || r.k === 0 || r.k === K.rail)).length / g.length;
    return { blank: blank / g.length, near2: nearWall(2), sky: sky / g.length, ground: ground / g.length, fore: fore / g.length, rays: g };
  }
  /** the share of the Core (a 3 × 3 grid over its box's faces toward the eye, and its centre) seen from eye */
  function coreSeen(eye: V3, core: Box6) {
    const pts: V3[] = [], c: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
    pts.push(c);
    for (const fx of [0.15, 0.5, 0.85]) for (const fz of [0.15, 0.5, 0.85]) pts.push([core[0] + (core[3] - core[0]) * fx, core[4] - 0.005, core[2] + (core[5] - core[2]) * fz]);
    // the face toward the eye in plan
    const dx = eye[0] - c[0], dz = eye[2] - c[2];
    const fxz = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? [core[3] + 0.002, null] : [core[0] - 0.002, null]) : (dz > 0 ? [null, core[5] + 0.002] : [null, core[2] - 0.002]);
    for (const fy of [0.3, 0.7]) for (const fs of [0.2, 0.5, 0.8]) {
      const y = core[1] + (core[4] - core[1]) * fy;
      pts.push(fxz[0] !== null ? [fxz[0] as number, y, core[2] + (core[5] - core[2]) * fs] : [core[0] + (core[3] - core[0]) * fs, y, fxz[1] as number]);
    }
    const coreIdx = new Set<number>(); for (let i = 0; i < world.kinds.length; i++) if (world.kinds[i] === K.core) coreIdx.add(i);
    let ok = 0;
    for (const p of pts) if (clear(eye, p, false, i => coreIdx.has(i))) ok++;
    return ok / pts.length;
  }
  /** the class of what stands behind the Core seen from `eye` (bgClass): the first solid past its centre along the line from
   *  the eye — not the Core, its surface, the hero set, the chair or a ceiling fixture — 'sky' for none */
  function background(centre: V3, eye: V3) {
    const d = norm(sub(centre, eye));
    const hit = index.raycast(centre[0], centre[1], centre[2], d[0], d[1], d[2], 30, k => k !== K.hull && k !== K.core && k !== K.walk && k !== K.surface && k !== K.heroSet && k !== K.chair && k !== K.fixture, i => world.kinds[i] === K.core);
    return hit ? bgClass(hit.k, hit.n) : 'sky';
  }
  return { cast, clear, visibility, rayGrid, composition, coreSeen, background };
}
export type Probe = ReturnType<typeof createProbe>;
