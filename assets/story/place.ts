// Popup placement: where a beat's card goes, as a pure function of rectangles (pixels, y down). The DOM player and the film's
// Canvas2D overlay call the same function with the same numbers, so a card is where the film shows it.
//
//   Fourteen candidate slots: eight round the anchor (the compass points), four docked in the corners of the safe area and two docked at the middle of its left and
//   right edges (a side panel: `edge`, on for a card offered as `variants`; a lone legacy card has the twelve it always had). Each is scored: it must not cover the
//   focus subject (the anchor's projected box grown 12 %) or the Core's, it must not touch the bars (top bar, dock, captions), the leader line from card to subject
//   should not cross the subject or the Core, near beats far, and a card prefers the half of the frame the anchor is NOT in. Placement is solved once per beat
//   against the beat's rest pose, never per frame, so a card cannot flip sides while the camera settles; only the leader's end is re-projected each frame (leaderTo).
//
// THE TYPE FLOOR (the owner's "36 px text minimum", then "30 percent too big, reference the website": live pass 3, rescaled). The scale is the CI canon's: rem of the
//   org-wide 17 px root, so the floor is 1.5rem = 25.5 px at 768 px and wider (portal/viewer.css --st-min), and clamp(20px, 5.4vw, 25.5px) on a phone. A card's type never shrinks
//   to fit: the solver does not know how to set type, it is told. A caller offers VARIANTS of the card (`variants`: the card at its width, with tighter padding, a narrower and
//   so taller one ...), each with its size at its own width, the height its content needs (`full`) and the smallest type in it (`type`, px). The solver refuses a variant whose
//   type is under the floor (`typeFloor(vw)`), and among the rest it finds the slot and the variant that keep off the subject: another slot, a taller card (narrower), tighter
//   padding (padding may shrink, type may not), or a side panel docked at the edge. A variant whose content is taller than the room scrolls inside (`scrolls`), which costs a
//   little in the score; covering the subject costs a lot. If every variant is refused the result is not ok and says why (`reason`).
//
//   A card is `cardWidth(vw)` wide = clamp(420 px, 32 vw, 560 px): 28 to 34 % of a desktop or tablet window, as tall as its content needs up to the free height above the dock,
//   on the side the subject leaves free. On a phone (under 768 px) the card is a full-width sheet above the dock, up to 55 % of the viewport's height (`placeSheet`: it takes the
//   room under the subject, or the top under the bar, never the subject), scrolling inside when its content is taller.
//
//   The film's canvases do not use this scale: a 1080 px canvas is shown about 390 px wide on a phone, so its card type stays at 36 design px (`CANVAS_TYPE_MIN`) and the film
//   passes no `type` (the legacy call below), which is not judged.
//
// "Never covers the focus subject" is a measured claim: PlaceOut.overlapFocus is the covered share of the subject's own rect, and
// ok means it is under 2 %. THREE-free, DOM-free. Owner: story-bake.
import { camera, projectBox, type V3 } from '../shot-probe.js';
import type { Box6 } from '../shot-world.js';

export type Rect = { x: number; y: number; w: number; h: number };
export type Slot = 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'n' | 's' | 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 'sheet';
export const SLOTS: Slot[] = ['e', 'w', 'ne', 'nw', 'se', 'sw', 'n', 's', 'tl', 'tr', 'bl', 'br', 'l', 'r'];   // the order breaks ties
export const FOCUS_GROW = 0.12;
export const MAX_OVERLAP = 0.02;

