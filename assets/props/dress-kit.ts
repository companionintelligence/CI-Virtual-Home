// Dress kit — the shared builders of the small goods (plan 5.5 SMALL, S1): the things a room is lived in by (a mug, a plate stack, a
// candle, a book, a tray, a soap dispenser) built as procedural props of ONE to THREE meshes each. It is the geometry layer under
// assets/props/tableware.ts (the round goods, as lathes of catalog dimensions) and the dress-*.ts type modules.
//
// What a dress prop is (the contract, enforced by scripts/test-dress-kit.mts):
//  - one mesh per ROLE, at most DRESS_MAX_MESHES (3) of them and at most DRESS_MAX_TRIS (600) triangles in all; every part is merged
//    into its role's geometry here (`Kit.build`), so a vignette of nine objects is still two or three draw calls;
//  - materials are FRESH on every create() and painted with the house's role colours (`ctx.colors`: wood, fabric2, linen, accent, metal ...),
//    exactly what a procedural prop paints with, so kit.theme() maps them by colour and the house palette applies. A fixed literal (glass,
//    wax, paper, rubber) is flagged userData.muted so the kit's restraint pass leaves it alone. No `map`, no transparency, no UVs, no userData
//    beyond `muted` and the item's own `colorParam` (assets/viewer-batch.ts refuses other material userData);
//  - no part thinner than MIN_PART (6 mm), and no FREE part (one that stands or lies on its own and has to read: a stem, a handle, a spout, a piece of
//    cutlery) thinner than MIN_FREE (10 mm). Every primitive clamps its thin dimension to MIN_PART and reports the thinnest it used (`Kit.thinnest`),
//    `free()` marks the ones that must read and `Kit.thinnestFree` reports them, so the invariant is structural and the test reads the numbers.
//    Both come from the G-READ spike (_audit/wave2/small-gread.md): at the 1.5 m eye and 1280 x 720 through GTAO and SMAA, a 6 mm part never halos
//    or shimmers more than a thick one, but a free dark part that thin is a faint grey wisp from 3.5 m; 10 mm is solid to 3.5 m and 12 mm to 4.5 m;
//  - round bodies are lathes of 12-22 segments, never fewer than 16 for anything 6 cm or wider (R-FACET: `Kit.minSegWide`, asserted by the test), with
//    smooth normals along the profile and hard edges only where the profile says so;
//  - the origin is the floor centre, the item faces +z at rot 0 and stands on y = 0 (the host's top), like every catalog item;
//  - rng draws a FIXED count (`rolls`) whatever branch is taken, so no later draw of the item's stream moves with a variant, and nothing here
//    touches Math.random or a clock.
//
// THREE-free at import time (Node tests and scripts import it); the page's THREE arrives as ctx.THREE at build().
import { registerProps } from './registry.js';

// ---- the numbers ------------------------------------------------------------------------------------------------------------------
/** the thinnest part any dress prop may have, metres: the geometry floor, safe from halos and shimmer (G-READ, _audit/wave2/small-gread.md). */
export const MIN_PART = 0.006;
/** the thinnest FREE part (a stem, a handle, a spout, cutlery: anything that is its own silhouette), metres: below it the part does not read from 3.5 m. */
export const MIN_FREE = 0.010;
export const DRESS_MAX_MESHES = 3;
export const DRESS_MAX_TRIS = 600;
/** lathe segments: 22 reads round from 1.5 m to 6 m at 720p; 16 is the floor for anything 6 cm or wider (R-FACET) */
export const SEG = 22;

// ---- geometry accumulators -------------------------------------------------------------------------------------------------------
export interface Geo { p: number[]; n: number[]; i: number[]; /** the thinnest dimension this primitive was built with, metres (Infinity when it has no thin part) */ thin: number; /** a part that stands or lies on its own and has to read: held to MIN_FREE, not MIN_PART */ free?: boolean;
  /** a lathe's segment count and its widest radius in metres, across the narrower of its two scaled axes (an elongated sole is not a round body): R-FACET asks 16 segments or more of a round body 6 cm or wider */ seg?: number; rmax?: number }
