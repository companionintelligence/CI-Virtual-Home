#!/usr/bin/env -S node --experimental-strip-types
// Tests for the story bake (assets/story/{roles,anchors,poses,route,track,place,runtime}.ts, scripts/story-bake.mts): pure Node, no GPU.
//   * the role table is the contract (ROLE_IDS), every role resolves in the houses casting.json says have it, the universal ones in all 30
//   * the pose solver gives the exemplar's beats a clear sight line, the whole anchor in frame, a free cell to stand on, the same answer twice
//   * routes go through stairs and doors and fail (a cut) rather than cross a wall; the popup placer never covers the subject
//   * the track is a pure function of (t, aspect): random access, continuous, no faster than the caps, the beats tile the tour
//   * a lock goes stale when a spec byte, the roles, the beats or the voice change; a bake is byte-stable; the runtime join leaks no house id
// Needs `pnpm run build`, the contract files (assets/story/types.ts, content/story/casting.json) and the exemplar story.
// The algorithms (couch order, poses, the track, the lock) are tested on a FROZEN house, test/fixtures/stories/bake-world/houses/aurora (the layout
// the exemplar's beats were written for), so a re-lay of a shipped home cannot fail them; the data contract (every role resolves in the real homes) is tested
// on content/houses.
// @check-house node-test
// @check-house quick
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROLE_IDS, ROOM_ROLES } from '../assets/story/types.js';
import type { Story, RoleId, VoiceLock } from '../assets/story/types.js';
import { rolesSha, roomKinds, roomHasRole, canon, type RolesTable } from '../assets/story/roles.js';
import { createAnchorWorld, instancesOf, resolveAnchor, resolveChain, roleCounts, siteZonesFromSpec } from '../assets/story/anchors.js';
import { createPoseCtx, solvePose, checkPose, composeTarget, composeAt } from '../assets/story/poses.js';
import { routeBetween, failed } from '../assets/story/route.js';
import { trackFrameAt, beatRestFrame, roofChannel, powerOf, type StoryTrack } from '../assets/story/track.js';
import { placePopup, placeEndCard, focusRect, inter, type Rect } from '../assets/story/place.js';
import { joinRuntime, inputShas, staleReasons, beatAudioSeconds, estimateMs, popupReadSeconds, wordsIn, beatIndexAt } from '../assets/story/runtime.js';
import { camera, projectBox } from '../assets/shot-probe.js';
import { bakeFamily, formatLock, type Baked } from './story-bake.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const table: RolesTable = readJson('content/story/roles.json');
const casting = readJson('content/story/casting.json');
const exemplar: Story = readJson('test/fixtures/stories/exemplar.json');
const FROZEN = 'test/fixtures/stories/bake-world/houses';
const house = (id: string, dir = 'content/houses') => {
  const specText = fs.readFileSync(path.join(ROOT, dir, `${id}.json`), 'utf8');
  const world = readJson(`${dir}/${id}.plan.json`).shots.world;
  return { specText, spec: JSON.parse(specText), world, aw: createAnchorWorld(world, JSON.parse(specText), table) };
};

// ---- roles ---------------------------------------------------------------------------------------------------------------------------
test('roles.json names every role of the contract and nothing else', () => {
  const names = [...Object.keys(table.builtin), ...Object.keys(table.items), ...Object.keys(table.zones)];
  assert.deepEqual([...names].sort(), [...ROLE_IDS].sort(), 'the role NAMES are a contract (ROLE_IDS)');
  for (const u of table.universal) assert.ok((ROLE_IDS as readonly string[]).includes(u), `universal role ${u}`);
  for (const k of Object.keys(table.home || {})) assert.ok(k in table.items, `home preference for ${k} is an item role`);
  assert.deepEqual(Object.keys(table.rooms).sort(), [...ROOM_ROLES].sort(), 'rooms are the RoomRole list');
  for (const [role, def] of Object.entries(table.rooms)) for (const z of def.zones || []) assert.ok(z in table.zones, `${role} names zone ${z}`);
});

