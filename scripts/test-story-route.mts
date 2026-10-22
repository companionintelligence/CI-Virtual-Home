#!/usr/bin/env -S node --experimental-strip-types
// Tests for the story router's rescue ladder (assets/story/route.ts): pure Node, no GPU, no browser, no shipped house.
//   The planner's navigation grid (assets/shot-nav.ts) is a person's. It found six of the thirty homes "not connected for the camera" when they were: a doorway the digest draws as
//   the arch's bounding boxes (an underside 1.45 m over the floor, across the whole gap), a bed that is a 1.35 m hull across a narrow room, a spiral stair whose foot is the middle
//   of a blocked footprint, an entry on a plinth. Each is a tiny FIXTURE WORLD built here (so a re-lay of a shipped home cannot move the test), with the case that must now be a walk,
//   the case that must stay a cut (a wall with no door is never crossed), and the case that must not change at all (a walk the planner's grid already makes).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoseCtx } from '../assets/story/poses.js';
import { routeBetween, smoothRoute, walkGrid, crossesSolid, failed, MAX_ROUTE_M, ENTRY_STEP_M, PASS_OVER_M, type Standing, type Route } from '../assets/story/route.js';
import { K, type ShotWorld, type WLevel } from '../assets/shot-world.js';
import type { V3 } from '../assets/shot-probe.js';

type B = [number, number, number, number, number, number];
/** a fixture world: levels, wall/item boxes (x0 y0 z0 x1 y1 z1, a kind each), stairs, an entry */
function world(o: { levels: Array<Partial<WLevel> & { id: string; y: number; rects: WLevel['rects'] }>; boxes?: Array<[number, B]>; stairs?: ShotWorld['stairs']; entry?: ShotWorld['entry']; lot?: { w: number; d: number } }): ShotWorld {
  const boxes = o.boxes || [];
  return {
    v: 1, id: 'fixture', lot: o.lot || { w: 40, d: 40 }, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    levels: o.levels.map(l => ({ h: 3, voids: [], parts: [], rooms: [], openings: [], ...l })) as WLevel[],
    entry: o.entry || null, hero: null, stairs: o.stairs || [],
    boxes: boxes.flatMap(([, b]) => b), kinds: boxes.map(([k]) => k), names: boxes.map(([k]) => (k === K.wall ? 'Parametric Wall' : k === K.hull ? 'bed' : 'item')), colors: boxes.map(() => 0),
    obbs: [], paths: [], steps: [], showcase: [],
  };
}
const at = (x: number, y: number, z: number, level: string | null): Standing => ({ eye: [x, y, z] as V3, level });
const ctxOf = (w: ShotWorld) => createPoseCtx(w);
/** every vertex of a route is at least `d` from every box of `kinds` in plan, at the eye's height */
const clearOf = (w: ShotWorld, r: Route, d: number, skip: (i: number) => boolean = () => false) => {
  for (const p of r.pts) for (let n = 0; n < w.kinds.length; n++) {
    if (skip(n)) continue;
    const b = w.boxes.slice(6 * n, 6 * n + 6); if (p[1] < b[1] || p[1] > b[4]) continue;
    const dist = Math.hypot(Math.max(b[0] - p[0], 0, p[0] - b[3]), Math.max(b[2] - p[2], 0, p[2] - b[5]));
    if (dist < d) return false;
  }
  return true;
};

// ---- an arched doorway ----------------------------------------------------------------------------------------------------------------------------------
// two rooms 4 m x 6 m side by side, a partition at x = 0 with a 1.2 m doorway at z = 0. `arch` adds what the digest draws over a curved head: one box across the gap whose underside is
// 1.45 m up (the arch's bounding box); without it the gap is a plain opening with a lintel at 2.1 m.
function twoRooms(arch: boolean, door = true) {
  const jambs: Array<[number, B]> = door
    ? [[K.wall, [-0.07, 0, -3, 0.07, 3, -0.6]], [K.wall, [-0.07, 0, 0.6, 0.07, 3, 3]], [K.wall, arch ? [-0.07, 1.45, -0.6, 0.07, 2.6, 0.6] : [-0.07, 2.1, -0.6, 0.07, 3, 0.6]]]
    : [[K.wall, [-0.07, 0, -3, 0.07, 3, 3]]];
  return world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -3, w: 8, d: 6 }], parts: [{ a: [0, -3], b: [0, 3], door: door ? 3 : null, doorW: door ? 1.2 : 0.9, h: 3 }] }], boxes: jambs });
}

