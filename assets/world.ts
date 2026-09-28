// World — the neighbourhood a HouseSpec's lot sits in, so a house stops being a plate floating in a void:
//
//   street     on the entry side: asphalt, curbs, a verge, sidewalks both sides, a driveway apron (and curb
//              cut) wherever a driveway meets the street — the spec's own and every neighbour's
//   lamps      street lamps down both verges; the lens is tagged userData.fixture = 'street' (the lighting preset
//              scales it by lampGain), and a warm pool on the ground under each follows `house:lighting`
//   neighbours a block, not two houses in a park: the lots either side, a row across the street and a row behind,
//              as plain massing — white / greige walls, near-black gable or hip roofs with eaves, soffits, fascia
//              and rake boards, some with a front-gable bay or a porch on columns, window casings and sills, a
//              garage door, a door and a walk — merged into one mesh per material, each in a soft contact shadow
//   trees      street trees, scattered yard trees and a dense tree line toward the horizon: InstancedMesh, clustered
//              low-poly crowns and tiered conifers in deep muted greens, a soft blob decal under each
//   ground     a 150 m disc (the camera's far plane is 160) with the lot punched out, in the lot's own material;
//              the fog takes the edge. A waterfront lot gets a lake behind it instead of a back row.
//
// Everything stands OUTSIDE spec.lot (the one exception: when a spec driveway stops short of the lot line, a
// flat 6 cm strip carries it the last metre or two to the sidewalk) and clear of the generated camera paths:
// the door-to-core opener starts over the street in front of the entry, and the orbit circles the house at
// span·0.95 + 4 m (house-builder.ts shotsFor) — so nothing taller than a curb is built inside that circle (+4.5 m)
// and no lamp or tree stands near the opener's line. Built in a frame where the street side is +z and turned to
// the entry side, seeded from spec.id (mulberry32 / fnv1a), and built once: nothing here changes per frame (the
// lighting preset flips the lamp pools and the neighbours' lit windows when it changes, never per frame).
//
// Cheap on purpose: ~25 draw calls. Nothing out here casts a shadow — the sun's shadow box is fitted to the lot,
// and a caster straddling its edge throws a shadow cut off in a straight line — so every neighbour sits in a
// soft contact shadow (a vertex-alpha skirt) and every tree on a blob decal instead.
import { mulberry32, fnv1a } from './materials.js';
import { defaultsAtLeast } from './spec/index.js';
import { outlineLoops } from './house-geometry.js';

// The exact outline of a union of axis-aligned rects ({ x, z, w, d }): cells between every distinct coordinate,
// their exposed sides as edges, chained by outlineLoops (every loop; with a few rects none encloses another).
function rectUnion(rects: Array<{ x: number; z: number; w: number; d: number }>) {
  const xs = [...new Set(rects.flatMap(r => [r.x, r.x + r.w]))].sort((a, b) => a - b), zs = [...new Set(rects.flatMap(r => [r.z, r.z + r.d]))].sort((a, b) => a - b);
  const inside = (i: number, k: number) => i >= 0 && k >= 0 && i < xs.length - 1 && k < zs.length - 1 && rects.some(r => (xs[i] + xs[i + 1]) / 2 > r.x && (xs[i] + xs[i + 1]) / 2 < r.x + r.w && (zs[k] + zs[k + 1]) / 2 > r.z && (zs[k] + zs[k + 1]) / 2 < r.z + r.d);
  const edges = [];
  for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < zs.length - 1; k++) {
    if (!inside(i, k)) continue;
    const x0 = xs[i], x1 = xs[i + 1], z0 = zs[k], z1 = zs[k + 1];
    if (!inside(i, k + 1)) edges.push({ side: 'S', a: [x0, z1], b: [x1, z1] });
    if (!inside(i, k - 1)) edges.push({ side: 'N', a: [x0, z0], b: [x1, z0] });
    if (!inside(i + 1, k)) edges.push({ side: 'E', a: [x1, z0], b: [x1, z1] });
    if (!inside(i - 1, k)) edges.push({ side: 'W', a: [x0, z0], b: [x0, z1] });
  }
  return outlineLoops(edges);
}
//
// Pass 4 (S4) — the world stops being one white suburb, each change only when a spec asks for it:
//   lot.street    'S' | 'N' | 'E' | 'W' | 'none' — the street's side, decoupled from the entry (a lake-side entry
//                 with the street behind the house); 'none' builds no street at all
//   lot.context   'suburb' | 'city' | 'forest' | 'desert' | 'waterfront' | 'rural' | 'hillside' — who the neighbours
//                 are and what surrounds them: a city block of taller flat-roofed houses, woods, a sparse desert
//                 road, fields and a barn, a hill rising behind the lot with the houses stepped up it
//   lot.water     'lake' | 'river' | 'canal' | 'sea' | { kind, sides: ['N', …], width, farBank, edge } — water on any
//                 side of the lot (a river `width` wide with trees, houses or hills on its far bank; a canal between
//                 stone quays; a lake or the sea to the horizon), its edge a grass bank, a quay wall or a beach
//   lot.setback   how far the neighbours stand back from the street (the house's own street line, say)
//   defaults: 2   the suburb's houses vary in palette (whites, creams, sage, grey-blue, clay, brick, charcoal) and
//                 style (gable, hip, flat-roofed modern), not white with near-black roofs

type P2 = [number, number];
type P3 = [number, number, number];
type Rect = { x0: number; x1: number; z0: number; z1: number };

// the group turns the local frame (street on +z) onto the entry side; TO_LOCAL is its inverse for plan points
const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
const TO_LOCAL: Record<string, (x: number, z: number) => P2> = { S: (x, z) => [x, z], N: (x, z) => [-x, -z], E: (x, z) => [-z, x], W: (x, z) => [z, -x] };

// Street cross-section, metres outward from the lot line (a US residential street: 1.6 m walk, 1.4 m verge,
// 7.4 m of asphalt between 16 cm curbs), and surface heights — the lot's top is y = 0, the lawn beyond it sits a
// touch lower so the two never share a plane
const WALK = 1.6, VERGE = 1.4, CURB = 0.16, ROAD = 7.4;
const Y = { ground: -0.006, lake: 0.002, road: 0.02, apron: 0.065, walk: 0.085, curb: 0.17, decal: 0.004, ao: 0.007 };
const DISC = 150;            // ground radius; persCamera.far is 160
const STREET_X = 140;        // the street runs this far each way (inside the disc)
const REACH = 72;            // neighbours stand within this of the house along the street; the fog has the rest

// Restraint: white / greige walls, near-black roofs, deep muted greens. Colour comes from the light — the darker
// greiges of the first pass (0xdcd6ca, 0xd9d4cb) read as a grey-beige under the day sky, next to Pascal's whites
const WALLS = [0xf5f4f0, 0xf0eee8, 0xebe8e1, 0xf7f6f3, 0xe6e3dc, 0xeeece6, 0xf2f1ee];
const ROOFS = [0x25272b, 0x2a2c30, 0x2f2e2f, 0x222428, 0x2c2b29];
const LEAVES = [0x2d4a2b, 0x34512f, 0x3a5634, 0x2a4230, 0x40593a, 0x324b36, 0x455a3a];
const DESERT_LEAVES = [0x6b7355, 0x7a7d5c, 0x5f6a4e, 0x8a8a66];
// defaults: 2 and the contexts: houses in more than one colour, roofs in more than one material
const WALLS2 = [0xf5f4f0, 0xefe9dc, 0xe6dcc6, 0xc9cfbf, 0xb9c4c9, 0xd8c4ae, 0x9a5a48, 0x8a8e8f, 0x3d4043, 0xd9d2c4, 0xa8b59d, 0xe9e1d3];
const ROOFS2 = [0x25272b, 0x3a3d42, 0x5b3a2e, 0x8e5440, 0x2f3b33, 0x4a4540, 0x6b6e70];
const CITY_WALLS = [0x8e5a48, 0x9a6a55, 0xb9b3a8, 0xd8d2c6, 0x6f7275, 0xe6e0d4, 0x7d4a3c, 0xa39d92];
const DESERT_WALLS = [0xe3d3b8, 0xd9c4a3, 0xcdb592, 0xe8dcc6, 0xc9a98a, 0xf0e6d6];
const CONTEXTS = ['suburb', 'city', 'forest', 'desert', 'waterfront', 'rural', 'hillside'];

const segDist = (x: number, z: number, a: P2, b: P2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
};
const rectDist = (x: number, z: number, r: Rect) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const rrDist = (a: Rect, b: Rect) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.z0 - a.z1, a.z0 - b.z1));

// ---------------------------------------------------------------------------------------------------------------
// A triangle soup per material. Every face is added with a point it must face AWAY from, so winding never has to
// be right by hand; normals are flat and UVs are in metres (walls: along × up, flat: x × z, roof: along the eave ×
// up the slope), which is what a tiling surface texture wants.
// ---------------------------------------------------------------------------------------------------------------
function createMesher() {
  const buckets = new Map<string, number[]>();
  let xf = (p: P3): P3 => p;
  const at = (key: string) => { let b = buckets.get(key); if (!b) { b = []; buckets.set(key, b); } return b; };
  function tri(key: string, a: P3, b: P3, c: P3, away: P3) {
    const A = xf(a), B = xf(b), C = xf(c), W = xf(away);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;   // degenerate (a hip roof's ridge of length 0)
    const m = [(A[0] + B[0] + C[0]) / 3 - W[0], (A[1] + B[1] + C[1]) / 3 - W[1], (A[2] + B[2] + C[2]) / 3 - W[2]];
    const flip = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0;
    at(key).push(...A, ...(flip ? C : B), ...(flip ? B : C));
  }
  const quad = (key: string, a: P3, b: P3, c: P3, d: P3, away: P3) => { tri(key, a, b, c, away); tri(key, a, c, d, away); };
  function box(key: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, c: P3 = [cx, cy, cz];
    quad(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c);
    quad(key, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], c);
    quad(key, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], c);
    quad(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c);
    quad(key, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], c);
    quad(key, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c);
  }
  // a flat slab over a convex plan polygon, top at y1 (no bottom — it sits on the ground)
  function prism(key: string, poly: P2[], y0: number, y1: number) {
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length, c: P3 = [cx, (y0 + y1) / 2, cz];
    for (let i = 1; i < poly.length - 1; i++) tri(key, [poly[0][0], y1, poly[0][1]], [poly[i][0], y1, poly[i][1]], [poly[i + 1][0], y1, poly[i + 1][1]], [cx, y0 - 1, cz]);
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; quad(key, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], c); }
  }
  function geometry(THREE: any, key: string, slopeUV = false) {
    const pos = buckets.get(key); if (!pos || !pos.length) return null;
    const n = pos.length / 3, nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let t = 0; t < n; t += 3) {
      const i = t * 3, ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const h = Math.hypot(nx, nz);
      for (let k = 0; k < 3; k++) {
        const j = (t + k) * 3, x = pos[j], y = pos[j + 1], z = pos[j + 2];
        nor[j] = nx; nor[j + 1] = ny; nor[j + 2] = nz;
        let u, v;
        if (slopeUV && h > 1e-3 && ny > 0.2) { const hx = nx / h, hz = nz / h; u = -x * hz + z * hx; v = -(x * hx + z * hz) / ny; }
        else if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) { u = x; v = z; }
        else if (Math.abs(nx) >= Math.abs(nz)) { u = z; v = y; }
        else { u = x; v = y; }
        uv[(t + k) * 2] = u; uv[(t + k) * 2 + 1] = v;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }
  return { tri, quad, box, prism, geometry, keys: () => [...buckets.keys()], transform: (f: (p: P3) => P3) => { xf = f; }, reset: () => { xf = p => p; } };
}

