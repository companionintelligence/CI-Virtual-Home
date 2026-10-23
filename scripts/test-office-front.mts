#!/usr/bin/env -S node --experimental-strip-types
// The draft /office page (scripts/office/, reference/office/office-contract-m0.md): the cards are the fixtures' and hold the same rules as a company's story (the store's own pairs, never
// a held one, never "replaces"; a name that is no stock example; the claims' words), the pages carry what every page of the site carries (one h1, one main, the four company links, the
// label, no digit in a count), the filter script's pure parts keep a campaign's tags byte for byte, and, above all, THE OFFICE IS NOT PUBLIC: a build without --offices has no office file and
// no switcher, the same build with it changes only the pages the switcher is injected into and adds five files, and a build for the public site (--strict-families) refuses the flag.
// Needs `pnpm run build`. The builds take about ten seconds each.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { loadCompanyContext } from './story/lib/co/context.mts';
import { CARD_LIMITS, cardProblems, companiesLine, loadCards, officesWord, readFixtures, scopeLineOf, type CardFixture } from './office/data.mts';
import { companyPage, officePage, SWITCH_CSS, companyTitle, companyDescription, officeDescription, OFFICE_TITLE } from './office/pages.mts';
import { injectSwitcher } from './office/site.mts';
import { homePage, LINKS, notFoundPage } from './portal-pages.mts';
import { officeFinePrint, owedIds } from './office/fine-print.mts';
import { FICTIONAL_COMPANY_LINE } from './story/lib/co/consts.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const ctx = loadCompanyContext(ROOT);
const { cards, problems } = loadCards(ROOT);
const fixtures = (): CardFixture[] => structuredClone(readFixtures(path.join(ROOT, 'test', 'fixtures', 'site', 'offices')));
const visible = (html: string): string => html.replace(/<head[\s\S]*?<\/head>/, ' ').replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('the two fixture companies make two sound cards, startups first, and nothing is left over', () => {
  assert.deepEqual(problems, []);
  assert.deepEqual(cards.map((c) => c.slug), ['reelwick', 'lintel-and-sill']);
  assert.deepEqual(cards.map((c) => c.size), ['startup', 'small']);
  assert.deepEqual(cards.map((c) => c.scopeLine), ['About six people, all in this office', 'About eleven people, all in this office']);
  for (const c of cards) {
    assert.ok(c.people.length <= CARD_LIMITS.people && c.pairList.length >= CARD_LIMITS.pairs, c.slug);
    assert.ok(c.people.some((p) => p.ownsCore) && c.functionIds.length >= 3, c.slug);
    for (const p of c.pairList) { assert.match(p.line, /^[^,]+, alternative to [^,]+$/); assert.ok(!/replaces/i.test(p.line)); }
  }
});

test('counts are words: one, two, a hundred and ten, never a digit', () => {
  assert.equal(officesWord(1), 'One office'); assert.equal(officesWord(2), 'Two offices'); assert.equal(officesWord(8), 'Eight offices'); assert.equal(officesWord(36), 'Thirty-six offices');
  assert.equal(companiesLine(1), 'One fictional company.'); assert.equal(companiesLine(8), 'Eight fictional companies.');
  assert.equal(scopeLineOf({ scope: 'company', headcount: 6, floor: 6 }), 'About six people, all in this office');
  assert.equal(scopeLineOf({ scope: 'company', headcount: 14, floor: 6 }), 'About fourteen people, six of them in this office');
  assert.equal(scopeLineOf({ scope: 'site', headcount: 90, floor: 22 }), 'One site of a firm of about ninety');
  assert.equal(scopeLineOf({ scope: 'department', headcount: 110, floor: 24 }), 'One department of a firm of about a hundred and ten');
  for (const s of [officesWord(7), companiesLine(7), scopeLineOf({ scope: 'department', headcount: 250, floor: 25 })]) assert.ok(!/\d/.test(s), s);
});

