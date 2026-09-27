# House generator — design verdict and work plan

> **Historical record.** Written in CI-Common on 2026-09-15, when this system lived under `infographic/` (later
> `generated/infographics/`) and its scripts were `.mjs`. Paths and commands below are left as they were; in this
> repo drop the prefix (`infographic/scripts/x.mjs` → `scripts/x.mts`, or the `pnpm run` names in the README).
> PR, branch and commit references are CI-Common's.

*Companion Intelligence product-shot houses · three.js r169 vanilla importmap · reviewed against worktree `suspicious-hodgkin-e6efec`, branch `clau/house-render-foundation` @ `8f35e87` · 2026-09-15*

## 1. Verdict

**Is the generation system designed well?** The architecture is right; the platform underneath it is unfinished, and the owner's five complaints are all symptoms of the same gap.

What is genuinely good: `createHouseBuilder(deps)` is a real spec-to-scene compiler with injected dependencies and no DOM; plan geometry (`assets/house-geometry.js`) is shared between browser and Node; the stepped-frame capture (`applySplineFrame(i/(N-1))` → JPEG → one bitexact ffmpeg per shot, resumable manifest) is the correct instrument; the QA gate samples the scene *as displayed*; wall visibility has one choke point; Phase 2 (floorplan-graph + wall-compiler) shows the team can build a THREE-free model with tests behind a flag.

What is not: **the compiler stops at geometry.** Nothing between the spec and the meshes owns presentation, materials, vocabulary or randomness, so:

- **Dollhouse videos.** `currentWallMode = 'cutaway'` is the page default, `shots[]` carries only `{id,type,duration}`, and `__houseRenderBegin` never sets a mode. The video pipeline simply inherited the editor. `8f35e87` forces walls-up per shot, but it is still a side effect of `splineSelect.value`, and it has a live bug: `mat.userData.wasTransparent` is read at `room-creator.html:1935` and written nowhere, so the A-frame glass roofs (lakecabin, neweco, sunnyhome) go opaque after the QA gate's first `setRoofOpacity(1)`.
- **Lawn acne.** Three ground faces are coplanar at y=0, a 60×60 m `ShadowMaterial` catcher writes depth at y=0 (`:1532–1536`, still present), and the sun frustum is a fixed ±16 m box (`:1494`) that no 26–36 m lot fits — shadows are clipped along a diagonal on every house. The committed workaround (lawn at −0.08 → top −0.02) floats all 669 site items 2 cm. Bias was never the cause.
- **Every house the same.** 30 specs author 27 wall, 25 accent and 6 `material` values; `palette.accent` and `palette.material` have zero readers. AssetFactory has 180 colour literals from one Tailwind-slate palette; 9 of 56 builders take any colour, none take a theme. `tile`/`deck` validate and render as oak.
- **Rectangular planting.** No seeded RNG, no `InstancedMesh`, no polyline site type anywhere. Every tree is `lollipopTree(5)`, every shrub `r=0.6`; 242/355 vegetation items sit on a 0.5 m grid because the schema cannot say anything else.
- **Determinism is claimed, not true.** 15 `Math.random()` calls in floor textures, `GTAOPass.generateNoise()` unseeded (`vendor/three/postprocessing/GTAOPass.js:540`), `CanvasTexture`s without `colorSpace`, and the RoomEnvironment PMREM at `:1510` overwritten by `pascalSkyTexture` at `:1589` — the ambient was halved against an IBL that never took effect.
- **Six registries, three languages.** ITEMS/SITE, validator enums, iso CATALOG, floor-plan footprints, UI catalogData, HOUSE-SPEC table — plus BRIEF.md and apply.mjs DIMS copied from memory with wrong sizes. That is why 176 of 258 judge findings are facing/footprint errors and why the iso draws every circular rug at 4 m.

**Grade: design B-, execution C.** Nothing needs replacing. The r169 addons already vendored (GTAO, SSAA/SMAA, MeshSurfaceSampler-class tools, GLTFLoader, RoomEnvironment, NeutralToneMapping) cover the rendering gap; the work is giving the spec authority over dressing, materials, catalog and seeds, and putting a golden-image gate in front of 30 houses so re-lays stop regressing silently.

## 2. Plan

Status as of 2026-09-15, against `clau/house-qa-post-525dad`. ✅ done · ◐ partly done · ☐ not started.

