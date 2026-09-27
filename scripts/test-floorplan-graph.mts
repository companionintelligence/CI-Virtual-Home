#!/usr/bin/env -S node --experimental-strip-types
// Tests for assets/floorplan-graph.js (+ the wall compiler under the vendored three.js).
// Usage: pnpm run test      (node --experimental-strip-types --test scripts/test-floorplan-graph.mts; needs `pnpm run build` first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FloorplanGraph, DEFAULT_WALL_THICKNESS, polygonContains, signedArea } from '../assets/floorplan-graph.js';
import { perimeterEdges, edgeForOpening } from '../assets/house-geometry.js';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createWallCompiler, applyCutaway, wallFaces, CUTAWAY_HEIGHT, DOWN_HEIGHT } from '../assets/wall-compiler.js';

const here = import.meta.dirname;
const housesDir = path.join(here, '..', 'content', 'houses');
const near = (a: number, b: number, tol = 1e-6, msg?: string) => assert.ok(Math.abs(a - b) <= tol, msg || `expected ${a} ≈ ${b} (±${tol})`);
const T = DEFAULT_WALL_THICKNESS;

// ---------------------------------------------------------------------------------------
// Room detection
// ---------------------------------------------------------------------------------------
test('rectangle with one partition → 2 rooms', () => {
  const g = FloorplanGraph.fromFootprint([{ x: -6, z: -4, w: 12, d: 8 }], [{ from: [-2, -4], to: [-2, 4], door: 1.5, doorW: 0.9 }]);
  assert.equal(g.rooms.length, 2);
  assert.equal(g.corners.length, 6, 'partition ends split the N and S walls');
  assert.equal(g.walls.length, 7);
  const areas = g.rooms.map(r => r.area()).sort((a, b) => a - b);
  near(areas[0], 4 * 8); near(areas[1], 8 * 8);
  const partition = g.walls.find(w => w.kind === 'partition');
  assert.equal(partition.rooms().length, 2, 'the partition has a room on both sides');
  assert.equal(partition.openings.length, 1);
  assert.equal(partition.openings[0].kind, 'door');
  near(partition.openings[0].at, 1.5 / 8);
  assert.ok(g.walls.filter(w => w.kind === 'exterior').every(w => w.rooms().length === 1), 'perimeter walls have exactly one room');
});

test('L-shape → 1 room', () => {
  const g = FloorplanGraph.fromFootprint([{ x: -6, z: -4, w: 12, d: 8 }, { x: 6, z: 0, w: 4, d: 4 }]);
  assert.equal(g.rooms.length, 1);
  assert.equal(g.rooms[0].corners.length, 6);
  near(g.rooms[0].area(), 12 * 8 + 4 * 4);
  assert.equal(g.walls.length, 6);
  assert.ok(g.walls.every(w => !w.orphan));
});

test('dangling partition stays an orphan and does not break detection', () => {
  const g = FloorplanGraph.fromFootprint([{ x: 0, z: 0, w: 10, d: 8 }], [{ from: [4, 0], to: [4, 3], door: null }]);
  assert.equal(g.rooms.length, 1);
  const dangling = g.walls.find(w => w.kind === 'partition');
  assert.ok(dangling.orphan);
  assert.equal(dangling.rooms().length, 0);
  assert.equal(g.corners.filter(c => c.degree() === 1).length, 1);
});

test('island partition box → inner room wins roomAt()', () => {
  const g = FloorplanGraph.fromFootprint([{ x: 0, z: 0, w: 10, d: 8 }],
    [{ from: [2, 2], to: [5, 2] }, { from: [5, 2], to: [5, 5] }, { from: [5, 5], to: [2, 5] }, { from: [2, 5], to: [2, 2] }],
    { rooms: [{ no: '01', name: 'Bath', bounds: { x: 2, z: 2, w: 3, d: 3 } }, { no: '02', name: 'Hall', bounds: { x: 0, z: 0, w: 10, d: 2 } }] });
  assert.equal(g.rooms.length, 2);
  assert.equal(g.roomAt(3.5, 3.5).name, 'Bath');
  assert.equal(g.roomAt(1, 1).name, 'Hall');
});

