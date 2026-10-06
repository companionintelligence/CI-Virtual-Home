#!/usr/bin/env -S node --experimental-strip-types
// The composer stability baseline (test/fixtures/hashes/compose-baseline.json), tested: it holds on this tree, and the compare
// refuses EVERY kind of edit of the file. The baseline is what the interiors streams are held to ("registering a type moved no
// pick"), so a file that can be edited into agreement is worse than none; this test is what keeps the compare honest.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-compose-stability.mts      (any cwd; needs `pnpm run build`; ~20 s, one dry run in-process and six CLI runs in parallel)
//
//   A. the committed baseline holds against a fresh run (in-process, scripts/fleet/_compose-baseline.mts verify);
//   B. the CLI (scripts/compose-baseline.mts --file <copy>) on copies of the file: the untouched copy exits 0, and these exit 1 —
//      a roomHash-only edit, a fleet-hash-only edit, a whitespace-only edit, an item-count edit (a house's items alone, and a house's AND the fleet's items
//      moved together so the file agrees with itself: only a fresh run can see that one);
//   C. in-process, the rest of the ways to edit it: a house hash, a room count, a dropped or added room, a dropped or added house,
//      a roomHash edited with the house and fleet hashes recomputed to match (a careful forgery), the fleet counts, the prose fields,
//      and a byte-level change that no field reads (key order, indentation); each is reported, none passes.
//   D. the FIXTURE houses (test/fixtures/houses, the houses every stream proves its features on): the same hashes, held by
//      test/review/baselines/compose-fixtures.json (scripts/review/compose-fixtures.mts, plan RIG R8): the file holds on this tree and
//      is refused when edited in any of the ways above; a fixture named for a stream (light-, soft-, bake-, small-, dress-, ident-) that the file
//      does not name yet is a note, not a failure (streams may not edit that file), every other fixture must have its entry.
//   E. the gate can fail (scripts/review/compose-probe.mts, a fresh process each): registering a type under a NEW role moves no pick of the
//      30 houses, and the same type added to an EXISTING role's candidates moves picks in at least one house. A baseline that
//      "new types and roles moved nothing" could not contradict would be worth nothing; this is what makes it a measurement.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { M, houseIds } from './fleet/_compose-dry.mts';
import { build, canonicalText, compute, houseSha, sha, verify, type Baseline } from './fleet/_compose-baseline.mts';
import { FIXTURES_FILE, buildFixtures, canonicalFixtures, computeFixtures, fixtureIds, verifyFixtures } from './review/compose-fixtures.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'test', 'fixtures', 'hashes', 'compose-baseline.json');
const CLI = path.join(ROOT, 'scripts', 'compose-baseline.mts');
const PROBE = path.join(ROOT, 'scripts', 'review', 'compose-probe.mts');
if (!M) { console.error('the composer is not built: pnpm run build'); process.exit(2); }

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : ` — ${detail}`}`); if (!ok) failed++; };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const text = fs.readFileSync(FILE, 'utf8');
const committed: Baseline = JSON.parse(text);
const ids = houseIds();
const first = Object.keys(committed.houses).sort()[0];
const firstRoom = Object.keys(committed.houses[first].roomHashes)[0];
const flip = (h: string) => (h[0] === '0' ? '1' : '0') + h.slice(1);

// B starts first (child processes, in parallel with the in-process dry run below)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-baseline-test-'));
const cli = (name: string, b: Baseline | string, expect: 0 | 1) => new Promise<{ name: string; expect: number; code: number | null; out: string }>(resolve => {
  const f = path.join(dir, `${name}.json`);
  fs.writeFileSync(f, typeof b === 'string' ? b : canonicalText(b));
  const p = spawn(process.execPath, ['--experimental-strip-types', CLI, '--file', f], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => resolve({ name, expect, code, out }));
});
const roomOnly = clone(committed); roomOnly.houses[first].roomHashes[firstRoom] = flip(roomOnly.houses[first].roomHashes[firstRoom]);
const fleetOnly = clone(committed); fleetOnly.fleet.sha256 = flip(fleetOnly.fleet.sha256);
const itemsHouse = clone(committed); itemsHouse.houses[first].items += 1;
const itemsBoth = clone(committed); itemsBoth.houses[first].items += 1; itemsBoth.fleet.items += 1;
const cliRuns = Promise.all([
  cli('untouched', text, 0),
  cli('whitespace-only', text.replace('\n  "what"', '\n    "what"'), 1),
  cli('roomhash-only', roomOnly, 1),
  cli('fleethash-only', fleetOnly, 1),
  cli('itemcount-house', itemsHouse, 1),
  cli('itemcount-house-and-fleet', itemsBoth, 1),
]);

// E's three probes: a fresh process each (the composer memoises a role's candidates on first use), in parallel with everything else
const probe = (mutate: string) => new Promise<Record<string, string>>((resolve, reject) => {
  const p = spawn(process.execPath, ['--experimental-strip-types', PROBE, '--houses', ids.join(','), '--mutate', mutate], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('close', code => code === 0 ? resolve(JSON.parse(out.trim().split('\n').pop()!)) : reject(new Error(`compose-probe --mutate ${mutate} exited ${code}: ${err.trim().split('\n').slice(-2).join(' | ')}`)));
});
const probes = Promise.all([probe('none'), probe('new-role'), probe('existing-role')]).catch(e => e as Error);

console.log('A. the committed baseline against a fresh run');
const fresh = compute(ids);
const base = verify(committed, fresh, ids, true);
check(base.length === 0, `holds on this tree (${ids.length} houses, ${committed.fleet.rooms} rooms, ${committed.fleet.items} items)`, base.slice(0, 4).join('; '));
check(text === canonicalText(build(fresh)), 'the file is byte-identical to what --write produces from this tree');
check(verify(committed, fresh, ['aurora'], false).length === 0, '--house restricts the compare and still passes');

console.log('B. the CLI on copies of the file (exit codes)');
for (const r of await cliRuns) check(r.code === r.expect, `${r.name}: exit ${r.expect}`, `exited ${r.code}: ${r.out.trim().split('\n').slice(-3).join(' | ')}`);
fs.rmSync(dir, { recursive: true, force: true });

console.log('C. every other way to edit the file is reported');
const mustFail = (name: string, mutate: (b: any) => void | string, expectIn: RegExp) => {
  const b: any = clone(committed);
  const raw = mutate(b);   // a string = the file edited as text (the CLI hands verify the raw text it read)
  const all = typeof raw === 'string' ? verify(JSON.parse(raw), fresh, ids, true, raw) : verify(b, fresh, ids, true);
  check(all.length > 0 && all.some(p => expectIn.test(p)), name, all.length ? `reported, but not as expected: ${all.slice(0, 2).join('; ')}` : 'NOT detected');
};
mustFail('a house hash edited', b => { b.houses[first].sha256 = flip(b.houses[first].sha256); }, /sha256/);
mustFail('a room count edited', b => { b.houses[first].rooms += 1; }, /rooms/);
mustFail('a room hash dropped', b => { delete b.houses[first].roomHashes[firstRoom]; }, /moved|rooms/);
mustFail('a room added', b => { b.houses[first].roomHashes['L9/Invented'] = '0123456789abcdef'; }, /moved|rooms|sha256/);
mustFail('a house dropped', b => { delete b.houses[first]; }, /not in the baseline|houses/);
mustFail('a house added', b => { b.houses.ghost = clone(b.houses[first]); }, /no longer a house|houses/);
mustFail('fleet rooms edited', b => { b.fleet.rooms += 1; }, /fleet rooms/);
mustFail('fleet items edited', b => { b.fleet.items -= 1; }, /fleet items/);
mustFail('fleet houses edited', b => { b.fleet.houses += 1; }, /fleet houses/);
mustFail('a forgery: one room hash edited, the house and fleet hashes recomputed to agree', b => {
  const h = b.houses[first]; h.roomHashes[firstRoom] = flip(h.roomHashes[firstRoom]); h.sha256 = houseSha(h.roomHashes);
  b.fleet.sha256 = sha(Object.entries<any>(b.houses).map(([id, e]) => [id, e.sha256]));
}, /moved/);
mustFail('the what text edited', b => { b.what += ' (edited)'; }, /canonical/);
mustFail('the schema edited', b => { b.schema = 2; }, /canonical/);
mustFail('the regenerate text edited', b => { b.regenerate = ''; }, /canonical/);
mustFail('a trailing newline dropped (same data)', () => text.slice(0, -1), /canonical/);
mustFail('indentation changed (same data)', b => JSON.stringify(b, null, 4) + '\n', /canonical/);
mustFail('key order changed (same data)', b => JSON.stringify({ schema: b.schema, what: b.what, regenerate: b.regenerate, fleet: b.fleet, houses: b.houses }, null, 2) + '\n', /canonical/);
check(verify({ houses: 'x', fleet: {} }, fresh, ids, true).length > 0, 'a malformed file is reported, not thrown on');

console.log('D. the fixture houses');
const fixText = fs.readFileSync(FIXTURES_FILE, 'utf8');
const fixCommitted: Baseline = JSON.parse(fixText);
const fids = fixtureIds();
const fixFresh = computeFixtures(fids);
const fixBase = verifyFixtures(fixCommitted, fixFresh, fids, true, fixText);
check(fixBase.length === 0, `holds on this tree (${Object.keys(fixCommitted.houses).length} fixtures, ${fixCommitted.fleet.rooms} rooms, ${fixCommitted.fleet.items} items)`, fixBase.slice(0, 4).join('; '));
check(fixText === canonicalFixtures(buildFixtures(Object.fromEntries(Object.entries(fixFresh).filter(([id]) => fixCommitted.houses[id])))), 'the file is byte-identical to what --write produces from this tree');
check(verifyFixtures(fixCommitted, fixFresh, [fids[0]], false).length === 0, '--fixture restricts the compare and still passes');
const fx0 = Object.keys(fixCommitted.houses).sort()[0], fxRoom = Object.keys(fixCommitted.houses[fx0].roomHashes)[0];
const fixMustFail = (name: string, mutate: (b: any) => void | string, expectIn: RegExp) => {
  const b: any = clone(fixCommitted);
  const raw = mutate(b);
  const all = typeof raw === 'string' ? verifyFixtures(JSON.parse(raw), fixFresh, fids, true, raw) : verifyFixtures(b, fixFresh, fids, true);
  check(all.length > 0 && all.some(p => expectIn.test(p)), `fixtures: ${name}`, all.length ? `reported, but not as expected: ${all.slice(0, 2).join('; ')}` : 'NOT detected');
};
fixMustFail('a room hash edited', b => { b.houses[fx0].roomHashes[fxRoom] = flip(b.houses[fx0].roomHashes[fxRoom]); }, /moved/);
fixMustFail('a house hash edited', b => { b.houses[fx0].sha256 = flip(b.houses[fx0].sha256); }, /sha256/);
fixMustFail('an item count edited', b => { b.houses[fx0].items += 1; }, /items/);
fixMustFail('a forgery: a room hash edited, the house and fleet hashes recomputed to agree', b => {
  const h = b.houses[fx0]; h.roomHashes[fxRoom] = flip(h.roomHashes[fxRoom]); h.sha256 = houseSha(h.roomHashes);
  b.fleet.sha256 = sha(Object.entries<any>(b.houses).map(([id, e]) => [id, e.sha256]));
}, /moved/);
fixMustFail('a fixture dropped from the file (its summary recomputed to agree)', b => {
  delete b.houses[fx0]; const es = Object.values<any>(b.houses);
  b.fleet = { houses: es.length, rooms: es.reduce((a, e) => a + e.rooms, 0), items: es.reduce((a, e) => a + e.items, 0), sha256: sha(Object.entries<any>(b.houses).map(([id, e]) => [id, e.sha256])) };
}, /no entry in the baseline/);
fixMustFail('a fixture in the file that is not on disk', b => { b.houses.ghost = clone(b.houses[fx0]); const es = Object.values<any>(b.houses); b.fleet = { houses: es.length, rooms: es.reduce((a, e) => a + e.rooms, 0), items: es.reduce((a, e) => a + e.items, 0), sha256: sha(Object.entries<any>(b.houses).map(([id, e]) => [id, e.sha256])) }; }, /no longer a fixture/);
fixMustFail('the what text edited', b => { b.what += ' (edited)'; }, /canonical/);
fixMustFail('a trailing newline dropped (same data)', () => fixText.slice(0, -1), /canonical/);
fixMustFail('indentation changed (same data)', b => JSON.stringify(b, null, 4) + '\n', /canonical/);

console.log('E. the gate can fail (probes in fresh processes)');
const pr = await probes;
if (pr instanceof Error) check(false, 'the probes ran', pr.message);
else {
  const [none, newRole, existing] = pr;
  const off = (m: Record<string, string>) => ids.filter(id => m[id] !== committed.houses[id].sha256);
  check(off(none).length === 0, 'control: with no mutation every house hashes as the baseline says', `${off(none).length} house(s) moved: ${off(none).slice(0, 4).join(', ')}`);
  check(off(newRole).length === 0, 'a type under a NEW role moves no pick in any of the 30 houses', `${off(newRole).length} house(s) moved: ${off(newRole).slice(0, 4).join(', ')}`);
  const moved = off(existing);
  check(moved.length > 0, `the same type added to an EXISTING role's candidates is caught (${moved.length} of ${ids.length} houses move)`, 'no house moved: the gate cannot see a re-rolled pick');
}

console.log(`${failed ? '✗' : '✓'} compose-baseline stability: ${failed} wrong`);
process.exit(failed ? 1 : 0);
