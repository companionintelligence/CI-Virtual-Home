// FloorplanGraph — the runtime plan model behind the HouseSpec compiler (PARAMETRIC-INTERIORS-PLAN.md §3.1).
//
// Corner / Wall / HalfEdge / Room are ported from blueprint3d (FurnishUp Inc., MIT —
// https://github.com/furnishup/blueprint3d, src/model/{corner,wall,half_edge,room,floorplan}.ts):
//   • rooms are detected with the tightest-cycle walk (findRooms → _findTightestCycle / _removeDuplicateRooms)
//   • every half-edge offers mitred interior/exterior face points via halfAngleVector(), so wall
//     junctions are watertight at any angle, not just 90°
//   • JSON save/load is { corners, walls, rooms }
// jQuery, callbacks and THREE are dropped: plain ES classes so the same file runs in the browser
// and under `node --test`. Coordinates are metres, X east, Z south (+Z = front); Y (up) belongs to
// the geometry compilers, not the plan.

import { perimeterEdges, outlineLoops, edgeForOpening, inRect, rectCentre } from './house-geometry.js';

export const DEFAULT_WALL_THICKNESS = 0.16;      // ProceduralArchitecture.createParametricWall default
export const DEFAULT_PARTITION_THICKNESS = 0.12;
export const DEFAULT_WALL_HEIGHT = 2.8;
export const DEFAULT_DOOR_HEIGHT = 2.05;
export const CORNER_TOLERANCE = 0.02;            // metres: corners closer than this are one corner
export const SNAP_TOLERANCE = 0.06;              // metres: partition ends this close to a wall snap onto it
export const MIN_ROOM_WIDTH = DEFAULT_WALL_THICKNESS;   // metres: a cycle narrower than a wall is a sliver, not a room

// ---------------------------------------------------------------------------------------
// 2D helpers (blueprint3d core/utils.ts, minus the jQuery)
// ---------------------------------------------------------------------------------------
const EPS = 1e-9;
export const round3 = v => Math.round(v * 1000) / 1000;
export const distance = (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1);

/** Angle from vector 1 to vector 2, negative = counter-clockwise on screen (X right, Z down). */
export function angle(x1, z1, x2, z2) {
  const dot = x1 * x2 + z1 * z2, det = x1 * z2 - z1 * x2;
  return -Math.atan2(det, dot);
}
/** Same angle shifted into [0, 2π). */
export function angle2pi(x1, z1, x2, z2) {
  let t = angle(x1, z1, x2, z2);
  if (t < 0) t += 2 * Math.PI;
  return t;
}
/** Shoelace area; positive for the orientation findRooms keeps. */
export function signedArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    s += p.x * q.z - q.x * p.z;
  }
  return s / 2;
}
/** blueprint3d's isClockwise: true when the loop is not the room orientation. */
export const isClockwise = points => signedArea(points) <= 0;
/** 2·area / perimeter: a strip's width, half a square's side; 0 for a loop that doubles back on itself. */
export function meanWidth(points) {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    perimeter += Math.hypot(q.x - p.x, q.z - p.z);
  }
  return perimeter < EPS ? 0 : 2 * Math.abs(signedArea(points)) / perimeter;
}

export function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const x = ax + dx * t, z = az + dz * t;
  return { x, z, t, dist: Math.hypot(px - x, pz - z) };
}

/** Proper crossing of two segments (not touching at endpoints) → { t, u } parameters, else null. */
export function segmentCrossing(a0, a1, b0, b1) {
  const rx = a1[0] - a0[0], rz = a1[1] - a0[1], sx = b1[0] - b0[0], sz = b1[1] - b0[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < EPS) return null;                            // parallel / collinear
  const qx = b0[0] - a0[0], qz = b0[1] - a0[1];
  const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
  const e = 1e-6;
  if (t <= e || t >= 1 - e || u <= e || u >= 1 - e) return null;
  return { t, u };
}

/**
 * Signed distance along the unit axis (dx,dz) from p to where the line through p meets segment a→b: positive
 * ahead of p, negative behind it; null when the line misses the segment. A collinear segment is met at p when
 * it covers p, else at its nearer end.
 */
export function axisHit(p, dx, dz, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], qx = a[0] - p[0], qz = a[1] - p[1];
  const len = Math.hypot(ex, ez), den = dx * ez - dz * ex;
  if (len < EPS) return null;
  if (Math.abs(den) < EPS * len) {                                   // parallel
    if (Math.abs(qx * dz - qz * dx) > EPS) return null;              // … and off the line
    const ua = qx * dx + qz * dz, ub = (b[0] - p[0]) * dx + (b[1] - p[1]) * dz;
    if (Math.min(ua, ub) <= 0 && Math.max(ua, ub) >= 0) return 0;
    return Math.abs(ua) < Math.abs(ub) ? ua : ub;
  }
  const v = (qx * dz - qz * dx) / den;                               // fraction along a→b
  if (v < -EPS || v > 1 + EPS) return null;
  return (qx * ez - qz * ex) / den;
}

