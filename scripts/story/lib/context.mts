// The validator's inputs, loaded once: the schema, the claims (ban list), the catalog snapshot, the casting, the role
// map, the voice registry and the review allow-list. Every path resolves from this file's own location, so any cwd works.
import fs from 'node:fs';
import path from 'node:path';
import type { Schema } from './schema-lite.mts';
import { reviewKey, type ReviewedEntry } from './report.mts';
import { deriveHouseFacts, type HouseFacts } from './house.mts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export interface Ban { id: string; pattern: string; flags: string; severity: 'error' | 'review' | 'warn'; why: string; fix: string; re: RegExp }
export interface CatalogApp {
  id: string; name: string; kind: string; replaces: string[]; description: string;
  agent: { link: 'wired' | 'mcp' | 'api' | 'ui' | 'none'; mcpEntry: string | null; hubWiring: string[] };
  storySafe: 'yes' | 'with-caveat' | 'avoid'; caveats: { kind: string; text: string }[];
  /** story v3 age rule: `chat` marks a chat-model or agent app (age-chat needs a member of 16 or older); absent for every other app */
  ai?: 'chat';
  qa: 'screenshot' | 'no-screenshot' | 'not-boot-tested'; inLiveStore?: boolean;
}
export interface Casting {
  v: number; households: Record<string, string>;
  families: import('../../../assets/story/types.ts').CastingFamily[];
}
export interface RolesFile {
  v: number; builtin: Record<string, string>; items: Record<string, string[]>; zones: Record<string, string[]>;
  rooms: Record<string, { kinds?: string[]; names?: string; zones?: string[]; builtin?: boolean }>; universal: string[];
}
export interface VoicesFile { v: number; voices: Record<string, { kokoro: string; status: string; narratorFor: number; agentFits: string[] }> }
export interface ClaimsFile {
  bannedPhrases: { id: string; pattern: string; flags: string; severity: Ban['severity']; why: string; fix: string }[];
  allowedClaims: { id: string; text: string; tag: string; status: string; source: string }[];
  apps: { id: string; display: string; mayDescribeAs?: string; caveats?: string[] }[];
  disclosures: { id: string; text: string; long?: string; required: boolean }[];
}
export type PersonasFile = import('../../../assets/story/types.ts').PersonasFile;
export interface CatalogFile {
  apps: CatalogApp[]; excluded?: { id: string; name?: string; kind?: string; reason?: string }[]; notInStore: { apps: { id: string; name: string; replaces?: string; visibility?: string }[] };
  meta?: { top15?: { id: string; name: string; qa?: string }[]; [k: string]: any };
}

/** One row of content/story/services.json (the registry of replaced services; reference/story/story-v3.md). */
export interface Service {
  id: string; name: string; aliases: string[]; category: string;
  homepage: string; homepageChecked: string; link: 'yes' | 'text-only' | 'never';
  flags: ('stale' | 'story-excluded' | 'ordinary-word' | 'renamed')[]; alternativeToForm: 'ok' | 'review' | 'blocked'; storyStatus: 'ok' | 'uncurated-only' | 'excluded-only';
  mark: { mode: 'badge' | 'logo'; glyph: string; logoAllowed: boolean; cleared: boolean; ownedFile: string | null; ownedKind: 'exact' | 'listing-logo' | 'parent' | 'none' };
  incumbentNameList: boolean;
  apps: string[]; storyApps: string[]; fleetHomes: string[]; rank: number; top80: boolean;
}
export interface ServicesFile { v: number; generated: string; checked: string; services: Service[] }
/** The registry indexed for the rules: by id, and by name or alias (lower case). An absent file is an empty registry. */
export interface ServiceIndex { file: ServicesFile | null; byId: Map<string, Service>; byName: Map<string, Service> }

export interface Ctx {
  root: string;
  schema: Schema; claims: ClaimsFile; catalog: CatalogFile; casting: Casting; roles: RolesFile; voices: VoicesFile;
  /** the archetype table (content/story/personas.json) */
  personas: PersonasFile;
  /** the registry of replaced services (content/story/services.json) */
  services: ServiceIndex;
  bans: Ban[]; apps: Map<string, CatalogApp>; castBySlug: Map<string, Casting['families'][number]>;
  appMatchers: { id: string; name: string; re: RegExp; ambiguous: boolean }[];
  notInStore: { name: string; re: RegExp }[];
  /** the story-rich apps (catalog meta.top15, those with a QA screenshot; 14 of 15) that each need a place in at least three families */
  storyRich: string[];
  reviewedList: ReviewedEntry[]; reviewed: Set<string>; reviewedProblems: string[];
  house(houseId: string): HouseFacts | null;
}

const J = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Not-in-store app names that are ordinary words (see the notInStore matcher in loadContext). */
export const ORDINARY_WORDS = new Set(['sunshine', 'onyx', 'lychee']);

/**
 * Catalog names that are ordinary words or names. They are matched case-sensitively, as written in the catalog
 * ("Element", not "element"), so a sentence about an element of surprise does not name an app. (From the reference
 * validator; the list grows when a writer's real sentence trips one, with a fixture.)
 */
