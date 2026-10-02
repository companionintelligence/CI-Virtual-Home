// assets/xr/teleport.ts : pointing at the floor and going there. The aim maths is pure (no THREE, no DOM) so scripts/test-xr-nav.mts runs it in Node.
//
// How a person aims, by what they hold:
//   thumbstick controllers  push the stick forward: a parabolic arc leaves the controller; let go to go (squeeze cancels). Sideways is the snap
//                           turn (comfort.ts). The trigger is for panels and rings only, so a person reaching for a menu never teleports.
//   hands, gaze, transient  the straight ray against the floor plane (a pinch ray is the system's emulation, not a pointing finger, and an arc
//                           from it would curl away from where the person looks). Pinch and hold on the floor to aim, release to go; on visionOS the
//                           ray is born with the pinch, so a tap goes where the eyes were and a drag aims.
//   anything with a ray     panels (priority 100) and stair rings (50) are asked first: the floor is priority 0.
//
// A target is valid when nav.stand says so (a free cell with a body's clearance, not inside low furniture) and the straight walk from the
// head to it is clear (nav.walkFree): there is no pointing or teleporting through a wall. Nothing nearer than 0.5 m is a target either, which
// also keeps a pinch on the Exit chip (a card low in front of the person) from being a teleport. Going is XrRig.moveTo: the view fades to
// black, the rig moves on a black frame, the view fades back. No other way of moving the person exists in this module.
import type { RayHit, RayTarget, V3, XrFrame, XrInput, XrRig } from './host.js';
import type { XrNav, StandCheck } from './nav.js';

export const AIM = { speed: 10, gravity: 9.8, steps: 32, maxT: 2.4, maxRange: 14, rayRange: 12, minGo: 0.5, stickOn: 0.6, stickOff: 0.3, stickSide: 0.55 };

export interface Aim {
  source: number; mode: 'arc' | 'ray';
  /** the line to draw: from the hand to the floor (or as far as the arc went) */
  points: V3[];
  /** where it met the plane, null when it never did (pointing up at the sky, out of range) */
  hit: V3 | null;
  target: StandCheck | null; ok: boolean;
  why: 'ok' | 'no-hit' | 'no-floor' | 'blocked' | 'tight' | 'low-furniture' | 'wall' | 'near';
}

/** the parabola of a thrown point: origin + dir*speed*t - g t^2/2 down, cut where it crosses the plane y = planeY (descending). Pure. */
export function aimArc(origin: V3, dir: V3, planeY: number, o: Partial<typeof AIM> = {}): { points: V3[]; hit: V3 | null } {
  const a = { ...AIM, ...o };
  const pts: V3[] = [[origin[0], origin[1], origin[2]]];
  const dt = a.maxT / a.steps;
  let px = origin[0], py = origin[1], pz = origin[2];
  if (py <= planeY) return { points: pts, hit: null };
  for (let k = 1; k <= a.steps; k++) {
    const t = k * dt;
    const x = origin[0] + dir[0] * a.speed * t, z = origin[2] + dir[2] * a.speed * t, y = origin[1] + dir[1] * a.speed * t - 0.5 * a.gravity * t * t;
    if (Math.hypot(x - origin[0], z - origin[2]) > a.maxRange) return { points: pts, hit: null };
    if (y <= planeY) {
      const f = (py - planeY) / (py - y || 1);
      const hit: V3 = [px + (x - px) * f, planeY, pz + (z - pz) * f];
      pts.push(hit);
      return { points: pts, hit };
    }
    pts.push([x, y, z]); px = x; py = y; pz = z;
  }
  return { points: pts, hit: null };
}
/** the straight ray against the plane y = planeY, within range (it must point down). Pure. */
export function aimRay(origin: V3, dir: V3, planeY: number, o: Partial<typeof AIM> = {}): { points: V3[]; hit: V3 | null } {
  const a = { ...AIM, ...o };
  if (dir[1] > -0.03 || origin[1] <= planeY) return { points: [origin, [origin[0] + dir[0] * 2, origin[1] + dir[1] * 2, origin[2] + dir[2] * 2]], hit: null };
  const t = (planeY - origin[1]) / dir[1];
  const hit: V3 = [origin[0] + dir[0] * t, planeY, origin[2] + dir[2] * t];
  if (Math.hypot(hit[0] - origin[0], hit[2] - origin[2]) > a.rayRange) return { points: [origin, hit], hit: null };
  return { points: [origin, hit], hit };
}

/** judge an aimed hit: can the person go there from `from` (the head in plan, the feet's y) */
export function judge(nav: XrNav | null, from: V3, feetY: number, hit: V3 | null): { target: StandCheck | null; ok: boolean; why: Aim['why'] } {
  if (!hit) return { target: null, ok: false, why: 'no-hit' };
  if (!nav) return { target: null, ok: false, why: 'no-floor' };
  const t = nav.stand(hit[0], hit[2], feetY);
  if (!t.ok) return { target: t, ok: false, why: t.why === 'ok' ? 'blocked' : t.why };
  if (Math.hypot(t.x - from[0], t.z - from[2]) < AIM.minGo) return { target: t, ok: false, why: 'near' };
  if (!nav.walkFree(from[0], from[2], t.x, t.z, feetY)) return { target: t, ok: false, why: 'wall' };
  return { target: t, ok: true, why: 'ok' };
}