| # | Item | Addresses | Effort | Depends on | |
|---|------|-----------|--------|------------|---|
| 1 | Ground stack + per-house sun frustum | lawn acne, shadow cut-off, pools, floating site items | hours | — | ✅ `81c1f20` |
| 2 | Shot dressing in the spec; Sims rule; ceilings; dither fade | dollhouse videos, roof pop, glass roofs | day | 1 | ✅ `5a88556` |
| 3 | Determinism + colour pipeline; frame-hash test | non-deterministic frames, washed-out floors, colour drift | hours–day | — | ◐ `81c1f20` — no OKLCH pass over the 30 palettes |
| 4 | Golden-image + scene-graph QA gate in CI | silent regressions | day | 3 | ✅ scene graph `5c4fadd`, goldens + CI this pass |
| 5 | Material kit: palette compiled, cladding, roles, glass | sameness | days | 3 | ✅ `f9e3532` |
| 6 | One prop/site catalog manifest from code | six drifting registries, wrong footprints | day | — | ✅ `20a9297` |
| 7 | Seeded variation + bed/hedge/path/scatter/grove | rectangular, repetitive planting | days | 3, 6 | ✅ `8ffc2d5` |
| 8 | Atoms, dressing props, Kenney kits via GLTFLoader | too few props, filler padding | days | 5, 6 | ◐ `ba87052` — ~150 parametric props, no Kenney kits |
| 9 | Layout loop: READ→LAY→JUDGE, SITE pass, anchor sets | layouts/colour/composition vs slides | days | 4, 6, 8 | ☐ |
| 10 | Post stack: seeded GTAO, 2× SSAA, one composer | flat look, edge quality | hours | 3 | ✅ `3844e03` |
| 11 | Lighting as data; azimuth from entry; roof-on fill | twilight-at-noon, rim leak, roof-on = roof-off | day | 2, 3 | ◐ `de28086` — data + azimuth + rim; no roof-on interior fill |
| 12 | Extract engine modules under the hash test | 8k-line page, hidden couplings | days | 3, 4 | ☐ |
| 13 | `plan.json` for Python twins; strip hero dupes; kill tours | twin drift, ungated tours | day | 6, 7 | ◐ `8ffc2d5` — plan.json ships; hero dupes and HOUSE_TOURS stand |
| 14 | Wall-system fork: graph walls on or Phase 2 out | double wall fixes | day | 4, 12 | ☐ |

Items 1–3 change every pixel; land them together and re-baseline posters once. 6 runs in parallel from day one.

### What the four 2026-09-15 commits changed, and what they turned up

`5a88556` · **item 2.** Every generated shot carries `dressing: { walls, roof }`, overridable per spec
(`walls: up | cutaway | down | sims`, `roof: on | off | auto`, `enterT`). `sims` cuts exterior walls one at a
time, per frame, by a pure function of the eye and target — **no hysteresis on t**, because frames render by
random access and anything stateful would make frame 330 depend on whether 329 was drawn; a 0.15 m dead band
on the facing test does that job. `activeShot` replaces the substring tests on the preset key, so an aliased
shot id keeps its type. Roof fade is r169 `alphaHash` dissolve, not alpha: an opaque roof stays in the depth
buffer and in GTAO, so the interior AO goes when the roof does rather than at the *start* of the fade. The
validator checks `spec.shots` at all for the first time, and stops trying to validate the `.plan.json` twins.

`3844e03` · **item 10.** 2 × 2 supersampling (12.8 % of poster pixels change, mean Δ 4.4, all on edges; 32 →
52 ms per 1080p frame). `houseContactSheet` — what the layout judge reads — goes through the same composer as
the video. The supersample factor is part of the composer's cache key, or `__houseSupersample` silently does
nothing.

`de28086` · **item 11.** Seven preset branches all set the same two world positions, so a house whose door faced
north was lit from behind: **aurora's product shot had no visible cast shadow at all** — turning `castShadow`
off barely changed the poster. A preset is data now and the sun swings round from the entry's own bearing. Rim
capped at 0.4 (three presets ran 1.3–1.6, and it casts no shadows, so it lit interiors through their walls).
`rimLight.target` was never in the scene graph, so the light never aimed. Shadow box holds the shadows the lot
throws, and `normalBias` is divided by `sin(elevation)` — acne is a grazing-angle problem.

