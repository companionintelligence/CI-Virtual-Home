// The fleet's camera metrics (plan §3.14 "Fleet checks", the S5 acceptance): what the 30 films have in common, from their
// QA v2 metrics — outside share, travel and speed at the door, yaw, look error, the press, the rooms seen, the Core's
// height and place in the last frame, the establishing styles and bearings, what stands behind the Core, the orbit.
// THREE-free, so scripts/test-shot-planner.mts (the gate), scripts/camera-audit.mts (the report) and
// scripts/fleet/shots.mts (fleet-audit) all read the same numbers.
//
// Owner: S5 (shot).

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
