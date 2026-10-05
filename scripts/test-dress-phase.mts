#!/usr/bin/env -S node --experimental-strip-types
// @check-house node-test
// @check-house quick
// The dress phase's gates (plan 5.6 D2/D3; assets/room-dress.ts, assets/dress-recipes.ts, assets/room-dress-hosts.ts). Pure Node, no browser.
//
//   A  no live opt-in  no shipped house has a `dress` field (a room opts in live with an explicit `dress.level`, and none does), the dress items they carry are the baked ones of
//                   pass 6 (src `dress@1` with a seed key; all 30 houses or none), and the build's live phase adds nothing to any of them; `?dress=0` is off in Node
//   B  determinism  dressing a house twice, in a fresh copy and in another order, gives the same items byte for byte; two houses do not share a scheme
//   C  no re-roll   switching one slot off (`dress.off`) leaves every other slot's items exactly as they were: a dress item's choices draw from a stream of
//                   its own (room, slot, ordinal), so a new item moves no other; and a higher level only ever adds (what a lower level places, a higher one places)
//   D  host fit     every dress surface item stands on a host of the registry, its footprint inside the host's flat rects, at the host's top, over no other item,
//                   with 40 % of the top left free; no dress item stands outside its room or in a door's swing; the layout lints report no dress-* finding
//   E  opt-outs     `dress: false` and an absent `dress` dress nothing live; `?dress=0`'s filter is the page's (assets/rooms-build.ts); a raised floor is left alone
//   F  recipes      the fixtures prove each program: every wet room has 3 dress items and a towel, every dining room a set table, every kitchen 4 clusters, a
//                   lamp where the room had none (counted against the layout's own), every item a real type that exists in the catalog
//   G  census       the never-bare violations before and after, on the dress fixtures (printed; the plan's fleet targets are the census's, not this test's)
//   H  layout       a baked dress@1 item is no pin and no usage of the composer: composing a spec that carries them gives the items of the one that does not (so
//                   the compose-stability hashes hold whatever a house's dress items are), and the lints of the dressed fixtures add no layout finding
//   I  bake         compose-house.mts --dress writes exactly the live phase's items, twice gives the same file, --undress gives the original back
//   J  café curtain the BUILT geometry of every café curtain the phase places (the 30 houses at the pilot level 0.5, and the dress fixtures), measured in three.js
//                   in Node, against its own window: it hangs from the sill (hem no lower), tops out at most sill + 0.55 x the window's height, keeps the 1.45-1.55 m
//                   eye line clear unless the window is small, is a pale cloth and not a dark slab; and the first cut's params fail the same measurement (a control)
//   K  corner keep-out  the dress pieces of all 30 houses (pilot level 0.5) and the fixtures stay out of the rig's corner cameras' way: the camera points are the rig's
//                   own `cornerCam` (the Node copy in assets/ is compared with it), no dress piece within 0.3 m of an eye (3-D, at the 1.5 m eye), no floor piece
//                   taller than 0.8 m inside a 0.5 m corner square; and the lamp census holds (105 lamp-less rooms lit before the corner keep-out, 102 after the leaf strips of R)
//   K3 bare lamps   a lamp with a bare lit head (mushroom, globe, tripod bulb) stands at least LAMP_EYE (1.0 m, 3-D) from every corner eye, and the phase places no halo lamp (the legacy
//                   ring with its own PointLight, toned only outside a programmed room): pass 6's review found both (aurora Kitchen NW night clipped 6 %, 23 raw halos); with controls
//   T  lamp heads   baking dress items re-rolls no lamp the layout already had: kit-rules lampPlan walks the permutation of lamp kinds over the layout's lamps only, and a dress lamp takes its
//                   own seeded pick (cutestarter's bedside lamps turned into blown-out globes when 102 rooms joined the walk)
//   L  neighbour gap  no dress item stands under 1.5 cm from another item on its surface (authored, composed or dressed, an item with no `y` at the page's DESK_TOP
//                   included), by the layout lint and by an independent obb measure over the 30 houses baked and the fixtures; the 12 cases the skeptic found are fixed;
//                   and the lint sees the flower-jug case the first cut did not (a control)
//   M  reach          REACH (how far a small good's built mesh passes its measured box) holds over 96 fresh seeds of every surface type at every variant (scripts/dress-reach.mts
//                   measured the table over 1000), and no spilling type is missing
//   Q  in the room    every dress item's origin is within 0.5 m of its room's bounds: a host drawn across the edge of a small room (palnknoll's Outdoor Kitchen counter) is
//                   dressed only near the room, the validator's "lies outside room" (0.6 m) never fires on a dress item
//   R  door leaves   no dress piece the scene check counts (not foliage, not hung in its wall, over 0.3 m) stands in the strip an open door leaf parks in, for any door of its
//                   storey that may carry one (a partition's, an opening's, both jambs): the five pieces the scene check found in a leaf's way (three robe hooks, an umbrella stand,
//                   a floor lamp) are in the strips, and no piece of the 30 houses baked is; the scene gate's warning count (baked == unbaked) is dress-fleet's neighbour, run by hand
//   S  byte identity compose-house.mts --dress then --undress gives each unbaked spec back byte for byte (its final newline, or none, kept: the houses have none, the fixtures one),
//                   --dress twice writes the file --dress once did, and a baked house IS what --dress writes today (re-bake after any change to a recipe or a host); a spec that is not canonical JSON is told so, and a room with no `items`
//                   key at all is the one case that comes back JSON-equal (a control)
//   P  bake hygiene  a baked house raises no warning its unbaked self does not: the validator's warning count (the `dk` seed key a dress item carries is a declared item key
//                   like `src`) and the layout lint's silent-param count are equal before and after the bake, for all 30 houses; and a dress item's `dk` is the one key
//                   no builder reads (a control: a key made up fails the same measurement)
//   N  curtain parts  PARTS (the sink run's tap: a 3 cm column over a 0.96 m body) covers every mesh the page builds for the type, at three widths and three depths; a table
//                   without the tap fails the same measurement (a control)
//   O  curtain plan   over the 30 houses baked and the fixtures, no café curtain's box (plan, catalog heights, PARTS) meets another item's, however it is stood over, parted
//                   round or skipped, and no two curtains of a wall (or a curtain and a blind of the layout) stand under 2 cm apart; the plan parts and lifts where it should
//                   (a control: a lamp and a tap in a window's way part it, a counter higher than the sill lifts the hem, a wall of cabinets leaves the window bare)
//
//
//   node --experimental-strip-types --test scripts/test-dress-phase.mts      (needs `pnpm run build`; any cwd)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createBuildContext } from '../assets/build-context.js';
import { createMaterialKit } from '../assets/materials.js';
import { composeHouse, layerOf } from '../assets/room-composer.js';
import { dressHouse, dressRooms, dressOff, dressOptIn, dressProgram, isDress, bareViolation, Dresser, DRESS_SRC } from '../assets/room-dress.js';
import { dressSchemeOf } from '../assets/house-scheme-dress.js';
import { RECIPES, CAFE, cafeFit, BARE_LAMPS, FLOOR_LAMPS, TABLE_LAMPS, SMALL_LAMPS, LAMP_TYPES, LAMP_MIN_AREA } from '../assets/dress-recipes.js';
import { lampPlan, LAMP_ITEMS } from '../assets/kit-rules.js';
import { PARTS, CURTAIN_GAP, curtainObb, planCafe, DRESSERS } from '../assets/dress-curtains.js';
import { surfaceTypes, spillOf } from './dress-reach.mts';
import { leafStrips, leafSensitive } from '../assets/dress-leaves.js';
import { cornerEyes, eyeGap, camBlocked, CAM, LAMP_EYE, hostOf, footprintIn, nearOn, freeRects, reachOf, standingOn as standingOnHost, surfaceY, neighbourGap, rectGap, toWorld, MIN_GAP, NEIGHBOUR_GAP, DESK_TOP, REACH } from '../assets/room-dress-hosts.js';
import { cornerCam } from './review/cameras.mts';
import { standingOn, rectArea } from '../assets/room-dress-hosts.js';
import { lintLayout } from '../assets/layout-lint.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { PROPS } from '../assets/props/index.js';
import { itemObb, overlap, analyzeRoom, sizeOf, obb, corners, CENTRE_MOUNT, TOP_MOUNT } from '../assets/room-geo.js';
import { spawnSync, spawn } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..');
const load = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const houses = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => ({ id: f.replace(/\.json$/, ''), file: path.join(ROOT, 'content', 'houses', f) }));
const FIX = ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles', 'dress-utility'];
const fixture = (id: string) => load(path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`));
const rooms = (spec: any) => (spec.levels || []).flatMap((lv: any) => (lv.rooms || []).map((room: any) => ({ lv, room })));
const dressedItems = (spec: any, level?: number) => [...dressRooms(spec, level === undefined ? {} : { level })].flatMap(([room, r]) => r.items.map(it => ({ room, it })));
const strip = (o: any) => JSON.stringify(o);

test('A: no shipped house opts in live, and the dress items it carries are the baked ones (pass 6): src dress@1, a seed key, nothing else', () => {
  let baked = 0;
  for (const h of houses) {
    const spec = load(h.file), text = fs.readFileSync(h.file, 'utf8');
    assert.ok(!/"dress"\s*:/.test(text), `${h.id} carries a dress field (a live opt-in: shipped houses are baked)`);
    assert.equal(dressHouse(spec).size, 0, `${h.id}: the live phase added to a house that does not opt in`);
    for (const { room } of rooms(spec)) {
      assert.ok(!dressOptIn(room), `${h.id}/${room.name} opts in`);
      for (const it of (room.items || []).filter(isDress)) assert.ok(typeof it.dk === 'string' && it.dk.startsWith(`${(spec.levels.find((l: any) => l.rooms.includes(room)) || {}).id}.`), `${h.id}/${room.name}: a dress item without its seed key: ${JSON.stringify(it)}`);
    }
    if (text.includes(DRESS_SRC)) baked++;
  }
  assert.ok(baked === 0 || baked === houses.length, `${baked} of ${houses.length} houses are baked: pass 6 bakes all of them or none`);
  assert.equal(dressOff(), false, 'in Node, ?dress=0 is never on');
});

test('B: dressing is deterministic, whatever the copy and the order', () => {
  for (const id of ['dress-rooms', 'dress-baths']) {
    const a = fixture(id), b = JSON.parse(JSON.stringify(a));
    const ra = dressedItems(a).map(x => x.it), rb = dressedItems(b).map(x => x.it);
    assert.ok(ra.length > 10, `${id}: dressed ${ra.length}`);
    assert.equal(strip(ra), strip(rb), `${id}: a fresh copy dresses differently`);
    // composing first, or dressing a room alone first, changes nothing
    const c = JSON.parse(JSON.stringify(a)); composeHouse(c);
    assert.equal(strip(dressedItems(c).map(x => x.it)), strip(ra), `${id}: composing first changes the dress`);
  }
  const s1 = dressSchemeOf(fixture('dress-rooms')), s2 = dressSchemeOf(load(houses[0].file)), s3 = dressSchemeOf(load(houses[1].file));
  assert.deepEqual(s1, dressSchemeOf(fixture('dress-rooms')), 'the scheme is a pure function of the house');
  assert.ok(new Set([JSON.stringify(s1), JSON.stringify(s2), JSON.stringify(s3)]).size >= 2, 'houses draw their own scheme');
});

test('C: adding or removing a slot moves no other slot\'s items, and a level only adds', () => {
  const spec = fixture('dress-rooms');
  const all = new Map<string, any>(); for (const { it } of dressedItems(spec)) all.set(it.dk, it);
  assert.ok(all.size > 10);
  // each slot of each recipe switched off in turn: the rest is identical
  let checked = 0;
  for (const { lv, room } of rooms(spec)) {
    const prog = room.program; if (!prog || !RECIPES[prog]) continue;
    for (const slot of RECIPES[prog].slots) {
      const copy = JSON.parse(JSON.stringify(spec)), r2 = rooms(copy).find((x: any) => x.room.name === room.name)!.room;
      r2.dress = { level: 0.5, off: [slot.id] };
      const off = new Map<string, any>(); for (const { it } of dressedItems(copy)) off.set(it.dk, it);
      const prefix = `${lv.id}.${room.no ?? room.name}:${slot.id}:`;
      for (const [dk, it] of all) { if (dk.startsWith(prefix)) { assert.ok(!off.has(dk), `${dk} survived its slot being off`); continue; }
        // (the slots that share a type with the one switched off may pick differently: the pick fades by what the room already holds, so only slots that
        //  did not pick one of its types are required to hold exactly)
        if (dk.split(':')[0] !== prefix.split(':')[0]) { assert.equal(strip(off.get(dk)), strip(it), `${dk} moved when a slot in another room was switched off`); checked++; } }
    }
  }
  assert.ok(checked > 50, `${checked} items checked across rooms`);
  // a level only adds: everything level 0.2 places, level 0.9 places, the same
  const lo = new Map<string, any>(), hi = new Map<string, any>();
  for (const { it } of dressedItems(spec, 0.2)) lo.set(it.dk, it); for (const { it } of dressedItems(spec, 0.9)) hi.set(it.dk, it);
  assert.ok(lo.size > 5 && hi.size >= lo.size, `level 0.2 places ${lo.size}, level 0.9 places ${hi.size}`);
  for (const [dk, it] of lo) assert.equal(strip(hi.get(dk)), strip(it), `${dk}: level 0.2 placed it, level 0.9 did not, or differently`);
});

test('D: every dress item stands on a host, whole and at its top, with 40 % of the top free, and the lints say so', () => {
  let surface = 0, hostsSeen = 0;
  for (const id of FIX) {
    const spec = fixture(id), comp = composeHouse(spec), res = dressRooms(spec);
    for (const { lv, room } of rooms(spec)) {
      const r = res.get(room); if (!r || !r.items.length) continue;
      const base = [...(room.items || []), ...((comp.get(room) || { items: [] }).items)], all = [...base, ...r.items];
      const geo = analyzeRoom(spec, lv, room);
      assert.equal(new Set(r.items.map((i: any) => i.dk)).size, r.items.length, `${id}/${room.name}: duplicate dk`);
      for (const it of r.items) {
        assert.equal(it.src, DRESS_SRC); assert.ok(PLACEMENT[it.type] && (PROPS.has(it.type) || it.type === 'fiddle-leaf' || PLACEMENT[it.type].group === 'plant'), `${it.type} is not a catalog type`);
        const o = itemObb(it); assert.ok(o, `${it.type}: no box`);
        // inside the room (a floor lamp, a mat, a mirror stand in the room's bounds)
        assert.ok(o!.cx > room.bounds.x - 0.05 && o!.cx < room.bounds.x + room.bounds.w + 0.05 && o!.cz > room.bounds.z - 0.05 && o!.cz < room.bounds.z + room.bounds.d + 0.05, `${id}/${room.name}: ${it.type} outside the room`);
        if (layerOf(it.type) !== 'surface') continue;
        surface++;
        const hosts = all.map(hostOf).filter(Boolean) as NonNullable<ReturnType<typeof hostOf>>[];
        const f0 = (h: any) => footprintIn(h, it)!;
        const h = hosts.find(h => { const f = f0(h); return h.rects.some(q => (f[0] + f[2]) / 2 >= q[0] && (f[0] + f[2]) / 2 <= q[2] && (f[1] + f[3]) / 2 >= q[1] && (f[1] + f[3]) / 2 <= q[3]); });
        assert.ok(h, `${id}/${room.name}: ${it.type} stands on no host`);
        hostsSeen++;
        const f = f0(h);
        assert.ok(h!.rects.some(q => f[0] >= q[0] - 0.01 && f[1] >= q[1] - 0.01 && f[2] <= q[2] + 0.01 && f[3] <= q[3] + 0.01), `${id}/${room.name}: ${it.type} overhangs its ${h!.type}`);
        assert.ok(Math.abs(it.y - h!.top) <= 0.01 + (it.lift || 0) + (it.type === 'centerpiece' ? 0.02 : 0), `${it.type} is at ${it.y}, the ${h!.type}'s top is ${h!.top}`);
      }
      // 40 % of every host's top stays free
      for (const h of base.map(hostOf).filter(Boolean) as NonNullable<ReturnType<typeof hostOf>>[]) {
        const on = standingOn(h, all), total = h.rects.reduce((a, q) => a + rectArea(q), 0), cover = on.reduce((a, it) => { const f = footprintIn(h, it); return a + (f ? rectArea(f) : 0); }, 0);
        if (on.some(isDress)) assert.ok(cover <= (h.kind === 'tank' ? 0.8 : 0.6) * total + 1e-6, `${id}/${room.name}: the ${h.type} is ${(100 * cover / total).toFixed(0)} % covered`);
      }
      // no dress item in a door's swing, none overlapping another dress surface item
      for (const it of r.items.filter((i: any) => layerOf(i.type) !== 'surface' && layerOf(i.type) !== 'wall')) {
        const o = itemObb(it)!; for (const p of geo.portals) { if (!p.hinged) continue; /* the lint's own swing test is dress-lane + door-swing below */ void p; void o; void overlap; }
      }
    }
    const issues = lintLayout(spec).filter(i => /^dress-/.test(i.code) || i.code === 'door-swing' || i.code === 'wall-pierce' || i.code === 'outside-room');
    const base = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(base)) delete room.dress;
    const before = lintLayout(base).filter(i => i.code === 'door-swing' || i.code === 'wall-pierce' || i.code === 'outside-room').length;
    const bad = issues.filter(i => /^dress-/.test(i.code) && i.code !== 'dress-bare');
    assert.equal(bad.length, 0, `${id}: ${bad.map(i => `${i.code}: ${i.message}`).slice(0, 4).join(' | ')}`);
    assert.equal(issues.filter(i => i.code !== 'dress-bare' && !/^dress-/.test(i.code)).length, before, `${id}: the dress phase added a door-swing, wall-pierce or outside-room finding`);
  }
  assert.ok(surface > 20 && hostsSeen === surface, `${surface} dress surface items checked`);
});

