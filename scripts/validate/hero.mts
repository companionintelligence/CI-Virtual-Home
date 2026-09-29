// Validator plugin — owned by S1 (kit): the Core policy (plan §4.6; Completeness B "a Core-policy lint"). Warnings,
// promoted after the layout pass:
//   hero:one-core      exactly one Companion Core a house (the hero; a room-item Core elsewhere is a second one)
//   hero:storey        on the entry storey, unless the photo's signature room is upstairs (hero.upstairs: true)
//   hero:wall          a desk or shelf backs onto a wall 0.4 m behind hero.at (≤ 0.45 m) — never mid-room
//   hero:doorway       not in front of its room's only doorway
//   hero:approach      2 m in front of the hero clear of anything taller than 0.45 m (the camera's last steps)
//   hero:contrast      the device reads against its surface (charcoal on walnut, chalk on white stone do not)
import fs from 'node:fs';
import path from 'node:path';
import type { Check, Issue } from './_types.mts';
import { heroRoom } from '../../assets/kit-rules.js';
import { heroSurfaceColour } from '../../assets/hero-build.js';
import { HERO_SET } from '../../assets/item-map.js';
import { colourMath } from '../../assets/materials.js';

const CORES = new Set(['chalk-tower', 'charcoal-tower', 'core-shelf', 'strix-mini']);
const CATALOG = (() => { try { return JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'content', 'house-catalog.json'), 'utf8')).types || {}; } catch { return {}; } })();
const DEVICE = { chalk: 0xf3f3f1, charcoal: 0x1a1b1e, strix: 0x1e242f };
const LOW = new Set(['area-rug', 'circular-rug', 'concentric-rug', 'runner-rug', 'rug', 'floor-lamp', 'halo-lamp', 'tripod-floor-lamp']);

// the distance from p along d to the first wall (perimeter edges, partitions) of the storey, or Infinity
function wallAlong(lv: any, p: number[], d: number[], perimeterEdges: (f: any[]) => any[]): number {
  let best = Infinity;
  const seg = (a: number[], b: number[]) => {
    const ex = b[0] - a[0], ez = b[1] - a[1], den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-9) return;
    const t = ((a[0] - p[0]) * ez - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  };
  for (const e of perimeterEdges(lv.footprint || [])) seg(e.a, e.b);
  for (const pt of lv.partitions || []) if (Array.isArray(pt.from) && Array.isArray(pt.to)) seg(pt.from, pt.to);
  return best;
}