`5c4fadd` · **item 4, the half that needs no goldens.** `userData.role` on everything, so the gate stops
matching display names. `__houseSceneQA` per house: dressing took, nothing threaded through a wall, planting
not on a grid. Two corrections were needed before item-in-wall meant anything — testing per **mesh** (an
L-shaped kitchen run's bounding box spans the wall its cabinets sit along: 16 false positives, all gone) and
skipping **foliage** (a splayed leaf's box is not the leaf: 130 of 210). 17 findings remain over 30 houses,
mostly beds pushed into the wall behind them; valleyview's was confirmed by rendering the elevation from
outside. `planting-grid` fires on none of the 30 — the seeded planting measures up.

### The golden gate (item 4, second half)

`scripts/test-goldens.mjs` renders 4 frames a house — each shot's poster, plus the last frame of the two that
end framed on the Core — at 640 × 360 through the same composer the video uses, and compares them to 120
baselines committed under `generated/infographics/test/goldens/<profile>/` in LFS (~11 MB). `generated/infographics/.gitattributes`
is directory-local so it rides along the eventual move to `generated/infographics/`; a root-level pattern
silently stops matching after that move, which was verified in a scratch repo rather than assumed.

Four things the building of it turned up, none of which the review anticipated:

- **pixelmatch alone cannot see a global shift.** Its threshold is a perceptual distance applied per pixel, so
  a change smaller than that distance is invisible to it *everywhere at once*. Raising one preset's key light
  by 2 % moved 1 pixel of 230 400 at threshold 0.1, and still only 43 at 0.005. The gate therefore carries a
  second metric — mean absolute channel difference over the frame — measured at **0.0000 on an unchanged tree
  (bit-exact across separate browser launches)** and 0.014–0.173 for that 2 % lift. The bar sits at 0.01,
  between a floor of zero and the smallest real signal, and the two metrics are reported apart so it is
  obvious which fired: "moved" versus "shifted".
- **The page fetches its fonts from Google at render time.** `display=swap`, nothing awaits
  `document.fonts.ready`, and the Companion Core's screen is a canvas texture that `fillText`s in those
  families — so what the door-to-core final frame says was a race against the network. The gate serves the
  repo's own woff2 off its static server and waits for the faces. (The page itself is still racy for anyone
  not going through the gate.)
- **`sharp` is not a dependency of this repo**, in any form — zero occurrences in `pnpm-lock.yaml`. An earlier
  revision of this document said PNG I/O was free because of it; that was wrong. PNG encode and decode are a
  vendored zlib-only codec, and the gate adds no npm dependency at all.
- **three.js no longer uses pixelmatch** and never had the "2× then halve" retry this document described; its
  `viewScale = 2` is supersampling, and the downscale is what absorbs rasteriser noise. The 0.1 threshold
  quoted here is *their* metric (squared RGB), not pixelmatch's (YIQ) — the same number means different
  things. The 0.1 % pixel budget does transfer, and is what the gate uses.
- **The first frame through a fresh composer is not the same picture as the second.** `SMAAPass` loads its
  area and search lookups by assigning a data URL to `new Image()` and only marks them `needsUpdate` from
  `onload`; the decode is asynchronous and `composerFor` builds the pass lazily, inside whatever synchronous
  call first asks for a frame. So frame one is antialiased against empty lookups — 220 pixels and a max
  channel delta of 246 on a 640 × 360 poster. Invisible in a 720-frame video, decisive for anything that
  renders a handful of frames and stops. Found by the adversarial pass over the finished gate, not by
  building it: the first baseline set encoded its own capture order, and `--shot orbit` alone reported four
  regressions against an unmodified tree at 23× the gate's bar. `window.__houseComposerWarm()` fixes it in
  the page, so the video pipeline's frame 0 is fixed too, and re-baselining changed exactly the 30
  `door-to-core@0.55` images — the ones that had been captured first on their page — and none of the other
  90. The lesson generalises past this gate: **the pipeline had a first-frame bug that nothing was looking
  for**, and only a test that renders single frames could see it.

**It does not run in CI, by design.** There was a workflow; it was measured and removed. 120 frames through a
software rasteriser cost 37 minutes to write and 59 to compare on a GitHub runner — both runs passed, so the
gate works — and over the five days of available history `house-goldens` was the single largest consumer of
this repo's Actions budget: 239 minutes across six runs, more than `style-canon-lint` spent across
eighty-four. On a machine with a GPU the same four checks take **2m16s**. So the gate lives on the desk:

```bash
node generated/infographics/scripts/check-house.mjs            # specs, shots + scene, determinism, goldens
node generated/infographics/scripts/check-house.mjs --quick    # the fast pair, while you are still editing
```

The order is a dependency chain rather than a preference: goldens compared against a renderer that disagrees
with itself are noise, so a failed determinism check skips them and says so instead of reporting a hundred
failures that mean nothing.

The `--profile` table keeps its SwiftShader entry — a Linux box with no usable GPU can still bless and check
its own baselines. What went is the automation, not the capability.

One profile is committed: `macos-metal`, the machine the gate runs on. A `linux-swiftshader` set existed
briefly for the CI job and was deleted with it — nothing refreshed it, and a baseline set nobody re-blesses
drifts from the code until it reports its own age as a regression. The profile itself is still selectable, so
a Linux box with no usable GPU blesses its own set with `--update --profile linux-swiftshader` and checks
against that; what is gone is 12 MB of baselines with no owner.

### Open, in dependency order

1. **Item 4's roof clashes.** Box tests cannot catch a prop showing through a pitched roof — every piece of
   furniture in the house is inside a gable's AABB. That needs the `three-mesh-bvh` shapecast. newcrest has a
   visible case on its upper roof plane.
3. **Item 11's roof-on interiors** — dimmer `envMap` on interior materials, a warm ceiling light per room.
4. **Item 9**, now that 4's scene half, 6 and 8 are in. Its own prerequisite is met: the judge reads
   real-pipeline frames as of `3844e03`.
5. **Items 12 and 14**, which the review gates behind 4.

Also noted while working, not addressed: several `orbit` shots frame the house so tightly that the roof is cut
off at `t = 0` (newcrest). That is composition — item 9's territory, not a rendering bug.

## 3. Item detail

**1 · Ground stack and sun frustum.** Remove the `ShadowMaterial` catcher for spec houses (the lot slab already `receiveShadow`); if kept for the empty editor, `depthWrite=false`, `renderOrder=-1`, y −0.01. Put the lawn top back at y=0 and punch level-0 footprint rects out of the lot with the existing `slabWithHoles` — the pool mechanism — so nothing is coplanar under the house. Add a `fitShadow(bounds)` dep called from `build()` with `anchors.bounds ∪ lotRect`: project lot corners + roof ridge into light space, set the ortho box tightly, move `sunLight.target` to the house centre, `updateProjectionMatrix()`. Smaller frustum = finer texels; at 4096 over ~32 m use `normalBias≈0.01–0.015`, `bias≈-0.0001`. One `GROUND = {lawnTop, slabTop, patioTop}` constant used by house-builder, `createFloorSlab` and `generate_house_iso.py`. Log depth is already off in `8f35e87` — keep it off; it never separated coplanar faces and it disables early-Z.

**2 · Shot dressing.** Spec: `shots[].walls: 'up'|'cutaway'|'sims'`, `roof: 'on'|'auto'|'off'`, optional `enterT`; defaults per type in `shotsFor()`; `preset.dressing` applied in `__houseRenderBegin`, `__houseSnapshot` and `__houseShotQA`. Replace the `splineSelect.value` string gating with an explicit `activeShot` object (also fixes the aliased-id loss at `house-builder.js:922`). Sims rule per frame: exterior wall cut only when its outward normal faces the eye and the eye is above the cut or the target is inside the footprint; roof off only when the eye is above the eaves and looking into the plan; 0.05 hysteresis in t so it is bit-stable and simulable by the gate. Fade by Bayer-dither discard in `onBeforeCompile` (or `alphaHash` + `SSAARenderPass`) — keeps depth writes so shadows/GTAO stay honest; snapshot `{transparent,opacity,depthWrite}` into `userData.orig` in `registerRoof` and restore from it. Add a 0.02 m ceiling (outline-loop extrusion, DoubleSide, registered with roofs) to every top level. Native `Raycaster` eye→Core for the last quarter of hero shots; `three-mesh-bvh` 0.9.15 (MIT, one file, imports only `three`) only if it gets slow.

**3 · Determinism and colour.** `assets/textures.js` with mulberry32; seed every canvas texture; lint `Math.random` in builders. Patch vendored `GTAOPass.generateNoise()` to `new SimplexNoise({ random: mulberry32(1) })`. `SRGBColorSpace` on albedo canvases, `NoColorSpace` on data maps. Delete the `pascalSkyTexture` environment overwrite (keep it as background only). Render one poster AgX vs `THREE.NeutralToneMapping` (Khronos PBR Neutral, in r169, hue-true for brand colours) and pick once — it is baked into the gate. Normalise the 30 palettes in OKLCH with **culori 4.0.2** (`bundled/culori.min.mjs`, 64 KB, no bare imports, one importmap entry): clamp L/C per role, keep hue; the iso twin uses the same values. `scripts/test-frame-hash.mjs`: aurora/door-to-core frames 0, 330, 719 rendered twice in fresh contexts must hash identical.

**4 · QA gate.** **pixelmatch 7.2** (ISC, ESM) at three.js's tolerances (0.1 threshold, ≤0.1 % pixels, 2×-then-halved); goldens per renderer profile (macos-metal, linux-lavapipe — copy three.js's `mesa-vulkan-drivers` + `xvfb-run` + `VK_DRIVER_FILES=lvp` recipe). Pin Playwright, `channel:'chromium'`. Scene-graph assertions: roof present / walls full-height per dressing, Core framed and unoccluded, no furniture inside walls (`three-mesh-bvh` shapecast over merged static walls), planting regularity (NN-distance CV, fraction of pairs sharing x or z within 5 cm). Filter the gate on `userData.role`, not name regexes.

