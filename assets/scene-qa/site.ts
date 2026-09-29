// Scene QA checks — owned by S4 (site). Registered with registerSceneCheck(code, ctx => issues); see registry.ts.
// New checks arrive as warnings until the layout pass promotes them (plan §2.0). They read what the site loop
// recorded on the anchors (site-build.ts): the solids that stand on the lot and the items no builder built.
//
//   site-dropped   a site item no builder built (the validator refuses an unknown type; this catches a builder
//                  that returned nothing for one it knows)
//   site-in-house  a trunk, a post, a fence, a wall or a hedge standing inside the ground storey's footprint —
//                  a tree growing through the living room reads as a clash in every interior frame
//   site-buried    water under a deck or a terrace that stands above its rim (the water cannot be seen)
//   site-sunk      a tree's foot buried in a terrace it stands in (the ground did not follow the terrace under it)
import { registerSceneCheck } from './registry.js';

const SOLID_IN_HOUSE = new Set(['trunk', 'post', 'fence', 'wall', 'hedge', 'retaining', 'stair']);

registerSceneCheck('site-dropped', ({ house }) => (house.anchors.siteDropped || []).map(d => ({
  level: 'warn' as const, message: `site[${d.site}] "${d.type}": no builder built it`, subject: d.type,
})));

registerSceneCheck('site-in-house', ({ house }) => {
  const rects = (house.spec.levels || []).filter(l => (l.y || 0) <= 0.001).flatMap(l => l.footprint || []);
  const inside = (x: number, z: number, m: number) => rects.some(r => x > r.x + m && x < r.x + r.w - m && z > r.z + m && z < r.z + r.d - m);
  const out = [];
  for (const s of house.anchors.siteSolids || []) {
    if (!SOLID_IN_HOUSE.has(s.kind) || s.poly || s.yMin > 0.5) continue;   // (a roof deck's posts stand on the roof)
    if (inside(s.x, s.z, 0.25)) out.push({ level: 'warn' as const, message: `a ${s.kind} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) stands inside the ground storey`, subject: s.kind });
  }
  return out;
});

registerSceneCheck('site-buried', ({ house }) => {
  const solids = house.anchors.siteSolids || [], out = [];
  const box = s => s.w !== undefined ? { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 } : null;
  for (const w of solids.filter(s => s.kind === 'water' && s.w !== undefined)) {
    const a = box(w), area = (a.x1 - a.x0) * (a.z1 - a.z0);
    for (const c of solids.filter(s => (s.kind === 'deck' && !s.rot) && s.yMax > w.yMax + 0.05 && s.yMin < w.yMax + 0.05)) {
      const b = box(c); if (!b || area <= 0) continue;
      const ov = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
      if (ov / area > 0.5) out.push({ level: 'warn' as const, message: `water at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) is ${Math.round(ov / area * 100)} % under a deck standing above its rim`, subject: 'water' });
    }
  }
  return out;
});

// what a solid covers in plan: a rotated box (w × d, `rot` degrees as the builders turn them), a circle (r) or a polygon
const covers = (s: any, x: number, z: number, m = 0): boolean => {
  if (s.poly) { let c = false; const P = s.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
  if (s.r !== undefined && s.w === undefined) return Math.hypot(x - s.x, z - s.z) <= s.r + m;
  if (s.w === undefined) return false;
  const a = (s.rot || 0) * Math.PI / 180, dx = x - s.x, dz = z - s.z, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(lx) <= s.w / 2 + m && Math.abs(lz) <= s.d / 2 + m;
};

registerSceneCheck('site-sunk', ({ house }) => {
  const solids = house.anchors.siteSolids || [], out = [];
  for (const t of solids.filter(s => s.kind === 'trunk')) {
    const over = solids.filter(s => s.kind === 'terrace' && covers(s, t.x, t.z) && s.yMax > t.yMin + 0.3).sort((a, b) => b.yMax - a.yMax)[0];
    if (over) out.push({ level: 'warn' as const, message: `a trunk at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) is buried ${(over.yMax - t.yMin).toFixed(1)} m in a terrace`, subject: 'trunk' });
  }
  return out;
});
