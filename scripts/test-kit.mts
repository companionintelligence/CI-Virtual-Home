#!/usr/bin/env -S node --experimental-strip-types
// The kit's rules in Node (plan S1 acceptance: "scripts/test-kit.mts passes — restraint and keep maths, roomKind
// override, door-colour derivation, all deterministic"), plus the rest of kit-rules.ts: the fans a minority and the
// lamps varied under defaults 2, the sun's seeded swing and bearing, a roof colour kept within ΔE 3, the finishes'
// textures. No browser: kit-rules.ts is pure, and the material kit runs on a stub THREE.
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-kit.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { restrainPalette, createMaterialKit, colourMath, FINISH_KINDS } from '../assets/materials.js';
import { kitPalette, levelWall, doorColour, doorStyleOf, leafKindOf, lightingOf, sunBearingOf, swingForBearing, fanPlan, fanSpot, lampPlan, programKind, heroRoom, restraintOf, BASE_PALETTE, D2_RESTRAINT, LAMP_KINDS, LAMP_ITEMS } from '../assets/kit-rules.js';
import { roomKind, fanEligible } from '../assets/fixtures.js';
import { TIME_OF_DAY, lookOf, sunDirection } from '../assets/environment.js';
import { validate } from './validate-house-spec.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses');
const fleet = fs.readdirSync(HOUSES).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(HOUSES, f), 'utf8')));
const fixture = (id: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`), 'utf8'));
const { hex, css, lum } = colourMath;

// CIEDE2000 (scripts/fleet-audit.mts has the same)
function lab(c: string | number): [number, number, number] {
  const n = hex(c), lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const [r, g, b] = lin, X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function deltaE(a, b) {
  const [L1, a1, b1] = lab(a), [L2, a2, b2] = lab(b), D = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (x, y) => { if (x === 0 && y === 0) return 0; const v = Math.atan2(y, x) / D; return v < 0 ? v + 360 : v; };
  const h1 = h(a1p, b1), h2 = h(a2p, b2), dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * D / 2), Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p !== 0) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2) : (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * D) + 0.24 * Math.cos(2 * hm * D) + 0.32 * Math.cos((3 * hm + 6) * D) - 0.2 * Math.cos((4 * hm - 63) * D);
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * D);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

// a THREE with just enough for the material kit to run in Node (textures are computed, never uploaded)
const STUB = {
  DataTexture: class { image: any; userData: any = {}; name = ''; constructor(data, w, h) { this.image = { data, width: w, height: h }; } },
  MeshStandardMaterial: class { userData: any = {}; params: any; onBeforeCompile: any; constructor(p) { this.params = p; } },
  MeshPhysicalMaterial: class { userData: any = {}; constructor(p) {} },
  Vector2: class { x: number; y: number; constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
  RepeatWrapping: 1, LinearFilter: 1, LinearMipmapLinearFilter: 1, RGBAFormat: 1, UnsignedByteType: 1, SRGBColorSpace: 's', NoColorSpace: '',
};
// the mean colour of an albedo map (RGBA bytes)
const meanOf = (img: any): number => { const d = img.data; let r = 0, g = 0, b = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n); };
const kitFor = (spec: any) => createMaterialKit({ THREE: STUB, palette: kitPalette(spec), seed: spec.id, defaults: spec.defaults === 2 ? 2 : 1, keep: (spec.palette && spec.palette.keep) || [], roofPull: !(spec.palette && spec.palette.roofPull === false), roofColors: (spec.roofs || []).filter(r => r.color).map(r => hex(r.color)) } as any);

test('restraint: no palette.restraint / keep is today\'s palette, byte for byte, on all 30 houses', () => {
  for (const s of fleet) assert.deepEqual(kitPalette(s), restrainPalette({ ...BASE_PALETTE, ...(s.palette || {}) }), s.id);
});

test('restraint 0..1 moves each role from its authored colour to today\'s restrained one', () => {
  const spec = (r?: number) => ({ id: 'x', palette: { wall: '#0ea5e9', roof: '#c2410c', material: 'stucco', ...(r === undefined ? {} : { restraint: r }) } });
  const full = kitPalette(spec()), none = kitPalette(spec(0)), half = kitPalette(spec(0.5));
  assert.equal(none.wall, '#0ea5e9'); assert.equal(none.roof, '#c2410c');
  assert.equal(full.wall, kitPalette(spec(1)).wall);
  assert.notEqual(full.wall, '#0ea5e9');   // today's clamp: #0ea5e9 builds a grey-blue
  const sat = c => { const [r, g, b] = [hex(c) >> 16 & 255, hex(c) >> 8 & 255, hex(c) & 255]; return Math.max(r, g, b) - Math.min(r, g, b); };
  assert.ok(sat(none.wall) > sat(half.wall) && sat(half.wall) > sat(full.wall), `${none.wall} > ${half.wall} > ${full.wall}`);
});

test('restraint under defaults 2 defaults to D2_RESTRAINT: a cobalt keeps most of its saturation without a keep line; an authored restraint wins', () => {
  const sat = c => { const [r, g, b] = [hex(c) >> 16 & 255, hex(c) >> 8 & 255, hex(c) & 255]; return (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b)); };
  const s1 = { id: 'x', palette: { wall: '#1a86e8', roof: '#c2410c', material: 'stucco' } };
  assert.equal(restraintOf(s1), 1); assert.equal(restraintOf({ ...s1, defaults: 2 }), D2_RESTRAINT);
  assert.equal(restraintOf({ ...s1, defaults: 2, palette: { ...s1.palette, restraint: 1 } }), 1, 'an authored restraint wins under defaults 2 too');
  const p1 = kitPalette(s1), p2 = kitPalette({ ...s1, defaults: 2 }), pk = kitPalette({ ...s1, defaults: 2, palette: { ...s1.palette, keep: ['wall'] } });
  assert.ok(sat(p2.wall) > sat(p1.wall) + 0.15, `${p1.wall} (${sat(p1.wall).toFixed(2)}) → ${p2.wall} (${sat(p2.wall).toFixed(2)})`);
  assert.ok(sat(p2.wall) < sat(pk.wall), 'a neon wall is still tamed a little without keep');
  assert.equal(pk.wall, '#1a86e8');
  // the whole fleet under defaults 2: never less saturated than restraint 1 gives, and the houses that lost > 0.05 of their
  // wall's saturation to it (12 of 30) get most of it back
  let regained = 0;
  for (const s of fleet) {
    const at = (p: any) => sat(kitPalette({ ...s, defaults: 2, palette: { ...(s.palette || {}), ...p } }).wall);
    const full = at({ restraint: 1 }), dflt = kitPalette({ ...s, defaults: 2 }).wall;
    assert.ok(sat(dflt) >= full - 1e-9, s.id);
    if (sat(dflt) - full > 0.05) regained++;
  }
  assert.ok(regained >= 8, `${regained} houses regain more than 0.05 of wall saturation`);
  // and a defaults-1 house is untouched (today's palette, byte for byte: the first test)
});

test('palette.keep exempts named roles: a saturated cobalt survives, the others are still restrained', () => {
  const s = { id: 'k', palette: { wall: '#1f4fd1', roof: '#c2410c', accent: '#e11d48', interior: '#fde68a', keep: ['wall', 'accent'] } };
  const p = kitPalette(s);
  assert.equal(p.wall, '#1f4fd1');
  assert.notEqual(p.roof, '#c2410c');
  assert.notEqual(p.interior, '#fde68a');
  const kit = kitFor(s);
  assert.equal(kit.colors.accent, hex('#e11d48'), 'the accent role keeps its colour');
  assert.notEqual(kitFor({ id: 'k', palette: { accent: '#e11d48' } }).colors.accent, hex('#e11d48'), 'without keep it is restrained');
  // a storey's own wall colour is kept too (levels[].material + wallColor)
  assert.deepEqual(levelWall(s, { material: 'siding', wallColor: '#1f4fd1' }), { kind: 'siding', color: '#1f4fd1' });
});

test('levels[].material and wallColor: a storey\'s own cladding; wallColor alone only under defaults 2', () => {
  const s1 = { id: 'l', palette: { wall: '#eeeae3', material: 'stucco' } };
  assert.equal(levelWall(s1, { wallColor: '#9a4b3a' }), null, 'defaults 1: wallColor keeps today\'s meaning');
  assert.deepEqual(levelWall(s1, { material: 'brick' }), { kind: 'brick', color: kitPalette(s1).wall });
  const lw = levelWall({ ...s1, defaults: 2 }, { wallColor: '#9a4b3a' });
  assert.equal(lw.kind, 'stucco'); assert.ok(lw.color !== '#9a4b3a', 'restrained like any wall');
  const kit = kitFor(s1);
  assert.equal(kit.cladding({ kind: 'stucco', color: kitPalette(s1).wall }), kit.cladding(), 'the house\'s own pair is the house\'s material');
  assert.equal(kit.cladding({ kind: 'brick', color: '#9a4b3a' }), kit.cladding({ kind: 'brick', color: '#9a4b3a' }), 'cached per (kind, colour)');
  assert.notEqual(kit.cladding({ kind: 'brick', color: '#9a4b3a' }), kit.cladding({ kind: 'brick', color: '#8a3b2a' }));
});

test('kit.wallColor is levelWall\'s rule for a colour that did not come through the palette (S2\'s zones); kit.claddingFor is kit.cladding', () => {
  for (const spec of [{ id: 'w1', palette: { material: 'brick' } }, { id: 'w2', defaults: 2 }, { id: 'w3', defaults: 2, palette: { restraint: 0.7 } }, { id: 'w4', palette: { keep: ['wall'] } }]) {
    const kit = kitFor({ ...spec, palette: { ...(spec as any).palette } });
    const restraint = restraintOf(spec);
    const k2 = createMaterialKit({ THREE: STUB, palette: kitPalette(spec), seed: spec.id, defaults: (spec as any).defaults === 2 ? 2 : 1, keep: ((spec as any).palette && (spec as any).palette.keep) || [], restraint } as any);
    for (const kind of ['stucco', 'brick']) for (const c of ['#1f4fd1', '#c2410c', '#e6e2da']) {
      const rule = levelWall({ ...spec, palette: { ...(spec as any).palette, material: kind } }, { material: kind, wallColor: c });
      assert.equal(css(k2.wallColor(c, kind)), rule.color, `${spec.id} ${kind} ${c}`);
    }
    assert.equal(kit.claddingFor, kit.cladding);
  }
});

test('roomKind: rooms[].program before the name (C2); the name as before without one', () => {
  assert.equal(roomKind({ name: 'Library & Bar' }), 'living');
  assert.equal(roomKind({ name: 'Library & Bar', program: 'library' }), 'work');
  assert.equal(roomKind({ name: 'Sunset Terrace Suite', program: 'outdoor' }), 'outdoor');
  assert.equal(roomKind({ name: 'Den', program: 'kitchen-dining' }), 'kitchen');
  assert.equal(roomKind('Primary Bedroom'), 'bed', 'a name alone still works');
  assert.equal(roomKind({ name: 'Box Room', program: 'not-a-program' }), 'room');
  for (const p of ['living', 'kitchen', 'dining', 'kitchen-dining', 'bed-primary', 'bed-kid', 'bed-guest', 'nursery', 'bath', 'ensuite', 'powder', 'study', 'library', 'den', 'media', 'playroom', 'sunroom', 'greenhouse', 'foyer', 'hall', 'laundry', 'studio', 'bar', 'gym', 'garage', 'outdoor'])
    assert.ok(programKind(p), `program ${p} maps to a fixture kind`);
});

test('door colours: the opening\'s own, palette.door, then (defaults 2) timber or trim by style — never teal', () => {
  const base = { id: 'd', style: 'Modern box', palette: { wall: '#f4f4f2', trim: '#1c1d1f', material: 'stucco' } };
  assert.equal(doorColour(base, 'entry'), undefined, 'defaults 1: the page\'s own (teal)');
  assert.equal(doorColour(base, 'entry', { own: '#3A2C22' }), '#3a2c22');
  assert.equal(doorColour({ ...base, palette: { ...base.palette, door: '#4e6690' } }, 'entry'), '#4e6690');
  const d2 = { ...base, defaults: 2 };
  assert.equal(doorStyleOf(d2), 'trim'); assert.equal(doorColour(d2, 'entry'), '#1c1d1f', 'a modern dark trim: the leaf is the trim');
  const cottage = { ...d2, style: 'Brick cottage', palette: { ...base.palette, material: 'brick', trim: '#f4f4f2' } };
  assert.equal(doorStyleOf(cottage), 'timber');
  const leaf = doorColour(cottage, 'entry', { wood: 0x2e2622 });
  assert.ok(lum(hex(leaf)) >= 0.18, `a timber leaf never reads black (${leaf})`);
  assert.notEqual(leaf, '#0f766e');
  assert.equal(doorColour(d2, 'interior'), css(colourMath.mix(hex(kitPalette(d2).wall), 0xffffff, 0.5)), 'a painted house hangs painted leaves');
  // over the 30 houses under defaults 2 no leaf is teal
  for (const s of fleet) { const c = doorColour({ ...s, defaults: 2 }, 'entry', { wood: kitFor(s).colors.wood }); assert.ok(c && c !== '#0f766e', s.id); }
});

test('leaves: a leaf to 1.1 m, a cased opening above — and a pair to 1.8 m under defaults 2', () => {
  assert.equal(leafKindOf({}, { w: 0.9 }), 'single');
  assert.equal(leafKindOf({}, { w: 1.6 }), 'none');
  assert.equal(leafKindOf({ defaults: 2 }, { w: 1.6 }), 'double');
  assert.equal(leafKindOf({ defaults: 2 }, { w: 2.2 }), 'none');
  assert.equal(leafKindOf({}, { w: 1.6, leaf: 'french' }), 'french');
});

test('roof colour: keep \'roof\' (or roofPull false under defaults 2) renders the authored colour within ΔE 3', () => {
  for (const [c, kind] of [['#8e3b2f', 'gable'], ['#2f4a6b', 'shed'], ['#3b3f2c', 'flat']] as const) {
    const s = { id: `roof-${kind}`, palette: { keep: ['roof'] }, roofs: [{ type: kind, color: c }] };
    const kit = kitFor(s), mat = kit.roofMaterial(kind, hex(c));
    const mean = meanOf(mat.params.map.image);
    const dE = deltaE(mean, c);
    assert.ok(dE <= 3, `${kind} ${c}: the roof's mean albedo ${css(mean)} is ΔE ${dE.toFixed(2)} off`);
    // and without keep, today's restraint and charcoal pull move it well away
    const pulled = meanOf(kitFor({ id: s.id, roofs: s.roofs }).roofMaterial(kind, hex(c)).params.map.image);
    assert.ok(deltaE(pulled, c) > 3, `${kind}: without keep the roof is pulled (${css(pulled)})`);
  }
  const d2 = { id: 'r2', defaults: 2, roofs: [{ type: 'gable', color: '#6b4a3a' }] };
  const k2 = kitFor(d2), m = k2.roofMaterial({ finish: 'gable', color: '#6b4a3a' });
  assert.ok(m, 'the object form works');
});

