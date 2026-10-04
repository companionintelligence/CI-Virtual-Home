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
import { ROOM_FILL_K, FILL_PENUMBRA, FILL_ANGLE_MAX, FILL_ON_GAIN, LIGHT_CAP, hideOffGain, applyLampGain } from '../assets/fixtures.js';
import { TIME_OF_DAY } from '../assets/environment.js';

test('L1: the room light is a soft fill (numbers the acceptance was calibrated on)', () => {
  assert.equal(ROOM_FILL_K, 0.3);
  assert.equal(FILL_PENUMBRA, 1.0);
  assert.ok(FILL_ANGLE_MAX <= 1.25 + 1e-9);
  assert.equal(LIGHT_CAP, 16);
});

test('L1: only daylight turns the fill off, and only the offline path hides it', () => {
  for (const [name, p] of Object.entries(TIME_OF_DAY)) assert.equal(p.lampGain < FILL_ON_GAIN, name === 'day', `${name} lampGain ${p.lampGain}`);
  assert.equal(hideOffGain(), true, 'no window (Node) is the offline path: hidden');
  applyLampGain(0.5);   // no house built: a no-op, not a throw
});
