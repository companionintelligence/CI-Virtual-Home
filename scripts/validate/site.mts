// Validator plugin — owned by S4 (site). See _types.mts for the contract.
//
// It widens what the core accepts (the grounds `meadow` and `gravel`) and takes over the core's 'site-needs' rule:
// the geometry each site type needs, now that fences run along a `path`, pools can be a `poly`, and the new types
// (planting, terrace, stair, climber, string-lights, rill) need their own. Those are errors, as the core's were:
// a builder given no geometry builds nothing. Everything else is a lint and arrives as a warning (plan §2.0):
//   unknown-name     a shrub form, flower kind, tree species, planting kind / mix, path surface, pool shape, fence,
//                    rail or stair style, lot context / street / water the builders do not know (they fall back)
//   planting-ref     a planting `along` naming a path or terrace that is not there
//   front-crates     `garden-beds` (raised vegetable crates) between the entry facade and the street
//   in-house         a slab, a bed, a pool or a prop standing on the ground storey's footprint
//   off-lot          an item standing outside the lot
//   buried-water     water a patio, deck or terrace covers (its rim under the slab's top)
//   bed-on-slab      a bed or planting laid over a patio, driveway or deck
//   steep-stair      an exterior stair steeper than 0.19 m risers on 0.25 m treads
//   water-sides      lot.water on all four sides (an island lot is not built)
import type { Check, Issue, Extend, Rule } from './_types.mts';
import { SHRUB_FORMS, FLOWER_KINDS_ALL, TREE_SPECIES, PATH_SURFACES } from '../../assets/site.js';
import { PLANTING_KINDS, MIXES, SPECIES, WATER_SHAPES, isShapedWater, waterOutline, createSiteContext } from '../../assets/site-planting.js';
import { rectPoly, inPoly, polyArea, bbox, centroid } from '../../assets/site-geom.js';

export const extend: Extend = { grounds: ['meadow', 'gravel'] };
export const replaces: Rule[] = ['site-needs'];

const FENCES = ['picket', 'privacy', 'slat-h', 'post-rail', 'metal', 'glass', 'stone-wall'];
const RAILS = ['glass', 'metal', 'timber', 'cable', 'colonial'];
const STAIRS = ['stone', 'concrete', 'timber', 'steel'];
const CONTEXTS = ['suburb', 'city', 'forest', 'desert', 'waterfront', 'rural', 'hillside'];
const WATERS = ['lake', 'river', 'canal', 'sea'];
const SIDES = ['S', 'N', 'E', 'W'];
const TERRACE_EDGES = ['retaining', 'planted', 'rail', 'slope'];
const isP = (p: unknown) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number';
const isLine = (l: unknown, n = 2) => Array.isArray(l) && l.length >= n && l.every(isP);

// the plan footprint of an item as the builders lay it out (a rect turned by rot, or its own polygon)
const DEFAULT_WD: Record<string, [number, number]> = { patio: [4, 3], driveway: [4, 3], deck: [4, 3], pool: [6, 4], 'turtle-pool': [8, 6], pond: [4, 3], 'garden-beds': [3, 2], greenhouse: [3.6, 2.4], turf: [6, 4], bed: [2, 1] };
function footprintOf(s: any, i: number, id: string) {
  if (isShapedWater(s)) { const w = waterOutline(s, i, id); return w ? w.poly : null; }
  if (Array.isArray(s.poly) && s.poly.length >= 3) return s.poly;
  if (!isP(s.at)) return null;
  const wd = DEFAULT_WD[s.type]; if (!wd) return null;
  return rectPoly(s.at, s.w || wd[0], s.d || wd[1], s.rot || 0);
}
// the share of polygon a covered by polygon b, sampled on a 0.2 m grid
function covered(a: number[][], b: number[][]) {
  const bb = bbox(a as any); let n = 0, k = 0;
  for (let x = bb.x0 + 0.1; x < bb.x1; x += 0.2) for (let z = bb.z0 + 0.1; z < bb.z1; z += 0.2) if (inPoly(x, z, a as any)) { n++; if (inPoly(x, z, b as any)) k++; }
  return n ? k / n : 0;
}

