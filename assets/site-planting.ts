// Planting — the landscape generator behind the `planting` site item (HOUSE-SPEC → Site (S4)), THREE-free so the
// Node harness (scripts/test-site.mts) measures exactly what the builder plants.
//
//   { type: 'planting', kind: 'foundation' | 'border' | 'walk' | 'meadow' | 'terrace' | 'grove',
//     along?: 'facade:S' | 'facade:S,E' | 'facade:all' | 'path:<site index or id>' | 'terrace:<index or id>' | [[x,z],…],
//     poly?, at?, r?, depth?, layers?: 1..3, mix?, density?, bloom?: ['#hex',…], side?: 'left'|'right'|'both',
//     smooth?, edge?, mulch?, seed? }
//
// A kind lays one or more BANDS — a base line and a depth, so a plant's place is (s along the base, t across it) —
// or an AREA (meadow, grove). A band follows its base exactly (a walk's beds meet the path edge with no lawn
// between them), its far edge wanders by a seeded wobble and rounds off at its ends, and it breaks wherever
// something else stands across it: a door, a path, a porch, a patio, a pool. In each bed the plants are placed back
// to front by Bridson Poisson-disk sampling, one pass per layer with the layer's own spacing and the earlier
// layers' plants as blockers — back 1.2–2.0 m, mid 0.6–1.0 m, groundcover about 0.3 m — then a groundcover pass
// fills what bare mulch is left. Which species grows where is a slow seeded drift along the band, so a bed is
// planted in sweeps, not confetti. `mix` names the palette of species per layer.
//
// Every plant is { sp, x, z, y, h, r, rot, tint, bloom, layer }: its species (assets/site.ts draws it), where it
// stands, its height and crown radius, a spin and a tint, and its flower colour. `y` follows the ground: a plant on
// a terrace stands on the terrace. Seeded mulberry32(fnv1a(`${spec.id}:site:${index}:planting`)), fixed attempt
// counts: a pure function of the spec.
import { mulberry32, fnv1a } from './materials.js';
import { MASKS, TRIS, MASK_N, MASK_REACH } from './site-species-masks.js';
import { perimeterEdges } from './house-geometry.js';
import {
  type P2, clamp, lerp, dist, inPoly, bbox, lineDist, polyArea, centroid, rectPoly, lengthOf, resample, smoothLine, smoothLoop,
  tensionOf, ribbon, lineNormals, wobble, poisson, type Blocker, segmentsOf, axisAligned, noisyLoop, turn, kidney, blob,
} from './site-geom.js';

// ---- species -----------------------------------------------------------------------------------------------------
// h: height range (m), r: crown radius range (m), draw: how assets/site.ts builds it (a shrub form, a flower kind, a tree
// species, a succulent), bloom: the flower palette when the planting pins none. What a plant covers seen from above is
// in assets/site-species-masks.ts (measured on the geometry assets/site.ts draws; scripts/test-site-species.mts fails
// when it has drifted).
export type Species = { h: [number, number]; r: [number, number]; draw: string; bloom?: number[] };
const BLOOM_PINK = [0xd8a7c4, 0xd595a6, 0xc98aa3], BLOOM_LILAC = [0xb9a7d6, 0xa18ac1], BLOOM_WHITE = [0xf1ede4, 0xebe6d8], BLOOM_BLUE = [0x9fb3d9, 0x8ea6d4];
export const SPECIES: Record<string, Species> = {
  // back layer, 1.2–2.0 m
  'hydrangea':    { h: [1.15, 1.6], r: [0.45, 0.65], draw: 'shrub:hydrangea', bloom: [...BLOOM_BLUE, ...BLOOM_WHITE, ...BLOOM_PINK] },
  'shrub':        { h: [1.1, 1.7], r: [0.55, 0.8], draw: 'shrub:mound' },
  'spreading':    { h: [0.9, 1.3], r: [0.6, 0.85], draw: 'shrub:spreading' },
  'topiary-cone': { h: [1.3, 2.0], r: [0.32, 0.45], draw: 'shrub:topiary-cone' },
  'columnar':     { h: [1.6, 2.3], r: [0.28, 0.38], draw: 'shrub:columnar' },
  'yucca':        { h: [1.2, 1.8], r: [0.45, 0.6], draw: 'shrub:yucca' },
  'spike':        { h: [1.2, 1.7], r: [0.18, 0.26], draw: 'flower:spike', bloom: [...BLOOM_LILAC, ...BLOOM_BLUE, 0xd8a7c4, 0xf1ede4] },
  'grass-tall':   { h: [1.3, 1.9], r: [0.38, 0.52], draw: 'shrub:grass' },
  'rosemary':     { h: [1.15, 1.5], r: [0.4, 0.55], draw: 'shrub:rosemary' },
  'broadleaf':    { h: [1.1, 1.7], r: [0.5, 0.7], draw: 'shrub:broadleaf' },
  // mid layer, 0.6–1.0 m
  'lavender':     { h: [0.5, 0.75], r: [0.3, 0.42], draw: 'flower:lavender', bloom: [0x8f7cb8, 0x9b88c0, 0x8577b0] },
  'topiary-ball': { h: [0.6, 1.0], r: [0.34, 0.5], draw: 'shrub:topiary-ball' },
  'boxwood':      { h: [0.55, 0.85], r: [0.35, 0.5], draw: 'shrub:boxwood' },
  'grass':        { h: [0.7, 1.1], r: [0.3, 0.45], draw: 'shrub:grass' },
  'agave':        { h: [0.6, 1.0], r: [0.45, 0.7], draw: 'shrub:agave' },
  'rose':         { h: [0.65, 1.0], r: [0.35, 0.45], draw: 'flower:rose', bloom: [0xc46b7b, 0xd8a7c4, 0xf1ede4, 0xb45a4b] },
  'allium':       { h: [0.7, 1.0], r: [0.14, 0.2], draw: 'flower:allium', bloom: [0xa18ac1, 0x9b88c0, 0xf1ede4] },
  'fern':         { h: [0.5, 0.9], r: [0.35, 0.5], draw: 'shrub:fern' },
  'hosta':        { h: [0.35, 0.5], r: [0.3, 0.45], draw: 'shrub:hosta' },
  'cactus':       { h: [1.1, 1.6], r: [0.25, 0.4], draw: 'shrub:cactus' },
  // front layer, about 0.3 m
  'daisy':        { h: [0.3, 0.45], r: [0.2, 0.28], draw: 'flower:daisy', bloom: [0xefeadb, 0xe8dcc0, 0xd6bf66] },
  'tulip':        { h: [0.35, 0.5], r: [0.15, 0.2], draw: 'flower:tulip', bloom: [0xc46b7b, 0xd6a04b, 0xb45a4b, 0xd595a6] },
  'bloom':        { h: [0.3, 0.45], r: [0.2, 0.28], draw: 'flower:bloom', bloom: [0xc46b7b, 0xd6a04b, 0xa18ac1, 0xebe6d8, 0xd595a6] },
  'groundcover':  { h: [0.15, 0.3], r: [0.25, 0.36], draw: 'shrub:groundcover' },
  'grass-low':    { h: [0.3, 0.5], r: [0.2, 0.3], draw: 'shrub:grass' },
  'sedum':        { h: [0.12, 0.22], r: [0.2, 0.3], draw: 'shrub:sedum', bloom: [0xc98aa3, 0xd6bf66] },
  'succulent':    { h: [0.15, 0.3], r: [0.18, 0.28], draw: 'shrub:succulent' },
  'silver':       { h: [0.2, 0.35], r: [0.25, 0.35], draw: 'shrub:silver' },
  'box-edging':   { h: [0.25, 0.4], r: [0.2, 0.26], draw: 'shrub:boxwood' },
  'rock':         { h: [0.2, 0.45], r: [0.2, 0.4], draw: 'rock' },
  // trees (a grove, a specimen in a border)
  'olive':        { h: [3.0, 4.5], r: [1.4, 2.0], draw: 'tree:olive' },
  'maple':        { h: [3.5, 5.0], r: [1.6, 2.2], draw: 'tree:layered' },
  'birch':        { h: [6.0, 8.0], r: [1.4, 2.0], draw: 'tree:birch' },
  'cherry':       { h: [4.0, 5.5], r: [2.0, 2.6], draw: 'tree:cherry' },
  'fan-palm':     { h: [3.5, 6.0], r: [1.2, 1.6], draw: 'tree:fan-palm' },
  'cypress':      { h: [4.0, 6.0], r: [0.5, 0.7], draw: 'tree:columnar' },
  'broad':        { h: [5.0, 7.0], r: [2.2, 3.0], draw: 'tree:broad' },
  'oval':         { h: [5.0, 7.0], r: [1.6, 2.2], draw: 'tree:oval' },
  'conical':      { h: [5.0, 8.0], r: [1.4, 2.0], draw: 'tree:conical' },
  'willow':       { h: [6.0, 8.0], r: [3.0, 3.8], draw: 'tree:willow' },
};

