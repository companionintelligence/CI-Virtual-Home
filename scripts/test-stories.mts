#!/usr/bin/env -S node --experimental-strip-types
// Tests for the family-story contract and its validator (scripts/validate-stories.mts, scripts/story/lib/*).
// Usage: pnpm run test   (node --test; no GPU, no network, no build needed)
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from '../assets/story/types.ts';
import type { Story } from '../assets/story/types.ts';
import { loadContext, ROOT, type Ctx } from './story/lib/context.mts';
import { validateStory } from './story/lib/validate.mts';
import { checkSchema, schemaKeywordsUsed, SUPPORTED_KEYWORDS } from './story/lib/schema-lite.mts';
import { fleetMetrics } from './story/lib/fleet.mts';
import { plain } from './story/lib/text.mts';
import { CASES } from './story/lib/bad-cases.mts';
import { castingDisagreements } from './story/lib/house.mts';
import { applyDiff, diffBlocks, diffCatalog } from './story/lib/catalog-diff.mts';

const ctx = loadContext();
const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const FIX = path.join('test', 'fixtures', 'stories');
const exemplar = (): Story => J(FIX, 'example-vance-takahashi.json');
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
  const r = validateStory(exemplar(), ctx);
  assert.deepEqual(r.errors.map((f) => r.line(f)), []);
  assert.deepEqual(r.review.map((f) => r.line(f)), []);
  assert.deepEqual(r.warn.map((f) => r.line(f)), []);
});

const index: { name: string; file: string; expect: string[]; absent?: string[] }[] = J(FIX, 'cases.json');
test('every case in bad-cases.mts has a fixture, and every fixture is exemplar + its mutation (regenerate with make-bad-fixtures.mts)', () => {
  assert.deepEqual(index.map((c) => c.name), CASES.map((c) => c.name));
  for (const c of CASES) {
    const s = exemplar(); c.mutate(s);
    assert.deepEqual(J(FIX, `${c.name}.json`), s, `${c.name}.json is stale: run node --experimental-strip-types scripts/story/make-bad-fixtures.mts`);
  }
});

for (const c of index) {
  test(`fixture ${c.name} ${c.expect.length ? `fails with ${c.expect.join(', ')}` : `does not trip ${(c.absent || []).join(', ')}`}`, () => {
    const r = validateStory(J(FIX, c.file), ctx);
    const ids = ruleIds(r);
    for (const e of c.expect) assert.ok(ids.has(e), `expected rule ${e}; got ${[...ids].join(', ') || 'nothing'}`);
    if (c.expect.length) assert.ok(r.failed, 'a negative fixture must fail the gate');
    for (const a of c.absent || []) assert.ok(!r.allRuleIds().includes(a), `rule ${a} must not fire (false-positive guard); got ${r.allRuleIds().join(', ')}`);
    if (!c.expect.length) assert.equal(r.errors.length + r.review.length, 0, r.errors.map((f) => r.line(f)).join('\n'));
  });
}

test('the reference validator and the TypeScript port agree on rule ids for the exemplar and the ported cases', async () => {
  process.env.STORY_DATA = path.join(ROOT, 'content', 'story');
  process.env.STORY_EXAMPLE = path.join(ROOT, FIX, 'example-vance-takahashi.json');
  const ref: any = await import(path.join(ROOT, 'reference', 'story', 'ref', 'ref-validate.mjs'));
  const refIds = (s: unknown): string[] => { const r = ref.validate(s); return [...new Set([...r.errors, ...r.review].map((m: string) => m.split(' ')[0]))].sort(); };
  const tsIds = (s: unknown): string[] => [...ruleIds(validateStory(s, ctx))].sort();
  assert.deepEqual(tsIds(exemplar()), refIds(exemplar()));
  for (const c of CASES.slice(0, 10)) {                                   // the ten ported from the reference
    const s = exemplar(); c.mutate(s);
    assert.deepEqual(tsIds(s), refIds(s), `${c.name}: rule ids differ between the reference validator and the port`);
  }
});

