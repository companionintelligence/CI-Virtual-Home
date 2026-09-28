// HouseSpec fragment for S4 (site): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S4: edit only this file.
//
// Planned here (plan contract):
//   - site items: planting {kind, along, depth, layers, mix, density, bloom}; smooth; path.surface; bed.edge; species kinds; pool.shape | coping; fence.style; stair; terrace (A3)
//   - lot.street | context | setback | water | ground (widened)

export interface SiteSpec {}
export interface SiteLot {}
export interface SitePalette {}
export interface SiteLevel {}
export interface SiteOpening {}
export interface SitePartition {}
export interface SiteStairs {}
export interface SiteBalustrade {}
export interface SiteRoom {}
export interface SiteRoomItem {}
export interface SiteRoof {}
export interface SiteSiteItem {}
export interface SiteHero {}
export interface SiteEntry {}
export interface SiteShot {}
