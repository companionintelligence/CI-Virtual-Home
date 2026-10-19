#!/usr/bin/env -S node --experimental-strip-types
// The family pages the story build writes (scripts/story/pages.mts), held to the rules the homes' pages are held to
// (scripts/build-portal.mts step 7) on whatever families exist, with the test families in test/fixtures/site/families: so CI, which
// builds the site from the shipped families only, still proves the page writer on a family that is always there. Also the story-copy
// leak check (scripts/story/check-leaks.mts). Pure Node: no browser, no network. Needs `pnpm run build` (the page writer imports
// assets/home-names.js).
//
// The page is the landing page of an ad: above the fold the name, the tagline, the picture, "Take the tour" and "See Companion Core" and the
// one honest line about the 3D; a disclosure strip printed from claims.json; a section for each person (id = the member's id, so
// family/<slug>#sally is a link) with their moments, each linking the tour at that beat, and "Start with <name>"; what runs on the Core. It
// reads with no JavaScript (this test reads the HTML, which has none of it). The ad rules bind it: no UI mockup, no price, no third-party
// logo, nobody a customer, the beta line, the chrome's labels kept and the story's own call to action "See Companion Core".
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll, cardOf, storyFiles, readJson } from './story/site-lib.mts';
import * as pg from './story/pages.mts';
import { needles, storyCopyLeaks } from './story/check-leaks.mts';
import { LINKS, TITLE_MAX } from './portal-pages.mts';
import { memberBeat, memberChapter } from '../assets/story/url.ts';
import { displayName } from '../assets/home-names.js';
import { builderHandles, guardTerms, scanText } from './portal-redact.mts';
import { FICTIONAL_LINE, BETA_LINE } from '../assets/story/types.ts';
import type { Story } from '../assets/story/types.ts';

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
  assert.ok(houses.length === 30);
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
    assert.ok(words.includes(FICTIONAL_LINE) && words.includes(BETA_LINE));
    assert.deepEqual(storyCopyLeaks(s, needles(ROOT)), []);
  });
}

for (const s of L.stories) {
  test(`${s.slug}: above the fold, the strip, a section for each person and what runs on the Core`, () => {
    const t = pageOf(s), words = text(t), q = (u: string): string => decode(u);
    // above the fold: the name, the tagline, the home's picture, the two buttons, the one honest line
    const hero = (t.match(/<section class="hero"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(hero.includes(`<h1 id="family-h">The ${s.family.surname} family</h1>`), 'the name');
    assert.ok(hero.includes(s.family.tagline.replace(/&/g, '&amp;')) || words.includes(s.family.tagline), 'the tagline');
    assert.ok(new RegExp(`<img src="\\.\\./portal/previews/${s.house}\\.jpg"`).test(hero), 'the picture of the home');
    assert.ok(/<a class="btn btn-primary" href="\.\.\/room-creator\?mode=view&amp;house=[^"]+&amp;family=[a-z-]+" data-campaign><svg[^>]*><use href="#i-play"\/><\/svg><span>Take the tour<\/span><\/a>/.test(hero), 'one primary button, "Take the tour", into the player');
    assert.ok(hero.includes(`<a class="btn btn-ghost" href="${LINKS.core}" data-campaign>See Companion Core</a>`), 'and "See Companion Core" to exactly https://ci.computer/core');
    assert.equal((hero.match(/btn-primary/g) || []).length, 1, 'one primary button above the fold');
    assert.ok(hero.includes(`<p class="hero-note">${pg.TOUR_NOTE}</p>`) && pg.TOUR_NOTE === 'The tour draws the home in 3D in your browser.', 'the one honest line');
    assert.ok(!/streamed/i.test(words), 'it does not say anything is streamed');
    // the strip is the claims file's own words
    const strip = (t.match(/<section class="strip"[\s\S]*?<\/section>/) || [''])[0];
    for (const id of ['fictional-family', 'beta-short', 'scripted-scenes', 'stylised-art']) {
      const d = (L.claims.disclosures as { id: string; text: string }[]).find(x => x.id === id)!.text;
      assert.ok(q(strip).includes(d), `the strip has the ${id} disclosure, word for word: ${d}`);
    }
    // a person's section, whose id is theirs; their moments each link the tour at that beat; "Start with <name>"
    const secs = sections(t);
    for (const m of s.members) {
      assert.ok(secs.has(m.id), `a section with id="${m.id}"`);
      assert.ok(t.includes(`<li><a href="#${m.id}"`), `${m.id} is linked from the list of the family`);
      const sec = secs.get(m.id)!, mine = told(s).filter(b => b.member === m.id);
      assert.ok(sec.includes(`<h2 id="${m.id}-h">${m.name}</h2>`) && sec.includes(`Age ${m.age}`), `${m.id}: the name and the age`);
      if (m.archetype) assert.ok(sec.includes(`<span>${m.archetype.charAt(0).toUpperCase()}${m.archetype.slice(1)}</span>`), `${m.id}: the archetype word`);
      for (const b of mine) {
        assert.ok(sec.includes(`<li class="moment" id="b-${b.id}">`), `${m.id}: the moment ${b.id}`);
        assert.ok(sec.includes(`href="../room-creator?mode=view&amp;house=${s.house}&amp;family=${s.slug}&amp;beat=${b.id}" data-campaign aria-label="Watch this moment, `), `${m.id}/${b.id}: "Watch this moment" opens the tour at the beat`);
        assert.ok(sec.includes(b.popup.title.replace(/&/g, '&amp;')) && sec.includes(b.popup.body.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${m.id}/${b.id}: its title and its words`);
        // the apps, with what each replaces (the beat's own chips)
        for (const c of b.popup.chips || []) assert.ok(q(sec).includes(c), `${m.id}/${b.id}: the chip ${c}`);
      }
      if (mine.length) assert.ok(sec.includes(`href="../room-creator?mode=view&amp;house=${s.house}&amp;family=${s.slug}&amp;member=${m.id}"`) && sec.includes(`<span>Start with ${m.name}</span>`), `${m.id}: "Start with ${m.name}"`);
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
const BRENNAN = path.join(ROOT, 'content', 'families', 'brennan.json');
test('the Brennan page: four people, each in their own room, and John opens in his', { skip: !fs.existsSync(BRENNAN) }, () => {
  const s: Story = readJson(BRENNAN), casting = readJson(path.join(ROOT, 'content', 'story', 'casting.json')).families.find((f: any) => f.slug === 'brennan');
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
