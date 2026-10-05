#!/usr/bin/env -S node --experimental-strip-types
// LIGHT's pure rules in Node (plan 5.2): the finish-role table (L0), and, as the tasks land, the room-light numbers (L1) and the house
// scheme (F0). No browser, no THREE: everything here is data or a pure function. The rendered half of the stream is
// scripts/test-interior-light.mts.
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-light-rules.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FINISH_ROLES, METAL_KINDS, METAL_KIND_NAMES, metalKindOf } from '../assets/props/finish-roles.js';
import { STYLES } from '../assets/house-styles.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('finish roles: the values the plan names', () => {
  assert.equal(FINISH_ROLES.fabric.rough, 0.92); assert.equal(FINISH_ROLES.fabric.metal, 0);
  assert.equal(FINISH_ROLES.linen.albedoCap, 0.85);
  assert.equal(FINISH_ROLES.wood.rough, 0.55);
  assert.equal(FINISH_ROLES.lacquer.rough, 0.35);
  assert.equal(FINISH_ROLES.ceramic.rough, 0.3);
  assert.equal(FINISH_ROLES.glass.rough, 0.04);
  assert.equal(FINISH_ROLES.rubber.rough, 0.7);
  assert.equal(FINISH_ROLES.leaf.rough, 0.8); assert.equal(FINISH_ROLES.leaf.opaque, true);
});

test('finish roles: every row is a valid PBR pair and nothing but metals is metallic', () => {
  for (const [name, r] of Object.entries(FINISH_ROLES)) {
    assert.ok(r.rough >= 0 && r.rough <= 1, `${name} rough`);
    assert.ok(r.metal === 0, `${name} is not a metal role`);
    assert.ok(r.note.length > 3, `${name} has a note`);
  }
  for (const [name, m] of Object.entries(METAL_KINDS)) {
    assert.ok(m.rough > 0 && m.rough < 0.5, `${name} rough`); assert.ok(m.metal >= 0.75 && m.metal <= 1, `${name} metal`);
    assert.ok(m.color > 0 && m.color <= 0xffffff && m.env >= 1, `${name} colour and env`);
  }
});

test('metals: black is today\'s constant, every style names a known kind, unknown falls back to black', () => {
  assert.equal(METAL_KINDS.black.color, 0x2b2f33);
  for (const s of Object.values(STYLES)) assert.ok(METAL_KIND_NAMES.includes(s.metal), `${s.key}.metal ${s.metal}`);
  assert.equal(metalKindOf('brass'), 'brass'); assert.equal(metalKindOf('gold'), 'black'); assert.equal(metalKindOf(undefined), 'black');
});

test('finish-roles.ts is data only: no import, no THREE, no clock, no random', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'props', 'finish-roles.ts'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'no import');
  assert.ok(!/THREE|Math\.random|Date\.now|performance\.now/.test(src.replace(/\/\/.*$/gm, '')), 'no THREE, random or clock outside comments');
});

test('the baked-model role table agrees with the finish roles where both name a role', () => {
  const model = fs.readFileSync(path.join(ROOT, 'assets', 'props', 'model-kit.ts'), 'utf8');
  const rough = (role: string) => { const m = model.match(new RegExp(`\\n  ${role}: \\{[^}]*rough: ([0-9.]+)`)); return m ? Number(m[1]) : null; };
  assert.equal(rough('fabric'), FINISH_ROLES.fabric.rough);
  assert.equal(rough('fabric2'), FINISH_ROLES.fabric2.rough);
  assert.equal(rough('linen'), FINISH_ROLES.linen.rough);
  assert.equal(rough('wood'), FINISH_ROLES.wood.rough);
  assert.equal(rough('ceramic'), FINISH_ROLES.ceramic.rough);
  assert.equal(rough('rubber'), FINISH_ROLES.rubber.rough);
});