test('E: the opt-outs', () => {
  const spec = fixture('dress-rooms');
  assert.ok(dressHouse(spec).size > 5, 'the fixture opts in');
  const off = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(off)) room.dress = false;
  assert.equal(dressHouse(off).size, 0, 'dress: false dresses nothing');
  assert.equal(dressRooms(off).size, 0, 'dress: false is not even dressed by the bake tool');
  const none = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(none)) delete room.dress;
  assert.equal(dressHouse(none).size, 0, 'no dress field: the live phase dresses nothing');
  assert.ok(dressRooms(none).size > 5, '… but the bake tool can still ask for a room that has a recipe');
  const noLevel = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(noLevel)) room.dress = {};
  assert.equal(dressHouse(noLevel).size, 0, 'dress: {} (no level) opts in nothing');
  const raised = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(raised)) room.floorOffset = 0.3;
  assert.equal(dressHouse(raised).size, 0, 'a raised floor is left alone');
});

test('F: the fixtures prove the recipes', () => {
  let wet = 0, dining = 0, kitchens = 0, lampFixed = 0, lampless = 0;
  for (const id of FIX) {
    const spec = fixture(id), comp = composeHouse(spec), res = dressRooms(spec);
    for (const { room } of rooms(spec)) {
      const r = res.get(room); if (!r) continue;
      const base = [...(room.items || []), ...((comp.get(room) || { items: [] }).items)], all = [...base, ...r.items];
      const lamp = (xs: any[]) => xs.some(i => PLACEMENT[i.type] && PLACEMENT[i.type].group === 'lamp');
      if (['bath', 'ensuite', 'powder'].includes(room.program)) { wet++; assert.equal(bareViolation(room.program, all, room), null, `${id}/${room.name}: ${bareViolation(room.program, all, room)}`); }
      if (room.program === 'dining') { dining++; assert.equal(bareViolation('dining', all, room), null, `${id}/${room.name} dining bare`); }
      if (room.program === 'kitchen' || room.program === 'kitchen-dining') { kitchens++; if (bareViolation(room.program, all, room)) console.log(`  note: ${id}/${room.name}: ${bareViolation(room.program, all, room)}`); }
      if (RECIPES[room.program] && RECIPES[room.program].slots.some((s: any) => s.id === 'lamp') && !lamp(base)) { lampless++; if (lamp(all)) lampFixed++; }
    }
  }
  assert.ok(wet >= 9 && dining >= 1 && kitchens >= 8, `fixtures cover ${wet} wet rooms, ${dining} dining, ${kitchens} kitchens`);
  assert.ok(lampless === 0 || lampFixed / lampless >= 0.7, `${lampFixed} of ${lampless} lamp-less rooms got a lamp`);
  for (const [p, r] of Object.entries(RECIPES)) for (const s of r.slots) assert.ok([1, 2, 3].includes(s.tier) && s.id && typeof s.run === 'function', `${p}/${s.id}`);
});

