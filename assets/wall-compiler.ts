// WallCompiler — FloorplanGraph walls → one THREE.Mesh per wall (PARAMETRIC-INTERIORS-PLAN.md §3.2).
//
// Each wall face is a THREE.Shape in the wall's own (u = along, v = up) plane with holes for windows
// and notches for doors (blueprint3d three/edge.ts makeWall), extruded across the wall thickness so
// the two mitred half-edge faces become one watertight solid: the room-side face uses the half-edge's
// interior() points, the far face its exterior() points (or the neighbouring room's interior() for a
// shared partition), and the end caps are the slanted mitre planes between them. Openings are cut
// straight through, so door/window units can be dropped into the holes from `openings[].worldRect`.
//
// Cutaway is done with material clipping planes (three.js `webgl_clipping` example / Roometron) instead
// of swapping LOD groups: applyCutaway(mesh, mode) clips the S/E-facing walls (and partitions) at
// y = 0.85 in 'cutaway' mode, every wall at y = 0.15 in 'down' mode, nothing in 'up'. Walls set
// material.clipShadows so shadow maps follow the cut. The renderer must have
// `renderer.localClippingEnabled = true` (see enableCutaway).
//
// THREE is injected like house-builder.js does, so the page's single import-map copy is used and the
// graph model stays THREE-free.

export const CUTAWAY_HEIGHT = 0.85;   // metres above the wall base — matches room-creator's cutaway walls
export const DOWN_HEIGHT = 0.15;      // 'down' (plan) mode — matches the baseboard plan group
export const WALL_MODES = ['up', 'cutaway', 'down'];
const MODE_ALIAS = { full: 'up', plan: 'down', walls: 'up' };
const CUTAWAY_FACINGS = new Set(['south', 'east', 'partition']);   // same rule as room-creator's applyWallModeToMesh
const EDGE_MARGIN = 0.02;             // metres kept between a hole and a wall end / top

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const len2 = a => Math.hypot(a[0], a[1]);

/** Nearest cardinal for an outward normal [nx, nz]: +Z is south, +X is east. */
export function facingOf(normal) {
  const [nx, nz] = normal;
  if (Math.abs(nx) >= Math.abs(nz)) return nx > 0 ? 'east' : 'west';
  return nz > 0 ? 'south' : 'north';
}

/** Local frame of a wall solid from its two parallel faces (each [[x,z],[x,z]]). */
export function faceFrame(faceA, faceB) {
  const origin = faceA[0];
  const L = len2(sub(faceA[1], origin));
  if (L < 1e-6) return null;
  const d = [(faceA[1][0] - origin[0]) / L, (faceA[1][1] - origin[1]) / L];
  const mid = [(faceB[0][0] + faceB[1][0]) / 2, (faceB[0][1] + faceB[1][1]) / 2];
  const rel = sub(mid, origin);
  let n = [-d[1], d[0]];
  if (dot2(rel, n) < 0) n = [d[1], -d[0]];
  const thickness = dot2(rel, n);
  const uB = faceB.map(p => dot2(sub(p, origin), d));
  return { origin, d, n, L, thickness, uB0: Math.min(...uB), uB1: Math.max(...uB) };
}

/** Which two faces bound a wall solid: the room-side face + the far face (other room, or outside). */
export function wallFaces(wall) {
  const front = wall.frontEdge, back = wall.backEdge;
  const primary = front || back;
  if (!primary) return null;
  const other = primary === front ? back : front;
  const twoSided = !!(other && primary.room && other.room);
  return {
    primary, other,
    faceA: primary.interior(),
    faceB: twoSided ? other.interior() : primary.exterior(),
    exterior: !twoSided && !!primary.room,
    twoSided
  };
}

/**
 * Openings → rectangles in the (u,v) plane, clamped inside both faces and merged where they overlap
 * so the face polygon stays simple. Doors (sill 0) become notches in the contour, windows holes.
 */
