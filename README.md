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
| **Web portal** — a gallery of the homes and a live player to fly their camera paths | [`index.html`](index.html), `room-creator.html?mode=view` ([`assets/viewer.ts`](assets/viewer.ts)), `scripts/build-portal.mts` | `dist/` → <https://homes.ci.computer/> (Cloudflare Pages) and <https://companionintelligence.github.io/ci-virtual-home/> |

30 houses ship today, each a Sims 4 gallery build re-authored as a spec (see [THIRD_PARTY.md](THIRD_PARTY.md)
for how they are credited).

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
`t=<0…1>` (the moment in the shot), `lighting=day|golden|dusk|night`, `mode=review|edit`, `flythrough=1`, `res`, `aspect`; the
editor writes the first five as you change them, so a URL is a view (see [The editor](#the-editor)). Its "All homes" link opens
the portal's gallery, `./index.html`; `mode=view` turns the page into the portal's player (see [The web portal](#the-web-portal)).

## Commands

| Command | What it does |
|---|---|
| `pnpm run build` | Type-strips `assets/**/*.ts` to the `.js` the browser loads (esbuild `transform`, not a bundle). Run after any asset edit; `check` runs it first. |
| `pnpm run typecheck` | `tsc` over `scripts/` (Node) and over `assets/` (browser). |
| `pnpm run validate` | All 30 specs against the schema, the prop catalog and the registry, then every `scripts/validate/*.mts` plugin. `--shots` adds the headless camera-path QA; `--layout` the layout lints. |
| `pnpm run test` | `scripts/test-floorplan-graph.mts` under `node --test` — the floor-plan graph, mitres, and the wall compiler over every spec. Needs `build`. |
| `pnpm run check` | **The gate** — every check below, in order. `--house a,b`, `--jobs N`, `--res`, `--update-goldens`, `--no-perf`. |
| `pnpm run check:quick` | assets + specs + shots, and the test scripts marked `@check-house quick` (the floor-plan graph): the fast loop while editing. |
| `pnpm run shots` | Render product shots to `video/houses/` (`--house`, `--shot`, `--res 1080`, `--aspect 16:9`, `--poster-only`, `--qa-only`, `--jobs`). |
| `pnpm run goldens` / `goldens:update` | Compare 150 frames with the committed baselines / re-bless them. |
| `pnpm run frame-hash` | Two fresh browser contexts must render the same frames. |
| `pnpm run fixtures` | Validate, QA and render the fixture houses in `test/fixtures/houses/` to stills (`test/fixtures/out/`, to look at) and compare their frame hashes (`--fixture`, `--update` to bless your own fixture, `--record <stream>` for another's frame your branch moves). |
| `pnpm run perf` | Build, track and shot-QA timings against their budgets (3 s / 1 s / 0.5 s), report-only, with each number's Δ against the committed `test/perf/baseline.json` (`--house`, `--all`, `--baseline` to rewrite it at integration). |
| `pnpm run fleet-audit` | The fleet sameness metrics (door colours, claddings, lighting, furniture repetition, planting …) → `test/qa/fleet-audit.md`, beside the committed baseline `test/fleet/baseline.json`. `--built` measures what this tree's builders generate (plans rebuilt into `test/qa/plans/`); `--baseline` rewrites the baseline (integration only). |
| `pnpm run plans` | Rebuild `content/houses/<id>.plan.json` — the seeded site instances the isometric twin draws. |
| `pnpm run iso` | Rebuild the isometric SVGs, Lotties and `scenes/manifest.json` (`--only <id>`, `--png`). |
| `pnpm run floorplans` | Rebuild the CAD sheets and `floorplans.json` (`--only <id>`, `--no-png`, `--fit lot`). |
| `pnpm run catalog` | Measure every prop type in the browser → `content/house-catalog.json`. |
| `pnpm run index` | Validate every spec and rebuild `content/houses/index.json` (the page's house list). |
| `pnpm run prop-sheet` | Contact sheet of props, measured against their declared sizes (`--types`, `--module`, `--all`). |
| `pnpm run export:core` | The Companion Core as glTF (`--finish`, `--pose`) → `dist/models/`. |
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp`, and the link-preview JPEGs → `portal/previews/<id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--hero-tod`, `--max-kb`). Needs a GPU; commit the output. |
| `pnpm run portal:build` | Assemble the Pages site in `dist/` — only what it loads — and check its links. Needs `build`. |
| `pnpm run portal:preview` | `portal:build`, then serve `dist/` at <http://127.0.0.1:8081/ci-virtual-home/> (`--port`). |
| `pnpm run portal:test` | Drive the built site under `/ci-virtual-home/` in Chromium: gallery, player, fly, share, the editor (`--house`, `--shots`); and in WebKit when Playwright's build for the pinned version is installed (`pnpm exec playwright install webkit`; `--webkit` requires it). |
| `pnpm run ui:test` | Drive the editor end to end (layout at four sizes in both schemes, contrast, the top bar, the checks, the timeline, the tree, the catalog, Compare, stills at 4K, a recorded MP4 checked with ffprobe and by PSNR) — `--only <sections>`, `--shots <dir>`. Needs a GPU and ffmpeg. |

Every script resolves the repo from its own location, so they run from any directory. After editing a spec:
`validate` → `plans` → `iso` → `floorplans` → `check`, and commit the regenerated files with the spec.

## Layout

```
room-creator.html          the editor + renderer page; loads assets/*.js and content/houses/*.json.
                           ?mode=view is the portal's player (assets/viewer.ts, portal/viewer.css)
index.html                 the portal's gallery (portal/gallery.css, portal/gallery.js)
portal/                    the portal's styles and script, thumbs/<id>.webp and hero.webp, and the link-preview
                           JPEGs previews/<id>.jpg and hero.jpg (derived, committed)
floorplan-graph-demo.html  the Phase 2 floor-plan graph beside its compiled walls
assets/                    the three.js engine, in TypeScript. house-builder.ts is the orchestrator; each part is a
                           module one stream owns: item-map + hero-build (kit), structure-build (architecture),
                           rooms-build (compose), site-build (site), shot-planner-v1 + shot-track (shot),
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
tools, the selection and the scene tree. Below 1100 px the sidebars are drawers; on a phone the transport is a bottom sheet.

- **Homes.** The picker (G) is a grid of the homes' thumbnails with a search and the arrow keys; `?house=&shot=&t=&lighting=&mode=`
  follows every change and a reload restores it. **Compare** (C, or the picker's button) draws every home at the same shot,
  moment and light through the film's renderer, as a grid you can save as one PNG sheet — the direct answer to "each home
  looks the same". It rebuilds each home in turn and puts yours back.
- **The film.** The timeline under the transport shows the shot's beats (or, until planner v2, its v1 phases, hatched), event
  ticks (in the door, on the stairs, the Core's button), the checks' findings as markers, and the camera's speed and turn.
  Space plays; ← → step a frame (Shift: a second); Home / End; L loops, B loops the beat the playhead is in. The plan inset (M)
  follows the camera up the storeys; the camera path (P) is drawn over the view and can never reach a render.
- **Checks.** After a home builds, the scene checks and every gated shot's checks run in idle time: the badge counts errors
  (heat, its one use in the UI) and warnings, the list jumps the timeline to each finding. `?qa=1` runs them in a page a
  harness drives (they are off under `navigator.webdriver`, so a gate is not slowed by them).
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
  (`scripts/test-ui.mts`, `scripts/test-ui-units.mts`). A 12 s film at 30 fps is 12.000 s and 360 frames.
- **Editing.** A home's own parts (built from its spec) are locked: Backspace and the bin do nothing, and a toast says where to
  change them. What you add from the catalog (the four tabs, and **Props**: the 154 registry props of `house-catalog.json`) lands
  where the view's centre ray meets the floor; a prop whose placement metadata says `against: 'wall'` (S3's `place`) is set against
  the nearest outside wall, facing in. Undo and redo (Ctrl or Cmd Z, with Shift) cover adding, deleting, duplicating, moving and
  re-finishing. The scene is a tree — storey, room, part — with a search, and one tab stop.

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
  title with the Sims gallery shorthand taken out ("Base Game", "BG", a build budget, "Fix"), or a hand-picked
  name where that would leave a twin, nothing or what reads as a typo ("Base Game Modern House 1" → "Modern
  Studio House"). The gallery, the player, the pre-mount loader and the share pages all use it; the spec's own
  title stays the credit: the gallery's footer lists every home against it and its builder, a share page's
  description names it, and it is the tooltip beside the builder's name. The specs are not edited for it.
- **Framing.** Shots are framed for 16:9. For a narrower window the player widens the field of view after
  `applySplineFrame` has set the shot's own (`fitFov`: the geometric mean of keeping the vertical and keeping the
  horizontal field, capped at 80°), so a phone held upright sees the house at the door and the Core with its desk
  at the end; turned while flying, the free camera takes the field the shot would have at the new shape. The eye
  path is untouched, and nothing a golden or a video renders goes through the player.
- **The first shot.** A link without `shot` opens on the house's Orbit, the whole house from above, which reads on
  every screen; Door to Core spends its middle in doorways and stairwells and is one tap away.
- **The end of a shot** is a card over the dock: replay, another shot, the next home, and one line on what the
  Companion Core is, linking to <https://ci.computer>. The title steps back while it shows. Where the card would
  cover the Core (a phone on its side, a 4:3 tablet) it moves to the end of the dock away from the Core, or drops
  its sentence and keeps the heading, the link and the buttons.
- **Phones** (and short landscape screens) get a compact dock: one scrolling row of shot and time-of-day chips,
  then play, the seek bar, the time and a More button whose sheet holds speed, path, fly, best quality and full
  screen. Every control is a 44 px target on a touch screen, and the controls fade a few seconds into playback
  (a tap on the scene brings them back). Between 761 and 1011 px (a tablet held upright) the full dock puts the
  time of day on a row of its own, so every shot's chip shows. The orange tick where the Core wakes names itself
  under the seek bar when pointed at, when the playhead reaches it, and on a touch screen as a shot starts; where
  the free-camera bar has no room for its how-to, it shows once as a toast.

Until the player's module has mounted, `room-creator.html`'s head script is the player: the house's poster, its
name once `index.json` is in, a loader that says so when a slow connection makes it take a while, and a card with
**Try again** and **See all homes** when the page cannot start (no WebGL 2, a module that did not download, an
engine that threw). An id the index does not list gets the error card at once, with nothing built behind it. The
player asks no third party for anything: its fonts, including the ones the scene draws text in, are the repo's
own (`portal/viewer.css`); only the editor links Google Fonts.

The share button hands out `homes/<id>.html`: `portal:build` writes one page per home with the home's own title,
description and preview image as link-preview tags (an unfurler never runs the player), and it forwards to the
player with the link's query. Preview images are JPEG at 1200 × 630 (`portal/previews/<id>.jpg`, and
`portal/hero.jpg` for the gallery and the player): LinkedIn and some other unfurlers read no WebP. A checkout served as it is has no such pages, and shares the player's own URL. The gallery
carries preview tags too, and in `dist/` `room-creator.html`'s static title and description (the editor's, in the
source) are replaced by the site's, so a player URL copied from the address bar never unfurls as the editor.
Preview images must be absolute: `portal:build` takes the site's address from `--site-url`, else `$SITE_URL`, else
the live site, `https://homes.ci.computer/`.

Every URL in the site is relative, because Pages serves it at `/ci-virtual-home/`. `portal:build` copies only
what the site loads into `dist/` (and refuses stale compiled assets, a missing spec or thumbnail, a link to a file it
does not ship, a root-relative URL, and hero figures in `index.html` that disagree with `index.json`); CI runs it on
every PR, and [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys it on every push to `main` (and
on demand); Pages has to be enabled for the repository with **GitHub Actions** as the
source. Nothing renders in CI: when a house's look changes, re-run `pnpm run portal:thumbs --house <id>` on a
GPU and commit the new thumbnail and preview with the change. `portal:test` is the check to run before pushing portal work.

The Pages site is public to anyone with its address, and it serves what a browser needs to draw the homes: the
compiled engine (`assets/**/*.js`), three.js, the fonts and the 30 specs.

## How verification works

`pnpm run check` runs these checks, the first five each depending on the one before:

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
   and frame hashes, and the seams' own tests, each a second or two and in `--quick`: `test-spec-types.mts` (every
   spec against `HouseSpec`), `test-spec-merge.mts` (the fragment merge rule), `test-validate-plugins.mts` (a
   plugin's `extend` and `replaces`), `test-builder-seams.mts` (what the catalog and the validator read off the
   builders) and `test-visibility.mts` (the wall roles, the shot's clock and its `shotHidden` / `shotPose` hooks).
7. **perf** — build ≤ 3 s, `__houseShotTrack` ≤ 1 s and shot QA ≤ 0.5 s a shot on aurora, mirage and vanilla:
   report-only, it never fails the gate.

Baselines belong to a renderer profile (GPU + Chromium build), which is why `playwright` is pinned exactly.
They are re-blessed **only on purpose** — `pnpm run goldens:update` after a change meant to alter the look,
reviewed frame by frame, committed with that change. Failing runs leave `*.actual/expected/diff.png` in
`test/diff/`.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs what needs no GPU: install, build, typecheck,
spec validation and the floor-plan-graph tests. 150 frames through a software rasteriser would cost the better
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
