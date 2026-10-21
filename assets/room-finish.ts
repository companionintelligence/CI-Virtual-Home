// Room finishes — per-room floors, wall finishes and ceilings (plan S2 task 1; 30 of 30 audits asked for them).
//
//   rooms[].floor    { kind, color?, pattern?, scale?, run? } (or just the kind): an overlay on the storey's slab, clipped to
//                    the room's bounds within the footprint, in the kit's floor sets (arch-materials.ts: S1's kit.finish
//                    when it lands). Under `defaults: 2` a room without one gets a seeded, program-appropriate floor, and
//                    rooms that touch never share one.
//   rooms[].walls    { kind?, color?, h?, lower?, feature? }: liners on the inner faces of the walls round the room —
//                    perimeter walls and partitions alike, cut round their openings — tagged role 'finish' and registered
//                    for the cutaway like the wall they line. wainscot and board-and-batten add their rails and battens;
//                    `feature` gives one wall (a side of the room, or a partition by index) its own finish.
//   rooms[].ceiling  { kind: flat | timber | beams | vault | tray | double, color?, rise?, ridge?, rail? } — built by
//                    buildCeiling() from structure-build's buildCeilings (a vault or a tray needs nothing above it; a
//                    double-height room opens the storey above: arch-plan.ts slabOpenings, and its gallery edges get rails)
//   rooms[].floorOffset  a raised platform (+) over the room's bounds; a sunken pit (−) on a storey standing at least that
//                    far above grade (its slab is opened over the pit: arch-plan.ts)
//
// Everything is built only for a room that asks (or under `defaults: 2`), so a house without these fields is unchanged.
// Owner: S2 (architecture).
import { perimeterEdges } from './house-geometry.js';
import { openingFrames, OUT, WALL_HALF, inR, slabHoles, sunkRooms, pitRects, rectLoops, subtractRects } from './arch-plan.js';
import { mulberry32, fnv1a } from './materials.js';
import { roomKind } from './fixtures.js';

type Rect = { x: number; z: number; w: number; d: number };
const clipRect = (a: Rect, b: Rect): Rect | null => { const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w), z0 = Math.max(a.z, b.z), z1 = Math.min(a.z + a.d, b.z + b.d); return x1 - x0 > 0.02 && z1 - z0 > 0.02 ? { x: x0, z: z0, w: x1 - x0, d: z1 - z0 } : null; };
export const floorOf = (room: any) => (typeof room.floor === 'string' ? { kind: room.floor } : room.floor || null);
const SIDE_ORI = { S: 'south', N: 'north', E: 'east', W: 'west' };
// the room's boundary side → the direction into the room
const INTO = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };
/** A depth bias for the liners' materials. A liner's panel ends on the same plane as the wall pier it lies on (an opening's jamb, a partition's
 *  end), and two flat faces on one plane flicker. The bias makes the liner win those planes. It is a draw state: unlike ending the panels 2 mm
 *  short it moves no box of the world digest (plan.json shots.world, and the bake locks' worldSha, are mm-rounded boxes of every liner near
 *  the Core). */
const BIAS = { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4 };

// ---- defaults: 2 — program-appropriate floors, neighbours differ --------------------------------------------------------
const PROGRAM_FLOORS = {
  kitchen: ['tile', 'checker', 'terracotta', 'stone'], bath: ['hex-tile', 'tile', 'marble'], living: ['honey-oak', 'walnut', 'herringbone', 'oak'],
  dining: ['herringbone', 'oak', 'walnut'], bed: ['oak', 'white-oak', 'carpet', 'grey-wash'], work: ['walnut', 'oak', 'cherry'],
  hall: ['stone', 'herringbone', 'pavers'], service: ['concrete'], room: ['oak', 'white-oak'],
};
/** The floor every room of a storey gets: its own, else (defaults: 2) a seeded pick for its program that its neighbours
 *  do not share. Deterministic: spec id, storey, room order. */
