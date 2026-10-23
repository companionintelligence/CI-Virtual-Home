#!/usr/bin/env -S node --experimental-strip-types
// The fine print each surface owes (assets/story/fine-print.ts is the rule table, scripts/story/lib/fine-print.mts reads claims.json for it): a page or a panel that leaves one
// out fails here, and so does a rule table that drops a disclosure claims.json requires, a snapshot of claims.json that went stale (the player cannot read the file),
// a sentence the banned-phrase rules stop (the Core band's "your own AI, apps and memory" was on 30 home pages and in the player: rule cap-own-apps), and a surface the
// lander's package must print (its rows are in the table; the lander itself is not checked here). Pure Node: no browser, no network.
// Needs `pnpm run build` (the page writers import assets/home-names.js).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll, cardOf, storyFiles, readJson } from './story/site-lib.mts';
import * as pg from './story/pages.mts';
import { homePage, notFoundPage } from './portal-pages.mts';
import {
  CLAIMS_SNAPSHOT, SURFACES, SURFACE_IDS, coreLine, disclosureText, finePrint, finePrintItems, loadClaims, missingFinePrint, owed, readableText, snapshotProblem,
} from './story/lib/fine-print.mts';
import type { Facts, Surface } from './story/lib/fine-print.mts';
import { FINE_PRINT } from '../assets/story/popup.ts';

const SITE = 'https://homes.ci.computer/';
const claims = loadClaims();
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'site', 'families');
const L = loadAll(ROOT, FIXTURES);
const houses: { id: string; name?: string; style?: string; storeys?: number; areaSqm?: number }[] = readJson(path.join(ROOT, 'content', 'houses', 'index.json')).houses;
const all: Facts = { narration: true, agents: true, logos: true, tour: true };
const none: Facts = {};
const errorRules = (): { id: string; re: RegExp }[] => (claims as any).bannedPhrases.filter((b: any) => b.severity === 'error').map((b: any) => ({ id: b.id, re: new RegExp(b.pattern, b.flags ?? 'i') }));
const broken = (text: string): string[] => errorRules().filter(r => r.re.test(text)).map(r => r.id);

test('the player\'s snapshot of claims.json is current (node --experimental-strip-types scripts/story/lib/fine-print.mts --write)', () => {
  assert.equal(snapshotProblem(), '');
  for (const d of (claims as any).disclosures) assert.equal(CLAIMS_SNAPSHOT.disclosures.find(x => x.id === d.id)?.text, d.text, `${d.id} in the snapshot`);
});

test('every surface names disclosures claims.json has, and the table carries every disclosure claims.json requires', () => {
  const ids = new Set<string>((claims as any).disclosures.map((d: any) => d.id));
  for (const s of SURFACE_IDS) for (const id of owed(s, all)) assert.ok(ids.has(id), `${s}: claims.json has no disclosure ${id}`);
  const carried = new Set(SURFACE_IDS.flatMap(s => owed(s, all)));
  // (third-party-apps is the credits page's, and the family page prints it in its apps section: scripts/story/pages.mts, held below; internet-steps is the first-run note)
  const inline = new Set(['third-party-apps']);
  for (const d of (claims as any).disclosures.filter((x: any) => x.required)) assert.ok(carried.has(d.id) || inline.has(d.id), `the required disclosure ${d.id} is on no surface of the table`);
});

test('a surface\'s rows follow the `where` of claims.json', () => {
  const where = (id: string): string => ((claims as any).disclosures.find((d: any) => d.id === id).where || []).join(' | ').toLowerCase();
  const fits: Record<string, RegExp> = {
    'family-fold': /header|landing hero/, 'family-start': /ftue|hermes or openclaw/,
    'family-footer': /footer|about|credits|faq|audio|film end card/, 'home-footer': /footer|about/, 'not-found': /footer/,
    'player-about': /about|footer|player chrome|film end card|credits/, 'tour-start': /footer|audio|film end card/,
    'lander-hero': /landing hero|header/, 'lander-core': /about|landing page/, 'lander-footer': /footer|about/,
  };
  for (const s of SURFACE_IDS) {
    assert.ok(fits[s], `a row for ${s} in this test`);
    for (const id of owed(s, all)) assert.ok(fits[s].test(where(id)), `${s}: ${id} is not placed there by claims.json: ${where(id)}`);
  }
});

test('missingFinePrint names what a page leaves out', () => {
  for (const s of SURFACE_IDS) {
    const { html, items } = finePrint(s, all);
    assert.deepEqual(missingFinePrint(html, s, all), [], `${s}: the helper's own html carries all of it`);
    for (const i of items) assert.deepEqual(missingFinePrint(html.replace(i.text, ''), s, all), [i.id], `${s}: dropping ${i.id} is found`);
    assert.deepEqual(missingFinePrint('<p>nothing</p>', s, all), items.map(i => i.id));
  }
});

