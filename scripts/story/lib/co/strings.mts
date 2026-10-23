// Every string of a company story that a visitor reads or hears, with the place a finding should point at: the counterpart of userStrings() (lib/text.mts) for company/v1.
// NOT user-facing, so never scanned: slug, house, ids, URLs, `notes` (build-only), `capability` (audit trail), `app.replaces` (the catalog's own names; the chips carry them
// to the screen and are scanned).
import type { Str } from '../text.mts';
import type { CompanyStory } from './types.mts';

export function companyStrings(story: CompanyStory): Str[] {
  const out: Str[] = [];
  const S = (at: string, s?: string): void => { if (s) out.push([at, s]); };
  const c = story.company;
  S('company.name', c.name); S('company.tagline', c.tagline); S('company.sector', c.sector); S('company.story', c.story); S('company.address', `${c.address.line}, ${c.address.place}`);
  if (c.office) { S('company.office.lede', c.office.lede); c.office.spots.forEach((s, i) => S(`company.office.spot${i}`, s.line)); }
  (c.day || []).forEach((d, i) => S(`company.day${i}`, d.line));
  story.chapters.forEach((ch) => S(`chapter ${ch.id}`, ch.title));
  story.members.forEach((m) => {
    S(`member ${m.id}.name`, m.name); S(`member ${m.id}.title`, m.title); S(`member ${m.id}.profile`, m.profile?.bio);
    if (m.companion) {
      S(`member ${m.id}.companion.name`, m.companion.name); S(`member ${m.id}.companion.job`, m.companion.job);
      S(`member ${m.id}.companion.personality`, m.companion.personality.join(', ')); S(`member ${m.id}.companion.limits`, m.companion.limits);
    }
  });
  story.beats.forEach((b) => {
    const p = b.popup;
    S(`${b.id}.title`, p.title); S(`${b.id}.body`, p.body);
    (p.chips || []).forEach((x, i) => S(`${b.id}.chip${i}`, x));
    S(`${b.id}.note`, p.note);
    if (p.phone) { S(`${b.id}.phone.header`, p.phone.header); p.phone.rows.forEach((r, i) => S(`${b.id}.phone.row${i}`, r)); }
    if (b.say) S(`${b.id}.say`, b.say.text);
    if (b.detail) { S(`${b.id}.detail.before`, b.detail.before); S(`${b.id}.detail.after`, b.detail.after); b.detail.steps.forEach((x, i) => S(`${b.id}.detail.step${i}`, x)); S(`${b.id}.detail.fact`, b.detail.fact); }
  });
  S('closing.body', story.closing.body); S('closing.cta', story.closing.cta.label);
  return out;
}
