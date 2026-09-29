// Planner v2's other two shots (plan Completeness B), baked to the same track format as door-to-core
// (assets/shot-planner.ts) so the page, the timeline and QA v2 treat them alike:
//
//   hero-reveal   lands on the hero ring's best viewpoint — the ring door-to-core's finale ends on (framing.ts heroRing:
//                 0.75–1.6 m out, 15–65° off the Core's face, the Core 18–25 % of the frame on a thirds line, the
//                 monitor's top in, the chair out of the way) — pulling in from across the Core's room under its
//                 ceiling (the v1 one dropped through the roof of a one-storey house), then settles and presses
//   walkthrough   a tour of the entry storey's rooms worth seeing, routed on nav v2 through the doorways (the v1 one
//                 flew straight lines through partitions, always looking north), ending at the Core's ring when the
//                 Core is on that storey
//
// THREE-free and deterministic, like the rest of planner v2. Owner: S5 (shot).
import { Math } from './detmath.js';
import { K, DEG, clamp, inRect, inFootprint, mulberry32, fnv1a, wrapPi, createWorldIndex, type ShotWorld, type WLevel, type WRoom } from './shot-world.js';
import { createNav, roomInterest } from './shot-nav.js';
import { planDoors } from './shot-doors.js';
import { createProbe, camera, project, type V3 } from './shot-probe.js';
import { createOrbitProbeW, heroRing, fovForCore } from './framing.js';
import { BEATS, FPS, YAW_CAP, hann, rateLimit, fillet, polyLen, sampleTrack, trackHash, planDoorToCore, type Track, type Beat } from './shot-planner.js';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
/** the share of a move done at t of its T seconds: half a second to get up to speed, a steady pace, half a second to come to rest — a dolly, not an ease
 *  (an ease-in-out crawls through its first and last second, which is dead air) */
const trapezoid = (t: number, T: number) => {
  const a = Math.min(0.5, T * 0.3), d = a, vc = 1 / (T - (a + d) / 2), x = clamp(t, 0, T);
  if (x < a) return vc * x * x / (2 * a);
  if (x > T - d) return 1 - vc * (T - x) * (T - x) / (2 * d);
  return vc * a / 2 + vc * (x - a);
};
const minJerk = (u: number) => { const x = clamp(u, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };

/** a dense polyline (every 2 cm) with a beat per point → arrays and arc length */
function densify(segs: Array<{ beat: Beat; pts: V3[] }>) {
  const X: number[] = [], Y: number[] = [], Z: number[] = [], B: number[] = [];
  for (const [si, s] of segs.entries()) {
    const b = BEATS.indexOf(s.beat);
    for (let k = 0; k < s.pts.length - 1; k++) {
      const a = s.pts[k], c = s.pts[k + 1], m = Math.max(1, Math.ceil(len(sub(c, a)) / 0.02));
      for (let q = 0; q < m; q++) { const p = lerp3(a, c, q / m); if (X.length && Math.hypot(p[0] - X[X.length - 1], p[1] - Y[Y.length - 1], p[2] - Z[Z.length - 1]) < 1e-6) continue; X.push(p[0]); Y.push(p[1]); Z.push(p[2]); B.push(b); }
    }
    if (si === segs.length - 1) { const p = s.pts[s.pts.length - 1]; X.push(p[0]); Y.push(p[1]); Z.push(p[2]); B.push(b); }
  }
  const S = new Float64Array(X.length);
  for (let i = 1; i < X.length; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1], Z[i] - Z[i - 1]);
  const at = (s: number) => {
    let lo = 0, hi = X.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0;
    return { p: [X[lo] + (X[hi] - X[lo]) * f, Y[lo] + (Y[hi] - Y[lo]) * f, Z[lo] + (Z[hi] - Z[lo]) * f] as V3, b: f < 0.5 ? B[lo] : B[hi] };
  };
  return { X, Y, Z, B, S, total: S[S.length - 1], at };
}

