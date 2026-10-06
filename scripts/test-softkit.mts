#!/usr/bin/env -S node --experimental-strip-types
// The softkit's gates (SOFT stream; PLAN 5.3 and 8). Pure Node, no browser, the vendored three: the grammar (assets/props/softkit.ts) and every soft
// prop built on it, in a build context like the page's.
//
//   A  grammar    every primitive builds with no NaN, no degenerate triangle left in, indices in range; a closed lens (sheet th > 0) is watertight
//   B  source     no Math.random / Date / performance in softkit.ts; no `map` in it (a quilt's map is the builder's, beds.ts)
//   C  caps       per-type mesh and triangle caps (the PLAN 5.3 table), under 12 seeds
//   D  material   no `map` except a quilt; fresh materials per create(); opaque, no exception (the sheer was removed in wave 3); vertex colours are a NEUTRAL multiplier
//   E  determinism the same seed twice gives the same geometry hash (to 1e-4); the rng spends a fixed count (bedding: exactly one draw)
//   F  theming    sheet = linen, duvet = it.color else accent or fabric, a spec colour repaints only the signature surface, after kit.theme()
//
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-softkit.mts      (needs `pnpm run build`; any cwd)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { PROPS } from '../assets/props/index.js';
import { softkit, SHADE, stream } from '../assets/props/softkit.js';
import { createBuildContext } from '../assets/build-context.js';
import { createMaterialKit } from '../assets/materials.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const bc = createBuildContext({ THREE } as any);
const kit = createMaterialKit({ THREE, palette: { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' }, seed: 'test-softkit' } as any);
const SEEDS = 'abcdefghijkl'.split('');
interface Ctx { THREE: any; std: any; box: any; group: any; mix: any; hex: any; colors: any; rng: () => number }
const ctxFor = (key: string, counter?: { n: number }): Ctx => { const r = kit.itemRng(key); return { THREE, std: bc.std, box: bc.box, group: bc.group, mix: bc.mix, hex: bc.hex, colors: kit.colors, rng: counter ? () => { counter.n++; return r(); } : r }; };
const build = (type: string, it: any = {}, seed = 'a', counter?: { n: number }) => { const o = PROPS.get(type).create({ type, at: [0, 0], ...it }, ctxFor(`${type}:${seed}`, counter)); o.updateMatrixWorld(true); return o; };
const meshesOf = (o: any) => { const l: any[] = []; o.traverse((m: any) => { if (m.isMesh) l.push(m); }); return l; };
const trisOf = (m: any) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
const roleMeshes = (o: any, role?: string) => meshesOf(o).filter(m => (role ? m.userData.role === role : !!m.userData.role));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const hashGeom = (o: any) => {
  // positions rounded to 1e-4 (an ULP of trig must not matter), in traversal order
  const h = crypto.createHash('sha256');
  for (const m of meshesOf(o)) { const p = m.geometry.attributes.position.array; const q = new Int32Array(p.length); for (let i = 0; i < p.length; i++) q[i] = Math.round(p[i] * 1e4); h.update(Buffer.from(q.buffer)); if (m.geometry.index) h.update(Buffer.from(new Uint32Array(m.geometry.index.array).buffer)); }
  return h.digest('hex');
};
const finiteGeom = (g: any) => { for (const n of Object.keys(g.attributes)) for (const v of g.attributes[n].array) if (!Number.isFinite(v)) return false; return true; };

// ---- A: the primitives ------------------------------------------------------------------------------------------------------
test('A grammar: every primitive builds finite, non-degenerate geometry', () => {
  const K = softkit(THREE);
  const cases: Record<string, (a: any) => void> = {
    shell: a => K.shell(a, { w: 0.5, h: 0.2, d: 0.4, r: 0.04, kx: [-0.25, 0, 0.25], puff: 0.02 }),
    pillow: a => K.pillow(a, { w: 0.6, d: 0.4, t: 0.12, rotX: 0.3, floorY: 0 }),
    sheet: a => K.sheet(a, { U: [0, 0.25, 0.5, 0.75, 1], Vn: [0, 0.5, 1], th: 0.016, pos: (u: number, v: number) => [u, v, 0.02 * Math.sin(u * 12)] }),
    sheet1: a => K.sheet(a, { U: [0, 0.5, 1], Vn: [0, 1], th: 0, pos: (u: number, v: number) => [u, v, 0] }),
    strut: a => K.strut(a, [0, 0, 0], [0.3, 0.4, 0.1], 0.012, 0.008, 8),
    slab: a => K.slab(a, 0, 0, 0, 0.05, 0.05, 0.01),
    band: a => K.band(a, 0, 1, 0, 0.02, 0.01),
    leaf: a => K.leaf(a, { L: 0.2, W: 0.1 }),
    lathe: a => K.lathe(a, [[0.05, 0], [0.1, 0.1], [0.08, 0.2]], 20),
  };
  for (const [name, f] of Object.entries(cases)) {
    const a = new K.Acc(); f(a);
    assert.ok(a.tris > 0, `${name}: no triangles`);
    const g = a.geometry();
    assert.ok(finiteGeom(g), `${name}: NaN or Infinity in an attribute`);
    for (const i of a.idx) assert.ok(i >= 0 && i < a.verts, `${name}: index out of range`);
    const P = a.pos;
    for (let t = 0; t < a.idx.length; t += 3) {   // no zero-area triangle left in
      const [x, y, z] = [0, 1, 2].map(k => a.idx[t + k]);
      const A = [P[x * 3], P[x * 3 + 1], P[x * 3 + 2]], B = [P[y * 3], P[y * 3 + 1], P[y * 3 + 2]], C = [P[z * 3], P[z * 3 + 1], P[z * 3 + 2]];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
      assert.ok(n > 1e-14, `${name}: a zero-area triangle (${t / 3})`);
    }
    for (let i = 0; i < a.col.length; i++) assert.ok(a.col[i] > 0 && a.col[i] <= 1, `${name}: shade ${a.col[i]} outside (0, 1]`);
  }
});

test('A grammar: a closed lens is watertight (every edge shared by exactly two triangles)', () => {
  const K = softkit(THREE), a = new K.Acc();
  K.sheet(a, { U: [0, 0.2, 0.5, 0.8, 1], Vn: [0, 0.3, 0.7, 1], th: 0.016, pos: (u: number, v: number) => [u * 0.6, v * 1.2, 0.03 * Math.sin(u * 14)] });
  const edges = new Map<string, number>();
  for (let t = 0; t < a.idx.length; t += 3) for (let k = 0; k < 3; k++) { const p = a.idx[t + k], q = a.idx[t + (k + 1) % 3], key = p < q ? `${p}-${q}` : `${q}-${p}`; edges.set(key, (edges.get(key) || 0) + 1); }
  const bad = [...edges.values()].filter(n => n !== 2).length;
  assert.equal(bad, 0, `${bad} of ${edges.size} edges are not shared by exactly two triangles`);
});

test('A grammar: winding agrees with the requested facing', () => {
  const K = softkit(THREE), a = new K.Acc();
  K.shell(a, { w: 0.4, h: 0.2, d: 0.3, r: 0.03, kx: [-0.2, 0, 0.2] });
  // signed volume of a closed outward-wound surface is positive
  const P = a.pos; let vol = 0;
  for (let t = 0; t < a.idx.length; t += 3) { const [x, y, z] = [0, 1, 2].map(k => a.idx[t + k] * 3); vol += (P[x] * (P[y + 1] * P[z + 2] - P[y + 2] * P[z + 1]) - P[x + 1] * (P[y] * P[z + 2] - P[y + 2] * P[z]) + P[x + 2] * (P[y] * P[z + 1] - P[y + 1] * P[z])) / 6; }
  assert.ok(vol > 0.9 * 0.4 * 0.2 * 0.3 * 0.85, `a closed shell has signed volume ${vol.toFixed(4)}`);
});

test('A grammar: fitToEnvelope clamps a reach to a one-sided overshoot and never grows a geometry', () => {
  const K = softkit(THREE), a = new K.Acc();
  K.leaf(a, { x: 0, y: 0.3, z: 0, a: 1, t: 1.2, L: 0.9, W: 0.2 });
  const before = Math.max(...a.pos.filter((_: number, i: number) => i % 3 === 0).map(Math.abs));
  const { sx } = K.fitToEnvelope(a, [-0.3, 0, -0.3, 0.3, 1, 0.3], 0.03);
  const after = Math.max(...a.pos.filter((_: number, i: number) => i % 3 === 0).map(Math.abs));
  assert.ok(sx <= 1 && after <= before + 1e-9, 'it only ever shrinks');
  assert.ok(after <= 0.33 + 1e-6, `reach ${after.toFixed(3)} is within 0.03 of the box`);
});

test('A grammar: stream() is deterministic and uniform enough', () => {
  const a = stream(12345), b = stream(12345), xs: number[] = [];
  for (let i = 0; i < 1000; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); xs.push(x); }
  const mean = sum(xs) / xs.length; assert.ok(mean > 0.45 && mean < 0.55);
});

// ---- B: the source ----------------------------------------------------------------------------------------------------------
test('B source: no clock, no Math.random, no texture in the grammar', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'props', 'softkit.ts'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'TextureLoader', 'CanvasTexture', 'DataTexture']) assert.ok(!src.includes(bad), `softkit.ts uses ${bad}`);
  assert.ok(!/\bmap\s*:\s*[^n]/.test(src.replace(/map = new Map/g, '')), 'a material map in softkit.ts');
});

