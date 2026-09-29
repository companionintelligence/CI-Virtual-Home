// Architecture plan geometry — THREE-free, shared by the builders (structure-build, facade, features, room-finish),
// the validator (scripts/validate/arch.mts), the plan export (plan-export/arch.ts) and the Node harnesses.
//
//   slabOpenings(spec, lv)     the holes a storey's slab has: its voids, the voids its flights' autoVoid asks for, the
//                              double-height rooms under it and its sunken rooms' pits — as loops of their union (null: v1's
//                              voids only, each wholly inside the outline)
//   openingRects / slabHoles   the same holes as rects, clipped to the slab's outline (insideOutline): what the slab, the room
//                              floors, the lints and the twins all read, so a floor is never laid across a stairwell
//   insideOutline(lv, rects)   the parts of rects inside a storey's outline, a wall's half thickness in — a hole on a slab's edge,
//                              or past it, corrupts the slab's triangulation
//   porchPlan(spec, f)         a porch's deck, posts (out of doors, off the steps) and roof — eave, the pitch it really has, its top
//   openingFrames(spec, lv)    every perimeter opening as a frame on its wall: centre, outward normal, width, sill, head
//   splitEdges(lv, edges)      perimeter edges split where two volumes with their own cladding meet (per-rect cladding)
//   rectOfEdge(lv, e)          the footprint rect a perimeter edge bounds
//   doubleRoomsUnder(spec, lv) the double-height rooms on the storeys below that open into lv
//   porchPosts(f)              where a porch's posts stand along its front (before the doors and steps move them)
//
// Owner: S2 (architecture).
import { perimeterEdges, outlineLoops, edgeForOpening } from './house-geometry.js';
import { autoVoidsFor } from './stairs.js';

type R = { x: number; z: number; w: number; d: number };
export const inR = (x: number, z: number, r: R, tol = 0) => x >= r.x - tol && x <= r.x + r.w + tol && z >= r.z - tol && z <= r.z + r.d + tol;
const overlap = (a: R, b: R, m = 0) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > m && Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) > m;
const clipRect = (a: R, b: R): R | null => { const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w), z0 = Math.max(a.z, b.z), z1 = Math.min(a.z + a.d, b.z + b.d); return x1 - x0 > 0.05 && z1 - z0 > 0.05 ? { x: x0, z: z0, w: x1 - x0, d: z1 - z0 } : null; };

/** Rooms whose ceiling is `double` on a storey below `lv` that `lv`'s slab covers: [{ room, lv: its storey, rect }] */
export function doubleRoomsUnder(spec: any, lv: any) {
  const out = [];
  const y = lv.y || 0;
  for (const low of spec.levels || []) {
    if (!((low.y || 0) < y - 0.5)) continue;
    // only the storey directly under: the next storey up from `low` must be `lv`
    const next = (spec.levels || []).filter(l => (l.y || 0) > (low.y || 0) + 0.5).sort((a, b) => (a.y || 0) - (b.y || 0))[0];
    if (next !== lv) continue;
    for (const room of low.rooms || []) {
      if (!room.ceiling || room.ceiling.kind !== 'double' || !room.bounds) continue;
      for (const fr of lv.footprint || []) { const c = clipRect(room.bounds, fr); if (c) out.push({ room, lv: low, rect: c }); }
    }
  }
  return out;
}

/** The union of plan rects as closed loops (each a hole in a slab); rects are unioned on a 5 cm raster */
export function rectLoops(rects: R[]): Array<Array<[number, number]>> {
  if (!rects.length) return [];
  const edges = perimeterEdges(rects, 0.05);
  const { outer, holes } = outlineLoops(edges);
  return [outer, ...holes].filter(l => l && l.length >= 3);
}

