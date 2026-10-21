#!/usr/bin/env -S node --experimental-strip-types
// Tests for the camera spline gate (scripts/story/spline-report.mts, spline-sheets.mts, the --gl flag of scripts/story-bake.mts): pure Node, no GPU, no browser.
//   * the thresholds equal the numbers they mirror in the code (the tour's look cap, the pose tiers, the cut length) and say what they are
//   * a mutation fixture for every rule: a lock (or a story) changed on purpose in memory or in a temp dir, and the rule that must catch it, with the beat id
//   * the committed Brennan tours (reviewed and accepted by humans) pass; the pre-fix kids-notes / kids-photos anchors in the Kids Room fail `never-framed`
//   * the fleet output: worst homes first, a JSON and a markdown table with the failing rule and the beat id; the CLI in a temp dir, with --strict
//   * the contact-sheet page lists every beat id and every defect and escapes what it prints; story-bake's --gl is validated before any bake
// Needs `pnpm run build` and the committed brennan-hollin story, lock and house (the known case).
// @check-house node-test
// @check-house quick
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  T, FRAMES, gradeFamily, gradeSlug, defaultDirs, clearanceAt, neverFramedPieces, neverStageRooms, lookRates, sortWorstFirst, fleetJson, fleetMarkdown, familySlugs,
  type SplineInput, type FamilyReport, type Dirs,
} from './story/spline-report.mts';
import { renderIndex, beatRows, type Entry } from './story/spline-sheets.mts';
import { bakeFamily } from './story-bake.mts';
import { createPoseCtx } from '../assets/story/poses.js';
import { MAX_ROUTE_M } from '../assets/story/route.js';
import type { StoryTrack } from '../assets/story/track.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const D = defaultDirs();
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
function clone<X>(x: X): X { return JSON.parse(JSON.stringify(x)); }
const table = readJson(D.roles);
const casting = (slug: string) => (readJson(D.casting).families as any[]).find(f => f.slug === slug);

/** brennan-hollin as committed (story, lock, house, casting): the known case */
let base: SplineInput;
before(() => {
  const story = readJson(path.join(D.families, 'brennan-hollin.json')), lock = readJson(path.join(D.families, 'brennan-hollin.bake.json'));
  const specText = fs.readFileSync(path.join(D.houses, `${story.house}.json`), 'utf8');
  base = { slug: 'brennan-hollin', story, lock, spec: JSON.parse(specText), specText, world: readJson(path.join(D.houses, `${story.house}.plan.json`)).shots.world, table, casting: casting('brennan-hollin') };
});
const fresh = (): SplineInput => ({ ...base, story: clone(base.story), lock: clone(base.lock) });
const rules = (r: FamilyReport, sev?: 'fail' | 'warn') => r.defects.filter(d => !sev || d.sev === sev).map(d => `${d.rule}:${d.beat ?? ''}`);
const has = (r: FamilyReport, rule: string, beat: string | null, sev: 'fail' | 'warn' = 'fail') => r.defects.some(d => d.rule === rule && d.sev === sev && (beat === null || d.beat === beat));

