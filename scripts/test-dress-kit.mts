#!/usr/bin/env -S node --experimental-strip-types
// The dress kit's gates (plan 5.5 SMALL; PLAN 8.4): assets/props/dress-kit.ts (primitives, the Kit, registerDress) and every `dress: true` type the dress-*.ts
// modules register. Pure Node on the vendored three, no browser.
//
//   A  primitives   closed solids wind outward (positive signed volume), finite positions and unit normals, indices in range, thin dimensions clamped to MIN_PART
//   B  every type   at most 3 meshes and 600 triangles over 12 seeds and every variant, opaque, no map, no UVs, material userData only `muted`, fresh materials per
//                   create(), the same item and seed build the same bytes, a fixed number of rng draws whatever the variant, no part under MIN_PART, no FREE part
//                   under MIN_FREE and no round body 6 cm or wider under 16 segments (R-FACET), the union box over 12 seeds and every variant inside the declared footprint (+ 0.04 m), and the catalogued MEASURED box inside it too
//   C  roles        paint comes from the house's roles: two houses give two colours, an item's own `color` repaints only its signature role, fixed literals are muted
//   D  placement    every type has a placement, a surface type is an onSurface placement, its roles are all NEW `dx-*` roles that no other type shares (so no existing
//                   role's candidate list grew and no pick re-rolls), the group agrees with the definition
//   E  authored     no house spec and no fixture outside the small-* and dress-* ones AUTHORS a dress type: the shipped houses carry them only as baked `dress@1` items (pass 6)
//   F  source       no Math.random, Date or performance clock in dress-kit.ts, tableware.ts or a dress-*.ts module; no module-level material
//
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-dress-kit.mts      (needs `pnpm run build`; any cwd)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { PROPS } from '../assets/props/index.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { MEASURED } from '../assets/props/measured.js';
import { createBuildContext } from '../assets/build-context.js';
import { createMaterialKit } from '../assets/materials.js';
import * as K from '../assets/props/dress-kit.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const bc = createBuildContext({ THREE } as any);
const kitFor = (seed: string, accent = '#0f766e') => createMaterialKit({ THREE, palette: { wall: '#f1f5f9', trim: '#1e293b', accent, material: 'stucco' }, seed } as any);
const DRESS: Array<[string, any]> = [...(PROPS as Map<string, any>)].filter(([, d]) => d.dress);
const SEEDS = 12;

function ctxFor(kit: any, key: string, counter?: { n: number }) {
  const r = kit.itemRng(key);
  return { THREE, std: bc.std, box: bc.box, group: bc.group, mix: bc.mix, hex: bc.hex, colors: kit.colors, rng: counter ? () => { counter.n++; return r(); } : r };
}
const meshesOf = (o: any) => { const l: any[] = []; o.traverse((m: any) => { if (m.isMesh) l.push(m); }); return l; };
const trisOf = (o: any) => meshesOf(o).reduce((a, m) => a + m.geometry.index.count / 3, 0);
const hashOf = (o: any) => { let h = 2166136261; for (const m of meshesOf(o)) { const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i++) { h ^= Math.round(p[i] * 1e5) & 0xffffff; h = Math.imul(h, 16777619) >>> 0; } h ^= m.material.color.getHex(); h = Math.imul(h, 16777619) >>> 0; } return h; };
const boxOf = (o: any) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const variantsOf = (def: any): number[] => (def.params || []).includes('variant') ? [0, 1, 2, 3] : [undefined as any];

