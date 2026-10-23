#!/usr/bin/env -S node --experimental-strip-types
// The company gate (scripts/story/lib/co/validate.mts, reached by `pnpm run story:validate -- --kind office`): the synthetic exemplar passes with no finding, and each case below is the exemplar
// plus one change that must stop on exactly its rule. The rules that wait for the buildings and the writers (M1) are listed in the validator's header and in reference/office/office-contract-m0.md.
// Pure Node: no browser, no network. Needs `pnpm run build`.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCompanyContext } from './story/lib/co/context.mts';
import { validateCompany } from './story/lib/co/validate.mts';
import { makeExemplar } from './story/lib/co/exemplar.mts';
import { companyStrings } from './story/lib/co/strings.mts';
import type { CompanyStory } from './story/lib/co/types.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const ctx = loadCompanyContext(ROOT);
const run = (s: unknown) => validateCompany(s, ctx);
const rulesOf = (r: ReturnType<typeof run>): string[] => [...new Set([...r.errors, ...r.review].map((f) => f.rule))].sort();
const familyCompanion = [...ctx.familyCompanions][0];

test('the exemplar has no finding of any kind', () => {
  const r = run(makeExemplar());
  assert.deepEqual([r.errors, r.review, r.warn], [[], [], []]);
  assert.ok(r.stats.beats as number >= 24);
});

test('every string of the exemplar is a string the lint reads, and the lint reads no id or url', () => {
  const s = makeExemplar();
  const strings = companyStrings(s);
  assert.ok(strings.length > 100);
  const all = strings.map(([, t]) => t).join('\n');
  assert.ok(all.includes(s.company.name) && all.includes(s.members[0].title) && all.includes(s.beats[8].popup.title));
  for (const hidden of [s.slug, s.house, 'https://ci.computer/core', s.beats[0].id]) assert.ok(!all.includes(hidden), `${hidden} is not a user-facing string`);
});

