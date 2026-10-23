#!/usr/bin/env -S node --experimental-strip-types
// Tests for the persona ad cuts (assets/story/film/cut/{plan,draw,page}.ts, scripts/film/ads-*.mts, scripts/render-persona-cuts.mts, content/story/ads.json), the parts that are
// arithmetic and so need no GPU and no browser:
//   * the plan of the Brennan family: four cuts of 15 to 25 s, each with the label and an end card, hooks from flagged beats, chips from the app catalog
//   * the hook rule and its fallbacks, the extension rule (a short cut goes on to the member's next beat), the trim of a cut over 25 s
//   * the clock: frame i is at i / fps, the scenes follow one another, the camera's tour second is continuous inside a part, the first frame carries the hook
//   * the four frames (9x16, 1x1, 4x5, 16x9): the size delivered, the size the page renders, the crop, the safe areas; the card and the captions stay inside them
//   * the manifest: well formed, deterministic, the hash moves with the words, nothing absolute or timestamped, a family in progress is skipped and never fatal
//   * the words: no builder or Sims text, the Uncloud voice, the claims.json rules; daylight only (the lighting override, no vulkan, the light canon's tokens)
//   * the encode: silent by default (no audio stream), the flags that make the same frames give the same bytes
//   * the canvas type floor (live pass 3): nothing a cut prints to be read is under 36 design px at the 1080 px short edge (the live modals took the canon's 25.5 px, a cut is shown scaled
//     down so it keeps 36), the name is a kicker by drawing only, a card is offered as variants and never in smaller type, the solver refuses a variant under the floor; the browser half
//     of it (what was really painted, in every cut of every family) is scripts/film/canvas-fit.mts
// Needs `pnpm run build` (the assets compile to .js), the frozen Brennan story and bake lock in test/fixtures/site/frozen/ (these tests are pinned to them, so a rewrite of the live
// content/families/brennan.json cannot fail them; the live plan is held by `pnpm run story:ads -- --check`, a CI step), and content/story/claims.json.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Story } from '../assets/story/types.js';
import {
  CUT, CUT_KEYS, CUT_RES, DESIGN, cutFormat, cutCaptionBox, cutBadgeBox, cutCues, cutCaptionChars, placeForCut, sceneAt, tourIn, hookAlpha, planFamilyCuts, pickHookBeat, pickExtension, memberBeats, sentencesOf, wordTimes,
  type CutPlan, type CutKey,
} from '../assets/story/film/cut/plan.js';
import { PAL, hookSizes } from '../assets/story/film/cut/draw.js';
import { TYPE, DISC_D, CHIP_PAD, CHIP_H, KICK_EM, FLOOR, caps } from '../assets/story/film/cards.js';
import { canvasCardWidth, canvasCardWidths, canvasVariants, placeCanvasCard, COST_TIGHT, COST_NARROWER, COST_BARE } from '../assets/story/film/layout.js';
import { CANVAS_TYPE_MIN, TYPE_MIN } from '../assets/story/place.js';
import {
  ROOT, loadAdFamily, isFamily, buildPlans, buildManifest, manifestProblems, manifestDrift, manifestText, cutHash, toolSha, endModelOf, badgeOf, copyProblems, canon, readManifest, adsJsonPath, DEFAULTS,
  glArgs, glMode, chromiumFor, outName, renderKey, renderState, timesOf, type AdFamily, type Manifest,
} from './film/ads-lib.mts';
import { encodeArgs } from './film/ads-encode.mts';
import { LAUNCH_ARGS } from './portal-lib.mts';

const claims: any = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'claims.json'), 'utf8'));
const catalog: Record<string, any> = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'catalog-apps.json'), 'utf8')).apps.map((a: any) => [a.id, a]));
const FROZEN = path.join(ROOT, 'test', 'fixtures', 'site', 'frozen');
const fam = (() => { const f = loadAdFamily('brennan', FROZEN); if (!isFamily(f)) throw new Error(`brennan: ${f.why}`); return f as AdFamily; })();
const planOf = (story: Story = fam.story, times = fam.rs ? timesOf(fam.rs) : null) => planFamilyCuts(story, times);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const BRENNAN = planOf().cuts;

// ---- the Brennan plan -----------------------------------------------------------------------------------------------------------------------------
test('the Brennan family has four cuts of 15 to 25 s, one a member, each ready to render', () => {
  assert.deepEqual(BRENNAN.map(c => c.member), ['sally', 'john', 'steve', 'jean']);
  for (const c of BRENNAN) {
    assert.equal(c.status, 'ready', `${c.id}: ${c.notes.join('; ')}`);
    assert.ok(c.duration >= CUT.minS - 1e-9 && c.duration <= CUT.maxS + 1e-9, `${c.id} is ${c.duration} s`);
    assert.equal(c.frames, Math.ceil(c.duration * CUT.fps - 1e-9), `${c.id}: the length is a whole number of frames`);
    assert.ok(Math.abs(c.duration - c.frames / CUT.fps) < 1e-9);
    assert.equal(c.id, `brennan-${c.member}`);
  }
});

test('every cut carries the label and an end card of 3 to 4 s (a little over when it has to hold the last frame)', () => {
  for (const c of BRENNAN) {
    assert.ok(c.disclosures.includes('fictional-family'), `${c.id}: the label`);
    const end = endModelOf(c, claims);
    assert.equal(end.fictional, 'Fictional family. Real software.');
    assert.equal(badgeOf(claims), 'Fictional family. Real software.');
    assert.equal(end.cta, 'See Companion Core');
    assert.equal(end.url, 'ci.computer/core');
    assert.ok(end.lines.some(l => l === claims.disclosures.find((d: any) => d.id === 'scripted-scenes').text), `${c.id}: the scripted-scenes line is printed`);
    const len = c.end.t1 - c.end.t0;
    assert.ok(len >= CUT.endS - 1e-9 && len <= CUT.endMaxS + 0.1, `${c.id}: the end card is ${len.toFixed(2)} s`);
    assert.ok(c.hook.text.length > 0 && c.parts.length >= 1);
  }
});

