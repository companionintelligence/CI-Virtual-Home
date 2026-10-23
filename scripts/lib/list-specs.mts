// Which specs of content/houses/ are homes and which are offices. A building is a HouseSpec (reference/office/office-contract-m0.md): an office
// carries `use: "office"`, a home carries nothing (or "home"), and content/houses/index.json keeps them apart, `houses` for the homes and `offices`
// beside it. Every script that reads the folder takes the homes by default, so a fleet metric, a count or a gallery never meets an office by accident,
// and says `all` where an office must be held to the same gates (validate, shot QA, the twins).
//
//   import { listSpecs, allHouses, specUse } from './lib/list-specs.mts';
//   for (const { id, file, spec } of listSpecs({ kind: 'home' })) …          // the homes, in file order (the default)
//   listSpecs({ kind: 'office' }) · listSpecs({ kind: 'all' })
//   allHouses(index)                                                        // index.houses then index.offices: the readers that must see both
//
// Pure of the engine: no import beyond node:fs and node:path, so a script that only needs the list does not load the validator.
import fs from 'node:fs';
import path from 'node:path';

export const HOUSES_DIR = path.resolve(import.meta.dirname, '..', '..', 'content', 'houses');

export type SpecKind = 'home' | 'office' | 'all';
export type SpecUse = 'home' | 'office';

/** What a spec is for: `'office'` only when it says so, a home otherwise (a missing field, or anything else, is a home; the office validator reports a value that is neither). */
export const specUse = (spec: unknown): SpecUse => (spec && typeof spec === 'object' && (spec as { use?: unknown }).use === 'office' ? 'office' : 'home');

/** The spec files of a folder: `<id>.json`, not index.json, not a `.plan.json` (build output beside a spec), sorted by name. The filter every `readdirSync(content/houses)` glob wrote by hand. */
export function specFileNames(dir: string = HOUSES_DIR): string[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort();
}

export interface SpecEntry { id: string; /** absolute path */ file: string; /** the name in the folder */ name: string; spec: any; use: SpecUse }
export interface SpecError { name: string; file: string; error: string }

/**
 * The specs of a folder that are of `kind` (default the homes). A file that is not valid JSON is not a spec; it is reported through `errors` (when given) and
 * is counted as a home for `kind: 'home'`, the way the hand-written globs treated it (they read it and failed on it), so a broken home is never hidden by this.
 */
export function listSpecs(o: { kind?: SpecKind; dir?: string; errors?: SpecError[] } = {}): SpecEntry[] {
  const kind = o.kind ?? 'home', dir = o.dir ?? HOUSES_DIR;
  const out: SpecEntry[] = [];
  for (const name of specFileNames(dir)) {
    const file = path.join(dir, name);
    let spec: any;
    try { spec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
      o.errors?.push({ name, file, error: (e as Error).message });
      if (kind !== 'office') out.push({ id: name.replace(/\.json$/, ''), file, name, spec: null, use: 'home' });
      continue;
    }
    const use = specUse(spec);
    if (kind === 'all' || kind === use) out.push({ id: typeof spec?.id === 'string' ? spec.id : name.replace(/\.json$/, ''), file, name, spec, use });
  }
  return out;
}

/** The ids of the homes, or of the offices, or of both (file order). */
export const specIds = (kind: SpecKind = 'home', dir?: string): string[] => listSpecs({ kind, dir }).map((e) => e.id);

/**
 * Every row of content/houses/index.json: the homes, then the offices. For the readers that must see both (the credit guard, the leak scan, the twins, the
 * player's list); the gallery, its counts and the fleet metrics read `index.houses` and are left as they are.
 */
export const allHouses = <T extends { id: string }>(index: { houses?: T[]; offices?: T[] } | null | undefined): T[] => [...(index?.houses ?? []), ...(index?.offices ?? [])];
