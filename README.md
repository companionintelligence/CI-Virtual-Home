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
| **The public site** — thirty fictional families, each with a page and a live 3D tour of their home | [`index.html`](index.html) (template), `scripts/story/site.mts`, `room-creator.html?mode=view` ([`assets/viewer.ts`](assets/viewer.ts)), `scripts/build-portal.mts` | `dist/` → <https://homes.ci.computer/> (Cloudflare Pages, deployed from `main`; see [Deploying](#deploying)) |

30 houses ship today (where each came from is in [THIRD_PARTY.md](THIRD_PARTY.md)). The public site does not present
them as houses: it presents thirty fictional families, one per house, and never names a home or a builder (see
[The public site](#the-public-site)).

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
                                   # (the public site is built, not served from here: pnpm run portal:preview)
```

`room-creator.html` is plain ES modules with an importmap — no bundler — so any static server over the repo
root works; it cannot run from `file://`. Useful URL parameters: `house=<id>`, `shot=door-to-core|orbit|hero-reveal|walkthrough|core-orbit`,
`t=<0…1>` (the moment in the shot), `lighting=day|golden|dusk|night`, `mode=review|edit`, `flythrough=1`, `res`, `aspect`, `planner=v2` (the spline planner v2 for every door-to-core, hero-reveal and walkthrough; v1 otherwise); the
editor writes the first five as you change them, so a URL is a view (see [The editor](#the-editor)). `mode=view` turns the page into the public site's player (see [The public site](#the-public-site)).

## Commands

| Command | What it does |
|---|---|
| `pnpm run build` | Type-strips `assets/**/*.ts` to the `.js` the browser loads (esbuild `transform`, not a bundle). Run after any asset edit; `check` runs it first. |
| `pnpm run typecheck` | `tsc` over `scripts/` (Node) and over `assets/` (browser). |
| `pnpm run validate` | All 30 specs against the schema, the prop catalog and the registry, then every `scripts/validate/*.mts` plugin. `--shots` adds the headless camera-path QA; `--layout` the layout lints. |
| `pnpm run test` | `scripts/test-floorplan-graph.mts` under `node --test` — the floor-plan graph, mitres, and the wall compiler over every spec. Needs `build`. |
| `pnpm run check` | **The gate** — every check below, in order (`pnpm run typecheck` is separate). `--house a,b`, `--jobs N`, `--res`, `--update-goldens`, `--no-perf`. |
| `pnpm run check:quick` | assets + specs + shots, and the 15 test scripts marked `@check-house quick` (floor-plan graph, spec types, kit rules, QA v2's fault injection, composer, site …): the fast loop while editing. |
| `pnpm run test:node` | Only those 15 quick tests: pure Node, no browser, no GPU (a few minutes). CI runs it. |
| `pnpm run shots` | Render product shots to `video/houses/` (`--house`, `--shot`, `--res 1080`, `--aspect 16:9`, `--poster-only`, `--qa-only`, `--jobs`). |
| `pnpm run goldens` / `goldens:update` | Compare 150 frames with the committed baselines / re-bless them. |
| `pnpm run frame-hash` | Two fresh browser contexts must render the same frames. |
| `pnpm run test:twins` | The Python twins (`generate_floor_plans.py`, `generate_house_iso.py`) on the 30 houses and every fixture: they must run, reproduce the committed sheets, isometrics and Lotties byte for byte on the 30, and draw what S2's fixtures show (porches, bays, L/U stairs, floor patterns …) from `<id>.plan.json`'s `arch` key. `check` runs it; ~2 min, needs a GPU for the fixtures' plans. |
| `pnpm run fixtures` | Validate, QA and render the fixture houses in `test/fixtures/houses/` to stills (`test/fixtures/out/`, to look at) and compare their frame hashes (`--fixture`, `--update` to bless your own fixture, `--record <stream>` for another's frame your branch moves). |
| `pnpm run perf` | Build, track and shot-QA timings against their budgets (3 s / 1 s / 0.5 s), report-only, with each number's Δ against the committed `test/perf/baseline.json` (`--house`, `--all`, `--baseline` to rewrite it at integration). |
| `pnpm run perf:player` | Advisory timing of the live player (`room-creator.html?mode=view`) in Chromium on the real GPU: presented frame times, CPU and GPU time of `renderer.render`, draw calls, programs. Modes `bench` (default) `attr` `load` `raf` `profile` `census`; `--houses a,b`, `--defaults 1,2`, `--dpr 2`, `--throttle 4`, `--runs N`, `--query no=glass,…` (appended to the player URL, for A/B of a live-only feature), `--out <file.md>` (rows plus the header line with commit and `uptime`), `--json <file>`. Not part of `check` or CI: timings depend on the machine's load. See *Player performance*. |
| `pnpm run shot-planner` | Spline planner v2 on all 30 houses (`assets/shot-planner.ts`): planned twice byte-identical, QA v2, the fleet camera targets, the page's track hash equal to Node's (`--parity`), the planning and QA budgets. Worlds come from `test/qa/shot-worlds/` (built in the page once, `--rebuild-worlds` / `--stale-ok`); `--update` records `test/shots/<id>.track.json`. |
| `pnpm run shot-qa` | A fault injected for every QA v2 code, and for every fleet check, on two frozen worlds (`test/shots/worlds/`): each must be caught. No browser. |
| `pnpm run camera-audit` | A contact strip per house and planner (twelve frames, the plan with the path by beat), the camera metrics of v1 and v2 side by side → `test/qa/camera-audit/index.html` (`--house`, `--planner v1,v2`, `--fixtures`). |
| `pnpm run fleet-audit` | The fleet sameness metrics (door colours, claddings, lighting, furniture repetition, planting …) → `test/qa/fleet-audit.md`, beside the committed baseline `test/fleet/baseline.json`. `--built` measures what this tree's builders generate (plans rebuilt into `test/qa/plans/`); `--baseline` rewrites the baseline (integration only). |
| `pnpm run plans` | Rebuild `content/houses/<id>.plan.json` — the seeded site instances the isometric twin draws. |
| `pnpm run iso` | Rebuild the isometric SVGs, Lotties and `scenes/manifest.json` (`--only <id>`, `--png`). |
| `pnpm run floorplans` | Rebuild the CAD sheets and `floorplans.json` (`--only <id>`, `--no-png`, `--fit lot`). |
| `pnpm run catalog` | Measure every prop type in the browser → `content/house-catalog.json` (footprint, height, draw calls, params, placement), `assets/props/measured.ts` (the boxes the composer sizes with, and how they grow with `w` `d` `l` `r` `h`) and `content/house-styles.json`. |
| `node --experimental-strip-types scripts/compose-house.mts --house <id>` | Compose a house's rooms from their `program`s in Node and report them (`--infer`, `--replace`, `--style`, `--seed`, `--lint`), or bake a composition into a spec (`--write`). |
| `pnpm run index` | Validate every spec and rebuild `content/houses/index.json` (the page's house list). |
| `pnpm run prop-sheet` | Contact sheet of props, measured against their declared sizes (`--types`, `--module`, `--all`). |
| `pnpm run export:core` | The Companion Core as glTF (`--finish`, `--pose`) → `dist/models/`. |
| `pnpm run story:validate` | The family stories (`content/families/<slug>.json`) against the schema, the Uncloud voice, `claims.json`, the app catalog and each beat's own house. `-- <slug>` for one, `-- --complete` for the whole set of thirty and the fleet counts. No GPU. See [`reference/story/validator.md`](reference/story/validator.md). |
| `pnpm run story:bake` | Each family's camera: a safe pose per beat, the walks between them and the tour's track → `content/families/<slug>.bake.json` (`-- <slug>`, `-- --all`, `--check`, `--stills <dir>` renders contact sheets on one GPU process). Run it after the voice, so the durations are the voice's. [`reference/story/bake.md`](reference/story/bake.md) |
| `pnpm run story:voice` | The narration, generated **locally** with Kokoro-82M (no cloud service, no key) → `content/families/<slug>.voice.json` and `<slug>/audio/<clip>.<hash10>.m4a` (`-- <slug>`, `-- --all`, `--stale`, `--dry-run`, `--sheet`). [`reference/story/voice.md`](reference/story/voice.md) |
| `pnpm run test:voiceover` | Every committed voice lock: clips hashed and intact, loudness, word timings, the family budget. Also part of `check:quick`. |
| `pnpm run story:film` | One film per family in 16:9 and 9:16, from the tour's own camera and voice (`-- <slug>`, `-- --all`, `--dry-run`, `--stills <dir>`). One GPU process; the films are hosted outside Pages. [`reference/story/film.md`](reference/story/film.md) |
| `pnpm run portal:thumbs` | Render the pictures the site is made from → `portal/thumbs/<house id>.webp` and `portal/hero.webp` (the featured family's), and the 1200 × 630 JPEGs `portal/previews/<house id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--hero-tod`, `--max-kb`). They keep the house's id because they are inputs: the build ships them under the family's slug with a content hash. Needs a GPU; commit the output. |
| `pnpm run portal:og` | Draw the link-preview images → `portal/og/<slug>.jpg` and `home.jpg`, with `portal/og/manifest.json` (Chromium's 2D canvas, no GPU; `--only`, `--families`). Re-run it when a family's text or its preview picture changes: a production build refuses a stale one. Commit the output. |
| `pnpm run portal:build` | Assemble the site in `dist/` — only what it loads — and check its links. Needs `build`. `--allow-partial` builds the families there are (development and previews; the live address needs all thirty); `--families <dir>` reads another folder. |
| `pnpm run portal:preview` | `portal:build`, then serve `dist/` at <http://127.0.0.1:8081/ci-virtual-home/> (`--port`). |
| `pnpm run portal:test` | Check the built site under `/ci-virtual-home/`: the leak scan, slugs and routes, the copy lint, the landing's weight, then in Chromium the landing and its filters, the family pages, an accessibility audit, the player (fly, share, old links, failures) and the editor from a checkout (`--family a,b,c`, `--shots`); and in WebKit when Playwright's build for the pinned version is installed (`pnpm exec playwright install webkit`; `--webkit` requires it). Run it alone: one browser at a time. |
| `pnpm run ui:test` | Drive the editor end to end (layout at four sizes in both schemes, contrast, the top bar, the checks, the timeline, the tree, the catalog, Compare, stills at 4K, a recorded MP4 checked with ffprobe and by PSNR) — `--only <sections>`, `--shots <dir>`. Needs a GPU and ffmpeg. |

Every script resolves the repo from its own location, so they run from any directory. After editing a spec:
`validate` → `plans` → `iso` → `floorplans` → `check`, and commit the regenerated files with the spec.

## Layout

```
room-creator.html          the editor + renderer page; loads assets/*.js and content/houses/*.json.
                           ?mode=view is the player (assets/viewer.ts, portal/viewer.css); in dist/ it is the player only
index.html                 the landing's TEMPLATE (portal/site.css, gallery.css, gallery.js); scripts/story/site.mts fills it
portal/                    the site's styles and scripts, fonts/ (Archivo Black), thumbs/<house id>.webp, hero.webp, previews/
                           <house id>.jpg and hero.jpg (derived, committed, shipped by slug and hash) and og/ (link previews)
content/families/          the authored stories, <slug>.json (the writers' files; the voice and bake locks sit beside them)
content/story/             casting.json (slug <-> house), claims.json, catalog-apps.json, the schema: the story system's inputs
assets/site/identity.ts    who a home is on screen: the family's title, address, share link and errors (the only place)
scripts/story/             site.mts (the build of the public pages), pages.mts, site-lib.mts, build-og.mts, check-leaks.mts,
                           check-copy.mts, hooks.ts (the seams: ship/*.mts at build, portal-tests/*.mts at test)
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
  props/                   the prop registry — one module per category, ~150 props
  vendor/three/            three.js r169 + addons, vendored (one local patch; see THIRD_PARTY.md)
  fonts/                   Manrope + JetBrains Mono woff2 the capture scripts serve instead of Google Fonts
  brand/                   the CI mark the page shows
  ui/                      the editor's modules: recorder + mp4-mux + webm-mux (Record), timeline, plan-inset, path-overlay,
                           gallery, compare, qa, toast, undo, url-state, format (S6, the editor)
  viewer.ts                the portal's player: shots, scrubber, time of day, path, fly (room-creator ?mode=view)
  viewer-batch.ts          the player's live-only static batching: merges each toggle unit's static opaque meshes (a third of the draw
                           calls); only viewer.ts imports it, `?no=batch` switches it off, the recorder / goldens / editor never see it
content/houses/            <id>.json — the 30 HouseSpecs (source); <id>.plan.json and index.json — derived
content/house-catalog.json every item type's measured footprint, height and iso parts (derived)
scenes/                    isometric SVG + Lottie, CAD floor plans, and their manifests (all derived, committed)
scripts/                   the pipeline: build, validate, render, gate (.mts) and the Python generators (.py)
  validate/                validator plugins, one per stream (validate-house-spec.mts loads them)
  fleet/                   fleet-audit metrics, one file per stream
reference/                 HOUSE-SPEC.md (the schema), PARAMETRIC-INTERIORS-PLAN.md (design + roadmap),
                           HOUSE-SYSTEM-REVIEW-2026-09-15.md (historical review)
test/goldens/macos-metal/  150 committed baseline frames (Git LFS) + PROFILE.json (the renderer that made them)
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
  change them. What you add from the catalog (the four tabs, and **Props**: the 154 registry props of `house-catalog.json`) lands
  where the view's centre ray meets the floor (three metres ahead of the eye through a level shot's lens, and always on the lot);
  a prop whose placement metadata says `against: 'wall'` (S3's `place`) is set against the nearest outside wall, facing in. Undo
  and redo (Ctrl or Cmd Z, with Shift) cover adding, deleting, duplicating, moving and re-finishing. Opening another home rebuilds
  it from its spec, so what you added goes; the picker says so in a toast. The scene is a tree — storey, room, part — with a
  search, and one tab stop.

Every `__house*` hook the gates and the portal use is unchanged; the editor adds none but `houseContactSheet`'s
`__houseRenderFrames(from, count, null)` (draw without encoding a JPEG) and a studio scene's shot key for `__houseRenderBegin`.
`pnpm run ui:test` is the acceptance for all of it.

## The public site

<a id="the-public-site"></a>The site is thirty **fictional families**, one per house: a landing, a page for each family, and a live 3D
tour of their home. It says "Fictional family. Real software." wherever a family is, and it names no home, no builder and no
house id anywhere (the owner's rule; provenance stays in this repository, in [THIRD_PARTY.md](THIRD_PARTY.md) and the specs'
own `author` and `source` fields, which are never edited and never shipped).

| URL | What |
|---|---|
| `/` | the landing: the first-run steps, the family cards with a household facet, ten topic chips and a search, a story in every room, what local means, the Companion Hub's swaps, the disclosures |
| `/family/<slug>` | a family's page (static HTML, readable without JavaScript): the people, every scene of the tour as a transcript, the apps with what they replace, how the Core starts. A query with `t`, `shot`, `tod`, `play` or `beat` forwards to the tour |
| `/room-creator.html?mode=view&family=<slug>[&shot=<shot>][&t=<0…1>][&tod=day|golden|dusk|night][&play=1|0][&no=glass|…]` | the tour: the editor's own renderer with its chrome put away (player notes below) |
| `/credits.html`, `/sitemap.xml`, `/robots.txt`, `/_redirects` | credits, crawlers, and the 301s from the old `homes/<id>.html` share pages |

**Where the words come from.** One authored file per family, `content/families/<slug>.json` (schema in
`content/story/schema/`, rules in the story bible). `scripts/story/site.mts` is the only thing that turns them into pages. The
**slug** is the public name (`^[a-z]+(-[a-z]+){0,2}$`, never a creator's name; `content/story/casting.json` maps it to the
internal house id). Nothing else in `dist/` carries a house id: the specs ship as `content/homes/<slug>.<hash10>.json` with
`name`, `author`, `source`, `emoji` and `$schema` removed and every other byte as it was (the `id` stays: 25 call sites seed the
geometry from it). The old `?house=<id>` links still work: the player hashes the id (SHA-256, 12 hex), looks the hash up in
`story/legacy.<hash10>.json`, rewrites the address to `?family=<slug>` at once and shows only the family. An unknown address gets
"There is no family at this address" and nothing is echoed.

**The build** (`pnpm run portal:build`, step 5 of `scripts/build-portal.mts`):

- `dist/story/manifest.json` (type `SiteManifest`) is the one un-hashed data file, revalidated on every load; everything it points
  to is named `<name>.<hash10>.<ext>` and cached for a year (`portal/_headers`): the sanitised specs, `story/families.<hash>.json`
  (the cards), `story/legacy.<hash>.json`, thumbnails, posters, link-preview images, Archivo Black, and whatever the other packages add.
- `scripts/story/ship/*.mts` and `scripts/story/portal-tests/*.mts` are the seams (types in `scripts/story/hooks.ts`): the
  voice-over, the tour and the films drop a file in and are built and tested without touching `build-portal.mts` or
  `test-portal.mts`.
- The output is an allowlist: the build fails on a file nothing asked for or one it wrote that is gone, on a link to a file the
  output lacks, on a root-relative URL, and on a family whose app is not in `content/story/catalog-apps.json`.
- A **production** build (`https://homes.ci.computer/`, the default) needs all thirty families and current link-preview images
  (`pnpm run portal:og`). Any other address (`--site-url`, `$SITE_URL`: a preview, a checkout) or `--allow-partial` builds the
  families that exist, with `noindex`; with none yet it builds the three test families in `test/fixtures/site/families/`.
- `dist/room-creator.html` is the player only: `window.__VH_PUBLIC=1` is written into it, a visit without `?mode=view` is sent to
  the landing, its static head is the site's, and comments that name a home or a builder are taken out of it and of the compiled
  modules. `assets/home-names.js` is replaced by a neutral stub. The editor works from a checkout as it always did.

**The checks** (`pnpm run portal:test`, alone on the machine): T1 a leak scan of every file and file name (`scripts/story/check-leaks.mts`);
T2 slugs, routes, the sitemap and the legacy map; T3 the copy lint of every page and the card data against `claims.json`
(`scripts/story/check-copy.mts`); T4 every app is in the catalog; T9 the landing's weight (HTML + JS + CSS + JSON under 400 KB, and no
audio, video, three.js or engine module before an interaction); T10 the offline renderers are untouched; then the browser checks.
The accessibility audit is in-repo (names, landmarks, headings, labels, ids, contrast) because axe-core is MPL-2.0.

### The player

The tour is `room-creator.html?mode=view&family=<slug>`. `t` is the fraction of the shot; a link with `t` opens paused there, one
without plays from the start, and `play=1|0` says so outright, but nothing starts moving by itself for a visitor whose system asks
for reduced motion (the landing's links carry no `play`). The player lists the shots from the house's presets, plays them through the
page's `applySplineFrame` (its frames are the recorder's frames), and adds a scrubber, speed, time of day, the camera path drawn in
the scene, a free-flying camera (drag, WASD, Q/E, Esc back to the shot; O for an overview and C for a cutaway that opens the house;
taking the camera pauses the shot, whose own camera stays in the scene as a ghost that Play moves along the path; the free camera
stays above the lot's ground), share links, full screen and previous and next family. Keys: Space, ←/→ (Shift: 5 s), Home/End, 1–9,
T, P, F, O, C, Esc, [ ], Shift F, ? (Space on a focused button presses that button). Everything under `?mode=view` is additive: without
it the page is the editor, and every `__house*` hook behaves as before.

- **Names.** The player says what the family list says (`assets/site/identity.ts`): "The <Surname> family", the invented address and
  the disclosure under it; the tab reads `<title> · Companion Core`. In public mode the page's "house id" is the slug: the head
  script builds `window.__vhIndex` from the family list, sets `window.__vhWant`, and `loadHouse(slug)` fetches the sanitised spec by
  the URL the manifest names (`window.__vhSpecUrl`). In a checkout (`?house=<id>`, as the perf tools use it) the title is the id
  spelled out; there is no credit anywhere.
- **Framing.** Shots are framed for 16:9. For a narrower window the player widens the field of view after `applySplineFrame` has set
  the shot's own (`fitFov`: the geometric mean of keeping the vertical and keeping the horizontal field, capped at 80°). The eye path
  is untouched, and nothing a golden or a video renders goes through the player.
- **The first shot.** A link without `shot` opens on the house's Orbit; Door to Core is one tap away.
- **The end of a shot** is a card over the dock: replay, another shot, the next family, and one line on what the Companion Core is,
  linking to <https://ci.computer>. Where it would cover the Core it moves away from it, or drops its sentence.
- **Phones** get a compact dock: one scrolling row of chips, then play, the seek bar, the time and a More sheet. Every control is a
  44 px target on a touch screen.

Until the player's module has mounted, `room-creator.html`'s head script is the player: the poster, the family's name, a loader that
says so when a slow connection makes it take a while, and a card with **Try again** and **See all families** when the page cannot start.
The player asks no third party for anything.

Every URL in the site is relative, so the same tree works at the root of any host and under a sub-path; `portal:preview` and
`portal:test` serve it at `/ci-virtual-home/` to prove it. Family pages are linked and served without an extension
(`family/<slug>`); `scripts/portal-lib.mts` does what Cloudflare Pages does. Nothing renders in CI: when a house's look changes,
re-run `pnpm run portal:thumbs --house <id>` on a GPU and `pnpm run portal:og`, and commit the new pictures with the change.

**The first preview deploy must confirm** (not verifiable from here): that Pages serves `family/<slug>.html` at `/family/<slug>`
without an extension, and what it does with a trailing slash; that a `_redirects` 301 keeps the query string
(`/homes/<id>.html?t=…`); that the `! Cache-Control` lines of `portal/_headers` take the revalidate rule off the hashed folders (look
at a response from `/portal/thumbs/…` and at `/story/manifest.json`); and that `story/manifest.json` revalidates. Record the answers here.

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
  `vendor/`) to the page's import map as `./assets/x.js` → `./assets/x.js?v=<hash>`, adds a small one (the two modules the landing warms) to `index.html`,
  and puts the same `?v=` on the `<script>`, `<link rel="stylesheet">` and `<link rel="modulepreload">` tags. A module's
  own relative imports resolve to the plain URL, which the map rewrites, so a module never needs to know its
  neighbours' hashes and a change to one file changes only its own URL. The page itself is never cached, so it always
  says which versions it wants, and whatever an old build left in a browser's cache under the plain URLs is never
  asked for. This does not depend on any server or CDN setting.
- **[`portal/_headers`](portal/_headers)** (copied to the site root) asks every file to revalidate
  (`Cache-Control: public, max-age=0, must-revalidate`; unchanged files cost one empty 304). `ci-virtual-home.pages.dev`
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
2. **specs** — validate the 30 HouseSpecs.
3. **shots** — build every house headless and walk the door-to-core, orbit, hero-reveal and core-orbit camera
   paths against its geometry: through a wall, under a floor or a flight of stairs, in through a window instead
   of the door, ending outside the hero room, Core out of frame — and through the push-in and the orbit round the
   Core, every frame keeps it framed and in sight. Sampled again at 60/s: whip pans before the orbit, and the eye
   swinging round the Core one way before the orbit sweeps it back. Also a scene check per house (dressing present, nothing buried in a wall, planting
   not on a grid). 120 shots, 30 scenes; errors fail, warnings are reported.
4. **determinism** — render frames 0, 200 and 719 of aurora's door-to-core, and 0, 240 and 479 of its core-orbit,
   in two fresh browser contexts and compare raw pixels. Frames are random access (`__houseRenderFrames(i)` renders frame *i* from scratch), and
   nothing a frame depends on may use `Math.random` or the clock — every seed comes from mulberry32 / fnv1a in
   `assets/materials.ts`.
5. **goldens** — render 150 frames (per house: the door-to-core, orbit and core-orbit posters and the
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
   and frame hashes (all 51 fixtures, including `integration-all` and `integration-all-upstairs`, the all-streams smoke tests that use
   one of everything each stream added; ~13 minutes under load, not in `--quick`), and the seams' own tests, each a second or two and in `--quick`: `test-spec-types.mts` (every
   spec against `HouseSpec`), `test-spec-merge.mts` (the fragment merge rule), `test-validate-plugins.mts` (a
   plugin's `extend` and `replaces`), `test-builder-seams.mts` (what the catalog and the validator read off the
   builders) and `test-visibility.mts` (the wall roles, the shot's clock and its `shotHidden` / `shotPose` hooks);
   `test-room-composer.mts` (the room composer on the 30 specs in a dry run: overlaps, lanes, essentials by role, authored
   pieces filling their roles, repetition, variety by seed and style, the catalog) and `test-compose-parity.mts` (the page
   and Node compose the S3 fixtures alike, as blessed in `test/fixtures/compose/`, and every composed item builds to the
   box the composer had for it).
7. **perf** — build ≤ 3 s, `__houseShotTrack` ≤ 1 s and shot QA ≤ 0.5 s a shot on aurora, mirage and vanilla:
   report-only, it never fails the gate.

Baselines belong to a renderer profile (GPU + Chromium build), which is why `playwright` is pinned exactly.
They are re-blessed **only on purpose** — `pnpm run goldens:update` after a change meant to alter the look,
reviewed frame by frame, committed with that change. Failing runs leave `*.actual/expected/diff.png` in
`test/diff/`.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs what needs no GPU: install, build, typecheck,
spec validation, the floor-plan-graph tests, `pnpm run test:node` (the 15 quick test scripts) and the portal build. 150 frames through a software rasteriser would cost the better
part of an hour of runner time per push, so the render gate runs locally before you push, as it did in
CI-Common.

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
