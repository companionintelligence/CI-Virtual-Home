#!/usr/bin/env -S node --experimental-strip-types
// The room composer's acceptance (plan S3), in Node, on the 30 real specs and the fixtures.
// @check-house quick
//
//   1. Dry run: every room of every spec composed from scratch (its authored items dropped, its program read off its
//      name — assets/room-programs.ts inferProgram), twice; the two runs must hash equal (determinism), and one run
//      takes well under 10 s of CPU (reported: the machine is shared, so the gate fails only past 30 s of CPU).
//   2. Every composed room: 0 overlaps and 0 door swings blocked (assets/layout-lint.ts), 0 items through a wall or out
//      of their room, and lanes of at least 0.8 m from every way in to every other and to the middle — in 100 % of the
//      rooms whose bare geometry allows one (a room its stair or voids already block is counted apart).
//   3. Repetition. The owner's complaint is the same furniture in every house, and the plan's target is "the top 12
//      types down at least 50 % against the hand-authored baseline". Three readings, all held, all of FURNITURE (what a
//      room is furnished with: the fitted kitchen, appliances, bath fittings, lamps, fixtures and the Core's desk set
//      are left out — a house needs a toilet and a range whatever the composer does):
//        a. the hand-authored fleet's twelve most repeated types: the houses that still use them, down ≥ 50 %;
//        b. the types that turn up in 20 or more houses (plan §1: "12 types appear in at least 20 houses"): down ≥ 50 %;
//        c. no furniture type in more than three quarters of the houses.
//      The composed fleet's own top 12 and the S0 fleet metric (every type, items) are printed beside them.
//   4. Variety, by role (sofas, sectionals, armchairs, dining tables and chairs, floor plants): enough real alternatives
//      in use, none in more than 60 % of the houses; and the composer varies them by SEED (the same houses re-rolled give
//      other arrangements) and by STYLE (one room in each of the nine styles reaches for different pieces).
//   5. The catalog tells the truth: every placement entry names a known type, ≥ 90 % of catalog types have one, the
//      page builders' declared sizes and the registry props' footprints agree with content/house-catalog.json's measured
//      boxes, a surface prop is an onSurface placement, no prop costs more than 60 draw calls (meshes), and
//      content/house-styles.json is assets/house-styles.ts.
//   6. The authored fleet's layout-lint counts per code (the baseline the layout pass works down), printed.
//
//   node --experimental-strip-types scripts/test-room-composer.mts [--house a,b] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { M, dryRun, houseIds, loadSpec, authoredFleet, composedFleet, tally, top12, HERO_SET, FUNCTIONAL } from './fleet/_compose-dry.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2), VERBOSE = argv.includes('--verbose');
const onlyHouses = (() => { const i = argv.indexOf('--house'); return i >= 0 ? argv[i + 1].split(',') : null; })();
if (!M) { console.error('the composer is not built: pnpm run build'); process.exit(2); }
const { composeHouse, lintLayout, PLACEMENT, layerOf } = { ...M, lintLayout: M.lint.lintLayout } as any;
const { analyzeRoom, itemObb, aabb, limitOf, sizeOf } = M.geo;
const { STYLES, STYLE_KEYS } = M.styles;
const { PROPS } = await import(path.join(ROOT, 'assets', 'props', 'index.js'));
const { RUG_PATTERNS, ART_MOTIFS } = await import(path.join(ROOT, 'assets', 'props', 'patterns.js'));

const ids = (onlyHouses || houseIds()).sort();
const specs = ids.map(id => ({ id, spec: loadSpec(id) }));
let failed = 0;
const fail = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);
const note = (m: string) => console.log(`  ! ${m}`);
const check = (cond: boolean, m: string) => (cond ? ok : fail)(m);

