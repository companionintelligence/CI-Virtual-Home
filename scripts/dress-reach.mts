#!/usr/bin/env -S node --experimental-strip-types
// REACH, measured (assets/room-dress-hosts.ts): how far the BUILT mesh of every small good that stands on a surface passes the measured box the packer and the lint work from.
// A flower-jug's flowers, a book stack's leaning top book, a candle trio's wicks, a pot's handle are seeded per item in the page, so Node cannot know them for one item and the
// packer keeps the worst case of each type clear instead. Every surface type of the catalog (the registry's `surface` types and every type placed `onSurface`) is built in three.js
// (the page's own builders, Node's three) over many seeds and at every variant its params offer (`variant` 0-2; `w`, `d` and `r` at 0.75 and 1.35 times the default), and its mesh's
// box is compared with the box sizeOf gives at those params, on x and z.
//
//   node --experimental-strip-types scripts/dress-reach.mts [--seeds 1000] [--check]
//     prints one row per type that spills over 2 mm: the worst spill over all seeds and variants, and the REACH it needs (rounded up to the millimetre, plus 2 mm);
//     --check exits 1 when a type's REACH in assets/room-dress-hosts.ts is under that (the table to paste is printed last)
// test-dress-phase M runs the same measure over 96 seeds the table was not measured on.
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createBuildContext } from '../assets/build-context.js';
import { createMaterialKit } from '../assets/materials.js';
import { PROPS } from '../assets/props/index.js';
import { PLACEMENT } from '../assets/props/placement.js';
import { sizeOf, paramsOf } from '../assets/room-geo.js';
import { REACH } from '../assets/room-dress-hosts.js';
import { parseArgs } from './review/lib.mts';

const bcx = createBuildContext({ THREE } as any);
const kitx = createMaterialKit({ THREE, palette: { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' }, seed: 'cafe' } as any);

/** the params variants of a surface type that change what it builds or how big it is */
export function variantsOf(type: string): any[] {
  const P: string[] = paramsOf(type), s = sizeOf(type, {}), out: any[] = [{}];
  if (P.includes('variant')) for (const v of [0, 1, 2]) out.push({ variant: v });
  if (s) for (const k of ['w', 'd', 'r'] as const) if (P.includes(k)) { const base = k === 'r' ? s.w / 2 : k === 'w' ? s.w : s.d; for (const f of [0.75, 1.35]) out.push({ [k]: Math.round(base * f * 1000) / 1000 }); }
  return out;
}
/** every surface type of the catalog with a measured size */
export function surfaceTypes(): string[] {
  const out: string[] = [];
  for (const [type, def] of PROPS as Map<string, any>) { const pl: any = PLACEMENT[type]; if (((pl && pl.onSurface) || def.surface) && sizeOf(type, {})) out.push(type); }
  return out;
}
/** the worst spill (metres, past the measured box on x or z) of a type over `seeds` seeds (keyed `prefix`) and all its variants */
export function spillOf(type: string, seeds: number, prefix: string): { worst: number; at: string } {
  const def = (PROPS as Map<string, any>).get(type); let worst = 0, at = '';
  for (const params of variantsOf(type)) {
    const s0 = sizeOf(type, params)!, ox = s0.ox || 0, oz = s0.oz || 0;
    for (let k = 0; k < seeds; k++) {
      const o = def.create({ type, ...params }, { THREE, std: bcx.std, box: bcx.box, group: bcx.group, mix: bcx.mix, hex: bcx.hex, colors: kitx.colors, rng: kitx.itemRng(`${prefix}${k}:${type}:${JSON.stringify(params)}`), H: 2.8 });
      o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o);
      const v = Math.max(0, b.max.x - (ox + s0.w / 2), (ox - s0.w / 2) - b.min.x, b.max.z - (oz + s0.d / 2), (oz - s0.d / 2) - b.min.z);
      if (v > worst) { worst = v; at = `${JSON.stringify(params)} seed ${k}`; }
    }
  }
  return { worst, at };
}
/** the REACH a measured spill needs: to the millimetre, plus 2 mm for the millimetre rounding of two positions */
export const reachFor = (worst: number): number => Math.round((Math.ceil(worst * 1000 - 1e-6) + 2)) / 1000;

if (process.argv[1] && process.argv[1].endsWith('dress-reach.mts')) {
  const args = parseArgs(process.argv.slice(2)), seeds = Number(args.seeds && args.seeds !== 'true' ? args.seeds : 1000);
  const table: Record<string, number> = {}; let bad = 0; const types = surfaceTypes();
  for (const type of types) {
    const { worst, at } = spillOf(type, seeds, 'REACH:');
    if (worst <= 0.002) continue;
    const need = reachFor(worst); table[type] = need;
    const have = (REACH as Record<string, number>)[type] || 0, short = have + 1e-9 < need;
    if (short) bad++;
    console.log(`${short ? '✗' : '✓'} ${type.padEnd(18)} spill ${(worst * 1000).toFixed(1).padStart(5)} mm (${at})  needs ${(need * 1000).toFixed(0).padStart(3)} mm, REACH ${(have * 1000).toFixed(0).padStart(3)} mm`);
  }
  for (const t of Object.keys(REACH)) if (!(t in table)) console.log(`  (REACH names ${t}, which spills 2 mm or less over ${seeds} seeds)`);
  console.log(`${bad ? '✗' : '✓'} ${types.length} surface types over ${seeds} seeds and every variant: ${bad} with a REACH under what they spill`);
  console.log(`REACH = ${JSON.stringify(table).replace(/"/g, "'").replace(/:/g, ': ').replace(/,/g, ', ')}`);
  if (args.check && bad) process.exit(1);
}
