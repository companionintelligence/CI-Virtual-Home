# The in-world UI kit and the XR presenter

`assets/xr/ui/` is everything a person sees and presses in a headset that is not the house: the Menu, the captions, the tour's card, toasts, the
status card, the ray. A headset has no DOM, so all of it is drawn with Canvas2D onto flat quads. It is loaded by `assets/xr/session.ts` after the
person asks for VR, so a visitor who never does downloads none of it (`demo.ts` loads only when a test asks).

## How it is built

| Part | File | What it does |
|---|---|---|
| sizes, colours, drawing | `paint.ts` | THREE-free. Layouts are lists of drawing ops; `paintCard(ctx, view, metrics)` is the story film overlay's to adopt. `XR_LEGIBILITY`, `XR_COMFORT`, `XR_BUDGET` and `emMetres()` from `presenter.ts` are the only source of sizes |
| a panel | `panel.ts` | One quad, one `CanvasTexture`, mipmaps, anisotropy 8, drawn at `texelsPerDeg = clamp(1.5 x device ppd, 24, 40)`. Redraws only when something changed |
| the ray | `ray.ts` | Hover and press from the XR frame's input sources; haptics; a 1.5 cm hit dot; a ~190 triangle controller proxy. No model, no CDN |
| hit maths | `hit.ts` | Where a ray meets a panel; shared with the placement solver and the Node tests |
| widgets | `button.ts` | Button, toggle, segment, row, progress bar: one record, four states (idle, hover, pressed, disabled), never colour alone |
| captions | `caption.ts` | The caption bar (2 lines, karaoke, redrawn only when the word changes) and the lazy follow every head-following panel uses |
| the card | `card.ts` | The popup card and the leader line (a 0.6 degree ribbon, dashed when the house hides the subject) |
| the menu | `menu.ts` | Five rows a page: tour, places, time of day, posture and height, display and comfort; Exit VR always one press away. Plus the dock |
| toasts, status | `toast.ts` | Never take the ray |
| where the card goes | `place-world.ts` | A pure function: 12 directions around the subject as the head sees it, the view cone, the house's hull, under 2 percent overlap with the subject, the Core and the caption bar; may turn the head a little so the subject and the card sit side by side |
| the presenter | `tour-presenter.ts` | `Presenter` of PRESENTER.md: `enterBeat` stands, blinks, places and reveals the card in about 320 ms |
| the demo | `demo.ts` | A stand-in Director and four mock beats; the worked example of what the story Director must call |

## Numbers (all from `presenter.ts`)

- body text 1.4 degrees of em, never under 1.1 anywhere, captions 1.6, titles 2.0, headings 2.8; raised to the pixel floor (16 px) on a coarse headset
- a card is 32 degrees wide (22 to 40), 1.7 m away, 0.9 to 3.0 m allowed; contrast 7:1 or better (tested)
- targets: 3.5 degrees for a controller ray, 4.5 for a hand ray, 5 for gaze plus pinch, never under 5 cm; hover exists only for a tracked pointer
- budget: 8 panels, 24 MB of textures, 24 draw calls (measured in the demo: 6 panels, 10.9 MB, 11 draw calls); a ninth panel or a 48 MB texture is refused with a fault

## What the Director calls (N3 in the plan)

```ts
const ui = window.__houseViewer.xr.ui();                 // after the 'vh:xr' event with state 'started'
const presenter = ui.presenter(host);                    // host: PresenterHost; the same as presenter.attach(host)
await presenter.prepare(story); await presenter.start({ audio, beat, paused });
await presenter.enterBeat(view, { from, reducedMotion, signal });   // moves the person with Rig.moveTo, ~320 ms
presenter.tick(clock);                                   // every XR frame, from xr.onFrame(), never window.requestAnimationFrame
await presenter.exitBeat(view, ctx); await presenter.showEnd(endView);
presenter.dispose();                                     // on 'ended', or to swap back to the DOM presenter
```

`presenter.audio.routeFor(clip, beat)` returns `{kind: 'head'}` for the narrator and a world route at the Core for a companion. Events come back through
`host.emit`: `next`, `prev`, `chapter`, `replay`, `next-family`, `cta`, `setting`, `visibility`, `exit` and `fault` (a presenter fault names its code:
`no-xr`, `xr-session-ended`, `font-failed`, `texture-failed`, `no-placement`, `unreachable-beat`, `budget-exceeded`, `input-lost`).

## Tests

- `node --experimental-strip-types scripts/test-presenter.mts` (quick, Node): placement over synthetic heads at eye heights 1.2 and 1.6 m, 2000 random heads, sizes, hit maths, the lazy follow, contrast
- `pnpm run xr:test -- --only 30 --device quest3,vision` (IWER): T-X2 aim, hover and press (a pixel changes under the ray; nothing hovers on a transient pointer; a lost or slid-off press activates nothing), T-X2b the registry path, T-X3 content, comfort, budgets and network over the whole mock tour, T-X5 failure paths, T-X10 the menu and the cleanup

## What emulation cannot prove (it is in `XR-DEVICE-CHECKLIST.md`)

Legibility at a real distance (IWER's eye buffer is a few pixels per degree: sizes are design values until a Quest 3 and a Vision Pro read them), ray ergonomics,
pinch reliability on visionOS (no hover exists for web content there; targets are 5 degrees), audio routing inside a session, and the 450 ms budget on a device
(the emulator measures about 320 ms: two blink fades plus a frame or two).