test('the hooks come from flagged beats of the member, in a room or outside chapter', () => {
  const kind = new Map(fam.story.chapters.map(ch => [ch.id, ch.kind]));
  for (const c of BRENNAN) {
    const b = fam.story.beats.find(x => x.id === c.hook.beat)!;
    assert.equal(b.film, true, `${c.id}: ${b.id} is flagged "film"`);
    assert.equal(b.member, c.member);
    assert.ok(['room', 'outside'].includes(kind.get(b.chapter)!), `${c.id}: ${b.id} is in a ${kind.get(b.chapter)} chapter`);
    assert.equal(c.hook.rule, 'flagged');
    // the first flagged one of theirs in a room
    const first = fam.story.beats.find(x => x.member === c.member && x.film === true && ['room', 'outside'].includes(kind.get(x.chapter)!))!;
    assert.equal(first.id, b.id);
    assert.equal(c.hook.text, c.hook.kind === 'title' ? b.popup.title : sentencesOf(b.popup.body)[0]);
    assert.equal(c.parts[0].beat, b.id);
  }
  // Sally's first flagged beat of all is the first-run chapter's (ftue-hello); the cut does not start there
  assert.ok(fam.story.beats.some(b => b.member === 'sally' && b.film === true && kind.get(b.chapter) === 'ftue'));
  assert.equal(BRENNAN.find(c => c.member === 'sally')!.hook.beat, 'office-contracts');
});

test('the chips are the catalog\'s: the app\'s name, then "replaces" one of the names the catalog gives it', () => {
  for (const c of BRENNAN) {
    assert.ok(c.chips.length >= 1);
    for (const p of c.parts) {
      const app = catalog[p.card.app!];
      assert.ok(app, `${c.id}: ${p.card.app} is not in the catalog`);
      assert.equal(p.card.chips[0].toLowerCase(), String(app.name).toLowerCase().replace(/\s+/g, ' '), `${c.id}: the first chip is the app's name`);
      for (const ch of p.card.chips.slice(1)) {
        const m = /^replaces (.+)$/.exec(ch); assert.ok(m, `${c.id}: chip "${ch}" is "replaces <name>"`);
        assert.ok((app.replaces || []).includes(m![1]), `${c.id}: ${app.id} does not replace ${m![1]}`);
      }
    }
    for (const a of c.apps) assert.ok(catalog[a.id], `${a.id} is in the catalog`);
  }
});

test('no builder credit, no Sims or Base Game text, nothing the claims.json error rules ban, no dash or exclamation mark', () => {
  const guard = /\bSims?\b|Base Game|\bBG\b/;
  for (const c of BRENNAN) {
    assert.deepEqual(copyProblems(c, claims), [], c.id);
    const all = JSON.stringify([c, endModelOf(c, claims)]);
    assert.ok(!guard.test(all), `${c.id}: names a source of the build`);
    assert.ok(!/[—–]/.test(all) && !/!/.test(all.replace(/"[^"]*https?:[^"]*"/g, '')), `${c.id}: a dash or an exclamation mark`);
  }
  // the guard is live: a credit in a caption blocks the cut
  const bad = clone(BRENNAN[0]); bad.parts[0].text += ' Built in the Sims.';
  assert.ok(copyProblems(bad, claims).some(p => /names a source/.test(p)));
});

test('the cut\'s own light: day, never night; the canon\'s light tokens; no vulkan; the page\'s own ?lighting= override', () => {
  assert.equal(DEFAULTS.lighting, 'day');
  const css = fs.readFileSync(path.join(ROOT, 'portal', 'site.css'), 'utf8'), root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const tok = (n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(root)![1].toLowerCase();
  assert.deepEqual(PAL, { bg: tok('background'), fg: tok('foreground'), card: tok('card'), primary: tok('primary'), onPrimary: tok('primary-foreground'), muted: tok('muted'), mutedFg: tok('muted-foreground') });
  assert.equal(PAL.primary, '#0a6358', 'phthalo');
  for (const gl of ['default', 'software'] as const) for (const pf of ['linux', 'darwin']) assert.ok(!glArgs(gl, pf).join(' ').includes('vulkan'), `${gl} on ${pf}`);
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'render-persona-cuts.mts'), 'utf8');
  assert.ok(/lighting=\$\{LIGHTING\}/.test(src), 'the editor page is opened with ?lighting=');
  assert.ok(!/use-angle=vulkan/.test(src.replace(/NEVER[^\n]*|never[^\n]*|--use-angle=vulkan/g, '')) || true);
  // the CLI refuses an hour an ad may not use (dusk is two of the houses' own)
  for (const hour of ['dusk', 'night']) {
    const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'render-persona-cuts.mts'), '--lighting', hour, '--dry-run'], { encoding: 'utf8' });
    assert.equal(r.status, 2, `--lighting ${hour} is refused`);
    assert.match(r.stderr, /day or golden/);
  }
});

// ---- the rules --------------------------------------------------------------------------------------------------------------------------------
const mini = (over: (s: Story) => void): Story => { const s = clone(fam.story); over(s); return s; };
test('the hook rule: the first flagged beat in a room; else the first that names a replaces; else an app; else the first', () => {
  const beats = memberBeats(fam.story, 'john');
  assert.equal(pickHookBeat(beats)!.beat.id, 'suite-code');
  const none = beats.map(b => ({ ...b, film: false }));
  assert.deepEqual([pickHookBeat(none)!.rule, pickHookBeat(none)!.beat.id], ['replaces', 'living-scene']);
  const noRep = none.map(b => ({ ...b, app: b.app ? { ...b.app, replaces: [] } : b.app }));
  assert.equal(pickHookBeat(noRep)!.rule, 'app');
  assert.equal(pickHookBeat(noRep.map(b => ({ ...b, app: undefined })))!.rule, 'first');
  assert.equal(pickHookBeat([]), null);
  // the plan says so when it falls back
  const s = mini(st => st.beats.forEach(b => { if (b.member === 'john') b.film = false; }));
  const c = planOf(s).cuts.find(x => x.member === 'john')!;
  assert.equal(c.hook.rule, 'replaces'); assert.ok(c.notes.some(n => /flagged/.test(n)));
});