// a defect in a fixture, and what must stop it
const BAD: [string, (f: CardFixture) => void, RegExp][] = [
  ['a stock company name', (f) => { f.name = 'Acme Works'; }, /stock example company/],
  ['a name that holds a service\'s', (f) => { f.name = 'Slack Works'; }, /name of Slack/],
  ['a family\'s slug', (f) => { f.slug = 'brennan'; }, /family's/],
  ['a pair the store does not name', (f) => { f.pairs[0] = { app: 'forgejo', service: 'notion' }; }, /does not pair forgejo with Notion/],
  ['a pair the plan holds back', (f) => { f.pairs[0] = { app: 'open-webui', service: 'chatgpt' }; }, /hold list/],
  ['an app that is not in the catalog', (f) => { f.pairs[0] = { app: 'not-an-app', service: 'github' }; }, /not an app of the catalog/],
  ['a service that is not in the registry', (f) => { f.pairs[0] = { app: 'forgejo', service: 'no-such-service' }; }, /not in content\/story\/services\.json/],
  ['the same pair twice', (f) => { f.pairs[1] = { ...f.pairs[0] }; }, /listed twice/],
  ['a startup of forty', (f) => { f.headcount = 40; }, /told for 3 to 12/],
  ['a medium business told as the company', (f) => { f.size = 'medium'; f.headcount = 90; }, /told as site or department/],
  ['a floor of thirty', (f) => { f.floor = 30; f.headcount = 40; f.size = 'small'; }, /floor 30/],
  ['two people who own the Core', (f) => { f.people[0].ownsCore = true; }, /exactly one person owns the Core/],
  ['a function that is not one', (f) => { (f.people[0] as any).function = 'ceo'; }, /function "ceo"/],
  ['a head count in the tagline\'s place of a Core: an exclamation mark', (f) => { f.tagline = 'Software for independent cinemas on one Core!'; }, /exclamation/],
  ['the word assistant in a title', (f) => { f.people[0].title = 'Executive assistant'; }, /vocab-assistant/],
  ['a compliance word in the story', (f) => { f.story = `${f.story} It keeps the company GDPR compliant.`; }, /sec-compliance/],
  ['a limit that says replaces', (f) => { f.limits[0] = 'Forgejo replaces GitHub for the whole company, with nothing lost.'; }, /co-replaces/],
  ['a wrong schema', (f) => { (f as any).schema = 'family/v1'; }, /schema is/],
  ['an address with a unit', (f) => { f.address.line = 'Unit 2 Maltings Yard'; }, /address/],
];
for (const [what, mutate, re] of BAD) {
  test(`a card is refused for ${what}`, () => {
    const f = fixtures().find((x) => x.slug === 'reelwick')!; mutate(f);
    const p = cardProblems(f, ctx);
    assert.ok(p.some((m) => re.test(m)), `${what}: expected ${re}, got ${JSON.stringify(p)}`);
  });
}
test('the fixtures are sound as they are', () => { for (const f of fixtures()) assert.deepEqual(cardProblems(f, ctx), [], f.slug); });

test('/office: one h1 and one main, the label, the four links, a card for each company in order, no digit in a count, noindex', () => {
  const html = officePage(cards), text = visible(html);
  assert.equal((html.match(/<h1\b/g) || []).length, 1); assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.match(html, /<p class="fiction-label" data-fine="fictional-company">Fictional company\. Real software\.<\/p>/);
  assert.ok(text.includes(FICTIONAL_COMPANY_LINE));
  for (const url of [LINKS.site, LINKS.core, LINKS.download, LINKS.docs, LINKS.privacy, LINKS.terms]) assert.ok(html.includes(`href="${url}"`), url);
  assert.deepEqual([...html.matchAll(/<li class="card card-family card-company" data-slug="([^"]+)"/g)].map((m) => m[1]), cards.map((c) => c.slug));
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/); assert.ok(!/<link rel="canonical"/.test(html));
  assert.match(html, /<h1 id="office-title">Two offices\. Each with a fictional company and a Companion Core\.<\/h1>/);
  assert.ok(!/replaces/i.test(text), 'no "replaces" anywhere on the page');
  for (const piece of [officesWord(2), companiesLine(2), ...cards.map((c) => c.scopeLine)]) assert.ok(!/\d/.test(piece), piece);
  assert.ok(!/\d/.test(html.match(/<div class="homes-head">[\s\S]*?<\/div>/)![0].replace(/<[^>]+>/g, '')), 'the count line has no digit');
  // every URL is relative, and none names index.html
  assert.ok(!/(?:href|src)="\/(?!\/)/.test(html)); assert.ok(!/href="[^"]*index\.html/.test(html));
  assert.ok(html.length < 40000);
  // the controls are disabled until the script runs, and the page says what it needs: the filters are the script's, the cards are not
  assert.match(html, /<input type="search" id="q" disabled /); assert.match(html, /<noscript><p class="empty">Search and the filters need JavaScript\. Every company is listed here\.<\/p><\/noscript>/);
  assert.ok(OFFICE_TITLE.length <= 60 && officeDescription(2).length <= 160, 'title and description fit a search result');
  // the sizes: one button for each, the empty one disabled for good once the script has counted; the jobs: only the functions some company has
  assert.deepEqual([...html.matchAll(/<button type="button" data-size="([a-z]*)"/g)].map((m) => m[1]), ['', 'startup', 'small', 'medium']);
  assert.deepEqual([...html.matchAll(/<button type="button" class="tag job" data-fn="([a-z]+)"/g)].map((m) => m[1]), ['owner', 'finance', 'sales', 'engineering', 'design', 'projects', 'people', 'legal'], 'in the order of content/story/functions.json');
});

test('a company\'s page: the label first, its long line, the people, the pairs as the store names them, what stays out there, and no tour it has not got', () => {
  for (const [i, c] of cards.entries()) {
    const html = companyPage(c, cards[i - 1], cards[i + 1]), text = visible(html);
    assert.equal((html.match(/<h1\b/g) || []).length, 1); assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.match(html, new RegExp(`<h1 id="company-title">${c.name.replace(/&/g, '&amp;')}</h1>`));
    assert.match(html, /<p class="fiction-label" data-fine="fictional-company">Fictional company\. Real software\.<\/p>/);
    assert.ok(text.includes(`${c.name} is a fictional company. The people in it are characters, not customers. The software is real.`), 'the approved long line, with the name');
    for (const p of c.pairList) assert.ok(text.includes(p.line), p.line);
    for (const l of c.limits) assert.ok(text.includes(l), l);
    for (const p of c.people) assert.ok(html.includes(`id="${p.id}"`));
    assert.ok(!/room-creator|Take the tour/.test(html), 'there is no tour to take yet');
    assert.ok(html.includes('href="https://ci.computer/core"') && !/https:\/\/ci\.computer\/core[?#]/.test(html));
    assert.ok(companyTitle(c).length <= 60 && companyDescription(c).length <= 160 && companyDescription(c).includes(FICTIONAL_COMPANY_LINE));
    assert.ok(!/replaces/i.test(text));
    assert.match(html, new RegExp(`<main id="main" class="company-page" data-company="${c.name.replace(/&/g, '&amp;')}">`));
  }
  assert.ok(companyPage(cards[0], undefined, cards[1]).includes('Next company: Lintel &amp; Sill'));
  assert.ok(companyPage(cards[1], cards[0], undefined).includes('Previous company: Reelwick'));
});

test('the fine print is claims.json\'s words, from a table of the office\'s own', () => {
  const claims = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'claims.json'), 'utf8'));
  const text = (id: string): string => claims.disclosures.find((d: any) => d.id === id).text;
  for (const surface of ['office-fold', 'office-footer', 'company-fold', 'company-footer'] as const) {
    const { items } = officeFinePrint(surface, { agents: true });
    assert.deepEqual(items.map((i) => i.id), owedIds(surface, { agents: true }));
    for (const i of items) assert.equal(i.text, text(i.id), `${surface}: ${i.id} is claims.json's word for word`);
  }
  assert.deepEqual(owedIds('office-fold'), ['fictional-company']);
  assert.deepEqual(owedIds('company-footer'), ['launch-not-offer', 'scripted-scenes', 'names-logos-owners', 'third-party-apps', 'apps-availability']);
  assert.ok(owedIds('company-footer', { agents: true }).includes('attribution-agents'));
});

test('the switcher: both links, the current section marked, in a page that has no Homes link, in one that has, and never twice', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = injectSwitcher(index, { up: './', current: 'homes', page: true })!;
  assert.equal((a.match(/class="nav-homes"/g) || []).length, 1); assert.equal((a.match(/class="nav-offices"/g) || []).length, 1);
  assert.match(a, /<a class="nav-homes" href="\.\/#homes" data-campaign aria-current="page">Homes<\/a>\s*<a class="nav-offices" href="\.\/office" data-campaign>Offices<\/a>/);
  assert.ok(a.indexOf('nav-homes') < a.indexOf('nav-docs'), 'the switcher comes first in the nav');
  assert.ok(a.includes(`<style data-office-switch>${SWITCH_CSS}</style>\n</head>`));
  const home = homePage({ id: 'aurora', name: 'Aurora', style: 'A villa', storeys: 3, areaSqm: 336 }, 'https://homes.ci.computer/');
  const h = injectSwitcher(home, { up: '../', current: 'homes', page: false })!;
  assert.equal((h.match(/class="nav-homes"/g) || []).length, 1, 'the Homes link a home page has is replaced, not added to');
  assert.match(h, /<a class="nav-homes" href="\.\.\/#homes" data-campaign aria-current="true">Homes<\/a>\s*<a class="nav-offices" href="\.\.\/office" data-campaign>Offices<\/a>/);
  assert.equal(injectSwitcher('<html><head></head><body>no nav</body></html>', { up: './', current: 'homes', page: true }), null, 'a page with no header nav is reported, not guessed at');
  assert.equal(injectSwitcher('<nav class="site-nav" aria-label="Site"></nav>', { up: './', current: 'homes', page: true }), null, 'and one with no head');
  assert.ok(notFoundPage('https://homes.ci.computer/', 'thirty-six').includes('See the virtual homes'), 'the 404 button the build puts the offices beside');
});

test('the filter script: the state of an address, a campaign\'s tags kept byte for byte, what a card matches, and counts in words', () => {
  const sandbox: any = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'scripts', 'office', 'assets', 'office.js'), 'utf8'), sandbox, { filename: 'office.js' });
  const { parseState, writeSearch, matches, word } = sandbox.window.CIOffice;
  assert.deepEqual({ ...parseState('?q=forge+it&size=startup&fn=build&utm_source=a') }, { q: 'forge it', size: 'startup', fn: 'build' });
  assert.deepEqual({ ...parseState('') }, { q: '', size: '', fn: '' });
  assert.deepEqual({ ...parseState('?q=a&q=b&size') }, { q: 'a', size: '', fn: '' }, 'the first value of each; a bare key is empty');
  assert.deepEqual({ ...parseState('?q=%E0%A4%A') }, { q: '%E0%A4%A', size: '', fn: '' }, 'a bad escape is kept as it is, not thrown');
  const tags = '?utm_source=news%20letter&utm_medium=email&gclid=Cj0K+x&fbclid=1';
  assert.equal(writeSearch(tags, { q: '', size: '', fn: '' }), tags, 'nothing of ours: the address is the same bytes');
  assert.equal(writeSearch(tags, { q: 'forge it', size: 'startup', fn: '' }), `${tags}&q=forge%20it&size=startup`, 'ours are appended; the campaign\'s are untouched and in order');
  assert.equal(writeSearch(`${tags}&q=old&size=small`, { q: '', size: 'startup', fn: 'build' }), `${tags}&size=startup&fn=build`, 'ours are replaced, never doubled');
  assert.equal(writeSearch('?q=old', { q: '', size: '', fn: '' }), '');
  const card = { find: 'reelwick software for independent cinemas ostley wick forgejo github', size: 'startup', fn: ['owner', 'engineering'] };
  assert.equal(matches(card, { q: '', size: '', fn: '' }), true);
  assert.equal(matches(card, { q: 'forgejo cinemas', size: '', fn: '' }), true, 'every word, in any order');
  assert.equal(matches(card, { q: 'forgejo slack', size: '', fn: '' }), false);
  assert.equal(matches(card, { q: '', size: 'small', fn: '' }), false);
  assert.equal(matches(card, { q: '', size: 'small', fn: '' }, 'size'), true, 'skip leaves one filter out, to count what a button would show');
  assert.equal(matches(card, { q: '', size: '', fn: 'design' }), false);
  assert.equal(matches(card, { q: '', size: 'startup', fn: 'engineering' }), true);
  assert.deepEqual([0, 1, 2, 11, 19, 20, 36, 99].map(word), ['zero', 'one', 'two', 'eleven', 'nineteen', 'twenty', 'thirty-six', 'ninety-nine']);
});

