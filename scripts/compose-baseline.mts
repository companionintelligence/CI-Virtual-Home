#!/usr/bin/env -S node --experimental-strip-types
// The composer's stability baseline: the hash of what composeHouse puts in every room of the 30 houses, in
// test/fixtures/hashes/compose-baseline.json. A later test (the plan's R8, test-compose-stability) compares a fresh run with it
// to prove that registering a new prop type, a new placement role or a new module did not re-roll a pick anywhere in the
// fleet: composeHouse is a pure function of the spec, the prop registry and the placement table, so any drift in a hash is a
// pick that moved.
//
//   node --experimental-strip-types scripts/compose-baseline.mts            compare a fresh run with the committed file (exit 1 on drift)
//   node --experimental-strip-types scripts/compose-baseline.mts --write    rewrite the file (after an INTENDED composer, registry or spec change)
//   node --experimental-strip-types scripts/compose-baseline.mts --house a,b   restrict the comparison (never with --write)
//
// What is hashed is the same dry run test-room-composer.mts and the fleet audit use (scripts/fleet/_compose-dry.mts dryRun): every
// room of every spec composed from scratch, its authored items dropped, its program read off its name, no seed variant. That
// exercises every room, locked or not, so the hash sees every pick. Per room: sha256 of [level id, room name, program, items]
// (items are rounded to the millimetre by the composer, so the JSON is stable); per house: sha256 of its rooms' entries in order;
// the fleet's hash is sha256 of the houses'. The file has no timestamp and no commit id, so two runs of an unchanged tree write
// the same bytes. Needs `pnpm run build` (it reads the composer's built modules).
//
// Regenerate it deliberately, in the commit that changes the composer, the prop registry, placement.ts or a spec's rooms, and say
// in that commit why the picks moved. A change that was meant to add types without moving any pick must leave it untouched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { M, dryRun, houseIds, loadSpec } from './fleet/_compose-dry.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'test', 'fixtures', 'hashes', 'compose-baseline.json');
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const only = (() => { const i = argv.indexOf('--house'); return i >= 0 ? argv[i + 1].split(',') : null; })();
if (!M) { console.error('the composer is not built: pnpm run build'); process.exit(2); }
if (WRITE && only) { console.error('--write rewrites the whole file: not with --house'); process.exit(2); }

const sha = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

interface HouseEntry { rooms: number; items: number; sha256: string; roomHashes: Record<string, string> }
interface Baseline { schema: 1; what: string; regenerate: string; houses: Record<string, HouseEntry>; fleet: { houses: number; rooms: number; items: number; sha256: string } }

function compute(ids: string[]): Record<string, HouseEntry> {
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
    out[h.id] = { rooms: h.rooms.length, items, sha256: sha(Object.entries(roomHashes)), roomHashes };
  }
  return out;
}

const ids = (only || houseIds()).slice().sort();
const houses = compute(ids);

if (WRITE) {
  const entries = Object.values(houses);
  const base: Baseline = {
    schema: 1,
    what: 'sha256 of composeHouse\'s items for every room of every house in content/houses (the dry run of scripts/fleet/_compose-dry.mts: authored items dropped, programs inferred, no seed variant). Consumed by the composer stability test: new types, roles and modules must not move any hash.',
    regenerate: 'pnpm run build && node --experimental-strip-types scripts/compose-baseline.mts --write   (only in a commit that means to move the composer, the prop registry, placement.ts or a spec; no timestamp, two runs write the same bytes)',
    houses,
    fleet: { houses: entries.length, rooms: entries.reduce((a, e) => a + e.rooms, 0), items: entries.reduce((a, e) => a + e.items, 0), sha256: sha(Object.entries(houses).map(([id, e]) => [id, e.sha256])) },
  };
  fs.writeFileSync(FILE, JSON.stringify(base, null, 2) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), FILE) || FILE}: ${base.fleet.houses} houses, ${base.fleet.rooms} rooms, ${base.fleet.items} items, fleet ${base.fleet.sha256.slice(0, 12)}`);
  process.exit(0);
}

let want: Baseline;
try { want = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { console.error(`no baseline at ${FILE}: run with --write`); process.exit(2); }
let drift = 0;
for (const id of ids) {
  const w = want.houses[id], g = houses[id];
  if (!w) { console.log(`  ✗ ${id}: not in the baseline`); drift++; continue; }
  if (w.sha256 === g.sha256) continue;
  drift++;
  const moved = new Set([...Object.keys(w.roomHashes), ...Object.keys(g.roomHashes)].filter(k => w.roomHashes[k] !== g.roomHashes[k]));
  console.log(`  ✗ ${id}: ${moved.size} room(s) moved: ${[...moved].slice(0, 6).join(', ')}${moved.size > 6 ? ', …' : ''}`);
}
if (!only) for (const id of Object.keys(want.houses)) if (!houses[id]) { console.log(`  ✗ ${id}: in the baseline but no longer a house`); drift++; }
console.log(drift ? `${drift} house(s) drifted from the baseline: if the change meant to move the composer, re-run with --write and say why` : `compose baseline holds: ${ids.length} houses`);
process.exit(drift ? 1 : 0);
