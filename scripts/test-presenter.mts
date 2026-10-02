#!/usr/bin/env -S node --experimental-strip-types
// The XR presenter's pure parts, in Node: where a card goes (place-world.ts), how big things are (presenter.ts XR_LEGIBILITY with paint.ts),
// where a ray meets a panel (hit.ts), how a panel follows the head (caption.ts) and the contrast of everything the kit paints.
// Needs `pnpm run build` (it imports assets/xr/ui/*.js); no GPU, no browser, under a second.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-presenter.mts
//
//   T-P1  placeWorld over synthetic heads at eye heights 1.2 and 1.6 m in a walled room: a card that is placed overlaps the subject and the Core
//         by under 2 percent, sits inside the view cone, has a clear line from the head and its corners in air; 2000 random heads never throw
//         and always return finite numbers
//   T-P3  sizes: emMetres is never under minEmDeg; the card is 22 to 40 degrees wide at every text scale; a 30-word body fits at 1.4 degrees at
//         every text scale (laid out with paint.ts's estimate of Manrope's widths, said so: the headset test measures the real canvas)
//   plus: the panel basis equals three.js's rotation order YXZ; a ray meets a panel where the maths says; the lazy follow does not move inside its
//         dead zone and arrives within a second outside it; every text/backing pair is 7:1; pixels per degree from a projection; settings sanity
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emMetres, metresAt, MAX_OVERLAP, XR_BUDGET, XR_COMFORT, XR_LEGIBILITY, type Box6, type PlaceWorldInput, type V3, type WorldProbe, type BeatView, type Disclosure } from '../assets/xr/presenter.js';
import { chordM, cardWidthDeg, placeWorld, reportPlacement, viewAngles, VIEW_CONE, type PlaceDebug } from '../assets/xr/ui/place-world.js';
import { panelBasis, rayPanel, rectAt } from '../assets/xr/ui/hit.js';
import { approxMeasure, cardAspectAt, contrastRatio, layoutBeatCard, layoutBeatCardFit, layoutCaption, MAX_CARD_DEG, layoutEndCard, layoutStartCard, makeMetrics, memberFill, textPairs, THEMES, wrapText, fontOf } from '../assets/xr/ui/paint.js';
import { followStep, lockedPose, newFollow, FOLLOW } from '../assets/xr/ui/caption.js';
import { createSettings, ppdOfEye, texelsPerDegFor, DEFAULT_SETTINGS } from '../assets/xr/ui/kit.js';

const ROOT = path.resolve(import.meta.dirname, '..');
let bad = 0, n = 0;
const check = (ok: boolean, what: string, detail = '') => { n++; console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };
const section = (s: string) => console.log(`\n${s}`);

// ---- a small seeded random so a failure reproduces (mulberry32)
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- a synthetic world: a 6 x 5 m room, walls 0.15 thick, a 2.6 m ceiling slab
const WALL = 0.15;
const ROOM: Box6[] = [
  [-3 - WALL, 0, -2.5 - WALL, 3 + WALL, 2.6, -2.5],      // north
  [-3 - WALL, 0, 2.5, 3 + WALL, 2.6, 2.5 + WALL],         // south
  [-3 - WALL, 0, -2.5, -3, 2.6, 2.5],                     // west
  [3, 0, -2.5, 3 + WALL, 2.6, 2.5],                       // east
  [-3 - WALL, 2.6, -2.5 - WALL, 3 + WALL, 2.75, 2.5 + WALL],   // ceiling
];
function segBox(a: V3, b: V3, bx: Box6): boolean {   // the slab method: does the segment ab cross the box?
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) { if (a[i] < bx[i] || a[i] > bx[i + 3]) return false; continue; }
    let u0 = (bx[i] - a[i]) / d, u1 = (bx[i + 3] - a[i]) / d; if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return false;
  }
  return true;
}
const same = (a: Box6, b: Box6) => a.every((v, i) => v === b[i]);
const world: WorldProbe = {
  floorY: () => 0, walkable: (x, z) => Math.abs(x) < 2.8 && Math.abs(z) < 2.3, roomAt: () => ({ room: 'room', level: null, indoors: true }),
  segmentClear: (a, b, ignore = []) => !ROOM.some(bx => !ignore.some(i => same(i, bx)) && segBox(a, b, bx)),
  hull: () => ROOM, nearestStand: () => null,
};
const TV: BeatView['anchor'] = { role: 'screen', box: [-0.6, 0.8, -2.45, 0.6, 1.5, -2.35], focus: [0, 1.15, -2.4], level: null };
const CORE = { box: [1.8, 0, -1.2, 2.2, 0.9, -0.8] as Box6, centre: [2.0, 0.45, -1.0] as V3 };

