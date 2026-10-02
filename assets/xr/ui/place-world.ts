// assets/xr/ui/place-world.ts : where the tour's card goes in a headset. A pure function: numbers in, numbers out, no THREE, no DOM,
// no clock, no random, so a Node test can throw thousands of heads at it and the headset gets the same answer.
//
// The DOM player (assets/story/place.ts) puts the card in a corner of the screen next to the thing it is about. A person in a headset
// has no screen, so the same question becomes: at which direction, as the head sees it, does a card of this angular size sit
// BESIDE the subject, inside the comfortable cone of view, in air (not in a wall), with nothing between the head and the card?
//
//   1 the card's size is angular (XR_LEGIBILITY.card, 22 to 40 degrees wide) and its distance is a comfortable one
//     (1.7 m, nearer when the subject is nearer, never under XR_COMFORT.minCardDistM), so its metres follow from those two
//   2 twelve candidate directions (every 30 degrees) around the subject's rectangle AS THE HEAD SEES IT, each pushed until the card's
//     rectangle just clears the subject's (and the Core's) plus a gap
//   3 a candidate is dropped when it leaves the view cone, when the straight line from the head to the card (or to its corners)
//     crosses the house's hull (walls, slabs, roofs, closed doors), when a corner is inside a hull box, or when it covers 2 percent
//     or more of the subject, of the Core, or of the areas the caption bar and the menu use
//   4 the survivor nearest the middle of the view wins (ties by index, so the answer is stable)
//   5 no survivor: a 'sheet' under the horizon that follows the head lazily (the phone layout's cousin). The report says so.
//
// The leader runs from the card's nearest edge to the subject's focus; it is dashed when the hull hides the focus from the head.
import type { Box6, PlaceWorldInput, PlaceWorldOut, PlacementReport, V3, WorldProbe } from '../presenter.js';
import { MAX_OVERLAP, XR_COMFORT, XR_LEGIBILITY } from '../presenter.js';
import { panelBasis } from './hit.js';

const DEG = 180 / Math.PI, RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** An angular rectangle as a head sees it: azimuth (+ right) and elevation (+ up), degrees, relative to the head's level forward axis. */
export interface AngRect { a0: number; a1: number; e0: number; e1: number }
export const rectArea = (r: AngRect) => Math.max(0, r.a1 - r.a0) * Math.max(0, r.e1 - r.e0);
export function rectIntersect(a: AngRect, b: AngRect): number {
  return Math.max(0, Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0)) * Math.max(0, Math.min(a.e1, b.e1) - Math.max(a.e0, b.e0));
}
/** the fraction of `s` that `c` covers (0 when `s` has no area) */
export function coverage(c: AngRect, s: AngRect): number { const a = rectArea(s); return a > 0 ? rectIntersect(c, s) / a : 0; }

/** azimuth and elevation, degrees, of the world point `p` from `head` looking along `yaw` (rad about +y, 0 = -z). A point behind the head is pinned to the side (+-90), never wrapped. */
export function viewAngles(head: V3, yaw: number, p: V3): [number, number] {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const vx = p[0] - head[0], vy = p[1] - head[1], vz = p[2] - head[2];
  const f = vx * fx + vz * fz, r = vx * rx + vz * rz;
  return [Math.atan2(r, Math.max(f, 0.05)) * DEG, Math.atan2(vy, Math.max(Math.hypot(f, r), 0.05)) * DEG];
}
export function boxRect(head: V3, yaw: number, b: Box6): AngRect {
  const out: AngRect = { a0: Infinity, a1: -Infinity, e0: Infinity, e1: -Infinity };
  for (let i = 0; i < 8; i++) {
    const [a, e] = viewAngles(head, yaw, [i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]]);
    if (a < out.a0) out.a0 = a; if (a > out.a1) out.a1 = a; if (e < out.e0) out.e0 = e; if (e > out.e1) out.e1 = e;
  }
  return out;
}
const grow = (r: AngRect, minW: number, minH: number): AngRect => {
  const ca = (r.a0 + r.a1) / 2, ce = (r.e0 + r.e1) / 2, hw = Math.max((r.a1 - r.a0) / 2, minW / 2), hh = Math.max((r.e1 - r.e0) / 2, minH / 2);
  return { a0: ca - hw, a1: ca + hw, e0: ce - hh, e1: ce + hh };
};
const centred = (a: number, e: number, w: number, h: number): AngRect => ({ a0: a - w / 2, a1: a + w / 2, e0: e - h / 2, e1: e + h / 2 });