// ---- 1. the dry run, twice ----------------------------------------------------------------------------------------------
console.log('── dry run: every room of the fleet composed from its name');
const timed = <T,>(f: () => T) => { const c0 = process.cpuUsage(), t0 = performance.now(), v = f(), c1 = process.cpuUsage(c0); return { v, wall: performance.now() - t0, cpu: (c1.user + c1.system) / 1000 }; };
const r1 = timed(() => dryRun(specs)), r2 = timed(() => dryRun(specs));
const run1 = r1.v, run2 = r2.v;
const rooms = run1.flatMap(h => h.rooms), items = rooms.reduce((a, r) => a + r.res.items.length, 0);
console.log(`  ${ids.length} houses, ${rooms.length} rooms composed, ${items} items; ${(r1.cpu / 1000).toFixed(1)} s and ${(r2.cpu / 1000).toFixed(1)} s of CPU (${(r1.wall / 1000).toFixed(1)} s and ${(r2.wall / 1000).toFixed(1)} s wall)`);
const hashOf = (run: typeof run1) => crypto.createHash('sha256').update(JSON.stringify(run.map(h => h.rooms.map(r => [r.lv.id, r.room.name, r.res.program, r.res.items])))).digest('hex');
check(hashOf(run1) === hashOf(run2), `deterministic: the two runs hash equal (${hashOf(run1).slice(0, 12)})`);
if (r1.cpu > 30000) fail(`one run took ${(r1.cpu / 1000).toFixed(1)} s of CPU (budget 10 s; the gate fails past 30 s, since the machine is shared)`);
else if (r1.cpu > 10000) note(`one run took ${(r1.cpu / 1000).toFixed(1)} s of CPU (budget 10 s)`);
else ok(`one run in ${(r1.cpu / 1000).toFixed(1)} s of CPU (budget 10 s)`);

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
check(!counts.overlap, `${counts.overlap} overlaps`);
check(!counts.pierce, `${counts.pierce} items through a wall or out of their room`);
check(!counts['door-swing'], `${counts['door-swing']} door swings blocked`);
check(!counts.lane, `lanes of 0.8 m in ${laneRooms - counts.lane} of ${laneRooms} rooms whose geometry allows one (${geometryBlocked} more are blocked by their own stairs, voids or pins, whatever is in them)`);

// every lint over the composed fleet: the ones about the composer's own pieces are zero, the rest (the geometry's and the
// hand-authored Core's: a stair with no run-in, an entry that faces a wall) are reported beside the authored baseline
{
  const own = ['overlap', 'wall-pierce', 'outside-room', 'door-swing', 'lane', 'mount-in-wall', 'surface-height', 'silent-param', 'kitchen-backwards', 'facing'];
  const all: Record<string, number> = {};
  for (const h of run1) {
    const override = new Map<any, any[]>();
    for (const lv of h.spec.levels || []) for (const r of lv.rooms || []) override.set(r, []);
    for (const r of h.rooms) override.set(r.room, r.res.items);
    for (const is of lintLayout(h.spec, { items: override })) all[is.code] = (all[is.code] || 0) + 1;
  }
  const bad = own.filter(k => all[k]);
  check(!bad.length, `the composed fleet has none of the composer's own lints (${own.join(', ')})${bad.length ? ': ' + bad.map(k => `${k} ${all[k]}`).join(', ') : ''}`);
  console.log(`  the rest, composed: ${Object.entries(all).filter(([k]) => !own.includes(k)).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'} (the geometry's, and the authored Core's: see the baseline below)`);
  check((all.repetition || 0) <= 6, `repetition warnings on the composed fleet: ${all.repetition || 0} (target ≤ 6; the authored fleet has 78)`);
}

// what a room of each program cannot do without: the group the composer must have placed
const ESSENTIAL: Record<string, string[]> = {
  living: ['lounge'], den: ['lounge'], media: ['lounge'], dining: ['dining'], kitchen: ['kitchen'], 'kitchen-dining': ['kitchen', 'dining'],
  'bed-primary': ['bed'], 'bed-guest': ['bed'], 'bed-kid': ['bed'], nursery: ['bed'], bath: ['toilet', 'vanity'], ensuite: ['toilet', 'vanity'], powder: ['toilet', 'vanity'],
};
{
  let need = 0, lacking = 0; const misses: string[] = [];
  for (const h of run1) for (const r of h.rooms) {
    const ess = ESSENTIAL[r.res.program]; if (!ess) continue;
    need++;
    const gone = ess.filter(n => r.res.dropped.includes(n));
    if (gone.length) { lacking++; misses.push(`${h.id} "${r.room.name}" (${r.res.program}): no ${gone.join(', ')}`); }
  }
  for (const m of misses.slice(0, VERBOSE ? 99 : 6)) console.log(`    ${m}`);
  check(need > 0 && lacking / need <= 0.03, `every room's essentials placed (lounge, dining table, kitchen run, bed, toilet and sink): ${need - lacking} of ${need} rooms (target ≥ 97 %; the rest are rooms too small for what they are named)`);
}

