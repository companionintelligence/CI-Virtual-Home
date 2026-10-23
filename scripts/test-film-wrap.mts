#!/usr/bin/env -S node --experimental-strip-types
// Tests for the compliance wrap (scripts/film/wrap.mts): the checks that hold what CI-Common's video-kit renders to this repository's rules. No GPU, no browser and no render: a storyboard and a
// manifest in the shape the kit writes are checked as data, and the file gates run on tiny files ffmpeg makes here.
//   * finding the kit: a path to a checkout or to its package, a version that has `import-home`, and the way to get one when there is none
//   * the checks, each of which must catch what it is for: a disclosure that is not claims.json's words, one that is missing or that this film does not owe, a label that is not the fictional line, a
//     lighting that is not day, a link that is not ci.computer/core and any other address, the word beta, a dash, an exclamation mark, a banned phrase, a builder's handle, a price or a figure
//   * the files: the picture gates over an MP4 (one H.264 yuv420p stream, no sound, the aspect asked for, the length the kit said, a picture that moves, not blank), the metadata scan, the kit's
//     own figures read from its `build` output
// Needs ffmpeg for the file tests (they skip without it).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findKit, versionAtLeast, KIT_MIN, KIT_ENV, wrapChecks, readableStrings, vttLines, cutsOf, builtSeconds, kitCapProblem, outputOf, gateOutput, fileTags, expectationOf, LINK, defaultKitDir, type Expect } from './film/wrap.mts';
import { loadClaims } from './film/lib.mts';
import { builderHandles, guardTerms } from './portal-redact.mts';
import { ROOT } from './film/lib.mts';

const haveFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `wrap-${name}-`));
const claims: any = loadClaims(), terms = guardTerms(builderHandles(ROOT));
const text = (id: string): string => claims.disclosures.find((d: any) => d.id === id).text;
const IDS = ['fictional-family', 'scripted-scenes', 'stylised-art', 'attribution-agents'];

// a storyboard in the shape `ci-video import-home` writes for a family film and one cut
const board = (over: (b: any) => void = () => {}): any => {
  const coda = (id: string) => ({ id: 'plainly', kind: 'feature', seconds: 14, title: 'Said plainly', items: IDS.map(i => ({ label: text(i) })), transition: 'cut', coda: true });
  const close = { id: 'close', kind: 'outro', seconds: 4, cta: 'UnCloud your life.', tagline: 'See Companion Core', url: 'ci.computer/core' };
  const b = {
    app: { id: 'brennan', name: 'The Brennan family of Wrenfield', website: 'ci.computer' }, source: { kind: 'virtual-home', lighting: 'day' },
    meta: { fps: 30, label: text('fictional-family'), engine: 'none' }, chapters: { sally: 'Sally' },
    scenes: [
      { id: 'title', kind: 'intro', seconds: 3, title: 'The Brennan family of Wrenfield', caption: 'A house lined with books, a lake out back and one Companion Core.' },
      { id: 'office-split', kind: 'clip', seconds: 10, caption: 'Splitting a PDF in the office', chapter: 'sally', cues: [{ from: 0.5, to: 4, text: 'Sally splits a client PDF.' }] },
      { id: 'apps', kind: 'feature', seconds: 5, title: 'Apps in this home', items: [{ label: 'Stirling-PDF, alternative to Smallpdf', icon: 'assets/logos/stirling-pdf.webp' }] },
      close, coda('film'),
    ],
    deliverables: [{ id: 'brennan-15', kind: 'short', name: 'The Brennan family of Wrenfield (15 seconds)', formats: ['portrait'], scenes: [{ id: 'hook', kind: 'intro', seconds: 2, title: 'Stop renting your intelligence.' }, { ref: 'office-split', seconds: 5 }, { ...close, id: 'close' }, coda('cut')] }],
  };
  over(b); return b;
};
const manifest = (over: (m: any) => void = () => {}): any => {
  const m = { v: 1, kind: 'family-film', id: 'brennan', displayName: 'The Brennan family of Wrenfield', family: { slug: 'brennan', name: 'The Brennan family', place: 'Wrenfield', tagline: 'T' }, lighting: 'day', fps: 30, text: { label: text('fictional-family'), cta: 'UnCloud your life.', link: LINK, disclosures: IDS.map(id => ({ id, text: text(id) })) }, beats: [] };
  over(m); return m;
};
const expect: Expect = { kind: 'family-film', ids: IDS, label: text('fictional-family'), cta: 'UnCloud your life.', tagline: 'See Companion Core' };
const check = (b = board(), m = manifest(), vtts: Array<{ file: string; text: string }> = [], e = expect) => wrapChecks({ storyboard: b, manifest: m, vtts, claims, expect: e, terms });