test('fans: under defaults 2 at most 25 % of eligible rooms, never a kitchen, a bath or the hero\'s room; fixtures.fan wins', () => {
  const s = fixture('s1-kit-look');
  const plan = fanPlan(s, fanEligible), hr = heroRoom(s);
  let eligible = 0, fans = 0;
  (s.levels || []).forEach(lv => (lv.rooms || []).forEach((r, ri) => {
    const k = `${lv.id}#${ri}`, v = plan.get(k), kind = roomKind(r);
    if (r.fixtures && typeof r.fixtures.fan === 'boolean') { assert.equal(v, r.fixtures.fan, `${r.name}: fixtures.fan wins`); return; }
    if (kind === 'kitchen' || kind === 'bath') assert.notEqual(v, true, `${r.name}: never a ${kind}`);
    if (hr && hr.lv === lv && hr.ri === ri) assert.equal(v, false, 'never the hero\'s room');
    if (fanEligible(r)) { eligible++; if (v) fans++; }
  }));
  assert.ok(eligible >= 4, `the fixture has fan-eligible rooms (${eligible})`);
  assert.ok(fans <= Math.floor(eligible * 0.25), `${fans} fans in ${eligible} eligible rooms`);
  // defaults 1 leaves the plan to the geometry (today's rule)
  assert.equal(fanPlan({ ...s, defaults: 1, levels: s.levels.map(l => ({ ...l, rooms: l.rooms.map(r => ({ ...r, fixtures: undefined })) })) }, fanEligible).size, 0);
});