// ---- the holes of a slab: what is cut, clipped to the slab, and read alike by the slab, the floors and the lints ------------
/** the parts of a rect outside a set of rects, as rects (each hole splits what is left into up to four) */
export function subtractRects(r: R, holes: R[]): R[] {
  let pieces: R[] = [r];
  for (const h of holes) {
    const next: R[] = [];
    for (const p of pieces) {
      if (!overlap(p, h)) { next.push(p); continue; }
      const x0 = Math.max(p.x, h.x), x1 = Math.min(p.x + p.w, h.x + h.w), z0 = Math.max(p.z, h.z), z1 = Math.min(p.z + p.d, h.z + h.d);
      if (h.x > p.x) next.push({ x: p.x, z: p.z, w: h.x - p.x, d: p.d });
      if (h.x + h.w < p.x + p.w) next.push({ x: h.x + h.w, z: p.z, w: p.x + p.w - h.x - h.w, d: p.d });
      if (h.z > p.z) next.push({ x: x0, z: p.z, w: x1 - x0, d: h.z - p.z });
      if (h.z + h.d < p.z + p.d) next.push({ x: x0, z: h.z + h.d, w: x1 - x0, d: p.z + p.d - h.z - h.d });
    }
    pieces = next.filter(p => p.w > 0.01 && p.d > 0.01);
  }
  return pieces;
}

/**
 * The parts of `rects` that lie inside a storey's outline, `inset` in from it (the wall's inner face): a hole that is not
 * wholly inside the slab's outline corrupts the slab's triangulation (three's earcut fills the hole in, and its
 * neighbours' too), so every hole S2 adds goes through here. A flight built against the wall, whose void reaches the
 * footprint line, keeps a hole that stops at the wall's face; a hole outside the outline is dropped.
 */
export function insideOutline(lv: any, rects: R[], inset = WALL_HALF): R[] {
  const fp = lv.footprint || [];
  if (!fp.length || !rects.length) return [];
  let pieces: R[] = [];
  for (const r of rects) {
    const seen: R[] = [];   // each footprint rect once (rects laid over one another share ground)
    for (const f of fp) { const c = clipRect(r, f); if (c) pieces.push(...subtractRects(c, seen)); seen.push(f); }
  }
  for (const e of perimeterEdges(fp)) {
    const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side], line = horiz ? e.a[1] : e.a[0];
    const lo = horiz ? e.a[0] : e.a[1], hi = horiz ? e.b[0] : e.b[1];
    // the band along the edge, from the line to `inset` inside it
    const inner = line - (horiz ? n[1] : n[0]) * inset, b0 = Math.min(line, inner), b1 = Math.max(line, inner);
    const strip: R = horiz ? { x: lo, z: b0, w: hi - lo, d: b1 - b0 } : { x: b0, z: lo, w: b1 - b0, d: hi - lo };
    pieces = pieces.flatMap(p => subtractRects(p, [strip]));
  }
  return mergeRects(pieces.filter(p => p.w > 0.05 && p.d > 0.05));
}
/** neighbouring rects that share a whole side, joined (so a rect that was cut where two footprint rects meet comes back whole) */
export function mergeRects(rs: R[]): R[] {
  const out = rs.map(r => ({ ...r })), eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < out.length && !again; i++) for (let j = i + 1; j < out.length && !again; j++) {
      const a = out[i], b = out[j];
      if (eq(a.x, b.x) && eq(a.w, b.w) && (eq(a.z + a.d, b.z) || eq(b.z + b.d, a.z))) { a.z = Math.min(a.z, b.z); a.d += b.d; out.splice(j, 1); again = true; }
      else if (eq(a.z, b.z) && eq(a.d, b.d) && (eq(a.x + a.w, b.x) || eq(b.x + b.w, a.x))) { a.x = Math.min(a.x, b.x); a.w += b.w; out.splice(j, 1); again = true; }
    }
  }
  return out;
}

/** The sunken rooms of a storey whose slab is opened over their pits: it stands over another storey (a raised ground floor
 *  has a solid foundation under it), and the pit's floor is above grade */
export const sunkRooms = (spec: any, lv: any) => (lv.rooms || []).filter(r => r.bounds && typeof r.floorOffset === 'number' && r.floorOffset < 0 && (lv.y || 0) + r.floorOffset >= -1e-6
  && (spec.levels || []).some(o => (o.y || 0) < (lv.y || 0) - 0.5 && (o.footprint || []).some(f => inR(r.bounds.x + r.bounds.w / 2, r.bounds.z + r.bounds.d / 2, f, 0))));
/** where a sunken room's pit is: its bounds inside the outline */
export const pitRects = (lv: any, room: any): R[] => insideOutline(lv, [room.bounds]);

