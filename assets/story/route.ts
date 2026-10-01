// Routes between two eyes: where the camera WALKS from one beat's pose to the next.
//
//   same storey      one leg on that storey's 0.2 m grid: A* on a cost that keeps to the middle of rooms and doorways, string-pulled
//                    (the planner's own nav.leg, so a walk never hugs a wall or cuts a corner through furniture)
//   another storey   the shortest chain of flights (world.stairs, up or down), a leg to each flight's foot and the flight's own line
//   in or out        through the entry door, when the entry is on the ground; outdoors, a leg on the lot's grid
//   anything else    a CUT, never a straight line through a wall: { ok: false } and the track bakes a crossfade instead
//
// Pure and deterministic (fixed grids, fixed tie-breaks). Owner: story-bake. THREE-free.
import type { V3 } from '../shot-probe.js';
import { fillet } from '../shot-planner.js';
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
};
export type NoRoute = { ok: false; reason: string };
/** (the repo compiles without strictNullChecks, where `ok` alone does not narrow the union) */
export const failed = (r: Route | NoRoute): r is NoRoute => !r.ok;

export const EYE_IN = 1.55, EYE_OUT = 1.7;
/** the route length cap: a walk longer than this is a cut (about 15 s of walking: more is dead time while a voice waits) */
export const MAX_ROUTE_M = 24;
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** one leg on one grid, the eye's height moving from y0 to y1 over the first `ease` share of the way */
function leg(ctx: PoseCtx, level: string | null, p: [number, number], q: [number, number], y0: number, y1: number, ease = 1): Route | NoRoute {
  const { nav } = ctx, g = level ? nav.grid(nav.levelOf(level)) : nav.grid(null, 0);
  const l = nav.leg(g, p, q, { snap: 1.0 });
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

export function routeBetween(ctx: PoseCtx, a: Standing, b: Standing): Route | NoRoute {
  const { world, nav } = ctx;
  const done = (r: Route | NoRoute): Route | NoRoute => (r.ok && r.length > MAX_ROUTE_M ? { ok: false, reason: `route is ${r.length.toFixed(0)} m` } : r);
  const flat = Math.hypot(a.eye[0] - b.eye[0], a.eye[2] - b.eye[2]);

  // 1. the same spot: a turn on the spot (or a lift of the eye)
  if (a.level === b.level && flat < 0.3) return { ok: true, pts: [a.eye, b.eye], length: dist3(a.eye, b.eye), mode: ['walk', 'walk'], levels: [a.level, b.level], tier: 0 };
  // 2. the same storey, or both on the lot
  if (a.level === b.level) return done(leg(ctx, a.level, [a.eye[0], a.eye[2]], [b.eye[0], b.eye[2]], a.eye[1], b.eye[1], 1));
  return done(otherCases(ctx, a, b, world, nav));
}
function otherCases(ctx: PoseCtx, a: Standing, b: Standing, world: PoseCtx['world'], nav: PoseCtx['nav']): Route | NoRoute {
  // 3. storeys apart: the shortest chain of flights
  if (a.level !== null && b.level !== null) {
    const chain = flightsBetween(world.stairs, a.level, b.level);
    if (!chain) return { ok: false, reason: 'no flights connect the storeys' };
    const parts: Route[] = []; let cur: [number, number] = [a.eye[0], a.eye[2]], curLevel = a.level, curY = a.eye[1];
    for (const hop of chain) {
      const s = hop.stair, foot: V3 = hop.up ? s.bottom : s.top, head: V3 = hop.up ? s.top : s.bottom;
      const lv = nav.levelOf(curLevel);
      const l = leg(ctx, curLevel, cur, [foot[0], foot[2]], curY, lv.y + EYE_IN, 1);
      if (failed(l)) return { ok: false, reason: `to the foot of ${s.from}-${s.to}: ${l.reason}` };
      parts.push(l, flight(s, hop.up, curLevel));
      curLevel = hop.up ? s.to : s.from; curY = head[1] + EYE_IN; cur = [head[0], head[2]];
    }
    const last = leg(ctx, curLevel, cur, [b.eye[0], b.eye[2]], curY, b.eye[1], 1);
    if (failed(last)) return { ok: false, reason: `from the last flight: ${last.reason}` };
    parts.push(last);
    return join(parts);
  }
  // 4. in or out through the entry door (which has to be on the ground: a stair up to it is the planner's `extStair`, not a walk)
  const e = world.entry; if (!e) return { ok: false, reason: 'no entry door' };
  const entryLv = nav.levelOf(e.level);
  if (entryLv.y > 0.3) return { ok: false, reason: 'the entry is above the ground' };
  const inner: [number, number] = [e.x - e.out[0] * 0.7, e.z - e.out[1] * 0.7], outer: [number, number] = [e.x + e.out[0] * 0.9, e.z + e.out[1] * 0.9];
  const goingOut = a.level !== null, indoor = goingOut ? a : b, outdoor = goingOut ? b : a;
  const innerEye: Standing = { eye: [inner[0], entryLv.y + EYE_IN, inner[1]], level: e.level };
  const inside = goingOut ? routeBetween(ctx, indoor, innerEye) : routeBetween(ctx, innerEye, indoor);
  if (failed(inside)) return { ok: false, reason: `inside: ${inside.reason}` };
  const door: Route = { ok: true, pts: [[e.x, entryLv.y + EYE_IN, e.z], [outer[0], EYE_OUT, outer[1]]], length: 1, mode: ['walk', 'walk'], levels: [e.level, null], tier: 0 };
  const out = goingOut ? leg(ctx, null, outer, [outdoor.eye[0], outdoor.eye[2]], EYE_OUT, outdoor.eye[1], 0.6) : leg(ctx, null, [outdoor.eye[0], outdoor.eye[2]], outer, outdoor.eye[1], EYE_OUT, 0.6);
  if (failed(out)) return { ok: false, reason: `outside: ${out.reason}` };
  const rev = (r: Route): Route => ({ ...r, pts: r.pts.slice().reverse(), mode: r.mode.slice().reverse(), levels: r.levels.slice().reverse() });
  return goingOut ? join([inside, door, out]) : join([out, rev(door), inside]);
}

/** The route with its corners rounded (the planner's own fillet, radius up to 1.2 m, kept where the arc stays clear): a camera that turns a corner
 *  at walking pace in one step turns its view at hundreds of degrees a second. Flights are left as S2 drew them. */
export function smoothRoute(ctx: PoseCtx, r: Route): Route {
  const { nav } = ctx; const pts: V3[] = [], mode: Route['mode'] = [], levels: Route['levels'] = [];
  for (let i = 0; i < r.pts.length;) {
    let j = i; while (j + 1 < r.pts.length && r.mode[j + 1] === r.mode[i] && r.levels[j + 1] === r.levels[i]) j++;
    const run = r.pts.slice(i, j + 1);
    let out = run;
    if (r.mode[i] === 'walk' && run.length >= 3) {
      const g = r.levels[i] ? nav.grid(nav.levelOf(r.levels[i]!)) : nav.grid(null, 0);
      out = fillet(run, 1.2, p => nav.passableAt(g, p[0], p[2], 3));
    }
    for (const p of out) { pts.push(p); mode.push(r.mode[i]); levels.push(r.levels[i]); }
    i = j + 1;
  }
  let length = 0; for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return { ...r, pts, mode, levels, length };
}
