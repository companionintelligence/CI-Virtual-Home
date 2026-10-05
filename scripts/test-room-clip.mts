#!/usr/bin/env -S node --experimental-strip-types
// The room clip in Node (assets/room-clip.ts): the packing, the mask, the slot code in a light's decay, which sides of a room have a wall,
// and the patch of three's light chunks. No browser. The rendered half (every room of the 30 houses: does another room's pool change its
// pixels?) is `pnpm run test:light -- --leak`.
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-room-clip.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { packBox, unpackBox, clipMask, codedDecay, slotOfDecay, openSides, roomClipBox, installRoomClip, roomClipInstalled, setSlot, clearSlots, CLIP_DATA, MAX_SLOTS, FADE, WALL_MARGIN, FACE_DOWN, POOL_DATA, POOL_CORE, POOL_HALO_R, POOL_HALO_K, POOL_UP_FADE, type ClipBox } from '../assets/room-clip.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses');
const specs = fs.readdirSync(HOUSES).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(HOUSES, f), 'utf8')));

const box = (o: Partial<ClipBox> = {}): ClipBox => ({ x0: -5.6, x1: 3.8, z0: -5, z1: -1.2, y0: -0.01, y1: 2.99, open: { xmin: false, xmax: true, zmin: false, zmax: true }, ...o });

test('packing: every field is an exact integer in a float32, and the box only ever grows', () => {
  const cases: ClipBox[] = [box(), box({ x0: 3.8, x1: 12.4, z0: -5, z1: 1.6, y0: 2.99, y1: 5.99, open: { xmin: true, xmax: false, zmin: false, zmax: true } }), box({ x0: -8.2, x1: -5.6, z0: -0.4, z1: 3.2, open: { xmin: true, xmax: true, zmin: true, zmax: true } }), box({ open: { xmin: false, xmax: false, zmin: false, zmax: false } })];
  for (const c of cases) {
    const p = packBox(c)!; assert.ok(p, 'packs');
    const f = Array.from(new Float32Array(p));
    for (let i = 2; i < 4; i++) { assert.equal(f[i], p[i], `field ${i} exact in float32`); assert.ok(Number.isInteger(p[i]) && p[i] < 2 ** 24, `field ${i} an integer below 2^24`); }
    const u = unpackBox(f)!;
    assert.ok(u.x0 <= c.x0 + 1e-6 && u.x1 >= c.x1 - 1e-6 && u.z0 <= c.z0 + 1e-6 && u.z1 >= c.z1 - 1e-6, 'never smaller than the room');
    assert.ok(u.x0 >= c.x0 - 0.0101 && u.x1 <= c.x1 + 0.0101 && u.z0 >= c.z0 - 0.0101 && u.z1 <= c.z1 + 0.0101, 'at most 1 cm bigger');
    assert.ok(u.y0 <= c.y0 + 1e-6 && u.y0 >= c.y0 - 0.0101 && u.y1 <= c.y1 + 1e-6 && u.y1 >= c.y1 - 0.0101, 'storey height to 1 cm, the top never above the box asked for');
    assert.deepEqual(u.open, c.open, 'the open sides survive');
  }
  assert.equal(packBox(box({ x0: -11, x1: 11 })), null, 'a room wider than 20.4 m gets no clip rather than a box too small for it');
  assert.equal(unpackBox([0, 0, 0, 0]), null, 'all zero is no box');
});

test('mask: 1 inside, 0 outside, hard on a walled side, a smoothstep over FADE on an open one, 0 above and below the storey', () => {
  const c = box();   // xmin and zmin walled; xmax and zmax open
  const at = (x: number, z: number, y = 1.5) => clipMask(c, { x, y, z });
  assert.equal(at(0, -3), 1);
  assert.equal(at(-5.7, -3), 0, 'past the walled side: nothing');
  assert.equal(at(-5.6, -3), 1, 'on the walled side\'s line: lit (the wall face stands 8 cm inside it)');
  assert.ok(at(3.7, -3) > 0 && at(3.7, -3) < 0.2, 'just before the open side: nearly gone');
  assert.equal(at(3.8, -3), 0, 'at the open side\'s line: gone');
  assert.ok(at(3.8 - FADE / 2, -3) > 0.4 && at(3.8 - FADE / 2, -3) < 0.6, 'half way through the fade: half');
  assert.equal(at(3.8 - FADE, -3), 1, 'a FADE inside the open side: full');
  assert.equal(at(0, -1.2), 0); assert.equal(at(0, -1.2 + 0.1), 0);
  assert.equal(at(0, -3, -0.2), 0, 'below the storey'); assert.equal(at(0, -3, 3.0), 0, 'the next storey\'s floor, a centimetre over the box'); assert.equal(at(0, -3, 2.9), 1);
  for (let i = 0; i < 50; i++) { const t = i / 49; const m = at(3.8 - FADE * t, -3); assert.ok(m >= 0 && m <= 1); }
});

