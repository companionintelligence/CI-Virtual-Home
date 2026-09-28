# ci-virtual-home

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
| **Web portal** — a gallery of the homes and a live player to fly their camera paths, for GitHub Pages | [`index.html`](index.html), `room-creator.html?mode=view` ([`assets/viewer.ts`](assets/viewer.ts)), `scripts/build-portal.mts` | `dist/` → <https://companionintelligence.github.io/ci-virtual-home/> |

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
`flythrough=1`, `lighting=day|golden|dusk|night`, `res`, `aspect`. Its "Hub" link opens the portal's gallery,
`./index.html`; `mode=view` turns the page into the portal's player (see [The web portal](#the-web-portal)).

## Commands

| Command | What it does |
|---|---|
| `pnpm run build` | Type-strips `assets/**/*.ts` to the `.js` the browser loads (esbuild `transform`, not a bundle). Run after any asset edit; `check` runs it first. |
| `pnpm run typecheck` | `tsc` over `scripts/` (Node) and over `assets/` (browser). |
| `pnpm run validate` | All 30 specs against the schema, the prop catalog and the registry. `--shots` adds the headless camera-path QA. |
| `pnpm run test` | `scripts/test-floorplan-graph.mts` under `node --test` — the floor-plan graph, mitres, and the wall compiler over every spec. Needs `build`. |
| `pnpm run check` | **The gate** — all five checks below, in order. `--house a,b`, `--jobs N`, `--res`, `--update-goldens`. |
| `pnpm run check:quick` | assets + specs + shots only: the fast loop while editing. |
| `pnpm run shots` | Render product shots to `video/houses/` (`--house`, `--shot`, `--res 1080`, `--aspect 16:9`, `--poster-only`, `--qa-only`, `--jobs`). |
| `pnpm run goldens` / `goldens:update` | Compare 120 frames with the committed baselines / re-bless them. |
| `pnpm run frame-hash` | Two fresh browser contexts must render the same frames. |
| `pnpm run plans` | Rebuild `content/houses/<id>.plan.json` — the seeded site instances the isometric twin draws. |
| `pnpm run iso` | Rebuild the isometric SVGs, Lotties and `scenes/manifest.json` (`--only <id>`, `--png`). |
| `pnpm run floorplans` | Rebuild the CAD sheets and `floorplans.json` (`--only <id>`, `--no-png`, `--fit lot`). |
| `pnpm run catalog` | Measure every prop type in the browser → `content/house-catalog.json`. |
| `pnpm run index` | Validate every spec and rebuild `content/houses/index.json` (the page's house list). |
| `pnpm run prop-sheet` | Contact sheet of props, measured against their declared sizes (`--types`, `--module`, `--all`). |
| `pnpm run export:core` | The Companion Core as glTF (`--finish`, `--pose`) → `dist/models/`. |
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp` (`--house`, `--hero`, `--hero-tod`, `--max-kb`). Needs a GPU; commit the output. |
| `pnpm run portal:build` | Assemble the Pages site in `dist/` — only what it loads — and check its links. Needs `build`. |
| `pnpm run portal:preview` | `portal:build`, then serve `dist/` at <http://127.0.0.1:8081/ci-virtual-home/> (`--port`). |
| `pnpm run portal:test` | Drive the built site under `/ci-virtual-home/` in Chromium: gallery, player, fly, share, the editor (`--house`, `--shots`). |

Every script resolves the repo from its own location, so they run from any directory. After editing a spec:
`validate` → `plans` → `iso` → `floorplans` → `check`, and commit the regenerated files with the spec.

## Layout

```
room-creator.html          the editor + renderer page; loads assets/*.js and content/houses/*.json.
                           ?mode=view is the portal's player (assets/viewer.ts, portal/viewer.css)
index.html                 the portal's gallery (portal/gallery.css, portal/gallery.js)
portal/                    the portal's styles and script, thumbs/<id>.webp and hero.webp (derived, committed)
floorplan-graph-demo.html  the Phase 2 floor-plan graph beside its compiled walls
assets/                    the three.js engine, in TypeScript (house-builder, house-geometry, wall-compiler,
                           floorplan-graph, roofs, fixtures, site, world, materials, textures, environment)
  props/                   the prop registry — one module per category, ~150 props
  vendor/three/            three.js r169 + addons, vendored (one local patch; see THIRD_PARTY.md)
  fonts/                   Manrope + JetBrains Mono woff2 the capture scripts serve instead of Google Fonts
  brand/                   the CI mark the page shows
  viewer.ts                the portal's player: shots, scrubber, time of day, path, fly (room-creator ?mode=view)
content/houses/            <id>.json — the 30 HouseSpecs (source); <id>.plan.json and index.json — derived
content/house-catalog.json every item type's measured footprint, height and iso parts (derived)
scenes/                    isometric SVG + Lottie, CAD floor plans, and their manifests (all derived, committed)
scripts/                   the pipeline: build, validate, render, gate (.mts) and the Python generators (.py)
reference/                 HOUSE-SPEC.md (the schema), PARAMETRIC-INTERIORS-PLAN.md (design + roadmap),
                           HOUSE-SYSTEM-REVIEW-2026-09-15.md (historical review)
test/goldens/macos-metal/  120 committed baseline frames (Git LFS) + PROFILE.json (the renderer that made them)
video/houses/index.html    browser for rendered shots; the renders beside it are gitignored
```

## The web portal

A static site anyone can open: [`index.html`](index.html) lists the homes from `content/houses/index.json` with
the committed thumbnails (no WebGL on the gallery), and a card opens the live player,

```
room-creator.html?mode=view&house=<id>[&shot=<shot>][&t=<0…1>][&tod=day|golden|dusk|night][&play=1|0]
```

— the editor's own renderer with its chrome put away. `t` is the fraction of the shot; a link with `t` opens
paused there, one without plays from the start. The player lists the shots from the house's presets (so
`core-orbit` and any later shot type appear by themselves), plays them through the page's `applySplineFrame`
(its frames are the recorder's frames), and adds a scrubber, speed, time of day, the camera path drawn in the
scene, a free-flying camera (drag, WASD, Q/E, Esc back to the shot; O for an overview and C for a cutaway that
opens the house, with the shot's camera flying on as a ghost), share links, full screen and prev/next. Keys:
Space, ←/→ (Shift: 5 s), Home/End, 1–9, T, P, F, O, C, Esc, [ ], Shift F, ?. Everything under `?mode=view` is additive: without it the page is the editor, and
every `__house*` hook behaves as before.

Every URL in the site is relative, because Pages serves it at `/ci-virtual-home/`. `portal:build` copies only
what the site loads into `dist/`, and [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys it on
every push to `main` (and on demand); Pages has to be enabled for the repository with **GitHub Actions** as the
source. Nothing renders in CI: when a house's look changes, re-run `pnpm run portal:thumbs --house <id>` on a
GPU and commit the new thumbnail with the change. `portal:test` is the check to run before pushing portal work.

The Pages site is public to anyone with its address, and it serves what a browser needs to draw the homes: the
compiled engine (`assets/**/*.js`), three.js, the fonts and the 30 specs.

## How verification works

`pnpm run check` runs five checks, each depending on the one before:

1. **assets** — compile `assets/**/*.ts`.
2. **specs** — validate the 30 HouseSpecs.
3. **shots** — build every house headless and walk the door-to-core, orbit, hero-reveal and core-orbit camera
   paths against its geometry: through a wall, under a floor, in through a window instead of the door, ending
   outside the hero room, Core out of frame — and through an orbit round the Core, every frame keeps it in the
   middle 60 % and in sight. Also a scene check per house (dressing present, nothing buried in a wall, planting
   not on a grid). 120 shots, 30 scenes; errors fail, warnings are reported.
4. **determinism** — render frames 0, 200 and 719 of aurora's door-to-core in two fresh browser contexts and
   compare raw pixels. Frames are random access (`__houseRenderFrames(i)` renders frame *i* from scratch), and
   nothing a frame depends on may use `Math.random` or the clock — every seed comes from mulberry32 / fnv1a in
   `assets/materials.ts`.
5. **goldens** — render 120 frames (per house: the door-to-core and orbit posters and the door-to-core and
   hero-reveal final frames, at 640 × 360 through the full composer) and compare them to `test/goldens/<profile>/` with pixelmatch plus a
   mean-absolute-difference bar, so both "something moved" and "everything shifted a little" fail. Skipped if
   determinism failed, because a baseline compared against a renderer that disagrees with itself is noise.

Baselines belong to a renderer profile (GPU + Chromium build), which is why `playwright` is pinned exactly.
They are re-blessed **only on purpose** — `pnpm run goldens:update` after a change meant to alter the look,
reviewed frame by frame, committed with that change. Failing runs leave `*.actual/expected/diff.png` in
`test/diff/`.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs what needs no GPU: install, build, typecheck,
spec validation and the floor-plan-graph tests. 120 frames through a software rasteriser would cost the better
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
