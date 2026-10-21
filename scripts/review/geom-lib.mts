// The pure geometry behind the two geometry detectors (scripts/review/zfight.mts, scripts/review/collide.mts). Node only: no browser,
// no THREE, no product code, so scripts/test-geometry-detectors.mts can pin every function in a second.
//
//   depth precision   quantumAt, flickerBeyond            what a 24-bit depth buffer can tell apart at a distance
//   coplanar overlap  coplanarPairs                        triangle planes within a tolerance, same facing, overlapping extents
//   convex hulls      boxHull, meshHull                    a hull is {verts, axes, edges, planes}: what SAT and the volume sampler read
//   penetration       satPenetration, overlapVolume        the minimum translation distance of two convex hulls, and the volume they share
//   clustering        groupCount, topN                     small helpers the report builders share
//
// Units are metres and radians throughout; the reports convert to centimetres and millimetres at the edge. Nothing here reads a wall
// clock or Math.random: two runs on the same input write the same bytes.

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------------------------------------------------------------
// vectors (plain arrays: the hot loops below inline their own arithmetic)
// ---------------------------------------------------------------------------------------------------------------------------------
export const sub = (a: ArrayLike<number>, b: ArrayLike<number>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: ArrayLike<number>, b: ArrayLike<number>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: ArrayLike<number>, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: ArrayLike<number>, b: ArrayLike<number>): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: ArrayLike<number>) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: ArrayLike<number>): Vec3 => { const l = len(a); return l < 1e-300 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------------------------------------------------------------------------
// depth precision
// ---------------------------------------------------------------------------------------------------------------------------------
/** The smallest depth difference (metres, along the view axis) a `bits`-bit fixed-point depth buffer tells apart at eye distance `z`,
 *  for a perspective projection with the given near and far planes: dz = (f - n) z^2 / (f n 2^bits). At near 0.2, far 160: 30 um at
 *  10 m, 0.12 mm at 20 m, 0.5 mm at 40 m, 3 mm at 100 m. */
export function quantumAt(z: number, near: number, far: number, bits = 24): number {
  return ((far - near) * z * z) / (far * near * 2 ** bits);
}
/** The eye distance beyond which two surfaces `gap` metres apart (along the view axis) are no longer resolved by the depth buffer: the
 *  z at which quantumAt(z) equals the gap. Zero for coplanar surfaces: they fight at every distance. */
export function flickerBeyond(gap: number, near: number, far: number, bits = 24): number {
  if (gap <= 0) return 0;
  return Math.sqrt((gap * far * near * 2 ** bits) / (far - near));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// coplanar triangle overlap (zfight.mts --geom, the cross-check of the render experiment)
// ---------------------------------------------------------------------------------------------------------------------------------
/** One mesh as a triangle soup in world space. `side`: 0 front faces only, 1 back, 2 both (a DoubleSide material fights from either side). */
export interface SoupMesh { id: number; pos: ArrayLike<number>; index?: ArrayLike<number> | null; side?: 0 | 1 | 2; resolved?: boolean }
export interface CoplanarPair {
  a: number; b: number;            // mesh ids, a < b
  area: number;                    // m^2 of overlap, summed over the triangle pairs
  tris: number;                    // triangle pairs that overlap
  gapMin: number; gapMax: number;  // metres between the two planes over the overlap (0 = coplanar)
  at: Vec3;                        // centre of the overlap (area-weighted)
  normal: Vec3;                    // the canonical plane normal (a's facing)
  opposed: boolean;                // the two surfaces face opposite ways but one is double-sided: it shows through
}
export interface CoplanarOpts { tol?: number; minArea?: number; normalCos?: number; cell?: number }

/** Every pair of meshes with triangles whose planes lie within `tol` metres of each other (both ways: each triangle's vertices within `tol`
 *  of the other's plane), whose normals agree within acos(normalCos), that face the same way (or one is double-sided), and whose
 *  overlap in the plane has area of at least `minArea` m^2. Triangles of one mesh never pair with each other. Deterministic. */
export function coplanarPairs(meshes: SoupMesh[], opts: CoplanarOpts = {}): CoplanarPair[] {
  const tol = opts.tol ?? 0.002, minArea = opts.minArea ?? 1e-4, ncos = opts.normalCos ?? 0.9998, cell = opts.cell ?? 0.5;
  // 1. flatten every triangle
  const T: { mesh: number; side: number; p: Float64Array; n: Vec3; area: number; mn: Vec3; mx: Vec3 }[] = [];
  meshes.forEach((m, mi) => {
    const P = m.pos, I = m.index, count = I ? I.length / 3 : P.length / 9;
    for (let t = 0; t < count; t++) {
      const i0 = I ? I[t * 3] : t * 3, i1 = I ? I[t * 3 + 1] : t * 3 + 1, i2 = I ? I[t * 3 + 2] : t * 3 + 2;
      const p = new Float64Array([P[i0 * 3], P[i0 * 3 + 1], P[i0 * 3 + 2], P[i1 * 3], P[i1 * 3 + 1], P[i1 * 3 + 2], P[i2 * 3], P[i2 * 3 + 1], P[i2 * 3 + 2]]);
      const e1: Vec3 = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], e2: Vec3 = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
      const c = cross(e1, e2), l = len(c);
      if (l < 2e-8) continue;   // under 1 cm^2 / 2 ... a sliver has no plane worth fighting over
      const n: Vec3 = [c[0] / l, c[1] / l, c[2] / l];
      T.push({ mesh: mi, side: m.side ?? 0, p, n, area: l / 2,
        mn: [Math.min(p[0], p[3], p[6]), Math.min(p[1], p[4], p[7]), Math.min(p[2], p[5], p[8])],
        mx: [Math.max(p[0], p[3], p[6]), Math.max(p[1], p[4], p[7]), Math.max(p[2], p[5], p[8])] });
    }
  });
  // 2. bucket by canonical normal (sign fixed by the largest component) and plane offset (tol-wide bins)
  const canon = T.map(t => { const k = Math.abs(t.n[0]) >= Math.abs(t.n[1]) && Math.abs(t.n[0]) >= Math.abs(t.n[2]) ? 0 : Math.abs(t.n[1]) >= Math.abs(t.n[2]) ? 1 : 2; return t.n[k] < 0 ? -1 : 1; });
  const planeD = (t: typeof T[number], s: number) => s * (t.n[0] * (t.p[0] + t.p[3] + t.p[6]) + t.n[1] * (t.p[1] + t.p[4] + t.p[7]) + t.n[2] * (t.p[2] + t.p[5] + t.p[8])) / 3;
  const Q = 400, buckets = new Map<string, number[]>();
  const axisAligned = (t: typeof T[number]) => Math.max(Math.abs(t.n[0]), Math.abs(t.n[1]), Math.abs(t.n[2])) > 0.99999;
  const keyOf = (ix: number, iy: number, iz: number, db: number) => `${ix},${iy},${iz},${db}`;
  T.forEach((t, i) => {
    const s = canon[i], cx = t.n[0] * s, cy = t.n[1] * s, cz = t.n[2] * s, d = planeD(t, s);
    const ix = Math.round(cx * Q), iy = Math.round(cy * Q), iz = Math.round(cz * Q), db = Math.round(d / tol);
    const k = keyOf(ix, iy, iz, db); (buckets.get(k) || buckets.set(k, []).get(k)!).push(i);
  });
  // 3. pairs: same bucket, or the neighbouring offset bin (and, for a slanted plane, neighbouring normal bins)
  const agg = new Map<string, { a: number; b: number; area: number; tris: number; gmin: number; gmax: number; cx: number; cy: number; cz: number; n: Vec3; opposed: boolean }>();
  const seen = new Set<number>();
  const N = T.length;
  const consider = (i: number, j: number) => {
    if (j <= i) return;
    const A = T[i], B = T[j];
    if (A.mesh === B.mesh) return;
    const key = i * N + j; if (seen.has(key)) return; seen.add(key);
    if (A.mn[0] > B.mx[0] + tol || B.mn[0] > A.mx[0] + tol || A.mn[1] > B.mx[1] + tol || B.mn[1] > A.mx[1] + tol || A.mn[2] > B.mx[2] + tol || B.mn[2] > A.mx[2] + tol) return;
    const c = dot(A.n, B.n);
    if (Math.abs(c) < ncos) return;
    // which half-space each surface shows to: +1 along its own normal (front), -1 (back), 0 both (double). Two surfaces fight where the
    // half-spaces they show to meet, in A's frame B's normal is c's sign times its own
    const sa = A.side, sb = B.side;
    const visA = sa === 2 ? 0 : sa === 1 ? -1 : 1, visB = sb === 2 ? 0 : (sb === 1 ? -1 : 1) * (c > 0 ? 1 : -1);
    let opposed = false;
    if (visA !== 0 && visB !== 0 && visA !== visB) return;
    if (c < 0) opposed = true;
    // both planes within tol of each other's vertices
    const dA = dot(A.n, [A.p[0], A.p[1], A.p[2]]);
    let gmax = 0, gmin = Infinity;
    for (let v = 0; v < 3; v++) { const g = Math.abs(dot(A.n, [B.p[v * 3], B.p[v * 3 + 1], B.p[v * 3 + 2]]) - dA); if (g > tol) return; gmax = Math.max(gmax, g); gmin = Math.min(gmin, g); }
    const dB = dot(B.n, [B.p[0], B.p[1], B.p[2]]);
    for (let v = 0; v < 3; v++) { const g = Math.abs(dot(B.n, [A.p[v * 3], A.p[v * 3 + 1], A.p[v * 3 + 2]]) - dB); if (g > tol) return; }
    const ov = triOverlap(A.p, B.p, A.n);
    if (!ov || ov.area < minArea * 0.25) return;
    const ma = meshes[A.mesh].id, mb = meshes[B.mesh].id, lo = Math.min(ma, mb), hi = Math.max(ma, mb), pk = `${lo}:${hi}`;
    let g = agg.get(pk);
    if (!g) agg.set(pk, g = { a: lo, b: hi, area: 0, tris: 0, gmin: Infinity, gmax: 0, cx: 0, cy: 0, cz: 0, n: A.n, opposed });
    g.area += ov.area; g.tris++; g.gmin = Math.min(g.gmin, gmin); g.gmax = Math.max(g.gmax, gmax);
    g.cx += ov.c[0] * ov.area; g.cy += ov.c[1] * ov.area; g.cz += ov.c[2] * ov.area;
  };
  // a uniform grid over the bucket (and its neighbour bins) keeps a big floor plane from pairing every triangle with every other
  const probe = (list: number[], other: number[]) => {
    const grid = new Map<string, number[]>();
    for (const j of other) {
      const t = T[j];
      const x0 = Math.floor((t.mn[0] - tol) / cell), x1 = Math.floor((t.mx[0] + tol) / cell), y0 = Math.floor((t.mn[1] - tol) / cell), y1 = Math.floor((t.mx[1] + tol) / cell), z0 = Math.floor((t.mn[2] - tol) / cell), z1 = Math.floor((t.mx[2] + tol) / cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) { const k = 'big'; (grid.get(k) || grid.set(k, []).get(k)!).push(j); continue; }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = `${x},${y},${z}`; (grid.get(k) || grid.set(k, []).get(k)!).push(j); }
    }
    const big = grid.get('big');
    for (const i of list) {
      const t = T[i];
      const x0 = Math.floor((t.mn[0] - tol) / cell), x1 = Math.floor((t.mx[0] + tol) / cell), y0 = Math.floor((t.mn[1] - tol) / cell), y1 = Math.floor((t.mx[1] + tol) / cell), z0 = Math.floor((t.mn[2] - tol) / cell), z1 = Math.floor((t.mx[2] + tol) / cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) { for (const j of other) consider(Math.min(i, j), Math.max(i, j)); continue; }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const c = grid.get(`${x},${y},${z}`); if (c) for (const j of c) consider(Math.min(i, j), Math.max(i, j)); }
      if (big) for (const j of big) consider(Math.min(i, j), Math.max(i, j));
    }
  };
  for (const [k, list] of buckets) {
    const [ix, iy, iz, db] = k.split(',').map(Number);
    const sample = T[list[0]];
    const rx = axisAligned(sample) ? [0] : [-1, 0, 1];
    for (const dx of rx) for (const dy of rx) for (const dz of rx) for (const dd of [0, 1]) {
      if (dx === 0 && dy === 0 && dz === 0 && dd === 0) { probe(list, list); continue; }
      const nb = buckets.get(keyOf(ix + dx, iy + dy, iz + dz, db + dd));
      if (nb && (dd === 1 || dx !== 0 || dy !== 0 || dz !== 0)) probe(list, nb);
    }
  }
  const out: CoplanarPair[] = [];
  for (const g of agg.values()) {
    if (g.area < minArea) continue;
    out.push({ a: g.a, b: g.b, area: g.area, tris: g.tris, gapMin: g.gmin === Infinity ? 0 : g.gmin, gapMax: g.gmax, at: [g.cx / g.area, g.cy / g.area, g.cz / g.area], normal: g.n, opposed: g.opposed });
  }
  out.sort((p, q) => q.area - p.area || p.a - q.a || p.b - q.b);
  return out;
}

