// Live-player realism: CC0 PBR detail textures and hero props (the "assets" feature).
//
// The eager part: this file is what the realism registry (assets/realism.ts) loads for every visitor, so it is a few lines and
// imports nothing at load. The registry, the manifest of files and the download code are in assets/media-registry.ts and
// assets/media-assets.ts, imported only when a house is opened at tier 1 or above; the files themselves (assets/media/assets/**,
// hash in every name) are fetched after the first frame, by the prefetch below and by install().
//
// phase 'pre-batch' + batchSensitive: a prop swap changes which meshes exist (viewer-batch merges the visible ones), so apply() and
// restore() run with the batch undone. The texture swap alone would not need it (pointer assignments on the builders' own materials).
// ?no=assets switches the feature off; at tier 0 nothing is installed or downloaded.
import type { RealismFeature, RealismCtx } from './realism.js';

let mod: Promise<typeof import('./media-registry.js')> | null = null;
const registry = () => mod || (mod = import('./media-registry.js'));

const feature: RealismFeature = {
  key: 'assets',
  phase: 'pre-batch',
  minTier: 1,
  batchSensitive: true,
  // as soon as the house id is known, before the house is built: only downloads start
  prefetch(houseId: string, ctx: RealismCtx) {
    const tier = ctx.tier();
    if (tier < 1) return;   // (a promotion later installs, and install() fetches what it needs then)
    void registry().then(m => m.prefetch(houseId, tier)).catch(() => {});
  },
  async install(ctx: RealismCtx) {
    const m = await registry();
    return m.install(ctx);
  },
};
export default feature;
