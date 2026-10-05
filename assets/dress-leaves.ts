// Where an open door leaf stands (DRESS): the plan areas of a storey a dress piece keeps out of. THREE-free, Node and page alike.
//
// The page parks every open leaf flat against the wall beside its door (S1's kit-build; scene QA `leaf-in-lane` tests the parked leaf's nine points against the box of every
// item of the room that is not hung in its wall and not foliage and stands over 0.3 m: "interior leaf interior:7 swings into robe-hook"). The composer already keeps its floor
// pieces out of the parking strip of the doors on ITS room's walls (room-geo.ts parkStrips), and that is not enough for what the dress phase adds:
//   - a robe hook or a towel rail hung on the wall beside a door is a wall piece, and the composer only checks the keep-outs of floor pieces;
//   - a door whose opening says `swing: 'out'` may still build its leaves swinging in (seraphine's french entry doors: the umbrella stand stood where the left leaf parks);
//   - a leaf parked against a short partition reaches past its end, through the wall it joins and into the next room (bghouse-olcia: a 1.5 m partition with a 0.8 m door
//     beside the hall; the hall's floor lamp stood in the leaf's strip, and the partition's own bounding box took the leaf in with it).
// So the dress phase reads the doors of the whole storey from the spec, in the world's frame, and keeps every piece that would trip the scene check out of both strips of every
// door that may carry a leaf, whichever side it parks on and whichever way it swings (an entry swings in under defaults 2 whatever its opening says; which jamb a leaf hangs on
// is room-creator.html's, and a wrong guess would put the warning back).
//
// A strip: along the wall from a jamb, `park` long (a pair of leaves: half the doorway each; a single leaf: the doorway's width), 0.27 m each side of the wall line (a leaf parks within 8° of its
// wall, so no point of it is over 0.2 m off the wall's line), as an obb; a piece's footprint grown by 2 cm is tested against it.
//
// Owner: DRESS.
import { perimeterEdges, edgeForOpening } from './house-geometry.js';
import { leafKindOf } from './kit-rules.js';
import { specDefaults } from './spec/index.js';
import { PROPS } from './props/index.js';
import { alongX, obb, type Obb, type Side } from './room-geo.js';

/** half the strip's depth across the wall line */
export const LEAF_DEPTH = 0.27;

/** every doorway of a storey that may carry a leaf: its wall line (an axis and a coordinate), the doorway's centre along it and its width, and how far a leaf parks along the wall from a jamb */
export function leafDoors(spec: any, lv: any): Array<{ x: boolean; line: number; c: number; w: number; park: number }> {
  const out: Array<{ x: boolean; line: number; c: number; w: number; park: number }> = [];
  const d2 = specDefaults(spec) >= 2;
  for (const p of lv.partitions || []) {
    if (p.door === null || p.door === undefined || !Array.isArray(p.from) || !Array.isArray(p.to)) continue;
    const px = Math.abs(p.from[1] - p.to[1]) < 1e-6, py = Math.abs(p.from[0] - p.to[0]) < 1e-6; if (!px && !py) continue;
    const w = p.doorW || 0.9, dir = px ? Math.sign(p.to[0] - p.from[0]) || 1 : Math.sign(p.to[1] - p.from[1]) || 1, c = (px ? p.from[0] : p.from[1]) + dir * p.door;
    if (p.doorStyle === 'cased' || p.doorStyle === 'none' || !(p.doorStyle || (w <= 1.1 && d2))) continue;
    const pair = w > 1.1 && (p.doorStyle === 'double' || p.doorStyle === 'french');
    out.push({ x: px, line: px ? p.from[1] : p.from[0], c, w, park: pair ? w / 2 : w });
  }
  let edges: any[] | null = null;
  for (const op of lv.openings || []) {
    if (op.type !== 'door' || op.style === 'cased') continue;
    edges = edges || perimeterEdges(lv.footprint);
    const e = edgeForOpening(edges, op.side, op.at); if (!e) continue;
    const side = op.side as Side, leaves = leafKindOf(spec, op), pair = op.w > 1.1 && (leaves === 'double' || leaves === 'french');
    if (leaves === 'none' || !(op.leaf || d2)) continue;
    out.push({ x: alongX(side), line: alongX(side) ? e.a[1] : e.a[0], c: op.at, w: op.w, park: pair ? op.w / 2 : op.w });
  }
  return out;
}

/** the strips (both sides of every doorway) of a storey, as obbs in the plan */
export function leafStrips(spec: any, lv: any): Obb[] {
  const out: Obb[] = [];
  for (const d of leafDoors(spec, lv)) for (const sg of [-1, 1]) {
    const t0 = sg < 0 ? d.c - d.w / 2 - d.park : d.c + d.w / 2, m = t0 + d.park / 2, len = d.park + 0.1;
    out.push(d.x ? obb(m, d.line, len, LEAF_DEPTH * 2, 0) : obb(d.line, m, LEAF_DEPTH * 2, len, 0));
  }
  return out;
}

/** is a piece of this type one the scene check counts as in a leaf's way: not hung in its wall (a mountY), not foliage, and tall enough (`h`, its measured height, and 2 cm for a mesh taller than its box: the scene check's bound is 0.3 m) */
export function leafSensitive(type: string, h: number): boolean {
  const def: any = (PROPS as Map<string, any>).get(type);
  return !(def && (def.foliage || def.mountY !== undefined)) && h + 0.02 > 0.3;
}
