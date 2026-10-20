// Build content/story/casting.json (and reference/story/cast.md) from the authored cast plan and the house files.
//
//   content/story/cast-plan.json   the showrunner's decisions: who lives where, their archetype, the narrator, the signature apps
//   content/houses/<id>.json       what the house has (rooms, items, hero, entry, site)        } the facts casting derives:
//   content/houses/<id>.plan.json  the derived plan (what the bake resolves anchors against)   } rooms, roles, Core room,
//   content/story/roles.json       which item types answer which role                          } anchors, home flags
//
// Deterministic: the same inputs give byte-identical outputs. There is no wall clock; `generated` is the plan's own date.
//
//   node --experimental-strip-types scripts/story/build-casting.mts            write casting.json and cast.md
//   node --experimental-strip-types scripts/story/build-casting.mts --check    exit 1 when either file is out of date
//   node --experimental-strip-types scripts/story/build-casting.mts --stdout   print casting.json, write nothing
//
// The validator re-derives role counts from the house files on every run (scripts/story/lib/house.mts), so the counts here
// are informational; what the validator does read from casting.json is slug, house, household, business, narrator, rooms,
// roles, homeFlags and signatureApps (a test), and the persona fields this file adds (members, flagship).
//
// cast-lint.mts imports the helpers exported here, so the lint and the build can never disagree about a room or a topic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roomKinds, roomRoles } from '../../assets/story/roles.ts';
import { displayName } from '../../assets/home-names.ts';
import { deriveHouseFacts, type HouseFacts } from './lib/house.mts';
import type { RolesFile } from './lib/context.mts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
const S = (...p: string[]): string => path.join(ROOT, 'content', 'story', ...p);
const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---- the plan ---------------------------------------------------------------------------------------------------------
// The fourteen archetypes of content/story/personas.json (the first six are the original cast; the other eight are story v3, in the owner's order).
export type Archetype = 'organiser' | 'builder' | 'gamer' | 'learner' | 'maker' | 'host'
  | 'tech-family' | 'business-owner' | 'creative' | 'contractor' | 'marketer' | 'lawyer' | 'journalist' | 'educator';
export const ARCHETYPES: Archetype[] = ['organiser', 'builder', 'gamer', 'learner', 'maker', 'host',
  'tech-family', 'business-owner', 'creative', 'contractor', 'marketer', 'lawyer', 'journalist', 'educator'];
export interface PlanMember {
  id: string; name: string; age: number; role: string; archetype: Archetype | null; work?: string;
  room: string; sleepsIn: string | null; roomLabel?: string; companion?: string;
}
export interface PlanFamily {
  slug: string; house: string; surname: string; place: string; flagship?: boolean;
  household: string; business: boolean; businessText?: string; tenure: 'owner' | 'renter'; narrator: string;
  reason: string; household_text: string; care: string; fitNote?: string; reviewNeeded?: string[];
  signatureApps: string[]; beatApps?: Partial<Record<Topic, string>>; members: PlanMember[];
}
export interface Plan { v: number; generated: string; note: string; households: Record<string, string>; retiredSlugs: string[]; families: PlanFamily[] }

