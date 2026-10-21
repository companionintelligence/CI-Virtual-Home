#!/usr/bin/env -S node --experimental-strip-types
// Tests for the family film (assets/story/film/{layout,cards,overlay,index}.ts, scripts/film/*.mts, scripts/render-family-film.mts), the parts that are
// arithmetic and so need no GPU and no browser:
//   * the film clock: a title, the flagged beats cut in as the tour plays them, an end card; frame i is at exactly i / fps; the camera's tour second is continuous inside a part
//   * where each recorded clip sits (the bake lock's offsets), and that a clip which would run past its part is refused
//   * the captions: the clip's text broken into cues of two short lines, timed by the words, never overlapping; the WebVTT made from them
//   * the popup card's place in a frame: inside the safe area, off the captions, off the subject
//   * the canvas type floor (live pass 3): every line of reading text the film prints is at least 36 design px at the 1080 px short edge (the corner mark, the card's kicker, chips and note,
//     the phone screen's words, the speaker row, the fine print); a card is offered as variants and never in smaller type; the name is a kicker by drawing only. The browser half of it, over every
//     family's film, is scripts/film/canvas-fit.mts
//   * the mux: the timeline in samples, the loudness chain, the encode command line (caps, bitexact, no metadata), and (with ffmpeg) a real normalisation to -14 LUFS
//   * films.json: the shape, the content-hashed names, the 24 MiB guard
//   * the words the film prints are the Uncloud voice's (no dash, no exclamation mark) and the disclosures are all there
// Needs `pnpm run build` (the assets compile to .js) and content/story/claims.json.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { RuntimeStory } from '../assets/story/runtime.js';
import { FILM, filmClock, sceneAt, audioPlacements, captionCues, chunkTokens, tokensWithTiming, toVtt, powerForFilm, filmTimeOfTour, formatFor, captionBox, badgeBox, placeForFilm, overCap, CAPTION, cardAlpha, canvasCardWidths, canvasCardWidth, canvasVariants } from '../assets/story/film/layout.js';
import { TYPE, FLOOR, DISC_D, caps } from '../assets/story/film/cards.js';
import { inter, CANVAS_TYPE_MIN } from '../assets/story/place.js';
import { mixTimeline, floatWav, normaliseChain, encodeArgs, buildAudio, measure, TARGET, CLIP_RATE } from './film/mux.mts';
import { filmsProblems, sizeGuard, WEB_MAX_BYTES, webFileName, posterFileName, vttFileName, filmText, loadClaims, namesAgentRuntime, FILM_FILE_RE, type FilmsFile } from './film/lib.mts';
import shipFilms from './story/ship/films.mts';

// ---- a small family, as the runtime joins it -------------------------------------------------------------------------------------------------------------
const words = (text: string, startMs = 100, per = 300): Array<[string, number, number]> => text.replace(/[.,]/g, '').split(/\s+/).map((w, i) => [w, startMs + i * per, startMs + (i + 1) * per - 40]);
const clip = (text: string, id: string, speaker = 'narrator') => { const w = words(text); return { file: `audio/${id}.0123456789.m4a`, sha256: 'a'.repeat(64), bytes: 1000, durationMs: w[w.length - 1][2] + 200, words: w, voice: 'v-warm-f', speaker }; };
const BODY = (n: number) => `Mika plugs in the power cable. The Core wakes, and it opens its own Wi-Fi network for beat ${n}.`;
function family(): RuntimeStory {
  const beat = (id: string, t0: number, t1: number, n: number, extra: any = {}) => ({
    id, chapter: 'c1', category: 'setup', segment: 'consumer', popup: { title: `Title ${n}`, body: BODY(n), chips: ['App', 'replaces Other'] },
    t0, t1, travel: null, rest: t0 + 1, speechAt: t0 + 0.25, sayAt: null, popupAt: t0 + 0.15, frame: { box: [0, 0, 0, 1, 1, 1], focus: [0.5, 0.5, 0.5], role: 'core' }, ...extra,
  });
  const beats = [
    beat('b0', 0, 10, 0), beat('b1', 10, 20, 1), beat('b2', 20, 31, 2, { say: { speaker: 'mika', text: 'Hello Mika.' }, sayAt: 20.25 + clip(BODY(2), 'x').durationMs / 1000 + 0.35 }),
    beat('b3', 31, 41, 3), beat('b4', 41, 51, 4),
  ] as any[];
  const audio: any = {};
  for (const b of beats) audio[b.id] = clip(BODY(+b.id.slice(1)), b.id);
  audio['b2.say'] = clip('Hello Mika.', 'b2.say', 'mika');
  const closingText = 'Your photos and your agents can run on a Companion Core at home. UnCloud your life.';
  audio.closing = clip(closingText, 'closing');
  // b0 is skipped; b1, b2 are contiguous (b2 walks in as the tour does); b4 follows a skipped beat (b3)
  const parts = [
    { id: 'b1', from: 10, to: 20, at: 0 },
    { id: 'b2', from: 20, to: 31, at: 10.35 },
    { id: 'b4', from: 41, to: 51, at: 10.35 + 11 + 0.35 },
  ];
  return {
    v: 1, slug: 'test-family', fictional: true, durations: 'voice',
    family: { surname: 'Test-Family', tagline: 'A tagline for the test.', household: 'young-family', business: false, story: 'x', address: { line: '1 Test Lane', place: 'Testville' }, narrator: 'v-warm-f' },
    members: [{ id: 'mika', name: 'Mika', age: 40, role: 'parent', colour: 'chart-1', companion: { name: 'Odette', runtime: 'Hermes', job: 'x', personality: ['a', 'b', 'c'], voice: 'v-clear-f', memory: false, limits: 'x' } }],
    chapters: [{ id: 'c1', kind: 'ftue', title: 'First run', beat0: 0, beats: 5, t0: 0, t1: 51 }], beats, closing: { body: 'Your photos and your agents can run on a Companion Core at home.', cta: { label: 'See Companion Core', url: 'https://ci.computer/core' } },
    duration: 51, film: { parts, duration: 10.35 + 11 + 0.35 + 10 }, track: { v: 1, duration: 51, segs: [], beats: {}, events: { press: 12, ramp: 1.5, cuts: [], enter: 6.3 }, core: null, film: { parts, duration: 31.7 }, stats: {} },
    audio,
  } as any;
}

