// The collision engine of scripts/review/collide.mts, as pure functions of a scene dump: no browser, no THREE, no product code, so
// scripts/test-geometry-detectors.mts can feed it synthetic boxes and pin what it reports and what it lets through.
//
// A scene dump is the visible meshes of a built house as world-space boxes and triangle soups grouped under the objects the builders
// `put` into the scene (an entity: an item with its type and room, a wall, a stair run, a floor, a site piece). The engine
//   1. builds a convex hull per mesh (an oriented box exactly, anything else by quickhull), classifies every mesh (a prop's part, a wall's
//      body, a trim board, a window or door frame, a pane, a leaf, a stair, a rail ...),
//   2. broad-phases the hulls on a grid, and measures each overlapping pair of different entities by SAT: the minimum translation
//      distance (how far one would have to move to clear the other) and the volume they share,
//   3. lets the legitimate contacts through (the whitelist below: every rule has a name and is counted, `--show-allowed` lists them),
//   4. adds what no pair of meshes shows: an item on a slab void, one below its floor or through its ceiling, one in a door's swing.
// The whitelist is the placement metadata (content/house-catalog.json `place`: against, onSurface, hangs, mountY, tucks, group) and
// structure (a lamp whose base lies on a surface top; a leg standing in a rug's pile), never a list of item names.
import { boxHull, meshHull, satPenetration, overlapVolume, overlapCentre, aabbOverlaps, sampleDepth, type Hull, type Vec3 } from './geom-lib.mts';
const overlapSize = (a: Hull, b: Hull): Vec3 => [Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])), Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1])), Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]))];

export interface Ent {
  i: number; name: string; role: string; cat: string | null; itemType: string | null; room: string | null; level: number;
  onSurface: boolean; mounted: boolean; foliage: boolean; dress: boolean; stair: boolean; isWall: boolean; at: Vec3; rotY: number;
}
export interface PartIn { id: number; e: number; unit: string | null; wp: string | null; glass: boolean; geom: string; box?: { m: number[]; c: Vec3; h: Vec3 }; posF?: ArrayLike<number>; idx?: ArrayLike<number> | null }
export interface DoorIn { id: string; level: string; kind: string; leaf: string; hinge: [number, number]; y0: number; h: number; w: number; open: boolean; closed: number; openA: number; poses: { m: number[]; c: Vec3; h: Vec3 }[][] }
export interface RoomIn { level: number; levelId: string; name: string; bounds: { x: number; z: number; w: number; d: number }; program: string | null; floorOffset: number; y: number; height: number }
export interface VoidIn { level: number; rect: { x: number; z: number; w: number; d: number }; kind: string }
export interface SceneDump { entities: Ent[]; parts: PartIn[]; doors: DoorIn[]; levels: { id: string; y: number; height: number }[]; rooms: RoomIn[]; voids: VoidIn[] }
/** the catalog's `place` block of an item type (content/house-catalog.json) */
export interface Meta { group?: string; against?: string; hangs?: string | null; mountY?: number; onSurface?: boolean; surfaces?: string[]; tucks?: boolean; top?: number }
export type Catalog = Record<string, Meta>;

export type Kind = 'prop' | 'body' | 'trim' | 'frame' | 'glass' | 'leaf' | 'finish' | 'stair' | 'rail' | 'facade' | 'floor' | 'ceiling' | 'roof' | 'site' | 'other';
export interface Opts { minDepth?: number; contact?: number; resting?: number; maxPairsPerEntity?: number; volumeGrid?: number; /** also test the lot's hard pieces (cars, garden walls, fences, loungers, benches) against the house's walls */ site?: boolean }
export const DEFAULTS = { minDepth: 0.01, contact: 0.01, resting: 0.04, volumeGrid: 14 };

