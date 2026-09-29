// Framing for the spline planner v2 (plan §3.9, §3.11): the establishing styles, the hero ring — the viewpoints
// round the Companion Core door-to-core's finale ends on and hero-reveal lands on (plan Completeness B) — and the
// close-range probe the Core orbit (assets/core-orbit.ts) is planned with, on the ShotWorld's boxes instead of the
// live scene, so the finale plans the same in Node as in the page.
//
// heroCameraPose, ported: the distance at which a box fits a frustum with a margin (fitDistance), used for the
// establishing shot (the footprint and roof inside the frame with 8 % margins) and the ring's framing.
//
// Owner: S5 (shot). THREE-free.
import { K, DEG, clamp, inRect, inFootprint, levelAt, mulberry32, fnv1a, type ShotWorld, type WorldIndex, type Box6, type WLevel } from './shot-world.js';
import { camera, project, projectBox, type V3, type Probe } from './shot-probe.js';
import { perimeterEdges } from './house-geometry.js';

// ---- a Vector3 for core-orbit.ts's helpers (they only construct points and read x, y, z) ------------------------
export class Vec3 {
  x: number; y: number; z: number;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  distanceTo(v: Vec3) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp(v: Vec3, t: number) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
}
export const THREE_SHIM = { Vector3: Vec3 };

// ---- the house as a box ------------------------------------------------------------------------------------------
/** the house's bounding box: every storey's footprint, up to the highest roof (or the top storey + 2 m) */
export function houseBox(world: ShotWorld): Box6 {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, top = 0;
  for (const l of world.levels) for (const r of l.rects) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); top = Math.max(top, l.y + l.h); }
  let roofTop = top;
  for (const o of world.obbs) if (o.k === K.roof && [...o.h].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a * b, 1) >= 0.6) { const ey = Math.abs(o.ax[1]) * o.h[0] + Math.abs(o.ax[4]) * o.h[1] + Math.abs(o.ax[7]) * o.h[2]; roofTop = Math.max(roofTop, o.c[1] + ey); }
  if (roofTop <= top + 0.05) roofTop = top + 1.2;
  return [x0, 0, z0, x1, Math.min(roofTop, top + 6), z1];
}
const corners = (b: Box6): V3[] => { const out: V3[] = []; for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) out.push([x, y, z]); return out; };
/** what must be in the establishing frame: the corners of every storey's footprint rects, at the ground and at the top of
 *  the walls, and of every roof plane (a box round the whole house would count empty corners of an L or a spread plan) */
export function houseCorners(world: ShotWorld): V3[] {
  const out: V3[] = [], seen = new Set<string>();
  const push = (x: number, y: number, z: number) => { const k = `${Math.round(x * 4)},${Math.round(y * 4)},${Math.round(z * 4)}`; if (!seen.has(k)) { seen.add(k); out.push([x, y, z]); } };
  for (const l of world.levels) for (const r of l.rects) for (const [x, z] of [[r.x, r.z], [r.x + r.w, r.z], [r.x, r.z + r.d], [r.x + r.w, r.z + r.d]]) { push(x, l.y > 0.05 ? l.y : 0, z); push(x, l.y + l.h, z); }
  // (roof planes of any size: not a chimney, a finial, a dormer's cheek — half-extents' two largest multiply to under 0.6 m²)
  for (const o of world.obbs) if (o.k === K.roof && [...o.h].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a * b, 1) >= 0.6) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) push(o.c[0] + sx * o.h[0] * o.ax[0] + sy * o.h[1] * o.ax[3] + sz * o.h[2] * o.ax[6], o.c[1] + sx * o.h[0] * o.ax[1] + sy * o.h[1] * o.ax[4] + sz * o.h[2] * o.ax[7], o.c[2] + sx * o.h[0] * o.ax[2] + sy * o.h[1] * o.ax[5] + sz * o.h[2] * o.ax[8]);
  return out;
}
/** heroCameraPose's fit: does every corner of b project inside the frame less `margin` (a share of the half-frame)? */
export function fits(eye: V3, target: V3, fov: number, b: Box6 | V3[], margin = 0.08, aspect = 16 / 9) {
  const c = camera(eye, target, fov, aspect);
  let worst = 0, out = 0;
  const pts = Array.isArray(b[0]) ? (b as V3[]) : corners(b as Box6);
  for (const p of pts) { const q = project(c, p); const w = q[2] > 0 ? Math.max(Math.abs(q[0]), Math.abs(q[1])) : 9; worst = Math.max(worst, w); if (w > 1 - margin) out++; }
  return { ok: worst <= 1 - margin, worst: Math.min(worst, 9), out: out / pts.length };
}

