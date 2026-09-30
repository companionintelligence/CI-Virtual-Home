// HouseSpec fragment for S4 (site): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them keeps today's look, apart from the fixes declared in test/goldens/expected-diffs/). Owned by S4: edit only this file.
//
// To WIDEN a field base.ts declares (one more enum value, a string that may also be an object), redeclare it here
// with the wider type — index.ts lets this fragment's field replace the base's and fails the compile if it narrows
// instead. A field another fragment also declares is a compile error: settle with that stream which one owns it.
//
// What each field does is in reference/HOUSE-SPEC.md → Site (S4); the builders are assets/site.ts (plants, beds,
// paths, the planting generator's drawing, pergola, climbers, lights), assets/site-planting.ts (the generator),
// assets/site-structures.ts (terraces, stairs, rails, fences, walls, pools, decks), assets/site-build.ts (the loop)
// and assets/world.ts (the lot's context, water and street).
import type { Vec2, Side, Colour } from './base.js';

export type PlantingKind = 'foundation' | 'border' | 'walk' | 'meadow' | 'terrace' | 'grove';
export type PlantingMix = 'cottage' | 'modern' | 'mediterranean' | 'desert' | 'woodland' | 'tropical' | 'formal' | 'meadow';
export type PathSurface = 'concrete' | 'gravel' | 'flagstone' | 'stepping' | 'brick' | 'decking' | 'terracotta';
export type FenceStyle = 'picket' | 'privacy' | 'slat-h' | 'post-rail' | 'metal' | 'glass' | 'stone-wall';
export type RailStyle = 'glass' | 'metal' | 'timber' | 'cable' | 'colonial';
export type WaterShape = 'rect' | 'lap' | 'kidney' | 'free' | 'round' | 'poly' | 'basin';
export type LotContext = 'suburb' | 'city' | 'forest' | 'desert' | 'waterfront' | 'rural' | 'hillside';
export type WaterKind = 'lake' | 'river' | 'canal' | 'sea';
export type SidewalkMaterial = 'concrete' | 'brick' | 'stone' | 'flagstone' | 'pavers' | 'gravel' | 'slate';
export type StreetFurniture = 'bench' | 'hydrant' | 'bollard' | 'bike-rack';
/** a rail: `true` (metal), a style, or a style and colour */
export type RailSpec = boolean | RailStyle | { style?: RailStyle; color?: Colour };
/** a bed's edging: a true offset of its outline, `w` wide and `h` proud of the ground, or none */
export type BedEdge = 'none' | { color?: Colour; h?: number; w?: number };
/** a terrace's edge (A3) */
export type TerraceEdge = 'retaining' | 'planted' | 'rail' | 'slope' | {
  kind?: 'retaining' | 'planted' | 'rail' | 'slope';
  /** the retaining faces: stone | stucco | brick | concrete | timber */
  material?: string;
  color?: Colour;
  /** the coping's colour */
  coping?: Colour;
  /** kind 'rail': its style and colour */
  rail?: RailStyle;
  railColor?: Colour;
  /** kind 'planted': 'desert' plants succulents on the bank */
  mix?: string;
};

export interface SiteSpec {}

export interface SiteLot {
  /** the lot's ground; S4 adds `meadow` (long, dry grass) and `gravel` */
  ground?: 'lawn' | 'desert' | 'forest' | 'urban' | 'waterfront' | 'meadow' | 'gravel';
  /** the street's side, decoupled from the entry's (default: the entry's); 'none' builds no street */
  street?: Side | 'none';
  /** who lives round the lot: the default suburb, a city block, woods, a desert road, water, farmland, a hillside */
  context?: LotContext;
  /** how far the neighbours stand back from the street (m) */
  setback?: number;
  /** water on the lot's sides: a lake (default behind), a river `width` wide, a canal between quays, the sea */
  water?: WaterKind | {
    kind?: WaterKind;
    /** the lot's sides it lies on (default ['N']); at most three */
    sides?: Side[];
    /** across (m): a river 26, a canal 11, a lake or the sea to the horizon */
    width?: number;
    /** what stands across a river or canal */
    farBank?: 'trees' | 'houses' | 'hills' | 'none';
    /** the lot's edge to it: a grass bank, a stone quay wall, a beach */
    edge?: 'bank' | 'wall' | 'beach';
  };
  /** the walk beside the street: its paving (a tint over the kit's concrete flags), `none`, or { material, color, width };
   *  a rural road has none unless you say so, a gravel shoulder instead of the curb */
  sidewalk?: SidewalkMaterial | 'none' | { material?: SidewalkMaterial | 'none'; color?: Colour; width?: number };
  /** what stands along the near walk: benches, hydrants, bollards, bike racks (a city block has all four; 'none' clears them) */
  streetFurniture?: StreetFurniture[] | 'none';
}
export interface SitePalette {}
export interface SiteLevel {}
export interface SiteFootprintRect {}
export interface SiteOpening {}
export interface SitePartition {}
export interface SiteStairs {}
export interface SiteBalustrade {}
export interface SiteRoom {}
export interface SiteRoomItem {}
export interface SiteRoof {}

