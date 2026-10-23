#!/usr/bin/env -S node --experimental-strip-types
// Tests for the film's PLATES (assets/story/film/plates/, scripts/film/plates/, scripts/story-film.mts): the overlay-free per-beat clips the CI-Common video-kit composes, and the plates.json v1 that
// carries their words. No GPU and no browser: the parts that are arithmetic, files and words.
//   * THE EXISTING FILM IS UNCHANGED. The plates add files and no byte to the film's path: every film on record is still current under the film's own pin (films.json, `entryIsCurrent`), the pin
//     walks no plates code, the film script does not know the plates, and `story:film` without `--plates` is the film script itself
//   * the sizes (landscape, portrait, square), the segments of the film's clock (a plate per beat and the approach, frame ranges that never overlap), what a plate's key is and is not a function of
//     (the camera, the house, the GPU path, the size: yes; a caption, a chip, a title: no), the doors' slice
//   * the words: the cues of a segment (cut at its edges, an agent's line marked scripted), the end card from claims.json, the apps with their real logos and the pair text the pair index allows,
//     the labelled screenshots only from the app-media manifest with its exact caption, no beta, no dash
//   * plates.json v1 for a family and for a home with no family: held to the kit's schema (a copy, closed), to the renderer's own copy rules and, when a kit is at hand ($CI_COMMON_KIT), to `ci-video import-home --dry-run`
//   * the encode: one H.264 yuv420p stream, bit-exact (the same frames, the same bytes)
//   * the fleet queue: its order, its state kept, a draft and a final kept apart
// Needs `pnpm run build` (the assets compile to .js) and ffmpeg for the encode and the kit contract tests (they skip without it).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { plateSize, squarePageRes, PAGE_RES, KIT_NAME } from '../assets/story/film/plates/format.js';
import { FILM } from '../assets/story/film/layout.js';
import { tiltTarget, tiltFor, clearBand, bandTop, KIT_BAND, KIT_CAPTION, KIT_CHARS, MAX_TILT_DEG } from '../assets/story/film/plates/compose.js';
import { camera, project } from '../assets/shot-probe.js';
import { ROOT, entryIsCurrent, loadFamily, readFilms, toolSha as filmToolSha, frameCodeFiles, NOT_FRAME_CODE, familiesDir } from './film/lib.mts';
import {
  segmentsOf, plateId, cameraFingerprint, powerRel, segmentKey, doorsSha, cuesOf, familyText, hookOf, chipsOf, loadCtx, manifestProblems, copyProblems, readableOf, cutPicks,
  plateEncodeArgs, ENCODE, engineSha, toolSha as platesToolSha, homeInfo, homeText, homesWithoutFamily, homeBeats, buildHomeManifest, homeFilmId, canon, digestOf, platesDir, DEFAULT_SUBJECT, composeBeat, oneLines,
  type Segment,
} from './film/plates/lib.mts';
import { parseOpts, planFamily, statusOf, writeFamilyManifest, plateFile, entryCurrent, parseAspects, kindOf, kitFilmSeconds, type Cache, type CacheEntry } from './film/plates/cli.mts';
import { checkPlates } from './film/plates/schema.mts';
import { orderOf, mergeQueue, modeEnv, readQueue, writeQueue, MODES, type Queue } from './film/plates/fleet.mts';
import { findKit } from './film/wrap.mts';
import { filmClock, sceneAt } from '../assets/story/film/layout.js';

