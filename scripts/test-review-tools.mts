#!/usr/bin/env -S node --experimental-strip-types
// The review rig's own unit tests (plan 5.1, RIG): the parts of scripts/review/ that are pure Node, so they can run in `check:quick`
// and in CI without a GPU, a browser, ffmpeg or the built assets. What they pin is what the rig's numbers are worth:
//   cameras     a camera is a pure function of a room's bounds; R24 covers the nine audited homes and every room kind the plan names; the
//               twelve cost cameras are the same twice and never read a room's items; the mannequin is 1.70 m
//   luma        the metric definitions on images whose answers are known (flat, halves, a ramp, seeded noise)
//   ab          the blind generator: same seed same plan, different seed another, neither side is always the AFTER
//   manifest    the committed before.manifest.json is well formed, covers R24, and was taken from the frozen tag's product code
//   census      the frustum test and the blank-span cut on a hand-built room
//   stableJson  key order is not the writer's
// The browser tools (capture, cost, build-neutrality, prop-drift) are proved by running them: see the RIG notes.
//
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-review-tools.mts        (pure Node, ~1 s)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cornerCam, costCameras, R24, r24Shots, MANNEQUIN, mannequinTop, EYE, FOV, type CostRoom } from './review/cameras.mts';
import { lumaMetrics } from './review/luma.mts';
import { planPairs } from './review/ab.mts';
import { diffManifests, type Manifest } from './review/manifest.mts';
import { stableJson, mulberry32, fnv1a, productFingerprint, git, BASELINES, BEFORE_TAG, PRODUCT_PATHS } from './review/lib.mts';
import { inFrustum } from './dress-census.mts';

const REPO = path.resolve(import.meta.dirname, '..');

test('cameras: the corner view is the audit capture.mts formula, to the millimetre', () => {
  // aurora Living: bounds from the spec, camera by hand from the audit's capture.mts
  const b = { x: 2, z: -3.5, w: 8, d: 7 }, m = Math.min(0.55, Math.min(b.w, b.d) * 0.2);
  const nw = cornerCam(b, 0, 'NW'), se = cornerCam(b, 3, 'SE');
  assert.deepEqual(nw.pos, [2 + m, EYE, -3.5 + m]);
  assert.deepEqual(nw.target, [2 + 8 * 0.75, EYE - 0.45, -3.5 + 7 * 0.75]);
  assert.deepEqual(se.pos, [2 + 8 - m, 3 + EYE, -3.5 + 7 - m]);
  assert.deepEqual(se.target, [2 + 8 * 0.25, 3 + EYE - 0.45, -3.5 + 7 * 0.25]);
  assert.equal(nw.fov, FOV);
  // a narrow room insets by 20 % of its short side, not 0.55
  assert.equal(cornerCam({ x: 0, z: 0, w: 2, d: 5 }, 0, 'NW').pos[0], 0.4);
  // a pure function: no state between calls
  assert.deepEqual(cornerCam(b, 0, 'NW'), cornerCam(b, 0, 'NW'));
});

test('R24: 24 rooms, the nine audited homes, every kind the plan names, five bench rooms, unique ids', () => {
  assert.equal(R24.length, 24);
  assert.equal(new Set(R24.map(r => r.id)).size, 24);
  assert.deepEqual([...new Set(R24.map(r => r.house))].sort(), ['aurora', 'cutestarter', 'lakecabin', 'mediterranean', 'mesamariposa', 'neweco', 'riverbend', 'seraphine', 'vanilla']);
  const kinds = new Set(R24.map(r => r.kind));
  for (const k of ['living', 'bedroom', 'kitchen', 'dining', 'bath', 'hall', 'foyer', 'kids', 'garage', 'laundry']) assert.ok(kinds.has(k), `kind ${k}`);
  assert.equal(R24.filter(r => r.kind === 'bedroom' || r.kind === 'kids').length, 6, 'the six bedrooms of G-BED');
  assert.equal(R24.filter(r => r.bench).length, 5);
  const shots = r24Shots();
  // 24 rooms x 2 corners at day, 5 bench rooms x 2 corners x (dusk, night), 24 scale frames
  assert.equal(shots.filter(s => s.kind === 'eye' && s.tod === 'day').length, 48);
  assert.equal(shots.filter(s => s.kind === 'eye' && s.tod !== 'day').length, 20);
  assert.equal(shots.filter(s => s.kind === 'scale').length, 24);
  assert.equal(new Set(shots.map(s => s.id)).size, shots.length);
  assert.equal(new Set(shots.map(s => s.file)).size, shots.length);
});

