// The placement vocabulary: the `Place` block every catalog type carries (how it stands in a room), the group defaults
// `def()` builds it from, and the room-program groups the tables share. THREE-free and dependency-free.
//
// Two tables use it: assets/props/page-place.ts (the page's AssetFactory builders, the seam item-meta.ts reads) and
// assets/props/placement.ts (every registry prop, and the whole table the composer and the lints read: PLACEMENT).
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
//   size      page builders only: the declared box (footprint w × d, height h, the box centre's offset ox / oz from the
//             origin, and its floor y0) — the composer needs it in Node, where the builder cannot run;
//             scripts/test-room-composer.mts fails when it drifts from the catalog's measured box
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
   *  origin, and its floor y0) */
  size?: { w: number; d: number; h: number; ox?: number; oz?: number; y0?: number };
}

export type Over = Partial<Place>;
export const C = (front: number, side = 0.05, back = 0) => ({ front, side, back });
// group defaults: what a thing of each kind usually needs
export const BASE: Record<string, Over> = {
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
export function def(group: string, roles: string[], programs: string[], styles: string[] = [], over: Over = {}): Place {
  return {
    against: 'free', clear: C(0.3), faces: 'room', hangs: null, onSurface: false, surfaces: [], pairsWith: [], colorRole: null,
    ...BASE[group], group, roles, programs, styles, ...over,
  } as Place;
}
export const LIVING = ['living', 'den', 'media', 'library', 'sunroom', 'study'];
export const BEDS = ['bed-primary', 'bed-guest', 'bed-kid', 'nursery'];
export const KIDS = ['bed-kid', 'nursery', 'playroom'];
export const BATHS = ['bath', 'ensuite', 'powder'];
export const KITCHENS = ['kitchen', 'kitchen-dining'];
export const DINING = ['dining', 'kitchen-dining'];
export const WORK = ['study', 'library', 'studio'];
export const TRAD = ['farmhouse', 'cottage', 'craftsman', 'traditional'];
export const MODERN = ['modern', 'scandi', 'mid-century', 'industrial'];
export const WARM = ['mediterranean', 'tropical'];
export const ON = ['table', 'storage', 'desk'];
