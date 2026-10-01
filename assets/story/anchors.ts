// Anchor resolution: a story beat names a ROLE ("couch", "range", "garden"), never a coordinate; this module turns the role into a
// thing in the built house. It reads only the THREE-free digest the planner already reads (the ShotWorld in <id>.plan.json's
// `shots.world`) plus the spec's lot list (the flat zones, a deck or a pool, are too low to be boxes in the digest) and roles.json.
//
//   instances(role)   every piece of the house that answers the role, in a STABLE order: type preference (roles.json lists), then
//                     the rooms the role lives in (a couch in the living room before one in a bedroom), then storey, then the
//                     spec's own order. `anchor.nth` indexes that list; `anchor.room` narrows it first.
//   resolveAnchor     the first leaf of the chain (role, then each fallback in order) that has an instance at `nth`.
//   resolveChain      all the candidates the pose solver may try, in order (the primary's instances, then each fallback's), capped.
//
// Pure and deterministic; shared by the bake (Node), the validator (Node) and anything in the page that wants to know what a role is.
// Owner: story-bake.
import { K, inRect, type ShotWorld, type Box6, type WRoom, type WLevel } from '../shot-world.js';
import type { AnchorLeaf, AnchorRef, RoleId, RoomRole } from './types.js';
import { type RolesTable, isBuiltinRole, roomHasRole, typesFor, homeRooms } from './roles.js';

// ---- the lot's flat zones, from the spec -------------------------------------------------------------------------------
/** a spec.site entry as a ground box (type, box, index in spec.site) */
export type SiteZone = { type: string; box: Box6; index: number; y: number };
/** default height (m) of a zone's box by type; the spec's own `h` wins */
const ZONE_H: Record<string, number> = {
  deck: 0.3, patio: 0.1, porch: 0.4, terrace: 0.1, pool: 0.1, hottub: 0.8, 'turtle-pool': 0.3, pond: 0.1, driveway: 0.05, loungers: 0.9, bench: 0.9, firepit: 0.5, gazebo: 2.6,
  bed: 0.6, planter: 0.8, flowers: 0.4, 'garden-beds': 0.6, greenhouse: 2.2, monkeybars: 2.0, turf: 0.05,
};
const ZONE_SIZE: Record<string, [number, number]> = { loungers: [2.2, 1.0], bench: [1.4, 0.5], firepit: [1.6, 1.6], hottub: [2.4, 2.4], monkeybars: [2.4, 1.8], 'garden-beds': [3.0, 1.2] };
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** every spec.site entry that has a footprint, as a box. A poly's or a path's bounding box; `at` with w/d, r or a default size for the type. */
export function siteZonesFromSpec(spec: any): SiteZone[] {
  const out: SiteZone[] = [];
  (spec && spec.site || []).forEach((s: any, index: number) => {
    if (!s || !s.type) return;
    const y0 = typeof s.y === 'number' ? s.y : 0, h = typeof s.h === 'number' && s.type !== 'tree' && s.type !== 'hedge' ? s.h : (ZONE_H[s.type] ?? 0.5);
    let x0: number, x1: number, z0: number, z1: number;
    if (Array.isArray(s.poly) && s.poly.length) { x0 = Math.min(...s.poly.map((p: number[]) => p[0])); x1 = Math.max(...s.poly.map((p: number[]) => p[0])); z0 = Math.min(...s.poly.map((p: number[]) => p[1])); z1 = Math.max(...s.poly.map((p: number[]) => p[1])); }
    else if (Array.isArray(s.path) && s.path.length) { const hw = (s.w || 1) / 2; x0 = Math.min(...s.path.map((p: number[]) => p[0])) - hw; x1 = Math.max(...s.path.map((p: number[]) => p[0])) + hw; z0 = Math.min(...s.path.map((p: number[]) => p[1])) - hw; z1 = Math.max(...s.path.map((p: number[]) => p[1])) + hw; }
    else if (s.from && s.to) { x0 = Math.min(s.from[0], s.to[0]) - 0.15; x1 = Math.max(s.from[0], s.to[0]) + 0.15; z0 = Math.min(s.from[1], s.to[1]) - 0.15; z1 = Math.max(s.from[1], s.to[1]) + 0.15; }
    else if (Array.isArray(s.at)) {
      let w: number, d: number;
      if (typeof s.w === 'number' && typeof s.d === 'number') { w = s.w; d = s.d; }
      else if (typeof s.r === 'number') { w = d = s.r * 2; }
      else { const z = ZONE_SIZE[s.type] || [1.2, 1.2]; w = typeof s.w === 'number' ? s.w : z[0]; d = z[1]; }
      const quarter = typeof s.rot === 'number' && Math.abs(Math.sin((s.rot * Math.PI) / 180)) > 0.7;   // turned a quarter: w and d swap
      if (quarter) [w, d] = [d, w];
      x0 = s.at[0] - w / 2; x1 = s.at[0] + w / 2; z0 = s.at[1] - d / 2; z1 = s.at[1] + d / 2;
    } else return;
    out.push({ type: s.type, box: [r3(x0), r3(y0), r3(z0), r3(x1), r3(y0 + h), r3(z1)], index, y: y0 });
  });
  return out;
}