test('cost cameras: twelve, deterministic, a function of rooms and not of their items', () => {
  const mk = (n: number): CostRoom[] => Array.from({ length: n }, (_, i) => ({ level: i % 2 ? 'l2' : 'l1', y: i % 2 ? 2.8 : 0, name: `Room ${i}`, program: ['living', 'kitchen', 'bed-primary', 'bath', 'hall', 'dining', 'garage', 'laundry'][i % 8], b: { x: i * 4, z: 0, w: 3 + (i % 3), d: 4 + (i % 4) } }));
  const rooms = mk(20), a = costCameras(rooms), b = costCameras(JSON.parse(JSON.stringify(rooms)));
  assert.equal(a.length, 12);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(c => c.key)).size, 12);
  assert.ok(a.slice(0, 8).every((c, i, l) => l.findIndex(x => x.program === c.program) === i), 'the first round has one room of each program');
  // a house with five eligible rooms still gets twelve eyes: NW then SE views of the first rooms
  const few = costCameras(mk(5));
  assert.equal(few.length, 10, 'five rooms: five NW and five SE, never invented rooms');
  // outdoor and tiny rooms are not cameras
  assert.equal(costCameras([{ level: 'l1', y: 0, name: 'Porch', program: 'outdoor', b: { x: 0, z: 0, w: 6, d: 6 } }, { level: 'l1', y: 0, name: 'Closet', program: 'living', b: { x: 0, z: 0, w: 1, d: 1 } }]).length, 0);
});

test('mannequin: 1.70 m to the crown, built of primitives', () => {
  assert.ok(Math.abs(mannequinTop(MANNEQUIN) - 1.7) < 0.01, `top ${mannequinTop(MANNEQUIN)}`);
  assert.ok(MANNEQUIN.every(p => ['cyl', 'sphere', 'box'].includes(p.shape)));
});

test('luma metrics on images with known answers', () => {
  const W = 64, H = 48, mk = (f: (x: number, y: number) => number) => { const a = new Uint8Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); a.set([v, v, v], (y * W + x) * 3); } return a; };
  const flat = lumaMetrics(mk(() => 128), W, H);
  assert.ok(Math.abs(flat.mean - 128 / 255) < 1e-6 && Math.abs(flat.p50 - 128 / 255) < 1e-6);
  assert.equal(flat.clip, 0); assert.equal(flat.crush, 0); assert.ok(flat.range < 1e-6); assert.ok(flat.cont < 1e-6);
  // left half black, right half white: 50 % crushed, 50 % clipped, ceiling band is half and half, block contrast zero away from the seam (the seam is on a block edge)
  const halves = lumaMetrics(mk(x => (x < W / 2 ? 0 : 255)), W, H);
  assert.equal(halves.clip, 50); assert.equal(halves.crush, 50); assert.ok(Math.abs(halves.ceil - 0.5) < 1e-6); assert.ok(halves.cont < 1e-6);
  // a vertical ramp: the ceiling band (top 12 % of rows) is the darkest; range is p95 - p5 of a uniform ramp, about 0.9 of its span
  const ramp = lumaMetrics(mk((_, y) => Math.round(255 * y / (H - 1))), W, H);
  assert.ok(ramp.ceil < 0.1, `ceil ${ramp.ceil}`); assert.ok(Math.abs(ramp.range - 0.9) < 0.03, `range ${ramp.range}`);
  // a checkerboard of 8-pixel blocks has no contrast inside a block, a one-pixel checkerboard has the most
  const big = lumaMetrics(mk((x, y) => ((x >> 3) + (y >> 3)) % 2 ? 255 : 0), W, H), fine = lumaMetrics(mk((x, y) => (x + y) % 2 ? 255 : 0), W, H);
  assert.ok(big.cont < 1e-6 && fine.cont > 0.45, `cont ${big.cont} ${fine.cont}`);
  // luma weights: pure green is brighter than pure red is brighter than pure blue
  const px = (r: number, g: number, b: number) => { const a = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) a.set([r, g, b], i * 3); return lumaMetrics(a, W, H).mean; };
  assert.ok(Math.abs(px(255, 0, 0) - 0.2126) < 1e-6 && Math.abs(px(0, 255, 0) - 0.7152) < 1e-6 && Math.abs(px(0, 0, 255) - 0.0722) < 1e-6);
  // seeded noise: the same bytes give the same metrics
  const r = mulberry32(7), noise = mk(() => Math.floor(r() * 256)), r2 = mulberry32(7), noise2 = mk(() => Math.floor(r2() * 256));
  assert.deepEqual(lumaMetrics(noise, W, H), lumaMetrics(noise2, W, H));
});

test('A/B plan: seeded, balanced, order not the room order', () => {
  const frames = R24.map(r => `${r.id}/NW/day`);
  const a = planPairs(frames, 'seed-1', 24), b = planPairs(frames, 'seed-1', 24), c = planPairs(frames, 'seed-2', 24);
  assert.deepEqual(a, b, 'same seed, same plan');
  assert.notDeepEqual(a, c, 'another seed, another plan');
  assert.equal(new Set(a.map(p => p.frame)).size, 24, 'each frame once');
  const afterA = a.filter(p => p.afterSide === 'A').length;
  assert.ok(afterA >= 10 && afterA <= 14, `AFTER is A in ${afterA} of 24: a reviewer who always picks one letter must not score`);
  assert.notDeepEqual(a.map(p => p.frame), frames, 'position tells the reviewer nothing');
  // a subset: the pilot's 15
  const pilot = planPairs(frames, 'pilot', 15);
  assert.equal(pilot.length, 15);
  assert.ok(pilot.filter(p => p.afterSide === 'A').length <= 8 && pilot.filter(p => p.afterSide === 'B').length <= 8);
});

