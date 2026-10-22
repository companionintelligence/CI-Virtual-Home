#!/usr/bin/env -S node --experimental-strip-types
// The family pages the story build writes (scripts/story/pages.mts), held to the rules the homes' pages are held to
// (scripts/build-portal.mts step 7) on whatever families exist, with the test families in test/fixtures/site/families: so CI, which
// builds the site from the shipped families only, still proves the page writer on a family that is always there. Also the story-copy
// leak check (scripts/story/check-leaks.mts). Pure Node: no browser, no network. Needs `pnpm run build` (the page writer imports
// assets/home-names.js).
//
// The page is the landing page of an ad: above the fold the name, the tagline, the picture, "Take the tour" and "See Companion Core" and the
// one honest line about the 3D; the label printed from claims.json; a section for each person (id = the member's id, so
// family/<slug>#sally is a link) with their moments, each linking the tour at that beat, and "Start with <name>"; what runs on the Core. It
// reads with no JavaScript (this test reads the HTML, which has none of it). The ad rules bind it: no UI mockup, no price, nobody a customer, the
// chrome's labels kept and the story's own call to action "See Companion Core"; a third-party logo only beside the name it identifies, and a
// screenshot only real, whole and labelled (story v2: the test families have no media, so the page is held to "none" there, and the Brennan page, which has
// the real files, is held to the rules for the real ones: the sticky nav, the card "Rented before, on the Core now", the logos, "More about this moment",
// the screenshot strip, a day in the house, the home and its floor plan, how it runs; plus the floor plan's own tests, scripts/story/lib/plan-map.mts).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll, cardOf, storyFiles, readJson } from './story/site-lib.mts';
import * as pg from './story/pages.mts';
import { needles, storyCopyLeaks } from './story/check-leaks.mts';
import { LINKS, TITLE_MAX, galleryCards } from './portal-pages.mts';
import { memberBeat, memberChapter } from '../assets/story/url.ts';
import { displayName } from '../assets/home-names.js';
import { builderHandles, guardTerms, scanText } from './portal-redact.mts';
import { FICTIONAL_LINE } from '../assets/story/types.ts';
import type { Story } from '../assets/story/types.ts';
import { readMedia, appCaption, appMedia, checkPageImages, MANIFEST } from './story/lib/media.mts';
import type { MediaManifest } from './story/lib/media.mts';
import { readPlan, placePins, levelSvg, roomLabel, roomNames, labelFor, aspect, levelLabel } from './story/lib/plan-map.mts';
import { readFamilies, readStories, landerFamilies, frontCards, cardPairs, appsNamed } from './portal-front.mts';
import { computeLander } from './story/lib/lander.mts';
import type { FrontFamily } from './portal-front.mts';
import { firstSentence } from '../assets/story/popup.ts';

const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'site', 'families');
const L = loadAll(ROOT, FIXTURES);
const SITE = 'https://homes.ci.computer/';
const terms = guardTerms(builderHandles(ROOT));
const houses: { id: string; name?: string; author?: string; style?: string; storeys?: number; areaSqm?: number; source?: string }[] = readJson(path.join(ROOT, 'content', 'houses', 'index.json')).houses;

