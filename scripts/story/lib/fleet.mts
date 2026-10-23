// Fleet metrics: rules that only mean something across all the families (STORY-BIBLE section 5, "Fleet diversity"): the cast, 36 with the six apartments.
//
// Two kinds of metric, because the writers deliver families one at a time:
//   uniqueness metrics (surname, town, companion names, beat titles, beat bodies, first names) are true or false for any
//   subset, so they always gate: a clash between two families fails the moment the second one lands.
//   count metrics (every casting slug, topics, distinct apps, shares, narrator counts) are only meaningful for the complete set,
//   so they gate under `--complete` and are reported as "partial" otherwise.
import { ARCHETYPES, CATEGORIES, FIRST_PARTY, type Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Finding } from './report.mts';
import { plain } from './text.mts';
import { isV3Story } from './v3.mts';
import { roomBeats } from './services.mts';

export type MetricStatus = 'pass' | 'fail' | 'partial';
export interface FleetMetric { rule: string; label: string; value: string; target: string; status: MetricStatus; detail?: string[] }
export interface FleetResult { families: number; complete: boolean; metrics: FleetMetric[]; findings: Finding[] }

export const FLEET = { topicMin: 10, appsMin: 70, appShareMax: 0.4, richMin: 3, smallBusinessShare: 0.18, firstNameMax: 2, archetypeMin: 6, gamerMax: 12 } as const;
/**
 * Story v3 fleet constants (reference/story/story-v3.md, "Fleet"). They gate only once EVERY family is a v3 family (isV3Story), so the fleet is never
 * held to more than it is today while the thirty families are being rewritten; until then the metrics are reported, not gated.
 *   appsMin       distinct apps in the fleet, from 70 to 100 (a v3 fleet)
 *   pairShareMin  room beats, and third-party persona beats, that carry a service (the per-family rule is pair-share in services.mts)
 *   servicesMin   distinct services across the fleet; servicesPerHomeMin distinct services in each home
 *   kiwixMax      families that name Kiwix (Kiwix is marked avoid since the 2026-10-19 decisions, so this is 0 in a v3 fleet; the cap is the old plan's)
 *   rareHomes     an app in at most this many homes is rare; rareShare is reported (info), never gated
 *   v3Required    fleet-v3: every family is a v3 family. Off until the last home is rewritten; the last PR sets it
 * The app cap stays appShareMax of the families present (appCap): 12 of the 30 families written so far, 14 of 36 once the six apartments (cast since
 * 2026-10-22, stories to come) have theirs. Nothing hard-codes it, and there is no `families` constant: the size of the fleet is the casting's
 * (content/story/casting.json, from cast-plan.json) and cast-lint.mts derives the same cap from the plan.
 */
export const FLEET_V3 = { appsMin: 100, pairShareMin: 0.8, servicesMin: 70, servicesPerHomeMin: 14, kiwixMax: 6, rareHomes: 8, rareShare: 0.4, v3Required: false } as const;
/** The most families (of the n present) a third-party app may be in: 40 percent, rounded down. */
export const appCap = (n: number): number => Math.floor(FLEET.appShareMax * n + 1e-9);
/**
 * The archetypes the fleet must show in at least FLEET.archetypeMin families. Story v3 has fourteen archetypes (ARCHETYPES: the original six, then
 * tech-family, business-owner, creative, contractor, marketer, lawyer, journalist and educator), and the gate stays on these four: after the 30 homes are
 * recast (persona-bible.md 5.1) organiser is in 16 families, builder 16, gamer 9 and learner 21, each above the gate of six. The other ten are reported
 * in `fleet-archetypes` and never gated. The app cap (appShareMax, 40 percent: 12 of 30, 14 of 36 with the six apartments) is a share of the families
 * present, not a number; the apartments change the numbers, not the rule. With their six families cast (organiser 24, builder 23, gamer 9, learner 21)
 * the four gated archetypes stay above the gate of six.
 */
const CORE_ARCHETYPES = ['organiser', 'builder', 'gamer', 'learner'] as const;
const TOPICS = CATEGORIES.filter((c) => c !== 'setup');
const FIRST_PARTY_IDS = new Set<string>(FIRST_PARTY);