// ---- 3. repetition -------------------------------------------------------------------------------------------------------------
console.log('── repetition: the same furniture in every house');
const furniture = (t: string) => !HERO_SET.has(t) && !FUNCTIONAL.has((PLACEMENT[t] || {}).group);
const A = tally(authoredFleet(specs), furniture), C = tally(composedFleet(run1), furniture);
const aTop = top12(A), cTop = top12(C), cAll = tally(composedFleet(run1)), aAll = tally(authoredFleet(specs));
const inC = new Map(C.map(r => [r.type, r.houses]));
const sameTwelve = aTop.rows.reduce((a, r) => a + (inC.get(r.type) || 0), 0);
console.log(`  authored top 12: ${aTop.rows.map(r => `${r.type} ${r.houses}`).join(', ')}  → ${aTop.houses} house-uses`);
console.log(`  … the same 12 in the composed fleet: ${aTop.rows.map(r => `${r.type} ${inC.get(r.type) || 0}`).join(', ')}  → ${sameTwelve}`);
console.log(`  composed top 12 (its own): ${cTop.rows.map(r => `${r.type} ${r.houses}`).join(', ')}  → ${cTop.houses} house-uses`);
const n20 = (rows: Array<{ houses: number }>) => rows.filter(r => r.houses >= 20).length, a20 = n20(A), c20 = n20(C);
console.log(`  (the S0 fleet metric, every type: ${n20(aAll)} types in 20 or more houses authored → ${n20(cAll)} composed; its top 12 hold ${top12(aAll).items} authored items → ${top12(cAll).items} composed)`);
const drop = 1 - sameTwelve / Math.max(1, aTop.houses);
check(drop >= 0.5, `the authored fleet's twelve most repeated furniture types: ${aTop.houses} → ${sameTwelve} house-uses, down ${(drop * 100).toFixed(0)} % (target ≥ 50 %)`);
check(c20 <= a20 / 2, `furniture types in 20 or more houses: ${a20} → ${c20} (target ≤ half)`);
const busiest = C[0];
check(busiest.houses <= Math.ceil(ids.length * 3 / 4), `the busiest furniture type, ${busiest.type}, is in ${busiest.houses} of ${ids.length} houses (target ≤ three quarters)`);