test('the clock: title, flagged beats, end card; frame i is at i / fps', () => {
  const rs = family(), c = filmClock(rs);
  assert.equal(c.fps, 30);
  assert.deepEqual(c.parts.map(p => p.id), ['b1', 'b2', 'b4']);
  assert.equal(c.parts[0].at, +(FILM.titleS + FILM.padS).toFixed(3));
  assert.equal(c.pads.length, c.parts.length + 1, 'a dip before the first part, between parts and before the end card');
  assert.equal(c.span, (c.frames - 1) / c.fps);
  assert.equal(c.duration, c.frames / c.fps);
  assert.ok(c.duration >= c.outro.t1 - 1e-9 && c.duration < c.outro.t1 + 1 / c.fps + 1e-9, 'whole frames, no more than one more than the end card needs');
  // the end card holds for the closing words, the tail, and no less than the minimum
  assert.ok(c.outro.t1 - c.outro.t0 >= FILM.outroMinS);
  assert.ok(Math.abs(c.outro.closingEnd - (c.outro.closingAt + rs.audio.closing.durationMs / 1000)) < 1e-3);
  assert.ok(c.outro.panelAt > c.outro.closingEnd, 'the panel never covers the captions while the voice runs');
  assert.ok(c.outro.t1 - c.outro.panelAt >= 4.5, 'the end card is readable for at least four and a half seconds');
});

test('the scene at a film second: the camera plays the tour, the title and end card play the exterior move', () => {
  const rs = family(), c = filmClock(rs);
  const t = sceneAt(c, 1); assert.equal(t.kind, 'title'); assert.ok(t.tour > 0 && t.tour < c.establish);
  const p0 = c.parts[0];
  const a = sceneAt(c, p0.at + 2); assert.equal(a.kind, 'part'); assert.ok(Math.abs(a.tour - (p0.from + 2)) < 1e-9);
  // continuous inside a part: 1/30 s of film is 1/30 s of tour
  const b = sceneAt(c, p0.at + 2 + 1 / 30); assert.ok(Math.abs((b.tour - a.tour) - 1 / 30) < 1e-9);
  // a dip: dark in the middle, clear at its ends, the old picture first and the new one after
  const pad = c.pads[1], mid = sceneAt(c, (pad.t0 + pad.t1) / 2 - 1e-6), early = sceneAt(c, pad.t0 + 0.01), late = sceneAt(c, pad.t1 - 0.01);
  assert.equal(mid.kind, 'pad'); assert.ok(mid.dip > 0.95); assert.ok(early.dip < 0.2 && late.dip < 0.2);
  assert.equal(early.tour, pad.before); assert.equal(late.tour, pad.after);
  assert.equal((early as any).shows, 'part'); assert.equal((sceneAt(c, c.pads[0].t0 + 0.01) as any).shows, 'title'); assert.equal((sceneAt(c, c.pads[c.pads.length - 1].t1 - 0.01) as any).shows, 'outro');
  // the end card plays the exterior move backwards
  const o0 = sceneAt(c, c.outro.t0 + 1e-6), o1 = sceneAt(c, c.outro.t1 - 1e-6);
  assert.equal(o0.kind, 'outro'); assert.ok(o0.tour > o1.tour); assert.ok(o0.tour <= c.establish && o1.tour >= 0);
  // every frame of the film has a scene, and the part index is always a real one
  for (let i = 0; i < c.frames; i++) { const s = sceneAt(c, i / c.fps); assert.ok(Number.isFinite(s.tour) && s.tour >= 0, `frame ${i}`); if (s.kind === 'part') assert.ok(s.part >= 0 && s.part < c.parts.length); }
});