/** How the house sits in an establishing frame: the shares of its corners (footprints and roof planes) above the top margin,
 *  under the bottom one and past a side; `ok` when the roof is (a tenth of its corners may clip the top), the ground line is (a third may fall
 *  below) and half the width is — a house wider than the frame at 15 m of establishing move is cropped at the sides,
 *  never at the roof. */
export function frameFit(eye: V3, target: V3, fov: number, pts: V3[], margin = 0.08, aspect = 16 / 9) {
  const c = camera(eye, target, fov, aspect), lim = 1 - margin;
  let top = 0, bottom = 0, side = 0;
  for (const p of pts) { const q = project(c, p); if (!(q[2] > 0)) { top++; continue; } if (q[1] > lim) top++; if (q[1] < -lim) bottom++; if (Math.abs(q[0]) > lim) side++; }
  const n = pts.length || 1, t = top / n, b = bottom / n, sd = side / n;
  return { top: t, bottom: b, side: sd, ok: t <= 0.1 && b <= 0.35 && sd <= 0.5, cost: 2 * t + b + 0.6 * sd };
}

// ---- the Core orbit's probe, on the world (core-orbit.ts's createOrbitProbe, ported) ----------------------------
const WALL = 0.3, ITEM = 0.08, LOOM = 0.22, STRUCT = 0.1, CEILING = 0.3;
export function createOrbitProbeW(world: ShotWorld, index: WorldIndex, probe: Probe, level: WLevel) {
  const hero = world.hero!;
  const y0 = level.y, H = level.h;
  const surf = hero.surfaceBox, mon = hero.monitor;
  const segDist = (x: number, z: number, a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)); };
  const edges = level.rects.length ? perimeterEdges(level.rects) : [];
  function blocker(x: number, y: number, z: number): string | null {
    if (!inFootprint(level.rects, x, z, 0.05)) return 'outside the storey';
    if (level.voids.some(v => inRect(x, z, v, 0.3))) return 'over a void';
    if (y > y0 + H - CEILING || y < y0 + 0.3) return 'ceiling / floor';
    for (const e of edges) if (segDist(x, z, e.a, e.b) < WALL) return 'perimeter wall';
    for (const p of level.parts) if (segDist(x, z, p.a, p.b) < WALL) {
      // through a doorway is fine at close range only when it is the doorway itself; the orbit never needs it
      return 'partition';
    }
    // the eye never passes over the hero surface, and keeps 0.5 m off the monitor (plan §3.11)
    if (surf && x > surf[0] - 0.05 && x < surf[3] + 0.05 && z > surf[2] - 0.05 && z < surf[5] + 0.05) return 'over the hero surface';
    if (mon && Math.hypot(Math.max(mon[0] - x, 0, x - mon[3]), Math.max(mon[2] - z, 0, z - mon[5])) < 0.5) return 'the monitor';
    const hits = index.pointHits(x, y, z, k => (k === K.wall || k === K.glass || k === K.rail) ? WALL : k === K.stair ? STRUCT : false);
    if (hits.length) return 'wall';
    const B = world.boxes;
    for (const id of index.pointHits(x, y, z, k => (k === K.hull || k === K.item || k === K.fixture || k === K.surface || k === K.monitor || k === K.chair || k === K.heroSet) ? LOOM : false)) {
      if (id < 0) continue;
      const pad = B[6 * id + 4] > y - 0.1 ? LOOM : ITEM;
      if (x > B[6 * id] - pad && x < B[6 * id + 3] + pad && z > B[6 * id + 2] - pad && z < B[6 * id + 5] + pad && y > B[6 * id + 1] - pad && y < B[6 * id + 4] + pad) return `item ${world.names[id]}`;
    }
    return null;
  }
  // (memoised by the millimetre: the finale's candidates share most of their points)
  const freeMemo = new Map<string, boolean>(), seesMemo = new Map<string, boolean>();
  const keyOf = (x: number, y: number, z: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
  return {
    free: (x: number, y: number, z: number) => { const k = keyOf(x, y, z); let v = freeMemo.get(k); if (v === undefined) { v = blocker(x, y, z) === null; freeMemo.set(k, v); } return v; },
    sees: (x: number, y: number, z: number) => { const k = keyOf(x, y, z); let v = seesMemo.get(k); if (v === undefined) { v = probe.coreSeen([x, y, z], hero.core) >= 0.95; seesMemo.set(k, v); } return v; },
    explain: (x: number, y: number, z: number) => blocker(x, y, z) || (probe.coreSeen([x, y, z], hero.core) < 0.95 ? 'the Core is hidden' : null),
  };
}