test('slots: a coded decay names its slot, an untagged light has none, and the code moves the falloff by about 1 % at most', () => {
  for (const base of [1, 1.6]) for (let k = 0; k < MAX_SLOTS; k++) {
    const d = codedDecay(base, k); assert.equal(slotOfDecay(d), k, `base ${base} slot ${k}`);
    assert.equal(slotOfDecay(Math.fround(d)), k, `and in float32`);
    assert.ok(Math.abs(4 ** -d - 4 ** -base) / 4 ** -base < 0.012, 'falloff at 4 m within 1.2 %');
  }
  for (const d of [2, 1.6, 1, 0, 1.5, 2.5, 1.7, 3]) assert.equal(slotOfDecay(d), -1, `decay ${d} is not a tag`);
});

test('walls: a side is open when under half its length has the storey outline or a partition on it', () => {
  const aurora = specs.find(s => s.id === 'aurora');
  const l1 = aurora.levels[0], seg = l1.partitions.filter((p: any) => Array.isArray(p.from));
  const room = (n: string) => l1.rooms.find((r: any) => r.name === n).bounds;
  const kitchen = openSides(room('Kitchen'), l1.footprint, seg), dining = openSides(room('Dining'), l1.footprint, seg), bath = openSides(room('Guest Bath'), l1.footprint, seg);
  assert.equal(kitchen.zmax, true, 'the kitchen is open to the dining room: no partition on z = -1.2 there');
  assert.equal(kitchen.zmin, false, 'its north side is the outline');
  assert.equal(dining.zmin, true, 'and the dining room is open to the kitchen');
  assert.deepEqual(bath, { xmin: false, xmax: false, zmin: false, zmax: false }, 'a bath with four walls has no open side');
  assert.deepEqual(openSides({ x: 0, z: 0, w: 4, d: 4 }, [], []), { xmin: true, xmax: true, zmin: true, zmax: true }, 'no wall data at all: every side open, so nothing is cut hard');
  assert.deepEqual(openSides({ x: 0, z: 0, w: 4, d: 4 }, [{ x: 0, z: 0, w: 4, d: 4 }], []), { xmin: false, xmax: false, zmin: false, zmax: false }, 'a room that fills its footprint is closed on all four sides');
});

test('the fleet: every lit-size room has a box that packs, and open-plan houses have open sides', () => {
  let rooms = 0, withOpen = 0, nulls = 0;
  for (const s of specs) for (const lv of s.levels) for (const r of lv.rooms || []) {
    const b = r.bounds; if (!b || b.w * b.d < 2.5 || r.program === 'outdoor') continue;
    const c = roomClipBox(b, lv.y || 0, lv.height || 3, lv.footprint || [], (lv.partitions || []).filter((p: any) => Array.isArray(p.from)));
    rooms++; if (!packBox(c)) nulls++;
    if (Object.values(c.open).some(Boolean)) withOpen++;
    assert.ok(c.x0 === b.x && c.x1 === b.x + b.w && c.z0 === b.z && c.z1 === b.z + b.d, `${s.id}/${r.name}: the box is the room's bounds`);
  }
  assert.equal(nulls, 0, 'no room of the fleet is too wide to pack');
  assert.ok(rooms > 300, `${rooms} rooms judged`);
  assert.ok(withOpen > 20 && withOpen < rooms, `${withOpen} of ${rooms} rooms have an open side`);
});

test('LIGHT v3 (7): a surface that faces down is lit across the whole wall thickness; nothing else is, so the next room\'s door leaves and faces stay dark', () => {
  assert.ok(WALL_MARGIN > 0.04 && WALL_MARGIN < 0.07, `${WALL_MARGIN}: past the middle of the thinnest wall, short of its far face (0.07)`);
  const c = roomClipBox({ x: 0, z: 0, w: 4, d: 4 }, 0, 3, [{ x: 0, z: 0, w: 4, d: 4 }], []);
  assert.equal(clipMask(c, { x: 4.06, y: 2.1, z: 2 }, true), 1, 'a header\'s underside, outer half: lit');
  assert.equal(clipMask(c, { x: 4.06, y: 2.1, z: 2 }, false), 0, 'a door leaf or a jamb there: not');
  assert.equal(clipMask(c, { x: 4.075, y: 2.1, z: 2 }, true), 0, 'and past the wall\'s far face nothing is');
  assert.ok(FACE_DOWN < 0 && FACE_DOWN >= -0.9);
});

