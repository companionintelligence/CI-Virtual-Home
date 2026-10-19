// Findings: what a rule reports, and the allow-list that lets a human clear a `review` finding.
//
// Three severities (claims.json validator.severity):
//   error   fails the build
//   review  fails unless the exact finding is on content/story/reviewed.json with an owner initial
//   warn    printed, never fails
// A finding is addressed by its rule id and the place it points at (`at`): a beat id for beat-level rules, a dotted
// location such as `kitchen-wallos.body` for text rules. The allow-list key is `slug|at|rule`.

export type Severity = 'error' | 'review' | 'warn';
export interface Finding { rule: string; severity: Severity; at: string; message: string; fix?: string }
export interface ReviewedEntry { slug: string; at: string; rule: string; by: string }

export const reviewKey = (slug: string, at: string, rule: string): string => `${slug}|${at}|${rule}`;

export class Report {
  errors: Finding[] = [];
  review: Finding[] = [];
  warn: Finding[] = [];
  /** `review` findings that the allow-list cleared (reported, not counted) */
  allowed: Finding[] = [];
  stats: Record<string, unknown> = {};
  private used = new Set<string>();
  slug: string;
  private reviewed: Set<string>;
  // no parameter properties: Node's strip-only TypeScript mode rejects them
  constructor(slug: string, reviewed: Set<string>) { this.slug = slug; this.reviewed = reviewed; }

  E(rule: string, at: string, message: string, fix?: string): void { this.errors.push({ rule, severity: 'error', at, message, fix }); }
  W(rule: string, at: string, message: string, fix?: string): void { this.warn.push({ rule, severity: 'warn', at, message, fix }); }
  R(rule: string, at: string, message: string, fix?: string): void {
    const f: Finding = { rule, severity: 'review', at, message, fix };
    const key = reviewKey(this.slug, at, rule);
    if (this.reviewed.has(key)) { this.used.add(key); this.allowed.push(f); } else this.review.push(f);
  }
  /** allow-list entries for this slug that matched no finding: the text moved on and the entry should go */
  unusedReviewed(): string[] { return [...this.reviewed].filter((k) => k.startsWith(`${this.slug}|`) && !this.used.has(k)); }

  /** Add a finding of any severity (used by rules that choose the severity per match, such as the banned phrases). */
  add(severity: Severity, rule: string, at: string, message: string, fix?: string): void {
    if (severity === 'error') this.E(rule, at, message, fix);
    else if (severity === 'review') this.R(rule, at, message, fix);
    else this.W(rule, at, message, fix);
  }

  get failed(): boolean { return this.errors.length > 0 || this.review.length > 0; }
  ruleIds(): string[] { return [...new Set([...this.errors, ...this.review].map((f) => f.rule))]; }
  allRuleIds(): string[] { return [...new Set([...this.errors, ...this.review, ...this.warn].map((f) => f.rule))]; }
  /** the reference validator's one-line format: `rule at: message` */
  line(f: Finding): string { return `${f.rule} ${f.at}: ${f.message}`; }
}