// ---- mixes: species per layer (weights), the back → front palette of a planting style --------------------------
type Layer = Array<[string, number]>;
// fill: what a bare gap is planted with (weights: a bed's gaps are not all one groundcover); bare: the share of a bed the
// planting leaves showing mulch at density 1 (a formal bed shows gravel between its clipped shapes, a desert bed sand)
export type Mix = { back: Layer; mid: Layer; front: Layer; fill: Layer; bare: number; trees: Layer; density: number; mulch: number | null; bloom?: number[]; formal?: boolean };
export const MIXES: Record<string, Mix> = {
  cottage:       { back: [['hydrangea', 3], ['spike', 2], ['shrub', 2]], mid: [['lavender', 2], ['rose', 2], ['allium', 1], ['grass', 1]],
                   front: [['daisy', 2], ['bloom', 2], ['tulip', 1], ['groundcover', 1]], fill: [['groundcover', 2], ['daisy', 2], ['bloom', 2], ['tulip', 1]], bare: 0.05, trees: [['cherry', 1], ['maple', 1]], density: 1, mulch: 0x42372e },
  modern:        { back: [['grass-tall', 3], ['topiary-cone', 1], ['columnar', 1]], mid: [['grass', 2], ['topiary-ball', 2], ['boxwood', 1]],
                   front: [['grass-low', 2], ['groundcover', 2], ['sedum', 1]], fill: [['groundcover', 2], ['sedum', 2], ['silver', 2], ['box-edging', 1]], bare: 0.05, trees: [['birch', 2], ['maple', 1]], density: 1, mulch: 0x2f2b28, bloom: [0xefeadb] },
  mediterranean: { back: [['rosemary', 2], ['columnar', 1], ['topiary-cone', 1]], mid: [['lavender', 4], ['agave', 1], ['grass', 1]],
                   front: [['silver', 2], ['sedum', 2], ['groundcover', 1]], fill: [['silver', 2], ['lavender', 2], ['sedum', 2], ['groundcover', 1]], bare: 0.05, trees: [['olive', 3], ['cypress', 1]], density: 1, mulch: 0xb9ad98 },
  desert:        { back: [['yucca', 2], ['cactus', 1], ['grass-tall', 1]], mid: [['agave', 3], ['grass', 1]],
                   front: [['succulent', 1], ['rock', 1], ['sedum', 1]], fill: [['succulent', 1], ['sedum', 2], ['rock', 1]], bare: 0.35, trees: [['olive', 1], ['fan-palm', 1]], density: 1, mulch: 0xc2b39a, bloom: [0xd6a04b, 0xc46b4b] },
  woodland:      { back: [['hydrangea', 1], ['shrub', 2], ['broadleaf', 0.5]], mid: [['fern', 4], ['spreading', 1]],
                   front: [['groundcover', 2], ['hosta', 2], ['daisy', 1]], fill: [['groundcover', 2], ['hosta', 2], ['daisy', 1], ['fern', 1]], bare: 0.05, trees: [['birch', 2], ['maple', 2], ['conical', 1]], density: 1, mulch: 0x3a3028, bloom: [...BLOOM_WHITE, ...BLOOM_BLUE] },
  tropical:      { back: [['broadleaf', 3], ['yucca', 1], ['grass-tall', 1]], mid: [['fern', 2], ['agave', 1], ['grass', 1]],
                   front: [['groundcover', 2], ['bloom', 1], ['hosta', 1]], fill: [['groundcover', 2], ['bloom', 2], ['fern', 1], ['hosta', 1]], bare: 0.05, trees: [['fan-palm', 3], ['broad', 1]], density: 1, mulch: 0x3a3028, bloom: [0xd65a4b, 0xe0a13c, 0xc44b7b] },
  formal:        { back: [['topiary-cone', 1]], mid: [['topiary-ball', 1]], front: [['box-edging', 1]], fill: [['groundcover', 1]], bare: 0.3, trees: [['cypress', 1]], density: 1, mulch: 0x2f2b28, formal: true },
  meadow:        { back: [['grass-tall', 2], ['spike', 1]], mid: [['grass', 3], ['allium', 1], ['daisy', 1]], front: [['grass-low', 2], ['daisy', 2], ['bloom', 1]],
                   fill: [['grass-low', 1]], bare: 0.1, trees: [['birch', 1], ['oval', 1]], density: 1, mulch: null, bloom: [0xefeadb, 0xd6bf66, 0xa18ac1, 0xc46b7b] },
};
export const PLANTING_KINDS = ['foundation', 'border', 'walk', 'meadow', 'terrace', 'grove'];
// a sensible mix per kind when none is named …
const KIND_MIX = { foundation: 'cottage', border: 'cottage', walk: 'cottage', meadow: 'meadow', terrace: 'mediterranean', grove: 'woodland' };
// … and, when the lot says where it is (`lot.context`, `lot.ground`, `lot.water`), the mix of that place: a desert lot
// is planted as a desert whatever the planting's kind (a meadow is a meadow anywhere)
const CONTEXT_MIX: Record<string, string> = { desert: 'desert', forest: 'woodland', city: 'modern', hillside: 'mediterranean', rural: 'cottage' };
export function mixNameOf(s: any, lot: any = null): string {
  if (typeof s.mix === 'string' && MIXES[s.mix]) return s.mix;
  if (s.mix && typeof s.mix === 'object') return 'custom';
  const kind = PLANTING_KINDS.includes(s.kind) ? s.kind : 'border';
  if (kind === 'meadow') return 'meadow';
  const L = lot || {}, water = typeof L.water === 'string' ? { kind: L.water } : L.water || null;
  let place: string | null = null;
  if (L.context && CONTEXT_MIX[L.context]) place = CONTEXT_MIX[L.context];
  else if (L.context === 'waterfront' || (!L.context && water)) place = water && water.kind === 'sea' ? 'tropical' : water && water.kind === 'canal' ? 'modern' : 'woodland';
  else if (!L.context && L.ground === 'desert') place = 'desert';
  else if (!L.context && L.ground === 'forest') place = 'woodland';
  return place || KIND_MIX[kind];
}
const KIND_DEPTH = { foundation: 1.8, border: 1.7, walk: 1.0, terrace: 1.1 };

export type Plant = { sp: string; x: number; z: number; y: number; h: number; r: number; rot: number; tint: number; bloom: number | null; layer: string };
export type Bed = { poly: P2[]; y: number; soil: boolean; mulch: number | null; wall: boolean[] };
export type PlantingPlan = { mix: string; beds: Bed[]; plants: Plant[]; trees: Plant[]; floor: { poly: P2[]; y: number; kind: string } | null; bareTarget: number; own: number[] };