test('room kinds are read off names the way casting.json reads them', () => {
  let same = 0, total = 0; const off: string[] = [];
  for (const f of casting.families) for (const r of f.rooms) {
    total++;
    const mine = roomKinds(r.name, table).filter(k => k !== 'lounge' && k !== 'play' && k !== 'workshop'), theirs = (r.kinds as string[]).filter(k => k !== 'lounge' && k !== 'play' && k !== 'workshop' && k !== 'other');
    if (mine.join() === theirs.join()) same++; else off.push(`${r.name}: ${mine} vs ${theirs}`);
  }
  assert.ok(same / total >= 0.93, `rooms read the same as casting.json: ${same}/${total}\n${off.slice(0, 20).join('\n')}`);
  assert.ok(roomHasRole('Primary Ensuite', 'bath', table) && !roomHasRole('Primary Ensuite', 'bedroom', table));
  assert.ok(roomHasRole('Kids Bedroom', 'kids', table) && roomHasRole('Kids Bedroom', 'bedroom', table));
});

const ITEM_AND_ZONE_ROLES = [...Object.keys(table.items), ...Object.keys(table.zones)] as RoleId[];
test('every role casting.json says a house has resolves there; the universal roles resolve in all 30 houses', () => {
  assert.equal(casting.families.length, 30);
  const missing: string[] = [], extra: string[] = [];
  for (const f of casting.families) {
    const { aw } = house(f.house), counts = roleCounts(aw, ITEM_AND_ZONE_ROLES);
    for (const r of ITEM_AND_ZONE_ROLES) {
      const c = f.roles[r]; if (c === undefined) continue;
      if (c > 0 && counts[r] === 0) missing.push(`${f.house}:${r}`);
      if (c === 0 && counts[r] > 0) extra.push(`${f.house}:${r}`);
    }
    for (const u of table.universal) {
      const ref = { role: u as RoleId, ...(u === 'room' ? { room: 'living' as const } : {}) };
      assert.ok(resolveAnchor(aw, ref), `${f.house}: universal role ${u} does not resolve`);
    }
  }
  assert.deepEqual(missing, [], 'roles casting.json counts that the resolver cannot find');
  // (the resolver finds more than casting counted: lot items (loungers, a monkey bars) answer patio-seat and toys, a "Terrace" room answers deck)
  assert.ok(extra.length <= 8, `unexpected extras: ${extra}`);
});

test('instances come in a stable order; nth and room narrow them; a fallback answers when the role is missing', () => {
  const { aw } = house('aurora', FROZEN);
  const a = instancesOf(aw, { role: 'couch' }), b = instancesOf(aw, { role: 'couch' });
  assert.deepEqual(a.map(i => [i.type, i.box, i.roomName]), b.map(i => [i.type, i.box, i.roomName]));
  assert.equal(a[0].roomName, 'Living', 'the living room\'s couch first');
  assert.equal(resolveAnchor(aw, { role: 'couch', nth: 1 })!.nth, 1);
  assert.ok(!resolveAnchor(aw, { role: 'couch', nth: 99 }), 'no 100th couch');
  assert.ok(instancesOf(aw, { role: 'couch', room: 'bedroom' }).every(i => /bed|suite/i.test(i.roomName || '')), 'room narrows');
  const miss = resolveAnchor(aw, { role: 'crib', fallback: [{ role: 'bed' }, { role: 'core' }] })!;
  assert.ok(miss.viaFallback >= 1 && miss.leaf.role !== 'crib');
  assert.equal(resolveAnchor(aw, { role: 'crib' }), null, 'no crib, no fallback: the beat has lost its anchor');
  // a piece's box is the whole piece, not a mesh of it
  const sofa = a[0]; assert.ok(sofa.box[3] - sofa.box[0] > 1.5 && sofa.fwd, 'a loveseat is wide and faces somewhere');
  // the lot's flat zones come from the spec
  assert.ok(siteZonesFromSpec(aw ? house('aurora', FROZEN).spec : null).some(z => z.type === 'pool'));
  assert.ok(resolveChain(aw, { role: 'garden' }).length >= 2 && resolveChain(aw, { role: 'garden' }).length <= 8);
});

// ---- poses ---------------------------------------------------------------------------------------------------------------------------------
let ex: ReturnType<typeof house>, ctx: ReturnType<typeof createPoseCtx>;
before(() => { ex = house('aurora', FROZEN); ctx = createPoseCtx(ex.world); });

