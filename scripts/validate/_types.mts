// The validator plugin contract (scripts/validate-house-spec.mts loads every scripts/validate/*.mts whose name does
// not start with "_", in name order).
//
//   export default function check(spec, ctx): Issue[]      — required
//   export const flag = 'layout'                            — optional: run only under `pnpm run validate --layout`
//
// A plugin reads the spec and returns issues; it never throws for a bad spec (the loader reports a throw as an
// error against the file, so one broken plugin cannot hide the others' findings). One plugin per stream, owned by
// that stream (plan §2): kit.mts S1, arch.mts S2, layout.mts S3, site.mts S4, shots.mts S5; defaults.mts is S0's.
// New lints arrive as `warn` and are promoted to `error` only after the layout pass (plan §2.0).

export type IssueLevel = 'error' | 'warn';

export interface Issue {
  level: IssueLevel;
  /** what is wrong, in the words the report prints after "<file>: " */
  message: string;
  /** a short kebab-case code, printed as a suffix: "… [kit:silent-param]" */
  code?: string;
}

export interface ValidateContext {
  /** the path the report names */
  file: string;
  /** plugin flags given on the command line (`--layout` → 'layout') */
  flags: ReadonlySet<string>;
  /** every item type the validator accepts (the page's ITEMS and the prop registry) */
  itemTypes: readonly string[];
  /** every site type the validator accepts */
  siteTypes: readonly string[];
  /** the prop registry (assets/props/index.js) */
  props: Map<string, any>;
  /** assets/house-geometry.js perimeterEdges(footprint) */
  perimeterEdges: (footprint: any[]) => any[];
}

export type Check = (spec: any, ctx: ValidateContext) => Issue[];