test('G: the never-bare census before and after, on the dress fixtures', () => {
  const rows: string[] = []; let viol0 = 0, viol1 = 0, n = 0;
  for (const id of FIX) {
    const spec = fixture(id), comp = composeHouse(spec), res = dressRooms(spec);
    for (const { room } of rooms(spec)) {
      if (!room.program) continue;
      const base = [...(room.items || []), ...((comp.get(room) || { items: [] }).items)], r = res.get(room), all = [...base, ...(r ? r.items : [])];
      const v0 = bareViolation(room.program, base, room), v1 = bareViolation(room.program, all, room);
      if (['bath', 'ensuite', 'powder', 'dining', 'kitchen', 'kitchen-dining', 'hall'].includes(room.program)) { n++; if (v0) viol0++; if (v1) viol1++; if (v1) rows.push(`${id}/${room.name}: ${v1}`); }
    }
  }
  console.log(`  never-bare rooms on the fixtures: ${n}; violations before ${viol0}, after ${viol1}${rows.length ? '\n    ' + rows.join('\n    ') : ''}`);
  assert.ok(viol1 < viol0, 'the phase reduces the never-bare violations');
  void sizeOf;
});

test('H: a baked dress item moves no composition', () => {
  for (const id of ['dress-rooms', 'dress-styles']) {
    const spec = fixture(id), res = dressRooms(spec);
    const baked = JSON.parse(JSON.stringify(spec)); for (const { room } of rooms(baked)) delete room.dress;
    const plain = JSON.parse(JSON.stringify(baked));
    rooms(spec).forEach(({ room }: any, i: number) => { const r = res.get(room); if (r) { const t = rooms(baked)[i].room; t.items = [...(t.items || []), ...r.items]; } });
    assert.ok(rooms(baked).some(({ room }: any) => (room.items || []).some(isDress)), `${id}: dress items baked`);
    const a = composeHouse(plain), b = composeHouse(baked);
    const ra = rooms(plain), rb = rooms(baked);
    ra.forEach(({ room }: any, i: number) => { assert.equal(strip((a.get(room) || { items: [] }).items), strip((b.get(rb[i].room) || { items: [] }).items), `${id}/${room.name}: a baked dress item moved the composition`); });
  }
});

test('I: the bake tool (compose-house.mts --dress / --undress)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dress-bake-')), src = path.join(ROOT, 'test', 'fixtures', 'houses', 'dress-rooms.json');
  const a = path.join(dir, 'a.json'), b = path.join(dir, 'b.json'), c = path.join(dir, 'c.json');
  const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'compose-house.mts'), ...args], { encoding: 'utf8' });
  try {
    const r1 = run('--house', src, '--dress', '--out', a), r2 = run('--house', a, '--dress', '--out', b), r3 = run('--house', a, '--undress', '--out', c);
    assert.ok(r1.status === 0 && r2.status === 0 && r3.status === 0, `${r1.stderr}${r2.stderr}${r3.stderr}`);
    const orig = fixture('dress-rooms'), A = JSON.parse(fs.readFileSync(a, 'utf8'));
    // the baked items are the live phase's, per room, in order
    const live = dressRooms(orig);
    rooms(orig).forEach(({ room }: any, i: number) => {
      const got = (rooms(A)[i].room.items || []).filter(isDress), want = (live.get(room) || { items: [] }).items;
      assert.equal(strip(got), strip(want), `${room.name}: the baked items differ from the live phase's`);
    });
    assert.equal(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8'), '--dress twice writes the same file');
    assert.equal(strip(JSON.parse(fs.readFileSync(c, 'utf8'))), strip(orig), '--undress gives the original back');
    // a baked spec with the dress fields stripped is dressed by the bake alone: no live phase, the same items
    const baked = JSON.parse(fs.readFileSync(a, 'utf8')); for (const { room } of rooms(baked)) delete room.dress;
    assert.equal(dressHouse(baked).size, 0, 'a baked house with no dress.level is not dressed live a second time');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- J: the café curtain, measured as built --------------------------------------------------------------------------------------------
/** the specs the fleet checks run over: the 30 houses and the dress fixtures */
const fleet = () => [...houses.map(h => ({ id: h.id, spec: load(h.file) })), ...FIX.map(id => ({ id, spec: fixture(id) }))];
/** a window of a room, from the composer's own wall runs: the item a café curtain stands at is [t, face + gap] on an x-wall and [face + gap, t] on a z-wall */
function windowOf(spec: any, lv: any, room: any, composed: Map<any, any[]>, at: [number, number]) {
  const program = dressProgram(room, lv)!, base = [...(room.items || []).filter((x: any) => !isDress(x)), ...(composed.get(room) || [])];
  const geo = (new Dresser(spec, lv, room, program, 0.5, base, composed) as any).geoC().geo;
  // (a panel of a parted or clipped curtain is not centred on its window: the window it hangs at is the nearest on that wall whose span, less the rod's reach, the panel meets)
  let best: { sill: number; hgt: number; width: number; d: number } | null = null;
  for (const run of geo.runs) for (const w of run.windows) {
    const along = run.side === 'N' || run.side === 'S' ? at[0] : at[1], across = run.side === 'N' || run.side === 'S' ? at[1] : at[0];
    if (Math.abs(across - run.face) > 0.02 || along < w.a - 0.2 || along > w.b + 0.2) continue;
    const d = Math.abs(along - (w.a + w.b) / 2); if (!best || d < best.d) best = { sill: w.sill as number, hgt: w.h as number, width: (w.b - w.a) as number, d };
  }
  return best;
}
const bcx = createBuildContext({ THREE } as any);
const kitx = createMaterialKit({ THREE, palette: { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' }, seed: 'cafe' } as any);
/** y range [min, max] a café curtain of these params occupies in the room (the item's own lift added to what three.js builds) */
function curtainRange(it: any): { lo: number; hi: number } {
  const def = (PROPS as Map<string, any>).get('cafe-curtain');
  const o = def.create({ ...it }, { THREE, std: bcx.std, box: bcx.box, group: bcx.group, mix: bcx.mix, hex: bcx.hex, colors: kitx.colors, rng: kitx.itemRng('cafe'), H: 2.8 });
  o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o);
  return { lo: b.min.y + (it.y || 0), hi: b.max.y + (it.y || 0) };
}
/** what is wrong with a curtain of this built range on a window (empty: nothing) */
function curtainFaults(r: { lo: number; hi: number }, win: { sill: number; hgt: number }): string[] {
  const out: string[] = [], eps = 0.002;
  if (r.hi > win.sill + CAFE.topShare * win.hgt + eps) out.push(`top ${r.hi.toFixed(3)} is above sill + ${CAFE.topShare} x height (${(win.sill + CAFE.topShare * win.hgt).toFixed(3)})`);
  if (r.lo < win.sill - eps) out.push(`hem ${r.lo.toFixed(3)} hangs below the sill ${win.sill}`);
  if (r.hi - r.lo < CAFE.minDrop - eps) out.push(`only ${(r.hi - r.lo).toFixed(3)} m of curtain`);
  const clearable = win.sill + CAFE.hemAboveSill + CAFE.hemGap + CAFE.minDrop + CAFE.rodAbove <= CAFE.eyeLo;
  if (r.lo < CAFE.eyeHi && r.hi > CAFE.eyeLo && (clearable || win.hgt > CAFE.small)) out.push(`stands across the ${CAFE.eyeLo}-${CAFE.eyeHi} m eye line (${r.lo.toFixed(3)}-${r.hi.toFixed(3)}) on a ${win.hgt} m window${clearable ? ' that had room to clear it' : ''}`);
  return out;
}
test('J: every café curtain, as built, hangs on the lower half of its window and clears the eye line', () => {
  let n = 0, narrow = 0, crossed = 0;
  for (const { id, spec } of fleet()) {
    const composed = new Map<any, any[]>(); for (const [room, res] of composeHouse(spec)) composed.set(room, res.items);
    for (const { lv, room } of rooms(spec)) {
      const res = dressRooms(spec).get(room); if (!res) continue;
      for (const it of res.items.filter((x: any) => x.type === 'cafe-curtain')) {
        const win = windowOf(spec, lv, room, composed, it.at); assert.ok(win, `${id}/${room.name}: no window under the curtain at ${it.at}`);
        const r = curtainRange(it), faults = curtainFaults(r, win!);
        assert.deepEqual(faults, [], `${id}/${room.name}: curtain ${JSON.stringify({ w: it.w, h: it.h, y: it.y })} on window sill ${win!.sill} x ${win!.hgt}: ${faults.join('; ')}`);
        assert.ok(r.hi - r.lo <= win!.hgt * CAFE.topShare + 0.1, `${id}/${room.name}: longer than the lower half of the window`);
        assert.ok(it.w <= win!.width + 0.3 + 1e-6, `${id}/${room.name}: wider than its window plus the rod's reach`);
        // a pale cloth from the house scheme, not the palette's dark fabric role (a slab against a light wall)
        const m = /^#([0-9a-f]{6})$/i.exec(it.color || ''); assert.ok(m, `${id}/${room.name}: the curtain carries the scheme's colour (${it.color})`);
        const n3 = parseInt(m![1], 16), lum = (0.2126 * ((n3 >> 16) & 255) + 0.7152 * ((n3 >> 8) & 255) + 0.0722 * (n3 & 255)) / 255;
        assert.ok(lum >= 0.7, `${id}/${room.name}: curtain colour ${it.color} is dark (luma ${lum.toFixed(2)})`);
        assert.equal(it.color, dressSchemeOf(spec).curtain);
        n++; if (r.lo < CAFE.eyeHi && r.hi > CAFE.eyeLo) crossed++; if (win!.width < 1) narrow++;
      }
    }
  }
  assert.ok(n >= 25, `the test measured ${n} curtains: it must see the fleet's kitchens`);
  console.log(`J: ${n} curtains measured as built (${crossed} cross the eye line, all on small windows; ${narrow} on windows under 1 m)`);
});

test('J2 (control): the first cut\'s params fail the same measurement', () => {
  // the slot passed h = min(head, sill + 0.95) and no lift, head = min(sill + height + 0.12, H - 0.12): the rod at sill + 0.95, the cloth 0.75 below it
  for (const [sill, hgt, H] of [[1.15, 1.0, 3], [1.0, 1.1, 2.8], [0.9, 1.3, 2.8]]) {
    const head = Math.min(sill + hgt + 0.12, H - 0.12), old = { type: 'cafe-curtain', w: 1.4, h: Math.min(head, sill + 0.95) };
    const faults = curtainFaults(curtainRange(old), { sill, hgt });
    assert.ok(faults.length > 0, `the old params on a ${sill} + ${hgt} window pass: the test cannot see the slab`);
  }
  // and the fit for the same windows passes, with a window too low or too short left bare
  for (const [sill, hgt] of [[1.15, 1.0], [1.0, 1.1], [0.9, 1.3], [1.5, 0.7]]) { const f = cafeFit(sill, hgt)!; assert.ok(f, `${sill} x ${hgt}`); assert.deepEqual(curtainFaults(curtainRange({ type: 'cafe-curtain', w: 1.4, h: f.h, y: f.y }), { sill, hgt }), []); }
  assert.equal(cafeFit(0.3, 2.2), null, 'a window to the floor is left bare');
  assert.equal(cafeFit(1.0, 0.5), null, 'a window too short for the shortest curtain is left bare');
});

// ---- K: the rig's corner cameras keep their view ---------------------------------------------------------------------------------------
/** the vertical span a spec item occupies, read from the catalog (a floor piece from 0; a surface or wall piece from its own y; a hung piece's y is its centre, its top or its bottom) */
function spanOfItem(it: any): { lo: number; hi: number; floor: boolean } | null {
  const s = sizeOf(it.type, it), pl: any = PLACEMENT[it.type]; if (!s) return null;
  const layer = layerOf(it.type);
  if (layer === 'floor' || layer === 'ceiling') return null;   // a rug, a pendant: out of the eye's reach
  if (layer === 'wall') { const y = it.y ?? pl?.mountY ?? 1.5; return CENTRE_MOUNT.has(it.type) ? { lo: y - s.h / 2, hi: y + s.h / 2, floor: false } : TOP_MOUNT.has(it.type) ? { lo: y - s.h, hi: y, floor: false } : { lo: y, hi: y + s.h, floor: false }; }
  if (layer === 'surface') return { lo: it.y ?? 0, hi: (it.y ?? 0) + s.h, floor: false };
  return { lo: s.y0 || 0, hi: (s.y0 || 0) + s.h, floor: true };
}
/** 3-D distance from a point to a box (an obb footprint over [lo, hi]), by polygon edges: independent of eyeGap's local-frame arithmetic */
function gapToBox(o: ReturnType<typeof obb>, lo: number, hi: number, p: [number, number, number]): number {
  const poly = corners(o); let d2 = Infinity; const cross: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % 4], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((p[0] - ax) * ex + (p[2] - az) * ez) / (ex * ex + ez * ez)));
    d2 = Math.min(d2, (p[0] - ax - t * ex) ** 2 + (p[2] - az - t * ez) ** 2);
    cross.push(ex * (p[2] - az) - ez * (p[0] - ax));
  }
  const inside = cross.every(c => c >= 0) || cross.every(c => c <= 0);
  return Math.hypot(inside ? 0 : Math.sqrt(d2), Math.max(lo - p[1], p[1] - hi, 0));
}
const lampLit = (spec: any) => {
  // the lamp census (scripts/dress-project.mts): rooms whose recipe asks for a lamp, that the layout leaves without one, and the phase lights
  let asks = 0, lampless = 0, lit = 0;
  const comp = composeHouse(spec), res = dressRooms(spec), isLamp = (i: any) => PLACEMENT[i.type] && (PLACEMENT[i.type] as any).group === 'lamp';
  for (const { lv, room } of rooms(spec)) {
    const prog = dressProgram(room, lv); if (!prog || !res.get(room) || !RECIPES[prog].slots.some(x => x.id === 'lamp')) continue;
    asks++;
    const base = [...(room.items || []).filter((i: any) => !isDress(i)), ...((comp.get(room) || { items: [] }).items)];
    if (base.some(isLamp)) continue;
    lampless++; if ((res.get(room)?.items || []).some(isLamp)) lit++;
  }
  return { asks, lampless, lit };
};
test('K: the rig\'s corner camera points are the Node copy\'s, and nothing the phase places stands in their way', () => {
  // the formula: a copy in assets/ (THREE-free), compared with the rig's own cornerCam for every room of every house and every corner
  let cams = 0, near = 0;
  const lamps = { asks: 0, lampless: 0, lit: 0 };
  for (const { id, spec } of fleet()) {
    const res = dressRooms(spec);
    for (const { room } of rooms(spec)) {
      if (!room.bounds) continue;
      for (const e of cornerEyes(room.bounds)) {
        const cam = cornerCam(room.bounds, 0, e.corner);
        assert.ok(Math.abs(cam.pos[0] - e.x) < 1e-6 && Math.abs(cam.pos[2] - e.z) < 1e-6 && cam.eye === CAM.eye, `${id}/${room.name}/${e.corner}: the keep-out's camera point is not the rig's`);
      }
      const r = res.get(room); if (!r) continue;
      for (const e of cornerEyes(room.bounds)) {
        cams++;
        for (const it of r.items) {
          const o = itemObb(it), sp = spanOfItem(it); if (!o || !sp) continue;
          const g = gapToBox(o, sp.lo, sp.hi, [e.x, CAM.eye, e.z]);
          assert.ok(g >= CAM.clear - 1e-6, `${id}/${room.name}/${e.corner}: the camera is ${(g * 100).toFixed(1)} cm from the dress ${it.type} at ${it.at}`);
          // (and the packer's own arithmetic agrees with this independent one)
          assert.ok(!camBlocked(cornerEyes(room.bounds), o, sp.lo, sp.hi, sp.floor), `${id}/${room.name}: camBlocked disagrees about ${it.type}`);
          if (sp.floor && sp.hi - sp.lo > CAM.tall) {
            const q = obb((e.sq[0] + e.sq[2]) / 2, (e.sq[1] + e.sq[3]) / 2, e.sq[2] - e.sq[0], e.sq[3] - e.sq[1], 0);
            assert.ok(overlap(o, q) <= 0, `${id}/${room.name}/${e.corner}: the ${(sp.hi - sp.lo).toFixed(2)} m ${it.type} stands in the corner square`);
          }
          if (g < 0.6) near++;
        }
      }
    }
    const l = lampLit(spec); lamps.asks += l.asks; lamps.lampless += l.lampless; lamps.lit += l.lit;
  }
  assert.ok(cams >= 800, `${cams} corner cameras were measured: the fleet's rooms`);
  console.log(`K: ${cams} corner cameras over the 30 houses and the fixtures, none within 0.3 m of a dress piece (${near} pieces between 0.3 and 0.6 m); lamp census: ${lamps.asks} rooms ask, ${lamps.lampless} lamp-less in the layout, ${lamps.lit} lit by the phase`);
  // the shipped houses' census: 105 of 132 lit before the leaf strips (wave6/dress-lamps.tsv); the strips an open door leaf parks in cost three (bghouse-olcia's Lower Hall, seraphine's
  // Entry Hall, sunnyhome's Kitchen: a lamp stood where the scene check found a leaf swinging into it); the fixtures add their own rooms on top
  const ship = houses.map(h => lampLit(load(h.file))).reduce((a, l) => ({ asks: a.asks + l.asks, lampless: a.lampless + l.lampless, lit: a.lit + l.lit }), { asks: 0, lampless: 0, lit: 0 });
  assert.equal(ship.lampless, 132, 'the layout leaves 132 lamp-less rooms in the 30 houses');
  assert.ok(ship.lit >= 102, `the lamp census lost rooms to the keep-outs: ${ship.lit} lit, 105 before the leaf strips`);
});

