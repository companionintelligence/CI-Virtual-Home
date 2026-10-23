#!/usr/bin/env -S node --experimental-strip-types
// The office's seams in the spec, the index and the validator (reference/office/office-contract-m0.md, I10 and I11): `use: "office"` on a HouseSpec, listSpecs / allHouses, the `offices` array
// beside an untouched `houses`, the validator plugin scripts/validate/office.mts, and the proof that none of it touches a home: the index rows of the 36 homes are the rows the
// builder always wrote, no plugin message appears for any of them, the type fragments compile to empty files, and without an office the index has no `offices` key at all.
// Needs `pnpm run build` (the validator loads the compiled engine).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validate } from './validate-house-spec.mts';
import { allHouses, listSpecs, specFileNames, specIds, specUse, type SpecError } from './lib/list-specs.mts';
import { apartmentIds, unitStoreys } from './apartment-unit.mts';
import { redactIndex } from './portal-redact.mts';
import { rectArea } from '../assets/house-geometry.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses');
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'offices', 'office-fixture-loft.json');
const fixture = (): any => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const homes = (): { id: string; spec: any }[] => specFileNames(HOUSES).map((f) => ({ id: f.replace(/\.json$/, ''), spec: JSON.parse(fs.readFileSync(path.join(HOUSES, f), 'utf8')) }));
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'office-spec-'));
const codesOf = (messages: string[]): string[] => messages.flatMap((m) => [...m.matchAll(/\[office:([a-z-]+)\]/g)].map((x) => x[1]));
// (the core marks each opening it has seen with a property it cannot define twice, so every run gets its own copy)
const run = (spec: any) => validate(structuredClone(spec), '<spec>');

test('specUse: an office only when the spec says so', () => {
  assert.equal(specUse({ use: 'office' }), 'office');
  for (const v of [{}, { use: 'home' }, { use: 'offices' }, { use: 7 }, null, undefined, 'office']) assert.equal(specUse(v), 'home', JSON.stringify(v));
});

test('listSpecs: the homes by default, the offices on request, both for the gates; allHouses reads both arrays', () => {
  const dir = tmp();
  for (const f of ['studio-loft', 'aurora']) fs.copyFileSync(path.join(HOUSES, `${f}.json`), path.join(dir, `${f}.json`));
  fs.copyFileSync(FIXTURE, path.join(dir, 'office-fixture-loft.json'));
  fs.writeFileSync(path.join(dir, 'index.json'), '{}');
  fs.writeFileSync(path.join(dir, 'aurora.plan.json'), '{}');
  assert.deepEqual(specFileNames(dir), ['aurora.json', 'office-fixture-loft.json', 'studio-loft.json'], 'index.json and a .plan.json are not specs');
  assert.deepEqual(specIds('home', dir), ['aurora', 'studio-loft']);
  assert.deepEqual(specIds('office', dir), ['office-fixture-loft']);
  assert.deepEqual(specIds('all', dir), ['aurora', 'office-fixture-loft', 'studio-loft']);
  assert.deepEqual(listSpecs({ dir }).map((e) => e.use), ['home', 'home'], 'the default is the homes');
  // a file that is not JSON is a broken home, not a hidden one
  fs.writeFileSync(path.join(dir, 'broken.json'), '{ nope');
  const errors: SpecError[] = [];
  assert.deepEqual(listSpecs({ dir, errors }).map((e) => e.id), ['aurora', 'broken', 'studio-loft']);
  assert.deepEqual(errors.map((e) => e.name), ['broken.json']);
  assert.deepEqual(listSpecs({ kind: 'office', dir }).map((e) => e.id), ['office-fixture-loft']);
  assert.deepEqual(allHouses({ houses: [{ id: 'a' }], offices: [{ id: 'o' }] }).map((h) => h.id), ['a', 'o']);
  assert.deepEqual(allHouses({ houses: [{ id: 'a' }] }).map((h) => h.id), ['a']);
  assert.deepEqual(allHouses(null), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the real folder: 36 homes today, no office in it (I10)', () => {
  assert.equal(specIds('home').length, specFileNames(HOUSES).length);
  assert.deepEqual(specIds('office'), [], 'M0 puts no office building in content/houses (the first one arrives with M1, after the gate sweep)');
});

test('the type fragments compile to empty files, so the shipped bytes do not move (I11), and the fixture is a HouseSpec', () => {
  for (const f of ['base', 'compose']) assert.equal(fs.statSync(path.join(ROOT, 'assets', 'spec', `${f}.js`)).size, 0, `assets/spec/${f}.js is empty (types only)`);
  const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'test-spec-types.mts'), FIXTURE], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /1 specs against HouseSpec/);
});