/** Overlap of two coplanar-ish triangles (9 numbers each) in the plane of normal n: Sutherland-Hodgman of one against the other in 2D. */
export function triOverlap(a: ArrayLike<number>, b: ArrayLike<number>, n: Vec3): { area: number; c: Vec3 } | null {
  // an orthonormal basis of the plane
  const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(n, ref)), v = cross(n, u);
  const to2 = (p: ArrayLike<number>, o: number): [number, number] => [p[o] * u[0] + p[o + 1] * u[1] + p[o + 2] * u[2], p[o] * v[0] + p[o + 1] * v[1] + p[o + 2] * v[2]];
  let poly: [number, number][] = [to2(a, 0), to2(a, 3), to2(a, 6)];
  const clip: [number, number][] = [to2(b, 0), to2(b, 3), to2(b, 6)];
  const area2 = (p: [number, number][]) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
  if (area2(clip) < 0) clip.reverse();
  if (area2(poly) < 0) poly.reverse();
  for (let i = 0; i < 3 && poly.length; i++) {
    const c0 = clip[i], c1 = clip[(i + 1) % 3];
    const inside = (p: [number, number]) => (c1[0] - c0[0]) * (p[1] - c0[1]) - (c1[1] - c0[1]) * (p[0] - c0[0]) >= -1e-12;
    const next: [number, number][] = [];
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length], pin = inside(p), qin = inside(q);
      if (pin) next.push(p);
      if (pin !== qin) {
        const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = c1[0] - c0[0], d2y = c1[1] - c0[1], den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) > 1e-18) { const s = ((c0[0] - p[0]) * d2y - (c0[1] - p[1]) * d2x) / den; next.push([p[0] + s * d1x, p[1] + s * d1y]); }
      }
    }
    poly = next;
  }
  if (poly.length < 3) return null;
  const area = Math.abs(area2(poly));
  if (area <= 0) return null;
  let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
  // back to 3D: the point of the plane through a's first vertex
  const off = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
  const c: Vec3 = [u[0] * cx + v[0] * cy + n[0] * off, u[1] * cx + v[1] * cy + n[1] * off, u[2] * cx + v[2] * cy + n[2] * off];
  return { area, c };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// convex hulls
