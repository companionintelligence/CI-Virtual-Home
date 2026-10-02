// Fleet metrics — owned by S5 (shot): what the 30 films have in common. See _types.mts.
//
// establish-share reads the specs alone (which establishing style each house asks for). Every other metric is one of the
// camera checks of plan §3.14 (assets/shot-fleet.ts fleetChecks: outside share, first-second travel, door speed, view
// rate, look error, the press, the rooms seen, the Core's height and place in the last frame, the establishing styles and
// bearings, what stands behind the Core, the finale orbit, QA errors): they need the built house, so they read
// `house.plan.shots.world` (assets/plan-export/shots.ts — the ShotWorld the planner plans on) and plan planner v2's
// door-to-core on it in Node, exactly as the page would; `fleet-audit --built` rebuilds the plans first. Without a built
// plan they say so rather than guess.
import type { Metric } from './_types.mts';
import { planDoorToCore, shotOptions } from '../../assets/shot-planner.js';
import { qaTrack } from '../../assets/shot-qa.js';
import { fleetChecks, type FleetCheck, type FleetRow } from '../../assets/shot-fleet.js';

const cache = new WeakMap<object, { checks: FleetCheck[]; planned: number; missing: number; failed: string[] } | null>();
function checksFor(f: any) {
  if (cache.has(f)) return cache.get(f)!;
  const rows: FleetRow[] = []; let missing = 0; const failed: string[] = [];
  for (const h of f.houses) {
    const world = h.plan && h.plan.shots && h.plan.shots.world;
    if (!world) { if (h.plan !== undefined && !(h.spec.fixture)) missing++; continue; }
    const so = shotOptions(h.spec, 'door-to-core', 'v2'), r = planDoorToCore(world, so.options);
    if (!r.ok) { failed.push(`${h.id}: ${(r as any).message}`); continue; }
    const qa = qaTrack(r.track, world, { via: so.shot && so.shot.via });
    rows.push({ id: h.id, duration: r.track.duration, metrics: qa.metrics, plan: r.track.plan, errors: qa.errors.length, warnings: qa.warnings.length });
  }
  const out = rows.length >= 10 ? { checks: fleetChecks(rows), planned: rows.length, missing, failed } : null;
  cache.set(f, out); return out;
}

const ids: Array<[string, string]> = [
  ['outside-share', 'Outside share of the film'], ['first-second', 'Travel in the first second'], ['door-speed', 'Speed across the entry door'], ['yaw', 'Smoothed view rate'],
  ['look-error', 'Look error against the beat subject'], ['press', 'The press'], ['top-rooms', 'Top-3 rooms seen'], ['core-height', "The Core's height in the last frame"],
  ['final-positions', 'Where the Core ends in the frame'], ['establish-style', 'Establishing styles (planned)'], ['establish-bearing', 'Establishing bearings'],
  ['finale-background', 'What stands behind the Core'], ['orbit-arc', 'The finale orbit'], ['film-length', 'Film length against its budget'], ['qa-errors', 'QA v2 errors'],
];

export const metrics: Metric[] = [
  {
    id: 'establish-share', title: 'Establishing styles', stream: 'S5', target: 'no style on more than 25 % of houses',
    compute(f) {
      // shots[].establish (planner v2); a house without one opens on v1's south-east aerial
      const style = (h: any) => ((h.spec.shots || []).find(s => s.type === 'door-to-core') || {}).establish || 'v1 aerial (default)';
      const m = new Map<string, number>();
      for (const h of f.houses) m.set(style(h), (m.get(style(h)) || 0) + 1);
      const rows = [...m.entries()].sort((a, b) => b[1] - a[1]), n = f.houses.length || 1;
      return {
        value: `${rows[0][0]} on ${rows[0][1]} of ${f.houses.length}`, measure: +(rows[0][1] / n).toFixed(4), pass: rows[0][1] / n <= 0.25,
        table: { head: ['establishing style', 'houses'], rows },
      };
    },
  },
  ...ids.map(([id, title]): Metric => ({
    id: `camera-${id}`, title: `Camera: ${title}`, stream: 'S5', target: 'plan §3.14 (assets/shot-fleet.ts)',
    compute(f) {
      const r = checksFor(f);
      if (!r) return { value: 'needs --built', pass: null, detail: 'planner v2 plans on house.plan.shots.world, which only a rebuilt plan carries (fleet-audit --built); the committed plans get it at integration.' };
      const c = r.checks.find(x => x.id === id);
      if (!c) return { value: 'not measured', pass: null };
      return { value: c.value, pass: c.advisory ? (c.pass ? true : null) : c.pass, detail: `${c.target}${c.advisory ? ' (advisory)' : ''}${c.detail ? ` — ${c.detail}` : ''}${r.failed.length ? ` — could not plan: ${r.failed.join('; ')}` : ''}`, table: c.rows ? { head: ['', 'houses'], rows: c.rows } : undefined };
    },
  })),
];
