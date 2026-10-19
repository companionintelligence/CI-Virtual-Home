# Persona ad cuts: silent social ads from the tour

A **cut** is one member of a family told as a 15 to 25 second silent ad. It is made by `pnpm run story:ads` from the family's own files, on this machine, with the repo's own renderer and the
camera the live tour already plays. It is the second thing the story system makes besides the family film ([film.md](film.md)): the film is 90 seconds with a voice; a cut is 15 to 25 seconds
with none, for the places a social ad is watched muted, with burned captions.

```bash
pnpm run build                                          # the page modules (assets/**/*.ts -> .js)
pnpm run story:ads                                      # refresh content/story/ads.json and print the plan (rendering needs a choice: a family, a member or --all)
pnpm run story:ads -- --all                             # render the stale 9:16 cuts of every family with a bake lock (minutes a cut: hours in all)
pnpm run story:ads -- --family brennan --member sally   # one cut
pnpm run story:ads -- brennan --aspect 9x16,1x1         # these shapes (--aspect all: 9x16, 1x1, 4x5, 16x9)
pnpm run story:ads -- brennan --res 540                 # the same picture at a quarter of the cost, to look at (360, 540, 720, 1080, 1440, 2160)
pnpm run story:ads -- brennan --stills <dir>            # single frames (first, hook, card, captions, dip, end card, last) + the card placements, no video
pnpm run story:ads -- --dry-run                         # the plan and what would be rendered; writes nothing, starts no browser
pnpm run story:ads -- --manifest                        # write content/story/ads.json and stop        --check   exit 1 when it is not what the families make now
pnpm run story:ads -- brennan --gl software             # the repo's SwiftShader instead of the GPU (PERSONA_CUT_GL=software)   --force  render again
pnpm run story:ads -- brennan --audio silent            # one silent AAC track, for a placement that insists on audio
pnpm run story:ads:test                                 # the pure-Node tests (also part of `pnpm run test:node`)
```

A family is cut once it has `content/families/<slug>.json`. To be **rendered** it also needs `<slug>.bake.json` (`pnpm run story:bake -- <slug>`); the bake may use estimated durations,
which is what every bake does until the voice is recorded. A cut needs **no voice and no voice lock**: its captions are read at the bake's own estimate (150 words a minute, `estimateMs`), so the
camera, the captions and a voice recorded later all keep to one clock. Families that are still being written (a file that does not parse, one without members, a bake that no longer fits) are
listed and skipped; they are never an error.

## What a cut is

| Cut seconds | What | Notes |
|---|---|---|
| 0 to 2 | **The hook** | the hook beat's title, big, on a chalk panel with the member's name, over the room: the tour's own camera in its last two seconds before it settles on the subject. In from the first frame (a still of frame 0 carries the words), out over 0.25 s before the card comes in |
| 2 to the last word, plus a tail | **The beat** | the same camera, at rest on the subject. The popup **card** (the member, the title, the chips: the app, then `replaces <X>`, and the story's one-line note) comes in as the hook goes; the beat's own words are the **caption strip**, burned in with a karaoke highlight. A leader dot marks the subject. Nothing else |
| a dip of 0.35 s | joins every pair of scenes | the old picture fades to chalk over the first half, the new one in over the second |
| last 3.5 s (up to 4) | **End card** | the tour's exterior move played backwards (a pull-back) under a panel: **See Companion Core**, `ci.computer/core`, **Fictional family. Real software.**, and the plain disclosures below |

**On every frame:** the corner mark "Fictional family. Real software." (top left inside the safe area, drawn last, over the dip too). On the end card the line is also its own pill in the panel.

**No UI mockups, no screen recordings, no app screens, no faces.** The popup is words and chips; a member is a monogram disc; the Companion Core is the tour's own stylised piece of furniture. The phone
drawing the film uses for first-run beats is left out of a cut on purpose. Nobody is presented as a customer: the card says who the character is and nothing about what they think of the product.

### The hook rule

A member's cut opens on **the first beat of theirs with `film: true` that is in a `room` or `outside` chapter**. The first-run chapter is the Core's arrival, not a member's story (Sally's very first flagged
beat is `ftue-hello`, and her cut does not start there). Where a member has no flagged beat in a room: their first room or outside beat whose app has a `replaces`, then any app, then their first beat; the
plan's `notes` say which rule fired. The hook is that beat's **popup title** (the story writes titles as headlines: `popupHeadlineMaxWords` is 6), or the **first sentence of its body** when the title runs over
eight words. Members with no `archetype` (a baby) are skipped.

