#!/usr/bin/env -S node --experimental-strip-types
// The front page's counts are words, written from the data when the portal is built (scripts/portal-front.mts heroCount, scripts/story/lib/lander.mts countLine),
// and never typed in index.html: a typed "thirty" or a figure would go stale the day a home is added. Held here without a browser or a built site: the word for a
// count, the sentences the page writes from it, and that the source page holds no spelled count and no figure (the build refuses one: step 5b of
// scripts/build-portal.mts). Needs `pnpm run build` (portal-pages imports assets/home-names.js). Pure Node.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';
import { capital, numberWord } from './portal-pages.mts';
import { countLine, familiesWord } from './story/lib/lander.mts';
import { heroCount } from './portal-front.mts';

test('a count is written in words: thirty, thirty-six, ninety-nine, and digits from a hundred', () => {
  assert.equal(numberWord(30), 'thirty');
  assert.equal(numberWord(36), 'thirty-six');
  assert.equal(numberWord(41), 'forty-one');
  assert.equal(numberWord(99), 'ninety-nine');
  assert.equal(numberWord(100), '100');
  assert.equal(capital(numberWord(36)), 'Thirty-six');
});

test('the sentences the page writes from a count carry the word, never a digit, and move with the data', () => {
  assert.equal(heroCount(30), 'Thirty fictional families show the service each app is an alternative to.');
  assert.equal(heroCount(31), 'Thirty-one fictional families show the service each app is an alternative to.');
  assert.equal(familiesWord(20), 'Twenty fictional families');
  assert.equal(countLine(30, 36), 'Thirty fictional families in thirty-six homes.');
  assert.equal(countLine(31, 37), 'Thirty-one fictional families in thirty-seven homes.');
  for (const s of [heroCount(30), countLine(30, 36), countLine(30, 30), countLine(30, 36, 8)]) assert.ok(!/\d/.test(s), s);
});

test('index.html is a source with no typed count and no figure: the counts come from the data', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!/\bdata-stat=/.test(html), 'no data-stat figure');
  const body = html.slice(html.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, ' ');
  assert.ok(!/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|(?:twen|thir|for|fif|six|seven|eigh|nine)ty(?:-\w+)?|(?:thir|four|fif|six|seven|eigh|nine)teen) (?:fictional |homes?\b|famil)/i.test(body), 'no spelled count');
  // the markers the build fills with the words are there
  for (const m of ['lander-hero-count', 'lander-count', 'lander-swap', 'lander-proof']) assert.ok(html.includes(`<!-- ${m}:`), `the ${m} marker`);
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8')).houses as unknown[];
  assert.ok(index.length >= 30, `${index.length} homes in the index`);
});