const norm = (s: string): string => plain(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;

/**
 * Keys that appear under two owners. `exempt` names owners that do not clash with each other (the flagship families, which
 * share one cast across three homes): two exempt owners with the same key are not a duplicate, an exempt owner and any other
 * owner still are, and so are two owners that are not exempt.
 */
function duplicates(items: [key: string, owner: string][], exempt: (owner: string) => boolean = () => false): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const [k, owner] of items) {
    const prev = seen.get(k);
    if (prev === undefined) seen.set(k, owner);
    else if (!(exempt(prev) && exempt(owner) && prev !== owner)) out.push(`"${k}" in ${prev} and ${owner}`);
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
  // a fleet of v3 families must show 100 apps (FLEET_V3.appsMin); until every family is v3 the gate stays at 70
  const v3Families = stories.filter(isV3Story);
  const allV3 = n > 0 && v3Families.length === n;
  const appsMin = allV3 ? FLEET_V3.appsMin : FLEET.appsMin;
  count('fleet-apps', 'Distinct apps named', String(appFamilies.size), `at least ${appsMin}`, appFamilies.size >= appsMin);
  // a flagship family is three homes, so it counts three times: appFamilies is keyed by slug and every home has its own slug
  const over = [...appFamilies].filter(([id, f]) => !FIRST_PARTY_IDS.has(id) && n > 0 && f.size / n > FLEET.appShareMax);
  // an app's share is meaningless for a handful of families (one family is 100%): gate it from ten families on
  const overGate = n >= 10 ? over : [];
  const top = [...appFamilies].filter(([id]) => !FIRST_PARTY_IDS.has(id)).sort((a, b) => b[1].size - a[1].size)[0];
  metrics.push({ rule: 'fleet-apps', label: 'Busiest third-party app', value: top ? `${top[0]} in ${top[1].size} of ${n} (${pct(top[1].size / n)})` : 'none', target: `at most ${pct(FLEET.appShareMax)} of families (${appCap(n)} of ${n})`, status: overGate.length ? 'fail' : n >= 10 ? 'pass' : 'partial', detail: overGate.map(([id, f]) => `${id} in ${f.size} of ${n} families`) });
  for (const [id, f] of overGate) findings.push({ rule: 'fleet-apps', severity: complete ? 'error' : 'warn', at: 'fleet', message: `${id} is in ${f.size} of ${n} families (${pct(f.size / n)}; at most ${pct(FLEET.appShareMax)}, ${appCap(n)} of ${n})` });
  const rich = ctx.storyRich.map((id) => [id, appFamilies.get(id)?.size ?? 0] as const);
  const poor = rich.filter(([, c]) => c < FLEET.richMin);
  count('fleet-apps', `The ${rich.length} story-rich apps in at least ${FLEET.richMin} families`, `${rich.length - poor.length} of ${rich.length}`, `all ${rich.length}`, poor.length === 0, poor.map(([id, c]) => `${id} in ${c}`));

  // ---- 4. small-business share of all beats
  const beats = stories.flatMap((s) => s.beats);
  const sb = beats.filter((b) => b.segment === 'small-business').length;
  count('fleet-segments', 'Small-business share of all beats', beats.length ? `${sb} of ${beats.length} (${pct(sb / beats.length)})` : '0 of 0', `at least ${pct(FLEET.smallBusinessShare)}`, beats.length > 0 && sb / beats.length >= FLEET.smallBusinessShare);

  // ---- 5. uniqueness
  // The flagship family (casting.json `flagship: true`) lives in three homes with one cast: its surname, its members' first
  // names and its companions' names repeat across those homes on purpose, and only there. Everything else about a flagship
  // home is still unique (address, beat titles and bodies), and a flagship name against any other family still clashes.
  const flagship = (slug: string): boolean => ctx.castBySlug.get(slug)?.flagship === true;
  unique('fleet-unique', 'Surname', duplicates(stories.map((s) => [norm(s.family.surname), s.slug]), flagship));
  unique('fleet-unique', 'Address place', duplicates(stories.map((s) => [norm(s.family.address.place), s.slug])));
  unique('fleet-unique', 'Companion name', duplicates(stories.flatMap((s) => s.members.filter((m) => m.companion).map((m) => [norm(m.companion!.name), s.slug] as [string, string])), flagship));
  unique('fleet-unique', 'Beat title outside the ftue', duplicates(stories.flatMap((s) => {
    const ftue = new Set(s.chapters.filter((c) => c.kind === 'ftue').map((c) => c.id));
    return s.beats.filter((b) => !ftue.has(b.chapter)).map((b) => [norm(b.popup.title), `${s.slug}/${b.id}`] as [string, string]);
  })));
  unique('fleet-unique', 'Beat body', duplicates(stories.flatMap((s) => s.beats.map((b) => [norm(b.popup.body), `${s.slug}/${b.id}`] as [string, string]))));
  const firstNames = new Map<string, string[]>();
  for (const s of stories) for (const m of s.members) { const k = norm(m.name); if (!firstNames.has(k)) firstNames.set(k, []); firstNames.get(k)!.push(s.slug); }
  // the flagship homes together are one use of a first name
  const uses = (slugs: string[]): number => slugs.filter((x) => !flagship(x)).length + (slugs.some(flagship) ? 1 : 0);
  unique('fleet-unique', `First name used more than ${FLEET.firstNameMax} times`, [...firstNames].filter(([, f]) => uses(f) > FLEET.firstNameMax).map(([k, f]) => `"${k}" in ${f.join(', ')}`));

  // ---- 5b. archetypes: how many families show each (a family counts once per archetype). Maker and host are reported only.
  const archFamilies = new Map<string, number>(ARCHETYPES.map((a) => [a, stories.filter((s) => s.members.some((m) => m.archetype === a)).length]));
  const archLow = CORE_ARCHETYPES.filter((a) => archFamilies.get(a)! < FLEET.archetypeMin);
  const gamerHigh = archFamilies.get('gamer')! > FLEET.gamerMax;
  count('fleet-archetypes', 'Archetypes across the families', ARCHETYPES.map((a) => `${a} ${archFamilies.get(a)}`).join(', '),
    `each of ${CORE_ARCHETYPES.join(', ')} in at least ${FLEET.archetypeMin} families, gamer in at most ${FLEET.gamerMax}`,
    archLow.length === 0 && !gamerHigh,
    [...archLow.map((a) => `${a} in ${archFamilies.get(a)} families`), ...(gamerHigh ? [`gamer in ${archFamilies.get('gamer')} families (steam-headless is capped at ${pct(FLEET.appShareMax)} of the fleet)`] : [])]);

  // ---- 5c. story v3: services and pairs. Reported always; gating only when every family is a v3 family (FLEET_V3), so a fleet in the middle of the
  // rewrite is held to nothing new. fleet-v3 itself gates only when FLEET_V3.v3Required is set (the last PR).
  const gate = (rule: string, label: string, value: string, target: string, ok: boolean, detail?: string[]): void => {
    if (allV3) count(rule, label, value, target, ok, detail);
    else metrics.push({ rule, label, value, target: `${target} (gates once every family is v3)`, status: 'partial', detail });
  };
  metrics.push({ rule: 'fleet-v3', label: 'Families told in the v3 shape', value: `${v3Families.length} of ${n}`, target: FLEET_V3.v3Required ? `all ${n}` : 'informational until the last home is rewritten', status: v3Families.length === n || !FLEET_V3.v3Required ? (v3Families.length === n ? 'pass' : 'partial') : complete ? 'fail' : 'partial' });
  if (FLEET_V3.v3Required && complete && v3Families.length !== n) findings.push({ rule: 'fleet-v3', severity: 'error', at: 'fleet', message: `Families told in the v3 shape: ${v3Families.length} of ${n} (need all ${n}); not v3: ${stories.filter((s) => !isV3Story(s)).map((s) => s.slug).join(', ')}` });
  const serviceHomes = new Map<string, Set<string>>();
  for (const s of v3Families) for (const b of s.beats) if (b.service) { if (!serviceHomes.has(b.service)) serviceHomes.set(b.service, new Set()); serviceHomes.get(b.service)!.add(s.slug); }
  gate('fleet-services', 'Distinct services in the fleet', String(serviceHomes.size), `at least ${FLEET_V3.servicesMin}`, serviceHomes.size >= FLEET_V3.servicesMin);
  const perHome = v3Families.map((s) => [s.slug, new Set(s.beats.flatMap((b) => (b.service ? [b.service] : []))).size] as const);
  const thin = perHome.filter(([, c]) => c < FLEET_V3.servicesPerHomeMin);
  gate('fleet-services', `Services in each v3 home`, perHome.length ? `fewest ${Math.min(...perHome.map(([, c]) => c))}` : 'no v3 home yet', `each at least ${FLEET_V3.servicesPerHomeMin}`, thin.length === 0, thin.map(([slug, c]) => `${slug} names ${c}`));
  const roomPaired = v3Families.map((s) => { const r = roomBeats(s); return [s.slug, r.length ? r.filter((b) => b.service !== undefined).length / r.length : 1] as const; });
  const lowPair = roomPaired.filter(([, x]) => x < FLEET_V3.pairShareMin);
  gate('fleet-pairs', 'Room beats with a service, lowest home', roomPaired.length ? pct(Math.min(...roomPaired.map(([, x]) => x))) : 'no v3 home yet', `each at least ${pct(FLEET_V3.pairShareMin)}`, lowPair.length === 0, lowPair.map(([slug, x]) => `${slug} ${pct(x)}`));
  const kiwix = stories.filter((s) => s.beats.some((b) => b.app?.id === 'kiwix' || b.with?.includes('kiwix'))).length;
  gate('fleet-apps', 'Families that name Kiwix', String(kiwix), `at most ${FLEET_V3.kiwixMax}`, kiwix <= FLEET_V3.kiwixMax);
  // info: how much of each home's room is told with an app few other homes use (never gated)
  const homesOf = (id: string): number => appFamilies.get(id)?.size ?? 0;
  const rare = stories.map((s) => { const r = roomBeats(s).filter((b) => b.app && !FIRST_PARTY_IDS.has(b.app.id)); return [s.slug, r.length ? r.filter((b) => homesOf(b.app!.id) <= FLEET_V3.rareHomes).length / r.length : 1] as const; });
  metrics.push({ rule: 'fleet-rare', label: `Room beats on an app in at most ${FLEET_V3.rareHomes} homes, lowest home`, value: rare.length ? pct(Math.min(...rare.map(([, x]) => x))) : 'none', target: `info: ${pct(FLEET_V3.rareShare)} or more in each home`, status: rare.every(([, x]) => x >= FLEET_V3.rareShare) ? 'pass' : 'partial' });

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
