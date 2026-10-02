// Live-player realism: baked ambient occlusion and furniture contact shadows.
//
// STUB from the realism scaffold (package "ao-contact" replaces this file). Registered in assets/realism.ts's TABLE; it
// installs nothing, so with it the player draws exactly what it drew before. See the contract at the top of
// assets/realism.ts and README.md → "Live realism (the player)".
import type { RealismFeature } from './realism.js';

const feature: RealismFeature = {
  key: 'ao',
  phase: 'post-batch',
  minTier: 1,
  install: async () => null,
};
export default feature;
