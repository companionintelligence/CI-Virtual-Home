# Family films: how they are made, checked and hosted

Every family has a short film of about 90 seconds in two shapes, 16:9 (1920 x 1080) and 9:16 (1080 x 1920), at 30 frames a second. It is made by
`pnpm run story:film` from the family's own files, on this machine, with the repo's own renderer and the voice the live tour already speaks. It
is not a screen recording of the tour and it is not a second tour: it is the same camera and the same words, edited to the beats the story flags `"film": true`.

```bash
pnpm run build                                       # the page modules (assets/**/*.ts -> .js)
pnpm run story:film -- vance-takahashi               # both shapes of one family
pnpm run story:film -- --all                         # every family that has a bake lock (skips the ones films.json says are current)
pnpm run story:film -- <slug> --aspect 9x16          # one shape
pnpm run story:film -- <slug> --master               # also keep the CRF 18 master in video/families/master/
pnpm run story:film -- <slug> --res 540              # the same picture at a quarter of the cost, to look at
pnpm run story:film -- <slug> --stills <dir>         # single frames (title, each film beat, end card) + the card placements, no film
pnpm run story:film -- <slug> --dry-run              # the sound, the captions and the timeline only (no GPU)
pnpm run story:film -- <slug> --silent               # a captioned film with no sound (no voice lock needed; see Silent mode)
pnpm run story:film -- <slug> --probe                # 3 s of the first film beats at 540 p: seconds a frame, the renderer, a projected time (see The probe)
pnpm run story:film -- <slug> --gl software          # the repo's SwiftShader flags (the CPU: hours a film); the default is the machine's GPU (see The GPU)
pnpm run story:film -- --all --jobs 1 --force        # --jobs is families at once in ONE browser; keep it at 1 on a shared machine
```

A family can be filmed once it has `content/families/<slug>.json`, `.voice.json` (`pnpm run story:voice`) and `.bake.json` (`pnpm run story:bake`), the bake made
from that voice lock. A film with sound refuses estimated durations. A family with **no voice lock** is filmed **silent** on its own, with a notice (next section); `--silent` asks for it.
One GPU process of its own, `--jobs 1`; it retries a family once on a fresh page after a timeout or a browser crash.

## What a film is

| Seconds | What | Notes |
|---|---|---|
| 0 to 4 | **Title card** | the tour's own exterior approach to the front door (the first seconds of the FTUE track) under a rising scrim: "The Surname family", the fictional address, the tagline, and **Fictional family. Real software.** in view from the first half second. No voice |
| a dip of 0.35 s | joins every pair of scenes | the old picture fades to ink over the first half, the new one in over the second; the camera cuts in the middle |
| the film beats | **the flagged beats**, in story order | the camera is `trackFrameAt(track, tourSecond)`: the live tour's camera, read at the tour second each film second plays. A beat after a skipped one cuts in as its voice begins; a beat after a film beat walks in as the tour does. The beat's recorded narration and (if it has one) the agent's line sit at the bake lock's offsets |
| last 15 s or so | **End card** | the same exterior move played backwards (a pull-back) under the closing words; after the last word, a panel: **UnCloud your life.**, `ci.computer/core`, the fictional line, and the disclosures below. It holds at least 5 s |

**On screen.** The *popup card* shows who is in the scene and which companion helps (a monogram disc, never a face), the title, the app chips and the one-line note, and for the
first-run beats a stylised phone screen (a panel under the note: a header and up to four rows, each ticked off as the narration reaches it). The narration itself is the *caption strip* (the popup body is the
narration, bible R2: one source of text), burned in as open captions with a karaoke highlight; an agent's line shows its speaker and the word *Scripted*. A leader
line and dot point at the subject. A small corner mark, **Fictional family. Real software.**, stays on every frame except the two that carry the line large.

