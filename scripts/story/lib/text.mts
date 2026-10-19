// Text rules: what counts as a user-facing string, and the 69 banned phrases of content/story/claims.json applied to it.
//
// A user-facing string is anything a visitor reads or hears: tagline, story, address, chapter titles, member work,
// names, the companion's job and limits, popup title/body/chips/note/phone rows, `say` lines, the closing.
// NOT user-facing, so never scanned: slug, house, every id, URLs, `notes` (build-only), `capability` (audit trail),
// `app.replaces` (the catalog's own names; the chips carry them to the screen and are scanned).
import type { Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';

/** Strip HTML tags and fold typographic quotes, as claims.json validator.flags asks. */
export const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
export const sentences = (s: string): string[] => s.split(/(?<=[.!?])\s+/).filter(Boolean);

export type Str = [at: string, text: string];

/** Every user-facing string of a story, with the location a finding should point at. */
export function userStrings(story: Story): Str[] {
  const out: Str[] = [];
  const S = (at: string, s?: string): void => { if (s) out.push([at, s]); };
  const f = story.family;
  S('family.surname', f.surname); S('family.tagline', f.tagline); S('family.story', f.story); S('family.address', `${f.address.line}, ${f.address.place}`);
  story.chapters.forEach((c) => S(`chapter ${c.id}`, c.title));
  story.members.forEach((m) => {
    S(`member ${m.id}.name`, m.name); S(`member ${m.id}.work`, m.work);
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
  for (const [at, raw] of userStrings(story)) {
    // A "replaces <X>" chip is the sanctioned uncloud pattern: X is a name from the catalog (the `app-replaces` and
    // `chips` rules check it), so the parity and gaming phrases must not read it as a claim ("replaces ChatGPT").
    if (/\.chip\d+$/.test(at) && /^replaces /i.test(raw)) continue;
    const s = plain(raw);
    for (const b of ctx.bans) {
      if (!b.re.test(s)) continue;
      const shown = s.length > 70 ? `${s.slice(0, 70)}...` : s;
      out.add(b.severity, b.id, at, `"${shown}" ${b.why}`, b.fix);
    }
  }
}
