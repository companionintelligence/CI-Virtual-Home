// The fleet-audit metric contract (scripts/fleet-audit.mts loads every scripts/fleet/*.mts not starting with "_",
// in name order, and runs every metric each one exports as `metrics`).
//
// A metric measures the whole fleet — the 30 specs, and whatever else it can read without a browser — against the
// owner's complaints (plan Completeness A5): "each home looks very same" (palette, doors, claddings, roofs,
// lighting, furniture) and "the planting is very rectangular and repetitive" (planting types, front-garden crates,
// axis-aligned beds and paths). One file per stream, owned by that stream: kit.mts S1, arch.mts S2, compose.mts S3,
// site.mts S4, shots.mts S5. A stream refines its metrics as its features land (a metric that reads a field the
// stream has not shipped yet says so rather than guessing), and adds new ones the same way.
//
// What a stream GENERATES at build time (S3's composed rooms, S4's planting, smoothed paths and walks) is not in the
// spec, so a metric of it reads `house.plan` — the house's <id>.plan.json, a pass-through of the built anchors with
// one key per stream (assets/plan-export/<stream>.ts: the stream exports what its metric needs there). The committed
// plans are regenerated only at integration, so `pnpm run fleet-audit --built` rebuilds them from THIS tree first
// (into test/qa/plans/) and the metrics read those.
//
// The baseline: test/fleet/baseline.json, committed (S0 wrote it on the hand-authored fleet; `fleet-audit
// --baseline` rewrites it, which only the integration should). Each metric gets its own baseline result in
// compute's ctx, so a target stated against it ("down ≥ 50 % against the hand-authored baseline") can be judged,
// and the report prints the baseline beside every value (Δ of `measure` when both have one).

export type Row = Array<string | number>;

export interface MetricResult {
  /** the headline number or phrase */
  value: string | number;
  /** the headline as one number, when it has one — the report prints its Δ against the baseline */
  measure?: number;
  /** against the target: true / false, or null when there is no target yet or nothing to judge */
  pass: boolean | null;
  /** one or two sentences under the headline */
  detail?: string;
  /** an optional table */
  table?: { head: string[]; rows: Row[] };
}

export interface House {
  id: string;
  spec: any;
  /** its <id>.plan.json (built anchors, one key per stream), or null when there is none — see the header */
  plan: any | null;
}

export interface Fleet {
  houses: House[];
  /** CIEDE2000 between two '#rrggbb' (or 0xRRGGBB) colours */
  deltaE: (a: string | number, b: string | number) => number;
  /** 0xRRGGBB → '#rrggbb' */
  css: (c: number) => string;
  /** '#rrggbb' → 0xRRGGBB */
  hex: (c: string | number) => number;
}

export interface Metric {
  id: string;
  title: string;
  /** the stream that owns it: 'S1' … 'S6' */
  stream: string;
  /** the target, in words (plan §2 / Completeness A5) */
  target?: string;
  compute: (fleet: Fleet, ctx: { baseline: MetricResult | null }) => MetricResult;
}