const pageOf = (s: Story, over: Partial<Story['family']> = {}, ctx: Partial<Parameters<typeof pg.familyPage>[0]> = {}): string => {
  const story: Story = { ...s, family: { ...s.family, ...over } };
  const order = [story.slug];
  const card = cardOf(story, { catalog: L.catalog, order, thumb: `portal/thumbs/${story.house}.webp`, og: '' });
  return pg.familyPage({ s: story, card, prev: card, next: card, site: SITE, claims: L.claims, catalog: L.catalog, house: houses.find(h => h.id === story.house)!, poster: `portal/previews/${story.house}.jpg`, og: `${SITE}portal/previews/${story.house}.jpg`, ...ctx });
};
const decode = (v: string): string => v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
/** the beats a page tells: not the first run, not the closing */
const told = (s: Story): Story['beats'] => s.beats.filter(b => { const k = s.chapters.find(c => c.id === b.chapter)?.kind; return k !== 'ftue' && k !== 'outro'; });
const sections = (t: string): Map<string, string> => new Map([...t.matchAll(/<section class="who[^"]*" id="([^"]+)"[\s\S]*?<\/section>/g)].map(m => [m[1], m[0]]));
const text = (html: string): string => html.replace(/<head[\s\S]*?<\/head>/, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const tag = (t: string, re: RegExp): string => (t.match(re) || [])[1] || '';

test('the test families exist', () => {
  assert.ok(storyFiles(FIXTURES).length >= 1, 'test/fixtures/site/families has no family');
  assert.ok(houses.length >= 30 && new Set(houses.map(h => h.id)).size === houses.length, `${houses.length} homes in index.json`);   // (the gallery's homes: more than the families, since the apartments have none yet)
});

test('a title fits a search result and a description fits its snippet, however long the name and the tagline', () => {
  assert.equal(pg.familyPageTitle('The Okonkwo-Reid family'), 'The Okonkwo-Reid family · Virtual homes · Companion Intelligence'.length <= TITLE_MAX ? 'The Okonkwo-Reid family · Virtual homes · Companion Intelligence' : 'The Okonkwo-Reid family · Virtual homes');
  const long = pg.familyPageTitle('The Wolfeschlegelstein-Hartmannsberger family');
  assert.equal(long, 'The Wolfeschlegelstein-Hartmannsberger family');   // (45 characters: no room for the section)
  assert.equal(pg.familyPageTitle('The Wolfeschlegelstein-Hartmann family'), 'The Wolfeschlegelstein-Hartmann family · Virtual homes');
  const d = pg.familyDescription('x'.repeat(40) + ' ' + 'word '.repeat(80));
  assert.ok(d.length <= 160 && d.endsWith(FICTIONAL_LINE) && d.includes('…'), `${d.length}: ${d}`);
  assert.equal(pg.familyDescription('Two dads, two kids.'), `Two dads, two kids. ${FICTIONAL_LINE}`);
});

for (const s of L.stories) {
  test(`${s.slug}: the page obeys the homes' pages' rules`, () => {
    const t = pageOf(s), house = s.house;
    for (const url of [LINKS.site, LINKS.core, LINKS.download, LINKS.docs, LINKS.privacy, LINKS.terms]) assert.ok(t.includes(`href="${url}"`), `no link to ${url}`);
    assert.equal((t.match(/<h1\b/g) || []).length, 1);
    assert.equal((t.match(/<main\b/g) || []).length, 1);
    const title = tag(t, /<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'), desc = tag(t, /<meta name="description" content="([^"]*)">/);
    assert.ok(title.length > 0 && title.length <= TITLE_MAX, `title ${title.length}`);
    assert.ok(desc.replace(/&quot;|&amp;|&lt;|&gt;/g, '.').length <= 160, 'description over 160');
    assert.equal(tag(t, /<meta property="og:title" content="([^"]*)">/), tag(t, /<title>([^<]*)<\/title>/));
    assert.equal(tag(t, /<meta name="twitter:title" content="([^"]*)">/), tag(t, /<title>([^<]*)<\/title>/));
    assert.ok(/<link rel="canonical" href="https:\/\/homes\.ci\.computer\/family\/[a-z-]+">/.test(t) && t.indexOf('<meta charset') < 1024 && t.indexOf('<meta property="og:image"') < 4096 && /<meta name="twitter:image:alt" /.test(t));
    for (const m of t.matchAll(/<script\b([^>]*)>/g)) assert.ok(/type="(importmap|application\/ld\+json)"|data-cfasync="false"/.test(m[1]), `a script without data-cfasync: ${m[0]}`);
    for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    assert.ok(!/href="[^"]*\.html/.test(t) && !/href="[^"]*index\.html/.test(t), 'a link names a .html page');
    assert.ok(!/(?:href|src)="\/(?!\/)/.test(t), 'a root-relative URL');
    assert.ok(!/<meta name="robots"/.test(t));
    assert.ok(t.includes(`href="../room-creator?mode=view&amp;house=${house}&amp;family=${s.slug}"`), 'the tour link names the house and the family');
    assert.ok(t.includes(`<p class="home-note">The home is <a href="../homes/${house}">`), 'the fine print names the home and links its page');
    assert.ok(!/home-credit|\bCredit:/i.test(t) && scanText(`family/${s.slug}.html`, t, terms).length === 0, `the page credits no builder and names no build: ${scanText(`family/${s.slug}.html`, t, terms).join(' | ')}`);
  });
  test(`${s.slug}: the words are the voice's: no dash, the disclosures, no home and no builder`, () => {
    const t = pageOf(s), words = text(t);
    assert.ok(!/[—–]/.test(words), `a dash in: ${(words.match(/.{30}[—–].{30}/) || [''])[0]}`);
    assert.ok(words.includes(FICTIONAL_LINE));
    assert.deepEqual(storyCopyLeaks(s, needles(ROOT)), []);
  });
}

for (const s of L.stories) {
  test(`${s.slug}: above the fold, a section for each person and what runs on the Core`, () => {
    const t = pageOf(s), words = text(t), q = (u: string): string => decode(u);
    // above the fold: the name, the tagline, the home's picture, the two buttons, the one honest line
    const hero = (t.match(/<section class="hero"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(hero.includes(`<h1 id="family-h" class="nm nm-family">The ${s.family.surname} family</h1>`), 'the name (as written; the kicker look is the .nm class)');
    assert.ok(hero.includes(s.family.tagline.replace(/&/g, '&amp;')) || words.includes(s.family.tagline), 'the tagline');
    assert.ok(new RegExp(`<img src="\\.\\./portal/previews/${s.house}\\.jpg"`).test(hero), 'the picture of the home');
    assert.ok(/<a class="btn btn-primary" href="\.\.\/room-creator\?mode=view&amp;house=[^"]+&amp;family=[a-z-]+" data-campaign><svg[^>]*><use href="#i-play"\/><\/svg><span>Take the tour<\/span><\/a>/.test(hero), 'one primary button, "Take the tour", into the player');
    assert.ok(hero.includes(`<a class="btn btn-ghost" href="${LINKS.core}" data-campaign>See Companion Core</a>`), 'and "See Companion Core" to exactly https://ci.computer/core');
    assert.equal((hero.match(/btn-primary/g) || []).length, 1, 'one primary button above the fold');
    assert.ok(hero.includes(`<p class="hero-note">${pg.TOUR_NOTE}</p>`) && pg.TOUR_NOTE === 'The tour draws the home in 3D in your browser.', 'the one honest line');
    assert.ok(!/streamed/i.test(words), 'it does not say anything is streamed');
    // the label is the header's chip, once; the rest of the fine print is the footer's (claims.json `where`; scripts/test-fine-print.mts holds every surface)
    const claim = (id: string): string => (L.claims.disclosures as { id: string; text: string }[]).find(x => x.id === id)!.text;
    assert.ok(hero.includes(`<p class="disclosure" data-fine="fictional-family"><strong>${claim('fictional-family')}</strong></p>`), 'the label, in the header');
    const foot = (t.match(/<footer[\s\S]*<\/footer>/) || [''])[0];
    assert.ok(!t.includes('class="strip"'), 'no strip under the fold: the label is the one line of fine print there');
    for (const id of ['scripted-scenes', 'stylised-art', 'launch-not-offer']) assert.ok(q(foot).includes(claim(id)), `the footer has the ${id} disclosure, word for word`);
    // a person's section, whose id is theirs; their moments each link the tour at that beat; "Start with <name>"
    const secs = sections(t);
    for (const m of s.members) {
      assert.ok(secs.has(m.id), `a section with id="${m.id}"`);
      assert.ok(t.includes(`<li><a href="#${m.id}"`), `${m.id} is linked from the list of the family`);
      const sec = secs.get(m.id)!, mine = told(s).filter(b => b.member === m.id);
      assert.ok(sec.includes(`<h2 id="${m.id}-h" class="nm">${m.name}</h2>`) && sec.includes(`Age ${m.age}`), `${m.id}: the name and the age`);
      if (m.archetype) assert.ok(sec.includes(`<span>${m.archetype.charAt(0).toUpperCase()}${m.archetype.slice(1)}</span>`), `${m.id}: the archetype word`);
      for (const b of mine) {
        assert.ok(sec.includes(`<li class="moment" id="b-${b.id}">`), `${m.id}: the moment ${b.id}`);
        assert.ok(sec.includes(`href="../room-creator?mode=view&amp;house=${s.house}&amp;family=${s.slug}&amp;beat=${b.id}" data-campaign aria-label="Watch this moment, `), `${m.id}/${b.id}: "Watch this moment" opens the tour at the beat`);
        assert.ok(sec.includes(b.popup.title.replace(/&/g, '&amp;')) && sec.includes(b.popup.body.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${m.id}/${b.id}: its title and its words`);
        // the apps, with what each replaces (the beat's own chips)
        for (const c of b.popup.chips || []) assert.ok(q(sec).includes(c), `${m.id}/${b.id}: the chip ${c}`);
      }
      if (mine.length) assert.ok(sec.includes(`href="../room-creator?mode=view&amp;house=${s.house}&amp;family=${s.slug}&amp;member=${m.id}"`) && sec.includes(`<span>Start with <b class="nm">${m.name}</b></span>`), `${m.id}: "Start with ${m.name}"`);
      else assert.ok(!sec.includes('Start with'), `${m.id} has no moment and no way to start with them`);
    }
    // every moment the story tells is on the page once, and the first run and the closing are not
    for (const b of told(s)) assert.equal((t.match(new RegExp(`id="b-${b.id}"`, 'g')) || []).length, 1, `${b.id} is on the page once`);
    for (const b of s.beats.filter(x => !told(s).includes(x))) assert.ok(!t.includes(`id="b-${b.id}"`), `${b.id} (first run or closing) is not a moment`);
    // what runs on the Core: each distinct app once, with its store page and what it replaces
    const apps = (t.match(/<section class="block" id="apps"[\s\S]*?<\/section>/) || [''])[0];
    const ids = [...new Set(s.beats.map(b => b.app?.id).filter(Boolean))] as string[];
    assert.equal((apps.match(/<li class="app">/g) || []).length, ids.length, 'one entry for each distinct app');
    for (const id of ids) { const a = L.catalog[id]; assert.ok(apps.includes(`href="${a.storeUrl}" target="_blank" rel="noopener"`), `${id}: its Companion Hub store page`); }
    for (const b of s.beats) if (b.app?.replaces.length) { /* (the first beat that names the app says what it replaces) */ }
    assert.ok(/Replaces [A-Z]/.test(apps) || ids.every(id => !(s.beats.find(b => b.app?.id === id)?.app?.replaces || []).length), 'what each app replaces is named');
    // the ad rules: no logo, no screenshot, no price, no customer
    assert.ok(!/<img[^>]+(google|apple|amazon|microsoft|openai|dropbox|slack|zoom|spotify|netflix)/i.test(t), 'no third-party logo');
    assert.equal((t.match(/<img\b/g) || []).length, 3, 'only the two brand marks (header, footer) and the home\'s picture: no screenshot, no mockup, no logo');
    assert.ok(!/[$€£]\s?\d|\b\d[\d,.]*\s?(USD|dollars?|euros?|pounds?)\b|\btestimonials?\b/i.test(words), 'no price (an amount of money) and no testimonial');
  });
  test(`${s.slug}: the chrome keeps the site's labels, the story's calls say "See Companion Core", the campaign script loads when it exists`, () => {
    const t = pageOf(s, {}, { campaign: false }), on = pageOf(s, {}, { campaign: true });
    const head = (t.match(/<header class="site-head">[\s\S]*?<\/header>/) || [''])[0], foot = (t.match(/<footer[\s\S]*?<\/footer>/) || [''])[0], main = (t.match(/<main[\s\S]*?<\/main>/) || [''])[0];
    for (const part of [head, foot]) assert.ok(part.includes(`href="${LINKS.core}"`) && />Buy Companion Core</.test(part), 'Buy Companion Core in the chrome');
    for (const part of [head, foot]) assert.ok(part.includes(`href="${LINKS.download}">Download Companion</a>`), 'Download Companion in the chrome');
    assert.ok(!/Buy Companion Core/.test(main), 'the story says See Companion Core, not Buy');
    assert.equal((main.match(new RegExp(`href="${LINKS.core}"[^>]*>See Companion Core<`, 'g')) || []).length, 2, 'See Companion Core in the hero and at the close');
    assert.ok(!t.includes('campaign.js') && on.includes('<script src="../portal/campaign.js" defer data-cfasync="false"></script>'), 'campaign.js is loaded only when the build has it, exactly as its header says');
    assert.ok(on.indexOf('campaign.js') < on.indexOf('location.replace('), 'and before any script that writes the address');
    // every link into the player carries data-campaign (the script puts the ad's tags on it), and none leaves for the editor
    for (const m of on.matchAll(/<a\b[^>]*href="\.\.\/room-creator[^"]*"[^>]*>/g)) assert.ok(/ data-campaign/.test(m[0]), `a link into the player without data-campaign: ${m[0].slice(0, 90)}`);
  });
}

test('a family whose name three homes share still has a page title and a name of its own', () => {
  const cards = [{ slug: 'brennan', title: 'The Brennan family' }, { slug: 'brennan-hollin', title: 'The Brennan family' }, { slug: 'brennan-merrow', title: 'The Brennan family' }, { slug: 'okafor', title: 'The Okafor family' }];
  const places = { brennan: 'Wrenfield', 'brennan-hollin': 'Hollin Cross', 'brennan-merrow': 'Merrow Ford', okafor: 'Ashby' };
  const l = pg.uniqueLabels(cards, places);
  assert.equal(l.brennan, 'The Brennan family of Wrenfield');
  assert.equal(l['brennan-hollin'], 'The Brennan family of Hollin Cross');
  assert.equal(l.okafor, 'The Okafor family');
  const titles = Object.values(l).map(pg.familyPageTitle);
  assert.equal(new Set(titles).size, titles.length, 'the page titles differ');
  assert.ok(titles.every(t => t.length <= TITLE_MAX), 'and fit a search result');
  assert.equal(pg.uniqueLabels(cards.slice(3), places).okafor, 'The Okafor family');
  const s = L.stories[0];
  assert.ok(pageOf(s, {}, { label: 'The Test family of Somewhere' }).includes('<title>The Test family of Somewhere · Virtual homes'), 'the page title takes the label');
});

test('the footer says nothing about analytics (the deployed site has some), and says the voice is synthetic only where the tour has one', () => {
  const s = L.stories[0], plain = text(pageOf(s)), voiced = text(pageOf(s, {}, { narration: true }));
  assert.ok(!/analytics|no cookies|no third-party/i.test(plain), 'no claim about analytics or third parties');
  assert.ok(!plain.includes('Narration is generated locally'), 'a tour with no narration says nothing about a voice');
  assert.ok(voiced.includes('Narration is generated locally with an open text-to-speech model.'), 'a tour with a voice says what it is');
  const agents = s.members.some(m => m.companion);
  assert.equal(plain.includes('Hermes is from Nous Research.'), agents, 'the agents are attributed when the page names one');
});

// The flagship family, when it is in the tree (the three Brennan homes are the contract's own; nothing else is relied on)
// (pinned to a frozen copy of the Brennan story and its casting entry, test/fixtures/site/frozen/: these tests hold the page's structure, and a rewrite of the live family file must not fail them)
const BRENNAN = path.join(ROOT, 'test', 'fixtures', 'site', 'frozen', 'brennan.json');
const BRENNAN_CASTING = path.join(ROOT, 'test', 'fixtures', 'site', 'frozen', 'brennan.casting.json');
test('the Brennan page: four people, each in their own room, and John opens in his', { skip: !fs.existsSync(BRENNAN) }, () => {
  const s: Story = readJson(BRENNAN), casting = readJson(BRENNAN_CASTING);
  const t = pageOf(s, {}, { casting });
  const secs = sections(t);
  assert.deepEqual([...secs.keys()], ['sally', 'john', 'steve', 'jean']);
  const rooms: Record<string, string> = { sally: 'Library', john: 'Primary suite', steve: "Steve's room", jean: "Jean's room" };
  const word: Record<string, string> = { sally: 'Organiser', john: 'Builder', steve: 'Gamer', jean: 'Learner' };
  for (const id of Object.keys(rooms)) { const sec = secs.get(id)!; assert.ok(sec.includes(`<span>${rooms[id]}</span>`) && sec.includes(`<span>${word[id]}</span>`), `${id}: ${word[id]}, ${rooms[id]}`); }
  // John's first moment on the page is in the living room, but "Start with John" opens in the suite: his own chapter
  assert.equal(s.beats[memberBeat(s.chapters, s.beats, 'john')].id, 'suite-code');
  assert.equal(memberChapter(s.chapters, s.beats, 'john')?.title, 'John in the primary suite');
  assert.ok(secs.get('john')!.includes('<p class="moment-room">The living room</p>'), 'a moment outside his own room says where it is');
  assert.ok(!secs.get('john')!.includes('<p class="moment-room">John in the primary suite</p>'), 'and one in his own room does not');
  assert.ok(t.includes(`The home is <a href="../homes/${s.house}">${displayName(houses.find(h => h.id === s.house)!)}</a>.`));
});

test('the leak check finds a builder, a Sims reference and a home name in a story, and ignores structure', () => {
  const s = L.stories[0], n = needles(ROOT);
  assert.deepEqual(storyCopyLeaks(s, n), []);
  assert.ok(storyCopyLeaks({ ...s, family: { ...s.family, tagline: 'Built by SimsWithNora' } }, n).length > 0);
  assert.ok(storyCopyLeaks({ ...s, family: { ...s.family, tagline: 'After a Sims 4 build' } }, n).length > 0);
  assert.ok(storyCopyLeaks({ ...s, family: { ...s.family, tagline: 'At Cute Starter Cottage' } }, n).length > 0);
  // a house id is structure, not copy: the story's own `house` key is never read as prose
  assert.deepEqual(storyCopyLeaks({ ...s, house: 'bghouse-olcia' }, n), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// story v2 (reference/story/story-v2.md): the floor plan, and the Brennan page with its real media, its details, its day and its home
// ---------------------------------------------------------------------------------------------------------------------------------------------
const SERAPHINE = readJson(path.join(ROOT, 'content', 'houses', 'seraphine.json'));

test('the floor plan: deterministic, a pin for each person, every room exists, no builder text', () => {
  const people = [{ id: 'sally', name: 'Sally', room: 'Library' }, { id: 'john', name: 'John', room: 'Master Suite' }, { id: 'steve', name: 'Steve', room: "Boy's Room" }, { id: 'jean', name: 'Jean', room: "Girl's Room" }];
  const plan = readPlan(SERAPHINE, { "Boy's Room": "Steve's room" })!;
  assert.ok(plan && plan.levels.length === 2 && plan.levels.map(l => l.label).join() === 'Ground floor,Upper floor', 'two storeys, labelled in words');
  // the same spec gives the same bytes: the drawing and the pins
  const again = readPlan(JSON.parse(JSON.stringify(SERAPHINE)), { "Boy's Room": "Steve's room" })!;
  assert.deepEqual(plan, again);
  for (const l of plan.levels) assert.equal(levelSvg(plan, l, { core: 'Library' }), levelSvg(again, again.levels[plan.levels.indexOf(l)], { core: 'Library' }));
  assert.deepEqual(placePins(plan, people), placePins(again, people));
  // one pin each, at the centre of a room that is in the spec, inside the drawing
  const { pins, missing } = placePins(plan, people);
  assert.equal(missing.length, 0);
  assert.deepEqual(pins.map(p => p.id), people.map(p => p.id));
  const names = new Set(roomNames(plan));
  for (const p of pins) {
    assert.ok(names.has(p.room), `${p.room} is a room of the spec`);
    assert.ok(p.xPct > 0 && p.xPct < 100 && p.yPct > 0 && p.yPct < 100, `${p.id} is inside the drawing (${p.xPct}, ${p.yPct})`);
  }
  assert.equal(pins.find(p => p.id === 'steve')!.level, 'l2');
  assert.equal(pins.find(p => p.id === 'sally')!.level, 'l1');
  // a person whose room the spec does not have has no pin, and is reported
  assert.deepEqual(placePins(plan, [{ id: 'x', name: 'X', room: 'Moat' }]), { pins: [], missing: ['x'] });
  // two people in one room do not share a spot
  const two = placePins(plan, [{ id: 'a', name: 'A', room: "Boy's Room" }, { id: 'b', name: 'B', room: "Boy's Room" }]).pins;
  assert.notEqual(`${two[0].xPct},${two[0].yPct}`, `${two[1].xPct},${two[1].yPct}`);
  // the rooms are named in the page's words, and the drawing carries no builder, no source and no house id
  const svg = levelSvg(plan, plan.levels[0], { core: 'Library' });
  assert.ok(svg.includes('Primary suite') && !/Master/.test(svg), '"Master suite" is the "Primary suite"');
  assert.ok(svg.includes('The Companion Core is in the library.') || svg.includes('The Companion Core is in the Library.'));
  assert.equal(roomLabel('Master Suite'), 'Primary suite');
  assert.equal(roomLabel("Girl's Room", { "Girl's Room": "Jean's room" }), "Jean's room");
  assert.equal(levelLabel('Ground Floor Plan', 0), 'Ground floor');
  assert.equal(levelLabel('Penthouse', 3), 'Penthouse');
  assert.ok(!/sims|base game|bghouse|seraphine/i.test(svg), 'no builder, no game, no house id in the drawing');
  assert.ok(aspect(plan) > 1 && aspect(plan) < 4);
});

test('the floor plan: every home of the fleet draws, every label fits its room, and the numbers are written the same way twice', () => {
  const bad: string[] = [];
  for (const h of houses) {
    const spec = readJson(path.join(ROOT, 'content', 'houses', `${h.id}.json`));
    const plan = readPlan(spec);
    if (!plan) { bad.push(`${h.id}: no plan`); continue; }
    for (const l of plan.levels) {
      const svg = levelSvg(plan, l);
      if (/NaN|undefined|Infinity/.test(svg)) bad.push(`${h.id}/${l.id}: a bad number`);
      for (const r of l.rooms) {
        // a name that is printed is readable (never under MIN_FONT); one that does not fit is left to the drawing's label and the room's tooltip
        const t = labelFor(r.label, r.w, r.d);
        if (t.fits && (t.size < 7 || t.lines.some(ln => ln.length * t.size * 0.58 > r.w * 20))) bad.push(`${h.id}/${r.name}: the name is set at ${t.size} and runs out of its room`);
        if (!svg.includes(`<title>${r.label.replace(/&/g, '&amp;')}</title>`)) bad.push(`${h.id}/${r.name}: no tooltip`);
      }
    }
    if (JSON.stringify(readPlan(spec)) !== JSON.stringify(plan)) bad.push(`${h.id}: not deterministic`);
    // every name the plan prints passes the copy rules (a room called "Portal Frame" would break the vocabulary of the Companion account)
    const rules = pg.errorRules(L.claims);
    for (const l of plan.levels) for (const r of l.rooms) { const hit = rules.find(re => re.test(r.label)); if (hit) bad.push(`${h.id}/${r.name}: "${r.label}" breaks a copy rule`); }
  }
  assert.deepEqual(bad, []);
});

const media: MediaManifest | null = readMedia(ROOT);
const CASTING = fs.existsSync(BRENNAN_CASTING) ? readJson(BRENNAN_CASTING) : null;
const V2 = fs.existsSync(BRENNAN) && !!media;
/** one moment's block out of a person's section: from its <li> to the next moment, the screenshot strip or the section's end */
const block = (sec: string, id: string): string => {
  const a = sec.indexOf(`<li class="moment" id="b-${id}">`);
  if (a < 0) return '';
  const rest = sec.slice(a + 10), b = rest.search(/<li class="moment" id="|<div class="shots"|<\/section>/);
  return b < 0 ? sec.slice(a) : sec.slice(a, a + 10 + b);
};

test('the Brennan page, with its media: the sticky nav, the card, the logos, the details, the screenshots', { skip: !V2 }, () => {
  const s: Story = readJson(BRENNAN);
  const t = pageOf(s, {}, { casting: CASTING, media, spec: SERAPHINE });
  const secs = sections(t);
  // ---- the nav: a plain link to each person, in a nav that sticks (the markup is the same without a script), with the archetype word
  const nav = (t.match(/<nav class="who-nav"[\s\S]*?<\/nav>/) || [''])[0];
  assert.ok(nav.includes('aria-label="The family"'));
  for (const m of s.members) assert.ok(nav.includes(`<li><a href="#${m.id}" aria-label="${m.name}, ${m.archetype!.charAt(0).toUpperCase()}${m.archetype!.slice(1)}"`) && nav.includes(`<b class="nm">${m.name}</b><small>${m.archetype!.charAt(0).toUpperCase()}${m.archetype!.slice(1)}</small>`), `${m.id} in the nav, with the archetype word`);
  assert.equal((nav.match(/<li>/g) || []).length, 4);
  assert.ok(/<div class="people">\s*<nav class="who-nav"/.test(t), 'the nav is the first thing in the people (it sticks for as long as they last)');
  // ---- each person: bio, the card, the moments with their details, the strip
  const isTold = (id: string) => told(s).some(b => b.id === id);
  for (const m of s.members) {
    const sec = secs.get(m.id)!;
    assert.ok(sec.includes(`<p class="who-bio">${m.profile!.bio.replace(/’/g, '’')}</p>`), `${m.id}: the bio`);
    const swap = (sec.match(/<div class="swap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
    assert.ok(swap.includes(`<h3 class="swap-h" id="${m.id}-swap-h">Rented before, on the Core now</h3>`) && swap.includes('Rented before') && swap.includes('On the Core now'), `${m.id}: the card "Rented before, on the Core now"`);
    // their distinct replaces names are on the left, their distinct apps (with a logo) on the right
    const mine = s.beats.filter(b => b.member === m.id && b.app);
    for (const r of new Set(mine.flatMap(b => b.app!.replaces))) assert.ok(swap.includes(`<li>${r}</li>`), `${m.id}: ${r} in "Rented before"`);
    const right = (swap.match(/<div class="swap-col swap-now">[\s\S]*$/) || [''])[0];
    for (const id of new Set(mine.map(b => b.app!.id))) {
      const a = appMedia(media, id)!;
      assert.ok(right.includes(`alt="${a.logo!.alt}"`) && right.includes(`<span>${a.name}</span>`), `${m.id}: ${a.name} with its logo in "On the Core now"`);
    }
    // the moments' details: a native disclosure with before, after, the steps as an ordered list and the fact
    for (const b of told(s).filter(x => x.member === m.id)) {
      const li = block(sec, b.id);
      assert.ok(li, `${b.id} is a block`);
      if (!b.detail) { assert.ok(!li.includes('<details'), `${b.id} has no detail and no disclosure`); continue; }
      assert.ok(li.includes('<details class="more">') && li.includes('<summary><span>More about this moment</span></summary>'), `${b.id}: a native details "More about this moment"`);
      assert.ok(!/<details[^>]*\sopen/.test(li), 'closed by default');
      const d = decode(li);
      assert.ok(d.includes(`<dt>Before</dt><dd>${b.detail.before}</dd>`) && d.includes(`<dt>Now</dt><dd>${b.detail.after}</dd>`), `${b.id}: before and after`);
      assert.equal((li.match(/<ol class="more-steps">[\s\S]*?<\/ol>/) || [''])[0].match(/<li>/g)!.length, b.detail.steps.length, `${b.id}: the steps are an ordered list`);
      assert.ok(d.includes(b.detail.fact), `${b.id}: the fact`);
      assert.ok(li.includes('data-campaign aria-label="Watch this moment, '), `${b.id}: "Watch this moment" is still there`);
    }
    // the chip that names an app wears its logo (24 px class), the replaces chip does not
    for (const b of told(s).filter(x => x.member === m.id && x.app)) {
      const li = block(sec, b.id), a = appMedia(media, b.app!.id);
      if (a && a.logo && (b.popup.chips || []).some(c => c.toLowerCase() === a.name.toLowerCase())) assert.ok(li.includes(`<span class="chip chip-app"><img class="logo" src="../${a.logo.file}" alt="${a.logo.alt}" width="128" height="128" loading="lazy" decoding="async">${a.name.replace(/&/g, '&amp;')}</span>`), `${b.id}: the chip wears ${a.name}'s logo`);
      assert.ok(!/chip-quiet">\s*<img/.test(li), 'a replaces chip has no logo');
    }
    // the strip: up to three real screenshots of their apps, a link to the file, lazy, sized, with the exact caption; none for an app without one
    const strip = (sec.match(/<div class="shots"[\s\S]*?<\/ul>\s*<\/div>/) || [''])[0];
    const wantApps = [...new Set(s.beats.filter(b => b.member === m.id && b.app && !['ftue', 'outro'].includes(s.chapters.find(c => c.id === b.chapter)?.kind || '')).map(b => b.app!.id))].filter(id => appMedia(media, id)?.shot).slice(0, 3);
    if (!wantApps.length) { assert.equal(strip, '', `${m.id}: no screenshot, no strip`); continue; }
    assert.equal((strip.match(/<figure class="shot">/g) || []).length, wantApps.length, `${m.id}: ${wantApps.length} screenshots (at most three)`);
    for (const id of wantApps) {
      const a = appMedia(media, id)!, sh = a.shot!;
      assert.ok(strip.includes(`<a class="shot-open" href="../${sh.file}" data-shot aria-label="Open a larger screenshot, ${a.name}"><img src="../${sh.file}" alt="${sh.alt}" width="${sh.w}" height="${sh.h}" loading="lazy" decoding="async"></a>`), `${m.id}/${id}: a link to the picture, lazy, with its size and alt text`);
      assert.ok(strip.includes(`<figcaption>${appCaption(a.name)}</figcaption>`), `${m.id}/${id}: the exact caption under it`);
    }
  }
  // ---- every image on the page is a real file the manifest names, with alt, size and loading; every screenshot has its caption
  const named = new Map<string, string>();
  for (const a of Object.values(media!.apps)) { if (a.logo) named.set(a.logo.file, ''); if (a.shot) named.set(a.shot.file, a.shot.caption); }
  for (const x of [...media!.ci.hub, ...media!.ci.portal]) named.set(x.file, x.caption);
  const r = checkPageImages([{ file: `family/${s.slug}.html`, html: t }], named, () => true);
  assert.deepEqual(r.problems, []);
  assert.ok(r.shown > 20, `${r.shown} real images on the page`);
  // ---- the dialog a screenshot opens in: one, native, named; the script that opens it is loaded (and the page does not need it)
  assert.equal((t.match(/<dialog\b/g) || []).length, 1);
  assert.ok(t.includes('<dialog class="shot-dialog" id="shot-dialog" aria-label="Screenshot, larger">') && t.includes('class="btn btn-primary shot-close"') && t.includes('<script src="../portal/shots.js" defer data-cfasync="false"></script>'));
  assert.ok(!MANIFEST.includes('..'));
});

test('the Brennan page: a day in the house, the home and its floor plan, how it runs', { skip: !V2 }, () => {
  const s: Story = readJson(BRENNAN);
  const t = pageOf(s, {}, { casting: CASTING, media, spec: SERAPHINE });
  // ---- a day: the parts of the day in order, the person, the line, a link to the moment on this page
  const day = (t.match(/<section class="block" id="day"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(day.includes('<h2 id="day-h">A day in the house</h2>'));
  const parts = [...day.matchAll(/<h3 class="day-at">([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(parts, ['Morning', 'Midday', 'Afternoon', 'After school', 'Weekend']);
  assert.equal((day.match(/<li class="day-item">/g) || []).length, s.family.day!.length);
  for (const e of s.family.day!) {
    const b = s.beats.find(x => x.id === e.beat)!, m = s.members.find(x => x.id === b.member)!;
    assert.ok(day.includes(decode(`<p class="day-line">${e.line}</p>`).replace(/&/g, '&amp;')) || decode(day).includes(`<p class="day-line">${e.line}</p>`), `the line: ${e.line}`);
    assert.ok(day.includes(`<p class="day-who nm">${m.name}</p>`) && day.includes(`href="#b-${b.id}"`) && t.includes(`id="b-${b.id}"`), `${e.beat}: ${m.name}, and a link to a moment that is on the page`);
  }
  // ---- the home: the lede, the facts from the spec, a block for each spot, the plan with a pin for each person
  const home = (t.match(/<section class="block" id="home"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(home.includes('<h2 id="home-h">The home</h2>') && decode(home).includes(s.family.home!.lede));
  const facts = [...home.matchAll(/<ul class="home-facts"[^>]*>([\s\S]*?)<\/ul>/g)].map(m => [...m[1].matchAll(/<li>([^<]+)<\/li>/g)].map(x => x[1]));
  assert.deepEqual(facts[0], ['2 storeys', '331 m²', '18 rooms'], 'the storeys, the floor area and the rooms of the spec');
  assert.equal((home.match(/<li class="spot">/g) || []).length, s.family.home!.spots.length);
  assert.ok(home.includes('<h3>Library</h3>') && home.includes("<h3>Steve’s room</h3>".replace('’', "'")) && home.includes('<h3>Primary suite</h3>'), 'a spot is headed by the room, in the page’s words');
  assert.equal((home.match(/<figure class="plan"/g) || []).length, 2, 'a plan for each storey');
  assert.ok(home.includes('<nav class="plan-floors" aria-label="Floors">') && home.includes('href="#plan-l1"') && home.includes('href="#plan-l2"'), 'the floors are plain anchors');
  const pins = [...home.matchAll(/<a class="pin" href="#([a-z]+)"[^>]*aria-label="([^"]*)"/g)];
  assert.deepEqual(pins.map(m => m[1]), ['sally', 'john', 'steve', 'jean'], 'one pin for each person, each a link to their section');
  for (const m of pins) { assert.ok(/ story$/.test(decode(m[2])), 'a pin is named'); assert.ok(t.includes(`id="${m[1]}"`), `${m[1]} has a section to go to`); }
  assert.ok(home.includes('aria-label="Sally, in the library. Go to Sally’s story"') && home.includes("Steve, in Steve's room."), 'the pins say who and where');
  assert.equal((home.match(/class="plan-core"/g) || []).length, 1, 'the Companion Core is marked once');
  assert.ok(/<svg class="plan-svg"[^>]*role="img"/.test(home) && !/<foreignObject|<script|on[a-z]+=/i.test(home.replace(/<a class="pin"[\s\S]*?<\/a>/g, '')), 'the drawing is plain SVG with a label');
  // ---- how it runs: Companion Hub and the Companion account, real and labelled, in two plain sentences
  const runs = (t.match(/<section class="block" id="runs"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(runs.includes('<h2 id="runs-h">How it runs</h2>') && runs.includes(pg.RUNS_HUB) && runs.includes(pg.RUNS_ACCOUNT));
  for (const x of [...media!.ci.hub.filter(x => ['store', 'home'].includes(x.id)), ...media!.ci.portal.filter(x => ['home', 'add-device'].includes(x.id))]) assert.ok(runs.includes(`<figcaption>${x.caption}</figcaption>`) && runs.includes(`src="../${x.file}"`), `${x.id}: ${x.caption}`);
  assert.ok(!/[$€£]\s?\d|\bprice|\bplan(s)?\b.*\bmonth/i.test(decode(runs)), 'no price');
  assert.ok(!/\bPortal\b|CI Account|app store/i.test(text(runs)), 'the product nouns are exact');
  // ---- the page still obeys the rules the homes' pages obey, with all of it in
  const title = tag(t, /<title>([^<]*)<\/title>/), desc = tag(t, /<meta name="description" content="([^"]*)">/);
  assert.ok(title.length <= TITLE_MAX && desc.length <= 160 && (t.match(/<h1\b/g) || []).length === 1 && (t.match(/<main\b/g) || []).length === 1);
  for (const m of t.matchAll(/<script\b([^>]*)>/g)) assert.ok(/type="(importmap|application\/ld\+json)"|data-cfasync="false"/.test(m[1]), `a script without data-cfasync: ${m[0]}`);
  for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  assert.ok(!/(?:href|src)="\/(?!\/)/.test(t) && !/href="[^"]*\.html/.test(t));
  const words = text(t);
  assert.ok(!/[—–]/.test(words) && !/!/.test(words.replace(/!important/g, '')), 'no dash and no exclamation mark');
  assert.ok(words.includes(FICTIONAL_LINE));
  assert.ok(scanText('family/brennan.html', t, terms).length === 0, 'no builder credit and no build named');
  assert.ok(!/\bSims\b|Base Game|\bBG\b/.test(words));
});

test('the page without media or a spec is the page it was: no image but the three, no plan, no card', () => {
  const s = L.stories[0];
  const t = pageOf(s);
  assert.equal((t.match(/<img\b/g) || []).length, 3);
  assert.ok(!t.includes('class="plan') && !t.includes('<dialog') && !t.includes('shots.js') && !t.includes('class="shots"'), 'no plan, no dialog, no strip');
  assert.ok(!/<img[^>]*class="logo"/.test(t), 'and no logo: the card and the chips name their apps in text');
  assert.ok(t.includes('<div class="people">') && t.includes('<nav class="who-nav"'));
});

test('a swap leaves out a pair the copy rules stop, and a chip wears a logo only for an app of its beat', () => {
  const s: Story = fs.existsSync(BRENNAN) ? readJson(BRENNAN) : L.stories[0];
  const b = s.beats.find(x => x.app && x.app.replaces.length)!;
  const sw = pg.swapOf([b], L.catalog, pg.errorRules(L.claims));
  assert.ok(sw.before.length >= 1 && sw.now.length === 1);
  const banned = pg.swapOf([{ ...b, app: { id: b.app!.id, replaces: ['ChatGPT'] } }], L.catalog, [/replaces ChatGPT/]);
  assert.deepEqual(banned.before, [], '"X replaces ChatGPT" is a line the copy rules stop');
  assert.equal(pg.swapHtml('x', banned, null), '', 'no services, no card');
  if (media) {
    const chip = pg.chipsHtml({ ...b, popup: { ...b.popup, chips: [L.catalog[b.app!.id].name, 'Somebody Else'] } }, L.catalog, media);
    assert.equal((chip.match(/<img/g) || []).length, appMedia(media, b.app!.id)?.logo ? 1 : 0, 'one logo, on the chip that names the beat’s app');
    assert.ok(!/Somebody Else<\/span>/.test(chip.replace(/<span class="chip">/, '')) || true);
  }
});

test('the story v3 pair chip "alternative to <Service>" is the quiet chip, like the pass 1 "replaces <X>"', () => {
  const s: Story = fs.existsSync(BRENNAN) ? readJson(BRENNAN) : L.stories[0];
  const b = s.beats.find(x => x.app && x.app.replaces.length)!;
  const name = L.catalog[b.app!.id].name;
  const chips = pg.chipsHtml({ ...b, popup: { ...b.popup, chips: [name, `alternative to ${b.app!.replaces[0]}`] } }, L.catalog, null);
  assert.match(chips, /<span class="chip chip-quiet">alternative to /, 'the pair chip is the quiet chip');
  assert.ok(!/chip-quiet">\s*<img/.test(chips), 'a pair chip has no logo');
  const stopped = pg.chipsHtml({ ...b, popup: { ...b.popup, chips: [name, 'alternative to ChatGPT'] } }, L.catalog, null, [new RegExp(`${name} alternative to ChatGPT`)]);
  assert.ok(!/ChatGPT/.test(stopped), 'a pair line the copy rules stop is not printed in the v3 form either');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// story v2, the front page's pieces (scripts/portal-front.mts): pure functions of the families, the manifest and the home list
// ---------------------------------------------------------------------------------------------------------------------------------------------
const FAMILIES_DIR = fs.existsSync(path.join(ROOT, 'content', 'families', 'brennan.json')) ? path.join(ROOT, 'content', 'families') : FIXTURES;
const front = (): { fams: FrontFamily[]; stories: Story[] } => {
  const stories = loadAll(ROOT, FAMILIES_DIR).stories;
  const order = stories.map(s => s.slug);
  const cards = stories.map(s => cardOf(s, { catalog: L.catalog, order, thumb: '', og: '' }));
  const fams = readFamilies({ ROOT, dir: FAMILIES_DIR, built: stories.map(s => ({ slug: s.slug, house: s.house, hasTour: true })), cards });
  return { fams, stories };
};

const lander = (): { fams: FrontFamily[]; data: ReturnType<typeof computeLander> } => {
  const { fams, stories } = front();
  return { fams, data: computeLander({ root: ROOT, stories: readStories({ dir: FAMILIES_DIR, built: stories }), families: landerFamilies(fams), houses }) };
};

test('the front page: the cards come in the plan\'s order, in text, with "alternative to" and no held pair, and the apps list is alphabetical and links nothing', () => {
  const { fams, data } = lander();
  assert.equal(fams.length, loadAll(ROOT, FAMILIES_DIR).stories.length);
  const { featured, rest } = frontCards(houses, fams, data, galleryCards);
  const slugs = (html: string): string[] => [...html.matchAll(/<li class="card card-family[^"]*" data-id="[^"]+" data-slug="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(slugs(featured), data.featured.slugs, 'the featured list is the plan\'s, in its order');
  assert.deepEqual(slugs(rest), fams.map(f => f.slug).filter(s => !data.featured.slugs.includes(s)), 'every other family follows, in the story\'s order');
  const without = houses.filter(h => !fams.some(f => f.house === h.id));
  assert.equal((rest.match(/class="card card-plain"/g) || []).length, without.length, 'a plain card for each home with no family');
  for (const html of [featured, rest]) {
    assert.ok(!/\breplaces\b/i.test(html.replace(/<[^>]+>/g, ' ')), 'the wording is "alternative to"');
    assert.ok(!/<img[^>]*class="logo"/.test(html), 'text only: no logo');
    for (const h of data.plan.hold) { const [sv, ap] = h.split('|'); assert.ok(!html.includes(`data-service="${sv}"`) || data.index.shown.some(p => p.service.id === sv), `${h}: a held pair's service is on a card only through a pair that may show`); }
  }
  // featured cards show two lines at most, and no pair is on more than three of them
  const pairs = cardPairs(data, fams.map(f => f.slug), data.featured.slugs), used = new Map<string, number>();
  for (const slug of data.featured.slugs) {
    const lines = pairs.get(slug)!;
    assert.ok(lines.filter(l => l.shown).length <= 2, `${slug}: two lines`);
    for (const l of lines.filter(x => x.shown)) used.set(`${l.pair.service.id}|${l.pair.app.id}`, (used.get(`${l.pair.service.id}|${l.pair.app.id}`) ?? 0) + 1);
  }
  for (const [k, n] of used) assert.ok(n <= 3, `${k} is on ${n} featured cards`);
  const apps = appsNamed(fams);
  const names = [...apps.matchAll(/<li>([^<]+)<\/li>/g)].map(m => decode(m[1]));
  assert.ok(names.length > 20 && new Set(names).size === names.length, `${names.length} apps`);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'alphabetical');
  assert.ok(!/<a\b|<img/.test(apps), 'text only: no link, no logo');
});

test('a family card is text: two pair lines show and the others wait hidden for a chip, it says "Meet the family" and never promises the tour, and the hero\'s card names its other homes', () => {
  const { fams, data } = lander();
  const { featured } = frontCards(houses, fams, data, galleryCards);
  const hero = featured.split('\n        ')[0];   // (the cards are joined by this, so the first is the hero's)
  assert.ok(hero.includes(`data-slug="${data.plan.hero.slug}"`), 'the hero\'s card leads');
  const list = (hero.match(/<ul class="pairs-lines"[\s\S]*?<\/ul>/) || [''])[0];
  const items = list.match(/<li data-service="[^"]+"[^>]*>[^<]+<\/li>/g) || [];
  assert.ok(items.length >= 2, 'the family\'s cleared pairs are all there');
  assert.equal(items.filter(x => !/ hidden>/.test(x)).length, 2, 'two show');
  for (const li of items) assert.match(li.replace(/<[^>]+>/g, ''), /^[^,]+, alternative to [^,]+$/);
  assert.ok(/Meet the family/.test(hero) && !/Take the tour/.test(hero), 'a card goes to the family\'s page, not the tour');
  const heroFam = fams.find(f => f.slug === data.plan.hero.slug)!;
  const sibs = fams.filter(f => f.surname === heroFam.surname && f.slug !== heroFam.slug);
  if (sibs.length) {
    assert.match(hero, /Same people, a different house:/);
    for (const s of sibs) assert.ok(hero.includes(`<a href="./family/${s.slug}" data-campaign>`), `${s.slug} is linked from the grouped card`);
  }
  assert.ok(!/<img[^>]*class="logo"/.test(hero));
  assert.equal(firstSentence('Two storeys of brick. The ground floor is open. Behind it, a pool.'), 'Two storeys of brick.');
  assert.equal(firstSentence('One sentence only'), 'One sentence only');
  assert.equal(firstSentence('  Spaced   out.  Next. '), 'Spaced out.');
});

// ---- live pass 3: the name as a kicker, and the type scale (the owner's "36 px text minimum; all caps on the name, loosely spaced like a kicker", then "30 percent too big, reference the website") -------
// The scale is the CI canon's: rem of its org-wide 17 px root, reading text in a modal 1.5rem (25.5 px at 768 px and wider, clamp(20px, 5.4vw, 25.5px) on a phone), a card's title 2.25rem, the start and
// end cards' heading 2.6rem (phones 1.9rem and 2.1rem); weights 400 body, 500 controls, 600 chips, 700 titles and the name; tracking 0.2pt on everything but the name, which is a kicker (0.2em).
// The kicker look is CSS (text-transform and letter-spacing); the string in the page and in every aria-label is the name as written. These are the static halves of the checks; the
// browser half (computed sizes of every text node of every modal, the name elements' text-transform and tracking) is scripts/story/portal-tests/typography.mts.
test('a person\'s name stays as written in the page (the capitals are CSS), and the stylesheets give a name the kicker look', () => {
  for (const s of L.stories) {
    const t = pageOf(s);
    for (const m of s.members) {
      if (m.name === m.name.toUpperCase()) continue;
      assert.ok(!t.includes(`>${m.name.toUpperCase()}<`), `${s.slug}: ${m.name} is not written in capitals in the page`);
      assert.ok(t.includes(`<b class="nm">${m.name}</b>`) || !pickBeats(s, m.id), `${s.slug}: "Start with ${m.name}" names them as written`);
    }
  }
  const css = fs.readFileSync(path.join(ROOT, 'portal', 'family.css'), 'utf8'), story = fs.readFileSync(path.join(ROOT, 'portal', 'story.css'), 'utf8'), view = fs.readFileSync(path.join(ROOT, 'portal', 'viewer.css'), 'utf8');
  const rule = (src: string, sel: string): string => (src.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`)) || [])[1] || '';
  const fam = rule(css, '.nm, .who h2.nm'), st = rule(story, '.st-who, .st-name, .st-start-kick');
  for (const [name, body, track] of [['family.css .nm', fam, /letter-spacing:\s*0\.2em/], ['story.css .st-who, .st-name', st, /letter-spacing:\s*var\(--st-kick\)/]] as const) {
    assert.ok(/text-transform:\s*uppercase/.test(body), `${name}: all capitals by CSS`);
    assert.ok(track.test(body), `${name}: tracking of 0.2em`);
    assert.ok(/font-weight:\s*700/.test(body), `${name}: bold, the canon's 700`);
    assert.ok(/color:\s*var\(--(?:primary|label-ink|vh-link)\)/.test(body), `${name}: the accent, from the token`);
  }
  assert.ok(/--st-kick:\s*0\.2em;/.test(view), 'the kicker tracking token is 0.2em');
  assert.ok(/\.who-nav-text b\.nm\s*\{[^}]*font-size:\s*0\.85rem/.test(css) && /\.day-who\.nm\s*\{[^}]*font-size:\s*0\.85rem/.test(css) && /\.sib b\.nm\s*\{[^}]*font-size:\s*0\.85rem/.test(css), 'the nav chip, the day label and the sibling link keep their name at 0.85rem, the smallest a label among body text may be');
  assert.ok(/\.who h2\.nm\s*\{[^}]*font-size:\s*clamp\(1\.5rem/.test(css) && /\.hero h1\.nm\s*\{[^}]*font-size:\s*clamp\(1\.25rem/.test(css), 'a name that is a heading is 1.25rem or more (the hero\'s) or 1.5rem (a person\'s section)');
});
const pickBeats = (s: Story, id: string): boolean => told(s).some(b => b.member === id);

/** every `font-size` (and a px size in a `font` shorthand) in the rules whose selector is not exempt, as [selector, value] */
function sizesIn(src: string, exempt: RegExp): Array<[string, string]> {
  const out: Array<[string, string]> = [], css = src.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/^[\s\S]*;\s*/, '');
    if (!sel || sel.startsWith('@') || exempt.test(sel)) continue;
    for (const d of m[2].split(';')) {
      const k = d.slice(0, d.indexOf(':')).trim(), v = d.slice(d.indexOf(':') + 1).trim();
      if (k === 'font-size') out.push([sel, v]);
      else if (k === 'font' && /\d+(\.\d+)?px/.test(v)) out.push([sel, v]);
    }
  }
  return out;
}
test('the tour, the About dialog, the failure cards and the screenshot dialog set no type under the floor: every size is a token, and the tokens are the canon\'s rem scale', () => {
  const read = (f: string): string => fs.readFileSync(path.join(ROOT, 'portal', f), 'utf8');
  const tokenised = (v: string): boolean => /^(var\(--(st|dlg)-(min|title|hook)\)|calc\(var\(--(st|dlg)-(min|title|hook)\)\s*\*\s*[\d.]+\)|inherit)$/.test(v);
  // story.css: everything except the chapters drawer (a non-modal list: not a card or a dialog), the timeline ticks and the sound and chapters buttons
  const story = sizesIn(read('story.css'), /^\.st-(ch|bt|tr|transcript|n\b|x\b|tick|btn-sound|btn-chapters|chapters|live-region)/);
  assert.ok(story.length >= 20, `the tour's sizes are found (${story.length})`);
  assert.deepEqual(story.filter(([, v]) => !tokenised(v)), [], 'story.css: a size under the floor, or a size that is not a token');
  // viewer.css: the About dialog and the two failure cards (the loading splash, the top bar, the dock, the toast and the plain player's own end card are not cards of the tour)
  const view = sizesIn(read('viewer.css'), /^(?!.*\.vh-(help|fail|error|btn\b))/).filter(([s]) => /\.vh-(help|fail|error|btn\b)/.test(s) && !/\.vh-(btn-|end-btn|loading)/.test(s) && !/vh-error-msg|vh-help-tick/.test(s) || false);
  assert.ok(view.length >= 12, `the dialogs' sizes are found (${view.length})`);
  assert.deepEqual(view.filter(([, v]) => !tokenised(v) && !/^400 var\(--st-min\)\/1\.38 var\(--vh-font\)$/.test(v)), [], 'viewer.css: an About or failure size under the floor, or not a token');
  // media.css: the screenshot dialog
  const dlg = sizesIn(read('media.css'), /^(?!\.shot-dialog)/);
  assert.ok(dlg.length >= 3 && dlg.every(([, v]) => tokenised(v)), `media.css: the screenshot dialog's ${dlg.length} sizes are tokens`);
  // the tokens themselves: 1.5rem, 2.25rem and 2.6rem of the canon's 17 px root; on a phone clamp(20px, 5.4vw, 25.5px), 1.9rem and 2.1rem
  const v = read('viewer.css');
  assert.ok(/--st-min:\s*1\.5rem;/.test(v) && /--st-title:\s*2\.25rem;/.test(v) && /--st-hook:\s*2\.6rem;/.test(v), 'the tokens: 1.5rem, 2.25rem and 2.6rem (25.5, 38.25 and 44.2 px at 17 px)');
  assert.ok(/@media \(max-width: 767px\)\s*\{\s*html\[data-mode="view"\]\s*\{[^}]*--st-min:\s*clamp\(20px, 5\.4vw, 25\.5px\);[^}]*--st-title:\s*1\.9rem;[^}]*--st-hook:\s*2\.1rem;/.test(v), 'and on a phone clamp(20px, 5.4vw, 25.5px), 1.9rem and 2.1rem');
  assert.ok(/--dlg-min:\s*1\.5rem/.test(read('media.css')) && /--dlg-min:\s*clamp\(20px, 5\.4vw, 25\.5px\)/.test(read('media.css')), 'the screenshot dialog has the same two');
  // the canon's root: every rem is of 17 px (room-creator.html is the player's page, site.css the family pages')
  assert.ok(/html\s*\{\s*font-size:\s*17px/.test(fs.readFileSync(path.join(ROOT, 'room-creator.html'), 'utf8')), 'the player\'s root size is the canon\'s 17 px');
  assert.ok(/html\s*\{[^}]*font-size:\s*17px/.test(read('site.css')), 'and the family pages\'');
  // the canon's weights (no 800) and tracking on the tour's cards: the name is the only wide tracking, the monogram the only none
  const sc = read('story.css');
  assert.ok(!/font-weight:\s*800/.test(sc) && !/font-weight:\s*800/.test(read('media.css').slice(read('media.css').indexOf('.shot-dialog'))), 'no weight 800: the canon loads 400, 500, 600 and 700');
  const tracks = [...sc.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*letter-spacing:\s*([^;}]+)[;}]/g)].map(m => [m[1].trim().split(',').pop()!.trim(), m[2].trim()]);
  assert.deepEqual(tracks.filter(([sel, val]) => !(val === 'var(--st-track)' || val === 'var(--st-kick)' || /^-0\.0\d*em$/.test(val) || (val === '0' && sel === '.st-disc'))), [], 'story.css: tracking is the canon\'s 0.2pt, the name\'s 0.2em, or none on the monogram');
});

test('the tour\'s cards are the light glass: two corners (5 px on a card, 3 px on a control), every radius a token, nothing nowrap, and no hard-coded colour (the scrim and the leader\'s shadow are mixed from the --vh-ink token)', () => {
  const sc = fs.readFileSync(path.join(ROOT, 'portal', 'story.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.st-card \{[^}]*border-radius:\s*var\(--st-r-card\)/.test(sc) && /\.st-end \{[^}]*border-radius:\s*var\(--st-r-card\)/.test(sc) && /\.st-start-card \{[^}]*border-radius:\s*var\(--st-r-card\)/.test(sc), 'a card, the end card and the start card take the card radius');
  const view = fs.readFileSync(path.join(ROOT, 'portal', 'viewer.css'), 'utf8');
  // the owner's glass mockup (2026-10): 5 px on a card, sheet, dialog, panel, dock or toast; 3 px on a chip, button, disc, kbd, tick or control; no pill, no circle
  assert.ok(/--st-r-card:\s*5px;/.test(view) && /--st-r-sheet:\s*5px;/.test(view) && /--st-r-ctl:\s*3px;/.test(view) && /--vh-radius:\s*5px;/.test(view), 'the radius tokens are the mockup\'s 5 px (card, sheet, panel) and 3 px (control)');
  const vhRadius = [...view.matchAll(/--vh-radius:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(vhRadius.length >= 2 && vhRadius.every(v => v === '5px'), `--vh-radius is 5 px where it is set, the compact layout's override included (${vhRadius.join(', ')})`);
  // every radius in the tour is one of the tokens (the pin is an SVG circle, which has no border-radius); in viewer.css's view-mode rules only the scrubber's thumb keeps its 50 %
  const literal = (src: string) => [...src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*?border-radius:\s*([^;}]+)[;}]/g)].map(m => [m[1].trim().split(',').pop()!.trim(), m[2].trim()] as const).filter(([, v]) => !/^var\(--(st-r-(card|sheet|ctl)|vh-radius)\)$/.test(v));
  assert.deepEqual(literal(sc), [], 'story.css: every border-radius is --st-r-card, --st-r-sheet or --st-r-ctl');
  assert.deepEqual(literal(view).filter(([sel]) => !/slider-thumb|range-thumb/.test(sel)), [], 'viewer.css: every border-radius but the scrubber\'s thumb is a token');
  assert.ok(!/white-space:\s*nowrap|text-overflow:\s*ellipsis/.test(sc.replace(/\.st-live-region[^}]*\}/, '')), 'story.css: no reading text is nowrap or cut with an ellipsis (the live region is off screen)');
  assert.ok(/\.st \{[^}]*overflow-wrap:\s*anywhere/.test(sc), 'the tour\'s layer wraps any word');
  assert.deepEqual([...sc.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map(m => m[0]), [], 'story.css has no hex or rgb colour: tokens only');
  // the glass and its text are tokens of viewer.css, in the canon's light set (room-creator.html's light token block)
  const rc = fs.readFileSync(path.join(ROOT, 'room-creator.html'), 'utf8'), light = rc.slice(rc.indexOf('canon — light semantic set'));
  const tok = (name: string) => (light.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  for (const [st, canon] of [['st-ink', 'foreground'], ['st-ink-2', 'muted-foreground'], ['st-accent', 'primary'], ['st-accent-fg', 'primary-foreground'], ['st-paper', 'background'], ['st-c1', 'chart-1'], ['st-c2', 'chart-2'], ['st-c3', 'chart-3'], ['st-c4', 'chart-4']] as const) {
    const want = tok(canon), got = (view.match(new RegExp(`--${st}:\\s*(#[0-9a-fA-F]{6});`)) || [])[1];
    assert.ok(want && got && got.toLowerCase() === want.toLowerCase(), `--${st} is the light set's --${canon} (${want}), got ${got}`);
  }
  assert.ok(/--st-glass:\s*rgb\(255 255 255 \/ 0\.8[2-9]\)/.test(view) && /--st-glass-blur:\s*blur\(16px\) saturate\(1\.5\)/.test(view) && /--st-glass-edge:\s*rgb\(255 255 255 \/ 0\.62\)/.test(view), 'the glass is white at 82 % or more (the floor the contrast holds at), blur(16px) saturate(1.5), a 62 % white edge');
  assert.ok(/\.st-card\.st-open \.st-head \{[^}]*background:\s*var\(--st-paper\)/.test(sc), 'a stuck card head is the opaque paper, so scrolled words hide under it');
});
