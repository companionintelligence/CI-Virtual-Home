// Fleet metrics — owned by S3 (compose): how often the same furniture turns up. See _types.mts.
//
//   furniture-repetition   S0's metric, unchanged in what it measures (the top 12 types by houses, and their items):
//                          the hand-authored fleet, or — when a house has composed rooms — its built rooms too
//                          (`fleet-audit --built` reads them from plan.compose, assets/plan-export/compose.ts)
//   composed-repetition    the same, for the dry run: every room of the 30 composed from its name, authored items
//                          dropped — the plan's acceptance ("down ≥ 50 % against the hand-authored baseline")
//   sofa-variety, …        how many real alternatives the fleet reaches for, per role (sofas, sectionals, armchairs,
//                          dining tables and chairs, plants): the owner's "loveseat is the only sofa in all 30"
import type { Metric } from './_types.mts';
import { M, dryRun, authoredFleet, composedFleet, tally, top12, HERO_SET, FUNCTIONAL } from './_compose-dry.mts';

const builtItems = (h: { plan: any }) => ((h.plan && h.plan.compose && h.plan.compose.rooms) || []).flatMap((r: any) => r.items || []);
const needsBuild = { value: 'needs `pnpm run build` (the composer is in assets/)', pass: null as boolean | null };
// the dry run is one composition of the fleet (about 4 s in Node): memoised on the fleet object
const dryCache = new WeakMap<object, ReturnType<typeof dryRun>>();
const dry = (f: { houses: Array<{ id: string; spec: any }> }) => { let d = dryCache.get(f); if (!d) { d = dryRun(f.houses); dryCache.set(f, d); } return d; };

const furniture = (t: string) => !HERO_SET.has(t) && !FUNCTIONAL.has((M.PLACEMENT[t] || {}).group);
// roles the fleet check named: a house "reaches for" a type when one of its rooms uses it
const ROLE_GROUPS: Array<[string, string[]]> = [
  ['sofas', ['sofa', 'loveseat']], ['sectionals', ['sofa-l']], ['armchairs', ['armchair']],
  ['dining tables', ['dining-table', 'dining-table-round']], ['dining chairs', ['dining-chair']], ['floor plants', ['plant-floor']],
];
const rolesOf = (t: string) => (M.PLACEMENT[t] || { roles: [] }).roles as string[];

export const metrics: Metric[] = [
  {
    id: 'furniture-repetition', title: 'Furniture repetition (top 12 types)', stream: 'S3',
    target: 'top-12 repetition down ≥ 50 % against the hand-authored baseline (this table, at S0)',
    compute(f) {
      const houses = new Map<string, Set<string>>(), count = new Map<string, number>();
      let items = 0;
      for (const h of f.houses) {
        const all = [...(h.spec.levels || []).flatMap((lv: any) => (lv.rooms || []).flatMap((r: any) => r.items || [])), ...builtItems(h)];
        for (const it of all) {
          if (HERO_SET.has(it.type)) continue;
          items++;
          count.set(it.type, (count.get(it.type) || 0) + 1);
          houses.set(it.type, (houses.get(it.type) || new Set()).add(h.id));
        }
      }
      const rows = [...houses.entries()].map(([t, s]) => [t, s.size, count.get(t)] as [string, number, number]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
      const top = rows.slice(0, 12), inTwenty = rows.filter(r => r[1] >= 20).length;
      const top12Items = top.reduce((a, r) => a + r[2], 0);
      const built = f.houses.reduce((a, h) => a + builtItems(h).length, 0);
      return {
        value: `${inTwenty} types in 20 or more houses; the top 12 are ${top12Items} of ${items} items`, measure: top12Items, pass: null,
        detail: `${rows.length} item types in use over ${items} room items (the hero desk set left out), ${built} of them composed at build time (plan.compose; none in the 30 real specs, which carry no program). Measured against the baseline (test/fleet/baseline.json, the hand-authored fleet at S0). The dry run — every room composed — is the next metric.`,
        table: { head: ['type', 'houses', 'items'], rows: top },
      };
    },
  },
  {
    id: 'composed-repetition', title: 'Furniture repetition if every room were composed', stream: 'S3',
    target: 'furniture top-12 house-uses down ≥ 50 % against the hand-authored fleet',
    compute(f) {
      if (!M) return needsBuild;
      const d = dry(f), houses = f.houses.filter(h => d.some(x => x.id === h.id));
      const a = top12(tally(authoredFleet(houses), furniture)), c = top12(tally(composedFleet(d), furniture));
      const drop = 1 - c.houses / Math.max(1, a.houses);
      const allA = top12(tally(authoredFleet(houses))), allC = top12(tally(composedFleet(d)));
      return {
        value: `${(drop * 100).toFixed(0)} % down (${a.houses} → ${c.houses} house-uses of the top 12 furniture types)`, measure: c.houses, pass: drop >= 0.5,
        detail: `Furniture is what a room is furnished with (fitted units, appliances, bath fittings, lamps, ceiling fixtures and the Core's desk set left out: a house needs a toilet and a range whatever the composer does). House-uses: over the 12 most repeated types, the houses using each. Authored: ${a.rows.map(r => `${r.type} ${r.houses}`).join(', ')}. Composed: ${c.rows.map(r => `${r.type} ${r.houses}`).join(', ')}. Every type, as the S0 metric counts them: the top 12 hold ${allA.items} authored items and ${allC.items} composed ones.`,
        table: { head: ['type (composed)', 'houses', 'items'], rows: c.rows.map(r => [r.type, r.houses, r.items]) },
      };
    },
  },
  {
    id: 'furniture-variety', title: 'Real alternatives per role (sofas, sectionals, armchairs, dining, plants)', stream: 'S3',
    target: 'no type in more than half the houses within a role; at least 5 sofas, 3 sectionals, 5 armchairs, 4 dining tables, 4 dining chairs and 6 floor plants in use',
    compute(f) {
      if (!M) return needsBuild;
      const d = dry(f), aut = authoredFleet(f.houses.filter(h => d.some(x => x.id === h.id))), cmp = composedFleet(d);
      const need: Record<string, number> = { sofas: 5, sectionals: 3, armchairs: 5, 'dining tables': 4, 'dining chairs': 4, 'floor plants': 6 };
      const rows: Array<Array<string | number>> = [];
      let pass = true;
      for (const [label, roles] of ROLE_GROUPS) {
        const inRole = (t: string) => rolesOf(t).some(r => roles.includes(r));
        const A = tally(aut, inRole), C = tally(cmp, inRole), share = C.length ? C[0].houses / Math.max(1, cmp.length) : 0;
        const ok = C.length >= need[label] && share <= 0.5;
        if (!ok) pass = false;
        rows.push([label, `${A.length} (${A.slice(0, 2).map(r => `${r.type} ${r.houses}`).join(', ')})`, `${C.length} (${C.slice(0, 3).map(r => `${r.type} ${r.houses}`).join(', ')})`, `${(share * 100).toFixed(0)} %`, ok ? 'ok' : 'FAIL']);
      }
      return {
        value: rows.map(r => `${r[0]} ${String(r[1]).split(' ')[0]} → ${String(r[2]).split(' ')[0]}`).join(' · '), pass,
        detail: 'Types in use across the 30 houses, per composer role: the hand-authored fleet, then the dry run (every room composed from its name). The share is the most-used type\'s houses over the 30.',
        table: { head: ['role', 'authored types (top)', 'composed types (top)', 'top share', ''], rows },
      };
    },
  },
];
