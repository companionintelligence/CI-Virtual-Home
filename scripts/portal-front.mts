// The front page's story: the family cards that scripts/build-portal.mts writes into index.html as static HTML, the persona filter
// buttons, the hero's tour, and the "Meet the family" block on a home's own page. Pure functions of the families the story build
// found current (scripts/story/site.mts), the homes and the casting, so a rebuild is byte-identical and a crawler, a visitor without
// JavaScript and an in-app browser with a slow script all see the families. portal/gallery.js adopts these cards and filters them;
// it does not draw them again (a checkout served as it is has no families, and gallery.js draws the homes as it always did).
//
// Nothing here reads a family that is not current: the build passes `story.built` and the cards, and this reads each of those families'
// authored file once more for what the cards need and the cards' data does not carry (a member's archetype, which beat names which app).
// Third-party software is named in text only (never a logo); no UI is drawn; a card says "Fictional family. Real software." nowhere
// it is not already said (the hero's label does), and carries no price and no customer.
import fs from 'node:fs';
import path from 'node:path';
import { displayName } from '../assets/home-names.js';
import { esc, nf, MEET_MARKER } from './portal-pages.mts';
import type { House } from './portal-pages.mts';

/** The jobs a member does on the family's one Companion Core (reference/story/personas.md), with the words a visitor would choose to filter by. */
export const PERSONAS = [
  { archetype: 'organiser', filter: 'Work from home' },
  { archetype: 'builder', filter: 'Code' },
  { archetype: 'gamer', filter: 'Play' },
  { archetype: 'learner', filter: 'Study' },
  { archetype: 'maker', filter: 'Make' },
  { archetype: 'host', filter: 'Host' },
] as const;
export type Archetype = (typeof PERSONAS)[number]['archetype'];
const ARCHETYPES: readonly string[] = PERSONAS.map(p => p.archetype);

/** The hero's tour: index.html's source has these (a checkout plays the home); the build checks them and points the hero elsewhere when the family is not current. */
export const HERO = { slug: 'brennan', house: 'seraphine' } as const;

const ROLE_WORD: Record<string, string> = { parent: 'parent', partner: 'partner', 'adult-child': 'adult child', teen: 'teen', child: 'child', baby: 'baby', grandparent: 'grandparent', housemate: 'housemate', visitor: 'visitor' };

export type FrontMember = { name: string; /** the archetype, or '' */ archetype: string; /** what the card says under the name */ word: string };
export type FrontApp = { name: string; replaces: string };
export type FrontFamily = {
  slug: string; house: string; title: string; surname: string; tagline: string; hasTour: boolean;
  members: FrontMember[]; apps: FrontApp[]; /** the archetypes present, in PERSONAS order */ personas: string[];
  /** lower-case words the search reads: the family, the people, the jobs, every app and what it replaces */ find: string;
};

// ---------------------------------------------------------------------------------------------------- the data

type CardLike = { slug: string; title: string; tagline: string; apps: { id: string; name: string; replaces: string[] }[]; members: { name: string; role: string }[] };
type BuiltLike = { slug: string; house: string; hasTour: boolean };

/**
 * One FrontFamily per current family, in the order the story gives them (flagship first). `dir` is the families folder the story build
 * read (content/families, or --families). A member's archetype is the family file's own, else the casting's (content/story/casting.json:
 * the older files carry none). The apps that tell the story are one per person, in the order the beats name them: the first app of that
 * person's beats that replaces a cloud service (the uncloud argument), at most three, so a card shows the jobs and not the whole catalog.
 */