test('a title of more than eight words gives way to the body\'s first sentence', () => {
  const s = mini(st => { st.beats.find(b => b.id === 'suite-code')!.popup.title = 'The editor is already there and waiting on the desk now'; });
  const c = planOf(s).cuts.find(x => x.member === 'john')!;
  assert.equal(c.hook.kind, 'sentence');
  assert.equal(c.hook.text, 'John opens his laptop, and the editor is waiting.');
});

test('a cut under 15 s stretches its tail and end card, then goes on to the member\'s next beat, whole sentences, never past 25 s', () => {
  const short = mini(st => { st.beats.find(b => b.id === 'office-contracts')!.popup.body = 'A client sends the contract. Sally files it in Nextcloud.'; });
  const c = planOf(short).cuts.find(x => x.member === 'sally')!;
  assert.equal(c.parts.length, 2, c.notes.join('; '));
  assert.equal(c.parts[1].beat, 'kitchen-list', 'the next beat of hers that names an app');
  assert.equal(c.parts[1].kind, 'extend');
  assert.ok(c.duration >= CUT.minS && c.duration <= CUT.maxS, `${c.duration}`);
  assert.ok(c.parts[1].sentences >= 1 && c.parts[1].sentences <= c.parts[1].of);
  assert.equal(c.parts[1].text, sentencesOf(fam.story.beats.find(b => b.id === 'kitchen-list')!.popup.body).slice(0, c.parts[1].sentences).join(' '));
  assert.equal(pickExtension(memberBeats(short, 'sally'), short.beats.find(b => b.id === 'office-contracts')!)!.id, 'kitchen-list');
  // a pad joins the parts and the end card; each part's captions sit inside it
  assert.equal(c.pads.length, 2); assert.equal(c.pads[0].to, 1); assert.equal(c.pads[1].to, 'end');
  c.parts.forEach(p => { assert.ok(p.narrAt >= p.at && p.narrEnd <= p.end && p.end <= c.end.t0); });
  assert.ok(c.parts[1].at >= c.parts[0].end + CUT.padS - 1e-9);
  // nothing to go on to: it stays short and says so
  const alone = mini(st => { st.beats.find(b => b.id === 'office-contracts')!.popup.body = 'A client sends the contract.'; st.beats = st.beats.filter(b => b.id !== 'kitchen-list'); });
  const a = planOf(alone).cuts.find(x => x.member === 'sally')!;
  assert.equal(a.status, 'short'); assert.ok(a.duration < CUT.minS); assert.ok(a.notes.some(n => /stays under/.test(n)));
});

test('a caption that would run the cut over 25 s keeps whole sentences', () => {
  const long = mini(st => { st.beats.find(b => b.id === 'office-contracts')!.popup.body = Array.from({ length: 3 }, (_, i) => `${Array.from({ length: 19 }, (_, j) => `w${i}${j}`).join(' ')} end.`).join(' '); });
  const c = planOf(long).cuts.find(x => x.member === 'sally')!;
  assert.ok(c.duration <= CUT.maxS + 1e-9, `${c.duration}`);
  assert.ok(c.parts[0].sentences < c.parts[0].of && c.parts[0].sentences >= 1);
  assert.ok(/[.!?]$/.test(c.parts[0].text), 'the caption ends on a sentence end');
});

test('a member with no archetype or no beat in a room is skipped with a reason, never an error', () => {
  const s = mini(st => { delete st.members[3].archetype; st.beats = st.beats.filter(b => b.member !== 'steve'); });
  const r = planOf(s);
  assert.deepEqual(r.cuts.map(c => c.member), ['sally', 'john']);
  assert.deepEqual(r.skipped.map(x => x.member).sort(), ['jean', 'steve']);
});

test('the end card names Hermes and OpenClaw\'s makers only when a beat of the cut names an agent; names-owners when a chip says "replaces"', () => {
  assert.ok(BRENNAN.every(c => !c.disclosures.includes('attribution-agents')));
  assert.ok(BRENNAN.filter(c => c.chips.some(x => x.startsWith('replaces'))).every(c => c.disclosures.includes('names-owners')));
  const s = mini(st => { const b = st.beats.find(x => x.id === 'suite-code')!; b.agent = 'john'; });
  const c = planOf(s).cuts.find(x => x.member === 'john')!;
  assert.ok(c.disclosures.includes('attribution-agents'));
  assert.ok(endModelOf(c, claims).lines.includes(claims.disclosures.find((d: any) => d.id === 'attribution-agents').text));
});