function input(head: V3, yawRad: number, o: Partial<PlaceWorldInput> = {}): PlaceWorldInput {
  return {
    head, headYaw: yawRad, eyeHeight: head[1], anchor: TV, core: CORE, cardAspect: 1.05, textScale: 1, world,
    reservedDeg: [{ x0: -17, x1: 17, y0: -22, y1: -11 }], ...o,
  };
}
const yawTo = (from: V3, to: V3) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
const finite = (v: number[]) => v.every(Number.isFinite);

const thirtyWords = 'Mia asks her companion for last summer, and the photos she took come up on the kitchen screen, with nothing sent anywhere, every one of them stays on this home.';
const mkBeat = (title: string, body: string, extra: Partial<BeatView['popup']> = {}): BeatView => ({
  index: 1, count: 12, id: 'b', chapter: { id: 'c', kind: 'room', title: 'The kitchen', index: 1, beat0: 1, beats: 3 },
  member: { id: 'm', name: 'Mia', initial: 'M', role: 'parent', colour: 'chart-2', companion: { name: 'Hermes', runtime: 'Hermes' } }, companion: { name: 'Hermes', runtime: 'Hermes' },
  say: { speaker: 'm', text: 'Here is the weekend at the lake.' }, popup: { kind: 'card', title, body, note: 'Everything stays on this home.', chips: ['Companion Memory', 'replaces Photos'], phone: null, ...extra },
  app: null, emphasis: { ring: true, wake: false }, narration: null, sayClip: null,
  anchor: TV, rest: { eye: [0, 1.6, 0], target: [0, 1, -2], fov: 60, level: null }, timing: { t0: 0, t1: 8, popupAt: 0, speechAt: 0, sayAt: null, readS: 6, narrationS: 6, sayS: 3 },
});
const disc: Disclosure = { fictional: 'Fictional family. Real software.', scripted: 's', stylised: 's', synthetic: 's', beta: 'b', signoff: 'UnCloud your life.' };