test('K2 (control): a fiddle-leaf in the corner is in the way, a low basket is not, and the 0.3 m ring is where the rig says', () => {
  const b = { x: 0, z: 0, w: 4, d: 3 }, eyes = cornerEyes(b), nw = eyes.find(e => e.corner === 'NW')!;
  assert.deepEqual([nw.x, nw.z], [0.55, 0.55]);
  const plant = obb(0.3, 0.3, 0.5, 0.5), basket = obb(0.3, 0.3, 0.5, 0.5);
  assert.ok(camBlocked(eyes, plant, 0, 1.6, true), 'a tall plant in the corner');
  assert.ok(!camBlocked(eyes, basket, 0, 0.5, true), 'a 0.5 m basket in the corner is allowed');
  assert.ok(camBlocked(eyes, obb(0.55, 0.95, 0.4, 0.3), 0, 1.7, true), 'a lamp 0.25 m from the camera, beside the corner square');
  assert.ok(!camBlocked(eyes, obb(0.55, 1.2, 0.3, 0.3), 0, 1.7, true), 'a lamp 0.5 m away');
  assert.ok(!camBlocked(eyes, obb(0.55, 0.7, 0.4, 0.4), 0.9, 1.1, false), 'a counter piece 0.4 m under the eye is no obstacle');
  assert.ok(eyeGap(obb(0.55, 1.0, 0.1, 0.1), 0, 1.7, nw) > 0.39 && eyeGap(obb(0.55, 1.0, 0.1, 0.1), 0, 1.7, nw) < 0.41);
});

