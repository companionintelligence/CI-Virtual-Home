#!/usr/bin/env -S node --experimental-strip-types
// The room composer's acceptance (plan S3), in Node, on the 30 real specs:
//
//   1. Dry run: every room of every spec composed from scratch (its authored items dropped, its program read off its
//      name — assets/room-programs.ts inferProgram), twice; the two runs must hash equal (determinism), and one run
//      must take under 10 s (reported; the gate fails only past 30 s, since the machine is shared).
//   2. Every composed room: 0 overlaps and 0 door swings blocked (assets/layout-lint.ts), 0 items through a wall
//      (inside the wall faces within 2 cm), and lanes of at least 0.8 m from every way in to every other and to the
//      middle — in 100 % of the rooms whose bare geometry allows one (a room its stair or voids already block is counted
//      apart and listed).
//   3. Repetition: the fleet's top-12 furniture types (by houses using them) against the hand-authored fleet — down by at
//      least half. Furniture here is what a room is furnished with: fitted kitchens, bath fittings, lamps and light
//      fixtures, the Core's desk set and structure are left out (a house needs one toilet whatever the composer does).
//      The S0 fleet metric (every type, test/fleet/baseline.json) is printed beside it.
//   4. The catalog tells the truth: every placement entry names a known type, ≥ 90 % of catalog types have one, the page
//      builders' declared sizes and the registry props' footprints agree with content/house-catalog.json's measured
//      boxes (±0.15 m), and content/house-styles.json is assets/house-styles.ts.
//   5. The authored fleet's layout-lint counts per code (the baseline the layout pass works down), printed.
//
//   node --experimental-strip-types scripts/test-room-composer.mts [--house a,b] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2), VERBOSE = argv.includes('--verbose');
const onlyHouses = (() => { const i = argv.indexOf('--house'); return i >= 0 ? argv[i + 1].split(',') : null; })();
const { composeHouse, inferProgram } = await import(path.join(ROOT, 'assets', 'room-composer.js'));
const { lintLayout } = await import(path.join(ROOT, 'assets', 'layout-lint.js'));
const { analyzeRoom, itemObb, aabb, limitOf, alongX, sizeOf } = await import(path.join(ROOT, 'assets', 'room-geo.js'));
const { PLACEMENT } = await import(path.join(ROOT, 'assets', 'props', 'placement.js'));
const { PROPS } = await import(path.join(ROOT, 'assets', 'props', 'index.js'));
const { STYLES } = await import(path.join(ROOT, 'assets', 'house-styles.js'));
const { layerOf } = await import(path.join(ROOT, 'assets', 'room-composer.js'));

const HOUSES = path.join(ROOT, 'content', 'houses');
const ids = (onlyHouses || fs.readdirSync(HOUSES).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, ''))).sort();
const load = (id: string) => JSON.parse(fs.readFileSync(path.join(HOUSES, `${id}.json`), 'utf8'));
let failed = 0;
const fail = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ---- 1. the dry run, twice ----------------------------------------------------------------------------------------------
function dryRun() {
  const out: Array<{ id: string; spec: any; rooms: Array<{ lv: any; room: any; res: any }> }> = [];
  for (const id of ids) {
    const spec = load(id);
    for (const lv of spec.levels || []) for (const r of lv.rooms || []) r.items = [];
    const res = composeHouse(spec, { program: (room: any, lv: any) => inferProgram(room, lv) });
    const rooms: any[] = [];
    for (const lv of spec.levels || []) for (const room of lv.rooms || []) if (res.has(room)) rooms.push({ lv, room, res: res.get(room) });
    out.push({ id, spec, rooms });
  }
  return out;
}
const hashOf = (run: ReturnType<typeof dryRun>) => crypto.createHash('sha256').update(JSON.stringify(run.map(h => h.rooms.map(r => [r.lv.id, r.room.name, r.res.program, r.res.items])))).digest('hex');
console.log('── dry run: every room of the fleet composed from its name');
let t0 = performance.now();
const run1 = dryRun();
const ms1 = performance.now() - t0;
t0 = performance.now();
const run2 = dryRun();
const ms2 = performance.now() - t0;
const rooms = run1.flatMap(h => h.rooms), items = rooms.reduce((a, r) => a + r.res.items.length, 0);
console.log(`  ${ids.length} houses, ${rooms.length} rooms composed, ${items} items; ${(ms1 / 1000).toFixed(1)} s and ${(ms2 / 1000).toFixed(1)} s`);
if (hashOf(run1) === hashOf(run2)) ok(`deterministic: the two runs hash equal (${hashOf(run1).slice(0, 12)})`); else fail('the two runs differ');
if (ms1 > 30000) fail(`one run took ${(ms1 / 1000).toFixed(1)} s (budget 10 s)`); else (ms1 <= 10000 ? ok : (m: string) => console.log(`  ! ${m}`))(`one run in ${(ms1 / 1000).toFixed(1)} s (budget 10 s)`);

