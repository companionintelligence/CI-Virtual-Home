#!/usr/bin/env -S node --experimental-strip-types
// The front page's logic (scripts/story/lib/lander.mts, the plan content/story/lander.json): the plan held to its schema and to the tree, the ad-ready gate and the
// featured families, the proof, the count in words and the kinds of place. Each rule is held on fixtures with the case that should break it, then the plan and the
// choices on the real tree. No browser, no built site. Pure Node. Needs `pnpm run build` (portal-pages imports assets/home-names.js).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildPairIndex } from './story/lib/pairs.mts';
import type { AppLite, ServiceLite } from './story/lib/pairs.mts';
import { countLine, familiesWord, featuredOf, gateOf, placeTypes, proofOf, validatePlan, computeLander, readInputs, bansOf, officeProblem } from './story/lib/lander.mts';
import type { FamilyLite, LanderPlan, StoryFull } from './story/lib/lander.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));

const svc = (id: string, name: string, o: Partial<ServiceLite> = {}): ServiceLite => ({ id, name, aliases: [], category: 'data', link: 'yes', flags: [], alternativeToForm: 'ok', storyStatus: 'ok', ...o });
const app = (id: string, name: string, o: Partial<AppLite> = {}): AppLite => ({ id, name, storySafe: 'yes', inLiveStore: true, ...o });
const SERVICES = [svc('google-photos', 'Google Photos', { category: 'photos' }), svc('dropbox', 'Dropbox'), svc('notion', 'Notion', { category: 'notes' }), svc('chatgpt', 'ChatGPT', { category: 'ai' }), svc('ourhome', 'OurHome', { flags: ['stale'] }), svc('evernote', 'Evernote', { category: 'notes' })];
const APPS = [app('immich', 'Immich'), app('nextcloud', 'Nextcloud'), app('obsidian', 'Obsidian'), app('open-webui', 'Open WebUI'), app('kiwix', 'Kiwix', { storySafe: 'avoid' }), app('paperless', 'Paperless-ngx')];
const LIGHT: Record<string, string> = { h1: 'day', h2: 'day', h3: 'day', h4: 'dusk', h5: 'day', h6: 'day', h7: 'day' };
const fam = (slug: string, house: string, surname: string, personas: string[], beats: [string, string, string][], o: Partial<StoryFull['beats'][number]> = {}): { f: FamilyLite; s: StoryFull } => ({
  f: { slug, house, surname, title: `The ${surname} family`, personas },
  s: { slug, house, family: { surname }, members: [], beats: beats.map(([id, service, appId]) => ({ id, service, app: { id: appId, replaces: [] }, popup: { title: `T ${id}`, chips: [appId, `alternative to ${service}`] }, detail: { before: `before ${id}`, after: `after ${id}` }, ...o })) },
});
const CATS = [
  { id: 'code', label: 'Code and tinker', blurb: 'x.', personas: ['builder'] }, { id: 'study', label: 'Study', blurb: 'x.', personas: ['learner'] },
  { id: 'play', label: 'Play', blurb: 'x.', personas: ['gamer'] }, { id: 'household', label: 'Household', blurb: 'x.', personas: ['organiser'] },
];
const PLAN: LanderPlan = {
  version: 1, hero: { slug: 'a', house: 'h1' }, messages: [{ key: 'rent', claim: 'rent-line' }], proof: { candidates: [{ slug: 'a', beat: 'a1' }, { slug: 'a', beat: 'a2' }] },
  hold: ['chatgpt|open-webui'], primary: {}, strip: { size: 10, minFamilies: 2, maxPerApp: 1, maxPerRegistryCategory: 2, maxPerBrand: 2, pin: [] },
  featured: { count: 3, override: null }, types: { apartment: ['h6', 'h7'] },
};

test('the count is words: thirty families in thirty homes, in thirty-six homes, with offices; never a digit', () => {
  assert.equal(countLine(30, 30), 'Thirty homes, each with a fictional family.');
  assert.equal(countLine(30, 36), 'Thirty fictional families in thirty-six homes.');
  assert.equal(countLine(30, 36, 8), 'Thirty fictional families and eight fictional teams in forty-four places.');
  for (const s of [countLine(30, 30), countLine(30, 36), countLine(30, 36, 8)]) assert.ok(!/\d/.test(s) && !/\ball\b/i.test(s), s);
  assert.equal(familiesWord(20), 'Twenty fictional families');
  assert.equal(familiesWord(1), 'One fictional family');
});

