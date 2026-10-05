// The dress phase's host registry (plan 5.6 D1): what a small good may stand ON. A HOST is a catalog type with a top the dress phase has measured:
// the height of its surface, and the part of it that is flat and clear at that height (its RECTS, in the item's own frame). A small good is packed
// into those rects and nowhere else, so its footprint fitting its host is the contract, not a hope (SMALL's skeptic saw a dresser tray overhang its
// dresser by 10 cm in a hand-placed pair): scripts/test-dress-hosts.mts builds every host in the page, samples every rect at 2 cm and fails unless the
// geometry there is within 1 cm of the declared top (nothing higher, nothing lower), at the default size and at 0.75 and 1.35 times each sizing param.
//
// THREE-free. A rect is [x0, z0, x1, z1] in the host's frame (its origin, +z its front, like every catalog item), metres. Rects come from the measured
// box (sizeOf), so they follow the item's `w` and `d`.
//
//   HOSTS      type -> HostDef, the sound hosts only
//   DROPPED    type -> why it is NOT a host: a type the phase will not dress, with the reason the test re-checks (never guessed in)
//   hostOf(item)        the host an item is, in world terms (origin, rot, top, rects), or null
//   hostRects(host)     its rects as world-aligned obbs
//   freeRects(host, on, margin, gap)   the host's rects minus the footprints of what already stands on it (grown by `gap`, at least NEIGHBOUR_GAP), minus `margin` all round
//   neighbourGap(host, item, on)       the smallest gap between an item's footprint and the others on the host (negative: they overlap); MIN_GAP is what the lint demands
//   fitIn(free, w, d, anchor)     where a w x d box fits in the free rects (host frame), or null
//
// A host with a body of its own on top that the page seeds (a console's bowl, a sideboard's vases, a nightstand's decor: `rng() * (w - 0.5)`, from a stream
// keyed on the house-wide prop index) cannot be dressed from Node, which does not know where it stands: those are DROPPED, and the phase says so.
//
// Owner: DRESS.
import { PLACEMENT } from './props/placement.js';
import { PROPS } from './props/index.js';
import { sizeOf, itemObb, obb, turn, mm, overlap, rectObb, type Size, type Obb } from './room-geo.js';

export type Rect = [number, number, number, number];
export type HostKind = 'vanity' | 'coffee-table' | 'side-table' | 'nightstand' | 'dresser' | 'desk' | 'counter' | 'island' | 'hob' | 'dining-table' | 'console' | 'tank' | 'appliance-top';
export interface HostDef {
  kind: HostKind;
  /** the height of the flat top above the host's own floor, metres (the measured one: PLACEMENT.top where it is right, else what the page builds) */
  top: number;
  /** the flat, clear part of the top in the host's frame, from its measured box and its own params */
  rects: (s: Size, it: any) => Rect[];
  /** the item's `w` / `d` params change its rects (the test sweeps them) */
  sized?: Array<'w' | 'd'>;
  /** the clear margin kept round a good on this host, metres (default 0.03): a round top's rect is the inscribed square, already inside it, so it takes none; a tank is a ledge */
  margin?: number;
}

const box = (s: Size): Rect => [s.ox - s.w / 2, s.oz - s.d / 2, s.ox + s.w / 2, s.oz + s.d / 2];
/** the box with an inset on each side: left (-x), back (-z), right (+x), front (+z) */
const inset = (s: Size, l: number, b: number, r: number, f: number): Rect => { const [x0, z0, x1, z1] = box(s); return [x0 + l, z0 + b, x1 - r, z1 - f]; };
/** a round top: the inscribed square of the box's circle (0.7 of its diameter), centred on it */
const round = (s: Size): Rect => { const h = (Math.min(s.w, s.d) / 2) * Math.SQRT1_2; return [s.ox - h, s.oz - h, s.ox + h, s.oz + h]; };
/** the box minus a hole across its whole depth, centred on the box's middle: the two sides */
const sides = (s: Size, hole: number, ins = 0): Rect[] => { const [x0, z0, x1, z1] = box(s), c = s.ox; return [[x0, z0 + ins, c - hole, z1 - ins], [c + hole, z0 + ins, x1, z1 - ins]]; };