export const AMBIGUOUS = new Set(['convert', 'vert', 'trip', 'trek', 'stash', 'sure', 'element', 'vane', 'strix', 'memos', 'grist', 'planka', 'kokoro', 'samba', 'ghost', 'cal', 'halo', 'homarr', 'monetr', 'blinko', 'jotty', 'papra', 'invio', 'razzia', 'code server']);

/**
 * `reviewed` replaces the allow-list. `world` is a directory with a `casting.json` and a `houses/` folder (HouseSpecs and plans)
 * that stand in for content/story/casting.json and content/houses/: the tests use one (test/fixtures/stories/world) so the
 * exemplar and the negative cases do not depend on the shipped casting or on how the shipped houses are laid out today.
 */
export function loadContext(root: string = ROOT, over: Partial<{ reviewed: ReviewedEntry[]; world: string }> = {}): Ctx {
  const S = path.join(root, 'content', 'story');
  const schema = J(path.join(S, 'schema', 'family.schema.json'));
  const claims: ClaimsFile = J(path.join(S, 'claims.json'));
  const catalog: CatalogFile = J(path.join(S, 'catalog-apps.json'));
  const casting: Casting = J(path.join(over.world ?? S, 'casting.json'));
  const personas: PersonasFile = J(path.join(S, 'personas.json'));
  const servicesFile: ServicesFile | null = fs.existsSync(path.join(S, 'services.json')) ? J(path.join(S, 'services.json')) : null;
  const housesDir = over.world ? path.join(over.world, 'houses') : path.join(root, 'content', 'houses');
  const roles: RolesFile = J(path.join(S, 'roles.json'));
  const voices: VoicesFile = J(path.join(S, 'voices.json'));

  const reviewedList: ReviewedEntry[] = over.reviewed ?? (fs.existsSync(path.join(S, 'reviewed.json')) ? J(path.join(S, 'reviewed.json')) : []);
  const reviewedProblems: string[] = [];
  const reviewed = new Set<string>();
  if (!Array.isArray(reviewedList)) reviewedProblems.push('content/story/reviewed.json must be an array');
  else reviewedList.forEach((e, i) => {
    // an entry without an owner initial is not a review: it would clear a finding nobody signed
    if (!e || typeof e.slug !== 'string' || typeof e.at !== 'string' || typeof e.rule !== 'string' || typeof e.by !== 'string' || !e.by.trim()) reviewedProblems.push(`reviewed.json[${i}] needs slug, at, rule and by (the owner's initials)`);
    else reviewed.add(reviewKey(e.slug, e.at, e.rule));
  });

  const bans: Ban[] = claims.bannedPhrases.map((b) => ({ ...b, re: new RegExp(b.pattern, b.flags) }));
  const apps = new Map(catalog.apps.map((a) => [a.id, a]));
  const appMatchers = catalog.apps.flatMap((a) => {
    const n = a.name;
    if (n.length < 3 || (n.length === 3 && !/\d/.test(n))) return [];            // too short to match as a word; n8n is the one 3-character app
    const ambiguous = AMBIGUOUS.has(n.toLowerCase());
    return [{ id: a.id, name: n, ambiguous, re: new RegExp(`(?<![\\w-])${escapeRe(n)}(?![\\w-])`, ambiguous ? '' : 'i') }];
  });
  // A store name that is also an ordinary word (Sunshine, Onyx, Lychee: daylight copy and kitchens use them) counts only when it is
  // capitalised in the middle of a sentence, so "Sunshine fills the room" and "onyx counters" are not the app. Every other name matches
  // in any case.
  const notInStore = (catalog.notInStore?.apps ?? []).map((n) => ({
    name: n.name,
    re: ORDINARY_WORDS.has(n.name.toLowerCase())
      ? new RegExp(`(?<!^|[.!?:]\\s+|\\n)\\b${escapeRe(n.name)}\\b`)
      : new RegExp(`\\b${escapeRe(n.name)}\\b`, 'i'),
  }));
  const castBySlug = new Map(casting.families.map((f) => [f.slug, f]));
  const services: ServiceIndex = { file: servicesFile, byId: new Map(), byName: new Map() };
  for (const sv of servicesFile?.services ?? []) { services.byId.set(sv.id, sv); for (const n of [sv.name, ...sv.aliases]) services.byName.set(n.toLowerCase(), sv); }
  // An app with no QA screenshot cannot be placed without an owner entry in reviewed.json (rule app-qa-screenshot), and the catalog
  // itself names a screenshot-backed fallback for it (mealie -> kitchenowl), so it is not required of the fleet. Assembly decision,
  // flagged for the owner: list three mealie beats in reviewed.json to make it count, or leave it out.
  const storyRich = (catalog.meta?.top15 ?? []).filter((a) => a.qa === 'screenshot').map((a) => a.id);

  const houseCache = new Map<string, HouseFacts | null>();
  const house = (id: string): HouseFacts | null => {
    if (!houseCache.has(id)) houseCache.set(id, deriveHouseFacts(housesDir, id, roles, castBySlugByHouse(casting, id)));
    return houseCache.get(id)!;
  };
  return { root, schema, claims, catalog, casting, roles, voices, personas, services, bans, apps, castBySlug, appMatchers, notInStore, storyRich, reviewedList, reviewed, reviewedProblems, house };
}

function castBySlugByHouse(casting: Casting, houseId: string) { return casting.families.find((f) => f.house === houseId) ?? null; }
