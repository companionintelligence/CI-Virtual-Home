// Shape rules: the word and sentence budgets, digits, how a body ends, title case. These keep the spoken text
// predictable for the voice tool (digits read badly) and the popups short enough to read while the camera moves.
// Numbers are STORY-BIBLE section 5; claims.json `style` carries the same figures.
import type { Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { plain, sentences, words } from './text.mts';

export const LIMITS = { title: 6, body: 30, sentence: 20, say: 16, closing: 30 } as const;

export const digits = /\d/;
// Catalog names with a digit (n8n) are the one place a digit may stay in spoken text.
export const digitApps = (ctx: Ctx): string[] => ctx.catalog.apps.map((a) => a.name).filter((n) => digits.test(n));
export const stripDigitApps = (s: string, names: string[]): string => names.reduce((t, n) => t.split(n).join(' '), s);

// Words that start with a capital inside a heading and are still correct in sentence case.
const PROPER = /^(Companion|Core|Hub|Memory|OS|Agents?|Wi-Fi|OpenClaw|Hermes|USB)$/;

export function checkShape(story: Story, ctx: Ctx, out: Report): void {
  const names = digitApps(ctx);
  const personNames = new Set<string>([...story.members.map((m) => m.name), ...story.members.flatMap((m) => (m.companion ? [m.companion.name] : [])), story.family.surname, ...story.family.surname.split('-')]);
  const appWords = new Set<string>(ctx.catalog.apps.flatMap((a) => a.name.split(/[\s-]+/)));

  story.beats.forEach((b) => {
    const p = b.popup, at = b.id;
    const title = plain(p.title), body = plain(p.body);
    if (words(title).length > LIMITS.title) out.E('len-title', at, `title has ${words(title).length} words (max ${LIMITS.title})`, 'Cut it to a complete thought of six words or fewer.');
    if (words(body).length > LIMITS.body) out.E('len-body', at, `body has ${words(body).length} words (max ${LIMITS.body}); it is the narration and the caption`, 'Cut it to thirty words or fewer.');
    for (const sn of sentences(body)) if (words(sn).length > LIMITS.sentence) out.E('len-sentence', at, `a sentence has ${words(sn).length} words (max ${LIMITS.sentence})`, 'Split it. A period beats a comma.');
    if (digits.test(stripDigitApps(`${title} ${body} ${b.say ? plain(b.say.text) : ''}`, names))) out.E('digits', at, 'no digits in spoken or titled text', 'Spell numbers out: "ten", "three quarters".');
    if (b.say && words(b.say.text).length > LIMITS.say) out.E('len-say', at, `say has ${words(b.say.text).length} words (max ${LIMITS.say})`, 'Shorten the agent line.');
    if (!/[.!?]$/.test(body.trim())) out.E('body-end', at, 'body must end with a full stop', 'End the narration with a full stop so the voice closes the thought.');
    if (/^[a-z]/.test(title)) out.E('title-case', at, 'title starts with a capital');
    // Sentence case: a capital after the first word is wrong unless it is a product noun, an app word or a name in the family.
    const stray = title.split(' ').slice(1).map((w) => w.replace(/[^A-Za-z'-]/g, ''))
      .filter((w) => /^[A-Z][a-z]/.test(w) && !PROPER.test(w) && !appWords.has(w) && !personNames.has(w.replace(/'s$/, '')) && !ctx.catalog.apps.some((a) => a.name.includes(w)));
    if (stray.length) out.W('title-case', at, `headings are sentence case: "${title}"`, `Lower-case ${stray.join(', ')}.`);
  });

  const cb = plain(story.closing.body);
  if (words(cb).length > LIMITS.closing) out.E('len-closing', 'closing', `closing body has ${words(cb).length} words (max ${LIMITS.closing})`);
  for (const sn of sentences(cb)) if (words(sn).length > LIMITS.sentence) out.E('len-sentence', 'closing', `a sentence has ${words(sn).length} words (max ${LIMITS.sentence})`);
  if (digits.test(stripDigitApps(cb, names))) out.E('digits', 'closing', 'no digits in the closing body');
  if (/UnCloud your life/i.test(cb)) out.E('closing', 'body', 'the sign-off is added by the site and the film; do not type it here');
  if (!/[.!?]$/.test(cb.trim())) out.E('body-end', 'closing', 'the closing body must end with a full stop');
  for (const sn of sentences(plain(story.family.story))) if (words(sn).length > LIMITS.sentence) out.E('len-sentence', 'family.story', `a sentence has ${words(sn).length} words (max ${LIMITS.sentence})`);
  if (!/[.!?]$/.test(story.family.tagline.trim())) out.W('body-end', 'family.tagline', 'a tagline is one sentence and ends with a full stop');
}