/** the card's width in degrees for the person's text scale (a bigger text needs a wider card to keep its line length), inside 22 to 40 */
export function cardWidthDeg(textScale: number): number {
  const c = XR_LEGIBILITY.card;
  return clamp(c.defaultDeg * Math.sqrt(Math.max(0.5, textScale)), c.minDeg, c.maxDeg);
}
/** metres across an angle at a distance (the flat-panel chord, not the tangent of the em helper) */
export const chordM = (deg: number, distM: number) => 2 * distM * Math.tan(deg * RAD / 2);
export const degOf = (m: number, distM: number) => 2 * Math.atan(m / 2 / Math.max(1e-6, distM)) * DEG;

/** The view cone a whole card must sit inside: about a headset's optical field (a person turns the head a little to read a card off to the side; it is never behind them). */
export const VIEW_CONE = { azHalf: 56, elMin: -38, elMax: 32 } as const;
const GAP_DEG = 2, MIN_SUBJECT_DEG = 5;
/** the sheet's lower edge: just over the caption bar (XR_LEGIBILITY.caption.belowHorizonDeg 16 and two lines of caption text) */
const SHEET_BOTTOM_DEG = -11;
const HULL_MARGIN_M = 0.03;

function dirFrom(head: V3, yaw: number, az: number, el: number, d: number): V3 {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const ca = Math.cos(az * RAD), sa = Math.sin(az * RAD), ce = Math.cos(el * RAD), se = Math.sin(el * RAD);
  return [head[0] + (fx * ca + rx * sa) * ce * d, head[1] + se * d, head[2] + (fz * ca + rz * sa) * ce * d];
}
/** the distance from a point to the nearest hull box (0 inside one) */
export function hullDistance(p: V3, hull: Box6[]): number {
  let best = Infinity;
  for (const b of hull) {
    const dx = Math.max(b[0] - p[0], 0, p[0] - b[3]), dy = Math.max(b[1] - p[1], 0, p[1] - b[4]), dz = Math.max(b[2] - p[2], 0, p[2] - b[5]);
    const d = Math.hypot(dx, dy, dz); if (d < best) best = d;
  }
  return best;
}