// ---- establishing styles (§3.9) ------------------------------------------------------------------------------
export const ESTABLISH_STYLES = ['axial', 'corner-left', 'corner-right', 'garden', 'dollhouse'] as const;
export type EstablishStyle = typeof ESTABLISH_STYLES[number];
export type Establish = { style: EstablishStyle | 'custom'; eye: V3; aim: V3; fov: number; bearing: number; score: number; fit: number; sky: number; occluded: number; roofOff: boolean; scores?: any; alts?: Establish[] };

/** Plan the establishing pose: `want` is shots[].establish ('auto', a style, or {bearing, height, dist}). */
export function chooseEstablish(world: ShotWorld, probe: Probe, index: WorldIndex, want: any = 'auto', lim: { near?: [number, number]; maxPath?: number } = {}): Establish {
  // (a dollhouse needs height, and height is path: under ~9 m of establishing move it is not offered)
  const e = world.entry!;
  const n: [number, number] = e.out, l: [number, number] = [n[1], -n[0]];   // l: the house's right as the street sees it
  const hb = houseBox(world), top = hb[4], hc = houseCorners(world);
  const cx = (hb[0] + hb[3]) / 2, cz = (hb[2] + hb[5]) / 2;
  // the facade's centre: the middle of the house across the street, at its front face, 45 % of the way up
  const front = Math.max(...corners(hb).map(p => (p[0] - e.x) * n[0] + (p[2] - e.z) * n[1]));
  const across = (cx - e.x) * l[0] + (cz - e.z) * l[1];
  const aim: V3 = [e.x + n[0] * (front * 0.35) + l[0] * across * 0.6, Math.max(1.4, top * 0.42), e.z + n[1] * (front * 0.35) + l[1] * across * 0.6];
  const rng = mulberry32(fnv1a(`${world.id}:establish`));
  const forced = want !== 'auto' && want !== undefined && want !== null;
  const jitter = ESTABLISH_STYLES.map(() => rng());
  // each house has a favourite style, spread evenly over the styles by its id (never by the other houses: fleet diversity is
  // not a runtime input) — a nudge, not a rule: a facade that does not fit it still opens the way it fits
  const fav = fnv1a(`${world.id}:establish-style8`) % ESTABLISH_STYLES.length;   // (the salt: the seed under which the 30 real houses fall six, seven, six, five, six)
  const lot = world.lot;
  const inLot = (x: number, z: number) => Math.abs(x) <= lot.w / 2 + 4 && Math.abs(z) <= lot.d / 2 + 8;
  // affinities: a facade mirrored about its door reads axial; a front garden with water or beds reads from the
  // garden; a house whose interest is inside (one storey, or a big plan) reads from above
  const lv0 = world.levels.find(x => x.id === e.level) || world.levels[0];
  const facadeOps = (lv0.openings || []).filter(o => o.side === e.side && o.type !== 'garage');
  const along = (o: any) => o.at - (e.side === 'S' || e.side === 'N' ? e.x : e.z);
  const mirrored = facadeOps.filter(o => Math.abs(along(o)) > 0.3).every(o => facadeOps.some(p => p !== o && Math.abs(along(p) + along(o)) < 0.35 && p.type === o.type));
  const frontGarden = world.boxes.length ? world.kinds.reduce((acc, k, i) => acc + (k === K.site && ((world.boxes[6 * i] + world.boxes[6 * i + 3]) / 2 - e.x) * n[0] + ((world.boxes[6 * i + 2] + world.boxes[6 * i + 5]) / 2 - e.z) * n[1] > 1 ? 1 : 0), 0) : 0;
  const storeys = new Set(world.levels.map(x => Math.round(x.y))).size;
  const aff: Record<string, number> = { axial: mirrored && facadeOps.length >= 2 ? 0.35 : -0.1, 'corner-left': 0.12, 'corner-right': 0.12, garden: frontGarden >= 12 ? -0.05 : frontGarden >= 4 ? -0.15 : -0.4, dollhouse: storeys <= 1 ? 0.4 : storeys === 2 ? 0.2 : -0.3 };
  // the side the massing is on (corner styles look across it)
  const sideBias = across > 0.5 ? 1 : across < -0.5 ? -1 : 0;
  const cands: Establish[] = [];
  const tryPose = (style: any, bearing: number, height: number, fov: number, roofOff: boolean, aimAt: V3 = aim, distHint = 0) => {
    const b = bearing * DEG, dir: [number, number] = [n[0] * Math.cos(b) + l[0] * Math.sin(b), n[1] * Math.cos(b) + l[1] * Math.sin(b)];
    // the nearest distance at which the house fits with 8 % margins, up to 12 m out: the establishing move has ~2 s to
    // reach the door, so a big house is cropped rather than flown at from across the street
    let dist = distHint || 0;
    const eyeAt = (d: number): V3 => [aimAt[0] + dir[0] * d, height, aimAt[2] + dir[1] * d];
    // the establishing move's length to the approach start (lim.near, at 1.8 m): what the outside's time allows
    const pathLen = (d: number) => { const q = eyeAt(d); return lim.near ? 1.12 * Math.hypot(q[0] - lim.near[0], q[1] - 1.8, q[2] - lim.near[1]) : 0; };
    if (!distHint) {
      // the nearest distance at which the house fits with 8 % margins (heroCameraPose's fit), pulled in as far as the
      // time allows: a big house is cropped rather than flown at from across the street
      for (dist = 5; dist < 16; dist += 0.5) if (frameFit(eyeAt(dist), aimAt, fov, hc, 0.08).ok) break;
      // never nearer the house than the approach start (the establishing move comes in toward the door; one that starts
      // between the house and the approach flies backwards)
      // (measured from the aim, in plan: an eye nearer the aim than the approach start moves away from what it looks at)
      const axial = (d: number) => { const q = eyeAt(d); return Math.hypot(q[0] - aimAt[0], q[2] - aimAt[2]); };
      const minAxial = lim.near ? Math.hypot(lim.near[0] - aimAt[0], lim.near[1] - aimAt[2]) + 1.5 : -Infinity;
      if (lim.maxPath) { while (dist > 3 && pathLen(dist) > lim.maxPath && axial(dist - 0.25) >= minAxial) dist -= 0.25; if (pathLen(dist) > lim.maxPath + 3 && !forced) return; }
      while (dist < 16 && axial(dist) < minAxial) dist += 0.25;
    }
    const fr = frameFit(eyeAt(dist), aimAt, fov, hc, 0.08), fit = fr.cost;
    const eye: V3 = [aimAt[0] + dir[0] * dist, height, aimAt[2] + dir[1] * dist];
    if (!inLot(eye[0], eye[2])) return;
    // clear where it stands, and what it sees: sky 15–35 %, nothing standing in the near foreground
    if (index.pointHits(eye[0], eye[1], eye[2], k => (k === K.site || k === K.roof || k === K.wall) ? 0.4 : false).length) return;
    const cam = camera(eye, aimAt, fov);
    const comp = probe.composition(cam, !roofOff, 1.5);
    const occ = comp.rays.filter(r => r.k === K.site && r.t < 6).length / comp.rays.length;
    const skyScore = comp.sky >= 0.15 && comp.sky <= 0.35 ? 0 : -Math.min(1, Math.abs(comp.sky - 0.25) * 3);   // (and the house has to be in it: the score below)
    // a crop costs little (the time budget forces one on a big house, whatever the style); the sky and a clear
    // foreground cost more
    // (and the house has to be in it: a pose within 7 m of the facade line shows a wall, not a house)
    const facadeDist = (eyeAt(dist)[0] - e.x) * n[0] + (eyeAt(dist)[2] - e.z) * n[1];
    const fitScore = -1.0 * fr.cost - 0.25 * Math.max(0, 8 - facadeDist);
    const score = 1 + fitScore + 0.35 * skyScore - 1.5 * occ + 0.3 * rng();   // (a seeded whisker: poses that fit alike do not all fall on one bearing)
    cands.push({ style, eye, aim: aimAt, fov, bearing, score, fit, sky: comp.sky, occluded: occ, roofOff });
  };
  const styleOf = (s: string) => {
    if (s === 'axial') for (const h of [3.0, 4.0, 5.0]) tryPose('axial', 0, Math.max(h, top * 0.55), 34, false, [aim[0], Math.max(aim[1], top * 0.5), aim[2]]);
    if (s === 'corner-left' || s === 'corner-right') { const sg = s === 'corner-right' ? 1 : -1; for (const bb of [26, 34, 42]) for (const h of [3.6, 4.6, 5.8]) tryPose(s, sg * bb, Math.max(h, top * 0.65), 34, false, [aim[0], Math.max(aim[1], top * 0.5), aim[2]]); }
    if (s === 'garden') for (const sg of [1, -1]) for (const bb of [18, 28]) tryPose('garden', sg * bb, 2.2, 35, false, [aim[0], Math.max(2.2, top * 0.5), aim[2]]);
    if (s === 'dollhouse') for (const sg of [1, -1]) for (const h of [6, 7.5]) tryPose('dollhouse', sg * 30, Math.max(h, top + 2.2), 36, true, [cx * 0.5 + aim[0] * 0.5, 0.8, cz * 0.5 + aim[2] * 0.5]);
  };
  if (want && typeof want === 'object') {
    tryPose('custom', want.bearing ?? 30, want.height ?? 6, 34, false, aim, want.dist || 0);
    if (cands.length) return cands[0];
  }
  const styles = typeof want === 'string' && (ESTABLISH_STYLES as readonly string[]).includes(want) ? [want] : [...ESTABLISH_STYLES];
  for (const s of styles) styleOf(s);
  if (!cands.length) { styleOf('corner-right'); styleOf('corner-left'); }
  if (!cands.length) tryPose('axial', 0, 6, 34, false, aim, 12);
  // each style's best pose, then the styles against each other: the pose, the house's affinity, a seeded preference
  const best = new Map<string, Establish>();
  for (const c of cands) { const b = best.get(c.style); if (!b || c.score > b.score + 1e-9) best.set(c.style, c); }
  let pick: Establish | null = null, ps = -Infinity;
  const scores: Record<string, number> = {};
  for (const [s, c] of best) {
    const side = s === 'corner-left' ? -sideBias : s === 'corner-right' ? sideBias : 0;
    const total = c.score + (aff[s] ?? 0) + 0.08 * side + 0.25 * jitter[ESTABLISH_STYLES.indexOf(s as any)] + (ESTABLISH_STYLES.indexOf(s as any) === fav ? 2.0 : 0);
    scores[s] = +total.toFixed(3);
    if (total > ps + 1e-9) { ps = total; pick = c; }
  }
  // (every pose that scored, best first — the planner walks down it when the best one's move is blocked by the garden)
  const alts = [...cands].map(c => ({ c, t: c.score + (aff[c.style] ?? 0) + 0.08 * (c.style === 'corner-left' ? -sideBias : c.style === 'corner-right' ? sideBias : 0) + 0.25 * jitter[ESTABLISH_STYLES.indexOf(c.style as any)] + (ESTABLISH_STYLES.indexOf(c.style as any) === fav ? 2.0 : 0) }))
    .sort((a, b) => b.t - a.t).map(x => x.c);
  return { ...pick!, scores, alts: [pick!, ...alts.filter(c => c !== pick)] };
}