test('an arched doorway the digest closes with a bounding box is a walk, through the gap, with the jambs kept', () => {
  const w = twoRooms(true), ctx = ctxOf(w), a = at(-2, 1.55, -1.5, 'l1'), b = at(2, 1.55, 1.5, 'l1');
  // the case is real: the planner's grid has no way through
  assert.equal(ctx.nav.leg(ctx.nav.grid(ctx.nav.levelOf('l1')), [-2, -1.5], [2, 1.5], { snap: 1 }), null, 'fixture: the planner grid is shut at the arch');
  const r = routeBetween(ctx, a, b);
  assert.ok(!failed(r), `the walk exists: ${failed(r) ? r.reason : ''}`);
  if (failed(r)) return;
  assert.equal(r.rescued, 1, 'rung 1 (doorways opened) made it');
  assert.ok(r.length < 7.5, `a short walk, ${r.length.toFixed(1)} m`);
  const along: Array<[number, number]> = []; for (let i = 1; i < r.pts.length; i++) for (let k = 0; k <= 20; k++) along.push([r.pts[i - 1][0] + (r.pts[i][0] - r.pts[i - 1][0]) * k / 20, r.pts[i - 1][2] + (r.pts[i][2] - r.pts[i - 1][2]) * k / 20]);
  assert.ok(along.some(p => Math.abs(p[0]) < 0.1 && Math.abs(p[1]) < 0.45), 'it goes through the gap');
  assert.ok(clearOf(w, r, 0.3, n => w.boxes[6 * n + 1] > 1), 'and keeps 0.3 m from the jambs (the head boxes are not walls)');
  assert.ok(r.pts.every(p => Math.abs(p[1] - 1.55) < 1e-6), 'at the eye');
  const sm = smoothRoute(ctx, r), g = walkGrid(ctx, 'l1', r.rescued!);
  for (const p of sm.pts) assert.ok(ctx.nav.passableAt(g, p[0], p[2], 3), `the rounded corners stay on the grid it was walked on (${p[0].toFixed(2)}, ${p[2].toFixed(2)})`);
});

test('a doorway with a plain lintel is the planner\'s own walk: the ladder does not touch it', () => {
  const w = twoRooms(false), ctx = ctxOf(w), a = at(-2, 1.55, -1.5, 'l1'), b = at(2, 1.55, 1.5, 'l1');
  const r = routeBetween(ctx, a, b), direct = ctx.nav.leg(ctx.nav.grid(ctx.nav.levelOf('l1')), [-2, -1.5], [2, 1.5], { snap: 1 });
  assert.ok(!failed(r) && direct, 'a walk on the planner grid');
  if (failed(r) || !direct) return;
  assert.equal(r.rescued, undefined, 'not rescued');
  assert.deepEqual(r.pts.map(p => [p[0], p[2]]), direct.pts, 'the planner\'s polyline, vertex for vertex');
  assert.equal(r.length, direct.len);
});

test('a wall with no door is never crossed: the walk is a cut, whatever the ladder opens', () => {
  const w = twoRooms(true, false), ctx = ctxOf(w);
  const r = routeBetween(ctx, at(-2, 1.55, -1.5, 'l1'), at(2, 1.55, 1.5, 'l1'));
  assert.ok(failed(r), 'a sealed room is a cut');
  if (failed(r)) assert.match(r.reason, /no walkable leg on l1/);
  // a head-height strip with no doorway under it (a wall that stops 1.45 m up) is a wall: only the gaps of the plan's doorways are opened
  const w2 = world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -3, w: 8, d: 6 }], parts: [{ a: [0, -3], b: [0, 3], door: null, doorW: 0.9, h: 3 }] }], boxes: [[K.wall, [-0.07, 1.45, -3, 0.07, 2.6, 3]]] });
  assert.ok(failed(routeBetween(ctxOf(w2), at(-2, 1.55, -1.5, 'l1'), at(2, 1.55, 1.5, 'l1'))));
});

