// The front page's story: the family cards that scripts/build-portal.mts writes into index.html as static HTML, the persona filter
// buttons, the hero's tour, and the "Meet the family" block on a home's own page. Pure functions of the families the story build
// found current (scripts/story/site.mts), the homes and the casting, so a rebuild is byte-identical and a crawler, a visitor without
// JavaScript and an in-app browser with a slow script all see the families. portal/gallery.js adopts these cards and filters them;
// it does not draw them again (a checkout served as it is has no families, and gallery.js draws the homes as it always did).
//
// Nothing here reads a family that is not current: the build passes `story.built` and the cards, and this reads each of those families'
// authored file once more for what the cards need and the cards' data does not carry (a member's archetype, which beat names which app).
// Third-party software is always named in text; its real logo (content/story/app-media.json, scripts/story/lib/media.mts) identifies it beside the name, 20 px
// on a card, never alone and never as decoration. The page also carries (story v2, reference/story/story-v2.md): "Pick a person" (an archetype card each for the
// organiser, builder, gamer and learner: a story line, the three apps their families use most, with logos, and the number of families; the maker and the host are
// reached by the filter), the list "Rented before, on the Core now" for the archetype chosen, a wall of the apps the families run (names beside their logos, text only)
// and the band "How it runs" with real, labelled screenshots of Companion Hub and of the Companion account page. All of it is static HTML in the built page, with the
// real media lazy and sized; portal/gallery.js only filters and dims. No UI is drawn; a card says "Fictional family. Real software." nowhere it is not already
// said (the hero's label does), and carries no price and no customer.
import fs from 'node:fs';
import path from 'node:path';
import { displayName } from '../assets/home-names.js';
import { esc, nf, MEET_MARKER } from './portal-pages.mts';
import type { House } from './portal-pages.mts';
import { loadCategories } from './story/lib/categories.mts';
import type { Category, TypeFilter } from './story/lib/categories.mts';
import { appMedia, logoImg, readMedia } from './story/lib/media.mts';
import type { MediaManifest } from './story/lib/media.mts';
import { runsInner, swapHtml, SHOT_DIALOG } from './story/pages.mts';
import type { Swap } from './story/pages.mts';

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