// ---- L1: the room fill ------------------------------------------------------------------------------------------------------------------
import { ROOM_FILL_K, FILL_PENUMBRA, FILL_ANGLE_MAX, FILL_ON_GAIN, LIGHT_CAP, hideOffGain, applyLampGain, lightLevel } from '../assets/fixtures.js';
import { TIME_OF_DAY, lookOf } from '../assets/environment.js';

test('L1: the room light is a soft fill (numbers the acceptance was calibrated on)', () => {
  assert.equal(ROOM_FILL_K, 0.375);
  assert.equal(FILL_PENUMBRA, 1.0);
  assert.ok(FILL_ANGLE_MAX <= 1.25 + 1e-9);
  assert.equal(LIGHT_CAP, 16);
});

test('L1: only daylight turns the fill off, and off is intensity 0 in every path (no hiding: nothing recompiles on a time-of-day switch)', () => {
  for (const [name, p] of Object.entries(TIME_OF_DAY)) assert.equal(p.lampGain < FILL_ON_GAIN, name === 'day', `${name} lampGain ${p.lampGain}`);
  assert.equal(hideOffGain(), false, 'no window (Node) is no hiding: v1 hid the lights offline and the editor stalled seconds on the first toggle');
  assert.equal(lightLevel(5, TIME_OF_DAY.day.lampGain), 0, 'off by day');
  assert.equal(lightLevel(5, TIME_OF_DAY.dusk.lampGain), 5 * TIME_OF_DAY.dusk.lampGain);
  applyLampGain(0.5);   // no house built: a no-op, not a throw
});

// ---- L2: the ceiling bounce -------------------------------------------------------------------------------------------------------------
import { applyHouseGlow, BOUNCE_COLOR } from '../assets/environment.js';

const stubTHREE = { Color: class { hex: number; constructor(h: number) { this.hex = h; } } };
const mat = (bounce?: number) => ({ userData: bounce === undefined ? {} : { bounce }, emissive: { hex: 0, setHex(h: number) { this.hex = h; } }, emissiveIntensity: 1 });
const rootOf = (...mats: any[]) => ({ traverse(f: (o: any) => void) { f({ userData: {} }); for (const m of mats) f({ isMesh: true, material: m, userData: {} }); } });

test('L2: every preset carries a bounce, brightest by day, never over the cap that keeps a ceiling under the walls', () => {
  for (const [name, p] of Object.entries(TIME_OF_DAY)) assert.ok(typeof p.bounce === 'number' && p.bounce > 0 && p.bounce <= 0.15, `${name}.bounce ${p.bounce}`);
  assert.ok(TIME_OF_DAY.day.bounce >= TIME_OF_DAY.dusk.bounce && TIME_OF_DAY.day.bounce >= TIME_OF_DAY.night.bounce);
  for (const k of [1, 2] as const) assert.equal(lookOf(TIME_OF_DAY.dusk, k).bounce, TIME_OF_DAY.dusk.bounce, `look ${k} keeps it`);
});

test('L2: applyHouseGlow sets a tagged ceiling to the hour\'s bounce, scales a textured one, leaves everything else alone, and is idempotent', () => {
  const flat = mat(1), timber = mat(0.5), wall = mat(), noEmissive: any = { userData: { bounce: 1 } };
  const root = rootOf(flat, timber, wall, noEmissive);
  for (const t of ['dusk', 'night', 'day', 'dusk', 'night', 'day', 'dusk']) {
    const r = applyHouseGlow(stubTHREE, root, TIME_OF_DAY[t]);
    assert.equal(r.bounced, 2, 'two tagged materials with an emissive');
    assert.equal(flat.emissiveIntensity, TIME_OF_DAY[t].bounce);
    assert.equal(timber.emissiveIntensity, TIME_OF_DAY[t].bounce * 0.5);
    assert.equal(flat.emissive.hex, BOUNCE_COLOR);
    assert.equal(wall.emissiveIntensity, 1, 'an untagged surface keeps its emissive intensity');
    assert.equal(wall.emissive.hex, 0);
  }
});

