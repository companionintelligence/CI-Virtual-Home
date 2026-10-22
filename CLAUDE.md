# CLAUDE.md — ci-virtual-home

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

The Companion Intelligence virtual-home generator: HouseSpec JSON → 3D scenes, CAD floor plans, isometric
SVG/Lottie and product-shot videos. Start with [README.md](README.md) (commands, layout, how the gate works)
and [reference/HOUSE-SPEC.md](reference/HOUSE-SPEC.md) (the schema).

## Rules

**Source vs derived.** The sources are `content/families/<slug>.json` (the family stories), `content/story/` (the cast plan, personas, claims, catalog, roles, voices, lexicon, the lander plan `lander.json`, schema; `casting.json` is derived, below), `content/houses/<id>.json`, `assets/**/*.ts`, `room-creator.html`,
`index.html`, `portal/*.css` and `portal/*.js`, `scripts/` and `reference/`. Everything else is generated — never hand-edit it; change the source and re-run:

| Derived file | Regenerate with |
|---|---|
| `assets/**/*.js` (gitignored) | `pnpm run build` |
| `content/houses/<id>.plan.json` | `pnpm run plans` |
| `content/houses/index.json` | `pnpm run index` (the front page holds no count: `portal:build` writes its counts as words from this list) |
| `content/house-catalog.json`, `assets/props/measured.ts` | `pnpm run catalog` |
| `assets/site-species-masks.ts` (what each planting species hides of the mulch, and its triangle cost) | `node --experimental-strip-types scripts/measure-species.mts --write` — after a change to a species' geometry (`assets/site-species.ts`, the flower heads and grass tuft in `assets/site.ts`), then `pnpm run build`; `scripts/test-site-species.mts` fails until it is done |
| `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json` | `pnpm run iso` |
| `scenes/floorplans/` | `pnpm run floorplans` |
| `test/goldens/<profile>/` | `pnpm run goldens:update` — only on purpose, see below |
| `portal/thumbs/<id>.webp`, `portal/hero.webp`, `portal/previews/<id>.jpg`, `portal/hero.jpg` | `pnpm run portal:thumbs [--house <id>]` — after a change to how a house looks |
| `portal/stage/<house>/core-0-{1200,640}.webp` (the Core's picture in the lander's band) | `pnpm run portal:thumbs -- --stage` — after a change to how the Core or the hero's Library looks |
| `portal/icons/*` (the favicon, the manifest's PNGs, the apple-touch-icon) | `pnpm run portal:icons` — after a change to `assets/brand/ci-logo-mark.svg` |
| `content/story/casting.json`, `reference/story/cast.md` | `pnpm run story:cast` (from `content/story/cast-plan.json`, the house files and `roles.json`; after the plan or a house changed; `--check` fails when stale; `story:cast-lint` holds the plan to the fleet rules) |
| `content/families/<slug>.voice.json`, `content/families/<slug>/audio/*.m4a` | `pnpm run story:voice -- <slug>` (local Kokoro; after the story text changed: `--stale`) |
| `content/families/<slug>.bake.json` | `pnpm run story:bake -- <slug>` (after the voice, after a story or a role-table change) |
| `portal/og/*.jpg`, `portal/og/manifest.json` | `pnpm run portal:og` (after a family's text or its preview picture changed) |
| `portal/apps/<id>/*.webp`, `portal/ci/*.webp`, `content/story/app-media.json` | `pnpm run story:media` (real logos and screenshots, from the sibling repos' git objects at the manifest's pinned commits; `-- --check` fails when stale) |
| `content/story/services.json` (the derived columns: `apps`, `storyApps`, `storyStatus`, `incumbentNameList`, `fleetHomes`, `rank`, `top80`) | `pnpm run story:services` (from `catalog-apps.json`, `claims.json` and `content/families`; the facts in the file are authored; `story:services:check` fails when stale and is part of `pnpm run test`; [`reference/story/story-v3.md`](reference/story/story-v3.md)) |
| `content/families/films.json`, `content/families/<slug>/film/` | `pnpm run story:film -- <slug>` |
| the `CLAIMS_SNAPSHOT` block in `assets/story/fine-print.ts` (the player's mirror of `content/story/claims.json`'s disclosures; the fine print each page owes is `reference/story/fine-print.md`) | `node --experimental-strip-types scripts/story/lib/fine-print.mts --write` after a change to `claims.json`; `scripts/test-fine-print.mts` fails until it is done |
| `dist/` (gitignored) | `pnpm run portal:build` |

Edit `assets/*.ts`, never the compiled `.js` beside it. `assets/vendor/` is third-party: do not edit it (the
one existing patch is documented in THIRD_PARTY.md) and do not run the build over it.

**Determinism.** A rendered frame must be a pure function of the tree:

- No `Math.random`, `Date.now`, `performance.now` or any wall clock in anything a frame depends on. Seed from
  `mulberry32` / `fnv1a` in `assets/materials.ts` — props get `ctx.rng`, a per-instance stream from the kit's
  `itemRng`, which is keyed off the house's seed.
- `window.__houseRenderFrames(i)` is **random access** — the frame-hash test renders frames 0, 200 and 719
  directly. Nothing in the per-frame path may carry state from the previous frame; derive everything from `i`.
- Capture scripts must `await window.__houseComposerWarm({ res })` after `houseReady` (SMAA's lookups decode
  asynchronously; the first frame through a cold composer is a different picture) and must stub
  `fonts.googleapis.com` with `assets/fonts/` and await `document.fonts.ready`, as test-goldens.mts does.
- The Python generators are deterministic too (`random.Random(spec id)`); re-running one on an unchanged tree
  must leave `git status` clean.

**The public site.** The lander (`index.html`: the Companion Core's argument, then the families and their homes), a home's own page (`homes/<id>`), a fictional family's page
(`family/<slug>`, one per current family) and the player (`room-creator.html?mode=view&house=<id>`, `assets/viewer.ts`; with
`&family=<slug>` it plays that family's narrated tour) are deployed to Cloudflare Pages at <https://homes.ci.computer/>:

- `.github/workflows/ci.yml` assembles the site and keeps it as an artifact; `.github/workflows/deploy.yml` publishes
  that artifact — `main` to production once `ci` passes on it, a same-repo PR to
  `https://pr-<n>.ci-virtual-home.pages.dev/` (README → Deploying). Its token (`CLOUDFLARE_API_TOKEN`, Cloudflare
  Pages · Edit) can publish to or delete every Pages project on the account, so it lives only in the `production` and
  `preview` GitHub environments (each limited to `main`), and only `deploy.yml`'s upload job holds it. Keep it that
  way: no repository secret, no checkout or repository script in `deploy.yml`, no code from a branch run in it (a PR
  is built in `ci.yml`'s own run and arrives as an artifact), actions pinned to commits in both workflows. `main`
  must stay protected — pull requests only, a code owner's review, `.github/CODEOWNERS` covering `.github/` — because
  whoever can change `deploy.yml` on `main` can read the token; `deploy.yml` skips until it is. Only the owner sets
  the token; never ask for it.
- Google Analytics 4 is injected into the production site's HTML by an inline step in `deploy.yml` ("Inject Google Analytics"),
  from the repository variable `GA_MEASUREMENT_ID` (a variable, not a secret). Never hardcode the id; the step is a no-op
  unless it matches `/^G-[A-Z0-9]+$/`, and it is idempotent. Its two tags carry `data-cfasync="false"` (the zone has Rocket Loader on).
  The site's only CSP is `frame-ancestors` (`portal/_headers`), which restricts no script, so no header change is needed; if a
  `script-src` is ever added it must allow `googletagmanager.com` and `google-analytics.com`. The site's pages therefore are not
  free of third parties once deployed (the source pages are): consent handling is the owner's call. A step after the upload
  smoke-tests the live address (404 for an unknown path, `robots.txt` as text/plain, a sitemap with URLs).
  `pnpm run test:node` runs both inline scripts from `deploy.yml` as they are (`scripts/test-deploy-workflow.mts`).
- Do not deploy by hand; merge, or ask the owner to run the workflow. The by-hand steps in the README are the
  owner's fallback. GitHub Pages is retired (its github.io address redirects to a dead org domain): do not bring a
  github.io deploy back, and do not make Wrangler a devDependency.
- Every URL in them must be relative — no leading `/`. `portal:build` fails on a root-relative one, and
  `portal:test` serves the site under a sub-path (`/ci-virtual-home/`) so that one fails there too.
- The player is additive: everything it needs from the page goes through the one object `room-creator.html`
  hands `mountViewer`, and every editor change it needs is behind `VIEW_MODE`. Without `?mode=view` the page
  must stay the editor exactly, and the `__house*` hooks the gates use must not change. It plays shots through
  `applySplineFrame`, never a copy of it.
- The player may use the clock (nothing it draws is a product frame), but it must restore anything of the
  renderer's it changes for its own frame (it puts `shadowMap.autoUpdate` back after each one).
- Until the player mounts, `room-creator.html`'s head script (view mode only) is the player: poster, loader and
  the failure card. Anything that can stop the page before `mountViewer` must end on that card, never on an
  endless loader. Only the page's own scripts are the player's: a refused third-party tag (the gtag the deploy
  injects, Cloudflare's beacon the zone injects; a blocker, a DNS filter or a work profile stops them) fires the
  same `error` and must never raise the card, and a card raised before the mount is removed by it (`portal:test`,
  failures).
- `portal:build` writes more than copies: `dist/homes/<id>.html` share pages, `dist/family/<slug>.html` family pages and the tour's data
  (below), one `<meta name="vh-share">` in `dist/room-creator.html` that tells the player they exist, the site's title and preview tags in
  place of that page's static (editor) head, and absolute preview-image URLs (`--site-url`, default `https://homes.ci.computer/`).
- Search hygiene is also `portal:build`'s (5d2): canonical, twitter title/description/image and JSON-LD (publisher, site, the list of
  homes, a home's page and breadcrumb: `scripts/portal-pages.mts`) on every page, plus `404.html`, `robots.txt` and `sitemap.xml`.
  Canonical and sitemap URLs are the extensionless ones Pages serves (`/homes/<id>`), never `.html` (that answers 308), and the built
  pages link each other without `.html` too: the gallery is `./` or `../`, never `./index.html` (`portal:build` fails on it, in the player
  too). A new page needs a `seo(...)` call there (a family's page writes its own head in `scripts/story/pages.mts`) and an entry in step 7's checks. The player and the editor are one file and are
  `noindex, follow` in that file's own HTML (written by `portal:build`, never by a script a crawler may not run) and have no canonical:
  what a search engine finds is the gallery, each home's page and each family's page. The preview tags sit right after the page's last `og:`/`twitter:` tag, and
  the import map just before the first module, so `<meta charset>` (inside 1024 bytes) and `og:image` (inside 4 KB) come first;
  every title is at most 60 characters (`homeTitle` and `familyPageTitle` drop the brand for a long name) and every `og:image` has a `twitter:image:alt`.
- A home's page (`homes/<id>`, from `portal-pages.mts`) is a page of its own, not a redirect: only a link that carries a moment (`shot`,
  `t`, `tod`, `play`) forwards to the player. Every page of the site (gallery, a home's page, a family's page, 404), the player's own HTML (a `<noscript>`
  in `room-creator.html`) and the player's end card and About panel send a visitor to exactly `https://ci.computer`, `https://ci.computer/core` (Buy Companion Core), `https://ci.computer/download`
  (Download Companion) and the docs (`LINKS` in `portal-pages.mts`; `assets/viewer.ts` has the same four); `portal:build` fails without them.
  No prices, specs or availability on these pages: reuse the wording ci.computer and the docs use. Say it once: Buy and Download are offered
  by the sticky header, the one Core band and the footer (the hero only says what a Core is and points at the band), and the
  main site is linked from the header and the footer list only. On a phone the player's About panel is More > About (the "?" button
  needs the room a phone's top bar has not), its links are 44 px targets, and it does not list keyboard shortcuts; the end card's two
  links are a row of 32 px (44 px on touch) targets.
<!-- front page -->
- **The front page is the story's lander** (`index.html`, `portal/gallery.js`, `scripts/portal-front.mts`, `scripts/story/lib/lander.mts` and `pairs.mts`, the plan `content/story/lander.json`; the contract and the checks are
  `reference/story/lander.md`; `portal:build` writes it at step 5d from the current families, `story.built`). Six blocks and a sticky header, in this order: the hero ("Stop renting your intelligence.", the claim `rent-line` of
  `claims.json`; what a Core is in one sentence; "Fictional family. Real software." and the full beta line; `Take the tour` is its one action, the Brennans' tour, `hero` in the plan; `See Companion Core` only points at the band),
  "From rented to kept" (claims.json's words), "One pair, in full" (a beat of a family file, with `Watch this moment` into the tour), the one Core band (`#core`: the claims, the engine's stylised Core, Buy, Download, the docs, what a Core
  is not), the chooser "What do you rent today?" and the families (six featured cards, then every other family and home in a native `<details>`). Say it once: the header, the band and the footer keep `Buy Companion Core` and
  `Download Companion`. A family's card goes to its page (`family/<slug>`, which goes on to the tour); a home with no current family keeps its plain card, which goes to the player. The cards are **static HTML in the built
  `index.html`** (`gallery.js` adopts them and draws a card only for a home with none), so a crawler, a visitor without JavaScript and an in-app browser with a slow script see them, and the chooser's controls are `disabled` until the
  script runs. No UI mockup, no invented screen, no logo or screenshot on this page (the family pages keep their labelled real media), no price, daylight only. A pair is written `<app>, alternative to <service>`, never "replaces", and
  never one `claims.json` stops or the plan holds (`hold`: pairs counsel has not cleared; releasing one is deleting its entry). A card names a family by the place of its address ("The Brennan family of Wrenfield"). The featured
  families must pass the ad-ready gate (no `avoid` app, no service a story may not name, a home lit as day): the page is the destination of paid traffic, so a family that fails is never put in a slot. Counts are words, always
  beside "fictional" and never a digit ("Thirty fictional families in thirty-six homes."), written by the build from the data; `portal:build` fails on a count typed in `index.html` (step 5b) and runs
  `scripts/story/lib/lander-check.mts` on the built page (step 7). A phone's hero picture is the 640 px thumbnail, never a 1600 px image (it drove the LCP to 3.5 s). The six apartments are declared without a family in
  `content/story/cast-plan.json` (`homesWithoutFamily`; `portal:build` names them, `story:cast-lint` holds the list to the homes, `--strict-families` errors on a home that is neither current nor declared), so the copy never says
  every home has a family. The H1's claim `rent-line` is the owner's own wording (approved 2026-10-20, `status: ok-verbatim`; it is not in CAMPAIGN.md or COPY.md). A claim the plan names that is on `hold` still builds with a warning and fails a strict build (a push to main), so an unsanctioned line cannot go live.
- The homes' own pages are linked by the footer's "Every home, on its own page" list, which `portal:build` writes at the `<!-- foot-homes: -->` marker in
  `index.html` and `gallery.js` leaves alone, so the rendered DOM links them and not only the sitemap does. A home's page carries "Meet the family" when a
  current family lives there (`<!-- meet-family: -->`, written by the same step).
- The lander's claims and fine print are `claims.json`'s words, never retyped in `index.html`: `portal:build` writes a claim at its `<!-- claim:<id> -->` marker (the page marks it `data-claim`, and the build checks it word for word)
  and the fine print at `<!-- fine-hero: -->`, `<!-- fine-core: -->` and `<!-- fine-foot: -->` from `scripts/story/lib/fine-print.mts` (surfaces `lander-hero`, `lander-core`, `lander-footer`; `reference/story/fine-print.md`). Every
  row of `DISCLOSURES` in `scripts/story/lib/site-copy.mts` is enforced, so `story:copy` fails a page that drops one.
- **Campaign passthrough** (`portal/campaign.js`, plain script, no imports): the ad's tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
  `utm_term`, `fbclid`, `ttclid`, `gclid`, `msclkid`) are kept in `sessionStorage` (`ci-campaign`) and added, **at run time only**, to every link to
  `https://ci.computer`, `/core` and `/download` and to every relative link marked `data-campaign`. The built hrefs never carry a query (step 7 fails on
  one), no page may rewrite them in the HTML, and the docs, privacy and terms links never get tags. Every page of the site loads it
  (`<script src="./portal/campaign.js" defer data-cfasync="false"></script>`, `../portal/` one level down, before any script that writes the address); a
  script that rewrites the address keeps the parameters that are not its own (gallery.js does, and so does the player's `url()`: `OWN_PARAMS` in `assets/viewer.ts` and `assets/story/url.ts` is the one list of what is the player's own, and `family-pages.mts` asserts it). `scripts/test-campaign.mts`
  (`pnpm run test:campaign`, quick) and the `campaign` leg of `portal:test` check it.
<!-- end front page -->
- **The public pages on a phone** (the front page, a family's page, a home's page, the 404; `scripts/story/portal-tests/mobile-site.mts` at 390 x 844, 360 x 640, 320 x 568 and 844 x 390 on its side, and `scripts/test-site-css.mts`, quick):
  the stylesheets' braces stay balanced (a stray `}` once dropped `*, *::before, *::after { box-sizing: border-box }` and every page laid out in content-box: a 69 px header, a front page wider than the
  screen); the header is one bar on every page (the lockup, Docs from 701 px, Download, Buy; a phone shows "Download" and "Buy Core", never a menu that hides them); every control is a 44 px target; type is
  13 px for a label, 14 px for small print and 16 px for reading text on a phone (a text field 16 px, so it does not zoom); the bars that stick (the header, a family's people, the tour button) are as slim as a
  44 px target allows and the last two let go on a short screen; the body and every fixed or absolute edge element honour `env(safe-area-inset-*)`; the screenshot dialog keeps both its buttons on the screen
  (the owner's type scale for it is unchanged); no card picture is eager (the hero's is the first screen's). The tour's own sheet and type scale are `portal/viewer.css` and `portal/story.css`, not these.
- Every executable `<script>` in the built pages has `data-cfasync="false"` (Cloudflare's Rocket Loader is on for the zone and would
  run the player's head script after the first paint); `portal:build` checks it. New icons go through `pnpm run portal:icons`.
- A home's name on the portal is `displayName` in `assets/home-names.ts`, never the spec's `name` directly (that is the title the
  home was filed under: an internal record). Fix a name there, not in `content/houses/`.
- **No credits on the public site.** No builder credit and no mention of the build a home was written from (a handle, "by <name>", a
  title, "Sims", "Base Game", "BG ") is shown or shipped anywhere: not on a card, in a tooltip, the player, a home's page, a family's page,
  the footer, the search, the JSON-LD, a script, a stylesheet or a data file. The specs' `author` and `source` fields (and the filed
  `name`) stay in `content/houses/<id>.json` and `index.json` as internal records and are redacted from `dist/`: `portal:build` ships
  each spec and the list without `author` and `source` and with `name` = `displayName` (`scripts/portal-redact.mts`), and its step 8
  fails the build if any text file under `dist/` contains a builder handle (derived from the `author` fields, never listed), the word
  "Sims", "Base Game" or "BG " (the allowlist, `GUARD_ALLOW`, is empty: keep it so). A new surface that wants a name uses
  `displayName` and credits no one; never read `author`, `source` or the spec's `name` in a page, a script that ships or the player.
  The one author that is not a handle is the company's own name, `Companion Intelligence` (`scripts/own-authors.mts`, matched whole: a home it wrote itself, the apartments of
  `reference/APARTMENTS.md`, is credited to it, and it is on every page); the credit guard and the story's leak scan both skip it, `GUARD_ALLOW` stays empty, and every other value is still a handle.
  A home's display name must not be a phrase a family's words contain (`check-leaks.mts`: the loft is "Warehouse Loft" because a family's story has a "studio loft").
  `THIRD_PARTY.md` and `ATTRIBUTION.md` are internal licence records for dependencies and models: leave them.
- **The homes portal names its homes**, by `displayName`, and nothing else about where they came from. The salvage branch's rule that no home
  or house id is ever public (sanitised specs, a stub of `home-names`) is NOT adopted. What holds of it: a STORY's words never name a home,
  a builder or a house id (the validator's internal-ids rule and `scripts/story/check-leaks.mts`, which scans the families' text); a
  family's page is keyed by the family's slug (`^[a-z]+(-[a-z]+){0,2}$`, never a house id: `family/<slug>`); and it carries one fine-print
  line that names the home by its display name and links `homes/<id>` (`homeNote` in `scripts/story/pages.mts`), with no credit.
- **The story system** (`content/families/<slug>.json`, `content/story/`, `reference/story/`, `assets/story/`, `scripts/story/`). The families are
  fictional, two to six members each with an archetype, told as the argument for uncloud: the contract is `reference/story/personas.md`
  (read it first; the validator, the bake, the voice and the film follow it). Who lives where is `content/story/cast-plan.json`
  (`reference/story/cast.md` is the readable table of it). A home that has no family yet is listed there under `homesWithoutFamily` with a reason (the six apartments); `story:cast-lint` fails a home that is in neither place, and one that is in both. One file per family is the one source of every word: the page,
  the popups, the captions, the voice-over and the film are all made from it. The order after an edit: `pnpm run story:validate -- <slug>`,
  `story:voice -- <slug> --stale`, `story:bake -- <slug>`, `portal:og`, then `portal:build` and `portal:test`. The `.voice.json`,
  `.bake.json`, audio and link-preview images are generated and committed; never hand-edit them. Every app a story names must be in
  `content/story/catalog-apps.json` (the Companion Hub's catalog); do not invent an app or a capability, and take product claims only from
  `content/story/claims.json`. Companion OS is in beta and the site says so. The families are fictional and say so wherever a family is
  ("Fictional family. Real software."); the Companion Core is always drawn stylised. No UI mockup or invented app screen, no household with
  separate platform accounts, no person presented as a customer, daylight and warm light only (CI-Common `ADS.md`: the lander and the
  videos are held to it). A family file tells exactly the people `casting.json` lists for its home (id, name, age, role, archetype, companion's
  name, surname, address place: rule `casting`) and should use the plan's `signatureApps` (`casting-apps`); to change a person, change
  `cast-plan.json` and run `story:cast`, never the family file alone. The validator's tests run on `test/fixtures/stories/world/` and the
  bake's on a frozen `aurora` (`test/fixtures/stories/bake-world/houses/`), so a re-lay of a shipped home cannot fail them; the roles a home has
  come from `content/story/roles.json`'s type lists, which are ours to extend (a new furniture type that plainly serves a role is listed under it).
- `portal:build` adds the story in ONE call (`scripts/story/site.mts`, step 5c2 of `build-portal.mts`; the seams are `scripts/story/hooks.ts`):
  `family/<slug>.html` per family, `story/manifest.json` (the one un-hashed data file: the family list, each family's house, tour, voice clips
  and film), `story/families.<hash10>.json` (the cards a families front page reads), the clips, the posters and captions, the link-preview
  images and the display face. Every one carries a content hash in its name (`<name>.<hash10>.<ext>`) except the manifest, and `_headers`
  keeps only those for a year; the homes' own files (named by house id) stay on revalidate. Other packages add files through
  `scripts/story/ship/*.mts` and tests through `scripts/story/portal-tests/*.mts`; they do not edit `build-portal.mts` or `test-portal.mts`.
  A family page is held to the homes' pages' rules in step 7 (the four links, one h1 and one main, title and description lengths, relative
  extensionless links, `data-cfasync="false"`). The gallery is the families' front page (above): it plugs in at the `FRONT PAGE HOOK` in
  `build-portal.mts` (the cards are `story.cards`, the data a card needs beyond them is read by `scripts/portal-front.mts`).
- **Stale families.** A family is shipped only when it is current (in the casting, in a house that exists, apps in the live store, the
  validator clean, its words clean). One that is not has no page and no tour; the build lists it with its first reason and carries on, because
  a family written for a house that has since been re-laid is the ordinary state of a re-cast. `--strict-families` (or `CI_STORY_STRICT=1`)
  makes every stale family, every casting family without a file and every ship-step note an error: use it where the whole cast must be
  there (the production deploy). `--stale-report` prints every reason.
- Copy on the site follows the Uncloud voice (CI-Common `uncloud-voice`): no em or en dashes, sentence case, no price or performance number
  that is not on the fact sheet, "Fictional family. Real software." wherever a family is, Companion OS is in beta.
  `scripts/story/check-copy.mts` (`pnpm run story:copy -- dist`, in CI after `portal:build` and in `portal:test`'s `gallery` and `hooks` legs) lints every built page and data file a visitor reads
  (the front page and its band and footer, the homes' pages, the family pages, the 404, the player's HTML, the tours' data, the cards, the ad plan and the player's strings) against `content/story/claims.json`; a disclosure the claims owe a page that nothing prints yet is listed as pending, never silently skipped (`--strict` fails on it).
- **The voice-over is generated locally** (`pnpm run story:voice`, Kokoro-82M, Apache-2.0, CPU, no network at run time). No cloud
  text-to-speech service, no API key, ever; macOS `say` is a labelled last resort only. Nothing in the pipeline is shipped but its
  output: the AAC clips, which are content-hashed (`<clip>.<hash10>.m4a`), loaded per beat and only after the viewer chooses
  sound. Every shipped binary (audio, image, film poster) carries a content hash in its name and is shipped by a
  `scripts/story/ship/*.mts` step. New components go in THIRD_PARTY.md in the same commit (code, model, voices, licence, source URL).
- **The tour is a live-player feature.** It exists only for `room-creator.html?mode=view&house=<id>&family=<slug>` (`?no=story` switches it
  off); its modules are `assets/story/` and `portal/story.css`, and its hook in `assets/viewer.ts` is a few additive lines behind `VIEW_MODE`
  (a lazy import, `prepare()` before the shots are listed, `family` kept in the address and the share link, the clock published for it).
  `room-creator.html` is main's, unchanged. The tour follows the HOUSE: `assets/story/mount.ts` finds the family that lives in the house on
  screen through `story/manifest.json`, so the next home plays its own family's tour or none. Offline rendering, the 150 goldens, the
  fixtures and the films' frames do not go through it: a change that moves a golden is a bug in the change.
<!-- ---- family pages ---- -->
- **A family's page is an ad's landing page** (`scripts/story/pages.mts`, `portal/family.css`; the ad rules of `reference/story/personas.md` "Ads" bind it). It reads with no JavaScript and no
  WebGL. Above the fold: the name, the tagline, the home's picture, "Take the tour" and "See Companion Core" (exactly `https://ci.computer/core`; the chrome keeps "Buy Companion Core" and "Download
  Companion"), the one line "The tour draws the home in 3D in your browser." (never "streamed"), and the disclosure strip printed from `claims.json`. Then a section per person with the member's id as
  its `id` (`family/<slug>#sally`), their moments (each "Watch this moment" = `&beat=<id>`) and "Start with <name>" (`&member=<id>`). Every link into the player carries `data-campaign` and the page loads
  `portal/campaign.js` when the tree has it (the build tolerates its absence). Three homes carry one family name, so a page's title takes the place of its address when the name is shared
  (`uniqueLabels`): the build fails on two pages with one title. The footer never says "no analytics" or "no third-party requests" (the deployed site adds Google Analytics).
- **The tour's way in and out** (`assets/story/url.ts`, `reference/story/player.md`): `?member=<id>` opens at the first beat of that person's OWN room (the chapter with most of their beats),
  the start card lists the family, the player's own `url()` keeps the address's other parameters (a campaign's tags; `OWN_PARAMS` is the one list, in `viewer.ts` and `url.ts`), a family with no
  voice lock has a captions-only tour (`narration: false` in `story/manifest.json`, no error, no sound button), a tour opens in daylight unless `&tod=` says otherwise, and a player that cannot start
  (no WebGL 2, a context taken back) ends on the failure card with "Read the family's story" to `family/<slug>`.
<!-- ---- end family pages ---- -->
<!-- ---- ad kit ---- -->
- **The ad kit** (`pnpm run story:ads`, `reference/story/ads.md`): a persona CUT is one member's story as a 15 to 25 second SILENT vertical ad (the hook beat's title, the beat on the tour's own camera with
  its card, chips and burned captions, an end card: "See Companion Core", `ci.computer/core`, the beta line and the other disclosures `claims.json` requires), 9:16, 1:1, 4:5 and 16:9. It is made by
  `scripts/render-persona-cuts.mts` from a family's story and bake lock (estimated durations are fine: no voice, no voice lock) through the same offline path as `story:film`, with the page's own
  `?lighting=day` so a dusk home is lit as an ad may be (ADS.md: day or golden hour, never night); the overlay is the canon's LIGHT set. `content/story/ads.json` is the plan, generated for every family
  that parses (never hand-edit; `story:ads -- --check` says when it is stale); the videos are under `video/ads/` (gitignored: videos never ship in git or on Pages). The GPU path is `--gl default`
  (`PERSONA_CUT_GL`; the machine's own GPU through ANGLE; `software` is SwiftShader, hours a cut; never `--use-angle=vulkan`, it draws blank frames). `story:film`'s files and exports are not changed by it.
<!-- ---- end ad kit ---- -->
<!-- ---- app media ---- -->
- **App media** (`pnpm run story:media`, `scripts/story/build-app-media.mts`, `scripts/story/lib/media.mts`, contract `reference/story/story-v2.md` "App media"): real logos and real
  screenshots of the apps the families use, of Companion Hub and of the Companion account page, as content-hashed WebP under `portal/apps/<id>/` and `portal/ci/` and the manifest
  `content/story/app-media.json` (sorted keys, no timestamps; all generated and committed, never hand-edited). The rule: a **logo identifies the app named beside it** (alt text
  "<Name> logo"; 128 px, at most 12 KB; also allowed inside a chip of an ad cut, never alone); a **screenshot is real, unedited, whole and labelled** ("Real screenshot of <Name> from a
  Companion Hub QA run. Not a recording of this family."; 960 px wide, at most 90 KB) and is never composited into a scene, the tour or a cut (a cut inset stays off unless the owner says so).
  Sources are read with `git cat-file` from the sibling repos at the commits the manifest pins, never from a working tree; each screenshot that ships was looked at by eye and its git
  blob id is in `VETTED` (a changed source stops the build until someone looks again), and every candidate left out is in `rejected` with its reason (a person's name, an email, a login
  secret, a token, an internal host or address, a payment detail, an error page, a blank page, a different product, a claim the site does not make). Only ffmpeg with libwebp makes the
  files (no image library, none may be added); a rerun on the same ffmpeg gives the same bytes. Page generators read the manifest through `scripts/story/lib/media.mts` (`logoImg`,
  `shotFigure`: lazy, width and height set, alt text, the caption; the front page shows none). `portal:build` (the `app media` blocks of `scripts/build-portal.mts`)
  ships only the files the manifest names, fails on a manifest or page that names a missing file, an image without alt text, size or loading, or a screenshot without its caption,
  warns with the list of apps a family uses that have no entry, and scans the manifest's words with the credit guard; `portal/_headers` keeps `/portal/apps/*` and `/portal/ci/*`
  for a year. `pnpm run story:media:test` (quick, in `test:node`) holds all of it. Each source is a THIRD_PARTY.md row. A new app a family uses: `story:media`; a screenshot that
  should ship is added to `SHOT_SHOWS` and `VETTED` only after looking at it.
<!-- ---- end app media ---- -->
<!-- ---- layout (story v2) ---- -->
- **The layout of the story pages** (`scripts/story/pages.mts`, `scripts/story/lib/plan-map.mts`, `scripts/portal-front.mts`, `portal/family.css`, `portal/media.css`, `portal/gallery.css`; `assets/story/popup.ts` for the card): everything
  a visitor reads is in the built HTML. A family page's people live in `<div class="people">`, whose first child is the sticky `nav.who-nav` (portal/family.js marks the person being read with `aria-current`; a chip never changes size);
  a person's section holds, in order, the bio (`member.profile`, else their `work`), the card "Rented before, on the Core now" (`swapOf`/`swapHtml`: a pair the story's copy rules stop, such as "replaces ChatGPT", is left out here and
  on the cards), the moments (the chip that names an app wears its real 24 px logo; a beat's `detail` is a native `<details class="more">`) and up to three real screenshots of their apps (a link to the picture,
  `data-shot`, with the manifest's exact caption; `portal/shots.js` opens it in the page's one `<dialog>`). After the people: "A day in the house" (`family.day`), "The home" (`family.home`, and from the spec: storeys, floor
  area, rooms and the floor plan, one SVG for each storey in one shared view box with a 44 px pin for each person as an HTML link laid over it by percentage; a room's name is the spec's in sentence case, "Master" is "Primary",
  "Portal" is "Archway", and a name that does not fit its room at 7 units is a tooltip only), the apps with their logos, "How it runs" and how the Core starts. The **plan is a diagram** (it says so): never a plan of walls, doors or
  stairs, and the pin is where the casting puts the person. Real media is lazy and sized (`checkPageImages` in the build); the front page carries none. In the tour the card's "More" button takes no height (negative margins on a 44 px box), pauses the tour when it opens, and on a phone a sheet (up to 55 % of the height) never grows into the
  subject. Never put a screenshot in the tour, a scene or an ad cut; never an app's logo without its name beside it. Tests: `pnpm run test:node` (`test-story-pages.mts`) and `portal:test -- --only hooks`.
<!-- ---- end layout (story v2) ---- -->
<!-- ---- type scale (live pass 3) ---- -->
- **The tour's cards and dialogs are set in the CI canon's type scale** (the owner asked for a 36 px minimum and, seeing it, for 30 percent less, "reference the website"): rem of the canon's 17 px root, reading text in a
  modal (card, start and end cards, About, failure card, the family page's screenshot dialog) **1.5rem = 25.5 px at 768 px and wider, `clamp(20px, 5.4vw, 25.5px)` on a phone**, a card's title 2.25rem, the start and end cards'
  heading 2.6rem; Manrope 400 body, 500 controls, 600 chips, 700 titles and names (no 800), 0.2pt tracking. The tokens are `--st-min`, `--st-title` and `--st-hook` in `portal/viewer.css`; every size in the tour's CSS is one of them.
  A card is `clamp(420px, 32vw, 560px)` wide, a phone's sheet up to 55 % of the height; the placement solver (`assets/story/place.ts`) may shrink padding, choose another slot or a narrower and taller card, and never shrinks type.
  **A person's name is a kicker** on every card, dialog and family-page label: all capitals by CSS (the text and aria-labels stay as written), 700, 0.2em of tracking, in the accent; "THE BRENNAN FAMILY" the same. Film and ad
  canvases keep 36 design px (a canvas is shown scaled down). Details and the table: `reference/story/player.md`, "Type and size". Tests: `scripts/test-story-place.mts`, `scripts/test-story-pages.mts`, `typography.mts`
  (`pnpm run portal:test -- --only hooks`).
  **The glass** (the owner's mockup, 2026-10; `player.md`, "The glass"): every surface the player draws over the home is one light frosted glass (white 82 % with a sheen to about 90 %, `blur(16px) saturate(1.5)`, a 62 % white edge),
  its text the canon's LIGHT set (ink `#0a222e`, muted `#3a524b`, primary `#0a6358`: the `--st-*` tokens of `viewer.css`, held equal to room-creator.html's light block by `test-story-pages.mts`), contrast held over pure black and pure
  white behind it (`player.mts`: tune the white up, never the type down). Two corners only: 5 px on a card, sheet, dialog, panel, dock or toast (`--st-r-card`, `--st-r-sheet`, `--vh-radius`) and 3 px on a chip, button, disc, kbd,
  tick or control (`--st-r-ctl`); no pill and no circle but the scrubber's thumb and the pin (drawing marks). Words never leave their box (`overflow-wrap: anywhere`, nothing nowrap or ellipsised in a card), and a beat, start or end
  card is trimmed to its widest wrapped line once placed (`fitWidth` in `popup.ts`: never wider than `data-solved-w`, never a phone's sheet; the leader starts from the card as drawn). `place.ts` and the film files are untouched by it.
<!-- ---- end type scale (live pass 3) ---- -->
- The engine's modules are not fingerprinted by file name, so `portal:build` names each one by a content hash in the page's
  import map (and `?v=` on the `<script>`/`<link>` tags), and `portal/_headers` asks every file to revalidate. Never give an
  un-hashed file a long cache time or load a module around the build's rewriting: after a deploy a returning visitor would
  run the new page against old cached modules and every home would stop with "This home could not be opened" (it did, on
  the first pass-4 deploy; the custom domain's zone rewrites `.js` to `max-age=14400` whatever `_headers` says). `portal:test` checks it.
- `pnpm run portal:test` after portal work: it serves `dist/` under the sub-path and fails on any console error.

**The editor.** `room-creator.html` without `?mode=view` (README: The editor) is the review and render tool, on the CI canon:

- The chrome uses the canon's tokens (`var(--…)`), never a literal hex below the two token blocks; Manrope and JetBrains Mono
  only; the lucide sprite for icons (no emoji); toasts, never `alert()` / `confirm()` / `prompt()`. Never hand-edit the token blocks.
- Nothing the chrome draws may reach a frame: the path, the plan inset, the safe frame and the reference photo are DOM or 2D
  canvases over the WebGL canvas. A still and a film go through `__houseRenderBegin` / `__houseRenderFrames` / the composer
  (`assets/ui/recorder.ts` hashes each frame's pixels before encoding; the file is checked by PSNR, frame count and duration).
- A home's own parts are locked (`userData.generated`); what the person adds is theirs and is undoable.
- `clearScene` ends the shot's dressing (`endShotCutaway`): a shot's dressing belongs to the home it dressed, and a second home
  must be dressed by its own shot (the checks, Compare's posters and the player's Next home all go through `loadHouse`).
- While a film or a still renders (`recording`, `headlessRender`) the page does not respond to keys or a resize: `syncViewportSize`
  returns early and `openScene` refuses. A new control that opens a dialog or rebuilds the home must respect that.
- Below 1100 px the sidebars are `<div role="complementary">` drawers, not `<aside>`: an open one becomes `role="dialog"`
  (an `<aside>` may not). Closed, they are `visibility: hidden` (no tab stops, no ghost panel); the scrim is a sibling of
  `<main>` because `<main>` goes inert while a drawer is open.
- `pnpm run ui:test` after editor work (a GPU, and ffmpeg for the recording); it also runs in `pnpm run check`.

**Verify before you push.** CI only builds, typechecks, validates, runs the floor-plan-graph and story-validator tests (`pnpm run test`), the story gates
(`story:validate` on every family, `story:cast -- --check`, `story:cast-lint`, `story:services:check`, `story:bake -- --check --all`; `story:validate -- --complete` and
`story:ads -- --check` run but do not block yet), the quick Node tests (`pnpm run test:node`: every `scripts/test-*.mts` marked `@check-house quick`, found by glob, so no
count is written here), assembles the portal (`portal:build`'s link and staleness checks; strict about families on a push) and lints every word of it (`pnpm run story:copy -- dist`);
`portal:test`'s browser legs run too but do not block yet (`.github/workflows/ci.yml` says which). Once the owner has set up deploys, a merge to `main` that
passes those goes live on its own. The render gate needs a GPU and runs here:

```bash
pnpm run build && pnpm run typecheck
pnpm run check          # assets, specs, shots (144 / 0 errors), determinism, goldens (150 / 150; the six apartments are named as without a baseline until `goldens:update --house` is run on the Mac)

pnpm run check:quick    # while iterating: assets + specs + shots + the quick tests
```

A clean run has 0 shot errors and 0 scene errors (warnings are reported but do not fail — compare their count
with the previous run by hand; the full list is in `test/qa/qa.json`), `deterministic`, and the goldens passing (150 frames today, 180 once the six apartments are blessed).
After a spec change also re-run `plans`, `iso` and `floorplans` and commit their output with the spec.

**Pass 4 works in streams** (S0 seams, then S1 kit, S2 architecture, S3 compose, S4 site, S5 shot, S6 ui, each on
its own branch). Each owns its modules (house-builder.ts's header lists them all; room-creator.html's shared
builders are marked by `// ---- OWNER … ----` banners, since their runs alternate), its HouseSpec fragment
(`assets/spec/`), its validator plugin (`scripts/validate/`), its scene checks (`assets/scene-qa/`), its fleet
metrics (`scripts/fleet/`) and its `plan.json` key (`assets/plan-export/<stream>.ts`); stay in yours. The shared
files have a seam for each stream instead of a hunk: widen a base spec field by redeclaring it in your fragment
(`test-spec-types` type-checks every spec and fixture), widen what the validator accepts with your plugin's
`extend` / `replaces` (`scripts/validate/_types.mts`), and add a page dependency for your builder module under your
slot below `houseBuilderDeps` in room-creator.html (it arrives as `bctx.extra`). Every new spec field is
optional and a look-changing default applies only under `"defaults": 2` (`specDefaults()`). Streams never edit
`content/houses/`: prove a feature on `test/fixtures/houses/<stream>-*.json` (`pnpm run fixtures --fixture <id>
--update` blesses your own), and never re-bless goldens — list every frame the branch moves, with its cause, in
your stream's `test/goldens/expected-diffs/<stream>.json` and record what it moved to (`pnpm run goldens --record
<stream>`, and `fixtures --record <stream>` for another stream's fixture). The integration re-blesses once and
empties that ledger.

**The interior layers (LIGHT, SOFT, SMALL, DRESS, BAKE, README → The interior layers).** The 36 homes carry their dress items baked in (`src: 'dress@1'`, a `dk` seed key): never
hand-edit one and never add a `dress` field (a live opt-in) to a shipped house; after a layout re-bake run `node --experimental-strip-types scripts/compose-house.mts --house <id>
--dress --write` (`test-dress-phase` S fails on a stale bake; `--undress` restores the bytes). A lamp placed by the dress phase is lit by LIGHT's room pool, so a recipe or a host
change that moves lamps moves night frames: check `pnpm run test:light -- --bench` (19 rows) and `-- --lamps`. A change to how rooms look is judged with the review rig
(`scripts/review/`, needs committed product code) and by eye, not by the goldens alone.

**Goldens are re-blessed only on purpose.** A golden failure means the picture changed. If the change was not
meant to alter the look, fix the code. If it was, run `pnpm run goldens:update`, look at the frames that moved
(`test/diff/` from the failing run), and commit the new baselines in the same commit as the change, saying why.
Never re-bless to make a red gate green, and never on a machine whose profile differs from the committed one
(`test/goldens/<profile>/PROFILE.json` records the Chromium build; `playwright` is pinned to match it).

**Licensing.**

- Never copy anything from Pascal's `/next` demo (pascal.app) — it has no licence: no code, textures, models,
  or config files. Looking at it is fine.
- MIT code from `pascalorg/*` (editor, plugin-trees, …) and other permissive sources may be adapted: say so
  in a comment at the point of use and add a row (and the licence text) to THIRD_PARTY.md in the same commit.
- Never commit the owner's reference photos (the Sims 4 screenshots specs are read from). Third-party models: the
  owner's 3Dinside collection (22 packs, licensed to Lifescope Inc.; every pack is listed in `ATTRIBUTION.md`) may be
  used only as baked derivatives: geometry plus role-named flat materials in `assets/props/baked/`, generated by
  `scripts/bake/` from `models/manifest.json`. Never commit source packs, never any image or texture from a pack, never
  photographic or branded content. Every shipped model needs a manifest entry and a row in the one root
  `ATTRIBUTION.md`. `scripts/test-no-third-party-bytes.mts` (in `pnpm run test:node`) checks that each baked module has a
  manifest entry (and, once `scripts/bake/attribution.mts` exists, that each manifest entry has a row), and, by name and
  size only, that under `assets/props/` and `models/` there is no symlink, no file whose extension is a model, scene,
  image, texture, archive or DCC-project format (the `BANNED_EXT` list, any case) and no other file over 1 MiB, unless
  that exact path is in its allowlist with a reason. It never reads content, so a small pack file renamed to a harmless
  extension, or one placed outside those two directories, is not caught. All other third-party images, textures and
  models stay forbidden, and textures stay procedural (`assets/textures.ts`).
- This repo is proprietary: no open-source licence file. New dependencies go in THIRD_PARTY.md.

## Practicalities

- Scripts are `.mts` run with `node --experimental-strip-types`; they resolve the repo root from their own
  location (`path.resolve(import.meta.dirname, '..')` / `Path(__file__).resolve().parent.parent`), so any cwd works.
- Playwright resolves from `node_modules` first (the pinned devDependency), then `$PLAYWRIGHT_MODULE`, then the
  newest `~/.npm/_npx` copy.
- The goldens are Git LFS objects. A checkout without LFS has pointer text where the PNGs should be;
  test-goldens.mts says so. `git lfs install && git lfs pull`.
- Player performance: `pnpm run perf:player` (README → Player performance) is advisory and noisy, never part of
  `check` or CI; time with one browser at a time, `uptime` recorded, median of 5+, on the presented `orbit` rows. An
  optimisation that only the live player needs lives behind `VIEW_MODE`, restores any renderer state it changes for its
  own frame, and has a `?no=<feature>` kill switch (so `--query no=<feature>` can time it on and off); the offline
  path and the goldens must never see it. For that reason `__houseRenderBegin` throws under `?mode=view`: a film or a
  still is rendered from the editor page, never from a player tab.
- Multiple agents may work in this repo at once: never `git reset --hard`, `git clean -f`, force-push, or
  delete work you did not create without the owner's say-so.
