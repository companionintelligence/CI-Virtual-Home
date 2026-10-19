// Persona rules (reference/story/personas.md): a member with an `archetype` tells one job on the family's one Companion
// Core, in the rooms that job happens in, with the store apps that do it, and says what each app replaces. The same file
// feeds the lander and the ad cuts, so the ad rules (CI-Common ADS.md) are checked here too: the story is told, never
// shown as an app screen. Members without an archetype are not held to the persona rules, so a legacy family is unaffected.
import type { Beat, Member, Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { plain } from './text.mts';

/**
 * Wording that describes what an app's screen looks like. ADS.md: no UI mockups, no screen recordings, no invented app
 * interface; the person and the room carry the scene. The phone popup rows of the ftue are a stylised drawing, not prose,
 * and are not read here. `review` severity: a sentence about a television set or a dashboard on the wall can be fine,
 * and the owner says so in reviewed.json.
 */
export const UI_DESCRIPTION = new RegExp([
  String.raw`\b(?:the|his|her|their|its|a)\s+(?:screen|display|monitor|dashboard|interface|window|panel|app)\s+(?:shows?|displays?|lists?|reads|lights up|fills)\b`,
  String.raw`\bon\s+(?:the|his|her|their)\s+(?:screen|monitor|display),?\s+(?:she|he|they|you|\w+)\s+(?:sees?|watch(?:es)?|reads?)\b`,
  String.raw`\b(?:dashboard|interface|screen|window)\s+(?:shows?|displays?)\b`,
  String.raw`\bthe\s+(?:user\s+|app\s+|app's\s+)?interface\b`,
  String.raw`\ba\s+notifications?\s+(?:pops?|appears?|slides?|flashes)\b`,
  String.raw`\bpops?\s+up\b`,
  String.raw`\bscreenshots? of (?:the|its|an?) (?:app|dashboard|screen|interface|window)\b`,
].join('|'), 'i');

/** The room a beat is told in: its anchor's own room, else its chapter's. */
function roomOf(b: Beat, story: Story): string | undefined {
  return b.anchor.room ?? story.chapters.find((c) => c.id === b.chapter)?.room;
}

function checkMember(story: Story, m: Member, ctx: Ctx, out: Report): void {
  const def = ctx.personas.archetypes[m.archetype!];
  if (!def) { out.E('persona-cover', m.id, `archetype ${m.archetype} is not in content/story/personas.json`); return; }
  const mine = story.beats.filter((b) => b.member === m.id);

  // ---- a beat in the archetype's own room. The fallback rooms count only when the house has none of the preferred ones.
  const facts = ctx.house(story.house);
  const hasPreferred = facts?.rooms ? def.rooms.some((r) => facts.rooms!.has(r)) : true;
  const allowed = new Set<string>(hasPreferred ? def.rooms : [...def.rooms, ...def.fallbackRooms]);
  // The cast plan puts each member in the room the house gives them (a builder at the dining table of a flat with no study, an organiser at the
  // living-room desk): that room is theirs too, whatever the archetype's usual rooms say.
  for (const r of ctx.castBySlug.get(story.slug)?.members?.find((c) => c.id === m.id)?.roomRoles ?? []) allowed.add(r);
  if (!mine.some((b) => { const r = roomOf(b, story); return !!r && allowed.has(r); })) {
    out.E('persona-cover', `${m.id}.rooms`,
      `${m.name} is the family's ${m.archetype} but no beat of theirs is in ${[...allowed].join(', ')}`,
      `Give ${m.name} a beat in ${def.rooms.join(' or ')} (anchor: ${def.anchorRoles.join(', ')}${def.fallbackAnchorRoles.length ? `; fallbacks ${def.fallbackAnchorRoles.join(', ')}` : ''}).`);
  }

  // ---- a beat whose app is one the archetype draws on
  const pool = new Set<string>(def.apps);
  if (!mine.some((b) => [...(b.app ? [b.app.id] : []), ...(b.with || [])].some((id) => pool.has(id)))) {
    out.E('persona-cover', `${m.id}.apps`,
      `${m.name} is the family's ${m.archetype} but no beat of theirs uses an app from that pool`,
      `Use one of: ${def.apps.join(', ')}.`);
  }

  // ---- the uncloud argument: every persona beat whose app replaces something says what
  for (const b of mine) {
    const app = b.app ? ctx.apps.get(b.app.id) : undefined;
    if (!app || !app.replaces.length) continue;
    if (!(b.popup.chips || []).some((c) => /^replaces /.test(c))) {
      out.W('persona-replaces', b.id, `${app.name} replaces ${app.replaces.join(', ')} in the catalog but the chips do not say what it replaces`,
        `Chips: "${app.name}", "replaces ${app.replaces[0]}" (and set app.replaces to ["${app.replaces[0]}"]).`);
    }
  }
}

export function checkPersonas(story: Story, ctx: Ctx, out: Report): void {
  const typed = story.members.filter((m) => m.archetype);
  if (typed.length) {
    const kinds = new Set(typed.map((m) => m.archetype));
    if (kinds.size < 2) out.E('persona-spread', 'archetype', `the family covers ${kinds.size} archetype (${[...kinds].join(', ')}); at least two`, 'Give another member a different archetype: organiser, builder, gamer, learner, maker or host.');
    for (const m of typed) checkMember(story, m, ctx, out);
  }
  out.stats.archetypes = [...new Set(typed.map((m) => m.archetype))];

  // ---- ADS.md: told, not shown. Applies to every beat, persona or not: the film and the lander show the same words.
  for (const b of story.beats) {
    for (const [field, raw] of [['title', b.popup.title], ['body', b.popup.body], ['say', b.say?.text ?? '']] as const) {
      const m = raw ? plain(raw).match(UI_DESCRIPTION) : null;
      if (m) out.R('persona-no-ui', `${b.id}.${field}`, `describes an app's screen ("${m[0]}"); the ad rules allow no UI mockups or invented app screens`, 'Tell what the person does and where the data lives, not what the screen looks like.');
    }
  }
}
