#!/usr/bin/env -S node --experimental-strip-types
// The company contract (reference/office/office-contract-m0.md): the company/v1 schema stays in the keyword subset the zero-dependency checker enforces and shares its definitions with
// the family schema; every enumeration of the Node constants is its schema twin; the twelve functions, the office's role table and the names are consistent with the catalog; the label is
// a disclosure of claims.json that stays out of the player's shipped snapshot; and nothing the families read has moved (the family role table is the very file, unmerged).
// Pure Node: no browser, no network. Needs `pnpm run build` (the role helpers are compiled assets).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { schemaKeywordsUsed, SUPPORTED_KEYWORDS, checkSchema } from './story/lib/schema-lite.mts';
import { rolesFor, mergeRoles, functionsFor } from './story/lib/kinds.mts';
import { roomRoles } from '../assets/story/roles.js';
import { CLAIMS_SNAPSHOT, snapshotOf } from './story/lib/fine-print.mts';
import { EXTRA_BANS } from './story/lib/extra-bans.mts';
import { COLOURS, FICTIONAL_COMPANY_ID, FICTIONAL_COMPANY_LINE, FLOOR_MAX, FUNCTIONS, HOME_ONLY_ROOM_ROLES, OFFICE_ONLY_ROLE_IDS, OFFICE_ONLY_ROOM_ROLES, OFFICE_ROLE_IDS, OFFICE_ROOM_ROLES, SCOPES, SIZES, CO_CATEGORIES, CO_DAY_PARTS, VOICE_KEYS } from './story/lib/co/consts.mts';
import { FICTIONAL_LINE } from '../assets/story/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const J = (rel: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const company = J('content/story/schema/company.schema.json'), family = J('content/story/schema/family.schema.json');
const claims = J('content/story/claims.json');
const catalog = J('content/story/catalog-apps.json').apps as { id: string; storySafe: string }[];
const houseTypes = new Set(Object.keys(J('content/house-catalog.json').types));
const enumOf = (def: string): string[] => company.$defs[def].enum;
const stripDescriptions = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (k, v) => (k === 'description' ? undefined : v)));

test('the schema stays inside the keywords the checker enforces, and is the family schema\'s sibling', () => {
  assert.equal(company.$id, 'https://homes.ci.computer/schema/company-v1.json');
  assert.deepEqual([...schemaKeywordsUsed(company)].filter((k) => !SUPPORTED_KEYWORDS.has(k)), [], 'a keyword no checker here enforces would silently weaken the contract');
  // no definition is left over: every one is referenced from the document or from another definition
  const referenced = new Set([...JSON.stringify(company).matchAll(/"\$ref":\s*"#\/\$defs\/([A-Za-z]+)"/g)].map((m) => m[1]));
  assert.deepEqual(Object.keys(company.$defs).filter((k) => !referenced.has(k)), [], 'a definition nothing refers to');
  assert.equal(company.properties.schema.const, 'company/v1');
  assert.equal(company.properties.members.minItems, 3); assert.equal(company.properties.members.maxItems, 8);
  assert.equal(company.properties.chapters.minItems, 7); assert.equal(company.properties.beats.minItems, 24); assert.equal(company.properties.beats.maxItems, 40);
  for (const k of ['family', 'household', 'segment', 'archetype', 'age']) assert.ok(!JSON.stringify(company).includes(`"${k}"`), `a family word in the company schema: ${k}`);
});

test('the definitions the two schemas share are equal, descriptions apart', () => {
  for (const k of ['id', 'appId', 'voiceKey', 'companion', 'camera', 'anchorLeaf', 'anchor', 'popup', 'detail', 'say', 'profile', 'closing', 'spot', 'chapter']) {
    assert.deepEqual(stripDescriptions(company.$defs[k]), stripDescriptions(family.$defs[k]), `$defs.${k}`);
  }
  // every $ref resolves
  const refs = [...JSON.stringify(company).matchAll(/"\$ref":\s*"#\/\$defs\/([A-Za-z]+)"/g)].map((m) => m[1]);
  for (const r of refs) assert.ok(company.$defs[r], `$ref ${r}`);
});

