// Validator plugin — owned by S4 (site). See _types.mts for the contract. Starts empty (plan S0); the stream adds its
// lints here, as warnings until the layout pass promotes them (plan §2.0).
import type { Check } from './_types.mts';

const check: Check = (spec, ctx) => [];
export default check;
