// A build context for calling a builder FACTORY (createItemMap, createSiteBuild …) outside the page, to read what it
// returns — its ITEMS / SITE keys, the source of a builder — without building anything. Every property of it, at any
// depth, is a callable stand-in for itself: `new THREE.CylinderGeometry(1, 1, 1, 8)`, `std(0x333).color.set(…)` and
// `AssetFactory.create…()` at factory scope all evaluate instead of throwing, so a factory that builds a shared
// geometry or caches a material up front cannot take the validator, the catalog builder and every Node tool down
// with a TypeError that never mentions them. Arithmetic on a stand-in is 0, and it is never a thenable.
//
//   const { ITEMS } = createItemMap(probeContext());
//
// Used by validate-house-spec.mts (the item and site type lists) and scripts/test-builder-seams.mts.
export function probeContext(): any {
  const stand: any = new Proxy(function probe() {}, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : stand),
    apply: () => stand,
    construct: () => stand,
  });
  return stand;
}