let kit: ReturnType<typeof findKit> | null = null; try { kit = findKit(); } catch { /* no kit at hand */ }
const SCHEMA = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'film', 'plates', 'virtual-home-plates.schema.json'), 'utf8'));
const haveFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `plates-${name}-`));
const opts = (flags: Record<string, string> = {}) => parseOpts({ res: '540', ...flags }, () => {});
const withEnv = async <T,>(env: Record<string, string>, fn: () => Promise<T> | T): Promise<T> => {
  const old: Record<string, string | undefined> = {}; for (const k of Object.keys(env)) { old[k] = process.env[k]; process.env[k] = env[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(env)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};

// ---- the existing film is unchanged ---------------------------------------------------------------------------------------------------------------------
test('the film on record is unchanged: every entry of films.json is current under the film\'s own pin, so no hashed byte of the film moved', async () => {
  const films = readFilms(), slugs = Object.keys(films.families);
  assert.ok(slugs.length >= 3, 'the three Brennan films are on record');
  for (const slug of slugs) {
    const fam = await loadFamily(slug, { silent: true });
    assert.ok(entryIsCurrent(fam, films.families[slug]), `${slug}: films.json's inputsSha no longer matches the film's inputs (the film's code, its story, bake lock, printed disclosures or size changed): re-render it, or prove no frame input moved and re-pin`);
  }
});
test('the pin walks no plates code, and the film knows nothing of the plates', () => {
  const files = frameCodeFiles().map(f => path.relative(ROOT, f).split(path.sep).join('/'));
  assert.ok(files.includes('scripts/render-family-film.mts') && files.includes('assets/story/film/index.ts') && files.includes('assets/story/film/layout.ts') && files.includes('scripts/film/qa.mts'));
  for (const f of files) {
    assert.ok(!/\/plates\//.test(f) && !/wrap\.mts$/.test(f) && !/story-film\.mts$/.test(f), `${f} is read by the film's pin: plates code would make every film stale`);
    if (/\.(ts|mts)$/.test(f) && f !== 'scripts/film/lib.mts') {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.ok(!/film\/plates|plates\/(lib|cli|render|fleet)|film\/wrap|story-film/.test(src), `${f} imports or names the plates (the film must not depend on them)`);
    }
  }
  assert.deepEqual([...NOT_FRAME_CODE], ['wrap.mts'], 'only the wrap, which runs after the plates on the kit\'s output, is outside the film\'s pin');
  // every file in scripts/film is either read by the pin or named as not a frame input
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts', 'film')).filter(f => f.endsWith('.mts'))) assert.ok(files.includes(`scripts/film/${f}`) || NOT_FRAME_CODE.includes(f), `scripts/film/${f} is neither read by the pin nor listed as not a frame input`);
  assert.match(filmToolSha(), /^[0-9a-f]{64}$/);
});
test('`story:film` without --plates is the film script, run as it was', () => {
  const door = fs.readFileSync(path.join(ROOT, 'scripts', 'story-film.mts'), 'utf8');
  assert.match(door, /argv\.includes\('--plates'\)/); assert.match(door, /import\('\.\/render-family-film\.mts'\)/); assert.match(door, /import\('\.\/film\/plates\/cli\.mts'\)/);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  assert.match(pkg['story:film'], /scripts\/story-film\.mts$/); assert.match(pkg['story:film:fleet'], /plates\/fleet\.mts$/); assert.match(pkg['story:film:wrap'], /film\/wrap\.mts$/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'scripts', 'film-bookends.mts')), 'film-bookends.mts is replaced by scripts/film/wrap.mts');
  // the plates' page module imports the film's, never the other way, and edits none of the page's offline hooks
  const page = fs.readFileSync(path.join(ROOT, 'assets', 'story', 'film', 'plates', 'index.ts'), 'utf8');
  assert.match(page, /from '\.\.\/index\.js'/); assert.ok(!/__houseRenderBegin\s*=|__houseRenderFrames\s*=/.test(page));
});

// ---- sizes and segments ----------------------------------------------------------------------------------------------------------------------------------------
test('the sizes: landscape and portrait as the film, a square the page can draw, a res the page does not know is refused', () => {
  assert.deepEqual([plateSize('16x9', 1080).w, plateSize('16x9', 1080).h], [1920, 1080]);
  assert.deepEqual([plateSize('9x16', 1080).w, plateSize('9x16', 1080).h], [1080, 1920]);
  assert.deepEqual([plateSize('16x9', 540).w, plateSize('16x9', 540).h], [960, 540]);
  assert.deepEqual([plateSize('9x16', 540).w, plateSize('9x16', 540).h], [540, 960]);
  // the page's 1:1 is as wide as its 16:9 (a 1920 square at 1080): a square plate asks for the 720 size instead, a 1280 square (the kit's canvas is 1080)
  assert.equal(squarePageRes(1080), 720); assert.deepEqual([plateSize('1x1', 1080).w, plateSize('1x1', 1080).h], [1280, 1280]);
  assert.deepEqual([plateSize('1x1', 540).w, plateSize('1x1', 540).h], [960, 960]);
  for (const r of PAGE_RES) for (const k of ['16x9', '9x16', '1x1'] as const) { const z = plateSize(k, r); assert.ok(z.w % 2 === 0 && z.h % 2 === 0, `${k} ${r}: even`); assert.ok(Math.abs(z.aspect - (k === '16x9' ? 16 / 9 : k === '9x16' ? 9 / 16 : 1)) < 0.01); }
  assert.throws(() => plateSize('16x9', 480), /--res/);
  assert.deepEqual(Object.values(KIT_NAME), ['landscape', 'portrait', 'square']);
});

test('the segments of the film\'s clock: the approach, then a plate for each beat the film plays, in frames that never overlap and always lie inside the film', async () => {
  const fam = await loadFamily('brennan', { silent: true }), clock = filmClock(fam.rs, { silent: true }), segs = segmentsOf(clock);
  assert.equal(segs[0].id, 'approach'); assert.equal(segs[0].f0, 0); assert.equal(segs[0].frames, FILM.titleS * FILM.fps);
  assert.equal(segs.length, clock.parts.length + 1);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]; assert.ok(s.f0 >= 0 && s.f1 <= clock.frames && s.frames > 0, `${s.id}: inside the film`);
    if (i) assert.ok(s.f0 >= segs[i - 1].f1, `${s.id} starts after ${segs[i - 1].id} ends`);
    assert.equal(s.frames, s.f1 - s.f0); assert.equal(s.durationS, Math.round(s.frames / FILM.fps * 1000) / 1000);
    if (s.part) { assert.ok(Math.abs(s.frames / FILM.fps - (s.part.end - s.part.at)) < 1 / FILM.fps + 1e-6, `${s.id}: its length is its part's, to a frame`); assert.equal(sceneAt(clock, s.f0 / FILM.fps).kind, 'part'); assert.equal(sceneAt(clock, (s.f1 - 1) / FILM.fps).kind, 'part'); }
  }
  // the kit's own scene ids are never a beat's
  for (const id of ['title', 'hook', 'apps', 'apps-2', 'proof-1', 'close', 'plainly', 'label']) assert.equal(plateId(id), `${id}-beat`);
  assert.equal(plateId('ftue-plug-in'), 'ftue-plug-in');
});

