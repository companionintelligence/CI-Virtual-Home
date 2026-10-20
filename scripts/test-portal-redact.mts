#!/usr/bin/env -S node --experimental-strip-types
// The site's credit rule (scripts/portal-redact.mts): no builder credit and no mention of the build a home was written from is shown or
// shipped. Held here without a browser or a built site: the redaction of the specs and the list, and the guard portal:build runs over
// the whole output (the handles are read from the specs' `author` fields, the words are "Sims", "Base Game" and "BG "). Pure Node.
// Needs `pnpm run build` (the redaction imports assets/home-names.js).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';
import { GUARD_ALLOW, REDACTED_KEYS, builderHandles, guardOutput, guardTerms, redactIndex, redactSpecText, scanText } from './portal-redact.mts';
import { OWN_AUTHORS, isOwnAuthor } from './own-authors.mts';
import { displayName } from '../assets/home-names.js';

const housesDir = path.join(ROOT, 'content', 'houses');
const index = JSON.parse(fs.readFileSync(path.join(housesDir, 'index.json'), 'utf8'));
const ids: string[] = index.houses.map((h: { id: string }) => h.id);
// the specs on disk: the list must be all of them (a count written here would have to move with every home added)
const specIds = fs.readdirSync(housesDir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'portal-redact-'));
const put = (dir: string, rel: string, text: string): void => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };

test('the allowlist is empty: nothing is exempt from the guard', () => {
  assert.deepEqual(GUARD_ALLOW, []);
});

test('a shipped spec has no author and no source, and the portal\'s name for the home; the rest is the repository\'s, byte for byte', () => {
  assert.deepEqual([...ids].sort(), specIds, 'index.json lists every spec in content/houses/ (pnpm run index)');
  for (const id of ids) {
    const text = fs.readFileSync(path.join(housesDir, `${id}.json`), 'utf8');
    const src = JSON.parse(text);
    assert.ok(src.author && src.source, `${id}: the repository keeps its author and source (internal records)`);
    const red = redactSpecText(text);
    const out = JSON.parse(red.text);
    for (const k of REDACTED_KEYS) assert.ok(!(k in out), `${id}: ${k} is shipped`);
    assert.equal(out.name, displayName({ id, name: src.name }));
    assert.equal(displayName({ id, name: out.name }), out.name, `${id}: the display name is not its own display name`);
    assert.equal(red.reshaped, false, `${id}: the spec was rewritten, not redacted line by line`);
    const { name: _n, ...restOut } = out, { name: _m, author: _a, source: _s, ...restSrc } = src;
    assert.deepEqual(restOut, restSrc, `${id}: something besides name, author and source changed`);
    // the lines it keeps are the repository's lines
    const keep = text.split('\n').filter(l => !/^  "(name|author|source)": /.test(l));
    assert.deepEqual(red.text.split('\n').filter(l => !/^  "name": /.test(l)), keep, `${id}: its bytes moved`);
  }
});

test('a spec that is not shaped line by line is still redacted (parsed and written again)', () => {
  const red = redactSpecText('{"id":"aurora","name":"Base Game Aurora","author":"Ornilia","source":"x","levels":[1.0]}');
  assert.equal(red.reshaped, true);
  const out = JSON.parse(red.text);
  assert.deepEqual(Object.keys(out), ['id', 'name', 'levels']);
  assert.equal(out.name, displayName({ id: 'aurora', name: 'Base Game Aurora' }));
});

test('the shipped list has no author and no source, and every name is a display name', () => {
  const red = redactIndex(index);
  assert.equal(red.houses.length, ids.length);
  for (const h of red.houses) {
    for (const k of REDACTED_KEYS) assert.ok(!(k in h), `${h.id}: ${k} is shipped`);
    assert.equal(displayName(h), h.name);
  }
  assert.ok(index.houses.every((h: any) => h.author && h.source), 'the repository\'s own list keeps them');
});