// ---- anchor preferences per archetype (reference/story/personas.md) -------------------------------------------------------
/** item roles an archetype stands at, in preference order. The chain always ends in a room role or a universal role. */
export const PREFS: Record<Archetype, string[]> = {
  organiser: ['desk', 'dining-table', 'couch'],
  builder: ['desk', 'dining-table'],
  gamer: ['tv', 'bed', 'desk', 'couch'],
  learner: ['desk', 'bookshelf', 'couch'],
  maker: ['easel', 'music', 'desk'],
  // story v3 (reference/story/persona-bible.md 5.3): item roles only; `room` and `core` are not furniture and a zone (`driveway`) is never in a room
  'tech-family': ['desk', 'counter', 'couch', 'tv'],
  'business-owner': ['desk', 'dining-table', 'counter', 'bookshelf'],
  creative: ['easel', 'desk', 'music', 'bookshelf'],
  contractor: ['desk', 'laundry', 'bookshelf'],
  marketer: ['desk', 'kitchen-island', 'counter', 'dining-table'],
  lawyer: ['desk', 'bookshelf', 'dining-table'],
  journalist: ['desk', 'bookshelf', 'dining-table'],
  educator: ['dining-table', 'desk', 'bookshelf', 'kitchen-island'],
  host: ['kitchen-island', 'fridge', 'range', 'garden', 'couch', 'tv'],
};
/** the room role a member's chapter is set in, most fitting first, per archetype */
const ROOM_PREF: Record<Archetype, string[]> = {
  organiser: ['office', 'dining', 'living', 'bedroom', 'kitchen'],
  builder: ['office', 'bedroom', 'living', 'dining', 'garage', 'kitchen'],
  gamer: ['living', 'kids', 'bedroom'],
  learner: ['kids', 'bedroom', 'office', 'living'],
  maker: ['office', 'living', 'bedroom', 'kids'],
  'tech-family': ['garage', 'office', 'entry', 'living', 'bedroom', 'dining'],
  'business-owner': ['office', 'dining', 'living', 'kitchen', 'bedroom', 'entry'],
  creative: ['office', 'living', 'bedroom', 'garage', 'dining', 'kids'],
  contractor: ['garage', 'office', 'entry', 'laundry', 'dining', 'kitchen', 'living'],
  marketer: ['office', 'living', 'dining', 'kitchen', 'bedroom'],
  lawyer: ['office', 'dining', 'living', 'bedroom', 'kitchen'],
  journalist: ['office', 'dining', 'kitchen', 'living', 'bedroom'],
  educator: ['dining', 'office', 'living', 'kitchen', 'kids', 'bedroom'],
  host: ['kitchen', 'living', 'dining', 'garden'],
};
/** furniture the specs place that roles.json does not list under the role it plainly serves (reported, never used in a chain) */
export const ROLE_GAPS: Record<string, string[]> = {
  couch: ['sofa', 'l-sectional', 'modular-sectional', 'tuxedo-sofa'],
  bed: ['house-bed'],
  desk: ['kids-desk'],
  'dining-table': ['trestle-table'],
};
/** the hero surface that is a desk (the Core stands on a desk, so the room has a desk for the story) */
const HERO_DESK = new Set(['desk', 'writing-desk', 'standing-desk']);

// ---- app topics (the ten topics of the landing page; "setup" is every family's) -------------------------------------------
export const TOPICS = ['home', 'food', 'iot', 'productivity', 'money', 'privacy', 'kids', 'media', 'creative', 'small-business'] as const;
export type Topic = (typeof TOPICS)[number];
const T = (s: string): string[] => s.split(/\s+/).filter(Boolean);
/** which topics an app can carry in a beat. A judgement, kept here so the plan, the table and the lint agree. */
export const APP_TOPICS: Record<Topic, Set<string>> = {
  home: new Set(T('yuvomi ci-planning homehub donetick homebox vikunja hortusfox bookstack paperless kitchenowl lubelogger grocy jotty planka')),
  food: new Set(T('kitchenowl mealie grocy tandoor yuvomi homehub')),
  iot: new Set(T('home-assistant frigate ntfy glasshome homarr uptime-kuma pi-hole adguardhome music-assistant ci-ha-voice heimdall')),
  productivity: new Set(T('nextcloud libreoffice onlyoffice collabora-online cryptpad ci-planning joplin bookstack obsidian n8n activepieces stirling-pdf vikunja super-productivity baikal planka forgejo gitea jupyterlab code-server open-webui ci-openclaw ci-hermes ci-memory logseq docmost')),
  money: new Set(T('wallos firefly-iii monetr spliit akaunting invio invoice-ninja taxhacker ghostfolio wealthfolio')),
  privacy: new Set(T('vaultwarden pi-hole adguardhome searxng simplelogin cryptgeon privatebin duplicati syncthing open-webui ci-memory forgejo gitea nextcloud paperless netbird')),
  kids: new Set(T('libretranslate ci-spellbook koodo-reader booklore kokoro razzia readeck linkwarden steam-headless audiobookshelf jupyterlab habitica donetick obsidian')),
  media: new Set(T('immich photoprism librephotos foldergram jellyfin navidrome mstream audiobookshelf koodo-reader booklore freshrss music-assistant steam-headless')),
  creative: new Set(T('penpot inkscape excalidraw tldraw drawio audiomass blockbench comfyui opencut freecut mazanoke rembg remotion-studio')),
  'small-business': new Set(T('twenty espocrm odoo invoice-ninja invio akaunting kimai solidtime docuseal documenso listmonk keila ghost wordpress nocodb baserow grist metabase opnform formbricks chatwoot papercups postiz mixpost plausible umami matomo medusa prestashop hi-events linkstack n8n activepieces')),
};
/** every app the plan puts in a family's tour: the signature apps and the beat apps that cover a required topic */
export const allApps = (f: PlanFamily): string[] => [...f.signatureApps, ...Object.values(f.beatApps ?? {}).filter((a): a is string => !!a && !f.signatureApps.includes(a))];
/** the topics a family can carry: its apps, plus what its members and business make possible */
export function topicsPossible(f: PlanFamily): Topic[] {
  const out = new Set<Topic>();
  const apps = allApps(f);
  for (const t of TOPICS) if (apps.some((a) => APP_TOPICS[t].has(a))) out.add(t);
  if (f.business) out.add('small-business'); else out.delete('small-business');
  if (f.members.some((m) => m.age < 18)) out.add('kids'); else if (!f.members.some((m) => m.archetype === 'learner')) out.delete('kids');
  if (f.members.some((m) => m.archetype === 'maker')) out.add('creative');
  return TOPICS.filter((t) => out.has(t));
}

