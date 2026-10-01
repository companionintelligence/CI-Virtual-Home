// Realism feature "sky": a procedural dome, clouds, a sun and a moon and stars, and a sky-based environment, in the live
// player only (assets/viewer-sky.ts has the work and the reasoning). The plan's registry (assets/realism.ts, from the
// realism-core scaffold) lists this module once; the types below are that file's RealismCtx / RealismFeature as far as
// the sky uses them, structural so this module compiles and runs without it.
//
// phase 'post-batch': the dome is a mesh added to the scene, and nothing here may be seen by the static batching
// (viewer-batch.ts merges meshes once per house build, before the features install). `?no=sky` turns it off.
import { createSky } from './viewer-sky.js';
import type { SkyCtx, SkyHandle } from './viewer-sky.js';

export type RealismHandleLike = SkyHandle & { keepsOpaqueGlass?(): boolean; idle?(idleMs: number): boolean; render?(hq: boolean): boolean };
export type RealismFeatureLike = {
  key: 'sky';
  phase: 'post-batch';
  minTier: 0;
  batchSensitive?: boolean;
  prefetch?(houseId: string, ctx: SkyCtx): void;
  install(ctx: SkyCtx): Promise<RealismHandleLike | null>;
};

export const feature: RealismFeatureLike = {
  key: 'sky',
  phase: 'post-batch',
  minTier: 0,
  async install(ctx: SkyCtx) {
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