test('A: the primitives are closed, outward, finite and clamped', () => {
  const solids: Record<string, K.Geo> = {
    box: K.box(0.1, 0.05, 0.08), roundedBox1: K.roundedBox(0.1, 0.05, 0.08, 0.01, 1), roundedBox2: K.roundedBox(0.1, 0.05, 0.08, 0.01, 2),
    cylinder: K.cylinder(0.04, 0.03, 0.1), cone: K.cylinder(0.05, 0.02, 0.1, 12), vessel: K.vessel([[0.03, 0], [0.04, 0.03], [0.042, 0.09]], { wall: 0.006 }),
    mug: K.vessel([[0.036, 0], [0.0416, 0.095]], { seg: 16, wall: 0.007, floor: 0.01 }), vaseNeck: K.vessel([[0.034, 0], [0.056, 0.07], [0.02, 0.225], [0.024, 0.245]], { depth: 0.04 }),
    tray: K.trayShell(0.4, 0.28, 0.022), torus: K.torus(0.03, 0.006, 12, 6), lathe: K.lathe([[0, 0], [0.05, 0, 1], [0.05, 0.05, 1], [0, 0.05]], 14),
  };
  for (const [name, g] of Object.entries(solids)) {
    assert.ok(K.signedVolume(g) > 0, `${name}: signed volume ${K.signedVolume(g)} (triangles wind outward)`);
    assert.equal(g.p.length, g.n.length, `${name}: one normal per vertex`);
    assert.ok(g.p.every(Number.isFinite) && g.n.every(Number.isFinite), `${name}: finite`);
    for (let i = 0; i < g.n.length; i += 3) { const l = Math.hypot(g.n[i], g.n[i + 1], g.n[i + 2]); assert.ok(Math.abs(l - 1) < 1e-6, `${name}: unit normal (${l})`); }
    assert.ok(g.i.every(v => v >= 0 && v < g.p.length / 3), `${name}: indices in range`);
    assert.equal(g.i.length % 3, 0);
  }
  // a thin dimension asked for under the floor is clamped to it
  assert.ok(K.torus(0.03, 0.001).thin >= K.MIN_PART - 1e-9, 'torus tube clamps to MIN_PART');
  assert.ok(K.vessel([[0.03, 0], [0.04, 0.05]], { wall: 0.001 }).thin >= K.MIN_PART - 1e-9, 'vessel wall clamps to MIN_PART');
  assert.ok(K.trayShell(0.3, 0.2, 0.02, { wall: 0.001, floor: 0.001 }).thin >= K.MIN_PART - 1e-9, 'tray wall and floor clamp to MIN_PART');
  assert.ok(K.MIN_FREE >= K.MIN_PART);
  // a volume check against the analytic one: a 22-gon cylinder is 0.5 * 22 * sin(2 pi / 22) of the circle's area
  const cyl = K.cylinder(0.05, 0.05, 0.1, 22), area = 0.5 * 22 * 0.05 * 0.05 * Math.sin((2 * Math.PI) / 22);
  assert.ok(Math.abs(K.signedVolume(cyl) - area * 0.1) < 1e-9, 'cylinder volume');
  // the kit: placement composes, a torus arc has the ends where the arc says
  const k = new K.Kit(); k.with({ x: 1 }, () => k.with({ ry: Math.PI / 2 }, () => k.add('wood', K.box(0.2, 0.1, 0.1), { x: 0.5 })));
  const b = k.box();   // box centre x 0.5 turned a quarter about y lands on z = -0.5, then +1 in x
  assert.ok(Math.abs((b[0] + b[3]) / 2 - 1) < 1e-4 && Math.abs((b[2] + b[5]) / 2 + 0.5) < 1e-4, `with() composes outer after inner (${b.map(v => v.toFixed(3))})`);
  assert.throws(() => new K.Kit().add('nope', K.box(0.1, 0.1, 0.1)).build(ctxFor(kitFor('x'), 'x'), 'x'), /unknown role/);
});