// ---- the house --------------------------------------------------------------------------------------------------------------
export interface RoomInfo {
  key: string; name: string; level: string; levelY: number; area: number; kinds: string[]; roles: string[];
  program: string | null; types: Record<string, number>; bounds: { x: number; z: number; w: number; d: number };
}
export interface HouseInfo {
  id: string; spec: any; plan: any; rooms: RoomInfo[]; facts: HouseFacts; coreRoom: RoomInfo | null;
  storeys: number; areaSqm: number; name: string;
}
const round = (n: number, p = 1): number => Math.round(n * 10 ** p) / 10 ** p;
export const slugify = (s: string): string => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function loadRoles(): RolesFile & { kindNames: Record<string, string> } { return readJson(S('roles.json')); }

export function loadHouse(id: string, roles: RolesFile & { kindNames: Record<string, string> }): HouseInfo {
  const spec = readJson(path.join(ROOT, 'content', 'houses', `${id}.json`));
  const planFile = path.join(ROOT, 'content', 'houses', `${id}.plan.json`);
  const plan = fs.existsSync(planFile) ? readJson(planFile) : null;
  const index = readJson(path.join(ROOT, 'content', 'houses', 'index.json')).houses.find((h: any) => h.id === id);
  const names = new Map<string, number>();
  for (const L of spec.levels) for (const r of L.rooms) names.set(r.name, (names.get(r.name) || 0) + 1);
  const rooms: RoomInfo[] = [];
  for (const L of spec.levels) {
    for (const r of L.rooms) {
      const types: Record<string, number> = {};
      for (const it of r.items ?? []) types[it.type] = (types[it.type] || 0) + 1;
      const b = r.bounds;
      rooms.push({
        key: (names.get(r.name) || 0) > 1 ? `${r.name}@${L.id}` : r.name, name: r.name, level: L.id, levelY: L.y ?? 0,
        area: round(b.w * b.d), kinds: roomKinds(r.name, roles as any), roles: roomRoles(r.name, roles as any) as string[],
        program: r.program ?? null, types, bounds: { x: b.x, z: b.z, w: b.w, d: b.d },
      });
    }
  }
  const facts = factsFor(id, roles);
  const h = spec.hero;
  const coreRoom = rooms.find((r) => r.level === h.level && h.at[0] >= r.bounds.x - 0.05 && h.at[0] <= r.bounds.x + r.bounds.w + 0.05 && h.at[1] >= r.bounds.z - 0.05 && h.at[1] <= r.bounds.z + r.bounds.d + 0.05) ?? null;
  return { id, spec, plan, rooms, facts, coreRoom, storeys: index?.storeys ?? spec.levels.length, areaSqm: index?.areaSqm ?? spec.areaSqm ?? 0, name: index ? displayName(index) : spec.name };
}

/**
 * The validator's own derivation (scripts/story/lib/house.mts). Its first argument was the repo root and is now the
 * houses folder (so a test world can be passed): try the folder, then the root, so this file survives either.
 */
function factsFor(id: string, roles: RolesFile): HouseFacts {
  for (const base of [path.join(ROOT, 'content', 'houses'), ROOT]) {
    const f = deriveHouseFacts(base, id, roles, null);
    if (f) return f;
  }
  throw new Error(`deriveHouseFacts found no house files for ${id}`);
}

