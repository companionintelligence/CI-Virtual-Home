// Validator plugin — owned by S0. `defaults` is the look switch (plan §2.0): absent or 1 renders today's look
// exactly; 2 opts the house into every stream's new look-changing defaults. Read it through specDefaults()
// (assets/spec/index.ts), never directly.
import type { Check } from './_types.mts';

const check: Check = spec => (spec.defaults === undefined || spec.defaults === 1 || spec.defaults === 2) ? []
  : [{ level: 'error', code: 'defaults', message: `defaults ${JSON.stringify(spec.defaults)} (1 | 2: the generation of look-changing defaults)` }];
export default check;