// ---- the type scale: the one place the floor lives -------------------------------------------------------------------------------
/** The org-wide root size of the CI canon (`html { font-size: 17px }`): every size of the tour is in rem of it. */
export const ROOT_PX = 17;
/** The smallest type, in px, anything a card says may be set in, at 768 px and wider: 1.5rem of the 17 px root (portal/viewer.css `--st-min`). */
export const TYPE_MIN = 1.5 * ROOT_PX;
/** ... and on a phone: 5.4 % of the width, between this and TYPE_MIN (390 px wide gets 21.06 px). */
export const PHONE_TYPE_MIN = 20;
export const PHONE_TYPE_VW = 0.054;
/** The film's canvases keep the first brief's floor: 36 design px at a 1080 px short edge (the canvas is shown scaled down, so that is smaller on screen than the live cards). */
export const CANVAS_TYPE_MIN = 36;
/** From this width up a window is a tablet or a desktop: floating cards and side panels. Under it, a phone: a full-width sheet. */
export const TABLET_MIN_WIDTH = 768;
export const PHONE_MAX_WIDTH = TABLET_MIN_WIDTH - 1;
/** A phone's sheet is up to this share of the viewport's height (it was 38 % before the type grew), scrolling inside beyond it. */
export const SHEET_MAX_FRAC = 0.55;
/** ... and never smaller than this share (or its content) unless the room under the subject is smaller still: the sheet then covers the least it can. */
export const SHEET_MIN_FRAC = 0.22;
/** The card's width: 32 % of the window between 420 px and 560 px (28 to 34 % of a desktop or tablet window). */
export const CARD_MIN_PX = 420;
export const CARD_MAX_PX = 560;
export const CARD_VW = 0.32;
/** Narrower and so taller versions of the card for a subject the full width would cover, as shares of `cardWidth`; none goes under CARD_NARROWEST_PX. */
export const CARD_NARROWER = [0.9, 0.8];
export const CARD_NARROWEST_PX = 360;
/** A card at least this wide (share of the viewport) docks flush at an edge like a panel; a narrower one hugs the subject as it always has. */
const PANEL_MIN_FRAC = 0.24;
/** The tolerance when a variant's measured type is compared with the floor (the browser's computed sizes carry float noise). */
const TYPE_EPS = 0.06;

/**
 * Does a window this size take the full-width sheet (a phone: under 768 px) or the floating card and side panel? A tablet held upright (768 to 999 px wide and taller than wide)
 * takes the sheet too: a column of 420 px of 768 is more than half the picture, a sheet is the width of it.
 */
export function sheetLayout(vw: number, vh: number): boolean { return vw < TABLET_MIN_WIDTH || (vw < 1000 && vh > vw); }

/** The type floor for a viewport of this width: 1.5rem (25.5 px) from 768 px up, clamp(20px, 5.4vw, 25.5px) below that. */
export function typeFloor(vw: number): number {
  return vw >= TABLET_MIN_WIDTH ? TYPE_MIN : Math.min(TYPE_MIN, Math.max(PHONE_TYPE_MIN, vw * PHONE_TYPE_VW));
}
/** The width of a floating card in a window `vw` wide: clamp(420px, 32vw, 560px) (never wider than the window less a gutter). */
export function cardWidth(vw: number): number {
  return Math.round(Math.min(Math.max(vw - 24, 1), Math.max(CARD_MIN_PX, Math.min(CARD_MAX_PX, vw * CARD_VW))));
}
/** The widths a floating card may take in a window `vw` wide, the wanted one first and then narrower ones (px, rounded), never under `minPx`. */
export function panelWidths(vw: number, minPx = CARD_NARROWEST_PX): number[] {
  const w0 = cardWidth(vw), out = [w0];
  for (const f of CARD_NARROWER) { const w = Math.round(w0 * f); if (w >= minPx && !out.includes(w)) out.push(w); }
  return out;
}

