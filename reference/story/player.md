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
the dock, on the side the subject leaves free (docked at the edge when it is a quarter of the window or more, else beside the subject); that is the width the solver chooses, and the card as drawn is then trimmed to its widest wrapped line ("The glass", rule 3). The start card is a dialog of up to 1000 px (one column of 760 px under 1100 px; a window
shorter than it scrolls the scrim). The About dialog is 40rem wide, the failure card 34rem, the family page's screenshot dialog 48rem (a picture and its caption); all scroll in a short window. A phone's beat sheet is full width, at most 40 % of the height and as tall as its words; its start sheet at most 50 % (a phone on its side takes a panel of at most 45 % of the width instead: "On a phone" below). The end card's sheet keeps place.ts's 55 %.

**The type on a phone on its side.** The scale is keyed on the window's width, as the owner set it, so a phone held on its side (844 x 390, or 740 x 360, which is under 768 px: `--st-min` is `clamp(20px, 5.4vw, 25.5px)` and so 25.5 px at 740) reads at 25.5 px in a window 390 px high. Nothing here shrinks it: the cards are laid out for it (a panel that scrolls, see "On a phone"), and `place.ts`'s floor is told the same number. It is a poor fit (eleven lines of the window, a panel 13 to 18 characters wide) and is the one place the scale and the screen disagree: if the owner wants the phone's clamp keyed on the short edge instead (`clamp(20px, 5.4vmin, 25.5px)` under `(max-height: 500px)`, which gives a 390 px window the 21 px a 390 px portrait phone has), it is one rule in `portal/viewer.css` and one argument to `typeFloor` in `director.ts`; `place.ts` need not change. Not done: the brief said never to shrink type.

**What was copied from the website and the canon.** The root and the rem scale; Manrope's four weights and 0.2pt tracking; a hairline ring instead of a heavy border (the site's panels and the Hub's Dialog use a 1 px line);
the shadow set's `shadow-lg` look (the glass keeps `--vh-shadow`); controls at least 44 px (the site's `--store-tap`); padding that grows with the surface (the site's `clamp(20px, 3vw, 36px)` panel: 1.25 to 1.5rem on a card,
2 to 2.25rem on the start card); the proportion of title to text (the site's panel title 1.75rem over 1.0625rem text, the Hub's `text-lg` over `text-sm`: here 2.25rem over 1.5rem); a primary button in the accent and the
others quiet; the About and failure cards' width in the Dialog's `max-w-lg` to `2xl` range (32 to 42rem; the screenshot dialog, which holds a 960 px picture, is 48rem). What was not: the site's square corners and uppercase
display headings, and the Hub's black 80 % overlay (the start card's scrim lets the home show through). The canon's radius scale (`--radius` 0.625rem: a card its 2xl, a control its xl, chips `rounded-full`) was the first
pass and is gone: the owner's glass mockup set two corners instead, below ("The glass").

**The name is a kicker.** A person's name wherever it labels a card, a dialog or a section (the card's kicker slot `.st-who`, the start card's "Starting with" line and its person buttons `.st-name`, the family page's `.nm`:
hero, people nav, each person's heading, the day's entries, the previous and next family; "THE BRENNAN FAMILY" the same) is all capitals by CSS (`text-transform`, never in the string: the text and every aria-label keep the name as
written), 700, `letter-spacing: 0.2em` (`--st-kick`), in the accent (`--primary`: the canon's light-set phthalo `#0a6358` on the glass, the same on the family pages' light set), at the card's reading size; on the family page's nav chips, day labels and
sibling links it is 0.85rem (14.45 px) and no smaller, and its headings are 1.5rem or more. The monogram disc stays.

**Not changed.** The chapters drawer and the Transcript (a navigation list, not a card or a dialog: 13 to 15 px as before) and the player's own bars. While the chapters panel is open, a window of 1100 px and wider keeps the card beside the drawer (the drawer is something the card keeps off, not the top of its room: `roomFor` counts only the top bar's own items), and from 768 to 1099 px, where the panel is a wide sheet, the sheet takes the card's and the end card's place (one panel at a time, as on a phone); `typography.mts` checks both. A film or ad canvas is a picture shown scaled down, so its type stays at 36 design px
(`CANVAS_TYPE_MIN`) with the same kicker and card geometry (`assets/story/film/`).

## The glass (the owner's mockup, 2026-10)