// =================================================================================================================== T-P1
section('T-P1  placeWorld');
{
  let facing = 0, facingSheets = 0, realCases = 0, realSheets = 0; let placed = 0, sheets = 0, worst = { focus: 0, core: 0, bars: 0 }, notClear = 0, offCone = 0, widthBad = 0, cases = 0, hullTouch = 0;
  const reasons: Record<string, number> = {};
  for (const eye of [1.2, 1.6]) {
    for (let x = -2.4; x <= 2.41; x += 0.6) {
      for (let z = -0.6; z <= 2.0; z += 0.65) {
        for (const jitter of [0, 22, -22]) for (const aspect of [1.05, 0.65, -1]) {
          const head: V3 = [x, eye, z];
          if (Math.hypot(head[0] - TV.focus[0], head[2] - TV.focus[2]) < 1.6) continue;     // a stand is never nearer than 1.6 m (XR budget)
          if (Math.hypot(head[0] - CORE.centre[0], head[2] - CORE.centre[2]) < 0.9) continue;   // not inside the Core
          const yaw = yawTo(head, TV.focus) + jitter * Math.PI / 180;
          // aspect -1: the real card (phone, note, chips, say, buttons at 100 percent), which the solver may widen
          const mt = makeMetrics({ texelsPerDeg: 30, distanceM: 1.7, textScale: 1, ppd: 20 });
          const cvFull = { beat: mkBeat('Photos find themselves', thirtyWords, { kind: 'phone', phone: { header: 'Last summer', rows: ['The lake, June 14', 'Dad on the dock', 'Sunset from the boat'] } }), disclosure: disc, canPrev: true, canNext: true };
          const real = aspect < 0, aspectAt = cardAspectAt(approxMeasure, cvFull, mt);
          const inp = input(head, yaw, { cardAspect: real ? aspectAt(32) : aspect });
          const dbg: PlaceDebug = { candidates: [], sheet: false };
          const out = placeWorld(inp, dbg, real ? { aspectAt } : {}), rep = reportPlacement(real ? { ...inp, cardAspect: aspectAt(out.widthDeg) } : inp, out);
          if (real) { realCases++; if (out.mode === 'sheet') realSheets++; }
          if (jitter === 0) { facing++; if (out.mode === 'sheet') facingSheets++; }
          cases++;
          if (out.mode === 'sheet') { sheets++; for (const c of dbg.candidates) if (!c.ok) reasons[c.why] = (reasons[c.why] || 0) + 1; continue; }
          placed++;
          worst.focus = Math.max(worst.focus, rep.overlapFocus); worst.core = Math.max(worst.core, rep.overlapCore); worst.bars = Math.max(worst.bars, rep.overlapBars);
          if (!rep.headToCardClear) notClear++;
          if ((rep.clearanceM ?? 1) < 0.03) hullTouch++;
          const [a, e] = viewAngles(head, yaw, out.centre);
          if (Math.abs(a) > VIEW_CONE.azHalf || e < VIEW_CONE.elMin || e > VIEW_CONE.elMax) offCone++;
          if ((rep.widthDeg ?? 0) < XR_LEGIBILITY.card.minDeg - 0.5 || (rep.widthDeg ?? 0) > XR_LEGIBILITY.card.maxDeg + 0.5) widthBad++;
          if (!finite([...out.centre, out.yaw, out.tiltDeg, out.widthM, out.heightM])) widthBad++;
          if (out.leader && !(finite(out.leader.from) && finite(out.leader.to))) widthBad++;
        }
      }
    }
  }
  console.log(`  ${cases} placements (heads at eye heights 1.2 and 1.6 m, cards 1.05 and 0.65 as wide as tall): ${placed} cards, ${sheets} sheets; worst overlap focus ${(worst.focus * 100).toFixed(2)} % core ${(worst.core * 100).toFixed(2)} % bars ${(worst.bars * 100).toFixed(2)} %`);
  check(cases > 100, `enough synthetic heads (${cases})`);
  check(worst.focus < MAX_OVERLAP && worst.core < MAX_OVERLAP && worst.bars < MAX_OVERLAP, `a placed card overlaps the subject, the Core and the caption area by under ${MAX_OVERLAP * 100} percent`);
  check(notClear === 0, 'every placed card has a clear line from the head', `${notClear} did not`);
  check(hullTouch === 0, 'every placed card stands at least 3 cm clear of the walls and ceiling', `${hullTouch} did not`);
  check(offCone === 0, 'every placed card is inside the view cone', `${offCone} were not`);
  check(widthBad === 0, `every card is ${XR_LEGIBILITY.card.minDeg} to ${XR_LEGIBILITY.card.maxDeg} degrees wide and every number is finite`, `${widthBad} were not`);
  check(facingSheets === 0, `after a blink the head faces the subject (yaw jitter 0): every one of ${facing} placements, tall real card included, finds a card beside the subject, never the sheet`);
  check(placed / cases >= 0.5, `with the head turned 22 degrees off the subject too, most placements still find a card (${Math.round(placed / cases * 100)} percent; the rest take the sheet, which is what it is for)`, JSON.stringify(reasons));
  // the sheet is the honest fallback: put the subject INSIDE the cone's whole width and the card cannot fit beside it
  const head: V3 = [0, 1.6, 1.2];
  const huge: BeatView['anchor'] = { role: 'wall', box: [-2.9, 0, -2.45, 2.9, 2.5, -2.35], focus: [0, 1.2, -2.4], level: null };
  const sh = placeWorld(input(head, 0, { anchor: huge, core: null })), shr = reportPlacement(input(head, 0, { anchor: huge, core: null }), sh);
  check(sh.mode === 'sheet' && sh.leader === null && shr.mode === 'sheet', 'a subject as wide as the room gets the sheet, with no leader');
  // behind a wall: a subject the head cannot see gets a dashed leader
  const hidden: BeatView['anchor'] = { role: 'x', box: [3.4, 0.8, -0.3, 3.7, 1.4, 0.3], focus: [3.55, 1.1, 0], level: null };   // outside the east wall
  const hh: V3 = [0, 1.6, 0], ho = placeWorld(input(hh, yawTo(hh, hidden.focus), { anchor: hidden, core: null }));
  check(ho.mode === 'card' ? !!ho.leader && ho.leader.dashed : true, 'the leader to a subject behind a wall is dashed');
  const seen = placeWorld(input([0, 1.6, 1.0], yawTo([0, 1.6, 1.0], TV.focus)));
  check(!!seen.leader && !seen.leader.dashed, 'the leader to a subject in plain sight is solid');
  // a finer check of the 2000 random heads
  const r = rng(20260930); let threw = 0, nonFinite = 0, sheetsR = 0;
  for (let i = 0; i < 2000; i++) {
    const head: V3 = [(r() - 0.5) * 9, 0.9 + r() * 1.1, (r() - 0.5) * 8], fx = (r() - 0.5) * 8, fz = (r() - 0.5) * 7;
    const sz = 0.05 + r() * 2.5, anchor: BeatView['anchor'] = { role: 'r', box: [fx - sz, r() * 1.5, fz - sz, fx + sz, 1.5 + r() * 1.5, fz + sz], focus: [fx, 1 + r(), fz], level: null };
    const core = r() < 0.6 ? { box: [fx + 1, 0, fz, fx + 1.4, 0.9, fz + 0.4] as Box6, centre: [fx + 1.2, 0.45, fz + 0.2] as V3 } : null;
    try {
      const inp = input(head, (r() - 0.5) * 7, { anchor, core, cardAspect: 0.3 + r() * 3, textScale: [1, 1.25, 1.5][Math.floor(r() * 3)], reservedDeg: r() < 0.5 ? [] : [{ x0: -17, x1: 17, y0: -22, y1: -11 }] });
      const out = placeWorld(inp), rep = reportPlacement(inp, out);
      if (out.mode === 'sheet') sheetsR++;
      if (!finite([...out.centre, out.yaw, out.tiltDeg, out.widthM, out.heightM, rep.overlapFocus, rep.overlapCore, rep.overlapBars, rep.distanceM ?? 0])) nonFinite++;
    } catch (e) { threw++; if (threw < 3) console.log('   threw:', (e as Error).message); }
  }
  check(threw === 0 && nonFinite === 0, `2000 random heads, subjects and aspect ratios: never throws, always finite (${sheetsR} sheets)`, `${threw} threw, ${nonFinite} non-finite`);
  // degenerate input: the head inside the subject, a zero-size subject, NaN-free but odd
  let ok = true; try { placeWorld(input([0, 1.6, -2.4], 0, { anchor: { role: 'x', box: [0, 0, 0, 0, 0, 0], focus: [0, 0, 0], level: null } })); placeWorld(input([0, 1.6, 0], 0, { cardAspect: 0 })); } catch { ok = false; }
  check(ok, 'a head on top of the subject and a zero aspect do not throw');
  // determinism: the same input twice is the same answer
  const i1 = input([0.3, 1.6, 1.4], 0.2), a1 = JSON.stringify(placeWorld(i1)), a2 = JSON.stringify(placeWorld(i1));
  check(a1 === a2, 'the same input gives the same placement');
}

