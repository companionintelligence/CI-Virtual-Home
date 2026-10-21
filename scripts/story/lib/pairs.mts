// The pair index: which service each app in the families' stories is an alternative to, and which of those pairs a page may show.
// Pure (no file is read here; scripts/story/lib/lander.mts loads the inputs), so the front page and, later, the ad kit
// (scripts/render-persona-cuts.mts) take the same pairs and cannot name different ones.
//
// The pair of a beat is its `service` (the v3 families name it), else the service that `app.replaces[0]` resolves to by name or
// alias (the pass-1 families), the same ledger as `fleetHomes` in scripts/story/build-services.mts. A pair MAY SHOW only when
//   the service is a current one the registry lets a story name (alternativeToForm ok, storyStatus ok, link not never, no stale or story-excluded flag),
//   the app is in the live store and not storySafe "avoid",
//   the pair is not on the plan's `hold` list (a pair counsel has not cleared), and
//   the line "<app>, alternative to <service>" trips none of the copy rules the caller passes (claims.json's error and review phrases).
// Counts are FAMILIES, never beats.

export interface ServiceLite { id: string; name: string; aliases: string[]; category: string; link: string; flags: string[]; alternativeToForm: string; storyStatus: string }
export interface AppLite { id: string; name: string; storySafe?: string; inLiveStore?: boolean }
export interface StoryLite { slug: string; beats: { id: string; service?: string; app?: { id: string; replaces?: string[] } }[] }
export interface StripRules { size: number; minFamilies: number; maxPerApp: number; maxPerRegistryCategory: number; maxPerBrand: number; pin: readonly string[] }
export interface PairPlan { hold: readonly string[]; primary: Readonly<Record<string, string>>; strip: StripRules }

export type Why = 'unknown-service' | 'service-not-ok' | 'unknown-app' | 'app-avoid' | 'app-not-live' | 'held' | 'copy-rule';
/** One (service, app) the stories name, with the families that show it (sorted) and, for each, the first beat that does. */
export interface Pair { service: ServiceLite; app: AppLite; families: string[]; beats: Record<string, string> }
export interface Rejected { service: string; app: string; families: string[]; why: Why }
export interface PairIndex {
  /** every pair a page may show */ shown: Pair[];
  /** every pair the stories name that a page may not show, with the reason */ rejected: Rejected[];
  /** service id -> the shown pairs of that service */ byService: Map<string, Pair[]>;
  /** family slug -> its shown pairs, in the order of its beats */ byFamily: Map<string, Pair[]>;
}
export interface StripChip { service: ServiceLite; app: AppLite; /** the families that show the service, with any app */ families: string[] }

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** "GitLab (SaaS)" -> "GitLab" */
const clean = (n: string): string => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();

export const pairKey = (serviceId: string, appId: string): string => `${serviceId}|${appId}`;
/** The words of a pair a card or a chip prints, in the story's own order and punctuation. */
export const pairLine = (p: { service: ServiceLite; app: AppLite }): string => `${p.app.name}, alternative to ${p.service.name}`;
/** "Google Photos" -> "google": the first word of a service, so four Google rows are not the first four chips. */
export const brandOf = (name: string): string => name.toLowerCase().split(/[\s-]+/)[0] || name.toLowerCase();

/** Does the registry let a story name this service as something an app is an alternative to? */
export const serviceOk = (s: ServiceLite): boolean =>
  s.alternativeToForm === 'ok' && s.storyStatus === 'ok' && s.link !== 'never' && !s.flags.includes('stale') && !s.flags.includes('story-excluded');

