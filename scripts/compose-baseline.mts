#!/usr/bin/env -S node --experimental-strip-types
// The composer's stability baseline: the hash of what composeHouse puts in every room of the 30 houses, in
// test/fixtures/hashes/compose-baseline.json. scripts/test-compose-stability.mts (and the plan's RIG R8) compares a fresh run with
// it to prove that registering a new prop type, a new placement role or a new module did not re-roll a pick anywhere in the
// fleet: composeHouse is a pure function of the spec, the prop registry and the placement table, so any drift in a hash is a
// pick that moved.
//
//   node --experimental-strip-types scripts/compose-baseline.mts            compare a fresh run with the committed file (exit 1 on drift or on any edit of the file)
//   node --experimental-strip-types scripts/compose-baseline.mts --write    rewrite the file (after an INTENDED composer, registry or spec change)
//   node --experimental-strip-types scripts/compose-baseline.mts --house a,b   restrict the comparison (never with --write)
//   node --experimental-strip-types scripts/compose-baseline.mts --file p   compare against another copy of the file (the tamper test uses this; never with --write)
//
// What is hashed is the same dry run test-room-composer.mts and the fleet audit use (scripts/fleet/_compose-dry.mts dryRun): every
// room of every spec composed from scratch, its authored items dropped, its program read off its name, no seed variant. That
// exercises every room, locked or not, so the hash sees every pick. Per room: sha256 of [level id, room name, program, items]
// (items are rounded to the millimetre by the composer, so the JSON is stable); per house: sha256 of its rooms' entries in order;
// the fleet's hash is sha256 of the houses'. The file has no timestamp and no commit id, so two runs of an unchanged tree write
// the same bytes. Needs `pnpm run build` (it reads the composer's built modules).
//
// The compare catches ANY edit of the file, not only a moved composer: scripts/fleet/_compose-baseline.mts says how (the file against
// itself, against a fresh run field by field, and as whole canonical text).
//
// Regenerate it deliberately, in the commit that changes the composer, the prop registry, placement.ts or a spec's rooms, and say
// in that commit why the picks moved. A change that was meant to add types without moving any pick must leave it untouched.
import fs from 'node:fs';
import path from 'node:path';
import { M, houseIds } from './fleet/_compose-dry.mts';
import { build, canonicalText, compute, verify } from './fleet/_compose-baseline.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_FILE = path.join(ROOT, 'test', 'fixtures', 'hashes', 'compose-baseline.json');
const argv = process.argv.slice(2);
const arg = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const WRITE = argv.includes('--write');
const only = arg('--house')?.split(',') ?? null;
const FILE = arg('--file') ? path.resolve(arg('--file')!) : DEFAULT_FILE;
if (!M) { console.error('the composer is not built: pnpm run build'); process.exit(2); }
if (WRITE && (only || arg('--file'))) { console.error('--write rewrites the whole committed file: not with --house or --file'); process.exit(2); }

const all = houseIds();
const ids = (only || all).slice().sort();
const houses = compute(ids);

if (WRITE) {
  const base = build(houses);
  fs.writeFileSync(FILE, canonicalText(base));
  console.log(`wrote ${path.relative(process.cwd(), FILE) || FILE}: ${base.fleet.houses} houses, ${base.fleet.rooms} rooms, ${base.fleet.items} items, fleet ${base.fleet.sha256.slice(0, 12)}`);
  process.exit(0);
}

let want: any, raw = '';
try { raw = fs.readFileSync(FILE, 'utf8'); want = JSON.parse(raw); } catch { console.error(`no readable baseline at ${FILE}: run with --write`); process.exit(2); }
const problems = verify(want, houses, ids, !only, raw);
for (const p of problems) console.log(`  ✗ ${p}`);
console.log(problems.length ? `${problems.length} problem(s) with the compose baseline: if the composer, registry or a spec was meant to move, re-run with --write and say why; if the file was edited by hand, restore it` : `compose baseline holds: ${ids.length} houses`);
process.exit(problems.length ? 1 : 0);
