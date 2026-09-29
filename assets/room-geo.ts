// Room geometry for the composer and the layout lints — THREE-free, so it runs in Node and in the page alike.
//
//   analyzeRoom(spec, lv, room, opts)  the room's walls (exterior and partition runs along each of its four edges, with
//                                     their faces), its openings (doors, doorways, windows, glass), its portals (every
//                                     way in: doors, doorways and the open spans of an open plan), the obstacles on its
//                                     floor (stairs, voids, partitions crossing it, the hero's surface) and the
//                                     keep-outs (door swings, stair run-in and step-off, the hero's approach)
//   Obb, obb(), overlap(), inside()   oriented rectangles in plan and their separating-axis test
//   laneGrid(geo, blockers)           a 0.1 m occupancy grid with a clearance field: lanesOk / reach
//   sizeOf(type, params)              an item's footprint box (registry props: their declared footprint and the params
//                                     they honour; page builders: assets/props/placement.ts `size`)
//
// Coordinates are the spec's: metres, x east, z south; a room edge N is its min-z edge, S max-z, W min-x, E max-x.
// Owner: S3 (compose).
import { perimeterEdges, edgeForOpening } from './house-geometry.js';
import { PROPS } from './props/index.js';
import { PLACEMENT } from './props/placement.js';
import { pageItemDef } from './item-meta.js';

export type Side = 'N' | 'S' | 'W' | 'E';
export const SIDES: Side[] = ['N', 'S', 'W', 'E'];
export const DEG = Math.PI / 180;
export const mm = (v: number) => Math.round(v * 1000) / 1000;
/** into the room from each edge */
export const INWARD: Record<Side, [number, number]> = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };
/** the rot (degrees) of an item backed onto that edge, facing into the room (items face +z at rot 0) */
export const ROT_OF_WALL: Record<Side, number> = { N: 0, S: 180, W: 90, E: 270 };
export const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', W: 'E', E: 'W' };
export const alongX = (s: Side) => s === 'N' || s === 'S';
/** the rot that turns an item's front (+z) toward (fx, fz) */
export const rotToward = (fx: number, fz: number) => { let r = Math.atan2(fx, fz) / DEG; r = Math.round(r * 10) / 10; return ((r % 360) + 360) % 360; };
/** local (lx, lz) of an item at rot → world offset */
export const turn = (lx: number, lz: number, rot: number): [number, number] => { const a = rot * DEG, c = Math.cos(a), s = Math.sin(a); return [lx * c + lz * s, -lx * s + lz * c]; };