// ---- the anchor world -------------------------------------------------------------------------------------------------------
export type AnchorWorld = { world: ShotWorld; zones: SiteZone[]; table: RolesTable; byName: Map<string, number[]> };
/** Index the world once per house. `site` is the spec (its lot list becomes zones) or ready-made zones. */
export function createAnchorWorld(world: ShotWorld, site: any, table: RolesTable): AnchorWorld {
  const zones = Array.isArray(site) ? (site as SiteZone[]) : siteZonesFromSpec(site);
  const byName = new Map<string, number[]>();
  world.names.forEach((n, i) => { const k = world.kinds[i]; if (k === K.hull || k === K.item) { let a = byName.get(n); if (!a) byName.set(n, a = []); a.push(i); } });
  return { world, zones, table, byName };
}

// ---- instances ---------------------------------------------------------------------------------------------------------------
export type Instance = {
  role: RoleId; type: string;
  /** the piece's box (the whole of it; a zone's is capped at 6 m so a driveway is a patch of drive) */
  box: Box6;
  /** every digest box that is this piece (a hull and its meshes): the pose solver does not let them block the view of the piece */
  boxes: Box6[];
  /** the storey it stands on (null: outside, on the lot) and the ground height of an outside one */
  level: string | null; outside: boolean; y: number;
  room: WRoom | null; roomName: string | null;
  /** the way it faces in plan (a unit [x, z]), where it has one (a couch faces its rot; the Core and the door have theirs) */
  fwd: [number, number] | null;
  /** where to aim: the piece's centre, kept inside 0.3 to 1.4 m of its base so a wardrobe or a roof hood is aimed at where people look */
  aim: [number, number, number];
  /** true when the digest holds no box for the piece and its box is a guess around `at` */
  approx: boolean;
  /** the instance's place in the stable order of its role (after room narrowing) */
  order: number;
};

const mid = (b: Box6): [number, number, number] => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
const union = (bs: Box6[]): Box6 => [Math.min(...bs.map(b => b[0])), Math.min(...bs.map(b => b[1])), Math.min(...bs.map(b => b[2])), Math.max(...bs.map(b => b[3])), Math.max(...bs.map(b => b[4])), Math.max(...bs.map(b => b[5]))];
const boxOf = (w: ShotWorld, i: number): Box6 => w.boxes.slice(6 * i, 6 * i + 6) as Box6;
const aimOf = (b: Box6): [number, number, number] => { const c = mid(b); return [c[0], Math.min(b[1] + 1.4, Math.max(b[1] + 0.3, c[1])), c[2]]; };
const fwdOfRot = (rot: number): [number, number] => [Math.sin((rot * Math.PI) / 180), Math.cos((rot * Math.PI) / 180)];   // 0 faces +z; 180 faces -z (as rooms[].items[].rot)

/** a capped box around a zone's centre (a 12 m driveway is a patch of it, not all of it) */
function capBox(b: Box6, cap = 6): Box6 {
  const c = mid(b), hx = Math.min((b[3] - b[0]) / 2, cap / 2), hz = Math.min((b[5] - b[2]) / 2, cap / 2);
  return [r3(c[0] - hx), b[1], r3(c[2] - hz), r3(c[0] + hx), b[4], r3(c[2] + hz)];
}