// ---- composing for the kit's text -----------------------------------------------------------------------------------------------------------------------
test('a tilt turns the camera down about its own right axis: the distance to the target is kept, the picture goes up, a straight look up or down is left alone', () => {
  const eye: [number, number, number] = [1, 1.6, 2], target: [number, number, number] = [4, 1.2, 6], d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.deepEqual(tiltTarget(eye, target, 0), target);
  const t = tiltTarget(eye, target, 0.2);
  assert.ok(Math.abs(d(eye, t) - d(eye, target)) < 1e-9, 'the same distance');
  assert.ok(t[1] < target[1], 'looking lower');
  // what was at the middle of the frame is now `shift` frame heights up: tan(tilt) = 2 * shift * tan(fov / 2)
  const fov = 46, shift = 0.1, cam = camera(eye, tiltTarget(eye, target, tiltFor(shift, fov)), fov, 16 / 9), p = project(cam, target);
  assert.ok(Math.abs(p[1] - 2 * shift) < 0.02, `the old centre is ${(p[1] / 2).toFixed(3)} frame heights up, wanted ${shift}`);
  assert.ok(Math.abs(p[0]) < 1e-6, 'and no sideways');
  assert.deepEqual(tiltTarget([0, 0, 0], [0, 5, 0], 0.3), [0, 5, 0], 'straight up: no right axis, no tilt');
});
test('clearing the band: a subject above it is left, one in it is carried up as far as the room and the tilt limit allow, and it says so when it does not make it', () => {
  assert.deepEqual(clearBand({ top: 0.2, bottom: 0.7, band: 0.767, fovDeg: 46 }), { tilt: 0, shift: 0, cleared: true });
  const c = clearBand({ top: 0.3, bottom: 0.9, band: 0.767, fovDeg: 46 });
  assert.ok(c.cleared && Math.abs(c.shift - (0.9 - (0.767 - 0.012))) < 1e-3 && c.tilt > 0);
  const tall = clearBand({ top: 0.1, bottom: 1.05, band: 0.767, fovDeg: 46 });
  assert.ok(!tall.cleared, 'the room above is only 0.07'); assert.ok(tall.shift <= 0.1 - 0.03 + 1e-9, 'the top never goes above its limit');
  const wide = clearBand({ top: 0.5, bottom: 1.5, band: 0.767, fovDeg: 80 });
  assert.ok(wide.tilt <= MAX_TILT_DEG * Math.PI / 180 + 1e-9 && !wide.cleared, `never more than ${MAX_TILT_DEG} degrees`);
  assert.ok(Math.abs(tiltFor(0.24, 46) * 180 / Math.PI - 11.8) < 0.3);
});
test('the kit\'s band: the caption and the cues set where its text begins, in each format', () => {
  assert.equal(bandTop('16x9', 'Plug it in beside the lamp', ['Steve plugs the Core in by the desk lamp.']), 0.767, 'a one-line caption over one-line cues in 16:9');
  assert.equal(bandTop('16x9', 'x'.repeat(80), ['a'.repeat(40)]), 0.716, 'a caption of two lines');
  assert.equal(bandTop('16x9', 'Wrenfield', []), KIT_CAPTION['16x9']['1'], 'no cues: the caption block alone');
  assert.ok(bandTop('9x16', 'Short', ['a'.repeat(60)]) < bandTop('9x16', 'Short', ['a'.repeat(20)]), 'a longer cue is a taller box and the band begins higher');
  for (const k of ['16x9', '9x16', '1x1'] as const) { assert.ok(KIT_BAND[k]['22'] < KIT_BAND[k]['11'] && KIT_CAPTION[k]['2'] < KIT_CAPTION[k]['1']); assert.ok(KIT_CHARS[k].cue < KIT_CHARS[k].caption); }
});
test('the table is the kit\'s: the band of each format, as video-kit computes it, is the one the plates are composed against', { skip: (!kit && 'no video-kit >= 0.35 ($CI_COMMON_KIT)') }, async () => {
  const dir = path.dirname(path.dirname(kit!.bin)), src = path.join(dir, 'src');
  const { captionRect, subtitleRect } = await import(path.join(src, 'subject.ts')), { formatFor } = await import(path.join(src, 'brand.ts')), { CAPTION_CHAR_EM, burnWidthFor } = await import(path.join(src, 'subtitles.ts'));
  const sb = { meta: {}, formats: ['landscape', 'portrait', 'square'], scenes: [] };
  for (const [k, name] of [['16x9', 'landscape'], ['9x16', 'portrait'], ['1x1', 'square']] as const) {
    const fm = formatFor(sb, name);
    assert.equal(Math.floor((fm.w - 2 * fm.padX) / (fm.captionSize * CAPTION_CHAR_EM)), KIT_CHARS[k].caption, `${k}: characters a caption line holds`);
    assert.equal(burnWidthFor(fm), KIT_CHARS[k].cue, `${k}: characters a subtitle line burns`);
    for (const capLines of [1, 2]) for (const cueLines of [1, 2]) {
      const cap = 'x'.repeat(capLines === 1 ? 10 : Math.ceil(2 * (fm.w - 2 * fm.padX) / (fm.captionSize * CAPTION_CHAR_EM)) - 2), scene = { id: 's', kind: 'clip', caption: cap, chapter: 'sally' };
      const top = Math.min(captionRect(scene, fm, true).y, subtitleRect(scene, fm, cueLines).y) / fm.h;
      assert.ok(Math.abs(top - KIT_BAND[k][`${capLines}${cueLines}`]) < 0.002, `${k} ${capLines}${cueLines}: the kit's band begins at ${top.toFixed(3)}, the table says ${KIT_BAND[k][`${capLines}${cueLines}`]}`);
    }
    const noBadge = captionRect({ id: 's', kind: 'clip', caption: 'x'.repeat(10), chapter: 'sally' }, fm, true).y / fm.h;
    assert.ok(Math.abs(noBadge - KIT_CAPTION[k]['1']) < 0.002, `${k}: the caption block alone`);
  }
});
test('the Brennan plates are composed for the kit: every film beat\'s subject is clear of the kit\'s text in every aspect, by a tilt of at most 14 degrees, and its cues are one line', async () => {
  const o = opts({ aspect: 'all' }), plan = await planFamily('brennan', o, 'chromium-test');
  let tilted = 0;
  for (const [aspect, jobs] of Object.entries(plan.jobs)) for (const j of jobs) {
    if (!j.compose) { assert.equal(j.seg.id, 'approach'); continue; }
    const c = j.compose, r = c.subject;
    assert.ok(c.cleared, `${aspect} ${j.seg.id}: not clear of the kit's band`); assert.ok(r.y + r.h <= c.band + 1e-6, `${aspect} ${j.seg.id}: the subject reaches ${r.y + r.h} and the kit's text begins at ${c.band}`);
    assert.ok(c.tilt >= 0 && c.tilt <= MAX_TILT_DEG * Math.PI / 180 + 1e-9, `${aspect} ${j.seg.id}: tilt ${c.tilt}`);
    assert.equal(j.tilt, c.tilt); if (c.tilt) tilted++;
    // the tilt is in the plate's key (a plate drawn at another tilt is another plate)
    const flat = cameraFingerprint(plan.fam.rs, plan.clock, j.seg, j.size.aspect, 0), tiltFp = cameraFingerprint(plan.fam.rs, plan.clock, j.seg, j.size.aspect, c.tilt);
    assert.equal(flat === tiltFp, !c.tilt);
    assert.equal(j.camera, tiltFp);
  }
  assert.ok(tilted > 0, 'some beats of the Brennans have a subject that reaches the kit\'s band');
  // an approach plate is the film's camera as it is
  assert.equal(plan.jobs['16x9'][0].tilt, 0);
  // the cues are cut to one line of the kit's width, so its subtitle box is one line tall
  const cues = plan.cues, seg = plan.segs[3], got = cuesOf(cues, seg, 30);
  assert.ok(got.length > 0); for (const c of got) assert.ok(c.text.length <= 42 + ' (scripted)'.length + 12, `${c.text.length}: ${c.text}`);
  for (let i = 1; i < got.length; i++) assert.ok(got[i].fromS >= got[i - 1].toS - 1e-9);
});

test('a subject that fills the frame (the room the camera stands in) is the point the tour looks at: the rectangle is a third of the frame about the focus, and says so', async () => {
  const plan = await planFamily('brennan-hollin', opts({ aspect: 'all' }), 'chromium-test'), room = plan.jobs['16x9'].find(j => j.seg.id === 'kids-notes')!;
  assert.ok(room, 'the Hollins\' kids-notes beat is in the film');
  for (const [aspect, jobs] of Object.entries(plan.jobs)) {
    const c = jobs.find(j => j.seg.id === 'kids-notes')!.compose!;
    assert.ok(c.cleared, `${aspect}: clear of the kit's text`); assert.equal((c.camera as any).subjectKind, 'focus', `${aspect}: the anchor is the whole room, so the plate is about the focus`);
    assert.ok(c.subject.w < 0.45 && c.subject.h < 0.45, `${aspect}: a third of the frame, not all of it (${c.subject.w} x ${c.subject.h})`);
  }
  // a beat with a real anchor keeps it
  const desk = (await planFamily('brennan', opts(), 'chromium-test')).jobs['16x9'].find(j => j.seg.id === 'office-split')!.compose!;
  assert.equal((desk.camera as any).subjectKind, 'anchor');
});