/** Ray-casting point-in-polygon for [[x,z], …] loops. */
export function polygonContains(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const numericSuffix = id => parseInt(String(id).replace(/^\D+/, ''), 10) || 0;

// ---------------------------------------------------------------------------------------
// Corner — a plan vertex; walls start or end here
// ---------------------------------------------------------------------------------------
export class Corner {
  [key: string]: any;
  constructor(graph, x, z, id) {
    this.graph = graph; this.id = id; this.x = x; this.z = z;
    this.wallStarts = []; this.wallEnds = [];
  }
  attachStart(wall) { if (!this.wallStarts.includes(wall)) this.wallStarts.push(wall); }
  attachEnd(wall) { if (!this.wallEnds.includes(wall)) this.wallEnds.push(wall); }
  detachWall(wall) {
    this.wallStarts = this.wallStarts.filter(w => w !== wall);
    this.wallEnds = this.wallEnds.filter(w => w !== wall);
  }
  walls() { return [...this.wallStarts, ...this.wallEnds]; }
  degree() { return this.wallStarts.length + this.wallEnds.length; }
  adjacentCorners() {
    return [...this.wallStarts.map(w => w.getEnd()), ...this.wallEnds.map(w => w.getStart())];
  }
  wallTo(corner) { return this.wallStarts.find(w => w.getEnd() === corner) || null; }
  wallFrom(corner) { return this.wallEnds.find(w => w.getStart() === corner) || null; }
  wallToOrFrom(corner) { return this.wallTo(corner) || this.wallFrom(corner); }
  isWallConnected(wall) { return this.wallStarts.includes(wall) || this.wallEnds.includes(wall); }
  distanceFrom(x, z) { return distance(this.x, this.z, x, z); }
  move(x, z) { this.x = x; this.z = z; }
  toJSON() { return { x: round3(this.x), z: round3(this.z) }; }
}

// ---------------------------------------------------------------------------------------
// Wall — a centreline between two corners, with openings measured along it
// ---------------------------------------------------------------------------------------
export class Wall {
  [key: string]: any;
  constructor(graph: any, start: any, end: any, opts: any = {}) {
    this.graph = graph;
    this.id = opts.id;
    this.thickness = opts.thickness ?? DEFAULT_WALL_THICKNESS;
    this.height = opts.height ?? DEFAULT_WALL_HEIGHT;
    this.kind = opts.kind || 'wall';                 // 'exterior' | 'partition' | 'wall'
    this.openings = (opts.openings || []).map(o => ({ ...o }));
    this.frontEdge = null; this.backEdge = null; this.orphan = false;
    this.start = null; this.end = null;
    this.setStart(start); this.setEnd(end);
  }
  getStart() { return this.start; }
  getEnd() { return this.end; }
  setStart(corner) { if (this.start) this.start.detachWall(this); this.start = corner; corner.attachStart(this); }
  setEnd(corner) { if (this.end) this.end.detachWall(this); this.end = corner; corner.attachEnd(this); }
  length() { return distance(this.start.x, this.start.z, this.end.x, this.end.z); }
  /** Unit vector start → end. */
  direction() { const l = this.length() || 1; return [(this.end.x - this.start.x) / l, (this.end.z - this.start.z) / l]; }
  midpoint() { return [(this.start.x + this.end.x) / 2, (this.start.z + this.end.z) / 2]; }
  /** Point at fraction t ∈ [0,1] from start. */
  pointAt(t) { return [this.start.x + (this.end.x - this.start.x) * t, this.start.z + (this.end.z - this.start.z) * t]; }
  resetFrontBack() { this.frontEdge = null; this.backEdge = null; this.orphan = false; }
  edges() { return [this.frontEdge, this.backEdge].filter(Boolean); }
  /** Rooms on either side (0, 1 or 2). */
  rooms() { return this.edges().map(e => e.room).filter(Boolean); }
  /**
   * Opening: { kind: door|window|slider|garage|glass|arch, at: 0..1 along the wall, w, h, sill, style, entry }.
   * `at` is the centre as a fraction from start to end.
   */
  addOpening(op) {
    const o = { ...op, kind: op.kind || op.type || 'door', sill: op.sill ?? 0 };
    delete o.type;
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];   // keep toJSON() ≡ JSON.parse(JSON.stringify())
    this.openings.push(o);
    this.openings.sort((p, q) => p.at - q.at);
    return o;
  }
  remove() {
    this.start.detachWall(this); this.end.detachWall(this);
    this.graph.walls = this.graph.walls.filter(w => w !== this);
  }
  toJSON() {
    return {
      id: this.id, corner1: this.start.id, corner2: this.end.id,
      thickness: this.thickness, height: this.height, kind: this.kind,
      openings: this.openings.map(o => ({ ...o }))
    };
  }
}

