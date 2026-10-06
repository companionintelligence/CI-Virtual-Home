#!/usr/bin/env -S node --experimental-strip-types
// R2: the dress census (plan 5.1, and the dressing design's acceptance, section 13). Node only, no browser: it reads the specs and the
// composer's own geometry (assets/room-geo.js, assets/room-composer.js, built by `pnpm run build`), so it is fast and exact, and it is
// the baseline every DRESS, SMALL and SOFT claim about "more things in the room" is measured against.
//
// What it counts, for every room of every house in content/houses (444 rooms), over the items the builder would place (a room's own
// items plus the composer's for a room that is composed and not locked, the hero desk set out):
//   byProgram   per program (the room's own `program`, or "none" for the hand-authored rooms with no program): rooms, median and p90 area,
//               mean items, and mean loose surface items (`surf`), wall items, floor items (rugs), body items, ceiling items.
//               Seeded by design/dressing-first/baseline-census.json; the same table comes out of this script (differences are printed by --seed).
//   dress       items carrying `src: "dress@1"` (the DRESS stream's marker): none at the baseline, 2,350-3,150 as the target.
//   neverBare   the plan's "never bare" rules, over dress items: bath, ensuite and powder at least 3 dress items and a towel object;
//               dining a table setting; kitchen at least 4 counter clusters (dress items on a surface); hall of 8 m2 or more at least 3.
//               At the baseline every room of those kinds violates, because nothing is a dress item yet; `looseNow` says what is there.
//   blankWalls  per room of 9 m2 or more, the longest unbroken blank wall span in the band from 0.9 m to the ceiling less 0.3 m
//               (windows, door casings, wall-layer items and body items from 1.5 m up taken out), the share of rooms at most 3.5 m
//               and at most 4.5 m, and the worst rooms.
//   visible     the visible-object proxy: items in the room whose box meets the frustum of each R24 eye camera (an upper bound: no occlusion).
//
//   node --experimental-strip-types scripts/dress-census.mts                    print the tables
//   node --experimental-strip-types scripts/dress-census.mts --write            write test/review/baselines/census.json
//   node --experimental-strip-types scripts/dress-census.mts --check            compare a fresh census with the committed file (exit 1 on any difference)
//   node --experimental-strip-types scripts/dress-census.mts --seed             also print the difference from design/dressing-first/baseline-census.json
//   node --experimental-strip-types scripts/dress-census.mts --specs <dir>      census another set of specs (a fixture directory, a worktree's content/houses)
//   node --experimental-strip-types scripts/dress-census.mts --project          census with every room that has a recipe dressed (the dress phase at each room's level or 0.5: what `compose-house.mts --dress` would bake). An opted-in room (`dress.level`) is always counted dressed
// No timestamp and no machine detail in the file: two runs of an unchanged tree write the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { M, houseIds, HERO_SET } from './fleet/_compose-dry.mts';
import { BASELINES, ROOT, stableJson, median, round, readJson, writeText, rel, parseArgs } from './review/lib.mts';
import { R24, cornerCam, type Cam } from './review/cameras.mts';

export const CENSUS_FILE = path.join(BASELINES, 'census.json');
const SEED_FILE = '/Users/liam/devel/_staging/3dinside/_audit/design/dressing-first/baseline-census.json';
export const TOWEL = /towel/;
export const SETTING_TYPES = new Set(['place-setting', 'table-setting', 'table-runner', 'centerpiece']);
const DESK_TOP = 0.77;

type Item = { type: string; at?: [number, number]; y?: number; rot?: number; src?: string; [k: string]: any };
export interface RoomRec { house: string; level: string; name: string; program: string | null; inferred: string | null; area: number; H: number; items: Item[]; room: any; lv: any; spec: any }

