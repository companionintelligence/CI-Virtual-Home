// HouseSpec fragment for S3 (compose): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them keeps today's look, apart from the fixes declared in test/goldens/expected-diffs/). Owned by S3: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
// Need a composed type (Stairs, Room, Opening …)? `import type { Stairs } from './index.js'`.
//
// The composer (assets/room-composer.ts) reads these. The opt-in rule: a room without `program` is never composed
// and renders its authored items exactly, as before. A room with a `program` keeps every authored item exactly
// (they are PINS the composer places round) and gets the program's furniture set added, seeded by
// mulberry32(fnv1a(`${spec.id}:${room.no}:compose`)) (`:${room.seed}` appended when the room has one). `lock: true`
// turns the composer off again for a room whose composition was baked into its items (scripts/compose-house.mts
// --write) and hand-tuned since.
import type { Side, Colour, Vec2 } from './base.js';

/** What a room is for — THE room-type field (plan Completeness C2). S1's fixtures map it to a fixture kind
 *  (assets/room-programs.ts programKind), S5's interest table keys on it, the composer furnishes by it. */
export type RoomProgram =
  | 'living' | 'kitchen' | 'dining' | 'kitchen-dining'
  | 'bed-primary' | 'bed-kid' | 'bed-guest' | 'nursery'
  | 'bath' | 'ensuite' | 'powder'
  | 'study' | 'library' | 'den' | 'media' | 'playroom' | 'sunroom' | 'greenhouse'
  | 'foyer' | 'hall' | 'laundry' | 'studio' | 'bar' | 'gym' | 'garage' | 'outdoor'
  | 'workspace' | 'meeting';

/** A furniture style bundle (assets/house-styles.ts, published as content/house-styles.json). */
export type StyleKey = 'modern' | 'farmhouse' | 'cottage' | 'mediterranean' | 'mid-century' | 'industrial' | 'scandi' | 'tropical' | 'craftsman';

/** The wall a room's seating (living, den, media) faces, and what is on it. */
export interface RoomFocus {
  type: 'fireplace' | 'tv' | 'window' | 'art' | 'island' | 'bed' | 'view';
  /** the room's wall it is on (N = the room's min-z edge, S its max-z edge, W min-x, E max-x); default: the
   *  composer's pick (a fireplace or TV item already pinned in the room, else the longest solid wall facing the
   *  room's main door, else the wall with the most glass for 'window' / 'view'). For 'bed' it is the wall the
   *  headboard goes on; 'island' asks a kitchen for an island (its wall is unused). */
  wall?: Side;
  /** where along that wall (world x for N/S, world z for E/W), or a point [x, z]; default its middle */
  at?: number | Vec2;
}

export interface KitchenPlan {
  /** the fitted run: single wall, galley (two facing walls), L (two walls meeting), U (three) */
  layout?: 'L' | 'U' | 'galley' | 'single';
  /** an island (true: sized to the room; or its w × d, metres) */
  island?: boolean | { w: number; d: number };
  /** a peninsula off the end of the run instead of an island */
  peninsula?: boolean;
  /** the wall the sink run takes (default the wall with a window, else the longest run) */
  sinkWall?: Side;
  /** put the sink under a window when the run has one (default true) */
  windowOverSink?: boolean;
  /** the worktop: stone (today's pale stone), marble, butcher (block), concrete, quartz (dark), terrazzo */
  top?: 'stone' | 'marble' | 'butcher' | 'concrete' | 'quartz' | 'terrazzo';
  /** glass-fronted wall cabinets (lit shelves behind glazed doors) */
  glassUppers?: boolean;
  /** cabinet colour ('#rrggbb'; default the house kit's cabinet role) */
  color?: Colour;
}

