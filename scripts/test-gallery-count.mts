#!/usr/bin/env -S node --experimental-strip-types
// The number of homes is written by hand into the gallery (index.html): the heading's and the descriptions' count in words, the hero's two
// figures. scripts/portal-pages.mts galleryCountCopy writes them from the list (pnpm run index), and portal:build holds the file to it.
// Held here without a browser or a built site: the word for a count, the rewrite on a sample and on the real page, and that nothing else moves.
// Needs `pnpm run build` (portal-pages imports assets/home-names.js). Pure Node.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';
import { capital, galleryCountCopy, numberWord } from './portal-pages.mts';

const houses = (n: number, area = 100) => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, areaSqm: area }));
const SAMPLE = `<meta name="description" content="Thirty homes, each with a Companion Core. Take a tour.">
<meta property="og:description" content="Thirty homes, each with a Companion Core. Take a tour.">
<h1 id="hero-title">Thirty homes. Each family's life, on one Companion Core.</h1>
<dd data-stat="homes">30</dd><dd data-stat="area">7,770</dd>
<p>Thirty homes are mentioned in a paragraph too, and stay.</p>`;

test('a count is written in words: thirty, thirty-six, ninety-nine, and digits from a hundred', () => {
  assert.equal(numberWord(30), 'thirty');
  assert.equal(numberWord(36), 'thirty-six');
  assert.equal(numberWord(41), 'forty-one');
  assert.equal(numberWord(99), 'ninety-nine');
  assert.equal(numberWord(100), '100');
  assert.equal(capital(numberWord(36)), 'Thirty-six');
});

test('galleryCountCopy writes the heading, both descriptions and the two figures, and nothing else', () => {
  const out = galleryCountCopy(SAMPLE, houses(36, 250));
  assert.ok(out.includes('<meta name="description" content="Thirty-six homes, each'));
  assert.ok(out.includes('<meta property="og:description" content="Thirty-six homes, each'));
  assert.ok(out.includes('<h1 id="hero-title">Thirty-six homes. Each family\'s'));
  assert.ok(out.includes('<dd data-stat="homes">36</dd>'));
  assert.ok(out.includes('<dd data-stat="area">9,000</dd>'), 'floor area is rounded to 10 m², as gallery.js does');
  assert.ok(out.endsWith('<p>Thirty homes are mentioned in a paragraph too, and stay.</p>'), 'a paragraph that happens to say it is not copy this owns');
  assert.equal(out.split('\n').length, SAMPLE.split('\n').length);
});

test('it is idempotent, and a count that grows or shrinks is followed', () => {
  for (const n of [1, 12, 30, 36, 47, 99, 120]) {
    const once = galleryCountCopy(SAMPLE, houses(n));
    assert.equal(galleryCountCopy(once, houses(n)), once, `${n}: running again changes nothing`);
    assert.ok(once.includes(`<dd data-stat="homes">${n}</dd>`));
    assert.ok(once.includes(`<h1 id="hero-title">${capital(numberWord(n))} homes.`), `${n}: the heading says ${numberWord(n)}`);
    assert.ok(once.includes(`content="${capital(numberWord(n))} homes, each`), `${n}: the descriptions say ${numberWord(n)}`);
  }
  assert.equal(galleryCountCopy('<p>no copy here</p>', houses(36)), '<p>no copy here</p>', 'a page without the copy is returned as it is');
});

test('the real index.html says what content/houses/index.json says (pnpm run index writes it)', () => {
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8')).houses;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(galleryCountCopy(html, list), html, `index.html is not the list's: run pnpm run index (${list.length} homes, "${capital(numberWord(list.length))} homes")`);
});
