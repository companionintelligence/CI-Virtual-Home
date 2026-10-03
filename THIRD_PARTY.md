# Third-party material

> Private & Confidential — Property of Lifescope Inc. Do not distribute. Everything in this repository not
> listed below is first-party (see [NOTICE.md](NOTICE.md)).

Every third-party component this repository ships, adapts, loads or builds with, with its licence and where
its licence text lives. When you add, upgrade or adapt one, update this file in the same commit.

**What may be added** (CLAUDE.md → Licensing has the rule): code under MIT / BSD / ISC / Apache-2.0, and textures, models and
HDRIs that are CC0 or public domain (CC-BY only with the attribution recorded), each verified at its source, with a row here (name,
source URL, author, licence, files, modification) and a content-hashed file name. Not usable: CC-BY-NC, "free for personal use",
unknown or paid assets, LYGIA, Grassworks, Pascal's `/next` demo, and the owner's reference photos. `scripts/test-third-party.mts`
(in `check:quick`) checks that every third-party file has a row and every row a file.

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
`libs/meshopt_decoder.module.js` (24,850 B; meshoptimizer's decoder, MIT © 2016-2022 Arseny Kapoulkine, notice in its header) is byte-identical to the npm package's.

The fonts are OFL-1.1: they may be bundled and redistributed with this software, but not sold on their own, and
a modified version may not use the reserved font names. The capture scripts serve them locally in place of the
Google Fonts stylesheet the pages link (see below), so a golden never depends on the network.

`scripts/vendor/png.mjs` sits beside pixelmatch but is first-party.

**three-mesh-bvh (for the AO bake).** `scripts/vendor/three-mesh-bvh.0.9.15.mjs` is byte-identical to `build/index.module.js` of the npm
package except its first line, where `from 'three'` became the relative path
`../../assets/vendor/three/three.module.min.js` (one three.js instance, no import map in Node). It is used only by `pnpm run ao`; it
is under `scripts/`, not `assets/`, so the portal does not ship it, and nothing in `assets/` imports it. Its GLSL distance
functions (which carry a Shadertoy provenance note) are not used. 

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
1.3.0 (MIT). `scripts/bake-ao.mts` imports the vendored three-mesh-bvh (the *Vendored* table above).

External tools the scripts call but this repository does not include: **ffmpeg** (`render-house-shots.mts`,
`prop-sheet.mts`; LGPL-2.1+/GPL depending on build), **rsvg-convert** from librsvg (`generate_floor_plans.py`,
`generate_house_iso.py --png`; LGPL-2.1+), and **Python 3** (standard library only).

## Live-player realism

Third-party code and assets behind the player's look-only effects (`assets/realism*.ts`, `assets/viewer-*.ts`; README →
*Live realism*). Each package records its own rows under its own sub-heading, between the two marker lines; the shared
rows (the ocean source) are above them; the BVH is in *Vendored* at the top and the prep-time tools are under *Build and test tooling*.

<!-- realism:shared:begin -->
### Shared rows

