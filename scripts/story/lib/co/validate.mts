// One company file against the rules that need no building: the schema, the size band, the people, the one Core and its owner, the names, the rooms, the chapters, the
// categories, the pairs the store names, the apps, and the claims' banned phrases over every string. The rule ids are the contract's (reference/office/office-build-contract.md
// section 7.2). What waits for M1, with the buildings and the writers: co-anchor resolution in a real building, co-functions, co-text-role, co-app-facts, co-day, co-office,
// co-bring-home, the shape rules of the shared modules, and the fleet gates (reference/office/office-contract-m0.md).
import fs from 'node:fs';
import path from 'node:path';
import { Report } from '../report.mts';
import { checkSchema } from '../schema-lite.mts';
import { plain } from '../text.mts';
import { serviceOk } from '../pairs.mts';
import type { CoCtx } from './context.mts';
import { FLOOR_MAX, HOME_ONLY_ROOM_ROLES, OFFICE_ROOM_ROLES, SIZE_BANDS } from './consts.mts';
import { companyStrings } from './strings.mts';
import type { CompanyStory, CoAnchorLeaf } from './types.mts';

/** the pairs the plan holds back (content/story/lander.json `hold`: "service|app"): counsel has not cleared them */
function heldPairs(root: string): Set<string> {
  try { return new Set(JSON.parse(fs.readFileSync(path.join(root, 'content', 'story', 'lander.json'), 'utf8')).hold as string[]); } catch { return new Set(); }
}
const lower = (s: string): string => s.toLowerCase();
const wordsOf = (s: string): string => ` ${lower(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const roomOk = (r: string | undefined): boolean => !r || ((OFFICE_ROOM_ROLES as readonly string[]).includes(r) && !(HOME_ONLY_ROOM_ROLES as readonly string[]).includes(r));

export function validateCompany(data: unknown, ctx: CoCtx): Report {
  const slug = typeof (data as { slug?: unknown } | null)?.slug === 'string' ? (data as { slug: string }).slug : '(no slug)';
  const out = new Report(slug, ctx.reviewed);
  for (const m of checkSchema(data, ctx.schema)) out.E('schema', '', m);
  if (out.errors.length) return out;                       // every other rule assumes the shape
  const s = data as CompanyStory;
  const c = s.company;
  const byId = new Map(s.members.map((m) => [m.id, m]));
  const chapterOf = new Map(s.chapters.map((ch) => [ch.id, ch]));
  const owner = s.members.find((m) => m.ownsCore);
  const first = s.chapters[0], last = s.chapters[s.chapters.length - 1];
  const roomBeats = s.beats.filter((b) => b.chapter !== first.id && b.chapter !== last.id);

  // ---- co-size: the bands of the plan (startup 3 to 12, small 10 to 30, medium 50 to 250 told as a site or a department), and a floor of at most 25
  const band = SIZE_BANDS[c.size];
  if (c.headcount < band.headcount[0] || c.headcount > band.headcount[1]) out.E('co-size', 'company.headcount', `a ${c.size} company is told for ${band.headcount[0]} to ${band.headcount[1]} people, not ${c.headcount}`, 'Choose the size that fits the head count, or the head count that fits the size.');
  if (!band.scopes.includes(c.scope)) out.E('co-size', 'company.scope', `a ${c.size} business is told as ${band.scopes.join(' or ')}, not as "${c.scope}"`, c.size === 'medium' ? 'A medium business is one site or one department of a larger firm, never "the company".' : 'A startup or a small business is told as the company.');
  if (c.floor > FLOOR_MAX) out.E('co-size', 'company.floor', `a floor of ${c.floor} is over ${FLOOR_MAX}, the most a story is told in (owner decision O3)`, 'Tell one site or one department.');
  if (c.floor > c.headcount) out.E('co-size', 'company.floor', `the floor (${c.floor}) is larger than the head count (${c.headcount})`);
  if (s.members.length > c.floor) out.E('co-size', 'members', `${s.members.length} featured people on a floor of ${c.floor}`);

  // ---- co-members: unique, each with work to show, the first run the owner's, every reference real
  const seenId = new Set<string>(), seenName = new Set<string>();
  for (const m of s.members) {
    if (seenId.has(m.id)) out.E('co-members', `member ${m.id}`, `two members have the id "${m.id}"`);
    seenId.add(m.id);
    if (seenName.has(lower(m.name))) out.E('co-members', `member ${m.id}.name`, `two members are called ${m.name}`);
    seenName.add(lower(m.name));
    if (!ctx.functions.some((f) => f.id === m.function)) out.E('co-members', `member ${m.id}.function`, `"${m.function}" is not one of content/story/functions.json`);
    const n = s.beats.filter((b) => b.member === m.id).length;
    if (n < 3) out.E('co-members', `member ${m.id}`, `${m.name} has ${n} beat${n === 1 ? '' : 's'} (a person on the page has at least 3)`, 'Give the person their own beats, or leave them out of the cast.');
  }
  const colours = new Map<string, string[]>();
  for (const m of s.members) colours.set(m.colour, [...(colours.get(m.colour) ?? []), m.id]);
  for (const [col, ids] of colours) if (ids.length > 1 && s.members.length <= 5) out.W('co-members', `member ${ids[1]}.colour`, `${ids.join(' and ')} share ${col}; the monogram discs should differ where they can`);
  const seenBeat = new Set<string>();
  for (const b of s.beats) {
    if (seenBeat.has(b.id)) out.E('co-chapters', b.id, `two beats have the id "${b.id}"`);
    seenBeat.add(b.id);
    if (!chapterOf.has(b.chapter)) out.E('co-chapters', b.id, `the beat is in chapter "${b.chapter}", which the file does not have`);
    for (const k of ['member', 'agent', 'approval'] as const) if (b[k] && !byId.has(b[k]!)) out.E('co-members', `${b.id}.${k}`, `${k} "${b[k]}" is not a member of this company`);
  }
  for (const b of s.beats) if (chapterOf.get(b.chapter)?.kind === 'ftue' && b.member && owner && b.member !== owner.id) out.E('co-members', b.id, `a first-run beat is the Core owner's (${owner.id}), not ${b.member}'s`, 'The person who owns the Core does the first run; leave `member` off for the whole company.');

  // ---- co-owner: exactly one person owns the Core, and has work in the Core's room, the office or the floor
  const owners = s.members.filter((m) => m.ownsCore);
  if (owners.length !== 1) out.E('co-owner', 'members', `${owners.length} members own the Core (exactly one does)`, 'Set ownsCore on the one person who looks after the Core and installs the apps.');
  else {
    const where = new Set(['server', 'office', 'workfloor']);
    if (!s.beats.some((b) => (b.member === owners[0].id || b.agent === owners[0].id) && where.has(chapterOf.get(b.chapter)?.room ?? ''))) out.E('co-owner', `member ${owners[0].id}`, `the owner of the Core has no beat in the Core's room, the office or the floor`);
  }

  // ---- co-companions: one companion, on the owner; an agent prepares, a person approves; at most six scripted lines
  const withCompanion = s.members.filter((m) => m.companion);
  if (withCompanion.length !== 1) out.E('co-companions', 'members', `${withCompanion.length} members have a companion (exactly one does: the company has one companion)`);
  else if (owner && withCompanion[0].id !== owner.id) out.E('co-companions', `member ${withCompanion[0].id}`, `the companion belongs to ${withCompanion[0].id}, who does not own the Core (${owner.id} does)`, 'The agent belongs to the person who owns the Core and approves its work.');
  for (const b of s.beats) {
    if (b.agent && !b.approval) out.E('co-companions', b.id, 'a beat with an agent has no approval: an agent prepares, a person approves');
    if (b.agent && !byId.get(b.agent)?.companion) out.E('co-companions', `${b.id}.agent`, `${b.agent} has no companion to act`);
    if (b.say && !byId.get(b.say.speaker)?.companion) out.E('co-companions', `${b.id}.say`, `${b.say.speaker} has no companion to speak`);
  }
  const says = s.beats.filter((b) => b.say).length;
  if (says > 6) out.E('co-companions', 'beats', `${says} beats have a scripted line (at most 6)`);

  // ---- co-names: not a stock name, not a service, not a family; one slug namespace; no companion name a family uses
  const nm = wordsOf(c.name);
  for (const d of ctx.names.deny) if (nm.includes(wordsOf(d))) out.E('co-names', 'company.name', `"${c.name}" contains "${d}", the name of a stock example company (content/story/company-names.json)`);
  for (const [n, sv] of ctx.services.byName) if (n.length >= 4 && nm.includes(wordsOf(n))) out.E('co-names', 'company.name', `"${c.name}" contains "${n}", the name of ${sv.name} (a service the store pairs an app with)`);
  if (ctx.familySurnames.has(lower(c.name))) out.E('co-names', 'company.name', `"${c.name}" is a family's surname`);
  if (ctx.familySlugs.has(s.slug)) out.E('co-names', 'slug', `the slug "${s.slug}" is a family's (one slug namespace: family/<slug> and company/<slug>)`);
  if (ctx.houseIds.has(s.slug)) out.E('co-names', 'slug', `the slug "${s.slug}" is a house id`);
  for (const m of s.members) if (m.companion && ctx.familyCompanions.has(lower(m.companion.name))) out.E('co-names', `member ${m.id}.companion.name`, `${m.companion.name} is a family's companion; the names are unique across the site`);

  // ---- co-rooms and co-anchor: an office room, never a home's; a chain that ends in a role that every office has
  const universal = new Set(ctx.roles.universal);
  for (const ch of s.chapters) if (!roomOk(ch.room)) out.E('co-rooms', `chapter ${ch.id}`, `room "${ch.room}" is not an office room (${HOME_ONLY_ROOM_ROLES.join(', ')} are a home's)`);
  for (const b of s.beats) {
    const chain: CoAnchorLeaf[] = [b.anchor, ...(b.anchor.fallback ?? [])];
    for (const leaf of chain) if (!roomOk(leaf.room)) out.E('co-rooms', `${b.id}.anchor`, `anchor room "${leaf.room}" is not an office room`);
    if (!universal.has(chain[chain.length - 1].role)) out.E('co-anchor', `${b.id}.anchor`, `the chain ends in "${chain[chain.length - 1].role}", which not every office has (${[...universal].join(', ')} do)`, 'End the fallback chain with { role: "room", room } or "core".');
  }

  // ---- co-chapters: the first run first, the outro last, at least five rooms including the floor (or the workshop), a meeting room and the kitchen
  if (first.kind !== 'ftue') out.E('co-chapters', `chapter ${first.id}`, 'the first chapter is the first run (kind "ftue")');
  if (last.kind !== 'outro') out.E('co-chapters', `chapter ${last.id}`, 'the last chapter is the outro (kind "outro")');
  const seenCh = new Set<string>();
  for (const ch of s.chapters) {
    if (seenCh.has(ch.id)) out.E('co-chapters', `chapter ${ch.id}`, `two chapters have the id "${ch.id}"`);
    seenCh.add(ch.id);
    if ((ch.kind === 'room' || ch.kind === 'outside') && !ch.room) out.E('co-chapters', `chapter ${ch.id}`, `a ${ch.kind} chapter names its room`);
    if (!s.beats.some((b) => b.chapter === ch.id)) out.W('co-chapters', `chapter ${ch.id}`, 'the chapter has no beat');
  }
  const roomRoles = new Set(s.chapters.filter((ch) => ch.kind === 'room').map((ch) => ch.room));
  const nRooms = s.chapters.filter((ch) => ch.kind === 'room').length;
  if (nRooms < 5) out.E('co-chapters', 'chapters', `${nRooms} room chapters (at least 5)`);
  if (!(roomRoles.has('workfloor') || roomRoles.has('workshop'))) out.E('co-chapters', 'chapters', 'no chapter on the floor where the work happens (room "workfloor" or "workshop")');
  if (!roomRoles.has('meeting')) out.E('co-chapters', 'chapters', 'no chapter in the meeting room');
  if (!roomRoles.has('kitchen')) out.E('co-chapters', 'chapters', 'no chapter in the kitchen');

  // ---- co-beats: enough to tell, a meeting table or a whiteboard, the Core's own place, two in the kitchen
  if (roomBeats.length < 18 || roomBeats.length > 34) out.E('co-beats', 'beats', `${roomBeats.length} room beats (18 to 34)`);
  const anchoredOn = (roles: string[]): boolean => s.beats.some((b) => roles.includes(b.anchor.role));
  if (!anchoredOn(['meeting-table', 'whiteboard'])) out.E('co-beats', 'beats', 'no beat is anchored on the meeting table or the whiteboard');
  if (owner && !s.beats.some((b) => (b.member === owner.id || b.agent === owner.id) && (b.anchor.role === 'server-rack' || chapterOf.get(b.chapter)?.room === 'server'))) out.E('co-beats', 'beats', 'the Core owner has no beat on the server rack or in the Core\'s room');
  if (s.beats.filter((b) => chapterOf.get(b.chapter)?.room === 'kitchen').length < 2) out.E('co-beats', 'beats', 'fewer than two beats in the kitchen');

  // ---- co-categories
  const cats = new Set(s.beats.map((b) => b.category));
  const must = ['setup', 'documents', 'communication', 'money', 'it'].filter((k) => !cats.has(k));
  if (must.length) out.E('co-categories', 'beats', `every company covers setup, documents, communication, money and it; missing: ${must.join(', ')}`);
  if (cats.size < 8) out.E('co-categories', 'beats', `${cats.size} of the 11 topics (at least 8)`);

  // ---- co-apps and co-pairs: an app of the store, a pair the store names ("<app>, alternative to <service>"), never a pair the plan holds back (owner decision O7)
  const held = heldPairs(ctx.root);
  for (const b of s.beats) {
    for (const id of [...(b.app ? [b.app.id] : []), ...(b.with ?? [])]) {
      const app = ctx.apps.get(id);
      if (!app) out.E('co-apps', b.id, `"${id}" is not an app of the catalog (content/story/catalog-apps.json)`);
      else if (app.storySafe === 'avoid') out.E('co-apps', b.id, `${app.name} is an app the catalog marks avoid`);
    }
    const replaces = b.app?.replaces ?? [];
    if (!b.service) {
      if (replaces.length) out.E('co-pairs', b.id, `app.replaces names ${replaces[0]} and the beat has no service`, 'Set "service" to the registry id of the service (content/story/services.json), or empty app.replaces.');
      continue;
    }
    const sv = ctx.services.byId.get(b.service);
    if (!sv) { out.E('co-pairs', b.id, `service "${b.service}" is not in content/story/services.json`); continue; }
    if (!b.app) { out.E('co-pairs', b.id, 'the beat has a service and no app: a pair is an app and the service it is the alternative to'); continue; }
    if (!replaces.length) out.E('co-pairs', b.id, 'the beat has a service and app.replaces is empty');
    else if (ctx.services.byName.get(lower(replaces[0]))?.id !== sv.id) out.E('co-pairs', b.id, `app.replaces[0] is "${replaces[0]}", which is not the name or an alias of ${sv.name}`, `Write "${sv.name}" first.`);
    if (!serviceOk(sv)) out.E('co-pairs', b.id, `${sv.name} is a service the registry will not let a story name (flags: ${sv.flags.join(', ') || 'none'}; alternative-to form ${sv.alternativeToForm}; story status ${sv.storyStatus})`);
    if (!sv.apps.includes(b.app.id)) out.E('co-pairs', b.id, `the store does not pair ${b.app.id} with ${sv.name} (its own replaces rows are the only pairs a story may print)`, 'A pair is one the store names; do not invent one.');
    if (held.has(`${sv.id}|${b.app.id}`)) out.E('co-pairs', b.id, `${b.app.id} with ${sv.name} is on the plan's hold list (content/story/lander.json): counsel has not cleared it`, 'Choose another pair, or leave the beat without one.');
    const chips = b.popup.chips ?? [];
    if (chips.length !== 2 || chips[1] !== `alternative to ${sv.name}`) out.E('co-pairs', `${b.id}.chips`, `the chips of a beat with a pair are the app's name and "alternative to ${sv.name}"`, 'Never "replaces".');
  }

  // ---- the claims' banned phrases (and the site lint's extra ones) over every string a visitor reads
  for (const [at, raw] of companyStrings(s)) {
    const t = plain(raw);
    for (const b of ctx.bans) {
      if (!b.re.test(t)) continue;
      const shown = t.length > 70 ? `${t.slice(0, 70)}...` : t;
      out.add(b.severity, b.id, at, `"${shown}" ${b.why}`, b.fix);
    }
  }
  out.stats.beats = s.beats.length;
  for (const k of out.unusedReviewed()) out.W('reviewed', k, 'this allow-list entry matched no finding; remove it from content/story/reviewed.json');
  return out;
}