### The cut's length

The cut is the hook beat alone when that reaches 15 s: `2 s hook + the caption read at 150 words a minute + 0.8 s tail + 0.35 s dip + 3.5 s end card`. A beat a little short stretches the tail (to 1.4 s) and the end
card (to 4 s) to reach 15 s; nothing else moves. A beat that is still short **goes on to the member's next beat that names an app** (the same chapter first, then any later one): its first sentences, whole
sentences only, as many as fit before 25 s, at least one, cut in 0.6 s before its caption with its own card. A member with no such beat keeps a cut under 15 s, and its status is `short` (it is not rendered without
`--allow-short`). A caption that would run a cut past 25 s keeps whole sentences from the start. All four Brennan cuts are one beat each; the extension rule is covered by `story:ads:test` on synthetic stories.

## Aspects and safe areas

All four come from the same plan (the same words, the same seconds, the same camera path). The bake serves three compose rows (16:9, square and a phone: `Pose.compose`, `composeAt`); `trackFrameAt(track, t, aspect)` reads
the table at the aspect it is asked for.

| Frame | Delivered | The page renders | What the camera is composed for | Safe margins (design px, at 1080 short edge: top / sides / bottom) | Layout |
|---|---|---|---|---|---|
| `9x16` | 1080 x 1920 | 1080 x 1920 (`aspect=9:16`) | 0.5625: the bake's own phone row, blended with the square row | **200 / 72 / 340** ([film.md](film.md): a phone's own interface covers the bands) | a sheet across the safe width on top of the caption strip; under the corner mark when the sheet would cover the subject |
| `1x1` | 1080 x 1080 | 1280 x 1280, scaled to 1080 (the page offers 640, 960, 1280, 1920, 2560, 3840) | 1.0: the bake's square row exactly (the subject to one side) | 84 / 84 / 120 | story-bake's popup solver: a narrow card (300 to 560 design px, as wide as the room the subject leaves) and a smaller hook beside the subject, captions below |
| `4x5` | 1080 x 1350 | a **square** at 1920, **the middle 80 %** (1536 x 1920) scaled to 1080 x 1350 | 0.5625: the 9:16 frame's own row (the subject above the sheet) | 110 / 72 / 150 | a sheet, as 9x16 |
| `16x9` | 1920 x 1080 | 1920 x 1080 | 1.778: the bake's wide row exactly | 54 / 96 / 54 (the film's) | the popup solver |

**4:5.** The bake serves 16:9, square and a phone; it has no 0.8 row, and the page's renderer cannot make a 0.8 frame (`recordSize` offers 16:9, 9:16, 1:1 and 21:9). So the page renders a **square** and the
frame is the middle 80 % of its width: the same vertical lens, 0.8 wide to 1 tall. The camera is composed with the **phone row** (`trackFrameAt(track, t, 0.5625)`, the row the 9:16 frame reads), not the table
read at 0.8: the card of a 4:5 frame is a sheet, and the phone row puts the subject above where a sheet goes (the 0.8 blend between the square and phone rows put it where neither a sheet nor a side card clears it:
the first try overlapped the subject by up to 12 % with the sheet at its smallest). The card is placed against the subject projected through that camera, and the report lists each card's overlap with it. A subject that was only just
inside the phone row can sit near an edge here: look at the 4:5 stills (`--stills`) the first time a family is cut.