const check: Check = (spec, ctx) => {
  const out: Issue[] = [];
  const warn = (message: string, code: string) => out.push({ level: 'warn', message, code });
  const h = spec.hero;
  if (!h || !Array.isArray(h.at)) return out;
  const lv = (spec.levels || []).find(l => l.id === h.level);
  if (!lv) return out;
  const rot = ((h.rot || 0) + 180) * Math.PI / 180, fwd = [-Math.sin(rot), -Math.cos(rot)], surface = h.surface || 'desk';

  // one Core
  const extra = [];
  for (const l of spec.levels || []) for (const r of l.rooms || []) for (const it of r.items || []) {
    if (!CORES.has(it.type) || !Array.isArray(it.at)) continue;
    if (l.id === h.level && HERO_SET.has(it.type) && Math.hypot(it.at[0] - h.at[0], it.at[1] - h.at[1]) < 1.3) continue;   // the hero set's own copy
    extra.push(`${it.type} in "${r.name}" (${l.id})`);
  }
  if (extra.length) warn(`${extra.length + 1} Companion Cores: the hero and ${extra.join(', ')} — one Core a house (plan §4.6)`, 'one-core');

  // the entry storey
  if (spec.entry && spec.entry.level !== h.level && h.upstairs !== true) warn(`the Core is on ${h.level}, the entry on ${spec.entry.level}: keep it on the entry storey, or set hero.upstairs: true where the photo's signature room is upstairs`, 'storey');

  // against a wall
  if (surface === 'desk' || surface === 'shelf') {
    // walls are drawn on their centre lines: the face is half a wall (0.08 m) nearer
    const d = wallAlong(lv, h.at, [-fwd[0], -fwd[1]], ctx.perimeterEdges) - 0.08;
    if (!Number.isFinite(d) || d > 3) warn(`the ${surface} floats mid-room: no wall behind hero.at within 3 m (it backs onto rot ${h.rot || 0})`, 'wall');
    else if (d > 0.45 + 1e-6) warn(`the ${surface} stands ${d.toFixed(2)} m off its wall's face (hero.at is the desk centre, 0.4 m from the wall: ≤ 0.45)`, 'wall');
  }

  // the room's only doorway
  const hr = heroRoom(spec);
  if (hr) {
    const b = hr.room.bounds, on = (x, z) => x >= b.x - 0.15 && x <= b.x + b.w + 0.15 && z >= b.z - 0.15 && z <= b.z + b.d + 0.15 && !(x > b.x + 0.15 && x < b.x + b.w - 0.15 && z > b.z + 0.15 && z < b.z + b.d - 0.15);
    const doors: number[][] = [];
    for (const pt of lv.partitions || []) {
      if (pt.door === null || pt.door === undefined || !Array.isArray(pt.from) || !Array.isArray(pt.to)) continue;
      const len = Math.hypot(pt.to[0] - pt.from[0], pt.to[1] - pt.from[1]) || 1, x = pt.from[0] + (pt.to[0] - pt.from[0]) * pt.door / len, z = pt.from[1] + (pt.to[1] - pt.from[1]) * pt.door / len;
      if (on(x, z)) doors.push([x, z]);
    }
    const edges = ctx.perimeterEdges(lv.footprint || []);
    for (const op of lv.openings || []) {
      if (!['door', 'slider'].includes(op.type)) continue;
      const e = edges.find(e => e.side === op.side && ((op.side === 'S' || op.side === 'N') ? op.at >= Math.min(e.a[0], e.b[0]) - 1e-6 && op.at <= Math.max(e.a[0], e.b[0]) + 1e-6 : op.at >= Math.min(e.a[1], e.b[1]) - 1e-6 && op.at <= Math.max(e.a[1], e.b[1]) + 1e-6));
      if (!e) continue;
      const x = op.side === 'S' || op.side === 'N' ? op.at : e.a[0], z = op.side === 'S' || op.side === 'N' ? e.a[1] : op.at;
      if (on(x, z)) doors.push([x, z]);
    }
    if (doors.length === 1 && Math.hypot(doors[0][0] - h.at[0], doors[0][1] - h.at[1]) < 1.3) warn(`the Core stands ${Math.hypot(doors[0][0] - h.at[0], doors[0][1] - h.at[1]).toFixed(2)} m from room "${hr.room.name}"'s only doorway — keep that way in clear`, 'doorway');
  }

  // 2 m of approach in front of it
  const blockers = [];
  for (const r of lv.rooms || []) for (const it of r.items || []) {
    if (!Array.isArray(it.at) || HERO_SET.has(it.type) || CORES.has(it.type) || LOW.has(it.type)) continue;
    const c = CATALOG[it.type]; if (!c || c.height <= 0.45 || c.surface) continue;
    const q = ((it.rot || 0) % 180 + 180) % 180 === 90, hw = (q ? c.footprint[1] : c.footprint[0]) / 2, hd = (q ? c.footprint[0] : c.footprint[1]) / 2;
    // the corridor: 0.8 m wide, from 0.55 m to 2.55 m in front of hero.at (the desk's front edge on)
    let hit = false;
    for (let s = 0.55; s <= 2.55 && !hit; s += 0.1) for (const o of [-0.4, 0, 0.4]) {
      const x = h.at[0] + fwd[0] * s + fwd[1] * o, z = h.at[1] + fwd[1] * s - fwd[0] * o;
      if (Math.abs(x - it.at[0]) < hw && Math.abs(z - it.at[1]) < hd) { hit = true; break; }
    }
    if (hit) blockers.push(`${it.type} at ${JSON.stringify(it.at)}`);
  }
  if (blockers.length) warn(`the 2 m approach to the Core is blocked by ${blockers.join(', ')} (keep a 0.8 m lane clear in front of it)`, 'approach');

  // contrast
  const dev = DEVICE[h.device || 'chalk'] ?? DEVICE.chalk, surf = heroSurfaceColour(spec);
  if (surf !== null) {
    const dl = Math.abs(colourMath.lum(dev) - colourMath.lum(surf));
    if (dl < 0.25) warn(`a ${h.device || 'chalk'} Core on a ${colourMath.css(surf)} ${surface} barely reads (luma ${colourMath.lum(dev).toFixed(2)} on ${colourMath.lum(surf).toFixed(2)}): change the device or hero.surfaceColor`, 'contrast');
  }
  return out;
};
export default check;