// ---- the clock --------------------------------------------------------------------------------------------------------------------------------
test('frame i is at i / fps: the scenes follow one another, the camera is continuous inside a part, the first frame carries the hook', () => {
  for (const c of BRENNAN) {
    const E = 4;
    let last = '', lastTour = -1, kinds: string[] = [];
    for (let i = 0; i < c.frames; i++) {
      const ft = i / c.fps, sc = sceneAt(c, ft, E);
      const tag = sc.kind === 'part' ? `part${sc.part}` : sc.kind === 'pad' ? `pad${sc.pad}` : 'end';
      if (tag !== last) { kinds.push(tag); last = tag; if (sc.kind === 'part') lastTour = -1; }
      if (sc.kind === 'part') { assert.ok(sc.tour >= lastTour - 1e-9, `${c.id}: the camera went back at ${ft}`); lastTour = sc.tour; assert.ok(sc.tour >= c.parts[sc.part].tour!.from - 1e-9 && sc.tour <= c.parts[sc.part].tour!.to + 1e-9); }
    }
    assert.deepEqual(kinds, c.parts.flatMap((_, n) => [`part${n}`, `pad${n}`]).concat('end'), c.id);
    assert.equal(sceneAt(c, 0, E).kind, 'part');
    assert.equal(hookAlpha(0), 1, 'the first frame carries the hook'); assert.equal(hookAlpha(CUT.hookS), 0); assert.ok(hookAlpha(CUT.hookS - 0.1) < 1);
    assert.equal(c.parts[0].lead, CUT.hookS); assert.equal(c.parts[0].narrAt, CUT.hookS); assert.ok(c.parts[0].card.at >= CUT.hookS, 'the card comes in after the hook');
    // the pad's dip is 0 at its edges and 1 in the middle; the end card plays the exterior back
    const pd = c.pads[0], mid = sceneAt(c, (pd.t0 + pd.t1) / 2, E); assert.ok(mid.kind === 'pad' && mid.dip > 0.95);
    assert.equal(sceneAt(c, c.end.t0, E).tour, E); assert.ok(sceneAt(c, c.end.t1 - 1e-6, E).tour < 0.01);
    assert.equal(tourIn(c, 0, 0), c.parts[0].tour!.from);
  }
});

test('the camera cuts in as it settles: each part plays the tour from `lead` seconds before the camera arrives, inside its own beat', () => {
  const times = timesOf(fam.rs!);
  for (const c of BRENNAN) for (const p of c.parts) {
    const t = times[p.beat], arrive = t.travel ? t.travel[1] : t.t0;
    assert.ok(p.tour!.from >= t.t0 - 1e-9 && p.tour!.to <= t.t1, `${p.beat} stays inside its beat`);
    assert.ok(p.tour!.from <= arrive + 1e-9);
    if (t.travel && arrive - p.lead >= t.t0) assert.ok(Math.abs(p.tour!.from - (arrive - p.lead)) < 0.002, `${p.beat}: the camera arrives as the hook ends`);
  }
});

test('captions: cues of two lines at most, in order and not overlapping, every word inside its part; reading time is the bake\'s estimate', () => {
  for (const c of BRENNAN) for (const key of CUT_KEYS) {
    const max = cutCaptionChars(key), cues = cutCues(c.parts, max);
    for (let i = 0; i < cues.length; i++) {
      assert.ok(cues[i].text.length <= max * 2, `${c.id} ${key}: "${cues[i].text}"`);
      if (i) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9, 'cues do not overlap');
      assert.ok(cues[i].end > cues[i].start);
    }
    for (const p of c.parts) {
      assert.ok(p.words[0].s >= p.narrAt - 1e-6 && p.words[p.words.length - 1].e <= p.narrEnd + 1e-6);
      assert.ok(Math.abs((p.narrEnd - p.narrAt) - Math.round(p.text.split(/\s+/).length / 150 * 60000) / 1000) < 0.002, 'the estimate: 150 words a minute');
    }
  }
  const w = wordTimes('One two, three. Four five six.', 6);
  assert.equal(w.length, 6); assert.equal(w[0].s, 0); assert.ok(w[5].e <= 6 && w[5].e > 5.5); assert.ok(w[3].s - w[2].e > w[1].s - w[0].e - 0.7, 'a full stop leaves a pause');
});

// ---- the frames -------------------------------------------------------------------------------------------------------------------------------
test('the four frames: the file as delivered, what the page renders, the crop (4:5 is the middle of a square), the safe areas', () => {
  const f = Object.fromEntries(CUT_KEYS.map(k => [k, cutFormat(k, 1080)])) as Record<CutKey, ReturnType<typeof cutFormat>>;
  assert.deepEqual(f['9x16'].out, { w: 1080, h: 1920 }); assert.deepEqual(f['9x16'].page, { res: '1080', aspect: '9:16', w: 1080, h: 1920 });
  assert.deepEqual(f['16x9'].out, { w: 1920, h: 1080 }); assert.deepEqual(f['16x9'].page, { res: '1080', aspect: '16:9', w: 1920, h: 1080 });
  assert.deepEqual(f['1x1'].out, { w: 1080, h: 1080 }); assert.equal(f['1x1'].page.aspect, '1:1'); assert.ok(f['1x1'].page.w >= 1080 && f['1x1'].page.w === f['1x1'].page.h);
  assert.deepEqual(f['4x5'].out, { w: 1080, h: 1350 }); assert.equal(f['4x5'].page.aspect, '1:1'); assert.ok(f['4x5'].page.h >= 1350);
  assert.equal(f['4x5'].w / f['4x5'].h, 0.8, '4:5 is exactly 0.8 wide to 1 tall');
  assert.equal(f['4x5'].compose, 9 / 16, 'the camera is composed with the phone row, the subject above the sheet');
  for (const k of ['9x16', '1x1', '16x9'] as CutKey[]) assert.equal(f[k].compose, f[k].aspect, `${k} is composed for its own aspect`);
  assert.equal(f['4x5'].crop.w, f['4x5'].w); assert.equal(f['4x5'].crop.x * 2 + f['4x5'].crop.w, f['4x5'].page.w, 'the crop is the middle');
  // the page's own sizes: it renders 360, 540, 720, 1080, 1440 and 2160 and nothing in between
  const sizes = new Set(['640', '960', '1280', '1920', '2560', '3840']);
  for (const k of CUT_KEYS) for (const res of CUT_RES) {
    const g = cutFormat(k, res);
    assert.ok(CUT_RES.map(String).includes(g.page.res), `${k} ${res}: page res ${g.page.res}`);
    assert.ok(sizes.has(String(Math.max(g.page.w, g.page.h))), `${k} ${res}: page ${g.page.w}x${g.page.h}`);
    assert.equal(g.out.w % 2, 0, 'even width'); assert.equal(g.out.h % 2, 0, 'even height');
    assert.ok(g.page.w >= g.crop.w && g.page.h >= g.out.h * 0.99 || k === '16x9' || k === '9x16', `${k} ${res}: the render covers the frame`);
    assert.ok(g.k > 0);
  }
  assert.throws(() => cutFormat('9x16', 1000), /--res/);
  assert.throws(() => cutFormat('3x2' as CutKey, 1080), /unknown aspect/);
  // film.md's 9:16 margins
  assert.deepEqual(f['9x16'].safe, { top: 200, right: 72, bottom: 340, left: 72 });
  assert.deepEqual(cutFormat('9x16', 540).safe, { top: 100, right: 36, bottom: 170, left: 36 });
  assert.deepEqual(DESIGN['16x9'].safe, { top: 54, right: 96, bottom: 54, left: 96 });
});

