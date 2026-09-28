// HouseSpec fragment for S5 (shot): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S5: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// Planned here (plan contract):
//   - spec.showcase; shots[].planner | duration "auto" | establish | via | beats | route
//   - hero.view: {azimuth, dist, height}

export interface ShotsSpec {}
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
export interface ShotsHero {}
export interface ShotsEntry {}
export interface ShotsShot {}
