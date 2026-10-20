#!/usr/bin/env -S node --experimental-strip-types
// The placement solver's type floor and card widths (assets/story/place.ts), in Node. The owner asked for a 36 px text minimum and then, seeing it, said it was 30 percent too big
// "reference the website": the scale is now the CI canon's, rem of the org-wide 17 px root. A card never shrinks its type to fit: the solver is offered VARIANTS of the card (the card
// at its width, the same with tighter padding, a narrower and so taller one ...), each with the smallest type in it, and refuses a variant whose type is under the floor: 1.5rem =
// 25.5 px from 768 px up, clamp(20px, 5.4vw, 25.5px) on a phone. Among the rest it finds the slot and the variant that keep off the subject: another slot, a taller (narrower) card,
// tighter padding, or a panel docked at the edge; on a phone a full-width sheet of up to 55 % of the height that takes the room under (or over) the subject. The card is
// clamp(420px, 32vw, 560px) wide. The film's canvases keep their 36 design px (CANVAS_TYPE_MIN) and pass no type, which is not judged. Pure rectangles: no browser, no built site.
// The tour in a browser, with the sizes the real DOM computes, is scripts/story/portal-tests/typography.mts and player.mts (`pnpm run portal:test -- --only hooks`).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT_PX, TYPE_MIN, PHONE_TYPE_MIN, PHONE_TYPE_VW, CANVAS_TYPE_MIN, TABLET_MIN_WIDTH, PHONE_MAX_WIDTH, SHEET_MAX_FRAC, SHEET_MIN_FRAC, CARD_MIN_PX, CARD_MAX_PX, CARD_VW, typeFloor, cardWidth, panelWidths, sheetLayout, placePopup, placeSheet, placeEndCard, inter, MAX_OVERLAP, type Rect, type CardSize } from '../assets/story/place.ts';

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const overlap = (a: Rect, focus: Rect): number => inter(a, focus) / (focus.w * focus.h);
const near = (a: number, b: number, eps = 0.01): boolean => Math.abs(a - b) < eps;

test('the type floor is the canon\'s: 1.5rem of the 17 px root (25.5 px) from 768 px up, clamp(20px, 5.4vw, 25.5px) below', () => {
  assert.equal(ROOT_PX, 17); assert.equal(TYPE_MIN, 25.5); assert.equal(PHONE_TYPE_MIN, 20); assert.equal(PHONE_TYPE_VW, 0.054);
  assert.equal(TABLET_MIN_WIDTH, 768); assert.equal(PHONE_MAX_WIDTH, 767);
  assert.equal(CANVAS_TYPE_MIN, 36, 'a film canvas keeps the first brief\'s 36 design px (a 1080 px canvas is shown about 390 px wide on a phone)');
  for (const vw of [768, 820, 1024, 1440, 1920, 1080, 2560]) assert.equal(typeFloor(vw), 25.5, `${vw}`);
  assert.ok(near(typeFloor(390), 21.06), `a 390 px phone: 5.4 % of the width is 21.06 px (${typeFloor(390)})`);
  assert.equal(typeFloor(320), 20); assert.equal(typeFloor(360), 20, '5.4 % of 360 is 19.4: the token never goes under 20');
  assert.ok(near(typeFloor(430), 23.22), 'a bigger phone: 5.4 % of 430');
  assert.equal(typeFloor(473), 25.5, 'from about 472 px up the phone token is the full 25.5 px'); assert.equal(typeFloor(767), 25.5);
  for (let vw = 300; vw < 800; vw += 7) assert.ok(typeFloor(vw) >= 20 && typeFloor(vw) <= 25.5, `${vw}`);
});

test('a window takes a sheet under 768 px, and when it is a tablet held upright; a wide one takes a card or a panel', () => {
  assert.equal(sheetLayout(390, 844), true); assert.equal(sheetLayout(767, 600), true);
  assert.equal(sheetLayout(768, 1024), true, 'a tablet upright: a card of 420 px is more than half of 768');
  assert.equal(sheetLayout(820, 1180), true);
  assert.equal(sheetLayout(1024, 768), false); assert.equal(sheetLayout(1440, 900), false); assert.equal(sheetLayout(1000, 1100), false, '1000 px wide is room enough for a card at the side');
});

