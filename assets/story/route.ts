// Routes between two eyes: where the camera WALKS from one beat's pose to the next.
//
//   same storey      one leg on that storey's 0.2 m grid: A* on a cost that keeps to the middle of rooms and doorways, string-pulled
//                    (the planner's own nav.leg, so a walk never hugs a wall or cuts a corner through furniture)
//   another storey   the shortest chain of flights (world.stairs, up or down), a leg to each flight's foot and the flight's own line
//   in or out        through the entry door, when the entry is on the ground; outdoors, a leg on the lot's grid
//   anything else    a CUT, never a straight line through a wall: { ok: false } and the track bakes a crossfade instead
//
// THE RESCUE LADDER. The planner's navigation grid (assets/shot-nav.ts) is a person's: it reads the digest's boxes at eye height, and the digest
// draws an arched doorway as the arch's bounding boxes (the spandrel from the springline up: a box whose underside is 1.4 to 1.5 m over the floor),
// a bed as its hull (1.35 m, the whole width of a narrow room) and a spiral stair as one column in the middle of a blocked footprint. A walk that
// fails on that grid is retried, and only then, on a walker's grid built from the same boxes (`walkGrid`): rung 1 opens the doorways (a header over a
// door is not a wall at the camera's eye) and climbs a spiral round its column the way the planner's own film does; rung 2 also lets the eye pass
// over a hard piece up to 1.4 m tall (the eye is 1.55 m up). A walk that works on the planner's grid is never touched: the first rung is exactly
// what the router did before, so a tour that had no cut because of this keeps its bytes. `Route.rescued` says which rung made a walk.
//
// Pure and deterministic (fixed grids, fixed tie-breaks). Owner: story-bake. THREE-free.
import type { V3 } from '../shot-probe.js';
import { fillet } from '../shot-planner.js';
import { K, type WStair } from '../shot-world.js';
import { CELL, type Grid } from '../shot-nav.js';
import type { PoseCtx } from './poses.js';

/** where a camera stands: the eye, and the storey id (null: outside on the lot) */
export type Standing = { eye: V3; level: string | null };
export type Route = {
  ok: true;
  /** the eye's path, 3D, first = a.eye, last = b.eye */
  pts: V3[]; length: number;
  /** per vertex: how it is travelled (the speed profile slows a stair) */
  mode: Array<'walk' | 'stair'>;
  /** per vertex: the storey it is on (null outside), for the roof */
  levels: Array<string | null>;
  /** the greatest clearance tier any leg needed (0 = comfortable) */
  tier: number;
  /** the rung of the rescue ladder that made this walk (absent: the planner's own grid did; 1: doorways opened and spirals walked; 2: and low furniture passed over) */
  rescued?: number;
};
export type NoRoute = { ok: false; reason: string };
/** (the repo compiles without strictNullChecks, where `ok` alone does not narrow the union) */
export const failed = (r: Route | NoRoute): r is NoRoute => !r.ok;

export const EYE_IN = 1.55, EYE_OUT = 1.7;
/** the route length cap: a walk longer than this is a cut (about 15 s of walking: more is dead time while a voice waits) */
export const MAX_ROUTE_M = 24;
/** the highest entry floor the planner walks to on the ground grid (a plinth and a step); above it the planner draws the exterior steps (shot-planner.ts `e.y > 0.9`) */
export const ENTRY_STEP_M = 0.9;
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// ---- the walker's grids: the planner's, with the doorways opened (rung 1) and low furniture passed over (rung 2) --------------------------------
const WALL_KINDS = new Set<number>([K.wall, K.glass, K.rail]);
const ITEM_KINDS = new Set<number>([K.item, K.hull, K.fixture, K.surface, K.monitor, K.chair, K.heroSet, K.core]);
/** the eye's own height over the floor is 1.55 m: a hard piece (rung 2) is one whose top is above this less 15 cm */
export const PASS_OVER_M = 1.4;
const MAXD = 1.5;
const rectDist = (x: number, z: number, b0: number, b2: number, b3: number, b5: number) => Math.hypot(Math.max(b0 - x, 0, x - b3), Math.max(b2 - z, 0, z - b5));
const walkGrids = new WeakMap<object, Map<string, Grid>>();

