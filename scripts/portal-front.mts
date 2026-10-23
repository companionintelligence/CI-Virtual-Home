// The front page, the Companion Core's lander (reference/story/lander.md; the plan is content/story/lander.json, the logic scripts/story/lib/lander.mts):
// the blocks scripts/build-portal.mts writes into index.html as static HTML (the proof, the Core's picture, the chooser, the family cards, the names of the apps),
// the hero's tour, and the "Meet the family" block on a home's own page. Pure functions of the families the story build found current (scripts/story/site.mts), the
// homes and the plan, so a rebuild is byte-identical and a crawler, a visitor without JavaScript and an in-app browser with a slow script all see everything that
// argues, proves and offers. portal/gallery.js adopts these cards and filters them; it does not draw them again (a checkout served as it is has no families, and
// gallery.js draws the homes as it always did).
//
// Nothing here reads a family that is not current: the build passes `story.built` and the cards, and this reads each of those families' authored file once more
// for what the page needs and the cards' data does not carry (a member's archetype, which beat names which app and its words).
// Third-party software is named in text only: no logo, no screenshot and no count of apps on this page (the family pages keep their labelled real media). The page
// says "alternative to", never "replaces" (reference/story/personas.md rule 2), shows no pair counsel has not cleared (the plan's `hold`), and prints no digit beside
// a service: a count is a word, always next to "fictional". No UI is drawn, no price, no customer.

import fs from 'node:fs';
import path from 'node:path';
import { displayName } from '../assets/home-names.js';
import { esc, nf, MEET_MARKER } from './portal-pages.mts';
import type { House } from './portal-pages.mts';
import { loadCategories } from './story/lib/categories.mts';
import type { Category, TypeFilter } from './story/lib/categories.mts';
import { readPlan, familiesWord } from './story/lib/lander.mts';
import type { LanderData, FamilyLite, StoryFull } from './story/lib/lander.mts';
import { pairLine, findOf } from './story/lib/pairs.mts';
import { uniqueLabels } from './story/pages.mts';
import type { Pair } from './story/lib/pairs.mts';
/**
 * The front page's categories (content/story/categories.json, checked by story:validate): the chips a visitor filters by, each holding the archetypes of
 * content/story/personas.json it stands for. Nothing here is a list in code: add an archetype to personas.json and a category, and the chips, the
 * cards' filter tokens and the picker data follow.
 */
const REPO = path.resolve(import.meta.dirname, '..');
export const CATEGORIES: Category[] = loadCategories(REPO).categories;
/** The second filter, the kind of place (Homes, Apartments, Offices). Data only for now: the markup for it is a later package's. */
export const TYPE_FILTERS: TypeFilter[] = loadCategories(REPO).typeFilters;
/**
 * The jobs a member does on the family's one Companion Core (reference/story/personas.md): one row for each archetype of personas.json, in its order,
 * with the category it is in and the label of that category (the words a visitor would choose to filter by) as `filter`.
 */
export const PERSONAS: { archetype: string; /** the category id */ category: string; filter: string; /** the archetype's own label */ label: string }[] =
  Object.entries(JSON.parse(fs.readFileSync(path.join(REPO, 'content', 'story', 'personas.json'), 'utf8')).archetypes as Record<string, { label: string }>)
    .map(([archetype, def]) => {
      const c = CATEGORIES.find(x => x.personas.includes(archetype));
      if (!c) throw new Error(`portal-front: the archetype ${archetype} is in no category of content/story/categories.json (pnpm run story:validate says so)`);
      return { archetype, category: c.id, filter: c.label, label: def.label };
    });
export type Archetype = string;
const ARCHETYPES: readonly string[] = PERSONAS.map(p => p.archetype);
/** The category id of an archetype ('' for one that is not in personas.json). */
const categoryOf = (archetype: string): string => PERSONAS.find(p => p.archetype === archetype)?.category || '';
/** An archetype's own words, lower case ("organiser", "money keeper"): what a card says under a name. */
const archWord = (archetype: string): string => (PERSONAS.find(p => p.archetype === archetype)?.label || archetype).toLowerCase();
/**
 * What a card's data-persona says (portal/gallery.js filters by it): the archetypes the family has, then the categories they are in. A chip filters by a
 * category and the "Pick a person" cards by an archetype, so a card carries both; no category id is an archetype id (story:validate).
 */