// ---------------------------------------------------------------------------------------------------------------------------------
/** A convex part. `verts` all its vertices (x,y,z flat), `axes` the unit face normals (SAT axes), `edges` the unit directions of its real
 *  edges (the edge-edge SAT axes are their cross products), `planes` (nx,ny,nz,d) the outward face planes (the inside test of the volume
 *  sampler; empty for a flat part: it has no volume). `box` is set for an oriented box: its centre, axes and half extents are exact. */
export interface Hull {
  verts: Float64Array; axes: Float64Array; edges: Float64Array; planes: Float64Array;
  min: Vec3; max: Vec3; flat: boolean;
  box?: { c: Vec3; u: [Vec3, Vec3, Vec3]; h: Vec3 };
}

const bounds = (v: Float64Array): { min: Vec3; max: Vec3 } => {
  const mn: Vec3 = [Infinity, Infinity, Infinity], mx: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { if (v[i + k] < mn[k]) mn[k] = v[i + k]; if (v[i + k] > mx[k]) mx[k] = v[i + k]; }
  return { min: mn, max: mx };
};

/** An oriented box from a column-major 4x4 world matrix and the half extents / centre of its local geometry box. A shear (non-orthogonal
 *  columns) falls back to the axis-aligned box of the eight corners. */
export function boxHull(m: ArrayLike<number>, half: Vec3, centre: Vec3 = [0, 0, 0]): Hull {
  const ax: Vec3[] = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
  const sc: Vec3 = [len(ax[0]), len(ax[1]), len(ax[2])];
  const u = ax.map((a, i) => (sc[i] < 1e-12 ? ([i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0] as Vec3) : scale(a, 1 / sc[i]))) as [Vec3, Vec3, Vec3];
  const c: Vec3 = [m[0] * centre[0] + m[4] * centre[1] + m[8] * centre[2] + m[12], m[1] * centre[0] + m[5] * centre[1] + m[9] * centre[2] + m[13], m[2] * centre[0] + m[6] * centre[1] + m[10] * centre[2] + m[14]];
  const h: Vec3 = [half[0] * sc[0], half[1] * sc[1], half[2] * sc[2]];
  const ortho = Math.abs(dot(u[0], u[1])) < 1e-6 && Math.abs(dot(u[0], u[2])) < 1e-6 && Math.abs(dot(u[1], u[2])) < 1e-6;
  const U: [Vec3, Vec3, Vec3] = ortho ? u : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let H = h;
  if (!ortho) {
    // the AABB of the sheared parallelepiped
    const corners: Vec3[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const p: Vec3 = [sx * half[0], sy * half[1], sz * half[2]]; corners.push([m[0] * (centre[0] + p[0]) + m[4] * (centre[1] + p[1]) + m[8] * (centre[2] + p[2]) + m[12], m[1] * (centre[0] + p[0]) + m[5] * (centre[1] + p[1]) + m[9] * (centre[2] + p[2]) + m[13], m[2] * (centre[0] + p[0]) + m[6] * (centre[1] + p[1]) + m[10] * (centre[2] + p[2]) + m[14]]); }
    const mn: Vec3 = [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), Math.min(...corners.map(p => p[2]))], mx: Vec3 = [Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1])), Math.max(...corners.map(p => p[2]))];
    H = [(mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2, (mx[2] - mn[2]) / 2];
    return boxFrom([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2], U, H);
  }
  return boxFrom(c, U, H);
}
/** An oriented box from its centre, three unit axes and half extents */
export function boxFrom(c: Vec3, u: [Vec3, Vec3, Vec3], h: Vec3): Hull {
  const verts = new Float64Array(24); let k = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) verts[k++] = c[i] + u[0][i] * sx * h[0] + u[1][i] * sy * h[1] + u[2][i] * sz * h[2];
  const planes = new Float64Array(24); k = 0;
  const flat = h[0] < 1e-6 || h[1] < 1e-6 || h[2] < 1e-6;
  if (!flat) for (let a = 0; a < 3; a++) for (const s of [-1, 1]) { planes[k++] = u[a][0] * s; planes[k++] = u[a][1] * s; planes[k++] = u[a][2] * s; planes[k++] = dot(u[a], c) * s + h[a]; }
  const axes = new Float64Array(9), edges = new Float64Array(9);
  for (let a = 0; a < 3; a++) for (let i = 0; i < 3; i++) { axes[a * 3 + i] = u[a][i]; edges[a * 3 + i] = u[a][i]; }
  const b = bounds(verts);
  return { verts, axes, edges, planes: flat ? new Float64Array(0) : planes, min: b.min, max: b.max, flat, box: { c, u, h } };
}