test('the pose solver frames every beat of the exemplar: a free cell, a clear sight line, the whole anchor in frame', () => {
  const taken: any[] = []; const problems: string[] = [];
  for (const b of exemplar.beats) {
    const chain = resolveChain(ex.aw, b.anchor); let r = null, s = null;
    for (const c of chain) { s = solvePose(ctx, c, { hint: b.camera, avoid: taken }); if (s) { r = c; break; } }
    if (!s || !r) { problems.push(`${b.id}: no pose`); continue; }
    taken.push({ eye: s.pose.eye, yaw: Math.atan2(s.pose.target[0] - s.pose.eye[0], s.pose.target[2] - s.pose.eye[2]), level: s.pose.level });
    const chk = checkPose(ctx, s, r);
    if (chk.vis < 7 / 9 - 1e-6) problems.push(`${b.id}: sight line ${chk.vis.toFixed(2)}`);
    if (r.role !== 'room' && !chk.rows[0].inside) problems.push(`${b.id}: the anchor is not whole in the 16:9 frame`);
    // the eye stands on a free cell with room around it (indoors; an aerial eye is in the air)
    if (!s.aerial) {
      const g = s.pose.level ? ctx.nav.grid(ctx.nav.levelOf(s.pose.level)) : null;
      if (g) { const [i, j] = ctx.nav.cellOf(g, s.pose.eye[0], s.pose.eye[2]), c = j * g.W + i; if (!g.free[c] || g.dW[c] < 0.2) problems.push(`${b.id}: the eye is on a cell with ${g.dW[c].toFixed(2)} m of wall`); }
    }
    assert.ok(s.pose.fov >= 30 && s.pose.fov <= 100, `${b.id} lens ${s.pose.fov}`);
  }
  assert.deepEqual(problems, []);
});

test('the compose table puts the anchor where it says, on a third of a wide frame and above the sheet of a phone', () => {
  const r = resolveAnchor(ex.aw, { role: 'tv', fallback: [{ role: 'couch' }] })!, s = solvePose(ctx, r, { hint: { framing: 'medium', side: 'left' } })!;
  assert.ok(s, 'a pose');
  for (const row of s.compose) {
    const cam = camera(s.pose.eye, composeTarget(s.pose.eye, s.focus, row.nx, row.ny, row.fov, row.a), row.fov, row.a);
    const pb = projectBox(cam, [s.focus[0] - 0.01, s.focus[1] - 0.01, s.focus[2] - 0.01, s.focus[0] + 0.01, s.focus[1] + 0.01, s.focus[2] + 0.01])!;
    // (a yaw and a pitch offset are not exactly an NDC offset on a pitched camera: within 0.06 is a placement a viewer cannot tell)
    assert.ok(Math.abs((pb.minX + pb.maxX) / 2 - row.nx) < 0.06 && Math.abs((pb.minY + pb.maxY) / 2 - row.ny) < 0.06, `aspect ${row.a}: aim lands at (${row.nx}, ${row.ny}), not (${((pb.minX + pb.maxX) / 2).toFixed(2)}, ${((pb.minY + pb.maxY) / 2).toFixed(2)})`);
  }
  assert.ok(s.compose[0].nx < 0, 'side left: the anchor sits on the left third');
  assert.ok(composeAt(s.compose, 0.46).ny > 0.2, 'a phone frame puts the anchor above the sheet');
  assert.ok(Math.abs(composeAt(s.compose, 1.2).nx) < Math.abs(composeAt(s.compose, 1.78).nx) + 1e-9, 'between the rows it interpolates');
});

test('the same inputs give the same pose', () => {
  const r = resolveAnchor(ex.aw, { role: 'range', fallback: [{ role: 'counter' }] })!;
  const a = solvePose(ctx, r, { hint: { framing: 'close' } }), b = solvePose(createPoseCtx(ex.world), r, { hint: { framing: 'close' } });
  assert.deepEqual(a!.pose, b!.pose);
});

test('an outdoor anchor the ground cannot frame is retried from the air (asymmetry\'s loungers)', () => {
  const h = house('asymmetry'), c = createPoseCtx(h.world), r = resolveAnchor(h.aw, { role: 'patio-seat' })!;
  const s = solvePose(c, r, {}); assert.ok(s, 'a pose for the loungers');
  const g = house('mirage'), cg = createPoseCtx(g.world);
  for (const ref of [{ role: 'garden' as const }, { role: 'driveway' as const, fallback: [{ role: 'front-door' as const }] }, { role: 'street' as const }]) {
    const rr = resolveChain(g.aw, ref).map(x => solvePose(cg, x, {})).find(Boolean); assert.ok(rr, `mirage ${ref.role}`);
  }
});

