// What a house has, derived from the house's own files, so a story that anchors a beat on "the fireplace" in a home
// without one fails here and not on a camera pose three weeks later.
//
// Sources, in order of authority:
//   content/houses/<id>.json       the HouseSpec: typed items per room (levels[].rooms[].items[].type) and the site entries
//   content/houses/<id>.plan.json  the derived plan: `shots.world` (the digest the camera planner sees; kind 3 and 15 names
//                                  are item types) and `site.instances`; it is what the story-bake resolver reads, so a role
//                                  that is in the plan but not the spec still counts as present
//   content/story/roles.json       which item types and site types a role resolves to
// casting.json's role counts are informational (a mismatch is a warning, see checkCastingAgreement): they were
// generated from the same specs once and go stale when a spec changes, which is exactly why the validator re-derives.
import fs from 'node:fs';
import path from 'node:path';
import type { RolesFile, Casting } from './context.mts';

export interface HouseFacts {
  id: string; hasSpec: boolean; hasPlan: boolean;
  /** spec item type -> how many */
  itemCounts: Record<string, number>;
  /** role -> how many items or site entries resolve to it (0 = the house does not have it) */
  roleCounts: Record<string, number>;
  /** roles that resolve in this house: the builtin four plus every role with a count above zero */
  roles: Set<string>;
  /** room roles present (living, kitchen, office ...) ; null when casting gives no room list for this house */
  rooms: Set<string> | null;
  roomNames: string[];
  /** the spec's display name, if it has one (story v2: a lede never names the house) */
  displayName?: string;
}

/**
 * Site entry types that count toward a role although roles.json does not list them. Found by comparing roles.json with
 * the 30 specs: roles.json lists the zone type `drive`, but every spec writes `driveway`; the loungers and benches that
 * the specs place as site entries are patio seating; turtle-pool is a pool. story-bake owns roles.json: when it fixes
 * the lists these aliases become redundant and harmless.
 */
const SITE_ALIASES: Record<string, string[]> = {
  garden: ['garden', 'garden-beds', 'greenhouse'],
  driveway: ['drive', 'driveway'],
  pool: ['pool', 'hottub', 'turtle-pool'],
  deck: ['deck', 'terrace', 'roof-terrace', 'porch', 'patio'],
  'patio-seat': ['loungers', 'bench', 'firepit'],
};

const readJson = (p: string): any => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);

/** `dir` holds <id>.json and <id>.plan.json (content/houses, or the houses/ folder of a test world). */
export function deriveHouseFacts(dir: string, id: string, roles: RolesFile, cast: Casting['families'][number] | null): HouseFacts | null {
  const spec = readJson(path.join(dir, `${id}.json`));
  const plan = readJson(path.join(dir, `${id}.plan.json`));
  if (!spec && !plan) return null;

  const itemCounts: Record<string, number> = {};
  const planItemTypes = new Set<string>();
  const siteTypes = new Set<string>();
  const roomNames: string[] = [];
  for (const level of spec?.levels ?? []) {
    for (const room of level.rooms ?? []) {
      if (room.name) roomNames.push(String(room.name));
      for (const it of room.items ?? []) itemCounts[it.type] = (itemCounts[it.type] || 0) + 1;
    }
  }
  for (const z of spec?.site ?? []) siteTypes.add(z.type);
  if (plan) {
    for (const z of plan.site?.instances ?? []) siteTypes.add(z.type);
    const w = plan.shots?.world;
    // world kinds 3 (items) and 15 (room items) carry the raw item type as the box name
    if (w?.kinds && w?.names) w.kinds.forEach((k: number, i: number) => { if (k === 3 || k === 15) planItemTypes.add(w.names[i]); });
  }

  const roleCounts: Record<string, number> = {};
  const present = new Set<string>(['street', 'front-door', 'core', 'room']);
  if (plan?.kit?.hero || spec?.hero) present.add('core');
  for (const [role, types] of Object.entries(roles.items)) {
    const n = types.reduce((a, t) => a + (itemCounts[t] || 0), 0);
    const viaPlan = types.some((t) => planItemTypes.has(t));
    const viaSite = (SITE_ALIASES[role] ?? []).filter((t) => siteTypes.has(t)).length;
    roleCounts[role] = n + viaSite;
    if (n > 0 || viaPlan || viaSite > 0) present.add(role);
  }
  for (const [role, types] of Object.entries(roles.zones)) {
    const all = [...new Set([...types, ...(SITE_ALIASES[role] ?? [])])];
    const n = all.filter((t) => siteTypes.has(t)).length;
    roleCounts[role] = n;
    if (n > 0) present.add(role);
  }
  // every house has ground: a garden role always resolves to the nearest planted bed, deck or lawn (STORY-BIBLE section 6)
  present.add('garden');

  let rooms: Set<string> | null = null;
  if (cast) {
    rooms = new Set<string>(['street', 'garden']);
    const kindToRoom = new Map<string, string>();
    for (const [room, def] of Object.entries(roles.rooms)) for (const k of def.kinds ?? []) kindToRoom.set(k, room);
    const nameRes = Object.entries(roles.rooms).filter(([, d]) => d.names).map(([room, d]) => [room, new RegExp(d.names!, 'i')] as const);
    for (const r of cast.rooms) {
      for (const k of r.kinds) if (kindToRoom.has(k)) rooms.add(kindToRoom.get(k)!);
      for (const [room, re] of nameRes) if (re.test(r.name)) rooms.add(room);
    }
    if (present.has('deck') || present.has('pool')) rooms.add('patio');
  }
  return { id, hasSpec: !!spec, hasPlan: !!plan, itemCounts, roleCounts, roles: present, rooms, roomNames, displayName: typeof spec?.name === 'string' ? spec.name : undefined };
}

/**
 * Item roles that casting.json lists and the house files no longer have. (A role the files have and casting does not is
 * fine: the site entries add loungers and benches that casting did not count. Zones are not compared: casting counts
 * them differently.)
 */
export function castingDisagreements(facts: HouseFacts, cast: Casting['families'][number], roles: RolesFile): string[] {
  const out: string[] = [];
  for (const role of Object.keys(roles.items)) {
    if ((cast.roles[role] || 0) > 0 && !facts.roles.has(role)) out.push(`${role}: casting says ${cast.roles[role]}, the house files say ${facts.roleCounts[role] || 0}`);
  }
  return out;
}
