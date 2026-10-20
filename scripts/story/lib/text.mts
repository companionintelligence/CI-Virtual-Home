// Text rules: what counts as a user-facing string, and the 69 banned phrases of content/story/claims.json applied to it.
//
// A user-facing string is anything a visitor reads or hears: tagline, story, address, chapter titles, member work,
// names, the companion's job and limits, popup title/body/chips/note/phone rows, `say` lines, the closing.
// NOT user-facing, so never scanned: slug, house, every id, URLs, `notes` (build-only), `capability` (audit trail),
// `app.replaces` (the catalog's own names; the chips carry them to the screen and are scanned).
import type { Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { isV3Story } from './v3.mts';

/** Strip HTML tags and fold typographic quotes, as claims.json validator.flags asks. */
export const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
export const sentences = (s: string): string[] => s.split(/(?<=[.!?])\s+/).filter(Boolean);

export type Str = [at: string, text: string];

/** The strings of a beat's `detail` (story v2), in reading order; empty when the beat has none. */
export const detailStrings = (b: { detail?: { before: string; after: string; steps: string[]; fact: string } }): string[] => (b.detail ? [b.detail.before, b.detail.after, ...b.detail.steps, b.detail.fact] : []);

/** Every user-facing string of a story, with the location a finding should point at. */
export function userStrings(story: Story): Str[] {
  const out: Str[] = [];
  const S = (at: string, s?: string): void => { if (s) out.push([at, s]); };
  const f = story.family;
  S('family.surname', f.surname); S('family.tagline', f.tagline); S('family.story', f.story); S('family.address', `${f.address.line}, ${f.address.place}`);
  // ---- story v2 (reference/story/story-v2.md): the house, the day, the profiles and the beat details are read like any other copy
  if (f.home) { S('family.home.lede', f.home.lede); f.home.spots.forEach((s, i) => S(`family.home.spot${i}`, s.line)); }
  (f.day || []).forEach((d, i) => S(`family.day${i}`, d.line));
  story.chapters.forEach((c) => S(`chapter ${c.id}`, c.title));
  story.members.forEach((m) => {
    S(`member ${m.id}.name`, m.name); S(`member ${m.id}.work`, m.work); S(`member ${m.id}.profile`, m.profile?.bio);
    if (m.companion) {
      S(`member ${m.id}.companion.name`, m.companion.name); S(`member ${m.id}.companion.job`, m.companion.job);
      S(`member ${m.id}.companion.personality`, m.companion.personality.join(', ')); S(`member ${m.id}.companion.limits`, m.companion.limits);
    }
  });
  story.beats.forEach((b) => {
    const p = b.popup;
    S(`${b.id}.title`, p.title); S(`${b.id}.body`, p.body);
    (p.chips || []).forEach((c, i) => S(`${b.id}.chip${i}`, c));
    S(`${b.id}.note`, p.note);
    if (p.phone) { S(`${b.id}.phone.header`, p.phone.header); p.phone.rows.forEach((r, i) => S(`${b.id}.phone.row${i}`, r)); }
    if (b.say) S(`${b.id}.say`, b.say.text);
    if (b.detail) { S(`${b.id}.detail.before`, b.detail.before); S(`${b.id}.detail.after`, b.detail.after); b.detail.steps.forEach((x, i) => S(`${b.id}.detail.step${i}`, x)); S(`${b.id}.detail.fact`, b.detail.fact); }
  });
  S('closing.body', story.closing.body); S('closing.cta', story.closing.cta.label);
  return out;
}

/**
 * Apply every banned phrase to every user-facing string. The finding keeps the claims.json rule id so a writer can look
 * the rule up (`why` and `fix` come from the file). Severity comes from the rule: error fails, review needs the
 * allow-list, warn prints.
 */
export function checkBannedPhrases(story: Story, ctx: Ctx, out: Report): void {
  const v3 = isV3Story(story);
  for (const [at, raw] of userStrings(story)) {
    // A pass 1 "replaces <X>" chip is the old uncloud pattern: X is a name from the catalog (the `app-replaces` and `chips` rules check it).
    // It used to be skipped here, which let "Open WebUI replaces ChatGPT" (cap-parity) ship in seven tours. Now it runs through every rule:
    // in a v3 family (the chip is "alternative to <Service>") at the rule's own severity, in a family not yet rewritten as a warning, the
    // phase-in device of v3.mts, so the fleet stays valid until each family is told again. The warning says what the rule would have said.
    const legacyChip = /\.chip\d+$/.test(at) && /^replaces /i.test(raw) && !v3;
    const s = plain(raw);
    for (const b of ctx.bans) {
      if (!b.re.test(s)) continue;
      const shown = s.length > 70 ? `${s.slice(0, 70)}...` : s;
      out.add(legacyChip ? 'warn' : b.severity, b.id, at, `"${shown}" ${b.why}`, legacyChip ? `${b.fix} (A pass 1 chip is a warning until the family is told in the v3 shape.)` : b.fix);
    }
  }
}
