// Placement metadata for the PAGE builders (item-map.ts's ITEMS: 39 of the catalog's types) — the same `place` block a
// registry prop carries (assets/props/placement.ts), so the catalog has one for every type. Keys are ITEMS types;
// assets/item-meta.ts joins this to item-map.ts's ITEM_PARAMS (S1's) as the catalog's entry for a page type, and
// assets/props/placement.ts merges it into PLACEMENT, the table the composer and the lints read.
//
// A page builder's `size` is declared here because the composer runs in Node, where the builder cannot: the catalog
// measures the real box and scripts/test-room-composer.mts fails when this drifts from it. The parameters a builder
// honours are S1's (ITEM_PARAMS in item-map.ts): scripts/test-builder-seams.mts keeps them honest.
//
// Owner: S3 (compose).
import { def, C, LIVING, BEDS, KIDS, BATHS, KITCHENS, DINING, WORK, MODERN, WARM, ON } from './place-kit.js';
import type { Place } from './place-kit.js';
export type PagePlace = Place;

export const PAGE_PLACE: Readonly<Record<string, PagePlace>> = {
  'sectional': def('seating', ['sofa-l'], LIVING, MODERN, { size: { w: 2.4, d: 1.8, h: 0.76, oz: 0.4 }, colorRole: null }),
  'club-chair': def('seating', ['armchair'], LIVING, ['modern', 'industrial', 'craftsman'], { size: { w: 0.82, d: 0.68, h: 0.9 } }),
  'coffee-table': def('table', ['coffee-table'], LIVING, MODERN, { against: 'free', clear: C(0.3, 0.3, 0.3), size: { w: 1.2, d: 0.6, h: 0.4 }, colorRole: null, top: 0.4 }),
  'octagonal-table': def('table', ['coffee-table'], LIVING, WARM, { against: 'free', clear: C(0.3, 0.3, 0.3), size: { w: 1.36, d: 1.36, h: 0.6 }, colorRole: null, top: 0.6 }),
  'dining-set': def('table', ['dining-set'], DINING, [], { clear: C(0.6, 0.6, 0.6), size: { w: 2, d: 2.09, h: 0.99 }, colorRole: null }),
  'dining-table': def('table', ['dining-set'], DINING, [], { clear: C(0.6, 0.6, 0.6), size: { w: 2.1, d: 2.04, h: 0.83 }, colorRole: null }),
  'kitchen-island': def('fitted', ['island'], KITCHENS, [], { against: 'center', clear: C(1.0, 0.9, 1.0), size: { w: 2.4, d: 1.36, h: 1.18, oz: 0.23 }, top: 0.92 }),
  'kitchen-cabinetry': def('fitted', ['kitchen-run'], KITCHENS, [], { size: { w: 3.64, d: 0.69, h: 1.67 }, colorRole: null, top: 0.9 }),
  'media-credenza': def('storage', ['media', 'credenza'], LIVING, MODERN, { clear: C(0.5), size: { w: 1.8, d: 0.45, h: 0.72 }, colorRole: null, top: 0.72 }),
  'wall-tv': def('art', ['tv'], LIVING, [], { mountY: 1.3, size: { w: 1.6, d: 0.05, h: 0.9, y0: -0.45 }, colorRole: null }),
  'fireplace': def('storage', ['fireplace'], ['living', 'den', 'library', 'bed-primary'], [], { clear: C(1.0, 0.3), size: { w: 1.6, d: 0.36, h: 0.65, y0: 0.225 }, colorRole: null }),
  'area-rug': def('rug', ['rug'], [...LIVING, ...BEDS, ...DINING], MODERN, { size: { w: 3.2, d: 2.2, h: 0.02 } }),
  'circular-rug': def('rug', ['rug-round'], [...LIVING, ...BEDS, ...KIDS, ...DINING], [], { size: { w: 4, d: 4, h: 0.01 } }),
  'concentric-rug': def('rug', ['rug-round'], [...LIVING, ...DINING], MODERN, { size: { w: 3.2, d: 3.2, h: 0.02 }, colorRole: null }),
  'sun-lounger': def('outdoor', ['lounger'], ['outdoor', 'sunroom'], [], { size: { w: 0.7, d: 1.9, h: 0.48, y0: 0.1 }, colorRole: null }),
  'bench': def('seating', ['bench', 'bed-bench'], ['foyer', 'hall', ...BEDS, ...DINING], MODERN, { clear: C(0.3), faces: 'room', size: { w: 1.8, d: 0.5, h: 0.48 }, colorRole: null }),
  'platform-bed': def('bed', ['bed'], ['bed-primary', 'bed-guest'], MODERN, { size: { w: 3.18, d: 2.3, h: 1.1 } }),
  'wardrobe': def('storage', ['wardrobe'], BEDS, MODERN, { clear: C(0.9), size: { w: 2.2, d: 0.64, h: 2.5, oz: 0.019 }, colorRole: null }),
  'crib': def('bed', ['crib'], ['nursery'], [], { clear: C(0.6, 0.3), size: { w: 1.3, d: 0.75, h: 0.97 } }),
  'ensuite': def('bath', ['bath-pod'], BATHS, [], { clear: C(0.9), size: { w: 2.4, d: 2, h: 2.11 }, colorRole: null }),
  'bookshelf': def('storage', ['bookcase'], [...WORK, 'living', 'den', 'bed-guest', 'hall'], [], { size: { w: 1.18, d: 0.35, h: 2 }, colorRole: null }),
  'walnut-desk': def('hero', ['hero-desk'], WORK, [], { size: { w: 1.8, d: 0.85, h: 0.77 } }),
  'task-chair': def('hero', ['desk-chair'], WORK, [], { tucks: true, size: { w: 0.53, d: 0.55, h: 0.98, oz: 0.005, y0: 0.065 } }),
  'curved-monitor': def('hero', [], WORK, [], { onSurface: true, surfaces: ['desk'], size: { w: 1.05, d: 0.32, h: 0.81, oz: 0.05 } }),
  'chalk-tower': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.26, d: 0.31, h: 0.09, ox: -0.012, oz: -0.052 } }),
  'charcoal-tower': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.26, d: 0.31, h: 0.09, ox: -0.012, oz: -0.052 } }),
  'core-shelf': def('hero', [], [], [], { hangs: 'wall', size: { w: 0.9, d: 0.34, h: 0.26, oz: 0.169, y0: 0.745 } }),
  'strix-mini': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 0.24, d: 0.24, h: 0.09 } }),
  'speakers': def('hero', [], [], [], { onSurface: true, surfaces: ON, size: { w: 1.48, d: 0.22, h: 0.28, oz: 0.012 } }),
  'halo-lamp': def('lamp', ['legacy-lamp'], [...LIVING, ...BEDS], MODERN, { size: { w: 0.4, d: 0.4, h: 1.71 }, colorRole: null }),
  'fiddle-leaf': def('plant', ['plant-floor'], [...LIVING, 'dining', 'foyer'], [], { size: { w: 1.32, d: 1.26, h: 2.44, ox: 0.026 }, colorRole: null }),
  'monstera': def('plant', ['plant-floor'], [...LIVING, 'dining', 'foyer', 'bed-primary'], ['modern', 'tropical', 'mid-century', 'scandi'], { size: { w: 1.01, d: 1.17, h: 1.31 }, colorRole: null }),
  'bonsai': def('plant', ['plant-surface'], [...WORK, 'living'], [], { onSurface: true, surfaces: ON, size: { w: 0.57, d: 0.48, h: 0.5, ox: 0.044 }, colorRole: null }),
  'bamboo': def('plant', ['plant-screen'], ['sunroom', 'greenhouse', 'outdoor'], ['modern', 'tropical'], { against: 'wall', size: { w: 1.6, d: 0.4, h: 2.8 }, colorRole: null }),
  'cactus-group': def('plant', ['plant-floor'], ['sunroom', 'greenhouse', 'living'], ['mediterranean', 'modern'], { size: { w: 1.67, d: 1.27, h: 2.3, ox: -0.115, oz: 0.115, y0: -0.1 }, colorRole: null }),
  'telescope': def('decor', ['curio'], ['study', 'library', 'living'], [], { onSurface: false, against: 'window', clear: C(0.3, 0.2), size: { w: 0.69, d: 1.09, h: 1.69, ox: 0.108, oz: -0.02 }, colorRole: null }),
  'soccer-goal': def('outdoor', ['play-outdoor'], ['outdoor'], [], { size: { w: 1.86, d: 1.22, h: 1.13, oz: 0.01 }, colorRole: null }),
  'low-wall': def('structure', [], [], [], { size: { w: 3.04, d: 0.2, h: 0.89 } }),
  'column': def('structure', [], [], [], { size: { w: 0.4, d: 0.4, h: 2.62 } }),
};