export function holesFor(wall, frame, height) {
  const lo = Math.max(0, frame.uB0) + EDGE_MARGIN, hi = Math.min(frame.L, frame.uB1) - EDGE_MARGIN;
  const raw = [];
  for (const op of wall.openings || []) {
    const P = wall.pointAt(op.at ?? 0.5);
    const uc = dot2(sub(P, frame.origin), frame.d);
    const isWindow = op.kind === 'window';
    const w = op.w || 0.9, h = op.h ?? (isWindow ? 1.2 : 2.05), sill = isWindow ? (op.sill ?? 0.9) : 0;
    const u0 = Math.max(lo, uc - w / 2), u1 = Math.min(hi, uc + w / 2);
    const v0 = Math.max(0, sill), v1 = Math.min(height - EDGE_MARGIN, sill + h);
    if (u1 - u0 < 0.1 || v1 - v0 < 0.1) continue;
    raw.push({ op, u0, u1, v0, v1 });
  }
  raw.sort((a, b) => a.u0 - b.u0);
  const merged = [];
  for (const h of raw) {
    const last = merged[merged.length - 1];
    if (last && h.u0 < last.u1 - 1e-6) { last.u1 = Math.max(last.u1, h.u1); last.v0 = Math.min(last.v0, h.v0); last.v1 = Math.max(last.v1, h.v1); last.ops.push(h.op); }
    else merged.push({ ...h, ops: [h.op] });
  }
  for (const h of merged) h.door = h.v0 <= 1e-3;
  return merged;
}

/** CCW face contour in (u,v) with door notches, for a face spanning [u0,u1] × [0,H]. */
export function faceContour(u0, u1, H, holes) {
  const pts = [[u0, 0]];
  for (const h of holes) if (h.door) pts.push([h.u0, 0], [h.u0, h.v1], [h.u1, h.v1], [h.u1, 0]);
  pts.push([u1, 0], [u1, H], [u0, H]);
  return pts;
}
/** CW window holes in (u,v). */
export const windowHoles = holes => holes.filter(h => !h.door).map(h => [[h.u0, h.v0], [h.u0, h.v1], [h.u1, h.v1], [h.u1, h.v0]]);