test('the handles are read from the specs, never listed in the guard', () => {
  const real = builderHandles(ROOT);
  assert.ok(real.length >= 12, `${real.length} handles`);
  // (every author but the company's own name: scripts/own-authors.mts)
  const authors = new Set(ids.map(id => JSON.parse(fs.readFileSync(path.join(housesDir, `${id}.json`), 'utf8')).author).filter(a => !isOwnAuthor(a)));
  assert.deepEqual(real, [...authors].sort());
  const dir = tmp();
  put(dir, 'content/houses/a.json', JSON.stringify({ id: 'a', author: 'ZzHandle99' }));
  put(dir, 'content/houses/a.plan.json', JSON.stringify({ id: 'a', author: 'NotASpec' }));
  put(dir, 'content/houses/index.json', JSON.stringify({ houses: [{ id: 'b', author: 'OnlyInIndex' }] }));
  assert.deepEqual(builderHandles(dir), ['OnlyInIndex', 'ZzHandle99']);
});

test('the company\'s own name is not a builder handle: a home Companion Intelligence wrote itself is credited to it, and every other handle is still guarded', () => {
  assert.deepEqual([...OWN_AUTHORS], ['Companion Intelligence'], 'one name, the company\'s');
  assert.ok(isOwnAuthor('Companion Intelligence') && isOwnAuthor('  companion intelligence ') && isOwnAuthor('COMPANION INTELLIGENCE'), 'matched whole, in any case');
  for (const not of ['ci-original', 'Companion Intelligence Fan', 'Companion', 'Intelligence', 'SimsWithNora', '', undefined, null, 7]) assert.ok(!isOwnAuthor(not), `${String(not)} is not the company`);
  // the apartments are the company's own: their specs name it, and the repository's list keeps it (an internal record, redacted from the output)
  for (const id of ['studio-loft', 'city-one-bed', 'two-bed-flat', 'corner-penthouse', 'garden-flat', 'walkup-duplex']) {
    assert.ok(ids.includes(id), `${id} is in the list`);
    assert.ok(isOwnAuthor(JSON.parse(fs.readFileSync(path.join(housesDir, `${id}.json`), 'utf8')).author), `${id}: authored by the company`);
  }
  const root = tmp();
  put(root, 'content/houses/a.json', JSON.stringify({ id: 'a', author: 'Companion Intelligence' }));
  put(root, 'content/houses/b.json', JSON.stringify({ id: 'b', author: 'ZzHandle99' }));
  put(root, 'content/houses/index.json', JSON.stringify({ houses: [{ id: 'a', author: 'Companion Intelligence' }, { id: 'c', author: 'companion intelligence' }, { id: 'b', author: 'ZzHandle99' }] }));
  assert.deepEqual(builderHandles(root), ['ZzHandle99'], 'the company is read from the files and left out; the builder stays');
  // a page may say the company\'s name (every page does), and a builder\'s handle on the same page is still found
  const out = tmp();
  put(out, 'index.html', '<footer>© 2026 LifeScope Inc., DBA Companion Intelligence. Companion Intelligence</footer>');
  assert.deepEqual(guardOutput(out, root).problems, [], 'the company\'s name on a page is not a finding');
  assert.equal(guardOutput(out, root).handles, 1, 'one handle is guarded');
  put(out, 'homes/b.html', '<p>Companion Intelligence, with ZzHandle99</p>');
  const g = guardOutput(out, root);
  // (the handle, and its letters alone: two findings, both in the one file, and neither about the company)
  assert.ok(g.problems.length >= 1 && g.problems.every(p => p.startsWith('homes/b.html') && !/companion intelligence/i.test(p.split(' ("')[0])), g.problems.join(' | '));
  assert.ok(g.problems[0].includes('ZzHandle99'), g.problems[0]);
  // a root with only the company\'s homes guards no handle (the guard says so; it never reads "Companion Intelligence" as one)
  const only = tmp();
  put(only, 'content/houses/a.json', JSON.stringify({ id: 'a', author: 'Companion Intelligence' }));
  assert.ok(guardOutput(out, only).problems[0].includes('no builder handle'));
});