export interface SiteSiteItem {
  /** a name other items refer to it by (`along: 'path:front-walk'`, `along: 'terrace:upper'`) */
  id?: string;
  /** a stair's ends may carry their elevation: [x, z, y] */
  from?: Vec2 | [number, number, number];
  to?: Vec2 | [number, number, number];

  // ---- curves and surfaces
  /** bed.poly, path.path, hedge.path, fence / wall-low path, terrace.poly, pool.poly, planting outlines: a centripetal
   *  Catmull-Rom through the points (true), or with a tension 0–0.95 (0 = full curve) */
  smooth?: boolean | number;
  /** path: sway a straight or gently bent path into S-curves this far (m) either side of its line, seeded, its ends fixed —
   *  the one-word way to bend a two-point path, which `smooth` cannot (0.4–0.8 reads as a garden path) */
  meander?: number;
  /** path: its paving; terrace: its top (default the lot's own ground); wall-low: its facing */
  surface?: PathSurface | 'lawn' | 'meadow' | 'patio' | 'stone' | 'brick' | 'stucco' | 'render' | 'concrete' | 'timber';
  /** bed / planting: its edging; terrace: its edge */
  edge?: BedEdge | TerraceEdge;

  // ---- the planting generator (type 'planting'), and species everywhere
  /** planting: what it lays out; flowers: which flower, whatever its colour */
  kind?: PlantingKind | 'lavender' | 'daisy' | 'tulip' | 'allium' | 'rose' | 'bloom' | 'spike';
  /** planting: the line it follows — a facade ('facade:S', 'facade:S,E', 'facade:all'), a site path or terrace (by
   *  index or id), or a polyline */
  along?: string | Vec2[];
  /** planting: the band's depth (m); pool, basin, rill: how deep it is below its rim (m) */
  depth?: number;
  /** planting: height layers, back to front (1–3) */
  layers?: number;
  /** planting: the palette of species per layer — a named mix, or your own species with weights */
  mix?: PlantingMix | { kinds: string[]; weights?: number[] };
  /** plants per m² for a bed; a multiplier on the mix's own density for a planting */
  density?: number;
  /** planting: pin the flower colours */
  bloom?: Colour[];
  /** planting kind 'border': which side of its line (a walk plants both) */
  side?: 'left' | 'right' | 'both';
  /** planting: the mulch between the plants ('none', or a colour) */
  mulch?: string;
  /** planting: another seeded variation of the same layout */
  seed?: string | number;
  /** tree: broad | oval | layered | conical | columnar | palm | birch | willow | cherry | olive | fan-palm | shade | maple
   *  (grove, scatter, planting grove: one or a list) */
  species?: string | string[];
  /** shrub: mound | boxwood | spreading | flowering | grass | hydrangea | fern | topiary-ball | topiary-cone | agave | yucca
   *  | columnar | rosemary | hosta | broadleaf | succulent | cactus | groundcover | silver | sedum */
  form?: string;
  /** tree: its crown's width against its species' own (0.5–2); a planting grove: its trees' */
  spread?: number;
  /** scatter: 'poisson' spaces its items evenly at random (the default under defaults: 2) */
  layout?: 'poisson' | 'random';

  // ---- water
  /** pool: its outline (a pool with none of shape / poly / coping is the old slab pool); pond: 'organic' */
  shape?: WaterShape | 'organic' | 'ellipse';
  /** pool / basin / rill: the stone round it (false: none) */
  coping?: false | { w?: number; material?: string; color?: Colour };
  /** pool / basin: the colour of its walls and floor */
  tile?: Colour;
  /** basin: a planted island standing out of the water */
  island?: { at?: Vec2; w?: number; d?: number; h?: number; plants?: string; color?: Colour };
  /** basin: jets along its long axis */
  fountains?: number;
  jetH?: number;

  // ---- structures
  /** fence: picket | privacy | slat-h | post-rail | metal | glass | stone-wall; stair: stone | concrete | timber | steel;
   *  steps: stone | brick | timber; pergola: timber | modern */
  style?: string;
  /** deck: true — posts to the ground under it; false — none (cantilevered, a roof deck); unset — the old rule */
  posts?: boolean | 'ground';
  /** deck: the sides railed (deck-local, before rot), 'all', 'none', or { sides, style, color } */
  rails?: 'all' | 'none' | false | Side[] | { sides?: Side[]; style?: RailStyle; color?: Colour };
  railStyle?: RailStyle;
  railColor?: Colour;
  /** steps / stair: rails both sides */
  rail?: RailSpec;
  /** stair: a landing half way when it climbs more than 16 risers (default true) */
  landing?: boolean;
  /** pergola: what grows over it */
  climber?: 'wisteria' | 'vine' | 'rose' | 'none';
  /** gazebo: its columns and rails (color: its roof) */
  trim?: Colour;
  /** wall-low: its thickness; its coping's colour */
  t?: number;
  cap?: Colour;
  /** string-lights: how far they sag between posts; posts: false hangs them from what is there */
  sag?: number;
}
export interface SiteHero {}
export interface SiteEntry {}
export interface SiteShot {}
