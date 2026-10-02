# Integration notes: feat/xr with feat/realism and feat/story-site

`feat/xr` is the platform layer: a `PlatformProfile` (mobile, desktop, XR capability and tier), WebXR in the live player, in-world UI
and locomotion. It was assembled from six packages on `origin/main` at 03edd3b. Everything below was found by trial merges of
`feat/realism` (5f638c7) and `feat/story-site` (12d91d7) into `feat/xr`, each on its own from a clean tree, `--no-commit`, in a
scratch worktree that was then removed. The conflicts listed are what git reports; nothing was resolved on those branches.
Neither branch was edited. A trial merge is not a build: after the real merge run the whole list in *Merge checklist* at the end.

## What feat/xr touches that the other two also touch

Textual conflicts, with what to keep. All are small; none is a semantic fight.

| File | With | Hunk | Resolution |
|---|---|---|---|
| `assets/viewer.ts` | realism | imports | keep both: `import { mountPlatform } from './viewer-tier.js'` and `import { createRealism } from './realism.js'` |
| `assets/viewer.ts` | realism | next to the ADAPT variables | keep both: `stats.setPixelRatio = setPixelRatio;` (platform) and realism's `let holdoff`, `let tierUp` |
| `assets/viewer.ts` | realism | `beforeExternalRender` / `afterExternalRender` | combine: `beforeExternalRender() { window.__houseViewer?.xr?.end('offline-hook'); realism.restore(); glass.restore(); }` and `afterExternalRender() { if (!hq) { realism.reapply(); glass.apply(); } }`. The XR end must come first: the session restores the camera, renderer and scene before anything else touches them |
| `assets/viewer.ts` | story-site | `const stats` | take story's `Record<string, any>`; `stats.setPixelRatio` (platform) type-checks against it |
| `assets/house-builder.ts` | realism | header comment | keep both paragraphs (the `test:builder-seams` check reads the header and wants every new module named: it fails if either is dropped) |
| `.gitignore` | realism | tail | keep both (`test/platform/`, `test/xr/` and realism's `.cache/prep-tools/`) |
| `README.md` | realism | tail of the player sections | keep both; the XR sections (*Platforms*, *Platform tiers*, *WebXR*, *Testing XR*) sit after *Player performance* |
| `package.json` | story-site | scripts | keep both (`platform:test`, `xr:test`, `xr:census` and story's `portal:og`, `test:voiceover`) |
| `portal/gallery.js` | story-site | the warm-up click handler | keep story's wider selector (`.card, #hero-media, #hero-play`) **and** the Save-Data guard (`navigator.connection`: do not warm the player on a slow or data-saving link). It is an inline check on purpose: the gallery must not import `platform.js` |
| `CLAUDE.md`, `THIRD_PARTY.md` | story-site | appended rules and rows | keep both |

`room-creator.html` does not conflict with either branch (two small hunks of ours: the `animate()` guard
`if (!renderer.xr.isPresenting) viewer.frame(delta)`, and the platform's viewport meta and `syncViewportSize`).

## N1. The two tier systems (realism and platform) must agree

`assets/viewer-quality.ts` (realism) has its own device probe (`probeDevice`) and a 0 to 2 ladder. `assets/platform.ts` has the
capability probe and `PAGE_TIERS[...].realism = { start, ceiling }`. The values in `platform-types.ts` are advisory ("viewer-quality
stays the authority until the merge step"). At the merge:

- `probeDevice` should read `getPlatform().signals` (coarse pointer, cores, memory, Save-Data, effective type, renderer string, max
  texture) instead of re-reading the same browser APIs. Both probes already agree on the hard cases (coarse pointer, Save-Data, a
  non-4g link, a mobile or software GPU stay at tier 0).
- `Probe.ceiling` is `min(its own ceiling, getPlatform().budget.realism.ceiling)` and `Probe.tier` is `min(its own start, budget.realism.start)`.
  `desktop-high` is 1 and 2, `desktop-mid` 0 and 1, both mobile tiers 0 and 0. `?q=0|1|2` (realism) still wins for realism; `?tier=`
  (platform) forces the page tier. They are different knobs, and the README *?no= switches* table documents both.
- ADAPT is edited by realism (a shed of the realism tier before the pixel ratio) and read by the platform block (it sets the START ratio
  before ADAPT reads it and runs `tick(delta)` as the first line of `frame()`, where promotion, eco and the lost-context skip live). The
  platform block is placed before the ADAPT comment block and does not edit ADAPT's body, so the realism edit and ours do not overlap.
  `tick()` can return a negative number (a skipped frame between two eco frames, or a lost context); `frame()`'s first line must stay first.
- `eco` (a 30 fps cap) interacts with realism's `holdoff` (one second after a tier move, new programs compile): eco only starts once ADAPT
  has settled at pixel ratio 1, so it should not fire during a holdoff; check on a throttled phone profile (`--throttle 4` in
  `perf:player`) that the two do not fight.

## N2. XR pins realism to its cheapest tier (the contract hook exists, realism does not implement it yet)

`assets/xr/session.ts` declares the host seam `host.realism?: { pin(tier | null): void; reapply?(): void }`. It calls `pin(0)` before the
bake and `pin(null)` then `reapply()` after the restore. Nothing implements it today and `feat/realism`'s registry has no `pin`. The merge
step adds the object to the `xrHost` literal in `viewer.ts`, built on what realism already has:

```ts
realism: { pin: (t) => { if (t === 0) realism.restore(); }, reapply: () => realism.reapply() },
```

Why `restore()` is enough: `viewer.frame()` is not called while presenting (room-creator.html's `animate()` guard), so realism's
`tick`, `idle`, `render`, `shed` and `promote` never run in a session. What matters is that its **objects** are out of the scene before
the bake merges the house: the sky dome, the water and ocean meshes, the grass and foliage instances, the glass look, the AO and contact
passes. `restore()` is the same thing `__houseRenderBegin` already asks of it. Check after the merge:

1. `xr:test` T-X6a (the next mono frame after a session is identical in calls, triangles and pixels) with realism installed at tier 2
   (`?q=2`). `snapshotFn()` in `scripts/xr-harness/lib.mts` does not know realism's state: add its `report.installed` list to the snapshot.
2. `pnpm run xr:census` with `?q=2`: the per-eye call and triangle counts must equal the tier-0 numbers (the bake already hides
   instanced scatter on the standalone tiers: `assets/xr/bake-merge.ts`, "anything a realism layer adds").
3. The grass and foliage **site bake** (realism's `viewer-bake.ts`, `withUnbatched`) and the XR bake both merge meshes. They must not run
   at the same time: realism restores first (`pin(0)`), the XR bake merges what is left, the XR restore runs, then `reapply()`.
   Realism's own batch undo (`withUnbatched`) has to find the player's static batch (`viewer-batch.ts`) as it was: the XR bake leaves it alone
   by design (it works on a copy of the visible set and hides originals, then unhides).
4. The Core stays stylised in a headset. Realism's PBR textures and prop upgrades are tier 1 and 2 only, and XR is tier 0.

`window.__houseViewer.xr.tier` and `getPlatform().xr.session` say which XR tier is live; realism can show them in its report.

## N3. The story tour renders its popups and captions in a headset through the Presenter

`assets/xr/presenter.ts` is the contract (types, constants, three pure helpers; its header names `assets/story/presenter.ts` as the
file it is meant to become). `assets/xr/ui/tour-presenter.ts` implements it with in-world panels; `reference/XR-UI.md` has the
numbers. `feat/story-site` **does not have a Presenter abstraction yet**: its Director (`assets/story/director.ts`) calls the DOM surfaces
(`popup.ts`: `BeatCard`, `StartCard`, `EndCard`) directly. So the work at the merge step is on the story side, and it is the larger part:

1. **Move the contract.** `git mv assets/xr/presenter.ts assets/story/presenter.ts`; re-point `./types.js` in it to `./types.js` of the story
   (it imports `ChapterKind`, `ClipId`, `Colour`, `MemberRole`, `PhoneScreen`, `Runtime`, `VoiceKey`, `WordTiming`, which the story's
   `types.ts` defines, and `assets/xr/types.ts` copies); then delete `assets/xr/types.ts`'s copies and re-point the imports in
   `assets/xr/ui/*` (`../presenter.js` becomes `../../story/presenter.js`; the UI imports it **as types only**, so no story code is
   loaded in a headset until the Director asks for it). `assets/xr/host.ts` has `presenter(): import('./presenter.js').Presenter | null`.
2. **A `dom` presenter.** Wrap `popup.ts` in the same interface (`kind: 'dom'`, `moves: 'track'`, `timeline: 'continuous'`). The
   Director calls `presenter.enterBeat(view, ctx)` / `exitBeat` / `showEnd`; a `BeatView` is derived from `RuntimeBeat` (the Director's job:
   `assets/xr/presenter.ts` section 2 names every field and where it comes from). The DOM presenter keeps the camera on the baked track
   (`trackFrameAt(t)`); the XR presenter moves the person (`moves: 'presenter'`), so in a session the Director must not apply the track's
   camera (it still applies `host.ambient(t)`: Core power, doors) and starts each beat's clock when `enterBeat()` resolves.
3. **Swap on `vh:xr`.** `window` fires `vh:xr` with `detail.state` `started` or `ended`. On `started`, the Director calls
   `window.__houseViewer.xr.ui().presenter(host)` and swaps it in; on `ended`, back to DOM (the XR presenter has been disposed by the UI's
   unmount). Drive its clock from `xr.onFrame(cb)` and call `presenter.tick(clock)` every XR frame; **never** `window.requestAnimationFrame`
   (it does not run in a headset). Audio: `presenter.audio.routeFor(clip, beat)` returns `{ kind: 'head' }` for the narrator and a world
   position at the Core for a companion.
4. **The film is the story's.** Nothing in `assets/xr/` edits the film overlay. `paintCard(ctx, cardView, metrics)` in
   `assets/xr/ui/paint.ts` is THREE-free and the film overlay may adopt it; it would need the same re-pointed types.
5. **"Watch in VR"** on a family page or the landing page: show it iff `getPlatform().xr.vr` (set by `probeXr()`, which `viewer-tier.ts` starts
   at mount unless `?no=xr`). The landing page and the family pages are **not** allowed to import `platform.js` (T-LAZY fails on it: the
   landing weight stays unchanged); put the link behind the player: `room-creator.html?mode=view&family=<slug>&xr=vr`. The `xr=vr`
   query is read by the Enter VR controls (`host.params.get('xr') === 'vr'` in `assets/xr/entry.ts`) and shows the button first. A browser
   cannot start a session without a tap, so `xr=vr` makes the button the first thing on the page, not an auto-start.
6. **Story and the bake.** The tour's `BeatView.stand` (story-bake's per-beat standing pose, `verified.walkable`) is used as given; without it the
   presenter derives a stand from the world probe (`exact`, `derived`, `held`, `cut`). Story's camera `anchors` (`shotWorld`) are the same ones
   the XR nav reads: if story-bake changes the digest, `scripts/test-xr-nav.mts` (30 homes, Node) fails first.
7. **Fictional line.** A presenter shows `Disclosure.fictional` at all times; the XR card prints it as the footer of every card
   (`T-X3` checks the text is the beat's own).

## N4. Things that are wired and tested on `feat/xr` (do not re-do)

- The XR entry and the platform are **lazy**: `viewer.ts` imports `assets/xr/entry.js` only where `immersive-vr` is supported in a secure
  context, and `entry.js` imports `session.js` only after the tap. `T-LAZY` (2 KB gzip for the Enter VR button's two files, only in a browser
  with VR) and `T-OFFLINE` (editor loads no XR or platform code, frame 0 byte-identical to 03edd3b) fail on a regression.
  A browser with no VR pays about 1.2 KB gzip (the viewer hook and the import-map lines for `assets/xr/*`, which grow with the number of
  XR modules: 691 B at 156 modules); `10-session` reports it.
- `viewer.beforeExternalRender()` ends a session first, so a film, a still or a golden never runs with XR state on the renderer.
- The UI's snap angle and vignette settings drive the comfort module (`ui/index.ts`, `syncLoco`), and the UI hub stands down its own controller
  and ray drawing when the locomotion module draws them (`pointer.ts`); both are asserted in `T-X10`.
- `?no=xr` removes WebXR (no request under `assets/xr/`, no button, no API); `?no=platform` restores the pre-tier behaviour.

## N5. Open items (not done; not claimed)

- No headset has run any of this. Frame time at 72 / 90 / 120 Hz, legibility, comfort, thermals, controller and hand feel, foveation and the
  framebuffer scale, the projection-layer path, and `immersive-ar` are hypotheses until `reference/XR-DEVICE-CHECKLIST.md` is run.
- `immersive-ar` (Android Chrome, DOM overlay) is deferred. USDZ / Quick Look for iPhone Safari (no WebXR) is neither built nor assessed.
- WebKit: the installed Playwright WebKit does not match the pinned Playwright, and no browser was downloaded. `portal:test`'s WebKit
  pass is skipped on this machine; the simulators were used for what the checklist records as "what the simulators showed".
- `scripts/xr-tests/10-session.mts`, `20-bake.mts` and `40-loco.mts` are standalone scripts (they run their own browser): `xr:test` spawns them
  only for `--only 10|20|40`. Converting them to harness cases would let `xr:test --device all` cover them in one command.
- `?no=lightguard` and the others in the *?no=* table are read in several places; a single parsed set would be cleaner (`viewer.ts` has `no`,
  the platform and `viewer-batch.ts` parse the query themselves).

## Merge checklist (after both merges, one browser at a time)

```bash
pnpm install --frozen-lockfile && pnpm run build && pnpm run typecheck && pnpm run validate
pnpm run test && pnpm run test:node        # test:node is the Node unit scripts (xr-nav, presenter, platform, story, realism)
node --experimental-strip-types scripts/check-house.mts --quick --jobs 1
pnpm run portal:build && pnpm run portal:test && pnpm run platform:test && pnpm run ui:test
pnpm run xr:test -- --device all --require-session
for n in 10 20 40; do pnpm run xr:test -- --only $n; done
pnpm run check                              # the goldens: 150 / 150, six ledgers unchanged, never re-bless
```
