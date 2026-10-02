# CLAUDE.md — ci-virtual-home

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

The Companion Intelligence virtual-home generator: HouseSpec JSON → 3D scenes, CAD floor plans, isometric
SVG/Lottie and product-shot videos. Start with [README.md](README.md) (commands, layout, how the gate works)
and [reference/HOUSE-SPEC.md](reference/HOUSE-SPEC.md) (the schema).

## Rules

**Source vs derived.** The sources are `content/families/<slug>.json` (the family stories), `content/story/` (casting, claims, catalog, roles, voices, lexicon, schema), `content/houses/<id>.json`, `assets/**/*.ts`, `room-creator.html`,
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
| `content/families/<slug>.voice.json`, `content/families/<slug>/audio/*.m4a` | `pnpm run story:voice -- <slug>` (local Kokoro; after the story text changed: `--stale`) |
| `content/families/<slug>.bake.json` | `pnpm run story:bake -- <slug>` (after the voice, after a story or a role-table change) |
| `portal/og/*.jpg`, `portal/og/manifest.json` | `pnpm run portal:og` (after a family's text or its preview picture changed) |
| `content/families/films.json`, `content/families/<slug>/film/` | `pnpm run story:film -- <slug>` |
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

**The public site.** Thirty fictional families, not thirty houses: `index.html` (the landing, a template that
`scripts/story/site.mts` fills), `family/<slug>` (a static page per family) and `room-creator.html?mode=view&family=<slug>`
(the player, `assets/viewer.ts`) are deployed to Cloudflare Pages at <https://homes.ci.computer/>:

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
- **No home, builder or house id is ever public.** The public name of a home is its family's slug (`^[a-z]+(-[a-z]+){0,2}$`,
  from `content/story/casting.json`) and its family title ("The Okafor family", from `content/families/<slug>.json`); nothing
  on the site, in a URL or in a file name may carry the internal id, a spec's `name`, the builder or a Sims reference.
  `scripts/story/check-leaks.mts` (run by `portal:test`) scans every built file and file name for them. The specs ship as
  `content/homes/<slug>.<hash10>.json` with `name`, `author`, `source`, `emoji` and `$schema` removed (their `id` stays, as
  the geometry is seeded from it); `assets/home-names.ts` stays for the editor and is replaced by a stub in `dist/`; the
  only edits to `assets/viewer.ts` about identity go through `assets/site/identity.ts`. Provenance lives in
  THIRD_PARTY.md and the specs, nowhere on the site. Do not edit `content/houses/`.
- `portal:build` writes more than copies (`scripts/story/site.mts`): the sanitised specs, the family pages, `credits.html`,
  the family list, the legacy-link map, `story/manifest.json`, `_redirects`, `sitemap.xml`, `robots.txt`, the player's
  public head (`window.__VH_PUBLIC=1`; the editor page is not served there), absolute preview-image URLs (`--site-url`,
  default `https://homes.ci.computer/`) and an allowlist check. A production build needs all thirty families; any other
  address or `--allow-partial` builds what exists with `noindex`. Every shipped picture, data file, clip and film carries a
  content hash in its name (`<name>.<hash10>.<ext>`), except `story/manifest.json`. Other packages add files through
  `scripts/story/ship/*.mts` and tests through `scripts/story/portal-tests/*.mts` (types in `scripts/story/hooks.ts`); they
  never edit `build-portal.mts` or `test-portal.mts`.
- Copy on the site follows the Uncloud voice (CI-Common `uncloud-voice`): no em or en dashes, sentence case, no price or
  performance number that is not on the fact sheet, "Fictional family. Real software." wherever a family is, Companion OS
  is in beta. `scripts/story/check-copy.mts` lints the built pages against `content/story/claims.json`.
- **The story system.** `content/families/<slug>.json` is the one source of every word about a family: the page, the popups,
  the captions, the voice-over and the film are all made from it (`reference/story/`: validator, bake, voice, player, film).
  The order after an edit: `pnpm run story:validate -- <slug>`, `story:voice -- <slug> --stale`, `story:bake -- <slug>`,
  `portal:og`, then `portal:build` and `portal:test`. The `.voice.json`, `.bake.json`, audio and link-preview images are
  generated and committed; never hand-edit them, and a stale one fails the production build. Every app a story names must be
  in `content/story/catalog-apps.json` (the Companion Hub's catalog); do not invent an app or a capability, and take product
  claims only from `content/story/claims.json`. Companion OS is in beta and the site says so. The families are fictional and
  say so on every surface; the Companion Core is always drawn stylised.
- **The voice-over is generated locally** (`pnpm run story:voice`, Kokoro-82M, Apache-2.0, CPU, no network at run time). No cloud
  text-to-speech service, no API key, ever; macOS `say` is a labelled last resort only. Nothing in the pipeline is shipped but its
  output: the AAC clips, which are content-hashed (`<clip>.<hash10>.m4a`), loaded per beat and only after the viewer chooses
  sound. Every shipped binary (audio, image, film poster) carries a content hash in its name and is shipped by a
  `scripts/story/ship/*.mts` step, and `portal:test` fails on a file the pages do not load. New components go in
  THIRD_PARTY.md in the same commit (code, model, voices, licence, source URL).
- **Story mode is a live-player feature.** It exists only under `room-creator.html?mode=view` (`?no=story` switches it off), its
  modules are `assets/story/` and `portal/story.css`, and its hooks into `assets/viewer.ts`, `room-creator.html`,
  `scripts/build-portal.mts` and `scripts/test-portal.mts` stay a line or two each. Offline rendering, the 150 goldens, the
  fixtures and the films' frames do not go through it: a change that moves a golden is a bug in the change.
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

**Verify before you push.** CI only builds, typechecks, validates, runs the floor-plan-graph tests and the 15 quick
Node tests (`pnpm run test:node`) and assembles the portal (`portal:build`'s link and staleness checks); once the owner has set up deploys, a merge to `main` that
passes those goes live on its own. The render gate needs a GPU and runs here:

```bash
pnpm run build && pnpm run typecheck
pnpm run check          # assets, specs, shots (120 / 0 errors), determinism, goldens (150 / 150)
pnpm run check:quick    # while iterating: assets + specs + shots + the 15 quick tests
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