test('every enumeration of the Node constants is its schema twin', () => {
  assert.deepEqual(enumOf('size'), [...SIZES]);
  assert.deepEqual(enumOf('scope'), [...SCOPES]);
  assert.deepEqual(enumOf('function'), [...FUNCTIONS]);
  assert.deepEqual(enumOf('category'), [...CO_CATEGORIES]);
  assert.deepEqual(enumOf('roomRole'), [...OFFICE_ROOM_ROLES]);
  assert.deepEqual(enumOf('roleId'), [...OFFICE_ROLE_IDS]);
  assert.deepEqual(enumOf('voiceKey'), [...VOICE_KEYS]);
  assert.deepEqual(company.$defs.dayEntry.properties.at.enum, [...CO_DAY_PARTS]);
  assert.deepEqual(company.$defs.member.properties.colour.enum, [...COLOURS]);
  assert.equal(company.$defs.company.properties.floor.maximum, FLOOR_MAX);
  assert.deepEqual(OFFICE_ONLY_ROOM_ROLES.filter((r) => (HOME_ONLY_ROOM_ROLES as readonly string[]).includes(r)), [], 'an office role is not a home role');
  // the family schema's lists are the office's lists' prefix: the office adds, it never renames
  assert.deepEqual(family.$defs.roomRole.enum, OFFICE_ROOM_ROLES.slice(0, family.$defs.roomRole.enum.length));
  assert.deepEqual(family.$defs.roleId.enum, OFFICE_ROLE_IDS.slice(0, family.$defs.roleId.enum.length));
  assert.equal(OFFICE_ROOM_ROLES.length, 19); assert.equal(OFFICE_ROLE_IDS.length, 34);
});

test('a document the schema is meant to accept, and ones it is meant to refuse', async () => {
  const { makeExemplar } = await import('./story/lib/co/exemplar.mts');
  assert.deepEqual(checkSchema(makeExemplar(), company), []);
  const bad = (f: (s: any) => void): string => { const s: any = makeExemplar(); f(s); return checkSchema(s, company).join(' | '); };
  assert.match(bad((s) => { s.schema = 'family/v1'; }), /company\/v1/);
  assert.match(bad((s) => { s.family = {}; }), /unknown property family/);
  assert.match(bad((s) => { s.company.name = '3M Works'; }), /company\.name/);
  assert.match(bad((s) => { s.company.address.line = 'Unit 2 Tanyard Terrace'; }), /address\.line/);
  assert.match(bad((s) => { s.company.floor = 26; }), /above 25/);
  assert.match(bad((s) => { s.members[0].age = 40; }), /unknown property age/);
  assert.match(bad((s) => { s.members[0].function = 'ceo'; }), /function/);
  assert.match(bad((s) => { s.members = s.members.slice(0, 2); }), /fewer than 3/);
  assert.match(bad((s) => { s.beats[0].segment = 'consumer'; }), /unknown property segment/);
  assert.match(bad((s) => { s.beats[0].category = 'home'; }), /category/);
  assert.match(bad((s) => { s.beats[0].anchor.role = 'sofa'; }), /anchor\.role/);
  assert.match(bad((s) => { s.chapters[1].room = 'cellar'; }), /room/);
});

test('functions.json: the twelve, each with a filter word, rooms an office has and a pool of real, storyable apps', () => {
  const fns = functionsFor();
  assert.deepEqual(fns.map((f) => f.id), [...FUNCTIONS]);
  assert.equal(new Set(fns.map((f) => f.label)).size, 12, 'one filter word each');
  const byId = new Map(catalog.map((a) => [a.id, a]));
  for (const f of fns) {
    assert.ok(f.rooms.length >= 2 && f.rooms.every((r) => (OFFICE_ROOM_ROLES as readonly string[]).includes(r) && !(HOME_ONLY_ROOM_ROLES as readonly string[]).includes(r)), `${f.id}: rooms`);
    assert.deepEqual([...f.pool].sort(), f.pool, `${f.id}: the pool is sorted`);
    assert.equal(new Set(f.pool).size, f.pool.length);
    for (const a of f.pool) { assert.ok(byId.has(a), `${f.id}: ${a} is in the catalog`); assert.notEqual(byId.get(a)!.storySafe, 'avoid', `${f.id}: ${a} is not an avoid app`); assert.notEqual(a, 'kiwix'); }
  }
});

