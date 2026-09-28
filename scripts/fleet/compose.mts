// Fleet metrics — owned by S3 (compose): how often the same furniture turns up. See _types.mts.
import type { Metric } from './_types.mts';

// the hero desk set is placed by the hero block, not furnished (house-builder rooms loop skips it at hero.at)
const HERO_SET = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);

export const metrics: Metric[] = [
  {
    id: 'furniture-repetition', title: 'Furniture repetition (top 12 types)', stream: 'S3',
    target: 'top-12 repetition down ≥ 50 % against the hand-authored baseline (this table, at S0)',
    compute(f) {
      const houses = new Map<string, Set<string>>(), count = new Map<string, number>();
      let items = 0;
      for (const h of f.houses) for (const lv of h.spec.levels || []) for (const r of lv.rooms || []) for (const it of r.items || []) {
        if (HERO_SET.has(it.type)) continue;
        items++;
        count.set(it.type, (count.get(it.type) || 0) + 1);
        houses.set(it.type, (houses.get(it.type) || new Set()).add(h.id));
      }
      const rows = [...houses.entries()].map(([t, s]) => [t, s.size, count.get(t)] as [string, number, number]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
      const top = rows.slice(0, 12), inTwenty = rows.filter(r => r[1] >= 20).length;
      const top12 = top.reduce((a, r) => a + r[2], 0);
      return {
        value: `${inTwenty} types in 20 or more houses; the top 12 are ${top12} of ${items} items`, measure: top12, pass: null,
        detail: `${rows.length} item types in use over ${items} room items (the hero desk set left out). The composer's target is measured against the baseline (test/fleet/baseline.json, the hand-authored fleet at S0). Authored items only: once S3 composes rooms at build time, count the built rooms instead (house.plan — export them from assets/plan-export/compose.ts and run \`fleet-audit --built\`).`,
        table: { head: ['type', 'houses', 'items'], rows: top },
      };
    },
  },
];