export function buildPairIndex(inp: { stories: readonly StoryLite[]; services: readonly ServiceLite[]; apps: readonly AppLite[]; plan: Pick<PairPlan, 'hold'>; bans?: readonly RegExp[] }): PairIndex {
  const byName = new Map<string, ServiceLite>();
  for (const s of inp.services) for (const n of [s.name, ...s.aliases]) if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), s);
  const byId = new Map(inp.services.map((s) => [s.id, s]));
  const appById = new Map(inp.apps.map((a) => [a.id, a]));
  const resolve = (name: string): ServiceLite | undefined => byName.get(name.toLowerCase()) ?? byName.get(clean(name).toLowerCase());
  const held = new Set(inp.plan.hold);
  const bans = inp.bans ?? [];

  // the ledger: (service, app) -> family -> the first beat
  const ledger = new Map<string, { sid: string; aid: string; beats: Map<string, string> }>();
  for (const st of inp.stories) for (const b of st.beats) {
    if (!b.app) continue;
    const first = b.app.replaces?.[0];
    // a name the registry does not know stays in the ledger under "?name", so the page can say which pair it left out and why (never as a registry id)
    const sid = b.service ?? (first ? resolve(first)?.id ?? `?${clean(first).toLowerCase()}` : undefined);
    if (!sid) continue;
    const k = pairKey(sid, b.app.id);
    const row = ledger.get(k) ?? { sid, aid: b.app.id, beats: new Map<string, string>() };
    if (!row.beats.has(st.slug)) row.beats.set(st.slug, b.id);
    ledger.set(k, row);
  }

  const shown: Pair[] = [], rejected: Rejected[] = [];
  for (const [k, row] of ledger) {
    const families = [...row.beats.keys()].sort(cmp);
    const no = (why: Why): void => { rejected.push({ service: row.sid, app: row.aid, families, why }); };
    const service = byId.get(row.sid), app = appById.get(row.aid);
    if (!service) { no('unknown-service'); continue; }
    if (!serviceOk(service)) { no('service-not-ok'); continue; }
    if (!app) { no('unknown-app'); continue; }
    if (app.storySafe === 'avoid') { no('app-avoid'); continue; }
    if (app.inLiveStore === false) { no('app-not-live'); continue; }
    if (held.has(k)) { no('held'); continue; }
    if (bans.some((re) => re.test(pairLine({ service, app })))) { no('copy-rule'); continue; }
    shown.push({ service, app, families, beats: Object.fromEntries(row.beats) });
  }
  shown.sort((a, b) => cmp(a.service.id, b.service.id) || cmp(a.app.id, b.app.id));
  rejected.sort((a, b) => cmp(`${a.service}|${a.app}`, `${b.service}|${b.app}`));

  const byService = new Map<string, Pair[]>(), byFamily = new Map<string, Pair[]>();
  for (const p of shown) byService.set(p.service.id, [...(byService.get(p.service.id) ?? []), p]);
  for (const st of inp.stories) {
    // in the order of the family's beats, one entry for each pair
    const mine: Pair[] = [];
    for (const b of st.beats) {
      const p = shown.find((x) => x.beats[st.slug] === b.id);
      if (p && !mine.includes(p)) mine.push(p);
    }
    byFamily.set(st.slug, mine);
  }
  return { shown, rejected, byService, byFamily };
}

/** How many families show a service (with any app). */
export const familiesOf = (pairs: readonly Pair[]): string[] => [...new Set(pairs.flatMap((p) => p.families))].sort(cmp);

/**
 * The strip of chips the chooser shows ("What do you rent today?"): the services most families show, one chip each with the app that is an
 * alternative to it, capped so it reads as a spread and not as one vendor's catalogue (one chip for each app, at most two for each registry
 * category and two for each first brand word); `pin` first, `primary` decides which app a chip shows when the stories use several.
 */
export function stripOf(index: PairIndex, plan: PairPlan): StripChip[] {
  const r = plan.strip;
  const rows = [...index.byService.entries()].map(([id, pairs]) => ({ id, pairs, service: pairs[0].service, families: familiesOf(pairs) })).filter((x) => x.families.length >= r.minFamilies);
  rows.sort((a, b) => b.families.length - a.families.length || cmp(a.service.name, b.service.name));
  const pinned = r.pin.map((id) => rows.find((x) => x.id === id)).filter((x): x is (typeof rows)[number] => !!x);
  const order = [...pinned, ...rows.filter((x) => !r.pin.includes(x.id))];
  const usedApp = new Map<string, number>(), perCat = new Map<string, number>(), perBrand = new Map<string, number>();
  const out: StripChip[] = [];
  for (const row of order) {
    if (out.length >= r.size) break;
    // the app the chip shows: the plan's, else the one the most families use (ties by name), else the next that no chip has yet
    const ranked = [...row.pairs].sort((a, b) => b.families.length - a.families.length || cmp(a.app.name, b.app.name));
    const want = plan.primary[row.id], first = want ? row.pairs.find((p) => p.app.id === want) : undefined;
    const pair = [first, ...ranked].find((p) => p && (usedApp.get(p.app.id) ?? 0) < r.maxPerApp);
    if (!pair) continue;
    const cat = row.service.category, brand = brandOf(row.service.name);
    if ((perCat.get(cat) ?? 0) >= r.maxPerRegistryCategory || (perBrand.get(brand) ?? 0) >= r.maxPerBrand) continue;
    usedApp.set(pair.app.id, (usedApp.get(pair.app.id) ?? 0) + 1);
    perCat.set(cat, (perCat.get(cat) ?? 0) + 1);
    perBrand.set(brand, (perBrand.get(brand) ?? 0) + 1);
    out.push({ service: row.service, app: pair.app, families: row.families });
  }
  return out;
}

/** Every word the search should find a family by through its pairs: the services (and their aliases) and the apps, lower case. */
export function findOf(index: PairIndex, slug: string): string {
  const words = (index.byFamily.get(slug) ?? []).flatMap((p) => [p.service.name, ...p.service.aliases, p.app.name]);
  return [...new Set(words.map((w) => w.toLowerCase()))].join(' ');
}

/** The service ids a family's cleared pairs name (what a chip filters the cards by). */
export const servicesOf = (index: PairIndex, slug: string): string[] => [...new Set((index.byFamily.get(slug) ?? []).map((p) => p.service.id))];