/** The convex hull of a triangle soup (a world-space mesh), or a flat hull when it has no volume. null for an empty mesh. */
export function meshHull(pos: ArrayLike<number>, index?: ArrayLike<number> | null): Hull | null {
  // unique vertices (rounded to 0.01 mm)
  const key = (x: number, y: number, z: number) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  const uniq = new Map<string, number>(), P: number[] = [];
  const nv = pos.length / 3;
  for (let i = 0; i < nv; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (!Number.isFinite(x + y + z)) continue; const k = key(x, y, z); if (!uniq.has(k)) { uniq.set(k, P.length / 3); P.push(x, y, z); } }
  void index;
  const n = P.length / 3;
  if (n < 3) return null;
  const hull = quickHull(P);
  if (hull) return hullFrom(P, hull);
  return flatHull(P);
}

type Face = { a: number; b: number; c: number; n: Vec3; d: number; alive: boolean };
function quickHull(P: number[]): Face[] | null {
  const n = P.length / 3;
  const at = (i: number): Vec3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  // extent for the epsilon
  const bb = bounds(new Float64Array(P)), size = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
  if (size < 1e-9) return null;
  const eps = size * 1e-9;
  // initial tetrahedron: the two extreme points on the widest axis, the point farthest from that line, the point farthest from that plane
  let i0 = 0, i1 = 0;
  const ax = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
  const wide = ax[0] >= ax[1] && ax[0] >= ax[2] ? 0 : ax[1] >= ax[2] ? 1 : 2;
  for (let i = 0; i < n; i++) { if (P[i * 3 + wide] < P[i0 * 3 + wide]) i0 = i; if (P[i * 3 + wide] > P[i1 * 3 + wide]) i1 = i; }
  if (i0 === i1) return null;
  const l0 = sub(at(i1), at(i0)), ln = norm(l0);
  let i2 = -1, best = eps * 10;
  for (let i = 0; i < n; i++) { const d = len(cross(ln, sub(at(i), at(i0)))); if (d > best) { best = d; i2 = i; } }
  if (i2 < 0) return null;
  const pn = norm(cross(sub(at(i1), at(i0)), sub(at(i2), at(i0))));
  let i3 = -1; best = eps * 10;
  for (let i = 0; i < n; i++) { const d = Math.abs(dot(pn, sub(at(i), at(i0)))); if (d > best) { best = d; i3 = i; } }
  if (i3 < 0) return null;   // coplanar: no volume
  const faces: Face[] = [];
  const mk = (a: number, b: number, c: number, inside: Vec3): Face => {
    let nn = norm(cross(sub(at(b), at(a)), sub(at(c), at(a))));
    let d = dot(nn, at(a));
    if (dot(nn, inside) - d > 0) { [b, c] = [c, b]; nn = [-nn[0], -nn[1], -nn[2]]; d = -d; }
    const f = { a, b, c, n: nn, d, alive: true }; faces.push(f); return f;
  };
  const cen: Vec3 = scale(add(add(at(i0), at(i1)), add(at(i2), at(i3))), 0.25);
  mk(i0, i1, i2, cen); mk(i0, i1, i3, cen); mk(i0, i2, i3, cen); mk(i1, i2, i3, cen);
  const used = new Set([i0, i1, i2, i3]);
  for (let p = 0; p < n; p++) {
    if (used.has(p)) continue;
    const pt = at(p);
    const vis: Face[] = [];
    for (const f of faces) if (f.alive && dot(f.n, pt) - f.d > eps) vis.push(f);
    if (!vis.length) continue;
    // horizon: directed edges of visible faces whose reverse is not in a visible face
    const edgeSet = new Map<string, [number, number]>();
    for (const f of vis) for (const [x, y] of [[f.a, f.b], [f.b, f.c], [f.c, f.a]] as [number, number][]) edgeSet.set(`${x}>${y}`, [x, y]);
    for (const f of vis) f.alive = false;
    for (const [, [x, y]] of edgeSet) if (!edgeSet.has(`${y}>${x}`)) mk(x, y, p, cen);
  }
  return faces.filter(f => f.alive);
}
function hullFrom(P: number[], faces: Face[]): Hull {
  // vertices that are on the hull
  const vi = new Set<number>(); for (const f of faces) { vi.add(f.a); vi.add(f.b); vi.add(f.c); }
  const verts = new Float64Array(vi.size * 3); let k = 0; for (const i of vi) { verts[k++] = P[i * 3]; verts[k++] = P[i * 3 + 1]; verts[k++] = P[i * 3 + 2]; }
  // unique planes: merge faces whose normals agree within 1e-3 and offsets within 1e-5
  const planes: number[] = [], axes: number[] = [];
  const seenPlane = new Map<string, number>();
  for (const f of faces) {
    const key = `${Math.round(f.n[0] * 1e3)},${Math.round(f.n[1] * 1e3)},${Math.round(f.n[2] * 1e3)},${Math.round(f.d * 1e3)}`;
    if (seenPlane.has(key)) continue; seenPlane.set(key, 1);
    planes.push(f.n[0], f.n[1], f.n[2], f.d);
  }
  const seenAxis = new Set<string>();
  for (let i = 0; i < planes.length; i += 4) { const key = `${Math.round(planes[i] * 1e3)},${Math.round(planes[i + 1] * 1e3)},${Math.round(planes[i + 2] * 1e3)}`; if (seenAxis.has(key)) continue; seenAxis.add(key); axes.push(planes[i], planes[i + 1], planes[i + 2]); }
  // real edges: a directed edge whose neighbour face has a different normal; directions deduplicated up to sign
  const emap = new Map<string, Face>();
  for (const f of faces) for (const [x, y] of [[f.a, f.b], [f.b, f.c], [f.c, f.a]] as [number, number][]) emap.set(`${x}>${y}`, f);
  const dirs: number[] = [], seenDir = new Set<string>();
  const cands: { l: number; d: Vec3 }[] = [];
  for (const f of faces) for (const [x, y] of [[f.a, f.b], [f.b, f.c], [f.c, f.a]] as [number, number][]) {
    if (x > y) continue;
    const g = emap.get(`${y}>${x}`);
    if (g && dot(f.n, g.n) > 1 - 1e-6) continue;   // a diagonal across a flat face
    const d: Vec3 = [P[y * 3] - P[x * 3], P[y * 3 + 1] - P[x * 3 + 1], P[y * 3 + 2] - P[x * 3 + 2]], l = len(d);
    if (l < 1e-9) continue;
    const u: Vec3 = [d[0] / l, d[1] / l, d[2] / l], s = u[0] < -1e-9 || (Math.abs(u[0]) <= 1e-9 && (u[1] < -1e-9 || (Math.abs(u[1]) <= 1e-9 && u[2] < 0))) ? -1 : 1;
    const key = `${Math.round(u[0] * s * 1e3)},${Math.round(u[1] * s * 1e3)},${Math.round(u[2] * s * 1e3)}`;
    if (seenDir.has(key)) continue; seenDir.add(key);
    cands.push({ l, d: [u[0] * s, u[1] * s, u[2] * s] });
  }
  cands.sort((p, q) => q.l - p.l);
  for (const c of cands.slice(0, 48)) dirs.push(c.d[0], c.d[1], c.d[2]);
  const b = bounds(verts);
  return { verts, axes: new Float64Array(axes.slice(0, 3 * 64)), edges: new Float64Array(dirs), planes: new Float64Array(planes), min: b.min, max: b.max, flat: false };
}
/** a mesh with no volume (a pane, a decal, a flat card): its plane normal, the in-plane normals of its edges, and no inside */
function flatHull(P: number[]): Hull | null {
  const n = P.length / 3;
  const at = (i: number): Vec3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  // the plane: the best-conditioned triple (the farthest from the first two extremes)
  let i0 = 0, i1 = 0, best = 0;
  for (let i = 1; i < n; i++) { const d = len(sub(at(i), at(0))); if (d > best) { best = d; i1 = i; } }
  if (best < 1e-9) return null;
  const l0 = norm(sub(at(i1), at(i0)));
  let i2 = -1; best = 1e-9;
  for (let i = 0; i < n; i++) { const d = len(cross(l0, sub(at(i), at(i0)))); if (d > best) { best = d; i2 = i; } }
  const verts = new Float64Array(P);
  const b = bounds(verts);
  if (i2 < 0) {
    // collinear: a bar of no section; treat as a thin box along the line: axes the line and any two perpendiculars
    const p1 = Math.abs(l0[0]) < 0.9 ? norm(cross(l0, [1, 0, 0])) : norm(cross(l0, [0, 1, 0])), p2 = cross(l0, p1);
    return { verts, axes: new Float64Array([...l0, ...p1, ...p2]), edges: new Float64Array(l0), planes: new Float64Array(0), min: b.min, max: b.max, flat: true };
  }
  const nn = norm(cross(sub(at(i1), at(i0)), sub(at(i2), at(i0))));
  const axes: number[] = [nn[0], nn[1], nn[2]], edges: number[] = [];
  const seen = new Set<string>();
  // the in-plane normals of the convex outline's edges: take the unique directions of vertex-to-vertex vectors from the extremes
  const dirs: Vec3[] = [];
  const ext = new Set<number>([i0, i1, i2]);
  for (let k = 0; k < 3; k++) { let mn = 0, mx = 0; for (let i = 1; i < n; i++) { if (P[i * 3 + k] < P[mn * 3 + k]) mn = i; if (P[i * 3 + k] > P[mx * 3 + k]) mx = i; } ext.add(mn); ext.add(mx); }
  const ev = [...ext];
  for (let a = 0; a < ev.length; a++) for (let c = a + 1; c < ev.length; c++) { const d = sub(at(ev[c]), at(ev[a])), l = len(d); if (l < 1e-9) continue; dirs.push([d[0] / l, d[1] / l, d[2] / l]); }
  for (const d of dirs) {
    const s = d[0] < -1e-9 || (Math.abs(d[0]) <= 1e-9 && (d[1] < -1e-9 || (Math.abs(d[1]) <= 1e-9 && d[2] < 0))) ? -1 : 1, key = `${Math.round(d[0] * s * 100)},${Math.round(d[1] * s * 100)},${Math.round(d[2] * s * 100)}`;
    if (seen.has(key)) continue; seen.add(key);
    edges.push(d[0] * s, d[1] * s, d[2] * s);
    const pn = norm(cross(nn, d)); axes.push(pn[0], pn[1], pn[2]);
  }
  return { verts, axes: new Float64Array(axes.slice(0, 3 * 40)), edges: new Float64Array(edges.slice(0, 3 * 24)), planes: new Float64Array(0), min: b.min, max: b.max, flat: true };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// penetration
// ---------------------------------------------------------------------------------------------------------------------------------
export const aabbOverlaps = (a: Hull, b: Hull, margin = 0) =>
  a.min[0] <= b.max[0] + margin && b.min[0] <= a.max[0] + margin && a.min[1] <= b.max[1] + margin && b.min[1] <= a.max[1] + margin && a.min[2] <= b.max[2] + margin && b.min[2] <= a.max[2] + margin;

function project(v: Float64Array, ax: Vec3): [number, number] {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < v.length; i += 3) { const d = v[i] * ax[0] + v[i + 1] * ax[1] + v[i + 2] * ax[2]; if (d < mn) mn = d; if (d > mx) mx = d; }
  return [mn, mx];
}
export interface Penetration { depth: number; axis: Vec3 }
/** The minimum translation distance of two convex hulls (the separating-axis theorem over both hulls' face normals and the cross
 *  products of their edge directions), with the axis pointing from `a` to `b`; null when a separating axis exists (they do not overlap).
 *  A flat hull has no thickness: its depth is how far the other pokes through it. */