test('kinds of place: the plan names the apartments, a house\'s own type wins, a type with no house is not present', () => {
  const t = placeTypes([{ id: 'h1' }, { id: 'h6' }, { id: 'h7' }, { id: 'h2', type: 'apartment' }], PLAN);
  assert.deepEqual(t.of, { h1: 'home', h6: 'apartment', h7: 'apartment', h2: 'apartment' });
  assert.deepEqual(t.counts, { home: 1, apartment: 3 });
  assert.deepEqual(t.present, ['home', 'apartment']);
  assert.deepEqual(placeTypes([{ id: 'h1' }], PLAN).present, ['home'], 'with one type there is nothing to choose between');
});

test('offices: a home of type office needs the fictional-team disclosure; apartments and homes need nothing', () => {
  const none = { disclosures: [{ id: 'fictional-family', text: 'x' }] }, has = { disclosures: [{ id: 'fictional-team', text: 'x' }] };
  const withOffice = placeTypes([{ id: 'h1' }, { id: 'o1', type: 'office' }], PLAN);
  assert.match(officeProblem(withOffice, none), /no fictional-team disclosure/);
  assert.equal(officeProblem(withOffice, has), '');
  assert.equal(officeProblem(placeTypes([{ id: 'h1' }, { id: 'h6' }], PLAN), none), '', 'apartments are homes: no disclosure of their own');
});

test('the gate: an avoid app, a service a story may not name, a home not lit as day each stop a family; a clean one passes', () => {
  const ctx = { services: SERVICES, apps: APPS, lighting: LIGHT };
  assert.deepEqual(gateOf(fam('a', 'h1', 'A', [], [['a1', 'dropbox', 'nextcloud']]).s, ctx), { ok: true, reasons: [] });
  assert.match(gateOf(fam('a', 'h1', 'A', [], [['a1', 'notion', 'kiwix']]).s, ctx).reasons.join(), /Kiwix is an app the catalog marks avoid/);
  assert.match(gateOf(fam('a', 'h1', 'A', [], [['a1', 'ourhome', 'immich']]).s, ctx).reasons.join(), /OurHome is a service the registry will not let a story name/);
  assert.match(gateOf(fam('a', 'h4', 'A', [], [['a1', 'dropbox', 'nextcloud']]).s, ctx).reasons.join(), /lit as dusk, not day/);
  assert.match(gateOf(fam('a', 'h9', 'A', [], [['a1', 'dropbox', 'nextcloud']]).s, ctx).reasons.join(), /unknown, not day/);
  // a held pair does NOT stop a family (the Brennans carry several and lead the page): holds only decide what the page prints
  assert.equal(gateOf(fam('a', 'h1', 'A', [], [['a1', 'chatgpt', 'open-webui']]).s, ctx).ok, true);
});

test('featured: the hero first, one family for each surname, a category not yet covered first, never a family that fails the gate', () => {
  const A = fam('a', 'h1', 'Ames', ['organiser'], [['a1', 'chatgpt', 'open-webui'], ['a2', 'dropbox', 'nextcloud']]);
  const A2 = fam('a-two', 'h2', 'Ames', ['organiser'], [['x1', 'dropbox', 'nextcloud']]);                  // the hero's surname: not twice
  const B = fam('b', 'h3', 'Bell', ['builder'], [['b1', 'notion', 'obsidian'], ['b2', 'google-photos', 'immich']]);
  const C = fam('c', 'h4', 'Cole', ['learner'], [['c1', 'dropbox', 'nextcloud']]);                          // dusk: fails the gate
  const D = fam('d', 'h5', 'Dunn', ['gamer'], [['d1', 'ourhome', 'immich']]);                               // a dead service: fails
  const E = fam('e', 'h6', 'Eyre', ['learner'], [['e1', 'google-photos', 'immich']]);
  const G = fam('g', 'h7', 'Gray', ['organiser'], [['g1', 'google-photos', 'immich'], ['g2', 'notion', 'obsidian']]);
  const all = [A, A2, B, C, D, E, G];
  const stories = all.map((x) => x.s), families = all.map((x) => x.f);
  const index = buildPairIndex({ stories, services: SERVICES, apps: APPS, plan: PLAN });
  const run = (plan: LanderPlan) => featuredOf({ families, stories, index, plan, categories: CATS, services: SERVICES, apps: APPS, lighting: LIGHT });
  const r = run({ ...PLAN, featured: { count: 4, override: null } });
  assert.equal(r.slugs[0], 'a', 'the hero leads');
  assert.ok(!r.slugs.includes('a-two'), 'one family for each surname');
  assert.ok(!r.slugs.includes('c') && !r.slugs.includes('d'), 'a dusk home and a dead service never take a slot');
  assert.deepEqual(r.slugs, ['a', 'b', 'e', 'g'].slice(0, r.slugs.length), 'the uncovered category (code) before the rest');
  assert.deepEqual(Object.keys(r.rejected).sort(), ['c', 'd']);
  assert.ok(r.covered.includes('code') && r.covered.includes('household'));
  // fewer than `count` pass: show as many as pass and say so
  const few = run({ ...PLAN, featured: { count: 6, override: null } });
  assert.ok(few.slugs.length < 6 && few.notes.some((n) => /only \d+ of 6/.test(n)), few.notes.join());
  // the hero fails the gate: it is not featured, and the build is told
  const noHero = run({ ...PLAN, hero: { slug: 'c', house: 'h4' }, featured: { count: 2, override: null } });
  assert.ok(!noHero.slugs.includes('c') && noHero.notes.some((n) => /hero family c fails the gate/.test(n)));
  // override: held to the same gate
  const ov = run({ ...PLAN, featured: { count: 3, override: ['g', 'c', 'nobody', 'b'] } });
  assert.deepEqual(ov.slugs, ['g', 'b']);
  assert.equal(ov.notes.length, 2);
});