/** The hero's tour: index.html's source has these (a checkout plays the home); the build checks them and points the hero elsewhere when the family is not current. */
export const HERO = { slug: 'brennan', house: 'seraphine' } as const;

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
  const out: FrontFamily[] = [];
  for (const b of o.built) {
    const card = o.cards.find(c => c.slug === b.slug);
    const file = path.join(o.dir, `${b.slug}.json`);
    if (!card || !fs.existsSync(file)) continue;
    const story = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      family: { surname: string; tagline: string };
      members: { id: string; name: string; role: string; archetype?: string }[];
      beats: { member?: string; app?: { id: string; replaces?: string[] }; with?: string[] }[];
    };
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
export function familyCard(f: FrontFamily, h: House, i: number, media: MediaManifest | null = null): string {
  const name = displayName(h), storeys = h.storeys || 1;
  const homeLine = [name, `${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`, h.areaSqm ? `${nf.format(h.areaSqm)} m²` : ''].filter(Boolean).join(' · ');
  const cast = f.members.map(m => `<li><span class="disc" aria-hidden="true">${esc(initial(m.name))}</span><span class="who"><b>${esc(m.name)}</b><span>${esc(m.word)}</span></span></li>`).join('');
  // (story v2: the app's real logo, 20 px, beside its name; the line itself is the same "<app> replaces <service>")
  const apps = f.apps.map(a => `<li>${logoImg(appMedia(media, a.id), { depth: 0, className: 'logo' })}<span><b>${esc(a.name)}</b> replaces ${esc(a.replaces)}</span></li>`).join('');
  return `<li class="card card-family" data-id="${esc(h.id)}" data-slug="${esc(f.slug)}" data-persona="${esc(filterTokens(f.personas).join(' '))}" data-find="${esc(f.find)}">`
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
export function frontCards(houses: House[], families: FrontFamily[], plain: (rest: House[]) => string, media: MediaManifest | null | undefined = undefined): string {
  const by = new Map(houses.map(h => [h.id, h]));
  const m = media === undefined ? readMedia() : media;   // (the build reads the manifest once; a test passes its own, or null for none)
  const cards = families.filter(f => by.has(f.house)).map((f, i) => familyCard(f, by.get(f.house)!, i, m));
  const without = houses.filter(h => !families.some(f => f.house === h.id));
  const rest = plain(without);
  return [...cards, ...(rest ? [rest] : [])].join('\n        ');
}

/**
 * The filter buttons: one for each category some current family has an archetype of (a chip with no family is not drawn), in the categories' order.
 * The button's value is the category id; gallery.js counts the cards that carry it and filters by it.
 */
export function personaButtons(families: FrontFamily[]): string {
  return CATEGORIES.filter(c => families.some(f => f.personas.some(a => c.personas.includes(a))))
    .map(c => `<button type="button" class="tag persona" data-persona="${esc(c.id)}" aria-pressed="false">${esc(c.label)}<small></small></button>`)
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

// ---------------------------------------------------------------------------------------------------- story v2: pick a person, the wall, how it runs

/** The four jobs the front page puts forward, in order; the maker and the host are reached by the filter (PERSONAS) and have a list but no card. */
export const PICK = ['organiser', 'builder', 'gamer', 'learner'] as const;
/** One line each, in the house voice, from reference/story/personas.md (what the archetype does on the family's one Core). */
export const ARCH: Record<string, { name: string; line: string }> = {
  organiser: { name: 'Organiser', line: 'Plans the week, files the paperwork and runs a small business from a home office.' },
  builder: { name: 'Builder', line: 'Writes code on a laptop. The editor, the repositories and a local model run on the Core.' },
  gamer: { name: 'Gamer', line: 'Plays games that run on the Core, on a screen in the house.' },
  learner: { name: 'Learner', line: 'Studies and reads: homework, languages and exams, with tools on the Core.' },
  maker: { name: 'Maker', line: 'Paints, photographs, writes or plays. The creative work lives on the Core.' },
  host: { name: 'Host', line: 'Feeds, waters and tidies the house. The shared lists and photos live on the Core.' },
};
export type Ranked = { id: string; name: string; count: number; replaces: string[] };
export type Fleet = {
  families: number;
  /** by archetype: the families that have one, and the apps their moments use, most used first (a family counts once; ties by name) */
  byArch: Record<string, { families: number; apps: Ranked[] }>;
  /** every app the families' moments name, once, alphabetical by name: who uses it (as the beat's app or as a with) */
  wall: { id: string; name: string; by: string[] }[];
};
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** What the fleet runs, by archetype: the numbers the front page's cards, lists and wall are made of. A pure function of the families. */
export function fleetOf(fams: FrontFamily[]): Fleet {
  const byArch: Fleet['byArch'] = {};
  const wall = new Map<string, { id: string; name: string; by: Set<string> }>();
  const counts: Record<string, Map<string, Ranked>> = {};
  for (const f of fams) {
    for (const a of f.personas) { (byArch[a] ||= { families: 0, apps: [] }).families++; counts[a] ||= new Map(); }
    for (const u of f.use) {
      const w = wall.get(u.id) || { id: u.id, name: u.name, by: new Set<string>() };
      for (const a of [...u.by, ...u.also]) w.by.add(a);
      wall.set(u.id, w);
      for (const a of u.by) {
        const r = counts[a].get(u.id) || { id: u.id, name: u.name, count: 0, replaces: [] };
        r.count++;
        for (const x of u.replaces) if (!r.replaces.includes(x)) r.replaces.push(x);
        counts[a].set(u.id, r);
      }
    }
  }
  for (const a of Object.keys(byArch)) byArch[a].apps = [...counts[a].values()].sort((x, y) => y.count - x.count || byName(x, y));
  return { families: fams.length, byArch, wall: [...wall.values()].sort(byName).map(w => ({ id: w.id, name: w.name, by: [...w.by].sort() })) };
}

/** An archetype's "Rented before, on the Core now": the services its top apps replace in these stories, against those apps. */
export function archSwap(fleet: Fleet, arch: string, n = 8): Swap {
  const top = (fleet.byArch[arch]?.apps || []).slice(0, n);
  const before: string[] = [];
  for (const a of top) for (const r of a.replaces) if (!before.some(x => x.toLowerCase() === r.toLowerCase())) before.push(r);
  return { before: before.slice(0, n), now: top.map(a => ({ id: a.id, name: a.name })) };
}

const appRow = (id: string, name: string, media: MediaManifest | null, cls = 'logo'): string => `${logoImg(appMedia(media, id), { depth: 0, className: cls })}<span>${esc(name)}</span>`;

/**
 * "Pick a person": a card for the organiser, the builder, the gamer and the learner (a story line, the three apps their families use most with their logos, and in how
 * many of the families there is one); choosing one is the persona filter (portal/gallery.js, ?persona=). Under the cards, one list for each archetype that has a family,
 * "Rented before, on the Core now", shown for the archetype chosen (and all of them with JavaScript off, where the cards' buttons are hidden). The cards read as they are
 * with no script; the button is the card's one control (a stretched button, so the card is the target).
 */
export function pickPerson(fams: FrontFamily[], media: MediaManifest | null = null): string {
  const fleet = fleetOf(fams);
  if (!fams.length) return '';
  const total = fams.length;
  const cards = PICK.filter(a => fleet.byArch[a]).map(a => {
    const info = ARCH[a], f = fleet.byArch[a];
    const apps = f.apps.slice(0, 3).map(r => `<li>${appRow(r.id, r.name, media)}</li>`).join('');
    return `<li class="arch" data-persona="${a}">
          <h3>${esc(info.name)}</h3>
          <p class="arch-line">${esc(info.line)}</p>
          ${apps ? `<ul class="arch-apps" aria-label="${esc(`The apps most ${a} families use`)}">${apps}</ul>` : ''}
          <p class="arch-count">In ${f.families} of the ${total === 30 ? 'thirty' : total} fictional families</p>
          <button type="button" class="arch-btn" data-persona="${a}" aria-pressed="false"><span class="arch-off">See the ${esc(a)} families</span><span class="arch-on">Showing the ${esc(a)} families</span></button>
        </li>`;
  }).join('\n        ');
  const panels = PERSONAS.map(p => p.archetype as string).filter(a => fleet.byArch[a]).map(a => {
    const swap = swapHtml(`arch-${a}`, archSwap(fleet, a), media, 0);
    return swap ? `<div class="arch-panel" data-persona="${a}" role="region" aria-label="${esc(`${ARCH[a]?.name ?? PERSONAS.find(p => p.archetype === a)!.label}: rented before, on the Core now`)}">
        <p class="arch-panel-lead">${esc(`The services these ${archWord(a)} families replace, and the apps that do the job.`)}</p>
        ${swap}
      </div>` : '';
  }).join('\n      ');
  return `<section class="pick" id="pick" aria-labelledby="pick-h">
      <div class="pick-head">
        <h2 id="pick-h">Pick a person</h2>
        <p>Every family has people who do different jobs on its one Companion Core. Choose a job to see the families and the apps they run.</p>
      </div>
      <ul class="pick-grid">
        ${cards}
      </ul>
      <div class="arch-panels" id="arch-panels">
      ${panels}
      </div>
    </section>`;
}

/**
 * "What the families run": the apps the stories name, alphabetical, its real logo beside its name. Text only: nothing on the wall links anywhere. portal/gallery.js dims
 * the apps that the archetype chosen does not use (`data-by` lists who does). Empty when the build has no logos to show.
 */
export function logoWall(fams: FrontFamily[], media: MediaManifest | null): string {
  if (!media) return '';
  const wall = fleetOf(fams).wall.filter(w => appMedia(media, w.id)?.logo);
  if (!wall.length) return '';
  return `<section class="wall" id="wall" aria-labelledby="wall-h">
      <h2 id="wall-h">What the families run</h2>
      <p class="wall-lead">These are the apps the stories name. Each one is in the Companion Hub store. Choose a person above to see which of them that person’s families use.</p>
      <ul class="wall-list" id="wall-list">
        ${wall.map(w => `<li class="wall-app" data-by="${esc(w.by.join(' '))}">${appRow(w.id, w.name, media)}</li>`).join('\n        ')}
      </ul>
      <p class="wall-note">Product names and logos belong to their owners. A logo shows which app is named beside it. No endorsement is implied.</p>
    </section>`;
}

/** "How it runs": what Companion Hub and the Companion account do, with a real screenshot of each (labelled). Followed by the dialog a screenshot opens in (portal/shots.js). */
export function runsBand(media: MediaManifest | null): string {
  const inner = runsInner(media, 0, 1);
  return `<section class="runs-band" id="runs" aria-labelledby="runs-h">
      <h2 id="runs-h">How it runs</h2>
      <p class="lead">Two pieces do the work. One runs on the Core. The other keeps track of your devices.</p>
      ${inner}
    </section>
  ${media ? SHOT_DIALOG : ''}`;
}