/** the track's common tail: look solved toward a target per sample (rate-limited by beat, smoothed), fov, compose,
 *  roof off (these shots stay inside), events (the press once the Core has been in sight 1.5 s and the camera settled) */
function finishTrack(type: string, world: ShotWorld, probe: any, duration: number, pos: Float32Array, beatOf: Uint8Array, want: (i: number) => V3, fovAt: (t: number) => number, compose: { ndcX: number; ndcY: number } | null, composeAt: (t: number) => number, plan: any): Track {
  const N = beatOf.length, dt = duration / (N - 1);
  const hero = world.hero!, core = hero.core, centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
  const DX = new Float64Array(N), DY = new Float64Array(N), DZ = new Float64Array(N), dist = new Float64Array(N);
  for (let i = 0; i < N; i++) { const e: V3 = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], w = want(i), d = sub(w, e), l = len(d) || 1; DX[i] = d[0] / l; DY[i] = d[1] / l; DZ[i] = d[2] / l; dist[i] = Math.max(0.8, Math.min(8, l)); }
  const hw = Math.round(0.25 * FPS), sx = hann(DX, hw), sy = hann(DY, hw), sz = hann(DZ, hw);
  const yaw = new Float64Array(N), pitch = new Float64Array(N);
  for (let i = 0; i < N; i++) { const l = Math.hypot(sx[i], sy[i], sz[i]) || 1; yaw[i] = Math.atan2(sx[i] / l, sz[i] / l); pitch[i] = Math.atan2(sy[i] / l, Math.hypot(sx[i], sz[i]) / l); if (i) yaw[i] = yaw[i - 1] + wrapPi(yaw[i] - yaw[i - 1]); }
  const desired = new Float32Array(2 * N); for (let i = 0; i < N; i++) { desired[2 * i] = yaw[i]; desired[2 * i + 1] = pitch[i]; }
  const capY = new Float64Array(N), capP = new Float64Array(N);
  for (let i = 0; i < N; i++) { const b = BEATS[beatOf[i]]; capY[i] = YAW_CAP[b] * DEG * 0.9 * dt; capP[i] = (YAW_CAP[b] * 0.5 + 3) * DEG * dt; }
  const yl = hann(rateLimit(yaw, capY), Math.round(0.125 * FPS)), pl = hann(rateLimit(pitch, capP), Math.round(0.125 * FPS)), dl = hann(dist, Math.round(0.25 * FPS));
  const look = new Float32Array(3 * N), fov = new Float32Array(N), roofAlpha = new Float32Array(N), composeW = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c = Math.cos(pl[i]);
    look[3 * i] = pos[3 * i] + Math.sin(yl[i]) * c * dl[i]; look[3 * i + 1] = pos[3 * i + 1] + Math.sin(pl[i]) * dl[i]; look[3 * i + 2] = pos[3 * i + 2] + Math.cos(yl[i]) * c * dl[i];
    fov[i] = fovAt(i * dt); composeW[i] = composeAt(i * dt); roofAlpha[i] = 0;
  }
  const beats: Track['beats'] = [];
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && beatOf[j + 1] === beatOf[i]) j++; beats.push({ name: BEATS[beatOf[i]], t0: +(i * dt).toFixed(4), t1: +((j + 1 < N ? j + 1 : j) * dt).toFixed(4), subject: null }); i = j + 1; }
  const track: Track = { version: 2, planner: 'v2', type, id: world.id, duration, fps: FPS, samples: N, dt, pos, look, fov, roofAlpha, composeW, compose, beat: beatOf, beats, events: { enterT: null, stairT: [], pressT: null, settleT: null, doneT: duration, firstCoreT: null }, doors: planDoors(world, pos, N, dt), metrics: {}, plan, desired };
  // the press: once the Core has been in frame and in sight for 1.5 s, and the power beat has begun
  const pw = beats.find(b => b.name === 'power');
  if (pw) {
    let first: number | null = null;
    for (let i = N - 1; i >= 0; i -= 6) {
      const f = sampleTrack(track, i / (N - 1)), p = project(camera(f.eye, f.target, f.fov), centre);
      if (!(p[2] > 0 && Math.abs(p[0]) < 0.9 && Math.abs(p[1]) < 0.9 && probe.coreSeen(f.eye, core) >= 0.95)) break;
      first = i * dt;
    }
    track.events.firstCoreT = first === null ? null : +first.toFixed(4);
    track.events.settleT = pw.t0;
    track.events.pressT = +Math.min(duration - 1.4, Math.max(pw.t0 + 0.3, (first ?? pw.t0) + 1.5)).toFixed(4);
  }
  track.hash = trackHash(track);
  return track;
}