export type V3 = [number, number, number];
/** a placement: translate (x, y, z), rotate (rx, ry, rz radians, applied Y then X then Z), scale (uniform or per axis) */
export interface Xf { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number | V3 }

const TAU = Math.PI * 2;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

function matOf(t: Xf): { m: number[]; sc: V3 } {
  const sc: V3 = typeof t.s === 'number' ? [t.s, t.s, t.s] : t.s || [1, 1, 1];
  const cx = Math.cos(t.rx || 0), sx = Math.sin(t.rx || 0), cy = Math.cos(t.ry || 0), sy = Math.sin(t.ry || 0), cz = Math.cos(t.rz || 0), sz = Math.sin(t.rz || 0);
  // R = Ry * Rx * Rz
  const m = [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
  ];
  return { m, sc };
}

/** a Geo moved by a placement, as new arrays (the primitives are built once per call, so this is the only copy) */
export function place(g: Geo, t: Xf = {}): Geo {
  const { m, sc } = matOf(t), p: number[] = new Array(g.p.length), n: number[] = new Array(g.n.length);
  const flip = sc[0] * sc[1] * sc[2] < 0;
  for (let k = 0; k < g.p.length; k += 3) {
    const x = g.p[k] * sc[0], y = g.p[k + 1] * sc[1], z = g.p[k + 2] * sc[2];
    p[k] = m[0] * x + m[1] * y + m[2] * z + (t.x || 0); p[k + 1] = m[3] * x + m[4] * y + m[5] * z + (t.y || 0); p[k + 2] = m[6] * x + m[7] * y + m[8] * z + (t.z || 0);
    // normals take the inverse scale (non-uniform scale), then the rotation
    const nx = g.n[k] / sc[0], ny = g.n[k + 1] / sc[1], nz = g.n[k + 2] / sc[2];
    let a = m[0] * nx + m[1] * ny + m[2] * nz, b = m[3] * nx + m[4] * ny + m[5] * nz, c = m[6] * nx + m[7] * ny + m[8] * nz;
    const l = Math.hypot(a, b, c) || 1; a /= l; b /= l; c /= l;
    n[k] = flip ? -a : a; n[k + 1] = flip ? -b : b; n[k + 2] = flip ? -c : c;
  }
  let i = g.i;
  if (flip) { i = g.i.slice(); for (let k = 0; k < i.length; k += 3) { const q = i[k + 1]; i[k + 1] = i[k + 2]; i[k + 2] = q; } }
  return { p, n, i, thin: g.thin * Math.min(Math.abs(sc[0]), Math.abs(sc[1]), Math.abs(sc[2])), ...(g.free ? { free: true } : {}), ...(g.seg ? { seg: g.seg, rmax: (g.rmax || 0) * Math.min(Math.abs(sc[0]), Math.abs(sc[2])) } : {}) };
}

/** Mark a part as free (it has to read on its own): the kit then holds it to MIN_FREE. */
export const free = (g: Geo): Geo => ({ ...g, free: true });

const thinOf = (...d: number[]) => Math.min(...d.filter(v => v > 0));
/** clamp a thin dimension to the floor */
const fat = (v: number) => Math.max(v, MIN_PART);

// ---- primitives ------------------------------------------------------------------------------------------------------------------
/** A profile point: [r, y] with an optional third entry 1 meaning "a hard edge here" (the normal breaks instead of blending). */
export type PP = [number, number] | [number, number, number];

/**
 * A surface of revolution about the Y axis. The profile runs from the axis outward and around: bottom centre, up the outside, over the
 * rim, down the inside (for a vessel), so the outside is on the right of the direction of travel and normals come out outward.
 * Smooth normals along the profile; a point flagged hard (a 1 as its third entry) keeps the two adjoining segments' normals apart.
 * Segments at the axis are single triangles per column (a fan), so a cap costs `seg` triangles, not 2 x `seg`.
 */
