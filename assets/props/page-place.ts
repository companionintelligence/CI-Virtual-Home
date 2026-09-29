// Placement metadata for the PAGE builders (item-map.ts's ITEMS: 39 of the catalog's types) — the same `place`
// block a registry prop carries in its definition (assets/props/*.ts), so the catalog has one for every type.
//
//   'fireplace': { against: 'wall', clear: { front: 1.0, side: 0.3, back: 0 }, faces: 'room', … }
//
// Seam module (plan S0): an empty table, owned by S3 (compose), who defines the `place` shape (plan S3 contract:
// against, clear, faces, group, hangs, mountY, onSurface, surfaces, programs, styles, pairsWith) and tightens
// PagePlace to it. Keys are ITEMS types. assets/item-meta.ts joins it to item-map.ts's ITEM_PARAMS as the catalog's
// entry for a page type; scripts/build-prop-catalog.mts writes it. S1's parameters and S3's placement live in
// different files on purpose: neither stream edits the other's hunk.
export type PagePlace = Record<string, unknown>;

export const PAGE_PLACE: Readonly<Record<string, PagePlace>> = {};
