#!/usr/bin/env -S node --experimental-strip-types
// The dress projection (plan 5.6, INT's pass 6): what `compose-house.mts --dress` would add to every room of every house, counted, without writing a
// spec. Node only (it builds each placed type once in the vendored three for its meshes and triangles). Reads the specs, the composer's own layout and the
// dress phase; compares with test/review/baselines/cost.json for the cost.
//
//   per program   rooms dressed, items, items per room, the slots that placed them
//   lamps         every room whose program has a lamp slot, counted by whether the LAYOUT left it with no free-standing lamp (the rooms LIGHT cannot pool: a flat
//                 night) and whether the dress phase gave it one; the rooms still without one are listed with the reason
//   cost          meshes and triangles the dress items add per house (each placed type built once), against the house's own totals in cost.json; a draw call is a
//                 mesh before batching, so the mesh ratio is the upper bound of the draw-call ratio
//   skipped       why slots did not place (the reasons the phase gave)
//
//   node --experimental-strip-types scripts/dress-project.mts                     the 30 houses at each room's own level, else 0.5
//   node --experimental-strip-types scripts/dress-project.mts --level 0.5         a level for every room
//   node --experimental-strip-types scripts/dress-project.mts --houses a,b        some houses (ids, or fixture ids)
//   node --experimental-strip-types scripts/dress-project.mts --json out.json     also write the numbers
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { PROPS } from '../assets/props/index.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { createBuildContext } from '../assets/build-context.js';
import { createMaterialKit } from '../assets/materials.js';
import { composeHouse } from '../assets/room-composer.js';
import { dressRooms, dressProgram } from '../assets/room-dress.js';
import { RECIPES } from '../assets/dress-recipes.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const level = opt('level') !== null ? Number(opt('level')) : undefined, only = opt('houses') ? new Set(opt('houses')!.split(',')) : null, jsonOut = opt('json');
const ids = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
const fixtures = fs.readdirSync(path.join(ROOT, 'test', 'fixtures', 'houses')).filter(f => /^dress-/.test(f)).map(f => f.replace(/\.json$/, ''));
const wanted = only ? [...only] : ids;
const specOf = (id: string) => { const f = [path.join(ROOT, 'content', 'houses', `${id}.json`), path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`)].find(fs.existsSync); if (!f) throw new Error(`no spec ${id}`); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const cost = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'review', 'baselines', 'cost.json'), 'utf8')).houses as Record<string, any>;

// ---- meshes and triangles per placed type (built once, default params) ----------------------------------------------------------------
const bc = createBuildContext({ THREE } as any);
const kit = createMaterialKit({ THREE, palette: { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' }, seed: 'project' } as any);
const memo = new Map<string, { meshes: number; tris: number }>();
function costOf(it: any) {
  const key = it.type; let hit = memo.get(key);
  if (!hit) {
    const def = (PROPS as Map<string, any>).get(it.type);
    try {
      const o = def.create({ ...it, variant: 0 }, { THREE, std: bc.std, box: bc.box, group: bc.group, mix: bc.mix, hex: bc.hex, colors: kit.colors, rng: kit.itemRng(`project:${key}`), H: 2.8 });
      let m = 0, t = 0; o.traverse((x: any) => { if (x.isMesh) { m++; t += x.geometry.index ? x.geometry.index.count / 3 : x.geometry.attributes.position.count / 3; } });
      hit = { meshes: m, tris: t };
    } catch { hit = { meshes: (PROPS as Map<string, any>).get(it.type)?.meshes ?? 3, tris: 300 }; }
    memo.set(key, hit);
  }
  return hit;
}

// ---- the census ----------------------------------------------------------------------------------------------------------------------
const byProg: Record<string, { rooms: number; items: number; slots: Record<string, number> }> = {};
const lamp = { rooms: 0, lampless: 0, fixed: 0, still: [] as string[] };
const skipped: Record<string, number> = {};
const houses: any[] = [];
let totalItems = 0;
for (const id of wanted) {
  const spec = specOf(id), comp = composeHouse(spec), res = dressRooms(spec, level === undefined ? {} : { level });
  let items = 0, meshes = 0, tris = 0, rooms = 0;
  for (const lv of spec.levels || []) for (const room of lv.rooms || []) {
    const r = res.get(room); if (!r) continue;
    rooms++; items += r.items.length;
    const p = byProg[r.program || 'none'] ||= { rooms: 0, items: 0, slots: {} }; p.rooms++; p.items += r.items.length;
    for (const s of r.slots) p.slots[s.slot] = (p.slots[s.slot] || 0) + s.n;
    for (const it of r.items) { const c = costOf(it); meshes += c.meshes; tris += c.tris; }
    for (const s of r.skipped) { const k = `${s.slot}: ${s.why.replace(/[0-9.]+ x [0-9.]+/g, 'W x D').replace(/\(.*?\)/g, '').replace(/on the .*|of the .*|at its place.*/, '').trim()}`; skipped[k] = (skipped[k] || 0) + 1; }
    // the lamp census: a room whose recipe asks for a lamp and whose layout has none
    const prog = dressProgram(room, lv);
    if (prog && RECIPES[prog].slots.some(s => s.id === 'lamp')) {
      const base = [...(room.items || []).filter((i: any) => i.src !== 'dress@1'), ...((comp.get(room) || { items: [] }).items)];
      const has = (xs: any[]) => xs.some(i => PLACEMENT[i.type] && PLACEMENT[i.type].group === 'lamp');
      lamp.rooms++;
      if (!has(base)) { lamp.lampless++; if (has(r.items)) lamp.fixed++; else lamp.still.push(`${id}/${lv.id}/${room.name} (${prog}, ${r.skipped.filter(s => s.slot === 'lamp').map(s => s.why).join('; ') || 'no host and no corner'})`); }
    }
  }
  totalItems += items;
  const c = cost[id];
  houses.push({ id, rooms, items, meshes, tris: Math.round(tris), houseMeshes: c ? c.meshes : null, houseTris: c ? c.triangles : null, meshPct: c ? +(100 * meshes / c.meshes).toFixed(2) : null, triPct: c ? +(100 * tris / c.triangles).toFixed(2) : null });
}
const med = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
console.log(`${wanted.length} houses dressed at ${level === undefined ? "each room's own level (else 0.5)" : `level ${level}`}: ${totalItems} dress items (${(totalItems / wanted.length).toFixed(1)} per house)`);
console.log(`${'program'.padEnd(15)} ${'rooms'.padStart(5)} ${'items'.padStart(6)} ${'per room'.padStart(8)}  slots`);
for (const [k, v] of Object.entries(byProg).sort((a, b) => b[1].items - a[1].items)) console.log(`${k.padEnd(15)} ${String(v.rooms).padStart(5)} ${String(v.items).padStart(6)} ${(v.items / v.rooms).toFixed(1).padStart(8)}  ${Object.entries(v.slots).map(([s, n]) => `${s} ${n}`).join(', ')}`);
console.log(`lamps: ${lamp.rooms} rooms ask for one; the layout left ${lamp.lampless} without a free-standing lamp; the phase lit ${lamp.fixed} of them${lamp.still.length ? `; still without: ${lamp.still.length}` : ''}`);
for (const s of lamp.still.slice(0, 12)) console.log(`   ${s}`);
const withCost = houses.filter(h => h.meshPct !== null);
if (withCost.length) {
  console.log(`cost per house (meshes and triangles the dress items add, against cost.json): meshes median ${med(withCost.map(h => h.meshes))} (${med(withCost.map(h => h.meshPct)).toFixed(1)} % of the house, max ${Math.max(...withCost.map(h => h.meshPct)).toFixed(1)} %), triangles median ${med(withCost.map(h => h.tris))} (${med(withCost.map(h => h.triPct)).toFixed(2)} %, max ${Math.max(...withCost.map(h => h.triPct)).toFixed(2)} %)`);
  const worst = withCost.slice().sort((a, b) => b.meshPct - a.meshPct).slice(0, 3);
  console.log(`  highest: ${worst.map(h => `${h.id} +${h.meshes} meshes (${h.meshPct} %)`).join(', ')}`);
}
console.log('skipped, by reason (rooms x slots):'); for (const [k, v] of Object.entries(skipped).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${String(v).padStart(4)}  ${k}`);
if (jsonOut) { fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ level: level ?? null, houses, byProg, lamp, skipped, types: Object.fromEntries(memo) }, null, 1) + '\n'); console.log(`→ ${jsonOut}`); }
void fixtures;