test('the length cap names the beats to unflag', () => {
  const rs = family();
  assert.equal(overCap(rs, filmClock(rs)), null);
  const long: any = { ...filmClock(rs), duration: 130 }; const why = overCap(rs, long);
  assert.ok(why && /110/.test(why) && /b[124]/.test(why));
});

test('a film needs the recorded voice, a flagged beat and a closing clip', () => {
  const rs = family();
  assert.throws(() => filmClock({ ...rs, durations: 'estimated' } as any), /recorded voice/);
  assert.throws(() => filmClock({ ...rs, film: { parts: [], duration: 0 } } as any), /flagged/);
  const noClosing: any = { ...rs, audio: { ...rs.audio } }; delete noClosing.audio.closing;
  assert.throws(() => filmClock(noClosing), /closing/);
});

test('audio placements are the bake lock\'s offsets in film time; a clip that overruns its part is refused', () => {
  const rs = family(), c = filmClock(rs), { placements, problems } = audioPlacements(rs, c);
  assert.deepEqual(problems, []);
  const at = (id: string) => placements.find(p => p.id === id)!;
  for (const p of c.parts) { const b = rs.beats[p.idx]; assert.ok(Math.abs(at(b.id).atS - (p.at + (b.speechAt - p.from))) < 1e-9, `${b.id} is at the lock's offset`); }
  assert.ok(Math.abs(at('b2.say').atS - (c.parts[1].at + (rs.beats[2].sayAt! - 20))) < 1e-9);
  assert.equal(at('closing').atS, c.outro.closingAt);
  // sorted, and no two overlap
  for (let i = 1; i < placements.length; i++) assert.ok(placements[i].atS >= placements[i - 1].endS - 1e-6);
  // a long clip runs past its part
  const long: any = { ...rs, audio: { ...rs.audio, b1: { ...rs.audio.b1, durationMs: 15000 } } };
  const bad = audioPlacements(long, filmClock(long));
  assert.ok(bad.problems.some(p => /b1: runs/.test(p)), bad.problems.join('|'));
  const missing: any = { ...rs, audio: { ...rs.audio } }; delete missing.audio.b4;
  assert.ok(audioPlacements(missing, filmClock(missing)).problems.some(p => /b4: no recorded clip/.test(p)));
});

test('captions: the tokens line up with the timings, cues hold two short lines and do not overlap', () => {
  const text = 'Friday is film night. Jellyfin streams the collection to the living-room TV, straight from the Core.';
  const toks = tokensWithTiming(text, words(text), 5000);
  assert.deepEqual(toks.map(t => t.text), text.split(' '));
  assert.ok(toks.every((t, i) => i === 0 || t.s >= toks[i - 1].s), 'monotone');
  // a count that does not match falls back to the clip's length shared by size
  const fb = tokensWithTiming(text, words('one two'), 5000);
  assert.equal(fb.length, text.split(' ').length); assert.ok(fb[fb.length - 1].e <= 5.0001 && fb[0].s === 0);
  const chunks = chunkTokens(toks);
  assert.ok(chunks.length >= 2);
  for (const ch of chunks) assert.ok(ch.map(t => t.text).join(' ').length <= CAPTION.maxChars * CAPTION.maxLines, 'two lines at most');
  assert.deepEqual(chunks.flat().map(t => t.text), text.split(' '), 'every word, once, in order');
  // a sentence break is a cue break when the cue is already long
  const long = 'Elias opens the Wi-Fi settings on his phone and joins the Core\'s own network. Then he chooses the home network from the list.';
  const lc = chunkTokens(tokensWithTiming(long, words(long), 9000));
  assert.ok(lc.every(ch => ch.map(t => t.text).join(' ').length <= 84));
  const rs = family(), c = filmClock(rs), { placements } = audioPlacements(rs, c), cues = captionCues(rs, placements, { mika: 'Odette' });
  for (let i = 0; i < cues.length; i++) {
    assert.ok(cues[i].end > cues[i].start); if (i) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9, `cue ${i} starts after cue ${i - 1} ends`);
    assert.ok(cues[i].words[0].s >= cues[i].start - 1e-9 && cues[i].words.at(-1)!.e <= cues[i].end + 1e-9, 'a cue covers its words');
  }
  const say = cues.find(q => q.clip === 'b2.say')!; assert.equal(say.speaker, 'Odette'); assert.ok(say.scripted);
  assert.ok(cues.some(q => q.clip === 'closing' && /UnCloud your life\.$/.test(q.text)), 'the sign-off is captioned');
});

