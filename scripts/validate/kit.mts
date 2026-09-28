// Validator plugin — owned by S1 (kit). See _types.mts for the contract. Starts empty (plan S0); the stream adds its
// lints here, as warnings until the layout pass promotes them (plan §2.0).
// What the core accepts is widened from here too, never in validate-house-spec.mts: `export const extend = { … }`
// and `export const replaces = [ … ]` (_types.mts). This stream's: heroSurfaces, heroDevices, heroPoses, openingTypes.
import type { Check } from './_types.mts';

const check: Check = (spec, ctx) => [];
export default check;
