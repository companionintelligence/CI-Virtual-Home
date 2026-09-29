// Door leaves that open ahead of the eye (plan §3.2 `doors`, §3.9): for every hinged leaf the house says is shut
// (anchors.doors, S1's kit-build.ts collectDoors) that the camera's path goes through, a channel of the pivot's
// rotation.y per sample — closed until the eye is DOOR_LEAD_M from the doorway, swung open over DOOR_OPEN_S, and open
// DOOR_DONE_S before the eye reaches the leaf's line. THREE-free (the page applies the channel through visibility.ts
// shotPose(), room-creator.html's S5 slot), so QA v2 checks the same numbers in Node.
//
// A leaf is a segment in plan: the hinge and the free edge at the heading `closedYaw` (degrees, 0 = +z). The eye goes
// through a door when a step of its path crosses that segment (a leaf's ends widened by DOOR_SLACK, so the two leaves of
// a double door — each half the width, meeting at the middle — both count when the eye goes down the middle) at a height
// the leaf covers.
//
// Owner: S5 (shot).
import { clamp, leafSegment, type ShotWorld, type WDoor } from './shot-world.js';

export const DOOR_OPEN_S = 0.7;
export const DOOR_LEAD_M = 2.5;
export const DOOR_DONE_S = 0.4;
export const DOOR_SLACK = 0.2;

/** does the eye's step p → q (plan and height) cross the door's closed leaf? Returns the fraction along the step, or -1 */
export function stepCrossesLeaf(d: WDoor, p: [number, number, number], q: [number, number, number]): number {
  const { a, b, dir } = leafSegment(d), ax = a[0] - dir[0] * DOOR_SLACK, az = a[1] - dir[1] * DOOR_SLACK, bx = b[0] + dir[0] * DOOR_SLACK, bz = b[1] + dir[1] * DOOR_SLACK;
  const rx = bx - ax, rz = bz - az, sx = q[0] - p[0], sz = q[2] - p[2], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return -1;
  const u = ((p[0] - ax) * sz - (p[2] - az) * sx) / den, f = ((p[0] - ax) * rz - (p[2] - az) * rx) / den;
  if (u < 0 || u > 1 || f < 0 || f > 1) return -1;
  const y = p[1] + (q[1] - p[1]) * f;
  return y >= d.y0 - 0.2 && y <= d.y0 + d.h + 0.4 ? f : -1;
}

/** the first sample at which the eye path crosses the door's leaf line (i: the step i − 1 → i), or -1 */
export function firstCrossing(d: WDoor, pos: ArrayLike<number>, N: number): number {
  for (let i = 1; i < N; i++) {
    const f = stepCrossesLeaf(d, [pos[3 * i - 3], pos[3 * i - 2], pos[3 * i - 1]], [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
    if (f >= 0) return i;
  }
  return -1;
}

/** how open the leaf is: 0 at its closed angle, 1 at its open angle */
export const leafOpen = (d: WDoor, angle: number) => d.closedAngle === null || d.openAngle === null || d.openAngle === d.closedAngle ? 0 : clamp((angle - d.closedAngle) / (d.openAngle - d.closedAngle), 0, 1);

const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };

/** The channels: door id → the pivot's rotation.y at each of the N samples. Only a leaf that is shut in the house, can be posed
 *  (both its angles known) and lies on the eye's way gets one; every other leaf stays as the house built it. */
export function planDoors(world: ShotWorld, pos: ArrayLike<number>, N: number, dt: number): Record<string, Float32Array> {
  const out: Record<string, Float32Array> = {};
  for (const d of world.doors || []) {
    if (d.open || d.closedAngle === null || d.openAngle === null) continue;
    const ic = firstCrossing(d, pos, N);
    if (ic < 0) continue;
    // the eye's path back from the crossing: the moment it is DOOR_LEAD_M away along the path
    let ia = ic, run = 0;
    while (ia > 0 && run < DOOR_LEAD_M) { ia--; run += Math.hypot(pos[3 * ia + 3] - pos[3 * ia], pos[3 * ia + 4] - pos[3 * ia + 1], pos[3 * ia + 5] - pos[3 * ia + 2]); }
    const tc = ic * dt, dur = d.kind === 'entry' ? DOOR_OPEN_S + 0.2 : DOOR_OPEN_S;
    let t0 = Math.min(ia * dt, tc - DOOR_DONE_S - dur), span = dur;
    if (t0 < 0) { t0 = 0; span = Math.max(0.3, tc - DOOR_DONE_S); }   // a door the eye is nearly at from the start: as quick as it can be
    const ch = new Float32Array(N);
    for (let i = 0; i < N; i++) ch[i] = d.closedAngle + (d.openAngle - d.closedAngle) * smooth((i * dt - t0) / span);
    out[d.id] = ch;
  }
  return out;
}

/** the channel's value at a shot fraction (linear between samples), as the page's hook reads it */
export function doorAngleAt(ch: ArrayLike<number>, s: number): number {
  const N = ch.length, u = clamp(s, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(u)), f = u - i;
  return N < 2 ? ch[0] : ch[i] + (ch[i + 1] - ch[i]) * f;
}