export const filterTokens = (archetypes: readonly string[]): string[] => {
  const cats = new Set(archetypes.map(categoryOf).filter(Boolean));
  return [...archetypes, ...CATEGORIES.map(c => c.id).filter(id => cats.has(id))];
};

/**
 * The homes the cast plan says have no family (yet): house id → why (content/story/cast-plan.json `homesWithoutFamily`; empty since the six
 * apartments were cast on 2026-10-22 and their stories written; a casting family whose story is not written yet is reported by site.mts, and a new
 * kind of home, such as an office, would be listed here).
 * Such a home is a home like any other on the site: a plain card that opens the player, a page of its own, no tour. scripts/story/cast-lint.mts
 * holds the list to the homes, so a home with neither a family nor a line here is the cast's error, not a surprise of the build.
 */
export function homesWithoutFamily(root: string): Record<string, string> {
  const file = path.join(root, 'content', 'story', 'cast-plan.json');
  if (!fs.existsSync(file)) return {};
  try { return (JSON.parse(fs.readFileSync(file, 'utf8')).homesWithoutFamily as Record<string, string>) || {}; } catch { return {}; }
}

/** The hero's tour (content/story/lander.json `hero`): index.html's source says so (a checkout plays the home); the build checks it and points the hero elsewhere when the family is not current. */
export const HERO = readPlan(REPO).hero;

const ROLE_WORD: Record<string, string> = { parent: 'parent', partner: 'partner', 'adult-child': 'adult child', teen: 'teen', child: 'child', baby: 'baby', grandparent: 'grandparent', housemate: 'housemate', visitor: 'visitor' };

export type FrontMember = { name: string; /** the archetype, or '' */ archetype: string; /** what the card says under the name */ word: string };
export type FrontApp = { id: string; name: string; replaces: string };
/**
 * An app a family's moments use, once: `by` the archetypes whose members' moments have it as the beat's `app`, `also` those that only name it as a `with`
 * (background), and what it replaces there (the story's own `replaces`, minus a line the story's copy rules stop).
 */
export type FrontUse = { id: string; name: string; by: string[]; also: string[]; replaces: string[] };
export type FrontFamily = {
  slug: string; house: string; title: string; surname: string; tagline: string; hasTour: boolean;
  members: FrontMember[]; apps: FrontApp[]; /** the archetypes present, in PERSONAS order */ personas: string[];
  /** every app the family's moments name, once each */ use: FrontUse[];
  /** lower-case words the search reads: the family, the people, the jobs, every app and what it replaces */ find: string;
};

// ---------------------------------------------------------------------------------------------------- the data

type CardLike = { slug: string; title: string; tagline: string; apps: { id: string; name: string; replaces: string[] }[]; members: { name: string; role: string }[] };
type BuiltLike = { slug: string; house: string; hasTour: boolean };

