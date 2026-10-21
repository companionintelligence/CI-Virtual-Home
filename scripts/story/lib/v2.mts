// Story v2 rules (reference/story/story-v2.md): the optional fields `beat.detail`, `family.home`, `family.day` and `member.profile`.
// All of them are optional on family/v1, so a family without them is held to none of these rules. The copy rules (dashes, exclamation,
// emoji, banned phrases, vocabulary, num-*, sec-*, cap-*, incumbent-attack, internal-ids) reach the new strings through `userStrings`
// (text.mts); the app-name rules reach a beat's detail through the beat text (apps.mts); persona-no-ui reads it too (persona.mts); and
// text-role (anchors.mts) reads the beat text and, from here, the house lede, the spot lines, the day and the profiles.
//
// Rule ids: detail-len, detail-replaces, detail-fact, detail-missing, home-lede, home-spots, day, profile. Digits and body-end reuse the ids
// of the shape rules. Severities and fixtures: reference/story/validator.md.
import { DAY_PARTS, type Beat, type Member, type Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report } from './report.mts';
import { checkTextRoleStrings } from './anchors.mts';
import { digitApps, digits, stripDigitApps } from './shape.mts';
import { plain, sentences, words } from './text.mts';

export const V2_LIMITS = {
  before: 28, after: 28, fact: 28, step: 12, steps: { min: 2, max: 4 },
  lede: 50, ledeSentence: 22, spotLine: 16, spots: { min: 2, max: 5 },
  dayLine: 14, day: { min: 5, max: 10 },
  bio: 45,
} as const;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nWords = (s: string): number => words(plain(s)).length;
const clean = (n: string): string => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();           // "GitLab (SaaS)" -> "GitLab"

// ---- the services a "before" may name -------------------------------------------------------------------------------------
// Every `replaces` name in the catalog is a rented service the stories may talk about; a beat may name only the ones its own app
// replaces (the beat's app.replaces, or the catalog entry's replaces). The uncloud argument must not attack a company the chip does not name.
/** Service names that are also ordinary words or first names: matched case-sensitively and never at the start of a sentence. */
const AMBIGUOUS_SERVICES = new Set(['Make', 'Medium', 'Pocket', 'Mint', 'Ring', 'Cursor', 'Sketch', 'Mural', 'Harvest', 'Buffer', 'Notion', 'Slack', 'Zoom', 'Paprika', 'Doodle', 'Miro', 'Tody', 'Claude', 'Apple', 'Meta', 'Amazon']);
/** Company names that stand alone ("Google", not only "Google Drive"). */
const COMPANY_STEMS = ['Google', 'Apple', 'Amazon', 'Microsoft', 'Adobe', 'Autodesk', 'Meta', 'Facebook', 'Samsung', 'Alphabet'];

interface Matcher { name: string; re: RegExp }
const matcherCache = new WeakMap<Ctx, Matcher[]>();
const registryMatcherCache = new WeakMap<Ctx, Matcher[]>();
/**
 * The service names a text can be checked for. A beat with no `service` (the pass 2 rule) is checked against the `replaces` names of the catalog;
 * with `registry` (story v3, a beat with a service) every service of content/story/services.json joins them, and a registry service flagged
 * ordinary-word (Clerk, Sanity, Glean, Distill) is matched like the other ambiguous names: capitalised, not at the start of a sentence.
 */
function serviceMatchers(ctx: Ctx, registry = false): Matcher[] {
  const cache = registry ? registryMatcherCache : matcherCache;
  let m = cache.get(ctx);
  if (!m) {
    const names = new Set<string>(COMPANY_STEMS);
    for (const a of ctx.catalog.apps) for (const r of a.replaces || []) names.add(clean(r));
    const ordinary = new Set<string>(AMBIGUOUS_SERVICES);
    if (registry) for (const sv of ctx.services.byId.values()) for (const n of [sv.name, ...sv.aliases]) { names.add(clean(n)); if (sv.flags.includes('ordinary-word')) ordinary.add(clean(n)); }
    m = [...names].sort((a, b) => b.length - a.length || a.localeCompare(b)).map((name) => ({
      name,
      re: ordinary.has(name)
        ? new RegExp(`(?<!^|[.!?:]\\s+|\\n)(?<![\\w-])${escapeRe(name)}(?![\\w-])`)
        : new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, 'i'),
    }));
    cache.set(ctx, m);
  }
  return m;
}