/** find a room by the plan's key: "Study" or, where the name repeats in the house, "Study@l1" */
export function findRoom(h: HouseInfo, key: string): RoomInfo | null {
  return h.rooms.find((r) => r.key === key) ?? null;
}

// ---- anchors ------------------------------------------------------------------------------------------------------------------
/** roles that have a piece in the room, by the roles.json type lists (and the Core's own desk in the Core's room) */
function roleHere(room: RoomInfo, role: string, h: HouseInfo, roles: RolesFile): boolean {
  const types = roles.items[role] ?? [];
  if (types.some((t) => room.types[t])) return true;
  if (role === 'desk' && h.coreRoom && h.coreRoom.key === room.key && HERO_DESK.has(h.spec.hero.surface)) return true;
  return false;
}
function typeHere(room: RoomInfo, role: string, roles: RolesFile): string | null {
  for (const t of roles.items[role] ?? []) if (room.types[t]) return t;
  return null;
}
export interface Derived { anchors: string[]; roomRoles: string[]; chapterRoom: string | null; gaps: string[]; pieces: string[] }
export function deriveAnchors(m: PlanMember, room: RoomInfo, h: HouseInfo, roles: RolesFile): Derived {
  const arch = (m.archetype ?? 'host') as Archetype;
  const chain: string[] = [];
  const gaps: string[] = [];
  const pieces: string[] = [];
  for (const role of PREFS[arch]) {
    if (role === 'garden') continue;                                         // a zone: never in a room
    if (roleHere(room, role, h, roles)) {
      chain.push(role);
      const t = typeHere(room, role, roles);
      if (t) pieces.push(`${t}/${slugify(room.name)}/1`);
    } else {
      const alias = (ROLE_GAPS[role] ?? []).find((t) => room.types[t]);
      if (alias) gaps.push(`${alias} is ${role}-like but roles.json does not list it under ${role}`);
    }
  }
  const chapterRoom = ROOM_PREF[arch].find((r) => room.roles.includes(r)) ?? room.roles[0] ?? null;
  if (chapterRoom) chain.push(`room:${chapterRoom}`);
  else if (arch === 'host' && /green|garden/i.test(room.name)) chain.push('garden');
  else if (!chain.includes('couch')) chain.push('couch');                      // a room with no room role: end on a universal role
  return { anchors: chain, roomRoles: room.roles, chapterRoom, gaps, pieces };
}

// ---- sleeping capacity ---------------------------------------------------------------------------------------------------------
const DOUBLE_BEDS = new Set(['headboard-bed', 'four-poster-bed', 'platform-bed', 'canopy-bed']);
const SINGLE_BEDS = new Set(['single-bed', 'house-bed', 'loft-bed', 'toddler-bed', 'mattress-on-floor', 'daybed']);
/** how many people (not babies) can honestly sleep in a room: counted from its beds; a bedroom with no bed item counts by program */
export function sleepCapacity(r: RoomInfo): number {
  let n = 0;
  for (const [t, c] of Object.entries(r.types)) {
    if (DOUBLE_BEDS.has(t)) n += 2 * c; else if (SINGLE_BEDS.has(t)) n += c; else if (t === 'bunk-bed') n += 2 * c;
  }
  if (n === 0 && /^bed-(primary|guest)$/.test(r.program ?? '')) n = 2;
  if (n === 0 && r.program === 'bed-kid') n = 1;
  return n;
}
export const hasCrib = (r: RoomInfo): boolean => !!r.types['crib'] || /nursery/i.test(r.name) || r.program === 'nursery';

/** a level's `stairs` is one flight or an array of flights */
const list = (x: any): any[] => (Array.isArray(x) ? x : x ? [x] : []);