/**
 * A storey's slab openings: null when it has none but its own `voids` (v1 builds those as it always did); else the
 * loops of the union of its voids, its flights' autoVoid rects, the double-height rooms below it and its sunken rooms —
 * every one clipped to the slab's outline.
 */
export function slabOpenings(spec: any, lv: any): Array<Array<[number, number]>> | null {
  const rects = openingRects(spec, lv);
  return rects ? rectLoops(rects) : null;
}
/** slabOpenings' rects: null when v1's own voids are all there is, and each lies inside the outline */
export function openingRects(spec: any, lv: any): R[] | null {
  if (!((lv.y || 0) > 0.001)) return null;
  const auto = autoVoidsFor(spec, lv.id), dbl = doubleRoomsUnder(spec, lv).map(d => d.rect), pits = sunkRooms(spec, lv);
  // v1's voids are built as they are — unless one reaches the outline (a hole on the slab's edge, or past it, breaks the slab's
  // triangulation: the stairwell of a stair against the east wall came out solid)
  const v1 = (lv.voids || []).filter(r => r && r.w > 0 && r.d > 0), v1safe = v1.flatMap(v => insideOutline(lv, [v], 0.02));
  const sameRect = (a: R, b: R) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.w - b.w) < 1e-6 && Math.abs(a.d - b.d) < 1e-6;
  const v1same = v1safe.length === v1.length && v1.every((v, k) => sameRect(v1safe[k], v));
  if (!auto.length && !dbl.length && !pits.length && v1same) return null;
  return [...v1safe, ...insideOutline(lv, [...auto, ...dbl].filter(r => r && r.w > 0 && r.d > 0)), ...pits.flatMap(r => pitRects(lv, r))];
}

/** Every hole of a storey's slab, whatever made it — what is built, for anything that tests "is this point over a hole" */
export function slabHoles(spec: any, lv: any): R[] {
  if (!((lv.y || 0) > 0.001)) return [];   // a ground slab is laid per rect, whole
  return openingRects(spec, lv) || (lv.voids || []).filter(r => r && r.w > 0 && r.d > 0);
}
/** (the raw list, before it is clipped: the validator's) */
export function allVoids(spec: any, lv: any): R[] {
  return [...(lv.voids || []), ...autoVoidsFor(spec, lv.id), ...doubleRoomsUnder(spec, lv).map(d => d.rect)];
}

// ---- openings as frames on their walls ------------------------------------------------------------------------------
export const OUT = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] } as const;
export const WALL_HALF = 0.08;   // createParametricWall's 0.16 m walls, centred on the footprint edge
export type OpeningFrame = {
  op: any; index: number; side: 'S' | 'N' | 'E' | 'W';
  /** plan centre on the wall's outer face, and along-wall unit (+x for S/N, +z for E/W) */
  cx: number; cz: number; along: [number, number]; out: [number, number];
  /** the edge line (z for S/N, x for E/W) */
  line: number;
  w: number; sill: number; h: number; top: number; kind: 'window' | 'door' | 'glass' | 'slider' | 'garage';
  edge: any;
};

/** The perimeter edge an opening sits on: `edgeZ` picks between two same-side edges that both contain `at` */
export function edgeFor(edges: any[], op: any) {
  if (op.edgeZ === undefined) return edgeForOpening(edges, op.side, op.at);
  const horiz = op.side === 'S' || op.side === 'N';
  return edges.find(e => e.side === op.side && Math.abs((horiz ? e.a[1] : e.a[0]) - op.edgeZ) < 0.02 && (horiz ? op.at >= e.a[0] - 1e-6 && op.at <= e.b[0] + 1e-6 : op.at >= e.a[1] - 1e-6 && op.at <= e.b[1] + 1e-6)) || edgeForOpening(edges, op.side, op.at);
}

