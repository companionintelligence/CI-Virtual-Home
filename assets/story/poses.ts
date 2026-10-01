// The safe-pose solver: for an anchor in the built house, find an EYE where a camera can stand (clear of walls and furniture),
// see the anchor (nothing solid between), show it whole inside the frame, at a size that suits the beat's framing, with the
// anchor on a third of the frame so the popup has the other. A pose is a pure function of the ShotWorld, the anchor and the
// hints: the same inputs give the same pose in Node and in the page (the planner's THREE-free modules are the whole toolbox).
//
// What a pose must satisfy (hard), in order of the search:
//   standing     the eye is on a free cell of the storey's (or the lot's) 0.2 m grid at a clearance tier (0.42/0.32 m, then 0.30/0.20,
//                then 0.22/0.12 and a looser sight line as the last resort: Pose.tier 0, 1, 2)
//   the room     an indoor anchor is seen from its own room or its doorway (1.2 m of slack)
//   sight line   8 of 9 rays to the anchor are clear, the anchor's own boxes skipped (tier 2: 7 of 9)
//   in frame     the anchor's whole projected box is inside +-0.9 NDC at 16:9; the square and phone rows of the compose table widen the
//                lens until it is inside there too (Solved.fitsAll says whether they could)
//   lens clear   nothing within 0.8 m of the lens over more than 12 % of the frame, no wall plane over 50 % of the frame within 1.5 m
// and what it prefers (soft): the size the framing asks for (close / medium / wide), seeing the front of the thing, open depth
// behind it, a clearance to spare, and not the same shot twice for one anchor. Outdoors it also prefers that the house stands
// behind the anchor, seen 25 to 60 degrees off the wall's normal, over bare scenery; and when no eye on the ground works, it
// retries from the air (the asymmetry loungers).
//
// The composition is NOT baked into the target alone: a pose carries a compose table (anchor offset and lens per aspect) so the
// track can re-aim for a phone (track.ts). Owner: story-bake. THREE-free.
import { K, inRect, createWorldIndex, type ShotWorld, type Box6, type WorldIndex } from '../shot-world.js';
import { createNav, type Nav, type Grid, CELL } from '../shot-nav.js';
import { createProbe, camera, projectBox, type Probe, type V3 } from '../shot-probe.js';
import type { CameraHint, Pose, RoleId } from './types.js';
import type { Resolved } from './anchors.js';

export type PoseCtx = { world: ShotWorld; index: WorldIndex; nav: Nav; probe: Probe; /** set to {} to count what the search rejected and why (the bake prints it for a beat with no pose) */ debug?: Record<string, number> };
export function createPoseCtx(world: ShotWorld): PoseCtx {
  const index = createWorldIndex(world);
  return { world, index, nav: createNav(world, index), probe: createProbe(index) };
}

// ---- composition: where the anchor sits in the frame, per aspect --------------------------------------------------------
const DEG = Math.PI / 180;
export const ASPECT_WIDE = 16 / 9, ASPECT_SQUARE = 1, ASPECT_TALL = 0.5;
/** one row of a pose's compose table: at this aspect the anchor's aim point is at (nx, ny) in NDC and the lens is `fov` (vertical, degrees) */
export type Compose = { a: number; nx: number; ny: number; fov: number };

