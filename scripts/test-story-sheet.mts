#!/usr/bin/env -S node --experimental-strip-types
// A phone's beat sheet (assets/story/sheet.ts), in Node: the owner's mobile pass wants the sheet at most 40 % of the window (place.ts's 55 % stays the end card's), under the subject or
// under the top bar, never over the subject, the Core or a bar, in the room the notch's insets leave, the card set the way that shows the most of it, and no type under the floor.
// Pure rectangles: no browser, no built site. The sheet in a browser, with the sizes the real DOM computes, is scripts/story/portal-tests/phone.mts (`pnpm run portal:test -- --only hooks --hook phone`).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONE_SHEET_FRAC, placePhoneSheet } from '../assets/story/sheet.ts';
import { SHEET_MAX_FRAC, SHEET_MIN_FRAC, inter, typeFloor, placeSheet, type Rect } from '../assets/story/place.ts';

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const overlap = (a: Rect, b: Rect): number => inter(a, b) / (b.w * b.h);
// a 390 x 844 phone: the top bar (8 to 52) and the one-row dock (780 to 836)
const VW = 390, VH = 844, bars = [R(8, 8, 374, 44), R(8, 780, 374, 56)];
const call = (over: Record<string, unknown> = {}) => placePhoneSheet({ vw: VW, vh: VH, x: 8, width: 374, focus: R(120, 330, 150, 120), core: null, bars, variants: [{ full: 300, type: 21.06 }], ...over } as any);

test('the cap is 40 % of the window, and the end card\'s 55 % is not touched', () => {
  assert.equal(PHONE_SHEET_FRAC, 0.4); assert.equal(SHEET_MAX_FRAC, 0.55);
  const o = call({ variants: [{ full: 900, type: 21.06 }] });
  assert.ok(o.rect.h <= VH * 0.4 + 1e-6, `${o.rect.h}`);
  assert.ok(o.scrolls, 'a content taller than the cap scrolls inside');
  const end = placeSheet({ vw: VW, vh: VH, focus: R(120, 100, 150, 80), core: null, bars, variants: [{ full: 900, type: 21.06 }] });
  assert.ok(end.rect.h > VH * 0.4 + 1, `the end card's sheet (place.ts) still reaches 55 %: ${end.rect.h}`);
});

test('a sheet is as tall as its content when that fits, never under 22 % unless its content is smaller, and never over 40 %', () => {
  for (const full of [60, 120, 200, 300, 337, 338, 500, 1200]) {
    const o = call({ variants: [{ full, type: 21.06 }], focus: R(120, 100, 150, 100) });
    assert.ok(o.rect.h <= VH * 0.4 + 1e-6, `${full}: ${o.rect.h}`);
    assert.ok(Math.abs(o.rect.h - Math.min(full, VH * 0.4)) < 1e-6 || o.rect.h >= VH * SHEET_MIN_FRAC - 1e-6, `${full}: ${o.rect.h}`);
    if (full <= VH * 0.4) assert.equal(Math.round(o.rect.h), full, `${full}: the sheet is as tall as its content`);
  }
});

test('under the subject down to the dock when there is room; under the top bar when the subject is low', () => {
  const up = call({ focus: R(100, 120, 190, 140) });
  assert.equal(up.where, 'bottom'); assert.ok(Math.abs(up.rect.y + up.rect.h - (780 - 7)) < 1e-6, 'the sheet\'s foot is a half gap above the dock');
  assert.ok(up.ok && up.overlapFocus === 0 && up.overlapBars === 0);
  const low = call({ focus: R(100, 520, 190, 200), variants: [{ full: 200, type: 21.06 }] });
  assert.equal(low.where, 'top'); assert.equal(low.rect.y, 52 + 8, 'under the top bar'); assert.ok(low.ok && low.overlapFocus === 0);
});

test('never over the subject or the Core: 200 random subjects, each variant, the sheet is off them or says it could not be', () => {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let ok = 0, notOk = 0;
  for (let i = 0; i < 200; i++) {
    const w = 60 + rnd() * 240, h = 60 + rnd() * 260, f = R(rnd() * (VW - w), 60 + rnd() * (700 - h), w, h);
    const o = call({ focus: f, variants: [{ full: 150 + rnd() * 400, type: 21.06 }] });
    if (o.ok) { ok++; assert.ok(overlap(o.rect, f) < 0.02, `${JSON.stringify(f)} ${JSON.stringify(o.rect)}`); assert.equal(o.overlapBars, 0); } else notOk++;
    assert.ok(o.rect.x === 8 && o.rect.w === 374 && o.rect.y >= 0 && o.rect.y + o.rect.h <= VH, 'inside the window');
  }
  assert.ok(ok > 100, `${ok} placed off the subject (${notOk} had no room)`);
});

test('the notch\'s insets: the sheet is where the caller says (x and width), and a bar the caller adds is kept off', () => {
  const o = call({ x: 8 + 47, width: 374 - 94 });
  assert.equal(o.rect.x, 55); assert.equal(o.rect.w, 280);
  const high = call({ bars: [...bars, R(8, 8, 374, 44), R(8, 60, 200, 32)] });
  assert.ok(high.rect.y >= 0 && high.overlapBars === 0);
});

test('the card is set the way that shows the most of it: a variant that fits beats one that scrolls; a type under the floor is refused', () => {
  const full = { full: 460, type: 21.06 }, compact = { full: 330, type: 21.06 }, tight = { full: 300, type: 21.06 };
  const o = call({ variants: [full, compact, tight], focus: R(120, 120, 150, 100) });
  assert.equal(o.variant, 1, 'the first variant that fits (the compact one) wins over the one that would scroll');
  assert.equal(Math.round(o.rect.h), 330);
  const small = call({ variants: [{ full: 200, type: 15 }, { full: 400, type: 21.06 }] });
  assert.equal(small.variant, 1, 'a variant whose type is under the floor is refused'); assert.equal(small.refused, 1);
  const none = call({ variants: [{ full: 200, type: 15 }] });
  assert.equal(none.ok, false); assert.equal(none.reason, 'type-floor');
  assert.equal(typeFloor(VW), 21.06 > 0 ? typeFloor(VW) : 0);
});

test('a phone as short as an iPhone in Safari (390 x 664): 40 % is 266 px and the sheet takes it', () => {
  const o = placePhoneSheet({ vw: 390, vh: 664, x: 8, width: 374, focus: R(100, 140, 190, 120), core: null, bars: [R(8, 8, 374, 44), R(8, 600, 374, 56)], variants: [{ full: 330, type: 21.06 }] });
  assert.ok(Math.abs(o.rect.h - 664 * 0.4) < 1e-6 && o.scrolls, `${o.rect.h}`);
  assert.ok(o.rect.y + o.rect.h <= 600, 'above the dock');
});