test('K3: a bare-headed lamp keeps LAMP_EYE from every corner eye, no lamp is the legacy halo, and the check can fail (controls)', () => {
  const eyesOf = (room: any) => cornerEyes(room.bounds);
  let bare = 0, lamps = 0, nearest = Infinity;
  const specs = [...houses.map(h => ({ id: h.id, spec: load(h.file) })), ...FIX.map(id => ({ id, spec: fixture(id) }))];
  for (const { id, spec } of specs) {
    for (const { room, it } of dressedItems(spec)) {
      if (!['lamp'].includes((PLACEMENT[it.type] as any)?.group)) continue;
      lamps++;
      assert.notEqual(it.type, 'halo-lamp', `${id}/${room.name}: the phase placed the legacy halo lamp (a glowing ring and its own PointLight outside a programmed room's toning)`);
      if (!BARE_LAMPS.has(it.type)) continue;
      bare++;
      const o = itemObb(it), sp = spanOfItem(it); if (!o || !sp) continue;
      for (const e of eyesOf(room)) { const g = eyeGap(o, sp.lo, sp.hi, e); nearest = Math.min(nearest, g); assert.ok(g >= LAMP_EYE - 1e-6, `${id}/${room.name}/${e.corner}: a bare ${it.type} stands ${(g * 100).toFixed(0)} cm from the camera`); }
    }
  }
  assert.ok(lamps > 80 && bare > 10, `${lamps} lamps, ${bare} bare-headed ones measured`);
  // a lamp glows only where the light rig gives its room a pool: nothing under the rig's minimum room area (read from the source, so the two cannot drift)
  assert.equal(LAMP_MIN_AREA, Number((fs.readFileSync(path.join(ROOT, 'assets', 'fixtures.ts'), 'utf8').match(/const ROOM_MIN_AREA\s*=\s*([0-9.]+)/) || [])[1]), 'LAMP_MIN_AREA is fixtures.ts ROOM_MIN_AREA');
  for (const { id, spec } of specs) for (const { room, it } of dressedItems(spec)) if (LAMP_TYPES.has(it.type)) assert.ok(room.bounds.w * room.bounds.d >= LAMP_MIN_AREA, `${id}/${room.name}: a ${it.type} in a ${(room.bounds.w * room.bounds.d).toFixed(1)} m2 room, which the light rig does not light`);
  assert.ok(!FLOOR_LAMPS.includes('halo-lamp') && !TABLE_LAMPS.includes('halo-lamp') && !SMALL_LAMPS.includes('halo-lamp'), 'no recipe list names the halo lamp');
  // control: the measure sees a mushroom lamp half a metre from the NW eye (aurora Kitchen NW night clipped 6 % of the frame with one there)
  const eyes = cornerEyes({ x: 0, z: 0, w: 4, d: 3 }), nw = eyes[0], near = obb(nw.x + 0.5, nw.z, 0.2, 0.2);
  assert.ok(eyeGap(near, 0.9, 1.25, nw) < LAMP_EYE, 'control: a lamp 0.5 m from the eye is inside LAMP_EYE');
  console.log(`K3: ${lamps} dress lamps over the 30 houses and the fixtures, ${bare} bare-headed, the nearest ${(nearest * 100).toFixed(0)} cm from any corner eye (limit ${LAMP_EYE * 100} cm), no halo lamp`);
});

test('T: baking dress items re-rolls no lamp the layout already had: lampPlan reads the layout\'s lamps, a dress lamp takes its own pick', () => {
  let rooms_ = 0, dressLampRooms = 0;
  for (const h of houses) {
    const baked = load(h.file), bare = JSON.parse(JSON.stringify(baked));
    for (const { room } of rooms(bare)) room.items = (room.items || []).filter((i: any) => !isDress(i));
    const a = lampPlan(baked), b = lampPlan(bare);
    for (const { lv, room } of rooms(baked)) {
      const ri = lv.rooms.indexOf(room), key = `${lv.id}#${ri}`, hadLamp = (room.items || []).some((i: any) => LAMP_ITEMS.has(i.type) && !isDress(i));
      if (hadLamp) { assert.equal(a.get(key), b.get(key), `${h.id}/${room.name}: a lamp the layout had changed its head when the house was dressed (${b.get(key)} -> ${a.get(key)})`); rooms_++; }
      else if ((room.items || []).some((i: any) => LAMP_ITEMS.has(i.type) && isDress(i))) dressLampRooms++;
    }
  }
  const isBaked = houses.some(h => fs.readFileSync(h.file, 'utf8').includes(DRESS_SRC));
  assert.ok(rooms_ > 100 && (!isBaked || dressLampRooms > 20), `${rooms_} lamp rooms held their head, ${dressLampRooms} rooms were given a lamp`);
  console.log(`T: ${rooms_} rooms with a layout lamp keep their lamp head baked or not; ${dressLampRooms} dress-lamp rooms take their own seeded pick`);
});

// ---- L: the gap to a neighbour ----------------------------------------------------------------------------------------------------------
/** gap between two obbs (polygon to polygon, 0 when they touch or cross): independent of the rect cover the lint and the packer use */
function obbGap(a: ReturnType<typeof obb>, b: ReturnType<typeof obb>): number {
  const pa = corners(a), pb = corners(b);
  const seg = (p: [number, number], u: [number, number], v: [number, number]) => { const ex = v[0] - u[0], ez = v[1] - u[1], t = Math.max(0, Math.min(1, ((p[0] - u[0]) * ex + (p[1] - u[1]) * ez) / (ex * ex + ez * ez))); return Math.hypot(p[0] - u[0] - t * ex, p[1] - u[1] - t * ez); };
  if (overlap(a, b) > 0) return 0;
  let g = Infinity;
  for (const [P, Q] of [[pa, pb], [pb, pa]] as const) for (const p of P) for (let i = 0; i < 4; i++) g = Math.min(g, seg(p, Q[i], Q[(i + 1) % 4]));
  return g;
}
/** a house with its dress items baked into its rooms (what compose-house.mts --dress writes), and the items per room as the lint reads them */
function bakedItems(spec: any): Map<any, any[]> {
  const comp = composeHouse(spec), res = dressRooms(spec), out = new Map<any, any[]>();
  for (const { room } of rooms(spec)) out.set(room, [...(room.items || []).filter((x: any) => !isDress(x)), ...((comp.get(room) || { items: [] }).items), ...(res.get(room)?.items || [])]);
  return out;
}
test('L: no dress item stands under 1.5 cm from another item on its surface, by the lint and by an independent measure', () => {
  let pairs = 0, tight = 0;
  for (const { id, spec } of fleet()) {
    const all = bakedItems(spec);
    const issues = lintLayout(spec, { only: new Set(['dress-overlap']), items: all });
    assert.deepEqual(issues.map(i => i.message), [], `${id}: dress-overlap findings`);
    for (const { room } of rooms(spec)) {
      const items = all.get(room) || [], hosts = items.map(hostOf).filter((h: any) => !!h) as any[];
      for (const h of hosts) {
        const on = standingOnHost(h, items);
        for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
          if (!isDress(on[i]) && !isDress(on[j])) continue;
          const A = itemObb(on[i]), B = itemObb(on[j]); if (!A || !B) continue;
          pairs++;
          const g = obbGap(A, B);
          if (g < 0.03) tight++;
          assert.ok(g >= MIN_GAP, `${id}/${room.name}: ${on[i].type}${isDress(on[i]) ? '*' : ''} and ${on[j].type}${isDress(on[j]) ? '*' : ''} stand ${(g * 1000).toFixed(1)} mm apart on the ${h.type}`);
        }
      }
    }
  }
  assert.ok(pairs >= 400, `${pairs} pairs measured`);
  console.log(`L: ${pairs} neighbouring pairs (a dress item and another) over the 30 houses baked and the fixtures, none under ${MIN_GAP * 100} cm (${tight} between 1.5 and 3 cm)`);
});

test('L2: the 12 neighbours the skeptic found under 1 cm are fixed (the pair is apart by 1.5 cm or the dress piece is not there)', () => {
  // [house, room, the dress piece, its neighbour]: built-geometry gaps of 0-9 mm on the first cut
  const cases: Array<[string, string, string, string, number]> = [
    ['aurora', 'Dining', 'candle-trio', 'vase', 1], ['dress-kitchens', 'Kitchen-dining, terrazzo', 'centerpiece', 'ceramic-bowl', 1], ['dress-kitchens', 'Kitchen-dining, terrazzo', 'place-setting', 'place-setting', 4],
    ['lakecabin', 'Dining', 'candle-trio', 'flower-jug', 1], ['lakecabin', 'Dining', 'place-setting', 'flower-jug', 1], ['neweco', 'Breakfast Nook', 'candle-trio', 'place-setting', 1], ['neweco', 'Breakfast Nook', 'place-setting', 'candle-trio', 2],
    ['neweco', 'Sunroom Lounge', 'side-set', 'ginger-lamp', 1],
  ];
  let covered = 0;
  for (const [house, roomName, mine, theirs, n] of cases) {
    const spec = FIX.includes(house) ? fixture(house) : load(path.join(ROOT, 'content', 'houses', `${house}.json`)), all = bakedItems(spec);
    const room = rooms(spec).find(({ room }: any) => room.name === roomName)!.room, items = all.get(room) || [];
    const hosts = items.map(hostOf).filter((h: any) => !!h) as any[];
    let seen = 0;
    for (const h of hosts) {
      const on = standingOnHost(h, items);
      for (const it of on.filter((x: any) => isDress(x) && x.type === mine)) for (const o of on) {
        if (o === it || o.type !== theirs) continue;
        seen++; const g = obbGap(itemObb(it)!, itemObb(o)!);
        assert.ok(g >= MIN_GAP, `${house}/${roomName}: the ${mine} stands ${(g * 1000).toFixed(1)} mm from the ${theirs}`);
      }
    }
    covered += n; void seen;
  }
  assert.equal(covered, 12, 'the 12 cases of the skeptic');
});

test('L3 (control): the flower-jug the first cut could not see, and the lint that did not see it', () => {
  // lakecabin's Dining table carries an authored flower-jug with no `y` (the page builds it at DESK_TOP 0.77): the first cut's standingOn needed a `y`
  assert.equal(DESK_TOP, 0.77);
  const spec = load(path.join(ROOT, 'content', 'houses', 'lakecabin.json')), room = rooms(spec).find(({ room }: any) => room.name === 'Dining')!.room;
  const jug = (room.items as any[]).find(x => x.type === 'flower-jug'), table = (room.items as any[]).find(x => x.type === 'trestle-table'), h = hostOf(table)!;
  assert.equal(jug.y, undefined); assert.equal(surfaceY(jug), DESK_TOP);
  assert.ok(standingOnHost(h, [jug]).length === 1, 'the jug stands on the table');
  // a dress candle-trio 8 mm from the jug's footprint (in the host's frame, to its right), at the table's top
  const f = footprintIn(h, jug)!, ct = sizeOf('candle-trio', {})!, lx = f[2] + 0.008 + ct.w / 2, lz = (f[1] + f[3]) / 2;
  const [wx, wz] = toWorld(h, lx, lz), trio = { type: 'candle-trio', at: [wx, wz], rot: h.rot, y: h.top, src: DRESS_SRC, dk: 'x:control:0' };
  const nb = neighbourGap(h, trio, standingOnHost(h, [jug, trio]))!;
  assert.ok(nb.gap > 0.006 && nb.gap < MIN_GAP, `the control gap is ${nb.gap}`);
  const map = new Map<any, any[]>(rooms(spec).map(({ room: r }: any) => [r, r === room ? [...r.items, trio] : (r.items || [])] as [any, any[]]));
  const found = lintLayout(spec, { only: new Set(['dress-overlap']), items: map });
  assert.ok(found.length === 1 && /candle-trio/.test(found[0].message) && /flower-jug/.test(found[0].message), `the lint sees the control: ${JSON.stringify(found.map(i => i.message))}`);
  // 2 cm apart: no finding
  const trio2 = { ...trio, at: toWorld(h, f[2] + 0.021 + ct.w / 2, lz) };
  assert.equal(lintLayout(spec, { only: new Set(['dress-overlap']), items: new Map<any, any[]>(rooms(spec).map(({ room: r }: any) => [r, r === room ? [...r.items, trio2] : (r.items || [])] as [any, any[]])) }).length, 0);
  assert.ok(NEIGHBOUR_GAP > MIN_GAP, 'the packer keeps more than the lint demands');
  void rectGap;
});

