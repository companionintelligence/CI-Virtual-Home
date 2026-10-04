#!/usr/bin/env -S node --experimental-strip-types
// The softkit's gates (SOFT stream; PLAN 5.3 and 8). Pure Node, no browser, the vendored three: the grammar (assets/props/softkit.ts) and every soft
// prop built on it, in a build context like the page's.
//
//   A  grammar    every primitive builds with no NaN, no degenerate triangle left in, indices in range; a closed lens (sheet th > 0) is watertight
//   B  source     no Math.random / Date / performance in softkit.ts; no `map` in it (a quilt's map is the builder's, beds.ts)
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

