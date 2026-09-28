// Validator plugin — owned by S4 (site). See _types.mts for the contract. Starts empty (plan S0); the stream adds its
// lints here, as warnings until the layout pass promotes them (plan §2.0).
// What the core accepts is widened from here too, never in validate-house-spec.mts: `export const extend = { … }`
// and `export const replaces = [ … ]` (_types.mts). This stream's: grounds (site types: SITE_KIT_TYPES in assets/site.ts); rule 'site-needs'.
import type { Check } from './_types.mts';

const check: Check = (spec, ctx) => [];
export default check;