// ---- core walk (an approximation; the planner's door-to-core track is authoritative) --------------------------------------------
function coreWalk(h: HouseInfo): { metres: number; roomsPassed: string[]; seenFromDoor: boolean; awkwardScore: number; approx: true } {
  const spec = h.spec, e = spec.entry, hero = spec.hero;
  const lv = (id: string): any => spec.levels.find((l: any) => l.id === id);
  const ei = spec.levels.findIndex((l: any) => l.id === e.level), hi = spec.levels.findIndex((l: any) => l.id === hero.level);
  const fp = lv(e.level).footprint as { x: number; z: number; w: number; d: number }[];
  const x0 = Math.min(...fp.map((r) => r.x)), x1 = Math.max(...fp.map((r) => r.x + r.w)), z0 = Math.min(...fp.map((r) => r.z)), z1 = Math.max(...fp.map((r) => r.z + r.d));
  const door: [number, number] = e.side === 'S' ? [e.at, z1] : e.side === 'N' ? [e.at, z0] : e.side === 'E' ? [x1, e.at] : [x0, e.at];
  const legs: { level: string; from: [number, number]; to: [number, number] }[] = [];
  let cur: [number, number] = door;
  const step = hi >= ei ? 1 : -1;
  for (let i = ei; i !== hi; i += step) {
    const a = spec.levels[i], b = spec.levels[i + step];
    const st = list(a.stairs).find((s: any) => s.to === b.id && Array.isArray(s.at)) ?? list(b.stairs).find((s: any) => s.to === a.id && Array.isArray(s.at));
    const at: [number, number] = st ? [st.at[0], st.at[1]] : cur;
    legs.push({ level: a.id, from: cur, to: at });
    cur = at;
  }
  legs.push({ level: hero.level, from: cur, to: [hero.at[0], hero.at[1]] });
  let metres = 0;
  const passed: string[] = [];
  for (const L of legs) {
    const len = Math.hypot(L.to[0] - L.from[0], L.to[1] - L.from[1]);
    metres += len;
    const n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 0; k <= n; k++) {
      const x = L.from[0] + ((L.to[0] - L.from[0]) * k) / n, z = L.from[1] + ((L.to[1] - L.from[1]) * k) / n;
      const room = h.rooms.find((r) => r.level === L.level && x >= r.bounds.x - 0.05 && x <= r.bounds.x + r.bounds.w + 0.05 && z >= r.bounds.z - 0.05 && z <= r.bounds.z + r.bounds.d + 0.05);
      if (room && passed[passed.length - 1] !== room.name) passed.push(room.name);
    }
  }
  const changes = Math.abs(hi - ei);
  metres += changes * 3;
  const m = round(metres);
  return { metres: m, roomsPassed: passed, seenFromDoor: changes === 0 && passed.length <= 2 && m <= 12, awkwardScore: changes + (passed.length > 4 ? 1 : 0) + (m > 20 ? 1 : 0), approx: true };
}

// ---- home flags (what the house does not have, said to the writer) ---------------------------------------------------------------
const NO_TV = 'Do not write a TV or a screen in this home. Tell the media beat at the couch or the music item (a record player, a piano, speakers on the shelf), with Navidrome, Audiobookshelf, Koodo Reader or Immich on a phone. A TV only in a bedroom or hall is not the living-room TV.';
const NO_ISLAND = 'No island or breakfast bar: anchor the kitchen beat on the counter, range or fridge (roles counter, range, fridge) and say "the counter", never "the island".';
const NO_GARDEN = 'No garden zone of 10 m2 or more: use the nearest planted bed, planter or deck (roles garden, deck) and say "the planters" or "the deck".';
const NO_TABLE = 'No dining table: use the counter or the couch for the family-meal beat.';
const CORE_SHELF = 'The only desk is the shelf the Core stands on: office beats use the nearest desk-like surface or the couch group; do not invent a desk.';
const NO_DESK = 'No desk in the house: office beats use the dining table, the couch group or the room itself; do not invent a desk.';
function homeFlags(h: HouseInfo, roles: RolesFile): { no: string; status: string; say: string }[] {
  const out: { no: string; status: string; say: string }[] = [];
  const rc = h.facts.roleCounts;
  if ((rc['tv'] || 0) === 0) out.push({ no: 'tv', status: 'none', say: NO_TV });
  else {
    const tvRooms = h.rooms.filter((r) => (roles.items['tv'] ?? []).some((t) => r.types[t]));
    if (!tvRooms.some((r) => r.roles.includes('living'))) out.push({ no: 'tv', status: tvRooms.some((r) => r.roles.includes('bedroom')) ? 'bedroom-only' : 'hall-only', say: NO_TV });
  }
  if ((rc['kitchen-island'] || 0) === 0) out.push({ no: 'kitchen-island', status: 'none', say: NO_ISLAND });
  if ((rc['dining-table'] || 0) === 0) out.push({ no: 'dining-table', status: 'none', say: NO_TABLE });
  if ((rc['desk'] || 0) === 0) { const heroDesk = HERO_DESK.has(h.spec.hero.surface); out.push({ no: 'desk', status: heroDesk ? 'core-desk-only' : 'core-shelf-only', say: heroDesk ? 'The only desk is the Core\'s own: office beats stand at it or at the couch group; do not invent a second desk.' : CORE_SHELF }); }
  if ((rc['garden'] || 0) === 0) out.push({ no: 'garden', status: 'none', say: NO_GARDEN });
  return out;
}