test('a long soffit over a whole wall is not the header of its doorway: the wall stays a wall', () => {
  // the doorway's jambs are floor to ceiling, and a continuous band from 1.45 m up runs the whole length of the partition (centred on the gap): not a header over THIS gap
  const w = world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -3, w: 8, d: 6 }], parts: [{ a: [0, -3], b: [0, 3], door: 3, doorW: 1.2, h: 3 }] }],
    boxes: [[K.wall, [-0.07, 0, -3, 0.07, 3, -0.6]], [K.wall, [-0.07, 0, 0.6, 0.07, 3, 3]], [K.wall, [-0.07, 1.45, -3, 0.07, 2.6, 3]]] });
  assert.ok(failed(routeBetween(ctxOf(w), at(-2, 1.55, -1.5, 'l1'), at(2, 1.55, 1.5, 'l1'))), 'a cut');
  // a head that comes down to 1.1 m, or a closed leaf, is not an arch either
  for (const head of [[-0.07, 1.1, -0.6, 0.07, 2.6, 0.6], [-0.07, 0, -0.6, 0.07, 2.1, 0.6]] as B[]) {
    const c = world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -3, w: 8, d: 6 }], parts: [{ a: [0, -3], b: [0, 3], door: 3, doorW: 1.2, h: 3 }] }],
      boxes: [[K.wall, [-0.07, 0, -3, 0.07, 3, -0.6]], [K.wall, [-0.07, 0, 0.6, 0.07, 3, 3]], [K.wall, head]] });
    assert.ok(failed(routeBetween(ctxOf(c), at(-2, 1.55, -1.5, 'l1'), at(2, 1.55, 1.5, 'l1'))), `a cut with a head from ${head[1]} to ${head[4]}`);
  }
});

test('the planner grid itself is never changed by the walker\'s', () => {
  const w = twoRooms(true), ctx = ctxOf(w), g0 = ctx.nav.grid(ctx.nav.levelOf('l1')), before = [g0.dW.slice(), g0.dI.slice(), g0.dS.slice(), g0.free.slice()];
  walkGrid(ctx, 'l1', 1); walkGrid(ctx, 'l1', 2); routeBetween(ctx, at(-2, 1.55, -1.5, 'l1'), at(2, 1.55, 1.5, 'l1'));
  assert.deepEqual([g0.dW, g0.dI, g0.dS, g0.free], before);
  assert.notEqual(walkGrid(ctx, 'l1', 1), g0);
  assert.equal(walkGrid(ctx, 'l1', 0), g0, 'rung 0 is the planner\'s grid');
  assert.equal(walkGrid(ctx, 'l1', 1), walkGrid(ctx, 'l1', 1), 'cached');
});

// ---- a bed across a narrow room ----------------------------------------------------------------------------------------------------------------------------
test('a bed hull across a narrow room is passed over by the eye (rung 2), a wardrobe is not', () => {
  const room = { id: 'l1', y: 0, rects: [{ x: -1.2, z: -4, w: 2.4, d: 8 }] };
  const bed = world({ levels: [room], boxes: [[K.hull, [-1.1, 0, -0.5, 1.1, 1.35, 0.5]]] }), ctx = ctxOf(bed);
  const a = at(0, 1.55, -3, 'l1'), b = at(0, 1.55, 3, 'l1');
  const r = routeBetween(ctx, a, b);
  assert.ok(!failed(r), `walks: ${failed(r) ? r.reason : ''}`);
  if (!failed(r)) { assert.equal(r.rescued, 2); assert.ok(r.pts.every(p => p[1] > 1.35 + 0.1), 'the eye is over the bed'); assert.ok(r.length < 7.5); }
  assert.ok(1.35 < PASS_OVER_M && PASS_OVER_M < 1.55);
  const wardrobe = world({ levels: [room], boxes: [[K.item, [-1.1, 0, -0.5, 1.1, 2.0, 0.5]]] });
  const w = routeBetween(ctxOf(wardrobe), a, b);
  assert.ok(failed(w), 'a 2 m wardrobe across the room is a wall');
});