test('a card is clamp(420px, 32vw, 560px) wide: 28 to 34 % of a desktop or tablet window; a narrower and taller one is the last resort', () => {
  assert.deepEqual([CARD_MIN_PX, CARD_MAX_PX, CARD_VW], [420, 560, 0.32]);
  assert.equal(cardWidth(1440), 461); assert.equal(cardWidth(1024), 420); assert.equal(cardWidth(1920), 560); assert.equal(cardWidth(2560), 560); assert.equal(cardWidth(1366), 437);
  for (let vw = 1240; vw <= 2000; vw += 20) { const f = cardWidth(vw) / vw; assert.ok(f >= 0.28 - 1e-9 && f <= 0.34 + 1e-9, `${vw}: ${(f * 100).toFixed(1)} %`); }
  assert.ok(cardWidth(500) <= 476, 'never wider than the window less a gutter');
  assert.deepEqual(panelWidths(1440), [461, 415, 369]);
  assert.deepEqual(panelWidths(1024), [420, 378], 'none goes under 360 px');
  assert.deepEqual(panelWidths(1920), [560, 504, 448]);
  assert.ok(panelWidths(1440).every((w, i, a) => i === 0 || w < a[i - 1]), 'the wanted width first, then narrower');
  assert.ok(panelWidths(1440, 400).every(w => w >= 400), 'a minimum width keeps a column readable');
});

const bars = [R(0, 0, 1440, 56), R(0, 800, 1440, 100)];
const safe = { top: 70, right: 12, bottom: 12, left: 12 };
/** the variants a caller offers: one card of each width, as tall as its content needs at that width (here: a fixed amount of text) */
const variantsAt = (vw: number, type = 25.5, textArea = 461 * 560): CardSize[] => panelWidths(vw).map((w, k) => ({ w, h: Math.min(706, Math.ceil(textArea / w)), full: Math.ceil(textArea / w), type, cost: k * 0.4, tag: `${Math.round(w / vw * 100)}%` }));

test('a variant whose type is under the floor is refused: nothing is placed ok, and the result says why', () => {
  const v = variantsAt(1440, 20);
  const p = placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: v[0], variants: v, safe });
  assert.equal(p.ok, false); assert.equal(p.reason, 'type-floor'); assert.equal(p.refused, v.length);
  assert.ok(p.rect.w > 0 && p.rect.h > 0, 'it still returns a rectangle (a caller has somewhere to draw, and the test above fails)');
  // exactly at the floor is fine; half a px under is not
  assert.equal(placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: variantsAt(1440, 25.5)[0], variants: variantsAt(1440, 25.5), safe }).ok, true);
  assert.equal(placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: variantsAt(1440, 25)[0], variants: variantsAt(1440, 25), safe }).ok, false);
  // the old 36 px is above the floor and still passes: the floor is a minimum
  assert.equal(placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: variantsAt(1440, 36)[0], variants: variantsAt(1440, 36), safe }).ok, true);
  // a film canvas (1080 px short edge) is held to its 36 design px the same way, by the floor the caller tells
  assert.equal(placePopup({ vw: 1080, vh: 1920, focus: R(300, 600, 400, 400), bars: [], card: { w: 560, h: 800, type: 30 }, floor: CANVAS_TYPE_MIN }).reason, 'type-floor');
  assert.equal(placePopup({ vw: 1080, vh: 1920, focus: R(300, 600, 400, 400), bars: [], card: { w: 560, h: 800, type: 36 }, floor: CANVAS_TYPE_MIN }).ok, true);
  // a phone's floor is the phone's (21.06 px at 390): 22 passes there, and the same type is under the floor at 1440
  assert.equal(placePopup({ vw: 390, vh: 844, focus: R(90, 150, 210, 220), bars: [R(0, 764, 390, 80)], card: { w: 374, h: 420, type: 22 } }).reason, undefined);
  assert.equal(placePopup({ vw: 390, vh: 844, focus: R(90, 150, 210, 220), bars: [R(0, 764, 390, 80)], card: { w: 374, h: 420, type: 20 } }).reason, 'type-floor');
  assert.equal(placePopup({ vw: 1440, vh: 900, focus: R(90, 150, 210, 220), bars, card: { w: 461, h: 420, type: 22 }, safe }).reason, 'type-floor');
  // the floor can be told (a caller that sets type in a different unit)
  assert.equal(placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: { w: 461, h: 420, type: 22 }, floor: 20, safe }).ok, true);
});

