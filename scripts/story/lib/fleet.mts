// Fleet metrics: rules that only mean something across all 30 families (STORY-BIBLE section 5, "Fleet diversity").
//
// Two kinds of metric, because the writers deliver families one at a time:
//   uniqueness metrics (surname, town, companion names, beat titles, beat bodies, first names) are true or false for any
//   subset, so they always gate: a clash between two families fails the moment the second one lands.
//   count metrics (30 slugs, topics, distinct apps, shares, narrator counts) are only meaningful for the complete set,
//   so they gate under `--complete` and are reported as "partial" otherwise.
import { CATEGORIES, FIRST_PARTY, type Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Finding } from './report.mts';
import { plain } from './text.mts';

export type MetricStatus = 'pass' | 'fail' | 'partial';
export interface FleetMetric { rule: string; label: string; value: string; target: string; status: MetricStatus; detail?: string[] }
export interface FleetResult { families: number; complete: boolean; metrics: FleetMetric[]; findings: Finding[] }

export const FLEET = { families: 30, topicMin: 10, appsMin: 70, appShareMax: 0.4, richMin: 3, smallBusinessShare: 0.18, firstNameMax: 2 } as const;
const TOPICS = CATEGORIES.filter((c) => c !== 'setup');
const FIRST_PARTY_IDS = new Set<string>(FIRST_PARTY);

const norm = (s: string): string => plain(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;

function duplicates(items: [key: string, owner: string][]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const [k, owner] of items) {
    const prev = seen.get(k);
    if (prev !== undefined) out.push(`"${k}" in ${prev} and ${owner}`);
    else seen.set(k, owner);
  }
  return out;
}

