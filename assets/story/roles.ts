// The semantic anchor roles of the family stories, as data (content/story/roles.json) plus the few pure helpers every other
// story module shares: which spec types answer a role, which rooms are a "living" or a "kitchen" (the spec names rooms in
// free text and gives them no program, so a room's kinds are read off its name), a stable JSON form and a SHA-256 of it.
//
// THREE-free and fs-free: Node reads roles.json and passes the parsed table in; the page never needs the table (a baked
// lock carries poses, not roles) but may import the helpers. Owner: story-bake. The role NAMES are the contract
// (ROLE_IDS in types.ts); the type lists in roles.json are ours and change without a contract change.
import type { RoleId, RoomRole } from './types.js';

export type RolesTable = {
  v: number;
  builtin: Record<string, string>;
  items: Record<string, string[]>;
  siteItems?: Record<string, string[]>;
  zones: Record<string, string[]>;
  zoneRooms?: Record<string, string>;
  rooms: Record<string, { kinds?: string[]; names?: string; zones?: string[]; builtin?: boolean }>;
  kindNames: Record<string, string>;
  home?: Record<string, string[]>;
  universal: string[];
  [k: string]: unknown;
};

/** roles that are not furniture or lot zones: where they stand comes from the house itself */
export const BUILTIN_ROLES: readonly RoleId[] = ['street', 'front-door', 'core', 'room'];
export const isBuiltinRole = (r: string) => (BUILTIN_ROLES as readonly string[]).includes(r);

// ---- rooms: kinds and roles from names -------------------------------------------------------------------------------
const reCache = new WeakMap<object, Map<string, RegExp>>();
function re(table: object, key: string, src: string): RegExp {
  let m = reCache.get(table); if (!m) { m = new Map(); reCache.set(table, m); }
  let r = m.get(key + '\u0000' + src); if (!r) { r = new RegExp(src, 'i'); m.set(key + '\u0000' + src, r); }
  return r;
}

/** the kinds a room has, read off its name by roles.json `kindNames` (a room may have several: "Living & Dining"). Sorted. */
export function roomKinds(name: string, table: RolesTable): string[] {
  const out: string[] = [];
  for (const [kind, src] of Object.entries(table.kindNames)) if (re(table, 'k:' + kind, src).test(name || '')) out.push(kind);
  return out.sort();
}

/** is a room of this name a `role` room? (roles.json `rooms`: by kind, or by a name pattern; the zone-only roles never match a room) */
export function roomHasRole(name: string, role: RoomRole, table: RolesTable): boolean {
  const def = table.rooms[role]; if (!def) return false;
  if (def.names && re(table, 'n:' + role, def.names).test(name || '')) return true;
  if (def.kinds && def.kinds.length) { const k = roomKinds(name, table); if (def.kinds.some(x => k.includes(x))) return true; }
  return false;
}
/** every RoomRole a room of this name plays */
export function roomRoles(name: string, table: RolesTable): RoomRole[] {
  return (Object.keys(table.rooms) as RoomRole[]).filter(r => roomHasRole(name, r, table));
}

// ---- types ------------------------------------------------------------------------------------------------------------
/** the spec types that answer a role, by where they live; each list is in preference order */
export function typesFor(role: string, table: RolesTable) {
  return {
    items: table.items[role] || [],
    siteItems: (table.siteItems && table.siteItems[role]) || [],
    zones: table.zones[role] || [],
    zoneRooms: (table.zoneRooms && table.zoneRooms[role]) || null,
  };
}
/** the room roles whose rooms an item role "lives" in, most at home first (a couch in the living room before a couch in a bedroom) */
export const homeRooms = (role: string, table: RolesTable): string[] => (table.home && table.home[role]) || [];

// ---- hashing ------------------------------------------------------------------------------------------------------------
/** JSON with sorted keys and no spaces: the same value always gives the same text (the hashes of the locks are over this) */
export function canon(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  const o = x as Record<string, unknown>;
  return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
}
/** SHA-256 of a UTF-8 string, lowercase hex. WebCrypto, so the same call hashes in Node (22+) and in the page. */
export async function sha256Hex(text: string | Uint8Array): Promise<string> {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}
/** rolesSha: what the bake depends on in roles.json (the whole table: a type list, a room pattern or a preference changes poses) */
export const rolesSha = (table: RolesTable) => sha256Hex(canon(table));