test('the facts decide: a voice, a named agent, a logo, the tour', () => {
  assert.ok(!owed('family-footer', none).includes('synthetic-voice') && owed('family-footer', { narration: true }).includes('synthetic-voice'));
  assert.ok(!owed('family-footer', none).includes('attribution-agents') && owed('family-footer', { agents: true }).includes('attribution-agents'));
  assert.ok(!owed('family-footer', none).includes('not-frontier') && owed('family-footer', { agents: true }).includes('not-frontier'));
  assert.ok(!owed('family-footer', none).includes('names-logos-owners') && owed('family-footer', { logos: true }).includes('names-logos-owners'));
  assert.deepEqual(owed('family-start', none), []);
  assert.deepEqual(owed('family-start', { agents: true }), ['internet-steps']);
  assert.ok(!owed('player-about', none).includes('fictional-family') && owed('player-about', { tour: true }).includes('fictional-family'));
  assert.throws(() => finePrintItems('home-footer', none, { disclosures: [] }), /no disclosure launch-not-offer/, 'a renamed id breaks the build, it does not print nothing');
});

test('the tour\'s start card prints the disclosures claims.json gives it, word for word (assets/story/popup.ts FINE_PRINT)', () => {
  const want = finePrintItems('tour-start', { narration: true }).map(i => i.text);
  assert.deepEqual([...FINE_PRINT], want);
});

test('the Core sentence is claims.json\'s own words and no rule of the voice stops it', () => {
  for (const desk of ['your desk', 'the desk'] as const) {
    const t = coreLine(desk);
    assert.ok(t.endsWith((claims as any).allowedClaims.find((a: any) => a.id === 'local-by-default').text), 'the second sentence is local-by-default, verbatim');
    assert.deepEqual(broken(t), [], t);
    assert.ok(!/\bown(s|ed)?\b/i.test(t), 'nobody owns the apps (cap-own-apps)');
  }
  assert.equal(coreLine('the desk', CLAIMS_SNAPSHOT), coreLine('the desk'), 'the player says what the pages say');
});

test('every disclosure a surface prints passes the banned-phrase rules except where claims.json itself is the source (listed, so a new one is seen)', () => {
  const known = new Map<string, string[]>();   // id -> rules claims.json's own text trips; empty today
  for (const s of SURFACE_IDS) for (const i of finePrintItems(s, all)) assert.deepEqual(broken(i.text), known.get(i.id) || [], `${i.id}: ${i.text}`);
});

// ---------------------------------------------------------------------------------------------------------- the pages
test('every home\'s own page carries the footer\'s fine print, and no banned sentence', () => {
  const some = [houses[0], houses[houses.length >> 1], houses[houses.length - 1]];
  for (const h of some) {
    const page = homePage(h, SITE), words = readableText(page);
    for (const s of ['home-footer'] as Surface[]) assert.deepEqual(missingFinePrint(page, s), [], `${h.id}: ${s}`);
    assert.ok(page.includes('data-fine="launch-not-offer"'));
    assert.ok(words.includes(coreLine('your desk')), 'the Core band says it with claims.json\'s words');
    assert.ok(!/your own AI, apps and memory|\bown(s|ed)?\b[^.]{0,20}\b(apps?|software|agents?)\b/i.test(words), 'no "your own AI, apps and memory" (cap-own-apps)');
    assert.deepEqual(broken(words.replace(/©[^.]*\./, '')), [], `${h.id}: the page's words`);
    assert.ok(!/change the hour|one spec file/i.test(words), 'plain words, not the builder\'s');
  }
});

test('the 404 page carries launch-not-offer where it offers Buy Companion Core', () => {
  const page = notFoundPage(SITE, 'thirty');
  assert.ok(page.includes('Buy Companion Core'));
  assert.deepEqual(missingFinePrint(page, 'not-found'), []);
});

const pageOf = (slug: string, ctx: Partial<Parameters<typeof pg.familyPage>[0]> = {}, strip: (s: any) => any = x => x): string => {
  const s = strip(L.stories.find(x => x.slug === slug) || L.stories[0]);
  const card = cardOf(s, { catalog: L.catalog, order: [s.slug], thumb: `portal/thumbs/${s.house}.webp`, og: '' });
  return pg.familyPage({ s, card, prev: card, next: card, site: SITE, claims: L.claims, catalog: L.catalog, house: houses.find(h => h.id === s.house)!, poster: `portal/previews/${s.house}.jpg`, og: `${SITE}portal/previews/${s.house}.jpg`, ...ctx });
};
const withoutAgents = (s: any): any => ({ ...s, members: s.members.map((m: any) => { const { companion, ...rest } = m; return rest; }) });