/** The openings S2's features cut in a storey's walls: a bay opens its host wall (a cased opening, no leaf) */
export function featureOpenings(spec: any, lv: any) {
  if (!spec || !Array.isArray(spec.features)) return [];
  const H = lv.height || 2.8;
  return spec.features.filter(f => f && f.type === 'bay' && f.w > 0.8 && (f.level ? f.level === lv.id : (spec.levels || [])[0] === lv))
    .map(f => ({ side: f.side, at: f.at, type: 'door', w: Math.max(1.12, f.w - (f.form === 'canted' ? 0.2 : 0.3)), h: Math.min((f.h ?? H - 0.3) - 0.12, H - 0.15), style: 'cased', open: true, _feature: 'bay' }));
}

/** Every perimeter opening of a storey as a frame (heights over the storey's floor, the defaults kit-build.ts applies);
 *  with `spec`, the openings its features cut too */
export function openingFrames(lv: any, edges = perimeterEdges(lv.footprint || []), spec: any = null): OpeningFrame[] {
  const H = lv.height || 2.8, out: OpeningFrame[] = [];
  [...(lv.openings || []), ...featureOpenings(spec, lv)].forEach((op, index) => {
    const e = edgeFor(edges, op); if (!e) return;
    const horiz = op.side === 'S' || op.side === 'N', line = horiz ? e.a[1] : e.a[0];
    const n = OUT[op.side], along: [number, number] = horiz ? [1, 0] : [0, 1];
    let sill = 0, h = 2.1;
    if (op.type === 'window') { sill = op.sill ?? 0.9; h = op.h || 1.2; }
    else if (op.type === 'glass') { sill = 0.05; h = Math.min(op.h || H - 0.1, H - 0.1); }
    else if (op.type === 'slider' || op.type === 'garage') h = op.h || 2.2;
    else h = op.h || 2.1;
    const cx = horiz ? op.at : line + n[0] * WALL_HALF, cz = horiz ? line + n[1] * WALL_HALF : op.at;
    out.push({ op, index, side: op.side, cx, cz, along, out: [n[0], n[1]], line, w: op.w, sill, h, top: sill + h, kind: op.type, edge: e });
  });
  return out;
}

// ---- per-volume cladding: split perimeter edges where two volumes meet --------------------------------------------------
/** the footprint rect a perimeter edge bounds (the rect just inside its midpoint) */
export function rectOfEdge(lv: any, e: any, at?: number) {
  const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side];
  const m = at ?? (horiz ? (e.a[0] + e.b[0]) / 2 : (e.a[1] + e.b[1]) / 2);
  const px = horiz ? m : e.a[0] - n[0] * 0.05, pz = horiz ? e.a[1] - n[1] * 0.05 : m;
  // the LAST rect listed that contains it: a later rect is the volume laid over an earlier one
  const rs = (lv.footprint || []).filter(r => inR(px, pz, r, -1e-6));
  return rs.length ? rs[rs.length - 1] : null;
}
const volumeKey = (r: any) => r ? `${r.material || ''}|${r.color || ''}|${r.h ?? ''}` : '';
/** Does any rect of this storey carry its own cladding or height (per-volume walls)? */
export const hasVolumes = (lv: any) => (lv.footprint || []).some(r => r.material !== undefined || r.color !== undefined || r.h !== undefined);
/**
 * Perimeter edges split wherever the volume behind them changes (a rect with its own material, colour or height). An
 * opening that straddles a split stays on the piece that holds its centre (the validator warns).
 */
export function splitEdges(lv: any, edges: any[]) {
  if (!hasVolumes(lv)) return edges;
  const out = [];
  for (const e of edges) {
    const horiz = e.side === 'S' || e.side === 'N', lo = horiz ? e.a[0] : e.a[1], hi = horiz ? e.b[0] : e.b[1];
    const cuts = new Set<number>();
    for (const r of lv.footprint) for (const c of horiz ? [r.x, r.x + r.w] : [r.z, r.z + r.d]) if (c > lo + 0.05 && c < hi - 0.05) cuts.add(Math.round(c * 1000) / 1000);
    const pts = [lo, ...[...cuts].sort((a, b) => a - b), hi];
    // merge neighbouring pieces that bound the same volume
    const pieces: Array<[number, number]> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], key = volumeKey(rectOfEdge(lv, e, (a + b) / 2));
      const last = pieces[pieces.length - 1];
      if (last && volumeKey(rectOfEdge(lv, e, (last[0] + last[1]) / 2)) === key) last[1] = b; else pieces.push([a, b]);
    }
    if (pieces.length === 1) { out.push(e); continue; }
    for (const [a, b] of pieces) out.push({ ...e, a: horiz ? [a, e.a[1]] : [e.a[0], a], b: horiz ? [b, e.a[1]] : [e.a[0], b], length: Math.round((b - a) * 1000) / 1000, split: true });
  }
  return out;
}