test('one refused variant does not stop the others: the solver places the one that clears the floor', () => {
  const v: CardSize[] = [{ w: 461, h: 500, type: 22, tag: 'small type' }, { w: 440, h: 520, type: 25.5, tag: 'floor' }];
  const p = placePopup({ vw: 1440, vh: 900, focus: R(200, 300, 300, 260), bars, card: v[0], variants: v, safe });
  assert.equal(p.variant, 1); assert.equal(p.refused, 1); assert.equal(p.ok, true); assert.equal(p.rect.w, 440);
});

test('padding may shrink, type may not: a variant with tighter padding wins when it takes away a scroll, and never when its type is under the floor', () => {
  const vw = 1440, vh = 900, focus = R(160, 280, 300, 300);
  const room = 800 - 8 - safe.top;                                                     // the room between the top bar and the dock (the solver's own safe area)
  const plain: CardSize = { w: 461, h: Math.min(room, 760), full: 760, type: 25.5, cost: 0, tag: 'plain' };
  const tight: CardSize = { w: 461, h: Math.min(room, 690), full: 690, type: 25.5, cost: 0.1, tag: 'tight' };
  const p = placePopup({ vw, vh, focus, bars, card: plain, variants: [plain, tight], safe });
  assert.ok(p.ok && p.variant === 1 && !p.scrolls, `tighter padding fits the room: variant ${p.variant}, scrolls ${p.scrolls}`);
  // content that fits either way keeps the plain padding
  const short: CardSize[] = [{ ...plain, h: 500, full: 500 }, { ...tight, h: 460, full: 460 }];
  assert.equal(placePopup({ vw, vh, focus, bars, card: short[0], variants: short, safe }).variant, 0);
  // a variant that shrank the type to fit is refused however well it would fit
  const small: CardSize = { ...tight, type: 20, tag: 'small type' };
  const q = placePopup({ vw, vh, focus, bars, card: plain, variants: [plain, small], safe });
  assert.equal(q.variant, 0); assert.equal(q.refused, 1);
});

test('a card is on the side the subject leaves free, at the widest width that keeps off it, and never in smaller type', () => {
  const vw = 1440, vh = 900, W = cardWidth(vw);
  // the subject in the left third: the card docks on the right at the wanted width
  const L = placePopup({ vw, vh, focus: R(160, 280, 300, 300), bars, card: variantsAt(vw)[0], variants: variantsAt(vw), safe });
  assert.ok(L.ok && L.variant === 0 && L.rect.x > 460, `left subject: ${JSON.stringify(L.rect)}`);
  assert.equal(L.rect.w, W); assert.ok(L.rect.w >= 0.28 * vw && L.rect.w <= 0.34 * vw, 'about a third of the window');
  const Rt = placePopup({ vw, vh, focus: R(980, 300, 300, 260), bars, card: variantsAt(vw)[0], variants: variantsAt(vw), safe });
  assert.ok(Rt.ok && Rt.rect.x + Rt.rect.w < 980, `right subject: ${JSON.stringify(Rt.rect)}`);
  // a subject so wide that neither side leaves the full width takes a narrower, taller card, with the same type
  const mid = placePopup({ vw, vh, focus: R(480, 280, 500, 300), bars, card: variantsAt(vw)[0], variants: variantsAt(vw), safe });
  assert.ok(mid.ok && mid.variant > 0 && mid.rect.w < W && mid.rect.w >= 360, `a wide subject: variant ${mid.variant}, ${JSON.stringify(mid.rect)}`);
  assert.equal(mid.refused, 0);
  // the card is no taller than the room between the top bar and the dock
  for (const p of [L, Rt, mid]) assert.ok(p.rect.y >= safe.top - 0.5 && p.rect.y + p.rect.h <= 800 - 8 + 0.5, `${p.slot} ${JSON.stringify(p.rect)}`);
  // content taller than the room scrolls inside, and the placement says so
  const tall = variantsAt(vw, 25.5, 461 * 1200);
  const t = placePopup({ vw, vh, focus: R(160, 280, 300, 300), bars, card: tall[0], variants: tall, safe });
  assert.ok(t.scrolls && t.rect.h <= 800 - 8 - safe.top + 0.5, 'a long card is as tall as the room and scrolls');
});