test('L2: the sources tag the ceilings and the batcher knows the tag', () => {
  const read = (f: string) => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
  assert.match(read('kit-build.ts'), /m\.userData\.bounce = 1/);
  assert.match(read('arch-materials.ts'), /userData\.bounce = 0\.5/);
  assert.match(read('arch-materials.ts'), /userData\.bounce = 1/);
  assert.match(read('viewer-batch.ts'), /BENIGN_MATERIAL_USERDATA = new Set\(\[[^\]]*'bounce'/);
  assert.match(read('viewer-batch.ts'), /MUTATED_MATERIAL_KEYS = \[[^\]]*'bounce'/);
});

// ---- F0: the house scheme ---------------------------------------------------------------------------------------------------------------
import { schemeOf, SCHEME_STYLES, LAMP_COLORS } from '../assets/house-scheme.js';
import { STYLE_KEYS } from '../assets/house-styles.js';

const HOUSES_DIR = path.join(ROOT, 'content', 'houses');
const fleetSpecs = fs.readdirSync(HOUSES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(HOUSES_DIR, f), 'utf8')));

test('F0: every style has a scheme row, and the scheme reads the style the house is furnished in', () => {
  assert.deepEqual([...SCHEME_STYLES].sort(), [...STYLE_KEYS].sort());
  assert.equal(schemeOf({ styleKey: 'cottage' }).metal, 'brass');
  assert.equal(schemeOf({ styleKey: 'modern' }).metal, 'black');
  assert.equal(schemeOf({ styleKey: 'craftsman' }).metal, 'bronze');
  assert.equal(schemeOf({ styleKey: 'industrial' }).metal, 'steel');
  assert.equal(schemeOf({ style: 'A queen anne farmhouse with a wrap porch' }).style, 'farmhouse', 'the free-text style is read when there is no styleKey');
  assert.equal(schemeOf({}).style, 'modern', 'no style at all is modern');
});

test('F0: schemeOf is pure: same spec, equal scheme, and the spec is untouched', () => {
  for (const spec of fleetSpecs) {
    const before = JSON.stringify(spec);
    assert.deepEqual(schemeOf(spec), schemeOf(spec), spec.id);
    assert.equal(JSON.stringify(spec), before, `${spec.id} not mutated`);
  }
});

test('F0: the shipped fleet gets a metal the plan expects (cottage brass, modern black) and lamp colours that are today\'s or warmer', () => {
  const metals = new Map<string, Set<string>>();
  for (const spec of fleetSpecs) { const s = schemeOf(spec); (metals.get(s.style) || metals.set(s.style, new Set()).get(s.style)!).add(s.metal); assert.ok([2700, 3000, 3500].includes(s.lampK)); assert.equal(s.lampColor, LAMP_COLORS[s.lampK]); }
  for (const [style, ms] of metals) assert.equal(ms.size, 1, `${style}: one metal per style`);
  assert.deepEqual([...metals.get('cottage') || []], ['brass']);
  assert.deepEqual([...metals.get('modern') || []], ['black']);
  assert.equal(LAMP_COLORS[3000], 0xffd7a8, '3000 K is the WARM the fixtures have always used');
  for (const k of [2700, 3000, 3500] as const) { const c = LAMP_COLORS[k]; assert.ok((c >> 16) === 0xff, 'red channel full'); }
  assert.ok(LAMP_COLORS[2700] < LAMP_COLORS[3000] && LAMP_COLORS[3000] < LAMP_COLORS[3500], 'warmer is lower in blue and green');
});

test('F0: schemes use only what exists: ceiling kinds room-finish builds, floors and walls the bundle lists, trim in a sane range', () => {
  const KINDS = new Set(['flat', 'timber', 'beams', 'tray']);
  for (const key of STYLE_KEYS) {
    const s = schemeOf({ styleKey: key });
    for (const k of Object.values(s.ceiling)) assert.ok(KINDS.has(k as string), `${key} ceiling ${k}`);
    assert.ok(s.trim.crown >= 0 && s.trim.crown <= 0.15, `${key} crown`);
    assert.deepEqual(s.floors, STYLES[key].finish.floor); assert.deepEqual(s.walls, STYLES[key].finish.wall);
  }
});

