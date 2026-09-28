// Site geometry — the plan-view maths the landscape generators stand on, THREE-free so the Node harnesses
// (scripts/test-site.mts, the validator's site plugin, the fleet metrics) run exactly what the builder runs:
//
//   smoothLine / smoothLoop   centripetal Catmull-Rom through a polyline or a polygon, resampled at a fixed spacing
//                             (`smooth: true | tension` on bed.poly, path.path, hedge.path, fence.path, planting)
//   offsetLine / offsetLoop   a true offset of an open polyline / a closed polygon (mitred, clamped), for kerbs,
//                             pool coping, path edges and the beds a walk lays both sides of its path
//   ribbon                    the polygon a strip of width w covers along a polyline
//   poisson                   Bridson's Poisson-disk sampling in a domain, seeded, fixed attempt count, with
//                             blockers (plants already placed by an earlier layer)
//   kidney / blob / noisyLoop organic outlines: a kidney pool, a free-form pool, a pond or bed with a noise edge
//   halfPlane                 convex clipping (Voronoi flagstones)
//
// Every function is a pure function of its arguments and of the seeded rng it is handed (assets/materials.ts
// mulberry32): fixed iteration counts, no clock, so a frame built from these is random access.
export type P2 = [number, number];

export const mm = (v: number) => Math.round(v * 1000) / 1000;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// ---- polygons ---------------------------------------------------------------------------------------------------
export const signedArea = (poly: P2[]) => poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
export const polyArea = (poly: P2[]) => Math.abs(signedArea(poly));
/** the positive signed-area winding in (x, z) — clockwise on a north-up plan, since +z is south — reversed if not */
export const ccw = (poly: P2[]): P2[] => (signedArea(poly) < 0 ? poly.slice().reverse() : poly.slice());
export const centroid = (poly: P2[]): P2 => {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], k = p[0] * q[1] - q[0] * p[1];
    a += k; cx += (p[0] + q[0]) * k; cz += (p[1] + q[1]) * k;
  }
  if (Math.abs(a) < 1e-9) return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  return [cx / (3 * a), cz / (3 * a)];
};
export const inPoly = (x: number, z: number, poly: P2[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};
export const bbox = (pts: P2[]) => ({
  x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])),
  z0: Math.min(...pts.map(p => p[1])), z1: Math.max(...pts.map(p => p[1])),
});
export const segDist = (x: number, z: number, a: P2, b: P2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12;
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2);
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
};
/** distance from a point to a polyline (closed: back to its first point) */
export const lineDist = (x: number, z: number, pts: P2[], closed = false) => {
  let m = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) m = Math.min(m, segDist(x, z, pts[i], pts[(i + 1) % pts.length]));
  return m;
};
export const lengthOf = (pts: P2[], closed = false) => {
  let L = 0; const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) L += dist(pts[i], pts[(i + 1) % pts.length]);
  return L;
};
/** an axis-aligned rect {x, z, w, d} (min corner) or an at/w/d centre rect, turned by rot degrees about its centre */
export function rectPoly(at: P2, w: number, d: number, rotDeg = 0): P2[] {
  const a = rotDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // three.js turns +x toward −z for a positive rotation.y: a plan point (x, z) goes to (x c + z s, −x s + z c)
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [at[0] + x * c + z * s, at[1] - x * s + z * c] as P2);
}
/** turn plan points by rot degrees about a centre, in three.js's sense (rotation.y) */
export function turn(pts: P2[], rotDeg: number, about: P2 = [0, 0]): P2[] {
  const a = rotDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, z]) => { const dx = x - about[0], dz = z - about[1]; return [about[0] + dx * c + dz * s, about[1] - dx * s + dz * c] as P2; });
}
const dropDupes = (pts: P2[], closed: boolean, eps = 1e-6) => {
  const out: P2[] = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > eps) out.push([p[0], p[1]]);
  if (closed && out.length > 2 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
};