test('across a sweep of subjects the card keeps under 2 % off the subject whenever there is room, at 1440, 1280 and 1024', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (const [vw, vh] of [[1440, 900], [1024, 768], [1280, 720]] as const) {
    const b = [R(0, 0, vw, 56), R(0, vh - 100, vw, 100)], sf = { top: 70, right: 12, bottom: 12, left: 12 };
    const v = variantsAt(vw, 25.5, cardWidth(vw) * 520), W = cardWidth(vw);
    let tried = 0, clear = 0;
    for (let i = 0; i < 300; i++) {
      const w = 60 + rnd() * 0.30 * vw, h = 60 + rnd() * 0.40 * vh, f = R(rnd() * (vw - w), 70 + rnd() * (vh - 170 - h), w, h);
      const room = Math.max(f.x, vw - f.x - f.w) - 24;                     // the width of the freest side of the frame
      const p = placePopup({ vw, vh, focus: f, bars: b, card: v[0], variants: v, safe: sf });
      tried++;
      if (room >= W + 2 * 0.06 * f.w) { clear++; assert.ok(overlap(p.rect, f) < MAX_OVERLAP && p.ok, `${vw}x${vh} #${i}: ${(overlap(p.rect, f) * 100).toFixed(1)} % of ${JSON.stringify(f)} covered by ${JSON.stringify(p.rect)} (${p.slot}, variant ${p.variant})`); }
      for (const q of b) assert.equal(inter(p.rect, q), 0, 'a bar is touched');
    }
    assert.ok(clear > 100, `${vw}: ${clear} of ${tried} subjects had room`);
  }
});

test('a lone legacy card keeps the twelve slots it always had; the edge slots are for a card offered as variants (or asked for)', () => {
  let seed = 777;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const wide = [R(100, 300, 900, 300), R(300, 200, 800, 500), R(200, 150, 1000, 500), R(80, 250, 760, 330), R(500, 200, 840, 400)];
  const subjects = [...wide, ...Array.from({ length: 150 }, () => { const w = 60 + rnd() * 700, h = 60 + rnd() * 400; return R(rnd() * (1440 - w), 70 + rnd() * (800 - 70 - h), w, h); })];
  const lone = new Set<string>(), offered = new Set<string>(), asked = new Set<string>(), v = variantsAt(1440);
  for (const f of subjects) {
    lone.add(placePopup({ vw: 1440, vh: 900, focus: f, bars, card: { w: 461, h: 500 }, safe }).slot);
    offered.add(placePopup({ vw: 1440, vh: 900, focus: f, bars, card: v[0], variants: v, safe }).slot);
    asked.add(placePopup({ vw: 1440, vh: 900, focus: f, bars, card: { w: 461, h: 500 }, safe, edge: true }).slot);
    assert.ok(placePopup({ vw: 1440, vh: 900, focus: f, bars, card: v[0], variants: v, safe, edge: false }).slot !== 'l' && placePopup({ vw: 1440, vh: 900, focus: f, bars, card: v[0], variants: v, safe, edge: false }).slot !== 'r', '`edge: false` turns them off');
  }
  assert.ok(!lone.has('l') && !lone.has('r'), `a lone card never docks at the middle of an edge (${[...lone].join(' ')})`);
  assert.ok(offered.has('l') || offered.has('r'), `a card offered as variants may, for a subject too wide to sit beside (${[...offered].join(' ')})`);
  assert.ok(asked.has('l') || asked.has('r'), 'and `edge: true` asks for it on a lone card');
});

