// Popup placement: where a beat's card goes, as a pure function of rectangles (pixels, y down). The DOM player and the film's
// Canvas2D overlay call the same function with the same numbers, so a card is where the film shows it.
//
//   Twelve candidate slots: eight round the anchor (the compass points) and four docked in the corners of the safe area. Each is
//   scored: it must not cover the focus subject (the anchor's projected box grown 12 %) or the Core's, it must not touch the bars
//   (top bar, dock, captions), the leader line from card to subject should not cross the subject or the Core, near beats far, and
//   a card prefers the half of the frame the anchor is NOT in. Placement is solved once per beat against the beat's rest pose, never per frame, so a
//   card cannot flip sides while the camera settles; only the leader's end is re-projected each frame (leaderTo).
//   On a phone (600 px and under) the card is a bottom sheet above the dock, never over 38 % of the viewport's height, and the camera
//   composes the anchor above it (poses.ts: the tall compose row), so the overlap there is the camera's business, not a slot's.
//
// "Never covers the focus subject" is a measured claim: PlaceOut.overlapFocus is the covered share of the subject's own rect, and
// ok means it is under 2 %. THREE-free, DOM-free. Owner: story-bake.
import { camera, projectBox, type V3 } from '../shot-probe.js';
import type { Box6 } from '../shot-world.js';

export type Rect = { x: number; y: number; w: number; h: number };
export type Slot = 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'n' | 's' | 'tl' | 'tr' | 'bl' | 'br' | 'sheet';
export const SLOTS: Slot[] = ['e', 'w', 'ne', 'nw', 'se', 'sw', 'n', 's', 'tl', 'tr', 'bl', 'br'];   // the order breaks ties
export const PHONE_MAX_WIDTH = 600;
export const SHEET_MAX_FRAC = 0.38;
export const FOCUS_GROW = 0.12;
export const MAX_OVERLAP = 0.02;

export type PlaceInput = {
  vw: number; vh: number;
  /** insets in px from each viewport edge that cards stay out of (a notch, the browser's own bars); default 12 */
  safe?: { top: number; right: number; bottom: number; left: number };
  /** the anchor's projected box, px (null: the anchor is out of frame; the card takes a corner) */
  focus: Rect | null;
  /** the Core's projected box when it is in frame */
  core?: Rect | null;
  /** rects a card must not touch: the top bar, the dock, the caption strip, the chapter button */
  bars?: Rect[];
  card: { w: number; h: number };
  gap?: number;
  /** which half of the frame the anchor is in ('left' puts the card on the right); default: from the focus rect */
  side?: 'left' | 'right' | 'auto';
  /** force the phone layout (default: vw <= 600) */
  phone?: boolean;
};
export type PlaceOut = {
  slot: Slot; mode: 'card' | 'sheet'; rect: Rect;
  /** the leader line: from the card's edge to the focus rect's nearest point (null with no focus, or when the card is a sheet and the focus is in view: a pulsing dot) */
  leader: { from: [number, number]; to: [number, number] } | null;
  overlapFocus: number; overlapCore: number; overlapBars: number;
  /** under 2 % of the subject and the Core covered and no bar touched */
  ok: boolean; score: number;
};

// ---- rect helpers -------------------------------------------------------------------------------------------------------
const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);
export const inter = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
export const grow = (r: Rect, f: number): Rect => ({ x: r.x - r.w * f / 2, y: r.y - r.h * f / 2, w: r.w * (1 + f), h: r.h * (1 + f) });
const cx = (r: Rect) => r.x + r.w / 2, cy = (r: Rect) => r.y + r.h / 2;
/** the segment p-q against a rect: does it pass through the rect's interior (Liang-Barsky) */
export function segHitsRect(p: [number, number], q: [number, number], r: Rect): boolean {
  let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - r.x], [dx, r.x + r.w - p[0]], [-dy, p[1] - r.y], [dy, r.y + r.h - p[1]]] as Array<[number, number]>) {
    if (pp === 0) { if (qq < 0) return false; } else { const t = qq / pp; if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  }
  return t1 - t0 > 1e-6;
}
const nearestOn = (r: Rect, x: number, y: number): [number, number] => [Math.max(r.x, Math.min(r.x + r.w, x)), Math.max(r.y, Math.min(r.y + r.h, y))];