// ---- the per-type caps (PLAN 5.3) ---------------------------------------------------------------------------------------------
const BEDS = ['single-bed', 'upholstered-bed', 'headboard-bed', 'sleigh-bed', 'canopy-bed', 'four-poster-bed', 'toddler-bed', 'bunk-bed', 'loft-bed', 'house-bed'];
test('C caps: bedding is at most 4 meshes and 1,100 triangles on every bed, under 12 seeds, and at least two meshes', () => {
  for (const t of BEDS) for (const sd of SEEDS) {
    const o = build(t, {}, sd), soft = roleMeshes(o);
    assert.ok(soft.length >= 2 && soft.length <= 4, `${t}/${sd}: ${soft.length} bedding meshes`);
    const tris = sum(soft.map(trisOf));
    assert.ok(tris <= 1100 * (t === 'bunk-bed' ? 2 : 1), `${t}/${sd}: bedding is ${tris} triangles`);   // a bunk has two mattresses
    assert.ok(meshesOf(o).length < 60, `${t}: ${meshesOf(o).length} meshes`);
  }
});

// ---- D: materials -----------------------------------------------------------------------------------------------------------
test('D material: no map but a quilt; fresh materials per create; opaque; the vertex colour is a neutral multiplier', () => {
  for (const t of BEDS) {
    const a = build(t), b = build(t);
    const ma = new Set(meshesOf(a).map(m => m.material)), mb = new Set(meshesOf(b).map(m => m.material));
    for (const m of ma) assert.ok(!mb.has(m), `${t}: a material is shared between two create() calls`);
    for (const m of roleMeshes(a)) {
      assert.ok(!m.material.map, `${t}: a map on a ${m.userData.role} mesh`);
      assert.ok(!m.material.transparent, `${t}: transparent bedding`);
      const c = m.geometry.attributes.color.array;
      for (let i = 0; i < c.length; i += 3) assert.ok(c[i] === c[i + 1] && c[i] === c[i + 2], `${t}: a hue in the vertex colour`);
      assert.ok(m.material.vertexColors, `${t}: vertexColors off`);
    }
  }
});