interface Pose { centre: V3; yaw: number; tiltDeg: number; widthM: number; heightM: number; dist: number }
function faceHead(head: V3, centre: V3): { yaw: number; tiltDeg: number } {
  const dx = head[0] - centre[0], dz = head[2] - centre[2], dy = head[1] - centre[1];
  return { yaw: Math.atan2(dx, dz), tiltDeg: clamp(Math.atan2(dy, Math.max(Math.hypot(dx, dz), 0.05)) * DEG, -15, 15) };
}
function corners(p: Pose): V3[] {
  const b = panelBasis(p.yaw, p.tiltDeg), hw = p.widthM / 2, hh = p.heightM / 2;
  const at = (sx: number, sy: number): V3 => [p.centre[0] + b.r[0] * hw * sx + b.u[0] * hh * sy, p.centre[1] + b.r[1] * hw * sx + b.u[1] * hh * sy, p.centre[2] + b.r[2] * hw * sx + b.u[2] * hh * sy];
  return [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
}

/** does a card at this pose stand in air with a clear line from the head? Returns the clearance in metres when it does, else -1. */
function clearOf(head: V3, p: Pose, world: WorldProbe, hull: Box6[]): number {
  const cs = corners(p);
  let clearance = hullDistance(p.centre, hull);
  for (const c of cs) clearance = Math.min(clearance, hullDistance(c, hull));
  if (clearance < HULL_MARGIN_M) return -1;
  if (!world.segmentClear(head, p.centre)) return -1;
  for (const c of cs) if (!world.segmentClear(head, c)) return -1;
  // across the card too: a thin wall between two clear corners would otherwise slip through
  if (!world.segmentClear(cs[0], cs[2]) || !world.segmentClear(cs[1], cs[3])) return -1;
  return clearance;
}

export interface PlaceDebug { candidates: Array<{ k: number; ok: boolean; why: string; score: number }>; sheet: boolean }

export interface PlaceOpts {
  /** the part of the view a card must sit inside (degrees); the kit measures it from the eye's projection. Default VIEW_CONE. */
  cone?: { azHalf: number; elMin: number; elMax: number };
  /** the person is about to be moved by a blink: the solver may also choose the head's yaw (Placed.headYaw), turning it up to a little toward the card so that
   *  the subject and the card sit side by side in the middle of the view instead of the card at its edge. Without it the head's yaw is taken as given. */
  turn?: boolean;
  /** the card's aspect (width / height) at another width in degrees: the solver tries wider cards (a wider card is a shorter one) before it gives up and uses the sheet */
  aspectAt?: (widthDeg: number) => number;
}
/** `widthDeg`: the card's width (the layout should be redone at it). `headYaw`: the yaw (rad) the head should have after the move; the input's own unless `turn` was allowed. */
export type Placed = PlaceWorldOut & { widthDeg: number; headYaw: number };

/** Place the card. Never throws for finite input; a degenerate one gets the sheet. */
export function placeWorld(inp: PlaceWorldInput, dbg?: PlaceDebug, opt: PlaceOpts = {}): Placed {
  const { head, headYaw, anchor, core, world } = inp;
  const hull = safeHull(world);
  const w0 = cardWidthDeg(inp.textScale);
  const toFocus = dist3(head, anchor.focus);
  const D = clamp(Math.min(XR_LEGIBILITY.distance.card, toFocus - 0.3), Math.max(XR_LEGIBILITY.distance.min, XR_COMFORT.minCardDistM), XR_LEGIBILITY.distance.max);
  const cone = opt.cone || VIEW_CONE;
  const subj = grow(boxRect(head, headYaw, anchor.box), MIN_SUBJECT_DEG, MIN_SUBJECT_DEG);
  const coreR = core ? grow(boxRect(head, headYaw, core.box), MIN_SUBJECT_DEG, MIN_SUBJECT_DEG) : null;
  const sa = (subj.a0 + subj.a1) / 2, se = (subj.e0 + subj.e1) / 2, sw = (subj.a1 - subj.a0) / 2, sh = (subj.e1 - subj.e0) / 2;
  const shifted = (r: AngRect, d: number): AngRect => ({ a0: r.a0 - d, a1: r.a1 - d, e0: r.e0, e1: r.e1 });

  // widths to try: the default, then up to the 40 degree maximum in 4 degree steps (only when the caller can say how tall the card is at each)
  const widths = [w0]; if (opt.aspectAt) for (let w = w0 + 4; w < XR_LEGIBILITY.card.maxDeg + 4; w += 4) widths.push(Math.min(XR_LEGIBILITY.card.maxDeg, w));
  const seen = new Set<number>();
  let best: { pose: Pose; score: number; widthDeg: number; turnDeg: number } | null = null;
  for (const widthDeg of widths) {
    if (seen.has(widthDeg)) continue; seen.add(widthDeg);
    const aspect = Math.max(0.4, (opt.aspectAt ? opt.aspectAt(widthDeg) : inp.cardAspect) || 1);
    const wM = chordM(widthDeg, D), hM = wM / aspect, hDeg = degOf(hM, D);
    const cw = widthDeg / 2, ch = hDeg / 2;
    for (let k = 0; k < 12; k++) {
      const th = k * 30 * RAD, cx = Math.cos(th), cy = Math.sin(th);
      // the first distance at which the two rectangles clear each other, in this direction
      const t0 = Math.min(Math.abs(cx) > 1e-6 ? (sw + cw + GAP_DEG) / Math.abs(cx) : Infinity, Math.abs(cy) > 1e-6 ? (sh + ch + GAP_DEG) / Math.abs(cy) : Infinity);
      if (cone.elMax - cone.elMin < hDeg) { if (dbg) dbg.candidates.push({ k, ok: false, why: 'taller than the cone', score: 0 }); continue; }
      let why = '';
      // pushed further out in 2 degree steps while something (the caption bar's area, the Core) is in the way: a tall card beside a wide subject needs the room
      for (let push = 0; push <= 10; push += 2) {
        const t = t0 + push;
        let a = sa + cx * t, e = se + cy * t;
        e = clamp(e, cone.elMin + ch, cone.elMax - ch);
        // where the head will look: as given, or turned so the subject and the card together sit in the middle of the view
        let turn = 0;
        if (opt.turn) turn = ((Math.min(subj.a0, a - cw) + Math.max(subj.a1, a + cw)) / 2);
        else a = clamp(a, -cone.azHalf + cw, cone.azHalf - cw);
        const card = centred(a, e, widthDeg, hDeg), cardV = shifted(card, turn), subjV = shifted(subj, turn), coreV = coreR ? shifted(coreR, turn) : null;
        if (cardV.a0 < -cone.azHalf || cardV.a1 > cone.azHalf) { why = 'wider than the view'; continue; }
        if (opt.turn && (subjV.a0 < -cone.azHalf || subjV.a1 > cone.azHalf) && sw < cone.azHalf) { why = 'wider than the view'; continue; }
        if (coverage(cardV, subjV) >= MAX_OVERLAP) { why = 'covers the subject'; continue; }
        if (coreV && coverage(cardV, coreV) >= MAX_OVERLAP) { why = 'covers the core'; continue; }
        let barHit = false;
        for (const rs of inp.reservedDeg) if (rectIntersect(cardV, { a0: rs.x0, a1: rs.x1, e0: rs.y0, e1: rs.y1 }) / rectArea(cardV) >= MAX_OVERLAP) barHit = true;
        if (barHit) { why = 'covers the caption or menu area'; continue; }
        const centre = dirFrom(head, headYaw, a, e, D);
        const f = faceHead(head, centre);
        const pose: Pose = { centre, yaw: f.yaw, tiltDeg: f.tiltDeg, widthM: wM, heightM: hM, dist: D };
        const clearance = clearOf(head, pose, world, hull);
        if (clearance < 0) { why = 'the house is in the way'; continue; }
        // the middle of the view first (and little turning); a wider card than the default costs a little (it is a bigger thing in the face)
        const score = Math.abs(a - turn) + 0.6 * Math.abs(turn) + 1.3 * Math.abs(e) + 6 * Math.abs(D - XR_LEGIBILITY.distance.card) + (widthDeg - w0) * 0.5 + k * 0.001;
        if (dbg) dbg.candidates.push({ k, ok: true, why: 'ok', score });
        if (!best || score < best.score) best = { pose, score, widthDeg, turnDeg: turn };
        why = ''; break;
      }
      if (why && dbg) dbg.candidates.push({ k, ok: false, why, score: 0 });
    }
    if (best) break;     // a narrower card that fits wins over any wider one
  }

  let pose: Pose, mode: 'card' | 'sheet' = 'card', widthDeg = w0;
  if (best) { pose = best.pose; widthDeg = best.widthDeg; }
  else {
    mode = 'sheet';
    const aspect = Math.max(0.4, (opt.aspectAt ? opt.aspectAt(w0) : inp.cardAspect) || 1);
    const Ds = clamp(1.5, XR_LEGIBILITY.distance.min, XR_LEGIBILITY.distance.max), ws = chordM(w0, Ds), hs = ws / aspect, hsDeg = degOf(hs, Ds);
    const centre = dirFrom(head, headYaw, 0, SHEET_BOTTOM_DEG + hsDeg / 2, Ds);
    const f = faceHead(head, centre);
    pose = { centre, yaw: f.yaw, tiltDeg: f.tiltDeg, widthM: ws, heightM: hs, dist: Ds };
  }
  if (dbg) dbg.sheet = mode === 'sheet';

  const out: Placed = { centre: pose.centre, yaw: pose.yaw, tiltDeg: pose.tiltDeg, widthM: pose.widthM, heightM: pose.heightM, leader: null, mode, widthDeg, headYaw: best ? headYaw - best.turnDeg * RAD : headYaw };
  if (mode === 'card') out.leader = leaderFor(head, pose, anchor, world);
  return out;
}

const safeHull = (w: WorldProbe): Box6[] => { try { return w.hull() || []; } catch { return []; } };

/** the nearest point of the card to the focus, and the focus; null when they are about the same place */
function leaderFor(head: V3, p: Pose, anchor: PlaceWorldInput['anchor'], world: WorldProbe): PlaceWorldOut['leader'] {
  const b = panelBasis(p.yaw, p.tiltDeg), f = anchor.focus;
  const dx = f[0] - p.centre[0], dy = f[1] - p.centre[1], dz = f[2] - p.centre[2];
  const lx = clamp(dx * b.r[0] + dy * b.r[1] + dz * b.r[2], -p.widthM / 2, p.widthM / 2), ly = clamp(dx * b.u[0] + dy * b.u[1] + dz * b.u[2], -p.heightM / 2, p.heightM / 2);
  const from: V3 = [p.centre[0] + b.r[0] * lx + b.u[0] * ly, p.centre[1] + b.r[1] * lx + b.u[1] * ly, p.centre[2] + b.r[2] * lx + b.u[2] * ly];
  if (dist3(from, f) < 0.25) return null;
  let hidden = false;
  try { hidden = !world.segmentClear(head, f, [anchor.box]); } catch { hidden = false; }
  return { from, to: [f[0], f[1], f[2]], dashed: hidden };
}

/** The numbers the Director logs and the conformance test judges, measured from what placeWorld returned (not from what it intended). */
export function reportPlacement(inp: PlaceWorldInput, out: PlaceWorldOut): PlacementReport {
  const { head, headYaw, anchor, core, world } = inp;
  const hull = safeHull(world);
  const d = dist3(head, out.centre), widthDeg = degOf(out.widthM, d), heightDeg = degOf(out.heightM, d);
  const [a, e] = viewAngles(head, headYaw, out.centre);
  const card = centred(a, e, widthDeg, heightDeg);
  const subj = grow(boxRect(head, headYaw, anchor.box), MIN_SUBJECT_DEG, MIN_SUBJECT_DEG);
  const overlapFocus = coverage(card, subj);
  const overlapCore = core ? coverage(card, grow(boxRect(head, headYaw, core.box), MIN_SUBJECT_DEG, MIN_SUBJECT_DEG)) : 0;
  let overlapBars = 0;
  for (const rs of inp.reservedDeg) overlapBars = Math.max(overlapBars, rectIntersect(card, { a0: rs.x0, a1: rs.x1, e0: rs.y0, e1: rs.y1 }) / Math.max(1e-6, rectArea(card)));
  let clearance = Infinity;
  const pose: Pose = { centre: out.centre, yaw: out.yaw, tiltDeg: out.tiltDeg, widthM: out.widthM, heightM: out.heightM, dist: d };
  for (const c of [out.centre, ...corners(pose)]) clearance = Math.min(clearance, hullDistance(c, hull));
  let clear = true; try { clear = world.segmentClear(head, out.centre); } catch { clear = false; }
  const ok = out.mode === 'card' ? overlapFocus < MAX_OVERLAP && overlapCore < MAX_OVERLAP && overlapBars < MAX_OVERLAP && clear && clearance >= HULL_MARGIN_M : clear;
  return {
    mode: out.mode, overlapFocus, overlapCore, overlapBars, distanceM: d, widthDeg, offAxisDeg: Math.hypot(a, e),
    clearanceM: Number.isFinite(clearance) ? clearance : undefined, headToCardClear: clear, ok,
  };
}
