// The front page's logic (the plan is content/story/lander.json; reference/story/lander.md). Pure over loaded inputs, so scripts/test-lander.mts runs it on
// fixtures and scripts/build-portal.mts / scripts/portal-front.mts run it on the tree. It holds NO copy: the page's words are claims.json's, a family
// file's or portal-front.mts's, and everything here only chooses WHICH of them the page shows.
//
//   readPlan / validatePlan   the plan, held to its schema and to the tree (a family, beat, service, app or house it names must exist)
//   gateOf / featuredOf       the ad-ready gate and the featured families: a family is featured only if no beat uses an app the catalog marks "avoid", no beat
//                             names a service the registry will not let a story name, and its home is lit as day; the hero first, then one family for each
//                             surname, covering a category not yet covered. A slot is never filled with a family that fails the gate.
//   proofOf                   the one pair the page shows in full: the first candidate whose beat is a pair the page may show
//   countLine                 how many families and homes, in words and never in digits
//   placeTypes                the kind of place of each home (home, apartment, office)
import fs from 'node:fs';
import path from 'node:path';
import { checkSchema } from './schema-lite.mts';
import { buildPairIndex, serviceOk, stripOf, pairKey } from './pairs.mts';
import type { AppLite, PairIndex, PairPlan, ServiceLite, StripChip } from './pairs.mts';
import { EXTRA_BANS } from './extra-bans.mts';
import { PLACE_TYPES, loadCategories } from './categories.mts';
import type { Category } from './categories.mts';
import { numberWord, capital } from '../../portal-pages.mts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const J = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

export type PlaceType = (typeof PLACE_TYPES)[number];
export interface LanderPlan extends PairPlan {
  version: 1;
  hero: { slug: string; house: string };
  messages: { key: string; claim: string }[];
  proof: { candidates: { slug: string; beat: string }[] };
  featured: { count: number; override: string[] | null };
  types: Record<string, string[]>;
}
/** A family story as far as the page reads it. */
export interface StoryFull {
  slug: string; house: string;
  family: { surname: string };
  members: { id: string; name: string; archetype?: string }[];
  beats: { id: string; member?: string; service?: string; app?: { id: string; replaces?: string[] };
    popup?: { title?: string; chips?: string[]; note?: string }; detail?: { before?: string; after?: string } }[];
}
export interface ClaimLite { id: string; text: string; status?: string }
export interface ClaimsLite { allowedClaims: ClaimLite[]; bannedPhrases: { id: string; pattern: string; flags?: string; severity: string }[]; disclosures: { id: string; text: string }[] }
export interface FamilyLite { slug: string; house: string; surname: string; title: string; /** the archetypes present */ personas: string[] }

export const planPath = (root: string = ROOT): string => path.join(root, 'content', 'story', 'lander.json');
export const schemaPath = (root: string = ROOT): string => path.join(root, 'content', 'story', 'schema', 'lander.schema.json');
export const readPlan = (root: string = ROOT): LanderPlan => J(planPath(root));

/** claims.json's phrases that stop a sentence (error and review), plus the extra rules of lib/extra-bans.mts that are errors, as regular expressions. */
export function bansOf(claims: Pick<ClaimsLite, 'bannedPhrases'>): RegExp[] {
  const have = new Set(claims.bannedPhrases.map((b) => b.id));
  const own = claims.bannedPhrases.filter((b) => b.severity === 'error' || b.severity === 'review').map((b) => new RegExp(b.pattern, b.flags ?? 'i'));
  const extra = EXTRA_BANS.filter((e) => e.severity === 'error' && !have.has(e.id)).map((e) => new RegExp(e.pattern, e.flags));
  return [...own, ...extra];
}

// ---------------------------------------------------------------------------------------------------------------- the count in words

/**
 * How many families and homes, always in words, never "all" and never a digit (a digit beside a service reads as a usage figure, and claims.json bans
 * "all <number>"). Absorbs the apartments (more homes than families) and the offices (`teams` of them) without a copy edit.
 */