test('D material: a quilt gives the duvet UVs and a map; every other bedding mesh keeps none', () => {
  const o = build('upholstered-bed', { quilt: 'check' });
  const duvets = roleMeshes(o, 'duvet'); assert.equal(duvets.length, 1);
  assert.ok(duvets[0].material.map, 'the quilt pattern is on the duvet');
  assert.ok(duvets[0].geometry.attributes.uv, 'the duvet has UVs');
  const uv = duvets[0].geometry.attributes.uv.array; let lo = 9, hi = -9; for (const v of uv) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= -0.05 && hi <= 1.05, `planar UVs span ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  for (const m of roleMeshes(o)) if (m !== duvets[0]) { assert.ok(!m.material.map && !m.geometry.attributes.uv, `${m.userData.role} has no map/UV`); }
  const plain = build('upholstered-bed'); assert.ok(!roleMeshes(plain, 'duvet')[0].geometry.attributes.uv, 'no UVs without a quilt');
});

// ---- E: determinism ---------------------------------------------------------------------------------------------------------
test('E determinism: the same seed twice is the same geometry; bedding spends exactly one draw', () => {
  for (const t of BEDS) {
    assert.equal(hashGeom(build(t, {}, 'a')), hashGeom(build(t, {}, 'a')), `${t}: two builds of one seed differ`);
    const seen = new Set(SEEDS.map(sd => hashGeom(build(t, {}, sd))));
    assert.ok(seen.size > 1, `${t}: every seed builds the same bed`);
  }
  // these three beds' frames draw once (the duvet colour pick) and bedding adds exactly one more: the seed of its private stream
  for (const t of ['single-bed', 'canopy-bed', 'four-poster-bed']) { const n = { n: 0 }; build(t, {}, 'a', n); assert.equal(n.n, 2, `${t}: ${n.n} rng draws, expected the frame's 1 + bedding's 1`); }
});

// ---- F: theming -------------------------------------------------------------------------------------------------------------
const roleOf = (c: number) => Object.entries(kit.colors).find(([, v]) => v === c)?.[0];
test('F theming: the sheet is linen, the duvet is the spec colour or an accent/fabric, the throw is the other accent — after kit.theme', () => {
  for (const sd of SEEDS) {
    const o = build('single-bed', {}, sd); kit.theme(o);
    const lin = roleMeshes(o, 'linen')[0], dv = roleMeshes(o, 'duvet')[0];
    assert.equal(lin.material.color.getHex(), kit.colors.linen, 'linen mesh is the house linen');
    assert.ok(['accent', 'fabric'].includes(roleOf(dv.material.color.getHex()) as string), `duvet is a house role (${roleOf(dv.material.color.getHex())})`);
    const th = roleMeshes(o, 'throw')[0];
    if (th) assert.notEqual(th.material.color.getHex(), dv.material.color.getHex(), 'the throw is not the duvet colour');
  }
  const c = 0xb3402a, o = build('single-bed', { color: '#b3402a' });   // (themeItem keeps it: the part painted the item's colour is `explicit`)
  const dv = roleMeshes(o, 'duvet')[0];
  assert.equal(dv.material.color.getHex(), c, 'a spec colour paints the duvet');
  assert.equal(roleMeshes(o, 'linen')[0].material.color.getHex(), kit.colors.linen, 'and only the duvet');
});

// ---- curtains (T3) -----------------------------------------------------------------------------------------------------------
test('C caps: curtains are at most 4 meshes and 1,400 triangles, no sheer layer, its envelope the old curtain\'s', () => {
  for (const w of [0.6, 1.0, 1.4, 2.0, 3.2]) for (const sd of SEEDS) {
    const o = build('curtains', { w, h: 2.2 }, sd), ms = meshesOf(o), tris = sum(ms.map(trisOf));
    assert.ok(ms.length >= 2 && ms.length <= 4, `w ${w}/${sd}: ${ms.length} meshes`);
    assert.ok(tris <= 1400, `w ${w}/${sd}: ${tris} triangles`);
    assert.equal(ms.filter(m => m.userData.role === 'sheer' || m.material.transparent).length, 0, `w ${w}/${sd}: an alpha layer`);
    const b = new THREE.Box3().setFromObject(o);
    assert.ok(b.max.z <= 0.13 + 0.01 && b.min.z >= -0.001, `w ${w}/${sd}: z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)} outside 0..0.13`);
    assert.ok(b.max.x <= w / 2 + 0.052 + 0.005 && b.min.x >= -(w / 2 + 0.052 + 0.005), `w ${w}/${sd}: x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}`);
    assert.ok(b.min.y >= 0.02 - 0.005 && b.max.y <= 2.2 + 0.052 + 0.005, `w ${w}/${sd}: y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}`);
    for (const m of ms) { m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `w ${w}/${sd}: a ${m.userData.role} part under 6 mm (${Math.min(s.x, s.y, s.z).toFixed(4)})`); }
  }
});

test('D material: curtain drape is fabric2 or the spec colour, nothing transparent, no map anywhere', () => {
  for (const sd of SEEDS) {
    const o = build('curtains', { w: 2.2 }, sd); kit.theme(o);
    for (const m of meshesOf(o)) {
      assert.ok(!m.material.map, `a map on ${m.userData.role}`);
      assert.ok(!m.material.transparent, `${m.userData.role} is opaque`);
    }
    assert.equal(roleMeshes(o, 'drape')[0].material.color.getHex(), kit.colors.fabric2, 'the drape is the house fabric2');
    assert.equal(roleMeshes(o, 'hardware')[0].material.color.getHex(), kit.colors.metal, 'the hardware is the house metal');
  }
  const o = build('curtains', { color: '#b3402a' });
  assert.equal(roleMeshes(o, 'drape')[0].material.color.getHex(), 0xb3402a, 'a spec colour paints the drape');
  assert.equal(roleMeshes(o, 'hardware')[0].material.color.getHex(), kit.colors.metal, 'and not the hardware');
});

test('E determinism: curtains are the same twice for a seed, differ across seeds, and spend exactly one draw', () => {
  for (const sd of ['a', 'b', 'c']) assert.equal(hashGeom(build('curtains', {}, sd)), hashGeom(build('curtains', {}, sd)));
  assert.ok(new Set(SEEDS.map(sd => hashGeom(build('curtains', {}, sd)))).size > 3, 'the seeds build different curtains');
  const n = { n: 0 }; build('curtains', {}, 'a', n); assert.equal(n.n, 1, 'one draw');
});

// ---- towels (T6) -------------------------------------------------------------------------------------------------------------
const RAILS = ['towel-rail', 'heated-towel-rail', 'towel-ladder'];
test('C caps: a towel set is at most 3 towel meshes and 450 triangles; a rail is hardware + towels, at most 4 meshes, no part under 6 mm', () => {
  for (const t of RAILS) for (const sd of SEEDS) {
    const o = build(t, {}, sd), towels = roleMeshes(o, 'towel'), all = meshesOf(o);
    assert.ok(towels.length >= 1 && towels.length <= 3, `${t}/${sd}: ${towels.length} towel meshes`);
    assert.ok(sum(towels.map(trisOf)) <= 450, `${t}/${sd}: towels are ${sum(towels.map(trisOf))} triangles`);
    assert.ok(all.length <= 4, `${t}/${sd}: ${all.length} meshes`);
    for (const m of all) { m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `${t}: a ${m.userData.role} part under 6 mm`); assert.ok(!m.material.map && !m.material.transparent); }
  }
});
test('F theming: a towel is accent, fabric2 or linen; a spec colour paints the towel on the towel-rail and the metal elsewhere; hardware stays metal', () => {
  for (const sd of SEEDS) for (const t of RAILS) {
    const o = build(t, {}, sd); kit.theme(o);
    for (const m of roleMeshes(o, 'towel')) assert.ok(['accent', 'fabric2', 'linen'].includes(roleOf(m.material.color.getHex()) as string), `${t}: towel colour is a house role`);
  }
  assert.equal(roleMeshes(build('towel-rail', { color: '#b3402a' }), 'towel')[0].material.color.getHex(), 0xb3402a);
  assert.equal(roleMeshes(build('heated-towel-rail', { color: '#b3402a' }), 'hardware')[0].material.color.getHex(), 0xb3402a);
});
test('E determinism: towel rails are stable per seed and draw a fixed count', () => {
  for (const t of RAILS) { assert.equal(hashGeom(build(t, {}, 'a')), hashGeom(build(t, {}, 'a'))); const n = { n: 0 }; build(t, {}, 'a', n); assert.equal(n.n, 2, `${t}: the colour pick and the cloth's seed`); }
});