/** the digest boxes that are one piece of furniture: the hull (or a box) that holds its `at`, with the meshes inside it; else a guess */
function pieceBoxes(aw: AnchorWorld, type: string, at: [number, number], levelY: number): { box: Box6; boxes: Box6[]; approx: boolean } {
  const { world, byName } = aw, idx = byName.get(type) || [], tol = 0.06;
  const holds = (b: Box6) => at[0] >= b[0] - tol && at[0] <= b[3] + tol && at[1] >= b[2] - tol && at[1] <= b[5] + tol;
  const around = idx.map(i => boxOf(world, i)).filter(b => holds(b) && b[4] > levelY - 0.5 && b[1] < levelY + 4);
  if (around.length) {
    // (a hull is the whole piece; take it and every same-named box inside it. Without a hull the boxes holding `at` are the piece.)
    const hullIdx = idx.filter(i => world.kinds[i] === K.hull && holds(boxOf(world, i)) && boxOf(world, i)[4] > levelY - 0.5 && boxOf(world, i)[1] < levelY + 4);
    if (hullIdx.length) { const h = boxOf(world, hullIdx[0]); const inside = idx.map(i => boxOf(world, i)).filter(b => b[0] >= h[0] - tol && b[3] <= h[3] + tol && b[2] >= h[2] - tol && b[5] <= h[5] + tol); return { box: h, boxes: inside.length ? inside : [h], approx: false }; }
    return { box: union(around), boxes: around, approx: false };
  }
  const b: Box6 = [r3(at[0] - 0.45), levelY, r3(at[1] - 0.45), r3(at[0] + 0.45), levelY + 0.8, r3(at[1] + 0.45)];
  return { box: b, boxes: [b], approx: true };
}

function levelRank(w: ShotWorld, id: string) { return Math.max(0, w.levels.findIndex(l => l.id === id)); }

/** every room of the house that is a `room` room (any level), with its level, in the stable order: bigger rooms first, then storey, then the spec's order */
function roomsWithRole(aw: AnchorWorld, room: RoomRole): Array<{ level: WLevel; room: WRoom; n: number }> {
  const out: Array<{ level: WLevel; room: WRoom; n: number }> = []; let n = 0;
  for (const l of aw.world.levels) for (const r of l.rooms) { if (roomHasRole(r.name, room, aw.table)) out.push({ level: l, room: r, n }); n++; }
  return out.sort((a, b) => (b.room.b.w * b.room.b.d - a.room.b.w * a.room.b.d) || (levelRank(aw.world, a.level.id) - levelRank(aw.world, b.level.id)) || (a.n - b.n));
}

/** the lot's frontage: where the entry's outward line leaves the lot, and the way out */
export function streetPoint(world: ShotWorld): { at: [number, number]; out: [number, number] } {
  const e = world.entry, hw = world.lot.w / 2, hd = world.lot.d / 2;
  const out: [number, number] = e && e.out ? [e.out[0], e.out[1]] : [0, 1];
  const ox = e ? e.x : 0, oz = e ? e.z : 0;
  // walk the entry's line out to the lot's edge
  const tx = out[0] > 1e-6 ? (hw - ox) / out[0] : out[0] < -1e-6 ? (-hw - ox) / out[0] : Infinity;
  const tz = out[1] > 1e-6 ? (hd - oz) / out[1] : out[1] < -1e-6 ? (-hd - oz) / out[1] : Infinity;
  const t = Math.max(1, Math.min(tx, tz));
  return { at: [r3(ox + out[0] * t), r3(oz + out[1] * t)], out };
}

