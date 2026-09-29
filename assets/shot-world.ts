// The world the spline planner v2 and QA v2 see (plan §3.1, §3.15): a THREE-free digest of the built house — its
// storeys from the spec, the entry, the Companion Core and what it sits on, the flights of stairs, and every solid
// the camera must keep out of or can see, as boxes. The page makes it from the scene it just built (digestWorld,
// with three.js injected); the Node harness reads the same JSON out of <id>.plan.json's `shots` key
// (assets/plan-export/shots.ts). Planning and QA read nothing else, so a track baked in Node from the digest is the
// track the page bakes, byte for byte (scripts/test-shot-planner.mts proves it).
//
// Every number is rounded to the millimetre when the digest is made, so the JSON round trip is exact.
//
//   boxes    flat [minX, minY, minZ, maxX, maxY, maxZ] × n, with kinds[i], names[i], colors[i] (0xRRGGBB)
//   obbs     oriented boxes (stair treads, spines and stringers; roof planes): centre, half extents, axes
//
// Kinds (K below): a wall is a solid of a wall as built at full height (piers, lintels, sills, an open door's leaf);
// glass is a pane in one (solid to the eye, clear to a sight line); an item is a whole piece of furniture's box (the
// QA gate's item-clip box) — or, within CORE_NEAR of the Core, each of its meshes, so a sight line to the Core
// threads a monitor stand and a plant as the rendered frame does; a fixture hangs from the ceiling; site is a
// planted or built thing on the lot taller than 0.25 m (a trunk, a canopy, a post, a fence, a car); walk is a
// surface to stand on outside (a deck, a step, a patio lifted off the ground); a hull is the whole box of a piece of
// furniture digested mesh by mesh, which only the clip tests read.
//
// Owner: S5 (shot). Also the box index and ray caster every S5 module shares (createWorldIndex).

export type Box6 = [number, number, number, number, number, number];
export const K = {
  wall: 1, glass: 2, item: 3, fixture: 4, stair: 5, rail: 6, site: 7, walk: 8, roof: 9,
  core: 10, surface: 11, monitor: 12, chair: 13, heroSet: 14, hull: 15,
} as const;
export const KIND_NAME: Record<number, string> = Object.fromEntries(Object.entries(K).map(([k, v]) => [v, k]));
/** within this of the Core, items are digested mesh by mesh */
export const CORE_NEAR = 3.2;

export type Rect = { x: number; z: number; w: number; d: number };
export type WPart = { a: [number, number]; b: [number, number]; door: number | null; doorW: number; h: number };
export type WRoom = { no: string; name: string; program: string | null; b: Rect; items: Array<{ type: string; at: [number, number]; rot: number }> };
export type WLevel = { id: string; y: number; h: number; rects: Rect[]; voids: Rect[]; parts: WPart[]; rooms: WRoom[]; openings: any[] };
export type WStair = {
  from: string; to: string; type: string; bottom: [number, number, number]; top: [number, number, number]; dir: [number, number]; plan: { minX: number; maxX: number; minZ: number; maxZ: number }; spiral: boolean; w: number;
  /** S2's walking line for a flight that turns (an L, a U) or is one of several: [x, y (world), z] from the first step to the last;
   *  `dir` is then the heading off the top and `dir0` the heading of the first flight (S2's anchors.stairs, Completeness A2) */
  path?: Array<[number, number, number]>; dir0?: [number, number]; shape?: string;
  /** a spiral's treads as built: the angle of the first tread round the column (atan2(dx, dz), radians), and how far the treads turn to the
   *  last one (signed: + is the direction of increasing angle) — the helix the eye climbs follows them */
  spin?: { a0: number; sweep: number };
};
export type WObb = { c: [number, number, number]; h: [number, number, number]; ax: [number, number, number, number, number, number, number, number, number]; k: number; n: string };
/** a hinged leaf the shot can swing (anchors.doors from S1's kit-build.ts collectDoors): the hinge in plan, the leaf's heading
 *  (degrees, 0 = +z, of its free edge from the hinge) closed and open, and the pivot's own rotation.y at each (radians) —
 *  what the track's `doors` channel is written in */
