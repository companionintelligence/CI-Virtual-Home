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
import { K, DEG, clamp, inRect, inFootprint, mulberry32, fnv1a, wrapPi, createWorldIndex, type ShotWorld, type WLevel, type WRoom } from './shot-world.js';
import { createNav, roomInterest } from './shot-nav.js';
import { createProbe, camera, project, type V3 } from './shot-probe.js';
import { createOrbitProbeW, heroRing, fovForCore } from './framing.js';
import { BEATS, FPS, YAW_CAP, hann, rateLimit, fillet, polyLen, sampleTrack, type Track, type Beat } from './shot-planner.js';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
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
  for (let i = 0; i < N; i++) { const b = BEATS[beatOf[i]]; capY[i] = YAW_CAP[b] * DEG * 0.9 * dt; capP[i] = (YAW_CAP[b] * 0.7 + 4) * DEG * dt; }
  const yl = hann(rateLimit(yaw, capY), Math.round(0.125 * FPS)), pl = hann(rateLimit(pitch, capP), Math.round(0.125 * FPS)), dl = hann(dist, Math.round(0.25 * FPS));
  const look = new Float32Array(3 * N), fov = new Float32Array(N), roofAlpha = new Float32Array(N), composeW = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c = Math.cos(pl[i]);
    look[3 * i] = pos[3 * i] + Math.sin(yl[i]) * c * dl[i]; look[3 * i + 1] = pos[3 * i + 1] + Math.sin(pl[i]) * dl[i]; look[3 * i + 2] = pos[3 * i + 2] + Math.cos(yl[i]) * c * dl[i];
    fov[i] = fovAt(i * dt); composeW[i] = composeAt(i * dt); roofAlpha[i] = 0;
  }
  const beats: Track['beats'] = [];
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && beatOf[j + 1] === beatOf[i]) j++; beats.push({ name: BEATS[beatOf[i]], t0: +(i * dt).toFixed(4), t1: +((j + 1 < N ? j + 1 : j) * dt).toFixed(4), subject: null }); i = j + 1; }
  const track: Track = { version: 2, planner: 'v2', type, id: world.id, duration, fps: FPS, samples: N, dt, pos, look, fov, roofAlpha, composeW, compose, beat: beatOf, beats, events: { enterT: null, stairT: [], pressT: null, settleT: null, doneT: duration, firstCoreT: null }, doors: {}, metrics: {}, plan, desired };
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
  const move = clearAt(mid) ? fillet([start, mid, end], 3) : [start, end];
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
    if (t <= tMove) { const s = minJerk(t / tMove) * dz.total; p = dz.at(s).p; b = s < split ? 'reveal' : 'hero'; }
    else { const w = (t - tMove) / (duration - tMove); p = lerp3(end, finalEye, w); b = 'power'; }
    pos[3 * i] = p[0]; pos[3 * i + 1] = p[1]; pos[3 * i + 2] = p[2]; beatOf[i] = BEATS.indexOf(b);
  }
  const fovEnd = ring.length ? ring[0].fov : fovForCore(end, centre, core);
  const compose = { ndcX: ring.length ? ring[0].ndc[0] : 1 / 3, ndcY: ring.length ? ring[0].ndc[1] : -0.25 };
  const track = finishTrack('hero-reveal', world, probe, duration, pos, beatOf, () => centre, t => 50 + (fovEnd - 50) * smooth(t / (tMove * 0.9)), compose, t => smooth(t / (tMove * 0.8)),
    { ring: ring.length ? { az: ring[0].az, r: ring[0].r, h: ring[0].h, fov: +ring[0].fov.toFixed(1), heightPct: +ring[0].heightPct.toFixed(3), score: +ring[0].score.toFixed(3) } : null, back: +back.toFixed(2), dEnd: +dEnd.toFixed(2), notes: ring.length ? [] : ['no ring viewpoint: a push-in on the Core\'s front'] });
  return { ok: true as const, track };
}