test('the fixture office validates with no error and no warning, and its file has no final newline (the homes\' convention)', () => {
  const r = run(fixture());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.ok(!fs.readFileSync(FIXTURE, 'utf8').endsWith('\n'));
  assert.equal(specUse(fixture()), 'office');
});

// a defect, the office rule that must catch it
const DEFECTS: [string, (s: any) => void, string][] = [
  ['an author who is a person', (s) => { s.author = 'some builder'; }, 'author'],
  ['a source that is not the office\'s', (s) => { s.source = 'a game'; }, 'author'],
  ['a night light', (s) => { s.lighting = 'dusk'; }, 'light'],
  ['a use that is neither', (s) => { s.use = 'offices'; }, 'use'],
  ['a head count of zero', (s) => { s.office.headcount = 0; }, 'fields'],
  ['a company that is not a slug', (s) => { s.office.company = 'Fixture Works'; }, 'fields'],
  ['seats that are not a whole number', (s) => { s.levels[0].rooms[3].seats = 2.5; }, 'fields'],
  ['a bedroom', (s) => { s.levels[0].rooms[2].name = 'Guest Bedroom'; }, 'names'],
  ['two rooms of one name', (s) => { s.levels[0].rooms[1].name = 'Meeting Room'; }, 'names'],
  ['no comms room', (s) => { s.levels[0].rooms[0].name = 'Quiet Room'; }, 'rooms'],
  ['no kitchen', (s) => { s.levels[0].rooms[1].name = 'Store Cupboard'; }, 'rooms'],
  ['the Core in the open office', (s) => { s.hero.at = [4, 5]; }, 'core'],
  ['the Core on an island', (s) => { s.hero.surface = 'island'; }, 'core'],
  ['a comms room under 3.6 m', (s) => { s.levels[0].rooms[0].bounds = { x: 0, z: 0, w: 3.4, d: 3.6 }; }, 'core'],
  ['a window on the comms room', (s) => { s.levels[0].openings.push({ side: 'W', at: 1.8, type: 'window', w: 1, h: 1.2, sill: 1.2 }); }, 'comms-blind'],
  ['a door on the comms room', (s) => { s.levels[0].openings.push({ side: 'N', at: 1.8, type: 'door', w: 1, h: 2.1 }); }, 'comms-blind'],
  ['no whiteboard in the meeting room', (s) => { s.levels[0].rooms[2].items = s.levels[0].rooms[2].items.filter((i: any) => i.type !== 'whiteboard'); }, 'meeting'],
  ['no table in the meeting room', (s) => { s.levels[0].rooms[2].items = s.levels[0].rooms[2].items.filter((i: any) => i.type !== 'trestle-table'); }, 'meeting'],
  ['no counter in the kitchen', (s) => { s.levels[0].rooms[1].items = s.levels[0].rooms[1].items.filter((i: any) => i.type !== 'counter-run'); }, 'counter'],
  ['two desks for six people', (s) => { s.levels[0].rooms[3].items = s.levels[0].rooms[3].items.filter((i: any) => i.type !== 'standing-desk').concat(s.levels[0].rooms[3].items.filter((i: any) => i.type === 'standing-desk').slice(0, 2)); }, 'seats'],
  ['six desks for three people', (s) => { s.office.headcount = 3; }, 'seats'],
];
for (const [what, mutate, code] of DEFECTS) {
  test(`office:${code} catches ${what}`, () => {
    const s = fixture(); mutate(s);
    const r = run(s);
    assert.ok(codesOf(r.errors).includes(code), `${what}: no [office:${code}] error in ${JSON.stringify(r.errors.map((e) => e.replace(/^<spec>: /, '')))}`);
  });
}

test('a seats count on the rooms stands for the desks, and a floor too big for its seats is caught', () => {
  const s = fixture();
  for (const r of s.levels[0].rooms) r.items = r.items.filter((i: any) => i.type !== 'standing-desk');
  assert.ok(codesOf(run(s).errors).includes('seats'), 'no desks at all');
  s.levels[0].rooms[3].seats = 6;
  assert.deepEqual(codesOf(run(s).errors), [], 'six declared seats are six work positions');
  s.levels[0].rooms[3].seats = 1; s.office.headcount = 1;
  assert.ok(codesOf(run(s).errors).includes('seats'), '37 m2 for one seat is more than 14');
});