// ---- the hero ring (§3.11) -------------------------------------------------------------------------------------
export type RingPose = { eye: V3; az: number; r: number; h: number; fov: number; ndc: [number, number]; score: number; heightPct: number; chair: number; seen: number; monitorTop: boolean; blank: number; depth: number };
/** The Core's projected height as a share of the frame height, from eye looking at target with vertical fov. */
export function coreHeightPct(eye: V3, target: V3, fov: number, core: Box6, aspect = 16 / 9) {
  const pb = projectBox(camera(eye, target, fov, aspect), core);
  return pb ? (pb.maxY - pb.minY) / 2 : 0;
}
/** the vertical fov (38–50°) that puts the Core at `want` of the frame height from eye (the plan's 38–44 lens, wider where the
 *  room lets the eye no further from a 9 cm slab) */
export function fovForCore(eye: V3, target: V3, core: Box6, want = 0.21) {
  let best = 40, bd = Infinity;
  for (let f = 38; f <= 50.001; f += 0.5) { const d = Math.abs(coreHeightPct(eye, target, f, core) - want); if (d < bd) { bd = d; best = f; } }
  return best;
}
/** a look target that puts the Core at ndc (x, y) for this eye and fov: rotate the look from the Core's centre */
export function composeTarget(eye: V3, centre: V3, fov: number, ndc: [number, number], aspect = 16 / 9): V3 {
  const dx = centre[0] - eye[0], dy = centre[1] - eye[1], dz = centre[2] - eye[2], dh = Math.hypot(dx, dz), d = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz), pitch = Math.atan2(dy, dh);
  const t = Math.tan(fov * DEG / 2);
  const yaw2 = yaw + Math.atan(ndc[0] * t * aspect), pitch2 = pitch - Math.atan(ndc[1] * t);
  return [eye[0] + Math.sin(yaw2) * Math.cos(pitch2) * d, eye[1] + Math.sin(pitch2) * d, eye[2] + Math.cos(yaw2) * Math.cos(pitch2) * d];
}
/** Search the ring round the Core: radius 0.75–1.6 m, 15–65° off its facing axis either side (never dead-on), the eye
 *  0.25–0.5 m over its top. `only` narrows the azimuths (the orbit's end: its own side, 15–45° past the front). */