test('F0: house-scheme.ts is THREE-free and clock-free, and the kit carries it', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'house-scheme.ts'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/THREE|Math\.random|Date\.now|performance\.now/.test(src));
  assert.match(fs.readFileSync(path.join(ROOT, 'assets', 'kit-build.ts'), 'utf8'), /\.scheme = schemeOf\(spec\)/);
});

// ---- L3: lamp pools ---------------------------------------------------------------------------------------------------------------------
import { LAMP_ROOM_FILL_K, LAMP_POOL_I, LAMP_POOL_MAX, LAMP_POOL_REACH, LAMP_POOL_DECAY, LAMP_POOL_ANGLE, LAMP_POOL_PENUMBRA, LAMP_POOL_AIM_Y } from '../assets/fixtures.js';

test('L3: the pool numbers (design 3.1) and the fill a lamp room keeps', () => {
  assert.equal(LAMP_ROOM_FILL_K, 0, 'the pool is the lamp room\'s light: no spot beside it, so the room costs one light');
  assert.ok(LAMP_ROOM_FILL_K < ROOM_FILL_K);
  assert.equal(LAMP_POOL_DECAY, 1.6);
  assert.ok(LAMP_POOL_REACH > 0.5 && LAMP_POOL_REACH <= 1, 'the falloff reaches zero inside the room\'s diagonal');
  assert.ok(LAMP_POOL_I > 0 && LAMP_POOL_MAX >= 1);
  assert.equal(LAMP_POOL_PENUMBRA, 1, 'no cone edge: the whole cone is the falloff');
  assert.ok(LAMP_POOL_ANGLE > 1.25 && LAMP_POOL_ANGLE < Math.PI / 2, 'a wide cone aimed into the room, not the omni light that blew the curtain and the pillow beside the lamp');
  assert.ok(LAMP_POOL_AIM_Y > 0.5 && LAMP_POOL_AIM_Y < 1.6);
});

test('L3: the fixtures read the lamp colour from the scheme and the lamps from kit-rules, and cap the lights they run', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'fixtures.ts'), 'utf8');
  assert.match(src, /schemeOf\(spec\)/); assert.match(src, /warm: scheme\.lampColor/);
  assert.ok(!/\bWARM\b/.test(src.replace(/\/\/.*$/gm, '')), 'no hard-coded WARM left');
  assert.match(src, /POOL_LAMPS\.has/);
  assert.match(src, /cost > left/, 'the budget is spent per room, in lights');
  assert.match(src, /LAMP_ROOM_FILL_K > 0 \? 2 : 1/, 'a lamp room costs two lights only when a fill is kept beside the pool');
});

