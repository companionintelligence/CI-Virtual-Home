// The café curtain's PLAN (DRESS): where, how wide and how high a café curtain hangs on a window, and what it must keep clear of. THREE-free, Node and page alike.
//
// A café curtain is SOFT's `cafe-curtain` (assets/props/windows.ts): a pleated cloth 0.094 m deep, hung 0.4 cm off the wall face, whose rod stands 0.019 above `h` and whose
// finials reach 0.05 m past the cloth each side (its whole box is `w + 0.1` wide). The first cut (f3b4388) put one on every bare kitchen window, `window + 0.2` wide with its hem
// 3 cm over the sill; the second skeptic measured what that built:
//   - the cloth passes 2-4 cm through whatever stands against the wall under the window (a mushroom lamp, a bread bin, the sink's tap and spout, a pantry, an upper cabinet), 23 of
//     the fleet's 39 curtains, authored and composed items as much as dress ones.
// This plan fixes the first, with one idea: the curtain is planned FIRST, against the room's layout, and the dress phase keeps the volume it takes clear.
//
//   1. each window's curtain starts as the first cut's: its whole box `window + 0.3` wide, centred;
//   2. obstacles: every item of the room whose box meets the cloth's volume (the curtain's footprint, its rod height range) is either stood over (the hem lifts to clear it, at most
//      MAXLIFT over the sill, where the curtain still fits the window's lower half) or stood beside (its span of the wall is cut out and the curtain becomes two panels with a
//      gap where it stands, a parted café curtain); the plan keeps the way that covers more of the window, the lower one on a tie;
//   3. a panel narrower than MIN_PANEL, or in the way of a corner camera, is dropped, and a window whose obstacles leave no panel stays bare.
// A dress item is then kept out of every panel's volume (room-dress.ts `put`, `placeGroup`), by the same pads.
//
// What is an obstacle is read from the catalog: the box sizeOf measured (its footprint, its height from its mount), grown by the REACH of a small good and PAD; a type whose
// body is lower and narrower than its box says so in PARTS (the sink run's tap is a 3 cm column 1.19 m high on a 0.96 m body: measuring its whole box would leave every
// window above a sink bare). scripts/test-dress-phase.mts N builds each PARTS type in three.js and fails when a built mesh is outside its parts.
//
// Owner: DRESS.
import { INWARD, ROT_OF_WALL, alongX, itemObb, sizeOf, mm, turn, type Geo, type Obb, type Side, type Size } from './room-geo.js';
import { PLACEMENT } from './props/placement.js';
import { layerOf } from './room-composer.js';
import { surfaceY, DESK_TOP, reachOf, camBlocked, type CornerEye } from './room-dress-hosts.js';

/** SOFT's cafe-curtain: the cloth hangs `drop(h)` below the rod at h (windows.ts: Math.min(0.75, Math.max(0.3, h - 0.5))), the rod (with its finials) stands 0.019 above h, the hem 0.015 below the cloth's top */
export const CAFE = { minDrop: 0.3, maxDrop: 0.75, rodAbove: 0.019, hemGap: 0.015, topShare: 0.55, hemAboveSill: 0.03, eyeLo: 1.45, eyeHi: 1.55, minSill: 0.6, small: 1.25 };
export const cafeDrop = (h: number) => Math.min(CAFE.maxDrop, Math.max(CAFE.minDrop, h - 0.5));
/** how far the plan keeps one curtain's box from the next one's, and a curtain's volume from anything else (the lint-free 2 cm the packer keeps, a little over the 1.5 cm the page measures) */
export const CURTAIN_GAP = 0.025;
/** the clearance round an obstacle's box (a small good adds its own REACH on top) */
export const CURTAIN_PAD = 0.015;
/** the slack over a measured height: a built mesh (a flower, a plant, a tap) is taller than its box by a seeded amount */
export const VPAD = 0.02;
/** a cloth's whole box is its `w` plus the finials' reach, 0.05 each side */
export const FINIAL = 0.1;
/** the narrowest panel (its whole box): a cloth of 0.35 m or more */
export const MIN_PANEL = 0.45;
/** the most a curtain's hem may hang over its window's sill to clear what stands under it, metres */
export const MAXLIFT = 0.22;
/** the curtain's offset from the wall face, and its depth (the measured box of `cafe-curtain`): its cloth stands in z 0.004..0.098 off the wall */
export const WALL_GAP = 0.004;
export const CURTAIN_DEPTH = 0.094;