// A soft round decal (tree blobs, lamp pools): white centre fading to nothing
function radialTexture(THREE: any, stops: [number, number][]) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, a] of stops) grad.addColorStop(t, `rgba(255,255,255,${a})`);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; return tex;
}

// `ground` is what the lot is made of — a material (a kit surface, shared so the two meet without a seam) or a
// colour; `groundMaterial` is the older spelling of the same thing
export function buildWorld({ THREE, spec, std, kit = null, ground = null, groundMaterial = null, water = null }: { THREE: any; spec: any; std: any; kit?: any; ground?: any; groundMaterial?: any; water?: any }) {
  const root = new THREE.Group();
  root.name = 'World (street · neighbours · tree line)';
  root.userData = { category: 'Site', world: true };
  if (typeof window !== 'undefined' && (window as any).__houseWorld === false) return root;   // QA kill-switch

  const lot = spec.lot || { w: 30, d: 24, ground: 'lawn' };
  const entrySide = (spec.entry && spec.entry.side) || 'S';
  // the street's side: the entry's, unless lot.street says otherwise (S4)
  const side = typeof lot.street === 'string' && TO_LOCAL[lot.street] ? lot.street : entrySide, noStreet = lot.street === 'none';
  const L = TO_LOCAL[side] || TO_LOCAL.S;
  root.rotation.y = ROT[side] || 0;
  const across = side === 'E' || side === 'W';
  const LW = across ? lot.d : lot.w, LD = across ? lot.w : lot.d;   // along the street, and back from it
  const context = CONTEXTS.includes(lot.context) ? lot.context : null, gen2 = defaultsAtLeast(spec, 2);
  const groundKind = lot.ground || 'lawn', desert = groundKind === 'desert' || context === 'desert', forest = groundKind === 'forest' || context === 'forest';
  const city = context === 'city', rural = context === 'rural', hillside = context === 'hillside';
  // palette and style variety: under defaults 2, or in any context but the plain suburb
  const varied = gen2 || (context !== null && context !== 'suburb');
  const rngFor = (key: string) => mulberry32(fnv1a(`${spec.id}:world:${key}`));
  const localRect = (x0: number, z0: number, x1: number, z1: number): Rect => {
    const pts = [L(x0, z0), L(x1, z0), L(x1, z1), L(x0, z1)];
    return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), z0: Math.min(...pts.map(p => p[1])), z1: Math.max(...pts.map(p => p[1])) };
  };

  // ---- the house, and the camera paths shotsFor() will fly around it --------------------------------------
  const rects = (spec.levels || []).flatMap(l => l.footprint || []);
  const hb = rects.length ? localRect(Math.min(...rects.map(r => r.x)), Math.min(...rects.map(r => r.z)), Math.max(...rects.map(r => r.x + r.w)), Math.max(...rects.map(r => r.z + r.d))) : { x0: -6, x1: 6, z0: -4, z1: 4 };
  const cx = (hb.x0 + hb.x1) / 2, cz = (hb.z0 + hb.z1) / 2, span = Math.max(hb.x1 - hb.x0, hb.z1 - hb.z0);
  // nothing tall within keepR of the house centre: the orbit eye flies span·0.45 + 3 m up on a circle of orbitR, and a
  // neighbour's eaves or a tree's crown just outside it would sweep through the corner of the frame
  const orbitR = span * 0.95 + 4, keepR = orbitR + 4.5;
  // the entry door on its wall (a recessed entry is not on the bounding box)
  const entryAt = ((): P2 => {
    const e = spec.entry; if (!e) return [cx, hb.z1];
    const lv = (spec.levels || []).find(l => l.id === e.level) || (spec.levels || [])[0];
    const fp = (lv && lv.footprint) || rects;
    if (e.side === 'S' || e.side === 'N') { const rs = fp.filter(r => e.at >= r.x - 0.01 && e.at <= r.x + r.w + 0.01); if (!rs.length) return [cx, hb.z1]; return L(e.at, e.side === 'S' ? Math.max(...rs.map(r => r.z + r.d)) : Math.min(...rs.map(r => r.z))); }
    const rs = fp.filter(r => e.at >= r.z - 0.01 && e.at <= r.z + r.d + 0.01); if (!rs.length) return [cx, hb.z1];
    return L(e.side === 'E' ? Math.max(...rs.map(r => r.x + r.w)) : Math.min(...rs.map(r => r.x)), e.at);
  })();
  const [ex, ez] = entryAt;
  // door-to-core: establishing eye over the street, a point 6 m out, one 1.6 m out, the door — and the line the
  // opener looks along to the house. (A street on another side than the entry: the same points out from the
  // entry's own face, turned into the street frame.)
  const nE = side === entrySide ? null : L(...({ S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[entrySide] as P2));
  const out = (t: number, n: number): P2 => (nE ? [ex + nE[1] * t + nE[0] * n, ez - nE[0] * t + nE[1] * n] : [ex + t, ez + n]);
  const E0: P2 = nE ? out(span * 0.35, span * 0.45 + 5) : [ex + span * 0.35, ez + span * 0.45 + 5], E1: P2 = nE ? out(2, 6) : [ex + 2, ez + 6], E2: P2 = nE ? out(0, 1.6) : [ex, ez + 1.6];
  const corridor: [P2, P2][] = [[E0, E1], [E1, E2], [E2, [ex, ez]], [E0, [cx, cz]]];
  const nearCorridor = (x: number, z: number, m: number) => corridor.some(([a, b]) => segDist(x, z, a, b) < m);
  const inKeep = (x: number, z: number, m = 0) => Math.hypot(x - cx, z - cz) < keepR + m;

  // ---- the street's cross-section ---------------------------------------------------------------------------
  const zLot = LD / 2;
  const site = spec.site || [];
  const siteRect = (s, dw = 4, dd = 3) => {
    const rot90 = Math.round((((s.rot || 0) % 180) + 180) % 180 / 90) === 1, w0 = s.w || dw, d0 = s.d || dd, w = rot90 ? d0 : w0, d = rot90 ? w0 : d0;
    return localRect(s.at[0] - w / 2, s.at[1] - d / 2, s.at[0] + w / 2, s.at[1] + d / 2);
  };
  // several specs already pave a full-width strip along their front lot line — that IS the sidewalk
  const specWalk = site.some(s => s.type === 'patio' && Array.isArray(s.at) && (() => { const r = siteRect(s); return r.x1 - r.x0 >= LW * 0.7 && r.z1 - r.z0 <= 3 && r.z1 >= zLot - 1; })());
  let z = zLot;
  const nearWalk: P2 | null = specWalk ? null : [z, z += WALK];
  const nearVerge: P2 = [z, z += VERGE], nearCurb: P2 = [z, z += CURB], road: P2 = [z, z += ROAD], farCurb: P2 = [z, z += CURB], farVerge: P2 = [z, z += VERGE], farWalk: P2 = [z, z += WALK];
  const zFar = z;   // the far lot line
  const streetBand = (zz: number, m = 0) => zz > zLot - m && zz < zFar + m;
  // a waterfront lot looks out over a lake behind it (in spec coordinates: everything past its back lot line)
  // S4: lot.water puts water on any side instead (a `waterfront` context with none: a lake behind)
  const LWATER = lot.water !== undefined ? (typeof lot.water === 'string' ? { kind: lot.water } : lot.water) : context === 'waterfront' ? { kind: 'lake' } : null;
  const lake = !LWATER && groundKind === 'waterfront' ? localRect(-100, -lot.d / 2 - 55, 100, -lot.d / 2) : null;
  // each water side: its bank strip, the water and (a river, a canal) the far bank, as rects in the street frame
  type WaterSide = { kind: string; edge: string; bank: Rect; water: Rect; far: Rect | null; farBank: string; out: P2; along: 'x' | 'z' };
  const waterSides: WaterSide[] = [];
  if (LWATER) {
    const kind = ['lake', 'river', 'canal', 'sea'].includes(LWATER.kind) ? LWATER.kind : 'lake';
    const sides: string[] = Array.isArray(LWATER.sides) && LWATER.sides.length ? LWATER.sides.filter(x => TO_LOCAL[x]) : ['N'];
    const width = LWATER.width ?? (kind === 'river' ? 26 : kind === 'canal' ? 11 : DISC);
    const E = kind === 'canal' ? 0.9 : 1.6, edge = LWATER.edge || (kind === 'canal' ? 'wall' : kind === 'sea' ? 'beach' : 'bank');
    const farBank = LWATER.farBank || (kind === 'river' ? 'trees' : kind === 'canal' ? 'houses' : 'none');
    const R = DISC + 20, hw = lot.w / 2, hd = lot.d / 2, finite = width < DISC;
    for (const sd of sides) {
      // in spec coordinates: [c0, c1] across (away from the lot), the full length along
      const span3 = (c0: number, c1: number): [number, number, number, number] => sd === 'N' ? [-R, -hd - c1, R, -hd - c0] : sd === 'S' ? [-R, hd + c0, R, hd + c1] : sd === 'E' ? [hw + c0, -R, hw + c1, R] : [-hw - c1, -R, -hw - c0, R];
      const clipStreet = (r: Rect): Rect => (sd === side ? r : { ...r, z1: Math.min(r.z1, zLot - 0.5) });   // water beside the street stops at it
      // (the bank starts 2 cm off the lot line: the disc's hole for it must not share an edge with the lot's)
      const [a0, b0, a1, b1] = span3(0.02, E), [c0, d0, c1, d1] = span3(E, E + width);
      const out = L(...({ S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[sd] as P2));
      waterSides.push({
        kind, edge, farBank, out, along: Math.abs(out[1]) > 0.5 ? 'x' : 'z',
        bank: clipStreet(localRect(a0, b0, a1, b1)), water: clipStreet(localRect(c0, d0, c1, d1)),
        far: finite ? (() => { const [e0, f0, e1, f1] = span3(E + width, E + width + E); return clipStreet(localRect(e0, f0, e1, f1)); })() : null,
      });
    }
  }
  const wetAt = (x: number, zz: number, m = 0) => (lake ? rectDist(x, zz, lake) < m : false) || waterSides.some(w => rectDist(x, zz, w.water) < m || rectDist(x, zz, w.bank) < m);
  const wetRect = (r: Rect, m = 0) => waterSides.some(w => rrDist(r, w.water) < m || rrDist(r, w.bank) < m || (w.far ? rrDist(r, w.far) < m * 0.5 : false));
  const waterBehind = waterSides.some(w => w.out[1] < -0.5);
  // a hillside: the ground rises behind the lot (local −z), 16 m over 70 m, with a slow roll along it
  const hillPh = rngFor('hill')();
  const hillY = hillside ? (x: number, zz: number) => { const d = -LD / 2 - 8 - zz; if (d <= 0) return 0; const k = Math.min(1, d / 70); return 16 * k * k * (3 - 2 * k) + 2.5 * Math.sin(x * 0.045 + hillPh * 6.28) * Math.min(1, d / 40); } : (_x: number, _z: number) => 0;

  const m = createMesher();
  // aprons: x range + which side; each cuts its sidewalk and curb
  const aprons: { x0: number; x1: number; near: boolean }[] = [];

  // the spec's own driveways, where they head for the street
  for (const s of site) {
    if (s.type !== 'driveway' || !Array.isArray(s.at)) continue;
    const r = siteRect(s);
    if (r.z1 < zLot - 3 || r.x1 < -LW / 2 || r.x0 > LW / 2) continue;
    const x0 = Math.max(r.x0, -LW / 2 + 0.1), x1 = Math.min(r.x1, LW / 2 - 0.1);
    aprons.push({ x0, x1, near: true });
    // carry it to the lot line over open lawn (never under another site item)
    const gap: Rect = { x0, x1, z0: r.z1, z1: zLot };
    const clear = site.every(o => o === s || !Array.isArray(o.at) || o.type === 'patio' || rectDist(...L(o.at[0], o.at[1]), gap) > 0.6);
    if (r.z1 < zLot - 0.02 && zLot - r.z1 <= 3 && clear) m.prism('driveway', [[x0, r.z1], [x1, r.z1], [x1, zLot], [x0, zLot]], 0, 0.06);
  }

  // ---- neighbours: the lots either side, a row across the street, a row behind -----------------------------
  const nr = rngFor('neighbours');
  const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
  type Plan = {
    W: number; D: number; H: number; storeys: number; roof: 'gable' | 'hip' | 'flat'; pitch: number;
    garage: { side: number; GW: number; GD: number; off: number } | null;
    wall: number; roof2: number; chimney: boolean; door: number; lit: number;
    porch: { w: number; d: number } | null; bay: { w: number; out: number } | null;
  };
  const plan = (r: () => number, big: boolean): Plan => {
    const storeys = r() < (big ? 0.7 : 0.5) ? 2 : 1;
    const W = 11 + r() * 5 + (storeys === 1 ? 3 : 0), D = 9.5 + r() * 3;   // a ranch sprawls, a two-storey stacks
    const garage = r() < 0.8 ? { side: r() < 0.5 ? -1 : 1, GW: r() < 0.6 ? 6.6 : 4.2, GD: 7 + r() * 0.8, off: r() * 1.2 } : null;
    const roof: Plan['roof'] = desert || r() < 0.35 ? 'hip' : 'gable';
    const pitch = (desert ? 20 : 26 + r() * 10) * Math.PI / 180;
    // a porch on columns across the door, and (gable houses) a front-gable bay: the two things that make a
    // massing model read as a house from the air
    const porch = !desert && r() < 0.5 ? { w: 3.6 + r() * 2.6, d: 1.9 + r() * 0.5 } : null;
    const bay = roof === 'gable' && r() < 0.55 ? { w: 3.6 + r() * 1.2, out: 0.8 } : null;
    const out: Plan = { W, D, H: storeys === 2 ? 5.9 : 3.1, storeys, roof, pitch, garage, wall: pick(r, varied ? (desert ? DESERT_WALLS : WALLS2) : WALLS), roof2: pick(r, varied ? (desert ? [0x8e5440, 0xa0634a, 0x6b4a3a, 0x5b3a2e] : ROOFS2) : ROOFS), chimney: !desert && r() < 0.4, door: r(), lit: r(), porch, bay };
    // varied: some are flat-roofed moderns (drawn only when varied, so the plain suburb's stream is untouched)
    if (varied && r() < (desert ? 0.35 : 0.22)) { out.roof = 'flat'; out.bay = null; out.chimney = false; }
    return out;
  };
  // a city house: two to four storeys on a narrow lot, flat-roofed or gabled, no garage, in brick, render or stone
  const cityPlan = (r: () => number): Plan => {
    const storeys = 2 + Math.floor(r() * 3), W = 7.5 + r() * 6, D = 10 + r() * 4, flat = r() < 0.6;
    return { W, D, H: storeys * 2.95, storeys, roof: flat ? 'flat' : 'gable', pitch: (28 + r() * 12) * Math.PI / 180, garage: null, wall: pick(r, CITY_WALLS), roof2: pick(r, ROOFS2), chimney: !flat && r() < 0.5, door: r(), lit: r(), porch: null, bay: null };
  };
  const planFor = (r: () => number, big: boolean) => (city ? cityPlan(r) : plan(r, big));
  // where the door, the bay and the porch go on the front face (u along it, main volume centred on u = 0)
  const layout = (p: Plan) => {
    const g = p.garage, doorSide = g ? -g.side : (p.door < 0.5 ? -1 : 1);
    const doorU = doorSide * (p.W / 2 - 2.2 - p.door * 1.5);
    const bayU = p.bay ? -doorSide * (p.W / 2 - p.bay.w / 2 - 0.7) : 0;
    let porch: { u0: number; u1: number; d: number } | null = null;
    if (p.porch) {
      let u0 = Math.max(doorU - p.porch.w / 2, -p.W / 2 + 0.15), u1 = Math.min(doorU + p.porch.w / 2, p.W / 2 - 0.15);
      if (p.bay) { if (doorU < bayU) u1 = Math.min(u1, bayU - p.bay.w / 2 - 0.35); else u0 = Math.max(u0, bayU + p.bay.w / 2 + 0.35); }
      if (u1 - u0 >= 2.4) porch = { u0, u1, d: p.porch.d };
    }
    return { doorU, bayU, porch };
  };
  // footprint in the neighbour's own frame (front face at z = +D/2, main volume centred on x = 0), eaves included
  const extent = (p: Plan) => {
    const g = p.garage, lay = layout(p), eave = 0.5;
    const x0 = -p.W / 2 - (g && g.side < 0 ? g.GW : 0), x1 = p.W / 2 + (g && g.side > 0 ? g.GW : 0);
    const z1 = p.D / 2 + Math.max(eave, lay.porch ? lay.porch.d + 0.35 : 0, p.bay ? p.bay.out + 0.35 : 0);
    const z0 = Math.min(-p.D / 2, g ? p.D / 2 - g.off - g.GD : Infinity) - eave;
    return { x0: x0 - eave, x1: x1 + eave, z0, z1 };
  };
  type House = { p: Plan; ox: number; oz: number; facing: number; row: 'near' | 'far' | 'back'; rect: Rect };
  const houses: House[] = [];
  // facing +1: the front looks toward +z (the street, for the near row); −1: toward −z
  const worldRect = (e: Rect, ox: number, oz: number, facing: number): Rect => facing > 0
    ? { x0: ox + e.x0, x1: ox + e.x1, z0: oz + e.z0, z1: oz + e.z1 }
    : { x0: ox - e.x1, x1: ox - e.x0, z0: oz - e.z1, z1: oz - e.z0 };
  const fits = (r: Rect) => rectDist(cx, cz, r) >= keepR - 0.01 && houses.every(h => rrDist(h.rect, r) >= (city ? 1.2 : 4)) && !wetRect(r, 2);
  const add = (p: Plan, e: Rect, ox: number, oz: number, facing: number, row: House['row']) => { const rect = worldRect(e, ox, oz, facing); houses.push({ p, ox, oz, facing, row, rect }); return rect; };
  const xClear = (x0: number, x1: number) => cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;   // how far the house centre is outside [x0, x1]

  // same side of the street, left and right of the lot: set back like the house is, the nearest pushed out until the
  // orbit circle is clear of it, the next one a side yard further on
  const perSide = city ? 5 : rural ? 1 : desert || forest ? 1 : 2;
  for (const dir of [-1, 1]) {
    let edge = LW / 2 + 3 + nr() * 3;
    for (let k = 0; k < perSide; k++) {
      const p = planFor(nr, span > 16), e = extent(p), sb = 5 + nr() * 3;
      // lot.setback lines the neighbours up with the house's own street line; a city stands close to the walk
      const setback = typeof lot.setback === 'number' ? lot.setback + (sb - 6.5) * 0.15 : city ? 1.5 + (sb - 5) * 0.4 : rural ? sb + 6 : sb;
      const oz = zLot - setback - e.z1;
      const zr0 = oz + e.z0, zr1 = oz + e.z1, dz = cz > zr1 ? cz - zr1 : cz < zr0 ? zr0 - cz : 0;
      const clearX = Math.sqrt(Math.max(0, keepR * keepR - dz * dz));
      const near = Math.max(edge, dir > 0 ? cx + clearX : clearX - cx);
      if (near > REACH + dir * cx) break;
      const ox = dir > 0 ? near - e.x0 : -near - e.x1;
      const rect = worldRect(e, ox, oz, 1);
      if (!fits(rect)) break;
      add(p, e, ox, oz, 1, 'near');
      const gapR = nr();
      const x1r = dir > 0 ? rect.x1 : -rect.x0;
      edge = city ? x1r + 1.4 + gapR * 1.2 : rural ? x1r + 25 + gapR * 30 : x1r + 3 + gapR * 4;
    }
  }
  // across the street, facing it: a row of lots; the one opposite the house is set back further if the orbit needs
  // it, or left as open lawn when that would break the row by more than a few metres
  {
    const density = city ? 1 : rural ? 0.12 : desert ? 0.45 : forest ? 0.55 : 0.92;
    let x = cx - REACH + nr() * 8;
    while (x < cx + REACH && !noStreet) {
      const p = planFor(nr, false), e = extent(p), sb = 5.5 + nr() * 3, keep = nr() < density, gr = nr();
      const setback = city ? 1.5 + (sb - 5.5) * 0.4 : rural ? sb + 10 : sb, gap = city ? 1.4 + gr * 1.2 : 3.5 + gr * 4;
      const wx = e.x1 - e.x0, dx = xClear(x, x + wx);
      const front = zFar + setback, need = cz + Math.sqrt(Math.max(0, keepR * keepR - dx * dx));
      if (keep && need <= front + 5) {
        const ox = x + e.x1, oz = Math.max(front, need) + e.z1;   // facing −1: world x = ox − local x
        if (fits(worldRect(e, ox, oz, -1))) add(p, e, ox, oz, -1, 'far');
      }
      x += wx + gap;
    }
  }
  // behind the lot, back to back with it (their fronts face a street we do not build): not behind a waterfront lot
  // (the lake is there) nor in a forest (the woods are)
  if ((LWATER ? !waterBehind : groundKind !== 'waterfront') && !forest && !rural) {
    const density = city ? 1 : desert ? 0.4 : 0.85;
    let x = cx - REACH * 0.85 + nr() * 8;
    while (x < cx + REACH * 0.85) {
      const p = planFor(nr, span > 16), e = extent(p), yd = 8 + nr() * 5, keep = nr() < density, gr = nr();
      const yard = city ? 3 + (yd - 8) * 0.4 : yd, gap = city ? 1.4 + gr * 1.2 : 3.5 + gr * 4;
      const wx = e.x1 - e.x0, dx = xClear(x, x + wx);
      const rear = -LD / 2 - yard, need = cz - Math.sqrt(Math.max(0, keepR * keepR - dx * dx));   // their back wall line, toward us
      if (keep && rear - need <= 8) {
        const ox = x + e.x1, oz = Math.min(rear, need) + e.z0;   // facing −1: the rect's near edge (z1) is oz − e.z0
        const rect = worldRect(e, ox, oz, -1);
        if (rect.z0 > -(DISC - 35) && fits(rect)) add(p, e, ox, oz, -1, 'back');
      }
      x += wx + gap;
    }
  }

  const leaves = desert ? DESERT_LEAVES : LEAVES;
  const shrubs: { x: number; z: number; h: number; kind: 'shrub'; leaf: number }[] = [];
  const wallKey = (c: number) => `wall:${c.toString(16)}`, roofKey = (c: number) => `roof:${c.toString(16)}`;
  function gableRoof(p: Plan, rk: string, wk: string, u0: number, u1: number, v0: number, v1: number, eaveY: number, alongX: boolean) {
    const P = (u: number, y: number, v: number): P3 => alongX ? [u, y, v] : [v, y, u];
    const tp = Math.tan(p.pitch), o = 0.45, ro = 0.3, t = 0.16;
    const vc = (v0 + v1) / 2, hs = (v1 - v0) / 2, yR = eaveY + hs * tp, yA = eaveY - o * tp;
    const ua = u0 - ro, ub = u1 + ro, va = v0 - o, vb = v1 + o, uc = (u0 + u1) / 2;
    const below = P(uc, eaveY - 1, vc), above = P(uc, yR + 10, vc), mid = P(uc, eaveY, vc);
    for (const ve of [va, vb]) {
      m.quad(rk, P(ua, yA, ve), P(ub, yA, ve), P(ub, yR, vc), P(ua, yR, vc), below);                   // slope
      m.quad('trim', P(ua, yA - t, ve), P(ub, yA - t, ve), P(ub, yR - t, vc), P(ua, yR - t, vc), above);   // soffit
      m.quad('trim', P(ua, yA - t, ve), P(ub, yA - t, ve), P(ub, yA, ve), P(ua, yA, ve), mid);         // fascia
      for (const ue of [ua, ub]) m.quad('trim', P(ue, yA - t, ve), P(ue, yA, ve), P(ue, yR, vc), P(ue, yR - t, vc), mid);   // rake boards
    }
    const cap = alongX ? [ub - ua, 0.09, 0.26] : [0.26, 0.09, ub - ua];
    const cc = P(uc, yR + 0.03, vc); m.box(rk, cc[0], cc[1], cc[2], cap[0], cap[1], cap[2]);
    for (const ue of [u0, u1]) m.tri(wk, P(ue, eaveY, v0), P(ue, eaveY, v1), P(ue, yR, vc), mid);    // gable ends
    return yR;
  }
  function hipRoof(p: Plan, rk: string, x0: number, x1: number, z0: number, z1: number, eaveY: number) {
    const alongX = x1 - x0 >= z1 - z0;
    const P = (u: number, y: number, v: number): P3 => alongX ? [u, y, v] : [v, y, u];
    const [u0, u1, v0, v1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    const tp = Math.tan(p.pitch), o = 0.5, t = 0.16;
    const ua = u0 - o, ub = u1 + o, va = v0 - o, vb = v1 + o, uc = (ua + ub) / 2, vc = (va + vb) / 2;
    const yE = eaveY - o * tp, rise = (vb - va) / 2 * tp, yR = yE + rise, half = Math.max(0, ((ub - ua) - (vb - va)) / 2);
    const r0 = P(uc - half, yR, vc), r1 = P(uc + half, yR, vc), below = P(uc, eaveY - 1, vc), mid = P(uc, yE, vc);
    const c = [P(ua, yE, va), P(ub, yE, va), P(ub, yE, vb), P(ua, yE, vb)];
    m.quad(rk, c[0], c[1], r1, r0, below); m.quad(rk, c[3], c[2], r1, r0, below);
    m.tri(rk, c[0], c[3], r0, below); m.tri(rk, c[1], c[2], r1, below);
    const lo = c.map(q => [q[0], q[1] - t, q[2]] as P3);
    for (let i = 0; i < 4; i++) m.quad('trim', lo[i], lo[(i + 1) % 4], c[(i + 1) % 4], c[i], mid);   // fascia
    m.quad('trim', lo[0], lo[1], lo[2], lo[3], P(uc, yR + 10, vc));                                       // soffit
    return yR;
  }

  // one window on a face: casing, sill, a glass pane set back from the casing, a mullion when it is wide
  type Face = { nx: number; nz: number; c: number };
  const fbox = (key: string, f: Face, u: number, y: number, out: number, len: number, h: number, dep: number) =>
    f.nz ? m.box(key, u, y, f.c + f.nz * out, len, h, dep) : m.box(key, f.c + f.nx * out, y, u, dep, h, len);
  function windowAt(f: Face, u: number, sill: number, w: number, h: number, lit: boolean) {
    fbox(lit ? 'glassLit' : 'glass', f, u, sill + h / 2, 0.012, w, h, 0.024);
    fbox('trim', f, u, sill + h + 0.05, 0.04, w + 0.2, 0.1, 0.08);
    fbox('trim', f, u, sill - 0.05, 0.06, w + 0.3, 0.08, 0.12);
    for (const s of [-1, 1]) fbox('trim', f, u + s * (w / 2 + 0.05), sill + h / 2, 0.04, 0.1, h, 0.08);
    if (w > 1.1) fbox('trim', f, u, sill + h / 2, 0.02, 0.05, h, 0.04);
  }
  const spread = (lo: number, hi: number, n: number, avoid: P2[] = []) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) { const u = lo + (hi - lo) * (i + 0.5) / n; if (!avoid.some(([a, b]) => u > a - 0.7 && u < b + 0.7)) out.push(u); }
    return out;
  };

  // contact shadows: a skirt round each footprint rect, dark at the wall and gone 2.1 m out (two rings, so the
  // fall-off is soft rather than linear); mitred at the corners so neighbouring sides never overlap
  const aoPos: number[] = [], aoA: number[] = [];
  const AO_W = 2.1, AO_IN = 0.46;
  function skirt(r: Rect, hy = 0) {
    const rings = [[0, AO_IN], [AO_W * 0.38, AO_IN * 0.4], [AO_W, 0]];
    const ring = (d: number): P2[] => [[r.x0 - d, r.z0 - d], [r.x1 + d, r.z0 - d], [r.x1 + d, r.z1 + d], [r.x0 - d, r.z1 + d]];
    for (let k = 0; k < 2; k++) {
      const a = ring(rings[k][0]), b = ring(rings[k + 1][0]), ia = rings[k][1], ib = rings[k + 1][1];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, v: [P2, number][] = [[a[i], ia], [a[j], ia], [b[j], ib], [a[i], ia], [b[j], ib], [b[i], ib]];
        for (const [[x, zz], al] of v) { aoPos.push(x, Y.ao + hy, zz); aoA.push(1, 1, 1, al); }
      }
    }
  }

  // a flat roof: a membrane slab inside a parapet in the trim colour; returns its top
  function flatRoof(rk: string, x0: number, x1: number, z0: number, z1: number, eaveY: number) {
    const t = 0.2, h = 0.45, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    m.box(rk, xm, eaveY + 0.05, zm, x1 - x0 - 0.1, 0.1, z1 - z0 - 0.1);
    m.box('trim', xm, eaveY + h / 2, z0 + t / 2, x1 - x0 + 0.04, h, t); m.box('trim', xm, eaveY + h / 2, z1 - t / 2, x1 - x0 + 0.04, h, t);
    m.box('trim', x0 + t / 2, eaveY + h / 2, zm, t, h, z1 - z0); m.box('trim', x1 - t / 2, eaveY + h / 2, zm, t, h, z1 - z0);
    return eaveY + h;
  }
  function neighbour(h: House, idx: number) {
    const { p, ox, oz, facing, row } = h, r = rngFor(`house:${idx}`);
    const hy = hillY(ox, oz);   // (a hillside: the house stands on the hill)
    const toWorld = (q: P3): P3 => [ox + facing * q[0], q[1] + hy, oz + facing * q[2]];
    const toWorldRect = (x0: number, z0: number, x1: number, z1: number): Rect => {
      const a = toWorld([x0, 0, z0]), b = toWorld([x1, 0, z1]);
      return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]) };
    };
    m.transform(toWorld);
    const wk = wallKey(p.wall), rk = roofKey(p.roof2);
    const W = p.W, D = p.D, H = p.H, lay = layout(p), { doorU, bayU } = lay;
    m.box(wk, 0, H / 2, 0, W, H, D);                                                  // main volume
    m.box('plinth', 0, 0.12, 0, W + 0.08, 0.28, D + 0.08);
    skirt(toWorldRect(-W / 2, -D / 2, W / 2, D / 2), hy);
    const g = p.garage;
    let gx0 = 0, gx1 = 0, gz1 = 0, gz0 = 0; const GH = 2.95;
    if (g) {
      gx0 = g.side > 0 ? W / 2 : -W / 2 - g.GW; gx1 = gx0 + g.GW; gz1 = D / 2 - g.off; gz0 = gz1 - g.GD;
      m.box(wk, (gx0 + gx1) / 2, GH / 2, (gz0 + gz1) / 2, g.GW, GH, g.GD);
      m.box('plinth', (gx0 + gx1) / 2, 0.12, (gz0 + gz1) / 2, g.GW + 0.08, 0.28, g.GD + 0.08);
      skirt(toWorldRect(gx0, gz0, gx1, gz1), hy);
    }
    // roofs: the main one along the street (gable) or hipped; the garage's gable end faces the street
    const top = p.roof === 'flat' ? flatRoof(rk, -W / 2, W / 2, -D / 2, D / 2, H) : p.roof === 'hip' ? hipRoof(p, rk, -W / 2, W / 2, -D / 2, D / 2, H) : gableRoof(p, rk, wk, -W / 2, W / 2, -D / 2, D / 2, H, true);
    if (g) {
      if (p.roof === 'flat') flatRoof(rk, gx0, gx1, gz0, gz1, GH);
      else if (p.roof === 'hip') hipRoof({ ...p, pitch: p.pitch * 0.9 }, rk, gx0, gx1, gz0, gz1, GH);
      else gableRoof(p, rk, wk, gz0, gz1, gx0, gx1, GH, false);
    }
    // a front-gable bay: a full-height bump with its own gable facing the street, its back buried in the main roof
    const b = p.bay;
    if (b) {
      const bz1 = D / 2 + b.out;
      m.box(wk, bayU, H / 2, D / 2 + b.out / 2, b.w, H, b.out + 0.02);
      m.box('plinth', bayU, 0.12, D / 2 + b.out / 2, b.w + 0.08, 0.28, b.out + 0.1);
      gableRoof(p, rk, wk, D / 2 - b.w / 2 - 0.25, bz1, bayU - b.w / 2, bayU + b.w / 2, H, false);
      skirt(toWorldRect(bayU - b.w / 2, D / 2, bayU + b.w / 2, bz1), hy);
    }
    if (p.chimney) { const chx = (r() - 0.5) * W * 0.5, chz = -D * 0.15; m.box('chimney', chx, (top + 0.6) / 2, chz, 0.7, top + 0.6, 0.9); }

    // front: a door (under a porch, or with a stoop), a garage door with grooves, windows on every face of every storey
    const front: Face = { nx: 0, nz: 1, c: D / 2 };
    fbox('door', front, doorU, 1.06, 0.02, 1.0, 2.12, 0.04);
    fbox('trim', front, doorU, 2.2, 0.04, 1.3, 0.14, 0.08);
    for (const s of [-1, 1]) fbox('trim', front, doorU + s * 0.58, 1.06, 0.04, 0.12, 2.12, 0.08);
    const pc = lay.porch;
    let stoopZ = D / 2 + 1.4;   // where the front walk starts
    if (pc) {
      // floor, a step, square columns under a beam, a shallow shed roof tucked under the eaves, a soffit
      const pu = (pc.u0 + pc.u1) / 2, pw = pc.u1 - pc.u0, pz1 = D / 2 + pc.d;
      m.box('concrete', pu, 0.11, D / 2 + pc.d / 2, pw, 0.22, pc.d);
      m.box('concrete', doorU, 0.055, pz1 + 0.2, 1.5, 0.11, 0.4);
      const yw = Math.min(2.75, H - 0.4), ov = 0.3, fall = 0.14, yf = yw - fall * (pc.d + ov), t = 0.14;
      const q0 = pc.u0 - 0.2, q1 = pc.u1 + 0.2;
      m.quad(rk, [q0, yw, D / 2], [q1, yw, D / 2], [q1, yf, pz1 + ov], [q0, yf, pz1 + ov], [pu, yw - 3, D / 2 + pc.d / 2]);
      m.quad('trim', [q0, yw - t, D / 2], [q1, yw - t, D / 2], [q1, yf - t, pz1 + ov], [q0, yf - t, pz1 + ov], [pu, yw + 3, D / 2 + pc.d / 2]);
      m.quad('trim', [q0, yf - t, pz1 + ov], [q1, yf - t, pz1 + ov], [q1, yf, pz1 + ov], [q0, yf, pz1 + ov], [pu, yf, D / 2]);
      for (const qe of [q0, q1]) m.quad('trim', [qe, yw - t, D / 2], [qe, yw, D / 2], [qe, yf, pz1 + ov], [qe, yf - t, pz1 + ov], [pu, yw, D / 2 + pc.d / 2]);
      const beamY = yw - fall * (pc.d - 0.12) - t - 0.12;
      m.box('trim', pu, beamY, pz1 - 0.12, pw + 0.1, 0.24, 0.22);
      const cols = pw > 4.6 ? 3 : 2;
      for (let i = 0; i < cols; i++) {
        const cu = pc.u0 + 0.16 + (pw - 0.32) * i / (cols - 1);
        if (Math.abs(cu - doorU) < 0.8 && cols === 3) continue;   // never a column in front of the door
        m.box('trim', cu, (0.22 + beamY - 0.12) / 2, pz1 - 0.12, 0.2, beamY - 0.12 - 0.22, 0.2);
      }
      stoopZ = pz1 + 0.4;
    } else {
      m.box('concrete', doorU, 0.08, D / 2 + 0.7, 1.9, 0.16, 1.4);
    }
    const lit = (k: number) => p.lit < 0.8 && ((idx * 7 + k * 3) % 5) < 3;   // most windows lit at night, not all
    let k = 0;
    const sill = (s: number) => s * (H / p.storeys) + 0.9, wh = (s: number) => Math.min(1.5, H / p.storeys - 1.25);
    const bayAvoid: P2[] = b ? [[bayU - b.w / 2, bayU + b.w / 2]] : [];
    for (let s = 0; s < p.storeys; s++) {
      const n = Math.max(2, Math.round(W / 3.4));
      for (const u of spread(-W / 2 + 0.6, W / 2 - 0.6, n, s === 0 ? [[doorU - 0.6, doorU + 0.6], ...bayAvoid] : bayAvoid)) windowAt(front, u, sill(s), 1.15, wh(s), lit(k++));
      if (b) windowAt({ nx: 0, nz: 1, c: D / 2 + b.out }, bayU, sill(s), Math.min(1.7, b.w - 1.4), wh(s), lit(k++));
      for (const u of spread(-W / 2 + 0.6, W / 2 - 0.6, n)) windowAt({ nx: 0, nz: -1, c: -D / 2 }, u, sill(s), 1.15, wh(s), lit(k++));
      for (const sx of [-1, 1]) {
        if (s === 0 && g && Math.sign(g.side) === sx) continue;   // the garage stands against this side
        for (const u of spread(-D / 2 + 0.8, D / 2 - 0.8, 2)) windowAt({ nx: sx, nz: 0, c: sx * W / 2 }, u, sill(s), 1.0, wh(s), lit(k++));
      }
    }
    // the little gable window, when the gable is tall enough to hold it with its casing
    if (b && (b.w / 2 - 0.45) * Math.tan(p.pitch) > 1.0) windowAt({ nx: 0, nz: 1, c: D / 2 + b.out }, bayU, H + 0.25, 0.6, 0.55, false);
    if (g) {
      const gf: Face = { nx: 0, nz: 1, c: gz1 }, gw = g.GW - 1.5, gu = (gx0 + gx1) / 2;
      fbox('garage', gf, gu, 1.1, 0.02, gw, 2.2, 0.04);
      for (let i = 1; i < 4; i++) fbox('groove', gf, gu, 2.2 * i / 4, 0.045, gw - 0.08, 0.025, 0.012);
      fbox('trim', gf, gu, 2.28, 0.04, gw + 0.28, 0.16, 0.08);
      for (const s of [-1, 1]) fbox('trim', gf, gu + s * (gw / 2 + 0.07), 1.1, 0.04, 0.14, 2.2, 0.08);
      windowAt({ nx: g.side, nz: 0, c: g.side > 0 ? gx1 : gx0 }, (gz0 + gz1) / 2, 1.0, 1.0, 1.2, false);
    }
    m.reset();
    // foundation planting along the front, clear of the door, the porch steps and in front of the bay
    for (let u = -W / 2 + 0.9; u < W / 2 - 0.6; u += 1.2 + r() * 0.9) {
      if (Math.abs(u - doorU) < 1.5 || r() < 0.25) continue;
      const inBay = b && Math.abs(u - bayU) < b.w / 2 + 0.2, inPorch = pc && u > pc.u0 - 0.3 && u < pc.u1 + 0.3;
      const dz = inPorch ? pc.d + 0.55 : inBay ? b.out + 0.6 : 0.7;
      const w = toWorld([u, 0, D / 2 + dz]);
      shrubs.push({ x: w[0], z: w[2], h: 0.42 + r() * 0.3, kind: 'shrub', leaf: pick(r, leaves) });
    }
    if (row === 'back') return;   // their street is out of the picture
    // driveway + walk, in street coordinates: from the garage (or beside the house) to the lot line, then the apron
    const toStreet = (u: number): number => ox + facing * u;
    const lotLine = facing > 0 ? zLot : zFar, fz = oz + facing * (g ? gz1 : D / 2);
    const dwU = g ? (gx0 + gx1) / 2 : (doorU > 0 ? -W / 2 + 2 : W / 2 - 2), dwW = g ? g.GW - 0.9 : 3.2;
    const dx0 = toStreet(dwU) - dwW / 2, dx1 = toStreet(dwU) + dwW / 2;
    m.prism('driveway', [[dx0, Math.min(fz, lotLine)], [dx1, Math.min(fz, lotLine)], [dx1, Math.max(fz, lotLine)], [dx0, Math.max(fz, lotLine)]], Y.ground, 0.05);
    aprons.push({ x0: dx0, x1: dx1, near: facing > 0 });
    // front walk from the stoop (or the porch step) to the sidewalk
    const wx = toStreet(doorU), wz0 = oz + facing * stoopZ;
    if (Math.abs(wx - (dx0 + dx1) / 2) > dwW / 2 + 1) m.prism('concrete', [[wx - 0.6, Math.min(wz0, lotLine)], [wx + 0.6, Math.min(wz0, lotLine)], [wx + 0.6, Math.max(wz0, lotLine)], [wx - 0.6, Math.max(wz0, lotLine)]], Y.ground, 0.045);
  }
  houses.forEach(neighbour);

  // ---- back-yard fences: each neighbour's garden in a U of 1.3 m greige board fence, from just forward of its back wall;
  // where two gardens meet back to back the line is shared (built once). A run that would come inside the orbit
  // circle, near the opener's line, across another house, the lot, the street or the lake is simply left out.
  {
    const fr = rngFor('fences');
    const lotR: Rect = { x0: -LW / 2, x1: LW / 2, z0: -LD / 2, z1: LD / 2 };
    const segRect = (a: P2, b: P2): Rect => ({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) });
    const runOk = (a: P2, b: P2, self: House) => {
      const r = segRect(a, b);
      return segDist(cx, cz, a, b) >= keepR && !corridor.some(([p, q]) => [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as P2].some(([x, zz]) => segDist(x, zz, p, q) < 4))
        && houses.every(h => h === self || rrDist(r, h.rect) >= 1) && rrDist(r, lotR) >= 0.5 && !(r.z1 > zLot - 0.3 && r.z0 < zFar + 0.3)
        && (!lake || rrDist(r, lake) >= 1) && !wetRect(r, 1) && Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < DISC - 12;
    };
    const fence = (a: P2, b: P2) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), alongX = Math.abs(b[1] - a[1]) < 1e-6, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (len < 0.5) return;
      const fy = hillY(mx, mz);
      m.box('fence', mx, 0.66 + fy, mz, alongX ? len : 0.05, 1.16, alongX ? 0.05 : len);         // boards
      m.box('fence', mx, 1.26 + fy, mz, alongX ? len + 0.1 : 0.1, 0.05, alongX ? 0.1 : len + 0.1);  // cap rail
      const n = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i <= n; i++) { const t = i / n; m.box('fence', a[0] + (b[0] - a[0]) * t, 0.68 + fy, a[1] + (b[1] - a[1]) * t, 0.1, 1.36, 0.1); }
    };
    const shared = new Set<string>();
    for (const h of houses) {
      const back = h.row === 'near' ? -1 : 1;                 // the direction its garden runs (away from its front)
      const zWall = back < 0 ? h.rect.z0 : h.rect.z1, zStart = zWall - back * 2.5;
      let zEnd = zWall + back * (7 + fr() * 5), mate: House | null = null;
      // back to back with another house: meet it halfway
      for (const o of houses) {
        if (o === h || o.rect.x1 < h.rect.x0 - 2 || o.rect.x0 > h.rect.x1 + 2) continue;
        const oz = back < 0 ? o.rect.z1 : o.rect.z0;
        if ((oz - zWall) * back <= 0 || (oz - zEnd) * back > 6) continue;
        const mid = (zWall + oz) / 2;
        if ((zEnd - mid) * back > 0) { zEnd = mid; mate = o; }
      }
      const x0 = h.rect.x0 - 1, x1 = h.rect.x1 + 1;
      for (const x of [x0, x1]) { const a: P2 = [x, zStart], b: P2 = [x, zEnd]; if (runOk(a, b, h)) fence(a, b); }
      const key = mate ? [houses.indexOf(h), houses.indexOf(mate)].sort().join(':') : '';
      if (mate && shared.has(key)) continue;
      if (mate) shared.add(key);
      const a: P2 = [mate ? Math.min(x0, mate.rect.x0 - 1) : x0, zEnd], b: P2 = [mate ? Math.max(x1, mate.rect.x1 + 1) : x1, zEnd];
      if (runOk(a, b, h)) fence(a, b); else if (runOk([x0, zEnd], [x1, zEnd], h)) fence([x0, zEnd], [x1, zEnd]);
    }
  }

  // ---- the street ------------------------------------------------------------------------------------------
  // split [−STREET_X, STREET_X] around the aprons of one side (widened by `flare`)
  const runs = (near: boolean, flare: number) => {
    const cuts = aprons.filter(a => a.near === near).map(a => [a.x0 - flare, a.x1 + flare]).sort((a, b) => a[0] - b[0]);
    const out: P2[] = []; let x = -STREET_X;
    for (const [a, b] of cuts) { if (a > x) out.push([x, a]); x = Math.max(x, b); }
    if (x < STREET_X) out.push([x, STREET_X]);
    return out;
  };
  const strip = (key: string, xs: P2, zs: P2, y0: number, y1: number) => m.prism(key, [[xs[0], zs[0]], [xs[1], zs[0]], [xs[1], zs[1]], [xs[0], zs[1]]], y0, y1);
  if (!noStreet) strip('asphalt', [-STREET_X, STREET_X], road, Y.ground, Y.road);
  for (const near of noStreet ? [] : [true, false]) {
    const walk = near ? nearWalk : farWalk, curb = near ? nearCurb : farCurb, verge = near ? nearVerge : farVerge;
    if (walk) for (const xs of runs(near, 0)) strip('sidewalk', xs, walk, Y.ground, Y.walk);
    for (const xs of runs(near, 0.8)) strip('curb', xs, curb, Y.ground, Y.curb);
    // aprons: straight across the walk, flaring across the verge to the curb cut
    for (const a of aprons.filter(q => q.near === near)) {
      const s = near ? 1 : -1, zA = near ? zLot : zFar, zV = near ? verge[0] : verge[1], zC = near ? curb[1] : curb[0];
      m.prism('driveway', [[a.x0, zA], [a.x1, zA], [a.x1, zV], [a.x0, zV]], Y.ground, Y.apron);
      m.prism('driveway', [[a.x0, zV], [a.x1, zV], [a.x1 + 0.8, zC + s * 0.02], [a.x0 - 0.8, zC + s * 0.02]], Y.ground, Y.apron - 0.02);
    }
  }

  // ---- street lamps down both verges, staggered: off the opener's line, off the aprons, clear of the orbit ring --
  const lr = rngFor('lamps');
  const lamps: { x: number; z: number; dir: number }[] = [];
  const lampOk = (x: number, zz: number) => !nearCorridor(x, zz, 4) && Math.abs(Math.hypot(x - cx, zz - cz) - orbitR) > 3.5 && !aprons.some(a => x > a.x0 - 1.5 && x < a.x1 + 1.5) && !lamps.some(l => Math.abs(l.x - x) < 14 && l.z === zz);
  for (const [near, target] of (noStreet ? [] : [[true, ex - LW * (0.45 + lr() * 0.2)], [false, ex + LW * (0.3 + lr() * 0.3)]]) as [boolean, number][]) {
    const zz = near ? (nearVerge[0] + nearVerge[1]) / 2 : (farVerge[0] + farVerge[1]) / 2;
    // the first near the house (as before), then every ~38 m each way until the fog
    const targets = [target]; for (let i = 1; i < 4; i++) targets.push(target - i * 38, target + i * 38);
    for (const t of targets) {
      if (Math.abs(t - cx) > 110) continue;
      for (let d = 0; d < 14; d += 0.5) {
        const x = [t - d, t + d].find(xx => lampOk(xx, zz));
        if (x !== undefined) { lamps.push({ x, z: zz, dir: near ? 1 : -1 }); break; }
      }
    }
  }
  for (const l of lamps) {
    m.box('pole', l.x, 0.25, l.z, 0.34, 0.5, 0.34);
    m.box('pole', l.x, 3.1, l.z, 0.12, 6.2, 0.12);
    m.box('pole', l.x, 6.15, l.z + l.dir * 0.8, 0.08, 0.08, 1.7);
    m.box('pole', l.x, 6.08, l.z + l.dir * 1.65, 0.34, 0.14, 0.62);
    m.box('lens', l.x, 6.0, l.z + l.dir * 1.65, 0.26, 0.02, 0.5);
  }

  // ---- trees ----------------------------------------------------------------------------------------------
  const tr = rngFor('trees');
  type Tree = { x: number; z: number; h: number; kind: 'round' | 'oval' | 'cone' | 'shrub'; leaf: number; floor?: number; low?: number };   // low: crown height × this (fuller, closer to the ground)
  const trees: Tree[] = [];
  const treeOk = (x: number, zz: number, clear: number) => {
    if (Math.hypot(x, zz) > DISC - 8) return false;
    if (Math.abs(x) < LW / 2 + clear && Math.abs(zz) < LD / 2 + clear) return false;       // the lot
    if (inKeep(x, zz, clear)) return false;
    if (!noStreet && streetBand(zz, 0.4)) return false;
    if (nearCorridor(x, zz, 5)) return false;
    if (lake && rectDist(x, zz, lake) < 1.5) return false;
    if (waterSides.length && wetAt(x, zz, 1.5)) return false;
    if (houses.some(q => rectDist(x, zz, q.rect) < clear + 1.2)) return false;
    return true;
  };
  const crownR = (h: number) => 0.38 * h;   // the widest crown build() below gives a tree of height h
  const kindOf = (r: () => number): Tree['kind'] => { const q = r(); return forest ? (q < 0.55 ? 'cone' : q < 0.85 ? 'round' : 'oval') : desert ? (q < 0.8 ? 'round' : 'oval') : (q < 0.66 ? 'round' : q < 0.86 ? 'oval' : 'cone'); };
  // street trees along both verges, clear of lamps and the orbit ring
  for (const near of noStreet ? [] : [true, false]) {
    const zz = near ? (nearVerge[0] + nearVerge[1]) / 2 : (farVerge[0] + farVerge[1]) / 2;
    for (let x = -STREET_X + 6 + tr() * 6; x < STREET_X - 6; x += 11 + tr() * 5) {
      const skip = desert && tr() < 0.6, hh = 7 + tr() * 3, kind: Tree['kind'] = tr() < 0.8 ? 'round' : 'oval', leaf = pick(tr, leaves);
      if (skip || inKeep(x, zz, crownR(hh) + 1.5) || nearCorridor(x, zz, 5) || lamps.some(l => Math.abs(l.x - x) < 4 && Math.abs(l.z - zz) < 3) || aprons.some(a => x > a.x0 - 2 && x < a.x1 + 2)) continue;
      trees.push({ x, z: zz, h: hh, kind, leaf });
    }
  }
  trees.push(...shrubs);
  // yard trees (sparse, in the gardens between the houses) and the tree line (dense, its crowns low enough to read
  // as woods rather than a stand of lollipops), on a jittered grid — rings around the house
  const rIn = Math.max(keepR + 5, Math.hypot(LW / 2, LD / 2) + 6);
  const bands = [
    { r0: rIn, r1: rIn + 24, cell: 7, keep: forest ? (context === 'forest' ? 0.85 : 0.6) : desert ? 0.1 : city ? 0.12 : rural ? 0.1 : 0.34, h: [6, 10], floor: 1.35, low: 1.12 },
    { r0: Math.max(rIn + 26, 58), r1: Math.max(rIn + 64, 100), cell: 4.2, keep: forest ? 0.96 : desert ? 0.18 : city ? 0.1 : rural ? 0.35 : 0.9, h: [9, 15], floor: 1.7, low: 1.3 },
  ];
  for (const [bi, b] of bands.entries()) {
    const br = rngFor(`band:${bi}`);
    for (let gx = -b.r1; gx <= b.r1; gx += b.cell) for (let gz = -b.r1; gz <= b.r1; gz += b.cell) {
      const x = cx + gx + (br() - 0.5) * b.cell * 0.9, zz = cz + gz + (br() - 0.5) * b.cell * 0.9;
      const keep = br(), kind = kindOf(br), hh = b.h[0] + br() * (b.h[1] - b.h[0]), leaf = pick(br, leaves);
      const d = Math.hypot(x - cx, zz - cz);
      if (d < b.r0 || d > b.r1 || keep > b.keep || !treeOk(x, zz, 2) || inKeep(x, zz, crownR(hh) + 1.5)) continue;
      trees.push({ x, z: zz, h: hh, kind, leaf, floor: b.floor, low: b.low });
    }
  }

  // ---- S4: water on the lot's sides — the water (below the lot), its floor, the banks down to it -----------------
  const WY = -0.28, FLOOR = -1.1;
  function quadMesh(pts: P3[], mat: any, name: string) {
    const g = new THREE.BufferGeometry(), [a, b, c, d] = pts;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    // wind it to face up
    const p = g.attributes.position, ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    if (uz * vx - ux * vz < 0) { p.setXYZ(1, ...c); p.setXYZ(2, ...b); p.setXYZ(4, ...d); p.setXYZ(5, ...c); }
    g.computeVertexNormals(); const o = new THREE.Mesh(g, mat); o.receiveShadow = true; o.name = name; return o;
  }
  function buildWater(gm: any) {
    const wmat = (typeof water === 'function' && water('water')) || new THREE.MeshStandardMaterial({ color: 0x35535c, roughness: 0.08, metalness: 0.1 });
    const floorM = std(0x2a3a36, { roughness: 1 });
    const sand = (kit && typeof kit.surface === 'function' && kit.surface('desert')) || std(0xc5ae88, { roughness: 0.95 });
    const stone = (typeof water === 'function' && water('stone', 0x9d968a)) || std(0x9d968a, { roughness: 0.95 });
    for (const w of waterSides) {
      const r = w.water, all = [w.bank, w.water, w.far].filter(Boolean).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }));
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), wmat); pl.rotation.x = -Math.PI / 2; pl.position.set((r.x0 + r.x1) / 2, WY, (r.z0 + r.z1) / 2); pl.receiveShadow = true; pl.name = `World · ${w.kind}`; root.add(pl);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(all.x1 - all.x0, all.z1 - all.z0), floorM); fl.rotation.x = -Math.PI / 2; fl.position.set((all.x0 + all.x1) / 2, FLOOR, (all.z0 + all.z1) / 2); fl.name = 'World · water floor'; root.add(fl);
      // a bank: the strip from an edge at ground height down to the water's edge below it
      const slope = (b: Rect, fromNear: boolean, mat: any, name: string) => {
        const o = w.out, alongX = w.along === 'x', hi = Y.ground, lo = WY - 0.06;
        const nearEdge = (o[0] + o[1] > 0) === fromNear ? 0 : 1;   // which side of the strip is at ground height
        const P = (u: number, t: number, y: number): P3 => alongX ? [u, y, t] : [t, y, u];
        const [u0, u1] = alongX ? [b.x0, b.x1] : [b.z0, b.z1], [t0, t1] = alongX ? [b.z0, b.z1] : [b.x0, b.x1];
        const y0 = nearEdge === 0 ? hi : lo, y1 = nearEdge === 0 ? lo : hi;
        root.add(quadMesh([P(u0, t0, y0), P(u1, t0, y0), P(u1, t1, y1), P(u0, t1, y1)], mat, name));
      };
      if (w.edge === 'wall') {
        // a quay: the bank strip stays at ground height and drops at a stone wall with a coping
        const o = w.out, alongX = w.along === 'x', b = w.bank, edgeT = (o[0] + o[1] > 0) ? (alongX ? b.z1 : b.x1) : (alongX ? b.z0 : b.x0);
        const [u0, u1] = alongX ? [b.x0, b.x1] : [b.z0, b.z1];
        const P = (u: number, t: number, y: number): P3 => alongX ? [u, y, t] : [t, y, u];
        root.add(quadMesh([P(u0, alongX ? b.z0 : b.x0, Y.ground), P(u1, alongX ? b.z0 : b.x0, Y.ground), P(u1, alongX ? b.z1 : b.x1, Y.ground), P(u0, alongX ? b.z1 : b.x1, Y.ground)], gm, 'World · quay'));
        const face = new THREE.Mesh(new THREE.BoxGeometry(alongX ? u1 - u0 : 0.35, 1.1, alongX ? 0.35 : u1 - u0), stone); face.position.set(alongX ? (u0 + u1) / 2 : edgeT, Y.ground - 0.55 + 0.05, alongX ? edgeT : (u0 + u1) / 2); face.receiveShadow = true; face.name = 'World · quay wall'; root.add(face);
        if (w.far) { const f = w.far, fe = (o[0] + o[1] > 0) ? (alongX ? f.z0 : f.x0) : (alongX ? f.z1 : f.x1); root.add(quadMesh([P(u0, alongX ? f.z0 : f.x0, Y.ground), P(u1, alongX ? f.z0 : f.x0, Y.ground), P(u1, alongX ? f.z1 : f.x1, Y.ground), P(u0, alongX ? f.z1 : f.x1, Y.ground)], gm, 'World · quay (far)')); const ff = face.clone(); ff.position.set(alongX ? (u0 + u1) / 2 : fe, face.position.y, alongX ? fe : (u0 + u1) / 2); root.add(ff); }
      } else {
        slope(w.bank, true, w.edge === 'beach' ? sand : gm, 'World · bank');
        if (w.far) slope(w.far, false, w.edge === 'beach' ? sand : gm, 'World · far bank');
      }
    }
  }
  // a hill behind the lot: a height field over the back of the disc, meeting the flat ground at its foot
  const backFar = waterSides.find(w => w.out[1] < -0.5 && w.far && w.farBank === 'hills');
  const hillFrom = hillside ? -LD / 2 - 8 : backFar ? backFar.far.z0 - 1 : null;
  function buildHill(gm: any) {
    const H = (x: number, zz: number) => { const d = hillFrom - zz; if (d <= 0) return Y.ground; const k = Math.min(1, d / 70); return Y.ground + 16 * k * k * (3 - 2 * k) + 2.5 * Math.sin(x * 0.045 + hillPh * 6.28) * Math.min(1, d / 40); };
    const cell = 4, pos: number[] = [];
    for (let x = -DISC; x < DISC; x += cell) for (let zz = hillFrom - cell; zz > -DISC - cell; zz -= cell) {
      const c = [x + cell / 2, zz - cell / 2]; if (Math.hypot(c[0], c[1]) > DISC + 2) continue;
      const a: P3 = [x, H(x, zz), zz], b: P3 = [x + cell, H(x + cell, zz), zz], cc: P3 = [x + cell, H(x + cell, zz - cell), zz - cell], d: P3 = [x, H(x, zz - cell), zz - cell];
      pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const p = g.attributes.position;
    for (let t = 0; t < p.count; t += 3) { const ux = p.getX(t + 1) - p.getX(t), uz = p.getZ(t + 1) - p.getZ(t), vx = p.getX(t + 2) - p.getX(t), vz = p.getZ(t + 2) - p.getZ(t); if (uz * vx - ux * vz < 0) { const x = p.getX(t + 1), y = p.getY(t + 1), z2 = p.getZ(t + 1); p.setXYZ(t + 1, p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2)); p.setXYZ(t + 2, x, y, z2); } }
    g.computeVertexNormals();
    const o = new THREE.Mesh(g, gm); o.receiveShadow = true; o.name = 'World · hill'; root.add(o);
  }

  // ---- S4: the far bank of a river or canal (trees, or a row of houses facing the water), fields, a skyline ------
  const xr = rngFor('context');
  for (const w of waterSides) {
    if (!w.far) continue;
    // the line of the far bank, and outward from it
    const fr = w.far, outward = w.out, alongX = w.along === 'x';
    const lineAt = outward[0] + outward[1] > 0 ? (alongX ? fr.z1 : fr.x1) : (alongX ? fr.z0 : fr.x0), sgn = outward[0] + outward[1] > 0 ? 1 : -1;
    if (w.farBank === 'trees') {
      for (let u = -110; u <= 110; u += 3.2 + xr() * 2.4) for (const k of [0, 1, 2]) {
        const c = lineAt + sgn * (3 + k * 5 + xr() * 4), x = alongX ? u + (xr() - 0.5) * 2 : c, zz = alongX ? c : u + (xr() - 0.5) * 2, hh = 8 + xr() * 7;
        if (Math.hypot(x, zz) > DISC - 8 || xr() < 0.15 || wetAt(x, zz, 1) || (!noStreet && streetBand(zz, 0.4))) continue;
        trees.push({ x, z: zz, h: hh, kind: forest || xr() < 0.25 ? 'cone' : xr() < 0.7 ? 'round' : 'oval', leaf: pick(xr, leaves), floor: 1.5, low: 1.2 });
      }
    } else if (w.farBank === 'houses' && alongX) {
      // a row facing the water, fronts toward the lot
      let u = -REACH + xr() * 6;
      while (u < REACH) {
        const p = planFor(xr, false), e = extent(p), wx = e.x1 - e.x0, facing = sgn > 0 ? -1 : 1;
        const front = lineAt + sgn * (4 + xr() * 3), oz = facing < 0 ? front + e.z1 : front - e.z1, ox = facing < 0 ? u + e.x1 : u - e.x0;
        const rect = worldRect(e, ox, oz, facing);
        if (Math.hypot((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2) < DISC - 25 && !wetRect(rect, 1) && houses.every(h => rrDist(h.rect, rect) >= 3)) { houses.push({ p, ox, oz, facing, row: 'back', rect }); neighbour(houses[houses.length - 1], houses.length - 1); }
        u += wx + (city ? 1.4 : 4 + xr() * 5);
      }
    }
  }
  if (rural) {
    // fields in the ring beyond the neighbours: crop patches, a hedgerow along some field edges, a barn or two
    const FIELD = [0xa8995a, 0x6f8a44, 0x96825a, 0x5f7a3c, 0x7d6448, 0xb3a567];
    const cell = 40, R0 = Math.max(keepR + 3, Math.hypot(LW / 2, LD / 2) + 6);
    let barns = 0;
    for (let gx = -DISC; gx < DISC; gx += cell) for (let gz = -DISC; gz < DISC; gz += cell) {
      const x0 = gx + 1.5 + xr() * 2, x1 = gx + cell - 1.5 - xr() * 2, z0 = gz + 1.5 + xr() * 2, z1 = gz + cell - 1.5 - xr() * 2, c = [(x0 + x1) / 2, (z0 + z1) / 2];
      const r = { x0, x1, z0, z1 };
      if (Math.hypot(c[0], c[1]) > DISC - 20 || rectDist(cx, cz, r) < R0 || (!noStreet && r.z1 > zLot - 2 && r.z0 < zFar + 2) || houses.some(h => rrDist(h.rect, r) < 3) || wetRect(r, 2)) continue;
      m.prism(`field:${pick(xr, FIELD).toString(16)}`, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], Y.ground, 0.004);
      for (const [a, b] of [[[x0, z0], [x1, z0]], [[x0, z0], [x0, z1]]] as [P2, P2][]) {
        if (xr() < 0.5) continue;
        const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 0; t < L2; t += 2.6 + xr() * 1.5) { const x = a[0] + (b[0] - a[0]) * t / L2, zz = a[1] + (b[1] - a[1]) * t / L2; if (treeOk(x, zz, 1)) trees.push({ x, z: zz, h: xr() < 0.12 ? 9 + xr() * 4 : 1.2 + xr() * 0.8, kind: 'shrub', leaf: pick(xr, leaves) }); }
      }
      if (barns < 2 && xr() < 0.08 && Math.hypot(c[0], c[1]) < 110) {
        barns++;
        const bw = 16 + xr() * 6, bd = 10 + xr() * 3, bh = 5 + xr() * 2, bp = { W: bw, D: bd, H: bh, storeys: 1, roof: 'gable', pitch: 38 * Math.PI / 180, garage: null, wall: 0x7d4a3c, roof2: 0x4a4540, chimney: false, door: 0.5, lit: 1, porch: null, bay: null } as Plan;
        m.transform(q => [c[0] + q[0], q[1], c[1] + q[2]]);
        m.box(wallKey(0x7d4a3c), 0, bh / 2, 0, bw, bh, bd); gableRoof(bp, roofKey(0x4a4540), wallKey(0x7d4a3c), -bw / 2, bw / 2, -bd / 2, bd / 2, bh, true);
        m.reset();
        skirt({ x0: c[0] - bw / 2, x1: c[0] + bw / 2, z0: c[1] - bd / 2, z1: c[1] + bd / 2 });
      }
    }
  }
  if (city) {
    // a skyline beyond the block: taller flat-roofed buildings in the far ring
    for (let a = xr() * 0.3; a < Math.PI * 2; a += 0.14 + xr() * 0.12) {
      const d = 72 + xr() * 50, x = cx + Math.cos(a) * d, zz = cz + Math.sin(a) * d, bw = 12 + xr() * 14, bd = 12 + xr() * 12, bh = 12 + xr() * 30, col = pick(xr, CITY_WALLS);
      const r = { x0: x - bw / 2, x1: x + bw / 2, z0: zz - bd / 2, z1: zz + bd / 2 };
      if (Math.hypot(x, zz) > DISC - 15 || (!noStreet && r.z1 > zLot - 2 && r.z0 < zFar + 2) || houses.some(h => rrDist(h.rect, r) < 4) || nearCorridor(x, zz, 8) || wetRect(r, 2)) continue;
      m.box(wallKey(col), x, bh / 2, zz, bw, bh, bd);
      m.box('trim', x, bh + 0.3, zz, bw + 0.1, 0.6, bd + 0.1);
    }
  }

  // ---- ground to the horizon, the lot punched out; a lake behind a waterfront lot ------------------------
  {
    const shape = new THREE.Shape(); shape.absarc(0, 0, DISC, 0, Math.PI * 2, false);
    // ShapeGeometry lies in XY and is turned flat below, which maps shape y onto −z
    const hole = new THREE.Path([[-LW / 2, -LD / 2], [-LW / 2, LD / 2], [LW / 2, LD / 2], [LW / 2, -LD / 2]].map(([x, zz]) => new THREE.Vector2(x, -zz)));
    shape.holes.push(hole);
    // S4: water sides are cut out of the disc too — their union, traced on a 2 m grid and kept inside the disc
    if (waterSides.length) {
      const rects = waterSides.map(w => { const r = [w.bank, w.water, w.far].filter(Boolean).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) })); const C = DISC + 4; return { x: Math.max(r.x0, -C), z: Math.max(r.z0, -C), w: Math.min(r.x1, C) - Math.max(r.x0, -C), d: Math.min(r.z1, C) - Math.max(r.z0, -C) }; });
      const U = rectUnion(rects);
      for (const loop of [U.outer, ...U.holes].filter(l => l.length >= 4)) {
        const pts: P2[] = [];
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i], b = loop[(i + 1) % loop.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
          for (let k = 0; k < n; k++) { let x = a[0] + (b[0] - a[0]) * k / n, zz = a[1] + (b[1] - a[1]) * k / n; const rr = Math.hypot(x, zz); if (rr > DISC - 0.5) { x *= (DISC - 0.5) / rr; zz *= (DISC - 0.5) / rr; } pts.push([x, zz]); }
        }
        shape.holes.push(new THREE.Path(pts.map(([x, zz]) => new THREE.Vector2(x, -zz))));
      }
    }
    const geo = new THREE.ShapeGeometry(shape, 48); geo.rotateX(-Math.PI / 2);
    const gm = ground && ground.isMaterial ? ground : groundMaterial || std(typeof ground === 'number' ? ground : 0x4d7c3a, { roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, gm);
    mesh.position.y = Y.ground; mesh.receiveShadow = true; mesh.name = 'World · ground'; root.add(mesh);
    if (waterSides.length) buildWater(gm);
    if (hillFrom !== null) buildHill(gm);
    if (lake) {
      const lk = new THREE.Mesh(new THREE.PlaneGeometry(lake.x1 - lake.x0, lake.z1 - lake.z0), new THREE.MeshStandardMaterial({ color: 0x35535c, roughness: 0.08, metalness: 0.1 }));
      lk.rotation.x = -Math.PI / 2; lk.position.set((lake.x0 + lake.x1) / 2, Y.lake, (lake.z0 + lake.z1) / 2); lk.receiveShadow = true; lk.name = 'World · lake'; root.add(lk);
    }
  }

  // ---- materials, one mesh per bucket ---------------------------------------------------------------------
  // kit.surface / kit.roofMaterial (assets/materials.ts) when the kit has them; flat colours in the same family if not
  const surface = (name: string, color: number) => (kit && typeof kit.surface === 'function' && kit.surface(name)) || std(color, { roughness: 0.95 });
  const roofMat = (c: number) => (kit && typeof kit.roofMaterial === 'function' && kit.roofMaterial('asphalt-shingle', c)) || std(c, { roughness: 0.92 });
  const glass = () => new THREE.MeshStandardMaterial({ color: 0x2c3640, roughness: 0.1, metalness: 0.4 });
  const mats: Record<string, () => any> = {
    trim: () => std(0xf4f2ed, { roughness: 0.7 }), fence: () => std(0xd3cdc1, { roughness: 0.9 }), plinth: () => std(0x8f8b84, { roughness: 0.95 }), chimney: () => std(0x5a5650, { roughness: 0.9 }),
    door: () => std(0x2f3438, { roughness: 0.6 }), garage: () => std(0xeceae5, { roughness: 0.6 }), groove: () => std(0xb9b6ae, { roughness: 0.8 }),
    glass, glassLit: glass,
    concrete: () => surface('concrete', 0xbdb9b1), driveway: () => surface('driveway', 0xb6b2aa), sidewalk: () => surface('sidewalk', 0xc2bfb8),
    curb: () => surface('curb', 0xcfccc5), asphalt: () => surface('asphalt', 0x2d2f33),
    pole: () => std(0x34373b, { roughness: 0.5, metalness: 0.5 }),
    lens: () => new THREE.MeshStandardMaterial({ color: 0xf5efe2, emissive: 0xffd9a8, emissiveIntensity: 1, roughness: 0.4 }),
  };
  // the lit windows are two meshes on one geometry: tagged glass that the lighting preset makes glow, shown once the
  // lamps are on (lampGain ≥ 0.5, dusk and night), and plain glass the rest of the day — at golden hour a faint glow
  // on an opaque pane read as a brown board, not a lit room
  const litPanes: { lit: any; plain: any }[] = [];
  for (const key of m.keys()) {
    const isRoof = key.startsWith('roof:'), isWall = key.startsWith('wall:');
    const geo = m.geometry(THREE, key, isRoof); if (!geo) continue;
    const mat = isRoof ? roofMat(parseInt(key.slice(5), 16)) : isWall ? std(parseInt(key.slice(5), 16), { roughness: 0.9 }) : (mats[key] || (() => std(0xcccccc)))();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `World · ${key}`; mesh.castShadow = false; mesh.receiveShadow = key !== 'lens' && key !== 'glass' && key !== 'glassLit';
    if (key === 'lens') { mesh.userData.fixture = 'street'; mat.userData.fixture = 'street'; }
    if (key === 'glassLit') {
      mesh.userData.windowGlow = true; mat.userData.windowGlow = true;
      const plain = new THREE.Mesh(geo, glass()); plain.name = 'World · glassLit (unlit)'; plain.castShadow = plain.receiveShadow = false; root.add(plain);
      litPanes.push({ lit: mesh, plain });
    }
    root.add(mesh);
  }

  // ---- contact shadows under the neighbours ---------------------------------------------------------------
  if (aoPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(aoPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(aoA, 4));
    g.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ color: 0x0e150e, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const ao = new THREE.Mesh(g, mat); ao.name = 'World · contact shadows'; ao.castShadow = ao.receiveShadow = false; ao.renderOrder = 1;
    root.add(ao);
  }

  // ---- trees as instances ---------------------------------------------------------------------------------
  if (trees.length) {
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const trunkMat = std(0x40372f, { roughness: 0.95 });
    const ico = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 8); cone.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.6, 1, 1, 5); trunk.translate(0, 0.5, 0);
    // a broadleaf is a core and four satellite blobs, a shrub a core and two; a conifer is three stacked tiers
    const TIERS = [[0.05, 0.5, 1], [0.28, 0.45, 0.76], [0.5, 0.5, 0.5]];
    const blobs = trees.reduce((n, t) => n + (t.kind === 'cone' ? 0 : t.kind === 'shrub' ? 3 : 5), 0), cones = trees.filter(t => t.kind === 'cone').length * TIERS.length;
    const im = (geo, mat, n, name) => { const x = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); x.count = n; x.name = name; x.castShadow = false; x.receiveShadow = false; return x; };
    const crowns = im(ico, leafMat, blobs, 'World · crowns'), spires = im(cone, leafMat, cones, 'World · conifers'), trunks = im(trunk, trunkMat, trees.length, 'World · trunks');
    const shadowTex = radialTexture(THREE, [[0, 0.55], [0.55, 0.3], [1, 0]]);
    const shadows = im(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0f1a10, transparent: true, opacity: 0.6, alphaMap: shadowTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), trees.length, 'World · tree shadows');
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), C = new THREE.Color(), C2 = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const vr = rngFor('tree-shape');
    let ci = 0, si = 0;
    trees.forEach((t, i) => {
      const hy = hillY(t.x, t.z);   // (0 unless the ground rises: a hillside)
      Q.setFromAxisAngle(up, vr() * Math.PI * 2);
      C.setHex(t.leaf).multiplyScalar(0.9 + vr() * 0.2);
      let rad;
      if (t.kind === 'cone') {
        // a conifer: three stacked tiers from just above the ground, each a touch lighter, a stub of trunk under them
        rad = t.h * (0.2 + vr() * 0.05);
        TIERS.forEach(([b, hf, rf], k) => { spires.setMatrixAt(si, M.compose(T.set(t.x, t.h * b + hy, t.z), Q, S.set(rad * rf, t.h * hf, rad * rf))); spires.setColorAt(si++, C2.copy(C).multiplyScalar(1 + 0.05 * k)); });
        trunks.setMatrixAt(i, M.compose(T.set(t.x, hy, t.z), Q, S.set(0.16, t.h * 0.1, 0.16)));
      } else {
        // a broadleaf (or a shrub): a full crown low on a short trunk — a core with satellites round it, the upper ones a
        // touch lighter and the lower ones darker, so it reads as a leafy mass and not as a ball on a stick; the tree
        // line's crowns come down to a couple of metres off the ground
        const shrub = t.kind === 'shrub';
        rad = shrub ? t.h : t.h * (t.kind === 'oval' ? 0.24 : 0.32) * (0.9 + vr() * 0.2);
        const sy = (t.kind === 'oval' ? 1.5 : shrub ? 0.8 : 0.9 + vr() * 0.14) * (t.low || 1), cyy = shrub ? rad * sy * 0.85 : t.h - rad * sy;
        crowns.setMatrixAt(ci, M.compose(T.set(t.x, cyy + hy, t.z), Q, S.set(rad, rad * sy, rad))); crowns.setColorAt(ci++, C);
        const n = shrub ? 2 : 4, a0 = vr() * Math.PI * 2;
        for (let k = 0; k < n; k++) {
          const a = a0 + k * Math.PI * 2 / n + (vr() - 0.5) * 0.6, upper = k % 2 === 0, lift = upper ? 0.3 : -0.2;
          const off = rad * (0.5 + vr() * 0.14), r2 = rad * (0.56 + vr() * 0.16);
          crowns.setMatrixAt(ci, M.compose(T.set(t.x + Math.cos(a) * off, cyy + rad * sy * lift + hy, t.z + Math.sin(a) * off), Q, S.set(r2, r2 * sy, r2)));
          crowns.setColorAt(ci++, C2.copy(C).multiplyScalar(upper ? 1.08 : 0.92));
        }
        trunks.setMatrixAt(i, M.compose(T.set(t.x, hy, t.z), Q, shrub ? S.set(0.001, 0.001, 0.001) : S.set(0.16 + t.h * 0.012, cyy, 0.16 + t.h * 0.012)));
      }
      shadows.setMatrixAt(i, M.compose(T.set(t.x, Y.decal + hy, t.z), Q, S.set(rad * (t.floor || 1.35), 1, rad * (t.floor || 1.35))));
    });
    for (const x of [crowns, spires, trunks, shadows]) { x.instanceMatrix.needsUpdate = true; if (x.instanceColor) x.instanceColor.needsUpdate = true; x.computeBoundingSphere(); root.add(x); }
    if (!shadowTex) shadows.visible = false;
  }

  // ---- the lighting preset: lamp light pools (warm, additive, scaled by lampGain) and the lit windows ----------
  const pools = new THREE.Group(); pools.name = 'World · lamp pools';
  const poolTex = lamps.length ? radialTexture(THREE, [[0, 1], [0.35, 0.55], [1, 0]]) : null;
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffc98f, transparent: true, opacity: 0, alphaMap: poolTex, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  if (lamps.length) {
    const poolGeo = new THREE.CircleGeometry(4.5, 28).rotateX(-Math.PI / 2);
    for (const l of lamps) { const p = new THREE.Mesh(poolGeo, poolMat); p.name = 'World · lamp pool'; p.scale.set(1.35, 1, 0.78); p.position.set(l.x, Y.walk + 0.006, l.z + l.dir * 1.65); pools.add(p); }
    root.add(pools);
  }
  const apply = () => {
    const gain = Number((typeof window !== 'undefined' && (window as any).__houseLighting && (window as any).__houseLighting.lampGain) || 0);
    poolMat.opacity = poolTex ? Math.min(0.55, gain * 0.42) : 0; pools.visible = poolMat.opacity > 0.01;
    for (const { lit, plain } of litPanes) { lit.visible = gain >= 0.5; plain.visible = !lit.visible; }
  };
  apply();
  if (typeof window !== 'undefined') {
    const on = () => { if (!root.parent) { window.removeEventListener('house:lighting', on); return; } apply(); };
    window.addEventListener('house:lighting', on);
  }

  // (houses: each neighbour's row and footprint in the street frame, eaves included — for QA framing)
  const r1 = (v: number) => Math.round(v * 10) / 10;
  root.userData.worldInfo = {
    street: { side, zLot, road, zFar, specWalk, none: noStreet }, context: context || 'suburb', water: waterSides.map(w => ({ kind: w.kind, edge: w.edge, farBank: w.farBank })), neighbours: houses.length, trees: trees.length, lamps: lamps.length, orbitR, keepR,
    houses: houses.map(h => ({ row: h.row, x0: r1(h.rect.x0), x1: r1(h.rect.x1), z0: r1(h.rect.z0), z1: r1(h.rect.z1), porch: !!h.p.porch, bay: !!h.p.bay })),
  };
  return root;
}