type Mut = (s: CompanyStory) => void;
const CASES: [string, Mut, string[]][] = [
  // the shape
  ['a missing tagline', (s) => { delete (s.company as any).tagline; }, ['schema']],
  ['a name with a digit', (s) => { s.company.name = '3M Works'; }, ['schema']],
  ['a family key', (s) => { (s as any).family = {}; }, ['schema']],
  // co-size
  ['a startup of forty', (s) => { s.company.headcount = 40; }, ['co-size']],
  ['a startup told as a site', (s) => { s.company.scope = 'site'; }, ['co-size']],
  ['a medium business told as the company', (s) => { s.company.size = 'medium'; s.company.headcount = 90; s.company.scope = 'company'; }, ['co-size']],
  ['a floor larger than the head count', (s) => { s.company.floor = 8; }, ['co-size']],
  ['a floor of four people for five featured', (s) => { s.company.headcount = 6; s.company.floor = 3; s.members.push({ id: 'ode', name: 'Ode', function: 'support', title: 'Support lead', colour: 'chart-5', ownsCore: false }); }, ['co-members', 'co-size']],
  // co-members
  ['two members of one id', (s) => { s.members[1].id = 'oriel'; }, ['co-companions', 'co-members']],
  ['two members of one name', (s) => { s.members[1].name = 'Oriel'; }, ['co-members']],
  ['a member with two beats', (s) => { s.beats = s.beats.filter((b) => b.id !== 'meet-sketch'); }, ['co-members']],
  ['a first-run beat of another member', (s) => { s.beats[3].member = 'wren'; }, ['co-members']],
  ['a beat of nobody', (s) => { s.beats[8].member = 'nobody'; }, ['co-members']],
  // co-owner
  ['nobody owns the Core', (s) => { s.members[0].ownsCore = false; }, ['co-owner']],
  ['two own the Core', (s) => { s.members[1].ownsCore = true; }, ['co-owner']],
  ['an owner with no work in the Core\'s room, the office or the floor', (s) => { for (const b of s.beats) if (b.member === 'oriel' && b.chapter !== 'day-one') b.member = 'wren'; }, ['co-beats', 'co-owner']],
  // co-companions
  ['a second companion', (s) => { s.members[1].companion = structuredClone(s.members[0].companion); s.members[1].companion!.name = 'Pike'; }, ['co-companions']],
  ['a companion on someone who does not own the Core', (s) => { s.members[1].companion = s.members[0].companion; delete s.members[0].companion; }, ['co-companions']],
  ['an agent with no approval', (s) => { delete s.beats[5].approval; }, ['co-companions']],
  ['a line spoken by someone with no companion', (s) => { s.beats[5].say!.speaker = 'wren'; }, ['co-companions']],
  ['seven scripted lines', (s) => { for (const b of s.beats.slice(6, 13)) b.say = { speaker: 'oriel', text: 'I have drafted it for you.' }; }, ['co-companions']],
  // co-names
  ['a stock company name', (s) => { s.company.name = 'Acme Works'; }, ['co-names']],
  ['a name that holds a service\'s', (s) => { s.company.name = 'Slack Works'; }, ['co-names']],
  ['a family\'s slug', (s) => { s.slug = 'brennan'; }, ['co-names']],
  ['a house id for a slug', (s) => { s.slug = 'aurora'; }, ['co-names']],
  ['a companion a family already has', (s) => { s.members[0].companion!.name = familyCompanion[0].toUpperCase() + familyCompanion.slice(1); }, ['co-names']],
  // co-rooms and co-anchor
  ['a bedroom chapter', (s) => { s.chapters[3].room = 'bedroom'; }, ['co-chapters', 'co-rooms']],
  ['an anchor in the garage', (s) => { s.beats[8].anchor.room = 'garage'; }, ['co-rooms']],
  ['a chain that ends on a couch', (s) => { s.beats[8].anchor = { role: 'couch', room: 'workfloor' }; }, ['co-anchor']],
  // co-chapters
  ['a first chapter that is a room', (s) => { s.chapters[0].kind = 'room'; s.chapters[0].room = 'entry'; }, ['co-chapters']],
  ['an outro that is not last', (s) => { s.chapters.reverse(); }, ['co-chapters']],
  ['no kitchen chapter', (s) => { s.chapters[4].room = 'store'; }, ['co-beats', 'co-chapters']],
  ['no meeting chapter', (s) => { s.chapters[3].room = 'store'; }, ['co-chapters']],
  ['no floor chapter', (s) => { s.chapters[2].room = 'store'; }, ['co-chapters']],
  ['two beats of one id', (s) => { s.beats[9].id = s.beats[8].id; }, ['co-chapters']],
  ['a beat in a chapter the file lacks', (s) => { s.beats[8].chapter = 'nowhere'; }, ['co-chapters']],
  // co-beats
  ['too few room beats', (s) => { s.beats = s.beats.filter((b) => ['day-one', 'your-turn'].includes(b.chapter) || ['comms-vault', 'comms-status', 'floor-code', 'floor-leads', 'floor-screens', 'floor-board', 'floor-chat', 'floor-drive', 'floor-flow', 'meet-list', 'meet-handbook', 'meet-sketch', 'meet-sign', 'kitchen-receipts', 'kitchen-week', 'kitchen-notes', 'front-calendar'].includes(b.id)); }, ['co-beats']],
  ['nothing on the meeting table or the whiteboard', (s) => { for (const b of s.beats) if (['meeting-table', 'whiteboard'].includes(b.anchor.role)) b.anchor = { role: 'room', room: 'meeting' }; }, ['co-beats']],
  ['one beat in the kitchen', (s) => { for (const id of ['kitchen-notes', 'kitchen-week']) s.beats.find((b) => b.id === id)!.chapter = 'floor'; }, ['co-beats']],
  // co-categories
  ['no money anywhere', (s) => { s.beats.find((b) => b.id === 'meet-list')!.category = 'projects'; }, ['co-categories']],
  ['only seven topics', (s) => { for (const b of s.beats) if (!['setup', 'documents', 'communication', 'money', 'it', 'engineering', 'design'].includes(b.category)) b.category = 'documents'; }, ['co-categories']],
  // co-apps and co-pairs
  ['an app that is not in the catalog', (s) => { s.beats[8].app!.id = 'not-an-app'; }, ['co-apps', 'co-pairs']],
  ['an app the catalog marks avoid', (s) => { s.beats[8].with = ['kiwix']; }, ['co-apps']],
  ['a pair the store does not name', (s) => { const b = s.beats.find((x) => x.id === 'floor-chat')!; b.service = 'notion'; b.app!.replaces = ['Notion']; b.popup.chips = ['Campfire', 'alternative to Notion']; }, ['co-pairs']],
  ['a pair on the hold list', (s) => { const b = s.beats.find((x) => x.id === 'floor-leads')!; b.app = { id: 'open-webui', replaces: ['ChatGPT'] }; b.service = 'chatgpt'; b.popup.chips = ['Open WebUI', 'alternative to ChatGPT']; }, ['co-pairs']],
  ['a chip that says replaces', (s) => { s.beats.find((x) => x.id === 'comms-vault')!.popup.chips = ['Vaultwarden', 'replaces 1Password']; }, ['co-pairs', 'co-replaces']],
  ['the word replaces in a story', (s) => { s.beats[8].popup.body = 'The team keeps its repositories on the Core, and the new address replaces the old one in every build.'; }, ['co-replaces']],
  ['a service with no replaces', (s) => { s.beats.find((x) => x.id === 'comms-vault')!.app!.replaces = []; }, ['co-pairs']],
  ['a service that is not in the registry', (s) => { s.beats.find((x) => x.id === 'comms-vault')!.service = 'no-such-service'; }, ['co-pairs']],
  ['a replaces that names another service', (s) => { s.beats.find((x) => x.id === 'comms-vault')!.app!.replaces = ['GitHub']; }, ['co-pairs']],
  ['replaces without a service', (s) => { delete s.beats.find((x) => x.id === 'comms-vault')!.service; }, ['co-pairs']],
  // the claims' words
  ['an exclamation mark', (s) => { s.beats[8].popup.body += ' It works!'; }, ['exclamation']],
  ['the word assistant', (s) => { s.members[0].title = 'Executive assistant'; }, ['vocab-assistant']],
  ['a compliance word', (s) => { s.company.story = 'Fixture Works is made up to test the rules. Four people share one room, and the Core keeps them GDPR compliant in the comms room.'; }, ['sec-compliance']],
  ['a saving', (s) => { s.beats[9].popup.body = 'Wren keeps the leads in one list on the Core and saves two hours a week for the whole team to spend on customers.'; }, ['num-time-saved']],
  ['the word beta', (s) => { s.beats[2].popup.title = 'Plug it in (beta)'; }, ['release-status-beta']],
];
for (const [what, mutate, expected] of CASES) {
  test(`${expected[0]}: ${what}`, () => {
    const s = makeExemplar(); mutate(s);
    assert.deepEqual(rulesOf(run(s)), expected, `${what}: exactly these rules, no more and no fewer`);
  });
}