const check: Check = (spec, ctx) => {
  const out: Issue[] = [];
  const err = (message: string, code?: string) => out.push({ level: 'error', message, code });
  const warn = (message: string, code: string) => out.push({ level: 'warn', message, code });
  const site: any[] = spec.site || [];
  const lot = spec.lot || {};
  const S = (s: any, i: number) => `site[${i}] ${s.type}`;

  // ---- 'site-needs' (replaced): each type's geometry — the core's findings for the old forms, word for word
  for (const [i, s] of site.entries()) {
    if (!ctx.siteTypes.includes(s.type)) continue;   // the core reports an unknown type
    let needs: string, ok: boolean;
    if (s.type === 'fence' || s.type === 'wall-low') { needs = 'from/to'; ok = !!(s.from && s.to) || isLine(s.path); }
    else if (s.type === 'path' || s.type === 'hedge' || s.type === 'string-lights') { needs = 'path'; ok = isLine(s.path); }
    else if (s.type === 'bed') { needs = 'poly or at'; ok = (Array.isArray(s.poly) && s.poly.length >= 3) || Array.isArray(s.at); }
    else if (s.type === 'pool' || s.type === 'pond') { needs = 'at'; ok = Array.isArray(s.at) || isLine(s.poly, 3); }
    else if (s.type === 'planting') { needs = 'along, poly or at'; ok = s.along !== undefined || isLine(s.poly, 3) || isP(s.at); }
    else if (s.type === 'terrace') { needs = 'poly (or at) and y'; ok = (isLine(s.poly, 3) || isP(s.at)) && typeof s.y === 'number'; }
    else if (s.type === 'stair' || s.type === 'climber') { needs = 'from/to'; ok = isP(s.from) && isP(s.to); }
    else { needs = 'at'; ok = Array.isArray(s.at); }
    if (!ok) err(`site ${s.type}: needs ${needs}`);
  }

  // ---- names the builders do not know (they fall back to a default)
  const known = (v: unknown, list: readonly string[], what: string, s: any, i: number) => { if (v !== undefined && !(typeof v === 'string' && list.includes(v))) warn(`${S(s, i)}: ${what} "${v}" is not one of ${list.join(' | ')} — built as the default`, 'unknown-name'); };
  for (const [i, s] of site.entries()) {
    if (s.type === 'shrub') known(s.form, SHRUB_FORMS, 'form', s, i);
    if (s.type === 'flowers') known(s.kind, FLOWER_KINDS_ALL, 'kind', s, i);
    if (s.type === 'tree') known(s.species, TREE_SPECIES, 'species', s, i);
    if (s.type === 'grove' || s.type === 'scatter') for (const sp of Array.isArray(s.species) ? s.species : s.species !== undefined ? [s.species] : []) if (s.type === 'grove') known(sp, TREE_SPECIES, 'species', s, i);
    if (s.type === 'path') known(s.surface, PATH_SURFACES, 'surface', s, i);
    if (s.type === 'fence') known(s.style, FENCES, 'style', s, i);
    if (s.type === 'stair') { known(s.style, STAIRS, 'style', s, i); if (typeof s.rail === 'string') known(s.rail, RAILS, 'rail', s, i); }
    if (s.type === 'deck') { known(s.railStyle, RAILS, 'railStyle', s, i); if (s.rails && typeof s.rails === 'object' && !Array.isArray(s.rails)) known(s.rails.style, RAILS, 'rails.style', s, i); for (const sd of Array.isArray(s.rails) ? s.rails : []) known(sd, SIDES, 'rails side', s, i); }
    if (s.type === 'pool') known(s.shape, WATER_SHAPES, 'shape', s, i);
    if (s.type === 'terrace') { const k = typeof s.edge === 'string' ? s.edge : s.edge && s.edge.kind; known(k, TERRACE_EDGES, 'edge', s, i); }
    if (s.type === 'planting') {
      known(s.kind, PLANTING_KINDS, 'kind', s, i);
      if (typeof s.mix === 'string') known(s.mix, Object.keys(MIXES), 'mix', s, i);
      else if (s.mix && typeof s.mix === 'object') for (const k of s.mix.kinds || []) known(k, Object.keys(SPECIES), 'mix species', s, i);
      if (typeof s.along === 'string') {
        const [what, ref] = s.along.split(':');
        if (what === 'facade') { for (const sd of (ref || '').split(',')) if (sd !== 'all' && !SIDES.includes(sd.trim().toUpperCase())) warn(`${S(s, i)}: along "${s.along}" — a facade is S, N, E, W, a list of them or all`, 'planting-ref'); }
        else if (what === 'path' || what === 'terrace') {
          const n = Number(ref), hit = Number.isInteger(n) ? site[n] && site[n].type === what : site.some(o => o.type === what && o.id === ref);
          if (!hit) warn(`${S(s, i)}: along "${s.along}" names no ${what} (a site index or an id)`, 'planting-ref');
        } else warn(`${S(s, i)}: along "${s.along}" — facade:<sides>, path:<index or id>, terrace:<index or id>, or a polyline`, 'planting-ref');
      }
    }
  }
  if (lot.context !== undefined) known(lot.context, CONTEXTS, 'lot.context', { type: 'lot' }, -1);
  if (lot.street !== undefined && !(SIDES.includes(lot.street) || lot.street === 'none')) warn(`lot.street "${lot.street}" is not S | N | E | W | none`, 'unknown-name');
  if (lot.water !== undefined) {
    const w = typeof lot.water === 'string' ? { kind: lot.water } : lot.water;
    if (w.kind !== undefined && !WATERS.includes(w.kind)) warn(`lot.water kind "${w.kind}" is not ${WATERS.join(' | ')}`, 'unknown-name');
    if (Array.isArray(w.sides) && w.sides.length >= 4) warn('lot.water on all four sides: an island lot is not built (the water stops at three)', 'water-sides');
  }

  // ---- the front garden: vegetable crates between the entry facade and the street
  const ground = (spec.levels || []).filter(l => (l.y || 0) <= 0.001).flatMap(l => l.footprint || []);
  if (ground.length) {
    const b = { x0: Math.min(...ground.map(r => r.x)), x1: Math.max(...ground.map(r => r.x + r.w)), z0: Math.min(...ground.map(r => r.z)), z1: Math.max(...ground.map(r => r.z + r.d)) };
    const side = (spec.entry || {}).side || 'S';
    const front = (x: number, z: number) => side === 'S' ? z > b.z1 : side === 'N' ? z < b.z0 : side === 'E' ? x > b.x1 : x < b.x0;
    for (const [i, s] of site.entries()) if (s.type === 'garden-beds' && isP(s.at) && front(s.at[0], s.at[1])) warn(`${S(s, i)}: vegetable crates in the front garden — a bed or a planting reads as a garden there`, 'front-crates');
  }

  // ---- standing in the house, or off the lot
  const inHouse = (x: number, z: number) => ground.some(r => x > r.x + 0.05 && x < r.x + r.w - 0.05 && z > r.z + 0.05 && z < r.z + r.d - 0.05);
  // (a car in the garage belongs there; a stilted deck round a post stands mostly outside it)
  const SLABS = new Set(['patio', 'driveway', 'deck', 'bed', 'pool', 'turtle-pool', 'pond', 'hottub', 'garden-beds', 'greenhouse', 'gazebo', 'turf', 'loungers', 'firepit']);
  const groundPolys = ground.map(r => [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]]);
  for (const [i, s] of site.entries()) {
    if (!(SLABS.has(s.type) || isShapedWater(s)) || (s.y ?? 0) > 0.3) continue;   // a roof terrace's deck or pool is above the house
    const fp = footprintOf(s, i, spec.id || '');
    if (fp) {
      const k = groundPolys.reduce((a, g) => a + covered(fp, g), 0);
      if (k > 0.5) { const c = centroid(fp); warn(`${S(s, i)} at (${c[0].toFixed(1)}, ${c[1].toFixed(1)}): ${Math.round(Math.min(1, k) * 100)} % of it stands on the ground storey's footprint`, 'in-house'); }
    } else if (isP(s.at) && inHouse(s.at[0], s.at[1])) warn(`${S(s, i)} at (${s.at[0]}, ${s.at[1]}) stands on the ground storey's footprint`, 'in-house');
  }
  // (a jetty or a boathouse over the lot's water is meant to be off it)
  const water = lot.water === undefined ? null : typeof lot.water === 'string' ? { kind: lot.water } : lot.water;
  const wetSides: string[] = water ? (Array.isArray(water.sides) && water.sides.length ? water.sides : ['N']) : [];
  const overWater = (x: number, z: number) => wetSides.some(sd => sd === 'N' ? z < -lot.d / 2 : sd === 'S' ? z > lot.d / 2 : sd === 'E' ? x > lot.w / 2 : x < -lot.w / 2);
  if (lot.w > 0 && lot.d > 0) for (const [i, s] of site.entries()) {
    const p = isP(s.at) ? s.at : Array.isArray(s.poly) && s.poly.length ? centroid(s.poly) : null;
    if (p && (Math.abs(p[0]) > lot.w / 2 + 0.5 || Math.abs(p[1]) > lot.d / 2 + 0.5) && !overWater(p[0], p[1])) warn(`${S(s, i)} at (${p[0]}, ${p[1]}) is off the ${lot.w} × ${lot.d} m lot`, 'off-lot');
  }

  // ---- water under a slab; a bed laid over one
  const slabs = site.map((s, i) => ({ s, i, fp: ['patio', 'driveway', 'deck'].includes(s.type) ? footprintOf(s, i, spec.id || '') : null, top: (s.y ?? 0) + (s.type === 'deck' ? s.h || 0.12 : s.type === 'patio' ? 0.08 : 0.06) })).filter(x => x.fp);
  const sctx = createSiteContext(spec);
  for (const [i, s] of site.entries()) {
    if (!['pool', 'turtle-pool', 'rill', 'channel'].includes(s.type)) continue;
    const fp = footprintOf(s, i, spec.id || ''); if (!fp) continue;
    const rim = isShapedWater(s) ? (waterOutline(s, i, spec.id || '', sctx.groundAt) || { rim: 0 }).rim : (s.y ?? 0);
    for (const sl of slabs) {
      // decks and patios cut water they cover (site-build.ts); the old slab pool under a raised deck still disappears
      if (sl.top <= rim + 0.02 || sl.i === i) continue;
      const k = covered(fp, sl.fp);
      if (k > 0.5 && sl.s.type === 'deck' && (sl.s.h || 0.12) > 0.35) warn(`${S(s, i)}: ${Math.round(k * 100)} % of it is under the raised deck site[${sl.i}]`, 'buried-water');
    }
    for (const [j, t] of site.entries()) if (t.type === 'terrace' && typeof t.y === 'number' && t.y > rim + 0.05) { const k = covered(fp, sctx.terracePoly(t)); if (k > 0.5) warn(`${S(s, i)}: ${Math.round(k * 100)} % of it lies inside terrace site[${j}], ${(t.y - rim).toFixed(2)} m above its rim`, 'buried-water'); }
  }
  for (const [i, s] of site.entries()) {
    if (s.type !== 'bed' || !(Array.isArray(s.poly) || isP(s.at))) continue;
    const fp = Array.isArray(s.poly) ? s.poly : rectPoly(s.at, s.w || 2, s.d || 1, 0);
    if (polyArea(fp) < 0.05) continue;
    // (a bed set up on a slab on purpose — its `y` at the slab's top — is a planter; the ground under a stilted deck is open)
    for (const sl of slabs) {
      if (sl.s.type === 'deck' && (sl.s.h || 0.12) > 0.35) continue;
      const k = covered(fp, sl.fp);
      if (k > 0.5 && (s.y ?? 0) < sl.top - 0.02) { warn(`${S(s, i)}: ${Math.round(k * 100)} % of it is laid over the ${sl.s.type} site[${sl.i}]`, 'bed-on-slab'); break; }
    }
  }

  // ---- exterior stairs no one could climb
  for (const [i, s] of site.entries()) {
    if (s.type !== 'stair' || !isP(s.from) || !isP(s.to)) continue;
    const y0 = s.from[2] ?? sctx.groundAt(s.from[0], s.from[1]), y1 = s.to[2] ?? sctx.groundAt(s.to[0], s.to[1]);
    const H = Math.abs(y1 - y0), D = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]), n = Math.max(2, Math.ceil(H / 0.18)), split = s.landing !== false && n > 16;
    const tread = (split ? D - 1 : D) / n;
    if (tread < 0.25) warn(`${S(s, i)}: ${n} risers of ${(H / n).toFixed(2)} m on ${tread.toFixed(2)} m treads over ${D.toFixed(1)} m — too steep (lengthen it to ${(n * 0.28 + (split ? 1 : 0)).toFixed(1)} m)`, 'steep-stair');
  }
  return out;
};
export default check;