// ---- routes ---------------------------------------------------------------------------------------------------------------------------------
test('a route climbs the stairs between storeys, goes out through the entry, and fails rather than cross a wall', () => {
  const kitchen = resolveAnchor(ex.aw, { role: 'counter' })!, study = resolveAnchor(ex.aw, { role: 'desk', room: 'office' })!;
  const a = solvePose(ctx, kitchen, {})!, b = solvePose(ctx, study, {})!;
  const up = routeBetween(ctx, { eye: a.pose.eye, level: a.pose.level }, { eye: b.pose.eye, level: b.pose.level });
  assert.ok(!failed(up), failed(up) ? up.reason : '');
  if (!failed(up)) {
    assert.ok(up.mode.includes('stair') && up.pts[up.pts.length - 1][1] > up.pts[0][1] + 2, 'it climbs');
    assert.deepEqual(up.pts[0], a.pose.eye); assert.deepEqual(up.pts[up.pts.length - 1], b.pose.eye);
    for (let i = 1; i < up.pts.length; i++) assert.ok(Math.hypot(...up.pts[i].map((v, k) => v - up.pts[i - 1][k]) as [number, number, number]) < 6, 'no vertex leaps');
  }
  const garden = solvePose(ctx, resolveAnchor(ex.aw, { role: 'garden' })!, {})!;
  const out = routeBetween(ctx, { eye: a.pose.eye, level: a.pose.level }, { eye: garden.pose.eye, level: null });
  assert.ok(!failed(out) || /walkable|entry|route is/.test(out.reason), 'out through the door, or a stated reason');
  // the entry of asymmetry is up an exterior stair: no walk, a cut
  const h = house('asymmetry'), c = createPoseCtx(h.world), core = solvePose(c, resolveAnchor(h.aw, { role: 'core' })!, {})!, street = solvePose(c, resolveAnchor(h.aw, { role: 'street' })!, {})!;
  const cut = routeBetween(c, { eye: street.pose.eye, level: null }, { eye: core.pose.eye, level: core.pose.level });
  assert.ok(failed(cut), 'no straight line through the wall');
});

// ---- placement --------------------------------------------------------------------------------------------------------------------------------
test('a popup never covers the focus subject, the Core or the bars', () => {
  const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
  const bars = [R(0, 0, 1440, 56), R(0, 820, 1440, 80)], card = { w: 380, h: 190 };
  const fixtures: Array<{ name: string; focus: Rect | null; core?: Rect | null }> = [
    { name: 'centre', focus: R(560, 300, 320, 260) }, { name: 'left third', focus: R(160, 280, 300, 300) }, { name: 'right third', focus: R(980, 300, 300, 260) },
    { name: 'large', focus: R(220, 140, 760, 560) }, { name: 'tiny', focus: R(700, 400, 40, 40) }, { name: 'at the top edge', focus: R(600, 0, 240, 200) },
    { name: 'bottom right', focus: R(1100, 600, 330, 200) }, { name: 'with the Core', focus: R(300, 300, 400, 300), core: R(900, 380, 120, 100) }, { name: 'Core over the subject', focus: R(500, 300, 400, 300), core: R(560, 360, 120, 90) },
    { name: 'out of frame', focus: null },
  ];
  for (const f of fixtures) {
    const p = placePopup({ vw: 1440, vh: 900, focus: f.focus, core: f.core, bars, card });
    assert.equal(p.mode, 'card');
    if (f.focus) assert.ok(inter(p.rect, f.focus) / (f.focus.w * f.focus.h) < 0.02, `${f.name}: overlaps the subject ${(p.overlapFocus * 100).toFixed(1)}%`);
    if (f.core) assert.ok(inter(p.rect, f.core) / (f.core.w * f.core.h) < 0.02, `${f.name}: covers the Core`);
    for (const b of bars) assert.equal(inter(p.rect, b), 0, `${f.name}: touches a bar`);
    assert.ok(p.rect.x >= 0 && p.rect.y >= 0 && p.rect.x + p.rect.w <= 1440 && p.rect.y + p.rect.h <= 900, `${f.name}: inside the viewport`);
    assert.ok(p.ok, `${f.name}: ok`);
    if (f.focus && p.leader) assert.ok(Math.hypot(p.leader.to[0] - (f.focus.x + f.focus.w / 2), p.leader.to[1] - (f.focus.y + f.focus.h / 2)) < Math.hypot(f.focus.w, f.focus.h), 'the leader ends on the subject');
  }
  // a subject that fills the frame cannot be cleared by any card: the placer takes the corner that covers least and says it is not ok
  const huge = placePopup({ vw: 1440, vh: 900, focus: R(100, 70, 1240, 740), bars, card });
  assert.ok(!huge.ok && huge.overlapFocus < 0.12, `huge: ${(huge.overlapFocus * 100).toFixed(1)}%`);
  // the card prefers the side the anchor is not on
  const mid = (r: Rect) => r.x + r.w / 2;
  assert.ok(mid(placePopup({ vw: 1440, vh: 900, focus: R(160, 300, 300, 260), bars, card }).rect) > 310, 'anchor left, card right of it');
  assert.ok(mid(placePopup({ vw: 1440, vh: 900, focus: R(1000, 300, 300, 260), bars, card }).rect) < 1150, 'anchor right, card left of it');
  // the same rects give the same slot
  assert.deepEqual(placePopup({ vw: 1440, vh: 900, focus: R(560, 300, 320, 260), bars, card }), placePopup({ vw: 1440, vh: 900, focus: R(560, 300, 320, 260), bars, card }));
});