// ---- the key ---------------------------------------------------------------------------------------------------------------------------------------------------------
test('what makes a plate current: the camera, the house, the engine, the GPU path, the size and the light move its key; a word does not', async () => {
  const fam = await loadFamily('brennan', { silent: true }), clock = filmClock(fam.rs, { silent: true }), seg = segmentsOf(clock)[2], z = plateSize('16x9', 540);
  const base = { house: 'h', engine: 'e', tool: 't', gl: 'default', chromium: 'chromium-1', aspect: '16x9' as const, w: z.w, h: z.h, fps: 30, lighting: 'day', frames: seg.frames, camera: cameraFingerprint(fam.rs, clock, seg, z.aspect), power: powerRel(fam.rs, clock, seg) };
  const k = segmentKey(base);
  assert.match(k, /^[0-9a-f]{64}$/); assert.equal(segmentKey({ ...base }), k, 'stable');
  for (const [name, change] of Object.entries({ house: { house: 'h2' }, engine: { engine: 'e2' }, tool: { tool: 't2' }, gl: { gl: 'nvidia' }, chromium: { chromium: 'chromium-2' }, size: { w: 1920, h: 1080 }, fps: { fps: 24 }, frames: { frames: base.frames + 1 }, aspect: { aspect: '9x16' as const }, lighting: { lighting: 'golden' } }))
    assert.notEqual(segmentKey({ ...base, ...change }), k, `${name} is part of the key`);
  const other = segmentsOf(clock)[3];
  assert.notEqual(cameraFingerprint(fam.rs, clock, other, z.aspect), base.camera, 'another beat is another camera');
  assert.notEqual(cameraFingerprint(fam.rs, clock, seg, plateSize('9x16', 540).aspect), base.camera, 'another aspect is another camera (the bake composes rows for each)');
  // a copy edit that touches no pixel: the family's words are not in the key (it has no field for them)
  assert.ok(!/title|body|chip|cue|caption|disclosure/i.test(Object.keys(base).join(',')));
  assert.match(engineSha(), /^[0-9a-f]{64}$/); assert.match(platesToolSha(), /^[0-9a-f]{64}$/); assert.equal(engineSha(), engineSha());
});
test('the doors: a segment is current only if the door angles the whole path plans for its frames are the ones it was drawn with', () => {
  const seg = { id: 'x', kind: 'beat', part: null, f0: 100, f1: 130, frames: 30, durationS: 1 } as Segment;
  const doors = { a: Array.from({ length: 300 }, (_, i) => (i < 110 ? 0 : 1.2)) };
  const same = doorsSha(doors, seg);
  assert.equal(doorsSha({ a: doors.a.map((v, i) => (i === 250 ? 9 : v)) }, seg), same, 'a door that moves after the segment is not the segment\'s');
  assert.notEqual(doorsSha({ a: doors.a.map((v, i) => (i === 115 ? 9 : v)) }, seg), same, 'a door that moves inside it is');
  assert.notEqual(doorsSha({ a: doors.a.map((v, i) => (i === 99 ? 9 : v)) }, seg), same, 'one frame before it is read too (the page interpolates)');
  assert.equal(doorsSha(null, seg), doorsSha({}, seg));
});

// ---- the words -----------------------------------------------------------------------------------------------------------------------------------------------------
test('the cues of a segment: on the plate\'s clock, cut at its edges, never overlapping, an agent\'s line marked scripted once', () => {
  const seg = { id: 'x', kind: 'beat', part: null, f0: 300, f1: 450, frames: 150, durationS: 5 } as Segment;      // film seconds 10 to 15
  const cue = (start: number, end: number, text: string, speaker: string | null = null, clip = 'c') => ({ start, end, text, speaker, clip, words: [], scripted: !!speaker });
  const out = cuesOf([cue(8, 9.5, 'before'), cue(9.5, 10.6, 'straddles the start'), cue(11, 12, 'inside'), cue(12.2, 13.5, 'Hello there', 'Juniper', 'x.say'), cue(13.5, 14.5, 'and more', 'Juniper', 'x.say'), cue(14.6, 16, 'straddles the end'), cue(16, 17, 'after')], seg, 30);
  assert.deepEqual(out.map(c => c.text), ['straddles the start', 'inside', 'Juniper (scripted): Hello there', 'Juniper: and more', 'straddles the end']);
  assert.equal(out[0].fromS, 0); assert.ok(out[0].toS > 0.5);
  assert.ok(out[out.length - 1].toS <= 5 + 1e-9, 'none past the end of the plate');
  for (let i = 1; i < out.length; i++) assert.ok(out[i].fromS >= out[i - 1].toS - 1e-9, 'one cue at a time');
});
test('a line is broken at the end of a phrase, not after "no" or "the", and every line fits', () => {
  const toks = (t: string) => t.split(' ').map((w, i) => ({ text: w, s: i * 0.3, e: i * 0.3 + 0.25 }));
  const lines = (t: string) => oneLines(toks(t), 42).map(l => l.map(w => w.text).join(' '));
  assert.deepEqual(lines('John\u2019s book catalogue no longer lives in a cloud service.'), ['John\u2019s book catalogue no longer', 'lives in a cloud service.']);
  assert.deepEqual(lines('Short line.'), ['Short line.']);
  assert.deepEqual(lines('Sally splits a client PDF. Then she sends it.'), ['Sally splits a client PDF.', 'Then she sends it.'], 'sentences first');
  for (const l of lines('The Core wakes, and it opens its own Wi-Fi network for the family to join from a phone.')) assert.ok(l.length <= 42 || !l.includes(' '), l);
  assert.ok(!lines('Jean saves a page to the reading list so that she can come back to it later.').some(l => /\b(the|a|to|so that)$/.test(l)), 'no line ends on a small word when a better break is near');
});
test('the end card is claims.json\'s: the sanctioned lines of a silent family film, no voice line, no beta, and the cleared claim the cuts open on', async () => {
  const fam = await loadFamily('brennan', { silent: true }), claims: any = (loadCtx(ROOT, [fam.story])).claims, t = familyText(fam.rs, claims);
  assert.equal(t.label, 'Fictional family. Real software.'); assert.equal(t.cta, 'UnCloud your life.'); assert.equal(t.tagline, 'See Companion Core'); assert.equal(t.link, 'ci.computer/core');
  assert.deepEqual(t.disclosures.map(d => d.id), ['fictional-family', 'scripted-scenes', 'stylised-art', 'attribution-agents'], 'the Brennans name an agent, so its attribution is on the end card; a silent film has no voice line');
  for (const d of t.disclosures) assert.equal(d.text, claims.disclosures.find((x: any) => x.id === d.id).text);
  assert.ok(!t.disclosures.some(d => /beta/i.test(d.text)));
  assert.deepEqual(t.hook, { text: 'Stop renting your intelligence.', accent: 'renting' });
  assert.deepEqual(hookOf({ allowedClaims: [{ id: 'rent-line', text: 'Stop renting your intelligence.', status: 'hold' }] }), {}, 'a claim on hold is not used');
  assert.deepEqual(hookOf({ allowedClaims: [] }), {});
});
test('the apps: the real logo beside the name, the pair as "<app>, alternative to <service>" only when the pair index lets a page show it, an app that is not in the live store left out', async () => {
  const fam = await loadFamily('brennan', { silent: true }), ctx = loadCtx(ROOT, [fam.story]), notes: string[] = [];
  const b = fam.rs.beats.find(x => x.id === 'office-split')!, chips = chipsOf(fam.story, b as any, ctx, notes);
  assert.equal(chips.length, 1); assert.equal(chips[0].app, 'Stirling-PDF'); assert.equal(chips[0].id, 'stirling-pdf');
  assert.ok(!chips[0].pairText || chips[0].pairText === 'Stirling-PDF, alternative to Smallpdf', 'the pair is written the way the pair index writes it');
  for (const c of chips) if (c.pairText) { assert.ok(c.pairText.startsWith(`${c.app}, alternative to `)); assert.ok(!/replac/i.test(c.pairText)); }
  // an app outside the live store is left out and said
  const dead = loadCtx(ROOT, [fam.story]); dead.catalog.set('stirling-pdf', { ...dead.catalog.get('stirling-pdf')!, inLiveStore: false });
  const n2: string[] = []; assert.equal(chipsOf(fam.story, b as any, dead, n2).length, 0); assert.match(n2[0], /not in the live store/);
  // one app is described one way in every beat of the film (its first shown pair)
  const seen = new Map<string, string | undefined>();
  for (const x of fam.rs.beats) for (const c of chipsOf(fam.story, x as any, ctx, [])) { if (seen.has(c.app)) assert.equal(seen.get(c.app), c.pairText); seen.set(c.app, c.pairText); }
});
test('the copy rules: the word beta, a dash, an exclamation mark and a banned phrase fail; a home\'s display name is the portal\'s own word', () => {
  const claims: any = loadCtx(ROOT).claims;
  assert.deepEqual(copyProblems([['a', 'Plug it in beside the lamp']], claims, []), []);
  assert.ok(copyProblems([['a', 'Companion OS is in beta.']], claims, []).some(p => /beta/.test(p)));
  assert.ok(copyProblems([['a', 'Plug it in — now']], claims, []).length);
  assert.ok(copyProblems([['a', 'It works!']], claims, []).length);
  assert.ok(copyProblems([['a', 'Open WebUI replaces ChatGPT and saves money']], claims, []).length);
  assert.deepEqual(copyProblems([['a', 'Garden Flat']], claims), [], 'a display name passes');
});
test('cut picks: one beat per person that shows an app, portrait plates only', () => {
  const p = { landscape: {} as any, portrait: {} as any }, mk = (id: string, m: string | null, chips: number) => ({ id, member: m ? { id: m, name: m } : null, title: id, chips: Array.from({ length: chips }, () => ({ app: 'A' })), plates: p });
  assert.deepEqual(cutPicks([mk('a', null, 0), mk('b', 'x', 0), mk('c', 'x', 1), mk('d', 'y', 2), mk('e', 'x', 1)] as any), { '15': ['c'], '30': ['c', 'd'] });
  assert.deepEqual(cutPicks([mk('a', null, 0)] as any), {});
});