// ---- resampling and Catmull-Rom ----------------------------------------------------------------------------------
/** points every `spacing` metres along a polyline (closed: round the loop), ends kept */
export function resample(pts: P2[], spacing: number, closed = false): P2[] {
  const p = dropDupes(pts, closed);
  if (p.length < 2) return p;
  const segs = closed ? p.length : p.length - 1, L = lengthOf(p, closed);
  const n = Math.max(closed ? 3 : 1, Math.round(L / spacing));
  const out: P2[] = [];
  let seg = 0, acc = 0;
  const segLen = (i: number) => dist(p[i], p[(i + 1) % p.length]);
  for (let k = 0; k <= n; k++) {
    if (closed && k === n) break;
    const target = L * k / n;
    while (seg < segs - 1 && acc + segLen(seg) < target - 1e-9) { acc += segLen(seg); seg++; }
    const l = segLen(seg) || 1e-9, t = clamp((target - acc) / l), a = p[seg], b = p[(seg + 1) % p.length];
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}
// One centripetal Catmull-Rom segment p1 → p2 (Barry–Goldman), `alpha` 0.5; `tension` 0..1 flattens it toward the chord.
function crSegment(p0: P2, p1: P2, p2: P2, p3: P2, steps: number, tension: number, out: P2[]) {
  const alpha = 0.5, t = (a: P2, b: P2) => Math.pow(Math.max(dist(a, b), 1e-6), alpha);
  const t0 = 0, t1 = t0 + t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3);
  for (let i = 0; i < steps; i++) {
    const u = i / steps, tt = t1 + (t2 - t1) * u;
    const L = (a: P2, b: P2, ta: number, tb: number): P2 => { const k = (tt - ta) / (tb - ta || 1e-9); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
    const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3), C = L(B1, B2, t1, t2);
    const chord: P2 = [lerp(p1[0], p2[0], u), lerp(p1[1], p2[1], u)];
    out.push([lerp(C[0], chord[0], tension), lerp(C[1], chord[1], tension)]);
  }
}
/** `smooth` from a spec: true → tension 0; a number 0..1 → that tension; false / undefined → null (leave it straight) */
export const tensionOf = (smooth: unknown): number | null => smooth === true ? 0 : typeof smooth === 'number' && isFinite(smooth) ? clamp(smooth, 0, 0.95) : null;
/** an open polyline through `pts`, curved (centripetal Catmull-Rom, ends kept) and resampled every `spacing` m */
export function smoothLine(pts: P2[], tension = 0, spacing = 0.25): P2[] {
  const p = dropDupes(pts, false);
  if (p.length < 3) return resample(p, spacing, false);
  const ext = [[2 * p[0][0] - p[1][0], 2 * p[0][1] - p[1][1]] as P2, ...p, [2 * p[p.length - 1][0] - p[p.length - 2][0], 2 * p[p.length - 1][1] - p[p.length - 2][1]] as P2];
  const dense: P2[] = [];
  for (let i = 1; i < ext.length - 2; i++) crSegment(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], Math.max(4, Math.ceil(dist(ext[i], ext[i + 1]) / (spacing / 3))), tension, dense);
  dense.push(p[p.length - 1]);
  return resample(dense, spacing, false);
}
/** a closed polygon through `poly`, curved and resampled every `spacing` m */
export function smoothLoop(poly: P2[], tension = 0, spacing = 0.25): P2[] {
  const p = dropDupes(poly, true);
  if (p.length < 3) return p;
  const n = p.length, dense: P2[] = [];
  for (let i = 0; i < n; i++) crSegment(p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n], Math.max(4, Math.ceil(dist(p[i], p[(i + 1) % n]) / (spacing / 3))), tension, dense);
  return resample(dense, spacing, true);
}

// ---- offsets --------------------------------------------------------------------------------------------------
// the unit normal to the LEFT of travel a → b (in plan: x east, z south, so "left" of +x travel is −z)
const leftN = (a: P2, b: P2): P2 => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; };
/** per-point left normals of a polyline (averaged at the joints, mitre-scaled and clamped) */
export function lineNormals(pts: P2[], closed = false, limit = 2.5): P2[] {
  const n = pts.length, out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)], next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const a = i > 0 || closed ? leftN(prev, pts[i]) : leftN(pts[i], next), b = i < n - 1 || closed ? leftN(pts[i], next) : leftN(prev, pts[i]);
    let mx = a[0] + b[0], mz = a[1] + b[1]; const l = Math.hypot(mx, mz);
    if (l < 1e-6) { out.push(a); continue; }
    mx /= l; mz /= l;
    const cosH = mx * a[0] + mz * a[1], k = Math.min(limit, 1 / Math.max(cosH, 1e-3));
    out.push([mx * k, mz * k]);
  }
  return out;
}
/** an open polyline offset `d` to its left (negative: right) */
export const offsetLine = (pts: P2[], d: number): P2[] => { const N = lineNormals(pts, false); return pts.map((p, i) => [p[0] + N[i][0] * d, p[1] + N[i][1] * d] as P2); };
/** a closed polygon offset OUTWARD by d (negative: inward), whatever its winding */
export function offsetLoop(poly: P2[], d: number): P2[] {
  const p = ccw(poly), N = lineNormals(p, true);
  // with positive signed area the inside lies to the right of travel on a north-up plan, so the left normal
  // (leftN: north of eastward travel) points out
  return p.map((q, i) => [q[0] + N[i][0] * d, q[1] + N[i][1] * d] as P2);
}
/** the polygon a strip of width w covers along an open polyline (left edge out, right edge back) */
export function ribbon(pts: P2[], w: number): P2[] {
  const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
  return [...L, ...R.reverse()];
}

