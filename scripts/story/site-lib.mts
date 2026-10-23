// Shared by the story site's build (site.mts, build-og.mts) and its checks (check-leaks.mts, test-portal.mts): where the
// families come from, the rules a public slug must meet, how a public spec is made from an internal one, the card data
// of the landing, and the hashes. Node only, no dependencies.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../assets/story/types.ts';
import type { Story, CastingFamily, FamilyCard, Category, Household } from '../../assets/story/types.ts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** First 10 hex of the sha256 of the bytes: the `.<hash10>.` in every content-hashed file name (STORY-BIBLE R8). */
export const hash10 = (bytes: Uint8Array | string): string => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
export const sha256 = (bytes: Uint8Array | string): string => crypto.createHash('sha256').update(bytes).digest('hex');
/** The key an old `?house=<id>` link is looked up by: the first 12 hex of the SHA-256 of the id (the id itself never ships). */
export const legacyKey = (id: string): string => sha256(id).slice(0, 12);
export const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

/** A public slug (STORY-BIBLE R: `^[a-z]+(-[a-z]+){0,2}$`, 32 characters at most) and what none may contain. */
export const SLUG_RE = /^[a-z]+(-[a-z]+){0,2}$/;
export const SLUG_FORBIDDEN = ['nora', 'olcia', 'sims', 'schnuck', 'ornilia', 'turbogoku', 'madamredo', 'clumsy', 'holden', 'sarina', 'plnch', 'axiis'];
export function slugProblem(slug: string): string {
  if (!SLUG_RE.test(slug) || slug.length > 32) return `slug ${JSON.stringify(slug)} is not ^[a-z]+(-[a-z]+){0,2}$ at most 32 characters`;
  const bad = SLUG_FORBIDDEN.find(f => slug.includes(f));
  return bad ? `slug ${JSON.stringify(slug)} contains ${JSON.stringify(bad)}` : '';
}

/** The keys a public spec loses. Everything else is byte for byte what the source holds (STORY-BIBLE D4). */
export const SPEC_STRIP = ['$schema', 'name', 'author', 'source', 'emoji'] as const;
/**
 * The source spec's text without its top-level `$schema`, `name`, `author`, `source` and `emoji` lines. The specs are
 * pretty-printed with two-space indents and these five are one-line strings, so the rest keeps its bytes (a parse and
 * a stringify would reformat the numbers). Returns the problem instead when the text is not shaped that way.
 */
export function sanitiseSpec(text: string): { text: string; problem?: string } {
  let out = text;
  for (const k of SPEC_STRIP) {
    const re = new RegExp(`^  ${JSON.stringify(k).replace(/[$]/g, '\\$')}: (?:"(?:[^"\\\\]|\\\\.)*"),?\\n`, 'm');
    out = out.replace(re, '');
  }
  const a = JSON.parse(text), b = JSON.parse(out);
  for (const k of SPEC_STRIP) delete a[k];
  if (JSON.stringify(a) !== JSON.stringify(b) || SPEC_STRIP.some(k => k in b)) return { text: out, problem: 'the sanitised spec differs from the source minus its identity keys' };
  return { text: out };
}

export type Loaded = {
  stories: Story[];
  casting: Record<string, CastingFamily>;
  claims: any;
  catalog: Record<string, { id: string; name: string; description?: string; replaces?: string[]; kind?: string; storeUrl?: string; inLiveStore?: boolean; storySafe?: string }>;
  dir: string;
};

/** The authored files of a folder: `<slug>.json`, not the generated `*.voice.json`, `*.bake.json` nor `films.json`. */
export function storyFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^[a-z][a-z-]*\.json$/.test(f) && !/\.(voice|bake)\.json$/.test(f) && f !== 'films.json').sort();
}

export function loadAll(root: string, dir: string): Loaded {
  const stories: Story[] = storyFiles(dir).map(f => readJson(path.join(dir, f)));
  const castingRaw = readJson(path.join(root, 'content', 'story', 'casting.json'));
  const casting: Record<string, CastingFamily> = Object.fromEntries((castingRaw.families as CastingFamily[]).map(c => [c.slug, c]));
  const claims = readJson(path.join(root, 'content', 'story', 'claims.json'));
  const cat = readJson(path.join(root, 'content', 'story', 'catalog-apps.json'));
  const catalog = Object.fromEntries((cat.apps as any[]).map(a => [a.id, a]));
  return { stories, casting, claims, catalog, dir };
}

export const disclosure = (claims: any, id: string): string => {
  const d = (claims.disclosures as { id: string; text: string }[]).find(x => x.id === id);
  if (!d) throw new Error(`claims.json has no disclosure ${id}`);
  return d.text;
};