export type WDoor = {
  id: string; level: string | null; kind: string; leaf: string; hinge: [number, number]; y0: number; h: number; w: number;
  closedYaw: number; openYaw: number; closedAngle: number | null; openAngle: number | null; swing: string | null; open: boolean;
};
export type WHero = {
  x: number; y: number; z: number; level: string; fwd: [number, number]; surface: string; pose: string; centre: [number, number, number];
  core: Box6; surfaceBox: Box6 | null; monitor: Box6 | null; chair: Box6 | null; deskX: number; deskZ: number; chairPose: string | null;
};
export type ShotWorld = {
  v: 1; id: string;
  lot: { w: number; d: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  levels: WLevel[];
  entry: { x: number; y: number; z: number; out: [number, number]; w: number; level: string; side: string } | null;
  hero: WHero | null;
  stairs: WStair[];
  boxes: number[]; kinds: number[]; names: string[]; colors: number[];
  obbs: WObb[];
  paths: Array<{ pts: Array<[number, number]>; w: number }>;
  steps: Array<{ at: [number, number]; rot: number; n: number; w: number; y: number }>;
  showcase: string[];
  /** the leaves that can be swung (absent when the house has no door anchors) */
  doors?: WDoor[];
};

// ---- helpers shared by the S5 modules (THREE-free) -------------------------------------------------------------
export const DEG = Math.PI / 180;
export const mm = (v: number) => Math.round(v * 1000) / 1000;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** fnv1a and mulberry32 exactly as assets/materials.ts has them (not imported: that module pulls in the textures) */
export function fnv1a(str: string) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
export function mulberry32(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const inRect = (x: number, z: number, r: Rect, tol = 0) => x >= r.x - tol && x <= r.x + r.w + tol && z >= r.z - tol && z <= r.z + r.d + tol;
export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** a door's leaf in plan: the hinge, the free edge (closed, or at `yawDeg`), and the leaf's unit direction — a heading in
 *  degrees is 0 at +z, turning toward +x */
export function leafSegment(d: { hinge: [number, number]; w: number; closedYaw: number }, yawDeg: number = d.closedYaw): { a: [number, number]; b: [number, number]; dir: [number, number] } {
  const dir: [number, number] = [Math.sin(yawDeg * Math.PI / 180), Math.cos(yawDeg * Math.PI / 180)];
  return { a: d.hinge, b: [d.hinge[0] + dir[0] * d.w, d.hinge[1] + dir[1] * d.w], dir };
}
/** is (x, z) inside the union of `rects` shrunk by `margin` (rects that share an edge count as one: a point on the
 *  shared edge is inside) — each corner of the margin square inside some rect */
export const inFootprint = (rects: Rect[], x: number, z: number, margin = 0) => {
  if (margin <= 0) return rects.some(r => inRect(x, z, r, 1e-3 - margin));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) if (!rects.some(r => inRect(x + dx * margin, z + dz * margin, r, 1e-3))) return false;
  return true;
};

// ---- the digest (page side: three.js injected) -----------------------------------------------------------------
/** Make the world from the house the page just built. Reads the scene, changes nothing it does not put back. */
export function digestWorld(THREE: any, spec: any, anchors: any, placed: any[]): ShotWorld {
  const boxes: number[] = [], kinds: number[] = [], names: string[] = [], colors: number[] = [], obbs: WObb[] = [];
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  const colorOf = (m: any) => { const mat = Array.isArray(m.material) ? m.material[0] : m.material; return mat && mat.color ? mat.color.getHex() : 0x808080; };
  const isGlass = (m: any) => { const mat = Array.isArray(m.material) ? m.material[0] : m.material; return !!mat && ((mat.transparent && mat.opacity < 0.7) || (mat.transmission || 0) > 0.3); };
  const push = (b: any, k: number, n: string, c: number) => {
    if (b.isEmpty()) return;
    boxes.push(mm(b.min.x), mm(b.min.y), mm(b.min.z), mm(b.max.x), mm(b.max.y), mm(b.max.z)); kinds.push(k); names.push(n); colors.push(c);
  };
  const pushObb = (m: any, k: number, n: string) => {
    const g = m.geometry; if (!g) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const lb = g.boundingBox; if (!lb || lb.isEmpty()) return;
    const e = m.matrixWorld.elements;
    const cx = (lb.min.x + lb.max.x) / 2, cy = (lb.min.y + lb.max.y) / 2, cz = (lb.min.z + lb.max.z) / 2;
    v.set(cx, cy, cz).applyMatrix4(m.matrixWorld);
    const ax: number[] = [], h: number[] = [];
    for (let c = 0; c < 3; c++) {
      const X = e[4 * c], Y = e[4 * c + 1], Z = e[4 * c + 2], s = Math.hypot(X, Y, Z) || 1;
      ax.push(mm(X / s), mm(Y / s), mm(Z / s));
      h.push(mm(Math.max(0.005, ((c === 0 ? lb.max.x - lb.min.x : c === 1 ? lb.max.y - lb.min.y : lb.max.z - lb.min.z) * s) / 2)));
    }
    obbs.push({ c: [mm(v.x), mm(v.y), mm(v.z)], h: h as any, ax: ax as any, k, n });
  };
  const core = placed.find(o => o.userData && o.userData.role === 'hero') || null;
  const heroA = anchors.hero;
  const nearCore = (b: any) => !!core && !!heroA && Math.max(b.min.x - heroA.x, 0, heroA.x - b.max.x) ** 2 + Math.max(b.min.z - heroA.z, 0, heroA.z - b.max.z) ** 2 < CORE_NEAR * CORE_NEAR;
  // every mesh's world box — an InstancedMesh (a bed's plants, a crown's leaf clusters) as its instances' boxes,
  // merged per 0.6 m cell (one box over a whole bed would reach through the wall it is planted against)
  const _m = new THREE.Matrix4(), _b = new THREE.Box3();
  const meshBoxes = (m: any, fn: (b: any) => void) => {
    if (!m.isInstancedMesh) { bb.setFromObject(m); fn(bb); return; }
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const cells = new Map<string, any>();
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, _m); _m.premultiply(m.matrixWorld);
      _b.copy(g.boundingBox).applyMatrix4(_m); if (_b.isEmpty()) continue;
      const key = `${Math.floor((_b.min.x + _b.max.x) / 1.2)},${Math.floor((_b.min.z + _b.max.z) / 1.2)}`;
      const c = cells.get(key); if (c) c.union(_b); else cells.set(key, _b.clone());
    }
    for (const k of [...cells.keys()].sort()) fn(cells.get(k));
  };
  const meshes = (o: any, fn: (m: any) => void) => o.traverse((m: any) => { if (m.isMesh && m.geometry) fn(m); });
  // a door leaf the shot can swing (a pivot carrying userData.door) is not a wall: the track opens it ahead of the eye, so the
  // world the planner routes and sees through has the doorway clear
  const posable = new Set<any>((anchors.doors || []).filter((d: any) => d && d.pivot).map((d: any) => d.pivot));
  const inLeaf = (m: any) => { for (let q = m; q; q = q.parent) if (posable.has(q)) return true; return false; };
  let coreBox: Box6 | null = null, surfaceBox: Box6 | null = null, monitorBox: Box6 | null = null, chairBox: Box6 | null = null;
  const b6 = (b: any): Box6 => [mm(b.min.x), mm(b.min.y), mm(b.min.z), mm(b.max.x), mm(b.max.y), mm(b.max.z)];

  for (const o of placed) {
    const ud = o.userData || {}, role = ud.role || 'item';
    if (role === 'ground' || role === 'floor' || role === 'ceiling') continue;
    // a wall scaled for the editor's cutaway: measured at full height, then put back exactly as it was
    const sy = o.scale.y;
    if (role === 'wall' && sy !== 1 && !ud.fullGroup) { o.scale.y = 1; }
    o.updateMatrixWorld(true);
    try {
      if (role === 'wall') {
        meshes(ud.fullGroup || o, m => { if (posable.size && inLeaf(m)) return; meshBoxes(m, b => push(b, isGlass(m) ? K.glass : K.wall, o.name || 'wall', colorOf(m))); });
      } else if (role === 'structure') {
        if (ud.stair) meshes(o, m => { pushObb(m, K.stair, o.name || 'stairs'); });
        else meshes(o, m => meshBoxes(m, b => { if (b.max.y - b.min.y > 0.1) push(b, isGlass(m) ? K.glass : K.rail, o.name || 'structure', colorOf(m)); }));
      } else if (role === 'roof') {
        meshes(o, m => pushObb(m, K.roof, o.name || 'roof'));
      } else if (role === 'site') {
        meshes(o, m => meshBoxes(m, b => {
          const h = b.max.y - b.min.y;
          if (h > 0.25) push(b, K.site, ud.itemType || ud.siteType || o.name || 'site', colorOf(m));
          else if (b.max.y > 0.08 && Math.max(b.max.x - b.min.x, b.max.z - b.min.z) > 0.25) push(b, K.walk, ud.siteType || o.name || 'walk', colorOf(m));
        }));
      } else if (role === 'hero' || o === core) {
        // the Core's own box: its meshes, not the glow decal spread on the surface under it
        const cb = new THREE.Box3();
        meshes(o, m => { if (/glow/i.test(m.name || '')) return; bb.setFromObject(m); cb.union(bb); });
        if (!cb.isEmpty()) { coreBox = b6(cb); push(cb, K.core, 'Companion Core', 0xe7e3dc); }
      } else {
        // furniture and fixtures: the whole object's box (the QA gate's item test) — or, near the Core, mesh by mesh
        bb.setFromObject(o); if (bb.isEmpty()) continue;
        const name = ud.itemType || o.name || 'item';
        // a wire hung across a space (string lights, bunting) is a box of air with a thin line in it: nothing the eye
        // can collide with or be hidden by
        if (/string-lights|bunting|garland|wind-chime/i.test(name)) continue;
        let k: number = role === 'fixture' ? K.fixture : K.item;
        // the hero set: its surface by name; on a desk, the chair and the monitor where hero-build.ts stands them
        const near = (px: number, pz: number) => Math.hypot((bb.min.x + bb.max.x) / 2 - px, (bb.min.z + bb.max.z) / 2 - pz) < 0.45;
        if (/^Hero (Desk|Credenza|Island|Shelf)/.test(o.name || '')) { k = K.surface; surfaceBox = b6(bb); }
        else if (/^Hero |^Books$/.test(o.name || '') && nearCore(bb)) k = K.heroSet;
        else if (heroA && heroA.surface === 'desk' && /monitor/i.test(o.name || '') && near((heroA.deskX ?? heroA.x) - heroA.fwd[0] * 0.1, (heroA.deskZ ?? heroA.z) - heroA.fwd[1] * 0.1)) { k = K.monitor; monitorBox = b6(bb); }
        else if (heroA && heroA.surface === 'desk' && /chair/i.test(o.name || '') && near((heroA.deskX ?? heroA.x) + heroA.fwd[0] * 0.8, (heroA.deskZ ?? heroA.z) + heroA.fwd[1] * 0.8)) { k = K.chair; chairBox = b6(bb); }
        if (bb.max.y - bb.min.y < 0.1 && k === K.item) continue;   // rugs: part of the floor
        // near the Core (and for the hero set) mesh by mesh for sight lines, plus the whole box as a hull that only the
        // clip tests read — the QA gate's item-clip box, as v1 has it
        if (nearCore(bb) || k !== K.item) { if (k === K.item || k === K.fixture) push(bb, K.hull, name, 0); meshes(o, m => meshBoxes(m, b => { if (!b.isEmpty() && b.max.y - b.min.y > 0.02) push(b, k, name, colorOf(m)); })); }
        else { let c = 0x808080; o.traverse((m: any) => { if (c === 0x808080 && m.isMesh) c = colorOf(m); }); push(bb, k, name, c); }
      }
    } finally {
      if (o.scale.y !== sy) { o.scale.y = sy; o.updateMatrixWorld(true); }
    }
  }

  // the storeys, rooms and stairs from the spec and the anchors
  const levels: WLevel[] = (spec.levels || []).map((l: any) => ({
    id: l.id, y: l.y || 0, h: l.height || 2.8, rects: (l.footprint || []).map((r: any) => ({ x: r.x, z: r.z, w: r.w, d: r.d })),
    voids: (l.voids || []).map((r: any) => ({ x: r.x, z: r.z, w: r.w, d: r.d })),
    parts: (l.partitions || []).map((p: any) => ({ a: [p.from[0], p.from[1]], b: [p.to[0], p.to[1]], door: p.door === undefined ? null : p.door, doorW: p.doorW || 0.9, h: p.height || (l.height || 2.8) - 0.1 })),
    rooms: (l.rooms || []).map((r: any) => ({ no: String(r.no ?? ''), name: r.name || '', program: r.program || null, b: r.bounds, items: (r.items || []).filter((it: any) => Array.isArray(it.at)).map((it: any) => ({ type: it.type, at: [it.at[0], it.at[1]], rot: it.rot || 0 })) })),
    openings: (l.openings || []).map((o: any) => ({ side: o.side, at: o.at, type: o.type, w: o.w, h: o.h, sill: o.sill, style: o.style })),
  }));
  const stairs: WStair[] = (anchors.stairs || []).map((s: any, i: number) => {
    const lv = (spec.levels || []).find((l: any) => l.id === s.from) || {};
    const st = lv.stairs || {};
    const spiral = Math.hypot(s.top[0] - s.bottom[0], s.top[2] - s.bottom[2]) < 0.1;
    return { from: s.from, to: s.to, type: st.type || (spiral ? 'spiral' : 'timber'), bottom: s.bottom.map(mm), top: s.top.map(mm), dir: [mm(s.dir[0]), mm(s.dir[1])],
      plan: s.plan ? { minX: mm(s.plan.minX), maxX: mm(s.plan.maxX), minZ: mm(s.plan.minZ), maxZ: mm(s.plan.maxZ) } : null, spiral, w: st.w || (st.type === 'colonial' ? 1.2 : 1.1),
      ...(Array.isArray(s.path) && s.path.length >= 2 && !spiral ? { path: s.path.map((q: number[]) => [mm(q[0]), mm(q[1]), mm(q[2])] as [number, number, number]) } : {}),
      ...(Array.isArray(s.dir0) ? { dir0: [mm(s.dir0[0]), mm(s.dir0[1])] as [number, number] } : {}), ...(s.shape ? { shape: String(s.shape) } : {}) };
  });
  // a spiral's treads are thin slabs round its column: their angles and heights say which way it winds and how far
  for (const st of stairs) {
    if (!st.spiral) continue;
    const cx = st.bottom[0], cz = st.bottom[2];
    const treads = obbs.filter(o => o.k === K.stair && o.h[1] < 0.06 && Math.max(o.h[0], o.h[2]) > 0.25 && Math.hypot(o.c[0] - cx, o.c[2] - cz) > 0.15 && Math.hypot(o.c[0] - cx, o.c[2] - cz) < 1.6 && o.c[1] > st.bottom[1] - 0.05 && o.c[1] < st.top[1] + 0.3)
      .sort((a, b) => a.c[1] - b.c[1]);
    if (treads.length < 6) continue;
    let a = Math.atan2(treads[0].c[0] - cx, treads[0].c[2] - cz); const a0 = a; let sweep = 0;
    for (const t of treads.slice(1)) { const b = Math.atan2(t.c[0] - cx, t.c[2] - cz); sweep += Math.atan2(Math.sin(b - a), Math.cos(b - a)); a = b; }
    st.spin = { a0: mm(a0), sweep: mm(sweep) };
  }
  const e = anchors.entry;
  const hero: WHero | null = heroA && coreBox ? {
    x: mm(heroA.x), y: mm(heroA.y), z: mm(heroA.z), level: heroA.level, fwd: [mm(heroA.fwd[0]), mm(heroA.fwd[1])], surface: heroA.surface || 'desk', pose: heroA.pose || 'prone',
    centre: [mm(heroA.x), mm(heroA.centreY ?? heroA.y + 0.05), mm(heroA.z)], core: (heroA.coreBox && heroA.coreBox.length === 6 ? heroA.coreBox.map(mm) : coreBox) as Box6,
    surfaceBox, monitor: monitorBox, chair: chairBox, deskX: mm(heroA.deskX ?? heroA.x), deskZ: mm(heroA.deskZ ?? heroA.z),
    chairPose: (spec.hero && spec.hero.chair && typeof spec.hero.chair === 'object' ? spec.hero.chair.pose : null) || null,
  } : null;
  const b = anchors.bounds || { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };
  const doors: WDoor[] = (anchors.doors || []).filter((d: any) => d && Array.isArray(d.hinge)).map((d: any) => {
    const ud = d.pivot && d.pivot.userData && d.pivot.userData.door;
    return { id: String(d.id), level: d.level ?? null, kind: d.kind || 'interior', leaf: d.leaf || 'single', hinge: [mm(d.hinge[0]), mm(d.hinge[1])], y0: mm(d.y0 || 0), h: mm(d.h || 2.05), w: mm(d.w || 0.9),
      closedYaw: +(+d.closedYaw || 0).toFixed(1), openYaw: +(+d.openYaw || 0).toFixed(1), closedAngle: ud && typeof ud.closedAngle === 'number' ? mm(ud.closedAngle) : null, openAngle: ud && typeof ud.openAngle === 'number' ? mm(ud.openAngle) : null,
      swing: d.swing || null, open: !!d.open };
  });
  return {
    v: 1, id: spec.id,
    lot: { w: (spec.lot || {}).w || 30, d: (spec.lot || {}).d || 24 },
    bounds: { minX: mm(b.minX), maxX: mm(b.maxX), minZ: mm(b.minZ), maxZ: mm(b.maxZ) },
    levels, stairs, hero,
    entry: e ? { x: mm(e.x), y: mm(e.y), z: mm(e.z), out: [mm(e.out[0]), mm(e.out[1])], w: e.width || 1, level: e.level, side: e.side } : null,
    boxes, kinds, names, colors, obbs,
    paths: (spec.site || []).filter((s: any) => s.type === 'path' && Array.isArray(s.path) && s.path.length >= 2).map((s: any) => ({ pts: s.path.map((p: any) => [p[0], p[1]]), w: s.w || 1.2 })),
    steps: (spec.site || []).filter((s: any) => s.type === 'steps' && Array.isArray(s.at)).map((s: any) => ({ at: [s.at[0], s.at[1]], rot: s.rot || 0, n: s.n || 3, w: s.w || 1.6, y: s.y || 0 })),
    showcase: Array.isArray(spec.showcase) ? spec.showcase.slice() : [],
    ...(doors.length ? { doors } : {}),
  };
}

