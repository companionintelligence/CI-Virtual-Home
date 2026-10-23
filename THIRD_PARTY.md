# Third-party material

> Private & Confidential — Property of Lifescope Inc. Do not distribute. Everything in this repository not
> listed below is first-party (see [NOTICE.md](NOTICE.md)).

Every third-party component this repository ships, adapts, loads or builds with, with its licence and where
its licence text lives. When you add, upgrade or adapt one, update this file in the same commit.

## Vendored — shipped in this repository

| Component | Version | Licence | Where | Licence text |
|---|---|---|---|---|
| [three.js](https://threejs.org) — core module build + 23 addon files from `examples/jsm` (OrbitControls, TransformControls, EffectComposer and passes, GTAO, SMAA, bloom, GLTFExporter/Loader, RoomEnvironment, utils) | r169 (`three@0.169.0`) | MIT — © 2010-2024 three.js authors | [`assets/vendor/three/`](assets/vendor/three/) | [`assets/vendor/three/LICENSE`](assets/vendor/three/LICENSE) |
| [pixelmatch](https://github.com/mapbox/pixelmatch) | 7.2.0 | ISC — © 2025 Mapbox | [`scripts/vendor/pixelmatch.mjs`](scripts/vendor/pixelmatch.mjs) | [`scripts/vendor/LICENSE-pixelmatch.txt`](scripts/vendor/LICENSE-pixelmatch.txt) |
| [Manrope](https://github.com/sharanda/manrope) — variable, Latin subset (from `@fontsource-variable/manrope` 5.3.0, via CI-Common `styles/fonts/files/`) | v4.504 | OFL-1.1 — © 2019 The Manrope Project Authors | [`assets/fonts/manrope-latin-var.woff2`](assets/fonts/manrope-latin-var.woff2) | [`assets/fonts/LICENSE-Manrope.txt`](assets/fonts/LICENSE-Manrope.txt) |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — variable, Latin subset (from `@fontsource-variable/jetbrains-mono` 5.3.0, via CI-Common) | v2.211 | OFL-1.1 — © 2020 The JetBrains Mono Project Authors | [`assets/fonts/jetbrains-mono-latin-var.woff2`](assets/fonts/jetbrains-mono-latin-var.woff2) | [`assets/fonts/LICENSE-JetBrains-Mono.txt`](assets/fonts/LICENSE-JetBrains-Mono.txt) |
| [Lucide](https://lucide.dev) icon path data (from `lucide-react` 0.469.0), inlined as the SVG sprite | 0.469.0 | ISC — © Lucide Contributors 2022; portions © Cole Bemis 2013-2022 (Feather, MIT) | [`room-creator.html`](room-creator.html) (the `<symbol>` sprite), [`index.html`](index.html) (the gallery's sprite), [`assets/viewer.ts`](assets/viewer.ts) (the player's `ICONS`) | inline, above the room-creator sprite |
| 3Dinside prop collection (22 packs): baked geometry only - see [ATTRIBUTION.md](ATTRIBUTION.md) | per pack, see ATTRIBUTION.md | CC0 where a pack says so, otherwise owner-asserted rights (Lifescope Inc.); see ATTRIBUTION.md | `assets/props/baked/` (none yet) | [`ATTRIBUTION.md`](ATTRIBUTION.md) |

**Local modification.** The three.js files are byte-identical to the `three@0.169.0` npm package except one:
`postprocessing/GTAOPass.js` `generateNoise()` seeds its `SimplexNoise` with mulberry32 instead of
`Math.random`, so every frame's ambient-occlusion dither is the same (the determinism the goldens depend on).

The fonts are OFL-1.1: they may be bundled and redistributed with this software, but not sold on their own, and
a modified version may not use the reserved font names. The capture scripts serve them locally in place of the
Google Fonts stylesheet the pages link (see below), so a golden never depends on the network.

`scripts/vendor/png.mjs` sits beside pixelmatch but is first-party.

## Adapted source — code or proportions reworked into our own files

| Source | Licence | What was adapted | Into |
|---|---|---|---|
| [furnishup/blueprint3d](https://github.com/furnishup/blueprint3d) | MIT — © 2015 FurnishUp Inc. | the Corner / Wall / HalfEdge / Room model and `findRooms`, from `src/model/{corner,wall,half_edge,room,floorplan}.ts` and `core/utils.ts` (minus jQuery and THREE) | [`assets/floorplan-graph.ts`](assets/floorplan-graph.ts) |
| [pascalorg/editor](https://github.com/pascalorg/editor) | MIT — © 2026 Pascal Group Inc. | the scene-referred grade (contrast about mid-grey + saturation lift, `GRADE_PARAMS`); the gradient-sky environment approach (`packages/viewer/src/components/viewer/scene-environment.tsx`); fog that takes the sky's own colour along each view ray (`fogRadiance` in `scene-atmosphere.tsx`, re-done as WebGL fog chunks in `installSkyFog`) | [`assets/environment.ts`](assets/environment.ts) |
| [pascalorg/editor](https://github.com/pascalorg/editor) | MIT — © 2026 Pascal Group Inc. | roof trim proportions — the k-style gutter's 0.13 m size and 0.07 m leaders on a 0.02 m standoff (`packages/core/src/schema/nodes/gutter.ts`, `downspout.ts`), plumb 1×8 fascia and rake boards (`roof-segment.ts`); the geometry is our own | [`assets/roofs.ts`](assets/roofs.ts) |
| [pascalorg/plugin-trees](https://github.com/pascalorg/plugin-trees) | MIT — © 2026 Pascal | flower-head geometry (daisy ring, tulip cup, lavender spike; `src/flower-geometry.ts`), the grass tuft of flattened leaning cones (`src/grass-geometry.ts`) and the one-geometry-per-variant instancing pattern | [`assets/site.ts`](assets/site.ts) |

Their licence texts are reproduced at the end of this file.

## Reference only — nothing copied

- **Pascal's `/next` demo (pascal.app)** carries no licence. None of its code, textures, models or configuration
  files are in this repository, and none may be added. It was used as a visual reference: per the note at the
  top of `assets/environment.ts`, the day / dusk / night presets began from the colour values of that demo's
  published time-of-day presets and were then re-tuned by eye. Treat that as the one place to re-examine if the
  demo's terms ever need to be answered.
- **Comments in `room-creator.html`** cite the Pascal editor, the Codrops "3D Kitchen Designer" article and R3F
  grass demos as design inspiration for the page's chrome and garden house — cited as inspiration, not as a
  source of copied code.
- **The 30 houses** are HouseSpecs written by hand from The Sims 4 gallery builds they are named after; each
  spec's `author` and `source` fields credit the original builder. No screenshots, textures, models or files
  from those builds or from The Sims are in this repository — the reference photos they were read from are
  third-party images and are deliberately not committed.

The web portal (`pnpm run portal:build` → Cloudflare Pages) redistributes three.js with its `LICENSE`, and the two
fonts with theirs (`assets/fonts/LICENSE-*.txt` are copied beside the woff2), which is what MIT and OFL-1.1 ask.
The gallery (`index.html`) and the player's stylesheet load them from `assets/fonts/`; `room-creator.html` itself
still links the Google Fonts stylesheet below, in the player as in the editor.

## Loaded at runtime (not in the repository)

- **Google Fonts** — `room-creator.html` (and so the portal's player), `floorplan-graph-demo.html` and `video/houses/index.html` link the
  Manrope and JetBrains Mono stylesheets from `fonts.googleapis.com` (both OFL-1.1; the canon's two families — the editor
  no longer asks for Plus Jakarta Sans). The capture scripts intercept that request and serve `assets/fonts/` instead (they
  still map the retired Plus Jakarta Sans name to Manrope, so an older page resolves).

## Build and test tooling (devDependencies, not shipped)

| Package | Version | Licence |
|---|---|---|
| [`playwright`](https://playwright.dev) (and the Chromium build it drives) | `1.64.0-alpha-1789764292000` — pinned exactly: the goldens were blessed on its Chromium 154.0.8037.0 | Apache-2.0 |
| [`esbuild`](https://esbuild.github.io) | ^0.28.2 | MIT |
| [`typescript`](https://www.typescriptlang.org) | ^5 | Apache-2.0 |
| [`@types/node`](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^22 | MIT |

The workflows (`.github/workflows/ci.yml`, `deploy.yml`) run GitHub's own `actions/checkout`, `actions/setup-node`,
`actions/upload-artifact` and `actions/download-artifact` (MIT) and `pnpm/action-setup` (MIT), each pinned to a
commit. To upload the portal, `deploy.yml` installs Cloudflare's [`wrangler`](https://github.com/cloudflare/workers-sdk)
4.143.0 (MIT OR Apache-2.0) with `npm install --ignore-scripts` into a temporary directory and runs it from another,
empty one. None of these is a dependency of the repository, and none of their code is in the site.

External tools the scripts call but this repository does not include: **ffmpeg** (`render-house-shots.mts`,
`prop-sheet.mts`; LGPL-2.1+/GPL depending on build), **rsvg-convert** from librsvg (`generate_floor_plans.py`,
`generate_house_iso.py --png`; LGPL-2.1+), and **Python 3** (standard library only).

## The story site (families, tour, voice-over, films)

Four sections follow: what the family pages ship, what the voice-over tool builds with, what the films are built with, and
what was considered and refused. In short: the site loads nothing from a third party at run time; the player adds no dependency; the only
third-party **material** the site ships is the generated audio and, in the app media below, the apps' own logos and real screenshots of them; Kokoro-82M, espeak-ng and FFmpeg are build-time
tools whose **output** ships. Voice-over is generated locally; no cloud text-to-speech service or API key is used anywhere. Open
questions for counsel are listed in the voice and film sections.

### Story site: family pages

The family pages (`pnpm run portal:build` → `dist/`, see README → The family stories) add this to what the site ships. Nothing here is
loaded from a third party at run time: the site makes no third-party request.

| Component | Version | Licence | Where | Licence text |
|---|---|---|---|---|
| [Archivo Black](https://github.com/Omnibus-Type/ArchivoBlack) — Latin subset, via CI-Common `styles/fonts/files/archivo-black-latin.woff2` (the families' link-preview images only, drawn by `scripts/story/build-og.mts`; the pages themselves are set in Manrope since the October 2026 restyle) | as in CI-Common | OFL-1.1 — © 2017 The Archivo Black Project Authors | [`portal/fonts/archivo-black.woff2`](portal/fonts/archivo-black.woff2); not shipped | [`portal/fonts/LICENSE-Archivo-Black.txt`](portal/fonts/LICENSE-Archivo-Black.txt) |
| Manrope and Lucide icon path data (a few more symbols: menu, sliders, film, search) | as in the table above | OFL-1.1 · ISC | `assets/fonts/`, inlined in `scripts/story/pages.mts` | as above |
| The first-run drawings and the monogram discs | first-party | — | `scripts/story/pages.mts` (inline SVG) | — |

The pictures on the site (thumbnails, posters, link previews, the hero) are renders of our own HouseSpecs; the link previews
are drawn by `scripts/story/build-og.mts` over them. No photograph or portrait is used. A third-party app's logo and real screenshots of it appear
only as the app media below (a logo beside the app it names, a screenshot with its label); nothing is drawn or mocked up, and nothing is composited into a scene or the tour
(the family pages show them today; the owner's ruling of 2026-10-22 also wants them as labelled inserts in the ad cuts and the films, which do not draw them yet).

**Considered and not used.** [axe-core](https://github.com/dequelabs/axe-core) (the accessibility checker) is **MPL-2.0**, which
is outside the licence list this repository takes (MIT, BSD, ISC, Apache-2.0, CC0), so `pnpm run portal:test` carries its own
audit of the tour's interface (`AUDIT` in `scripts/story/portal-tests/player.mts`: names, labels, ids, contrast). If the owner approves MPL-2.0 for a
test-only devDependency, it can be added beside it.

<!-- ---- app media ---- -->
### Story site: app media

The real logos and screenshots the pages show (`pnpm run story:media` → `portal/apps/<id>/` and `portal/ci/`, one manifest, `content/story/app-media.json`;
the contract is [`reference/story/story-v2.md`](reference/story/story-v2.md) "App media"). They are read with `git cat-file` from the sibling repos at pinned commits
(the manifest's `sources`), scaled and re-encoded to WebP by FFmpeg, and shipped under a hash of their bytes. Nothing is edited, drawn over or composited: a logo
is scaled to 128 px and centred on a transparent square, a screenshot is scaled to 960 px wide. Every screenshot carries its label on the page; the manifest lists
what was left out and why (`rejected`). Nothing here is loaded from a third party at run time.

| Source | What it is | Used for | Rights |
|---|---|---|---|
| **App logos and QA screenshots**: [CI-Marketplace](https://github.com/companionintelligence/CI-Marketplace) `apps/<id>/metadata/logo.*` and `e2e/screenshots/<id>.png` at `e947721966952d762deec382e64fd55a8f2db3fb` (124 logos and 18 screenshots, of every app the 36 families, the persona pools and the cast plan name, and two the stories will name next, ComfyUI and Convert to it; the other 111 captures that were looked at are left out and each reason is under `rejected`; four store marks are held back by eye and listed under `rejected`: Whisper WebUI's is OpenAI's mark, TaxHacker's an illustrated character, Tandoor's a photograph of food, Razzia's a screenshot of its sign-in page) | Each logo is the app's own mark as it is in the Companion Hub store listing; each screenshot is a real capture of the app's first screen from a Companion Hub QA run (`e2e/`, Playwright against a running install) | A logo is shown only to identify the app named beside it; a screenshot is shown whole with "Real screenshot of <Name> from a Companion Hub QA run. Not a recording of this family." | The marks and the apps' interfaces belong to their owners and projects and stay theirs; each app has its own licence (its CI-Marketplace listing names it) and a few are not open source (Obsidian and Steam, for example). Shown to identify the software, not to suggest endorsement. **For counsel:** nominative use of the marks, and the licences of the apps' interface artwork, have not been checked app by app |
| **Companion Hub screenshots**: [CI-Hub](https://github.com/companionintelligence/CI-Hub) `videos/ci-tutorial-video/public/screens/` at `860b47a7a84c53d305be8b7696fc390463fcbb96` (4) | Real captures of our own product (Lifescope Inc.): the store, an app's page, the setup screen and the home | Companion Hub section of a family page | First-party. The captures are taken on the Hub repo's tutorial capture stage, which seeds a sample catalogue and sample data (the label says so) |
| **Companion account page screenshots**: the same CI-Hub folder (3: the store, the naming of a device, the home with one device); [CI-Portal](https://github.com/companionintelligence/CI-Portal) is pinned in the manifest (`ff8777c623760ca471ebd89a7881b0aa0f6018e7`) and every candidate there was looked at and left out | Real captures of our own product (Lifescope Inc.) | Companion account page section | First-party, with the same sample data. The third-party apps' icons inside these captures are the store's own listing |
| **First-party app screens**: [CI-Docs](https://github.com/companionintelligence/CI-Docs) `public/screenshots/` at `6773705a5754e506c3f5d0e8a004ca2b0e616f17` (2: Companion Memory's file gallery and Companion Planning's Today view; the other 356 files of the folder were looked at and left out, each with its reason under `rejected`) | Real captures of our own products (Lifescope Inc.) taken for the documentation, of sample data: illustrated pictures, a sample day | The first-party apps' screenshot slot on a family page, with "Real screenshot of <Name> with sample data. Not a recording of this family." | First-party. Sample data only: no email, token, key, host, device id or person's name on the two that ship. Hermes and OpenClaw have none: their only captures (dark setup pages) name outside messaging services and ask for a cloud API key |

The tool is FFmpeg 8.0.1 with libwebp (Ubuntu build; build-time only, not shipped; the same note as for the film's FFmpeg above): the site's WebP files are its output.
No image library was added. Counts and sizes are checked by `scripts/test-app-media.mts` (`pnpm run story:media:test`, part of `test:node`).
<!-- ---- end app media ---- -->

### Story site: voice

The family voice-over is generated **locally** by `pnpm run story:voice` (`scripts/build-voiceover.mts`, `scripts/voice/`), with no cloud
text-to-speech service and no API key. Only the generated audio (`content/families/<slug>/audio/*.m4a`) is committed and shipped; none
of the software below is shipped or loaded by the site. The site discloses that the narration is synthetic. How to run and change it:
[`reference/story/voice.md`](reference/story/voice.md).

| Component | Version / revision | Licence | Role |
|---|---|---|---|
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (model weights and the eight British voice files `bf_emma bf_isabella bf_lily bf_alice bm_george bm_fable bm_lewis bm_daniel`; author hexgrad) | revision `f3ff3571791e39611d31c381e3a41a3af07b4987`; `kokoro-v1_0.pth` sha256 `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4` (pinned in `content/story/voices.json`, checked on every run) | Apache-2.0 (model card) | the voice; its output is the shipped audio |
| [kokoro](https://github.com/hexgrad/kokoro) | 0.9.4 | Apache-2.0 | inference pipeline and per-token timings |
| [misaki](https://github.com/hexgrad/misaki) | 0.9.4 | Apache-2.0 | grapheme to phoneme front end (the lexicon overrides use its British phoneme set) |
| [PyTorch](https://pytorch.org) | 2.13.0 | BSD-3-Clause, with Apache-2.0, BSD-2-Clause, BSL-1.0 and MIT parts (package metadata) | runs the model, CPU, pinned to four threads |
| [NumPy](https://numpy.org) | 2.5.2 | BSD-3-Clause, with 0BSD, MIT, Zlib and CC0-1.0 parts (package metadata) | sample handling |
| [python-soundfile](https://github.com/bastibe/python-soundfile) | 0.14.0 | BSD-3-Clause | writes the intermediate WAV |
| [huggingface_hub](https://github.com/huggingface/huggingface_hub) | 1.27.0 | Apache-2.0 | reads the local, offline model cache (`HF_HUB_OFFLINE=1`; `synth.py` also blocks sockets) |
| [spaCy](https://spacy.io) `en_core_web_sm` | 3.8.0 | MIT (the model's `LICENSES_SOURCES` lists the training corpora) | tokeniser used by misaki |
| [espeak-ng](https://github.com/espeak-ng/espeak-ng) | 1.52.0 (Homebrew) | **GPL-3.0-or-later** | out-of-vocabulary pronunciation fallback, loaded through misaki |
| [phonemizer-fork](https://github.com/bootphon/phonemizer) | 3.3.2 | **GPL-3.0-or-later** | misaki's espeak bridge |
| [espeakng-loader](https://github.com/thewh1teagle/espeakng-loader) | 0.2.4 | **no licence declared in the wheel metadata**; the wheel bundles an espeak-ng build | locates the espeak-ng library (patched to the Homebrew one, see `scripts/voice/synth.py`) |
| [FFmpeg](https://ffmpeg.org) | 9.0.2 (Homebrew; configured `--enable-gpl --enable-version3`) | LGPL-2.1-or-later / GPL-3.0-or-later depending on the build | loudness measurement and the native `aac` encoder (AAC-LC, 32 kbps mono 24 kHz). Build-time tool; its code is not in the output |

The environment is CI-Common's `packages/video-kit/scripts/kokoro-setup.sh` (installs under `~/.cache/ci-video-kit/kokoro`). The
syllable-per-second truncation guard in `scripts/voice/lib.mts` is ported from CI-Common `packages/video-kit/src/narrate.ts` (same
organisation, first-party).

**Not used.** Piper (its live engine is GPL-3.0 and each voice model has its own licence, unverified). macOS `say` is a last resort
only; nothing is wired to it, and a lock made with it would have to carry `engine.labelled` (`scripts/test-voiceover.mts` enforces that).
LYGIA and Grassworks are not used anywhere in the story site.

**For counsel before launch** (also open item 5 in the story bible):

1. **GPL build tooling.** espeak-ng and phonemizer-fork are GPL-3.0 programs that run at build time and whose **output** (audio, never
   their code) ships. The usual reading is that program output is not a derivative work, but this is a legal call, not an engineering one.
2. **Training data.** The Kokoro-82M model card states that the training data included synthetic audio from closed TTS providers
   (recorded here from the plan; not re-verified against the live card). Whether that restricts commercial use of the generated audio
   is for counsel; the model and code are Apache-2.0.
3. **espeakng-loader** declares no licence in its wheel metadata. It is a build-time loader and nothing from it ships.
4. **Voice files.** Each of the eight voice `.pt` files is covered by the model's Apache-2.0 licence per the card; their individual
   dataset provenance was not independently checked.
5. The voices are synthetic and disclosed on every surface ("Narration is generated locally with an open text-to-speech model. It is
   not a recording of a person."). No voice imitates a real person.

### Story site: film

The per-family films are made on this machine by `pnpm run story:film` (`scripts/render-family-film.mts`, `scripts/film/`, `assets/story/film/`). Nothing below is shipped
with the site or loaded by a page: the films are files hosted outside the Pages deploy, and the tools that make them are not in them. How it works and how to run
it: [`reference/story/film.md`](reference/story/film.md).

| Component | Version | Licence | Role |
|---|---|---|---|
| [FFmpeg](https://ffmpeg.org) | 9.0.2 (Homebrew; configured `--enable-gpl --enable-version3 --enable-libx264`) | LGPL-2.1-or-later / GPL-3.0-or-later depending on the build | a tool: decodes the voice clips, measures and normalises loudness (`loudnorm`, `alimiter`, `ebur128`), muxes, and runs the QA scans (`silencedetect`, `freezedetect`, `ffprobe`). Not shipped; its code is not in the films |
| [x264](https://www.videolan.org/developers/x264.html) (libx264, through FFmpeg) | as built into the FFmpeg above | **GPL-2.0-or-later** | encodes the H.264 video. A tool whose **output** ships (an encoded stream carries none of its code); the same reading as the espeak-ng note under "Story site: voice", flagged for counsel with it |
| FFmpeg's native AAC encoder | in the FFmpeg above | LGPL-2.1-or-later | encodes the sound. AAC patent licensing is a matter for counsel before a commercial launch (open item in `reference/story/film.md`) |
| [Manrope](https://github.com/sharanda/manrope) | the file in `assets/fonts/` (row above) | OFL-1.1 | the type of every card, caption and title in the film, read from `assets/fonts/` by the page that renders it (the Google Fonts request is stubbed, as in `test-goldens.mts`) |
| Playwright and its Chromium (rows above) | as above | Apache-2.0 | drives the page that renders the frames |
| The loudness method (two passes: measure, then a linear gain and a true-peak limiter a decibel under the ceiling) | ported from CI-Common `packages/video-kit/src/loudness.ts` | first-party (same organisation) | `scripts/film/mux.mts` and `scripts/film/qa.mts` carry about sixty lines of that logic; the kit is **not** imported and is not a dependency |

No stock footage, music, sound effect, image or typeface was added for the film. The voice is the one `Story site: voice` records (Kokoro-82M, generated locally); the picture
is the repo's own renderer; the Companion Core in it is the stylised model the page builds, never a photograph. LYGIA and Grassworks are not used.

CI-Common's video-kit (`ci-video`, video-kit 0.35.0 or newer) composes the films' plates with the house styles: `scripts/film/wrap.mts` runs it (`import-home`, `build`, `check`, `render`) only when the owner points `CI_COMMON_KIT` at a CI-Common checkout (or sets one up with `--setup-kit`); the
kit, and what it brings (HyperFrames, GSAP, Manrope, all listed in CI-Common's own THIRD_PARTY.md), is then a build-time tool of the owner's machine, never a dependency in `package.json`, and nothing of it is imported by this repository (the contract between the two is the JSON file `plates.json`). The plates' encode is ffmpeg with libx264, as the films'.

## Licence texts for adapted source

### furnishup/blueprint3d

```
The MIT License (MIT)

Copyright (c) 2015 FurnishUp Inc. 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### pascalorg/editor

```
MIT License

Copyright (c) 2026 Pascal Group Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### pascalorg/plugin-trees

```
MIT License

Copyright (c) 2026 Pascal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