// ---------------------------------------------------------------------------------------
// Mitred offsets
// ---------------------------------------------------------------------------------------
test('mitred corner offsets are symmetric about the corner (square room)', () => {
  const g = FloorplanGraph.fromFootprint([{ x: 0, z: 0, w: 10, d: 10 }]);
  const room = g.rooms[0];
  const poly = room.polygon();
  for (const e of room.edges()) {
    const c = e.getStart();
    const i = e.interiorStart(), x = e.exteriorStart();
    near((i.x + x.x) / 2, c.x, 1e-9, 'interior/exterior straddle the corner in x');
    near((i.z + x.z) / 2, c.z, 1e-9, 'interior/exterior straddle the corner in z');
    near(Math.hypot(i.x - c.x, i.z - c.z), (T / 2) / Math.sin(Math.PI / 4), 1e-9, '90° mitre length = offset / sin(45°)');
    near(Math.abs(i.x - c.x), T / 2, 1e-9); near(Math.abs(i.z - c.z), T / 2, 1e-9);
    assert.ok(polygonContains(poly, i.x, i.z), 'interior point lies inside the room');
    assert.ok(!polygonContains(poly, x.x, x.z), 'exterior point lies outside the room');
    // the interior end of this edge is the interior start of the next → watertight
    const ie = e.interiorEnd(), ni = e.next.interiorStart();
    near(ie.x, ni.x, 1e-9); near(ie.z, ni.z, 1e-9);
    near(e.interiorDistance(), 10 - T, 1e-9); near(e.exteriorDistance(), 10 + T, 1e-9);
  }
  assert.ok(signedArea(room.corners) > 0, 'rooms keep the non-clockwise orientation');
});

test('a 45° wall pair produces correct interior/exterior lengths', () => {
  // square with the NW corner chamfered: (0,0) (10,0) (10,10) (5,10) (0,5)
  const g = new FloorplanGraph();
  const pts = [[0, 0], [10, 0], [10, 10], [5, 10], [0, 5]].map(([x, z]) => g.newCorner(x, z));
  for (let i = 0; i < pts.length; i++) g.newWall(pts[i], pts[(i + 1) % pts.length], { thickness: T, height: 2.8 });
  g.update();
  assert.equal(g.rooms.length, 1);
  const room = g.rooms[0];
  const half = T / 2;
  const at90 = half / Math.tan(Math.PI / 4), at135 = half / Math.tan((135 * Math.PI / 180) / 2);
  const byLen = e => e.wall.length();
  const edges = room.edges();
  const diag = edges.find(e => Math.abs(byLen(e) - 5 * Math.SQRT2) < 1e-6);
  const short = edges.filter(e => Math.abs(byLen(e) - 5) < 1e-6);
  const long = edges.filter(e => Math.abs(byLen(e) - 10) < 1e-6);
  assert.ok(diag && short.length === 2 && long.length === 2);
  // diagonal: 135° at both ends
  near(diag.interiorDistance(), 5 * Math.SQRT2 - 2 * at135, 1e-9);
  near(diag.exteriorDistance(), 5 * Math.SQRT2 + 2 * at135, 1e-9);
  // the two 5 m walls: one 90° end, one 135° end
  for (const e of short) { near(e.interiorDistance(), 5 - at90 - at135, 1e-9); near(e.exteriorDistance(), 5 + at90 + at135, 1e-9); }
  // the two 10 m walls: 90° at both ends
  for (const e of long) { near(e.interiorDistance(), 10 - 2 * at90, 1e-9); near(e.exteriorDistance(), 10 + 2 * at90, 1e-9); }
  // the mitred faces stay parallel to their walls at the right offset, and the interior polygon is watertight
  const poly = room.polygon();
  for (const e of edges) {
    const [dx, dz] = e.wall.direction();
    const [i0, i1] = e.interior();
    near(Math.abs((i1[0] - i0[0]) * dz - (i1[1] - i0[1]) * dx), 0, 1e-9, 'interior face parallel to the wall');
    const c = e.getStart();
    near(Math.abs((i0[0] - c.x) * dz - (i0[1] - c.z) * dx), half, 1e-9, 'interior face offset = thickness/2');
    assert.ok(polygonContains(poly, i0[0], i0[1]));
    const ie = e.interiorEnd(), ni = e.next.interiorStart();
    near(ie.x, ni.x, 1e-9); near(ie.z, ni.z, 1e-9);
  }
});

