# Parametric & Procedural Interiors — System Plan

_Moved from CI-Common `generated/infographics/reference/` with the rest of the house system — see the README. PR and commit numbers below are CI-Common's._

_Status: Phase 1 shipped (spec compiler, 30 SimsTree houses, auto camera shots, spec-driven CAD + isometric generators). **Phase 2 model + wall compiler shipped** (see §1a); **the batch video renderer, its QA gate, and the Companion Core model shipped** (§1b, §3.5); Phases 3–5 are the roadmap._

## 0. Why

`room-creator.html` grew to 8k lines of hand-placed `addItemToScene()` calls: every house was authored three times — once in JS for 3D, once in Python for the CAD sheets (`generate_floor_plans.py`), once in Python for the isometric Lottie scenes (`generate_sims_scenes.py`) — and the three drifted (the Seraphine CAD plan put the AI Lab on L1, the 3D put it on L2). Camera flythroughs were hand-keyed per house and silently broke when a preset moved (Valley-View fell back to the Pascal path).

The fix is a single declarative **HouseSpec** per house that every renderer compiles from.

## 1. What shipped (Phase 1)

```
content/houses/<id>.json  ──►  assets/house-builder.js  ──►  room-creator.html  (3D, wall modes, roofs, shots, video)
        │                      assets/house-geometry.js       (perimeter edges, outline loops, areas)
        ├──────────────────►  scripts/generate_floor_plans.py ──► scenes/floorplans/fp-<id>-l<n>.svg + floorplans.json
        └──────────────────►  scripts/generate_house_iso.py  ──► scenes/svg/house-<id>.svg + lottie-scenes/house-<id>.json
scripts/validate-house-spec.mts  — schema + geometry rules
scripts/build-house-index.mts    — content/houses/index.json (catalog for the <select>)
```

| Piece | Where | Notes |
|---|---|---|
| Schema | [`HOUSE-SPEC.md`](HOUSE-SPEC.md) | lot, palette, levels (footprint = union of rects, openings by side+coordinate, partitions, stairs, voids, balustrades, rooms/items), roofs, site, hero, entry, shots |
| Plan geometry | `assets/house-geometry.js` | raster-union perimeter (0.1 m cells) → merged edges per side → outline loops with holes. Shared by browser + validator. |
| Compiler | `assets/house-builder.js` | perimeter edge → `createParametricWall` (openings converted to local offsets, entry door swung open); partitions; stairs (3 types, height from the next level); upper slabs = `ExtrudeGeometry(Shape + void holes)`; balustrades; roofs (gable w/ dormers+chimney, hip/terracotta, shed, flat+parapet, A-frame glass); site catalog (pool, pond, hot tub, deck, patio, driveway, turf, picket/privacy fence, porch, pergola, gazebo, greenhouse, beds, monkey bars, fire pit, loungers, car, planters, steps, trees/cypress/palm/shrub); hero desk + device |
| Shots | `house-builder.js#shotsFor` | `door-to-core` (establishing → approach → threshold → inside → stairs if the hero is upstairs → desk → device close-up), `orbit`, `hero-reveal`, `walkthrough` (room centres). No hand-keyed coordinates. |
| Page wiring | `room-creator.html` | `?house=<id>` `?shot=<type>` `?flythrough=1` `?autorecord=1&res=1080&aspect=16:9`; `house:` entries in the preset select; shots registered as `SplinePresets["house:<id>:<shot>"]` so the timeline, path viewer and MediaRecorder work unchanged |
| Wall modes | `room-creator.html` | every wall (parametric, solid, glass, partition) auto-registers; roofs register and show only in *Walls Up*; upper-storey walls keep their elevation |

Fixed on the way: Valley-View spline mapping, solid/glass walls ignoring wall modes, upper walls pinned to y=0, GPU geometry leak on preset switch (745→2392 → flat), Retina doubling of export/record size, zero-size viewport GL spam, O(n²) outliner rebuilds during preset load, iso angle buttons as no-ops in orbit mode, Seraphine's missing L2 walls, a mislabeled spline option.

## 1a. What shipped (Phase 2 — plan model + wall compiler)