/** "The Okafor-Reyes family" */
export const familyTitle = (s: Story): string => `The ${s.family.surname} family`;
export const addressLine = (s: Story): string => `${s.family.address.line}, ${s.family.address.place}`;

/** Topics are the ten categories other than `setup`, in the schema's order. */
export const TOPICS: Category[] = CATEGORIES.filter(c => c !== 'setup');
export const TOPIC_LABEL: Record<string, string> = {
  home: 'Home life', food: 'Food', iot: 'Smart home and IoT', productivity: 'Productivity', money: 'Money', privacy: 'Privacy',
  kids: 'Kids and learning', media: 'Media and music', creative: 'Creative', 'small-business': 'Small business',
};
export const HOUSEHOLD_LABEL: Record<Household, string> = {
  'solo-or-couple': 'Solo or couple', 'young-family': 'Young family', 'older-kids': 'Older kids at home', grandparents: 'Grandparents and grandchildren',
};

export const topicsOf = (s: Story): Category[] => TOPICS.filter(t => s.beats.some(b => b.category === t));

/** Distinct apps in the order the beats first name them (`app` only; `with` is background). */
export function appsOf(s: Story, catalog: Loaded['catalog']): { id: string; name: string; replaces: string[] }[] {
  const seen = new Map<string, { id: string; name: string; replaces: string[] }>();
  for (const b of s.beats) {
    if (!b.app || seen.has(b.app.id)) continue;
    const c = catalog[b.app.id];
    seen.set(b.app.id, { id: b.app.id, name: c ? c.name : b.app.id, replaces: b.app.replaces || [] });
  }
  return [...seen.values()];
}

/** The curated landing order: the featured family first, then the households taken in turn so no run repeats one. */
export const HOUSEHOLD_TURN: Household[] = ['young-family', 'solo-or-couple', 'older-kids', 'grandparents'];
export const FEATURED = 'vance-takahashi';
export function landingOrder(stories: Story[]): string[] {
  const by = new Map<Household, string[]>(HOUSEHOLD_TURN.map(h => [h, []]));
  for (const s of [...stories].sort((a, b) => a.slug.localeCompare(b.slug))) if (s.slug !== FEATURED || !stories.some(x => x.slug === FEATURED)) by.get(s.family.household)!.push(s.slug);
  const out: string[] = stories.some(s => s.slug === FEATURED) ? [FEATURED] : [];
  for (let more = true; more;) {
    more = false;
    for (const h of HOUSEHOLD_TURN) { const next = by.get(h)!.shift(); if (next) { out.push(next); more = true; } }
  }
  return out;
}

export type Card = FamilyCard & { rooms: string[] };
export function cardOf(s: Story, ctx: { catalog: Loaded['catalog']; order: string[]; thumb: string; og: string }): Card {
  const memberLine = (m: Story['members'][number]) => ({ name: m.name, role: m.role, age: m.age, ...(m.companion ? { companion: m.companion.name } : {}) });
  return {
    slug: s.slug, surname: s.family.surname, title: familyTitle(s), address: addressLine(s), tagline: s.family.tagline,
    household: s.family.household, business: s.family.business, topics: topicsOf(s),
    members: s.members.map(memberLine), apps: appsOf(s, ctx.catalog), beats: s.beats.length,
    order: ctx.order.indexOf(s.slug), ...(s.slug === ctx.order[0] && s.slug === FEATURED ? { featured: true } : {}),
    thumb: ctx.thumb, og: ctx.og,
    rooms: [...new Set(s.chapters.filter(c => c.kind !== 'ftue' && c.kind !== 'outro').map(c => c.title))],
  };
}

/** What the og manifest records per image: the text drawn on it and the picture under it (scripts/story/build-og.mts). */
export const ogKey = (text: { kicker: string; title: string; line1: string; line2: string }, base: Uint8Array): string =>
  hash10(JSON.stringify(text) + sha256(base));
export type OgText = { kicker: string; title: string; line1: string; line2: string };
/**
 * The text of a link-preview picture. The landing's says how many families there are, and a count is a word the build writes from the data, never one typed
 * here (it was "Thirty" until the six apartments were cast): the caller passes the count in words, capitalised ("Thirty"; scripts/portal-pages.mts numberWord).
 */
export function ogText(kind: 'home', familiesInWords: string): OgText;
export function ogText(kind: 'family', s: Story): OgText;
export function ogText(kind: 'family' | 'home', arg: Story | string): OgText {
  if (kind === 'home') return { kicker: 'COMPANION CORE · FICTIONAL FAMILIES', title: 'Uncloud your life with Companion Core', line1: `${arg as string} fictional families.`, line2: 'Walk through their homes in 3D and see what stays at home.' };
  const s = arg as Story;
  return { kicker: 'COMPANION CORE · FICTIONAL FAMILY', title: familyTitle(s), line1: addressLine(s), line2: s.family.tagline };
}