/** the point to look at so that `focus` lands at (nx, ny) in NDC for a camera at `eye` with this lens and aspect (roll 0) */
export function composeTarget(eye: V3, focus: V3, nx: number, ny: number, fovDeg: number, aspect: number): V3 {
  const dx = focus[0] - eye[0], dy = focus[1] - eye[1], dz = focus[2] - eye[2], dh = Math.hypot(dx, dz), d = Math.hypot(dx, dy, dz) || 1;
  const tv = Math.tan(fovDeg * DEG / 2), yaw = Math.atan2(dx, dz) + Math.atan(nx * tv * aspect), pitch = Math.atan2(dy, dh) - Math.atan(ny * tv);
  return [eye[0] + Math.sin(yaw) * Math.cos(pitch) * d, eye[1] + Math.sin(pitch) * d, eye[2] + Math.cos(yaw) * Math.cos(pitch) * d];
}
/** the table's row for an aspect: linear in the aspect between the rows (clamped at the ends) */
export function composeAt(table: Compose[], aspect: number): Compose {
  const rows = table.slice().sort((p, q) => q.a - p.a);   // widest first
  if (aspect >= rows[0].a) return rows[0];
  if (aspect <= rows[rows.length - 1].a) return rows[rows.length - 1];
  for (let i = 0; i + 1 < rows.length; i++) {
    const p = rows[i], q = rows[i + 1];
    if (aspect <= p.a && aspect >= q.a) { const u = (p.a - aspect) / (p.a - q.a); return { a: aspect, nx: p.nx + (q.nx - p.nx) * u, ny: p.ny + (q.ny - p.ny) * u, fov: p.fov + (q.fov - p.fov) * u }; }
  }
  return rows[0];
}

/** how much of the frame is usable at an aspect: a phone's bottom sheet takes the lower part, so the anchor lives above it */
const usableY = (a: number): [number, number] => (a < 0.8 ? [-0.18, 0.88] : [-0.88, 0.88]);
/** the default offset of the anchor at an aspect (side -1 left, +1 right, 0 centre) */
const offsetFor = (a: number, side: number): [number, number] => (a >= 1.2 ? [0.4 * side, -0.06] : a >= 0.8 ? [0.26 * side, 0.0] : [0, 0.34]);

type Fit = { ok: boolean; fov: number; row: Compose };
/** the widest lens each frame may use: a 16:9 frame at 88 degrees vertical is a fisheye, a phone's narrow one is not */
const maxFov = (fov0: number, a: number) => (a >= 1.2 ? fov0 + 12 : a >= 0.8 ? fov0 + 20 : 90);
/** the smallest lens (not below fov0) at which `box` is inside the usable frame at this aspect with the wanted offset */
function fitAt(eye: V3, focus: V3, box: Box6, fov0: number, aspect: number, side: number, margin = 0.9): Fit {
  const [nx, ny] = offsetFor(aspect, side), [yLo, yHi] = usableY(aspect), top = maxFov(fov0, aspect);
  for (let fov = fov0; ; fov += aspect >= 1.2 ? 3 : 4) {
    const f = Math.min(fov, top), tgt = composeTarget(eye, focus, nx, ny, f, aspect), pb = projectBox(camera(eye, tgt, f, aspect), box);
    if (pb && pb.minX >= -margin && pb.maxX <= margin && pb.minY >= Math.max(-margin, yLo) && pb.maxY <= Math.min(margin, yHi)) return { ok: true, fov: f, row: { a: aspect, nx, ny, fov: f } };
    if (f >= top) break;
  }
  return { ok: false, fov: top, row: { a: aspect, nx, ny, fov: top } };
}
/** `box` shrunk about its centre to at most `w` metres across in plan (the part of a long thing a narrow frame must keep) */
function shrinkBox(b: Box6, w: number): Box6 {
  const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, hx = Math.min((b[3] - b[0]) / 2, w / 2), hz = Math.min((b[5] - b[2]) / 2, w / 2);
  return [cx - hx, b[1], cz - hz, cx + hx, b[4], cz + hz];
}

// ---- framing -----------------------------------------------------------------------------------------------------------------
type Band = { fov: number; dMin: number; dMax: number; size: number };   // target share of the frame, lens, eye distance range (m)
const IN: Record<string, Band> = {
  close: { fov: 46, dMin: 0.9, dMax: 3.0, size: 0.62 },
  medium: { fov: 54, dMin: 1.3, dMax: 5.0, size: 0.4 },
  wide: { fov: 62, dMin: 2.0, dMax: 7.5, size: 0.22 },
};
const OUT: Record<string, Band> = {
  close: { fov: 42, dMin: 2.2, dMax: 7, size: 0.55 },
  medium: { fov: 46, dMin: 3, dMax: 11, size: 0.38 },
  wide: { fov: 52, dMin: 5, dMax: 20, size: 0.24 },
};
const TIERS = [
  { wall: 0.42, item: 0.32, vis: 8 / 9 - 1e-6 },
  { wall: 0.30, item: 0.20, vis: 8 / 9 - 1e-6 },
  { wall: 0.22, item: 0.12, vis: 7 / 9 - 1e-6 },
];