test('the proof: the first candidate that is a pair the page may show; a held pair is skipped; none leaves the block out, with a reason', () => {
  const A = fam('a', 'h1', 'Ames', ['organiser'], [['a1', 'chatgpt', 'open-webui'], ['a2', 'dropbox', 'nextcloud'], ['a3', 'notion', 'obsidian']]);
  const index = buildPairIndex({ stories: [A.s], services: SERVICES, apps: APPS, plan: PLAN });
  const first = proofOf(PLAN, [A.s], index);
  assert.equal(first.proof?.beat, 'a2', 'a1 is the held ChatGPT pair');
  assert.equal(first.proof?.title, 'T a2');
  assert.deepEqual(first.proof?.chips, ['nextcloud', 'alternative to dropbox']);
  assert.equal(first.proof?.before, 'before a2');
  assert.match(first.skipped.join(), /a\/a1: the pair chatgpt\|open-webui may not show \(held\)/);
  // hold emptied: the first candidate is used
  const released = proofOf(PLAN, [A.s], buildPairIndex({ stories: [A.s], services: SERVICES, apps: APPS, plan: { ...PLAN, hold: [] } }));
  assert.equal(released.proof?.beat, 'a1');
  // the family is not current / the beat is gone / every candidate held
  assert.match(proofOf({ proof: { candidates: [{ slug: 'gone', beat: 'x' }] } }, [A.s], index).skipped.join(), /no such family or beat/);
  const none = proofOf({ proof: { candidates: [{ slug: 'a', beat: 'a1' }] } }, [A.s], index);
  assert.equal(none.proof, null);
  assert.equal(none.skipped.length, 1);
  // a beat with no words to show is skipped
  const bare = fam('b', 'h2', 'Bell', [], [['b1', 'dropbox', 'nextcloud']]);
  bare.s.beats[0].detail = undefined;
  assert.match(proofOf({ proof: { candidates: [{ slug: 'b', beat: 'b1' }] } }, [bare.s], buildPairIndex({ stories: [bare.s], services: SERVICES, apps: APPS, plan: PLAN })).skipped.join(), /no title, chips, before or after/);
});

// ------------------------------------------------------------------------------------------------------------------------ the real tree

const files = readInputs(ROOT);
const dir = path.join(ROOT, 'content', 'families');
const stories: StoryFull[] = fs.readdirSync(dir).filter((f) => /^[a-z]+(-[a-z]+)*\.json$/.test(f) && f !== 'films.json').sort().map((f) => J('content', 'families', f));
const casting: Record<string, any> = Object.fromEntries(J('content', 'story', 'casting.json').families.map((f: any) => [f.slug, f]));
const families: FamilyLite[] = stories.map((s) => ({ slug: s.slug, house: s.house, surname: s.family.surname, title: `The ${s.family.surname} family`,
  personas: [...new Set(s.members.map((m) => m.archetype || casting[s.slug]?.members?.find((c: any) => c.id === m.id)?.archetype).filter(Boolean) as string[])] }));
const houses: { id: string }[] = J('content', 'houses', 'index.json').houses;

