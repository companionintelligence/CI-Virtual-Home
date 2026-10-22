# Companion Core Virtual Homes

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.** See [NOTICE.md](NOTICE.md).

The Companion Intelligence virtual-home generator. One **HouseSpec** JSON per house
([`reference/HOUSE-SPEC.md`](reference/HOUSE-SPEC.md)) is the single source of truth, and everything else is
compiled from it:

| Output | Made by | Lands in |
|---|---|---|
| **3D scene** — walls, roofs, openings, stairs, furniture, planting, lighting, the Companion Core, and auto-generated camera splines (door → Core ending in an orbit round it, orbit, hero reveal, walkthrough, Core orbit) | `assets/house-builder.ts` and friends (three.js r169, in the browser) | [`room-creator.html?house=<id>`](room-creator.html) |
| **CAD floor plans** — one blueprint sheet per level, SVG + PNG, and a `floorplans.json` index | `scripts/generate_floor_plans.py` | `scenes/floorplans/` |
| **Isometric cutaways** — landscape + portrait SVG and a pure-vector Lottie animation per house | `scripts/generate_house_iso.py` | `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json` |
| **Product-shot videos** — frame-stepped, deterministic H.264 per house × shot, with posters | `scripts/render-house-shots.mts` (headless Chromium) | `video/houses/` (gitignored; browse with `video/houses/index.html`) |
| **Web portal** — a gallery of the homes and a live player to fly their camera paths | [`index.html`](index.html), `room-creator.html?mode=view` ([`assets/viewer.ts`](assets/viewer.ts)), `scripts/build-portal.mts` | `dist/` → <https://homes.ci.computer/> (Cloudflare Pages, deployed from `main`; see [Deploying](#deploying)) |
| **Family stories**: a fictional family in every home, each member doing their job on one Companion Core, told as the case for uncloud: a page and a narrated tour per family | `content/families/<slug>.json` (the contract: [`reference/story/personas.md`](reference/story/personas.md)), `content/story/`, `scripts/story/`, `assets/story/` | `family/<slug>` and `room-creator?mode=view&house=<id>&family=<slug>` on the same site (see [The family stories](#the-family-stories)) |

36 homes ship today, each a spec in `content/houses/<id>.json`: 30 houses, and six apartments that Companion Intelligence wrote itself
(a unit in a block, [`reference/APARTMENTS.md`](reference/APARTMENTS.md)). The specs' `author` and `source` fields are internal records
of where each one came from: they stay in the repository and are never shown or shipped (see [Credits](#credits-none-on-the-site)); the
apartments' author is the company's own name, which the credit guard knows is not a builder (`scripts/own-authors.mts`).
Each of the 30 houses is also the home of a fictional family (see [The family stories](#the-family-stories)); the six apartments have none yet.

## Quickstart

Needs Node ≥ 22.15, pnpm 10 (`corepack enable` picks up the pinned version), Python 3, and Git LFS. Rendering
videos needs `ffmpeg`; floor-plan PNGs need `rsvg-convert` (librsvg). The render gate wants a GPU — its
committed baselines are for macOS / Metal.

```bash
git lfs install                    # once per machine, before cloning — the goldens are LFS objects
git clone <this repo> && cd ci-virtual-home
pnpm install                       # esbuild, typescript, and the exact Playwright the goldens were blessed on
pnpm exec playwright install chromium   # its browser, once (skipped if ~/Library/Caches/ms-playwright has it)
pnpm run build                     # assets/**/*.ts → sibling .js the page loads
pnpm run serve                     # http://localhost:8080/room-creator.html?house=aurora — the editor
                                   # http://localhost:8080/ — the portal's gallery
```

`room-creator.html` is plain ES modules with an importmap — no bundler — so any static server over the repo
root works; it cannot run from `file://`. Useful URL parameters: `house=<id>`, `shot=door-to-core|orbit|hero-reveal|walkthrough|core-orbit`,
`t=<0…1>` (the moment in the shot), `lighting=day|golden|dusk|night`, `mode=review|edit`, `flythrough=1`, `res`, `aspect`, `planner=v2` (the spline planner v2 for every door-to-core, hero-reveal and walkthrough; v1 otherwise); the
editor writes the first five as you change them, so a URL is a view (see [The editor](#the-editor)). Its "All homes" link opens
the portal's gallery, `./` (Cloudflare Pages answers `./index.html` with a 308); `mode=view` turns the page into the portal's player (see [The web portal](#the-web-portal)).

## Commands

| Command | What it does |
|---|---|
| `pnpm run build` | Type-strips `assets/**/*.ts` to the `.js` the browser loads (esbuild `transform`, not a bundle). Run after any asset edit; `check` runs it first. |
| `pnpm run typecheck` | `tsc` over `scripts/` (Node) and over `assets/` (browser). |
| `pnpm run validate` | All 36 specs against the schema, the prop catalog and the registry, then every `scripts/validate/*.mts` plugin. `--shots` adds the headless camera-path QA; `--layout` the layout lints. |
| `pnpm run test` | `scripts/test-floorplan-graph.mts` and `scripts/test-stories.mts` under `node --test`: the floor-plan graph, mitres, and the wall compiler over every spec; the story validator against its good and bad fixtures. Needs `build`. |
| `pnpm run check` | **The gate** — every check below, in order (`pnpm run typecheck` is separate). `--house a,b`, `--jobs N`, `--res`, `--update-goldens`, `--no-perf`. |
| `pnpm run check:quick` | assets + specs + shots, and the test scripts marked `@check-house quick` (floor-plan graph, spec types, kit rules, QA v2's fault injection, composer, site, the story validator, bake, voice locks and film …): the fast loop while editing. |
| `pnpm run test:node` | Only those quick tests (every `scripts/test-*.mts` marked `@check-house quick`, found by glob, so the number moves: the run lists them): pure Node, no browser, no GPU (a few minutes). CI runs it. |
| `pnpm run shots` | Render product shots to `video/houses/` (`--house`, `--shot`, `--res 1080`, `--aspect 16:9`, `--poster-only`, `--qa-only`, `--jobs`). |
| `pnpm run goldens` / `goldens:update` | Compare the committed baselines (150 frames: five for each of the 30 houses) / re-bless them. A home with no baseline (the six apartments, until `goldens:update --house <ids>` is run on the Mac) is named, not rendered and not blessed, and the run fails: a frame nobody has blessed is a frame nobody is checking. |
| `pnpm run frame-hash` | Two fresh browser contexts must render the same frames. |
| `pnpm run test:twins` | The Python twins (`generate_floor_plans.py`, `generate_house_iso.py`) on the 36 homes and every fixture: they must run, reproduce the committed sheets, isometrics and Lotties byte for byte on the homes, and draw what S2's fixtures show (porches, bays, L/U stairs, floor patterns …) from `<id>.plan.json`'s `arch` key. `check` runs it; ~2 min, needs a GPU for the fixtures' plans. |
| `pnpm run fixtures` | Validate, QA and render the fixture houses in `test/fixtures/houses/` to stills (`test/fixtures/out/`, to look at) and compare their frame hashes (`--fixture`, `--update` to bless your own fixture, `--record <stream>` for another's frame your branch moves). |
| `pnpm run perf` | Build, track and shot-QA timings against their budgets (3 s / 1 s / 0.5 s), report-only, with each number's Δ against the committed `test/perf/baseline.json` (`--house`, `--all`, `--baseline` to rewrite it at integration). |
| `pnpm run perf:player` | Advisory timing of the live player (`room-creator.html?mode=view`) in Chromium on the real GPU: presented frame times, CPU and GPU time of `renderer.render`, draw calls, programs. Modes `bench` (default) `attr` `load` `raf` `profile` `census`; `--houses a,b`, `--defaults 1,2`, `--dpr 2`, `--throttle 4`, `--runs N`, `--query no=glass,…` (appended to the player URL, for A/B of a live-only feature), `--out <file.md>` (rows plus the header line with commit and `uptime`), `--json <file>`. Not part of `check` or CI: timings depend on the machine's load. See *Player performance*. |
| `pnpm run shot-planner` | Spline planner v2 on all 36 homes and S5's five fixtures (`assets/shot-planner.ts`): planned twice byte-identical, QA v2, the fleet camera targets (outside share, door speed, view rate, look error against each beat's subject, the press, rooms seen, the Core's height and place, the establishing styles, the orbit — strict: every house with a sound way to 90° flies it — the finale and establishing lenses against the plan's, the film's length against its budget and against the plan's own 12 s), the page's track hash equal to Node's (`--parity`: three houses and the spiral and upper-entry fixtures), every world's three films planned in Node and in Chromium's engine with the whole track's hash compared, the recorded `test/shots/<id>.track.json` hashes equal to what the planner bakes now (a drift fails, like a golden: `--update` records them in the commit that moves them), the planning and QA budgets (QA v2 and its four aspect passes), a custom `shots[].establish` pose that plans. Worlds come from `test/qa/shot-worlds/` (built in the page once, `--rebuild-worlds` / `--stale-ok`). |
| `pnpm run shot-qa` | A fault injected for every QA v2 code (85), for the plan's own caps, lenses and a window pane (with no thickness too) or a trunk on the way, for each check a mutation review found loosenable (the glass pad, the outside beats' site test, the beat's median look error, the door zone, the fixed subjects, the yaw slack, the film budget), and for every fleet check (the orbit's gate strict: one house short fails it), on two frozen worlds (`test/shots/worlds/`): each must be caught. No browser. |
| `pnpm run camera-audit` | A contact strip per house and planner (twelve frames, the plan with the path by beat), the camera metrics of v1 and v2 side by side → `test/qa/camera-audit/index.html` (`--house`, `--planner v1,v2`, `--fixtures`). The check step also runs planner v2's door-to-core, hero-reveal and walkthrough through QA v2 in the page (`shots:v2`) and its frames through the determinism test (`determinism:v2`). |
| `pnpm run fleet-audit` | The fleet sameness metrics (door colours, claddings, lighting, furniture repetition, planting …) → `test/qa/fleet-audit.md`, beside the committed baseline `test/fleet/baseline.json`. `--built` measures what this tree's builders generate (plans rebuilt into `test/qa/plans/`); `--baseline` rewrites the baseline (integration only). |
| `pnpm run plans` | Rebuild `content/houses/<id>.plan.json` — the seeded site instances the isometric twin draws. |
| `pnpm run iso` | Rebuild the isometric SVGs, Lotties and `scenes/manifest.json` (`--only <id>`, `--png`). |
| `pnpm run floorplans` | Rebuild the CAD sheets and `floorplans.json` (`--only <id>`, `--no-png`, `--fit lot`). |
| `pnpm run catalog` | Measure every prop type in the browser → `content/house-catalog.json` (footprint, height, draw calls, params, placement), `assets/props/measured.ts` (the boxes the composer sizes with, and how they grow with `w` `d` `l` `r` `h`) and `content/house-styles.json`. |
| `node --experimental-strip-types scripts/compose-house.mts --house <id>` | Compose a house's rooms from their `program`s in Node and report them (`--infer`, `--replace`, `--style`, `--seed`, `--lint`), or bake a composition into a spec (`--write`). |
| `pnpm run index` | Validate every spec and rebuild `content/houses/index.json` (the page's house list). |
| `pnpm run prop-sheet` | Contact sheet of props, measured against their declared sizes (`--types`, `--module`, `--all`). |
| `pnpm run export:core` | The Companion Core as glTF (`--finish`, `--pose`) → `dist/models/`. |
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp`, and the link-preview JPEGs → `portal/previews/<id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--no-hero`, `--hero-tod`, `--max-kb`, and `--gl default` on Linux for the machine's own GPU instead of SwiftShader; a tall block has its framing in `FRAME`). Needs a GPU; commit the output. One new home: `--house <id> --no-hero`. |
| `pnpm run portal:icons` | Render the site's raster icons (`portal/icons/`: `favicon.ico`, the manifest's 192 and 512 px PNGs, the 180 px apple-touch-icon) from the brand mark with Chromium. Commit the output. |
| `pnpm run story:validate` | The family stories (`content/families/<slug>.json`) against the schema, the Uncloud voice, `claims.json`, the app catalog, the persona rules, the cast plan (the people, their archetypes and companions, the planned apps) and each beat's own house. `-- <slug>` for one, `-- --complete` for the whole set of thirty and the fleet counts. No GPU. See [`reference/story/validator.md`](reference/story/validator.md). |
| `pnpm run story:cast` / `story:cast-lint` | Who lives where: `content/story/cast-plan.json` (the authored decisions: 30 families, members, archetypes, rooms, signature apps; and `homesWithoutFamily`, the homes that have none yet: the six apartments, which the lint lets stand without a family and no other home) plus the house files and `roles.json` give `content/story/casting.json` and `reference/story/cast.md` (`story:cast --check` fails when either is stale). The lint holds the plan to the fleet rules (the Brennan flagship, unique names, at least 70 apps, no app in more than 12 of 30 families). No GPU. [`reference/story/cast.md`](reference/story/cast.md) |
| `pnpm run story:services` / `story:services:check` | The registry of the services the stories' apps are the alternative to (`content/story/services.json`): recompute its derived columns from the catalog and the families, or fail when they are stale or an invariant breaks. No network. [`reference/story/story-v3.md`](reference/story/story-v3.md) |
| `pnpm run story:bake` | Each family's camera: a safe pose per beat, the walks between them and the tour's track → `content/families/<slug>.bake.json` (`-- <slug>`, `-- --all`, `--check`, `--stills <dir>` renders contact sheets on one GPU process). Run it after the voice, so the durations are the voice's. [`reference/story/bake.md`](reference/story/bake.md) |
| `pnpm run story:voice` | The narration, generated **locally** with Kokoro-82M (no cloud service, no key) → `content/families/<slug>.voice.json` and `<slug>/audio/<clip>.<hash10>.m4a` (`-- <slug>`, `-- --all`, `--stale`, `--dry-run`, `--sheet`). [`reference/story/voice.md`](reference/story/voice.md) |
| `pnpm run test:voiceover` | Every committed voice lock: clips hashed and intact, loudness, word timings, the family budget. Also part of `check:quick`. |
| `pnpm run story:film` | One film per family in 16:9 and 9:16, from the tour's own camera and voice (`-- <slug>`, `-- --all`, `--dry-run`, `--stills <dir>`). One GPU process; the films are hosted outside Pages. [`reference/story/film.md`](reference/story/film.md) |
| `pnpm run story:ads` | The persona ad cuts: one member's story as a silent 15 to 25 s vertical ad (also 1:1, 4:5, 16:9) from the family's story and bake lock; refreshes `content/story/ads.json` (`--manifest`, `--check`, `--dry-run`, `--stills <dir>`, `--family`, `--member`, `--aspect`, `--res`, `--gl default\|software`). Videos go to `video/ads/` (gitignored). [`reference/story/ads.md`](reference/story/ads.md) |
| `pnpm run story:ads:test` | The ad kit's pure-Node tests (the plan, the manifest, the safe areas, the encode flags). Also part of `test:node`. |
| `pnpm run story:media` | The real app logos (128 px) and screenshots (960 px wide) of the apps the families use, of Companion Hub and of the Companion account page → `portal/apps/<id>/` and `portal/ci/` (content-hashed WebP) and `content/story/app-media.json`, read with `git cat-file` from CI-Marketplace, CI-Hub and CI-Portal beside this repo at the commits the manifest pins; ffmpeg with libwebp only (`--check`, `--update-sources`, `--fetch`, `--apps`, `--out`, `--verbose`). Commit the output. [`reference/story/story-v2.md`](reference/story/story-v2.md) |
| `pnpm run story:media:test` | The media's quick Node test (the manifest, hashes, sizes, captions, rejections, the tree, the page rules, the encoder and, where the sibling repos are, a build twice into temp dirs). Also part of `test:node`. |
| `pnpm run portal:og` | Draw the families' link-preview images → `portal/og/<slug>.jpg`, with `portal/og/manifest.json` (Chromium's 2D canvas, no GPU; `--only`, `--families`). Re-run it when a family's text or its preview picture changes: a stale one is not shipped (that page uses its home's own picture) and is an error with `--strict-families`. Commit the output. |
| `pnpm run portal:build` | Assemble the site in `dist/` (only what it loads, the specs redacted: no author, no source) and check its links and that nothing credits a builder ([Credits](#credits-none-on-the-site)). Needs `build`. `--families <dir>` reads other family files; `--strict-families` makes a stale family an error (see [The family stories](#the-family-stories)); `--stale-report` lists every reason. |
| `pnpm run portal:preview` | `portal:build`, then serve `dist/` at <http://127.0.0.1:8081/ci-virtual-home/> (`--port`). `-- --tailscale` also listens on this machine's Tailscale address (the one `tailscale ip -4` prints), so a phone or laptop on the same tailnet opens `http://<that address>:<port>/ci-virtual-home/` (the command prints it and the MagicDNS name); never on `0.0.0.0`, so the local network does not see it. `-- --host <ipv4>` listens on that one address instead. The preview stops with Ctrl-C. |
| `pnpm run portal:test` | Drive the built site under `/ci-virtual-home/` in Chromium (on Linux with a GPU, `PORTAL_GL=default` uses it instead of SwiftShader): gallery, player, fly, share, the editor (`--house`, `--shots`, `--only <legs>`), the campaign's tags (the `campaign` leg), the family pages and the narrated tour (the `hooks` leg, `scripts/story/portal-tests/`); and in WebKit when Playwright's build for the pinned version is installed (`pnpm exec playwright install webkit`; `--webkit` requires it). |
| `pnpm run test:campaign` | `portal/campaign.js` run in a tiny DOM stub, and the pages that load it (no browser): the tags captured, only the listed ones, the right links rewritten and no others, no double append, storage blocked, links added later, an organic visit. A quick Node test. |
| `pnpm run ui:test` | Drive the editor end to end (layout at four sizes in both schemes, contrast, the top bar, the checks, the timeline, the tree, the catalog, Compare, stills at 4K, a recorded MP4 checked with ffprobe and by PSNR) — `--only <sections>`, `--shots <dir>`. Needs a GPU and ffmpeg. |
| `pnpm run test:light` | The interior-light gate (a GPU, minutes; the product code must be committed): the four `light-*` fixtures at day, dusk and night, and with `-- --bench` the 19 luma checks of the plan on the five bench rooms (clipped highlights, crushed shadows, ceiling and range against `before.metrics.json`), `-- --leak` every room's pool against its neighbours (409 rooms), `-- --lamps` the lamp census (every glowing lamp, whether its room has a pool, the 16-light cap), and the tuning modes `--portal` `--hitch` `--steady` `--closeups` `--mood` `--probe`. |
| `pnpm run test:dress-hosts` / `test:dress-neutral` | The dress phase in the page: every host's flat top measured at 2 cm against the registry (and the packer's sizes against the built boxes), and the neutrality gate (`?dress=0` is the stripped house object for object and bit-exact in three frames; dressed differs only in the dress items' own classes and the fixtures of a room that was given a lamp; baked `dress@1` items build what the live phase builds). Both by hand: they need a GPU. |
| `node --experimental-strip-types scripts/compose-house.mts --house <id> --dress [--write]` | The dress phase alone (`assets/room-dress.ts`): add the `src: 'dress@1'` small goods, lamps, towels and café curtains of each room's recipe (`--level`, `--rooms`), over a frozen layout; `--undress` strips them again and gives the file back byte for byte; `--dress` twice writes what once did. Pass 6 baked all 30 houses with it. |
| `pnpm run dress-project` / `dress-census` / `dress-cost` / `dress-fleet` / `dress-reach` | What the phase would add (items per program, lamp coverage, meshes and triangles, `--lamps` table), the census of the specs (never-bare rules, blank walls; `census.json` is the frozen BEFORE), the draw-call sub-gate on the dress fixtures (at most ×1.12), the five fleet gates measured on the built meshes of the 30 baked houses (curtain-vs-item, curtain-vs-curtain, neighbour gap, corner camera, curtain-window), and REACH measured over 1,000 seeds (`--check`). |
| `pnpm run review:capture` / `review:luma` / `review:sheets` / `review:ab` / `review:cost` / `review:verify` | The review rig (`scripts/review/`): 92 frames of the 24 review rooms at the rig's corner cameras (1.5 m eye, 60°, NW and SE, 1280 × 720 through the composer; dusk and night on the five bench rooms; a 1.7 m mannequin for scale), luma metrics, before/after sheets, the blind A/B pair generator and scorer, the cost census (`--compare` against `test/review/baselines/cost.json`: draw calls, meshes, triangles, texture memory, lights) and the determinism check. Outside git, in `REVIEW_DIR` (`scripts/review/lib.mts`). |
| `pnpm run review:zfight` / `review:collide` | The geometry detectors (README → Geometry detectors): `--house <id[,id]>` `--out <dir>` `--gl default\|software`; z-fighting found by experiment (and named), and props that intersect props, walls, doors, stairs or voids in the meshes a house really builds. `review:geometry-selftest` plants a defect and proves each finds it. |
| `pnpm run prop-drift` / `test:neutrality` | A type rebuilt in place keeps its box (`prop-boxes.json`), and a change moves only the object classes it declared (`--changed item:a,role:b`; `--query dress=0`). |
| `pnpm run soft-sheet` / `soft-rooms` | SOFT's prop sheet (one column per seed) and the soft fixture house seen from inside at the rig's cameras. |
| `node --experimental-strip-types scripts/bake/bake.mts` | The 3Dinside bake: `models/manifest.json` plus a source pack outside git → `assets/props/baked/<family>.ts` (Blender, deterministic; `--check` needs neither, `--verify-repro` bakes twice). `scripts/bake/attribution.mts [--check]` writes `ATTRIBUTION.md` byte for byte; `scripts/bake/sheet.mts` renders review sheets (`--compare` procedural against baked). |

Every script resolves the repo from its own location, so they run from any directory. After editing a spec:
`validate` → `plans` → `iso` → `floorplans` → `check`, and commit the regenerated files with the spec.

## Layout

```
room-creator.html          the editor + renderer page; loads assets/*.js and content/houses/*.json.
                           ?mode=view is the portal's player (assets/viewer.ts, portal/viewer.css); &family=<slug> adds the tour
index.html                 the portal's front page: the families and their homes (portal/gallery.css, portal/gallery.js, portal/campaign.js)
portal/                    the portal's styles and scripts, thumbs/<id>.webp and hero.webp, and the link-preview
                           JPEGs previews/<id>.jpg and hero.jpg (derived, committed); site.css, family.css and site.js (a family's
                           page), story.css (the tour), fonts/ (Archivo Black, for og/ only), og/ (the families' link previews, derived, committed)
content/families/          the authored stories, <slug>.json (the writers' files; the voice and bake locks sit beside them)
content/story/             cast-plan.json (who lives where; casting.json, slug <-> house, is derived from it), personas.json, claims.json,
                           catalog-apps.json, services.json (the replaced services), the schema: the story system's inputs
reference/story/           personas.md (the contract), story-v3.md (the services and pairs), cast.md (derived), validator.md, bake.md, voice.md, player.md, film.md
scripts/story/             site.mts (the story part of portal:build), pages.mts (a family's page), check-leaks.mts, check-copy.mts,
                           build-og.mts, hooks.ts (the seams: ship/*.mts at build, portal-tests/*.mts at test), lib/ (the validator)
assets/story/              the narrated tour: director, popups, captions, audio, the baked camera track (loaded only for ?family=)
assets/site/identity.ts    the salvage's public-mode identity module; nothing imports it here (the portal names its homes). For a redesign to reuse or drop
floorplan-graph-demo.html  the Phase 2 floor-plan graph beside its compiled walls
assets/                    the three.js engine, in TypeScript. house-builder.ts is the orchestrator; each part is a
                           module one stream owns: item-map + hero-build (kit), structure-build (architecture),
                           rooms-build (compose), site-build (site), shot-planner-v1 + shot-track + shot-planner (v2) + shot-qa + shot-world/nav/probe/doors (shot),
                           visibility (the page's wall modes and roof fade) and viewer (the portal's player) (ui),
                           kit-build (the kit's spec → parameters, the palette and the light). Beside them house-geometry,
                           wall-compiler, floorplan-graph, roofs, fixtures, site, world, materials, textures,
                           environment, core-orbit, shot-path, plan-export/ (one plan.json key per stream)
  spec/                    the HouseSpec as a TypeScript type: base.ts + one fragment per stream, merged in index.ts
  scene-qa/                the scene checks each stream registers with __houseSceneQA
  props/                   the prop registry — one module per category, 287 types (plus `props/baked/`, the baked 3Dinside derivatives)
  vendor/three/            three.js r169 + addons, vendored (one local patch; see THIRD_PARTY.md)
  fonts/                   Manrope + JetBrains Mono woff2 the capture scripts serve instead of Google Fonts
  brand/                   the CI mark the page shows
  ui/                      the editor's modules: recorder + mp4-mux + webm-mux (Record), timeline, plan-inset, path-overlay,
                           gallery, compare, qa, toast, undo, url-state, format (S6, the editor)
  viewer.ts                the portal's player: shots, scrubber, time of day, path, fly (room-creator ?mode=view)
  viewer-batch.ts          the player's live-only static batching: merges each toggle unit's static opaque meshes (a third of the draw
                           calls); only viewer.ts imports it, `?no=batch` switches it off, the recorder / goldens / editor never see it
content/houses/            <id>.json — the 36 HouseSpecs (source; pass 6 baked each room's dress@1 items into them); <id>.plan.json and index.json — derived
content/house-catalog.json every item type's measured footprint, height and iso parts (derived)
scenes/                    isometric SVG + Lottie, CAD floor plans, and their manifests (all derived, committed)
scripts/                   the pipeline: build, validate, render, gate (.mts) and the Python generators (.py)
  validate/                validator plugins, one per stream (validate-house-spec.mts loads them)
  fleet/                   fleet-audit metrics, one file per stream
models/                    manifest.json (the shipped 3Dinside derivatives), packs.json (the 22 packs: licence basis and evidence), roles/ (the role colour tables);
                           never a source pack, an image or a texture. ATTRIBUTION.md (generated) lists every pack
assets/props/baked/        the baked derivatives, data-only modules (geometry + role-named flat materials) behind `?baked=0`
scripts/bake/              the bake pipeline (Blender), the attribution generator, review sheets
scripts/review/            the review rig: capture, luma, sheets, A/B, cost, verify, the committed baselines' tools
test/review/baselines/     the rig's frozen BEFORE and the stability baselines (before.manifest.json, before.metrics.json, cost.json, census.json,
                           prop-boxes.json, build-neutrality.json, compose-fixtures.json)
reference/                 HOUSE-SPEC.md (the schema), APARTMENTS.md (a unit in a block: the recipe, the six, what adding a home changes),
                           PARAMETRIC-INTERIORS-PLAN.md (design + roadmap),
                           HOUSE-SYSTEM-REVIEW-2026-09-15.md (historical review), geometry/ (the detectors' baseline),
                           office/ (the parked /office design, not shipped), story/program-2026-10/ (records of the October 2026
                           marketing program); reference/README.md indexes it all
test/goldens/macos-metal/  150 committed baseline frames of the first 30 homes (Git LFS; the apartments' come with `goldens:update --house`) + PROFILE.json (the renderer that made them)
test/goldens/expected-diffs/  the golden ledger: <stream>.json per stream, the frames it moves and why, and
                           <stream>/<profile>/ what each golden moved to (see How verification works)
test/fixtures/houses/      fixture specs each stream proves its features on; hashes/<profile>/<id>.json their frame hashes
video/houses/index.html    browser for rendered shots; the renders beside it are gitignored
```

## The editor

`room-creator.html` (without `?mode=view`) is the review and render tool: a home is built from its spec, its camera
shots are played and checked, and stills and films come out of it. It is on the CI design canon (Manrope and JetBrains
Mono, the generated tokens, lucide icons, toasts — never `alert()`), and it has two modes, `?mode=review|edit`:
**Review** is the viewport with the shot cards, the checks and the time of day; **Edit** adds the catalog, the transform
tools, the selection and the scene tree (Edit leads with the selection and its material). Below 1100 px the sidebars are
drawers: a closed one is off the page, an open one is a dialog (the view and the top bar inert behind it, a close button, Esc,
focus back to its toggle). On a phone the transport is a bottom sheet, and every control is a 44 px target on touch.

- **Homes.** The picker (G) is a grid of the homes' thumbnails with a search and the arrow keys; `?house=&shot=&t=&lighting=&mode=`
  follows every change and a reload restores it. **Compare** (C, or the picker's button) draws every home at the same shot,
  moment and light through the film's renderer, as a grid you can save as one PNG sheet — the direct answer to "each home
  looks the same". It rebuilds each home in turn and puts yours back.
- **The film.** The timeline under the transport shows the shot's beats (or, until planner v2, its v1 phases, hatched), event
  ticks (in the door, on the stairs, the Core's button), the checks' findings as markers, and the camera's speed and turn.
  Space plays; ← → step a frame (Shift: a second); Home / End; L loops, B loops the beat the playhead is in. The plan inset (M)
  follows the camera up the storeys (a studio scene has no plan, so the button is off there); the camera path (P) is drawn over
  the view and can never reach a render. Speed is the solid line and Turn the dashed one. The single-letter shortcuts (G, C, P,
  M, F, L, B, I, O, T, W, E, R) can be switched off in the inspector's Keyboard section (WCAG 2.1.4); Space, the arrows, Esc and
  the Ctrl / Cmd chords stay.
- **Checks.** After a home builds, the scene checks and every gated shot's checks run in idle time: the badge counts errors
  (heat, its one use in the UI, on a stop-sign glyph) and warnings (the canon's warning colour, on a triangle), the list jumps the
  timeline to each finding. They wait while a shot plays or a film renders and start over when it stops. `?qa=1` runs them in a
  page a harness drives (they are off under `navigator.webdriver`, so a gate is not slowed by them).
- **Framing.** Iso / Orbit / Plan and Fit use the lot-fit maths of `houseContactSheet`; a safe frame shows what a 16:9, 9:16
  or 1:1 film of the view takes in; **Preview** shows the live view through the film's renderer; **Photo** lays a local image
  over the view (opacity, a wipe from the left) to match a home against the photo it was read from — an object URL, never
  saved, never in a render.
- **Walls and floors.** Cutaway / Down / Up, and one floor button a storey (split at the home's own level heights). A storey
  view keeps the lot and the world and never shows a roof; a shot never sees the filter, and taking the camera back re-applies it.
- **Stills.** Through the film's composer at an exact size: the short side is the size you pick, the long side is capped at 3840
  (4K portrait is 2160 × 3840); a transparent cutout drops the ground, the world and the sky. Named
  `<home>-still-<light>-<size>-<yyyymmdd-hhmmss>.png`.
- **Record.** The shot is stepped frame by frame through the offline renderer (`__houseRenderBegin` / `__houseRenderFrames`,
  the path the goldens use) at its own duration and a chosen frame rate, and encoded with WebCodecs: H.264 in an MP4 where the
  browser can, VP9 in a WebM where it cannot. `assets/ui/mp4-mux.ts` and `webm-mux.ts` are the writers (first-party: no muxer
  is vendored). Each frame's raw pixels are hashed before encoding, so a test can prove the film is the frames
  `__houseRenderFrames` draws even though H.264 is lossy; the file is checked by PSNR (≥ 40 dB), frame count and duration
  (`scripts/test-ui.mts`, `scripts/test-ui-units.mts`). A 12 s film at 30 fps is 12.000 s and 360 frames. While it renders the
  page is inert to the person: no key opens a dialog or rebuilds the home, and a window resize does not change the size the frames
  are drawn at (the disturbed film is the same frames, `test-ui.mts`). A film's size is even (21:9 is 1280 × 548, not 549), and the
  bit rate the dialog names is what is asked for, "up to": a calm shot at a small size fills less of it.
- **Editing.** A home's own parts (built from its spec) are locked: Backspace and the bin do nothing, and a toast says where to
  change them. What you add from the catalog (the four tabs, and **Props**: the 287 registry props of `house-catalog.json`) lands
  where the view's centre ray meets the floor (three metres ahead of the eye through a level shot's lens, and always on the lot);
  a prop whose placement metadata says `against: 'wall'` (S3's `place`) is set against the nearest outside wall, facing in. Undo
  and redo (Ctrl or Cmd Z, with Shift) cover adding, deleting, duplicating, moving and re-finishing. Opening another home rebuilds
  it from its spec, so what you added goes; the picker says so in a toast. The scene is a tree — storey, room, part — with a
  search, and one tab stop.

Every `__house*` hook the gates and the portal use is unchanged; the editor adds none but `houseContactSheet`'s
`__houseRenderFrames(from, count, null)` (draw without encoding a JPEG) and a studio scene's shot key for `__houseRenderBegin`.
`pnpm run ui:test` is the acceptance for all of it.

## The web portal

A static site anyone can open: [`index.html`](index.html) lists the homes from `content/houses/index.json` with
the committed thumbnails (no WebGL on the gallery), and a card opens the live player,

```
room-creator.html?mode=view&house=<id>[&shot=<shot>][&t=<0…1>][&tod=day|golden|dusk|night][&play=1|0]
```

— the editor's own renderer with its chrome put away. `t` is the fraction of the shot; a link with `t` opens
paused there, one without plays from the start, and `play=1|0` says so outright — but nothing starts moving by
itself for a visitor whose system asks for reduced motion (the gallery's links carry no `play`). The player lists
the shots from the house's presets (so `core-orbit` and any later shot type appear by themselves), plays them
through the page's `applySplineFrame` (its frames are the recorder's frames), and adds a scrubber, speed, time of
day, the camera path drawn in the scene, a free-flying camera (drag, WASD, Q/E, Esc back to the shot; O for an
overview and C for a cutaway that opens the house; taking the camera pauses the shot, whose own camera stays in
the scene as a ghost that Play moves along the path; the free camera stays above the lot's ground), share links,
full screen and prev/next. Keys: Space, ←/→ (Shift: 5 s), Home/End, 1–9, T, P, F, O, C, Esc, [ ], Shift F, ?
(Space on a focused button presses that button). Everything under `?mode=view` is additive: without it the page
is the editor, and every `__house*` hook behaves as before.

A few things the player does that the editor does not:

- **Names.** The portal calls a home by `displayName` ([`assets/home-names.ts`](assets/home-names.ts)): the spec's
  filed title with its pack tag, build budget and bed/bath shorthand taken out, or a hand-picked name where that
  would leave a twin, nothing or what reads as a typo. The gallery, the player, the pre-mount loader, the pages
  `portal:build` writes and the specs it ships all use it, so a home has one name everywhere. Fix a name there, not in
  `content/houses/`: the files in the repository keep the filed title as an internal record (`pnpm run portal:build` ships the
  display name in its place, below).
- **Framing.** Shots are framed for 16:9. For a narrower window the player widens the field of view after
  `applySplineFrame` has set the shot's own (`fitFov`: the geometric mean of keeping the vertical and keeping the
  horizontal field, capped at 80°), so a phone held upright sees the house at the door and the Core with its desk
  at the end; turned while flying, the free camera takes the field the shot would have at the new shape. The eye
  path is untouched, and nothing a golden or a video renders goes through the player.
- **The first shot.** A link without `shot` opens on the house's Orbit, the whole house from above, which reads on
  every screen; Door to Core spends its middle in doorways and stairwells and is one tap away.
- **The end of a shot** is a card over the dock: replay, another shot, the next home, one line on what the
  Companion Core is, and a row with two links (Buy Companion Core, Download Companion). The title steps back while it shows. Where the card would
  cover the Core (a phone on its side, a 4:3 tablet) it moves to the end of the dock away from the Core, or drops
  its sentence and keeps the heading, the links and the buttons.
- **Phones** (and short landscape screens) get a compact dock: one scrolling row of shot and time-of-day chips,
  then play, the seek bar, the time and a More button whose sheet holds speed, path, fly, best quality and full
  screen. Every control is a 44 px target on a touch screen, and the controls fade a few seconds into playback
  (a tap on the scene brings them back). Between 761 and 1011 px (a tablet held upright) the full dock puts the
  time of day on a row of its own, so every shot's chip shows. The orange tick where the Core wakes names itself
  under the seek bar when pointed at, when the playhead reaches it, and on a touch screen as a shot starts; where
  the free-camera bar has no room for its how-to, it shows once as a toast.
- **About.** The "?" button (or the `?` key) opens a panel with what the Companion Core is, the four links (the main site, Buy Companion
  Core, Download Companion, the docs, each in a new tab) and, with a keyboard, the shortcuts. A phone has no "?" key and no room for the
  button: More > About opens the same panel, with 44 px links and no keyboard list; a press on the scene puts it away.

Until the player's module has mounted, `room-creator.html`'s head script is the player: the house's poster, its
name once `index.json` is in, a loader that says so when a slow connection makes it take a while, and a card with
**Try again** and **See all homes** when the page cannot start (no WebGL 2, a module that did not download, an
engine that threw; only the page's own scripts count, so a blocked analytics tag never raises it). An id the index
does not list gets the error card at once, with nothing built behind it. The
player asks no third party for anything: its fonts, including the ones the scene draws text in, are the repo's
own (`portal/viewer.css`); only the editor links Google Fonts.

Each home has a page of its own, `homes/<id>`: `portal:build` writes it (`scripts/portal-pages.mts`) with the home's name, what
it is, its picture, a button into the player, the Companion Core callout, and the home's own title (`<Name> · Virtual homes ·
Companion Intelligence`, one string for `<title>`, `og:title` and `twitter:title`), a description under 160 characters,
preview image and JSON-LD (a breadcrumb and the page). It is also what the share button hands out: a link that carries a
moment (`shot`, `t`, `tod`) forwards to the player with the link's query, and one without stays on the page. A search engine finds the gallery and each home's page, not the player:
the player and the editor are one file, `room-creator.html`, and `portal:build` writes `noindex, follow` into its own HTML
(nothing has to run for a crawler to know), with no canonical. The gallery's HTML lists all the homes, each linking its page, so a visitor
without JavaScript and a crawler that does not run it see them (`gallery.js` replaces them with cards that go straight to the player; the
footer's "Every home, on its own page" list, which it leaves alone, keeps the pages linked in the rendered DOM). Preview images
are JPEG at 1200 × 630 (`portal/previews/<id>.jpg`, and `portal/hero.jpg` for the gallery and the player): LinkedIn and some other
unfurlers read no WebP. A checkout served as it is has no such pages, and shares the player's own URL. The gallery
carries preview tags too, and in `dist/` `room-creator.html`'s static title and description (the editor's, in the
source) are replaced by the player's, so a player URL copied from the address bar never unfurls as the editor.
Preview images must be absolute: `portal:build` takes the site's address from `--site-url`, else `$SITE_URL`, else
the live site, `https://homes.ci.computer/`.

Every page sends a visitor on to the company: the header (Companion Intelligence, Docs, Download Companion, Buy Companion
Core), the band after the homes (the hero's Core line points at it), the footer, a home's page, the 404 page,
and the player's own HTML (a `<noscript>`), end card and About panel carry the same four addresses, exactly: <https://ci.computer>, <https://ci.computer/core>
(`/core` redirects to the product page and is still the address to link), <https://ci.computer/download>, and
the docs' first-party apps page, <https://docs.ci.computer/docs/apps-available/first-party-apps> (there is no page for the
virtual homes in the docs yet, and `docs.ci.computer/docs` itself answers 404). `portal:build` fails if a built page lacks one;
the footer also links ci.computer's privacy policy and terms.

The pages live under extensionless addresses, as Cloudflare Pages serves them (`/homes/aurora`, `/room-creator`; the
`.html` address answers a 308), so the built pages link each other without `.html` (the gallery is `./`; the source `index.html` links the
player as `room-creator.html` for `python3 -m http.server`; `portal:build` rewrites that and marks the page `vh-clean-urls` for `gallery.js`), and the
canonical and sitemap URLs are the extensionless ones. `404.html` is the 404 page, `robots.txt` allows everything and names
`sitemap.xml`, which lists the gallery and every home's page. Every `<script>` of the built pages that is not JSON carries
`data-cfasync="false"`: the `ci.computer` zone has Cloudflare's Rocket Loader on, which otherwise holds a script back and runs it after
the first paint (the player's head script, which sets the player up before the body parses, ran 400 ms late). `portal/_headers`
revalidates every file and sets a `frame-ancestors` Content-Security-Policy (the company's own sites may embed the pages; scripts
are unrestricted, so Google Analytics keeps working), a Permissions-Policy and `X-Robots-Tag: noindex` on the `pages.dev`
addresses.

### Credits: none on the site

No builder credit and no mention of the build a home was written from is shown or shipped anywhere on the public site: not on a card,
in a tooltip, in the player, on a home's page or a family's page, in the footer, in the search, in the JSON-LD, in a link preview,
in a script, a stylesheet, a spec or a data file. The pieces are our own, so there is nothing to disclose. What stays is internal:

- **In the repository**, every `content/houses/<id>.json` keeps `author`, `source` and the title the home was first filed under as
  `name`, and `content/houses/index.json` (derived: `pnpm run index`) copies them. The plans, the casting, the leak scan and the
  tests read them. Do not delete them and do not edit a name there for the site's sake (`displayName` is the name).
- **In `dist/`**, `portal:build` writes redacted copies ([`scripts/portal-redact.mts`](scripts/portal-redact.mts)): every shipped
  spec and the shipped list have no `author` and no `source`, and `name` is the display name, which is the name every reader
  (the gallery's search and cards, the player, the editor's pickers) already shows; the rest of a spec is byte for byte the repository's.
- **The guard** is step 8 of `portal:build`, and `scripts/test-portal-redact.mts` (a quick test) holds it. It reads every text file under
  `dist/` (HTML, JS, CSS, JSON, XML, text, webmanifest, SVG, `_headers`; family pages and the tour's data included) and fails the build
  if one contains a builder handle (derived from the `author` fields of `content/houses/*.json`, never listed in code, matched
  without regard to case), the word "Sims", "Base Game" or "BG ". Its allowlist (`GUARD_ALLOW` in `portal-redact.mts`) is empty;
  an entry exempts one term in one file and gives a reason. It does not read lower-case code identifiers (the wall mode `'sims'`,
  the editor's legacy `sims-*` preset keys, the `__houseSimsCut` hook), which name no build.
- **Not part of the rule**: `THIRD_PARTY.md` and `ATTRIBUTION.md` are licence records for dependencies and the model packs, and are not shipped.

Every URL in the site is relative, so the same tree works at the root of any host (the live site, a preview's
`pages.dev` address) and under a sub-path; `portal:preview` and `portal:test` serve it at `/ci-virtual-home/` to
prove it. `portal:build` copies only what the site loads into `dist/` (and refuses stale compiled assets, a missing
spec or thumbnail, a link to a file it does not ship, a root-relative URL, a count typed in
`index.html` (the lander writes its counts as words from the data), a lander that breaks its own checks (`scripts/story/lib/lander-check.mts`), and a built page without the four
links above, a `<script>` without `data-cfasync="false"`, a second `<h1>` or invalid JSON-LD); CI runs it on every PR. Nothing renders in CI: when a house's look changes, re-run
`pnpm run portal:thumbs --house <id>` on a GPU and commit the new thumbnail and preview with the change.
`portal:test` is the check to run before pushing portal work.

**What CI runs of it, and what stays by hand.** `ci.yml` runs the copy lint over the built `dist/` and, without blocking yet, `portal:test --only gallery,pages,previews,caching,failures,campaign,hooks,webkit` on
Chromium and software GL (and on WebKit when Playwright's build is installed; there is no Firefox leg). The player, motion and editor legs need a GPU and stay with you: run `pnpm run portal:test` on one
before a push that touches them. Paid traffic lands in engines no leg covers, so before each campaign someone records a pass on real devices, and writes the result in the pull request:

| Device or app | Open | Pass when |
|---|---|---|
| iOS Safari | the front page, a family page, `family/<slug>` then "Take the tour" | the page reads, the tour starts or ends on the failure card with a way back, the links to ci.computer open |
| Instagram, Facebook and TikTok in-app browsers (iOS and Android) | a family page from an ad link with `utm_source` set | the page reads without script, the tour starts or says why not, the campaign tags ride on the Core and Download links |
| Android Chrome | the same three | the same, and the seek bar and the tour card are 44 px targets |
| A desktop browser with WebGL off | `room-creator?mode=view&house=aurora&family=brennan` | the failure card, with "Read the family's story" |

The site is public to anyone with its address, and it serves what a browser needs to draw the homes: the
compiled engine (`assets/**/*.js`), three.js, the fonts and the 36 specs.

### The family stories

<a id="the-family-stories"></a>Each of the thirty houses is lived in by a **fictional family** (the six apartments have none yet: they are listed in the cast plan's `homesWithoutFamily`, keep a plain card that opens the player and a page of their own, and `portal:build` says so; a home with neither a family nor a line there is `story:cast-lint`'s error): two to six people, each with an archetype, the job they
do on the family's one Companion Core (organiser, builder, gamer, learner, maker, host, tech-family, business-owner, creative, contractor, marketer, lawyer, journalist, educator, and twelve more; the list and the eight front-page categories that group them are in [`reference/story/personas/index.md`](reference/story/personas/index.md)). A room tells that member's story: what they

do there, which Companion Hub store app does it and which cloud service it replaces. The tour is the argument for uncloud: the same life,
on your own hardware. The contract for the writers, the validator and the film is
[`reference/story/personas.md`](reference/story/personas.md); the label is "Fictional family. Real software." and the campaign's rules
(CI-Common `ADS.md`) bind the pages and the videos alike.

- **Where the words come from.** One authored file per family, `content/families/<slug>.json` (schema in `content/story/schema/`), checked by
  `pnpm run story:validate`. The slug is the family's public name (`^[a-z]+(-[a-z]+){0,2}$`, never a house id); `content/story/casting.json` (built from `cast-plan.json` by
  `pnpm run story:cast`) says which house the family lives in. The page, the popups, the captions, the voice-over and the films are all made from that file.
- **What the build adds** (`scripts/story/site.mts`, one call in step 5c2 of `portal:build`): `family/<slug>` (served without an extension, like
  `homes/<id>`), `story/manifest.json`, `story/families.<hash10>.json` (the cards a families front page would read), each family's tour, voice-over
  clips and link-preview image, all named by a hash of their bytes (`portal/_headers` keeps those for a year; every other file revalidates).
  A family page obeys the homes' pages' rules: the four company links, privacy and terms, one `<h1>` and one `<main>`, a title of at most 60
  characters and a description of at most 160, relative links without `.html`, `data-cfasync="false"`, a canonical and a sitemap entry; its fine print
  names the home it is set in ("The home is <name>.") and links `homes/<id>`; it credits no one. The story's own words never name a home or a builder
  (`scripts/story/check-leaks.mts`), and neither does anything else on the site (the [credit rule](#credits-none-on-the-site)). The salvage's
  "no home or house id is ever public" policy, its sanitised specs and its landing are not part of this site.
- **The tour** is the player with `&family=<slug>`: `room-creator?mode=view&house=<id>&family=<slug>`. `assets/viewer.ts` loads `assets/story/mount.js` only
  for that parameter (`?no=story` switches it off), which registers the baked camera track as the house's `story` shot; the player's own loop,
  scrubber and fly camera play it. The tour follows the house: next home plays that home's family, or the plain player when it has none.
  A family page with `t`, `shot`, `tod`, `play`, `beat` or `member` in its address forwards to the tour, and the player's share link points back at the family page.
<!-- ---- family pages ---- -->
- **A family's page is the landing page of an ad.** It reads with no JavaScript and no WebGL: the name, the tagline, the home's picture, "Take the tour" and "See Companion Core", one honest line about the
  3D, the label "Fictional family. Real software." (printed from `content/story/claims.json`), then a section for each person (`family/<slug>#sally`) with their moments, each linking the tour at that beat ("Watch this
  moment", `&beat=`), and "Start with Sally" (`&member=sally`: the tour opens at the first beat of her own room, the chapter where most of her beats are). Then what runs on the Core (each app, what it
  replaces, its Companion Hub store page). The tour's start card lists the family the same way; the player keeps a campaign's tags (`utm_*`, `fbclid`, `ttclid`, `gclid`, `msclkid`) in its address
  and `portal/campaign.js` carries them from the page to the tour and on to ci.computer. A family with no voice lock (none has one yet) has a captions-only tour from reading-time durations
  (`narration: false` in `story/manifest.json`), and a player that cannot start ends on a card with "Read the family's story". [`reference/story/player.md`](reference/story/player.md) has the details.
<!-- ---- end family pages ---- -->
<!-- ---- ad kit ---- -->
- **The ad kit** makes social ads from the tour: `pnpm run story:ads` plans a silent persona CUT for every member of every family that parses (the hook is the first `film: true` beat of theirs in a room, its
  title big over the room; then the beat on the tour's camera with its card, chips and karaoke captions; then an end card with "See Companion Core", `ci.computer/core` and the disclosures)
  into `content/story/ads.json`, and renders the ones that have a bake lock to `video/ads/` (gitignored; no voice or voice lock is needed). The label "Fictional family. Real software." is on every frame, the picture is daylight
  (`?lighting=day` on the editor page: the houses' own dusk is never used), the overlay is the canon's light set, and the GPU is the machine's own through ANGLE (`--gl default`, `PERSONA_CUT_GL`). Hook rule, aspects,
  safe areas, disclosures, determinism, hosting and the open items: [`reference/story/ads.md`](reference/story/ads.md).
<!-- ---- end ad kit ---- -->
<!-- ---- app media ---- -->
- **App media** are the real logos and screenshots the pages may show (`pnpm run story:media`; the manifest is `content/story/app-media.json`, the files `portal/apps/<id>/` and `portal/ci/`). A logo
  stands beside the app it names; a screenshot is real, unedited, shown whole with its label ("Real screenshot of <Name> from a Companion Hub QA run. Not a recording of this family.") and never put
  into a scene, the tour or an ad cut. Each screenshot was looked at by eye; the ones left out, and why, are the manifest's `rejected` list. `portal:build` ships only what the manifest names, fails
  on a missing file, missing alt text or a missing caption, and warns when an app a family uses has no entry. Licence rows: [THIRD_PARTY.md](THIRD_PARTY.md) "Story site: app media".
<!-- ---- end app media ---- -->
<!-- ---- layout (story v2) ---- -->
- **The layout of the story's pages (story v2)** puts the new fields and the real media to work, build-time static HTML first and a few lines of script on top (nothing needs it to be read). A **family's page**
  has a sticky nav of its people (a chip each: monogram, name, archetype word; the one being read gets `aria-current`), then for each person their bio, the card "Rented before, on the Core now" (the services
  their moments replace against the apps that do the job, with the apps' real logos), their moments with "More about this moment" (a native `<details>`: before, now, the steps, one fact about the app),
  a strip of up to three real screenshots of their apps (each opens larger in a native `<dialog>`: `portal/shots.js`), then "A day in the house" (`family.day` as a timeline), "The home" (the lede, the spots,
  the storeys, the floor area and the rooms from the spec, and a schematic floor plan with a pin for each person: `scripts/story/lib/plan-map.mts`) and "How it runs" (real Companion Hub and Companion
  account screenshots). The **front page** shows none of this media (it names apps in text; see the front page bullet below). The **tour's card** wears the app's logo on its chip and has a "More"
  toggle that opens the beat's before and after (`reference/story/player.md`). The Brennan family (`content/families/brennan.json`) is the showcase and the model for the other families' details, home, day and bios.
  Node tests: `scripts/test-story-pages.mts` (the page writer and the plan); browser tests: `family-v2.mts`, `lander.mts` and `player-more.mts` in `scripts/story/portal-tests/` (`pnpm run portal:test -- --only hooks`).
<!-- ---- end layout (story v2) ---- -->
<!-- ---- type scale (live pass 3) ---- -->
- **The tour's cards and dialogs are set in the CI canon's type scale** (the owner asked for a 36 px minimum and, seeing it, for 30 percent less, "reference the website"): rem of the canon's 17 px root, reading text in a
  modal (card, start and end cards, About, failure card, the family page's screenshot dialog) **1.5rem = 25.5 px at 768 px and wider, `clamp(20px, 5.4vw, 25.5px)` on a phone**, a card's title 2.25rem, the start and end cards'
  heading 2.6rem; Manrope 400 body, 500 controls, 600 chips, 700 titles and names (no 800), 0.2pt tracking. The tokens are `--st-min`, `--st-title` and `--st-hook` in `portal/viewer.css`; every size in the tour's CSS is one of them.
  A card is `clamp(420px, 32vw, 560px)` wide, a phone's sheet up to 55 % of the height; the placement solver (`assets/story/place.ts`) may shrink padding, choose another slot or a narrower and taller card, and never shrinks type.
  **A person's name is a kicker** on every card, dialog and family-page label: all capitals by CSS (the text and aria-labels stay as written), 700, 0.2em of tracking, in the accent; "THE BRENNAN FAMILY" the same. Film and ad
  canvases keep 36 design px (a canvas is shown scaled down). Details and the table: `reference/story/player.md`, "Type and size". Tests: `scripts/test-story-place.mts`, `scripts/test-story-pages.mts`, `typography.mts`
  (`pnpm run portal:test -- --only hooks`).
<!-- ---- end type scale (live pass 3) ---- -->
- **Stale families.** A family is shipped only when it is current: in the casting, in a house that exists, its apps in the live store, the validator clean,
  its words clean. A family written for a house that has since been re-laid, or one the casting no longer names, is stale: no page, no tour, and the build
  names it with its first reason (`--stale-report` lists them all) and carries on. A tour whose lock no longer matches (a bake or voice recorded from older
  text or an older house) is a note the same way: the page plays the Orbit. `--strict-families` (or `CI_STORY_STRICT=1`) makes every stale family, every casting
  family without a file and every such note an error, for the deploy of the whole cast.
- **The tests do not depend on a shipped home or family.** The validator's run on a small test world (`test/fixtures/stories/world/`, with the exemplar
  `test/fixtures/stories/exemplar.json`), the bake's on a frozen copy of the pre-re-lay `aurora` (`test/fixtures/stories/bake-world/houses/`), so a
  re-lay of a shipped home cannot fail them. What does read the shipped data: every role the casting lists must resolve in its home and the universal
  roles in all thirty families' homes, `story:cast --check` (the casting is derived and current), and `every content/families/<slug>.json validates`, which fails
  while a family file is one of the retired slugs.
- **The order after an edit:** `pnpm run story:validate -- <slug>`, `story:voice -- <slug> --stale`, `story:bake -- <slug>`, `portal:og`, then `portal:build` and `portal:test`.
  The `.voice.json`, `.bake.json`, audio and link-preview images are generated and committed; never hand-edit them.
<!-- front page -->
- **The front page** (`index.html`, `portal/gallery.js`, `portal/gallery.css`, `scripts/portal-front.mts`, `scripts/story/lib/lander.mts`, `pairs.mts` and `lander-check.mts`, the plan `content/story/lander.json`, the `lander` blocks of
  `scripts/build-portal.mts`; the contract is [`reference/story/lander.md`](reference/story/lander.md)) is the Companion Core's lander. It says what a Core is in the hero ("Stop renting your intelligence."; a small personal server
  that runs the household's apps and local AI at home; "Fictional family. Real software."; one action, `Take the tour`, the Brennan family's tour in the player), argues in three steps ("From rented to kept",
  `claims.json`'s own words), shows one pair in full (a beat of the Brennan file, with `Watch this moment` into the tour), offers the Core in one band (the claims, the engine's stylised Core, `Buy Companion Core`, `Download Companion`,
  the docs, what a Core is not), and then lets a visitor choose by the service they rent ("What do you rent today?": a chip for each service with the app that is an alternative to it, a chip for each job, a search, and the kind of
  place when there is more than one), under six featured families and, in a native `<details>`, every other family and home. The Core's offer is about 1.5 screens down on a desktop and 2.4 on a phone (the page it replaced:
  9.6 and 23.5). Every claim and line of fine print is `claims.json`'s, written at a marker; the cards, the proof and the chips are written into `index.html` as static HTML at build time (a crawler, a visitor without JavaScript and an
  in-app browser with a slow script read them; the chooser's controls are `disabled` until `gallery.js` runs). A pair reads "<app>, alternative to <service>"; the six counsel has not cleared are on the plan's `hold` list and
  appear nowhere on the page. Featured families pass the ad-ready gate (no `avoid` app, no service a story may not name, a home lit as day), so only a few of the thirty can be featured today. Counts are words ("Thirty fictional
  families in thirty-six homes."), written from the data. The filters live in the address (`?service=<id>&persona=<category>&type=<kind>&q=`), keep every parameter that is not theirs, and let an ad link to the exact pair
  (`/?service=google-photos`). The Core's picture is `pnpm run portal:thumbs -- --stage`. A home's page (`homes/<id>`) has "Meet the family" when a current family lives there. The hero tours the plan's `hero` (the Brennans at
  Seraphine); when that family is not current the hero plays the home. The headline's claim, `rent-line`, is the owner's own wording (approved 2026-10-20, `ok-verbatim`). A claim the plan names that is on `hold` in `claims.json` builds with a warning and fails a push to main, so an unsanctioned line cannot go live.
- **Campaign passthrough** (`portal/campaign.js`, `scripts/test-campaign.mts`, `pnpm run test:campaign`; the `campaign` leg of `portal:test`). An ad's
  `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `ttclid`, `gclid` and `msclkid` are read from the address, kept in
  `sessionStorage` under `ci-campaign` and put, **in the browser only** (the built hrefs stay exactly `https://ci.computer`, `/core` and `/download`: step 7
  checks it), on every link to those three addresses (not the docs, privacy or terms) and on every relative link marked `data-campaign` (the hero's tour, the
  family cards, a family's way into the tour, a home's page), so a campaign survives front page → family page → tour. Every page loads it with
  `<script src="./portal/campaign.js" defer data-cfasync="false"></script>` (`../portal/` in `homes/` and `family/`; the 404, served at any depth, by the site's
  absolute address), before `gallery.js`; `portal:build` adds `?v=<hash>` and fails when a page lacks it. With storage blocked it still works from the
  address. `window.CICampaign.decorate(url)` is there for a script that sets an address itself. The player (`assets/viewer.ts` `url()`) writes its own parameters
  (`OWN_PARAMS`, the same list as `assets/story/url.ts`) and keeps every other one, a campaign's tags included; the live `https://ci.computer/core` redirect may drop the query
  (see the report).
- **The player and the Buy link: campaign tags and link rules** (`portal/campaign.js`, `portal/campaign.json`). The player is `room-creator.html`, which is main's and
  is not edited; `portal:build` adds the same `campaign.js` tag (hashed, `defer`, `data-cfasync="false"`, ahead of the module that writes the address) to the built
  page's head, so the end card, the About panel and the header, which the player draws after load, are tagged as they arrive and when clicked (step 7 checks the tag;
  `scripts/story/portal-tests/campaign-player.mts` drives it; `scripts/test-campaign.mts` has the stub). The same build step shows only the message under the `<noscript>`
  when JavaScript is off. **Link rules** (`portal/campaign.json`, shipped EMPTY) are the mechanism for the owner's decision on where Buy Companion Core should go (the live
  `https://ci.computer/core` redirect drops the query): `{"version": 1, "rules": [{"match": "https://ci.computer/core", "to": "https://...", "from": "YYYY-MM-DD", "until": "YYYY-MM-DD"}]}`.
  `campaign.js` reads it with one same-origin fetch and, between `from` and `until` (UTC, both days included), maps a link to `match` (only `https://ci.computer`, `/core` or
  `/download`; never the docs, privacy, terms or hub links) to `to`, keeping the link's own query and fragment and adding the visitor's tags when `to` is on ci.computer
  (a campaign's click ids are not sent to another host). The built pages never change, and a failed or missing file changes nothing. `portal:build` copies the file and holds it to
  `CICampaign.validate()`: an expired rule, one longer than 180 days, two overlapping rules on one address, an unknown key or a bad address fail the build, so a stale rule cannot
  live on. `pnpm run test:campaign` proves a rule applies, expires and leaves the docs, privacy and terms links alone.
<!-- end front page -->

**The first preview deploy must confirm** (not verifiable from here): that Pages serves `family/<slug>.html` at `/family/<slug>` without an extension, as it does
`homes/<id>`; that the `! Cache-Control` lines of `portal/_headers` take the revalidate rule off the hashed folders (look at a response from `/audio/…` and at
`/story/manifest.json`); and that `story/manifest.json` revalidates. Record the answers here.

### Deploying

The site is the Cloudflare Pages project `ci-virtual-home`, a direct-upload project (Cloudflare does not watch
the repository), served at <https://homes.ci.computer/> and <https://ci-virtual-home.pages.dev/>.
[`ci.yml`](.github/workflows/ci.yml) assembles the site on every push and pull request (`pnpm install`, `build`,
`portal:build`) and keeps it as an artifact; [`deploy.yml`](.github/workflows/deploy.yml) uploads that artifact with a
pinned Wrangler once `ci` has passed. Nothing in `deploy.yml` builds, installs or runs repository code.

| When | Where it goes |
|---|---|
| `ci` passes on a push to `main` (or **Run workflow** on `main`, which needs `ci` to have passed on its head) | Production: <https://homes.ci.computer/> |
| `ci` passes on a pull request from a branch of this repository | A preview at `https://pr-<number>.ci-virtual-home.pages.dev/`, replaced on every push to the PR. The PR gets a `preview` status linking it, and the run's summary lists the addresses. |

A red `main` does not go live; it stays on the last commit that passed. A preview is the pull request as `ci` checked
it out (merged with `main`; a PR that conflicts with `main` gets no `ci` run, so no preview), labelled with the PR's
head commit, and its link previews point at the preview, never at production. A run only ever publishes the current
head of `main`, or of its open pull request: re-running an old run, or one that lost the race to a newer push, skips
with a notice instead of putting an older tree over a newer one. Pull requests from forks, and Dependabot's, get no
preview, and **Run workflow** on any branch but `main` does nothing.

**Caching.** The engine's modules are not fingerprinted by file name (`assets/viewer.js` is the same URL on every
deploy), and a browser can keep an old copy of one while the page that asks for it is new. That happened on the first
pass-4 deploy: a visitor who had opened the site in the previous four hours ran the *new* page against *old* modules
and every home stopped with "This home could not be opened" (`'./assets/shot-track.js' does not provide an export named
'trackView'`). Two layers keep it from happening again:

- **The page names every module by a hash of its content.** `portal:build` adds each `assets/**/*.js` (not
  `vendor/`) to the page's import map as `./assets/x.js` → `./assets/x.js?v=<hash>`, adds an import map to `index.html` (just before its first module, after its charset, title and preview tags),
  and puts the same `?v=` on the `<script>`, `<link rel="stylesheet">` and `<link rel="modulepreload">` tags. A module's
  own relative imports resolve to the plain URL, which the map rewrites, so a module never needs to know its
  neighbours' hashes and a change to one file changes only its own URL. The page itself is never cached, so it always
  says which versions it wants, and whatever an old build left in a browser's cache under the plain URLs is never
  asked for. This does not depend on any server or CDN setting.
- **[`portal/_headers`](portal/_headers)** (copied to the site root) asks every file to revalidate
  (`Cache-Control: public, max-age=0, must-revalidate`; unchanged files cost one empty 304), except the story's folders of files named by a
  content hash (`audio/`, `film/`, `portal/og/`, `portal/fonts/`, `story/families.*`), which are kept for a year. `ci-virtual-home.pages.dev`
  honours it. **`homes.ci.computer` does not by itself**: that zone's *Browser Cache TTL* (Cloudflare dashboard →
  `ci.computer` → Caching → Configuration, four hours by default) rewrites `.js`, `.css` and `.webp` responses to
  `max-age=14400` whatever the origin sends (checked: same deployment, `pages.dev` says 0, `homes.ci.computer` says
  14400 for those and 0 for `.json` and `.html`). Set it to **Respect Existing Headers** if you want revalidation on the
  custom domain too; the fingerprints make the site correct either way.

`portal:test` checks both: every module is in both import maps with its content hash, the player pulls every module by
its hash, and with every un-hashed module URL poisoned the player still starts. Do not rename or move a module without
rebuilding, and do not add a `<script>` or `<link>` to `assets/` or `portal/` that bypasses the build's rewriting.

**What the token can do.** Cloudflare's **Pages · Edit** permission cannot be limited to one project: the token can
publish to, or delete, every Pages project on the account, and this account holds seven today, among them the
public website and the docs. So exactly one file may reach it: `deploy.yml`, as it is on `main`. A `workflow_run`
always runs the copy on the default branch; the token lives in two GitHub *environments*, `production` and `preview`,
each limited to deployment from `main`, so a workflow on any other branch that names one is refused; and code from a
branch (a pull request's) only ever runs in `ci.yml`'s own run, which has no secret, and arrives as an artifact that
the upload job treats as files (it strips Pages Workers) and never runs. To take the rest of the account out of reach
entirely, move the project to a Cloudflare account of its own.

That makes **`main`'s protection the whole guard**: anyone who can put a change to `deploy.yml` on `main` can read the
token, and seven collaborators besides the owner can push to this repository. So `main` must take changes only through
a pull request that a code owner reviews (step 1 below; [`.github/CODEOWNERS`](.github/CODEOWNERS) makes the owner the
code owner of `.github/`), and `deploy.yml` does not deploy until it does.

**Owner setup, once.**

1. Protect `main`. Repository Settings → Rules → Rulesets → New branch ruleset, targeting the default branch: restrict
   deletions, block force pushes, and require a pull request before merging with **1 approval, Require review from Code
   Owners** and *Require approval of the most recent reviewable push*; add **Repository admin** to the bypass list, for
   pull requests only, so the owner can still merge their own. (Classic branch protection with the same options also
   passes, though the workflow can tell only that some rule exists, not what it says.)
2. Create an account API token (dash.cloudflare.com → Manage Account → **Account API Tokens** → Create Token; it
   needs a Super Administrator), with the one permission **Account · Cloudflare Pages · Edit** on the account that
   holds the project. An account token outlives any one person's membership; a My Profile token does not.
3. In Settings → Environments, create **`production`** and **`preview`**. Give each: Deployment branches and tags →
   Selected branches and tags → `main` alone (not *Protected branches only*, which lets every branch deploy while none
   is protected), and the environment secret `CLOUDFLARE_API_TOKEN` holding the token. No required reviewers: GitHub
   offers those on a private repository only on Enterprise plans, and the design does not need them.
4. Never add the token as a repository or organisation secret: every branch's workflows can read those, and the
   workflow fails if it finds one.

Until `main` is protected and an environment exists, is limited to `main` and holds the secret, deploys to it are
skipped with a notice, never failed, so `main` stays green. The account ID is set in the workflow
(`PAGES_ACCOUNT_ID`); a `CLOUDFLARE_ACCOUNT_ID` repository variable overrides it. The deploy for a commit is skipped
too when `ci`'s artifact has expired (after 14 days): re-run `ci` on that commit and that run deploys it.

Previews are public, and nobody approves them: anyone who can open a pull request from a branch of this repository
publishes static files at `pr-<number>`, and PR numbers are easy to guess. Nothing removes a closed PR's preview. If that
matters, turn on Cloudflare Access for the project's preview deployments in its Pages settings, and delete old
deployments in the dashboard.

**By hand** — only when the workflow cannot, since it skips `ci` and every guard above. From a clean clone of
`main`, with Wrangler logged in to that account (`pnpm dlx wrangler@4.143.0 login`). `portal:build` leaves files it
does not own in `dist/` (`export:core`'s models, for one), so start from an empty `dist/`:

```bash
rm -rf dist && pnpm install --frozen-lockfile && pnpm run build
pnpm run portal:build --site-url https://homes.ci.computer/
pnpm dlx wrangler@4.143.0 pages deploy dist --project-name=ci-virtual-home --branch=main
```

Any other `--branch` is a preview; build it with that preview's own `--site-url`
(`https://<branch>.ci-virtual-home.pages.dev/`), or its link previews point at production. Wrangler is deliberately
not a devDependency: the workflow installs it in the upload job alone, so a normal `pnpm install` does not pull it in.

**GitHub Pages is retired** for this repository. Its github.io address redirects to the organisation's old custom
domain (store.ci.computer), which serves nothing, so the former `pages.yml` deployed to nowhere and has been
removed. Nothing depends on GitHub Pages, so it can be switched off in the repository's settings.

## Player performance

`pnpm run perf:player` (`scripts/perf-player.mts`) times the live player, not the product frames. It opens the real
player at 1280 x 720 with the real GPU flags (`portal-lib.mts`'s `LAUNCH_ARGS`), serves the site the way
`portal:test` does, and injects its hooks from outside (an init script wraps `requestAnimationFrame`, and after the
house is built `renderer.render` is wrapped on the instance), so it edits nothing and is not in the gate. It reads
the clock; the product frames still never do.

```bash
pnpm run perf:player -- --mode census --houses lakecabin          # lights, meshes, materials, glass; no timing
pnpm run perf:player -- --mode bench --houses cutestarter,lakecabin,cocoon,asymmetry --dpr 2 --runs 5 --out /tmp/bench.md
pnpm run perf:player -- --mode bench --houses lakecabin --runs 5 --query no=glass,lightguard --out /tmp/no-glass.md
```

A run of `bench` gives, per house, a `shot` row (the shot plays), an `orbit` row (the free camera dragged 2 px a
frame), `idle`, and the `sync-*` rows of a tight render loop; `--defaults 2` serves the spec with `"defaults": 2`
through a route (`content/houses/` is not touched), and a fixture id from `test/fixtures/houses/` works as a house.
`--query` is appended to the player's URL, so a live-only feature with a `?no=<feature>` kill switch can be timed
on and off with the same tool. The player rewrites the address bar once it is up, so check that the query arrived
with `performance.getEntriesByType('navigation')[0].name`, not `page.url()`.

How to take a number that means something:

- Run **one** GPU-timing browser at a time, and record `uptime` beside every timing (`--out` puts it in the header,
  and every row carries its load average before and after; a row where it moved by more than 2x is marked `~`).
- Take the **median of at least 5 runs** (`--runs 5`, after the warm-up the script does itself), and **interleave A/B**
  (`attr` mode does; for two builds or two `--query` values, alternate them rather than doing all of one first).
- Judge a change on the presented **`orbit`** rows (and `shot`), not on the `sync-*` rows. The tight loop never presents
  and reads about 2.5x faster than the player's presented frames on the heavy houses (cocoon: 34 ms against 91 ms).
  It is fine for the ratio between two knobs inside one page, not for an absolute frame time.
- Noise: a house's orbit can move a lot between runs (`palms` read 27 fps at load 80 to 216 and 16 fps at load 4:
  not reproducible, so it is a poor A/B house). The load average does not see GPU contention from other jobs
  (Ollama, a VM), and the GPU timer query includes starvation gaps, so read the wall-clock frame time first and the
  `gpu` column as a hint. A weak CPU is emulated with `--throttle 4`.

## How verification works

`pnpm run check` runs these checks in order; only the goldens depend on an earlier one (they are skipped when a determinism check fails):

1. **assets** — compile `assets/**/*.ts`.
2. **specs** — validate the 36 HouseSpecs.
3. **shots** — build every house headless and walk the door-to-core, orbit, hero-reveal and core-orbit camera
   paths against its geometry: through a wall, under a floor or a flight of stairs, in through a window instead
   of the door, ending outside the hero room, Core out of frame — and through the push-in and the orbit round the
   Core, every frame keeps it framed and in sight. Sampled again at 60/s: whip pans before the orbit, and the eye
   swinging round the Core one way before the orbit sweeps it back. Also a scene check per house (dressing present, nothing buried in a wall, planting
   not on a grid). 144 shots, 36 scenes; errors fail, warnings are reported.
4. **determinism** — render frames 0, 200 and 719 of aurora's door-to-core, and 0, 240 and 479 of its core-orbit,
   in two fresh browser contexts and compare raw pixels. Frames are random access (`__houseRenderFrames(i)` renders frame *i* from scratch), and
   nothing a frame depends on may use `Math.random` or the clock — every seed comes from mulberry32 / fnv1a in
   `assets/materials.ts`.
5. **goldens** — render 150 frames (per home that has a baseline: the door-to-core, orbit and core-orbit posters and the
   door-to-core and hero-reveal final frames, at 640 × 360 through the full composer) and compare them to `test/goldens/<profile>/` with pixelmatch plus a
   mean-absolute-difference bar, so both "something moved" and "everything shifted a little" fail. Skipped if
   determinism failed, because a baseline compared against a renderer that disagrees with itself is noise.
   A branch whose change is meant to move frames lists each in the **golden ledger**, its own stream's file
   `test/goldens/expected-diffs/<stream>.json` (`{ "<house>/<shot>@<t>": { "cause" } }`, several streams may list
   one frame), and records what each moved to with `pnpm run goldens --record <stream>` (the moved frame, in LFS
   beside the ledger; a fixture frame's hash with `pnpm run fixtures --record <stream>`). A listed frame passes as
   expected only when it matches what was recorded, within the same tolerance — so a later regression in it still
   fails — and fails when it did not move, was never recorded, or moved elsewhere; anything unlisted that moved
   fails as before. `scripts/golden-ledger.mts` has the contract.
6. **tests** — every `scripts/test-*.mts`, found by glob; a script opts out or into `--quick` with an
   `@check-house` line in its header, and `@check-house advisory — <why>` lets one that is red on `main` too run
   and report without failing the gate until the fix that greens it lands (none is advisory today; delete the
   directive with the fix, so a real regression fails again). Among them `test-fixtures.mts`, the fixture houses' QA
   and frame hashes (all 62 fixtures, including `integration-all` and `integration-all-upstairs`, the all-streams smoke tests that use
   one of everything each stream added; ~13 minutes under load, not in `--quick`), and the seams' own tests, each a second or two and in `--quick`: `test-spec-types.mts` (every
   spec against `HouseSpec`), `test-spec-merge.mts` (the fragment merge rule), `test-validate-plugins.mts` (a
   plugin's `extend` and `replaces`), `test-builder-seams.mts` (what the catalog and the validator read off the
   builders) and `test-visibility.mts` (the wall roles, the shot's clock and its `shotHidden` / `shotPose` hooks);
   `test-room-composer.mts` (the room composer on the 36 specs in a dry run: overlaps, lanes, essentials by role, authored
   pieces filling their roles, repetition, variety by seed and style, the catalog) and `test-compose-parity.mts` (the page
   and Node compose the S3 fixtures alike, as blessed in `test/fixtures/compose/`, and every composed item builds to the
   box the composer had for it).
7. **perf** — build ≤ 3 s, `__houseShotTrack` ≤ 1 s and shot QA ≤ 0.5 s a shot on aurora, mirage and vanilla:
   report-only, it never fails the gate.

Baselines belong to a renderer profile (GPU + Chromium build), which is why `playwright` is pinned exactly.
The pin is a pre-release build (`1.64.0-alpha-…` in `package.json`) because that is the Chromium the baselines were blessed on. If the registry prunes it, every `pnpm install` fails: the way out is to move the pin to the nearest release on the profile machine and re-bless once, on purpose (`PROFILE.json` records the build), never to loosen the range. The CI browser job installs Chromium for it with `pnpm exec playwright install --with-deps chromium` and is allowed to fail until that is proven on a runner.
They are re-blessed **only on purpose** — `pnpm run goldens:update` after a change meant to alter the look,
reviewed frame by frame, committed with that change. Failing runs leave `*.actual/expected/diff.png` in
`test/diff/`.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs what needs no GPU: install, build, typecheck,
spec validation, the floor-plan-graph tests, `pnpm run test:node` (the quick test scripts) and the portal build. 150 frames through a software rasteriser would cost the better
part of an hour of runner time per push, so the render gate runs locally before you push, as it did in
CI-Common.

## The interior layers

The interiors program (2026-10) put five layers on top of the room composer, each owned by its own modules and gate, and a rig to measure them. They are all in the specs and the
builders now; nothing below needs a flag except the two switches that turn a layer off for an exact A/B.

| Layer | Where | What it does | Gate |
|---|---|---|---|
| **LIGHT** | `fixtures.ts`, `room-clip.ts`, `environment.ts`, `house-scheme.ts` | One room-bounded pool per lamp room (a spot clipped to the room's walls), a soft fill where there is no lamp, the ceiling bounce, the house's lamp temperature and finish scheme, GTAO 0.25 inside, an interior-aware day grade; at most 16 dynamic lights a house | `pnpm run test:light` |
| **SOFT** | `props/soft*.ts`, `props/windows.ts` | Bedding, curtains, blinds, towels, sofas, armchairs and plants rebuilt in place (same boxes: `prop-drift`) | `test-softkit`, `prop-drift`, `soft-sheet` |
| **SMALL** | `props/dress-*.ts`, `props/tableware.ts`, `props/dress-kit.ts` | The small goods a room is dressed with (counter kits, table settings, vanity sets, lamps, a café curtain …): dormant types the dress phase places | `test-dress-kit` |
| **DRESS** | `room-dress.ts`, `room-dress-hosts.ts`, `dress-recipes.ts`, `dress-curtains.ts`, `dress-leaves.ts` | The dress phase: a second pass over a frozen layout that puts those goods on the hosts the layout made. **Baked into the 36 homes** as `src: 'dress@1'` items | `test-dress-phase`, `test:dress-hosts`, `test:dress-neutral`, `dress-fleet` |
| **BAKE** | `props/baked/`, `models/`, `scripts/bake/` | 3Dinside derivatives (geometry plus role-named flat materials; no image or texture), three pilot types, **dormant**: nothing in a house references one yet | `test-baked`, `test-no-third-party-bytes` |
| **RIG** | `scripts/review/` | The review rig and the frozen BEFORE (`test/review/baselines/`) | `test-review-tools` |

**The dress phase.** `compose-house.mts --house <id> --dress --write` adds each room's recipe (`dress-recipes.ts`: kitchens a pot on the hob, counter clusters, a lamp, a café curtain;
dining a laid table; baths a roll holder, a robe hook, a towel; halls a mirror and a plant; …) at the room's own `dress.level` or 0.5, `--undress` takes every `dress@1` item out
and gives the file back byte for byte. A dress item stands on a *host* of the registry (a counter, a console, a nightstand: its flat top measured, `test:dress-hosts`), keeps 1.5 cm from
its neighbours, out of an open door leaf's parking strip and of a planned curtain's cloth, 0.3 m from the review rig's corner eyes (a bare-headed lamp 1 m), and gets its own seed
(`dress:<room>:<slot>:<n>`), so adding one moves no other prop's pick. A lamp is never the legacy halo lamp, and never in a room under 2.5 m2 (no light is built for it). A room opts
out with `"dress": false`; `?dress=0` builds any house without its dress items (baked or live), exactly the stripped house. **After a layout re-bake** (`compose-house.mts --write`
or `--rebake`) re-run `--dress --write` for the house: a dress item stands on a host the old layout had, and `test-dress-phase` (S) fails when a baked house is not what `--dress` writes today.
`?baked=0` does the same for the BAKE layer.

**Looking at a change.** A change to how rooms look is judged by eye and by the rig's numbers, not by the 150 goldens (five frames a house, most of them exteriors). Commit the product
code (the rig refuses to capture a dirty tree), `pnpm run review:capture -- --set after-<label>` (the cameras are read from `before.manifest.json`), `review:sheets --after <dir>` for the
before/after contact sheets, `review:luma` and `test:light -- --bench` for the LIGHT numbers, `review:cost -- --compare` for the budget (draw calls, meshes, triangles, texture memory,
lights per house), `review:ab generate` for the blind pairs. Run them one GPU job at a time. Frames are comparable only on the profile that made them
(`test/goldens/<profile>/PROFILE.json`, `test/review/baselines/before.manifest.json`).

**Third-party models.** The owner's 3Dinside collection (22 packs) may appear only as baked derivatives (CLAUDE.md → Licensing); `ATTRIBUTION.md` is generated and must be current
(`scripts/bake/attribution.mts --check`, run by `test-baked`), and `test-no-third-party-bytes` fails on any model, image or archive file under `assets/props/` or `models/`.

## Geometry detectors

Two detectors find, in the meshes a home really builds, what a viewer sees as "collisions and z-fighting on props and walls". Both open the editor page in headless Chromium (the GPU through ANGLE's default backend; `--gl software` is SwiftShader, about 45 times slower and with a different depth format, so a different set of ties), write JSON and pictures under `<out>/zfight` and `<out>/collide` (`--out`, else `$GEOM_OUT`, else `$TMPDIR/vh-geometry`), and write the same bytes twice (but their timings). Where Playwright's pinned Chromium is not installed, point `PLAYWRIGHT_BROWSERS_PATH` at a directory that has the build under the name Playwright asks for. Nothing in them touches the product: the page library (`scripts/review/geom-page.mts`) puts back every material, camera setting and renderer state it changes.

```bash
pnpm run review:zfight  -- --house aurora,seraphine --out /tmp/geo     # 95-150 s a house on the Intel iGPU (load dependent)
pnpm run review:collide -- --house aurora,seraphine --out /tmp/geo     # 50-75 s a house
pnpm run review:geometry-selftest                                       # plant a defect, prove each detector finds it and a clean plan does not
node --experimental-strip-types scripts/test-geometry-detectors.mts     # the pure geometry (a quick test, in `test:node`)
```

- **zfight** (`zfight.mts`, `geom-lib.mts`). Two surfaces at the same depth quantise differently under a different depth mapping, so a frame drawn twice with a different far plane is the same picture except where the depth test is a coin toss (x and y of the projection do not depend on far, and near stays put, so nothing moves). Per camera spot (the rig's corner cameras of every room at 1.5 m via `cornerCam`, 12 samples of the orbit, 14 of door-to-core, four cutaway overviews) it renders the beauty frame through the composer the goldens use at far x1, x0.94 and x1.07, and an ID pass (every mesh one flat colour with its own depth state, no lights, fog or antialiasing) at the same three. A pixel whose mesh id differs is a candidate; the two ids are the two surfaces, named with their userData class, item, room, material and chain of groups, the plane normal and the gap along a few pixel rays against the depth buffer's quantum at that distance. `vis` counts the candidates where the beauty frames also differ. `--geom` (default on) finds coplanar overlap geometrically (triangle planes within 2 mm, same facing, overlapping, not buried in another solid) and marks which pairs the renders saw. Contact images (`zfight-NN-*.png`: the frame with the candidates in magenta, boxes round the worst pairs, and 4x crops of the worst one at two depth settings and their difference).
- **collide** (`collide.mts`, `collide-lib.mts`). Groups the visible meshes under the object the builders `put` (userData `role`, `itemType`, `room`, `onSurface`, `mounted`, `foliage`, `dress`, `stair`, `isWall`), builds a convex hull per mesh (an oriented box exactly; quickhull otherwise; a concave mesh is measured by its own vertices too) and reports, ranked by penetration depth in cm (the minimum translation distance, SAT) with the shared volume in cm3: prop vs prop, prop vs wall (body, paint overlay, trim), window (frame, pane, stool), door (jamb, leaf), stair and rail; a door's swing (the leaf at eight poses) against the items of its storey; an item over a slab void, under its floor or through its ceiling (a column and a room whose `program` is `outdoor` have no ceiling to go through; an object built in world coordinates under a group at the origin, the hero's cords, is on the storey its box is on). What it lets through is the placement metadata (`content/house-catalog.json` `place`) and structure, each rule named and counted under `allowed` in the JSON (`--show-allowed`): resting (a vertical push under 4 cm), rug piles, on-surface hosts, wall-mounted, against a wall (2 cm), trim, tucks, foliage (12 cm), cable plugs. Each of the worst findings gets a picture (`collide-NN-*.png`: the two things tinted red and blue, the shared box in magenta).

Both are measuring tools, not gates: they are not in `check`, a finding is a lead to read (the picture, the two labels, the depth), and the thresholds are written in each tool's header (zfight: far x0.94 / x1.07, 2 mm coplanar tolerance, 10/255 beauty difference; collide: 1 cm contact, 1 cm minimum depth).

**Fixing what zfight finds.** Moving a part by a millimetre moves a box of the world digest: `plan.json` `shots.world` holds the mm-rounded box of every wall and structure mesh, of every liner and item within `CORE_NEAR` (3.2 m) of the Core, and of every patio over 0.08 m, and each family's bake lock carries the digest's `worldSha` (a stale lock fails `story:bake -- --check --all`). So a coplanar pair is cured, in this order, by (1) a part the digest does not read (a ceiling, a rug, a vault cap, a coping with the same outline) moved a millimetre or two; (2) a depth bias on the material that has to win the plane (`polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4`: four steps of the depth buffer, 0.16 mm at 6 m and 1.9 mm at 20 m; no slope term, because a face seen edge-on would creep through whatever thin part stands in front of it, as a biased wall cap did through a roof's eave; a stronger one to beat a neighbour that is biased already: the cube storage back panel over the liners); never (3) a 2 mm cut of a wall, a baseboard, a facade panel or a stair part, unless `pnpm run plans` then leaves every `plan.json` byte for byte. A bias needs a private copy of a shared material (`arch-materials` `own`). The detector marks a pair whose mesh carries a bias `resolved_by: polygonOffset`, and the render experiment (which draws the bias too) stops seeing it flicker; the geometric list still names the pair.

## Where it came from

Spun out of CI-Common, where it lived under `generated/infographics/` (earlier `infographic/`). This repo's root
is that directory's root, so the page's relative URLs are unchanged. Imported from branch
`clau/house-layout-pass-4` at `6ed4349cf427d0dd8e207f6420f007a2dfb9f571` — the same tree as CI-Common `main` at
`7c88159b` after #278 was squash-merged. The system was built up in companionintelligence/CI-Common
[#228](https://github.com/companionintelligence/CI-Common/pull/228) (complete houses in every shot),
[#232](https://github.com/companionintelligence/CI-Common/pull/232) (material kit, seeded site, prop registry),
[#252](https://github.com/companionintelligence/CI-Common/pull/252) (the procedural parametric home builder, moved
onto `main`) and [#278](https://github.com/companionintelligence/CI-Common/pull/278) (the Pascal-grade look),
on top of #202–#227. What changed in the move: paths (every script resolves from its own location; fonts from
`assets/fonts/`; outputs into `scenes/` and `video/`), the two Python modules `generate_house_iso.py` imports were
cut down to what it uses, and the CAD sheets were regenerated (CI-Common's were a layout pass behind the specs).
The Companion Core's own reference docs (`CHASSIS-INTERIOR.md`, `MAINBOARD-DRAWING.md`, `CAUTIONS.md`) and its
published glTF stay in CI-Common.
