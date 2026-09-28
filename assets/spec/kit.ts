// HouseSpec fragment for S1 (kit): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S1: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// Settled with the other streams (plan Completeness):
//   - C1: hero.chair is S1's, { kind, pose } — S5 reads `pose` (its 'tucked' / 'turned') and never redeclares it.
//   - C2: the room's type is S3's rooms[].program; S1 declares no rooms[].kind — fixtures.ts roomKind() maps program.
//   - B:  openings[].head (the wall hole's shape, arched / segmental) is S1's; S2's facade dressing reads it.
import type { Colour } from './base.js';

/** the cladding kinds (materials.ts CLAD) */
export type Cladding = 'stucco' | 'siding' | 'brick' | 'stone' | 'timber' | 'corrugated';
export type KeepRole = 'wall' | 'trim' | 'accent' | 'roof' | 'door' | 'interior';
export type LampKind = 'drum' | 'globe' | 'cone' | 'mushroom' | 'tripod';
export type LeafKind = 'single' | 'double' | 'french' | 'glazed' | 'none';

export interface KitSpec {
  /**
   * The light: a preset name (day | golden | dusk | night — the old aliases still resolve, with a kit:lighting-alias
   * warning), or { preset, sunBearing }: sunBearing puts the sun at that compass bearing (degrees, 0 = north —
   * the page's −Z, 90 = east, 180 = south, the street side). Without one the sun swings round from the entry's
   * bearing; under `defaults: 2` by a seeded swing a house, so no two houses facing one way share a sun.
   */
  lighting?: string | { preset?: string; sunBearing?: number };
}
export interface KitLot {}
export interface KitPalette {
  /** every hinged exterior leaf (the entry's too) unless the opening has its own `color` */
  door?: Colour;
  /** 0..1: how far walls, roofs and the interior are pulled toward restraint (default 1: today's clamp) */
  restraint?: number;
  /** roles exempt from restraint (and a kept roof from the charcoal pull): the one committed hue that survives */
  keep?: KeepRole[];
  /** false: no roof is pulled toward charcoal (default: a dark roof is; under defaults 2 only a roof with no colour) */
  roofPull?: boolean;
}
export interface KitLevel {
  /** this storey's own cladding (with `wallColor` as its colour); under defaults 2 a `wallColor` alone gives one too */
  material?: Cladding;
}
export interface KitFootprintRect {}
export interface KitOpening {
  /** a door's leaves: a panelled 'single', a framed 'glazed' one, a 'double' pair, a glazed 'french' pair, or 'none'
   *  (a cased opening). Default: a leaf up to 1.1 m, none above; under defaults 2 a pair from 1.2 to 1.8 m. */
  leaf?: LeafKind;
  /** metres of glass over a door (a transom light) */
  transom?: number;
  /** the frame's colour: window frames, a slider's frames, a transom or fanlight */
  frame?: Colour;
  /** muntins in the glass */
  grid?: 'none' | '2x2' | 'vertical' | 'prairie';
  /** a lantern each side (the entry and a garage get them by default; none under defaults 2 unless true) */
  lantern?: boolean;
  /** the hole's head: flat (default), a half-circle 'arch', or a flat 'segmental' arc */
  head?: 'flat' | 'arch' | 'segmental';
  /** which way an open leaf swings: 'out' (default; the entry swings 'in' under defaults 2) */
  swing?: 'in' | 'out';
  /** a name for anchors.doors (S5 opens doors by it) */
  id?: string;
}
export interface KitPartition {
  /** the leaf's colour (default teal; under defaults 2 derived: the casing white, or timber in a timber house) */
  doorColor?: Colour;
  /** the leaf: single | glazed | double | french, or 'cased' / 'none' for an opening without one */
  doorStyle?: LeafKind | 'cased';
  /** which face the leaf parks on: 'out' (default, the partition's local +z) or 'in' */
  doorSwing?: 'in' | 'out';
}
export interface KitStairs {}
export interface KitBalustrade {}
export interface KitRoom {
  /** what hangs from this room's ceiling and which lamps it has (fixtures.ts) */
  fixtures?: {
    /** a ceiling fan: true / false (default: by the room's kind and size; under defaults 2 a seeded minority) */
    fan?: boolean;
    /** pendants over its island or table: a count, or 0 for none (default by the piece's length) */
    pendants?: number;
    /** 'flush' recessed cans (default), a 'chandelier' at the centre (no fan), or 'none' */
    ceiling?: 'flush' | 'chandelier' | 'none';
    /** what its floor lamps become (default the drum; under defaults 2 seeded per room) */
    lamp?: LampKind;
  };
}
export interface KitRoomItem {}
export interface KitRoof {}
export interface KitSiteItem {}
export interface KitHero {
  /** desk | shelf | credenza | island | console | counter | none, or any item-map.ts SURFACE_TYPES type */
  surface?: string;
  /** the surface's colour (a desk's top: hero.desk.color) */
  surfaceColor?: Colour;
  desk?: { style?: 'walnut' | 'oak' | 'white' | 'black'; color?: Colour; w?: number };
  monitor?: 'curved' | 'flat' | 'none';
  /** the desk chair: its kind, and its pose for the finale (S5 reads pose) — or the kind alone */
  chair?: 'task' | 'lounge' | 'none' | { kind?: 'task' | 'lounge' | 'none'; pose?: 'turned' | 'tucked' };
  /** a shelf hero's plank length, metres (default 0.9) */
  shelfWidth?: number;
  /** the photo's signature room is upstairs: the Core policy lint (validate/hero.mts) allows it off the entry storey */
  upstairs?: boolean;
}
export interface KitEntry {}
export interface KitShot {}
