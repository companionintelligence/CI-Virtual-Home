# The lander

The front page (`index.html`) tells the Companion Core story, not the gallery of homes it used to be. A stranger who never scrolls can say what a Core is
("a small personal server that runs your household's apps and local AI at home"), what the page argues ("Stop renting your intelligence.") and what to do
(`Take the tour`, with `Buy Companion Core` in the sticky header). The rules of `CLAUDE.md` bind it ("The public site", "The front page is the story's lander");
this file is the contract of the page's parts. Its code is `scripts/portal-front.mts` (the blocks), `scripts/story/lib/lander.mts` and `pairs.mts` (what to show),
`scripts/story/lib/lander-check.mts` (what the built page must hold), `portal/gallery.js` and `portal/gallery.css`.

## The page

| Block | id | Job | Where its words come from |
|---|---|---|---|
| Header (sticky) | `site-head` | Buy and Download in reach at every scroll position, on a phone too | authored; the four destinations are `LINKS` |
| Hero | `hero` | continue the ad's sentence, say what a Core is, one action | the H1 is the claim named by the plan's first message (`rent-line`); the chip is `finePrint('lander-hero')`; the next two lines are authored, the families word is the data's |
| From rented to kept | `argument` | the argument in three steps | `problem`, `plug-pair-walk`, `local-by-default`, `hub-no-api-bill`, verbatim (`<!-- claim:id -->` markers, `data-claim`) |
| One pair, in full | `proof` | one concrete pair, in the family's own words, with a link into the tour at that moment | the first candidate beat of the plan that may show (`proofOf`); the words are the beat's |
| Meet the Companion Core | `core` | the offer, and what a Core is not | `core-size`, `core-assembled`, `hub-count`; `not-frontier` from `finePrint('lander-core')`; the picture's caption is `stylised-art` |
| What do you rent today? | `swap` | the chooser: a chip for each service, for each job, a search, the kind of place | `stripOf` (the pair index), `categories.json`, the plan's `types` |
| Meet the families | `homes` | six featured cards, then every family and home in a native `<details>` | `featuredOf`, `cardPairs`, the families |
| Footer | | the four destinations, the sign-off, the fine print, the apps named, every home's page | `signoff`; `finePrint('lander-footer')`; `appsNamed`; `galleryHomeIndex` |

The Core's offer is 1.5 screens down on a desktop and 2.35 on a 390 x 844 phone (it was 9.6 and 23.5); the page is at most 5 and 7.5 screens. The test holds both
(`portal-tests/lander.mts`: at most 3 and 2.5 down). Buy, Download and the docs are offered three times (header, band, footer), the main site twice; the build refuses one inside the
argument, the proof, the chooser or the families.

## Words, and where they may come from

Nothing the page says about the product is typed in `index.html`. A claim is `claims.json`'s (`<!-- claim:<id> -->`, checked word for word); the fine print is
`scripts/story/lib/fine-print.mts`'s (`<!-- fine-hero: -->`, `fine-core`, `fine-foot`; the rows `lander-hero`, `lander-core` and `lander-footer` of `assets/story/fine-print.ts`); the lists are
the plan's and the families' (`<!-- lander-proof: -->`, `lander-core-fig`, `lander-swap`, `lander-count`, `lander-apps`, `lander-hero-count`). What is typed in the file is the page's
own connecting copy, which the copy lint reads (`pnpm run story:copy -- dist`). Counts are words ("Thirty fictional families in thirty-six homes."), always beside "fictional"
and never a digit: a digit beside a service reads as a usage figure. The build refuses a count typed in the source.

The wording of a pair is "<app>, alternative to <service>" (`reference/story/personas.md` rule 2). The page never says "replaces".

## The plan (`content/story/lander.json`)

Authored; it holds no copy. `validatePlan` checks it against `content/story/schema/lander.schema.json` and the tree: a hold entry, a primary app, a pinned service or a home type that names
nothing is an error (it would hold nothing and nobody would know); a hero family that is not current, a proof beat that is gone or a claim still on hold is a warning, which a strict build
(`--strict-families`, a push to main) makes an error.

| Field | What it does |
|---|---|
| `hero` | the family whose tour `Take the tour` starts, and its home (the picture). Not current: the hero plays the home |
| `messages[0]` | the H1: the id of a claim. `rent-line` is the owner's own wording (approved 2026-10-20, `ok-verbatim`; the exact line is not in CAMPAIGN.md or COPY.md). A claim on `hold` builds with a warning, and a push to main fails, so an unsanctioned line cannot go live |
| `proof.candidates` | beats in order; the first whose pair may show is the proof. None: the block is left out, with the reason in the build log |
| `hold` | `service\|app` pairs not cleared for the lander (counsel). They are off the chips, the cards, the proof and the search words, never off the family pages or the tour. Release one by deleting its entry |
| `primary` | which app a chip shows when the stories use several |
| `strip` | the chooser: size, the families a service needs, the caps (one chip for each app, two for each registry category and brand), `pin` first |
| `featured` | how many cards, and an optional `override` (held to the same gate) |
| `types` | which homes are apartments or offices. A type with no home is not drawn; the "Kind of place" control appears when two or more types have homes |

