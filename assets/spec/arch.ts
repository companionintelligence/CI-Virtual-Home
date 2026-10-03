// HouseSpec fragment for S2 (architecture): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them keeps today's look, apart from the fixes declared in test/goldens/expected-diffs/). Owned by S2: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
//
// What each field does, and how the builder reads it, is in reference/HOUSE-SPEC.md § Architecture (S2); the lints
// in scripts/validate/arch.mts. Modules: stairs.ts (flights), room-finish.ts (floors, walls, ceilings), facade.ts
// (cladding zones, bands, plinths, opening dressing, canopies, stoops), features.ts (porches, balconies, bays,
// fireplaces, built-ins, partition styles), roofs.ts (the roof vocabulary).
import type { Stairs, Vec2, Rect, Side, Colour } from './index.js';

// ---- shared vocabularies ---------------------------------------------------------------------------------------
/** exterior claddings (materials.ts / textures.ts sets) */
export type CladdingKind = 'stucco' | 'siding' | 'brick' | 'stone' | 'timber' | 'corrugated' | 'board-and-batten' | 'concrete' | 'shingle';
/** a room floor: a kind and, for most kinds, a tone */
export type FloorKind =
  | 'oak' | 'honey-oak' | 'walnut' | 'cherry' | 'white-oak' | 'grey-wash' | 'herringbone' | 'chevron'
  | 'tile' | 'hex-tile' | 'checker' | 'terracotta' | 'stone' | 'pavers' | 'slate' | 'concrete' | 'carpet'
  | 'marble' | 'terrazzo' | 'phthalo-terrazzo' | 'charcoal-terrazzo' | 'deck';
/** a room's wall finish */
export type WallKind =
  | 'paint' | 'plaster' | 'painted-brick' | 'brick' | 'stone' | 'concrete' | 'wallpaper' | 'wainscot'
  | 'board-and-batten' | 'shiplap' | 'timber' | 'tile';
/** a room's ceiling */
export type CeilingKind = 'flat' | 'timber' | 'beams' | 'vault' | 'tray' | 'double';

export interface RoomFloor {
  kind: FloorKind;
  /** the tone (default: the kind's own) */
  color?: Colour;
  /** tile / wallpaper patterns: 'stripe' | 'dot' | 'botanical' | 'grid' … (kit.finish, S1) */
  pattern?: string;
  /** a checker's dark squares, or a wallpaper's motif (materials.ts finish()); only reaches a floor via kit.finish */
  color2?: Colour;
  /** tile size or board width, metres */
  scale?: number;
  /** boards run along 'x' or 'z' (default: the room's long axis) */
  run?: 'x' | 'z';
}
export interface FeatureWall {
  /** a perimeter side of the room (the wall on that edge of its bounds) … */
  side?: Side;
  /** … or the partition at this index of the storey's `partitions` */
  partition?: number;
  kind?: WallKind;
  color?: Colour;
}
export interface RoomWalls {
  kind?: WallKind;
  color?: Colour;
  /** wainscot / board-and-batten: the height of the panelled band (default 0.95 m / full height) */
  h?: number;
  /** the colour of the panelled band where it differs from the wall above */
  lower?: Colour;
  feature?: FeatureWall;
}
export interface RoomCeiling {
  /** C3: always an object — `{ kind: 'double' }` for a double-height room (the storey above opens over it) */
  kind: CeilingKind;
  color?: Colour;
  /** vault: the ridge height over the wall top (default 1.1 m); tray: the step (0.25 m) */
  rise?: number;
  /** vault: the ridge runs along 'x' or 'z' (default: the room's long axis) */
  ridge?: 'x' | 'z';
  /** double: rail the gallery edges of the opening in the storey above (default true) */
  rail?: boolean;
}

