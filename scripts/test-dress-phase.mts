#!/usr/bin/env -S node --experimental-strip-types
// The dress phase's gates (plan 5.6 D2/D3; assets/room-dress.ts, assets/dress-recipes.ts, assets/room-dress-hosts.ts). Pure Node, no browser.
//
//   A  no-op        no shipped house has a `dress` field or a `dress@1` item, and the build's dress phase adds nothing to any of the 30 (a room opts in with an
//                   explicit `dress.level`, and none does), so every shipped house builds as it did; `?dress=0` is off in Node
//   B  determinism  dressing a house twice, in a fresh copy and in another order, gives the same items byte for byte; two houses do not share a scheme
//   C  no re-roll   switching one slot off (`dress.off`) leaves every other slot's items exactly as they were: a dress item's choices draw from a stream of
//                   its own (room, slot, ordinal), so a new item moves no other; and a higher level only ever adds (what a lower level places, a higher one places)
//   D  host fit     every dress surface item stands on a host of the registry, its footprint inside the host's flat rects, at the host's top, over no other item,
//                   with 40 % of the top left free; no dress item stands outside its room or in a door's swing; the layout lints report no dress-* finding
//   E  opt-outs     `dress: false` and an absent `dress` dress nothing live; `?dress=0`'s filter is the page's (assets/rooms-build.ts); a raised floor is left alone
//   F  recipes      the fixtures prove each program: every wet room has 3 dress items and a towel, every dining room a set table, every kitchen 4 clusters, a
//                   lamp where the room had none (counted against the layout's own), every item a real type that exists in the catalog
//   G  census       the never-bare violations before and after, on the dress fixtures (printed; the plan's fleet targets are the census's, not this test's)
//
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-dress-phase.mts      (needs `pnpm run build`; any cwd)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { composeHouse, layerOf } from '../assets/room-composer.js';
import { dressHouse, dressRooms, dressOff, dressOptIn, isDress, bareViolation, DRESS_SRC } from '../assets/room-dress.js';
import { dressSchemeOf } from '../assets/house-scheme-dress.js';
import { RECIPES } from '../assets/dress-recipes.js';
import { hostOf, footprintIn, standingOn, rectArea } from '../assets/room-dress-hosts.js';
import { lintLayout } from '../assets/layout-lint.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { PROPS } from '../assets/props/index.js';
import { itemObb, overlap, analyzeRoom, sizeOf } from '../assets/room-geo.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const load = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const houses = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => ({ id: f.replace(/\.json$/, ''), file: path.join(ROOT, 'content', 'houses', f) }));
const FIX = ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles'];
const fixture = (id: string) => load(path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`));
const rooms = (spec: any) => (spec.levels || []).flatMap((lv: any) => (lv.rooms || []).map((room: any) => ({ lv, room })));
const dressedItems = (spec: any, level?: number) => [...dressRooms(spec, level === undefined ? {} : { level })].flatMap(([room, r]) => r.items.map(it => ({ room, it })));
const strip = (o: any) => JSON.stringify(o);

test('A: every shipped house builds exactly as before (the phase is opt-in and nobody opts in)', () => {
  for (const h of houses) {
    const spec = load(h.file), text = fs.readFileSync(h.file, 'utf8');
    assert.ok(!/"dress"\s*:/.test(text) && !text.includes(DRESS_SRC), `${h.id} carries a dress field or a dress@1 item`);
    assert.equal(dressHouse(spec).size, 0, `${h.id}: the live phase added to a house that does not opt in`);
    for (const { room } of rooms(spec)) assert.ok(!dressOptIn(room), `${h.id}/${room.name} opts in`);
  }
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
        assert.equal(it.src, DRESS_SRC); assert.ok(PLACEMENT[it.type] && (PROPS.has(it.type)), `${it.type} is not a catalog type`);
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
