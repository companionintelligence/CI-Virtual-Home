#!/usr/bin/env -S node --experimental-strip-types
// R7: the prop drift check (plan 5.1, used by SOFT and BAKE). A type that is rebuilt in place (a new bedding, a baked sofa) must keep the
// box the composer laid every room out with: sizeOf() reads the MEASURED box, so a prop that grows or moves its box re-lays-out nothing in
// the committed specs but makes every later rebake different, and can stand a piece in a wall or a neighbour. This compares, per type,
// the box the registry builds NOW with the box it built at the frozen baseline (test/review/baselines/prop-boxes.json):
//   rigid types     every one of the six edges of the box within 0.01 m, either way
//   foliage types   (group `plant`, or `foliage: true`) an edge may stand at most 0.03 m OUTSIDE the old one (a one-sided overshoot: leaves
//                   lean a different way in every plant); any amount inside it
// the box is the union over 12 seeds (a plant's lean, a bedding's throw, an rng-picked variant), at the type's default params, and at
// three values (0.75, 1 and 1.35 times the box's own extent) of each param that sizes it (w, d, l, r, h), so a type that fits its param
// line differently is caught too. A type that lost a param or changed its param list is drift; a removed type is drift; a new type is
// reported and is not (it has no old box).
//
//   node --experimental-strip-types scripts/check-prop-drift.mts                         compare this tree with the baseline (exit 1 on drift)
//   node --experimental-strip-types scripts/check-prop-drift.mts --types bed,sofa        only these types
//   node --experimental-strip-types scripts/check-prop-drift.mts --except bar-stool      leave out types a change means to move (say why in the commit)
//   node --experimental-strip-types scripts/check-prop-drift.mts --write                 re-freeze the baseline (at baseline/stage0-green only)
//   node --experimental-strip-types scripts/check-prop-drift.mts --self-test             prove the comparison catches what it should (no browser)
//   node --experimental-strip-types scripts/check-prop-drift.mts --out file              also write what was measured
// (needs `pnpm run build`; the page is loaded once and nothing is rendered: ~30 s.)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SERVE_ROOT } from './review/page.mts';
import { BASELINES, ROOT, BEFORE_TAG, parseArgs, stableJson, writeText, rel, readJson, productFingerprint, productDiffersFromTag } from './review/lib.mts';

export const BOXES_FILE = path.join(BASELINES, 'prop-boxes.json');
export const SEEDS = 'abcdefghijkl'.split('');
export const PROBE_SEEDS = ['a', 'b', 'c'];
export const RIGID_TOL = 0.01, FOLIAGE_OVERSHOOT = 0.03;
type Box = [number, number, number, number, number, number];   // x0 y0 z0 x1 y1 z1
export interface TypeBoxes { source: 'registry' | 'page'; foliage: boolean; params: string[]; box: Box; probes: Record<string, Box> }
export interface Boxes { schema: 1; what: string; regenerate: string; seeds: string[]; probeSeeds: string[]; tolerance: { rigid: number; foliageOvershoot: number }; types: Record<string, TypeBoxes> }

const EDGE = ['min x', 'min y', 'min z', 'max x', 'max y', 'max z'];
/** how far each edge of `now` stands from `was`, positive = outside it (bigger) */
export const outside = (was: Box, now: Box): number[] => was.map((v, i) => (i < 3 ? v - now[i] : now[i] - v));

