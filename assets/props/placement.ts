// Placement metadata — how every catalog type (the page's AssetFactory builders in item-map.ts and every registry
// prop) stands in a room: what it backs onto, the clear floor it needs round it, what it faces, what it pairs with,
// which room programs and furniture styles it suits, and which composer ROLE it can fill (sofa, armchair,
// dining-table …). The composer (assets/room-composer.ts) picks a type for a role from these; the layout lints
// (scripts/validate/layout.mts) read clearances and wall mounts from them; build-prop-catalog.mts publishes them in
// content/house-catalog.json as each type's `place` (plan S3 "catalog metadata").
//
// THREE-free and dependency-free. The page builders' SIZE and honoured PARAMS are declared here too (`size`,
// `params`), because the composer needs them in Node and the catalog's measurement of a page builder is only its
// default: test-room-composer.mts fails when a declared size drifts from the catalog's measured box, so this table
// cannot silently disagree with the geometry. S1 owns the page builders: when it widens one's params (plan S1
// "page furniture"), the `params` here follow.
//
//   against   'wall' (its back to a wall) | 'free' (anywhere; seating may float) | 'corner' | 'window' | 'center'
//   clear     { front, side, back } metres of clear floor the item needs (front = toward +z at rot 0)
//   faces     'room' | 'wall' | 'focus' (seating: the room's focal wall)
//   group     the kind of thing (seating, chair, table, bed, storage, desk, lamp, rug, plant, art, fitted, appliance,
//             bath, kids, music, gym, decor, textile, lighting, outdoor, hero, structure)
//   hangs     'wall' | 'ceiling' | null;  mountY: its default mount (art: centre height; cabinets: bottom edge)
//   onSurface sits on another item (a lamp on a nightstand); `top` is the height of the surface an item offers
//   surfaces  for an onSurface item, the groups it may stand on
//   programs  the room programs it suits ([] any); styles: the style tags it suits ([] any)
//   pairsWith types or roles it goes with;  roles: the composer roles it can fill
//   colorRole the kit role its `color` param paints, or null when it takes no colour
//   tucks     a chair or stool whose seat may slide under a table, desk or counter (the lints allow the overlap)
//
// Owner: S3 (compose).

export interface Place {
  against: 'wall' | 'free' | 'corner' | 'window' | 'center';
  clear: { front: number; side: number; back: number };
  faces: 'room' | 'wall' | 'focus';
  group: string;
  hangs: 'wall' | 'ceiling' | null;
  mountY?: number;
  onSurface: boolean;
  top?: number;
  surfaces: string[];
  programs: string[];
  styles: string[];
  pairsWith: string[];
  roles: string[];
  colorRole: string | null;
  tucks?: boolean;
  /** page builders only: the declared box (footprint w × d, height h, the box centre's offset ox / oz from the
   *  origin, and its floor y0) and the parameters the builder honours */
  size?: { w: number; d: number; h: number; ox?: number; oz?: number; y0?: number };
  params?: string[];
}

type Over = Partial<Place>;
const C = (front: number, side = 0.05, back = 0) => ({ front, side, back });
// group defaults: what a thing of each kind usually needs
const BASE: Record<string, Over> = {
  seating: { against: 'free', clear: C(0.45, 0.1), faces: 'focus', colorRole: 'fabric' },
  chair: { against: 'free', clear: C(0.3, 0.05), faces: 'room', colorRole: 'fabric', tucks: true },
  table: { against: 'center', clear: C(0.45, 0.45, 0.45), faces: 'room', colorRole: 'wood' },
  bed: { against: 'wall', clear: C(0.6, 0.6), faces: 'room', colorRole: 'fabric' },
  storage: { against: 'wall', clear: C(0.7), faces: 'room', colorRole: 'cabinet' },
  desk: { against: 'wall', clear: C(0.9), faces: 'room', colorRole: 'wood' },
  lamp: { against: 'corner', clear: C(0.1, 0.05), faces: 'room', colorRole: 'linen' },
  rug: { against: 'center', clear: C(0, 0, 0), faces: 'room', colorRole: 'rug' },
  plant: { against: 'corner', clear: C(0.1, 0.05), faces: 'room', colorRole: 'accent' },
  art: { against: 'wall', clear: C(0, 0, 0), faces: 'room', hangs: 'wall', mountY: 1.5, colorRole: 'fabric2' },
  fitted: { against: 'wall', clear: C(1.0, 0), faces: 'room', colorRole: 'cabinet' },
  appliance: { against: 'wall', clear: C(1.0, 0), faces: 'room', colorRole: null },
  bath: { against: 'wall', clear: C(0.6, 0.1), faces: 'room', colorRole: 'linen' },
  kids: { against: 'wall', clear: C(0.6), faces: 'room', colorRole: 'accent' },
  music: { against: 'wall', clear: C(0.6), faces: 'room', colorRole: 'wood' },
  gym: { against: 'free', clear: C(0.6, 0.3), faces: 'room', colorRole: 'metal' },
  decor: { against: 'free', clear: C(0), faces: 'room', onSurface: true, colorRole: 'accent' },
  textile: { against: 'free', clear: C(0), faces: 'room', colorRole: 'fabric2' },
  lighting: { against: 'center', clear: C(0, 0, 0), faces: 'room', hangs: 'ceiling', colorRole: 'metal' },
  outdoor: { against: 'free', clear: C(0.6, 0.3), faces: 'room', colorRole: 'fabric' },
  hero: { against: 'wall', clear: C(1.2), faces: 'room', colorRole: null },
  structure: { against: 'free', clear: C(0, 0, 0), faces: 'room', colorRole: null },
};
function def(group: string, roles: string[], programs: string[], styles: string[] = [], over: Over = {}): Place {
  return {
    against: 'free', clear: C(0.3), faces: 'room', hangs: null, onSurface: false, surfaces: [], pairsWith: [], colorRole: null,
    ...BASE[group], group, roles, programs, styles, ...over,
  } as Place;
}
const LIVING = ['living', 'den', 'media', 'library', 'sunroom', 'study'];
const BEDS = ['bed-primary', 'bed-guest', 'bed-kid', 'nursery'];
const KIDS = ['bed-kid', 'nursery', 'playroom'];
const BATHS = ['bath', 'ensuite', 'powder'];
const KITCHENS = ['kitchen', 'kitchen-dining'];
const DINING = ['dining', 'kitchen-dining'];
const WORK = ['study', 'library', 'studio'];
const TRAD = ['farmhouse', 'cottage', 'craftsman', 'traditional'];
const MODERN = ['modern', 'scandi', 'mid-century', 'industrial'];
const WARM = ['mediterranean', 'tropical'];
const ON = ['table', 'storage', 'desk'];