// ---- split levels: walls two storeys share ------------------------------------------------------------------------------------
/** Is this storey in a split-level pair (it, or a storey beside it, says `split: true`)? */
export const splitOn = (spec: any, lv: any) => !!lv.split || (spec.levels || []).some(l => l !== lv && l.split);
const sideNeighbour = (B: any, e: any, at: number) => {
  // B stands just outside this edge (its footprint holds the point 5 cm out) but not inside it (it is beside the
  // storey, not above or below it in plan)
  const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side], line = horiz ? e.a[1] : e.a[0];
  const o = horiz ? [at, line + n[1] * 0.05] : [line + n[0] * 0.05, at], i = horiz ? [at, line - n[1] * 0.05] : [line - n[0] * 0.05, at];
  const fp = B.footprint || [];
  return fp.some(r => inR(o[0], o[1], r, -1e-6)) && !fp.some(r => inR(i[0], i[1], r, -1e-6));
};
/**
 * The perimeter edges a storey builds walls on: split where its volumes change (per-rect cladding and heights) and, in a
 * split-level house, where the storeys beside it begin and end — so every piece has one volume behind it and one set of
 * neighbours in front. Unchanged (the same array) for a storey that needs neither.
 */
export function archEdges(spec: any, lv: any, edges: any[]) {
  const vol = hasVolumes(lv), split = splitOn(spec, lv);
  if (!vol && !split) return edges;
  const others = split ? (spec.levels || []).filter(l => l !== lv && (lv.split || l.split)) : [];
  const out = [];
  for (const e of vol ? splitEdges(lv, edges) : edges) {
    if (!others.length) { out.push(e); continue; }
    const horiz = e.side === 'S' || e.side === 'N', lo = horiz ? e.a[0] : e.a[1], hi = horiz ? e.b[0] : e.b[1];
    const cuts = new Set<number>();
    for (const B of others) for (const r of B.footprint || []) for (const c of horiz ? [r.x, r.x + r.w] : [r.z, r.z + r.d]) if (c > lo + 0.05 && c < hi - 0.05) cuts.add(Math.round(c * 1000) / 1000);
    if (!cuts.size) { out.push(e); continue; }
    const pts = [lo, ...[...cuts].sort((a, b) => a - b), hi];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({ ...e, a: horiz ? [a, e.a[1]] : [e.a[0], a], b: horiz ? [b, e.a[1]] : [e.a[0], b], length: Math.round((b - a) * 1000) / 1000, split: true });
    }
  }
  return out;
}
/** A perimeter wall's height: its volume's own `h`, else the storey's knee wall, else the storey's height */
export const edgeHeight = (lv: any, rect: any, H: number) => (rect && rect.h !== undefined ? rect.h : lv.knee !== undefined ? lv.knee : H);
export type WallPiece = { lo: number; hi: number; party: boolean };
/**
 * The bands of one perimeter wall a storey builds, heights over its own floor: [{ lo: 0, hi: H, party: false }] unless it
 * is in a split-level pair. There a storey listed earlier that stands beside the edge builds the shared wall over its own
 * height, this storey only the rest; and a band with another storey's rooms beyond it is `party` (paint on both faces,
 * no cladding, no exterior trim).
 */