test('on a phone the card is a bottom sheet of at most 38% of the height, above the dock', () => {
  const p = placePopup({ vw: 390, vh: 844, focus: { x: 90, y: 150, w: 210, h: 220 }, bars: [{ x: 0, y: 0, w: 390, h: 56 }, { x: 0, y: 764, w: 390, h: 80 }], card: { w: 380, h: 420 } });
  assert.equal(p.mode, 'sheet'); assert.equal(p.slot, 'sheet');
  assert.ok(p.rect.h <= 844 * 0.38 + 1e-6 && p.rect.y + p.rect.h <= 764, `${JSON.stringify(p.rect)}`);
  assert.ok(p.ok, 'the camera put the anchor above the sheet');
  const e = placeEndCard({ vw: 1440, vh: 900, card: { w: 520, h: 300 }, core: { x: 560, y: 350, w: 320, h: 200 } });
  assert.ok(e.ok && e.overlapCore < 0.05, 'the end card clears the Core');
});

test('focusRect projects a box into pixels', () => {
  const r = focusRect([0, 1.5, 0], [0, 1.5, 5], 54, [-0.5, 1, 4.5, 0.5, 2, 5.5], 1440, 900)!;
  assert.ok(r && Math.abs(r.x + r.w / 2 - 720) < 1 && r.w > 50 && r.h > 50);
  assert.equal(focusRect([0, 1.5, 0], [0, 1.5, 5], 54, [-0.5, 1, -5.5, 0.5, 2, -4.5], 1440, 900), null, 'behind the eye');
});

// ---- the track, the lock, the join ---------------------------------------------------------------------------------------------------------------------
let baked: Baked, track: StoryTrack;
const bakeOnce = async () => baked ||= await bakeFamily(exemplar.slug, { story: exemplar, voice: null, housesDir: path.join(ROOT, FROZEN) });

test('the exemplar bakes: no beat loses its anchor, the beats tile the tour, no beat is shorter than its voice and its reading', async () => {
  baked = await bakeOnce(); track = baked.lock.track as StoryTrack;
  assert.deepEqual(baked.problems, []);
  const tl = baked.lock.timeline;
  assert.equal(tl.beats.length, exemplar.beats.length);
  let prev = 0;
  tl.beats.forEach((b, i) => {
    assert.equal(b.id, exemplar.beats[i].id);
    assert.ok(Math.abs(b.t0 - prev) < 1e-6, `${b.id} starts where the last one ended`); prev = b.t1;
    const eb = exemplar.beats[i], a = beatAudioSeconds(exemplar, eb, null);
    assert.ok(b.t1 - b.t0 >= Math.max(a.audioS + 0.6, popupReadSeconds(eb), eb.minSeconds || 0) - 0.01, `${b.id}: ${(b.t1 - b.t0).toFixed(1)} s is shorter than its voice and reading`);
    if (b.travel) assert.ok(b.travel[0] >= b.t0 - 1e-6 && b.travel[1] <= b.t1 - 1.19, `${b.id}: the walk leaves 1.2 s at rest`);
  });
  assert.ok(Math.abs(tl.duration - prev) < 1e-6 && Math.abs(track.duration - prev) < 1e-3);
  assert.equal(baked.lock.durations, 'estimated');
  assert.ok(tl.filmBeats.length === exemplar.beats.filter(b => b.film).length && tl.filmDuration > 20);
  // segments are contiguous
  track.segs.forEach((s, i) => { if (i) assert.ok(Math.abs(s.t0 - track.segs[i - 1].t1) < 1e-6, `segment ${i} starts where ${i - 1} ended`); });
  assert.equal(track.segs[0].t0, 0);
  // the estimate is 150 words a minute
  assert.equal(estimateMs('one two three four five six seven eight nine ten'), 4000);
});

