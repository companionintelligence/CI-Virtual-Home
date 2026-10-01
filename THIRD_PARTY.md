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

## Story site: landing

The public site (`pnpm run portal:build` → `dist/`, see README → The public site) adds this to what it ships. Nothing here is
loaded from a third party at run time: the site makes no third-party request.

| Component | Version | Licence | Where | Licence text |
|---|---|---|---|---|
| [Archivo Black](https://github.com/Omnibus-Type/ArchivoBlack) — Latin subset, via CI-Common `styles/fonts/files/archivo-black-latin.woff2` (the canon's display face: the landing's headline, kickers and big numerals only) | as in CI-Common | OFL-1.1 — © 2017 The Archivo Black Project Authors | [`portal/fonts/archivo-black.woff2`](portal/fonts/archivo-black.woff2); shipped as `portal/fonts/archivo-black.<hash10>.woff2` | [`portal/fonts/LICENSE-Archivo-Black.txt`](portal/fonts/LICENSE-Archivo-Black.txt) (shipped beside the font) |
| Manrope and Lucide icon path data (a few more symbols: menu, sliders, film, search) | as in the table above | OFL-1.1 · ISC | `assets/fonts/`, inlined in `index.html` and `scripts/story/pages.mts` | as above |
| The first-run drawings and the monogram discs | first-party | — | `scripts/story/pages.mts` (inline SVG) | — |

The pictures on the site (thumbnails, posters, link previews, the hero) are renders of our own HouseSpecs; the link previews
are drawn by `scripts/story/build-og.mts` over them. No photograph, portrait, logo of a third-party app or app screenshot is used:
third-party apps are named in text only.

**Considered and not used.** [axe-core](https://github.com/dequelabs/axe-core) (the accessibility checker) is **MPL-2.0**, which
is outside the licence list this repository takes (MIT, BSD, ISC, Apache-2.0, CC0), so `pnpm run portal:test` carries its own
audit (`AUDIT` in `scripts/test-portal.mts`: names, landmarks, headings, labels, ids, contrast). If the owner approves MPL-2.0 for a
test-only devDependency, it can be added beside it.

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