**5 · Material kit.** `createMaterialKit({THREE, palette, textures, rng})` → shared materials by role (fabric, wood, metal, stone, plant, linen, glass) plus cladding keyed to `palette.material`: six seeded canvas generators (brick, clapboard, stucco, stone, board-and-batten, corrugated) with albedo + roughness + Sobel normal, world-unit repeat via `texture.clone()` (shares `.source`, no re-upload), applied to outward pier faces via a 6-slot material array. Accent → door leaf, fascia, shutters, planters, upholstery mix. One floor table for both slab paths with real tile and deck. `ctx = {theme, rng, materials}` as the existing second builder argument, threaded into `AssetFactory.create*(params, ctx)`. `assets/props/style.js` segment/roughness bands, `flatShading` on organics. Glass: one shared `MeshPhysicalMaterial`, `transmission 0`, `opacity 0.35`, `depthWrite false` — drops the per-frame transmission render and makes pools visible through windows. Later, optionally **three-custom-shader-material 6.4.0** vanilla build (MIT, 17 KB, imports only `three`) for triplanar roof/cladding and roughness jitter; **do not** copy LYGIA (Prosperity licence, non-commercial).

**6 · Catalog manifest.** `scripts/build-prop-catalog.mjs` builds every ITEMS/SITE entry headless, measures Box3 + front vector, writes `content/house-catalog.json`. Consumers: house-builder (ITEMS/obstacle rules), validator (enums + honoured-param errors), `generate_house_iso.py`, `generate_floor_plans.py`, BRIEF.md table, `apply.mjs` DIMS, UI catalogData. `build()` returns `unknownTypes`/`ignoredParams`; validator fails on them. Fix circular-rug `w/d` vs `r`.