export function wallPieces(spec: any, lv: any, e: any, Hwall: number): WallPiece[] {
  if (!splitOn(spec, lv)) return [{ lo: 0, hi: Hwall, party: false }];
  const levels = spec.levels || [], idx = levels.indexOf(lv), y = lv.y || 0;
  const horiz = e.side === 'S' || e.side === 'N', mid = horiz ? (e.a[0] + e.b[0]) / 2 : (e.a[1] + e.b[1]) / 2;
  const covered: Array<[number, number]> = [], beyond: Array<[number, number]> = [];
  levels.forEach((B, j) => {
    if (B === lv || !(lv.split || B.split) || !sideNeighbour(B, e, mid)) return;
    const iv: [number, number] = [(B.y || 0) - y, (B.y || 0) + (B.height || 2.8) - y];
    beyond.push(iv);
    if (j < idx) covered.push([iv[0], (B.y || 0) + edgeHeight(B, rectOfEdgeOther(B, e, mid), B.height || 2.8) - y]);
  });
  // [0, Hwall] less what an earlier storey builds
  let bands: Array<[number, number]> = [[0, Hwall]];
  for (const [c0, c1] of covered) bands = bands.flatMap(([a, b]) => c1 <= a || c0 >= b ? [[a, b]] as Array<[number, number]> : [...(c0 > a ? [[a, c0]] : []), ...(c1 < b ? [[c1, b]] : [])] as Array<[number, number]>);
  // cut at every storey beyond it, and mark what faces rooms
  const out: WallPiece[] = [];
  for (const [a, b] of bands) {
    const cuts = [a, ...beyond.flatMap(iv => iv).filter(c => c > a + 1e-6 && c < b - 1e-6), b].sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const lo = cuts[i], hi = cuts[i + 1], m = (lo + hi) / 2;
      if (hi - lo < 1e-3) continue;
      out.push({ lo, hi, party: beyond.some(([p, q]) => m > p && m < q) });
    }
  }
  // a sliver under 0.25 m joins the band beside it (a slab's depth between two storeys)
  for (let i = 0; i < out.length; i++) if (out[i].hi - out[i].lo < 0.25 && out.length > 1) {
    const j = i > 0 ? i - 1 : i + 1;
    if (Math.abs(out[j].hi - out[i].lo) < 1e-6 || Math.abs(out[j].lo - out[i].hi) < 1e-6) { out[j] = { lo: Math.min(out[j].lo, out[i].lo), hi: Math.max(out[j].hi, out[i].hi), party: out[j].party }; out.splice(i, 1); i--; }
  }
  return out;
}
function rectOfEdgeOther(B: any, e: any, at: number) {
  const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side], line = horiz ? e.a[1] : e.a[0];
  const px = horiz ? at : line + n[0] * 0.05, pz = horiz ? line + n[1] * 0.05 : at;
  const rs = (B.footprint || []).filter(r => inR(px, pz, r, -1e-6));
  return rs.length ? rs[rs.length - 1] : null;
}

/**
 * Per-rect heights: wherever a volume stands taller than the volume beside it (a tower over a wing, a tower rect laid over
 * a lower one), the wall between them above the lower one is outside wall. The volume at a point is the LAST rect listed
 * that holds it (as rectOfEdge reads it). [{ side (the wall's outward face: toward the lower volume), a, b, length, lo, hi,
 * rect (the taller) }] — heights over the storey's floor, in 0.1 m-sampled runs merged along each side.
 */
export function volumeSteps(lv: any, H: number) {
  const fp = lv.footprint || [];
  if (!fp.some(r => r.h !== undefined)) return [];
  const hOf = r => (r.h !== undefined ? r.h : lv.knee !== undefined ? lv.knee : H);
  const volAt = (x: number, z: number) => { for (let i = fp.length - 1; i >= 0; i--) if (inR(x, z, fp[i], -1e-6)) return fp[i]; return null; };
  const out = [];
  for (const A of fp) {
    for (const side of ['N', 'S', 'E', 'W'] as const) {
      const horiz = side === 'S' || side === 'N', n = OUT[side];
      const line = side === 'N' ? A.z : side === 'S' ? A.z + A.d : side === 'W' ? A.x : A.x + A.w;
      const lo0 = horiz ? A.x : A.z, hi0 = horiz ? A.x + A.w : A.z + A.d;
      let run = null;
      const flush = () => { if (run && run.b - run.a > 0.09) out.push({ side, a: horiz ? [run.a, line] : [line, run.a], b: horiz ? [run.b, line] : [line, run.b], length: run.b - run.a, lo: run.lo, hi: run.hi, rect: A }); run = null; };
      for (let u = lo0 + 0.05; u < hi0; u += 0.1) {
        const inside = horiz ? volAt(u, line - n[1] * 0.02) : volAt(line - n[0] * 0.02, u);
        const beyond = horiz ? volAt(u, line + n[1] * 0.02) : volAt(line + n[0] * 0.02, u);
        const ok = inside === A && beyond && hOf(beyond) < hOf(A) - 0.05;
        if (!ok) { flush(); continue; }
        const lo = hOf(beyond), hi = hOf(A), a0 = Math.max(lo0, u - 0.05), b0 = Math.min(hi0, u + 0.05);
        if (run && Math.abs(run.lo - lo) < 1e-6 && Math.abs(run.hi - hi) < 1e-6) run.b = b0; else { flush(); run = { a: a0, b: b0, lo, hi }; }
      }
      flush();
    }
  }
  return out.map(st => ({ ...st, a: st.a.map(v => Math.round(v * 1000) / 1000), b: st.b.map(v => Math.round(v * 1000) / 1000), length: Math.round(st.length * 1000) / 1000 }));
}

