// The fleet's camera metrics (plan §3.14 "Fleet checks", the S5 acceptance): what the 30 films have in common, from their
// QA v2 metrics — outside share, travel and speed at the door, yaw, look error, the press, the rooms seen, the Core's
// height and place in the last frame, the establishing styles and bearings, what stands behind the Core, the orbit.
// THREE-free, so scripts/test-shot-planner.mts (the gate), scripts/camera-audit.mts (the report) and
// scripts/fleet/shots.mts (fleet-audit) all read the same numbers.
//
// Owner: S5 (shot).
import { K, DEG, clamp, inFootprint, indoors, wrapPi, createWorldIndex, type ShotWorld } from './shot-world.js';
import { createNav } from './shot-nav.js';
import { camera, project, projectBox, type V3 } from './shot-probe.js';

export type FleetRow = { id: string; duration: number; metrics: Record<string, any>; plan: Record<string, any>; errors: number; warnings: number };
export type FleetCheck = { id: string; title: string; target: string; value: string; pass: boolean; advisory?: boolean; detail?: string; rows?: Array<Array<string | number>> };

const med = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (n: number, of: number) => `${n} of ${of}`;

/** every fleet check over a set of houses' rows; `pass` is the acceptance's verdict on it */
export function fleetChecks(rows: FleetRow[]): FleetCheck[] {
  const N = rows.length, out: FleetCheck[] = [];
  const M = (r: FleetRow, k: string) => r.metrics[k];
  const list = (bad: FleetRow[], f: (r: FleetRow) => string) => bad.map(r => `${r.id} ${f(r)}`).join('; ');
  const add = (c: FleetCheck) => out.push(c);

  { const bad = rows.filter(r => { const ext = (r.plan.outside && r.plan.outside.hasExt) || false; return !(M(r, 'outsideShare') <= (ext ? 0.35 : 0.30) + 1e-9); });
    add({ id: 'outside-share', title: 'Outside share', target: '≤ 30 % (≤ 35 % with an exterior-stair entry)', value: `median ${(med(rows.map(r => M(r, 'outsideShare'))) * 100).toFixed(0)} %, ${pct(N - bad.length, N)} in target`, pass: !bad.length, detail: list(bad, r => `${(M(r, 'outsideShare') * 100).toFixed(0)} %`) }); }
  { const bad = rows.filter(r => !(M(r, 'firstSecond') >= 0.5));
    add({ id: 'first-second', title: 'Travel in the first second', target: '≥ 0.5 m', value: `min ${Math.min(...rows.map(r => M(r, 'firstSecond'))).toFixed(2)} m`, pass: !bad.length, detail: list(bad, r => `${M(r, 'firstSecond')} m`) }); }
  { const bad = rows.filter(r => !(M(r, 'doorSpeed') <= 0.9 + 1e-9));
    add({ id: 'door-speed', title: 'Speed across the entry door', target: '≤ 0.9 m/s', value: `max ${Math.max(...rows.map(r => M(r, 'doorSpeed') ?? 0)).toFixed(2)} m/s`, pass: !bad.length, detail: list(bad, r => `${M(r, 'doorSpeed')} m/s`) }); }
  { const bad = rows.filter(r => !(M(r, 'maxYawRate') <= 60 + 1e-9));
    add({ id: 'yaw', title: 'Smoothed view rate (0.2 s)', target: '≤ 60°/s', value: `max ${Math.max(...rows.map(r => M(r, 'maxYawRate'))).toFixed(0)}°/s, median ${med(rows.map(r => M(r, 'maxYawRate'))).toFixed(0)}`, pass: !bad.length, detail: list(bad, r => `${M(r, 'maxYawRate')}°/s`) }); }
  { const bad = rows.filter(r => !(M(r, 'lookErrorMedian') <= 10));
    add({ id: 'look-error', title: 'Look error against the beat subject (median)', target: '≤ 10°', value: `worst house ${Math.max(...rows.map(r => M(r, 'lookErrorMedian'))).toFixed(1)}°, median ${med(rows.map(r => M(r, 'lookErrorMedian'))).toFixed(1)}°`, pass: !bad.length, detail: list(bad, r => `${M(r, 'lookErrorMedian')}°`) }); }
  { const bad = rows.filter(r => !(M(r, 'coreLOS') >= 1.5 && M(r, 'pressSpeed') <= 0.3));
    add({ id: 'press', title: 'The press', target: '≥ 1.5 s of the Core in sight before it, the camera ≤ 0.3 m/s', value: `${pct(N - bad.length, N)}; min LOS ${Math.min(...rows.map(r => M(r, 'coreLOS'))).toFixed(1)} s, max speed ${Math.max(...rows.map(r => M(r, 'pressSpeed'))).toFixed(2)} m/s`, pass: !bad.length, detail: list(bad, r => `LOS ${M(r, 'coreLOS')} s, ${M(r, 'pressSpeed')} m/s`) }); }
  { const ok = rows.filter(r => M(r, 'topRoomsSeen') >= 2);
    add({ id: 'top-rooms', title: 'Top-3 rooms seen for ≥ 1 s (at least 2)', target: 'in ≥ 25 of 30 houses', value: pct(ok.length, N), pass: ok.length >= Math.round(25 * N / 30), detail: list(rows.filter(r => M(r, 'topRoomsSeen') < 2), r => `${M(r, 'topRoomsSeen')}`) }); }
  { const ok = rows.filter(r => M(r, 'finalCoreHeight') >= 0.18 - 1e-9 && M(r, 'finalCoreHeight') <= 0.25 + 1e-9);
    add({ id: 'core-height', title: "The Core's height in the last frame", target: '18–25 % of the frame, in ≥ 27 of 30 houses', value: `${pct(ok.length, N)}; median ${(med(rows.map(r => M(r, 'finalCoreHeight'))) * 100).toFixed(0)} %`, pass: ok.length >= Math.round(27 * N / 30), detail: list(rows.filter(r => !ok.includes(r)), r => `${(M(r, 'finalCoreHeight') * 100).toFixed(0)} %`) }); }
  { const q = (v: number) => Math.round(v / 0.05), keys = new Set(rows.map(r => { const n = M(r, 'finalCoreNDC') || [0, 0]; return `${q(n[0])},${q(n[1])}`; }));
    add({ id: 'final-positions', title: "Distinct places the Core ends in the frame (0.05 of the frame)", target: '≥ 20 across the 30 houses', value: `${keys.size} of ${N}`, pass: keys.size >= Math.round(20 * N / 30) }); }
  { const count = new Map<string, number>(); for (const r of rows) { const st = (r.plan.establish && r.plan.establish.style) || '?'; count.set(st, (count.get(st) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
    add({ id: 'establish-style', title: 'Establishing styles', target: 'no style on more than 25 % of houses', value: top.map(([s, n]) => `${s} ${n}`).join(', '), pass: top[0][1] <= Math.floor(0.25 * N), rows: top.map(([s, n]) => [s, n]) }); }
  { const count = new Map<number, number>(); for (const r of rows) { const b = Math.floor(((r.metrics.establish && r.metrics.establish.bearing) ?? 0) / 15); count.set(b, (count.get(b) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
    add({ id: 'establish-bearing', advisory: true, title: 'Establishing bearings (15° buckets off the door axis)', target: 'no bucket on more than 25 % of houses', value: top.slice(0, 5).map(([b, n]) => `${b * 15}…${b * 15 + 15}° ${n}`).join(', '), pass: top[0][1] <= Math.floor(0.25 * N) }); }
  { const count = new Map<string, number>(); for (const r of rows) { const c = M(r, 'coreBg') || '?'; count.set(c, (count.get(c) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
    add({ id: 'finale-background', advisory: true, title: 'What stands behind the Core in the last frame', target: 'no class above 40 % of the houses', value: top.map(([s, n]) => `${s} ${n}`).join(', '), pass: top.every(([s, n]) => s === 'wall' || s === 'other' || n <= 0.4 * N) || top[0][1] <= 0.4 * N, rows: top.map(([s, n]) => [s, n]) }); }
  { const short = rows.filter(r => r.plan.orbit && r.plan.orbit.arc < 60), arcs = rows.map(r => (r.plan.orbit ? r.plan.orbit.arc : 0)), reach = rows.filter(r => r.plan.orbit && (r.plan.orbit.reachable ?? 0) >= 90);
    const ok = reach.filter(r => r.plan.orbit.arc >= 90);
    add({ id: 'orbit-arc', title: 'The finale orbit (degrees round the Core)', target: '≥ 90° wherever the room allows it; none under 60° where it allows more', value: `${pct(ok.length, reach.length)} of the houses that can reach 90° do; median ${med(arcs)}°; under 60°: ${short.length}`, pass: ok.length >= Math.ceil(0.85 * reach.length), detail: list(rows.filter(r => r.plan.orbit && r.plan.orbit.arc < 90), r => `${r.plan.orbit.arc}° (room ${r.plan.orbit.reachable}°)`) }); }
  { const bad = rows.filter(r => r.errors > 0);
    add({ id: 'qa-errors', title: 'QA v2 errors', target: '0 on all 30 houses', value: `${rows.reduce((a, r) => a + r.errors, 0)} in ${pct(bad.length, N)} houses`, pass: !bad.length, detail: list(bad, r => `${r.errors}`) }); }
  return out;
}

/** The same numbers off ANY baked track — planner v1's (assets/shot-track.ts trackFromV1) as much as v2's — measured one way, so the
 *  camera audit can put the two side by side: how much of the film is outside, how far it moves in the first second, how fast it
 *  crosses the entry door and the doorways, how fast the view turns (smoothed over 0.2 s, and the raw 1/12 s step v1's pan was
 *  judged by), dead air, how far the look lags the walk, the finale's orbit round the Core (the longest one-way sweep ending at the
 *  last frame) and the Core's height in the last frame. Reads only pos, look, fov (optional), samples, dt. */
export function trackMetrics(track: { pos: ArrayLike<number>; look: ArrayLike<number>; fov?: ArrayLike<number>; samples: number; dt: number }, world: ShotWorld, aspect = 16 / 9, finalTarget?: V3) {
  const N = track.samples, dt = track.dt, T = (N - 1) * dt;
  const eye = (i: number): V3 => [track.pos[3 * i], track.pos[3 * i + 1], track.pos[3 * i + 2]], look = (i: number): V3 => [track.look[3 * i], track.look[3 * i + 1], track.look[3 * i + 2]];
  const yaw = new Float64Array(N), pitch = new Float64Array(N), speed = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const e = eye(i), l = look(i), d = [l[0] - e[0], l[1] - e[1], l[2] - e[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
    yaw[i] = Math.atan2(d[0], d[2]); pitch[i] = Math.asin(clamp(d[1] / L, -1, 1)); if (i) yaw[i] = yaw[i - 1] + wrapPi(yaw[i] - yaw[i - 1]);
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), ea = eye(a), eb = eye(b);
    speed[i] = Math.hypot(eb[0] - ea[0], eb[1] - ea[1], eb[2] - ea[2]) / ((b - a) * dt);
  }
  const rate = (i: number, half: number) => { const a = Math.max(0, i - half), b = Math.min(N - 1, i + half); return Math.hypot((yaw[b] - yaw[a]) * Math.cos(pitch[i]), pitch[b] - pitch[a]) / ((b - a) * dt) / DEG; };
  const h02 = Math.max(1, Math.round(0.1 / dt)), h12 = Math.max(1, Math.round(1 / 24 / dt));
  let yawPeak = 0, yawPeakRaw = 0; const sm: number[] = [];
  for (let i = 0; i < N; i++) { const r = rate(i, h02); sm.push(r); yawPeak = Math.max(yawPeak, r); yawPeakRaw = Math.max(yawPeakRaw, rate(i, h12)); }
  let whips = 0; { let run = false; for (const r of sm) { if (r > 90) { if (!run) whips++; run = true; } else if (r < 60) run = false; } }
  const travel = (i0: number, i1: number) => { let L = 0; for (let i = i0 + 1; i <= i1; i++) { const a = eye(i - 1), b = eye(i); L += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); } return L; };
  const n1 = Math.min(N - 1, Math.round(1 / dt));
  let out = 0; for (let i = 0; i < N; i++) { const e = eye(i); if (!indoors(world, e[0], e[1], e[2])) out++; }
  // the entry door plane, and the interior doorways
  let doorSpeed: number | null = null; const en = world.entry;
  if (en) for (let i = 1; i < N && doorSpeed === null; i++) {
    const p = eye(i), q = eye(i - 1), a0 = (q[0] - en.x) * en.out[0] + (q[2] - en.z) * en.out[1], a1 = (p[0] - en.x) * en.out[0] + (p[2] - en.z) * en.out[1];
    if (a0 > 0 && a1 <= 0 && Math.hypot(p[0] - en.x, p[2] - en.z) < 1.5) doorSpeed = speed[i];
  }
  const index = createWorldIndex(world), nav = createNav(world, index); let doorwayMax = 0, doorways = 0;
  for (const l of world.levels) for (const d of nav.doorsOn(l.id)) for (let i = 1; i < N; i++) {
    const p = eye(i), q = eye(i - 1); if (p[1] < l.y + 0.4 || p[1] > l.y + 2.6) continue;
    const a0 = (q[0] - d.c[0]) * d.n[0] + (q[2] - d.c[1]) * d.n[1], a1 = (p[0] - d.c[0]) * d.n[0] + (p[2] - d.c[1]) * d.n[1];
    if (a0 * a1 < 0 && Math.abs((p[0] - d.c[0]) * d.n[1] - (p[2] - d.c[1]) * d.n[0]) < d.w / 2 + 0.1) { doorways++; doorwayMax = Math.max(doorwayMax, speed[i]); }
  }
  // dead air: the least the view changes in any 1 s (the turn plus what the eye's travel does to a subject 3 m away)
  // (the last 2.5 s are the press: the camera settles by design)
  let minView = Infinity, deadAir = 0; const w1 = Math.round(1 / dt), tail = Math.round(2.5 / dt);
  for (let i = 0; i + w1 < N - tail; i += 6) {
    const dir = (k: number): V3 => { const e = eye(k), l = look(k), d = [l[0] - e[0], l[1] - e[1], l[2] - e[2]], L = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / L, d[1] / L, d[2] / L]; };
    const a = dir(i), b = dir(i + w1), turn = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) / DEG, v = turn + Math.atan2(travel(i, i + w1), 3) / DEG;
    minView = Math.min(minView, v); if (v < 3) deadAir += 6 * dt;
  }
  // the look against the walk: how far off the direction of travel the view points while the eye moves
  const lag: number[] = []; let crab = 0, moving = 0;
  for (let i = 1; i < N - 1; i++) {
    if (speed[i] < 0.3) continue;
    const a = eye(i - 1), b = eye(i + 1), v = [b[0] - a[0], b[2] - a[2]], vl = Math.hypot(v[0], v[1]); if (vl < 1e-6) continue;
    const c = (v[0] * Math.sin(yaw[i]) + v[1] * Math.cos(yaw[i])) / vl, ang = Math.acos(clamp(c, -1, 1)) / DEG; lag.push(ang); moving++; if (ang > 60) crab++;
  }
  lag.sort((x, y) => x - y);
  const h = world.hero, core = h ? h.core : null, ctr: V3 | null = core ? [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2] : null;
  // the finale's orbit: from the last frame back, the azimuth round the Core keeps growing one way (turning back more than 8° ends it)
  let orbitArc = 0;
  if (ctr) {
    const az = (i: number) => { const e = eye(i); return Math.atan2(e[0] - ctr[0], e[2] - ctr[2]); };
    let acc = 0, best = 0, prev = az(N - 1), sg = 0;
    for (let i = N - 2; i >= 0; i--) {
      const a = az(i), dA = wrapPi(a - prev); prev = a;
      if (Math.hypot(eye(i)[0] - ctr[0], eye(i)[2] - ctr[2]) > 8) break;
      if (!sg && Math.abs(dA) > 1e-4) sg = Math.sign(dA);
      acc += sg * dA; best = Math.max(best, acc); if (acc < best - 8 * DEG) break;
    }
    orbitArc = best / DEG;
  }
  let coreHeight: number | null = null, coreNDC: [number, number] | null = null;
  if (core && ctr) { const fov = track.fov ? track.fov[N - 1] : 45, cam = camera(eye(N - 1), finalTarget || look(N - 1), fov, aspect), pb = projectBox(cam, core), pc = project(cam, ctr); coreHeight = pb ? (pb.maxY - pb.minY) / 2 : 0; coreNDC = [pc[0], pc[1]]; }
  return {
    duration: +T.toFixed(2), outsideShare: +(out / N).toFixed(3), firstSecond: +travel(0, n1).toFixed(2), lastSecond: +travel(N - 1 - n1, N - 1).toFixed(2),
    doorSpeed: doorSpeed === null ? null : +doorSpeed.toFixed(2), doorwayMax: +doorwayMax.toFixed(2), doorways,
    yawPeak: +yawPeak.toFixed(0), yawPeakRaw: +yawPeakRaw.toFixed(0), whips, yawMedian: +sm.slice().sort((a, b) => a - b)[sm.length >> 1].toFixed(0),
    minViewChange: Number.isFinite(minView) ? +minView.toFixed(1) : null, deadAirS: +deadAir.toFixed(1),
    lookLagMedian: lag.length ? +lag[lag.length >> 1].toFixed(0) : 0, crabPct: moving ? +(100 * crab / moving).toFixed(0) : 0,
    orbitArc: +orbitArc.toFixed(0), finalCoreHeight: coreHeight === null ? null : +coreHeight.toFixed(3), finalCoreNDC: coreNDC ? [+coreNDC[0].toFixed(3), +coreNDC[1].toFixed(3)] as [number, number] : null,
  };
}
