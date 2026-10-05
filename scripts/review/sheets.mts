#!/usr/bin/env -S node --experimental-strip-types
// R5: before/after sheets. Labelled pairs (BEFORE | AFTER) from two review sets of the same cameras, one contact sheet per room type,
// plus the scale sheet (the same rooms with the procedural 1.7 m mannequin standing in them, capture.mts's `scale` frames) and the
// dusk/night sheet of the bench rooms. With no --after it makes the BEFORE contact sheets alone (NW | SE per room).
//
//   node --experimental-strip-types scripts/review/sheets.mts [--before <dir>] [--after <dir>] [--out <dir>] [--kinds living,bedroom] [--tile 480]
//     --before / --after   set directories holding <set>.manifest.json (default before: <REVIEW_DIR>/before; the committed manifest is used when none is there)
//     --out                default <REVIEW_DIR>/sheets/<after set or "before">
//     --addendum [dir]     also sheet-addendum.jpg: each obstructed frozen frame next to its addendum frame (BEFORE from <REVIEW_DIR>/before-addendum, or the dir given)
//     --addendum-after <dir>  adds the addendum frames of an AFTER set (taken with capture.mts --addendum chosen)
//     --rooms a,b          only these room ids (a stream's PR sheet: the R24 rooms it affects)
// Sheets are written outside git. sheets.json in the output directory lists each sheet with its sha256 and its frames' hashes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REVIEW_DIR, ROOT, parseArgs, sha256File, stableJson, writeText, rel } from './lib.mts';
import { BEFORE_MANIFEST, loadManifest, manifestIn, type Manifest, type ManifestShot } from './manifest.mts';
import { R24 } from './cameras.mts';
import { ADDENDUM } from './addendum.mts';

const args = parseArgs(process.argv.slice(2));

export interface Tile { file: string | null; label: string; sub?: string }
export interface SheetSpec { out: string; tile_w: number; title: string; rows: Tile[][] }

function load(dirArg: string | undefined, fallbackSet: string): { dir: string; m: Manifest } {
  const dir = path.resolve(dirArg && dirArg !== 'true' ? dirArg : path.join(REVIEW_DIR, fallbackSet));
  const set = path.basename(dir);
  let mf = manifestIn(dir, set);
  if (!fs.existsSync(mf)) {
    // a set whose directory is not named after it (capture.mts --out): the one manifest the directory holds
    const own = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.manifest.json')) : [];
    mf = own.length === 1 ? path.join(dir, own[0]) : fs.existsSync(manifestIn(dir, fallbackSet)) ? manifestIn(dir, fallbackSet) : BEFORE_MANIFEST;
  }
  return { dir, m: loadManifest(mf) };
}

/** the room-type groups of the sheets: hall and foyer share one */
export const KINDS: Array<{ key: string; title: string; kinds: string[] }> = [
  { key: 'living', title: 'Living, family and den', kinds: ['living'] },
  { key: 'bedroom', title: 'Bedrooms and kids', kinds: ['bedroom', 'kids'] },
  { key: 'kitchen', title: 'Kitchens', kinds: ['kitchen'] },
  { key: 'dining', title: 'Dining', kinds: ['dining'] },
  { key: 'bath', title: 'Baths', kinds: ['bath'] },
  { key: 'hall', title: 'Halls and foyers', kinds: ['hall', 'foyer'] },
  { key: 'utility', title: 'Garage and laundry', kinds: ['garage', 'laundry'] },
];

const tileOf = (s: ManifestShot | undefined, dir: string, label: string, sub = ''): Tile => ({ file: s ? path.join(dir, s.file) : null, label, sub });
const find = (m: Manifest, id: string) => m.shots.find(s => s.id === id);