export const PLACEMENT: Record<string, Place> = {
  // ---- the page's AssetFactory builders (item-map.ts) ----------------------------------------------------------
  'sectional': def('seating', ['sofa-l'], LIVING, MODERN, { size: { w: 2.4, d: 1.8, h: 0.76, oz: 0.4 }, params: [], colorRole: null }),
  'club-chair': def('seating', ['armchair'], LIVING, ['modern', 'industrial', 'craftsman'], { size: { w: 0.82, d: 0.68, h: 0.9 }, params: ['color'] }),
  'coffee-table': def('table', ['coffee-table'], LIVING, MODERN, { against: 'free', clear: C(0.3, 0.3, 0.3), size: { w: 1.2, d: 0.6, h: 0.4 }, params: ['w', 'd'], colorRole: null, top: 0.4 }),
  'octagonal-table': def('table', ['coffee-table'], LIVING, WARM, { against: 'free', clear: C(0.3, 0.3, 0.3), size: { w: 1.36, d: 1.36, h: 0.6 }, params: [], colorRole: null, top: 0.6 }),
  'dining-set': def('table', ['dining-set'], DINING, [], { clear: C(0.6, 0.6, 0.6), size: { w: 2, d: 2.09, h: 0.99 }, params: ['w', 'd'], colorRole: null }),
  'dining-table': def('table', ['dining-set'], DINING, [], { clear: C(0.6, 0.6, 0.6), size: { w: 2.1, d: 2.04, h: 0.83 }, params: ['w', 'd'], colorRole: null }),
  'kitchen-island': def('fitted', ['island'], KITCHENS, [], { against: 'center', clear: C(1.0, 0.9, 1.0), size: { w: 2.4, d: 1.36, h: 1.18, oz: 0.23 }, params: ['w', 'd', 'color'], top: 0.92 }),
  'kitchen-cabinetry': def('fitted', ['kitchen-run'], KITCHENS, [], { size: { w: 3.64, d: 0.69, h: 1.67 }, params: ['w', 'd'], colorRole: null, top: 0.9 }),
  'media-credenza': def('storage', ['media', 'credenza'], LIVING, MODERN, { clear: C(0.5), size: { w: 1.8, d: 0.45, h: 0.72 }, params: ['w', 'd'], colorRole: null, top: 0.72 }),
  'wall-tv': def('art', ['tv'], LIVING, [], { mountY: 1.3, size: { w: 1.6, d: 0.05, h: 0.9, y0: -0.45 }, params: ['w', 'h'], colorRole: null }),
  'fireplace': def('storage', ['fireplace'], ['living', 'den', 'library', 'bed-primary'], [], { clear: C(1.0, 0.3), size: { w: 1.6, d: 0.36, h: 0.65, y0: 0.225 }, params: [], colorRole: null }),
  'area-rug': def('rug', ['rug'], [...LIVING, ...BEDS, ...DINING], MODERN, { size: { w: 3.2, d: 2.2, h: 0.02 }, params: ['w', 'd', 'color'] }),
  'circular-rug': def('rug', ['rug-round'], [...LIVING, ...BEDS, ...KIDS, ...DINING], [], { size: { w: 4, d: 4, h: 0.01 }, params: ['r', 'color'] }),
  'concentric-rug': def('rug', ['rug-round'], [...LIVING, ...DINING], MODERN, { size: { w: 3.2, d: 3.2, h: 0.02 }, params: ['r'], colorRole: null }),
  'sun-lounger': def('outdoor', ['lounger'], ['outdoor', 'sunroom'], [], { size: { w: 0.7, d: 1.9, h: 0.48, y0: 0.1 }, params: [], colorRole: null }),
  'bench': def('seating', ['bench', 'bed-bench'], ['foyer', 'hall', ...BEDS, ...DINING], MODERN, { clear: C(0.3), faces: 'room', size: { w: 1.8, d: 0.5, h: 0.48 }, params: ['w', 'h', 'd'], colorRole: null }),
  'platform-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], MODERN, { size: { w: 3.18, d: 2.3, h: 1.1 }, params: ['w', 'd', 'color'] }),
  'wardrobe': def('storage', ['wardrobe'], BEDS, MODERN, { clear: C(0.9), size: { w: 2.2, d: 0.64, h: 2.5, oz: 0.019 }, params: ['w', 'h', 'd'], colorRole: null }),
  'crib': def('bed', ['crib'], ['nursery'], [], { clear: C(0.6, 0.3), size: { w: 1.3, d: 0.75, h: 0.97 }, params: ['color'] }),
  'ensuite': def('bath', ['bath-pod'], BATHS, [], { clear: C(0.9), size: { w: 2.4, d: 2, h: 2.11 }, params: ['w', 'd'], colorRole: null }),
  'bookshelf': def('storage', ['bookcase'], [...WORK, 'living', 'den', 'bed-guest', 'hall'], [], { size: { w: 1.18, d: 0.35, h: 2 }, params: ['w', 'h', 'd'], colorRole: null }),
  'walnut-desk': def('hero', ['hero-desk'], WORK, [], { size: { w: 1.8, d: 0.85, h: 0.77 }, params: [] }),
  'task-chair': def('hero', ['desk-chair'], WORK, [], { tucks: true, size: { w: 0.53, d: 0.55, h: 0.98, oz: 0.005, y0: 0.065 }, params: [] }),
  'curved-monitor': def('hero', [], WORK, [], { onSurface: true, surfaces: ['desk'], size: { w: 1.05, d: 0.32, h: 0.81, oz: 0.05 }, params: [] }),
  'chalk-tower': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.26, d: 0.31, h: 0.09, ox: -0.012, oz: -0.052 }, params: ['pose'] }),
  'charcoal-tower': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.26, d: 0.31, h: 0.09, ox: -0.012, oz: -0.052 }, params: ['pose'] }),
  'core-shelf': def('hero', [], [], [], { hangs: 'wall', size: { w: 0.9, d: 0.34, h: 0.26, oz: 0.169, y0: 0.745 }, params: ['finish', 'pose', 'h', 'w'] }),
  'strix-mini': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.24, d: 0.24, h: 0.09 }, params: [] }),
  'speakers': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 1.48, d: 0.22, h: 0.28, oz: 0.012 }, params: [] }),
  'halo-lamp': def('lamp', ['legacy-lamp'], [...LIVING, ...BEDS], MODERN, { size: { w: 0.4, d: 0.4, h: 1.71 }, params: [], colorRole: null }),
  'fiddle-leaf': def('plant', ['plant-floor'], [...LIVING, 'dining', 'foyer'], [], { size: { w: 1.32, d: 1.26, h: 2.44, ox: 0.026 }, params: [], colorRole: null }),
  'monstera': def('plant', ['plant-floor'], [...LIVING, 'dining', 'foyer', 'bed-primary'], ['modern', 'tropical', 'mid-century', 'scandi'], { size: { w: 1.01, d: 1.17, h: 1.31 }, params: [], colorRole: null }),
  'bonsai': def('plant', ['plant-surface'], [...WORK, 'living'], [], { onSurface: true, surfaces: ON, size: { w: 0.57, d: 0.48, h: 0.5, ox: 0.044 }, params: [], colorRole: null }),
  'bamboo': def('plant', ['plant-screen'], ['sunroom', 'greenhouse', 'outdoor'], ['modern', 'tropical'], { against: 'wall', size: { w: 1.6, d: 0.4, h: 2.8 }, params: [], colorRole: null }),
  'cactus-group': def('plant', ['plant-floor'], ['sunroom', 'greenhouse', 'living'], ['mediterranean', 'modern'], { size: { w: 1.67, d: 1.27, h: 2.3, ox: -0.115, oz: 0.115, y0: -0.1 }, params: [], colorRole: null }),
  'telescope': def('decor', ['curio'], ['study', 'library', 'living'], [], { onSurface: false, against: 'window', clear: C(0.3, 0.2), size: { w: 0.69, d: 1.09, h: 1.69, ox: 0.108, oz: -0.02 }, params: [], colorRole: null }),
  'soccer-goal': def('outdoor', ['play-outdoor'], ['outdoor'], [], { size: { w: 1.86, d: 1.22, h: 1.13, oz: 0.01 }, params: [], colorRole: null }),
  'low-wall': def('structure', [], [], [], { size: { w: 3.04, d: 0.2, h: 0.89 }, params: ['w', 'h'] }),
  'column': def('structure', [], [], [], { size: { w: 0.4, d: 0.4, h: 2.62 }, params: ['h', 'r', 'size', 'style', 'color'] }),

  // ---- registry props (assets/props/*.ts) ------------------------------------------------------------------------
  // decor.ts
  'side-table': def('table', ['side-table', 'nightstand'], [...LIVING, ...BEDS], MODERN, { against: 'free', clear: C(0.1, 0.05, 0.05), top: 0.55 }),
  'table-lamp': def('lamp', ['table-lamp'], [...LIVING, ...BEDS, 'foyer', 'hall'], [], { onSurface: true, surfaces: ON, pairsWith: ['nightstand', 'side-table', 'console'] }),
  'floor-cushion': def('textile', ['floor-seat'], ['living', 'playroom', 'bed-kid'], WARM, { colorRole: 'fabric' }),
  // seating.ts
  'loveseat': def('seating', ['sofa', 'loveseat'], [...LIVING, 'bed-primary'], [], { pairsWith: ['coffee-table', 'armchair', 'rug'] }),
  'wingback-armchair': def('seating', ['armchair', 'reading-chair'], [...LIVING, 'bed-primary'], TRAD, { pairsWith: ['floor-lamp', 'side-table'] }),
  'chaise-lounge': def('seating', ['chaise'], ['living', 'bed-primary', 'sunroom', 'library'], ['cottage', 'mid-century', 'modern']),
  'ottoman': def('seating', ['ottoman', 'coffee-table', 'bed-bench'], [...LIVING, ...BEDS], [], { clear: C(0.2, 0.1, 0.2), top: 0.42 }),
  'pouf': def('seating', ['pouf'], [...LIVING, ...KIDS, 'bed-primary'], ['scandi', 'tropical', 'mediterranean', 'modern'], { clear: C(0.1, 0.1) }),
  'bar-stool': def('chair', ['stool'], [...KITCHENS, 'bar'], [], { clear: C(0.2, 0.05), colorRole: 'fabric2' }),
  'dining-chair': def('chair', ['dining-chair', 'desk-chair'], [...DINING, 'study'], [], { pairsWith: ['dining-table'] }),
  'rocking-chair': def('seating', ['armchair', 'reading-chair'], ['living', 'nursery', 'bed-kid', 'sunroom'], ['farmhouse', 'cottage']),
  'cushioned-bench': def('seating', ['bed-bench', 'bench', 'dining-bench'], [...BEDS, 'foyer', 'hall', ...DINING], ['farmhouse', 'cottage', 'scandi', 'modern'], { clear: C(0.3) }),
  'papasan-chair': def('seating', ['armchair'], ['living', 'bed-kid', 'sunroom', 'playroom'], ['tropical']),
  'bean-bag': def('seating', ['floor-seat'], [...KIDS, 'media', 'den'], [], { clear: C(0.2, 0.1) }),
  'vanity-stool': def('chair', ['vanity-stool'], ['bed-primary', ...BATHS], [], { colorRole: 'linen' }),
  'sofa': def('seating', ['sofa'], LIVING, ['modern', 'scandi'], { pairsWith: ['coffee-table', 'armchair', 'rug'] }),
  'slipcover-sofa': def('seating', ['sofa'], LIVING, ['farmhouse', 'cottage', 'tropical']),
  'chesterfield-sofa': def('seating', ['sofa'], ['living', 'library', 'den', 'study'], ['craftsman', 'industrial', 'traditional']),
  'mid-century-sofa': def('seating', ['sofa'], LIVING, ['mid-century', 'scandi', 'modern']),
  'tuxedo-sofa': def('seating', ['sofa'], LIVING, ['modern', 'industrial', 'mediterranean']),
  'l-sectional': def('seating', ['sofa-l'], ['living', 'den', 'media'], ['modern', 'scandi', 'industrial', 'mid-century']),
  'mission-armchair': def('seating', ['armchair', 'reading-chair'], [...LIVING], ['craftsman', 'farmhouse', 'mediterranean']),
  'barrel-chair': def('seating', ['armchair'], [...LIVING, 'bed-primary'], ['modern', 'mid-century', 'industrial']),
  'slipper-chair': def('seating', ['armchair', 'bedroom-chair'], [...LIVING, 'bed-primary', 'bed-guest'], ['cottage', 'scandi', 'modern']),
  'lounge-chair': def('seating', ['armchair', 'reading-chair'], [...LIVING, 'bed-primary'], ['mid-century', 'modern', 'scandi', 'industrial']),
  'rattan-armchair': def('seating', ['armchair', 'bedroom-chair'], [...LIVING, 'bed-primary', 'bed-guest'], ['tropical', 'mediterranean', 'cottage'], { colorRole: 'linen' }),
  'windsor-chair': def('chair', ['dining-chair', 'desk-chair'], [...DINING, 'study'], ['farmhouse', 'cottage', 'craftsman'], { colorRole: 'wood' }),
  'bentwood-chair': def('chair', ['dining-chair', 'desk-chair'], [...DINING, 'study', 'bar'], ['scandi', 'cottage', 'mediterranean', 'mid-century'], { colorRole: 'wood' }),
  'ladderback-chair': def('chair', ['dining-chair'], [...DINING, 'bed-guest'], ['farmhouse', 'mediterranean', 'craftsman'], { colorRole: 'wood' }),
  'shell-chair': def('chair', ['dining-chair', 'desk-chair'], [...DINING, 'study', 'studio'], ['mid-century', 'modern', 'scandi', 'industrial'], { colorRole: 'fabric2' }),
  // tables.ts
  'round-dining-table': def('table', ['dining-table', 'dining-table-round'], DINING, [], { clear: C(0.9, 0.9, 0.9), top: 0.75 }),
  'console-table': def('storage', ['console'], ['foyer', 'hall', 'living', 'dining', 'bed-primary'], [], { clear: C(0.6), colorRole: 'wood', top: 0.8 }),
  'nightstand': def('storage', ['nightstand'], BEDS, TRAD, { clear: C(0.3), top: 0.55 }),
  'nesting-tables': def('table', ['side-table'], [...LIVING, 'bed-primary'], ['modern', 'mid-century', 'scandi'], { against: 'free', clear: C(0.1, 0.05, 0.05), top: 0.5 }),
  'writing-desk': def('desk', ['desk'], [...WORK, 'bed-guest', 'bed-kid', 'bed-primary'], [], { top: 0.75 }),
  'vanity-desk': def('desk', ['vanity'], ['bed-primary'], [], { clear: C(0.7) }),
  'farmhouse-table': def('table', ['dining-table'], DINING, ['farmhouse', 'cottage', 'craftsman'], { clear: C(0.9, 0.9, 0.9), top: 0.76 }),
  'bar-table': def('table', ['bar-table'], ['bar', ...KITCHENS, 'living'], ['industrial', 'modern'], { clear: C(0.5, 0.5, 0.5) }),
  'outdoor-table': def('outdoor', ['dining-table-outdoor'], ['outdoor'], [], { colorRole: 'wood' }),
  'kids-table': def('kids', ['kids-table'], KIDS, [], { against: 'free', clear: C(0.4, 0.4, 0.4) }),
  'bistro-table': def('table', ['dining-table-small'], [...KITCHENS, 'outdoor', 'sunroom', 'bar'], ['mediterranean', 'cottage', 'industrial'], { clear: C(0.6, 0.6, 0.6) }),
  'trestle-table': def('table', ['dining-table'], DINING, ['farmhouse', 'craftsman', 'mediterranean', 'industrial'], { clear: C(0.9, 0.9, 0.9), top: 0.76 }),
  'glass-dining-table': def('table', ['dining-table'], DINING, ['modern', 'industrial'], { clear: C(0.9, 0.9, 0.9), colorRole: 'metal', top: 0.75 }),
  'pedestal-dining-table': def('table', ['dining-table', 'dining-table-round'], DINING, ['scandi', 'cottage', 'farmhouse', 'traditional'], { clear: C(0.9, 0.9, 0.9), top: 0.76 }),
  'oval-dining-table': def('table', ['dining-table'], DINING, ['mid-century', 'scandi', 'modern'], { clear: C(0.9, 0.9, 0.9), top: 0.75 }),
  'round-coffee-table': def('table', ['coffee-table'], LIVING, ['scandi', 'mid-century', 'cottage', 'tropical'], { against: 'free', clear: C(0.3, 0.3, 0.3), top: 0.42 }),
  'trunk-coffee-table': def('table', ['coffee-table', 'bed-bench'], [...LIVING, 'bed-primary'], ['farmhouse', 'industrial', 'craftsman'], { against: 'free', clear: C(0.3, 0.3, 0.3), top: 0.46 }),
  // storage.ts
  'dresser': def('storage', ['dresser'], BEDS, [], { top: 0.85 }),
  'tall-cabinet': def('storage', ['tall-storage', 'linen'], [...BEDS, 'hall', ...BATHS, 'laundry', ...KITCHENS, 'garage'], MODERN, { clear: C(0.8) }),
  'sideboard': def('storage', ['sideboard', 'credenza'], [...DINING, 'living', 'hall', 'foyer'], [], { clear: C(0.7), colorRole: 'wood', top: 0.95 }),
  'open-shelving': def('storage', ['bookcase', 'shelving'], [...LIVING, ...WORK, 'bed-guest', 'bed-kid', 'hall', 'laundry', 'garage', 'greenhouse'], ['modern', 'industrial', 'scandi'], { clear: C(0.6), colorRole: 'wood' }),
  'cube-storage': def('storage', ['toy-storage', 'shelving'], [...KIDS, 'living', 'study', 'hall'], ['scandi', 'modern'], { clear: C(0.6), colorRole: 'wood' }),
  'shoe-rack': def('storage', ['shoe-rack'], ['foyer', 'hall', 'laundry'], [], { clear: C(0.5), colorRole: 'wood' }),
  'coat-rack': def('storage', ['coat-rack'], ['foyer', 'hall'], [], { against: 'corner', clear: C(0.4, 0.1), colorRole: 'wood' }),
  'ladder-shelf': def('storage', ['bookcase', 'shelving'], [...LIVING, ...WORK, 'bed-guest', 'hall', ...BATHS], ['scandi', 'modern', 'farmhouse'], { clear: C(0.5), colorRole: 'wood' }),
  'wine-rack': def('storage', ['wine'], ['bar', ...KITCHENS, 'dining'], [], { clear: C(0.6), colorRole: 'wood' }),
  'chest': def('storage', ['bed-bench', 'toy-storage', 'chest'], [...BEDS, 'living', 'hall'], TRAD, { clear: C(0.4), colorRole: 'wood', top: 0.56 }),
  'wall-hooks': def('art', ['hooks'], ['foyer', 'hall', ...BATHS, 'laundry', 'bed-kid'], [], { mountY: 1.6, colorRole: 'wood' }),
  'laundry-hamper': def('storage', ['hamper'], [...BEDS, ...BATHS, 'laundry'], [], { against: 'corner', clear: C(0.3), colorRole: 'wood' }),
  'storage-bench': def('seating', ['bench', 'bed-bench'], ['foyer', 'hall', ...BEDS, 'playroom'], [], { against: 'wall', clear: C(0.4), colorRole: 'wood' }),
  'armoire': def('storage', ['wardrobe'], BEDS, ['farmhouse', 'cottage', 'craftsman', 'mediterranean', 'traditional'], { clear: C(0.9), colorRole: 'wood' }),
  'bedside-table': def('storage', ['nightstand'], BEDS, ['mid-century', 'scandi', 'modern'], { clear: C(0.3), colorRole: 'wood', top: 0.56 }),
  'bar-cart': def('storage', ['bar-cart'], ['bar', 'living', 'dining', 'den'], ['mid-century', 'modern', 'industrial'], { clear: C(0.4), colorRole: 'metal' }),
  // beds.ts
  'single-bed': def('bed', ['bed-single'], ['bed-kid', 'bed-guest'], [], { colorRole: 'accent' }),
  'bunk-bed': def('bed', ['bed-bunk'], ['bed-kid'], [], { colorRole: 'accent' }),
  'daybed': def('seating', ['daybed', 'sofa'], ['living', 'sunroom', 'study', 'bed-guest'], ['cottage', 'tropical', 'scandi'], { against: 'wall' }),
  'four-poster-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], ['farmhouse', 'craftsman', 'cottage', 'mediterranean', 'traditional'], { colorRole: 'accent' }),
  'canopy-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], ['tropical', 'mediterranean', 'cottage'], { colorRole: 'accent' }),
  'mattress-on-floor': def('bed', ['bed-low'], ['bed-guest', 'studio'], ['industrial', 'scandi']),
  'toddler-bed': def('bed', ['bed-toddler'], ['nursery', 'bed-kid'], [], { colorRole: 'accent' }),
  'headboard-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], [], { colorRole: 'fabric' }),
  'hammock-indoor': def('seating', ['hammock'], ['sunroom', 'living', 'bed-kid'], ['tropical']),
  'loft-bed': def('bed', ['bed-loft'], ['bed-kid', 'studio'], ['modern', 'scandi', 'industrial'], { colorRole: 'accent' }),
  'pet-bed': def('textile', ['pet'], ['living', 'bed-primary', ...KITCHENS, 'laundry', 'foyer'], [], { against: 'corner', colorRole: 'fabric' }),
  'sleigh-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], ['craftsman', 'farmhouse', 'traditional'], { colorRole: 'accent' }),
  'upholstered-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], ['modern', 'mid-century', 'scandi', 'industrial'], { colorRole: 'fabric2' }),
  'house-bed': def('bed', ['bed-single'], ['bed-kid'], ['scandi', 'modern'], { colorRole: 'accent' }),
  // kitchen.ts
  'fridge': def('appliance', ['fridge'], [...KITCHENS, 'bar', 'garage'], [], { colorRole: 'metal' }),
  'range': def('appliance', ['range'], KITCHENS, [], { top: 0.92 }),
  'range-hood': def('appliance', ['hood'], KITCHENS, [], { hangs: 'wall', mountY: 1.5, clear: C(0, 0, 0) }),
  'sink-run': def('fitted', ['sink-run'], [...KITCHENS, 'laundry', 'bar'], [], { top: 0.9 }),
  'counter-run': def('fitted', ['counter-run'], [...KITCHENS, 'laundry', 'bar'], [], { top: 0.9 }),
  'dishwasher': def('appliance', ['dishwasher'], KITCHENS, [], { top: 0.9 }),
  'upper-cabinets': def('fitted', ['uppers'], [...KITCHENS, 'laundry', 'bar'], [], { hangs: 'wall', mountY: 1.45, clear: C(0, 0, 0) }),
  'pantry': def('fitted', ['pantry', 'tall-storage'], [...KITCHENS, 'laundry'], [], { clear: C(0.9) }),
  'breakfast-bar': def('fitted', ['island', 'peninsula'], [...KITCHENS, 'dining', 'bar'], [], { against: 'center', clear: C(0.9, 0.3, 1.0), top: 0.9 }),
  'kitchen-cart': def('storage', ['cart'], [...KITCHENS, 'dining'], ['farmhouse', 'industrial', 'scandi'], { against: 'wall', clear: C(0.6), colorRole: 'wood', top: 0.9 }),
  'microwave': def('decor', ['counter-appliance'], [...KITCHENS, 'study'], [], { surfaces: ['fitted'], colorRole: null }),
  'coffee-maker': def('decor', ['counter-appliance'], [...KITCHENS, 'study'], [], { surfaces: ['fitted'], colorRole: null }),
  'corner-run': def('fitted', ['corner-run'], [...KITCHENS, 'laundry'], [], { against: 'corner', top: 0.9 }),
  // bathroom.ts
  'bathtub': def('bath', ['tub-built-in'], ['bath', 'ensuite'], [], { clear: C(0.7, 0.05) }),
  'shower-cubicle': def('bath', ['shower'], ['bath', 'ensuite'], [], { against: 'corner', clear: C(0.7, 0.05), colorRole: null }),
  'vanity-sink': def('bath', ['vanity'], BATHS, MODERN, { clear: C(0.7), colorRole: 'cabinet' }),
  'toilet': def('bath', ['toilet'], BATHS, [], { clear: C(0.6, 0.2) }),
  'towel-rail': def('art', ['towel-rail'], BATHS, [], { mountY: 1.0, colorRole: 'metal' }),
  'bath-mat': def('rug', ['bath-mat'], BATHS, []),
  'mirror-cabinet': def('art', ['bath-mirror'], BATHS, MODERN, { mountY: 1.45, colorRole: 'cabinet' }),
  'washing-machine': def('appliance', ['washer'], ['laundry', 'bath', 'garage', ...KITCHENS], [], { clear: C(0.8) }),
  'dryer': def('appliance', ['dryer'], ['laundry', 'bath', 'garage'], [], { clear: C(0.8) }),
  'laundry-basket': def('storage', ['hamper'], [...BATHS, ...BEDS, 'laundry'], [], { against: 'corner', clear: C(0.3), colorRole: 'wood' }),
  'heated-towel-rail': def('art', ['towel-rail'], BATHS, ['modern', 'scandi', 'industrial'], { mountY: 0.4, colorRole: 'metal' }),
  'soap-set': def('decor', ['bath-decor'], [...BATHS, ...KITCHENS], [], { surfaces: ['bath', 'fitted'] }),
  'linen-tower': def('storage', ['linen'], ['bath', 'ensuite', 'laundry'], [], { clear: C(0.6), colorRole: 'cabinet' }),
  'clawfoot-tub': def('bath', ['tub-free'], ['bath', 'ensuite'], ['farmhouse', 'cottage', 'craftsman', 'traditional', 'mediterranean'], { against: 'free', clear: C(0.7, 0.3, 0.2), colorRole: 'linen' }),
  'soaking-tub': def('bath', ['tub-free'], ['bath', 'ensuite'], ['modern', 'scandi', 'mid-century', 'industrial', 'tropical'], { against: 'free', clear: C(0.7, 0.3, 0.2), colorRole: 'linen' }),
  'pedestal-sink': def('bath', ['vanity'], BATHS, ['cottage', 'farmhouse', 'craftsman', 'traditional', 'mediterranean'], { clear: C(0.6), colorRole: 'linen' }),
  'double-vanity': def('bath', ['vanity-double'], ['ensuite', 'bath'], [], { clear: C(0.8), colorRole: 'cabinet' }),
  // lighting.ts (S1's props; placed by the composer's sets — plan C9)
  'floor-lamp': def('lamp', ['floor-lamp'], [...LIVING, ...BEDS, 'foyer', 'hall'], []),
  'arc-floor-lamp': def('lamp', ['floor-lamp', 'arc-lamp'], ['living', 'den', 'media', 'library', 'study'], ['modern', 'mid-century', 'industrial'], { against: 'free', clear: C(0.2, 0.1) }),
  'tripod-floor-lamp': def('lamp', ['floor-lamp'], [...LIVING, 'bed-primary', 'bed-guest'], ['mid-century', 'scandi', 'industrial', 'modern']),
  'pendant-lamp': def('lighting', ['pendant'], [...KITCHENS, ...DINING, 'living', 'hall', 'foyer', 'bed-primary', 'bar'], []),
  'chandelier': def('lighting', ['chandelier'], [...DINING, 'living', 'foyer', 'bed-primary'], ['farmhouse', 'cottage', 'mediterranean', 'craftsman', 'traditional']),
  'ceiling-light': def('lighting', ['ceiling-light'], [], []),
  'wall-sconce': def('art', ['sconce'], ['foyer', 'hall', ...BEDS, 'living', ...BATHS, 'dining'], [], { mountY: 1.5, colorRole: 'linen' }),
  'desk-lamp': def('lamp', ['desk-lamp'], [...WORK, ...BEDS], [], { onSurface: true, surfaces: ['desk', 'storage'] }),
  'lantern': def('lamp', ['lantern'], ['outdoor', 'sunroom', 'living', ...BATHS, 'foyer'], ['mediterranean', 'tropical', 'cottage'], { against: 'free' }),
  'string-lights': def('lighting', ['string-lights'], ['outdoor', 'bed-kid', 'playroom'], [], { hangs: 'wall' }),
  'candle-set': def('decor', ['surface-decor'], [...LIVING, ...DINING, 'bed-primary', ...BATHS], [], { surfaces: ON }),
  'neon-sign': def('art', ['art-neon'], ['bed-kid', 'playroom', 'bar', 'studio', 'media'], ['industrial', 'modern'], { mountY: 1.6 }),
  // soft.ts
  'throw-blanket': def('textile', ['throw'], [...LIVING, ...BEDS], []),
  'cushion-set': def('textile', ['cushions'], [...LIVING, ...BEDS], []),
  'wall-art': def('art', ['art'], [...LIVING, ...BEDS, ...DINING, 'hall', 'foyer', 'studio'], [], { pairsWith: ['sofa', 'bed', 'console', 'sideboard'] }),
  'round-mirror': def('art', ['mirror'], ['foyer', 'hall', ...BEDS, ...BATHS, 'living'], [], { mountY: 1.55, colorRole: null, pairsWith: ['console', 'vanity'] }),
  'wall-clock': def('art', ['clock'], [...KITCHENS, 'study', 'living', 'hall', 'bed-kid'], ['farmhouse', 'industrial', 'mid-century'], { mountY: 1.9, colorRole: 'metal' }),
  'curtains': def('textile', ['curtains'], [...LIVING, ...BEDS, ...DINING], [], { against: 'window', hangs: 'wall' }),
  'wall-hanging': def('art', ['art', 'art-textile'], [...BEDS, 'living', 'hall', 'studio'], ['tropical', 'mediterranean', 'cottage', 'scandi'], { mountY: 1.6 }),
  'vase': def('decor', ['surface-decor'], [...LIVING, ...DINING, ...BEDS, 'foyer', 'hall'], [], { surfaces: ON }),
  'book-stack': def('decor', ['surface-decor'], [...LIVING, ...WORK, ...BEDS], [], { surfaces: ON }),
  'fruit-bowl': def('decor', ['surface-decor-kitchen'], [...KITCHENS, ...DINING], [], { surfaces: ['table', 'fitted'], colorRole: 'wood' }),
  'plant-stand': def('plant', ['plant-floor'], [...LIVING, 'foyer', 'hall', 'bed-primary', 'dining', 'sunroom'], ['mid-century', 'scandi', 'modern', 'cottage']),
  'runner-rug': def('rug', ['runner'], ['hall', 'foyer', ...KITCHENS, 'bed-primary', 'bed-guest', 'laundry'], []),
  'patterned-rug': def('rug', ['rug', 'rug-round', 'play-rug'], [...LIVING, ...BEDS, ...DINING, ...KIDS, 'study'], []),
  'gallery-wall': def('art', ['art-large'], ['living', 'den', 'bed-primary', 'bed-guest', 'hall', 'dining', 'study'], ['modern', 'scandi', 'farmhouse', 'mid-century', 'industrial'], { colorRole: 'fabric2' }),
  // plants.ts
  'snake-plant': def('plant', ['plant-floor', 'plant-small'], [...LIVING, ...BEDS, ...BATHS, 'foyer', 'hall'], []),
  'indoor-palm': def('plant', ['plant-floor', 'plant-tall'], [...LIVING, 'dining', 'foyer', 'sunroom'], ['tropical', 'modern', 'mediterranean']),
  'ficus-tree': def('plant', ['plant-floor', 'plant-tall'], [...LIVING, 'dining', 'foyer', 'bed-primary'], ['scandi', 'modern', 'farmhouse', 'cottage']),
  'olive-tree-pot': def('plant', ['plant-floor', 'plant-tall'], [...LIVING, 'dining', 'foyer', 'sunroom'], ['mediterranean', 'farmhouse', 'modern']),
  'tall-cactus': def('plant', ['plant-floor'], ['living', 'study', 'foyer', 'sunroom'], ['mediterranean', 'modern', 'industrial']),
  'pampas-vase': def('plant', ['plant-floor', 'plant-small'], [...LIVING, 'dining', 'bed-primary', 'foyer'], ['scandi', 'tropical', 'mediterranean', 'cottage']),
  'hanging-plant': def('plant', ['plant-hanging'], [...LIVING, ...KITCHENS, ...BATHS, 'bed-primary', 'sunroom', 'greenhouse'], [], { hangs: 'ceiling', against: 'window' }),
  'herb-pots': def('plant', ['plant-surface-kitchen'], KITCHENS, [], { onSurface: true, surfaces: ['fitted'] }),
  'orchid': def('plant', ['plant-surface'], [...LIVING, ...BATHS, 'bed-primary', 'dining', 'study'], [], { onSurface: true, surfaces: ON }),
  'succulent-tray': def('plant', ['plant-surface'], [...WORK, 'living', ...KITCHENS, ...BEDS], [], { onSurface: true, surfaces: ON }),
  'trailing-ivy': def('plant', ['plant-surface'], [...LIVING, ...WORK, ...BEDS, ...KITCHENS], [], { onSurface: true, surfaces: ON }),
  'fern': def('plant', ['plant-surface'], [...BATHS, ...BEDS, 'living'], [], { onSurface: true, surfaces: ON }),
  'bird-of-paradise': def('plant', ['plant-floor', 'plant-tall'], [...LIVING, 'dining', 'foyer', 'sunroom'], ['tropical', 'modern', 'mid-century']),
  'rubber-plant': def('plant', ['plant-floor'], [...LIVING, ...BEDS, 'foyer', 'study'], ['modern', 'industrial', 'scandi', 'mid-century']),
  'zz-plant': def('plant', ['plant-floor', 'plant-small'], [...LIVING, ...BEDS, ...BATHS, 'foyer', 'hall'], []),
  'dracaena': def('plant', ['plant-floor', 'plant-tall'], [...LIVING, 'dining', 'foyer', 'study'], ['modern', 'scandi', 'tropical']),
  // kids.ts
  'toy-box': def('kids', ['toy-storage'], KIDS, [], { clear: C(0.6) }),
  'play-kitchen': def('kids', ['play'], ['playroom', 'bed-kid'], []),
  'easel': def('kids', ['play', 'easel'], ['playroom', 'bed-kid', 'studio'], [], { against: 'free', clear: C(0.6, 0.2) }),
  'rocking-horse': def('kids', ['play'], ['nursery', 'bed-kid', 'playroom'], TRAD, { against: 'free', clear: C(0.3, 0.2) }),
  'low-bookshelf': def('kids', ['toy-storage', 'bookcase-low'], [...KIDS, 'living'], []),
  'beanbag': def('seating', ['floor-seat'], [...KIDS, 'den', 'media'], [], { clear: C(0.2, 0.1) }),
  'play-tent': def('kids', ['play'], ['bed-kid', 'playroom'], ['scandi', 'modern', 'cottage'], { against: 'corner', clear: C(0.5, 0.1) }),
  'drum-kit': def('music', ['instrument'], ['playroom', 'bed-kid', 'studio', 'garage', 'den'], [], { against: 'corner', clear: C(0.6, 0.2) }),
  'guitar-stand': def('music', ['instrument-small'], ['bed-kid', 'studio', 'living', 'den', 'study'], [], { against: 'corner', clear: C(0.3, 0.1) }),
  'gaming-chair': def('chair', ['desk-chair'], ['bed-kid', 'den', 'media', 'study'], ['modern'], { colorRole: 'accent' }),
  'building-blocks': def('kids', ['toys'], KIDS, [], { against: 'free', clear: C(0) }),
  'height-chart': def('art', ['kids-wall'], ['bed-kid', 'playroom', 'nursery', 'hall'], [], { mountY: 1.0, colorRole: 'wood' }),
  'teddy-bear': def('kids', ['toys'], ['nursery', 'bed-kid'], [], { against: 'free', clear: C(0) }),
  'changing-table': def('kids', ['changing'], ['nursery'], [], { clear: C(0.7), colorRole: 'linen', top: 0.95 }),
  'nursery-glider': def('seating', ['armchair', 'glider'], ['nursery', 'bed-primary'], [], { faces: 'room' }),
  'kids-desk': def('kids', ['desk-kid'], ['bed-kid', 'playroom'], [], { clear: C(0.3), colorRole: 'linen' }),
  // office.ts
  'filing-cabinet': def('storage', ['filing'], ['study', 'studio', 'library'], ['industrial', 'modern'], { clear: C(0.7), colorRole: 'cabinet' }),
  'printer': def('decor', ['office-kit'], ['study'], [], { surfaces: ['desk', 'storage'], colorRole: null }),
  'standing-desk': def('desk', ['desk'], ['study', 'studio'], ['modern', 'industrial', 'scandi']),
  'whiteboard': def('art', ['board'], ['study', 'studio', 'playroom'], ['modern', 'industrial'], { mountY: 1.2, colorRole: 'metal' }),
  'server-rack': def('storage', ['server'], ['study', 'garage'], ['industrial', 'modern'], { clear: C(0.7), colorRole: null }),
  'dual-monitor-arm': def('decor', ['office-kit'], ['study'], [], { surfaces: ['desk'], colorRole: null }),
  'keyboard-piano': def('music', ['instrument', 'piano'], ['studio', 'living', 'bed-kid', 'study', 'playroom'], ['modern', 'industrial', 'scandi'], { clear: C(0.7) }),
  'record-player': def('decor', ['surface-decor'], ['living', 'den', 'studio', 'study', 'bed-primary'], ['mid-century', 'industrial', 'scandi'], { surfaces: ['storage'], colorRole: 'wood' }),
  'tv-stand': def('storage', ['media'], ['living', 'den', 'media', 'bed-kid', 'bed-guest'], ['modern', 'scandi'], { clear: C(0.6), colorRole: 'wood' }),
  'projector': def('decor', ['av'], ['media', 'den'], [], { surfaces: ON, colorRole: null }),
  'laptop': def('decor', ['office-kit'], [...WORK, ...BEDS, 'living'], [], { surfaces: ['desk', 'table'], colorRole: null }),
  'pin-board': def('art', ['board'], ['study', 'studio', 'bed-kid', ...KITCHENS], [], { mountY: 1.4, colorRole: 'wood' }),
  'grand-piano': def('music', ['piano-grand'], ['living', 'library', 'studio'], [], { against: 'free', clear: C(0.6, 0.4, 0.4), colorRole: null }),
  'upright-piano': def('music', ['piano'], ['living', 'library', 'studio', 'den', 'playroom'], ['farmhouse', 'cottage', 'craftsman', 'traditional', 'mediterranean'], { clear: C(0.3), colorRole: 'wood' }),
  // outdoor.ts (S4's props; only the composer's outdoor program places them)
  'patio-set': def('outdoor', ['outdoor-dining'], ['outdoor'], []),
  'lounger-set': def('outdoor', ['lounger'], ['outdoor'], []),
  'hammock': def('outdoor', ['hammock'], ['outdoor'], []),
  'bbq-grill': def('outdoor', ['grill'], ['outdoor'], [], { against: 'wall' }),
  'fire-bowl': def('outdoor', ['fire'], ['outdoor'], [], { colorRole: null }),
  'outdoor-sofa': def('outdoor', ['outdoor-seat'], ['outdoor', 'sunroom'], []),
  'umbrella-table': def('outdoor', ['outdoor-dining'], ['outdoor'], []),
  'bird-bath': def('outdoor', ['garden'], ['outdoor'], []),
  'mailbox': def('outdoor', ['garden'], ['outdoor'], []),
  'bicycle': def('outdoor', ['vehicle'], ['outdoor', 'garage', 'foyer'], [], { against: 'wall' }),
  'swing-set': def('outdoor', ['play-outdoor'], ['outdoor'], []),
  'sandbox': def('outdoor', ['play-outdoor'], ['outdoor'], []),
  'trampoline': def('outdoor', ['play-outdoor'], ['outdoor'], [], { colorRole: null }),
  'dog-house': def('outdoor', ['pet'], ['outdoor'], []),
  'wheelbarrow': def('outdoor', ['garden'], ['outdoor', 'garage'], []),
  'garden-fountain': def('outdoor', ['garden'], ['outdoor'], []),
  'picnic-table': def('outdoor', ['outdoor-dining'], ['outdoor'], []),
  'patio-heater': def('outdoor', ['heater'], ['outdoor'], []),
  // hobby.ts
  'exercise-bike': def('gym', ['cardio'], ['gym', 'garage', 'bed-guest'], []),
  'weight-bench': def('gym', ['weights'], ['gym', 'garage'], []),
  'yoga-mat': def('gym', ['mat'], ['gym', 'sunroom', 'bed-primary'], [], { colorRole: 'accent', clear: C(0.2, 0.3) }),
  'workbench': def('storage', ['workbench'], ['garage', 'laundry', 'studio'], [], { clear: C(0.9), colorRole: 'wood' }),
  'potting-bench': def('storage', ['potting'], ['greenhouse', 'sunroom'], [], { clear: C(0.8), colorRole: 'wood' }),
};

/** the placement of a type, or null when the table does not know it */
export const placeOf = (type: string): Place | null => PLACEMENT[type] || null;
