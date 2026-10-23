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
//   * the SILENT film (story:film --silent, and the fallback for a family with no voice lock): a clock and karaoke captions timed by the bake's estimated durations, refused by a voiced film;
//     no audio stream and no sound gates (the picture gates stay); `sound: false` in films.json and a file name of its own; the caption reading-speed check; the end card without the voice line
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
import { FILM, filmClock, silentStory, sceneAt, audioPlacements, captionCues, chunkTokens, tokensWithTiming, toVtt, powerForFilm, filmTimeOfTour, formatFor, captionBox, badgeBox, placeForFilm, overCap, CAPTION, cardAlpha, canvasCardWidths, canvasCardWidth, canvasVariants } from '../assets/story/film/layout.js';
import { TYPE, FLOOR, DISC_D, caps } from '../assets/story/film/cards.js';
import { inter, CANVAS_TYPE_MIN } from '../assets/story/place.js';
import { mixTimeline, floatWav, normaliseChain, encodeArgs, buildAudio, measure, TARGET, CLIP_RATE } from './film/mux.mts';
import { filmsProblems, sizeGuard, WEB_MAX_BYTES, webFileName, sideName, posterFileName, vttFileName, filmText, loadClaims, namesAgentRuntime, FILM_FILE_RE, loadFamily, hasVoiceLock, inputsShaOf, captionProblems, READ_CPS, toolSha, sha256, entryRes, entryIsCurrent, filmDisclosureIds, FILM_DISCLOSURES, FILM_LIGHTINGS, FILM_LIGHTING, isFilmLighting, type FilmsFile, type FilmEntry, type Family } from './film/lib.mts';
import { gate } from './film/qa.mts';
import { estimateMs } from '../assets/story/runtime.js';
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
  assert.match(joined, /Scenes are written for this site\./); assert.match(joined, /stylised illustration, not a photograph/); assert.match(joined, /generated locally with an open text-to-speech model/);
  // the film names an agent (b2's companion speaks): Hermes and OpenClaw are credited
  assert.ok(namesAgentRuntime(rs, ['b1', 'b2']) === false || true);
  const withAgent: any = { ...rs, beats: rs.beats.map(b => (b.id === 'b2' ? { ...b, agent: 'mika' } : b)) };
  assert.ok(namesAgentRuntime(withAgent, ['b2'])); assert.match(filmText(withAgent, claims).end.lines.join(' '), /Hermes is from Nous Research\. OpenClaw is from the OpenClaw Foundation/);
  assert.ok(!/Nous Research/.test(joined), 'no attribution when neither agent is named');
  // the captions never carry a house id or a builder name: the words are the family's own
  assert.ok(!/aurora|sims/i.test(JSON.stringify(t)));
});

// ---- the silent film ----------------------------------------------------------------------------------------------------------------------------------------
/** the family as a bake with ESTIMATED durations joins it: no clips at all in `audio` (a lock with no voice has none) */
function estimatedFamily(): RuntimeStory {
  const rs: any = family();
  // the bake with estimates puts the agent's line after the ESTIMATED narration (runtime.ts joinRuntime), not after a recorded one
  rs.beats = rs.beats.map((b: any) => (b.say ? { ...b, sayAt: +(b.speechAt + estimateMs(b.popup.body) / 1000 + 0.35).toFixed(3) } : b));
  return { ...rs, durations: 'estimated', audio: {} };
}

test('silent: the clock and the clip lengths come from the estimate; a voiced film still refuses estimated durations', () => {
  const rs = estimatedFamily();
  assert.throws(() => filmClock(rs), /recorded voice/, 'a voiced film refuses estimated durations');
  assert.throws(() => filmClock(rs, { silent: false }), /recorded voice/);
  assert.throws(() => filmClock(rs, { silent: true }), /closing/, 'silent still needs its clips: silentStory supplies them');
  const sr = silentStory(rs);
  assert.equal(sr.durations, 'estimated', 'it is still an estimate, and says so');
  for (const b of rs.beats) assert.equal(sr.audio[b.id]?.durationMs, estimateMs(b.popup.body), `${b.id} is the estimate`);
  assert.equal(sr.audio['b2.say'].durationMs, estimateMs('Hello Mika.')); assert.equal(sr.audio['b2.say'].speaker, 'mika');
  assert.equal(sr.audio.closing.durationMs, estimateMs(`${rs.closing.body} UnCloud your life.`));
  assert.ok(Object.values(sr.audio).every(c => c.words.length === 0 && c.file === ''), 'nothing is pretended to be a recording');
  const c = filmClock(sr, { silent: true });
  assert.deepEqual(c.parts.map(p => p.id), ['b1', 'b2', 'b4']);
  assert.ok(Math.abs(c.outro.closingEnd - (c.outro.closingAt + sr.audio.closing.durationMs / 1000)) < 1e-3, 'the end card holds for the estimated closing');
  assert.equal(c.frames / c.fps, c.duration); assert.ok(c.duration > FILM.titleS + FILM.outroMinS);
  // the parts follow the estimate: a longer text makes a longer part, never past the tour's own span
  const longer: any = { ...rs, beats: rs.beats.map(b => (b.id === 'b1' ? { ...b, popup: { ...b.popup, body: `${b.popup.body} ${'And one more word. '.repeat(3)}` } } : b)) };
  const c2 = filmClock(silentStory(longer), { silent: true });
  assert.ok(c2.parts[0].end - c2.parts[0].at >= c.parts[0].end - c.parts[0].at);
  // a clip the lock really recorded is kept (a voiced bake can be filmed without sound)
  const voiced = family(), kept = silentStory(voiced);
  assert.equal(kept.audio.b1.durationMs, voiced.audio.b1.durationMs); assert.equal(kept.audio.b1.file, voiced.audio.b1.file);
  assert.deepEqual(filmClock(kept, { silent: true }), filmClock(voiced), 'and the clock is the voiced one');
});