export function satPenetration(a: Hull, b: Hull): Penetration | null {
  let best = Infinity, bestAx: Vec3 = [0, 1, 0];
  const test = (ax: Vec3): boolean => {
    const l = len(ax); if (l < 1e-7) return true;
    const u: Vec3 = [ax[0] / l, ax[1] / l, ax[2] / l];
    const [a0, a1] = project(a.verts, u), [b0, b1] = project(b.verts, u);
    const o1 = a1 - b0, o2 = b1 - a0;   // a's max past b's min, b's max past a's min
    const o = Math.min(o1, o2);
    if (o <= 0) return false;
    if (o < best) { best = o; bestAx = o1 < o2 ? u : [-u[0], -u[1], -u[2]]; }
    return true;
  };
  for (let i = 0; i < a.axes.length; i += 3) if (!test([a.axes[i], a.axes[i + 1], a.axes[i + 2]])) return null;
  for (let i = 0; i < b.axes.length; i += 3) if (!test([b.axes[i], b.axes[i + 1], b.axes[i + 2]])) return null;
  for (let i = 0; i < a.edges.length; i += 3) for (let j = 0; j < b.edges.length; j += 3) {
    const ea = [a.edges[i], a.edges[i + 1], a.edges[i + 2]], eb = [b.edges[j], b.edges[j + 1], b.edges[j + 2]];
    const c = cross(ea, eb);
    if (len(c) < 1e-3) continue;   // near-parallel edges: their cross product is noise, and the face axes already cover that case
    if (!test(c)) return null;
  }
  return { depth: best, axis: bestAx };
}

