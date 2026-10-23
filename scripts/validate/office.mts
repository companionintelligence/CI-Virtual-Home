// Validator plugin — the office's (reference/office/office-contract-m0.md; the rules are section 5.2 of office-build-contract.md). A spec with `use: "office"` is a building
// for a fictional company: Companion Intelligence's own piece, lit as day, with the rooms an office has, the Core in a comms room that has no window on the street, and desks that
// match the people on its floor. A spec without it is a home and is not touched: for every home this plugin returns nothing, except that a home must not carry the office's fields.
//
//   use / office / rooms[].seats    the field, the building's head count (`office.headcount`) and the people a room seats
//   [office:author]    author is Companion Intelligence (scripts/own-authors.mts), source is "original piece: CI offices"
//   [office:light]     the light is day (an ad may not show night)
//   [office:rooms]     a floor or workshop, a meeting room, a kitchen, the Core's room (server) and an entry or a reception
//   [office:names]     room names are unique, name no home room (bedroom, garage, suite, closet, lounge) and resolve to an office role (a warning when they do not)
//   [office:core]      the Core stands on a desk or a shelf in the server room, which is at least 3.6 x 3.6 m (a 3 x 3 m room gave a 31 percent occluder and a 51.5 degree finale lens)
//   [office:comms-blind] the Core's room has no window, glass or door on a perimeter wall
//   [office:meeting]   the meeting room has a table and a whiteboard, a pin board or a wall screen (the clearance round the table is the composer's, M1)
//   [office:counter]   a counter run in the kitchen or a reception desk
//   [office:seats]     with `office.headcount`: the work positions are 0.7 to 1.6 times the head count and each has 4 to 14 m2 of floor
// What waits for M1 and the first building: the 2 m clear in front of the Core (the shot QA's foreground-occluder is the real test), the clearance round the meeting table, the
// seat count of the composed floor, no final newline in the file (the homes' convention; the office tests read the file for it).
import type { Check, Issue } from './_types.mts';
import { isOwnAuthor } from '../own-authors.mts';
import { specUse } from '../lib/list-specs.mts';
import { rolesFor } from '../story/lib/kinds.mts';
import { roomRoles } from '../../assets/story/roles.js';
import { heroRoom } from '../../assets/kit-rules.js';
import { lightingName } from '../../assets/environment.js';

export const OFFICE_SOURCE = 'original piece: CI offices';
const table = rolesFor('company');
const HOME_WORD = /\b(?:bed ?room|garage|suite|closet|lounge)\b/i;
const CIRCULATION_WORD = /\b(?:hall|lobby|gallery|landing)\b/i;
/** the Core's room is at least this on both sides (12.96 m2): the finale lens and the occluder need it */
export const CORE_ROOM_MIN = 3.6;
/** the seats a building may have against the people on its floor, and the floor each seat has (m2 of the rooms where work happens) */
export const SEAT_RATIO = { min: 0.7, max: 1.6 } as const;
export const M2_PER_SEAT = { min: 4, max: 14 } as const;
const WORK_ROLES = new Set(['workfloor', 'workshop', 'office']);
const inRect = (px: number, pz: number, r: { x: number; z: number; w: number; d: number }, tol: number): boolean => px >= r.x - tol && px <= r.x + r.w + tol && pz >= r.z - tol && pz <= r.z + r.d + tol;

