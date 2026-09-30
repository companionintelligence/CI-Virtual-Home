// HouseSpec — the full type, merged from the base (what is honoured today) and one fragment per stream:
//
//   base.ts     S0  HouseSpec v1 as reference/HOUSE-SPEC.md documents it
//   kit.ts      S1  doors, palette, per-level cladding, fixtures, hero surfaces, lighting
//   arch.ts     S2  room finishes, facades, roofs, opening dressing, features, stairs, sections
//   compose.ts  S3  room programs and the composer's inputs
//   site.ts     S4  planting, curves, hardscape, water, fences, lot and world
//   shots.ts    S5  showcase, planner v2 knobs, hero view
//
// How the parts merge (Level, Room, Opening …):
//   - A field only one fragment declares is added.
//   - A field a fragment declares that base.ts (or the composition below — levels, rooms, stairs …) also declares
//     REPLACES the base's: that is how a stream widens one (`lighting: string` → `string | {preset, sunBearing}`,
//     `stairs: Stairs` → `Stairs | Stairs[]`) without editing base.ts. It may only widen: `OnlyWidens` below fails
//     the compile, naming the field, when every value the base allows is not still allowed.
//   - A field two fragments both declare is a compile error whatever the types (plan Completeness C1–C3): the two
//     streams settle it, one of them owns it. Different types fail as TS2320 ("cannot simultaneously extend");
//     the SAME type is legal TypeScript, so `OnlyOne` below fails it instead, naming the field
//     (`Type '"chair"' does not satisfy the constraint 'never'`; the line says which part).
//   - Room items and site items also take builder-specific parameters no fragment declares (an index signature,
//     added here to RoomItem and SiteItem): a field a fragment DECLARES is typed and checked like any other;
//     an undeclared one is accepted, untyped. Declare yours anyway: the fragment is the list of what the builders honour.
// A fragment that needs a composed type (Stairs, Room, Opening …) imports it from here: `import type { Stairs } from
// './index.js'` (type-only, so the cycle is fine).
//
// Also the one reader of `spec.defaults` (specDefaults), so no module compares the raw field itself.
// Owned by S0 and frozen.
import type {
  BaseHouseSpec, BaseLot, BasePalette, BaseLevel, BaseFootprintRect, BaseOpening, BasePartition, BaseStairs, BaseBalustrade, BaseRoom,
  BaseItem, BaseRoof, BaseSiteItem, BaseHero, BaseEntry, BaseShot
} from './base.js';
import type { KitSpec, KitLot, KitPalette, KitLevel, KitFootprintRect, KitOpening, KitPartition, KitStairs, KitBalustrade, KitRoom, KitRoomItem, KitRoof, KitSiteItem, KitHero, KitEntry, KitShot } from './kit.js';
import type { ArchSpec, ArchLot, ArchPalette, ArchLevel, ArchFootprintRect, ArchOpening, ArchPartition, ArchStairs, ArchBalustrade, ArchRoom, ArchRoomItem, ArchRoof, ArchSiteItem, ArchHero, ArchEntry, ArchShot } from './arch.js';
import type { ComposeSpec, ComposeLot, ComposePalette, ComposeLevel, ComposeFootprintRect, ComposeOpening, ComposePartition, ComposeStairs, ComposeBalustrade, ComposeRoom, ComposeRoomItem, ComposeRoof, ComposeSiteItem, ComposeHero, ComposeEntry, ComposeShot } from './compose.js';
import type { SiteSpec, SiteLot, SitePalette, SiteLevel, SiteFootprintRect, SiteOpening, SitePartition, SiteStairs, SiteBalustrade, SiteRoom, SiteRoomItem, SiteRoof, SiteSiteItem, SiteHero, SiteEntry, SiteShot } from './site.js';
import type { ShotsSpec, ShotsLot, ShotsPalette, ShotsLevel, ShotsFootprintRect, ShotsOpening, ShotsPartition, ShotsStairs, ShotsBalustrade, ShotsRoom, ShotsRoomItem, ShotsRoof, ShotsSiteItem, ShotsHero, ShotsEntry, ShotsShot } from './shots.js';

export type { Vec2, Rect, Side, Colour } from './base.js';