// ---- 4. variety, by role, by seed, by style -----------------------------------------------------------------------------------
console.log('── variety: real alternatives, varied by seed and by style');
const ROLE_GROUPS: Array<[string, string[], number]> = [
  ['sofas', ['sofa', 'loveseat'], 5], ['sectionals', ['sofa-l'], 2], ['armchairs', ['armchair'], 5],
  ['dining tables', ['dining-table', 'dining-table-round'], 4], ['dining chairs', ['dining-chair'], 4], ['floor plants', ['plant-floor'], 6],
];
const cmp = composedFleet(run1), aut = authoredFleet(specs);
for (const [label, roles, need] of ROLE_GROUPS) {
  const inRole = (t: string) => (PLACEMENT[t] || { roles: [] }).roles.some((r: string) => roles.includes(r));
  const a = tally(aut, inRole), c = tally(cmp, inRole), share = c.length ? c[0].houses / ids.length : 0;
  console.log(`  ${label.padEnd(14)} authored ${a.length} (${a.slice(0, 2).map(r => `${r.type} ${r.houses}`).join(', ') || 'none'}) → composed ${c.length} (${c.slice(0, 4).map(r => `${r.type} ${r.houses}`).join(', ')})`);
  check(c.length >= need && share <= 0.6, `${label}: ${c.length} types in use (≥ ${need}), the most used in ${(share * 100).toFixed(0)} % of the houses (≤ 60 %)`);
}
// by seed: the same fleet re-rolled (every room's seed re-keyed) arranges most rooms otherwise
const reroll = dryRun(specs, { variant: 'again' });
let same = 0, total = 0;
for (let i = 0; i < run1.length; i++) run1[i].rooms.forEach((r, k) => {
  if (r.res.items.length < 5) return; total++;
  if (JSON.stringify(r.res.items) === JSON.stringify(reroll[i].rooms[k].res.items)) same++;
});
check(total > 0 && same / total <= 0.1, `by seed: ${total - same} of ${total} furnished rooms come out differently when their seed changes (target ≥ 90 %)`);
// by style: one house's rooms, furnished in each of the nine styles, reach for different pieces
{
  const base = specs.find(s => s.id === 'aurora') || specs[0], per = new Map<string, Set<string>>();
  for (const key of STYLE_KEYS) {
    const spec = JSON.parse(JSON.stringify(base.spec)); spec.styleKey = key;
    const res = dryRun([{ id: `${base.id}-${key}`, spec }])[0];
    per.set(key, new Set(res.rooms.flatMap(r => r.res.items.map((i: any) => i.type))));
  }
  const all = [...per.values()]; let dist = 0, pairs = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const inter = [...all[i]].filter(t => all[j].has(t)).length, uni = new Set([...all[i], ...all[j]]).size; dist += 1 - inter / uni; pairs++; }
  const mean = dist / pairs;
  check(mean >= 0.2, `by style: one house in each of the ${STYLE_KEYS.length} styles, two styles share on average ${((1 - mean) * 100).toFixed(0)} % of the types they use (target ≤ 80 %)`);
}

