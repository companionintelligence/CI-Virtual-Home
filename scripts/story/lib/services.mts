// Story v3 rules that read the registry of replaced services (content/story/services.json) and the shape of a v3 family
// (reference/story/story-v3.md; rule table in reference/story/validator.md "Story v3").
//
//   service-unknown   the beat's `service` is not an id of the registry
//   service-app       app.replaces[0] is not the service's name or an alias, or the catalog entry does not list that name, or the registry does not list the app
//   service-status    the service is flagged stale or story-excluded, or its "alternative to" form is blocked
//   service-missing   app.replaces is not empty and the beat has no service, or the beat has a service and app.replaces is empty
//   household-beats   too many room beats without a member (6; 8 when the family has two members)
//   household-kind    two household beats of one kind (one calendar, one notes app, one burn-after-reading note, one reader, one DNS filter)
//   household-doer    a beat without a member that has a member as the subject of its title or body, or an agent
//   persona-band      a member has too few or too many beats for the household
//   pair-share        fewer than 80 percent of the room beats, or of the third-party persona beats, carry a service
//   pair-budget       more than 20 percent of the room beats carry no service
//
// Severity follows v3Severity (v3.mts): an error in a v3 family (a beat has a `service`), a warning in every other family, so the thirty
// families written before v3 stay valid until each is rewritten. service-unknown, service-app and service-status can only fire in a v3 family
// (they read a beat's `service`) and are errors. In a family that is not v3 a rule that would fire on many beats reports once, with the count.
// `chips` and `chips-legacy` are in apps.mts, `detail-replaces` in v2.mts; both read the helpers here.
import { FIRST_PARTY, type Beat, type Member, type Story } from '../../../assets/story/types.ts';
import type { Ctx, Service } from './context.mts';
import type { Report } from './report.mts';
import { plain } from './text.mts';
import { isV3Story, v3Severity } from './v3.mts';

export const PAIR = { shareMin: 0.8, budgetMax: 0.2 } as const;
/** Room beats without a member: at most 6, or 8 when the family has two members. */
export const HOUSEHOLD_MAX = { default: 6, couple: 8 } as const;
/** Beats per member (`member` only), by who the member is and how many people live in the home. */
export const BANDS = {
  baby: { min: 1, max: 3 },
  child: { min: 3, max: 7 },                       // under 13
  family4: { min: 4, max: 7 }, businessOrganiser: { min: 4, max: 8 },
  family3: { min: 8, max: 11 },
  family2: { min: 10, max: 12 },
} as const;

const FIRST_PARTY_IDS = new Set<string>(FIRST_PARTY);
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (n: string): string => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();

/** The service a name (or an alias, or a name without its bracket) belongs to; undefined when it is none. */
export const resolveService = (ctx: Ctx, name: string): Service | undefined => ctx.services.byName.get(name.toLowerCase()) ?? ctx.services.byName.get(clean(name).toLowerCase());

/**
 * The names the second chip may print after "alternative to " for a beat's service: the registry name, or the alias that `app.replaces[0]`
 * uses (the catalog spells a few as "GitLab (SaaS)"). The first is the one to write.
 */
export function pairNames(b: Beat, svc: Service, ctx: Ctx): string[] {
  const first = b.app?.replaces?.[0];
  return first && first !== svc.name && ctx.services.byName.get(first.toLowerCase()) === svc ? [svc.name, first] : [svc.name];
}

/** The room beats: every beat outside the first (ftue) and the last (outro) chapter. */
export const roomBeats = (story: Story): Beat[] => story.beats.filter((b) => b.chapter !== story.chapters[0].id && b.chapter !== story.chapters[story.chapters.length - 1].id);

interface Hit { at: string; message: string; fix?: string }
/** An error per hit in a v3 family; one warning with the count elsewhere. */
function phased(out: Report, story: Story, rule: string, hits: Hit[], whole: string): void {
  if (!hits.length) return;
  if (isV3Story(story)) { for (const h of hits) out.E(rule, h.at, h.message, h.fix); return; }
  const shown = hits.slice(0, 4).map((h) => h.at).join(', ');
  out.W(rule, hits[0].at, `${hits.length} beat${hits.length === 1 ? '' : 's'} ${whole} (${shown}${hits.length > 4 ? ', ...' : ''}); an error once the family is told in the v3 shape (a beat has a \`service\`)`, hits[0].fix);
}

