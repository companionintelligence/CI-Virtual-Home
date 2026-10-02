// Realism feature "sky": a procedural dome, clouds, a sun and a moon and stars, and a sky-based environment, in the live
// player only (assets/viewer-sky.ts has the work and the reasoning). Registered in assets/realism.ts's TABLE.
//
// phase 'post-batch': the dome is a mesh added to the scene, and nothing here may be seen by the static batching
// (viewer-batch.ts merges meshes once per house build, before the features install). `?no=sky` turns it off. Tier 1 and
// up (the registry's tier 0 is today's page); the handle's setTier lightens it (two noise octaves, a still sky) when the
// ladder sheds a rung, and the page's own sky comes back with it.
import type { RealismFeature } from './realism.js';
import { createSky } from './viewer-sky.js';

const feature: RealismFeature = {
  key: 'sky',
  phase: 'post-batch',
  minTier: 1,
  async install(ctx) {
    if (ctx.no.has('sky')) return null;
    try {
      return createSky(ctx);
    } catch (err) {
      // a throw leaves the house as built
      console.warn('sky: not installed', err);
      return null;
    }
  },
};
export default feature;