// ---- the index: boxes on a 1 m plan grid, point queries and a ray caster ---------------------------------------
export type Hit = { t: number; i: number; k: number; n: string; nx: number; ny: number; nz: number; obb?: boolean };
export type WorldIndex = ReturnType<typeof createWorldIndex>;

export function createWorldIndex(world: ShotWorld) {
  const B = world.boxes, n = world.kinds.length, CELL = 1;
  // the grid covers every box and OBB
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, B[6 * i]); minZ = Math.min(minZ, B[6 * i + 2]); maxX = Math.max(maxX, B[6 * i + 3]); maxZ = Math.max(maxZ, B[6 * i + 5]); }
  const obbAabb = world.obbs.map(o => {
    const ex = [0, 1, 2].map(r => Math.abs(o.ax[r]) * o.h[0] + Math.abs(o.ax[3 + r]) * o.h[1] + Math.abs(o.ax[6 + r]) * o.h[2]);
    return [o.c[0] - ex[0], o.c[1] - ex[1], o.c[2] - ex[2], o.c[0] + ex[0], o.c[1] + ex[1], o.c[2] + ex[2]];
  });
  for (const a of obbAabb) { minX = Math.min(minX, a[0]); minZ = Math.min(minZ, a[2]); maxX = Math.max(maxX, a[3]); maxZ = Math.max(maxZ, a[5]); }
  if (!Number.isFinite(minX)) { minX = -1; minZ = -1; maxX = 1; maxZ = 1; }
  minX = Math.floor(minX) - 1; minZ = Math.floor(minZ) - 1; maxX = Math.ceil(maxX) + 1; maxZ = Math.ceil(maxZ) + 1;
  const W = Math.max(1, Math.round((maxX - minX) / CELL)), H = Math.max(1, Math.round((maxZ - minZ) / CELL));
  const cells: number[][] = Array.from({ length: W * H }, () => []);   // box i ≥ 0, OBB j as −1 − j
  const put = (id: number, x0: number, z0: number, x1: number, z1: number) => {
    const i0 = Math.max(0, Math.floor((x0 - minX) / CELL)), i1 = Math.min(W - 1, Math.floor((x1 - minX) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - minZ) / CELL)), j1 = Math.min(H - 1, Math.floor((z1 - minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * W + i].push(id);
  };
  for (let i = 0; i < n; i++) put(i, B[6 * i], B[6 * i + 2], B[6 * i + 3], B[6 * i + 5]);
  obbAabb.forEach((a, j) => put(-1 - j, a[0], a[2], a[3], a[5]));
  const stamp = new Uint32Array(n + world.obbs.length); let ray = 0;
  // a planted thing whose box stands inside a storey (a host tree's crown through a treehouse, a crown's box that
  // reaches through the wall it grows against): the eye indoors neither collides with it nor has its view blocked
  const siteInside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (world.kinds[i] !== K.site) continue;
    const cx = (B[6 * i] + B[6 * i + 3]) / 2, cz = (B[6 * i + 2] + B[6 * i + 5]) / 2;
    for (const l of world.levels) if (B[6 * i + 4] > l.y + 0.3 && B[6 * i + 1] < l.y + l.h && (inFootprint(l.rects, cx, cz) || l.rects.some(r => B[6 * i] < r.x + r.w - 0.3 && B[6 * i + 3] > r.x + 0.3 && B[6 * i + 2] < r.z + r.d - 0.3 && B[6 * i + 5] > r.z + 0.3))) { siteInside[i] = 1; break; }
  }
  const cellAt = (x: number, z: number) => { const i = Math.floor((x - minX) / CELL), j = Math.floor((z - minZ) / CELL); return i < 0 || j < 0 || i >= W || j >= H ? null : cells[j * W + i]; };

  // a point in an OBB, padded
  const inObb = (o: WObb, x: number, y: number, z: number, pad = 0) => {
    const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2];
    for (let a = 0; a < 3; a++) { const d = dx * o.ax[3 * a] + dy * o.ax[3 * a + 1] + dz * o.ax[3 * a + 2]; if (Math.abs(d) > o.h[a] + pad) return false; }
    return true;
  };
  /** every box / OBB (as −1 − j) whose (padded) volume holds the point, among `mask` kinds */
  function pointHits(x: number, y: number, z: number, mask: (k: number) => number | false, out: number[] = []) {
    const c = cellAt(x, z); if (!c) return out;
    for (const id of c) {
      if (id >= 0) {
        const pad = mask(world.kinds[id]); if (pad === false) continue;
        if (x >= B[6 * id] - pad && x <= B[6 * id + 3] + pad && y >= B[6 * id + 1] - pad && y <= B[6 * id + 4] + pad && z >= B[6 * id + 2] - pad && z <= B[6 * id + 5] + pad) out.push(id);
      } else {
        const o = world.obbs[-1 - id], pad = mask(o.k); if (pad === false) continue;
        if (inObb(o, x, y, z, pad)) out.push(id);
      }
    }
    return out;
  }
  /** distance in plan from (x, z) to the nearest box among `mask` kinds whose height band meets [y0, y1] (capped at `max`) */
  function planDistance(x: number, z: number, y0: number, y1: number, mask: (k: number) => boolean, max = 1.5) {
    let best = max;
    const r = Math.ceil(max / CELL);
    const ci = Math.floor((x - minX) / CELL), cj = Math.floor((z - minZ) / CELL);
    ray++;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      for (const id of cells[j * W + i]) {
        const s = id >= 0 ? id : n + (-1 - id); if (stamp[s] === ray) continue; stamp[s] = ray;
        let bx0, by0, bz0, bx1, by1, bz1, k;
        if (id >= 0) { k = world.kinds[id]; bx0 = B[6 * id]; by0 = B[6 * id + 1]; bz0 = B[6 * id + 2]; bx1 = B[6 * id + 3]; by1 = B[6 * id + 4]; bz1 = B[6 * id + 5]; }
        else { const a = obbAabb[-1 - id]; k = world.obbs[-1 - id].k; bx0 = a[0]; by0 = a[1]; bz0 = a[2]; bx1 = a[3]; by1 = a[4]; bz1 = a[5]; }
        if (!mask(k) || by1 < y0 || by0 > y1) continue;
        const d = Math.hypot(Math.max(bx0 - x, 0, x - bx1), Math.max(bz0 - z, 0, z - bz1));
        if (d < best) best = d;
      }
    }
    return best;
  }
  // slab test against an AABB: entry t (or 0 when the origin is inside) and the face normal's axis and sign, into `slabOut`
  // (no allocation: the ray caster calls this thousands of times a plan)
  const slabOut = { t: 0, ax: -1, sg: 0 };
  const slab = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b0: number, b1: number, b2: number, b3: number, b4: number, b5: number, tmax: number) => {
    let t0 = 0, t1 = tmax, nAx = -1, nSg = 0;
    // x
    if (Math.abs(dx) < 1e-12) { if (ox < b0 || ox > b3) return null; }
    else { let ta = (b0 - ox) / dx, tb = (b3 - ox) / dx, sg = -1; if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; } if (ta > t0) { t0 = ta; nAx = 0; nSg = sg; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
    // y
    if (Math.abs(dy) < 1e-12) { if (oy < b1 || oy > b4) return null; }
    else { let ta = (b1 - oy) / dy, tb = (b4 - oy) / dy, sg = -1; if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; } if (ta > t0) { t0 = ta; nAx = 1; nSg = sg; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
    // z
    if (Math.abs(dz) < 1e-12) { if (oz < b2 || oz > b5) return null; }
    else { let ta = (b2 - oz) / dz, tb = (b5 - oz) / dz, sg = -1; if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; } if (ta > t0) { t0 = ta; nAx = 2; nSg = sg; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
    slabOut.t = t0; slabOut.ax = nAx; slabOut.sg = nSg;
    return slabOut;
  };
  /** the first solid a ray meets within tmax (d unit), among `mask` kinds; null for none */
  function raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number, mask: (k: number) => boolean, skip?: (i: number) => boolean): Hit | null {
    ray++;
    let best: Hit | null = null;
    // 2D DDA over the plan cells
    let x = ox, z = oz, i = Math.floor((x - minX) / CELL), j = Math.floor((z - minZ) / CELL);
    const stepI = dx > 0 ? 1 : -1, stepJ = dz > 0 ? 1 : -1;
    const hz = Math.hypot(dx, dz);
    const tdx = Math.abs(dx) > 1e-12 ? CELL / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-12 ? CELL / Math.abs(dz) : Infinity;
    let tx = Math.abs(dx) > 1e-12 ? ((dx > 0 ? (i + 1) * CELL + minX - x : x - (i * CELL + minX)) / Math.abs(dx)) : Infinity;
    let tz = Math.abs(dz) > 1e-12 ? ((dz > 0 ? (j + 1) * CELL + minZ - z : z - (j * CELL + minZ)) / Math.abs(dz)) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 4096; guard++) {
      if (i >= 0 && j >= 0 && i < W && j < H) {
        for (const id of cells[j * W + i]) {
          const s = id >= 0 ? id : n + (-1 - id); if (stamp[s] === ray) continue; stamp[s] = ray;
          if (id >= 0) {
            const k = world.kinds[id]; if (!mask(k) || (skip && skip(id))) continue;
            const r = slab(ox, oy, oz, dx, dy, dz, B[6 * id], B[6 * id + 1], B[6 * id + 2], B[6 * id + 3], B[6 * id + 4], B[6 * id + 5], best ? best.t : tmax);
            if (r && (!best || r.t < best.t)) best = { t: r.t, i: id, k, n: world.names[id], nx: r.ax === 0 ? r.sg : 0, ny: r.ax === 1 ? r.sg : 0, nz: r.ax === 2 ? r.sg : 0 };
          } else {
            const o = world.obbs[-1 - id]; if (!mask(o.k)) continue;
            // into the OBB's frame
            const px = ox - o.c[0], py = oy - o.c[1], pz = oz - o.c[2], A = o.ax;
            const r = slab(px * A[0] + py * A[1] + pz * A[2], px * A[3] + py * A[4] + pz * A[5], px * A[6] + py * A[7] + pz * A[8],
              dx * A[0] + dy * A[1] + dz * A[2], dx * A[3] + dy * A[4] + dz * A[5], dx * A[6] + dy * A[7] + dz * A[8], -o.h[0], -o.h[1], -o.h[2], o.h[0], o.h[1], o.h[2], best ? best.t : tmax);
            if (r && (!best || r.t < best.t)) {
              const a = r.ax < 0 ? 1 : r.ax, sg = r.ax < 0 ? 1 : r.sg;
              best = { t: r.t, i: -1 - (-1 - id), k: o.k, n: o.n, nx: o.ax[3 * a] * sg, ny: o.ax[3 * a + 1] * sg, nz: o.ax[3 * a + 2] * sg, obb: true };
            }
          }
        }
      }
      if (best && best.t <= tCell) break;
      if (tCell > tmax) break;
      if (hz < 1e-12) break;
      if (tx < tz) { tCell = tx; tx += tdx; i += stepI; } else { tCell = tz; tz += tdz; j += stepJ; }
      if (best && best.t <= tCell) break;
      if (i < -1 || j < -1 || i > W || j > H) { if ((stepI > 0 && i > W) || (stepI < 0 && i < -1) || (stepJ > 0 && j > H) || (stepJ < 0 && j < -1)) break; }
    }
    return best && best.t <= tmax ? best : null;
  }
  return { world, pointHits, planDistance, raycast, inObb, siteInside, box: (i: number) => B.slice(6 * i, 6 * i + 6) as Box6, count: n };
}

