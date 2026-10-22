// The HTML the story build writes: a family's page, which is the landing page for that household. It shares its chrome with the homes' own
// pages (the four company links, the privacy and terms links, the footer). Pure functions of the data; scripts/story/site.mts calls them.
// Every string a visitor reads is in the Uncloud voice (no dashes, sentence case headings) and every claim is on the fact sheet, in
// claims.json or in the family's own file; scripts/story/check-copy.mts lints the built pages.
//
// THE PAGE (an ad's landing page: it reads with no JavaScript and no WebGL, in an in-app browser too; the tour is an enhancement):
//   above the fold   the family's name, the tagline, a picture of the home, "Take the tour" (the player) and "See Companion Core"
//                    (https://ci.computer/core, awareness, not "Buy"), one honest line about the 3D, the label ("Fictional family. Real software.") once as the
//                    header's chip and the beta line as a compact strip. The rest of the fine print claims.json asks for is the footer's, and every line of
//                    it comes from scripts/story/lib/fine-print.mts (the rule table is assets/story/fine-print.ts; reference/story/fine-print.md)
//   the family       one section per person (id = the member's id, so family/<slug>#sally is a link): who they are, the archetype word, the
//                    room they use, their moments (title, words, the apps with what each replaces, "Watch this moment" into the tour at
//                    that beat) and "Start with <name>" (the tour at the first beat of their room)
//   a day            (story v2) family.day as a vertical timeline: the part of the day, the person, the line, a link to the moment
//   the home         (story v2 + the spec) the lede, a block for each spot, the storeys, the area and the rooms from the spec, and the schematic
//                    floor plan with a pin for each person (scripts/story/lib/plan-map.mts)
//   the Core         the distinct apps, each with its real logo, what it replaces and its Companion Hub store page
//   how it runs      real, labelled screenshots of Companion Hub and of the Companion account page, and what each does
//   the close        how the Core starts, the next family, the one call to action
// Each person's section also carries (story v2): their bio, the card "Rented before, on the Core now" (the services their moments replace against the
// apps that do the job, with the apps' real logos), a "More about this moment" disclosure on each moment (the beat's `detail`) and a strip of up to three
// real screenshots of their apps, each opening larger in a native <dialog> (portal/family.js). All of it is static HTML: a visitor without JavaScript reads
// every word, and a screenshot is then a link to the picture itself. Logos and screenshots are the real, unedited, labelled files of
// content/story/app-media.json (scripts/story/lib/media.mts): lazy, with their width and height, the alt text and the caption the manifest holds.
// The ad rules bind it (CI-Common ADS.md section 9 and "Still absolute", reference/story/personas.md "Ads"): the label, no UI mockup or
// invented app screen, nobody a customer, daylight and warm light only, the beta line, no price, third-party software always named in text (its real
// logo identifies it beside the name, never alone; a real, unedited screenshot sits beside the story with its label, never inside a scene).
//
// A family page obeys the homes' pages' rules (scripts/build-portal.mts step 7 holds it to them): relative URLs, links without ".html",
// one <h1> and one <main>, a title of at most 60 characters (and unique) and a description of at most 160, the four links and privacy and
// terms, data-cfasync="false" on every script. The chrome keeps the site's labels (Buy Companion Core, Download Companion); the story's
// own calls to action say "See Companion Core". Its fine print names the home it is set in, by its display name (assets/home-names.ts
// displayName), and links the home's own page (homes/<id>); it carries no credit and no builder. The story's own copy never names a home or a
// builder (the validator and scripts/story/check-leaks.mts); that line is the one place that names a home.
//
// The salvage's landing, credits page and sitemap writers (a families-first front page) are NOT here: git show
// origin/salvage/2026-10-03-feat-story-site:scripts/story/pages.mts has them.
import type { Story, Beat, Member, CastingFamily } from '../../assets/story/types.ts';
import { FICTIONAL_LINE, BETA_LINE, SIGNOFF } from '../../assets/story/types.ts';
import { memberChapter } from '../../assets/story/url.ts';
import { displayName } from '../../assets/home-names.js';
import { LINKS, SITE_NAME, TITLE_MAX, TWITTER_SITE, ldScript, nf, orgLd, siteLd } from '../portal-pages.mts';
import type { House } from '../portal-pages.mts';
import type { Loaded, Card } from './site-lib.mts';
import { esc, addressLine, disclosure } from './site-lib.mts';
import type { MediaManifest, MediaShot, CiShot } from './lib/media.mts';
import { appMedia, ciShots, imageTag, logoImg, mediaUrl } from './lib/media.mts';
import { finePrintHtml, finePrintItems } from './lib/fine-print.mts';
import type { Facts } from './lib/fine-print.mts';
import { readPlan, placePins, levelSvg, aspect, roomLabel } from './lib/plan-map.mts';

export const PRODUCT = 'Companion Core';
export const HUB_URL = 'https://hub.ci.computer/store';
// The store lists these two as first party, but the project is someone else's: the apps list says whose it is, in the sanctioned attribution words (claims.json `attribution-agents`: Hermes is from Nous Research, OpenClaw is from the OpenClaw Foundation), not "First party". ("Companion Hub" beside the note on open-source projects would also break cap-open-source-companion.)
const UPSTREAM: Record<string, string> = { 'ci-hermes': 'From Nous Research', 'ci-openclaw': 'From the OpenClaw Foundation' };
/** the one honest line next to the tour button: what the tour is made of (it is drawn in the visitor's browser, so it needs WebGL; the page does not) */
export const TOUR_NOTE = 'The tour draws the home in 3D in your browser.';

const MEMBER_ROLE: Record<string, string> = { parent: 'Parent', partner: 'Partner', 'adult-child': 'Adult child', teen: 'Teen', child: 'Child', baby: 'Baby', grandparent: 'Grandparent', housemate: 'Housemate', visitor: 'Visitor' };
const capitalise = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

