# XR device checklist: Meta Quest, Apple Vision Pro, PC VR

For the owner. No headset was available to the agents that built the XR layer. It was verified by **emulation** (Meta's IWER 2.5.0 driving Chromium, `pnpm run xr:test`) and, for WebKit, by the visionOS 27 and iOS 27 **simulators** that were installed on the build Mac. This file says what that did and did not prove (section 1), how to set up (section 2), and gives the steps to run on hardware: 16 Quest rows (section 3), 10 Vision Pro rows (section 4) and ten calibration steps that settle the numbers in the tier table (section 5). Each row: do this, expect that, record this.

Rows that mention the guided tour (Q5, Q10, Q11, Q15, V6, V7) apply once the story tour is merged into the build you are testing. Rows that mention a "legibility chart" or "stats panel" apply to the XR UI kit's debug panels; if a build has neither, record the smallest text you can read by eye and skip the number.

Run first, on the desk, before putting a headset on: `pnpm run build && pnpm run portal:build && pnpm run xr:test -- --device all`. If that is red, the hardware run will only show you the same thing more slowly.

## 1. What emulation proves, and what it cannot

### Proved by `pnpm run xr:test` (IWER in Chromium, real WebGL and real three.js r169, emulated `navigator.xr`)

- IWER installs before the page's scripts; the player enters and ends an `immersive-vr` session under three profiles: Quest 3, Quest 2 and a patched Vision profile (no controllers; hand input sources that are `transient-pointer`, which exist only while a pinch lasts). `isSessionSupported('immersive-vr')` is true under emulation and false in plain headless Chromium, so the capability probe is testable both ways.
- Stereo, with `stereoEnabled` on: two eye cameras, viewports that are the two halves of the framebuffer, eyes 0.063 m apart, a different picture in each half. A stereo frame costs exactly twice the draw calls and triangles of a mono one (r169 has no multiview).
- **State restore** (T-X6a): after a session ends, the next mono frame has the same draw calls, triangles and pixel hash, and the camera's fov, near, far, zoom, aspect and projection are back (three's WebXRManager overwrites them and never restores them); a second session leaves nothing more behind than the first; a session the system ended (not the page) is restored the same way (T-FAULT-end).
- **No third party** (T-X7): zero requests outside the origin while the player loads and during a session, none to `cdn.jsdelivr.net` (where three's `XRControllerModelFactory` would fetch controller models).
- **Lazy loading** (T-LAZY): the first player load requests no `assets/xr/session*.js`; with `?no=xr` nothing under `assets/xr/`, no API, no button; after the Enter VR tap only XR modules load; the first-load weight XR adds is under 2 KB gzip (the Enter VR button's two files, fetched only where VR exists); the gallery page loads no XR code and no `platform.js`.
- **Offline untouched** (T-OFFLINE): the editor page loads no XR or platform code; frame 0 of a fresh editor page is byte-identical to the reference commit's on this machine; the player has no offline render hook.
- **Faults** (T-FAULT): an exception in an XR event handler is a page error and fails the test; a controller or hand lost mid-press, a `hidden` visibility state and a system-ended session leave a session that keeps running (or ends cleanly) with no page error.
- **Comfort invariant** (harness self-test, and against the product's fade when it names its quad `xr: fade` or `xr-fade`, or exposes `xr.rig().fade`): the viewpoint changes only on frames that are fully black; a smooth move is flagged by the same check.
- **Input model**: a Canvas2D panel button under a controller ray hovers and presses; on the Vision profile the same ray is on the button during a pinch and **nothing hovers**; a miss presses nothing.

### What emulation cannot prove (do not claim any of these from a green `xr:test`)

1. **Frame time.** Real stereo frame times, the CPU/GPU split, dropped frames, the 72/90/120 Hz cadence. The emulator runs on a desktop GPU and the page's own loop, so call and triangle counts are real and milliseconds are not. Every figure in the tier table (calls, triangles, programs, texture MB, framebuffer scale, foveation) is a hypothesis until section 5 settles it.
2. **Legibility.** Text sharpness and size at real pixels per degree. The emulated eye buffer is the page viewport halved (about 6 pixels per degree at 1280 x 720); a Quest 3 is about 25.
3. **Comfort.** Nausea, the feel of a blink teleport, snap turn, the fade timing, seated versus standing height. The harness proves the rule (move only when black), not that it feels right.
4. **Thermals, battery, memory pressure** in the headset browser process, and whether a 15-minute session throttles.
5. **Input feel and reliability.** Ray accuracy, pinch miss rate, controller haptics, real tracking loss and recovery, `selectend` on source removal as each browser really behaves, hand versus controller switching. IWER also fires `select` before `selectstart`, and gives a lost-mid-press controller no `selectend` until the later release.
6. **The layers path.** IWER provides no `XRWebGLBinding`, so the `XRProjectionLayer` path that Quest Browser and Chrome 147+ PC VR take (three r169 uses it whenever `renderState.layers` exists) is never exercised; only the `XRWebGLLayer` path is. visionOS Safari also lacks `XRWebGLBinding`, so on Vision Pro the emulation is closer to the truth than on Quest.
7. **Foveation, MSAA resolve, framebuffer scale and refresh-rate switching** (`updateTargetFrameRate`, `supportedFrameRates`): IWER reports the numbers but nothing renders at them.
8. **Passthrough and AR.** IWER has no `dom-overlay` (the feature is dropped silently), so Android `immersive-ar` and its DOM UI cannot be tested.
9. **Real browser behaviour**: permission prompts, the system menu and Digital Crown, a page's `requestAnimationFrame` pausing while presenting (the harness imitates it only in the in-page bed), IWER keeps delivering frames while `hidden` where real browsers stop, Quest Browser and Safari version quirks, autoplay and audio unlock inside a session, spatial audio.
10. **iPhone Safari.** No WebXR there (the 2D fallback is a platform-profile concern); Playwright's installed WebKit does not match the pinned Playwright, so no WebKit run exists. Only the iOS and visionOS simulators were probed (table below).

### What the simulators showed (visionOS 27 and iOS 27 Safari, measured on the simulators, not hardware)

| | visionOS 27 Safari (Vision Pro simulator) | iOS 27 Safari (iPhone 17 simulator) |
|---|---|---|
| `navigator.xr` | present | **absent**; no `XRSession`, no `XRWebGLLayer`, no `XRHand` |
| `isSessionSupported('immersive-vr')` / `'immersive-ar'` / `'inline'` | **true / false / true** | n.a. |
| `XRHand`, `XRWebGLLayer` | present | absent |
| `XRWebGLBinding` | **absent** (no layers API) | absent |
| WebGL | WebGL 2, "Apple GPU", `OVR_multiview2` absent, max texture 8192 | WebGL 2, same |
| `gl.makeXRCompatible` | function | **absent** (guard before calling) |
| pointer media | coarse, no hover | coarse, no hover |
| Fullscreen API | present | **absent** on iPhone |
| `localhost` over http | secure context, WebXR available | secure context |

On visionOS the tracked hand sources can sit at three.js controller indices 0 and 1 and the `transient-pointer` ones at 2 and 3 when hand tracking is granted: never rely on `getController(i)`; read `event.inputSource`.

### Tooling decision (why IWER)

IWER 2.5.0 (npm `iwer`, MIT, Meta; its dependencies `gl-matrix` MIT and `webxr-layers-polyfill` Apache-2.0) is a **pinned test-only devDependency**; `scripts/xr-harness/` hands its `iwer.min.js` to Chromium. It has no three dependency, so r169 is fine. `@iwer/devui` (a human aid for headed manual sessions) and `@iwer/sem` (synthetic planes for AR) are not installed: they pull React 19 and a newer three. Mozilla's WebXR API Emulator extension (MPL-2.0, archived 2024) was not used. Meta's Immersive Web Emulator browser extension is built on IWER and is handy at a desk, but Playwright cannot drive it headless, which is why the harness injects IWER itself.

## 2. Setup

- **Quest 3 / 3S / 2 / Pro, Meta Quest Browser.** HTTPS is required, or `localhost`. A production or preview deploy (HTTPS) is simplest: `https://homes.ci.computer/` or `https://pr-<n>.ci-virtual-home.pages.dev/`; use the player URL that carries the Enter VR button (`?no=xr` must hide it). Dev loop: `pnpm run portal:preview`, then on the host `adb reverse tcp:8080 tcp:8080` and open `http://localhost:8080/` in the headset (localhost is a secure context). Remote console and performance: desktop Chrome, `chrome://inspect`, headset on USB. Capture: the headset's recorder, plus **OVR Metrics Tool** for frame time, GPU and CPU level, temperature.
- **Vision Pro, Safari.** On visionOS 27 (simulator) WebXR was available with no flag. On earlier releases check Settings, Apps, Safari, Advanced, Feature Flags for the WebXR Device API (path unverified). Needs HTTPS to a non-localhost host (a preview deploy or a tunnel). Web Inspector from a Mac: Safari, Develop, the Vision Pro.
- **PC VR** (Chrome or Edge on Windows with SteamVR, or Quest Link): the Quest controller rows, from a desktop browser. Chrome 147+ takes the layers path.
- **A simulator run without hardware**: `xcrun simctl boot <visionOS device UDID>`, serve any HTTPS-or-localhost page from the Mac, `xcrun simctl openurl <UDID> http://localhost:8765/` (the simulator shares the host's loopback).
- **Test on** one light house, one median, and the heaviest (`cocoon` in the performance work), after the XR tier and the tour are merged. Record the build commit and the URL with its query.
- **Force a tier** to compare: `?xrtier=standalone-gen1|standalone-gen2|tethered|vision`; the 2D page tier with `?tier=desktop-high|desktop-mid|mobile-high|mobile-low`; `?no=xr` removes XR; `?no=platform` is the pre-platform behaviour.

Record in every row: device, OS and browser build, URL with query, house or family, `session.frameRate`, `session.renderState.baseLayer.framebufferWidth x Height` (and the scale in use), result, photo or video, anything odd.

## 3. Meta Quest (controllers, then hands)

| # | Do | Expect | Record |
|---|---|---|---|
| Q1 | Open the page in the headset browser. Console: `await navigator.xr.isSessionSupported('immersive-vr')` | `true`. The Enter VR button is visible; with `?no=xr` it is not | browser version, features `requestSession` grants (`session.enabledFeatures`) |
| Q2 | Point and trigger Enter VR. Time it | session starts within 3 s on a cached page; no black flash over 1 s; the page's 2D chrome is gone; controller rays appear | time to first XR frame, `frameRate`, framebuffer size |
| Q3 | In each of the 3 houses, stand at 3 spots (outside, living room, the heaviest room) for 30 s each | frame time steady at the session rate (72, 90 or 120 Hz), at least 99 % of frames on time | avg and p95 frame ms, dropped frames, GPU and CPU level from OVR Metrics, draw calls and triangles from the stats panel |
| Q4 | Run 15 minutes, 24 beats, looping | no thermal throttle warning, temperature plateaus, GPU memory flat, `renderer.info.memory` flat after beat 3 | temperatures, memory at 0, 5, 15 min |
| Q5 | Press Next 10 times, then Previous 5; then let the tour auto-advance through 5 beats ("guided") | each move is a short blink; you arrive facing the subject; no swimming, no double image, no nausea; the countdown ring appears 1.5 s before an automatic blink and Pause stops it | comfort score 0 to 10 per session (SSQ if you use it), blink duration felt, any disorientation, seated and standing |
| Q6 | Read one 30-word card at the planned distance (1.7 m), the caption bar, a chip, a footer. Use the legibility chart (pangram at 0.8, 1.0, 1.1, 1.4, 2.0 degrees at 1.7 m) | body at 1.4 degrees is easy; 1.1 is readable; 0.8 is not required | smallest em you read without effort (sets `XR_LEGIBILITY.minEmDeg`), sharpness, contrast on the bright sky houses |
| Q7 | Controllers: hover a button (blue), pull trigger (orange, buzz), miss, A next, B play/pause, X previous, Y chapters, stick left and right snap 30 degrees, stick forward teleport | each does exactly that; nothing else moves you; haptics felt on hover and press | any wrong mapping; ray accuracy at 3.5 degree targets (30 presses on Next: misses) |
| Q8 | Left-handed: set handedness left | the menu moves to the left hand, everything works with one controller | |
| Q9 | Put the controllers down: hand tracking. Pinch Next; open the palm-up menu | ray from the hand, pinch selects, menu opens and closes; switching hands and controllers mid-session leaves no stuck state | pinch miss rate, any lost-tracking flicker |
| Q10 | Audio: start with "Start with narration" **before** entering; enter; then a second run "without sound" | narration plays after entering (the context was unlocked by the DOM click); the companion's line comes from the Core's direction and moves when you turn; the silent run creates no audio | whether audio played with no extra tap; direction judgement; any clipping |
| Q11 | Press the Meta button (system menu), then take the headset off, then put it on | the tour pauses on blur and on removal, resumes on return; audio paused; a press in flight is cancelled | which events fired (log `visibilitychange`), any stuck button |
| Q12 | Cover the controllers' tracking, hold trigger over Next, release out of view | no accidental Next; no stuck pressed state | |
| Q13 | Exit with the menu's Exit, and again with the system exit | the page returns to the 2D player at the same beat, paused; canvas size and pixel ratio restored; the 2D scrubber works; no console errors | screenshot of the restored page |
| Q14 | Enter and exit 5 times in a row | no leak (memory flat), no black canvas, no duplicate loops | |
| Q15 | Open the end card, press "See Companion Core" | the session ends and the page shows the link; no popup blocked | |
| Q16 | Console review during all of the above | no errors; no "Can't change size while VR device is presenting" warning; no request to another origin | the console log |

## 4. Apple Vision Pro (Safari, gaze and pinch)

| # | Do | Expect | Record |
|---|---|---|---|
| V1 | Open the page in Safari. Console: `'xr' in navigator`, `await navigator.xr.isSessionSupported('immersive-vr')`, `typeof XRHand` | `true`, `true`; (hand tracking is not requested in v1) | visionOS and Safari versions, any feature flag needed |
| V2 | Look at Enter VR and pinch | a system permission prompt (record its wording), then the immersive view; the page's 2D chrome is gone | prompt text, time to first frame, `frameRate` |
| V3 | Gaze at a button and pinch (Next, Back, Pause, Chapters) | no hover highlight exists before the pinch; press feedback appears at pinch start; the action commits on release; moving the hand off the target while pinching cancels | miss rate over 30 presses on Next at 5 degree targets (expect at least 95 % hit) |
| V4 | Read the 30-word card at 1.7 m, the caption bar, a chip | body at 1.4 degrees comfortable | smallest em you read without effort; any shimmer in the text during head motion |
| V5 | Run Q3 and Q4 equivalents with Web Inspector (Mac, Develop) | steady 90 Hz, no hitching at blinks | frame ms, any stalls at texture uploads |
| V6 | Audio as Q10 | narration plays after entering; the companion line is spatial | |
| V7 | Press the Digital Crown / use the system exit during the tour; and the end card's CTA | the session ends cleanly; the page shows the 2D player at the same beat; the CTA link is shown on the page | what the crown does mid-session, any stuck state |
| V8 | Stand and then sit for a run | the posture setting lowers panels and head height; cards stay in the comfortable zone seated | |
| V9 | Note foveation, framebuffer size and `XRWebGLBinding` (`typeof` is `undefined` in the simulator) | three falls back to `XRWebGLLayer` without errors | |
| V10 | Console review | as Q16 | the console log |

## 5. Calibration: ten steps that settle the tier table

The XR tier table (`XR_TIERS` in `assets/platform-types.ts`, described in the README's "Platform tiers") is a set of **hypotheses** derived from desktop measurements and assumed CPU factors (Quest 3 about 4x and Quest 2 about 6.5x a desktop for JS draw submission). Until a headset run, the numbers are thresholds the XR module **enforces**, not things anyone measured on a headset. Do these in order on a Quest 3 first, then a Quest 2, then a Vision Pro; change the table only with the numbers in hand and re-run `pnpm run xr:test` afterwards.

| # | Question | Do | Decide |
|---|---|---|---|
| C1 | Is the tier detected right? | Enter with no override. Console: `__houseViewer.xr.tier`, `session.enabledFeatures`, `session.inputSources[0].profiles`, `session.supportedFrameRates`, `session.fixedFoveation`. Then enter again with each `?xrtier=` | whether Quest 3 lands on standalone gen2 and Quest 2 on gen1 without help; whether the "promotion to gen2 on `inputsourceschange` or 90 held frames" fires; fix `selection` evidence if not |
| C2 | Is the Quest 3 call budget (300 at 72 Hz) right? | Q3 spots in a light, a median and the heaviest house; read `renderer.info.render.calls` (stereo, both eyes) and the CPU frame time from OVR Metrics | the real microseconds per call; recompute the CPU factor (assumed 4) and the 300 / 250 / 150 row |
| C3 | Is the Quest 2 budget (190 at 72 Hz) right? | the same on a Quest 2 | the factor (assumed 6.5); which houses get "this home is too detailed for this headset" (15 of 30 on the average heading predicted) |
| C4 | Can Quest 3 hold 90 Hz with 30 percent headroom? | start at 72, let the module try 90 on a median house | whether the 72 to 90 promotion rule is right or should be off |
| C5 | What framebuffer scale? | 0.7, 0.85, 1.0 on the same spot; read the Q6 chart | the scale that keeps body text at 1.1 degrees readable inside the GPU budget (start 0.85 gen2, 0.8 gen1, assumed) |
| C6 | What fixed foveation? | 0.33, 0.66, 1.0 (gen1: 0.5, 0.8, 1.0) with panels at the edge of the view | the highest value with no visible smear on panel edges and the card text |
| C7 | Do the bake's lights and shadow look right? | Compare the headset view of three houses with the 2D player; teleport across a room; open a door | the light count (4 gen2 / 3 gen1 / 6 vision), the static sun map size, whether the one-frame shadow refresh after a teleport shows |
| C8 | Is the LOD radius right? | Blink to a spot with a long sight line; watch for pop-in at the radius (22 m gen2 / 16 m gen1) | the radius and the 512 px texture cap |
| C9 | Does Vision Pro hold 90 Hz at 800 calls and 2 M triangles? | V5 on the heaviest house; Web Inspector timeline | the vision row (800 calls, 2 M triangles, 128 MB textures) |
| C10 | Does a 15-minute soak throttle? | Q4 on the heaviest house at the chosen settings, all three headsets | the final per-device tier table; re-run `pnpm run xr:census` (the bake's census of the 30 houses) with the new budgets to regenerate the "houses that fit" list; write the measured values into the README and mark them measured |

## 6. What to send back

For each device one row per check above in a table, the build commit, the URL, the recorded numbers (frame ms, memory, temperature), screenshots or recordings of Q6/V4 (text), and the three decisions that need a human number: the smallest comfortable em (`minEmDeg`), the best card distance (1.7 m default), and whether `guided` auto-advance felt right. Anything marked unverified in the README's "WebXR" section or in the UI kit's notes that the hardware contradicts overrides the document.
