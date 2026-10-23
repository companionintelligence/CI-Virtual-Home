#!/usr/bin/env -S node --experimental-strip-types
// An apartment's facts are its own unit's (scripts/apartment-unit.mts). The six apartment specs draw the whole block (reference/APARTMENTS.md): a one-bedroom flat in a
// five-floor block has six levels and twenty-seven rooms in its spec, most of them the neighbours' flats, the stair core and the shops. The pages that print "N storeys, N m2,
// N rooms" (a family's page, a home's page, the cards and the player's facts line, through content/houses/index.json) must print the flat's, not the block's. Held here:
//   - the unit of each of the six, room by room (a new apartment, or a re-laid one, is looked at by a person: change the table in the same commit and say why),
//   - the recipe's own invariant behind it: every programmed room that is not a hall is the flat's, and what is left (the neighbours, the core, the podium) has no program or is a hall,
//   - that every room a family lives in, and the room the Core stands in, is in the unit,
//   - that any other home is read whole (nothing the 30 homes' pages say moves),
//   - that index.json and casting.json carry the unit's storeys for an apartment and the spec's for any other home,
//   - that a family's "The home" block prints the flat's facts and draws only the flat's storeys and rooms, and a home's page and a plain card say the flat's storeys.
// Pure Node. Needs `pnpm run build` (the page builders import assets/home-names.js).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';
import { apartmentIds, readUnit, unitOf, unitSpec, unitStoreys } from './apartment-unit.mts';
import { readPlan } from './story/lib/plan-map.mts';
import { homeHtml } from './story/pages.mts';
import { galleryCards, homePage } from './portal-pages.mts';

const J = (...p: string[]) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const spec = (id: string) => J('content', 'houses', `${id}.json`);
const index: { houses: { id: string; name: string; style?: string; storeys: number; areaSqm: number }[] } = J('content', 'houses', 'index.json');
const casting: { families: { slug: string; house: string; storeys: number; members: { id: string; room: string }[] }[] } = J('content', 'story', 'casting.json');
const APARTMENTS = ['city-one-bed', 'corner-penthouse', 'garden-flat', 'studio-loft', 'two-bed-flat', 'walkup-duplex'];

/** What each apartment's unit is: the spec's level ids and room names of the family's own flat. A neighbour, the stair core, the podium and the roof are not in it. */
const UNIT: Record<string, { storeys: number; rooms: string[] }> = {
  'studio-loft': { storeys: 2, rooms: ['l1/Living Loft', 'l1/Desk & Workshop', 'l1/Kitchen', 'l1/Bath', 'l2/Sleeping Platform', 'l2/Back Balcony'] },
  'city-one-bed': { storeys: 1, rooms: ['l2/Bedroom', 'l2/Laundry Closet', 'l2/Bath', 'l2/Entry Hall', 'l2/Kitchen', 'l2/Living Room', 'l2/Desk Nook', 'l2/Street Balcony'] },
  'two-bed-flat': { storeys: 1, rooms: ['l2/Entry Hall', 'l2/Passage', 'l2/Study Alcove', 'l2/Living Room', 'l2/Dining Room', 'l2/Kitchen', 'l2/Primary Bedroom', "l2/Kids' Room", 'l2/Bathroom', 'l2/Laundry', 'l2/Front Balcony'] },
  'corner-penthouse': { storeys: 1, rooms: ['l3/Primary Suite', 'l3/Ensuite', 'l3/Bedroom Two', 'l3/Family Bath', 'l3/Office', 'l3/Bedroom Three', 'l3/Gallery', 'l3/Living Room', 'l3/Library Nook', 'l3/Entry Hall', 'l3/Kitchen', 'l3/Stair Hall', 'l3/Terrace'] },
  'garden-flat': { storeys: 1, rooms: ['l1/Living & Dining', 'l1/Kitchen', 'l1/Entry Hall', 'l1/Passage', 'l1/Study', 'l1/Utility', 'l1/Bathroom', "l1/Grandchild's Bedroom", 'l1/Primary Bedroom', 'l1/Garden Terrace'] },
  'walkup-duplex': { storeys: 2, rooms: ['l2/Entry', 'l2/Stair Hall', 'l2/Living Room', 'l2/Kitchen & Dining', 'l2/Powder Room', 'l2/Back Balcony', 'l3/Primary Bedroom', 'l3/Bedroom Three', 'l3/Upper Hall', 'l3/Bedroom Two', 'l3/Family Bath', 'l3/Study Landing'] },
};