export interface BathPlan {
  /** a freestanding tub (clawfoot or modern soaking tub, by style), a built-in tub against a wall, or none */
  tub?: 'free' | 'built-in' | 'none';
  /** a shower (true: 0.9 × 0.9 m; or its w × d) */
  shower?: boolean | { w: number; d: number };
  /** one basin, two, or a pedestal sink */
  vanity?: 'single' | 'double' | 'pedestal';
}

export interface ComposeSpec {
  /** the house's furniture style (assets/house-styles.ts); a room's `style` overrides it. Default: read off the
   *  spec's free-text `style` ("farmhouse", "mid-century" …), else modern */
  styleKey?: StyleKey;
  /** `use: 'office'` only (reference/office/office-contract-m0.md): `headcount`, the people on the floor the building is drawn for (the office
   *  validator holds the desks to it); `company`, the slug of the fictional company that works there. Not a story word: nothing prints either. */
  office?: { headcount?: number; company?: string; building?: string };
}
export interface ComposeLot {}
export interface ComposePalette {}
export interface ComposeLevel {}
export interface ComposeFootprintRect {}
export interface ComposeOpening {}
export interface ComposePartition {}
export interface ComposeStairs {}
export interface ComposeBalustrade {}
export interface ComposeRoom {
  /** what the room is for; with it the room is composed (see the header) */
  program?: RoomProgram;
  /** the wall the room is arranged round */
  focus?: RoomFocus;
  /** how full the room is, 0 (the program's essentials only) … 1 (every optional piece that fits); default 0.5 */
  density?: number;
  /** this room's furniture style (default spec.styleKey) */
  style?: StyleKey;
  /** the room's own colours: fabric (upholstery, linen), wood (tables, frames), accent (cushions, art, rugs).
   *  Bedrooms get a seeded one from their style when they have none, distinct from the house's other bedrooms. */
  palette?: { fabric?: Colour; wood?: Colour; accent?: Colour };
  /** re-rolls the composition (any string or number): the same program, another arrangement */
  seed?: string | number;
  /** a kitchen's (or kitchen-dining's) fitted plan; default: from the room's shape */
  kitchen?: KitchenPlan;
  /** a bathroom's (bath, ensuite, powder) fixtures; default: from the program and the room's size */
  bath?: BathPlan;
  /** composition baked into `items` and hand-tuned: do not compose again (the program stays the room's type) */
  lock?: boolean;
  /** `use: 'office'` only: how many people work in this room (a desk or a bench position each); the office validator sums them against `office.headcount` */
  seats?: number;
  /** the dress phase (assets/room-dress.ts, plan 5.6): after the layout is frozen it adds small goods, lamps and towels (`src: 'dress@1'` items) to
   *  the room's surfaces. ABSENT: the build does not dress the room (so every shipped house builds as it always did; a `dress@1` item already baked
   *  into `items` is a plain item and builds either way). `false`: never dressed, not even by `compose-house.mts --dress`. `{ level }`: opts the
   *  room in, 0 (the program's never-bare floor only) … 1 (every slot its host has room for). `off`: slot ids to skip (assets/dress-recipes.ts).
   *  `?dress=0` on the page leaves every dress item out. The program is the room's own, else read off its name (a hand-authored room is dressed
   *  additively: its own items are pins and the free area of each host is all the phase uses). */
  dress?: false | { level?: number; off?: string[] };
}
// Room items: the dress phase's carry `src: 'dress@1'` and a `dk` (room, slot, ordinal: their seed key); the composer's own carry `src: 'compose@1'` (scripts/compose-house.mts --write keeps it when it bakes a
// composition into the spec, so a re-bake can tell its own items from the author's). Not declared here: an item takes
// any builder parameter (the base item has an index signature), and scripts/test-spec-merge.mts adds `src` to this
// interface itself to prove a stream can, so it stays empty.
export interface ComposeRoomItem {}
export interface ComposeRoof {}
export interface ComposeSiteItem {}
export interface ComposeHero {}
export interface ComposeEntry {}
export interface ComposeShot {}