// ---- stairs (plan S2 stairs; Completeness A2) --------------------------------------------------------------------
export interface ArchStairs {
  /** timber | colonial | spiral (today), `closed` (a boxed flight: closed risers and stringers), `L` and `U` (turning
   *  flights with a landing; their flights take `style`) */
  type: 'timber' | 'colonial' | 'spiral' | 'closed' | 'L' | 'U';
  /** L / U: the flights' own style (default timber) */
  style?: 'timber' | 'colonial' | 'closed';
  /** L / U: which way the flight turns at the landing, seen climbing (default 'left') */
  turn?: 'left' | 'right';
  /** L / U: the landing's depth along the first flight (default the stair's width) */
  landing?: number;
  /** L: the share of the risers in the first flight (default 0.5); U: always half and half */
  split?: number;
  /** U: the gap between the two flights (default 0.1 m) */
  gap?: number;
  /** L / U: the second flight's plan run (default: the first's pro rata) */
  run2?: number;
  /** structure-build.ts builds it with the same am().floor({kind}) as a room floor, so the whole FloorKind palette applies */
  treadWood?: FloorKind;
  riser?: 'open' | 'closed';
  /** colonial / closed: the stringer (and riser) colour */
  stringer?: Colour;
  handrailSide?: 'left' | 'right' | 'both' | 'none';
  /** cut the void over the run in the storey above from the flight itself (voids[] need not list it) */
  autoVoid?: boolean;
}

// ---- storeys -----------------------------------------------------------------------------------------------------
export interface Plinth {
  /** height of the base course (default: the storey's y, when it stands above grade, else 0.45 m) */
  h?: number;
  material?: CladdingKind;
  color?: Colour;
  /** how far it stands proud of the wall face (default 0.04 m) */
  proud?: number;
}
export interface ArchLevel {
  /** one flight (as today) or several: a split level, a second stair, a half-flight (Completeness A2) */
  stairs?: Stairs | Stairs[];
  /** a base course round this storey's walls; on the lowest storey with y > 0 also the foundation it stands on */
  plinth?: Plinth;
  /** attic knee walls: the perimeter walls stop this high and the roof's underside is the ceiling */
  knee?: number;
  /** a split level: where its walls meet a storey beside it (a half-storey up or down), the storey listed first builds
   *  the shared wall and this one only the rest of it; bands with rooms on both sides are interior (party) walls */
  split?: boolean;
}
export interface ArchFootprintRect {
  /** this volume's own cladding (per-volume cladding: its exterior walls wear it) */
  material?: CladdingKind;
  color?: Colour;
  /** this volume's own wall height (a tower, a low wing): its walls rise to y + h */
  h?: number;
}

// ---- openings: dressing ------------------------------------------------------------------------------------------
export interface Shutters { color?: Colour; style?: 'panel' | 'louvre' | 'board'; }
export interface WindowBox { plants?: 'flowers' | 'trailing' | 'herbs'; color?: Colour; bloom?: Colour; }
export interface Surround {
  kind: 'casing' | 'stone' | 'brick-soldier' | 'box-reveal' | 'none';
  color?: Colour;
  /** board or band width (default by kind) */
  w?: number;
  /** how far it stands proud of the wall (default by kind) */
  depth?: number;
  /** a projecting sill under a window: its depth out from the wall (0: none) */
  sill?: number;
}
export interface Canopy {
  kind: 'flat' | 'lattice' | 'awning' | 'gable' | 'shed';
  /** how far it projects (default 0.9 m) */
  depth?: number;
  color?: Colour;
  /** its width beyond the opening on each side (default 0.25 m) */
  extend?: number;
  /** brackets or posts under it */
  supports?: 'brackets' | 'posts' | 'none';
}
export interface ArchOpening {
  /** where two perimeter edges on `side` both contain `at`: which one, by its line — z for an S/N wall, x for an E/W
   *  one (the name is the one the v1 validator already skips its overlap test for) */
  edgeZ?: number;
  shutters?: Shutters | boolean;
  box?: WindowBox | boolean;
  // `head` (flat | arch | segmental | pediment | keystone | crown) is declared once, in assets/spec/kit.ts: S1 shapes the
  // hole for the first three, and this stream's facade.ts dresses the head for all six (a fragment cannot redeclare it)
  surround?: Surround;
  /** an interior roller blind, lowered this far (0–1 of the window) */
  blinds?: { color?: Colour; drop?: number };
  canopy?: Canopy;
}

// ---- partitions ----------------------------------------------------------------------------------------------------
export interface PartitionDoor { at: number; w?: number; h?: number; }
export interface ArchPartition {
  /** solid (today, S1's builder and leaf) | half (a 1.1 m wall with a cap) | posts | slats | glass | arch (a cased
   *  archway, no leaf) | bookcase (shelving both faces) */
  style?: 'solid' | 'half' | 'posts' | 'slats' | 'glass' | 'arch' | 'bookcase';
  /** more than one doorway: distances of their centres from `from` (and widths); `door` / `doorW` still work */
  doors?: PartitionDoor[];
}

