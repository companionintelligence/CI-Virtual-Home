// Quotas: categories, small-business share, beats per member, and the film (8 to 12 beats, at most 215 spoken words).
// The numbers are STORY-BIBLE section 5. The film estimate is the same arithmetic the bake step later replaces with
// the real audio length: speech at 150 words a minute plus a pause per beat plus the bookends.
import type { Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { words } from './text.mts';

export const REQUIRED_CATEGORIES = ['setup', 'home', 'food', 'iot', 'productivity', 'privacy'] as const;
export const FILM = { minBeats: 8, maxBeats: 12, maxWords: 215, minSeconds: 75, maxSeconds: 115, minFtue: 3, minChapters: 5 } as const;

/** Words of speech in the film: narration, agent lines, the closing, and the sign-off (3 words). */
export function filmWords(story: Story): number {
  const beats = story.beats.filter((b) => b.film);
  return beats.reduce((n, b) => n + words(b.popup.body).length + (b.say ? words(b.say.text).length : 0), 0) + words(story.closing.body).length + 3;
}
export function filmSeconds(story: Story): number {
  const beats = story.beats.filter((b) => b.film);
  return filmWords(story) / 2.5 + 0.6 * (beats.length + 1) + 10;
}

export function checkQuotas(story: Story, _ctx: Ctx, out: Report): void {
  const cats = new Set(story.beats.map((b) => b.category));
  for (const need of REQUIRED_CATEGORIES) if (!cats.has(need)) out.E('categories', need, `every family covers ${need}`);
  if (cats.size < 8) out.E('categories', 'spread', `${cats.size} categories (at least 8 of 11)`);

  const sb = story.beats.filter((b) => b.segment === 'small-business').length;
  if (story.family.business) {
    if (sb < 5) out.E('segment', 'small-business', `a business family needs 5 or more small-business beats (has ${sb})`);
    if (sb / story.beats.length > 0.45) out.E('segment', 'small-business', `small-business beats are ${Math.round((100 * sb) / story.beats.length)}% of the tour (at most 45%)`);
  } else if (sb > 2) out.E('segment', 'small-business', `a family without a business has ${sb} small-business beats (at most 2)`);

  for (const m of story.members) {
    const n = story.beats.filter((b) => b.member === m.id || b.agent === m.id).length;
    if (m.age >= 13 && n < 3) out.E('members', m.id, `${m.name} has ${n} beats (at least 3)`);
    if (m.age < 13 && n < 1) out.E('members', m.id, `${m.name} has no beat`);
  }

  // ---- the film
  const cs = story.chapters;
  const fb = story.beats.filter((b) => b.film);
  if (fb.length < FILM.minBeats || fb.length > FILM.maxBeats) out.E('film', 'count', `${fb.length} film beats (${FILM.minBeats} to ${FILM.maxBeats})`);
  if (fb.filter((b) => b.chapter === cs[0].id).length < FILM.minFtue) out.E('film', 'ftue', `at least ${FILM.minFtue} ftue beats are in the film`);
  if (!fb.some((b) => b.chapter === cs[cs.length - 1].id)) out.E('film', 'outro', 'the outro beat is in the film');
  const chapters = new Set(fb.map((b) => b.chapter));
  if (chapters.size < FILM.minChapters) out.E('film', 'rooms', `the film visits ${chapters.size} chapters (at least ${FILM.minChapters})`);
  if (new Set(fb.map((b) => b.member).filter(Boolean)).size < Math.min(2, story.members.length)) out.E('film', 'members', 'the film shows at least two members');
  if (story.family.business && !fb.some((b) => b.segment === 'small-business')) out.E('film', 'business', 'a business family shows one small-business beat in the film');
  const fw = filmWords(story), fs = filmSeconds(story);
  if (fw > FILM.maxWords) out.E('film', 'words', `film speech is ${fw} words (at most ${FILM.maxWords})`);
  if (fs < FILM.minSeconds || fs > FILM.maxSeconds) out.E('film', 'length', `estimated film length ${fs.toFixed(0)} s (${FILM.minSeconds} to ${FILM.maxSeconds})`);

  out.stats.beats = story.beats.length;
  out.stats.members = story.members.length;
  out.stats.categories = [...cats];
  out.stats.smallBusiness = sb;
  out.stats.filmBeats = fb.length;
  out.stats.filmWords = fw;
  out.stats.filmSec = Math.round(fs);
}