/** every room of a spec with the items the builder places in it */
export function roomsOf(spec: any, id: string, { project = false }: { project?: boolean } = {}): RoomRec[] {
  const out: RoomRec[] = [];
  const res = M.composeHouse(spec);
  // the dress phase's items for a room that has none baked: an opted-in room's (the build adds them live), and with `project` every room that has a recipe
  // (what `compose-house.mts --dress` would bake: the projection of the layout pass that dresses a house)
  const dress = project ? M.dress.dressRooms(spec) : M.dress.dressHouse(spec);
  for (const lv of spec.levels || []) for (const r of lv.rooms || []) {
    if (!r.bounds) continue;
    const comp = M.isComposed(r) && res.get(r) ? res.get(r).items : [];
    const baked = (r.items || []).some((it: any) => it.src === 'dress@1');
    let items: Item[] = [...(r.items || []), ...comp, ...(!baked && dress.get(r) ? dress.get(r).items : [])];
    if (spec.hero && spec.hero.level === lv.id) items = items.filter(it => !(HERO_SET.has(it.type) && Array.isArray(it.at) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3));
    out.push({ house: id, level: lv.id, name: r.name, program: r.program || null, inferred: r.program || M.inferProgram(r, lv) || null, area: r.bounds.w * r.bounds.d, H: lv.height || 2.8, items, room: r, lv, spec });
  }
  return out;
}

const layer = (t: string): string => M.layerOf(t);
export function classify(items: Item[]) {
  const c = { items: items.length, surf: 0, wall: 0, floor: 0, body: 0, ceiling: 0 };
  for (const it of items) { const l = layer(it.type); if (l === 'surface') c.surf++; else if (l === 'wall') c.wall++; else if (l === 'floor') c.floor++; else if (l === 'ceiling') c.ceiling++; else c.body++; }
  return c;
}
const isDress = (it: Item) => it.src === 'dress@1';

// ---- blank wall spans ---------------------------------------------------------------------------------------------------
/** the vertical extent of an item on a wall (the composer's vRange) */
function wallRange(it: Item): [number, number] {
  const s = M.geo.sizeOf(it.type, it); const h = s ? s.h : 0.5;
  const y = it.y ?? (M.PLACEMENT[it.type]?.mountY ?? 1.5);
  const y0 = M.geo.CENTRE_MOUNT.has(it.type) ? y - h / 2 : M.geo.TOP_MOUNT.has(it.type) ? y - h : y;
  return [y0, y0 + h];
}
export const BAND_LO = 0.9, CEIL_GAP = 0.3, DOOR_MARGIN = 0.1;
/** the free spans of one room's wall runs in the band, and the longest */
export function blankSpans(rec: RoomRec): { longest: number; spans: Array<{ side: string; a: number; b: number; len: number }> } {
  const geo = M.geo.analyzeRoom(rec.spec, rec.lv, rec.room);
  const hi = rec.H - CEIL_GAP, spans: Array<{ side: string; a: number; b: number; len: number }> = [];
  const boxes = rec.items.filter(it => Array.isArray(it.at)).map(it => ({ it, l: layer(it.type), ob: M.geo.itemObb(it) })).filter(x => x.ob).map(x => ({ ...x, bb: M.geo.aabb(x.ob) }));
  for (const run of geo.runs) {
    const alongX = run.side === 'N' || run.side === 'S';
    let lo0 = run.a, hi0 = run.b;
    for (const d of run.doors) { if (Math.abs(lo0 - d.b) < 0.06) lo0 += DOOR_MARGIN; if (Math.abs(hi0 - d.a) < 0.06) hi0 -= DOOR_MARGIN; }
    let free: Array<[number, number]> = hi0 - lo0 > 0.05 ? [[lo0, hi0]] : [];
    const cut = (a: number, b: number) => { free = free.flatMap(([p, q]) => (b <= p || a >= q) ? [[p, q] as [number, number]] : [[p, a] as [number, number], [b, q] as [number, number]].filter(([x, y]) => y - x > 0.02)); };
    for (const w of run.windows) if (w.sill < hi && w.sill + w.h > BAND_LO) cut(w.a - 0.15, w.b + 0.15);
    for (const x of boxes) {
      // an item stands on this wall when its box reaches within 0.45 m of the wall's face, on the room's side
      const near = alongX ? (run.side === 'N' ? x.bb.z0 - run.face : run.face - x.bb.z1) : (run.side === 'W' ? x.bb.x0 - run.face : run.face - x.bb.x1);
      if (near > 0.45 || near < -0.6) continue;
      const a = alongX ? x.bb.x0 : x.bb.z0, b = alongX ? x.bb.x1 : x.bb.z1;
      if (x.l === 'wall') { const [y0, y1] = wallRange(x.it); if (Math.min(y1, hi) - Math.max(y0, BAND_LO) > 0.1) cut(a, b); }
      else if (x.l === 'body') { const s = M.geo.sizeOf(x.it.type, x.it); if (s && s.h >= 1.5) cut(a, b); }
    }
    for (const [a, b] of free) spans.push({ side: run.side, a: round(a, 2), b: round(b, 2), len: round(b - a, 2) });
  }
  return { longest: spans.reduce((m, s) => Math.max(m, s.len), 0), spans };
}