The owner approved a mockup of the tour in light frosted glass and asked for it in the live player: cards, the start and end cards, dialogs and controls, behind the existing tests. The type scale above does not move: the
mockup's 16 px text was never the proposal for the type. Four rules, each with its check.

1. **Glass.** Every surface the player draws over the home (the beat card and its sheet, the start, end and failure cards, the chapters panel, the About dialog, the loader card, the toast, the top bar's buttons and title, the dock, the
   tools sheet, the free-camera bar and the chips and buttons in them) is one glass, tokens in `portal/viewer.css`: `--st-glass` white at 82 % as the floor, `--st-glass-sheen` (white 44 % to 0 at 135deg) over it, so the surface runs from about
   90 % at its top left to 82 % at its bottom right, `blur(16px) saturate(1.5)` (`--st-glass-blur`), a 1 px edge of white at 62 %, an inset 1 px highlight and the soft `--vh-shadow`. The text on it is the canon's LIGHT semantic set, copied from
   the light token block of `room-creator.html` (the player's page always takes the dark set, so the view page does not expose it): `--st-ink` `#0a222e` (foreground), `--st-ink-2` `#3a524b` (muted-foreground), `--st-accent` `#0a6358` (primary),
   `--st-accent-fg` (primary-foreground, the text of a primary action), `--st-paper` `#f3faf7` (background: the one opaque surface, under a card's stuck head so scrolled words hide) and `--st-c1` to `--st-c4`; `viewer.css` re-scopes the
   semantic names (`--foreground`, `--primary` ...) to them on `.vh` and `.vh-fail`, so a rule keeps saying `var(--foreground)`. `test-story-pages.mts` holds each token equal to the canon's.
   **Contrast is measured, not assumed.** The mockup's 80 to 64 % white was tuned up, never the type down, until the text holds over the worst thing the scene could put behind the glass. The audit in `player.mts` composites the glass's floor
   colour over pure white and over pure black (it stops at the glass: the near-black page behind the player used to stand in for the backdrop, which is the black case only, and never showed white). At the 82 % floor over black the ink is
   10.7:1 (body text asks 7:1), the muted ink 5.5:1 and the accent 4.7:1 (small and muted text ask 4.5:1); over white 16.4, 8.4 and 7.2. The sheen only lightens, so the floor is the worst case. A control's tint (the quiet buttons, the
   person buttons) takes a little off: the large bold accent name on a person button is 4.2:1 over black (it needs 3:1 as large text). Raise `--st-glass` first if more is wanted, then the sheen; never the type. `player.mts` audits
   the cards, the top bar, the dock, the tools sheet and the About dialog at 390, 768 and 1440.
2. **Corners.** Two radii and nothing else: **5 px** (`--st-r-card`, `--st-r-sheet`, `--vh-radius`, the last one in the compact layout too) on a card, a sheet, a dialog, a panel, the dock, the top bar's panels and the toast; **3 px**
   (`--st-r-ctl`) on a chip, button, monogram disc, logo tile, kbd, tick, control and the lit word of the karaoke. No pill and no circle: the scrubber's round thumb is a pseudo-element and the leader's pin an SVG circle, drawing marks and not
   containers. A chip's 44 px touch target is a margin and an `::after`, not a transparent border: a face clipped to the padding box has the outer radius less the border, which is square at 3 px. `test-story-pages.mts` fails on a literal
   radius in `story.css` or `viewer.css` (the thumb excepted); `typography.mts` walks the elements on screen and fails on any radius that is not 0, 5 px or 3 px.
3. **Words stay in their box and the box fits the words.** The tour's layer sets `overflow-wrap: anywhere` and `min-width: 0` on a card's children, and nothing in a card or dialog is `nowrap` or cut with an ellipsis (the top bar's one-line
   title and the dock's scrolling chips are controls and keep theirs). After the solver has placed a beat card at the width it chose, `fitWidth` (`popup.ts`) trims the DOM card to its widest wrapped line plus its right padding: the line rects
   of every text node (`Range.getClientRects`) and the right edges of chips, buttons, the monogram and the logo. The left edge and the height stay and the card is never widened (a narrower card can only cover less of the subject);
   a phone's sheet is full width by contract and is not trimmed; a trim that would make the content taller (a re-wrap) is undone. The "More" toggle and a person's button on the start card sit at the far end of a row, so they count by
   what they need (the kicker's edge, the gap and the toggle's width; the button's content and padding), not by where they are. The end card and the start card are trimmed the same way (the start card is `fit-content` up to its max first).
   The solver's width is kept on the element as `data-solved-w`, and the director returns it from `measure`/`measureEnd`; the leader starts from the card as drawn (`BeatCard.box`), not the solved rect. The About dialog stays 40rem
   wide (its links are rows of their own); it is checked for corners and overflow, not trimmed. `place.ts`, which the film's pin hashes, is not touched.
   **When every variant covers the subject** the solver does not collapse the card: it picks the slot and variant with the best score (it prefers the card at its own width, then the same with tighter padding, then narrower and taller, each in each
   slot, and charges a lot for covering the subject or the Core and more for covering a bar), reports `ok: false`, and the card stands where it covers the least; "More" stays closed and the body stays shown (a card taller than its room scrolls
   inside). None of the three Brennan tours has such a beat at 1440, 1024 or 390 (`measure` says `planned.ok` for all 27 of each). The mockup's body-behind-More idea is not built: `BeatCard.measure(..., collapsed)` has the hook for it and
   nothing calls it.
4. **The text does not cover the subject.** Unchanged: `MAX_OVERLAP` 2 % of the focus rect, which `player.mts` (every beat of one family at 1440 and 390) and `typography.mts` (the first three beats of each Brennan tour, with More open on one,
   at 1440, 1024 and 390) hold. The trim cannot break it: it only makes a card narrower, from the left edge the solver chose.

`typography.mts` (T13b) also holds, for the start, three beat, More, end, chapters, About, tools and chrome surfaces of the three Brennan tours at those three widths, that no text line or box leaves its card's padding box and that a
card that is not a full-width sheet has at most 3 px spare at the right of its widest line.

## On a phone (the owner's mobile pass, 2026-10)

Found on main from real captures (a 390 x 844 phone, a GPU, every home): the start card was 1.1 to 1.4 screens tall on all thirty families (its bottom at 943 to 1202 px), hid the whole home and cut the family off;
the first beat's sheet held about 100 px of dead space (the agent's line, held a room before it came) and the dock carried a row of hour chips the tour does not use; the top bar cut the home's name
("Stone Gable H..."). The type scale did not move: what moved is the length of the page, the order of the parts and the room each part is given. Everything here is behind `html[data-mode="view"]` and the tour's own
stylesheet; the editor, the offline renderer and the goldens never load it, so no frame moved.

**The start sheet** (under 768 px; `StartCard` in `popup.ts`, "the phone's start sheet" in `portal/story.css`). A bottom sheet of at most half the window (50 % of the room inside the safe area), the home visible above it (the scrim is only
a soft shade behind the sheet, and a veil over the band that holds the top bar and the home's label, fading out below it: the scrim is a dialog's and takes every tap, so the player's own bars under it must look put away and not live; the home between the two is clear). One column that scrolls inside the card, in reading order: the kicker, the title, the tagline, **the action bar** (the one primary action, 44 px or taller and full width; it has
the light set's paper behind it and a hairline above, and is `position: sticky; bottom: 0`, so it stays at the bottom edge whenever the words above would push it out and is simply where the words end when they fit; **with "About this family" open the bar moves to the end of the sheet**, below the words, where it sticks to the bottom edge for as long as they are read, because a bar that stays after the tagline scrolls out of the sheet with it and the primary action would be off screen while the long copy is read; shut, it is after the tagline again), the
label "Or start with one person" and **the family as one row of 44 px chips** (a monogram, the name in the kicker look, the archetype word, one line each, scrolling sideways, faded at the right edge while there are more), and **"About this family"**, a native
`<details>` with a 44 px summary. Behind it, in the same page whether it is open or shut: the facts ("27 stops, about 7 minutes. Fictional family. Real software."), the home's line, and every line of fine print the claims require (`FINE_PRINT`, from
`claims.json`; the voice line only for a tour that has a voice). Opening it scrolls the sheet to its words. Nothing was removed; `story:copy`, `test-fine-print.mts` and the tests that read `.st-fine li` see the same text. The
phone-on-its-side's version is a **panel** at the left of at most 45 % of the width and the whole height (below). A wide screen's start card is unchanged: same nodes, same two columns (`data-layout="wide"`).
`StartCard.layout()` moves the same nodes between the two arrangements on a change of window (a turn of the phone; nothing is rebuilt, and the control that had focus gets it back); the CSS has no media query for it: it follows
`data-layout`, which the script sets from the same two queries, so the two cannot disagree. Focus order is the DOM's, and the DOM's is the order on screen: the action, the family, the disclosure (with the disclosure open: the family, the disclosure, the action).

**The beat sheet** (`BeatCard`, `placeSheetFor` in `director.ts`, "a phone's beat sheet" in `portal/story.css`). At most **40 %** of the height (it was 55 %; `place.ts`'s `placeSheet` keeps 55 % for the end card, and the film's pin hashes `place.ts`, so the beat sheet has its
own copy of the same solver in `assets/story/sheet.ts` (`placePhoneSheet`, called by `placeSheetFor` in `director.ts`) with the owner's cap: under the subject down to the dock, or under the top bar, whichever shows more of the card, never over the subject, the Core or a bar, in the four ways the card may be set).
**As tall as its words**: a sheet has a top edge (the solver's) and a `max-height` (the solver's height), and is as tall as its content under that, so there is no dead space; the agent's line is `display: none` until it comes (measured, hidden, with
`st-reserve` so the solver counts it), and then grows the sheet **downward** into room the solver kept clear: the title and the words above it do not move (a sheet at the bottom floats above the dock until then, and the scene shows in the gap). **A one-line kicker**: the person's
monogram and name; "with Juniper" is not on the sheet (the agent's own line is labelled with the companion's name, and the live region says it all). **"More"** stays at the right of the kicker, 44 px, and the head sticks (the person and the toggle) when the sheet scrolls,
on an opaque band only once it has scrolled. The apps are one row of chips that scrolls sideways. The footer "Fictional family. Real software." is dropped from a sheet at the bottom (the persistent chip under the top bar is the label, and a sheet at the bottom does not cover it)
and kept on one under the top bar (which does). A sheet that is taller than its room scrolls inside, with the type unchanged; with no voice to light words for it to follow, it **scrolls by itself** over the beat's time (the first third reads what is in view, the end of the words is in view by
four fifths of the beat; never back up, paused for four seconds after a touch, never with More open, never with reduced motion), so a tour that moves on cannot hide the end of a card under its edge.

**The picture is shifted up** (`Director.syncShift`, `focus` in `director.ts`; `?no=shift` is the kill switch). The track puts what a beat is about at the middle of the window, which is where a bottom sheet goes, and a sheet that may not cover the subject was left a short box to
scroll in (on a 390 x 844 phone 20 of the 27 Brennan beats scrolled inside their sheet before this, 9 after). So on a phone held upright the director gives the player's camera a **view offset** (`camera.setViewOffset(w, h, 0, 0.17 h, w, h)`: the projection's principal point moves, a shear
and no distortion, so the subject stands about a sixth of the window higher and the sheet has the room under it). It is the 3D canvas of the live player only (the offline renderer, the film and the goldens use another camera and never load the tour), it is off while the person flies the camera,
and it is cleared when the tour is torn down. Every rectangle the director solves with (the subject, the Core, the leader's end) goes through `focus()`, which projects onto a taller virtual frame (`h + 2 * shift`, the same pixels per radian) and takes the shift off, so a box that was cut by the bottom edge
is whole and the pin dot is on the thing it points at. The start sheet gets the same shift (the home in the upper half). It is the one change here that touches the picture, and it is the one to take out first if it is not wanted (`?no=shift` shows the unshifted tour).

**The dock and the top bar** (`portal/story.css`, top). While a tour runs on a phone (`html[data-story]` under 760 px or 500 px tall) the hour chips and the shot chips are away (the tour opens by day; the chapters panel and the seek bar are its navigation), the speed control is away as it always was,
and the dock is **one row**: play, seek, time, More. On a phone held upright Previous home and Next home leave the top bar for the More sheet (a row each, 44 px), so the home's name has the room: the name **wraps to two lines and is never cut** (`html[data-story] .vh-name`
in `portal/story.css`: no `nowrap`, no ellipsis, no word broken in the middle, the player's own 14 px at every width; at 320 px the bar gives the title a little padding), and on a phone under 480 px a tour drops the meta line under it. On its side the bar is wide, so the two stay in it, and the More sheet, which is short,
has five rows and not seven. The plain player keeps all of it (`?no=story`, and the same page with the tour's flag removed): its name is the one line with an ellipsis it always was, the rule that wraps it is the tour's. The chapters sheet stands closer to the one-row dock. **The More sheet is never taller than the window**
(`max-height` in the compact layout of `portal/viewer.css`; it stands over the top bar on a short window, as it always did, and scrolls inside when its rows are more than the height holds).

**A phone on its side** (a window at most 500 px tall and wider than tall: 844 x 390, 740 x 360; `sidePhone` in `director.ts`; the start card's `data-layout="panel"`). The start card is a panel at the left of at most 45 % of the width (never narrower than 17.5rem, 297 px: on a window under 660 px wide, an iPhone SE, 45 % is 255 px, where the kicker's first word breaks in the middle) and the height
of the window, with the same parts, the home showing on the right; the beat's card is the wide window's panel (`placePanelFor`) offered only at widths of at most 45 % of the width (and the same trim to its widest line), the end card the same; the dock is the one row it already was on a short window,
and now it is the whole row (the hour chips are away). No sheet covers the height of the scene. **The type is the scale's: 25.5 px.** That is the one place the scale and the screen disagree (see "Type and size"); a panel 330 to 380 px wide at that size scrolls, with the action bar fixed at its bottom edge. (A sheet follows the beat's time down its words when no voice does; the side panel does not: its head is not stuck, so a panel that scrolled by itself would take "More" out of reach. A known limit: with no voice the reader scrolls it.) **The end card's call to action** is the one thing on that panel that may not be left to the end of a scroll (the heading alone is three lines at that size in a room 190 to 250 px
tall): `EndCard.setSide` moves "See Companion Core" out of the row of buttons into `.st-go`, a bar at the end of the card that sticks to the panel's bottom edge (opaque paper behind it, a hairline above, nearly edge to edge so it is two lines and not three on the narrowest phone), and the other buttons are a stack above it, reached by
scrolling; held upright, or on a wide screen, it is the first button of the row as it always was (the same node moves: no rebuild, a focused button keeps its focus). It is on screen without a scroll at 844 x 390, 740 x 360, 667 x 375 and 568 x 320, and Download Companion can be scrolled to and tapped.

