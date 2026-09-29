// Architecture plan geometry — THREE-free, shared by the builders (structure-build, facade, features, room-finish),
// the validator (scripts/validate/arch.mts), the plan export (plan-export/arch.ts) and the Node harnesses.
//
//   slabOpenings(spec, lv)     the holes a storey's slab has: its voids, the voids its flights' autoVoid asks for, and
//                              the double-height rooms under it — as loops of their union (null: v1's voids only)
//   openingFrames(spec, lv)    every perimeter opening as a frame on its wall: centre, outward normal, width, sill, head
//   splitEdges(lv, edges)      perimeter edges split where two volumes with their own cladding meet (per-rect cladding)
//   rectOfEdge(lv, e)          the footprint rect a perimeter edge bounds
//   doubleRoomsUnder(spec, lv) the double-height rooms on the storeys below that open into lv
//   porchPosts(f)              where a porch's posts stand along its front
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

/**
 * A storey's slab openings: null when it has none but its own `voids` (v1 builds those as it always did); else the
 * loops of the union of its voids, its flights' autoVoid rects and the double-height rooms below it.
 */
export function slabOpenings(spec: any, lv: any): Array<Array<[number, number]>> | null {
  const auto = autoVoidsFor(spec, lv.id), dbl = doubleRoomsUnder(spec, lv).map(d => d.rect);
  if (!auto.length && !dbl.length) return null;
  const rects = [...(lv.voids || []), ...auto, ...dbl].filter(r => r && r.w > 0 && r.d > 0);
  return rectLoops(rects);
}

/** Every void of a storey, whatever made it (for anything that tests "is this point over a hole") */
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
/** Where a porch's posts stand along its front (x for S/N, z for E/W): evenly, `posts.n` of them or every
 *  `posts.spacing` (2.4 m), 0.12 m in from each end */
export function porchPosts(f: any): number[] {
  const len = f.to - f.from, p = f.posts || {};
  const n = p.n ? Math.max(2, p.n) : Math.max(2, Math.round(len / (p.spacing || 2.4)) + 1);
  return Array.from({ length: n }, (_, i) => Math.round((f.from + 0.12 + (len - 0.24) * i / (n - 1)) * 1000) / 1000);
}