/** The planner's grid of a storey with its doorways opened. A doorway of the plan's partitions (`nav.doorsOn`) is a gap `w` wide in a wall; the digest draws what
 *  closes it over the gap as boxes whose underside is at least 1.2 m over the floor (an arch's spandrels, a header: 1.4 to 1.5 m up) and the planner's grid, which reads the
 *  band 1.2 to 1.8 m, takes them for wall. Here the wall distance of the cells in and in front of the gap is taken again from the wall boxes without them, so the jambs
 *  (and any wall that really stands in the gap) are the only walls left. Nothing outside the doorways changes.
 *  Rung 2 also reads the furniture again: a piece whose top is under PASS_OVER_M is soft (the first three tiers avoid it, the last two walk over it).
 *  Returned grids are cached per nav and rung; the planner's grid itself is never touched. */
export function walkGrid(ctx: PoseCtx, level: string | null, rung: number): Grid {
  const { nav, world } = ctx;
  if (!level || rung <= 0) return level ? nav.grid(nav.levelOf(level)) : nav.grid(null, 0);
  let m = walkGrids.get(nav); if (!m) walkGrids.set(nav, m = new Map());
  const key = `${level}|${Math.min(2, rung)}`, hit = m.get(key); if (hit) return hit;
  const lv = nav.levelOf(level), base = nav.grid(lv), y = lv.y, eyeLo = y + 1.2, eyeHi = y + 1.8, B = world.boxes;
  const g: Grid = { key: `${base.key}+walk${Math.min(2, rung)}`, x0: base.x0, z0: base.z0, W: base.W, H: base.H, y: base.y, outside: base.outside, free: base.free.slice(), dW: base.dW.slice(), dI: base.dI.slice(), dS: base.dS.slice() };
  const at = (x: number, z: number) => { const i = Math.round((x - g.x0) / CELL), j = Math.round((z - g.z0) / CELL); return i >= 0 && j >= 0 && i < g.W && j < g.H ? j * g.W + i : -1; };

  // (a) the doorways
  const wallBoxes: number[] = [];
  for (let n = 0; n < world.kinds.length; n++) if (WALL_KINDS.has(world.kinds[n]) && B[6 * n + 4] >= eyeLo && B[6 * n + 1] <= eyeHi) wallBoxes.push(n);
  for (const d of nav.doorsOn(level)) {
    const half = d.w / 2, u: [number, number] = [-d.n[1], d.n[0]], R = half + 0.2 + MAXD;
    // the boxes near this door that still count: not the ones hanging over the gap
    const near: number[] = [];
    for (const n of wallBoxes) {
      const b0 = B[6 * n], b2 = B[6 * n + 2], b3 = B[6 * n + 3], b5 = B[6 * n + 5];
      if (b3 < d.c[0] - R || b0 > d.c[0] + R || b5 < d.c[1] - R || b2 > d.c[1] + R) continue;
      const cx = (b0 + b3) / 2 - d.c[0], cz = (b2 + b5) / 2 - d.c[1], s = cx * u[0] + cz * u[1], t = cx * d.n[0] + cz * d.n[1];
      // (a header is over THIS gap: its centre is in it, it is no thicker than a wall and it does not run on past the jambs. A long soffit over a whole wall is not a header)
      if (B[6 * n + 1] >= eyeLo - 1e-6 && Math.abs(s) <= half + 0.05 && Math.abs(t) <= 0.4) {
        const e0 = (b0 - d.c[0]) * u[0] + (b2 - d.c[1]) * u[1], e1 = (b0 - d.c[0]) * u[0] + (b5 - d.c[1]) * u[1], e2 = (b3 - d.c[0]) * u[0] + (b2 - d.c[1]) * u[1], e3 = (b3 - d.c[0]) * u[0] + (b5 - d.c[1]) * u[1];
        if (Math.min(e0, e1, e2, e3) >= -(half + 0.1) && Math.max(e0, e1, e2, e3) <= half + 0.1) continue;
      }
      near.push(n);
    }
    const i0 = Math.floor((d.c[0] - R - g.x0) / CELL), i1 = Math.ceil((d.c[0] + R - g.x0) / CELL), j0 = Math.floor((d.c[1] - R - g.z0) / CELL), j1 = Math.ceil((d.c[1] + R - g.z0) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(g.H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(g.W - 1, i1); i++) {
      const x = g.x0 + i * CELL, z = g.z0 + j * CELL, c = j * g.W + i; if (!g.free[c]) continue;
      const s = (x - d.c[0]) * u[0] + (z - d.c[1]) * u[1], t = (x - d.c[0]) * d.n[0] + (z - d.c[1]) * d.n[1];
      if (Math.abs(s) > half + 0.2 || Math.abs(t) > 0.6) continue;
      let dw = MAXD; for (const n of near) dw = Math.min(dw, rectDist(x, z, B[6 * n], B[6 * n + 2], B[6 * n + 3], B[6 * n + 5]));
      // (the edge of the footprint stays a wall: a doorway in an outer wall keeps the distance to the cells outside)
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const k = at(x + di * CELL, z + dj * CELL); if (k < 0 || !g.free[k]) dw = Math.min(dw, Math.max(0, Math.hypot(di, dj) * CELL - CELL / 2)); }
      if (dw > g.dW[c]) g.dW[c] = dw;
    }
  }

  // (b) rung 2: the furniture read again with PASS_OVER_M as the line between hard and soft
  if (rung >= 2) {
    g.dI.fill(MAXD); g.dS.fill(MAXD);
    const splat = (D: Float32Array, bx0: number, bz0: number, bx1: number, bz1: number) => {
      const i0 = Math.max(0, Math.floor((bx0 - MAXD - g.x0) / CELL)), i1 = Math.min(g.W - 1, Math.ceil((bx1 + MAXD - g.x0) / CELL));
      const j0 = Math.max(0, Math.floor((bz0 - MAXD - g.z0) / CELL)), j1 = Math.min(g.H - 1, Math.ceil((bz1 + MAXD - g.z0) / CELL));
      for (let j = j0; j <= j1; j++) { const z = g.z0 + j * CELL; for (let i = i0; i <= i1; i++) { const d = rectDist(g.x0 + i * CELL, z, bx0, bz0, bx1, bz1), c = j * g.W + i; if (d < D[c]) D[c] = d; } }
    };
    for (let n = 0; n < world.kinds.length; n++) {
      if (!ITEM_KINDS.has(world.kinds[n])) continue;
      const by0 = B[6 * n + 1], by1 = B[6 * n + 4];
      if (B[6 * n + 3] < g.x0 - MAXD || B[6 * n] > g.x0 + g.W * CELL + MAXD || B[6 * n + 5] < g.z0 - MAXD || B[6 * n + 2] > g.z0 + g.H * CELL + MAXD) continue;
      if (by1 >= y + PASS_OVER_M && by0 <= y + 2.0) splat(g.dI, B[6 * n], B[6 * n + 2], B[6 * n + 3], B[6 * n + 5]);
      else if (world.kinds[n] !== K.fixture && by1 >= y + 0.3 && by0 <= y + 2.0) splat(g.dS, B[6 * n], B[6 * n + 2], B[6 * n + 3], B[6 * n + 5]);
    }
    for (let c = 0; c < g.W * g.H; c++) if (!g.free[c]) { g.dI[c] = 0; g.dS[c] = 0; }
  }
  m.set(key, g);
  return g;
}