export function roomFloors(spec: any, lv: any, gen2: boolean) {
  const rooms = lv.rooms || [], out = new Map<any, any>();
  const touch = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -0.2 && Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) > -0.2;
  rooms.forEach((room, i) => {
    const own = floorOf(room);
    if (own) { out.set(room, own); return; }
    if (!gen2 || !room.bounds || room.bounds.w * room.bounds.d < 1.2) return;
    const kinds = PROGRAM_FLOORS[roomKind(room.name)] || PROGRAM_FLOORS.room;
    const r = mulberry32(fnv1a(`${spec.id}:${lv.id}:${room.name}:floor`));
    const taken = new Set(rooms.slice(0, i).filter(o => o.bounds && touch(o.bounds, room.bounds) && out.get(o)).map(o => out.get(o).kind));
    const start = Math.floor(r() * kinds.length);
    let kind = kinds[start];
    for (let k = 0; k < kinds.length && taken.has(kind); k++) kind = kinds[(start + k) % kinds.length];
    if (taken.has(kind)) kind = ['oak', 'walnut', 'tile', 'herringbone', 'carpet'].find(q => !taken.has(q)) || kind;
    out.set(room, { kind });
  });
  return out;
}

// ---- the walls round a room: (side, wall line, span, face, openings) ------------------------------------------------------
/** The wall segments that bound a room: perimeter edges and partitions lying on its bounds' sides */
export function roomWalls(lv: any, room: any, spec: any = null) {
  const b = room.bounds, out = [];
  if (!b) return out;
  const edges = perimeterEdges(lv.footprint || []), frames = openingFrames(lv, edges, spec);
  const sides = { N: b.z, S: b.z + b.d, W: b.x, E: b.x + b.w };
  for (const side of ['N', 'S', 'E', 'W']) {
    const horiz = side === 'N' || side === 'S', line = sides[side];
    const lo = horiz ? b.x : b.z, hi = horiz ? b.x + b.w : b.z + b.d;
    // perimeter edges on that line whose outside is the room's outside
    for (const e of edges) {
      if (e.side !== side || Math.abs((horiz ? e.a[1] : e.a[0]) - line) > 0.12) continue;
      const a0 = Math.max(lo, horiz ? e.a[0] : e.a[1]), a1 = Math.min(hi, horiz ? e.b[0] : e.b[1]);
      if (a1 - a0 < 0.1) continue;
      const holes = frames.filter(f => f.edge === e).map(f => ({ a0: (horiz ? f.cx : f.cz) - f.w / 2, a1: (horiz ? f.cx : f.cz) + f.w / 2, y0: f.sill, y1: f.top }));
      out.push({ side, line: horiz ? e.a[1] : e.a[0], a0, a1, half: WALL_HALF, kind: 'perimeter', orientation: SIDE_ORI[side], holes });
    }
    // partitions on that line
    (lv.partitions || []).forEach((p, pi) => {
      if (!Array.isArray(p.from) || !Array.isArray(p.to)) return;
      const alongX = Math.abs(p.from[1] - p.to[1]) < 1e-6;
      if (alongX !== horiz || Math.abs((horiz ? p.from[1] : p.from[0]) - line) > 0.12) return;
      const pl = Math.min(horiz ? p.from[0] : p.from[1], horiz ? p.to[0] : p.to[1]), ph = Math.max(horiz ? p.from[0] : p.from[1], horiz ? p.to[0] : p.to[1]);
      const a0 = Math.max(lo, pl), a1 = Math.min(hi, ph);
      if (a1 - a0 < 0.1) return;
      const dir = Math.sign((horiz ? p.to[0] - p.from[0] : p.to[1] - p.from[1])) || 1, f0 = horiz ? p.from[0] : p.from[1];
      const doors = [...(p.door != null ? [{ at: p.door, w: p.doorW || 0.9, h: 2.1 }] : []), ...(p.doors || []).map(d => ({ at: d.at, w: d.w || p.doorW || 0.9, h: d.h || 2.1 }))];
      const holes = doors.map(d => { const c = f0 + dir * d.at; return { a0: c - d.w / 2, a1: c + d.w / 2, y0: 0, y1: d.h }; });
      out.push({ side, line: horiz ? p.from[1] : p.from[0], a0, a1, half: 0.07, kind: 'partition', index: pi, height: p.height, style: p.style, orientation: 'partition', holes });
    });
  }
  return out;
}