test('the sheet is balanced and the script has no network, no storage and no wall clock', () => {
  const css = fs.readFileSync(path.join(ROOT, 'scripts', 'office', 'assets', 'office.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'a stray brace once dropped a whole stylesheet\'s box-sizing');
  assert.ok(!/@import|url\(["']?https?:|\/\/fonts\.|expression\(/.test(css));
  const js = fs.readFileSync(path.join(ROOT, 'scripts', 'office', 'assets', 'office.js'), 'utf8');
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|Date\.now|new Date|Math\.random|eval|import\()/.test(js.replace(/\/\/.*$/gm, '')), 'plain, local, deterministic');
  assert.ok(!/\breplaces\b/i.test(css + js));
});

// ---- THE OFFICE IS NOT PUBLIC: the flag, the output of a build without it, and the output of a build with it
const build = (out: string, ...flags: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'build-portal.mts'), '--out', out, ...flags], { encoding: 'utf8', cwd: ROOT });
const files = (dir: string, rel = ''): string[] => fs.readdirSync(path.join(dir, rel)).flatMap((n) => { const r = rel ? `${rel}/${n}` : n; return fs.statSync(path.join(dir, r)).isDirectory() ? files(dir, r) : [r]; }).sort();
const sha = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const OFFICE_FILES = ['office.html', 'company/reelwick.html', 'company/lintel-and-sill.html', 'portal/office.css', 'portal/office.js'];

test('a build for the public site refuses the flag before it does any work (--strict-families, CI_STORY_STRICT=1), and a stray value switches nothing on', () => {
  const out = path.join(os.tmpdir(), `office-refused-${process.pid}`);
  const strict = build(out, '--offices', '--strict-families');
  assert.equal(strict.status, 1); assert.match(strict.stderr, /the office pages are not public/); assert.ok(!fs.existsSync(out), 'no output directory was made');
  const env = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'build-portal.mts'), '--out', out, '--offices'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, CI_STORY_STRICT: '1' } });
  assert.equal(env.status, 1); assert.ok(!fs.existsSync(out));
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'build-portal.mts'), 'utf8');
  assert.ok(!/process\.env\.[A-Z_]*OFFICE/i.test(src), 'no environment variable turns the office on: only the flag does');
  assert.ok(src.includes("args.offices === 'true'"), 'only the exact flag');
  // and the workflows build the public site without it
  for (const wf of ['ci.yml', 'deploy.yml']) assert.ok(!/--offices|offices/i.test(fs.readFileSync(path.join(ROOT, '.github', 'workflows', wf), 'utf8')), `${wf} does not know the office`);
});