/** one leg on one grid, the eye's height moving from y0 to y1 over the first `ease` share of the way */
function leg(ctx: PoseCtx, level: string | null, p: [number, number], q: [number, number], y0: number, y1: number, ease = 1, rung = 0, snap = 1.0): Route | NoRoute {
  const { nav } = ctx, g = walkGrid(ctx, level, rung);
  // (A rescued walk is walked to where it is going: the planner's leg tries the tiers in turn and snaps an end to the nearest passable cell within `snap`, so a pose over a sofa,
  //  which the first three tiers call blocked, is "reached" at a cell a metre away and the last hop to the true end is a straight line nobody checked. Here the first tier at which
  //  both ends are themselves passable is asked first; the planner's own answer is the fallback.)
  let l: ReturnType<typeof nav.leg> = null;
  if (rung >= 1) for (let ti = 0; ti < 5 && !l; ti++) if (nav.passableAt(g, p[0], p[1], ti) && nav.passableAt(g, q[0], q[1], ti)) l = nav.leg(g, p, q, { snap, tiers: [ti] });
  if (!l) l = nav.leg(g, p, q, { snap });
  if (!l) return { ok: false, reason: `no walkable leg on ${level ?? 'the lot'}` };
  let total = 0; for (let i = 1; i < l.pts.length; i++) total += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
  let run = 0;
  const pts: V3[] = l.pts.map((xy, i) => {
    if (i) run += Math.hypot(xy[0] - l.pts[i - 1][0], xy[1] - l.pts[i - 1][1]);
    const u = total > 1e-6 ? run / total : 1;
    return [xy[0], y0 + (y1 - y0) * smooth(u / ease), xy[1]] as V3;
  });
  return { ok: true, pts, length: total, mode: pts.map(() => 'walk' as const), levels: pts.map(() => level), tier: l.tier };
}
/** a flight, as the eye climbs it (S2's walking line when the flight turns, else foot to head) */
function flight(s: PoseCtx['world']['stairs'][number], up: boolean, level: string): Route {
  const line: V3[] = s.path && s.path.length > 1 ? (up ? s.path : s.path.slice().reverse()) : up ? [s.bottom, s.top] : [s.top, s.bottom];
  const pts = line.map(p => [p[0], p[1] + EYE_IN, p[2]] as V3);
  let length = 0; for (let i = 1; i < pts.length; i++) length += dist3(pts[i - 1], pts[i]);
  return { ok: true, pts, length, mode: pts.map(() => 'stair' as const), levels: pts.map(() => level), tier: 0 };
}
/** joined routes: the shared joint is kept once (the first route's vertex) */
function join(rs: Route[]): Route {
  const pts: V3[] = [], mode: Route['mode'] = [], levels: Route['levels'] = []; let tier = 0;
  for (const r of rs) {
    tier = Math.max(tier, r.tier);
    r.pts.forEach((p, i) => { if (pts.length && dist3(pts[pts.length - 1], p) < 1e-3) return; pts.push(p); mode.push(r.mode[i]); levels.push(r.levels[i]); });
  }
  let length = 0; for (let i = 1; i < pts.length; i++) length += dist3(pts[i - 1], pts[i]);
  return { ok: true, pts, length, mode, levels, tier };
}