test('slots written to the shared array, cleared on a new house, and an unwritten slot is no clip', () => {
  clearSlots(); assert.ok(CLIP_DATA.every(v => v === 0));
  setSlot(3, box());
  assert.ok(CLIP_DATA.slice(12, 16).some(v => v !== 0)); assert.ok(CLIP_DATA.slice(0, 12).every(v => v === 0));
  assert.equal(unpackBox(Array.from(CLIP_DATA.slice(0, 4))), null, 'slot 0 unwritten');
  assert.throws(() => setSlot(MAX_SLOTS, box()), /slot/);
  setSlot(4, box({ x0: -11, x1: 11 }));   // too wide: zeros, not a throw, not a wrong box
  assert.ok(CLIP_DATA.slice(16, 20).every(v => v === 0));
  clearSlots(); assert.ok(CLIP_DATA.every(v => v === 0));
});

test('the shader patch: applied once to three\'s r169 chunks, to both loops, uniform shared by reference, nothing left unexpanded', () => {
  assert.ok(THREE.REVISION === '169', `three r${THREE.REVISION}: the patch was written against r169`);
  const before = THREE.ShaderChunk.lights_fragment_begin;
  assert.equal(installRoomClip(THREE), true); assert.equal(roomClipInstalled(), true);
  const after = THREE.ShaderChunk.lights_fragment_begin, pars = THREE.ShaderChunk.lights_pars_begin;
  assert.notEqual(after, before);
  assert.equal(after.split('vhRoomClip( pointLight.decay, vhWorld, directLight, pointLight.position - geometryPosition, pointLight.color, vhWallMargin( geometryNormal ) );').length, 2);
  assert.equal(after.split('vhRoomClip( spotLight.decay, vhWorld, directLight, spotLight.position - geometryPosition, spotLight.color, vhWallMargin( geometryNormal ) );').length, 2);
  assert.equal(after.split('vec3 vhWorld = ( geometryPosition - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );').length, 2);
  assert.ok(pars.includes(`uniform vec4 vhClip[ ${MAX_SLOTS} ];`) && pars.includes('void vhRoomClip('));
  assert.ok(!/undefined|NaN|\$\{/.test(pars.slice(pars.indexOf('uniform vec4 vhClip'))), 'no template left in the GLSL');
  // the RE_Direct calls realism's live-player guard wraps are still exactly two, and the text it splits on is intact
  const head = after.slice(0, after.indexOf('#if ( NUM_DIR_LIGHTS > 0 )'));
  assert.equal(head.split('RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );').length, 3, 'two RE_Direct calls before the directional loop');
  assert.equal(installRoomClip(THREE), true); assert.equal(THREE.ShaderChunk.lights_fragment_begin, after, 'idempotent');
  for (const k of ['lambert', 'phong', 'standard', 'physical', 'toon']) assert.equal((THREE.ShaderLib as any)[k].uniforms.vhClip.value, CLIP_DATA, `${k} shares the array`);
  // a material's own uniform map (UniformsUtils.clone) hands a typed array on by reference
  assert.equal(THREE.UniformsUtils.clone((THREE.ShaderLib as any).physical.uniforms).vhClip.value, CLIP_DATA);
});

test('LIGHT v3 (2): the pool shaping is in the shader (core, halo, up-fade) and an off light skips the clip', () => {
  const pars = THREE.ShaderChunk.lights_pars_begin;
  assert.ok(pars.includes('uniform vec4 vhPool;') && pars.includes('dot( lc, vec3( 1.0 ) ) <= 0.0 ) return;'), 'a light with no colour returns before the box maths');
  assert.ok(pars.includes('pow( d2 / ( d2 + vhPool.x * vhPool.x )') && pars.includes('smoothstep( 0.35 * vhPool.w, vhPool.w'));
  assert.equal(POOL_DATA.length, 4); assert.deepEqual(Array.from(POOL_DATA).map(v => +v.toFixed(3)), [POOL_CORE, POOL_HALO_R, POOL_HALO_K, POOL_UP_FADE].map(v => +v.toFixed(3)));
  assert.ok(POOL_CORE > 0.2 && POOL_CORE < 0.8 && POOL_HALO_R > 0.6 && POOL_HALO_R < 2 && POOL_HALO_K > 0 && POOL_HALO_K < 0.5);
  assert.equal((THREE.ShaderLib as any).physical.uniforms.vhPool.value, POOL_DATA, 'shared by reference');
});

test('the fixtures use it: a slot and a coded decay per room light, cleared per house', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'fixtures.ts'), 'utf8');
  assert.match(src, /clearSlots\(\)/); assert.match(src, /codedDecay\(decay, slot\)/); assert.match(src, /codedDecay\(LAMP_POOL_DECAY, slot\)/);
  assert.equal(src.split('setSlot(slot, roomClipBox(').length, 3, 'the fill and the pool each set their slot');
  assert.match(fs.readFileSync(path.join(ROOT, 'assets', 'environment.ts'), 'utf8'), /installRoomClip\(THREE\)/);
});

test('room-clip.ts is THREE-free, clock-free and random-free', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'room-clip.ts'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/^\s*import\s/m.test(src), 'no import');
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src));
});
