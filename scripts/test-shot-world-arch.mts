#!/usr/bin/env -S node --experimental-strip-types
// An arched doorway is open in the world digest (assets/shot-world.ts digestWorld, assets/features.ts `archRise`): pure Node, no GPU, no browser.
//   A partition with `style: 'arch'` fills the corners over each round-headed doorway with two ExtrudeGeometry spandrels. The digest boxes a mesh by its
//   axis-aligned box, and a spandrel's box reaches from the springline (1.45 to 1.65 m over the floor) across the whole gap: at the eye (1.55 m) the doorway was
//   a wall to the shot planner's grid, the XR walk grid and every sight line, in the four homes with arch partitions (onestory, bgfamily, mediterranean, corner-penthouse).
//   The spandrel's solid is above the crown, `r` over the springline, so features.ts tags each spandrel `userData.archRise = r` and the digest starts the box there.
//   A  the digest, with the real three.js: a tagged spandrel's box starts `r` higher, an untagged mesh's does not, and the planner's own grid then has the doorway
//      (it had not: the control run without the tag is shut)
//   B  the committed plans: in every home with an arch partition, no wall box stands in the doorway between the floor and 2.0 m (so a `pnpm run plans` made from a
//      digest without the tag fails here)
// Needs `pnpm run build` (it reads assets/**/*.js).
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-shot-world-arch.mts        (any cwd; a second or two)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { digestWorld, K, type ShotWorld } from '../assets/shot-world.js';
import { createPoseCtx } from '../assets/story/poses.js';

const ROOT = path.resolve(import.meta.dirname, '..');

// ---- A: the digest of a scene built the way features.ts builds an arch partition ----------------------------------------------------------------------------
// two rooms 8 m x 6 m side by side, a partition on x = 0 with a 1.2 m doorway centred on z = 0. features.ts: the hole is `d.height` = door height + 0.1 = 2.2 m
// tall and `w` = max(1.12, 1.2) wide; the springline is `height - w/2`, the corner pieces' outline touches the crown at `spring + r`, r = w/2 - 0.05.
const W = 1.2, HOLE = 2.2, SPRING = HOLE - W / 2, R = W / 2 - 0.05, HH = Math.min(W / 2, 2.74 - SPRING - 0.01);
function spandrels(tag: boolean): any[] {
  const left = new THREE.Shape(); left.moveTo(-W / 2, SPRING); left.lineTo(-W / 2, SPRING + HH); left.lineTo(0, SPRING + HH); left.lineTo(0, SPRING + R); left.absarc(0, SPRING, R, Math.PI / 2, Math.PI, false); left.lineTo(-W / 2, SPRING);
  const right = new THREE.Shape(); right.moveTo(W / 2, SPRING); right.lineTo(W / 2 - 0.05, SPRING); right.absarc(0, SPRING, R, 0, Math.PI / 2, false); right.lineTo(0, SPRING + HH); right.lineTo(W / 2, SPRING + HH); right.lineTo(W / 2, SPRING);
  return [left, right].map(sh => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false, curveSegments: 16 }), new THREE.MeshStandardMaterial({ color: 0xe8e4dc }));
    m.position.set(0, 0, -0.08); if (tag) m.userData.archRise = R; return m;
  });
}
function archWorld(tag: boolean): ShotWorld {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshStandardMaterial({ color: 0xe8e4dc })); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return m; };
  // the wall: the partition's group is turned a quarter so its local x runs along z (features.ts: `wall.rotation.y = Math.PI / 2` when the partition is not along x);
  // local x = -z, so the spandrel at local x < 0 is the one on the +z side. Jambs and the lintel over the 2.2 m hole are plain boxes.
  const full = new THREE.Group();
  full.add(box(-3, 0, -0.07, -W / 2, 2.74, 0.07), box(W / 2, 0, -0.07, 3, 2.74, 0.07), box(-W / 2, HOLE, -0.07, W / 2, 2.74, 0.07));
  for (const m of spandrels(tag)) full.add(m);
  const wall = new THREE.Group(); wall.name = 'Partition (arch, 6m)'; wall.add(full); wall.rotation.y = Math.PI / 2;
  wall.userData = { role: 'wall', isWall: true, partition: true, fullGroup: full };
  wall.updateMatrixWorld(true);
  const spec = { id: 'arch-fixture', lot: { w: 30, d: 24 }, levels: [{ id: 'l1', y: 0, height: 3, footprint: [{ x: -4, z: -3, w: 8, d: 6 }], partitions: [{ from: [0, -3], to: [0, 3], door: 3, doorW: W, style: 'arch' }], rooms: [], openings: [] }] };
  return digestWorld(THREE, spec, { stairs: [], doors: [], entry: null, bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 } }, [wall]);
}
const wallBoxes = (w: ShotWorld) => w.kinds.map((k, i) => ({ k, b: w.boxes.slice(6 * i, 6 * i + 6) })).filter(x => x.k === K.wall);
const throughGap = (b: number[]) => b[0] < 0.1 && b[3] > -0.1 && b[2] < 0.5 && b[5] > -0.5;   // a box that stands across the doorway's middle (the wall is on x = 0, the gap z -0.6 to 0.6)

