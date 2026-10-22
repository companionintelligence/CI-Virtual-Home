#!/usr/bin/env -S node --experimental-strip-types
// The copy lint of a built site (scripts/story/check-copy.mts, scripts/story/lib/site-copy.mts, lib/ts-strings.mts, lib/extra-bans.mts), on a small site written into a
// temp folder, so it needs no build and no browser:
//   * a clean site passes, and the lint reads every kind of page: the front page, a home's page, a family's page, the 404, the player's HTML, a tour, the card data
//   * a claim the Core cannot make in the Core band or the footer of the front page is caught (the window that used to stop before the band is gone)
//   * the same in a home's page, a tour (a "replaces" chip of a family not yet told in v3 is a warning, in a v3 family an error), the player's noscript and head script,
//     and a string of the player's source
//   * a home's display name is the portal's own words (the internal-id rules do not read it) and an internal id still is caught
//   * a disclosure a kind of page owes: the one printed today is an error when missing, the one nobody prints yet is pending until --strict
//   * the string finder reads copy and not code (templates, tags, attributes; not an error message, a selector or a class list)
//   * the extra rules (cloud gaming, "sorts the photos") are warnings in the story validator's report and in the lint
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { siteCopy, readable, headingProblems, headCopy, DISCLOSURES } from './story/lib/site-copy.mts';
import { copyReport } from './story/check-copy.mts';
import { sourceStrings, copiesOf } from './story/lib/ts-strings.mts';
import { EXTRA_BANS, withExtraBans } from './story/lib/extra-bans.mts';
import { loadContext, ROOT } from './story/lib/context.mts';
import { validateStory } from './story/lib/validate.mts';
import type { Story } from '../assets/story/types.ts';
import { FICTIONAL_LINE } from '../assets/story/types.ts';

const claims = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'claims.json'), 'utf8'));
const say = (id: string): string => claims.disclosures.find((d: { id: string }) => d.id === id).text;