// ---- the merge rule ------------------------------------------------------------------------------------------
/** the fields any of the five fragments of one part declares */
type Declared<A, B, C, D, E> = keyof A | keyof B | keyof C | keyof D | keyof E;
/** the fields a type declares by name — an index signature (site and room items keep one: `[param: string]: unknown`)
 *  is not a declaration, so a fragment adding a typed item param adds a field rather than "narrowing unknown" */
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] };
/** the base's fields a fragment redeclares NARROWER than the base (never, when it only widens or adds) */
type Narrowed<Base, F> = { [K in KnownKeys<Base> & keyof F]-?: [Base[K]] extends [F[K]] ? never : K }[KnownKeys<Base> & keyof F];
/** compiles only when T is never: `Type '"surface"' does not satisfy the constraint 'never'` names the field */
type OnlyWidens<T extends never> = T;
type Narrowed5<Base, A, B, C, D, E> = Narrowed<Base, A> | Narrowed<Base, B> | Narrowed<Base, C> | Narrowed<Base, D> | Narrowed<Base, E>;
/** the fields two of the five fragments both declare (never, when each field has one owner) */
type Overlap5<A, B, C, D, E> =
  | (keyof A & keyof B) | (keyof A & keyof C) | (keyof A & keyof D) | (keyof A & keyof E)
  | (keyof B & keyof C) | (keyof B & keyof D) | (keyof B & keyof E)
  | (keyof C & keyof D) | (keyof C & keyof E) | (keyof D & keyof E);
/** compiles only when T is never: a field two fragments both declare fails here, naming it */
type OnlyOne<T extends never> = T;

// ---- flat parts ----------------------------------------------------------------------------------------------
type LotF = Declared<KitLot, ArchLot, ComposeLot, SiteLot, ShotsLot>;
export interface Lot extends Omit<BaseLot, LotF>, KitLot, ArchLot, ComposeLot, SiteLot, ShotsLot {}
type PaletteF = Declared<KitPalette, ArchPalette, ComposePalette, SitePalette, ShotsPalette>;
export interface Palette extends Omit<BasePalette, PaletteF>, KitPalette, ArchPalette, ComposePalette, SitePalette, ShotsPalette {}
type FootprintRectF = Declared<KitFootprintRect, ArchFootprintRect, ComposeFootprintRect, SiteFootprintRect, ShotsFootprintRect>;
/** one rect of a storey's footprint (a volume: S2 gives it a material and a colour) */
export interface FootprintRect extends Omit<BaseFootprintRect, FootprintRectF>, KitFootprintRect, ArchFootprintRect, ComposeFootprintRect, SiteFootprintRect, ShotsFootprintRect {}
type OpeningF = Declared<KitOpening, ArchOpening, ComposeOpening, SiteOpening, ShotsOpening>;
export interface Opening extends Omit<BaseOpening, OpeningF>, KitOpening, ArchOpening, ComposeOpening, SiteOpening, ShotsOpening {}
type PartitionF = Declared<KitPartition, ArchPartition, ComposePartition, SitePartition, ShotsPartition>;
export interface Partition extends Omit<BasePartition, PartitionF>, KitPartition, ArchPartition, ComposePartition, SitePartition, ShotsPartition {}
type StairsF = Declared<KitStairs, ArchStairs, ComposeStairs, SiteStairs, ShotsStairs>;
export interface Stairs extends Omit<BaseStairs, StairsF>, KitStairs, ArchStairs, ComposeStairs, SiteStairs, ShotsStairs {}
type BalustradeF = Declared<KitBalustrade, ArchBalustrade, ComposeBalustrade, SiteBalustrade, ShotsBalustrade>;
export interface Balustrade extends Omit<BaseBalustrade, BalustradeF>, KitBalustrade, ArchBalustrade, ComposeBalustrade, SiteBalustrade, ShotsBalustrade {}
type RoomItemF = Declared<KitRoomItem, ArchRoomItem, ComposeRoomItem, SiteRoomItem, ShotsRoomItem>;
export interface RoomItem extends Omit<BaseItem, RoomItemF>, KitRoomItem, ArchRoomItem, ComposeRoomItem, SiteRoomItem, ShotsRoomItem {
  /** the page builder's own parameters (`style`, `chairs`, `n` …): loose on purpose, see the header */
  [param: string]: unknown;
}
export type Item = RoomItem;
type RoofF = Declared<KitRoof, ArchRoof, ComposeRoof, SiteRoof, ShotsRoof>;
export interface Roof extends Omit<BaseRoof, RoofF>, KitRoof, ArchRoof, ComposeRoof, SiteRoof, ShotsRoof {}
type SiteItemF = Declared<KitSiteItem, ArchSiteItem, ComposeSiteItem, SiteSiteItem, ShotsSiteItem>;
export interface SiteItem extends Omit<BaseSiteItem, SiteItemF>, KitSiteItem, ArchSiteItem, ComposeSiteItem, SiteSiteItem, ShotsSiteItem {
  /** the site builder's own parameters: loose on purpose, see the header */
  [param: string]: unknown;
}
type HeroF = Declared<KitHero, ArchHero, ComposeHero, SiteHero, ShotsHero>;
export interface Hero extends Omit<BaseHero, HeroF>, KitHero, ArchHero, ComposeHero, SiteHero, ShotsHero {}
type EntryF = Declared<KitEntry, ArchEntry, ComposeEntry, SiteEntry, ShotsEntry>;
export interface Entry extends Omit<BaseEntry, EntryF>, KitEntry, ArchEntry, ComposeEntry, SiteEntry, ShotsEntry {}
type ShotF = Declared<KitShot, ArchShot, ComposeShot, SiteShot, ShotsShot>;
export interface Shot extends Omit<BaseShot, ShotF>, KitShot, ArchShot, ComposeShot, SiteShot, ShotsShot {}