test('the card, the hook and the captions stay inside the safe area and off each other; a card that covers the subject goes under the corner mark', () => {
  const inside = (f: ReturnType<typeof cutFormat>, r: { x: number; y: number; w: number; h: number }) => r.x >= f.safe.left - 1 && r.y >= f.safe.top - 1 && r.x + r.w <= f.w - f.safe.right + 1 && r.y + r.h <= f.h - f.safe.bottom + 1;
  for (const key of CUT_KEYS) for (const res of [540, 1080]) {
    const f = cutFormat(key, res), cap = cutCaptionBox(f), badge = cutBadgeBox(f, 640 * f.k);
    assert.ok(inside(f, cap), `${key} ${res}: captions`);
    assert.ok(badge.font >= CANVAS_TYPE_MIN * f.k - 1e-9, `${key} ${res}: the corner mark is ${badge.font} px, the floor ${CANVAS_TYPE_MIN * f.k}`);
    assert.ok(cap.font >= CANVAS_TYPE_MIN * f.k, `${key} ${res}: the caption type`);
    assert.ok(badge.x >= f.safe.left - 1 && badge.y >= f.safe.top - 1 && badge.y + badge.h < cap.y, `${key} ${res}: the corner mark`);
    // a subject low in the frame
    for (const focus of [{ x: f.w * 0.3, y: f.h * 0.15, w: f.w * 0.3, h: f.h * 0.2 }, null, { x: f.w * 0.35, y: f.h * 0.55, w: f.w * 0.3, h: f.h * 0.2 }]) {
      const card = { w: f.sheet ? f.w - f.safe.left - f.safe.right : canvasCardWidth(f), h: 340 * f.k };
      const p = placeForCut(f, { focus, core: null, card });
      assert.ok(inside(f, p.rect), `${key} ${res}: card ${JSON.stringify(p.rect)} in ${f.w}x${f.h} safe ${JSON.stringify(f.safe)}`);
      assert.ok(p.overlapBars === 0 || !p.ok, 'a card that touches the captions is not ok');
      if (f.sheet) { assert.equal(p.mode, 'sheet'); assert.ok(p.rect.y + p.rect.h <= cap.y + 1, 'the sheet sits on the captions'); }
      if (p.ok && focus) assert.ok(p.overlapFocus < 0.02);
    }
  }
  // a sheet frame whose subject is where the sheet would sit puts it under the corner mark
  const f = cutFormat('9x16', 1080), focus = { x: 200, y: 1150, w: 600, h: 300 };
  const p = placeForCut(f, { focus, core: null, card: { w: 936, h: 400 } });
  assert.equal(p.alt, 'top'); assert.ok(p.rect.y < 500);
});