// ---- water in a shape (site-build.ts builds it, the lawn and the slabs round it cut its outline) -------------------
// A pool with a `shape`, `coping` or `poly`, a formal `basin` (pool shape), a `rill` / `channel`: its outline in plan,
// its rim (its `y`, else the ground it is dug into) and its depth. A pool with none of those is the page's old slab
// pool and is not described here.
export const WATER_SHAPES = ['rect', 'lap', 'kidney', 'free', 'round', 'poly', 'basin'];
export type Water = { poly: P2[]; rim: number; depth: number; dark: boolean; shape: string };
export const isShapedWater = (s: any) => (s.type === 'pool' && (s.shape !== undefined || s.coping !== undefined || Array.isArray(s.poly))) || s.type === 'rill' || s.type === 'channel';
export function waterOutline(s: any, index: number, seed: string, groundAt: (x: number, z: number) => number = () => 0): Water | null {
  if (!isShapedWater(s)) return null;
  const at: P2 = Array.isArray(s.at) ? [s.at[0], s.at[1]] : Array.isArray(s.poly) && s.poly.length ? centroid(s.poly) : [0, 0], rot = s.rot || 0;
  const rng = mulberry32(fnv1a(`${seed}:site:${index}:${s.type}:outline`));
  let poly: P2[], depth = 1.4, dark = false, shape = s.type === 'pool' ? (WATER_SHAPES.includes(s.shape) ? s.shape : Array.isArray(s.poly) ? 'poly' : 'rect') : s.type;
  if (s.type === 'rill' || s.type === 'channel') { poly = rectPoly(at, s.w || (s.type === 'rill' ? 0.45 : 1.2), s.d || 4, rot); depth = s.type === 'rill' ? 0.25 : 0.6; dark = true; }
  else if (shape === 'lap') { poly = rectPoly(at, s.w || 12, s.d || 2.5, rot); depth = 1.3; }
  else if (shape === 'kidney') poly = kidney(at, s.w || 7, s.d || 4, rot);
  else if (shape === 'free') poly = blob(rng, at, s.w || 7, s.d || 4, rot, 0.2);
  else if (shape === 'round') { const w = s.w || 4, d = s.d || w; poly = Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2; return [at[0] + Math.cos(a) * w / 2, at[1] + Math.sin(a) * d / 2] as P2; }); depth = 1.2; }
  else if (shape === 'poly' || (shape === 'basin' && Array.isArray(s.poly))) { const t = tensionOf(s.smooth); poly = t === null ? (s.poly as P2[]).map(p => [p[0], p[1]] as P2) : smoothLoop(s.poly, t, 0.25); }
  else poly = rectPoly(at, s.w || 6, s.d || (shape === 'basin' ? 3 : 4), rot);
  if (shape === 'basin') { depth = s.depth ?? 0.45; dark = true; }
  if (typeof s.depth === 'number') depth = s.depth;
  const c = centroid(poly);
  return { poly, rim: s.y ?? groundAt(c[0], c[1]), depth, dark, shape };
}

// ---- the site context: what every generator needs to know about the lot ------------------------------------------
const DEFAULT_WD = {
  patio: [4, 3], driveway: [4, 3], deck: [4, 3], porch: [6, 2.5], turf: [6, 4], pool: [6, 4], 'turtle-pool': [8, 6], pond: [4, 3], greenhouse: [3.6, 2.4],
  pergola: [4, 3], cabana: [4, 3], 'garden-beds': [3, 2], bench: [1.8, 0.5], car: [4.6, 2], loungers: [2, 2], bridge: [1.2, 2.6], rill: [0.5, 4], basin: [6, 3],
};
const ROUND = { hottub: 1.1, gazebo: 2.2, firepit: 2.4 };
export type SiteContext = {
  seed: string; spec: any; keepOut: Array<{ x: number; z: number; w: number; d: number }>;
  /** the lot's half-extents: nothing planted stands past its line (the sidewalk starts there) */
  lot: { hw: number; hd: number };
  /** metres from (x, z) to the nearest lot line (negative outside) */
  lotRoom: (x: number, z: number) => number;
  /** the elevation of the ground at a plan point: the highest terrace under it, else 0 */
  groundAt: (x: number, z: number) => number;
  /** a site path's centre line as built (smoothed and resampled when `smooth`) */
  pathLine: (s: any) => P2[];
  /** a terrace's outline as built */
  terracePoly: (s: any) => P2[];
  /** the plan footprint of every hard site item (paths, patios, decks, pools, porches, steps …), by site index */
  hard: Array<{ i: number; type: string; poly: P2[] }>;
  /** metres from the ground storey's footprint (0 inside it) */
  houseGap: (x: number, z: number) => number;
  lookup: (ref: string, type: string) => { s: any; i: number } | null;
};
const rectGap = (x: number, z: number, b: any) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.z - z, 0, z - (b.z + b.d)));

export function createSiteContext(spec: any): SiteContext {
  const site: any[] = spec.site || [];
  const keepOut = (spec.levels || []).filter(l => (l.y || 0) <= 0.001 && Array.isArray(l.footprint)).flatMap(l => l.footprint);
  const houseGap = (x: number, z: number) => keepOut.reduce((m, b) => Math.min(m, rectGap(x, z, b)), Infinity);
  const lot = { hw: (spec.lot && spec.lot.w > 0 ? spec.lot.w : 30) / 2, hd: (spec.lot && spec.lot.d > 0 ? spec.lot.d : 24) / 2 };
  const lotRoom = (x: number, z: number) => Math.min(lot.hw - Math.abs(x), lot.hd - Math.abs(z));
  const lineCache = new WeakMap<any, P2[]>(), polyCache = new WeakMap<any, P2[]>();
  const pathLine = (s: any): P2[] => {
    if (lineCache.has(s)) return lineCache.get(s)!;
    const raw = (s.path || []) as P2[], t = tensionOf(s.smooth);
    const out = t === null ? raw.map(p => [p[0], p[1]] as P2) : smoothLine(raw, t, 0.25);
    lineCache.set(s, out); return out;
  };
  const terracePoly = (s: any): P2[] => {
    if (polyCache.has(s)) return polyCache.get(s)!;
    const raw = (s.poly || (Array.isArray(s.at) ? rectPoly(s.at, s.w || 6, s.d || 4, s.rot || 0) : [])) as P2[], t = tensionOf(s.smooth);
    const out = t === null ? raw.map(p => [p[0], p[1]] as P2) : smoothLoop(raw, t, 0.3);
    polyCache.set(s, out); return out;
  };
  const terraces = site.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'terrace' && typeof s.y === 'number').map(({ s, i }) => ({ i, y: s.y, poly: terracePoly(s) })).filter(t => t.poly.length >= 3);
  const groundAt = (x: number, z: number) => terraces.reduce((y, t) => (t.y > y && inPoly(x, z, t.poly) ? t.y : y), 0);
  const hard: SiteContext['hard'] = [];
  site.forEach((s, i) => {
    if (s.type === 'path' && Array.isArray(s.path) && s.path.length >= 2) { hard.push({ i, type: 'path', poly: ribbon(pathLine(s), s.w || 1.0) }); return; }
    if (s.type === 'stair' && Array.isArray(s.from) && Array.isArray(s.to)) { hard.push({ i, type: 'stair', poly: ribbon([[s.from[0], s.from[1]], [s.to[0], s.to[1]]], (s.w || 1.2) + 0.2) }); return; }
    if (isShapedWater(s)) { const w = waterOutline(s, i, spec.id || 'house'); if (w) hard.push({ i, type: s.type, poly: w.poly }); return; }
    if ((s.type === 'patio' || s.type === 'driveway' || s.type === 'deck') && Array.isArray(s.poly) && s.poly.length >= 3) { hard.push({ i, type: s.type, poly: s.poly }); return; }
    if ((s.type === 'fence' || s.type === 'wall-low') && (Array.isArray(s.path) || (Array.isArray(s.from) && Array.isArray(s.to)))) { const line = Array.isArray(s.path) ? s.path : [s.from, s.to]; hard.push({ i, type: s.type, poly: ribbon(line, s.type === 'fence' ? 0.25 : 0.45) }); return; }
    if (!Array.isArray(s.at)) return;
    if (s.type === 'steps') {
      // a flight rises toward −z at rot 0 from its first tread at `at` (site-build.ts steps): its run, turned
      const n = s.h ? Math.max(1, Math.round(s.h / 0.17)) : s.n || 3, run = s.d || n * 0.32, [c] = turn([[0, -(run - 0.32) / 2]], s.rot || 0);
      hard.push({ i, type: 'steps', poly: rectPoly([s.at[0] + c[0], s.at[1] + c[1]], (s.w || 1.6) + 0.2, run + 0.3, s.rot || 0) }); return;
    }
    if (ROUND[s.type] !== undefined) { const r = s.r || ROUND[s.type]; hard.push({ i, type: s.type, poly: rectPoly(s.at, 2 * r, 2 * r, 0) }); return; }
    const wd = DEFAULT_WD[s.type];
    if (wd) hard.push({ i, type: s.type, poly: rectPoly(s.at, s.w || wd[0], s.d || wd[1], s.rot || 0) });
  });
  const lookup = (ref: string, type: string) => {
    if (ref === undefined || ref === null) return null;
    const n = Number(ref);
    if (Number.isInteger(n) && site[n] && site[n].type === type) return { s: site[n], i: n };
    const i = site.findIndex(s => s.type === type && s.id === ref);
    return i >= 0 ? { s: site[i], i } : null;
  };
  return { seed: spec.id || 'house', spec, keepOut, lot, lotRoom, groundAt, pathLine, terracePoly, hard, houseGap, lookup };
}