/**
 * One FrontFamily per current family, in the order the story gives them (flagship first). `dir` is the families folder the story build
 * read (content/families, or --families). A member's archetype is the family file's own, else the casting's (content/story/casting.json:
 * the older files carry none). The apps that tell the story are one per person, in the order the beats name them: the first app of that
 * person's beats that replaces a cloud service (the uncloud argument), at most four, so a card shows the jobs and not the whole catalog.
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
  // the names of the apps a `with` names (the cards carry the names of the `app`s only)
  const catalogFile = path.join(o.ROOT, 'content', 'story', 'catalog-apps.json');
  const catalogName: Record<string, string> = {};
  if (fs.existsSync(catalogFile)) for (const a of JSON.parse(fs.readFileSync(catalogFile, 'utf8')).apps || []) catalogName[a.id] = a.name;
  const out: FrontFamily[] = [], places: Record<string, string> = {};
  for (const b of o.built) {
    const card = o.cards.find(c => c.slug === b.slug);
    const file = path.join(o.dir, `${b.slug}.json`);
    if (!card || !fs.existsSync(file)) continue;
    const story = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      family: { surname: string; tagline: string; address?: { place?: string } };
      members: { id: string; name: string; role: string; archetype?: string }[];
      beats: { member?: string; app?: { id: string; replaces?: string[] }; with?: string[] }[];
    };
    places[b.slug] = story.family.address?.place || '';
    const cast = casting[b.slug]?.members || [];
    const members: FrontMember[] = story.members.map(m => {
      const c = cast.find(x => (x.id && x.id === m.id) || x.name === m.name);
      const a = ARCHETYPES.includes(m.archetype || '') ? m.archetype! : ARCHETYPES.includes(c?.archetype || '') ? c!.archetype! : '';
      return { name: m.name, archetype: a, word: (a && archWord(a)) || ROLE_WORD[m.role] || m.role };
    });
    const appName = new Map(card.apps.map(a => [a.id, a.name]));
    const apps: FrontApp[] = [];
    for (let i = 0; i < story.members.length && apps.length < 4; i++) {
      const m = story.members[i], pool = pools[members[i].archetype] || [];
      const mine = story.beats.filter(x => x.member === m.id && x.app && (x.app.replaces || []).length && appName.has(x.app.id) && chipOk(appName.get(x.app.id)!, x.app.replaces![0]) && !apps.some(a => a.name === appName.get(x.app!.id)));
      const beat = pool.map(id => mine.find(x => x.app!.id === id)).find(Boolean) || mine[0];   // the first of the person's own apps, in the persona's order
      if (beat) apps.push({ id: beat.app!.id, name: appName.get(beat.app!.id)!, replaces: beat.app!.replaces![0] });
    }
    // every app the moments name, once, with who uses it
    const use = new Map<string, FrontUse>();
    story.beats.forEach(bt => {
      const idx = story.members.findIndex(m => m.id === bt.member), arch = idx >= 0 ? members[idx].archetype : '';
      const add = (id: string, main: boolean, replaces: string[]): void => {
        const u = use.get(id) || { id, name: appName.get(id) || catalogName[id] || id, by: [], also: [], replaces: [] };
        const list = main ? u.by : u.also;
        if (arch && !list.includes(arch)) list.push(arch);
        for (const r of replaces) if (chipOk(u.name, r) && !u.replaces.includes(r)) u.replaces.push(r);
        use.set(id, u);
      };
      if (bt.app) add(bt.app.id, true, bt.app.replaces || []);
      for (const w of bt.with || []) add(w, false, []);
    });
    const jobs = PERSONAS.map(p => p.archetype as string).filter(a => members.some(m => m.archetype === a));
    const find = [card.title, story.family.surname, ...members.flatMap(m => [m.name, m.archetype]), ...card.apps.flatMap(a => [a.name, ...a.replaces])]
      .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    out.push({ slug: b.slug, house: b.house, title: card.title, surname: story.family.surname, tagline: card.tagline, hasTour: b.hasTour, members, apps, personas: jobs, use: [...use.values()], find });
  }
  // a name no other family shares: three homes carry "The Brennan family", so each is told apart by the place of its address (scripts/story/pages.mts uniqueLabels)
  const labels = uniqueLabels(out.map(f => ({ slug: f.slug, title: f.title })), places);
  for (const f of out) f.title = labels[f.slug];
  return out;
}

// ---------------------------------------------------------------------------------------------------- the cards

const initial = (name: string): string => (Array.from(name.trim())[0] || '?').toUpperCase();

/** The current families' authored files, in the story's order (what the lander's plan reads: the pairs, the gate, the proof's words). */
export function readStories(o: { dir: string; built: { slug: string }[] }): StoryFull[] {
  const out: StoryFull[] = [];
  for (const b of o.built) {
    const file = path.join(o.dir, `${b.slug}.json`);
    if (fs.existsSync(file)) out.push(JSON.parse(fs.readFileSync(file, 'utf8')) as StoryFull);
  }
  return out;
}
/** What `computeLander` needs to know of each family. */
export const landerFamilies = (front: FrontFamily[]): FamilyLite[] => front.map((f) => ({ slug: f.slug, house: f.house, surname: f.surname, title: f.title, personas: f.personas }));

type Line = { pair: Pair; shown: boolean };
/**
 * The pair lines each family's card prints, in order. A featured card shows two, chosen across the featured cards so that they differ (the service the
 * fewest cards show so far wins, then the order of the family's beats) with no pair on more than three of them; any other family shows its first two. The
 * rest of a family's cleared pairs follow, hidden, so that a chip for a service can show the card's own pair for it (portal/gallery.js).
 */