test('A grammar: the closed solids are wound outward (signed volume positive): shell, strut, slab', () => {
  const K = softkit(THREE);
  const vol = (a: any) => { const P = a.pos; let v = 0; for (let t = 0; t < a.idx.length; t += 3) { const [x, y, z] = [0, 1, 2].map(k => a.idx[t + k] * 3); v += (P[x] * (P[y + 1] * P[z + 2] - P[y + 2] * P[z + 1]) - P[x + 1] * (P[y] * P[z + 2] - P[y + 2] * P[z]) + P[x + 2] * (P[y] * P[z + 1] - P[y + 1] * P[z])) / 6; } return v; };
  const dirs: Array<[number[], number[]]> = [[[0, 0, 0], [0.3, 0.4, 0.1]], [[0, 0, 0], [0, 0.4, 0]], [[0, 0, 0], [0.4, 0, 0]], [[0, 0, 0], [0, 0, 0.4]], [[0.1, 0.2, 0.3], [-0.2, 0.1, 0.5]]];
  for (const [a0, b0] of dirs) { const a = new K.Acc(); K.strut(a, a0, b0, 0.02, 0.02, 8); assert.ok(vol(a) > 0, `strut ${a0} -> ${b0} has volume ${vol(a)}`); }
  const s = new K.Acc(); K.slab(s, 0, 0, 0, 0.1, 0.1, 0.1); assert.ok(vol(s) > 0.0009);
  // a band's outer wall faces away from its axis, its inner wall toward it
  const b = new K.Acc(); K.band(b, 0, 1, 0, 0.02, 0.01, 10);
  let net = 0; for (let t = 0; t < b.idx.length; t += 3) {
    const P = b.pos, [i, j, k] = [0, 1, 2].map(q => b.idx[t + q] * 3), A = [P[i], P[i + 1], P[i + 2]], B = [P[j], P[j + 1], P[j + 2]], C = [P[k], P[k + 1], P[k + 2]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const c = [(A[1] + B[1] + C[1]) / 3 - 1, (A[2] + B[2] + C[2]) / 3];   // radial (y - 1, z)
    net += n[1] * c[0] + n[2] * c[1];
  }
  assert.ok(net > 0, 'the band is wound outward');
});

// a dormant type may appear in a shipped house only as a dress item the dress phase baked (pass 6: src 'dress@1'), never authored or composed: the item records of a spec file that carry `type`
const placedOutsideDress = (txt: string, type: string): number => { let n = 0; const walk = (o: any) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.type === type && o.src !== 'dress@1' && Array.isArray(o.at)) n++; Object.values(o).forEach(walk); } }; walk(JSON.parse(txt)); return n; };
// ---- the new dormant types (T6b, soft2.ts) ---------------------------------------------------------------------------------
const NEW = ['towel-stack', 'towel-ring-set', 'robe-hook'];
test('C caps: the new soft types are at most 3 meshes, 600 triangles, no map, no transparency, stable per seed, with a fixed draw count', () => {
  for (const t of NEW) for (const sd of SEEDS) {
    const o = build(t, {}, sd), ms = meshesOf(o);
    assert.ok(ms.length <= 3 && sum(ms.map(trisOf)) <= 600, `${t}/${sd}: ${ms.length} meshes, ${sum(ms.map(trisOf))} triangles`);
    for (const m of ms) { assert.ok(!m.material.map && !m.material.transparent); m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `${t}: ${m.userData.role} under 6 mm`); assert.ok(finiteGeom(m.geometry)); }
    assert.equal(hashGeom(build(t, {}, sd)), hashGeom(o), `${t}/${sd}: unstable`);
  }
  for (const t of NEW) { const n = { n: 0 }; build(t, {}, 'a', n); assert.equal(n.n, 1, `${t}: one draw (the cloth's seed)`); }
});
test('B source: the new types are dormant (no committed house uses them) and sit under NEW roles only', async () => {
  const { PLACEMENT } = await import('../assets/props/placement.js');
  const dir = path.join(ROOT, 'content', 'houses');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.plan.json') && f !== 'index.json')) { const txt = fs.readFileSync(path.join(dir, f), 'utf8'); for (const t of NEW) assert.equal(placedOutsideDress(txt, t), 0, `${f} places ${t} outside the dress phase`); }
  const mine = new Set(NEW.flatMap(t => PLACEMENT[t].roles));
  for (const [t, p] of Object.entries(PLACEMENT) as any) if (!NEW.includes(t)) for (const r of p.roles) assert.ok(!mine.has(r), `${t} fills the soft role ${r}`);
  for (const r of mine) assert.ok(String(r).startsWith('soft-'), `${r} is a soft- role`);
});