// ---- bands --------------------------------------------------------------------------------------------------------
// A band: a base line (points every ~0.25 m), a unit normal per point pointing INTO the band, and a depth per point.
type Band = { base: P2[]; N: P2[]; D: number[]; s: number[]; backAtBase: boolean; wall: boolean; edgeBuilt?: boolean };
const WALL_OUT = 0.12;
const at = (b: Band, s: number, t: number): P2 => {
  // the point t across the band at arc length s
  let i = 0; while (i < b.s.length - 2 && b.s[i + 1] < s) i++;
  const k = clamp((s - b.s[i]) / ((b.s[i + 1] - b.s[i]) || 1e-9));
  const x = lerp(b.base[i][0], b.base[i + 1][0], k), z = lerp(b.base[i][1], b.base[i + 1][1], k);
  const nx = lerp(b.N[i][0], b.N[i + 1][0], k), nz = lerp(b.N[i][1], b.N[i + 1][1], k);
  return [x + nx * t, z + nz * t];
};
const depthAt = (b: Band, s: number) => { let i = 0; while (i < b.s.length - 2 && b.s[i + 1] < s) i++; const k = clamp((s - b.s[i]) / ((b.s[i + 1] - b.s[i]) || 1e-9)); return lerp(b.D[i], b.D[i + 1], k); };
function makeBand(base: P2[], into: P2[], depth: (s: number) => number, backAtBase: boolean, wall = false): Band {
  const s = [0]; for (let i = 1; i < base.length; i++) s.push(s[i - 1] + dist(base[i - 1], base[i]));
  return { base, N: into, D: s.map(depth), s, backAtBase, wall };
}
/** split a band into beds wherever it is blocked; each run becomes its own band with rounded ends. Where only its far
 *  side is blocked (a deck's corner, a pool's rim a metre off the wall) the bed keeps its columns and gets shallower
 *  there — its edge ramps away from the obstacle at 40°, rather than the whole bed stopping short of it */
function runsOf(b: Band, blocked: (p: P2) => boolean, minRun = 0.8): Band[] {
  const lim = b.s.map((s, i) => {
    const D = b.D[i];
    if (blocked(at(b, s, 0.12))) return 0;
    for (let t = 0.22; t <= D + 1e-9; t += 0.1) if (blocked(at(b, s, t))) return Math.max(0, t - 0.15);
    return blocked(at(b, s, D)) ? Math.max(0, D - 0.15) : D;
  });
  // the ramp: no column is deeper than a neighbour's limit plus 0.8 m for each metre between them (a column with no
  // room at all is a break between beds, not a limit)
  const D2 = lim.map((l, i) => { let m = l; if (l > 0) for (let j = Math.max(0, i - 8); j <= Math.min(lim.length - 1, i + 8); j++) if (lim[j] > 0) m = Math.min(m, lim[j] + 0.8 * Math.abs(b.s[j] - b.s[i])); return m; });
  const ok = D2.map((d, i) => d >= Math.min(0.45, b.D[i] * 0.85));
  const out: Band[] = [];
  let i = 0;
  while (i < ok.length) {
    if (!ok[i]) { i++; continue; }
    let j = i; while (j + 1 < ok.length && ok[j + 1]) j++;
    const L = b.s[j] - b.s[i];
    if (L >= minRun) {
      const idx = Array.from({ length: j - i + 1 }, (_, k) => i + k), s0 = b.s[i];
      // rounded ends: the depth eases in over the first and last 0.7 m (a quarter-ellipse profile)
      const round = (s: number, D: number) => { const e = Math.min(s - s0, b.s[j] - s), k = clamp(e / Math.min(0.7, L / 2)); return D * Math.sqrt(1 - (1 - k) * (1 - k)) * 0.85 + D * 0.15 * k; };
      out.push({ base: idx.map(k => b.base[k]), N: idx.map(k => b.N[k]), D: idx.map(k => round(b.s[k], D2[k])), s: idx.map(k => b.s[k] - s0), backAtBase: b.backAtBase, wall: b.wall, edgeBuilt: b.edgeBuilt });
    }
    i = j + 1;
  }
  return out;
}
const bandPoly = (b: Band): P2[] => [...b.base.map(p => [p[0], p[1]] as P2), ...b.base.map((_, i) => at(b, b.s[i], b.D[i])).reverse()];

// ---- planting one band back to front --------------------------------------------------------------------------------
/** a drift field's value (a sum of sines: bell-shaped over −1…1) as a uniform 0…1, so every species of a list gets its
 *  share of the sweeps and not just the ones in the middle of the cumulative weights */
const drifted = (x: number, jitter = 0) => clamp(1 / (1 + Math.exp(-3.1 * x)) + jitter);
function pickWeighted(list: Layer, v: number): string {
  const tot = list.reduce((a, [, w]) => a + w, 0); let acc = 0;
  for (const [sp, w] of list) { acc += w / tot; if (v <= acc) return sp; }
  return list[list.length - 1][0];
}
const spacingOf = (list: Layer, dens: number) => { const tot = list.reduce((a, [, w]) => a + w, 0); const r = list.reduce((a, [sp, w]) => a + (SPECIES[sp].r[0] + SPECIES[sp].r[1]) / 2 * w, 0) / tot; return r * 1.45 / Math.sqrt(dens); };

