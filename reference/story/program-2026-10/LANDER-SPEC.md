# The lander: final buildable spec

> **Status: the design spec the lander was built from; the contract on main is [`reference/story/lander.md`](../lander.md).** Written 2026-10-20 against a working tree (`32b416d` plus uncommitted story-v3, categories, fine-print and site-copy work). Where this and main differ, main wins: the page, `content/story/lander.json`, `scripts/story/lib/lander.mts` and `pairs.mts`, and the CLAUDE.md and README text that section 10 proposed are all on main now, and `lander.md` records that phase C (the "Find the Core" reveal and the turnable Core) is not built.
> Kept for the reasoning (the three-design comparison, the ad-ready gate, the held pairs), the acceptance-test list and the open owner decisions. The companion scripts it cites (`final-copy.mjs`, `final-lint.mjs`, `final-probe.mjs`, the three design files) are not kept; its "Old text" blocks quote the tree of 2026-10-20, not main.

Key `final`. Written 2026-10-20 by the judge against the worktree of branch `liam/stalled-agent-sessions-worktress-53b0e2` (HEAD `32b416d` plus its uncommitted story-v3, categories, fine-print and site-copy work). **Design only: nothing in the repo was edited.** Everything below that quotes the repo was read from it by `build-spec.mjs`, so an "old" sentence is the file's, byte for byte.

