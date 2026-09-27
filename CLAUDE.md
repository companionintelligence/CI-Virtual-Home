# CLAUDE.md — ci-virtual-home

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

The Companion Intelligence virtual-home generator: HouseSpec JSON → 3D scenes, CAD floor plans, isometric
SVG/Lottie and product-shot videos. Start with [README.md](README.md) (commands, layout, how the gate works)
and [reference/HOUSE-SPEC.md](reference/HOUSE-SPEC.md) (the schema).

## Rules

**Source vs derived.** The sources are `content/houses/<id>.json`, `assets/**/*.ts`, `room-creator.html`,
`scripts/` and `reference/`. Everything else is generated — never hand-edit it; change the source and re-run:

| Derived file | Regenerate with |
|---|---|
| `assets/**/*.js` (gitignored) | `pnpm run build` |
| `content/houses/<id>.plan.json` | `pnpm run plans` |
| `content/houses/index.json` | `pnpm run index` |
| `content/house-catalog.json` | `pnpm run catalog` |
| `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json` | `pnpm run iso` |
| `scenes/floorplans/` | `pnpm run floorplans` |
| `test/goldens/<profile>/` | `pnpm run goldens:update` — only on purpose, see below |

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

**Verify before you push.** CI only builds, typechecks, validates and runs the floor-plan-graph tests. The
render gate needs a GPU and runs here:

```bash
pnpm run build && pnpm run typecheck
pnpm run check          # assets, specs, shots (90 / 0 errors), determinism, goldens (120 / 120)
pnpm run check:quick    # while iterating: assets + specs + shots
```

A clean run has 0 shot errors and 0 scene errors (warnings are reported but do not fail — compare their count
with the previous run by hand; the full list is in `test/qa/qa.json`), `deterministic`, and 120 goldens passing.
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
