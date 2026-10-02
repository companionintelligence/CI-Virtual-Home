// assets/xr/locomotion.ts : SEED STUB (a stationary person, no input). Package xr-locomotion REPLACES this file (and adds input.ts, nav.ts, teleport.ts, dress.ts, doors.ts ...).
import type { XrHost, XrInput, XrLocomotion, XrRig } from './host.js';
export function createLocomotion(_host: XrHost, _rig: XrRig): { loco: XrLocomotion; input: XrInput } {
  const input: XrInput = {
    sources: () => [], rayPose: () => null, axes: () => null, button: () => null, haptic() {}, addTarget: () => () => {}, pointing: () => null, on: () => () => {}, update() {},
  };
  const loco: XrLocomotion = {
    async start() {}, tick() {}, places: () => [], goToPlace: async () => ({ ms: 0, headMovedM: 0, yawTurnedDeg: 0, swapFrame: 0 }),
    world: { floorY: () => 0, walkable: () => true, roomAt: () => ({ room: null, level: null, indoors: false }), segmentClear: () => true, hull: () => [], nearestStand: () => null },
    stop() {},
  };
  return { loco, input };
}
