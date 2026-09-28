// The build context — what every piece of the house builder shares: the page's dependencies (THREE, the asset
// factories, the scene hooks) and the small helpers every builder module uses (std, box, group, hex, mix).
//
// house-builder.ts creates one per page (createHouseBuilder) and hands it to each seam module:
//   kit-build.ts       palette, kit, and the spec → parameters the others ask it for   (S1 kit)
//   item-map.ts        the ITEMS map — spec item type → AssetFactory builder            (S1 kit)
//   hero-build.ts      the Companion Core, its surface and its cables                  (S1 kit)
//   structure-build.ts slabs, walls, partitions, stairs, balustrades, ceilings, roofs  (S2 architecture)
//   rooms-build.ts     the rooms loop: every room item placed and themed               (S3 compose)
//   site-build.ts      the lot, the world, the site builders and the site loop         (S4 site)
//   shot-planner-v1.ts shotsFor and its routing (door-to-core, orbits, reveal)         (S5 shot)
//
// Owned by S0 and frozen: a stream that needs another helper adds it to its own module. A stream that needs another
// page dependency (S5's raycaster …) has the page pass it (room-creator.html, houseBuilderDeps — one slot per
// stream) and reads it here as `bctx.extra.<name>`: every dep this file does not name lands in `extra`.

export const DEG = Math.PI / 180;
export const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16));
export const mix = (a, b, t) => { // blend two hex colours
  const A = hex(a), B = hex(b);
  const r = ((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t, g = ((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t, bl = (A & 255) * (1 - t) + (B & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

export type BuildContext = ReturnType<typeof createBuildContext>;

export function createBuildContext(deps) {
  const {
    THREE, AssetFactory, ProceduralArchitecture, addItemToScene, registerTrackedWall, registerRoof, registerCeiling, fitShadow,
    setLightingPreset, textures = {}, useGraphWalls = false, ...extra
  } = deps;

  // ---------------------------------------------------------------------------------------
  // Materials
  // ---------------------------------------------------------------------------------------
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color: hex(color), roughness: 0.75, ...extra });
  const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.32, roughness: 0.06, transmission: 0.85, ior: 1.52 });

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  const group = (name, userData = {}) => { const g = new THREE.Group(); g.name = name; g.userData = { category: 'House', ...userData }; return g; };

  return {
    THREE, AssetFactory, ProceduralArchitecture, addItemToScene, registerTrackedWall, registerRoof, registerCeiling, fitShadow,
    setLightingPreset, textures, useGraphWalls,
    std, glassMat, box, group, hex, mix, DEG,
    /** every page dependency not named above, by the name the page passed it under */
    extra: extra as Record<string, any>
  };
}