interface Site { dir: string; write: (rel: string, text: string) => void; read: (rel: string) => string }
/** A site of the shape portal:build writes, just big enough: one home, one family (v3 or not), the 404 and the player. */
function makeSite(opts: { v3?: boolean; chips?: string[]; homeName?: string; bandText?: string; tourBody?: string; familyExtra?: string } = {}): Site {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-copy-'));
  const write = (rel: string, text: string): void => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const homeName = opts.homeName ?? 'Newcrest House';
  write('content/houses/index.json', JSON.stringify({ houses: [{ id: 'newcrest', name: homeName }] }));
  write('story/families.aaaa.json', JSON.stringify({ v: 1, families: [{ slug: 'okafor', surname: 'Okafor', title: 'The Okafor family', address: '4 Elm Lane, Ashby', tagline: 'Four people, one quiet computer.', household: 'young-family', business: false, topics: [], members: [{ id: 'ada', name: 'Ada', companion: 'Pip' }], apps: [{ name: 'Immich' }], beats: 1, order: 0, thumb: '', og: '', rooms: ['Kitchen'] }] }));
  const beat: Record<string, unknown> = { id: 'kitchen-photos', chapter: 'kitchen', popup: { kind: 'app', title: 'Ada finds the photo', body: opts.tourBody ?? 'Ada looks for last summer in Immich.', chips: opts.chips ?? ['Immich', 'alternative to Google Photos'] } };
  if (opts.v3) beat.service = 'google-photos';
  write('story/okafor.bbbb.json', JSON.stringify({ v: 1, slug: 'okafor', family: { surname: 'Okafor', tagline: 'Four people, one quiet computer.', story: 'A family.', address: { line: '4 Elm Lane', place: 'Ashby' } }, members: [{ id: 'ada', name: 'Ada', work: 'Nurse' }], chapters: [{ id: 'kitchen', title: 'The kitchen' }], beats: [beat], closing: { body: 'That is the day.', cta: { label: 'Start again' } }, media: {} }));
  write('story/manifest.json', JSON.stringify({ v: 1, families: 'story/families.aaaa.json', byFamily: { okafor: { house: 'newcrest', story: 'story/okafor.bbbb.json', audio: {}, narration: false } } }));
  const foot = `<footer>Product names belong to their owners. ${say('launch-not-offer')} © 2026</footer>`;
  write('index.html', `<!doctype html><html><head><title>Thirty homes</title><meta name="description" content="A home for every family."></head><body><main><h1>Thirty homes. ${FICTIONAL_LINE}</h1><ul><li>${homeName} · 2 storeys</li></ul></main><section class="cta-band"><p>${opts.bandText ?? 'A Companion Core is a small personal server.'}</p></section>${['scripted-scenes', 'stylised-art', 'not-frontier', 'names-logos-owners', 'third-party-apps'].map((id) => `<p>${say(id)}</p>`).join('')}${foot}</body></html>`);
  write('404.html', `<!doctype html><html><head><title>Not found</title></head><body><main><h1>That page is not here</h1></main>${foot}</body></html>`);
  write('homes/newcrest.html', `<!doctype html><html><head><title>${homeName}</title></head><body><main><h1>${homeName}</h1><p>${FICTIONAL_LINE}</p><section class="family-block"><a href="../family/okafor">Meet the family</a></section></main>${foot}</body></html>`);
  const strip = [FICTIONAL_LINE, say('scripted-scenes'), say('stylised-art'), say('names-owners')].map((t) => `<p>${t}</p>`).join('');
  write('family/okafor.html', `<!doctype html><html><head><title>The Okafor family</title></head><body><header></header><main><h1>The Okafor family</h1>${strip}${opts.familyExtra ?? ''}<p class="home-note">The home is <a href="../homes/newcrest">${homeName}</a>.</p></main>${foot}</body></html>`);
  write('room-creator.html', `<!doctype html><html><head><title>Companion virtual home</title><script>var t = 'We could not open this home. Check the link, or pick a home from the gallery.'; throw new Error('this is not copy for a visitor, it is a message');</script></head><body><noscript><p>The virtual homes need JavaScript. Turn it on to fly through a home in 3D.</p></noscript><div id="app">Frame rate 30 fps</div></body></html>`);
  return { dir, write, read: (rel) => fs.readFileSync(path.join(dir, rel), 'utf8') };
}
const lint = (s: Site, strict = false) => siteCopy({ dir: s.dir, root: ROOT, strict, sources: [] });
const done = (s: Site): void => fs.rmSync(s.dir, { recursive: true, force: true });

test('a clean site passes, and the lint reads every page of it, the tour, the cards and the player', () => {
  const s = makeSite();
  try {
    const r = lint(s);
    assert.deepEqual(r.errors, []);
    assert.equal(r.counts.pages, 5, 'the front page, a home, a family, the 404 and the player');
    assert.equal(r.counts.tours, 1);
    assert.ok(r.counts.strings > 20);
  } finally { done(s); }
});

test('the Core band and the footer of the front page are read (the window that stopped before the band is gone)', () => {
  const s = makeSite({ bandText: 'The small computer on your desk runs your own AI, apps and memory at home.' });
  try {
    const r = lint(s);
    assert.ok(r.errors.some((e) => e.startsWith('index.html') && e.includes('cap-own-apps')), r.errors.join('\n'));
  } finally { done(s); }
});

test('a banned phrase is caught in a home page, a family page, the 404, the player\'s noscript and its head script, and in a meta description', () => {
  for (const [rel, edit, what] of [
    ['homes/newcrest.html', (t: string) => t.replace('Meet the family', 'Own your apps outright'), 'cap-own-apps'],
    ['family/okafor.html', (t: string) => t.replace('<header></header>', '<header><p>It is a chatbot!</p></header>'), 'chatbot'],
    ['404.html', (t: string) => t.replace('That page is not here', 'Log in to see it'), 'log in'],
    ['room-creator.html', (t: string) => t.replace('fly through a home in 3D.', 'fly through a home in 3D. Own your apps outright.'), 'cap-own-apps'],
    ['room-creator.html', (t: string) => t.replace('Check the link,', 'Own your apps outright. Check the link,'), 'cap-own-apps'],
    ['index.html', (t: string) => t.replace('A home for every family.', 'A chatbot for every family.'), 'chatbot'],
  ] as const) {
    const s = makeSite();
    try {
      s.write(rel, edit(s.read(rel)));
      const r = lint(s);
      assert.ok(r.errors.some((e) => e.startsWith(rel) && e.toLowerCase().includes(what.toLowerCase())), `${rel}: ${what}\n${r.errors.join('\n')}`);
    } finally { done(s); }
  }
});