// ---- organic outlines -------------------------------------------------------------------------------------------
/** a smooth seeded wobble along arc length s: a few sines, amplitude ~1, period about `wave` metres */
export function wobble(rng: () => number, wave = 3, n = 3) {
  const w = Array.from({ length: n }, (_, i) => ({ f: (2 * Math.PI / wave) * (0.6 + i * 0.55 + rng() * 0.3), p: rng() * Math.PI * 2, a: 1 / (1 + i * 0.8) }));
  const norm = w.reduce((s, k) => s + k.a, 0);
  return (s: number) => w.reduce((v, k) => v + k.a * Math.sin(s * k.f + k.p), 0) / norm;
}
/** a closed outline pushed in and out along its normals by a seeded wobble (a pond's shore, an informal bed) */
export function noisyLoop(poly: P2[], rng: () => number, amp = 0.25, wave = 2.5, spacing = 0.25): P2[] {
  const p = ccw(resample(poly, spacing, true)), N = lineNormals(p, true, 1.5), f = wobble(rng, wave, 3);
  let s = 0;
  return p.map((q, i) => { if (i) s += dist(p[i - 1], q); const k = amp * f(s); return [q[0] + N[i][0] * k, q[1] + N[i][1] * k] as P2; });
}
/** a kidney: a bean of w × d round a centre, its waist pinched on the −z side, turned by rot */
export function kidney(at: P2, w: number, d: number, rotDeg = 0, n = 72): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    // an ellipse with a dent: the radius falls toward the waist (a = −π/2, the −z side)
    const dent = 0.34 * Math.pow(Math.max(0, -s), 3), bulge = 1 + 0.12 * Math.cos(2 * a);
    pts.push([c * (w / 2) * bulge * (1 - dent * 0.25), s * (d / 2) * (1 - dent)]);
  }
  const b = bbox(pts), sx = w / (b.x1 - b.x0), sz = d / (b.z1 - b.z0), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  return turn(pts.map(([x, z]) => [(x - mx) * sx, (z - mz) * sz] as P2), rotDeg).map(([x, z]) => [at[0] + x, at[1] + z] as P2);
}
/** a free-form blob of about w × d: an ellipse with a seeded low-frequency wobble */
export function blob(rng: () => number, at: P2, w: number, d: number, rotDeg = 0, amp = 0.16, n = 64): P2[] {
  const k = Array.from({ length: 3 }, (_, i) => ({ f: 2 + i, p: rng() * Math.PI * 2, a: (0.55 + rng() * 0.45) / (i + 1) }));
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 1 + amp * k.reduce((v, q) => v + q.a * Math.sin(a * q.f + q.p), 0);
    pts.push([Math.cos(a) * (w / 2) * r, Math.sin(a) * (d / 2) * r]);
  }
  return turn(pts, rotDeg).map(([x, z]) => [at[0] + x, at[1] + z] as P2);
}

// ---- convex clipping (flagstones) --------------------------------------------------------------------------------
/** keep the part of a convex polygon where n·p ≤ c */
export function halfPlane(poly: P2[], nx: number, nz: number, c: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = nx * a[0] + nz * a[1] - c, db = nx * b[0] + nz * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0) !== (db < 0) && da !== db) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// ---- Poisson-disk sampling (Bridson 2007) -------------------------------------------------------------------------
/** a disc a new point must stay out of: blocked while closer than r · share to (x, z) */
export type Blocker = { x: number; z: number; r: number };
/**
 * Points at least `r` apart inside a domain, grown from seeded starting points with a fixed number of attempts
 * (`k`) per active point, so the result is a pure function of the rng. `inside(x, z)` bounds the domain within
 * `box`; `blockers` are discs already occupied (a point keeps blocker.r · `share` clear of each centre).
 * `seeds` starting points are tried first (a band's length gets several, so one short run never starves).
 */
