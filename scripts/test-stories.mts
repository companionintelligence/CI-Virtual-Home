#!/usr/bin/env -S node --experimental-strip-types
// Tests for the family-story contract and its validator (scripts/validate-stories.mts, scripts/story/lib/*).
// Usage: pnpm run test   (node --test; no GPU, no network, no build needed)
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as T from '../assets/story/types.ts';
import { roomRoles, type RolesTable } from '../assets/story/roles.ts';
import type { Story } from '../assets/story/types.ts';
import { loadContext, ROOT, type Ctx } from './story/lib/context.mts';
import { validateStory } from './story/lib/validate.mts';
import { checkSchema, schemaKeywordsUsed, SUPPORTED_KEYWORDS } from './story/lib/schema-lite.mts';
import { FLEET, FLEET_V3, appCap, fleetMetrics } from './story/lib/fleet.mts';
import { BANDS, HOUSEHOLD_KINDS } from './story/lib/services.mts';
import { build as buildServices, readInputs, render as renderServices } from './story/build-services.mts';
import { plain } from './story/lib/text.mts';
import { CASES, STANDALONE } from './story/lib/bad-cases.mts';
import { V2_LIMITS, foreignServices } from './story/lib/v2.mts';
import { ROOM_BEATS } from './story/lib/structure.mts';
import { castingDisagreements } from './story/lib/house.mts';
import { applyDiff, diffBlocks, diffCatalog } from './story/lib/catalog-diff.mts';
import { PHASED_RULES, isV3Story, v3Severity } from './story/lib/v3.mts';
import { ARCHETYPES as CAST_ARCHETYPES, PREFS, ROOM_PREF } from './story/build-casting.mts';
import { BLURB_WORDS, LABEL_MAX, categoryOf, checkCategories, loadCategories, repoRules, type CategoriesFile } from './story/lib/categories.mts';

// `ctx` is the shipped content (the schema, claims, catalog and casting as they are). `fx` is the same with the casting and the
// houses of the test world (test/fixtures/stories/world), so the exemplar and the negative cases stay valid however the shipped
// casting is re-cast or the shipped houses are re-laid. Contract tests use `ctx`; family tests use `fx`.
const ctx = loadContext();
const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const FIX = path.join('test', 'fixtures', 'stories');
const WORLD = path.join(ROOT, FIX, 'world');
const fx = loadContext(ROOT, { world: WORLD });
const exemplar = (): Story => J(FIX, 'exemplar.json');
const ruleIds = (r: ReturnType<typeof validateStory>): Set<string> => new Set([...r.errors, ...r.review].map((f) => f.rule));

// ---------------------------------------------------------------------------------------------------------------------
// The contract: schema, types.ts and the shared inputs say the same thing
// ---------------------------------------------------------------------------------------------------------------------
test('the schema enums equal the constants in assets/story/types.ts', () => {
  const d = ctx.schema.$defs;
  const pairs: [string, readonly string[], string[]][] = [
    ['VOICE_KEYS', T.VOICE_KEYS, d.voiceKey.enum], ['HOUSEHOLDS', T.HOUSEHOLDS, d.household.enum], ['CATEGORIES', T.CATEGORIES, d.category.enum],
    ['SEGMENTS', T.SEGMENTS, d.segment.enum], ['ROOM_ROLES', T.ROOM_ROLES, d.roomRole.enum], ['ROLE_IDS', T.ROLE_IDS, d.roleId.enum],
    ['MEMBER_ROLES', T.MEMBER_ROLES, d.member.properties.role.enum], ['CHAPTER_KINDS', T.CHAPTER_KINDS, d.chapter.properties.kind.enum],
    ['COLOURS', T.COLOURS, d.member.properties.colour.enum], ['RUNTIMES', T.RUNTIMES, d.companion.properties.runtime.enum],
    ['ARCHETYPES', T.ARCHETYPES, d.member.properties.archetype.enum], ['DAY_PARTS', T.DAY_PARTS, d.dayEntry.properties.at.enum],
  ];
  for (const [name, ts, schema] of pairs) assert.deepEqual([...ts], schema, `${name} differs between types.ts and the schema`);
});

test('the schema stays inside the keyword subset the zero-dependency checker enforces', () => {
  const used = schemaKeywordsUsed(ctx.schema);
  const outside = [...used].filter((k) => !SUPPORTED_KEYWORDS.has(k));
  assert.deepEqual(outside, [], 'a keyword outside the subset would be silently unenforced');
});

test('roles.json, voices.json and types.ts agree on the closed sets', () => {
  const fromRoles = new Set([...Object.keys(ctx.roles.builtin), ...Object.keys(ctx.roles.items), ...Object.keys(ctx.roles.zones)]);
  assert.deepEqual([...fromRoles].sort(), [...T.ROLE_IDS].sort(), 'roles.json must define exactly the role ids of the schema');
  for (const u of ctx.roles.universal) assert.ok(T.ROLE_IDS.includes(u as any), `universal role ${u} is not a role id`);
  assert.deepEqual(Object.keys(ctx.voices.voices).sort(), [...T.VOICE_KEYS].sort());
  assert.equal(Object.values(ctx.voices.voices).reduce((n, v) => n + v.narratorFor, 0), ctx.casting.families.length, 'narratorFor must add up to the number of families');
  assert.equal(T.SIGNOFF, 'UnCloud your life.');
  assert.equal(T.FIRST_PARTY.length, 3);
  for (const id of T.FIRST_PARTY) assert.ok(ctx.apps.has(id), `${id} must be in the catalog`);
});