/** The height of a vaulted or trayed room's ceiling over (x, z), over the flat ceiling at `flat` (absolute), or null
 *  outside the room. S1's fixtures hang from the flat ceiling; buildCeilings lifts them onto this. */
export function ownCeilingAt(room: any, flat: number, rise: number, x: number, z: number) {
  const b = room.bounds, c = room.ceiling;
  if (!b || !c || !(x > b.x && x < b.x + b.w && z > b.z && z < b.z + b.d)) return null;
  if (c.kind === 'tray') { const inset = Math.min(0.6, Math.min(b.w, b.d) * 0.18); return x > b.x + inset && x < b.x + b.w - inset && z > b.z + inset && z < b.z + b.d - inset ? flat + rise : flat; }
  if (c.kind === 'vault') {
    const ridgeX = c.ridge ? c.ridge === 'x' : b.w >= b.d, span = ridgeX ? b.d : b.w, off = ridgeX ? Math.abs(z - (b.z + b.d / 2)) : Math.abs(x - (b.x + b.w / 2));
    return flat + rise * Math.max(0, 1 - off / (span / 2));
  }
  return null;
}

/** anchors.arch.rooms: one record per finished room — { level, name, bounds, finish: { floor, floorColor, floorY, floorOffset, walls,
 *  wallColor, feature, ceiling } } — merged from whichever of floors(), walls() and the ceilings noted it first */
export function noteRoom(anchors: any, lv: any, room: any, patch: Record<string, unknown>) {
  const list = (anchors.arch.rooms ||= []);
  let rec = list.find(r => r.level === lv.id && r.name === room.name);
  if (!rec) { rec = { level: lv.id, name: room.name, bounds: room.bounds, finish: {} }; list.push(rec); }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && v !== null) rec.finish[k] = v;
  return rec;
}