// ---- the visible-object proxy ---------------------------------------------------------------------------------------------
function itemBox(it: Item): { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number } | null {
  if (!Array.isArray(it.at)) return null;
  const ob = M.geo.itemObb(it), s = M.geo.sizeOf(it.type, it); if (!ob || !s) return null;
  const bb = M.geo.aabb(ob), l = layer(it.type);
  let y0 = 0, y1 = s.h;
  if (l === 'wall') [y0, y1] = wallRange(it); else if (l === 'surface') { y0 = it.y ?? DESK_TOP; y1 = y0 + s.h; } else if (l === 'ceiling') { y0 = 2; y1 = 3; } else { y0 = it.y ?? 0; y1 = y0 + s.h; }
  return { ...bb, y0, y1 };
}
/** does the box meet the camera's frustum (conservative: culled only when every corner is outside one plane) */
export function inFrustum(cam: Cam, bx: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }, aspect = 16 / 9): boolean {
  const P = cam.pos, T = cam.target;
  const f = norm([T[0] - P[0], T[1] - P[1], T[2] - P[2]]), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const tv = Math.tan(cam.fov * Math.PI / 360), th = tv * aspect;
  const cs: Array<[number, number, number]> = [];
  for (const x of [bx.x0, bx.x1]) for (const y of [bx.y0 + (cam.pos[1] - cam.eye), bx.y1 + (cam.pos[1] - cam.eye)]) for (const z of [bx.z0, bx.z1]) cs.push([x, y, z]);
  const v = cs.map(q => { const d = [q[0] - P[0], q[1] - P[1], q[2] - P[2]]; return { x: dot(d, r), y: dot(d, u), z: dot(d, f) }; });
  if (v.every(p => p.z <= cam.near)) return false;
  if (v.every(p => p.x > p.z * th)) return false;
  if (v.every(p => p.x < -p.z * th)) return false;
  if (v.every(p => p.y > p.z * tv)) return false;
  if (v.every(p => p.y < -p.z * tv)) return false;
  return true;
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- the census -----------------------------------------------------------------------------------------------------------
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const p90 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(0.9 * (s.length - 1) + 0.5))] : 0; };