// ---------------------------------------------------------------------------------------
// HalfEdge — one face of a wall as seen from a room (or an orphan face when no room touches it)
// ---------------------------------------------------------------------------------------
export class HalfEdge {
  [key: string]: any;
  constructor(room, wall, front) {
    this.room = room || null; this.wall = wall; this.front = !!front;
    this.prev = null; this.next = null;
    this.offset = wall.thickness / 2;
    this.height = wall.height;
    if (this.front) wall.frontEdge = this; else wall.backEdge = this;
  }
  getStart() { return this.front ? this.wall.getStart() : this.wall.getEnd(); }
  getEnd() { return this.front ? this.wall.getEnd() : this.wall.getStart(); }
  corners() { return [this.getStart(), this.getEnd()]; }

  interiorStart() { const v = this.halfAngleVector(this.prev, this); return { x: this.getStart().x + v.x, z: this.getStart().z + v.z }; }
  interiorEnd()   { const v = this.halfAngleVector(this, this.next); return { x: this.getEnd().x + v.x, z: this.getEnd().z + v.z }; }
  exteriorStart() { const v = this.halfAngleVector(this.prev, this); return { x: this.getStart().x - v.x, z: this.getStart().z - v.z }; }
  exteriorEnd()   { const v = this.halfAngleVector(this, this.next); return { x: this.getEnd().x - v.x, z: this.getEnd().z - v.z }; }
  /** Mitred face on the room side as [[x,z],[x,z]], start → end. */
  interior() { const a = this.interiorStart(), b = this.interiorEnd(); return [[a.x, a.z], [b.x, b.z]]; }
  /** Mitred face on the far side as [[x,z],[x,z]], start → end. */
  exterior() { const a = this.exteriorStart(), b = this.exteriorEnd(); return [[a.x, a.z], [b.x, b.z]]; }
  interiorDistance() { const [a, b] = this.interior(); return distance(a[0], a[1], b[0], b[1]); }
  exteriorDistance() { const [a, b] = this.exterior(); return distance(a[0], a[1], b[0], b[1]); }
  /** Unit normal pointing from the interior face towards the exterior face. */
  outwardNormal() {
    const s = this.getStart(), e = this.getEnd();
    const l = distance(s.x, s.z, e.x, e.z) || 1;
    const d = [(e.x - s.x) / l, (e.z - s.z) / l];
    const [i0] = this.interior(), [x0] = this.exterior();
    let n = [-d[1], d[0]];
    if ((x0[0] - i0[0]) * n[0] + (x0[1] - i0[1]) * n[1] < 0) n = [d[1], -d[0]];
    return n;
  }

  /**
   * Vector from the corner shared by v1 → v2 to the mitred interior point, of length offset / sin(θ/2)
   * along the half-angle bisector. When prev/next is missing the wall is extended straight so the
   * face ends square (blueprint3d "make the best of things").
   */
  halfAngleVector(v1, v2) {
    let v1sx, v1sz, v1ex, v1ez, v2sx, v2sz, v2ex, v2ez;
    if (!v1) {
      const s = v2.getStart(), e = v2.getEnd();
      v1sx = s.x - (e.x - s.x); v1sz = s.z - (e.z - s.z); v1ex = s.x; v1ez = s.z;
    } else {
      v1sx = v1.getStart().x; v1sz = v1.getStart().z; v1ex = v1.getEnd().x; v1ez = v1.getEnd().z;
    }
    if (!v2) {
      const s = v1.getStart(), e = v1.getEnd();
      v2sx = e.x; v2sz = e.z; v2ex = e.x + (e.x - s.x); v2ez = e.z + (e.z - s.z);
    } else {
      v2sx = v2.getStart().x; v2sz = v2.getStart().z; v2ex = v2.getEnd().x; v2ez = v2.getEnd().z;
    }
    const theta = angle2pi(v1sx - v1ex, v1sz - v1ez, v2ex - v1ex, v2ez - v1ez);
    const cs = Math.cos(theta / 2), sn = Math.sin(theta / 2);
    const v2dx = v2ex - v2sx, v2dz = v2ez - v2sz;
    const vx = v2dx * cs - v2dz * sn, vz = v2dx * sn + v2dz * cs;
    const mag = Math.hypot(vx, vz) || 1;
    const scalar = (this.offset / (Math.abs(sn) < 1e-9 ? 1e-9 : sn)) / mag;
    return { x: vx * scalar, z: vz * scalar };
  }
}