**7 · Site primitives and variation.** Per-house `rng = mulberry32(fnv1a(spec.id+':'+kind+':'+index))`. New site types `bed`, `hedge`, `path`, `scatter`, `grove`, `basin`, true `pergola`, plus `species/h/r/color` with default jitter on tree/shrub/cypress/palm. Implementation on r169 built-ins: `Shape` → `ShapeGeometry` → **MeshSurfaceSampler** (vendor `examples/jsm/math/MeshSurfaceSampler.js` beside `SimplexNoise.js`; `setRandomGenerator(rng)`) → `InstancedMesh`/`BatchedMesh` with `setColorAt`; hedges along `CatmullRomCurve3`. Vendor **three-low-poly 1.2.6** (ISC, single 316 KB ESM) for `DeciduousTree` (seeded, 10-colour leaf palette, flat-shaded), picket/iron fences, `StoneWall`, rock scatter — needs a 6-line no-op stub mapped to `three/tsl` and `three/webgpu` (never map them to `three.webgpu.js` — double THREE), `ConvexHull.js` from r169, and a `three/examples/jsm/` importmap prefix; verified deterministic on r169. Skip ez-tree (photoreal billboards, 3.8 MB) and blade grass. Add two-tone lawn, `sidewalk`/`street`, a 200 m ground disc and gradient dome. Mirror each primitive in `draw_site` with the same seed function ported to Python.