// ---- what a plant hides of the mulch under it ------------------------------------------------------------------------
// Its top-down silhouette (assets/site-species-masks.ts: measured on the geometry that is drawn), scaled to the plant's
// crown radius. The fill below and the bare-mulch metric both read this — not a disc of the crown's size: a grass tuft
// or a rosemary hides 5–11 % of it, a mound 74 %.
const maskCache = new Map<string, Uint8Array | null>();
function maskOf(sp: string): Uint8Array | null {
  if (maskCache.has(sp)) return maskCache.get(sp)!;
  const hex = MASKS[sp]; let m: Uint8Array | null = null;
  if (hex) { m = new Uint8Array(MASK_N * MASK_N); for (let i = 0; i < m.length; i++) m[i] = (parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1; }
  maskCache.set(sp, m); return m;
}
const coverCache = new Map<string, number>();
/** the share of its crown disc a species' silhouette fills (a tree, which has no mask: 0.8) */
export function coverOf(sp: string): number {
  if (coverCache.has(sp)) return coverCache.get(sp)!;
  const m = maskOf(sp); let v = 0.8;
  if (m) { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; const c = 2 * MASK_REACH / MASK_N; v = n * c * c / Math.PI; }
  coverCache.set(sp, v); return v;
}
/** call `hit(x, z)` for every point of a `cell`-spaced grid under the plant at (px, pz) with crown radius r */
function eachHidden(sp: string, px: number, pz: number, r: number, cell: number, gx0: number, gz0: number, i1: number, j1: number, hit: (i: number, j: number) => void) {
  const m = maskOf(sp), reach = MASK_REACH * r, mc = 2 * MASK_REACH / MASK_N;
  const i0 = Math.max(0, Math.floor((px - reach - gx0) / cell)), ie = Math.min(i1, Math.floor((px + reach - gx0) / cell)), j0 = Math.max(0, Math.floor((pz - reach - gz0) / cell)), je = Math.min(j1, Math.floor((pz + reach - gz0) / cell));
  for (let i = i0; i <= ie; i++) for (let j = j0; j <= je; j++) {
    const dx = (gx0 + (i + 0.5) * cell - px) / r, dz = (gz0 + (j + 0.5) * cell - pz) / r;
    if (m) { const mx = Math.floor((dx + MASK_REACH) / mc), mz = Math.floor((dz + MASK_REACH) / mc); if (mx >= 0 && mx < MASK_N && mz >= 0 && mz < MASK_N && m[mz * MASK_N + mx]) hit(i, j); }
    else if (dx * dx + dz * dz <= 0.64) hit(i, j);
  }
}

type Ctx = { ctx: SiteContext; rng: () => number; orng: () => number; mix: Mix; mixName: string; bloom: number[] | null; dens: number; layers: number; plants: Plant[]; blockedWorld: (p: P2) => boolean; bareTarget: number };
function plant(C: Ctx, sp: string, x: number, z: number, layer: string, fitWall: boolean, bloomOf: (sp: string) => number | null): Plant | null {
  const S = SPECIES[sp] || SPECIES.shrub, r0 = lerp(S.r[0], S.r[1], C.rng()), h0 = lerp(S.h[0], S.h[1], C.rng());
  // shrink a plant to the room it has before a ground-storey wall (it must never reach into the rooms) and before the
  // lot line (it never stands on the pavement past it)
  const room = Math.min(fitWall ? C.ctx.houseGap(x, z) - WALL_OUT : Infinity, C.ctx.lotRoom(x, z) - 0.03);
  const r = Math.min(r0, room), k = r / r0;
  if (r < 0.1) return null;
  const p: Plant = { sp, x, z, y: C.ctx.groundAt(x, z), h: h0 * (k < 1 ? Math.max(0.85, Math.sqrt(k)) : 1), r, rot: C.rng() * Math.PI * 2, tint: 0.9 + C.rng() * 0.2, bloom: bloomOf(sp), layer };
  C.plants.push(p);
  return p;
}
function plantBand(C: Ctx, b: Band) {
  const L = b.s[b.s.length - 1], Dmax = Math.max(...b.D), rng = C.rng, mix = C.mix;
  // (against a wall the back row stands a crown off it — a shrub is planted clear of the foundation, not in it — so the
  // layers divide the bed from there out)
  const t0 = b.wall && b.backAtBase ? 0.45 : 0;
  const f = (s: number, t: number) => { const D = depthAt(b, s) || 1e-6, u = clamp((t - t0) / Math.max(1e-6, D - t0), 0, 1); return b.backAtBase ? 1 - u : u; };   // 1 at the back edge
  const nz = wobble(rng, 4.5, 2);   // the layer boundaries wander, so the layers interleave
  const drift = { back: wobble(rng, 5, 2), mid: wobble(rng, 3.8, 2), front: wobble(rng, 3, 2) };
  const tints = new Map<string, number>();
  const bloomOf = (sp: string) => {
    const S = SPECIES[sp]; if (!S || !S.bloom) return null;
    if (!tints.has(sp)) { const pal = C.bloom || mix.bloom || S.bloom; tints.set(sp, pal[Math.floor(rng() * pal.length)]); }
    return tints.get(sp)!;
  };
  const toWorld = (p: P2) => at(b, p[0], p[1]);
  const box = { x0: 0, z0: 0, x1: L, z1: Dmax }, startN = C.plants.length;
  const bands = C.layers >= 3 ? (b.wall ? { back: [0.55, 1.01], mid: [0.25, 0.55], front: [-0.01, 0.25] } : { back: [0.62, 1.01], mid: [0.3, 0.62], front: [-0.01, 0.3] })
    : C.layers === 2 ? { back: [0.5, 1.01], front: [-0.01, 0.5] } : { mid: [-0.01, 1.01] };
  const placed: Array<Blocker & { q: Plant }> = [];   // (band coordinates)
  const note = (s: number, t: number, q: Plant) => { placed.push({ x: s, z: t, r: q.r, q }); };
  const margin = 0.08;
  if (mix.formal) {
    // formal: rows along the band at a fixed pitch — clipped cones at the back, balls in the middle, an edging in front
    const rows: Array<[string, string, number, number]> = C.layers >= 3 ? [['back', mix.back[0][0], 0.78, 1.25], ['mid', mix.mid[0][0], 0.46, 0.85], ['front', mix.front[0][0], 0.14, 0.42]]
      : C.layers === 2 ? [['back', mix.back[0][0], 0.7, 1.1], ['front', mix.front[0][0], 0.2, 0.42]] : [['mid', mix.mid[0][0], 0.5, 0.8]];
    for (const [layer, sp, frac, pitch] of rows) {
      const n = Math.max(1, Math.floor((L - 0.3) / pitch)), off = (L - (n - 1) * pitch) / 2;
      for (let q = 0; q < n; q++) {
        const s = off + q * pitch, D = depthAt(b, s), t = b.backAtBase ? (1 - frac) * D : frac * D;
        if (D < 0.35) continue;
        const [x, z] = toWorld([s, t]); if (C.blockedWorld([x, z])) continue;
        const p = plant(C, sp, x, z, layer, true, bloomOf);
        if (p) note(s, t, p);
      }
    }
  } else {
    for (const layer of ['back', 'mid', 'front']) {
      const range = bands[layer]; if (!range) continue;
      const list: Layer = mix[layer], sp0 = spacingOf(list, C.dens);
      // against a wall the back row stands a crown off it (a shrub is planted clear of the foundation, not in it)
      const tMin = b.wall && b.backAtBase && layer === 'back' ? t0 : margin;
      const inside = (s: number, t: number) => {
        const D = depthAt(b, s); if (t < tMin || t > D - margin || D < 0.25) return false;
        const q = f(s, t) + nz(s) * 0.1; return q >= range[0] && q < range[1] && !C.blockedWorld(toWorld([s, t]));
      };
      // a plant of this layer may stand partly under the crown of a taller one behind it: it keeps the larger of the
      // two crowns' radii off it, not the full spacing
      const rNew = sp0 / 1.45;
      const pts = poisson(rng, box, sp0, inside, { blockers: placed.map(p => ({ x: p.x, z: p.z, r: Math.max(p.r, rNew) * 0.95 })), seeds: Math.max(2, Math.round(L / 3)), grid: sp0 * 1.2 });
      for (const p of pts) {
        const v = drifted(drift[layer](p[0]), (rng() - 0.5) * 0.2), sp = pickWeighted(list, v), [x, z] = toWorld(p);
        const q = plant(C, sp, x, z, layer, true, bloomOf);
        if (q) note(p[0], p[1], q);
      }
    }
  }
  // ---- layers that are really there ------------------------------------------------------------------------------
  // a bed is layered when its back row is a row and its middle one another — not when one token plant of each height
  // stands in it. A bed long enough holds at least one plant over 1.1 m for every 1.5 m of its run and one to 1.1 m for
  // every 1.2 m (a short run can starve a layer, and a plant shrunk before a wall can drop out of its class): the
  // shortfall is planted where the bed has most room, of the species its layer's list names.
  const CLASSES: Array<[string, number, number, number]> = [['back', 1.12, 9, 1.5], ['mid', 0.46, 1.1, 1.2]];
  if (!mix.formal && L >= 1.2 && C.layers >= 3) for (const [layer, lo, hi, every] of CLASSES) {
    const range = bands[layer]; if (!range) continue;
    const want = Math.max(1, Math.floor(L / every)), have = () => C.plants.filter((p, k) => k >= startN && p.h >= lo && p.h <= hi).length;
    const all: string[] = mix[layer].map(([k]) => k).filter(k => { const m = (SPECIES[k].h[0] + SPECIES[k].h[1]) / 2; return m >= lo * 0.9 && m <= hi; });
    const list: Layer = all.length ? mix[layer].filter(([k]) => all.includes(k)) : mix[layer];
    for (let guard = 0; have() < want && guard < want + 3; guard++) {
      let best = null;
      for (let s2 = 0.3; s2 < L - 0.3; s2 += 0.2) {
        const D = depthAt(b, s2); if (D < 0.4) continue;
        const fMid = (range[0] + Math.min(1, range[1])) / 2, t = b.backAtBase ? t0 + (1 - fMid) * (D - t0) : fMid * D, p = toWorld([s2, t]);
        if (C.blockedWorld(p)) continue;
        const room = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - s2, q.z - t) - q.r), Infinity);
        if (!best || room > best.room) best = { s: s2, t, p, room };
      }
      if (!best) break;
      const sp = pickWeighted(list, drifted(drift[layer](best.s), (rng() - 0.5) * 0.2)), q = plant(C, sp, best.p[0], best.p[1], layer, true, bloomOf);
      if (!q) break;
      q.h = Math.min(hi, Math.max(lo, q.h)); note(best.s, best.t, q);
    }
  }
}
// ---- fill: what still shows mulch is planted with the mix's fill palette, until the bed is as bare as it should be ------
// The bare share is measured as it is DRAWN — each plant hides its silhouette seen from above (the masks), not the disc of
// its crown (a grass tuft or a rosemary hides 5–11 % of it) — on a 0.1 m grid over the bed's own outline, in the plan's
// own frame (not the band's: a curved bed is not the rectangle it was laid out in). A random bare cell (the best of a few:
// the one with the most bare round it, so a plant fills a gap and does not sit at its edge) is planted, in sweeps of one
// species along the bed, until the bare share is at the mix's target (`bare`, thinned by `density`: at 0.3 a bed is a third
// planted). Crowns overlap freely here, as a groundcover's do. What the metric leaves out is left out here: the drip strip
// along a wall, 0.16 m along the lot line, 0.15 m round any other item.
function fillBed(C: Ctx, bed: Bed, self: number, own: number[], wave: (u: number) => number) {
  const { ctx, rng, mix } = C, cell = 0.1, bb = bbox(bed.poly), GW = Math.ceil((bb.x1 - bb.x0) / cell), GH = Math.ceil((bb.z1 - bb.z0) / cell);
  const grid = new Uint8Array(GW * GH), hard = ctx.hard.filter(h => h.i !== self && !own.includes(h.i)).map(h => ({ h, b: bbox(h.poly) }));
  const stamp = (p: Plant) => eachHidden(p.sp, p.x, p.z, p.r, cell, bb.x0, bb.z0, GW - 1, GH - 1, (i, j) => { grid[i * GH + j] = 1; });
  for (const p of C.plants) if (p.x > bb.x0 - p.r * MASK_REACH && p.x < bb.x1 + p.r * MASK_REACH && p.z > bb.z0 - p.r * MASK_REACH && p.z < bb.z1 + p.r * MASK_REACH) stamp(p);
  const cells: number[] = [];
  for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) {
    const x = bb.x0 + (i + 0.5) * cell, z = bb.z0 + (j + 0.5) * cell;
    if (!inPoly(x, z, bed.poly) || ctx.houseGap(x, z) < WALL_OUT + 0.2 || ctx.lotRoom(x, z) < 0.16) continue;
    if (hard.some(({ h, b }) => x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2 && (inPoly(x, z, h.poly) || lineDist(x, z, h.poly, true) < 0.15))) continue;
    cells.push(i * GH + j);
  }
  if (!cells.length) return;
  const tints = new Map<string, number>();
  const bloomOf = (sp: string) => { const S = SPECIES[sp]; if (!S || !S.bloom) return null; if (!tints.has(sp)) { const pal = C.bloom || mix.bloom || S.bloom; tints.set(sp, pal[Math.floor(rng() * pal.length)]); } return tints.get(sp)!; };
  let bare = cells.filter(c => !grid[c]);
  const target = C.bareTarget * cells.length, cap = Math.ceil(cells.length * cell * cell * 70) + 20;
  const around = (c: number, k: number) => { const ci = Math.floor(c / GH), cj = c % GH; let n = 0; for (let i = Math.max(0, ci - k); i <= Math.min(GW - 1, ci + k); i++) for (let j = Math.max(0, cj - k); j <= Math.min(GH - 1, cj + k); j++) if (!grid[i * GH + j]) n++; return n; };
  for (let n = 0; bare.length > target && n < cap; n++) {
    let c = bare[Math.floor(rng() * bare.length)], best = around(c, 2);
    for (let k = 0; k < 7; k++) { const c2 = bare[Math.floor(rng() * bare.length)], a2 = around(c2, 2); if (a2 > best) { best = a2; c = c2; } }
    const x = bb.x0 + (Math.floor(c / GH) + 0.5) * cell + (rng() - 0.5) * cell * 0.6, z = bb.z0 + (c % GH + 0.5) * cell + (rng() - 0.5) * cell * 0.6;
    const sp = pickWeighted(mix.fill, drifted(wave(x * 0.8 + z * 0.6), (rng() - 0.5) * 0.5));
    const q = plant(C, sp, x, z, 'front', true, bloomOf);
    if (!q) { bare = bare.filter(v => v !== c); continue; }
    // a fill plant keeps inside its bed: at the edge it is the smaller for it
    const edgeRoom = lineDist(x, z, bed.poly, true) + 0.17;
    if (q.r > edgeRoom) { q.r = Math.max(0.1, edgeRoom); q.h *= 0.85; }
    stamp(q);
    bare = bare.filter(v => !grid[v]);
  }
}
// ---- the kinds --------------------------------------------------------------------------------------------------
function facadeBands(C: Ctx, sides: string[], depth: number): Band[] {
  const rects = C.ctx.keepOut; if (!rects.length) return [];
  const edges = perimeterEdges(rects), out: Band[] = [];
  const nOut = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
  const wob = wobble(C.orng, 3.2, 3);
  for (const e of edges) {
    if (!sides.includes(e.side)) continue;
    const n = nOut[e.side] as P2, off = 0.12;   // the band starts just off the wall face (walls are 0.16 m, centred on the edge)
    const a: P2 = [e.a[0] + n[0] * off, e.a[1] + n[1] * off], b: P2 = [e.b[0] + n[0] * off, e.b[1] + n[1] * off];
    const base = resample([a, b], 0.25, false);
    const band = makeBand(base, base.map(() => n), s => depth * (0.82 + 0.3 * wob(s + a[0] + a[1])), true, true);
    out.push(band);
  }
  return out;
}
function doorsOn(spec: any): Array<{ side: string; lo: number; hi: number }> {
  const lv = (spec.levels || []).filter(l => (l.y || 0) <= 0.001);
  // a door keeps a metre clear each side of its leaf (crowns reach half a metre into a gap)
  return lv.flatMap(l => (l.openings || []).filter(o => ['door', 'slider', 'garage', 'glass'].includes(o.type) && (o.type !== 'glass' || (o.sill ?? 0) < 0.3)).map(o => ({ side: o.side, lo: o.at - o.w / 2 - 0.9, hi: o.at + o.w / 2 + 0.9 })));
}