export interface CafeFit { h: number; y: number; rod: number; hem: number }
/**
 * the params of a café curtain for a window (its sill and height, m): `h` and `y` so the cloth runs from just over the sill to about the window's middle; null when the window is
 * too short to hold the shortest curtain, or sits so near the floor (sill under 0.6 m) that it is a door in all but name and no café curtain hangs there. `hemMin` lifts the hem
 * (to clear what stands under the curtain): the cloth still ends under sill + 0.55 x the window's height and clear of the 1.45-1.55 m eye line wherever the window leaves room.
 */
export function cafeFit(sill: number, hgt: number, hemMin = 0): CafeFit | null {
  if (sill < CAFE.minSill) return null;
  const hem = Math.max(sill + CAFE.hemAboveSill, hemMin), cap = sill + CAFE.topShare * hgt - CAFE.rodAbove;
  let rod = Math.min(sill + 0.5 * hgt, cap);
  // the eye line: a curtain whose top reaches 1.45-1.55 m from below hides the room's view at the height people look at it; where the shortest curtain still ends below it, end it there
  const eyeRod = CAFE.eyeLo - CAFE.rodAbove - 0.005, clearable = eyeRod - CAFE.hemGap - hem >= CAFE.minDrop;
  if (rod + CAFE.rodAbove >= CAFE.eyeLo && hem <= CAFE.eyeHi && clearable) rod = eyeRod;
  // a window that cannot hold a curtain below the eye line is dressed only when it is small (a high sill and a short window: the curtain is bound to stand there); a big one keeps its view
  else if (!clearable && hem <= CAFE.eyeHi && hgt > CAFE.small) return null;
  const drop = Math.min(CAFE.maxDrop, rod - CAFE.hemGap - hem);
  if (drop < CAFE.minDrop) return null;
  rod = hem + CAFE.hemGap + drop;   // (a window tall enough for the longest drop hangs it from the hem up, never longer than the type)
  const h = Math.round((drop + 0.5) * 1000) / 1000;
  // a lifted hem must not put the cloth across the eye line the unlifted one cleared (a curtain hung higher to clear a tap would then hide the view at the height people look at it)
  if (hemMin > sill + CAFE.hemAboveSill && hem < CAFE.eyeHi && rod + CAFE.rodAbove > CAFE.eyeLo) { const base = cafeFit(sill, hgt); if (base && !(base.hem < CAFE.eyeHi && base.rod + CAFE.rodAbove > CAFE.eyeLo)) return null; }
  return { h, y: Math.round((rod - h) * 1000) / 1000, rod, hem };
}

// ---- what is in the curtain's way -----------------------------------------------------------------------------------------------------------------
type Rect6 = [number, number, number, number, number, number];   // x0, z0, x1, z1 (item frame), y0, y1
/**
 * A type whose body is lower or narrower than the box sizeOf measured: its body's top, and the parts that stand proud of it, in the item's own frame (x, z, then y). The
 * sink run (assets/props/kitchen.ts): a worktop and an upstand to 0.96 m, a tap riser 3 cm wide to 1.19 m at 0.07 m from the back, its gooseneck arm and spout out over the
 * basin at 1.12-1.19 m; the box sizeOf has is the whole run up to the tap, 1.8 m wide.
 */