test('A: a tagged spandrel\'s digest box starts at the crown, an untagged mesh\'s box is its whole axis-aligned box', () => {
  const open = wallBoxes(archWorld(true)), shut = wallBoxes(archWorld(false));
  const gapOpen = open.filter(x => throughGap(x.b)), gapShut = shut.filter(x => throughGap(x.b));
  // without the tag (the digest before): the two corner pieces' boxes underside is the springline, across the gap, at the eye
  const sp = gapShut.filter(x => x.b[4] <= HOLE + 1e-3 && x.b[1] > 1);
  assert.equal(sp.length, 2, 'fixture: two spandrel boxes');
  for (const x of sp) assert.ok(Math.abs(x.b[1] - SPRING) < 2e-3 && x.b[1] < 1.7, `untagged: the box starts at the springline, ${x.b[1]} m`);
  // with it: the same boxes, `r` higher, so the doorway is clear below the crown
  const sq = gapOpen.filter(x => x.b[4] <= HOLE + 1e-3 && x.b[1] > 1);
  assert.equal(sq.length, 2, 'two spandrel boxes');
  for (const x of sq) assert.ok(Math.abs(x.b[1] - (SPRING + R)) < 2e-3, `tagged: the box starts at the crown, ${x.b[1]} m (expected ${SPRING + R})`);
  for (const x of sq) assert.ok(Math.abs(x.b[4] - (SPRING + HH)) < 2e-3, 'the top and the sides are what they were');
  // nothing else moved: jambs and the lintel are the same boxes in both
  const rest = (l: typeof open) => JSON.stringify(l.filter(x => !(x.b[4] <= HOLE + 1e-3 && x.b[1] > 1)).map(x => x.b));
  assert.equal(rest(open), rest(shut), 'jambs and lintel unchanged');
  assert.ok(!gapOpen.some(x => x.b[1] < 2.0 && x.b[4] > 0.1), 'nothing in the gap under 2.0 m');
});

test('A: the planner\'s own grid has the doorway once the digest is made with the tag, and not without it (the control)', () => {
  const walk = (w: ShotWorld) => { const ctx = createPoseCtx(w); return ctx.nav.leg(ctx.nav.grid(ctx.nav.levelOf('l1')), [-2, -1.5], [2, 1.5], { snap: 1 }); };
  assert.equal(walk(archWorld(false)), null, 'control: the planner\'s grid is shut at the arch');
  const r = walk(archWorld(true));
  assert.ok(r, 'a walk from one room to the other');
  if (!r) return;
  assert.ok(r.len < 7.5, `a short one, ${r.len.toFixed(1)} m`);
  const along: Array<[number, number]> = [];   // (a polyline's vertices are its corners: sample the legs)
  for (let i = 1; i < r.pts.length; i++) for (let k = 0; k <= 20; k++) along.push([r.pts[i - 1][0] + (r.pts[i][0] - r.pts[i - 1][0]) * k / 20, r.pts[i - 1][1] + (r.pts[i][1] - r.pts[i - 1][1]) * k / 20]);
  assert.ok(along.some(p => Math.abs(p[0]) < 0.1 && Math.abs(p[1]) < 0.6), 'through the gap');
});

// ---- B: the committed plans ---------------------------------------------------------------------------------------------------------------------------------
const HOUSES = path.join(ROOT, 'content', 'houses');
const archHomes = fs.readdirSync(HOUSES).filter(f => f.endsWith('.json') && !f.endsWith('.plan.json') && f !== 'index.json').map(f => f.replace(/\.json$/, '')).filter(id => {
  const s = JSON.parse(fs.readFileSync(path.join(HOUSES, `${id}.json`), 'utf8'));
  return (s.levels || []).some((l: any) => (l.partitions || []).some((p: any) => p.style === 'arch' && p.door != null));
});

test('B: the homes with arch partitions are the four the digest was wrong for', () => {
  assert.deepEqual(archHomes.sort(), ['bgfamily', 'corner-penthouse', 'mediterranean', 'onestory'], 'a new home with an arch partition is covered by B below; update this list with it');
});

for (const id of archHomes) {
  test(`B: ${id}: no wall box stands in an arch partition's doorway under 2.0 m`, () => {
    const spec = JSON.parse(fs.readFileSync(path.join(HOUSES, `${id}.json`), 'utf8'));
    const world: ShotWorld = JSON.parse(fs.readFileSync(path.join(HOUSES, `${id}.plan.json`), 'utf8')).shots.world;
    let doorways = 0;
    for (const l of spec.levels) for (const p of l.partitions || []) {
      if (p.style !== 'arch' || p.door == null) continue;
      const dx = p.to[0] - p.from[0], dz = p.to[1] - p.from[1], len = Math.hypot(dx, dz), u = [dx / len, dz / len];
      const cx = p.from[0] + u[0] * p.door, cz = p.from[1] + u[1] * p.door, y0 = l.y || 0;
      doorways++;
      for (let i = 0; i < world.kinds.length; i++) {
        if (world.kinds[i] !== K.wall && world.kinds[i] !== K.glass && world.kinds[i] !== K.rail) continue;
        const b = world.boxes.slice(6 * i, 6 * i + 6);
        // the doorway's middle (a 0.5 m cross of its centre: clear of the jambs, which stand at +-0.5 m or more) and the band from the floor to 2.0 m
        const inPlan = b[0] <= cx + 0.25 && b[3] >= cx - 0.25 && b[2] <= cz + 0.25 && b[5] >= cz - 0.25;
        if (inPlan && b[1] < y0 + 2.0 && b[4] > y0 + 0.05) assert.fail(`${id} ${l.id}: a ${world.names[i]} box [${b.join(', ')}] stands in the doorway at (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
      }
    }
    assert.ok(doorways > 0, 'the home has an arch doorway');
  });
}