// ---- roofs -----------------------------------------------------------------------------------------------------------
export type RoofEnd = 'gable' | 'hip' | 'open' | 'abut';
export interface Chimney {
  at?: Vec2;
  w?: number;
  d?: number;
  /** how far the stack stands over the highest roof point it rises through (default 0.9 m) */
  h?: number;
  material?: 'brick' | 'stone' | 'stucco' | 'metal';
  color?: Colour;
  cap?: 'stone' | 'pots' | 'metal';
}
export interface Dormer {
  at: number;
  w: number;
  style?: 'gable' | 'shed' | 'flat' | 'eyebrow' | 'glazed';
  /** the slope it sits on (default the front: S for a ridge along x, E for one along z) */
  side?: Side;
}
export interface ArchRoof {
  type: 'gable' | 'hip' | 'shed' | 'flat' | 'aframe-glass' | 'terracotta' | 'pent';
  /** the roofing, independent of the form (default by type) */
  finish?: 'shingle' | 'seam' | 'tile' | 'slate' | 'shake' | 'membrane';
  /** fascia, rake boards and gutters (a flat roof: its slab edge and coping) */
  trim?: Colour;
  soffit?: Colour;
  gutters?: boolean;
  /** the automatic gable-apex window: false for none, or the kind */
  gableWindow?: false | 'window' | 'louvre';
  /** per end: a gable (default for a gable roof), a hip, an open gable (the roof and rake, no end wall), or `abut` (the
   *  end runs into a taller roof or wall: no end wall, rake, fascia or gutter there) */
  ends?: Partial<Record<Side, RoofEnd>>;
  /** gable ends glazed instead of clad */
  gableGlass?: Side[];
  gableCladding?: { material?: CladdingKind; color?: Colour };
  skylights?: Array<{ at: Vec2; w?: number; d?: number }>;
  /** a planted (green) roof */
  planted?: 'meadow' | 'sedum';
  /** per-face pitches (saltbox: a steep short face and a long shallow one), degrees */
  pitches?: Partial<Record<Side, number>>;
  /** catslide: faces that sweep down over a lower wing without the raised heel */
  sweep?: Side[];
  /** clip the roof where a taller storey's footprint stands in it, and trim eaves against parapets (on by default
   *  under `defaults: 2`) */
  clip?: boolean;
  dormers?: Dormer[];
  chimney?: Chimney;
}

// ---- entry -------------------------------------------------------------------------------------------------------------
export interface Stoop {
  /** the landing's depth out from the door (default 1.2 m) */
  depth?: number;
  /** its width (default the door + 0.9 m) */
  w?: number;
  /** the number of steps down to grade (default: the storey's y over 0.17 m risers) */
  steps?: number;
  rail?: boolean | 'metal' | 'timber';
  material?: 'stone' | 'concrete' | 'brick' | 'timber';
  color?: Colour;
}
export interface ArchEntry {
  stoop?: Stoop;
}

// ---- rooms ---------------------------------------------------------------------------------------------------------------
export interface ArchRoom {
  floor?: RoomFloor | FloorKind;
  walls?: RoomWalls;
  ceiling?: RoomCeiling;
  /** a sunken (−) or raised (+) floor, metres: a platform or a pit over the room's bounds */
  floorOffset?: number;
}