// ---- porches -----------------------------------------------------------------------------------------------------------------
/** the storey a feature belongs to */
export const featureLevel = (spec: any, f: any) => (spec.levels || []).find(l => l.id === (f.level || (spec.entry || {}).level)) || (spec.levels || [])[0];

/** A feature's plan rect off a wall: the edge on `side` holding [from, to] (or `at` ± w/2), `depth` out of its face.
 *  `inner`: from the wall's centre line (a roof's plan), else from its outer face (a deck's). */
export function offWallRect(lv: any, side: string, a0: number, a1: number, depth: number, inner = false) {
  const edges = perimeterEdges(lv.footprint || []);
  const e = edgeFor(edges, { side, at: (a0 + a1) / 2 });
  if (!e) return null;
  const horiz = side === 'S' || side === 'N', line = horiz ? e.a[1] : e.a[0], n = OUT[side], s0 = inner ? 0 : WALL_HALF;
  const b0 = line + (horiz ? n[1] : n[0]) * s0, b1 = line + (horiz ? n[1] : n[0]) * (WALL_HALF + depth);
  const lo = Math.min(b0, b1), hi = Math.max(b0, b1);
  return { rect: horiz ? { x: a0, z: lo, w: a1 - a0, d: hi - lo } : { x: lo, z: a0, w: hi - lo, d: a1 - a0 }, line, edge: e, horiz };
}

/** Where a porch's posts stand along its front (x for S/N, z for E/W): evenly, `posts.n` of them or every
 *  `posts.spacing` (2.4 m), 0.12 m in from each end */
export function porchPosts(f: any): number[] {
  const len = f.to - f.from, p = f.posts || {};
  const n = p.n ? Math.max(2, p.n) : Math.max(2, Math.round(len / (p.spacing || 2.4)) + 1);
  return Array.from({ length: n }, (_, i) => Math.round((f.from + 0.12 + (len - 0.24) * i / (n - 1)) * 1000) / 1000);
}

const DEG = Math.PI / 180;
/**
 * Everything a porch's builder and the validator both need, THREE-free: its deck, where its posts stand (out of every
 * doorway and off the steps), and its roof — the eave, the pitch the roof really has, the height it reaches. The roof
 * leans on the wall just under the eave (0.25 m under a single storey's head; a two-storey house's: 0.25 m over it, on the wall above), falls
 * to the posts, and keeps 2.3 m over the deck at its eave where it can: a shallower pitch (5° at least) buys that
 * clearance, and a gable roof's ridge is held to the height a shed would lean on the wall at. `asked` is the pitch the
 * spec wanted, `pitch` the one it got.
 */