/** A card at one width. `h` is the box it takes (never more than the room: a card whose content is taller scrolls); `full` is the height its content needs; `type` the smallest type in it. */
export type CardSize = { w: number; h: number; full?: number; type?: number; tag?: string; /** what the caller says choosing this variant costs, in score points (default: 0.4 for each place after the first); a tighter padding at the same width costs little, a narrower card more */ cost?: number };

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
  /** the card, when there is one way to set it; `variants` replaces it */
  card: CardSize;
  /** ways to set the card, most wanted first (a wide card, a narrower and taller one ...). A variant whose `type` is under the floor is refused. */
  variants?: CardSize[];
  /** the smallest type a card may use, px (default `typeFloor(vw)`) */
  floor?: number;
  gap?: number;
  /** which half of the frame the anchor is in ('left' puts the card on the right); default: from the focus rect */
  side?: 'left' | 'right' | 'auto';
  /** force the phone layout (default: vw < 768) */
  phone?: boolean;
  /**
   * allow the two slots docked at the middle of the left and right edges, for a card a quarter of the window wide or more (a side panel), with their small bonus. Default: on when
   * `variants` are offered (the live tour), off for the lone `card` of a legacy call (the film's canvases), which is then placed in the twelve slots it always had.
   */
  edge?: boolean;
};
export type PlaceOut = {
  slot: Slot; mode: 'card' | 'sheet'; rect: Rect;
  /** the leader line: from the card's edge to the focus rect's nearest point (null with no focus, or when the card is a sheet and the focus is in view: a pulsing dot) */
  leader: { from: [number, number]; to: [number, number] } | null;
  overlapFocus: number; overlapCore: number; overlapBars: number;
  /** under 2 % of the subject and the Core covered and no bar touched (and a variant that clears the type floor) */
  ok: boolean; score: number;
};
/** What the solvers return: a PlaceOut and which variant of the card it placed (the shape PlaceOut had before the type floor is unchanged, so a caller that builds one by hand still type-checks). */
export type Placed = PlaceOut & {
  /** the index in `variants` (0 for a lone `card`) that was placed */
  variant: number;
  /** the placed card's content is taller than its box: it scrolls inside */
  scrolls: boolean;
  /** how many variants were refused for a type under the floor */
  refused: number;
  /** 'type-floor' when every variant was refused (nothing is placed ok) */
  reason?: 'type-floor';
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

/** the variants a caller offered, each kept with its index; a variant with a declared type under the floor is refused (an undeclared type is not judged: a caller that does not say is a legacy one) */
function variantsOf(inp: { card?: CardSize; variants?: CardSize[]; floor?: number; vw: number }): { all: CardSize[]; allowed: Array<CardSize & { i: number }>; refused: number; floor: number } {
  const all = inp.variants && inp.variants.length ? inp.variants : [inp.card as CardSize];
  const floor = inp.floor ?? typeFloor(inp.vw);
  const allowed = all.map((v, i) => ({ ...v, i })).filter(v => v.type === undefined || v.type + TYPE_EPS >= floor);
  return { all, allowed, refused: all.length - allowed.length, floor };
}

// ---- the solver --------------------------------------------------------------------------------------------------------------
export function placePopup(inp: PlaceInput): Placed {
  const { vw, vh } = inp, g = inp.gap ?? 14, bars = inp.bars || [];
  const sf0 = inp.safe || { top: 12, right: 12, bottom: 12, left: 12 };
  // (a bar across the top or the bottom of the frame is outside the room a card may take: the safe area starts beyond it)
  const sf = { ...sf0 };
  for (const b of bars) if (b.w >= vw * 0.6) { if (b.y < vh / 2) sf.top = Math.max(sf.top, b.y + b.h + 8); else sf.bottom = Math.max(sf.bottom, vh - b.y + 8); }
  const safe: Rect = { x: sf.left, y: sf.top, w: vw - sf.left - sf.right, h: vh - sf.top - sf.bottom };
  const phone = inp.phone ?? vw < TABLET_MIN_WIDTH;
  const focus = inp.focus, core = inp.core || null;
  const F = focus ? grow(focus, FOCUS_GROW) : null, C = core ? grow(core, FOCUS_GROW) : null;
  const measure = (r: Rect) => ({
    overlapFocus: focus ? inter(r, focus) / Math.max(1, area(focus)) : 0,
    overlapCore: core ? inter(r, core) / Math.max(1, area(core)) : 0,
    overlapBars: bars.reduce((a, b) => a + inter(r, b), 0) / Math.max(1, area(r)),
  });
  const ok = (m: ReturnType<typeof measure>) => m.overlapFocus < MAX_OVERLAP && m.overlapCore < MAX_OVERLAP && m.overlapBars === 0;
  const vs = variantsOf(inp), edge = inp.edge ?? !!(inp.variants && inp.variants.length);
  const tail = (v: number, scrolls: boolean) => ({ variant: v, scrolls, refused: vs.refused });

  if (phone) {
    // a call that asks for the phone layout gets the sheet (placeSheet: the room under the subject, or under the top bar, up to 55 % of the height)
    return placeSheet({ vw, vh, focus, core, bars, gap: g, floor: inp.floor, variants: vs.all.map(v => ({ full: v.full ?? v.h, type: v.type, tag: v.tag })) });
  }

  const stuck = !vs.allowed.length;
  const pool: Array<CardSize & { i: number }> = stuck ? [{ ...vs.all[0], i: 0 }] : vs.allowed;
  let best: Placed | null = null;
  for (const v of pool) {
    const card = { w: Math.min(v.w, safe.w), h: Math.min(v.h, safe.h) };
    const scrolls = (v.full ?? v.h) > card.h + 1;
    const panelish = edge && card.w >= PANEL_MIN_FRAC * vw;
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
        case 'l': return { x: safe.x, y: my - card.h / 2, ...card };
        case 'r': return { x: safe.x + safe.w - card.w, y: my - card.h / 2, ...card };
        default: return { x: safe.x + safe.w - card.w, y: safe.y + safe.h - card.h, ...card };
      }
    };
    // the side of the frame the anchor is on decides the side of it the card prefers (the schema's `side` is the anchor's third)
    const anchorLeft = inp.side === 'left' ? true : inp.side === 'right' ? false : focus ? cx(focus) < vw / 2 : null;
    SLOTS.forEach((slot, order) => {
      if (!F && !(slot === 'tl' || slot === 'tr' || slot === 'bl' || slot === 'br')) return;   // nothing to sit beside: a corner
      if ((slot === 'l' || slot === 'r') && !panelish) return;                                  // (the edge slots are for a panel; a small card hugs the subject)
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
      if (panelish && (slot === 'l' || slot === 'r')) score += 0.25;    // a panel docked at the edge leaves the picture's middle to the picture
      score -= order * 0.02;
      score -= v.cost ?? v.i * 0.4;                                       // the card at its own width is the wanted one; a narrower, taller one only when it would cover the subject
      if (scrolls) score -= (1 - card.h / Math.max(1, v.full ?? card.h)) * 2;   // content the card has to scroll costs a little; covering the subject costs a lot
      if (!best || score > best.score + 1e-9) best = { slot, mode: 'card', rect: r, leader, ...m, ok: ok(m) && !stuck, score, ...tail(v.i, scrolls), ...(stuck ? { reason: 'type-floor' as const } : {}) };
    });
  }
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