test('LIGHT v3 (1): every free-standing lamp type the catalog places pools its room, not only the registry\'s four', async () => {
  const { POOL_LAMPS, SCONCES } = await import('../assets/fixtures.js');
  const { LAMP_ITEMS } = await import('../assets/kit-rules.js');
  for (const t of LAMP_ITEMS) assert.ok(POOL_LAMPS.has(t), `${t} (the registry's) still pools`);
  for (const t of ['column-lamp', 'ginger-lamp', 'globe-lamp', 'desk-lamp', 'mushroom-lamp', 'tripod-table-lamp']) assert.ok(POOL_LAMPS.has(t), `${t} lights its room`);
  assert.ok(!POOL_LAMPS.has('wall-sconce') && SCONCES.has('wall-sconce') && !POOL_LAMPS.has('pendant-lamp') && !POOL_LAMPS.has('lantern'), 'hung lights, sconces and flames are not pooled');
  // the catalog's own 'lamp' group is the list this one must not fall behind: every placed lamp type is pooled or named as an exception
  const place = fs.readFileSync(path.join(ROOT, 'assets', 'props', 'placement.ts'), 'utf8');
  const groups = [...place.matchAll(/^\s*'([a-z-]+)': def\('lamp',/gm)].map(m => m[1]);
  const exempt = new Set(['lantern']);
  for (const t of groups) assert.ok(POOL_LAMPS.has(t) || exempt.has(t), `placement.ts places ${t} as a lamp: pool it in fixtures.ts POOL_LAMPS or exempt it here`);
  assert.ok(groups.length >= 11, `read ${groups.length} lamp types out of placement.ts`);
});

// ---- the hours are in order (LIGHT v2 item 1) ------------------------------------------------------------------------------------------
// v1 pinned `night hemisphere >= 1.3`: a number tuned on ONE crush row (cutestarter bedroom) that put night above dusk and day. What the preset
// has to be is ordered, not a number: less sky fill at night than at dusk than by day, a warm ground colour (the lamps' bounce, not a cool sky
// shining up), and the environment image kept at 0.30.
import { ambientOf } from '../assets/environment.js';
import { capAlbedo } from '../assets/materials.js';
import { FINISH_ROLES as ROLES } from '../assets/props/finish-roles.js';

test('the hours are ordered: night ambient <= dusk <= day, in raw hemisphere intensity and in luminance-weighted light', () => {
  const { day, dusk, night } = TIME_OF_DAY;
  assert.ok(night.hemi.intensity <= dusk.hemi.intensity && dusk.hemi.intensity <= day.hemi.intensity, `hemisphere ${night.hemi.intensity} <= ${dusk.hemi.intensity} <= ${day.hemi.intensity}`);
  assert.ok(ambientOf(night) <= ambientOf(dusk) && ambientOf(dusk) <= ambientOf(day), `ambient ${ambientOf(night).toFixed(3)} <= ${ambientOf(dusk).toFixed(3)} <= ${ambientOf(day).toFixed(3)}`);
  assert.ok(night.env < dusk.env, 'the night sky image is dimmer than dusk\'s');
  assert.ok(night.sun.intensity < day.sun.intensity, 'and the sun is weaker than by day');
  assert.ok(ambientOf(night) > 0.15 && ambientOf(night) > ambientOf(dusk) * 0.4, 'night is dim, not black: shadows survive without a lamp');
});

test('night is moody and lamp-lit: hemisphere 1.0-1.1, a warm ground, env 0.30 kept', () => {
  const n = TIME_OF_DAY.night, g = parseInt(n.hemi.ground.slice(1), 16);
  assert.ok(n.hemi.intensity >= 1.0 && n.hemi.intensity <= 1.1, `hemisphere ${n.hemi.intensity}`);
  assert.ok(((g >> 16) & 255) > (g & 255), `ground ${n.hemi.ground} is warm (red above blue)`);
  assert.equal(n.env, 0.30);
  const s = parseInt(n.hemi.sky.slice(1), 16); assert.ok((s & 255) > ((s >> 16) & 255), 'the sky stays cool');
});

test('linen holds its albedo cap, so a bed can take a lamp without clipping (L0\'s 0.85, applied through colors.linen)', () => {
  const max = (c: number) => Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) / 255;
  assert.ok(max(capAlbedo(0xf2efe9, ROLES.linen.albedoCap)) <= ROLES.linen.albedoCap + 1 / 255);
  assert.ok(max(capAlbedo(0xf2efe9, ROLES.linen.albedoCap)) >= ROLES.linen.albedoCap - 2 / 255, 'and no darker than it must be');
  assert.equal(capAlbedo(0x808080, 0.85), 0x808080, 'a colour under the cap is untouched');
  const r = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255], a = r(0xf2efe9), b = r(capAlbedo(0xf2efe9, 0.85));
  assert.ok(Math.abs(a[0] / a[2] - b[0] / b[2]) < 0.02, 'hue kept: the channels scale together');
  assert.match(fs.readFileSync(path.join(ROOT, 'assets', 'materials.ts'), 'utf8'), /linen: capAlbedo\(0xf2efe9, FINISH_ROLES\.linen\.albedoCap\)/);
});