// ---- the manifest ------------------------------------------------------------------------------------------------------------------------------------------------
/** A cache as if every plate of a plan had been drawn: the manifest reads only what the cache records (never the plate), so the entries can be made up. */
function fakeCache(plan: Awaited<ReturnType<typeof planFamily>>): Cache {
  const entries: Record<string, CacheEntry> = {};
  for (const [aspect, jobs] of Object.entries(plan.jobs)) for (const j of jobs) entries[`${aspect}/${j.seg.id}`] = { key: j.key, doorsSha: null, file: plateFile(aspect as any, j.seg.id, j.key), sha256: digestOf([aspect, j.seg.id]), frames: j.seg.frames, durationS: j.seg.durationS, bytes: 1, width: j.size.w, height: j.size.h, gl: 'default', renderer: 'test renderer', wallSeconds: 1 };
  return { v: 1, id: plan.fam.slug, pathShas: { ...plan.pathShas }, entries };
}
test('plates.json for a family: closed, in the kit\'s schema, in the film\'s words, the kit\'s own rules met', async () => {
  const dir = tmp('manifest');
  await withEnv({ CI_PLATES_OUT: dir }, async () => {
    const o = opts(), plan = await planFamily('brennan', o, 'chromium-test'), cache = fakeCache(plan), logs: string[] = [];
    const m = writeFamilyManifest(plan, cache, { chromium: 'test', ffmpeg: 'ffmpeg test', gl: 'default' }, { ...o, log: (x: string) => logs.push(x) }, x => logs.push(x));
    assert.deepEqual(checkPlates(m, SCHEMA), []);
    assert.equal(m.v, 1); assert.equal(m.kind, 'family-film'); assert.equal(m.id, 'brennan'); assert.equal(m.lighting, 'day'); assert.equal(m.fps, 30); assert.equal(m.audio, null);
    assert.equal(m.displayName, 'The Brennan family of Wrenfield'); assert.equal(m.family.name, 'The Brennan family'); assert.equal(m.text.link, 'ci.computer/core');
    assert.equal(m.beats[0].id, 'approach'); assert.equal(m.beats[0].member, null); assert.equal(m.beats[0].title, 'Wrenfield');
    assert.equal(m.beats.length, plan.segs.length);
    for (const b of m.beats) {
      assert.deepEqual(Object.keys(b.plates).sort(), ['landscape', 'portrait']);
      for (const [a, p] of Object.entries<any>(b.plates)) {
        assert.ok(p.file.startsWith(`plates/${a}/`) && p.file.endsWith('.mp4') && !p.file.includes('..')); assert.match(p.sha256, /^[0-9a-f]{64}$/);
        assert.ok(p.subject.x >= 0 && p.subject.y >= 0 && p.subject.x + p.subject.w <= 1 + 1e-9 && p.subject.y + p.subject.h <= 1 + 1e-9, `${b.id} ${a}: a subject inside the frame`);
      }
      assert.equal(b.plates.landscape.durationS, b.plates.portrait.durationS, 'the aspects share one clock');
      for (const c of b.chips) { assert.ok(c.app); if (c.logo) { assert.match(c.logo, /^logos\/[a-z0-9-]+\.[0-9a-f]{10}\.webp$/); assert.ok(fs.existsSync(path.join(platesDir('brennan'), c.logo)), 'the real logo is beside the manifest'); } }
    }
    // every film beat that has an app shows it as a chip, its words are the story's, and the cues are on its own clock
    const split = m.beats.find((b: any) => b.id === 'office-split'); assert.equal(split.member.id, 'sally'); assert.equal(split.chips[0].app, 'Stirling-PDF'); assert.ok(split.title && split.body && split.cues.length);
    for (const c of split.cues) assert.ok(c.fromS >= 0 && c.toS <= split.plates.landscape.durationS + 1e-9);
    assert.deepEqual(m.text.disclosures.map((d: any) => d.id), ['fictional-family', 'scripted-scenes', 'stylised-art', 'attribution-agents']);
    assert.deepEqual(manifestProblems(m, plan.ctx.claims as any), []);
    for (const [where, t] of readableOf(m)) assert.ok(!/beta|[–—]|!/i.test(t), `${where}: ${t}`);
    // the file is on disk, last, and equal to what was returned
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(platesDir('brennan'), 'plates.json'), 'utf8')), m);
    // cuts are the editorial picks, the hook is the cleared claim
    assert.ok(m.cuts && m.cuts['15'].length === 1); assert.deepEqual(m.text.hook, { text: 'Stop renting your intelligence.', accent: 'renting' });
    // a plate is current while its file is the bytes recorded; the keys of the plan are the cache's
    assert.ok(statusOf('brennan', plan.jobs, cache, false).every(s => !s.current), 'nothing was drawn: the cache names files that are not there');
  });
});
test('the screenshots: only the app-media manifest\'s own, with its exact caption, whole, and no more than the film can bear', async () => {
  const dir = tmp('inserts');
  await withEnv({ CI_PLATES_OUT: dir }, async () => {
    const media = loadCtx(ROOT).media, withShot = media && Object.entries(media.apps).filter(([, a]) => a.shot);
    assert.ok(withShot && withShot.length, 'the manifest ships real screenshots');
    for (const [, a] of withShot!) assert.equal(a.shot!.caption, `Real screenshot of ${a.name} from a Companion Hub QA run. Not a recording of this family.`);
    // the families whose film beats name an app that has a shot: each manifest keeps to the rules, and a film with no room for a screenshot (the kit adds a title, the apps, the end card and the disclosures
    // to the plates, and a film is at most 110 s) writes none and says so
    let withInserts = 0, dropped = 0;
    for (const f of fs.readdirSync(familiesDir()).filter(x => x.endsWith('.bake.json')).sort().slice(0, 40)) {
      const slug = f.replace(/\.bake\.json$/, ''), s = JSON.parse(fs.readFileSync(path.join(familiesDir(), `${slug}.json`), 'utf8'));
      const ids = new Set<string>(); for (const b of s.beats) if (b.film) for (const id of [b.app?.id, ...(b.with || [])]) if (id) ids.add(id);
      if (![...ids].some(id => media!.apps[id]?.shot)) continue;
      const o = opts({ inserts: '2' }), plan = await planFamily(slug, o, 'chromium-test'), logs: string[] = [], m = writeFamilyManifest(plan, fakeCache(plan), null, o, x => logs.push(x));
      assert.deepEqual(checkPlates(m, SCHEMA), [], slug);
      if (!m.inserts) { dropped++; assert.ok(logs.some(l => /would run past 110 s/.test(l)), `${slug}: no screenshot and no reason`); continue; }
      withInserts++; assert.ok(m.inserts.length <= 2);
      for (const ins of m.inserts) { assert.equal(ins.label, `Real screenshot of ${ins.app} from a Companion Hub QA run. Not a recording of this family.`); assert.match(ins.file, /^inserts\/shot-[a-z0-9-]+\.[0-9a-f]{10}\.webp$/); assert.ok(fs.readFileSync(path.join(platesDir(slug), ins.file)).length > 0); assert.ok(ins.alt); assert.ok(ins.width > 0 && ins.height > 0); }
      const none = writeFamilyManifest(plan, fakeCache(plan), null, opts({ inserts: '0' }), () => {});
      assert.ok(!none.inserts, 'no screenshots when none are asked for');
      break;
    }
    assert.ok(withInserts + dropped > 0, 'some family names an app with a screenshot');
  });
});
test('the length of the kit\'s film is counted before a screenshot is added: the title, the plates, the apps, the screenshots, the end card and the disclosures held for reading', () => {
  assert.ok(kitFilmSeconds(85, 5, 0, 52) > 105 && kitFilmSeconds(85, 5, 0, 52) < 120);
  assert.equal(kitFilmSeconds(60, 0, 0, 4), 3 + 60 + 0 + 0 + 4 + 5, 'a home with no apps: the title, the plates, the end card and the five seconds the disclosures are held at least');
  assert.ok(kitFilmSeconds(60, 5, 2, 20) - kitFilmSeconds(60, 5, 0, 20) === 12, 'each screenshot is six seconds');
});
test('plates.json for a home with no family: its name and its kind of place, its own shots, the stylised-Core line, nothing invented', () => {
  const homes = homesWithoutFamily();
  assert.deepEqual(homes, ['city-one-bed', 'corner-penthouse', 'garden-flat', 'studio-loft', 'two-bed-flat', 'walkup-duplex']);
  const info = homeInfo('garden-flat');
  assert.deepEqual([info.id, info.name, info.type, info.label], ['garden-flat', 'Garden Flat', 'apartment', 'Apartment']);
  assert.equal(homeInfo('studio-loft').name, 'Warehouse Loft'); assert.equal(homeInfo('studio-loft').id, 'warehouse-loft', 'a home is filmed under its display name, not the name its spec was filed under');
  assert.equal(homeFilmId({ id: 'x', name: 'BG Modern Asymmetry House' }), 'modern-asymmetry-house');
  const claims: any = loadCtx(ROOT).claims, text = homeText(info, claims);
  assert.deepEqual(text.disclosures.map(d => d.id), ['stylised-art']); assert.equal(text.label, 'Garden Flat'); assert.equal(text.link, 'ci.computer/core'); assert.equal(text.cta, 'UnCloud your life.'); assert.ok(!text.hook, 'no claim is made about a home');
  const plate = (a: string, w: number, h: number) => ({ file: `plates/${a}/door-to-core.0123abcd.mp4`, sha256: 'a'.repeat(64), durationS: 21.5, width: w, height: h, subject: DEFAULT_SUBJECT[a === 'landscape' ? '16x9' : '9x16'], camera: { preset: 'door-to-core' } });
  const beats = homeBeats(info, ['door-to-core', 'orbit'], () => ({ landscape: plate('landscape', 960, 540), portrait: plate('portrait', 540, 960) }) as any);
  const m = buildHomeManifest({ info, beats, text, profile: { chromium: 'c', renderer: 'r', ffmpeg: 'f', gl: 'default' }, lighting: 'day', platesSha: 'a'.repeat(16), claimsSha: 'b'.repeat(16), inputsSha: 'c'.repeat(16) });
  assert.deepEqual(checkPlates(m, SCHEMA), []); assert.equal(m.kind, 'home-tour'); assert.equal(m.family, null); assert.equal(m.id, 'garden-flat');
  assert.deepEqual(manifestProblems(m, claims), []);
  // the only words a viewer reads: the name, the kind of place, the sanctioned end card
  const words = readableOf(m).map(([, t]) => t);
  assert.deepEqual([...new Set(words)].sort(), ['Apartment', 'Garden Flat', 'See Companion Core', 'The Companion Core is drawn as a stylised illustration, not a photograph.', 'UnCloud your life.'].sort());
  for (const b of m.beats) { assert.equal(b.member, null); assert.deepEqual(b.chips, []); assert.ok(!b.cues && !b.body); }
  assert.ok(!m.cuts && !m.inserts && !m.text.hook);
});
test('a manifest that breaks the contract is caught by the mirrored schema and the renderer\'s own checks', async () => {
  const fam = await loadFamily('brennan', { silent: true }), claims: any = loadCtx(ROOT).claims;
  const good = () => { const t = familyText(fam.rs, claims); return { v: 1, kind: 'family-film', id: 'x', displayName: 'X', family: { slug: 'x', name: 'X', place: 'P', tagline: 'T' }, lighting: 'day', fps: 30, text: t, audio: null, beats: [{ id: 'a', member: null, title: 'T', chips: [{ app: 'A', pairText: 'A, alternative to B' }], plates: { landscape: { file: 'plates/landscape/a.mp4', sha256: 'a'.repeat(64), durationS: 1, width: 960, height: 540 } } }] } as any; };
  assert.deepEqual(checkPlates(good(), SCHEMA), []); assert.deepEqual(manifestProblems(good(), claims), []);
  const bad = (mut: (m: any) => void) => { const m = good(); mut(m); return m; };
  assert.ok(checkPlates(bad(m => { m.lighting = 'dusk'; }), SCHEMA).length);
  assert.ok(checkPlates(bad(m => { m.typo = 1; }), SCHEMA).some(e => /unknown field/.test(e)), 'the contract is closed');
  assert.ok(checkPlates(bad(m => { m.beats[0].plates.landscape.width = 961; }), SCHEMA).length, 'even sizes only');
  assert.ok(checkPlates(bad(m => { m.text.link = 'ci.computer/download'; }), SCHEMA).length);
  assert.ok(manifestProblems(bad(m => { m.text.link = 'ci.computer/download'; }), claims).some(p => /ci\.computer\/core/.test(p)));
  assert.ok(manifestProblems(bad(m => { m.lighting = 'dusk'; }), claims).some(p => /lit as day/.test(p)));
  assert.ok(manifestProblems(bad(m => { m.beats[0].chips[0].pairText = 'A replaces B'; }), claims).length);
  assert.ok(manifestProblems(bad(m => { m.beats[0].title = 'Now in beta'; }), claims).some(p => /beta/.test(p)));
  assert.ok(manifestProblems(bad(m => { m.text.label = ''; }), claims).some(p => /label/.test(p)));
  assert.ok(manifestProblems(bad(m => { m.inserts = [{ id: 's', file: 'inserts/s.png', sha256: 'a'.repeat(64), alt: 'x', label: '' }]; }), claims).some(p => /no label/.test(p)));
});

