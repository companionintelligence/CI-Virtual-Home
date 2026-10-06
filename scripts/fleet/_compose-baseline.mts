// The composer stability baseline's shape, its computation and its verification: shared by scripts/compose-baseline.mts (the CLI that
// writes and compares test/fixtures/hashes/compose-baseline.json) and scripts/test-compose-stability.mts (which proves the compare
// catches every kind of edit). Not a metric file (the fleet audit skips "_" files).
//
// Verification is deliberately redundant, because a baseline that can be edited without anyone noticing is worse than none:
//   1. the committed file is checked against itself: every house's room count and sha256 are recomputed from its roomHashes, the
//      fleet's counts and sha256 from its houses (so editing a roomHash, a house sha or the fleet sha alone is caught even
//      before a fresh run is looked at);
//   2. the committed file is checked against a FRESH run, field by field: each room hash, each house's room and item counts and sha256,
//      the fleet's houses, rooms, items and sha256 (the item counts cannot be derived from the hashes, so only this catches an
//      item-count edit);
//   3. the whole file (what, regenerate, schema included) must equal the canonical text `--write` would produce from the fresh
//      run, so ANY byte of an edit is caught, even one in a field nothing above reads.
// (3 needs the full fleet; with --house only 1 and 2 run, for the houses asked about, and the file is still checked against itself
// for every house.)
import crypto from 'node:crypto';
import { dryRun, loadSpec } from './_compose-dry.mts';

export const sha = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

export interface HouseEntry { rooms: number; items: number; sha256: string; roomHashes: Record<string, string> }
export interface Baseline { schema: 1; what: string; regenerate: string; houses: Record<string, HouseEntry>; fleet: { houses: number; rooms: number; items: number; sha256: string } }

export const WHAT = 'sha256 of composeHouse\'s items for every room of every house in content/houses (the dry run of scripts/fleet/_compose-dry.mts: authored items dropped, programs inferred, no seed variant). Consumed by the composer stability test: new types, roles and modules must not move any hash.';
export const REGENERATE = 'pnpm run build && node --experimental-strip-types scripts/compose-baseline.mts --write   (only in a commit that means to move the composer, the prop registry, placement.ts or a spec; no timestamp, two runs write the same bytes)';

/** one fresh dry run of the given houses: per room a 16-hex sha256 of [level, room name, program, items] */
export function compute(ids: string[]): Record<string, HouseEntry> {
  const out: Record<string, HouseEntry> = {};
  for (const h of dryRun(ids.map(id => ({ id, spec: loadSpec(id) })))) {
    const roomHashes: Record<string, string> = {};
    let items = 0;
    for (const r of h.rooms) {
      const key = `${r.lv.id}/${r.room.name}`;
      if (roomHashes[key]) throw new Error(`${h.id}: two rooms called ${key}; the baseline keys rooms by level and name`);
      roomHashes[key] = sha([r.lv.id, r.room.name, r.res.program, r.res.items]).slice(0, 16);
      items += r.res.items.length;
    }
    out[h.id] = { rooms: h.rooms.length, items, sha256: houseSha(roomHashes), roomHashes };
  }
  return out;
}

export const houseSha = (roomHashes: Record<string, string>) => sha(Object.entries(roomHashes));

/** the whole file for a set of houses (the fleet: every house in content/houses) */
export function build(houses: Record<string, HouseEntry>): Baseline {
  const entries = Object.values(houses);
  return {
    schema: 1, what: WHAT, regenerate: REGENERATE, houses,
    fleet: { houses: entries.length, rooms: entries.reduce((a, e) => a + e.rooms, 0), items: entries.reduce((a, e) => a + e.items, 0), sha256: sha(Object.entries(houses).map(([id, e]) => [id, e.sha256])) },
  };
}
export const canonicalText = (b: Baseline) => JSON.stringify(b, null, 2) + '\n';

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** problems found in the committed file by itself (nothing fresh compared): a malformed file, or one whose summaries do not follow from its room hashes */
export function selfCheck(want: any): string[] {
  const bad: string[] = [];
  if (!isObj(want) || !isObj(want.houses) || !isObj(want.fleet)) return ['the baseline file is malformed (no houses or fleet object)'];
  let rooms = 0, items = 0;
  for (const [id, e] of Object.entries<any>(want.houses)) {
    if (!isObj(e) || !isObj(e.roomHashes)) { bad.push(`${id}: malformed entry`); continue; }
    const n = Object.keys(e.roomHashes).length;
    if (e.rooms !== n) bad.push(`${id}: says ${e.rooms} rooms but lists ${n} room hashes`);
    if (e.sha256 !== houseSha(e.roomHashes)) bad.push(`${id}: its sha256 is not the hash of its room hashes (a room hash or the house hash was edited)`);
    rooms += n; items += Number(e.items) || 0;
  }
  const f = want.fleet, ids = Object.keys(want.houses);
  if (f.houses !== ids.length) bad.push(`fleet says ${f.houses} houses but lists ${ids.length}`);
  if (f.rooms !== rooms) bad.push(`fleet says ${f.rooms} rooms but the houses add up to ${rooms}`);
  if (f.items !== items) bad.push(`fleet says ${f.items} items but the houses add up to ${items}`);
  if (f.sha256 !== sha(Object.entries<any>(want.houses).map(([id, e]) => [id, e.sha256]))) bad.push('the fleet sha256 is not the hash of the houses\' hashes (a house hash or the fleet hash was edited)');
  return bad;
}

/** everything that differs between the committed file and a fresh run of `ids`. `full`: the run covers every house, so the fleet
 *  summary and the whole file text (`rawText`, as read from disk) are compared too. Empty = the baseline holds. */
export function verify(want: any, fresh: Record<string, HouseEntry>, ids: string[], full: boolean, rawText?: string): string[] {
  const bad = selfCheck(want);
  if (!isObj(want?.houses)) return bad;
  for (const id of ids) {
    const w = want.houses[id], g = fresh[id];
    if (!w) { bad.push(`${id}: not in the baseline`); continue; }
    if (!isObj(w.roomHashes)) continue;
    const moved = [...new Set([...Object.keys(w.roomHashes), ...Object.keys(g.roomHashes)])].filter(k => w.roomHashes[k] !== g.roomHashes[k]);
    if (moved.length) bad.push(`${id}: ${moved.length} room(s) moved: ${moved.slice(0, 6).join(', ')}${moved.length > 6 ? ', …' : ''}`);
    if (w.rooms !== g.rooms) bad.push(`${id}: ${w.rooms} rooms in the baseline, ${g.rooms} now`);
    if (w.items !== g.items) bad.push(`${id}: ${w.items} items in the baseline, ${g.items} now`);
    if (w.sha256 !== g.sha256 && !moved.length) bad.push(`${id}: house sha256 differs from a fresh run with every room hash equal`);
  }
  if (full) {
    for (const id of Object.keys(want.houses)) if (!fresh[id]) bad.push(`${id}: in the baseline but no longer a house`);
    const b = build(fresh);
    for (const k of ['houses', 'rooms', 'items', 'sha256'] as const) if (want.fleet?.[k] !== b.fleet[k]) bad.push(`fleet ${k}: ${want.fleet?.[k]} in the baseline, ${b.fleet[k]} now`);
    // (the raw text when the caller has it: parsing forgets indentation, a trailing newline and the like)
    if (!bad.length && (rawText ?? canonicalText(want)) !== canonicalText(b)) bad.push('the file is not the canonical text of a fresh run (an edit in a field no hash covers: schema, what, regenerate, key order or layout)');
  }
  return bad;
}