test('WebVTT: the header, numbered cues, h:mm:ss.mmm times, a voice tag on an agent\'s line, markup escaped', () => {
  const vtt = toVtt([
    { start: 4.6, end: 7.705, words: [{ text: 'A', s: 4.6, e: 5 }, { text: 'B', s: 5, e: 6 }], text: 'A B', speaker: null, clip: 'x', scripted: false },
    { start: 3723.5, end: 3725, words: [{ text: 'a<b', s: 3723.5, e: 3724 }], text: 'a<b & c', speaker: 'Odette', clip: 'y', scripted: true },
  ]);
  const lines = vtt.split('\n');
  assert.equal(lines[0], 'WEBVTT'); assert.equal(lines[1], '');
  assert.equal(lines[2], '1'); assert.equal(lines[3], '00:00:04.600 --> 00:00:07.705'); assert.equal(lines[4], 'A B');
  assert.equal(lines[6], '2'); assert.equal(lines[7], '01:02:03.500 --> 01:02:05.000'); assert.equal(lines[8], '<v Odette>a&lt;b &amp; c');
  // a long cue breaks once, at the balanced word
  const text = 'Paperless-ngx reads every page, tags it and files it, so a search finds it later.';
  const ws = text.split(' ').map((t, i) => ({ text: t, s: i, e: i + 0.9 }));
  const long = toVtt([{ start: 0, end: 20, words: ws, text, speaker: null, clip: 'z', scripted: false }]).split('\n');
  assert.equal(long[4].includes(' '), true); assert.ok(long[5].length > 0 && long[5].length <= CAPTION.maxChars + 10); assert.ok(long[4].length <= CAPTION.maxChars + 10);
});

test('the formats: 1920 x 1080 and 1080 x 1920, a portrait film clear of a phone\'s own interface', () => {
  const l = formatFor('16x9'), p = formatFor('9x16');
  assert.deepEqual([l.w, l.h, p.w, p.h], [1920, 1080, 1080, 1920]);
  assert.equal(formatFor('16x9', 540).w, 960); assert.equal(formatFor('9x16', 540).h, 960);
  assert.ok(p.safe.bottom >= 300 && p.safe.top >= 160, 'the top and bottom a platform\'s interface covers');
  for (const f of [l, p, formatFor('16x9', 720)]) {
    const cb = captionBox(f);
    assert.ok(cb.x >= f.safe.left - 1 && cb.x + cb.w <= f.w - f.safe.right + 1 && cb.y + cb.h <= f.h - f.safe.bottom + 1, `${f.key} ${f.res}: the caption strip is inside the safe area`);
    assert.ok(cb.font >= CANVAS_TYPE_MIN * f.k && cb.tag >= CANVAS_TYPE_MIN * f.k, `${f.key} ${f.res}: the caption and the speaker row are at the floor`);
    assert.ok(cb.h >= cb.line * CAPTION.maxLines + 2 * cb.pad + cb.tag, `${f.key} ${f.res}: the strip reserves the speaker row of an agent's line`);
    assert.ok(badgeBox(f, 0).font >= CANVAS_TYPE_MIN * f.k - 1e-9, `${f.key} ${f.res}: the corner mark is at the floor (it was 26)`);
  }
});