// ---- a spiral stair -------------------------------------------------------------------------------------------------------------------------------------------------
function spiralHouse() {
  const stair = { from: 'l1', to: 'l2', type: 'spiral', bottom: [0, 0, 0] as V3, top: [0, 3, 0] as V3, dir: [0, 1] as [number, number], plan: { minX: -0.95, maxX: 0.95, minZ: -0.95, maxZ: 0.95 }, spiral: true, w: 1.1, spin: { a0: 1.5, sweep: -4.4 } };
  return world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -4, w: 8, d: 8 }] }, { id: 'l2', y: 3, rects: [{ x: -4, z: -4, w: 8, d: 8 }], voids: [{ x: -1.2, z: -1.2, w: 2.4, d: 2.4 }] }], stairs: [stair] });
}
test('a spiral stair is climbed as a helix round its column, on and off from clear floor', () => {
  const w = spiralHouse(), ctx = ctxOf(w);
  // the case is real: the foot is the middle of the blocked footprint
  assert.equal(ctx.nav.leg(ctx.nav.grid(ctx.nav.levelOf('l1')), [-3, -3], [0, 0], { snap: 1 }), null, 'fixture: no cell within a metre of the foot');
  const up = routeBetween(ctx, at(-3, 1.55, -3, 'l1'), at(3, 4.55, 3, 'l2'));
  assert.ok(!failed(up), `up: ${failed(up) ? up.reason : ''}`);
  if (failed(up)) return;
  assert.equal(up.rescued, 1);
  assert.ok(up.mode.includes('stair') && up.mode.includes('walk'));
  const col = (p: V3) => Math.hypot(p[0], p[2]);
  const helix = up.pts.filter((_, i) => up.mode[i] === 'stair' && up.pts[i][1] > 2.0 && up.pts[i][1] < 4.0);
  assert.ok(helix.length >= 8 && helix.every(p => col(p) > 0.5 && col(p) < 1.2), 'round the column, inside the void, not through it');
  // it climbs, never dips, and the eye is 1.55 over the tread under it
  for (let i = 1; i < up.pts.length; i++) if (up.mode[i] === 'stair' && up.mode[i - 1] === 'stair') assert.ok(up.pts[i][1] >= up.pts[i - 1][1] - 1e-9, 'no dip on the flight');
  assert.ok(up.pts.find((p, i) => up.mode[i] === 'stair')![1] < 2 && up.pts[up.pts.length - 1][1] > 4);
  assert.equal(up.levels[0], 'l1');
  // down is the same stair backwards
  const down = routeBetween(ctx, at(3, 4.55, 3, 'l2'), at(-3, 1.55, -3, 'l1'));
  assert.ok(!failed(down), `down: ${failed(down) ? down.reason : ''}`);
  if (!failed(down)) assert.ok(down.pts[down.pts.length - 1][1] < 2 && Math.hypot(down.pts[down.pts.length - 1][0] + 3, down.pts[down.pts.length - 1][2] + 3) < 0.5);
  // a straight flight is untouched by the ladder (the planner's grid walks it)
  const flight = world({ levels: [{ id: 'l1', y: 0, rects: [{ x: -4, z: -4, w: 8, d: 8 }] }, { id: 'l2', y: 3, rects: [{ x: -4, z: -4, w: 8, d: 8 }], voids: [{ x: 1, z: -1, w: 3, d: 1.4 }] }],
    stairs: [{ from: 'l1', to: 'l2', type: 'timber', bottom: [1, 0, 0] as V3, top: [3.6, 3, 0] as V3, dir: [1, 0], plan: { minX: 0.95, maxX: 3.7, minZ: -0.6, maxZ: 0.6 }, spiral: false, w: 1.1 }] });
  const s = routeBetween(ctxOf(flight), at(-3, 1.55, 0, 'l1'), at(-3, 4.55, 2, 'l2'));
  assert.ok(!failed(s) && s.rescued === undefined, 'a timber flight is walked on the planner\'s grid');
});