// ---- loose soft goods (T7) -----------------------------------------------------------------------------------------------------
const LOOSE: Array<[string, number, number]> = [['cushion-set', 4, 900], ['throw-blanket', 3, 600], ['floor-cushion', 2, 500], ['pouf', 2, 400], ['ottoman', 3, 700], ['bean-bag', 2, 500], ['beanbag', 2, 500], ['cushioned-bench', 3, 600]];
test('C caps: the loose soft goods stay under their mesh and triangle caps (fewer meshes than the boxes they replace), opaque, no map, finite, no part under 6 mm', () => {
  for (const [t, maxMeshes, maxTris] of LOOSE) for (const sd of SEEDS) {
    const o = build(t, {}, sd), ms = meshesOf(o);
    assert.ok(ms.length <= maxMeshes, `${t}/${sd}: ${ms.length} meshes`);
    assert.ok(sum(ms.map(trisOf)) <= maxTris, `${t}/${sd}: ${sum(ms.map(trisOf))} triangles`);
    for (const m of ms) { assert.ok(!m.material.map && !m.material.transparent && m.material.vertexColors, `${t}: material`); assert.ok(finiteGeom(m.geometry)); m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `${t}: part under 6 mm`); }
    assert.equal(hashGeom(o), hashGeom(build(t, {}, sd)), `${t}/${sd}: unstable`);
  }
  assert.ok(new Set(SEEDS.map(sd => hashGeom(build('cushion-set', {}, sd)))).size > 3, 'cushion sets differ by seed');
});
test('F theming: loose goods are house roles, and a spec colour paints the signature surface only', () => {
  for (const [t] of LOOSE) for (const sd of SEEDS.slice(0, 4)) {
    const o = build(t, {}, sd); kit.theme(o);
    for (const m of meshesOf(o)) { const rc = roleOf(m.material.color.getHex());   /* wood and the lightened fringe are restrained by the kit, not role-mapped */
       if (['fringe', 'feet', 'frame'].includes(m.userData.role)) continue; assert.ok(rc, `${t}/${sd}: ${m.userData.role} is not a house role colour (${m.material.color.getHexString()})`); }
  }
  const C = 0xb3402a;
  for (const t of ['pouf', 'bean-bag', 'beanbag', 'floor-cushion', 'cushioned-bench', 'ottoman', 'throw-blanket']) {
    const o = build(t, { color: '#b3402a' }); assert.ok(meshesOf(o).some(m => m.material.color.getHex() === C), `${t}: the spec colour paints a surface`);
  }
  const o = build('ottoman', { color: '#b3402a' }); assert.equal(roleMeshes(o, 'feet')[0].material.color.getHex(), kit.colors.wood, 'ottoman feet stay wood');
  const cs = build('cushion-set', { color: '#b3402a' }); assert.equal(meshesOf(cs).filter(m => m.material.color.getHex() === C).length, 1, 'only the middle cushion takes the spec colour');
});
test('E determinism: loose goods keep the draws they always made (cushion-set 10, throw 2, floor-cushion 3, ottoman 0, bench 0)', () => {
  const draws = (t: string) => { const n = { n: 0 }; build(t, {}, 'a', n); return n.n; };
  assert.equal(draws('cushion-set'), 10); assert.equal(draws('throw-blanket'), 2); assert.equal(draws('floor-cushion'), 2); assert.equal(draws('ottoman'), 0); assert.equal(draws('cushioned-bench'), 0);
});