test('a home\'s own note is read (it is ordinary copy there); a family page\'s note names the home and is not', () => {
  const s = makeSite();
  try {
    s.write('homes/newcrest.html', s.read('homes/newcrest.html').replace('</main>', '<p class="home-note">Built live from one spec file \u2014 change the hour!</p></main>'));
    const r = lint(s);
    assert.ok(r.errors.some((e) => e.startsWith('homes/newcrest.html') && e.includes('dash-em-en')), r.errors.join('\n'));
    assert.ok(r.errors.some((e) => e.startsWith('homes/newcrest.html') && e.includes('exclamation')), r.errors.join('\n'));
  } finally { done(s); }
  const f = makeSite();
  try { assert.deepEqual(lint(f).errors, [], 'the family page\'s note, which names the home, is fine'); } finally { done(f); }
});

test('a tour is read: a banned phrase in it is an error, and a pass 1 "replaces" chip is a warning until the family is told in v3', () => {
  const s = makeSite({ tourBody: 'Ada owns the app outright.' });
  try { assert.ok(lint(s).errors.some((e) => e.startsWith('story/okafor kitchen-photos.body')), 'a banned phrase in the body'); } finally { done(s); }
  const legacy = makeSite({ chips: ['Open WebUI', 'replaces ChatGPT'] });
  try {
    const r = lint(legacy);
    assert.deepEqual(r.errors, []);
    assert.ok(r.warnings.some((w) => w.includes('cap-parity') && w.includes('pass 1 chip')), r.warnings.join('\n'));
  } finally { done(legacy); }
  const v3 = makeSite({ v3: true, chips: ['Open WebUI', 'replaces ChatGPT'] });
  try { assert.ok(lint(v3).errors.some((e) => e.includes('cap-parity')), 'in a v3 family the chip meets the rule at its own severity'); } finally { done(v3); }
});

test('a home\'s display name is the portal\'s own words; an internal id is not', () => {
  const s = makeSite({ homeName: 'Valley-View Villa' });
  try {
    assert.deepEqual(lint(s).errors, [], 'a display name that holds the words of an internal id is fine');
    s.write('index.html', s.read('index.html').replace('2 storeys', '2 storeys · lakecabin'));
    assert.ok(lint(s).errors.some((e) => e.includes('internal-ids')), 'an id is caught');
  } finally { done(s); }
});

test('the disclosures: one printed today is an error when missing, one nobody prints yet is pending until --strict', () => {
  const s = makeSite();
  try {
    s.write('family/okafor.html', s.read('family/okafor.html').replace(`<p>${say('stylised-art')}</p>`, ''));
    const r = lint(s);
    assert.ok(r.errors.some((e) => e.includes('stylised-art on family')), r.errors.join('\n'));
    s.write('family/okafor.html', s.read('family/okafor.html').replace('<header>', `<header><p>${say('stylised-art')}</p>`));
    const ok = lint(s);
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(ok.pending, [], 'every row is enforced today: nothing is pending');
    // a row marked pending (a disclosure claims.json owes and nothing prints yet) is listed, not failed, until --strict
    DISCLOSURES.push({ id: 'synthetic-voice', surface: 'gallery', level: 'pending' });
    try {
      assert.ok(lint(s).pending.some((p) => p.startsWith('synthetic-voice on gallery')), 'owed and not printed: pending');
      assert.deepEqual(lint(s).errors, []);
      assert.ok(lint(s, true).errors.some((e) => e.startsWith('synthetic-voice on gallery')), '--strict makes it an error');
    } finally { DISCLOSURES.pop(); }
    // printed today on every kind of page, so a page without it is an error
    for (const rel of ['index.html', '404.html', 'homes/newcrest.html', 'family/okafor.html']) {
      const t = makeSite();
      try {
        t.write(rel, t.read(rel).replace(say('launch-not-offer'), ''));
        assert.ok(lint(t).errors.some((e) => e.startsWith('launch-not-offer on')), `${rel} without launch-not-offer is an error`);
      } finally { done(t); }
    }
  } finally { done(s); }
});

