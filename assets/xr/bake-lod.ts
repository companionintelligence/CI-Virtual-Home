// assets/xr/bake-lod.ts : which merged meshes a headset at a given place draws. Decided per teleport (bake.ts refocus), never per frame:
// a visibility flip is free, but doing it from the head's pose each frame would put a loop and a shadow update in the hot path.
//
// The rule (XR-PLAN, xr-bake): a merged mesh is drawn when it is on the head's storey or one above or below, AND within `radius`
// metres of the head (the nearest point of its box, so a wall beside you is never dropped). The ground is drawn on every storey:
// it is one flat mesh and without it a first-floor window looks out on nothing.
//
// This is what gets the seven heaviest houses (asymmetry, mirage, aurora, riverbend, seraphine, cocoon, vanilla) under a Quest 3's
// call budget: a three-storey house seen from the top storey does not draw the ground floor's rooms.
import type { Merged } from './bake-merge.js';

export interface LodState {
  radius: number;      // metres; the budget's lodRadiusM, tightened by the "cull harder" loop when the first measurement is over budget
  levels: number;      // storeys either side of the head's: 1 normally, 0 when culling harder
}

/** the metres from a point to a box (0 inside it), on the floor plan only: storeys are decided by index */
export function planDistance(box: [number, number, number, number, number, number], x: number, z: number): number {
  const dx = Math.max(box[0] - x, 0, x - box[3]), dz = Math.max(box[2] - z, 0, z - box[5]);
  return Math.hypot(dx, dz);
}

/** Set `mesh.visible` on every merged mesh for a head at (x, z) on storey `level`. Returns how many changed and how many are shown. */
export function focus(merged: Merged[], x: number, z: number, level: number, st: LodState): { changed: number; shown: number } {
  let changed = 0, shown = 0;
  for (const m of merged) {
    const near = (m.level < 0 || Math.abs(m.level - level) <= st.levels) && planDistance(m.box, x, z) <= st.radius;
    if (m.mesh.visible !== near) { m.mesh.visible = near; changed++; }
    if (near) shown++;
  }
  return { changed, shown };
}