test('manifest diff names what moved', () => {
  const mk = (h: string, cam = 1): Manifest => ({ schema: 1, set: 'x', tag: 't', product: { rev: 'r', tree: {} }, renderer: {} as any, shots: [{ id: 'a/NW/day', sha256: h, camera: { pos: [cam, 0, 0] } } as any, { id: 'b/NW/day', sha256: 'z', camera: { pos: [0, 0, 0] } } as any] });
  assert.equal(diffManifests(mk('h'), mk('h')).same, true);
  const d = diffManifests(mk('h'), mk('g'));
  assert.deepEqual(d.moved, ['a/NW/day']); assert.equal(d.same, false);
  assert.deepEqual(diffManifests(mk('h'), mk('h', 2)).camera, ['a/NW/day']);
});

test('the committed BEFORE manifest is whole, covers R24, and was taken from the frozen product code', () => {
  const file = path.join(BASELINES, 'before.manifest.json');
  if (!fs.existsSync(file)) return;   // (the capture lands in its own commit; this guards a checkout that predates it)
  const m: Manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(m.schema, 1); assert.equal(m.set, 'before'); assert.equal(m.tag, BEFORE_TAG);
  const want = r24Shots();
  assert.deepEqual(m.shots.map(s => s.id).sort(), want.filter(w => m.shots.some(s => s.id === w.id)).map(w => w.id).sort());
  const eye = m.shots.filter(s => s.kind === 'eye');
  assert.equal(eye.length, 68, 'every eye frame of R24: 48 day + 10 dusk + 10 night');
  assert.ok(m.shots.filter(s => s.kind === 'scale').length >= 20, 'the scale frames (a room with no free floor in view has none)');
  for (const s of m.shots) {
    assert.match(s.sha256, /^[0-9a-f]{64}$/, s.id);
    assert.equal(s.res, '1280x720');
    assert.ok(s.camera.pos.every(Number.isFinite) && s.camera.target.every(Number.isFinite), s.id);
    assert.equal(s.camera.eye, EYE); assert.equal(s.camera.fov, FOV);
  }
  assert.equal(m.renderer.profile, 'macos-metal'); assert.equal(m.renderer.supersample, 2);
  // the product code behind it is the frozen tag's: every path a frame depends on has the tag's tree id (skipped where the tag is not fetched)
  let tagTrees: Record<string, string> | null = null;
  try { tagTrees = Object.fromEntries(PRODUCT_PATHS.map(p => [p, git(['rev-parse', `${BEFORE_TAG}:${p}`], REPO)])); } catch { /* shallow clone: no tag */ }
  if (tagTrees) for (const p of PRODUCT_PATHS) assert.equal(m.product.tree[p], tagTrees[p], `product path ${p} differs from ${BEFORE_TAG}`);
});

test('the metrics baseline belongs to the manifest', () => {
  const mf = path.join(BASELINES, 'before.manifest.json'), lf = path.join(BASELINES, 'before.metrics.json');
  if (!fs.existsSync(mf) || !fs.existsSync(lf)) return;
  const m: Manifest = JSON.parse(fs.readFileSync(mf, 'utf8')), l = JSON.parse(fs.readFileSync(lf, 'utf8'));
  assert.deepEqual(Object.keys(l.frames).sort(), m.shots.filter(s => s.kind === 'eye').map(s => s.id).sort());
  for (const v of Object.values<any>(l.frames)) { assert.ok(v.clip >= 0 && v.clip <= 100 && v.crush >= 0 && v.crush <= 100 && v.mean >= 0 && v.mean <= 1 && v.range >= 0); }
});

test('frustum test: a box in front is in, behind or far to the side is out', () => {
  const cam = cornerCam({ x: 0, z: 0, w: 10, d: 10 }, 0, 'NW');   // eye near (0.55, 1.5, 0.55) looking at the far quarter, toward +x +z
  const at = (x: number, z: number, y0 = 0, y1 = 1) => ({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0, y1 });
  assert.equal(inFrustum(cam, at(7, 7)), true, 'ahead');
  assert.equal(inFrustum(cam, at(-3, -3)), false, 'behind');
  assert.equal(inFrustum(cam, at(-5, 6)), false, 'a right angle to the side of the view axis');
});

test('stableJson: keys sorted at every depth, same bytes whatever the insertion order', () => {
  assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), stableJson({ a: { c: 3, d: 2 }, b: 1 }));
  assert.ok(stableJson({ b: 1, a: 2 }).indexOf('"a"') < stableJson({ b: 1, a: 2 }).indexOf('"b"'));
  assert.equal(fnv1a('x'), fnv1a('x')); assert.notEqual(fnv1a('x'), fnv1a('y'));
  assert.equal(typeof productFingerprint, 'function');
});