export function countLine(families: number, homes: number, teams = 0): string {
  const f = numberWord(families), h = numberWord(homes);
  if (teams > 0) return `${capital(f)} fictional families and ${numberWord(teams)} fictional ${teams === 1 ? 'team' : 'teams'} in ${numberWord(homes + teams)} places.`;
  if (homes === families) return `${capital(h)} homes, each with a fictional family.`;
  return `${capital(f)} fictional ${families === 1 ? 'family' : 'families'} in ${h} homes.`;
}
/** "Twenty fictional families" for a chip's accessible name (a count is a word, always beside "fictional"). */
export const familiesWord = (n: number): string => `${capital(numberWord(n))} fictional ${n === 1 ? 'family' : 'families'}`;

// ---------------------------------------------------------------------------------------------------------------- kinds of place

/** The kind of each home: a house's own `type` when the index has one, else the plan's `types`, else a home. `counts` has a key for each type that has a house. */
export function placeTypes(houses: readonly { id: string; type?: string }[], plan: Pick<LanderPlan, 'types'>): { of: Record<string, PlaceType>; counts: Partial<Record<PlaceType, number>>; present: PlaceType[] } {
  const named = new Map<string, PlaceType>();
  for (const t of PLACE_TYPES) for (const id of plan.types[t] ?? []) named.set(id, t);
  const of: Record<string, PlaceType> = {};
  const counts: Partial<Record<PlaceType, number>> = {};
  for (const h of houses) {
    const t = ((PLACE_TYPES as readonly string[]).includes(h.type ?? '') ? h.type : named.get(h.id)) as PlaceType | undefined;
    of[h.id] = t ?? 'home';
    counts[of[h.id]] = (counts[of[h.id]] ?? 0) + 1;
  }
  return { of, counts, present: PLACE_TYPES.filter((t) => (counts[t] ?? 0) > 0) };
}

// ---------------------------------------------------------------------------------------------------------------- the ad-ready gate and the featured families

export interface Gate { ok: boolean; reasons: string[] }
/**
 * May this family be featured? No beat uses an app the catalog marks storySafe "avoid" (or one that is not in the live store), no beat names a service
 * the registry will not let a story name (dead, stale, blocked or under review), and its home is lit as day (an ad may not be night or dusk). The
 * validator being clean is the build's own precondition (a family that fails it is not current, so it is not here).
 */
export function gateOf(story: StoryFull, ctx: { services: readonly ServiceLite[]; apps: readonly AppLite[]; lighting: Readonly<Record<string, string>> }): Gate {
  const byId = new Map(ctx.services.map((s) => [s.id, s])), appById = new Map(ctx.apps.map((a) => [a.id, a]));
  const byName = new Map<string, ServiceLite>();
  for (const s of ctx.services) for (const n of [s.name, ...s.aliases]) if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), s);
  const reasons = new Set<string>();
  for (const b of story.beats) {
    if (!b.app) continue;
    const app = appById.get(b.app.id);
    if (app?.storySafe === 'avoid') reasons.add(`${app.name} is an app the catalog marks avoid`);
    if (app && app.inLiveStore === false) reasons.add(`${app.name} is not in the live store`);
    const first = b.app.replaces?.[0];
    const svc = b.service ? byId.get(b.service) : first ? byName.get(first.toLowerCase()) ?? byName.get(first.replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase()) : undefined;
    if (b.service && !svc) reasons.add(`the service ${b.service} is not in the registry`);
    if (svc && !serviceOk(svc)) reasons.add(`${svc.name} is a service the registry will not let a story name`);
  }
  const light = ctx.lighting[story.house];
  if (light !== 'day') reasons.add(`its home is lit as ${light ?? 'unknown'}, not day`);
  return { ok: reasons.size === 0, reasons: [...reasons].sort() };
}

export interface Featured { slugs: string[]; rejected: Record<string, string[]>; covered: string[]; notes: string[] }
/**
 * The featured families, in order: the hero's first (the grouped Brennan card), then, one family for each surname and each passing the gate, first the
 * earliest category (in categories.json's order) that is not yet covered, then the family that shows the most services (two or more families show) that no
 * featured family shows yet, then the slug. Fewer than `count` pass: show as many as pass. Never a family that fails the gate.
 */