export function census(specs: Array<{ id: string; spec: any }>, o: { project?: boolean } = {}) {
  const recs = specs.flatMap(({ id, spec }) => roomsOf(spec, id, o));
  // by program
  const groups = new Map<string, RoomRec[]>();
  for (const r of recs) { const k = r.program || 'none'; (groups.get(k) || groups.set(k, []).get(k)!).push(r); }
  const byProgram: Record<string, any> = {};
  for (const [k, rs] of [...groups].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    const cs = rs.map(r => classify(r.items)), areas = rs.map(r => r.area);
    byProgram[k] = { n: rs.length, area_med: round(median(areas), 1), area_p90: round(p90(areas), 1), items: round(mean(cs.map(c => c.items)), 2), surf: round(mean(cs.map(c => c.surf)), 2), wall: round(mean(cs.map(c => c.wall)), 2), floor: round(mean(cs.map(c => c.floor)), 2), body: round(mean(cs.map(c => c.body)), 2), ceiling: round(mean(cs.map(c => c.ceiling)), 2) };
  }
  // dress items
  const dressAll = recs.flatMap(r => r.items.filter(isDress));
  const dress = { items: dressAll.length, rooms: recs.filter(r => r.items.some(isDress)).length, target: '2350-3150', byKind: {} as Record<string, number> };
  for (const it of dressAll) { const l = layer(it.type); dress.byKind[l] = (dress.byKind[l] || 0) + 1; }
  // never bare
  const prog = (r: RoomRec) => r.inferred;
  const rule = (name: string, pick: (r: RoomRec) => boolean, ok: (r: RoomRec) => boolean, now: (r: RoomRec) => number, what: string) => {
    const rs = recs.filter(pick), bad = rs.filter(r => !ok(r));
    return { name, what, rooms: rs.length, violations: bad.length, rate: round(rs.length ? bad.length / rs.length : 0, 3), looseNow: round(mean(rs.map(now)), 2), worst: bad.slice(0, 5).map(r => `${r.house}/${r.level}/${r.name}`) };
  };
  const nDress = (r: RoomRec) => r.items.filter(isDress).length;
  const loose = (r: RoomRec) => r.items.filter(it => layer(it.type) === 'surface').length;
  const neverBare = [
    rule('wet-3-dress-and-towel', r => ['bath', 'ensuite', 'powder'].includes(prog(r) || ''), r => nDress(r) >= 3 && r.items.some(it => TOWEL.test(it.type) && (isDress(it) || /towel-(rail|ladder)/.test(it.type))), loose, 'bath, ensuite, powder: at least 3 dress items and a towel object'),
    rule('dining-table-setting', r => prog(r) === 'dining', r => r.items.some(it => isDress(it) && SETTING_TYPES.has(it.type)), loose, 'dining: a table setting'),
    rule('kitchen-4-counter-clusters', r => ['kitchen', 'kitchen-dining'].includes(prog(r) || ''), r => r.items.filter(it => isDress(it) && layer(it.type) === 'surface').length >= 4, loose, 'kitchen: at least 4 counter clusters'),
    rule('hall-8m2-3-dress', r => prog(r) === 'hall' && r.area >= 8, r => nDress(r) >= 3, nDress, 'hall of 8 m2 or more: at least 3 dress items'),
  ];
  // blank walls (rooms of 9 m2 or more)
  const big = recs.filter(r => r.area >= 9), longest = big.map(r => ({ r, ...blankSpans(r) }));
  const blankWalls = {
    rooms: big.length,
    share_le_3_5: round(longest.filter(x => x.longest <= 3.5).length / big.length, 3), share_le_4_5: round(longest.filter(x => x.longest <= 4.5).length / big.length, 3),
    median_longest: round(median(longest.map(x => x.longest)), 2),
    worst: longest.sort((a, b) => b.longest - a.longest || (`${a.r.house}${a.r.name}` < `${b.r.house}${b.r.name}` ? -1 : 1)).slice(0, 15).map(x => ({ room: `${x.r.house}/${x.r.level}/${x.r.name}`, program: x.r.inferred, area: round(x.r.area, 1), longest: x.longest })),
  };
  // visible objects on the R24 cameras
  const visible: Record<string, any> = {};
  const kindOf: Record<string, string> = { living: 'living', bedroom: 'bedroom', kids: 'bedroom', bath: 'bath' };
  const perKind: Record<string, number[]> = {};
  for (const rr of R24) {
    const rec = recs.find(r => r.house === rr.house && r.name.toLowerCase() === rr.room.toLowerCase()); if (!rec) continue;
    const counts: Record<string, number> = {};
    for (const corner of ['NW', 'SE'] as const) {
      const cam = cornerCam({ x: rec.room.bounds.x, z: rec.room.bounds.z, w: rec.room.bounds.w, d: rec.room.bounds.d }, 0, corner);
      counts[corner] = rec.items.filter(it => { const b = itemBox(it); return b && inFrustum(cam, b); }).length;
    }
    visible[rr.id] = { ...counts, items: rec.items.length };
    const k = kindOf[rr.kind]; if (k) (perKind[k] ||= []).push(counts.NW, counts.SE);
  }
  const visibleByKind = Object.fromEntries(Object.entries(perKind).map(([k, v]) => [k, { mean: round(mean(v), 1), target: k === 'living' ? 25 : k === 'bedroom' ? 20 : 12 }]));
  return { houses: specs.length, rooms: recs.length, byProgram, dress, neverBare, blankWalls, visible: { byKind: visibleByKind, rooms: visible } };
}