// ---- casting.json ---------------------------------------------------------------------------------------------------------------------
export interface Built { casting: any; md: string; json: string; problems: string[]; houses: Map<string, HouseInfo>; derived: Map<string, Derived> }

export function build(): Built {
  const plan: Plan = readJson(S('cast-plan.json'));
  const roles = loadRoles();
  const problems: string[] = [];
  const houses = new Map<string, HouseInfo>();
  const derived = new Map<string, Derived>();
  const families: any[] = [];
  for (const f of plan.families) {
    const h = loadHouse(f.house, roles);
    houses.set(f.house, h);
    const core = h.coreRoom;
    if (!core) problems.push(`${f.slug}: the Core's room could not be found from spec.hero`);
    const members = f.members.map((m) => {
      const room = findRoom(h, m.room);
      if (!room) { problems.push(`${f.slug}/${m.id}: room "${m.room}" does not exist in ${f.house} (rooms: ${h.rooms.map((r) => r.key).join(', ')})`); return { ...m, roomRoles: [], anchors: [] }; }
      if (m.sleepsIn && !findRoom(h, m.sleepsIn)) problems.push(`${f.slug}/${m.id}: sleepsIn "${m.sleepsIn}" does not exist in ${f.house}`);
      const d = deriveAnchors(m, room, h, roles);
      derived.set(`${f.slug}/${m.id}`, d);
      const out: any = { id: m.id, name: m.name, age: m.age, role: m.role, archetype: m.archetype };
      if (m.work) out.work = m.work;
      out.room = room.name; out.level = room.level;
      if (room.key !== room.name) out.roomKey = room.key;
      if (m.roomLabel) out.roomLabel = m.roomLabel;
      out.roomRoles = d.roomRoles;
      out.anchors = d.anchors;
      if (d.gaps.length) out.anchorGaps = d.gaps;
      if (m.sleepsIn) out.sleepsIn = m.sleepsIn;
      if (m.companion) out.companion = m.companion;
      return out;
    });
    const hero = h.spec.hero;
    const entryLevel = h.spec.levels.find((l: any) => l.id === h.spec.entry.level);
    const surface = HERO_DESK.has(hero.surface) ? 'desk' : 'shelf';
    const cw = coreWalk(h);
    const aboveGround = (entryLevel?.y ?? 0) > 0.3;
    const fam: any = { slug: f.slug, house: f.house };
    if (f.flagship) fam.flagship = true;
    fam.surname = f.surname; fam.place = f.place;
    fam.household = f.household; fam.business = f.business; fam.businessText = f.businessText ?? null;
    fam.narrator = f.narrator; fam.tenure = f.tenure;
    fam.storeys = h.storeys; fam.areaSqm = h.areaSqm; fam.homeStyle = h.spec.style; fam.lotGround = h.spec.lot?.ground ?? 'flat';
    fam.household_text = f.household_text; fam.care = f.care;
    fam.ftueExtra = `${aboveGround ? 'The front door is above ground, up some steps. ' : ''}The Core is on a ${hero.surface} in the ${core?.name ?? 'house'}${cw.seenFromDoor ? ', in sight of the door' : ''}.`;
    fam.reason = f.reason;
    if (f.fitNote) fam.fitNote = f.fitNote;
    fam.members = members;
    fam.signatureApps = f.signatureApps;
    if (f.beatApps) fam.beatApps = f.beatApps;
    if (f.reviewNeeded?.length) fam.reviewNeeded = f.reviewNeeded;
    fam.coreRoom = core?.name ?? null;
    fam.coreSpot = { room: core?.name ?? '', level: hero.level, surface, furniture: hero.surface, pose: hero.pose };
    fam.frontDoor = { side: h.spec.entry.side, aboveGround };
    fam.coreWalk = cw;
    fam.rooms = h.rooms.map((r) => ({ name: r.name, level: r.level, kinds: r.kinds, areaSqm: r.area }));
    fam.roles = h.facts.roleCounts;
    fam.homeFlags = homeFlags(h, roles);
    fam.categoryHints = topicsPossible(f);
    const anchors = new Set<string>();
    for (const m of f.members) for (const p of derived.get(`${f.slug}/${m.id}`)?.pieces ?? []) anchors.add(p);
    fam.anchorsToUse = [...anchors];
    fam.eyelessAnchors = [];
    families.push(fam);
  }
  const casting = {
    v: 2,
    generated: plan.generated,
    source: 'content/story/cast-plan.json, content/houses/*.json and *.plan.json, content/story/roles.json: built by scripts/story/build-casting.mts, never edited by hand',
    note: 'Casting for the 30 persona homes. Each family has members with an archetype (organiser, builder, gamer, learner, maker, host), a room in this house and an anchor chain that ends in a room or universal role. `members[].anchors` follow roles.json strictly; `anchorGaps` lists furniture roles.json does not yet list. `rooms`, `roles`, `coreSpot` and `homeFlags` are derived from the house files; the validator re-derives counts, so they are informational. `coreWalk` is an approximation (a straight line, no pathfinding): the planner track is authoritative. `house` is internal and never appears on a public surface.',
    households: plan.households,
    families,
  };
  const json = format(casting);
  const md = renderMd(plan, casting, houses);
  return { casting, md, json, problems, houses, derived };
}