## What may show, and who is featured

A pair (`scripts/story/lib/pairs.mts`) is a beat's `service`, else the service its `app.replaces[0]` resolves to by name or alias. It may show only when the service is one the registry lets a story
name (`alternativeToForm` ok, `storyStatus` ok, `link` not never, no `stale` or `story-excluded` flag), the app is in the live store and not `storySafe: avoid`, the pair is not held, and the line
trips none of `claims.json`'s error phrases. Counts are families, not beats.

A family is **ad-ready**, and so may be featured, when no beat uses an `avoid` app, no beat names a service the registry will not let a story name, and its home is lit as day. The page is the
destination of paid traffic: a family that fails is never put in a featured slot (fewer than six is fine). The build prints the strip, the featured six and why families fail (`front:` lines).
The hero's family leads, as one grouped card that names the same people's other homes; then one family for each surname, covering a category not yet covered. A card shows two of its pairs, chosen
across the featured cards so they differ (no pair on more than three); its other cleared pairs wait hidden, so a chip can show the card's own pair for that service.

## The chooser

State lives in the address: `?service=<id>&persona=<category or archetype id>&type=<home|apartment|office>&q=<text>`. Every other parameter (an ad's `utm_` tags, a click id) is kept byte for byte; `q` is
written only when it finds something. A service-targeted ad links `/?service=google-photos`: the chip is lit, the families are filtered and the first is brought into view. A held service, an
id nothing has or a malformed one loads the page unfiltered. A phrase some card holds whole is the search ("google photos" is the Google Photos families); a phrase nothing holds is its words.
Filters open the `<details>`; clearing them puts it back. `/` focuses the search, Escape clears it. The controls are `disabled` in the static page and `portal/gallery.js` enables them, so a page
with no script has no dead controls; everything that argues, proves and offers reads without it.

## The Core's picture

`pnpm run portal:thumbs -- --stage` renders frame 240 of the committed `core-orbit` shot (the side-on view with the Core's front panel to the camera) in daylight, through the offline composer, to
`portal/stage/<house>/core-0-1200.webp` (at most 70 KB) and `core-0-640.webp` (at most 28 KB). The house is the plan's hero's. It is drawn stylised, never a photograph, and the page prints
`stylised-art` beside it. Without the frames the band prints the line with the rest of its fine print.

## Checks

- `portal:build` step 7 runs `landerChecks` and `landerHeadChecks` (`scripts/story/lib/lander-check.mts`): one `h1` that is the claim; the blocks in order; every `data-claim` and `data-fine` word for word;
  the fine print each block owes; three offers and none in the wrong block; no image from `portal/apps/` or `portal/ci/`; no "replaces"; no digit on a chip; nothing held anywhere (the cards, the proof, the search
  words); the featured cards and the proof are the data's; the title carries the message and the Core, the description is 120 to 160 characters with the fiction line.
- `pnpm run test:node`: `test-pairs`, `test-lander` (the plan, the gate, the featured choice, the proof), `test-lander-page` (the page checks, a negative control for each), `test-gallery-count`.
- `pnpm run portal:test -- --only gallery,campaign` and `-- --only hooks --hook lander`: the fold, depth, the sticky header, the chooser with an ad's tags, deep links, no JavaScript, the list refused, heading levels,
  touch targets, the tags on every way in.
- The phone rules (`portal-tests/mobile-site.mts`, at 390 x 844, 360 x 640, 320 x 568 and 844 x 390 on its side): nothing scrolls sideways and every box is border-box; the header is one slim bar (56 px, 52 on its
  side) with Download and Buy in it on every page and no menu hiding them; every control is a 44 px target; type is 13 px for a label, 14 px for small print and 16 px for reading text (a text field 16 px);
  every image has its size, the far ones are lazy and the hero is the 640 px picture; the Core's offer is at most 2.5 screens down; safe-area insets, a visible focus ring, reduced motion, contrast in both colour
  sets, the screenshot dialog's fit, and the Slow 4G budget (the largest picture in 2.5 s, a shift under 0.05, under 1 MB before a first touch). `scripts/test-site-css.mts` (quick, in `test:node`) holds
  the stylesheets' braces and the header's markup without a browser.

## Not built, on purpose

- The "Find the Core" reveal and the turnable Core (phase C of the spec): they need seven more frames and a hotspot, and sit behind a kill switch when they come.
- Pages for each service ("alternative to <service>"): a new page type with counsel's questions open.
- A front link-preview card (`portal/og/front.jpg`): the page uses the hero's picture until `portal:og` makes one.
- A day regeneration of the dusk and golden homes' pictures: until then they are never featured.
- Offices: the build fails if a home of type `office` exists and `claims.json` has no `fictional-team` disclosure.