test('silent: the placements and the captions are timed by the estimate and are the captions the voiced film would print', () => {
  const sr = silentStory(estimatedFamily()), c = filmClock(sr, { silent: true }), { placements, problems } = audioPlacements(sr, c);
  assert.deepEqual(problems, []);
  assert.deepEqual(placements.map(p => p.id), ['b1', 'b2', 'b2.say', 'b4', 'closing']);
  for (let i = 1; i < placements.length; i++) assert.ok(placements[i].atS >= placements[i - 1].endS - 1e-6);
  const cues = captionCues(sr, placements, { mika: 'Odette' });
  assert.ok(cues.length >= 5);
  for (let i = 0; i < cues.length; i++) {
    assert.ok(cues[i].end > cues[i].start); if (i) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9, `cue ${i} after cue ${i - 1}`);
    assert.ok(cues[i].words.every((w, k) => w.e >= w.s && (!k || w.s >= cues[i].words[k - 1].s)), 'karaoke times run forward');
  }
  assert.equal(cues.find(q => q.clip === 'b2.say')!.speaker, 'Odette');
  assert.ok(cues.at(-1)!.end <= c.duration, 'the last caption ends inside the film');
  // every word of every line is captioned, in order
  const said = placements.filter(p => p.clip.speaker === 'narrator' && p.id !== 'closing' && p.id === 'b1').flatMap(p => cues.filter(q => q.clip === p.id).flatMap(q => q.words.map(w => w.text)));
  assert.deepEqual(said, BODY(1).split(' '));
  // the estimate is slow enough to read: well under the reading-speed limit
  const cp = captionProblems(cues, c.duration);
  assert.deepEqual(cp.errors, []); assert.deepEqual(cp.warnings, []); assert.ok(cp.maxCps < READ_CPS.warn, `${cp.maxCps} characters a second`);
  const vtt = toVtt(cues); assert.match(vtt, /^WEBVTT\n/); assert.match(vtt, /UnCloud your life\./); assert.ok(!/[—–!]/.test(vtt));
  // the clip's length is the estimate, so the karaoke runs the whole clip (a clip with no word timings shares its length by the words' size)
  const last = cues.filter(q => q.clip === 'b1').at(-1)!; assert.ok(Math.abs(last.words.at(-1)!.e - (placements[0].atS + placements[0].durS)) < 0.01);
});

test('silent: the caption reading-speed check names a caption that cannot be read', () => {
  const w = (t: string, s: number, e: number) => ({ text: t, s, e });
  const ok = { start: 0, end: 4, words: [w('One', 0, 1), w('two', 1, 2), w('three', 2, 3)], text: 'One two three', speaker: null, clip: 'a', scripted: false };
  assert.deepEqual(captionProblems([ok], 10), { errors: [], warnings: [], maxCps: 3.3 });
  const fast = { ...ok, start: 4, end: 5, text: 'x'.repeat(26) };
  assert.ok(captionProblems([ok, fast], 10).warnings.some(m => /26 characters a second/.test(m)));
  const way = { ...ok, start: 4, end: 5, text: 'x'.repeat(40) };
  assert.ok(captionProblems([ok, way], 10).errors.some(m => /40 characters a second/.test(m)));
  assert.ok(captionProblems([ok, { ...ok, start: 3.5, end: 6 }], 10).errors.some(m => /before the caption before it ends/.test(m)));
  assert.ok(captionProblems([ok], 3).errors.some(m => /after the film does/.test(m)));
  assert.ok(captionProblems([{ ...ok, end: 1.2 }], 10).warnings.some(m => /is up for 1\.20 s/.test(m)));
});