// ---- the entry ------------------------------------------------------------------------------------------------------------------------------------------------------
test('an entry on a plinth is walked as the planner walks it; an entry up a flight of steps is a cut', () => {
  const house = (y: number) => world({ levels: [{ id: 'l1', y, rects: [{ x: -4, z: -3, w: 8, d: 6 }] }], entry: { x: 0, y, z: 3, out: [0, 1], w: 1.2, level: 'l1', side: 'S' } });
  const inside = at(0, 0.45 + 1.55, 0, 'l1'), street = at(0, 1.7, 9, null);
  const r = routeBetween(ctxOf(house(0.45)), inside, street);
  assert.ok(!failed(r), `0.45 m: ${failed(r) ? r.reason : ''}`);
  if (!failed(r)) assert.equal(r.rescued, 1);
  const flat = routeBetween(ctxOf(house(0)), at(0, 1.55, 0, 'l1'), street);
  assert.ok(!failed(flat) && flat.rescued === undefined, 'a ground-level entry is the planner\'s grid\'s');
  const up = routeBetween(ctxOf(house(1.4)), at(0, 1.4 + 1.55, 0, 'l1'), street);
  assert.ok(failed(up) && up.reason === 'the entry is above the ground', 'above the planner\'s 0.9 m the steps are the planner\'s, not a walk');
  assert.ok(ENTRY_STEP_M === 0.9 && 0.9 < 1.4);
});

// ---- the ladder's contract ----------------------------------------------------------------------------------------------------------------------------------------
test('a walk over the cut length stays a cut with its length for a reason; the answer is deterministic', () => {
  const long = world({ levels: [{ id: 'l1', y: 0, rects: [{ x: 0, z: 0, w: 40, d: 3 }] }] });
  const r = routeBetween(ctxOf(long), at(1, 1.55, 1.5, 'l1'), at(39, 1.55, 1.5, 'l1'));
  assert.ok(failed(r) && /^route is \d+ m$/.test(r.reason), 'a 38 m walk is a cut, and says why');
  assert.equal(MAX_ROUTE_M, 24);
  const w = twoRooms(true), a = at(-2, 1.55, -1.5, 'l1'), b = at(2, 1.55, 1.5, 'l1');
  assert.equal(JSON.stringify(routeBetween(ctxOf(w), a, b)), JSON.stringify(routeBetween(ctxOf(twoRooms(true)), a, b)), 'the same inputs, the same bytes');
  // a sealed room says what is still in the way on the best grid
  const sealed = routeBetween(ctxOf(twoRooms(true, false)), a, b);
  assert.ok(failed(sealed) && /no walkable leg/.test(sealed.reason));
});

// ---- the planner's last hop -----------------------------------------------------------------------------------------------------------------------------------
// The planner's leg routes to the nearest passable cell when an end is not passable (a pose over a sofa: the first three tiers call the sofa blocked) and then walks to the true end in a straight
// line it never checked. Two rooms with an OPEN arched doorway (the digest starts the spandrels at the crown, 2.15 m: nothing at the eye) on x = -1.6, a sofa (top 1.0 m: soft) beyond it, and a
// plant (1.87 m: hard) in the way of the straight line from the doorway to the pose over the sofa. Kovacs' tv-steam, in small.
const hopWorld = () => world({
  levels: [{ id: 'l1', y: 0, rects: [{ x: -8, z: 0, w: 16, d: 10 }], parts: [{ a: [-1.6, 0], b: [-1.6, 10], door: 5.6, doorW: 1.4, h: 2.74 }] }],
  boxes: [[K.wall, [-1.68, 0, 0, -1.52, 2.74, 4.9]], [K.wall, [-1.68, 0, 6.3, -1.52, 2.74, 10]], [K.wall, [-1.68, 2.15, 4.9, -1.52, 2.74, 6.3]], [K.item, [-5.2, 0, 3.5, -2.4, 1.0, 5.2]], [K.item, [-2.44, 0, 4.04, -1.29, 1.87, 5.2]]],
});
const asRoute = (pts: Array<[number, number]>, level: string | null = 'l1', mode: 'walk' | 'stair' = 'walk'): Route => ({ ok: true, pts: pts.map(p => [p[0], 1.55, p[1]] as V3), length: 0, mode: pts.map(() => mode), levels: pts.map(() => level), tier: 0 });