export function planPlanting(s: any, index: number, ctx: SiteContext): PlantingPlan {
  const kind = PLANTING_KINDS.includes(s.kind) ? s.kind : 'border';
  const mixName = mixNameOf(s, ctx.spec.lot);
  let mix: Mix = MIXES[mixName] || MIXES.cottage;
  if (mixName === 'custom') {
    // { kinds: [...species], weights?: [...] } — the same species on every layer, sorted into layers by height
    const kinds: string[] = (s.mix.kinds || []).filter(k => SPECIES[k]), w: number[] = s.mix.weights || [];
    const layerOf = (sp: string) => { const h = (SPECIES[sp].h[0] + SPECIES[sp].h[1]) / 2; return h >= 1.1 ? 'back' : h >= 0.55 ? 'mid' : 'front'; };
    const L = (name: string): Layer => { const l = kinds.map((k, i) => [k, w[i] ?? 1] as [string, number]).filter(([k]) => layerOf(k) === name); return l.length ? l : kinds.map((k, i) => [k, w[i] ?? 1] as [string, number]); };
    // its gaps are filled with the low, leafy kinds it names (never a rock or a grass: they cover little), else groundcover
    const fill: Layer = kinds.map((k, i) => [k, w[i] ?? 1] as [string, number]).filter(([k]) => k !== 'rock' && coverOf(k) >= 0.4 && (SPECIES[k].h[0] + SPECIES[k].h[1]) / 2 <= 1.0);
    mix = kinds.length ? { ...MIXES.cottage, back: L('back'), mid: L('mid'), front: L('front'), fill: fill.length ? fill : MIXES.cottage.fill } : MIXES.cottage;
  }
  // the outline and the plants have a stream each: another `seed` lays the same beds out with other plants
  const rng = mulberry32(fnv1a(`${ctx.seed}:site:${index}:planting${s.seed !== undefined ? ':' + s.seed : ''}`)), orng = mulberry32(fnv1a(`${ctx.seed}:site:${index}:planting:outline`));
  const layers = clamp(Math.round(s.layers ?? (kind === 'meadow' ? 3 : kind === 'walk' ? 3 : 3)), 1, 3);
  const dens = clamp((s.density ?? 1) * mix.density, 0.3, 3);
  // the share of a bed left showing mulch: the mix's at density 1, more as it thins
  const bareTarget = dens >= 1 ? mix.bare : Math.min(0.75, mix.bare + (1 - dens) * 0.6);
  const bloom = Array.isArray(s.bloom) && s.bloom.length ? s.bloom.map(c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c) : null;
  const ownRef = kind === 'walk' && typeof s.along === 'string' && s.along.startsWith('path:') ? ctx.lookup(s.along.slice(5), 'path') : null;
  // (a walk's own path is the edge its beds meet: nothing is kept clear of it)
  const plan: PlantingPlan = { mix: mixName, beds: [], plants: [], trees: [], floor: null, bareTarget, own: ownRef ? [ownRef.i] : [] };
  const mulch = s.mulch === 'none' ? null : typeof s.mulch === 'string' && s.mulch.startsWith('#') ? parseInt(s.mulch.slice(1), 16) : mix.mulch;
  // what a plant may not stand in: hard site items (never the planting itself), the house, the pavement past the lot line
  const hard = ctx.hard.filter(h => h.i !== index);
  const C: Ctx = { ctx, rng, orng, mix, mixName, bloom, dens, layers, plants: plan.plants, blockedWorld: () => false, bareTarget };
  const hardAt = (p: P2, pad = 0) => hard.some(h => inPoly(p[0], p[1], h.poly) || (pad > 0 && lineDist(p[0], p[1], h.poly, true) < pad));
  const offLot = (p: P2) => ctx.lotRoom(p[0], p[1]) < 0.05;
  C.blockedWorld = p => offLot(p) || hardAt(p) || ctx.houseGap(p[0], p[1]) < WALL_OUT + 0.02;
  const depth = s.depth ?? KIND_DEPTH[kind] ?? 1.6, fillWave = wobble(rng, 1.9, 3);

  let bands: Band[] = [];
  if (kind === 'foundation') {
    const along = typeof s.along === 'string' && s.along.startsWith('facade:') ? s.along.slice(7) : 'S';
    const sides = along === 'all' ? ['S', 'N', 'E', 'W'] : along.split(',').map(x => x.trim().toUpperCase());
    const doors = doorsOn(ctx.spec).filter(d => sides.includes(d.side));
    const raw = facadeBands(C, sides, depth);
    for (const b of raw) {
      const side = b.N[0][1] > 0.5 ? 'S' : b.N[0][1] < -0.5 ? 'N' : b.N[0][0] > 0.5 ? 'E' : 'W';
      const blocked = (p: P2) => hardAt(p, 0.15) || offLot(p) || doors.some(d => d.side === side && ((side === 'S' || side === 'N') ? p[0] > d.lo && p[0] < d.hi : p[1] > d.lo && p[1] < d.hi));
      bands.push(...runsOf(b, blocked, 1.6));
    }
  } else if (kind === 'walk' || kind === 'border' || kind === 'terrace') {
    let line: P2[] = [], w = 0, into = 'left';
    if (kind === 'walk') {
      const ref = typeof s.along === 'string' && s.along.startsWith('path:') ? ctx.lookup(s.along.slice(5), 'path') : null;
      // (resampled: a straight path is two points, and a band needs a sample every 0.25 m along it — the samples lie on
      // the path's own centre line, so the beds still meet its edge exactly)
      if (ref) { line = resample(ctx.pathLine(ref.s), 0.25, false); w = ref.s.w || 1.0; }
      else if (Array.isArray(s.along)) { const t = tensionOf(s.smooth ?? true); line = t === null ? resample(s.along, 0.25) : smoothLine(s.along, t, 0.25); w = s.w || 1.0; }
    } else if (kind === 'terrace') {
      const ref = typeof s.along === 'string' && s.along.startsWith('terrace:') ? ctx.lookup(s.along.slice(8), 'terrace') : null;
      if (ref) { const poly = ctx.terracePoly(ref.s); line = resample([...poly, poly[0]], 0.25, false); }
      else if (Array.isArray(s.along)) line = resample(s.along, 0.25, false);   // (a step's front edge, say: side says which way)
    } else if (Array.isArray(s.along)) {
      const t = tensionOf(s.smooth ?? true); line = t === null ? resample(s.along, 0.25) : smoothLine(s.along, t, 0.25);
    }
    if (line.length >= 2) {
      const N = lineNormals(line, false, 1.6), wob = wobble(orng, 3.4, 3);
      const unit = (v: P2) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l] as P2; };
      const mk = (sign: number, backAtBase: boolean, gap: number) => {
        const base = line.map((p, i) => [p[0] + N[i][0] * sign * gap, p[1] + N[i][1] * sign * gap] as P2);
        return makeBand(base, N.map(n => unit([n[0] * sign, n[1] * sign])), q => depth * (0.8 + 0.32 * wob(q + sign * 7)), backAtBase);
      };
      const side = s.side || (kind === 'walk' ? 'both' : 'left');
      const raw: Band[] = [];
      if (kind === 'walk') { raw.push(mk(1, false, w / 2)); raw.push(mk(-1, false, w / 2)); }
      else if (kind === 'terrace') {
        // inside a terrace's outline, from its coping in: the trailing front at the edge, taller plants behind
        const ref = ctx.lookup(String(s.along).slice(8), 'terrace'), T = ref ? ctx.terracePoly(ref.s) : null;
        const b1 = mk(1, false, 0.3), b2 = mk(-1, false, 0.3);
        // keep the side whose middle lies inside the terrace (or the side named, along a line); its base runs along the
        // coping (a built edge, like a wall)
        const mid = (b: Band) => at(b, b.s[Math.floor(b.s.length / 2)] ?? 0, 0.5);
        const kept = T ? (inPoly(...mid(b1), T) ? b1 : b2) : (s.side === 'right' ? b2 : b1); kept.edgeBuilt = true;
        raw.push(kept);
      } else {
        if (side === 'left' || side === 'both') raw.push(mk(1, true, 0));
        if (side === 'right' || side === 'both') raw.push(mk(-1, true, 0));
      }
      const selfHard = (p: P2) => offLot(p) || hardAt(p, kind === 'walk' ? 0 : 0.1);
      for (const b of raw) bands.push(...runsOf(b, p => selfHard(p) || ctx.houseGap(p[0], p[1]) < 0.35, 1.6));
      // a walk's own path is not an obstacle to its beds: they are laid off its edges
      if (kind === 'walk') { const own = typeof s.along === 'string' ? ctx.lookup(s.along.slice(5), 'path') : null; if (own) { const others = hard.filter(h => h.i !== own.i); C.blockedWorld = p => offLot(p) || others.some(h => inPoly(p[0], p[1], h.poly)) || ctx.houseGap(p[0], p[1]) < WALL_OUT + 0.02; } }
    }
  }
  for (const b of bands) {
    // `wall`: the bed's edges that run along something built — the house (a foundation bed) or a terrace's coping — are
    // straight because it is, and the edge metrics leave them out
    const poly = bandPoly(b), nb = b.base.length;
    const bed: Bed = { poly, y: ctx.groundAt(...at(b, b.s[Math.floor(b.s.length / 2)], (b.D[Math.floor(b.D.length / 2)] || 0) / 2)), soil: mulch !== null, mulch, wall: segmentsOf(poly, true).map(([p, q], k) => (b.wall && ctx.houseGap(p[0], p[1]) < 0.35 && ctx.houseGap(q[0], q[1]) < 0.35) || (!!b.edgeBuilt && k < nb - 1)) };
    plan.beds.push(bed);
    plantBand(C, b);
    if (mulch !== null) fillBed(C, bed, index, plan.own, fillWave);
  }

  if (kind === 'meadow' || kind === 'grove') {
    const t = tensionOf(s.smooth ?? true);
    let poly: P2[] = Array.isArray(s.poly) && s.poly.length >= 3 ? s.poly : Array.isArray(s.at) ? Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, r = s.r || (kind === 'grove' ? 5 : 3); return [s.at[0] + Math.cos(a) * r, s.at[1] + Math.sin(a) * r] as P2; }) : [];
    if (poly.length >= 3) {
      poly = t === null ? poly : noisyLoop(smoothLoop(poly, t, 0.3), orng, kind === 'meadow' ? 0.25 : 0.4, 3.5, 0.3);
      const bb = bbox(poly), inside = (x: number, z: number) => inPoly(x, z, poly) && !C.blockedWorld([x, z]);
      const y = ctx.groundAt(...centroid(poly));
      const bloomOf = (() => { const m = new Map<string, number>(); return (sp: string) => { const S = SPECIES[sp]; if (!S || !S.bloom) return null; if (!m.has(sp)) { const pal = bloom || mix.bloom || S.bloom; m.set(sp, pal[Math.floor(rng() * pal.length)]); } return m.get(sp)!; }; })();
      if (kind === 'meadow') {
        // a drift field over the plan decides the species; heights follow the species, so the meadow undulates
        const fx = wobble(rng, 6, 3), fz = wobble(rng, 5, 3);
        const all: Layer = C.layers >= 3 ? [...mix.back, ...mix.mid, ...mix.front] : C.layers === 2 ? [...mix.mid, ...mix.front] : mix.mid;
        const sp0 = spacingOf(all, dens) * 0.85;
        const pts = poisson(rng, bb, sp0, inside, { seeds: Math.max(3, Math.round(polyArea(poly) / 8)) });
        for (const [x, z] of pts) { const v = clamp(((fx(x) + fz(z)) / 2 + 1) / 2 + (rng() - 0.5) * 0.18); plant(C, pickWeighted(all, v), x, z, 'mid', true, bloomOf); }
        plan.floor = { poly, y, kind: 'meadow' };
      } else {
        // grove: trees spaced by their crowns, an understorey between and under them, groundcover over the floor
        const trees: Layer = Array.isArray(s.species) ? s.species.filter(k => SPECIES[k]).map(k => [k, 1] as [string, number]) : typeof s.species === 'string' && SPECIES[s.species] ? [[s.species, 1]] : mix.trees;
        const tr = spacingOf(trees, 1) * (s.spread || 1) * 1.35;
        const tpts = poisson(rng, bb, tr, (x, z) => inside(x, z) && ctx.houseGap(x, z) > tr * 0.45 && ctx.lotRoom(x, z) > 0.6, { seeds: 2, max: s.n || 999 });
        const treeList: Plant[] = [];
        for (const [x, z] of tpts) {
          const sp = pickWeighted(trees, rng()), S = SPECIES[sp];
          treeList.push({ sp, x, z, y: ctx.groundAt(x, z), h: lerp(S.h[0], S.h[1], rng()) * (s.h ? s.h / 5 : 1), r: lerp(S.r[0], S.r[1], rng()) * (s.spread || 1), rot: rng() * Math.PI * 2, tint: 0.9 + rng() * 0.2, bloom: null, layer: 'tree' });
        }
        plan.trees.push(...treeList);
        const trunkBlock: Blocker[] = treeList.map(t => ({ x: t.x, z: t.z, r: 0.7 }));
        const under = poisson(rng, bb, spacingOf(mix.back, dens) * 1.3, inside, { blockers: trunkBlock, seeds: 3 });
        for (const [x, z] of under) plant(C, pickWeighted(mix.back, rng()), x, z, 'back', true, bloomOf);
        const low = poisson(rng, bb, spacingOf(mix.mid, dens) * 1.2, inside, { blockers: [...trunkBlock, ...plan.plants.map(p => ({ x: p.x, z: p.z, r: p.r * 1.1 }))], seeds: 3 });
        for (const [x, z] of low) plant(C, pickWeighted(mix.mid, rng()), x, z, 'mid', true, bloomOf);
        plan.floor = { poly, y, kind: 'litter' };
      }
    }
  }
  return plan;
}