export function createRoomFinish(bctx) {
  const { THREE, registerTrackedWall, registerCeiling, group } = bctx;
  const biasedOf = new WeakMap<any, Map<any, any>>();   // a house's material kit -> (a kit wall material -> its biased copy)

  // a thin panel the size of a rect, flat on the floor (world XZ), top at local y 0
  const floorPanel = (r: Rect, mat) => {
    const geo = new THREE.PlaneGeometry(r.w, r.d); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.set(r.x + r.w / 2, 0, r.z + r.d / 2); m.receiveShadow = true; return m;
  };

  // ---- floors (and raised / sunken platforms) --------------------------------------------------------------------------
  // A room's floor is an overlay on the storey's slab: its bounds inside the footprint, less every hole the slab has (its
  // voids, a flight's autoVoid, the double-height rooms under it: arch-plan.ts slabHoles) — a floor laid across the
  // stairwell would seal it. A sunken room's slab is opened over its pit (arch-plan.ts sunkRooms), and the pit has its own floor.
  function floors({ spec, lv, y, put, am, anchors, gen2 }) {
    const picks = roomFloors(spec, lv, gen2);
    const fp = lv.footprint || [];
    const holes = slabHoles(spec, lv), pits = new Set(sunkRooms(spec, lv));
    (lv.rooms || []).forEach((room, i) => {
      const f = picks.get(room), off = room.floorOffset || 0;
      if (!f && !off) return;
      if (!room.bounds) return;
      const isPit = pits.has(room);
      // each footprint rect once (rects laid over one another share ground), less the slab's holes; a pit's opening has its own floor
      const seen: Rect[] = [], parts: Rect[] = [];
      if (!isPit) for (const r of fp) { const c = clipRect(room.bounds, r); if (c) parts.push(...subtractRects(c, [...seen, ...holes])); seen.push(r); }
      if (!parts.length && !isPit) return;
      const run = f && f.run ? f.run : room.bounds.w >= room.bounds.d ? 'x' : 'z';
      const mat = f ? am.floor(f, { rotation: run === 'x' ? Math.PI / 2 : 0 }) : null;
      const lift = 0.003 + i * 0.0004 + Math.max(0, off);   // a hair apart, so two rooms' overlays never share a plane
      if (parts.length) {
        const g = put(() => {
          const gg = group(`Room floor (${lv.id} · ${room.name}${f ? ' · ' + f.kind : ''})`, { category: 'Architecture', roomFinish: 'floor', room: room.name });
          if (mat) for (const r of parts) gg.add(floorPanel(r, mat));
          if (off > 0) {
            // a platform: its riser faces round the bounds, in the storey's floor with a nosing
            const edgeMat = am.paint(0xe9e4dc, { roughness: 0.6 });
            for (const r of parts) {
              const box = new THREE.Mesh(new THREE.BoxGeometry(r.w, off, r.d), [edgeMat, edgeMat, edgeMat, edgeMat, edgeMat, edgeMat]);
              box.position.set(r.x + r.w / 2, -off / 2 - 0.001, r.z + r.d / 2); box.castShadow = true; box.receiveShadow = true; gg.add(box);
              if (!mat) gg.add(floorPanel(r, am.floor({ kind: lv.floor && ['oak', 'herringbone', 'tile', 'marble', 'concrete', 'terrazzo', 'deck'].includes(lv.floor) ? lv.floor : 'oak' })));
            }
          }
          return gg;
        }, 0, 0, y + lift, null, 'floor');
        g.userData.room = room.name;
      }
      noteRoom(anchors, lv, room, { floor: f ? f.kind : undefined, floorColor: f ? f.color : undefined, floorY: +(y + Math.max(0, off) + (isPit ? off : 0)).toFixed(3), floorOffset: off || undefined });
    });
    // sunken rooms: the slab is open over the pit — a floor (a slab of its own, so the room below sees a soffit), and the sides
    // from the pit's floor up to the storey's floor, round the edge of the opening
    for (const room of lv.rooms || []) {
      if (!pits.has(room)) continue;
      const off = room.floorOffset, f = picks.get(room), mat = f ? am.floor(f, { rotation: room.bounds.w >= room.bounds.d ? Math.PI / 2 : 0 }) : am.floor({ kind: lv.floor && ['oak', 'herringbone', 'tile', 'marble', 'concrete', 'terrazzo'].includes(lv.floor) ? lv.floor : 'oak' });
      const side = am.paint(0xe9e4dc, { roughness: 0.6 }), rects = pitRects(lv, room), T = 0.05, FT = 0.12;
      put(() => {
        const gg = group(`Sunken floor (${lv.id} · ${room.name})`, { category: 'Architecture', roomFinish: 'pit', room: room.name });
        for (const r of rects) {
          gg.add(floorPanel(r, mat));
          const slab = new THREE.Mesh(new THREE.BoxGeometry(r.w, FT, r.d), side); slab.position.set(r.x + r.w / 2, -FT / 2 - 0.002, r.z + r.d / 2); slab.receiveShadow = true; gg.add(slab);
        }
        // the sides run round the union's loops; the pit is on the left of every edge (the loops' winding: house-geometry.ts outlineLoops)
        const H2 = -off + FT;
        for (const loop of rectLoops(rects)) for (let k = 0; k < loop.length; k++) {
          const a = loop[k], b = loop[(k + 1) % loop.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 0.02) continue;
          const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, nx = dz, nz = -dx;
          const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx) > 0.5 ? len : T, H2 - 0.004, Math.abs(dx) > 0.5 ? T : len), side);
          m.position.set((a[0] + b[0]) / 2 + nx * T / 2, H2 / 2 - FT - 0.002 + 0.002, (a[1] + b[1]) / 2 + nz * T / 2); m.castShadow = true; m.receiveShadow = true; gg.add(m);
        }
        return gg;
      }, 0, 0, y + off + 0.002, null, 'floor');
    }
  }

  // ---- wall liners -----------------------------------------------------------------------------------------------------------
  function walls({ spec, lv, y, H, put, am, anchors, ceilingAt }) {
    (lv.rooms || []).forEach(room => {
      const spec2 = room.walls;
      if (!spec2 || !room.bounds) return;
      for (const w of roomWalls(lv, room, spec)) {
        const ft = spec2.feature;
        const isFeature = ft && ((ft.side !== undefined && ft.side === w.side && w.kind === 'perimeter') || (ft.partition !== undefined && w.kind === 'partition' && w.index === ft.partition) || (ft.side !== undefined && ft.partition === undefined && ft.side === w.side));
        const kind = isFeature ? (ft.kind || spec2.kind || 'paint') : (spec2.kind || 'paint');
        const color = isFeature ? (ft.color ?? spec2.color) : spec2.color;
        if (w.style && w.style !== 'solid' && w.kind === 'partition') continue;   // styled partitions (glass, slats …) are not lined
        const top = Math.min(w.kind === 'partition' ? (w.height || H - 0.1) : H, ceilingAt ? ceilingAt((w.a0 + w.a1) / 2, w.side, w.line) - y : H) - 0.012;
        linerFor({ lv, y, room, w, kind, color, lower: spec2.lower, bandH: spec2.h, top, put, am });
      }
      noteRoom(anchors, lv, room, { walls: spec2.kind || 'paint', wallColor: spec2.color, feature: spec2.feature ? (spec2.feature.kind || spec2.kind || 'paint') : undefined });
    });
  }
  // one wall's liner: panels on its face round the openings, from above the baseboard to under the ceiling
  function linerFor({ lv, y, room, w, kind, color, lower, bandH, top, put, am }) {
    const horiz = w.side === 'N' || w.side === 'S', into = INTO[w.side];
    const face = w.line + (horiz ? into[1] : into[0]) * (w.half + 0.004);
    const base = 0.1;   // over the baseboard
    const paintColor = color !== undefined ? color : lv.interior || null;
    // (the kit's wall materials are shared with every liner of the colour, and some with floors: the liner gets a private copy to bias, one per material)
    let copies = biasedOf.get(am); if (!copies) biasedOf.set(am, copies = new Map());
    const biased = (m: any) => { if (!m) return m; let c = copies.get(m); if (!c) copies.set(m, c = Object.assign(am.own(m), BIAS)); return c; };
    const mainMat = biased(kind === 'wainscot' || kind === 'board-and-batten' ? am.wall('paint', paintColor ?? '#f1eee8') : am.wall(kind, color));
    const lowerMat = biased(kind === 'wainscot' ? am.wall('paint', lower ?? '#e9e4da') : null);
    const band = kind === 'wainscot' ? (bandH || 0.95) : 0;
    const railMat = am.paint(kind === 'wainscot' ? (lower ?? '#e9e4da') : (paintColor ?? '#f1eee8'), { roughness: 0.55 });
    // a liner is a 6 mm skin on the wall face, built 9 cm deep into the wall behind it: the scene check that finds furniture
    // buried in a wall measures against every tracked wall's solids, and a bare skin would call a cabinet standing flush
    // against the plaster "proud of the far face" of a wall that is 16 cm thick
    const T = 0.006, EMB = 0.09, back = -EMB / 2;
    const g = put(() => {
      const gg = group(`Wall finish (${lv.id} · ${room.name} · ${w.side}${w.kind === 'partition' ? ' partition' : ''} · ${kind})`, { category: 'Architecture', role: 'finish', roomFinish: 'wall', room: room.name });
      gg.userData.role = 'finish';
      const holes = w.holes.filter(h => h.a1 > w.a0 && h.a0 < w.a1);
      // panels round the holes, split at the wainscot band
      const bands = band ? [[base, Math.min(band, top), lowerMat], [Math.min(band, top), top, mainMat]] : [[base, top, mainMat]];
      const xs = [...new Set([w.a0, w.a1, ...holes.flatMap(h => [Math.max(w.a0, h.a0), Math.min(w.a1, h.a1)])])].sort((a, b) => a - b);
      for (const [b0, b1, mat] of bands) {
        if (b1 - b0 < 0.01) continue;
        for (let i = 0; i < xs.length - 1; i++) {
          const a0 = xs[i], a1 = xs[i + 1], am2 = (a0 + a1) / 2;
          if (a1 - a0 < 0.005) continue;
          const cut = holes.filter(h => am2 > h.a0 && am2 < h.a1).map(h => [Math.max(b0, h.y0 - 0.01), Math.min(b1, h.y1 + 0.01)]).filter(c => c[1] > c[0]).sort((p, q) => p[0] - q[0]);
          let yy = b0;
          for (const [c0, c1] of [...cut, [b1, b1]]) {
            if (c0 - yy > 0.005) {
              const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? a1 - a0 : T + EMB, c0 - yy, horiz ? T + EMB : a1 - a0), mat);
              m.position.set(horiz ? am2 : face + into[0] * back, (yy + c0) / 2, horiz ? face + into[1] * back : am2); m.receiveShadow = true; gg.add(m);
            }
            yy = Math.max(yy, c1);
          }
        }
      }
      // wainscot: a chair rail on the band's top and stiles every 0.6 m; board-and-batten: battens every 0.4 m
      const solidAt = (a: number, v: number) => !holes.some(h => a > h.a0 - 0.02 && a < h.a1 + 0.02 && v > h.y0 - 0.02 && v < h.y1 + 0.02);
      const strip = (a0: number, a1: number, v: number, hh: number, proud: number, depth: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? a1 - a0 : proud, hh, horiz ? proud : a1 - a0), railMat);
        m.position.set(horiz ? (a0 + a1) / 2 : face + (horiz ? 0 : into[0]) * depth, v, horiz ? face + into[1] * depth : (a0 + a1) / 2); gg.add(m);
      };
      if (kind === 'wainscot' && band < top) {
        let a = w.a0;
        for (const x of [...xs.slice(1), w.a1]) { if (x - a > 0.05 && solidAt((a + x) / 2, band)) strip(a, x, band, 0.05, 0.03, 0.015); a = x; }
        for (let a2 = w.a0 + 0.6; a2 < w.a1 - 0.2; a2 += 0.6) {
          // a stile runs up the panelled band to the rail, or to the first hole over it (a window's sill)
          const lim = Math.min(band, ...holes.filter(h => a2 > h.a0 - 0.04 && a2 < h.a1 + 0.04).map(h => h.y0 - 0.12));
          if (lim - base > 0.1 && solidAt(a2, (base + lim) / 2)) strip(a2 - 0.03, a2 + 0.03, (base + lim) / 2, lim - base, 0.012, 0.009);
        }
      }
      if (kind === 'board-and-batten') {
        for (let a2 = w.a0 + 0.2; a2 < w.a1 - 0.1; a2 += 0.4) {
          // a batten runs the solid height at a2 (it stops at a hole)
          const cut = holes.filter(h => a2 > h.a0 - 0.03 && a2 < h.a1 + 0.03).map(h => [h.y0, h.y1]).sort((p, q) => p[0] - q[0]);
          let yy = base;
          for (const [c0, c1] of [...cut, [top, top]]) { if (c0 - yy > 0.05) strip(a2 - 0.025, a2 + 0.025, (yy + c0) / 2, c0 - yy, 0.014, 0.01); yy = Math.max(yy, c1); }
        }
        let a = w.a0;
        for (const x of [...xs.slice(1), w.a1]) { if (x - a > 0.05 && solidAt((a + x) / 2, top - 0.06)) strip(a, x, top - 0.05, 0.08, 0.016, 0.011); a = x; }
      }
      return gg;
    }, 0, 0, y, null, 'finish');
    g.userData.role = 'finish';
    registerTrackedWall(g, w.orientation, top, Math.min(0.85, top));
    return g;
  }

  // ---- ceilings -------------------------------------------------------------------------------------------------------------
  // A room's own ceiling. `at` is its height (absolute) where the storey's flat ceiling or slab underside is; `top` true for a
  // storey with nothing above the room (a vault or a tray is possible). Returns true when it built something.
  function ceiling({ spec, lv, room, y, H, at, top, put, am, roofUnder }) {
    const c = room.ceiling, b = room.bounds;
    if (!c || !b || c.kind === 'double' || c.kind === 'flat' && c.color === undefined) return null;
    const parts = (lv.footprint || []).map(r => clipRect(b, r)).filter(Boolean);
    if (!parts.length) return null;
    const kind = (c.kind === 'vault' || c.kind === 'tray') && !top ? 'flat' : c.kind;
    let lastRise = 0;
    const col = c.color, mat = kind === 'timber' ? am.ceiling('timber', col) : am.ceiling('flat', col ?? '#f1f5f9');
    // beams: the kit's oak in a darker tone, the grain along each beam
    const beamMat = am.floor({ kind: 'walnut' }, { rotation: (b.w <= b.d) ? Math.PI / 2 : 0 });
    const g = put(() => {
      const gg = group(`Room ceiling (${lv.id} · ${room.name} · ${kind})`, { category: 'Architecture', roomFinish: 'ceiling', room: room.name });
      const sheet = (r: Rect, yy: number, m2 = mat) => { const geo = new THREE.PlaneGeometry(r.w, r.d); geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, m2); m.position.set(r.x + r.w / 2, yy, r.z + r.d / 2); m.receiveShadow = true; gg.add(m); return m; };
      if (kind === 'flat' || kind === 'timber' || kind === 'beams') {
        for (const r of parts) sheet(r, -0.004);
        if (kind === 'beams') {
          // timber beams across the short span, every ~0.9 m, 0.12 × 0.2
          const alongX = b.w <= b.d;   // beams span the short direction
          for (const r of parts) {
            const L = alongX ? r.d : r.w, n = Math.max(1, Math.round(L / 0.9));
            for (let k = 1; k < n + 1; k++) {
              const s = (alongX ? r.z : r.x) + (L * k) / (n + 1);
              const bm = new THREE.Mesh(new THREE.BoxGeometry(alongX ? r.w : 0.12, 0.2, alongX ? 0.12 : r.d), beamMat);
              bm.position.set(alongX ? r.x + r.w / 2 : s, -0.1 - 0.006, alongX ? s : r.z + r.d / 2); bm.castShadow = true; bm.receiveShadow = true; gg.add(bm);
            }
          }
        }
      } else if (kind === 'tray') {
        // a band round the room at the ceiling, the middle stepped up by `rise`, its sides a cove
        const rise = c.rise || 0.25, inset = Math.min(0.6, Math.min(b.w, b.d) * 0.18);
        lastRise = rise;
        const inner = { x: b.x + inset, z: b.z + inset, w: b.w - 2 * inset, d: b.d - 2 * inset };
        for (const r of [{ x: b.x, z: b.z, w: b.w, d: inset }, { x: b.x, z: b.z + b.d - inset, w: b.w, d: inset }, { x: b.x, z: b.z + inset, w: inset, d: b.d - 2 * inset }, { x: b.x + b.w - inset, z: b.z + inset, w: inset, d: b.d - 2 * inset }]) sheet(r, -0.004);
        sheet(inner, rise - 0.004);
        const side = am.ceiling('flat', col ?? '#f1f5f9');
        for (const [w2, d2, x, z] of [[inner.w, 0.02, inner.x + inner.w / 2, inner.z], [inner.w, 0.02, inner.x + inner.w / 2, inner.z + inner.d], [0.02, inner.d, inner.x, inner.z + inner.d / 2], [0.02, inner.d, inner.x + inner.w, inner.z + inner.d / 2]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(w2, rise, d2), side); m.position.set(x, rise / 2 - 0.004, z); gg.add(m);
        }
      } else if (kind === 'vault') {
        // two planes from the long walls up to a ridge, ends closed by gable triangles; kept under the roof
        const ridgeX = c.ridge ? c.ridge === 'x' : b.w >= b.d;
        const span = ridgeX ? b.d : b.w;
        const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
        const under = roofUnder ? roofUnder(cx, cz) : null;
        const rise = Math.max(0.3, Math.min(c.rise || 1.1, under !== null ? under - at - 0.08 : 1.1, span * 0.45));
        lastRise = rise;
        const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, v = -0.004;
        const mesh = (pts: number[][], m2) => {
          const pos: number[] = [];
          for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) pos.push(p[0], p[1], p[2]);
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
          const m = new THREE.Mesh(geo, m2); m.receiveShadow = true; gg.add(m); return m;
        };
        const vm = am.ceiling('flat', col ?? '#f1f5f9'), em = am.ceiling('flat', lv.interior || '#f1eee8');
        // the gable caps close the vault 8 cm in from the room's line, which is the wall's inner face, and the roof's gable wall and a parapet
        // end on that same face: 3 mm further in, the cap is no longer one plane with them (z-fighting over the whole gable end)
        const CAP = 0.08 + 0.003;
        if (ridgeX) {
          mesh([[x0, v, z0], [x1, v, z0], [x1, v + rise, cz], [x0, v + rise, cz]], vm); mesh([[x0, v, z1], [x0, v + rise, cz], [x1, v + rise, cz], [x1, v, z1]], vm);
          mesh([[x0 + CAP, v, z0], [x0 + CAP, v + rise, cz], [x0 + CAP, v, z1]], em); mesh([[x1 - CAP, v, z0], [x1 - CAP, v, z1], [x1 - CAP, v + rise, cz]], em);
        } else {
          mesh([[x0, v, z0], [cx, v + rise, z0], [cx, v + rise, z1], [x0, v, z1]], vm); mesh([[x1, v, z0], [x1, v, z1], [cx, v + rise, z1], [cx, v + rise, z0]], vm);
          mesh([[x0, v, z0 + CAP], [x1, v, z0 + CAP], [cx, v + rise, z0 + CAP]], em); mesh([[x0, v, z1 - CAP], [cx, v + rise, z1 - CAP], [x1, v, z1 - CAP]], em);
        }
        if (c.color === undefined) {   // a ridge beam
          const rb = new THREE.Mesh(new THREE.BoxGeometry(ridgeX ? b.w : 0.14, 0.18, ridgeX ? 0.14 : b.d), beamMat); rb.position.set(cx, v + rise - 0.09, cz); gg.add(rb);
        }
      }
      return gg;
    }, 0, 0, at, null, 'ceiling');
    if (typeof registerCeiling === 'function') registerCeiling(g, at);
    g.userData.rise = lastRise;
    return g;
  }

  // ---- double-height rooms: rails round the gallery edges of the opening they make in the storey above --------------------
  function galleryRails({ spec, lv, y, put, ProceduralArchitecture, doubleRooms }) {
    const edges = perimeterEdges(lv.footprint || []);
    const onPerimeter = (x0, z0, x1, z1) => edges.some(e => (Math.abs(e.a[1] - z0) < 0.05 && Math.abs(e.b[1] - z1) < 0.05 && z0 === z1 && x0 >= e.a[0] - 0.05 && x1 <= e.b[0] + 0.05) || (Math.abs(e.a[0] - x0) < 0.05 && Math.abs(e.b[0] - x1) < 0.05 && x0 === x1 && z0 >= e.a[1] - 0.05 && z1 <= e.b[1] + 0.05));
    for (const d of doubleRooms) {
      if (d.room.ceiling.rail === false) continue;
      const r = d.rect;
      for (const [x0, z0, x1, z1] of [[r.x, r.z, r.x + r.w, r.z], [r.x, r.z + r.d, r.x + r.w, r.z + r.d], [r.x, r.z, r.x, r.z + r.d], [r.x + r.w, r.z, r.x + r.w, r.z + r.d]]) {
        if (onPerimeter(x0, z0, x1, z1)) continue;
        const len = Math.hypot(x1 - x0, z1 - z0), alongX = z0 === z1;
        const gg = put(() => ProceduralArchitecture.createGlassBalustrade(len, 1.0, y), (x0 + x1) / 2, (z0 + z1) / 2, y, null, 'structure');
        if (!alongX) gg.rotation.y = Math.PI / 2;
      }
    }
  }

  return { floors, walls, ceiling, galleryRails };
}
