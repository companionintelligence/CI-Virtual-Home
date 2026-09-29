// <id>.plan.json's `arch` key. Owned by S2 (architecture): edit only this file (index.ts beside it has the contract).
//
// What the builder resolved from the spec's architecture fields that the Python twins (generate_floor_plans.py draws
// porches, bays, balconies, L/U stairs and finish hatching; generate_house_iso.py draws the new volumes and chimneys) and
// the Node harnesses cannot derive themselves — a pass-through of anchors.arch and the flights on anchors.stairs:
//
//   features  [{ type: porch | bay | balcony | terrace | loggia | fireplace | builtin | chimney, level, … }] — each with its
//             plan geometry as built (rect, outline, posts, rails, roof, steps, stack base and top); anchors.features
//   stairs    the flights that are not a lone straight or spiral one (an array, L, U, closed): { from, to, index, type, shape,
//             flights, landings, outline, path, voidRects, stepOff, w } — the true run polygon and the void it needs
//   rooms     [{ level, name, bounds, finish: { floor, floorColor, floorY, floorOffset, walls, wallColor, feature, ceiling } }]
//   volumes   [{ level, rect, h }] — footprint rects with their own height (towers, low wings)
//   plinths   [{ level, h, foundation, material, color }]      stoop  { level, side, at, top, steps, landing, stairs }
//   voids     [{ level, auto: [rect], double: [rect + room] }] — the slab openings beyond the storey's own `voids`
//
// A house that uses none of them exports nothing (undefined leaves the key out, so today's plan files do not change).
export const pick = (a: any): unknown => {
  const arch = a.arch;
  if (!arch) return undefined;
  const out: Record<string, unknown> = {};
  if (arch.features && arch.features.length) out.features = arch.features;
  // a lone straight or spiral flight is v1's: the twins draw it from the spec. Everything else carries its plan.
  const stairs = (a.stairs || []).filter(s => s.shape && (s.shape === 'L' || s.shape === 'U' || s.index > 0 || s.type === 'closed' || s.path));
  if (stairs.length) out.stairs = stairs.map(s => ({ from: s.from, to: s.to, index: s.index, type: s.type, shape: s.shape, w: s.w, dir0: s.dir0, flights: s.flights, landings: s.landings, outline: s.outline, path: s.path, voidRects: s.voidRects, stepOff: s.stepOff, bottom: s.bottom, top: s.top }));
  if (arch.rooms && arch.rooms.length) out.rooms = arch.rooms;
  if (arch.volumes && arch.volumes.length) out.volumes = arch.volumes;
  if (arch.plinths && arch.plinths.length) out.plinths = arch.plinths;
  if (arch.voids && arch.voids.length) out.voids = arch.voids;
  if (arch.stoop) out.stoop = arch.stoop;
  return Object.keys(out).length ? out : undefined;
};