test('fans: a seeded winner is a room a fan can hang in — an authored pendant over the centre, or a chandelier, rules it out', () => {
  const room = (items: any[] = [], fixtures?: any) => ({ name: 'Living Room', bounds: { x: 0, z: 0, w: 3.2, d: 3.2 }, items, ...(fixtures ? { fixtures } : {}) });
  assert.equal(fanSpot(room()), true);
  assert.equal(fanSpot(room([{ type: 'pendant-lamp', at: [1.6, 1.6] }])), false, 'a pendant at the centre of a small room: every spot within 1.17 m of it, or too near a wall');
  assert.equal(fanSpot({ name: 'Big', bounds: { x: 0, z: 0, w: 5, d: 4 }, items: [{ type: 'pendant-lamp', at: [2.5, 2] }] }), true, 'a big room has a spot off-centre (fixtures.ts tries the centre and four spots along the long axis)');
  assert.equal(fanSpot(room([{ type: 'ceiling-light', at: [0.4, 0.4] }])), true, 'a light in a corner leaves the centre free');
  assert.equal(fanSpot(room([], { ceiling: 'chandelier' })), false);
  assert.equal(fanSpot({ name: 'Box', bounds: { x: 0, z: 0, w: 1.6, d: 1.6 } }), false, 'no room for the blades');
  const lv = (r: any) => ({ id: 'l1', rooms: [r], partitions: [{ from: [1.6, 0], to: [1.6, 3.2] }] });
  assert.equal(fanSpot(room(), lv(room())), false, 'a partition through the middle');
  // the plan never gives a fan to a room that cannot hang one: 8 living rooms, the first four with a pendant at the centre
  const rooms = Array.from({ length: 8 }, (_, i) => ({ name: `Living ${i}`, bounds: { x: i * 6, z: 0, w: 3.2, d: 3.2 }, items: i < 4 ? [{ type: 'pendant-lamp', at: [i * 6 + 1.6, 1.6] }] : [] }));
  const plan = fanPlan({ id: 'fanspot', defaults: 2, levels: [{ id: 'l1', rooms }] }, r => true);
  rooms.forEach((r, i) => { if (i < 4) assert.equal(plan.get(`l1#${i}`), false, r.name); });
  assert.equal([...plan.values()].filter(Boolean).length, 1, 'a quarter of the four rooms that can hang one');
  // the fleet under defaults 2: a minority of the rooms that can hang a fan (a quarter, in expectation), not none — a house
  // with fewer than four such rooms gets one with a seeded chance (n / 4), so small houses are not fanless by arithmetic
  let spots = 0, fans = 0;
  for (const h of fleet) {
    const p = fanPlan({ ...h, defaults: 2 }, fanEligible);
    (h.levels || []).forEach(l => (l.rooms || []).forEach((r, ri) => { if (fanEligible(r) && fanSpot(r, l)) spots++; if (p.get(`${l.id}#${ri}`) === true) fans++; }));
  }
  assert.ok(fans >= 3, `${fans} fans over ${spots} rooms that can hang one`);
  assert.ok(fans <= Math.ceil(spots * 0.3), `${fans} fans over ${spots} rooms that can hang one`);
});