const check: Check = (spec, ctx) => {
  const out: Issue[] = [];
  const err = (code: string, message: string): void => { out.push({ level: 'error', code, message }); };
  const warn = (code: string, message: string): void => { out.push({ level: 'warn', code, message }); };
  if (spec.use !== undefined && spec.use !== 'home' && spec.use !== 'office') { err('use', `use ${JSON.stringify(spec.use)} ("home" | "office")`); return out; }
  const rooms: { lv: any; room: any }[] = (spec.levels || []).flatMap((lv: any) => (lv.rooms || []).map((room: any) => ({ lv, room })));
  if (specUse(spec) !== 'office') {
    // a home carries none of the office's fields
    if (spec.office !== undefined) err('fields', 'office is a field of a building with use: "office"');
    for (const { room } of rooms) if (room.seats !== undefined) err('fields', `room "${room.name}": seats is a field of a building with use: "office"`);
    return out;
  }

  // ---- the fields
  const o = spec.office;
  if (o !== undefined) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) err('fields', 'office must be { headcount?, company? }');
    else {
      if (o.headcount !== undefined && !(Number.isInteger(o.headcount) && o.headcount >= 1 && o.headcount <= 60)) err('fields', `office.headcount ${JSON.stringify(o.headcount)} (the people on the floor, 1 to 60)`);
      if (o.company !== undefined && !(typeof o.company === 'string' && /^[a-z]+(-[a-z]+){0,2}$/.test(o.company))) err('fields', `office.company ${JSON.stringify(o.company)} (a company slug: lower case words joined by hyphens)`);
    }
  }
  for (const { room } of rooms) if (room.seats !== undefined && !(Number.isInteger(room.seats) && room.seats >= 0)) err('fields', `room "${room.name}": seats ${JSON.stringify(room.seats)} (a whole number of people, 0 or more)`);

  // ---- author, source, light
  if (!isOwnAuthor(spec.author)) err('author', `author ${JSON.stringify(spec.author)}: an office is Companion Intelligence's own piece (scripts/own-authors.mts), with no builder to credit`);
  if (spec.source !== OFFICE_SOURCE) err('author', `source ${JSON.stringify(spec.source)} (an office's source is "${OFFICE_SOURCE}")`);
  if (lightingName(spec.lighting) !== 'day') err('light', `lighting is ${JSON.stringify(spec.lighting)}: an office is lit as day (an ad may not show night)`);

  // ---- room names, and what each one is
  const names = rooms.map((r) => String(r.room.name ?? ''));
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n.toLowerCase())) err('names', `two rooms are called "${n}"`);
    seen.add(n.toLowerCase());
    if (HOME_WORD.test(n)) err('names', `room "${n}" is named like a room of a home (bedroom, garage, suite, closet, lounge); an office has no such room`);
    else if (CIRCULATION_WORD.test(n) && !(roomRoles(n, table) as string[]).some((r) => r === 'entry' || r === 'reception')) warn('names', `room "${n}" reads as a hall or a lobby: the role table takes it for circulation (an Entry Lobby is the entry, and is fine)`);
    if (!roomRoles(n, table).length) warn('names', `room "${n}" resolves to no office role (content/story/roles-office.json): no story can be told in it`);
  }
  const rolesOf = (name: string): string[] => roomRoles(String(name ?? ''), table) as string[];
  const withRole = (role: string): { lv: any; room: any }[] => rooms.filter((r) => rolesOf(r.room.name).includes(role));
  for (const [what, ok] of [
    ['a floor where the work happens (a "workfloor" or "workshop" room: Open Office, Studio Floor, Workshop)', withRole('workfloor').length + withRole('workshop').length > 0],
    ['a meeting room', withRole('meeting').length > 0],
    ['a kitchen (Kitchenette, Break Room)', withRole('kitchen').length > 0],
    ['the Core\'s room (a "server" room: Comms Room, Back Room, Back Office)', withRole('server').length > 0],
    ['an entry or a reception', withRole('entry').length + withRole('reception').length > 0],
  ] as const) if (!ok) err('rooms', `the building has no ${what}`);

  // ---- the Core: in the server room, on a desk or a shelf, in a room big enough for the finale, with no window on the street
  const hr = heroRoom(spec);
  if (!hr) err('core', 'the hero (the Core) stands in no room of its level');
  else {
    const b = hr.room.bounds;
    if (!rolesOf(hr.room.name).includes('server')) err('core', `the Core stands in "${hr.room.name}", which is not the server room (Comms Room, Back Room, Back Office)`);
    if (b && (b.w < CORE_ROOM_MIN - 1e-6 || b.d < CORE_ROOM_MIN - 1e-6)) err('core', `the Core's room "${hr.room.name}" is ${b.w} x ${b.d} m; it is at least ${CORE_ROOM_MIN} x ${CORE_ROOM_MIN} m on both sides (a 3 x 3 m room gave a 31 percent occluder and a 51.5 degree finale lens)`);
    if (!['desk', 'shelf'].includes(spec.hero.surface)) err('core', `the Core stands on hero.surface ${JSON.stringify(spec.hero.surface ?? null)}; in an office it stands on a desk or a shelf`);
    if (b) for (const op of hr.lv.openings || []) {
      const horiz = op.side === 'S' || op.side === 'N';
      const e = ctx.perimeterEdges(hr.lv.footprint).find((x: any) => x.side === op.side && (horiz ? (op.at >= x.a[0] - 1e-6 && op.at <= x.b[0] + 1e-6) : (op.at >= x.a[1] - 1e-6 && op.at <= x.b[1] + 1e-6)));
      if (!e) continue;
      const px = horiz ? op.at : e.a[0], pz = horiz ? e.a[1] : op.at;
      if (inRect(px, pz, b, 0.1)) err('comms-blind', `the Core's room "${hr.room.name}" has a ${op.type} on the ${op.side} wall: its perimeter walls have no opening (a window put the racks in view from the street)`);
    }
  }

  // ---- the meeting room and the counter
  const itemsOf = (r: { room: any }): string[] => (r.room.items || []).map((i: any) => String(i.type));
  const MEETING_TABLES = table.items['meeting-table'] || [], BOARDS = [...(table.items['whiteboard'] || []), 'wall-tv', 'wall-screen'];
  for (const m of withRole('meeting')) {
    const types = itemsOf(m);
    if (!types.some((t) => MEETING_TABLES.includes(t))) err('meeting', `meeting room "${m.room.name}" has no table (${MEETING_TABLES.join(', ')})`);
    if (!types.some((t) => BOARDS.includes(t))) err('meeting', `meeting room "${m.room.name}" has no whiteboard, pin board or wall screen`);
  }
  const COUNTERS = table.items['counter'] || [], DESKS = table.items['reception-desk'] || [];
  if (!rooms.some((r) => (rolesOf(r.room.name).includes('kitchen') && itemsOf(r).some((t) => COUNTERS.includes(t))) || (rolesOf(r.room.name).includes('reception') && itemsOf(r).some((t) => DESKS.includes(t))))) err('counter', 'no counter run in the kitchen and no reception desk at reception');

  // ---- seats: the desks and benches against the people on the floor
  if (o && typeof o === 'object' && Number.isInteger(o.headcount)) {
    const work = rooms.filter((r) => rolesOf(r.room.name).some((x) => WORK_ROLES.has(x)));
    const WORKSTATIONS = table.items['workstation'].filter((t) => !['dual-monitor-arm', 'curved-monitor', 'laptop'].includes(t));
    const declared = work.reduce((n, r) => n + (Number.isInteger(r.room.seats) ? r.room.seats : 0), 0);
    const counted = work.reduce((n, r) => n + itemsOf(r).reduce((k, t) => k + (WORKSTATIONS.includes(t) ? 1 : t === 'workbench' ? 2 : 0), 0), 0);
    const seats = declared || counted;
    const area = work.reduce((a, r) => a + (r.room.bounds ? r.room.bounds.w * r.room.bounds.d : 0), 0);
    if (seats < o.headcount * SEAT_RATIO.min || seats > o.headcount * SEAT_RATIO.max) err('seats', `${seats} work positions for ${o.headcount} people on the floor (${SEAT_RATIO.min} to ${SEAT_RATIO.max} times the head count)`);
    else if (seats && (area / seats < M2_PER_SEAT.min || area / seats > M2_PER_SEAT.max)) err('seats', `${(area / seats).toFixed(1)} m2 of work rooms for each of ${seats} seats (${M2_PER_SEAT.min} to ${M2_PER_SEAT.max})`);
  } else warn('seats', 'no office.headcount: the desks are not held to the people on the floor');
  return out;
};
export default check;