export interface AimView { show(a: Aim | null): void }
export interface TeleportDeps {
  input: XrInput; rig: XrRig; nav(): XrNav | null; view: AimView;
  /** is a blink in flight (XrRigImpl.busy): nothing new is started until it lands */
  busy?(): boolean;
  /** does this source steer by stick for something else right now (continuous movement on the left stick) */
  stickBusy?(sourceId: number): boolean;
  onGo?(t: StandCheck): void; onRefuse?(a: Aim): void;
}
export interface Teleport {
  tick(f: XrFrame): void;
  /** the floor as a RayTarget (priority 0), for sources that aim by pinch or trigger */
  floor: RayTarget;
  state(): { aiming: boolean; source: number | null; last: Aim | null; went: number };
  /** go to a stand now (what a release does); false when the rig is busy */
  go(t: StandCheck, yawDeg?: number): boolean;
  stop(): void;
}

export function createTeleport(d: TeleportDeps): Teleport {
  let aim: Aim | null = null, by: number | null = null, via: 'stick' | 'press' | null = null, went = 0, last: Aim | null = null, headNow: V3 = [0, 0, 0];
  const stickReady = new Set<number>();   // sources whose stick came back to rest since their last go (so a held stick does not re-aim at once)

  function compute(source: number, ray: { origin: V3; dir: V3 }, arc: boolean): Aim {
    const feetY = d.rig.floorY(), nav = d.nav();
    const r = arc ? aimArc(ray.origin, ray.dir, feetY) : aimRay(ray.origin, ray.dir, feetY);
    const j = judge(nav, headNow, feetY, r.hit);
    return { source, mode: arc ? 'arc' : 'ray', points: r.points, hit: r.hit, target: j.target, ok: j.ok, why: j.why };
  }
  function go(t: StandCheck, yawDeg?: number): boolean {
    if (d.busy && d.busy()) return false;
    void d.rig.moveTo({ feet: [t.x, t.y, t.z], ...(yawDeg === undefined ? {} : { yawDeg }) });
    went++; d.onGo?.(t);
    return true;
  }
  function end(commit: boolean) {
    const a = aim, src = by;
    aim = null; by = null; via = null; d.view.show(null);
    if (!a || !commit) return;
    if (a.ok && a.target) { if (!go(a.target) && src !== null) d.input.haptic(src, 0.1, 15); }
    else { if (src !== null) d.input.haptic(src, 0.3, 40); d.onRefuse?.(a); }
  }

  const floor: RayTarget = {
    id: 'xr-floor', priority: 0, enabled: true,
    hit(ray) {
      const y = d.rig.floorY();
      if (ray.dir[1] > -0.03 || ray.origin[1] <= y) return null;
      const t = (y - ray.origin[1]) / ray.dir[1];
      if (t > AIM.rayRange * 2) return null;
      return { dist: t, point: [ray.origin[0] + ray.dir[0] * t, y, ray.origin[2] + ray.dir[2] * t] } as RayHit;
    },
    onPress(sourceId) {
      const info = d.input.sources().find(s => s.id === sourceId);
      // a stick controller has the stick for this; its trigger never teleports
      if (!info || (info.hasThumbstick && !info.isHand) || aim || (d.busy && d.busy())) return;
      by = sourceId; via = 'press';
      const ray = d.input.rayPose(sourceId); if (ray) { aim = compute(sourceId, ray, false); d.view.show(aim); }
    },
    onRelease(sourceId, _hit, cancelled) {
      if (by !== sourceId || via !== 'press') return;
      // the pose of THIS frame (input.update has just moved it), not the last tick's
      const ray = d.input.rayPose(sourceId);
      if (ray && !cancelled) { aim = compute(sourceId, ray, false); last = aim; }
      end(!cancelled);
    },
  };

  function tick(f: XrFrame) {
    headNow = f.head.pos;
    const busy = d.busy ? d.busy() : false;
    // ---- stick controllers
    for (const info of d.input.sources()) {
      if (!info.hasThumbstick || info.isHand) continue;
      const ax = d.input.axes(info.id); if (!ax) continue;
      const fwd = -ax[1];
      if (!stickReady.has(info.id) && Math.abs(ax[0]) < AIM.stickOff && Math.abs(ax[1]) < AIM.stickOff) stickReady.add(info.id);
      if (via === 'stick' && by === info.id) {
        const sq = d.input.button(info.id, 'squeeze');
        if (sq && sq.pressed) { end(false); stickReady.delete(info.id); continue; }
        if (fwd < AIM.stickOff) {
          // let go: the aim of the last frame is the one the person saw; commit it
          end(true); stickReady.delete(info.id);
        } else {
          const ray = d.input.rayPose(info.id);
          if (ray) { aim = compute(info.id, ray, true); last = aim; d.view.show(aim); } else end(false);
        }
      } else if (!aim && !busy && fwd > AIM.stickOn && Math.abs(ax[0]) < AIM.stickSide && stickReady.has(info.id) && !(d.stickBusy && d.stickBusy(info.id))) {
        const ray = d.input.rayPose(info.id);
        if (ray) { by = info.id; via = 'stick'; aim = compute(info.id, ray, true); last = aim; d.view.show(aim); }
      }
    }
    // ---- pinch / trigger aims: keep the line following the hand
    if (via === 'press' && by !== null) {
      const ray = d.input.rayPose(by);
      if (ray) { aim = compute(by, ray, false); last = aim; d.view.show(aim); } else end(false);
    }
  }
  return {
    tick, floor, go,
    state: () => ({ aiming: !!aim, source: by, last, went }),
    stop() { aim = null; by = null; via = null; d.view.show(null); },
  };
}