export type Solved = {
  pose: Pose;
  /** the point the camera is composed on (the anchor's aim) and its box, for the track and the popup placement */
  focus: V3; box: Box6;
  /** the point the sight line is drawn to (the focus, but for a house seen from the street: its front door) */
  sight: V3;
  /** the anchor's own boxes (for the sight line) and the way it faces */
  fwd: [number, number] | null;
  compose: Compose[];
  /** every row fit its frame (false: the anchor is bigger than the phone frame can hold even at an 88 degree lens) */
  fitsAll: boolean;
  /** a narrow row holds only the essential part of the anchor (see completeTable) */
  partial: boolean;
  score: number; distance: number; instance: number; aerial: boolean;
  notes: string[];
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm2 = (x: number, z: number): [number, number] => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** the digest boxes that belong to the anchor or touch it (a rug under a sofa, the plants in a bed): they do not block the view of it */
function ownBoxes(world: ShotWorld, box: Box6, extra: Box6[]): Set<number> {
  const own = new Set<number>(), E = 0.12;
  const hits = (o: Box6, b: Box6) => o[0] < b[3] + E && o[3] > b[0] - E && o[1] < b[4] + E && o[4] > b[1] - E && o[2] < b[5] + E && o[5] > b[2] - E;
  for (let q = 0; q < world.kinds.length; q++) {
    const k = world.kinds[q]; if (k === K.wall || k === K.glass || k === K.roof || k === K.rail) continue;
    const o = world.boxes.slice(6 * q, 6 * q + 6) as Box6;
    if (hits(o, box) || extra.some(e => hits(o, e))) own.add(q);
  }
  return own;
}

/** the boxes of the whole house (for framing it from the street) */
export function houseBox(world: ShotWorld): Box6 {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y1 = 0;
  for (const l of world.levels) { for (const r of l.rects) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); } y1 = Math.max(y1, l.y + l.h); }
  if (!Number.isFinite(x0)) return [-4, 0, -4, 4, 3, 4];
  return [x0, 0, z0, x1, y1 + 1.2, z1];
}

type Opts = { hint?: CameraHint; avoid?: Array<{ eye: V3; yaw: number; level: string | null }>; aspect?: number };

/** Solve one resolved anchor. null when nothing works (the caller tries the next instance or fallback). */
export function solvePose(ctx: PoseCtx, r: Resolved, opts: Opts = {}): Solved | null {
  const hint = opts.hint || {};
  if (r.role === 'room') return solveRoom(ctx, r, opts);
  const notes: string[] = [];
  const outside = r.outside;   // (a terrace room is indoors in the digest: its instance says so)
  const frame = r.role === 'street' ? houseBox(ctx.world) : r.box;
  // (the house seen from the street is composed on its middle, and sighted at its front door: a ray to the middle would end in the wall)
  const hb = houseBox(ctx.world);
  const aim: V3 = r.role === 'street' ? [(hb[0] + hb[3]) / 2, Math.max(1.5, Math.min(6, hb[4] * 0.45)), (hb[2] + hb[5]) / 2] : r.aim;
  const sight: V3 = r.role === 'street' ? [r.aim[0], r.aim[1] - 0.45, r.aim[2]] : aim;
  const framing = hint.framing || (r.role === 'street' ? 'wide' : outside ? 'medium' : 'medium');
  const band0 = (outside ? OUT : IN)[framing];
  // the anchor's size in plan sets how far back the eye must go to hold all of it
  const sz = Math.max(frame[3] - frame[0], frame[5] - frame[2], (frame[4] - frame[1]) * 1.1);
  const core = ctx.world.hero && r.role === 'core' ? ctx.world.hero.core : null;
  const essential: Box6 = core ? [core[0] - 0.3, core[1] - 0.2, core[2] - 0.3, core[3] + 0.3, core[4] + 0.3, core[5] + 0.3] : shrinkBox(frame, r.role === 'street' ? 9 : 2.2);
  const own = ownBoxes(ctx.world, frame, r.boxes);
  const skip = (q: number) => own.has(q);
  const rungs: Array<{ aerial: boolean; scale: number }> = outside ? (hint.eye === 'aerial' ? [{ aerial: true, scale: 1 }, { aerial: false, scale: 1 }] : [{ aerial: false, scale: 1 }, { aerial: true, scale: 1.6 }]) : [{ aerial: false, scale: 1 }];
  for (const rung of rungs) {
    const res = searchEye(ctx, r, { frame, essential, aim, sight, sz, own, skip, band: { ...band0, dMax: Math.max(band0.dMax, sz * 2.4) * rung.scale, dMin: Math.max(band0.dMin, sz * 0.35) }, outside, aerial: rung.aerial, hint, framing, avoid: opts.avoid || [], notes });
    if (res) return res;
  }
  return null;
}