// ---- metrics (scripts/test-site.mts, the fleet audit) -------------------------------------------------------------
/** what share of a planting's beds shows bare mulch: each bed sampled every `cellM` m (0.05), a plant hiding what its
 *  silhouette covers seen from above (the masks: measured on the geometry that is drawn — scripts/test-site-species.mts
 *  holds them to it). With the site context, the drip strip along a wall (the 0.2 m no crown may reach into, under the
 *  eaves), the 0.16 m along the lot line (no plant may reach past it) and the 0.15 m round any other site item (`self`
 *  is the planting's own index) are not counted. */
export function bareShare(plan: PlantingPlan, ctx: SiteContext | null = null, cellM = 0.05, self = -1): number {
  let bare = 0, all = 0;
  const hard = ctx ? ctx.hard.filter(h => h.i !== self && !plan.own.includes(h.i)) : [];   // (what the planting stands off: another item's outline and 0.15 m round it are not its mulch; a walk's own path is its edge)
  for (const bed of plan.beds) {
    if (!bed.soil) continue;
    const bb = bbox(bed.poly), W = Math.ceil((bb.x1 - bb.x0) / cellM), H = Math.ceil((bb.z1 - bb.z0) / cellM);
    const cov = new Uint8Array(W * H);
    for (const p of plan.plants) {
      if (p.x < bb.x0 - p.r * MASK_REACH || p.x > bb.x1 + p.r * MASK_REACH || p.z < bb.z0 - p.r * MASK_REACH || p.z > bb.z1 + p.r * MASK_REACH) continue;
      eachHidden(p.sp, p.x, p.z, p.r, cellM, bb.x0, bb.z0, W - 1, H - 1, (i, j) => { cov[i * H + j] = 1; });
    }
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      const x = bb.x0 + (i + 0.5) * cellM, z = bb.z0 + (j + 0.5) * cellM;
      if (!inPoly(x, z, bed.poly) || (ctx && (ctx.houseGap(x, z) < WALL_OUT + 0.2 || ctx.lotRoom(x, z) < 0.16 || hard.some(h => inPoly(x, z, h.poly) || lineDist(x, z, h.poly, true) < 0.15)))) continue;
      all++; if (!cov[i * H + j]) bare++;
    }
  }
  return all ? bare / all : 0;
}
/** height classes present in each bed: ground < 0.45 m, mid 0.45–1.1 m, tall > 1.1 m */
export function heightClasses(plan: PlantingPlan): number[] {
  return plan.beds.map(bed => {
    const cls = new Set<number>();
    for (const p of plan.plants) if (inPoly(p.x, p.z, bed.poly)) cls.add(p.h < 0.45 ? 0 : p.h <= 1.1 ? 1 : 2);
    return cls.size;
  });
}
/** each bed's run (half its outline's length, m) and the plants in it by height class: over 1.1 m, 0.45–1.1 m, under */
export function layerDensity(plan: PlantingPlan): Array<{ run: number; tall: number; mid: number; low: number }> {
  return plan.beds.map(bed => {
    const inBed = plan.plants.filter(p => inPoly(p.x, p.z, bed.poly));
    return { run: lengthOf(bed.poly, true) / 2, tall: inBed.filter(p => p.h > 1.1).length, mid: inBed.filter(p => p.h >= 0.45 && p.h <= 1.1).length, low: inBed.filter(p => p.h < 0.45).length };
  });
}
/** the triangles a planting's plants cost (the species' own measure, assets/site-species-masks.ts) */
export function plantingTriangles(plan: PlantingPlan): number {
  return [...plan.plants, ...plan.trees].reduce((n, p) => n + (TRIS[p.sp] ?? 4000), 0);
}
/** a planting's bed outlines as segments, less those against the house (a bed along a wall is straight there) */
export function bedSegments(plan: PlantingPlan): Array<[P2, P2]> {
  return plan.beds.flatMap(b => segmentsOf(b.poly, true).filter((_, i) => !b.wall[i]));
}
export { axisAligned, segmentsOf, lengthOf, polyArea };
