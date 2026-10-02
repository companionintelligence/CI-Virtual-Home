# Third-party material

> Private & Confidential — Property of Lifescope Inc. Do not distribute. Everything in this repository not
> listed below is first-party (see [NOTICE.md](NOTICE.md)).

Every third-party component this repository ships, adapts, loads or builds with, with its licence and where
its licence text lives. When you add, upgrade or adapt one, update this file in the same commit.

## Vendored — shipped in this repository

| Component | Version | Licence | Where | Licence text |
|---|---|---|---|---|
| [three.js](https://threejs.org) — core module build + 24 addon files from `examples/jsm` (OrbitControls, TransformControls, EffectComposer and passes, GTAO, SMAA, bloom, GLTFExporter/Loader, RoomEnvironment, utils, and `libs/meshopt_decoder.module.js`, the decoder for the meshopt-compressed models of the live player's CC0 props) | r169 (`three@0.169.0`) | MIT — © 2010-2024 three.js authors | [`assets/vendor/three/`](assets/vendor/three/) | [`assets/vendor/three/LICENSE`](assets/vendor/three/LICENSE) |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — the BVH ray-caster of the offline ambient-occlusion bake (`scripts/bake-ao.mts`); never loaded by the player and not shipped to the site | 0.9.15 (`three-mesh-bvh@0.9.15`; tarball integrity `sha512-9xdEDkCzFoT8VPFH9DznwFSdbaIEjMvM106Iqq7TJurrIheUKDcdW4prfJTCxryih4XS/UxWs0H3K4MLMRFyOQ==`; `build/index.module.js` sha256 `4a1f29ae93208d5f97a1652182c2d3133ce9cf51a6ffffc04f4d20255bf21afe`) | MIT — © 2018 Garrett Johnson (`gh api repos/gkjohnson/three-mesh-bvh/license`: MIT) | [`scripts/vendor/three-mesh-bvh.0.9.15.mjs`](scripts/vendor/three-mesh-bvh.0.9.15.mjs) | [`scripts/vendor/LICENSE-three-mesh-bvh.txt`](scripts/vendor/LICENSE-three-mesh-bvh.txt) |
| [pixelmatch](https://github.com/mapbox/pixelmatch) | 7.2.0 | ISC — © 2025 Mapbox | [`scripts/vendor/pixelmatch.mjs`](scripts/vendor/pixelmatch.mjs) | [`scripts/vendor/LICENSE-pixelmatch.txt`](scripts/vendor/LICENSE-pixelmatch.txt) |
| [Manrope](https://github.com/sharanda/manrope) — variable, Latin subset (from `@fontsource-variable/manrope` 5.3.0, via CI-Common `styles/fonts/files/`) | v4.504 | OFL-1.1 — © 2019 The Manrope Project Authors | [`assets/fonts/manrope-latin-var.woff2`](assets/fonts/manrope-latin-var.woff2) | [`assets/fonts/LICENSE-Manrope.txt`](assets/fonts/LICENSE-Manrope.txt) |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — variable, Latin subset (from `@fontsource-variable/jetbrains-mono` 5.3.0, via CI-Common) | v2.211 | OFL-1.1 — © 2020 The JetBrains Mono Project Authors | [`assets/fonts/jetbrains-mono-latin-var.woff2`](assets/fonts/jetbrains-mono-latin-var.woff2) | [`assets/fonts/LICENSE-JetBrains-Mono.txt`](assets/fonts/LICENSE-JetBrains-Mono.txt) |
| [Lucide](https://lucide.dev) icon path data (from `lucide-react` 0.469.0), inlined as the SVG sprite | 0.469.0 | ISC — © Lucide Contributors 2022; portions © Cole Bemis 2013-2022 (Feather, MIT) | [`room-creator.html`](room-creator.html) (the `<symbol>` sprite), [`index.html`](index.html) (the gallery's sprite), [`assets/viewer.ts`](assets/viewer.ts) (the player's `ICONS`) | inline, above the room-creator sprite |

**Local modification.** The three.js files are byte-identical to the `three@0.169.0` npm package except one:
`postprocessing/GTAOPass.js` `generateNoise()` seeds its `SimplexNoise` with mulberry32 instead of
`Math.random`, so every frame's ambient-occlusion dither is the same (the determinism the goldens depend on).
`libs/meshopt_decoder.module.js` (24,850 B) is byte-identical to the npm package's.

The fonts are OFL-1.1: they may be bundled and redistributed with this software, but not sold on their own, and
a modified version may not use the reserved font names. The capture scripts serve them locally in place of the
Google Fonts stylesheet the pages link (see below), so a golden never depends on the network.

`scripts/vendor/png.mjs` sits beside pixelmatch but is first-party.

**ao — baked ambient occlusion.** `scripts/vendor/three-mesh-bvh.0.9.15.mjs` is byte-identical to `build/index.module.js` of the npm
package except its first line, where `from 'three'` became the relative path
`../../assets/vendor/three/three.module.min.js` (one three.js instance, no import map in Node). It is used only by `pnpm run ao`; it
is under `scripts/`, not `assets/`, so the portal does not ship it, and nothing in `assets/` imports it. Its GLSL distance
functions (which carry a Shadertoy provenance note) are not used. The volumes in `content/ao/` are our own output (a function
of our geometry), not third-party material, and no third-party image, texture or model was added for this feature.

## Adapted source — code or proportions reworked into our own files

| Source | Licence | What was adapted | Into |
|---|---|---|---|
| [furnishup/blueprint3d](https://github.com/furnishup/blueprint3d) | MIT — © 2015 FurnishUp Inc. | the Corner / Wall / HalfEdge / Room model and `findRooms`, from `src/model/{corner,wall,half_edge,room,floorplan}.ts` and `core/utils.ts` (minus jQuery and THREE) | [`assets/floorplan-graph.ts`](assets/floorplan-graph.ts) |
| [pascalorg/editor](https://github.com/pascalorg/editor) | MIT — © 2026 Pascal Group Inc. | the scene-referred grade (contrast about mid-grey + saturation lift, `GRADE_PARAMS`); the gradient-sky environment approach (`packages/viewer/src/components/viewer/scene-environment.tsx`); fog that takes the sky's own colour along each view ray (`fogRadiance` in `scene-atmosphere.tsx`, re-done as WebGL fog chunks in `installSkyFog`) | [`assets/environment.ts`](assets/environment.ts) |
| [pascalorg/editor](https://github.com/pascalorg/editor) | MIT — © 2026 Pascal Group Inc. | roof trim proportions — the k-style gutter's 0.13 m size and 0.07 m leaders on a 0.02 m standoff (`packages/core/src/schema/nodes/gutter.ts`, `downspout.ts`), plumb 1×8 fascia and rake boards (`roof-segment.ts`); the geometry is our own | [`assets/roofs.ts`](assets/roofs.ts) |
| [pascalorg/plugin-trees](https://github.com/pascalorg/plugin-trees) | MIT — © 2026 Pascal | flower-head geometry (daisy ring, tulip cup, lavender spike; `src/flower-geometry.ts`), the grass tuft of flattened leaning cones (`src/grass-geometry.ts`) and the one-geometry-per-variant instancing pattern | [`assets/site.ts`](assets/site.ts) |

Their licence texts are reproduced at the end of this file.

### Live realism: sky and glass

`assets/viewer-sky.ts`, `assets/realism-sky.ts` and the fresnel patch in `assets/viewer-glass.ts` contain no third-party
code, texture, model or HDRI. The shaders are original, written from published algorithms that need no notice: value noise
and fractal Brownian motion (the textbook definitions), the Henyey-Greenstein phase function (Henyey and Greenstein, 1941),
and Schlick's Fresnel approximation (Schlick, 1994). The one-line `fract(sin(dot(...)))` hash is the long-standing public-domain
idiom. LYGIA (dual Prosperity non-commercial / paid licence) and Grassworks (commercial) were not consulted for it.

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

- **LYGIA** ([patriciogonzalezvivo/lygia](https://github.com/patriciogonzalezvivo/lygia)) is dual-licensed Prosperity
  (non-commercial) or a paid Patron licence, and this repository is proprietary: none of its code is copied, translated
  or paraphrased. The live player's noise, colour-grading and tone-mapping GLSL is written fresh from the public
  algorithms (hash and value noise, fbm, Schlick's fresnel, Gerstner waves, a Rayleigh / Mie sky, the Halton sequence,
  an ACES fit).
- **Grassworks** (grassworks.techredux.co) is a commercial product ($199). Only its public feature list was read, as a
  reference for what a grass system offers; the grass system here is an original design and no source of it was seen.
- **Quaternius** model packs: the pack pages say CC0, but the site now publishes its own non-CC0 asset licence for newer
  releases and downloads are manual, so nothing from it is used. (Likewise not used: Kenney's flat-colour toy style,
  Sketchfab, Poly Pizza and OpenGameArt, whose per-model licences are mixed, and any CC-BY-NC, "free for personal use",
  unknown-licence or paid asset.)
- **three-gpu-pathtracer**'s `DenoiseMaterial` (BSD-2) was considered for idle accumulation and deferred: nothing of it
  is in the repository.

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

Run at prep time with `pnpm dlx` and never added as a dependency (they make `assets/media/**`, `scripts/prep-assets.mts`):
[`@gltf-transform/core`, `/extensions`, `/functions`, `/cli`](https://gltf-transform.dev) 4.5.1 (MIT),
[`sharp`](https://sharp.pixelplumbing.com) 0.35.5 (Apache-2.0) and [`meshoptimizer`](https://github.com/zeux/meshoptimizer)
1.3.0 (MIT). `scripts/bake-ao.mts` imports the vendored three-mesh-bvh below.

External tools the scripts call but this repository does not include: **ffmpeg** (`render-house-shots.mts`,
`prop-sheet.mts`; LGPL-2.1+/GPL depending on build), **rsvg-convert** from librsvg (`generate_floor_plans.py`,
`generate_house_iso.py --png`; LGPL-2.1+), and **Python 3** (standard library only).

## Live-player realism

Third-party code and assets behind the player's look-only effects (`assets/realism*.ts`, `assets/viewer-*.ts`; README →
*Live realism*). Each package records its own rows under its own sub-heading, between the two marker lines; the shared
rows (the ocean source, the BVH, the tooling) are above them.

<!-- realism:shared:begin -->
### Shared rows (written once, by the scaffold)

| Source | Licence | What | Where |
|---|---|---|---|
| [jbouny/fft-ocean](https://github.com/jbouny/fft-ocean) (checked with `gh api`) | MIT — © 2014 Jérémy Bouny | the FFT ocean: the spectrum, the phase and the FFT passes, the normal map and the ocean shader, ported from its three.js r6x API to r169 as a module that loads only at tier 2, for large bodies of water. Modifications are listed by the water package under its own sub-heading; the one known in advance is the `tanh` the shader redeclares, which GLSL ES 3.00 already has and which stops the program compiling. | `assets/viewer-ocean.ts` (lazy) |
| [dli/waves](https://github.com/dli/waves) | MIT — © 2014 David Li | the WebGL ocean fft-ocean's header credits as the original work it is a port of; its notice is kept with fft-ocean's | `assets/viewer-ocean.ts` |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) 0.9.15 (checked with `gh api`) | MIT — © 2018 Garrett Johnson | the bounding-volume hierarchy the ambient-occlusion bake casts its rays through. One edit: its `import … from 'three'` becomes the path of this repository's vendored three. It runs in `scripts/bake-ao.mts` only and is **not shipped** to the site. Its GLSL distance functions (a Shadertoy-derived footnote in its source) are not used and must not be shipped. | `scripts/vendor/three-mesh-bvh.0.9.15.mjs`, licence: `scripts/vendor/LICENSE-three-mesh-bvh.txt` |

Binary assets (textures, models, baked volumes) are committed only when they are **CC0 or public domain, verified at the
source** (the licence page and the API field are named in the row) and carry a content-hashed name; the rows are under
*assets* below. The owner's reference photos are never committed.

<!-- realism:shared:end -->

#### ao
<!-- realism:ao:begin -->
<!-- realism:ao:end -->

#### water
<!-- realism:water:begin -->
Code only; no binary asset. LYGIA is not used (its licence forbids it): the hash, noise and shading code in
`assets/viewer-water.ts` is original, written from the public algorithms (integer hash `lowbias32` by Chris Wellons, public
domain; cellular edges; Schlick Fresnel; Toksvig roughness).

| What | Source | Author | Licence | Files | Modification |
|---|---|---|---|---|---|
| FFT ocean (initial spectrum, phase/spectrum pass, Stockham FFT, normals pass) | https://github.com/jbouny/fft-ocean at commit 930c096 (2015-09-28); licence checked with `gh api repos/jbouny/fft-ocean/license` | © 2014 Jérémy Bouny; its spectrum and FFT code credits dli/waves (© 2014 David Li, MIT, `gh api repos/dli/waves/license`) | MIT (both notices are in the module header; the licence texts are under the shared rows above) | `assets/viewer-ocean.ts` | Ported to three r169: `float tanh()` deleted (a compile error on r169), setRenderTarget/render/restore, PlaneGeometry, float32 only for the NEAREST ping-pong targets and half float for the displacement and normal maps, a deterministic integer-hash Box-Muller gaussian instead of `Math.random`, phase = omega(k) t computed in the spectrum shader (the surface is a pure function of t), the omega operator-precedence slip and the standing-wave h0 fixed, the screen-projected grid, the mirror, the original tone mapping and sky constants dropped, normals packed with the Jacobian foam in alpha for `viewer-water.ts` |
<!-- realism:water:end -->

#### sky
<!-- realism:sky:begin -->
<!-- realism:sky:end -->

#### grass
<!-- realism:grass:begin -->
<!-- realism:grass:end -->

#### assets
<!-- realism:assets:begin -->
<!-- realism:assets:end -->

#### frame
<!-- realism:frame:begin -->
<!-- realism:frame:end -->

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

### jbouny/fft-ocean

```
The MIT License (MIT)

Copyright (c) 2014 Jérémy Bouny

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

### dli/waves

```
The MIT License (MIT)

Copyright (c) 2014 David Li (http://david.li)

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

### gkjohnson/three-mesh-bvh

```
MIT License

Copyright (c) 2018 Garrett Johnson

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