// ---- the house: facade zones and features -----------------------------------------------------------------------------------
export interface FacadeZone {
  /** the storey (default every storey) */
  level?: string;
  side?: Side;
  /** along the side: from / to (x for S/N, z for E/W; default the whole side) */
  from?: number;
  to?: number;
  /** heights over the storey's floor (default the whole wall) */
  yFrom?: number;
  yTo?: number;
  /** or every exterior wall of this plan rect */
  rect?: Rect;
  material: CladdingKind;
  color?: Colour;
}
export interface FacadeBand {
  /** height of the band's underside over grade (a string course between storeys: the upper storey's y) */
  y: number;
  h?: number;
  material?: CladdingKind;
  color?: Colour;
  proud?: number;
  sides?: Side[];
}
export interface PorchFeature {
  type: 'porch';
  level?: string;
  side: Side;
  /** along the side (x for S/N, z for E/W) */
  from: number;
  to: number;
  depth: number;
  roof?: 'shed' | 'hip' | 'gable' | 'flat' | 'none';
  pitch?: number;
  roofColor?: Colour;
  finish?: ArchRoof['finish'];
  posts?: { spacing?: number; n?: number; style?: 'square' | 'round' | 'turned' | 'tapered' | 'steel'; size?: number; color?: Colour };
  rail?: boolean | { style?: 'spindle' | 'glass' | 'metal' | 'timber'; color?: Colour; h?: number };
  /** the deck's top (default the storey's y, or 0.12 m on a storey at grade) */
  floorY?: number;
  floorColor?: Colour;
  /** steps down to grade: where along the front (default opposite the entry door, else the middle) */
  steps?: boolean | { at?: number; w?: number };
  ceiling?: Colour;
}
export interface BalconyFeature {
  type: 'balcony' | 'terrace' | 'loggia';
  level: string;
  /** balcony: projects out of this side … */
  side?: Side;
  from?: number;
  to?: number;
  depth?: number;
  /** … terrace (on a lower roof) and loggia (recessed under the storey above): its plan rect */
  rect?: Rect;
  rail?: 'glass' | 'metal' | 'timber' | 'parapet' | 'none';
  railColor?: Colour;
  floorColor?: Colour;
  /** loggia: posts along its open side */
  posts?: number;
}
export interface BayFeature {
  type: 'bay';
  level: string;
  side: Side;
  /** the bay's centre along the side */
  at: number;
  w: number;
  depth: number;
  form?: 'box' | 'canted';
  /** 'none': no roof of its own — a bay over another bay stands on its roof-less top */
  roof?: 'hip' | 'shed' | 'flat' | 'gable' | 'none';
  roofColor?: Colour;
  /** what it stands on: 'grade' a stone pier to the ground (the default on the lowest storey), 'oriel' a deep sill course in the wall's cladding
   *  (the default above it — a bay over a lower bay stands on that bay's top), 'none' the bare floor */
  skirt?: 'grade' | 'oriel' | 'none';
  /** its windows' sill and head over the floor */
  sill?: number;
  head?: number;
  /** the bay rises this high (default the storey's wall height) */
  h?: number;
}
export interface FireplaceFeature {
  type: 'fireplace';
  level: string;
  at: Vec2;
  /** the heading the hearth faces into the room (rot 0 faces +Z) */
  rot?: number;
  style?: 'modern' | 'mantel' | 'stone' | 'painted-brick' | 'tv-breast';
  /** the breast/mantel tone (features.ts: hearth() already reads it for every style; declared here to match) */
  color?: Colour;
  w?: number;
  /** its stack up through the storeys and the roof (default true) */
  chimney?: Chimney | boolean;
  /** stack outside the wall (a gable-end chimney) or inside it (default: outside when the hearth backs onto an exterior wall) */
  stack?: 'outside' | 'inside';
}
export interface BuiltinFeature {
  type: 'builtin';
  level: string;
  kind: 'bookcase-wall' | 'niche' | 'wine-wall' | 'window-seat' | 'media-wall';
  /** the wall it stands against: a line from → to, the unit on its `face` side */
  from: Vec2;
  to: Vec2;
  /** which side of from→to the unit stands on: 'left' | 'right' seen walking from → to (default left) */
  face?: 'left' | 'right';
  h?: number;
  d?: number;
  color?: Colour;
}
export type Feature = PorchFeature | BalconyFeature | BayFeature | FireplaceFeature | BuiltinFeature;

export interface ArchSpec {
  /** cladding zones and string courses (per-zone cladding) */
  facade?: FacadeZone[] | { zones?: FacadeZone[]; bands?: FacadeBand[] };
  features?: Feature[];
}

export interface ArchLot {}
export interface ArchPalette {}
export interface ArchBalustrade {
  style?: 'glass' | 'colonial' | 'metal' | 'timber';
}
/** (a fireplace room item may say `chimney: true | {…Chimney}`: features.ts raises its stack — the item's index
 *  signature already admits it, so it is not redeclared here) */
export interface ArchRoomItem {}
export interface ArchSiteItem {}
export interface ArchHero {}
export interface ArchShot {}
