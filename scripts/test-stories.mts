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
import { fleetMetrics } from './story/lib/fleet.mts';
import { plain } from './story/lib/text.mts';
import { CASES } from './story/lib/bad-cases.mts';
import { castingDisagreements } from './story/lib/house.mts';
import { applyDiff, diffBlocks, diffCatalog } from './story/lib/catalog-diff.mts';

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
    ['ARCHETYPES', T.ARCHETYPES, d.member.properties.archetype.enum],
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
test('the exemplar passes with 0 errors, 0 review and 0 warnings', () => {
  const r = validateStory(exemplar(), fx);
  assert.deepEqual(r.errors.map((f) => r.line(f)), []);
  assert.deepEqual(r.review.map((f) => r.line(f)), []);
  assert.deepEqual(r.warn.map((f) => r.line(f)), []);
});

const index: { name: string; file: string; expect: string[]; warn?: string[]; absent?: string[] }[] = J(FIX, 'cases.json');
test('every case in bad-cases.mts has a fixture, and every fixture is exemplar + its mutation (regenerate with make-bad-fixtures.mts)', () => {
  assert.deepEqual(index.map((c) => c.name), CASES.map((c) => c.name));
  for (const c of CASES) {
    const s = exemplar(); c.mutate(s);
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
    if (!c.expect.length) assert.equal(r.errors.length + r.review.length, 0, [...r.errors, ...r.review].map((f) => r.line(f)).join('\n'));
    if (!c.expect.length && !c.warn?.length) assert.deepEqual(r.warn.map((f) => r.line(f)), [], 'a clean case has no warnings');
  });
}

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
    'A draft, never sent alone', 'A client asks a tricky question. Mika texts Odette, and Odette drafts a reply using the context Mika connected to Companion Memory (beta). Mika reads it and sends it herself.', 'Here is a draft. Please read it before you send it.',
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

test('casting.json: signature apps exist in the catalog, are story-safe and were boot-tested', () => {
  for (const f of ctx.casting.families) {
    assert.ok(f.signatureApps.length >= 3, `${f.slug}: at least three signature apps`);
    for (const id of f.signatureApps) {
      const a = ctx.apps.get(id);
      assert.ok(a, `${f.slug}: signature app ${id} is not in the catalog`);
      assert.notEqual(a!.storySafe, 'avoid', `${f.slug}: ${id} is marked avoid`);
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
test('cli: the exemplar exits 0 with 0 errors, 0 review, 0 warnings in --json; a bad fixture exits 1', () => {
  const ok = cli(path.join(FIX, 'exemplar.json'), '--json');
  assert.equal(ok.status, 0, ok.stderr);
  const j = JSON.parse(ok.stdout);
  assert.equal(j.ok, true);
  assert.deepEqual([j.totals.errors, j.totals.review, j.totals.warnings], [0, 0, 0]);
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