export function buildSpecs(before: { dir: string; m: Manifest }, after: { dir: string; m: Manifest } | null, out: string, tile: number, only: Set<string> | null, kinds: Set<string> | null): SheetSpec[] {
  const specs: SheetSpec[] = [];
  const rooms = R24.filter(r => !only || only.has(r.id));
  const aLabel = after ? after.m.set : '';
  for (const g of KINDS) {
    if (kinds && !kinds.has(g.key)) continue;
    const rs = rooms.filter(r => g.kinds.includes(r.kind));
    if (!rs.length) continue;
    const rows: Tile[][] = [];
    for (const r of rs) {
      const row: Tile[] = [];
      for (const corner of ['NW', 'SE']) {
        const id = `${r.id}/${corner}/day`;
        row.push(tileOf(find(before.m, id), before.dir, `BEFORE  ${r.id}`, `${corner} day`));
        if (after) row.push(tileOf(find(after.m, id), after.dir, `AFTER ${aLabel}`, `${corner} day`));
      }
      rows.push(row);
    }
    specs.push({ out: path.join(out, `sheet-${g.key}.jpg`), tile_w: tile, title: `${g.title}: ${after ? `${before.m.set} | ${aLabel}` : before.m.set}, 1.5 m eye, 60 deg, 1280x720 composer path`, rows });
  }
  // scale: the same rooms with the mannequin
  if (!kinds || kinds.has('scale')) {
    const rows: Tile[][] = [];
    for (const r of rooms) {
      const id = `${r.id}/NW/day/scale`, b = find(before.m, id), a = after ? find(after.m, id) : undefined;
      if (!b && !a) continue;
      rows.push(after ? [tileOf(b, before.dir, `BEFORE  ${r.id}`, '1.7 m figure'), tileOf(a, after.dir, `AFTER ${aLabel}`, '1.7 m figure')] : [tileOf(b, before.dir, `${r.id}`, '1.7 m figure')]);
    }
    // two room-pairs a row keeps the sheet wide rather than tall
    const wide: Tile[][] = []; for (let i = 0; i < rows.length; i += 2) wide.push([...rows[i], ...(rows[i + 1] || [])]);
    if (wide.length) specs.push({ out: path.join(out, 'sheet-scale.jpg'), tile_w: tile, title: `Scale reference: procedural 1.70 m mannequin, NW day`, rows: wide });
  }
  // the bench rooms at dusk and night
  if (!kinds || kinds.has('night')) {
    const rows: Tile[][] = [];
    for (const r of rooms.filter(r => r.bench)) for (const tod of ['dusk', 'night'] as const) {
      const id = `${r.id}/NW/${tod}`, b = find(before.m, id), a = after ? find(after.m, id) : undefined;
      if (!b && !a) continue;
      rows.push(after ? [tileOf(b, before.dir, `BEFORE  ${r.id}`, `NW ${tod}`), tileOf(a, after.dir, `AFTER ${aLabel}`, `NW ${tod}`)] : [tileOf(b, before.dir, r.id, `NW ${tod}`)]);
    }
    const wide: Tile[][] = []; for (let i = 0; i < rows.length; i += 2) wide.push([...rows[i], ...(rows[i + 1] || [])]);
    if (wide.length) specs.push({ out: path.join(out, 'sheet-dusk-night.jpg'), tile_w: tile, title: 'Bench rooms at dusk and night (the light acceptance frames)', rows: wide });
  }
  return specs;
}

/** the camera addendum: per obstructed frozen frame, the frozen frame, the alternative corner at BEFORE, and (if given) at AFTER */
export function buildAddendumSpec(before: { dir: string; m: Manifest }, addBefore: { dir: string; m: Manifest }, addAfter: { dir: string; m: Manifest } | null, afterFull: { dir: string; m: Manifest } | null, out: string, tile: number): SheetSpec {
  const rows: Tile[][] = [];
  for (const a of ADDENDUM) {
    const fid = `${a.room}/${a.replaces}/day`, aid = `${a.room}/${a.corner}/day`;
    const row = [tileOf(find(before.m, fid), before.dir, `BEFORE  ${a.room}`, `${a.replaces} day (frozen, obstructed)`)];
    if (afterFull) row.push(tileOf(find(afterFull.m, fid), afterFull.dir, `AFTER ${afterFull.m.set}`, `${a.replaces} day (frozen camera)`));
    row.push(tileOf(find(addBefore.m, aid), addBefore.dir, `BEFORE  ${a.room}`, `${a.corner} day (addendum)`));
    if (addAfter) row.push(tileOf(find(addAfter.m, aid), addAfter.dir, `AFTER ${addAfter.m.set}`, `${a.corner} day (addendum)`));
    rows.push(row);
  }
  return { out: path.join(out, 'sheet-addendum.jpg'), tile_w: tile, title: 'Camera addendum: the three obstructed frozen frames and their alternative corners', rows };
}

export function renderSheets(specs: SheetSpec[], outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const written: Array<{ file: string; sha256: string }> = [];
  for (const s of specs) {
    const specFile = path.join(outDir, `.${path.basename(s.out, '.jpg')}.spec.json`);
    writeText(specFile, JSON.stringify({ ...s, quality: 90 }));
    const r = spawnSync('python3', [path.join(import.meta.dirname, 'sheet.py'), specFile], { encoding: 'utf8' });
    fs.rmSync(specFile, { force: true });
    if (r.status !== 0) throw new Error(`sheet.py failed for ${s.out}: ${r.stderr}`);
    written.push({ file: path.basename(s.out), sha256: sha256File(s.out) });
    console.log(`  ${rel(s.out)}`);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = load(args.before, 'before');
  const after = args.after && args.after !== 'true' ? load(args.after, path.basename(path.resolve(args.after))) : null;
  const out = path.resolve(args.out && args.out !== 'true' ? args.out : path.join(REVIEW_DIR, 'sheets', after ? after.m.set : 'before'));
  const specs = buildSpecs(before, after, out, Number(args.tile || 480), args.rooms ? new Set(args.rooms.split(',')) : null, args.kinds ? new Set(args.kinds.split(',')) : null);
  if (args.addendum !== undefined) {
    const ab = load(args.addendum !== 'true' ? args.addendum : undefined, 'before-addendum');
    const aa = args['addendum-after'] && args['addendum-after'] !== 'true' ? load(args['addendum-after'], path.basename(path.resolve(args['addendum-after']))) : null;
    specs.push(buildAddendumSpec(before, ab, aa, after, out, Number(args.tile || 480)));
  }
  const written = renderSheets(specs, out);
  writeText(path.join(out, 'sheets.json'), stableJson({ before: before.m.set, after: after ? after.m.set : null, sheets: written }));
  console.log(`${written.length} sheet(s) in ${out}`);
  void ROOT;
}