// ---- 2. every composed room: overlaps, walls, door swings, lanes ---------------------------------------------------------
console.log('── the composed rooms');
const counts: Record<string, number> = { overlap: 0, 'door-swing': 0, lane: 0, pierce: 0 };
let geometryBlocked = 0, laneRooms = 0;
for (const h of run1) {
  const override = new Map<any, any[]>();
  for (const lv of h.spec.levels || []) for (const r of lv.rooms || []) override.set(r, []);
  for (const r of h.rooms) override.set(r.room, r.res.items);
  for (const is of lintLayout(h.spec, { items: override, only: new Set(['overlap', 'door-swing', 'lane']) })) {
    counts[is.code]++; if (VERBOSE || counts[is.code] <= 5) console.log(`    ${h.id}: ${is.message} [${is.code}]`);
  }
  for (const r of h.rooms) {
    if (r.res.geometry && r.res.geometry.length) geometryBlocked++; else laneRooms++;
    const geo = analyzeRoom(h.spec, r.lv, r.room);
    for (const it of r.res.items) {
      const l = layerOf(it.type); if (l === 'wall' || l === 'ceiling' || l === 'surface') continue;
      const o = itemObb(it); if (!o) continue; const A = aabb(o);
      const outs = [limitOf(geo, 'N', A.x0, A.x1) - A.z0, A.z1 - limitOf(geo, 'S', A.x0, A.x1), limitOf(geo, 'W', A.z0, A.z1) - A.x0, A.x1 - limitOf(geo, 'E', A.z0, A.z1)];
      if (Math.max(...outs) > 0.02) { counts.pierce++; if (VERBOSE || counts.pierce <= 5) console.log(`    ${h.id}: ${r.room.name}: ${it.type} at (${it.at}) stands ${Math.max(...outs).toFixed(2)} m past its room's wall or edge`); }
    }
  }
}
(counts.overlap ? fail : ok)(`${counts.overlap} overlaps`);
(counts.pierce ? fail : ok)(`${counts.pierce} items through a wall or out of their room`);
(counts['door-swing'] ? fail : ok)(`${counts['door-swing']} door swings blocked`);
(counts.lane ? fail : ok)(`lanes of 0.8 m in ${laneRooms - counts.lane} of ${laneRooms} rooms whose geometry allows one (${geometryBlocked} more are blocked by their own stairs, voids or pins, whatever is in them)`);

// ---- 3. repetition -------------------------------------------------------------------------------------------------------------
console.log('── repetition: the top-12 furniture types, by houses using them');
const HERO = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);
const FUNCTIONAL = new Set(['fitted', 'appliance', 'bath', 'lighting', 'lamp', 'hero', 'structure']);
const furniture = (t: string) => !HERO.has(t) && !FUNCTIONAL.has((PLACEMENT[t] || {}).group);
function top12(fleet: Array<{ id: string; items: any[] }>, keep: (t: string) => boolean) {
  const houses = new Map<string, Set<string>>(), n = new Map<string, number>();
  for (const h of fleet) for (const it of h.items) { if (!keep(it.type)) continue; (houses.get(it.type) || houses.set(it.type, new Set()).get(it.type)!).add(h.id); n.set(it.type, (n.get(it.type) || 0) + 1); }
  const rows = [...houses.entries()].map(([t, s]) => [t, s.size, n.get(t)!] as [string, number, number]).sort((a, b) => b[1] - a[1] || b[2] - a[2] || (a[0] < b[0] ? -1 : 1)).slice(0, 12);
  return { rows, houses: rows.reduce((a, r) => a + r[1], 0), items: rows.reduce((a, r) => a + r[2], 0) };
}
const authored = ids.map(id => ({ id, items: (load(id).levels || []).flatMap((lv: any) => (lv.rooms || []).flatMap((r: any) => r.items || [])) }));
const composed = run1.map(h => ({ id: h.id, items: h.rooms.flatMap(r => r.res.items) }));
const aF = top12(authored, furniture), cF = top12(composed, furniture);
const table = (t: ReturnType<typeof top12>) => t.rows.map(r => `${r[0]} ${r[1]}`).join(', ');
console.log(`  authored: ${table(aF)}  → ${aF.houses} house-uses`);
console.log(`  composed: ${table(cF)}  → ${cF.houses} house-uses`);
const drop = 1 - cF.houses / aF.houses;
(drop >= 0.5 ? ok : fail)(`furniture top-12 repetition down ${(drop * 100).toFixed(0)} % (target ≥ 50 %)`);
const aAll = top12(authored, t => !HERO.has(t)), cAll = top12(composed, t => !HERO.has(t));
console.log(`  (the S0 fleet metric, every type: authored top-12 ${aAll.houses} house-uses / ${aAll.items} items → composed ${cAll.houses} / ${cAll.items}; ${table(cAll)})`);

