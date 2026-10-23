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

**Honesty.** Disclosures are printed from `content/story/claims.json`, never typed in a family file: the fictional line on the title card, the corner mark and the end card; scripted scenes; the Core drawn as a stylised illustration; the synthetic, locally generated voice; and, only when a film beat names an
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
scripts/story-film.mts         the door: `story:film` runs the film script, or the plates with --plates (the film script is not edited and does not know the plates)
scripts/film/wrap.mts          the compliance wrap around CI-Common's video-kit (the one file of scripts/film/ the film's pin skips: NOT_FRAME_CODE)
scripts/film/plates/           lib.mts (segments, keys, the manifest, the words), cli.mts (`--plates`), render.mts (the browser and ffmpeg), fleet.mts (the queue), schema.mts and the kit's schema (a copy)
assets/story/film/plates/      index.ts (the page: frame i with no overlay), format.ts (sizes), compose.ts (the tilt that clears the kit's text)
scripts/test-film-plates.mts, scripts/test-film-wrap.mts   the plates' and the wrap's tests (no GPU; the kit's own contract test runs when $CI_COMMON_KIT is set)
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

`films.json` keeps no timestamps and no absolute paths. `inputsSha` (the pin) hashes the story, voice lock and bake lock files, the film code, the text of the `claims.json` disclosures this film prints
(`filmDisclosureIds`: the fictional line, the end card's lines; the synthetic-voice line only in a film with sound, the attribution line only in a film that names Hermes or OpenClaw), the lighting and the frame size: a changed
input makes the film stale, and `story:film` renders only the stale ones (`--force` renders anyway). Nothing else of `claims.json` is in it (the lander's `rent-line`, a disclosure's source, status or note, a disclosure only the site prints),
because none of it can change a frame. The pin has ONE definition, `inputsShaOf` in `scripts/film/lib.mts`: the renderer writes it and the site build's freshness check (`entryIsCurrent`, which accepts either permitted lighting, since an entry
does not record which it was lit at) reads it, so the build warns "older than its story" only when a film really is. `scripts/test-film.mts` holds both to it, and fails when `filmText` reads a disclosure the pin does not hash.

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

## Plates and the home-tour wrap

A film made by `story:film` is one picture with its words drawn on it. CI-Common's video-kit (`ci-video`, 0.35.0, CI-Common #429) composes films from **plates** instead: a clip of the 3D picture with nothing drawn on it, one
per beat and aspect, and a JSON file, `plates.json`, with the words. The GPU pass (about 0.4 s a 1080 p frame, three quarters of an hour a family for both aspects) is then done once, and the words, the captions, the end
card, the cuts for a feed and the style change in minutes on the CPU. The two programs share nothing but the file: this repository never imports the kit and the kit never loads this repository's code.

```bash
pnpm run story:film -- brennan --plates                # one family: plates/<aspect>/<beat>.<key>.mp4 and plates.json, under video/plates/brennan/
pnpm run story:film -- garden-flat --plates            # a home with no family (the six apartments): its own shots, see "A home with no family"
pnpm run story:film -- brennan --plates --res 540 --gl nvidia   # a draft at a quarter of the pixels, on the discrete GPU
pnpm run story:film -- brennan --plates --dry-run      # the plan: every plate, its key and whether the disk has it; no browser
pnpm run story:film -- brennan --plates --only ftue-join --res 360   # one plate, to look at it (no plates.json)
pnpm run story:film -- brennan --plates --probe 2 --gl default,nvidia --res 540   # what a frame costs on each GL path
pnpm run story:film:wrap -- brennan --quality draft    # the kit: import-home, build, check, render, then the checks of this repository
pnpm run story:film:fleet                              # every family and home: the 540 p draft pass, then the 1080 p final one
```

`story:film` without `--plates` is `scripts/render-family-film.mts`, run as it was (`scripts/story-film.mts` is the door and sends `--plates` elsewhere). Nothing in this section is a video in git: `video/plates/`, `video/plates-draft/`,
`video/kit/`, `video/kit-draft/`, `video/queue.json` and its logs and report are under the ignored `/video/*`.

### What a plate is, and the one rule that keeps the films safe

Plate frame *i* is film frame *i* without the overlay: the same camera (`presetFromFilm`, imported from `assets/story/film/index.ts` and not changed), the same clock (`filmClock`), the same `__houseRenderFrames(i)`, the same draw
onto a 2D canvas and the same JPEG, so a plate is a function of the tree and of *i*, random access, and a crashed run resumes at the next beat. The page module is `assets/story/film/plates/index.ts`. A plate is H.264 yuv420p BT.709,
CRF 15, one thread and bit-exact (the same frames make the same bytes: tested), no audio, no metadata.

**The plates never move a film on record.** The film's pin (`toolSha`, `films.json` `inputsSha`) hashes `assets/story/film/*.ts`, `scripts/film/*.mts`, the film script, `track.ts` and `place.ts`. The plates' code is in two
subfolders that list never walks (`scripts/film/plates/`, `assets/story/film/plates/`), the door `scripts/story-film.mts` is outside it, and `scripts/film/wrap.mts`, which runs after the plates on the kit's output, is the one file of
`scripts/film/` that `NOT_FRAME_CODE` (lib.mts) tells the pin to skip. `scripts/test-film-plates.mts` holds all of it: every entry of `films.json` is still current under the pin, the pin reads no plates code, no film module
names the plates, and `story:film` without `--plates` is the film script. (Adding `NOT_FRAME_CODE` edited `lib.mts`, which holds the pin, so the three `inputsSha` values were rewritten once, in their own commit, with the proof:
every other file the pin hashes is byte-identical to the base, and each stored pin equals what the base code made of the film's inputs. No film was re-rendered.)

### Segments, keys and the cache

A family's plates are the **approach** (the title card's picture, the first 4 s of the film's clock: the tour's move to the front door) and one plate per beat the film plays (`film: true`), each its span of the film's frames
`[f0, f1)`, so the dips between scenes, the end card's pull-back and every card are the kit's to make. For each plate and aspect the key is a hash of the house spec, the engine (`assets/**/*.ts` except the story player, the editor chrome, the
scene checks, the plan export and the viewer, the vendored three.js and `room-creator.html`), the film modules a frame passes through and the encode, the GL path and the Chromium build, the size, the frame rate, the light, the frame count, the camera of every
frame of the span (eye, target, field of view and roof, to 0.1 mm, after the tilt below) and when the Core powers on. **No word is in a key**: a rewritten caption, chip, title or disclosure is a manifest change, and `story:film -- <slug> --plates`
then draws nothing (about a second, no browser) and writes a new `plates.json`. `video/plates/<id>/cache.json` records what each file was made from; a plate is current when its file is the bytes recorded and its key is the plan's. A door opens once, at
the first crossing of the *whole* path, so a segment is also current only if the door angles the path plans for its frames are the ones it was drawn with (compared when the camera path moved). Files whose key has gone are removed when the
manifest is written. `plates.json` is written last, atomically; every plate is hashed as it is written.

### Composed for the kit's text

The tour's camera was composed against the tour's own cards. The kit lays its caption, its burned subtitles and its label over a plate from its own numbers and **refuses a film whose text covers more than 2 percent of the
rectangle the plate declares it is about** (no override). Measured on the Brennans' first plates, in 16:9, the kit's subtitles alone covered 22 to 28 percent of the subject in six of eight beats (a person at a phone and a desk reach the bottom
of the frame in the film's own camera, where the film's karaoke strip also sits). Three things fix it without touching the bake, the tour or the film: the plate's **cues are cut to one line** (42 characters, the kit's width in 16:9, so
its subtitle box is one line tall instead of two; a long sentence is broken at the end of a phrase, never after "no" or "the": the pilot's subtitles were cut at the middle word and the break now looks for the pause); the plate's **camera is turned down** just far enough to carry the subject up the frame, clear of the band (`assets/story/film/plates/compose.ts`, `composeBeat` in lib.mts; at most 14 degrees, the picture looks tipped
past it); and where the anchor cannot be carried clear (its box fills the frame: the camera stands in the room the beat is about) the plate is **about the point the tour looks at**, a third of the frame about the beat's focus, which the plate's `camera` record says (`subjectKind: "focus"`).
The declared `subject` is the rectangle after the tilt, the tilt is in the plate's `camera` record and in its key, and the table of where the kit's text begins (`KIT_BAND`) is held to the kit's own numbers by a test that runs when a kit is at hand. Portrait
needed little or no tilt (the bake leaves 340 px at the bottom). Over the 30 families (723 plates in the three aspects) 273 are tilted and **16 cannot clear the band**, all of them the `ftue-delivery` beat (a box at the front door beside the camera) of
the pass-1 families: the kit will refuse those films until that beat is re-composed. Every plate of the three Brennan films clears it, and the kit's own gate finds none of its text on a subject in any of them.

**Not yet composed for the cuts.** The 15 s and 30 s cuts use the platform-safe band in portrait (the kit lifts the caption 672 px up), which begins far higher than the film's; the plates are composed for the film's band. The kit's static gate found
one scene of one cut over it (`brennan-hollin-30`, `living-session`, 3 percent). Composing the portrait plates for the higher band is the next step, once the kit's cuts render (next section).

### plates.json (v1) and what goes in it

The contract is CI-Common's `packages/video-kit/PLATES.md`; `scripts/film/plates/virtual-home-plates.schema.json` is a copy of its schema (CI-Common 86b0a69b) and `scripts/film/plates/schema.mts` a zero-dependency checker for it, so a manifest is held
to the closed contract without the kit installed. Per family film: `id` the slug, `displayName` "The Brennan family of Wrenfield", `lighting` `day` (the owner's ruling of 2026-10-22: films are lit as day), `fps` 30, `profile` (Chromium, the GL
renderer string, ffmpeg), `text` (the label "Fictional family. Real software.", the end card's "UnCloud your life.", "See Companion Core", `ci.computer/core`, and the disclosures of the *silent* film resolved from claims.json through the film's own
`filmText`: the fictional line, scripted scenes, the stylised Core, and the agents' attribution when a film beat names Hermes or OpenClaw; **no beta line anywhere**, and no synthetic-voice line because a plate film has no voice),
the hook "Stop renting your intelligence." (claims.json `rent-line`, only while it is not on hold, `renting` in the accent), and per beat: the member (their name is the kicker; the set-up beats belong to no one), the popup's title and body, the cues on the plate's
clock (an agent's line marked "(scripted)" on its first cue), the chips and for each plate its file, hash, length, size, subject rectangle and camera. A **chip** is an app of the beat (`app` then `with`) by its catalog name, with the real logo
from `content/story/app-media.json` copied beside the manifest under its own hash (an app with no logo is shown by its name alone, never a stand-in; a logo is only ever beside the name) and the pair "<app>, alternative to <service>" only when
`scripts/story/lib/pairs.mts` lets a page show that pair for this family (never "replaces", never a pair on `hold`, one description per app across the film). An app that is not in the live store is left out, with a note. **Labelled
screenshots** (`inserts`) come only from the manifest's shipped shots, with the manifest's exact caption "Real screenshot of <Name> from a Companion Hub QA run. Not a recording of this family.", whole and unedited (the file's name is checked
against its bytes), at most `--inserts` of them (default 2) and only while the kit's film, counted before it is rendered, stays under 110 s. `cuts` names the editorial picks for the 30 s and 15 s cuts: one beat per person that shows an app.

The renderer's own checks run first and fail the write: the copy rules of `claims.json` and the extra ones (`scripts/story/lib/extra-bans.mts`, the word "beta" among them), no dash or exclamation mark, no credit (the guard's
builder handles, "Sims", "Base Game"), the label, the link, day light, every pair written as an alternative. The kit then checks every byte again (`ci-video import-home`).

### A home with no family

The six apartments (`homesWithoutFamily` in cast-plan.json) and, later, offices have no story, so there is nothing to caption and no claim to make. Their plates are the house's own shots at 30 fps, lit as day: **door-to-core**, **orbit** and **hero-reveal**
(the presets the page builds for every home, the ones `pnpm run shots` films), in 16:9 and 9:16 (and 1:1). The only words are the home's display name (`assets/home-names.ts`; the film is `garden-flat`, and the loft is `warehouse-loft`: never the title a spec was filed under), its
kind of place ("Apartment": the lander plan's types) and the sanctioned end card ("UnCloud your life.", "See Companion Core", `ci.computer/core`) with the one disclosure such a film can make, that the Core is drawn as a stylised illustration. No hook, no cuts, no apps, no
screenshots, no family line. **Owner decision still open (C8/O4):** the kit demands a label on every frame, and claims.json has no wording for a home with no family ("Fictional family. Real software." would be false), so the label is the home's display name until the
owner rules (a "fictional team" line for offices is also not yet in claims.json).

### The wrap (`scripts/film/wrap.mts`, replaces `film-bookends.mts`)

`story:film:wrap -- <id>` finds the kit (`--kit`, `$CI_COMMON_KIT`, else `video/kit/ci-common`, which `--setup-kit` makes as a detached worktree of `$CI_COMMON_REF`, default `consolidate/virtual-home-source` until #429 is on main, with the
kit's dependencies installed and no script run; it refuses a kit under 0.35.0 or without `import-home`), then runs `ci-video import-home`, `build`, `check` (the film first, then each short cut by itself: a cut the kit's own gate refuses is left out of
the render and said, `--strict-cuts` makes it an error) and `render --format all --quality draft|high`, with `CI_VIDEO_RENDER_JOBS=1` while a GPU job may be running. Then, as errors with no override: the disclosures the kit prints equal claims.json's words
in the order the film prints them and are the ones this film owes (read from this repository, not from the manifest); each cut's disclosure card is held at least 5 s; the label is the fictional line (a home: its display name); the lighting is day; every end card is
"UnCloud your life." / "See Companion Core" / `ci.computer/core` and **no other address is printed** anywhere (a URL, a www name, any other page of ci.computer); the copy lint over the storyboard's every readable string and every WebVTT; no price or
figure that is not on the fact sheet; the credit scan over the storyboard, the manifest, the subtitles and each file's metadata; and the picture gates of `scripts/film/qa.mts` over every MP4 (one H.264 yuv420p stream, no audio, 30 fps, the frames and
the length the kit's own `build` said, at most 110 s, `freezedetect`, a blank first or last frame, the aspect the format asks for). Results: `<project>/wrap-report.json` and a log of every kit step. The kit's output is the owner's to host (`video/kit/<id>/out/`); none of it is committed.

### The fleet (`scripts/film/plates/fleet.mts`)

`story:film:fleet` queues every family with a bake lock and every home with no family (the Brennans first, the other families, the homes last; `--order` moves ids to the front, `--only` names them), and runs, for the draft mode (540 p plates in `video/plates-draft/`, the
kit's draft quality) and then the final mode (1080 p, high quality), one item at a time under `nice -n 10`: the plates, then the wrap. State is `video/queue.json` (pending, plates, wrapped, failed, with the seconds each step took and the reason it failed); a rerun skips
nothing it has to do (the plates step is itself cached, the wrap step is skipped when it already wrapped this very manifest at this quality) and `--retry-failed` tries the failures again. `--gl auto` (the default) probes the first family on the Intel and the NVIDIA GL
paths (`story:film -- <slug> --plates --probe`) and keeps the faster for the whole queue, recorded in the queue so a resume does not change it (a GL path is in every plate's key). The report is `video/queue-report.md` and `.json`. One GPU process at a time: `--jobs` above 1 is refused.

### The pilot (2026-10-22): the three Brennan homes and the Garden Flat, at 540 p

Plates drawn with `--res 540 --gl nvidia`, then `story:film:wrap -- <id> --quality draft` (video-kit 0.35.0, CI-Common #429): the Brennan trio is 5,044 to 5,192 plate frames each, about 10 to 14 minutes a family on the shared machine; the Garden Flat's three shots are 1,185 frames
an aspect and took 260 s. I looked at three frames of each output at identical timestamps in 16:9 and 9:16, the end card and the disclosure card.

| Film | Length | Landscape / portrait | Result |
|---|---|---|---|
| brennan | 109.6 s | 32.7 / 31.9 MiB | passes; the 15 s and 30 s cuts are refused by the kit's own gate (below) |
| brennan-hollin | 112.5 s | 29.5 / 26.6 MiB | passes with warnings (over 110 s; three still holds of 1.7 to 1.9 s) |
| brennan-merrow | 114.4 s | 31.4 / 29.7 MiB | passes with warnings (over 110 s; still holds of 2.0, 2.8 and 3.0 s) |
| garden-flat | 49.5 s | 20.3 / 17.2 MiB | passes; no cuts (a home with no family has no hook) |

What the frames showed, and what was fixed: **the first run failed the kit's own gate.** In 16:9, six of the Brennans' eight beats had the kit's subtitles over 24 to 42 percent of their subject (Hollin and Merrow: a whole-room anchor the same), which
the plates now answer as above. Seen after the fix: the Core, the desk and the laptop are clear of the caption and the subtitles in both aspects; the subtitle is one line on a dark box, the name kicker ("02 · JOHN") sits over the caption, the label is in the
corner; the apps scene prints "Stirling-PDF, alternative to Smallpdf" with the real logo beside the name (small: the kit sizes it, about 16 px at 720 p; Linkwarden has no logo in `app-media.json` until CI-Marketplace's logos land, #50, and is shown by name alone); the end card is
"UnCloud your life." / "See Companion Core" / `ci.computer/core`; the disclosure card prints claims.json's four lines in order. The Garden Flat's frames carry only "Garden Flat" (the label), "Apartment" (the caption), the end card and the stylised-Core line.

**What is wrong and not fixed here** (the kit, the owner, or a later package):

1. **The kit refuses every short cut that carries four disclosure lines** (any family that names an agent: the disclosure card's heading is covered by its own boxes, `text_occluded` in the HyperFrames layout gate, and the 15 s cut runs 24 s against its 16 s target because
   the card is held for reading). The wrap leaves such a cut out and says so (`--strict-cuts` makes it an error). That is CI-Common #429's coda layout; the plates cannot change a disclosure.
2. **The kit's film runs longer than the repository's 110 s cap** (its title, the apps, the end card and a coda held 14 s to read four lines add about 26 s to the plates): 109.6, 112.5 and 114.4 s. The wrap says so up to 120 s and refuses beyond: an owner call whether
   the cap applies to the kit's film at all.
3. **The film's portrait caption sits in the bottom 340 px that a phone's interface covers**, as the kit's default band does (200 px up); only the cuts use its platform-safe band. Fine on a family page, wrong for a feed: the film's portrait wants `captionBand: "platform-safe"` in the kit's recipe.
4. **Text the kit sets is under the repository's 36 design px floor** in places (the link line and the logos are small at 1080 p) and is held to the kit's canon, not to `CANVAS_TYPE_MIN` (owner call 8 of the audit).
5. **The kit films are 17 to 33 MiB** at the draft quality, over the 24 MiB web guard of the repository's own films (they are not hosted on Pages; the host is still the owner's choice).
6. **Hollin and Merrow rest the camera 2 to 3 seconds** under one caption: a still picture, said as a warning (a stuck render is 4 s and more).

### Which GL path

`--gl default` lets ANGLE pick the machine's GPU (the Intel iGPU here), `--gl nvidia` is the discrete GPU through ANGLE's GL backend (`--use-angle=gl` with the PRIME offload variables; **never `--use-angle=vulkan`**, which draws blank frames), `--gl software` is SwiftShader. On this
machine (shared with other sessions, load average 5 to 9, the NVIDIA's memory 11 of 12 GB used by another job) the probe measured a Brennan plate at 540 p: Intel 0.296 s a frame, NVIDIA 0.189; at 1080 p: Intel 0.698, NVIDIA 0.790. The numbers move with the
other jobs, so read them with the load average in `video/plates/probe/<slug>.probe.json`.

## Open items for the owner

1. Choose the film host (R2 or Stream) and the address for `FILM_BASE_URL`.
2. The burned captions and the WebVTT say the same thing: the family page's `<track>` should not be `default`, or a viewer sees them twice.
3. Landing-site's `scripts/story/pages.mts` prefixes a film URL with `../`; a hosted film's address is absolute, so it needs to leave an `https://` address alone (a one-line change in that file, not in this package).
4. FFmpeg here is a GPL build with libx264; the films contain only its encoded output. Flagged for counsel with the espeak-ng note in THIRD_PARTY.md, with AAC patent licensing.
5. The kit's films (plates and the wrap, "Plates and the home-tour wrap"): rule on the label of a home with no family, and have CI-Common #429's disclosure card fit a short portrait cut with four lines (see the pilot's findings there).
