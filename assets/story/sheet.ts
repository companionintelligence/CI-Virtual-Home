// A phone's beat sheet: where it goes and how tall it may be, as a pure function of rectangles (pixels, y down). THREE-free, DOM-free; scripts/test-story-sheet.mts runs it in Node.
//
// This is place.ts's `placeSheet` (the same room, the same cost, the same four ways of setting the card) with two differences the owner's mobile pass asked for, which is why it is a module of
// its own: the height cap is `PHONE_SHEET_FRAC` (40 % of the window, where place.ts's SHEET_MAX_FRAC is 55 % and stays the end card's), and the sheet's horizontal extent is the caller's (a notch
// at either end of a phone on its side takes room from it). place.ts is hashed into the film's pin (`toolSha`), so it is not edited; nothing here is imported by the film or the offline renderer.
//
// The sheet takes the room UNDER the subject down to the dock, or the room under the top bar down to the subject (above it), whichever shows more of the card, and never covers the subject, the Core
// or a bar unless neither side has the room (then it covers the least it can and `ok` says so). Its height is what its content needs, at most the cap, at least 22 % of the window
// (SHEET_MIN_FRAC) or its content; a taller content scrolls inside. A variant (the card with its phone drawing, without it, with tighter padding, both) whose type is under the floor is refused.
import { inter, MAX_OVERLAP, SHEET_MIN_FRAC, typeFloor, type Rect, type SheetVariant, type SheetOut } from './place.js';

/** A phone's beat sheet is at most this share of the window's height (the end card's sheet keeps place.ts's SHEET_MAX_FRAC, 55 %). */
export const PHONE_SHEET_FRAC = 0.4;
/** The gap kept between the sheet and the dock (half of it above the dock, as place.ts's `gap / 2`) and between the sheet and the subject. */
const GAP = 14;
/** The tolerance when a variant's measured type is compared with the floor (the browser's computed sizes carry float noise): place.ts's. */
const TYPE_EPS = 0.06;

export type PhoneSheetInput = {
  vw: number; vh: number;
  /** the sheet's left edge and width, px (the window less a gutter and the safe area's insets) */
  x: number; width: number;
  focus: Rect | null; core?: Rect | null; bars?: Rect[];
  /** ways to set the sheet, most wanted first; `full` is the height the content needs at `width` */
  variants: SheetVariant[];
  /** the smallest type a sheet may use, px (default `typeFloor(vw)`) */
  floor?: number;
  /** the share of the window's height the sheet may take (default PHONE_SHEET_FRAC) */
  frac?: number;
};

const area = (r: Rect): number => Math.max(0, r.w) * Math.max(0, r.h);

export function placePhoneSheet(inp: PhoneSheetInput): SheetOut {
  const { vh } = inp, bars = inp.bars || [], focus = inp.focus, core = inp.core || null;
  const floor = inp.floor ?? typeFloor(inp.vw), cap40 = vh * (inp.frac ?? PHONE_SHEET_FRAC);
  const dock = bars.filter(b => b.y > vh * 0.5).reduce((m, b) => Math.min(m, b.y), vh - 12);
  const bottomEdge = dock - GAP / 2;
  const topEdge = bars.filter(b => b.y < vh * 0.4).reduce((m, b) => Math.max(m, b.y + b.h), 0) + 8;
  const blocks = [focus, core].filter(Boolean) as Rect[];
  const below = blocks.reduce((m, r) => Math.max(m, r.y + r.h), topEdge), above = blocks.reduce((m, r) => Math.min(m, r.y), bottomEdge);
  const overlap = (r: Rect) => ({
    overlapFocus: focus ? inter(r, focus) / Math.max(1, area(focus)) : 0,
    overlapCore: core ? inter(r, core) / Math.max(1, area(core)) : 0,
    overlapBars: bars.reduce((a, b) => a + inter(r, b), 0) / Math.max(1, area(r)),
  });
  const clampH = (room: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, room));
  const vs = inp.variants.map((v, i) => ({ ...v, i, full: Math.max(1, v.full) }));
  const allowed = vs.filter(v => v.type === undefined || v.type + TYPE_EPS >= floor), stuck = !allowed.length, pool = stuck ? [vs[0]] : allowed;
  let best: SheetOut | null = null, bestCost = Infinity;
  for (const v of pool) {
    const cap = Math.min(cap40, v.full), lo = Math.min(cap, vh * SHEET_MIN_FRAC);
    const hb = clampH(bottomEdge - below, lo, cap), ht = clampH(above - GAP - topEdge, lo, cap);
    for (const where of ['bottom', 'top'] as const) {
      const h = where === 'bottom' ? hb : ht;
      const rect: Rect = { x: inp.x, y: where === 'bottom' ? bottomEdge - h : topEdge, w: inp.width, h };
      const m = overlap(rect), good = m.overlapFocus < MAX_OVERLAP && m.overlapCore < MAX_OVERLAP && m.overlapBars === 0;
      // an ok placement costs the share of its content it cannot show (and a little for the top, and for a later variant); one that covers the subject costs far more
      const cost = good ? (1 - h / v.full) + (where === 'top' ? 0.04 : 0) + v.i * 0.05 : 10 + m.overlapFocus + m.overlapCore + m.overlapBars * 10 + v.i * 0.01;
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = { slot: 'sheet', mode: 'sheet', rect, leader: null, ...m, ok: good && !stuck, score: -cost, variant: v.i, scrolls: v.full > h + 1, refused: vs.length - allowed.length, where, ...(stuck ? { reason: 'type-floor' as const } : {}) };
      }
    }
  }
  return best!;
}