test('roles-office.json: names are the contract, every type exists, every pattern compiles', () => {
  const ext = J('content/story/roles-office.json');
  assert.deepEqual(ext.dropRooms, [...HOME_ONLY_ROOM_ROLES]);
  assert.deepEqual(Object.keys(ext.items).sort(), [...OFFICE_ONLY_ROLE_IDS, 'bookshelf'].sort());
  assert.deepEqual(Object.keys(ext.home).sort(), [...OFFICE_ONLY_ROLE_IDS].sort());
  assert.deepEqual(Object.keys(ext.rooms).sort(), [...OFFICE_ONLY_ROOM_ROLES, 'kitchen'].sort());
  for (const [role, types] of Object.entries<string[]>(ext.items)) for (const t of types) assert.ok(houseTypes.has(t), `${role}: ${t} is not in content/house-catalog.json`);
  for (const [role, def] of Object.entries<any>(ext.rooms)) if (def.names) assert.doesNotThrow(() => new RegExp(def.names, 'i'), role);
  for (const rooms of Object.values<string[]>(ext.home)) for (const r of rooms) assert.ok((OFFICE_ROOM_ROLES as readonly string[]).includes(r), r);
  for (const r of ext.universal) assert.ok((OFFICE_ROLE_IDS as readonly string[]).includes(r), r);
});

test('mergeRoles: the family table is the file, untouched; the office table adds and drops; neither argument changes', () => {
  const base = J('content/story/roles.json'), ext = J('content/story/roles-office.json');
  assert.deepEqual(rolesFor('family'), base, 'a family is held to roles.json as it is (rolesSha hashes the whole table)');
  const copy = structuredClone(base), extCopy = structuredClone(ext);
  const merged = mergeRoles(base, ext);
  assert.deepEqual(base, copy); assert.deepEqual(ext, extCopy);
  assert.deepEqual(Object.keys(merged.rooms).sort(), ['entry', 'kitchen', 'office', 'reception', 'server', 'store', 'street', 'workfloor', 'workshop', 'meeting'].sort());
  for (const r of HOME_ONLY_ROOM_ROLES) assert.ok(!(r in merged.rooms), `${r} is dropped for an office`);
  assert.deepEqual(merged.universal, ['street', 'front-door', 'core', 'room', 'counter'], 'a couch and a garden are not in every office');
  assert.deepEqual(merged.items.bookshelf, ['bookshelf', 'low-bookshelf', 'ladder-shelf', 'open-shelving', 'filing-cabinet']);
  assert.deepEqual(merged.items.couch, base.items.couch, 'a role the office does not mention is the family\'s');
  assert.equal(merged.items.workstation[0], 'standing-desk');
  assert.deepEqual(rolesFor('office'), rolesFor('company'));
  assert.equal(rolesFor('company'), rolesFor('company'), 'read once');
});

test('the rooms of the eight buildings resolve to the roles they are for, and never to a home\'s', () => {
  const oracle = J('test/fixtures/offices/room-names.json').buildings as Record<string, { name: string; roles: string[] }[]>;
  const table = rolesFor('company');
  assert.deepEqual(Object.keys(oracle).sort(), ['agency-printworks', 'contractor-yard', 'dev-shop-unit', 'garage-lab', 'hub-courtyard', 'practice-townhouse', 'shop-backoffice', 'startup-loft']);
  let n = 0;
  for (const [building, rooms] of Object.entries(oracle)) for (const { name, roles } of rooms) {
    const got = roomRoles(name, table) as string[];
    n++;
    for (const r of roles) assert.ok(got.includes(r), `${building}: "${name}" should be ${r}, is [${got.join(', ')}]`);
    for (const r of got) assert.ok(!(HOME_ONLY_ROOM_ROLES as readonly string[]).includes(r), `${building}: "${name}" resolves to the home role ${r}`);
  }
  assert.ok(n >= 60, `${n} room names`);
  // why the home rows are dropped: the home table misreads these office names (the landmines of office-build-contract.md 4.1)
  const base = rolesFor('family');
  assert.ok((roomRoles('Workshop', base) as string[]).includes('garage'));
  assert.ok((roomRoles('Server Closet', base) as string[]).includes('laundry'));
  assert.ok((roomRoles('Edit Suite', base) as string[]).includes('bedroom'));
  for (const name of ['Workshop', 'Server Closet', 'Edit Suite', 'Town Hall Lounge']) for (const r of roomRoles(name, table) as string[]) assert.ok(!(HOME_ONLY_ROOM_ROLES as readonly string[]).includes(r), `${name} → ${r}`);
});