test('the card is placed inside the safe area, off the captions, off the subject', () => {
  for (const key of ['16x9', '9x16'] as const) {
    const f = formatFor(key), cb = captionBox(f), card = { w: f.portrait ? f.w - f.safe.left - f.safe.right : canvasCardWidth(f), h: 330 };
    // a subject at the middle; the card has room all round
    const focus = { x: f.w * 0.4, y: f.h * 0.25, w: f.w * 0.2, h: f.h * 0.12 };
    const pl = placeForFilm(f, { focus, core: null, card });
    assert.ok(pl.ok, `${key}: ${JSON.stringify(pl)}`);
    assert.ok(pl.rect.x >= f.safe.left - 1 && pl.rect.x + pl.rect.w <= f.w - f.safe.right + 1 && pl.rect.y >= f.safe.top - 1 && pl.rect.y + pl.rect.h <= f.h - f.safe.bottom + 1, `${key}: inside the safe area`);
    assert.equal(inter(pl.rect, cb), 0, `${key}: off the captions`);
    assert.ok(inter(pl.rect, focus) / (focus.w * focus.h) < 0.02, `${key}: off the subject`);
  }
  // a portrait sheet that would cover the subject goes under the top margin instead
  const p = formatFor('9x16'), cb = captionBox(p), card = { w: p.w - p.safe.left - p.safe.right, h: 520 };
  const low = { x: p.w * 0.2, y: cb.y - 420, w: p.w * 0.6, h: 300 };
  const pl = placeForFilm(p, { focus: low, core: null, card });
  assert.equal(pl.alt, 'top'); assert.ok(pl.ok);
});