test('B: every dress type holds the kit contract', () => {
  assert.ok(DRESS.length >= 7, `dress types registered: ${DRESS.length}`);
  const kitA = kitFor('dress-a'), kitB = kitFor('dress-b', '#c2410c');
  for (const [type, def] of DRESS) {
    const where = `${type}`;
    assert.ok(def.surface === true || def.surface === false, `${where}: surface is explicit`);
    if (def.mountY !== undefined) assert.equal(def.surface, false, `${where}: a wall prop is not a surface prop`);
    assert.deepEqual(def.iso, [], `${where}: dress types carry no iso hints`);
    assert.ok(Array.isArray(def.footprint) && def.footprint.length === 2, `${where}: footprint`);
    assert.ok(def.budget && def.budget.meshes === K.DRESS_MAX_MESHES && def.budget.tris === K.DRESS_MAX_TRIS, `${where}: budget on the definition`);
    const union = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let draws: number | null = null, maxTris = 0;
    for (const variant of variantsOf(def)) for (let s = 0; s < SEEDS; s++) {
      const counter = { n: 0 }, it: any = { type, at: [0, 0], ...(variant === undefined ? {} : { variant }) };
      const o = def.create(it, ctxFor(kitA, `${type}:${s}`, counter));
      if (draws === null) draws = counter.n; else assert.equal(counter.n, draws, `${where}: ${counter.n} rng draws (variant ${variant}, seed ${s}), expected ${draws}: a fixed count whatever the variant`);
      const ms = meshesOf(o), tris = trisOf(o);
      maxTris = Math.max(maxTris, tris);
      assert.ok(ms.length >= 1 && ms.length <= K.DRESS_MAX_MESHES, `${where}: ${ms.length} meshes (variant ${variant}, seed ${s}), at most ${K.DRESS_MAX_MESHES}`);
      assert.ok(tris <= K.DRESS_MAX_TRIS, `${where}: ${tris} triangles (variant ${variant}, seed ${s}), at most ${K.DRESS_MAX_TRIS}`);
      for (const m of ms) {
        const mat = m.material;
        assert.ok(!Array.isArray(mat) && !mat.transparent && !mat.map && !mat.alphaTest && mat.opacity === 1, `${where}: ${m.name} is opaque, untextured`);
        assert.ok(!m.geometry.attributes.uv, `${where}: ${m.name} carries no UVs`);
        assert.ok(Object.keys(mat.userData).every(k => k === 'muted'), `${where}: ${m.name} material userData ${JSON.stringify(mat.userData)} (only muted)`);
        assert.ok(m.castShadow && m.receiveShadow, `${where}: ${m.name} shadows`);
        const p = m.geometry.attributes.position.array, n = m.geometry.attributes.normal.array;
        assert.ok(p.every(Number.isFinite) && n.every(Number.isFinite), `${where}: ${m.name} finite`);
      }
      const d = o.userData.dress;
      assert.ok(d && d.thinnest >= K.MIN_PART - 1e-6, `${where}: thinnest part ${d && d.thinnest} m, floor ${K.MIN_PART}`);
      assert.ok(d.thinnestFree === null || d.thinnestFree >= K.MIN_FREE - 1e-6, `${where}: thinnest free part ${d.thinnestFree} m, floor ${K.MIN_FREE}`);
      assert.ok(d.segWide === null || d.segWide >= 16, `${where}: a round body 6 cm or wider has ${d.segWide} segments, at least 16 (R-FACET)`);
      const bb = boxOf(o); union[0] = Math.min(union[0], bb.min.x); union[1] = Math.min(union[1], bb.min.y); union[2] = Math.min(union[2], bb.min.z); union[3] = Math.max(union[3], bb.max.x); union[4] = Math.max(union[4], bb.max.y); union[5] = Math.max(union[5], bb.max.z);
      assert.ok(bb.min.y > -0.001, `${where}: stands on y = 0 (min y ${bb.min.y})`);
    }
    // fresh materials per create, same bytes for the same item and stream, other houses give other colours
    const a1 = def.create({ type, at: [0, 0] }, ctxFor(kitA, `${type}:fresh`)), a2 = def.create({ type, at: [0, 0] }, ctxFor(kitA, `${type}:fresh`));
    const m1 = meshesOf(a1), m2 = meshesOf(a2);
    assert.ok(m1.every((m, i) => m.material !== m2[i].material && m.geometry !== m2[i].geometry), `${where}: fresh materials and geometry per create()`);
    assert.equal(hashOf(a1), hashOf(a2), `${where}: the same item and stream build the same bytes`);
    // the union box is inside the declared footprint and, once catalogued, inside MEASURED (a stray part would move the composer's lanes)
    const [fw, fd] = def.footprint, TOL = 0.04;
    assert.ok(union[3] - union[0] <= fw + TOL && union[5] - union[2] <= fd + TOL, `${where}: union box ${(union[3] - union[0]).toFixed(3)} x ${(union[5] - union[2]).toFixed(3)} outside the declared footprint ${fw} x ${fd} (+ ${TOL})`);
    assert.ok(union[4] <= def.height + TOL, `${where}: union height ${union[4].toFixed(3)} over the declared ${def.height} (+ ${TOL})`);
    // the catalog's measured box (the composer's truth: the default build) lies inside the declared footprint, so a variant never outgrows what a host was packed for
    const mm = (MEASURED as any)[type];
    if (mm) assert.ok(mm.b[2] - mm.b[0] <= fw + TOL && mm.b[3] - mm.b[1] <= fd + TOL && mm.y[1] <= def.height + TOL, `${where}: MEASURED ${JSON.stringify(mm)} outside the declared footprint ${fw} x ${fd} x ${def.height} (+ ${TOL})`);
    void kitB; void maxTris;
  }
});