// =================================================================================================================== T-P3
section('T-P3  sizes');
{
  let minSeen = Infinity, count = 0;
  for (const role of [XR_LEGIBILITY.minEmDeg, XR_LEGIBILITY.bodyEmDeg, XR_LEGIBILITY.captionEmDeg, XR_LEGIBILITY.titleEmDeg, XR_LEGIBILITY.headingEmDeg]) {
    for (const d of [0.9, 1.0, 1.7, 3.0]) for (const ts of [1, 1.25, 1.5]) for (const ppd of [6, 11, 15, 20, 25, 34, 60]) {
      const em = emMetres(role, d, ts, ppd), deg = Math.atan(em / d) * 180 / Math.PI; minSeen = Math.min(minSeen, deg); count++;
    }
  }
  check(minSeen >= XR_LEGIBILITY.minEmDeg - 1e-9, `emMetres never gives an em under ${XR_LEGIBILITY.minEmDeg} degrees (${count} combinations, least ${minSeen.toFixed(3)})`);
  check(Math.abs(emMetres(XR_LEGIBILITY.bodyEmDeg, 1.7, 1, 40) - metresAt(1.4, 1.7)) < 1e-9, 'body text at 1.7 m with a fine headset is exactly 1.4 degrees of em');
  check(emMetres(XR_LEGIBILITY.bodyEmDeg, 1.7, 1, 8) > metresAt(1.4, 1.7), 'a coarse headset (8 pixels per degree) raises the body em to the 16 pixel floor');
  for (const ts of [1, 1.25, 1.5]) { const w = cardWidthDeg(ts); check(w >= XR_LEGIBILITY.card.minDeg && w <= XR_LEGIBILITY.card.maxDeg, `the card is ${w.toFixed(1)} degrees wide at text scale ${ts} (22 to 40)`); }
  check(Math.abs(chordM(32, 1.7) - 2 * 1.7 * Math.tan(16 * Math.PI / 180)) < 1e-9, 'a 32 degree card at 1.7 m is 1.08 m across');

  // a 30-word body at 1.4 degrees fits, at every scale and density
  const thirty = thirtyWords;
  check(thirty.split(/\s+/).length === 30, 'the test body is 30 words');
  let worstRatio = 0;
  for (const ts of [1, 1.25, 1.5] as const) for (const ppd of [11, 20, 34]) {
    const m = makeMetrics({ texelsPerDeg: texelsPerDegFor(ppd), distanceM: 1.7, textScale: ts, ppd }), widthDeg = cardWidthDeg(ts), W = Math.round(widthDeg * m.texelsPerDeg);
    const L = layoutBeatCardFit(approxMeasure, { beat: mkBeat('Photos find themselves', thirty, { kind: 'phone', phone: { header: 'Last summer', rows: ['The lake, June 14', 'Dad on the dock', 'Sunset from the boat'] } }), disclosure: disc, canPrev: true, canNext: true }, m, W);
    const hDeg = L.h / m.texelsPerDeg, ratio = L.h / L.w; worstRatio = Math.max(worstRatio, ratio);
    check(!L.overflow && L.lines.body <= 12, `text scale ${ts}, ${ppd} px/deg: the 30-word body is ${L.lines.body} lines, nothing cut (card ${widthDeg.toFixed(0)} x ${hDeg.toFixed(0)} degrees)`);
    check(hDeg <= MAX_CARD_DEG + 8, `text scale ${ts}, ${ppd} px/deg: the whole card (phone, note, chips, say, buttons) is ${hDeg.toFixed(0)} degrees tall${L.texts.includes('Last summer') ? '' : ''}, under ${MAX_CARD_DEG + 8}`);
    if (ts === 1 && ppd === 20) {
      const body = L.ops.filter(o => o.k === 'text' && /^500 /.test(o.font) && o.fill === m.theme.text);
      const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec((body[0] as any)?.font || '')?.[1] || '0');
      check(Math.abs(px / m.texelsPerDeg - 1.4) < 0.02, `body text is ${(px / m.texelsPerDeg).toFixed(2)} degrees of em at 1.7 m (1.4 asked)`);
    }
    // targets: every widget is at least 5 cm and at least the ray target's angle at the panel's distance
    const unit = metresAt(1, 1.7);
    for (const w of L.widgets) if (w.h / m.texelsPerDeg * unit < 0.05 || w.h / m.texelsPerDeg < XR_LEGIBILITY.targetDeg.ray - 0.1) check(false, `${w.id}: target is ${(w.h / m.texelsPerDeg * unit * 100).toFixed(1)} cm`);
  }
  // the smallest text on a card is the chips and the footer: never under the floor
  { const m = makeMetrics({ texelsPerDeg: 30, distanceM: 1.7, textScale: 1, ppd: 40 }); const L = layoutBeatCard(approxMeasure, { beat: mkBeat('t', 'b'), disclosure: disc, canPrev: true, canNext: true }, m, 960);
    const least = Math.min(...L.ops.filter(o => o.k === 'text').map(o => parseFloat(/(\d+(?:\.\d+)?)px/.exec((o as any).font)![1]) / m.texelsPerDeg));
    check(least >= XR_LEGIBILITY.minEmDeg - 0.01, `the smallest text on a card is ${least.toFixed(2)} degrees (floor ${XR_LEGIBILITY.minEmDeg})`); }
  // buttons at the menu's 1.0 m and the dock: 3.5 degrees of ray target is 6.1 cm there, over the 5 cm floor
  const mm = makeMetrics({ texelsPerDeg: 30, distanceM: 1.0 }), unit1 = metresAt(1, 1.0);
  check(mm.targetPx / 30 * unit1 >= 0.05, `a menu button at 1.0 m is ${(mm.targetPx / 30 * unit1 * 100).toFixed(1)} cm (floor 5)`);
  const mv = makeMetrics({ texelsPerDeg: 30, distanceM: 1.7, targetDeg: XR_LEGIBILITY.targetDeg.gazePinch });
  check(Math.abs(mv.targetPx / 30 - 5) < 0.1, 'for gaze plus pinch (visionOS) a target is 5 degrees');
  // start, end, caption, no overflow
  const m = makeMetrics({ texelsPerDeg: 30, distanceM: 1.7, textScale: 1.5, ppd: 20 });
  const story = { slug: 's', surname: 'Okafor-Lindqvist', tagline: thirty, address: '12 Example Road, Anytown', members: [{ id: 'a', name: 'Mia', initial: 'M', role: 'parent', colour: 'chart-1', companion: null }, { id: 'b', name: 'Theo', initial: 'T', role: 'teen', colour: 'chart-5', companion: null }], chapters: [], beatCount: 12, closing: { body: thirty, ctaLabel: 'See the Companion Core', ctaUrl: '' }, disclosure: disc, core: null, durations: 'voice' as const, fonts: { family: 'Manrope' as const, weights: [500] } };
  const Ls = layoutStartCard(approxMeasure, { story, line: disc.fictional }, m, 1170), Le = layoutEndCard(approxMeasure, { closing: story.closing, hasNextFamily: true, core: null, disclosure: disc }, m, 1170, { canReplay: true, hasCta: true });
  check(!Ls.overflow && Ls.texts.includes(disc.fictional), 'the start card fits at 150 percent and says Fictional');
  check(!Le.overflow && Le.texts.includes(disc.signoff) && Le.texts.includes(disc.scripted) && Le.texts.includes(disc.synthetic) && Le.texts.includes(disc.stylised) && Le.texts.includes(disc.beta), 'the end card carries the sign-off and every claim, word for word');
  check(['cta', 'replay', 'next-family', 'exit'].every(id => Le.widgets.some(w => w.id === id)), 'the end card has its call to action, replay, next family and exit');
  const cap = layoutCaption(approxMeasure, { words: thirty.split(/\s+/), wordIndex: 12, speaker: 'Hermes', fictional: disc.fictional, progress: 0.4 }, makeMetrics({ texelsPerDeg: 30, distanceM: 1.7, interactive: false }), 1020);
  check(cap.lines.body <= XR_LEGIBILITY.caption.maxLines, `the caption bar shows at most ${XR_LEGIBILITY.caption.maxLines} lines (${cap.lines.body} of ${cap.lineCount})`);
  check(cap.firstLine === Math.max(0, Math.min(cap.wordLine[12] - 1, cap.lineCount - 2)), 'the caption window shows the line being read and the one before it');
}