// ---- stable JSON ---------------------------------------------------------------------------------------------------------------------
/** one space per level, short leaf arrays and one-object-per-line lists on one line; keys keep the order they were built in */
function format(v: any, depth = 0): string {
  const pad = (n: number): string => ' '.repeat(n);
  const flat = (x: any): string => JSON.stringify(x);
  if (v === null || typeof v !== 'object') return flat(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object') || (flat(v).length <= 110 && !v.some((x) => x && typeof x === 'object' && Object.values(x).some((y) => y && typeof y === 'object' && !Array.isArray(y))))) return flat(v);
    return `[\n${v.map((x) => pad(depth + 1) + (x && typeof x === 'object' && !Array.isArray(x) && flat(x).length <= 240 ? flat(x) : format(x, depth + 1))).join(',\n')}\n${pad(depth)}]`;
  }
  const keys = Object.keys(v);
  if (!keys.length) return '{}';
  return `{\n${keys.map((k) => `${pad(depth + 1)}${JSON.stringify(k)}: ${format(v[k], depth + 1)}`).join(',\n')}\n${pad(depth)}}`;
}

// ---- cast.md -------------------------------------------------------------------------------------------------------------------------------
function renderMd(plan: Plan, casting: any, houses: Map<string, HouseInfo>): string {
  const L: string[] = [];
  const fams: any[] = casting.families;
  L.push('# Cast (the 30 persona homes)', '');
  L.push('Generated by `scripts/story/build-casting.mts` from `content/story/cast-plan.json` and the house files. Do not edit by hand:');
  L.push('change the plan and run `node --experimental-strip-types scripts/story/build-casting.mts`. `scripts/story/cast-lint.mts` checks every fleet rule on the plan.');
  L.push('The contract is [personas.md](personas.md). Names, places and companion names are invented and reserved so the fleet\'s uniqueness rules hold;');
  L.push('a writer may change one if it stays unique. Rooms are the spec\'s own names (a name that repeats carries its level, `Study@l1`).', '');
  L.push('## The fleet at a glance', '');
  const byArch = new Map<string, number>(), byHousehold = new Map<string, number>(), byNarr = new Map<string, number>();
  for (const f of fams) {
    for (const a of new Set<string>(f.members.map((m: any) => m.archetype).filter(Boolean))) byArch.set(a, (byArch.get(a) || 0) + 1);
    byHousehold.set(f.household, (byHousehold.get(f.household) || 0) + 1);
    byNarr.set(f.narrator, (byNarr.get(f.narrator) || 0) + 1);
  }
  L.push(`- Families with each archetype: ${ARCHETYPES.map((a) => `${a} ${byArch.get(a) || 0}`).join(', ')}.`);
  L.push(`- Households: ${Object.keys(plan.households).map((k) => `${k} ${byHousehold.get(k) || 0}`).join(', ')}.`);
  L.push(`- Business families: ${fams.filter((f) => f.business).length} of ${fams.length}.`);
  L.push(`- Narrators: ${[...byNarr].sort((a, b) => a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(', ')}.`, '');
  L.push('## Table', '');
  L.push('| House id | Display name | Family (slug) | Members | Household | Business | Core room | Signature apps | Beat apps | Flagship |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const f of fams) {
    const h = houses.get(f.house)!;
    const mem = f.members.map((m: any) => `${m.name} ${m.age} ${m.archetype ?? 'baby'}`).join('; ');
    L.push(`| \`${f.house}\` | ${h.name} | The ${f.surname} family (\`${f.slug}\`), ${f.place} | ${mem} | ${f.household} | ${f.business ? 'yes' : 'no'} | ${f.coreRoom} | ${f.signatureApps.map((a: string) => `\`${a}\``).join(' ')} | ${Object.entries(f.beatApps ?? {}).map(([t, a]) => `${t}: \`${a}\``).join('; ')} | ${f.flagship ? 'yes' : ''} |`);
  }
  L.push('', '## Where each member lives', '');
  L.push('Signature apps are the family\'s own (the agent app first, then what each member leans on). Beat apps are one app for each required topic (home, food, iot, privacy) that the signature apps do not cover, chosen so no app passes the 40 percent cap.', '');
  L.push('Room is the spec name; "chapter" is the room role the chapter is set in; the chain is the anchor roles in preference order (last rung is a room or universal role).', '');
  L.push('| House id | Member | Archetype | Room | Chapter | Anchor chain | Sleeps in |');
  L.push('|---|---|---|---|---|---|---|');
  for (const f of fams) {
    for (const m of f.members) {
      const lab = m.roomLabel && m.roomLabel.toLowerCase() !== m.room.toLowerCase() ? ` ("${m.roomLabel}")` : '';
      L.push(`| \`${f.house}\` | ${m.name} ${m.age} | ${m.archetype ?? 'baby'} | ${m.roomKey ?? m.room}${lab} | ${m.roomRoles.length ? m.roomRoles.join(', ') : 'none'} | ${m.anchors.join(' > ')} | ${m.sleepsIn ?? 'not told'} |`);
    }
  }
  const sims: [string, string][] = [['Master Suite', 'Primary suite'], ['Master Bedroom', 'Primary bedroom'], ["Girl's Room", "the member's own name: \"Jean's room\""], ["Boy's Room", "the member's own name: \"Steve's room\""], ['Dark Bedroom', 'Second bedroom']];
  const used = sims.filter(([n]) => fams.some((f: any) => f.members.some((m: any) => m.room === n || m.sleepsIn === n)));
  if (used.length) {
    L.push('', '## Room names that need a public label', '');
    L.push('The spec keeps the builders\' own room names. These are Sims-era or gendered and are never written in public text; write the label instead (`roomLabel` where the plan gives one).', '');
    for (const [n, l] of used) L.push(`- ${n}: ${l}`);
  }
  L.push('', '## Why each home', '');
  for (const f of fams) {
    L.push(`- \`${f.house}\` (${f.slug}, ${f.household}${f.business ? ', business' : ''}): ${f.reason}${f.fitNote ? ` ${f.fitNote}` : ''}`);
  }
  L.push('');
  return L.join('\n');
}