test('a planner walk whose last hop goes through a hard piece of furniture is rescued, and reaches the pose over the sofa without touching the plant', () => {
  const w = hopWorld(), ctx = ctxOf(w), a = at(1, 1.55, 5.6, 'l1'), b = at(-3.6, 1.55, 4.6, 'l1');
  // the case is real: the pose is over the sofa (not passable at the comfortable tiers), and the planner's own leg is the straight line through the plant
  const g = ctx.nav.grid(ctx.nav.levelOf('l1'));
  assert.ok(!ctx.nav.passableAt(g, -3.6, 4.6, 0) && ctx.nav.passableAt(g, -3.6, 4.6, 3), 'fixture: the pose is over soft furniture');
  const own = ctx.nav.leg(g, [1, 5.6], [-3.6, 4.6], { snap: 1 });
  assert.ok(own && crossesSolid(ctx, asRoute(own.pts)), 'fixture: the planner\'s own leg runs through the plant');
  const r = routeBetween(ctx, a, b);
  assert.ok(!failed(r), `a walk: ${failed(r) ? r.reason : ''}`);
  if (failed(r)) return;
  assert.equal(r.rescued, 1, 'the ladder made it');
  assert.ok(!crossesSolid(ctx, r), 'and it touches nothing hard');
  assert.deepEqual([r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][2]], [-3.6, 4.6], 'it ends on the pose');
  const along: Array<[number, number]> = []; for (let i = 1; i < r.pts.length; i++) for (let k = 0; k <= 20; k++) along.push([r.pts[i - 1][0] + (r.pts[i][0] - r.pts[i - 1][0]) * k / 20, r.pts[i - 1][2] + (r.pts[i][2] - r.pts[i - 1][2]) * k / 20]);
  assert.ok(along.some(p => Math.abs(p[0] + 1.6) < 0.1 && p[1] > 4.9 && p[1] < 6.3), 'through the doorway');
});

test('a walk that touches nothing hard is the planner\'s, vertex for vertex; crossesSolid ignores grazes, flights and the lot', () => {
  // a pose beside the sofa on the other side of the room: the hop is clear
  const w = hopWorld(), ctx = ctxOf(w), a = at(1, 1.55, 7.5, 'l1'), b = at(-3.6, 1.55, 8, 'l1');
  const r = routeBetween(ctx, a, b), own = ctx.nav.leg(ctx.nav.grid(ctx.nav.levelOf('l1')), [1, 7.5], [-3.6, 8], { snap: 1 });
  assert.ok(!failed(r) && own && r.rescued === undefined, 'not rescued');
  if (!failed(r) && own) assert.deepEqual(r.pts.map(p => [p[0], p[2]]), own.pts, 'the planner\'s polyline');
  // 1 cm into the plant is a graze (the planner's own legs keep 0.2 m or more; this is for the straight hop), 5 cm is not
  assert.ok(!crossesSolid(ctx, asRoute([[-2.0, 5.211], [-1.0, 5.211]])), 'a 1 cm graze of the plant\'s edge is not a crossing');
  assert.ok(crossesSolid(ctx, asRoute([[-2.0, 5.15], [-1.0, 5.15]])), '5 cm in is');
  assert.ok(!crossesSolid(ctx, asRoute([[-2.0, 5.15], [-1.0, 5.15]], 'l1', 'stair')), 'a flight is not a walk');
  assert.ok(!crossesSolid(ctx, asRoute([[-2.0, 5.15], [-1.0, 5.15]], null)), 'nor is a walk on the lot (its own grid)');
  assert.ok(crossesSolid(ctx, asRoute([[-3, 2], [0, 2]])), 'a wall is hard too (x = -1.6, z 2: the south jamb)');
  assert.ok(!crossesSolid(ctx, asRoute([[-3, 5.6], [0, 5.6]])), 'the doorway is not (the spandrel starts at 2.15 m)');
});