export function porchPlan(spec: any, f: any) {
  const lv = featureLevel(spec, f);
  if (!lv || !(typeof f.from === 'number' && typeof f.to === 'number' && f.depth > 0)) return null;
  const y = lv.y || 0, H = lv.height || 2.8;
  const a0 = Math.min(f.from, f.to), a1 = Math.max(f.from, f.to), depth = f.depth;
  const ow = offWallRect(lv, f.side, a0, a1, depth);
  if (!ow) return null;
  const horiz = ow.horiz, nn = horiz ? OUT[f.side][1] : OUT[f.side][0], line = ow.line;
  const floorY = f.floorY ?? (y > 0.15 ? y : 0.12);
  // the doors on this wall, and the steps
  const doors = openingFrames(lv).filter(fr => fr.side === f.side && fr.kind !== 'window' && fr.kind !== 'glass' && Math.abs(fr.line - line) < 0.05).map(fr => [fr.op.at - fr.w / 2, fr.op.at + fr.w / 2]);
  const entryHere = !!(spec.entry && spec.entry.level === lv.id && spec.entry.side === f.side && spec.entry.at > a0 && spec.entry.at < a1);
  const stepsOn = f.steps !== false && floorY > 0.08;
  const st = typeof f.steps === 'object' && f.steps ? f.steps : {};
  const stepAt = st.at ?? (entryHere ? spec.entry.at : (a0 + a1) / 2), stepW = st.w ?? 1.5;
  // posts: evenly along the front, then out of every doorway and off the steps
  const size = (f.posts && f.posts.size) || (f.posts && f.posts.style === 'steel' ? 0.09 : 0.16);
  const keepOut = [...doors.map(([p, q]) => [p - 0.15 - size / 2, q + 0.15 + size / 2]), ...(stepsOn ? [[stepAt - stepW / 2 - size / 2 - 0.05, stepAt + stepW / 2 + size / 2 + 0.05]] : [])];
  const asked = porchPosts(f);
  const posts = asked.map(p => {
    const k = keepOut.find(([p0, p1]) => p > p0 && p < p1);
    if (!k) return p;
    const to = p - k[0] < k[1] - p ? k[0] : k[1];
    return Math.min(a1 - 0.12, Math.max(a0 + 0.12, to));
  }).filter((p, j, arr) => arr.findIndex(q => Math.abs(q - p) < 0.2) === j && !keepOut.some(([p0, p1]) => p > p0 + 0.01 && p < p1 - 0.01));
  // the roof: its eave on the posts, rising to the wall
  const roofType: string = f.roof ?? 'shed';
  const two = (spec.levels || []).some(o => (o.y || 0) > y + H - 0.2 && (o.footprint || []).some(r => inR(horiz ? (a0 + a1) / 2 : line - nn * 0.3, horiz ? line - nn * 0.3 : (a0 + a1) / 2, r, 0)));
  const yHigh = two ? y + H + 0.25 : y + H - 0.25;
  const dflt = ({ shed: 12, hip: 22, gable: 32, flat: 0 } as Record<string, number>)[roofType] ?? 12;
  const asked_pitch: number = f.pitch ?? dflt;
  let pitch = asked_pitch;
  const span = roofType === 'gable' ? (a1 - a0) / 2 : depth;
  let eave = roofType === 'flat' ? yHigh - 0.15 : yHigh - span * Math.tan(pitch * DEG);
  if (roofType !== 'flat' && roofType !== 'gable' && eave < floorY + 2.3) { pitch = Math.max(5, Math.atan2(yHigh - floorY - 2.3, span) / DEG); eave = yHigh - span * Math.tan(pitch * DEG); }
  if (roofType === 'gable') {
    eave = Math.max(floorY + 2.3, eave);
    // a wide porch's ridge would climb past the wall it leans on: lower the pitch until it tops out where a shed's high edge is
    if (eave + span * Math.tan(pitch * DEG) > yHigh + 0.02) pitch = Math.max(5, Math.atan2(yHigh - eave, span) / DEG);
  }
  const beamH = two ? 0.22 : 0.18, postTop = roofType === 'none' ? floorY + 2.4 : eave - beamH;
  // the highest the roof (deck and its fascia) stands over the wall it leans on
  const top = roofType === 'none' ? floorY + 2.4 : roofType === 'flat' ? eave + 0.3 : roofType === 'gable' ? eave + span * Math.tan(pitch * DEG) + 0.15 : yHigh + 0.15;
  return { lv, y, H, a0, a1, depth, horiz, nn, line, ow, floorY, roofType, two, yHigh, asked: asked_pitch, pitch, span, eave, beamH, postTop, top, clear: +(postTop - floorY).toFixed(3),
    posts, postsAsked: asked, size, doors, stepsOn, stepAt, stepW, entryHere };
}