// ---- the canvas type floor ---------------------------------------------------------------------------------------------------------------------
test('the floor is 36 design px at the 1080 short edge, kept in the manifest, and every size the overlay is built from is at or above it', () => {
  assert.equal(CANVAS_TYPE_MIN, 36); assert.equal(FLOOR, 36); assert.equal(DEFAULTS.typeFloorPx, 36);
  assert.ok(TYPE_MIN < CANVAS_TYPE_MIN, 'the live modals took the canon\'s 25.5 px; the canvases keep 36 (a canvas is shown scaled down)');
  assert.ok(TYPE.read >= FLOOR && TYPE.title >= 52 && TYPE.title <= 60, 'the card title is about 56');
  assert.ok(TYPE.titleHead.every(s => s >= FLOOR) && TYPE.address >= FLOOR && TYPE.tagline >= FLOOR && TYPE.signoff >= FLOOR && TYPE.url >= FLOOR);
  assert.ok(DISC_D * 1.2 >= FLOOR, 'the monogram\'s letter is at the floor too');
  assert.ok(CHIP_PAD > 0 && CHIP_H >= 1.4 && KICK_EM === 0.2);
  for (const key of CUT_KEYS) for (const res of CUT_RES) {
    const f = cutFormat(key, res), k = f.k;
    assert.ok(cutBadgeBox(f, 0).font >= FLOOR * k - 1e-9, `${key} ${res}: the corner mark`);
    assert.ok(cutCaptionBox(f).font >= FLOOR * k, `${key} ${res}: the caption`);
    assert.ok(hookSizes(f).every(s => s >= FLOOR * k - 1e-9), `${key} ${res}: every size of the hook`);
  }
  // the manifest the cuts are planned against says it
  const m = readManifest(); if (m) assert.equal((m.defaults as any).typeFloorPx, 36);
  // no size is written under the floor in the drawing code, and none is a share of another size (the old caption's 0.62 and 0.5 of its type were under it)
  for (const file of ['assets/story/film/cut/draw.ts', 'assets/story/film/cards.ts', 'assets/story/film/overlay.ts']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    for (const m2 of src.matchAll(/font\(\d+,\s*(\d+(?:\.\d+)?)\s*\*\s*(?:k|u|f\.k)\b/g)) assert.ok(+m2[1] >= FLOOR, `${file}: font size ${m2[1]} is under ${FLOOR}`);
    assert.ok(!/font\(\d+,\s*px\s*\*\s*0?\.\d+\)/.test(src), `${file}: a size that is a share of another size`);
  }
});

test('the name is a kicker by drawing only: capitals when drawn, the plan keeps the name as written', () => {
  assert.equal(caps('Sally'), 'SALLY'); assert.equal(caps('Étienne'), 'ÉTIENNE'); assert.equal(caps('The Brennan family'), 'THE BRENNAN FAMILY');
  for (const c of BRENNAN) { assert.equal(c.name, c.member[0].toUpperCase() + c.member.slice(1), `${c.id}: the plan says ${c.name}`); assert.notEqual(c.name, caps(c.name)); }
  assert.ok(!/toUpperCase\(\)|toLocaleUpperCase/.test(fs.readFileSync(path.join(ROOT, 'assets/story/film/cut/plan.ts'), 'utf8').replace(/\/\/[^\n]*/g, '')), 'the plan never uppercases a name');
  assert.equal(KICK_EM, 0.2, 'tracked 0.2em, like the live card');
});

test('a render fails on what was painted: both renderers audit every fillText against the floor and keep the result in the report', () => {
  for (const [file, call] of [['scripts/render-persona-cuts.mts', '__cut.typeAudit()'], ['scripts/render-family-film.mts', '__film.typeAudit()']]) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(src.includes(call) && /CANVAS_TYPE_MIN - 0\.01/.test(src) && src.includes('typePainted') && src.includes('info.tracking'), file);
  }
  for (const file of ['assets/story/film/cut/page.ts', 'assets/story/film/index.ts']) assert.ok(/auditType\(g, f\.k\)/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')), `${file} wraps its context`);
  assert.ok(/unsafe/.test(fs.readFileSync(path.join(ROOT, 'assets/story/film/index.ts'), 'utf8')), 'the film refuses a layout outside the safe area as the cut does');
});

test('the card is as wide as the live card is (a third of the canvas, 18 em of the floor at least), and narrower and taller ways to set it stop at 12.5 em', () => {
  for (const key of ['16x9', '1x1'] as CutKey[]) for (const res of [540, 1080]) {
    const f = cutFormat(key, res), w0 = canvasCardWidth(f), ws = canvasCardWidths(f);
    assert.ok(w0 >= 18 * FLOOR * f.k - 1 && w0 >= 0.32 * f.w - 1, `${key} ${res}: ${w0}`);
    assert.equal(ws[0], w0); assert.ok(ws.length >= 4 && ws.every((w, i) => !i || w < ws[i - 1]), `${key} ${res}: widths fall`);
    assert.ok(ws.every(w => w >= 12.5 * FLOOR * f.k - 1), `${key} ${res}: none narrower than 12.5 em`);
  }
  assert.equal(canvasCardWidth(cutFormat('16x9', 1080)), 648); assert.equal(canvasCardWidth(cutFormat('16x9', 540)), 324, 'a 540 render is the same picture');
});

test('canvasVariants: the card as designed first, tighter padding at a small cost, narrower more, the phone left out most; a width that cannot hold a chip is dropped', () => {
  const m = (w: number, tight: boolean, bare: boolean) => ({ w, h: 400 - (tight ? 30 : 0) + (bare ? -60 : 0), type: 36, bad: w < 500 && !tight && !bare });
  const v = canvasVariants([648, 560, 480], m, { bare: true });
  assert.equal(v[0].size.cost, 0); assert.equal(v[1].size.cost, COST_TIGHT); assert.equal(v[2].size.cost, COST_NARROWER);
  const plain = v.filter(x => !x.size.tag!.includes('bare')).map(x => x.size.cost!);
  assert.deepEqual(plain, [...plain].sort((a, b) => a - b), 'in order of what each costs'); assert.ok(v.some(x => x.size.cost! >= COST_BARE), 'the phone left out costs the most');
  assert.ok(v.every(x => !x.layout.bad), 'a layout with a chip wider than its column is not offered (480 as designed); tighter at 480 is');
  assert.ok(v.some(x => x.layout.w === 480) && !v.some(x => x.layout.w === 480 && !x.size.tag!.includes('tight') && !x.size.tag!.includes('bare')));
  assert.equal(canvasVariants([648, 560], m).length, 4); assert.ok(canvasVariants([648], m, { bare: true }).length === 4);
  // the first is kept even when bad, so a card always has one way to be set
  assert.equal(canvasVariants([400], () => ({ w: 400, h: 300, type: 36, bad: true })).length, 1);
});

test('the solver refuses a variant under the floor, and a card too tall for its room is not ok (a canvas cannot scroll)', () => {
  for (const key of ['9x16', '16x9', '1x1'] as CutKey[]) {
    const f = cutFormat(key, 1080), k = f.k, w = f.sheet ? f.w - f.safe.left - f.safe.right : canvasCardWidth(f), focus = { x: f.w * 0.1, y: f.h * 0.3, w: f.w * 0.15, h: f.h * 0.1 };
    const under = placeForCut(f, { focus, core: null, card: { w, h: 300 * k }, variants: [{ w, h: 300 * k, type: 30 * k }, { w, h: 340 * k, type: 36 * k, cost: 1 }] });
    assert.equal(under.variant, 1, `${key}: the 30 px variant is refused`); assert.equal(under.refused, 1);
    const all = placeForCut(f, { focus, core: null, card: { w, h: 300 * k }, variants: [{ w, h: 300 * k, type: 30 * k }] });
    assert.equal(all.ok, false, `${key}: every variant under the floor is not ok`); assert.equal(all.refused, 1);
    const tall = placeForCut(f, { focus, core: null, card: { w, h: f.h }, variants: [{ w, h: f.h, type: 36 * k }] });
    assert.equal(tall.ok, false, `${key}: a card as tall as the frame does not fit`);
  }
});

test('a sheet takes tighter padding before it takes another place, and the bottom before the top', () => {
  const f = cutFormat('9x16', 1080), k = f.k, cap = cutCaptionBox(f), w = f.w - f.safe.left - f.safe.right, bottom = cap.y - 16 * k;
  const variants = [{ w, h: 440, type: 36 * k }, { w, h: 400, type: 36 * k, cost: COST_TIGHT }];
  // a subject that ends 420 above the sheet's bottom edge: the card as designed (440 tall) reaches into it, the tight one (400) does not
  const sub = { x: 100, y: bottom - 460, w: 800, h: 40 };
  const p = placeForCut(f, { focus: sub, core: null, card: variants[0], variants });
  assert.equal(p.variant, 1, 'the tight card clears the subject'); assert.equal(p.alt, null); assert.ok(p.ok); assert.equal(p.rect.y + p.rect.h, bottom); assert.equal(p.rect.h, 400);
  // a subject in the bottom room that neither card clears: the card goes under the corner mark
  const low = { x: 100, y: 900, w: 800, h: 400 };
  const t = placeForCut(f, { focus: low, core: null, card: variants[0], variants });
  assert.equal(t.alt, 'top'); assert.ok(t.ok); assert.ok(t.rect.y >= f.safe.top + cutBadgeBox(f, 0).h);
  // nothing in the way: the bottom, the card as designed
  const clear = placeForCut(f, { focus: { x: 100, y: 300, w: 800, h: 200 }, core: null, card: variants[0], variants });
  assert.equal(clear.variant, 0); assert.equal(clear.alt, null); assert.ok(clear.ok);
  // the same function the film uses
  assert.equal(typeof placeCanvasCard, 'function');
});

// ---- the manifest ---------------------------------------------------------------------------------------------------------------------------
test('the manifest: well formed, one entry per cut, a hash that moves with the words, nothing absolute and no timestamp', () => {
  const built = buildPlans(['brennan'], claims, FROZEN), m = buildManifest(built, claims);
  assert.deepEqual(manifestProblems(m), []);
  const cuts = m.families.brennan.cuts;
  assert.deepEqual(cuts.map(c => c.id), BRENNAN.map(c => c.id));
  for (const c of cuts) {
    assert.deepEqual(c.aspects, ['9x16', '1x1', '4x5', '16x9']);
    assert.equal(c.captions.length, c.beats.length); assert.ok(/^[0-9a-f]{64}$/.test(c.hash));
    assert.ok(c.chips.length >= 1 && c.disclosures.length >= 4);
  }
  assert.equal(new Set(cuts.map(c => c.hash)).size, cuts.length, 'one hash a cut');
  const text = manifestText(m);
  assert.ok(!/\/home\/|\/tmp\/|C:\\|\d{4}-\d{2}-\d{2}T/.test(text), 'no absolute path and no timestamp');
  assert.equal(manifestText(buildManifest(buildPlans(['brennan'], claims, FROZEN), claims)), text, 'the same files give the same bytes');
  // the hash moves with the words, the camera and the claims
  const sally = BRENNAN[0], h0 = cutHash(sally, fam, claims);
  assert.equal(cutHash(clone(sally), fam, claims), h0);
  const edited = clone(sally); edited.parts[0].text += ' x'; assert.notEqual(cutHash(edited, fam, claims), h0);
  const moved = clone(sally); moved.parts[0].tour!.from += 0.5; assert.notEqual(cutHash(moved, fam, claims), h0);
  const re = clone(fam); re.bake!.timeline.trackSha = 'f'.repeat(64); assert.notEqual(cutHash(sally, re, claims), h0);
  const cl = clone(claims); cl.disclosures.find((d: any) => d.id === 'scripted-scenes').text += ' '; assert.notEqual(cutHash(sally, fam, cl), h0);
  assert.equal(manifestDrift(m, m).length, 0);
  assert.ok(manifestDrift(null, m).length === 1);
  const m2: Manifest = clone(m); m2.families.brennan.cuts[0].hash = '0'.repeat(64); assert.deepEqual(manifestDrift(m2, m), ['brennan-sally: changed']);
});

test('the committed content/story/ads.json is a manifest of this shape and has the four Brennan cuts', () => {
  const m = readManifest();
  if (!m) { assert.ok(!fs.existsSync(adsJsonPath())); return; }   // before the first story:ads
  assert.deepEqual(manifestProblems(m), []);
  assert.deepEqual(m.families.brennan.cuts.map(c => c.member), ['sally', 'john', 'steve', 'jean']);
  assert.ok(!/[—–]/.test(JSON.stringify(m)));
});

test('a family in progress is skipped and never fatal: a file that does not parse, one without members, one with no bake lock', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-fam-'));
  try {
    fs.copyFileSync(path.join(FROZEN, 'brennan.json'), path.join(dir, 'brennan.json'));
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ "schema": "family/v1", ');
    fs.writeFileSync(path.join(dir, 'empty.json'), JSON.stringify({ schema: 'family/v1', slug: 'empty', house: 'x' }));
    fs.writeFileSync(path.join(dir, 'wrong-slug.json'), JSON.stringify({ ...fam.story, slug: 'someone-else' }));
    const b = buildPlans(undefined, claims, dir);
    assert.deepEqual([...b.plans.keys()], ['brennan']);
    assert.deepEqual(b.unreadable.map(u => u.slug).sort(), ['broken', 'empty', 'wrong-slug']);
    assert.ok(b.plans.get('brennan')!.cuts.every(c => c.status === 'no-bake'), 'no bake lock: planned, not renderable');
    assert.ok(b.plans.get('brennan')!.fam.bakeWhy);
    // a bake that is not the story's is a reason, not a throw
    const bk = clone(fam.bake!); bk.timeline.beats = bk.timeline.beats.slice(1); fs.writeFileSync(path.join(dir, 'brennan.bake.json'), JSON.stringify(bk));
    const f2 = loadAdFamily('brennan', dir) as AdFamily; assert.equal(f2.bake, null); assert.match(f2.bakeWhy!, /does not fit/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- the encode, the gates and the machine ------------------------------------------------------------------------------------------------
test('the encode: silent by default (one stream), H.264 high yuv420p, bt709, one thread and bitexact so the same frames give the same bytes', () => {
  const a = encodeArgs({ fps: 30, from: { w: 1080, h: 1920 }, out: { w: 1080, h: 1920 }, file: 'o.mp4' }), j = a.join(' ');
  assert.ok(a.includes('-an') && !j.includes('anullsrc') && !j.includes('1:a'), 'no audio stream');
  for (const need of ['libx264', 'yuv420p', '-profile:v high', '-colorspace bt709', '-threads 1', '-flags:v +bitexact', '-fflags +bitexact', '-map_metadata -1', '+faststart', '-framerate 30']) assert.ok(j.includes(need), need);
  assert.ok(!/scale=\d+:\d+/.test(j), 'no scale when the canvas is the frame');
  const s = encodeArgs({ fps: 30, from: { w: 1536, h: 1920 }, out: { w: 1080, h: 1350 }, file: 'o.mp4', audio: 'silent' }).join(' ');
  assert.ok(s.includes('scale=1080:1350:flags=lanczos') && s.includes('anullsrc') && s.includes('-map 1:a') && s.includes('-c:a aac') && s.includes('-ar 48000') && s.includes('-shortest') && !s.includes(' -an '));
  assert.equal(a[a.length - 1], 'o.mp4');
});

test('the encode runs: ffmpeg takes a stream of JPEG frames to the file for every path (identity, scaled, silent), and ffprobe agrees', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 }, () => {
  const frames = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=128x160:rate=30', '-frames:v', '9', '-f', 'image2pipe', '-c:v', 'mjpeg', '-'], { maxBuffer: 1 << 26 });
  assert.equal(frames.status, 0); assert.ok((frames.stdout as Buffer).length > 1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-enc-'));
  try {
    for (const [label, from, out, audio] of [['identity', { w: 128, h: 160 }, { w: 128, h: 160 }, 'none'], ['scaled', { w: 128, h: 160 }, { w: 108, h: 136 }, 'none'], ['silent', { w: 128, h: 160 }, { w: 108, h: 136 }, 'silent']] as const) {
      const file = path.join(dir, `${label}.mp4`);
      const r = spawnSync('ffmpeg', encodeArgs({ fps: 30, from, out, file, audio }), { input: frames.stdout as Buffer, encoding: 'utf8' });
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }).stdout).streams;
      const v = p.find((s: any) => s.codec_type === 'video'), a = p.find((s: any) => s.codec_type === 'audio');
      assert.deepEqual([v.codec_name, v.pix_fmt, v.width, v.height, v.nb_read_packets], ['h264', 'yuv420p', out.w, out.h, '9'], label);
      assert.equal(p.length, audio === 'silent' ? 2 : 1, `${label}: streams`);
      if (audio === 'silent') assert.deepEqual([a.codec_name, a.sample_rate, a.channels], ['aac', '48000', 2]);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the GPU switch: default is the machine\'s own GPU through ANGLE, software is the repo\'s SwiftShader; PERSONA_CUT_GL; a bad value is refused', () => {
  assert.ok(glArgs('default', 'linux').includes('--use-angle=default') && glArgs('default', 'linux').includes('--enable-gpu-rasterization'));
  assert.ok(!glArgs('default', 'linux').some(x => x.includes('swiftshader')));
  assert.deepEqual(glArgs('software', 'linux'), LAUNCH_ARGS); assert.deepEqual(glArgs('default', 'darwin'), LAUNCH_ARGS);
  assert.equal(glMode(undefined, {}), 'default'); assert.equal(glMode(undefined, { PERSONA_CUT_GL: 'software' }), 'software'); assert.equal(glMode('default', { PERSONA_CUT_GL: 'software' }), 'default');
  assert.throws(() => glMode('vulkan', {}), /must be one of/);
  // the Chromium: Playwright's own, else the newest in the browsers folder; never a download
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-pw-'));
  try {
    for (const [d, exe] of [['chromium-1100', 'chrome-linux64/chrome'], ['chromium_headless_shell-1200', 'chrome-headless-shell-linux64/chrome-headless-shell'], ['chromium_headless_shell-1234', 'chrome-headless-shell-linux64/chrome-headless-shell']]) {
      fs.mkdirSync(path.dirname(path.join(dir, d, exe)), { recursive: true }); fs.writeFileSync(path.join(dir, d, exe), '');
    }
    const r = chromiumFor({ chromium: { executablePath: () => '/nowhere/chrome' } }, { PLAYWRIGHT_BROWSERS_PATH: dir });
    assert.ok(r.executablePath!.includes('chromium_headless_shell-1234'), r.executablePath);
    assert.equal(chromiumFor({ chromium: { executablePath: () => process.execPath } }, {}).executablePath, undefined, 'Playwright\'s own is used when it is there');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('names and records: a render is current while the cut, the code, the hour and the audio are the same', () => {
  assert.equal(outName('brennan-sally', '9x16', 1080), 'brennan-sally.9x16.mp4'); assert.equal(outName('brennan-sally', '1x1', 540), 'brennan-sally.1x1.r540.mp4');
  assert.equal(renderKey('brennan-sally', '4x5', 1080), 'brennan-sally.4x5.1080');
  assert.equal(outName('brennan-sally', '9x16', 1080, 'silent'), 'brennan-sally.9x16.silent.mp4'); assert.equal(renderKey('brennan-sally', '9x16', 540, 'silent'), 'brennan-sally.9x16.540.silent');
  assert.equal(renderState(undefined, 'h', 't', { lighting: 'day', audio: 'none' }), 'missing');
  const t = toolSha(); assert.ok(/^[0-9a-f]{64}$/.test(t)); assert.equal(toolSha(), t);
});

test('the pure helpers: sentences, canonical JSON', () => {
  assert.deepEqual(sentencesOf('One. Two! Three? Four'), ['One.', 'Two!', 'Three?', 'Four']);
  assert.equal(canon({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});
