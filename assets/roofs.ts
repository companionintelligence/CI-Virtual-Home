// Roofs — a HouseSpec's `roofs` compiled into what the eye reads on a real house.
//
// The old builders hinged a slab at the edge of `over` (+ overhang) at the wall-top elevation, so the eave sat
// level with the wall top out at the drip edge and the roof passed over the wall line well above it: from any
// low angle there was a wedge of sky between wall and roof, the gable triangles floated out at the rake edge,
// and there was nothing at the edge — no fascia, no gutter, no downspout.
//
// Here every pitched roof is the lower envelope of planes that pass through the WALL LINE at the eave
// elevation (the storey's top) and run on past it to the drip edge, so the eave hangs below the wall top by
// overhang × tan(pitch), the way rafters sit on a wall plate. The envelope is cut face by face out of the
// overhang rectangle, which makes gables, hips and sheds one code path and keeps them watertight for any mix of
// overhangs. An eave reaches max(overhang, how far `over` runs past the walls) — `over` already includes the
// overhang — and a rake at most 0.3 m. Round it:
//   fascia + rake boards   along every drip edge (painted trim — see `paintEave`), a soffit under the overhang
//   gutters                a k-style trough on every eave
//   downspouts             at the building corners under each gutter — dropped wherever the run would cross a
//                          window or door, a porch or a pool, or leave the wall; they land on a lower roof when
//                          one is in the way
//   ridge / hip caps       on every line where two faces meet: a folded cap course of the roof's own material,
//                          half-round ridge tiles on clay
//   gable ends             infill in the wall's own cladding, on the end wall line (not out at the rake), with
//                          an attic window (a louvred vent in a low gable) under the ridge
//   dormers, chimneys      on the front slope / at `chimney.at`
// A side that runs into a taller storey (a wing roof against the upper floor) gets no overhang, no fascia and no
// gutter: the roof stops at that storey's wall instead of passing through it.
//
// Proportions follow the defaults in Pascal's open schema (pascalorg/editor packages/core, MIT): 0.13 m gutter
// profile, 0.07 m leaders on a 2 cm standoff, ~0.15 m deck. The geometry here is our own.
//
// Everything is built in world plan coordinates and returned as one group per roof, positioned at the centre of
// its overhang rectangle at the eave elevation; the page registers each as a roof (fades with the roofs).
// Materials are never shared with anything outside the roof: registerRoof() turns on alpha-hash dissolve and
// the roof fade writes opacity, so a shared wall or neighbour material would dissolve with it.

import { mulberry32, fnv1a } from './materials.js';
import { specDefaults } from './spec/index.js';
import { createArchMaterials } from './arch-materials.js';

type Rect = { x0: number; x1: number; z0: number; z1: number };
type Side = 'N' | 'S' | 'E' | 'W';
type P2 = [number, number];