test('a case that is not a defect stays clean: a medium business told as a department, a site, and a bigger floor', () => {
  const s = makeExemplar();
  s.company.size = 'medium'; s.company.scope = 'department'; s.company.headcount = 110; s.company.floor = 24;
  assert.deepEqual(rulesOf(run(s)), []);
  s.company.scope = 'site'; s.company.headcount = 90;
  assert.deepEqual(rulesOf(run(s)), []);
  const small = makeExemplar(); small.company.size = 'small'; small.company.headcount = 11; small.company.floor = 11;
  assert.deepEqual(rulesOf(run(small)), []);
});

test('the two proposed fixtures names would pass co-names, the stock ones would not', () => {
  for (const name of ['Reelwick', 'Lintel & Sill', 'Pannierwell', 'Curatory', 'Gutterfold', 'Posy & Pail', 'Hartnoll Joinery', 'Loamfield']) {
    const s = makeExemplar(); s.company.name = name;
    assert.ok(!rulesOf(run(s)).includes('co-names'), `${name} (a proposal, not cleared) trips co-names`);
  }
  for (const name of ['Northwind Traders', 'Contoso Ltd', 'Globex Works', 'Initech Labs']) {
    const s = makeExemplar(); s.company.name = name;
    assert.ok(rulesOf(run(s)).includes('co-names'), `${name} should trip co-names`);
  }
});

test('story:validate -- --kind office: the CLI hands over, reads a file, and leaves the family gate alone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'company-validate-'));
  const file = path.join(dir, 'fixture-works.json');
  fs.writeFileSync(file, JSON.stringify(makeExemplar(), null, 2));
  const cli = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'validate-stories.mts'), ...args], { encoding: 'utf8', cwd: ROOT });
  const ok = cli('--kind', 'office', file);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /fixture-works/); assert.match(ok.stdout, /story:validate \(office\) OK: 1 company file, 0 errors/);
  const broken = makeExemplar(); broken.members[0].ownsCore = false; fs.writeFileSync(file, JSON.stringify(broken));
  const bad = cli('--kind', 'office', file, '--json');
  assert.equal(bad.status, 1);
  const out = JSON.parse(bad.stdout);
  assert.equal(out.ok, false); assert.ok(out.companies[0].errors.some((e: any) => e.rule === 'co-owner'));
  const none = cli('--kind', 'office');
  assert.equal(none.status, 0); assert.match(none.stdout, /content\/offices is empty, which is a pass/);
  assert.equal(cli('--kind', 'castle').status, 2);
  assert.equal(cli('--kind', 'office', '--complete').status, 2, 'a family flag is not an office flag');
  const fam = cli('--kind', 'family', 'brennan');
  assert.equal(fam.status, 0, fam.stdout + fam.stderr);
  assert.match(fam.stdout, /^brennan /m);
  fs.rmSync(dir, { recursive: true, force: true });
});
