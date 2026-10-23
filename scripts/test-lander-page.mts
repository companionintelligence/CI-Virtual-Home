#!/usr/bin/env -S node --experimental-strip-types
// The checks the portal build runs on the BUILT front page (scripts/story/lib/lander-check.mts): one h1 that is the plan's claim, the blocks in order, every claim and
// disclosure word for word, three offers and none in the argument, the proof, the chooser or the families, no logo, no "replaces", no digit on a chip, nothing held,
// the featured cards and the proof the data chose. Held on a fixture page assembled from the real builders (so it is the page the build writes, in small), with
// a negative control for each rule: the fixture passes, and breaking one thing makes exactly that complaint. No browser, no built site. Pure Node.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeLander, readInputs } from './story/lib/lander.mts';
import type { FamilyLite, StoryFull } from './story/lib/lander.mts';
import { landerChecks, landerHeadChecks } from './story/lib/lander-check.mts';
import { finePrint, missingFinePrint } from './story/lib/fine-print.mts';
import { frontCards, proofBlock, swapBlock, appsNamed, heroCount } from './portal-front.mts';
import type { FrontFamily } from './portal-front.mts';
import { galleryCards, LINKS, esc } from './portal-pages.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const files = readInputs(ROOT);
const dir = path.join(ROOT, 'content', 'families');
const stories: StoryFull[] = fs.readdirSync(dir).filter((f) => /^[a-z]+(-[a-z]+)*\.json$/.test(f) && f !== 'films.json').sort().map((f) => J('content', 'families', f));
const casting: Record<string, any> = Object.fromEntries(J('content', 'story', 'casting.json').families.map((f: any) => [f.slug, f]));
const archetypes = (s: StoryFull): string[] => [...new Set(s.members.map((m) => m.archetype || casting[s.slug]?.members?.find((c: any) => c.id === m.id)?.archetype).filter(Boolean) as string[])];
const families: FamilyLite[] = stories.map((s) => ({ slug: s.slug, house: s.house, surname: s.family.surname, title: `The ${s.family.surname} family`, personas: archetypes(s) }));
const front: FrontFamily[] = stories.map((s) => ({
  slug: s.slug, house: s.house, title: `The ${s.family.surname} family`, surname: s.family.surname, tagline: '', hasTour: true,
  members: s.members.map((m) => ({ name: m.name, archetype: archetypes(s)[0] || '', word: 'organiser' })), apps: [], personas: archetypes(s), use: [], find: '',
}));
const houses: { id: string; name: string; storeys?: number; areaSqm?: number; style?: string }[] = J('content', 'houses', 'index.json').houses;
const data = computeLander({ root: ROOT, stories, families, houses, files });
const claims = files.claims;
const say = (id: string): string => claims.allowedClaims.find((c) => c.id === id)!.text;
const msg = Object.values(data.messages)[0];

// a page the build could have written: the same builders, the same markers, the same words
function page(): string {
  const cards = frontCards(houses as any, front, data, galleryCards);
  const h = data.plan.hero;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(msg.text.replace(/\.$/, ''))} · Companion Core</title>