const DEG = Math.PI / 180;
const SIDES: Side[] = ['S', 'N', 'E', 'W'];
const OUT: Record<Side, P2> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const ROOF_DEFAULT = { gable: 0x3f2a1d, hip: 0x3f2a1d, shed: 0x334155, flat: 0x334155, 'aframe-glass': 0x0f172a, terracotta: 0xb45309 };
const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  const r = ((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t, g = ((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t, bl = (A & 255) * (1 - t) + (B & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
const inR = (x, z, r, tol = 0) => x >= r.x - tol && x <= r.x + r.w + tol && z >= r.z - tol && z <= r.z + r.d + tol;
const inRect = (x, z, r: Rect, tol = 0) => x >= r.x0 - tol && x <= r.x1 + tol && z >= r.z0 - tol && z <= r.z1 + tol;
const along = (s: Side) => (s === 'N' || s === 'S' ? 0 : 1);   // the along-edge plan axis (0 = x, 1 = z)
const edgeOf = (r: Rect, s: Side) => (s === 'N' ? r.z0 : s === 'S' ? r.z1 : s === 'E' ? r.x1 : r.x0);

// Sutherland–Hodgman: keep the part of a convex polygon where f(p) <= 0 (f linear)
function clip(poly: P2[], f: (p: P2) => number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// Gutter cross-section, in (out, up) metres from the top of its back against the fascia: a flat back, a flat
// floor, a front that kicks outward as it rises and a rolled rim — reads as a k-style trough at any distance.
const G = 0.13, GW = 0.125, GT = 0.01;
const GUTTER: P2[] = [
  [0, 0], [0, -G], [0.72 * GW, -G], [0.86 * GW, -0.62 * G], [0.94 * GW, -0.3 * G], [GW, -0.08 * G], [GW, 0],
  [GW - GT, 0], [GW - GT, -0.08 * G], [0.94 * GW - GT, -0.3 * G], [0.86 * GW - GT, -0.62 * G], [0.72 * GW - GT * 0.6, -G + GT], [GT, -G + GT], [GT, 0],
];
// S2 roofs[].finish → the kit's roofing (materials.ts ROOF_KIND by type name); slate and shake use the shingle set in
// their own tones until the kit grows those textures (S1)
const FINISH_KIND = { shingle: 'gable', seam: 'shed', tile: 'terracotta', membrane: 'flat', slate: 'gable', shake: 'gable' };
const FINISH_COLOR = { slate: 0x4b5058, shake: 0x6e5a47 };
// S2 features a downspout keeps off (porch decks, bays, balconies) as plan rects [x0, z0, x1, z1]
function featureRects(spec): number[][] {
  const out = [];
  for (const f of spec.features || []) {
    if (!f) continue;
    if (f.rect) { out.push([f.rect.x, f.rect.z, f.rect.x + f.rect.w, f.rect.z + f.rect.d]); continue; }
    if (!['porch', 'bay', 'balcony'].includes(f.type) || !f.side) continue;
    const lv = (spec.levels || []).find(l => l.id === (f.level || (spec.entry || {}).level)) || (spec.levels || [])[0];
    if (!lv) continue;
    const rs = lv.footprint || [], horiz = f.side === 'S' || f.side === 'N';
    const line = f.side === 'S' ? Math.max(...rs.map(r => r.z + r.d)) : f.side === 'N' ? Math.min(...rs.map(r => r.z)) : f.side === 'E' ? Math.max(...rs.map(r => r.x + r.w)) : Math.min(...rs.map(r => r.x));
    const a0 = f.type === 'bay' ? f.at - f.w / 2 : f.from ?? -99, a1 = f.type === 'bay' ? f.at + f.w / 2 : f.to ?? 99, dep = (f.depth || 1.2) + 0.1, n = OUT[f.side as Side];
    const b0 = line, b1 = line + (horiz ? n[1] : n[0]) * dep;
    out.push(horiz ? [a0, Math.min(b0, b1), a1, Math.max(b0, b1)] : [Math.min(b0, b1), a0, Math.max(b0, b1), a1]);
  }
  return out;
}
// the parts of a convex polygon outside a set of rects, as convex pieces
function subtractRects(poly: P2[], holes: Rect[]): P2[][] {
  let pieces = [poly];
  for (const h of holes) {
    const next = [];
    for (const p of pieces) {
      next.push(clip(p, q => q[0] - h.x0), clip(p, q => h.x1 - q[0]));
      const mid = clip(clip(p, q => h.x0 - q[0]), q => q[0] - h.x1);
      next.push(clip(mid, q => q[1] - h.z0), clip(mid, q => h.z1 - q[1]));
    }
    pieces = next.filter(p => p.length >= 3 && Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) > 1e-4);
  }
  return pieces;
}
const LEADER = [0.075, 0.055];   // rectangular leader: along the wall × out from it
const WALL_HALF = 0.08;          // createParametricWall's 0.16 m walls sit centred on the footprint edge
const STANDOFF = 0.02;
const FT = 0.035;                // fascia board thickness
const DROP = 0.3;                // most a drip edge hangs below the wall top
const RAKE = 0.3;                // most a gable's rake overhangs its end wall
// site items a downspout must not run through (default w × d), and ground cover it may stand on (its height)
const KEEP_OUT = { porch: [6, 2.5], pergola: [4, 3], greenhouse: [3.6, 2.4], pool: [6, 4], 'turtle-pool': [8, 6], pond: [4, 3], hottub: [2.2, 2.2], gazebo: [4.4, 4.4] };
const GROUND_COVER = { deck: 0.12, patio: 0.08, driveway: 0.06 };

// The THREE-free plan of every roof of a spec: its wall rectangle, overhangs, faces and the height functions (under: the
// deck's underside over the eave elevation; topAt: the deck's top, absolute). S2's chimney stacks, knee-wall ceilings
// and lints read these too.
export function planRoofModels(spec) { return (spec.roofs || []).map(rf => planRoofModel(spec, rf)); }
/** the highest roof top over (x, z), or null where no roof covers it */
export function roofTopAt(models, x, z) { let h = null; for (const m of models) if (inRect(x, z, m.o)) { const t = m.topAt(x, z); if (h === null || t > h) h = t; } return h; }
/** the lowest roof underside over (x, z) (absolute), or null */
export function roofUnderAt(models, x, z) { let h = null; for (const m of models) if (inRect(x, z, m.o)) { const u = m.y + (m.type === 'flat' ? 0 : m.under(x, z)); if (h === null || u < h) h = u; } return h; }

function planRoofModel(spec, rf) {
  const levels = spec.levels || [];
  // S2: a pent roof is a shed along a wall; `ends`, `pitches`, `sweep` and `clip` change the form only when given
  const type = rf.type === 'pent' ? 'shed' : (rf.type || 'gable');
  const ends = rf.ends || {};
  const clip = rf.clip === true || (rf.clip === undefined && specDefaults(spec) >= 2);
  const y = rf.y ?? 2.8;
  const over = rf.over;
  const oh = rf.overhang ?? 0;
  const O: Rect = { x0: over.x, x1: over.x + over.w, z0: over.z, z1: over.z + over.d };
  // the wall rectangle: the storey this roof caps (its top is the eave elevation), clipped to `over`
  // (S2: a knee-walled storey's walls stop at its knee — that is the eave its roof sits on)
  const lv = levels.find(l => Math.abs((l.y || 0) + (l.knee !== undefined ? l.knee : (l.height || 2.8)) - y) < 0.05);
  const W: Rect = { ...O };
  if (lv) {
    const rs = (lv.footprint || []).filter(r => r.x < O.x1 && r.x + r.w > O.x0 && r.z < O.z1 && r.z + r.d > O.z0);
    if (rs.length) {
      W.x0 = Math.max(O.x0, Math.min(...rs.map(r => r.x))); W.x1 = Math.min(O.x1, Math.max(...rs.map(r => r.x + r.w)));
      W.z0 = Math.max(O.z0, Math.min(...rs.map(r => r.z))); W.z1 = Math.min(O.z1, Math.max(...rs.map(r => r.z + r.d)));
    }
  }
  // A side abuts when a storey whose walls rise past this eave stands just beyond it (a wing roof against the
  // upper floor, a lean-to against the house): no overhang there, and a roof that reaches into that storey
  // stops at its wall. (S2: a volume of any storey with its own height `h` rises too — a tower over its wing.)
  const rising = levels.filter(l => l !== lv && (l.y || 0) < y + 0.05 && (l.y || 0) + (l.knee !== undefined ? l.knee : (l.height || 2.8)) > y + 0.05).flatMap(l => l.footprint || [])
    .concat(levels.flatMap(l => (l.footprint || []).filter(r => r.h !== undefined && (l.y || 0) < y + 0.05 && (l.y || 0) + r.h > y + 0.05)));
  const abut: Record<Side, boolean> = { N: false, S: false, E: false, W: false };
  for (const s of SIDES) {
    const [nx, nz] = OUT[s], ax = along(s);
    if (ends[s] === 'abut') { abut[s] = true; continue; }
    const hits = [0.1, 0.3, 0.5, 0.7, 0.9].map(f => {
      const x = ax === 0 ? W.x0 + (W.x1 - W.x0) * f : edgeOf(W, s) + nx * 0.05, z = ax === 0 ? edgeOf(W, s) + nz * 0.05 : W.z0 + (W.z1 - W.z0) * f;
      return rising.find(r => inR(x, z, r));
    });
    if (!hits.some(Boolean)) continue;
    abut[s] = true;
    if (hits.every(Boolean)) {
      if (s === 'E') W.x1 = Math.max(W.x0 + 1, Math.min(W.x1, ...hits.map(r => r.x)));
      if (s === 'W') W.x0 = Math.min(W.x1 - 1, Math.max(W.x0, ...hits.map(r => r.x + r.w)));
      if (s === 'S') W.z1 = Math.max(W.z0 + 1, Math.min(W.z1, ...hits.map(r => r.z)));
      if (s === 'N') W.z0 = Math.min(W.z1 - 1, Math.max(W.z0, ...hits.map(r => r.z + r.d)));
    }
  }
  // S2 clip: an eave that would run into a neighbouring flat roof's parapet stops at the wall instead
  if (clip) for (const s of SIDES) {
    if (abut[s] || type === 'flat') continue;
    const [nx, nz] = OUT[s], ax = along(s), e = edgeOf(W, s);
    const px = ax === 0 ? (W.x0 + W.x1) / 2 : e + nx * 0.25, pz = ax === 0 ? e + nz * 0.25 : (W.z0 + W.z1) / 2;
    const probe = (x: number, z: number) => (spec.roofs || []).some(o => o !== rf && o.type === 'flat' && (o.parapet ?? 0.35) > 0 && o.over && Math.abs((o.y ?? 2.8) - y) < 1.2 && inR(x, z, o.over));
    if ([0.25, 0.5, 0.75].some(f => probe(ax === 0 ? W.x0 + (W.x1 - W.x0) * f : px, ax === 0 ? pz : W.z0 + (W.z1 - W.z0) * f))) abut[s] = true;
  }
  const builtIn = (s: Side) => Math.max(0, s === 'N' ? W.z0 - O.z0 : s === 'S' ? O.z1 - W.z1 : s === 'E' ? O.x1 - W.x1 : W.x0 - O.x0);
  const hip = type === 'hip' || type === 'terracotta';
  const ridgeX = (rf.ridge || 'x') === 'x';
  const high: Side = rf.high || 'N';
  const low: Side = ({ N: 'S', S: 'N', E: 'W', W: 'E' } as Record<Side, Side>)[high];
  const endSides: Side[] = ridgeX ? ['E', 'W'] : ['N', 'S'];
  let faces: Side[] = type === 'flat' ? [] : hip ? ['S', 'N', 'E', 'W'] : type === 'shed' ? [low] : ridgeX ? ['S', 'N'] : ['E', 'W'];
  // S2 ends: a gable roof hipped at one end, a hip roof with a gable (or open) end, a side that abuts
  if (type === 'gable') faces = faces.concat(endSides.filter(s => ends[s] === 'hip'));
  if (hip) faces = faces.filter(s => !['gable', 'open', 'abut'].includes(ends[s]));
  // `over` is the footprint plus the overhang already (HOUSE-SPEC: "usually a footprint rect + overhang"), so a
  // side reaches whichever is larger, never their sum — the sum hung 0.8–1 m eaves on every house. Only an
  // `over` carried well past the walls (a roof run out over a porch or a carport) keeps its whole reach.
  const reach = (s: Side) => { const b = builtIn(s); return b > oh + 0.15 ? b : Math.max(b, oh); };
  const ov: Record<Side, number> = { N: 0, S: 0, E: 0, W: 0 };
  for (const s of SIDES) ov[s] = abut[s] ? 0 : reach(s);
  // rakes stay tight: a gable end reads as a crisp outline, not as a second eave
  let rakes: Side[] = type === 'flat' || hip ? [] : type === 'shed' ? SIDES.filter(s => s !== low && s !== high) : ridgeX ? ['E', 'W'] : ['N', 'S'];
  if (type === 'gable') rakes = rakes.filter(s => ends[s] !== 'hip');
  if (hip) rakes = SIDES.filter(s => ends[s] === 'gable' || ends[s] === 'open');
  for (const s of rakes) if (!abut[s] && builtIn(s) <= oh + 0.15) ov[s] = Math.min(ov[s], RAKE);
  if (hip) {   // a hip's eaves run level all round only when every free side overhangs the same amount
    const free = SIDES.filter(s => !abut[s] && !rakes.includes(s));
    const u = free.length ? Math.min(...free.map(s => ov[s])) : 0;
    for (const s of free) ov[s] = u;
  }
  const o: Rect = { x0: W.x0 - ov.W, x1: W.x1 + ov.E, z0: W.z0 - ov.N, z1: W.z1 + ov.S };
  const pitchDeg = rf.pitch || (hip ? 28 : type === 'shed' ? 14 : 32);
  const pitch = pitchDeg * DEG, t = Math.tan(pitch);
  // S2 pitches: per-face (a saltbox's steep front and long shallow back); every face keeps `t` otherwise
  const tS: Record<Side, number> = { N: t, S: t, E: t, W: t };
  if (rf.pitches) for (const s of SIDES) if (typeof rf.pitches[s] === 'number') tS[s] = Math.tan(rf.pitches[s] * DEG);
  // The drip edge hangs below the wall top by overhang × tan(pitch), but never more than DROP: past that a
  // deep eave on a steep roof swallows the upper-floor windows. The rest is a raised heel — the plane crosses
  // the wall line that far above the wall top, and a frieze in the wall's cladding closes the gap. (S2 sweep: a
  // catslide face runs on down over its wing, no heel.)
  const sweep = new Set<Side>(rf.sweep || []);
  const drop: Record<Side, number> = { N: 0, S: 0, E: 0, W: 0 }, heel: Record<Side, number> = { N: 0, S: 0, E: 0, W: 0 };
  for (const s of SIDES) { drop[s] = sweep.has(s) ? ov[s] * tS[s] : Math.min(ov[s] * tS[s], DROP); heel[s] = ov[s] * tS[s] - drop[s]; }
  // height of a face's underside above the eave elevation: `heel` on its own wall line, rising inward
  const plane = (s: Side, x: number, z: number) => (s === 'S' ? W.z1 - z : s === 'N' ? z - W.z0 : s === 'E' ? W.x1 - x : x - W.x0) * tS[s] + heel[s];
  const under = (x: number, z: number) => (faces.length ? Math.min(...faces.map(s => plane(s, x, z))) : 0);
  const T = type === 'flat' ? 0.22 : type === 'aframe-glass' ? 0.06 : 0.14 / Math.cos(pitch);   // vertical deck thickness
  const topAt = (x: number, z: number) => y + (type === 'flat' ? 0.22 : under(Math.min(o.x1, Math.max(o.x0, x)), Math.min(o.z1, Math.max(o.z0, z))) + T);
  // S2 clip: where a storey stands up through the roof's plan (not just against a side), the deck is cut round it
  const holes: Rect[] = !clip ? [] : rising.map(r => ({ x0: Math.max(o.x0, r.x), x1: Math.min(o.x1, r.x + r.w), z0: Math.max(o.z0, r.z), z1: Math.min(o.z1, r.z + r.d) }))
    .filter(h => h.x1 - h.x0 > 0.3 && h.z1 - h.z0 > 0.3);
  return { rf, type, y, lv, W, o, ov, abut, pitch, t, tS, T, faces, plane, under, topAt, hip, ridgeX, high, low, heel, ends, rakes, holes, clip };
}


export function buildRoofs(spec, deps) {
  const { THREE, kit = null, palette = {} } = deps;
  const levels = spec.levels || [];
  const d2 = specDefaults(spec) >= 2;
  let _am = null; const am = () => _am || (_am = createArchMaterials(THREE, kit));   // S2 materials, only when a field asks
  // S2 features a downspout must not run through (porches, bays, balconies): plan rects, [x0, z0, x1, z1]
  const featureKeep = featureRects(spec);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const basis = (ex, ey, ez) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color: hex(color), roughness: 0.75, ...extra });
  // a private copy of a kit material (keeps a world-UV shader patch)
  const own = m => { const c = m.clone(); if (m.onBeforeCompile) c.onBeforeCompile = m.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey; return c; };
  const glass = () => new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.32, roughness: 0.06, transmission: 0.85, ior: 1.52, side: THREE.DoubleSide });
  const trim = hex(palette.trim || '#1e293b');
  // wall-coloured pieces of the roof (gable ends, dormers, parapets, clerestories) wear the house's cladding
  let claddingCopy = null;
  const houseCladding = wallColor => {
    if (kit && typeof kit.cladding === 'function') return claddingCopy || (claddingCopy = own(kit.cladding()));
    return std(wallColor, { roughness: 0.85 });
  };
  // the footprint rect (any storey) with its own cladding whose walls this roof caps: under its wall rect, topping out at
  // its eave (a volume's own `h`, or its storey's top)
  const volumeUnder = m => {
    const cx = (m.W.x0 + m.W.x1) / 2, cz = (m.W.z0 + m.W.z1) / 2;
    for (const l of levels) for (const r of [...(l.footprint || [])].reverse()) {
      if (r.material === undefined && r.color === undefined) continue;
      if (!inR(cx, cz, r, 0.01)) continue;
      const top = (l.y || 0) + (r.h !== undefined ? r.h : l.knee !== undefined ? l.knee : (l.height || 2.8));
      if (Math.abs(top - m.y) < 0.06) return r;
    }
    return null;
  };

  // Chimney brick: a running bond on a seeded canvas (0.9 × 0.75 m tile: four 225 mm bricks, ten 75 mm
  // courses), one per house; plain colour where there is no DOM (Node-side validation builds).
  let brickMat = null;
  const brickMaterial = () => {
    if (brickMat) return brickMat;
    const base = mix(0x8a4a38, 0x57534e, 0.45);
    if (typeof document === 'undefined') return (brickMat = std(base, { roughness: 0.92 }));
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g2 = c.getContext('2d');
    const r = mulberry32(fnv1a(`${spec.id || 'house'}:chimney-brick`));
    const css = (v: number) => `#${v.toString(16).padStart(6, '0')}`;
    g2.fillStyle = css(mix(base, 0xd6d3d1, 0.55)); g2.fillRect(0, 0, 256, 256);   // mortar
    const bw = 256 / 4, bh = 256 / 10, m = 3;
    for (let row = 0; row < 10; row++) for (let col = -1; col < 5; col++) {
      const j = (r() - 0.5) * 0.3;
      g2.fillStyle = css(mix(base, j > 0 ? 0xffffff : 0x000000, Math.abs(j)));
      g2.fillRect(col * bw + (row % 2 ? bw / 2 : 0) + m / 2, row * bh + m / 2, bw - m, bh - m);
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / 0.9, 1 / 0.75); tex.anisotropy = 4;
    return (brickMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  };

  const hexOr = (c, d) => (c === undefined || c === null ? d : hex(c));
  // S2 planted roofs: a meadow or sedum surface from the kit's lawn set (a fresh material: the roof fade writes to it)
  const plantedMaterial = kind => {
    const set = am().setOf('lawn', kind === 'sedum' ? { color: 0x74784a, dry: 0x8a6e4e, deep: 0x5a6a3a } : { color: 0x587244, dry: 0x7c7f4e, deep: 0x3f5a33 });
    return set ? am().pbr(set, { mode: 'auto', macro: 0.25 }) : std(kind === 'sedum' ? 0x74784a : 0x587244, { roughness: 0.95 });
  };
  // a chimney in the spec's colour: the running bond again, re-seeded for that colour
  const bricks = new Map();
  const colouredBrick = (base: number) => {
    if (bricks.has(base)) return bricks.get(base);
    if (typeof document === 'undefined') { const m0 = std(base, { roughness: 0.92 }); bricks.set(base, m0); return m0; }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g2 = cv.getContext('2d');
    const r = mulberry32(fnv1a(`${spec.id || 'house'}:chimney-brick:${base}`));
    const css = (v: number) => `#${v.toString(16).padStart(6, '0')}`;
    g2.fillStyle = css(mix(base, 0xd6d3d1, 0.55)); g2.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 10; row++) for (let col = -1; col < 5; col++) { const j = (r() - 0.5) * 0.3; g2.fillStyle = css(mix(base, j > 0 ? 0xffffff : 0x000000, Math.abs(j))); g2.fillRect(col * 64 + (row % 2 ? 32 : 0) + 1.5, row * 25.6 + 1.5, 61, 22.6); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(1 / 0.9, 1 / 0.75); tex.anisotropy = 4;
    const m0 = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }); bricks.set(base, m0); return m0;
  };

  // plan every roof first: a downspout lands on a lower roof, so each roof needs the others' surfaces
  const models = planRoofModels(spec);
  const spouts: P2[] = [];   // plan positions already taken (two roofs meeting at a corner share one pipe)
  return models.map(buildRoof);

  function buildRoof(m) {
    const { rf, type, W, o, ov, abut, t, T, faces, plane, under, heel } = m;
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    const outer = new THREE.Group();
    outer.name = `Roof · ${type} (${+(o.x1 - o.x0).toFixed(2)}×${+(o.z1 - o.z0).toFixed(2)})`;
    outer.userData = { category: 'Architecture', isRoof: true };
    const g = new THREE.Group(); g.name = 'Roof parts'; g.position.set(-cx, 0, -cz); outer.add(g);   // world plan coordinates, y from the eave elevation
    const add = (mesh, shadow = true) => { mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); return mesh; };

    const isGlass = type === 'aframe-glass';
    // S2 finish: the roofing independent of the form; `color` honoured, else (with a finish, or under defaults: 2)
    // the palette's roof colour
    const kindKey = rf.finish ? (FINISH_KIND[rf.finish] || type) : type;
    const color = hex(rf.color || (rf.finish && FINISH_COLOR[rf.finish]) || ((rf.finish || d2) && palette.roof) || (ROOF_DEFAULT as any)[type] || 0x3f2a1d);
    const kitRoof = !isGlass && kit && typeof kit.roofMaterial === 'function' ? kit.roofMaterial(kindKey, color) : null;
    const roofMat = isGlass ? glass() : rf.planted ? plantedMaterial(rf.planted) : kitRoof ? own(kitRoof) : std(color, type === 'shed' ? { roughness: 0.6, metalness: 0.15 } : { roughness: 0.85 });
    const wallColor = hex((m.lv && m.lv.wallColor) || palette.wall || '#f8fafc');
    // S2: a roof that caps a volume with its own cladding (footprint[i].material / .color) wears that volume's cladding
    // on its gable ends, parapets, friezes and dormers — not the house's
    const vol = volumeUnder(m);
    const cladding = vol ? (() => { let c = null; return () => c || (c = am().own(am().cladding({ kind: vol.material || palette.material || 'stucco', color: vol.color || palette.wall || '#f1f5f9' }))); })() : houseCladding;
    // The eaves — fascia, rake boards, soffit, gutters, leaders — are painted trim, the white outline every
    // pitched roof in Pascal's frames wears. A light house with dark CHROMATIC trim (brown on stucco, navy on
    // clapboard) paints them its own wall colour lifted, as a boxed eave usually is; dark trim on a dark house,
    // and near-black trim (a deliberate modern-farmhouse line), keep the trim. Flat roofs keep the trim as a
    // slab-edge accent.
    const lum = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
    const spread = (c: number) => { const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255]; return Math.max(...ch) - Math.min(...ch); };
    const paintEave = type !== 'flat' && lum(trim) < 0.5 && lum(wallColor) > 0.55 && spread(trim) > 14;
    const edge = rf.trim ? hex(rf.trim) : isGlass ? 0x0f172a : paintEave ? mix(wallColor, 0xffffff, 0.62) : trim;
    const fasciaMat = std(edge, { roughness: 0.6 });
    const soffitMat = std(rf.soffit ? hex(rf.soffit) : isGlass ? 0x0f172a : mix(edge, 0xffffff, 0.2), { roughness: 0.85 });
    const gutterMat = std(edge, { roughness: 0.45, metalness: 0.15 });
    // Ridge and hip caps are the roof's own material a shade darker (a cap course of the same shingle or tile),
    // not a painted line: a 30 % darker stripe outlined every hip like a cartoon.
    const clay = type === 'terracotta' || (kitRoof && kitRoof.userData && kitRoof.userData.roofKind === 'clay-tile');
    // gutters: on by default; S2 `gutters: false`, and under defaults: 2 none on clay tile
    const wantGutters = rf.gutters ?? !(d2 && clay);
    const capMat = isGlass ? std(0x0f172a, { roughness: 0.8 }) : (() => {
      const c = kitRoof ? own(kitRoof) : std(color, { roughness: 0.85 });
      c.color = c.color.clone().multiplyScalar(clay ? 0.9 : 0.8);
      return c;
    })();
    // attic and dormer glazing: dark, a little reflective — glass reads as glass from the street, not as the
    // cladding or the empty roof void seen through a tint
    const darkGlass = () => new THREE.MeshStandardMaterial({ color: 0x1d242b, roughness: 0.14, metalness: 0.5, envMapIntensity: 1.2 });

    if (type === 'flat') {
      flat();
      // S2: a chimney on a flat roof (v1 never built one: only when the chimney says more than `at`, or defaults: 2)
      if (rf.chimney && (d2 || Object.keys(rf.chimney).some(k => k !== 'at'))) chimney(rf.chimney);
      if (rf.skylights) for (const sk of rf.skylights) skylight(sk);
      if (rf.planted) plantedExtras();
      return { group: outer, x: cx, z: cz, y: m.y };
    }

    // ---- the deck: each face's region is the overhang rectangle cut down to where that face is the lowest
    const rect: P2[] = [[o.x0, o.z0], [o.x1, o.z0], [o.x1, o.z1], [o.x0, o.z1]];
    let regions = faces.map(s => {
      let poly = rect;
      for (const q of faces) if (q !== s) poly = clip(poly, p => plane(s, p[0], p[1]) - plane(q, p[0], p[1]));
      return { s, poly };
    }).filter(r => r.poly.length >= 3);
    // S2 clip: a storey standing up through the roof's plan cuts the deck (convex pieces round each hole)
    if (m.holes.length) regions = regions.flatMap(r => subtractRects(r.poly, m.holes).map(poly => ({ s: r.s, poly })));
    const top: number[] = [], topUV: number[] = [], bot: number[] = [], rim: number[] = [];
    const tri = (arr: number[], a, b, c, wantUp: boolean) => {   // wound so its normal points up (or down)
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if ((n.y > 0) !== wantUp) [b, c] = [c, b];
      arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      return [a, b, c];
    };
    const sideOfEdge = (a: P2, b: P2): Side | null => {
      for (const s of SIDES) { const v = edgeOf(o, s), i = along(s) === 0 ? 1 : 0; if (Math.abs(a[i] - v) < 1e-6 && Math.abs(b[i] - v) < 1e-6) return s; }
      return null;
    };
    const boundary = [];   // { s, a, b, face }: drip edges
    const shared = [];     // { a, b, f, q }: ridges and hips
    const sinP = Math.sin(m.pitch);
    const sinOf = (s: Side) => (m.tS[s] === t ? sinP : Math.sin(Math.atan(m.tS[s])));
    for (const { s, poly } of regions) {
      const lift = (p: P2, dy = 0) => V3(p[0], plane(s, p[0], p[1]) + dy, p[1]);
      for (let i = 1; i < poly.length - 1; i++) {
        const tr = tri(top, lift(poly[0], T), lift(poly[i], T), lift(poly[i + 1], T), true);
        for (const v of tr) topUV.push(along(s) === 0 ? v.x : v.z, (v.y - T - heel[s]) / sinOf(s));   // metres: u along the eave, v up the slope from the wall line
        if (!isGlass) tri(bot, lift(poly[0]), lift(poly[i]), lift(poly[i + 1]), false);
      }
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-4) continue;
        const bs = sideOfEdge(a, b);
        if (bs) { boundary.push({ s: bs, a, b, face: s }); continue; }
        for (const q of faces) if (q > s && Math.abs(plane(s, a[0], a[1]) - plane(q, a[0], a[1])) < 1e-5 && Math.abs(plane(s, b[0], b[1]) - plane(q, b[0], b[1])) < 1e-5) shared.push({ a, b, f: s, q });
      }
    }
    // the deck's own edge, under the fascia
    for (const e of boundary) {
      if (abut[e.s] || isGlass) continue;
      const [nx, nz] = OUT[e.s], ha = plane(e.face, e.a[0], e.a[1]), hb = plane(e.face, e.b[0], e.b[1]);
      const A0 = V3(e.a[0], ha, e.a[1]), B0 = V3(e.b[0], hb, e.b[1]), B1 = V3(e.b[0], hb + T, e.b[1]), A1 = V3(e.a[0], ha + T, e.a[1]);
      const n = new THREE.Vector3().subVectors(B0, A0).cross(new THREE.Vector3().subVectors(B1, A0));
      const q = n.x * nx + n.z * nz < 0 ? [A0, B1, B0, A0, A1, B1] : [A0, B0, B1, A0, B1, A1];
      for (const v of q) rim.push(v.x, v.y, v.z);
    }
    const mesh = (pos: number[], mat, uv?: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv || new Array((pos.length / 3) * 2).fill(0), 2));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat);
    };
    add(mesh(top, roofMat, topUV)).name = 'Roof deck';
    if (bot.length) add(mesh(bot, soffitMat), false).name = 'Soffit';
    if (rim.length) add(mesh(rim, fasciaMat), false).name = 'Deck edge';

    // ---- fascia and rake boards on every free drip edge
    // A board along p0→p1 (points on the deck's underside at the drip edge), `below`/`above` that line across
    // its face, `thick` out from the edge. Its local y is the edge's upward normal, so a rake board lies on the slope.
    const board = (p0, p1, out: P2, below: number, above: number, thick: number, mat, extend = 0) => {
      const ex = new THREE.Vector3().subVectors(p1, p0); const len = ex.length() + 2 * extend; ex.normalize();
      const ez = V3(out[0], 0, out[1]);
      const ey = new THREE.Vector3().crossVectors(ez, ex);
      if (ey.y < 0) { ex.negate(); ey.negate(); }
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, below + above, thick), mat);
      b.quaternion.copy(basis(ex, ey, ez));
      b.position.copy(p0).add(p1).multiplyScalar(0.5).addScaledVector(ey, (above - below) / 2).addScaledVector(ez, thick / 2 + 0.002);
      return b;
    };
    for (const e of boundary) {
      if (abut[e.s]) continue;
      const ha = plane(e.face, e.a[0], e.a[1]), hb = plane(e.face, e.b[0], e.b[1]);
      const eave = Math.abs(ha - hb) < 1e-5;
      const p0 = V3(e.a[0], ha, e.a[1]), p1 = V3(e.b[0], hb, e.b[1]);
      const slopeCos = eave ? 1 : Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) / p0.distanceTo(p1);
      // a 1×8 (~0.19 m) board proud of the deck edge by its thickness; a rake board drops a little deeper than the
      // fascia, so a gable end reads as a crisp outline from above
      add(board(p0, p1, OUT[e.s], eave ? 0.1 : 0.12, (T - 0.01) * slopeCos, FT, fasciaMat, eave ? FT : 0.01), !isGlass).name = eave ? 'Fascia' : 'Rake board';
    }

    // ---- ridge and hip caps
    const faceNormal = (s: Side) => { const [nx, nz] = OUT[s], ts = m.tS[s]; return V3(nx * ts, 1, nz * ts).normalize(); };
    for (const e of shared) {
      const pa = V3(e.a[0], plane(e.f, e.a[0], e.a[1]) + T, e.a[1]), pb = V3(e.b[0], plane(e.f, e.b[0], e.b[1]) + T, e.b[1]);
      const ex = new THREE.Vector3().subVectors(pb, pa); const len = ex.length(); if (len < 0.05) continue; ex.normalize();
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const ey = faceNormal(e.f).add(faceNormal(e.q)).normalize();
      ey.addScaledVector(ex, -ey.dot(ex)).normalize();
      if (isGlass) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(len + 0.04, 0.05, 0.12), capMat);
        c.quaternion.copy(basis(ex, ey, new THREE.Vector3().crossVectors(ex, ey)));
        c.position.copy(mid).addScaledVector(ey, 0.012);
        add(c, false).name = 'Ridge cap';
      } else if (clay) {
        // a roll of half-round ridge tiles: a low cylinder bedded into the line, its crown ~7 cm proud
        const r = 0.12;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len + 0.06, 10, 1), capMat);
        c.quaternion.setFromUnitVectors(UP, ex);
        c.position.copy(mid).addScaledVector(ey, 0.07 - r);
        add(c).name = 'Ridge cap';
      } else {
        // a cap course folded over the line: one thin leaf lying on each face, meeting at the ridge or hip
        for (const s of [e.f, e.q] as Side[]) {
          const n = faceNormal(s), o = OUT[s];
          const d = new THREE.Vector3().crossVectors(n, ex);
          if (d.x * o[0] + d.z * o[1] < 0) d.negate();   // down this face, away from the other
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(len + 0.04, 0.035, 0.17), capMat);
          leaf.quaternion.copy(basis(ex, n, new THREE.Vector3().crossVectors(ex, n)));
          leaf.position.copy(mid).addScaledVector(d, 0.085 - 0.012).addScaledVector(n, 0.0175);
          add(leaf, false).name = 'Ridge cap';
        }
      }
    }

    // ---- gutters on every eave (a face's drip edge on its own side), downspouts from their ends
    const gutters = [];
    if (!isGlass && wantGutters) for (const e of boundary) {
      if (e.s !== e.face || abut[e.s]) continue;
      const h = plane(e.face, e.a[0], e.a[1]);
      if (Math.abs(h - plane(e.face, e.b[0], e.b[1])) > 1e-5) continue;
      const [nx, nz] = OUT[e.s];
      const n = V3(nx, 0, nz), d = new THREE.Vector3().crossVectors(n, UP);   // the extrusion runs along n × up
      const pa = V3(e.a[0], 0, e.a[1]), pb = V3(e.b[0], 0, e.b[1]);
      const start = pa.dot(d) < pb.dot(d) ? pa : pb, len = pa.distanceTo(pb) + 2 * FT;
      const shape = new THREE.Shape(GUTTER.map(([u, v]) => new THREE.Vector2(u, v)));
      const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1, curveSegments: 1 }), gutterMat);
      gm.quaternion.copy(basis(n, UP, d));
      const topY = h + T - 0.03;
      gm.position.copy(start).addScaledVector(d, -FT).addScaledVector(n, FT + 0.004); gm.position.y = topY;
      add(gm).name = 'Gutter';
      gutters.push({ s: e.s, topY });
    }
    for (const gt of gutters) downspouts(gt.s, gt.topY);

    // ---- frieze: the wall carried up to the underside wherever a raised heel lifts the roof off the wall top
    for (const s of faces) {
      const rise = heel[s] - WALL_HALF * m.tS[s];   // the underside's height over the wall's outer face
      if (abut[s] || rise < 0.02 || isGlass) continue;
      const ax = along(s), [nx, nz] = OUT[s], c = edgeOf(W, s) + (ax === 0 ? nz : nx) * (WALL_HALF - 0.01);
      const lo = ax === 0 ? W.x0 : W.z0, hi = ax === 0 ? W.x1 : W.z1, len = hi - lo + 2 * WALL_HALF;
      const f = new THREE.Mesh(new THREE.BoxGeometry(ax === 0 ? len : 0.04, rise + 0.03, ax === 0 ? 0.04 : len), cladding(wallColor));
      f.position.set(ax === 0 ? (lo + hi) / 2 : c, (rise + 0.03) / 2 - 0.02, ax === 0 ? c : (lo + hi) / 2);
      add(f, false).name = 'Frieze';
    }

    // ---- gable ends (a shed's ends and clerestory) in the wall's cladding, on the end wall line
    const endMat = isGlass ? glass() : rf.gableCladding ? am().own(am().cladding({ kind: rf.gableCladding.material || palette.material || 'stucco', color: rf.gableCladding.color || wallColor })) : cladding(wallColor);
    const glassEnds = new Set<Side>(rf.gableGlass || []);
    let prismMat = endMat;
    const prism = (pts: P2[], ex, origin, depth: number) => {   // pts in (along ex, up), extruded along ex × up, centred on origin
      const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
      const p = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 }), prismMat);
      const ez = new THREE.Vector3().crossVectors(ex, UP);
      p.quaternion.copy(basis(ex, UP, ez));
      p.position.copy(origin).addScaledVector(ez, -depth / 2);
      return p;
    };
    const wallT = 2 * WALL_HALF;
    const gableEnded = type === 'gable' || isGlass || (m.hip && SIDES.some(s => m.ends[s] === 'gable'));
    if (gableEnded) {
      for (const s of (m.ridgeX ? ['W', 'E'] : ['N', 'S']) as Side[]) {
        if (abut[s]) continue;
        // S2 ends: a hipped or open end has no end wall; a hip roof builds only its gable ends
        if (m.ends[s] === 'hip' || m.ends[s] === 'open' || (m.hip && m.ends[s] !== 'gable')) continue;
        const c = edgeOf(W, s);
        const [sLo, sHi]: Side[] = m.ridgeX ? ['N', 'S'] : ['W', 'E'];
        const lo = m.ridgeX ? W.z0 : W.x0, hi = m.ridgeX ? W.z1 : W.x1;
        const tLo = m.tS[sLo], tHi = m.tS[sHi];
        const ridge = tLo === tHi ? (lo + hi) / 2 + (heel[sHi] - heel[sLo]) / (2 * t) : (hi * tHi + heel[sHi] - heel[sLo] + lo * tLo) / (tLo + tHi);
        const R = (ridge - lo) * tLo + heel[sLo];
        prismMat = glassEnds.has(s) ? glass() : endMat;
        add(prism([[lo, 0], [hi, 0], [hi, heel[sHi]], [ridge, R], [lo, heel[sLo]]], m.ridgeX ? V3(0, 0, 1) : V3(1, 0, 0), m.ridgeX ? V3(c, 0, 0) : V3(0, 0, c), wallT)).name = glassEnds.has(s) ? 'Glazed gable end' : 'Gable end';
        prismMat = endMat;
        if (glassEnds.has(s)) glazingBars(s, c, lo, hi, ridge, R, sLo, sHi);
        // the automatic attic window: S2 gableWindow false (and, under defaults: 2, unless asked for) leaves it out
        else if (!isGlass && rf.gableWindow !== false && !(d2 && rf.gableWindow === undefined)) atticLight(s, c, ridge, R);
      }
    } else if (type === 'shed') {
      const lowLine = edgeOf(W, m.low), highLine = edgeOf(W, m.high), H = Math.abs(highLine - lowLine) * t + heel[m.low], h0 = heel[m.low];
      if (!abut[m.high] && H > 0.05) {   // the clerestory under the high edge
        const ax = along(m.high), lo = ax === 0 ? W.x0 : W.z0, hi = ax === 0 ? W.x1 : W.z1;
        add(prism([[lo, 0], [hi, 0], [hi, H], [lo, H]], ax === 0 ? V3(1, 0, 0) : V3(0, 0, 1), ax === 0 ? V3(0, 0, highLine) : V3(highLine, 0, 0), wallT)).name = 'Clerestory';
      }
      for (const s of SIDES) {
        if (s === m.high || s === m.low || abut[s] || H <= 0.05) continue;
        const c = edgeOf(W, s), ax = along(s);
        add(prism([[lowLine, 0], [highLine, 0], [highLine, H], [lowLine, h0]], ax === 0 ? V3(1, 0, 0) : V3(0, 0, 1), ax === 0 ? V3(0, 0, c) : V3(c, 0, 0), wallT)).name = 'Shed end';
      }
    }

    // ---- S2 catslide: where a face sweeps on down over a lower wing, the wing's end walls are carried up to the roof
    // (a triangle of the end's cladding between the wing's wall head and the swept face)
    for (const sw of (rf.sweep || []) as Side[]) {
      if (!faces.includes(sw) || isGlass) continue;
      const axS = along(sw), lineW = edgeOf(W, sw), [snx, snz] = OUT[sw];
      for (const end of (axS === 0 ? ['W', 'E'] : ['N', 'S']) as Side[]) {
        if (abut[end]) continue;
        const c = edgeOf(W, end), [enx, enz] = OUT[end];
        // the lower storey under the swept strip, just inside this end's line
        const probe = (u: number): [number, number] => (axS === 0 ? [c - enx * 0.05, u] : [u, c - enz * 0.05]);
        const lows = levels.filter(l => (l.y || 0) + (l.height || 2.8) < m.y - 0.3);
        let far = lineW, base = null;
        for (let k = 1; k <= 60; k++) {
          const u = lineW + (axS === 0 ? snz : snx) * k * 0.1, [px, pz] = probe(u);
          const hit = lows.find(l => (l.footprint || []).some(r => inR(px, pz, r)));
          if (!hit) break;
          far = u; base = Math.max(base ?? -Infinity, (hit.y || 0) + (hit.height || 2.8) - m.y);
        }
        if (base === null || Math.abs(far - lineW) < 0.2) continue;
        const hAt = (u: number) => (axS === 0 ? plane(sw, 0, u) : plane(sw, u, 0));
        const lo = Math.min(lineW, far), hi = Math.max(lineW, far);
        const pts: P2[] = [[lo, base], [hi, base], [hi, Math.max(base, hAt(hi))], [lo, Math.max(base, hAt(lo))]];
        add(prism(pts, axS === 0 ? V3(0, 0, 1) : V3(1, 0, 0), axS === 0 ? V3(c, 0, 0) : V3(0, 0, c), wallT)).name = 'Catslide end';
      }
    }

    // ---- an A-frame's steel rafters over the glass
    if (isGlass) for (const s of faces) {
      const ax = m.ridgeX ? 0 : 1, lo = ax === 0 ? o.x0 : o.z0, hi = ax === 0 ? o.x1 : o.z1, n = Math.max(2, Math.round((hi - lo) / 1.2));
      const mid = m.ridgeX ? (W.z0 + W.z1) / 2 : (W.x0 + W.x1) / 2, e0 = edgeOf(o, s), fn = faceNormal(s);
      for (let i = 0; i <= n; i++) {
        const a = lo + 0.04 + (hi - lo - 0.08) * i / n;
        const P = (u: number) => (ax === 0 ? V3(a, plane(s, a, u) + T, u) : V3(u, plane(s, u, a) + T, a));
        const p0 = P(e0), p1 = P(mid), ex = new THREE.Vector3().subVectors(p1, p0); const len = ex.length(); ex.normalize();
        const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.05), capMat);
        r.quaternion.copy(basis(ex, fn, new THREE.Vector3().crossVectors(ex, fn)));
        r.position.copy(p0).add(p1).multiplyScalar(0.5).addScaledVector(fn, 0.03);
        add(r, false).name = 'Rafter';
      }
    }

    if (!isGlass) for (const d of rf.dormers || []) dormer(d);
    if (rf.chimney) chimney(rf.chimney);
    if (rf.skylights) for (const sk of rf.skylights) skylight(sk);
    if (rf.planted) plantedExtras();
    return { group: outer, x: cx, z: cz, y: m.y };

    // -------------------------------------------------------------------------------------------------------
    function downspouts(s: Side, topY: number) {
      const ax = along(s), wallLine = edgeOf(W, s);
      const lo = ax === 0 ? W.x0 : W.z0, hi = ax === 0 ? W.x1 : W.z1;
      const entry = spec.entry && spec.entry.side === s ? spec.entry.at : null;
      const ends = [lo + 0.32, hi - 0.32];
      // one pipe on a short run: the corner far from the door, else the +x / +z corner
      if (entry === null || Math.abs(entry - ends[0]) < Math.abs(entry - ends[1])) ends.reverse();
      const wanted = hi - lo >= 6 ? 2 : 1;
      let placed = 0;
      for (const end of ends) {
        if (placed >= wanted) break;
        const dir = end < (lo + hi) / 2 ? 1 : -1;   // walk inward from the corner while the spot is taken
        for (let k = 0; k < 4; k++) {
          const a = end + dir * k * 0.3, run = spoutRun(s, a, wallLine, topY);
          if (!run) continue;
          spout(s, a, wallLine, topY, run); placed++; break;
        }
      }
    }
    // Where a pipe at along-position `a` on side `s` can run, or null. It hangs on the wall of every storey it
    // passes, crosses no opening, porch or pool, and lands on the ground, on a deck or patio, or on a lower roof.
    function spoutRun(s: Side, a: number, wallLine: number, topY: number) {
      const [nx, nz] = OUT[s], ax = along(s);
      const pt = (off: number): P2 => (ax === 0 ? [a, wallLine + nz * off] : [wallLine + nx * off, a]);
      const P = pt(WALL_HALF + STANDOFF + LEADER[1] / 2), Q = pt(-0.25);
      if (spouts.some(p => Math.hypot(p[0] - P[0], p[1] - P[1]) < 0.7)) return null;
      let land = 0, onRoof = false;
      for (const other of models) {
        if (other === m || other.y >= m.y - 0.3 || !inRect(P[0], P[1], other.o, 0.05)) continue;
        const h = other.topAt(P[0], P[1]); if (h > land) { land = h; onRoof = true; }
      }
      if (featureKeep.some(([x0, z0, x1, z1]) => P[0] > x0 - 0.25 && P[0] < x1 + 0.25 && P[1] > z0 - 0.25 && P[1] < z1 + 0.25)) return null;
      for (const st of spec.site || []) {
        if (!Array.isArray(st.at)) continue;
        const keep = KEEP_OUT[st.type], cover = GROUND_COVER[st.type];
        if (!keep && cover === undefined) continue;
        const round = st.type === 'gazebo' || st.type === 'hottub';
        const w = round ? 2 * (st.r || keep[0] / 2) : st.w || (keep ? keep[0] : 3), d = round ? 2 * (st.r || keep[1] / 2) : st.d || (keep ? keep[1] : 3);
        const q = ((((st.rot || 0) % 180) + 180) % 180) === 90;
        const pad = keep ? 0.25 : 0;
        if (Math.abs(P[0] - st.at[0]) >= (q ? d : w) / 2 + pad || Math.abs(P[1] - st.at[1]) >= (q ? w : d) / 2 + pad) continue;
        if (keep) return null;
        if (!onRoof) land = Math.max(land, (st.y || 0) + (st.type === 'deck' ? st.h || cover : cover));
      }
      if (m.y + topY - land < 1.2) return null;
      for (const L of levels) {
        const Ly = L.y || 0, Ltop = Ly + (L.height || 2.8);
        if (Ly > m.y - 0.3 || Ltop <= land + 0.05) continue;   // not a storey the pipe runs down past
        const fp = L.footprint || [];
        if (fp.some(r => inR(P[0], P[1], r, 0.02))) return null;   // the storey steps out under this eave
        if (!fp.some(r => inR(Q[0], Q[1], r))) return null;        // no wall to hang the pipe on
        for (const op of L.openings || []) {
          if (op.side !== s) continue;
          const isEntry = spec.entry && spec.entry.level === L.id && spec.entry.side === op.side && Math.abs(spec.entry.at - op.at) < 1e-6;
          const margin = 0.14 + (isEntry ? 0.75 : 0) + (op.type === 'garage' ? 0.55 : 0);   // the entry and garage sconces too
          if (Math.abs(op.at - a) < (op.w || 1) / 2 + margin) return null;
        }
      }
      spouts.push(P);
      return { land, onRoof };
    }
    function spout(s: Side, a: number, wallLine: number, topY: number, run) {
      const [nx, nz] = OUT[s], ax = along(s);
      const A = ax === 0 ? V3(1, 0, 0) : V3(0, 0, 1);
      const at = (off: number, yy: number) => (ax === 0 ? V3(a, yy, wallLine + nz * off) : V3(wallLine + nx * off, yy, a));
      const upright = basis(A, UP, new THREE.Vector3().crossVectors(A, UP));
      const pipe = (p, q, extra = LEADER[1]) => {
        const U = new THREE.Vector3().subVectors(q, p); const len = U.length(); U.normalize();
        const b = new THREE.Mesh(new THREE.BoxGeometry(LEADER[0], len + extra, LEADER[1]), gutterMat);
        b.quaternion.copy(basis(A, U, new THREE.Vector3().crossVectors(A, U)));
        b.position.copy(p).add(q).multiplyScalar(0.5);
        return b;
      };
      const oG = ov[s] + FT + 0.004 + 0.45 * GW;          // the outlet, mid-floor of the trough
      const oW = WALL_HALF + STANDOFF + LEADER[1] / 2;     // on the wall
      const land = run.land - m.y;
      const jog = oG - oW > 0.06;
      const y1 = topY - G + 0.01, y2 = y1 - 0.12, y3 = jog ? y2 - Math.max(0.12, oG - oW) : y2;   // 45° offset back to the wall
      const wx = jog ? oW : oG;
      const yb = run.onRoof ? land + 0.03 : land + 0.3;
      const grp = new THREE.Group(); grp.name = 'Downspout';
      grp.add(pipe(at(oG, y1), at(oG, y2)));
      if (jog) grp.add(pipe(at(oG, y2), at(oW, y3)));
      grp.add(pipe(at(wx, y3), at(wx, yb), 0));
      for (const f of [0.3, 0.72]) {   // straps
        const st = new THREE.Mesh(new THREE.BoxGeometry(LEADER[0] + 0.012, 0.022, LEADER[1] + 0.012), gutterMat);
        st.position.copy(at(wx, y3 + (yb - y3) * f)); st.quaternion.copy(upright); grp.add(st);
      }
      if (!run.onRoof) {
        grp.add(pipe(at(wx, yb), at(wx + 0.2, land + 0.06)));   // the kick-out shoe
        if (run.land < 0.05) {                                   // a splash block on the lawn
          const sb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.5), std(0xb9b4aa, { roughness: 0.95 }));
          sb.quaternion.copy(upright); sb.position.copy(at(wx + 0.38, land + 0.015)); grp.add(sb);
        }
      }
      grp.traverse(o2 => { if (o2.isMesh) { o2.castShadow = true; o2.receiveShadow = true; } });
      g.add(grp);
    }

    // An attic window in a gable end tall enough to hold one (a louvred vent in a lower gable), centred under
    // the ridge on the end wall's outer face — dark glass, casing, head and sill in the eave colour. `c` is the
    // end wall line, `ridge` the ridge's position along it, `R` the underside's height at the ridge.
    function atticLight(s: Side, c: number, ridge: number, R: number) {
      if (R < 1.1) return;
      const [nx, nz] = OUT[s], ax = along(s);
      if (rf.chimney && Array.isArray(rf.chimney.at)) {   // a chimney stack on this end would stand in front of it
        const [chx, chz] = rf.chimney.at, px = ax === 0 ? ridge : c, pz = ax === 0 ? c : ridge;
        if (Math.hypot(chx - px, chz - pz) < 1.4) return;
      }
      const out = V3(nx, 0, nz), ex = ax === 0 ? V3(1, 0, 0) : V3(0, 0, 1);
      if (new THREE.Vector3().crossVectors(ex, UP).dot(out) < 0) ex.negate();
      const face = WALL_HALF + 0.002;
      const grp = new THREE.Group(); grp.name = 'Attic window';
      grp.quaternion.copy(basis(ex, UP, out));
      grp.position.copy(ax === 0 ? V3(ridge, 0, c + nz * face) : V3(c + nx * face, 0, ridge));
      const part = (w: number, h: number, d: number, x: number, y: number, z: number, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; grp.add(b); return b; };
      // the highest a head (with its casing) may reach at half-width hw: clear of the rake board by 0.3 m
      const ceiling = (hw: number) => R - (hw + 0.09) * t - 0.3;
      const bottom = Math.max(0.45, R * 0.3);
      let ww = Math.min(0.8, Math.max(0.52, R * 0.26)), top = Math.min(bottom + Math.min(1.05, R * 0.36), ceiling(ww / 2) - 0.1);
      if (top - bottom >= 0.6 && rf.gableWindow !== 'louvre') {
        const wh = top - bottom, yc = (top + bottom) / 2;
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), darkGlass()); gl.position.set(0, yc, 0.004); gl.receiveShadow = true; grp.add(gl);
        for (const sd of [-1, 1]) part(0.08, wh + 0.02, 0.03, sd * (ww / 2 + 0.04), yc, 0.015, fasciaMat);
        part(ww + 0.2, 0.1, 0.035, 0, top + 0.05, 0.0175, fasciaMat);
        part(ww + 0.24, 0.028, 0.05, 0, top + 0.11, 0.025, fasciaMat);                 // drip cap
        part(ww + 0.22, 0.045, 0.07, 0, bottom - 0.0225, 0.035, fasciaMat);            // sill
        part(0.035, wh, 0.03, 0, yc, 0.012, fasciaMat);                                 // muntins: two over two
        part(ww, 0.035, 0.03, 0, yc, 0.012, fasciaMat);
      } else {
        ww = 0.46; top = Math.min(bottom + 0.62, ceiling(ww / 2) - 0.07);
        if (top - bottom < 0.4) return;
        const vh = top - bottom, yc = (top + bottom) / 2;
        const back = new THREE.Mesh(new THREE.PlaneGeometry(ww, vh), std(0x23272b, { roughness: 0.9 })); back.position.set(0, yc, 0.004); grp.add(back);
        for (const sd of [-1, 1]) part(0.07, vh + 0.14, 0.03, sd * (ww / 2 + 0.035), yc, 0.015, fasciaMat);
        for (const y2 of [top + 0.035, bottom - 0.035]) part(ww + 0.14, 0.07, 0.03, 0, y2, 0.015, fasciaMat);
        const n = Math.max(3, Math.round(vh / 0.1));
        for (let i = 0; i < n; i++) part(ww, 0.012, 0.05, 0, bottom + (i + 0.5) * vh / n, 0.018, fasciaMat).rotation.x = 0.6;   // louvres
      }
      g.add(grp);
    }

    // a dormer on the front slope (+z for a ridge along x, +x for a ridge along z), at `at` along the ridge — or, S2,
    // on the slope `side` names; styles gable (v1), shed, flat, glazed (a glass front), eyebrow (a low arched hood)
    function dormer(d) {
      const face: Side = d.side || (m.ridgeX ? 'S' : 'E');
      if (!faces.includes(face)) return;
      const style = d.style || 'gable';
      const dw = d.w || 1.4;
      const alongX = face === 'S' || face === 'N';
      const lo = alongX ? W.x0 : W.z0, hi = alongX ? W.x1 : W.z1;
      const pos = Math.min(hi - dw / 2 - 0.3, Math.max(lo + dw / 2 + 0.3, d.at ?? (lo + hi) / 2));
      const half = (alongX ? W.z1 - W.z0 : W.x1 - W.x0) / 2, tf = m.tS[face];
      // the ridge over the dormer: the highest the roof's underside gets across its slope (a saltbox's ridge is off centre)
      let ridge = -Infinity;
      for (let k = 0; k <= 8; k++) { const t = k / 8, h2 = alongX ? under(pos, W.z0 + (W.z1 - W.z0) * t) : under(W.x0 + (W.x1 - W.x0) * t, pos); if (h2 > ridge) ridge = h2; }
      const front = half * 0.3, baseY = front * tf + heel[face] + T, ridgeTop = ridge + T;
      const pitchD = (style === 'shed' ? 14 : style === 'flat' ? 2 : 40) * DEG, capRise = style === 'gable' || style === 'glazed' ? (dw / 2 + 0.12) * Math.tan(pitchD) : style === 'eyebrow' ? 0.18 : 0.12;
      const dh = Math.min(style === 'eyebrow' ? 0.8 : 1.25, ridgeTop - baseY - capRise - 0.12);
      if (dh < (style === 'eyebrow' ? 0.45 : 0.65)) return;
      const depth = Math.min(half - front + 0.2, dh / tf + 0.1);
      const dg = new THREE.Group(); dg.name = `Dormer${style !== 'gable' ? ` (${style})` : ''}`;
      const e = edgeOf(W, face), n = OUT[face];
      if (face === 'S' && !d.side) dg.position.set(pos, baseY, W.z1 - front);
      else if (face === 'E' && !d.side) { dg.position.set(W.x1 - front, baseY, pos); dg.rotation.y = Math.PI / 2; }
      else { dg.position.set(alongX ? pos : e - n[0] * front, baseY, alongX ? e - n[1] * front : pos); dg.rotation.y = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[face]; }
      const cl = cladding(wallColor);
      const body = new THREE.Mesh(new THREE.BoxGeometry(dw, dh + 0.25, depth), cl); body.position.set(0, (dh - 0.25) / 2, -depth / 2); dg.add(body);
      if (style === 'gable' || style === 'glazed') {
        const tri2 = new THREE.Shape([new THREE.Vector2(-dw / 2, 0), new THREE.Vector2(dw / 2, 0), new THREE.Vector2(0, capRise - 0.03)]);
        const gab = new THREE.Mesh(new THREE.ExtrudeGeometry(tri2, { depth, bevelEnabled: false }), style === 'glazed' ? glass() : cl); gab.position.set(0, dh, -depth); dg.add(gab);
        const slope = (dw / 2 + 0.12) / Math.cos(pitchD);
        for (const sgn of [-1, 1]) {   // hinged at the dormer's ridge, each slab running down to its own side
          const sl = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.07, depth + 0.18), roofMat);
          sl.geometry.translate(sgn * slope / 2, 0.035, 0);
          sl.position.set(0, dh + capRise - 0.03, -depth / 2 + 0.09);
          sl.rotation.z = -sgn * pitchD;
          dg.add(sl);
          const fb = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.06, 0.03), fasciaMat);   // rake board on the front
          fb.geometry.translate(sgn * slope / 2, 0, 0); fb.position.set(0, dh + capRise - 0.05, 0.19); fb.rotation.z = sl.rotation.z; dg.add(fb);
        }
      } else if (style === 'shed' || style === 'flat') {
        // one slab from the main roof down to the dormer's front, a fascia on its front edge
        const len = (depth + 0.25) / Math.cos(pitchD);
        const sl = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.24, 0.08, len), roofMat);
        sl.position.set(0, dh + capRise / 2 + 0.02, -depth / 2 + 0.1); sl.rotation.x = -pitchD; dg.add(sl);
        const fb = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.26, 0.12, 0.03), fasciaMat); fb.position.set(0, dh + 0.02, 0.24); dg.add(fb);
      } else {
        // eyebrow: a low segmental hood over a wide low window
        const r = (dw * dw / 4 + capRise * capRise) / (2 * capRise), th = 2 * Math.asin(dw / 2 / r);
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth + 0.2, 24, 1, true, -th / 2, th), roofMat);
        hood.rotation.x = Math.PI / 2; hood.rotation.y = 0; hood.position.set(0, dh - (r - capRise), -depth / 2 + 0.1);
        const hm = own(roofMat); hm.side = THREE.DoubleSide; hood.material = hm; dg.add(hood);
      }
      const wwin = style === 'glazed' ? dw - 0.16 : Math.max(0.5, dw - 0.55), hwin = style === 'glazed' ? dh * 0.9 : Math.min(0.9, dh * 0.62), wy = style === 'glazed' ? dh * 0.5 : dh * 0.45;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(wwin, hwin), darkGlass()); gl.position.set(0, wy, 0.005); gl.userData.windowGlow = true; dg.add(gl);
      const cas = (w2, h2, x, yy) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.03), fasciaMat); b.position.set(x, yy, 0.015); dg.add(b); };
      cas(0.07, hwin, -wwin / 2 - 0.035, wy); cas(0.07, hwin, wwin / 2 + 0.035, wy); cas(wwin + 0.14, 0.08, 0, wy + hwin / 2 + 0.04); cas(0.03, hwin, 0, wy);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(wwin + 0.2, 0.04, 0.07), fasciaMat); sill.position.set(0, wy - hwin / 2 - 0.02, 0.035); dg.add(sill);
      dg.traverse(o2 => { if (o2.isMesh) { o2.receiveShadow = true; o2.castShadow = o2 !== gl; } });
      g.add(dg);
    }

    function chimney(c) {
      // v1: a 0.7 m brick stack with a crown and two pots. S2: w × d, `h` over the highest roof point it rises
      // through, brick | stone | stucco | metal (a flue pipe), a colour, and a stone, pots or metal cap.
      const S = c.w || 0.7, D = c.d || S;
      let x, z;
      if (Array.isArray(c.at)) { x = c.at[0]; z = c.at[1]; }
      else if (m.hip) { x = (W.x0 + W.x1) / 2 + (W.x1 - W.x0) * 0.2; z = (W.z0 + W.z1) / 2; }
      else { x = (W.x0 + W.x1) / 2; z = (W.z0 + W.z1) / 2; }
      x = Math.min(o.x1 - S, Math.max(o.x0 + S, x)); z = Math.min(o.z1 - D, Math.max(o.z0 + D, z));
      const corners = [[x - S / 2, z - D / 2], [x + S / 2, z - D / 2], [x - S / 2, z + D / 2], [x + S / 2, z + D / 2]].map(([u, v]) => type === 'flat' ? 0.22 : under(u, v) + T);
      const peak = type === 'flat' ? 0.22 : under((W.x0 + W.x1) / 2, (W.z0 + W.z1) / 2) + T;
      const hiC = Math.max(...corners);
      const topY = c.h !== undefined ? hiC + c.h : type === 'flat' ? hiC + (rf.parapet ?? 0.35) + 0.9 : Math.max(hiC + 0.9, Math.min(peak + 0.45, hiC + 1.8));
      const base = Math.min(...corners) - 0.3;
      if (c.material === 'metal') {   // a stainless flue: a pipe, a storm collar and a cone cap
        const steel = std(hexOr(c.color, 0x9aa1a8), { roughness: 0.35, metalness: 0.8 });
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, topY - base, 16), steel); pipe.position.set(x, (topY + base) / 2, z); add(pipe).name = 'Chimney';
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16), steel); collar.position.set(x, hiC + 0.05, z); add(collar);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 16), steel); cone.position.set(x, topY + 0.15, z); add(cone);
        return;
      }
      const mat = c.material === 'stone' || c.material === 'stucco' ? am().own(am().cladding({ kind: c.material, color: c.color || (c.material === 'stone' ? '#a39d92' : palette.wall || '#e7e2d8') }))
        : c.color ? colouredBrick(hexOr(c.color, 0x8a4a38)) : brickMaterial();
      const stackGeo = worldUV(new THREE.BoxGeometry(S, topY - base, D), x, (topY + base) / 2, z);
      const stack = new THREE.Mesh(stackGeo, mat);
      stack.position.set(x, (topY + base) / 2, z); add(stack).name = 'Chimney';
      // a corbelled band two courses under the crown, a stone crown, two clay flue pots
      const band = new THREE.Mesh(worldUV(new THREE.BoxGeometry(S + 0.06, 0.15, D + 0.06), x, topY - 0.2, z), mat); band.position.set(x, topY - 0.2, z); add(band);
      if (c.cap === 'metal') {
        const cap = std(0x3a3d40, { roughness: 0.4, metalness: 0.7 });
        for (const [dx, dz] of [[-S / 2 + 0.05, -D / 2 + 0.05], [S / 2 - 0.05, -D / 2 + 0.05], [-S / 2 + 0.05, D / 2 - 0.05], [S / 2 - 0.05, D / 2 - 0.05]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), cap); leg.position.set(x + dx, topY + 0.11, z + dz); add(leg, false); }
        const lid = new THREE.Mesh(new THREE.BoxGeometry(S + 0.14, 0.04, D + 0.14), cap); lid.position.set(x, topY + 0.24, z); add(lid);
        return;
      }
      const crown = new THREE.Mesh(new THREE.BoxGeometry(S + 0.12, 0.08, D + 0.12), std(0x8d877f, { roughness: 0.9 })); crown.position.set(x, topY + 0.04, z); add(crown);
      if (c.cap === 'stone') return;
      const pot = std(0x7a4a3a, { roughness: 0.85 });
      for (const [dx, dz] of [[0.14, -0.12], [-0.13, 0.1]]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.28, 10), pot); f.position.set(x + (S === 0.7 ? dx : dx * S / 0.7), topY + 0.22, z + (D === 0.7 ? dz : dz * D / 0.7)); add(f, false);
      }
    }
    // a skylight on the face under it (or on a flat roof's slab): a dark glass panel in a curb, lying on the slope
    function skylight(sk) {
      if (!Array.isArray(sk.at)) return;
      const w = sk.w || 0.8, d = sk.d || 1.1, [x, z] = sk.at;
      const face = faces.length ? faces.reduce((a, b2) => plane(a, x, z) <= plane(b2, x, z) ? a : b2) : null;
      const n = face ? faceNormal(face) : V3(0, 1, 0);
      const ex = face ? (along(face) === 0 ? V3(1, 0, 0) : V3(0, 0, 1)) : V3(1, 0, 0);
      const ez = new THREE.Vector3().crossVectors(ex, n);
      const sg = new THREE.Group(); sg.name = 'Skylight';
      sg.quaternion.copy(basis(ex, n, ez));
      sg.position.set(x, (face ? under(x, z) + T : 0.22) + 0.01, z);
      const curb = std(hexOr(rf.trim, 0x2b2f33), { roughness: 0.5 });
      for (const [bw, bd, bx, bz] of [[w + 0.1, 0.06, 0, -d / 2], [w + 0.1, 0.06, 0, d / 2], [0.06, d, -w / 2, 0], [0.06, d, w / 2, 0]]) { const b2 = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.1, bd), curb); b2.position.set(bx, 0.05, bz); b2.castShadow = true; sg.add(b2); }
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.02, d - 0.02), darkGlass()); gl.position.set(0, 0.09, 0); gl.userData.windowGlow = true; sg.add(gl);
      g.add(sg);
    }
    // glazing bars over a glazed gable end: a mullion every ~1 m and a transom at the eave line
    function glazingBars(s: Side, c: number, lo: number, hi: number, ridge: number, R: number, sLo: Side, sHi: Side) {
      const [nx, nz] = OUT[s], ax = along(s), frame = std(hexOr(rf.trim, 0x23272b), { roughness: 0.5, metalness: 0.3 });
      const span = hi - lo, n = Math.max(2, Math.round(span / 1.0));
      const at = (u: number, v: number, off: number) => (ax === 0 ? V3(u, v, c + nz * off) : V3(c + nx * off, v, u));
      for (let i = 0; i <= n; i++) {
        const u = lo + span * i / n, top = u <= ridge ? (u - lo) * m.tS[sLo] + heel[sLo] : (hi - u) * m.tS[sHi] + heel[sHi];
        if (top < 0.05) continue;
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(ax === 0 ? 0.05 : 0.06, top, ax === 0 ? 0.06 : 0.05), frame);
        b2.position.copy(at(u, top / 2, WALL_HALF + 0.01)); add(b2, false);
      }
      const tr = new THREE.Mesh(new THREE.BoxGeometry(ax === 0 ? span : 0.06, 0.05, ax === 0 ? 0.06 : span), frame);
      tr.position.copy(at((lo + hi) / 2, 0.025, WALL_HALF + 0.01)); add(tr, false);
    }
    // a planted roof's extras: seeded clumps and blooms on the deck, and trailing growth over the eaves. Instanced (a clump is a
    // flattened low-poly blob in one of a few tones, a bloom a small sphere over it), so a whole roof is three draw calls.
    function plantedExtras() {
      const r = mulberry32(fnv1a(`${spec.id || 'house'}:planted:${(spec.roofs || []).indexOf(rf)}`));
      const meadow = rf.planted === 'meadow';
      const blob = new THREE.IcosahedronGeometry(1, 0);
      const leafMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
      const tint = (mesh, i, c) => mesh.setColorAt(i, new THREE.Color(c));
      const M = new THREE.Object3D();
      // clumps over the deck
      const tones = meadow ? [0x5b7a41, 0x6d8a4c, 0x7f9a55, 0x4d6a38] : [0x767b4b, 0x878c58, 0x6b7244, 0x948b58];
      const n = Math.min(360, Math.round((o.x1 - o.x0) * (o.z1 - o.z0) * (meadow ? 4 : 3)));
      const clumps = new THREE.InstancedMesh(blob, leafMat(), n), bloomSpots = [];
      for (let i = 0; i < n; i++) {
        const x = o.x0 + 0.2 + r() * (o.x1 - o.x0 - 0.4), z = o.z0 + 0.2 + r() * (o.z1 - o.z0 - 0.4);
        const sz = (meadow ? 0.08 + r() * 0.12 : 0.07 + r() * 0.08), base = type === 'flat' ? 0.22 : under(x, z) + T, sy = sz * (meadow ? 0.8 : 0.42);
        M.position.set(x, base + sy * 0.6, z); M.scale.set(sz * (1 + r() * 0.5), sy, sz * (1 + r() * 0.5)); M.rotation.set(0, r() * Math.PI, 0); M.updateMatrix();
        clumps.setMatrixAt(i, M.matrix); tint(clumps, i, tones[Math.floor(r() * tones.length)]);
        if (r() < (meadow ? 0.34 : 0.1)) bloomSpots.push([x, base + sy * 1.5, z]);
      }
      clumps.instanceMatrix.needsUpdate = true; if (clumps.instanceColor) clumps.instanceColor.needsUpdate = true;
      add(clumps, false).name = 'Planting';
      if (bloomSpots.length) {
        const blooms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), leafMat(), bloomSpots.length), cols = meadow ? [0xf2d45b, 0xffffff, 0xf3a6c0, 0xb59ae0] : [0xe0a1b5, 0xf0e2a0];
        bloomSpots.forEach(([x, y, z], i) => { const bs = 0.03 + r() * 0.025; M.position.set(x, y, z); M.scale.set(bs, bs, bs); M.rotation.set(0, 0, 0); M.updateMatrix(); blooms.setMatrixAt(i, M.matrix); tint(blooms, i, cols[Math.floor(r() * cols.length)]); });
        blooms.instanceMatrix.needsUpdate = true; if (blooms.instanceColor) blooms.instanceColor.needsUpdate = true;
        add(blooms, false).name = 'Blooms';
      }
      // trailing growth: strands of leaf blobs hanging off the drip edges, uneven in length
      const strands = [];
      for (const s of SIDES) {
        if (abut[s] || (type !== 'flat' && !faces.includes(s))) continue;
        const [nx, nz] = OUT[s], ax = along(s), e0 = edgeOf(o, s), lo = ax === 0 ? o.x0 : o.z0, hi = ax === 0 ? o.x1 : o.z1;
        const hEdge = type === 'flat' ? 0.1 : plane(s, ax === 0 ? (lo + hi) / 2 : e0, ax === 0 ? e0 : (lo + hi) / 2);
        for (let k = 0; k < Math.round((hi - lo) / 0.2); k++) {
          if (r() < 0.45) continue;
          const u = lo + 0.12 + r() * (hi - lo - 0.24), len = 0.18 + r() * 0.6, count = Math.max(2, Math.round(len / 0.1));
          for (let j = 0; j < count; j++) {
            const t = j / (count - 1), sw = (r() - 0.5) * 0.05, bs = 0.07 - t * 0.035 + r() * 0.015;
            strands.push([ax === 0 ? u + sw : e0 + nx * (0.07 + r() * 0.03), hEdge + 0.05 - t * len, ax === 0 ? e0 + nz * (0.07 + r() * 0.03) : u + sw, bs, t]);
          }
        }
      }
      if (strands.length) {
        const vine = new THREE.InstancedMesh(blob, leafMat(), strands.length), vt = [0x4f6b3a, 0x5f7d43, 0x6d8a4c];
        strands.forEach(([x, y, z, bs, t], i) => { M.position.set(x, y, z); M.scale.set(bs, bs * 1.2, bs); M.rotation.set(0, r() * Math.PI, 0); M.updateMatrix(); vine.setMatrixAt(i, M.matrix); tint(vine, i, vt[Math.floor(r() * vt.length)]); });
        vine.instanceMatrix.needsUpdate = true; if (vine.instanceColor) vine.instanceColor.needsUpdate = true;
        add(vine, false).name = 'Trailing growth';
      }
    }
    // metre UVs on a box by its face normals, so a tiling texture keeps its scale on any size of face
    function worldUV(geo, cx2: number, cy2: number, cz2: number) {
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const X = p.getX(i) + cx2, Y = p.getY(i) + cy2, Z = p.getZ(i) + cz2;
        if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, Z, Y); else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, X, Z); else uv.setXY(i, X, Y);
      }
      uv.needsUpdate = true;
      return geo;
    }

    function flat() {
      const p = rf.parapet ?? 0.35, H = 0.22;
      const w = o.x1 - o.x0, d = o.z1 - o.z0;
      const slabGeo = new THREE.BoxGeometry(w, H, d);
      const uv = slabGeo.attributes.uv, pos = slabGeo.attributes.position;
      for (let i = 8; i < 12; i++) uv.setXY(i, pos.getX(i) + cx, pos.getZ(i) + cz);   // the membrane (box face 2) in world metres
      const slab = new THREE.Mesh(slabGeo, [fasciaMat, fasciaMat, roofMat, soffitMat, fasciaMat, fasciaMat]);
      slab.position.set(cx, H / 2, cz); add(slab).name = 'Roof slab';
      if (p <= 0) return;
      const pm = cladding(wallColor);
      const coping = std(rf.trim ? hex(rf.trim) : mix(wallColor, 0xffffff, 0.55), { roughness: 0.7 });
      const hasN = !abut.N, hasS = !abut.S;
      for (const s of SIDES) {
        if (abut[s]) continue;
        const ax = along(s), [nx, nz] = OUT[s];
        const len = ax === 0 ? w : d - (hasN ? 0.2 : 0) - (hasS ? 0.2 : 0);
        const mid = ax === 0 ? cx : (o.z0 + (hasN ? 0.2 : 0) + o.z1 - (hasS ? 0.2 : 0)) / 2;
        const e = edgeOf(o, s) - (ax === 0 ? nz : nx) * 0.1;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(ax === 0 ? len : 0.2, p, ax === 0 ? 0.2 : len), pm);
        wall.position.set(ax === 0 ? mid : e, H + p / 2, ax === 0 ? e : mid); add(wall).name = 'Parapet';
        const cp = new THREE.Mesh(new THREE.BoxGeometry(ax === 0 ? len + 0.04 : 0.26, 0.035, ax === 0 ? 0.26 : len + 0.04), coping);
        cp.position.set(ax === 0 ? mid : e + nx * 0.01, H + p + 0.0175, ax === 0 ? e + nz * 0.01 : mid); add(cp, false).name = 'Coping';
      }
    }
  }
}