function searchEye(ctx: PoseCtx, r: Resolved, s: {
  frame: Box6; essential: Box6; aim: V3; sight: V3; sz: number; own: Set<number>; skip: (q: number) => boolean; band: Band; outside: boolean; aerial: boolean; hint: CameraHint; framing: string;
  avoid: Array<{ eye: V3; yaw: number; level: string | null }>; notes: string[];
}): Solved | null {
  const { world, nav, probe } = ctx;
  const { frame, aim, band, hint, outside, aerial } = s;
  const lv = !outside && r.level ? nav.levelOf(r.level) : null;
  const g: Grid = outside ? nav.grid(null, r.y > 0.4 ? r.y : 0) : nav.grid(lv);
  const baseY = outside ? (r.y > 0.4 ? r.y : 0) : (lv ? lv.y : 0);
  const eyeH = hint.eye === 'seated' ? 1.1 : hint.eye === 'low' ? 0.75 : outside ? 1.7 : 1.5;
  const eyeY = aerial ? baseY + 6.2 : baseY + eyeH;
  const fov0 = aerial ? band.fov + 4 : band.fov;
  const cx = aim[0], cz = aim[2], R = band.dMax;
  const fwd = r.fwd, side0 = hint.side === 'left' ? -1 : hint.side === 'right' ? 1 : 0;
  const entry = world.entry, out = entry && entry.out ? entry.out : [0, 1];
  // the direction the hint asks to look from: front = the way it faces (a zone or the house: the street side)
  const frontVec: [number, number] = fwd ? norm2(fwd[0], fwd[1]) : norm2(out[0], out[1]);
  const wantVec: [number, number] | null = hint.from === 'front' ? frontVec : hint.from === 'behind' ? [-frontVec[0], -frontVec[1]] : hint.from === 'left' ? [frontVec[1], -frontVec[0]] : hint.from === 'right' ? [-frontVec[1], frontVec[0]] : null;
  const room = !outside ? r.room : null;
  const i0 = Math.max(0, Math.floor((cx - R - g.x0) / CELL)), i1 = Math.min(g.W - 1, Math.ceil((cx + R - g.x0) / CELL));
  const j0 = Math.max(0, Math.floor((cz - R - g.z0) / CELL)), j1 = Math.min(g.H - 1, Math.ceil((cz + R - g.z0) / CELL));
  const roofs = outside, stride = R > 24 ? 3 : R > 12 ? 2 : 1;   // (a house seen from the street has tens of thousands of cells to try)
  let found: Solved | null = null;
  for (let ti = 0; ti < TIERS.length && !found; ti++) {
    const T = TIERS[ti];
    let best: Solved | null = null, bestScore = -Infinity;
    const dbg = ctx.debug, rej = (k: string) => { if (dbg) dbg[k] = (dbg[k] || 0) + 1; };
    for (let j = j0; j <= j1; j += stride) for (let i = i0; i <= i1; i += stride) {
      const c = j * g.W + i; if (!g.free[c]) { rej('cell not free'); continue; }
      if (g.dW[c] < T.wall || g.dI[c] < T.item) { rej('too close to a wall or furniture'); continue; }
      const x = g.x0 + i * CELL, z = g.z0 + j * CELL, d = Math.hypot(x - cx, z - cz);
      if (d < band.dMin || d > band.dMax) { rej('distance out of range'); continue; }
      if (room && !inRect(x, z, room.b, 1.2)) { rej('outside the anchor\'s room'); continue; }
      const eye: V3 = [x, eyeY, z];
      const vis = probe.visibility(eye, s.sight, 0.18, roofs, s.skip);
      if (vis < T.vis) { rej('sight line blocked'); continue; }
      // the compose table at every aspect: the anchor has to fit them all (the phone's is the tightest)
      const sides = side0 !== 0 ? [side0] : [-1, 1, 0];   // (a subject too wide for a third of the frame, a whole house, takes the middle)
      let bestSide: { side: number; table: Compose[]; fits: boolean; sc: number; tgt: V3; comp: ReturnType<Probe['composition']>; size: number } | null = null;
      for (const side of sides) {
        const wide = fitAt(eye, aim, frame, fov0, ASPECT_WIDE, side);
        if (!wide.ok) { rej('does not fit the 16:9 frame'); continue; }
        const tgt = composeTarget(eye, aim, wide.row.nx, wide.row.ny, wide.fov, ASPECT_WIDE);
        const cam = camera(eye, tgt, wide.fov, ASPECT_WIDE);
        const pb = projectBox(cam, frame); if (!pb) continue;
        const pitch = Math.atan2(tgt[1] - eye[1], Math.hypot(tgt[0] - eye[0], tgt[2] - eye[2])) / DEG;
        if (pitch < -52 || pitch > 30) { rej('pitch'); continue; }
        const comp = probe.composition(cam, roofs);
        if (comp.fore > 0.12 || comp.share(1.5) > 0.5) { rej('lens blocked'); continue; }                       // nothing in the lens, no blank wall filling the frame
        const size = Math.max((pb.maxY - pb.minY) / 2, (pb.maxX - pb.minX) / 2);
        const depth = comp.rays.reduce((a, q) => a + Math.min(isFinite(q.t) ? q.t : 12, 12), 0) / comp.rays.length;
        const sc = depth * 0.22 - comp.share(2.5) * 2 - Math.pow((size - band.size) / 0.16, 2) * 0.9 - (side === 0 ? 0.8 : 0);
        if (!bestSide || sc > bestSide.sc) bestSide = { side, table: [wide.row], fits: true, sc, tgt, comp, size };
      }
      if (!bestSide) continue;
      // facing, the hinted bearing, clearance, distance, a different shot from the ones already taken for this anchor
      const toEye = norm2(x - cx, z - cz);
      let score = bestSide.sc + vis;
      if (wantVec) score += (toEye[0] * wantVec[0] + toEye[1] * wantVec[1]) * 1.2;
      else if (fwd) score += (toEye[0] * frontVec[0] + toEye[1] * frontVec[1]) * (r.role === 'core' ? 1.2 : 0.7);
      score += Math.min(1.2, g.dW[c]) * 0.9 + Math.min(1.0, g.dI[c]) * 0.45;
      score -= Math.abs(d - (band.dMin + band.dMax) / 2) * 0.05;
      const yaw = Math.atan2(bestSide.tgt[0] - x, bestSide.tgt[2] - z);
      for (const a of s.avoid) if (a.level === r.level && Math.hypot(a.eye[0] - x, a.eye[2] - z) < 1.3 && Math.abs(Math.atan2(Math.sin(a.yaw - yaw), Math.cos(a.yaw - yaw))) < 0.5) { score -= 3; break; }
      if (outside) {
        // the house behind the anchor, seen at an angle, beats bare scenery
        const dir = norm2(cx - x, cz - z);
        const back = probe.cast([cx + dir[0] * 0.3, aim[1], cz + dir[1] * 0.3], [dir[0], 0, dir[1]], 45, true, s.skip);
        if (back && (back.k === K.wall || back.k === K.glass || back.k === K.roof || back.k === 0)) {
          const nrm = norm2(back.nrm[0], back.nrm[2]), ang = Math.acos(Math.max(-1, Math.min(1, -(dir[0] * nrm[0] + dir[1] * nrm[1])))) / DEG;
          score += 0.9 + (ang >= 25 && ang <= 60 ? 0.9 : ang < 10 || ang > 78 ? -0.3 : 0.2);
        } else if (back) score += 0.2; else score -= 0.5;
      }
      if (score > bestScore + 1e-9) {
        bestScore = score;
        const table = completeTable(eye, aim, frame, s.essential, bestSide.table[0], bestSide.side);
        best = {
          pose: { eye: round3(eye), target: round3(bestSide.tgt), fov: bestSide.table[0].fov, level: outside ? null : r.level, tier: ti as 0 | 1 | 2, resolved: { role: r.role as RoleId, type: r.type, viaFallback: r.viaFallback } },
          focus: [aim[0], aim[1], aim[2]], sight: [s.sight[0], s.sight[1], s.sight[2]], box: frame, fwd: r.fwd, compose: table.rows, fitsAll: table.ok, partial: table.partial, score, distance: +d.toFixed(2), instance: r.nth, aerial, notes: s.notes.slice(),
        };
      }
    }
    if (best) found = best;
  }
  if (found && found.aerial) found.notes.push('aerial retry');
  return found;
}

