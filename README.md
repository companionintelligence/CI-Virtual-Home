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
`t=<0…1>` (the moment in the shot), `lighting=day|golden|dusk|night`, `mode=review|edit`, `flythrough=1`, `res`, `aspect`, `planner=v2` (the spline planner v2 for every door-to-core, hero-reveal and walkthrough; v1 otherwise); the
editor writes the first five as you change them, so a URL is a view (see [The editor](#the-editor)). Its "All homes" link opens
the portal's gallery, `./index.html`; `mode=view` turns the page into the portal's player (see [The web portal](#the-web-portal)).

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
| `pnpm run portal:thumbs` | Render the gallery's thumbnails → `portal/thumbs/<id>.webp` and `portal/hero.webp`, and the link-preview JPEGs → `portal/previews/<id>.jpg` and `portal/hero.jpg` (`--house`, `--hero`, `--hero-tod`, `--max-kb`). Needs a GPU; commit the output. |
| `pnpm run portal:build` | Assemble the site in `dist/` — only what it loads — and check its links. Needs `build`. |
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

Every URL in the site is relative, so the same tree works at the root of any host (the live site, a preview's
`pages.dev` address) and under a sub-path; `portal:preview` and `portal:test` serve it at `/ci-virtual-home/` to
prove it. `portal:build` copies only what the site loads into `dist/` (and refuses stale compiled assets, a missing
spec or thumbnail, a link to a file it does not ship, a root-relative URL, and hero figures in `index.html` that
disagree with `index.json`); CI runs it on every PR. Nothing renders in CI: when a house's look changes, re-run
`pnpm run portal:thumbs --house <id>` on a GPU and commit the new thumbnail and preview with the change.
`portal:test` is the check to run before pushing portal work.

The site is public to anyone with its address, and it serves what a browser needs to draw the homes: the
compiled engine (`assets/**/*.js`), three.js, the fonts and the 30 specs.

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