/** The third-party services a text names that are not in `allowed` (the app's own replaces list). Family names never count as services. */
export function foreignServices(text: string, allowed: string[], ctx: Ctx, people: Set<string>, registry = false): string[] {
  let t = ` ${plain(text)}`;
  const allowedClean = [...new Set(allowed.map(clean))].sort((a, b) => b.length - a.length);
  const strip = (name: string, flags: string, after = ''): void => { t = t.replace(new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-]${after})`, flags), ' '); };
  for (const a of allowedClean) { strip(a, 'gi'); const stem = a.split(' ')[0]; if (a.includes(' ') && COMPANY_STEMS.includes(stem)) strip(stem, 'g', '|\\s+[A-Z]'); }   // a bare "Google" is covered by "Google Photos", but "Google Drive" is another service
  const hits: string[] = [];
  for (const m of serviceMatchers(ctx, registry)) {
    if (people.has(m.name)) continue;
    const found = t.match(m.re);
    if (!found) continue;
    hits.push(m.name);
    t = t.replace(m.re, ' ');
  }
  return hits;
}

const keyWords = (s: string): string[] => s.toLowerCase().match(/[a-z]{5,}/g) || [];

function checkDetail(ctx: Ctx, out: Report, b: Beat, people: Set<string>): void {
  const d = b.detail!;
  const L = V2_LIMITS;
  const at = `${b.id}.detail`;
  for (const f of ['before', 'after', 'fact'] as const) {
    const n = nWords(d[f]);
    if (n > L[f]) out.E('detail-len', `${at}.${f}`, `${f} has ${n} words (max ${L[f]})`, `Cut it to ${L[f]} words or fewer.`);
    if (!/[.!?]$/.test(plain(d[f]).trim())) out.W('body-end', `${at}.${f}`, `${f} should end with a full stop`);
  }
  if (d.steps.length < L.steps.min || d.steps.length > L.steps.max) out.E('detail-len', `${at}.steps`, `${d.steps.length} steps (${L.steps.min} to ${L.steps.max})`, 'Two to four steps, in order.');
  d.steps.forEach((s, i) => { const n = nWords(s); if (n > L.step) out.E('detail-len', `${at}.step${i}`, `step ${i + 1} has ${n} words (max ${L.step})`, `Cut it to ${L.step} words or fewer.`); });
  // digits: as in a body (spoken-style text), except inside an app name such as n8n
  const names = digitApps(ctx);
  for (const [k, s] of [['before', d.before], ['after', d.after], ...d.steps.map((x, i) => [`step${i}`, x]), ['fact', d.fact]] as [string, string][]) {
    if (digits.test(stripDigitApps(plain(s), names))) out.E('digits', `${at}.${k}`, 'no digits in the detail text', 'Spell numbers out: "ten", "three quarters".');
  }

  // detail-replaces: before and after may name only the beat's service (story v3: its registry name or an alias; a bare company name is allowed
  // beside it, "Google" with Google Photos), or, in a beat with no service, the services this beat's app replaces (the pass 2 rule)
  const app = b.app ? ctx.apps.get(b.app.id) : undefined;
  const svc = b.service !== undefined ? ctx.services.byId.get(b.service) : undefined;
  const allowed = svc ? [svc.name, ...svc.aliases, ...(b.app?.replaces?.[0] ? [b.app.replaces[0]] : [])] : [...(b.app?.replaces ?? []), ...(app?.replaces ?? [])];
  for (const f of ['before', 'after'] as const) {
    const foreign = foreignServices(d[f], allowed, ctx, people, !!svc);
    if (foreign.length) out.E('detail-replaces', `${at}.${f}`, `${f} names ${foreign.join(', ')}, which ${svc ? `is not this beat's service (${svc.name})` : app ? `${app.name} does not replace` : 'this beat\'s app does not replace'}${!svc && allowed.length ? ` (it replaces ${[...new Set(allowed.map(clean))].join(', ')})` : ''}`, svc ? `Name only ${svc.name} in a ${f}, or say "a rented service" and leave the company out.` : 'Name only a service in the beat\'s app.replaces, or say "a rented service" and leave the company out.');
  }

  // detail-fact: one true fact in the words of the catalog description
  if (app) {
    const claimApp = ctx.claims.apps.find((x) => x.id === app.id);
    const desc = `${app.description || ''} ${claimApp?.mayDescribeAs || ''}`.toLowerCase();
    const keys = keyWords(d.fact);
    if (keys.length && !keys.some((k) => desc.includes(k.slice(0, 5)))) out.W('detail-fact', `${at}.fact`, `the fact shares no word with the ${app.name} catalog description`, 'Copy the fact from the catalog description.');
  } else if (b.app) out.W('detail-fact', `${at}.fact`, `app ${b.app.id} is not in the catalog; the fact cannot be checked`);
}

function checkHome(story: Story, ctx: Ctx, out: Report): void {
  const home = story.family.home!;
  const L = V2_LIMITS;
  const facts = ctx.house(story.house);
  const cast = ctx.castBySlug.get(story.slug);

  // ---- the lede
  const lede = plain(home.lede);
  const n = words(lede).length;
  if (n > L.lede) out.E('home-lede', 'family.home.lede', `the lede has ${n} words (max ${L.lede})`, 'Two or three sentences, fifty words at most.');
  for (const sn of sentences(lede)) if (words(sn).length > L.ledeSentence) out.E('home-lede', 'family.home.lede', `a sentence has ${words(sn).length} words (max ${L.ledeSentence})`, 'Split it. A period beats a comma.');
  const sc = sentences(lede).length;
  if (sc < 2 || sc > 3) out.W('home-lede', 'family.home.lede', `the lede is ${sc} sentence${sc === 1 ? '' : 's'}; two or three read best`);
  if (!/[.!?]$/.test(lede.trim())) out.W('body-end', 'family.home.lede', 'the lede should end with a full stop');

  // ---- the house is named by nobody: no id, no display name, no builder or game words
  const idRe = new RegExp(`(?<![\\w-])${escapeRe(story.house)}(?![\\w-])`, 'i');
  const display = (facts?.displayName ?? '').trim();
  const nameRe = display.length >= 4 ? new RegExp(`(?<![\\w-])${escapeRe(display)}(?![\\w-])`, 'i') : null;
  const credit = /\b(Sims ?4?|Base Game|BG ?Family|BG ?House)\b/i;
  const texts: [string, string][] = [['family.home.lede', lede], ...home.spots.map((s, i): [string, string] => [`family.home.spot${i}`, plain(s.line)])];
  for (const [at, t] of texts) {
    if (idRe.test(t)) out.E('home-lede', at, `the text names the house id "${story.house}"`, 'The home is never named here; the page carries its display name in the fine print.');
    else if (nameRe?.test(t)) out.E('home-lede', at, `the text names the house "${display}"`, 'The home is never named here; the page carries its display name in the fine print.');
    if (credit.test(t)) out.E('home-lede', at, 'the text names the build the home came from', 'No builder and no game are named anywhere.');
  }
  checkTextRoleStrings(story, ctx, out, texts, facts, cast ?? null);

  // ---- the spots
  const rooms = new Set<string>([...(facts?.roomNames ?? []), ...((cast?.rooms ?? []).map((r) => r.name))]);
  if (home.spots.length < L.spots.min || home.spots.length > L.spots.max) out.E('home-spots', 'family.home.spots', `${home.spots.length} spots (${L.spots.min} to ${L.spots.max})`);
  const seen = new Set<string>();
  home.spots.forEach((s, i) => {
    const at = `family.home.spot${i}`;
    if (rooms.size && !rooms.has(s.room)) out.E('home-spots', at, `"${s.room}" is not a room of this house (rooms: ${[...rooms].join(', ')})`, 'Use an exact room name of the house.');
    if (seen.has(s.room)) out.E('home-spots', at, `"${s.room}" appears twice`, 'One line per room.');
    seen.add(s.room);
    const w = words(plain(s.line)).length;
    if (w > L.spotLine) out.E('home-spots', at, `the line has ${w} words (max ${L.spotLine})`, `Cut it to ${L.spotLine} words or fewer.`);
    if (!/[.!?]$/.test(plain(s.line).trim())) out.W('body-end', at, 'the line should end with a full stop');
  });
}

function checkDay(story: Story, out: Report, adults: Member[]): void {
  const day = story.family.day!;
  const L = V2_LIMITS;
  if (day.length < L.day.min || day.length > L.day.max) out.E('day', 'family.day', `${day.length} entries (${L.day.min} to ${L.day.max})`);
  const ids = new Map(story.beats.map((b) => [b.id, b]));
  let last = -1;
  day.forEach((d, i) => {
    const at = `family.day${i}`;
    const part = (DAY_PARTS as readonly string[]).indexOf(d.at);
    if (part < 0) out.E('day', at, `"${d.at}" is not a part of the day (${DAY_PARTS.join(', ')})`);
    else { if (part < last) out.E('day', at, `"${d.at}" comes after a later part of the day; the entries run ${DAY_PARTS.join(', ')}`, 'Put the entries in time order.'); last = Math.max(last, part); }
    const b = ids.get(d.beat);
    if (!b) out.E('day', at, `beat "${d.beat}" is not a beat of this story`);
    else {
      const flat = (s: string): string => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (flat(d.line) === flat(b.popup.body) || flat(d.line) === flat(b.popup.title)) out.E('day', at, 'the line repeats the beat\'s own title or body', 'Write a different sentence.');
    }
    const w = words(plain(d.line)).length;
    if (w > L.dayLine) out.E('day', at, `the line has ${w} words (max ${L.dayLine})`, `Cut it to ${L.dayLine} words or fewer.`);
    if (!/[.!?]$/.test(plain(d.line).trim())) out.W('body-end', at, 'the line should end with a full stop');
  });
  const shown = new Set(day.map((d) => ids.get(d.beat)?.member).filter(Boolean) as string[]);
  for (const m of adults) if (!shown.has(m.id)) out.W('day', `member.${m.id}`, `${m.name} is not in the day`, 'Give each adult and teen at least one entry.');
}

export function checkV2(story: Story, ctx: Ctx, out: Report): void {
  const f = story.family;
  const people = new Set<string>([...story.members.map((m) => m.name), ...story.members.flatMap((m) => (m.companion ? [m.companion.name] : [])), f.surname, ...f.surname.split('-')]);
  const names = digitApps(ctx);
  const adults = story.members.filter((m) => m.age >= 13);
  const members = new Map(story.members.map((m) => [m.id, m]));

  // ---- beat.detail
  let anyDetail = false;
  for (const b of story.beats) if (b.detail) { anyDetail = true; checkDetail(ctx, out, b, people); }
  // detail-missing: once a story has started on details, every beat of an adult or teen persona is expected to have one
  if (anyDetail) {
    for (const b of story.beats) {
      const m = b.member ? members.get(b.member) : undefined;
      if (m && m.archetype && m.age >= 13 && !b.detail) out.W('detail-missing', b.id, `${m.name}'s beat has no detail (before, after, steps, fact)`, 'Add a detail so the beat opens up on the family page.');
    }
  }

  // ---- family.home
  if (f.home) checkHome(story, ctx, out);

  // ---- family.day
  if (f.day) checkDay(story, out, adults);

  // ---- member.profile
  for (const m of story.members) {
    if (!m.profile) continue;
    const at = `member ${m.id}.profile`;
    const n = nWords(m.profile.bio);
    if (n > V2_LIMITS.bio) out.E('profile', at, `the bio has ${n} words (max ${V2_LIMITS.bio})`, `Cut it to ${V2_LIMITS.bio} words or fewer.`);
    if (!/[.!?]$/.test(plain(m.profile.bio).trim())) out.W('body-end', at, 'the bio should end with a full stop');
  }

  // ---- the new prose outside a beat: digits (no numbers; the page shows the age and the facts itself) and text-role
  const extra: [string, string][] = [];
  if (f.home) { extra.push(['family.home.lede', f.home.lede]); f.home.spots.forEach((s, i) => extra.push([`family.home.spot${i}`, s.line])); }
  (f.day || []).forEach((d, i) => extra.push([`family.day${i}`, d.line]));
  story.members.forEach((m) => { if (m.profile) extra.push([`member ${m.id}.profile`, m.profile.bio]); });
  for (const [at, s] of extra) if (digits.test(stripDigitApps(plain(s), names))) out.E('digits', at, 'no digits here; the page shows ages, areas and counts itself', 'Spell numbers out, or leave them out.');
  // (the lede and the spot lines were read for text-role in checkHome)
  checkTextRoleStrings(story, ctx, out, extra.filter(([at]) => !at.startsWith('family.home')));
}
