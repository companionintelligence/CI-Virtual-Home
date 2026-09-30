// HouseSpec fragment for S5 (shot): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them keeps today's look, apart from the fixes declared in test/goldens/expected-diffs/). Owned by S5: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// What is here (plan §3.16; reference/HOUSE-SPEC.md → Shots):
//   - spec.showcase: rooms (name or number) and item types worth a film's time — the planner v2 route detours to them
//     and their interest doubles
//   - shots[].planner ('v1' | 'v2'), duration ('auto' widens the base's number), establish, via, beats, route
//   - hero.view: {azimuth, dist, height} — the finale's eye, overriding the ring search
// hero.chair is S1's ({kind, pose}, Completeness C1): planner v2 reads its pose and never redeclares it.

/** the establishing shot's style, or an explicit pose: `bearing` off the door's axis (degrees, + toward the house's right as
 *  the street sees it), `height` of the eye (m) and `dist` from the facade (m; 0 or absent: as far as the frame needs) */
export type EstablishSpec = 'auto' | 'axial' | 'corner-left' | 'corner-right' | 'garden' | 'dollhouse' | { bearing?: number; height?: number; dist?: number };
/** the beats of a planner-v2 film, in order (assets/shot-planner.ts BEATS) */
export type BeatName = 'establish' | 'extStair' | 'approach' | 'threshold' | 'reveal' | 'route' | 'stair' | 'descend' | 'roomReveal' | 'hero' | 'orbit' | 'power';

export interface ShotsSpec {
  showcase?: string[];
}
export interface ShotsLot {}
export interface ShotsPalette {}
export interface ShotsLevel {}
export interface ShotsFootprintRect {}
export interface ShotsOpening {}
export interface ShotsPartition {}
export interface ShotsStairs {}
export interface ShotsBalustrade {}
export interface ShotsRoom {}
export interface ShotsRoomItem {}
export interface ShotsRoof {}
export interface ShotsSiteItem {}
export interface ShotsHero {
  /** the finale's eye, overriding the search: `azimuth` off the Core's front (degrees, + toward its right side), `dist` from
   *  the Core (m) and `height` over its top (m) — the orbit ends there when the room lets it */
  view?: { azimuth?: number; dist?: number; height?: number };
}
export interface ShotsEntry {}
export interface ShotsShot {
  /** 'v2' plans this shot on the beat-timed spline planner (door-to-core, hero-reveal, walkthrough); absent: the page's
   *  switch (?planner=v2), else 'v1' */
  planner?: 'v1' | 'v2';
  /** seconds, or 'auto': the walk at its caps plus a breath (planner v2; widens the base's number) */
  duration?: number | 'auto';
  establish?: EstablishSpec;
  /** rooms (name or number) the route passes through, in order */
  via?: string[];
  /** seconds a beat is held to at least, by beat name */
  beats?: Partial<Record<BeatName, number>>;
  route?: 'auto' | 'scenic' | 'shortest';
}