export interface Part { id: number; ent: Ent; kind: Kind; unit: string | null; hull: Hull; geom: string; dims: Vec3 | null; label: string; pos?: ArrayLike<number>; idx?: ArrayLike<number> | null; concave: boolean }
/** the primitives whose own hull is the shape: everything else (a loft, a tube, an extrusion, a buffer of unknown shape) is measured by its vertices too */
const CONVEX_GEOM = new Set(['BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'CapsuleGeometry', 'PlaneGeometry', 'CircleGeometry', 'IcosahedronGeometry', 'OctahedronGeometry', 'DodecahedronGeometry', 'TetrahedronGeometry']);
export interface Finding {
  kind: string;                       // prop-prop | prop-wall | prop-window | prop-door | prop-stair | prop-rail | door-swing | slab-void | floor | ceiling
  depth_cm: number; volume_cm3: number; at: Vec3; size?: Vec3;
  a: EntRef; b: EntRef | null;
  parts: { a: string; b: string; n: number } | null;
  rule: string;                       // why it is a finding: which tolerance it exceeded
  visible?: string; thickness_cm?: number;
  note?: string;
}
export interface Sev { visible: string; thickness_cm?: number }
/** What the collision looks like: a prop that goes deeper into a wall than the wall is thick comes out the far side; one that stops inside the
 *  slab is hidden in it unless it is at a wall's end, a corner or an opening (still a collision: it is that much shorter than it was drawn, and a
 *  face flush with the wall z-fights). */
function severity(kind: string, depth: number, thick?: number): Sev {
  if (kind === 'prop-wall' || kind === 'site-wall') return thick ? { visible: depth >= thick - 0.01 ? 'pokes out of the far side of the wall' : 'inside the wall slab (hidden unless it is at a wall end, a corner or an opening)', thickness_cm: Math.round(thick * 1000) / 10 } : { visible: 'inside the wall paint or trim (hidden unless at an end or an opening)' };
  if (kind === 'site-wall') return { visible: 'a piece of the lot is in the building' };
  if (kind === 'prop-prop') return { visible: depth >= 0.06 ? 'one is visibly inside the other' : 'edges merge' };
  return { visible: 'visible' };
}
const wallThickness = (p: Part): number | undefined => p.kind === 'body' && p.dims ? Math.min(...p.dims) : undefined;
export interface EntRef { i: number; name: string; type: string | null; room: string | null; level: number; role: string; at: Vec3; id: string }
export interface Allowed { rule: string; count: number; maxDepth_cm: number; example: string }

const HOUSE_PROP_ROLES = new Set(['item', 'hero', 'fixture']);
const WALL_KINDS = new Set<Kind>(['body', 'trim', 'frame', 'glass', 'leaf', 'finish']);

export function classify(ent: Ent, p: PartIn, dims: Vec3 | null): Kind {
  if (ent.stair) return 'stair';
  switch (ent.role) {
    case 'item': case 'hero': case 'fixture': return 'prop';
    case 'floor': return 'floor';
    case 'ceiling': return 'ceiling';
    case 'finish': return 'finish';
    case 'wall':
      if (p.unit === 'leaf') return 'leaf';
      if (p.glass) return 'glass';
      if (p.unit === 'window' || p.unit === 'door') return 'frame';
      return dims && Math.min(...dims) < 0.1 ? 'trim' : 'body';
    case 'structure': return ent.isWall ? 'facade' : 'rail';
    case 'roof': return 'roof';
    case 'site': case 'ground': return 'site';
    default: return 'other';
  }
}
const dimsOf = (h: Hull): Vec3 | null => h.box ? [h.box.h[0] * 2, h.box.h[1] * 2, h.box.h[2] * 2] : [h.max[0] - h.min[0], h.max[1] - h.min[1], h.max[2] - h.min[2]];
const lbl = (p: Part) => `${p.ent.name}${p.ent.itemType ? ` (${p.ent.itemType})` : ''} > ${p.geom.replace('Geometry', '')}${p.dims ? ' ' + p.dims.map(v => Math.round(v * 1000) / 1000).join('x') : ''} #${p.id}`;
const r3 = (v: ArrayLike<number>): Vec3 => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000, Math.round(v[2] * 1000) / 1000];
export const refOf = (e: Ent): EntRef => ({ i: e.i, name: e.name, type: e.itemType, room: e.room, level: e.level, role: e.role, at: e.at, id: entId(e) });
/** a stable id for an entity: level / room / type (or name) @ position, which two builds of one spec agree on */
export const entId = (e: Ent) => `L${e.level}/${e.room ?? '-'}/${e.itemType ?? e.name.replace(/[0-9.]+/g, '#')}@${e.at[0].toFixed(2)},${e.at[2].toFixed(2)}`;

/** every mesh of the dump as a classified part with a hull */
export function buildParts(dump: SceneDump): Part[] {
  const out: Part[] = [];
  for (const p of dump.parts) {
    const ent = dump.entities[p.e]; if (!ent) continue;
    let hull: Hull | null = null;
    if (p.box) hull = boxHull(p.box.m, p.box.h, p.box.c); else if (p.posF) hull = meshHull(p.posF);
    if (!hull) continue;
    const dims = dimsOf(hull);
    const part: Part = { id: p.id, ent, kind: classify(ent, p, dims), unit: p.unit, hull, geom: p.geom, dims, label: '', pos: p.posF, idx: p.idx, concave: !p.box && !CONVEX_GEOM.has(p.geom) };
    part.label = lbl(part);
    out.push(part);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// the whitelist: how much overlap each legitimate relation may have
// ---------------------------------------------------------------------------------------------------------------------------------
export interface Rel { allow: number; rule: string }
/** The overlap (metres) a pair of parts may have before it is a finding, and the name of the rule that says so. `pen.axis` is the direction
 *  of the cheapest push: a mostly vertical one is something standing on, lying on or resting in something else. */
export function allowance(p: Part, q: Part, axis: Vec3, cat: Catalog, o: typeof DEFAULTS): Rel {
  const a = p.ent, b = q.ent, ma = a.itemType ? cat[a.itemType] : undefined, mb = b.itemType ? cat[b.itemType] : undefined;
  let allow = o.contact, rule = 'contact';
  const bump = (v: number, r: string) => { if (v > allow) { allow = v; rule = r; } };
  const vertical = Math.abs(axis[1]) > 0.85;
  // foliage: a splayed leaf's box covers far more than the leaf
  if (a.foliage || b.foliage) bump(0.12, 'foliage');
  // a cord plugs into the wall: its end is in the socket
  if ((CABLE.test(a.name) && WALL_KINDS.has(q.kind)) || (CABLE.test(b.name) && WALL_KINDS.has(p.kind))) bump(0.10, 'cable-plug');
  if (CABLE.test(a.name) || CABLE.test(b.name)) bump(0.03, 'cable');
  // something standing on / lying on / resting in something else: the push is vertical and shallow (a leg in a rug's pile, a lamp's foot on a
  // table top, a dress item on a counter, a cushion on a sofa, a book on a shelf)
  if (vertical) bump(o.resting, 'resting');
  // a rug's pile: a leg or a foot sinks into a shag, jute or flatweave by its thickness (the catalog says what is a rug)
  if (vertical && (ma?.group === 'rug' || mb?.group === 'rug')) bump(0.08, 'rug-pile');
  // a thing made to sit on a surface (the catalog's onSurface) may sink its foot a little more into a host that is not perfectly measured
  if ((a.onSurface || ma?.onSurface) && vertical && isHostFor(ma, mb)) bump(0.05, 'on-surface');
  if ((b.onSurface || mb?.onSurface) && vertical && isHostFor(mb, ma)) bump(0.05, 'on-surface');
  // wall-mounted things live in the wall plane by design: a frame's back panel, a sconce's plate, an upper cabinet's back
  const mounted = (e: Ent, m?: Meta) => e.mounted || m?.hangs === 'wall' || m?.mountY !== undefined;
  if (WALL_KINDS.has(q.kind) && mounted(a, ma)) bump(0.04, 'wall-mounted');
  if (WALL_KINDS.has(p.kind) && mounted(b, mb)) bump(0.04, 'wall-mounted');
  // standing against a wall: the back of a cabinet, a sofa's back, a bed's head: the catalog says `against` wall or corner, and the
  // composer sets them back from the wall face by a few millimetres or a centimetre or two
  const against = (m?: Meta) => m && (m.against === 'wall' || m.against === 'corner' || m.against === 'window');
  if (WALL_KINDS.has(q.kind) && against(ma)) bump(0.02, 'against-wall');
  if (WALL_KINDS.has(p.kind) && against(mb)) bump(0.02, 'against-wall');
  // trim boards protrude 8-18 mm from the wall face and are not a thing a prop stops at
  if (q.kind === 'trim' || p.kind === 'trim') bump(0.03, 'trim');
  // a chair or a stool that tucks under a table, desk or counter
  if (ma?.tucks && isTable(mb)) bump(0.12, 'tucks');
  if (mb?.tucks && isTable(ma)) bump(0.12, 'tucks');
  return { allow, rule };
}
/** the lot's ground cover and growing things: they sit on the ground and lean on walls, they are not solids a wall can be inside of */
const SOFT_SITE = /\b(planting|hedge|flowers?|palm|tree|planter|path|patio|driveway|terrace|lawn|lot|world|pool|foundation|deck|porch)\b/i;
const CABLE = /\b(cord|cable|wire)\b/i;
const isTable = (m?: Meta) => !!m && ['table', 'desk', 'fitted', 'storage'].includes(m.group || '');
const isHostFor = (small?: Meta, host?: Meta) => !!small && !!host && (!small.surfaces || !small.surfaces.length || small.surfaces.includes(host.group || ''));

// ---------------------------------------------------------------------------------------------------------------------------------
// the pair loop
// ---------------------------------------------------------------------------------------------------------------------------------
interface PairAcc { a: Ent; b: Ent; kind: string; depth: number; vol: number; at: Vec3; size: Vec3; thick?: number; n: number; la: string; lb: string; rule: string; pa?: Part; pb?: Part }

/** all collisions between the visible meshes of a built house, and the legitimate contacts the whitelist let through */
export function findCollisions(dump: SceneDump, cat: Catalog, opt: Opts = {}): { findings: Finding[]; allowed: Allowed[]; stats: { parts: number; pairsTested: number; overlaps: number } } {
  const o = { ...DEFAULTS, ...opt };
  const parts = buildParts(dump);
  const solids = parts.filter(p => p.kind === 'prop' || WALL_KINDS.has(p.kind) || p.kind === 'stair' || p.kind === 'rail' || (opt.site && p.kind === 'site' && !SOFT_SITE.test(p.ent.name)));
  // grid broad phase on the AABBs
  const cell = 1.0, grid = new Map<string, number[]>();
  solids.forEach((p, i) => {
    const x0 = Math.floor(p.hull.min[0] / cell), x1 = Math.floor(p.hull.max[0] / cell), y0 = Math.floor(p.hull.min[1] / cell), y1 = Math.floor(p.hull.max[1] / cell), z0 = Math.floor(p.hull.min[2] / cell), z1 = Math.floor(p.hull.max[2] / cell);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 600) return;   // a lot-sized sheet: not a part a prop collides with
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = `${x},${y},${z}`; (grid.get(k) || grid.set(k, []).get(k)!).push(i); }
  });
  const seen = new Set<number>(), acc = new Map<string, PairAcc>(), allowedAcc = new Map<string, Allowed>();
  let tested = 0, overlaps = 0;
  const N = solids.length;
  for (const list of grid.values()) {
    for (let ai = 0; ai < list.length; ai++) for (let bi = ai + 1; bi < list.length; bi++) {
      const i = Math.min(list[ai], list[bi]), j = Math.max(list[ai], list[bi]);
      const key = i * N + j; if (seen.has(key)) continue; seen.add(key);
      const p = solids[i], q = solids[j];
      if (p.ent === q.ent) continue;
      const kind = pairKind(p, q); if (!kind) continue;
      if (!aabbOverlaps(p.hull, q.hull, 0)) continue;
      tested++;
      const sat = satPenetration(p.hull, q.hull);
      if (!sat || sat.depth <= 0.002) continue;
      overlaps++;
      // a concave part (a plant, a cable, a cushion of unknown shape) is only as deep in the other as its own vertices go
      let depth = sat.depth;
      if (p.concave || q.concave) {
        const dp = p.concave && p.pos ? sampleDepth(p.pos, p.idx, q.hull) : 0, dq = q.concave && q.pos ? sampleDepth(q.pos, q.idx, p.hull) : 0;
        // one concave part against a convex one: its vertices into the convex hull are exact. Two concave parts: each is measured against the
        // other's hull, which overstates it, so the true overlap is under the smaller of the two
        if (p.concave && q.concave) depth = Math.min(depth, Math.min(dp, dq));
        else if ((p.concave && !q.hull.flat) || (q.concave && !p.hull.flat)) depth = Math.min(depth, Math.max(dp, dq));
      }
      const pen = { depth, axis: sat.axis };
      if (depth <= 0.002) continue;
      const rel = allowance(p, q, pen.axis, cat, o);
      if (pen.depth <= rel.allow || pen.depth < o.minDepth) {
        if (pen.depth >= 0.004) { const e = allowedAcc.get(rel.rule) || allowedAcc.set(rel.rule, { rule: rel.rule, count: 0, maxDepth_cm: 0, example: '' }).get(rel.rule)!; e.count++; if (pen.depth * 100 > e.maxDepth_cm) { e.maxDepth_cm = Math.round(pen.depth * 1000) / 10; e.example = `${p.label}  <->  ${q.label}`; } }
        continue;
      }
      const pp = p.kind === 'prop' && q.kind === 'prop';
      const [ea, eb] = pp ? (p.ent.i <= q.ent.i ? [p.ent, q.ent] : [q.ent, p.ent]) : (p.kind === 'prop' || p.kind === 'site' ? [p.ent, q.ent] : [q.ent, p.ent]);
      const k = `${kind}|${ea.i}|${eb.i}`;
      let g = acc.get(k);
      if (!g) acc.set(k, g = { a: ea, b: eb, kind, depth: 0, vol: 0, at: [0, 0, 0], size: [0, 0, 0], n: 0, la: '', lb: '', rule: rel.rule });
      g.n++;
      g.vol += overlapVolume(p.hull, q.hull, o.volumeGrid);
      if (pen.depth > g.depth) { g.depth = pen.depth; g.at = overlapCentre(p.hull, q.hull); g.size = overlapSize(p.hull, q.hull); g.la = (p.ent === ea ? p : q).label; g.lb = (p.ent === ea ? q : p).label; g.thick = wallThickness(p.ent === ea ? q : p); g.rule = `${rel.rule} (${rel.allow * 100} cm) exceeded`; }
    }
  }
  const findings: Finding[] = [];
  for (const g of acc.values()) findings.push({ kind: g.kind, depth_cm: Math.round(g.depth * 1000) / 10, volume_cm3: Math.round(g.vol * 1e6), at: r3(g.at), size: r3(g.size), a: refOf(g.a), b: refOf(g.b), parts: { a: g.la, b: g.lb, n: g.n }, rule: g.rule, ...severity(g.kind, g.depth, g.thick) });
  findings.push(...structural(dump, parts, o));
  const merged = mergeWallFindings(findings);
  findings.length = 0; findings.push(...merged);
  findings.sort((x, y) => y.depth_cm - x.depth_cm || y.volume_cm3 - x.volume_cm3 || (x.a.id < y.a.id ? -1 : 1));
  return { findings, allowed: [...allowedAcc.values()].sort((x, y) => y.count - x.count), stats: { parts: parts.length, pairsTested: tested, overlaps } };
}

/** one prop in one wall is a single collision, whether the wall's body, its paint overlay or its baseboard is what the prop is in: keep the deepest, say what else it is in */
function mergeWallFindings(all: Finding[]): Finding[] {
  const out: Finding[] = [], byProp = new Map<number, Finding[]>();
  for (const f of all) { if (f.kind !== 'prop-wall' || !f.b) { out.push(f); continue; } (byProp.get(f.a.i) || byProp.set(f.a.i, []).get(f.a.i)!).push(f); }
  for (const list of byProp.values()) {
    list.sort((x, y) => y.depth_cm - x.depth_cm);
    const kept: Finding[] = [];
    for (const f of list) {
      const near = kept.find(k => Math.hypot(k.at[0] - f.at[0], k.at[2] - f.at[2]) < 0.9 && Math.abs(k.at[1] - f.at[1]) < 1.6);
      if (near) {
        near.note = [near.note, `also in ${f.b!.name} (${f.depth_cm} cm)`].filter(Boolean).join('; '); near.volume_cm3 = Math.max(near.volume_cm3, f.volume_cm3);
        if (near.thickness_cm === undefined && f.thickness_cm !== undefined) { near.thickness_cm = f.thickness_cm; Object.assign(near, severity('prop-wall', near.depth_cm / 100, f.thickness_cm / 100)); }
      }
      else kept.push(f);
    }
    out.push(...kept);
  }
  return out;
}

/** the kind of a pair of parts, or null when it is not one the detector tests (a prop against a floor, two walls, ...) */
export function pairKind(p: Part, q: Part): string | null {
  if (p.kind === 'site' || q.kind === 'site') {
    const [s, w] = p.kind === 'site' ? [p, q] : [q, p];
    return s.kind === 'site' && (w.kind === 'body' || w.kind === 'finish' || w.kind === 'frame' || w.kind === 'glass' || w.kind === 'stair') ? 'site-wall' : null;
  }
  const [x, y] = p.kind === 'prop' ? [p, q] : [q, p];
  if (x.kind !== 'prop') return null;
  if (!HOUSE_PROP_ROLES.has(x.ent.role)) return null;
  switch (y.kind) {
    case 'prop': return 'prop-prop';
    case 'body': case 'finish': case 'trim': return 'prop-wall';
    case 'frame': case 'glass': return y.unit === 'door' ? 'prop-door' : 'prop-window';
    case 'leaf': return 'prop-door';
    case 'stair': return 'prop-stair';
    case 'rail': return 'prop-rail';
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// what no pair of meshes shows
// ---------------------------------------------------------------------------------------------------------------------------------
function structural(dump: SceneDump, parts: Part[], o: typeof DEFAULTS): Finding[] {
  const out: Finding[] = [];
  const props = parts.filter(p => p.kind === 'prop' && p.ent.role === 'item');
  const byEnt = new Map<number, Part[]>();
  for (const p of props) (byEnt.get(p.ent.i) || byEnt.set(p.ent.i, []).get(p.ent.i)!).push(p);
  // 1. the door swing: the leaf's boxes at 8 poses between closed and open, against every item of its storey
  for (const d of dump.doors) {
    const poses = d.poses.map(boxes => boxes.map(b => boxHull(b.m, b.h, b.c)));
    let best: { depth: number; ent: Ent; part: Part; at: Vec3; ang: number } | null = null;
    const lvl = dump.levels.findIndex(l => l.id === d.level);
    for (const [ei, ps] of byEnt) {
      const ent = ps[0].ent; if (lvl >= 0 && ent.level !== lvl) continue;
      if (ent.foliage && false) continue;
      poses.forEach((hs, pi) => { for (const h of hs) for (const part of ps) {
        if (!aabbOverlaps(h, part.hull, 0)) continue;
        const pen = satPenetration(h, part.hull); if (!pen) continue;
        if (!best || pen.depth > best.depth) best = { depth: pen.depth, ent, part, at: overlapCentre(h, part.hull), ang: pi };
      } });
      void ei;
    }
    if (best && best.depth >= 0.02) out.push({ kind: 'door-swing', depth_cm: Math.round(best.depth * 1000) / 10, volume_cm3: 0, at: r3(best.at), a: refOf(best.ent), b: null, parts: { a: best.part.label, b: `door ${d.id} (${d.leaf}, ${d.w} m, ${d.open ? 'built open' : 'built closed'}) at pose ${best.ang + 1}/${d.poses.length}`, n: 1 }, rule: 'the leaf cannot swing through it' });
  }
  // 2. an item on a slab void, 3. an item below its floor or through its ceiling
  for (const [, ps] of byEnt) {
    const ent = ps[0].ent;
    const room = dump.rooms.find(r => r.level === ent.level && r.name === ent.room);
    const lv = dump.levels[ent.level];
    // the footprint of the parts that stand on the floor: those whose underside is within 8 cm of the lowest point
    const lo = Math.min(...ps.map(p => p.hull.min[1]));
    const floorTop = lv ? lv.y + (room ? room.floorOffset : 0) : null;
    const feet = ps.filter(p => p.hull.min[1] < lo + 0.08 && p.hull.max[1] - p.hull.min[1] > 0.005);
    const box = feet.reduce((b, p) => ({ x0: Math.min(b.x0, p.hull.min[0]), x1: Math.max(b.x1, p.hull.max[0]), z0: Math.min(b.z0, p.hull.min[2]), z1: Math.max(b.z1, p.hull.max[2]) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
    const standing = !ent.onSurface && !ent.mounted && ent.role === 'item' && floorTop !== null && lo < floorTop + 0.2;
    if (standing && lv) {
      for (const v of dump.voids.filter(v => v.level === ent.level && lv.y > 0.3)) {
        const ox = Math.min(box.x1, v.rect.x + v.rect.w) - Math.max(box.x0, v.rect.x), oz = Math.min(box.z1, v.rect.z + v.rect.d) - Math.max(box.z0, v.rect.z);
        if (ox > 0.05 && oz > 0.05 && ox * oz > 0.02 && !ps[0].ent.stair) {
          const meta = ent.itemType;
          out.push({ kind: 'slab-void', depth_cm: Math.round(Math.min(ox, oz) * 1000) / 10, volume_cm3: Math.round(ox * oz * 1e4), at: r3([(Math.max(box.x0, v.rect.x) + Math.min(box.x1, v.rect.x + v.rect.w)) / 2, lv.y, (Math.max(box.z0, v.rect.z) + Math.min(box.z1, v.rect.z + v.rect.d)) / 2]), a: refOf(ent), b: null, parts: null, rule: `its feet stand ${Math.round(ox * 100)} x ${Math.round(oz * 100)} cm over the ${v.kind} void`, note: meta || undefined });
        }
      }
    }
    if (standing && floorTop !== null && lo < floorTop - 0.025) {
      out.push({ kind: 'floor', depth_cm: Math.round((floorTop - lo) * 1000) / 10, volume_cm3: 0, at: r3([ent.at[0], lo, ent.at[2]]), a: refOf(ent), b: null, parts: null, rule: `its lowest point is ${Math.round((floorTop - lo) * 1000) / 10} cm under the floor of its room (${floorTop.toFixed(3)})` });
    }
    if (lv && ent.role === 'item' && !ent.mounted) {
      const top = Math.max(...ps.map(p => p.hull.max[1])), ceil = lv.y + lv.height - 0.02;
      if (top > ceil + 0.03) out.push({ kind: 'ceiling', depth_cm: Math.round((top - ceil) * 1000) / 10, volume_cm3: 0, at: r3([ent.at[0], top, ent.at[2]]), a: refOf(ent), b: null, parts: null, rule: `its top is ${Math.round((top - ceil) * 1000) / 10} cm above the ceiling of its storey (${ceil.toFixed(3)})` });
    }
  }
  void o;
  return out;
}