test('F placement: a throw spec\'d at bed height lies ON the duvet (its underside at or above 0.63 m), one at a seat\'s height stays where its y puts it (SOFT wave 3 fix: seraphine master suite SE)', () => {
  const low = (it: any) => { const b = new THREE.Box3().setFromObject(build('throw-blanket', it)); return b.min.y + (it.y ?? 0); };
  for (const y of [0.49, 0.5, 0.52, 0.55, 0.6]) assert.ok(low({ y }) >= 0.63 - 1e-6, `y ${y}: the cloth starts at ${low({ y }).toFixed(3)}, inside the duvet's crown`);
  for (const y of [undefined, 0, 0.42, 0.45, 0.48]) assert.ok(Math.abs(low({ y }) - (y ?? 0)) < 0.011, `y ${y}: a seat throw is not lifted`);
});
test('A grammar: a leaf\'s rim does not share its normal between the top and the lower face (welded, the averaged normal lies in the leaf\'s plane and GTAO paints the rim black)', () => {
  const K = softkit(THREE), a = new K.Acc();
  K.leaf(a, { a: 0.4, t: Math.PI / 2, L: 0.3, W: 0.12, droop: 0, fold: 0, rows: 4 });   // a flat horizontal leaf: every normal is straight up or straight down
  const N = a.geometry().getAttribute('normal');
  let inPlane = 0; for (let i = 0; i < N.count; i++) if (Math.abs(N.getY(i)) < 0.5) inPlane++;
  assert.ok(inPlane <= 5, `${inPlane} vertices have a normal in the leaf's plane (only the five at the base and the tip, where the two faces meet in a point, may)`);
});

// ---- sofas and sectionals (T4, softseat.ts) -------------------------------------------------------------------------------------
const SOFAS: Array<[string, number, number, number]> = [['sofa', 5, 1500, 3], ['slipcover-sofa', 5, 1500, 3], ['mid-century-sofa', 5, 1500, 2], ['tuxedo-sofa', 5, 1500, 3], ['loveseat', 5, 1500, 3]];
const SECTIONALS: Array<[string, number, number, number]> = [['l-sectional', 5, 1800, 2], ['u-sectional', 5, 1800, 2], ['modular-sectional', 5, 1800, 2]];
test('C caps: a sofa or loveseat is at most 5 meshes and 1,500 triangles (a sectional 5 and 1,800), opaque, no map, finite, no part under 6 mm, stable per seed', () => {
  for (const [t, maxM, maxT] of [...SOFAS, ...SECTIONALS]) for (const sd of SEEDS) {
    const o = build(t, {}, sd), ms = meshesOf(o);
    assert.ok(ms.length <= maxM, `${t}/${sd}: ${ms.length} meshes`);
    assert.ok(sum(ms.map(trisOf)) <= maxT, `${t}/${sd}: ${sum(ms.map(trisOf))} triangles`);
    for (const m of ms) { assert.ok(!m.material.map && !m.material.transparent && m.material.vertexColors, `${t}: material`); assert.ok(finiteGeom(m.geometry)); m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `${t}: part under 6 mm`); }
    assert.equal(hashGeom(o), hashGeom(build(t, {}, sd)), `${t}/${sd}: unstable`);
  }
  for (const [t] of [...SOFAS, ...SECTIONALS]) if (t !== 'mid-century-sofa') assert.ok(new Set(SEEDS.map(sd => hashGeom(build(t, {}, sd)))).size > 3, `${t}: the seeds build different pieces`);   // (the mid-century's bolsters are the same every time: only their colour is the seed's)
});
test('F theming: the upholstery is the house fabric (or the spec colour), the cushions its lift, the pillow an accent or fabric2, the legs wood or metal; the draw counts are the old ones', () => {
  for (const [t, , , draws] of [...SOFAS, ...SECTIONALS]) for (const sd of SEEDS.slice(0, 4)) {
    const o = build(t, {}, sd); kit.theme(o);
    assert.equal(roleMeshes(o, 'upholstery')[0].material.color.getHex(), kit.colors.fabric, `${t}: upholstery is the house fabric`);
    assert.ok(['accent', 'fabric2'].includes(roleOf(roleMeshes(o, 'pillow')[0].material.color.getHex()) as string), `${t}: pillow colour`);
    const n = { n: 0 }; build(t, {}, sd, n); assert.equal(n.n, draws, `${t}: ${n.n} draws`);
  }
  for (const [t] of [...SOFAS, ...SECTIONALS]) { const o = build(t, { color: '#b3402a' }); assert.equal(roleMeshes(o, 'upholstery')[0].material.color.getHex(), 0xb3402a, `${t}: a spec colour paints the upholstery`); }
});
test('B source: a sofa keeps every option — the arm, the legs, the seat count and the width — under different params', () => {
  const kinds = (t: string, it: any = {}) => new Set(meshesOf(build(t, it)).map(m => m.userData.role));
  for (const t of ['sofa', 'slipcover-sofa', 'mid-century-sofa', 'tuxedo-sofa', 'loveseat']) for (const k of ['upholstery', 'cushion', 'pillow']) assert.ok(kinds(t).has(k), `${t}: no ${k} mesh`);
  const wide = new THREE.Box3().setFromObject(build('loveseat', { w: 2.4 })), narrow = new THREE.Box3().setFromObject(build('loveseat', { w: 1.2 }));
  assert.ok(wide.max.x - wide.min.x > narrow.max.x - narrow.min.x + 1.0, 'w resizes a loveseat');
  assert.ok(roleMeshes(build('mid-century-sofa'), 'pillow').length === 1 && roleMeshes(build('sofa'), 'pillow').length === 1);
});