// ---- composed parts: the nested arrays, built from the merged parts (a fragment may widen these too) -----------
interface RoomParts { items?: RoomItem[] }
type RoomF = Declared<KitRoom, ArchRoom, ComposeRoom, SiteRoom, ShotsRoom>;
export interface Room extends Omit<BaseRoom, keyof RoomParts | RoomF>, Omit<RoomParts, RoomF>, KitRoom, ArchRoom, ComposeRoom, SiteRoom, ShotsRoom {}

interface LevelParts {
  footprint: FootprintRect[];
  openings?: Opening[];
  partitions?: Partition[];
  /** one flight up from this storey (S2 widens it to an array: plan Completeness A2) */
  stairs?: Stairs;
  balustrades?: Balustrade[];
  rooms?: Room[];
}
type LevelF = Declared<KitLevel, ArchLevel, ComposeLevel, SiteLevel, ShotsLevel>;
export interface Level extends Omit<BaseLevel, keyof LevelParts | LevelF>, Omit<LevelParts, LevelF>, KitLevel, ArchLevel, ComposeLevel, SiteLevel, ShotsLevel {}

interface HouseParts {
  lot: Lot;
  palette: Palette;
  levels: Level[];
  roofs?: Roof[];
  site?: SiteItem[];
  hero: Hero;
  entry: Entry;
  shots?: Shot[];
}
type HouseF = Declared<KitSpec, ArchSpec, ComposeSpec, SiteSpec, ShotsSpec>;
export interface HouseSpec extends Omit<BaseHouseSpec, keyof HouseParts | HouseF>, Omit<HouseParts, HouseF>, KitSpec, ArchSpec, ComposeSpec, SiteSpec, ShotsSpec {}

