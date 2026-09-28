// <id>.plan.json — what the three.js builder resolved from a spec that the Python twins (generate_house_iso.py,
// generate_floor_plans.py) and the Node harnesses cannot derive themselves. One key per stream (plan Completeness
// C7), each a pass-through of what that stream's builder put on `anchors`; scripts/build-house-plan.mts writes
// { id, generated, ...planOf(anchors) }. A key whose value is undefined is left out, so a stream adds its key by
// editing only its own line, and the files do not change until it does.
//
// Owned by S0 (the shape); each entry by the stream named beside it. Keep the order: it is the files' key order.
export const PLAN_KEYS: Array<[key: string, pick: (anchors: any) => unknown]> = [
  ['site', a => a.siteInstances || []],   // S4 — the seeded site instances, as world boxes with shape and colour
  ['kit', a => a.kit || null],            // S1 — role colours and the cladding
  ['arch', a => undefined],               // S2 — (features, stairs with their true runs and voids, room finishes)
  ['compose', a => undefined],            // S3 — (composed rooms, lanes)
  ['shots', a => undefined],              // S5 — (entry, hero.coreBox, stairs, solids and item boxes for the Node harness)
];

export function planOf(anchors: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, pick] of PLAN_KEYS) { const v = pick(anchors); if (v !== undefined) out[key] = v; }
  return out;
}
