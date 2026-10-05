#!/usr/bin/env -S node --experimental-strip-types
// Compose a house's rooms from their programs (plan S3), in Node, and either report the result or bake it into a spec
// for hand-tuning. The same composer the page runs at build time (assets/room-composer.ts), so what this prints is what
// the build makes.
//
//   node --experimental-strip-types scripts/compose-house.mts --house <id | path.json> [options]
//     --house <id>      a real house (content/houses/<id>.json), a fixture (test/fixtures/houses/<id>.json) or a path
//     --infer           also compose the rooms that have no `program`, reading it off the room's name (the dry run:
//                       "what would the composer make of this house?"); rooms whose name says nothing are left alone
//     --replace         with --infer: drop the authored filler of a room first (the hand-typed loveseat, wingback and bed swapped
//                       for a composition, on a copy) — but keep what the composer arranges ROUND: a hearth and a wall TV, and
//                       the Core's own pieces (--keep adds types, --keep none drops even those); without it authored items are
//                       pins and stay exactly, and a piece that fills a role (a toilet, a bed, a sofa, a table, a run) means the
//                       composer adds no second one
//     --keep a,b|none   with --replace: the item types to keep (default fireplace,wall-tv)
//     --rooms a,b       only these rooms (by name or no)
//     --style <key>     furnish every composed room in this style (modern, farmhouse, cottage, mediterranean,
//                       mid-century, industrial, scandi, tropical, craftsman) instead of the house's
//     --seed <s>        re-roll every composed room (appended to the room's seed: the same programs, other arrangements)
//     --density <0..1>  how full the rooms are (default: each room's own, else 0.5)
//     --rebake          also redo rooms already baked (lock: true): their compose@1 items are dropped and composed again
//     --write           bake: write the composed items into the room's `items` (src: 'compose@1'), and set `lock: true`
//                       so the build does not compose the room a second time — the room is now hand-tunable. Writes to
//                       --out, else back to the source file. NOTE: streams do not bake into content/houses/ (plan §2.0);
//                       the layout pass does, on purpose.
//     --out <file>      where --write puts the spec (or, without --write, a dry-run copy of it to render)
//     --lint            the layout lints (assets/layout-lint.ts) of the result, by code
//     --json            print the report as JSON
//
//   The dress phase (plan 5.6, assets/room-dress.ts) is a second, separate pass over a frozen layout; these two flags do ONLY it (the layout is never recomposed):
//     --dress           add the dress phase's items (src: 'dress@1', the small goods, lamps, towels) to every room that has a recipe and no `dress: false`, at
//                       --level <0..1> (default each room's own `dress.level`, else 0.5). Idempotent: every dress@1 item is stripped first, so a second run writes the same file
//     --undress         strip every dress@1 item, and nothing else
//     --rooms a,b       (with either) only these rooms;  --write / --out <file>  as above (--dress / --undress never lock a room)
//   A dress item stands on a host the layout made, so redo it after a layout re-bake. Streams never bake into content/houses/ (plan 5.6): the pilot and the fleet pass do.
//
// Re-baking is safe: an item the composer wrote carries `src: 'compose@1'`, an authored one does not, so a re-bake
// keeps yours and replaces the composer's. JSON is written with 2-space indent like the specs (a float authored as
// `3.0` comes back as `3`: the numbers are the same).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes('--' + n);
const opt = (n: string): string | null => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const src = opt('house');
if (!src) { console.error('usage: compose-house.mts --house <id | path.json> [--infer [--replace]] [--rooms a,b] [--style k] [--seed s] [--density n] [--rebake] [--write] [--out file] [--lint] [--json]'); process.exit(2); }