test('trackFrameAt is a pure function of (t, aspect): the same for the same t, whatever was asked before', async () => {
  baked = await bakeOnce(); track = baked.lock.track as StoryTrack;
  const ts: number[] = []; let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 300; i++) ts.push(rnd() * track.duration);
  const first = ts.map(t => JSON.stringify(trackFrameAt(track, t, 16 / 9)));
  const shuffled = ts.map((t, i) => [t, i] as const).sort((a, b) => ((a[1] * 7919) % 31) - ((b[1] * 7919) % 31));
  for (const [t, i] of shuffled) assert.equal(JSON.stringify(trackFrameAt(track, t, 16 / 9)), first[i], `t=${t}`);
  // each aspect too, and the end points
  for (const a of [16 / 9, 1, 0.46]) { const f0 = trackFrameAt(track, 0, a), f1 = trackFrameAt(track, track.duration, a); assert.ok(f0.eye.every(Number.isFinite) && f1.target.every(Number.isFinite)); assert.deepEqual(trackFrameAt(track, 50, a), trackFrameAt(track, 50, a)); }
  assert.deepEqual(trackFrameAt(track, -5), trackFrameAt(track, 0)); assert.deepEqual(trackFrameAt(track, track.duration + 9), trackFrameAt(track, track.duration));
});

test('the camera is continuous and slow enough to follow: no jump but a cut, an eye under 3 m/s, a look under 70 degrees a second at any aspect', async () => {
  baked = await bakeOnce(); track = baked.lock.track as StoryTrack;
  const dt = 1 / 30, cuts = new Set(track.events.cuts.map(c => Math.round(c / dt)));
  for (const a of [16 / 9, 1, 0.46]) {
    let prev = trackFrameAt(track, 0, a), worstEye = 0, worstYaw = 0, worstPitch = 0, at = 0, worstFtue = 0;
    for (let i = 1; i * dt <= track.duration; i++) {
      const f = trackFrameAt(track, i * dt, a);
      const speed = Math.hypot(f.eye[0] - prev.eye[0], f.eye[1] - prev.eye[1], f.eye[2] - prev.eye[2]) / dt;
      const y0 = Math.atan2(prev.target[0] - prev.eye[0], prev.target[2] - prev.eye[2]), y1 = Math.atan2(f.target[0] - f.eye[0], f.target[2] - f.eye[2]);
      const p0 = Math.atan2(prev.target[1] - prev.eye[1], Math.hypot(prev.target[0] - prev.eye[0], prev.target[2] - prev.eye[2])), p1 = Math.atan2(f.target[1] - f.eye[1], Math.hypot(f.target[0] - f.eye[0], f.target[2] - f.eye[2]));
      const yaw = Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0))) * 180 / Math.PI / dt, pitch = Math.abs(p1 - p0) * 180 / Math.PI / dt;
      if (f.seg === 0 && track.segs[0].k === 'ftue') worstFtue = Math.max(worstFtue, speed);   // (the planner's establishing move is allowed 5 m/s)
      else if (!cuts.has(i) && !cuts.has(i - 1)) worstEye = Math.max(worstEye, speed);
      if (!cuts.has(i) && !cuts.has(i - 1)) { if (yaw > worstYaw) { worstYaw = yaw; at = i * dt; } worstPitch = Math.max(worstPitch, pitch); }
      prev = f;
    }
    assert.ok(worstEye < 3.2 && worstFtue < 5.2, `aspect ${a.toFixed(2)}: eye ${worstEye.toFixed(2)} m/s (first run ${worstFtue.toFixed(2)})`);
    assert.ok(worstYaw < 90, `aspect ${a.toFixed(2)}: look ${worstYaw.toFixed(0)} deg/s at t=${at.toFixed(1)}`);
    assert.ok(worstPitch < 90, `aspect ${a.toFixed(2)}: pitch ${worstPitch.toFixed(0)} deg/s`);
  }
});

