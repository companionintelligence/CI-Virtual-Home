// Fleet metrics — owned by S4 (site): "the planting is very rectangular and repetitive", in numbers. See _types.mts.
import type { Metric, House } from './_types.mts';
import { axisAlignedRuns, tensionOf, smoothLoop } from '../../assets/site-geom.js';
import { mixNameOf, createSiteContext } from '../../assets/site-planting.js';

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
// the edges of the beds and paths a house draws — as built when its plan carries them (fleet-audit --built: curves resolved,
// plantings' beds laid out, a bed's straight edge against the house marked `wall` and left out), else as authored. A path
// raised off the ground (a `y` over 0.3 m: a timber line on a facade) is a trim, not a garden path.
type Edge = { site: number; type: string; pts: number[][]; closed: boolean; wall: boolean[] | null };
function edgesOf(h: House): { list: Edge[]; built: boolean } {
  const plan = h.plan && h.plan.site && !Array.isArray(h.plan.site) && Array.isArray(h.plan.site.edges) ? h.plan.site.edges : null;
  if (plan) return { built: true, list: plan.map((e: any) => ({ site: e.site, type: e.type, pts: e.pts, closed: !!e.closed, wall: e.wall || null })) };
  const list: Edge[] = [], ctx = createSiteContext(h.spec);
  (h.spec.site || []).forEach((s: any, i: number) => {
    if (s.type === 'bed' && Array.isArray(s.poly) && s.poly.length >= 3) { const t = tensionOf(s.smooth); list.push({ site: i, type: 'bed', pts: t === null ? s.poly : smoothLoop(s.poly, t, 0.25), closed: true, wall: null }); }
    else if (s.type === 'bed' && Array.isArray(s.at)) { const w = s.w || 2, d = s.d || 1, [x, z] = s.at; list.push({ site: i, type: 'bed', pts: [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], closed: true, wall: null }); }
    else if (s.type === 'path' && Array.isArray(s.path) && s.path.length >= 2 && !(s.y > 0.3)) list.push({ site: i, type: 'path', pts: ctx.pathLine(s), closed: false, wall: null });
  });
  return { built: false, list };
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
        value: `${hits.length} (${new Set(hits.map(h => h.id)).size} houses)`, measure: hits.length, pass: hits.length === 0,
        detail: '`garden-beds` (raised vegetable crates) between the entry facade and the street.',
        table: { head: ['house', 'at', 'crates'], rows: hits.map(h => [h.id, `[${h.at.join(', ')}]`, h.count]) },
      };
    },
  },
  {
    id: 'axis-aligned-edges', title: 'Axis-aligned bed and path edges', stream: 'S4', target: '≤ 20 % of their length',
    compute(f) {
      const rows = [];
      let all = 0, axis = 0, built = 0;
      for (const h of f.houses) {
        const { list, built: b } = edgesOf(h); if (b) built++;
        let a = 0, t = 0; const worst: Array<[number, string]> = [];
        for (const e of list) {
          const r = axisAlignedRuns(e.pts as any, e.closed, e.wall, { chord: 1.5, tol: 3 });
          a += r.axis; t += r.total;
          if (r.axis >= 4) worst.push([r.axis, `site[${e.site}] ${e.type} ${r.axis.toFixed(0)} m`]);
        }
        all += t; axis += a;
        if (t > 0) rows.push([h.id, t.toFixed(1), `${(a / t * 100).toFixed(0)} %`, worst.sort((x, y) => y[0] - x[0]).slice(0, 4).map(x => x[1]).join(', ')]);
      }
      const share = all ? axis / all : 0;
      return {
        value: `${(share * 100).toFixed(0)} % of ${all.toFixed(0)} m`, measure: +share.toFixed(4), pass: all ? share <= 0.2 : null,
        detail: `Bed outlines and path centre lines on the real lots, by length. Judged as an eye judges it — over 1.5 m chords, not the 0.25 m samples a curve is resampled to: a chord within 3° of the x or z axis that is also straight (under 9 cm of sag) is axis-aligned, so a wobble of a centimetre between samples does not hide a straight edge. ${built ? `Measured as built on ${built} of ${f.houses.length} houses (their plan's site.edges: curves resolved, plantings laid out, a bed's edge against the house left out)` : 'As authored (run `fleet-audit --built` to measure the edges the builder resolves)'}. The last column names the straight items to bend: a \`meander\` (a sway in metres) or waypoints with \`smooth\`.`,
        table: { head: ['house', 'edge length (m)', 'axis-aligned', 'the straightest items'], rows: rows.sort((a, b) => parseFloat(b[2]) - parseFloat(a[2])) },
      };
    },
  },
  {
    id: 'mix-context', title: 'Planting mix and lot context', stream: 'S4', target: 'no mix and no context on more than 25 % of houses',
    compute(f) {
      // the mix a house is planted with is the one the generator plants: the one a planting names, else the one its lot's
      // context and kind imply (mixNameOf) — a house with a foundation planting and no `mix` is planted, in some mix
      const mixes = new Map<string, number>(), ctx = new Map<string, number>();
      for (const h of f.houses) {
        const ms = new Set((h.spec.site || []).filter(s => s.type === 'planting').map(s => mixNameOf(s, h.spec.lot)));
        for (const m of ms.size ? ms : ['(no planting)']) mixes.set(m as string, (mixes.get(m as string) || 0) + 1);
        const c = (h.spec.lot || {}).context || '(suburb: the default)';
        ctx.set(c, (ctx.get(c) || 0) + 1);
      }
      const n = f.houses.length || 1, top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const tm = top(mixes), tc = top(ctx);
      return {
        value: `top mix ${tm[0]} ${tm[1]}/${f.houses.length}, top context ${tc[0]} ${tc[1]}/${f.houses.length}`,
        pass: tm[1] / n <= 0.25 && tc[1] / n <= 0.25,
        detail: 'The mix each house is planted in (named by its `planting.mix`, else implied by its lot context — a desert lot is planted as a desert) and its `lot.context`. A house with several plantings counts once for each mix it uses; a house with none is "(no planting)", which is a mix that says nothing.',
        table: { head: ['mix / context', 'houses'], rows: [...[...mixes.entries()].map(([k, v]) => [`mix: ${k}`, v]), ...[...ctx.entries()].map(([k, v]) => [`context: ${k}`, v])] },
      };
    },
  },
  {
    id: 'world-variety', title: 'A varied world round the lot', stream: 'S4', target: 'at least 75 % of houses',
    compute(f) {
      // the neighbours, the street and the tree line come from world.ts: the plain white-and-black suburb unless the spec
      // opts into the varied one — `defaults: 2` (style- and palette-varied neighbours) or a `lot.context` that is not the suburb
      const varied = f.houses.filter(h => (Number((h.spec || {}).defaults) || 0) >= 2 || (['city', 'forest', 'desert', 'waterfront', 'rural', 'hillside'].includes((h.spec.lot || {}).context)) || !!(h.spec.lot || {}).water);
      const share = f.houses.length ? varied.length / f.houses.length : 0;
      return {
        value: `${varied.length}/${f.houses.length} (${(share * 100).toFixed(0)} %)`, measure: +share.toFixed(4), pass: f.houses.length ? share >= 0.75 : null,
        detail: 'Houses whose world is not the default white-and-black suburb: `defaults: 2`, a `lot.context` other than the suburb, or `lot.water`. Neighbours are near-white with near-black roofs on every lot that opts into none of these (assets/world.ts).',
        table: { head: ['house', 'context', 'defaults', 'water'], rows: f.houses.filter(h => !varied.includes(h)).map(h => [h.id, (h.spec.lot || {}).context || '(suburb)', Number((h.spec || {}).defaults) || 1, 'no']) },
      };
    },
  },
];