The margins of 1:1 and 4:5 are ours, not a platform's: a feed ad's own controls sit outside the video, so they keep text off the edges and leave room for the caption strip, no more.

## Disclosures

Printed from `content/story/claims.json` (never typed in a family file), and recorded per cut in `ads.json` as ids:

| Id | Where | When |
|---|---|---|
| `fictional-family` | the corner mark on **every** frame; a pill on the end card | always |
| `beta-short` | the end card ("Companion OS, Companion Memory and Companion Agents are in beta.") | always: a cut claims software behaviour |
| `scripted-scenes` | the end card | always |
| `stylised-art` | the end card ("The Companion Core is drawn as a stylised illustration, not a photograph.") | always |
| `names-owners` | the end card | when a chip says `replaces <X>` (third-party names, in text, never a logo) |
| `attribution-agents` | the end card | when a beat of the cut names Hermes or OpenClaw (an `agent`, or the app, or `with`) |

`synthetic-voice` is not printed: a cut has no voice. No price, no ship date, no performance number, no customer quote, no app count, no "Buy": the one call to action is **See Companion Core** at `https://ci.computer/core`.
Third-party software is named in the chips and the words, in text; no logo appears anywhere. No builder credit and no mention of a game or a gallery a home came from is in a cut: the plan's words go through
`claims.json`'s error rules and a credit guard (`Sims`, `Base Game`, `BG`) and a cut that fails either is `blocked` and not rendered.

## The look

Daylight and warm light only (ADS.md section 9.1: "chalk, daylight and real rooms ... no neon, no glow, no RGB"):

* **The hour.** The renderer opens the editor page with the page's own `?lighting=day` override ("re-lights every house the page builds, whatever its spec says"), and checks `__houseLighting.preset` before it draws. The houses'
  own presets are not used: `bgfamily` and `familyhouse-nora` are `dusk`, which an ad may not show. `--lighting golden` is the one other hour allowed. Nothing in the goldens' path changes: the parameter is the page's existing
  one, and the cut is rendered from the editor page like every film.