// ---------------------------------------------------------------------------------------
// Room — a closed cycle of corners; owns one HalfEdge per wall it touches
// ---------------------------------------------------------------------------------------
export class Room {
  [key: string]: any;
  constructor(graph, corners, id) {
    this.graph = graph; this.id = id; this.corners = corners;
    this.name = null; this.no = null; this.floor = null; this.ceilingHeight = null; this.outdoor = false;
    this.edgePointer = null;
    this.updateWalls();
  }
  updateWalls() {
    let prevEdge = null, firstEdge = null;
    const n = this.corners.length;
    for (let i = 0; i < n; i++) {
      const a = this.corners[i], b = this.corners[(i + 1) % n];
      const wallTo = a.wallTo(b), wallFrom = a.wallFrom(b);
      let edge;
      if (wallTo) edge = new HalfEdge(this, wallTo, true);
      else if (wallFrom) edge = new HalfEdge(this, wallFrom, false);
      else throw new Error(`Room ${this.id}: corners ${a.id} and ${b.id} are not connected by a wall`);
      if (i === 0) firstEdge = edge;
      else { edge.prev = prevEdge; prevEdge.next = edge; }
      if (i === n - 1) { firstEdge.prev = edge; edge.next = firstEdge; }
      prevEdge = edge;
    }
    this.edgePointer = firstEdge;
  }
  edges() {
    const out = []; let e = this.edgePointer;
    if (!e) return out;
    do { out.push(e); e = e.next; } while (e && e !== this.edgePointer && out.length < 10000);
    return out;
  }
  walls() { return this.edges().map(e => e.wall); }
  /** Centreline polygon [[x,z], …]. */
  polygon() { return this.corners.map(c => [c.x, c.z]); }
  /** Mitred polygon on the room side (what the floor should fill). */
  interiorPolygon() { return this.edges().map(e => { const p = e.interiorStart(); return [p.x, p.z]; }); }
  area() { return Math.abs(signedArea(this.corners)); }
  centroid() {
    const n = this.corners.length || 1;
    return [this.corners.reduce((s, c) => s + c.x, 0) / n, this.corners.reduce((s, c) => s + c.z, 0) / n];
  }
  contains(x, z) { return polygonContains(this.polygon(), x, z); }
  key() { return FloorplanGraph.cycleKey(this.corners.map(c => c.id)); }
  toJSON() {
    return {
      id: this.id, corners: this.corners.map(c => c.id),
      name: this.name, no: this.no, floor: this.floor, ceilingHeight: this.ceilingHeight, outdoor: this.outdoor
    };
  }
}

// ---------------------------------------------------------------------------------------
// FloorplanGraph
// ---------------------------------------------------------------------------------------
export class FloorplanGraph {
  [key: string]: any;
  constructor() {
    this.corners = []; this.walls = []; this.rooms = [];
    this.roomMeta = new Map();               // cycle key → { name, no, floor, ceilingHeight } (survives update())
    this._n = { c: 0, w: 0, r: 0 };
  }
  _id(prefix) { return `${prefix}${++this._n[prefix]}`; }
  _claim(prefix, id) { this._n[prefix] = Math.max(this._n[prefix], numericSuffix(id)); return id; }

  /** Canonical key for a corner-id cycle (rotation invariant, direction preserved). */
  static cycleKey(ids) {
    if (!ids.length) return '';
    let best = 0;
    for (let i = 1; i < ids.length; i++) if (ids[i] < ids[best]) best = i;
    return [...ids.slice(best), ...ids.slice(0, best)].join('-');
  }

  corner(id) { return this.corners.find(c => c.id === id) || null; }
  wall(id) { return this.walls.find(w => w.id === id) || null; }

