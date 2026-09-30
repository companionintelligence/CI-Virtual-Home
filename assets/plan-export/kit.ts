// <id>.plan.json's `kit` key. Owned by S1 (kit): edit only this file (index.ts beside it has the contract).
//   colors, cladding   the role colours and the house's cladding (kit-build.ts kitAnchors: anchors.kit)
//   lighting           { preset, sunBearing, swing, look } — what the light resolved to (kit-build.ts lightHouse)
//   hero               { coreBox, surfaceTop, surfaceType } — the Core's exact box [minX, minY, minZ, maxX, maxY, maxZ], for S5's Node harness (C7)
//   doors              every hinged leaf in world terms (anchors.doors, without its pivot object)
//   openings           every perimeter opening (anchors.openings), for S2's facade dressing
// Return undefined to leave the key out of the file.
export const pick = (a: any): unknown => {
  if (!a.kit) return null;
  const h = a.hero || null;
  return {
    ...a.kit,
    ...(a.lighting ? { lighting: a.lighting } : {}),
    ...(h && h.coreBox ? { hero: { coreBox: h.coreBox, surfaceTop: h.surfaceTop, surfaceType: h.surfaceType || h.surface } } : {}),
    ...(Array.isArray(a.doors) ? { doors: a.doors } : {}),
    ...(Array.isArray(a.openings) ? { openings: a.openings } : {}),
  };
};