// ---- a spiral stair (rung 1) ------------------------------------------------------------------------------------------------------------------
// The digest's spiral has `bottom` and `top` on one vertical line (its column) and a footprint the grid blocks whole, so the planner's grid has no cell within a
// metre of its foot and the walk to it fails on every spiral. The planner's own film walks it as a helix round the column (assets/shot-planner.ts, "a spiral"):
// at the void's radius less 0.3 m, over the treads as built (`spin`), the eye 1.5 m over the tread under it. This is that line, with the eye stepping on from clear
// floor outside the footprint (or the void) and off to clear floor on the other storey.
type Spiral = { on: [number, number]; off: [number, number]; pts: V3[]; onLevel: string; offLevel: string };
/** `fromPt` is where the eye comes from on the storey it climbs (or descends) from, `toPt` where it goes next once off the stair; a spot beside the column is only taken if the walk
 *  to it (from `fromPt`) and the walk on from it (to `toPt`) exist on the rung's grid, so it never lands in a closet the rest of the storey cannot reach. */
function spiral(ctx: PoseCtx, s: WStair, up: boolean, fromPt: [number, number], toPt: [number, number] | null, rung: number): Spiral | null {
  const { world, nav, index } = ctx, c = s.bottom, rise = s.top[1] - s.bottom[1];
  const upper = world.levels.find(l => l.id === s.to), lower = world.levels.find(l => l.id === s.from);
  if (!upper || !lower) return null;
  const vd = upper.voids.find(v => c[0] >= v.x - 0.5 && c[0] <= v.x + v.w + 0.5 && c[2] >= v.z - 0.5 && c[2] <= v.z + v.d + 0.5);
  const R = Math.max(0.55, Math.min(1.1, vd ? Math.min(vd.w, vd.d) / 2 - 0.3 : 0.8));
  const sweep = s.spin ? s.spin.sweep : 300 * Math.PI / 180, a0 = s.spin ? s.spin.a0 : Math.atan2(fromPt[0] - c[0], fromPt[1] - c[2]);
  const ang = (u: number) => a0 + sweep * u, N = 30;
  const at = (a: number, r: number): [number, number] => [c[0] + Math.sin(a) * r, c[2] + Math.cos(a) * r];
  const wallBetween = (a: [number, number], b: [number, number], y: number) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) return false;
    return !!index.raycast(a[0], y, a[1], (b[0] - a[0]) / L, 0, (b[1] - a[1]) / L, L, k => WALL_KINDS.has(k));
  };
  // clear floor outside the column near this angle: for each comfort tier in turn, the first of a fixed fan of angles (and, at each, the nearest radius) that is passable,
  // has no wall between it and the helix and is joined to the rest of the storey (`joined`)
  const stand = (levelId: string, a: number, joined: (q: [number, number]) => boolean): { q: [number, number]; da: number } | null => {
    const lv = nav.levelOf(levelId), g = walkGrid(ctx, levelId, rung);
    for (const tier of [1, 3, 4]) for (const da of [0, 25, -25, 50, -50, 75, -75, 100, -100, 125, -125, 150, -150, 180]) {
      const aa = a + da * Math.PI / 180;
      for (let r = R + 0.3; r < 4.5; r += 0.15) {
        const q = at(aa, r);
        if (!nav.passableAt(g, q[0], q[1], tier) || wallBetween(at(aa, R), q, lv.y + EYE_IN)) continue;
        if (joined(q)) return { q, da: da * Math.PI / 180 };
        break;
      }
    }
    return null;
  };
  const arc = (a1: number, a2: number, y: number): V3[] => { const n = Math.max(1, Math.ceil(Math.abs(a2 - a1) / (18 * Math.PI / 180))), out: V3[] = []; for (let k = 0; k <= n; k++) { const q = at(a1 + (a2 - a1) * k / n, R); out.push([q[0], y, q[1]]); } return out; };
  const helix: V3[] = []; for (let k = 0; k <= N; k++) { const u = k / N, q = at(ang(u), R); helix.push([q[0], s.bottom[1] + rise * u + EYE_IN, q[1]]); }
  const onLevel = up ? s.from : s.to, offLevel = up ? s.to : s.from;
  const aOn = up ? ang(0) : ang(1), aOff = up ? ang(1) : ang(0);
  const reach = (levelId: string, p: [number, number], q: [number, number]) => !failed(leg(ctx, levelId, p, q, 0, 0, 1, rung));
  const on = stand(onLevel, aOn, q => reach(onLevel, fromPt, q));
  const off = on && stand(offLevel, aOff, q => !toPt || reach(offLevel, q, toPt));
  if (!on || !off) return null;
  const yOn = nav.levelOf(onLevel).y + EYE_IN, yOff = nav.levelOf(offLevel).y + EYE_IN;
  const line = up ? helix : helix.slice().reverse();
  const pts: V3[] = [[on.q[0], yOn, on.q[1]], ...(on.da ? arc(aOn + on.da, aOn, yOn).slice(0, -1) : []), ...line, ...(off.da ? arc(aOff, aOff + off.da, yOff).slice(1) : []), [off.q[0], yOff, off.q[1]]];
  return { on: on.q, off: off.q, pts, onLevel, offLevel };
}

