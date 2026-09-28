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
| `content/house-catalog.json` | `pnpm run catalog` |
| `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json` | `pnpm run iso` |
| `scenes/floorplans/` | `pnpm run floorplans` |
| `test/goldens/<profile>/` | `pnpm run goldens:update` — only on purpose, see below |
| `portal/thumbs/<id>.webp`, `portal/hero.webp`, `portal/previews/<id>.jpg`, `portal/hero.jpg` | `pnpm run portal:thumbs [--house <id>]` — after a change to how a house looks |
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
- A home's name on the portal is `displayName` in `assets/home-names.ts`, never the spec's `name` directly (that is
  the Sims build's title and stays the credit). Fix a name there, not in `content/houses/`.
- `pnpm run portal:test` after portal work: it serves `dist/` under the sub-path and fails on any console error.

**Verify before you push.** CI only builds, typechecks, validates, runs the floor-plan-graph tests and assembles
the portal (`portal:build`'s link and staleness checks); once the owner has set up deploys, a merge to `main` that
passes those goes live on its own. The render gate needs a GPU and runs here:

```bash
pnpm run build && pnpm run typecheck
pnpm run check          # assets, specs, shots (120 / 0 errors), determinism, goldens (150 / 150)
pnpm run check:quick    # while iterating: assets + specs + shots
```

A clean run has 0 shot errors and 0 scene errors (warnings are reported but do not fail — compare their count
with the previous run by hand; the full list is in `test/qa/qa.json`), `deterministic`, and 150 goldens passing.
After a spec change also re-run `plans`, `iso` and `floorplans` and commit their output with the spec.

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
- Multiple agents may work in this repo at once: never `git reset --hard`, `git clean -f`, force-push, or
  delete work you did not create without the owner's say-so.