export const PARTS: Record<string, (it: any, s: Size) => { top: number; extras: Rect6[] }> = {
  'sink-run': (it, s) => {
    const d = it.d || 0.62, bd = d * 0.62, tz = 0.02 - bd / 2 - 0.05;
    return { top: 0.96, extras: [[-0.02, tz - 0.02, 0.02, tz + 0.02, 0.9, 1.2], [-0.016, tz - 0.016, 0.016, tz + 0.2, 1.11, 1.2]] };
  },
};
interface Vol { o: Obb; y0: number; y1: number; type: string }
/** the vertical span of an item (m): a floor piece from its measured base, a surface piece from the height it stands at, a hung piece from its mount */
export function itemSpan(it: any, s: Size): [number, number] {
  const layer = layerOf(it.type);
  if (layer === 'surface') { const y = surfaceY(it) ?? DESK_TOP; return [y + (s.y0 || 0), y + (s.y0 || 0) + s.h]; }
  if (layer === 'wall' && it.y !== undefined) {
    const y0 = ['wall-art', 'gallery-wall', 'round-mirror', 'arch-mirror', 'triptych', 'framed-print', 'canvas-art', 'plate-set', 'wall-clock', 'wall-tv', 'whiteboard', 'pin-board'].includes(it.type) ? it.y - s.h / 2 : it.type === 'wall-hanging' ? it.y - s.h : it.y;
    return [y0, y0 + s.h];
  }
  // (a floor piece authored with a `y` is built at that height: a cube-storage hung on the wall at 1.5 m)
  const lift = typeof it.y === 'number' ? it.y : 0;
  return [lift + (s.y0 || 0), lift + (s.y0 || 0) + s.h];
}
/** the volumes an item takes: its box, or its PARTS */
function volumesOf(it: any): Vol[] {
  const s = sizeOf(it.type, it), o = itemObb(it); if (!s || !o) return [];
  const [y0, y1] = itemSpan(it, s), rot = it.rot || 0, f = PARTS[it.type];
  if (!f) return [{ o, y0, y1, type: it.type }];
  const p = f(it, s), body: Vol = { o, y0, y1: Math.min(y1, p.top), type: it.type }, out: Vol[] = [body];
  for (const [x0, z0, x1, z1, e0, e1] of p.extras) {
    const [dx, dz] = turn((x0 + x1) / 2, (z0 + z1) / 2, rot);
    out.push({ o: { cx: it.at[0] + dx, cz: it.at[1] + dz, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, rot }, y0: e0, y1: e1, type: it.type });
  }
  return out;
}
/** an obb's extent along a wall and out from it (the wall's own frame: `across` grows into the room), over its corners */
function inWall(o: Obb, side: Side, face: number): { a0: number; a1: number; c0: number; c1: number } {
  const hw = o.hw, hd = o.hd, pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const [x, z] = turn(sx * hw, sz * hd, o.rot); return [o.cx + x, o.cz + z]; });
  const along = pts.map(p => (alongX(side) ? p[0] : p[1])), across = pts.map(p => (side === 'N' ? p[1] - face : side === 'S' ? face - p[1] : side === 'W' ? p[0] - face : face - p[0]));
  return { a0: Math.min(...along), a1: Math.max(...along), c0: Math.min(...across), c1: Math.max(...across) };
}
/** the box a curtain of `w` and `h` takes on a wall, as an obb in the plan (the cafe-curtain's measured box: w + 0.1 wide, 0.094 deep from its origin) */
export const curtainObb = (at: [number, number], rot: number, w: number, h: number): Obb | null => itemObb({ type: 'cafe-curtain', at, rot, w, h });

export const DRESSERS = ['curtains', 'roman-blind', 'roller-shade', 'cafe-curtain', 'shutters', 'valance'];

export interface Panel {
  side: Side; at: [number, number]; rot: number; /** the cloth's width, `w` */ w: number; h: number; y: number;
  /** the whole box along the wall (rod and finials included) */ a0: number; a1: number;
  /** the cloth's lowest and the rod's highest point, metres over the storey floor */ hem: number; top: number;
  sill: number; hgt: number; obb: Obb;
}

/**
 * The curtains of a room's bare windows: `geo` is the room's analysis, `items` everything standing in the room (authored and composed; a curtain, blind or shutter among them is what
 * already hangs at a window: a window within half its width and 0.6 m of one is left to it), `eyes` the rig's corner cameras.
 */