test('the guard finds a handle (any case, and its letters alone), "Sims", "Base Game" and "BG ", and leaves other text alone', () => {
  const terms = guardTerms(['Schnuck01', 'SimsWithNora']);
  const hit = (s: string): boolean => scanText('x.html', s, terms).length > 0;
  assert.ok(hit('by <b>SimsWithNora</b>'));
  assert.ok(hit('built by simswithnora'));
  assert.ok(hit('"author":"Schnuck01"'));
  assert.ok(hit('thanks to schnuck'));
  assert.ok(hit('a Sims 4 build'));
  assert.ok(hit('The Sims'));
  assert.ok(hit('the Sims cut'));
  assert.ok(hit('from SimsTree slide 4'));
  assert.ok(hit('Base Game Aurora'));
  assert.ok(hit('Cute Basegame Starter'));
  assert.ok(hit('"BG Modern House"'));
  assert.ok(!hit('Aurora, Palm Knoll and the Twin Gable House'));
  assert.ok(!hit('walls: \'sims\''), 'a lower-case identifier is not a credit');
  assert.ok(!hit('background: var(--bg); BGM'), 'BG inside other words and colour names is not the tag');
  assert.ok(!hit('The small computer on your desk runs your own AI'));
  assert.ok(scanText('x.html', 'a "BG " and a Sims', terms).length >= 2, 'one finding per term');
  // an allowlist entry exempts one term in one file, nothing else
  const allowed = [{ file: 'x.html', term: 'the word "Sims"', why: 'test' }];
  assert.equal(scanText('x.html', 'Sims', terms, allowed).length, 0);
  assert.equal(scanText('y.html', 'Sims', terms, allowed).length, 1);
});

test('the guard reads every text file of an output, HTML, JS, JSON, XML, webmanifest and the extensionless ones, and no picture', () => {
  const out = tmp(), root = tmp();
  put(root, 'content/houses/a.json', JSON.stringify({ id: 'a', author: 'ZzHandle99' }));
  put(out, 'index.html', '<p>clean</p>');
  put(out, 'assets/x.js', 'export const a = 1;');
  put(out, 'portal/pic.webp', 'ZzHandle99 in a picture is not text');
  assert.deepEqual(guardOutput(out, root).problems, []);
  for (const [rel, text] of [
    ['index.html', '<span class="credit">by <b>ZzHandle99</b></span>'],
    ['homes/a.html', '<p>After a Sims 4 build</p>'],
    ['assets/y.js', '// Base Game Aurora'],
    ['portal/gallery.css', '/* BG house */'],
    ['content/houses/a.json', '{"name":"Aurora","source":"SimsTree slide 2"}'],
    ['story/families.abc123.json', '{"a":"zzhandle99"}'],
    ['story/manifest.json', '{"x":"The Sims"}'],
    ['sitemap.xml', '<loc>ZzHandle99</loc>'],
    ['portal/site.webmanifest', '{"name":"Base Game"}'],
    ['robots.txt', 'Sims'],
    ['_headers', '# ZzHandle99'],
    ['family/q.html', '<p class="home-credit">Credit: ZzHandle99</p>'],
  ] as const) {
    const o = tmp();
    put(o, rel, text);
    const g = guardOutput(o, root);
    assert.ok(g.problems.length >= 1 && g.problems[0].startsWith(rel), `${rel}: not found (${g.problems.join(' | ')})`);
  }
  assert.ok(guardOutput(out, tmp()).problems[0].includes('no builder handle'), 'with no handles the guard says it guards nothing');
});

test('the repository\'s own sources that ship are clean of the words (comments included): the engine, the pages and the portal scripts', () => {
  const terms = guardTerms(builderHandles(ROOT));
  const files = ['index.html', 'room-creator.html', ...['gallery.js', 'gallery.css', 'site.css', 'family.css', 'viewer.css', 'story.css'].map(f => `portal/${f}`)];
  const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir)).flatMap(n => {
    const r = `${dir}/${n}`;
    if (n === 'vendor') return [];
    return fs.statSync(path.join(ROOT, r)).isDirectory() ? walk(r) : r.endsWith('.ts') && !r.endsWith('.d.ts') ? [r] : [];
  });
  const found = [...files, ...walk('assets')].flatMap(f => (fs.existsSync(path.join(ROOT, f)) ? scanText(f, fs.readFileSync(path.join(ROOT, f), 'utf8'), terms) : []));
  assert.deepEqual(found, []);
});