test('a warning, not an error: a room that resolves to no office role, a hall, and an office with no head count', () => {
  const s = fixture();
  s.levels[0].rooms[4].name = 'Hall';
  const w = codesOf(run(s).warnings);
  assert.ok(w.includes('names'), 'Hall');
  const t = fixture(); delete t.office;
  assert.ok(codesOf(run(t).warnings).includes('seats'), 'no head count');
  assert.deepEqual(codesOf(run(t).errors), []);
});

test('inert for every home: no office message for any of the 36 homes, and a home may not carry the office\'s fields', () => {
  const all = homes();
  assert.ok(all.length >= 36, `${all.length} homes`);
  for (const { id, spec } of all) {
    const r = run(spec);
    assert.deepEqual(codesOf([...r.errors, ...r.warnings]), [], `${id}: the office plugin said something about a home`);
  }
  const h = structuredClone(all.find((x) => x.id === 'studio-loft')!.spec);
  h.office = { headcount: 4 };
  assert.ok(codesOf(run(h).errors).includes('fields'));
  const g = structuredClone(all.find((x) => x.id === 'aurora')!.spec);
  g.levels[0].rooms[0].seats = 2;
  assert.ok(codesOf(run(g).errors).includes('fields'));
  const ok = structuredClone(all.find((x) => x.id === 'aurora')!.spec); ok.use = 'home';
  assert.deepEqual(codesOf(run(ok).errors), [], 'use: "home" is the default spelt out');
});

// ---- the index: `houses` is the homes' rows exactly as they were, `offices` is beside it, and with no office there is no `offices` key
const indexOf = (dir: string): any => {
  const out = path.join(dir, 'index.json');
  const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'build-house-index.mts'), '--dir', dir, '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  return JSON.parse(fs.readFileSync(out, 'utf8'));
};
test('the index: the homes\' rows are the ones the builder always wrote; the office is beside them, never among them', () => {
  const dir = tmp(), apartments = apartmentIds();
  for (const { id } of homes()) fs.copyFileSync(path.join(HOUSES, `${id}.json`), path.join(dir, `${id}.json`));
  const alone = indexOf(dir);
  assert.deepEqual(Object.keys(alone), ['generated', 'houses'], 'without an office there is no offices key (the committed index.json stays byte for byte today\'s)');
  // the rows as scripts/build-house-index.mts wrote them before the office existed
  const legacy = (spec: any) => ({ id: spec.id, name: spec.name, author: spec.author, emoji: spec.emoji || '🏠', style: spec.style || '', storeys: unitStoreys(spec, apartments), areaSqm: spec.areaSqm || Math.round(spec.levels.reduce((s: number, l: any) => s + rectArea(l.footprint), 0)), source: spec.source || '' });
  assert.deepEqual(alone.houses, homes().map(({ spec }) => legacy(spec)), 'every home row is the legacy row, in the legacy order');
  assert.equal(JSON.stringify(alone.houses), JSON.stringify(homes().map(({ spec }) => legacy(spec))), 'and the same bytes');

  fs.copyFileSync(FIXTURE, path.join(dir, 'office-fixture-loft.json'));
  const both = indexOf(dir);
  assert.deepEqual(Object.keys(both), ['generated', 'houses', 'offices']);
  assert.equal(JSON.stringify(both.houses), JSON.stringify(alone.houses), '`houses` is the same bytes with an office in the folder');
  assert.deepEqual(both.offices, [{ id: 'office-fixture-loft', name: 'Fixture Loft', author: 'Companion Intelligence', emoji: '🏢', style: fixture().style, storeys: 1, areaSqm: 96, headcount: 6, source: 'original piece: CI offices' }]);
  assert.deepEqual(allHouses(both).map((h: any) => h.id), [...alone.houses.map((h: any) => h.id), 'office-fixture-loft']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the index a build ships has no offices array: a public build must not tell the world the first office exists, and the homes\' rows are as they were', () => {
  const index = JSON.parse(fs.readFileSync(path.join(HOUSES, 'index.json'), 'utf8'));
  const withOffice = { ...index, offices: [{ id: 'office-fixture-loft', name: 'Fixture Loft', author: 'Companion Intelligence', source: 'original piece: CI offices', headcount: 6 }] };
  assert.ok(!('offices' in redactIndex(withOffice)), 'redactIndex drops `offices`');
  assert.equal(JSON.stringify(redactIndex(withOffice)), JSON.stringify(redactIndex(index)), 'an index that lists an office ships the same bytes as one that does not');
  assert.deepEqual(Object.keys(redactIndex(index)), Object.keys(index).filter((k) => k !== 'offices'), 'and the keys keep their order');
  assert.ok(redactIndex(index).houses.every((h: any) => !('author' in h) && !('source' in h)), 'the homes are redacted as before');
});