// ---- oriented rectangles -----------------------------------------------------------------------------------------
export interface Obb { cx: number; cz: number; hw: number; hd: number; rot: number }
export const obb = (cx: number, cz: number, w: number, d: number, rot = 0): Obb => ({ cx, cz, hw: w / 2, hd: d / 2, rot });
export function corners(o: Obb): Array<[number, number]> {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const [x, z] = turn(sx * o.hw, sz * o.hd, o.rot); return [o.cx + x, o.cz + z] as [number, number]; });
}
const cardinal = (r: number) => Math.abs(((r % 90) + 90) % 90) < 1e-6;
export function aabb(o: Obb) {
  if (cardinal(o.rot)) { const q = Math.round(o.rot / 90) % 2 !== 0; const hx = q ? o.hd : o.hw, hz = q ? o.hw : o.hd; return { x0: o.cx - hx, x1: o.cx + hx, z0: o.cz - hz, z1: o.cz + hz }; }
  const c = corners(o); return { x0: Math.min(...c.map(p => p[0])), x1: Math.max(...c.map(p => p[0])), z0: Math.min(...c.map(p => p[1])), z1: Math.max(...c.map(p => p[1])) };
}
/** how deep two rectangles overlap (the smallest separating-axis penetration, 0 when apart) */
export function overlap(a: Obb, b: Obb): number {
  if (cardinal(a.rot) && cardinal(b.rot)) {
    const A = aabb(a), B = aabb(b);
    return Math.max(0, Math.min(Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0)));
  }
  const ca = corners(a), cb = corners(b); let best = Infinity;
  for (const o of [a, b]) for (const k of [0, 1]) {
    const [ax, az] = turn(k ? 0 : 1, k ? 1 : 0, o.rot);
    const pa = ca.map(p => p[0] * ax + p[1] * az), pb = cb.map(p => p[0] * ax + p[1] * az);
    const d = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (d <= 0) return 0; best = Math.min(best, d);
  }
  return best;
}
export function containsPt(o: Obb, x: number, z: number, pad = 0) {
  const [lx, lz] = turn(x - o.cx, z - o.cz, -o.rot);
  return Math.abs(lx) <= o.hw + pad && Math.abs(lz) <= o.hd + pad;
}
/** a rectangle from two corners */
export const rectObb = (x0: number, z0: number, x1: number, z1: number): Obb => obb((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(z1 - z0), 0);

// ---- item sizes ----------------------------------------------------------------------------------------------------
export interface Size { w: number; d: number; h: number; ox: number; oz: number; y0: number }
/** the spec keys a type honours: a registry prop's, or a page builder's (item-map.ts ITEM_PARAMS, through item-meta.ts) */
export const paramsOf = (type: string): string[] => { const def = PROPS.get(type) || pageItemDef(type); return def ? def.params || [] : []; };
export function sizeOf(type: string, it: any = {}): Size | null {
  const def = PROPS.get(type), pl = PLACEMENT[type];
  if (def) {
    let [w, d] = def.footprint, h = def.height;
    const P: string[] = def.params || [];
    if (P.includes('w') && it.w > 0) w = it.w;
    if (P.includes('d') && it.d > 0) d = it.d;
    if (P.includes('l') && it.l > 0) d = it.l;
    if (P.includes('r') && it.r > 0) { w = it.r * 2; d = it.r * 2; }
    if (type === 'patterned-rug' && it.shape === 'round') d = w;
    if (P.includes('h') && it.h > 0 && !def.surface) h = it.h;
    // a wall-hung registry prop has its origin at its BACK (it grows into +z off the wall): its box sits d/2 in front
    return { w, d, h, ox: 0, oz: pl && pl.hangs === 'wall' ? d / 2 : 0, y0: 0 };
  }
  if (pl && pl.size) {
    const s = pl.size, P = paramsOf(type);
    let w = s.w, d = s.d, h = s.h;
    if (P.includes('w') && it.w > 0) w = it.w;
    if (P.includes('d') && it.d > 0) d = it.d;
    if (P.includes('r') && it.r > 0) { w = it.r * 2; d = it.r * 2; }
    if (P.includes('h') && it.h > 0) h = it.h;
    return { w, d, h, ox: s.ox || 0, oz: s.oz || 0, y0: s.y0 || 0 };
  }
  return null;
}
/** wall-mounted items whose `y` is their CENTRE (the rest mount by their bottom edge) */
export const CENTRE_MOUNT = new Set(['wall-art', 'gallery-wall', 'round-mirror', 'wall-clock', 'wall-hanging', 'wall-tv', 'whiteboard', 'pin-board']);
/** an authored item's plan box (the footprint centre after its offset, turned by rot) */
export function itemObb(it: any): Obb | null {
  const s = sizeOf(it.type, it); if (!s || !Array.isArray(it.at)) return null;
  const rot = it.rot || 0, [ox, oz] = turn(s.ox, s.oz, rot);
  return obb(it.at[0] + ox, it.at[1] + oz, s.w, s.d, rot);
}

// ---- the room ------------------------------------------------------------------------------------------------------
export interface Win { a: number; b: number; sill: number; h: number; type: string }
export interface Run { side: Side; kind: 'ext' | 'part'; line: number; face: number; a: number; b: number; windows: Win[]; doors: Array<{ a: number; b: number }> }
export interface Portal { side: Side; kind: string; x: number; z: number; w: number; a: number; b: number; hinged: boolean; open: boolean; entry: boolean }
export interface Geo {
  spec: any; lv: any; room: any; b: { x: number; z: number; w: number; d: number };
  runs: Run[];                 // wall segments along the room's edges (doors cut out)
  walled: Record<Side, Array<[number, number]>>;   // the spans of each edge that have a wall (doors included)
  open: Array<{ side: Side; a: number; b: number }>;
  portals: Portal[]; windows: Array<Win & { side: Side; line: number }>;
  obstacles: Obb[];            // solid things on the floor that are not items (stairs, voids, partitions, the hero)
  keepouts: Obb[];             // floor that must stay clear of furniture (door swings, stair run-in, hero approach)
  heroHere: boolean;
  area: number;
}
const HALF = { ext: 0.08, part: 0.07 };
const TOL = 0.25;

function union(spans: Array<[number, number]>): Array<[number, number]> {
  const s = spans.filter(([a, b]) => b - a > 0.02).sort((p, q) => p[0] - q[0]); const out: Array<[number, number]> = [];
  for (const [a, b] of s) { const l = out[out.length - 1]; if (l && a <= l[1] + 0.02) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out;
}
function subtract(span: [number, number], cuts: Array<[number, number]>): Array<[number, number]> {
  let parts: Array<[number, number]> = [span];
  for (const [ca, cb] of cuts) parts = parts.flatMap(([a, b]) => (cb <= a || ca >= b) ? [[a, b] as [number, number]] : [[a, ca] as [number, number], [cb, b] as [number, number]].filter(([p, q]) => q - p > 0.02));
  return parts;
}

const edgeCache = new WeakMap<any, any[]>();
export function analyzeRoom(spec: any, lv: any, room: any): Geo {
  let edges = edgeCache.get(lv.footprint); if (!edges) { edges = perimeterEdges(lv.footprint); edgeCache.set(lv.footprint, edges); }
  const b = room.bounds;
  const lineOf: Record<Side, number> = { N: b.z, S: b.z + b.d, W: b.x, E: b.x + b.w };
  const spanOf = (s: Side): [number, number] => (alongX(s) ? [b.x, b.x + b.w] : [b.z, b.z + b.d]);
  const runs: Run[] = [], walled: any = { N: [], S: [], W: [], E: [] }, open: any[] = [], portals: Portal[] = [], windows: any[] = [];
  const obstacles: Obb[] = [], keepouts: Obb[] = [];
  const entry = spec.entry && spec.entry.level === lv.id ? spec.entry : null;
  for (const side of SIDES) {
    const [lo, hi] = spanOf(side), ln = lineOf[side];
    const segs: Array<{ kind: 'ext' | 'part'; line: number; a: number; b: number }> = [];
    for (const e of edges) if (e.side === side) {
      const el = alongX(side) ? e.a[1] : e.a[0]; if (Math.abs(el - ln) > TOL) continue;
      const a = Math.max(lo, alongX(side) ? e.a[0] : e.a[1]), bb = Math.min(hi, alongX(side) ? e.b[0] : e.b[1]);
      if (bb - a > 0.05) segs.push({ kind: 'ext', line: el, a, b: bb });
    }
    const doorsHere: Array<{ a: number; b: number; w: number; kind: string; hinged: boolean; entry: boolean }> = [];
    for (const p of lv.partitions || []) {
      if (!Array.isArray(p.from) || !Array.isArray(p.to)) continue;
      const px = Math.abs(p.from[1] - p.to[1]) < 1e-6;   // runs along x
      if (px !== alongX(side)) continue;
      const pl = px ? p.from[1] : p.from[0]; if (Math.abs(pl - ln) > TOL) continue;
      const p0 = px ? Math.min(p.from[0], p.to[0]) : Math.min(p.from[1], p.to[1]), p1 = px ? Math.max(p.from[0], p.to[0]) : Math.max(p.from[1], p.to[1]);
      const a = Math.max(lo, p0), bb = Math.min(hi, p1); if (bb - a <= 0.05) continue;
      segs.push({ kind: 'part', line: pl, a, b: bb });
      if (p.door !== null && p.door !== undefined) {
        const dir = px ? Math.sign(p.to[0] - p.from[0]) || 1 : Math.sign(p.to[1] - p.from[1]) || 1, c = (px ? p.from[0] : p.from[1]) + dir * p.door, w = p.doorW || 0.9;
        if (c + w / 2 > lo + 0.05 && c - w / 2 < hi - 0.05) doorsHere.push({ a: c - w / 2, b: c + w / 2, w, kind: 'doorway', hinged: w <= 1.1, entry: false });
      }
    }
    for (const op of lv.openings || []) {
      if (op.side !== side) continue;
      const e = edgeForOpening(edges, op.side, op.at); if (!e) continue;
      const el = alongX(side) ? e.a[1] : e.a[0]; if (Math.abs(el - ln) > TOL || op.at < lo - 0.05 || op.at > hi + 0.05) continue;
      const a = op.at - op.w / 2, bb = op.at + op.w / 2;
      const isEntry = !!entry && entry.side === op.side && Math.abs(entry.at - op.at) < 1e-6;
      if (op.type === 'door' || op.type === 'slider' || op.type === 'garage') doorsHere.push({ a, b: bb, w: op.w, kind: op.type, hinged: op.type === 'door' && op.w <= 1.1 && op.style !== 'cased', entry: isEntry });
      if (op.type === 'window' || op.type === 'glass' || op.type === 'slider') windows.push({ side, line: el, a, b: bb, sill: op.type === 'window' ? (op.sill ?? 0.9) : 0.05, h: op.h || (op.type === 'window' ? 1.2 : 2.2), type: op.type });
    }
    const cover = union(segs.map(s => [s.a, s.b] as [number, number]));
    walled[side] = cover;
    for (const [a, bb] of subtract([lo, hi], cover)) if (bb - a >= 0.3) { open.push({ side, a, b: bb }); portals.push({ side, kind: 'open', ...ptOn(side, ln, (a + bb) / 2), w: bb - a, a, b: bb, hinged: false, open: true, entry: false }); }
    for (const d of doorsHere) portals.push({ side, kind: d.kind, ...ptOn(side, ln, (d.a + d.b) / 2), w: d.w, a: d.a, b: d.b, hinged: d.hinged, open: false, entry: d.entry });
    // runs: each wall segment less its doors
    for (const s of segs.sort((p, q) => p.a - q.a || (p.kind === 'ext' ? -1 : 1))) {
      const cuts = doorsHere.map(d => [d.a - 0.05, d.b + 0.05] as [number, number]);
      for (const [a, bb] of subtract([s.a, s.b], cuts)) {
        if (runs.some(r => r.side === side && a < r.b - 0.02 && bb > r.a + 0.02)) continue;   // an ext and a part on one line
        const inw = INWARD[side], sign = alongX(side) ? inw[1] : inw[0];
        runs.push({ side, kind: s.kind, line: s.line, face: s.line + sign * HALF[s.kind], a, b: bb, windows: [], doors: doorsHere.map(d => ({ a: d.a, b: d.b })) });
      }
    }
  }
  // a run ends at the faces of the walls across its ends (the room's corner is there, not at its bounds)
  const pre = { b, runs } as any;
  for (const r of runs) {
    const sign = alongX(r.side) ? INWARD[r.side][1] : INWARD[r.side][0], n0 = Math.min(r.face, r.face + sign * 0.7), n1 = Math.max(r.face, r.face + sign * 0.7);
    if (alongX(r.side)) { r.a = Math.max(r.a, limitOf(pre, 'W', n0, n1)); r.b = Math.min(r.b, limitOf(pre, 'E', n0, n1)); }
    else { r.a = Math.max(r.a, limitOf(pre, 'N', n0, n1)); r.b = Math.min(r.b, limitOf(pre, 'S', n0, n1)); }
  }
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i].b - runs[i].a < 0.1) runs.splice(i, 1);
  for (const r of runs) r.windows = windows.filter(w => w.side === r.side && Math.abs(w.line - r.line) < 0.05 && w.b > r.a && w.a < r.b).map(({ a, b, sill, h, type }) => ({ a, b, sill, h, type }));
  // door swings (a hinged leaf ≤ 1.1 m sweeps a square on the room side) and an approach strip in front of every door
  for (const p of portals) {
    if (p.open) continue;
    const [nx, nz] = INWARD[p.side], depth = p.hinged ? Math.max(0.8, p.w) : 0.6;
    const cx = p.x + nx * depth / 2, cz = p.z + nz * depth / 2;
    keepouts.push(alongX(p.side) ? obb(cx, cz, p.w + 0.1, depth, 0) : obb(cx, cz, depth, p.w + 0.1, 0));
  }
  // partitions that cross the room's interior are solid lines, with their doorways
  for (const p of lv.partitions || []) {
    if (!Array.isArray(p.from) || !Array.isArray(p.to)) continue;
    const px = Math.abs(p.from[1] - p.to[1]) < 1e-6, pl = px ? p.from[1] : p.from[0];
    const inside = px ? pl > b.z + TOL && pl < b.z + b.d - TOL : pl > b.x + TOL && pl < b.x + b.w - TOL; if (!inside) continue;
    const p0 = px ? Math.min(p.from[0], p.to[0]) : Math.min(p.from[1], p.to[1]), p1 = px ? Math.max(p.from[0], p.to[0]) : Math.max(p.from[1], p.to[1]);
    const lo = px ? b.x : b.z, hi = px ? b.x + b.w : b.z + b.d, a = Math.max(lo, p0), bb = Math.min(hi, p1); if (bb - a <= 0.05) continue;
    const cuts: Array<[number, number]> = [];
    if (p.door !== null && p.door !== undefined) { const dir = px ? Math.sign(p.to[0] - p.from[0]) || 1 : Math.sign(p.to[1] - p.from[1]) || 1, c = (px ? p.from[0] : p.from[1]) + dir * p.door, w = p.doorW || 0.9; cuts.push([c - w / 2, c + w / 2]); }
    for (const [s0, s1] of subtract([a, bb], cuts)) obstacles.push(px ? rectObb(s0, pl - 0.07, s1, pl + 0.07) : rectObb(pl - 0.07, s0, pl + 0.07, s1));
  }
  // stairs: this storey's flight (its footprint, and 1.6 m of run-in clear at its foot) and the flight arriving from
  // below (1.6 m of step-off clear at its head) — plan H: the canon's 1.6 m, not the old lint's 1.2
  const flight = (st: any, y: number) => {
    const run = st.type === 'spiral' ? 0 : (st.run || 3.36), w = st.w || (st.type === 'colonial' ? 1.2 : 1.1), a = (st.rot || 0) * DEG, dir: [number, number] = [Math.sin(a), Math.cos(a)];
    return { run, w, dir, at: st.at as [number, number], rot: st.rot || 0 };
  };
  if (lv.stairs && Array.isArray(lv.stairs.at)) {
    const f = flight(lv.stairs, lv.y);
    if (lv.stairs.type === 'spiral') obstacles.push(obb(f.at[0], f.at[1], 1.9, 1.9, 0));
    else {
      obstacles.push(obb(f.at[0] + f.dir[0] * f.run / 2, f.at[1] + f.dir[1] * f.run / 2, f.w + 0.1, f.run, f.rot));
      keepouts.push(obb(f.at[0] - f.dir[0] * 0.8, f.at[1] - f.dir[1] * 0.8, f.w + 0.1, 1.6, f.rot));
    }
  }
  for (const other of spec.levels || []) {
    if (!other.stairs || other.stairs.to !== lv.id || !Array.isArray(other.stairs.at) || other.stairs.type === 'spiral') continue;
    const f = flight(other.stairs, other.y), tx = f.at[0] + f.dir[0] * f.run, tz = f.at[1] + f.dir[1] * f.run;
    keepouts.push(obb(tx + f.dir[0] * 0.8, tz + f.dir[1] * 0.8, f.w + 0.1, 1.6, f.rot));
  }
  for (const v of lv.voids || []) obstacles.push(rectObb(v.x, v.z, v.x + v.w, v.z + v.d));
  // the hero: its surface is solid, and 2 m in front of it (the user side) stays clear (plan C9)
  let heroHere = false;
  if (spec.hero && spec.hero.level === lv.id && Array.isArray(spec.hero.at)) {
    const h = spec.hero, [hx, hz] = h.at, fwd: [number, number] = [Math.sin((h.rot || 0) * DEG), Math.cos((h.rot || 0) * DEG)];
    const surf = h.surface || 'desk', dims = surf === 'shelf' ? [0.9, 0.3] : surf === 'credenza' ? [1.8, 0.45] : surf === 'island' ? [2.4, 1.0] : surf === 'none' ? [0.4, 0.4] : [1.8, 0.85];
    const back = surf === 'shelf' ? -0.4 + 0.13 : 0, cx = hx + fwd[0] * back, cz = hz + fwd[1] * back;
    obstacles.push(obb(cx, cz, dims[0], dims[1], h.rot || 0));
    const reach = surf === 'desk' ? 0.75 : 0.35;   // the task chair sits at 0.8 in front of the desk
    keepouts.push(obb(cx + fwd[0] * (dims[1] / 2 + reach + 0.2 + 1.0), cz + fwd[1] * (dims[1] / 2 + reach + 0.2 + 1.0), 1.4, 2.0 + reach * 0.5, h.rot || 0));
    if (surf === 'desk') obstacles.push(obb(hx + fwd[0] * 0.8, hz + fwd[1] * 0.8, 0.6, 0.6, h.rot || 0));
    heroHere = hx > b.x - 0.3 && hx < b.x + b.w + 0.3 && hz > b.z - 0.3 && hz < b.z + b.d + 0.3;
  }
  // S2's features (coded against its contract: features[] with a level and a from → to run, or an at): built-ins,
  // fireplaces and bays are solid until S2 merges and publishes them as anchors
  for (const f of spec.features || []) {
    if (!f || (f.level && f.level !== lv.id)) continue;
    if (Array.isArray(f.from) && Array.isArray(f.to)) { const dep = f.depth || 0.4, px = Math.abs(f.from[1] - f.to[1]) < 1e-6; obstacles.push(px ? rectObb(Math.min(f.from[0], f.to[0]), f.from[1] - dep / 2, Math.max(f.from[0], f.to[0]), f.from[1] + dep / 2) : rectObb(f.from[0] - dep / 2, Math.min(f.from[1], f.to[1]), f.from[0] + dep / 2, Math.max(f.from[1], f.to[1]))); }
    else if (Array.isArray(f.at) && f.type === 'fireplace') obstacles.push(obb(f.at[0], f.at[1], f.w || 1.6, f.d || 0.5, f.rot || 0));
  }
  return { spec, lv, room, b, runs, walled, open, portals, windows, obstacles, keepouts, heroHere, area: b.w * b.d };
}
function ptOn(side: Side, line: number, t: number) { return alongX(side) ? { x: t, z: line } : { x: line, z: t }; }