test('orphan walls get square ends at ±thickness/2', () => {
  const g = new FloorplanGraph();
  const a = g.newCorner(0, 0), b = g.newCorner(4, 0);
  g.newWall(a, b, { thickness: 0.2 });
  g.update();
  const w = g.walls[0];
  assert.ok(w.orphan && w.frontEdge && w.backEdge);
  const [i0, i1] = w.frontEdge.interior(), [x0, x1] = w.frontEdge.exterior();
  near(i0[0], 0, 1e-9); near(i1[0], 4, 1e-9); near(x0[0], 0, 1e-9); near(x1[0], 4, 1e-9);
  near(Math.abs(i0[1]), 0.1, 1e-9); near(Math.abs(x0[1]), 0.1, 1e-9); near(i0[1], -x0[1], 1e-9);
});

// ---------------------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------------------
test('JSON round-trip preserves corners, walls, openings and room labels', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(housesDir, 'aurora.json'), 'utf8'));
  const g = FloorplanGraph.fromLevel(spec.levels[0], { entry: spec.entry });
  const json = g.toJSON();
  const text = JSON.stringify(json);
  const g2 = FloorplanGraph.fromJSON(JSON.parse(text));
  assert.deepEqual(g2.toJSON(), json);
  assert.equal(g2.rooms.length, g.rooms.length);
  assert.deepEqual(g2.rooms.map(r => r.name).sort(), g.rooms.map(r => r.name).sort());
  assert.equal(g2.walls.reduce((n, w) => n + w.openings.length, 0), g.walls.reduce((n, w) => n + w.openings.length, 0));
  assert.ok(g2.walls.some(w => w.openings.some(o => o.entry)), 'entry flag survives');
  // and the faces come back identical
  for (const [w1, w2] of g.walls.map((w, i) => [w, g2.walls[i]])) {
    const f1 = wallFaces(w1), f2 = wallFaces(w2);
    assert.deepEqual(f1.faceA.map(p => p.map(v => +v.toFixed(6))), f2.faceA.map(p => p.map(v => +v.toFixed(6))));
  }
  // ids are stable and the counters continue past loaded ids
  assert.equal(g2.walls[0].id, g.walls[0].id);
  const c = g2.newCorner(99, 99);
  assert.ok(!json.corners[c.id], 'new ids do not collide with loaded ones');
});

