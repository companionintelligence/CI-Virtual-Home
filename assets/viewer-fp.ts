// First-person moves for the player's free camera, shared by the touch controls (viewer-touch.ts) and the gamepad (viewer-pad.ts).
//
// OrbitControls stays the owner of the camera: every frame it re-derives the pose from camera.position and controls.target (and
// viewer.ts's own flyMove moves both by one vector). So a LOOK turns the target about the eye at its current distance, and a WALK
// moves the eye and the target together. Nothing here touches the controls' internals or the scene; the caller marks the frame dirty.
// Live player only.
type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
type Rig = { camera: { position: V3 }; controls: { target: V3 } };

export const PITCH_LIMIT = 1.48;   // rad, 85 degrees: straight up or down leaves yaw undefined and flips OrbitControls' up vector

/** Turn the view about the eye. dYaw > 0 turns left (counter-clockwise from above); dPitch > 0 looks up. */
export function lookBy({ camera, controls }: Rig, dYaw: number, dPitch: number): void {
  const p = camera.position, t = controls.target;
  const x = t.x - p.x, y = t.y - p.y, z = t.z - p.z, len = Math.hypot(x, y, z) || 1;
  const yaw = Math.atan2(x, z) + dYaw, pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.asin(y / len) + dPitch));
  t.set(p.x + len * Math.sin(yaw) * Math.cos(pitch), p.y + len * Math.sin(pitch), p.z + len * Math.cos(yaw) * Math.cos(pitch));
}

/** The view's heading (yaw, as lookBy counts it) and pitch, in radians. */
export function poseOf({ camera, controls }: Rig): { yaw: number; pitch: number } {
  const p = camera.position, t = controls.target;
  const x = t.x - p.x, y = t.y - p.y, z = t.z - p.z, len = Math.hypot(x, y, z) || 1;
  return { yaw: Math.atan2(x, z), pitch: Math.asin(y / len) };
}

/** Move the eye and its target together: `fwd` along the heading on the ground plane, `right` across it, `up` straight up (all metres). */
export function walkBy({ camera, controls }: Rig, fwd: number, right: number, up = 0): void {
  const p = camera.position, t = controls.target;
  const hx = t.x - p.x, hz = t.z - p.z, h = Math.hypot(hx, hz);
  let dx = 0, dz = 0;
  if (h > 1e-4) { const fx = hx / h, fz = hz / h; dx = fx * fwd - fz * right; dz = fz * fwd + fx * right; }   // right = (-fz, fx)
  p.set(p.x + dx, p.y + up, p.z + dz);
  t.set(t.x + dx, t.y + up, t.z + dz);
}

/** Put the eye at (x, y, z), the target keeping its offset: a walk to a place. */
export function placeAt({ camera, controls }: Rig, x: number, y: number, z: number): void {
  const p = camera.position, t = controls.target;
  t.set(t.x + x - p.x, t.y + y - p.y, t.z + z - p.z);
  p.set(x, y, z);
}

/** A radial dead zone: the stick's reading with the centre cut out and the rest rescaled to 0..1. */
export function deadzone(x: number, y: number, dz: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * k, y * k];
}