// ---- the storeys as planes: floors, ceilings, the ground -------------------------------------------------------
/** the level whose storey the point is in (its footprint, between its floor − 0.25 and its ceiling + 0.25), or null */
export function levelAt(world: ShotWorld, x: number, y: number, z: number, tol = 0.05) {
  let best = null;
  for (const l of world.levels) if (y >= l.y - 0.25 && y <= l.y + l.h + 0.25 && l.rects.some(r => inRect(x, z, r, tol))) { if (!best || l.y > best.y) best = l; }
  return best as WLevel | null;
}
/** is the point indoors (in some storey's footprint, between its floor and its ceiling)? */
export function indoors(world: ShotWorld, x: number, y: number, z: number) {
  for (const l of world.levels) if (y >= l.y - 0.05 && y <= l.y + l.h + 0.1 && l.rects.some(r => inRect(x, z, r, 0.02))) return true;
  return false;
}
/** a ray against the floors and ceilings of every storey, and the lot's ground: { t, kind: 'floor'|'ceiling'|'ground', level } or null */
export function rayPlanes(world: ShotWorld, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number) {
  let best: any = null;
  if (Math.abs(dy) < 1e-9) return null;
  const test = (y: number, kind: string, l: WLevel | null, rects: Rect[] | null, voids: Rect[] | null) => {
    const t = (y - oy) / dy; if (t <= 1e-4 || t > tmax || (best && t >= best.t)) return;
    const x = ox + dx * t, z = oz + dz * t;
    if (rects && !rects.some(r => inRect(x, z, r))) return;
    if (voids && voids.some(r => inRect(x, z, r))) return;
    best = { t, kind, level: l ? l.id : null };
  };
  for (const l of world.levels) {
    if (dy < 0) test(l.y, 'floor', l, l.rects, l.y > 0.05 ? l.voids : null);
    else {
      // a storey's ceiling is open where the storey over it has a void (a stairwell, a double-height room)
      const above = world.levels.find(u => u.y > l.y + 0.5 && u.y <= l.y + l.h + 0.6);
      test(l.y + l.h, 'ceiling', l, l.rects, above ? above.voids : null);
    }
  }
  if (dy < 0) test(0, 'ground', null, null, null);
  return best;
}
