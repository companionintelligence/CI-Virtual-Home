#!/usr/bin/env -S node --experimental-strip-types
// The sensitivity probe of the composer stability gate (scripts/test-compose-stability.mts, section E). A baseline that cannot fail is
// worth nothing, and "registering a new type or role moved no pick" is only a claim if registering an old role's candidate DOES move
// one. This runs in a fresh process (the composer memoises a role's candidate list the first time it is asked) and, before anything
// is composed, registers one probe type in the placement table:
//   --mutate none          nothing (the control: the hashes must equal the committed baseline's)
//   --mutate new-role      a type under a role no group asks for (what a stream's new `dx-*` or `bk-*` type is): no pick may move
//   --mutate existing-role a type added to an existing role's candidates (what `placement.ts` forbids a stream to do): picks must move
// and prints { house: sha256 } for the houses it was given. Nothing is written anywhere.
import { M } from '../fleet/_compose-dry.mts';
import { compute } from '../fleet/_compose-baseline.mts';
import { parseArgs } from './lib.mts';

const args = parseArgs(process.argv.slice(2));
const houses = (args.houses || 'aurora').split(',');
const PL = M.PLACEMENT;
const base = PL['sofa'];
if (args.mutate === 'new-role') PL['zz-rig-probe'] = { ...base, roles: ['zz-rig-new-role'] };
else if (args.mutate === 'existing-role') PL['zz-rig-probe'] = { ...base, roles: [...base.roles] };
else if (args.mutate && args.mutate !== 'none') { console.error(`unknown --mutate ${args.mutate}`); process.exit(2); }
const out: Record<string, string> = {};
for (const [id, e] of Object.entries(compute(houses))) out[id] = e.sha256;
console.log(JSON.stringify(out));