/** a box projected through a camera: its rect in px, clipped to the viewport; null when it is behind the eye or fully outside */
export function focusRect(eye: V3, target: V3, fov: number, box: Box6, vw: number, vh: number): Rect | null {
  const pb = projectBox(camera(eye, target, fov, vw / vh), box); if (!pb) return null;
  const x0 = (pb.minX + 1) / 2 * vw, x1 = (pb.maxX + 1) / 2 * vw, y0 = (1 - pb.maxY) / 2 * vh, y1 = (1 - pb.minY) / 2 * vh;
  const r = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(vw, x1) - Math.max(0, x0), h: Math.min(vh, y1) - Math.max(0, y0) };
  return r.w > 0 && r.h > 0 ? r : null;
}

// ---- the solver --------------------------------------------------------------------------------------------------------------
export function placePopup(inp: PlaceInput): PlaceOut {
  const { vw, vh } = inp, g = inp.gap ?? 14, bars = inp.bars || [];
  const sf0 = inp.safe || { top: 12, right: 12, bottom: 12, left: 12 };
  // (a bar across the top or the bottom of the frame is outside the room a card may take: the safe area starts beyond it)
  const sf = { ...sf0 };
  for (const b of bars) if (b.w >= vw * 0.6) { if (b.y < vh / 2) sf.top = Math.max(sf.top, b.y + b.h + 8); else sf.bottom = Math.max(sf.bottom, vh - b.y + 8); }
  const safe: Rect = { x: sf.left, y: sf.top, w: vw - sf.left - sf.right, h: vh - sf.top - sf.bottom };
  const phone = inp.phone ?? vw <= PHONE_MAX_WIDTH;
  const focus = inp.focus, core = inp.core || null;
  const F = focus ? grow(focus, FOCUS_GROW) : null, C = core ? grow(core, FOCUS_GROW) : null;
  const measure = (r: Rect) => ({
    overlapFocus: focus ? inter(r, focus) / Math.max(1, area(focus)) : 0,
    overlapCore: core ? inter(r, core) / Math.max(1, area(core)) : 0,
    overlapBars: bars.reduce((a, b) => a + inter(r, b), 0) / Math.max(1, area(r)),
  });
  const ok = (m: ReturnType<typeof measure>) => m.overlapFocus < MAX_OVERLAP && m.overlapCore < MAX_OVERLAP && m.overlapBars === 0;

  if (phone) {
    // a bottom sheet: the full width, above the lowest bar, at most 38 % of the viewport
    const dock = bars.filter(b => b.y > vh * 0.5).reduce((m, b) => Math.min(m, b.y), vh - sf.bottom);
    const h = Math.min(inp.card.h, vh * SHEET_MAX_FRAC), m = 8;
    const rect: Rect = { x: m, y: Math.max(safe.y, dock - g / 2 - h), w: vw - 2 * m, h };
    const ms = measure(rect);
    return { slot: 'sheet', mode: 'sheet', rect, leader: null, ...ms, ok: ok(ms), score: 0 };
  }

  const card = { w: Math.min(inp.card.w, safe.w), h: Math.min(inp.card.h, safe.h) };
  const clamp = (r: Rect): Rect => ({ ...r, x: Math.max(safe.x, Math.min(safe.x + safe.w - r.w, r.x)), y: Math.max(safe.y, Math.min(safe.y + safe.h - r.h, r.y)) });
  const cand = (slot: Slot): Rect => {
    const base = F || { x: vw / 2, y: vh / 2, w: 0, h: 0 }, mx = cx(base), my = cy(base);
    switch (slot) {
      case 'e': return { x: base.x + base.w + g, y: my - card.h / 2, ...card };
      case 'w': return { x: base.x - g - card.w, y: my - card.h / 2, ...card };
      case 'n': return { x: mx - card.w / 2, y: base.y - g - card.h, ...card };
      case 's': return { x: mx - card.w / 2, y: base.y + base.h + g, ...card };
      case 'ne': return { x: base.x + base.w + g, y: base.y - card.h * 0.6, ...card };
      case 'nw': return { x: base.x - g - card.w, y: base.y - card.h * 0.6, ...card };
      case 'se': return { x: base.x + base.w + g, y: base.y + base.h - card.h * 0.4, ...card };
      case 'sw': return { x: base.x - g - card.w, y: base.y + base.h - card.h * 0.4, ...card };
      case 'tl': return { x: safe.x, y: safe.y, ...card };
      case 'tr': return { x: safe.x + safe.w - card.w, y: safe.y, ...card };
      case 'bl': return { x: safe.x, y: safe.y + safe.h - card.h, ...card };
      default: return { x: safe.x + safe.w - card.w, y: safe.y + safe.h - card.h, ...card };
    }
  };
  // the side of the frame the anchor is on decides the side of it the card prefers (the schema's `side` is the anchor's third)
  const anchorLeft = inp.side === 'left' ? true : inp.side === 'right' ? false : focus ? cx(focus) < vw / 2 : null;
  let best: PlaceOut | null = null;
  SLOTS.forEach((slot, order) => {
    if (!F && !(slot === 'tl' || slot === 'tr' || slot === 'bl' || slot === 'br')) return;   // nothing to sit beside: a corner
    const r0 = cand(slot), r = clamp(r0), m = measure(r);
    let score = 0;
    // clamping into the safe area moved the card: a slot that had to be shoved is worth less
    score -= (Math.abs(r.x - r0.x) + Math.abs(r.y - r0.y)) / Math.max(vw, vh) * 4;
    score -= (F ? inter(r, F) / Math.max(1, area(F)) : 0) * 40 + (C ? inter(r, C) / Math.max(1, area(C)) : 0) * 30;
    score -= (m.overlapFocus > MAX_OVERLAP ? 20 : 0) + (m.overlapCore > MAX_OVERLAP ? 12 : 0);
    score -= m.overlapBars > 0 ? 60 + m.overlapBars * 40 : 0;
    const leader = focus ? leaderFor(r, focus) : null;
    if (leader) {
      if (focus && segHitsRect(leader.from, trimEnd(leader.from, leader.to, 6), shrink(focus, 0.2))) score -= 4;
      if (core && segHitsRect(leader.from, leader.to, core)) score -= 3;
      const dist = Math.hypot(leader.from[0] - leader.to[0], leader.from[1] - leader.to[1]);
      score -= dist / Math.hypot(vw, vh) * 3;
    } else score -= 1;
    if (anchorLeft !== null && focus) { const cardRight = cx(r) > cx(focus); if (cardRight === anchorLeft) score += 1.6; }
    score -= order * 0.02;
    if (!best || score > best.score + 1e-9) best = { slot, mode: 'card', rect: r, leader, ...m, ok: ok(m), score };
  });
  return best!;
}

