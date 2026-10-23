// HouseSpec v1 as it is honoured today (reference/HOUSE-SPEC.md) — the fields every stream builds on.
//
// Types only: nothing here runs. The parts are FLAT (no nested arrays of other parts): assets/spec/index.ts
// composes them into the full HouseSpec together with each stream's fragment (kit.ts, arch.ts, compose.ts,
// site.ts, shots.ts), so a stream adds a field by editing only its own fragment. Owned by S0 and frozen — a
// stream that must WIDEN a field declared here (a string becoming string | object, one more enum value)
// redeclares it, wider, in its own fragment: index.ts lets the fragment's replace this one, and fails the
// compile if it narrows instead.
//
// Loose on purpose where the builders are: item and site entries carry builder-specific parameters, so the
// COMPOSED RoomItem and SiteItem (index.ts) keep an index signature. It is added there, never here: an index
// signature on the base would make `Omit<BaseItem, …>` and `keyof BaseItem` collapse to `string`, losing every named
// field's type and blinding the widen-only check to them.

export type Vec2 = [number, number];
/** `x, z` is the min (west, north) corner; `w` spans +X, `d` spans +Z. Metres. */
export type Rect = { x: number; z: number; w: number; d: number };
export type Side = 'S' | 'N' | 'E' | 'W';
/** '#rrggbb' */
export type Colour = string;

export interface BaseLot {
  w: number;
  d: number;
  ground?: 'lawn' | 'desert' | 'forest' | 'urban' | 'waterfront';
}

export interface BasePalette {
  wall?: Colour;
  trim?: Colour;
  roof?: Colour;
  accent?: Colour;
  /** inside of the exterior walls and the partitions; default: `wall` lifted toward off-white when it is dark */
  interior?: Colour;
  material?: 'stucco' | 'siding' | 'brick' | 'stone' | 'timber' | 'corrugated' | 'glass';
}

export interface BaseOpening {
  side: Side;
  /** X for S/N walls, Z for E/W walls: the opening's centre */
  at: number;
  type: 'door' | 'window' | 'slider' | 'glass' | 'garage';
  w: number;
  h?: number;
  sill?: number;
  /** a door's unit: `garage` is a sectional door on a hinged-door opening (type `garage` implies it) */
  style?: 'entry' | 'cased' | 'glass-slider' | 'garage';
  open?: boolean;
  /** leaf colour of a hinged door (≤ 1.1 m wide; wider doors are cased openings with no leaf) */
  color?: Colour;
}

export interface BasePartition {
  from: Vec2;
  to: Vec2;
  /** distance of the doorway's centre from `from`, or null for none */
  door?: number | null;
  doorW?: number;
  height?: number;
  color?: Colour;
}

export interface BaseStairs {
  type: 'timber' | 'colonial' | 'spiral';
  /** the bottom step */
  at: Vec2;
  /** ascent heading, degrees (0 ascends toward +Z) */
  rot?: number;
  to: string;
  w?: number;
  run?: number;
}

export interface BaseBalustrade {
  from: Vec2;
  to: Vec2;
  style?: 'glass' | 'colonial';
}

export interface BaseItem {
  type: string;
  at: Vec2;
  rot?: number;
  y?: number;
  w?: number;
  d?: number;
  h?: number;
  r?: number;
  color?: Colour;
}

export interface BaseRoom {
  no?: string;
  name: string;
  bounds: Rect;
}

/** one rect of a storey's footprint */
export interface BaseFootprintRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface BaseLevel {
  id: string;
  name?: string;
  sheet?: string;
  y: number;
  height: number;
  floor?: string;
  footprint: BaseFootprintRect[];
  wallColor?: Colour;
  trimColor?: Colour;
  interior?: Colour;
  voids?: Rect[];
}

export interface BaseRoof {
  over: Rect;
  y: number;
  type: 'gable' | 'hip' | 'shed' | 'flat' | 'aframe-glass' | 'terracotta';
  ridge?: 'x' | 'z';
  /** shed: the high side (default N) */
  high?: Side;
  pitch?: number;
  overhang?: number;
  color?: Colour;
  parapet?: number;
  dormers?: Array<{ at: number; w: number }>;
  chimney?: { at: Vec2 };
}

export interface BaseSiteItem {
  type: string;
  at?: Vec2;
  w?: number;
  d?: number;
  h?: number;
  r?: number;
  rot?: number;
  /** elevation the item stands at (default 0) */
  y?: number;
  color?: Colour;
  from?: Vec2;
  to?: Vec2;
  path?: Vec2[];
  poly?: Vec2[];
}

export interface BaseHero {
  level: string;
  at: Vec2;
  rot?: number;
  device?: 'chalk' | 'charcoal' | 'strix';
  pose?: 'prone' | 'upright';
  surface?: 'desk' | 'credenza' | 'island' | 'shelf' | 'none';
  shelfHeight?: number;
}

export interface BaseEntry {
  level: string;
  side: Side;
  at: number;
}

export interface BaseShot {
  id?: string;
  type: 'door-to-core' | 'orbit' | 'hero-reveal' | 'walkthrough' | 'core-orbit';
  duration?: number;
  walls?: 'up' | 'cutaway' | 'down' | 'sims';
  roof?: 'on' | 'off' | 'auto';
  enterT?: number;
}

export interface BaseHouseSpec {
  $schema?: string;
  id: string;
  name: string;
  author: string;
  source?: string;
  style?: string;
  emoji?: string;
  lighting?: string;
  areaSqm?: number;
  /**
   * What the building is for: a home (absent, or `'home'`) or an office (`'office'`; reference/office/office-contract-m0.md). An office is a HouseSpec like
   * any other, but it is listed under `offices` in content/houses/index.json and never under `houses`, so no page, count or fleet metric that counts the
   * homes sees it. Read it through `specUse` (scripts/lib/list-specs.mts), never directly. The engine ignores it until an office's own programs land.
   */
  use?: 'home' | 'office';
  /**
   * Which generation of look-changing defaults the house opts into (plan §2.0). 1 (or absent): today's look,
   * exactly. 2: every stream's new defaults (door colour, fans, lamps, gutters, gable windows, lanterns, world
   * variety, restraint). Read it through specDefaults(spec), never directly.
   */
  defaults?: 1 | 2;
  /** test/fixtures/houses only: what scripts/test-fixtures.mts renders of it (`frames`: shot → t list) and whether
   *  it runs the QA (`qa: false` skips it); ignored by the builder */
  fixture?: { note?: string; frames?: Record<string, number[]>; qa?: boolean };
}