export interface Drift { type: string; what: string }
/** the comparison, pure: baseline against a fresh measurement */
export function compare(base: Boxes, now: Boxes, { types = null as string[] | null, except = [] as string[] } = {}): { drift: Drift[]; added: string[]; checked: number } {
  const drift: Drift[] = [], skip = new Set(except), only = types ? new Set(types) : null;
  let checked = 0;
  for (const [t, w] of Object.entries(base.types)) {
    if (skip.has(t) || (only && !only.has(t))) continue;
    const n = now.types[t];
    if (!n) { drift.push({ type: t, what: 'removed: the baseline has it, this tree does not' }); continue; }
    checked++;
    if (JSON.stringify(w.params) !== JSON.stringify(n.params)) drift.push({ type: t, what: `params changed: [${w.params}] -> [${n.params}]` });
    if (w.source !== n.source) drift.push({ type: t, what: `moved from ${w.source} to ${n.source}` });
    const foliage = w.foliage || n.foliage, tol = (o: number) => (foliage ? o <= FOLIAGE_OVERSHOOT + 1e-9 : Math.abs(o) <= RIGID_TOL + 1e-9);
    const check = (label: string, a: Box, b: Box | undefined) => {
      if (!b) { drift.push({ type: t, what: `${label}: not measured now` }); return; }
      const o = outside(a, b);
      o.forEach((v, i) => { if (!tol(v)) drift.push({ type: t, what: `${label} ${EDGE[i]} ${v >= 0 ? 'outside' : 'inside'} by ${Math.abs(v).toFixed(3)} m (${foliage ? 'foliage: at most 0.03 outside' : 'rigid: within 0.01'})` }); });
    };
    check('default box', w.box, n.box);
    for (const [k, pb] of Object.entries(w.probes)) check(`probe ${k}`, pb, n.probes[k]);
  }
  const added = Object.keys(now.types).filter(t => !base.types[t] && !skip.has(t) && (!only || only.has(t)));
  return { drift, added, checked };
}