**Safe areas.** Every fixed or absolute edge element honours `env(safe-area-inset-*)`: the top bar, the label chip, the toast, the About dialog and the free-camera bar (as before), and now the dock (centred in the room the insets leave, and narrower by them), the free-camera bar and the About dialog's
width, the chapters panel, the start sheet and panel, a phone's end sheet, and the director's own placement (a probe element padded with the four `env()` values is read, so the wide card's and the side panel's safe area, and the end card's, take the insets in px). `phone.mts` sets the notch with
CDP `Emulation.setSafeAreaInsetsOverride` and checks every one of them. A page only has non-zero insets if it asks for the whole screen, so the player's head script (`room-creator.html`, the `?mode=view` branch only: the editor is untouched) adds
`viewport-fit=cover` to the viewport meta; `?no=cover` leaves it as it was. **Not verified on a device**: iOS Safari and a cutout Android phone were not available; the insets are emulated in Chromium.

**Reduced motion.** The sheets have no transition or entrance animation (`prefers-reduced-motion`), the agent's line has none, nothing scrolls by itself, the tour opens paused and steps; unchanged otherwise.

**Load** (`mediterranean`, the heaviest home, 390 x 844 touch, a real GPU, Chromium; cache off; the machine was shared with other agents' jobs, load average 1 to 3 for the first three runs and 13 to 19 for the rest, so read the shape, not the
seconds). The page's own loading card (the head script's pseudo-elements: the mark, the poster, the home's name, a moving bar) is drawn at the first paint, 0.1 to 0.6 s in (2.3 s on Fast 3G with a 4x slower CPU; `phone.mts` P8 sees it 80 to 180 ms in), before any
module has loaded. Time to ready: **21.1 s median** (22.5, 21.1, 20.7) on the branch against 22.6 and 23.3 on main for the same home (a third main run read 39.8 s when another job started: the pass adds 26 KB raw, about 7 KB with brotli, one
request, `sheet.js`, and moves nothing here); **101.8 s on Fast 3G (1.6 Mbit/s, 562 ms request latency) and a 4x CPU slowdown**, 91.7 s of it before the player mounts. Bytes: 173 requests, 4,349 KB as the local server sends them (HTML 626, 161 modules 3,288, JSON 221, CSS 87, fonts and
images 126), about 1,237 KB with brotli, which is what Cloudflare sends (the Fast 3G run moved the uncompressed 4.3 MB, so about 16 s of its 102 s is bytes production would not send). **Where the time goes** (a CPU profile of the unthrottled load): 76 % of the busy time is
three's `getUniforms`, which is the page's own first `renderer.render` (drawn by `animate()` before the player has mounted) linking about 70 shader programs one at a time and blocking on the driver for each; 12 % is `textures.js` generating the procedural maps; nothing else is above 2 %.
After the player mounts it takes 1.5 to 2 s to be ready (the compile and the first frame). **What was done about it: nothing by default.** The pixel ratio is already `min(devicePixelRatio, 2)` (`room-creator.html`) with an adaptive step-down (`ADAPT`, `?no=adapt`), and only 1.5 to 3 s of the
20 are after the mount, so a lighter tier on touch screens could not move the load; the tour's chunk is already lazy and the 161 modules are the engine's. The one lever the profile points at, not drawing before the player mounts, was tried as a one-line guard in `animate()` and is not in the tree, because
it was not a win on every home: median of interleaved pairs, mediterranean 39.7 s to 10.0 s (5 pairs), cutestarter 22.2 s to 7.6 s (6), aurora 30.5 s to 44.5 s (6), seraphine 34.5 s to 36.6 s (5, noisy); Fast 3G, mediterranean 76.1 s to 68.3 s (1). See README, "Player performance", for what to try next.

**Tests.** `scripts/story/portal-tests/phone.mts` holds every number above, at 390 x 844, 360 x 640 and 320 x 568 (touch) and 844 x 390, 740 x 360, 667 x 375 and 568 x 320 on their side (the last two run five beats, not all of them): P1 the start sheet (at most half the window, the home above it, the action 44 px in the bottom
third, one row of 44 px chips, the disclosure and every owed line in the page and in view when opened, with the primary action still in view under them, no sideways scroll, no text past its card, the scrim veiling the bars it blocks); P2 every beat (at most 40 % or 45 % of the width, off the subject and the bars, inside the window, as tall as its words within 8 px, a one-line kicker, a 44 px More,
the agent's line grows the sheet downward and nothing above moves, the end card never over the Core, a sheet following the beat down its words with "More" in reach); P3 the dock and the top bar (one row; no hour chips, shot chips or speed; the longest home names whole on at most two lines, no word broken, the player's own 14 px; Previous and Next home in More held upright and in the bar on its side; the plain player's name
unchanged and all of the tour's changes back with the flag gone); P4 every control a 44 px target, the focus order and a visible ring; P5 safe areas with the notch's insets; P6 reduced motion; P7 no layout shift from the page being ready to the first beat's sheet; P8 the loading card on screen at once; P10 the More sheet inside the window with every row reachable,
and the end card's call to action on screen without a scroll with a tap landing on it, and Download Companion reachable by scrolling, at every size. `pnpm run portal:test -- --only hooks --hook phone` (`PORTAL_GL=default` for a real GPU). The fine-print lines it expects are the ones the claims owe the card today (the beta sentence went with #49).

## Rules worth knowing

- **Audio never starts before a gesture.** The start card has "Start with narration" and "Start without sound" (a shared `?beat=` link says
  "Play from here"). The `AudioContext` is made inside the click (or the key press for Space/Enter on the button, or M later). "Start without
  sound" never makes one and fetches no `.m4a`. Nothing is prefetched until sound is chosen.
- **The clock.** While a clip sounds, the picture follows the voice (drift over 0.12 s moves the picture). Muted, it is the player's wall clock. Durations
  are the voice lock's either way, so a tour with sound and one without take the same time.
- **The subject.** A beat's subject is its baked box projected through the camera. A room, a lawn or a street (over 3.2 m), or a box that
  would fill 45 % of the window, is replaced by the pin zone: a square of 24 % of the short side round the aim point. The card keeps under
  2 % off the subject, off the Core in the first chapter, and off every bar.
- **Phones (under 768 px).** The card is a bottom sheet of at most 40 % of the height (it was 55 %, and 38 % before the type grew; a tablet held upright, 768 to 999 px wide and taller than wide, takes the sheet too; "On a phone" below). If that covers the subject: the same sheet under the top
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
- The shot chips are hidden while a tour runs (`html[data-story] .vh-shots`): the chapters replace them. The hour chips stay on a wide screen; on a phone they go too ("On a phone").

## Tests

`scripts/test-story-url.mts` (Node, no browser) holds the address parsing; `scripts/story/portal-tests/family-failures.mts` the failure card;
`scripts/story/portal-tests/player.mts` (run by `pnpm run portal:test`, alone with `-- --only hooks`):
T6 placement for every beat of two families (the exemplar and one whose house has no TV) at 1440 and 390 (a phone's sheet at most 55 % of the height), chapters list length, live text,
end card; T7 keys, focus, live region, captions on screen while a clip sounds, the start card, end card and chapters panel audited at 1440 and 390
(axe-core is MPL-2.0 and the repo does not take it, so an in-page audit stands in: names, labelled dialog, ids, contrast against the worst
background, 44 px targets on touch); T8 the gesture rule and `?no=story`; contrast of the lit card, the top bar, the dock, the tools sheet and the About dialog at 390, 768 and 1440 (the glass over pure white and pure black); the address bar; reduced
motion; the failure paths; next family.

`scripts/test-story-sheet.mts` (Node, no browser, quick) holds a phone's beat-sheet solver (`assets/story/sheet.ts`): at most 40 % of the window whatever the content, as tall as the content when it fits, under the subject or under the top bar, never over the subject (200 random ones), the notch's x and width, the variant that shows the most, the type floor, and place.ts's 55 % still the end card's. `scripts/story/portal-tests/phone.mts` is the phone in a browser (above).

`scripts/test-story-place.mts` (Node, no browser) holds the solver: the type floor (25.5 px, the phone clamp, the film's 36), the card width, the variants (a type under the floor is refused, padding may shrink), the panel's sweep over random subjects, the phone's sheet at 55 %, the end card.
`scripts/story/portal-tests/typography.mts` (T13): at 1440, 1024 and 390, every text node of the start card, three beat cards (the first, a film beat, one with "More" open), the end card, the About dialog and the failure card is at least 25 px (20 px on a phone); every person's name in them and on the family page (light and dark) is uppercase by CSS, bold and tracked at least 0.15em, at the reading size, with the real name in the text and the aria-label; the family page's names are 4.5:1 against their page; the screenshot dialog's text and buttons; a card is the solver's 360 to 560 px trimmed to its widest line (never wider than `data-solved-w`), a sheet at most 55 %. T13b (the glass pass): on the three Brennan tours at 1440, 1024 and 390, the start card, the first three beat cards, one with More open, the end card, the chapters panel, the tools sheet, the About dialog, the top bar and the dock: only 5 px and 3 px corners, no nowrap or ellipsis in a card, no text line or box past a card's padding box, at most 3 px spare at the right of a card's widest line (a phone's sheet is full width), under 2 % of the subject covered, a stuck head that is opaque.

`scripts/story/portal-tests/player-start.mts`: T9 the way in at a person, the campaign's tags in the address, daylight, the end card and Next family; T10 the captions-only tour (the audio checks of T7 and T8 in `player.mts` run for a family that has a voice and say so when none does).

`scripts/story/portal-tests/player-more.mts` (story v2): T11 the start card's home line; the real logo on the app chip (1.3 times the card's type, the file the story names, decoded); no screenshot in the tour; for every beat of the first tour that has details: the toggle is
there, opens to the beat's before and after and closes again, the open card keeps under 2 % off the subject at 1440 and at 390 is never above 55 % of the height and covers no more than the closed one did; a beat with no detail has no toggle;
the button is 44 px, outside the aria-hidden words; Enter, Space, Esc and a click; opening it pauses; the next card opens closed; reduced motion.

## Not verified

Safari/iOS audio (the context is made in the click, which is what iOS needs, but no iOS device was used); listening quality; the placement across
all thirty families (only the test fixtures exist; look at a contact sheet per family when they are baked); a screen reader.

On a phone (the mobile pass): no real device was used, only Chromium with touch and a phone's size, a notch emulated through the DevTools protocol and a real GPU; Safari's engine
(sticky inside a scrolling card, `details`, `viewport-fit=cover`) and a cutout Android phone are not covered. The start sheet for a tour WITH a voice (two buttons in the action bar) is
built the same way and tested by its DOM, but no family has a voice lock yet, so it was not looked at. A 40 % sheet on a window shorter than about 700 px (an iPhone in Safari with its bars is 390 x 664) is 266 px
and nearly every beat scrolls inside it (the follow-scroll carries the reader); that is the owner's cap meeting a short window, and the number to revisit if it reads badly there.
