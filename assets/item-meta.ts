// What the catalog knows about a PAGE item type (item-map.ts's ITEMS), in the shape a registry prop's definition
// has — so scripts/build-prop-catalog.mts, the validator's silent-parameter lint and S3's layout lints read one
// thing for every type, registry or page:
//
//   const def = PROPS.get(type) ?? pageItemDef(type)      // { params, tags, surface, iso, place? }
//
// Joins ITEM_PARAMS and SURFACE_ITEMS (item-map.ts, S1) with PAGE_PLACE (props/page-place.ts, S3). THREE-free: it
// runs in Node with nothing built. Owned by S0 and frozen; the data it joins belongs to S1 and S3.
import { ITEM_PARAMS, SURFACE_ITEMS } from './item-map.js';
import { PAGE_PLACE } from './props/page-place.js';
import type { PagePlace } from './props/page-place.js';

export interface PageItemDef {
  /** the spec keys the builder honours (ITEM_PARAMS) */
  params: string[];
  tags: string[];
  /** stands on a desk (SURFACE_ITEMS) */
  surface: boolean;
  iso: null;
  /** S3's placement metadata, when it has written some for this type */
  place?: PagePlace;
}

/** the catalog definition of a page item type, or undefined when `type` is not one (a registry prop, or unknown) */
export function pageItemDef(type: string): PageItemDef | undefined {
  const params = ITEM_PARAMS[type];
  if (!params) return undefined;
  const place = PAGE_PLACE[type];
  return { params: [...params], tags: [], surface: SURFACE_ITEMS.includes(type), iso: null, ...(place ? { place } : {}) };
}
