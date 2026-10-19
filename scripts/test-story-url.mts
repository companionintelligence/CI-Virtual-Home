#!/usr/bin/env -S node --experimental-strip-types
// The tour's address parsing (assets/story/url.ts), in Node: ?beat= and ?member= (where "Start with <name>" opens the tour: the first beat of a
// person's own room), the parameters the player and the tour do not own (a campaign's tags survive the player's rewriting of the address), the
// player's address for a family, and the family "Next family" opens. Pure: no browser, no network, no built site. The tour itself, in a browser, is
// scripts/story/portal-tests/player.mts (`pnpm run portal:test -- --only hooks`).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OWN_PARAMS, beatFromQuery, memberChapter, memberBeat, memberFromQuery, foreignParams, tourHref, nextTour } from '../assets/story/url.ts';
import { ROOT, storyFiles, readJson } from './story/site-lib.mts';

const q = (s: string): URLSearchParams => new URLSearchParams(s);
// the shape of a flagship family: the first run is everyone's; John has a beat in the living room before his own room; Steve's kitchen beat is shared
const chapters = [
  { id: 'ftue', kind: 'ftue' }, { id: 'office', kind: 'room' }, { id: 'living', kind: 'room' }, { id: 'kitchen', kind: 'room' },
  { id: 'suite', kind: 'room' }, { id: 'steve', kind: 'room' }, { id: 'garden', kind: 'outside' }, { id: 'outro', kind: 'outro' },
];
const beats = [
  { id: 'ftue-hello', chapter: 'ftue', member: 'sally' }, { id: 'ftue-plug', chapter: 'ftue' },
  { id: 'office-plan', chapter: 'office', member: 'sally' }, { id: 'office-paper', chapter: 'office', member: 'sally' },
  { id: 'living-scene', chapter: 'living', member: 'john' }, { id: 'living-film', chapter: 'living', member: 'steve' },
  { id: 'kitchen-list', chapter: 'kitchen', member: 'sally' }, { id: 'kitchen-rota', chapter: 'kitchen', member: 'steve' },
  { id: 'suite-code', chapter: 'suite', member: 'john' }, { id: 'suite-repos', chapter: 'suite', member: 'john' },
  { id: 'steve-play', chapter: 'steve', member: 'steve' }, { id: 'steve-photos', chapter: 'steve', member: 'steve' },
  { id: 'garden-beds', chapter: 'garden', member: 'jean' }, { id: 'outro-street', chapter: 'outro' },
];
const members = [{ id: 'sally' }, { id: 'john' }, { id: 'steve' }, { id: 'jean' }, { id: 'baby' }];

test('?beat= is an id, or a 1-based number; anything else is no beat', () => {
  assert.equal(beatFromQuery(q('beat=office-paper'), beats), 3);
  assert.equal(beatFromQuery(q('beat=1'), beats), 0);
  assert.equal(beatFromQuery(q('beat=14'), beats), 13);
  assert.equal(beatFromQuery(q('beat=15'), beats), -1);
  assert.equal(beatFromQuery(q('beat=0'), beats), -1);
  assert.equal(beatFromQuery(q('beat=no-such-beat'), beats), -1);
  assert.equal(beatFromQuery(q(''), beats), -1);
});

test("a person's own room is where most of their beats are, never the first run or the closing", () => {
  assert.equal(memberChapter(chapters, beats, 'sally')?.id, 'office');            // (office 2, kitchen 1, first run 1 and not counted)
  assert.equal(memberChapter(chapters, beats, 'john')?.id, 'suite');              // (the living room came first, the suite has more)
  assert.equal(memberChapter(chapters, beats, 'steve')?.id, 'steve');            // (living 1, kitchen 1, his room 2)
  assert.equal(memberChapter(chapters, beats, 'jean')?.id, 'garden');            // (her only beat is outside: that is where she is)
  assert.equal(memberChapter(chapters, beats, 'baby'), null);
  assert.equal(memberChapter(chapters, beats, 'nobody'), null);
  // a tie goes to the earlier chapter
  const tie = [{ id: 'a', chapter: 'office', member: 'x' }, { id: 'b', chapter: 'living', member: 'x' }];
  assert.equal(memberChapter(chapters, tie, 'x')?.id, 'office');
  // a member whose beats are all first-run has no room of their own
  assert.equal(memberChapter(chapters, [{ id: 'h', chapter: 'ftue', member: 'z' }], 'z'), null);
});

test('"Start with <name>" opens at the first beat of that person in their own room', () => {
  assert.equal(memberBeat(chapters, beats, 'sally'), 2);     // office-plan, not ftue-hello
  assert.equal(memberBeat(chapters, beats, 'john'), 8);      // suite-code, not living-scene
  assert.equal(memberBeat(chapters, beats, 'steve'), 10);    // steve-play
  assert.equal(memberBeat(chapters, beats, 'jean'), 12);
  assert.equal(memberBeat(chapters, beats, 'baby'), -1);
});