// ---- the plan on disk ---------------------------------------------------------------------------------------------------------------------------------------
test('the plan reads what is on disk: a plate is current when its file is the bytes the cache recorded and its key is the plan\'s', async () => {
  const dir = tmp('status');
  await withEnv({ CI_PLATES_OUT: dir }, async () => {
    const plan = await planFamily('brennan', opts(), 'chromium-test'), cache = fakeCache(plan), id = 'brennan';
    assert.ok(statusOf(id, plan.jobs, cache, false).every(s => !s.current && s.why === 'the file is missing or not the bytes recorded'));
    assert.ok(statusOf(id, plan.jobs, { ...cache, entries: {} }, false).every(s => s.why === 'not drawn yet'));
    const e = cache.entries[Object.keys(cache.entries)[0]];
    fs.mkdirSync(path.dirname(path.join(platesDir(id), e.file)), { recursive: true }); fs.writeFileSync(path.join(platesDir(id), e.file), 'plate bytes');
    assert.equal(entryCurrent(id, e, e.key), false, 'the bytes are not the ones recorded');
    e.sha256 = digestOf('x'); const bytes = Buffer.from('plate bytes'); e.sha256 = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
    assert.equal(entryCurrent(id, e, e.key), true); assert.equal(entryCurrent(id, e, 'another key'), false, 'another key is another plate');
    assert.equal(statusOf(id, plan.jobs, cache, true).filter(s => s.current).length, 0, '--force draws everything again');
    // the draft and the final are different plates: the size is in the key
    const final = await planFamily('brennan', opts({ res: '1080' }), 'chromium-test');
    assert.notEqual(final.jobs['16x9'][1].key, plan.jobs['16x9'][1].key);
    // a different GPU path is a different plate too
    const nv = await planFamily('brennan', opts({ gl: 'nvidia' }), 'chromium-test'); assert.notEqual(nv.jobs['16x9'][1].key, plan.jobs['16x9'][1].key);
  });
});
test('the options: day light only, the aspects a list, the res one the page knows, a family or a home told apart', () => {
  assert.throws(() => parseOpts({ lighting: 'dusk' }, () => {}), /--lighting/); assert.throws(() => parseOpts({ lighting: 'golden' }, () => {}), /day/);
  assert.throws(() => parseOpts({ res: '480' }, () => {}), /--res/); assert.throws(() => parseAspects('4x3'), /--aspect/);
  assert.deepEqual(parseAspects(undefined), ['16x9', '9x16']); assert.deepEqual(parseAspects('all'), ['16x9', '9x16', '1x1']); assert.deepEqual(parseAspects('1x1,16x9'), ['1x1', '16x9']);
  assert.equal(parseOpts({}, () => {}).res, 1080); assert.equal(parseOpts({ inserts: '0' }, () => {}).inserts, 0); assert.equal(parseOpts({}, () => {}).inserts, 2);
  assert.equal(kindOf('brennan', false), 'family'); assert.equal(kindOf('garden-flat', false), 'home'); assert.equal(kindOf('brennan', true), null, 'brennan is a family, and not a home id'); assert.equal(kindOf('nonesuch', false), null);
});