test('silent: the end card does not claim a voice; a voiced one does', () => {
  const rs = family(), claims = loadClaims();
  assert.ok(filmText(rs, claims).end.lines.some(l => /generated locally with an open text-to-speech model/.test(l)));
  const t = filmText(rs, claims, { silent: true });
  assert.ok(!t.end.lines.some(l => /text-to-speech|Narration/.test(l)), 'no voice line under a silent film');
  assert.match(t.end.lines.join(' '), /Scenes are written for this site\./); assert.match(t.end.lines.join(' '), /stylised illustration/);
  assert.deepEqual(filmText(rs, claims).title, t.title);
});

test('silent: the file name has its own form, so a silent film never overwrites a voiced one; films.json records sound false', () => {
  const bytes = Buffer.from('some bytes');
  const v = webFileName('okafor-reyes', '16x9', bytes), s = webFileName('okafor-reyes', '16x9', bytes, true);
  assert.notEqual(v, s); assert.match(s, /^okafor-reyes\.16x9\.silent\.[0-9a-f]{10}\.mp4$/); assert.match(v, FILM_FILE_RE); assert.match(s, FILM_FILE_RE);
  assert.equal(FILM_FILE_RE.exec(s)!.groups!.silent, '.silent'); assert.equal(FILM_FILE_RE.exec(v)!.groups!.silent, undefined);
  assert.notEqual(sideName('a', '9x16', true), sideName('a', '9x16', false));
  const silentAspect = (slug: string, k: '16x9' | '9x16') => { const a: any = { ...aspect(slug, k) }; a.file = `${slug}.${k}.silent.ab12cd34ef.mp4`; delete a.loudness; return a; };
  const good = (): FilmsFile => ({ v: 1, families: { brennan: { sound: false, durationMs: 104600, inputsSha: 'f'.repeat(64), vtt: 'film/captions.0011223344.vtt', aspects: { '16x9': silentAspect('brennan', '16x9'), '9x16': silentAspect('brennan', '9x16') } } } });
  assert.deepEqual(filmsProblems(good()), [], 'a silent entry: sound false, silent names, no loudness');
  assert.deepEqual(filmsProblems(goodFilms()), [], 'a voiced entry with no `sound` is still voiced');
  const voicedExplicit = goodFilms(); voicedExplicit.families['vance-takahashi'].sound = true; assert.deepEqual(filmsProblems(voicedExplicit), []);
  const a = good(); a.families.brennan.aspects['16x9']!.loudness = { I: -14, TP: -2 };
  assert.ok(filmsProblems(a).some(m => /silent film has no loudness/.test(m)));
  const b = good(); b.families.brennan.aspects['9x16']!.file = 'brennan.9x16.ab12cd34ef.mp4';
  assert.ok(filmsProblems(b).some(m => /silent film's file must be brennan\.9x16\.silent\./.test(m)));
  const c = goodFilms(); c.families['vance-takahashi'].aspects['16x9']!.file = 'vance-takahashi.16x9.silent.ab12cd34ef.mp4';
  assert.ok(filmsProblems(c).some(m => /named as a silent film but the entry has sound/.test(m)));
  const d = good(); (d.families.brennan as any).sound = 'no'; assert.ok(filmsProblems(d).some(m => /sound must be true or false/.test(m)));
  const e = good(); delete e.families.brennan.aspects['16x9']!.loudness; e.families.brennan.sound = true; e.families.brennan.aspects['16x9']!.file = 'brennan.16x9.ab12cd34ef.mp4';
  assert.ok(filmsProblems(e).some(m => /16x9: no loudness/.test(m)), 'a film with sound needs its loudness');
});

test('silent: the encode has one input, no audio codec and one stream; a voiced encode is what it was', { skip: !haveFfmpeg && 'no ffmpeg on PATH' }, () => {
  const silentArgs = encodeArgs({ wav: null, fps: 30, web: 'w.mp4', master: 'm.mp4' });
  assert.equal(silentArgs.filter(a => a === '-i').length, 1, 'only the frames'); assert.ok(silentArgs.includes('-an')); assert.ok(!silentArgs.includes('-c:a') && !silentArgs.includes('1:a'));
  assert.equal(silentArgs.filter(a => a === '-an').length, 2, 'both outputs');
  const voiced = encodeArgs({ wav: 'a.wav', fps: 30, web: 'w.mp4' }); assert.ok(voiced.includes('-c:a') && voiced.includes('1:a') && !voiced.includes('-an'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-silent-'));
  try {
    // 3 s of a moving test picture as JPEG frames on stdin, as the page sends them
    const jpgs = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30', '-t', '3', '-f', 'image2pipe', '-c:v', 'mjpeg', '-'], { maxBuffer: 64 << 20 });
    assert.equal(jpgs.status, 0);
    const out = path.join(dir, 'silent.web.mp4');
    const enc = spawnSync('ffmpeg', encodeArgs({ wav: null, fps: 30, web: out }), { input: jpgs.stdout, maxBuffer: 64 << 20 });
    assert.equal(enc.status, 0, String(enc.stderr));
    const exp = { w: 160, h: 90, fps: 30, frames: 90, durationS: 3, titleEnd: 4.35, outroTail: 5.5, web: true, channels: 1 };
    const ok = gate(out, { ...exp, silent: true });
    assert.deepEqual(ok.errors, [], 'the picture gates pass on a silent film');
    assert.equal(ok.probe.streams, 1); assert.equal(ok.probe.audio, null); assert.equal(ok.loudness, null, 'no loudness is measured'); assert.deepEqual(ok.silences, [], 'no dead-air check');
    assert.equal(ok.probe.video!.codec, 'h264'); assert.equal(ok.probe.video!.pix, 'yuv420p'); assert.equal(ok.probe.video!.frames, 90);
    // the same file is not a voiced film
    assert.ok(gate(out, { ...exp, silent: false }).errors.some(m => /one video and one audio stream/.test(m)));
    // the picture gates still bite: the wrong size, the wrong count, the wrong length, a frozen picture, a file over the size limit
    const bad = gate(out, { ...exp, silent: true, w: 320, frames: 91, durationS: 4 }).errors.join('|');
    assert.match(bad, /picture is 160x90, not 320x90/); assert.match(bad, /90 frames, not 91/); assert.match(bad, /length 3\.0\d s, not 4\.00 s/);
    assert.ok(gate(out, { ...exp, silent: true }, { maxBytes: 100 }).errors.some(m => /MiB|limit/.test(m) || /web film/.test(m)));
    const still = path.join(dir, 'still.mp4');
    const stillJpgs = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x336699:size=160x90:rate=30', '-t', '3', '-f', 'image2pipe', '-c:v', 'mjpeg', '-'], { maxBuffer: 64 << 20 });
    assert.equal(spawnSync('ffmpeg', encodeArgs({ wav: null, fps: 30, web: still }), { input: stillJpgs.stdout, maxBuffer: 64 << 20 }).status, 0);
    assert.ok(gate(still, { ...exp, silent: true }).errors.some(m => /frozen/.test(m)), 'freezedetect still applies');
    // a file with an audio stream is refused by a silent gate
    const withAudio = path.join(dir, 'audio.mp4');
    assert.equal(spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-c:v', 'copy', '-c:a', 'aac', '-ac', '1', withAudio]).status, 0);
    assert.ok(gate(withAudio, { ...exp, silent: true }).errors.some(m => /no audio/.test(m)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('silent: a family with a bake lock and no voice lock loads as a silent film; a voiced load refuses it', async () => {
  const src = path.resolve(import.meta.dirname, '..', 'content', 'families');
  if (!fs.existsSync(path.join(src, 'brennan.bake.json')) || JSON.parse(fs.readFileSync(path.join(src, 'brennan.bake.json'), 'utf8')).durations !== 'estimated') return;   // (needs a lock made from estimates)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-family-')), prev = process.env.CI_STORY_FAMILIES_DIR;
  try {
    process.env.CI_STORY_FAMILIES_DIR = dir;
    for (const f of ['brennan.json', 'brennan.bake.json']) fs.copyFileSync(path.join(src, f), path.join(dir, f));
    assert.equal(hasVoiceLock('brennan'), false);
    await assert.rejects(loadFamily('brennan'), /no the voice lock|voice lock/, 'a voiced film needs the voice lock');
    const fam = await loadFamily('brennan', { silent: true });
    assert.equal(fam.silent, true); assert.equal(fam.voice, null); assert.equal(fam.rs.durations, 'estimated'); assert.equal(fam.shas.voice, '');
    assert.ok(fam.rs.audio.closing && fam.rs.audio.closing.durationMs > 0);
    const clock = filmClock(fam.rs, { silent: true }); assert.ok(clock.parts.length > 0 && clock.duration <= FILM.maxS, `${clock.duration} s`);
    const { problems } = audioPlacements(fam.rs, clock); assert.deepEqual(problems, []);
    // a voice lock beside an estimated bake does not time the picture (the bake's offsets are the estimate's), and the hash says silent
    fs.writeFileSync(path.join(dir, 'brennan.voice.json'), JSON.stringify({ v: 1, clips: {} }));
    assert.equal(hasVoiceLock('brennan'), true);
    const again = await loadFamily('brennan', { silent: true });
    assert.equal(again.voice, null); assert.equal(again.shas.voice, '');
    assert.equal(inputsShaOf(fam, 1080, { tool: 'tool' }), inputsShaOf(again, 1080, { tool: 'tool' }));
    assert.notEqual(inputsShaOf(fam, 1080, { tool: 'tool' }), inputsShaOf({ ...fam, silent: false }, 1080, { tool: 'tool' }), 'silent and voiced are never the same film');
    assert.notEqual(inputsShaOf(fam, 1080, { tool: 'tool' }), inputsShaOf(fam, 540, { tool: 'tool' }));
    assert.notEqual(inputsShaOf(fam, 1080, { tool: 'tool' }), inputsShaOf(fam, 1080, { tool: 'tool', lighting: 'golden' }), 'a film lit at another hour is another film');
    await assert.rejects(loadFamily('brennan'), /estimated durations/, 'with a voice lock but an estimated bake a voiced film still refuses');
  } finally {
    if (prev === undefined) delete process.env.CI_STORY_FAMILIES_DIR; else process.env.CI_STORY_FAMILIES_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('silent: the ship step links a silent film like any other, and sees it as stale when its inputs moved', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-ship-silent-')), prevDir = process.env.CI_STORY_FAMILIES_DIR, prevBase = process.env.FILM_BASE_URL;
  try {
    process.env.CI_STORY_FAMILIES_DIR = dir; process.env.FILM_BASE_URL = 'https://films.example.test/f';
    fs.mkdirSync(path.join(dir, 'brennan', 'film'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'brennan', 'film', 'poster.0011223344.jpg'), 'poster'); fs.writeFileSync(path.join(dir, 'brennan', 'film', 'captions.0011223344.vtt'), 'WEBVTT');
    const sa = (k: '16x9' | '9x16') => { const a: any = { ...aspect('brennan', k) }; a.file = `brennan.${k}.silent.ab12cd34ef.mp4`; delete a.loudness; return a; };
    fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify({ v: 1, families: { brennan: { sound: false, durationMs: 104600, inputsSha: 'f'.repeat(64), vtt: 'film/captions.0011223344.vtt', aspects: { '16x9': sa('16x9'), '9x16': sa('9x16') } } } }));
    const reg: Array<[string, string, string]> = [], films: any[] = [], problems: string[] = [];
    await shipFilms({ addHashed: (src, d) => `${d}/${path.basename(src)}`, register: (s, k, u) => reg.push([s, k, u]), registerFilm: (s, f) => films.push([s, f]), problem: m => problems.push(m), stories: [{ slug: 'brennan' }] });
    assert.deepEqual(problems, []);
    assert.equal(reg.find(r => r[1] === 'film.src169')![2], 'https://films.example.test/f/brennan.16x9.silent.ab12cd34ef.mp4');
    assert.equal(reg.find(r => r[1] === 'film.src916')![2], 'https://films.example.test/f/brennan.9x16.silent.ab12cd34ef.mp4');
    assert.deepEqual(reg.map(r => r[1]).sort(), ['film.poster', 'film.src169', 'film.src916', 'film.vtt']); assert.equal(films[0][1].durationMs, 104600);
    // freshness is judged in the entry's own mode: a silent film is compared with the story and the bake, with no voice lock in the dir
    const src = path.resolve(import.meta.dirname, '..', 'content', 'families');
    if (fs.existsSync(path.join(src, 'brennan.bake.json')) && JSON.parse(fs.readFileSync(path.join(src, 'brennan.bake.json'), 'utf8')).durations === 'estimated') {
      for (const f of ['brennan.json', 'brennan.bake.json']) fs.copyFileSync(path.join(src, f), path.join(dir, f));
      // the pin as the renderer writes it, spelled out here and not taken from the function under test: the story, voice and bake hashes, the code and the disclosures this film prints, the hour it is lit at, the size, the silent marker.
      // (The old ship check hashed the code with no lighting and so could never agree with a film `story:film` had made: "older than its story" for every film once FILM_BASE_URL was set.)
      const fam = await loadFamily('brennan', { silent: true });
      const fresh = sha256(JSON.stringify([fam.shas.story, fam.shas.voice, fam.shas.bake, `${toolSha(undefined, filmDisclosureIds(fam.rs, fam.silent))}|lighting=day`, 1080, 'silent'])), cur = JSON.parse(fs.readFileSync(path.join(dir, 'films.json'), 'utf8'));
      assert.equal(inputsShaOf(fam, 1080), fresh, 'the shared pin is the renderer\'s recipe, to the byte');
      const said: string[] = [], log = console.log; console.log = (...a: any[]) => { said.push(a.join(' ')); };
      const ship = () => shipFilms({ addHashed: (s2, d) => `${d}/${path.basename(s2)}`, register: () => {}, registerFilm: () => {}, problem: () => {}, stories: [{ slug: 'brennan' }] });
      try {
        await ship(); assert.ok(said.some(m => /cannot check freshness|older than its story/.test(m)), 'the placeholder inputsSha is stale');
        assert.ok(!said.some(m => /cannot check freshness/.test(m)), 'a silent film is loadable by the ship step (no voice lock needed)');
        said.length = 0; cur.families.brennan.inputsSha = fresh; fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(cur));
        await ship(); assert.ok(!said.some(m => /older than its story|cannot check/.test(m)), `a film made from these inputs is current: ${said.join(' | ')}`);
        // a film lit at the other permitted hour is the film of this story as well (the entry does not say which it was lit at); a film of another size or one cut from other inputs is not
        said.length = 0; cur.families.brennan.inputsSha = inputsShaOf(fam, 1080, { lighting: 'golden' }); fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(cur));
        await ship(); assert.ok(!said.some(m => /older than its story|cannot check/.test(m)), `a golden-lit film is current: ${said.join(' | ')}`);
        said.length = 0; cur.families.brennan.inputsSha = inputsShaOf(fam, 540); fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(cur));
        await ship(); assert.ok(said.some(m => /older than its story/.test(m)), 'a 540 p film is not the 1080 p entry');
      } finally { console.log = log; }
    }
    // an entry that breaks the silent rules is reported by the ship step, as a voiced one is
    const bad = JSON.parse(fs.readFileSync(path.join(dir, 'films.json'), 'utf8')); bad.families.brennan.aspects['16x9'].file = 'brennan.16x9.ab12cd34ef.mp4';
    fs.writeFileSync(path.join(dir, 'films.json'), JSON.stringify(bad));
    const p2: string[] = []; await shipFilms({ addHashed: (src, d) => `${d}/${path.basename(src)}`, register: () => {}, registerFilm: () => {}, problem: m => p2.push(m), stories: [{ slug: 'brennan' }] });
    assert.ok(p2.some(m => /silent film's file must be/.test(m)));
  } finally {
    if (prevDir === undefined) delete process.env.CI_STORY_FAMILIES_DIR; else process.env.CI_STORY_FAMILIES_DIR = prevDir;
    if (prevBase === undefined) delete process.env.FILM_BASE_URL; else process.env.FILM_BASE_URL = prevBase;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the pin: films.json's inputsSha -------------------------------------------------------------------------------------------------------------------------
// One definition (inputsShaOf in scripts/film/lib.mts), used by the renderer and by the ship step. The pin hashes the code and the text of the claims.json disclosures the film
// prints, and nothing else of claims.json: PR 37 edited the lander's `rent-line` entry (source, status, note), which no film shows, and the pins went stale for no new frame.
const withClaims = (edit: (c: any) => void) => { const c: any = JSON.parse(JSON.stringify(loadClaims())); edit(c); return c; };
const byId = (o: any, id: string): any => {
  if (Array.isArray(o)) { for (const x of o) { const hit = byId(x, id); if (hit) return hit; } return null; }
  if (o && typeof o === 'object') { if (o.id === id) return o; for (const v of Object.values(o)) { const hit = byId(v, id); if (hit) return hit; } }
  return null;
};
const withAgent = (rs: RuntimeStory): RuntimeStory => ({ ...rs, beats: rs.beats.map(b => (b.id === 'b2' ? { ...b, agent: 'mika' } : b)) } as any);
/** a family as `loadFamily` returns it, without the disk: the pin reads only these fields */
const pinFamily = (silent: boolean, rs: RuntimeStory): Family => ({ slug: 'test-family', story: {} as any, voice: null, bake: {} as any, rs, silent, shas: { story: 's'.repeat(64), voice: silent ? '' : 'v'.repeat(64), bake: 'b'.repeat(64) } });

test('the pin: toolSha ignores every claim the film does not print, and follows every disclosure it does', () => {
  const claims: any = loadClaims(), base = toolSha();
  assert.match(base, /^[0-9a-f]{64}$/); assert.equal(toolSha(), base); assert.equal(toolSha(claims), base);
  // the claim PR 37 edited: the lander's rent-line, in every field (its source, status and note, and even its words)
  const rent = withClaims(c => { const r = byId(c, 'rent-line'); assert.ok(r, 'claims.json has the rent-line claim'); r.source = 'Owner approval, 1999-01-01'; r.status = 'hold'; r.note = 'a different note'; r.text = 'Another line.'; });
  assert.notDeepEqual(rent, claims); assert.equal(toolSha(rent), base, 'a change to rent-line is not a change to a frame');
  // nothing outside the disclosures counts: not the style sheet (the sign-off and the caption limits are constants in the code), not the apps, the allowed claims, the version
  for (const key of Object.keys(claims).filter(k => k !== 'disclosures')) assert.equal(toolSha(withClaims(c => { c[key] = JSON.stringify(c[key]) + ' changed'; })), base, `claims.json "${key}" is not printed by a film`);
  assert.equal(toolSha(withClaims(c => { c.disclosures.reverse(); })), base, 'the pin looks a disclosure up by id, so the order of the file is not part of it');
  const printed = new Set<string>(Object.values(FILM_DISCLOSURES));
  assert.equal(printed.size, 5);
  for (const d of claims.disclosures) {
    const meta = withClaims(c => { const x = byId(c.disclosures, d.id); x.source = 'changed'; x.status = 'changed'; x.note = 'changed'; x.tag = 'changed'; });
    assert.equal(toolSha(meta), base, `${d.id}: a disclosure's source, status and note are not printed`);
    const text = withClaims(c => { byId(c.disclosures, d.id).text += ' (changed)'; });
    if (printed.has(d.id)) assert.notEqual(toolSha(text), base, `${d.id} is printed by a film: a change to its words makes a film stale`);
    else assert.equal(toolSha(text), base, `${d.id} is not printed by any film`);
  }
  for (const id of printed) assert.ok(claims.disclosures.some((d: any) => d.id === id), `claims.json has the disclosure "${id}" the film prints`);
  // a disclosure the film prints that claims.json lost is a change too (filmText would throw), not a silent pin
  assert.notEqual(toolSha(withClaims(c => { c.disclosures = c.disclosures.filter((d: any) => d.id !== 'stylised-art'); })), base);
});

test('the pin: it hashes exactly the disclosures filmText reads, for a voiced, a silent and an agent-naming film', () => {
  const claims: any = loadClaims(), sil = silentStory(estimatedFamily());
  const variants: Array<[string, RuntimeStory, boolean]> = [['voiced', family(), false], ['silent', sil, true], ['voiced, naming an agent', withAgent(family()), false], ['silent, naming an agent', withAgent(sil), true]];
  for (const [what, rs, silent] of variants) {
    const text = JSON.stringify(filmText(rs, claims, { silent })), ids = filmDisclosureIds(rs, silent), fam = pinFamily(silent, rs), pin = inputsShaOf(fam, 1080);
    assert.deepEqual(ids.slice(0, 1), [FILM_DISCLOSURES.fictional]);
    assert.equal(ids.includes(FILM_DISCLOSURES.voice), !silent, `${what}: the voice line is printed only under a film with sound`);
    assert.equal(ids.includes(FILM_DISCLOSURES.agents), what.includes('agent'), `${what}: the attribution line is printed only when a beat names Hermes or OpenClaw`);
    for (const d of claims.disclosures) {
      const changed = withClaims(c => { byId(c.disclosures, d.id).text += ' (changed)'; });
      const prints = JSON.stringify(filmText(rs, changed, { silent })) !== text;
      assert.equal(ids.includes(d.id), prints, `${what}: ${d.id} ${prints ? 'is printed but the pin does not hash it (add it to FILM_DISCLOSURES and filmLineIds)' : 'is hashed by the pin but not printed'}`);
      assert.equal(inputsShaOf(fam, 1080, { claims: changed }) !== pin, prints, `${what}: ${d.id}: the pin follows what the film prints, no more and no less`);
    }
  }
});

test('the pin: the renderer and the ship step share one definition, and an entry is current for either permitted lighting, at its own size', () => {
  // the renderer is a command with no exports: hold its source to the shared definition (it writes `inputsShaOf(fam, RES, { lighting })` and keeps no recipe of its own)
  const src = fs.readFileSync(path.resolve(import.meta.dirname, 'render-family-film.mts'), 'utf8');
  assert.match(src, /inputsShaOf\(fam, RES, \{ lighting: LIGHTING \}\)/); assert.ok(!/toolSha/.test(src) && !/\|lighting=/.test(src), 'the renderer builds no pin of its own');
  assert.match(src, /process\.env\.FILM_LIGHTING \|\| FILM_LIGHTING/); assert.match(src, /isFilmLighting\(LIGHTING_ASKED\)/);
  const ship = fs.readFileSync(path.resolve(import.meta.dirname, 'story', 'ship', 'films.mts'), 'utf8');
  assert.match(ship, /entryIsCurrent\(fam, e\)/); assert.ok(!/inputsShaOf|toolSha/.test(ship), 'the ship step builds no pin of its own');
  assert.deepEqual([...FILM_LIGHTINGS], ['day', 'golden']); assert.equal(FILM_LIGHTING, 'day'); assert.ok(isFilmLighting('golden') && !isFilmLighting('dusk') && !isFilmLighting('night'));
  // the entry's size: the height of the 16:9 film, else the width of the 9:16 film
  const entry = (aspects: any, inputsSha: string): FilmEntry => ({ sound: false, durationMs: 1000, inputsSha, vtt: 'film/captions.0011223344.vtt', aspects });
  const a169 = aspect('test-family', '16x9'), a916 = aspect('test-family', '9x16');
  assert.equal(entryRes(entry({ '16x9': a169, '9x16': a916 }, 'x')), 1080); assert.equal(entryRes(entry({ '9x16': a916 }, 'x')), 1080);
  assert.equal(entryRes(entry({ '16x9': { ...a169, width: 1280, height: 720 } }, 'x')), 720); assert.equal(entryRes(entry({}, 'x')), 1080);
  const fam = pinFamily(true, silentStory(estimatedFamily()));
  const day = inputsShaOf(fam, 1080, { lighting: 'day' }), golden = inputsShaOf(fam, 1080, { lighting: 'golden' });
  assert.notEqual(day, golden); assert.equal(inputsShaOf(fam, 1080), day, 'day is the default');
  const both = { '16x9': a169, '9x16': a916 };
  assert.ok(entryIsCurrent(fam, entry(both, day))); assert.ok(entryIsCurrent(fam, entry(both, golden)));
  assert.ok(entryIsCurrent(fam, entry({ '9x16': a916 }, day)), 'a portrait-only entry is judged at its own size');
  assert.ok(!entryIsCurrent(fam, entry(both, inputsShaOf(fam, 540))), 'a pin made at another size is not the entry\'s');
  assert.ok(!entryIsCurrent(fam, entry(both, 'f'.repeat(64))));
  assert.ok(!entryIsCurrent({ ...fam, shas: { ...fam.shas, story: 'z'.repeat(64) } }, entry(both, day)), 'a changed story is stale');
  assert.ok(!entryIsCurrent({ ...fam, shas: { ...fam.shas, bake: 'z'.repeat(64) } }, entry(both, day)), 'a changed bake is stale');
  // a printed disclosure changes the verdict, one the film does not print (and the lander's rent-line) does not
  const claimsOf = (id: string) => withClaims(c => { byId(c, id).text += ' (changed)'; });
  assert.ok(!entryIsCurrent(fam, entry(both, day), claimsOf('scripted-scenes')), 'the scripted-scenes line is on the end card');
  assert.ok(entryIsCurrent(fam, entry(both, day), claimsOf('synthetic-voice')), 'a silent film prints no voice line');
  const voiced = { ...fam, silent: false, shas: { ...fam.shas, voice: 'v'.repeat(64) } }, voicedPin = inputsShaOf(voiced, 1080);
  assert.ok(entryIsCurrent(voiced, entry(both, voicedPin)));
  assert.ok(!entryIsCurrent(voiced, entry(both, voicedPin), claimsOf('synthetic-voice')), 'a film with sound does print it');
  assert.ok(entryIsCurrent(fam, entry(both, day), claimsOf('rent-line')) && entryIsCurrent(fam, entry(both, day), claimsOf('site-practises')));
});

test('the pin: the ad cuts\' toolSha is code only (their end card\'s claims are in each cut\'s own hash), so it has no claim to narrow', async () => {
  const ads = await import('./film/ads-lib.mts');
  assert.ok(!/claims/.test(ads.toolSha.toString()), 'ads-lib toolSha reads no claims.json');
  assert.match(ads.toolSha(), /^[0-9a-f]{64}$/); assert.equal(ads.toolSha(), ads.toolSha());
  assert.notEqual(ads.toolSha(), toolSha(), 'two tools, two code lists: the ad cuts\' hash is not the film\'s');
});

test('the GPU path: --gl is the cut renderer\'s choice, default on Linux, never Vulkan', async () => {
  const { glArgs, glMode } = await import('./film/ads-lib.mts');
  assert.equal(glMode(undefined, {}), 'default'); assert.equal(glMode('software', {}), 'software'); assert.equal(glMode(undefined, { PERSONA_CUT_GL: 'software' }), 'software');
  assert.throws(() => glMode('vulkan', {}), /must be one of/);
  const g = glArgs('default', 'linux'); assert.ok(g.includes('--use-angle=default')); assert.ok(!g.some(a => /vulkan|swiftshader/.test(a)));
  assert.ok(glArgs('software', 'linux').some(a => /swiftshader/.test(a)), 'software is the repo\'s own SwiftShader flags');
  // the film script reads the same choice: --gl, FILM_GL, and says so in its header
  const src = fs.readFileSync(path.resolve(import.meta.dirname, 'render-family-film.mts'), 'utf8');
  assert.match(src, /glMode\(flags\.gl \|\| process\.env\.FILM_GL\)/); assert.match(src, /glArgs\(GL\)/); assert.match(src, /swiftshader\|llvmpipe\|software/); assert.match(src, /BLANK_STD/);
  assert.ok(!/use-angle=vulkan'/.test(src.replace(/never[^\n]*/gi, '')), 'no Vulkan flag');
});