// ---- 4b. baking: compose-house.mts --write turns a composition into items, and a re-bake changes nothing
console.log('── baking a composition (compose-house.mts --write)');
{
  const { spawnSync } = await import('node:child_process'), os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-bake-')), a = path.join(dir, 'a.json'), b = path.join(dir, 'b.json');
  const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'compose-house.mts'), ...args], { encoding: 'utf8' });
  const src = path.join(ROOT, 'test', 'fixtures', 'houses', 's3-compose-house.json');
  const r1 = run('--house', src, '--write', '--out', a), r2 = run('--house', a, '--rebake', '--write', '--out', b);
  check(r1.status === 0 && r2.status === 0, `compose-house.mts --write and --rebake run (${r1.status}, ${r2.status})`);
  if (r1.status === 0 && r2.status === 0) {
    const baked = JSON.parse(fs.readFileSync(a, 'utf8')), again = JSON.parse(fs.readFileSync(b, 'utf8')), orig = JSON.parse(fs.readFileSync(src, 'utf8'));
    const rs = (sp: any) => (sp.levels || []).flatMap((lv: any) => lv.rooms || []);
    const composed = composeHouse(JSON.parse(JSON.stringify(orig)));
    const oRooms = rs(orig);
    // the baked items are the composer's, after the pins, with the room locked; composing the baked spec composes nothing
    let same = true, pinsKept = true, locked = true;
    rs(baked).forEach((room: any, i: number) => {
      const mine = [...composed.entries()].find(([r]: any) => r.name === room.name);
      const pins = (oRooms[i].items || []), made = room.items.filter((it: any) => it.src === 'compose@1');
      if (mine && JSON.stringify(made) !== JSON.stringify((mine[1] as any).items)) same = false;
      if (JSON.stringify(room.items.filter((it: any) => it.src !== 'compose@1')) !== JSON.stringify(pins)) pinsKept = false;
      if (room.program && room.lock !== true) locked = false;
    });
    check(same, 'the baked items are exactly what the build composes (src compose@1)');
    check(pinsKept, "the authored items (the pins) are kept, in order, beside them");
    check(locked, 'every baked room is locked, so the build does not compose it a second time');
    check(JSON.stringify(baked) === JSON.stringify(again), 're-baking a baked house changes nothing');
    check(composeHouse(baked).size === 0, 'composing the baked house composes no room');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- 4c. the exported helpers: lanes(), snapWallMount(), stackOnSurface(), and the focus fields
console.log('── the helpers and the focus fields');
{
  const { lanes, snapWallMount, stackOnSurface } = M, { analyzeRoom } = M.geo;
  const tidy = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's3-compose-tidy.json'), 'utf8')), lv = tidy.levels[0];
  const untidy = lv.rooms.find((r: any) => r.name === 'Untidy Room'), geo = analyzeRoom(tidy, lv, untidy);
  const art = untidy.items.find((i: any) => i.type === 'wall-art'), snapped = snapWallMount(art, geo);
  check(!!snapped && Math.abs(snapped.at[1] - (-5.95 + 0.003 + 0.02)) < 0.06 && snapped.at[1] > art.at[1], `snapWallMount moves a wall-art authored inside the wall out to its face (z ${art.at[1]} → ${snapped && snapped.at[1]})`);
  check(snapWallMount(snapped, geo) === null, 'snapWallMount leaves a mount that is already on the face alone');
  const lamp = untidy.items.find((i: any) => i.type === 'table-lamp' && i.at[0] < 0), nightLamp = untidy.items.find((i: any) => i.type === 'table-lamp' && i.at[0] > 0);
  const onConsole = stackOnSurface(lamp, untidy.items), onNight = stackOnSurface(nightLamp, untidy.items);
  check(!!onConsole && Math.abs(onConsole.y - 0.8) < 0.011, `stackOnSurface lifts a lamp authored at the 0.77 m desk default onto the console's 0.8 m top (y ${onConsole && onConsole.y})`);
  check(!!onNight && Math.abs(onNight.y - 0.55) < 0.011, `… and lowers one onto a nightstand's 0.55 m top (y ${onNight && onNight.y})`);
  const hall = tidy.levels[0].rooms.find((r: any) => r.name === 'Hall'), corridors = lanes(tidy, lv, hall);
  check(corridors.length > 0 && corridors.every((c: any) => c.rects.length && c.rects.every((o: any) => Math.min(o.hw, o.hd) * 2 >= 0.85)), `lanes() gives the hall's door-to-door corridors, each 0.9 m wide (${corridors.length} of them)`);
  // the focus fields: the bed's head on the wall the author names, an island when the focus says so
  const res = composeHouse(JSON.parse(JSON.stringify(tidy)));
  const named = (n: string) => { for (const [room, r] of res as Map<any, any>) if (room.name === n) return { room, r }; return null; };
  const bedE = named('Bedroom, head on the E wall'), bedS = named('Bedroom, head on the N wall'), kit = named('Kitchen, island asked for by focus');
  const headOn = (x: any, side: 'E' | 'S') => { const bed = x.r.items.find((i: any) => /bed/.test(i.type)), b = x.room.bounds; return side === 'E' ? bed.at[0] > b.x + b.w - 1.5 : bed.at[1] > b.z + b.d - 1.5; };
  check(!!bedE && headOn(bedE, 'E'), 'focus { type: bed, wall: E } puts the headboard on the east wall');
  check(!!bedS && headOn(bedS, 'S'), 'focus { type: bed, wall: S } puts the headboard on the south wall');
  check(!!kit && kit.r.items.some((i: any) => i.type === 'breakfast-bar'), 'focus { type: island } gives the kitchen an island');
}