// ---- the kit ------------------------------------------------------------------------------------------------------------------------------------------------
test('finding the kit: a checkout or its package, a version with import-home, and the way to get one', () => {
  assert.ok(versionAtLeast('0.35.0', KIT_MIN) && versionAtLeast('0.36.1', KIT_MIN) && versionAtLeast('1.0.0', KIT_MIN));
  assert.ok(!versionAtLeast('0.34.9', KIT_MIN) && !versionAtLeast('0.15.0', KIT_MIN));
  const root = tmp('kit'), pkgDir = path.join(root, 'packages', 'video-kit');
  assert.throws(() => findKit(root, {}), new RegExp(`${KIT_ENV}`));
  fs.mkdirSync(path.join(pkgDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'bin', 'ci-video.ts'), ''); fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '0.34.0' })); fs.writeFileSync(path.join(pkgDir, 'bin', 'usage.txt'), 'ci-video build');
  assert.throws(() => findKit(root, {}), /0\.34\.0.*0\.35\.0|#429/);
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '0.35.0' }));
  assert.throws(() => findKit(root, {}), /import-home/);
  fs.writeFileSync(path.join(pkgDir, 'bin', 'usage.txt'), 'ci-video import-home <plates.json>');
  assert.equal(findKit(root, {}).dir, pkgDir); assert.equal(findKit(pkgDir, {}).dir, pkgDir, 'a path to the package itself works too');
  assert.equal(findKit(undefined, { [KIT_ENV]: root }).version, '0.35.0', 'the environment names it');
  assert.ok(defaultKitDir().endsWith(path.join('video', 'kit', 'ci-common')), 'the default is a worktree under the ignored /video');
});