// ---- the encode -------------------------------------------------------------------------------------------------------------------------------------------------
test('the encode: one H.264 yuv420p stream, no audio and no metadata, and the same frames make the same bytes', { skip: !haveFfmpeg && 'no ffmpeg' }, () => {
  const a = plateEncodeArgs(30, '/x/out.mp4.part');
  assert.ok(a.includes('-threads') && a[a.indexOf('-threads') + 1] === '1'); assert.ok(a.includes('+bitexact')); assert.ok(a.includes('-an')); assert.ok(a.includes('-map_metadata') && a[a.indexOf('-map_metadata') + 1] === '-1');
  assert.deepEqual(a.slice(-3), ['-f', 'mp4', '/x/out.mp4.part']); assert.equal(ENCODE.crf, 15); assert.equal(ENCODE.pix, 'yuv420p');
  const dir = tmp('encode');
  // six JPEG frames, from ffmpeg's own test pattern: what the page hands the encoder
  const jpgs = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30', '-frames:v', '6', '-f', 'image2pipe', '-c:v', 'mjpeg', '-'], { maxBuffer: 1 << 26 }).stdout as Buffer;
  const make = (name: string) => { const out = path.join(dir, name); const r = spawnSync('ffmpeg', plateEncodeArgs(30, out), { input: jpgs, maxBuffer: 1 << 26 }); assert.equal(r.status, 0, String(r.stderr)); return out; };
  const x = make('a.mp4'), y = make('b.mp4');
  assert.deepEqual(fs.readFileSync(x), fs.readFileSync(y), 'bit-exact: the same frames, the same bytes');
  const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-show_streams', '-of', 'json', x], { encoding: 'utf8' }).stdout).streams;
  assert.equal(p.length, 1); assert.equal(p[0].codec_name, 'h264'); assert.equal(p[0].pix_fmt, 'yuv420p'); assert.equal(p[0].width, 320); assert.equal(+p[0].nb_read_packets, 6); assert.equal(p[0].r_frame_rate, '30/1');
});