/** the room's usable limits on one side for a span of the other axis: the wall face where a wall runs, else the edge */
export function limitOf(geo: Geo, side: Side, a: number, b: number, openSlack = 0): number {
  const edge = side === 'N' ? geo.b.z : side === 'S' ? geo.b.z + geo.b.d : side === 'W' ? geo.b.x : geo.b.x + geo.b.w;
  const sign = alongX(side) ? INWARD[side][1] : INWARD[side][0];
  let lim = edge - sign * openSlack, walled = false;
  for (const r of geo.runs) if (r.side === side && r.b > a + 0.01 && r.a < b - 0.01) { lim = walled ? (sign > 0 ? Math.max(lim, r.face) : Math.min(lim, r.face)) : r.face; walled = true; }
  return lim;
}
/** is the rectangle inside the room (walls' faces where they run, the bounds elsewhere), within tol. openSlack lets
 *  it reach that far past an open side (a clearance or a walkway may lie on the next room's floor; a body may not) */
export function insideRoom(geo: Geo, o: Obb, tol = 0.01, openSlack = 0): boolean {
  const A = aabb(o);
  return A.z0 >= limitOf(geo, 'N', A.x0, A.x1, openSlack) - tol && A.z1 <= limitOf(geo, 'S', A.x0, A.x1, openSlack) + tol && A.x0 >= limitOf(geo, 'W', A.z0, A.z1, openSlack) - tol && A.x1 <= limitOf(geo, 'E', A.z0, A.z1, openSlack) + tol;
}