export function readFamilies(o: { ROOT: string; dir: string; built: BuiltLike[]; cards: CardLike[] }): FrontFamily[] {
  const castingFile = path.join(o.ROOT, 'content', 'story', 'casting.json');
  const casting: Record<string, { members?: { id?: string; name?: string; archetype?: string | null }[] }> = {};
  if (fs.existsSync(castingFile)) for (const f of JSON.parse(fs.readFileSync(castingFile, 'utf8')).families || []) casting[f.slug] = f;
  // each archetype's own apps (content/story/personas.json): the app that tells a person's story is one of theirs, when they have one
  const personasFile = path.join(o.ROOT, 'content', 'story', 'personas.json');
  const pools: Record<string, string[]> = {};
  if (fs.existsSync(personasFile)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(personasFile, 'utf8')).archetypes || {})) pools[k] = (v as { apps?: string[] }).apps || [];
  // a chip line ("Open WebUI replaces ChatGPT") that the story's own copy rules would stop (content/story/claims.json, severity error: cap-parity
  // reads "replaces ChatGPT" as a claim of parity with a hosted model) is not put on a card; another person's app tells the story instead
  const claimsFile = path.join(o.ROOT, 'content', 'story', 'claims.json');
  const rules: RegExp[] = fs.existsSync(claimsFile)
    ? (JSON.parse(fs.readFileSync(claimsFile, 'utf8')).bannedPhrases as { pattern: string; flags?: string; severity: string }[]).filter(b => b.severity === 'error').map(b => new RegExp(b.pattern, b.flags ?? 'i'))
    : [];
  const chipOk = (name: string, replaces: string): boolean => !rules.some(r => r.test(`${name} replaces ${replaces}`));
  const out: FrontFamily[] = [];
  for (const b of o.built) {
    const card = o.cards.find(c => c.slug === b.slug);
    const file = path.join(o.dir, `${b.slug}.json`);
    if (!card || !fs.existsSync(file)) continue;
    const story = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      family: { surname: string; tagline: string };
      members: { id: string; name: string; role: string; archetype?: string }[];
      beats: { member?: string; app?: { id: string; replaces?: string[] } }[];
    };
    const cast = casting[b.slug]?.members || [];
    const members: FrontMember[] = story.members.map(m => {
      const c = cast.find(x => (x.id && x.id === m.id) || x.name === m.name);
      const a = ARCHETYPES.includes(m.archetype || '') ? m.archetype! : ARCHETYPES.includes(c?.archetype || '') ? c!.archetype! : '';
      return { name: m.name, archetype: a, word: a || ROLE_WORD[m.role] || m.role };
    });
    const appName = new Map(card.apps.map(a => [a.id, a.name]));
    const apps: FrontApp[] = [];
    for (let i = 0; i < story.members.length && apps.length < 3; i++) {
      const m = story.members[i], pool = pools[members[i].archetype] || [];
      const mine = story.beats.filter(x => x.member === m.id && x.app && (x.app.replaces || []).length && appName.has(x.app.id) && chipOk(appName.get(x.app.id)!, x.app.replaces![0]) && !apps.some(a => a.name === appName.get(x.app!.id)));
      const beat = pool.map(id => mine.find(x => x.app!.id === id)).find(Boolean) || mine[0];   // the first of the person's own apps, in the persona's order
      if (beat) apps.push({ name: appName.get(beat.app!.id)!, replaces: beat.app!.replaces![0] });
    }
    const jobs = PERSONAS.map(p => p.archetype as string).filter(a => members.some(m => m.archetype === a));
    const find = [card.title, story.family.surname, ...members.flatMap(m => [m.name, m.archetype]), ...card.apps.flatMap(a => [a.name, ...a.replaces])]
      .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    out.push({ slug: b.slug, house: b.house, title: card.title, surname: story.family.surname, tagline: card.tagline, hasTour: b.hasTour, members, apps, personas: jobs, find });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------- the cards

const initial = (name: string): string => (Array.from(name.trim())[0] || '?').toUpperCase();

/**
 * A family's card: the home's picture, the family and its home, who lives there (a monogram disc and the job each does), the apps that
 * tell the story and the way in. The link is the family's name (the card is clickable through it, a stretched link), so the text stays
 * a heading, a list and a list; its page (family/<slug>) goes on to the tour. data-campaign: portal/campaign.js carries an ad's tags
 * on it, so a campaign survives the click. data-persona and data-find are what portal/gallery.js filters and searches by.
 */
