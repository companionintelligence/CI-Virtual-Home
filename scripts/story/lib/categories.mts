// The front page's categories (content/story/categories.json): the chips a visitor filters the families by, each holding the archetypes of
// content/story/personas.json it stands for. Authored data, so it is checked: scripts/validate-stories.mts (pnpm run story:validate) runs
// `checkCategories` on every run, scripts/test-categories.mts holds the rules to unit tests, and scripts/portal-front.mts reads the file with
// `loadCategories` so that the chips and the picker data come from it and not from a list in code.
//
// What the checks are (the schema, content/story/schema/categories.schema.json, only gives the shape):
//   every archetype of personas.json is in exactly one category, and a category names no archetype that is not in personas.json
//   ids are unique and never equal an archetype id (the filter value, ?persona=, is either; cards carry both)
//   labels are unique, at most LABEL_MAX characters, sentence case (a capital first, no other capital) and carry no dash
//   a blurb is at most BLURB_WORDS words, ends with a full stop, has no dash or exclamation mark, and trips none of claims.json's error phrases
//   type filters are unique places, in the order home, apartment, office, with labels under the same rules as the categories'
import fs from 'node:fs';
import path from 'node:path';
import { checkSchema, type Schema } from './schema-lite.mts';

export const LABEL_MAX = 18;
export const BLURB_WORDS = 20;
/** The kinds of place, in the order of the second filter (Homes, Apartments, Offices). */
export const PLACE_TYPES = ['home', 'apartment', 'office'] as const;

export interface Category { id: string; label: string; blurb: string; personas: string[] }
export interface TypeFilter { id: (typeof PLACE_TYPES)[number]; label: string }
export interface CategoriesFile { version: 1; categories: Category[]; typeFilters: TypeFilter[] }

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const J = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

export const categoriesPath = (root: string = ROOT): string => path.join(root, 'content', 'story', 'categories.json');
export const categoriesSchemaPath = (root: string = ROOT): string => path.join(root, 'content', 'story', 'schema', 'categories.schema.json');

/** The file as authored. Throws when it is missing or is not JSON; `checkCategories` says whether it is right. */
export function loadCategories(root: string = ROOT): CategoriesFile { return J(categoriesPath(root)); }

/** The archetype ids of content/story/personas.json, in its order. */
export function loadArchetypeIds(root: string = ROOT): string[] { return Object.keys(J(path.join(root, 'content', 'story', 'personas.json')).archetypes); }

const DASH = /[–—]|\s-\s|\s--\s/;
/** Sentence case for a label: a capital first and no other capital (no proper noun is a chip). */
const sentenceCase = (s: string): boolean => /^\p{Lu}/u.test(s) && !/\p{Lu}/u.test(s.slice(1));

export interface CategoryRules {
  /** the archetype ids of personas.json */
  archetypes: string[];
  /** content/story/schema/categories.schema.json */
  schema: Schema;
  /** claims.json's banned phrases of severity error, as regular expressions (optional) */
  bans?: RegExp[];
}

/** Every problem with a categories file, one line each; none means it is right. Pure: the same inputs give the same lines. */
export function checkCategories(data: unknown, rules: CategoryRules): string[] {
  const out: string[] = [];
  for (const m of checkSchema(data, rules.schema)) out.push(`categories.json ${m}`);
  if (out.length) return out;                                  // the rules below read a file of the right shape
  const f = data as CategoriesFile;
  const copy = (at: string, s: string, what: string): void => {
    if (DASH.test(s)) out.push(`${at}: ${what} has a dash`);
    if (/!/.test(s)) out.push(`${at}: ${what} has an exclamation mark`);
    for (const re of rules.bans ?? []) if (re.test(s)) out.push(`${at}: ${what} trips the claims rule ${re}`);
  };

  const ids = new Set<string>(), labels = new Set<string>();
  const owner = new Map<string, string>();                     // archetype -> the category that holds it
  for (const c of f.categories) {
    const at = `categories.json category ${c.id}`;
    if (ids.has(c.id)) out.push(`${at}: the id is used twice`);
    ids.add(c.id);
    if (rules.archetypes.includes(c.id)) out.push(`${at}: the id is also an archetype id (the filter value must say which)`);
    if (labels.has(c.label.toLowerCase())) out.push(`${at}: the label "${c.label}" is used twice`);
    labels.add(c.label.toLowerCase());
    if (c.label.length > LABEL_MAX) out.push(`${at}: the label "${c.label}" is ${c.label.length} characters (at most ${LABEL_MAX})`);
    if (!sentenceCase(c.label)) out.push(`${at}: the label "${c.label}" is not sentence case`);
    copy(at, c.label, 'the label');
    const words = c.blurb.trim().split(/\s+/).filter(Boolean).length;
    if (words > BLURB_WORDS) out.push(`${at}: the blurb is ${words} words (at most ${BLURB_WORDS})`);
    if (!/\.$/.test(c.blurb.trim())) out.push(`${at}: the blurb does not end with a full stop`);
    if (!/^\p{Lu}/u.test(c.blurb)) out.push(`${at}: the blurb does not start with a capital`);
    copy(at, c.blurb, 'the blurb');
    const seen = new Set<string>();
    for (const a of c.personas) {
      if (seen.has(a)) { out.push(`${at}: ${a} is listed twice`); continue; }
      seen.add(a);
      if (!rules.archetypes.includes(a)) { out.push(`${at}: ${a} is not an archetype in personas.json`); continue; }
      if (owner.has(a)) out.push(`${at}: ${a} is also in ${owner.get(a)} (an archetype is in exactly one category)`);
      else owner.set(a, c.id);
    }
  }
  for (const a of rules.archetypes) if (!owner.has(a)) out.push(`categories.json: the archetype ${a} is in no category`);

  const types = new Set<string>(), typeLabels = new Set<string>();
  for (const t of f.typeFilters) {
    const at = `categories.json type filter ${t.id}`;
    if (types.has(t.id)) out.push(`${at}: the id is used twice`);
    types.add(t.id);
    if (typeLabels.has(t.label.toLowerCase())) out.push(`${at}: the label "${t.label}" is used twice`);
    typeLabels.add(t.label.toLowerCase());
    if (!sentenceCase(t.label)) out.push(`${at}: the label "${t.label}" is not sentence case`);
    copy(at, t.label, 'the label');
  }
  const order = f.typeFilters.map((t) => t.id).join();
  if (order !== PLACE_TYPES.join()) out.push(`categories.json type filters are ${order || 'empty'}; they are ${PLACE_TYPES.join(', ')}, in that order`);
  return out;
}

/** The rules for the repository's own files: personas.json, the schema and claims.json's error phrases. */
export function repoRules(root: string = ROOT): CategoryRules {
  const claimsFile = path.join(root, 'content', 'story', 'claims.json');
  const bans = fs.existsSync(claimsFile)
    ? (J(claimsFile).bannedPhrases as { pattern: string; flags?: string; severity: string }[]).filter((b) => b.severity === 'error').map((b) => new RegExp(b.pattern, b.flags ?? 'i'))
    : [];
  return { archetypes: loadArchetypeIds(root), schema: J(categoriesSchemaPath(root)), bans };
}

/** The category an archetype is in, or undefined (a file that passes `checkCategories` has one for every archetype). */
export function categoryOf(f: CategoriesFile, archetype: string): Category | undefined { return f.categories.find((c) => c.personas.includes(archetype)); }