export function planCafe(geo: Geo, items: any[], eyes: CornerEye[]): Panel[] {
  const out: Panel[] = [];
  const dressers = items.filter(it => DRESSERS.includes(it.type) && Array.isArray(it.at)), others = items.filter(it => !DRESSERS.includes(it.type) && Array.isArray(it.at));
  const vols = others.flatMap(it => volumesOf(it).map(v => ({ ...v, reach: reachOf(it.type) })));
  for (const run of geo.runs) {
    const [nx, nz] = INWARD[run.side], rot = ROT_OF_WALL[run.side], px = alongX(run.side);
    // the volumes whose box meets the cloth's depth on this wall, in the wall's frame
    const near = vols.map(v => ({ v, ...inWall(v.o, run.side, run.face) })).filter(b => b.c1 > -CURTAIN_PAD && b.c0 < WALL_GAP + CURTAIN_DEPTH + CURTAIN_PAD + b.v.reach);
    interface Cand { win: any; t: number; wid: number; L: number; R: number; fit: CafeFit }
    const cands: Cand[] = [];
    for (const w of run.windows.filter(w => w.type === 'window' && w.b - w.a >= 0.5 && w.b - w.a <= 3.2).sort((p, q) => p.a - q.a)) {
      const t = (w.a + w.b) / 2, pos: [number, number] = px ? [mm(t), mm(run.face + nz * WALL_GAP)] : [mm(run.face + nx * WALL_GAP), mm(t)];
      // something already hangs here: any curtain or blind within half a window and a bit of its centre, on this wall
      if (dressers.some(d => Math.hypot(d.at[0] - pos[0], d.at[1] - pos[1]) < (w.b - w.a) / 2 + 0.6)) continue;
      const fit = cafeFit(w.sill, w.h); if (!fit) continue;
      const wid = mm(Math.min(w.b - w.a + 0.2, 3.0)), half = (wid + FINIAL) / 2;
      cands.push({ win: w, t, wid, L: t - half, R: t + half, fit });
    }
    // obstacles: stood over, or stood beside
    for (const c of cands) {
      if (c.R - c.L < MIN_PANEL) continue;
      const hemNom = c.win.sill + CAFE.hemAboveSill;
      const blocksAt = (fit: CafeFit) => near.filter(b => b.v.y1 + VPAD > fit.hem - CURTAIN_PAD && b.v.y0 < fit.rod + CAFE.rodAbove + CURTAIN_PAD && b.a1 + CURTAIN_PAD + b.v.reach > c.L && b.a0 - CURTAIN_PAD - b.v.reach < c.R);
      // the hems to try: the nominal one, and the top of each obstacle that stands under the window's lower half (the nearest lift first)
      const hems = [hemNom, ...near.filter(b => b.a1 > c.L && b.a0 < c.R).map(b => b.v.y1 + VPAD + CURTAIN_PAD + 0.002).filter(h => h > hemNom + 1e-6 && h <= hemNom + MAXLIFT)].sort((p, q) => p - q).filter((h, i, a) => i === 0 || h - a[i - 1] > 1e-6);
      const tries: Array<{ fit: CafeFit; panels: Array<[number, number]>; cover: number }> = [];
      for (const hm of hems) {
        const fit = hm === hemNom ? c.fit : cafeFit(c.win.sill, c.win.h, hm); if (!fit) continue;
        // the cut-outs: each blocker's span of the wall, grown by the pad and its reach
        const cuts = blocksAt(fit).map(b => [b.a0 - CURTAIN_PAD - b.v.reach, b.a1 + CURTAIN_PAD + b.v.reach] as [number, number]).sort((p, q) => p[0] - q[0]);
        let spans: Array<[number, number]> = [[c.L, c.R]];
        for (const [x0, x1] of cuts) spans = spans.flatMap(([a, b]) => (x1 <= a || x0 >= b) ? [[a, b] as [number, number]] : [[a, x0] as [number, number], [x1, b] as [number, number]]);
        spans = spans.filter(([a, b]) => b - a >= MIN_PANEL);
        tries.push({ fit, panels: spans, cover: spans.reduce((t, [a, b]) => t + b - a, 0) });
      }
      const best = Math.max(0, ...tries.map(t => t.cover)); if (best < MIN_PANEL) continue;
      const pick = tries.find(t => t.cover >= 0.85 * best)!;
      for (const [a, b] of pick.panels) {
        const w = mm(b - a - FINIAL), mid = mm((a + b) / 2), pos: [number, number] = px ? [mid, mm(run.face + nz * WALL_GAP)] : [mm(run.face + nx * WALL_GAP), mid];
        const o = curtainObb(pos, rot, w, pick.fit.h); if (!o) continue;
        // (a curtain that stands within reach of a corner camera, in a small kitchen, is left off)
        if (camBlocked(eyes, o, pick.fit.hem, pick.fit.rod + CAFE.rodAbove, false)) continue;
        out.push({ side: run.side, at: pos, rot, w, h: pick.fit.h, y: pick.fit.y, a0: a, a1: b, hem: pick.fit.hem, top: pick.fit.rod + CAFE.rodAbove, sill: c.win.sill, hgt: c.win.h, obb: o });
      }
    }
  }
  return out.sort((p, q) => p.at[0] - q.at[0] || p.at[1] - q.at[1]);
}