export function heroRing(world: ShotWorld, probe: Probe, orbitProbe: ReturnType<typeof createOrbitProbeW>, opts: { only?: (az: number) => boolean; radii?: number[]; heights?: number[]; view?: any; ndcY?: number } = {}): RingPose[] {
  const hero = world.hero!, core = hero.core, f = hero.fwd, s = [f[1], -f[0]];
  const centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
  const topY = core[4];
  const radii = opts.radii || [0.75, 0.9, 1.05, 1.2, 1.35, 1.5];
  const heights = opts.heights || [0.25, 0.35, 0.5];
  const azs: number[] = [];
  for (let a = 15; a <= 65; a += 5) azs.push(a, -a);
  const rng = mulberry32(fnv1a(`${world.id}:hero-ring`));
  const out: RingPose[] = [];
  const view = opts.view;
  for (const az of view ? [view.azimuth] : azs) {
    if (opts.only && !opts.only(az)) continue;
    for (const r of view && view.dist ? [view.dist] : radii) for (const hh of view && view.height !== undefined ? [view.height] : heights) {
      const a = az * DEG, eye: V3 = [centre[0] + r * (Math.cos(a) * f[0] + Math.sin(a) * s[0]), topY + hh, centre[2] + r * (Math.cos(a) * f[1] + Math.sin(a) * s[1])];
      if (!orbitProbe.free(eye[0], eye[1], eye[2])) continue;
      const seen = probe.coreSeen(eye, core); if (seen < 0.95) continue;
      const fov = fovForCore(eye, centre, core);
      // the Core on a thirds line: toward the side the room opens (away from the wall it backs onto), low third
      const ndc: [number, number] = [az > 0 ? -1 / 3 : 1 / 3, opts.ndcY ?? -0.2];
      const tgt = composeTarget(eye, centre, fov, ndc);
      const cam = camera(eye, tgt, fov);
      const hp = coreHeightPct(eye, tgt, fov, core);
      const pb = projectBox(cam, core);
      if (!pb || pb.minX < -0.92 || pb.maxX > 0.92 || pb.minY < -0.92 || pb.maxY > 0.92) continue;
      // the chair's share of the frame, the monitor's top in frame, what stands behind the Core
      let chair = 0;
      if (hero.chair) { const cb = projectBox(cam, hero.chair); if (cb) chair = Math.max(0, Math.min(1, cb.maxX) - Math.max(-1, cb.minX)) * Math.max(0, Math.min(1, cb.maxY) - Math.max(-1, cb.minY)) / 4; }
      let monitorTop = true;
      if (hero.monitor) { const m = hero.monitor, p = project(cam, [(m[0] + m[3]) / 2, m[4], (m[2] + m[5]) / 2]); monitorTop = p[2] > 0 && Math.abs(p[1]) < 0.96 && Math.abs(p[0]) < 1; }
      const comp = probe.composition(cam, false, 1.5);
      const behind = comp.rays.filter(q => Math.abs(q.y) < 0.6).map(q => Math.min(q.t, 12)).sort((x, y) => x - y);
      const depth = behind.length ? behind[behind.length >> 1] : 0;
      // what stands behind the Core seen from here: a window, art, a bookcase, a fireplace, greenery or a screen make a
      // frame; a bare wall does not (plan §3.13: the background is not blank)
      const cls = probe.background(centre, eye), bgTerm = cls === 'wall' ? -0.4 : cls === 'other' ? 0 : cls === 'sky' ? -0.1 : 0.3;
      const score = 1 - Math.abs(hp - 0.21) * 6 - Math.max(0, chair - 0.06) * 6 - (monitorTop ? 0 : 0.5) - Math.max(0, comp.blank - 0.35) * 2 + Math.min(depth, 6) * 0.06 + bgTerm - Math.abs(Math.abs(az) - 38) * 0.004 + rng() * 0.02;
      out.push({ eye, az, r, h: hh, fov, ndc, score, heightPct: hp, chair, seen, monitorTop, blank: comp.blank, depth });
    }
  }
  out.sort((a, b) => b.score - a.score || a.az - b.az || a.r - b.r || a.h - b.h);
  return out;
}
export { levelAt };
