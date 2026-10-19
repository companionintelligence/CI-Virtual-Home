# The interactive tour (assets/story/, portal/story.css)

The live player (`room-creator?mode=view&house=<id>&family=<slug>[&beat=<id or n>|&member=<id>]`: the house the family lives in, and the family whose tour it asks for; a family's page links it) plays a family's baked **story shot** and puts a DOM tour over it: a card per
beat, the narration, captions, chapters, a start card and an end card. Offline rendering is untouched: nothing here is imported by the
editor page, the goldens, the fixtures or the film script's frames. `?no=story` is the kill switch and gives back today's player.

## How it hangs together

| Piece | File | Job |
|---|---|---|
| hook | `assets/viewer.ts` (about 25 lines) | a lazy `import('./story/mount.js')` only for `?family=` without `?no=story`; `await prepare(api, house)` before the shots are listed; the default shot becomes `story`; `family` stays in the address and the share link goes through the family's page; `stats.t`, `stats.playing` and `stats.control` are published; `url()` keeps the address's other parameters (below) |
| mount | `mount.ts` | finds the family that lives in the house on screen in `story/manifest.json` (`byFamily[slug].house`; the tour follows the house when the player goes to the next home), fetches `story/<slug>.<hash10>.json`, loads `portal/story.css?v=<hash10>` with its own `<link>`, registers the story track as shot `story` (also `__houseDebug().presets['house:<id>:story']`), then mounts the Director when the player says `ready`. Any failure leaves the plain player and says so in a toast |
| director | `director.ts` | the state machine: start card, play, step, chapter jump, free-look, end card, replay. It does not move the camera; the player's loop plays the track. It watches `stats.t` and decides which beat is on |
| card | `popup.ts`, `captions.ts` | one surface for the words: kicker, title, body (lit word by word from the voice lock's timings), chips, the agent's scripted line, note, "Fictional" footer. The karaoke is the same text as the live region |
| placement | `place.ts` (story-bake), `director.ts` | solved once per beat against the rest pose; see below |
| audio | `audio.ts` | Web Audio: fetch, decode, start at an offset; the clock is the `AudioContext` while a clip sounds |
| chapters | `chapters.ts` | drawer at 1100 px and up, sheet below; a real `<nav>` of buttons; the Transcript disclosure |
| a11y | `a11y.ts` | the one live region, the canvas label, focus helpers |
| keys | `keys.ts` | capture-phase keys that stop propagation only for the keys the tour owns |
| url | `url.ts` | `?family=<slug>&beat=<id or n>` and `&member=<id>`; the parameters the player does not own (`foreignParams`); the player's address for a family (`tourHref`); the next family that has a tour (`nextTour`). Pure where it can be: `scripts/test-story-url.mts` runs it in Node |
| ship | `scripts/story/ship/player.mts` | joins story + voice lock + bake lock (`joinRuntime`) into `story/<slug>.<hash10>.json`, adds the stylesheet's fingerprint as `css`, ships clips the voice step did not |

## Starting where a person is (`?member=<id>`)

A family's page links "Start with John" to `...&family=<slug>&member=john`, and the start card lists the family (a monogram disc, the name, the archetype word) as one button each:
"Start with John, builder". Both open the tour at **the first beat of that person's own room**, which is not always their first beat in the story: John in `brennan` has a living-room
beat before the primary suite. A person's own room is the chapter where most of their beats are (the first run and the closing do not count; the earlier chapter wins a tie): `url.ts`
`memberChapter` and `memberBeat`, the same function the family page uses to say which room is theirs. A person with no beat of their own is not offered; an id that is not a member of the
family opens the plain start card; `?beat=` wins over `?member=`. A link with `?member=` says "Starting with John" on its start card and keeps the primary button's own words; a start card
button starts **without sound** (a person who chose a name did not choose a voice; M turns narration on), and nothing about the sound rules below changes.

## What the address keeps

The player rewrites its address as it goes (`assets/viewer.ts` `url()`), and it used to write only its own parameters: `mode`, `house`, `family`, `shot`, `t`, `tod`. It now keeps every
other parameter in the address as it was, in order: a campaign's `utm_*`, `fbclid`, `ttclid`, `gclid`, `msclkid` and anything else a link carried. `beat` and `member` are the tour's and
`play` is a one-time instruction, so those are not kept (`OWN_PARAMS`, in `viewer.ts` and in `url.ts`; the test keeps the two lists equal). A share link is not the visitor's own ad
click and carries none of them. "Next family" on the end card opens the next family that has a tour (the manifest's order) as a page of its own and keeps the tags.

## No narration yet

A family with no `.voice.json` has a **captions-only** tour. Its bake lock has `durations: "estimated"` (150 words a minute of speech, 200 of card), `scripts/story/ship/player.mts` ships it
without `audio`, and the manifest says `narration: false` for it. The director then has no narrator: the start card has one button, "Start the tour" (no "Start without sound", no voice line in
its fine print), there is no sound button, M and Space on the start card start captions-only, no `AudioContext` is made and no `.m4a` is asked for, and nothing is toasted. The card shows
the beat's whole text (unlit) for the beat's reading time. The day a voice lock exists and the bake is made from it, the family becomes a narrated tour with no other change.

## The hour

A family tour opens in daylight (`mount.ts`): a home whose own hour is dusk or night opens in the day unless the link asks for an hour (`&tod=`). The hour chips stay the visitor's.

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
- **Failures.** Story JSON 404: the plain player on the Orbit and the toast "The narrated tour could not load. Here is the house tour instead." Audio 404: captions stay and the toast "Narration could not load. Captions are on."
  When the player cannot start at all (no WebGL 2, a module that did not download) the failure card of `room-creator.html`'s head script has one more button, "Read the family's story", a 44 px
  link to `family/<slug>` when the address has `&family=` (the primary button where Try again could not help); a drawing context taken back after the player started ends on the same card after
  six seconds unless the browser gives it back first (the head script only listens, in the capture phase, and never touches the renderer).
- The shot chips are hidden while a tour runs (`html[data-story] .vh-shots`): the chapters replace them. The hour chips stay.

## Tests

`scripts/test-story-url.mts` (Node, no browser) holds the address parsing; `scripts/story/portal-tests/family-failures.mts` the failure card;
`scripts/story/portal-tests/player.mts` (run by `pnpm run portal:test`, alone with `-- --only hooks`):
T6 placement for every beat of two families (the exemplar and one whose house has no TV) at 1440 and 390, chapters list length, live text,
end card; T7 keys, focus, live region, captions on screen while a clip sounds, the start card, end card and chapters panel audited at 1440 and 390
(axe-core is MPL-2.0 and the repo does not take it, so an in-page audit stands in: names, labelled dialog, ids, contrast against the worst
background, 44 px targets on touch); T8 the gesture rule and `?no=story`; contrast of the lit card at 390, 768 and 1440; the address bar; reduced
motion; the failure paths; next family.

`scripts/story/portal-tests/player-start.mts`: T9 the way in at a person, the campaign's tags in the address, daylight, the end card and Next family; T10 the captions-only tour (the audio checks of T7 and T8 in `player.mts` run for a family that has a voice and say so when none does).

## Not verified

Safari/iOS audio (the context is made in the click, which is what iOS needs, but no iOS device was used); listening quality; the placement across
all thirty families (only the test fixtures exist; look at a contact sheet per family when they are baked); a screen reader.