// ---- the checks ---------------------------------------------------------------------------------------------------------------------------------------------
test('a film that keeps every rule has no error', () => {
  const r = check(); assert.deepEqual(r.errors, []);
  assert.deepEqual(check(board(), manifest(), [{ file: 'out/brennan.vtt', text: 'WEBVTT\n\n1\n00:00:00.500 --> 00:00:03.000\nSally splits a client PDF.\n' }]).errors, []);
});
test('the disclosures are claims.json\'s words, the ones this film owes, in order, and held long enough to read', () => {
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.coda).items[1].label = 'Scenes are scripted.'; })).errors.some(e => /disclosure card prints/.test(e)));
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.coda).items.pop(); })).errors.some(e => /disclosure card prints/.test(e)), 'a missing line');
  assert.ok(check(board(b => { b.deliverables[0].scenes.find((s: any) => s.coda).items.reverse(); })).errors.some(e => /brennan-15: the disclosure card prints/.test(e)), 'a cut\'s card is checked too, and the order matters');
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.coda).seconds = 3; })).errors.some(e => /holds at least 5 s/.test(e)));
  assert.ok(check(board(b => { b.scenes = b.scenes.filter((s: any) => !s.coda); })).errors.some(e => /no disclosure card/.test(e)));
  assert.ok(check(board(), manifest(m => { m.text.disclosures[1].text = 'Scenes are scripted.'; })).errors.some(e => /not claims\.json's words/.test(e)));
  assert.ok(check(board(), manifest(m => { m.text.disclosures.pop(); })).errors.some(e => /this film owes/.test(e)));
  // a home with no family owes the stylised Core and nothing else: a family's lines are not its
  const home: Expect = { kind: 'home-tour', ids: ['stylised-art'], label: 'Garden Flat', cta: 'UnCloud your life.', tagline: 'See Companion Core' };
  const hb = board(b => { b.meta.label = 'Garden Flat'; b.scenes.find((s: any) => s.coda).items = [{ label: text('stylised-art') }]; b.deliverables = []; });
  assert.deepEqual(check(hb, manifest(m => { m.kind = 'home-tour'; m.displayName = 'Garden Flat'; m.text.label = 'Garden Flat'; m.text.disclosures = [{ id: 'stylised-art', text: text('stylised-art') }]; }), [], home).errors, []);
  assert.ok(check(board(b => { b.meta.label = 'Garden Flat'; }), manifest(), [], home).errors.some(e => /disclosure card prints/.test(e)), 'a family\'s four lines on a home are refused');
});
test('the label, the light, the call to action and the one link', () => {
  assert.ok(check(board(b => { b.meta.label = 'Real software.'; })).errors.some(e => /label on every frame/.test(e)));
  assert.ok(check(board(b => { b.source.lighting = 'dusk'; })).errors.some(e => /lit as day/.test(e)));
  assert.ok(check(board(), manifest(m => { m.lighting = 'night'; })).errors.some(e => /lit as day/.test(e)));
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.kind === 'outro').url = 'ci.computer/download'; })).errors.some(e => /end card's link/.test(e)));
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.kind === 'outro').cta = 'Buy now'; })).errors.some(e => /call to action/.test(e)));
  assert.ok(check(board(b => { b.scenes.find((s: any) => s.kind === 'outro').tagline = 'Order today'; })).errors.some(e => /end card's line/.test(e)));
  assert.ok(check(board(b => { b.scenes = b.scenes.filter((s: any) => s.kind !== 'outro'); })).errors.some(e => /no end card/.test(e)));
  // no other address is printed, in a caption or a subtitle: not a URL, not www, not the company's own other pages
  for (const bad of ['Visit https://example.com today', 'See www.example.org', 'Read the docs at ci.computer/download', 'Buy at ci.computer']) assert.ok(check(board(b => { b.scenes[1].caption = bad; })).errors.some(e => /prints the address/.test(e)), bad);
  assert.ok(check(board(), manifest(), [{ file: 'out/x.vtt', text: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nGo to https://example.com\n' }]).errors.some(e => /x\.vtt line 1: prints the address/.test(e)), 'the subtitles are read');
  assert.deepEqual(check(board(b => { b.scenes[2].items[0].label = 'Linkwarden, alternative to Raindrop.io'; })).errors, [], 'a service\'s name with a dot in it is a name, not a link');
  assert.deepEqual(check(board(b => { b.scenes[1].caption = 'Ending on ci.computer/core'; })).errors, [], 'the sanctioned link itself is not an error');
});
test('the copy lint: beta, a dash, an exclamation mark, a banned phrase, a price and a figure that is not on the fact sheet', () => {
  const caught = (caption: string, vtt = false) => (vtt ? check(board(), manifest(), [{ file: 'out/a.vtt', text: `WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\n${caption}\n` }]) : check(board(b => { b.scenes[1].caption = caption; }))).errors;
  assert.ok(caught('Companion OS is in beta.').some(e => /beta/.test(e)), 'beta');
  assert.ok(caught('Companion OS is in beta.', true).some(e => /beta/.test(e)), 'beta in the subtitles');
  assert.ok(caught('A film — a short one').some(e => /dash/.test(e)));
  assert.ok(caught('It just works!').some(e => /exclamation/.test(e)));
  assert.ok(caught('A seamless home').length, 'a buzzword (claims.json)');
  assert.ok(caught('Open WebUI replaces ChatGPT').length);
  assert.ok(caught('Costs $99 a month').some(e => /price|\$/.test(e)));
  assert.ok(caught('Saves 40% of your week').length);
  assert.ok(caught('Fast on 16 GB').some(e => /figure/.test(e)));
  assert.deepEqual(caught('Sally splits a client PDF.'), []);
  assert.ok(check(board(), manifest(), [], expect).warnings.every(w => !/caption/.test(w)));
});
test('the credit scan: no builder handle and no build word in a caption, the storyboard or the subtitles', () => {
  const handle = builderHandles(ROOT)[0];
  assert.ok(handle, 'the specs name a builder');
  assert.ok(check(board(b => { b.scenes[1].caption = `A home by ${handle}`; })).errors.some(e => /builder handle/.test(e)));
  assert.ok(check(board(), manifest(), [{ file: 'out/a.vtt', text: `WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nBuilt from a Sims 4 house\n` }]).errors.some(e => /Sims/.test(e)));
  assert.ok(check(board(b => { b.scenes[1].extra = 'Base Game'; b.source.note = `by ${handle}`; })).errors.some(e => /storyboard\.json and plates\.json/.test(e)), 'the files are scanned whole, not only the words');
  assert.deepEqual(check(board(b => { b.scenes[1].caption = 'Companion Intelligence wrote this home'; })).errors, [], 'the company\'s own name is not a handle');
});
test('what a viewer reads: every caption, title, chip, cue and chapter of the film and of each cut, and the subtitles\' lines without their timing', () => {
  const words = readableStrings(board()).map(([, t]) => t);
  for (const t of ['Sally', 'Splitting a PDF in the office', 'Sally splits a client PDF.', 'Stirling-PDF, alternative to Smallpdf', 'UnCloud your life.', 'See Companion Core', 'Stop renting your intelligence.', 'The Brennan family of Wrenfield (15 seconds)', text('stylised-art')]) assert.ok(words.includes(t), t);
  assert.ok(!words.includes('assets/logos/stirling-pdf.webp') && !words.includes('clip'), 'a path or a kind is not a word');
  assert.deepEqual(cutsOf(board()).map(c => c.id), ['brennan', 'brennan-15']);
  assert.deepEqual(vttLines('WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\n<v Juniper>Hello &amp; welcome\n\n2\n00:00:02.000 --> 00:00:03.000\nTwo\nlines\n'), ['Hello & welcome', 'Two', 'lines']);
});
test('a film that owes the family\'s lines is told so from this repository, not from the manifest it checks', async () => {
  const e = await expectationOf({ kind: 'family-film', id: 'brennan', family: { slug: 'brennan' } }, claims);
  assert.deepEqual(e.ids, IDS); assert.equal(e.label, 'Fictional family. Real software.'); assert.equal(e.tagline, 'See Companion Core');
  const h = await expectationOf({ kind: 'home-tour', id: 'garden-flat', displayName: 'Garden Flat' }, claims);
  assert.deepEqual(h.ids, ['stylised-art']); assert.equal(h.label, 'Garden Flat');
});

// ---- the kit's figures and the files ------------------------------------------------------------------------------------------------------------------------
test('what the kit says about its files: the length of each from `ci-video build`, the cut and the format from a file\'s name', () => {
  const out = '  built brennan/landscape    104.2s  /x/build/landscape/index.html\n  built brennan/portrait     104.2s  /x/y\n  built brennan-15/portrait  15.8s  /x\n  built brennan-15/square  15.8s  /x\n';
  const m = builtSeconds(out); assert.equal(m.get('brennan/landscape'), 104.2); assert.equal(m.get('brennan-15/square'), 15.8); assert.equal(m.size, 4);
  // the kit's figure is held to the film's cap before anything is rendered; the cuts are not the film (their targets are 15 and 30 s)
  assert.equal(kitCapProblem(builtSeconds('  built brennan/landscape 109.567s  /x\n  built brennan/portrait 109.567s  /x\n'), 'brennan'), null);
  assert.match(kitCapProblem(builtSeconds('  built brennan-hollin/landscape 112.532s  /x\n  built brennan-hollin/portrait 112.532s  /x\n'), 'brennan-hollin')!, /landscape\) is 112\.5 s and the cap is 110 s/);
  assert.match(kitCapProblem(builtSeconds('  built x/landscape 100s  /x\n  built x/portrait 110.2s  /x\n'), 'x')!, /portrait/);
  assert.equal(kitCapProblem(builtSeconds('  built x-15/portrait 120s  /x\n'), 'x'), null);
  assert.deepEqual(outputOf('brennan-landscape.mp4'), ['brennan', 'landscape']); assert.deepEqual(outputOf('brennan-15-portrait.mp4'), ['brennan-15', 'portrait']); assert.equal(outputOf('brennan.vtt'), null); assert.equal(outputOf('brennan-widescreen.mp4'), null);
});
const mk = (file: string, src: string, w: number, h: number, secs: number, extra: string[] = []) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `${src}${src.includes("=") ? ":" : "="}s=${w}x${h}:r=30`, '-t', String(secs), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '15', ...extra, file]); assert.equal(r.status, 0, String(r.stderr)); return file; };
test('the picture gates over a rendered file: right, wrong aspect, blank, frozen, with sound, over the cap, with a credit in its metadata', { skip: !haveFfmpeg && 'no ffmpeg' }, async () => {
  const dir = tmp('files'), g = (f: string, o: Partial<Parameters<typeof gateOutput>[1]> = {}) => gateOutput(f, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 4, terms, ...o });
  const good = mk(path.join(dir, 'good.mp4'), 'testsrc2', 960, 540, 4, ['-map_metadata', '-1']);
  assert.deepEqual(g(good).errors, [], 'a picture that moves, the length the kit said, no sound');
  assert.ok(g(good, { format: 'portrait' }).errors.some(e => /not portrait/.test(e)), 'the aspect the format asks for');
  assert.ok(g(good, { expectSeconds: 6 }).errors.some(e => /length/.test(e)), 'the length the kit said');
  assert.ok(g(good, { expectSeconds: null }).warnings.some(w => /did not say/.test(w)));
  assert.ok(g(mk(path.join(dir, 'small.mp4'), 'testsrc2', 320, 180, 4)).errors.some(e => /short edge/.test(e)));
  assert.ok(g(mk(path.join(dir, 'blank.mp4'), 'color=c=0x808080', 960, 540, 6)).errors.some(e => /blank/.test(e)), 'a flat first and last frame');
  assert.ok(g(path.join(dir, 'blank.mp4')).errors.some(e => /frozen/.test(e)), 'and a picture that never moves');
  const withAudio = path.join(dir, 'audio.mp4');
  assert.equal(spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=960x540:r=30', '-f', 'lavfi', '-i', 'sine=d=4', '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', withAudio]).status, 0);
  assert.ok(g(withAudio).errors.some(e => /no audio|stream/.test(e)), 'a silent film has no audio stream');
  const handle = builderHandles(ROOT)[0], tagged = mk(path.join(dir, 'tagged.mp4'), 'testsrc2', 960, 540, 4, ['-metadata', `artist=${handle}`]);
  assert.equal(fileTags(tagged).artist, handle);
  assert.ok(g(tagged).errors.some(e => /builder handle/.test(e)), 'the metadata is scanned');
  // the film's cap is the film's here too: a kit film a few seconds past 110 s is refused, as is any other (the plates choose their beats so that it fits; nothing in the wrap widens it)
  const slightly = mk(path.join(dir, 'slightly.mp4'), 'testsrc2', 320, 180, 112, ['-crf', '45']), rep112 = gateOutput(slightly, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 112, terms, minShort: 100 });
  assert.ok(rep112.errors.some(e => /over the 110 s cap/.test(e)), 'a kit film of 112 s is over the cap and is an error, not a warning'); assert.ok(!rep112.warnings.some(w => /over the 110 s/.test(w)));
  const atCap = mk(path.join(dir, 'atcap.mp4'), 'testsrc2', 320, 180, 109.9, ['-crf', '45']);
  assert.ok(!gateOutput(atCap, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 109.9, terms, minShort: 100 }).errors.some(e => /cap/.test(e)), 'a film under the cap passes');
  // a captioned room at rest: a second of picture and three seconds of the same one is said, and a stuck render (six seconds) is refused
  const still = path.join(dir, 'still.mp4');
  assert.equal(spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=960x540:r=30:d=1', '-vf', 'tpad=stop_mode=clone:stop_duration=3,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', still]).status, 0);
  const rs = gateOutput(still, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 4, terms });
  assert.ok(!rs.errors.some(e => /frozen/.test(e)) && rs.warnings.some(w => /holds still/.test(w)), `a still room of three seconds is said, not refused: ${JSON.stringify(rs.errors)} ${JSON.stringify(rs.warnings)}`);
  const long = mk(path.join(dir, 'long.mp4'), 'testsrc2', 320, 180, 125, ['-crf', '45']);
  assert.ok(gateOutput(long, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 125, terms, minShort: 100 }).errors.some(e => /110 s cap/.test(e)), 'and a longer one');
  assert.equal((await import('./film/wrap.mts') as any).KIT_FILM_MAX_S, undefined, 'there is no second, longer cap for the kit\'s film');
  // the kit renders the whole frames that cover its length: 109.567 s is 3288 frames at 30, not 3287
  assert.deepEqual(gateOutput(good, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 3.99, terms }).errors.filter(e => /frames/.test(e)), [], 'one frame either way is the kit\'s rounding');
  assert.ok(gateOutput(good, { cut: 'x', format: 'landscape', fps: 30, expectSeconds: 3.5, terms }).errors.length > 0, 'a file half a second off the kit\'s figure is not');
  assert.ok(g(mk(path.join(dir, 'sq.mp4'), 'testsrc2', 720, 720, 4), { format: 'square' }).errors.length === 0, 'a square');
});