// ---- 5. the catalog -------------------------------------------------------------------------------------------------------------
console.log('── the catalog and the style bundles');
const catPath = path.join(ROOT, 'content', 'house-catalog.json');
const catJson = JSON.parse(fs.readFileSync(catPath, 'utf8')), cat = catJson.types || {};
const unknown = Object.keys(PLACEMENT).filter(t => !cat[t] && !PROPS.has(t));
check(!unknown.length, `${unknown.length} placement entries for unknown types${unknown.length ? ': ' + unknown.join(', ') : ''}`);
const catTypes = Object.keys(cat), placed = catTypes.filter(t => PLACEMENT[t]);
check(placed.length / catTypes.length >= 0.9, `placement metadata for ${placed.length} of ${catTypes.length} catalog types (${(placed.length / catTypes.length * 100).toFixed(0)} %, target ≥ 90 %)`);
const missing = [...PROPS.keys()].filter(t => !cat[t]);
check(!missing.length, `${missing.length} registry props missing from the catalog${missing.length ? ` (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}): pnpm run catalog` : ''}`);
const drift: string[] = [];
for (const t of catTypes) {
  const m = cat[t], s = sizeOf(t, {}); if (!s || !m.box) continue;
  const [x0, , z0, x1, , z1] = m.box, w = x1 - x0, d = z1 - z0, ox = (x0 + x1) / 2, oz = (z0 + z1) / 2;
  const bad = Math.abs(w - s.w) > 0.15 || Math.abs(d - s.d) > 0.15 || Math.abs(m.height - s.h) > 0.2 || Math.abs(ox - s.ox) > 0.15 || Math.abs(oz - s.oz) > 0.15;
  if (bad) drift.push(`${t} declared ${s.w.toFixed(2)}×${s.d.toFixed(2)}×${s.h.toFixed(2)} @(${s.ox.toFixed(2)},${s.oz.toFixed(2)}), measured ${w.toFixed(2)}×${d.toFixed(2)}×${m.height.toFixed(2)} @(${ox.toFixed(2)},${oz.toFixed(2)})`);
}
check(!drift.length, `${drift.length} types whose declared size disagrees with the measured catalog${drift.length ? ':\n      ' + drift.join('\n      ') : ''}`);
// a registry prop that stands on a surface (`surface: true`) is one the composer stacks (its placement says so), and back
// (a page builder's default height is item-map.ts's SURFACE_ITEMS: the Core's own pieces)
const surf = catTypes.filter(t => cat[t].source === 'registry' && PLACEMENT[t] && !!cat[t].surface !== !!PLACEMENT[t].onSurface && layerOf(t) !== 'wall' && layerOf(t) !== 'ceiling');
check(!surf.length, `${surf.length} types whose catalog surface flag and placement onSurface disagree${surf.length ? ': ' + surf.join(', ') : ''}`);
// draw calls: the catalog records each type's mesh count; nothing a room places costs more than 60 (the Core's own
// pieces, the hero block's, are not the composer's)
const heavy = catTypes.filter(t => !HERO_SET.has(t) && t !== 'core-shelf' && (cat[t].meshes || 0) > 60);
const top5 = catTypes.filter(t => !HERO_SET.has(t) && t !== 'core-shelf').sort((a, b) => (cat[b].meshes || 0) - (cat[a].meshes || 0)).slice(0, 5);
check(!heavy.length, `${heavy.length} types over 60 draw calls${heavy.length ? ': ' + heavy.map(t => `${t} ${cat[t].meshes}`).join(', ') : ''} (heaviest: ${top5.map(t => `${t} ${cat[t].meshes}`).join(', ')})`);
const stylesPath = path.join(ROOT, 'content', 'house-styles.json');
const stylesJson = fs.existsSync(stylesPath) ? JSON.parse(fs.readFileSync(stylesPath, 'utf8')) : null;
const sync = stylesJson && JSON.stringify(stylesJson.styles) === JSON.stringify(STYLES);
check(!!sync, `content/house-styles.json ${stylesJson ? (sync ? 'matches' : 'does not match') : 'is missing:'} assets/house-styles.ts${sync ? '' : ' — pnpm run catalog'}`);
check(JSON.stringify(catJson.patterns) === JSON.stringify({ rugs: RUG_PATTERNS, art: ART_MOTIFS }), 'the catalog publishes the rug patterns and the art motifs the builders accept');

// ---- 6. the authored fleet's lint baseline -------------------------------------------------------------------------------------
console.log('── layout lints on the authored fleet (baseline, warnings)');
const lintCounts: Record<string, number> = {};
for (const { spec } of specs) for (const is of lintLayout(spec)) lintCounts[is.code] = (lintCounts[is.code] || 0) + 1;
console.log('  ' + Object.entries(lintCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