test('every disclosure the table names exists in claims.json, once per surface', () => {
  const ids = new Set(claims.disclosures.map((d: { id: string }) => d.id));
  for (const o of DISCLOSURES) assert.ok(ids.has(o.id), `${o.id} is not in claims.json`);
  assert.equal(new Set(DISCLOSURES.map((o) => `${o.id}|${o.surface}`)).size, DISCLOSURES.length, 'no duplicate row');
});

test('the readable text of a page, its headings and its title and JSON-LD', () => {
  const html = '<html><head><title>Okafor &amp; sons</title><script type="application/ld+json">{"@type":"WebPage","name":"A quiet house","url":"https://x.test/a b"}</script></head><body><h2>Meet The Okafor Family Today</h2><img alt="A kitchen" src="a.jpg"><p>Hello &quot;there&quot;.</p></body></html>';
  const r = readable(html);
  assert.equal(r.text, 'Meet The Okafor Family Today Hello "there".');
  assert.deepEqual(r.attrs, ['A kitchen']);
  assert.deepEqual(headCopy(html), ['Okafor & sons', 'A quiet house']);
  assert.equal(headingProblems(r.headings, new Set(['Okafor'])).length, 1, 'a heading in title case is caught');
  assert.deepEqual(headingProblems(['Meet the Companion Core'], new Set()), []);
});

test('the string finder reads copy, markup text and attributes, and leaves code, selectors, class lists, URLs and error messages alone', () => {
  const src = [
    'import { a } from "./not copy at all.ts";',
    'const sel = document.querySelector(".vh-end .vh-end-title");',
    'const cls = "btn btn-primary wide";',
    'throw new Error("The hook is not here, so the tour cannot start");',
    'console.warn("Something went wrong in the player today.");',
    'const url = "https://ci.computer/core";',
    'const label = "Buy Companion Core";',
    'const html = `<h2 id="t">Meet the Companion Core.</h2><p class="x">The small computer on the desk is a Core. ${name} lives here.</p><button aria-label="Close the About panel">x</button>`;',
    'interface Props { title: "A type is not copy at all" }',
    'el.setAttribute("aria-label", "A label set by a call is copy");',
  ].join('\n');
  const got = sourceStrings('probe.ts', src).map((x) => x.text);
  assert.ok(got.includes('Buy Companion Core') && got.includes('Meet the Companion Core.') && got.includes('Close the About panel'), got.join(' | '));
  assert.ok(got.some((t) => t.startsWith('The small computer on the desk is a Core.')));
  assert.ok(got.includes('A label set by a call is copy'), 'the value set by setAttribute is read, the attribute name is not');
  for (const bad of ['not copy at all', 'vh-end', 'btn btn-primary', 'The hook is not here', 'Something went wrong', 'ci.computer', 'A type is not copy', 'aria-label']) assert.ok(!got.some((t) => t.includes(bad)), `${bad} is not copy`);
  assert.deepEqual(copiesOf('<p>One more line here.</p><style>.a{color:red}</style>'), [], 'a stylesheet is not copy');
  assert.deepEqual(copiesOf('Play or pause'), ['Play or pause']);
});

test('the extra rules: a cloud gaming service and "sorts the photos" are warnings in the lint, the held no-account claim is an error, and a rule claims.json carries wins', () => {
  assert.deepEqual(EXTRA_BANS.filter((b) => b.severity !== 'warn').map((b) => b.id), ['held-no-account'], 'only the held claim is an error; the caveats are warnings');
  assert.ok(new RegExp(EXTRA_BANS.find((b) => b.id === 'held-no-account')!.pattern, 'i').test('Set up without an account and no activation needed.') && !/\bno (?:vendor )?account (?:needed|required)/i.test('no accounting advice'));
  assert.deepEqual(withExtraBans([{ id: 'cap-cloud-gaming' }], (e) => ({ id: e.id })).map((r) => r.id).sort(), ['cap-cloud-gaming', ...EXTRA_BANS.map((b) => b.id).filter((i) => i !== 'cap-cloud-gaming')].sort());
  const s = makeSite({ tourBody: 'Steve cancelled his cloud gaming plan, and Immich sorts your photos.' });
  try {
    const r = lint(s);
    assert.deepEqual(r.errors, []);
    assert.ok(r.warnings.some((w) => w.includes('cap-cloud-gaming')) && r.warnings.some((w) => w.includes('cap-photo-sorting')), r.warnings.join('\n'));
  } finally { done(s); }
  const held = makeSite({ tourBody: 'Ada sets it up without an account.' });
  try { assert.ok(lint(held).errors.some((e) => e.includes('held-no-account'))); } finally { done(held); }
});