test('lamps: at least 3 kinds across a 10-room house under defaults 2; rooms[].fixtures.lamp wins; none under defaults 1', () => {
  const s = fixture('s1-kit-look');
  const plan = lampPlan(s), kinds = new Set([...plan.values()].filter(Boolean));
  const rooms = s.levels.reduce((n, l) => n + (l.rooms || []).length, 0);
  assert.ok(rooms >= 10, `${rooms} rooms`);
  assert.ok(kinds.size >= 3, `${[...kinds].join(', ')}`);
  for (const k of kinds) assert.ok((LAMP_KINDS as readonly string[]).includes(k as string));
  s.levels.forEach(lv => lv.rooms.forEach((r, ri) => { if (r.fixtures && r.fixtures.lamp) assert.equal(plan.get(`${lv.id}#${ri}`), r.fixtures.lamp); }));
  assert.ok([...lampPlan({ ...s, defaults: 1, levels: s.levels.map(l => ({ ...l, rooms: l.rooms.map(r => ({ ...r, fixtures: undefined })) })) }).values()].every(v => v === null));
});

test('lamps: any five rooms that HAVE a lamp show all five heads; a room without a lamp spends none; a lamp-less room still gets its own pick', () => {
  const lamp = (t: string) => ({ type: t, at: [1, 1] });
  const types = ['floor-lamp', 'table-lamp', 'arc-floor-lamp', 'tripod-floor-lamp', 'halo-lamp'];
  for (let seed = 0; seed < 25; seed++) {
    // rooms alternate lamp / no lamp / no lamp: a plan that spent a kind per room would repeat one by the fifth lamp room
    const rooms = Array.from({ length: 15 }, (_, i) => ({ name: `R${i}`, bounds: { x: 0, z: 0, w: 4, d: 4 }, items: i % 3 === 0 ? [lamp(types[(i / 3) % 5])] : [] }));
    const plan = lampPlan({ id: `lampseed${seed}`, defaults: 2, levels: [{ id: 'l1', rooms }] });
    const kinds = rooms.map((r, i) => r.items.length ? plan.get(`l1#${i}`) : null).filter(Boolean);
    assert.equal(kinds.length, 5); assert.equal(new Set(kinds).size, 5, `seed ${seed}: ${kinds.join(', ')}`);
    rooms.forEach((r, i) => { if (!r.items.length) assert.ok((LAMP_KINDS as readonly string[]).includes(plan.get(`l1#${i}`) as string), 'a room without a lamp still has a kind for S3\'s'); });
  }
  for (const t of types) assert.ok(LAMP_ITEMS.has(t), t);
  // the same house twice: the same plan
  const s = fixture('s1-kit-look');
  assert.deepEqual([...lampPlan(s)], [...lampPlan(s)]);
});