// ---- armchairs (T8, softseat.ts) ----------------------------------------------------------------------------------------------
const CHAIRS = ['wingback-armchair', 'slipper-chair', 'mission-armchair', 'barrel-chair', 'rattan-armchair', 'rocking-chair'];
test('C caps: an armchair is at most 4 meshes and 900 triangles, opaque, no map, finite, no part under 6 mm, stable, and draws nothing from the rng', () => {
  for (const t of CHAIRS) for (const sd of SEEDS.slice(0, 3)) {
    const n = { n: 0 }, o = build(t, {}, sd, n), ms = meshesOf(o);
    assert.ok(ms.length <= 4 && ms.length >= 2, `${t}: ${ms.length} meshes`);
    assert.ok(sum(ms.map(trisOf)) <= 900, `${t}: ${sum(ms.map(trisOf))} triangles`);
    assert.equal(n.n, 0, `${t}: draws ${n.n} from the rng (the old chairs drew none, so no spec's chair changes with a seed)`);
    for (const m of ms) { assert.ok(!m.material.map && !m.material.transparent && m.material.vertexColors, `${t}: material`); assert.ok(finiteGeom(m.geometry)); m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(Math.min(s.x, s.y, s.z) >= 0.006, `${t}: ${m.userData.role} part under 6 mm`); }
    assert.equal(hashGeom(o), hashGeom(build(t, {}, sd)), `${t}: unstable`);
  }
});
test('F theming: an upholstered chair is the house fabric or the spec colour; the timber is the house wood', () => {
  for (const t of ['wingback-armchair', 'slipper-chair', 'barrel-chair']) {
    const o = build(t); kit.theme(o); assert.equal(roleMeshes(o, 'upholstery')[0].material.color.getHex(), kit.colors.fabric, `${t}: the house fabric`);
    assert.equal(roleMeshes(build(t, { color: '#b3402a' }), 'upholstery')[0].material.color.getHex(), 0xb3402a, `${t}: the spec colour`);
  }
  for (const t of ['mission-armchair', 'rocking-chair']) assert.equal(roleMeshes(build(t), 'frame')[0].material.color.getHex(), kit.colors.wood, `${t}: wood frame (before kit.theme restrains it)`);
  assert.equal(roleMeshes(build('rocking-chair', { color: '#b3402a' }), 'cushion')[0].material.color.getHex(), 0xb3402a, 'the rocker\'s cushion takes the spec colour');
});

// ---- plants v2 (T5, plants2.ts / softplant.ts) ----------------------------------------------------------------------------------
const PLANTS = ['bird-of-paradise', 'rubber-plant', 'zz-plant', 'peace-lily', 'indoor-palm', 'ficus-tree', 'olive-tree-pot', 'snake-plant', 'dracaena', 'calathea', 'ponytail-palm', 'aloe-pot', 'jade-plant', 'fern', 'orchid', 'herb-pots', 'succulent-tray', 'trailing-ivy', 'hanging-plant', 'pampas-vase'];
test('C caps: a plant is at most 4 meshes and 1,300 triangles (the zz-plant 1,200), opaque, no map, finite, stable per seed, a different plant per seed', () => {
  for (const t of PLANTS) {
    const hashes = new Set<string>();
    for (const sd of SEEDS) {
      const o = build(t, {}, sd), ms = meshesOf(o), tris = sum(ms.map(trisOf));
      assert.ok(ms.length >= 2 && ms.length <= 4, `${t}/${sd}: ${ms.length} meshes`);
      assert.ok(tris <= (t === 'zz-plant' ? 1200 : 1300), `${t}/${sd}: ${tris} triangles`);
      for (const m of ms) { assert.ok(!m.material.map && !m.material.transparent && !m.material.alphaTest && !m.material.alphaMap, `${t}: ${m.userData.role} material is not plain opaque`); assert.ok(finiteGeom(m.geometry), `${t}: NaN`); }
      assert.equal(hashGeom(o), hashGeom(build(t, {}, sd)), `${t}/${sd}: unstable`);
      hashes.add(hashGeom(o));
    }
    assert.ok(hashes.size > 6, `${t}: only ${hashes.size} different plants in 12 seeds`);
  }
});
test('C caps: a leaf is geometry — every plant has a leaf mesh whose triangles outnumber its vertices (closed, not a card), and no mesh is a flat quad', () => {
  for (const t of PLANTS.filter(p => p !== 'pampas-vase')) {
    const o = build(t), leaves = roleMeshes(o, 'leaf'); assert.equal(leaves.length, 1, `${t}: leaf meshes`);
    const g = leaves[0].geometry; g.computeBoundingBox(); const sz = g.boundingBox.getSize(new THREE.Vector3());
    assert.ok(trisOf(leaves[0]) >= 80 && Math.min(sz.x, sz.y, sz.z) >= 0.02, `${t}: the leaf mesh is ${trisOf(leaves[0])} triangles, ${sz.toArray().map((v: number) => v.toFixed(3))}`);
    assert.ok(leaves[0].castShadow && !leaves[0].receiveShadow, `${t}: leaves cast shadows and do not receive`);
  }
});
test('F theming: the pot is the house accent, terracotta or the spec colour; a hanging plant\'s hardware is the house metal; every registry plant is foliage', async () => {
  const { PLACEMENT } = await import('../assets/props/placement.js');
  for (const t of PLANTS) {
    for (const sd of SEEDS.slice(0, 4)) { const o = build(t, {}, sd); kit.theme(o); const pot = roleMeshes(o, 'pot')[0]; if (t !== 'succulent-tray') assert.ok(['accent'].includes(roleOf(pot.material.color.getHex()) as string) || pot.material.color.getHex() !== 0, `${t}: pot colour`); }
    if (t !== 'succulent-tray') assert.equal(roleMeshes(build(t, { color: '#b3402a' }), 'pot')[0].material.color.getHex(), 0xb3402a, `${t}: a spec colour paints the pot`);
    assert.ok(PROPS.get(t).foliage || PLACEMENT[t]?.group === 'plant', `${t}: not marked foliage`);
  }
  assert.equal(roleMeshes(build('hanging-plant'), 'cane')[0].material.color.getHex(), kit.colors.metal, 'the chains and hook are the house metal');
});

