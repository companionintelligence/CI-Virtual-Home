// The validator plugin contract (scripts/validate-house-spec.mts loads every scripts/validate/*.mts whose name does
// not start with "_", in name order).
//
//   export default function check(spec, ctx): Issue[]      — required
//   export const flag = 'layout'                            — optional: run only under `pnpm run validate --layout`
//   export const extend = { roofTypes: ['pent'], … }        — optional: values the core checks must also accept
//   export const replaces = ['stairs', …]                   — optional: core rules this plugin takes over
//
// A plugin reads the spec and returns issues; it never throws for a bad spec (the loader reports a throw as an
// error against the file, so one broken plugin cannot hide the others' findings). One plugin per stream, owned by
// that stream (plan §2): kit.mts S1, arch.mts S2, layout.mts S3, site.mts S4, shots.mts S5; defaults.mts is S0's.
// New lints arrive as `warn` and are promoted to `error` only after the layout pass (plan §2.0).
//
// The core (validate-house-spec.mts) is S0's and frozen, so a stream never edits it to change what it accepts:
//   - `extend` adds values to one of the core's VOCABULARIES below (a new roof type, floor, ground, stair type, shot
//     type, hero surface …). Item and site types need no extend: the core reads them off the builders
//     (item-map.ts ITEMS + the prop registry; site-build.ts SITE + SITE_LOOP_TYPES + site.ts SITE_KIT_TYPES), so a
//     builder added there is valid here.
//   - `replaces` takes a whole core RULE over when a stream changes its meaning: the core skips it and the plugin
//     checks its own version (usually the old rule plus the new case, so today's specs keep today's findings).
//     One plugin per rule, and not from a flag-gated plugin (it would go unchecked without the flag).
//
// Which vocabulary and rule belong to which stream (plan §2):
//   S1 kit    heroSurfaces, heroDevices, heroPoses, openingTypes
//   S2 arch   roofTypes, floors, stairTypes · rules 'stairs', 'raised-level', 'footprint-rects', 'partition-axis-aligned'
//   S4 site   grounds (+ SITE_KIT_TYPES in assets/site.ts) · rule 'site-needs'
//   S5 shot   shotTypes, shotWalls, shotRoofs · rule 'shot-duration'

export type IssueLevel = 'error' | 'warn';

export interface Issue {
  level: IssueLevel;
  /** what is wrong, in the words the report prints after "<file>: " */
  message: string;
  /** a short kebab-case code, printed as a suffix: "… [kit:silent-param]" */
  code?: string;
}

/** The core's vocabularies, in the order they are listed. */
export const VOCAB_KEYS = [
  'sides', 'openingTypes', 'roofTypes', 'floors', 'grounds', 'siteTypes', 'itemTypes', 'stairTypes',
  'shotTypes', 'shotWalls', 'shotRoofs', 'heroDevices', 'heroPoses', 'heroSurfaces',
] as const;
export type VocabKey = typeof VOCAB_KEYS[number];
export type Vocab = { readonly [K in VocabKey]: readonly string[] };

/** The core rules a plugin may replace:
 *   'footprint-rects'         each level's footprint is a non-empty array of rects; a level whose footprint is not is
 *                             reported, and the core skips the rest of its geometry checks (openings, partitions,
 *                             stairs, rooms). Replaced: not reported, the skip stays — the plugin checks its own kind
 *                             of footprint (S2's polygon plans) and that level's geometry
 *   'partition-axis-aligned'  a partition runs along X or Z. Replaced: not reported (S2's angled partitions)
 *   'stairs'         levels[].stairs is one object with a known `type` and an `at`
 *   'raised-level'   a storey above y 0 has stairs leading to it (a `stairs.to` naming it), voids over the
 *                    stairwell (warn), and no balustrade across the stair's step-off
 *   'site-needs'     each site type's geometry: fence / wall-low from+to, path / hedge a path, bed poly or at, else at
 *   'shot-duration'  shots[].duration is 2–60 s, and door-to-core's at least 8 s */
export const RULES = ['footprint-rects', 'partition-axis-aligned', 'stairs', 'raised-level', 'site-needs', 'shot-duration'] as const;
export type Rule = typeof RULES[number];

export interface ValidateContext {
  /** the path the report names */
  file: string;
  /** plugin flags given on the command line (`--layout` → 'layout') */
  flags: ReadonlySet<string>;
  /** every item type the validator accepts (the page's ITEMS and the prop registry) — also vocab.itemTypes */
  itemTypes: readonly string[];
  /** every site type the validator accepts — also vocab.siteTypes */
  siteTypes: readonly string[];
  /** every vocabulary, after all the plugins' `extend` */
  vocab: Vocab;
  /** the core rules some plugin has replaced */
  replaced: ReadonlySet<Rule>;
  /** the prop registry (assets/props/index.js) */
  props: Map<string, any>;
  /** assets/house-geometry.js perimeterEdges(footprint) */
  perimeterEdges: (footprint: any[]) => any[];
}

export type Check = (spec: any, ctx: ValidateContext) => Issue[];
/** what a plugin module may export besides its check */
export type Extend = Partial<Record<VocabKey, string[]>>;