test('a walk whose heading turns through more than half a circle (a flight of stairs) never flips the look while the old view is still fading', async () => {
  baked = await bakeOnce(); const t0: StoryTrack = structuredClone(baked.lock.track as StoryTrack);
  const idx = t0.segs.findIndex((x: any, i: number) => x.k === 'move' && i > 0 && i + 1 < t0.segs.length);
  const mv: any = t0.segs[idx];
  // the same walk, with a heading that sweeps 300 degrees inside the first fifth of it: with a branch chosen at the start of the walk the blend
  // flipped when the sweep passed 180 degrees, and the look jumped by (weight on the old view) x 360 degrees in one frame
  const pos: number[] = [], look: number[] = [];
  for (let i = 0; i < mv.n; i++) {
    const f = i / (mv.n - 1), th = (Math.min(1, f / 0.2) * 300 * Math.PI) / 180;
    const p = [mv.pos[0] + (mv.pos[3 * (mv.n - 1)] - mv.pos[0]) * f, mv.pos[1], mv.pos[2] + (mv.pos[3 * (mv.n - 1) + 2] - mv.pos[2]) * f];
    pos.push(...p); look.push(p[0] + Math.sin(th) * 3, p[1], p[2] + Math.cos(th) * 3);
  }
  mv.pos = pos; mv.look = look;
  const dt = 1 / 30; let prev = trackFrameAt(t0, mv.t0, 16 / 9), worst = 0;
  for (let t = mv.t0 + dt; t <= mv.t1; t += dt) {
    const f = trackFrameAt(t0, t, 16 / 9);
    const y0 = Math.atan2(prev.target[0] - prev.eye[0], prev.target[2] - prev.eye[2]), y1 = Math.atan2(f.target[0] - f.eye[0], f.target[2] - f.eye[2]);
    worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0))) * 180 / Math.PI); prev = f;
  }
  // the sweep itself is 300 degrees in a fifth of the walk (at least 1.5 s: under 6 degrees a frame); a flip is far more than that in one
  assert.ok(worst < 12, `the look moved ${worst.toFixed(0)} degrees in one frame`);
});

test('at rest every beat shows its anchor whole, at 16:9, and the preset helpers read the track', async () => {
  baked = await bakeOnce(); track = baked.lock.track as StoryTrack;
  const bad: string[] = [];
  for (const b of exemplar.beats) {
    const bf = track.beats[b.id]; if (!bf || bf.role === 'room') continue;
    const f = beatRestFrame(track, b.id, 16 / 9)!, pb = projectBox(camera(f.eye, f.target, f.fov, 16 / 9), bf.box);
    // (the drift is a few centimetres: the box stays inside, with a little more than the solver's 0.9)
    if (!pb || pb.minX < -0.97 || pb.maxX > 0.97 || pb.minY < -0.97 || pb.maxY > 0.97) { if (bf.role !== 'front-door' && !/ftue/.test(b.id)) bad.push(`${b.id} ${JSON.stringify(pb)}`); }
  }
  assert.deepEqual(bad, []);
  const roof = roofChannel(track, 10); assert.equal(roof.samples, Math.round(track.duration * 10) + 1);
  assert.ok(roof.roofAlpha[0] > 0.9, 'the tour opens outside, under the roof'); assert.ok(Array.from(roof.roofAlpha).some(v => v < 0.1), 'and goes under it');
  const pw = powerOf(track); assert.ok(pw.at > 0 && pw.at < 0.2, 'the Core wakes during the first-run chapter');
  const plug = baked.lock.timeline.beats.find(b => b.id === 'ftue-plug-in')!;
  assert.ok(track.events.press! >= plug.t0 && track.events.press! <= plug.t1, 'the press is inside the plug-in beat');
});

