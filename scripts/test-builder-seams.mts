#!/usr/bin/env -S node --experimental-strip-types
// What the validator, the catalog builder and the streams read OFF the builders, tested: the page builders' published
// parameters (item-map.ts ITEM_PARAMS → assets/item-meta.ts → the catalog), the factories' probe context, and the
// hand-kept type list of the site kit. Needs `pnpm run build` (it reads assets/*.js).
// @check-house quick
//
//   node --experimental-strip-types scripts/test-builder-seams.mts        (any cwd; <1 s)
import fs from 'node:fs';
import path from 'node:path';
import { createItemMap, ITEM_PARAMS, SURFACE_ITEMS } from '../assets/item-map.js';
import { createSiteBuild } from '../assets/site-build.js';
import { SITE_KIT_TYPES } from '../assets/site.js';
import { pageItemDef } from '../assets/item-meta.js';
import { PAGE_PLACE } from '../assets/props/page-place.js';
import { PROPS } from '../assets/props/index.js';
import { probeContext } from './probe-context.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };

// ---- the page builders' parameters are published, every one --------------------------------------------------
const ITEMS: Record<string, (it: unknown, lv?: unknown) => unknown> = createItemMap(probeContext()).ITEMS;
const types = Object.keys(ITEMS), listed = Object.keys(ITEM_PARAMS);
check(types.length > 30, `item-map.ts builds ${types.length} page types`);
check(!types.filter(t => !(t in ITEM_PARAMS)).length && !listed.filter(t => !(t in ITEMS)).length, 'ITEM_PARAMS has one entry per ITEMS type, and no other',
  `no entry: ${types.filter(t => !(t in ITEM_PARAMS)).join(', ') || '—'}\nno builder: ${listed.filter(t => !(t in ITEMS)).join(', ') || '—'}`);
// a builder reads a spec key as `it.<key>`: one it does not list is a parameter the catalog would not publish
const unlisted: string[] = [];
for (const t of types) {
  const reads = [...new Set([...ITEMS[t].toString().matchAll(/\bit\.(\w+)/g)].map(m => m[1]))].sort();
  const miss = reads.filter(k => !(ITEM_PARAMS[t] || []).includes(k));
  if (miss.length) unlisted.push(`${t}: reads ${miss.join(', ')} — add to ITEM_PARAMS['${t}'] in assets/item-map.ts`);
}
check(!unlisted.length, 'every key a page builder reads is in its ITEM_PARAMS entry', unlisted.join('\n'));
check(SURFACE_ITEMS.every(t => t in ITEMS), 'SURFACE_ITEMS are page types', SURFACE_ITEMS.filter(t => !(t in ITEMS)).join(', '));
check(!types.some(t => PROPS.has(t)) , 'no type is both a page builder and a registry prop', types.filter(t => PROPS.has(t)).join(', '));

// ---- what the catalog builder gets ---------------------------------------------------------------------------
const defs = types.map(t => [t, pageItemDef(t)] as const);
check(defs.every(([, d]) => !!d), 'pageItemDef(type) is defined for every page type');
check(defs.every(([t, d]) => d && JSON.stringify(d.params) === JSON.stringify(ITEM_PARAMS[t])), 'its params are the builder\'s ITEM_PARAMS');
check(defs.every(([t, d]) => d && d.surface === SURFACE_ITEMS.includes(t)), 'its surface flag is SURFACE_ITEMS');
check(pageItemDef('side-table') === undefined && pageItemDef('no-such-type') === undefined, 'pageItemDef is undefined for a registry prop or an unknown type (the registry answers those)');
check(Object.keys(PAGE_PLACE).every(t => t in ITEMS), 'PAGE_PLACE (S3) names only page types', Object.keys(PAGE_PLACE).filter(t => !(t in ITEMS)).join(', '));
check(defs.every(([t, d]) => d && (t in PAGE_PLACE ? d.place === PAGE_PLACE[t] : !('place' in d))), 'a page type has a `place` exactly when PAGE_PLACE gives it one');
// the committed catalog: report only — S3 owns committing it, and it is regenerated with `pnpm run catalog`
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'house-catalog.json'), 'utf8')).types;
const stale = types.filter(t => catalog[t] && JSON.stringify(catalog[t].params) !== JSON.stringify(ITEM_PARAMS[t]));
if (stale.length) console.log(`  note: content/house-catalog.json lists other params for ${stale.length} page types (${stale.slice(0, 4).join(', ')}…): pnpm run catalog`);

// ---- the factories take a probe context ----------------------------------------------------------------------
const probe = probeContext();
let threw = '';
try {
  // the shapes a factory scope might use: a constructed geometry, a material chained on, arithmetic, a callback
  const g = new probe.THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0);
  const m = probe.std(0x333333, { roughness: 0.5 }); m.color.set(0xffffff);
  if (!(probe.THREE.MathUtils.clamp(3, 0, 1) * 2 + 1 === 1)) throw new Error('arithmetic on a stand-in is not 0');
  if (typeof (probe as any).then !== 'undefined') throw new Error('a stand-in is a thenable');
  createItemMap(probe); createSiteBuild(probe);
} catch (e) { threw = String(e && e.stack || e); }
check(!threw, 'createItemMap and createSiteBuild take the probe context (a factory may build at factory scope)', threw);
// …and a factory that does is still listable, as it would be by the validator
const eager = (b: any) => { const geo = new b.THREE.CylinderGeometry(1, 1, 1, 8); geo.translate(0, 0.5, 0); return { ITEMS: { probe: () => geo } }; };
check(Object.keys(eager(probeContext()).ITEMS).join() === 'probe', 'a factory that builds a geometry up front is still listable');

// ---- the site kit's hand-kept type list -----------------------------------------------------------------------
// SITE_KIT_TYPES (assets/site.ts) is what the validator accepts as a site type the kit builds; build()'s switch is
// what builds them. A case added to one and not the other is a type that validates and does not build, or the reverse.
const src = fs.readFileSync(path.join(ROOT, 'assets', 'site.ts'), 'utf8');
const from = src.indexOf('function build(s, index)'), body = src.slice(from, src.indexOf('\n  function ', from + 1));
const cases = [...body.matchAll(/^\s+case '([\w-]+)':/gm)].map(m => m[1]);
check(from > 0 && cases.length > 0 && JSON.stringify([...cases].sort()) === JSON.stringify([...SITE_KIT_TYPES].sort()), 'SITE_KIT_TYPES is the case list of the site kit\'s build()',
  `switch: ${cases.join(', ')}\nlist:   ${SITE_KIT_TYPES.join(', ')}`);

console.log(`${bad ? '✗' : '✓'} builder seams: ${bad} wrong`);
process.exit(bad ? 1 : 0);
