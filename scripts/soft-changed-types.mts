#!/usr/bin/env -S node --experimental-strip-types
// The FULL declared set of item types a SOFT branch changes, for `scripts/test-build-neutrality.mts --changed` (SOFT wave-3 follow-up).
//
// A declared set derived from the catalog's `meshes` column alone is incomplete: floor-cushion and bean-bag were rebuilt in wave 2 with the same mesh count, so the
// catalog row did not move, and the neutrality gate (rightly) failed on mesamariposa's Kids' Room until they were added by hand. This tool derives the set from what a type
// BUILDS: every registry and page-builder type is built at three seeds in the bare editor page and digested (per mesh: triangle count, positions, per-vertex shade, material
// colour, roughness, metalness, emissive, flags). Run against two served trees, the types whose digest differs are the changed ones; a type only the new tree has is `added`
// (dormant until a spec places it, so no house can move for it, but it is declared for completeness).
//
//   node --experimental-strip-types scripts/soft-changed-types.mts --digest <out.json> [--root <tree>]      digest this tree (or --root's)
//   node --experimental-strip-types scripts/soft-changed-types.mts --diff <base.json> <now.json> [--out test/review/soft-changed-types.json] [--label <commit of the base tree>]
//
// The committed result, test/review/soft-changed-types.json, holds `changed` (types in both trees whose build differs), `added`, and `changeArg` (the string to pass:
// `node --experimental-strip-types scripts/test-build-neutrality.mts --changed "$(node -p \"require('./test/review/soft-changed-types.json').changeArg\")"`).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './review/lib.mts';

const argv = process.argv.slice(2), args = parseArgs(argv);
if (args.root) process.env.REVIEW_SERVE_ROOT = String(args.root);
const SEEDS = ['a', 'b', 'c'];

if (args.diff) {
  const [baseF, nowF] = [args.diff, argv[argv.indexOf('--diff') + 2]];
  const base = JSON.parse(fs.readFileSync(baseF, 'utf8')).types as Record<string, string>, now = JSON.parse(fs.readFileSync(nowF, 'utf8')).types as Record<string, string>;
  const changed = Object.keys(now).filter(t => t in base && base[t] !== now[t]).sort(), added = Object.keys(now).filter(t => !(t in base)).sort(), removed = Object.keys(base).filter(t => !(t in now)).sort();
  const out = { schema: 1, what: 'the item types whose BUILD differs between the pre-SOFT tree and this branch (scripts/soft-changed-types.mts): pass changeArg to scripts/test-build-neutrality.mts --changed', baseTree: String(args.label && args.label !== 'true' ? args.label : path.basename(String(baseF))), changed, added, removed, changeArg: changed.map(t => `item:${t}`).join(',') };
  const dest = String(args.out && args.out !== 'true' ? args.out : path.join(import.meta.dirname, '..', 'test', 'review', 'soft-changed-types.json'));
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(`${changed.length} changed, ${added.length} added, ${removed.length} removed -> ${dest}`);
  process.exit(0);
}

const { startSession } = await import('./review/page.mts');
const session = await startSession();
try {
  const w = await session.openBare();
  const types: Record<string, string> = await w.page.evaluate((seeds: string[]) => {
    const hb = (window as any).__houseBuilderRef, out: Record<string, string> = {};
    const pal = { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' };
    const r = (v: number) => Math.round(v * 1e4);
    const fnv = (h: number, n: number) => { h ^= n | 0; return Math.imul(h, 16777619) >>> 0; };
    for (const t of [...Object.keys(hb.ITEMS), ...hb.PROPS.keys()]) {
      let h = 2166136261;
      try {
        for (const sd of seeds) {
          const o = hb.buildProp(t, {}, pal, sd); if (!o) { h = fnv(h, -1); continue; }
          o.updateMatrixWorld(true);
          o.traverse((m: any) => {
            if (!m.isMesh) return;
            const g = m.geometry, P = g.getAttribute('position'), C = g.getAttribute('color'), mats = Array.isArray(m.material) ? m.material : [m.material];
            h = fnv(h, P.count); h = fnv(h, g.index ? g.index.count : 0);
            const e = m.matrixWorld.elements;
            for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); h = fnv(h, r(e[0] * x + e[4] * y + e[8] * z + e[12])); h = fnv(h, r(e[1] * x + e[5] * y + e[9] * z + e[13])); h = fnv(h, r(e[2] * x + e[6] * y + e[10] * z + e[14])); }
            if (C) for (let i = 0; i < C.count; i++) h = fnv(h, r(C.getX(i)));
            for (const mt of mats) { h = fnv(h, mt.color ? mt.color.getHex() : 0); h = fnv(h, r(mt.roughness ?? -1)); h = fnv(h, r(mt.metalness ?? -1)); h = fnv(h, mt.emissive ? mt.emissive.getHex() : 0); h = fnv(h, (mt.transparent ? 1 : 0) | (mt.flatShading ? 2 : 0) | (mt.vertexColors ? 4 : 0) | (mt.map ? 8 : 0)); h = fnv(h, r(mt.opacity ?? 1)); }
            h = fnv(h, (m.castShadow ? 1 : 0) | (m.receiveShadow ? 2 : 0));
          });
        }
        out[t] = h.toString(16);
      } catch (e: any) { out[t] = 'error:' + e.message; }
    }
    return out;
  }, SEEDS);
  if (w.errors.length) console.error(`page errors: ${w.errors.slice(0, 2).join(' | ')}`);
  await w.close();
  const bad = Object.entries(types).filter(([, v]) => v.startsWith('error:'));
  if (bad.length) { console.error(`${bad.length} types could not be built: ${bad.slice(0, 4).map(b => b[0] + ' ' + b[1]).join('; ')}`); process.exit(1); }
  const dest = String(args.digest && args.digest !== 'true' ? args.digest : 'digest.json');
  fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({ schema: 1, root: process.env.REVIEW_SERVE_ROOT || 'this tree', seeds: SEEDS, types }, null, 1) + '\n');
  console.log(`${Object.keys(types).length} types digested -> ${dest}`);
} finally { await session.close(); }