// ---- lanes: a 0.1 m grid over the room with a clearance field ------------------------------------------------------
export const CELL = 0.1;
export interface LaneGrid { nx: number; nz: number; x0: number; z0: number; blocked: Uint8Array; dist: Float32Array; near?: Uint8Array; }
/** a room's grid scratch: the static wall band, portal seeds, distances to the middle, and reusable buffers — all a
 *  pure function of geo, computed once. A LaneGrid returned by laneGrid() is valid until the next call for that geo. */
interface Base {
  nx: number; nz: number; x0: number; z0: number; blocked: Uint8Array; near: Uint8Array; inRoom: Uint8Array; mid: Float32Array;
  seeds: Int32Array[]; blk: Uint8Array; dist: Float32Array; seen: Uint32Array; stamp: number; queue: Int32Array; ps: Portal[];
}
const baseCache = new WeakMap<Geo, Base>();
function baseGrid(geo: Geo): Base {
  let hit = baseCache.get(geo); if (hit) return hit;
  const b = geo.b, x0 = b.x - CELL, z0 = b.z - CELL, nx = Math.ceil(b.w / CELL) + 2, nz = Math.ceil(b.d / CELL) + 2, N = nx * nz;
  const blocked = new Uint8Array(N), near = new Uint8Array(N), inRoom = new Uint8Array(N), mid = new Float32Array(N);
  const ps = geo.portals.filter(p => p.w >= 0.5), mx = b.x + b.w / 2, mz = b.z + b.d / 2;
  const seeds: number[][] = ps.map(() => []);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * CELL, z = z0 + (k + 0.5) * CELL, n = k * nx + i;
    const outside = x < b.x || x > b.x + b.w || z < b.z || z > b.z + b.d;
    let wall = false;
    for (const r of geo.runs) {
      const t = alongX(r.side) ? x : z, nn = alongX(r.side) ? z : x, sign = alongX(r.side) ? INWARD[r.side][1] : INWARD[r.side][0];
      if (t < r.a - 0.05 || t > r.b + 0.05) continue;
      if ((nn - r.face) * sign < 0.0) { wall = true; break; }
    }
    if (wall) blocked[n] = 1; else if (outside) blocked[n] = 2;   // outside through an open side or a door: free to measure from, not walkable
    inRoom[n] = outside ? 0 : 1; mid[n] = Math.hypot(x - mx, z - mz);
    ps.forEach((p, j) => {
      if (Math.hypot(x - p.x, z - p.z) < 0.75) near[n] = 1;
      // the cells a portal is entered by: a strip just inside it, 0.12–0.5 m in, across its width less 0.1 a side
      const [px, pz] = INWARD[p.side], t = alongX(p.side) ? x : z, depth = (x - p.x) * px + (z - p.z) * pz;
      if (t > p.a + 0.1 && t < p.b - 0.1 && depth > 0.12 && depth < 0.5) seeds[j].push(n);
    });
  }
  hit = { nx, nz, x0, z0, blocked, near, inRoom, mid, seeds: seeds.map(a => Int32Array.from(a)), blk: new Uint8Array(N), dist: new Float32Array(N), seen: new Uint32Array(N), stamp: 0, queue: new Int32Array(N), ps };
  baseCache.set(geo, hit); return hit;
}
export function laneGrid(geo: Geo, blockers: Obb[]): LaneGrid {
  const base = baseGrid(geo), { nx, nz, x0, z0 } = base, blocked = base.blk; blocked.set(base.blocked);
  for (const o of blockers) {
    const A = aabb(o), i0 = Math.max(0, Math.floor((A.x0 - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((A.x1 - x0) / CELL)), k0 = Math.max(0, Math.floor((A.z0 - z0) / CELL)), k1 = Math.min(nz - 1, Math.ceil((A.z1 - z0) / CELL));
    const card = Math.abs(((o.rot % 90) + 90) % 90) < 1e-6;
    for (let k = k0; k <= k1; k++) { const z = z0 + (k + 0.5) * CELL; for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * CELL;
      if (card ? (x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1) : containsPt(o, x, z, 0)) blocked[k * nx + i] = 1;
    } }
  }
  // chamfer distance to the nearest blocked (1) cell, in metres from cell centre to that cell's edge
  const INF = 1e9, dist = base.dist, N = nx * nz;
  for (let n = 0; n < N; n++) dist[n] = blocked[n] === 1 ? 0 : INF;
  const D = CELL, DD = CELL * Math.SQRT2;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const n = k * nx + i; let v = dist[n];
    if (i > 0 && dist[n - 1] + D < v) v = dist[n - 1] + D;
    if (k > 0) { if (dist[n - nx] + D < v) v = dist[n - nx] + D; if (i > 0 && dist[n - nx - 1] + DD < v) v = dist[n - nx - 1] + DD; if (i < nx - 1 && dist[n - nx + 1] + DD < v) v = dist[n - nx + 1] + DD; }
    dist[n] = v;
  }
  for (let k = nz - 1; k >= 0; k--) for (let i = nx - 1; i >= 0; i--) {
    const n = k * nx + i; let v = dist[n];
    if (i < nx - 1 && dist[n + 1] + D < v) v = dist[n + 1] + D;
    if (k < nz - 1) { if (dist[n + nx] + D < v) v = dist[n + nx] + D; if (i < nx - 1 && dist[n + nx + 1] + DD < v) v = dist[n + nx + 1] + DD; if (i > 0 && dist[n + nx - 1] + DD < v) v = dist[n + nx - 1] + DD; }
    dist[n] = v;
  }
  for (let n = 0; n < N; n++) if (dist[n] < INF) dist[n] = dist[n] > CELL / 2 ? dist[n] - CELL / 2 : 0;
  return { nx, nz, x0, z0, blocked, dist, near: base.near };
}