function loadSpecs(dir: string): Array<{ id: string; spec: any }> {
  const ids = dir === path.join(ROOT, 'content', 'houses') ? houseIds() : fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
  return ids.map(id => ({ id, spec: JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')) }));
}

export const WHAT = 'dress census (scripts/dress-census.mts): items per room by program and layer, dress items (src dress@1), the never-bare rules, the longest blank wall span, and the visible-object proxy on the R24 cameras. Node only, no timestamp: two runs of an unchanged tree write the same bytes.';
export const REGENERATE = 'pnpm run build && node --experimental-strip-types scripts/dress-census.mts --write   (only to re-freeze the BEFORE at baseline/stage0-green; never to turn a target green)';

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.specs && args.specs !== 'true' ? args.specs : path.join(ROOT, 'content', 'houses'));
  const c = census(loadSpecs(dir), { project: args.project === 'true' });
  const doc = { schema: 1, what: WHAT, regenerate: REGENERATE, ...c };
  const text = stableJson(doc);
  console.log(`${c.houses} houses, ${c.rooms} rooms, ${c.dress.items} dress items`);
  console.log(`${'program'.padEnd(12)} ${'n'.padStart(4)} ${'area'.padStart(6)} ${'items'.padStart(6)} ${'surf'.padStart(5)} ${'wall'.padStart(5)} ${'floor'.padStart(5)} ${'body'.padStart(5)}`);
  for (const [k, v] of Object.entries<any>(c.byProgram)) console.log(`${k.padEnd(12)} ${String(v.n).padStart(4)} ${v.area_med.toFixed(1).padStart(6)} ${v.items.toFixed(1).padStart(6)} ${v.surf.toFixed(2).padStart(5)} ${v.wall.toFixed(2).padStart(5)} ${v.floor.toFixed(2).padStart(5)} ${v.body.toFixed(2).padStart(5)}`);
  console.log('never bare:'); for (const n of c.neverBare) console.log(`  ${n.name.padEnd(30)} ${n.violations}/${n.rooms} violate (loose surface items now: ${n.looseNow})`);
  console.log(`blank walls (rooms of 9 m2 or more): ${(c.blankWalls.share_le_3_5 * 100).toFixed(0)}% <= 3.5 m, ${(c.blankWalls.share_le_4_5 * 100).toFixed(0)}% <= 4.5 m, median longest ${c.blankWalls.median_longest} m; worst ${c.blankWalls.worst.slice(0, 3).map(w => `${w.room} ${w.longest} m`).join(', ')}`);
  console.log(`visible objects per eye view: ${Object.entries<any>(c.visible.byKind).map(([k, v]) => `${k} ${v.mean} (target ${v.target})`).join(', ')}`);
  if (args.seed === 'true' && fs.existsSync(SEED_FILE)) {
    const seed = readJson(SEED_FILE); console.log('\nagainst the design seed (dressing-first/baseline-census.json): program, n, items, surf, wall, body');
    for (const [k, s] of Object.entries<any>(seed)) { const v = (c.byProgram as any)[k]; if (!v) { console.log(`  ${k}: missing`); continue; } const d = (a: number, b: number) => (Math.abs(a - b) < 0.06 ? '=' : `${b.toFixed(2)} vs ${a.toFixed(2)}`); console.log(`  ${k.padEnd(11)} n ${v.n === s.n ? '=' : `${v.n} vs ${s.n}`}  items ${d(s.items, v.items)}  surf ${d(s.surf, v.surf)}  wall ${d(s.wall, v.wall)}  body ${d(s.body, v.body)}`); }
  }
  if (args.write === 'true') { writeText(CENSUS_FILE, text); console.log(`→ ${rel(CENSUS_FILE)}`); }
  if (args.check === 'true') {
    const have = fs.existsSync(CENSUS_FILE) ? fs.readFileSync(CENSUS_FILE, 'utf8') : '';
    if (have !== text) { console.log(`✗ ${rel(CENSUS_FILE)} is not what a fresh census writes`); process.exit(1); }
    console.log(`✓ ${rel(CENSUS_FILE)} equals a fresh census`);
  }
}