// ---- the phone's sheet ---------------------------------------------------------------------------------------------------------
export type SheetVariant = { /** the height the card's content needs at the sheet's width */ full: number; /** the smallest type in it, px */ type?: number; tag?: string };
export type SheetInput = {
  vw: number; vh: number; focus: Rect | null; core?: Rect | null; bars?: Rect[]; gap?: number; floor?: number;
  /** ways to set the sheet, most wanted first (with the phone drawing, without it ...); a variant under the type floor is refused */
  variants: SheetVariant[];
};
export type SheetOut = Placed & { where: 'bottom' | 'top' };
/**
 * A phone's card: a full-width sheet, up to SHEET_MAX_FRAC of the viewport's height, that takes the room UNDER the subject (down to the dock) or, when
 * that is less than the room over it, the room under the top bar. It is as tall as its content up to that room and then scrolls inside; it never
 * covers the subject or the Core unless neither side has the SHEET_MIN_FRAC of the height it needs (then it covers the least it can, and `ok` says so).
 */
export function placeSheet(inp: SheetInput): SheetOut {
  const { vw, vh } = inp, g = inp.gap ?? 14, bars = inp.bars || [], focus = inp.focus, core = inp.core || null;
  const vs = variantsOf({ variants: inp.variants.map(v => ({ w: vw - 16, h: v.full, full: v.full, type: v.type, tag: v.tag })), floor: inp.floor, vw });
  const dock = bars.filter(b => b.y > vh * 0.5).reduce((m, b) => Math.min(m, b.y), vh - 12);
  const bottomEdge = dock - g / 2;
  const topEdge = bars.filter(b => b.y < vh * 0.4).reduce((m, b) => Math.max(m, b.y + b.h), 0) + 8;
  const blocks = [focus, core].filter(Boolean) as Rect[];
  const below = blocks.reduce((m, r) => Math.max(m, r.y + r.h), topEdge), above = blocks.reduce((m, r) => Math.min(m, r.y), bottomEdge);
  const measure = (r: Rect) => ({
    overlapFocus: focus ? inter(r, focus) / Math.max(1, area(focus)) : 0,
    overlapCore: core ? inter(r, core) / Math.max(1, area(core)) : 0,
    overlapBars: bars.reduce((a, b) => a + inter(r, b), 0) / Math.max(1, area(r)),
  });
  const clampH = (room: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, room));
  const stuck = !vs.allowed.length;
  const pool: Array<CardSize & { i: number }> = stuck ? [{ ...vs.all[0], i: 0 }] : vs.allowed;
  let best: SheetOut | null = null, bestCost = Infinity;
  for (const v of pool) {
    const full = Math.max(1, v.full ?? v.h), cap = Math.min(vh * SHEET_MAX_FRAC, full), lo = Math.min(cap, vh * SHEET_MIN_FRAC);
    const hb = clampH(bottomEdge - below, lo, cap), ht = clampH(above - g - topEdge, lo, cap);
    for (const where of ['bottom', 'top'] as const) {
      const h = where === 'bottom' ? hb : ht;
      const rect: Rect = { x: 8, y: where === 'bottom' ? bottomEdge - h : topEdge, w: vw - 16, h };
      const m = measure(rect), good = m.overlapFocus < MAX_OVERLAP && m.overlapCore < MAX_OVERLAP && m.overlapBars === 0;
      // an ok placement costs the share of its content it cannot show (and a little for the top, and for a later variant); one that covers the subject costs far more
      const cost = good ? (1 - h / full) + (where === 'top' ? 0.04 : 0) + v.i * 0.05 : 10 + m.overlapFocus + m.overlapCore + m.overlapBars * 10 + v.i * 0.01;
      if (cost < bestCost - 1e-9) { bestCost = cost; best = { slot: 'sheet', mode: 'sheet', rect, leader: null, ...m, ok: good && !stuck, score: -cost, variant: v.i, scrolls: full > h + 1, refused: vs.refused, where, ...(stuck ? { reason: 'type-floor' as const } : {}) }; }
    }
  }
  return best!;
}