export interface LaneReport { ok: boolean; width: number; failed: string[] }
/**
 * Can someone walk W wide from every way in to every other, and from the ways in to the floor nearest the room's
 * middle? Near a portal (within 0.75 m of it) the doorway itself sets the width. `need` lists extra points that must be
 * reachable at `accessW` (a bed's side, a desk's chair). A room with no portal passes vacuously. `g` must be the
 * latest laneGrid(geo, …).
 */
export function lanesOk(geo: Geo, g: LaneGrid, W: number, need: Array<[number, number]> = [], accessW = 0.6): LaneReport {
  const failed: string[] = [];
  const base = baseGrid(geo), ps = base.ps;
  if (!ps.length) return { ok: true, width: W, failed };
  const { nx, nz } = g, N = nx * nz, blocked = g.blocked, dist = g.dist, near = base.near, queue = base.queue, seen = base.seen;
  const passW = (n: number, w: number) => blocked[n] === 0 && (dist[n] >= w / 2 - 0.001 || (near[n] === 1 && dist[n] >= Math.min(w, 0.6) / 2 - 0.001));
  // flood from seeds at width w; marks seen[n] = stamp; returns the stamp and how many cells it reached
  const flood = (seedLists: Int32Array[] | number[][], w: number) => {
    const st = ++base.stamp; let head = 0, tail = 0;
    for (const list of seedLists) for (let j = 0; j < list.length; j++) { const s = list[j]; if (seen[s] !== st && passW(s, w)) { seen[s] = st; queue[tail++] = s; } }
    while (head < tail) {
      const n = queue[head++], i = n % nx, k = (n - i) / nx;
      for (let dk = -1; dk <= 1; dk++) { const kk = k + dk; if (kk < 0 || kk >= nz) continue; for (let di = -1; di <= 1; di++) {
        const ii = i + di; if ((!di && !dk) || ii < 0 || ii >= nx) continue;
        const m = kk * nx + ii; if (seen[m] !== st && passW(m, w)) { seen[m] = st; queue[tail++] = m; }
      } }
    }
    return { st, size: tail };
  };
  const reachedBy = (st: number, list: Int32Array) => { for (let j = 0; j < list.length; j++) if (seen[list[j]] === st) return true; return false; };
  // the floor nearest the middle that a W-wide walker can stand on
  let best = Infinity;
  for (let n = 0; n < N; n++) if (base.inRoom[n] && passW(n, W) && base.mid[n] < best) best = base.mid[n];
  const target: number[] = [];
  if (best < Infinity) for (let n = 0; n < N; n++) if (base.inRoom[n] && base.mid[n] <= best + 0.3 && passW(n, W)) target.push(n);
  const from = flood([base.seeds[0]], W);
  ps.forEach((p, j) => { if (j && !reachedBy(from.st, base.seeds[j])) failed.push(`no ${W.toFixed(1)} m lane from the ${ps[0].kind} on ${ps[0].side} to the ${p.kind} on ${p.side}`); });
  // the floor nearest the middle must be reachable — unless it is a pocket inside a furniture group (under 1.5 m² of
  // free floor, like the well between a sofa, its chairs and its table), which the group's own access points cover
  if (target.length && !target.some(n => seen[n] === from.st)) {
    const pocket = flood([target], W);
    if (pocket.size * CELL * CELL > 1.5) failed.push(`no ${W.toFixed(1)} m lane from the ways in to the middle of the room`);
  }
  if (need.length) {
    const acc = flood(base.seeds, accessW);
    for (const [x, z] of need) {
      const i = Math.floor((x - g.x0) / CELL), k = Math.floor((z - g.z0) / CELL);
      let ok = false;
      for (let dk = -2; dk <= 2 && !ok; dk++) for (let di = -2; di <= 2 && !ok; di++) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii < nx && kk < nz && seen[kk * nx + ii] === acc.st) ok = true; }
      if (!ok) failed.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) cannot be reached ${accessW} m wide`);
    }
  }
  return { ok: !failed.length, width: W, failed };
}