export function poisson(rng: () => number, box: { x0: number; z0: number; x1: number; z1: number }, r: number, inside: (x: number, z: number) => boolean,
  { k = 24, blockers = [] as Blocker[], share = 1, seeds = 4, max = 5000, grid = 0 } = {}): P2[] {
  const cell = r / Math.SQRT2, W = Math.max(1, Math.ceil((box.x1 - box.x0) / cell)), H = Math.max(1, Math.ceil((box.z1 - box.z0) / cell));
  const cells = new Int32Array(W * H).fill(-1), pts: P2[] = [], active: number[] = [];
  // blockers in a coarse hash (cell 1 m)
  const bh = new Map<string, Blocker[]>();
  for (const b of blockers) {
    const R = b.r * share, i0 = Math.floor(b.x - R), i1 = Math.floor(b.x + R), j0 = Math.floor(b.z - R), j1 = Math.floor(b.z + R);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i + ',' + j; if (!bh.has(key)) bh.set(key, []); bh.get(key)!.push(b); }
  }
  const blocked = (x: number, z: number) => {
    const list = bh.get(Math.floor(x) + ',' + Math.floor(z));
    return !!list && list.some(b => Math.hypot(b.x - x, b.z - z) < b.r * share);
  };
  const gi = (x: number, z: number) => [Math.min(W - 1, Math.floor((x - box.x0) / cell)), Math.min(H - 1, Math.floor((z - box.z0) / cell))];
  const fits = (x: number, z: number) => {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1 || !inside(x, z) || blocked(x, z)) return false;
    const [i, j] = gi(x, z);
    for (let a = Math.max(0, i - 2); a <= Math.min(W - 1, i + 2); a++) for (let b = Math.max(0, j - 2); b <= Math.min(H - 1, j + 2); b++) {
      const q = cells[a * H + b]; if (q >= 0 && Math.hypot(pts[q][0] - x, pts[q][1] - z) < r) return false;
    }
    return true;
  };
  const add = (x: number, z: number) => { const [i, j] = gi(x, z); cells[i * H + j] = pts.length; active.push(pts.length); pts.push([x, z]); };
  // seeds: tried at seeded spots across the box
  for (let s = 0; s < seeds * 12 && pts.length < seeds; s++) {
    const x = box.x0 + rng() * (box.x1 - box.x0), z = box.z0 + rng() * (box.z1 - box.z0);
    if (fits(x, z)) add(x, z);
  }
  // `grid`: also try a jittered grid of candidates, so a pocket the growth below cannot reach (closed off by
  // blockers, or a separate island of the domain) still gets its points
  if (grid > 0) for (let gx = box.x0 + grid / 2; gx < box.x1; gx += grid) for (let gz = box.z0 + grid / 2; gz < box.z1; gz += grid) {
    const x = gx + (rng() - 0.5) * grid * 0.8, z = gz + (rng() - 0.5) * grid * 0.8;
    if (pts.length < max && fits(x, z)) add(x, z);
  }
  while (active.length && pts.length < max) {
    const ai = Math.floor(rng() * active.length), [px, pz] = pts[active[ai]];
    let found = false;
    for (let t = 0; t < k; t++) {
      const a = rng() * Math.PI * 2, d = r * (1 + rng());
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      if (fits(x, z)) { add(x, z); found = true; break; }
    }
    if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
  }
  return pts;
}

// ---- metrics --------------------------------------------------------------------------------------------------
/** of a set of segments, the length within `tol` degrees of the x or z axis, and the total */
export function axisAligned(segs: Array<[P2, P2]>, tol = 1) {
  let axis = 0, total = 0;
  for (const [p, q] of segs) {
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const deg = Math.atan2(Math.abs(dz), Math.abs(dx)) * 180 / Math.PI;
    total += len; if (deg < tol || deg > 90 - tol) axis += len;
  }
  return { axis, total };
}
export const segmentsOf = (pts: P2[], closed: boolean): Array<[P2, P2]> => pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [P2, P2]).slice(0, closed ? pts.length : Math.max(0, pts.length - 1));