// =================================================================================================================== contrast
section('contrast and colour');
for (const t of [THEMES.normal, THEMES.high]) for (const [what, fg, bg] of textPairs(t)) {
  const c = contrastRatio(fg, bg); check(c >= XR_LEGIBILITY.minContrast, `${t.name}: ${what} is ${c.toFixed(1)}:1 (7:1 asked)`);
}
for (const c of ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']) { const f = memberFill(c); check(contrastRatio(f.fill, f.ink) >= 4.5, `member disc ${c}: initial is ${contrastRatio(f.fill, f.ink).toFixed(1)}:1 on its colour (4.5 asked for a bold initial)`); }
check(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01, 'the contrast function: black on white is 21:1');

// =================================================================================================================== maths
section('panel maths');
{
  const THREE: any = await import(pathToFileURL(path.join(ROOT, 'assets', 'vendor', 'three', 'three.module.min.js')).href);
  const r = rng(7); let worst = 0;
  for (let i = 0; i < 200; i++) {
    const yaw = (r() - 0.5) * 6.28, tilt = (r() - 0.5) * 30;
    const o = new THREE.Object3D(); o.rotation.order = 'YXZ'; o.rotation.set(-tilt * Math.PI / 180, yaw, 0); o.updateMatrixWorld(true);
    const b = panelBasis(yaw, tilt);
    for (const [local, mine] of [[[1, 0, 0], b.r], [[0, 1, 0], b.u], [[0, 0, 1], b.n]] as Array<[number[], V3]>) {
      const v = new THREE.Vector3(...local).applyQuaternion(o.quaternion); worst = Math.max(worst, Math.hypot(v.x - mine[0], v.y - mine[1], v.z - mine[2]));
    }
  }
  check(worst < 1e-9, `panelBasis equals three.js's YXZ rotation of a plane (worst ${worst.toExponential(1)})`);
  const b = panelBasis(0, 0), c: V3 = [0, 1.5, -2];
  const h = rayPanel([0.3, 1.8, 0], [0, 0, -1], c, b, 1, 1);
  check(!!h && Math.abs(h.dist - 2) < 1e-9 && Math.abs(h.uv[0] - 0.8) < 1e-9 && Math.abs(h.uv[1] - 0.8) < 1e-9, 'a ray straight at a panel meets it at the right uv');
  check(rayPanel([0.6, 1.5, 0], [0, 0, -1], c, b, 1, 1) === null, 'a ray past the edge misses');
  check(rayPanel([0, 1.5, -4], [0, 0, 1], c, b, 1, 1) === null, 'a ray from behind the panel does not hit it');
  check(rayPanel([0, 1.5, 0], [0, 0, 1], c, b, 1, 1) === null, 'a ray pointing away misses');
  const rects = [{ x: 0, y: 0, w: 100, h: 100, id: 'a' }, { x: 110, y: 0, w: 100, h: 100, id: 'b' }];
  check(rectAt(rects, 50, 50)?.id === 'a' && rectAt(rects, 105, 50, 10)?.id === 'a' && rectAt(rects, 108, 50, 10)?.id === 'b' && rectAt(rects, 300, 50, 10) === null, 'rectAt: inside, in the slack (nearest centre wins), outside');

  // lazy follow
  let st = newFollow(0), moved = 0;
  for (let i = 0; i < 300; i++) { followStep(st, FOLLOW.deadDeg - 1, 1 / 72); } moved = st.yaw;
  check(moved === 0, `a head turned ${FOLLOW.deadDeg - 1} degrees (inside the dead zone) for 4 s does not move the panel`);
  st = newFollow(0); for (let i = 0; i < Math.floor(0.35 * 72); i++) followStep(st, 40, 1 / 72);
  check(st.yaw === 0, 'a head 40 degrees away for 0.35 s (under the 0.4 s hold) does not move it');
  st = newFollow(0); let t = 0, arrived = -1, started = -1, maxStep = 0, last = 0;
  for (let i = 0; i < 72 * 3; i++) { followStep(st, 40, 1 / 72); t += 1 / 72; maxStep = Math.max(maxStep, Math.abs(st.yaw - last)); if (started < 0 && st.yaw !== 0) started = t; last = st.yaw; if (arrived < 0 && Math.abs(40 - st.yaw) < 2) arrived = t; }
  check(started >= FOLLOW.holdS - 0.02 && started <= FOLLOW.holdS + 0.05, `it starts after the 0.4 s hold (${started.toFixed(2)} s)`);
  check(arrived > 0 && arrived - started < 1.0, `it is within 2 degrees of the head ${(arrived - started).toFixed(2)} s after it starts (under 1 s)`);
  check(maxStep < 4, `no frame turns it more than ${maxStep.toFixed(1)} degrees (smooth)`);
  const lp = lockedPose([1, 1.6, 1], 0, 0, -16, 1.7);
  check(Math.abs(lp.centre[1] - (1.6 - 1.7 * Math.sin(16 * Math.PI / 180))) < 1e-9 && Math.abs(lp.centre[2] - (1 - 1.7 * Math.cos(16 * Math.PI / 180))) < 1e-9 && lp.tiltDeg === 15, 'a caption pose: 1.7 m ahead, 16 degrees below the horizon, tilted up to the eyes');
}

// =================================================================================================================== device numbers and settings
section('device numbers');
{
  // Quest 3 eye: about 2064 px across, a 110 degree horizontal field (symmetric): the centre has about 15 px per degree
  const t = Math.tan(55 * Math.PI / 180), proj = new Array(16).fill(0); proj[0] = 1 / t; proj[8] = 0;
  const ppd = ppdOfEye(2064, proj);
  check(ppd > 12.3 && ppd < 12.9, `pixels per degree at the centre of a 2064 px, 110 degree eye is ${ppd.toFixed(1)} (a rectilinear image is coarsest in the middle)`);
  check(texelsPerDegFor(ppd) === 24 && texelsPerDegFor(30) === 40 && texelsPerDegFor(20) === 30 && texelsPerDegFor(60) === 40, 'texels per degree = clamp(1.5 x ppd, 24, 40)');
  check(ppdOfEye(0, proj) === 0 && ppdOfEye(1000, new Array(16).fill(0)) === 0, 'a missing projection gives 0 (the kit keeps its default)');
  const s = createSettings({ textScale: 7 as any, contrast: 'purple' as any, heightCm: 1234 as any, handedness: 'left' }, false);
  check(s.get().textScale === DEFAULT_SETTINGS.textScale && s.get().contrast === 'normal' && s.get().heightCm === 60 && s.get().handedness === 'left', 'settings keep only well-formed values, and clamp the height to 60 cm');
  let calls = 0; s.on(() => { calls++; }); s.set({ textScale: 1.25 }); s.set({ textScale: 1.25 }); s.set({ heightCm: 12 });
  check(calls === 2 && s.get().textScale === 1.25 && s.get().heightCm === 10, 'a setting notifies once per change, and height snaps to 5 cm');
  check(XR_BUDGET.panels === 8 && XR_BUDGET.drawCalls === 24 && XR_BUDGET.textureBytes === 24 * 1024 * 1024 && XR_COMFORT.enterBudgetMs === 450, 'the budgets are the ones in presenter.ts (8 panels, 24 draw calls, 24 MB, 450 ms)');
  check(wrapText(approxMeasure, fontOf(40, 500), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa b', 300).length > 1, 'a word wider than the line is cut, not overflowed');
}

console.log(`\n${n - bad}/${n} checks passed${bad ? `, ${bad} FAILED` : ''}`);
process.exit(bad ? 1 : 0);
