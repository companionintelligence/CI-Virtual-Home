# Geometry detectors: z-fighting and collisions, thresholds and first results

> **Status: baseline record.** The detectors this describes are on main (`scripts/review/zfight.mts`, `collide.mts`, `geom-lib.mts` and the rest, landed in #36; the README section "Geometry detectors" is the live description). This file is the author's report from when they were built on `fix/z-fighting-collisions` from `f2d3bb4`: the thresholds and why, the false-positive classes, the self-tests and the first results on `aurora` and `seraphine`. Use it to tell whether a later run is better or worse than the first one, not as the current command reference.
> The Intel iGPU timings are from a loaded machine and move with load; counts do not. This Linux/NVIDIA box was not used for these numbers. Directories in angle brackets (`<scratch>`) stand for the author's local ones.

Worktree: `<scratch>/vh-geometry` (branch `fix/z-fighting-collisions`, from origin/main f2d3bb4). Nothing committed, nothing staged; `git status` shows the files below as modified or untracked. No product code (`assets/`, `room-creator.html`, `content/`) was changed and no golden touched.

Results of the final runs: `<scratch>/w13/results/` (`zfight/<house>.json`, `zfight/<house>/*.png`, `collide/<house>.json`, `collide/<house>/*.png`, the logs, the two self-test logs, `unit-test.log`).

## 1. What was built

| File | What |
|---|---|
| `scripts/review/zfight.mts` | the z-fighting detector (experiment, ID pass, naming, geometric cross-check, contact images, `--selftest`) |
| `scripts/review/collide.mts` | the collision detector CLI (`--selftest` in `collide-selftest.mts`) |
| `scripts/review/collide-lib.mts` | the collision engine, pure Node: classification, hulls, SAT, the whitelist, the structural checks |
| `scripts/review/collide-io.mts` | catalog and scene-dump decoding shared by `collide.mts` and its self-test (it breaks an import cycle: a dynamic import of the CLI from itself deadlocks) |
| `scripts/review/geom-lib.mts` | pure geometry: depth quantum, coplanar triangle overlap, boxes, quickhull, SAT, overlap volume, vertex depth |
| `scripts/review/geom-page.mts` | the browser half (`window.__geo`, installed by serialising one function) and the Linux session (static server, Chromium flags, fonts stub, composer warm-up) |
| `scripts/review/geom-report.mts` | labels, class keys, house/site scope, base64 decoders, output paths |
| `scripts/test-geometry-detectors.mts` | 43 checks on the pure parts, `@check-house quick` (about 0.1 s; no browser) |
| `package.json` | a marked block (`"//geometry-detectors"` ... `"///geometry-detectors"`): `review:zfight`, `review:collide`, `review:geometry-selftest` |
| `README.md` | two table rows and a "Geometry detectors" section |

Reused from the rig, not copied: `cornerCam` (`scripts/review/cameras.mts`), `roomsOf` (`page.mts`), `serve`/`loadPlaywright`/`stubGoogleFonts` (`scripts/portal-lib.mts`), `stableJson`/`parseArgs` (`lib.mts`). The rig's own launch code (`PROFILE`, Metal flags) is not used.

## 2. Commands

```bash
export PLAYWRIGHT_BROWSERS_PATH=<dir holding chromium-1246 / chromium_headless_shell-1246 / ffmpeg-1011 symlinks>   # the shim from the brief; unset where Playwright's pinned build is installed
node --experimental-strip-types scripts/review/zfight.mts  --house aurora,seraphine --out <dir> [--gl default|software] [--only rooms,orbit,track,overview]
                           [--corners NW,SE] [--max-spots N] [--near 0.2] [--room-near 0.05] [--far 160] [--res 720] [--thr 10] [--images 6] [--no-geom] [--tod day]
node --experimental-strip-types scripts/review/collide.mts --house aurora,seraphine --out <dir> [--gl ...] [--min-depth 1] [--images 6] [--show-allowed] [--site]
node --experimental-strip-types scripts/review/zfight.mts  --selftest        # and the same for collide.mts; pnpm run review:geometry-selftest runs both
node --experimental-strip-types scripts/test-geometry-detectors.mts          # pure Node
```

`--out` defaults to `$GEOM_OUT`, else `$TMPDIR/vh-geometry`. Output goes to `<out>/zfight/` and `<out>/collide/`. Chromium is launched with `--use-gl=angle --use-angle=default --ignore-gpu-blocklist --enable-gpu-rasterization` (the Intel RPL-S iGPU here: `ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL ES 3.2)`, Chromium 151.0.7922.34); `--gl software` adds SwiftShader. Never `--use-angle=vulkan`. `pnpm run typecheck` (`tsc --noEmit` over `scripts/`) is clean.

## 3. How the scene identifies things (what the detectors read)

| Thing | Where it is tagged |
|---|---|
| placed object | every builder goes through `put(fn, x, z, y, name, role)` (`assets/house-builder.ts:108`) and `addItemToScene`, whose default role is at `room-creator.html:6429`: `ground floor wall finish structure item hero fixture ceiling roof site`. The detectors group meshes by the scene child they hang in. |
| item | `userData.itemType`, `.room`, `.onSurface`, `.mounted`, `.foliage`, `.dress` (`assets/rooms-build.ts:87-92`) |
| wall | `userData.isWall`, `fullGroup` / `cutawayGroup` / `baseboardGroup` (only the full group is visible under walls:up), window and door units are groups named `Window (...)` / `Door (...)`, glass has `userData.windowGlow`, a leaf is a pivot with `userData.door` (`room-creator.html:2851,2888`; collected into `anchors.doors` by `assets/kit-build.ts:191`) |
| wall finish | role `finish` (`assets/room-finish.ts:222`), a 0.096 m deep box skin over each pier (6 mm proud) |
| stair | `userData.stair` (`assets/structure-build.ts:266`); rails are role `structure` or `roof` |
| openings | `anchors.openings` (`kit-build.ts` `noteOpening`), doors `anchors.doors` (hinge, closed and open angle, leaf boxes under the pivot) |
| voids | `spec.levels[].voids` and `anchors.arch.voids[].auto/double` |
| floors and level changes | role `floor`; rooms' `floorOffset` (`rooms-build.ts` `ON_FLOOR`) |
| site | role `site` / `ground`, `userData.category === 'Site'` |
| placement metadata | `content/house-catalog.json` `types[].place` (`against`, `group`, `hangs`, `mountY`, `onSurface`, `surfaces`, `tucks`), the committed derivative of `assets/props/placement.ts` |

## 4. zfight: design, thresholds, why

**The experiment.** A frame drawn twice with a different depth mapping is the same picture except where the depth test is a coin toss. The page renders each camera spot with the same camera at far x1, x0.94, x1.07 (`PERTURB`). Why far only: z_ndc = f/(f-n) (1 - n/z) moves by about n/f of full scale, which is about a million steps of a 24-bit buffer, so every tie is re-rolled; x and y of the projection do not depend on near or far, so not a pixel of geometry moves (a first version also moved near and flipped 100k pixels whenever a prop sat within 5 cm of the eye: the near plane clipped it differently; far-only has no such artefact). near stays at the page's 0.2 for exterior, track and overview spots and at the rig's 0.05 for the corner cameras (`--near`, `--room-near`); far 160.

**Two renders per setting, no noise sources.**
- *beauty*: `__houseSnapshot` through the composer the goldens use (GTAO, bloom, grade, SMAA, 2x supersample, MSAA x4), the session warms it (SMAA lookups), lighting is `day`, the clock is not read, a throwaway frame precedes the first spot. The frame is read losslessly by hooking `canvas.toDataURL` for the duration of the call (the dressing is on at that instant).
- *ID pass*: every mesh swapped for a `MeshBasicMaterial` whose colour is its 1-based id (set in the linear working space, no tone mapping, no fog, no background, `NoBlending`, an RGBA8 target with a 24-bit depth renderbuffer and no MSAA), carrying the original's `side`, `transparent`, `depthWrite`, `depthTest`, `depthFunc`, `polygonOffset` and `colorWrite` (so a polygon offset that resolves a decal resolves it here too), instance colours nulled (a per-instance colour turned ids into garbage: that cost an afternoon), editor helpers and lines hidden. Everything is restored afterwards (materials, instance colours, visibility, clear state, target, shadow autoUpdate); a captured frame after the pass equals the frame before it (self-test, last check).

**Pixel to surfaces.** A pixel whose id differs between any two settings is a candidate. Candidates are grouped by (meshA, meshB). Per pair: pixel count, bounding box, `vis` (candidates where the beauty frames differ by more than `--thr` 10/255 in some channel), and measurements from four of its pixel rays (three.js raycast against just those two meshes): the two distances, their gap along the ray, the gap perpendicular to the plane, the two plane normals, the world point, and the depth buffer's quantum there (`(f-n) z^2 / (f n 2^24)`: 30 um at 10 m, 0.12 mm at 20 m, 0.5 mm at 40 m, 3 mm at 100 m at near 0.2). Verdict: `coplanar` (perpendicular gap <= 0.01 mm), `inside the depth quantum` (<= 3 quanta), else a rasteriser tie at an edge or seam. Each mesh is described by its registry entry: userData role / item type / room / storey, the chain of groups, geometry and size, material (type, colour, transparent, polygonOffset), world position. `score = vis + pixels x 0.25` when the two base colours differ by 6 percent or more (0.02 otherwise): a flip between two surfaces of one colour is a candidate but not a flicker. Pairs are also grouped by kind (`by_class`: the same defect across many meshes) and by scope (`house`, `house-site`, `site`, `crack` when one side is the background).

**Spots (66 on each home)**: the rig's NW and SE corner cameras of every room at least 2.2 m2 (`cornerCam`, eye 1.5 m, 60 degrees; 36 here), 12 samples of the `orbit` shot's baked track (walls up, roof on), 14 of `door-to-core` (roof off where the track's roof alpha is under 0.5), 4 cutaway overviews (walls cutaway, roof off, 38 degrees up). Every spot, camera, near/far, dressing, candidate count and its top 8 pairs are in the JSON.

**Geometric cross-check** (`geom-lib.mts coplanarPairs`, on by default): every pair of visible meshes with triangles whose planes are within 2 mm (each vertex of one within 2 mm of the other's plane, both ways), normals within 1.1 degrees, facing the same way (or one side double-sided), overlapping by at least 1 cm2 in the plane (Sutherland-Hodgman). Buckets by canonical normal and offset bin, a uniform grid inside each, so 190k triangles take 3-6 s. Pairs whose outer side, 4 mm off the surface, is inside another solid are dropped as buried (the underside of a wall in its slab; 930 and 1392 dropped on the two homes). Each remaining pair has the gap, and `fights_beyond_m`: the distance beyond which that gap is lost, sqrt(gap f n 2^24 / (f - n)) (0 for coplanar; 58 m for 1 mm at near 0.2), which is the predictive form of "depth precision at a distance". `seen_in_renders` says whether any camera spot flagged the same pair. Ranked seen first, then those that fight within 40 m, then by area. A pair with polygonOffset on either side is marked `resolved_by`.

**Contact image** per worst spot (`--images`, 6): the beauty frame with candidate pixels magenta, boxes round the six worst pairs, and below it three 4x crops of the worst pair: the frame at depth setting A, at B, and the largest difference x6.

### zfight false-positive classes and what was done
| Class | Handling |
|---|---|
| near-plane clipping flips when near is perturbed | perturb far only |
| per-instance colours (instanced foliage) decode as other ids | `instanceColor` nulled in the ID pass |
| editor gizmo / grid / lines | hidden in the ID pass |
| buried faces (wall and baseboard undersides in the slab) in the geometric mode | the buried filter |
| the first frame after a load or a scene change differs by a hair | a throwaway frame first (and after the self-test's scene swaps) |
| a flip between two surfaces of one colour | reported, with `colour_delta_pct`, ranked low |
| MSAA and supersampling average a partial flip below 10/255 (so `vis` under-counts) | the ID evidence is primary, `vis` secondary, hence the score above |
| GTAO / grade differences between settings (beauty differences with no id flip: 19,430 of 30,472 pixels on aurora) | counted as `unexplained`, never attributed to a pair |
| SwiftShader has a different depth format (fewer ties: 699 candidates against 5,370 on aurora Kitchen NW) and is 45x slower | documented; GPU numbers are the reference |

Not covered: shadow acne / peter-panning (a light bias phenomenon, not a depth tie of two meshes; the editor already tunes `normalBias`), alpha-test cut-outs (treated as solid in the ID pass), instanced meshes (planting, recessed cans) in the geometric mode, a camera nudge family of perturbations (the far-plane family finds ties by re-rolling them; nudges add silhouette flips).

## 5. collide: design, thresholds, why

**Extraction** (`geo.extract`): the meshes visible under walls up / roof on (a hidden cutaway or baseboard group is not a wall), without the lot's ground, as an oriented box (`BoxGeometry`: matrix plus half extents, exact) or a world-space vertex soup with its index. Door leaves are posed at eight angles between `closedAngle` and `openAngle` and exported as boxes, then put back.

**Engine** (`collide-lib.mts`, pure Node, 43-check unit test):
1. a hull per mesh: a box exactly, otherwise quickhull (merged coplanar faces, real edges only), a flat hull for panes and decals; each mesh classified `prop | body | trim | frame | glass | leaf | finish | stair | rail | site | ...` (a wall's box with a side under 10 cm is trim, a window or door unit's part is frame, a pane is glass);
2. a 1 m grid broad phase, AABB test, then SAT over both hulls' face normals and the cross products of their edge directions: the minimum translation distance, the depth in cm, with the axis;
3. a concave mesh (anything but box, cylinder, sphere, cone, capsule, plane, circle, platonic solids) is measured by its own vertices and triangle centroids against the other's hull (`sampleDepth`); two concave parts: the smaller of the two measures (each overstates through the other's hull). The hull alone said 36 cm for a plant 8 cm into a wall, and 18 cm for a curtain 7 cm into a partition;
4. the whitelist (each rule named, counted, with its deepest example under `allowed`): `contact` 1 cm; `resting` 4 cm when the cheapest push is vertical (a leg in a rug, a foot on a counter, a cushion on a sofa); `rug-pile` 8 cm (catalog group `rug`); `on-surface` 5 cm (catalog `onSurface` on a host of its `surfaces`); `wall-mounted` 4 cm (`mounted`, `hangs: wall`, `mountY`); `against-wall` 2 cm (`against: wall | corner | window`); `trim` 3 cm; `tucks` 12 cm (catalog `tucks` against a table, desk, fitted or storage item); `foliage` 12 cm; `cable-plug` 10 cm (a cord's end is in the socket), `cable` 3 cm;
5. per entity pair: the deepest part pair (depth, axis, a label of each part), the sum of the part overlaps' volumes (a 14^3 grid over the shared box), the deepest overlap's centre; a prop in a wall is a single finding whether the wall body, its paint overlay or its trim is what it is in (the deepest is kept, the rest listed in `note`); `visible` says whether it pokes out of the far side (depth >= wall thickness - 1 cm) or stays inside the slab (still a collision: it is that much shorter than drawn, and a face flush with the wall z-fights);
6. structural checks no pair of meshes shows: **door swing** (leaf boxes at eight poses against every item of the storey), **slab void** (the feet of a standing item over a stairwell, double-height or authored opening), **floor** (lowest point under the room's floor, with `floorOffset`), **ceiling** (top above the storey's ceiling);
7. `patterns`: findings in a wall by about half its thickness (a placement on the centre line rather than the face).

`--site` (opt-in) also tests the lot's hard pieces (not planting, paving, pool, foundation, porch) against walls. Findings are ranked by depth, then volume.

**Images**: one per finding (`--images`, 6): the two things tinted red and blue (materials cloned and restored), the shared box in magenta drawn over everything, the camera inside the room at the angle with the clearest line to the pair (12 azimuths, three distances, eye free within 0.3 m), else from above through the cutaway with the storeys above hidden.

### collide false-positive classes and what was done
| Class | Handling |
|---|---|
| hull of a concave mesh (plants, cables, cloth, loft shapes) overstates | vertex refinement; concave x concave takes the smaller |
| objects standing on things (legs in rugs, lamps on tables, cushions) | vertical push under 4 cm, rug piles to 8 cm, onSurface hosts |
| wall-mounted art, sconces, upper cabinets live in the wall plane | 4 cm; deeper is a finding |
| backs of cabinets and beds touch the wall or its 8-18 mm trim | 2 cm and 3 cm |
| chairs under tables | 12 cm for `tucks` |
| a cord enters the wall at its socket | 10 cm for cords |
| the same prop reported against wall body, paint overlay and trim | merged, deepest kept |
| level misassigned for a high-mounted item (a sconce at 2.7 m in a 3.0 m room read as under the next floor) | level by `y >= storey y - 5 cm`, not 30 cm |
| doors of the real house in a scratch scene | only doors shown in the scene are swept |
| a prop whose own hull spans an opening reads as a window collision | frames and panes are real parts: kept, and reported as `prop-window` |

Residual: a soft item (cloth, cushion) pressed into a wall by 1-3 cm is under the threshold on purpose; the vertex measure under-states a thin triangle that crosses a thin wall with no vertex inside it; a hull of a non-convex rigid item (a ring, an L shape) fills its hole. None of these inflate the top of the lists.

## 6. Proof: self-tests (all PASS, `results/selftest-*.log`)

**zfight `--selftest`** (a scratch scene in the page: the home taken out, a floor, a wall, a baseboard 8 mm proud, a rug, art 5 mm off the wall):
- the clean room: 0 candidate pixels, 0 beauty difference, 0 coplanar pairs;
- a 1.6 m quad planted on the floor: found by the render experiment (13,714 candidate pixels, all visible; the pair is the floor and the planted quad, gap 0), nothing else flagged; found by the geometric mode (one pair, 2.56 m2, gap 0);
- on the real plan: a quad planted exactly on the bare floor of aurora's Living Room (`plantVisible`, where a pixel ray from the NW corner camera first meets a floor mesh): found (3,104 candidate pixels, 2,471 visible, against `Room floor (l1 · Living · honey-oak)`), absent before, and the frame is the same after removal (flagged 2,671 -> 5,775 -> 2,671, beauty difference 157 -> 12,190 -> 157).

**collide `--selftest`**: the clean scratch room has every legitimate contact at once (a sofa 5 mm off the wall, a dresser 1.5 cm into it, a lamp 1 cm into a table, a chair 9 cm under a table, a table standing 1 cm into a rug, a frame 1 cm in the wall plane): 0 findings, and the whitelist names `against-wall, wall-mounted, on-surface, tucks, rug-pile`. The dirty room adds a sofa through the wall (42.5 cm, "pokes out of the far side", the exact push) and a lamp sunk 8 cm into its table: exactly those two. On aurora a 1.2 x 0.8 x 1.0 m box put through the north wall is found against that wall at 58 cm; removing it gives back the 23 findings, identical.

**Determinism**: two fresh browser launches of both tools on seraphine (24 spots) wrote identical JSON apart from timings (sha256 of the normalised bytes equal: zfight 0d84f01ef8ad, collide 2781b599a885). The session never reads a clock or `Math.random` for anything a frame depends on.

## 7. Results on aurora and seraphine

Machine: Intel RPL-S iGPU, load average 11.8 -> 20.0 during the final runs (other agents were rendering and building too, so these are loaded-machine times; the same runs a little earlier at load 13 took 102.6 s and 134.3 s for zfight and 64.1 s and 59.3 s for collide, and an early pass on a quieter machine 94 s and 105 s). Counts are identical between runs; only seconds move.

| | aurora | seraphine |
|---|---|---|
| zfight, spots | 66 (36 room, 12 orbit, 14 track, 4 overview) | 66 |
| zfight, candidate pixels / mesh pairs | 86,223 / 508 | 184,547 / 646 |
| geometric coplanar pairs (after the buried filter) / of them seen by a camera spot | 672 (930 buried dropped) / 230 | 1,240 (1,392 dropped) / 428 |
| **zfight time per house** | **147.4 s** (open 48.8, experiment 79.7, geometry 5.9) | **124.5 s** (open 28.9, experiment 83.6, geometry 5.5) |
| collide, entities / parts / pairs tested / overlapping | 417 / 2,721 / 536 / 395 | 432 / 6,195 / 1,062 / 872 |
| collide findings | 23 (14 prop-wall, 5 prop-prop, 2 prop-window, 1 door-swing, 1 prop-door) | 41 (22 prop-wall, 9 prop-prop, 7 prop-window, 2 door-swing, 1 prop-stair) |
| **collide time per house** | **50.7 s** (open 26.4, extract 2.4, analyse 0.7) | **73.9 s** (open 36.0, extract 3.1, analyse 1.2) |

The page open (build, composer warm-up) is 26-49 s of each (it is the loaded machine's biggest swing); a spot costs 0.7-1.5 s (a heavy room 3 s).

### zfight, top 10 house pairs (read against the pictures)

aurora (`results/zfight/aurora.json`, images `results/zfight/aurora/zfight-01..06-*.png`): all ten are real coplanar surfaces; none is a detector artefact.
1. `Parametric Wall (7.6m S)` pier `Box 1x3x0.16 #171` vs `Wall finish (l1 · Foyer · S · paint) #607`: 18,025 px in 3 spots, coplanar, geometric 0.51 m2, colour delta 26 percent.
2. `#159` (0.3 m pier) vs `Wall finish (l1 · Dining · S · paint) #603`: 6,627 px, 0.48 m2.
3. `Wall finish (l3 · Sky Lounge · W · paint) #2691` vs `Cube Storage 2x2 #2765` (its 12 mm back panel): 1,473 px, 1,191 visible, colour delta 42 percent: the shelf's back panel is flush with the paint (`zfight-01-room_l3_Sky_Lounge_SE.png`: the moire inside the cube cells, and the A / B / difference crops).
4. `#209` vs `Wall finish (l1 · Study · S) #616`: 5,492 px. 5. `#199` vs `#614`: 3,388 px.
6, 7. `terrace deck (l2) #2062` / `#2073` vs `Roof · flat parts #2950` / `#2951`: coplanar, 26.1 m2 and 20.6 m2, seen in 12 and 8 spots, vis 596 and 421 (the white terrace edge in `zfight-03-orbit_orbit_00@0.0433.png`).
8. `Parametric Wall (1.8m W)` vs `Wall finish (l1 · Foyer · W) #612`: 2,877 px. 9. `Parametric Wall (5.6m PARTITION)` vs `Wall finish (Living · S partition) #630`. 10. `(2.6m PARTITION)` vs `Wall finish (Kitchen · S partition) #597`.
By kind: wall pier vs its paint overlay (the same defect on 20+ pairs); terrace deck vs flat roof; two stair treads (15 pairs); wall box vs its baseboard (underside, visible where a storey overhangs); roof vs wall; the Patio vs the Patio (12.9 m2, 7,362 px; the loungers' pads flicker in `zfight-03`, box 1); the Pool's body vs its coping; `World` meshes at 40-66 m where the gap (0.3-0.8 mm) is inside the 2-3 mm quantum (depth precision at a distance, as the brief names it).

seraphine (`results/zfight/seraphine.json`, `zfight-01..06-*.png`):
1. `Patterned Rug (check) #5516` vs `Patterned Rug (dots) #5519`: two rugs at the same height, 19,954 px in 7 spots, vis 4,709, geometric 2.87 m2 (`zfight-01-room_l2_Nursery_SE.png`: the jagged magenta stripes on the pink round rug, and the crops).
2. `Parametric Wall (1.6m PARTITION) #1152` vs `Wall finish (Chess Hall · W partition) #1314`: 6,246 px, vis 3,517, 8 spots; 5. the same pier vs `Wall finish (Living Room · E partition) #1325`; 3. `Parametric Wall (3m S)` vs `Wall finish (Nursery · S) #4229`: 2,179 visible; 6, 8, 9, 10. more pier vs finish pairs (`zfight-02-room_l1_Dining_NW.png`: the white pier's end face striped).
4. `Window (0.5 x 0.8) casing #3794` vs `Pedestal Sink #4993` (a 12 mm, 0.44 m disc: the mirror hung over the Dark Bath's window casing): 2,553 px, 2,227 visible (`zfight-04-room_l2_Dark_Bath_SE.png`).
7. `Window (1.4 x 1.3)` frame vs `Opening dressing (l2 S 7) #4634`: 1,659 px, 1,093 visible.
Also: `Raised Vegetable Garden Beds` inner box vs outer, `Pool (rect)` vs coping, `Roof hip` vs `Roof gable` parts (1.45 m2), `Colonial Balustrade` vs `Grand Colonial Staircase`.

Confirmed by eye, a flicker and not a number: the cube-storage back panel, the nursery rugs, the dining pier's end face, the orbit's loungers and terrace edge, the Dark Bath mirror (six of the twelve contact images opened). Leads for fixes (read, not proven): paint overlay ends on the pier's end faces, `assets/room-finish.ts:227` (the split points are the hole edges, exactly the pier's planes) and `:237` (the box is `T + EMB` = 0.096 deep); terrace slab, `assets/features.ts:264` and `:274` (the slab's top lands on the roof's top: `deckY = top + 0.03` under a 0.03 slab, and its footprint is the roof rectangle); wall and baseboard bottoms, `room-creator.html:2588` and `:2618` (the baseboard boxes start at y 0 like the wall); rugs, `assets/props/soft.ts:302` (two rugs the composer lays over one another); cube storage back panel, `assets/props/storage.ts:152`; patio, `assets/site-build.ts:229` and `:494`.

### collide, top 10 (`results/collide/<house>.json`, `collide-NN-*.png`)

aurora:
1. prop-window 22 cm, Bird of Paradise in the Mudroom through the window pane of the south wall (foliage, over its 12 cm allowance).
2. prop-wall 9.7 cm, Laundry Hamper (lid, 0.40 m) in the Dressing Room's south wall (`collide-02`: the lid through the wall, the shared box in magenta). Confirmed by eye.
3. door-swing 8.3 cm, Shoe Row in the Foyer in the swing of `front:L` (french, built open) (`collide-03`). Confirmed by eye; seraphine has the same shoe row (8.3 cm, `Entry Hall`).
4. prop-wall 7.9 cm, Curtains (Living) through the east wall; `collide-04` shows the curtain's end showing through the outside of the exterior corner. Confirmed by eye.
5. prop-wall 7.8 cm, Industrial bookshelf in the Study's south wall. 6. 7.7 cm, Tall Cabinet (Dressing Room) in the north partition. 7. 7.5 cm, Cube Storage (Roof Store) in the north wall. 8-10. 7.0 / 7.0 / 6.9 cm, the Landing's and the Dining's Curtains in their partitions (a 2.0 m curtain in a 1.8 m bay).
`patterns`: 8 findings are in a wall by about half its thickness (7-8 cm of a 14-16 cm wall).

seraphine:
1. prop-prop 30.5 cm, Cube Storage inside the Built-in bookcase-wall (Library) (`collide-01`: the blue cube unit in the red bookcase). Confirmed by eye.
2. prop-wall 17 cm, Bar Cart in the Dining room inside the bookcase partition (`collide-02`: the red cart among the shelves). Confirmed by eye.
3. prop-prop 13.9 cm, two Built-in bookcase-walls overlapping. 4. prop-wall 12 cm, Industrial bookshelf in the same partition. 5. prop-prop 11.9 cm, Curtains and Sideboard (Dining).
6. prop-wall 8.9 cm, Writing Desk in the Guest Room's wainscot. 7. prop-window 8.5 cm, Armoire (Master Suite) intersecting the east wall's window sill and glass from inside (`collide-07`; the armoire stands in the window). Confirmed by eye.
8. door-swing 8.3 cm, Shoe Row. 9. prop-wall 8.2 cm, Toilet in the Dark Bath's tile finish. 10. prop-wall 7.9 cm, Pouf in the Gable Nook's south wall.
Also: Flatweave Rug under the grand staircase's stringer (7 cm, prop-stair), Globe Lamp in a Candelabra (5.6 cm).

Whitelisted contacts (aurora / seraphine): rug-pile 79 / 109, wall-mounted 42 / 34, foliage 30 / 8, against-wall 28 / 63, resting 27 / 61, trim 7 / 41, contact 6 / 65, on-surface 6 / 2, cable-plug 6 / 5. `--site` (run on aurora, `results/site/`, 24 findings instead of 23) adds one: `Garden wall (render)` 8 cm into the house's west wall (48,630 cm3, inside the slab).

Top-of-list quality: of the aurora ten and the seraphine ten, every entry is a true geometric intersection of the built meshes; three of each ten were opened and confirmed in the pictures (aurora: hamper lid, shoe row, curtain at the corner; seraphine: cube storage, bar cart, armoire), the rest are the same class (items 7-8 cm into 14-16 cm walls, soft goods into each other). The doubtful ones are at the bottom (4-6 cm, soft goods).

## 8. Known limits, so a later agent does not trust more than it should
- zfight needs a GPU for numbers that mean what the owner's machine shows: the depth format decides which ties exist. The experiment reports ties the renderer here has; it cannot say what a different GPU would do with them (the geometric mode can: coplanar is coplanar everywhere).
- collide's depths are minimum translation distances of convex hulls: for an L-shaped or ring-shaped rigid item they overstate; for cloth and plants they are measured by vertices and understate a little.
- the half-wall-thickness pattern (7-8 cm) is real geometry but mostly invisible (inside the slab). It ranks high because the list is by depth; read `visible` and the picture.
- `prop-door` and `door-swing` of one prop are the same fact reported twice.
- planting, instanced foliage, alpha-tested cut-outs and shadows are outside both detectors.