  newCorner(x: any, z: any, id?: any) {
    const c = new Corner(this, x, z, id ? this._claim('c', id) : this._id('c'));
    this.corners.push(c);
    return c;
  }
  cornerNear(x, z, tol = CORNER_TOLERANCE) {
    let best = null, bd = tol;
    for (const c of this.corners) { const d = c.distanceFrom(x, z); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  getOrCreateCorner(x, z, tol = CORNER_TOLERANCE) { return this.cornerNear(x, z, tol) || this.newCorner(x, z); }

  /** Adds a wall unless it is zero-length or duplicates an existing wall between the same corners. */
  newWall(start: any, end: any, opts: any = {}) {
    if (start === end) return null;
    const existing = start.wallToOrFrom(end);
    if (existing) return existing;
    const w = new Wall(this, start, end, { ...opts, id: opts.id ? this._claim('w', opts.id) : this._id('w') });
    this.walls.push(w);
    return w;
  }
  removeWall(wall) { wall.remove(); }
  removeCorner(corner) {
    for (const w of corner.walls()) w.remove();
    this.corners = this.corners.filter(c => c !== corner);
  }
  /** Splits `wall` at (x,z) (projected onto it); returns the corner at the split. */
  splitWallAt(wall, x, z) {
    const p = closestPointOnSegment(x, z, wall.start.x, wall.start.z, wall.end.x, wall.end.z);
    if (p.t <= 1e-6) return wall.start;
    if (p.t >= 1 - 1e-6) return wall.end;
    const c = this.newCorner(p.x, p.z);
    const end = wall.end;
    // re-distribute openings by their position along the original wall
    const mine = wall.openings.filter(o => o.at <= p.t), theirs = wall.openings.filter(o => o.at > p.t);
    wall.setEnd(c);
    wall.openings = mine.map(o => ({ ...o, at: o.at / p.t }));
    const w2 = this.newWall(c, end, { thickness: wall.thickness, height: wall.height, kind: wall.kind });
    if (w2) w2.openings = theirs.map(o => ({ ...o, at: (o.at - p.t) / (1 - p.t) }));
    return c;
  }

  /** Wall whose centreline passes within `tol` of (x,z), else null. */
  wallAt(x, z, tol = CORNER_TOLERANCE) {
    let best = null, bd = tol;
    for (const w of this.walls) {
      const p = closestPointOnSegment(x, z, w.start.x, w.start.z, w.end.x, w.end.z);
      if (p.dist < bd) { bd = p.dist; best = w; }
    }
    return best;
  }
  /** Innermost room containing (x,z) — an island room (partition box inside a bigger cycle) wins over its host. */
  roomAt(x, z) {
    let best = null;
    for (const r of this.rooms) if (r.contains(x, z) && (!best || r.area() < best.area())) best = r;
    return best;
  }
  bounds() {
    if (!this.corners.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    return {
      minX: Math.min(...this.corners.map(c => c.x)), maxX: Math.max(...this.corners.map(c => c.x)),
      minZ: Math.min(...this.corners.map(c => c.z)), maxZ: Math.max(...this.corners.map(c => c.z))
    };
  }

  /** Attach a label to a room; kept in roomMeta so it survives re-detection. */
  labelRoom(room, meta) {
    Object.assign(room, meta);
    this.roomMeta.set(room.key(), { ...(this.roomMeta.get(room.key()) || {}), ...meta });
    return room;
  }

  /** Re-detect rooms, rebuild half-edges and give orphan walls square-ended faces. */
  update() {
    for (const w of this.walls) w.resetFrontBack();
    this._n.r = 0;
    this.rooms = FloorplanGraph.findRooms(this.corners).map(cs => new Room(this, cs, this._id('r')));
    for (const r of this.rooms) { const meta = this.roomMeta.get(r.key()); if (meta) Object.assign(r, meta); }
    for (const w of this.walls) if (!w.frontEdge && !w.backEdge) {
      w.orphan = true;
      new HalfEdge(null, w, true); new HalfEdge(null, w, false);
    }
    return this.rooms;
  }

  /**
   * blueprint3d Floorplan.findRooms: for every (corner, adjacent) pair walk the graph always taking
   * the tightest turn; de-duplicate the cycles and drop the clockwise ones (the outer face).
   * Not in blueprint3d: cycles narrower than a wall (MIN_ROOM_WIDTH) are dropped too. They are gaps
   * inside the wall solids, not floor: the two leaves of a two-tone partition (familyhouse-nora L1).
   * Façade dressing outside the footprint (aurora's cladding) no longer closes one, since fromFootprint
   * doesn't snap it, but the width rule would still catch a pocket drawn some other way.
   */
  static findRooms(corners) {
    const theta = (prev, cur, next) => angle2pi(prev.x - cur.x, prev.z - cur.z, next.x - cur.x, next.z - cur.z);

    function _findTightestCycle(firstCorner, secondCorner) {
      const stack = [];
      let next = { corner: secondCorner, previousCorners: [firstCorner] };
      const visited = new Set([firstCorner.id]);
      while (next) {
        const currentCorner = next.corner;
        visited.add(currentCorner.id);
        // back at the start (and not trivially at the second corner)?
        if (next.corner === firstCorner && currentCorner !== secondCorner) return next.previousCorners;
        const addToStack = [];
        for (const nextCorner of next.corner.adjacentCorners()) {
          // skip where we came from — except the first corner, which closes the loop
          if (visited.has(nextCorner.id) && !(nextCorner === firstCorner && currentCorner !== secondCorner)) continue;
          addToStack.push(nextCorner);
        }
        const previousCorners = [...next.previousCorners, currentCorner];
        if (addToStack.length > 1) {
          // smallest theta ends on top of the stack → visited first
          const previousCorner = next.previousCorners[next.previousCorners.length - 1];
          addToStack.sort((a, b) => theta(previousCorner, currentCorner, b) - theta(previousCorner, currentCorner, a));
        }
        for (const corner of addToStack) stack.push({ corner, previousCorners });
        next = stack.pop();
      }
      return [];
    }

    function _removeDuplicateRooms(loops) {
      const seen = new Set(), out = [];
      for (const loop of loops) {
        if (!loop.length) continue;
        const key = FloorplanGraph.cycleKey(loop.map(c => c.id));
        if (seen.has(key)) continue;
        seen.add(key); out.push(loop);
      }
      return out;
    }

    const loops = [];
    for (const first of corners) for (const second of first.adjacentCorners()) loops.push(_findTightestCycle(first, second));
    return _removeDuplicateRooms(loops).filter(loop => loop.length >= 3 && !isClockwise(loop) && meanWidth(loop) >= MIN_ROOM_WIDTH);
  }

  // -------------------------------------------------------------------------------------
  // Serialisation — { corners: { id: {x,z} }, walls: [{ id, corner1, corner2, … }], rooms: [{ corners: [ids], name… }] }
  // -------------------------------------------------------------------------------------
  toJSON() {
    return {
      corners: Object.fromEntries(this.corners.map(c => [c.id, c.toJSON()])),
      walls: this.walls.map(w => w.toJSON()),
      rooms: this.rooms.map(r => r.toJSON())
    };
  }
  static fromJSON(json: any) {
    const g = new FloorplanGraph();
    for (const [id, c] of Object.entries(json.corners || {}) as [string, any][]) g.newCorner(c.x, c.z, id);
    for (const w of json.walls || []) {
      const a = g.corner(w.corner1), b = g.corner(w.corner2);
      if (!a || !b) throw new Error(`wall ${w.id}: unknown corner ${!a ? w.corner1 : w.corner2}`);
      g.newWall(a, b, { id: w.id, thickness: w.thickness, height: w.height, kind: w.kind, openings: w.openings });
    }
    for (const r of json.rooms || []) {
      const { corners, id, ...meta } = r;
      g.roomMeta.set(FloorplanGraph.cycleKey(corners || []), meta);
    }
    g.update();
    return g;
  }

  // -------------------------------------------------------------------------------------
  // HouseSpec v1 → graph. Perimeter = outline loops of the rect union (one wall per outline
  // edge); partitions become interior walls. Every segment is split where another segment's
  // endpoint or a crossing lies on it, so T-junctions and crossings become corners and the
  // tightest-cycle walk finds the rooms. Free-standing partition ends stay dangling (orphan).
  // -------------------------------------------------------------------------------------
  static fromFootprint(rects: any, partitions: any = [], opts: any = {}) {
    const {
      thickness = DEFAULT_WALL_THICKNESS, partitionThickness = DEFAULT_PARTITION_THICKNESS,
      height = DEFAULT_WALL_HEIGHT, partitionHeight = height, openings = [], rooms = [], entry = null, snap = SNAP_TOLERANCE
    } = opts;
    const g = new FloorplanGraph();
    if (!rects || !rects.length) return g;
    const edges = perimeterEdges(rects);
    const loops = outlineLoops(edges);

    const segs = [];
    for (const loop of [loops.outer, ...loops.holes]) {
      for (let i = 0; i < loop.length; i++) segs.push({ a: [...loop[i]], b: [...loop[(i + 1) % loop.length]], kind: 'exterior', thickness, height });
    }
    for (const p of partitions || []) {
      // a partition standing outside the footprint is facade dressing (a coloured frame or fin a few cm
      // off the exterior wall, e.g. aurora's), not a room divider
      const dressing = !rects.some(rc => inRect((p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2, rc));
      segs.push({ a: [...p.from], b: [...p.to], kind: 'partition', thickness: p.thickness || partitionThickness, height: p.height || partitionHeight, partition: p, dressing });
    }

    // 1. snap partition ends onto a segment within `snap` (authored coordinates vs the 0.1 m raster outline). An end
    //    only moves along its partition's own axis, extended or trimmed to meet a segment it points into, never
    //    sideways: an axis-aligned partition stays axis-aligned, and one laid parallel to a wall or partition a few cm
    //    off it stays where it is authored instead of folding onto it or skewing into it. Dressing neither snaps nor
    //    takes a snap: it stays exactly where it is authored.
    for (const s of segs) {
      if (s.kind !== 'partition' || s.dressing) continue;
      for (const [key, other] of [['a', 'b'], ['b', 'a']]) {
        const p = s[key], q = s[other];
        const len = distance(q[0], q[1], p[0], p[1]);
        if (len < EPS) continue;
        const dx = (p[0] - q[0]) / len, dz = (p[1] - q[1]) / len;       // unit axis, out through this end
        let best = null;
        for (const o of segs) {
          if (o === s || o.dressing) continue;
          const u = axisHit(p, dx, dz, o.a, o.b);
          if (u !== null && Math.abs(u) < snap && len + u > CORNER_TOLERANCE && (best === null || Math.abs(u) < Math.abs(best))) best = u;
        }
        if (best) s[key] = [p[0] + dx * best, p[1] + dz * best];
      }
    }
    // 1b. jogs: an end that still meets nothing but sits within `snap` of the end of a parallel partition carrying on
    //     past it (cocoon L1's 1.05 m half-wall, 5 cm off the full-height partition it continues) is joined to that
    //     end by a short wall square to both, so the run still closes its rooms without either leg skewing
    const touches = (p, s) => segs.some(o => o !== s && closestPointOnSegment(p[0], p[1], o.a[0], o.a[1], o.b[0], o.b[1]).dist < CORNER_TOLERANCE);
    for (const s of segs.filter(s => s.kind === 'partition' && !s.dressing)) {
      for (const [key, other] of [['a', 'b'], ['b', 'a']]) {
        const p = s[key], q = s[other];
        const len = distance(q[0], q[1], p[0], p[1]);
        if (len < EPS || touches(p, s)) continue;
        const dx = (p[0] - q[0]) / len, dz = (p[1] - q[1]) / len;
        let best = null;
        for (const t of segs) {
          if (t === s || t.kind !== 'partition' || t.dressing) continue;
          for (const [rk, rk2] of [['a', 'b'], ['b', 'a']]) {
            const r = t[rk], r2 = t[rk2];
            const along = (r[0] - p[0]) * dx + (r[1] - p[1]) * dz, side = (r[0] - p[0]) * dz - (r[1] - p[1]) * dx;
            const onward = (r2[0] - r[0]) * dx + (r2[1] - r[1]) * dz, twist = (r2[0] - r[0]) * dz - (r2[1] - r[1]) * dx;
            const d = distance(p[0], p[1], r[0], r[1]);
            if (d < snap && Math.abs(side) > EPS && onward > EPS && Math.abs(twist) < EPS && len + along > CORNER_TOLERANCE && (!best || d < best.d)) best = { t, r, along, d };
          }
        }
        if (!best) continue;
        s[key] = [p[0] + dx * best.along, p[1] + dz * best.along];             // square the jog: along the axis only
        segs.push({ a: s[key], b: [...best.r], kind: 'partition', thickness: Math.min(s.thickness, best.t.thickness), height: Math.min(s.height, best.t.height) });
      }
    }

    // 2. split every segment at every endpoint / crossing that lies on it
    const cuts = segs.map(() => []);
    const onInterior = (p, s) => {
      const c = closestPointOnSegment(p[0], p[1], s.a[0], s.a[1], s.b[0], s.b[1]);
      return c.dist < CORNER_TOLERANCE && c.t > 1e-6 && c.t < 1 - 1e-6 ? c.t : null;
    };
    for (let i = 0; i < segs.length; i++) for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      for (const p of [segs[j].a, segs[j].b]) { const t = onInterior(p, segs[i]); if (t !== null) cuts[i].push(t); }
      if (j > i) {
        const x = segmentCrossing(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
        if (x) { cuts[i].push(x.t); cuts[j].push(x.u); }
      }
    }

    // 3. corners + walls
    const segWalls = segs.map(() => []);
    segs.forEach((s, i) => {
      const ts = [0, ...cuts[i].sort((p, q) => p - q), 1].filter((t, k, arr) => k === 0 || t - arr[k - 1] > 1e-6);
      for (let k = 0; k + 1 < ts.length; k++) {
        const p = [s.a[0] + (s.b[0] - s.a[0]) * ts[k], s.a[1] + (s.b[1] - s.a[1]) * ts[k]];
        const q = [s.a[0] + (s.b[0] - s.a[0]) * ts[k + 1], s.a[1] + (s.b[1] - s.a[1]) * ts[k + 1]];
        const w = g.newWall(g.getOrCreateCorner(p[0], p[1]), g.getOrCreateCorner(q[0], q[1]), { thickness: s.thickness, height: s.height, kind: s.kind });
        if (w) segWalls[i].push(w);
      }
    });

    // 4. openings — a perimeter opening spans [s0,s1] along its edge; every wall on that edge
    //    overlapping the span gets the overlapping part (a glass run interrupted by a partition end
    //    becomes two panes), so nothing is silently dropped or pokes past a wall end.
    const isEntry = op => !!entry && entry.side === op.side && Math.abs((entry.at ?? NaN) - op.at) < 1e-6;
    const addSpanOpening = (walls, axis, s0, s1, op) => {
      for (const w of walls) {
        const w0 = Math.min(w.start[axis], w.end[axis]), w1 = Math.max(w.start[axis], w.end[axis]);
        const o0 = Math.max(s0, w0 + 0.05), o1 = Math.min(s1, w1 - 0.05);
        if (o1 - o0 < 0.15) continue;
        const centre = (o0 + o1) / 2;
        const at = (centre - w.start[axis]) / (w.end[axis] - w.start[axis]);
        w.addOpening({ ...op, at, w: o1 - o0, clamped: (o1 - o0) < op.w - 1e-6 || undefined });
      }
    };
    for (const op of openings) {
      const e = edgeForOpening(edges, op.side, op.at);
      if (!e) continue;
      const horiz = op.side === 'S' || op.side === 'N';
      const axis = horiz ? 'x' : 'z', other = horiz ? 'z' : 'x';
      const line = horiz ? e.a[1] : e.a[0];
      const along = segs.flatMap((s, i) => s.kind === 'exterior' ? segWalls[i] : [])
        .filter(w => Math.abs(w.start[other] - line) < CORNER_TOLERANCE && Math.abs(w.end[other] - line) < CORNER_TOLERANCE);
      const spec = { kind: op.type || 'door', w: op.w, h: op.h, sill: op.type === 'window' ? (op.sill ?? 0.9) : 0, style: op.style, side: op.side, entry: isEntry(op) || undefined, open: op.open, color: op.color };
      addSpanOpening(along, axis, op.at - op.w / 2, op.at + op.w / 2, spec);
    }
    segs.forEach((s, i) => {
      const p = s.partition;
      if (!p) return;
      const ax = Math.abs(s.b[0] - s.a[0]) > Math.abs(s.b[1] - s.a[1]) ? 0 : 1;
      const dir = Math.sign(s.b[ax] - s.a[ax]) || 1;
      // a single door (`door` / `doorW`), and/or more than one doorway (`doors[]`, HOUSE-SPEC: "door / doorW still
      // work" alongside it) — both are real openings a room's connectivity (and the entry-to-Core walk) must see.
      const doors = [
        ...(p.door !== null && p.door !== undefined ? [{ at: p.door, w: p.doorW, h: undefined }] : []),
        ...(Array.isArray(p.doors) ? p.doors.map((d: any) => ({ at: d.at, w: d.w, h: d.h })) : []),
      ];
      for (const d of doors) {
        const centre = s.a[ax] + dir * d.at;
        const dw = d.w || 0.9, dh = Math.min(DEFAULT_DOOR_HEIGHT, (d.h || p.height || partitionHeight) - 0.15);
        addSpanOpening(segWalls[i], ax === 0 ? 'x' : 'z', centre - dw / 2, centre + dw / 2, { kind: 'door', w: dw, h: dh, sill: 0, style: 'cased' });
      }
    });

    g.update();

    // 5. labels: spec rooms by bounds centre; courtyards (cycles outside the footprint) flagged outdoor
    for (const r of g.rooms) {
      const [cx, cz] = r.centroid();
      if (!rects.some(rc => inRect(cx, cz, rc, 0.01))) g.labelRoom(r, { outdoor: true });
    }
    for (const spec of rooms || []) {
      if (!spec.bounds) continue;
      const [cx, cz] = rectCentre(spec.bounds);
      const room = g.roomAt(cx, cz);
      if (room && !room.name) g.labelRoom(room, { name: spec.name || null, no: spec.no || null });
    }
    return g;
  }

  /** Convenience: a HouseSpec level (+ the spec's entry when it is on this level). */
  static fromLevel(level: any, opts: any = {}) {
    const entry = opts.entry && opts.entry.level === level.id ? opts.entry : null;
    return FloorplanGraph.fromFootprint(level.footprint, level.partitions || [], {
      height: level.height || DEFAULT_WALL_HEIGHT, openings: level.openings || [], rooms: level.rooms || [], ...opts, entry
    });
  }
}