for (const s of L.stories) {
  test(`${s.slug}: the family page carries every disclosure its facts owe, in the fold and in the footer`, () => {
    const agents = s.members.some(m => m.companion);
    for (const narration of [false, true]) {
      const page = pageOf(s.slug, { narration });
      const facts: Facts = { agents, narration, logos: false };
      for (const surface of ['family-fold', 'family-footer', 'family-start'] as Surface[]) assert.deepEqual(missingFinePrint(page, surface, facts, L.claims), [], `${s.slug} (narration ${narration}): ${surface}`);
      // the fold holds the label once as the header's chip; the rest is the footer's, as claims.json places it
      assert.equal((page.match(/data-fine="fictional-family"/g) || []).length, 1, 'the label is printed once in the fold');
      const foot = (page.match(/<footer[\s\S]*<\/footer>/) || [''])[0];
      assert.ok(!page.includes('class="strip"'), 'the fold has no strip: the label is its one line of fine print');
      for (const id of ['launch-not-offer', 'scripted-scenes', 'stylised-art', 'apps-availability', 'names-owners']) assert.ok(foot.includes(`data-fine="${id}"`), `${id} is in the footer`);
      assert.equal(foot.includes('data-fine="synthetic-voice"'), narration, 'the voice line only when there is a voice');
      assert.equal(foot.includes('data-fine="attribution-agents"') && foot.includes('data-fine="not-frontier"'), agents, 'the agents\' attribution and what a Core is not, when an agent is named');
      assert.equal(page.includes('data-fine="internet-steps"'), agents, 'the internet note next to the first run, when an agent is named');
      assert.ok(readableText(page).includes(disclosureText('third-party-apps', L.claims)), 'the apps section says the other apps are other people\'s');
    }
    if (agents) {
      const bare = pageOf(s.slug, {}, withoutAgents);
      assert.ok(!bare.includes('data-fine="attribution-agents"') && !bare.includes('data-fine="not-frontier"') && !bare.includes('data-fine="internet-steps"'), 'a page that names no agent does not attribute one');
    }
  });
}

test('a page with real logos and screenshots adds names-logos-owners to the footer', () => {
  const media = { apps: {}, ci: { hub: [], portal: [] } } as any;
  const s = L.stories[0];
  assert.ok(!pageOf(s.slug).includes('data-fine="names-logos-owners"'));
  assert.ok(pageOf(s.slug, { media }).includes('data-fine="names-logos-owners"'));
});

// ---------------------------------------------------------------------------------------------------------- the player
test('the player\'s About panel prints the fine print from the table, and its Core sentence is claims.json\'s', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'viewer.ts'), 'utf8');
  assert.ok(!/your own AI, apps and memory/i.test(src), 'cap-own-apps: no "your own AI, apps and memory" in the player');
  assert.ok(/finePrintItems\(CLAIMS_SNAPSHOT, 'player-about', \{ tour: storyP !== null \}\)/.test(src), 'the About panel prints the player-about row (the tour adds its own)');
  assert.ok(!/player-end/.test(src), 'the end card prints no fine print row of its own');
  assert.equal((src.match(/coreLine\(CLAIMS_SNAPSHOT, 'the desk'\)/g) || []).length, 2, 'the end card and the About panel both say it with claims.json\'s words');
  assert.ok(/class="vh-fiction"[^>]*data-fine="fictional-family"/.test(src) && /html\[data-story\] \.vh\[data-state="ready"\] \.vh-fiction \{ display: block; \}/.test(src), 'the label is a chip of the player while a family tour is up');
});

test('what the lander must print is a row of the table (its package reads it from here)', () => {
  assert.deepEqual(owed('lander-hero'), ['fictional-family']);
  assert.deepEqual(owed('lander-core'), ['not-frontier', 'stylised-art'], 'the band, and the line beside the Core picture');
  assert.deepEqual(owed('lander-footer'), ['launch-not-offer', 'scripted-scenes', 'names-logos-owners', 'third-party-apps'], 'the page quotes a written scene and names apps');
  for (const s of ['lander-hero', 'lander-core', 'lander-footer'] as Surface[]) assert.ok(s in SURFACES);
});

test('the families\' own files still exist for the page tests', () => {
  assert.ok(storyFiles(FIXTURES).length >= 1);
});