```
assets/floorplan-graph.js   Corner / Wall / HalfEdge / Room / FloorplanGraph (blueprint3d port, no THREE, no jQuery)
                            FloorplanGraph.fromFootprint(rects, partitions, opts) · fromLevel(level) · toJSON / fromJSON
assets/wall-compiler.js     createWallCompiler({ THREE }) → compileWall / compileHalfEdge / compileGraph / compileRoomFloor
                            applyCutaway(mesh, mode) · enableCutaway(renderer)  — clipping-plane wall modes
scripts/test-floorplan-graph.mts   node --test (room detection, mitres, 45° walls, JSON, all 30 specs, compiler, cutaway)
floorplan-graph-demo.html   ?house=<id>&level=<id> — 2D graph (SVG) beside the compiled meshes with a cutaway toggle
```

| Piece | Notes |
|---|---|
| Rooms | `findRooms` tightest-cycle walk, verbatim from blueprint3d, plus two rules of ours. A cycle whose mean width (2·area / perimeter) is under a wall's thickness (`MIN_ROOM_WIDTH`, 0.16 m) is a sliver inside the wall solids, not a room: the two leaves of a two-tone partition (familyhouse-nora, mesamariposa L1). A partition whose midpoint is outside the footprint is façade dressing (aurora's cladding 4 cm off the perimeter): its ends don't snap and nothing snaps onto it, so it stays a straight orphan wall and never cuts the perimeter wall it runs beside (whose openings would otherwise be clamped at the cut). Every HouseSpec level converts; detected rooms ≤ authored `rooms[]` because authored bounds subdivide open-plan cycles that no partition closes (e.g. asymmetry L2 "Stair Hall"). Dangling partition ends stay orphan walls with square ends. Island partition boxes (gardennook bathroom) detect as their own room; `roomAt()` returns the innermost. |
| Mitres | `HalfEdge.interior()/exterior()` via `halfAngleVector`; tested symmetric at 90° and exact at 135°. Perimeter walls use interior + exterior of their one half-edge; shared partitions use the two rooms' interiors, so faces stay flush with the neighbouring walls instead of poking through them. |
| Walls | One non-indexed `BufferGeometry` per wall from a `THREE.Shape` in the (along, up) plane — windows as holes, doors as contour notches — swept across the thickness with the mitre applied to the end caps. Aurora L1: 11 meshes / 288 triangles for the whole level. `openings[].worldRect` gives the hole centre, size, `rotationY` (+Z outward) for a door/window unit. |
| Cutaway | `material.clippingPlanes` at base + 0.85 for south/east-facing walls and partitions (the same rule as room-creator's `applyWallModeToMesh`), base + 0.15 for every wall in `down`; `clipShadows` on. Needs `renderer.localClippingEnabled`. |
| Builder | `createHouseBuilder({ …, useGraphWalls: true })` swaps the pier/lintel decomposition for graph walls; **off by default, nothing changes without it**. Door/window units and clipping-plane modes are not wired into `room-creator.html` yet (it still registers the meshes with `registerTrackedWall`, so the scale-Y modes apply). |
| Openings | A perimeter opening that straddles a partition junction is split into one opening per wall (a glass run becomes two panes) instead of being dropped or clamped. |
| Partitions | A partition end within `SNAP_TOLERANCE` (0.06 m) of a segment, which absorbs authored coordinates against the 0.1 m raster outline, moves only along the partition's own axis: extended or trimmed to meet a wall it points into, never sideways. Every graph wall stays axis-aligned (the all-specs test asserts it), and a partition laid parallel to a wall or another partition a few cm off it (onestory L1's 1.32 m panel 5 cm in front of a 1.5 m one) keeps its authored line instead of folding onto it or skewing into it. A half-wall a few cm off the partition it continues (cocoon L1) is joined to it by a short square jog. |

Run the tests with `pnpm run test` (`node --experimental-strip-types --test scripts/test-floorplan-graph.mts`, after `pnpm run build`); serve the demo with `pnpm run serve` and open `/floorplan-graph-demo.html`.