test('C: the house paints the roles; an item\'s own colour repaints one', () => {
  const kitA = kitFor('dress-a'), kitB = kitFor('dress-b', '#c2410c'), kitC = kitFor('dress-c', '#1d4ed8');
  assert.notEqual(kitA.colors.accent, kitB.colors.accent);
  let houseRoles = 0, fixedRoles = 0;
  for (const [type, def] of DRESS) {
    const roleColor = (kit: any, o: any) => Object.fromEntries(meshesOf(o).map(m => [m.name, m.material.color.getHex()]));
    const a = def.create({ type, at: [0, 0], variant: 0 }, ctxFor(kitA, 'k')), b = def.create({ type, at: [0, 0], variant: 0 }, ctxFor(kitB, 'k'));
    const ca = roleColor(kitA, a), cb = roleColor(kitB, b);
    for (const m of meshesOf(a)) {
      const spec = K.DRESS_ROLES[m.name]; assert.ok(spec, `${type}: role ${m.name} is in the table`);
      if (spec.fixed !== undefined) { fixedRoles++; assert.equal(m.material.userData.muted, true, `${type}: fixed role ${m.name} is flagged muted`); assert.equal(ca[m.name], spec.fixed); assert.equal(cb[m.name], spec.fixed); }
      else { houseRoles++; assert.equal(ca[m.name], (kitA.colors as any)[spec.from!] ?? (kitA.colors as any)[spec.fallback || 'linen'], `${type}: ${m.name} is the house's ${spec.from}`); assert.equal(m.material.userData.muted, undefined, `${type}: a house role is themed, never muted`); }
    }
    // the same prop in a second house takes that house's colours for the roles that differ between the two
    for (const m of meshesOf(b)) { const spec = K.DRESS_ROLES[m.name]; if (spec.fixed === undefined) assert.equal(cb[m.name], (kitB.colors as any)[spec.from!] ?? (kitB.colors as any)[spec.fallback || 'linen']); }
    // kit.theme() leaves every material alone (a role colour is a role, a fixed one is muted): the colours do not move
    kitC.theme(a); const cc = roleColor(kitC, a);
    for (const m of meshesOf(a)) { const spec = K.DRESS_ROLES[m.name]; if (spec.fixed !== undefined) assert.equal(cc[m.name], spec.fixed, `${type}: ${m.name} survives kit.theme()`); }
    // an item's own `color` repaints only the signature role (when the type takes one)
    if ((def.params || []).includes('color')) {
      const c = def.create({ type, at: [0, 0], variant: 0, color: '#ff00aa' }, ctxFor(kitA, 'k')), cd = roleColor(kitA, c);
      const changed = Object.keys(cd).filter(r => cd[r] !== ca[r]);
      assert.equal(changed.length, 1, `${type}: a colour param repaints exactly one role (changed: ${changed})`);
      assert.equal(cd[changed[0]], 0xff00aa);
    }
  }
  assert.ok(houseRoles > 0 && fixedRoles > 0, 'both kinds of role are exercised');
});

test('D: placements are new dx-* roles, nothing else moves', () => {
  const dressTypes = new Set(DRESS.map(([t]) => t)), mine = new Map<string, string>();
  for (const [type, def] of DRESS) {
    const pl = (PLACEMENT as any)[type];
    assert.ok(pl, `${type}: no placement entry`);
    assert.ok(pl.roles.length > 0 && pl.roles.every((r: string) => r.startsWith('dx-')), `${type}: roles ${JSON.stringify(pl.roles)} must all be new dx-* roles`);
    assert.equal(pl.onSurface, !!def.surface, `${type}: a surface prop is an onSurface placement`);
    assert.equal(pl.group, def.group || 'decor', `${type}: group agrees with the definition`);
    assert.equal(pl.hangs, def.mountY !== undefined ? 'wall' : null, `${type}: a wall prop hangs on the wall`);
    for (const r of pl.roles) { assert.ok(!mine.has(r) || mine.get(r) === type, `${type}: role ${r} is shared with ${mine.get(r)}`); mine.set(r, type); }
  }
  // no non-dress type fills a dx-* role (so the roles stay private to the kit)
  for (const [t, p] of Object.entries(PLACEMENT as Record<string, any>)) if (!dressTypes.has(t)) assert.ok(!p.roles.some((r: string) => r.startsWith('dx-')), `${t} fills a dx-* role`);
});

test('E: no house AUTHORS a dress type: the shipped houses carry them only as baked dress@1 items, the fixtures only the small-* and dress-* ones', () => {
  const names = new Set(DRESS.map(([t]) => t));
  const dirs = [path.join(ROOT, 'content', 'houses'), path.join(ROOT, 'test', 'fixtures', 'houses')];
  let baked = 0;
  for (const dir of dirs) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.plan.json') && !/^(index|small-|dress-)/.test(f))) {
    const walk = (o: any) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (names.has(o.type) && Array.isArray(o.at)) { assert.equal(o.src, 'dress@1', `${path.relative(ROOT, path.join(dir, f))} places the dress type ${o.type} outside the dress phase`); baked++; } Object.values(o).forEach(walk); } };
    walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  assert.ok(baked === 0 || baked > 500, `${baked} baked dress items in the shipped houses`);
});

test('F: the source is deterministic and holds no module-level material', () => {
  const files = ['assets/props/dress-kit.ts', 'assets/props/tableware.ts', ...fs.readdirSync(path.join(ROOT, 'assets', 'props')).filter(f => /^dress-.*\.ts$/.test(f)).map(f => `assets/props/${f}`)];
  for (const f of new Set(files)) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(text), `${f}: a clock or Math.random`);
    assert.ok(!/^(const|let|var)\s+\w+\s*=\s*new\s+THREE\./m.test(text), `${f}: a module-level THREE object`);
    assert.ok(!/^import\s.*three/m.test(text), `${f}: imports three (the page's THREE arrives as ctx.THREE)`);
  }
});