test('validator: door ids are strings, once — a repeated one warns kit:duplicate-id; a partition doorway that wide with only a doorColor warns kit:wide-leaf', () => {
  const base = fixture('s1-kit-look'); delete base.fixture;
  const run = (mod: (s: any) => void) => { const s = JSON.parse(JSON.stringify(base)); mod(s); return validate(s, '<spec>'); };
  assert.equal(run(() => {}).warnings.filter(w => /duplicate-id|door id/.test(w)).length, 0);
  const dup = run(s => { s.levels[0].partitions.find(p => p.id === 'kitchen-pass').id = 'pass'; });
  assert.ok(dup.warnings.some(w => /duplicate-id/.test(w)), dup.warnings.join('\n'));
  const bad = run(s => { s.levels[0].openings.find(o => o.id === 'front').id = 7; });
  assert.ok(bad.errors.some(e => /id 7/.test(e)), bad.errors.join('\n'));
  const wide = run(s => { const p = s.levels[0].partitions.find(q => q.id === 'pass'); delete p.doorStyle; p.doorColor = '#6a4e33'; });
  assert.ok(wide.warnings.some(w => /wide-leaf/.test(w)), wide.warnings.join('\n'));
});

test('light: defaults 1 keeps the preset\'s swing; sunBearing is a compass bearing; defaults 2 spreads the fleet\'s suns', () => {
  for (const s of fleet) assert.equal(lightingOf(s).swing, TIME_OF_DAY[lightingOf(s).preset].sun.swing, s.id);
  const L = lightingOf({ id: 'b', lighting: { preset: 'golden', sunBearing: 225 } });
  assert.equal(L.preset, 'golden'); assert.equal(sunBearingOf(L, [0, 1]), 225);
  // the page's sun for bearing 225 (south-west) from a south entry: +z (south) and −x (west)
  const dir = sunDirection(TIME_OF_DAY.golden, [0, 1], swingForBearing(225, [0, 1]));
  assert.ok(dir[0] < 0 && dir[2] > 0, `sun toward the south-west: ${dir.map(v => v.toFixed(2))}`);
  assert.equal(lightingOf({ id: 'a', lighting: 'ci-twilight' }).alias, 'ci-twilight');
  assert.equal(lightingOf({ id: 'a', lighting: 'ci-twilight' }).preset, 'golden');
  // the whole fleet under defaults 2: no 15° bearing bucket above 25 %
  const buckets = new Map<number, number>();
  for (const s of fleet) { const b = Math.floor(sunBearingOf(lightingOf({ ...s, defaults: 2 }), [0, 1]) / 15) * 15; buckets.set(b, (buckets.get(b) || 0) + 1); }
  const top = Math.max(...buckets.values());
  assert.ok(top / fleet.length <= 0.25, `top bucket ${top} of ${fleet.length}`);
});