/** all the instances a leaf can mean, narrowed by `room` and in the stable order (nth indexes this list) */
export function instancesOf(aw: AnchorWorld, leaf: AnchorLeaf): Instance[] {
  const { world, table } = aw, role = leaf.role;
  const base = { role, boxes: [] as Box6[], room: null as WRoom | null, roomName: null as string | null, fwd: null as [number, number] | null, approx: false, level: null as string | null, outside: false, y: 0 };
  const done = (list: Omit<Instance, 'order'>[]): Instance[] => list.map((x, order) => ({ ...x, order }));

  if (role === 'core') {
    const h = world.hero; if (!h) return [];
    const room = world.levels.find(l => l.id === h.level)?.rooms.find(r => inRect(h.x, h.z, r.b, 0.05)) || null;
    // (framed with the thing it sits on and the screen behind it: a 23 cm box alone cannot be held at any distance a camera can stand)
    const set = union([h.core, ...(h.surfaceBox ? [h.surfaceBox] : []), ...(h.monitor ? [h.monitor] : [])]);
    return done([{ ...base, type: 'core', box: set, boxes: [h.core, ...(h.surfaceBox ? [h.surfaceBox] : []), ...(h.monitor ? [h.monitor] : []), ...(h.chair ? [h.chair] : [])], level: h.level, outside: false, y: world.levels.find(l => l.id === h.level)?.y ?? 0, room, roomName: room ? room.name : null, fwd: h.fwd, aim: mid(h.core) }]);
  }
  if (role === 'front-door') {
    const e = world.entry; if (!e) return [];
    const lv = world.levels.find(l => l.id === e.level); const y0 = lv ? lv.y : e.y || 0;
    const side: [number, number] = [-e.out[1], e.out[0]], hw = (e.w || 1) / 2;
    const box: Box6 = [r3(e.x - Math.abs(side[0]) * hw - Math.abs(e.out[0]) * 0.1), y0, r3(e.z - Math.abs(side[1]) * hw - Math.abs(e.out[1]) * 0.1), r3(e.x + Math.abs(side[0]) * hw + Math.abs(e.out[0]) * 0.1), y0 + 2.1, r3(e.z + Math.abs(side[1]) * hw + Math.abs(e.out[1]) * 0.1)];
    return done([{ ...base, type: 'front-door', box, boxes: [box], level: e.level, outside: true, y: y0, fwd: [e.out[0], e.out[1]], aim: [e.x, y0 + 1.2, e.z] }]);
  }
  if (role === 'street') {
    const s = streetPoint(world), h = world.entry ? (world.levels.find(l => l.id === world.entry!.level)?.y ?? 0) : 0;
    const box: Box6 = [r3(s.at[0] - 3), 0, r3(s.at[1] - 3), r3(s.at[0] + 3), 1.2, r3(s.at[1] + 3)];
    return done([{ ...base, type: 'street', box, boxes: [box], level: null, outside: true, y: 0, fwd: [s.out[0], s.out[1]], aim: [world.entry ? world.entry.x : 0, h + 1.8, world.entry ? world.entry.z : 0] }]);
  }
  if (role === 'room') {
    if (!leaf.room) return [];
    return done(roomsWithRole(aw, leaf.room).map(({ level, room }) => {
      const b = room.b, cx = b.x + b.w / 2, cz = b.z + b.d / 2, box: Box6 = [r3(b.x), level.y, r3(b.z), r3(b.x + b.w), level.y + 1.4, r3(b.z + b.d)];
      return { ...base, type: 'room', box, boxes: [], level: level.id, outside: false, y: level.y, room, roomName: room.name, aim: [r3(cx), level.y + 0.9, r3(cz)] };
    }));
  }

  // furniture and lot items
  const tf = typesFor(role, table);
  const homes = homeRooms(role, table);
  const want = leaf.room;
  const insideOk = (rn: string | null) => !want || (rn !== null && roomHasRole(rn, want, table));
  const outsideOk = !want || want === 'garden' || want === 'patio' || want === 'street';
  type Row = Omit<Instance, 'order'> & { key: [number, number, number, number, number] };
  const rows: Row[] = [];
  let seq = 0;
  // 1. outdoor pieces on the lot (a lounger, a bench, a firepit): first, when the role is an outdoor one
  const outdoorFirst = role === 'patio-seat';
  const pushSite = (types: string[], rankBase: number) => {
    if (!outsideOk) return;
    types.forEach((t, tr) => {
      for (const z of aw.zones) if (z.type === t) {
        const area = (z.box[3] - z.box[0]) * (z.box[5] - z.box[2]);
        rows.push({ ...base, type: t, box: capBox(z.box), boxes: [z.box], level: null, outside: true, y: z.y, aim: aimOf(capBox(z.box)), key: [rankBase + tr, 0, -Math.round(area * 100), 0, seq++] });
      }
    });
  };
  const pushRooms = (types: string[]) => {
    world.levels.forEach((l, li) => l.rooms.forEach(r => {
      if (!insideOk(r.name)) return;
      const hr = homes.findIndex(h => roomHasRole(r.name, h as RoomRole, table));
      for (const it of r.items) {
        const tr = types.indexOf(it.type); if (tr < 0) continue;
        const pb = pieceBoxes(aw, it.type, it.at, l.y);
        rows.push({ ...base, type: it.type, box: pb.box, boxes: pb.boxes, level: l.id, outside: false, y: l.y, room: r, roomName: r.name, fwd: fwdOfRot(it.rot || 0), aim: aimOf(pb.box), approx: pb.approx, key: [100 + tr, hr < 0 ? 99 : hr, li, 0, seq++] });
      }
    }));
  };
  if (outdoorFirst) pushSite(tf.siteItems, 0);
  if (tf.items.length) pushRooms(tf.items);
  if (!outdoorFirst && tf.siteItems.length) pushSite(tf.siteItems, 200);
  // 2. lot zones (garden, driveway, pool, deck)
  if (tf.zones.length) pushSite(tf.zones, 0);
  // 3. rooms that are themselves the zone (a "Roof Terrace" answers deck when the spec has no deck entry)
  if (tf.zoneRooms && outsideOk) {
    const zr = new RegExp(tf.zoneRooms, 'i'); let k = 0;
    for (const l of world.levels) for (const r of l.rooms) if (zr.test(r.name)) {
      const box: Box6 = [r3(r.b.x), l.y, r3(r.b.z), r3(r.b.x + r.b.w), l.y + 0.3, r3(r.b.z + r.b.d)];
      rows.push({ ...base, type: 'terrace-room', box, boxes: [box], level: l.id, outside: false, y: l.y, room: r, roomName: r.name, aim: aimOf(capBox(box)), key: [300, 0, k++, 0, seq++] });
    }
  }
  rows.sort((a, b) => { for (let i = 0; i < 5; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i]; return 0; });
  return done(rows.map(({ key: _k, ...x }) => x));
}