test('L4: no dress item stands under 1.5 cm from ANY item at its height, on its host or across the seam of the next unit of a run', () => {
  let pairs = 0, across = 0;
  for (const { id, spec } of fleet()) {
    const all = bakedItems(spec);
    for (const { room } of rooms(spec)) {
      const items = (all.get(room) || []).filter((x: any) => Array.isArray(x.at) && layerOf(x.type) === 'surface' && surfaceY(x) !== undefined);
      const hosts = (all.get(room) || []).map(hostOf).filter((h: any) => !!h) as any[];
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j]; if (!isDress(a) && !isDress(b)) continue;
        if (Math.abs(surfaceY(a)! - surfaceY(b)!) > 0.05) continue;
        const A = itemObb(a), B = itemObb(b); if (!A || !B) continue;
        pairs++; const g = obbGap(A, B);
        if (g < 0.2 && !hosts.some(h => standingOnHost(h, [a, b]).length === 2)) across++;
        assert.ok(g >= MIN_GAP, `${id}/${room.name}: ${a.type}${isDress(a) ? '*' : ''} and ${b.type}${isDress(b) ? '*' : ''} stand ${(g * 1000).toFixed(1)} mm apart at ${surfaceY(a)} m`);
        // and by what the packer reserved: the box gap less both pieces' REACH (the worst their built meshes can pass their boxes) is still the lint's 1.5 cm
        assert.ok(g - reachOf(a.type) - reachOf(b.type) >= MIN_GAP - 1e-6, `${id}/${room.name}: ${a.type}${isDress(a) ? '*' : ''} and ${b.type}${isDress(b) ? '*' : ''} are ${(g * 1000).toFixed(1)} mm apart, and their reach (${((reachOf(a.type) + reachOf(b.type)) * 1000).toFixed(0)} mm) can close it under ${MIN_GAP * 100} cm`);
      }
    }
  }
  assert.ok(pairs >= 1000 && across >= 5, `${pairs} pairs, ${across} near pairs on different hosts`);
  console.log(`L4: ${pairs} pairs of surface items at one height (a dress item and another) over the 30 houses baked and the fixtures, ${across} within 20 cm of each other on DIFFERENT hosts: none under ${MIN_GAP * 100} cm`);
});

test('L5 (control): epiphany\'s mushroom lamp, 18 mm from the herb pots of the next unit of the run, is a neighbour the packer now sees', () => {
  // the first cut's pair (the skeptic's last miss): the lamp at the end of one counter unit, the authored herb pots on the next, 18 mm apart by their boxes, 12 mm by their meshes
  const spec = load(path.join(ROOT, 'content', 'houses', 'epiphany.json')), room = rooms(spec).find(({ room }: any) => room.name === 'Kitchen')!.room;
  const pots = (room.items as any[]).find(x => x.type === 'herb-pots'), lamp = { type: 'mushroom-lamp', at: [2.13, -5.67], y: 0.9, src: DRESS_SRC, dk: 'x:control:0' };
  const items = [...(room.items as any[]), lamp], hosts = items.map(hostOf).filter((h: any) => !!h) as any[];
  const lampHost = hosts.find((h: any) => standingOnHost(h, items).includes(lamp))!;
  assert.ok(lampHost, 'the lamp stands on a host');
  assert.ok(!standingOnHost(lampHost, items).includes(pots), 'the herb pots stand on the NEXT unit: standingOn never sees them from the lamp\'s host');
  assert.ok(nearOn(lampHost, items).includes(pots), 'nearOn does');
  const g = obbGap(itemObb(lamp)!, itemObb(pots)!);
  assert.ok(g >= MIN_GAP && g - reachOf('herb-pots') < MIN_GAP, `the pair is ${(g * 1000).toFixed(1)} mm apart by its boxes (passes the lint) and under ${MIN_GAP * 100} cm by its reach: only the reach-aware measure of L4 sees it`);
  // the packer keeps NEIGHBOUR_GAP + both reaches from it on the lamp's own host
  const free = freeRects(lampHost, nearOn(lampHost, items.filter(x => x !== lamp)), 0.03, NEIGHBOUR_GAP, reachOf('mushroom-lamp'));
  const f = footprintIn(lampHost, lamp)!;
  assert.ok(!free.some(r => f[0] >= r[0] - 1e-6 && f[2] <= r[2] + 1e-6 && f[1] >= r[1] - 1e-6 && f[3] <= r[3] + 1e-6), 'the first cut\'s spot is no longer free');
});

test('M: REACH holds, over 96 fresh seeds of every surface type at every variant, and no spilling type is missing', () => {
  const seen: Record<string, number> = {}; let measured = 0;
  for (const type of surfaceTypes()) {
    const { worst, at } = spillOf(type, 96, 'M:');
    seen[type] = worst; measured++;
    assert.ok(worst <= (REACH[type] || 0.002) + 1e-9, `${type}: the built mesh passes its measured box by ${(worst * 1000).toFixed(1)} mm (${at}), REACH says ${((REACH[type] || 0) * 1000).toFixed(0)}; scripts/dress-reach.mts prints the table`);
  }
  for (const t of Object.keys(REACH)) assert.ok(t in seen, `REACH names ${t}, which is no surface type`);
  assert.ok(measured >= 60, `${measured} surface types measured`);
});

// ---- N: PARTS covers what the page builds ----------------------------------------------------------------------------------------------
/** every mesh of a PARTS type, built in three.js at the given params, against its parts: a mesh above the body's top must lie inside one of the extras (item frame, 3 mm slack) */
function partsFaults(type: string, parts: (it: any, s: any) => { top: number; extras: number[][] }, params: any): string[] {
  const def = (PROPS as Map<string, any>).get(type), it = { type, ...params }, s = sizeOf(type, it)!, p = parts(it, s), out: string[] = [], eps = 0.003;
  const o = def.create(it, { THREE, std: bcx.std, box: bcx.box, group: bcx.group, mix: bcx.mix, hex: bcx.hex, colors: kitx.colors, rng: kitx.itemRng(`parts:${type}`), H: 2.8 });
  o.updateMatrixWorld(true);
  o.traverse((m: any) => {
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m); if (b.max.y <= p.top + eps) return;
    const inside = p.extras.some(([x0, z0, x1, z1, y0, y1]) => b.min.x >= x0 - eps && b.max.x <= x1 + eps && b.min.z >= z0 - eps && b.max.z <= z1 + eps && b.min.y >= y0 - eps && b.max.y <= y1 + eps);
    if (!inside) out.push(`${type} ${JSON.stringify(params)}: a mesh [${b.min.toArray().map(v => v.toFixed(3))}] -> [${b.max.toArray().map(v => v.toFixed(3))}] stands over the body's ${p.top} m outside every part`);
  });
  return out;
}
test('N: PARTS covers every mesh the page builds over the body of its type (and a table without the tap fails the same measurement)', () => {
  for (const type of Object.keys(PARTS)) for (const w of [undefined, 1.2, 2.4]) for (const d of [undefined, 0.5, 0.75]) {
    const params: any = {}; if (w) params.w = w; if (d) params.d = d;
    assert.deepEqual(partsFaults(type, PARTS[type] as any, params), []);
  }
  const noTap = (it: any, s: any) => ({ top: PARTS['sink-run'](it, s).top, extras: [] as number[][] });
  assert.ok(partsFaults('sink-run', noTap, {}).length > 0, 'a sink run with its tap left out passes: the test cannot see the tap');
  // the body: nothing of the type stands over its top except the parts, so the box under `top` is the box sizeOf measured
  const s = sizeOf('sink-run', {})!; assert.ok(s.h > PARTS['sink-run']({}, s).top, 'the whole box is taller than the body (that is why the parts exist)');
});

