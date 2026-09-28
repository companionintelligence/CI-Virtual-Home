// Fleet metrics — owned by S4 (site): "the planting is very rectangular and repetitive", in numbers. See _types.mts.
import type { Metric, House } from './_types.mts';

// the ground storey's plan bounds (the house the front garden is in front of)
function houseBounds(h: House) {
  const rects = (h.spec.levels || []).filter(l => (l.y || 0) <= 0.001).flatMap(l => l.footprint || []);
  if (!rects.length) return null;
  return { minX: Math.min(...rects.map(r => r.x)), maxX: Math.max(...rects.map(r => r.x + r.w)), minZ: Math.min(...rects.map(r => r.z)), maxZ: Math.max(...rects.map(r => r.z + r.d)) };
}
// between the entry facade and the street: past the house's bounds on the entry side
function inFront(h: House, x: number, z: number) {
  const b = houseBounds(h), side = (h.spec.entry || {}).side || 'S';
  if (!b) return false;
  return side === 'S' ? z > b.maxZ : side === 'N' ? z < b.minZ : side === 'E' ? x > b.maxX : x < b.minX;
}
// the edges of a bed or a path, as segments
function edges(s: any): Array<[number[], number[]]> {
  const segs = (pts: number[][], closed: boolean) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [number[], number[]]).slice(0, closed ? pts.length : pts.length - 1);
  if (s.type === 'bed' && Array.isArray(s.poly) && s.poly.length >= 3) return segs(s.poly, true);
  if (s.type === 'bed' && Array.isArray(s.at)) { const w = s.w || 2, d = s.d || 1, [x, z] = s.at; return segs([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], true); }
  if (s.type === 'path' && Array.isArray(s.path) && s.path.length >= 2) return segs(s.path, false);
  return [];
}

export const metrics: Metric[] = [
  {
    id: 'planting-types', title: 'Planting and garden types', stream: 'S4',
    compute(f) {
      const PLANTING = new Set(['tree', 'shrub', 'flowers', 'rock', 'bed', 'hedge', 'scatter', 'grove', 'cypress', 'palm', 'cactus', 'planter', 'garden-beds', 'planting']);
      const houses = new Map<string, Set<string>>(), count = new Map<string, number>();
      for (const h of f.houses) for (const s of h.spec.site || []) if (PLANTING.has(s.type)) { count.set(s.type, (count.get(s.type) || 0) + 1); houses.set(s.type, (houses.get(s.type) || new Set()).add(h.id)); }
      const rows = [...houses.entries()].map(([t, s]) => [t, s.size, count.get(t)] as [string, number, number]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
      const n = f.houses.length;
      return {
        value: rows.slice(0, 5).map(r => `${r[0]} ${r[1]}/${n}`).join(' · '), pass: null,   // reported; the plan's targets are on mix and context (below)
        detail: 'Houses using each planting type, and how many items of it. S4\'s `planting` generator (mix, layers) reports here as it lands.',
        table: { head: ['type', 'houses', 'items'], rows },
      };
    },
  },
  {
    id: 'front-garden-beds', title: 'Vegetable crates in the front garden', stream: 'S4', target: '0',
    compute(f) {
      const hits = f.houses.flatMap(h => (h.spec.site || []).filter(s => s.type === 'garden-beds' && Array.isArray(s.at) && inFront(h, s.at[0], s.at[1])).map(s => ({ id: h.id, at: s.at, count: s.count || 4 })));
      return {
        value: `${hits.length} (${new Set(hits.map(h => h.id)).size} houses)`, pass: hits.length === 0,
        detail: '`garden-beds` (raised vegetable crates) between the entry facade and the street.',
        table: { head: ['house', 'at', 'crates'], rows: hits.map(h => [h.id, `[${h.at.join(', ')}]`, h.count]) },
      };
    },
  },
  {
    id: 'axis-aligned-edges', title: 'Axis-aligned bed and path edges', stream: 'S4', target: '≤ 20 % of their length',
    compute(f) {
      const rows = [];
      let all = 0, axis = 0;
      for (const h of f.houses) {
        let a = 0, t = 0;
        for (const s of h.spec.site || []) for (const [p, q] of edges(s)) {
          const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
          if (len < 1e-6) continue;
          const deg = Math.atan2(Math.abs(dz), Math.abs(dx)) * 180 / Math.PI;   // 0 along x, 90 along z
          t += len; if (deg < 1 || deg > 89) a += len;
        }
        all += t; axis += a;
        if (t > 0) rows.push([h.id, t.toFixed(1), `${(a / t * 100).toFixed(0)} %`]);
      }
      const share = all ? axis / all : 0;
      return {
        value: `${(share * 100).toFixed(0)} % of ${all.toFixed(0)} m`, pass: all ? share <= 0.2 : null,
        detail: 'Bed outlines (a polygon, or the rectangle at w × d) and path centre lines on the 30 real lots, by length; an edge within 1° of the x or z axis counts as axis-aligned.',
        table: { head: ['house', 'edge length (m)', 'axis-aligned'], rows: rows.sort((a, b) => parseFloat(b[2]) - parseFloat(a[2])) },
      };
    },
  },
  {
    id: 'mix-context', title: 'Planting mix and lot context', stream: 'S4', target: 'no mix and no context on more than 25 % of houses',
    compute(f) {
      const mixes = new Map<string, number>(), ctx = new Map<string, number>();
      for (const h of f.houses) {
        const ms = new Set((h.spec.site || []).filter(s => s.type === 'planting' && s.mix).map(s => (typeof s.mix === 'string' ? s.mix : 'custom')));
        for (const m of ms.size ? ms : ['(none)']) mixes.set(m as string, (mixes.get(m as string) || 0) + 1);
        const c = (h.spec.lot || {}).context || '(suburb: the default)';
        ctx.set(c, (ctx.get(c) || 0) + 1);
      }
      const n = f.houses.length || 1, top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const tm = top(mixes), tc = top(ctx);
      return {
        value: `top mix ${tm[0]} ${tm[1]}/${f.houses.length}, top context ${tc[0]} ${tc[1]}/${f.houses.length}`,
        pass: tm[0] === '(none)' ? null : tm[1] / n <= 0.25 && tc[1] / n <= 0.25,
        detail: 'S4\'s `planting.mix` and `lot.context` — not authored yet on any house, so every lot is the same suburb.',
        table: { head: ['mix / context', 'houses'], rows: [...[...mixes.entries()].map(([k, v]) => [`mix: ${k}`, v]), ...[...ctx.entries()].map(([k, v]) => [`context: ${k}`, v])] },
      };
    },
  },
];