export function cardPairs(data: LanderData, slugs: readonly string[], featured: readonly string[]): Map<string, Line[]> {
  const out = new Map<string, Line[]>();
  const svcUsed = new Map<string, number>(), pairUsed = new Map<string, number>();
  const key = (p: Pair): string => `${p.service.id}|${p.app.id}`;
  for (const slug of featured) {
    const mine = data.index.byFamily.get(slug) ?? [];
    const chosen: Pair[] = [];
    while (chosen.length < 2) {
      const left = mine.filter((p) => !chosen.includes(p) && (pairUsed.get(key(p)) ?? 0) < 3);
      if (!left.length) break;
      const best = [...left].sort((a, b) => (svcUsed.get(a.service.id) ?? 0) - (svcUsed.get(b.service.id) ?? 0))[0];   // (a stable sort: ties keep the beats' order)
      chosen.push(best);
      svcUsed.set(best.service.id, (svcUsed.get(best.service.id) ?? 0) + 1);
      pairUsed.set(key(best), (pairUsed.get(key(best)) ?? 0) + 1);
    }
    out.set(slug, [...chosen.map((pair) => ({ pair, shown: true })), ...mine.filter((p) => !chosen.includes(p)).map((pair) => ({ pair, shown: false }))]);
  }
  for (const slug of slugs) if (!out.has(slug)) out.set(slug, (data.index.byFamily.get(slug) ?? []).map((pair, i) => ({ pair, shown: i < 2 })));
  return out;
}

export interface CardOpts { data: LanderData; lines: Line[]; featured: boolean; /** the picture is in the first screens: not lazy */ eager: boolean; /** the hero family's card names the other homes of the same people */ siblings?: FrontFamily[] }
/**
 * A family's card: the home's picture, the family and its home, who lives there (a monogram disc and the job each does), up to two of its pairs in text,
 * and the way in. The link is the family's name (the card is clickable through it, a stretched link), so the text stays a heading and two lists; its page
 * (family/<slug>) goes on to the tour. data-campaign: portal/campaign.js carries an ad's tags on it, so a campaign survives the click. data-persona,
 * data-service, data-type and data-find are what portal/gallery.js filters and searches by (a held pair is in none of them).
 */
export function familyCard(f: FrontFamily, h: House, o: CardOpts): string {
  const name = displayName(h);
  const homeLine = [name, h.areaSqm ? `${nf.format(h.areaSqm)} m²` : ''].filter(Boolean).join(' · ');
  const cast = f.members.map(m => `<li><span class="disc" aria-hidden="true">${esc(initial(m.name))}</span><span class="who"><b>${esc(m.name)}</b><span>${esc(m.word)}</span></span></li>`).join('');
  const lines = o.lines.map(({ pair, shown }) => `<li data-service="${esc(pair.service.id)}"${shown ? '' : ' hidden'}>${esc(pairLine(pair))}</li>`).join('');
  const services = [...new Set(o.lines.map((x) => x.pair.service.id))].join(' ');
  const find = [f.title, f.surname, name, ...f.members.flatMap(m => [m.name, m.word]), findOf(o.data.index, f.slug)].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const sib = o.siblings?.length ? `<p class="siblings">Same people, a different house: ${o.siblings.map((s) => `<a href="./family/${esc(s.slug)}" data-campaign>${esc(s.title)}</a>`).join(', ')}</p>` : '';
  return `<li class="card card-family${o.featured ? ' is-featured' : ''}" data-id="${esc(h.id)}" data-slug="${esc(f.slug)}" data-persona="${esc(filterTokens(f.personas).join(' '))}" data-service="${esc(services)}" data-type="${esc(o.data.types.of[h.id] || 'home')}" data-find="${esc(find)}">`
    + `<div class="thumb"><img src="./portal/thumbs/${esc(encodeURIComponent(h.id))}.webp" alt="" width="640" height="360" decoding="async"${o.eager ? '' : ' loading="lazy"'}>`
    + `<span class="thumb-play"><span>Meet the family</span><svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg></span></div>`
    + `<div class="card-body"><h3><a href="./family/${esc(f.slug)}" data-campaign aria-label="${esc(`${f.title}, in ${name}. Meet the family`)}">${esc(f.title)}</a></h3>`
    + `<p class="home-line">${esc(homeLine)}</p>`
    + `<ul class="cast" aria-label="Who lives here">${cast}</ul>`
    + (lines ? `<ul class="pairs-lines" aria-label="Apps in their story">${lines}</ul>` : '')
    + sib
    + `<p class="go" aria-hidden="true"><span>Meet the family</span><svg class="i"><use href="#i-arrow"/></svg></p></div></li>`;
}

