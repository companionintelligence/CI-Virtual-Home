// Live-player realism: procedural sky, clouds, stars, sky-based light and fresnel glass.
//
// STUB from the realism scaffold (package "sky-glass" replaces this file). Registered in assets/realism.ts's TABLE; it
// installs nothing, so with it the player draws exactly what it drew before. See the contract at the top of
// assets/realism.ts and README.md → "Live realism (the player)".
import type { RealismFeature } from './realism.js';

const feature: RealismFeature = {
  key: 'sky',
  phase: 'post-batch',
  minTier: 1,
  install: async () => null,
};
export default feature;