export function createWallCompiler({ THREE, wallColor = 0xf8fafc, partitionColor = 0xf1f5f9, roughness = 0.7, material = null }: { THREE: any; wallColor?: number; partitionColor?: number; roughness?: number; material?: any } = {} as any) {
  if (!THREE) throw new Error('createWallCompiler: pass { THREE }');
  const V2 = (u, v) => new THREE.Vector2(u, v);

  /** The face-A THREE.Shape (+ window holes) — the blueprint3d makeWall shape, exposed for tests / 2D. */
  function wallShape(faceA, faceB, height, holes) {
    const frame = faceFrame(faceA, faceB);
    if (!frame) return null;
    const shape = new THREE.Shape(faceContour(0, frame.L, height, holes).map(p => V2(p[0], p[1])));
    for (const hole of windowHoles(holes)) shape.holes.push(new THREE.Path(hole.map(p => V2(p[0], p[1]))));
    return { shape, frame };
  }

  /**
   * Mitred wall solid as a non-indexed BufferGeometry in world XZ (y from 0 = wall base).
   * faceA is at t = 0 (normal −n), faceB at t = thickness (normal +n); end caps follow the mitre.
   */
  function buildWallGeometry({ faceA, faceB, height, holes = [] }) {
    const frame = faceFrame(faceA, faceB);
    if (!frame || frame.uB1 - frame.uB0 < 1e-3 || height <= 0) return null;
    const { origin, d, n, L, thickness: T } = frame;
    const H = height;
    const world = (u, v, t) => [origin[0] + d[0] * u + n[0] * t, v, origin[1] + d[1] * u + n[1] * t];

    const pos = [], nrm = [], uv = [];
    const tri = (p, q, r, expect, uvs) => {
      let ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2], bx = r[0] - p[0], by = r[1] - p[1], bz = r[2] - p[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (nx * expect[0] + ny * expect[1] + nz * expect[2] < 0) { [q, r] = [r, q]; [uvs[1], uvs[2]] = [uvs[2], uvs[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const m = Math.hypot(nx, ny, nz) || 1;
      pos.push(...p, ...q, ...r);
      nrm.push(nx / m, ny / m, nz / m, nx / m, ny / m, nz / m, nx / m, ny / m, nz / m);
      uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
    };

    const contourA = faceContour(0, L, H, holes), contourB = faceContour(frame.uB0, frame.uB1, H, holes);
    const wins = windowHoles(holes);
    const faces = [
      { contour: contourA, t: 0, expect: [-n[0], 0, -n[1]] },
      { contour: contourB, t: T, expect: [n[0], 0, n[1]] }
    ];
    for (const f of faces) {
      const verts = [...f.contour, ...wins.flat()];
      const tris = THREE.ShapeUtils.triangulateShape(f.contour.map(p => V2(p[0], p[1])), wins.map(h => h.map(p => V2(p[0], p[1]))));
      for (const [a, b, c] of tris) {
        const P = [verts[a], verts[b], verts[c]];
        tri(world(P[0][0], P[0][1], f.t), world(P[1][0], P[1][1], f.t), world(P[2][0], P[2][1], f.t), f.expect, P.map(p => [p[0] / L, p[1] / H]));
      }
    }
    // side strips: outer contour (A ↔ B, mitred ends) and each window tunnel
    const strips = [{ a: contourA, b: contourB }, ...wins.map(h => ({ a: h, b: h }))];
    for (const s of strips) {
      const m = s.a.length;
      for (let i = 0; i < m; i++) {
        const a0 = s.a[i], a1 = s.a[(i + 1) % m], b0 = s.b[i], b1 = s.b[(i + 1) % m];
        const du = a1[0] - a0[0], dv = a1[1] - a0[1], l = Math.hypot(du, dv) || 1;
        const e = [dv / l, -du / l];                                   // right-hand side of the directed edge
        const expect = [d[0] * e[0], e[1], d[1] * e[0]];
        const p0 = world(a0[0], a0[1], 0), p1 = world(a1[0], a1[1], 0), q0 = world(b0[0], b0[1], T), q1 = world(b1[0], b1[1], T);
        const along = Math.abs(du) >= Math.abs(dv);
        const st = p => along ? [p[0] / L, p[1] / H] : [p[1] / H, p[2] / T];
        tri(p0, p1, q1, expect, [st(p0), st(p1), st(q1)]);
        tri(p0, q1, q0, expect, [st(p0), st(q1), st(q0)]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    return { geometry: geo, frame };
  }

  function makeMaterial(info) {
    if (material) return material(info);
    return new THREE.MeshStandardMaterial({ color: info.exterior ? wallColor : partitionColor, roughness, side: THREE.DoubleSide, clipShadows: true });
  }

  /** Core: two faces + the wall's openings → { mesh, openings: [{ kind, worldRect }], facing }. */
  function compileFaces(wall, faceA, faceB, { baseY = 0, height = wall.height, exterior = true, kind = wall.kind, color = null } = {}) {
    const frame = faceFrame(faceA, faceB);
    if (!frame) return null;
    const holes = holesFor(wall, frame, height);
    const built = buildWallGeometry({ faceA, faceB, height, holes });
    if (!built) return null;
    const facing = exterior ? facingOf(frame.n) : 'partition';
    const mat = makeMaterial({ wall, exterior, facing, kind });
    if (color != null) mat.color.set(color);
    const mesh = new THREE.Mesh(built.geometry, mat);
    mesh.position.set(0, baseY, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = `Wall ${wall.id || ''} (${frame.L.toFixed(2)}m · ${facing})`.replace('  ', ' ');
    const down = new THREE.Vector3(0, -1, 0);
    mesh.userData = {
      category: 'Architecture', tags: 'wall, graph, structure', isWall: true,
      orientation: facing, orientationExplicit: true,
      fullHeight: height, cutawayHeight: Math.min(CUTAWAY_HEIGHT, height), downHeight: Math.min(DOWN_HEIGHT, height),
      graphWall: {
        id: wall.id, kind, facing, exterior, normal: [...frame.n], along: [...frame.d], thickness: frame.thickness,
        length: frame.L, height, baseY,
        planes: { cutaway: new THREE.Plane(down, baseY + CUTAWAY_HEIGHT), down: new THREE.Plane(down, baseY + DOWN_HEIGHT) }
      }
    };
    const openings = holes.flatMap(h => h.ops.map(op => {
      const uc = (h.u0 + h.u1) / 2;
      const cx = frame.origin[0] + frame.d[0] * uc + frame.n[0] * frame.thickness / 2;
      const cz = frame.origin[1] + frame.d[1] * uc + frame.n[1] * frame.thickness / 2;
      return {
        kind: op.kind, wallId: wall.id, entry: !!op.entry, style: op.style, open: op.open, side: op.side,
        worldRect: {
          x: cx, y: baseY + h.v0, z: cz, w: h.u1 - h.u0, h: h.v1 - h.v0, sill: h.v0, thickness: frame.thickness,
          rotationY: Math.atan2(frame.n[0], frame.n[1]),      // local +Z of a unit faces the far (exterior) side
          normal: [...frame.n], along: [...frame.d]
        }
      };
    }));
    return { mesh, openings, facing, exterior, wall, frame, holes };
  }

  /** One wall (uses both half-edges: room-side face + far face). */
  function compileWall(wall, opts = {}) {
    const f = wallFaces(wall);
    if (!f) return null;
    return compileFaces(wall, f.faceA, f.faceB, { ...opts, exterior: f.exterior });
  }
  /** A single HalfEdge (interior + exterior quads) — the raw blueprint3d pattern. */
  function compileHalfEdge(edge, opts = {}) {
    return compileFaces(edge.wall, edge.interior(), edge.exterior(), { ...opts, exterior: !!edge.room });
  }
  /** Every wall of a graph. Meshes are not parented — the caller places/registers them. */
  function compileGraph(graph, opts = {}) {
    const walls = graph.walls.map(w => compileWall(w, opts)).filter(Boolean);
    return { walls, meshes: walls.map(w => w.mesh), openings: walls.flatMap(w => w.openings) };
  }
  /** Room floor: ShapeGeometry over the mitred interior polygon, lying in XZ at baseY. */
  function compileRoomFloor(room, { baseY = 0, color = 0xd6c7a1, material: mat = null } = {}) {
    const poly = room.interiorPolygon();
    if (poly.length < 3) return null;
    const shape = new THREE.Shape(poly.map(p => V2(p[0], p[1])));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);                   // shape (x, y) → world (x, 0, z); DoubleSide handles the flipped normal
    const m = new THREE.Mesh(geo, mat || new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
    m.position.y = baseY + 0.002; m.receiveShadow = true;
    m.name = `Floor ${room.name || room.id}`;
    m.userData = { category: 'Architecture', tags: 'floor, room', room: room.name || room.id };
    return m;
  }

  return { compileWall, compileHalfEdge, compileGraph, compileRoomFloor, buildWallGeometry, wallShape };
}

/** `renderer.localClippingEnabled` must be on for material clipping planes to take effect. */
export function enableCutaway(renderer) { renderer.localClippingEnabled = true; return renderer; }

/**
 * Wall mode via clipping planes. mode: 'up' (no clipping) | 'cutaway' (S/E-facing walls and
 * partitions clipped at base + 0.85, N/W untouched) | 'down' (every wall at base + 0.15).
 * 'full' / 'plan' are accepted as aliases. Only meshes produced by the compiler are affected.
 */
export function applyCutaway(mesh, mode = 'cutaway') {
  const gw = mesh && mesh.userData && mesh.userData.graphWall;
  if (!gw) return mesh;
  const m = MODE_ALIAS[mode] || mode;
  if (!WALL_MODES.includes(m)) throw new Error(`applyCutaway: unknown mode "${mode}"`);
  // world base of the wall: the mesh origin sits on the floor of its level
  let baseY = mesh.position.y;
  if (mesh.matrixWorld && typeof mesh.updateMatrixWorld === 'function') { mesh.updateMatrixWorld(); baseY = mesh.matrixWorld.elements[13]; }
  let planes = null;
  if (m === 'cutaway' && CUTAWAY_FACINGS.has(gw.facing)) { gw.planes.cutaway.constant = baseY + CUTAWAY_HEIGHT; planes = [gw.planes.cutaway]; }
  else if (m === 'down') { gw.planes.down.constant = baseY + DOWN_HEIGHT; planes = [gw.planes.down]; }
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) { if (!mat) continue; mat.clippingPlanes = planes; mat.clipShadows = true; }
  mesh.userData.wallMode = m;
  return mesh;
}
export function applyCutawayAll(meshes, mode = 'cutaway') { for (const m of meshes) applyCutaway(m, mode); return meshes; }
