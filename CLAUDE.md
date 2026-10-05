# CLAUDE.md — ci-virtual-home

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

The Companion Intelligence virtual-home generator: HouseSpec JSON → 3D scenes, CAD floor plans, isometric
SVG/Lottie and product-shot videos. Start with [README.md](README.md) (commands, layout, how the gate works)
and [reference/HOUSE-SPEC.md](reference/HOUSE-SPEC.md) (the schema).

## Rules

**Source vs derived.** The sources are `content/houses/<id>.json`, `assets/**/*.ts`, `room-creator.html`,
`index.html`, `portal/*.css` and `portal/*.js`, `scripts/` and `reference/`. Everything else is generated — never hand-edit it; change the source and re-run:

| Derived file | Regenerate with |
|---|---|
| `assets/**/*.js` (gitignored) | `pnpm run build` |
| `content/houses/<id>.plan.json` | `pnpm run plans` |
| `content/houses/index.json` | `pnpm run index` |
| `content/house-catalog.json`, `assets/props/measured.ts` | `pnpm run catalog` |
| `assets/site-species-masks.ts` (what each planting species hides of the mulch, and its triangle cost) | `node --experimental-strip-types scripts/measure-species.mts --write` — after a change to a species' geometry (`assets/site-species.ts`, the flower heads and grass tuft in `assets/site.ts`), then `pnpm run build`; `scripts/test-site-species.mts` fails until it is done |
| `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json` | `pnpm run iso` |
| `scenes/floorplans/` | `pnpm run floorplans` |
| `test/goldens/<profile>/` | `pnpm run goldens:update` — only on purpose, see below |
| `portal/thumbs/<id>.webp`, `portal/hero.webp`, `portal/previews/<id>.jpg`, `portal/hero.jpg` | `pnpm run portal:thumbs [--house <id>]` — after a change to how a house looks |
| `portal/icons/*` (the favicon, the manifest's PNGs, the apple-touch-icon) | `pnpm run portal:icons` — after a change to `assets/brand/ci-logo-mark.svg` |
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

**The portal.** `index.html` (the gallery) and `room-creator.html?mode=view` (the player, `assets/viewer.ts`)
are deployed to Cloudflare Pages at <https://homes.ci.computer/>:

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
  endless loader.
- `portal:build` writes more than copies: `dist/homes/<id>.html` share pages, one `<meta name="vh-share">` in
  `dist/room-creator.html` that tells the player they exist, the site's title and preview tags in place of that
  page's static (editor) head, and absolute preview-image URLs (`--site-url`, default `https://homes.ci.computer/`).
- Search hygiene is also `portal:build`'s (5d2): canonical, twitter title/description/image and JSON-LD (publisher, site, the list of
  homes, a home's page and breadcrumb: `scripts/portal-pages.mts`) on every page, plus `404.html`, `robots.txt` and `sitemap.xml`.
  Canonical and sitemap URLs are the extensionless ones Pages serves (`/homes/<id>`, `/room-creator`), never `.html` (that answers
  308), and the built pages link each other without `.html` too. A new page needs a `seo(...)` call there and an entry in step 7's checks.
- A home's page (`homes/<id>`, from `portal-pages.mts`) is a page of its own, not a redirect: only a link that carries a moment (`shot`,
  `t`, `tod`, `play`) forwards to the player. Every page of the site (gallery, a home's page, 404) and the player's end card and help
  panel send a visitor to exactly `https://ci.computer`, `https://ci.computer/core` (Buy Companion Core), `https://ci.computer/download`
  (Download Companion) and the docs (`LINKS` in `portal-pages.mts`; `assets/viewer.ts` has the same four); `portal:build` fails without them.
  No prices, specs or availability on these pages: reuse the wording ci.computer and the docs use.
- Every executable `<script>` in the built pages has `data-cfasync="false"` (Cloudflare's Rocket Loader is on for the zone and would
  run the player's head script after the first paint); `portal:build` checks it. New icons go through `pnpm run portal:icons`.
- A home's name on the portal is `displayName` in `assets/home-names.ts`, never the spec's `name` directly (that is
  the Sims build's title and stays the credit). Fix a name there, not in `content/houses/`.
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

**Verify before you push.** CI only builds, typechecks, validates, runs the floor-plan-graph tests and the 16 quick
Node tests (`pnpm run test:node`) and assembles the portal (`portal:build`'s link and staleness checks); once the owner has set up deploys, a merge to `main` that
passes those goes live on its own. The render gate needs a GPU and runs here:

```bash
pnpm run build && pnpm run typecheck
pnpm run check          # assets, specs, shots (120 / 0 errors), determinism, goldens (150 / 150)
pnpm run check:quick    # while iterating: assets + specs + shots + the 16 quick tests
```

A clean run has 0 shot errors and 0 scene errors (warnings are reported but do not fail — compare their count
with the previous run by hand; the full list is in `test/qa/qa.json`), `deterministic`, and 150 goldens passing.
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
- Never commit the owner's reference photos (the Sims 4 screenshots specs are read from) or any other
  third-party image, texture or model. Textures here are generated procedurally (`assets/textures.ts`).
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