test('on the tree: the plan is valid and nothing in it is on hold', () => {
  const plan = J('content', 'story', 'lander.json');
  const check = validatePlan(plan, { schema: files.schema, stories, services: files.services, apps: files.apps, claims: files.claims, houses });
  assert.deepEqual(check.errors, []);
  assert.deepEqual(check.warnings, [], 'the headline\'s claim is approved');
  // a claim the plan names that is on hold still warns (and a strict build fails on the warning)
  const held = { ...files.claims, allowedClaims: files.claims.allowedClaims.map((c) => (c.id === 'rent-line' ? { ...c, status: 'hold' } : c)) };
  const warn = validatePlan(plan, { schema: files.schema, stories, services: files.services, apps: files.apps, claims: held, houses });
  assert.deepEqual(warn.errors, []);
  assert.match(warn.warnings.join('\n'), /messages\.rent: the claim rent-line is on hold in claims\.json/);
});

test('validatePlan has teeth: each mistake in the plan is found', () => {
  const ctx = { schema: files.schema, stories, services: files.services, apps: files.apps, claims: files.claims, houses };
  const base = J('content', 'story', 'lander.json');
  const bad = (edit: (p: any) => void): string => { const p = JSON.parse(JSON.stringify(base)); edit(p); const c = validatePlan(p, ctx); return [...c.errors, ...c.warnings].join('\n'); };
  assert.match(bad((p) => { p.hold.push('nosuch|open-webui'); }), /hold: nosuch\|open-webui: no service nosuch/);
  assert.match(bad((p) => { p.hold.push('chatgpt|nosuch'); }), /no app nosuch/);
  assert.match(bad((p) => { p.hold.push(p.hold[0]); }), /listed twice/);
  assert.match(bad((p) => { p.primary['nosuch'] = 'nextcloud'; }), /primary: no service nosuch/);
  assert.match(bad((p) => { p.strip.pin = ['nosuch']; }), /strip.pin: no service nosuch/);
  assert.match(bad((p) => { p.types.apartment.push('nosuch-home'); }), /types.apartment: no home nosuch-home/);
  assert.match(bad((p) => { p.types.office = ['studio-loft']; }), /studio-loft is listed twice/);
  assert.match(bad((p) => { p.types.mansion = []; }), /mansion is not a kind of place/);
  assert.match(bad((p) => { p.hero.house = 'aurora'; }), /hero: brennan lives in seraphine, not aurora/);
  assert.match(bad((p) => { p.messages[0].claim = 'nosuch-claim'; }), /claims.json has no allowedClaims entry nosuch-claim/);
  assert.match(bad((p) => { p.proof.candidates[0].beat = 'nosuch-beat'; }), /brennan has no beat nosuch-beat/);
  assert.match(bad((p) => { p.version = 2; }), /must equal 1/);
  assert.match(bad((p) => { p.strip.size = 99; }), /above 12/);
  assert.match(bad((p) => { p.featured.override = 'brennan'; }), /null or an array/);
});

test('on the tree: what the page shows holds every rule of the spec', () => {
  const d = computeLander({ root: ROOT, stories, families, houses, files });
  assert.ok(d.featured.slugs.length >= 1 && d.featured.slugs.length <= d.plan.featured.count);
  assert.equal(d.featured.slugs[0], d.plan.hero.slug, 'the hero leads');
  const surnames = d.featured.slugs.map((s) => families.find((f) => f.slug === s)!.surname);
  assert.equal(new Set(surnames).size, surnames.length, 'one family for each surname');
  for (const slug of d.featured.slugs) assert.deepEqual(gateOf(stories.find((s) => s.slug === slug)!, files).reasons, [], `${slug} passes the gate`);
  assert.ok(d.featured.covered.length >= Math.min(4, d.featured.slugs.length), `categories covered: ${d.featured.covered.join(', ')}`);
  for (const p of d.index.shown) assert.ok(!d.plan.hold.includes(`${p.service.id}|${p.app.id}`));
  assert.ok(d.proof && !d.plan.hold.includes(`${d.proof.service.id}|${d.proof.app.id}`), 'the proof is a pair that may show');
  assert.ok(d.strip.length >= 6 && d.strip.length <= 10);
  assert.ok(!/\d/.test(d.count), d.count);
  assert.match(d.count, /^[A-Z][a-z-]+ homes, each with a fictional family\.$|^[A-Z][a-z-]+ fictional families in [a-z-]+ homes\.$/);
  assert.deepEqual(d.types.present, d.types.counts.apartment ? ['home', 'apartment'] : ['home']);
  assert.ok(d.messages.rent && d.messages.rent.text === 'Stop renting your intelligence.', 'the H1 is the claim\'s text');
  assert.ok(d.log.length >= 5);
  // the pair line of every chip passes claims.json's error rules (a word a claim stops can never reach a chip)
  const bans = bansOf(files.claims);
  for (const c of d.strip) assert.ok(!bans.some((re) => re.test(`${c.app.name}, alternative to ${c.service.name}`)), c.service.name);
});