export const HOSTS: Record<string, HostDef> = {
  // ---- coffee tables
  'coffee-table': { kind: 'coffee-table', top: 0.40, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w', 'd'] },
  'round-coffee-table': { kind: 'coffee-table', top: 0.42, rects: s => [round(s)], sized: ['w'], margin: 0 },
  'trunk-coffee-table': { kind: 'coffee-table', top: 0.46, rects: s => [inset(s, 0.03, 0.03, 0.03, 0.03)], sized: ['w', 'd'] },
  // ---- side tables and nightstands
  'side-table': { kind: 'side-table', top: 0.55, rects: s => [inset(s, 0, 0, 0, 0)] },
  'nesting-tables': { kind: 'side-table', top: 0.50, rects: s => [inset(s, 0, 0, 0, 0.2)] },
  'c-table': { kind: 'side-table', top: 0.60, rects: s => [[s.ox - s.w / 2 + 0.03, s.oz - 0.17, s.ox + s.w / 2 - 0.03, s.oz + 0.17]] },
  'drum-table': { kind: 'side-table', top: 0.52, rects: s => [round(s)], margin: 0 },
  'bedside-table': { kind: 'nightstand', top: 0.56, rects: s => [inset(s, 0, 0, 0, 0)] },
  'bedside-cabinet': { kind: 'nightstand', top: 0.60, rects: s => [inset(s, 0.03, 0.03, 0.03, 0.03)] },
  'drum-nightstand': { kind: 'nightstand', top: 0.56, rects: s => [round(s)], margin: 0 },
  // ---- dressers and desks
  'dresser': { kind: 'dresser', top: 0.85, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w'] },
  'lowboy-dresser': { kind: 'dresser', top: 0.72, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w'] },
  'chest-of-drawers': { kind: 'dresser', top: 1.15, rects: s => [inset(s, 0, 0, 0, 0.03)] },
  'writing-desk': { kind: 'desk', top: 0.75, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w'] },
  // ---- the kitchen
  'counter-run': { kind: 'counter', top: 0.90, rects: s => [inset(s, 0.02, 0.02, 0.02, 0.05)], sized: ['w'] },
  'sink-run': { kind: 'counter', top: 0.90, rects: s => sides(s, 0.33, 0.03).map(r => [r[0] + (r[0] < s.ox ? 0.02 : 0), r[1], r[2] - (r[2] > s.ox ? 0.02 : 0), r[3] - 0.02] as Rect), sized: ['w'] },
  'breakfast-bar': { kind: 'counter', top: 0.90, rects: s => [inset(s, 0.04, 0.04, 0.04, 0.04)], sized: ['w'] },
  'dishwasher': { kind: 'counter', top: 0.90, rects: s => [inset(s, 0.02, 0.02, 0.02, 0.1)] },
  'kitchen-cart': { kind: 'counter', top: 0.90, rects: s => [[s.ox - s.w / 2 + 0.09, s.oz - 0.2, s.ox + s.w / 2 - 0.1, s.oz + 0.2]] },
  'kitchen-island': { kind: 'island', top: 0.945, rects: s => { const [x0, z0, x1] = box(s), z1 = z0 + 0.86; return [[x0 + 0.04, z0 + 0.04, s.ox + 0.34, z1], [s.ox + 0.52, z0 + 0.04, x1 - 0.04, z1]]; }, sized: ['w'] },
  'range': { kind: 'hob', top: 0.918, rects: s => [inset(s, 0.02, 0.02, 0.02, 0.1)] },
  // ---- dining tables
  'glass-dining-table': { kind: 'dining-table', top: 0.75, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w', 'd'] },
  'trestle-table': { kind: 'dining-table', top: 0.76, rects: s => [inset(s, 0, 0, 0, 0)], sized: ['w', 'd'] },
  'farmhouse-table': { kind: 'dining-table', top: 0.76, rects: s => [inset(s, 0.03, 0.03, 0.03, 0.03)], sized: ['w', 'd'] },
  'oval-dining-table': { kind: 'dining-table', top: 0.75, rects: s => [inset(s, 0.42, 0.17, 0.42, 0.17)], sized: ['w', 'd'] },
  'round-dining-table': { kind: 'dining-table', top: 0.75, rects: s => [round(s)], margin: 0 },
  'pedestal-dining-table': { kind: 'dining-table', top: 0.76, rects: s => [round(s)], margin: 0 },
  // ---- the strip of counter between a double vanity's two vessel basins (0.34 m clear: the vanity set is 0.30)
  'double-vanity': { kind: 'vanity', top: 0.89, rects: s => [[s.ox - 0.16, s.oz - 0.23, s.ox + 0.16, s.oz + 0.23]], margin: 0 },
  // ---- a console, a tank, the top of a machine
  'demilune-console': { kind: 'console', top: 0.82, rects: s => [inset(s, 0.13, 0.02, 0.13, 0.14)] },
  'toilet': { kind: 'tank', top: 0.805, rects: s => [[s.ox - 0.185, s.oz - s.d / 2, s.ox + 0.185, s.oz - s.d / 2 + 0.19]], margin: 0.012 },
  'dryer': { kind: 'appliance-top', top: 0.85, rects: s => [inset(s, 0.02, 0.02, 0.02, 0.1)] },
  'washing-machine': { kind: 'appliance-top', top: 0.85, rects: s => [inset(s, 0.02, 0.02, 0.02, 0.1)] },
};

/** types that look like hosts and are not, and why (scripts/test-dress-hosts.mts re-reads these against the page: a reason that stops being true is a host to take back) */
export const DROPPED: Record<string, string> = {
  'console-table': 'a bowl of its own, 0.11 m in radius, standing at a seeded spot across the middle span: the dress phase cannot know where',
  'sideboard': 'two bodies of its own (vases) at seeded spots on its top, and a top 0.15 m under its box',
  'media-credenza': 'a body of its own on a top that is not flat (0.67, 0.65, 0.61)',
  'nightstand': 'a body of its own at a seeded spot (a lamp stand or a candle) on a 0.4 m top',
  'chest': 'a lid with a raised centre panel: 0.50 m round the edge, 0.56 m in the middle',
  'octagonal-table': 'a body of its own at the centre',
  'vanity-sink': 'a vessel basin and a tap across the whole counter: 0.05 m2 of flat top',
  'pedestal-sink': 'the basin is the top',
  'bathtub': 'no rim to stand a tray on: the shell is flat at the water line',
  'clawfoot-tub': 'a rolled rim, 0.04 m of flat',
  'soaking-tub': 'a rolled rim, 0.04 m of flat',
  'tv-stand': 'a screen on its top',
  'ottoman': 'a cushion, not a surface',
};

export interface Host { margin: number; item: any; type: string; kind: HostKind; at: [number, number]; rot: number; top: number; rects: Rect[]; size: Size }

/** the host an item is, or null (not a host type, no origin, no size) */
export function hostOf(it: any): Host | null {
  const def = HOSTS[it && it.type];
  if (!def || !Array.isArray(it.at)) return null;
  const s = sizeOf(it.type, it); if (!s) return null;
  return { margin: def.margin ?? 0.03, item: it, type: it.type, kind: def.kind, at: [it.at[0], it.at[1]], rot: it.rot || 0, top: it.y !== undefined && PLACEMENT[it.type]?.onSurface ? it.y : def.top, rects: def.rects(s, it), size: s };
}

/** a rect in the host's frame as a world obb */
export function hostRectObb(h: Host, r: Rect): Obb {
  const [lx, lz] = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], [dx, dz] = turn(lx, lz, h.rot);
  return obb(h.at[0] + dx, h.at[1] + dz, r[2] - r[0], r[3] - r[1], h.rot);
}
export const hostRects = (h: Host): Obb[] => h.rects.map(r => hostRectObb(h, r));

/** a world point in the host's frame */
export const toLocal = (h: Host, x: number, z: number): [number, number] => turn(x - h.at[0], z - h.at[1], -h.rot);
export const toWorld = (h: Host, lx: number, lz: number): [number, number] => { const [dx, dz] = turn(lx, lz, h.rot); return [mm(h.at[0] + dx), mm(h.at[1] + dz)]; };

/** an item's footprint as a host-frame rect (the axis-aligned cover of its obb in the host's frame): what it takes from the host's free area */
export function footprintIn(h: Host, it: any): Rect | null {
  const o = itemObb(it); if (!o) return null;
  const hw = o.hw, hd = o.hd, c = toLocal(h, o.cx, o.cz), rel = (o.rot - h.rot) * Math.PI / 180, cs = Math.abs(Math.cos(rel)), sn = Math.abs(Math.sin(rel));
  const ex = hw * cs + hd * sn, ez = hw * sn + hd * cs;
  return [c[0] - ex, c[1] - ez, c[0] + ex, c[1] + ez];
}

const area = (r: Rect) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
/**
 * A rect minus another, as the MAXIMAL rects of what is left (up to four, overlapping at the corners): the strips left of, right of, behind and in front of the
 * hole, each as wide or deep as the original. Any box that fits in the remainder fits in one of them whole, which a disjoint cut into strips would not say.
 */
export function subtract(r: Rect, h: Rect): Rect[] {
  if (h[2] <= r[0] || h[0] >= r[2] || h[3] <= r[1] || h[1] >= r[3]) return [r];
  const out: Rect[] = [];
  if (h[0] > r[0]) out.push([r[0], r[1], h[0], r[3]]);
  if (h[2] < r[2]) out.push([h[2], r[1], r[2], r[3]]);
  if (h[1] > r[1]) out.push([r[0], r[1], r[2], h[1]]);
  if (h[3] < r[3]) out.push([r[0], h[3], r[2], r[3]]);
  return out.filter(q => area(q) > 1e-6);
}
/** drop the rects another contains */
const prune = (rs: Rect[]): Rect[] => rs.filter((r, i) => !rs.some((q, j) => j !== i && q[0] <= r[0] + 1e-9 && q[1] <= r[1] + 1e-9 && q[2] >= r[2] - 1e-9 && q[3] >= r[3] - 1e-9 && (j < i || area(q) > area(r) + 1e-9 || !(q[0] === r[0] && q[1] === r[1] && q[2] === r[2] && q[3] === r[3]) )));

/** how far the packer keeps a new piece from a neighbour on the same top (the lint demands MIN_GAP: the packer's is a little more, for the millimetre rounding of two positions) */
export const NEIGHBOUR_GAP = 0.02;
/** the least gap the layout lint accepts between two surface items on one host, authored or dressed (plan: a gap under 1.5 cm reads as one object) */
export const MIN_GAP = 0.015;
/**
 * How far a small good's BUILT mesh reaches past the measured box the packer and the lint work from (a flower-jug's flowers, a book stack's leaning top book, a
 * candle-trio's wicks): the page seeds those spills per item, so the packer cannot know them and keeps the worst case of each type clear instead. Measured over 24
 * seeds per type in three.js (every surface type in the catalog whose built box passed its measured box by more than 2 mm), rounded up to the millimetre, plus 2 mm;
 * test-dress-phase M builds 24 other seeds of each and fails past it, and fails for a surface type that spills and is missing here.
 */
export const REACH: Record<string, number> = {
  'vase': 0.023, 'book-stack': 0.038, 'flower-jug': 0.022, 'herb-pots': 0.015, 'fern': 0.012, 'aloe-pot': 0.008, 'jade-plant': 0.022, 'candle-trio': 0.009,
  'centerpiece': 0.014, 'kettle-and-mug': 0.007, 'cutting-board-set': 0.007, 'utensil-crock': 0.009, 'tea-towel': 0.016, 'pot-on-hob': 0.027, 'side-set': 0.012,
  'shelf-style': 0.010, 'nightstand-set': 0.028, 'tissue-candle': 0.012, 'towel-stack': 0.011,
};
export const reachOf = (type: string): number => REACH[type] || 0;

/** the host's free rects: its rects minus `margin` on every edge, minus the footprints of what stands on it, each grown by what it needs round it: the margin, or `gap` (never less than NEIGHBOUR_GAP) plus its own reach and the new piece's (`reach`, the piece the area is for) */
export function freeRects(h: Host, on: any[], margin = 0.04, gap = NEIGHBOUR_GAP, reach = 0): Rect[] {
  let free: Rect[] = h.rects.map(r => [r[0] + margin, r[1] + margin, r[2] - margin, r[3] - margin] as Rect).filter(r => r[2] - r[0] > 0.02 && r[3] - r[1] > 0.02);
  for (const it of on) {
    const f = footprintIn(h, it); if (!f) continue;
    const grow = Math.max(margin, gap + reachOf(it.type) + reach);
    const g: Rect = [f[0] - grow, f[1] - grow, f[2] + grow, f[3] + grow];
    free = prune(free.flatMap(r => subtract(r, g)).filter(r => r[2] - r[0] > 0.02 && r[3] - r[1] > 0.02));
  }
  return free;
}

/** the DESK_TOP of the page (assets/item-map.ts): a surface type given no `y` is built at this height */
export const DESK_TOP = 0.77;
/** the height an item stands at, as the page builds it: its `y`, else DESK_TOP for a type that stands on a surface; undefined for anything else (a floor piece, a wall piece) */
export function surfaceY(it: any): number | undefined {
  if (!it) return undefined;
  if (it.y !== undefined) return it.y;
  const pl: any = PLACEMENT[it.type], def: any = PROPS.get(it.type);
  return (pl && pl.onSurface) || (def && def.surface) ? DESK_TOP : undefined;
}

/**
 * what already stands ON a host: surface items whose origin is over one of its rects (grown a little) at about its top (from 4 cm under to 8 cm over: a lamp
 * on the taller of a pair of nesting tables stands 5 cm above the host's top and is no less a neighbour). An authored item given no `y` stands at DESK_TOP,
 * as the page builds it (the table's own flower-jug), which the first cut missed, so the packer put a candle against it.
 */
export function standingOn(h: Host, items: any[]): any[] {
  return items.filter(it => {
    if (it === h.item || !Array.isArray(it.at)) return false;
    const y = surfaceY(it); if (y === undefined) return false;
    if (y < h.top - 0.04 || y > h.top + 0.08) return false;
    const [lx, lz] = toLocal(h, it.at[0], it.at[1]);
    return h.rects.some(r => lx >= r[0] - 0.1 && lx <= r[2] + 0.1 && lz >= r[1] - 0.1 && lz <= r[3] + 0.1);
  });
}

/** the gap between two host-frame rects: positive apart, negative when they overlap (by how much, the lesser overlap of the two axes) */
export function rectGap(a: Rect, b: Rect): number {
  const gx = Math.max(b[0] - a[2], a[0] - b[2]), gz = Math.max(b[1] - a[3], a[1] - b[3]);
  return gx > 0 || gz > 0 ? Math.hypot(Math.max(gx, 0), Math.max(gz, 0)) : Math.max(gx, gz);
}
/** the smallest gap between `it`'s footprint and every other item standing on host `h` (`on` is what standingOn gave), and which one; null when it stands alone. `withReach` takes both pieces' REACH off the gap: the gap their built meshes can be at worst */
export function neighbourGap(h: Host, it: any, on: any[], withReach = false): { gap: number; other: any } | null {
  const f = footprintIn(h, it); if (!f) return null;
  let best: { gap: number; other: any } | null = null;
  for (const o of on) {
    if (o === it) continue;
    const g = footprintIn(h, o); if (!g) continue;
    const gap = rectGap(f, g) - (withReach ? reachOf(it.type) + reachOf(o.type) : 0);
    if (!best || gap < best.gap) best = { gap, other: o };
  }
  return best;
}

export type Anchor = 'centre' | 'left' | 'right' | 'back' | 'front' | 'back-left' | 'back-right' | 'front-left' | 'front-right';
/**
 * Where a w x d box (its OWN box: the footprint's centre) fits in the free rects. The anchor names a target in the host's whole top (`bounds`, default the
 * free rects' cover): the centre, a quarter from an end, against the back edge (a tall piece goes to the back, toward a wall) or the front, or a corner of those.
 * Every free rect the box fits in offers the spot nearest the target (the target clamped into the rect), and the nearest of them wins (ties: the larger rect).
 * Returns the box's centre in the host frame, to the centimetre.
 */
export function fitIn(free: Rect[], w: number, d: number, anchor: Anchor = 'centre', bounds?: Rect): [number, number] | null {
  const B: Rect = bounds || [Math.min(...free.map(r => r[0])), Math.min(...free.map(r => r[1])), Math.max(...free.map(r => r[2])), Math.max(...free.map(r => r[3]))];
  if (!free.length) return null;
  const tx = /left/.test(anchor) ? B[0] + (B[2] - B[0]) * 0.25 : /right/.test(anchor) ? B[0] + (B[2] - B[0]) * 0.75 : (B[0] + B[2]) / 2;
  const tz = /back/.test(anchor) ? B[1] + d / 2 : /front/.test(anchor) ? B[3] - d / 2 : (B[1] + B[3]) / 2;
  let best: { x: number; z: number; dist: number; a: number } | null = null;
  for (const r of free) {
    if (r[2] - r[0] < w - 1e-6 || r[3] - r[1] < d - 1e-6) continue;
    const x = Math.max(r[0] + w / 2, Math.min(r[2] - w / 2, tx)), z = Math.max(r[1] + d / 2, Math.min(r[3] - d / 2, tz));
    const dist = Math.hypot(x - tx, z - tz), a = area(r);
    if (!best || dist < best.dist - 1e-9 || (Math.abs(dist - best.dist) <= 1e-9 && a > best.a)) best = { x, z, dist, a };
  }
  if (!best) return null;
  // to the centimetre where that stays inside the rect, else to the millimetre toward the inside (the box never ends up outside what fitted)
  const snap = (v: number, lo: number, hi: number): number => { const a = Math.ceil(lo * 1000 - 1e-6) / 1000, b = Math.floor(hi * 1000 + 1e-6) / 1000; if (a > b) return v; return Math.max(a, Math.min(b, Math.round(v * 100) / 100)); };
  const r = free.filter(q => q[2] - q[0] >= w - 1e-6 && q[3] - q[1] >= d - 1e-6 && best!.x - w / 2 >= q[0] - 1e-6 && best!.x + w / 2 <= q[2] + 1e-6 && best!.z - d / 2 >= q[1] - 1e-6 && best!.z + d / 2 <= q[3] + 1e-6)[0];
  return r ? [snap(best.x, r[0] + w / 2, r[2] - w / 2), snap(best.z, r[1] + d / 2, r[3] - d / 2)] : [Math.round(best.x * 1000) / 1000, Math.round(best.z * 1000) / 1000];
}
export { area as rectArea };

// ---- the review rig's corners (a keep-out for what stands where its cameras stand) ---------------------------------------------------------------
/**
 * The rig's corner cameras (scripts/review/cameras.mts `cornerCam`: the eye 1.5 m up, inset min(0.55, 20 % of the shorter side) from the corner, looking across the room) are
 * where every review frame (R24 takes NW and SE; the camera addendum and the shot planner's candidates use all four, so all four are kept) is taken from. A floor lamp or a plant in the corner swallows the frame (a fiddle-leaf with the lens inside
 * its leaves is a green blob), so nothing the phase places may come within CAM_CLEAR of one, and a floor piece taller than TALL keeps out of a CORNER_SQ square at every corner of the
 * room too. A shorter floor piece and anything on a counter below the eye are no obstacle (their 3-D gap to the eye is already more than CAM_CLEAR). The formula is a copy
 * of the rig's (THREE-free, in assets/): test-dress-phase K runs the rig's own `cornerCam` against it.
 */
export const CAM = { eye: 1.5, inset: 0.55, share: 0.2, clear: 0.3, square: 0.5, tall: 0.8 };
export type CornerName = 'NW' | 'SE' | 'NE' | 'SW';
export interface CornerEye { corner: CornerName; x: number; z: number; /** the corner square, a rect [x0, z0, x1, z1] */ sq: [number, number, number, number] }
const FLIP: Record<CornerName, [number, number]> = { NW: [0, 0], SE: [1, 1], NE: [1, 0], SW: [0, 1] };
export function cornerEyes(b: { x: number; z: number; w: number; d: number }): CornerEye[] {
  const m = Math.min(CAM.inset, Math.min(b.w, b.d) * CAM.share);
  return (Object.keys(FLIP) as CornerName[]).map(corner => {
    const [fx, fz] = FLIP[corner], q = Math.min(CAM.square, b.w, b.d);
    return { corner, x: mm(fx ? b.x + b.w - m : b.x + m), z: mm(fz ? b.z + b.d - m : b.z + m), sq: [fx ? b.x + b.w - q : b.x, fz ? b.z + b.d - q : b.z, fx ? b.x + b.w : b.x + q, fz ? b.z + b.d : b.z + q] };
  });
}
/** the 3-D gap between a corner camera's eye and a box (an obb footprint standing between y0 and y1); 0 inside it */
export function eyeGap(o: Obb, y0: number, y1: number, e: { x: number; z: number }): number {
  const [lx, lz] = turn(e.x - o.cx, e.z - o.cz, -o.rot);
  return Math.hypot(Math.max(Math.abs(lx) - o.hw, 0), Math.max(Math.abs(lz) - o.hd, 0), Math.max(y0 - CAM.eye, CAM.eye - y1, 0));
}
/** does a box (footprint, y range, standing on the floor or not) stand in a corner camera's way: within CAM.clear of an eye, or (a tall floor piece) in a corner square */
export function camBlocked(eyes: CornerEye[], o: Obb, y0: number, y1: number, floorPiece: boolean): boolean {
  for (const e of eyes) {
    if (eyeGap(o, y0, y1, e) < CAM.clear) return true;
    if (floorPiece && y1 - y0 > CAM.tall && overlap(o, rectObb(e.sq[0], e.sq[1], e.sq[2], e.sq[3])) > 0) return true;
  }
  return false;
}