// Lucide path data (ISC, see THIRD_PARTY.md), the subset the static pages use.
const SPRITE: Record<string, string> = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
};
export function sprite(ids: string[]): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${ids.map(i => `<symbol id="i-${i}" viewBox="0 0 24 24">${SPRITE[i]}</symbol>`).join('')}</defs></svg>`;
}
export const icon = (name: string, cls = ''): string => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Keep a catalog sentence out of the page when it breaks a copy rule (the catalog is not written in our voice). */
export function plainCatalog(text: string | undefined, rules: RegExp[]): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return rules.some(r => r.test(t)) ? '' : t;
}
export function errorRules(claims: any): RegExp[] {
  return (claims.bannedPhrases as { pattern: string; flags?: string; severity: string }[]).filter(b => b.severity === 'error').map(b => new RegExp(b.pattern, b.flags ?? 'i'));
}

// ---------------------------------------------------------------------------------------------------- chrome (the page sits in family/, so ../ is the site's root)
const rel = '../';
/** The site's header: the logo lockup (the main site's link), "Virtual homes" (this site's top) and the page links; the chrome keeps the site's labels on every page (Buy Companion Core, Download Companion); the story's own "See Companion Core" is the hero's and the close's. */
export function header(): string {
  return `<a class="skip" href="#main">Skip to the family</a>
  <header class="site-head">
    <div class="brand">
      <a class="brand-ci" href="${LINKS.site}" aria-label="${SITE_NAME}"><picture><source srcset="${rel}assets/brand/ci-logo-white-banner.svg" media="(prefers-color-scheme: dark)"><img class="brand-logo" src="${rel}assets/brand/ci-logo-black-banner.svg" alt="" width="151" height="48"></picture></a>
      <span class="brand-sep" aria-hidden="true"></span>
      <a class="brand-title" href="${rel}">Virtual homes</a>
    </div>
    <nav class="site-nav" aria-label="Site" id="site-nav">
      <a href="${rel}#homes">Homes</a>
      <a href="${LINKS.docs}">Docs</a>
      <a href="${LINKS.download}">Download Companion</a>
      <a class="nav-buy" href="${LINKS.core}">Buy ${PRODUCT}</a>
    </nav>
    <button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon('menu')}</button>
  </header>`;
}

/** The home a family lives in: a fine-print line that names it by its display name (assets/home-names.ts) and links its page. No credit, no builder. */
export function homeNote(h: House): string {
  return `<p class="home-note">The home is <a href="${rel}homes/${esc(encodeURIComponent(h.id))}">${esc(displayName(h))}</a>.</p>`;
}

/**
 * Until scripts/story/check-copy.mts asks for claims.json's `beta-short` instead of the OS-only line (its `must(BETA_LINE)`), the footer keeps that line too, so the
 * copy lint stays green. Set to false (and delete the line it prints) in the commit that moves the lint: the footer then says the beta once, in `beta-full`.
 */
export const LEGACY_BETA_LINE = true;

/**
 * The footer's fine print: what claims.json's `where` puts in "the footer" of a family page, from scripts/story/lib/fine-print.mts (the 'family-footer' surface).
 * `agents`: a member's companion is named on the page (attribution-agents, not-frontier); `narration`: the tour has a voice (synthetic-voice); `logos`: the page shows an
 * app's logo (names-logos-owners, which stands with names-owners until the pages say "alternative to").
 */
export function footer(claims: any, house: House, o: { agents?: boolean; narration?: boolean; logos?: boolean } = {}): string {
  // (site-practises, "no third-party requests, no cookies, no analytics", is not said here: the deployed site adds Google Analytics, so the line would be false there)
  const facts: Facts = { agents: !!o.agents, narration: !!o.narration, logos: !!o.logos };
  return `<footer class="site-foot">
    <div class="foot-grid">
      <div>
        <p class="foot-brand"><img src="${rel}assets/brand/ci-logo-mark.svg" alt="" width="20" height="20"><b>${SITE_NAME}</b></p>
        <nav class="foot-links" aria-label="${SITE_NAME}">
          <a href="${LINKS.site}">ci.computer</a>
          <a href="${LINKS.core}">Buy ${PRODUCT}</a>
          <a href="${LINKS.download}">Download Companion</a>
          <a href="${LINKS.docs}">Docs</a>
          <a href="${HUB_URL}">Companion Hub store</a>
          <a href="${LINKS.privacy}">Privacy</a>
          <a href="${LINKS.terms}">Terms</a>
        </nav>
      </div>
      <div class="foot-notes">
        <p><b>${esc(FICTIONAL_LINE)}</b> The families on this site are made up. They are not customers.</p>
        ${LEGACY_BETA_LINE ? `<p>${esc(BETA_LINE)}</p>` : ''}
        ${finePrintHtml(finePrintItems('family-footer', facts, claims))}
      </div>
    </div>
    ${homeNote(house)}
    <p class="legal">© 2026 LifeScope Inc., DBA Companion Intelligence.</p>
  </footer>`;
}

// ---------------------------------------------------------------------------------------------------- the family page
/** What a search result and a link preview show: the family, the site's section and the brand; a name too long for all three keeps the first two, then the first alone. */
export function familyPageTitle(title: string): string {
  return [`${title} · Virtual homes · ${SITE_NAME}`, `${title} · Virtual homes`].find(t => t.length <= TITLE_MAX) || title;
}
/** The tagline and the label, under 160 characters (a long tagline is cut at a word and says so with an ellipsis). */
export function familyDescription(tagline: string): string {
  const room = 155 - FICTIONAL_LINE.length - 1;
  const t = tagline.replace(/\s+/g, ' ').trim();
  return `${t.length > room ? `${t.slice(0, room - 1).replace(/\s+\S*$/, '')}…` : t} ${FICTIONAL_LINE}`;
}
export const familyUrl = (site: string, slug: string): string => new URL(`family/${slug}`, site).href;

/**
 * A name for each family that no other family shares: the card's title ("The Brennan family") when it is the only one, else the title and
 * the place of its address ("The Brennan family of Wrenfield"). The three flagship homes carry one family name; a page's <title>, its heading's
 * place line and the links to its neighbours must tell them apart (the build fails on two pages with one title).
 */
export function uniqueLabels(cards: { slug: string; title: string }[], places: Record<string, string>): Record<string, string> {
  const count = new Map<string, number>();
  for (const c of cards) count.set(c.title, (count.get(c.title) || 0) + 1);
  return Object.fromEntries(cards.map(c => [c.slug, (count.get(c.title) || 0) > 1 && places[c.slug] ? `${c.title} of ${places[c.slug]}` : c.title]));
}

export type FamilyFilm = { src169?: string; src916?: string; vtt?: string; poster?: string; durationMs: number; bytes: number };
export type FamilyPageCtx = {
  s: Story; card: Card; prev: Card; next: Card; site: string; claims: Loaded['claims']; catalog: Loaded['catalog']; house: House;
  /** the picture under the tour: relative to the site root (portal/previews/<house>.jpg) */
  poster: string;
  /** the link-preview image, absolute */
  og: string; film?: FamilyFilm;
  /** this family's line of content/story/casting.json: the room each person uses */
  casting?: CastingFamily;
  /** the family's name where no other family has it (uniqueLabels), and the neighbours'; the card's title when absent */
  label?: string; prevLabel?: string; nextLabel?: string;
  /** the tour has a voice (the manifest's `narration`): only then does the page say the voice is synthetic */
  narration?: boolean;
  /** portal/campaign.js exists in this build: the page loads it (the page is written the same without it) */
  campaign?: boolean;
  /** story v2: the real logos and screenshots (content/story/app-media.json). Null or absent: the page shows none, and is whole without them. */
  media?: MediaManifest | null;
  /** story v2: the home's HouseSpec (content/houses/<id>.json). Its room bounds draw the floor plan; absent, the page has no plan. Only `levels` is read. */
  spec?: any;
};
const memberName = (s: Story, id?: string): string => (id && s.members.find(m => m.id === id)?.name) || '';
const initial = (n: string): string => n.trim().charAt(0).toUpperCase();
const sentence = (t: string): string => t.replace(/\s+/g, ' ').trim();
/** a film the site hosts is a path from the root; one a host serves (FILM_BASE_URL) is an address of its own */
const fileUrl = (u: string): string => (/^https?:\/\//.test(u) ? u : `${rel}${u}`);
/** a page in family/ names the site's media files one folder up */
const DEPTH = 1;

/** The player's address for this family: the house it is set in, the family, and a beat or a member. Extensionless, as the site links everything. */
export const playerHref = (house: string, slug: string, extra = ''): string => `${rel}room-creator?mode=view&amp;house=${esc(encodeURIComponent(house))}&amp;family=${esc(slug)}${extra}`;
/** (data-campaign: portal/campaign.js puts the visit's ad tags on the link, so a campaign survives a click into the tour) */
const tourLink = (house: string, slug: string, extra: string, cls: string, inner: string, label = ''): string => `<a class="${cls}" href="${playerHref(house, slug, extra)}" data-campaign${label ? ` aria-label="${esc(label)}"` : ''}>${inner}</a>`;

/** What the page calls a room: the casting's label, else the house's own name for it in sentence case ("Master Suite" is "Master suite"). */
function roomWord(c: CastingFamily | undefined, id: string): string {
  const m = c && (c.members || []).find(x => x.id === id);
  if (!m) return '';
  const t = (m.roomLabel || m.room || '').replace(/\s+/g, ' ').trim();
  return m.roomLabel ? t : t.replace(/^(\S+)(.*)$/, (_a, first: string, rest: string) => first + rest.toLowerCase());
}
/** The casting's own words for the rooms the family lives in, by the house's name for each ("Boy's Room" is "Steve's room"). A room two people share keeps its first label. */
export function roomLabels(c: CastingFamily | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of (c && c.members) || []) if (m.room && m.roomLabel && !out[m.room]) out[m.room] = m.roomLabel;
  return out;
}

/** A beat that is not first-run or the closing, and whose person it is (or none): the page tells these, the tour tells the rest. */
function momentsOf(s: Story): { own: Map<string, Beat[]>; shared: Beat[] } {
  const kind = new Map(s.chapters.map(c => [c.id, c.kind]));
  const told = s.beats.filter(b => kind.get(b.chapter) !== 'ftue' && kind.get(b.chapter) !== 'outro');
  const ids = new Set(s.members.map(m => m.id));
  return { own: new Map(s.members.map(m => [m.id, told.filter(b => b.member === m.id)])), shared: told.filter(b => !b.member || !ids.has(b.member)) };
}

const appName = (catalog: Loaded['catalog'], id: string): string => (catalog[id] && catalog[id].name) || id;
/** the distinct apps of some beats (`app` only; `with` is background), in the order the beats first name them */
export const appIdsOf = (beats: Beat[]): string[] => [...new Set(beats.map(b => b.app?.id).filter(Boolean) as string[])];

/**
 * The chips of a moment: the authored ones (the app, then what it replaces), or the app's own name when the beat wrote none. Text, not links: the
 * store pages are the apps section's. A chip that names an app of the beat (`app` or `with`) wears that app's real logo, 24 px, beside the name.
 */
export function chipsHtml(b: Beat, catalog: Loaded['catalog'], media: MediaManifest | null = null, rules: RegExp[] = []): string {
  const app = b.app ? catalog[b.app.id] : null;
  const text = b.popup.chips && b.popup.chips.length ? b.popup.chips : app ? [app.name, ...(b.app!.replaces.length ? [`replaces ${b.app!.replaces.join(', ')}`] : [])] : [];
  const ids = new Map<string, string>();
  for (const id of [b.app?.id, ...(b.with || [])]) if (id) ids.set(appName(catalog, id).toLowerCase(), id);
  // (a "replaces <service>" line the copy rules stop, such as "Open WebUI replaces ChatGPT", is not printed: the page says what the app is, and the card's list does not carry it either)
  // the pair chip is "replaces <X>" (pass 1) or "alternative to <Service>" (story v3, reference/story/story-v3.md); both are the quiet chip
  const pairChip = (c: string): boolean => /^(replaces|alternative to) /i.test(c);
  return text.filter(c => !(pairChip(c) && app && rules.some(r => r.test(`${app.name} ${c}`)))).map(c => {
    if (pairChip(c)) return `<span class="chip chip-quiet">${esc(c)}</span>`;
    const id = ids.get(c.trim().toLowerCase()), logo = id ? logoImg(appMedia(media, id), { depth: DEPTH, className: 'logo' }) : '';
    return `<span class="chip${logo ? ' chip-app' : ''}">${logo}${esc(c)}</span>`;
  }).join('');
}

/** "More about this moment": the beat's `detail` as a native disclosure (no script): how it was, how it is, what you do, one fact about the app. */
export function detailHtml(b: Beat, catalog: Loaded['catalog']): string {
  const d = b.detail;
  if (!d) return '';
  return `<details class="more">
              <summary><span>More about this moment</span></summary>
              <div class="more-body">
                <dl class="more-ba"><div><dt>Before</dt><dd>${esc(d.before)}</dd></div><div><dt>Now</dt><dd>${esc(d.after)}</dd></div></dl>
                <p class="more-cap">What you do</p>
                <ol class="more-steps">${d.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
                <p class="more-fact"><b>Good to know</b> ${esc(d.fact)}</p>
              </div>
            </details>`;
}

/** One moment of a person's story: what happens, the apps (and what each replaces), the detail, and a link to watch it in the tour. */
export function momentHtml(s: Story, b: Beat, catalog: Loaded['catalog'], o: { room?: string; media?: MediaManifest | null; rules?: RegExp[] } = {}): string {
  const chips = chipsHtml(b, catalog, o.media ?? null, o.rules || []);
  const say = b.say ? s.members.find(m => m.id === b.say!.speaker)?.companion : null;
  const lines = [
    o.room ? `<p class="moment-room">${esc(o.room)}</p>` : '',
    `<h3>${esc(b.popup.title)}</h3>`,
    `<p class="moment-body">${esc(b.popup.body)}</p>`,
    chips ? `<p class="chips">${chips}</p>` : '',
    b.say && say ? `<p class="say"><span class="tag-scripted">Scripted</span> ${esc(say.name)}: “${esc(b.say.text)}”</p>` : '',
    b.popup.note ? `<p class="note">${esc(b.popup.note)}</p>` : '',
    detailHtml(b, catalog),
    tourLink(s.house, s.slug, `&amp;beat=${esc(b.id)}`, 'play-from', `Watch this moment${icon('play', 'i-fill')}`, `Watch this moment, ${b.popup.title}`),
  ].filter(Boolean);
  return `<li class="moment" id="b-${esc(b.id)}">
            ${lines.join('\n            ')}
          </li>`;
}

// ---------------------------------------------------------------------------------------------------- "Rented before, on the Core now"
/** The services a person's moments replace and the apps that do the job. A pair the story's copy rules stop ("Open WebUI replaces ChatGPT") is left out. */
export type Swap = { before: string[]; now: { id: string; name: string }[] };
export function swapOf(beats: Beat[], catalog: Loaded['catalog'], rules: RegExp[] = []): Swap {
  const before: string[] = [], now: Swap['now'] = [];
  for (const b of beats) {
    if (!b.app) continue;
    const name = appName(catalog, b.app.id);
    if (!now.some(x => x.id === b.app!.id)) now.push({ id: b.app.id, name });
    for (const r of b.app.replaces || []) {
      if (before.some(x => x.toLowerCase() === r.toLowerCase()) || rules.some(re => re.test(`${name} replaces ${r}`))) continue;
      before.push(r);
    }
  }
  return { before, now };
}
/** The card itself. `id` is unique on the page; `depth` is how far below the site root the page sits (the front page 0, a family 1). */
export function swapHtml(id: string, sw: Swap, media: MediaManifest | null, depth = DEPTH): string {
  if (!sw.before.length) return '';
  return `<div class="swap" role="group" aria-labelledby="${esc(id)}-h">
        <h3 class="swap-h" id="${esc(id)}-h">Rented before, on the Core now</h3>
        <div class="swap-cols">
          <div class="swap-col swap-before"><p class="swap-cap">Rented before</p><ul class="swap-list">${sw.before.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <span class="swap-arrow" aria-hidden="true">${icon('arrow')}</span>
          <div class="swap-col swap-now"><p class="swap-cap">On the Core now</p><ul class="swap-list">${sw.now.map(a => `<li>${logoImg(appMedia(media, a.id), { depth, className: 'logo' })}<span>${esc(a.name)}</span></li>`).join('')}</ul></div>
        </div>
      </div>`;
}

// ---------------------------------------------------------------------------------------------------- real screenshots
/** A real screenshot as a link to the picture itself (no script: the file opens) with its caption under it. portal/family.js opens it larger in the page's <dialog>. */
export function shotItem(shot: MediaShot, label: string, depth = DEPTH): string {
  return `<figure class="shot"><a class="shot-open" href="${esc(mediaUrl(shot.file, depth))}" data-shot aria-label="${esc(`Open a larger screenshot, ${label}`)}">${imageTag(shot, { depth })}</a><figcaption>${esc(shot.caption)}</figcaption></figure>`;
}
/** Up to three of a person's apps, as the apps really look: the first apps their moments name that have a real screenshot. */
export function shotsHtml(m: Member, beats: Beat[], catalog: Loaded['catalog'], media: MediaManifest | null): string {
  const picks = appIdsOf(beats).map(id => ({ id, a: appMedia(media, id) })).filter(x => x.a && x.a.shot).slice(0, 3);
  if (!picks.length) return '';
  return `<div class="shots" role="group" aria-labelledby="${esc(m.id)}-shots-h">
        <h3 id="${esc(m.id)}-shots-h">Real screenshots of <span class="nm">${esc(m.name)}</span>’s apps</h3>
        <ul class="shots-row">
          ${picks.map(({ id, a }) => `<li>${shotItem(a!.shot!, appName(catalog, id))}</li>`).join('\n          ')}
        </ul>
      </div>`;
}

/** A person's section: id is the member's id (family/<slug>#sally), then who they are, what they rented before, their moments, and a way into the tour at their room. */
export function memberSectionHtml(s: Story, m: Member, beats: Beat[], c: { catalog: Loaded['catalog']; casting?: CastingFamily; media?: MediaManifest | null; rules?: RegExp[] }): string {
  const own = memberChapter(s.chapters, s.beats, m.id);
  const room = roomWord(c.casting, m.id) || (own ? own.title : '');
  const companion = m.companion;
  const facts = [m.archetype ? capitalise(m.archetype) : MEMBER_ROLE[m.role] || m.role, `Age ${m.age}`, room].filter(Boolean);
  const title = new Map(s.chapters.map(ch => [ch.id, ch.title]));
  const media = c.media ?? null;
  // the card reads all of the person's beats (the first run's agent greeting too), the moments below only the ones the page tells
  const mine = s.beats.filter(b => b.member === m.id);
  const swap = swapHtml(`${m.id}-swap`, swapOf(mine, c.catalog, c.rules), media);
  return `<section class="who" id="${esc(m.id)}" aria-labelledby="${esc(m.id)}-h">
      <header class="who-head">
        <span class="avatar" style="--disc:var(--${esc(m.colour)})" aria-hidden="true">${esc(initial(m.name))}</span>
        <div class="who-id">
          <h2 id="${esc(m.id)}-h" class="nm">${esc(m.name)}</h2>
          <p class="who-facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</p>
        </div>
        ${beats.length ? tourLink(s.house, s.slug, `&amp;member=${esc(m.id)}`, 'btn btn-ghost btn-sm who-start', `<span>Start with <b class="nm">${esc(m.name)}</b></span>${icon('arrow')}`) : ''}
      </header>
      ${m.profile?.bio ? `<p class="who-bio">${esc(sentence(m.profile.bio))}</p>` : m.work ? `<p class="who-work">${esc(capitalise(sentence(m.work)))}.</p>` : ''}
      ${companion ? `<p class="agent"><b>${esc(companion.name)}</b> is ${esc(m.name)}’s ${companion.runtime === 'Hermes' ? 'Hermes' : 'OpenClaw'} agent. ${esc(sentence(companion.job))} <span class="limits">${esc(sentence(companion.limits))}</span></p>` : ''}
      ${swap}
      ${beats.length ? `<ol class="moments">
          ${beats.map(b => momentHtml(s, b, c.catalog, { room: own && b.chapter === own.id ? '' : title.get(b.chapter) || '', media, rules: c.rules })).join('\n          ')}
        </ol>` : ''}
      ${shotsHtml(m, beats.length ? beats : mine, c.catalog, media)}
    </section>`;
}

// ---------------------------------------------------------------------------------------------------- a day in the house
export const DAY_LABEL: Record<string, string> = { morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', 'after-school': 'After school', weekend: 'Weekend' };
/** `family.day` as a vertical timeline: the part of the day, who, the line and a link to the moment (an anchor on this page). Empty when the family has none. */
export function dayHtml(s: Story): string {
  const day = s.family.day;
  if (!day || !day.length) return '';
  const beat = new Map(s.beats.map(b => [b.id, b]));
  const parts: { at: string; items: typeof day }[] = [];
  for (const e of day) { const last = parts[parts.length - 1]; if (last && last.at === e.at) last.items.push(e); else parts.push({ at: e.at, items: [e] }); }
  return `<section class="block" id="day" aria-labelledby="day-h">
      <h2 id="day-h">A day in the house</h2>
      <p class="lead">One ordinary day, in the order it happens. Each line opens the moment above.</p>
      <ol class="day">
        ${parts.map(p => `<li class="day-part">
          <h3 class="day-at">${esc(DAY_LABEL[p.at] || capitalise(p.at))}</h3>
          <ul class="day-list">
            ${p.items.map(e => {
              const b = beat.get(e.beat), m = b && s.members.find(x => x.id === b.member);
              return `<li class="day-item">${m ? `<span class="avatar" style="--disc:var(--${esc(m.colour)})" aria-hidden="true">${esc(initial(m.name))}</span>` : ''}<div class="day-text">${m ? `<p class="day-who nm">${esc(m.name)}</p>` : ''}<p class="day-line">${esc(e.line)}</p>${b ? `<a class="day-link" href="#b-${esc(b.id)}" aria-label="${esc(`Read the moment, ${b.popup.title}`)}"><span>${esc(b.popup.title)}</span>${icon('next')}</a>` : ''}</div></li>`;
            }).join('\n            ')}
          </ul>
        </li>`).join('\n        ')}
      </ol>
    </section>`;
}

// ---------------------------------------------------------------------------------------------------- the home
/** "in the library", "in Steve's room": a room as a sentence names it (the casting's own label for a room a person lives in keeps its possessive). */
const inRoom = (label: string): string => (/^\S+['’]s\b/.test(label) ? `in ${label}` : `in the ${label.charAt(0).toLowerCase()}${label.slice(1)}`);
/** "The home": the lede and the spots of `family.home`, the facts from the spec, and the floor plan with a pin for each person. Empty when there is nothing to say. */
export function homeHtml(c: FamilyPageCtx): string {
  const { s, house, casting } = c;
  const labels = roomLabels(casting);
  const plan = c.spec ? readPlan(c.spec, labels) : null;
  const home = s.family.home;
  if (!plan && !home) return '';
  const storeys = house.storeys || (plan ? plan.levels.length : 0);
  const rooms = plan ? plan.levels.reduce((n, l) => n + l.rooms.length, 0) : 0;
  const facts = [storeys ? `${storeys} ${storeys === 1 ? 'storey' : 'storeys'}` : '', house.areaSqm ? `${nf.format(house.areaSqm)} m²` : '', rooms ? `${rooms} ${rooms === 1 ? 'room' : 'rooms'}` : ''].filter(Boolean);
  const colour = new Map(s.members.map(m => [m.id, m.colour]));
  const people = (casting && casting.members || []).filter(m => m.id && m.room && s.members.some(x => x.id === m.id)).map(m => ({ id: m.id!, name: s.members.find(x => x.id === m.id)!.name, room: m.room! }));
  const { pins } = plan ? placePins(plan, people) : { pins: [] };
  const core = casting && casting.coreSpot && casting.coreSpot.room;
  const planHtml = plan ? `
      <div class="plan-block">
        ${plan.levels.length > 1 ? `<nav class="plan-floors" aria-label="Floors"><ul>${plan.levels.map(l => `<li><a href="#plan-${esc(l.id)}">${esc(l.label)}</a></li>`).join('')}</ul></nav>` : ''}
        <div class="plan-levels">
          ${plan.levels.map(l => {
            const here = pins.filter(p => p.level === l.id);
            return `<figure class="plan" id="plan-${esc(l.id)}">
            <figcaption class="plan-cap"><b>${esc(l.label)}</b>${here.length ? `<span>${here.map(p => `${esc(p.name)} ${esc(inRoom(p.roomLabel))}`).join(', ')}</span>` : ''}</figcaption>
            <p class="plan-hint">Scroll the plan sideways to see all of it.</p>
            <div class="plan-scroll" tabindex="0" role="group" aria-label="${esc(`${l.label} plan. It scrolls sideways on a small screen.`)}">
              <div class="plan-box" style="aspect-ratio:${aspect(plan)}">
                ${levelSvg(plan, l, { core: core || undefined, pinned: here.map(p => p.room) })}
                ${here.map(p => `<a class="pin" href="#${esc(p.id)}" style="left:${p.xPct}%;top:${p.yPct}%" title="${esc(`${p.name}, ${p.roomLabel}`)}" aria-label="${esc(`${p.name}, ${inRoom(p.roomLabel)}. Go to ${p.name}’s story`)}"><span class="avatar" style="--disc:var(--${esc(colour.get(p.id) || 'chart-1')})" aria-hidden="true">${esc(initial(p.name))}</span></a>`).join('')}
              </div>
            </div>
          </figure>`;
          }).join('\n          ')}
        </div>
        <p class="note">A diagram of the rooms, drawn from the home’s layout. It leaves out walls, doors and stairs. The pins show the room each person uses${core && plan.levels.some(l => l.rooms.some(r => r.name === core)) ? ', and the small box marks the Companion Core' : ''}.</p>
      </div>` : '';
  return `<section class="block" id="home" aria-labelledby="home-h">
      <h2 id="home-h">The home</h2>
      ${home ? `<p class="lead">${esc(sentence(home.lede))}</p>` : ''}
      ${facts.length ? `<ul class="home-facts" aria-label="The home in numbers">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${home && home.spots.length ? `<ul class="spots">
        ${home.spots.map(sp => `<li class="spot"><h3>${esc(roomLabel(sp.room, labels))}</h3><p>${esc(sp.line)}</p></li>`).join('\n        ')}
      </ul>` : ''}${planHtml}
    </section>`;
}

// ---------------------------------------------------------------------------------------------------- how it runs
/** What Companion Hub and the Companion account do, in a few short sentences each. Nothing beyond the docs (CI-Docs: Hub installs and manages apps; the account pairs and lists devices). No price. */
export const RUNS_HUB = 'Companion Hub is where you install apps on the Core. Pick one in the Companion Hub store and Hub sets it up. Installing apps uses the internet.';
export const RUNS_ACCOUNT = 'Your Companion account pairs your devices with the Hub and lists them. The apps and their files stay on the Core.';
/** The shots a "How it runs" band shows: the ids it wants first, then whatever else the manifest has, up to `n`. */
export function pickCi(list: CiShot[], want: string[], n = 2): CiShot[] {
  const out = want.map(id => list.find(x => x.id === id)).filter(Boolean) as CiShot[];
  for (const x of list) if (out.length < n && !out.includes(x)) out.push(x);
  return out.slice(0, n);
}
/** The two columns of "How it runs" (the family page's section and the front page's band both wrap them): what each piece does, and its real screenshots. */
export function runsInner(media: MediaManifest | null, depth = DEPTH, n = 2): string {
  const hub = pickCi(ciShots(media, 'hub'), ['store', 'home'], n), account = pickCi(ciShots(media, 'portal'), ['home', 'add-device'], n);
  const col = (id: string, name: string, text: string, shots: CiShot[], label: string): string => `<div class="run" id="${id}">
          <h3>${name}</h3>
          <p>${esc(text)}</p>
          ${shots.length ? `<ul class="run-shots">${shots.map(x => `<li>${shotItem(x, label, depth)}</li>`).join('')}</ul>` : ''}
        </div>`;
  return `<div class="runs">
        ${col('run-hub', 'Companion Hub', RUNS_HUB, hub, 'Companion Hub')}
        ${col('run-account', 'Companion account', RUNS_ACCOUNT, account, 'the Companion account page')}
      </div>`;
}
export function runsHtml(media: MediaManifest | null): string {
  return `<section class="block" id="runs" aria-labelledby="runs-h">
      <h2 id="runs-h">How it runs</h2>
      <p class="lead">Two pieces do the work. One runs on the Core. The other keeps track of your devices.</p>
      ${runsInner(media)}
    </section>`;
}

/** The empty dialog portal/shots.js opens a screenshot in. A native <dialog>: Esc closes it, and focus goes back to the link that opened it. */
export const SHOT_DIALOG = `<dialog class="shot-dialog" id="shot-dialog" aria-label="Screenshot, larger">
    <div class="shot-dialog-in">
      <div class="shot-dialog-fig"></div>
      <p class="shot-dialog-cap"></p>
      <div class="shot-dialog-actions">
        <a class="btn btn-ghost shot-full" href="#" target="_blank" rel="noopener">Open the picture at full size</a>
        <button type="button" class="btn btn-primary shot-close">Close</button>
      </div>
    </div>
  </dialog>`;

export function familyPage(c: FamilyPageCtx): string {
  const { s, card, claims, catalog, house } = c;
  const media = c.media ?? null;
  const rules = errorRules(claims);
  const url = familyUrl(c.site, s.slug);
  const label = c.label || card.title;
  const title = familyPageTitle(label);
  const desc = familyDescription(s.family.tagline);
  const alt = `An aerial view of the ${s.family.surname} family home, rendered in the browser. ${FICTIONAL_LINE}`;
  const d = (id: string) => esc(disclosure(claims, id));
  const { own, shared } = momentsOf(s);
  const agents = s.members.some(m => m.companion);
  // the fine print this page owes (scripts/story/lib/fine-print.mts): the label is the header's chip, once; the beta line is the strip; the rest is the footer's
  const fold = finePrintItems('family-fold', {}, claims), label1 = fold.find(i => i.id === 'fictional-family')!.text;
  const facts: Facts = { agents, narration: !!c.narration, logos: !!media };
  const startNote = finePrintHtml(finePrintItems('family-start', facts, claims), { cls: 'note' });
  const apps = card.apps.map(a => {
    const cat = catalog[a.id];
    // (a service the story's copy rules stop beside an app, such as "ChatGPT" beside Open WebUI, is left out here as on the cards)
    const replaces = a.replaces.filter(r => !rules.some(re => re.test(`${a.name} replaces ${r}`)));
    const inst = replaces.length ? `<span class="instead">Replaces ${esc(replaces.join(', '))}</span>` : `<span class="instead instead-none">${UPSTREAM[a.id] || 'First party'}</span>`;
    return `<li class="app"><a class="app-name" href="${esc((cat && cat.storeUrl) || HUB_URL)}" target="_blank" rel="noopener">${logoImg(appMedia(media, a.id), { depth: DEPTH, className: 'logo' })}<span>${esc(a.name)}</span>${icon('out', 'i-out')}</a>${replaces.length || (cat && cat.kind === 'first-party') ? inst : ''}</li>`;
  }).join('\n          ');
  const hasFilm = !!(c.film && (c.film.src169 || c.film.src916));
  const filmBlock = hasFilm ? `
      <div class="film" id="film" hidden>
        <video controls preload="none" playsinline poster="${esc(fileUrl(c.film!.poster || c.poster))}" ${c.film!.src169 ? `src="${esc(fileUrl(c.film!.src169))}"` : ''}>
          ${c.film!.vtt ? `<track kind="captions" srclang="en" label="English" src="${esc(fileUrl(c.film!.vtt))}">` : ''}
        </video>
        <p class="film-note">${c.narration === false ? '' : d('synthetic-voice')}</p>
      </div>` : '';
  const image = new URL(c.poster, c.site).href;
  const filmSrc = hasFilm ? (c.film!.src169 || c.film!.src916 || '') : '';
  const ld = ldScript([orgLd(c.site), siteLd(c.site), {
    '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description: desc, inLanguage: 'en', isPartOf: { '@id': `${c.site}#website` },
    primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 630 }, breadcrumb: { '@id': `${url}#breadcrumb` },
    ...(hasFilm ? { video: { '@type': 'VideoObject', name: `${card.title}, a short film`, description: desc, thumbnailUrl: new URL(c.film!.poster || c.poster, c.site).href, uploadDate: new Date().toISOString().slice(0, 10), duration: `PT${Math.round(c.film!.durationMs / 1000)}S`, contentUrl: /^https?:\/\//.test(filmSrc) ? filmSrc : new URL(filmSrc, c.site).href } } : {}),
  }, {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Virtual homes', item: c.site }, { '@type': 'ListItem', position: 2, name: label, item: url }],
  }]);
  // A shared moment (?t= ?shot= ?tod= ?play= ?beat= ?member=) goes straight to the tour, as a home's own page forwards to the player; the
  // plain page needs no script at all. data-cfasync="false": Cloudflare's Rocket Loader would otherwise run this after the first paint.
  const player = `${rel}room-creator?mode=view&house=${encodeURIComponent(s.house)}&family=${s.slug}`;
  const tour = (cls: string, inner: string, extra = ''): string => tourLink(s.house, s.slug, extra, cls, inner);
  const people = s.members.map(m => ({ m, beats: own.get(m.id) || [] }));
  const hasShot = !!media && (people.some(({ m, beats }) => shotsHtml(m, beats, catalog, media)) || ciShots(media, 'hub').length > 0 || ciShots(media, 'portal').length > 0);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(c.og)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${TWITTER_SITE}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(c.og)}">
  <meta name="twitter:image:alt" content="${esc(alt)}">
  <meta name="theme-color" content="#f3faf7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#041620" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="${rel}assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <link rel="icon" href="${rel}portal/icons/favicon.ico" sizes="48x48">
  <link rel="apple-touch-icon" href="${rel}portal/icons/apple-touch-icon.png">
  <link rel="manifest" href="${rel}portal/site.webmanifest">
  <link rel="preload" href="${rel}assets/fonts/manrope-latin-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${rel}portal/site.css">
  <link rel="stylesheet" href="${rel}portal/media.css">
  <link rel="stylesheet" href="${rel}portal/family.css">
  ${c.campaign ? `<script src="${rel}portal/campaign.js" defer data-cfasync="false"></script>\n  ` : ''}<script data-cfasync="false">if (/[?&](t|shot|tod|play|beat|member)=/.test(location.search)) location.replace(${JSON.stringify(player)} + '&' + location.search.slice(1) + location.hash);</script>
  <script type="module" src="${rel}portal/site.js" data-cfasync="false"></script>
  <script src="${rel}portal/family.js" defer data-cfasync="false"></script>
  ${hasShot ? `<script src="${rel}portal/shots.js" defer data-cfasync="false"></script>\n  ` : ''}${ld}
</head>
<body class="page-family">
  ${sprite(['out', 'play', 'next', 'prev', 'menu', 'film', 'box', 'arrow'])}
  ${header()}
  <main id="main">
    <section class="hero" aria-labelledby="family-h">
      <div class="hero-copy">
        <p class="disclosure" data-fine="fictional-family"><strong>${esc(label1)}</strong></p>
        <h1 id="family-h" class="nm nm-family">${esc(card.title)}</h1>
        <p class="tagline">${esc(s.family.tagline)}</p>
        <p class="address">${esc(addressLine(s))}</p>
      </div>
      <a class="poster" href="${playerHref(s.house, s.slug)}" data-campaign aria-label="Take the tour of the ${esc(s.family.surname)} family home, in 3D">
        <img src="${rel}${esc(c.poster)}" alt="${esc(alt)}" width="1200" height="630" fetchpriority="high">
        <span class="poster-badge">${icon('box')}Interactive 3D tour</span>
        <span class="poster-play" aria-hidden="true">${icon('play', 'i-fill')}</span>
      </a>
      <div class="hero-actions" id="hero-actions">
        ${tour('btn btn-primary', `${icon('play', 'i-fill')}<span>Take the tour</span>`)}
        <a class="btn btn-ghost" href="${LINKS.core}" data-campaign>See ${PRODUCT}</a>
        ${hasFilm ? `<button type="button" class="btn btn-ghost" id="film-open" aria-controls="film" aria-expanded="false">${icon('film')}<span>Watch the film</span></button>` : ''}
        <p class="hero-note">${esc(TOUR_NOTE)}</p>
      </div>${filmBlock}
    </section>

    <section class="strip" aria-label="What this page is">
      <ul>
        ${fold.filter(i => i.id !== 'fictional-family').map(i => `<li data-fine="${esc(i.id)}">${esc(i.text)}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="block" aria-labelledby="meet">
      <h2 id="meet">Meet the family</h2>
      <p class="lead">${esc(s.family.story)}</p>
    </section>

    <div class="people">
      <nav class="who-nav" aria-label="The family">
        <ul>
          ${people.map(({ m }) => { const role = m.archetype ? capitalise(m.archetype) : MEMBER_ROLE[m.role] || m.role; return `<li><a href="#${esc(m.id)}" aria-label="${esc(`${m.name}, ${role}`)}"><span class="avatar" style="--disc:var(--${esc(m.colour)})" aria-hidden="true">${esc(initial(m.name))}</span><span class="who-nav-text"><b class="nm">${esc(m.name)}</b><small>${esc(role)}</small></span></a></li>`; }).join('\n          ')}
        </ul>
      </nav>

      ${people.map(({ m, beats }) => memberSectionHtml(s, m, beats, { catalog, casting: c.casting, media, rules })).join('\n\n      ')}
      ${shared.length ? `
      <section class="who who-shared" id="around" aria-labelledby="around-h">
        <header class="who-head"><div class="who-id"><h2 id="around-h">Around the house</h2></div></header>
        <ol class="moments">
          ${shared.map(b => momentHtml(s, b, catalog, { room: s.chapters.find(ch => ch.id === b.chapter)?.title || '', media, rules })).join('\n          ')}
        </ol>
      </section>` : ''}
    </div>

    ${dayHtml(s)}

    ${homeHtml(c)}

    <section class="block" id="apps" aria-labelledby="apps-h">
      <h2 id="apps-h">What runs on the Core</h2>
      <p class="lead">One Companion Core in the house runs these apps. Each is in the Companion Hub store. Other software is named in text, for what it replaces.</p>
      <ul class="apps">
          ${apps}
      </ul>
      <p class="note">${d('third-party-apps')}${media ? ' A logo belongs to its project. It shows which app is named beside it.' : ''}</p>
    </section>

    ${runsHtml(media)}

    <section class="block" aria-labelledby="firstrun">
      <h2 id="firstrun">How the Core starts</h2>
      <ol class="steps steps-compact">
          ${stepsHtml(true)}
      </ol>
      ${startNote}
    </section>

    <nav class="siblings" aria-label="Other families">
      <a class="sib" rel="prev" href="./${esc(c.prev.slug)}">${icon('prev')}<span><small>Previous family</small><b class="nm nm-family">${esc(c.prevLabel || c.prev.title)}</b></span></a>
      <a class="sib sib-next" rel="next" href="./${esc(c.next.slug)}"><span><small>Next family</small><b class="nm nm-family">${esc(c.nextLabel || c.next.title)}</b></span>${icon('next')}</a>
    </nav>

    <section class="closing" aria-labelledby="closing-title">
      <h2 id="closing-title">${esc(SIGNOFF)}</h2>
      <p>${esc(s.closing.body)}</p>
      <p><a class="btn btn-primary" href="${esc(s.closing.cta.url)}">${esc(s.closing.cta.label)}</a></p>
    </section>
  </main>
  ${hasShot ? SHOT_DIALOG : ''}
  <div class="tourbar" id="tourbar" hidden>${tour('btn btn-primary', `${icon('play', 'i-fill')}<span>Take the tour</span>`)}</div>
  ${footer(claims, house, { agents, narration: facts.narration, logos: facts.logos })}
  <script data-cfasync="false">
    (function () {
      // the page is whole without this. It adds the film's own button (when the film is hosted) and, on a phone, the tour button that stays
      // in reach once the first screen has gone by and goes again at the close.
      var b = document.getElementById('film-open'), f = document.getElementById('film');
      if (b && f) {
        f.hidden = true;
        b.addEventListener('click', function () {
          var open = f.hidden; f.hidden = !open; b.setAttribute('aria-expanded', String(open));
          var v = f.querySelector('video'); if (open) { document.body.classList.add('film-on'); f.scrollIntoView({ block: 'nearest' }); } else { document.body.classList.remove('film-on'); if (v) v.pause(); }
        });
      }
      var bar = document.getElementById('tourbar'), hero = document.getElementById('hero-actions'), close = document.querySelector('.closing');
      if (bar && hero && 'IntersectionObserver' in window) {
        var past = false, end = false;
        var show = function () { bar.hidden = !(past && !end); };
        new IntersectionObserver(function (es) { var e = es[es.length - 1]; past = !e.isIntersecting && e.boundingClientRect.top < 0; show(); }).observe(hero);
        if (close) new IntersectionObserver(function (es) { end = es[es.length - 1].isIntersecting; show(); }).observe(close);
      }
    })();
  </script>
</body>
</html>
`;
}

// The first run, as the owner specified it (STORY-BIBLE section 7). Stylised line drawings, never a product render.
const DRAW: Record<string, string> = {
  plug: '<rect x="14" y="30" width="64" height="26" rx="6"/><circle cx="66" cy="43" r="3"/><path d="M14 43H6"/><path d="M78 43c14 0 14-16 26-16"/><path d="M104 21v12"/><path d="M110 21v12"/><path d="M101 27h12"/>',
  wifi: '<rect x="44" y="14" width="32" height="58" rx="6"/><path d="M56 64h8"/><path d="M52 34a12 12 0 0 1 16 0"/><path d="M48 28a18 18 0 0 1 24 0"/><circle cx="60" cy="40" r="1.5"/><rect x="6" y="52" width="26" height="16" rx="4"/><rect x="88" y="52" width="26" height="16" rx="4"/>',
  apps: '<rect x="18" y="14" width="24" height="24" rx="6"/><rect x="48" y="14" width="24" height="24" rx="6"/><rect x="78" y="14" width="24" height="24" rx="6"/><rect x="18" y="44" width="24" height="24" rx="6"/><rect x="48" y="44" width="24" height="24" rx="6"/><path d="M84 56l6 6 12-14"/>',
};
export const STEPS: { n: number; title: string; body: string; draw: string }[] = [
  { n: 1, title: 'Plug it in.', body: 'The parcel holds the Companion Core, a power cable, a quick-start guide and a recovery USB drive. Companion OS is already on its drive. Plug it in and press the button.', draw: 'plug' },
  { n: 2, title: 'Join its Wi-Fi.', body: 'The Core opens its own Wi-Fi network. Join it from a phone, choose your home network from the list and enter its password.', draw: 'wifi' },
  { n: 3, title: 'Pick your apps and run.', body: 'In the Companion Hub store, pick your first agents and apps. Then walk away. Installing apps uses the internet.', draw: 'apps' },
];
export function stepsHtml(compact = false): string {
  return STEPS.map(t => `<li class="step">
            <span class="step-n" aria-hidden="true">${t.n}</span>
            ${compact ? '' : `<svg class="step-draw" viewBox="0 0 120 80" role="img" aria-label="" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DRAW[t.draw]}</svg>`}
            <h3>${esc(t.title)}</h3>
            <p>${esc(t.body)}</p>
          </li>`).join('\n          ');
}
