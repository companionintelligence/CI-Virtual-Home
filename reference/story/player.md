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
| card | `popup.ts`, `captions.ts`, `portal/story.css` | one surface for the words (type scale and sizes: "Type and size" below): kicker, title, body (lit word by word from the voice lock's timings), chips (the chip that names an app wears its real logo), a "More" toggle, the agent's scripted line, note, "Fictional" footer. The karaoke is the same text as the live region |
| placement | `place.ts` (story-bake), `director.ts` | solved once per beat against the rest pose; see below |
| audio | `audio.ts` | Web Audio: fetch, decode, start at an offset; the clock is the `AudioContext` while a clip sounds |
| chapters | `chapters.ts` | drawer at 1100 px and up, sheet below; a real `<nav>` of buttons; the Transcript disclosure |
| a11y | `a11y.ts` | the one live region, the canvas label, focus helpers |
| keys | `keys.ts` | capture-phase keys that stop propagation only for the keys the tour owns |
| url | `url.ts` | `?family=<slug>&beat=<id or n>` and `&member=<id>`; the parameters the player does not own (`foreignParams`); the player's address for a family (`tourHref`); the next family that has a tour (`nextTour`). Pure where it can be: `scripts/test-story-url.mts` runs it in Node |
| ship | `scripts/story/ship/player.mts` | joins story + voice lock + bake lock (`joinRuntime`) into `story/<slug>.<hash10>.json`, adds the stylesheet's fingerprint as `css` and the apps' real logos as `media` (story v2), ships clips the voice step did not |

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

## The card's logo, "More" and the home line (story v2)

Everything here is optional on a story and costs a story without it nothing: no `detail`, no toggle; no `media`, no logo.

- **The app's real logo.** `scripts/story/ship/player.mts` puts `media` in the shipped story: for each app a beat names (`app`, `with`) the manifest's logo (`content/story/app-media.json`:
  file, size, alt text; `RuntimeMedia` in `runtime.ts`). The card puts that logo, 1.3 times the card's type (33 px at 1440; it was 20 px before the type grew) on a light tile (`--foreground`, so a dark mark stays visible), at the start of the chip whose text is the app's
  name; the `replaces ...` chip has none, and a logo never stands alone. **No screenshot is ever in the tour** (`ads` rule: a real capture is never composited into a scene; the family page
  carries them beside the story). The file is the page's own `./portal/apps/<id>/logo.<hash10>.webp`, asked for when the card is built (a few KB, cached for a year).
- **"More".** A beat with a `detail` has a button at the right of the card's top line: "More", `aria-expanded`, `aria-controls`, `aria-label="More about this moment"`, a 44 px control whose box
  overlaps the kicker line by the few px it is taller than the monogram disc (negative margins), so **the card is no taller for it** and the placement of every closed card is what it was. It opens the beat's
  `before` and `after` (not the steps or the fact: those are the family page's) in the card, under the chips. The card's words (kicker, title, body, chips, scripted line, note) stay `aria-hidden`
  (the live region says them, once); the toggle and what it opens are controls and are not. Click, Enter and Space open and close it (Space on a focused button is the button's);
  **Esc closes it** before it leaves free-look (`keys.ts`), and focus stays on the button; opening it **pauses the tour** (a card must not change under a reader; Play carries on); the next beat's
  card opens closed, and focus on the button moves to the next card's button.
- **Where the open card goes.** The director solves the card's place again for its new size (the same solver, the same rest pose; `placedFor` has the open state in its key). On a wide screen the open card
  is as tall as the room between the top bar and the dock (it scrolls inside beyond that) and keeps under 2 % off the subject, as ever. On a phone the sheet may grow up to the 55 % limit but never into the subject: it takes
  the room between the subject and the dock when that is more than the closed sheet had, else it keeps the closed sheet's height and **scrolls inside**, with the opened text brought into view. An open
  sheet never covers more of the subject than the closed one did.
- **The start card** carries the home in one line: the first sentence of `family.home.lede` (true to the house's spec; the family page has the whole lede and the plan).

## Type and size (the owner's "36 px text minimum", then "30 percent too big, reference the website": live pass 3)

The scale is the CI canon's (`styles/typography.md`, `styles/UI-STYLE-GUIDE.md` of CI-Common): Manrope, the org-wide root `html { font-size: 17px }` and every size in rem of it, weights 400 body, 500 controls, 600 chips and
headings, 700 titles and strong emphasis (no 800), tracking `0.2pt` (`--font-letter-spacing`) on everything but a person's name. The tokens are in `portal/viewer.css` (`html[data-mode="view"]`); the tour (`portal/story.css`),
the About dialog, the failure cards (`viewer.css`) and the screenshot dialog (`portal/media.css`, `--dlg-min`) are set from them, and `scripts/test-story-pages.mts` fails on a `font-size` in any of them that is not a token.

| Token | 768 px and wider | Phone (under 768 px) | Used for |
|---|---|---|---|
| `--st-min` | 1.5rem = 25.5 px | `clamp(20px, 5.4vw, 25.5px)` (390 px wide: 21.06 px) | every line of reading text in a modal: body, kicker, chips, notes, toggles, buttons, labels, the fine print, the About text |
| `--st-title` | 2.25rem = 38.25 px | 1.9rem = 32.3 px | a card's title, the About and failure titles |
| `--st-hook` | 2.6rem = 44.2 px | 2.1rem = 35.7 px | the start card's and the end card's heading |

**The floor is a floor.** `place.ts` is told it (`typeFloor(vw)`: 25.5 px from 768 px up, the phone clamp below) and the director measures the smallest type in each variant of the card it offers (`minTypePx`); the solver refuses a
variant under the floor and never shrinks type to fit. What it may shrink is padding: the card is offered at its width, the same with tighter padding (`.st-tight`), then narrower and so taller (90 % and 80 % of the width, never
under 360 px), each with and without the tight padding; it picks the first that keeps off the subject (under 2 %) and shows the most of itself, and a card taller than the room scrolls inside. If every variant is under the floor
the result says `reason: 'type-floor'` and is not `ok`. The end card is solved the same way, and a phone's sheet tries the phone drawing, no drawing, and tight padding before it scrolls.

**Size.** A card is `clamp(420px, 32vw, 560px)` wide (`cardWidth`: 461 px at 1440, 420 at 1024, 560 from 1750 px up; 28 to 34 % of a window from 1235 to 2000 px), as tall as its content needs up to the room between the top bar and
the dock, on the side the subject leaves free (docked at the edge when it is a quarter of the window or more, else beside the subject). The start card is a dialog of up to 1000 px (one column of 760 px under 1100 px; a window
shorter than it scrolls the scrim). The About dialog is 40rem wide, the failure card 34rem, the family page's screenshot dialog 48rem (a picture and its caption); all scroll in a short window. A phone's sheet is full width, up to 55 % of the height.

**What was copied from the website and the canon.** The root and the rem scale; Manrope's four weights and 0.2pt tracking; the radius scale (`--radius` 0.625rem: a card is its 2xl, `calc(0.625rem + 10px)`, a control its xl,
`+ 4px`, a phone's sheet `+ 6px`, chips stay pills as the canon's `rounded-full`); a hairline ring instead of a heavy border (the site's panels and the Hub's Dialog use a 1 px line); the shadow set's `shadow-lg` look (the
glass keeps `--vh-shadow`); controls at least 44 px (the site's `--store-tap`); padding that grows with the surface (the site's `clamp(20px, 3vw, 36px)` panel: 1.25 to 1.5rem on a card, 2 to 2.25rem on the start card); the
proportion of title to text (the site's panel title 1.75rem over 1.0625rem text, the Hub's `text-lg` over `text-sm`: here 2.25rem over 1.5rem); a primary button in the accent and the others quiet; the About and failure
cards' width in the Dialog's `max-w-lg` to `2xl` range (32 to 42rem; the screenshot dialog, which holds a 960 px picture, is 48rem). What was not: the site's square corners and uppercase display headings (the portal keeps its own rounded glass), and the Hub's black 80 % overlay (the start
card's scrim lets the home show through).

**The name is a kicker.** A person's name wherever it labels a card, a dialog or a section (the card's kicker slot `.st-who`, the start card's "Starting with" line and its person buttons `.st-name`, the family page's `.nm`:
hero, people nav, each person's heading, the day's entries, the previous and next family; "THE BRENNAN FAMILY" the same) is all capitals by CSS (`text-transform`, never in the string: the text and every aria-label keep the name as
written), 700, `letter-spacing: 0.2em` (`--st-kick`), in the accent (`--primary`: sage on the player's dark set, phthalo on the family pages' light one), at the card's reading size; on the family page's nav chips, day labels and
sibling links it is 0.85rem (14.45 px) and no smaller, and its headings are 1.5rem or more. The monogram disc stays.

**Not changed.** The chapters drawer and the Transcript (a navigation list, not a card or a dialog: 13 to 15 px as before) and the player's own bars. While the chapters panel is open, a window of 1100 px and wider keeps the card beside the drawer (the drawer is something the card keeps off, not the top of its room: `roomFor` counts only the top bar's own items), and from 768 to 1099 px, where the panel is a wide sheet, the sheet takes the card's and the end card's place (one panel at a time, as on a phone); `typography.mts` checks both. A film or ad canvas is a picture shown scaled down, so its type stays at 36 design px
(`CANVAS_TYPE_MIN`) with the same kicker and card geometry (`assets/story/film/`).

## Rules worth knowing

- **Audio never starts before a gesture.** The start card has "Start with narration" and "Start without sound" (a shared `?beat=` link says
  "Play from here"). The `AudioContext` is made inside the click (or the key press for Space/Enter on the button, or M later). "Start without
  sound" never makes one and fetches no `.m4a`. Nothing is prefetched until sound is chosen.
- **The clock.** While a clip sounds, the picture follows the voice (drift over 0.12 s moves the picture). Muted, it is the player's wall clock. Durations
  are the voice lock's either way, so a tour with sound and one without take the same time.
- **The subject.** A beat's subject is its baked box projected through the camera. A room, a lawn or a street (over 3.2 m), or a box that
  would fill 45 % of the window, is replaced by the pin zone: a square of 24 % of the short side round the aim point. The card keeps under
  2 % off the subject, off the Core in the first chapter, and off every bar.
- **Phones (under 768 px).** The card is a bottom sheet of at most 55 % of the height (it was 38 % before the type grew; a tablet held upright, 768 to 999 px wide and taller than wide, takes the sheet too). If that covers the subject: the same sheet under the top
  bar; else the card without its phone drawing (the words are in the narration and in the Transcript), with tighter padding, at the bottom and then the top; a sheet that still has not the room scrolls inside, with the type unchanged. While the More sheet of the player's compact layout is open the card is put away (one panel at a time), and the About dialog stands over the cards.
- **Keys.** Space; Left/Right (Shift: chapter); M; 1 to 9; C (chapters; while flying C stays the player's cutaway); `[` `]` the player's;
  Esc closes help, then chapters, then the card's "More", then leaves free-look (back to the beat), then the player's own fly exit. A focused slider keeps its arrows,
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
T6 placement for every beat of two families (the exemplar and one whose house has no TV) at 1440 and 390 (a phone's sheet at most 55 % of the height), chapters list length, live text,
end card; T7 keys, focus, live region, captions on screen while a clip sounds, the start card, end card and chapters panel audited at 1440 and 390
(axe-core is MPL-2.0 and the repo does not take it, so an in-page audit stands in: names, labelled dialog, ids, contrast against the worst
background, 44 px targets on touch); T8 the gesture rule and `?no=story`; contrast of the lit card at 390, 768 and 1440; the address bar; reduced
motion; the failure paths; next family.

`scripts/test-story-place.mts` (Node, no browser) holds the solver: the type floor (25.5 px, the phone clamp, the film's 36), the card width, the variants (a type under the floor is refused, padding may shrink), the panel's sweep over random subjects, the phone's sheet at 55 %, the end card.
`scripts/story/portal-tests/typography.mts` (T13): at 1440, 1024 and 390, every text node of the start card, three beat cards (the first, a film beat, one with "More" open), the end card, the About dialog and the failure card is at least 25 px (20 px on a phone); every person's name in them and on the family page (light and dark) is uppercase by CSS, bold and tracked at least 0.15em, at the reading size, with the real name in the text and the aria-label; the family page's names are 4.5:1 against their page; the screenshot dialog's text and buttons; cards 360 to 560 px wide, a sheet at most 55 %.

`scripts/story/portal-tests/player-start.mts`: T9 the way in at a person, the campaign's tags in the address, daylight, the end card and Next family; T10 the captions-only tour (the audio checks of T7 and T8 in `player.mts` run for a family that has a voice and say so when none does).

`scripts/story/portal-tests/player-more.mts` (story v2): T11 the start card's home line; the real logo on the app chip (1.3 times the card's type, the file the story names, decoded); no screenshot in the tour; for every beat of the first tour that has details: the toggle is
there, opens to the beat's before and after and closes again, the open card keeps under 2 % off the subject at 1440 and at 390 is never above 55 % of the height and covers no more than the closed one did; a beat with no detail has no toggle;
the button is 44 px, outside the aria-hidden words; Enter, Space, Esc and a click; opening it pauses; the next card opens closed; reduced motion.

## Not verified

Safari/iOS audio (the context is made in the click, which is what iOS needs, but no iOS device was used); listening quality; the placement across
all thirty families (only the test fixtures exist; look at a contact sheet per family when they are baked); a screen reader.