// ---- service-unknown, service-app, service-status, service-missing --------------------------------------------------------
function checkPairs(story: Story, ctx: Ctx, out: Report): void {
  const missing: Hit[] = [];
  for (const b of story.beats) {
    const replaces = b.app?.replaces ?? [];
    if (b.service === undefined) {
      if (replaces.length) missing.push({ at: b.id, message: `app.replaces names ${replaces[0]} and the beat has no service`, fix: `Set "service" to the registry id of ${replaces[0]} (content/story/services.json), or make the beat pair-less with an empty app.replaces.` });
      continue;
    }
    const svc = ctx.services.byId.get(b.service);
    if (!svc) { out.E('service-unknown', b.id, `service "${b.service}" is not in content/story/services.json`, 'Use an id of the registry exactly as it is written there.'); continue; }
    if (!replaces.length) out.E('service-missing', b.id, 'the beat has a service and app.replaces is empty', 'app.replaces[0] is the service\'s name or one of its aliases.');
    if (svc.flags.includes('stale') || svc.flags.includes('story-excluded')) out.E('service-status', b.id, `${svc.name} is flagged ${svc.flags.filter((f) => f === 'stale' || f === 'story-excluded').join(' and ')} in the registry`, 'Choose another service (or another app) for this beat; a stale or excluded service is never named.');
    if (svc.alternativeToForm === 'blocked') out.E('service-status', b.id, `"alternative to ${svc.name}" is blocked by the claims rules`, 'Choose another service for this beat.');
    if (!b.app) { out.E('service-app', b.id, 'the beat has a service and no app', 'A pair is an app and the service it is the alternative to.'); continue; }
    const first = replaces[0];
    if (!first) continue;
    const named = resolveService(ctx, first);
    if (named?.id !== svc.id) { out.E('service-app', b.id, `app.replaces[0] is "${first}", which is not the name or an alias of ${svc.name}`, `Write "${svc.name}" first in app.replaces.`); continue; }
    const app = ctx.apps.get(b.app.id);
    if (app && !app.replaces.some((r) => r.toLowerCase() === first.toLowerCase())) out.E('service-app', b.id, `${app.name} does not list "${first}" in replaces in the catalog`, `The catalog lists: ${app.replaces.join(', ') || 'nothing'}.`);
    else if (app && !svc.apps.includes(app.id)) out.E('service-app', b.id, `the registry does not list ${app.name} as an alternative to ${svc.name}`, 'Run pnpm run story:services to regenerate the registry from the catalog.');
  }
  phased(out, story, 'service-missing', missing, 'have app.replaces and no service');
}

// ---- household beats ------------------------------------------------------------------------------------------------------
/** App ids that do one job in a house: a household has one of a kind (the kinds the household beats can clash on). */
export const HOUSEHOLD_KINDS: Record<string, string[]> = {
  transfer: ['pairdrop', 'dropgate', 'pingvin-share', 'hermitstash'], 'burn-after-reading note': ['cryptgeon', 'enclosed', 'privatebin'],
  calendar: ['radicale', 'baikal', 'nextcloud', 'ci-planning', 'yuvomi', 'homehub'], 'notes app': ['memos', 'blinko', 'joplin', 'obsidian'],
  board: ['planka', 'jotty', 'taiga', 'openproject', 'leantime'], tasks: ['vikunja', 'super-productivity', 'yuvomi', 'homehub'],
  chores: ['donetick', 'habitica', 'homehub', 'yuvomi'], pad: ['etherpad', 'ethercalc', 'cryptpad'],
  list: ['grocy', 'mealie', 'tandoor', 'kitchenowl', 'homehub', 'yuvomi'], music: ['mstream', 'navidrome'],
  'start page': ['thinkdashboard', 'homarr', 'heimdall', 'glasshome'], route: ['wanderer', 'trip', 'adventurelog', 'endurain'],
  reader: ['freshrss', 'miniflux', 'readeck', 'linkwarden', 'karakeep'], draw: ['excalidraw', 'tldraw', 'drawio', 'penpot', 'mindmap'],
  books: ['calibre-web', 'booklore', 'koodo-reader', 'komga'], pdf: ['bentopdf', 'stirling-pdf'], wiki: ['bookstack', 'wikijs'],
  papers: ['papra', 'paperless'], trips: ['airtrail', 'trip', 'adventurelog'], party: ['razzia', 'beatsync'], 'watch history': ['scrob', 'yamtrack'],
  album: ['photoprism', 'librephotos', 'photoview', 'immich', 'foldergram'], 'DNS filter': ['adguardhome', 'pi-hole'], 'password vault': ['teampass', 'vaultwarden'],
  budget: ['firefly-iii', 'monetr', 'akaunting'], images: ['mazanoke', 'vert'], crm: ['twenty', 'espocrm'],
};