export function lathe(profile: PP[], seg = SEG, thin = Infinity): Geo {
  const P: Array<[number, number, boolean]> = profile.map(q => [q[0], q[1], q.length > 2 && !!q[2]]);
  const nSeg = P.length - 1;
  // outward normal of each profile segment, (dy, -dr) normalised
  const sn: Array<[number, number]> = [];
  for (let s = 0; s < nSeg; s++) { const dr = P[s + 1][0] - P[s][0], dy = P[s + 1][1] - P[s][1], l = Math.hypot(dr, dy) || 1; sn.push([dy / l, -dr / l]); }
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  // one ring of vertices per (profile point, side): a smooth point has one ring, a hard point two (the normal of the segment below, of the one above)
  const ring: Array<{ lo: number; hi: number }> = [];
  const pushRing = (r: number, y: number, nr: number, ny: number): number => {
    const base = p.length / 3;
    for (let c = 0; c <= seg; c++) { const a = (c / seg) * TAU, co = Math.cos(a), si = Math.sin(a); p.push(r * co, y, r * si); n.push(nr * co, ny, nr * si); }
    return base;
  };
  for (let k = 0; k < P.length; k++) {
    const below = k > 0 ? sn[k - 1] : null, above = k < nSeg ? sn[k] : null;
    if (!below || !above) { const q = (below || above)!; const b = pushRing(P[k][0], P[k][1], q[0], q[1]); ring.push({ lo: b, hi: b }); continue; }
    if (P[k][2]) ring.push({ lo: pushRing(P[k][0], P[k][1], below[0], below[1]), hi: pushRing(P[k][0], P[k][1], above[0], above[1]) });
    else { let a = below[0] + above[0], b = below[1] + above[1]; const l = Math.hypot(a, b) || 1; a /= l; b /= l; const r = pushRing(P[k][0], P[k][1], a, b); ring.push({ lo: r, hi: r }); }
  }
  for (let s = 0; s < nSeg; s++) {
    const a = ring[s].hi, b = ring[s + 1].lo, r0 = P[s][0], r1 = P[s + 1][0];
    if (r0 <= 1e-9 && r1 <= 1e-9) continue;
    for (let c = 0; c < seg; c++) {
      // winding: counter-clockwise seen from outside (the angle runs +x toward +z, clockwise from above)
      if (r0 <= 1e-9) idx.push(a + c, b + c, b + c + 1);
      else if (r1 <= 1e-9) idx.push(a + c, b + c, a + c + 1);
      else idx.push(a + c, b + c, a + c + 1, a + c + 1, b + c, b + c + 1);
    }
  }
  return { p, n, i: idx, thin, seg, rmax: Math.max(...P.map(q => q[0])) };
}

/** A vessel's options. `wall` is the rim thickness (clamped to MIN_PART), `floor` the thickness under the inside, `depth` how far the inside goes
 *  below the rim (default: to the floor; a narrow-necked vase needs only a short collar, which saves a second wall's worth of triangles). */
export interface VesselOpts { seg?: number; wall?: number; floor?: number; depth?: number }
/**
 * A hollow vessel (mug, vase, bowl, cup, glass). `outer` runs from the foot up to the rim as [r, y] points (y rising, the last point is the rim's
 * outer edge); the inside is the same silhouette pulled in by `wall`, closed by a floor. The lip is flat and `wall` wide, hard-edged both sides.
 */
export function vessel(outer: PP[], o: VesselOpts = {}): Geo {
  const wall = fat(o.wall ?? 0.008), top = outer[outer.length - 1], topY = top[1], y0 = outer[0][1];
  const fy = Math.max(y0 + fat(o.floor ?? wall), o.depth !== undefined ? topY - o.depth : y0);
  // the outer radius at a height, by linear interpolation along the (rising) outer profile
  const rAt = (y: number): number => { for (let k = 0; k < outer.length - 1; k++) { const a = outer[k], b = outer[k + 1]; if (y >= a[1] - 1e-9 && y <= b[1] + 1e-9) { const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * t; } } return outer[0][0]; };
  const prof: PP[] = [[0, y0]];
  outer.forEach((q, k) => prof.push(k === 0 ? [q[0], q[1], 1] : k === outer.length - 1 ? [q[0], q[1], 1] : q.length > 2 ? [q[0], q[1], q[2]] : [q[0], q[1]]));
  prof.push([Math.max(top[0] - wall, 0.002), topY, 1]);
  // down the inside, along the outer profile's own points that lie between the rim and the floor
  for (let k = outer.length - 2; k >= 0; k--) { const q = outer[k]; if (q[1] > fy + 1e-9 && q[1] < topY - 1e-9) prof.push([Math.max(q[0] - wall, 0.002), q[1]]); }
  prof.push([Math.max(rAt(fy) - wall, 0.002), fy, 1]);
  prof.push([0, fy]);
  return lathe(prof, o.seg ?? SEG, wall);
}

