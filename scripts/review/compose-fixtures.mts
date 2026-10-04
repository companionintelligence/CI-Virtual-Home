#!/usr/bin/env -S node --experimental-strip-types
// R8, the fixtures half: the composer stability baseline for the fixture houses (test/fixtures/houses/*.json), the way
// test/fixtures/hashes/compose-baseline.json holds it for the 30 real ones (scripts/compose-baseline.mts). Streams prove their
// features on fixture houses, so a new type, role or module that re-rolled a pick in a FIXTURE would move a frame the fixture sweep
// blesses; this is the check that says it did not. Same dry run (scripts/fleet/_compose-dry.mts dryRun: every room composed from
// scratch, authored items dropped, programs inferred, no seed variant), same hashes, same file shape; its own file, because the
// fixture set grows with every stream (a new fixture is added with --write in the commit that adds it).
//
//   node --experimental-strip-types scripts/review/compose-fixtures.mts            compare a fresh run with test/review/baselines/compose-fixtures.json (exit 1 on drift or on any edit of the file)
//   node --experimental-strip-types scripts/review/compose-fixtures.mts --write    rewrite the file (when a fixture is added, or after an INTENDED composer change)
//   node --experimental-strip-types scripts/review/compose-fixtures.mts --fixture a,b   restrict the comparison (never with --write)
// Needs `pnpm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { dryRun, M } from '../fleet/_compose-dry.mts';
import { build, canonicalText, houseSha, selfCheck, sha, verify, type Baseline, type HouseEntry } from '../fleet/_compose-baseline.mts';
import { BASELINES, ROOT, parseArgs, rel } from './lib.mts';

export const FIXTURES_DIR = path.join(ROOT, 'test', 'fixtures', 'houses');
export const FIXTURES_FILE = path.join(BASELINES, 'compose-fixtures.json');
export const WHAT = 'sha256 of composeHouse\'s items for every room of every fixture house in test/fixtures/houses (the same dry run as test/fixtures/hashes/compose-baseline.json: authored items dropped, programs inferred, no seed variant). Consumed by scripts/test-compose-stability.mts: new types, roles and modules must not move any hash.';
export const REGENERATE = 'pnpm run build && node --experimental-strip-types scripts/review/compose-fixtures.mts --write   (when a fixture is added, or in a commit that means to move the composer, the prop registry, placement.ts or a fixture; no timestamp, two runs write the same bytes)';

export const fixtureIds = (): string[] => fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
const loadFixture = (id: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, `${id}.json`), 'utf8'));

/** one fresh dry run of the given fixtures, in the baseline's own shape */
export function computeFixtures(ids: string[]): Record<string, HouseEntry> {
  const out: Record<string, HouseEntry> = {};
  for (const h of dryRun(ids.map(id => ({ id, spec: loadFixture(id) })))) {
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
export const buildFixtures = (houses: Record<string, HouseEntry>): Baseline => ({ ...build(houses), what: WHAT, regenerate: REGENERATE });
export const canonicalFixtures = (b: Baseline) => canonicalText(b);

/** A stream adds its fixture houses as test/fixtures/houses/<key>-*.json and may not edit this file (RIG owns it), so a fixture named for
 *  a stream (plan section 4: light, soft, bake, small, dress, ident, and the rig and integration themselves) with no entry yet is a note,
 *  never a failure; the integration branch adds it with --write when it merges the stream. Any OTHER fixture must have its entry: a
 *  baseline entry dropped from the file would otherwise look exactly like a new stream fixture. */
export const STREAM_FIXTURE = /^(light|soft|bake|small|dress|ident|rig|int)-/;
export const unbaselined = (want: any, ids: string[]): string[] => ids.filter(id => !want?.houses?.[id] && STREAM_FIXTURE.test(id));

/** everything that differs between the committed file (`raw` text, as read) and a fresh run; empty = holds. The check covers every fixture
 *  the file names: a fixture the file lacks is not judged (see unbaselined), one the file names and the tree lost is. `full`: the run covers
 *  every fixture on disk, so the whole file is compared as canonical text. */
export function verifyFixtures(want: any, fresh: Record<string, HouseEntry>, ids: string[], full: boolean, raw?: string): string[] {
  // the shared verifier does the field-by-field work on the baselined fixtures; its whole-file canonical-text comparison is against the main
  // file's WHAT, so it runs with full=false and the canonical text of THIS file is compared below
  const known = ids.filter(id => want?.houses?.[id]);
  const bad = verify(want, fresh, known, false, raw);
  for (const id of ids) if (!want?.houses?.[id] && !STREAM_FIXTURE.test(id)) bad.push(`${id}: a fixture with no entry in the baseline, and not named for a stream (an entry dropped from the file, or a fixture that needs one: --write)`);
  if (full) {
    for (const id of Object.keys(want?.houses || {})) if (!fresh[id]) bad.push(`${id}: in the baseline but no longer a fixture`);
    const kept = Object.fromEntries(Object.entries(fresh).filter(([id]) => want?.houses?.[id]));
    const b = buildFixtures(kept);
    for (const k of ['houses', 'rooms', 'items', 'sha256'] as const) if (want?.fleet?.[k] !== b.fleet[k]) bad.push(`fixtures ${k}: ${want?.fleet?.[k]} in the baseline, ${b.fleet[k]} now`);
    if (!bad.length && (raw ?? canonicalFixtures(want)) !== canonicalFixtures(b)) bad.push('the file is not the canonical text of a fresh run (an edit in a field no hash covers: schema, what, regenerate, key order or layout)');
  }
  return bad;
}
export { selfCheck };

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!M) { console.error('the composer is not built: pnpm run build'); process.exit(2); }
  const args = parseArgs(process.argv.slice(2));
  const all = fixtureIds(), only = args.fixture && args.fixture !== 'true' ? args.fixture.split(',') : null;
  if (args.write === 'true' && only) { console.error('--write rewrites the whole file: not with --fixture'); process.exit(2); }
  const ids = only || all;
  const fresh = computeFixtures(ids);
  if (args.write === 'true') {
    const b = buildFixtures(fresh);
    fs.mkdirSync(BASELINES, { recursive: true });
    fs.writeFileSync(FIXTURES_FILE, canonicalFixtures(b));
    console.log(`wrote ${rel(FIXTURES_FILE)}: ${b.fleet.houses} fixtures, ${b.fleet.rooms} rooms, ${b.fleet.items} items, ${b.fleet.sha256.slice(0, 12)}`);
    process.exit(0);
  }
  let raw = '', want: any;
  try { raw = fs.readFileSync(FIXTURES_FILE, 'utf8'); want = JSON.parse(raw); } catch { console.error(`no readable baseline at ${FIXTURES_FILE}: run with --write`); process.exit(2); }
  const problems = verifyFixtures(want, fresh, ids, !only, raw);
  for (const id of unbaselined(want, ids)) console.log(`  note: ${id} is not in the baseline yet (the integration branch adds it with --write)`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(problems.length ? `${problems.length} problem(s) with the fixture compose baseline` : `fixture compose baseline holds: ${ids.length} fixtures`);
  process.exit(problems.length ? 1 : 0);
}