* **The overlay** is the canon's **light** set (`portal/site.css :root`: background `#f3faf7`, foreground `#0a222e`, card `#f0f9f5`, primary phthalo `#0a6358`, primary-foreground `#f0fdf4`, muted `#e8f2ec`, muted-foreground `#3a524b`;
  `story:ads:test` holds the seven values in `assets/story/film/cut/draw.ts` to the stylesheet's). Chalk panels with a hairline edge and a dark drop shadow (a shadow below, not a glow), ink text, the primary for
  the one accent. Manrope 500, 600 and 700 (the canon's weights; `assets/fonts`). The family films' dark glass is theirs.
* **The dip** between scenes is to chalk, not ink.

## Audio

**None, by default.** A cut is silent by design, so the file has one stream: `ffprobe` shows a single H.264 video stream and nothing else, which every placement named in the campaign takes (Meta, TikTok, YouTube Shorts,
LinkedIn). `--audio silent` adds one silent AAC stereo track at 48 kHz (`anullsrc`, `-shortest`) for a placement or an ad server that insists on an audio stream; the video bytes are the same. The gates check
whichever was asked for.

## The manifest: `content/story/ads.json`

Generated by `pnpm run story:ads` (or `-- --manifest`) from `content/families/*.json` and the bake locks; never hand-edited, never holding a timestamp or an absolute path, so the same files give the same bytes. It is the plan,
the same on every machine, so it can be committed; what a machine has rendered is `video/ads/renders.json` (below).

```
{ v: 1, note, defaults: { fps, aspects, lighting: 'day', audio: 'none', hookS, minS, maxS, codec, label },
  families: { <slug>: { bake: 'estimated' | 'voice' | null,
    cuts: [ { id: '<slug>-<member>', member, name, archetype,
              status: 'ready' | 'no-bake' | 'short' | 'blocked',
              hook: { beat, kind: 'title' | 'sentence', text, rule: 'flagged' | 'replaces' | 'app' | 'first' },
              beats: [beat ids], captions: [the caption text of each beat], chips: [the hook beat's chips], apps: [{ id, replaces }],
              disclosures: [claims.json ids], cta: { label, url }, aspects, durationS, frames,
              timeline: { parts: [{ beat, kind, at, end, narrAt, narrEnd, sentences, tour: { from, to } | null }], pads, end },
              notes: [...], hash } ] } } }
```

`hash` is the staleness check, like `films.json`'s `inputsSha`: the sha256 of the cut's plan (the words, the seconds, the tour seconds the camera plays), the bake lock's hashes (the camera track, the house, the roles, the anchors), the
`claims.json` texts the end card prints, the frames' design (safe areas) and the defaults. A change in any makes the cut stale. The code that draws it is kept out of the manifest (a code change would rewrite the committed
file): `toolSha` (the page modules, the encoder and gates, the CLI, and the film's layout, cards, track and place) is kept with each render. `story:ads -- --check` fails when the committed manifest is not what the families make now.

The lander and the family pages may read it: a family's cuts are `families[<slug>].cuts`, the poster text of a cut is `hook.text`, and `status` says which are renderable.

## Outputs

| Where | What | In git |
|---|---|---|
| `video/ads/<slug>-<member>.<aspect>.mp4` (`.r540` after the aspect at another `--res`, `.silent` after that for `--audio silent`) | H.264 High, yuv420p, bt709, 30 fps, CRF 18 capped at 12 Mbit/s, `+faststart`, no audio (or one silent AAC), 15 to 25 s | no (`/video/*` is ignored, as `video/families`) |
| `video/ads/<...>.report.json` | the gates' numbers, each card's placement and overlap, the hook's, the end card's rectangle, the frame digest, the wall time | no |
| `video/ads/renders.json` | per `<cut>.<aspect>.<res>`: the cut's `hash`, the `tool` hash, the file, its sha256, bytes, size, length, the hour, the audio, the GPU path and the renderer, the frame digest | no |
| `video/ads/rejected/` | a render that failed a gate | no |
| `content/story/ads.json` | the plan above | yes |

A render is **current** while `renders.json` holds a file for (cut, aspect, `--res`) made from the same `hash`, the same `tool`, the same hour and the same audio choice; `story:ads` renders only the others (`--force` renders anyway).

**Hosting.** Videos do not ship in git or on Pages (film.md says why: about 5 to 15 MiB each, 30 families of four cuts and four shapes is a few gigabytes, Pages caps a file at 25 MiB, and CI has no GPU). Upload `video/ads/*.mp4` to
the ad platforms (they re-encode) or to the host the owner chooses for the films. Nothing here changes `portal:build` or `dist/`.

## The machine: GPU, Chromium, the gates

* **`--gl default`** (the default on Linux; `PERSONA_CUT_GL`): `--use-gl=angle --use-angle=default --ignore-gpu-blocklist --enable-gpu-rasterization`, so ANGLE picks the machine's own GPU: the Intel iGPU on this machine
  (`ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S))`). **`--gl software`** is the repo's own `LAUNCH_ARGS` (ANGLE on SwiftShader, the CPU: hours a film here). On macOS both are the repo's Metal flags.
  **Never `--use-angle=vulkan`**: on the NVIDIA it gives blank frames and nothing complains. The renderer logs the GPU the page reports and warns when `default` fell back to a software rasteriser.
* **A blank render is caught, not shipped.** Every frame's room (before the overlay, so the overlay cannot hide it) is sampled for a luma spread; the first frame blank stops the cut at once, the last frame blank or more than
  5 % blank frames fail it. The gates then check the first and last frame of the encoded file again.
* **Chromium.** Playwright's own when it is installed. The pinned Playwright (1.64 alpha) asks for a Chromium build a machine may not have; then the renderer takes the newest Chromium in `$PLAYWRIGHT_BROWSERS_PATH`
  and `~/.cache/ms-playwright` (the headless shell first) and says so. It never downloads anything (`pnpm exec playwright install chromium` is the owner's call).
* **The gates** (`scripts/film/ads-qa.mts`, run on the encoded file; a cut that fails is moved to `video/ads/rejected/`): `ffprobe` clean (no stderr), exactly one stream (two with `--audio silent`), H.264, `yuv420p`, the delivered
  size, 30 fps, exactly the frames the plan says, the length within 0.1 s of the plan and inside 15 to 25 s; no audio stream unless asked; under 60 MiB (a warning over 25); `freezedetect` (a frozen picture of 2.5 s or more
  fails, 1.5 s warns); `blackdetect` (a cut is daylight, its dips are chalk: no dark picture); the first and last frame not blank. Before the render, the plan refuses a cut whose words fail the copy lint, a cut with no
  bake, a cut under 15 s, and a caption, card, hook or end card outside the safe area.

## Determinism

Frame `i` is `__houseRenderFrames(i)` plus an overlay that is a pure function of the cut second, the plan and the frame's format, so frames are random access. The encode is single-threaded and bitexact (`-threads 1`,
`-flags:v +bitexact`, `-fflags +bitexact`, `-map_metadata -1`, as the film's: with four threads libx264 gave a different file from the same frames on every run). Each render's report holds a `frameDigest` (the sha256 of
every JPEG handed to the encoder, in order) and the file's sha256. DETERMINISM_RESULT

## Not verified, and open items for the owner

1. **Other families.** Only the Brennan homes were rendered and looked at. The other families' plans are in `ads.json` and are read from their stories and bake locks, but nobody has looked at a still of their cuts
   (the card placement on a first-time subject is the thing to look at: `--stills`).
2. **4:5 and 16:9** were rendered as stills and a short check, not looked at in motion for all four members; 1:1 was proved on Steve's cut.
3. **Estimated reading pace.** Captions run at the bake's 150 words a minute, which is slow for silent reading (about 200 to 250); a faster pace is a change to `estimateMs`'s one number in the bake, and moves the camera
   with it. A voice recorded later keeps the same clock.
4. **A voiced cut** (a track of the existing narration under the same picture) is not built: the film already does that, and the cut's clock is the one the voice would follow, but the clips are not recorded.
5. **Platform specs** (a platform's own loudness, bitrate and length limits for each placement, the 6 s and 15 s bumpers of ADS.md section 5) are not checked beyond what is above; the cuts are 15 to 25 s.
6. **Safe areas for 1:1 and 4:5** are our own reading of a feed placement (the 9:16 ones are the film's, for a phone's interface).
7. **The dip to chalk** is a 0.35 s fade through a near white frame: two frames above 80 % at 30 fps. There is one between scenes, far from the three-flashes-a-second limit, but the owner may prefer a hard cut.

## Files

```
assets/story/film/cut/plan.ts   the plan, the clock, the four frames, the card's place. Pure: Node tests it
assets/story/film/cut/draw.ts   Canvas2D: the corner mark, the hook, the card, the karaoke caption strip, the leader, the dip, the end card (the canon's light set)
assets/story/film/cut/page.ts   the page module: registers the cut as a shot preset, draws frame i, returns a JPEG (the film's index.ts is its sibling and is not touched)
scripts/render-persona-cuts.mts the CLI
scripts/film/ads-lib.mts       the families, the plan for each, the manifest, the hash, the copy lint, renders.json, the GPU flags and the Chromium lookup
scripts/film/ads-encode.mts    the ffmpeg command line (silent)
scripts/film/ads-qa.mts        the gates
scripts/test-ads.mts           the tests (24, no GPU)
content/story/ads.json         the plan, generated
```