/** A solid cylinder or cone frustum: foot radius r0, head radius r1, height h (a lathe with caps; hard edges at both rims). */
export function cylinder(r0: number, r1: number, h: number, seg = SEG): Geo {
  const r = Math.min(r0, r1);
  return lathe([[0, 0], [r0, 0, 1], [r1, h, 1], [0, h]], seg, thinOf(r * 2, h));
}

/** A flat-shaded box, w x h x d, sitting on y = 0 by default (centre = false) or centred. */
export function box(w: number, h: number, d: number, centre = false): Geo {
  const hw = w / 2, hd = d / 2, y0 = centre ? -h / 2 : 0, y1 = y0 + h;
  const p: number[] = [], n: number[] = [], i: number[] = [];
  const face = (nx: number, ny: number, nz: number, c: number[][]) => { const b = p.length / 3; for (const q of c) { p.push(q[0], q[1], q[2]); n.push(nx, ny, nz); } i.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  face(0, 0, 1, [[-hw, y0, hd], [hw, y0, hd], [hw, y1, hd], [-hw, y1, hd]]);
  face(0, 0, -1, [[hw, y0, -hd], [-hw, y0, -hd], [-hw, y1, -hd], [hw, y1, -hd]]);
  face(1, 0, 0, [[hw, y0, hd], [hw, y0, -hd], [hw, y1, -hd], [hw, y1, hd]]);
  face(-1, 0, 0, [[-hw, y0, -hd], [-hw, y0, hd], [-hw, y1, hd], [-hw, y1, -hd]]);
  face(0, 1, 0, [[-hw, y1, hd], [hw, y1, hd], [hw, y1, -hd], [-hw, y1, -hd]]);
  face(0, -1, 0, [[-hw, y0, -hd], [hw, y0, -hd], [hw, y0, hd], [-hw, y0, hd]]);
  return { p, n, i, thin: thinOf(w, h, d) };
}

/**
 * A rounded box, w x h x d with edge radius r, on y = 0 (or centred): the cube-projection method, so each corner is a true arc with `m`
 * steps per 45 degrees (m = 1 is a two-segment bevel, 108 triangles; m = 2 is a four-segment one, 300). Smooth normals, so the edges
 * catch light and the box is not a clay crate.
 */
export function roundedBox(w: number, h: number, d: number, r: number, m = 1, centre = false): Geo {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4), hx = w / 2, hy = h / 2, hz = d / 2;
  const samples = (a: number): number[] => {
    const inner = a - rr, out: number[] = [];
    for (let j = m; j >= 0; j--) out.push(-(inner + rr * Math.tan((Math.PI / 4) * (j / m))));
    for (let j = 0; j <= m; j++) out.push(inner + rr * Math.tan((Math.PI / 4) * (j / m)));
    return out;
  };
  const sx = samples(hx), sy = samples(hy), sz = samples(hz), N = sx.length;
  const p: number[] = [], n: number[] = [], idx: number[] = [], oy = centre ? 0 : hy;
  const vert = (qx: number, qy: number, qz: number) => {
    const ix = Math.max(-(hx - rr), Math.min(hx - rr, qx)), iy = Math.max(-(hy - rr), Math.min(hy - rr, qy)), iz = Math.max(-(hz - rr), Math.min(hz - rr, qz));
    let nx = qx - ix, ny = qy - iy, nz = qz - iz; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    p.push(ix + nx * rr, iy + ny * rr + oy, iz + nz * rr); n.push(nx, ny, nz);
  };
  const grid = (A: number[], B: number[], mk: (a: number, b: number) => V3, flip: boolean) => {
    const base = p.length / 3;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const q = mk(A[a], B[b]); vert(q[0], q[1], q[2]); }
    for (let a = 0; a < N - 1; a++) for (let b = 0; b < N - 1; b++) {
      const v00 = base + a * N + b, v01 = v00 + 1, v10 = v00 + N, v11 = v10 + 1;
      if (!flip) idx.push(v00, v10, v11, v00, v11, v01); else idx.push(v00, v11, v10, v00, v01, v11);
    }
  };
  grid(sx, sy, (a, b) => [a, b, hz], false); grid(sx, sy, (a, b) => [a, b, -hz], true);
  grid(sz, sy, (a, b) => [hx, b, a], true); grid(sz, sy, (a, b) => [-hx, b, a], false);
  grid(sx, sz, (a, b) => [a, hy, b], true); grid(sx, sz, (a, b) => [a, -hy, b], false);
  return { p, n, i: idx, thin: thinOf(w, h, d) };
}

