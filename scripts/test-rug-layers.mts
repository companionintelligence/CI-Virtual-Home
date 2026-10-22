#!/usr/bin/env -S node --experimental-strip-types
// A rug laid over another rug lies RUG_LAYER higher (assets/rooms-build.ts rugLayers), in Node. Every rug is a 12 mm slab, so two that overlap
// had one top plane and flickered (review:zfight, "Z10 rug on rug"). The rule is pure plan geometry: a rug is one layer above every earlier rug of
// its room that it overlaps, and a rug that overlaps none stays on the floor (nothing moves in a room with one rug, or two apart).
// @check-house quick
//
//   node --experimental-strip-types scripts/test-rug-layers.mts
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const load = (p: string) => import(pathToFileURL(path.join(ROOT, p)).href);
let failed = 0;
const check = (cond: boolean, m: string) => { console.log(`  ${cond ? '✓' : '✗'} ${m}`); if (!cond) failed++; };

let rb: any, composer: any;
try { [rb, composer] = await Promise.all([load('assets/rooms-build.js'), load('assets/room-composer.js')]); } catch (e: any) { console.error(`not built (pnpm run build): ${e.message}`); process.exit(2); }
const { rugLayers, RUG_LAYER } = rb;

console.log('── the rule');
const rug = (type: string, at: number[], extra: any = {}) => ({ type, at, ...extra });
{
  const a = rug('area-rug', [0, 0], { w: 3, d: 2 }), far = rug('runner-rug', [10, 0], { w: 0.8, d: 2.4 }), over = rug('patterned-rug', [0.5, 0.2], { w: 1.5, d: 1 }), over2 = rug('runner-rug', [0.5, 0.2], { w: 0.6, d: 1.5 });
  const L = rugLayers([a, far, over, over2]);
  check(!L.has(a) && !L.has(far), 'the first rug and a rug that overlaps nothing stay on the floor');
  check(L.get(over) === 1, 'a rug laid over the first lies one layer up');
  check(L.get(over2) === 2, 'a third over both lies one above the highest it overlaps');
  const sofa = { type: 'sofa', at: [0, 0] };
  check(rugLayers([a, sofa]).size === 0, 'only rugs are layered');
  check(RUG_LAYER >= 0.001 && RUG_LAYER <= 0.002, `a layer is ${RUG_LAYER * 1000} mm: above the depth buffer's step at 20 m, under what the eye can tell`);
  // a turned rug: 90 degrees swaps its width and depth
  const long = rug('runner-rug', [0, 0], { w: 0.8, d: 2.4, rot: 90 }), cross = rug('area-rug', [1.1, 0], { w: 1, d: 1 });
  check(rugLayers([long, cross]).get(cross) === 1, 'a runner turned 90 degrees reaches 1.2 m along x and meets the rug beside it');
  check(rugLayers([rug('area-rug', [0, 0], { w: 2, d: 2 }), rug('area-rug', [2, 0], { w: 2, d: 2 })]).size === 0, 'rugs that only touch edge to edge do not stack');
  check(JSON.stringify([...rugLayers([a, over, over2])]) === JSON.stringify([...rugLayers([a, over, over2])]), 'the same room twice gives the same layers (no clock, no dice)');
}

console.log('── the fleet: every authored and composed room');
const ids = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
let rooms = 0, stacked = 0, rugsMoved = 0, sharedTop = 0;
const isRug = (t: string) => /(^|-)rug$/.test(t);
for (const id of ids) {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${id}.json`), 'utf8'));
  const copy = JSON.parse(JSON.stringify(spec)), composed = composer.composeHouse(copy);   // (the composer's answer is keyed by the room objects of the spec it was given)
  for (const lv of copy.levels || []) for (const room of lv.rooms || []) {
    const res = composed.get(room);
    const items = [...(room.items || []), ...((res && res.items) || [])].filter((it: any) => Array.isArray(it.at));
    const L = rugLayers(items), rugs = items.filter((it: any) => isRug(it.type));
    rooms++;
    if (L.size) { stacked++; rugsMoved += L.size; }
    // no two rugs of a room that overlap in plan may share a layer
    for (let i = 0; i < rugs.length; i++) for (let j = i + 1; j < rugs.length; j++) {
      const a = rugs[i], b = rugs[j];
      if ((L.get(a) || 0) !== (L.get(b) || 0)) continue;
      const ba = rugLayers([a, b]);   // they overlap iff the second is lifted over the first
      if (ba.has(b)) sharedTop++;
    }
  }
}
console.log(`  ${ids.length} houses, ${rooms} rooms: ${stacked} rooms with rugs on rugs, ${rugsMoved} rugs lifted`);
check(sharedTop === 0, 'no two overlapping rugs of a room share a layer');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll rug layer checks passed.');
process.exit(failed ? 1 : 0);
