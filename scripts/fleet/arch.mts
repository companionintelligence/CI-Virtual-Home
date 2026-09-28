// Fleet metrics — owned by S2 (architecture): the vocabulary the photos need, fleet-wide. See _types.mts.
import type { Metric } from './_types.mts';

// the finish a roof renders with today (materials.ts ROOF_KIND by roof `type`; S2's roofs[].finish, once it lands,
// overrides it)
const FINISH = { gable: 'shingle', hip: 'shingle', shed: 'seam', terracotta: 'tile', flat: 'membrane', 'aframe-glass': 'glass' };
const finishOf = (rf: any): string => rf.finish || FINISH[rf.type] || 'shingle';

export const metrics: Metric[] = [
  {
    id: 'roof-finishes', title: 'Roof finishes', stream: 'S2',
    compute(f) {
      const per = f.houses.map(h => ({ id: h.id, finishes: [...new Set<string>((h.spec.roofs || []).map(finishOf))] }));
      const m = new Map<string, number>();
      for (const p of per) for (const k of p.finishes) m.set(k, (m.get(k) || 0) + 1);
      const rows = [...m.entries()].sort((a, b) => b[1] - a[1]), n = f.houses.length || 1;
      return {
        value: `${rows.map(([k, c]) => `${k} ${c}`).join(' · ')} (${per.filter(p => p.finishes.length >= 2).length} houses with two or more)`,
        pass: null,   // the plan sets no target yet: it is reported for S2's PRs to move
        detail: 'Houses per finish (a house counts once per finish it uses): today the finish follows the roof type (gable and hip → shingle, shed → standing seam, terracotta → clay tile, flat → membrane).',
        table: { head: ['finish', 'houses', 'share'], rows: rows.map(([k, c]) => [k, c, `${(c / n * 100).toFixed(0)} %`]) },
      };
    },
  },
];