test('the lander plan names the six apartments, and no other home is read as one', () => {
  assert.deepEqual([...apartmentIds()].sort(), APARTMENTS);
  for (const h of index.houses) if (!APARTMENTS.includes(h.id)) assert.equal(unitOf(spec(h.id)).apartment, false, `${h.id} is a home, not a unit in a block`);
});

for (const id of APARTMENTS) {
  test(`${id}: the unit is ${UNIT[id].storeys} storey(s) and ${UNIT[id].rooms.length} rooms; the neighbours, the core and the podium are not in it`, () => {
    const s = spec(id), u = readUnit(s);
    assert.equal(u.levels.length, UNIT[id].storeys, 'the storeys of the unit');
    assert.deepEqual([...u.rooms].sort(), [...UNIT[id].rooms].sort(), 'the rooms of the unit');
    assert.ok(u.levels.length < s.levels.length || s.levels.length === 1, 'a block has storeys that are not the flat\'s');
    // the recipe (reference/APARTMENTS.md 2.1): the flat's rooms carry a program, a closed bay has none, the core's room is a hall
    for (const l of s.levels) for (const r of l.rooms) {
      const inUnit = u.rooms.has(`${l.id}/${r.name}`);
      if (r.program && r.program !== 'hall') assert.ok(inUnit, `${id}: ${l.id}/${r.name} has a program (${r.program}) and is not a hall, so it is the flat's`);
      if (!inUnit) assert.ok(!r.program || r.program === 'hall', `${id}: ${l.id}/${r.name} is outside the flat, so it is a closed bay (no program) or the core's hall`);
    }
    // a storey that is only the block's has none of the flat's rooms
    for (const l of s.levels) if (!u.levels.includes(l.id)) assert.ok(l.rooms.every((r: any) => !u.rooms.has(`${l.id}/${r.name}`)), `${id}/${l.id}: a storey outside the unit has no room of it`);
  });
}

test('every room a family lives in is in its unit, and so is the room the Core stands in', () => {
  for (const f of casting.families.filter(x => APARTMENTS.includes(x.house))) {
    const s = spec(f.house), u = unitOf(s);
    const names = new Set([...u.rooms].map(k => k.split('/').slice(1).join('/')));
    for (const m of f.members) assert.ok(names.has(m.room), `${f.slug}: ${m.id} lives in ${m.room}, which is in the unit`);
    const lv = s.levels.find((l: any) => l.id === s.hero?.level), at = s.hero?.at;
    const room = lv?.rooms.find((r: any) => at && at[0] >= r.bounds.x - 0.05 && at[0] <= r.bounds.x + r.bounds.w + 0.05 && at[1] >= r.bounds.z - 0.05 && at[1] <= r.bounds.z + r.bounds.d + 0.05);
    assert.ok(room && u.rooms.has(`${lv.id}/${room.name}`), `${f.slug}: the Core stands in ${room?.name}, which is in the unit`);
  }
});

test('any other home is read whole: every storey, every room, the same spec object', () => {
  for (const h of index.houses.filter(x => !APARTMENTS.includes(x.id))) {
    const s = spec(h.id), u = unitOf(s);
    assert.equal(u.levels.length, s.levels.length, `${h.id}: all its storeys`);
    assert.equal(u.rooms.size, s.levels.reduce((n: number, l: any) => n + l.rooms.length, 0), `${h.id}: all its rooms`);
    assert.equal(unitSpec(s), s, `${h.id}: the plan is drawn from the spec itself`);
    assert.equal(unitStoreys(s), s.levels.length);
  }
});