const shrink = (r: Rect, f: number): Rect => ({ x: r.x + r.w * f / 2, y: r.y + r.h * f / 2, w: r.w * (1 - f), h: r.h * (1 - f) });
const trimEnd = (p: [number, number], q: [number, number], by: number): [number, number] => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, k = Math.max(0, d - by) / d; return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]; };
/** the leader: from the point of the card's edge nearest the subject to the subject's nearest point */
function leaderFor(card: Rect, focus: Rect): { from: [number, number]; to: [number, number] } {
  const to = nearestOn(focus, cx(card), cy(card)), from = nearestOn(card, to[0], to[1]);
  return { from, to };
}
/** Each frame the leader's far end follows the subject while the card stays put: the point of `focus` nearest the card. */
export function leaderTo(card: Rect, focus: Rect): { from: [number, number]; to: [number, number] } { return leaderFor(card, focus); }

/** The end card: a card centred in the frame, or pushed to the side the Core is not on; it should cover under 5 % of the Core's rect. */
export function placeEndCard(inp: { vw: number; vh: number; card: { w: number; h: number }; core?: Rect | null; bars?: Rect[]; safe?: PlaceInput['safe'] }): { rect: Rect; overlapCore: number; ok: boolean } {
  const { vw, vh } = inp, sf = inp.safe || { top: 12, right: 12, bottom: 12, left: 12 }, core = inp.core || null, bars = inp.bars || [];
  const w = Math.min(inp.card.w, vw - sf.left - sf.right), h = Math.min(inp.card.h, vh - sf.top - sf.bottom);
  const spots: Rect[] = [
    { x: (vw - w) / 2, y: (vh - h) / 2, w, h },
    { x: sf.left, y: (vh - h) / 2, w, h }, { x: vw - sf.right - w, y: (vh - h) / 2, w, h },
    { x: (vw - w) / 2, y: sf.top, w, h }, { x: (vw - w) / 2, y: vh - sf.bottom - h, w, h },
  ];
  let best = spots[0], bs = Infinity;
  spots.forEach((r, i) => { const o = core ? inter(r, core) / Math.max(1, area(core)) : 0, b = bars.reduce((a, q) => a + inter(r, q), 0); const s = o * 100 + b * 0.01 + i * 0.5; if (s < bs) { bs = s; best = r; } });
  const o = core ? inter(best, core) / Math.max(1, area(core)) : 0;
  return { rect: best, overlapCore: o, ok: o < 0.05 };
}