// ---- widening only (see the rule above): each line fails the compile, naming the field, if a fragment narrows ---
export type _WidensOnly = [
  OnlyWidens<Narrowed5<BaseLot, KitLot, ArchLot, ComposeLot, SiteLot, ShotsLot>>,
  OnlyWidens<Narrowed5<BasePalette, KitPalette, ArchPalette, ComposePalette, SitePalette, ShotsPalette>>,
  OnlyWidens<Narrowed5<BaseFootprintRect, KitFootprintRect, ArchFootprintRect, ComposeFootprintRect, SiteFootprintRect, ShotsFootprintRect>>,
  OnlyWidens<Narrowed5<BaseOpening, KitOpening, ArchOpening, ComposeOpening, SiteOpening, ShotsOpening>>,
  OnlyWidens<Narrowed5<BasePartition, KitPartition, ArchPartition, ComposePartition, SitePartition, ShotsPartition>>,
  OnlyWidens<Narrowed5<BaseStairs, KitStairs, ArchStairs, ComposeStairs, SiteStairs, ShotsStairs>>,
  OnlyWidens<Narrowed5<BaseBalustrade, KitBalustrade, ArchBalustrade, ComposeBalustrade, SiteBalustrade, ShotsBalustrade>>,
  OnlyWidens<Narrowed5<BaseItem, KitRoomItem, ArchRoomItem, ComposeRoomItem, SiteRoomItem, ShotsRoomItem>>,
  OnlyWidens<Narrowed5<BaseRoof, KitRoof, ArchRoof, ComposeRoof, SiteRoof, ShotsRoof>>,
  OnlyWidens<Narrowed5<BaseSiteItem, KitSiteItem, ArchSiteItem, ComposeSiteItem, SiteSiteItem, ShotsSiteItem>>,
  OnlyWidens<Narrowed5<BaseHero, KitHero, ArchHero, ComposeHero, SiteHero, ShotsHero>>,
  OnlyWidens<Narrowed5<BaseEntry, KitEntry, ArchEntry, ComposeEntry, SiteEntry, ShotsEntry>>,
  OnlyWidens<Narrowed5<BaseShot, KitShot, ArchShot, ComposeShot, SiteShot, ShotsShot>>,
  OnlyWidens<Narrowed5<Omit<BaseRoom, keyof RoomParts> & RoomParts, KitRoom, ArchRoom, ComposeRoom, SiteRoom, ShotsRoom>>,
  OnlyWidens<Narrowed5<Omit<BaseLevel, keyof LevelParts> & LevelParts, KitLevel, ArchLevel, ComposeLevel, SiteLevel, ShotsLevel>>,
  OnlyWidens<Narrowed5<Omit<BaseHouseSpec, keyof HouseParts> & HouseParts, KitSpec, ArchSpec, ComposeSpec, SiteSpec, ShotsSpec>>,
];

// ---- one owner a field: each line fails the compile, naming the field, if two fragments declare it ----------------
export type _OneOwner = [
  OnlyOne<Overlap5<KitLot, ArchLot, ComposeLot, SiteLot, ShotsLot>>,
  OnlyOne<Overlap5<KitPalette, ArchPalette, ComposePalette, SitePalette, ShotsPalette>>,
  OnlyOne<Overlap5<KitFootprintRect, ArchFootprintRect, ComposeFootprintRect, SiteFootprintRect, ShotsFootprintRect>>,
  OnlyOne<Overlap5<KitOpening, ArchOpening, ComposeOpening, SiteOpening, ShotsOpening>>,
  OnlyOne<Overlap5<KitPartition, ArchPartition, ComposePartition, SitePartition, ShotsPartition>>,
  OnlyOne<Overlap5<KitStairs, ArchStairs, ComposeStairs, SiteStairs, ShotsStairs>>,
  OnlyOne<Overlap5<KitBalustrade, ArchBalustrade, ComposeBalustrade, SiteBalustrade, ShotsBalustrade>>,
  OnlyOne<Overlap5<KitRoomItem, ArchRoomItem, ComposeRoomItem, SiteRoomItem, ShotsRoomItem>>,
  OnlyOne<Overlap5<KitRoof, ArchRoof, ComposeRoof, SiteRoof, ShotsRoof>>,
  OnlyOne<Overlap5<KitSiteItem, ArchSiteItem, ComposeSiteItem, SiteSiteItem, ShotsSiteItem>>,
  OnlyOne<Overlap5<KitHero, ArchHero, ComposeHero, SiteHero, ShotsHero>>,
  OnlyOne<Overlap5<KitEntry, ArchEntry, ComposeEntry, SiteEntry, ShotsEntry>>,
  OnlyOne<Overlap5<KitShot, ArchShot, ComposeShot, SiteShot, ShotsShot>>,
  OnlyOne<Overlap5<KitRoom, ArchRoom, ComposeRoom, SiteRoom, ShotsRoom>>,
  OnlyOne<Overlap5<KitLevel, ArchLevel, ComposeLevel, SiteLevel, ShotsLevel>>,
  OnlyOne<Overlap5<KitSpec, ArchSpec, ComposeSpec, SiteSpec, ShotsSpec>>,
];

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