const round3 = (v: V3): V3 => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000, Math.round(v[2] * 1000) / 1000];

/** the square and phone rows of the compose table, fit for the chosen eye and side. A row that cannot hold the whole box holds the
 *  essential part of it (the Core of a desk set, the middle of a long drive); `partial` says one did. */
function completeTable(eye: V3, aim: V3, box: Box6, essential: Box6, wide: Compose, side: number) {
  const rows: Compose[] = [wide]; let ok = true, partial = false;
  for (const a of [ASPECT_SQUARE, ASPECT_TALL]) {
    let f = fitAt(eye, aim, box, wide.fov, a, side);
    if (!f.ok) { const e = fitAt(eye, aim, essential, wide.fov, a, side); if (e.ok) { f = e; partial = true; } else ok = false; }
    rows.push(f.row);
  }
  return { rows, ok, partial };
}

// ---- a room (the centre of it, wide) -------------------------------------------------------------------------------------
function solveRoom(ctx: PoseCtx, r: Resolved, opts: Opts): Solved | null {
  const { world, nav, probe } = ctx;
  if (!r.room || !r.level) return null;
  const lv = nav.levelOf(r.level), g = nav.grid(lv), b = r.room.b, aim = r.aim;
  const eyeY = lv.y + 1.5, hint = opts.hint || {}, side = hint.side === 'left' ? -1 : hint.side === 'right' ? 1 : 0;
  const diag = Math.hypot(b.w, b.d), fov0 = hint.framing === 'close' ? 56 : hint.framing === 'medium' ? 62 : 68;
  // what the room has to show: its furniture, as points at table height
  const pts: V3[] = r.room.items.filter(it => !/rug|ceiling|pendant|light|curtain|vent/i.test(it.type)).map(it => [it.at[0], lv.y + 0.7, it.at[1]] as V3);
  let best: Solved | null = null, bestScore = -Infinity;
  for (let ti = 0; ti < TIERS.length && !best; ti++) {
    const T = TIERS[ti];
    for (let j = 0; j < g.H; j += 1) for (let i = 0; i < g.W; i += 1) {
      const c = j * g.W + i; if (!g.free[c] || g.dW[c] < T.wall || g.dI[c] < T.item) continue;
      const x = g.x0 + i * CELL, z = g.z0 + j * CELL;
      if (!inRect(x, z, b, 0.3)) continue;
      const d = Math.hypot(x - aim[0], z - aim[2]); if (d < Math.max(1.4, diag * 0.28)) continue;
      const eye: V3 = [x, eyeY, z];
      for (const sd of side !== 0 ? [side] : [-1, 1]) {
        const tgt = composeTarget(eye, aim, 0.18 * sd, -0.05, fov0, ASPECT_WIDE), cam = camera(eye, tgt, fov0, ASPECT_WIDE);
        const pa = projectBox(cam, [aim[0] - 0.2, aim[1] - 0.2, aim[2] - 0.2, aim[0] + 0.2, aim[1] + 0.2, aim[2] + 0.2]); if (!pa || Math.abs(pa.minX) > 0.6) continue;
        const pitch = Math.atan2(tgt[1] - eye[1], Math.hypot(tgt[0] - eye[0], tgt[2] - eye[2])) / DEG; if (pitch < -40 || pitch > 20) continue;
        const comp = probe.composition(cam, false); if (comp.fore > 0.12 || comp.share(1.5) > 0.5) continue;
        let seen = 0;
        for (const p of pts) { const q = projectBox(cam, [p[0] - 0.05, p[1] - 0.05, p[2] - 0.05, p[0] + 0.05, p[1] + 0.05, p[2] + 0.05]); if (q && Math.abs(q.minX) < 0.85 && Math.abs(q.minY) < 0.85 && probe.clear(eye, p, false)) seen++; }
        const cover = pts.length ? seen / pts.length : 0.5;
        const depth = comp.rays.reduce((a, q) => a + Math.min(isFinite(q.t) ? q.t : 12, 12), 0) / comp.rays.length;
        const score = cover * 3 + depth * 0.18 - comp.share(2.5) * 2 + Math.min(1.0, g.dW[c]) * 0.4 + Math.min(d, diag * 0.55) * 0.12;
        if (score > bestScore + 1e-9) {
          bestScore = score;
          const rows: Compose[] = [{ a: ASPECT_WIDE, nx: 0.18 * sd, ny: -0.05, fov: fov0 }, { a: ASPECT_SQUARE, nx: 0.1 * sd, ny: 0, fov: fov0 + 4 }, { a: ASPECT_TALL, nx: 0, ny: 0.2, fov: fov0 + 8 }];
          best = { pose: { eye: round3(eye), target: round3(tgt), fov: fov0, level: r.level, tier: ti as 0 | 1 | 2, resolved: { role: 'room', type: 'room', viaFallback: r.viaFallback } }, focus: [aim[0], aim[1], aim[2]], sight: [aim[0], aim[1], aim[2]], box: r.box, fwd: null, compose: rows, fitsAll: true, partial: false, score, distance: +d.toFixed(2), instance: r.nth, aerial: false, notes: [`covers ${seen}/${pts.length} pieces`] };
        }
      }
    }
  }
  return best;
}

/** Sight and frame check for a finished pose, for the tests and the review: the anchor seen (share of 9 rays), whole in frame at each aspect */
export function checkPose(ctx: PoseCtx, s: Solved, r: Resolved) {
  const own = ownBoxes(ctx.world, s.box, r.boxes), skip = (q: number) => own.has(q);
  const vis = ctx.probe.visibility(s.pose.eye, s.sight, 0.18, r.outside, skip);
  const rows = s.compose.map(row => {
    const t = composeTarget(s.pose.eye, s.focus, row.nx, row.ny, row.fov, row.a), pb = projectBox(camera(s.pose.eye, t, row.fov, row.a), s.box);
    return { a: row.a, inside: !!pb && pb.minX >= -0.9 - 1e-6 && pb.maxX <= 0.9 + 1e-6 && pb.minY >= -0.9 - 1e-6 && pb.maxY <= 0.9 + 1e-6, pb };
  });
  return { vis, rows };
}