**Cut-over (2026-09-12).** The six SimsTree builds that still had hand-coded presets in `room-creator.html` (Mesa Mariposa, Seraphine, Lake Cabin, Valley-View, Family Home, Modern House 1) now load from their specs only: the featured `<option>`s and quick pills point at `house:<id>`, the hand-keyed `<x>-door-to-core` splines are gone in favour of the auto `house:<id>:door-to-core`, and the hand-tuned tours (`seraphine-grand-tour`, `*-flight`) are surfaced in the house's shot group via `HOUSE_TOURS`. Old ids (`sims-seraphine`, `lake-cabin`, …) still resolve for one release through `LEGACY_HOUSE_PRESETS` — drop that map afterwards. Fidelity gaps closed on the way: pools were buried under `patio`/`driveway`/lot slabs in 10 houses (slabs now get holes punched for water bodies), the turtle-mosaic pool was a solid box (basin opened), and `column` / `turtle-pool` / `bridge` / `soccer-goal` / `cactus` were added to the spec vocabulary. Not carried over: Seraphine's recessed L2 balcony (the spec's gable + dormer roof supersedes it) and Valley-View's pilotis (its L1 is enclosed in the spec).

## 1b. What shipped (Phase 2 — product shots + the Companion Core)

```
scripts/render-house-shots.mts      house × shot → video/houses/<id>/<shot>.{mp4,poster.jpg,final.jpg} + manifest.json (merged, resumable)
                                    --qa-only / --no-gate / --skip-existing / --jobs N / --poster-only / --res / --aspect / --fps
scripts/validate-house-spec.mts --shots     schema + geometry + the shot QA gate, one exit code for CI
scripts/export-core-gltf.mts        dist/models/companion-core-<finish>-<pose>.glb via three r169 GLTFExporter (vendored)
video/houses/index.html             gallery: poster → inline MP4, shot picker, author credit, QA badge, room-creator link
room-creator.html hooks             __houseRenderBegin/Frames/End · __houseShotQA · __houseSnapshot · __houseCoreFactory · __houseExportCore · __houseDebug
```

| Piece | Notes |
|---|---|
| Deterministic capture | The page steps `applySplineFrame(i/(N−1))` per frame and hands each frame back as a JPEG; one ffmpeg per shot (image2pipe → H.264 CRF 18, bitexact). Byte-identical run to run, independent of frame rate or load. JPEG over CDP beat every raw-pixel transport measured (toBlob 65 ms/frame, fetch 40 MB/s, WebSocket 120–200 MB/s). |
| Shot QA gate | `__houseShotQA` samples the camera path against the scene *as displayed* (cutaway walls at their cut height; a parametric wall's full-height solids sit in a hidden group and `Raycaster` ignores visibility, so effective visibility is computed): wall/floor clips, entering through a wall, ending outside, Core out of frame or occluded on the last frame; warnings for furniture clips and wall grazes. Found eight real defects the eye had missed; then caught two bugs in its own fix. |
| Camera clearance | `shotsFor` runs `clearPoint()` — keeps an eye point inside its level's footprint and a margin off perimeter and partition solids (doorways open) — on every interior door-to-core point and the hero-reveal pull-in; follows multi-flight stair chains; climbs a quarter-turn round a spiral; hero-reveal pulls in under the ceiling when a storey sits over the approach. |
| **The Companion Core** | `AssetFactory.createCompanionCore({ finish, pose })`, to the GM100 product photos and the chassis spec (CI-Common `generated/infographics/reference/CHASSIS-INTERIOR.md` a.1): **232 × 205 × 90 mm**. Solid front plate, one row at mid-height in the right half — 2 × USB-A (USB 2.0), 2 × 3.5 mm, chrome power button with its LED ring. U-lid with perforated fields *inset* (top 22 mm behind the front edge / 14 mm elsewhere, sides 10 mm), rendered as a translucent veil so the fan reads through it at a metre. Rear from behind: ITX I/O cutout low-left with the six connector bodies of `companion-core/assets/core-io.svg` on a steel shield, slotted PCIe bracket above, FlexATX bay tall and narrow on the right (C14 + 40 mm grille), label + two antenna holes top-left, corner screws. `finish` chalk (white) \| charcoal (black); `pose` prone (as the campaign draws it) \| upright (stood on its LEFT side, so the row reads button-up). The front is drawn solid on the owner's direction; a.1's "MESH top, sides and front" line is for the fact-sheet owner to reconcile. |
| Interior | To the Framework MAIN PCB sheet (CI-Common `generated/infographics/reference/MAINBOARD-DRAWING.md`): board on 6.5 mm standoffs with its rear-I/O edge in the cutout; 152.30 × 130.50 fin stack centred on the screw rectangle's centre (83.92, 63.85) — five blocks, four heatpipes, 48.88 tall; 147.76 × 139.06 duct at plan offset (21.54, 12.84), not concentric with the fins; 120 × 25 nine-blade downdraft fan, top 75.88 above the board face, four 7 mm-head screws; FlexATX supply left-rear; 2.5" SSD on the right panel; drive rack out. Connector heights are schematic (not on the sheet); the fan is neutral grey where the sheet shows Noctua branding. |
| Powers on in shot | `preset.power = { at, ramp }` (shot fraction). Dark until the camera comes round the desk — door-to-core 74 %, hero-reveal 55 %, walkthrough 80 % — then a 0.3 s button press, LED ring + hub ring + desk glow ramp, fan spin-up over 1.5 s (closed-form angle, so capture stays deterministic). Orbit on throughout. The desk glow is an additive decal, not a light (a point light beside the glossy desk made a hotspot). |
| Cables | `userData.core.anchors()` gives the C14 inlet and lower DisplayPort in world space; `createCable` draws a centripetal Catmull-Rom tube with a plug body. Desk: power cord off the back to the floor + display lead to the monitor base. Shelf: one cord down the wall. |
| Placement | `hero.device` chalk \| charcoal \| strix, `hero.pose`, `hero.surface` desk \| credenza \| island \| **shelf** (headless: floating walnut shelf at 0.8 m — under the 0.85 m cutaway line — with books and a cord) \| none; `core-shelf` room item for a second, headless Core anywhere (at = wall face, rot = wall heading). 30 heroes: 18 chalk / 12 charcoal, 16 prone / 14 upright, 8 on shelves; 6 living rooms carry a `core-shelf`. The isometric generator draws the same sizes, poses and shelves. |
| glTF | `companion-core-{chalk,charcoal}-prone.glb` (published in CI-Common `generated/infographics/assets/models/`; `pnpm run export:core` writes fresh ones to `dist/models/`) (~640 KB, glTF 2, node `fan rotor` spins; upright is a rotation). Lid perforation lives in the base-colour texture's alpha (alphaMode BLEND) so it survives export; the glow decal and cables are not exported. `scripts/export-core-gltf.mts` regenerates; README in `assets/models`. |

Shipped as #202 (renders + gallery + `hero.rot` convention fix), #203 (isometrics), #206 (deterministic capture + gate), #207 (camera clearance), #208/#210 (the Core).

## 2. Reference analysis

**blueprint3d** (FurnishUp, MIT — `LICENSE.txt` confirms; safe to port). Model = `Corner`/`Wall`/`HalfEdge`/`Room`. Rooms are found by `Floorplan.findRooms()`: for every wall, walk the corner graph choosing the tightest turn (`_findTightestCycle`, smallest θ first) and de-duplicate cycles. Each wall has a front/back `HalfEdge` whose `interiorStart/End` and `exteriorStart/End` are **mitred offsets** from the corner via `halfAngleVector(prev, next)` — that is what makes wall junctions watertight at any angle, not just 90°. Wall geometry is a `THREE.Shape` per half-edge with **holes for in-wall items** (doors/windows) — no CSG. Items are typed by attachment: `FloorItem`, `WallItem`, `InWallItem`, `OnFloorItem`, `WallFloorItem`, `InWallFloorItem`; wall items snap to the half-edge and keep a `refVec`. Serialisation is `{corners:{id:{x,y}}, walls:[{corner1,corner2,frontTexture,backTexture}], items:[…]}`.

**Roometron** (three.js discourse #88849). Product = 2D wall/room drawing + door/window placement + furniture + materials + viewer mode. Rendering choices worth copying: IBL-first lighting (we already do — `pascalSkyTexture`), **progressive shadow maps** accumulated on the fly (`ProgressiveLightMap` example) with pre-baked fallback, **wall occlusion via clipping planes** (three.js clipping example) instead of scaling walls, a few GLSL patches on stock materials, and an iPhone-7 performance budget.

**Ours today.** Rectilinear-only footprints (rect unions), walls as boxes with pier/lintel/apron decomposition built three times (full/cutaway/baseboard groups), furniture as procedural box assemblies, cutaway by group visibility. Good enough for stylised Sims recreations; the limits are non-orthogonal walls, editing, and per-room materials.

## 3. Target architecture (Phases 2–5)

### 3.1 Data model — `FloorplanGraph` (Phase 2)

Port blueprint3d's model, typed, without jQuery:

```
Corner { id, x, z }                       // plan vertex
Wall   { id, a: Corner, b: Corner, thickness, height, front: HalfEdge, back: HalfEdge, openings: Opening[] }
HalfEdge { wall, room?, prev, next, interior(): [p0,p1], exterior(): [p0,p1] }   // mitred via half-angle vectors
Room   { id, corners: Corner[], floor: Material, ceilingHeight, name, no }
Opening { kind: door|window|slider|garage|glass|arch, at: 0..1 along wall, w, h, sill, swing }
Level  { y, height, graph: FloorplanGraph, voids: Polygon[], stairs: Stair[] }
```

- `HouseSpec.levels[].footprint` (rect union) **compiles down** to a `FloorplanGraph` (corners at outline vertices, one wall per outline edge, partitions as interior walls that split rooms). The spec stays the authoring format; the graph is the runtime format an editor manipulates.
- Room detection = tightest-cycle walk (blueprint3d), which also gives us **rooms for free from partitions** — today `rooms[].bounds` is hand-authored.
- Non-rectilinear walls become possible (bay windows, angled wings) because half-edge mitring handles any angle.

### 3.2 Geometry compilers (Phase 2)

| Compiler | Input | Output |
|---|---|---|
| `WallCompiler` | HalfEdge + openings | one `Shape` (+ holes) per face, extruded to thickness → **single mesh per wall** instead of ~12 boxes; three LOD groups (full / cutaway / plan) become **clipping planes** (Roometron) — `renderer.clippingPlanes = [plane at y = 0.85]` for S/E-facing walls, so cutaway costs nothing and works on any geometry |
| `FloorCompiler` | Room polygon | `ShapeGeometry` per room with per-room material (oak / terrazzo / tile …), skirting from the room's half-edges |
| `SlabCompiler` | Level outline − voids | `ExtrudeGeometry` (already in Phase 1), plus stair-well trimming |
| `RoofCompiler` | roof spec | straight-skeleton hip/gable for arbitrary polygons (Phase 3); Phase 1 covers rect roofs |
| `StairCompiler` | Stair spec | existing 3 builders, parameterised by rise/run; auto-void |
| `ItemCompiler` | item spec | typed attachment (floor / wall / in-wall / ceiling / on-surface) with snapping and collision against the graph |

### 3.3 2D floor-planner + sync (Phase 3)

A browser 2D editor over the same `FloorplanGraph` (blueprint3d's `floorplanner` module is the template): draw walls, drag corners (mitring updates), place openings along walls, drop items. **Edits write back to the HouseSpec** (rect unions are re-derived from the outline, or the spec grows a `walls` form for non-rectilinear plans) so the Python generators stay in sync. The CAD sheet renderer becomes a pure function of the graph — the same code can run in the browser (SVG) and in Python (today's `generate_floor_plans.py`).

### 3.4 Materials & lighting (Phase 3)

- Per-room floor/wall materials in the spec (`rooms[].floor`, `walls[].material`), textures from the existing procedural canvas generators + a small PBR set (brick, stone, siding, corrugated, terracotta tile).
- Progressive lightmap accumulation while the camera is idle (Roometron); AgX tone mapping and the Pascal IBL stay.
- Mobile budget: ≤ 30k triangles per house (Phase 1 houses are 5–15k), one draw call per wall/floor after the compilers.

### 3.5 Product-shot video pipeline (Phase 2)

Already in the browser: MediaRecorder at 60 fps, spline-driven camera, `?autorecord=1`. Plan:

1. **Shot list per house in the spec** (`shots[]`) — types today: `door-to-core`, `orbit`, `hero-reveal`, `walkthrough`; add `room-pan:<room>`, `exterior-dolly`, `dusk-timelapse` (lighting preset crossfade).
2. ~~**Batch renderer**~~ ✅ — `scripts/render-house-shots.mts` (Playwright + headless Chromium, `--use-angle=metal`, `--software` for SwiftShader): for each house × shot, opens `room-creator.html?house=<id>&shot=<type>`, runs the QA gate, captures deterministically (item 3), writes `video/houses/<id>/<shot>.{mp4,poster.jpg,final.jpg}` and a merged, resumable `manifest.json` (`--skip-existing`, `--jobs N`, retries on a fresh context). No WebM intermediate. Renders are git-ignored; `video/houses/index.html` is the gallery.
3. ~~**Deterministic timing**~~ ✅ — `render-house-shots.mts` no longer uses the page's MediaRecorder: `window.__houseRenderBegin/Frames/End` step `applySplineFrame(i/(N−1))` per frame and hand each frame back as a JPEG, piped into one ffmpeg per shot (image2pipe → H.264 CRF 18, `-flags +bitexact`). Output is byte-identical run to run and independent of frame rate or machine load; 4K only costs time. `--jobs N` renders N houses at once. The Record button keeps the MediaRecorder path for humans.
3b. **Shot QA gate** ✅ — `window.__houseShotQA(shot)` samples a shot's camera path against the built house (wall/floor clips, entering through a wall instead of the door, ending outside the house, Core out of frame or occluded on the last frame; warnings for furniture clips and wall grazes). `render-house-shots.mts` runs it before every render and skips shots with errors (`--no-gate` to override; `--qa-only` for a report), and `validate-house-spec.mts --shots` folds it into the spec validator so CI fails a spec before anyone renders it. Findings live in the manifest (`qa`) and show as a badge in `video/houses/index.html`.
4. **Gallery** — `video/houses/index.html` ✅ reads the render manifest (poster → inline MP4, shot picker, author credit from `content/houses/index.json`, QA badge, link into `room-creator.html?house=&shot=&flythrough=1`); a viewer for the isometric/Lottie/CAD side still has to read `scenes/manifest.json` → `houses[]` (its paths are relative to the repo root; CI-Common's `scenes.html` never did).
5. **The Companion Core in every shot** ✅ — see §1b: the model to the product photos and the mainboard sheet, powered on in shot, cabled, on desks and shelves, and exported as glTF. Still open: the screen content (the monitor is one static canvas), a dusk pass with the Core as the only warm light, and a per-aspect framing bias for 9:16 / 1:1 instead of a centre crop.

### 3.6 Persistence / export (Phase 4)

- Round-trip JSON (spec ⇄ graph), glTF export of the compiled house (KHR_materials), SVG sheet export from the browser.
- Versioned schema (`$schema: house-spec/v2` when `walls[]` form lands); validator gates CI (`build-house-index.mts` exits non-zero on invalid specs).

## 4. Milestones

| Phase | Deliverable | Est. |
|---|---|---|
| 1 ✅ | HouseSpec v1, compiler, 30 houses, auto shots, spec-driven CAD + iso generators, fixes | done |
| 2 | `FloorplanGraph` + tightest-cycle rooms + mitred `WallCompiler` (Shape+holes, clipping-plane cutaway) ✅ · batch video renderer + QA gate ✅ · the Companion Core model + glTF ✅ | done |
| 3 | 2D floor-planner in the browser with write-back; per-room materials; straight-skeleton roofs | 2–3 wk |
| 4 | glTF/JSON round-trip of the compiled *house* (the Core alone exports today), schema v2 (`walls[]`), CI validation (`validate-house-spec.mts --shots` exists; wire it into CI) | 1 wk |
| 5 | Progressive lightmaps, mobile perf pass, WebXR walk-through | 2 wk |

## 5. Conventions to keep

- `+Z` is south/front, `+X` east, metres, Y up; iso camera from the SE ⇒ S/E walls are the cutaway walls.
- Every wall/roof goes through `registerTrackedWall` / `registerRoof` — never toggle `visible` on walls by hand.
- Specs are the only hand-edited artefact; SVG/Lottie/floorplans.json/index.json are generated.
- Credit the SimsTree build author in `spec.author`; it flows to the CAD title block and the gallery card.
- `hero.rot` (and a `core-shelf` item's `rot`) is the heading the desk or shelf **backs onto** — rot 0 = wall/monitor side north, user south. The asset library faces the other way (front at −Z at rotation 0), so the builders turn the hero assets 180° from the spec heading; `fwd` is where the user sits and the camera comes from.
- The Companion Core is 232 × 205 × 90 mm everywhere — 3D, isometric, glTF. Sizes, ports and the interior come from `CHASSIS-INTERIOR.md`, `core-io.svg` and `MAINBOARD-DRAWING.md`; don't restyle the device to taste, change the source and regenerate.
- Render and gate before eye-checking: `render-house-shots.mts --qa-only` on the shots a change touches, then look at `<shot>.final.jpg`.
