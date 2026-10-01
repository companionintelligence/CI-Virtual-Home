// Live-player realism: animated, sky-reflecting water; an FFT ocean loads lazily on the big bodies at tier 2.
//
// Registered in assets/realism.ts's TABLE. Post-batch: the pools' box tops are merged by viewer-batch.ts like any
// static mesh, and the patch targets what the scene has after that (the merged meshes), so the feature installs
// once the batch is baked and before the first compile. The heavy part (viewer-water.ts, 12 KB of source; the ocean
// 14 KB more, lazily and only on tier 2) is imported on demand. See that file's header for what is patched.
// ?no=water (or ?no=realism) turns it off; ?no=ocean keeps the analytic water and skips the FFT.
import type { RealismFeature } from './realism.js';
import { checkChunks, createWater } from './viewer-water.js';

const feature: RealismFeature = {
  key: 'water',
  phase: 'post-batch',
  minTier: 1,
  async install(ctx) {
    if (!checkChunks(ctx.THREE)) return null;
    // nothing to do for a house without water: no texture, no clone
    let any = false;
    ctx.scene.traverse((o: any) => {
      if (any || !o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.userData && m.userData.surface === 'water') { any = true; return; }
      if (o.name === 'World · lake') any = true;
    });
    if (!any) return null;
    return createWater(ctx);
  },
};
export default feature;