/** A torus (or an arc of one: `arc` radians from the +x axis, in the xy plane, tube round the ring): R the ring radius, r the tube. */
export function torus(R: number, r: number, major = 14, minor = 8, arc = TAU): Geo {
  const tube = fat(r * 2) / 2;
  const p: number[] = [], n: number[] = [], i: number[] = [], whole = Math.abs(arc - TAU) < 1e-9;
  for (let a = 0; a <= major; a++) {
    const u = (a / major) * arc, cu = Math.cos(u), su = Math.sin(u);
    for (let b = 0; b < minor; b++) {
      const v = (b / minor) * TAU, cv = Math.cos(v), sv = Math.sin(v);
      p.push((R + tube * cv) * cu, (R + tube * cv) * su, tube * sv); n.push(cv * cu, cv * su, sv);
    }
  }
  const last = whole ? major : major;
  for (let a = 0; a < last; a++) for (let b = 0; b < minor; b++) {
    const v00 = a * minor + b, v01 = a * minor + ((b + 1) % minor), v10 = (a + 1) * minor + b, v11 = (a + 1) * minor + ((b + 1) % minor);
    i.push(v00, v10, v11, v00, v11, v01);
  }
  return { p, n, i, thin: tube * 2 };
}

/**
 * A rounded-rectangle tray: floor of thickness `floor`, a rim of wall `wall` (>= MIN_PART) and height `rim` above the floor; the corners
 * rounded with radius `cr` in plan. Built as a lathe-free extrusion of the plan loop: floor slab, outer wall, rim top, inner wall.
 */