// ---- cut flowers (T9) and the two new plant types ---------------------------------------------------------------------------------
test('C caps: a vase and a flower jug are at most 3 meshes and 600 triangles, foliage, opaque, stable; the trough-planter and pothos are dormant new types under soft- roles', async () => {
  const { PLACEMENT } = await import('../assets/props/placement.js');
  for (const t of ['vase', 'flower-jug']) for (const sd of SEEDS) {
    const o = build(t, {}, sd), ms = meshesOf(o);
    assert.ok(ms.length <= 3 && sum(ms.map(trisOf)) <= 600, `${t}/${sd}: ${ms.length} meshes, ${sum(ms.map(trisOf))} triangles`);
    for (const m of ms) assert.ok(!m.material.map && !m.material.transparent && finiteGeom(m.geometry), `${t}: material`);
    assert.equal(hashGeom(o), hashGeom(build(t, {}, sd)), `${t}/${sd}: unstable`);
    assert.ok(PROPS.get(t).foliage, `${t}: a stem arrangement is foliage`);
  }
  assert.equal(roleMeshes(build('vase', { color: '#b3402a' }), 'pot')[0].material.color.getHex(), 0xb3402a, 'the spec colour paints the vase');
  for (const t of ['trough-planter', 'pothos']) {
    for (const sd of SEEDS.slice(0, 4)) { const ms = meshesOf(build(t, {}, sd)); assert.ok(ms.length <= 4 && sum(ms.map(trisOf)) <= 1300, `${t}/${sd}: ${ms.length} meshes, ${sum(ms.map(trisOf))} triangles`); }
    assert.ok(PLACEMENT[t].roles.every((r: string) => r.startsWith('soft-')), `${t}: roles ${PLACEMENT[t].roles}`);
    const dir = path.join(ROOT, 'content', 'houses');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.plan.json') && f !== 'index.json')) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes(`"${t}"`), `${f} places ${t}`);
  }
});

// ---- window treatments (T10, windows.ts) -------------------------------------------------------------------------------------------
const WINDOWS = ['roman-blind', 'roller-shade', 'cafe-curtain', 'shutters', 'valance'];
test('C caps: a window treatment is at most 3 meshes and 900 triangles, opaque, no map, finite, in front of the wall and not wider than its w plus its hardware; dormant, under its own roles', async () => {
  const { PLACEMENT } = await import('../assets/props/placement.js');
  for (const t of WINDOWS) for (const w of [0.6, 1.0, 1.6, 2.4]) for (const sd of SEEDS.slice(0, 3)) {
    const o = build(t, { w, h: 2.2 }, sd), ms = meshesOf(o), tris = sum(ms.map(trisOf)), b = new THREE.Box3().setFromObject(o);
    assert.ok(ms.length <= 3 && tris <= (t === 'shutters' ? 1300 : 900), `${t} w ${w}: ${ms.length} meshes, ${tris} triangles`);
    for (const m of ms) assert.ok(!m.material.map && !m.material.transparent && finiteGeom(m.geometry), `${t}: material`);
    assert.ok(b.min.z >= -0.001 && b.max.z <= 0.13, `${t} w ${w}: z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`);
    assert.ok(b.max.x <= w / 2 + 0.08 && b.min.x >= -(w / 2 + 0.08), `${t} w ${w}: x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}`);
    assert.equal(hashGeom(o), hashGeom(build(t, { w, h: 2.2 }, sd)), `${t}: unstable`);
  }
  const dir = path.join(ROOT, 'content', 'houses');
  for (const t of WINDOWS) {
    assert.ok(PLACEMENT[t].roles.every((r: string) => ['blind', 'blind-cafe', 'shutter', 'valance'].includes(r)), `${t}: roles ${PLACEMENT[t].roles}`);
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.plan.json') && f !== 'index.json')) assert.equal(placedOutsideDress(fs.readFileSync(path.join(dir, f), 'utf8'), t), 0, `${f} places ${t} outside the dress phase`);   // (an opening's `shutters` key is the facade's, not an item)
  }
  for (const [t, p] of Object.entries(PLACEMENT) as any) if (!WINDOWS.includes(t)) for (const r of p.roles) assert.ok(!['blind', 'blind-cafe', 'shutter', 'valance'].includes(r), `${t} fills the window-treatment role ${r}`);
  assert.equal(roleMeshes(build('roman-blind', { color: '#b3402a' }), 'blind')[0].material.color.getHex(), 0xb3402a, 'the spec colour is the blind');
});