Companions in this folder: `final-copy.mjs` (every string below, one table; claims and beat text are read from `claims.json` and the Brennan file, so they are verbatim by construction), `final-lint.mjs` and `final-lint-report.txt` (the copy check of section 11), `final-probe.mjs` and `final-probe.out.txt` (the chooser and the featured six on today's tree, section 4), `design-message-match.md`, `design-show-dont-tell.md`, `design-search-led.md` (the three designs this one judges).

## 0. Verdict

**Build `message-match` as the spine, with three transplants from `show-dont-tell` and two from `search-led`, and four corrections of my own.** Do not average; the reasons:

| Key | Claims safety | CLAUDE.md fit | Story at 5 s | Conversion | Immersion | Mobile | Effort and risk | What I take, and why |
|---|---|---|---|---|---|---|---|---|
| `message-match` | 4 | 4 | 5 | 5 | 3 | 4 | 3 | **The spine.** It is the only design that continues the ad's own sentence, defines the Core in the hero, puts the offer at screen 3 (desktop) and 4 (phone) with every Core sentence read from `claims.json`, keeps `Take the tour` as the one hero action, and keeps the four destinations in header, one band and footer. Its weakness is that the page is read, not touched. |
| `show-dont-tell` | 4 | 3 | 4 | 4 | 5 | 3 | 2 | **Three ideas.** (1) The Core is the engine's own stylised Core (the committed `core-orbit` shot, day-lit), not a hand-drawn SVG: it needs no commissioned art, cannot invent a product detail, and is the same Core the tour shows. (2) The "Find the Core" reveal and the turnable Core are the immersive layer, but as **phase C**, behind a kill switch, and on the hero home only (its per-card rings need a projection for 36 houses and cost a regeneration of every thumbnail). (3) The hold list of the six pairs counsel has not cleared. Rejected: the pair board before the offer (it pushes the Core to screen 2 to 3 on a phone with 8 rows of pass-1 data), the ring as a second hero action, the sub-headline without the word "apps", the unsticky header, 560 KB of frames on the first visit. |
| `search-led` | 4 | 2 | 3 | 3 | 2 | 4 | 2 | **Two engineering fixes, not the design.** (1) The full pair index behind `data-find` (today's card search reads one app per member, so a search for a service finds only some of the 20 families that show Google Photos) and the pair rules (avoid apps, dead services, hold). (2) The hyphenated-category bug in `gallery.js` (`/^[a-z]{1,16}$/` drops `?persona=work-from-home`). Rejected: a search box as the hero action (it contradicts CLAUDE.md and sells the Hub, not the Core), the Core band at screen 5.8 on a phone, and 41 new indexable `alternative-to/<service>` pages (a new page type, a permanence file, thin-page risk and counsel's D4 and D5 all open: a later package, section 12). |

**Four corrections none of the three made**, found by running the rules on the tree:

1. **The featured six must pass an ad-ready gate, and the designs' picks fail it.** `watanabe`, `haddad` and `moreau` (the greedy pick `search-led` printed; the other two designs use the same kind of rule with no gate) carry the Kiwix app that the catalog marks `storySafe: avoid`, and `haddad` carries the dead service OurHome. Six homes are lit at dusk (`petrov`, `kamau`, `nguyen`, `nwachukwu` and two of the three Brennan houses), which the daylight rule forbids on the lander. Only 10 of 30 families pass today (section 4.4). The gate is code, not taste: no `avoid` app, no dead or held service, a house lit as day.
2. **The proof must not lead with a pair counsel has not cleared.** `message-match` made Open WebUI, alternative to ChatGPT the proof and the first chip, while D4 lists it among the six pairs for counsel. The lander is the destination of paid traffic. The lander ships with the six on a `hold` list (one entry to release each) and the proof falls to the first cleared candidate: John's stack trace when released, else Sally's client folder ("The last client folder comes home", Nextcloud, alternative to Dropbox), which is the argument's second step in the family's own words.
3. **Brand and app caps on the chooser.** The first ten services by family count are four Google rows and two Paperless-ngx rows. The strip takes one chip per app, at most two per registry category and two per first brand word. A "Steam Headless over GeForce Now" chip is also held: the catalog's own caveat says Steam Headless is never a cloud gaming replacement (extra ban `cap-cloud-gaming`).
4. **No visible family counts on chips; counts are words, and always "fictional".** `fake-social-proof` bans `\d+ families`, and "Twenty families" next to a service reads as a usage figure. Counts live in accessible names and in the live region as words ("Twenty fictional families"). The stat row, the hand-written "thirty" and the 30-card scroll go.

## 1. The page at a glance

Order in `main` (fixed, and checked by the build): `hero` > `argument` > `proof` > `core` > `swap` > `homes`, then the footer. One `h1` (the hero's), one `main`, every other block an `h2`. Total: six blocks and a sticky header.

| # | id | Block | Job | Top of the block (budget, test X-3) |
|---|---|---|---|---|
| 0 | `site-head` | Header, sticky | Buy and Download in reach at every scroll position, on a phone too | 0 |
| 1 | `hero` | Hero | Continue the ad's sentence, say what a Core is, one action | 0 |
| 2 | `argument` | From rented to kept | The argument in three steps, claims verbatim | at most 1.1 screens |
| 3 | `proof` | One pair, in full | A concrete pair read from the Brennan file, the honest limit, a deep link into the tour | at most 1.9 screens (desktop), 2.0 (phone) |
| 4 | `core` | Meet the Companion Core | The offer: the object (stylised), two claims, Buy, Download, Docs, what it is not | at most **3.0 screens at 1440x900, 4.0 at 390x844** (today 9.6 and 23.5) |
| 5 | `swap` | What do you rent today? | The chooser: pairs by service, jobs by category, search, kind of place | after the offer |
| 6 | `homes` | Meet the families | Six featured cards, then every family and home in a native `<details>` | after the chooser |
| 7 | footer | Links and fine print | Four destinations, privacy, terms, the fine print, every home's page | last |

Page height budget: at most 5 screens at 1440x900 (4,500 px; today 9,484) and 7.5 at 390x844 (6,330 px; today 21,294).

```
DESKTOP 1440x900                                                PHONE 390x844
+----------------------------------------------------+         +--------------------------+
| [mark] Companion Intelligence / Virtual homes       |         | [mark]  Download [Buy Core]|  sticky
|        Docs  Download Companion [Buy Companion Core]|         +--------------------------+
+----------------------------------------------------+         | Fictional family. Real    |
| Fictional family. Real software.                    |         |  software.                |
| Companion OS, Companion Memory and Companion Agents |         | Companion OS, Companion   |
|  are in beta.                                       |         |  Memory and Companion     |
| Stop renting your              +----------------+   |         |  Agents are in beta.      |
| intelligence.                  | day-lit home   |   |         | Stop renting your         |
| A Companion Core is a small    | [Interactive 3D]|  |         | intelligence.             |
| personal server that runs ...  |   (find the    |   |         | A Companion Core is a     |
| Thirty fictional families ...  |    Core: ph.C) |   |         | small personal server ... |
| [> Take the tour] See Companion Core v              |         | [  > Take the tour      ] |
| The tour draws the home in 3D in your browser.      |         |  See Companion Core v     |
+----------------------------------------------------+         | +----------------------+  |
| From rented to kept                                  |         | | day-lit home    (>)  |  |
| [1 Rent] [2 Move home] [3 Keep it]                   |         | +----------------------+  |
+----------------------------------------------------+         | From rented to kept       |
| One pair, from The Brennan family of Wrenfield       |         | 1 Rent / 2 Move home /    |
| The last client folder comes home                    |         | 3 Keep it                 |
| [Rented before] ---> [On the Core now]               |         | One pair (stacked)        |
| [Nextcloud] [alternative to Dropbox]  Watch this moment |      | Meet the Companion Core.  |
+----------------------------------------------------+         | [the Core, stylised]      |
| Meet the Companion Core.        +----------------+   |         | two claims                |
| 4.3 litre lead, two claims      | the Core, on   |   |         | [Buy Companion Core]      |
| [Buy Companion Core] [Download] | its desk       |   |         | [Download Companion]      |
|  Read the docs   beta + what a Core is not           |         | what a Core is not        |
+----------------------------------------------------+         | What do you rent today?   |
| What do you rent today?  (10 pairs, jobs, search)    |         | (2-up chips, job row)     |
| Meet the families  (6 cards) [Show every family ...] |         | Meet the families (2-up)  |
| UnCloud your life.   footer                          |         | footer                    |
+----------------------------------------------------+         +--------------------------+
```

**The five-second test**, at both viewports, with no scroll and no script: *what a Core is* ("a small personal server that runs your household's apps and local AI at home"), *what the page argues* ("Stop renting your intelligence." and "Thirty fictional families show the service each app is an alternative to."), *what to do* (`Take the tour`, with `Buy Companion Core` in the sticky header). X-1 proves each of these is inside the first viewport.

## 2. Decisions this spec takes

| Decision | Taken | Consequence |
|---|---|---|
| D1 hero line (delegated) | **B**: the H1 is "Stop renting your intelligence." with a one-sentence Core definition as the sub-headline. I looked for a reason the canon argues for another line and found none: ADS.md section 1 says the pitch "opens on a verb and a cost, not on a product", the ad that sends the visitor opens with the same words (message match), and "Your AI should answer to you." is COPY.md's Kickstarter-page hero, a page with no tour behind it. A third line, "Watch a family uncloud theirs.", is in neither ADS.md nor `claims.json`. The other two sanctioned lines are kept: `headline` is the og card's tagline candidate, `signoff` ("UnCloud your life.") closes the page. | `claims.json` has no entry for the H1: the owner adds `rent-line` (section 10, edit 1) |
| D2 buy path (open) | The four destinations stay; no fifth. Labels stay `Buy Companion Core` and `Download Companion` (CLAUDE.md fixes them) in one constant, `BUY_LABEL`. The page prints `launch-not-offer` exactly as `claims.json` says it and no date or price of its own. | The owner repoints `ci.computer/core` (D2-A); the lander changes by one constant if the label changes |
| D3 accounts and pairing | The lander says only `plug-pair-walk` and `core-assembled`; no "no account" line (it is on hold; extra ban `held-no-account`). No first-run steps on the lander. | nothing to unwind |
| D4 pair wording | "alternative to" on every lander surface; the word "replaces" is not on the page. The six pairs counsel must see (ChatGPT, Cursor, Ring, Backblaze, Spotify, Plex) are on the lander's `hold` list. | CLAUDE.md and `personas.md` rule 2 edited in the same commit (section 10) |
| D5 logos and screenshots | Text only on the lander: names in text, no logo, no screenshot, no wall, no "How it runs". Family pages keep their media. | the 77-logo wall, the two Hub captures and the four-logo persona cards leave this page |
| D6 imagery | The Core is the engine's own stylised Core (committed `core-orbit` frames, day-lit) with the `stylised-art` line beside it; every picture on the lander is day. The fallback if counsel says an in-engine Core reads as a render is a hand-drawn line SVG in the same figure slot: one file. | `portal:thumbs --stage`, a GPU run; a day regeneration of every card picture is a separate package (WP3b) and the featured gate covers the gap |
| D7 disclosure placement | The fold carries `fictional-family` and the full `beta-short`. The band carries `beta-short`, `not-frontier`, `stylised-art`. The footer carries `launch-not-offer`, `beta-full`, `scripted-scenes`, `names-logos-owners`, `third-party-apps`. | `claims.json` `where` widened for three (section 10, edit 2) |
| D16 ad-ready gate | A computed gate (section 4.4); `lander.json` may override the six with a list that must itself pass the gate. | until the owner lists families, the Brennans lead and the rest are computed |
| D18 apartments | Merged by type: families and homes counted apart, six plain cards for apartments, no "tour" promised for a home with no family. | the page is written for it now |
| D19 three Brennan houses | One grouped featured card ("Same people, a different house:") on the Seraphine picture; all three keep their own card in the details. | owner confirms |

## 3. How to read the section specs

Each block gives: purpose; exact copy (an id from `final-copy.mjs` is in brackets; a string marked **claim** is `claims.json` `allowedClaims` verbatim, **disclosure** is printed by `finePrint(...)` from `claims.json`, **beat** is read from the family file at build); data; interaction; mobile at 390; what stays static HTML; checks.

Markup conventions the tests lean on (all cheap): `data-claim="<allowedClaims id>"` on any element whose text is a claim verbatim (the build compares the text with `claims.json`); `data-fine="<disclosure id>"` (already the fine-print convention); `data-cta="<name>"` on the links that matter (`tour-hero`, `see-core`, `tour-proof`, `meet-proof`, `buy`, `download`, `docs`), which gives the owner's later analytics a stable hook with no script added now (D8 is separate).

## 4. The data

### 4.1 The plan file `content/story/lander.json` (new source, authored, no copy in it)

```json
{
  "$comment": "The front page's plan (scripts/story/lib/lander.mts reads it, portal:build writes the page from it, scripts/test-lander.mts checks it). Authored. Every family, beat, service and app named here must exist and be current; a miss fails the build in strict mode and falls back, with a log line, otherwise. It holds no copy: every word of the page is claims.json's, a family file's or scripts/portal-front.mts's.",
  "version": 1,
  "hero":     { "slug": "brennan", "house": "seraphine" },
  "messages": [ { "key": "rent", "claim": "rent-line" } ],
  "proof":    { "candidates": [ { "slug": "brennan", "beat": "suite-ask" }, { "slug": "brennan", "beat": "office-letter" }, { "slug": "brennan", "beat": "steve-photos" } ] },
  "hold":     [ "chatgpt|open-webui", "cursor|code-server", "ring|frigate", "backblaze|duplicati", "spotify|navidrome", "plex|jellyfin", "geforce-now|steam-headless" ],
  "primary":  { "google-drive": "nextcloud" },
  "strip":    { "size": 10, "minFamilies": 2, "maxPerApp": 1, "maxPerRegistryCategory": 2, "maxPerBrand": 2, "pin": [] },
  "featured": { "count": 6, "override": null }
}
```

- `messages[0]` is the H1 and must equal the `claims.json` text of its `claim`. The ad kit reads the same entry for the last line of an end card, so the ad's final frame and the page's H1 are one string by construction (W4-video-01). More keys (`answer`, `uncloud`) are added only if an ad ships that carries them (section 12).
- `proof.candidates` is an ordered list of beats. The build takes the first whose family is current, whose beat has a `service` that is cleared in the registry (`alternativeToForm: ok`, `storyStatus: ok`, `link` not `never`), whose pair is not on `hold`, and whose pair line `<app>, alternative to <service>` passes `claims.json`'s error rules. None cleared: the block is left out, the build says why, and in strict mode it fails. **Releasing the ChatGPT pair is deleting `chatgpt|open-webui` from `hold`**; the proof then becomes John's stack trace and the chip row gains ChatGPT at the top.
- `hold` entries are `service|app` pairs not cleared for the lander. They apply to the chips, the proof and the cards' pair lines, never to the family pages or the tour.
- `primary` maps a service to the app its chip shows when the stories use several (Google Drive: Nextcloud, because Paperless-ngx already heads Evernote).
- `featured.override` is `null` (the build picks) or an array of slugs, which must pass the gate (4.4) or the build says which fails and why.

Validated by `story:validate` (new rule group `lander`) and again by `portal:build`. Schema `content/story/schema/lander.schema.json`.

### 4.2 `scripts/story/lib/pairs.mts` (new, pure): the pair index

One module for the lander now and for `scripts/render-persona-cuts.mts` later, so the page and the ads cannot name different pairs. `pairIndex({ families, registry, catalog, plan })` returns, for every service some current family shows:

- the **pair** of a beat is its `service` id (the three v3 Brennan files) or the service its `app.replaces[0]` resolves to by name or alias (`resolveService` in `scripts/story/lib/services.mts`), so the 27 pass-1 families count without being rewritten;
- a pair **may show** only if: the service has `alternativeToForm: ok`, `storyStatus: ok`, `link` not `never`, no `stale` or `story-excluded` flag; the app is not `storySafe: avoid` and not `inLiveStore: false`; the line `<app>, alternative to <service>` passes `claims.json`'s `error` and `review` rules (the `chipOk` rule `portal-front.mts` already has); the pair is not on `hold`;
- per service: `families` (slugs), `apps` (used, most families first, ties by name), `n`;
- **the strip** (`stripOf`): services with at least `minFamilies` families, sorted by `n` then name, taking each only if its app is unused, its registry category has fewer than `maxPerRegistryCategory`, its first brand word has fewer than `maxPerBrand`; `pin` first; `primary` decides the app. Counts are families, never beats;
- `findOf(family)`: every pair a family shows (service name, aliases, app name) for the card's `data-find`. This replaces today's `find`, which reads one app per member and so finds only some of the 20 families that show Google Photos.

### 4.3 What the rules give on today's tree (`final-probe.out.txt`)

```text
adReady (no avoid app, no dead service, house lit as day): 10 of 30 adler,banerjee,brennan,chaudhry,gill,halvorsen,mbatha,rahimi,salazar,tuala

CHIPS:
 1 GitHub             -> Forgejo          20 development
 2 Google Photos      -> Immich           20 photos
 3 Google Drive       -> Nextcloud        14 data
 4 Notion             -> Obsidian         14 notes
 5 Evernote           -> Paperless-ngx    13 notes
 6 LastPass           -> VaultWarden      12 identity
 7 Kindle             -> Koodo Reader      9 books
 8 Microsoft Office   -> LibreOffice       9 documents
 9 Cozi               -> HomeHub           7 home
10 Audible            -> Audiobookshelf    6 books

services passing all rules: 35  held pairs with >=2 families: Spotify, GeForce Now, Ring, Plex, Cursor, ChatGPT, Backblaze

FEATURED: brennan, salazar, gill, adler, banerjee, rahimi | categories covered: household,code,play,study,make,care
```

Read: **ten chips**, Google Home and Home Assistant (14 families) lose to the brand cap and are one search away; Plex, ChatGPT, Spotify, Ring, Cursor, Backblaze and GeForce Now are held; Google Search is out (its only app, Kiwix, is `avoid`); OurHome is out (a dead service). The build prints this list on every run so a reviewer sees the choice (`front: strip = ...`, `front: featured = ...`).

### 4.4 The featured six and the ad-ready gate

`featuredOf(front, houses, plan, casting)`:

1. **The gate** (a family may be featured only if all hold): the validator is clean; no beat's app is `storySafe: avoid`; no pair names a dead, stale or under-review service; the family's house is lit as `day` (`lighting.preset`) or has a regenerated day thumbnail (WP3b). `override` slugs are held to the same gate.
2. Slot 1 is the hero family, as one grouped card (D19).
3. Slots 2 to 6: greedy over gate-passing families, one per surname; first the category not yet covered (order of `categories.json`), then the most services not yet shown that two or more families show, then slug.
4. Each featured card shows two pair lines, chosen across the six to maximise distinct services, at most three featured cards sharing a pair; held pairs never; non-featured cards show their first two cleared pairs.
5. Fewer than six pass: show as many as pass (at least the hero) and say so in the build log. **Never fill a slot with a family that fails the gate**; the others stay in the details, reachable by the same filters.

Today: 10 of 30 pass. The reasons the other 20 fail (overlapping): Kiwix, an `avoid` app, in 15 families; the dead service OurHome in 5; a dusk house in 6 (bgfamily, familyhouse-nora, cutestarter, gardennook, modernhome-nora, newcrest); a golden-hour house in 3. Featured today: **brennan (grouped), salazar, gill, adler, banerjee, rahimi** (six categories covered). They are pass-1 stories except the Brennans; D16 stays open for the owner to list others.

### 4.5 Counts are words, and absorb 30 now, 36 and offices later

`countLine(families, houses)` in `scripts/story/lib/lander.mts` uses `numberWord` and writes one of three forms, never a digit and never "all":

| State | Line |
|---|---|
| today: 30 homes, each with a family | `Thirty homes, each with a fictional family.` |
| after the six apartments (D18) | `Thirty fictional families in thirty-six homes.` |
| after the eight offices | `Thirty fictional families and eight fictional teams in forty-four places.` |

The hero's second line and the description take the families word from the same function. `index.html` holds markers, never a count; the build fails on a spelled number word or a digit group inside a count slot of the source. A type with no house is not drawn. An office needs a `fictional-team` disclosure that `claims.json` does not have: the build **fails if a house of type `office` exists and the disclosure id is missing** (owner decision, section 13).

### 4.6 Other build-time sources

`content/families/*.json` via `story.built` (cards, beats, `uniqueLabels`), `content/story/services.json` (241 services; `mark`, `flags`, `alternativeToForm`, `storyStatus`, `link`), `catalog-apps.json` (`storySafe`, `inLiveStore`), `categories.json` (the eight job chips and `typeFilters`), `casting.json` (surname, place, `coreRoom`, `coreSpot`, `household`), `content/houses/index.json` (and a new `type`: `home` default, `apartment`, `office`, written by `scripts/build-house-index.mts` from an optional spec field `kind`), `claims.json` through `scripts/story/lib/fine-print.mts`.

## 5. Section specs

### S0. Head, meta and structured data

**Purpose.** What a search result and a link preview say: the message and the Core inside 60 characters, the fiction label in the description (claims.json: share pages and `og:description`).

**Copy.**
- `<title>`, `og:title`, `twitter:title`: `Stop renting your intelligence · Companion Core` (47 characters)
- `<meta name="description">` and `og:description`: `A Companion Core is a small personal server that runs local AI and your household's apps. Thirty fictional families show how. Fictional family. Real software.` (158 characters; the families word is written by the build)
- `og:image`: new card `portal/og/front.jpg` (1200x630, made by `portal:og`, committed): the hero home in daylight, the H1 in Manrope, the fiction pill, no price, no logo; absolute in the build. `og:image:alt` and `twitter:image:alt`: `The words Stop renting your intelligence over a daylit view of the Brennan family's lakeside home. Fictional family. Real software.`
- JSON-LD: `CollectionPage` with an `ItemList` of the featured family pages (absolute, extensionless); `WebSite` and `Organization` unchanged. No `SearchAction`, `Product`, `Review`, `AggregateRating` or `FAQPage`.
- `portal/site.webmanifest` `description`: the same sentence as the page description.

**Data.** `lander.json`, `readFamilies`, the site address, `portal:og`.
**Interaction.** None. **Mobile.** Not applicable. **Static.** All.
**Checks.** B-10 (title at most 60, description 120 to 160, absolute `og:image` that exists at 1200x630, alt equal on og and twitter), B-6 (the families word in the description equals the data).

### S1. Header (`site-head`)

**Purpose.** The shortest path from the ad to the Core's call to action is the header: Buy and Download are on screen at every scroll position and every width, on a phone too (today the phone loses Download until 23.5 screens down).

**Copy.** Brand `Companion Intelligence` (https://ci.computer) / `Virtual homes` (./). Nav `aria-label` "Site": `Docs` (the docs); `Download Companion` / `Download` (below 521 px); `Buy Companion Core` / `Buy Core`. Skip link `Skip to the homes` (target `#swap`). **Cut:** the "Homes" link.

**Data.** `LINKS` in `scripts/portal-pages.mts` only: the four destinations.
**Interaction.** `position: sticky; top: 0`, a hairline border, the page background at 94 percent, no scroll script. Every anchor target carries `scroll-margin-top: 72px`. Tab order: skip, brand, Docs, Download, Buy; focus ring from the canon token.
**Mobile at 390.** The wordmark and the title collapse to the 28 px mark (still a link to ci.computer); the nav shows `Download` (40 px, 44 on a coarse pointer) and the 93 px `Buy Core` pill: about 250 of 358 px, fits to 320. Docs is hidden below 701 px (it is in the band and the footer).
**Static.** All.
**Checks.** H-1 the four sanctioned hrefs and no Homes link. H-2 at 1440x900 and 390x844 after two screens of scroll, Buy and Download are both inside the viewport. H-3 targets at least 36 px (44 coarse). H-4 no horizontal overflow at 320, 390, 768, 1440.

### S2. Hero (`hero`)

**Purpose.** Continue the ad's sentence at once, define the Core, show the fiction label and the full beta line in the first screen, offer one action. A stranger who never scrolls can say what a Core is, what the page argues and what to do.

**Copy.**
- Chip 1 (**disclosure** `fictional-family`): `Fictional family. Real software.`
- Chip 2 (**disclosure** `beta-short`, the full line): `Companion OS, Companion Memory and Companion Agents are in beta.`
- H1 (`<h1 id="hero-title" data-claim="rent-line">`): `Stop renting your intelligence.`
- Sub (one sentence, 18 words; "personal server" and "local AI" are ADS.md section 1's words, "at home" is `local-by-default`, "small" is `core-size`): `A Companion Core is a small personal server that runs your household's apps and local AI at home.`
- Families line (the word is the data's): `Thirty fictional families show the service each app is an alternative to.`
- The one action (`data-cta="tour-hero"`, `data-campaign`): `Take the tour`, to `./room-creator.html?mode=view&house=<hero.house>&family=<hero.slug>` (the build removes `.html`, as today).
- Pointer (text link, `data-cta="see-core"`, `href="#core"`; it moves focus to the band's `h2`, `tabindex="-1"`): `See Companion Core`
- Hint: `The tour draws the home in 3D in your browser.`
- Picture link `aria-label`: `Take the Brennan family's tour in 3D`; `alt`: `An aerial view of Seraphine, the Brennan family's home, rendered in the browser.`; badge: `Interactive 3D`
- `<noscript>`: `The tour needs JavaScript. You can read the family's story instead.` with the link `Read the Brennan family's story` to `./family/<hero.slug>`.
- **Cut:** the stats row, the "Meet the families" button, the separate core card, the cast-name lede (it drifted from the story).
- **Phase C** (section 6, WP9): a "Find the Core" hotspot on the picture. `Find the Core`, accessible name `Find the Core. It is in the Library.`, caption `The Brennan family's Core sits on a writing desk in the Library.`, inside alt `The Companion Core on a writing desk in the Library, drawn in 3D.`, `Drag to turn it.`, slider `Turn the Core`, `Back to the house`, live region `The Core is in view. Drag or use the arrow keys to turn it.`

**Data.** `lander.json` `hero` and `messages[0]`; `claims.json` (`rent-line`, `fictional-family`, `beta-short`) through `finePrint('lander-hero')`; the families word; `portal/previews/<house>.jpg` and `portal/thumbs/<house>.webp`; `casting.json` for the ring's room and caption. If the hero family is not current the build logs it and the hero plays the home (as today).

**Interaction.** Links only; the player warm-up on hover of `#hero-play` and `#hero-media` stays. **Phase C:** the hotspot is a button *beside* the picture link (a sibling, never nested in the `<a>`): press it and the picture scales about 2.2x from the ring over 700 ms while the first Core frame cross-fades in (instant under reduced motion), focus moves to the slider, `aria-expanded` turns true; drag, swipe, slider or arrow keys turn the Core through eight frames (`touch-action: pan-y`, so the page still scrolls); Escape or the back button returns focus to the ring; frames 1 to 7 load on first pointer approach, focus or press, never on touch before a touch, never with Save-Data; `?no=stage` switches it off. It is an in-place reveal, not a link, so `Take the tour` stays the hero's one action.

**Mobile at 390.** Text first, the picture after (remove `order: -1` under 900 px). Stack: chips, H1 at 34 px (2 lines), sub (4), families line (2), `Take the tour` full width 48 px, pointer 44 px, hint, then the 16:9 picture from the 640 px thumbnail. The H1, sub, label, beta line and `Take the tour` are inside the 844 px fold; the picture is partly in it. LCP is the H1.

**Static.** All of it. The H1 is the same string in the HTML a crawler reads.

**Checks.** HERO-1 one `h1`, its text equals `lander.json` `messages[0]` resolved through `claims.json` `rent-line`. HERO-2 the sub is one sentence, at most 20 words, contains "Companion Core". HERO-3 `fictional-family` and `beta-short` are inside `.hero` word for word and visible unscrolled at both viewports. HERO-4 `Take the tour` is the only call to action; `.hero` contains no `https://ci.computer` link. HERO-5 the pointer's href is `#core` and `#core` exists once. HERO-6 no digit in the hero's text. HERO-7 no JavaScript: all of the above hold, plus the noscript line. HERO-8 at 390 the picture is after the CTA in DOM and layout order and is the 640 px source.

### S3. From rented to kept (`argument`)

**Purpose.** The uncloud argument in three steps, in the canon's order, with nothing the claims do not already say. Covers the canon's moves 2 (name what it replaces first), 3 (the 2am line) and 4 (time, not price) in about one screen.

**Copy.** `<h2>` `From rented to kept`; an `<ol>` of three cells (numerals are CSS counters).
1. `<h3>` `Rent`; **claim** `problem`, verbatim (`data-claim="problem"`): `Every cloud-based AI you use is someone else's agent. You are renting intelligence, and paying for it with the raw material of your life: your files, your correspondence, your half-finished ideas, your questions at 2am.`
2. `<h3>` `Move home`; `Each job gets an app that is an alternative to the service you rent for it.` then **claim** `plug-pair-walk`: `Plug it in, pair it over Wi-Fi, and walk away.`
3. `<h3>` `Keep it`; **claim** `local-by-default`: `Local by default: inference, memory and agents run on your hardware.` **claim** `hub-no-api-bill`: `One click installs the app, and there is no API bill.` and a link `What a Core is not` to `#core-limits`.

**Data.** `claims.json` `allowedClaims` (`problem`, `plug-pair-walk`, `local-by-default`, `hub-no-api-bill`) read at build; one authored sentence derived from `hub-alternatives`.
**Interaction.** None.
**Mobile at 390.** Cells stack with a 28 px numeral disc; body 16 px. The `problem` paragraph is 45 words and about eight lines; it is the canon's own text and is not shortened (verbatim claims are exempt from the 20-word target).
**Static.** All.
**Checks.** ARG-1 every `data-claim` element equals `claims.json`. ARG-2 one `h2` then three `h3`, sentence case. ARG-3 no digit, price or logo. ARG-4 `#core-limits` resolves. ARG-5 at 390 the block is at most 1.1 screens tall and starts at most 1.1 screens from the top.

### S4. One pair, in full (`proof`)

**Purpose.** Proof by one concrete pair, so the argument is not abstract: a person, the service they rented, the Companion Hub app that is an alternative, the honest limit. It is also the lander's deep link into the tour at that moment.

**Copy (default state: the ChatGPT pair is held, so the first cleared candidate, `office-letter`, is shown; every string is read from the beat).**
- Eyebrow (the family's unique label from `uniqueLabels`): `One pair, from The Brennan family of Wrenfield`
- `<h2>` (**beat** `popup.title`): `The last client folder comes home`
- `<dt>` `Rented before` / `<dd>` (**beat** `detail.before`): `Client folders sat in Dropbox, with the client contacts kept in a separate app.`
- `<dt>` `On the Core now` / `<dd>` (**beat** `detail.after`): `Nextcloud holds the folders and the contacts together on the Core, synced to Sally’s devices.`
- Chips, text only (**beat** `popup.chips`): `Nextcloud` and `alternative to Dropbox`
- Actions: `Watch this moment` (`data-cta="tour-proof"`, `data-campaign`, to the player with `&beat=office-letter`) and `Meet the family` (`data-cta="meet-proof"`, `data-campaign`, to `./family/brennan`).
- **After counsel releases `chatgpt|open-webui`** the same block reads (all checked in section 11): `<h2>` `Where John’s stack trace goes`; before `John pasted error traces from his side projects into ChatGPT whenever a test failed.`; now `Open WebUI sends the trace to a model on the Core. John reads the explanation and changes the code himself.`; chips `Open WebUI` and `alternative to ChatGPT`; limit `A model on the Core can be wrong.`

**Data.** `content/families/<proof.slug>.json` (the beat's `popup.title`, `detail.before`, `detail.after`, `popup.chips`, `popup.note`, `service`); `services.json` for the status checks; the unique label. The text is the story's own text, already linted by `story:validate`, so the lander cannot drift from the tour. The block carries no scene claim of its own: `scripted-scenes` is printed in the footer because the block quotes a written scene.

**Interaction.** Two links. `Watch this moment` opens the live player at that beat (`beat` is already a player parameter, `assets/story/url.ts`), so a visitor gets the immersive proof in one click and skips the 66-second unboxing (D14 shortens the default separately). Arriving by `?service=` for the proof's service highlights this block too.

**Mobile at 390.** Stacked: eyebrow, `h2`, the "Rented before" panel (muted), a down-arrow disc, the "On the Core now" panel (primary tint), chips, limit line, `Watch this moment` full width, `Meet the family` as a text link. About 650 px.

**Static.** All.

**Checks.** PROOF-1 the block's texts equal the beat's fields (`data-beat`). PROOF-2 the beat's `service` is cleared, the pair is not on `hold`, and the pair line passes the error rules. PROOF-3 `Watch this moment` carries `&beat=<id>` and `data-campaign`; the family link is relative and extensionless. PROOF-4 no logo, no image, no digit. PROOF-5 with the first candidate made stale, the next is used; with all stale the block is dropped, the build still passes (loudly in strict mode) and `See Companion Core` still anchors. PROOF-6 with `hold` emptied (a fixture) the first candidate is `suite-ask`.

### S5. Meet the Companion Core (`core`, the one band)

**Purpose.** The offer. Define the product with approved claims only, show the object, keep the honest limit and the beta line next to the capability claims, give the three actions. This is the one block the hero points at; Buy and Download are offered here, in the header and in the footer, nowhere else. It fixes the old band's `cap-own-apps` breach ("your own AI, apps and memory") by having no sentence of its own: every Core sentence is `claims.json`'s.

**Copy.** `<section class="cta-band" id="core" aria-labelledby="cta-title">`.
- `<h2 id="cta-title">` `Meet the Companion Core.`
- Lead (**claim** `core-size`): `Companion Core is a 4.3 litre computer, about three quarters the footprint of a sheet of paper.`
- Figure: the Core on its desk in the Library, day-lit, from the committed frame `portal/stage/<hero house>/core-0` (1200 and 640 px, lazy); `alt`: `The Companion Core on a writing desk in the Library, drawn in 3D.`; caption (**disclosure** `stylised-art`): `The Companion Core is drawn as a stylised illustration, not a photograph.`
- Two facts, each an `<li data-claim>`: (**claim** `core-assembled`) `Assembled, configured and burn-in tested in California, with mainboards from Framework.` (**claim** `hub-count`) `300+ apps and agents available in the Companion Hub store.`
- Actions: `Buy Companion Core` (`https://ci.computer/core`, `data-cta="buy"`), `Download Companion` (`https://ci.computer/download`, `data-cta="download"`), `Read the docs` (the docs, `data-cta="docs"`).
- `<aside id="core-limits">`: (**disclosure** `beta-short`) `Companion OS, Companion Memory and Companion Agents are in beta.` and (**disclosure** `not-frontier`) `A Core runs capable open models, not the largest frontier models. If you need the best model in the world this month, a subscription buys that.`
- Left out on purpose: `memory-file`. The tours barely show Companion Memory (2 of 701 beats), its tag is `V BETA`, and the lander should not promise what the proof does not show; the beta line in the hero already names it. It returns when the Brennan stories show Memory (W3-content-14).

**Data.** `claims.json` (`core-size`, `core-assembled`, `hub-count`; `beta-short`, `not-frontier`, `stylised-art`); `portal/stage/<hero house>/core-0-1200.webp` (at most 70 KB) and `core-0-640.webp` (at most 28 KB), made by `pnpm run portal:thumbs -- --stage --tod day` from the `core-orbit` shot the goldens already hold; `LINKS`. **Phase C** adds `core-1..7` (same sizes) and the turn.

**Interaction.** None in phase A; `#core` is the hero pointer's target. Phase C: the figure turns like the hero's (slider, drag, arrow keys).

**Mobile at 390.** One column: `h2`, lead, figure (16:10, about 244 px), two facts, then Buy (full width, 48 px), Download (full width, 48 px), the docs link (44 px), then the limits aside. About 760 px.

**Static.** All of it; frame 0 shows with no script.

**Checks.** CORE-1 `#core` exists once, is the fourth block of `main`, and every `data-claim` equals `claims.json`. CORE-2 exactly one Buy, one Download and one Docs link, exact hrefs. CORE-3 `finePrint('lander-core')` is satisfied inside `#core`: `beta-short`, `not-frontier`, `stylised-art`, word for word. CORE-4 the figure is an `<img>` of `portal/stage/**` with alt, `width` and `height`, no external reference; the files exist and are within budget (B-14). CORE-5 depth: top of `#core` at most 3.0 screens at 1440x900 and 4.0 at 390x844. CORE-6 the three actions are visible without scrolling inside the band at 390 (the sticky header does not cover them). CORE-7 the band contains no sentence of its own: every text node in it is a claim, a disclosure or a label from the copy table.

### S6. What do you rent today? (`swap`)

**Purpose.** The chooser, and the argument made personal: pick the service you rent, see the Companion Hub app that is an alternative and the families who moved it home. One control, two levels: the job (category) narrows the services, the service narrows the families. It replaces "Pick a person", the persona cards, the style and storeys filters and the "Rented before" panels.

**Copy.**
- `<h2>` `What do you rent today?`; lead `Choose a service you rent. Under it is the Companion Hub app that is an alternative.`
- Pair chips, group `aria-label` `Services, and the app that is an alternative to each`. Each is `<button type="button" class="pair" data-service="<id>" aria-pressed="false">`: the service's name (bold), under it the app's name with an arrow icon; **no visible number**. Accessible name, built with the count as a word: `Google Photos. Immich is an alternative. Twenty fictional families. Show them.`
- Job chips: label `Or choose by what you do`, group `aria-label` `What you do`. One chip per category of `categories.json` that a current family has (a chip with none is not drawn): Work from home, Run a business, Code and tinker, Study and research, Make and keep, Play and explore, Run the household, Host and care. Accessible name pattern: `Code and tinker, eleven fictional families`
- Search: placeholder `Search a service you want to leave, an app or a family`; `aria-label` `Search the families, services and apps`; the `/` hint stays on a wide screen.
- Kind of place (`typeFilters` of `categories.json`: Homes, Apartments, Offices): a segmented control, group `aria-label` `Kind of place`, **drawn only when two or more types have houses**.
- `Clear filters` next to the live count while any filter is on. On arrival with `?service=` and no other filter: `Showing the families that moved this one home.`

**Data.** `stripOf` (section 4.2). Each family card carries `data-service` (every cleared service id its pairs name), `data-persona` (archetypes then category ids), `data-find` (`findOf`), `data-type`.

**Interaction.**
- One filter state in the address: `?service=<id>&persona=<category id>&type=<id>&q=<text>`; every other parameter (an ad's `utm_*`, a click id) is kept byte for byte, as `gallery.js` does today. `persona` keeps its name so existing links work, **and an old archetype id (`?persona=gamer`) is mapped to its category on read**. `q` is written to the address **only when it matches something** (typed text should not leak into analytics through the address). `storeys` and `tag` are dropped from the lander (left in the address if present, untouched).
- A job chip narrows the pair chips to the services that job's families use; a pair chip narrows the families; a second press lets go. A chip that would show nothing is `disabled`, except the pressed one.
- Any filter or search lifts the featured limit: the details in S7 open and every match shows. All cleared: back to six, closed.
- Choosing scrolls the results into view only if the first result is off screen (smooth unless reduced motion; `scroll-margin-top` clears the sticky header); focus stays on the chip; one polite live announcement ("Showing four of thirty fictional families.").
- **Arriving with `?service=<id>`** (a service-targeted ad) lights that chip (`aria-pressed`, `aria-current`), filters the families and scrolls to the first result; if the id is unknown or held, the page loads unfiltered and nothing breaks.
- Keys: `/` focuses the search, `Escape` clears it.
- A card shows two pairs; the pair matching the chosen service gets `.hit` and is shown first, so a card never hides the pair the visitor asked for.
- **Defect fixed on the way:** `gallery.js` `readUrl()` accepts `persona` only if it matches `/^[a-z]{1,16}$/`, which rejects the hyphenated category ids the buttons already write (`work-from-home`, `run-a-business`). The new validator for `persona`, `service` and `type` is `^[a-z0-9]+(-[a-z0-9]+){0,4}$`.

**Mobile at 390.** Pair chips are a 2-column grid of 56 px chips (five rows, about 300 px); job chips are one horizontally scrolling row with snap and an edge fade (48 px; the page never scrolls sideways); the search is a 44 px field; the place segment, when drawn, is full width.

**Static.** The `h2`, the lead, every chip with its accessible name, the search field and the segment are in the built HTML; only their behaviour is script. Without JavaScript the existing `<noscript>` style hides the controls, and the pair chips are written inside a `<ul>` so they read as plain "service, app" lines.

**Checks.** SWAP-1 at most 10 `.pair` buttons; every service has form `ok`; none duplicated; no `avoid` app; none on `hold`; counts equal the build's computation. SWAP-2 a chip click writes `service=` and keeps `utm_source`, `fbclid` and `m` exactly; visible cards equal the chip's count; the details opened; the first result is in the viewport; `aria-pressed` and the live text are right. SWAP-3 a second click restores six cards and closes the details. SWAP-4 a job chip narrows the pair chips; a pair chip then narrows further; `Clear filters` resets all. SWAP-5 the search for "Google Photos" returns the same families as the chip. SWAP-6 the place segment is absent with one type and present with a fixture of apartments or offices. SWAP-7 chips are at least 44 px on a coarse pointer and 36 px otherwise; contrast holds in light and dark. SWAP-8 no JavaScript: the controls are not focusable and the pair list reads. SWAP-9 `?persona=work-from-home` and `?persona=gamer` both filter. SWAP-10 `?service=google-photos` lights the chip, filters and scrolls; `?service=chatgpt` while held loads unfiltered. SWAP-11 no visible digit inside any chip.

### S7. Meet the families (`homes`)

**Purpose.** Proof by example at scale without 18 phone screens: six cards that differ, then every family and every home one click away, all in the HTML. Absorbs 36 homes now and offices later.

**Copy.**
- `<h2>` `Meet the families`; the count line (words from the data, section 4.5); the live text with a filter: `Showing four of thirty fictional families.`
- Featured grid `aria-label` `Families`.
- Family card (static): picture (`alt=""`, the title link names it); `<h3><a>` the family's unique label ("The Brennan family of Wrenfield"); the home's display name and floor area (storeys withheld until W9-homes-pages-01 fixes the count); who lives there (monogram discs and the job each does); up to two pair lines, text only: `Immich, alternative to Google Photos`. The pill and the foot say `Meet the family` (the card goes to the family's page, not the tour); `aria-label` pattern `The Brennan family of Wrenfield, in Seraphine. Meet the family`
- Grouped Brennan card (slot 1, on the Seraphine picture): the same card plus `Same people, a different house:` and links to the other two Brennan families' pages by their unique labels.
- `<details id="all-homes"><summary>` `Show every family and home` `</summary>` the remaining family cards (static, lazy images), then the plain cards for homes with no family.
- Plain card: the home's name, `No family yet.` and `Look around in 3D` to the player. No "tour" is promised.
- States: `No families match. Try fewer words, or clear the filters.` with `Clear filters`; `The list of homes did not load. Check the connection and try again.` with `Try again`; `<noscript>`: `Search and the filters need JavaScript. Every family and home is listed here.`

**Data.** `featuredOf` (4.4), `story.built`, the houses index (`type`), `uniqueLabels`, `findOf`, `countLine`. The build prints `front: featured = brennan, ...`.

**Interaction.** The search and filter behaviour is S6's. The `<details>` is native: it works without script; `gallery.js` opens it for any filter and closes it when all are cleared, and leaves it as the visitor set it otherwise. Card links carry `data-campaign`. The player warm-up is not used on these cards (they go to a light page first). A failed `index.json` no longer hides the families (they are static): only the retry line shows.

**Mobile at 390.** Two-up compact cards (picture and name; cast and pair lines hidden below 520 px as today), so the six featured cards are three rows; the summary is a 48 px full-width control; pictures inside the closed details do not load until it opens; the first two featured images are eager, the rest lazy.

**Static.** Every card, featured or not, is in the built `index.html`; `gallery.js` adopts them and draws a card only for a home the build did not write.

**Checks.** HOMES-1 exactly six `.is-featured` cards when six pass the gate (fewer otherwise), none sharing a surname, the first is the hero family, every one passes the gate, categories among them at least `min(4, present)`. HOMES-2 every current family and every home has exactly one card; the sum equals the houses count. HOMES-3 no card says "Take the tour"; every family-card href is `./family/<slug>` (relative, extensionless) with `data-campaign`; no pair on more than three featured cards; **no held pair anywhere on the page**. HOMES-4 the count line equals the computed words and has no digit. HOMES-5 the first two images are not lazy, the rest are. HOMES-6 no filter: the details is closed and six cards are visible; a filter: it is open. HOMES-7 with `index.json` failing, the empty and failed states render and the first four blocks remain. HOMES-8 the grouped card's sibling links resolve. HOMES-9 with a fixture of 36 houses (six apartments) the count line, the type control and six plain cards are right; with a fixture of eight offices and no `fictional-team` disclosure the build fails.

### S8. Footer

**Purpose.** The four destinations again, the legal links, the sign-off that closes the arc, the fine print `claims.json` owes a page that quotes written scenes and names apps, and the crawl path to every home's page.

**Copy.** Sign-off (**claim** `signoff`, `data-claim`): `UnCloud your life.` Links unchanged: ci.computer, `Buy Companion Core`, `Download Companion`, Docs, Privacy, Terms. Fine print, each a `<p data-fine>` printed by `finePrint('lander-footer')`, in this order: (**disclosure** `launch-not-offer`) `Companion Core launches on Kickstarter in October 2026. This site is not an offer for sale. Campaign terms are on the campaign page.` (**disclosure** `beta-full`) `Companion OS, Companion Agents and Companion Memory are in beta. They run on units in the field today. Some of what we want them to do is not built yet. We will tell you which is which in the updates rather than in the marketing. Companion Hub is shipping.` (**disclosure** `scripted-scenes`) `Scenes are written for this site. They show what the listed apps do. They are not recordings of a real session.` (**disclosure** `names-logos-owners`) `Product names, logos and brands are the property of their owners. Naming them does not imply endorsement.` (**disclosure** `third-party-apps`) `The other apps in these stories are made by other people, most of them open-source projects. Companion Intelligence did not make them.` Then `<details>` `Apps named in these stories` (the apps the stories name, alphabetical, text only, no link, no count), "Every home, on its own page" (unchanged, written at `<!-- foot-homes: -->`), and the legal line.

**Data.** `claims.json` through `finePrint`; `fleetOf(front).wall` for the names; houses.
**Interaction.** None. **Mobile.** One column; the home list in two columns as today. **Static.** All.
**Checks.** FOOT-1 `finePrint('lander-footer')` is satisfied word for word inside the footer. FOOT-2 exactly one Buy, one Download, one ci.computer link in the footer list. FOOT-3 the apps list is text only (no `<img>`, no `<a>`), no digit, alphabetical. FOOT-4 `launch-not-offer` is `claims.json`'s text; it is volatile (it says "launches ... in October 2026" while the campaign has been live since 13 October): the build prints its text and, once the owner supplies a close date (D2), fails after it.

## 6. How the lander points, hands off and degrades

### 6.1 Into the family page and the tour

| From | To | Link | Why |
|---|---|---|---|
| Hero `Take the tour`, hero picture | the live player, the hero family's whole tour | `./room-creator.html?mode=view&house=<h>&family=<f>` | the immersive proof; unchanged (CLAUDE.md) |
| Proof `Watch this moment` | the player at the pair's beat | the same plus `&beat=<id>` | the exact moment the page just described, skipping the unboxing |
| Proof `Meet the family`, a card, the grouped card's siblings | the family page | `./family/<slug>` | the page that reads with no JavaScript and goes on to the tour; each person has `#<member>` and `Start with <name>` there |
| A plain card | the player on that home | `./room-creator.html?mode=view&house=<id>` | no family yet |
| Footer "Every home, on its own page" | each home's page | `./homes/<id>` | crawl path; unchanged |

Every link into the player or a family page carries `data-campaign`, so an ad's tags ride on them at run time (`portal/campaign.js`, loaded first, unchanged). Built hrefs never carry a query.

### 6.2 To the Core

Three offers, no more, none in the hero: the sticky header (S1), the one band (S5), the footer (S8). The hero's `See Companion Core` is an in-page pointer. The build counts: `https://ci.computer/core` three times (header, band, footer list), `https://ci.computer/download` three times, the docs twice (header, band) plus the footer's, `https://ci.computer` twice (brand, footer list); none inside `.hero`, `#argument`, `#proof`, `#swap` or `#homes`. A visitor from an ad reaches a Buy control with zero scrolling (header) or one click (the band, at most 3.0 screens down on a desktop and 4.0 on a phone).

### 6.3 With no JavaScript

Everything that argues, proves and offers is static HTML and reads: H1, sub, label, beta line, argument, proof, band with its picture, six featured cards, the native `<details>` with every other card, the footer. What needs script: the chooser's controls (inert and hidden), the search, `Take the tour` (the player needs script and WebGL; its own noscript message says so), so the hero carries a noscript line that links the family page. The player's failure card (no WebGL) is the player's and unchanged.

### 6.4 The page as the destination of the social-video tool

The owner's second ask is a tool that makes social videos. The lander's part is a stable address contract, so a cut's end card and its landing are one decision:

| Ad kind | Destination | Why |
|---|---|---|
| Pitch ad ("Stop renting your intelligence.") | `https://homes.ci.computer/` | the H1 is the ad's line |
| A service cut (Immich over Google Photos) | `/?service=google-photos` | the chooser lands on the exact pair (SWAP-10) |
| A persona cut (one member) | `family/<slug>#<member>` | the family page, as W4-video specifies |
| Any of them | add the ad's `utm_*` and click id | kept by `campaign.js` and by `gallery.js` |

Two couplings only: `lander.json` `messages[0]` is the last line of an end card; `pairs.mts` is the pair source for ad chips (follow-up W4 work). The lander does not host the studio.

### 6.5 Performance

Cold phone load at most 500 KB over the wire and 30 requests (today 562 KB, 29); no media image from the app or CI folders; the hero is the 640 px source; the band's picture is lazy; no third-party request from the source page. Phase C frames load on intent only. Estimated phone height is about 7.3 screens, so the footer's list of every home is the first thing to fold into a closed `<details>` (still in the DOM for crawlers) if X-3 fails.

## 7. Files to change

| File | Change |
|---|---|
| `content/story/lander.json`, `content/story/schema/lander.schema.json` (new) | section 4.1 |
| `content/story/claims.json` (the owner's file) | section 10, edits 1 and 2 |
| `scripts/story/lib/pairs.mts` (new, pure), `scripts/story/lib/lander.mts` (new, pure) | sections 4.2 to 4.5: `readPlan`, `validatePlan`, `pairIndex`, `stripOf`, `findOf`, `featuredOf`, `proofOf`, `countLine`, `placeTypes` |
| `index.html` | the new order and markup (sections 5); markers `<!-- lander-proof: -->`, `<!-- lander-core-fig: -->`, `<!-- lander-swap: -->`, `<!-- lander-count: -->`, `<!-- lander-apps: -->`; removed markers `pick-person`, `logo-wall`, `how-it-runs`, `core-line` (the home pages and the player keep `coreLine()`) |
| `portal/gallery.css` | sticky header; hero order and type scale; `.argument`, `.proof`, the rebuilt `.cta-band`, `.swap`, `.pair`, `.homes-count`, the details; remove `.pick`, `.arch*`, `.wall*`, `.runs-band`, `.stats`, `.core-card`; the phone header; dark mode |
| `portal/gallery.js` | one filter state; featured and details logic; pair-first card rule; service arrival; the hyphen fix; drop storeys, tags and persona cards; keep the warm-up, the failure card and the address-preserving writer |
| `portal/stage.js` (new, phase C), `portal/stage/**` (new, generated) | the reveal and the turn; frames |
| `scripts/portal-front.mts` | remove the v2 pick, wall and runs builders; add `featuredCards`, `swapStrip`, `proofBlock`, `coreFigure`, `appsNamed`, `countLine`; `familyCard` text-only pairs, new link label, `data-service`, `data-type`; `HERO` read from the plan |
| `scripts/build-portal.mts` | step 5b replaced, 5d markers, step 7 checks |
| `scripts/portal-pages.mts` | front title, description, `galleryLd`; `LINKS` unchanged |
| `scripts/build-thumbs.mts` | `--stage` and `--tod day` (WP3), `core-at.json` (phase C); WP3b day regeneration |
| `scripts/build-house-index.mts`, `assets/spec/` | optional `kind` on a spec, `type` in the index (D18) |
| `scripts/story/build-og.mts` | the front card |
| `assets/story/fine-print.ts`, `scripts/story/lib/fine-print.mts` snapshot | `lander-core` becomes `beta-short`, `not-frontier`, `stylised-art`; `lander-footer` becomes `launch-not-offer`, `beta-full`, `scripted-scenes`, `names-logos-owners`, `third-party-apps`; rewrite with `--write` |
| `scripts/story/lib/site-copy.mts` | the gallery requires `FICTIONAL_LINE` only (the full `beta-short` replaces `BETA_LINE` on this page); `DISCLOSURES` rows for the gallery: `scripted-scenes`, `stylised-art`, `not-frontier`, `third-party-apps` |
| `scripts/test-fine-print.mts`, `scripts/test-site-copy.mts`, `reference/story/fine-print.md` | the new rows |
| `scripts/test-lander.mts`, `scripts/test-pairs.mts` (new, `@check-house quick`) | plan validation, pair index, strip, gate, proof, count words, copy table |
| `scripts/story/portal-tests/lander.mts` (new, hooks leg) | the browser checks of section 9 |
| `scripts/test-portal.mts`, `scripts/story/portal-tests/front-v2.mts` | drop the persona, stats, "thirty" and `Companion OS is in beta.` assertions the old page owned; `front-v2` becomes the family-page-only suite |
| `scripts/test-campaign.mts`, `scripts/test-story-pages.mts` | the proof's `data-campaign` link; the pair-line form |
| `test/fixtures/site/lander-36/` (new) | 36 houses (six apartments), eight offices variant, a family set that fails the gate |
| `.github/workflows/ci.yml` | none unless the quick-test count is quoted; `test:node` finds the new tests by glob |
| `CLAUDE.md`, `README.md`, `reference/story/personas.md`, `reference/story/lander.md` (new) | section 10 |
| `portal/og/front.jpg`, `portal/og/manifest.json` | generated by `portal:og` |

**Not touched:** `room-creator.html`, the player and the tour, `portal/campaign.js`, `portal/campaign.json`, `deploy.yml`, the goldens.

## 8. Work packages (build in this order)

| WP | What | Owns (files) | Depends on |
|---|---|---|---|
| **WP0** | Owner: the `rent-line` entry and the widened `where` in `claims.json`; answers to section 13 | `content/story/claims.json` | none; until the entry exists the build warns, and fails only in strict mode |
| **WP1** | Data and checks, no markup: `lander.json` and schema, `pairs.mts`, `lander.mts`, the fixture, `test-lander.mts`, `test-pairs.mts` (the probe of section 4.3 becomes the first test) | `content/story/lander.json`, `content/story/schema/lander.schema.json`, `scripts/story/lib/pairs.mts`, `scripts/story/lib/lander.mts`, `scripts/test-lander.mts`, `scripts/test-pairs.mts`, `test/fixtures/site/lander-36/` | none |
| **WP2** | Fine-print rows and copy lint: `fine-print.ts` rows and `--write`, `site-copy.mts` gallery lines and `DISCLOSURES`, their tests and the reference table | `assets/story/fine-print.ts`, `scripts/story/lib/fine-print.mts`, `scripts/story/lib/site-copy.mts`, `scripts/test-fine-print.mts`, `scripts/test-site-copy.mts`, `reference/story/fine-print.md` | none (parallel with WP1) |
| **WP3** | Stage frame: `portal:thumbs --stage --tod day` renders `core-0` (1200 and 640) for the hero house; B-14 budgets. GPU. | `scripts/build-thumbs.mts`, `portal/stage/<house>/core-0-*.webp` | none (parallel) |
| **WP3b** | Day regeneration of every card, preview and the hero (D6-A; the dusk and golden houses). A large binary diff and a GPU run; it lifts the `requireDay` limit on the featured gate. | `portal/thumbs/**`, `portal/previews/**`, `portal/hero.*` | owner D6; not on the critical path |
| **WP4** | Markup and build: `index.html`, `portal-front.mts`, `build-portal.mts` (steps 5b, 5d, 7), `portal-pages.mts`, `build-house-index.mts`, `build-og.mts` (front card) | as listed in section 7 | WP1, WP2, WP3 |
| **WP5** | CSS: `gallery.css` (agree class names with WP4 first) | `portal/gallery.css` | WP4 (parallel after the names are fixed) |
| **WP6** | Script: `gallery.js` (one filter state, details, service arrival, hyphen fix, find, no persona cards) | `portal/gallery.js` | WP4 |
| **WP7** | Tests: `lander.mts` browser leg, `test-portal.mts` and `front-v2.mts` edits, campaign and story-pages additions | `scripts/story/portal-tests/lander.mts`, `scripts/test-portal.mts`, `scripts/story/portal-tests/front-v2.mts`, `scripts/test-campaign.mts`, `scripts/test-story-pages.mts` | WP4 to WP6 |
| **WP8** | Docs, written last and merged **in the same commit as WP4** (the build's new order check enforces them): `CLAUDE.md`, `README.md`, `personas.md` rule 2, `reference/story/lander.md` | those files | WP4 to WP7 |
| **WP9** | Phase C, the immersive layer: frames 1 to 7, `core-at.json`, `portal/stage.js`, the hero hotspot, the turnable band figure, X-12 and X-13, the CLAUDE.md sentence on the reveal | `scripts/build-thumbs.mts`, `portal/stage.js`, `portal/stage/**`, `portal/gallery.css`, tests | WP3, WP7 |

**Phases.** **A** (WP1 to WP8; days 1 to 10 for one person, about 7 with two): the message match, the offer at screen 3 and 4, the sticky header, the chooser, the gated featured six, the claims-clean page. This alone fixes the 9.6-screen burial and the broken `cap-own-apps` sentence. **B** (WP3b): day thumbnails. **C** (WP9): the Core you can turn and the hero hotspot.

## 9. Acceptance tests

Build and quick-test layer (`portal:build` step 7 and `scripts/test-lander.mts`; no browser):

| id | Check |
|---|---|
| B-1 | H1 equals `claims.json` `rent-line` and `lander.json` `messages[0]`; exactly one `h1`, one `main` |
| B-2 | landmark order `hero, argument, proof, core, swap, homes`; every block an `h2`; headings in sentence case |
| B-3 | every `data-claim` element equals its claim; every `data-fine` equals its disclosure; `finePrint('lander-hero' \| 'lander-core' \| 'lander-footer')` satisfied, each inside its block |
| B-4 | say it once: `/core` x3, `/download` x3, docs counted, `https://ci.computer` x2; none inside `.hero`, `#argument`, `#proof`, `#swap`, `#homes` |
| B-5 | no `<img>` from `portal/apps/` or `portal/ci/`, no screenshot, no third-party `src`, no price, no digit after "all", no app count other than `hub-count`; no "replaces" |
| B-6 | counts in words equal the data; no `data-stat`; the description holds the families word; the source `index.html` holds no spelled count and no digit group in a count slot |
| B-7 | featured: at most six, every one passes the gate, unique surnames, first is the hero, categories at least `min(4, present)`, no pair on more than three cards |
| B-8 | strip: at most 10, cleared services only, none held, none `avoid`, one per app, caps held, counts equal the computation |
| B-9 | proof text equals the beat; its service cleared and not held; fallback logic exercised on fixtures (first candidate stale; all stale; hold emptied) |
| B-10 | title at most 60, description 120 to 160, absolute `og:image` of 1200x630 that exists, alt equal on og and twitter |
| B-11 | every internal href relative and extensionless; every link into the player or a family page has `data-campaign`; every executable `<script>` has `data-cfasync="false"`; built hrefs carry no query |
| B-12 | `pnpm run story:copy -- dist` clean on the built `index.html` (strict) |
| B-13 | `lander.json` valid: hero, proof, hold, primary and any override name things that exist and are current |
| B-14 | `portal/stage/<hero house>/core-0-1200.webp` at most 70 KB and `-640.webp` at most 28 KB exist; only frame 0 is in the markup |
| B-15 | **no held pair appears anywhere in `dist/index.html`** (chips, cards, proof, data-find, JSON-LD) |
| B-16 | a house of type `office` with no `fictional-team` disclosure fails the build; a type with no house draws no control |

Browser layer (`scripts/story/portal-tests/lander.mts`, 1440x900 and 390x844, light and dark, Chromium; WebKit when installed):

| id | Check |
|---|---|
| X-1 | the fold: H1, label, beta line, sub, `Take the tour` and the header `Buy` visible unscrolled; at 390 `Download` too; no horizontal overflow at 320, 390, 768, 1440 |
| X-2 | message match: with `?utm_source=meta&utm_content=x&fbclid=AbC_1` the H1 is the default and no built href changed |
| X-3 | depth: `#core` top at most 3.0 x viewport height at 1440x900 and 4.0 x at 390x844; page height at most 5 and 7.5 screens |
| X-4 | the filter flows SWAP-2 to SWAP-5, SWAP-9, SWAP-10, with unrelated address parameters kept byte for byte |
| X-5 | no JavaScript (`javaScriptEnabled: false`): hero, argument, proof, band, six cards, footer read; the details opens by click; every family link present; the chooser inert; the noscript lines shown |
| X-6 | campaign: with tags set, the hero tour, hero picture, proof `Watch this moment`, every family card, Buy and Download carry the tags exactly; docs, privacy and terms carry none |
| X-7 | accessibility: heading levels without a skip, labelled landmarks, visible focus, tab order equals DOM order, targets at least 44 px on a coarse pointer, contrast in light and dark, `prefers-reduced-motion` gives no smooth scroll; `See Companion Core` lands on `#core` with focus on its `h2` |
| X-8 | weight: cold phone load at most 500 KB and 30 requests; no image from the app or CI media; the hero is the 640 px source; the band picture is lazy; no third-party request from the source page |
| X-9 | failure: with `content/houses/index.json` failing, the failure line shows under `#homes` and the first four blocks remain |
| X-10 | the hero family not current (a `--families` fixture): the hero plays the home, the proof falls back or is dropped, the build logs the reason, `#core` still anchors |
| X-11 | the sticky header: after two screens of scroll Buy and Download are inside the viewport at both sizes |
| X-12 | phase C: the hotspot is at least 44 px; Enter reveals the Core and moves focus to the slider; Escape returns focus to the ring; arrows and drag change among eight frames and vertical scroll still works; reduced motion has no transition and no auto-turn; `?no=stage` removes it; no core frame loads before intent |
| X-13 | phase C: the band's figure turns the same way; the `stylised-art` caption is adjacent to it |

Sequence for the gate: `story:validate`, `portal:build` (strict families on a push), `story:copy -- dist`, `pnpm run test:node`, `portal:test -- --only gallery,hooks,campaign`.

## 10. CLAUDE.md, README.md and claims.json edits (exact)

Old text is quoted from the working tree as it is today. CLAUDE.md is the repo's law: these edits are the owner's to approve (section 13), and they land in the same commit as WP4.

**CLAUDE.md: 1. the source list (line 11)**

Old:

```text
(the cast plan, personas, claims, catalog, roles, voices, lexicon, schema;
```

New:

```text
(the cast plan, personas, claims, catalog, roles, voices, lexicon, the lander plan `lander.json`, schema;
```

**CLAUDE.md: 2. the first sentence of The public site (line 52)**

Old:

```text
The gallery of thirty homes (`index.html`)
```

New:

```text
The lander (`index.html`: the Companion Core's argument, then the families and their homes)
```

**CLAUDE.md: 3. say it once (lines 106 to 108)**

Old:

```text
Say it once: Buy and Download are offered
  by the header, the band after the homes and the footer (the gallery's hero only says what a Core is and points at the band), and the
  main site is linked from the header and the footer list only.
```

New:

```text
Say it once: Buy and Download are offered
  by the header (sticky, with a short Download kept on a phone), the one Core band (the lander's fourth block, before the families) and the footer (the lander's hero only says what a Core is and points at the band), and the
  main site is linked from the header and the footer list only.
```

**CLAUDE.md: 4. the front page paragraph (lines 113 to 121), replaced whole**

Old:

```text
- **The front page is the story's lander** (`index.html`, `portal/gallery.js`, `scripts/portal-front.mts`; `portal:build` writes the cards at step 5d from the
  current families, `story.built`). A family's card goes to its page (`family/<slug>`, which goes on to the tour); a home with no current family keeps its
  plain card, which goes to the player. The family cards are **static HTML in the built `index.html`** (`gallery.js` adopts them and does not draw them
  again), so a crawler, a visitor without JavaScript and an in-app browser with a slow script see them. The hero says "Fictional family. Real software.",
  `Take the tour` is its one action (the Brennans' tour, `HERO` in `portal-front.mts`), `See Companion Core` only points at the one Core band, and the
  band, the header and the footer keep `Buy Companion Core` and `Download Companion`: say it once. No UI mockup, no invented screen (the real, labelled app media of the block below is the only third-party image), no price, daylight
  only, the beta line with every software claim, and a card's app line is `<app> replaces <service>` from the story, never a line `claims.json` stops.
  A phone's hero picture is the 640 px thumbnail, never a 1600 px image (it drove the LCP to 3.5 s). The hero's "thirty" and the description's "Thirty homes" are
  checked against the number of homes (step 5b).
```

New:

```text
- **The front page is the story's lander, and it continues the ad** (`index.html`, `portal/gallery.js`, `scripts/portal-front.mts`, `scripts/story/lib/lander.mts`,
  `content/story/lander.json`; `portal:build` writes the plan's blocks and the cards at step 5d from the current families, `story.built`). Its order is fixed: the hero,
  "From rented to kept" (the argument), one pair in full (a beat of a family file), the one Core band (`id="core"`), the chooser ("What do you rent today?"), the
  families, the footer. The hero's H1 is the campaign's own line, "Stop renting your intelligence." (`allowedClaims` `rent-line` in `claims.json`, `messages[0]` in
  `lander.json`; the ad kit's last line is the same string), its sub-headline is one sentence that says what a Companion Core is, and "Fictional family. Real software."
  and the full `beta-short` line are in the first screen. `Take the tour` is its one action (the Brennans' tour, `hero` in `lander.json`), `See Companion Core` only points
  at the one Core band, and the band, the header (sticky, with a short Download kept on a phone) and the footer keep `Buy Companion Core` and `Download Companion`: say it once
  (`portal:build` counts them). A family's card goes to its page (`family/<slug>`, which goes on to the tour); a home with no current family keeps a plain card, which goes
  to the player. Every card is **static HTML in the built `index.html`** (the featured six, then the rest in a native `<details>`; `gallery.js` adopts them and does not draw
  them again), so a crawler, a visitor without JavaScript and an in-app browser with a slow script see them. A family is featured only if it passes the ad-ready gate (no
  `storySafe: avoid` app, no dead or held service, a house lit as day: `featuredOf` in `scripts/story/lib/lander.mts`). No UI mockup, no invented screen, no screenshot and no
  third-party logo on the lander (apps and services are named in text; the family pages carry the real, labelled media), the Core only as the engine's stylised Core
  (`portal/stage/`, with the `stylised-art` line beside it), no price, daylight only, the beta line with every software claim, and a pair is written
  `<app>, alternative to <service>` from the story, never a line `claims.json` stops or `lander.json` holds (the pairs counsel has not cleared are on its `hold` list). A count
  of families next to a service is a word and says "fictional". A phone's hero picture is the 640 px thumbnail, never a 1600 px image (it drove the LCP to 3.5 s). Counts
  of homes and families are words written by the build from the data, never typed: the H1 has no number, and `portal:build` fails on a typed one (step 5b).
```

**CLAUDE.md: 5. the lander fine-print bullet (lines 125 to 127)**

Old:

```text
- The lander's Core sentence and fine print are `claims.json`'s words, never retyped in `index.html`: `portal:build` writes them at the `<!-- fine-hero: -->`,
  `<!-- core-line: -->`, `<!-- fine-core: -->` and `<!-- fine-foot: -->` markers from `scripts/story/lib/fine-print.mts` (surfaces `lander-hero`, `lander-core`,
  `lander-footer`; `reference/story/fine-print.md`). Every row of `DISCLOSURES` in `scripts/story/lib/site-copy.mts` is enforced, so `story:copy` fails a page that drops one.
```

New:

```text
- The lander's claims and fine print are `claims.json`'s words, never retyped in `index.html`: an element that quotes a claim carries `data-claim="<id>"` (the build compares
  its text with `claims.json`), a disclosure carries `data-fine="<id>"`, and `portal:build` writes them from `scripts/story/lib/fine-print.mts` (surfaces `lander-hero`,
  `lander-core`, `lander-footer`; `reference/story/fine-print.md`) at the `<!-- fine-hero: -->`, `<!-- fine-core: -->` and `<!-- fine-foot: -->` markers. Every row of `DISCLOSURES` in
  `scripts/story/lib/site-copy.mts` is enforced, so `story:copy` fails a page that drops one.
```

**CLAUDE.md: 6. the story v2 markers sentence (lines 243 and 244)**

Old:

```text
The front page's "Pick a person", logo wall and "How it runs" band are written at three markers in `index.html` by the `story v2` block of `scripts/build-portal.mts`
  (a card's button is the persona filter; the lists, the dimming and the cards are CSS and `aria-pressed`; with no script the cards and the lists read).
```

New:

```text
The front page carries none of this (the lander is text only: no logo, no screenshot, no "Pick a person", no wall); its blocks are written at the markers of the `lander` block of `scripts/build-portal.mts`, and the family pages keep "How it runs" and the logos.
```

**CLAUDE.md: 7. the derived-files table: one new row after the thumbnails row**

Old:

```text
| `portal/thumbs/<id>.webp`, `portal/hero.webp`, `portal/previews/<id>.jpg`, `portal/hero.jpg` | `pnpm run portal:thumbs [--house <id>]` — after a change to how a house looks |
```

New:

```text
| `portal/thumbs/<id>.webp`, `portal/hero.webp`, `portal/previews/<id>.jpg`, `portal/hero.jpg` | `pnpm run portal:thumbs [--house <id>]` — after a change to how a house looks |
| `portal/stage/**` (the hero home's Core frames, `core-at.json`) | `pnpm run portal:thumbs -- --stage --tod day` — after a change to how the hero home, its Core room or the Core looks |
```

**CLAUDE.md: 8. with WP9 only (the hero reveal).** Append to the end of edit 4's sentence on `Take the tour`:

```text
The hero picture may carry a "Find the Core" reveal (portal/stage.js, ?no=stage switches it off): a button beside the picture link that swaps the picture in place and turns the Core; it is not a link and not a second action.
```

**README.md: 1. "Every page sends a visitor on to the company" (line 295)**

Old:

```text
the band after the homes (the hero's Core line points at it)
```

New:

```text
the one Core band, fourth on the page (the hero's `See Companion Core` points at it)
```

**README.md: 2. the command table row for portal:thumbs (line 74)**

Old:

```text
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp`, and the link-preview JPEGs → `portal/previews/<id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--hero-tod`, `--max-kb`). Needs a GPU; commit the output. |
```

New:

```text
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp`, and the link-preview JPEGs → `portal/previews/<id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--hero-tod`, `--max-kb`, `--stage`, `--tod day`; `--stage` renders the hero home's Core frames into `portal/stage/`). Needs a GPU; commit the output. |
```

**README.md: 3. the story v2 paragraph (lines 407 and 408)**

Old:

```text
The **front page** adds "Pick a person" (a card for the organiser, builder, gamer and learner: the persona filter), the list "Rented before, on the Core now" for the one chosen, a
  logo wall of the apps the families run (dimmed to the one chosen), the families' cards with their logos, and the "How it runs" band.
```

New:

```text
The **front page** carries none of this: it is text only (the argument in three steps, one pair in full, the Core band, a chooser by service and by job, the families' cards with their pairs in the "alternative to" form).
```

**README.md: 4. the front page bullet (lines 434 to 449), replaced whole**

Old:

```text
- **The front page** (`index.html`, `portal/gallery.js`, `portal/gallery.css`, `scripts/portal-front.mts`, the `front page` blocks of `scripts/build-portal.mts`)
  is the story's lander. The hero says "Thirty homes. Each family's life, on one Companion Core.", the label "Fictional family. Real software.", who
  lives there in a line (Sally's planner, John's code, Steve's games, Jean's homework), one action (`Take the tour`: the Brennan family's tour in the
  player) and a pointer to the one Core band (`See Companion Core`); the band, the header and the footer keep `Buy Companion Core` and `Download
  Companion`, and the beta line sits with every software claim. Under it, one card for each current family (`story.built`, flagship first): the home's picture,
  "The Brennan family", the home's display name, who lives there as monogram discs with the job each does (organiser, builder, gamer, learner, maker,
  host), the two or three apps that tell the story (one per person, `<app> replaces <service>`, from `content/story/personas.json`'s pools; a line
  that `claims.json` would stop is left off) and `Take the tour`, which goes to the family's page (`family/<slug>`, where `Open in 3D` goes on to
  the player). A home with no current family keeps its plain card (the player). **The cards are written into `index.html` as static HTML at build
  time** (`scripts/portal-front.mts`, step 5d), so a crawler, a visitor without JavaScript and an in-app browser with a slow script see them;
  `gallery.js` adopts them and draws a card only for a home with no family. Filters: what they do (`?persona=organiser|builder|gamer|learner|maker|host`,
  worded Work from home, Code, Play, Study, Make, Host; a button only for a job some current family does), the search (a family, a person, a job, an app
  or what it replaces, a home), and, in a `<details>` that is open on a wide screen, storeys and home style; the address carries them and keeps every
  parameter that is not theirs. A phone's hero picture is the 640 px thumbnail of the family's home (about 50 KB), a wide screen's the 1200 px preview.
  A home's page (`homes/<id>`) has "Meet the family" when a current family lives there. The hero tours `HERO` (`scripts/portal-front.mts`: the
  Brennans at Seraphine); when that family is not current the hero plays the home.
```

New:

```text
- **The front page** (`index.html`, `portal/gallery.js`, `portal/gallery.css`, `scripts/portal-front.mts`, `scripts/story/lib/lander.mts`, `scripts/story/lib/pairs.mts`, `content/story/lander.json`,
  the `front page` blocks of `scripts/build-portal.mts`) is the story's lander and continues the ad that sends a visitor to it. The hero's H1 is "Stop renting your intelligence."
  (`claims.json` `rent-line`), its sub-headline says what a Companion Core is in one sentence, the label "Fictional family. Real software." and the full beta line are in the first screen, and its
  one action is `Take the tour` (the `hero` family of `lander.json`, the Brennans at Seraphine; with no current hero family the hero plays the home) beside a pointer to the Core band (`See Companion Core`).
  Then, in order: "From rented to kept" (the argument in three steps: `problem`, `plug-pair-walk`, `local-by-default` and `hub-no-api-bill` verbatim); one pair in full (a beat of a family file,
  the first of `lander.json`'s `proof.candidates` that is cleared, with its honest limit and a `Watch this moment` link that opens the tour at that beat); the one Core band (`Buy Companion Core`,
  `Download Companion`, the docs, the Core as the engine's stylised picture, two approved claims, the beta line and what a Core is not); the chooser "What do you rent today?" (up to ten service chips,
  each with the Companion Hub app that is an alternative to it; one chip per job category of `content/story/categories.json`; the search; Homes, Apartments and Offices when more than one has houses);
  and the families: six featured cards (the hero family first; only families that pass the ad-ready gate; one per surname; the categories spread) and, in a native `<details>`, every other family and
  every home with no family. The cards are written into `index.html` as static HTML at build time, so a crawler, a visitor without JavaScript and an in-app browser with a slow script see them;
  `gallery.js` adopts them. A card goes to the family's page (`family/<slug>`), which goes on to the tour, and shows up to two pairs as "<app>, alternative to <service>" in text (no logo, no
  screenshot, no price). Filters: a service (`?service=<id>`), a job category (`?persona=<category id>`; an old archetype id maps to its category), a place type (`?type=`) and the search (`?q=`); the
  address carries them and keeps every parameter that is not theirs. Counts are words computed from the data. A phone's hero picture is the 640 px thumbnail of the family's home. A home's page
  (`homes/<id>`) has "Meet the family" when a current family lives there.
```

**README.md: 5. the campaign passthrough list (lines 453 and 454)**

Old:

```text
marked `data-campaign` (the hero's tour, the
  family cards, a family's way into the tour, a home's page)
```

New:

```text
marked `data-campaign` (the hero's tour, the proof's `Watch this moment`, the
  family cards, a family's way into the tour, a home's page)
```

**README.md: 6. the browser tests named in the story v2 paragraph**

Old:

```text
browser tests: `family-v2.mts`, `front-v2.mts` and `player-more.mts` in `scripts/story/portal-tests/`
```

New:

```text
browser tests: `family-v2.mts`, `front-v2.mts` (family pages only), `lander.mts` and `player-more.mts` in `scripts/story/portal-tests/`
```

**reference/story/personas.md: rule 2, the pair wording (decision D4; same commit as CLAUDE.md edit 4)**

Old:

```text
2. **Name what it replaces.** The chip row is the app name, then `replaces <X>` where X is one of the app's catalog
   `replaces` names. That is the uncloud argument in four words; do not add adjectives to it.
```

New:

```text
2. **Name what it is an alternative to.** The chip row is the app name, then `alternative to <X>` where X is the service's name in `content/story/services.json`.
   That is the uncloud argument in a few words; do not add adjectives to it.
```

**content/story/claims.json (the owner's file, never CLAUDE.md): two edits**

1. Add to `allowedClaims`:

```json
{ "id": "rent-line", "text": "Stop renting your intelligence.", "source": "ADS.md section 1 (the approved pitch, owner 21 Sep 2026) and section 2 (short lines for end cards, overlays and banner tops)", "tag": "V", "status": "ok-verbatim", "note": "The lander's H1 and the ad kit's last line (content/story/lander.json messages)." }
```

2. Add `"landing page"` to the `where` of `stylised-art`, `scripted-scenes` and `third-party-apps` (the lander prints all three: beside the Core picture, and in the footer because the proof quotes a written scene and the page names apps). `launch-not-offer` is stale (it says "launches ... in October 2026" while the campaign has been live since 13 October): the lander prints whatever it says, so the owner's new wording reaches the page by `node --experimental-strip-types scripts/story/lib/fine-print.mts --write` and a rebuild.


## 11. Copy check

`final-lint.mjs` applies every `bannedPhrases` rule of `content/story/claims.json` at its own severity (72), the five extra rules of `scripts/story/lib/extra-bans.mts`, the site lint's "log in" rule, sentence-case headings (`headingProblems`), the style limits (sentences at most 20 words, title at most 60, description 120 to 160), "no digit", "no replaces", "no own near apps" and the voice rules (no dash, exclamation mark, price or performance number) to all 108 strings of the table. 34 of them are read from `claims.json` or the Brennan file (18 claims and disclosures, 16 strings of the three proof candidates), so they are verbatim by construction (the script also asserts the claims and disclosures). It then assembles a mock built page from the same strings and runs the **real `siteCopy()`** of `scripts/story/lib/site-copy.mts` in strict mode over it (the function behind `story:copy -- dist`), and checks the four disclosure rows this spec adds to the gallery.

```text
NEGATIVE CONTROLS (each must be caught)
  caught  cap-parity           "Open WebUI replaces ChatGPT."
  caught  num-app-counts       "Show all 30 families"
  caught  cap-own-apps         "Runs your own AI, apps and memory at home."
  caught  num-dollar           "Save $5,900 a year"
  caught  exclamation          "Your data never leaves the house!"
  caught  dash-em-en           "Set up in five minutes — done"
  caught  vocab-home-server    "A home server for your family"
  caught  vocab-portal         "Log in to your CI Account"
  caught  cap-remote-access    "Access it from anywhere"
  caught  num-app-counts       "77 apps appear in these stories"
  caught  buzz-simple-claims   "Plug and play"
  caught  heading              "Stop Renting Your Intelligence"
  caught  fake-social-proof    "20 families use Immich"
  caught  cap-omniscient       "Companion Memory knows you better"
  caught  held-no-account      "No account needed"
  caught  the word replaces    "Immich replaces Google Photos"
  caught  vocab-box            "Plug in the little box"
  caught  fake-render          "Rendered Companion Core product shot"

COPY TABLE

DISCLOSURES the lander prints (text read from claims.json, so verbatim; `where` is claims.json's)
  widen  stylised-art         printed at: core (beside the picture)                        claims.json where: family page footer; film end card
  widen  scripted-scenes      printed at: footer                                           claims.json where: family page footer; film end card; About page
  widen  third-party-apps     printed at: footer                                           claims.json where: credits page
  NOT printed on the lander (owed elsewhere): internet-steps (FTUE, family page), synthetic-voice (near the audio), attribution-agents (credits, end card, player About), apps-availability (credits, FAQ), names-owners (superseded by names-logos-owners once pages say "alternative to"), site-practises (not required; false once the deploy injects analytics).

THE REAL siteCopy() (scripts/story/lib/site-copy.mts, strict) OVER A MOCK index.html BUILT FROM THE TABLE
  pages 1, strings 460; errors 0; warnings 1; pending 0
  warn  content/story/ads.json brennan-steve (caption): "cloud gaming" breaks the copy rule cap-cloud-gaming
  expected edit (not an error of the copy): 1 message(s) "the line is missing: Companion OS is in beta." until site-copy.mts requires Fictional family. Real software. alone on the gallery
  proposed gallery row scripted-scenes      printed
  proposed gallery row stylised-art         printed
  proposed gallery row not-frontier         printed
  proposed gallery row third-party-apps     printed
  proposed gallery row beta-full            printed
  proposed gallery row launch-not-offer     printed
  proposed gallery row fictional-family     printed
  proposed gallery row beta-short           printed

SAY-IT-ONCE on the mock: /core x3, /download x3, docs x2 (header, band, footer = 3, 3; docs header and band)

ROWS 108  errors 0  review 0  warnings 0  controls missed 0
ROWS that need an allowedClaims entry in claims.json before they ship: hero.h1
```

What the rules cannot see, and a person must: that `rent-line` is not yet in `claims.json` (the rules pass the sentence; there is nothing to equal until the owner adds the entry); that "alternative to ChatGPT" (the release state of the proof) is a naming counsel has not ruled on (D4); that "Rented before" is true of the fiction (Sally kept client folders in Dropbox) and is not a statement about any customer; that the `launch-not-offer` line is stale. The one `warn` in the real-lint run is `content/story/ads.json brennan-steve (caption)` ("cloud gaming"): it is in the repo today, not in this copy.

## 12. What this spec leaves out on purpose

- **41 `alternative-to/<service>` pages** (`search-led`). A new indexable page type with a permanence file, thin-page risk (templated from pass-1 families) and two open counsel questions (D4, D5). The pair index in WP1 is built so they can follow as a separate package without touching the lander.
- **The run-time echo of the ad's line** (`?m=answer|uncloud` swapping the H1 before paint). Worth building only when an ad ships that carries "Your AI should answer to you." or the sign-off; `lander.json` `messages` already has the shape for it.
- **A ring on every card picture.** It needs a Core projection for 36 houses and a day regeneration of every thumbnail; the one on the hero home is phase C.
- **Memory on the lander** (`memory-file`), **remote access** (barred by `cap-remote-access`), **an import count** (banned), **"no account"** (on hold).
- **The family page, the home page and the tour.** Their own briefs; the lander's links into them are stable.

## 13. Risks and owner decisions

| # | Risk | Mitigation |
|---|---|---|
| R1 | The ad may say "Back it on Kickstarter" while the buttons say `Buy Companion Core` and `ci.computer/core` redirects to a priced store page and drops the query (D2) | one constant; the owner repoints `/core`; the lander prints no price or date |
| R2 | `rent-line` is not in `claims.json`, so the H1 cannot be proven sanctioned | owner adds the entry; the build warns until then and fails in strict mode if the H1 differs from it |
| R3 | Open WebUI, alternative to ChatGPT is the strongest proof of "intelligence" and is held | one `hold` entry releases it; the fallback proof is already cleared; the ad's `problem` claim carries "renting intelligence" meanwhile |
| R4 | Only the Brennans are v3; the other featured families are pass-1 stories | the gate excludes the known-bad (Kiwix, dead services, dusk houses); the owner lists families (D16); do not send paid traffic to a family page that fails the gate |
| R5 | The Core band moves ahead of the families and CLAUDE.md says "the band after the homes"; pair wording and logos change | the edits in section 10, same commit |
| R6 | A sticky header takes 56 px of a phone | accepted: it is the shortest path to Buy; verified to fit at 320 |
| R7 | `beta-short` prints twice (hero, band) beside "say it once" | it is a disclosure, not an offer; counsel may want a third at the proof (one `finePrint` row) |
| R8 | The in-engine Core might read as a render to counsel | `stylised-art` printed beside it; the fallback is one SVG in the same slot |
| R9 | Cards below the offer and the other 24 inside a closed `<details>` may weigh less for search | static HTML, each family's own page, the footer list of every home, the sitemap and JSON-LD for the featured six |
| R10 | Many tests assert the old page (persona buttons, stats, "thirty", the old beta line) | WP7 lists them; each old assertion is replaced one for one |
| R11 | Offices are teams; `fictional-family` is worded for families | B-16 fails the build until the owner adds a sibling disclosure |
| R12 | `launch-not-offer` is stale and volatile | the owner's wording reaches the page by `fine-print.mts --write`; a close-date check once D2 supplies it |
| R13 | The hero tour still opens on a 66-second unboxing (D14) | the proof's `Watch this moment` skips it |
| R14 | The day thumbnails (WP3b) are a large binary diff and a GPU run | the gate keeps dusk houses out of the six meanwhile; the cards in the details still show their dusk pictures until then (a known daylight-rule breach, W9-homes-pages-03) |
| R15 | Phase C adds 400 to 560 KB of frames | intent-only loading; never with Save-Data; drop to six frames if a budget slips |

**Effort.** About **13 person-days** for phase A (WP1 2, WP2 1, WP3 1.5, WP4 3, WP5 2, WP6 1.5, WP7 2, WP8 0.5; about 7 elapsed with two people, the data lane and the page lane), WP3b 1 plus GPU time, WP9 about 3. Roughly 450 to 600 thousand agent tokens with review for A and C together.

**Owner decisions needed (not already delegated):** 
1. D2, the buy path while the Kickstarter is live (closes 12 Nov): where `Buy Companion Core` and `See Companion Core` go and what the label is. The spec keeps the four destinations and one constant; the owner repoints `ci.computer/core` (the live redirect drops the query) or rules otherwise.
2. Add the `rent-line` entry to `claims.json` and widen the `where` of `stylised-art`, `scripted-scenes` and `third-party-apps` to "landing page" (the H1 cannot be proven sanctioned until then).
3. D4, in two parts: (a) accept "alternative to" (edits to CLAUDE.md and `personas.md` rule 2); (b) rule, with counsel, on the six held pairs (ChatGPT, Cursor, Ring, Backblaze, Spotify, Plex) and on GeForce Now. The spec ships them held; each release is one `hold` entry, and releasing ChatGPT turns the proof into John's stack trace.
4. D5, text-only lander: names in text, no logo, no screenshot, no wall (counsel on naming services and apps in text).
5. D6, imagery: does the engine's own stylised Core count as "drawn" (the fallback is a line SVG in the same slot), and may the owner approve a day regeneration of every card and preview picture (WP3b: a large binary diff and a GPU run)?
6. D16, which families may be featured, beyond the computed gate (today 10 of 30 pass; the six are brennan, salazar, gill, adler, banerjee, rahimi, and all but the Brennans are pass-1 stories).
7. D18 and D19: merge the six apartments by type (families and homes counted apart), and the one grouped Brennan card with all three houses in the details.
8. The wording of `launch-not-offer` (stale and volatile) and, when offices are written, a `fictional-team` sibling of `fictional-family` (the build fails without it).
9. Approval of the CLAUDE.md and README.md edits of section 10 (CLAUDE.md is the repo's law), including, with WP9, the sentence that lets the hero picture carry a "Find the Core" reveal without becoming a second hero action.