test('copyReport runs the lint and the app check over a site and a folder of families, and reports in three lists', () => {
  const s = makeSite();
  try {
    const rep = copyReport({ dir: s.dir, families: path.join(ROOT, 'test', 'fixtures', 'site', 'families') });
    assert.ok(Array.isArray(rep.errors) && Array.isArray(rep.warnings) && Array.isArray(rep.pending));
  } finally { done(s); }
});

// ---- the validator's side: the sentence form of age-chat and the "replaces" chips
const FIX = path.join(ROOT, 'test', 'fixtures', 'stories');
const WORLD = path.join(FIX, 'world');
const fx = loadContext(ROOT, { world: WORLD });
const exemplar = (): Story => JSON.parse(fs.readFileSync(path.join(FIX, 'exemplar.json'), 'utf8'));

test('age-chat reads a sentence too: a child at the keyboard of a chat app is caught when the beat\'s member is an adult', () => {
  const v3 = (s: Story): Story => { s.beats.find((b) => b.id === 'living-photos')!.service = 'google-photos'; s.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3' } as Story['members'][number]); return s; };
  const make = (body: string): Story => {
    const s = v3(exemplar()); const b = s.beats.find((x) => x.id === 'garden-plants')!;
    b.member = 'mika'; b.app = { id: 'open-webui', replaces: ['ChatGPT'] } as typeof b.app; b.popup.chips = ['Open WebUI', 'replaces ChatGPT']; b.popup.body = body; return s;
  };
  const bad = validateStory(make('Otto asks Open WebUI why ice floats, and the model runs on the Core.'), fx);
  assert.ok(bad.errors.some((f) => f.rule === 'age-chat' && f.at === 'garden-plants' && /Otto is 9/.test(f.message)), 'a v3 family: an error');
  const led = validateStory(make('Mika asks a model on the Core in Open WebUI to explain fractions, and reads the answer aloud to Otto at the table.'), fx);
  assert.equal(led.errors.some((f) => f.rule === 'age-chat'), false, 'the adult asks and the child listens: fine');
  const watching = validateStory(make('Otto watches while Mika asks Open WebUI why ice floats.'), fx);
  assert.equal(watching.errors.some((f) => f.rule === 'age-chat'), false, 'a child who watches is not at the keyboard');
  const old = make('Otto asks Open WebUI why ice floats.'); delete (old.beats.find((b) => b.id === 'living-photos') as { service?: string }).service;
  const r = validateStory(old, fx);
  assert.equal(r.errors.some((f) => f.rule === 'age-chat'), false, 'a family not yet told in v3: a warning');
  assert.ok(r.warn.some((f) => f.rule === 'age-chat' && /Otto is 9/.test(f.message)));
});

test('a pass 1 "replaces" chip meets the banned-phrase rules as a warning, a v3 chip at the rule\'s own severity (it used to be skipped)', () => {
  const old = exemplar(); const b = old.beats.find((x) => x.id === 'garden-plants')!;
  b.app = { id: 'open-webui', replaces: ['ChatGPT'] } as typeof b.app; b.popup.chips = ['Open WebUI', 'replaces ChatGPT'];
  const r = validateStory(old, fx);
  assert.equal(r.errors.some((f) => f.rule === 'cap-parity'), false);
  assert.ok(r.warn.some((f) => f.rule === 'cap-parity' && f.at === 'garden-plants.chip1'), 'the parity rule now reads the chip');
  old.beats.find((x) => x.id === 'living-photos')!.service = 'google-photos';
  assert.ok(validateStory(old, fx).errors.some((f) => f.rule === 'cap-parity' && f.at === 'garden-plants.chip1'), 'in a v3 family it is an error');
});
