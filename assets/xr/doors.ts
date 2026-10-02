// assets/xr/doors.ts : open the doors that are shut, for the length of a session, and put them back.
//
// A person cannot turn a handle: a shut door (the garden door, a bathroom) would be a wall they can never pass, and the nav already treats every
// doorway as clear (shot-world.ts leaves a swingable leaf out of the walls: "the track opens it ahead of the eye"). So each shut leaf is swung
// to its open angle at the start. anchors.doors is S1's list (kit-build.ts collectDoors): each entry carries `pivot`, the Object3D whose
// rotation.y swings the leaf, and pivot.userData.door = { closedAngle, openAngle } in radians.
//
// What this relies on, and what it does when it is not so: a leaf is a pivot, its meshes are children of it (the bake merges a door's meshes in
// the pivot's own frame and the 2D static batch never merges a userData.door mesh), so turning the pivot turns the leaf in both. A kit change that
// removes `pivot`, or renames the angles, makes an entry skipped silently; the count that opened is returned, and the test reads it.
// The sun's static shadow map is told once (a leaf moved).
export interface DoorState { opened: number; skipped: number; total: number }
export interface Doors { state(): DoorState; restore(): void }

export function openDoors(d: { anchors: any; renderer?: any }): Doors {
  const list: any[] = Array.isArray(d.anchors && d.anchors.doors) ? d.anchors.doors : [];
  const undo: Array<() => void> = [];
  let opened = 0, skipped = 0;
  for (const door of list) {
    const pivot = door && door.pivot, ud = pivot && pivot.userData && pivot.userData.door;
    if (!pivot || !pivot.rotation || !ud || typeof ud.openAngle !== 'number') { skipped++; continue; }
    if (Math.abs(pivot.rotation.y - ud.openAngle) < 0.02) continue;    // already open
    const was = pivot.rotation.y;
    pivot.rotation.y = ud.openAngle; pivot.updateMatrixWorld?.(true);
    undo.push(() => { pivot.rotation.y = was; pivot.updateMatrixWorld?.(true); });
    opened++;
  }
  if (opened && d.renderer && d.renderer.shadowMap) d.renderer.shadowMap.needsUpdate = true;
  let done = false;
  return {
    state: () => ({ opened, skipped, total: list.length }),
    restore() {
      if (done) return; done = true;
      for (const u of undo.splice(0).reverse()) { try { u(); } catch { /* a leaf that went away */ } }
      if (opened && d.renderer && d.renderer.shadowMap) d.renderer.shadowMap.needsUpdate = true;
    },
  };
}
