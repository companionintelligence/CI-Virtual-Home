#!/usr/bin/env -S node --experimental-strip-types
// The planting species, held to the geometry the site kit draws (no browser: the vendored three, in Node):
// @check-house quick
//
//   node --experimental-strip-types scripts/test-site-species.mts       (any cwd; run `pnpm run build` first)
//
//   masks      assets/site-species-masks.ts is what each species hides of the mulch under it: measured on the geometry, it
//              must still be — a species' silhouette within 6 % of its cells and 0.06 of its cover, every species has one
//              (`node --experimental-strip-types scripts/measure-species.mts --write` rewrites it)
//   triangles  the table's triangles per plant are what one plant costs (±12 %), and stay in budget: a plant under 0.5 m
//              1 300, any other shrub or flower 2 500, a tree 30 000
//   layers     each mix's layers hold species of their own height: back 1.1 m and up (its species' mean 1.2 m), middle
//              0.45–1.15 m, front under 0.55 m — so a bed's tall plants are the back row, and the height classes the
//              generator and its metrics count are the layers it lays out
//   measure    the top-down measure itself: a plant stamped alone hides its silhouette (a grass tuft 5 % of its disc)
// Exit 0 when all hold; 1 otherwise (2: the compiled assets are missing).
import fs from 'node:fs';
import path from 'node:path';
import { measureSpecies, decodeMask, ROOT, MASK_N } from './site-species-lib.mts';

if (!fs.existsSync(path.join(ROOT, 'assets', 'site-species-masks.js'))) { console.error('assets/site-species-masks.js is missing: pnpm run build first'); process.exit(2); }
const M = await import(path.join(ROOT, 'assets', 'site-species-masks.js'));
const P = await import(path.join(ROOT, 'assets', 'site-planting.js'));
const stats = await measureSpecies();
let fails = 0;
const fail = (msg: string) => { fails++; console.log(`  ✗ ${msg}`); };

for (const [sp, S] of Object.entries<any>(P.SPECIES)) {
  const st = stats[sp], tree = S.draw.startsWith('tree:');
  const meanH = (S.h[0] + S.h[1]) / 2;
  if (!tree) {
    const hex = M.MASKS[sp];
    if (!hex) { fail(`${sp}: no mask in assets/site-species-masks.ts (measure-species.mts --write)`); }
    else {
      const have = decodeMask(hex), now = st.mask!;
      let diff = 0; for (let i = 0; i < have.length; i++) if (have[i] !== now[i]) diff++;
      const cover = P.coverOf(sp);
      if (diff / (MASK_N * MASK_N) > 0.06 || Math.abs(cover - st.cover) > 0.06) fail(`${sp}: the mask has drifted from the geometry (${(diff / (MASK_N * MASK_N) * 100).toFixed(1)} % of its cells differ; cover ${cover.toFixed(2)} committed, ${st.cover.toFixed(2)} now) — measure-species.mts --write`);
    }
  }
  const tabled = M.TRIS[sp];
  if (tabled === undefined) fail(`${sp}: no triangle count in the table`);
  else if (Math.abs(tabled - st.tris) > Math.max(30, st.tris * 0.12)) fail(`${sp}: ${tabled} triangles tabled, ${st.tris} now — measure-species.mts --write`);
  const budget = tree ? 30_000 : S.h[1] <= 0.5 ? 1300 : 2500;
  if (st.tris > budget) fail(`${sp}: ${st.tris} triangles a plant (budget ${budget})`);
  void meanH;
}
// each layer of each mix holds species of its own height
const mean = (sp: string) => (P.SPECIES[sp].h[0] + P.SPECIES[sp].h[1]) / 2;
for (const [name, mix] of Object.entries<any>(P.MIXES)) {
  if (name === 'meadow') continue;
  for (const [sp] of mix.back) if (P.SPECIES[sp].h[0] < 1.1 && mean(sp) < 1.2) fail(`mix ${name}: back layer species ${sp} is ${P.SPECIES[sp].h.join('–')} m (a back row stands 1.1 m and up)`);
  for (const [sp] of mix.mid) if (mean(sp) < 0.45 || mean(sp) > 1.15) fail(`mix ${name}: middle layer species ${sp} is ${P.SPECIES[sp].h.join('–')} m (0.45–1.15 m)`);
  for (const [sp] of mix.front) if (mean(sp) > 0.55) fail(`mix ${name}: front layer species ${sp} is ${P.SPECIES[sp].h.join('–')} m (under 0.55 m)`);
  if (!mix.fill.length) fail(`mix ${name}: no fill species`);
}
// the measure: one grass tuft alone, and one mound
{
  const plan = (sp: string, r: number) => ({ beds: [{ poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]], soil: true, y: 0, mulch: 0, wall: [false, false, false, false] }], plants: [{ sp, x: 0, z: 0, y: 0, h: 1, r, rot: 0, tint: 1, bloom: null, layer: 'x' }], trees: [], floor: null, bareTarget: 0, own: [] });
  const bare = (sp: string, r: number) => P.bareShare(plan(sp, r), null, 0.02);
  const area = (sp: string, r: number) => (1 - bare(sp, r)) * 4, disc = (r: number) => Math.PI * r * r;
  const g = area('grass', 0.4) / disc(0.4), s = area('shrub', 0.6) / disc(0.6);
  if (!(g > 0.02 && g < 0.15)) fail(`a grass tuft hides ${(g * 100).toFixed(0)} % of its crown disc (expected 2–15 %)`);
  if (!(s > 0.6 && s < 0.95)) fail(`a mound hides ${(s * 100).toFixed(0)} % of its crown disc (expected 60–95 %)`);
}
console.log(fails ? `${fails} failed` : `all ${Object.keys(P.SPECIES).length} species hold: masks fresh, triangles in budget, layers by height`);
process.exit(fails ? 1 : 0);