// ---------------------------------------------------------------------------------------
// Every shipped HouseSpec converts
// ---------------------------------------------------------------------------------------
test('every HouseSpec level converts; rooms ≥ 1 and ≤ authored; every opening placed', () => {
  const files = fs.readdirSync(housesDir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json'));
  assert.ok(files.length >= 30, `expected the 30 houses, found ${files.length}`);
  for (const f of files) {
    const spec = JSON.parse(fs.readFileSync(path.join(housesDir, f), 'utf8'));
    for (const lv of spec.levels) {
      const g = FloorplanGraph.fromLevel(lv, { entry: spec.entry });
      const label = `${spec.id}/${lv.id}`;
      const indoor = g.rooms.filter(r => !r.outdoor);
      assert.ok(indoor.length >= 1, `${label}: no room detected`);
      assert.ok(indoor.length <= (lv.rooms || []).length, `${label}: more rooms than authored (${indoor.length} > ${(lv.rooms || []).length})`);
      for (const r of g.rooms) assert.ok(signedArea(r.corners) > 0, `${label}: room ${r.id} orientation`);
      const edges = perimeterEdges(lv.footprint);
      const expected = (lv.openings || []).filter(op => edgeForOpening(edges, op.side, op.at)).length
        + (lv.partitions || []).filter(p => p.door !== null && p.door !== undefined).length;
      const placed = g.walls.reduce((n, w) => n + w.openings.length, 0);
      assert.ok(placed >= expected, `${label}: ${placed} openings placed, ${expected} authored`);
      for (const w of g.walls) for (const o of w.openings) assert.ok(o.at > 0 && o.at < 1, `${label}: opening off the wall`);
      if (spec.entry.level === lv.id) assert.ok(g.walls.some(w => w.openings.some(o => o.entry)), `${label}: entry door not flagged`);
    }
  }
});

// ---------------------------------------------------------------------------------------
// Wall compiler (vendored three.js runs headless under Node)
// ---------------------------------------------------------------------------------------
test('wall compiler: one mesh per wall, holes cut, openings placed, facings right', () => {
  const g = FloorplanGraph.fromFootprint([{ x: -6, z: -4, w: 12, d: 8 }], [{ from: [-2, -4], to: [-2, 4], door: 1.5, doorW: 0.9 }], {
    height: 2.8,
    openings: [{ side: 'S', at: 2, type: 'door', w: 1.0, h: 2.1, style: 'entry' }, { side: 'N', at: -4, type: 'window', w: 1.4, h: 1.3, sill: 0.9 }],
    entry: { side: 'S', at: 2 }
  });
  const wc = createWallCompiler({ THREE });
  const out = wc.compileGraph(g, { baseY: 3 });
  assert.equal(out.meshes.length, g.walls.length);
  assert.ok(out.meshes.every(m => m.isMesh && m.geometry.attributes.position.count % 3 === 0));
  assert.ok(out.meshes.every(m => m.position.y === 3 && m.userData.isWall && m.userData.orientationExplicit));
  const facings = out.walls.map(w => w.facing);
  assert.deepEqual([...new Set(facings)].sort(), ['east', 'north', 'partition', 'south', 'west']);
  assert.equal(facings.filter(f => f === 'partition').length, 1);
  // triangle winding matches the stored normals everywhere
  for (const m of out.meshes) {
    const p = m.geometry.attributes.position, n = m.geometry.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i + 1) - p.getX(i), ay = p.getY(i + 1) - p.getY(i), az = p.getZ(i + 1) - p.getZ(i);
      const bx = p.getX(i + 2) - p.getX(i), by = p.getY(i + 2) - p.getY(i), bz = p.getZ(i + 2) - p.getZ(i);
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      assert.ok(cx * n.getX(i) + cy * n.getY(i) + cz * n.getZ(i) > 0, `${m.name}: winding vs normal`);
    }
    const bb = m.geometry.boundingBox;
    near(bb.min.y, 0, 1e-6); near(bb.max.y, 2.8, 1e-6);
  }
  // the exterior solid spans the exterior face (L + t) — mitred, not square, ends
  const west = out.walls.find(w => w.facing === 'west');
  const bb = west.mesh.geometry.boundingBox;
  near(bb.max.z - bb.min.z, 8 + DEFAULT_WALL_THICKNESS, 1e-6, 'exterior face is the long mitred one');
  near(bb.max.x - bb.min.x, DEFAULT_WALL_THICKNESS, 1e-6);
  // openings
  assert.equal(out.openings.length, 3);
  const entry = out.openings.find(o => o.entry);
  assert.equal(entry.kind, 'door');
  near(entry.worldRect.x, 2, 1e-6); near(entry.worldRect.z, 4, 1e-6); near(entry.worldRect.y, 3, 1e-6);
  near(entry.worldRect.w, 1.0, 1e-6); near(entry.worldRect.h, 2.1, 1e-6);
  near(entry.worldRect.rotationY, 0, 1e-6, 'south wall unit faces +Z');
  const win = out.openings.find(o => o.kind === 'window');
  near(win.worldRect.x, -4, 1e-6); near(win.worldRect.z, -4, 1e-6); near(win.worldRect.sill, 0.9, 1e-6);
  near(Math.abs(win.worldRect.rotationY), Math.PI, 1e-6, 'north wall unit faces −Z');
  const door = out.openings.find(o => o.kind === 'door' && !o.entry);
  near(door.worldRect.x, -2, 1e-6); near(door.worldRect.z, -4 + 1.5, 1e-6);
  // a window is a through-hole: more triangles than a plain wall of the same kind
  const plain = out.walls.find(w => w.facing === 'east');
  const withWindow = out.walls.find(w => w.facing === 'north' && w.holes.length);
  assert.ok(withWindow, 'the window landed on a north wall');
  assert.ok(withWindow.mesh.geometry.attributes.position.count > plain.mesh.geometry.attributes.position.count);
  // compileHalfEdge (raw blueprint3d pattern) agrees with compileWall on a perimeter wall
  const he = wc.compileHalfEdge(plain.wall.frontEdge || plain.wall.backEdge);
  assert.equal(he.facing, 'east');
  assert.equal(he.mesh.geometry.attributes.position.count, plain.mesh.geometry.attributes.position.count);
  // the THREE.Shape is exposed
  const { shape } = wc.wallShape(...[wallFaces(g.walls[0]).faceA, wallFaces(g.walls[0]).faceB], 2.8, []);
  assert.ok(shape instanceof THREE.Shape && shape.getPoints().length >= 4);
  // floors
  const floor = wc.compileRoomFloor(g.rooms[0], { baseY: 3 });
  assert.ok(floor.isMesh); near(floor.position.y, 3.002, 1e-6);
});