// ---- hero-reveal ---------------------------------------------------------------------------------------------------
export function planHeroReveal(world: ShotWorld, opts: { duration?: number; heroView?: any } = {}) {
  if (!world.hero) return { ok: false as const, code: 'core-missing', message: 'no Companion Core' };
  const index = createWorldIndex(world), probe = createProbe(index);
  const hero = world.hero, lv = world.levels.find(l => l.id === hero.level) || world.levels[0];
  const core = hero.core, centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
  const op = createOrbitProbeW(world, index, probe, lv);
  const r7 = mulberry32(fnv1a(`${world.id}:hero-reveal`));
  const ring = heroRing(world, probe, op, { view: opts.heroView, ndcY: +(-0.35 + r7() * 0.3).toFixed(3) });
  const end: V3 = ring.length ? ring[0].eye : [centre[0] + hero.fwd[0] * 1.3, core[4] + 0.35, centre[2] + hero.fwd[1] * 1.3];
  // the start: back along the ring's line from the Core, under the ceiling, as far as the room is clear (≤ 2.6 m)
  const out = [end[0] - centre[0], 0, end[2] - centre[2]], ol = Math.hypot(out[0], out[2]) || 1, u: V3 = [out[0] / ol, 0, out[2] / ol];
  const top = lv.y + lv.h - 0.45;
  const clearAt = (p: V3) => inFootprint(lv.rects, p[0], p[2], 0.35) && !lv.voids.some(v => inRect(p[0], p[2], v, 0.3)) && p[1] < lv.y + lv.h - 0.3
    && !index.pointHits(p[0], p[1], p[2], k => (k === K.wall || k === K.glass || k === K.rail) ? 0.35 : (k === K.hull || k === K.item || k === K.fixture || k === K.surface || k === K.monitor || k === K.chair || k === K.stair) ? 0.2 : false).length;
  let back = 0.6, start: V3 = end;
  for (let d = 2.6; d >= 0.6; d -= 0.2) {
    const s: V3 = [end[0] + u[0] * d, Math.min(top, end[1] + 0.35 + 0.45 * d), end[2] + u[2] * d];
    let ok = true; for (let k = 0; k <= 20 && ok; k++) ok = clearAt(lerp3(s, end, k / 20));
    if (ok) { back = d; start = s; break; }
  }
  // a gentle side-step on the way in (a straight dolly reads as a zoom): 12 % of the way, toward the Core's front
  const side: V3 = [u[2], 0, -u[0]], sg = (side[0] * hero.fwd[0] + side[2] * hero.fwd[1]) > 0 ? 1 : -1;
  const mid: V3 = [(start[0] + end[0]) / 2 + side[0] * sg * back * 0.12, (start[1] + end[1]) / 2 + 0.05, (start[2] + end[2]) / 2 + side[2] * sg * back * 0.12];
  let move = clearAt(mid) ? fillet([start, mid, end], 3) : [start, end], arcUsed = false;
  // where the room lets it, the move is an arc round the Core (30–60° of it, the Core in sight all the way, ending on the ring's
  // viewpoint): the view sweeps round instead of creeping in, which a short dolly in a tight room cannot help
  {
    const azEnd = ring.length ? ring[0].az : 0, rEnd = ring.length ? ring[0].r : Math.hypot(end[0] - centre[0], end[2] - centre[2]), f = hero.fwd, sd: [number, number] = [f[1], -f[0]];
    const at = (az: number, r: number, y: number): V3 => [centre[0] + r * (Math.cos(az * DEG) * f[0] + Math.sin(az * DEG) * sd[0]), y, centre[2] + r * (Math.cos(az * DEG) * f[1] + Math.sin(az * DEG) * sd[1])];
    search: for (const A of [60, 45, 30]) for (const sg of (azEnd >= 0 ? [-1, 1] : [1, -1])) {
      const pts: V3[] = [];
      for (let k = 0; k <= 24; k++) { const u = k / 24, r = rEnd + 0.25 * (1 - u), y = Math.min(top, end[1] + 0.2 * (1 - u)); pts.push(at(azEnd + sg * A * (1 - u), r, y)); }
      if (pts.every(q => clearAt(q) && op.free(q[0], q[1], q[2]) && probe.coreSeen(q, core) >= 0.95)) { move = pts; arcUsed = true; break search; }
    }
  }
  // the power beat: a push of 3 % of the eye–Core distance
  const toC = sub(centre, end), dEnd = len(toC), finalEye: V3 = [end[0] + toC[0] * 0.03, end[1] + toC[1] * 0.03, end[2] + toC[2] * 0.03];
  const Lmove = polyLen(move), split = Lmove * 0.7;
  const dz = densify([{ beat: 'reveal', pts: move }]);
  const duration = opts.duration || 8, N = Math.round(duration * FPS) + 1, dt = duration / (N - 1);
  const tMove = duration - 1.8;
  const pos = new Float32Array(3 * N), beatOf = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    let p: V3, b: Beat;
    if (t <= tMove) { const s = trapezoid(t, tMove) * dz.total; p = dz.at(s).p; b = s < split ? 'reveal' : 'hero'; }
    else { const w = (t - tMove) / (duration - tMove); p = lerp3(end, finalEye, w); b = 'power'; }
    pos[3 * i] = p[0]; pos[3 * i + 1] = p[1]; pos[3 * i + 2] = p[2]; beatOf[i] = BEATS.indexOf(b);
  }
  const fovEnd = ring.length ? ring[0].fov : fovForCore(end, centre, core);
  const compose = { ndcX: ring.length ? ring[0].ndc[0] : 1 / 3, ndcY: ring.length ? ring[0].ndc[1] : -0.25 };
  const track = finishTrack('hero-reveal', world, probe, duration, pos, beatOf, i => arcUsed ? centre : ([centre[0] + side[0] * sg * 1.4 * (1 - trapezoid(i * dt, tMove)), centre[1], centre[2] + side[2] * sg * 1.4 * (1 - trapezoid(i * dt, tMove))] as V3), t => 50 + (fovEnd - 50) * smooth(t / (tMove * 0.9)), compose, t => smooth(t / (tMove * 0.8)),
    { ring: ring.length ? { az: ring[0].az, r: ring[0].r, h: ring[0].h, fov: +ring[0].fov.toFixed(1), heightPct: +ring[0].heightPct.toFixed(3), score: +ring[0].score.toFixed(3) } : null, back: +back.toFixed(2), dEnd: +dEnd.toFixed(2), notes: ring.length ? [] : ['no ring viewpoint: a push-in on the Core\'s front'] });
  return { ok: true as const, track };
}

// ---- walkthrough ---------------------------------------------------------------------------------------------------
/** A tour: the film starts just inside the front door and is door-to-core's own walk from there — the route choice (scenic: it goes
 *  out of its way, up to 16 m, to the rooms worth a look), the speed caps, the stairs, the look solver, the finale round the Core.
 *  `via` (rooms, in order) is honoured when a spec names them. */
export function planWalkthrough(world: ShotWorld, opts: { duration?: number | 'auto'; via?: string[]; heroView?: any } = {}) {
  if (!world.entry || !world.hero) return { ok: false as const, code: 'route-failed', message: 'no entry or Core' };
  const r = planDoorToCore(world, { duration: opts.duration ?? 'auto', via: opts.via, route: 'scenic', heroView: opts.heroView, inside: true });
  if (!r.ok) return r;
  return { ok: true as const, track: r.track };
}