test('without --offices: no office file, no switcher; with it: five files more, the switcher in the pages of the homes and nothing else changed; a default build clears a flagged one', { timeout: 240000 }, () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'office-builds-'));
  const off = path.join(base, 'off'), on = path.join(base, 'on');
  const a = build(off); assert.equal(a.status, 0, a.stdout + a.stderr);
  const b = build(on, '--offices'); assert.equal(b.status, 0, b.stdout + b.stderr);
  assert.match(b.stdout, /offices: 2 cards on office\.html and 2 company pages/);

  const A = files(off), B = files(on);
  for (const f of OFFICE_FILES) { assert.ok(!A.includes(f), `${f} is in a build without the flag`); assert.ok(B.includes(f), `${f} is not in a build with it`); }
  assert.deepEqual(B.filter((f) => !A.includes(f)), [...OFFICE_FILES].sort(), 'the flagged build has five files more and no others');
  assert.deepEqual(A.filter((f) => !B.includes(f)), [], 'and loses none');
  for (const f of A.filter((x) => x.endsWith('.html'))) {
    const t = fs.readFileSync(path.join(off, f), 'utf8');
    assert.ok(!/nav-offices|data-office-switch|portal\/office\.(?:css|js)|href="\.\.?\/office"/.test(t), `${f} (no flag) knows the office`);
  }
  // what changed between the two: exactly the pages the switcher goes into, and nothing else
  const changed = A.filter((f) => sha(path.join(off, f)) !== sha(path.join(on, f)));
  const injected = A.filter((f) => f === 'index.html' || f === '404.html' || /^(homes|family)\/[^/]+\.html$/.test(f));
  assert.deepEqual(changed, injected, 'only the pages that carry a header changed');
  assert.ok(injected.length >= 70, `${injected.length} pages`);
  for (const f of ['sitemap.xml', 'robots.txt', '_headers', 'room-creator.html']) assert.equal(sha(path.join(off, f)), sha(path.join(on, f)), `${f} is the same bytes with the flag`);
  assert.ok(!/office|company/i.test(fs.readFileSync(path.join(on, 'sitemap.xml'), 'utf8') + fs.readFileSync(path.join(on, 'robots.txt'), 'utf8')), 'nothing of the office is in the sitemap or robots.txt');
  for (const f of injected) {
    const t = fs.readFileSync(path.join(on, f), 'utf8');
    if (f === '404.html') { assert.ok(t.includes('See the virtual offices')); continue; }
    assert.equal((t.match(/class="nav-offices"/g) || []).length, 1, f); assert.equal((t.match(/class="nav-homes"/g) || []).length, 1, f);
    assert.equal((t.match(/data-office-switch/g) || []).length, 1, f);
    // the same four links, the same count of everything else: the rest of the page is the page
    const stripped = t.replace(/<style data-office-switch>[\s\S]*?<\/style>\n/, '').replace(/<a class="nav-homes"[^>]*>Homes<\/a>\s*<a class="nav-offices"[^>]*>Offices<\/a>/, '');
    const original = fs.readFileSync(path.join(off, f), 'utf8').replace(/<a class="nav-homes"[^>]*>Homes<\/a>/, '');
    assert.equal(stripped.replace(/\s+/g, ' '), original.replace(/\s+/g, ' '), `${f}: with the switcher taken out it is the page of the build without the flag`);
  }
  // the office pages themselves
  const office = fs.readFileSync(path.join(on, 'office.html'), 'utf8');
  assert.match(office, /<link rel="stylesheet" href="\.\/portal\/gallery\.css\?v=[0-9a-f]{10}">/); assert.match(office, /<script src="\.\/portal\/office\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/);
  assert.match(fs.readFileSync(path.join(on, 'company', 'reelwick.html'), 'utf8'), /<script src="\.\.\/portal\/campaign\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/);

  // a default build over a flagged one clears the office (OWNED)
  const c = build(on); assert.equal(c.status, 0, c.stdout + c.stderr);
  const C = files(on);
  assert.deepEqual(C, A, 'the output folder holds exactly what a build without the flag makes: office.html, company/ and portal/ were all cleared');
  for (const f of A) assert.equal(sha(path.join(on, f)), sha(path.join(off, f)), `${f} is the same bytes as a build that never had the flag`);
  fs.rmSync(base, { recursive: true, force: true });
});