test('a lock is stale when a spec byte, the roles, the beats or the voice change, and fresh otherwise', async () => {
  baked = await bakeOnce();
  const real = false, now = () => inputShas({ specText: ex.specText, world: ex.world, table, story: exemplar, voice: null, real });
  const fresh = await now();
  assert.deepEqual(staleReasons(baked.lock, fresh, real), [], 'fresh');
  assert.ok(staleReasons(baked.lock, await inputShas({ specText: ex.specText + ' ', world: ex.world, table, story: exemplar, voice: null, real }), real).join().includes('HouseSpec'), 'one spec byte');
  assert.ok(staleReasons(baked.lock, await inputShas({ specText: ex.specText, world: { ...ex.world, lot: { w: 99, d: 9 } }, table, story: exemplar, voice: null, real }), real).join().includes('world'), 'the world digest');
  assert.ok(staleReasons(baked.lock, await inputShas({ specText: ex.specText, world: ex.world, table: { ...table, home: { ...table.home, couch: ['bedroom'] } }, story: exemplar, voice: null, real }), real).join().includes('roles'), 'roles.json');
  const moved: Story = { ...exemplar, beats: exemplar.beats.map((b, i) => i === 7 ? { ...b, anchor: { role: 'bed' as const } } : b) };
  assert.ok(staleReasons(baked.lock, await inputShas({ specText: ex.specText, world: ex.world, table, story: moved, voice: null, real }), real).join().includes('beats'), 'an anchor');
  const edited: Story = { ...exemplar, beats: exemplar.beats.map((b, i) => i === 7 ? { ...b, popup: { ...b.popup, body: b.popup.body + ' And more words here.' } } : b) };
  assert.ok(staleReasons(baked.lock, await inputShas({ specText: ex.specText, world: ex.world, table, story: edited, voice: null, real }), real).length > 0, 'a longer body changes the estimated length');
  assert.deepEqual(staleReasons(baked.lock, await inputShas({ specText: ex.specText, world: ex.world, table, story: { ...exemplar, beats: exemplar.beats.map((b, i) => i === 7 ? { ...b, popup: { ...b.popup, title: b.popup.title } } : b) }, voice: null, real }), real), [], 'the same words are fresh');
  assert.ok(staleReasons(baked.lock, fresh, true).join().includes('voice'), 'estimated durations are stale once the voice covers every clip');
  assert.ok((await rolesSha(table)) !== (await rolesSha({ ...table, universal: [] })));
  assert.equal(canon({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test('a bake is byte-stable and the runtime join leaks no house id', async () => {
  baked = await bakeOnce();
  const again = await bakeFamily(exemplar.slug, { story: exemplar, voice: null, housesDir: path.join(ROOT, FROZEN) });
  assert.equal(formatLock(again.lock), formatLock(baked.lock), 're-baking an unchanged tree writes the same bytes');
  const rs = joinRuntime(exemplar, null, baked.lock);
  const text = JSON.stringify(rs);
  assert.ok(!text.includes(exemplar.house) && !('house' in rs) && !('notes' in rs), 'no internal house id in the public join');
  assert.ok(rs.beats.every(b => !('anchor' in b) && !('camera' in b) && !('capability' in b)));
  assert.equal(rs.beats.length, exemplar.beats.length); assert.equal(rs.chapters.length, exemplar.chapters.length);
  assert.ok(rs.chapters.every(c => c.beats > 0 && c.t1 > c.t0));
  rs.beats.forEach((b, i) => { assert.ok(b.speechAt >= b.t0 && b.popupAt >= b.t0 && b.popupAt < b.t1, b.id); if (i) assert.ok(b.t0 >= rs.beats[i - 1].t1 - 1e-6); });
  assert.equal(beatIndexAt(rs.beats, rs.beats[5].t0 + 0.1), 5); assert.equal(beatIndexAt(rs.beats, -1), 0);
  assert.equal(rs.durations, 'estimated'); assert.deepEqual(rs.audio, {});
  // a stale lock does not join
  assert.throws(() => joinRuntime({ ...exemplar, beats: exemplar.beats.slice(1) }, null, baked.lock), /not the story's/);
  // with a voice lock the durations are the voice's
  const clip = (text: string, ms: number) => ({ text, textSha: 'x', voice: 'v-warm-f' as const, kokoro: 'bf_emma', speed: 1, file: 'audio/x.0123456789.m4a', sha256: 'y', bytes: 1, durationMs: ms, trimmedLeadMs: 80, words: [], loudness: { I: -16, TP: -2 } });
  const voice = { v: 1, slug: exemplar.slug, storySha: '', lexiconSha: '', engine: { name: 'kokoro', encoder: '', normalise: '' }, clips: Object.fromEntries(exemplar.beats.map(b => [b.id, clip(b.popup.body, 3000)])) } as unknown as VoiceLock;
  assert.equal(beatAudioSeconds(exemplar, exemplar.beats[0], voice).narrationS, 3);
});

test('the words of an estimate and a popup are counted the way the validator counts them', () => {
  assert.equal(wordsIn('a  b\nc'), 3);
  assert.ok(popupReadSeconds(exemplar.beats[0]) > 3);
});