test('the same rects give the same placement', () => {
  const v = variantsAt(1440);
  const a = placePopup({ vw: 1440, vh: 900, focus: R(560, 300, 320, 260), bars, card: v[0], variants: v, safe });
  assert.deepEqual(a, placePopup({ vw: 1440, vh: 900, focus: R(560, 300, 320, 260), bars, card: v[0], variants: v, safe }));
});

// ---- the phone's sheet -----------------------------------------------------------------------------------------------------------------
const pbars = [R(8, 8, 44, 46), R(60, 8, 140, 46), R(208, 8, 174, 46), R(0, 764, 390, 80)];
test('a phone\'s sheet is up to 55 % of the height and takes the room under the subject, never the subject', () => {
  assert.equal(SHEET_MAX_FRAC, 0.55); assert.ok(SHEET_MIN_FRAC > 0.15 && SHEET_MIN_FRAC < 0.3);
  const vw = 390, vh = 844, T = 22;
  // a subject high in the frame (the compose puts it there): the sheet is as tall as its content, up to 55 %
  const hi = placeSheet({ vw, vh, focus: R(90, 80, 210, 140), bars: pbars, variants: [{ full: 420, type: T }] });
  assert.ok(hi.ok && hi.where === 'bottom' && hi.rect.h === 420 && !hi.scrolls, `${JSON.stringify(hi.rect)}`);
  const long = placeSheet({ vw, vh, focus: R(90, 80, 210, 140), bars: pbars, variants: [{ full: 900, type: T }] });
  assert.ok(long.ok && long.rect.h <= vh * 0.55 + 1e-6 && long.rect.h > vh * 0.5 && long.scrolls, `a long card is held to 55 % and scrolls: ${JSON.stringify(long.rect)}`);
  assert.ok(long.rect.y + long.rect.h <= 764, 'above the dock');
  // a subject lower in the frame leaves less room under it: the sheet takes only that and scrolls inside
  const lo = placeSheet({ vw, vh, focus: R(90, 150, 210, 300), bars: pbars, variants: [{ full: 600, type: T }] });
  assert.ok(lo.ok && overlap(lo.rect, R(90, 150, 210, 300)) === 0 && lo.rect.y >= 450 && lo.scrolls, `${JSON.stringify(lo.rect)}`);
  // a subject so low there is no room under it: the sheet goes under the top bar instead
  const low = placeSheet({ vw, vh, focus: R(60, 480, 270, 240), bars: pbars, variants: [{ full: 600, type: T }] });
  assert.ok(low.ok && low.where === 'top' && low.rect.y < 100 && overlap(low.rect, R(60, 480, 270, 240)) === 0, `${low.where} ${JSON.stringify(low.rect)}`);
  // the Core is a subject too
  const core = placeSheet({ vw, vh, focus: R(90, 80, 210, 140), core: R(100, 300, 180, 140), bars: pbars, variants: [{ full: 600, type: T }] });
  assert.ok(core.ok && inter(core.rect, R(100, 300, 180, 140)) === 0, `${JSON.stringify(core.rect)}`);
  // no subject: the sheet takes the most it can
  assert.ok(placeSheet({ vw, vh, focus: null, bars: pbars, variants: [{ full: 900, type: T }] }).rect.h > vh * 0.5);
  // a tablet held upright (768 x 1024): the sheet is wider, the floor is the full 25.5
  const tab = placeSheet({ vw: 768, vh: 1024, focus: R(200, 120, 360, 260), bars: [R(8, 8, 752, 46), R(0, 940, 768, 84)], variants: [{ full: 700, type: 25.5 }] });
  assert.ok(tab.ok && tab.rect.w === 752, `${JSON.stringify(tab.rect)}`);
  assert.equal(placeSheet({ vw: 768, vh: 1024, focus: R(200, 120, 360, 260), bars: [R(8, 8, 752, 46), R(0, 940, 768, 84)], variants: [{ full: 700, type: 21 }] }).reason, 'type-floor', '21 px type on a 768 px window is under its floor');
});