test('the label: a disclosure of claims.json (owner decision O4), approved words, kept out of the player\'s snapshot', () => {
  const d = claims.disclosures.find((x: any) => x.id === FICTIONAL_COMPANY_ID);
  assert.ok(d, 'claims.json has fictional-company');
  assert.equal(d.text, 'Fictional company. Real software.'); assert.equal(d.text, FICTIONAL_COMPANY_LINE);
  assert.ok(d.long.includes('The people in it are characters, not customers.'), 'the approved long line');
  assert.match(d.long, /^\{company\} is a fictional company\./);
  assert.equal(d.required, false, 'no family surface owes it');
  assert.equal(d.collection, 'office');
  assert.match(d.notes, /2026-10-23/);
  assert.equal(CLAIMS_SNAPSHOT.disclosures.find((x) => x.id === FICTIONAL_COMPANY_ID), undefined, 'the snapshot is shipped; the office\'s disclosure is not in it');
  assert.equal(snapshotOf(claims).disclosures.find((x) => x.id === FICTIONAL_COMPANY_ID), undefined, 'and the function that writes it leaves the office\'s disclosure out (the committed constant is not the only witness)');
  assert.equal(JSON.stringify(snapshotOf(claims)), JSON.stringify(CLAIMS_SNAPSHOT), 'so the snapshot is what it was');
  // the family label is as it was, and the two are siblings
  assert.equal(claims.disclosures.find((x: any) => x.id === 'fictional-family').text, FICTIONAL_LINE);
  assert.equal(claims.disclosures.filter((x: any) => x.collection).length, 1, 'the office adds one disclosure and no more');
  // its words pass every rule a story or a page is held to
  for (const text of [d.text, d.long.replace('{company}', 'Reelwick')]) {
    for (const b of claims.bannedPhrases) assert.ok(!new RegExp(b.pattern, b.flags).test(text), `"${text}" breaks ${b.id}`);
    for (const b of EXTRA_BANS) assert.ok(!new RegExp(b.pattern, b.flags).test(text), `"${text}" breaks the extra rule ${b.id}`);
  }
});

test('company-names.json: a deny-list that is not a clearance, and eight proposals that are not yet cleared', () => {
  const names = J('content/story/company-names.json');
  assert.ok(names.deny.length >= 20 && names.deny.includes('Acme') && names.deny.includes('Northwind'));
  assert.equal(names.proposals.length, 8);
  assert.deepEqual(names.proposals.reduce((n: Record<string, number>, p: any) => ({ ...n, [p.size]: (n[p.size] ?? 0) + 1 }), {}), { startup: 3, small: 3, medium: 2 });
  const slugs = names.proposals.map((p: any) => p.slug);
  assert.equal(new Set(slugs).size, 8);
  const familySlugs = new Set(J('content/story/casting.json').families.map((f: any) => f.slug));
  const houseIds = new Set(fs.readdirSync(path.join(ROOT, 'content', 'houses')).map((f) => f.replace(/\.json$/, '')));
  for (const p of names.proposals) {
    assert.match(p.slug, /^[a-z]+(-[a-z]+){0,2}$/, p.slug);
    assert.ok(!familySlugs.has(p.slug) && !houseIds.has(p.slug), `${p.slug} is in the one slug namespace`);
    assert.deepEqual(checkSchema(p.name, company.$defs.company.properties.name), [], p.name);
    assert.ok(!names.deny.some((d: string) => p.name.toLowerCase().includes(d.toLowerCase())), p.name);
  }
});