| Source | Licence | What | Where |
|---|---|---|---|
| [jbouny/fft-ocean](https://github.com/jbouny/fft-ocean) (checked with `gh api`) | MIT — © 2014 Jérémy Bouny | the FFT ocean: the spectrum, the phase and the FFT passes, the normal map and the ocean shader, ported from its three.js r6x API to r169 as a module that loads only at tier 2, for large bodies of water. Modifications are listed by the water package under its own sub-heading; the one known in advance is the `tanh` the shader redeclares, which GLSL ES 3.00 already has and which stops the program compiling. | `assets/viewer-ocean.ts` (lazy) |
| [dli/waves](https://github.com/dli/waves) | MIT — © 2014 David Li | the WebGL ocean fft-ocean's header credits as the original work it is a port of; its notice is kept with fft-ocean's | `assets/viewer-ocean.ts` |

Binary assets (textures, models, baked volumes) are committed only when they are **CC0 or public domain, verified at the
source** (the licence page and the API field are named in the row) and carry a content-hashed name; the rows are under
*assets* below. The owner's reference photos are never committed.

<!-- realism:shared:end -->

#### ao
<!-- realism:ao:begin -->
The baked volumes in `content/ao/` are our own output (a function of our geometry), not third-party material. The only third-party
thing in this package is the vendored three-mesh-bvh, in the *Vendored* table at the top (offline bake only, never shipped).
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
`assets/viewer-sky.ts`, `assets/realism-sky.ts` and the fresnel patch in `assets/viewer-glass.ts` contain no third-party
code, texture, model or HDRI. The shaders are original, written from published algorithms that need no notice: value noise
and fractal Brownian motion (the textbook definitions), the Henyey-Greenstein phase function (Henyey and Greenstein, 1941),
and Schlick's Fresnel approximation (Schlick, 1994). The one-line `fract(sin(dot(...)))` hash is the long-standing public-domain
idiom. LYGIA (dual Prosperity non-commercial / paid licence) and Grassworks (commercial) were not consulted for it.
<!-- realism:sky:end -->

#### grass
<!-- realism:grass:begin -->
No third-party code, texture or model: the grass, the lawn patch, the site bake and the crown shading are original, and
no binary file ships with them. Algorithms they use, all published, none copied from source:

| Source | Licence | What | Where |
|---|---|---|---|
| [Chris Wellons, hash-prospector](https://github.com/skeeto/hash-prospector) "lowbias32" | The Unlicense (public domain) | the two multipliers and the three xor-shifts of the 32-bit integer hash (`0x7feb352d`, `0x846ca68b`); the rest of the hash, its use on a cell, and the value noise built on it are written here | `assets/viewer-grass.ts` (`HASH_GLSL`, `hashU`) |
| Teschner et al., "Optimized Spatial Hashing for Collision Detection of Deformable Objects" (VMV 2003) | a published paper, no code | the two large primes `73856093`, `19349663` that mix a 2-D cell into one word | `assets/viewer-grass.ts` (`gh_cell`, `cellKey`) |
| [Grassworks](https://grassworks.techredux.co/) | commercial product ($199), **reference only** | its public feature list (camera-relative field, levels of detail, wind, interaction) was the brief; no source was seen and none is used. See the shared *Reference only* notes above | none |
<!-- realism:grass:end -->

#### assets
<!-- realism:assets:begin -->
The CC0 detail textures and props of the live player (`assets/media/assets/**`, listed in `assets/media/assets/files.json`, described by
`assets/media-assets.ts`; both written by `pnpm run prep:assets` from `scripts/assets-sources.json`, as is this table). **Licence
evidence.** Poly Haven: <https://polyhaven.com/license> (fetched 2026-10-01) states that every asset is CC0 and needs no credit; its
API (`api.polyhaven.com/info/<id>`) has no per-asset licence field, so the site-wide page and the authors it lists are recorded. ambientCG:
<https://docs.ambientcg.com/license/> (fetched 2026-10-01) states that every asset is CC0 1.0 Universal. The authors are recorded although no
credit is required. Poly Haven's API terms (a unique User-Agent, few calls) are followed by the prep script; nothing is scraped.

The decoder for the models (`assets/vendor/three/libs/meshopt_decoder.module.js`, meshoptimizer, MIT) is part of the three.js row under *Vendored*.

| Source | Licence | Authors | Files | Modification |
|---|---|---|---|---|
| [Poly Haven · laminate_floor_02](https://polyhaven.com/a/laminate_floor_02) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Dario Barresi (processing); Charlotte Baglioni (photography) | `tex/oak-laminate-albedo-4f48b5e8.webp`, `tex/oak-laminate-albedo1k-5284cde1.webp`, `tex/oak-laminate-normal-38aa5b77.webp`, `tex/oak-laminate-rough-2479d9a1.webp` | Albedo reduced to its luma with contrast 1, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 1.8 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically and turned 90°; all WebP. Replaces the procedural `oak` set at 1.7 m. |
| [Poly Haven · herringbone_parquet](https://polyhaven.com/a/herringbone_parquet) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Jenelle van Heerden (processing); Sergej Majboroda (photography) | `tex/parquet-albedo-d12b0d6e.webp`, `tex/parquet-albedo1k-ca4295c4.webp`, `tex/parquet-normal-71896703.webp`, `tex/parquet-rough-8cc41fdf.webp` | Albedo reduced to its luma with contrast 1, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 1.8 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `herringbone` set at 3.4 m. |
| [Poly Haven · concrete_floor_worn_001](https://polyhaven.com/a/concrete_floor_worn_001) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Dimitrios Savva (photography); Rico Cilliers (processing) | `tex/concrete-worn-albedo-cc5ab2b6.webp`, `tex/concrete-worn-albedo1k-bf39e855.webp`, `tex/concrete-worn-normal-ecc1b7eb.webp`, `tex/concrete-worn-rough-df44c5bf.webp` | Albedo reduced to its luma with contrast 0.7, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `concrete` set at 3 m. |
| [Poly Haven · concrete_pavement](https://polyhaven.com/a/concrete_pavement) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Charlotte Baglioni | `tex/concrete-pavement-albedo-5ef7817d.webp`, `tex/concrete-pavement-albedo1k-e338c9ca.webp`, `tex/concrete-pavement-normal-e1dfb1b2.webp`, `tex/concrete-pavement-rough-f4c9d21a.webp` | Albedo reduced to its luma with contrast 0.7, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `concrete:exterior` set at 1.8 m. |
| [Poly Haven · red_brick](https://polyhaven.com/a/red_brick) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Rob Tuytel | `tex/brick-albedo-9d90ed84.webp`, `tex/brick-albedo1k-9992817c.webp`, `tex/brick-normal-201935f6.webp`, `tex/brick-rough-2c52d7bd.webp` | Albedo reduced to its luma (keeping 50% of the local colour variation) with contrast 0.8, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `brick` set at 1.9 m. |
| [Poly Haven · brown_planks_05](https://polyhaven.com/a/brown_planks_05) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Rob Tuytel | `tex/siding-albedo-9eca7e8e.webp`, `tex/siding-albedo1k-1faa908e.webp`, `tex/siding-normal-2d53a2ff.webp`, `tex/siding-rough-88b2dadc.webp` | Albedo reduced to its luma with contrast 0.7, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `siding` set at 1.8 m. |
| [Poly Haven · stone_tile_wall](https://polyhaven.com/a/stone_tile_wall) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Charlotte Baglioni | `tex/stone-wall-albedo-48c38292.webp`, `tex/stone-wall-albedo1k-7bf4deab.webp`, `tex/stone-wall-normal-c90e3838.webp`, `tex/stone-wall-rough-721fe64b.webp` | Albedo reduced to its luma with contrast 0.7, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `stone` set at 2 m. |
| [Poly Haven · wood_floor_deck](https://polyhaven.com/a/wood_floor_deck) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Dimitrios Savva | `tex/deck-albedo-82317544.webp`, `tex/deck-albedo1k-e14e7b19.webp`, `tex/deck-normal-b981baf3.webp`, `tex/deck-rough-aa7c6a90.webp` | Albedo reduced to its luma with contrast 0.8, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically and turned 90°; all WebP. Replaces the procedural `deck` set at 1.8 m. |
| [Poly Haven · asphalt_04](https://polyhaven.com/a/asphalt_04) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Jenelle van Heerden (processing); Sergej Majboroda (photography) | `tex/asphalt-albedo-273ffe67.webp`, `tex/asphalt-albedo1k-bf2a3366.webp`, `tex/asphalt-normal-fc3ddb9a.webp`, `tex/asphalt-rough-7e5abbe0.webp` | Albedo reduced to its luma with contrast 0.7, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `asphalt` set at 4.04 m. |
| [Poly Haven · clay_roof_tiles_02](https://polyhaven.com/a/clay_roof_tiles_02) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Amal Kumar | `tex/clay-tile-albedo-a576956f.webp`, `tex/clay-tile-albedo1k-4c8a51ad.webp`, `tex/clay-tile-normal-954a1a20.webp`, `tex/clay-tile-rough-9f6f17bc.webp` | Albedo reduced to its luma (keeping 30% of the local colour variation) with contrast 0.8, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `clay-tile` set at 2.5 m. |
| [ambientCG · Tiles107](https://ambientcg.com/a/Tiles107) | CC0 1.0 — [docs.ambientcg.com/license/](https://docs.ambientcg.com/license/) | ambientCG | `tex/tile-albedo-c7cfb229.webp`, `tex/tile-albedo1k-c5d148e6.webp`, `tex/tile-normal-41be8996.webp`, `tex/tile-rough-3246b4ad.webp` | Albedo reduced to its luma with contrast 0.8, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength 0.85 and re-normalised; roughness (G of the ARM map / the Roughness map) at 512 px, floor 0.25; flipped vertically; all WebP. Replaces the procedural `tile` set at 4.8 m. |
| [Poly Haven · ceramic_vase_01](https://polyhaven.com/a/ceramic_vase_01) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | James Ray Cock | `models/vase-01-98ce4a1d.glb` (60 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 10296 to 3000 triangles, positions quantized to 14 bits, textures WebP at 1024 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `vase`. |
| [Poly Haven · ceramic_vase_02](https://polyhaven.com/a/ceramic_vase_02) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | James Ray Cock | `models/vase-02-b9bc3c91.glb` (77 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 11128 to 3000 triangles, positions quantized to 14 bits, textures WebP at 512 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `vase`. |
| [Poly Haven · ceramic_vase_03](https://polyhaven.com/a/ceramic_vase_03) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | James Ray Cock | `models/vase-03-f21fd574.glb` (232 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 11136 to 3000 triangles, positions quantized to 14 bits, textures WebP at 1024 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `vase`. |
| [Poly Haven · ceramic_vase_04](https://polyhaven.com/a/ceramic_vase_04) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | James Ray Cock | `models/vase-04-4dab40f9.glb` (61 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 9000 to 2999 triangles, positions quantized to 14 bits, textures WebP at 512 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `vase`. |
| [Poly Haven · wall_clock](https://polyhaven.com/a/wall_clock) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | PierreB3D | `models/wall-clock-b39e9679.glb` (84 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 3658 to 2504 triangles, positions quantized to 14 bits, textures WebP at 512 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `wall-clock`. |
| [Poly Haven · side_table_01](https://polyhaven.com/a/side_table_01) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | James Ray Cock | `models/side-table-331bcf48.glb` (168 KB) | glTF 1k → meshopt-compressed GLB: welded, not simplified, positions quantized to 14 bits, textures WebP at 1024 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `side-table`. |
| [Poly Haven · modern_coffee_table_01](https://polyhaven.com/a/modern_coffee_table_01) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Amin | `models/coffee-table-71c18bf1.glb` (143 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 4504 to 3500 triangles, positions quantized to 14 bits, textures WebP at 1024 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `coffee-table`. |
| [Poly Haven · fern_02](https://polyhaven.com/a/fern_02) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Rob Tuytel (scanning); Rico Cilliers (modeling) | `models/fern-06cb276c.glb` (157 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 6232 to 3998 triangles, positions quantized to 14 bits, textures WebP at 1024 px; scaled and placed at run time to the procedural prop it stands in for. Stands in for `fern`. |
| [Poly Haven · wooden_bowl_02](https://polyhaven.com/a/wooden_bowl_02) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Kuutti Siitonen | `models/bowl-191d000e.glb` (97 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 4666 to 1200 triangles, positions quantized to 14 bits, textures WebP at 512 px. Stands in for `fruit-bowl`. |
| [Poly Haven · lemon](https://polyhaven.com/a/lemon) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Kuutti Siitonen | `models/lemon-1867a3f8.glb` (32 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 4012 to 600 triangles, positions quantized to 14 bits, textures WebP at 512 px. Placed in the fruit bowl where the procedural fruit sat. |
| [Poly Haven · food_apple_01](https://polyhaven.com/a/food_apple_01) | CC0 1.0 — [polyhaven.com/license](https://polyhaven.com/license) | Oliver Harries | `models/apple-cadde291.glb` (48 KB) | glTF 1k → meshopt-compressed GLB: welded, simplified from 7012 to 630 triangles, positions quantized to 14 bits, textures WebP at 512 px. Placed in the fruit bowl where the procedural fruit sat. |

Considered and not used: `beige_wall_001` (a smooth painted wall: its albedo is a flat tone and its normal map nearly flat, so after the luma-only normalisation the swap added nothing and, in an A/B still of the aurora stucco walls, replaced the kit's fine stucco grain with a blank surface. The kit keeps its procedural stucco); `mid_century_lounge_chair` (dark leather and bent plywood against a kit club chair in oatmeal or white upholstery: the palette tint multiplies the texture, so it cannot lighten a dark one and the chair would break the room palette (judged from the source's materials, not from a render of it in a house)); `wooden_display_shelves_01` (a tall open wooden shelf (1.08 x 0.37 x 1.56 m, from the source's bounding box) against the kit cube-storage, a 0.76 m low cubby grid in painted colours: it would fail the fit gate, so it was not adopted); `potted_plant_04` (one potted succulent against the kit succulent-tray, a tray of five plants (0.36 x 0.2 m): no honest fit); `wicker_basket_01` (a shallow 0.38 x 0.12 m basket against the kit laundry-basket, a 0.6 m hamper with laundry: wrong object); `Gravel023` (no procedural kind to replace (the swap list is oak, herringbone, concrete, stucco, brick, siding, stone, asphalt, clay-tile, deck, tile)).
<!-- realism:assets:end -->

#### frame
<!-- realism:frame:begin -->
No third-party code or asset is added by the frame package. It is built from the vendored three.js r169 addons that are already
listed above (`GTAOPass`, `UnrealBloomPass`, `SMAAPass`, `Pass`/`FullScreenQuad`, `OutputShader`, MIT) and from public algorithms
written fresh: the Halton low-discrepancy sequence (bases 2 and 3) for the sub-pixel jitter, a running-mean accumulation, and a
tone-map / grade resolve that reuses three's own `tonemapping_pars_fragment` and `colorspace_pars_fragment` chunks. LYGIA was not
consulted and none of its noise, grading or tone-mapping code is used. `assets/light-guard.ts` patches three's
`lights_fragment_begin` / `lights_pars_begin` chunk text at run time (the box test is original code).
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