test('a sheet chooses between ways to set the card by what it shows, and refuses one under the floor', () => {
  const vw = 390, vh = 844, focus = R(90, 150, 210, 270);
  // with a phone drawing (taller) or without it (shorter): the room is the same, so the shorter one shows more of itself and wins; the type is never touched
  const v = [{ full: 700, type: 22, tag: 'full' }, { full: 420, type: 22, tag: 'compact' }];
  const p = placeSheet({ vw, vh, focus, bars: pbars, variants: v });
  assert.equal(p.variant, 1); assert.ok(p.ok && p.refused === 0);
  // when there is room for all of the full card, it keeps the drawing
  assert.equal(placeSheet({ vw, vh, focus: R(90, 80, 210, 100), bars: pbars, variants: [{ full: 400, type: 22 }, { full: 300, type: 22 }] }).variant, 0);
  // a "tight" variant that shrank the type to fit is refused, however much of itself it would show
  const q = placeSheet({ vw, vh, focus, bars: pbars, variants: [{ full: 700, type: 22 }, { full: 300, type: 18, tag: 'shrunk' }] });
  assert.equal(q.variant, 0); assert.equal(q.refused, 1);
});

test('the end card is placed in the room between the bars, off the Core, at the widest width that fits, and never in smaller type', () => {
  const vw = 1440, vh = 900, core = R(560, 350, 320, 200), sf = { top: 70, right: 12, bottom: 118, left: 12 };
  const v: CardSize[] = panelWidths(vw).map(w => ({ w, h: 706, full: Math.ceil(461 * 1100 / w), type: 25.5 }));
  const e = placeEndCard({ vw, vh, card: v[0], variants: v, core, safe: sf });
  assert.ok(e.ok && e.overlapCore < 0.05 && e.rect.y >= sf.top - 0.5 && e.rect.y + e.rect.h <= vh - sf.bottom + 0.5, `${JSON.stringify(e.rect)}`);
  assert.ok(e.rect.x <= 12.5 || e.rect.x + e.rect.w >= vw - 12.5, 'at a side: a card this wide would cover the Core in the middle');
  const bad = placeEndCard({ vw, vh, card: { ...v[0], type: 22 }, variants: v.map(x => ({ ...x, type: 22 })), core, safe: sf });
  assert.equal(bad.ok, false); assert.equal(bad.reason, 'type-floor'); assert.equal(bad.refused, v.length);
  // the legacy call (a lone card, no type said) is placed as it always was
  const old = placeEndCard({ vw, vh, card: { w: 520, h: 300 }, core: R(560, 350, 320, 200) });
  assert.ok(old.ok && old.overlapCore < 0.05 && old.reason === undefined);
});

test('a legacy call (a card with no type and no variants) is placed as before, and a phone gets its sheet', () => {
  const p = placePopup({ vw: 1440, vh: 900, focus: R(160, 280, 300, 300), bars, card: { w: 380, h: 190 } });
  assert.equal(p.mode, 'card'); assert.ok(p.ok && p.refused === 0 && p.variant === 0 && p.reason === undefined);
  const s = placePopup({ vw: 390, vh: 844, focus: R(90, 150, 210, 220), bars: [R(0, 0, 390, 56), R(0, 764, 390, 80)], card: { w: 380, h: 900 } });
  assert.equal(s.mode, 'sheet'); assert.ok(s.rect.h <= 844 * 0.55 + 1e-6 && s.rect.y + s.rect.h <= 764);
});