const file = [src, path.join(ROOT, 'content', 'houses', `${src}.json`), path.join(ROOT, 'test', 'fixtures', 'houses', `${src}.json`)].find(f => f.endsWith('.json') && fs.existsSync(f));
if (!file) { console.error(`no spec "${src}" (looked in content/houses, test/fixtures/houses and as a path)`); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const { composeHouse } = await import(path.join(ROOT, 'assets', 'room-composer.js'));
const { inferProgram, isProgram, isComposed, PROGRAMS } = await import(path.join(ROOT, 'assets', 'room-programs.js'));
const { STYLE_KEYS } = await import(path.join(ROOT, 'assets', 'house-styles.js'));
const { lintLayout } = await import(path.join(ROOT, 'assets', 'layout-lint.js'));
const { PLACEMENT } = await import(path.join(ROOT, 'assets', 'props', 'placement.js'));
const SRC = 'compose@1', DRESS_SRC = 'dress@1';   // (a layout re-bake strips both: a dress item stands on a host the new layout may not have, the dress phase makes them again)

const only = opt('rooms') ? new Set(opt('rooms')!.split(',').map(s => s.trim())) : null;
const style = opt('style'); if (style && !STYLE_KEYS.includes(style)) { console.error(`unknown style "${style}": ${STYLE_KEYS.join(', ')}`); process.exit(2); }
const seed = opt('seed'), density = opt('density') !== null ? Number(opt('density')) : null;
if (density !== null && !(density >= 0 && density <= 1)) { console.error('--density is 0..1'); process.exit(2); }
const INFER = flag('infer'), REPLACE = flag('replace'), REBAKE = flag('rebake'), WRITE = flag('write'), DRESS = flag('dress'), UNDRESS = flag('undress');
if (DRESS && UNDRESS) { console.error('--dress and --undress are one or the other (--dress strips first)'); process.exit(2); }
if (REPLACE && !INFER) { console.error('--replace goes with --infer'); process.exit(2); }
// what --replace keeps: the focal pieces the composer arranges round, and the hero set / structure (the Core's own pieces)
const KEEP = new Set(opt('keep') === 'none' ? [] : (opt('keep') || 'fireplace,wall-tv').split(',').map(t => t.trim()));
const keepsPiece = (it: any) => KEEP.has(it.type) || (opt('keep') !== 'none' && ['hero', 'structure'].includes((PLACEMENT[it.type] || {}).group));

// ---- the dress phase alone: strip, then (--dress) dress, and write
if (DRESS || UNDRESS) {
  const { dressRooms } = await import(path.join(ROOT, 'assets', 'room-dress.js'));
  const level = opt('level') !== null ? Number(opt('level')) : undefined;
  if (level !== undefined && !(level >= 0 && level <= 1)) { console.error('--level is 0..1'); process.exit(2); }
  const wanted = (room: any) => !only || only.has(room.name) || only.has(String(room.no));
  let stripped = 0, added = 0;
  for (const lv of spec.levels || []) for (const room of lv.rooms || []) {
    if (!room.bounds || !wanted(room)) continue;
    if (room.items) { const before = room.items.length; room.items = room.items.filter((i: any) => i.src !== DRESS_SRC); stripped += before - room.items.length; }
  }
  const rows: Array<{ level: string; name: string; program: string; items: number; level_: number; slots: string; skipped: number }> = [];
  if (DRESS) {
    const res = dressRooms(spec, level === undefined ? {} : { level });
    for (const lv of spec.levels || []) for (const room of lv.rooms || []) {
      const r = res.get(room); if (!r || !wanted(room)) continue;
      room.items = [...(room.items || []), ...r.items]; added += r.items.length;
      rows.push({ level: lv.id, name: room.name, program: r.program, items: r.items.length, level_: r.level, slots: r.slots.map((x: any) => `${x.slot}:${x.n}`).join(' '), skipped: r.skipped.length });
    }
  }
  console.log(`${path.relative(process.cwd(), file)}: ${UNDRESS ? `stripped ${stripped} dress item${stripped === 1 ? '' : 's'}` : `dressed ${rows.length} room${rows.length === 1 ? '' : 's'} with ${added} items${stripped ? ` (after stripping ${stripped})` : ''}`}`);
  for (const r of rows) console.log(`  ${r.level} ${r.name.padEnd(26)} ${r.program.padEnd(14)} ${String(r.items).padStart(3)} items at level ${r.level_}  ${r.slots}${r.skipped ? `  (${r.skipped} skipped)` : ''}`);
  if (WRITE || opt('out')) {
    const out = opt('out') ? path.resolve(opt('out')!) : file;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(spec, null, 2) + '\n');
    console.log(`written → ${path.relative(process.cwd(), out)}`);
  }
  process.exit(0);
}