test('personas.json is the archetype table: one entry per archetype, valid rooms, roles and store ids', () => {
  const p = ctx.personas;
  assert.equal(p.v, 1);
  assert.deepEqual(Object.keys(p.archetypes).sort(), [...T.ARCHETYPES].sort(), 'personas.json must define exactly the archetypes of the schema');
  for (const [k, def] of Object.entries(p.archetypes)) {
    assert.ok(def.label && def.description, `${k}: label and description`);
    assert.ok(def.rooms.length > 0, `${k}: at least one room`);
    for (const r of [...def.rooms, ...def.fallbackRooms]) assert.ok(T.ROOM_ROLES.includes(r), `${k}: ${r} is not a room role`);
    assert.deepEqual(def.rooms.filter((r) => def.fallbackRooms.includes(r)), [], `${k}: a room is either preferred or a fallback`);
    for (const r of [...def.anchorRoles, ...def.fallbackAnchorRoles]) assert.ok(T.ROLE_IDS.includes(r), `${k}: ${r} is not a role id`);
    assert.ok(def.anchorRoles.length > 0 && def.apps.length >= 3, `${k}: anchor roles and at least three apps`);
    assert.equal(new Set(def.apps).size, def.apps.length, `${k}: duplicate app`);
    for (const id of def.apps) {
      const a = ctx.apps.get(id);
      assert.ok(a, `${k}: store id ${id} is not in catalog-apps.json (a pool id must be an app a story may name)`);
      assert.notEqual(a!.storySafe, 'avoid', `${k}: ${id} is marked avoid`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The schema checker
// ---------------------------------------------------------------------------------------------------------------------
test('schema-lite: reports each kind of violation and an unsupported keyword', () => {
  const s = { type: 'object', required: ['a', 'b'], additionalProperties: false, properties: { a: { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' }, b: { enum: ['x', 'y'] }, c: { type: 'integer', minimum: 1, maximum: 3 }, d: { type: 'array', minItems: 1, items: { const: 1 } } } };
  assert.deepEqual(checkSchema({ a: 'ab', b: 'x' }, s), []);
  const errs = checkSchema({ a: 'A', b: 'z', c: 9, d: [], e: 1 }, s).join('\n');
  for (const frag of ['$.a: shorter', '$.a: does not match', '$.b: must be one of', '$.c: above 3', '$.d: fewer than 1', 'unknown property e']) assert.ok(errs.includes(frag), `expected "${frag}" in:\n${errs}`);
  assert.ok(checkSchema({}, { type: 'object', oneOf: [] } as any).join().includes('unsupported keyword oneOf'));
  assert.ok(checkSchema(1.5, { type: 'integer' }).length === 1);
});

// ---------------------------------------------------------------------------------------------------------------------
// The exemplar and the negative cases
// ---------------------------------------------------------------------------------------------------------------------
// The exemplar is a family written before story v3, so it reports the v3 phase-in rules (PHASED_RULES) as warnings: legacy chips, no services, no persona band.
// Nothing else is reported, and ok-9-story-v3.json (below) is the whole family that reports nothing at all.
const phased = new Set<string>(PHASED_RULES);
const unphased = (r: ReturnType<typeof validateStory>) => r.warn.filter((f) => !phased.has(f.rule));
test('the exemplar passes with 0 errors, 0 review and 0 warnings apart from the story v3 phase-in rules', () => {
  const r = validateStory(exemplar(), fx);
  assert.deepEqual(r.errors.map((f) => r.line(f)), []);
  assert.deepEqual(r.review.map((f) => r.line(f)), []);
  assert.deepEqual(unphased(r).map((f) => r.line(f)), []);
  assert.deepEqual([...new Set(r.warn.map((f) => f.rule))].sort(), ['chips-legacy', 'pair-budget', 'pair-share', 'persona-band', 'service-missing'], 'a family that is not v3 warns once for each phase-in rule');
});

const index: { name: string; file: string; expect: string[]; warn?: string[]; absent?: string[]; tolerate?: string[] }[] = J(FIX, 'cases.json');
test('every case in bad-cases.mts has a fixture, and every fixture is exemplar + its mutation (regenerate with make-bad-fixtures.mts)', () => {
  assert.deepEqual(index.map((c) => c.name), CASES.map((c) => c.name));
  for (const c of CASES) {
    const s = c.base ? J(FIX, c.base) as Story : exemplar(); c.mutate(s);
    assert.deepEqual(J(FIX, `${c.name}.json`), s, `${c.name}.json is stale: run node --experimental-strip-types scripts/story/make-bad-fixtures.mts`);
  }
});

for (const c of index) {
  test(`fixture ${c.name} ${c.expect.length ? `fails with ${c.expect.join(', ')}` : c.warn?.length ? `warns ${c.warn.join(', ')}` : `does not trip ${(c.absent || []).join(', ')}`}`, () => {
    const r = validateStory(J(FIX, c.file), fx);
    const ids = ruleIds(r);
    for (const e of c.expect) assert.ok(ids.has(e), `expected rule ${e}; got ${[...ids].join(', ') || 'nothing'}`);
    for (const w of c.warn || []) assert.ok(r.warn.some((f) => f.rule === w), `expected warning ${w}; got ${r.warn.map((f) => f.rule).join(', ') || 'no warnings'}`);
    if (c.expect.length) assert.ok(r.failed, 'a negative fixture must fail the gate');
    for (const a of c.absent || []) assert.ok(!r.allRuleIds().includes(a), `rule ${a} must not fire (false-positive guard); got ${r.allRuleIds().join(', ')}`);
    const ignored = new Set(c.tolerate ?? []);
    if (!c.expect.length) assert.equal([...r.errors, ...r.review].filter((f) => !ignored.has(f.rule)).length, 0, [...r.errors, ...r.review].filter((f) => !ignored.has(f.rule)).map((f) => r.line(f)).join('\n'));
    if (!c.expect.length && !c.warn?.length) assert.deepEqual(unphased(r).filter((f) => !ignored.has(f.rule)).map((f) => r.line(f)), [], 'a clean case has no warnings (but the story v3 phase-in rules of a family that is not v3)');
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Story v2 (reference/story/story-v2.md): optional fields, widened limits, the Brennan sample
// ---------------------------------------------------------------------------------------------------------------------
test('story v2: ok-6-story-v2.json (the Brennan family with every new field) validates 0 errors, 0 review, 0 warnings from the test world, by the library and by the CLI', () => {
  assert.deepEqual([...STANDALONE], ['ok-6-story-v2.json', 'ok-9-story-v3.json']);
  const s = J(FIX, 'ok-6-story-v2.json') as Story;
  const r = validateStory(s, fx);
  // Jean (14) asks Open WebUI and looks things up in Kiwix in this sample, which are warnings under the v3 rules (age-chat, app-avoid) until the Brennans
  // are rewritten; nothing else is reported
  assert.deepEqual([...r.errors, ...r.review].map((f) => r.line(f)), []);
  assert.deepEqual(r.warn.filter((f) => f.rule === 'age-chat' || f.rule === 'app-avoid').map((f) => `${f.rule} ${f.at}`), ['age-chat jean-homework', 'app-avoid jean-lookup']);
  assert.deepEqual(unphased(r).map((f) => r.line(f)), [], 'and nothing but the story v3 phase-in rules besides');
  // every field of the contract is present, and every adult or teen persona beat has a detail
  assert.ok(s.family.home && s.family.home.spots.length >= 2 && s.family.day && s.family.day.length >= 5);
  assert.ok(s.members.every((m) => m.profile?.bio));
  for (const b of s.beats) if (b.member && s.members.find((m) => m.id === b.member)!.archetype) assert.ok(b.detail, `${b.id} has a detail`);
  const j = JSON.parse(cli(path.join(FIX, 'ok-6-story-v2.json'), '--json').stdout);
  assert.deepEqual([j.totals.errors, j.totals.review, j.totals.warnings], [0, 0, r.warn.length]);
});

test('story v2: every v2 field is optional (the exemplar has none), the schema holds the contract limits, and unknown keys inside them are refused', () => {
  const d = ctx.schema.$defs;
  assert.equal(ctx.schema.properties.chapters.maxItems, 12); assert.equal(ctx.schema.properties.chapters.minItems, 7);
  assert.equal(ctx.schema.properties.beats.maxItems, 40); assert.equal(ctx.schema.properties.beats.minItems, 22);
  assert.deepEqual([d.detail.properties.steps.minItems, d.detail.properties.steps.maxItems], [V2_LIMITS.steps.min, V2_LIMITS.steps.max]);
  assert.deepEqual([d.home.properties.spots.minItems, d.home.properties.spots.maxItems], [V2_LIMITS.spots.min, V2_LIMITS.spots.max]);
  assert.deepEqual([d.family.properties.day.minItems, d.family.properties.day.maxItems], [V2_LIMITS.day.min, V2_LIMITS.day.max]);
  for (const k of ['detail', 'home', 'dayEntry', 'profile', 'spot']) assert.equal(d[k].additionalProperties, false, `${k}: additionalProperties false`);
  for (const [name, def, key] of [['beat.detail', d.beat, 'detail'], ['family.home', d.family, 'home'], ['family.day', d.family, 'day'], ['member.profile', d.member, 'profile']] as const) {
    assert.ok(def.properties[key], `${name} is in the schema`); assert.ok(!def.required.includes(key), `${name} is optional`);
  }
  assert.deepEqual(checkSchema(exemplar(), ctx.schema), []);
  const s = J(FIX, 'ok-6-story-v2.json'); s.beats[6].detail.extra = 'x'; s.family.home.spots = s.family.home.spots.slice(0, 1); s.family.day = s.family.day.slice(0, 4); s.beats[7].detail.steps = ['one step only'];
  const errs = checkSchema(s, ctx.schema).join('\n');
  for (const frag of ['unknown property extra', 'spots: fewer than 2', 'day: fewer than 5', 'steps: fewer than 2']) assert.ok(errs.includes(frag), `expected "${frag}" in:\n${errs}`);
});

test('story v2: the widened quotas (22 to 40 beats, 7 to 12 chapters, 15 to 34 room beats); the film quotas do not move', () => {
  assert.deepEqual([ROOM_BEATS.min, ROOM_BEATS.max], [15, 34]);
  const withRoomBeats = (n: number): Story => {
    const s = exemplar(); const have = s.beats.filter((b) => b.chapter !== 'ftue' && b.chapter !== 'outro');
    const proto = have.filter((b) => b.chapter === 'living')[0];
    const extra = Array.from({ length: n - have.length }, (_, i) => { const b = JSON.parse(JSON.stringify(proto)); b.id = `living-more-${i}`; delete b.film; return b; });
    const at = s.beats.findIndex((b) => b.id === 'kitchen-list');
    s.beats.splice(at, 0, ...extra); return s;
  };
  const roomRule = (s: Story): string[] => validateStory(s, fx).errors.filter((f) => f.rule === 'beats' && /room beats/.test(f.message)).map((f) => f.message);
  // the exemplar has six ftue beats and one outro, so 33 room beats make 40; with ftue-unbox (optional) out, 34 room beats make 40
  const noUnbox = (s: Story): Story => { s.beats = s.beats.filter((b) => b.id !== 'ftue-unbox'); return s; };
  assert.deepEqual(roomRule(withRoomBeats(33)), [], '33 room beats (40 beats in all) pass');
  assert.deepEqual(checkSchema(withRoomBeats(33), ctx.schema), []);
  assert.deepEqual(roomRule(noUnbox(withRoomBeats(34))), [], '34 room beats pass');
  assert.deepEqual(checkSchema(noUnbox(withRoomBeats(34)), ctx.schema), [], '... at 40 beats in all');
  // (35 room beats would be 41 beats at least: the schema's 40 stops it first, so the rule's 34 is the same limit seen from the room side)
  assert.ok(checkSchema(noUnbox(withRoomBeats(35)), ctx.schema).some((m) => /beats: more than 40/.test(m)), '35 room beats fail the schema');
  assert.ok(checkSchema(withRoomBeats(34), ctx.schema).some((m) => /beats: more than 40/.test(m)), 'the schema stops at 40 beats');
  const fifteen = exemplar(); fifteen.beats = fifteen.beats.filter((b) => b.id !== 'living-lights');
  assert.deepEqual(roomRule(fifteen), [], '15 room beats (22 beats in all) pass; with the floor of 22 beats the rule\'s 15 is the same limit seen from the room side');
  const chapters = (n: number): Story => { const s = exemplar(); const extra = Array.from({ length: n - s.chapters.length }, (_, i) => ({ id: `extra-${i}`, kind: 'room' as const, room: 'office' as const, title: 'Another room' })); s.chapters.splice(s.chapters.length - 1, 0, ...extra); return s; };
  assert.deepEqual(checkSchema(chapters(12), ctx.schema), [], '12 chapters pass the schema');
  assert.ok(checkSchema(chapters(13), ctx.schema).some((m) => /chapters: more than 12/.test(m)), '13 do not');
  assert.equal(ctx.schema.properties.chapters.minItems, 7);
});

test('story v2: foreignServices names a company only when the beat does not replace it; first names and ordinary words are not services', () => {
  const people = new Set(['Arlo']);
  const hits = (t: string, allowed: string[]): string[] => foreignServices(t, allowed, ctx, people);
  assert.deepEqual(hits('Photos went to Google Photos.', ['Google Photos']), []);
  assert.deepEqual(hits('Photos went to Google, then to Dropbox.', ['Google Photos']), ['Dropbox'], 'a bare Google is covered by Google Photos');
  assert.deepEqual(hits('Photos went to Google Drive.', ['Google Photos']), ['Google Drive']);
  assert.deepEqual(hits('A shared drive, a rented drive and a cloud.', []), []);
  assert.deepEqual(hits('Arlo watered the ring plants. Make a list.', []), [], 'a family name, "ring" and a sentence-initial "Make" are not services');
  assert.deepEqual(hits('Files sat in GitLab (SaaS).', ['GitLab (SaaS)']), []);
  assert.deepEqual(hits('Files sat in GitLab.', []), ['GitLab']);
});

test('the reference validator and the TypeScript port agree on rule ids for the exemplar and the ported cases', async () => {
  // the reference validator reads one data directory: the shipped inputs, with the test world's casting in place of the shipped one
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'story-ref-'));
  try {
    for (const f of fs.readdirSync(path.join(ROOT, 'content', 'story'))) if (f !== 'casting.json') fs.symlinkSync(path.join(ROOT, 'content', 'story', f), path.join(data, f));
    fs.copyFileSync(path.join(WORLD, 'casting.json'), path.join(data, 'casting.json'));
    process.env.STORY_DATA = data;
    process.env.STORY_EXAMPLE = path.join(ROOT, FIX, 'exemplar.json');
    const ref: any = await import(path.join(ROOT, 'reference', 'story', 'ref', 'ref-validate.mjs'));
    const refIds = (s: unknown): string[] => { const r = ref.validate(s); return [...new Set([...r.errors, ...r.review].map((m: string) => m.split(' ')[0]))].sort(); };
    const tsIds = (s: unknown): string[] => [...ruleIds(validateStory(s, fx))].sort();
    assert.deepEqual(tsIds(exemplar()), refIds(exemplar()));
    for (const c of CASES.slice(0, 10)) {                                   // the ten ported from the reference
      const s = exemplar(); c.mutate(s);
      assert.deepEqual(tsIds(s), refIds(s), `${c.name}: rule ids differ between the reference validator and the port`);
    }
  } finally { fs.rmSync(data, { recursive: true, force: true }); }
});

test('the review allow-list clears exactly the listed finding and flags stale entries', () => {
  const s = exemplar(); CASES.find((c) => c.name === 'bad-18-no-screenshot')!.mutate(s);
  const plainRun = validateStory(s, fx);
  assert.ok(plainRun.review.some((f) => f.rule === 'app-qa-screenshot'));
  const cleared = loadContext(ROOT, { world: WORLD, reviewed: [{ slug: 'vance-takahashi', at: 'kitchen-recipe', rule: 'app-qa-screenshot', by: 'LB' }] });
  const r = validateStory(s, cleared);
  assert.equal(r.review.length, 0); assert.equal(r.allowed.length, 1); assert.equal(r.failed, false);
  const stale = validateStory(exemplar(), loadContext(ROOT, { world: WORLD, reviewed: [{ slug: 'vance-takahashi', at: 'kitchen-recipe', rule: 'app-qa-screenshot', by: 'LB' }] }));
  assert.ok(stale.warn.some((f) => f.rule === 'reviewed'), 'an entry that matches nothing is reported');
  const unsigned = loadContext(ROOT, { reviewed: [{ slug: 'x', at: 'y', rule: 'z', by: '' }] });
  assert.equal(unsigned.reviewedProblems.length, 1, 'an entry without an owner initial is not a review');
});

test('content/story/reviewed.json is a valid (initially empty) allow-list', () => {
  assert.ok(Array.isArray(ctx.reviewedList)); assert.deepEqual(ctx.reviewedProblems, []);
});

// ---------------------------------------------------------------------------------------------------------------------
// claims.json
// ---------------------------------------------------------------------------------------------------------------------
test('claims.json: 72 ban rules, ids unique, every regex compiles and none is global (a global regex keeps state between tests)', () => {
  const bans = ctx.claims.bannedPhrases;
  assert.equal(bans.length, 72);
  assert.equal(new Set(bans.map((b) => b.id)).size, bans.length);
  for (const b of bans) {
    assert.ok(['error', 'review', 'warn'].includes(b.severity), `${b.id}: severity`);
    assert.doesNotThrow(() => new RegExp(b.pattern, b.flags), `${b.id} must compile`);
    assert.ok(!/[gy]/.test(b.flags), `${b.id}: flags g and y make .test() stateful`);
    assert.ok(b.why && b.fix, `${b.id} needs why and fix`);
  }
});

test('claims.json: the three excellent beats of STORY-BIBLE section 11 pass the text rules', () => {
  const good = [
    'A draft, never sent alone', 'A client asks a tricky question. Mika texts Odette, and Odette drafts a reply using the context Mika connected to Companion Memory. Mika reads it and sends it herself.', 'Here is a draft. Please read it before you send it.',
    'Every subscription, in one list', 'Mika opens Wallos at the counter. It lists every subscription the household still pays for, with a reminder before each one renews.', 'replaces Rocket Money',
    'Join it from a phone', 'Elias opens the Wi-Fi settings on his phone and joins the Core\'s own network. Then he chooses the home network from the list.', 'Join the Core\'s own network', 'Choose your home network', 'Enter its password',
    'UnCloud your life.',
  ];
  for (const t of good) assert.deepEqual(ctx.bans.filter((b) => b.re.test(plain(t)) && b.severity !== 'warn').map((b) => b.id), [], t);
});

test('claims.json: every sanctioned allowedClaims text passes the ban list (hold claims are not sanctioned)', () => {
  const sanctioned = ctx.claims.allowedClaims.filter((c) => c.status !== 'hold');
  assert.ok(sanctioned.length >= 30);
  for (const c of sanctioned) {
    const s = plain(c.text);
    const hits = ctx.bans.filter((b) => b.re.test(s) && b.severity !== 'warn');
    assert.deepEqual(hits.map((h) => h.id), [], `allowed claim ${c.id} trips the ban list: ${c.text}`);
  }
  for (const c of ctx.claims.allowedClaims.filter((c) => c.status === 'hold')) assert.ok(c.id, 'hold claims are listed so they are never printed by mistake');
});

// ---------------------------------------------------------------------------------------------------------------------
// casting.json and the houses
// ---------------------------------------------------------------------------------------------------------------------
test('casting.json: 30 unique slugs, no creator name in a slug, narrators add up, every house has a spec and a plan', () => {
  const fams = ctx.casting.families;
  assert.equal(fams.length, 30);
  assert.equal(new Set(fams.map((f) => f.slug)).size, 30);
  assert.equal(new Set(fams.map((f) => f.house)).size, 30);
  const authors = new Set<string>();
  for (const f of fams) {
    const spec = J('content', 'houses', `${f.house}.json`);
    assert.ok(fs.existsSync(path.join(ROOT, 'content', 'houses', `${f.house}.plan.json`)), `${f.house} has no plan.json`);
    if (spec.author) authors.add(String(spec.author).toLowerCase().replace(/[^a-z]/g, ''));
  }
  // creator fragments: every author name in the specs (letters only, 4+ characters) and the fragments in the house ids
  const fragments = [...authors].filter((a) => a.length >= 4).concat(['nora', 'olcia', 'schnuck', 'ornilia', 'turbogoku', 'clumsy', 'simmer', 'redo', 'roark', 'sarina', 'plnch', 'axiis', 'sims']);
  for (const f of fams) {
    assert.match(f.slug, /^[a-z]+(-[a-z]+){0,2}$/, `${f.slug}: slug shape`);
    for (const frag of fragments) assert.ok(!f.slug.includes(frag), `slug ${f.slug} contains the creator fragment "${frag}"`);
    assert.ok(!f.slug.includes(f.house), `slug ${f.slug} is derived from the house id`);
  }
  const narrators = new Map<string, number>();
  for (const f of fams) narrators.set(f.narrator, (narrators.get(f.narrator) || 0) + 1);
  for (const [k, v] of Object.entries(ctx.voices.voices)) assert.equal(narrators.get(k) || 0, v.narratorFor, `narrator count for ${k}`);
});

test('every home has a family or is declared without one: the plan\'s homesWithoutFamily is exactly the homes casting.json does not cast', () => {
  const homes: string[] = J('content', 'houses', 'index.json').houses.map((h: { id: string }) => h.id);
  const cast = new Set(ctx.casting.families.map((f) => f.house));
  const without = Object.keys(J('content', 'story', 'cast-plan.json').homesWithoutFamily ?? {}).sort();
  assert.deepEqual(homes.filter((id) => !cast.has(id)).sort(), without, 'a home with no family is in the plan\'s homesWithoutFamily, and only such a home (story:cast-lint says which)');
  for (const id of without) assert.ok(homes.includes(id), `${id} is declared without a family but is not a home`);
  assert.ok(homes.length >= cast.size, 'the story fleet is never larger than the gallery');
  // casting.json stays the 30 families: the apartments are not in it until a family moves in
  assert.equal(without.length, homes.length - cast.size);
});

test('casting.json: signature apps exist in the catalog, are story-safe and were boot-tested', () => {
  for (const f of ctx.casting.families) {
    assert.ok(f.signatureApps.length >= 3, `${f.slug}: at least three signature apps`);
    for (const id of f.signatureApps) {
      const a = ctx.apps.get(id);
      assert.ok(a, `${f.slug}: signature app ${id} is not in the catalog`);
      // Kiwix is avoid (empty library) but six rows of the unrewritten cast plan still list it; they lose it in the recast (cast-lint warns until then)
      if (id !== 'kiwix') assert.notEqual(a!.storySafe, 'avoid', `${f.slug}: ${id} is marked avoid`);
      assert.notEqual(a!.qa, 'not-boot-tested', `${f.slug}: ${id} was not boot-tested`);
    }
    assert.ok(ctx.voices.voices[f.narrator], `${f.slug}: narrator ${f.narrator}`);
  }
});

test('the house files agree with casting.json: every role casting lists is still in the house', () => {
  for (const f of ctx.casting.families) {
    const facts = ctx.house(f.house);
    assert.ok(facts, `${f.house}: no house facts`);
    assert.deepEqual(castingDisagreements(facts!, f, ctx.roles), [], `${f.slug} (${f.house})`);
    for (const u of ctx.roles.universal) assert.ok(facts!.roles.has(u), `${f.house}: universal role ${u} must resolve in every house`);
  }
});

test('the cast plan is current (casting.json and cast.md are derived from it, the house files and roles.json) and holds the fleet rules', () => {
  for (const [script, args] of [['build-casting.mts', ['--check']], ['cast-lint.mts', []]] as const) {
    const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'story', script), ...args], { encoding: 'utf8', cwd: ROOT });
    assert.equal(r.status, 0, `${script} ${args.join(' ')}\n${r.stdout}${r.stderr.replace(/\(node:\d+\) ExperimentalWarning[^\n]*\n(\(Use[^\n]*\n)?/g, '')}`);
  }
});

test('casting.json: every member is a valid story member, and every archetype has a room it can honestly be told in', () => {
  const roomRolesOf = (name: string): string[] => roomRoles(name, ctx.roles as unknown as RolesTable);
  for (const f of ctx.casting.families) {
    assert.ok(f.members.length >= 2 && f.members.length <= 6, `${f.slug}: ${f.members.length} members`);
    const ids = new Set<string>(), comps = new Set<string>(), arch = new Set<string>();
    for (const m of f.members) {
      assert.ok(m.id && /^[a-z][a-z0-9-]*$/.test(m.id), `${f.slug}: member id ${m.id}`);
      assert.ok(!ids.has(m.id!), `${f.slug}: duplicate member ${m.id}`); ids.add(m.id!);
      assert.ok((T.MEMBER_ROLES as readonly string[]).includes(m.role), `${f.slug}/${m.id}: role ${m.role}`);
      assert.equal(typeof m.age, 'number', `${f.slug}/${m.id}: age is a number`);
      assert.ok(m.archetype == null || (T.ARCHETYPES as readonly string[]).includes(m.archetype), `${f.slug}/${m.id}: archetype ${m.archetype}`);
      if (m.archetype) arch.add(m.archetype);
      if (m.companion) {
        assert.ok(Number(m.age) >= 13 && !['baby', 'child', 'visitor'].includes(m.role), `${f.slug}/${m.id}: a child, a baby or a visitor has no companion`);
        assert.ok(!comps.has(m.companion), `${f.slug}: companion ${m.companion} twice`); comps.add(m.companion);
      }
      for (const a of m.anchors ?? []) assert.ok(a.startsWith('room:') ? (T.ROOM_ROLES as readonly string[]).includes(a.slice(5)) : (T.ROLE_IDS as readonly string[]).includes(a), `${f.slug}/${m.id}: anchor ${a}`);
    }
    assert.ok(comps.size >= 1 && comps.size <= 3, `${f.slug}: ${comps.size} companions (the validator wants 1 to 3)`);
    assert.ok(arch.size >= 2, `${f.slug}: archetypes ${[...arch].join(', ')}`);
    // the room roles the home has, and the chapters the validator asks of every story: living, kitchen, garden and two more
    const have = new Set<string>(f.rooms.flatMap((r) => roomRolesOf(r.name)));
    for (const need of ['living', 'kitchen']) assert.ok(have.has(need), `${f.slug}: the home has no ${need} room`);
    assert.ok(['office', 'kids', 'bedroom', 'garage', 'dining', 'entry', 'laundry'].filter((r) => have.has(r)).length >= 2, `${f.slug}: fewer than two further room chapters are possible`);
    // persona-cover can be met: some room the archetype may be told in (its own, or the cast room's roles) exists in the home
    for (const m of f.members) {
      if (!m.archetype) continue;
      const d = ctx.personas.archetypes[m.archetype as T.Archetype];
      const preferred = d.rooms.some((r) => have.has(r));
      const allowed = new Set<string>([...(preferred ? d.rooms : [...d.rooms, ...d.fallbackRooms]), ...(m.roomRoles ?? [])]);
      assert.ok([...allowed].some((r) => have.has(r)), `${f.slug}/${m.id}: no room the ${m.archetype} can be told in`);
    }
  }
});

test('casting: a family file tells the cast plan\'s people and uses its apps; anything else is named', () => {
  const slug = 'vance-takahashi', cast = fx.castBySlug.get(slug)!;
  const withCast = (patch: (c: typeof cast) => typeof cast): Ctx => ({ ...fx, castBySlug: new Map(fx.castBySlug).set(slug, patch({ ...cast, members: cast.members.map((m) => ({ ...m })) })) }) as Ctx;
  const at = (r: ReturnType<typeof validateStory>): string[] => r.errors.filter((f) => f.rule === 'casting').map((f) => f.at);
  assert.deepEqual(at(validateStory(exemplar(), fx)), [], 'the exemplar tells the test world\'s people');
  // age, role, archetype and the companion are compared as well as the name
  const aged = withCast((c) => { c.members[0].age = 43; return c; });
  assert.deepEqual(at(validateStory(exemplar(), aged)), ['member.elias']);
  const arch = withCast((c) => { c.members[1].archetype = 'builder'; return c; });
  assert.deepEqual(at(validateStory(exemplar(), arch)), ['member.mika'], 'the archetype is the plan\'s');
  const comp = withCast((c) => { c.members[1].companion = 'Juniper'; return c; });
  assert.deepEqual(at(validateStory(exemplar(), comp)), ['member.mika'], 'the companion\'s name is the plan\'s');
  const surname = withCast((c) => { c.surname = 'Okafor'; c.place = 'Elsewhere'; return c; });
  assert.deepEqual(at(validateStory(exemplar(), surname)).sort(), ['place', 'surname']);
  const fewer = withCast((c) => { c.members = c.members.slice(0, 1); return c; });
  assert.deepEqual(at(validateStory(exemplar(), fewer)), ['member.mika'], 'a person the plan does not have');
  // a member of the older casting has no id: nothing to compare
  const legacy = withCast((c) => { c.members = c.members.map(({ id: _i, name: _n, ...m }) => m); delete c.surname; delete c.place; return c; });
  assert.deepEqual(at(validateStory(exemplar(), legacy)), []);
  // an app the plan counts on and no beat uses is a warning, not an error
  const apps = withCast((c) => { c.signatureApps = [...c.signatureApps, 'grist']; return c; });
  const r = validateStory(exemplar(), apps);
  assert.ok(r.warn.some((f) => f.rule === 'casting-apps' && /grist/.test(f.message)), 'casting-apps warns');
  assert.equal(r.errors.length + r.review.length, 0);
});

test('store names that are ordinary words: "Sunshine" in the middle of a sentence is the app, daylight copy is not; "Code Server" is the app, a code server is not', () => {
  const hit = (t: string): string[] => ctx.notInStore.filter((n) => n.re.test(t)).map((n) => n.name);
  for (const t of ['Sunshine fills the room.', 'The sunshine is gone by four.', 'Golden hour. Sunshine on the wall.', 'It is bright.\nSunshine again.', 'Onyx counters run along the wall.', 'A bowl of lychee on the island.']) assert.deepEqual(hit(t), [], t);
  for (const t of ['Steve streams with Sunshine.', 'She opens Lychee at the counter.']) assert.equal(hit(t).length, 1, t);
  assert.deepEqual(hit('She opens Kavita and MotionEye.').sort(), ['Kavita', 'motionEye'], 'every other name still matches in any case');
  assert.deepEqual(hit('She opens kavita.'), ['Kavita']);
  const named = (t: string): string[] => ctx.appMatchers.filter((m) => m.re.test(t)).map((m) => m.id);
  assert.deepEqual(named('John opens Code Server at his desk.'), ['code-server']);
  assert.deepEqual(named('John runs a code server in the garage.'), []);
});

test('catalog-apps.json: the first-party trio and the story-rich apps exist, avoid and not-boot-tested are counted', () => {
  for (const id of ctx.storyRich) assert.ok(ctx.apps.has(id), `story-rich app ${id}`);
  // the story-rich apps are the catalog's meta.top15 that have a QA screenshot (mealie has none and is left out, see context.mts)
  const top15 = (ctx.catalog.meta?.top15 ?? []).map((a) => a.id);
  assert.ok(top15.length >= 14 && ctx.storyRich.length >= 12 && ctx.storyRich.length <= top15.length, `${ctx.storyRich.length} story-rich of ${top15.length}`);
  for (const id of ctx.storyRich) assert.equal(ctx.apps.get(id)!.qa, 'screenshot', `${id}: a story-rich app has a QA screenshot`);
  assert.ok(ctx.catalog.apps.some((a) => a.qa === 'not-boot-tested'), 'not-boot-tested apps are in the catalog so that the app-qa rule has something to refuse');
  assert.ok(ctx.catalog.notInStore.apps.length > 50);
  for (const a of ctx.catalog.notInStore.apps) assert.ok(!ctx.apps.has(a.id), `${a.id} is both in the catalog and not in the store`);
});

// ---------------------------------------------------------------------------------------------------------------------
// Story v3 foundation (decisions of 2026-10-19): fourteen archetypes, age rule 16, Kiwix removed
// ---------------------------------------------------------------------------------------------------------------------
test('the twenty-six archetypes: the original six, the eight of story v3 in the owner\'s order, then the twelve of the persona expansion, in types.ts, the schema, personas.json and the casting build', () => {
  const eight = ['tech-family', 'business-owner', 'creative', 'contractor', 'marketer', 'lawyer', 'journalist', 'educator'];
  const twelve = ['money-keeper', 'housemate', 'carer', 'community-lead', 'researcher', 'seller', 'translator', 'archivist', 'traveller', 'athlete', 'collector', 'shift-worker'];
  assert.deepEqual([...T.ARCHETYPES], ['organiser', 'builder', 'gamer', 'learner', 'maker', 'host', ...eight, ...twelve]);
  assert.deepEqual([...CAST_ARCHETYPES], [...T.ARCHETYPES], 'scripts/story/build-casting.mts lists the same archetypes as types.ts');
  assert.deepEqual(Object.keys(ctx.personas.archetypes), [...T.ARCHETYPES], 'personas.json lists them in the same order');
  for (const k of [...eight, ...twelve]) assert.ok(ctx.personas.archetypes[k as T.Archetype].apps.every((id) => ctx.apps.get(id)!.storySafe !== 'avoid'), `${k}: no avoid app in the pool`);
});

test('the casting build knows every archetype: anchor and room preferences, and the twelve new ones follow their personas.json row', () => {
  for (const a of T.ARCHETYPES) {
    const def = ctx.personas.archetypes[a];
    assert.ok(PREFS[a]?.length > 0, `${a}: anchor preferences`);
    assert.ok(ROOM_PREF[a]?.length > 0, `${a}: room preferences`);
    // an anchor the casting walks is an item role (roles.json items): never a zone, the front door, the Core or "room"
    for (const r of PREFS[a]) assert.ok(r in ctx.roles.items || r === 'garden', `${a}: ${r} is an item role`);
  }
  for (const a of T.ARCHETYPES.slice(14)) {
    const def = ctx.personas.archetypes[a];
    assert.deepEqual(ROOM_PREF[a], [...def.rooms, ...def.fallbackRooms], `${a}: the casting's room order is the row's rooms, then its fallback rooms`);
    const anchors = [...def.anchorRoles, ...def.fallbackAnchorRoles];
    for (const r of PREFS[a]) assert.ok(anchors.includes(r as T.RoleId), `${a}: ${r} is one of the row's anchor roles`);
    assert.deepEqual(PREFS[a], def.anchorRoles.filter((r) => r in ctx.roles.items), `${a}: the casting's anchors are the row's item roles, in its order`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The front page's categories (content/story/categories.json, scripts/story/lib/categories.mts)
// ---------------------------------------------------------------------------------------------------------------------
const catRules = repoRules(ROOT);
const catFile = (): CategoriesFile => structuredClone(loadCategories(ROOT));
const catProblems = (f: unknown): string => checkCategories(f, catRules).join('\n');

test('categories.json: the shipped file passes, every archetype is in exactly one category, ids and labels are unique, labels are short sentence case without a dash', () => {
  const f = loadCategories(ROOT);
  assert.deepEqual(checkCategories(f, catRules), []);
  const held = f.categories.flatMap((c) => c.personas);
  assert.deepEqual([...held].sort(), [...T.ARCHETYPES].sort(), 'each archetype once');
  for (const a of T.ARCHETYPES) assert.equal(f.categories.filter((c) => c.personas.includes(a)).length, 1, `${a}: in exactly one category`);
  assert.equal(new Set(f.categories.map((c) => c.id)).size, f.categories.length, 'ids are unique');
  assert.equal(new Set(f.categories.map((c) => c.label.toLowerCase())).size, f.categories.length, 'labels are unique');
  for (const c of f.categories) {
    assert.ok(c.label.length <= LABEL_MAX, `${c.id}: label at most ${LABEL_MAX} characters`);
    assert.match(c.label, /^\p{Lu}[^\p{Lu}]*$/u, `${c.id}: label is sentence case`);
    assert.doesNotMatch(`${c.label} ${c.blurb}`, /[\u2013\u2014]|\s-\s|!/, `${c.id}: no dash and no exclamation mark`);
    assert.ok(c.blurb.split(/\s+/).length <= BLURB_WORDS && c.blurb.endsWith('.'), `${c.id}: blurb of at most ${BLURB_WORDS} words that ends with a full stop`);
    assert.ok(!(T.ARCHETYPES as readonly string[]).includes(c.id), `${c.id}: a category id is not an archetype id`);
  }
  assert.deepEqual(f.typeFilters.map((t) => t.id), ['home', 'apartment', 'office']);
  assert.equal(categoryOf(f, 'organiser')!.id, 'household');
  assert.equal(categoryOf(f, 'host')!.id, 'care');
});

test('categories.json: the checker names each kind of mistake', () => {
  const bad = (mutate: (f: CategoriesFile) => void): string => { const f = catFile(); mutate(f); return catProblems(f); };
  assert.match(bad((f) => { f.categories[0].personas.pop(); }), /translator is in no category/, 'an archetype left out');
  assert.match(bad((f) => { f.categories[1].personas.push('marketer'); }), /marketer is also in work-from-home/, 'an archetype in two');
  assert.match(bad((f) => { f.categories[0].personas.push('astronaut'); }), /astronaut is not an archetype/, 'an unknown archetype');
  assert.match(bad((f) => { f.categories[0].personas.push('marketer'); }), /marketer is listed twice/, 'listed twice in one category');
  assert.match(bad((f) => { f.categories[1].id = 'work-from-home'; }), /the id is used twice/, 'a duplicate id');
  assert.match(bad((f) => { f.categories[1].id = 'organiser'; }), /also an archetype id/, 'an id that is an archetype');
  assert.match(bad((f) => { f.categories[1].label = 'Work from home'; }), /used twice/, 'a duplicate label');
  assert.match(bad((f) => { f.categories[1].label = 'Run a small business'; }), /longer than 18 characters/, 'a long label');
  assert.match(bad((f) => { f.categories[1].label = 'Run a Business'; }), /not sentence case/, 'a title case label');
  assert.match(bad((f) => { f.categories[1].label = 'run a business'; }), /not sentence case/, 'a lower case label');
  assert.match(bad((f) => { f.categories[1].label = 'Run \u2013 a business'; }), /has a dash/, 'an en dash');
  assert.match(bad((f) => { f.categories[1].label = 'Run a business!'; }), /exclamation/, 'an exclamation mark');
  assert.match(bad((f) => { f.categories[1].blurb = 'Shops, trades and stalls \u2014 run from a garage.'; }), /blurb has a dash/, 'an em dash in a blurb');
  assert.match(bad((f) => { f.categories[1].blurb = 'Shops, trades and stalls'; }), /full stop/, 'a blurb with no full stop');
  assert.match(bad((f) => { f.categories[1].blurb = Array(21).fill('word').join(' ') + '.'; }), /21 words \(at most 20\)/, 'a long blurb');
  assert.match(bad((f) => { f.categories[1].blurb = 'Seamless shops, trades and stalls.'; }), /trips the claims rule/, 'a banned phrase');
  assert.match(bad((f) => { f.typeFilters.reverse(); }), /home, apartment, office, in that order/, 'type filters out of order');
  assert.match(bad((f) => { f.typeFilters.pop(); }), /home, apartment, office, in that order/, 'a missing type filter');
  assert.match(catProblems({ version: 1, categories: [], typeFilters: [] }), /fewer than 1/, 'the schema is checked first');
  assert.match(catProblems({ ...catFile(), extra: 1 }), /unknown property extra/, 'an unknown key');
});

test('catalog-apps.json: chat and agent apps carry ai "chat" (the age rule), non-chat AI tools do not, and Kiwix is avoid with a claims caveat', () => {
  const chat = ctx.catalog.apps.filter((a) => a.ai === 'chat').map((a) => a.id).sort();
  for (const id of ['open-webui', 'ollama', 'anything-llm', 'ci-hermes', 'ci-openclaw', 'ci-memory']) assert.ok(chat.includes(id), `${id} is a chat or agent app`);
  for (const a of ctx.catalog.apps) assert.ok(a.ai === undefined || a.ai === 'chat', `${a.id}: ai is "chat" or absent`);
  for (const id of ['libretranslate', 'whisper-webui', 'kokoro', 'stirling-pdf', 'paperless-gpt']) assert.equal(ctx.apps.get(id)?.ai, undefined, `${id} is a tool, not a chat model`);
  const kiwix = ctx.apps.get('kiwix')!;
  assert.equal(kiwix.storySafe, 'avoid');
  assert.ok(kiwix.caveats.some((c) => c.kind === 'claims' && /empty library/.test(c.text)), 'the caveat says why');
  for (const k of ['learner']) assert.ok(!ctx.personas.archetypes[k as T.Archetype].apps.includes('kiwix'), 'kiwix left the learner pool');
});

const caseStory = (name: string): Story => { const s = exemplar(); CASES.find((c) => c.name === name)!.mutate(s); return s; };
const notV3 = (s: Story): Story => { for (const b of s.beats) delete b.service; return s; };
const ruleAt = (r: ReturnType<typeof validateStory>, rule: string) => ({ error: r.errors.some((f) => f.rule === rule), warn: r.warn.some((f) => f.rule === rule) });

test('isV3Story: true when some beat has a service key; v3Severity is error there and warn elsewhere', () => {
  const s = exemplar();
  assert.equal(isV3Story(s), false); assert.equal(v3Severity(s), 'warn');
  s.beats[7].service = 'google-photos';
  assert.equal(isV3Story(s), true); assert.equal(v3Severity(s), 'error');
});

test('age rule 16: age-chat and age-companion are errors in a v3 family and warnings in every other; app-avoid follows the same device', () => {
  for (const [name, rule] of [['bad-46-age-chat', 'age-chat'], ['bad-47-age-companion', 'age-companion']] as const) {
    assert.deepEqual(ruleAt(validateStory(caseStory(name), fx), rule), { error: true, warn: false }, `${name} in a v3 family`);
    assert.deepEqual(ruleAt(validateStory(notV3(caseStory(name)), fx), rule), { error: false, warn: true }, `${name} in a family that is not v3`);
  }
  const kiwix = (s: Story): Story => { const b = s.beats.find((x) => x.id === 'kitchen-recipe')!; b.app = { id: 'kiwix', replaces: [] }; b.popup.chips = ['Kiwix']; return s; };
  assert.deepEqual(ruleAt(validateStory(kiwix(exemplar()), fx), 'app-avoid'), { error: false, warn: true }, 'app-avoid warns in a family that is not v3');
  const v3Kiwix = kiwix(exemplar()); v3Kiwix.beats[7].service = 'google-photos';
  assert.deepEqual(ruleAt(validateStory(v3Kiwix, fx), 'app-avoid'), { error: true, warn: false }, 'and fails a v3 family');
});

test('age-chat: a parent-led beat passes, a minor approving an agent does not, a chat app in `with` counts, and a tool such as LibreTranslate is allowed', () => {
  const v3 = (s: Story): Story => { s.beats.find((b) => b.id === 'living-photos')!.service = 'google-photos'; s.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3' }); return s; };
  // parent-led: the member is the adult, the child is named in the body as the one being helped
  const led = v3(exemplar()); const b = led.beats.find((x) => x.id === 'garden-plants')!;
  b.member = 'mika'; b.app = { id: 'open-webui', replaces: ['ChatGPT'] }; b.popup.chips = ['Open WebUI', 'replaces ChatGPT'];
  b.popup.body = 'Mika asks a model on the Core in Open WebUI to explain fractions, and reads the answer aloud to Otto at the table.';
  assert.deepEqual(ruleAt(validateStory(led, fx), 'age-chat'), { error: false, warn: false });
  // an adult's agent beat approved by a child
  const approved = v3(exemplar()); approved.beats.find((x) => x.id === 'office-reply')!.approval = 'otto';
  assert.ok(validateStory(approved, fx).errors.some((f) => f.rule === 'age-chat' && /approving member Otto/.test(f.message)));
  // a chat app named in `with` is the child's too
  const withChat = v3(exemplar()); const w = withChat.beats.find((x) => x.id === 'garden-plants')!; w.member = 'otto'; w.with = ['open-webui'];
  assert.ok(validateStory(withChat, fx).errors.some((f) => f.rule === 'age-chat' && f.at === 'garden-plants'));
  // a translation tool is not a chat model: a child may use it
  const tool = v3(exemplar()); const t = tool.beats.find((x) => x.id === 'garden-plants')!; t.member = 'otto'; t.app = { id: 'libretranslate', replaces: ['Google Translate'] }; t.popup.chips = ['LibreTranslate', 'replaces Google Translate'];
  assert.equal(validateStory(tool, fx).errors.some((f) => f.rule === 'age-chat'), false);
});

test('age-companion keeps the role part: a child, a baby or a visitor with a companion is an error whatever the family', () => {
  const s = exemplar(); const e = s.members.find((m) => m.id === 'elias')!;
  s.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3', companion: { ...e.companion!, name: 'Pip', voice: 'v-young-f' } });
  const r = validateStory(s, fx);
  assert.ok(r.errors.some((f) => f.rule === 'members' && f.at === 'otto' && /no companion/.test(f.message)), 'the role error is not phased in');
  assert.ok(r.warn.some((f) => f.rule === 'age-companion' && f.at === 'otto'), 'and the age rule warns in a family that is not v3');
});

// ---------------------------------------------------------------------------------------------------------------------
// Story v3: the registry of services, the pair rules, the household and band rules (reference/story/story-v3.md)
// ---------------------------------------------------------------------------------------------------------------------
const V3FILE = 'ok-9-story-v3.json';
const v3base = (): Story => J(FIX, V3FILE) as Story;
/** the same family told the pass 1 way: no service keys, the chip "replaces <X>" */
const legacyOf = (s: Story): Story => { for (const b of s.beats) if (b.service !== undefined) { delete b.service; b.popup.chips = [b.popup.chips![0], `replaces ${b.app!.replaces[0]}`]; } return s; };
const legacyCase = (name: string): Story => { const s = v3base(); CASES.find((c) => c.name === name)!.mutate(s); return legacyOf(s); };

test('story v3 constants: the schema, types.ts and the registry say the same thing', () => {
  const b = ctx.schema.$defs.beat.properties;
  assert.equal(b.service.pattern, T.SERVICE_ID_PATTERN);
  assert.equal(ctx.schema.$defs.popup.properties.chips.items.maxLength, T.CHIP_MAX_LENGTH);
  assert.equal(T.ALTERNATIVE_CHIP_PREFIX, 'alternative to ');
  assert.ok(!ctx.schema.$defs.beat.required.includes('service'), 'service is optional');
  const re = new RegExp(T.SERVICE_ID_PATTERN);
  for (const s of ctx.services.file!.services) assert.ok(re.test(s.id), `${s.id} matches the id pattern`);
  // a chip "alternative to " + the longest registry name fits the chip limit
  for (const s of ctx.services.file!.services) assert.ok(T.ALTERNATIVE_CHIP_PREFIX.length + s.name.length <= T.CHIP_MAX_LENGTH, `${s.name} fits a chip`);
});

test('services.json: 241 services with the flags kept, every derived column current, every invariant holding (build-services.mts --check)', () => {
  const inp = readInputs();
  const built = buildServices(inp);
  assert.deepEqual(built.problems, []);
  assert.equal(fs.readFileSync(path.join(ROOT, 'content', 'story', 'services.json'), 'utf8'), renderServices(built.file), 'services.json differs from what the catalog and the families give: run pnpm run story:services');
  const f = inp.file.services;
  assert.equal(f.length, 241);
  assert.equal(f.filter((s) => s.top80).length, 80);
  assert.deepEqual(f.filter((s) => s.flags.includes('stale')).map((s) => s.id).sort(), ['app-in-the-air', 'mint', 'ourhome', 'pocket'], 'stale services stay in the file with their flag');
  assert.equal(f.filter((s) => s.flags.includes('story-excluded')).length, 30);
  assert.equal(f.filter((s) => s.alternativeToForm === 'blocked').length, 4);
  assert.ok(f.every((s) => s.mark.mode === 'badge' && s.mark.cleared === false), 'no mark is cleared and none is a logo');
  assert.ok(f.every((s) => !(s.flags.includes('stale') || s.flags.includes('story-excluded') || s.alternativeToForm === 'blocked') || !s.mark.logoAllowed), 'logoAllowed is false for a stale, excluded or blocked service');
  // every catalog replaces name is a registry name or alias, so every app of the catalog is listed under its services
  const idx = ctx.services.byName;
  for (const a of ctx.catalog.apps) for (const r of a.replaces) { const sv = idx.get(r.toLowerCase()); assert.ok(sv, `${a.id}: "${r}" is in the registry`); assert.ok(sv!.apps.includes(a.id), `${sv!.id} lists ${a.id}`); }
  // storyApps is the catalog subset that is not avoid (Kiwix, marked avoid, left it)
  assert.ok(!f.some((s) => s.storyApps.includes('kiwix')) && f.find((s) => s.id === 'google-search')!.apps.includes('kiwix'));
});

test('services.json invariants fail on a registry that breaks them (build-services.mts)', () => {
  const clone = () => { const i = readInputs(); i.file = JSON.parse(JSON.stringify(i.file)); return i; };
  const svc = (i: ReturnType<typeof clone>, id: string) => i.file.services.find((s) => s.id === id)!;
  const problems = (i: ReturnType<typeof clone>, today = '2026-10-19') => buildServices(i, today).problems.join('\n');
  assert.equal(problems(clone()), '');
  const dup = clone(); svc(dup, 'notion').aliases = ['Dropbox']; assert.match(problems(dup), /"Dropbox" is also the name or an alias of notion/);
  const caseOnly = clone(); svc(caseOnly, 'privnote').aliases = ['PrivNote', 'privnote']; assert.equal(problems(caseOnly), '', 'an alias that differs from its own name only by case is allowed');
  const logo = clone(); svc(logo, 'notion').mark.mode = 'logo'; assert.match(problems(logo), /notion: mark.mode is logo and the mark is not allowed and cleared/); assert.match(problems(logo), /portal\/services\/notion/);
  const stale = clone(); svc(stale, 'mint').mark.logoAllowed = true; assert.match(problems(stale), /mint: logoAllowed must be false/);
  const link = clone(); svc(link, 'chatgpt').link = 'yes'; assert.match(problems(link), /chatgpt: link is yes but the homepage check says/);
  const renamed = clone(); svc(renamed, 'notebooklm').link = 'yes'; svc(renamed, 'notebooklm').homepageChecked = 'ok'; assert.match(problems(renamed), /notebooklm: a renamed service is text-only/);
  const cat = clone(); svc(cat, 'notion').category = 'cooking'; assert.match(problems(cat), /category "cooking"/);
  const unresolved = clone(); unresolved.catalog.push({ id: 'imaginary', replaces: ['Nonesuch Cloud'], storySafe: 'yes' }); assert.match(problems(unresolved), /imaginary replaces "Nonesuch Cloud"/);
  const beat = clone(); beat.families.push({ slug: 'x', beats: [{ id: 'b', service: 'nonesuch' }] }); assert.match(problems(beat), /x\/b: service "nonesuch" is not in the registry/);
  // the homepage check ages: a warning from thirty days, an error from ninety
  assert.equal(buildServices(clone(), '2026-11-20').warnings.length > 0, true); assert.equal(problems(clone(), '2026-11-20'), '');
  assert.match(problems(clone(), '2027-02-01'), /the homepage check is 106 days old/);
  // derived columns are recomputed, not trusted: a hand-edited rank, a fleet home and an app list are put right
  const hand = clone(); svc(hand, 'notion').rank = 99; svc(hand, 'notion').fleetHomes = ['nowhere']; svc(hand, 'notion').storyApps = ['affine'];
  const fixed = buildServices(hand).file.services.find((s) => s.id === 'notion')!;
  assert.deepEqual([fixed.rank, fixed.fleetHomes.includes('nowhere'), fixed.storyApps.length > 1], [1, false, true]);
  // a v3 beat names its service in the ledger; a legacy beat names the services its app.replaces holds
  const ledger = clone(); ledger.families = [{ slug: 'a', beats: [{ id: 'one', service: 'plex', app: { id: 'jellyfin', replaces: ['Plex'] } }, { id: 'two', app: { id: 'immich', replaces: ['Google Photos'] } }] }];
  const led = buildServices(ledger).file.services;
  assert.deepEqual([led.find((s) => s.id === 'plex')!.fleetHomes, led.find((s) => s.id === 'google-photos')!.fleetHomes, led.find((s) => s.id === 'notion')!.fleetHomes], [['a'], ['a'], []]);
});

test('ok-9-story-v3.json: a whole v3 family that reports nothing, by the library and by the CLI', () => {
  const s = v3base();
  assert.ok(isV3Story(s));
  const r = validateStory(s, fx);
  assert.deepEqual([...r.errors, ...r.review, ...r.warn].map((f) => r.line(f)), []);
  assert.equal(r.allowed.length, 1, 'one beat is on the allow-list, as in ok-6');
  const pairs = s.beats.filter((b) => b.service !== undefined);
  assert.equal(pairs.length, 16);
  assert.ok(pairs.every((b) => fx.services.byId.has(b.service!) && b.popup.chips!.length === 2 && b.popup.chips![1] === `alternative to ${fx.services.byId.get(b.service!)!.name}`));
  assert.equal(r.stats.pairShare, 0.8); assert.ok((r.stats.personaPairShare as number) >= 0.8);
  assert.equal((r.stats.services as string[]).length, 15);
  const j = JSON.parse(cli(path.join(FIX, V3FILE), '--json').stdout);
  assert.deepEqual([j.totals.errors, j.totals.review, j.totals.warnings], [0, 0, 0]);
  // nobody under 16 has a chat model in their own beat or a companion
  for (const b of s.beats) { const m = s.members.find((x) => x.id === b.member); if (m && m.age < 16) assert.notEqual(fx.apps.get(b.app?.id ?? '')?.ai, 'chat', `${b.id}`); }
});

test('story v3 rules: an error in a v3 family, a warning in the same family told the pass 1 way', () => {
  const sev = (s: Story, rule: string) => { const r = validateStory(s, fx); return { error: r.errors.some((f) => f.rule === rule), warn: r.warn.some((f) => f.rule === rule) }; };
  for (const [name, rule] of [['bad-52-service-missing', 'service-missing'], ['bad-56-persona-band', 'persona-band'], ['bad-57-household-beats', 'household-beats'], ['bad-59-household-doer', 'household-doer'], ['bad-60-pair-share', 'pair-share'], ['bad-60-pair-share', 'pair-budget']] as const) {
    const s = v3base(); CASES.find((c) => c.name === name)!.mutate(s);
    assert.deepEqual(sev(s, rule), { error: true, warn: false }, `${rule} in a v3 family (${name})`);
    // legacy: no service key anywhere, so nothing marks the family v3. (bad-52 loses its service, bad-60 never had one on the beats it changed; every pair beat goes back to the replaces chip)
    assert.deepEqual(sev(legacyOf(s), rule), { error: false, warn: true }, `${rule} in a family that is not v3 (${name})`);
  }
  // chips-legacy: the pass 1 chip is a warning (once, with the count) in a family that is not v3 and an error beat by beat in a v3 family
  const old = legacyOf(v3base()); const r = validateStory(old, fx);
  assert.deepEqual(r.errors.map((f) => f.rule), []); assert.equal(r.warn.filter((f) => f.rule === 'chips-legacy').length, 1); assert.match(r.warn.find((f) => f.rule === 'chips-legacy')!.message, /^16 beats use/);
  const mixed = v3base(); const b = mixed.beats.find((x) => x.id === 'garden-beds')!; b.app!.replaces = []; b.popup.chips = ['HortusFox', 'replaces Google Photos'];
  assert.ok(validateStory(mixed, fx).errors.some((f) => f.rule === 'chips-legacy' && f.at === 'garden-beds'));
  // the phase-in covers every legacy sample: the thirty shipped families never have more than warnings (the next test validates them)
  assert.ok(phased.has('pair-share') && phased.has('chips-legacy') && !phased.has('service-app'));
});

test('service-status: a stale, an excluded and a blocked service are refused; service-app: the app, the name and the registry must agree', () => {
  const rules = (s: Story) => validateStory(s, fx).errors.map((f) => `${f.rule} ${f.at}`);
  const status = v3base(); const b = status.beats.find((x) => x.id === 'living-film')!;
  // Gmail is story-excluded and Mint is stale; a service the registry refuses cannot be paired whatever the app
  for (const id of ['gmail', 'mint', 'pocket']) { b.service = id; b.app!.replaces = [ctx.services.byId.get(id)!.name]; assert.ok(rules(status).includes('service-status living-film'), id); }
  // an alias is the same service: the catalog spells GitLab (SaaS), the registry name is GitLab, and both chips are accepted
  const alias = v3base(); const g = alias.beats.find((x) => x.id === 'suite-repos')!;
  g.service = 'gitlab'; g.app!.replaces = ['GitLab (SaaS)']; g.detail!.before = "The day's branch went to GitLab, with the issues and merge requests kept there.";
  g.popup.chips = ['Forgejo', 'alternative to GitLab']; assert.deepEqual(rules(alias), []);
  g.popup.chips = ['Forgejo', 'alternative to GitLab (SaaS)']; assert.deepEqual(rules(alias), [], 'the alias app.replaces[0] uses is accepted too');
  g.popup.chips = ['Forgejo', 'alternative to GitHub']; assert.deepEqual(rules(alias), ['chips suite-repos']);
  // a service the app does not replace (Forgejo and Google Photos), and an app the registry does not list for the service
  g.popup.chips = ['Forgejo', 'alternative to Google Photos']; g.service = 'google-photos'; g.app!.replaces = ['Google Photos'];
  assert.ok(rules(alias).includes('service-app suite-repos'));
  const unlisted = v3base(); const reg = JSON.parse(JSON.stringify(fx.services.file)); reg.services.find((s: any) => s.id === 'github').apps = [];
  const fx2 = { ...fx, services: { file: reg, byId: new Map(reg.services.map((s: any) => [s.id, s])), byName: fx.services.byName } } as unknown as Ctx;
  fx2.services.byName = new Map(); for (const s of reg.services) for (const n of [s.name, ...s.aliases]) fx2.services.byName.set(n.toLowerCase(), s);
  assert.ok(validateStory(unlisted, fx2).errors.some((f) => f.rule === 'service-app' && /registry does not list/.test(f.message)));
});

test('household-doer: a possessor or "of Sally" is not a doer; household-kind groups apps that do one job; household-beats allows eight for a couple', () => {
  const hh = (body: string): Story => { const s = v3base(); const b = s.beats.find((x) => x.id === 'garden-beds')!; delete b.member; b.popup.body = body; return s; };
  const doer = (s: Story) => validateStory(s, fx).errors.some((f) => f.rule === 'household-doer');
  assert.equal(doer(hh('The garden journal in HortusFox holds each bed, each watering and a photo, and it sits on the Core by the pool.')), false);
  assert.equal(doer(hh("Sally's watering rota in HortusFox holds each bed and each watering, and it sits on the Core by the pool.")), false, 'a possessor');
  assert.equal(doer(hh('The rota that Jean fills in HortusFox holds each bed and each watering, and it sits on the Core by the pool.')), true, 'a subject');
  assert.equal(doer(hh('The beds on the plan of Jean get watered, and HortusFox keeps the journal on the Core by the pool.')), false, '"of Jean"');
  // an agent on a household beat
  const agent = v3base(); const a = agent.beats.find((x) => x.id === 'office-draft')!; delete a.member; assert.ok(validateStory(agent, fx).errors.some((f) => f.rule === 'household-doer' && /agent/.test(f.message)));
  // kinds: two beats of one group are a warning only
  const kinds = validateStory(J(FIX, 'bad-58-household-kind.json'), fx);
  assert.ok(kinds.warn.some((f) => f.rule === 'household-kind' && /list/.test(f.message)) && !kinds.errors.some((f) => f.rule === 'household-kind'));
  assert.ok(HOUSEHOLD_KINDS['burn-after-reading note'].includes('cryptgeon') && HOUSEHOLD_KINDS['DNS filter'].includes('pi-hole') && HOUSEHOLD_KINDS.calendar.includes('radicale') && HOUSEHOLD_KINDS['notes app'].includes('memos') && HOUSEHOLD_KINDS.reader.includes('miniflux'));
  // a couple may have eight household beats, a family of four six
  const couple = (n: number): Story => { const s = exemplar(); s.beats.filter((b) => b.chapter !== 'ftue' && b.chapter !== 'outro').slice(0, n).forEach((b) => { delete b.member; delete b.agent; delete b.approval; }); return s; };
  const hits = (s: Story) => validateStory(s, fx).warn.filter((f) => f.rule === 'household-beats').length;
  assert.equal(hits(couple(7)), 0, 'seven and the exemplar\'s own household beat make eight'); assert.equal(hits(couple(8)), 1);
  const four = v3base(); four.beats.filter((b) => b.chapter !== 'ftue' && b.chapter !== 'outro').slice(0, 6).forEach((b) => { delete b.member; delete b.agent; delete b.approval; });
  assert.equal(validateStory(four, fx).errors.some((f) => f.rule === 'household-beats'), false, 'six');
});

test('persona-band: a baby 1 to 3, a child under 13 3 to 7, an adult or teen 4 to 7 (8 for a business organiser), 8 to 11 in a family of three, 10 to 12 in a family of two', () => {
  const at = (s: Story): string[] => validateStory(s, fx).errors.filter((f) => f.rule === 'persona-band').map((f) => f.at);
  const four = v3base();
  assert.deepEqual(at(four), []);
  assert.deepEqual([BANDS.family4, BANDS.businessOrganiser, BANDS.family3, BANDS.family2, BANDS.child, BANDS.baby], [{ min: 4, max: 7 }, { min: 4, max: 8 }, { min: 8, max: 11 }, { min: 10, max: 12 }, { min: 3, max: 7 }, { min: 1, max: 3 }]);
  // Sally (a business organiser) may have eight, John only seven
  const eight = v3base(); const moveTo = (s: Story, id: string, who: string) => { s.beats.find((b) => b.id === id)!.member = who; };
  moveTo(eight, 'living-scene', 'sally'); assert.deepEqual(at(eight), ['member.john'], 'John falls to three, Sally has eight and is inside her band');
  moveTo(eight, 'kitchen-rota', 'sally'); assert.ok(at(eight).includes('member.sally'), 'nine is too many');
  // a family that is not a business has no eight
  const calm = v3base(); calm.family.business = false; moveTo(calm, 'living-scene', 'sally'); assert.ok(at(calm).includes('member.sally'));
  // a family of two (the exemplar's people) needs ten to twelve each
  const two = exemplar(); const m = (id: string) => validateStory(two, fx).warn.filter((f) => f.rule === 'persona-band' && f.at === `member.${id}`).length;
  assert.equal(m('mika'), 1); assert.equal(m('elias'), 1);
  // a child under 13 and a baby
  const kids = v3base(); kids.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3' }, { id: 'bea', name: 'Bea', age: 1, role: 'baby', colour: 'chart-5' });
  const kidAt = (s: Story) => validateStory(s, fx).errors.filter((f) => f.rule === 'persona-band').map((f) => `${f.at}`);
  assert.deepEqual(kidAt(kids).filter((x) => x.endsWith('otto') || x.endsWith('bea')), ['member.otto', 'member.bea'], 'no beats at all');
  const give = (s: Story, id: string, who: string) => { s.beats.find((b) => b.id === id)!.member = who; };
  for (const id of ['garden-beds', 'jean-notes', 'jean-translate']) give(kids, id, 'otto');
  give(kids, 'steve-photos', 'bea');
  assert.deepEqual(kidAt(kids).filter((x) => x.endsWith('otto') || x.endsWith('bea')), [], 'three for the child, one for the baby');
});

test('fleet v3: constants restated, the app cap follows the families present, and the v3 counts gate only when every family is v3', () => {
  assert.equal(FLEET.appShareMax, 0.4); assert.equal(FLEET.smallBusinessShare, 0.18); assert.equal(FLEET.appsMin, 70);
  assert.deepEqual({ ...FLEET_V3 }, { appsMin: 100, pairShareMin: 0.8, servicesMin: 70, servicesPerHomeMin: 14, kiwixMax: 6, rareHomes: 8, rareShare: 0.4, v3Required: false });
  assert.deepEqual([appCap(30), appCap(36), appCap(10), appCap(5)], [12, 14, 4, 2], 'twelve of thirty, fourteen of thirty-six');
  // a fleet that is not v3 is held to nothing new: the new metrics are informational and the app minimum stays at seventy
  const old = fleetMetrics([exemplar()], fx, { complete: true });
  for (const l of ['Distinct services in the fleet', 'Services in each v3 home', 'Room beats with a service, lowest home', 'Families that name Kiwix']) assert.equal(old.metrics.find((m) => m.label === l)!.status, 'partial', l);
  assert.equal(old.metrics.find((m) => m.label === 'Distinct apps named')!.target, 'at least 70');
  assert.ok(!old.findings.some((f) => ['fleet-services', 'fleet-pairs', 'fleet-v3'].includes(f.rule)));
  // one v3 family alone is a v3 fleet: the app minimum is a hundred, services are 70 in the fleet and 14 in each home
  const v3 = fleetMetrics([v3base()], fx, { complete: true });
  assert.equal(v3.metrics.find((m) => m.label === 'Distinct apps named')!.target, 'at least 100');
  assert.ok(v3.findings.some((f) => f.rule === 'fleet-services' && /Distinct services in the fleet: 15 \(need at least 70\)/.test(f.message)));
  assert.ok(!v3.findings.some((f) => /Services in each v3 home/.test(f.message)), 'the family names fifteen services (fourteen are enough)');
  assert.ok(!v3.findings.some((f) => f.rule === 'fleet-pairs'));
  assert.equal(v3.metrics.find((m) => m.label === 'Families told in the v3 shape')!.value, '1 of 1');
  // fleet-v3 is off until the last home is rewritten
  const mixed = fleetMetrics([v3base(), variant('okonkwo-reid', () => {})], fx, { complete: true });
  assert.equal(mixed.metrics.find((m) => m.label === 'Families told in the v3 shape')!.status, 'partial'); assert.ok(!mixed.findings.some((f) => f.rule === 'fleet-v3'));
  // a v3 home whose room beats are under eighty percent paired is reported
  const thin = v3base(); delete thin.beats.find((b) => b.id === 'office-paper')!.service;
  assert.ok(fleetMetrics([thin], fx, { complete: true }).findings.some((f) => f.rule === 'fleet-pairs'));
  // the rare-app share is information, never a finding
  assert.ok(!fleetMetrics([v3base()], fx, { complete: true }).findings.some((f) => f.rule === 'fleet-rare'));
});

test('claims.json (story v3): the third-party text is true for Obsidian and n8n, names-logos-owners is the owners line, and the "alternative to" form is the sanctioned one', () => {
  const d = (id: string) => ctx.claims.disclosures.find((x) => x.id === id)!;
  assert.equal(d('third-party-apps').text, 'The other apps in these stories are made by other people, most of them open-source projects. Companion Intelligence did not make them.');
  assert.doesNotMatch(d('third-party-apps').text, /are open-source projects by other people/);
  assert.equal(d('names-logos-owners').text, 'Product names, logos and brands are the property of their owners. Naming them does not imply endorsement.');
  assert.ok(d('names-logos-owners').required && d('names-owners'), 'the earlier line stands until the pages change');
  const ban = (id: string) => ctx.claims.bannedPhrases.find((b) => b.id === id)! as any;
  assert.match(ban('incumbent-attack').fix, /<App> is an alternative to <Service>/);
  assert.match(ban('logo-trademark').scope, /portal\/services\//); assert.equal(ban('logo-trademark').severity, 'error');
  assert.equal(ctx.claims.bannedPhrases.length, 72, 'no ban was added or removed');
  // the pattern still bans a third-party logo in authored text
  assert.ok(ctx.bans.find((b) => b.id === 'logo-trademark')!.re.test('<img src="google.svg" alt="">'));
  // "alternative to X" passes the banned phrases for every service the registry allows as a second chip (alternativeToForm ok)
  const bad: string[] = [];
  for (const s of ctx.services.file!.services.filter((x) => x.alternativeToForm === 'ok')) for (const b of ctx.bans) if (b.severity === 'error' && b.re.test(`${T.ALTERNATIVE_CHIP_PREFIX}${s.name}`)) bad.push(`${s.id}:${b.id}`);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------------------------------------------------
// The fleet
// ---------------------------------------------------------------------------------------------------------------------
function variant(slug: string, patch: (s: Story) => void): Story {
  const s = exemplar(); s.slug = slug; patch(s); return s;
}
test('fleet: the uniqueness metrics always gate; the count metrics only under --complete', () => {
  const a = exemplar();
  const b = variant('nowak-pillai', (s) => { s.house = 'bgfamily'; });          // same surname, town, bodies, titles, companion names, first names
  const partial = fleetMetrics([a, b], fx, { complete: false });
  const failing = partial.metrics.filter((m) => m.status === 'fail').map((m) => m.label);
  for (const l of ['Surname', 'Address place', 'Companion name', 'Beat title outside the ftue', 'Beat body']) assert.ok(failing.includes(l), `${l} should clash`);
  assert.ok(partial.findings.some((f) => f.rule === 'fleet-unique' && f.severity === 'error'));
  assert.equal(partial.metrics.find((m) => m.label === 'Families present')!.status, 'partial');
  const complete = fleetMetrics([a, b], fx, { complete: true });
  assert.equal(complete.metrics.find((m) => m.label === 'Families present')!.status, 'fail');
  assert.ok(complete.findings.some((f) => f.rule === 'fleet-count' && f.severity === 'error'));
});

test('fleet: one family alone has no clash, and first names are limited to two uses across the fleet', () => {
  const one = fleetMetrics([exemplar()], fx, { complete: false });
  assert.equal(one.metrics.filter((m) => m.status === 'fail').length, 0, one.metrics.filter((m) => m.status === 'fail').map((m) => m.label).join());
  const names = ['elias', 'mika'];
  const three = [exemplar(), ...['okonkwo-reid', 'keane'].map((slug, i) => variant(slug, (s) => {
    s.family.surname = `Surname${'x'.repeat(i + 1)}`.replace(/[0-9]/g, ''); s.family.address.place = `Place ${'Ab'.repeat(i + 2)}`;
    s.members.forEach((m) => { if (m.companion) m.companion.name = `${m.companion.name}${'a'.repeat(i + 1)}`; });
    s.beats.forEach((bt) => { bt.popup.title += ` ${'x'.repeat(i + 1)}`; bt.popup.body += ` ${'x'.repeat(i + 1)}`; });
  }))];
  const r = fleetMetrics(three, fx, { complete: false });
  const clash = r.findings.filter((f) => f.rule === 'fleet-unique' && /First name/.test(f.message));
  assert.equal(clash.length, names.length, 'Elias and Mika appear three times');
  assert.equal(r.metrics.find((m) => m.label === 'Surname')!.status, 'pass');
});

// ---- the persona model's fleet rules
/** a stand-in for a family at `slug`, with its own surname, town, companion names, titles and bodies, so only what a test changes can clash */
function family(slug: string, i: number, patch: (s: Story) => void = () => {}): Story {
  const tag = 'x'.repeat(i + 1);
  return variant(slug, (s) => {
    s.family.surname = `Surname${tag}`; s.family.address.place = `Place ${'Ab'.repeat(i + 2)}`;
    s.members.forEach((m) => { if (m.companion) m.companion.name = `${m.companion.name}${'a'.repeat(i + 1)}`; });
    s.beats.forEach((bt) => { bt.popup.title += ` ${tag}`; bt.popup.body += ` ${tag}`; });
    patch(s);
  });
}
const clashes = (r: ReturnType<typeof fleetMetrics>, label: string): string[] => r.metrics.find((m) => m.label.startsWith(label))!.detail ?? [];
/** the same family cast in the flagship homes (brennan-one/two/three in the test world's casting.json): the surname and the names repeat */
const flagshipHome = (slug: string, i: number): Story => variant(slug, (s) => {
  s.family.surname = 'Brennan'; s.family.address.place = `Brennan Place ${'Cd'.repeat(i + 2)}`;
  s.beats.forEach((bt) => { bt.popup.title += ` ${'y'.repeat(i + 1)}`; bt.popup.body += ` ${'y'.repeat(i + 1)}`; });   // their rooms differ, so their words do
});
test('fleet-unique: flagship homes may share surname, first names and companion names with each other, and with nobody else', () => {
  assert.deepEqual(['brennan-one', 'brennan-two', 'brennan-three'].filter((s) => !fx.castBySlug.get(s)?.flagship), [], 'the test world marks three flagship homes');
  const three = ['brennan-one', 'brennan-two', 'brennan-three'].map(flagshipHome);
  const r = fleetMetrics(three, fx, { complete: false });
  assert.deepEqual(r.findings.filter((f) => f.rule === 'fleet-unique').map((f) => f.message), [], 'three flagship homes, one cast');
  // a flagship home beside a family that is not flagship: the surname and the companion names still clash
  const mixed = fleetMetrics([...three.slice(0, 1), family('keane', 0, (s) => { s.family.surname = 'Brennan'; s.members[0].companion!.name = three[0].members[0].companion!.name; })], fx, { complete: false });
  assert.deepEqual(clashes(mixed, 'Surname').length, 1, 'Brennan clashes with a family that is not flagship');
  assert.equal(clashes(mixed, 'Companion name').length, 1);
  // ... and the same cast under two slugs that are not flagship clashes as always
  const plain = fleetMetrics([flagshipHome('nowak-pillai', 0), flagshipHome('okonkwo-reid', 1)], fx, { complete: false });
  assert.equal(clashes(plain, 'Surname').length, 1);
  assert.ok(clashes(plain, 'Companion name').length >= 1);
  // flagship homes together are one use of a first name: with one other family that is two uses (allowed), with two it is three (not)
  const withOne = fleetMetrics([...three, family('keane', 0, (s) => { s.members[1].name = 'Odile'; })], fx, { complete: false });
  assert.deepEqual(clashes(withOne, 'First name'), [], 'Elias in three flagship homes and one other family is two uses');
  const withTwo = fleetMetrics([...three, family('keane', 0, (s) => { s.members[1].name = 'Odile'; }), family('ashworth', 1, (s) => { s.members[1].name = 'Petra'; })], fx, { complete: false });
  assert.equal(clashes(withTwo, 'First name').length, 1, 'a third use of Elias fails');
  // what a flagship home must still make its own: the address place, every beat title and body
  const same = fleetMetrics([flagshipHome('brennan-one', 0), flagshipHome('brennan-two', 0)], fx, { complete: false });
  for (const l of ['Address place', 'Beat title outside the ftue', 'Beat body']) assert.ok(clashes(same, l).length >= 1, `${l} still clashes between flagship homes`);
});

test('fleet-apps: a flagship family counts once per home, so three flagship homes weigh three families in the 40% cap', () => {
  const homes = ['brennan-one', 'brennan-two', 'brennan-three'].map(flagshipHome);
  const others = ['nowak-pillai', 'okonkwo-reid', 'keane', 'ashworth', 'dufresne', 'castellanos', 'adeyemi-castro'].map((s, i) => family(s, i));
  // Immich is in every exemplar-shaped story. Keep it in the three flagship homes and two others: five of ten homes (50%) is over the cap.
  // Counted as one family the flagship homes would make three of ten (30%) and the cap would not fire.
  for (const s of others.slice(2)) for (const b of s.beats) { if (b.app?.id === 'immich') { b.app = undefined; b.popup.chips = []; } b.with = (b.with || []).filter((a) => a !== 'immich'); }
  const r = fleetMetrics([...homes, ...others], fx, { complete: false });
  const busy = r.metrics.filter((m) => m.label === 'Busiest third-party app');
  assert.ok(busy.some((m) => m.detail?.includes('immich in 5 of 10 families')), JSON.stringify(busy));
  assert.ok(r.findings.some((f) => f.rule === 'fleet-apps' && /immich is in 5 of 10/.test(f.message)));
});

test('fleet-archetypes: counted per family; under --complete each of organiser, builder, gamer and learner needs six, and gamer at most twelve', () => {
  const withArch = (slug: string, i: number, a: string[]): Story => family(slug, i, (s) => { s.members.forEach((m, k) => { m.archetype = a[k] as any; }); });
  const label = 'Archetypes across the families';
  const fams = (n: number, a: string[], from = 0): Story[] => Array.from({ length: n }, (_, i) => withArch(`fam${i + from}`, i + from, a));
  const run = (stories: Story[], complete: boolean) => fleetMetrics(stories, fx, { complete });
  // 6 families with organiser + builder, 6 with gamer + learner: every core archetype in exactly six
  const ok = run([...fams(6, ['organiser', 'builder']), ...fams(6, ['gamer', 'learner'], 6)], true);
  const m = ok.metrics.find((x) => x.label === label)!;
  assert.equal(m.status, 'pass', m.detail?.join('; '));
  assert.match(m.value, /organiser 6, builder 6, gamer 6, learner 6, maker 0, host 0/);
  // five learners is one short: partial before --complete, a fleet-archetypes error after
  const low = [...fams(6, ['organiser', 'builder']), ...fams(5, ['gamer', 'learner'], 6), ...fams(1, ['gamer', 'maker'], 11)];
  assert.equal(run(low, false).metrics.find((x) => x.label === label)!.status, 'partial');
  assert.ok(!run(low, false).findings.some((f) => f.rule === 'fleet-archetypes'));
  assert.ok(run(low, true).findings.some((f) => f.rule === 'fleet-archetypes' && /learner in 5/.test(f.message)));
  // thirteen gamers is over the Steam Headless share
  const gamers = run([...fams(13, ['gamer', 'organiser']), ...fams(8, ['builder', 'learner'], 13)], true);
  assert.ok(gamers.findings.some((f) => f.rule === 'fleet-archetypes' && /gamer in 13/.test(f.message)));
  // maker and host are reported, never gated
  assert.ok(!run([...fams(6, ['organiser', 'builder']), ...fams(6, ['gamer', 'learner'], 6)], true).findings.some((f) => /maker|host/.test(f.message)));
});

test('fleet: the narrator count never exceeds voices.json, and must equal it when complete', () => {
  const r = fleetMetrics([exemplar()], fx, { complete: false });
  assert.equal(r.metrics.find((m) => m.label.startsWith('Narrator'))!.status, 'partial');
  const many = Array.from({ length: 7 }, (_, i) => variant(['okonkwo-reid', 'keane', 'ashworth', 'dufresne', 'castellanos', 'adeyemi-castro', 'nowak-pillai'][i], () => {}));
  const over = fleetMetrics(many, fx, { complete: false });
  assert.ok(over.findings.some((f) => f.rule === 'fleet-voices' && /narrates 7/.test(f.message)), 'v-clear-f narrates at most six');
});

// ---------------------------------------------------------------------------------------------------------------------
// Every authored family file in the repo
// ---------------------------------------------------------------------------------------------------------------------
test('every content/families/<slug>.json validates (zero files is a pass)', () => {
  const dir = path.join(ROOT, 'content', 'families');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && f !== 'films.json') : [];
  for (const f of files) {
    const r = validateStory(J('content', 'families', f), ctx as Ctx);
    assert.deepEqual([...r.errors, ...r.review].map((x) => r.line(x)), [], `${f}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The publish-day catalog re-check (scripts/story/build-catalog-snapshot.mts does the I/O; these are its pure parts)
// ---------------------------------------------------------------------------------------------------------------------
test('catalog re-check: an app that left the store fails stories; renames and new apps are information', () => {
  const ids = ctx.catalog.apps.map((a) => a.id);
  const live = ids.filter((id) => id !== 'wallos').map((id) => ({ id })).concat([{ id: 'brand-new-app' }]);
  const manifests = new Map(ctx.catalog.apps.map((a) => [a.id, { id: a.id, name: a.name, available: true, replaces: a.replaces }]));
  manifests.set('immich', { id: 'immich', name: 'Immich', available: true, replaces: ['iCloud Photos'] });     // dropped Google Photos
  manifests.set('navidrome', { id: 'navidrome', name: 'Navidrome Pro', available: true, replaces: ['Spotify', 'Apple Music'] });
  const d = diffCatalog(ctx.catalog, live, manifests);
  assert.deepEqual(d.removed, ['wallos']);
  assert.deepEqual(d.replacesDropped, [{ id: 'immich', names: ['Google Photos'] }]);
  assert.deepEqual(d.renamed.map((r) => r.id), ['navidrome']);
  assert.ok(d.newInStore.includes('brand-new-app'));
  assert.ok(diffBlocks(d));
  assert.equal(diffBlocks(diffCatalog(ctx.catalog, ids.map((id) => ({ id })), manifests.set('immich', { id: 'immich', name: 'Immich', available: true, replaces: ['Google Photos', 'iCloud Photos'] }))), false);

  const refreshed = applyDiff(ctx.catalog, live, '2026-12-01');
  assert.equal(refreshed.apps.find((a) => a.id === 'wallos')!.inLiveStore, false);
  assert.equal(refreshed.apps.find((a) => a.id === 'immich')!.inLiveStore, true);
  assert.equal(refreshed.apps.find((a) => a.id === 'immich')!.storySafe, ctx.apps.get('immich')!.storySafe, 'curated fields are untouched');
  assert.equal(ctx.apps.get('wallos')!.inLiveStore, true, 'applyDiff does not mutate its input');
});

test('a story naming an app the snapshot marks as gone from the store fails app-not-in-store', () => {
  const local = loadContext(ROOT, { world: WORLD });
  local.apps.get('wallos')!.inLiveStore = false;
  const r = validateStory(exemplar(), local);
  assert.ok(ruleIds(r).has('app-not-in-store'));
  assert.ok(!ruleIds(validateStory(exemplar(), fx)).has('app-not-in-store'));
});

// ---------------------------------------------------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------------------------------------------------
const cli = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'validate-stories.mts'), ...args], { encoding: 'utf8', cwd: ROOT });
test('cli: the exemplar exits 0 with 0 errors and 0 review in --json (warnings only for the story v3 phase-in); a bad fixture exits 1', () => {
  const ok = cli(path.join(FIX, 'exemplar.json'), '--json');
  assert.equal(ok.status, 0, ok.stderr);
  const j = JSON.parse(ok.stdout);
  assert.equal(j.ok, true);
  assert.deepEqual([j.totals.errors, j.totals.review], [0, 0]);
  assert.deepEqual(j.families[0].warnings.filter((w: any) => !phased.has(w.rule)), [], 'warnings are only the story v3 phase-in rules');
  assert.equal(j.families[0].slug, 'vance-takahashi');
  const bad = cli(path.join(FIX, 'bad-9-ftue-leak.json'), '--json');
  assert.equal(bad.status, 1);
  assert.ok(JSON.parse(bad.stdout).families[0].errors.some((e: any) => e.rule === 'ftue-claims' && e.fix));
});

test('cli: no family files is a pass with a note; --complete then fails on the missing thirty; unknown flags and missing files are refused', () => {
  const dir = path.join(ROOT, 'content', 'families');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && f !== 'films.json') : [];
  if (!files.length) {
    const none = cli();
    assert.equal(none.status, 0); assert.match(none.stdout, /No family files yet/);
    const complete = cli('--complete');
    assert.equal(complete.status, 1); assert.match(complete.stdout, /Families present/);
    assert.match(complete.stdout, /FAIL/);
  }
  assert.equal(cli('--nonsense').status, 2);
  const missing = cli('no-such-family');
  assert.equal(missing.status, 1); assert.match(missing.stdout, /no such family file/);
});