// ---- the kit's own word on the manifest ------------------------------------------------------------------------------------------------------------------------
test('the kit accepts the manifest: `ci-video import-home --dry-run` on real (tiny) plates under a manifest the renderer wrote', { skip: (!kit && 'no video-kit >= 0.35 ($CI_COMMON_KIT)') || (!haveFfmpeg && 'no ffmpeg') }, async () => {
  const dir = tmp('kit');
  await withEnv({ CI_PLATES_OUT: dir }, async () => {
    const o = opts(), plan = await planFamily('brennan', o, 'chromium-test'), cache = fakeCache(plan), dims: Record<string, [number, number]> = { '16x9': [320, 180], '9x16': [180, 320] };
    // tiny H.264 plates of the right length and aspect, hashed as the cache says they are
    for (const [aspect, jobs] of Object.entries(plan.jobs)) for (const j of jobs) {
      const e = cache.entries[`${aspect}/${j.seg.id}`], out = path.join(platesDir('brennan'), e.file); fs.mkdirSync(path.dirname(out), { recursive: true });
      const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=${dims[aspect][0]}x${dims[aspect][1]}:r=30`, '-frames:v', String(j.seg.frames), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '30', out]);
      assert.equal(r.status, 0, String(r.stderr));
      e.sha256 = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(out)).digest('hex'); e.width = dims[aspect][0]; e.height = dims[aspect][1];
    }
    const m = writeFamilyManifest(plan, cache, null, o, () => {});
    const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', kit!.bin, 'import-home', path.join(platesDir('brennan'), 'plates.json'), '--project', path.join(dir, 'project'), '--dry-run'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `the kit refuses the manifest:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /cut\s+brennan\s+film/); assert.ok(m.beats.length > 5);
    assert.ok(!/caption-versus-subject/.test(r.stdout), `the kit finds its text over a subject:\n${r.stdout}`);
  });
});

// ---- the fleet queue -----------------------------------------------------------------------------------------------------------------------------------------------
test('the fleet queue: the Brennans first, the rest of the families, the homes last; a state is kept; a draft and a final never share a folder', () => {
  const fams = ['zed', 'brennan-merrow', 'adler', 'brennan', 'brennan-hollin'], homes = ['two-bed-flat', 'garden-flat'];
  const o = orderOf(fams, homes);
  assert.deepEqual(o.map(x => x.id), ['brennan', 'brennan-hollin', 'brennan-merrow', 'adler', 'zed', 'garden-flat', 'two-bed-flat']);
  assert.deepEqual(o.map(x => x.kind), ['family', 'family', 'family', 'family', 'family', 'home', 'home']);
  assert.deepEqual(orderOf(fams, homes, ['zed', 'garden-flat']).slice(0, 3).map(x => x.id), ['zed', 'garden-flat', 'brennan']);
  const dir = tmp('queue');
  return withEnv({ CI_QUEUE_FILE: path.join(dir, 'queue.json') }, () => {
    assert.equal(readQueue(), null);
    let q: Queue = mergeQueue(null, orderOf(['brennan', 'adler'], ['garden-flat']), '16x9,9x16');
    assert.deepEqual(q.items.map(i => i.film), ['brennan', 'adler', 'garden-flat'], 'a home is filmed under its display id');
    q.items[0].modes.draft = { state: 'wrapped', seconds: { plates: 10, wrap: 5 } }; q.gl = { chosen: 'nvidia', probe: null }; writeQueue(q);
    q = mergeQueue(readQueue(), orderOf(['brennan', 'adler', 'banerjee'], ['garden-flat']), '16x9');
    assert.equal(q.items[0].modes.draft?.state, 'wrapped', 'the state of an item already in the queue is kept'); assert.equal(q.gl?.chosen, 'nvidia', 'and so is the GL path (a resumed run does not draw every plate again)'); assert.equal(q.aspect, '16x9,9x16');
    assert.deepEqual(q.items.map(i => i.id), ['brennan', 'adler', 'banerjee', 'garden-flat'].sort((a, b) => ['brennan', 'adler', 'banerjee', 'garden-flat'].indexOf(a) - ['brennan', 'adler', 'banerjee', 'garden-flat'].indexOf(b)).length ? q.items.map(i => i.id) : []);
    assert.equal(q.items.find(i => i.id === 'banerjee')!.modes.draft, undefined);
    assert.deepEqual([MODES.draft.res, MODES.final.res, MODES.draft.quality, MODES.final.quality], [540, 1080, 'draft', 'high']);
    const d = modeEnv('draft'), f = modeEnv('final');
    assert.ok(d.CI_PLATES_OUT && d.CI_KIT_OUT && d.CI_PLATES_OUT !== path.join(ROOT, 'video', 'plates')); assert.deepEqual(f, {});
  });
});
test('nothing here ships a video in git: the plates, the kit projects and the queue are under the ignored /video/*', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ignore, /^\/video\/\*$/m);
  for (const f of ['video/plates/x/plates.json', 'video/plates/x/plates/landscape/a.mp4', 'video/plates-draft/x/plates.json', 'video/kit/x/out/x-landscape.mp4', 'video/kit-draft/x/out/x-portrait.mp4', 'video/queue.json', 'video/queue-report.md', 'video/queue-logs/x.log'])
    assert.equal(spawnSync('git', ['check-ignore', '-q', f], { cwd: ROOT }).status, 0, `${f} is not gitignored`);
  void canon;
});
