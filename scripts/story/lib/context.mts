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
export interface CatalogFile {
  apps: CatalogApp[]; notInStore: { apps: { id: string; name: string; replaces?: string; visibility?: string }[] };
  meta?: { top15?: { id: string; name: string }[]; [k: string]: any };
}

export interface Ctx {
  root: string;
  schema: Schema; claims: ClaimsFile; catalog: CatalogFile; casting: Casting; roles: RolesFile; voices: VoicesFile;
  bans: Ban[]; apps: Map<string, CatalogApp>; castBySlug: Map<string, Casting['families'][number]>;
  appMatchers: { id: string; name: string; re: RegExp; ambiguous: boolean }[];
  notInStore: { name: string; re: RegExp }[];
  /** the 15 story-rich apps (catalog meta.top15) that each need a place in at least three families */
  storyRich: string[];
  reviewedList: ReviewedEntry[]; reviewed: Set<string>; reviewedProblems: string[];
  house(houseId: string): HouseFacts | null;
}

const J = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Catalog names that are ordinary words or names. They are matched case-sensitively, as written in the catalog
 * ("Element", not "element"), so a sentence about an element of surprise does not name an app. (From the reference
 * validator; the list grows when a writer's real sentence trips one, with a fixture.)
 */
export const AMBIGUOUS = new Set(['convert', 'vert', 'trip', 'trek', 'stash', 'sure', 'element', 'vane', 'strix', 'memos', 'grist', 'planka', 'kokoro', 'samba', 'ghost', 'cal', 'halo', 'homarr', 'monetr', 'blinko', 'jotty', 'papra', 'invio', 'razzia']);

export function loadContext(root: string = ROOT, over: Partial<{ reviewed: ReviewedEntry[] }> = {}): Ctx {
  const S = path.join(root, 'content', 'story');
  const schema = J(path.join(S, 'schema', 'family.schema.json'));
  const claims: ClaimsFile = J(path.join(S, 'claims.json'));
  const catalog: CatalogFile = J(path.join(S, 'catalog-apps.json'));
  const casting: Casting = J(path.join(S, 'casting.json'));
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
  const notInStore = (catalog.notInStore?.apps ?? []).map((n) => ({ name: n.name, re: new RegExp(`\\b${escapeRe(n.name)}\\b`, 'i') }));
  const castBySlug = new Map(casting.families.map((f) => [f.slug, f]));
  const storyRich = (catalog.meta?.top15 ?? []).map((a) => a.id);

  const houseCache = new Map<string, HouseFacts | null>();
  const house = (id: string): HouseFacts | null => {
    if (!houseCache.has(id)) houseCache.set(id, deriveHouseFacts(root, id, roles, castBySlugByHouse(casting, id)));
    return houseCache.get(id)!;
  };
  return { root, schema, claims, catalog, casting, roles, voices, bans, apps, castBySlug, appMatchers, notInStore, storyRich, reviewedList, reviewed, reviewedProblems, house };
}

function castBySlugByHouse(casting: Casting, houseId: string) { return casting.families.find((f) => f.house === houseId) ?? null; }
