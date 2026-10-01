# The interactive tour (assets/story/, portal/story.css)

The live player (`room-creator.html?mode=view&family=<slug>`) plays a family's baked **story shot** and puts a DOM tour over it: a card per
beat, the narration, captions, chapters, a start card and an end card. Offline rendering is untouched: nothing here is imported by the
editor page, the goldens, the fixtures or the film script's frames. `?no=story` is the kill switch and gives back today's player.

## How it hangs together

| Piece | File | Job |
|---|---|---|
| hook | `assets/viewer.ts` (about 8 lines) | a lazy `import('./story/mount.js')` only for `?family=` without `?no=story`; `await prepare(api, house)` before the shots are listed; the default shot becomes `story`; `stats.t`, `stats.playing` and `stats.control` are published |
| mount | `mount.ts` | finds the family in `story/manifest.json`, fetches `story/<slug>.<hash10>.json`, loads `portal/story.css?v=<hash10>` with its own `<link>`, registers the story track as shot `story` (also `__houseDebug().presets['house:<id>:story']`), then mounts the Director when the player says `ready`. Any failure leaves the plain player and says so in a toast |
| director | `director.ts` | the state machine: start card, play, step, chapter jump, free-look, end card, replay. It does not move the camera; the player's loop plays the track. It watches `stats.t` and decides which beat is on |
| card | `popup.ts`, `captions.ts` | one surface for the words: kicker, title, body (lit word by word from the voice lock's timings), chips, the agent's scripted line, note, "Fictional" footer. The karaoke is the same text as the live region |
| placement | `place.ts` (story-bake), `director.ts` | solved once per beat against the rest pose; see below |
| audio | `audio.ts` | Web Audio: fetch, decode, start at an offset; the clock is the `AudioContext` while a clip sounds |
| chapters | `chapters.ts` | drawer at 1100 px and up, sheet below; a real `<nav>` of buttons; the Transcript disclosure |
| a11y | `a11y.ts` | the one live region, the canvas label, focus helpers |
| keys | `keys.ts` | capture-phase keys that stop propagation only for the keys the tour owns |
| url | `url.ts` | `?family=<slug>&beat=<id or n>` |
| ship | `scripts/story/ship/player.mts` | joins story + voice lock + bake lock (`joinRuntime`) into `story/<slug>.<hash10>.json`, adds the stylesheet's fingerprint as `css`, ships clips the voice step did not |

## Rules worth knowing

- **Audio never starts before a gesture.** The start card has "Start with narration" and "Start without sound" (a shared `?beat=` link says
  "Play from here"). The `AudioContext` is made inside the click (or the key press for Space/Enter on the button, or M later). "Start without
  sound" never makes one and fetches no `.m4a`. Nothing is prefetched until sound is chosen.
- **The clock.** While a clip sounds, the picture follows the voice (drift over 0.12 s moves the picture). Muted, it is the player's wall clock. Durations
  are the voice lock's either way, so a tour with sound and one without take the same time.
- **The subject.** A beat's subject is its baked box projected through the camera. A room, a lawn or a street (over 3.2 m), or a box that
  would fill 45 % of the window, is replaced by the pin zone: a square of 24 % of the short side round the aim point. The card keeps under
  2 % off the subject, off the Core in the first chapter, and off every bar.
- **Phones (600 px and under).** The card is a bottom sheet of at most 38 % of the height. If that covers the subject: the same sheet under the top
  bar; else the card without its phone drawing (the words are in the narration and in the Transcript), at the bottom and then the top.
- **Keys.** Space; Left/Right (Shift: chapter); M; 1 to 9; C (chapters; while flying C stays the player's cutaway); `[` `]` the player's;
  Esc closes help, then chapters, then leaves free-look (back to the beat), then the player's own fly exit. A focused slider keeps its arrows,
  Space on a focused button is the button's.
- **Reduced motion.** Opens paused, no auto-advance (Right/Left step, Space says the beat again), a cut with a 250 ms cross-fade of the canvas,
  no pulsing ring.
- **Failures.** Story JSON 404: the plain player on the Orbit and the toast "The narrated tour could not load. Here is the house tour
  instead." Audio 404: captions stay and the toast "Narration could not load. Captions are on."
- The shot chips are hidden while a tour runs (`html[data-story] .vh-shots`): the chapters replace them. The hour chips stay.

## Tests

`scripts/story/portal-tests/player.mts` (run by `pnpm run portal:test`, alone with `-- --only hooks`):
T6 placement for every beat of two families (the exemplar and one whose house has no TV) at 1440 and 390, chapters list length, live text,
end card; T7 keys, focus, live region, captions on screen while a clip sounds, the start card, end card and chapters panel audited at 1440 and 390
(axe-core is MPL-2.0 and the repo does not take it, so an in-page audit stands in: names, labelled dialog, ids, contrast against the worst
background, 44 px targets on touch); T8 the gesture rule and `?no=story`; contrast of the lit card at 390, 768 and 1440; the address bar; reduced
motion; the failure paths; next family.

## Not verified

Safari/iOS audio (the context is made in the click, which is what iOS needs, but no iOS device was used); listening quality; the placement across
all thirty families (only the test fixtures exist; look at a contact sheet per family when they are baked); a screen reader.