// ---- 4. the catalog -------------------------------------------------------------------------------------------------------------
console.log('── the catalog and the style bundles');
const catPath = path.join(ROOT, 'content', 'house-catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8')).types || {};
const unknown = Object.keys(PLACEMENT).filter(t => !cat[t] && !PROPS.has(t));
(unknown.length ? fail : ok)(`${unknown.length} placement entries for unknown types${unknown.length ? ': ' + unknown.join(', ') : ''}`);
const catTypes = Object.keys(cat), placed = catTypes.filter(t => PLACEMENT[t]);
(placed.length / catTypes.length >= 0.9 ? ok : fail)(`placement metadata for ${placed.length} of ${catTypes.length} catalog types (${(placed.length / catTypes.length * 100).toFixed(0)} %, target ≥ 90 %)`);
const missing = [...PROPS.keys()].filter(t => !cat[t]);
(missing.length ? fail : ok)(`${missing.length} registry props missing from the catalog${missing.length ? ` (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}): pnpm run catalog` : ''}`);
const drift: string[] = [];
for (const t of catTypes) {
  const m = cat[t], s = sizeOf(t, {}); if (!s || !m.box) continue;
  const [x0, , z0, x1, , z1] = m.box, w = x1 - x0, d = z1 - z0, ox = (x0 + x1) / 2, oz = (z0 + z1) / 2;
  const bad = Math.abs(w - s.w) > 0.15 || Math.abs(d - s.d) > 0.15 || Math.abs(m.height - s.h) > 0.2 || Math.abs(ox - s.ox) > 0.12 || Math.abs(oz - s.oz) > 0.12;
  if (bad) drift.push(`${t} declared ${s.w.toFixed(2)}×${s.d.toFixed(2)}×${s.h.toFixed(2)} @(${s.ox.toFixed(2)},${s.oz.toFixed(2)}), measured ${w.toFixed(2)}×${d.toFixed(2)}×${m.height.toFixed(2)} @(${ox.toFixed(2)},${oz.toFixed(2)})`);
}
(drift.length ? fail : ok)(`${drift.length} types whose declared size disagrees with the measured catalog${drift.length ? ':\n      ' + drift.join('\n      ') : ''}`);
const stylesPath = path.join(ROOT, 'content', 'house-styles.json');
const stylesJson = fs.existsSync(stylesPath) ? JSON.parse(fs.readFileSync(stylesPath, 'utf8')) : null;
(stylesJson && JSON.stringify(stylesJson.styles) === JSON.stringify(STYLES) ? ok : fail)(`content/house-styles.json ${stylesJson ? 'matches' : 'is missing:'} assets/house-styles.ts${stylesJson && JSON.stringify(stylesJson.styles) !== JSON.stringify(STYLES) ? ' — it does not: pnpm run catalog' : ''}`);

// ---- 5. the authored fleet's lint baseline -------------------------------------------------------------------------------------
console.log('── layout lints on the authored fleet (baseline, warnings)');
const lintCounts: Record<string, number> = {};
for (const id of ids) for (const is of lintLayout(load(id))) lintCounts[is.code] = (lintCounts[is.code] || 0) + 1;
console.log('  ' + Object.entries(lintCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