export function trayShell(w: number, d: number, rim: number, o: { wall?: number; floor?: number; cr?: number; seg?: number } = {}): Geo {
  const wall = fat(o.wall ?? 0.008), floor = fat(o.floor ?? 0.008), cr = Math.min(o.cr ?? 0.03, w / 2 - wall, d / 2 - wall), seg = o.seg ?? 4;
  type L = Array<[number, number, number, number]>;
  // the plan loop, counter-clockwise in (x, z) from +x: [x, z, nx, nz]; four corner arcs of `seg` steps
  const loop = (hw: number, hd: number, rad: number): L => {
    const pts: L = [], cs: Array<[number, number]> = [[hw - rad, hd - rad], [-(hw - rad), hd - rad], [-(hw - rad), -(hd - rad)], [hw - rad, -(hd - rad)]];
    cs.forEach(([cx, cz], q) => { for (let s = 0; s <= seg; s++) { const th = ((q * 90 + (s / seg) * 90) * Math.PI) / 180; pts.push([cx + rad * Math.cos(th), cz + rad * Math.sin(th), Math.cos(th), Math.sin(th)]); } });
    return pts;
  };
  const outer = loop(w / 2, d / 2, cr), inner = loop(w / 2 - wall, d / 2 - wall, Math.max(cr - wall, 0.004));
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  const H = floor + rim;
  // a wall strip between two heights along a loop: smooth normals, outward (sign 1) or inward (sign -1)
  const strip = (Lp: L, y0: number, y1: number, sign: number) => {
    const base = p.length / 3;
    for (const q of Lp) { p.push(q[0], y0, q[1], q[0], y1, q[1]); n.push(sign * q[2], 0, sign * q[3], sign * q[2], 0, sign * q[3]); }
    for (let k = 0; k < Lp.length; k++) { const a = base + k * 2, b = base + ((k + 1) % Lp.length) * 2; if (sign > 0) idx.push(a, a + 1, b + 1, a, b + 1, b); else idx.push(a, b + 1, a + 1, a, b, b + 1); }
  };
  strip(outer, 0, H, 1); strip(inner, floor, H, -1);
  // the rim top, between the two loops at H
  { const base = p.length / 3; for (let k = 0; k < outer.length; k++) { p.push(outer[k][0], H, outer[k][1], inner[k][0], H, inner[k][1]); n.push(0, 1, 0, 0, 1, 0); } for (let k = 0; k < outer.length; k++) { const a = base + k * 2, b = base + ((k + 1) % outer.length) * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
  // inner floor (up) and the underside (down): fans from the centre
  const fan = (Lp: L, y: number, up: boolean) => {
    const base = p.length / 3; p.push(0, y, 0); n.push(0, up ? 1 : -1, 0);
    for (const q of Lp) { p.push(q[0], y, q[1]); n.push(0, up ? 1 : -1, 0); }
    for (let k = 0; k < Lp.length; k++) { const a = base + 1 + k, b = base + 1 + ((k + 1) % Lp.length); if (up) idx.push(base, b, a); else idx.push(base, a, b); }
  };
  fan(inner, floor, true); fan(outer, 0, false);
  return { p, n, i: idx, thin: Math.min(wall, floor) };
}

/** The signed volume of a closed Geo (positive when the triangles wind outward): the winding test of test-dress-kit.mts. */
export function signedVolume(g: Geo): number {
  let v = 0;
  for (let k = 0; k < g.i.length; k += 3) {
    const a = g.i[k] * 3, b = g.i[k + 1] * 3, c = g.i[k + 2] * 3;
    v += (g.p[a] * (g.p[b + 1] * g.p[c + 2] - g.p[b + 2] * g.p[c + 1]) - g.p[a + 1] * (g.p[b] * g.p[c + 2] - g.p[b + 2] * g.p[c]) + g.p[a + 2] * (g.p[b] * g.p[c + 1] - g.p[b + 1] * g.p[c])) / 6;
  }
  return v;
}

// ---- the kit: role accumulators -> one mesh per role ------------------------------------------------------------------------------
interface RoleAcc { p: number[]; n: number[]; c: number[]; i: number[]; shaded: boolean }

/** How a role is painted. `from` reads ctx.colors[from] (falling back to colors[fallback]); `fixed` is a literal, flagged muted. */
export interface RoleSpec { from?: string; fallback?: string; fixed?: number; rough: number; metal?: number }
/** The role table of the dress kit (PBR defaults after the light design's role vocabulary, section 4.7; assets/props/finish-roles.ts replaces it when it lands). */
export const DRESS_ROLES: Record<string, RoleSpec> = {
  wood: { from: 'wood', rough: 0.55 },
  wood2: { from: 'wood2', fallback: 'wood', rough: 0.55 },
  cabinet: { from: 'cabinet', rough: 0.35 },
  fabric: { from: 'fabric', rough: 0.92 },
  fabric2: { from: 'fabric2', rough: 0.9 },
  linen: { from: 'linen', rough: 0.92 },
  rug: { from: 'rug', rough: 0.95 },
  accent: { from: 'accent', rough: 0.5 },
  ceramic: { from: 'ceramic', fallback: 'linen', rough: 0.3 },
  metal: { from: 'metal', rough: 0.35, metal: 0.8 },
  glass: { fixed: 0xb7ccd2, rough: 0.06 },           // opaque pale blue-grey: reads as glass at 8 cm and stays in AO and in the player's batcher
  smoke: { fixed: 0x56636b, rough: 0.08 },
  wax: { fixed: 0xefe6d3, rough: 0.55 },
  paper: { fixed: 0xece5d4, rough: 0.9 },
  rubber: { fixed: 0x1f2328, rough: 0.7 },
  cork: { fixed: 0xb89a74, rough: 0.9 },
  brass: { fixed: 0xb08d4f, rough: 0.35, metal: 0.85 },
  chrome: { fixed: 0xc9ced3, rough: 0.2, metal: 0.9 },
  mirror: { fixed: 0xe2e8f0, rough: 0.08, metal: 0.9 },     // the repo's own mirrorMat (bathroom.ts): it reflects the environment only, until LIGHT F5
  steel: { fixed: 0xb4bac0, rough: 0.3, metal: 0.55 },   // cutlery and cookware: a light grey that keeps its colour (metalness 0.9 reflects the dark ceiling and goes near black), and still reads on a white top
};

export class Kit {
  readonly roles = new Map<string, RoleAcc>();
  /** the thinnest part added so far, metres */
  thinnest = Infinity;
  /** the thinnest FREE part added so far, metres */
  thinnestFree = Infinity;
  /** the fewest lathe segments on a round body 6 cm or wider (R-FACET asks 16) */
  minSegWide = Infinity;
  private stack: Xf[] = [];
  /** Everything added inside `fn` is placed by `t` as well (after its own placement): a piece built at the origin and set down anywhere. */
  with(t: Xf, fn: () => void): this { this.stack.push(t); try { fn(); } finally { this.stack.pop(); } return this; }
  add(role: string, g: Geo, t: Xf = {}, shade: number | ((x: number, y: number, z: number) => number) = 1): this {
    let acc = this.roles.get(role); if (!acc) this.roles.set(role, acc = { p: [], n: [], c: [], i: [], shaded: false });
    let q = place(g, t);
    for (let k = this.stack.length - 1; k >= 0; k--) q = place(q, this.stack[k]);
    const base = acc.p.length / 3;
    for (let k = 0; k < q.p.length; k += 3) {
      acc.p.push(r5(q.p[k]), r5(q.p[k + 1]), r5(q.p[k + 2])); acc.n.push(r5(q.n[k]), r5(q.n[k + 1]), r5(q.n[k + 2]));
      const s = typeof shade === 'number' ? shade : shade(q.p[k], q.p[k + 1], q.p[k + 2]);
      if (s !== 1) acc.shaded = true;
      acc.c.push(s, s, s);
    }
    for (const v of q.i) acc.i.push(base + v);
    if (q.thin < this.thinnest) this.thinnest = q.thin;
    if (q.free && q.thin < this.thinnestFree) this.thinnestFree = q.thin;
    if (q.seg && (q.rmax || 0) >= 0.06 && q.seg < this.minSegWide) this.minSegWide = q.seg;
    return this;
  }
  get meshes(): number { return this.roles.size; }
  get tris(): number { let t = 0; for (const a of this.roles.values()) t += a.i.length / 3; return t; }
  /** world-space bounding box of everything added: [x0, y0, z0, x1, y1, z1] */
  box(): number[] {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const a of this.roles.values()) for (let k = 0; k < a.p.length; k += 3) for (let c = 0; c < 3; c++) { b[c] = Math.min(b[c], a.p[k + c]); b[3 + c] = Math.max(b[3 + c], a.p[k + c]); }
    return b;
  }
  /** One mesh per role, in the order the roles were first used. `paint` overrides a role's colour (an item's own `color`). */
  build(ctx: any, name: string, paint: Record<string, number> = {}): any {
    const { THREE, group, std, colors } = ctx;
    const g = group(name);
    for (const [role, a] of this.roles) {
      const spec = DRESS_ROLES[role];
      if (!spec) throw new Error(`dress kit: unknown role "${role}"`);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
      if (a.shaded) geo.setAttribute('color', new THREE.Float32BufferAttribute(a.c, 3));
      geo.setIndex(a.i);
      const col = paint[role] !== undefined ? paint[role] : spec.fixed !== undefined ? spec.fixed : (colors[spec.from!] ?? colors[spec.fallback || 'linen']);
      const mat = std(col, { roughness: spec.rough, metalness: spec.metal || 0, ...(a.shaded ? { vertexColors: true } : {}) });
      if (spec.fixed !== undefined && paint[role] === undefined) mat.userData.muted = true;
      const m = new THREE.Mesh(geo, mat); m.name = role; m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    g.userData.dress = { thinnest: r5(this.thinnest), thinnestFree: this.thinnestFree === Infinity ? null : r5(this.thinnestFree), segWide: this.minSegWide === Infinity ? null : this.minSegWide };   // the invariants test-dress-kit.mts reads (group data only: material userData is the batcher's)
    return g;
  }
}

/** The item's stream, drawn a FIXED number of times so no branch changes what a later draw of the same stream sees. */
export function rolls(rng: () => number, n: number): number[] { const out: number[] = []; for (let k = 0; k < n; k++) out.push(rng()); return out; }
/** pick from a list by a roll in [0, 1) */
export const pickOf = <T,>(list: readonly T[], u: number): T => list[Math.min(list.length - 1, Math.floor(u * list.length))];
/** a roll mapped to [lo, hi] */
export const between = (u: number, lo: number, hi: number): number => lo + (hi - lo) * u;
/** the colour an item paints its signature role with: its own `color`, else the house role (read by the kit) */
export const paintOf = (it: any, ctx: any, role: string): Record<string, number> => (it && it.color ? { [role]: ctx.hex(it.color) } : {});

// ---- registration -----------------------------------------------------------------------------------------------------------------
export interface DressDef {
  footprint: [number, number]; height: number; params?: string[]; tags?: string[];
  create(it: any, ctx: any): any;
  /** the PLACEMENT group the type belongs to ('decor' or 'textile'); test-dress-kit checks the placement table agrees */
  group?: string;
  [k: string]: any;
}
/**
 * Register dress types: a surface prop (placed on the top of what it stands on), `dress: true` (the marker DRESS and the lints read), no iso hints
 * (generate_house_iso.py skips dress items; an empty list falls back to one box only for a type no house uses yet), and the kit's budget on the
 * definition so the test can read it. Nothing here is referenced by a house: a type is DORMANT until a recipe or a fixture places it.
 */
export function registerDress(defs: Record<string, DressDef>, defaults: Record<string, any> = {}): void {
  registerProps(defs, { surface: true, dress: true, iso: [], group: 'decor', budget: { meshes: DRESS_MAX_MESHES, tris: DRESS_MAX_TRIS }, ...defaults });
}

/** A variant index: the item's own `variant` when the spec gives one (DRESS recipes do), else the roll `u` in [0, 1) spread over `n`. */
export const variantOf = (it: any, u: number, n: number): number => (typeof it.variant === 'number' && Number.isFinite(it.variant) ? ((Math.trunc(it.variant) % n) + n) % n : Math.min(n - 1, Math.floor(u * n)));

export interface DressSpec {
  /** the registry type id: the group name of the built object is its title-cased form */
  name: string;
  footprint: [number, number]; height: number; params?: string[]; tags?: string[]; group?: string;
  /** how many rolls of the item's stream the build draws (fixed, whatever the variant) */
  rolls?: number;
  /** the role the item's own `color` paints, when it takes one */
  paint?: string;
  /** build the object into the kit; `u` are the item's rolls in [0, 1), `ctx` the prop context (for colours the build wants to read) */
  build(k: Kit, it: any, u: number[], ctx: any): void;
  [k: string]: any;
}
/** Turn a spec into a registry definition: create() draws its rolls, builds a Kit, and returns the merged group (one mesh per role). */
export function dressType(spec: DressSpec): DressDef {
  const { name, rolls: nRolls, paint, build, params, ...def } = spec;
  const title = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  return {
    ...def, params: params || (paint ? ['color', 'variant'] : ['variant']),
    create(it: any, ctx: any) { const u = rolls(ctx.rng, nRolls ?? 6), k = new Kit(); build(k, it, u, ctx); return k.build(ctx, title, paint ? paintOf(it, ctx, paint) : {}); },
  } as DressDef;
}
