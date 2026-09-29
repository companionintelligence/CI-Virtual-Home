// Where the hero stands and which way it faces — the one place that turns `hero.at` / `hero.rot` into the frame the
// desk set is built in, THREE-free so anything that runs BEFORE the hero is built (the rooms loop of a storey, S3's
// composer reserving the hero surface plus its approach; the fixtures' keep-outs) reads the same numbers the hero
// block does, and a Node script can too.
//
// Spec convention: hero.rot is the heading the desk BACKS onto — rot 0 puts the monitor/wall side north (-Z) and the
// user south of it, rot 90 backs onto the west wall. The asset library's desk faces -Z at rotation 0, so the assets
// turn 180° from the spec heading; `fwd` — where the user sits and the camera approaches from — points into the room.
//
// Owner: S1 (kit), beside hero-build.ts, which builds from it. Frozen shape: add fields, never change these.
import { DEG } from './build-context.js';

export type HeroVec = [number, number];
export interface HeroFrame {
  level: string;
  /** hero.at: the desk (or surface) centre in plan */
  at: HeroVec;
  /** the assets' rotation.y, radians: (hero.rot + 180)° */
  rot: number;
  /** unit vector in plan: where the user sits, the camera comes from */
  fwd: HeroVec;
  /** unit vector to the right of the desk, seen from the user */
  side: HeroVec;
  /** hero.surface, default 'desk' */
  surface: string;
}

/** the hero's frame, or null for a spec without one */
export function heroFrame(hero: { level: string; at: number[]; rot?: number; surface?: string } | null | undefined): HeroFrame | null {
  if (!hero || !Array.isArray(hero.at)) return null;
  const rot = ((hero.rot || 0) + 180) * DEG;
  const fwd: HeroVec = [-Math.sin(rot), -Math.cos(rot)];
  return { level: hero.level, at: [hero.at[0], hero.at[1]], rot, fwd, side: [fwd[1], -fwd[0]], surface: hero.surface || 'desk' };
}