test('the review allow-list clears exactly the listed finding and flags stale entries', () => {
  const s = exemplar(); CASES.find((c) => c.name === 'bad-18-no-screenshot')!.mutate(s);
  const plainRun = validateStory(s, ctx);
  assert.ok(plainRun.review.some((f) => f.rule === 'app-qa-screenshot'));
  const cleared = loadContext(ROOT, { reviewed: [{ slug: 'vance-takahashi', at: 'kitchen-recipe', rule: 'app-qa-screenshot', by: 'LB' }] });
  const r = validateStory(s, cleared);
  assert.equal(r.review.length, 0); assert.equal(r.allowed.length, 1); assert.equal(r.failed, false);
  const stale = validateStory(exemplar(), loadContext(ROOT, { reviewed: [{ slug: 'vance-takahashi', at: 'kitchen-recipe', rule: 'app-qa-screenshot', by: 'LB' }] }));
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
test('claims.json: 69 ban rules, ids unique, every regex compiles and none is global (a global regex keeps state between tests)', () => {
  const bans = ctx.claims.bannedPhrases;
  assert.equal(bans.length, 69);
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

test('catalog-apps.json: the first-party trio and the story-rich apps exist, avoid and not-boot-tested are counted', () => {
  for (const id of ctx.storyRich) assert.ok(ctx.apps.has(id), `story-rich app ${id}`);
  assert.equal(ctx.storyRich.length, 15);
  assert.equal(ctx.catalog.apps.filter((a) => a.qa === 'not-boot-tested').length, 11);
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
  const partial = fleetMetrics([a, b], ctx, { complete: false });
  const failing = partial.metrics.filter((m) => m.status === 'fail').map((m) => m.label);
  for (const l of ['Surname', 'Address place', 'Companion name', 'Beat title outside the ftue', 'Beat body']) assert.ok(failing.includes(l), `${l} should clash`);
  assert.ok(partial.findings.some((f) => f.rule === 'fleet-unique' && f.severity === 'error'));
  assert.equal(partial.metrics.find((m) => m.label === 'Families present')!.status, 'partial');
  const complete = fleetMetrics([a, b], ctx, { complete: true });
  assert.equal(complete.metrics.find((m) => m.label === 'Families present')!.status, 'fail');
  assert.ok(complete.findings.some((f) => f.rule === 'fleet-count' && f.severity === 'error'));
});

test('fleet: one family alone has no clash, and first names are limited to two uses across the fleet', () => {
  const one = fleetMetrics([exemplar()], ctx, { complete: false });
  assert.equal(one.metrics.filter((m) => m.status === 'fail').length, 0, one.metrics.filter((m) => m.status === 'fail').map((m) => m.label).join());
  const names = ['elias', 'mika'];
  const three = [exemplar(), ...['okonkwo-reid', 'keane'].map((slug, i) => variant(slug, (s) => {
    s.family.surname = `Surname${'x'.repeat(i + 1)}`.replace(/[0-9]/g, ''); s.family.address.place = `Place ${'Ab'.repeat(i + 2)}`;
    s.members.forEach((m) => { if (m.companion) m.companion.name = `${m.companion.name}${'a'.repeat(i + 1)}`; });
    s.beats.forEach((bt) => { bt.popup.title += ` ${'x'.repeat(i + 1)}`; bt.popup.body += ` ${'x'.repeat(i + 1)}`; });
  }))];
  const r = fleetMetrics(three, ctx, { complete: false });
  const clash = r.findings.filter((f) => f.rule === 'fleet-unique' && /First name/.test(f.message));
  assert.equal(clash.length, names.length, 'Elias and Mika appear three times');
  assert.equal(r.metrics.find((m) => m.label === 'Surname')!.status, 'pass');
});

test('fleet: the narrator count never exceeds voices.json, and must equal it when complete', () => {
  const r = fleetMetrics([exemplar()], ctx, { complete: false });
  assert.equal(r.metrics.find((m) => m.label.startsWith('Narrator'))!.status, 'partial');
  const many = Array.from({ length: 7 }, (_, i) => variant(['okonkwo-reid', 'keane', 'ashworth', 'dufresne', 'castellanos', 'adeyemi-castro', 'nowak-pillai'][i], () => {}));
  const over = fleetMetrics(many, ctx, { complete: false });
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
  const local = loadContext();
  local.apps.get('wallos')!.inLiveStore = false;
  const r = validateStory(exemplar(), local);
  assert.ok(ruleIds(r).has('app-not-in-store'));
  assert.ok(!ruleIds(validateStory(exemplar(), ctx)).has('app-not-in-store'));
});
