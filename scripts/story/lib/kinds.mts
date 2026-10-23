// Which tables a story is held to, by what kind of story it is. A family keeps content/story/roles.json exactly as it is (the whole table is hashed into
// every family's lock as rolesSha, so it is never edited and never merged for a family); a company is held to roles.json with content/story/roles-office.json
// merged over it, and a building with `use: "office"` is read through the same merged table. Pure and fs-light: the files are read once per process.
//
//   import { rolesFor, mergeRoles, functionsFor } from './kinds.mts';
//   rolesFor('family')    // roles.json, the very object the bake hashes
//   rolesFor('company')   // roles.json + roles-office.json (also 'office')
import fs from 'node:fs';
import path from 'node:path';
import type { RolesTable } from '../../../assets/story/roles.ts';

export type StoryKind = 'family' | 'company';
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const readJson = (rel: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

export interface OfficeRoles { v: number; dropRooms?: string[]; items?: Record<string, string[]>; home?: Record<string, string[]>; rooms?: RolesTable['rooms']; kindNames?: Record<string, string>; universal?: string[]; [k: string]: unknown }

/**
 * `base` with `ext` merged over it for an office (reference/office/office-build-contract.md section 4.1): the `items`, `home`, `rooms` and `kindNames` keys of the
 * extension replace or add to the base's by key, `universal` replaces the list, and the room roles in `ext.dropRooms` are dropped from `rooms`, so that a workshop is
 * `workshop` and not also `garage`, and a home word never resolves to a home room. Neither argument is changed. The result has no `dropRooms`.
 */
export function mergeRoles(base: RolesTable, ext: OfficeRoles): RolesTable {
  const drop = new Set(ext.dropRooms ?? []);
  const rooms = Object.fromEntries(Object.entries(base.rooms).filter(([role]) => !drop.has(role)));
  return {
    ...structuredClone(base),
    items: { ...structuredClone(base.items), ...structuredClone(ext.items ?? {}) },
    home: { ...structuredClone(base.home ?? {}), ...structuredClone(ext.home ?? {}) },
    rooms: { ...structuredClone(rooms), ...structuredClone(ext.rooms ?? {}) },
    kindNames: { ...base.kindNames, ...(ext.kindNames ?? {}) },
    universal: [...(ext.universal ?? base.universal)],
  };
}

let family: RolesTable | null = null, company: RolesTable | null = null;
/** The roles table a story of this kind is held to. `'office'` is read as `'company'` (a building and its company share one table). */
export function rolesFor(kind: StoryKind | 'office' = 'family'): RolesTable {
  if (kind === 'family') return (family ||= readJson('content/story/roles.json'));
  return (company ||= mergeRoles(rolesFor('family'), readJson('content/story/roles-office.json')));
}

export interface FunctionDef { id: string; label: string; rooms: string[]; pool: string[] }
let fns: FunctionDef[] | null = null;
/** The twelve functions of content/story/functions.json: the filter word, the room roles and the apps a story may give a person of each. */
export function functionsFor(): FunctionDef[] { return (fns ||= readJson('content/story/functions.json').functions); }