/**
 * The two lists of cards: the featured families' (the plan's six that pass the gate, the hero's first, with the grouped card for the hero's other homes) and
 * everything else: every other family in the story's order, then a plain card for each home with no current family. Nothing is left out; the second list sits
 * in a native <details> that a visitor opens, or that portal/gallery.js opens for any filter.
 */
export function frontCards(houses: House[], families: FrontFamily[], data: LanderData, plain: (rest: House[], types: Record<string, string>) => string): { featured: string; rest: string } {
  const by = new Map(houses.map(h => [h.id, h]));
  const fams = families.filter(f => by.has(f.house));
  const pairs = cardPairs(data, fams.map(f => f.slug), data.featured.slugs);
  const hero = fams.find(f => f.slug === data.plan.hero.slug);
  const make = (f: FrontFamily, featured: boolean, i: number): string => familyCard(f, by.get(f.house)!, {
    data, lines: pairs.get(f.slug) ?? [], featured, eager: featured && i < 2,
    siblings: featured && hero && f.slug === hero.slug ? fams.filter(x => x.surname === hero.surname && x.slug !== hero.slug) : undefined,
  });
  const featured = data.featured.slugs.map(s => fams.find(f => f.slug === s)).filter((f): f is FrontFamily => !!f).map((f, i) => make(f, true, i));
  const rest = fams.filter(f => !data.featured.slugs.includes(f.slug)).map(f => make(f, false, 99));
  const without = houses.filter(h => !families.some(f => f.house === h.id));
  const plainCards = plain(without, data.types.of);
  return { featured: featured.join('\n        '), rest: [...rest, ...(plainCards ? [plainCards] : [])].join('\n        ') };
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

// ---------------------------------------------------------------------------------------------------- the lander's blocks

/** The hero's second line: the families word is the data's ("Thirty fictional families show the service each app is an alternative to."). */
export const heroCount = (families: number): string => `${familiesWord(families)} show the service each app is an alternative to.`;

/**
 * "One pair, in full": the pair counsel has cleared that the plan names first, in the family's own words (the beat's title, its before and its after, its
 * chips and its limit), with a link into the tour at that very moment. Left out, with the reason in the build log, when no candidate may show.
 */
export function proofBlock(data: LanderData, front: FrontFamily[]): string {
  const p = data.proof;
  const f = p && front.find((x) => x.slug === p.slug);
  if (!p || !f) return '';
  const href = `./room-creator.html?mode=view&amp;house=${esc(f.house)}&amp;family=${esc(f.slug)}&amp;beat=${esc(p.beat)}`;
  return `<section class="proof" id="proof" aria-labelledby="proof-title" data-beat="${esc(p.beat)}">
      <p class="proof-eyebrow">One pair, from ${esc(f.title)}</p>
      <h2 id="proof-title">${esc(p.title)}</h2>
      <dl class="proof-pair">
        <div class="proof-before"><dt>Rented before</dt><dd>${esc(p.before)}</dd></div>
        <div class="proof-after"><dt>On the Core now</dt><dd>${esc(p.after)}</dd></div>
      </dl>
      <p class="proof-chips">${p.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</p>
      ${p.note ? `<p class="proof-limit">${esc(p.note)}</p>` : ''}
      <p class="proof-actions"><a class="btn btn-primary" data-cta="tour-proof" data-campaign href="${href}"><svg class="i i-fill" aria-hidden="true"><use href="#i-play"/></svg><span>Watch this moment</span></a><a class="proof-family" data-cta="meet-proof" data-campaign href="./family/${esc(f.slug)}">Meet the family</a></p>
    </section>`;
}

/**
 * The Core's picture in the band: the engine's own stylised Core, day-lit (portal/stage/<house>/core-0-{1200,640}.webp, `pnpm run portal:thumbs -- --stage`), with the
 * line `stylised-art` as its caption. Empty when the frames are not there; the line is then printed with the rest of the band's fine print instead.
 */
export function coreFigure(root: string, house: string, alt: string, caption: string): string {
  const dir = path.join(root, 'portal', 'stage', house);
  if (!fs.existsSync(path.join(dir, 'core-0-1200.webp')) || !fs.existsSync(path.join(dir, 'core-0-640.webp'))) return '';
  const u = (f: string): string => `./portal/stage/${esc(encodeURIComponent(house))}/${f}`;
  return `<figure class="core-fig"><picture><source media="(max-width: 700px)" srcset="${u('core-0-640.webp')}" width="640" height="360"><img src="${u('core-0-1200.webp')}" alt="${esc(alt)}" width="1200" height="675" loading="lazy" decoding="async"></picture><figcaption data-fine="stylised-art">${esc(caption)}</figcaption></figure>`;
}

/**
 * "What do you rent today?": the chooser. One chip for each service in the strip (the service in bold, the app that is an alternative under it, no number: the
 * count is in the accessible name, in words), a chip for each job (a category some family has), a search and, when two kinds of place have homes, a control for
 * the kind of place. All static; portal/gallery.js makes it filter. Without JavaScript the chips read as plain "service, app" lines.
 */
export function swapBlock(data: LanderData, front: FrontFamily[]): string {
  const chips = data.strip.map((c) => `<li><button type="button" class="pair" data-service="${esc(c.service.id)}" data-service-name="${esc(c.service.name)}" data-app-name="${esc(c.app.name)}" aria-pressed="false" disabled aria-label="${esc(`${c.service.name}. ${c.app.name} is an alternative. ${familiesWord(c.families.length)}. Show them.`)}"><b>${esc(c.service.name)}</b><span><svg class="i" aria-hidden="true"><use href="#i-arrow"/></svg>${esc(c.app.name)}</span></button></li>`).join('\n          ');
  const jobs = CATEGORIES.map((c) => ({ c, n: front.filter((f) => f.personas.some((a) => c.personas.includes(a))).length })).filter((x) => x.n > 0)
    .map(({ c, n }) => `<button type="button" class="tag persona" data-persona="${esc(c.id)}" data-label="${esc(c.label)}" aria-pressed="false" disabled aria-label="${esc(`${c.label}, ${familiesWord(n).toLowerCase()}`)}">${esc(c.label)}</button>`).join('\n          ');
  const types = data.types.present.length > 1
    ? `<div class="seg types" id="types" role="group" aria-label="Kind of place"><button type="button" data-type="" aria-pressed="true" disabled aria-label="Any kind of place">Any</button>${data.types.present.map((t) => `<button type="button" data-type="${esc(t)}" aria-pressed="false" disabled>${esc(TYPE_FILTERS.find((x) => x.id === t)?.label || t)}</button>`).join('')}</div>`
    : '';
  return `<section class="swap" id="swap" aria-labelledby="swap-title">
      <h2 id="swap-title">What do you rent today?</h2>
      <p class="swap-lead">Choose a service you rent. Under it is the Companion Hub app that is an alternative.</p>
      <label class="search">
        <svg class="i" aria-hidden="true"><use href="#i-search"/></svg>
        <input type="search" id="q" disabled placeholder="Search a service you want to leave, an app or a family" aria-label="Search the families, services and apps" autocomplete="off" spellcheck="false">
        <kbd aria-hidden="true">/</kbd>
      </label>
      <ul class="pairs" id="pairs" aria-label="Services, and the app that is an alternative to each">
        ${chips}
      </ul>
      <div class="jobs" id="personas" role="group" aria-label="What you do">
        <span class="jobs-label" aria-hidden="true">Or choose by what you do</span>
        ${jobs}
      </div>
      ${types}
      <p class="swap-note" id="swap-note" hidden>Showing the families that moved this one home.</p>
    </section>`;
}

/** Every app the stories name, alphabetical, text only: no logo, no link and no count. For the footer's "Apps named in these stories". */
export function appsNamed(front: FrontFamily[]): string {
  const names = [...new Set(front.flatMap((f) => f.use.map((u) => u.name)))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return `<ul class="apps-named">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
}