export function fleetMetrics(stories: Story[], ctx: Ctx, opts: { complete: boolean }): FleetResult {
  const metrics: FleetMetric[] = [];
  const findings: Finding[] = [];
  const n = stories.length;
  const { complete } = opts;
  /** a count metric: gates only when the set is complete */
  const count = (rule: string, label: string, value: string, target: string, ok: boolean, detail?: string[]): void => {
    const status: MetricStatus = ok ? 'pass' : complete ? 'fail' : 'partial';
    metrics.push({ rule, label, value, target, status, detail });
    if (status === 'fail') findings.push({ rule, severity: 'error', at: 'fleet', message: `${label}: ${value} (need ${target})${detail?.length ? `; ${detail.slice(0, 6).join('; ')}` : ''}` });
  };
  /** a uniqueness metric: gates always */
  const unique = (rule: string, label: string, clashes: string[]): void => {
    metrics.push({ rule, label, value: clashes.length ? `${clashes.length} clash${clashes.length === 1 ? '' : 'es'}` : 'none', target: 'none', status: clashes.length ? 'fail' : 'pass', detail: clashes });
    for (const c of clashes) findings.push({ rule, severity: 'error', at: 'fleet', message: `${label}: ${c}` });
  };

  // ---- 1. slugs
  const castSlugs = ctx.casting.families.map((f) => f.slug);
  const have = new Set(stories.map((s) => s.slug));
  const missing = castSlugs.filter((s) => !have.has(s));
  const extra = [...have].filter((s) => !ctx.castBySlug.has(s));
  count('fleet-count', 'Families present', `${castSlugs.length - missing.length} of ${castSlugs.length}`, `all ${castSlugs.length}`, missing.length === 0, missing.length ? [`missing: ${missing.join(', ')}`] : []);
  if (extra.length) findings.push({ rule: 'fleet-count', severity: 'error', at: 'fleet', message: `slugs not in casting.json: ${extra.join(', ')}` });
  const dupSlug = duplicates(stories.map((s) => [s.slug, s.slug] as [string, string]));
  if (dupSlug.length) findings.push({ rule: 'fleet-count', severity: 'error', at: 'fleet', message: `the same slug in two files: ${dupSlug.join('; ')}` });

  // ---- 2. topics: each of the ten in at least ten families
  const topicFamilies = TOPICS.map((t) => [t, stories.filter((s) => s.beats.some((b) => b.category === t)).length] as const);
  const low = topicFamilies.filter(([, c]) => c < FLEET.topicMin);
  count('fleet-topics', 'Topics in at least ten families', `${topicFamilies.map(([t, c]) => `${t} ${c}`).join(', ')}`, `each of ${TOPICS.length} at least ${FLEET.topicMin}`, low.length === 0, low.map(([t, c]) => `${t} in ${c} families`));

  // ---- 3. apps
  const appFamilies = new Map<string, Set<string>>();
  for (const s of stories) for (const b of s.beats) for (const id of [...(b.app ? [b.app.id] : []), ...(b.with || [])]) { if (!appFamilies.has(id)) appFamilies.set(id, new Set()); appFamilies.get(id)!.add(s.slug); }
  count('fleet-apps', 'Distinct apps named', String(appFamilies.size), `at least ${FLEET.appsMin}`, appFamilies.size >= FLEET.appsMin);
  const over = [...appFamilies].filter(([id, f]) => !FIRST_PARTY_IDS.has(id) && n > 0 && f.size / n > FLEET.appShareMax);
  // an app's share is meaningless for a handful of families (one family is 100%): gate it from ten families on
  const overGate = n >= 10 ? over : [];
  const top = [...appFamilies].filter(([id]) => !FIRST_PARTY_IDS.has(id)).sort((a, b) => b[1].size - a[1].size)[0];
  metrics.push({ rule: 'fleet-apps', label: 'Busiest third-party app', value: top ? `${top[0]} in ${top[1].size} of ${n} (${pct(top[1].size / n)})` : 'none', target: `at most ${pct(FLEET.appShareMax)} of families`, status: overGate.length ? 'fail' : n >= 10 ? 'pass' : 'partial', detail: overGate.map(([id, f]) => `${id} in ${f.size} of ${n} families`) });
  for (const [id, f] of overGate) findings.push({ rule: 'fleet-apps', severity: complete ? 'error' : 'warn', at: 'fleet', message: `${id} is in ${f.size} of ${n} families (${pct(f.size / n)}; at most ${pct(FLEET.appShareMax)})` });
  const rich = ctx.storyRich.map((id) => [id, appFamilies.get(id)?.size ?? 0] as const);
  const poor = rich.filter(([, c]) => c < FLEET.richMin);
  count('fleet-apps', `The ${rich.length} story-rich apps in at least ${FLEET.richMin} families`, `${rich.length - poor.length} of ${rich.length}`, `all ${rich.length}`, poor.length === 0, poor.map(([id, c]) => `${id} in ${c}`));

  // ---- 4. small-business share of all beats
  const beats = stories.flatMap((s) => s.beats);
  const sb = beats.filter((b) => b.segment === 'small-business').length;
  count('fleet-segments', 'Small-business share of all beats', beats.length ? `${sb} of ${beats.length} (${pct(sb / beats.length)})` : '0 of 0', `at least ${pct(FLEET.smallBusinessShare)}`, beats.length > 0 && sb / beats.length >= FLEET.smallBusinessShare);

  // ---- 5. uniqueness
  unique('fleet-unique', 'Surname', duplicates(stories.map((s) => [norm(s.family.surname), s.slug])));
  unique('fleet-unique', 'Address place', duplicates(stories.map((s) => [norm(s.family.address.place), s.slug])));
  unique('fleet-unique', 'Companion name', duplicates(stories.flatMap((s) => s.members.filter((m) => m.companion).map((m) => [norm(m.companion!.name), s.slug] as [string, string]))));
  unique('fleet-unique', 'Beat title outside the ftue', duplicates(stories.flatMap((s) => {
    const ftue = new Set(s.chapters.filter((c) => c.kind === 'ftue').map((c) => c.id));
    return s.beats.filter((b) => !ftue.has(b.chapter)).map((b) => [norm(b.popup.title), `${s.slug}/${b.id}`] as [string, string]);
  })));
  unique('fleet-unique', 'Beat body', duplicates(stories.flatMap((s) => s.beats.map((b) => [norm(b.popup.body), `${s.slug}/${b.id}`] as [string, string]))));
  const firstNames = new Map<string, string[]>();
  for (const s of stories) for (const m of s.members) { const k = norm(m.name); if (!firstNames.has(k)) firstNames.set(k, []); firstNames.get(k)!.push(s.slug); }
  unique('fleet-unique', `First name used more than ${FLEET.firstNameMax} times`, [...firstNames].filter(([, f]) => f.length > FLEET.firstNameMax).map(([k, f]) => `"${k}" in ${f.join(', ')}`));

  // ---- 6. narrators: no voice over its count; exactly its count when complete
  const used = new Map<string, number>();
  for (const s of stories) used.set(s.family.narrator, (used.get(s.family.narrator) || 0) + 1);
  const voiceLines = Object.entries(ctx.voices.voices).map(([k, v]) => ({ k, have: used.get(k) || 0, want: v.narratorFor }));
  const tooMany = voiceLines.filter((v) => v.have > v.want);
  const wrong = voiceLines.filter((v) => v.have !== v.want);
  count('fleet-voices', 'Narrator counts equal voices.json narratorFor', voiceLines.map((v) => `${v.k} ${v.have}/${v.want}`).join(' '), 'every voice at its count', wrong.length === 0, wrong.map((v) => `${v.k} has ${v.have}, voices.json says ${v.want}`));
  if (!complete) for (const v of tooMany) findings.push({ rule: 'fleet-voices', severity: 'error', at: 'fleet', message: `${v.k} narrates ${v.have} families; voices.json narratorFor is ${v.want}` });

  return { families: n, complete, metrics, findings };
}

export function renderFleet(r: FleetResult): string {
  const rows = r.metrics.map((m) => [m.status === 'pass' ? 'ok' : m.status === 'fail' ? 'FAIL' : 'partial', m.label, m.value, m.target]);
  const head = ['status', 'metric', 'value', 'target'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((row) => Math.min(row[i].length, i === 2 ? 72 : 56))));
  const cut = (s: string, k: number): string => (s.length > k ? `${s.slice(0, k - 1)}~` : s);
  const line = (cells: string[]): string => cells.map((c, i) => cut(c, w[i]).padEnd(w[i])).join('  ');
  const out = [`Fleet metrics: ${r.families} family file${r.families === 1 ? '' : 's'} (${r.complete ? 'complete set, counts gate' : 'partial set, counts are informational'})`, line(head), line(w.map((x) => '-'.repeat(x)))];
  for (const row of rows) out.push(line(row));
  for (const m of r.metrics) if (m.status === 'fail' && m.detail?.length) out.push('', `${m.label}:`, ...m.detail.slice(0, 12).map((d) => `  ${d}`));
  return out.join('\n');
}