// ---- main ----------------------------------------------------------------------------------------------------------------------------------------
function main(): void {
  const args = process.argv.slice(2);
  const b = build();
  if (b.problems.length) { console.error(b.problems.map((p) => `problem: ${p}`).join('\n')); process.exit(1); }
  const castingPath = S('casting.json'), mdPath = path.join(ROOT, 'reference', 'story', 'cast.md');
  const castingText = b.json + '\n';
  if (args.includes('--stdout')) { process.stdout.write(castingText); return; }
  if (args.includes('--check')) {
    const stale: string[] = [];
    if (!fs.existsSync(castingPath) || fs.readFileSync(castingPath, 'utf8') !== castingText) stale.push('content/story/casting.json');
    if (!fs.existsSync(mdPath) || fs.readFileSync(mdPath, 'utf8') !== b.md) stale.push('reference/story/cast.md');
    if (stale.length) { console.error(`out of date: ${stale.join(', ')}. Run: node --experimental-strip-types scripts/story/build-casting.mts`); process.exit(1); }
    console.log('casting.json and cast.md are up to date');
    return;
  }
  fs.writeFileSync(castingPath, castingText);
  fs.writeFileSync(mdPath, b.md);
  console.log(`wrote content/story/casting.json (${b.casting.families.length} families) and reference/story/cast.md`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