test('?member= is a member of the family with a beat of their own; an unknown id falls back to the start card', () => {
  assert.equal(memberFromQuery(q('member=john'), members, chapters, beats), 8);
  assert.equal(memberFromQuery(q('member=sally&utm_source=meta'), members, chapters, beats), 2);
  assert.equal(memberFromQuery(q('member=nobody'), members, chapters, beats), -1);
  assert.equal(memberFromQuery(q('member=baby'), members, chapters, beats), -1);
  assert.equal(memberFromQuery(q('member='), members, chapters, beats), -1);
  assert.equal(memberFromQuery(q('member=JOHN'), members, chapters, beats), -1);
  assert.equal(memberFromQuery(q('beat=2'), members, chapters, beats), -1);
});

test("every person of every family file that has beats opens in a room that is not the first run (the shipped files and the test families)", () => {
  const dirs = [path.join(ROOT, 'content', 'families'), path.join(ROOT, 'test', 'fixtures', 'site', 'families')];
  let checked = 0;
  for (const dir of dirs) for (const f of storyFiles(dir)) {
    const s = readJson(path.join(dir, f));
    if (!s || !Array.isArray(s.members) || !Array.isArray(s.beats) || !Array.isArray(s.chapters)) continue;
    for (const m of s.members) {
      const at = memberBeat(s.chapters, s.beats, m.id);
      if (at < 0) continue;
      const kind = s.chapters.find((c: any) => c.id === s.beats[at].chapter)?.kind;
      assert.ok(s.beats[at].member === m.id && kind !== 'ftue' && kind !== 'outro', `${f}: ${m.id} opens at ${s.beats[at].id} (${kind})`);
      checked++;
    }
  }
  assert.ok(checked >= 4, `only ${checked} people checked`);
});

test("the address's other parameters are the campaign's and anything a link carried: they are kept, in order, and the player's and the tour's are not", () => {
  const tags = 'utm_source=meta&utm_medium=paid&utm_campaign=uncloud&utm_content=brennan&utm_term=home&fbclid=A1b2&ttclid=T3&gclid=G4&msclkid=M5';
  assert.deepEqual(foreignParams(`mode=view&house=seraphine&family=brennan&shot=story&t=0.5&tod=day&play=1&beat=suite-code&member=john&${tags}`).map(([k]) => k),
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid', 'msclkid']);
  assert.deepEqual(foreignParams('mode=view&house=x&ref=a&ref=b&no=story'), [['ref', 'a'], ['ref', 'b'], ['no', 'story']]);
  assert.deepEqual(foreignParams(''), []);
  assert.deepEqual(foreignParams(q('fbclid=x%2By')), [['fbclid', 'x+y']]);
});

test("the player's address for a family names the house and the family, is relative, and carries the tags", () => {
  assert.equal(tourHref('room-creator', 'familyhouse-nora', 'brennan-merrow', '?mode=view&house=seraphine&family=brennan&beat=x&utm_source=meta&fbclid=A1'),
    './room-creator?mode=view&house=familyhouse-nora&family=brennan-merrow&utm_source=meta&fbclid=A1');
  assert.equal(tourHref('room-creator.html', 'h', 'f'), './room-creator.html?mode=view&house=h&family=f');
  assert.equal(tourHref('room-creator', 'h', 'f', '', { member: 'john' }), './room-creator?mode=view&house=h&family=f&member=john');
  assert.ok(!/^\/|https?:/.test(tourHref('room-creator', 'h', 'f')), 'a relative address');
});

test('"Next family" is the next one that has a tour, round the end, and none when there is no other', () => {
  const by = { brennan: { house: 'seraphine', story: 's1' }, 'brennan-hollin': { house: 'bgfamily' }, 'brennan-merrow': { house: 'familyhouse-nora', story: 's3' }, okafor: { house: 'aurora', story: 's4' } };
  assert.deepEqual(nextTour(by, 'brennan'), { slug: 'brennan-merrow', house: 'familyhouse-nora' });
  assert.deepEqual(nextTour(by, 'brennan-merrow'), { slug: 'okafor', house: 'aurora' });
  assert.deepEqual(nextTour(by, 'okafor'), { slug: 'brennan', house: 'seraphine' });
  assert.deepEqual(nextTour(by, 'brennan-hollin'), { slug: 'brennan-merrow', house: 'familyhouse-nora' });   // (a family with no tour of its own: the next that has one)
  assert.equal(nextTour({ only: { house: 'h', story: 's' } }, 'only'), null);
  assert.equal(nextTour({}, 'x'), null);
});

test("the list of parameters the player keeps for itself is the tour's list (assets/viewer.ts and assets/story/url.ts)", () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'viewer.ts'), 'utf8');
  const m = src.match(/const OWN_PARAMS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, 'assets/viewer.ts has no OWN_PARAMS');
  const theirs = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.deepEqual([...theirs].sort(), [...OWN_PARAMS].sort());
  // and the one place the player writes its address keeps the rest (a share link does not: it is not the visitor's own ad click)
  assert.ok(/!withT\)\s*new URLSearchParams\(location\.search\)\.forEach\(\(v, k\) => \{ if \(!OWN_PARAMS\.has\(k\)\) q\.append\(k, v\); \}\)/.test(src), 'url() no longer keeps the address\'s other parameters');
});