**8 · Prop density.** Split island/bed/dining/ensuite into atoms with variants; remove the halo-lamp `PointLight` (265 instances → keep emissive ring + glow decal, tint from accent), cap dynamic lights to Core + fire via lint; add ~25 dressing atoms. Breadth from **Kenney Furniture Kit (140) + Nature Kit (329)**, CC0, 7–40 KB GLBs, no textures, named per-primitive materials (`wood/carpet/metal*/glass`, `leafsGreen/woodBark`) — recolour is a name→role lookup, one cloned material per (kit, name, house); ×2 uniform scale (kit is half-metre). `GLTFLoader` + `BufferGeometryUtils` are vendored and tracked. Preload in the async `loadHouse` before the synchronous build; never fetch at render time. `scripts/build-prop-manifest.py` (stdlib) parses GLB chunks into per-primitive AABBs so the iso draws matching stacked boxes. Hold Quaternius/KayKit unless the owner prefers their rounder look — one family only. Poly Pizza (API v1.1, filter `Licence=CC0`) as a search tool for the odd missing prop, vendored with `attribution.json`.

**9 · Layout loop.** READ stage emits `spec.source.reading` (panel inventory, bearing per plan panel vs `entry.side`, room graph, openings, floor materials, dominant colours → palette + `rooms[].floor/wallColor`, `hasPlan`), judged before placement. Anchor sets per room type replace the 5–12 count; filler cap; diversity score. SITE pass with its own brief and judge (massing → exterior → interior, per HOUSE-SPEC's own priority), requiring a door-to-street path and an entry bed, scoring the t=0 poster. Validator gains opening/stair/OBB/proximity/facing rules and an `against` attachment. Judge ≠ patcher; deterministic gate before every LLM judge; judge on real-pipeline frames (`houseContactSheet`, walls up, roofs on, at the slide's bearing); persist `qa` scores and loop to threshold with automatic retry.

**10 · Post stack.** Route the five remaining `renderer.render()` sites through `composerFor()`. `gtaoPass.setSceneClipBox(houseBounds)`, radius ≈0.35 m, `screenSpaceRadius=false`, Poisson denoise. `composer.setPixelRatio(2)` for 2×2 supersampling (verify OutputPass lands at 1080p); `SSAARenderPass` level 3 fallback; `SMAAPass` cheap fallback (wait for `areaTexture.image.complete`). Skip TAA, N8AO (needs pmndrs `postprocessing` vendored for one class), CSM, VSM. Optional PCSS chunk patch (deterministic hash) once the frustum is fitted.

**11 · Lighting.** Data presets with sun azimuth/elevation; `applyLighting(preset, {frontSide})` key-lights the entry façade; rim light casts shadows or is capped at 0.4. Roof-on interiors: explicit dimmer `envMap` on interior materials (r169 quirk: `scene.environmentIntensity` replaces `material.envMapIntensity` without one), one warm ceiling light per room, GTAO; optional per-room `CubeCamera` → `PMREMGenerator.fromCubemap` captured after dressing. Skip `ProgressiveLightMap` until one-mesh walls.

**12 · Extraction.** textures → wall-modes → procedural-architecture → asset-factory → lighting → shot-engine, each step gated by the hash test and goldens. `SHARED_TEXTURES` moves into the textures module; deferred wall registration stays a documented invariant. No bundler.

**13 · Twins.** `scripts/build-house-plan.mjs` writes `<id>.plan.json` (edges, loops, hero, stairs, resolved items and seeded site instances); both Python generators consume it and drop their re-implementations. Strip HERO_SET duplicates from the 25 specs; validator errors on them. Delete `HOUSE_TOURS` or re-express as spec-relative shot types. **camera-controls 3.1.2** (MIT, `install({THREE})`, no bare import) for `fitToBox` at authoring time only.

**14 · Wall fork.** `?walls=graph` → `useGraphWalls:true` + `enableCutaway(renderer)` (`clipShadows=false`) + door/window units on `compiled.openings[].worldRect`; walls publish `userData.apertures` + solid boxes so `routeOn` and the gate share one collision model. Pass goldens on all 30 → delete the pier/lintel path; otherwise delete Phase 2 until Phase 3.

## 4. Not recommended

three-gpu-pathtracer (0.0.24 needs r180; 0.0.23 fine for stills only, never video), Theatre.js (AGPL studio), three-story-controls (dormant), pmndrs postprocessing as the pipeline (different Pass API, re-plumbs tone mapping, Math.random SSAO noise), TSL/WebGPU triplanar on r169 (replaces the whole renderer), blade-grass libraries, VSM/CSM shadows, Blender as a second video renderer (recreates the twin parity tax).