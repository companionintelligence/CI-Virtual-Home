// <id>.plan.json — what the three.js builder resolved from a spec that the Python twins (generate_house_iso.py,
// generate_floor_plans.py) and the Node harnesses cannot derive themselves. One key per stream (plan Completeness
// C7), each a pass-through of what that stream's builder put on `anchors`, picked in that stream's own file here
// (site.ts S4, kit.ts S1, arch.ts S2, compose.ts S3, shots.ts S5), so no two streams edit one file.
// scripts/build-house-plan.mts writes { id, generated, ...planOf(anchors) }. A key whose value is undefined is left
// out, so the files do not change until a stream exports something.
//
// Owned by S0 (the shape and the key order, which is the files' key order).
import { pick as site } from './site.js';
import { pick as kit } from './kit.js';
import { pick as arch } from './arch.js';
import { pick as compose } from './compose.js';
import { pick as shots } from './shots.js';

export const PLAN_KEYS: Array<[key: string, pick: (anchors: any) => unknown]> = [
  ['site', site],
  ['kit', kit],
  ['arch', arch],
  ['compose', compose],
  ['shots', shots],
];

export function planOf(anchors: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, pick] of PLAN_KEYS) { const v = pick(anchors); if (v !== undefined) out[key] = v; }
  return out;
}