// ---- walkthrough ---------------------------------------------------------------------------------------------------
export function planWalkthrough(world: ShotWorld, opts: { duration?: number | 'auto' } = {}) {
  if (!world.entry || !world.hero) return { ok: false as const, code: 'route-failed', message: 'no entry or Core' };
  const index = createWorldIndex(world), probe = createProbe(index), nav = createNav(world, index);
  const e = world.entry, lv = nav.levelOf(e.level), hero = world.hero;
  const eyeY = lv.y + Math.min(1.5, lv.h - 0.35);
  const core = hero.core, centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
  const start: [number, number] = [e.x - e.out[0] * 0.8, e.z - e.out[1] * 0.8];
  // the rooms worth a look on the entry storey, nearest first from the door, the Core's room last
  const coreRoom = hero.level === lv.id ? nav.roomAt(lv.id, hero.x, hero.z) : null;
  const rooms = lv.rooms.filter(r => r.b && r !== coreRoom && roomInterest(r, world).interest >= 0.3 && r.b.w * r.b.d >= 4);
  const stops: Array<{ p: [number, number]; room: WRoom }> = [];
  for (const r of rooms) { const v = nav.visitPoint(lv.id, r); if (v) stops.push({ p: v, room: r }); }
  const order: typeof stops = []; let cur = start; const left = stops.slice();
  while (left.length && order.length < 5) { left.sort((a, b) => Math.hypot(a.p[0] - cur[0], a.p[1] - cur[1]) - Math.hypot(b.p[0] - cur[0], b.p[1] - cur[1]) || a.room.no.localeCompare(b.room.no)); const n = left.shift()!; order.push(n); cur = n.p; }
  const g = nav.grid(lv);
  const pts: Array<[number, number]> = [start]; const visited: string[] = [];
  let at = start;
  for (const s of order) { const r = nav.leg(g, at, s.p, { snap: 0.8 }); if (!r) continue; pts.push(...r.pts.slice(1)); at = s.p; visited.push(s.room.name); }
  // the end: the Core's ring on this storey, or the last room
  let endPose: V3 | null = null;
  if (coreRoom) {
    const op = createOrbitProbeW(world, index, probe, lv), ring = heroRing(world, probe, op);
    if (ring.length) { const q = ring[0].eye, back: [number, number] = [q[0] + (q[0] - centre[0]) * 0.9, q[2] + (q[2] - centre[2]) * 0.9]; const r = nav.leg(g, at, back, { snap: 1 }); if (r) { pts.push(...r.pts.slice(1)); endPose = q; visited.push(coreRoom.name); } }
  }
  if (pts.length < 2) return { ok: false as const, code: 'route-failed', message: 'no room to walk to on the entry storey' };
  const walk = fillet(pts.map(q => [q[0], eyeY, q[1]] as V3), 1.2, p => nav.clearance(g, p[0], p[2]) >= 0.22);
  const segs: Array<{ beat: Beat; pts: V3[] }> = [{ beat: 'route', pts: walk }];
  if (endPose) segs.push({ beat: 'hero', pts: [walk[walk.length - 1], endPose] });
  const dz = densify(segs);
  // speed: a tour's pace — 1.3 m/s along the rooms, 1.0 through a doorway, slower round corners, easing in and out
  const NP = dz.X.length, cap = new Float64Array(NP);
  const doors = nav.doorsOn(lv.id);
  for (let i = 0; i < NP; i++) {
    let c = BEATS[dz.B[i]] === 'hero' ? 0.5 : 1.3;
    for (const d of doors) { const a = (dz.X[i] - d.c[0]) * d.n[0] + (dz.Z[i] - d.c[1]) * d.n[1], lat = Math.abs((dz.X[i] - d.c[0]) * d.n[1] - (dz.Z[i] - d.c[1]) * d.n[0]); if (Math.abs(a) < 0.6 && lat < d.w / 2 + 0.3) c = Math.min(c, 1.0); }
    const j0 = Math.max(0, i - 10), j1 = Math.min(NP - 1, i + 10), ax = dz.X[i] - dz.X[j0], az = dz.Z[i] - dz.Z[j0], bx = dz.X[j1] - dz.X[i], bz = dz.Z[j1] - dz.Z[i];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la > 0.05 && lb > 0.05) { const k = Math.abs(wrapPi(Math.atan2(bx, bz) - Math.atan2(ax, az))) / ((la + lb) / 2); if (k > 1e-3) c = Math.min(c, Math.sqrt(1.0 / k)); }
    cap[i] = c;
  }
  const v = new Float64Array(NP); v[0] = 0.3;
  for (let i = 1; i < NP; i++) v[i] = Math.min(cap[i], Math.sqrt(v[i - 1] ** 2 + 2 * 1.0 * (dz.S[i] - dz.S[i - 1])));
  v[NP - 1] = Math.min(v[NP - 1], 0.05);
  for (let i = NP - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * 1.0 * (dz.S[i + 1] - dz.S[i])));
  const T = new Float64Array(NP); for (let i = 1; i < NP; i++) T[i] = T[i - 1] + 2 * (dz.S[i] - dz.S[i - 1]) / Math.max(1e-3, v[i] + v[i - 1]);
  const tail = endPose ? 1.8 : 0;
  const duration = typeof opts.duration === 'number' ? opts.duration : Math.ceil(clamp(T[NP - 1] + tail, 10, 20) * 2) / 2;
  const scale = (duration - tail) / T[NP - 1];
  const N = Math.round(duration * FPS) + 1, dt = duration / (N - 1);
  const pos = new Float32Array(3 * N), beatOf = new Uint8Array(N);
  const finalEye: V3 = endPose ? lerp3(endPose, centre, 0.03) : [dz.X[NP - 1], dz.Y[NP - 1], dz.Z[NP - 1]];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    let p: V3, b: number;
    if (t <= duration - tail) { const tt = t / scale; while (j < NP - 2 && T[j + 1] < tt) j++; const f = T[j + 1] > T[j] ? clamp((tt - T[j]) / (T[j + 1] - T[j]), 0, 1) : 0; const q = dz.at(dz.S[j] + (dz.S[j + 1] - dz.S[j]) * f); p = q.p; b = q.b; }
    else { const w = (t - duration + tail) / tail; p = lerp3([dz.X[NP - 1], dz.Y[NP - 1], dz.Z[NP - 1]], finalEye, w); b = BEATS.indexOf('power'); }
    pos[3 * i] = p[0]; pos[3 * i + 1] = p[1]; pos[3 * i + 2] = p[2]; beatOf[i] = b;
  }
  // look: 2 m ahead along the walk, drawn toward the next stop's room while it is in front; the Core at the end
  const S2 = new Float64Array(N); for (let i = 1; i < N; i++) S2[i] = S2[i - 1] + Math.hypot(pos[3 * i] - pos[3 * i - 3], pos[3 * i + 2] - pos[3 * i - 1]);
  const stopsAt = order.filter(s => visited.includes(s.room.name));
  const want = (i: number): V3 => {
    const b = BEATS[beatOf[i]]; if (b === 'hero' || b === 'power') return centre;
    const e: V3 = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
    let k = i; while (k < N - 1 && S2[k] - S2[i] < 2) k++;
    const ahead: V3 = [pos[3 * k], pos[3 * k + 1] - 0.15, pos[3 * k + 2]];
    if (len(sub(ahead, e)) < 0.4) return [e[0] + 1, e[1] - 0.15, e[2]];
    const next = stopsAt.find(s => Math.hypot(s.p[0] - e[0], s.p[1] - e[2]) > 1.2 && inRect(s.p[0], s.p[1], s.room.b));
    if (!next) return ahead;
    const f = roomInterest(next.room, world).focal, sp: V3 = f ? [f.at[0], lv.y + 1.0, f.at[1]] : [next.p[0], lv.y + 1.1, next.p[1]];
    const da = sub(ahead, e), ds = sub(sp, e), c = (da[0] * ds[0] + da[2] * ds[2]) / ((Math.hypot(da[0], da[2]) * Math.hypot(ds[0], ds[2])) || 1);
    const w = 0.4 * clamp((c - Math.cos(80 * DEG)) / (Math.cos(30 * DEG) - Math.cos(80 * DEG)), 0, 1) * (probe.visibility(e, sp, 0.2) >= 0.6 ? 1 : 0);
    const dir = (a: V3) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] as V3; };
    const d1 = dir(da), d2 = dir(ds);
    return [e[0] + (d1[0] * (1 - w) + d2[0] * w) * 3, e[1] + (d1[1] * (1 - w) + d2[1] * w) * 3, e[2] + (d1[2] * (1 - w) + d2[2] * w) * 3];
  };
  const fovEnd = endPose ? fovForCore(endPose, centre, core) : 52;
  const tHero = endPose ? duration - tail - Math.max(1.2, 0) : duration;
  const track = finishTrack('walkthrough', world, probe, duration, pos, beatOf, want, t => t < tHero - 3 ? 54 : 54 + (fovEnd - 54) * smooth((t - tHero + 3) / 3.5), endPose ? { ndcX: 1 / 3, ndcY: -0.25 } : null, t => endPose ? smooth((t - tHero + 1.2) / 2.2) : 0,
    { rooms: visited, notes: [] });
  return { ok: true as const, track };
}