**Type (live pass 3).** The owner asked for 36 px text in the modals and then, seeing it, for 30 percent less (the canon's 1.5rem of the 17 px root: 25.5 px). The live cards took the
correction. **The canvases did not**: a film frame is a picture shown scaled down (a 1080 px canvas is about 390 px wide on a phone, a 0.36 scale), so its 36 design px (at the 1080 px short edge, times the frame's `k`) is already
smaller on screen than the live modal's 25.5 px. `CANVAS_TYPE_MIN` (assets/story/place.ts) is the one number; if the owner wants the canvases down by the same 30 percent it is that constant (27) and the fits below, nothing else.

| What | Design px (1080 short edge) | Weight | Before |
|---|---|---|---|
| a card's kicker (the name), "with <companion>", the chips, the note, the phone screen's header and rows | 36 | 700 (the name, caps, tracked 0.2em, sage), 500, 600, 500, 700 and 500 | 27 to 29, 23, 24, 19 |
| a card's title | 56 | 800 | 40 |
| the monogram disc | 60 across, its letter 36 | 700 | 46 across, 24 |
| the corner mark | 36 | 700 | 26 |
| the caption strip, and an agent's speaker row and its "Scripted" | 40 (portrait) and 44, and 36 | 700, 700, 600 | 40 and 44, 25 and 20 |
| the title card: the family's name (a kicker, fitted down from 92, at most two lines), the address, the tagline, the fictional pill | 92 to 38 (78 portrait), 42, 38, 36 | 700 caps tracked 0.2em, 700, 500, 700 | 92, 42, 34, 32 |
| the end card: the sign-off, the address, the fictional pill, every disclosure | 100 (80), 52 (44), 36, 36 | 800, 700, 700, 500 | 100, 46, 32, 26 |

A card is **a third of the canvas wide and never narrower than 18 em of the floor** (648 design px at 16:9; the live card is 32 percent of a window, 18 em at 1440 px), then 92, 85, 78 and 72 percent of that, none under 12.5 em, and a width that cannot
hold its widest chip is dropped. **The type never shrinks to fit**: the old "level 1 and 2" (0.86 and 0.74 of the type) are gone. A card is offered as *variants* (its width with padding as designed, the same with padding at 0.68, narrower and so
taller, and, for a first-run beat, the same without the phone screen, its words kept as the note) and the solver (`placeCanvasCard`, layout.ts, over place.ts) refuses one whose type is under the floor and takes the first that clears the subject. A card
cannot scroll on a canvas: one taller than its room is not ok.

**The name is a kicker** (as on the live cards): capitals by drawing (the story's string is never changed, so the captions, the WebVTT and every report keep "Sally"), 700, tracked 0.2em, in the sage; "THE BRENNAN FAMILY" on the title card the same, fitted
to two lines at most. Canvas2D tracks with `ctx.letterSpacing` (the rendering Chromium has it); where it does not, the same letters are drawn one by one at a fixed advance (`kickWidth` and `drawKick` measure and draw by one rule either way), and
`scripts/film/canvas-fit.mts` measures both against each other.

**The card never covers the subject.** Placement is story-bake's solver (`assets/story/place.ts`, the same function the live popup calls), solved once per beat against the beat's rest
pose, with the floor of this canvas. If the full card would cover more than 2% of the subject, the variants above are tried in order, then another slot (the edge panels the live card has are on too). A 9:16 card is a sheet on top of the captions,
or under the corner mark if that clears the subject. `--stills` writes each beat's placement (slot, variant, overlap) to `<slug>/<aspect>.cards.json`.

**Safe areas.** 16:9 keeps 54 px top and bottom and 96 px at the sides. 9:16 keeps 200 px at the top and 340 px at the bottom clear (a phone's own interface covers them) and 72 px at the sides. The title card and the end card now keep the
bottom margin too (the portrait panel used to take a third of the band); a layout outside the safe area stops the render (`info.unsafe`).

**Accessibility.** The words are always on screen (burned captions), and also written as WebVTT from the same cues. Contrast: text `#e8f2f4` on 88% ink glass is over 10:1 at its worst; the muted note
`#a3babf` over 6:1; the not-yet-spoken caption word `#9db4ba` over 5:1; the spoken word on the sage highlight is ink on `#c5e8dc`, 13:1. Nothing flashes: the dips are 0.35 s fades.

**Honesty.** Disclosures are printed from `content/story/claims.json`, never typed in a family file: the fictional line on the title card, the corner mark and the end card; beta
(*Companion OS, Companion Memory and Companion Agents are in beta.*); scripted scenes; the Core drawn as a stylised illustration; the synthetic, locally generated voice; and, only when a film beat names an
agent, *Hermes is from Nous Research. OpenClaw is from the OpenClaw Foundation. Companion Hub packages both.* No price, no ship date, no performance number, no customer quote.

## Silent mode

`--silent` makes the same film without a voice: **captioned, no audio stream**. It is the way to film a family before Kokoro is installed (the voice is a 3 GB model download that is the owner's to approve),
and it is what `story:film` does on its own, with a printed notice, for a family that has no `<slug>.voice.json`. A family with a voice lock is filmed with sound unless `--silent` says otherwise.

* **Inputs.** `content/families/<slug>.json` and `.bake.json` only. A bake lock with `durations: "estimated"` is accepted **only** here: a film with sound still refuses it
  (`filmClock` throws "the film needs the recorded voice" unless it is given `{ silent: true }`).
* **The clock and the captions.** `silentStory(rs)` (`assets/story/film/layout.ts`) gives every line the film captions (each beat's narration, an agent's line, the closing) a length of the estimate the bake used
  (`estimateMs`, 150 words a minute, the same function `runtime.ts` joins the lock with) and no word timings, so `captionCues` shares each clip's length among its words by their size and the karaoke highlight runs
  across the estimated clip. A beat's own offsets (`speechAt`, `sayAt`) are the bake's. A clip the lock really recorded is kept: a voiced bake can be filmed silent and the picture is then timed by the real voice.
  The page (`index.ts`) and the script both call `silentStory`, a pure function, so they agree on the clock.
* **Captions are burned in** exactly as in a voiced film, and the WebVTT is written from the same cues (`captions.<hash10>.vtt`), so the open item below ("`<track>` should not be `default`") applies unchanged.
* **No sound, no sound gates.** The encode has one input and `-an` (no audio stream at all). The gates that stay are the picture's: `ffprobe` (exactly one H.264 `yuv420p` stream, the right size, 30 fps, exactly the
  frames the clock says, the length within 0.15 s of the clock and at most 110 s), `freezedetect`, and the 24 MiB size guard. The AAC, silence (dead air) and loudness gates are skipped.
* **Caption legibility** (the "painted-pixel type audit" the ad kit uses is already the film's): every frame's overlay is audited as it is drawn and the render fails if the smallest type painted is under the 36 design px
  floor (`typeAudit`, the captions included). On top of it `captionProblems` (`scripts/film/lib.mts`) checks the cues before any pixel is drawn: none ends after the film, none overlaps the one before, none holds a three-word line
  for under 1.5 s, and the reading speed (characters a second) is a warning above 21 and an error above 30. At the estimate's 150 words a minute a caption needs about 13 characters a second, so this is the check that
  the estimate is a slow enough clock to read by. `--dry-run` prints the maximum.
* **The end card** carries every disclosure it carries today except the synthetic-voice line: claims.json places that on the end card of a film with narration, and saying a voice was generated under a silent film would be false.
  (The words are claims.json's, read through `filmText(rs, claims, { silent: true })`.)
* **films.json** records `"sound": false` for the entry and **no `loudness`** on its aspects (`filmsProblems` enforces both; an entry with no `sound` is a film with sound, as before). The web file is
  `<slug>.<aspect>.silent.<hash10>.mp4`, so a silent film and a voiced film of one family never share a file name and one can never overwrite the other (the gates' report is `<slug>.<aspect>.silent.report.json`, a rejected
  one lands in `rejected/` under the same name). `inputsSha` includes a "silent" marker, so a family that gets its voice later is stale, and `story:film` renders it with sound. films.json holds one entry a family: the voiced film replaces the silent one.
* **The ship step** (`scripts/story/ship/films.mts`) is unchanged in what it does: it links `FILM_BASE_URL/<file>` for each aspect, the poster and the captions, checks `filmsProblems`, and compares `inputsSha` with the right mode
  (`loadFamily(slug, { silent: entry.sound === false })`). A silent film is still a film.

## The GPU

`story:film` used to launch Chromium with the repo's Linux flags, which are SwiftShader (software GL on the CPU: hours a film). It now takes the ad-cut renderer's choice (`glArgs`, `glMode` and `chromiumFor` of
`scripts/film/ads-lib.mts`, the same helpers `scripts/render-persona-cuts.mts` uses): **`--gl default`** (the default, or `FILM_GL=default`) lets ANGLE pick the machine's own GPU (the Intel iGPU here), **`--gl software`**
is the repo's own SwiftShader flags. Never `--use-angle=vulkan` (blank frames on the NVIDIA here). The page's WebGL renderer string is printed; under `--gl default` a string that says `swiftshader`, `llvmpipe` or `software`
is a warning (the GPU path fell back to the CPU: this will be slow). **A blank first frame stops the render**: the page reports the luma spread of the room before the overlay is drawn (`stats()`, as the cut renderer
does), a first or last frame under `BLANK_STD` fails the film at once, and more than 5 percent blank frames fail it at the end, because the overlay alone would make a flat picture look like a film. When Playwright's own Chromium is
not installed the newest one in `$PLAYWRIGHT_BROWSERS_PATH` (or `~/.cache/ms-playwright`) is used. A different GPU draws different pixels, so a film is a picture made on one machine profile, not a golden (Determinism, below).
`scripts/story-bake.mts` has its own flag (its `--stills` path); this one is the film's.

## The camera gate

A film is rendered only from a family whose tour passes `pnpm run story:spline` ([spline.md](spline.md)): `story:film` grades the family's bake lock first (about 70 ms, no browser) and stops with the first failing rules and their beat ids.
`--no-spline-gate` renders anyway; `--stills`, `--dry-run` and `--probe` are exempt, so a failing camera can still be looked at.

## The probe

`pnpm run story:film -- <slug> --probe [seconds]` measures instead of guessing. It renders N seconds (default 3) from the first film beat and 1.5 s of the title card at `--res` (default **540**), encodes the beats to a silent mp4,
then repeats a short run (18 frames of each) at 1080 p, and prints the seconds a frame in the rooms and on the title card (the exterior is a different cost), the renderer string, and a projected time for the full 1080 p
two-aspect film: the film's rooms and title/end-card frames, each at its measured cost, plus one house build and a composer warm-up per aspect. Output goes to `$CI_FILM_PROBE_OUT` (default `video/families/probe/`):
`<slug>.probe.<aspect>.r540[.silent].mp4`, the first and last frame as JPEG, and `<slug>.probe.json`. It writes nothing to `content/families`. The numbers are the machine's at that moment (other sessions share the GPU): read them with the load average
in the JSON, take the median of a few runs, and treat the projection as an estimate with that spread.

## Files

```
assets/story/film/layout.ts    the clock, `silentStory`, the audio placements, the caption cues and WebVTT, the two frames, the canvas card placement (`placeCanvasCard`, the one the ad cuts share). Pure: Node tests it
assets/story/film/cards.ts     Canvas2D: the type table (`TYPE`, `FLOOR`), the name kicker, the type audit, the popup card, the phone screen, the title card, the end card
assets/story/film/overlay.ts   Canvas2D: the corner mark, the karaoke caption, the leader, the dip
assets/story/film/index.ts     the page module: registers the film as a shot preset (frameAt over film seconds), draws frame i, returns a JPEG
scripts/render-family-film.mts the CLI: `--silent`, `--gl`, `--probe`
scripts/film/{lib,mux,qa}.mts  families and films.json (and the silent caption checks) / the sound and the encode (silent: no audio) / the gates (silent: the picture's only)
scripts/film/canvas-fit.mts    the type floor and the fit of every family's film and ad cuts (browser, no house, no GPU): `node --experimental-strip-types scripts/film/canvas-fit.mts`
scripts/story/ship/films.mts   the site build's step: registers posters and captions, links the hosted films
scripts/test-film.mts          28 tests, no GPU (the sound and silent-encode tests need ffmpeg and skip without it)
scripts/film-bookends.mts      optional CI-Common bookends (off; see below)
```

Outputs:

| Where | What | In git |
|---|---|---|
| `video/families/web/<slug>.<aspect>.<hash10>.mp4` | the web film: H.264 High, CRF 28, `maxrate 1500k`, `bufsize 3000k`, `+faststart`, AAC 64k mono, content-hashed name | no (gitignored like `video/houses`) |
| `video/families/web/<slug>.<aspect>.silent.<hash10>.mp4` | the same with no audio stream (silent mode) | no |
| `video/families/master/<slug>.<aspect>.mp4` | with `--master`: CRF 18, AAC 128k stereo | no |
| `video/families/<slug>.<aspect>[.silent].report.json` | the gates' numbers, the card placements, the clip offsets, the wall time | no |
| `content/families/<slug>/film/poster.<hash10>.jpg`, `poster-9x16.<hash10>.jpg` | the posters (the title card at 3.2 s; 1280 and 720 px wide) | yes |
| `content/families/<slug>/film/captions.<hash10>.vtt` | WebVTT, one file for both shapes | yes |
| `content/families/films.json` | per family: `sound`, duration, `inputsSha`, the vtt, and per aspect the file name, sha256, bytes, size, duration, poster, loudness (none for a silent film) | yes |

`films.json` keeps no timestamps and no absolute paths. `inputsSha` hashes the story, voice lock and bake lock files, the film code and `claims.json`, and the frame size: a changed
input makes the film stale, and `story:film` renders only the stale ones (`--force` renders anyway). The site build warns when a film is older than its story.

## The sound

The same m4a files the tour plays (the voice lock's `file`, each checked against its `sha256`) are decoded to 24 kHz mono and placed on a silent timeline at the offsets
`placements = part.at + (beat.speechAt - part.from)`; a clip that would start before or end after its part of the film is an error, not a clip that bleeds into the next beat. The timeline is resampled to
48 kHz and normalised by the two-pass method of CI-Common's `loudness.ts`: measure with `loudnorm`, apply it linearly (a gain, no compression), then a true-peak limiter at -2 dBTP so the AAC encode, which overshoots its own
samples, lands under -1 dBTP. Target -14 LUFS integrated. `-fflags +bitexact`, `-flags +bitexact`, `-map_metadata -1`: the same samples give the same bytes. The title card has no voice and
the end card holds in silence after the last word; there is no music (nothing to licence).

## The gates

A film that fails one is moved to `video/families/rejected/` and is not recorded in `films.json`. About sixty lines of the kit's logic, lifted, not imported (`scripts/film/qa.mts`):

* `ffprobe`: exactly one H.264 `yuv420p` video stream of the right size at 30 fps with exactly the frames the clock says, and one AAC stream (mono for the web film); the length within 0.15 s of the clock; at most 110 s (a warning under 75 s)
* `silencedetect` (-45 dB): no silence of 2 s or more except the title card and the end card's hold; 1.25 s or more is a warning. Beat length follows the voice clip, so there is no dead air by construction
* `freezedetect`: no frozen picture of 2 s or more
* loudness: integrated within 1 LU of -14, true peak at or under -1 dBTP, measured on the encoded file
* size: a web film over 24 MiB fails (Cloudflare Pages caps a file at 25 MiB). 110 s at the 1.5 Mbit/s cap is about 21 MiB, so this is a guard, not a hope

Before the render, the plan refuses a film over 110 s (naming the longest beats to unflag), a clip missing from the lock or not matching its hash, and a bake made from another voice lock.

## Determinism

Frame `i` is `__houseRenderFrames(i)` plus an overlay that is a pure function of the film second, so frames are random access and a fresh browser draws them again identically; the camera is
`trackFrameAt`, a pure function of the tour second and the aspect; the encode is bitexact and single-threaded (`-threads 1`): with four threads libx264 gave a different file from the same frames on every run, measured by encoding the same 241 JPEGs three times, and with one thread it gave the same bytes every time. Encoding is not the slow part, the render is. Two fresh runs give the same mp4 **on one machine profile** (the Chromium build in
`test/goldens/<profile>/PROFILE.json`, the GPU and the FFmpeg build). Offline rendering is untouched: nothing here edits `room-creator.html`, `assets/shot-*.ts` or `house-builder.ts`, and the goldens do not move.

## Hosting (owner decision)

The films **cannot live in git or on the Pages deploy**: about 18 MiB each, 60 of them is about 1 GB, Pages caps a file at 25 MiB, and CI has no GPU or LFS to make them. Upload
`video/families/web/*.mp4` (they are content-hashed, so cache them for a year) to the host the owner chooses (R2 with a public bucket, or Stream) and build the site with

```bash
FILM_BASE_URL=https://films.example.com/f pnpm run portal:build
```

`scripts/story/ship/films.mts` then links `FILM_BASE_URL/<file>` for each family that has an entry in `films.json`; with the variable unset no family page shows a film. The captions (a few KB) and the 16:9 poster
ship with the site and are same-origin, so the `<track>` needs no CORS. If the films are hosted on another origin the site's Content-Security-Policy must allow `media-src` for it (landing-site's `portal/_headers`).

## Open items for the owner

1. Choose the film host (R2 or Stream) and the address for `FILM_BASE_URL`.
2. The burned captions and the WebVTT say the same thing: the family page's `<track>` should not be `default`, or a viewer sees them twice.
3. Landing-site's `scripts/story/pages.mts` prefixes a film URL with `../`; a hosted film's address is absolute, so it needs to leave an `https://` address alone (a one-line change in that file, not in this package).
4. FFmpeg here is a GPL build with libx264; the films contain only its encoded output. Flagged for counsel with the espeak-ng note in THIRD_PARTY.md, with AAC patent licensing.
5. The ci-video bookends are not wired (below).

## Bookends (optional, not wired)

`CI_VIDEO_KIT=/path/to/CI-Common/packages/video-kit node --experimental-strip-types scripts/film-bookends.mts` finds the kit and runs its `doctor`. With the variable unset it prints that it
was skipped. It does not yet make per-family intro and outro cards: that needs a kit project per family and has not been built or run. The film's own title and end cards are complete without it.