// ---- the end card ---------------------------------------------------------------------------------------------------------------
/**
 * The end card: a card centred in the frame, or pushed to the side the Core is not on; it should cover under 5 % of the Core's rect. Like a beat's card it
 * is offered as variants (a wide card, a narrower and taller one) and never set in smaller type: a variant under the floor is refused.
 */
export function placeEndCard(inp: { vw: number; vh: number; card: CardSize; variants?: CardSize[]; floor?: number; core?: Rect | null; bars?: Rect[]; safe?: PlaceInput['safe'] }): { rect: Rect; overlapCore: number; ok: boolean; variant: number; scrolls: boolean; refused: number; reason?: 'type-floor' } {
  const { vw, vh } = inp, sf = inp.safe || { top: 12, right: 12, bottom: 12, left: 12 }, core = inp.core || null, bars = inp.bars || [];
  const vs = variantsOf(inp), stuck = !vs.allowed.length;
  const pool: Array<CardSize & { i: number }> = stuck ? [{ ...vs.all[0], i: 0 }] : vs.allowed;
  let best: Rect = { x: 0, y: 0, w: 0, h: 0 }, bs = Infinity, bi = 0, bScroll = false;
  for (const v of pool) {
    const w = Math.min(v.w, vw - sf.left - sf.right), h = Math.min(v.h, vh - sf.top - sf.bottom);
    // (the middle of the room between the bars, not of the window: a card as tall as the room sits in it, clear of the top bar and the dock)
    const midY = Math.max(sf.top, Math.min(vh - sf.bottom - h, (vh - h) / 2));
    const spots: Rect[] = [
      { x: (vw - w) / 2, y: midY, w, h },
      { x: sf.left, y: midY, w, h }, { x: vw - sf.right - w, y: midY, w, h },
      { x: (vw - w) / 2, y: sf.top, w, h }, { x: (vw - w) / 2, y: vh - sf.bottom - h, w, h },
    ];
    const scrolls = (v.full ?? v.h) > h + 1;
    spots.forEach((r, i) => {
      const o = core ? inter(r, core) / Math.max(1, area(core)) : 0, b = bars.reduce((a, q) => a + inter(r, q), 0);
      const s = o * 100 + b * 0.01 + i * 0.5 + (v.cost ?? v.i * 0.3) + (scrolls ? (1 - h / Math.max(1, v.full ?? h)) * 1.5 : 0);
      if (s < bs) { bs = s; best = r; bi = v.i; bScroll = scrolls; }
    });
  }
  const o = core ? inter(best, core) / Math.max(1, area(core)) : 0;
  return { rect: best, overlapCore: o, ok: o < 0.05 && !stuck, variant: bi, scrolls: bScroll, refused: vs.refused, ...(stuck ? { reason: 'type-floor' as const } : {}) };
}
