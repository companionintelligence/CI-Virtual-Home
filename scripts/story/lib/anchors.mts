// House rules: every beat is anchored on a semantic role (never a coordinate), and the role (or one of its fallbacks)
// must resolve in the beat's own house. This is what keeps a story valid when a spec changes: the house files are
// re-read on every run, casting.json is not trusted for counts. STORY-BIBLE sections 6 and 12.
import type { AnchorLeaf, Beat, Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { HouseFacts } from './house.mts';
import { castingDisagreements } from './house.mts';
import type { Report } from './report.mts';
import { beatText } from './structure.mts';

/** A leaf resolves when the house has the role; the `room` role resolves when the house has that room. */
function resolves(leaf: AnchorLeaf, beatRoom: string | undefined, facts: HouseFacts | null, universal: Set<string>): boolean {
  if (!facts) return universal.has(leaf.role) && leaf.role !== 'room';
  if (leaf.role === 'room') {
    const room = leaf.room ?? beatRoom;
    return !room || !facts.rooms || facts.rooms.has(room);
  }
  return facts.roles.has(leaf.role);
}

export function checkAnchors(story: Story, ctx: Ctx, out: Report): void {
  const universal = new Set(ctx.roles.universal);
  const facts = ctx.house(story.house);
  const cast = ctx.castBySlug.get(story.slug) ?? null;
  const roomOf = (b: Beat): string | undefined => story.chapters.find((c) => c.id === b.chapter)?.room;

  if (!facts) out.E('anchor', 'house', `no HouseSpec or plan for house ${story.house} (content/houses/${story.house}.json)`);
  else if (cast) for (const d of castingDisagreements(facts, cast, ctx.roles)) out.W('casting', 'roles', d, 'casting.json is out of date for this house; the validator used the house files.');

  for (const b of story.beats) {
    const chain: AnchorLeaf[] = [b.anchor, ...(b.anchor.fallback || [])];
    const room = roomOf(b);
    const ok = chain.some((l) => resolves(l, room, facts, universal));
    if (!ok) out.E('anchor', b.id, `none of ${chain.map((l) => (l.role === 'room' ? `room:${l.room ?? room}` : l.role)).join(', ')} exists in ${story.slug}'s house`, 'Add a fallback that ends in a universal role: ' + [...universal].join(', ') + '.');
    else if (!resolves(b.anchor, room, facts, universal) && !(b.anchor.fallback || []).length) out.E('anchor', b.id, `${b.anchor.role} is missing in this house and the beat has no fallback`);
    // a role that is not in every house needs a chain that ends in a role that is
    if (!universal.has(b.anchor.role)) {
      const tail = chain[chain.length - 1];
      if (!universal.has(tail.role)) out.E('anchor', b.id, `${b.anchor.role} is not in every house; the fallback chain must end in a universal role (${[...universal].join(', ')})`, 'Append {"role":"room","room":"<this chapter\'s room>"} or the couch, counter or garden.');
    }
    // nth beyond what the house has (the resolver would wrap to a different object)
    if (facts && b.anchor.nth != null && b.anchor.role in ctx.roles.items && (facts.roleCounts[b.anchor.role] || 0) > 0 && b.anchor.nth >= facts.roleCounts[b.anchor.role]) {
      out.W('anchor', b.id, `nth ${b.anchor.nth} but the house has ${facts.roleCounts[b.anchor.role]} ${b.anchor.role}`);
    }
  }
  checkTextRoles(story, ctx, out, facts, cast);
  checkRequiredBeats(story, out, facts, cast);
}

// ---- text that promises a thing the house does not have ---------------------------------------------------------------
const TEXT_ROLES: { role: string; flag: string; re: (t: string) => boolean; what: string }[] = [
  { role: 'tv', flag: 'tv', what: 'a TV', re: (t) => /\b(TV|television)\b/i.test(t) || /\b(big|wall|living[- ]room|family[- ]room) screen\b/i.test(t) },
  { role: 'fireplace', flag: 'fireplace', what: 'a fireplace', re: (t) => /\bfireplace\b/i.test(t) },
  // "nursery" is also a plant nursery (a grower's family): only the baby's room counts, and only when no plant word is near
  { role: 'crib', flag: 'crib', what: 'a crib or nursery', re: (t) => /\bcrib\b/i.test(t) || (/\b(baby'?s? nursery|the nursery|nursery room)\b/i.test(t) && !/\b(plants?|seeds?|seedlings?|garden|growers?|stock|trees?)\b/i.test(t)) },
  { role: 'kitchen-island', flag: 'kitchen-island', what: 'a kitchen island', re: (t) => /\b(kitchen|breakfast) (island|bar)\b|\bthe island\b/i.test(t) },
];

function checkTextRoles(story: Story, ctx: Ctx, out: Report, facts: HouseFacts | null, cast: ReturnType<Ctx['castBySlug']['get']> | null): void {
  checkTextRoleStrings(story, ctx, out, story.beats.map((b): [string, string] => [b.id, beatText(b)]), facts, cast);
}

/** The text-role rule over any [place, text] pairs: the beats, and (story v2) the house lede, the spot lines, the day and the profiles. */
export function checkTextRoleStrings(story: Story, ctx: Ctx, out: Report, items: [at: string, text: string][], facts: HouseFacts | null = ctx.house(story.house), cast: ReturnType<Ctx['castBySlug']['get']> | null = ctx.castBySlug.get(story.slug) ?? null): void {
  const flagged = new Set((cast?.homeFlags ?? []).map((f) => f.no as string));
  for (const [at, t] of items) {
    for (const r of TEXT_ROLES) {
      if (!r.re(t)) continue;
      const missing = flagged.has(r.flag) || (facts ? !facts.roles.has(r.role) : (cast?.roles[r.role] || 0) === 0);
      if (missing) out.E('text-role', at, `the text says ${r.what} but ${story.slug}'s house has none (see casting homeFlags)`, 'Tell the moment at the couch, the counter or another thing the house has. Never add furniture.');
    }
  }
}

// ---- the scenes every family has -------------------------------------------------------------------------------------
function checkRequiredBeats(story: Story, out: Report, facts: HouseFacts | null, cast: ReturnType<Ctx['castBySlug']['get']> | null): void {
  if (!story.beats.some((b) => b.anchor.role === 'couch')) out.E('beats', 'couch', 'a couch beat is required (anchor role couch)');
  const noTv = (cast?.homeFlags ?? []).some((f) => f.no === 'tv') || (facts ? !facts.roles.has('tv') : false);
  if (noTv) {
    if (!story.beats.some((b) => b.category === 'media' && b.anchor.role === 'couch')) out.E('beats', 'media', 'a home without a living-room TV needs a media beat at the couch (Navidrome, Audiobookshelf, Koodo Reader or Immich on a phone)');
  } else if (!story.beats.some((b) => b.anchor.role === 'tv')) out.E('beats', 'tv', 'a TV beat is required in a home with a living-room TV (anchor role tv)');
  const kitchen = story.chapters.filter((c) => c.room === 'kitchen').map((c) => c.id);
  const kb = story.beats.filter((b) => kitchen.includes(b.chapter)).length;
  if (kb < 2) out.E('beats', 'kitchen', `${kb} kitchen beats (at least 2)`);
  const garden = story.chapters.filter((c) => c.room === 'garden' || c.room === 'patio').map((c) => c.id);
  if (!story.beats.some((b) => garden.includes(b.chapter))) out.E('beats', 'garden', 'a garden beat is required');
}