/** is the point inside the convex hull (its planes; a box exactly)? */
export function inside(h: Hull, p: ArrayLike<number>, pad = 0): boolean {
  if (h.box) {
    const d = sub(p, h.box.c);
    for (let k = 0; k < 3; k++) if (Math.abs(dot(d, h.box.u[k])) > h.box.h[k] + pad) return false;
    return true;
  }
  for (let i = 0; i < h.planes.length; i += 4) if (h.planes[i] * p[0] + h.planes[i + 1] * p[1] + h.planes[i + 2] * p[2] > h.planes[i + 3] + pad) return false;
  return h.planes.length > 0;
}
/** The volume (m^3) the two hulls share, by sampling a regular grid of `n`^3 cell centres over the overlap of their bounding boxes.
 *  Exact for nothing, within a few percent of the truth at n = 16 for the props' parts; zero when either has no volume. */
export function overlapVolume(a: Hull, b: Hull, n = 16): number {
  if (a.flat || b.flat) return 0;
  const lo: Vec3 = [Math.max(a.min[0], b.min[0]), Math.max(a.min[1], b.min[1]), Math.max(a.min[2], b.min[2])], hi: Vec3 = [Math.min(a.max[0], b.max[0]), Math.min(a.max[1], b.max[1]), Math.min(a.max[2], b.max[2])];
  if (hi[0] <= lo[0] || hi[1] <= lo[1] || hi[2] <= lo[2]) return 0;
  const d: Vec3 = [(hi[0] - lo[0]) / n, (hi[1] - lo[1]) / n, (hi[2] - lo[2]) / n];
  let hits = 0;
  const p: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) { p[0] = lo[0] + (i + 0.5) * d[0]; for (let j = 0; j < n; j++) { p[1] = lo[1] + (j + 0.5) * d[1]; for (let k = 0; k < n; k++) { p[2] = lo[2] + (k + 0.5) * d[2]; if (inside(a, p) && inside(b, p)) hits++; } } }
  return hits * d[0] * d[1] * d[2];
}
/** How deep a (possibly concave) mesh really reaches into a convex hull: the deepest of its sample points (every vertex and every triangle
 *  centroid) inside the hull, measured to the hull's nearest face. A concave mesh's own hull overstates a clash (a plant's splayed fronds, a
 *  cable's loop); its vertices do not. 0 when no sample is inside, or when the hull has no volume. */
