// Validator plugin — owned by S3 (compose). See _types.mts for the contract.
//
// The layout lints (assets/layout-lint.ts): overlaps, items through walls or out of their room, door swings, lanes
// (0.8 m), the entry-to-Core walk (1.2 m), stair run-in and step-off (1.6 m), seating facing a wall, silent parameters,
// wall mounts inside the wall, surface items off their surface, repetition, backwards kitchen runs, the foyer rule and
// furniture islands with an empty half — on the authored items and, in a composed room (rooms[].program), on the
// composer's items too. All warnings until the layout pass promotes them (plan §2.0). `pnpm run validate --layout`;
// scripts/test-room-composer.mts prints the fleet's counts per code.
import type { Check } from './_types.mts';
import { lintLayout } from '../../assets/layout-lint.js';

// Runs only under `pnpm run validate --layout` (plan S3: baseline counts for the 30 specs, as warnings).
export const flag = 'layout';

const check: Check = spec => lintLayout(spec).map(i => ({ level: 'warn', message: i.message, code: i.code }));
export default check;
