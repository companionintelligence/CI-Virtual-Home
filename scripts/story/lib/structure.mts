// Structure rules: casting agreement, members and companions, chapters and beat order, the FTUE chapter, agents and
// approvals, `say` lines, the disclosure strings, voices. STORY-BIBLE sections 5, 7, 8 and 9.
import { FIRST_PARTY, HERMES_NOTE, INTERNET_NOTE, OPENCLAW_WEB_NOTE, type Beat, type Member, type Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { detailStrings, plain } from './text.mts';
import { CHAT_MIN_AGE, v3Severity } from './v3.mts';

/** Room beats = every beat outside the ftue and the outro chapter. Story v2 widened this from 15 to 24. */
export const ROOM_BEATS = { min: 15, max: 34 } as const;
export const FTUE_IDS = ['ftue-delivery', 'ftue-unbox', 'ftue-plug-in', 'ftue-join', 'ftue-pick', 'ftue-hello'] as const;
const FTUE_REQUIRED = FTUE_IDS.filter((id) => id !== 'ftue-unbox');

/** All text a beat shows or says, for the rules that read prose. */
export const beatText = (b: Beat): string => [b.popup.title, b.popup.body, ...(b.popup.chips || []), b.popup.note || '', b.popup.phone?.header || '', ...(b.popup.phone?.rows || []), b.say?.text || '', ...detailStrings(b)].map(plain).join(' ');
const prose = (b: Beat): string => plain(`${b.popup.title} ${b.popup.body} ${b.popup.phone ? b.popup.phone.rows.join(' ') : ''}`);

export function checkCasting(story: Story, ctx: Ctx, out: Report): void {
  const cast = ctx.castBySlug.get(story.slug);
  if (!cast) { out.E('casting', 'slug', `slug ${story.slug} is not in content/story/casting.json`, 'The slug is the public URL and is fixed by the casting.'); return; }
  if (cast.house !== story.house) out.E('casting', 'house', `${story.slug} belongs to house ${cast.house}`);
  if (cast.household !== story.family.household) out.E('casting', 'household', `casting says ${cast.household}`);
  if (cast.business !== story.family.business) out.E('casting', 'business', `casting says ${cast.business}`);
  if (cast.narrator !== story.family.narrator) out.E('casting', 'narrator', `casting says ${cast.narrator}`);

  // The re-cast fixes who lives where (content/story/cast-plan.json): the surname, the place, and each member's id, name, age, role, archetype and
  // companion's name. A family file tells these people and no others. (The older casting listed members without ids: nothing to compare then.)
  if (cast.surname && cast.surname !== story.family.surname) out.E('casting', 'surname', `casting says the family is ${cast.surname}`);
  if (cast.place && cast.place !== story.family.address.place) out.E('casting', 'place', `casting says the address is in ${cast.place}`);
  const cm = (cast.members ?? []).filter((c) => c.id);
  if (cm.length) {
    const byId = new Map(story.members.map((m) => [m.id, m]));
    for (const c of cm) {
      const m = byId.get(c.id!);
      const at = `member.${c.id}`;
      if (!m) { out.E('casting', at, `casting has ${c.name} (${c.id}) in this home and the story does not`, 'Tell every member the casting lists, with the same id.'); continue; }
      if (m.name !== c.name) out.E('casting', at, `casting calls ${c.id} ${c.name}, the story ${m.name}`);
      if (m.age !== Number(c.age)) out.E('casting', at, `casting says ${c.name} is ${c.age}, the story ${m.age}`);
      if (m.role !== c.role) out.E('casting', at, `casting says ${c.name} is a ${c.role}, the story ${m.role}`);
      if (c.archetype !== undefined && (m.archetype ?? null) !== c.archetype) out.E('casting', at, `casting makes ${c.name} ${c.archetype ? `the ${c.archetype}` : 'nobody in particular'}, the story ${m.archetype ? `the ${m.archetype}` : 'no archetype'}`, 'The archetype is set by the cast plan (reference/story/personas.md).');
      if ((m.companion?.name ?? null) !== (c.companion ?? null)) out.E('casting', at, `casting gives ${c.name} ${c.companion ? `the companion ${c.companion}` : 'no companion'}, the story ${m.companion ? m.companion.name : 'none'}`);
    }
    for (const m of story.members) if (!cm.some((c) => c.id === m.id)) out.E('casting', `member.${m.id}`, `${m.name} (${m.id}) is not in the casting for this home`, 'Add the person to content/story/cast-plan.json (and run story:cast), or take them out of the story.');
  }
  // The plan counts on its signature apps (fleet metrics are built from them): a story that leaves one out is told so.
  if (cast.signatureApps?.length) {
    const used = new Set<string>(story.beats.flatMap((b) => [...(b.app ? [b.app.id] : []), ...(b.with ?? [])]));
    const left = cast.signatureApps.filter((id) => !used.has(id));
    if (left.length) out.W('casting-apps', 'apps', `the casting plans ${left.join(', ')} for this home and no beat uses ${left.length === 1 ? 'it' : 'them'}`, 'Use the app in a beat, or change the plan (content/story/cast-plan.json) and run story:cast.');
  }
}

export function checkMembers(story: Story, ctx: Ctx, out: Report): Map<string, Member> {
  const members = new Map<string, Member>();
  for (const m of story.members) { if (members.has(m.id)) out.E('members', m.id, 'duplicate member id'); members.set(m.id, m); }
  const names = story.members.map((m) => m.name);
  if (new Set(names).size !== names.length) out.E('members', 'name', 'member names are distinct within a family');

  const comps = story.members.filter((m) => m.companion);
  if (comps.length < 1 || comps.length > 3) out.E('members', 'companions', `${comps.length} companions (1 to 3)`);
  for (const m of comps) {
    if (['baby', 'child', 'visitor'].includes(m.role)) out.E('members', m.id, 'children, babies and visitors have no companion');
    // age rule 16 (owner decision 2026-10-19): replaces the under-13 test; an error in a v3 family, a warning in every other
    if (m.age < CHAT_MIN_AGE) out.add(v3Severity(story), 'age-companion', m.id, `${m.name} is ${m.age} and has a companion (an agent companion needs age ${CHAT_MIN_AGE} or older)`, `Take the companion from ${m.name} (and from the cast plan), or give it to a member of ${CHAT_MIN_AGE} or older.`);
  }
  const compNames = comps.map((m) => m.companion!.name);
  if (new Set(compNames).size !== compNames.length) out.E('members', 'companions', 'companion names are distinct within a family');
  if (story.members.some((m) => m.age < 13) && !story.beats.some((b) => b.category === 'kids')) out.E('categories', 'kids', 'a household with children needs a kids beat');

  // voices: the narrator and every companion speak with different registry keys, and every key is ready to record
  const narrator = story.family.narrator;
  const used = new Set<string>([narrator]);
  for (const m of comps) {
    const v = m.companion!.voice;
    if (used.has(v)) out.E('voices', m.id, `companion voice ${v} repeats the narrator or another companion`, 'Pick a voice key no one else in the family uses.');
    used.add(v);
  }
  for (const key of used) {
    const entry = ctx.voices.voices[key];
    if (!entry) out.E('voices', key, `voice ${key} is not in content/story/voices.json`);
    else if (entry.status !== 'ready') out.E('voices', key, `voice ${key} has status ${entry.status}; it cannot be recorded yet`);
  }
  return members;
}

export function checkChapters(story: Story, ctx: Ctx, out: Report): void {
  const cs = story.chapters;
  const ids = new Set<string>();
  for (const c of cs) { if (ids.has(c.id)) out.E('chapters', c.id, 'duplicate chapter id'); ids.add(c.id); }
  if (cs[0].kind !== 'ftue') out.E('chapters', 'first', 'the first chapter must be the ftue');
  if (cs[cs.length - 1].kind !== 'outro') out.E('chapters', 'last', 'the last chapter must be the outro');
  if (cs.filter((c) => c.kind === 'ftue').length !== 1 || cs.filter((c) => c.kind === 'outro').length !== 1) out.E('chapters', 'kinds', 'exactly one ftue chapter and one outro chapter');
  cs.forEach((c) => { if ((c.kind === 'room' || c.kind === 'outside') && !c.room) out.E('chapters', c.id, 'room and outside chapters need `room`'); });
  for (const need of ['living', 'kitchen', 'garden']) if (!cs.some((c) => c.room === need)) out.E('chapters', need, `a ${need} chapter is required`);
  if (cs.filter((c) => c.kind === 'room' && !['living', 'kitchen'].includes(c.room!)).length < 2) out.E('chapters', 'rooms', 'at least two further room chapters (office, kids, bedroom, garage, dining, entry, laundry)');

  const facts = ctx.house(story.house);
  if (facts?.rooms) for (const c of cs) if (c.room && !facts.rooms.has(c.room)) out.W('chapters', c.id, `the house has no ${c.room} room (see casting rooms)`, 'Choose a room the house has, or keep the chapter and anchor its beats on a universal role.');

  // beats follow chapter order; every beat names a chapter
  let last = -1;
  for (const b of story.beats) {
    const i = cs.findIndex((c) => c.id === b.chapter);
    if (i < 0) out.E('beats', b.id, `unknown chapter ${b.chapter}`);
    else { if (i < last) out.E('order', b.id, 'beats must follow chapter order'); last = Math.max(last, i); }
  }
  const seen = new Set<string>();
  for (const b of story.beats) { if (seen.has(b.id)) out.E('beats', b.id, 'duplicate beat id'); seen.add(b.id); }
  for (const c of cs) if (!story.beats.some((b) => b.chapter === c.id)) out.E('beats', c.id, `chapter ${c.id} has no beat`);

  const outro = story.beats.filter((b) => b.chapter === cs[cs.length - 1].id);
  if (outro.length !== 1) out.E('beats', 'outro', `the outro chapter has ${outro.length} beats (exactly 1)`);
  const roomBeats = story.beats.filter((b) => b.chapter !== cs[0].id && b.chapter !== cs[cs.length - 1].id).length;
  if (roomBeats < ROOM_BEATS.min || roomBeats > ROOM_BEATS.max) out.E('beats', 'rooms', `${roomBeats} room beats (${ROOM_BEATS.min} to ${ROOM_BEATS.max})`);
}

export function checkFtue(story: Story, _ctx: Ctx, out: Report): void {
  const cs = story.chapters;
  const ftue = story.beats.filter((b) => b.chapter === cs[0].id);
  if (ftue.length < 5 || ftue.length > 6) out.E('ftue', 'count', `the ftue chapter has ${ftue.length} beats (5 or 6)`);
  const have = new Set(ftue.map((b) => b.id));
  for (const need of FTUE_REQUIRED) if (!have.has(need)) out.E('ftue', need, 'required beat id missing');
  for (const b of ftue) if (!(FTUE_IDS as readonly string[]).includes(b.id)) out.E('ftue', b.id, `unknown ftue beat id; the ids are ${FTUE_IDS.join(', ')}`);
  const wanted = FTUE_IDS.filter((x) => have.has(x));
  if (wanted.join() !== ftue.map((b) => b.id).join()) out.E('ftue', 'order', `ftue order must be ${wanted.join(' > ')}`);
  const fb = (id: string): Beat | undefined => ftue.find((b) => b.id === id);

  const plug = fb('ftue-plug-in');
  if (plug && !plug.emphasis?.wake) out.E('ftue', 'ftue-plug-in', 'emphasis.wake must be true');
  const pick = fb('ftue-pick');
  if (pick && pick.popup.note !== INTERNET_NOTE) out.E('disclosure', 'ftue-pick', `note must be "${INTERNET_NOTE}"`);
  for (const id of ['ftue-join', 'ftue-pick']) { const b = fb(id); if (b && b.popup.kind !== 'phone') out.E('ftue', id, 'popup.kind must be phone'); }
  const hello = fb('ftue-hello');
  if (hello && !hello.say) out.E('ftue', 'ftue-hello', 'the first agent greeting needs a `say` line');

  for (const b of story.beats) {
    if (b.popup.kind === 'phone' && b.chapter !== cs[0].id) out.E('ftue', b.id, 'phone popups belong to the ftue chapter');
    if (b.emphasis?.wake && b.id !== 'ftue-plug-in') out.E('ftue', b.id, 'only ftue-plug-in wakes the Core');
  }
  // anchors the bible fixes (section 7); a deviation is reported, not fatal: the bake step has the last word on poses
  for (const id of ['ftue-unbox', 'ftue-plug-in', 'ftue-join', 'ftue-pick', 'ftue-hello']) { const b = fb(id); if (b && b.anchor.role !== 'core') out.W('ftue', id, `anchor is ${b.anchor.role}; the ftue beats from unboxing on are anchored on the core`); }
  const del = fb('ftue-delivery');
  if (del && !['front-door', 'street'].includes(del.anchor.role)) out.W('ftue', 'ftue-delivery', `anchor is ${del.anchor.role}; the delivery is anchored on the front door, falling back to the street`);

  // ftue-claims: no SSID, pairing code, QR, account step or offline claim (the sheet and the owner's flow disagree; section 15, item 1)
  const text = ftue.map(prose).join(' ').replace(/Enter its password/g, '');
  const hit = text.match(/\b(SSID|password is|pairing code|QR|Companion-Setup|activation|accounts?|sign up|offline|no internet)\b/i);
  if (hit) out.E('ftue-claims', 'ftue', `the ftue text must not show an SSID, pairing code, QR, account step or an offline claim (found "${hit[0]}")`, 'Show the steps, not the secrets: join the Core\'s own network, choose the home network, enter its password.');
}

export function checkAgents(story: Story, ctx: Ctx, out: Report, members: Map<string, Member>): void {
  let sayCount = 0;
  let firstHermes: Beat | null = null;
  for (const b of story.beats) {
    for (const k of ['member', 'agent', 'approval'] as const) if (b[k] && !members.has(b[k]!)) out.E('refs', b.id, `${k} ${b[k]} is not a member`);
    if (b.agent) {
      const m = members.get(b.agent);
      if (!m?.companion) out.E('agent', b.id, `${b.agent} has no companion`);
      if (!b.approval) out.E('agent', b.id, 'a beat with an agent needs an approval member: an agent prepares, a person approves', 'Add "approval": the member who reads and sends.');
      if (m?.companion?.runtime === 'Hermes' && !firstHermes) firstHermes = b;
      if (b.app && m?.companion) {
        const app = ctx.apps.get(b.app.id);
        if (app && !(FIRST_PARTY as readonly string[]).includes(app.id)) {
          const link = app.agent.link;
          if (m.companion.runtime === 'Hermes' && !['wired', 'mcp'].includes(link)) out.E('agent-app', b.id, `Hermes cannot act on ${app.id} (agent link "${link}")`, 'Let Hermes draft and the person act, or use an app with a wired or MCP link.');
          if (m.companion.runtime === 'OpenClaw' && link === 'none') out.E('agent-app', b.id, `OpenClaw has no path to ${app.id} (no web interface)`);
        }
      }
      // OpenClaw that opens a website leaves the house over the home internet; the beat says so
      if (m?.companion?.runtime === 'OpenClaw' && /\b(websites?|web pages?|webpages?|online)\b/i.test(prose(b)) && b.popup.note !== OPENCLAW_WEB_NOTE) out.E('disclosure', b.id, `an OpenClaw beat that opens a website carries the note "${OPENCLAW_WEB_NOTE}"`);
    }
    if (b.approval && !b.agent) out.W('agent', b.id, 'approval without agent');
    if (b.say) {
      sayCount++;
      const m = members.get(b.say.speaker);
      if (!m?.companion) out.E('say', b.id, `${b.say.speaker} has no companion to speak`);
      else if (m.age < 13) out.E('say', b.id, 'children are never voiced');
      if (/\b(I (can|will|always|never|know|remember)|everything|anything|for you)\b/i.test(plain(b.say.text))) out.E('say', b.id, 'agent lines make no claim about the agent and promise nothing', 'Say what happens now: "Here is a draft. Please read it before you send it."');
    }
    if (b.category === 'small-business' && b.segment !== 'small-business') out.E('segment', b.id, 'category small-business needs segment small-business');
  }
  if (sayCount > 6) out.E('say', 'count', `${sayCount} agent lines (max 6)`);
  if (firstHermes && firstHermes.popup.note !== HERMES_NOTE) out.E('disclosure', firstHermes.id, `the first Hermes beat carries the note "${HERMES_NOTE}"`);
  out.stats.sayLines = sayCount;

  // Companion Memory: a companion that has it connected is named somewhere in the file
  // (story v2: the house lede and spots, the profiles and the beat details are read in the order a visitor meets them)
  const f = story.family;
  const ordered: [string, string][] = [['family.tagline', plain(story.family.tagline)], ['family.story', plain(story.family.story)],
    ...(f.home ? [['family.home', plain([f.home.lede, ...f.home.spots.map((s) => s.line)].join(' '))] as [string, string]] : []),
    ...story.members.filter((m) => m.profile).map((m): [string, string] => [`member ${m.id}.profile`, plain(m.profile!.bio)]),
    ...story.beats.map((b): [string, string] => [b.id, `${prose(b)} ${detailStrings(b).map(plain).join(' ')}`]),
    ...(f.day || []).map((d, i): [string, string] => [`family.day${i}`, plain(d.line)]),
    ['closing', plain(story.closing.body)]];
  const firstMem = ordered.find(([, t]) => /Companion Memory/.test(t));
  if (story.members.some((m) => m.companion?.memory) && !firstMem) out.W('disclosure', 'memory', 'a companion has Companion Memory connected but no beat mentions it');
}