export function sampleDepth(pos: ArrayLike<number>, index: ArrayLike<number> | null | undefined, hull: Hull, stride = 1): number {
  const P = hull.planes;
  if (!P.length) return 0;
  let best = 0;
  const test = (x: number, y: number, z: number) => {
    let m = Infinity;
    for (let i = 0; i < P.length; i += 4) { const d = P[i + 3] - (P[i] * x + P[i + 1] * y + P[i + 2] * z); if (d < 0) return; if (d < m) m = d; }
    if (m > best) best = m;
  };
  const n = pos.length / 3;
  for (let i = 0; i < n; i += stride) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < hull.min[0] || x > hull.max[0] || y < hull.min[1] || y > hull.max[1] || z < hull.min[2] || z > hull.max[2]) continue;
    test(x, y, z);
  }
  if (index) for (let t = 0; t + 2 < index.length; t += 3 * stride) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const x = (pos[a] + pos[b] + pos[c]) / 3, y = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, z = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    if (x < hull.min[0] || x > hull.max[0] || y < hull.min[1] || y > hull.max[1] || z < hull.min[2] || z > hull.max[2]) continue;
    test(x, y, z);
  }
  return best;
}
/** the centre of the shared AABB of two hulls: where the pair touches, for the report and the picture */
export function overlapCentre(a: Hull, b: Hull): Vec3 {
  return [(Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2, (Math.max(a.min[1], b.min[1]) + Math.min(a.max[1], b.max[1])) / 2, (Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2];
}
/** the AABB of the hull's vertices as {min, max} */
export const hullBox = (h: Hull) => ({ min: h.min, max: h.max });

// ---------------------------------------------------------------------------------------------------------------------------------
// small helpers the reports share
// ---------------------------------------------------------------------------------------------------------------------------------
/** counts of `keys` as [key, count] sorted by count descending, then key */
export function groupCount<K extends string | number>(keys: K[]): [K, number][] {
  const m = new Map<K, number>(); for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
export const round = (v: number, dp = 3) => { const f = 10 ** dp; return Math.round(v * f) / f; };
export const r3 = (v: ArrayLike<number>): Vec3 => [round(v[0], 3), round(v[1], 3), round(v[2], 3)];