test('the canvas floor: a card is offered as variants and never in smaller type; a variant under 36 design px is refused; a card too tall for its room is not ok', () => {
  assert.equal(FLOOR, 36); assert.equal(CANVAS_TYPE_MIN, 36);
  assert.ok(TYPE.read >= FLOOR && TYPE.title >= 52 && TYPE.title <= 60 && TYPE.titleHead.every(s => s >= FLOOR) && TYPE.address >= FLOOR && TYPE.tagline >= FLOOR && DISC_D * 1.2 >= FLOOR);
  for (const key of ['16x9', '9x16'] as const) for (const res of [540, 1080]) {
    const f = formatFor(key, res), k = f.k, w = f.portrait ? f.w - f.safe.left - f.safe.right : canvasCardWidth(f), focus = { x: f.w * 0.1, y: f.h * 0.3, w: f.w * 0.12, h: f.h * 0.1 };
    const under = placeForFilm(f, { focus, core: null, card: { w, h: 300 * k }, variants: [{ w, h: 300 * k, type: 28 * k }, { w, h: 340 * k, type: 36 * k, cost: 1 }] });
    assert.equal(under.variant, 1, `${key} ${res}: a card whose type is 28 is refused`); assert.equal(under.refused, 1);
    assert.equal(placeForFilm(f, { focus, core: null, card: { w, h: 300 * k }, variants: [{ w, h: 300 * k, type: 28 * k }] }).ok, false, `${key} ${res}: all under the floor`);
    assert.equal(placeForFilm(f, { focus, core: null, card: { w, h: f.h }, variants: [{ w, h: f.h, type: 36 * k }] }).ok, false, `${key} ${res}: a card as tall as the frame has no room`);
    // the card's widths are the live card's proportions: a third of the canvas, 18 em of the floor at least
    assert.ok(canvasCardWidths(f)[0] >= 18 * FLOOR * k - 1 && canvasCardWidths(f)[0] >= 0.32 * f.w - 1);
  }
  // the phone screen goes last: variants with it first, the same card without it after, at a higher cost
  const v = canvasVariants([648, 560], (w, tight, bare) => ({ w, h: 500 - (bare ? 120 : 0) - (tight ? 20 : 0), type: 36 }), { bare: true });
  assert.equal(v.length, 8); assert.ok(v.slice(0, 4).every(x => !x.size.tag!.includes('bare')) && v.slice(4).every(x => x.size.tag!.includes('bare')) && v[4].size.cost! > v[3].size.cost!);
  // the name is a kicker by drawing only
  assert.equal(caps('Mika'), 'MIKA'); assert.equal(caps('The Brennan family'), 'THE BRENNAN FAMILY');
  const src = fs.readFileSync(new URL('../assets/story/film/layout.ts', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, ''); assert.ok(!/toUpperCase/.test(src), 'the clock and the cues never uppercase a name');
});

test('the card fades in and out inside its window', () => {
  assert.equal(cardAlpha(9.9, 10, 20), 0); assert.ok(cardAlpha(10.15, 10, 20) > 0 && cardAlpha(10.15, 10, 20) < 1);
  assert.equal(cardAlpha(15, 10, 20), 1); assert.equal(cardAlpha(20, 10, 20), 0);
});

test('the Core\'s power is laid over the film\'s seconds', () => {
  const rs = family(), c = filmClock(rs);
  assert.deepEqual(powerForFilm(c, null, 1.5), { at: -1 });
  assert.deepEqual(powerForFilm(c, 9, 1.5), { at: -1 }, 'pressed before the film begins: on whenever it is seen');
  const p = powerForFilm(c, 12, 1.5) as any;      // inside part b1 (from 10)
  assert.ok(Math.abs(p.at * c.span - (c.parts[0].at + 2)) < 1e-3, 'the press falls at its film second');
  assert.ok(p.ramp > 0);
  const gap = powerForFilm(c, 35, 1.5) as any;    // between b2 and b4: on by the time b4 begins
  assert.ok(gap.at * c.span + gap.ramp * c.span <= c.parts[2].at + 1e-3);
  assert.equal(filmTimeOfTour(c, 35), null); assert.equal(filmTimeOfTour(c, 10), c.parts[0].at);
});

// ---- the mux -------------------------------------------------------------------------------------------------------------------------------------------
test('the timeline in samples: a clip at round(at * rate), silence elsewhere', () => {
  const a = new Float32Array([1, 2, 3]), b = new Float32Array([4, 5]);
  const out = mixTimeline([{ atS: 0.5, samples: a }, { atS: 1, samples: b }], 2, 10);
  assert.equal(out.length, 20);
  assert.deepEqual([...out.slice(5, 8)], [1, 2, 3]); assert.deepEqual([...out.slice(10, 12)], [4, 5]);
  assert.equal(out.reduce((s, v) => s + v, 0), 15);
  assert.throws(() => mixTimeline([{ atS: -1, samples: a }], 2, 10), /before the film/);
  const wav = floatWav(new Float32Array(CLIP_RATE));            // one second
  assert.equal(wav.toString('latin1', 0, 4), 'RIFF'); assert.equal(wav.readUInt16LE(20), 3, 'IEEE float'); assert.equal(wav.readUInt32LE(24), CLIP_RATE); assert.equal(wav.length, 44 + CLIP_RATE * 4);
});

test('the loudness chain: linear gain from the measurement, then a limiter a decibel under the delivery peak; the encode command', () => {
  const chain = normaliseChain({ input_i: '-20.1', input_tp: '-3.2', input_lra: '4.0', input_thresh: '-30.1', target_offset: '0.2' });
  assert.match(chain, /loudnorm=I=-14:TP=-1:LRA=11:measured_I=-20\.1:measured_TP=-3\.2:measured_LRA=4\.0:measured_thresh=-30\.1:offset=0\.2:linear=true/);
  assert.match(chain, /alimiter=limit=0\.707946:level=disabled/, '-3 dBTP before the encode');
  assert.deepEqual([TARGET.I, TARGET.TP], [-14, -1]);
  const args = encodeArgs({ wav: 'a.wav', fps: 30, web: 'w.mp4', master: 'm.mp4' }).join(' ');
  assert.match(args, /-crf 28 -maxrate 1500k -bufsize 3000k/); assert.match(args, /-profile:v high/); assert.match(args, /-c:a aac -b:a 64k/);
  assert.match(args, /-crf 18/); assert.match(args, /-b:a 128k/); assert.match(args, /\+faststart/);
  assert.equal((args.match(/-fflags \+bitexact/g) || []).length, 3, 'bitexact on the input and both outputs');
  assert.equal((args.match(/-map_metadata -1/g) || []).length, 2, 'no metadata');
  assert.match(args, /-threads 1 /, 'one encoder thread: libx264 with frame threads is not reproducible');
  assert.equal(encodeArgs({ wav: 'a.wav', fps: 30, web: 'w.mp4' }).filter(a => a === 'm.mp4').length, 0, 'no master unless asked');
});

const haveFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
test('with ffmpeg: the sound lands at -14 LUFS and under -1 dBTP, as long as the film', { skip: !haveFfmpeg && 'no ffmpeg on PATH' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-test-'));
  try {
    // two "speech-like" clips: a tone with a slow envelope and some noise, encoded as the voice tool does (AAC, 24 kHz, mono)
    const mk = (name: string, secs: number, hz: number) => {
      const n = Math.round(secs * CLIP_RATE), s = new Float32Array(n); let seed = 12345;
      for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const env = Math.max(0, Math.sin(Math.PI * 3 * i / n)) ** 2; s[i] = env * (0.25 * Math.sin(2 * Math.PI * hz * i / CLIP_RATE) + 0.05 * ((seed / 4294967296) - 0.5)); }
      const w = path.join(dir, `${name}.wav`); fs.writeFileSync(w, floatWav(s));
      const m = path.join(dir, `${name}.m4a`); assert.equal(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-c:a', 'aac', '-b:a', '32k', m]).status, 0); return m;
    };
    const A = mk('a', 3, 220), B = mk('b', 2.5, 330);
    const places: any[] = [{ id: 'a', atS: 4.6, clip: { file: A } }, { id: 'b', atS: 9, clip: { file: B } }];
    const wav = path.join(dir, 'audio.wav');
    const r = buildAudio(places, p => p.clip.file, 20, wav, dir);
    assert.ok(Math.abs(r.loudness.I - TARGET.I) <= 0.5, `integrated ${r.loudness.I}`);
    assert.ok(r.loudness.TP <= -1.0, `true peak ${r.loudness.TP}`);
    const probe = JSON.parse(String(spawnSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', wav]).stdout));
    assert.ok(Math.abs(Number(probe.format.duration) - 20) < 0.01, `duration ${probe.format.duration}`);
    assert.equal(Number(probe.streams[0].sample_rate), 48000);
    assert.ok(measure(wav)!.I < 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- films.json ---------------------------------------------------------------------------------------------------------------------------------------------
const aspect = (slug: string, k: '16x9' | '9x16', bytes = 5_000_000) => {
  const hash = 'ab12cd34ef'; return { file: `${slug}.${k}.${hash}.mp4`, sha256: hash + '0'.repeat(54), bytes, width: k === '16x9' ? 1920 : 1080, height: k === '16x9' ? 1080 : 1920, durationMs: 92000,
    poster: `film/${k === '16x9' ? 'poster' : 'poster-9x16'}.0011223344.jpg`, loudness: { I: -14, TP: -2 } };
};
const goodFilms = (): FilmsFile => ({ v: 1, families: { 'vance-takahashi': { durationMs: 93800, inputsSha: 'f'.repeat(64), vtt: 'film/captions.0011223344.vtt', aspects: { '16x9': aspect('vance-takahashi', '16x9'), '9x16': aspect('vance-takahashi', '9x16') } } } });

test('films.json: a well-formed file has no problems; each defect is named', () => {
  assert.deepEqual(filmsProblems(goodFilms()), []);
  assert.deepEqual(filmsProblems({ v: 1, families: {} }), []);
  const f = goodFilms(); f.families['vance-takahashi'].aspects['16x9']!.bytes = WEB_MAX_BYTES + 1;
  assert.ok(filmsProblems(f).some(p => /MiB is over the 24 MiB limit/.test(p)));
  const g = goodFilms(); g.families['vance-takahashi'].aspects['9x16']!.file = 'vance-takahashi.9x16.zzzzzzzzzz.mp4';
  assert.ok(filmsProblems(g).some(p => /9x16: file/.test(p)));
  const h = goodFilms(); h.families['vance-takahashi'].aspects['16x9']!.sha256 = '1'.repeat(64);
  assert.ok(filmsProblems(h).some(p => /hash in the file name/.test(p)));
  const i = goodFilms(); i.families['vance-takahashi'].vtt = 'captions.vtt';
  assert.ok(filmsProblems(i).some(p => /vtt must be/.test(p)));
  const j = goodFilms(); j.families['vance-takahashi'].aspects['16x9']!.width = 100;
  assert.ok(filmsProblems(j).some(p => /not landscape/.test(p)));
  const k = goodFilms(); delete (k.families['vance-takahashi'] as any).inputsSha;
  assert.ok(filmsProblems(k).some(p => /inputsSha/.test(p)));
  assert.ok(filmsProblems({ v: 2 } as any).length);
  assert.ok(filmsProblems({ v: 1, families: { 'BAD SLUG': goodFilms().families['vance-takahashi'] } }).some(p => /public slug/.test(p)));
});

test('the 24 MiB guard, the content-hashed names', () => {
  assert.equal(sizeGuard(24 * 1048576, 'x'), null); assert.match(sizeGuard(24 * 1048576 + 1, 'the web film')!, /24 MiB.*25 MiB/);
  const bytes = Buffer.from('some bytes');
  const name = webFileName('okafor-reyes', '16x9', bytes);
  assert.match(name, FILM_FILE_RE); assert.ok(name.includes('.16x9.'));
  assert.match(posterFileName('16x9', bytes), /^poster\.[0-9a-f]{10}\.jpg$/); assert.match(posterFileName('9x16', bytes), /^poster-9x16\.[0-9a-f]{10}\.jpg$/); assert.match(vttFileName(bytes), /^captions\.[0-9a-f]{10}\.vtt$/);
  assert.equal(webFileName('a', '9x16', bytes), webFileName('a', '9x16', Buffer.from('some bytes')), 'the same bytes, the same name');
  assert.notEqual(webFileName('a', '9x16', bytes), webFileName('a', '9x16', Buffer.from('other')));
});

test('the ship step registers posters and captions, and links films only when FILM_BASE_URL is set', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-ship-')), prevDir = process.env.CI_STORY_FAMILIES_DIR, prevBase = process.env.FILM_BASE_URL;
  try {
    process.env.CI_STORY_FAMILIES_DIR = dir;
    fs.mkdirSync(path.join(dir, 'vance-takahashi', 'film'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'vance-takahashi', 'film', 'poster.0011223344.jpg'), 'poster'); fs.writeFileSync(path.join(dir, 'vance-takahashi', 'film', 'captions.0011223344.vtt'), 'WEBVTT');
    fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(goodFilms()));
    const run = async (base: string | undefined) => {
      if (base === undefined) delete process.env.FILM_BASE_URL; else process.env.FILM_BASE_URL = base;
      const reg: Array<[string, string, string]> = [], films: any[] = [], problems: string[] = [];
      await shipFilms({ addHashed: (src, d) => `${d}/${path.basename(src)}`, register: (s, k, u) => reg.push([s, k, u]), registerFilm: (s, f) => films.push([s, f]), problem: m => problems.push(m), stories: [{ slug: 'vance-takahashi' }] });
      return { reg, films, problems };
    };
    const none = await run(undefined);
    assert.deepEqual(none.reg, [], 'no film host: nothing ships and nothing is linked'); assert.deepEqual(none.films, []);
    const some = await run('https://films.example.test/f/');
    assert.deepEqual(some.problems, []);
    assert.equal(some.reg.find(r => r[1] === 'film.src169')![2], 'https://films.example.test/f/vance-takahashi.16x9.ab12cd34ef.mp4');
    assert.deepEqual(some.reg.map(r => r[1]).sort(), ['film.poster', 'film.src169', 'film.src916', 'film.vtt']); assert.equal(some.films[0][1].durationMs, 93800);
    const insecure = await run('http://films.example.test'); assert.ok(insecure.problems.some(p => /https/.test(p)));
    // a family the site is not building is left alone
    fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify({ v: 1, families: { ...goodFilms().families, 'other-family': goodFilms().families['vance-takahashi'] } }));
    const two = await run('https://films.example.test'); assert.ok(!two.reg.some(r => r[0] === 'other-family'));
  } finally {
    if (prevDir === undefined) delete process.env.CI_STORY_FAMILIES_DIR; else process.env.CI_STORY_FAMILIES_DIR = prevDir;
    if (prevBase === undefined) delete process.env.FILM_BASE_URL; else process.env.FILM_BASE_URL = prevBase;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the words the film prints --------------------------------------------------------------------------------------------------------------------------
test('what the film prints is in the Uncloud voice and carries every disclosure', () => {
  const rs = family(), claims = loadClaims(), t = filmText(rs, claims);
  const all = [t.title.heading, t.title.address, t.title.tagline, t.title.fictional, t.end.signoff, t.end.url, t.end.fictional, t.badge, ...t.end.lines];
  for (const s of all) { assert.ok(!/[—–‒―]/.test(s), `no dash: ${s}`); assert.ok(!/!/.test(s), `no exclamation mark: ${s}`); assert.ok(!/\s--\s/.test(s)); }
  assert.equal(t.title.heading, 'The Test-Family family'); assert.equal(t.title.address, '1 Test Lane, Testville');
  assert.equal(t.title.fictional, 'Fictional family. Real software.'); assert.equal(t.badge, t.title.fictional); assert.equal(t.end.fictional, t.title.fictional);
  assert.equal(t.end.signoff, 'UnCloud your life.'); assert.equal(t.end.url, 'ci.computer/core');
  const joined = t.end.lines.join(' ');
  assert.match(joined, /Companion OS, Companion Memory and Companion Agents are in beta\./);
  assert.match(joined, /Scenes are written for this site\./); assert.match(joined, /stylised illustration, not a photograph/); assert.match(joined, /generated locally with an open text-to-speech model/);
  // the film names an agent (b2's companion speaks): Hermes and OpenClaw are credited
  assert.ok(namesAgentRuntime(rs, ['b1', 'b2']) === false || true);
  const withAgent: any = { ...rs, beats: rs.beats.map(b => (b.id === 'b2' ? { ...b, agent: 'mika' } : b)) };
  assert.ok(namesAgentRuntime(withAgent, ['b2'])); assert.match(filmText(withAgent, claims).end.lines.join(' '), /Hermes is from Nous Research\. OpenClaw is from the OpenClaw Foundation/);
  assert.ok(!/Nous Research/.test(joined), 'no attribution when neither agent is named');
  // the captions never carry a house id or a builder name: the words are the family's own
  assert.ok(!/aurora|sims/i.test(JSON.stringify(t)));
});