type Hop = { stair: PoseCtx['world']['stairs'][number]; up: boolean };
/** the shortest chain of flights (fewest flights, then the world's order) from storey `a` to storey `b`, or null */
export function flightsBetween(stairs: PoseCtx['world']['stairs'], a: string, b: string): Hop[] | null {
  const prev = new Map<string, { from: string; hop: Hop }>(), seen = new Set<string>([a]); let front = [a];
  while (front.length && !seen.has(b)) {
    const next: string[] = [];
    for (const l of front) for (const s of stairs) {
      for (const [from, to, up] of [[s.from, s.to, true], [s.to, s.from, false]] as Array<[string, string, boolean]>) {
        if (from !== l || seen.has(to)) continue;
        seen.add(to); prev.set(to, { from: l, hop: { stair: s, up } }); next.push(to);
      }
    }
    front = next;
  }
  if (!seen.has(b)) return null;
  const out: Hop[] = []; for (let l = b; l !== a;) { const p = prev.get(l)!; out.unshift(p.hop); l = p.from; }
  return out;
}

/** The walk from one standing to the next. The planner's grid first, exactly as the router always did; when that gives no walk, or one over MAX_ROUTE_M, the rungs of the
 *  rescue ladder in turn (see the top of the file). The first walk within the cap wins; when none is, the last rung's reason is the answer (what is still in the way once the doorways are open). */