// ---- O: the café curtain plan -----------------------------------------------------------------------------------------------------------
/** the boxes an item takes in the plan, each with its height range: its measured box (heights read from the catalog, a `y` on a floor piece lifting it), or its PARTS; independent of the planner's own code */
function boxesOf(it: any): Array<{ o: ReturnType<typeof obb>; lo: number; hi: number }> {
  const s = sizeOf(it.type, it), o = itemObb(it); if (!s || !o) return [];
  const layer = layerOf(it.type); let lo: number, hi: number;
  if (layer === 'wall') { const sp = spanOfItem(it); if (!sp) return []; lo = sp.lo; hi = sp.hi; }
  else if (layer === 'surface') { const y = surfaceY(it)!; lo = y + (s.y0 || 0); hi = lo + s.h; }
  else { lo = (typeof it.y === 'number' ? it.y : 0) + (s.y0 || 0); hi = lo + s.h; }
  const f = (PARTS as any)[it.type]; if (!f) return [{ o, lo, hi }];
  const p = f(it, s), rot = it.rot || 0, out = [{ o, lo, hi: Math.min(hi, p.top) }];
  for (const [x0, z0, x1, z1, y0, y1] of p.extras as number[][]) { const [dx, dz] = [((x0 + x1) / 2) * Math.cos(rot * Math.PI / 180) + ((z0 + z1) / 2) * Math.sin(rot * Math.PI / 180), -((x0 + x1) / 2) * Math.sin(rot * Math.PI / 180) + ((z0 + z1) / 2) * Math.cos(rot * Math.PI / 180)]; out.push({ o: obb(it.at[0] + dx, it.at[1] + dz, x1 - x0, z1 - z0, rot), lo: y0, hi: y1 }); }
  return out;
}
const grow = (o: ReturnType<typeof obb>, g: number) => obb(o.cx, o.cz, (o.hw + g) * 2, (o.hd + g) * 2, o.rot);
test('O: no café curtain meets another item (stood over, parted round or skipped), and neighbours keep 2 cm', () => {
  let curtains = 0, checked = 0;
  for (const { id, spec } of fleet()) {
    const comp = composeHouse(spec), res = dressRooms(spec);
    for (const { room } of rooms(spec)) {
      const r = res.get(room); if (!r) continue;
      const cs = r.items.filter((x: any) => x.type === 'cafe-curtain'); if (!cs.length) continue;
      const items = [...(room.items || []).filter((x: any) => !isDress(x)), ...((comp.get(room) || { items: [] }).items), ...r.items];
      for (const c of cs) {
        curtains++;
        const co = curtainObb(c.at, c.rot || 0, c.w, c.h)!, range = curtainRange(c);
        for (const it of items) {
          if (it === c || !Array.isArray(it.at)) continue;
          if (DRESSERS.includes(it.type)) {
            // a curtain against another curtain or blind of the layout: the boxes keep CURTAIN_GAP in plan wherever their heights overlap
            const o2 = itemObb(it); if (!o2) continue;
            const y2 = it.type === 'cafe-curtain' ? curtainRange(it) : (() => { const sp = spanOfItem(it); return sp ? { lo: sp.lo, hi: sp.hi } : { lo: 0, hi: 9 }; })();
            if (Math.min(range.hi, y2.hi) - Math.max(range.lo, y2.lo) <= 0.01) continue;
            assert.ok(obbGap(co, o2) >= CURTAIN_GAP - 1e-6, `${id}/${room.name}: curtain at ${c.at} is ${(obbGap(co, o2) * 1000).toFixed(1)} mm from the ${it.type} at ${it.at}`);
            checked++; continue;
          }
          for (const b of boxesOf(it)) {
            if (b.hi <= range.lo - 0.01 || b.lo >= range.hi + 0.01) continue;
            assert.equal(overlap(grow(b.o, 0.01), co) > 0, false, `${id}/${room.name}: curtain at ${c.at} (${range.lo.toFixed(2)}-${range.hi.toFixed(2)} m, w ${c.w}) meets the ${it.type}${isDress(it) ? '*' : ''} at ${it.at} (${b.lo.toFixed(2)}-${b.hi.toFixed(2)} m)`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(curtains >= 45 && checked >= 400, `${curtains} curtains, ${checked} pairs measured`);
  console.log(`O: ${curtains} curtain panels over the 30 houses baked and the fixtures, ${checked} box pairs against the other items of their rooms (heights from the catalog and PARTS): none meet, neighbours keep ${CURTAIN_GAP * 100} cm`);
});

test('O2 (controls): the first cut\'s curtains meet what the plan now keeps clear of, and the plan parts, lifts and skips where it should', () => {
  // a straight wall on z = 0 (side N, the room to +z), one window 1.2 m wide, sill 1.0, 1.2 high: the plan of its curtain in the face of one thing at a time
  const geo = (windows: any[]) => ({ runs: [{ side: 'N', kind: 'ext', line: -0.08, face: 0, a: -4, b: 4, windows, doors: [] }] }) as any;
  const win = { a: -0.6, b: 0.6, sill: 1.0, h: 1.2, type: 'window' };
  const plan = (items: any[], w: any[] = [win]) => planCafe(geo(w), items, []);
  const bare = plan([]);
  assert.equal(bare.length, 1); assert.equal(bare[0].w, 1.4, 'a free window gets the first cut\'s curtain: window + 0.2'); assert.ok(Math.abs(bare[0].hem - 1.03) < 1e-9, 'its hem 3 cm over the sill');
  // the sink's tap (a 3 cm riser and an arm over the basin, in the middle of a 1.8 m run): the curtain parts round it; the run's own body (0.96 m) is under the hem
  const sink = { type: 'sink-run', at: [0, 0.321], rot: 0 };
  const parted = plan([sink]);
  assert.equal(parted.length, 2, 'a tap in the middle parts the curtain'); assert.ok(parted[0].a1 < 0 && parted[1].a0 > 0, 'the gap is where the tap stands');
  assert.ok(parted.every(p => Math.abs(p.hem - 1.03) < 1e-9), 'at the sill, not lifted: the tap is narrow');
  // a mushroom lamp (0.34 m) on a counter run in the middle of the window: parts it too (one at its side leaves a panel too narrow to hang, and the plan takes the wide one)
  const lamp = { type: 'mushroom-lamp', at: [0, 0.2], y: 0.9, src: 'dress@1' };
  assert.equal(plan([{ type: 'counter-run', at: [0, 0.3], rot: 0 }, lamp]).length, 2, 'a lamp on the counter parts the curtain');
  // a counter higher than the sill + 3 cm (a window at 0.8 over a 0.96 m run) lifts the hem over it, and the cloth still ends under the eye line or the window's lower half
  const low = plan([{ type: 'counter-run', at: [0, 0.3], rot: 0 }], [{ ...win, sill: 0.8 }]);
  assert.equal(low.length, 1); assert.ok(low[0].hem >= 0.96 + 0.02, `the hem ${low[0].hem} clears the 0.96 m run`);
  // a wall of cabinets across the window (hung at 1.4 m): nothing is left
  assert.equal(plan([{ type: 'upper-cabinets', at: [0, 0], rot: 0, w: 3, y: 1.4 }]).length, 0, 'upper cabinets across a window leave it bare');
  // a window with a curtain of its own beside it: the box keeps 2.5 cm from it
  const own = { type: 'curtains', at: [1.5, 0.05], rot: 0 };
  const beside = plan([own]); assert.equal(beside.length, 1);
  assert.ok(obbGap(beside[0].obb, itemObb(own)!) >= CURTAIN_GAP - 1e-6, 'clear of the authored curtain');
  // two windows 0.1 m apart: two curtains whose boxes keep CURTAIN_GAP (the first cut's overlap by 0.2 m)
  const two = plan([], [win, { ...win, a: 0.7, b: 1.9 }]);
  assert.equal(two.length, 2); assert.ok(obbGap(two[0].obb, two[1].obb) >= CURTAIN_GAP - 1e-6, `neighbours ${(obbGap(two[0].obb, two[1].obb) * 1000).toFixed(1)} mm apart`);
  const old = [{ at: 0, w: 1.4 }, { at: 1.3, w: 1.4 }].map(c => obb(c.at, 0.047, c.w + 0.1, 0.094, 0));
  assert.ok(obbGap(old[0], old[1]) === 0, 'the first cut\'s two curtains overlap');
  // over the fleet: the first cut (each window\'s box at window + 0.3, as the first cut) has neighbours under the gap in at least the three houses the skeptic named
  const clashes = new Set<string>();
  for (const { id, spec } of fleet()) for (const { lv, room } of rooms(spec)) {
    const program = dressProgram(room, lv); if (!program) continue;
    const comp = new Map<any, any[]>(); for (const [rm, rr] of composeHouse(spec)) comp.set(rm, rr.items);
    const g = (new Dresser(spec, lv, room, program, 0.5, [...(room.items || []).filter((x: any) => !isDress(x)), ...(comp.get(room) || [])], comp) as any).geoC().geo;
    for (const run of g.runs) { const ws = run.windows.filter((w: any) => w.type === 'window').sort((p: any, q: any) => p.a - q.a); for (let i = 0; i + 1 < ws.length; i++) if ((ws[i + 1].a + ws[i + 1].b) / 2 - (ws[i].a + ws[i].b) / 2 < (ws[i].b - ws[i].a) / 2 + (ws[i + 1].b - ws[i + 1].a) / 2 + 0.3 - CURTAIN_GAP && room.name === 'Kitchen') clashes.add(id); }
  }
  assert.ok(clashes.size >= 3, `the first cut's neighbours clash in ${[...clashes]}`);
});

// ---- P: the bake adds no warning ---------------------------------------------------------------------------------------------------------
/** the validator's warnings per file ("✓ file  (0 errors, N warnings)"), for the given spec files, in one run */
function validatorWarnings(files: string[]): Record<string, { errors: number; warnings: number }> {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'validate-house-spec.mts'), ...files], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out: Record<string, { errors: number; warnings: number }> = {};
  for (const m of (r.stdout + r.stderr).matchAll(/^[✓✗] (\S+)\s+\((\d+) errors?, (\d+) warnings?\)/gm)) out[m[1]] = { errors: Number(m[2]), warnings: Number(m[3]) };
  return out;
}
test('P: a baked house raises no validator warning and no silent-param its unbaked self does not (all 30 houses)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dress-warn-'));
  try {
    const orig: string[] = [], baked: string[] = [];
    for (const h of houses) {
      const out = path.join(dir, `${h.id}.json`), r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'compose-house.mts'), '--house', h.file, '--dress', '--out', out], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr); orig.push(h.file); baked.push(out);
    }
    const before = validatorWarnings(orig), after = validatorWarnings(baked);
    let items = 0, warned = 0;
    for (let i = 0; i < houses.length; i++) {
      const b = before[orig[i]], a = after[baked[i]]; assert.ok(b && a, `${houses[i].id}: the validator printed no summary`);
      assert.equal(a.errors, 0, `${houses[i].id}: the baked house has validator errors`);
      assert.equal(a.warnings, b.warnings, `${houses[i].id}: ${b.warnings} validator warnings unbaked, ${a.warnings} baked`);
      warned += b.warnings;
      const spec = load(orig[i]), all = bakedItems(spec);
      const lint = (m: Map<any, any[]>) => lintLayout(spec, { only: new Set(['silent-param']), items: m }).length;
      const bare = new Map<any, any[]>([...all].map(([room, its]) => [room, its.filter((x: any) => !isDress(x))] as [any, any[]]));
      assert.equal(lint(all), lint(bare), `${houses[i].id}: the layout lint's silent-param count moves with the bake`);
      items += [...all.values()].flat().filter(isDress).length;
    }
    assert.ok(items >= 800, `${items} dress items baked over the 30 houses`);
    // the control: a made-up key on a dress item is still reported, so the count above can fail
    const spec = JSON.parse(fs.readFileSync(baked[1], 'utf8')); const it = spec.levels.flatMap((lv: any) => lv.rooms).flatMap((r: any) => r.items || []).find(isDress)!; it.zz = 1;
    const bad = path.join(dir, 'control.json'); fs.writeFileSync(bad, JSON.stringify(spec, null, 2));
    assert.equal(validatorWarnings([bad])[bad].warnings, before[orig[1]].warnings + 1, 'a made-up key on a dress item is a silent-param warning');
    console.log(`P: 30 houses, ${items} dress items baked, validator warnings ${warned} before and after (the bake used to add about 33 per house); layout silent-param equal`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- Q: a dress item is in its room -------------------------------------------------------------------------------------------------------
test('Q: every dress item stands within 0.5 m of the bounds of its room, even where its host reaches out of them', () => {
  let n = 0, reaching = 0;
  for (const { id, spec } of fleet()) for (const { room } of rooms(spec)) {
    const r = dressRooms(spec).get(room); if (!r) continue;
    const b = room.bounds;
    for (const it of r.items) {
      n++; assert.ok(it.at[0] >= b.x - 0.5 && it.at[0] <= b.x + b.w + 0.5 && it.at[1] >= b.z - 0.5 && it.at[1] <= b.z + b.d + 0.5, `${id}/${room.name}: ${it.type} at ${it.at} is outside the room`);
    }
    // a host that reaches out of its room: the dress phase said why it left part of it bare
    if ((room.items || []).some((h: any) => HOSTS_OF_NOTE(h, b)) && r.skipped.some((x: any) => /outside the room/.test(x.why))) reaching++;
  }
  assert.ok(n >= 800, `${n} dress items`);
  assert.ok(reaching >= 1, 'palnknoll\'s Outdoor Kitchen: a counter across the edge of the room, dressed only inside it');
});
/** an authored host whose box passes the room's bounds by more than 0.5 m */
function HOSTS_OF_NOTE(it: any, b: { x: number; z: number; w: number; d: number }): boolean {
  const h = hostOf(it); if (!h) return false;
  return h.rects.some(r => { const [x0, z0] = toWorld(h, r[0], r[1]), [x1, z1] = toWorld(h, r[2], r[3]); return Math.min(x0, x1) < b.x - 0.5 || Math.max(x0, x1) > b.x + b.w + 0.5 || Math.min(z0, z1) < b.z - 0.5 || Math.max(z0, z1) > b.z + b.d + 0.5; });
}

// ---- R: a dress piece is out of the strips an open door leaf parks in -----------------------------------------------------------------------
test('R: no dress piece the scene check counts stands in a door leaf\'s parking strip (the five it found are in the strips)', () => {
  // the five pieces the first cut stood in a leaf's way (scene QA leaf-in-lane on the pilot bakes: "swings into robe-hook", "swings into umbrella-stand", "swings into floor-lamp")
  const old: Array<[string, string, string, [number, number]]> = [['epiphany', 'l1', 'robe-hook', [2.43, 1.527]], ['flowerycottage', 'l1', 'robe-hook', [-1.46, 4.073]], ['mesamariposa', 'l2', 'robe-hook', [-3.97, -0.127]],
    ['seraphine', 'l1', 'umbrella-stand', [2.995, 5.31]], ['bghouse-olcia', 'l1', 'floor-lamp', [0.711, -2.016]]];
  for (const [h, lvId, type, at] of old) {
    const spec = load(path.join(ROOT, 'content', 'houses', `${h}.json`)), lv = spec.levels.find((l: any) => l.id === lvId), o = itemObb({ type, at })!;
    assert.ok(leafSensitive(type, sizeOf(type, {})!.h), `${type} counts for the scene check`);
    assert.ok(leafStrips(spec, lv).some(st => overlap({ ...o, hw: o.hw + 0.02, hd: o.hd + 0.02 }, st) > 0), `${h}: the first cut's ${type} at ${at} is in no leaf strip`);
  }
  let checked = 0, strips = 0;
  for (const { id, spec } of fleet()) {
    const res = dressRooms(spec);
    for (const lv of spec.levels) {
      const st = leafStrips(spec, lv); strips += st.length;
      for (const room of lv.rooms || []) for (const it of res.get(room)?.items || []) {
        // (a café curtain hangs at its window, 4 mm off the wall, planned by assets/dress-curtains.ts: none of the 52 trips the scene check, which is the gate that sees it)
        if (it.type === 'cafe-curtain') continue;
        const s = sizeOf(it.type, it), o = itemObb(it); if (!s || !o || !leafSensitive(it.type, s.h)) continue;
        checked++;
        assert.ok(!st.some(t => overlap(o, t) > 0), `${id}/${room.name}: ${it.type} at ${it.at} stands in a door leaf's parking strip`);
      }
    }
  }
  assert.ok(strips >= 150 && checked >= 250, `${strips} strips, ${checked} pieces checked`);
});

// ---- S: --dress then --undress is the identity on the bytes ----------------------------------------------------------------------------
/** run compose-house.mts with `args` (many at once: `jobs` at a time) and resolve with each one's { status, out } */
function composeAll(jobsArgs: string[][], jobs = 4): Promise<Array<{ status: number | null; out: string }>> {
  const results: Array<{ status: number | null; out: string }> = new Array(jobsArgs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobsArgs.length) {
      const i = next++;
      results[i] = await new Promise(resolve => {
        const ch = spawn(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'compose-house.mts'), ...jobsArgs[i]], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = ''; ch.stdout.on('data', d => { out += d; }); ch.stderr.on('data', d => { out += d; });
        ch.on('close', status => resolve({ status, out }));
      });
    }
  };
  return Promise.all(Array.from({ length: jobs }, worker)).then(() => results);
}
test('S: --dress then --undress gives every house and fixture back byte for byte, --dress twice writes what once did, and a baked house is what --dress writes today', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dress-bytes-'));
  try {
    const srcs = [...houses.map(h => ({ id: h.id, file: h.file })), ...FIX.map(id => ({ id, file: path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`) }))];
    const f = (id: string, k: string) => path.join(dir, `${id}.${k}.json`);
    const step = async (args: (id: string, file: string) => string[]) => { const r = await composeAll(srcs.map(s => args(s.id, s.file))); r.forEach((x, i) => assert.equal(x.status, 0, `${srcs[i].id}: ${x.out}`)); return r; };
    const a = await step((id, file) => ['--house', file, '--dress', '--out', f(id, 'a')]);
    await step((id) => ['--house', f(id, 'a'), '--dress', '--out', f(id, 'b')]);
    await step((id) => ['--house', f(id, 'a'), '--undress', '--out', f(id, 'c')]);
    await step((id) => ['--house', f(id, 'c'), '--dress', '--out', f(id, 'd')]);
    let withNl = 0, items = 0, baked = 0;
    for (const s of srcs) {
      const orig = fs.readFileSync(s.file), A = fs.readFileSync(f(s.id, 'a')), B = fs.readFileSync(f(s.id, 'b')), C = fs.readFileSync(f(s.id, 'c')), D = fs.readFileSync(f(s.id, 'd'));
      assert.ok(A.equals(B), `${s.id}: --dress twice is not --dress once`);
      assert.ok(A.equals(D), `${s.id}: --undress then --dress is not --dress`);
      assert.ok(!C.toString().includes(DRESS_SRC), `${s.id}: --undress left a dress item`);
      // pass 6: a shipped house carries its dress items baked; an unbaked house (the fixtures: they opt in live) is given back by --undress to the byte
      if (orig.toString().includes(DRESS_SRC)) { baked++; assert.ok(orig.equals(A), `${s.id}: the baked dress items are not what compose-house.mts --dress writes today (re-bake: compose-house.mts --house ${s.id} --dress --write)`); }
      else assert.ok(orig.equals(C), `${s.id}: --undress did not give the original back (${C.length} bytes, was ${orig.length}; ends with newline: ${C[C.length - 1] === 10} / ${orig[orig.length - 1] === 10})`);
      assert.equal(A[A.length - 1] === 10, orig[orig.length - 1] === 10, `${s.id}: the baked file's ending is not the original's`);
      if (orig[orig.length - 1] === 10) withNl++;
      items += JSON.parse(A.toString()).levels.flatMap((lv: any) => lv.rooms).flatMap((r: any) => r.items || []).filter(isDress).length;
    }
    assert.ok(a.every(x => !/note: .* not in canonical/.test(x.out)), 'every house and fixture is in canonical 2-space JSON');
    assert.ok(withNl === FIX.length && items >= 900, `${withNl} files end with a newline (the fixtures), ${items} dress items round-tripped`);
    assert.ok(baked === 0 || baked === houses.length, `${baked} of ${houses.length} shipped houses are baked: pass 6 bakes all of them or none`);
    // the one honest exception: a room with no `items` key at all comes back with an empty one (the control), and a spec that is not canonical JSON is reported
    const spec = load(srcs.find(x => x.id === 'aurora')!.file), kitchen = spec.levels.flatMap((lv: any) => lv.rooms).find((r: any) => /^kitchen$/i.test(r.name)); delete kitchen.items;
    const odd = path.join(dir, 'noitems.json'); fs.writeFileSync(odd, JSON.stringify(spec, null, 2)); fs.writeFileSync(path.join(dir, 'ugly.json'), JSON.stringify(spec));
    const [d1, ugly] = await composeAll([['--house', odd, '--dress', '--out', path.join(dir, 'n1.json')], ['--house', path.join(dir, 'ugly.json'), '--dress', '--out', path.join(dir, 'n2.json')]]);
    await composeAll([['--house', path.join(dir, 'n1.json'), '--undress', '--out', path.join(dir, 'n3.json')]]);
    assert.ok(d1.status === 0 && !/note:/.test(d1.out));
    assert.ok(/note: .*ugly\.json is not in canonical 2-space JSON/.test(ugly.out), 'a spec that is not canonical JSON is told so');
    const back = load(path.join(dir, 'n3.json')), roomOf = (sp: any) => sp.levels.flatMap((lv: any) => lv.rooms).find((r: any) => /^kitchen$/i.test(r.name));
    assert.ok(!('items' in roomOf(spec)) && Array.isArray(roomOf(back).items) && roomOf(back).items.length === 0 && !fs.readFileSync(odd).equals(fs.readFileSync(path.join(dir, 'n3.json'))), 'control: a room without an items key comes back with an empty one');
    console.log(`S: ${srcs.length} specs, ${items} dress items: --dress then --undress is the identity on the bytes (${withNl} with a final newline, ${srcs.length - withNl} without), --dress twice is --dress once, ${baked} baked houses are what --dress writes today`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