export function featuredOf(inp: { families: readonly FamilyLite[]; stories: readonly StoryFull[]; index: PairIndex; plan: LanderPlan; categories: readonly Category[];
  services: readonly ServiceLite[]; apps: readonly AppLite[]; lighting: Readonly<Record<string, string>> }): Featured {
  const notes: string[] = [];
  const rejected: Record<string, string[]> = {};
  const story = new Map(inp.stories.map((s) => [s.slug, s]));
  const pass = new Set<string>();
  for (const f of inp.families) {
    const s = story.get(f.slug);
    const g = s ? gateOf(s, inp) : { ok: false, reasons: ['no story'] };
    if (g.ok) pass.add(f.slug); else rejected[f.slug] = g.reasons;
  }
  const catsOf = (f: FamilyLite): string[] => inp.categories.filter((c) => f.personas.some((a) => c.personas.includes(a))).map((c) => c.id);
  const sharedServices = new Set([...inp.index.byService.entries()].filter(([, ps]) => new Set(ps.flatMap((p) => p.families)).size >= 2).map(([id]) => id));
  const servicesOfFam = (slug: string): string[] => [...new Set((inp.index.byFamily.get(slug) ?? []).map((p) => p.service.id))];
  const out: string[] = [], surnames = new Set<string>(), covered: string[] = [], shown = new Set<string>();
  const take = (f: FamilyLite): void => {
    out.push(f.slug); surnames.add(f.surname);
    for (const c of catsOf(f)) if (!covered.includes(c)) covered.push(c);
    for (const sv of servicesOfFam(f.slug)) shown.add(sv);
  };
  const want = inp.plan.featured.count;
  const override = inp.plan.featured.override;
  if (override) {
    for (const slug of override) {
      const f = inp.families.find((x) => x.slug === slug);
      if (!f) { notes.push(`featured.override names ${slug}, which is not a current family`); continue; }
      if (!pass.has(slug)) { notes.push(`featured.override names ${slug}, which fails the gate: ${(rejected[slug] ?? []).join('; ')}`); continue; }
      if (out.length < want) take(f);
    }
    return { slugs: out, rejected, covered, notes };
  }
  const hero = inp.families.find((f) => f.slug === inp.plan.hero.slug);
  if (hero && pass.has(hero.slug)) take(hero);
  else notes.push(`the hero family ${inp.plan.hero.slug} ${hero ? `fails the gate: ${(rejected[hero.slug] ?? []).join('; ')}` : 'is not a current family'}`);
  while (out.length < want) {
    const pool = inp.families.filter((f) => pass.has(f.slug) && !out.includes(f.slug) && !surnames.has(f.surname));
    if (!pool.length) break;
    const gain = (f: FamilyLite): number => servicesOfFam(f.slug).filter((sv) => sharedServices.has(sv) && !shown.has(sv)).length;
    const nextCat = inp.categories.map((c) => c.id).find((id) => !covered.includes(id) && pool.some((f) => catsOf(f).includes(id)));
    const cands = nextCat ? pool.filter((f) => catsOf(f).includes(nextCat)) : pool;
    cands.sort((a, b) => gain(b) - gain(a) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    take(cands[0]);
  }
  if (out.length < want) notes.push(`only ${out.length} of ${want} featured slots have a family that passes the gate`);
  return { slugs: out, rejected, covered, notes };
}

// ---------------------------------------------------------------------------------------------------------------- the proof

export interface Proof { slug: string; beat: string; title: string; before: string; after: string; chips: string[]; note: string; service: ServiceLite; app: AppLite }
/** The first candidate beat of the plan that is a pair the page may show, with its words as the family file says them. None: the block is left out. */
export function proofOf(plan: Pick<LanderPlan, 'proof'>, stories: readonly StoryFull[], index: PairIndex): { proof: Proof | null; skipped: string[] } {
  const skipped: string[] = [];
  for (const c of plan.proof.candidates) {
    const st = stories.find((s) => s.slug === c.slug);
    const b = st?.beats.find((x) => x.id === c.beat);
    if (!st || !b) { skipped.push(`${c.slug}/${c.beat}: no such family or beat`); continue; }
    const pair = (index.byFamily.get(c.slug) ?? []).find((p) => p.beats[c.slug] === c.beat);
    if (!pair) {
      const why = index.rejected.find((r) => r.families.includes(c.slug) && b.app && r.app === b.app.id && (!b.service || r.service === b.service));
      skipped.push(`${c.slug}/${c.beat}: ${why ? `the pair ${why.service}|${why.app} may not show (${why.why})` : 'not a pair the page may show'}`);
      continue;
    }
    const d = b.detail, p = b.popup;
    if (!d?.before || !d?.after || !p?.title || !(p.chips || []).length) { skipped.push(`${c.slug}/${c.beat}: the beat has no title, chips, before or after`); continue; }
    return { proof: { slug: c.slug, beat: c.beat, title: p.title, before: d.before, after: d.after, chips: p.chips || [], note: p.note || '', service: pair.service, app: pair.app }, skipped };
  }
  return { proof: null, skipped };
}

// ---------------------------------------------------------------------------------------------------------------- validating the plan

export interface PlanCheck { errors: string[]; warnings: string[] }
/**
 * The plan held to the tree. `errors` are mistakes in the plan itself (a shape, a name that is nowhere: a hold entry for a service that does not exist
 * would hold nothing and nobody would know); `warnings` are the tree having moved under a plan that was right (a hero family that is not current, a
 * proof beat that is gone, the H1's claim still on hold). The build prints warnings and, in strict mode, fails on them.
 */
export function validatePlan(plan: LanderPlan, ctx: { schema: any; stories: readonly StoryFull[]; services: readonly ServiceLite[]; apps: readonly AppLite[]; claims: ClaimsLite; houses: readonly { id: string }[] }): PlanCheck {
  const errors = checkSchema(plan, ctx.schema).map((e) => `lander.json ${e}`);
  const warnings: string[] = [];
  if (errors.length) return { errors, warnings };
  const sv = new Set(ctx.services.map((s) => s.id)), ap = new Set(ctx.apps.map((a) => a.id)), hs = new Set(ctx.houses.map((h) => h.id));
  const slugs = new Set(ctx.stories.map((s) => s.slug));
  for (const m of plan.messages) {
    const c = ctx.claims.allowedClaims.find((x) => x.id === m.claim);
    if (!c) warnings.push(`messages.${m.key}: claims.json has no allowedClaims entry ${m.claim}`);
    else if (c.status === 'hold') warnings.push(`messages.${m.key}: the claim ${m.claim} is on hold in claims.json (awaiting the owner's sign-off), and the page prints it`);
  }
  const hero = ctx.stories.find((s) => s.slug === plan.hero.slug);
  if (!hero) warnings.push(`hero: the family ${plan.hero.slug} is not current (the hero plays its home)`);
  else if (hero.house !== plan.hero.house) errors.push(`lander.json hero: ${plan.hero.slug} lives in ${hero.house}, not ${plan.hero.house}`);
  if (!hs.has(plan.hero.house)) errors.push(`lander.json hero: no home ${plan.hero.house}`);
  for (const c of plan.proof.candidates) {
    const st = ctx.stories.find((s) => s.slug === c.slug);
    if (!st) warnings.push(`proof: the family ${c.slug} is not current`);
    else if (!st.beats.some((b) => b.id === c.beat)) warnings.push(`proof: ${c.slug} has no beat ${c.beat}`);
  }
  for (const h of plan.hold) {
    const [s, a] = h.split('|');
    if (!sv.has(s)) errors.push(`lander.json hold: ${h}: no service ${s} in the registry`);
    if (!ap.has(a)) errors.push(`lander.json hold: ${h}: no app ${a} in the catalog`);
  }
  if (new Set(plan.hold).size !== plan.hold.length) errors.push('lander.json hold: an entry is listed twice');
  for (const [s, a] of Object.entries(plan.primary)) {
    if (!sv.has(s)) errors.push(`lander.json primary: no service ${s}`);
    if (typeof a !== 'string' || !ap.has(a)) errors.push(`lander.json primary: ${s}: no app ${String(a)}`);
  }
  for (const id of plan.strip.pin) if (!sv.has(id)) errors.push(`lander.json strip.pin: no service ${id}`);
  const ov = plan.featured.override;
  if (ov !== null && !(Array.isArray(ov) && ov.every((x) => typeof x === 'string'))) errors.push('lander.json featured.override: null or an array of family slugs');
  else for (const x of ov ?? []) if (!slugs.has(x)) warnings.push(`featured.override: ${x} is not a current family`);
  const seen = new Set<string>();
  for (const [t, ids] of Object.entries(plan.types)) {
    if (!(PLACE_TYPES as readonly string[]).includes(t) || t === 'home') errors.push(`lander.json types: ${t} is not a kind of place that is listed (apartment, office)`);
    if (!Array.isArray(ids)) { errors.push(`lander.json types.${t}: an array of home ids`); continue; }
    for (const id of ids) {
      if (!hs.has(id)) errors.push(`lander.json types.${t}: no home ${id}`);
      if (seen.has(id)) errors.push(`lander.json types: ${id} is listed twice`);
      seen.add(id);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------------------------------------------- the whole thing, from a tree

export interface LanderData {
  plan: LanderPlan; index: PairIndex; strip: StripChip[]; featured: Featured; proof: Proof | null; proofSkipped: string[];
  count: string; types: ReturnType<typeof placeTypes>; check: PlanCheck;
  /** the claim text of each message of the plan, by key; `hold` when the claim is on hold */
  messages: Record<string, { claim: string; text: string; hold: boolean }>;
  /** lines the build prints so a reviewer sees what was chosen and why */
  log: string[];
}

/** The inputs that come from files, read once. */
export function readInputs(root: string = ROOT): { claims: ClaimsLite; services: ServiceLite[]; apps: AppLite[]; categories: Category[]; schema: any; lighting: Record<string, string> } {
  const S = (...p: string[]): string => path.join(root, 'content', 'story', ...p);
  const lighting: Record<string, string> = {};
  const hd = path.join(root, 'content', 'houses');
  if (fs.existsSync(hd)) for (const f of fs.readdirSync(hd)) {
    if (!f.endsWith('.json') || f === 'index.json' || f.endsWith('.plan.json')) continue;
    const h = J(path.join(hd, f));
    lighting[h.id ?? f.replace(/\.json$/, '')] = h.lighting?.preset ?? 'unknown';
  }
  return { claims: J(S('claims.json')), services: J(S('services.json')).services, apps: J(S('catalog-apps.json')).apps, categories: loadCategories(root).categories, schema: J(schemaPath(root)), lighting };
}

/** Everything the page needs of the plan, computed once. `stories` are the CURRENT families' stories (the build's story.built), in the story's order. */
export function computeLander(inp: { root?: string; stories: readonly StoryFull[]; families: readonly FamilyLite[]; houses: readonly { id: string; type?: string }[]; plan?: LanderPlan;
  files?: ReturnType<typeof readInputs> }): LanderData {
  const root = inp.root ?? ROOT;
  const plan = inp.plan ?? readPlan(root);
  const f = inp.files ?? readInputs(root);
  const index = buildPairIndex({ stories: inp.stories, services: f.services, apps: f.apps, plan, bans: bansOf(f.claims) });
  const strip = stripOf(index, plan);
  const featured = featuredOf({ families: inp.families, stories: inp.stories, index, plan, categories: f.categories, services: f.services, apps: f.apps, lighting: f.lighting });
  const { proof, skipped } = proofOf(plan, inp.stories, index);
  const types = placeTypes(inp.houses, plan);
  const check = validatePlan(plan, { schema: f.schema, stories: inp.stories, services: f.services, apps: f.apps, claims: f.claims, houses: inp.houses });
  const messages: LanderData['messages'] = {};
  for (const m of plan.messages) {
    const c = f.claims.allowedClaims.find((x) => x.id === m.claim);
    if (c) messages[m.key] = { claim: m.claim, text: c.text, hold: c.status === 'hold' };
  }
  const log = [
    `front: strip = ${strip.map((c) => `${c.service.name} > ${c.app.name} (${c.families.length})`).join(', ') || 'none'}`,
    `front: featured = ${featured.slugs.join(', ') || 'none'}; categories covered: ${featured.covered.join(', ') || 'none'}`,
    `front: ${Object.keys(featured.rejected).length} of ${inp.families.length} families fail the ad-ready gate${Object.keys(featured.rejected).length ? ` (${[...new Set(Object.values(featured.rejected).flat().map((r) => r.replace(/^.* is lit as .*$/, 'a home not lit as day').replace(/^.* is an app the catalog marks avoid$/, 'an avoid app')))].join('; ')})` : ''}`,
    proof ? `front: proof = ${proof.slug}/${proof.beat} (${pairKey(proof.service.id, proof.app.id)})` : `front: no proof block (${skipped.join('; ') || 'no candidates'})`,
    `front: ${index.shown.length} pairs may show, ${index.rejected.length} may not (${[...new Set(index.rejected.map((r) => r.why))].join(', ') || 'none'})`,
  ];
  return { plan, index, strip, featured, proof, proofSkipped: skipped, count: countLine(inp.families.length, inp.houses.length), types, check, messages, log };
}
