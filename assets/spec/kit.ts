// HouseSpec fragment for S1 (kit): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S1: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// Planned here (plan contract):
//   - spec.defaults: 2 look switch consumers; `lighting: {preset, sunBearing}` (Completeness A1 — widens BaseHouseSpec.lighting)
//   - palette.door, palette.restraint, palette.keep, palette.roofPull
//   - levels[].material (and wallColor honoured per level)
//   - openings[].leaf | transom | frame | grid | lantern; partitions[].doorColor | doorStyle
//   - rooms[].fixtures: {fan, pendants, ceiling, lamp}
//   - hero.surface (widened), surfaceColor, desk, monitor, chair: {kind, pose} (Completeness C1: S1 owns hero.chair; S5 reads pose)
//   - page-builder item params: style, chairs, …

export interface KitSpec {}
export interface KitLot {}
export interface KitPalette {}
export interface KitLevel {}
export interface KitFootprintRect {}
export interface KitOpening {}
export interface KitPartition {}
export interface KitStairs {}
export interface KitBalustrade {}
export interface KitRoom {}
export interface KitRoomItem {}
export interface KitRoof {}
export interface KitSiteItem {}
export interface KitHero {}
export interface KitEntry {}
export interface KitShot {}
