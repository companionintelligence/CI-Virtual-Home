// HouseSpec — the full type, merged from the base (what is honoured today) and one fragment per stream:
//
//   base.ts     S0  HouseSpec v1 as reference/HOUSE-SPEC.md documents it
//   kit.ts      S1  doors, palette, per-level cladding, fixtures, hero surfaces, lighting
//   arch.ts     S2  room finishes, facades, roofs, opening dressing, features, stairs, sections
//   compose.ts  S3  room programs and the composer's inputs
//   site.ts     S4  planting, curves, hardscape, water, fences, lot and world
//   shots.ts    S5  showcase, planner v2 knobs, hero view
//
// Each part (Level, Room, Opening …) extends the base part and every stream's fragment of it, so a field two
// streams both declare with different types is a compile error here (plan Completeness C1–C3) rather than a
// silent disagreement at run time. Nested arrays are composed here, from the merged parts.
//
// Also the one reader of `spec.defaults` (specDefaults), so no module compares the raw field itself.
// Owned by S0 and frozen.
import type {
  BaseHouseSpec, BaseLot, BasePalette, BaseLevel, BaseOpening, BasePartition, BaseStairs, BaseBalustrade, BaseRoom, BaseItem,
  BaseRoof, BaseSiteItem, BaseHero, BaseEntry, BaseShot
} from './base.js';
import type { KitSpec, KitLot, KitPalette, KitLevel, KitOpening, KitPartition, KitStairs, KitBalustrade, KitRoom, KitRoomItem, KitRoof, KitSiteItem, KitHero, KitEntry, KitShot } from './kit.js';
import type { ArchSpec, ArchLot, ArchPalette, ArchLevel, ArchOpening, ArchPartition, ArchStairs, ArchBalustrade, ArchRoom, ArchRoomItem, ArchRoof, ArchSiteItem, ArchHero, ArchEntry, ArchShot } from './arch.js';
import type { ComposeSpec, ComposeLot, ComposePalette, ComposeLevel, ComposeOpening, ComposePartition, ComposeStairs, ComposeBalustrade, ComposeRoom, ComposeRoomItem, ComposeRoof, ComposeSiteItem, ComposeHero, ComposeEntry, ComposeShot } from './compose.js';
import type { SiteSpec, SiteLot, SitePalette, SiteLevel, SiteOpening, SitePartition, SiteStairs, SiteBalustrade, SiteRoom, SiteRoomItem, SiteRoof, SiteSiteItem, SiteHero, SiteEntry, SiteShot } from './site.js';
import type { ShotsSpec, ShotsLot, ShotsPalette, ShotsLevel, ShotsOpening, ShotsPartition, ShotsStairs, ShotsBalustrade, ShotsRoom, ShotsRoomItem, ShotsRoof, ShotsSiteItem, ShotsHero, ShotsEntry, ShotsShot } from './shots.js';

export type { Vec2, Rect, Side, Colour } from './base.js';

export interface Lot extends BaseLot, KitLot, ArchLot, ComposeLot, SiteLot, ShotsLot {}
export interface Palette extends BasePalette, KitPalette, ArchPalette, ComposePalette, SitePalette, ShotsPalette {}
export interface Opening extends BaseOpening, KitOpening, ArchOpening, ComposeOpening, SiteOpening, ShotsOpening {}
export interface Partition extends BasePartition, KitPartition, ArchPartition, ComposePartition, SitePartition, ShotsPartition {}
export interface Stairs extends BaseStairs, KitStairs, ArchStairs, ComposeStairs, SiteStairs, ShotsStairs {}
export interface Balustrade extends BaseBalustrade, KitBalustrade, ArchBalustrade, ComposeBalustrade, SiteBalustrade, ShotsBalustrade {}
export interface RoomItem extends BaseItem, KitRoomItem, ArchRoomItem, ComposeRoomItem, SiteRoomItem, ShotsRoomItem {}
export type Item = RoomItem;
export interface Roof extends BaseRoof, KitRoof, ArchRoof, ComposeRoof, SiteRoof, ShotsRoof {}
export interface SiteItem extends BaseSiteItem, KitSiteItem, ArchSiteItem, ComposeSiteItem, SiteSiteItem, ShotsSiteItem {}
export interface Hero extends BaseHero, KitHero, ArchHero, ComposeHero, SiteHero, ShotsHero {}
export interface Entry extends BaseEntry, KitEntry, ArchEntry, ComposeEntry, SiteEntry, ShotsEntry {}
export interface Shot extends BaseShot, KitShot, ArchShot, ComposeShot, SiteShot, ShotsShot {}

export interface Room extends BaseRoom, KitRoom, ArchRoom, ComposeRoom, SiteRoom, ShotsRoom {
  items?: RoomItem[];
}

export interface Level extends BaseLevel, KitLevel, ArchLevel, ComposeLevel, SiteLevel, ShotsLevel {
  openings?: Opening[];
  partitions?: Partition[];
  stairs?: Stairs;
  balustrades?: Balustrade[];
  rooms?: Room[];
}

export interface HouseSpec extends BaseHouseSpec, KitSpec, ArchSpec, ComposeSpec, SiteSpec, ShotsSpec {
  lot: Lot;
  palette: Palette;
  levels: Level[];
  roofs?: Roof[];
  site?: SiteItem[];
  hero: Hero;
  entry: Entry;
  shots?: Shot[];
}

// ---- the look switch (plan §2.0) -----------------------------------------------------------------------------
// Look-changing defaults (door colour, fans, lamps, gutters, gable windows, lanterns, world variety, restraint)
// switch on only under `defaults: 2`; a spec without the field is generation 1 and renders exactly as before.
export type DefaultsGeneration = 1 | 2;
export const DEFAULTS_GENERATIONS: readonly DefaultsGeneration[] = [1, 2];

/** The generation of defaults a spec opts into: 1 unless it says `defaults: 2`. Anything else is 1 (the validator
 *  rejects it). */
export function specDefaults(spec: { defaults?: unknown } | null | undefined): DefaultsGeneration {
  return spec && spec.defaults === 2 ? 2 : 1;
}

/** Does this spec opt into generation `gen`'s defaults (or a later one)? `if (defaultsAtLeast(spec, 2)) …` */
export function defaultsAtLeast(spec: { defaults?: unknown } | null | undefined, gen: DefaultsGeneration): boolean {
  return specDefaults(spec) >= gen;
}