// ---- resolution --------------------------------------------------------------------------------------------------------------
export type Resolved = Instance & {
  /** the leaf that answered (the beat's own role, or one of its fallbacks) */
  leaf: AnchorLeaf;
  /** 0 for the beat's own role, 1 for the first fallback, ... */
  viaFallback: number;
  /** the index among the leaf's instances, and how many it has */
  nth: number; count: number;
};
const leafOf = (ref: AnchorRef): AnchorLeaf[] => [{ role: ref.role, ...(ref.room ? { room: ref.room } : {}), ...(ref.nth !== undefined ? { nth: ref.nth } : {}) }, ...(ref.fallback || [])];

/** The first leaf of the chain that has an instance at its `nth` (0 when not given). null: the beat has lost its anchor. */
export function resolveAnchor(aw: AnchorWorld, ref: AnchorRef): Resolved | null {
  const chain = leafOf(ref);
  for (let i = 0; i < chain.length; i++) {
    const leaf = chain[i], list = instancesOf(aw, leaf), n = leaf.nth ?? 0;
    if (list[n]) return { ...list[n], leaf, viaFallback: i, nth: n, count: list.length };
  }
  return null;
}

/** The candidates the pose solver tries, in order: the leaf's own instance at `nth` first, then its other instances (at most `perLeaf`),
 *  then the next fallback. A beat whose first choice cannot be framed is better served by a sibling piece than by losing its place. */
export function resolveChain(aw: AnchorWorld, ref: AnchorRef, perLeaf = 8): Resolved[] {
  const out: Resolved[] = [], chain = leafOf(ref);
  chain.forEach((leaf, i) => {
    const list = instancesOf(aw, leaf), n = leaf.nth ?? 0;
    if (!list[n]) return;
    const order = [n, ...list.map((_, k) => k).filter(k => k !== n)].slice(0, perLeaf);
    for (const k of order) out.push({ ...list[k], leaf, viaFallback: i, nth: k, count: list.length });
  });
  return out;
}

/** how many instances each role has in this house (for the validator and the tests) */
export function roleCounts(aw: AnchorWorld, roles: readonly RoleId[], room?: RoomRole): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of roles) out[r] = instancesOf(aw, { role: r, ...(room ? { room } : {}) }).length;
  return out;
}
export { isBuiltinRole };