test('applyCutaway: clipping planes per mode, S/E + partitions only in cutaway, clipShadows on', () => {
  const g = FloorplanGraph.fromFootprint([{ x: 0, z: 0, w: 8, d: 6 }], [{ from: [4, 0], to: [4, 6] }]);
  const out = createWallCompiler({ THREE }).compileGraph(g, { baseY: 2.8 });
  const by = f => out.walls.find(w => w.facing === f).mesh;
  for (const m of out.meshes) applyCutaway(m, 'cutaway');
  for (const f of ['south', 'east', 'partition']) {
    const m = by(f);
    assert.equal(m.material.clippingPlanes.length, 1, `${f} is clipped`);
    const p = m.material.clippingPlanes[0];
    assert.deepEqual(p.normal.toArray(), [0, -1, 0]);
    near(p.constant, 2.8 + CUTAWAY_HEIGHT, 1e-9);
    assert.ok(p.distanceToPoint(new THREE.Vector3(1, 2.8 + 0.5, 1)) > 0, 'below the cut is kept');
    assert.ok(p.distanceToPoint(new THREE.Vector3(1, 2.8 + 1.5, 1)) < 0, 'above the cut is clipped');
    assert.equal(m.material.clipShadows, true);
  }
  for (const f of ['north', 'west']) assert.equal(by(f).material.clippingPlanes, null, `${f} untouched`);
  for (const m of out.meshes) applyCutaway(m, 'down');
  for (const m of out.meshes) near(m.material.clippingPlanes[0].constant, 2.8 + DOWN_HEIGHT, 1e-9);
  for (const m of out.meshes) applyCutaway(m, 'up');
  assert.ok(out.meshes.every(m => m.material.clippingPlanes === null));
  // aliases + bad mode
  applyCutaway(by('south'), 'plan'); near(by('south').material.clippingPlanes[0].constant, 2.8 + DOWN_HEIGHT, 1e-9);
  applyCutaway(by('south'), 'full'); assert.equal(by('south').material.clippingPlanes, null);
  assert.throws(() => applyCutaway(by('south'), 'sideways'));
  // non-compiler meshes are ignored
  const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  assert.equal(applyCutaway(other, 'cutaway'), other);
  assert.equal(other.material.clippingPlanes, null);
});
