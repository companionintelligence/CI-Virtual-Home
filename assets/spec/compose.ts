// HouseSpec fragment for S3 (compose): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S3: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// Planned here (plan contract):
//   - rooms[].program (C2: the ONE room-type field; S1's roomKind() maps it) | focus | density | style | palette | seed | kitchen | bath | lock
//   - spec.styleKey; items[].src ("compose@1")

export interface ComposeSpec {}
export interface ComposeLot {}
export interface ComposePalette {}
export interface ComposeLevel {}
export interface ComposeFootprintRect {}
export interface ComposeOpening {}
export interface ComposePartition {}
export interface ComposeStairs {}
export interface ComposeBalustrade {}
export interface ComposeRoom {}
export interface ComposeRoomItem {}
export interface ComposeRoof {}
export interface ComposeSiteItem {}
export interface ComposeHero {}
export interface ComposeEntry {}
export interface ComposeShot {}