// ---- the thresholds are the code's numbers --------------------------------------------------------------------------------------------------------
test('the thresholds mirror the code they were taken from', () => {
  const track = fs.readFileSync(path.join(ROOT, 'assets', 'story', 'track.ts'), 'utf8');
  assert.equal(+/const YAW_RATE_CAP = (\d+)/.exec(track)![1], T.lookCapDegPerS, 'the tour\'s own look limit (assets/story/track.ts YAW_RATE_CAP)');
  assert.equal(T.maxRouteM, MAX_ROUTE_M, 'the cut threshold (assets/story/route.ts)');
  const poses = fs.readFileSync(path.join(ROOT, 'assets', 'story', 'poses.ts'), 'utf8');
  const tiers = [...poses.matchAll(/\{ wall: ([\d.]+), item: ([\d.]+), vis:/g)].map(m => ({ wall: +m[1], item: +m[2] }));
  assert.deepEqual(tiers, T.clear, 'the solver\'s clearance tiers (assets/story/poses.ts TIERS)');
  const nav = fs.readFileSync(path.join(ROOT, 'assets', 'shot-nav.ts'), 'utf8');
  const last = [...nav.matchAll(/\{ wall: ([\d.]+), item: ([\d.]+), soft: (?:true|false) \}/g)].map(m => ({ wall: +m[1], item: +m[2] })).pop()!;
  assert.ok(last.wall - T.moveClear.wall <= 0.031 && last.wall > T.moveClear.wall && last.item - T.moveClear.item <= 0.031, 'the walk floor is the walker\'s last tier less 3 cm');
  assert.ok(T.maxCuts === 3 && T.maxTier === 1 && FRAMES.length === 3 && T.lookFailAt > T.lookWarnAt && T.anchorFailMult < T.anchorWarnMult);
});

// ---- the committed Brennan tours pass ------------------------------------------------------------------------------------------------------------
test('the three Brennan tours, reviewed and accepted, have no failing defect', async () => {
  for (const slug of ['brennan', 'brennan-hollin', 'brennan-merrow']) {
    const r = await gradeSlug(slug);
    assert.equal(r.fails, 0, `${slug}: ${JSON.stringify(r.defects.filter(d => d.sev === 'fail'))}`);
    assert.ok(r.stats && r.stats.beats > 20 && r.stats.tiers[2] === 0, `${slug} has stats and no tier 2`);
  }
});

// ---- one mutation per rule ---------------------------------------------------------------------------------------------------------------------------
test('baseline: committed brennan-hollin has no failing defect and a known set of notes', async () => {
  const r = await gradeFamily(base);
  assert.equal(r.fails, 0, JSON.stringify(r.defects.filter(d => d.sev === 'fail')));
  assert.equal(r.stats!.cuts, 2); assert.ok(r.stats!.lookYaw <= T.lookCapDegPerS * T.lookFailAt);
});

test('lock-stale: a changed spec byte, and a lock that is not the story\'s beats', async () => {
  const a = fresh(); a.lock.specSha = '0'.repeat(64);
  assert.ok(has(await gradeFamily(a), 'lock-stale', null));
  const b = fresh(); b.story.beats.pop();
  const rb = await gradeFamily(b);
  assert.ok(rb.defects.some(d => d.rule === 'lock-stale' && /not the story's/.test(d.msg)));
});

test('anchor-lost: a beat with no pose, and a track that holds still', async () => {
  const a = fresh(); delete a.lock.poses['kitchen-demo'];
  assert.ok(has(await gradeFamily(a), 'anchor-lost', 'kitchen-demo'));
  const b = fresh(); (b.lock.track as StoryTrack).beats['dining-quiz'].role = 'none';
  assert.ok(has(await gradeFamily(b), 'anchor-lost', 'dining-quiz'));
});

test('pose-tier: tier 2 fails, tier 1 does not; fallbacks are counted, and too many fail', async () => {
  const a = fresh(); a.lock.poses['kitchen-demo'].tier = 2;
  const ra = await gradeFamily(a); assert.ok(has(ra, 'pose-tier', 'kitchen-demo')); assert.deepEqual(ra.stats!.tiers, [25, 0, 1]);
  const b = fresh(); b.lock.poses['kitchen-demo'].tier = 1;
  const rb = await gradeFamily(b); assert.ok(!rules(rb).some(x => x.startsWith('pose-tier')) && rb.stats!.tiers[1] === 1);
  const c = fresh(); c.lock.poses['kitchen-demo'].resolved.viaFallback = 1;
  const rc = await gradeFamily(c); assert.ok(has(rc, 'fallback', 'kitchen-demo', 'warn') && rc.stats!.fallbacks === 1 && !has(rc, 'fallback-share', null, 'warn'));
  const d = fresh(); for (const id of Object.keys(d.lock.poses)) d.lock.poses[id].resolved.viaFallback = 1;
  assert.ok(has(await gradeFamily(d), 'fallback-share', null, 'fail'));
});

test('look-rate: a heading that flips between two samples is a turn far over the tour\'s limit, in the beat it is in', async () => {
  const a = fresh(), track = a.lock.track as StoryTrack;
  const mv = track.segs.find(s => s.k === 'move' && s.m === 'follow' && s.n > 60) as any;
  for (let j = Math.floor(mv.n / 2); j < mv.n; j++) for (let c = 0; c < 3; c++) mv.look[3 * j + c] = 2 * mv.pos[3 * j + c] - mv.look[3 * j + c];   // the heading points backwards from here on
  const r = await gradeFamily(a);
  assert.ok(has(r, 'look-rate', mv.to), JSON.stringify(r.defects.filter(d => d.rule === 'look-rate')));
  assert.ok(r.stats!.lookYaw > T.lookCapDegPerS * T.lookFailAt);
  // the measure: the committed track is inside the limit, at every frame the gate looks at
  const rt = lookRates(base.lock.track as StoryTrack, base.lock.timeline.beats);
  assert.ok(rt.yaw <= T.lookCapDegPerS * T.lookFailAt && rt.pitch <= T.lookCapDegPerS * T.lookFailAt);
});

test('cuts: more than three fail with their reasons; a cut the camera cannot walk to is also noted for the geometry stream', async () => {
  const a = fresh(), tr = a.lock.track as StoryTrack, ids = a.lock.timeline.beats.map(b => b.id);
  tr.events.cuts = [10, 20, 30, 40]; tr.stats.cuts = 4; tr.stats.notes.push(`${ids[8]}: cut (no walkable leg on l1)`, `${ids[9]}: cut (route is 30 m)`);
  const r = await gradeFamily(a);
  assert.ok(has(r, 'cuts', null), 'four cuts'); assert.ok(has(r, 'cut-reason', ids[8], 'warn'));
  assert.ok(r.defects.find(d => d.rule === 'cuts')!.msg.includes('route is 30 m'));
  assert.ok(r.stats!.cutReasons.length >= 3);
});

test('walk-long: a walk shown as a move that is longer than the cut threshold', async () => {
  const a = fresh(), mv = (a.lock.track as StoryTrack).segs.find(s => s.k === 'move' && s.n > 30) as any;
  for (let j = 1; j < mv.n; j++) for (const c of [0, 2]) mv.pos[3 * j + c] = mv.pos[c] + (mv.pos[3 * j + c] - mv.pos[c]) * 20;   // twenty times as far
  assert.ok(has(await gradeFamily(a), 'walk-long', mv.to));
  const b = fresh(), m2 = (b.lock.track as StoryTrack).segs.find(s => s.k === 'move') as any; m2.t1 = m2.t0 + 40;   // 40 s of walking
  assert.ok(has(await gradeFamily(b), 'walk-long', m2.to, 'warn'));
});

test('eye-clearance: an eye in a wall, a walk through a wall', async () => {
  const w = base.world, wall = (() => { for (let q = 0; q < w.kinds.length; q++) if (w.kinds[q] === 1) { const b = w.boxes.slice(6 * q, 6 * q + 6); if (b[1] <= 0.2 && b[4] >= 2 && b[3] - b[0] > 0.8 && b[5] - b[2] < 0.5) return [(b[0] + b[3]) / 2, (b[2] + b[5]) / 2]; } return null; })()!;
  assert.ok(wall, 'the house has a full-height wall to stand in');
  const ctx = createPoseCtx(w), c = clearanceAt(ctx, [wall[0], 1.55, wall[1]], 'l1');
  assert.ok(c && c.wall < 0.05, 'the grid says the middle of a wall is a wall');
  const id = Object.keys(base.lock.poses).find(k => base.lock.poses[k].level === 'l1')!;
  const a = fresh(); a.lock.poses[id].eye = [wall[0], 1.55, wall[1]];
  assert.ok(has(await gradeFamily(a), 'eye-clearance', id), 'the rest eye');
  const b = fresh(), mv = (b.lock.track as StoryTrack).segs.find(s => s.k === 'move' && s.n > 40 && (s as any).pos[1] < 2) as any;
  for (let j = 10; j < 14; j++) { mv.pos[3 * j] = wall[0]; mv.pos[3 * j + 1] = 1.55; mv.pos[3 * j + 2] = wall[1]; }
  assert.ok(has(await gradeFamily(b), 'eye-clearance', mv.to), 'a walk');
  // the baseline clears them all, tier by tier
  assert.ok(!rules(await gradeFamily(base)).some(x => x.startsWith('eye-clearance')));
});

test('anchor-size and anchor-frame: a speck of an anchor, and an anchor bigger than the frame', async () => {
  const id = 'kitchen-demo', a = fresh(), bf = (a.lock.track as StoryTrack).beats[id];
  bf.box = [bf.focus[0] - 0.01, bf.focus[1] - 0.01, bf.focus[2] - 0.01, bf.focus[0] + 0.01, bf.focus[1] + 0.01, bf.focus[2] + 0.01];
  const ra = await gradeFamily(a); assert.ok(has(ra, 'anchor-size', id)); assert.match(ra.defects.find(d => d.rule === 'anchor-size' && d.beat === id)!.msg, /px across/);
  const b = fresh(), bb = (b.lock.track as StoryTrack).beats[id];
  bb.box = [bb.focus[0] - 6, 0, bb.focus[2] - 6, bb.focus[0] + 6, 3, bb.focus[2] + 6];
  assert.ok(has(await gradeFamily(b), 'anchor-frame', id), 'the lens inside the anchor\'s box');
  const c = fresh(), bc = (c.lock.track as StoryTrack).beats[id]; for (const row of bc.compose) row.nx = 1.4;   // composed off the right edge of every frame
  const rc = await gradeFamily(c); assert.ok(has(rc, 'anchor-frame', id), 'cropped'); assert.match(rc.defects.find(d => d.rule === 'anchor-frame' && d.beat === id)!.msg, /outside the frame/);
  const d = fresh(), bd = (d.lock.track as StoryTrack).beats[id]; for (const row of bd.compose) row.nx = 1.4; bd.partial = true;
  const rd = await gradeFamily(d); assert.ok(has(rd, 'anchor-frame', id, 'warn') && !has(rd, 'anchor-frame', id, 'fail'), 'a partial anchor is a note, not a fault');
});

test('exterior-first and exterior-last: the tour opens and closes outdoors', async () => {
  const a = fresh(), ftue = (a.lock.track as StoryTrack).segs[0] as any;
  assert.equal(ftue.k, 'ftue');
  for (let j = 0; j < 14; j++) { ftue.pos[3 * j] = -5.6; ftue.pos[3 * j + 1] = 1.5; ftue.pos[3 * j + 2] = 0.6; }   // inside the Study for the first seconds
  assert.ok(has(await gradeFamily(a), 'exterior-first', 'ftue-delivery'));
  const b = fresh(); (b.lock.track as StoryTrack).events.enter = 2.5;
  assert.ok(has(await gradeFamily(b), 'exterior-first', 'ftue-delivery', 'warn'), 'indoors inside the title card is a note');
  const c = fresh(), last = (c.lock.track as StoryTrack).segs[(c.lock.track as StoryTrack).segs.length - 1] as any;
  assert.equal(last.k, 'hold'); last.eye0 = [-5.6, 1.5, 0.6]; last.eye1 = [-5.6, 1.5, 0.6];
  assert.ok(has(await gradeFamily(c), 'exterior-last', 'outro-street'));
});

// ---- the crib ----------------------------------------------------------------------------------------------------------------------------------------
test('never-framed: the committed brennan-hollin passes, and the pre-fix kids-notes / kids-photos in the Kids Room fail', async () => {
  const pieces = neverFramedPieces(base.casting, base.world);
  assert.ok(pieces.some(p => p.type === 'crib' && p.room === 'Kids Room'), 'the crib is found in the Kids Room');
  assert.ok(pieces.some(p => p.type === 'toddler-bed'));
  assert.ok(!(await gradeFamily(base)).defects.some(d => d.rule === 'never-framed' && d.sev === 'fail'), 'committed: no beat frames the crib');
  // the fixture: the two anchors as they were before 32b416d moved Jean's beats out of the Kids Room, baked in memory against the house
  const story = clone(base.story);
  for (const b of story.beats) {
    if (b.id === 'kids-notes') { b.anchor = { role: 'desk', room: 'kids', fallback: [{ role: 'room', room: 'kids', nth: 1 }] }; b.camera = { framing: 'medium', side: 'right', from: 'front' }; }
    if (b.id === 'kids-photos') { b.anchor = { role: 'desk', room: 'kids', fallback: [{ role: 'room', room: 'kids', nth: 1 }] }; b.camera = { framing: 'close', side: 'left' }; }
  }
  const baked = await bakeFamily('brennan-hollin', { story, estimated: true });
  assert.equal(baked.problems.length, 0, baked.problems.join('; '));
  const r = await gradeFamily({ ...base, story, lock: baked.lock });
  assert.ok(has(r, 'never-framed', 'kids-notes') && has(r, 'never-framed', 'kids-photos'), JSON.stringify(r.defects));
  assert.ok(r.defects.filter(d => d.rule === 'never-framed' && d.sev === 'fail').every(d => d.value === 'crib'));
  assert.equal(r.status, 'fail');
});

test('never-framed: what the casting\'s words mean', () => {
  const w = base.world;
  const types = (c: any) => neverFramedPieces(c, w).map(p => p.type).sort();
  assert.deepEqual(types(null), []);
  assert.deepEqual(types({ reason: 'A normal family.' }), []);
  assert.deepEqual(types({ reason: 'the beats never frame a crib or a toddler bed.' }), ['crib', 'toddler-bed']);
  assert.ok(types({ reason: 'No beat frames a rocking horse.' }).every(t => t === 'rocking-horse'));
  assert.ok(types({ fitNote: 'Sleeping is not told.' }).includes('headboard-bed'), 'sleeping is not told: every bed');
  assert.ok(neverFramedPieces({ neverFramed: ['room:Nursery'] }, w).every(p => p.room === 'Nursery'), 'an explicit room');
  assert.deepEqual(types({ neverFramed: ['crib'] }), ['crib']);
  assert.deepEqual(neverStageRooms({ reason: 'the Nursery is a spare room and is never a stage.' }), ['nursery']);
  assert.deepEqual(neverStageRooms({ reason: 'A Nursery with a crib.' }), []);
});

test('never-stage: a beat anchored in the room the casting says is never a stage', async () => {
  const w = base.world, nursery = w.levels.flatMap(l => l.rooms.map(r => ({ l, r }))).find(x => /nursery/i.test(x.r.name))!;
  assert.ok(nursery, 'bgfamily has a Nursery');
  const a = fresh(); a.casting = { ...base.casting, reason: 'The Nursery is a spare room and is never a stage.', fitNote: undefined };
  const bf = (a.lock.track as StoryTrack).beats['kitchen-demo'], r = nursery.r.b;
  bf.level = nursery.l.id; bf.box = [r.x + 0.5, 0, r.z + 0.5, r.x + 1.5, 1, r.z + 1.5];
  assert.ok(has(await gradeFamily(a), 'never-stage', 'kitchen-demo'));
  const b = fresh(); b.casting = a.casting;
  assert.ok(!rules(await gradeFamily(b)).some(x => x.startsWith('never-stage')), 'the committed tour keeps out of the Nursery');
});

// ---- the fleet output, the CLI ---------------------------------------------------------------------------------------------------------------------------
test('fleet: worst first, with the failing rule and the beat id, as JSON and as a markdown table', async () => {
  const good = await gradeFamily(base), bad = fresh(); bad.slug = 'aaa-bad'; bad.lock.poses['kitchen-demo'].tier = 2; bad.lock.poses['dining-quiz'].tier = 2;
  const worse = await gradeFamily(bad), warny = clone(good); warny.slug = 'zzz-warn'; warny.warns += 2;
  const sorted = sortWorstFirst([good, warny, worse]);
  assert.equal(sorted[0].slug, 'aaa-bad'); assert.equal(sorted[sorted.length - 1].fails, 0);
  assert.ok(sorted.findIndex(r => r.slug === 'zzz-warn') < sorted.findIndex(r => r.slug === 'brennan-hollin'), 'more warnings first among the passing');
  const j = fleetJson([good, worse]); assert.equal(j.families[0].slug, 'aaa-bad'); assert.equal(j.totals.fail, 1); assert.equal(j.thresholds.maxCuts, 3);
  const md = fleetMarkdown([good, worse]);
  assert.match(md, /\| 1 \| aaa-bad \|/); assert.match(md, /pose-tier \(kitchen-demo\)/); assert.match(md, /\| fail \| pose-tier \| dining-quiz \|/); assert.match(md, /## Thresholds/);
  assert.equal(fleetMarkdown([good, worse]), md, 'the same input gives the same bytes');
});

test('CLI in a temp dir: --strict exits 1 on a failing family and 0 on a passing one; a family with no lock fails', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spline-')), fam = path.join(dir, 'families'), hs = path.join(dir, 'houses');
  fs.mkdirSync(fam); fs.mkdirSync(hs);
  const house = base.story.house;
  for (const f of [`${house}.json`, `${house}.plan.json`]) fs.copyFileSync(path.join(D.houses, f), path.join(hs, f));
  fs.copyFileSync(path.join(D.families, 'brennan-hollin.json'), path.join(fam, 'good.json'));
  const lockOf = (mut?: (l: any) => void) => { const l = clone(base.lock); l.slug = 'good'; mut?.(l); return JSON.stringify(l); };
  fs.writeFileSync(path.join(fam, 'good.bake.json'), lockOf());
  const story = clone(base.story); story.slug = 'good'; fs.writeFileSync(path.join(fam, 'good.json'), JSON.stringify(story));
  const story2 = clone(story); story2.slug = 'broken'; fs.writeFileSync(path.join(fam, 'broken.json'), JSON.stringify(story2));
  fs.writeFileSync(path.join(fam, 'broken.bake.json'), lockOf(l => { l.slug = 'broken'; l.poses['kitchen-demo'].tier = 2; }));
  const story3 = clone(story); story3.slug = 'nolock'; fs.writeFileSync(path.join(fam, 'nolock.json'), JSON.stringify(story3));
  const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'story', 'spline-report.mts'), '--dir', fam, '--houses', hs, '--casting', D.casting, ...args], { encoding: 'utf8' });
  const jf = path.join(dir, 'out.json'), mf = path.join(dir, 'out.md');
  const all = run('--all', '--json', jf, '--md', mf);
  assert.equal(all.status, 0, all.stderr); const j = readJson(jf);
  assert.deepEqual(j.families.map((f: any) => f.slug).slice(0, 2).sort(), ['broken', 'nolock'], 'the two failing are first');
  assert.ok(j.families.find((f: any) => f.slug === 'nolock').defects[0].rule === 'lock-missing');
  assert.ok(fs.readFileSync(mf, 'utf8').includes('| fail | pose-tier | kitchen-demo |'));
  assert.equal(run('--all', '--strict', '--quiet').status, 1);
  assert.equal(run('good', '--strict', '--quiet').status, 0, 'a passing family under --strict');
  assert.equal(run('broken', '--strict', '--quiet').status, 1);
  assert.deepEqual(familySlugs(fam), ['broken', 'good', 'nolock']);
  const dirs: Dirs = { families: fam, houses: hs, casting: D.casting, roles: D.roles }; assert.equal((await gradeSlug('good', dirs)).status === 'fail', false);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- the sheets page, the --gl flag ----------------------------------------------------------------------------------------------------------------------------
test('the contact-sheet page: every beat id, the defects, the images that exist, and nothing unescaped', async () => {
  const r = await gradeFamily(base), bad = fresh(); bad.lock.poses['kitchen-demo'].tier = 2;
  const rb = await gradeFamily(bad), beats = beatRows('brennan-hollin');
  assert.equal(beats.length, base.story.beats.length); assert.ok(beats.every(b => b.id && b.got !== 'NO POSE'));
  const mk = (rep: FamilyReport, files: Record<string, boolean>, over: Partial<Entry> = {}): Entry => ({ slug: rep.slug, house: rep.house, report: rep, beats, rendered: true, seconds: 12, lockChanged: false, files, ...over });
  const html = renderIndex([mk(r, { sheet169: true, sheet916: true, strip169: true, strip916: false }), mk({ ...rb, slug: 'x<b>"&' }, {}, { note: '<script>alert(1)</script>', lockChanged: true })], { res: '540', gl: 'default', strip: 8 });
  for (const b of beats) assert.ok(html.includes(`<code>${b.id}</code>`), b.id);
  assert.ok(html.includes('brennan-hollin.16x9.sheet.jpg') && html.includes('brennan-hollin.9x16.sheet.jpg') && html.includes('brennan-hollin.16x9.strip.jpg'));
  assert.ok(html.includes('16:9 film strip') && html.includes('9:16 film strip: not rendered'), 'a missing image is said, not linked');
  assert.ok(html.includes('pose-tier') && html.includes('kitchen-demo'));
  assert.ok(!html.includes('<script>') && !html.includes('x<b>') && html.includes('x&lt;b&gt;'), 'escaped');
  assert.ok(html.includes('commit it with the story'));
  assert.ok(!/src="https?:|href="https?:|<script|@import/.test(html), 'one file, no network, no script');
});

test('story-bake --gl: validated before any bake; BAKE_GL is honoured; the mode is the cut renderer\'s', () => {
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'story-bake.mts'), 'no-such-family', '--stills', os.tmpdir(), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const a = run(['--gl', 'vulkan']); assert.equal(a.status, 2); assert.match(a.stderr, /--gl \(or BAKE_GL\) must be one of default, software, got vulkan/);
  const b = run([], { BAKE_GL: 'metal' }); assert.equal(b.status, 2); assert.match(b.stderr, /got metal/);
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'story-bake.mts'), 'utf8');
  assert.match(src, /import \{ glArgs, glMode, chromiumFor/); assert.ok(!/use-angle=vulkan/.test(src));
});