<meta name="description" content="A Companion Core is a small personal server for local AI and your household's apps. ${esc(heroCount(families.length).split(' show')[0])} show how. Fictional family. Real software."></head>
<body><header class="site-head"><a href="${LINKS.site}">Companion Intelligence</a><nav><a href="${LINKS.docs}">Docs</a><a href="${LINKS.download}">Download Companion</a><a href="${LINKS.core}">Buy Companion Core</a></nav></header>
<main>
<section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="hero-chips">${finePrint('lander-hero').html}</div><h1 id="hero-title" data-claim="rent-line">${esc(msg.text)}</h1>
<p class="lede">A Companion Core is a small personal server that runs your household's apps and local AI at home.</p><p class="lede-families">${esc(heroCount(families.length))}</p>
<div class="hero-cta"><a class="btn btn-primary" id="hero-play" data-campaign data-cta="tour-hero" href="./room-creator.html?mode=view&amp;house=${h.house}&amp;family=${h.slug}">Take the tour</a><a class="hero-pointer" href="#core">See Companion Core</a></div></div></section>
<section class="argument" id="argument"><h2>From rented to kept</h2><ol><li><h3>Rent</h3><p data-claim="problem">${esc(say('problem'))}</p></li><li><h3>Move home</h3><p data-claim="plug-pair-walk">${esc(say('plug-pair-walk'))}</p></li></ol></section>
${proofBlock(data, front)}
<section class="cta-band" id="core"><h2 id="cta-title">Meet the Companion Core.</h2><p data-claim="core-size">${esc(say('core-size'))}</p>
<a class="btn btn-buy" href="${LINKS.core}">Buy Companion Core</a><a class="btn" href="${LINKS.download}">Download Companion</a><a href="${LINKS.docs}">Read the docs</a>
<aside id="core-limits">${finePrint('lander-core').html}</aside></section>
${swapBlock(data, front)}
<section class="homes" id="homes"><h2>Meet the families</h2><p class="homes-count" id="homes-count">${esc(data.count)}</p>
<ul class="grid" id="grid">${cards.featured}</ul><details id="all-homes"><summary>Show every family and home</summary><ul class="grid grid-rest" id="grid-rest">${cards.rest}</ul></details></section>
</main>
<footer><p data-claim="signoff">${esc(say('signoff'))}</p><a href="${LINKS.site}">ci.computer</a><a href="${LINKS.core}">Buy Companion Core</a><a href="${LINKS.download}">Download Companion</a><a href="${LINKS.docs}">Docs</a>
<div class="foot-notes">${finePrint('lander-footer').html}</div>${appsNamed(front)}</footer></body></html>`;
}
const ctx = { data, claims, services: files.services, apps: files.apps, links: { site: LINKS.site, core: LINKS.core, download: LINKS.download, docs: LINKS.docs }, missingFine: (html: string, surface: 'lander-hero' | 'lander-core' | 'lander-footer') => missingFinePrint(html, surface).map(String) };
const complaints = (g: string): string => landerChecks(g, ctx).join('\n');
const base = page();

test('the fixture page, assembled from the real builders, passes every check', () => {
  assert.equal(complaints(base), '', complaints(base));
  assert.deepEqual(landerHeadChecks(base, msg.text), []);
  assert.ok(base.includes('data-beat='), 'it has a proof');
});

test('each rule has teeth: breaking one thing makes exactly that complaint', () => {
  const broke = (edit: (g: string) => string): string => { const g = edit(base); assert.notEqual(g, base, `the edit changed the page: ${edit.toString().slice(0, 110)}`); return complaints(g); };
  assert.match(broke((g) => g.replace(`>${esc(msg.text)}</h1>`, '>Stop paying for intelligence.</h1>')), /the h1 is "Stop paying for intelligence\."/);
  assert.match(broke((g) => g.replace('</h1>', '</h1><h1>Another</h1>')), /2 h1 elements/);
  assert.match(broke((g) => g.replace('<section class="argument"', '<section class="argument-moved"')), /the blocks are/);
  assert.match(broke((g) => g.replace(/(<section class="cta-band"[\s\S]*?<\/section>)(\s*)(<section class="swap"[\s\S]*?<\/section>)/, '$3$2$1')), /the blocks are hero, argument, proof, swap, core, homes/);
  assert.match(broke((g) => g.replace(esc(say('problem')), 'You rent intelligence.')), /data-claim="problem" says "You rent intelligence\."/);
  assert.match(broke((g) => g.replace(/<p data-fine="launch-not-offer">[\s\S]*?<\/p>/, '')), /lander-footer: the launch-not-offer line is missing/);
  assert.match(broke((g) => g.replace(/<p data-fine="not-frontier">[\s\S]*?<\/p>/, '')), /lander-core: the not-frontier line is missing/);
  assert.match(broke((g) => g.replace(/<p data-fine="fictional-family">[\s\S]*?<\/p>/, '')), /lander-hero: the fictional-family line is missing/);
  assert.match(broke((g) => g.replace('<section class="swap"', `<section class="swap"><a href="${LINKS.core}">Buy</a></section><section class="swap"`)), /the swap block links https:\/\/ci\.computer\/core/);
  assert.match(broke((g) => g.replace('<div class="hero-cta">', `<div class="hero-cta"><a class="btn" href="${LINKS.core}">Buy now</a>`)), /the hero has 2 buttons|the hero block links/);
  assert.match(broke((g) => g.replace('<footer>', '<footer><img src="./portal/apps/immich/logo.webp" alt="">')), /an image from portal\/apps or portal\/ci/);
  assert.match(broke((g) => g.replace('<p class="lede">', '<p class="lede">Immich replaces Google Photos. ')), /the word "replaces"/);
  assert.match(broke((g) => g.replace(/(<button\b[^>]*class="pair"[\s\S]*?<b>)([^<]+)(<\/b>)/, '$1$2 (20)$3')), /a chip shows a digit/);
  assert.match(broke((g) => g.replace('<footer>', '<footer><span data-stat="homes">36</span>')), /a data-stat figure/);
  assert.match(broke((g) => g.replace(esc(data.count), 'Thirty fictional families in thirty homes.')), /the count line is/);
  assert.match(broke((g) => g.replace('<ul class="pairs-lines"', '<ul class="pairs-lines"><li>Open WebUI, alternative to ChatGPT</li>')), /the held pair "Open WebUI, alternative to ChatGPT" is on the page/);
  assert.match(broke((g) => g.replace(/(<li class="card card-family is-featured")/, '<li class="card card-family" data-id="x" data-slug="x"></li>$1').replace('is-featured', 'was-featured')), /the featured cards are/);
  assert.match(broke((g) => g.replace(/<section class="proof"[\s\S]*?<\/section>/, '')), /the blocks are/);
  assert.match(broke((g) => g.replace(/data-beat="[^"]+"/, 'data-beat="elsewhere"')), /the proof block is the beat elsewhere/);
  assert.match(broke((g) => g.replace('data-cta="tour-proof" data-campaign', 'data-cta="tour-proof"')), /Watch this moment/);
  assert.match(broke((g) => g.replace(/<li><button\b[^>]*class="pair"[\s\S]*?<\/li>/, '')), /service chips; the strip has/);
  assert.match(broke((g) => g.replace(`href="${LINKS.core}">Buy Companion Core</a></nav>`, `href="${LINKS.core}?utm=1">Buy Companion Core</a></nav>`)), /links to https:\/\/ci\.computer\/core/);
});

test('the head: the title carries the message and the Core, the description is a snippet with the fiction line and no digit', () => {
  const bad = (edit: (g: string) => string): string => landerHeadChecks(edit(base), msg.text).join('\n');
  assert.match(bad((g) => g.replace(/<title>[^<]*<\/title>/, '<title>Virtual homes</title>')), /does not carry the message/);
  assert.match(bad((g) => g.replace(/<title>[^<]*<\/title>/, `<title>${esc(msg.text)}</title>`)), /does not name the Companion Core/);
  assert.match(bad((g) => g.replace(/content="A Companion Core[^"]*"/, 'content="Short."')), /the description is \d+ characters/);
  assert.match(bad((g) => g.replace('Fictional family. Real software.', 'Fictional.')), /does not carry "Fictional family\. Real software\."/);
  assert.match(bad((g) => g.replace('show how.', 'show 30 ways.')), /a digit in the description/);
});