// ---- measuring ------------------------------------------------------------------------------------------------------------
async function measure(base: Boxes | null): Promise<{ boxes: Boxes; version: string }> {
  // a comparison probes the very values the baseline did (a type whose box moved would otherwise ask different questions)
  const baseProbes: Record<string, string[]> = base ? Object.fromEntries(Object.entries(base.types).map(([t, v]) => [t, Object.keys(v.probes)])) : {};
  const { PROPS } = await import(pathToFileURL(path.join(SERVE_ROOT, 'assets', 'props', 'index.js')).href);
  const { ITEM_PARAMS } = await import(pathToFileURL(path.join(SERVE_ROOT, 'assets', 'item-map.js')).href);
  const { PLACEMENT } = await import(pathToFileURL(path.join(SERVE_ROOT, 'assets', 'props', 'placement.js')).href);
  const paramMap: Record<string, string[]> = {};
  for (const [t, ps] of Object.entries(ITEM_PARAMS)) paramMap[t] = [...(ps as string[])];
  for (const [t, d] of PROPS as Map<string, any>) paramMap[t] = [...(d.params || [])];
  const foliage = Object.keys(paramMap).filter(t => (PLACEMENT[t] && PLACEMENT[t].group === 'plant') || (PROPS.get(t) && PROPS.get(t).foliage));
  const { startSession } = await import('./review/page.mts');
  const session = await startSession();
  try {
    const w = await session.openBare();
    const measured: Record<string, any> = await w.page.evaluate(({ paramMap, foliage, seeds, probeSeeds, baseProbes }: any) => {
      const hb = (window as any).__houseBuilderRef, T = (window as any).__THREE, out: Record<string, any> = {};
      const pal = { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' };
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const boxOf = (t: string, params: any, sds: string[]) => {
        let b: any = null;
        for (const sd of sds) { const o = hb.buildProp(t, params, pal, sd); if (!o) return null; o.updateMatrixWorld(true); const x = new T.Box3().setFromObject(o); b = b ? b.union(x) : x; }
        return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(r3);
      };
      for (const t of [...Object.keys(hb.ITEMS), ...hb.PROPS.keys()]) {
        try {
          const box = boxOf(t, {}, seeds); if (!box) continue;
          const probes: Record<string, any> = {}, params: string[] = paramMap[t] || [];
          const ext = { w: box[3] - box[0], r: (box[3] - box[0]) / 2, h: box[4] - box[1], d: box[5] - box[2], l: box[5] - box[2] } as Record<string, number>;
          const ask: Array<[string, number]> = [];
          if (baseProbes[t]) for (const key of baseProbes[t]) { const [k, v] = key.split('='); ask.push([k, Number(v)]); }
          else for (const k of ['w', 'd', 'l', 'r', 'h']) { if (!params.includes(k) || !(ext[k] >= 0.1)) continue; for (const m of [0.75, 1, 1.35]) ask.push([k, Math.round(ext[k] * m * 100) / 100]); }
          for (const [k, v] of ask) { try { const pb = boxOf(t, { [k]: v }, probeSeeds); if (pb) probes[`${k}=${v}`] = pb; } catch { /* a value the builder refuses */ } }
          out[t] = { source: hb.PROPS.has(t) ? 'registry' : 'page', foliage: foliage.includes(t), params, box, probes };
        } catch (e: any) { out[t] = { error: e.message }; }
      }
      return out;
    }, { paramMap, foliage, seeds: SEEDS, probeSeeds: PROBE_SEEDS, baseProbes });
    if (w.errors.length) console.error(`page errors: ${w.errors.slice(0, 2).join(' | ')}`);
    await w.close();
    const types: Record<string, TypeBoxes> = {};
    let broken = 0;
    for (const t of Object.keys(measured).sort()) { const m = measured[t]; if (m.error) { console.error(`✗ ${t}: ${m.error}`); broken++; continue; } types[t] = m; }
    if (!Object.keys(types).length || broken) throw new Error(`${broken} type(s) could not be built and ${Object.keys(types).length} were measured: the measurement is not trustworthy, nothing written`);
    return { boxes: { schema: 1, what: WHAT, regenerate: REGENERATE, seeds: SEEDS, probeSeeds: PROBE_SEEDS, tolerance: { rigid: RIGID_TOL, foliageOvershoot: FOLIAGE_OVERSHOOT }, types }, version: session.version };
  } finally { await session.close(); }
}

export const WHAT = 'the box of every item type as built by the registry and the page builders alone (scripts/check-prop-drift.mts): the union over 12 seeds at default params, and at three values of each sizing param. A type rebuilt in place must keep it: rigid types within 0.01 m, foliage at most 0.03 m outside.';
export const REGENERATE = 'pnpm run build && node --experimental-strip-types scripts/check-prop-drift.mts --write   (only to re-freeze the BEFORE at baseline/stage0-green; never to make a drifting type pass)';

// ---- the self-test: the comparison itself, against copies of the real baseline ----------------------------------------------
function selfTest(base: Boxes): number {
  let bad = 0;
  const ok = (cond: boolean, what: string) => { console.log(`  ${cond ? '✓' : '✗'} ${what}`); if (!cond) bad++; };
  const clone = (): Boxes => JSON.parse(JSON.stringify(base));
  const rigid = Object.keys(base.types).find(t => !base.types[t].foliage && Object.keys(base.types[t].probes).length)!;
  const leafy = Object.keys(base.types).find(t => base.types[t].foliage)!;
  const nudge = (b: Boxes, t: string, edge: number, by: number) => { b.types[t].box[edge] = Math.round((b.types[t].box[edge] + by) * 1000) / 1000; return b; };
  ok(compare(base, clone()).drift.length === 0, 'a tree equal to the baseline has no drift');
  ok(compare(base, nudge(clone(), rigid, 3, 0.005)).drift.length === 0, `${rigid}: 5 mm either way is inside the 0.01 tolerance`);
  ok(compare(base, nudge(clone(), rigid, 3, 0.02)).drift.some(d => d.type === rigid), `${rigid}: 2 cm outside is drift`);
  ok(compare(base, nudge(clone(), rigid, 0, 0.02)).drift.some(d => d.type === rigid), `${rigid}: 2 cm inside is drift too (a rigid box may not shrink)`);
  { const n = clone(); const k = Object.keys(n.types[rigid].probes)[0]; n.types[rigid].probes[k][5] += 0.05; ok(compare(base, n).drift.some(d => d.what.startsWith('probe')), `${rigid}: a box that grows differently with its param (${k}) is drift`); }
  ok(compare(base, nudge(clone(), leafy, 3, 0.02)).drift.length === 0, `${leafy}: foliage 2 cm outside is inside the 0.03 overshoot`);
  ok(compare(base, nudge(clone(), leafy, 3, 0.04)).drift.some(d => d.type === leafy), `${leafy}: foliage 4 cm outside is drift`);
  ok(compare(base, nudge(clone(), leafy, 3, -0.30)).drift.length === 0, `${leafy}: foliage 30 cm inside is allowed (a tighter plant never stands in a wall)`);
  { const n = clone(); delete n.types[rigid]; ok(compare(base, n).drift.some(d => d.type === rigid && /removed/.test(d.what)), `${rigid}: a removed type is drift`); ok(compare(base, n, { except: [rigid] }).drift.length === 0, '--except leaves it out'); }
  { const n = clone(); n.types[rigid].params = [...n.types[rigid].params, 'zz']; ok(compare(base, n).drift.some(d => /params changed/.test(d.what)), `${rigid}: a changed param list is drift`); }
  { const n = clone(); n.types['zz-new-type'] = { ...n.types[rigid] }; const c = compare(base, n); ok(c.drift.length === 0 && c.added.includes('zz-new-type'), 'a new type is reported and is not drift'); }
  { const n = nudge(clone(), rigid, 3, 0.5); ok(compare(base, n, { types: [leafy] }).drift.length === 0, '--types restricts the comparison'); }
  return bad;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const list = (k: string) => (args[k] && args[k] !== 'true' ? args[k].split(',') : null);
  if (args['self-test'] === 'true') {
    if (!fs.existsSync(BOXES_FILE)) { console.error(`no ${rel(BOXES_FILE)}: --write it first`); process.exit(2); }
    const bad = selfTest(readJson(BOXES_FILE));
    console.log(bad ? `✗ ${bad} wrong` : '✓ the drift comparison catches what it should');
    process.exit(bad ? 1 : 0);
  }
  if (args.write === 'true') {
    const fp = productFingerprint('HEAD');
    if (fp.dirty.length) { console.error(`the product code has uncommitted changes: ${fp.dirty.slice(0, 3).join('; ')}`); process.exit(2); }
    if (args['allow-drift'] !== 'true') { const d = productDiffersFromTag(); if (d.length) { console.error(`HEAD's product code differs from ${BEFORE_TAG} in: ${d.join(', ')}; the baseline is frozen from that tag (--allow-drift to override)`); process.exit(2); } }
  }
  const base0 = args.write !== 'true' && fs.existsSync(BOXES_FILE) ? readJson<Boxes>(BOXES_FILE) : null;
  const { boxes } = await measure(base0);
  console.log(`${Object.keys(boxes.types).length} types measured (${Object.values(boxes.types).reduce((a, t) => a + 1 + Object.keys(t.probes).length, 0)} boxes)`);
  if (args.out && args.out !== 'true') writeText(path.resolve(args.out), stableJson(boxes));
  if (args.write === 'true') { writeText(BOXES_FILE, stableJson(boxes)); console.log(`→ ${rel(BOXES_FILE)}`); process.exit(0); }
  if (!fs.existsSync(BOXES_FILE)) { console.error(`no ${rel(BOXES_FILE)}: --write it first`); process.exit(2); }
  const base = base0!;
  const r = compare(base, boxes, { types: list('types'), except: list('except') || [] });
  for (const d of r.drift) console.log(`  ✗ ${d.type}: ${d.what}`);
  if (r.added.length) console.log(`  new types (no old box to hold them to): ${r.added.length}: ${r.added.slice(0, 12).join(', ')}${r.added.length > 12 ? ', ...' : ''}`);
  console.log(r.drift.length ? `✗ ${new Set(r.drift.map(d => d.type)).size} type(s) drifted (${r.drift.length} finding(s)) of ${r.checked} checked` : `✓ no drift: ${r.checked} types hold their baseline boxes`);
  process.exit(r.drift.length ? 1 : 0);
}
