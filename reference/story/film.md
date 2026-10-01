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
pnpm run story:film -- --all --jobs 1 --force        # --jobs is families at once in ONE browser; keep it at 1 on a shared machine
```

A family can be filmed once it has `content/families/<slug>.json`, `.voice.json` (`pnpm run story:voice`) and `.bake.json` (`pnpm run story:bake`), the bake made
from that voice lock. The film refuses estimated durations. One GPU process of its own, `--jobs 1`; it retries a family once on a fresh page after a
timeout or a browser crash.

## What a film is

| Seconds | What | Notes |
|---|---|---|
| 0 to 4 | **Title card** | the tour's own exterior approach to the front door (the first seconds of the FTUE track) under a rising scrim: "The Surname family", the fictional address, the tagline, and **Fictional family. Real software.** in view from the first half second. No voice |
| a dip of 0.35 s | joins every pair of scenes | the old picture fades to ink over the first half, the new one in over the second; the camera cuts in the middle |
| the film beats | **the flagged beats**, in story order | the camera is `trackFrameAt(track, tourSecond)`: the live tour's camera, read at the tour second each film second plays. A beat after a skipped one cuts in as its voice begins; a beat after a film beat walks in as the tour does. The beat's recorded narration and (if it has one) the agent's line sit at the bake lock's offsets |
| last 15 s or so | **End card** | the same exterior move played backwards (a pull-back) under the closing words; after the last word, a panel: **UnCloud your life.**, `ci.computer/core`, the fictional line, and the disclosures below. It holds at least 5 s |

**On screen.** The *popup card* shows who is in the scene and which companion helps (a monogram disc, never a face), the title, the app chips and the one-line note, and for the
first-run beats a stylised phone drawing whose rows tick off as the narration reaches them. The narration itself is the *caption strip* (the popup body is the
narration, bible R2: one source of text), burned in as open captions with a karaoke highlight; an agent's line shows its speaker and the word *Scripted*. A leader
line and dot point at the subject. A small corner mark, **Fictional family. Real software.**, stays on every frame except the two that carry the line large.

**The card never covers the subject.** Placement is story-bake's solver (`assets/story/place.ts`, the same function the live popup calls), solved once per beat against the beat's rest
pose. If the full card would cover more than 2% of the subject, the same card is tried smaller (type and padding at 0.86, then 0.74 with the phone drawing dropped and
its words kept as the note). A 9:16 card is a sheet on top of the captions, or under the top margin if that clears the subject. `--stills` writes each beat's
placement (slot, level, overlap) to `<slug>/<aspect>.cards.json`.

**Safe areas.** 16:9 keeps 54 px top and bottom and 96 px at the sides. 9:16 keeps 200 px at the top and 340 px at the bottom clear (a phone's own interface covers them) and 72 px at the sides.

**Accessibility.** The words are always on screen (burned captions), and also written as WebVTT from the same cues. Contrast: text `#e8f2f4` on 88% ink glass is over 10:1 at its worst; the muted note
`#a3babf` over 6:1; the not-yet-spoken caption word `#9db4ba` over 5:1; the spoken word on the sage highlight is ink on `#c5e8dc`, 13:1. Nothing flashes: the dips are 0.35 s fades.

**Honesty.** Disclosures are printed from `content/story/claims.json`, never typed in a family file: the fictional line on the title card, the corner mark and the end card; beta
(*Companion OS, Companion Memory and Companion Agents are in beta.*); scripted scenes; the Core drawn as a stylised illustration; the synthetic, locally generated voice; and, only when a film beat names an
agent, *Hermes is from Nous Research. OpenClaw is from the OpenClaw Foundation. Companion Hub packages both.* No price, no ship date, no performance number, no customer quote.

## Files

```
assets/story/film/layout.ts    the clock, the audio placements, the caption cues and WebVTT, the two frames, the card placement. Pure: Node tests it
assets/story/film/cards.ts     Canvas2D: the popup card, the phone drawing, the title card, the end card
assets/story/film/overlay.ts   Canvas2D: the corner mark, the karaoke caption, the leader, the dip
assets/story/film/index.ts     the page module: registers the film as a shot preset (frameAt over film seconds), draws frame i, returns a JPEG
scripts/render-family-film.mts the CLI
scripts/film/{lib,mux,qa}.mts  families and films.json / the sound and the encode / the gates
scripts/story/ship/films.mts   the site build's step: registers posters and captions, links the hosted films
scripts/test-film.mts          18 tests, no GPU (the sound test needs ffmpeg and skips without it)
scripts/film-bookends.mts      optional CI-Common bookends (off; see below)
```

Outputs:

| Where | What | In git |
|---|---|---|
| `video/families/web/<slug>.<aspect>.<hash10>.mp4` | the web film: H.264 High, CRF 28, `maxrate 1500k`, `bufsize 3000k`, `+faststart`, AAC 64k mono, content-hashed name | no (gitignored like `video/houses`) |
| `video/families/master/<slug>.<aspect>.mp4` | with `--master`: CRF 18, AAC 128k stereo | no |
| `video/families/<slug>.<aspect>.report.json` | the gates' numbers, the card placements, the clip offsets, the wall time | no |
| `content/families/<slug>/film/poster.<hash10>.jpg`, `poster-9x16.<hash10>.jpg` | the posters (the title card at 3.2 s; 1280 and 720 px wide) | yes |
| `content/families/<slug>/film/captions.<hash10>.vtt` | WebVTT, one file for both shapes | yes |
| `content/families/films.json` | per family: duration, `inputsSha`, the vtt, and per aspect the file name, sha256, bytes, size, duration, poster, loudness | yes |

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
`trackFrameAt`, a pure function of the tour second and the aspect; the encode is bitexact with a pinned thread count. Two fresh runs give the same mp4 **on one machine profile** (the Chromium build in
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