export function routeBetween(ctx: PoseCtx, a: Standing, b: Standing): Route | NoRoute {
  const plain = attempt(ctx, a, b, 0);
  if (!failed(plain)) return plain;
  let last: NoRoute = plain;
  for (const rung of [1, 2]) {
    const r = attempt(ctx, a, b, rung);
    if (failed(r)) last = r; else return { ...r, rescued: rung };
  }
  // (a cut for length, or an entry above the ground, is the same whatever the grid: its reason is kept as it was. A cut because a grid has no way through says what is in the way on the best grid)
  return /no walkable leg|no way on or off/.test(plain.reason) ? last : plain;
}
function attempt(ctx: PoseCtx, a: Standing, b: Standing, rung: number): Route | NoRoute {
  const { world, nav } = ctx;
  const done = (r: Route | NoRoute): Route | NoRoute => (r.ok && r.length > MAX_ROUTE_M ? { ok: false, reason: `route is ${r.length.toFixed(0)} m` } : r);
  const flat = Math.hypot(a.eye[0] - b.eye[0], a.eye[2] - b.eye[2]);

  // 1. the same spot: a turn on the spot (or a lift of the eye)
  if (a.level === b.level && flat < 0.3) return { ok: true, pts: [a.eye, b.eye], length: dist3(a.eye, b.eye), mode: ['walk', 'walk'], levels: [a.level, b.level], tier: 0 };
  // 2. the same storey, or both on the lot
  if (a.level === b.level) return done(leg(ctx, a.level, [a.eye[0], a.eye[2]], [b.eye[0], b.eye[2]], a.eye[1], b.eye[1], 1, rung));
  return done(otherCases(ctx, a, b, world, nav, rung));
}
function otherCases(ctx: PoseCtx, a: Standing, b: Standing, world: PoseCtx['world'], nav: PoseCtx['nav'], rung: number): Route | NoRoute {
  // 3. storeys apart: the shortest chain of flights
  if (a.level !== null && b.level !== null) {
    const chain = flightsBetween(world.stairs, a.level, b.level);
    if (!chain) return { ok: false, reason: 'no flights connect the storeys' };
    const parts: Route[] = []; let cur: [number, number] = [a.eye[0], a.eye[2]], curLevel = a.level, curY = a.eye[1];
    for (const [hi, hop] of chain.entries()) {
      const s = hop.stair, foot: V3 = hop.up ? s.bottom : s.top, head: V3 = hop.up ? s.top : s.bottom;
      const lv = nav.levelOf(curLevel);
      if (rung >= 1 && s.spiral) {
        // a spiral: to clear floor beside the column, round it, and off onto the other storey (the planner's own helix)
        const nx = chain[hi + 1], toPt: [number, number] | null = nx ? (nx.stair.spiral ? null : nx.up ? [nx.stair.bottom[0], nx.stair.bottom[2]] : [nx.stair.top[0], nx.stair.top[2]]) : [b.eye[0], b.eye[2]];
        const sp = spiral(ctx, s, hop.up, cur, toPt, rung);
        if (!sp) return { ok: false, reason: `no way on or off the spiral ${s.from}-${s.to}` };
        const l = leg(ctx, curLevel, cur, sp.on, curY, lv.y + EYE_IN, 1, rung);
        if (failed(l)) return { ok: false, reason: `to the foot of ${s.from}-${s.to}: ${l.reason}` };
        let length = 0; for (let i = 1; i < sp.pts.length; i++) length += dist3(sp.pts[i - 1], sp.pts[i]);
        parts.push(l, { ok: true, pts: sp.pts, length, mode: sp.pts.map(() => 'stair' as const), levels: sp.pts.map(() => curLevel), tier: 0 });
        curLevel = sp.offLevel; curY = nav.levelOf(curLevel).y + EYE_IN; cur = sp.off;
        continue;
      }
      const l = leg(ctx, curLevel, cur, [foot[0], foot[2]], curY, lv.y + EYE_IN, 1, rung);
      if (failed(l)) return { ok: false, reason: `to the foot of ${s.from}-${s.to}: ${l.reason}` };
      parts.push(l, flight(s, hop.up, curLevel));
      curLevel = hop.up ? s.to : s.from; curY = head[1] + EYE_IN; cur = [head[0], head[2]];
    }
    const last = leg(ctx, curLevel, cur, [b.eye[0], b.eye[2]], curY, b.eye[1], 1, rung);
    if (failed(last)) return { ok: false, reason: `from the last flight: ${last.reason}` };
    parts.push(last);
    return join(parts);
  }
  // 4. in or out through the entry door (which has to be on the ground: a stair up to it is the planner's `extStair`, not a walk). The router's own limit is a hand's breadth
  //    over the ground (0.3 m, a threshold); the rescue ladder takes the planner's (shot-planner.ts: steps are drawn only for an entry above 0.9 m, and a lower one is walked
  //    on the ground grid), which is a plinth and a step or two
  const e = world.entry; if (!e) return { ok: false, reason: 'no entry door' };
  const entryLv = nav.levelOf(e.level);
  if (entryLv.y > (rung >= 1 ? ENTRY_STEP_M : 0.3)) return { ok: false, reason: 'the entry is above the ground' };
  const inner: [number, number] = [e.x - e.out[0] * 0.7, e.z - e.out[1] * 0.7], outer: [number, number] = [e.x + e.out[0] * 0.9, e.z + e.out[1] * 0.9];
  const goingOut = a.level !== null, indoor = goingOut ? a : b, outdoor = goingOut ? b : a;
  const innerEye: Standing = { eye: [inner[0], entryLv.y + EYE_IN, inner[1]], level: e.level };
  const inside = goingOut ? attempt(ctx, indoor, innerEye, rung) : attempt(ctx, innerEye, indoor, rung);
  if (failed(inside)) return { ok: false, reason: `inside: ${inside.reason}` };
  const door: Route = { ok: true, pts: [[e.x, entryLv.y + EYE_IN, e.z], [outer[0], EYE_OUT, outer[1]]], length: 1, mode: ['walk', 'walk'], levels: [e.level, null], tier: 0 };
  const out = goingOut ? leg(ctx, null, outer, [outdoor.eye[0], outdoor.eye[2]], EYE_OUT, outdoor.eye[1], 0.6, rung) : leg(ctx, null, [outdoor.eye[0], outdoor.eye[2]], outer, outdoor.eye[1], EYE_OUT, 0.6, rung);
  if (failed(out)) return { ok: false, reason: `outside: ${out.reason}` };
  const rev = (r: Route): Route => ({ ...r, pts: r.pts.slice().reverse(), mode: r.mode.slice().reverse(), levels: r.levels.slice().reverse() });
  return goingOut ? join([inside, door, out]) : join([out, rev(door), inside]);
}

/** The route with its corners rounded (the planner's own fillet, radius up to 1.2 m, kept where the arc stays clear): a camera that turns a corner
 *  at walking pace in one step turns its view at hundreds of degrees a second. Flights are left as S2 drew them. A rescued walk is rounded on the grid it was walked on. */
export function smoothRoute(ctx: PoseCtx, r: Route): Route {
  const { nav } = ctx; const pts: V3[] = [], mode: Route['mode'] = [], levels: Route['levels'] = [];
  for (let i = 0; i < r.pts.length;) {
    let j = i; while (j + 1 < r.pts.length && r.mode[j + 1] === r.mode[i] && r.levels[j + 1] === r.levels[i]) j++;
    const run = r.pts.slice(i, j + 1);
    let out = run;
    if (r.mode[i] === 'walk' && run.length >= 3) {
      const g = walkGrid(ctx, r.levels[i], r.rescued || 0);
      out = fillet(run, 1.2, p => nav.passableAt(g, p[0], p[2], 3));
    }
    for (const p of out) { pts.push(p); mode.push(r.mode[i]); levels.push(r.levels[i]); }
    i = j + 1;
  }
  let length = 0; for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return { ...r, pts, mode, levels, length };
}
