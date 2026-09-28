// Validator plugin — owned by S3 (compose). See _types.mts for the contract. Starts empty (plan S0); the stream adds its
// lints here, as warnings until the layout pass promotes them (plan §2.0).
import type { Check } from './_types.mts';

// Runs only under `pnpm run validate --layout` (plan S3: baseline counts for the 30 specs, as warnings).
export const flag = 'layout';

const check: Check = (spec, ctx) => [];
export default check;