test('the true-white look: look 1 is the preset itself; look 2 pulls golden and dusk toward white and holds saturation', () => {
  for (const [name, p] of Object.entries(TIME_OF_DAY)) {
    assert.equal(lookOf(p, 1), p, name);
    const q: any = lookOf(p, 2);
    assert.ok(q.grade.saturation >= 0.86 && q.grade.saturation >= p.grade.saturation, name);
    const b = q.balance, y = 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2];
    assert.ok(Math.abs(y - 1) < 1e-3, `${name}: the balance keeps exposure (luma ${y})`);
  }
  // golden hour's key light: bluer after the balance (the warm cast is partly taken out)
  const g: any = lookOf(TIME_OF_DAY.golden, 2);
  assert.ok(g.balance[2] > g.balance[0], `golden balance ${g.balance}`);
});

test('finishes: every kit.finish kind builds a power-of-two texture set, deterministically', () => {
  const k1 = kitFor({ id: 'finish' }), k2 = kitFor({ id: 'finish' });
  for (const kind of FINISH_KINDS) {
    const m1 = k1.finish(kind), m2 = k2.finish(kind), t1 = m1.params.map.image, t2 = m2.params.map.image;
    for (const n of [t1.width, t1.height]) assert.equal(n & (n - 1), 0, `${kind}: ${t1.width}×${t1.height} is not a power of two`);
    const h = img => crypto.createHash('sha256').update(img.data).digest('hex');
    assert.equal(h(t1), h(t2), `${kind}: two kits, two different textures`);
  }
  // wallpaper's 'grid', a checker's second colour, an unknown kind flagged
  const g = k1.finish('wallpaper', { pattern: 'grid' }).params.map.image, st = k1.finish('wallpaper', { pattern: 'stripe' }).params.map.image, bt = k1.finish('wallpaper', { pattern: 'botanical' }).params.map.image;
  const hh = img => crypto.createHash('sha256').update(img.data).digest('hex');
  assert.notEqual(hh(g), hh(st)); assert.notEqual(hh(g), hh(bt));
  assert.notEqual(hh(k1.finish('checker').params.map.image), hh(k1.finish('checker', { color2: '#7a1f1f' }).params.map.image), 'checker color2 reaches the texture');
  assert.equal(k1.finish('not-a-finish').userData.finishFallback, 'not-a-finish');
  assert.equal(k1.finish('paint').userData.finishFallback, undefined);
  // pattern and colour reach the texture
  const a = k1.finish('wallpaper', { pattern: 'dot' }).params.map.image, b = k1.finish('wallpaper', { pattern: 'stripe' }).params.map.image;
  assert.notEqual(crypto.createHash('sha256').update(a.data).digest('hex'), crypto.createHash('sha256').update(b.data).digest('hex'));
});

test('determinism: every rule twice over the fleet under defaults 2 gives the same answer', () => {
  const run = () => fleet.map(s => { const d = { ...s, defaults: 2 }; return JSON.stringify([kitPalette(d), lightingOf(d), [...fanPlan(d, fanEligible)], [...lampPlan(d)], doorColour(d, 'entry', { wood: kitFor(d).colors.wood })]); });
  assert.deepEqual(run(), run());
});