function checkHousehold(story: Story, ctx: Ctx, out: Report, members: Map<string, Member>): void {
  const room = roomBeats(story);
  const household = room.filter((b) => !b.member);
  const max = story.members.length === 2 ? HOUSEHOLD_MAX.couple : HOUSEHOLD_MAX.default;
  if (household.length > max) {
    const sev = v3Severity(story);
    out.add(sev, 'household-beats', 'beats', `${household.length} room beats have no member (at most ${max}${story.members.length === 2 ? ' for a family of two' : ''})`, 'A beat about one person\'s work is that person\'s: give it a member.');
  }
  // one app of a kind per household
  const byKind = new Map<string, string[]>();
  for (const b of household) {
    if (!b.app) continue;
    for (const [kind, ids] of Object.entries(HOUSEHOLD_KINDS)) if (ids.includes(b.app.id)) byKind.set(kind, [...(byKind.get(kind) ?? []), b.id]);
  }
  for (const [kind, beats] of byKind) if (beats.length > 1) out.W('household-kind', beats[1], `${beats.length} household beats are about one ${kind} (${beats.join(', ')})`, 'A household has one app of a kind: keep one beat and give the other a different job.');

  // a household beat names no member as the doer, and has no agent
  const hits: Hit[] = [];
  for (const b of household) {
    if (b.agent) hits.push({ at: b.id, message: 'a beat with an agent belongs to a member (it has no member)', fix: 'Give the beat a member, the person whose agent acts.' });
    const text = [['title', b.popup.title], ['body', b.popup.body]] as const;
    for (const m of members.values()) {
      const re = new RegExp(`(?<![\\w'-])${escapeRe(m.name)}(?![\\w-])`, 'g');
      for (const [field, raw] of text) {
        const t = plain(raw);
        for (const mt of t.matchAll(re)) {
          const before = t.slice(0, mt.index);
          const after = t.slice(mt.index! + mt[0].length);
          if (/\bof\s+$/i.test(before) || /^'s\b/.test(after)) continue;        // a possessor ("Samir's van") or "of Samir" is not the doer
          hits.push({ at: `${b.id}.${field}`, message: `a household beat names ${m.name} as its subject (a beat about one person's work is that person's)`, fix: 'Give the beat a member, or make the household, the business or the thing the subject ("The practice logs the week\'s hours").' });
        }
      }
    }
  }
  phased(out, story, 'household-doer', hits, 'without a member name a member as the doer');
}

// ---- persona bands and the pair share -------------------------------------------------------------------------------------
function checkBands(story: Story, out: Report): void {
  const sev = v3Severity(story);
  const n = story.members.length;
  for (const m of story.members) {
    const have = story.beats.filter((b) => b.member === m.id).length;
    let band: { min: number; max: number }; let who: string;
    if (m.role === 'baby') { band = BANDS.baby; who = 'a baby'; }
    else if (m.age < 13) { band = BANDS.child; who = 'a child under 13'; }
    else if (n >= 4) { const bo = story.family.business && m.archetype === 'organiser'; band = bo ? BANDS.businessOrganiser : BANDS.family4; who = bo ? 'a business organiser in a family of four or more' : 'an adult or teen in a family of four or more'; }
    else if (n === 3) { band = BANDS.family3; who = 'an adult or teen in a family of three'; }
    else { band = BANDS.family2; who = 'an adult or teen in a family of two'; }
    if (have < band.min || have > band.max) out.add(sev, 'persona-band', `member.${m.id}`, `${m.name} has ${have} beat${have === 1 ? '' : 's'}; ${who} has ${band.min} to ${band.max}`, have < band.min ? `Give ${m.name} ${band.min - have} more beat${band.min - have === 1 ? '' : 's'} of their own.` : `Move ${have - band.max} of ${m.name}'s beats to another member or to the household.`);
  }
}

const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`;
function checkPairShare(story: Story, ctx: Ctx, out: Report): void {
  const sev = v3Severity(story);
  const room = roomBeats(story);
  if (!room.length) return;
  const paired = room.filter((b) => b.service !== undefined);
  const roomShare = paired.length / room.length;
  const persona = room.filter((b) => b.member && b.app && !FIRST_PARTY_IDS.has(b.app.id));
  const personaPaired = persona.filter((b) => b.service !== undefined);
  const personaShare = persona.length ? personaPaired.length / persona.length : 1;
  out.stats.pairShare = Math.round(roomShare * 1000) / 1000;
  out.stats.personaPairShare = Math.round(personaShare * 1000) / 1000;
  out.stats.services = [...new Set(story.beats.flatMap((b) => (b.service ? [b.service] : [])))].sort();
  if (roomShare < PAIR.shareMin) out.add(sev, 'pair-share', 'beats', `${paired.length} of ${room.length} room beats (${pct(roomShare)}) carry a service (at least ${pct(PAIR.shareMin)})`, 'Give a service to the beats whose app is the alternative to one; keep the first-party agents and games pair-less.');
  if (persona.length && personaShare < PAIR.shareMin) out.add(sev, 'pair-share', 'persona', `${personaPaired.length} of ${persona.length} third-party persona beats (${pct(personaShare)}) carry a service (at least ${pct(PAIR.shareMin)})`, 'A person\'s beat on a third-party app names the service it is the alternative to.');
  const bare = room.length - paired.length;
  if (bare / room.length > PAIR.budgetMax) out.add(sev, 'pair-budget', 'beats', `${bare} of ${room.length} room beats (${pct(bare / room.length)}) carry no service (at most ${pct(PAIR.budgetMax)})`, 'First-party agents and games are pair-less by nature; every other beat names its service.');
  void ctx;
}

export function checkServices(story: Story, ctx: Ctx, out: Report, members: Map<string, Member>): void {
  checkPairs(story, ctx, out);
  checkHousehold(story, ctx, out, members);
  checkBands(story, out);
  checkPairShare(story, ctx, out);
}
