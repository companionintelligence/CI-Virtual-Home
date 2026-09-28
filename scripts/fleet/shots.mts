// Fleet metrics — owned by S5 (shot): what the films have in common. See _types.mts. The camera metrics of
// §3.14 (outside share, door speed, yaw, final Core position …) need the built houses — S5's camera-audit.mts
// measures them; what the specs alone say is below.
import type { Metric } from './_types.mts';

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
        value: `${rows[0][0]} on ${rows[0][1]} of ${f.houses.length}`, pass: rows[0][1] / n <= 0.25,
        table: { head: ['establishing style', 'houses'], rows },
      };
    },
  },
];