test('index.json and casting.json carry the unit\'s storeys for an apartment and the spec\'s for a home; areaSqm is the unit\'s already', () => {
  for (const h of index.houses) assert.equal(h.storeys, APARTMENTS.includes(h.id) ? UNIT[h.id].storeys : spec(h.id).levels.length, `${h.id}: storeys`);
  assert.equal(index.houses.find(h => h.id === 'city-one-bed')!.storeys, 1, 'a one-bedroom flat in a six-level block is one storey');
  for (const f of casting.families) assert.equal(f.storeys, index.houses.find(h => h.id === f.house)!.storeys, `${f.slug}: casting.json carries the index's storeys`);
});

test('the plan a family\'s page draws is the unit: its storeys and rooms only, in one outline', () => {
  for (const id of APARTMENTS) {
    const plan = readPlan(unitSpec(spec(id)))!;
    assert.equal(plan.levels.length, UNIT[id].storeys, `${id}: a drawing for each storey of the unit`);
    assert.equal(plan.levels.reduce((n, l) => n + l.rooms.length, 0), UNIT[id].rooms.length, `${id}: a rectangle for each room of the unit`);
    for (const l of plan.levels) assert.equal(l.footprint.length, 1, `${id}/${l.id}: the flat's own outline, not the block's bays`);
  }
});

test('"The home" prints the flat\'s facts and draws the flat; a home\'s page and a plain card give the flat\'s storeys', () => {
  const FAM: Record<string, string> = { valdivia: 'studio-loft', tehrani: 'city-one-bed', steyn: 'two-bed-flat', voss: 'corner-penthouse', penhallow: 'garden-flat', rademaker: 'walkup-duplex' };
  const nf = new Intl.NumberFormat('en-US');
  for (const [slug, id] of Object.entries(FAM)) {
    const s = J('content', 'families', `${slug}.json`), fam = casting.families.find(f => f.slug === slug)!, house = index.houses.find(h => h.id === id)!;
    const html = homeHtml({ s, house, casting: fam, spec: spec(id) } as any);
    const facts = [...html.matchAll(/<ul class="home-facts"[^>]*>([\s\S]*?)<\/ul>/g)].map(m => [...m[1].matchAll(/<li>([^<]+)<\/li>/g)].map(x => x[1]))[0];
    const n = UNIT[id].storeys;
    assert.deepEqual(facts, [`${n} ${n === 1 ? 'storey' : 'storeys'}`, `${nf.format(house.areaSqm)} m²`, `${UNIT[id].rooms.length} rooms`], `${slug}: the facts line is the flat's`);
    assert.equal((html.match(/<figure class="plan"/g) || []).length, n, `${slug}: one drawing for each storey of the flat`);
    const drawn = (html.match(/<div class="plan-levels">[\s\S]*?<p class="note">/) || [''])[0];
    assert.ok(drawn.length > 0 && !/Neighbour|Rear flat|East flat|Front flat|Common (two|three|four|five)|Tower |Roof access|Lobby|Shop (west|east)|Upper (loft|flat|stair)|Top (flat|stair|landing)/i.test(drawn), `${slug}: no room of the block is drawn or named on the plan`);
    const page = homePage(house as any, 'https://homes.ci.computer/');
    const pageFacts = [...page.matchAll(/<li class="fact">([^<]+)<\/li>/g)].map(m => m[1]);
    assert.deepEqual(pageFacts, [`${n} ${n === 1 ? 'storey' : 'storeys'}`, `${nf.format(house.areaSqm)} m²`], `homes/${id}: the home's page gives the flat's storeys and area`);
    const card = galleryCards([house as any]);
    assert.ok(card.includes(`<span class="fact">${n} ${n === 1 ? 'storey' : 'storeys'}</span>`), `a plain card for ${id} gives the flat's storeys`);
  }
});