// ---- prepare the copy: which rooms compose, and as what
const picked: Array<{ lv: any; room: any; inferred: boolean }> = [];
for (const lv of spec.levels || []) for (const room of lv.rooms || []) {
  if (!room.bounds) continue;
  if (only && !only.has(room.name) && !only.has(String(room.no))) continue;
  const items: any[] = room.items || [];
  if (REBAKE && room.lock) { room.items = items.filter(i => i.src !== SRC && i.src !== DRESS_SRC); delete room.lock; }
  let inferred = false;
  if (!isProgram(room.program)) {
    if (!INFER) continue;
    const p = inferProgram(room, lv); if (!p) continue;
    room.program = p; inferred = true;
  }
  if (room.lock) continue;   // a baked room stays baked
  if (INFER && REPLACE && inferred) room.items = items.filter(keepsPiece);
  if (style) room.style = style;
  if (seed !== null) room.seed = room.seed !== undefined ? `${room.seed}:${seed}` : seed;
  if (density !== null) room.density = density;
  picked.push({ lv, room, inferred });
}
if (!picked.length) { console.log(`${path.relative(process.cwd(), file)}: no room to compose (give a room a "program", or --infer to read it off the names${REBAKE ? '' : '; --rebake redoes baked rooms'})`); process.exit(0); }

// ---- compose (composeHouse caches per spec object; this spec is the copy, mutated above)
const t0 = performance.now();
const res = composeHouse(spec);
const ms = performance.now() - t0;
const rows = picked.map(({ lv, room, inferred }) => {
  const r = res.get(room);
  return { level: lv.id, no: room.no, name: room.name, program: room.program, inferred, style: r ? r.style : null, items: r ? r.items.length : 0, pins: (room.items || []).length, lane: r ? r.laneWidth : null, laneOk: r ? r.lanes.ok : null, geometry: r && r.geometry ? r.geometry.length : 0, groups: r ? r.groups : [], dropped: r ? r.dropped : [] };
});
const lint = flag('lint') ? (() => { const counts: Record<string, string[]> = {}; for (const is of lintLayout(bake(spec, res))) (counts[is.code] ||= []).push(is.message); return counts; })() : null;

function bake(s: any, results: Map<any, any>) {
  const copy = JSON.parse(JSON.stringify(s));
  const rooms = (sp: any) => (sp.levels || []).flatMap((lv: any) => lv.rooms || []);
  const srcRooms = rooms(s), dstRooms = rooms(copy);
  srcRooms.forEach((room: any, i: number) => {
    const r = results.get(room); if (!r) return;
    const dst = dstRooms[i];
    dst.items = [...(room.items || []).filter((it: any) => it.src !== SRC && it.src !== DRESS_SRC), ...r.items];
    dst.lock = true;
  });
  return copy;
}

if (flag('json')) {
  console.log(JSON.stringify({ file: path.relative(ROOT, file), ms: Math.round(ms), rooms: rows, lint }, null, 1));
} else {
  console.log(`${path.relative(process.cwd(), file)}: ${rows.length} room${rows.length === 1 ? '' : 's'} composed in ${(ms / 1000).toFixed(2)} s${style ? ` (style ${style})` : ''}`);
  for (const r of rows) {
    console.log(`  ${r.level} ${String(r.no ?? '').padEnd(3)} ${r.name.padEnd(24)} ${r.program.padEnd(14)}${r.inferred ? ' (inferred)' : '           '} ${String(r.items).padStart(3)} items${r.pins ? ` beside ${r.pins} pinned` : ''}, style ${r.style}, lanes ${r.lane} m${r.laneOk ? '' : ' NOT ALL OPEN' + (r.geometry ? ` (${r.geometry} blocked by the room's own stairs or voids)` : '')}${r.dropped.length ? `, could not place: ${r.dropped.join(', ')}` : ''}`);
  }
  if (lint) { console.log('layout lints of the result:'); const keys = Object.keys(lint).sort(); if (!keys.length) console.log('  none'); for (const k of keys) { console.log(`  ${k} ${lint[k].length}`); for (const m of lint[k].slice(0, 3)) console.log(`     ${m}`); } }
}

if (WRITE || opt('out')) {
  const out = opt('out') ? path.resolve(opt('out')!) : file;
  const baked = WRITE ? bake(spec, res) : spec;
  if (!WRITE) { /* a dry-run copy: the programs are in it, the items are not baked */ }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(baked, null, 2) + '\n');
  console.log(`${WRITE ? 'baked' : 'copy written'} → ${path.relative(process.cwd(), out)}`);
}
