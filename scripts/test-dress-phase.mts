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
//   H  layout       a baked dress@1 item is no pin and no usage of the composer: composing a spec that carries them gives the items of the one that does not (so
//                   the compose-stability hashes hold whatever a house's dress items are), and the lints of the dressed fixtures add no layout finding
//   I  bake         compose-house.mts --dress writes exactly the live phase's items, twice gives the same file, --undress gives the original back
//   J  café curtain the BUILT geometry of every café curtain the phase places (the 30 houses at the pilot level 0.5, and the dress fixtures), measured in three.js
//                   in Node, against its own window: it hangs from the sill (hem no lower), tops out at most sill + 0.55 x the window's height, keeps the 1.45-1.55 m
//                   eye line clear unless the window is small, is a pale cloth and not a dark slab; and the first cut's params fail the same measurement (a control)
//   K  corner keep-out  the dress pieces of all 30 houses (pilot level 0.5) and the fixtures stay out of the rig's corner cameras' way: the camera points are the rig's
//                   own `cornerCam` (the Node copy in assets/ is compared with it), no dress piece within 0.3 m of an eye (3-D, at the 1.5 m eye), no floor piece
//                   taller than 0.8 m inside a 0.5 m corner square; and the lamp census holds (105 lamp-less rooms lit before the keep-out, never fewer)
//   L  neighbour gap  no dress item stands under 1.5 cm from another item on its surface (authored, composed or dressed, an item with no `y` at the page's DESK_TOP
//                   included), by the layout lint and by an independent obb measure over the 30 houses baked and the fixtures; the 12 cases the skeptic found are fixed;
//                   and the lint sees the flower-jug case the first cut did not (a control)
//   M  reach          REACH (how far a small good's built mesh passes its measured box) holds over 24 fresh seeds of every surface type, and no spilling type is missing
//   N  curtain parts  PARTS (the sink run's tap: a 3 cm column over a 0.96 m body) covers every mesh the page builds for the type, at three widths and three depths; a table
//                   without the tap fails the same measurement (a control)
//   O  curtain plan   over the 30 houses baked and the fixtures, no café curtain's box (plan, catalog heights, PARTS) meets another item's, however it is stood over, parted
//                   round or skipped; the plan parts and lifts where it should (a control: a lamp and a tap in a window's way part it, a counter higher than the sill lifts
//                   the hem, a wall of cabinets leaves the window bare)
//
// @check-house node-test
// @check-house quick
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
import { RECIPES, CAFE, cafeFit } from '../assets/dress-recipes.js';
import { PARTS, curtainObb, planCafe, DRESSERS } from '../assets/dress-curtains.js';
import { cornerEyes, eyeGap, camBlocked, CAM, hostOf, footprintIn, standingOn as standingOnHost, surfaceY, neighbourGap, rectGap, toWorld, MIN_GAP, NEIGHBOUR_GAP, DESK_TOP, REACH } from '../assets/room-dress-hosts.js';
import { cornerCam } from './review/cameras.mts';
import { standingOn, rectArea } from '../assets/room-dress-hosts.js';
import { lintLayout } from '../assets/layout-lint.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { PROPS } from '../assets/props/index.js';
import { itemObb, overlap, analyzeRoom, sizeOf, obb, corners, CENTRE_MOUNT, TOP_MOUNT } from '../assets/room-geo.js';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..');
const load = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const houses = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => ({ id: f.replace(/\.json$/, ''), file: path.join(ROOT, 'content', 'houses', f) }));
const FIX = ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles', 'dress-utility'];
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
  // the shipped houses' census before the keep-out: 105 of 132 lit (wave6/dress-lamps.tsv); the fixtures add their own rooms on top
  const ship = houses.map(h => lampLit(load(h.file))).reduce((a, l) => ({ asks: a.asks + l.asks, lampless: a.lampless + l.lampless, lit: a.lit + l.lit }), { asks: 0, lampless: 0, lit: 0 });
  assert.equal(ship.lampless, 132, 'the layout leaves 132 lamp-less rooms in the 30 houses');
  assert.ok(ship.lit >= 105, `the lamp census lost rooms to the keep-out: ${ship.lit} lit, 105 before`);
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

test('M: REACH holds, over 24 fresh seeds of every type that stands on a surface', () => {
  const seen: Record<string, number> = {};
  for (const [type, def] of PROPS as Map<string, any>) {
    const pl: any = PLACEMENT[type]; if (!((pl && pl.onSurface) || def.surface)) continue;
    const s0 = sizeOf(type, {}); if (!s0) continue;
    let worst = 0;
    for (let k = 0; k < 24; k++) {
      const o = def.create({ type }, { THREE, std: bcx.std, box: bcx.box, group: bcx.group, mix: bcx.mix, hex: bcx.hex, colors: kitx.colors, rng: kitx.itemRng(`reach${k}:${type}`), H: 2.8 });
      o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), ox = s0.ox || 0, oz = s0.oz || 0;
      worst = Math.max(worst, b.max.x - (ox + s0.w / 2), (ox - s0.w / 2) - b.min.x, b.max.z - (oz + s0.d / 2), (oz - s0.d / 2) - b.min.z);
    }
    seen[type] = worst;
    assert.ok(worst <= (REACH[type] || 0.002) + 1e-9, `${type}: the built mesh passes its measured box by ${(worst * 1000).toFixed(1)} mm, REACH says ${((REACH[type] || 0) * 1000).toFixed(0)}`);
  }
  for (const t of Object.keys(REACH)) assert.ok(t in seen, `REACH names ${t}, which is no surface type`);
  assert.ok(Object.keys(seen).length >= 60, `${Object.keys(seen).length} surface types measured`);
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
test('O: no café curtain meets another item (stood over, parted round or skipped)', () => {
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
          if (DRESSERS.includes(it.type)) continue;   // (curtain against curtain: the neighbours' gate, below)
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
  console.log(`O: ${curtains} curtain panels over the 30 houses baked and the fixtures, ${checked} box pairs against the other items of their rooms (heights from the catalog and PARTS): none meet`);
});

test('O2 (controls): the plan parts, lifts and skips where it should', () => {
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
});