export function familyCard(f: FrontFamily, h: House, i: number): string {
  const name = displayName(h), storeys = h.storeys || 1;
  const homeLine = [name, `${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`, h.areaSqm ? `${nf.format(h.areaSqm)} m²` : ''].filter(Boolean).join(' · ');
  const cast = f.members.map(m => `<li><span class="disc" aria-hidden="true">${esc(initial(m.name))}</span><span class="who"><b>${esc(m.name)}</b><span>${esc(m.word)}</span></span></li>`).join('');
  const apps = f.apps.map(a => `<li><b>${esc(a.name)}</b> replaces ${esc(a.replaces)}</li>`).join('');
  return `<li class="card card-family" data-id="${esc(h.id)}" data-slug="${esc(f.slug)}" data-persona="${esc(f.personas.join(' '))}" data-find="${esc(f.find)}">`
    + `<div class="thumb"><img src="./portal/thumbs/${esc(encodeURIComponent(h.id))}.webp" alt="" width="640" height="360" decoding="async"${i > 5 ? ' loading="lazy"' : ''}>`
    + `<span class="thumb-play"><svg class="i i-fill"><use href="#i-play"/></svg>Take the tour</span></div>`
    + `<div class="card-body"><h3><a href="./family/${esc(f.slug)}" data-campaign aria-label="${esc(`${f.title}, in ${name}. Take the tour`)}">${esc(f.title)}</a></h3>`
    + `<p class="home-line">${esc(homeLine)}</p>`
    + `<ul class="cast" aria-label="Who lives here">${cast}</ul>`
    + (apps ? `<ul class="apps" aria-label="Apps in their story">${apps}</ul>` : '')
    + `<p class="go" aria-hidden="true"><span>Take the tour</span><svg class="i"><use href="#i-arrow"/></svg></p></div></li>`;
}

/**
 * The grid's list items: every current family's card in the story's order, then a card for each home with no current family (a stale
 * or missing family: the home shows as it did, linking its own page here and the player once gallery.js has run).
 */
export function frontCards(houses: House[], families: FrontFamily[], plain: (rest: House[]) => string): string {
  const by = new Map(houses.map(h => [h.id, h]));
  const cards = families.filter(f => by.has(f.house)).map((f, i) => familyCard(f, by.get(f.house)!, i));
  const without = houses.filter(h => !families.some(f => f.house === h.id));
  const rest = plain(without);
  return [...cards, ...(rest ? [rest] : [])].join('\n        ');
}

/** The persona buttons: one for each job some current family does, in PERSONAS order. gallery.js counts them against the other filters. */
export function personaButtons(families: FrontFamily[]): string {
  return PERSONAS.filter(p => families.some(f => f.personas.includes(p.archetype)))
    .map(p => `<button type="button" class="tag persona" data-persona="${p.archetype}" aria-pressed="false">${esc(p.filter)}<small></small></button>`)
    .join('\n        ');
}

// ---------------------------------------------------------------------------------------------------- a home's page

/** The block on homes/<id> when a current family lives there. It replaces MEET_MARKER (portal-pages.mts, homePage). */
export { MEET_MARKER };
export function meetFamily(f: FrontFamily): string {
  const cast = f.members.map(m => m.name);
  const names = cast.length > 1 ? `${cast.slice(0, -1).join(', ')} and ${cast[cast.length - 1]}` : cast[0] || '';
  return `<section class="family-block" aria-labelledby="family-title">
      <h2 id="family-title">Meet the family</h2>
      <p>${esc(f.title)} lives here: ${esc(names)}. ${esc(f.tagline)}</p>
      <p class="fiction-label">Fictional family. Real software.</p>
      <div class="hero-cta"><a class="btn btn-primary" href="../family/${esc(f.slug)}" data-campaign><span>Meet the ${esc(f.surname)} family</span><svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg></a></div>
    </section>`;
}
