// assets/xr/dress.ts : the house's dress for a person standing in it: walls up, the roof on from outside and off once under it, the ceilings of
// the storeys above the head hidden and those over it shown. The 2D player does this from its camera (viewer.ts flyDress); this does it from
// the HEAD, so a person who blinks through the front door has the roof lifted when they are inside and put back when they step out.
//
// It reuses what the page lends the player and nothing else: api.dress (applyShotCutaway) and api.houseInside. Walls are always 'up' (never
// 'sims': a per-wall cut keyed to a camera makes no sense for a head that is the viewpoint), the roof is 'off' when houseInside(head) and 'on'
// outside, and the ceilings follow the eye height as they do in a shot (hidden above the head's storey ceiling, shown below it).
//
// Cost. applyShotCutaway loops every ceiling, and setRoofOpacity traverses every roof mesh, on every call: affordable once, not every frame. It
// runs when (a) the head is inside or outside differently than at the last call, (b) a storey's ceiling height was crossed (the head went up a
// flight), (c) the head moved more than 0.3 m since the last call (a floor of safety: anything that touched visibility meanwhile is corrected
// in a few steps), or (d) forced: after a blink, and at the start. A static shadow map is told when the roof toggled (the sun now reaches
// the rooms, or does not), once, by renderer.shadowMap.needsUpdate (what XrBake.shadowNeedsUpdate sets).
import type { V3, XrFrame } from './host.js';
import type { ShotWorld } from '../shot-world.js';

export interface DressApi { dress(d: { walls: string; roof: string }, eye: any, target: any): void; houseInside(p: any): boolean }
export interface Dress {
  /** call each frame; does nothing unless one of the reasons above holds */
  tick(f: XrFrame): void;
  /** dress now for this head */
  now(head: V3, dir: V3): void;
  state(): { calls: number; inside: boolean | null; roof: 'on' | 'off' | null; sig: string };
  stop(): void;
}

/** the dressing a head calls for: pure, no scene (scripts/test-xr-nav.mts runs it) */
export function dressingFor(inside: boolean): { walls: 'up'; roof: 'on' | 'off' } { return { walls: 'up', roof: inside ? 'off' : 'on' }; }
/** which storeys' ceilings are above the head, as a string that changes exactly when a ceiling is crossed (the roof/ceiling dress depends on nothing else) */
export function ceilingSignature(world: ShotWorld | null, headY: number): string {
  if (!world) return '';
  let s = '';
  for (const l of world.levels) s += headY < l.y + l.h - 0.1 ? '1' : '0';
  return s;
}

export function createDress(d: { api: DressApi; world(): ShotWorld | null; renderer: any; onRoof?(roof: 'on' | 'off'): void }): Dress {
  let calls = 0, inside: boolean | null = null, roof: 'on' | 'off' | null = null, sig = '';
  let lastPos: V3 | null = null, stopped = false;

  function now(head: V3, dir: V3) {
    if (stopped) return;
    const eye = { x: head[0], y: head[1], z: head[2] };
    const target = { x: head[0] + dir[0], y: head[1] + dir[1], z: head[2] + dir[2] };   // one metre along the gaze
    const isIn = !!d.api.houseInside(eye);
    const dr = dressingFor(isIn);
    d.api.dress(dr, eye, target);
    calls++;
    sig = ceilingSignature(d.world(), head[1]);
    lastPos = [head[0], head[1], head[2]];
    if (roof !== dr.roof) {
      // the roof went on or off: the sun's static shadow map is stale
      if (d.renderer && d.renderer.shadowMap) d.renderer.shadowMap.needsUpdate = true;
      if (roof !== null) d.onRoof?.(dr.roof);
    }
    inside = isIn; roof = dr.roof;
  }
  function tick(f: XrFrame) {
    if (stopped) return;
    const p = f.head.pos;
    if (!lastPos) { now(p, f.head.dir); return; }
    const moved = Math.hypot(p[0] - lastPos[0], p[1] - lastPos[1], p[2] - lastPos[2]);
    const s = ceilingSignature(d.world(), p[1]);
    // houseInside is a handful of rectangle tests: asked every frame, so stepping through a door by hand-length moves still lifts the roof
    const isIn = !!d.api.houseInside({ x: p[0], y: p[1], z: p[2] });
    if (isIn !== inside || s !== sig || moved > 0.3) now(p, f.head.dir);
  }
  return { tick, now, state: () => ({ calls, inside, roof, sig }), stop() { stopped = true; } };
}
