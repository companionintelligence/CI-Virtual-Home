# HouseSpec v1 — single source of truth for 3D, CAD floor plans, and isometric/Lottie renders

One JSON file per house in `content/houses/<id>.json`. Three consumers read it:

| Consumer | Output |
|---|---|
| `assets/house-builder.ts` → `.js` (browser, Three.js) | 3D scene in `room-creator.html`, auto camera splines, product-shot video |
| `scripts/generate_floor_plans.py` (Python, `pnpm run floorplans`) | CAD sheets `scenes/floorplans/fp-<id>-l<n>.svg` + `floorplans.json` |
| `scripts/generate_house_iso.py` (Python, `pnpm run iso`) | Isometric SVG + Lottie scene `scenes/svg/house-<id>.svg`, `scenes/lottie-scenes/house-<id>.json` |

**Never hand-edit derived files. Edit the spec, re-run the generators.** After editing specs: `pnpm run validate`, then
`pnpm run plans` (the `<id>.plan.json` twins), `pnpm run iso`, `pnpm run floorplans`, and `pnpm run check` for the
render gate (see the README).

The spec is also a TypeScript type: `assets/spec/index.ts` (`HouseSpec`), merged from `base.ts` — this document's
fields as the builder honours them today — and one fragment per stream of pass 4 (`kit.ts`, `arch.ts`,
`compose.ts`, `site.ts`, `shots.ts`), which add the fields documented under [Pass-4 fields](#pass-4-fields) below.
Every new field is optional: a spec that uses none of them keeps today's look, apart from the fixes declared in
`test/goldens/expected-diffs/` (neutral ceilings and the monitor's pole, S1; slab holes, S2).

## Coordinate system

- Metres. Y up. Origin `(0,0)` = centre of the lot.
- **+Z is SOUTH = the street / front of the house.** −Z is north / back yard.
- +X is EAST. Isometric default camera looks from the south-east, so the S and E walls are the "cutaway" walls.
- Rectangles are `{ "x", "z", "w", "d" }` where `x,z` is the **min corner** (west, north) and `w` spans +X, `d` spans +Z.
- Rotations `rot` are degrees, counter-clockwise seen from above (0 = faces south / +Z).

## Top level

```jsonc
{
  "$schema": "house-spec/v1",
  "id": "aurora",                       // kebab-case, matches file name
  "name": "Base Game Aurora",
  "author": "Ornilia",                  // SimsTree build author (credit)
  "source": "SimsTree slide 02",
  "style": "Two-storey white modern, flat roofs, front pool",  // one line
  "emoji": "🏢",
  "lot":  { "w": 30, "d": 24, "ground": "lawn" },   // ground: lawn | desert | forest | urban | waterfront (lawn, and
                                                     // a lake past the back lot line instead of a back row of houses)
  "palette": {
    "wall": "#f8fafc", "trim": "#1e293b", "roof": "#334155",
    "accent": "#0f766e", "material": "stucco",         // stucco | siding | brick | stone | timber | corrugated | glass
    "interior": "#…"                                   // optional: the inside of the walls (see Hero / entry / shots)
  },                                                   // `roof` is a role colour only: roofs take their own `color`
  "levels": [ /* see Level */ ],
  "roofs":  [ /* see Roof  */ ],
  "site":   [ /* see Site  */ ],
  "hero":   { "level": "l1", "at": [-4.5, -2.0], "rot": 0, "device": "chalk", "pose": "prone", "surface": "desk" },
  "entry":  { "level": "l1", "side": "S", "at": 0 },   // which opening is the front door
  "lighting": "day",                    // day | golden | dusk | night (assets/environment.ts; old names alias: pascal-daylight/ci-mist/ci-biophilic → day, ci-twilight → golden, ci-dark → dusk)
  "shots":  [ { "id": "door-to-core", "type": "door-to-core", "duration": 12 },
              { "id": "orbit",        "type": "orbit",        "duration": 10 } ],   // optional overrides; core-orbit (8 s), hero-reveal, walkthrough are built too
  "areaSqm": 168,                       // optional; generators compute from footprints when omitted
  "defaults": 1                         // optional: 1 (or absent) = today's look; 2 = every pass-4 look-changing default
}
```

`defaults` is the look switch (plan pass 4): new defaults that change how a house looks (door colours, fans, lamps,
gutters, gable windows, lanterns, world variety, restraint) apply only under `"defaults": 2`, so a spec without it
keeps its look exactly. Code reads it through `specDefaults(spec)` in `assets/spec/index.ts`; the validator refuses
any value but 1 or 2.

## Level

```jsonc
{
  "id": "l1", "name": "Ground Floor", "sheet": "A-101",
  "y": 0,            // slab top elevation (l2 is typically 2.8 or 3.0)
  "height": 2.8,     // wall height on this level
  "floor": "oak",    // oak | herringbone | terrazzo | phthalo-terrazzo | charcoal-terrazzo | marble | concrete | deck | tile
  "footprint": [ { "x": -6, "z": -4, "w": 12, "d": 8 }, { "x": 6, "z": 0, "w": 4, "d": 4 } ],
                     // union of axis-aligned rects → perimeter walls are derived automatically
  "wallColor": "#…", "trimColor": "#…",   // optional per-level overrides of palette. wallColor drives this storey's
                                          // stucco trim band, painted eaves and default interior; it clads the storey
                                          // too with `material` (or under "defaults": 2) — see Kit (S1)
  "interior": "#…",  // optional: this storey's inside wall colour (default palette.interior, else wall lifted)
  "openings": [
    // side = S|N|E|W. `at` is the X coordinate for S/N walls and the Z coordinate for E/W walls
    // (the world coordinate of the opening centre). The builder finds the perimeter edge on that side.
    { "side": "S", "at": 0,    "type": "door",   "w": 1.0, "h": 2.1, "style": "entry", "color": "#…" },
                     // style: entry | cased | glass-slider | garage. color: the leaf's (default teal #0f766e). A door wider
                     // than 1.1 m is a cased opening with no leaf, so its color does nothing
    { "side": "S", "at": -3.5, "type": "window", "w": 1.4, "h": 1.3, "sill": 0.9 },
    { "side": "N", "at": 2,    "type": "slider", "w": 2.4, "h": 2.2 },                       // sliding glass patio door
    { "side": "E", "at": 0,    "type": "glass",  "w": 6,   "h": 2.7 },                       // floor-to-ceiling glazing span
    { "side": "S", "at": 4,    "type": "garage", "w": 2.6, "h": 2.2 }                        // garage door (closed leaf)
  ],
  "partitions": [
    { "from": [-2, -4], "to": [-2, 4], "door": 1.5, "doorW": 0.9, "height": 2.7, "color": "#…" }
                     // door = distance from `from` along the wall, or null; height (default level height − 0.1);
                     // color (default the storey's interior colour); the leaf: doorColor / doorStyle (Kit, S1)
  ],
  "stairs":  { "type": "timber", "at": [3, 0], "rot": 180, "to": "l2", "w": 1.1, "run": 3.36 },
                     // timber | colonial | spiral ; at = bottom step; rot = ascent direction (0 = ascends toward +Z);
                     // w width (timber 1.1, colonial 1.2), run plan length (3.36; a spiral has none). One flight a level, or an array of flights (see Architecture (S2) → Stairs)
  "voids":   [ { "x": 2.4, "z": -1.8, "w": 1.2, "d": 3.6 } ],              // slab cut-outs; only meaningful when y > 0
  "balustrades": [ { "from": [x,z], "to": [x,z], "style": "glass" } ],      // glass | colonial ; for mezzanine edges
  "rooms": [
    {
      "no": "01", "name": "Living Salon",
      "bounds": { "x": -6, "z": -4, "w": 6, "d": 8 },   // used for CAD labels + area; must lie inside the footprint
      "items": [
        { "type": "sectional",    "at": [-3, 0],   "rot": 0 },
        { "type": "coffee-table", "at": [-3, 1.4] },
        { "type": "fiddle-leaf",  "at": [-5.5, -3.5] }
      ]
    }
  ]
}
```

## Roof

```jsonc
{ "over": { "x": -6, "z": -4, "w": 12, "d": 8 },   // plan rectangle the roof covers (usually a footprint rect + overhang)
  "y": 2.8,                 // eave elevation (top of the walls it sits on)
  "type": "gable",          // gable | hip | shed | flat | aframe-glass | terracotta (= hip, tile colour)
  "ridge": "x",             // ridge runs along X or Z (gable/shed/aframe)
  "high": "N",              // shed only: the high side (default N)
  "pitch": 32,              // degrees (gable/hip/shed/aframe)
  "overhang": 0.4,
  "color": "#3f2a1d",       // default by type: gable/hip #3f2a1d, shed/flat #334155, terracotta #b45309 (not palette.roof)
  "parapet": 0.35,          // flat roofs: parapet height
  "dormers": [ { "at": 2.0, "w": 1.4 } ],   // gable only: position along the ridge axis
  "chimney": { "at": [4, -2] } }
```

- **`over` is the footprint plus the overhang.** A side reaches whichever is larger, the walls under it or
  `overhang`, never their sum; only an `over` carried more than `overhang + 0.15` m past the walls (a roof run out
  over a porch or a carport) keeps its whole reach.
- **The roof colour is restrained, and a dark one is pulled to charcoal.** `kit.roofMaterial` restrains every roof
  colour; a shingle or standing-seam roof whose colour has a luma under 0.35 is then mixed 42 % toward a cool
  charcoal (a membrane 40 %), and clay tile 12 % toward #3a3531. A light roof only loses saturation.
- **The eaves are painted trim** (fascia, rake boards, soffit, gutters): on a light house (wall luma over 0.55)
  with dark *chromatic* trim (luma under 0.5, channels more than 14 apart — brown, navy) they take the wall colour
  lifted instead; dark neutral trim (near-black, charcoal) and flat roofs keep the trim colour.

## Site items

`{ "type": …, "at": [x, z], "w", "d", "rot", "h", "y" }` — `at` is the centre; `y` lifts the item off the ground
(a planter on a deck, a pool on a terrace; default 0, or the terrace it stands on — Site (S4)). A type the builder
does not know is refused by the validator, and reported by the scene QA (`site-dropped`) if one ever reaches it.
S4's fields (planting, curves, surfaces, water shapes, terraces, stairs, fence styles, the lot's context and water)
are under [Pass-4 fields → Site (S4)](#pass-4-fields).

| type | notes |
|---|---|
| `pool` | `w × d` water slab, stone coping (lifted 0.16 m so it reads above a `patio`/`deck` on the same rect) |
| `turtle-pool` | Schnucko sea-turtle mosaic pool `w × d` (own coping) |
| `pond`, `hottub` | natural / round water |
| `deck` | timber slab (`h` = elevation, default 0.12); above 0.35 m it is a stilted platform — 0.15 m slab with its top at `h`, posts, rail on its own S and E edges (so `rot` turns which sides are railed) — so an upper-floor terrace reads as one, not as a block |
| `tree` | seeded low-poly tree; `species`: round \| oval \| layered \| conical \| birch (default: seeded pick), `h`, `color`, `autumn`; scale/lean/spin jitter unless `jitter: false` |
| `shrub` | 1–3 clumped blobs, seeded size and leaf colour; `r`, `color`; `form`: mound \| boxwood \| spreading \| flowering \| grass (default: a seeded pick; `mound` when `color` is set or `jitter: false`) |
| `flowers` | a flowering clump; `r`, `color` |
| `rock` | one boulder; `r` |
| `bed` | planted bed on soil: `poly: [[x,z],…]` (any polygon) or `at,w,d`; `plants`: mixed \| flowers \| shrubs \| grass; `density` per m² |
| `hedge` | clipped hedge along `path: [[x,z],…]`; `h`, `w`, `color` |
| `path` | paved strip along `path: [[x,z],…]`; `w`, `color` — lay it on lawn, not over a patio (a patio is taller) |
| `scatter` | seeded cluster in a disc: `at`, `r`, `n`, `species: ['shrub','rock','flowers','tree']` |
| `grove` | `n` trees clustered in `r` around `at`, one `species` or a list, `h` |
| `patio`, `driveway` | concrete / paver slab |
| `turf` | soccer pitch |
| `fence` | picket/privacy fence along a segment: `from`/`to` instead of `at` |
| `wall-low` | garden wall segment: `from`/`to`, `h` |
| `porch` | colonnade porch `w × d`: a raised timber deck, four columns and a header beam along its +Z edge — **no roof** |
| `pergola`, `cabana`, `gazebo`, `greenhouse`, `garden-beds`, `monkeybars`, `firepit`, `loungers`, `bench`, `car`, `planter` | props (`pergola` is an open frame, `cabana` the curtained lounge it used to build — see Site (S4); `garden-beds` are raised vegetable crates, `count`) |
| `steps` | a flight of `n` steps (default 3), `w` wide (1.6), 0.16 m risers and 0.32 m treads rising toward −Z at `rot` 0 |
| `bridge` | timber stepping bridge / boardwalk `w × d` (d runs along Z at `rot` 0) |
| `soccer-goal` | goal frame (pair with `turf`) |
| `tree`, `cypress`, `palm`, `shrub`, `cactus` | vegetation (`cactus` = saguaro group) |

Site items with seeded variation are resolved by the three.js builder; `scripts/build-house-plan.mts` writes each house's instances to `content/houses/<id>.plan.json` and `generate_house_iso.py` draws them from there (run it after editing specs or `assets/site.js`, before the isometrics).

## Item catalog (furniture `type` → footprint w × d, metres)

| type | footprint | type | footprint |
|---|---|---|---|
| `sectional` | 3.2 × 2.0 | `platform-bed` | 2.2 × 2.3 |
| `club-chair` | 0.9 × 0.9 | `wardrobe` | 2.2 × 0.6 |
| `coffee-table` | 1.2 × 0.6 | `crib` | 1.3 × 0.7 |
| `octagonal-table` | 1.2 × 1.2 | `ensuite` | 2.4 × 2.0 (bath + vanity) |
| `dining-set` | 2.0 × 0.95 (table + chairs) | `bookshelf` | 1.2 × 0.35 |
| `dining-table` | 2.1 × 1.0 | `walnut-desk` | 1.6 × 0.8 |
| `kitchen-island` | 2.4 × 0.9 | `task-chair` | 0.6 × 0.6 |
| `kitchen-cabinetry` | 3.6 × 0.65 (against a wall) | `curved-monitor` | on desk |
| `media-credenza` | 1.8 × 0.45 | `chalk-tower` / `charcoal-tower` / `strix-mini` | on desk/credenza |
| `wall-tv` | 1.6 × 0.1 (against a wall) | `speakers` | on desk |
| `fireplace` | 1.6 × 0.5 (against a wall) | `halo-lamp` | 0.4 × 0.4 |
| `area-rug` | 3.2 × 2.2 | `circular-rug` | r 2.0 |
| `concentric-rug` | r 1.6 | `fiddle-leaf` / `monstera` / `bonsai` / `bamboo` / `cactus-group` | plants |
| `sun-lounger` | 0.7 × 2.0 | `telescope` | 0.6 × 0.6 |
| `bench` | 1.8 × 0.5 | `soccer-goal` | 1.8 × 0.6 |
| `column` | r 0.16 (`r` or square `size`; `style` modern \| colonial \| steel; `h` defaults to level height − 0.18; `color`, default the trim, steel #1e293b) | | |

Any item may pass `"w"`, `"d"`, `"color"` overrides where the underlying builder supports them.

## Hero / entry / shots

- `hero` = where the Companion Core sits (the flythrough destination). `surface`: `desk` (adds walnut desk + monitor + chair), `credenza`, `island`, `shelf` (headless: a floating shelf on the wall the hero backs onto, the Core and a few books on it, one power cord down the wall; `shelfHeight` in metres, default 0.8 — under the 0.85 m cutaway line), `none`. The Core is always plugged in: a power cord from the rear inlet off the back of its surface to the floor, and on a desk a display lead to the monitor. `device`: `chalk` | `charcoal` (the Companion Core — 232 × 205 × 90 mm, mesh front/sides/top, 120 mm fan under the top mesh, power button on the front) | `strix` (the AMD reference mini PC). `pose`: `prone` (default; 232 wide × 90 high, as the campaign draws it) | `upright` (stood on its side: 90 wide × 232 tall, fan side outward). `rot` is the heading the desk backs onto (rot 0 → monitor against the north wall, user south of it). Room items `chalk-tower` / `charcoal-tower` take the same `pose`. A headless Core elsewhere in the home is the `core-shelf` item: `at` is the wall face, `rot` the wall heading (same sense as `hero.rot`), `finish`, `pose`, `h` shelf height, `w` shelf width.
- Shots turn the Core on: it is dark until the camera comes round to it (`door-to-core` as its front comes round in the finale's orbit — the moment the eye is 55° off its face, and at least 1.8 s before the end, typically 70–85 % —, `hero-reveal` at 55 %, `walkthrough` at 80 %), then the button is pressed, the LED ring and hub ring light, and the fan spins up over 1.5 s; `orbit` and `core-orbit` have it on throughout.
- `palette` is compiled by the material kit (`assets/materials.js`): `material` (brick | siding | stucco | stone | timber | corrugated) becomes a seeded, world-mapped PBR cladding (albedo + normal + roughness, `assets/textures.js`) on the outward face of every exterior wall, tinted by `wall`; the inside of those walls and the partitions take `interior` (optional; default: `wall` lifted toward off-white when it is dark); `accent` becomes the accent role; and every prop is recoloured by role — fabric, fabric2, wood, cabinet, rug, accent — from seeded picks that harmonise with the accent, so two houses never share a scheme. An item with its own `color` keeps it; the Companion Core family is never themed; any other saturated colour on a themed prop or a site asset (porch deck, pool basin, gazebo) is pulled toward restraint, and so are a saturated `wall` and `roof` (a lemon wall builds cream, a terracotta roof builds fired clay; brick keeps more of its red). Pool and pond water on a site asset is the kit's `water()` (a deep teal). Level `floor` accepts oak | herringbone | terrazzo | phthalo-terrazzo | charcoal-terrazzo | marble | concrete | tile | deck: seeded PBR sets mapped in world metres (0.18 m oak boards, 0.6 m tiles), boards along the level's long axis. Roofs take `kit.roofMaterial(type, color)`: gable/hip → asphalt shingle, shed → standing seam, terracotta → clay tile, flat → membrane (a dark roof colour is pulled toward neutral charcoal; a light one keeps its colour); the lot `ground`, patios, driveways and steps take `kit.surface(name)`.
- Room items come from two catalogs: the page's AssetFactory builders and the prop registry (`assets/props/*.js`, one module per category — seating, tables, storage, beds, kitchen, bathroom, lighting, soft, plants, kids, office, outdoor, decor; ~150 props). Every type's measured footprint, height, surface flag and honoured params are in `content/house-catalog.json` (`scripts/build-prop-catalog.mts`); the validator accepts every registered type, the isometric twin draws registry props from their iso hints, and `scripts/prop-sheet.mts --module <category>` renders a review sheet. Wall-mounted props take `y` or their `mountY`; surface props sit on the desk/counter top.
- `entry` = the front-door opening (must match an opening in `levels[].openings`).
- Shot types (planner v1 by default; `shots[].planner: "v2"` or `?planner=v2` for the beat-timed planner — see Shots (S5)): `door-to-core` (establishing → approach entry → through door → an orbit round the Core, climbs stairs when hero is on an upper level), `orbit` (360° around the lot), `hero-reveal`, `walkthrough`, `core-orbit` (8 s: a slow product orbit round the Core alone, powered on). The builder derives waypoints from the spec; no hand-authored coordinates.
- **The Core orbit** (`assets/core-orbit.ts`) — door-to-core's last third and all of core-orbit. The builder probes a circle round the Core every 5° (radius 0.8 m for a shelf Core, 0.9 m on a desk, 0.2 m wider for core-orbit; eye 0.45 → 0.36 m above the Core's centre, lower under a low ceiling): an angle is free where the eye is 0.3 m off every wall, clear of every piece of furniture (0.22 m from one standing at eye height, like the monitor), under the ceiling, and a ray to the Core meets nothing. The orbit takes the free run through the Core's front and **ends on the front** — 15–45° past straight-on, so the last frames hold the button and LED ring at a three-quarter with the room (or the monitor) behind — core-orbit starts as far round as the run allows (up to 200°; the QA gate warns under 120°), and where nothing round the Core is free at any radius it falls back to a slow push-in on its front (`note` says so; the gate warns `core-orbit-fallback`). door-to-core's finale **starts where the walk arrives**: it weighs both directions round the Core and every start from the longest sweep (150°) down to 45° against the curve the walk will actually fly — above all the degrees its last 4 m and the push-in travel round the Core *against* the orbit while the Core is in sight (circling one way for the orbit to sweep back over the same arc is the one thing a long sweep must never cost), then how near it passes the Core's dark front and how hard it turns into the push-in and the orbit. A walk that arrives from one side gets a long sweep that carries on round; one that comes straight at the front gets 45–60° from the front to a three-quarter (60–125° across the 30 houses). Its walk ends at an **approach** 1.2–2 m out on the orbit's starting side, then pushes in along a line that keeps the Core in sight. A flight that lands beside the Core (lakecabin, modernhouse1, payorote) has carried the eye round it before the walk starts, and no orbit that ends on the front can undo that; the gate warns `orbit-swing-back` over 20° in the 2.5 s before the orbit, and `orbit-short` under 60°. Waypoints every ≤ 15° keep the Catmull-Rom circular; the look is locked on the Core, turned so it sits off-centre (door-to-core ~a quarter of the frame, core-orbit slightly) with the room it is heading into on the other side.
- **Timing** (`assets/shot-path.ts`): door-to-core and core-orbit pin each waypoint to a moment in the shot instead of spreading one ease over the path's arc length. door-to-core gives the orbit a third of its 12 s at 25–40°/s (about 4 s: 30 % of a 14 s shot), the push-in about a second, and the rest to the travel — the fly-in and the street at 2.2× and 1.5× the indoor pace, the doorway and the stairs a little under it — and moves from its first frame. The look turns against time, and no leg turns it faster than 110°/s at any moment: a leg that swings it round (the turn just inside a door, the U-turn at the foot of a switchback stair) is given the seconds that keep its *peak* rate — yaw and pitch together, as the monotone cubic through the waypoints' looks turns it — under 110°/s, and the straight legs make them up. A shot too short for all that runs its orbit at 40°/s, then raises the budget for every turning leg alike rather than leaving one a whip (the gate warns `look-whip` over 125°/s and fails it over 300°/s; `validate` refuses a door-to-core under 8 s). The Core's off-centre framing turns in over the push-in; core-orbit eases in and out of a steady turn. The timing is laid out for the duration the spec pins (`shots[]`), 12 s by default; a house whose walk is long (three storeys, or 40 m+ that would take the indoor pace past ~4 m/s — asymmetry, bgfamily, mirage, palms, palnknoll) pins door-to-core at 14 s, the most it should take. A monotone cubic through the (time, distance) knots keeps the speed smooth, and the look direction turns by heading and pitch between waypoints, so it never flips over the eye. Frames stay random access: `shot.frameAt(t, aspect)` is a pure function of t. Inside the house `door-to-core` **walks each storey** on a 0.25 m nav grid — through partition doorways, off the perimeter, and around anything taller than 1.1 m (wardrobes, bookshelves, ensuites, big plants) — from the door to the stair foot, landing to landing, and the last landing to the desk; a leg whose straight line is already clear stays straight. A flight is an obstacle on the storey it climbs from — the walk goes round it to its foot, never under it — and a flight whose first step is against a wall (nowhere to stand in line with it) is reached from the side of its first steps. The walk also keeps 0.2 m off the walls as built (the jambs, and an open door's leaf standing out into the room); where the furnished storey leaves no way through it eases the margins, then squeezes between the pieces of furniture at eye height, then keeps to walls and stairs alone, then squeezes past an open door standing across a corridor (0.16 m off its edge) — never the straight line through a partition. The finished curve is then checked every 3 cm against the walls, the stairs' treads and spine and the furniture, and a waypoint goes on the chord wherever the Catmull-Rom swings into one. So furniture never has to be arranged around the camera (the QA gate's `item-clip` warning names anything the eye still meets).
- Shots render the house **complete**: full-height walls and roofs on, whatever wall mode the editor is in. Once the eye passes under a ceiling the roofs fade out over the last 5 % of the approach and stay off; walls stay full, so every interior leg goes through doorways (the QA gate tests full walls — a `wall-clip` is an error). Offline frames go through GTAO (ambient occlusion) + SMAA; the editor's live view does not. Frames are deterministic — seeded procedural textures and AO noise, no wall-clock animation while a shot records — and `scripts/test-frame-hash.mts` proves it (two fresh contexts, pixel-compared) before goldens or a re-lay are trusted.
- Doors: a hinged leaf hangs on the wall's local −x jamb (the `from` end of an along-X partition, the `to` end of an along-Z one) and stands open 88° from shut (under `"defaults": 2` folded flat along the wall); openings wider than 1.1 m are cased openings with no leaf unless they name a `leaf` (Kit, S1); an entry `slider` parks both panels on its local +x half and the shot enters through the other.
- **Fixtures follow the room's name** (`assets/fixtures.ts`): the name picks a kind — service (garage, storage,
  laundry …), bath, bed (bed, suite, nursery, kids, guest …), kitchen, dining, living (living, lounge, family,
  den, media, sunroom, playroom, `bar` …), work (study, office, studio, library …), hall (hall, landing, entry,
  foyer …) — first match in that order, so "Library & Bar" is a living room. Every room of 1.2 m² or more gets
  recessed cans and may get the storey's warm light; living, bed, work and unnamed rooms of 8 m² or more, at
  least 2.6 m across under a 2.45 m ceiling, get a ceiling fan; islands and dining tables get pendants.
- **Keep an outdoor room under 1.2 m².** A room whose bounds lie outside the walls (a forecourt, a patio, a
  terrace named for the plan) is dressed like any other: at 1.2 m² or more it gets cans, a fan and a light
  hanging in the open air.
- **A hung fixture you place wins.** A `pendant-lamp`, `chandelier` or `ceiling-light` item keeps the automatic
  pendants off the table under it (within 1.3 m) and holds the fan away from it, so a room lit from its own
  pendants often gets no fan.
- `balustrades` rail a void's **drop** edges only — never the edge the stair arrives at (`stairs.at + dir × run`, run 3.36 m by default): that edge is the landing, and the validator rejects a rail across it.

## Pass-4 fields
<a id="pass-4-fields"></a>

Each stream of pass 4 documents the fields it adds in its own section here, as they land; the type of each is in
its fragment under `assets/spec/`, its lints in its plugin under `scripts/validate/`, and its fixtures in
`test/fixtures/houses/<stream>-*.json`. Every field is optional, and a look-changing default applies only under
`"defaults": 2`.

- **Types.** A field is declared in the stream's fragment. To widen one this document already defines (another
  enum value, a string that may also be an object — `lighting`, `hero.surface`, `lot.ground`, `levels[].stairs` as
  an array), redeclare it there, wider: `assets/spec/index.ts` lets a fragment's field replace the base's and fails
  the compile if it narrows; two fragments declaring one field (whatever the types) fail it too.
  `scripts/test-spec-types.mts` type-checks the 30 specs and every fixture against `HouseSpec`, so a fixture that
  uses a field no fragment declares fails the gate — in every part of the spec **but room items and site items**:
  they take builder-specific parameters (`style`, `chairs`, `n`, `form` …), so an undeclared one passes untyped; a
  field a fragment declares is typed and checked like any other, so declare yours. `scripts/test-spec-merge.mts`
  tests the merge rule itself (what a fragment may add, widen and not narrow).
- **Validation.** The validator's core never changes for a stream. Its plugin `extend`s a vocabulary the core checks
  against (a new roof type, floor, ground, hero surface, shot type) and `replaces` a core rule whose meaning it
  changes (`footprint-rects`, `partition-axis-aligned`, `stairs`, `raised-level`, `site-needs`, `shot-duration`); item and site types are read off the builders,
  so a new builder is a valid type at once. The contract is `scripts/validate/_types.mts`.

### Kit (S1)

Doors, palette restraint, per-level cladding, room fixtures, hero surfaces and lighting (`assets/spec/kit.ts`,
`scripts/validate/kit.mts` and `hero.mts`; the rules are `assets/kit-rules.ts`; fixtures
`test/fixtures/houses/s1-kit-*.json`; tests `scripts/test-kit.mts` (the rules, in Node), `scripts/test-kit-hero.mts` (the
Core on every hero surface), `scripts/test-kit-look.mts` (a white and a cobalt wall under day, golden and dusk, look 1
against look 2, read off the still) and `scripts/test-kit-program.mts` (`rooms[].program` and the fixtures)).

**Two fleet fixes** apply to every house: the curved monitor's pole stands behind its chassis and its screen is
matte (no pole through the UI, no ghosted room), and ceilings are a neutral white lit without the hour's ground
tint (no olive ceilings in daylight). Everything else below is a new field, or a look-changing default that
applies only under `"defaults": 2`.

```jsonc
"lighting": { "preset": "golden", "sunBearing": 225 },   // or "golden". sunBearing: the sun's compass bearing,
                                                          // degrees (0 north = −Z, 90 east, 180 south = the street)
"palette": {
  "door": "#7a5236",            // every hinged exterior leaf, the entry's too, unless the opening has its own color
  "restraint": 0.5,             // 0..1: how far wall / roof / interior are pulled toward restraint (1 = today's, the
                                // default; under defaults 2 the default is 0.4: a cobalt keeps most of its saturation)
  "keep": ["wall", "accent"],   // roles exempt from restraint: wall | trim | accent | roof | door | interior
                                // (a kept roof colour renders within ΔE 3 of itself: no charcoal pull either)
  "roofPull": false             // no roof pulled toward charcoal
},
"levels": [{ "material": "brick", "wallColor": "#9a4b3a",   // this storey's own cladding (one of the six palette kinds: stucco | siding | brick | stone | timber | corrugated), in its own colour
  "openings": [
    { "type": "door", "w": 1.6, "leaf": "french", "transom": 0.45, "frame": "#3b3530", "grid": "vertical",
      "lantern": true, "head": "arch", "swing": "in", "id": "front" },
    // leaf: single | glazed | double | french | none — a pair hinges on both jambs (a door over 1.1 m without a
    //   leaf is still a cased opening; under defaults 2 a 1.2–1.8 m PERIMETER door gets a pair)
    // id: the door's name in anchors.doors, for S5 ("front"; a pair's leaves are "front:L" and "front:R")
    // transom: metres of glass over the leaf. frame: the colour of window frames, a slider's frames, a transom.
    // grid: none | 2x2 | vertical | prairie muntins. lantern: a lantern each side (default: the entry and a garage).
    // head: flat | arch | segmental — the wall hole's top follows the arc (windows and doors), with an arched
    //   frame, fanlight and casing (S2 dresses it). swing: which way an open leaf parks.
    { "type": "garage", "w": 2.4, "color": "#4f6b52" },   // a garage's leaf, a slider's frame: `color` is honoured
  ],
  "partitions": [{ "from": [0, 0], "to": [0, 4], "door": 2, "doorColor": "#6a4e33", "doorStyle": "glazed", "doorSwing": "in",
                  "id": "study" }],   // a partition doorway over 1.1 m is a cased opening (an open-plan connection) whatever
                                      // the defaults; doorStyle "double" | "french" | "glazed" hangs leaves in it
  "rooms": [{ "name": "Den", "program": "den",                // S3's program decides the fixtures' room kind
    "fixtures": { "fan": false, "pendants": 2, "ceiling": "chandelier", "lamp": "globe" } }]
  // fixtures: fan true | false; pendants over the island / table (0 = none); ceiling flush (cans) | chandelier |
  //   none; lamp: the head every lamp in the room takes — drum | globe | cone | mushroom | tripod (the registry's floor,
  //   arc, tripod and table lamps and the halo lamp; a lamp with its own `color` keeps its shade)
}],
"hero": { "surface": "island", "surfaceColor": "#e8e4dc", "desk": { "style": "oak", "color": "#…", "w": 1.6 },
          "monitor": "flat", "chair": { "kind": "task", "pose": "turned" }, "shelfWidth": 1.2, "upstairs": true }
```

- **Hero surfaces.** `surface`: `desk` | `shelf` | `credenza` | `island` | `console` | `counter` | `none`, or any type
  in `assets/item-map.ts` SURFACE_TYPES (sideboard, dresser, writing-desk …). A piece backs onto the wall `rot` names,
  its front to the room; the Core stands on its real top (a ray cast finds it: the credenza's 0.605 m, the island's
  0.94 m, the console's 0.80 m, the counter's 0.90 m, past a turntable, a bowl, a faucet or a cooktop — on the island
  at the user-side end, ≥ 0.35 m from both at any rotation). Read the top off `anchors.hero.surfaceTop`, never the
  catalog's `height` of the piece: that is its full height (the counter run's 0.96 m includes its upstand, 60 mm above
  the worktop the Core stands on). The island's stone is `surfaceColor` or a seeded stone, and it brings no stools into a room that has
  its own. `anchors.hero.coreBox` is the device's exact box `[minX, minY, minZ, maxX, maxY, maxZ]` in metres (never its desk-glow decal); the scene QA's `hero-float`
  fails a Core more than 5 mm above its top. `desk` (style walnut | oak | white | black, `color`, `w`), `monitor`
  (curved | flat | none) and `chair` (`kind` task | lounge | none, `pose` turned | tucked — S5 reads the pose) dress a
  desk hero.
- **Page furniture parameters** (`assets/item-map.ts` ITEM_PARAMS, published for S3's catalog): sectional `w`,
  `handed`; dining-table `chairs` (0–8); kitchen-island `stools`; kitchen-cabinetry `h`, `counter`, `uppers` (shelf |
  solid | glass | none), `sink`, `cooktop`; media-credenza `turntable`; fireplace `style` (modern | mantel | stone |
  painted-brick | tv-breast). Under `defaults: 2` an item's `color` paints the part it names and the house's theme
  still colours the rest (without it, `color` switches theming off for the whole item, and a builder that ignores
  `color` ignores it — the validator's `kit:silent-param` says which).
- **Under `"defaults": 2`:** hinged leaves are derived, never teal — the trim on a modern dark-trimmed house, else a
  timber leaf (the kit's seeded wood, never near-black); partition leaves the casing white or the timber; a 1.2–1.8 m
  perimeter door gets a pair (a partition doorway that wide stays cased unless `doorStyle` asks for leaves); the entry swings in and every open leaf parks flat along its wall (within 10° of it); no automatic
  lanterns; a storey's `wallColor` clads it; ceiling fans in at most a quarter of the rooms that could take one — a fan can
  hang there: nothing authored hangs at its centre and the blades clear the walls — never a kitchen, a bath or the
  hero's room (a quarter of them rounded down; a house with fewer than four such rooms gets one with a seeded chance
  of n/4, so the fleet's share is a quarter and no small house is fanless by arithmetic; `rooms[].fixtures.fan: true`
  puts one where the photo shows it); each room's lamps take one of five heads, the rooms that have a lamp walking a seeded permutation
  so any five show all five; seeded wood, fabric and cabinet
  roles are lifted clear of black; a roof is pulled toward charcoal only when it has no colour of its own; each house
  gets its own seeded sun (18–70° either side of its entry), and the true-white look — the hour's light and sky
  bounce pulled toward white, a partial white balance, saturation held at 0.86 — so golden hour and dusk stop turning
  white walls pink and a blue wall grey. Use `palette.keep` for the one committed hue.
- **Anchors** (and `<id>.plan.json`'s `kit` key): `anchors.doors[]` — every hinged leaf in world terms (`hinge`,
  `closedYaw`, `openYaw`, `w`, `h`, `y0`, `swing`, `kind`: entry | exterior | interior), for S5 to open doors;
  `anchors.openings[]` — every perimeter opening (`centre`, `normal`, `w`, `h`, `sill`, `head`), for S2's dressing;
  `anchors.lighting`. **For other streams:** `kit.cladding({ kind, color })` (cached per pair), `kit.roofMaterial({
  finish, color })`, `kit.finish(kind, { color, pattern, scale, yBase })` — floors: oak, honey-oak, walnut, cherry,
  white-oak, grey-wash, herringbone, tile (pattern square | hex | checker), terracotta, pavers, concrete, carpet,
  marble, terrazzo; walls: paint, painted-brick, wallpaper (stripe | dot | grid | botanical), wainscot, board-and-batten,
  brick, stone, timber — and `roomKind(room)` (`assets/fixtures.ts`). `kit.cladding({ kind, color })` builds the
  colour EXACTLY as given (`kit.claddingFor` is the same function): a colour that would have come through the palette
  — a storey's `wallColor`, a volume's or a facade zone's — goes through `kit.wallColor(color, kind)` first, the house's
  wall rule (restraint, eased by `palette.restraint`, none under `keep: ['wall']`), so a zone painted cobalt renders as a
  storey painted cobalt does. `kit.roofMaterial(type, color)` decides "authored" from `roofs[].color` alone: a roof
  with a colour of its own that is not in `roofs[]` (a porch or bay roof) must call the object form,
  `kit.roofMaterial({ finish, color })`, or it takes the charcoal pull under defaults 2. `kit.finish` also takes
  `color2` (a checker's dark squares, a wallpaper's motif); an unknown kind is plain paint, flagged
  `material.userData.finishFallback`. `anchors.doors[].id` is the authored `openings[].id` / `partitions[].id` (a
  pair's leaves `<id>:L` / `<id>:R`, a repeated id `<id>~2`), else `<kind>:<n>` in build order.
- **Lints** (warnings): `kit:lighting-alias`, `kit:silent-param`, `kit:style`, `kit:wide-leaf`, `kit:fan-over-hero`,
  `kit:no-top`, `kit:duplicate-id`; the Core policy (`hero.mts`, §4.6): `hero:one-core`, `hero:storey`, `hero:wall` (a desk or shelf ≤
  0.45 m off its wall), `hero:doorway`, `hero:approach` (2 m clear in front), `hero:contrast` (charcoal on walnut). A
  malformed S1 field is an error.

### Architecture (S2)

Room finishes, per-volume cladding, roofs, opening dressing, plinths and stoops, porches, balconies, bays, built-ins,
partition styles, stairs and sections (`assets/spec/arch.ts`, `scripts/validate/arch.mts`, fixtures
`test/fixtures/houses/s2-arch-*.json`). Modules: `stairs.ts` (flights, THREE-free), `arch-plan.ts` (plan geometry shared by the
builder, the validator and the twins), `room-finish.ts`, `facade.ts`, `features.ts`, `roofs.ts`. **A house that uses none of
these fields builds exactly as before**; the two look-changing defaults (room floors, roofs that clip) apply under
`"defaults": 2` only.

**Stairs.** `levels[].stairs` is one flight (as always) or an array of them (a second stair, half-flights, a split level).
Every flight climbs from its own storey to `to`, so a half-storey up takes a half-flight with no extra field. `type`: `timber`,
`colonial`, `spiral`, `closed` (a boxed flight) and the turning `L` (quarter turn on a landing) and `U` (half turn, the second
flight running back beside the first); `L`/`U` take `style` (`timber`|`colonial`|`closed`), `turn` (`left`|`right`, seen
climbing), `landing` (depth along the first flight), `split` (L: the share of risers in the first flight), `gap` (U), `run2`.
Any flight takes `treadWood` (timber and closed flights, and the landing of a turning stair; a colonial flight keeps its mahogany
treads), `riser` (`open`|`closed`), `stringer` (colour), `handrailSide` and `autoVoid: true`, which cuts the void the climb needs in
the storey above from the flight itself (`voids[]` need not list it): from the near edge of the first tread whose headroom is under
2 m, the flight's width plus 5 cm a side, to the top — trimmed to the storey's outline (a stair built against a wall keeps a hole that
stops at the wall's face), and a flight at 45° gets a staircase-edged hole, not its bounding box. A hole on the edge of a slab, or past
it, corrupts the slab, so every hole the builder cuts is clipped; the validator warns (`void-outline`) about a `voids[]` entry that
reaches the outline.

**Room finishes.** `rooms[].floor` is a kind or `{ kind, color?, pattern?, scale?, run? }` (`oak`, `honey-oak`, `walnut`,
`herringbone`, `tile`, `hex-tile`, `checker`, `terracotta`, `stone`, `carpet`, `marble`, `terrazzo`, `deck` …); it is an overlay on
the storey's slab, clipped to the room's `bounds`. `rooms[].walls` is `{ kind?, color?, h?, lower?, feature? }`: liners on the
inner faces of the walls round the room (`paint`, `plaster`, `painted-brick`, `brick`, `stone`, `wainscot`, `board-and-batten`,
`shiplap`, `timber`, `tile` …), tagged role `finish` so the cutaway lifts them with the wall; `feature` gives one side (or one
`partitions[]` index) its own finish. `rooms[].ceiling` is always an object — `{ kind: 'flat'|'timber'|'beams'|'vault'|'tray'|'double',
color?, rise?, ridge?, rail? }`; `double` makes the room double height (the storey above opens over it and rails the gallery).
`rooms[].floorOffset` raises (+) a platform over the room's bounds, or sinks (−) a pit: the storey's slab is opened over the pit and the
pit has its own floor and sides (it needs a storey under it and its floor above grade — else the room stays flat, and the validator says
so). A room's items keep the storey's floor height: give the items in a raised or sunken room `y: floorOffset`. A room's floor is laid
over its bounds inside the footprint, **less every hole of the slab** (`voids`, a flight's `autoVoid`, the room below when it is double
height, a pit) — a floor never seals a stairwell. Under `defaults: 2` a room with no floor gets a seeded one for its program (kitchen
and bath tile, living rooms warm wood, bedrooms wood or carpet) that its neighbours do not share.

**Sections.** `footprint[i].h` gives a volume its own wall height (a tower, a low wing); `footprint[i].material` / `.color` its own
cladding (these, the facade zones and `gableCladding` take nine kinds — the six palette kinds plus `board-and-batten`, `concrete` and
`shingle`; a whole storey's `levels[].material` is the palette six, so use a volume or a facade zone for the other three). `levels[].knee` stops the perimeter walls at a knee height (the roof's underside is the ceiling above). `levels[].split:
true` marks a split-level storey: where it stands beside another storey (a half-level up or down) the storey listed first builds
the shared wall over its own height and this one only the rest; bands with rooms on both sides are party walls (paint both faces).
`levels[].plinth` is `{ h?, material?, color?, proud? }`: a base course round the walls, and — on a storey above grade with nothing
under it — the foundation from grade to its floor. `entry.stoop` is `{ depth?, w?, steps?, rail?, material?, color? }`: a landing at
the door and steps to grade. In a perimeter edge with two same-side edges that both contain an opening's `at`, `openings[].edgeZ`
names the edge (its z for an S/N wall, its x for an E/W one).

**Facade.** `facade` is `[{ level?, side?, from?, to?, yFrom?, yTo?, rect?, material, color? }]` (cladding zones laid on the outer
faces, cut round the openings) or `{ zones, bands }`, where `bands: [{ y, h?, material?, color?, proud?, sides? }]` are string
courses at heights over grade. Opening dressing, on `openings[]` (built in `facade.ts`): `shutters` (`{ color?, style:
'panel'|'louvre'|'board' }`), `box` (a window box: `plants: 'flowers'|'trailing'|'herbs'`), `head` (`arch`, `segmental`,
`pediment`, `keystone`, `crown` — trim over the head; the hole stays rectangular), `surround` (`{ kind: 'casing'|'stone'|
'brick-soldier'|'box-reveal', color?, w?, depth?, sill? }`), `blinds`, and `canopy` (`{ kind: 'flat'|'lattice'|'awning'|'gable'|
'shed', depth?, color?, extend?, supports? }`; it fades with the roofs).

**Roofs.** New on `roofs[]` (all optional; a roof without them builds as before): `finish` (`shingle`, `seam`, `tile`, `slate`, `shake`,
`membrane` — the roofing, independent of the form), `trim` (fascia, rake and coping colour), `soffit`, `gutters` (false for none; under
`defaults: 2` none on clay tile), `gableWindow` (false, `window`, `louvre`; the automatic apex window is off under `defaults: 2`
unless asked for), `ends` (per side: `gable`, `hip`, `open` — the roof and rake with no end wall — or `abut`, the end running into a
taller wall), `gableGlass` (sides glazed instead of clad), `gableCladding`, `pitches` (per face, degrees — a saltbox's steep short
face and long shallow one), `sweep` (faces that run on down over a lower wing with no raised heel: a catslide), `skylights`,
`planted` (`meadow` | `sedum` — a green roof with seeded planting and trailing growth over the eaves), `clip` (cut the roof where a
taller storey rises through it — pitched deck and flat slab alike — and trim eaves against parapets; on under `defaults: 2`; the storey
it cuts round then needs a roof of its own, or it stands open to the sky: `roof-open-sky`), `dormers[].style` (`gable`, `shed`,
`flat`, `eyebrow`, `glazed`) and `.side`, `type: 'pent'` (a shed along a wall), and a `chimney` of `{ at, w, d, h, material:
'brick'|'stone'|'stucco'|'metal', color, cap: 'stone'|'pots'|'metal' }` on any roof, flat ones included (`h` is how far it stands over
the highest roof point it rises through).

**Features.** `features: []` holds what stands on or beside the walls — each has a `type` and, where it belongs to a storey, `level`
(default the entry's):
- `porch` — `{ side, from, to, depth, roof: 'shed'|'hip'|'gable'|'flat'|'none', pitch?, roofColor?, finish?, posts: { spacing|n, style:
  'square'|'round'|'turned'|'tapered'|'steel', size, color }, rail, floorY, steps, ceiling }`. The roof is built by `roofs.ts` (eaves,
  fascia, gutters) and abuts the house wall; posts are kept out of every doorway on the wall and off the steps. `floorY` is the deck's top
  (default the storey's y, or 0.12 m at grade). The roof leans on the wall just under the eave and falls to the posts, keeping 2.3 m over
  the deck at its eave where it can: a shallower pitch (5° at least) buys that clearance, and a gable's ridge is held to the height a shed
  would lean on the wall at — so on a single storey with a raised deck the roof comes out low (the validator says `porch-pitch` when the
  built pitch is not the one asked, `porch-clearance` under 2 m of post).
- `balcony` / `terrace` / `loggia` — `{ level, side, from, to, depth }` or `{ level, rect }`, `rail: 'glass'|'metal'|'timber'|'parapet'|
  'none'`, `floorColor` (the deck's colour; a porch takes it too). A balcony is a slab out of the wall; a terrace is a deck on the roof below (it fades with the roofs); a loggia is a recessed
  floored, railed outdoor room (`posts` along its open side) under the storey above, or — with no storey above — under the eave of its
  own storey (posts run to the wall top), so a loggia under a gable end needs no second storey.
- `bay` — `{ level, side, at, w, depth, form: 'box'|'canted', roof: 'hip'|'shed'|'flat'|'gable'|'none', skirt: 'grade'|'oriel'|'none', sill,
  head, h }`: the host wall is opened over the bay, which has a floor, glazed walls (canted at 45° for `canted`), a ceiling and its own
  roof. It stands on a stone skirt to grade on the lowest storey; higher up (`oriel`) on a 0.3 m sill course in the wall's cladding, so
  a bay over a bay stands on the lower one's top when that has `roof: 'none'` (else the lower roof runs into the upper wall: `feature-wall`).
  The bay must lie on one wall of its storey (`feature-wall` error past its ends).
- `fireplace` — `{ level, at, rot, style: 'modern'|'mantel'|'stone'|'painted-brick'|'tv-breast', w, chimney, stack: 'outside'|'inside' }`:
  a breast and hearth in the room and the stack it needs — outside an exterior wall it backs onto (shouldered, from grade), or up
  through the storeys above — always out through the roof over it. A `fireplace` room item with `chimney: true` (or a chimney
  object) gets the stack alone.
- `builtin` — `{ level, kind: 'bookcase-wall'|'niche'|'wine-wall'|'window-seat'|'media-wall', from, to, face, h, d, color }`.

**Partitions.** `partitions[].style` is `solid` (today), `half` (a 1.1 m wall with a cap), `posts`, `slats`, `glass`, `arch` (a cased
archway, no leaf) or `bookcase`; `partitions[].doors: [{ at, w?, h? }]` gives a partition more than one doorway (`door`/`doorW` still
work, alongside). Under `defaults: 2` a top storey's solid partitions meet the ceiling instead of stopping 8 cm short.

**What the builder exports.** `anchors.features` (also `anchors.arch.features`), `anchors.stairs[]` (each with its plan: `flights`,
`landings`, `outline`, `path`, `voidRects`, `stepOff`), and `anchors.arch.rooms[].finish`; `<id>.plan.json`'s `arch` key carries them
(`assets/plan-export/arch.ts`) for the floor-plan and isometric twins, which draw the porches, bays, decks, turning flights,
room floors, stoop and towers from it (`pnpm run test:twins`).

**Lints** (`scripts/validate/arch.mts`; warnings until the layout pass): `stair-void` (the storey above is solid where a flight needs
its headroom), `stair-step-off` (0.3 m past the top step is a void, outside the slab, or a wall), `stair-route` (an L/U stair on the way to
the Core's storey, which the v1 shot planner flies straight through), `void-outline` (a `voids[]` rect reaches the slab's outline),
`roof-storey` (a roof slices through a taller storey's walls — pitched or flat), `roof-open-sky` (a clipped roof leaves that storey with
none), `roof-y` (its eave meets no storey top under it), `chimney-hearth`, `porch-door` (posts leave more than 4.5 m unsupported),
`porch-pitch`, `porch-clearance`, `feature-opening` (a porch roof — its true top — across an upper window or its box, a bay over a door,
a balcony's deck over a window), `feature-wall` (a porch or bay past the end of its wall, stacked bays), `room-feature` (a
`walls.feature` side with no wall to line, a sunken room with nothing under it). Errors: an unknown kind or a value out of range in
any S2 field (porch `roof`/`posts.style`/`rail.style`/`pitch`/`steps.at`, bay `h`/`sill`/`head`, stair `w`/`run`/`landing`, colours), a
flight with no `at`, a `to` that is not a higher storey, an `edgeZ` that names no edge, and a feature that stands on nothing (a porch, bay or
balcony with no wall holding it, a fireplace or built-in outside its storey's footprint, a terrace or loggia rect nowhere near the house).

### Rooms & composition (S3)

Room programs, the composer that furnishes them, the new furniture, and the layout lints (`assets/spec/compose.ts`;
`scripts/validate/compose.mts` checks the fields, `scripts/validate/layout.mts` holds the lints and runs under
`pnpm run validate --layout`). Proved on `test/fixtures/houses/s3-compose-*.json`.

**Opt-in.** A room without `program` is never composed: it renders its authored `items` exactly, as before. A room with
one is furnished by `assets/room-composer.ts` (THREE-free, so it runs in Node too), and its authored items are **pins**,
kept exactly, that the composer arranges round. **A pin that fills a role counts as filling it**: a room with a pinned sofa
is given no lounge, one with a pinned toilet no second toilet, one with a pinned bed no bed, a pinned dining table no table,
a pinned run, range or fridge no fitted kitchen, a pinned tub or shower no bathing (the rest of the program — bookcases,
lamps, plants, a rug — still fills in round them). To swap a real room's hand-typed filler for a composition, delete the
filler first (`compose-house.mts --infer --replace` does it on a copy, and keeps the hearth and the TV). Every field below is
optional.

```jsonc
{
  "styleKey": "farmhouse",    // the house's furniture style: modern | farmhouse | cottage | mediterranean | mid-century |
                              // industrial | scandi | tropical | craftsman. Default: read off the free-text `style`
                              // ("Mid-century desert villa" → mid-century), else modern
  "levels": [ { "rooms": [ {
    "no": "01", "name": "Living Room", "bounds": { … },
    "program": "living",      // THE room-type field (26 values, below). S1's fixtures dress the room by it
    "focus": { "type": "fireplace", "wall": "W", "at": 1.5 },
                              // what the room is arranged round: fireplace | tv | window | art | view (a lounge's seating
                              // faces it); bed (a bedroom's headboard goes on `wall`, at `at` along it); island (a kitchen
                              // gets an island). wall N|S|E|W (N = the room's min-z edge, S max-z, W min-x, E max-x); at =
                              // a number along that wall, or a point [x, z]. Default: a fireplace or TV already pinned in
                              // the room, else the longest solid wall, else the glass for a view
    "density": 0.65,          // 0 the program's essentials … 1 every optional piece that fits; default 0.5
    "style": "cottage",       // this room's style (default styleKey)
    "palette": { "fabric": "#d8d2c4", "wood": "#5a4636", "accent": "#7a8f86" },
                              // the room's own colours. Bedrooms get a seeded one from their style when they have none,
                              // distinct from the house's other bedrooms
    "seed": "b",              // re-rolls the composition: the same program, another arrangement
    "kitchen": { "layout": "L", "island": true, "peninsula": false, "sinkWall": "N", "windowOverSink": true,
                 "top": "marble", "glassUppers": true, "color": "#e9e6df" },
                              // L | U | galley | single; island true or {w, d}; a peninsula (a bar off the open end of a
                              // run, else an island); worktop stone | marble | butcher | concrete | quartz | terrazzo;
                              // glass-fronted wall cabinets; cabinet colour
    "bath": { "tub": "free", "shower": true, "vanity": "double" },
                              // tub free (a clawfoot or a soaking tub by style) | built-in | none; shower true or {w, d};
                              // vanity single | double | pedestal
    "lock": true,             // composition baked into `items` and hand-tuned: do not compose again
    "items": [ … ]            // pins
  } ] } ]
}
```

**Programs.** `living kitchen dining kitchen-dining bed-primary bed-kid bed-guest nursery bath ensuite powder study
library den media playroom sunroom greenhouse foyer hall laundry studio bar gym garage outdoor`.

| Program | What the composer places | Clearances it keeps |
|---|---|---|
| living, den, media | a lounge round the focus: sofa (or an L, a modular or, in a big room, a U sectional) 1.2–3.4 m from the focus wall, coffee table, a rug under the front legs, 1–2 armchairs at 30–45°, side tables with lamps, art over the sofa; bookcase, floor lamp, plants; a piano in a big living room. An open plan with no wall worth a hearth or a screen faces the glass or the open floor beyond; a room named "Living & Dining" (22 m² or more) also gets its table in the biggest floor the lounge left | sofa to table 0.45 m, lanes 0.9 m |
| kitchen | single, galley, L or U runs with a sink under a window, the dishwasher beside it, a range and a fridge at a run end, wall cabinets and a hood, a corner unit, an island or peninsula with stools, counter things. A room with no wall to put them on (a glass wall, an open plan) gets a free-standing line across the floor, 0.9 m to walk behind it; a kitchenette that cannot hold all three gives up the fridge, not the kitchen. In a kitchen-dining room the table goes in the biggest floor the run leaves, before the island | aisles 1.05 m |
| dining | table on a chosen axis with chairs to seat count, a rug, a pendant or chandelier, a sideboard | 0.6 m behind every chair |
| bed-* | headboard on the wall facing or beside the door, nightstands with lamps, dresser, bench, wardrobe, art over the bed, a rug under the lower two-thirds; a kid's room gets a single, bunk or loft bed, toy storage, a desk, a play rug and a story picture | 0.6 m each side of the bed |
| nursery | crib, changing table, glider, dresser, toys, a patterned rug, a moon picture | as bed-* |
| bath, ensuite, powder | vanity, toilet 0.2 m from its side, tub (clawfoot or soaking, or built-in) or shower (a tub that will not stand gives way to a shower: no bath is left with nothing to wash in), towel rail or ladder, mat, mirror | 0.6 m in front of each fixture |
| study, library, studio | desk with chair and lamp against a wall, runs of tall bookcases, a reading corner, a rug | — |
| foyer, hall | console or bench, a runner, a plant | 1.2 m lane |
| sunroom, greenhouse | plants in clusters, a potting bench, a reading corner | — |
| laundry, garage, gym, bar, outdoor | the working set for each | — |

**Determinism.** Each room is seeded by `mulberry32(fnv1a("<spec id>:<room no>:compose"))` (`:<room seed>` appended when it
has one): fixed candidate grids (0.1 m), stable sorts, mm rounding, 400 fixed annealing steps, no clock and no
`Math.random`. Two runs, in Node or in the page, give the same items. **A house picks its own**: for each role (lamp,
dresser, rug …) it prefers a type, drawn by its style, and reaches for the others only when the room rules that one out, so
one house reads as one scheme and the next house reaches for another. A group that cannot be placed is made again with
other pieces, then smaller and on looser terms (its aisle may cross an obstacle), so a small room still gets its lounge, its
table, its sink; what a room is too small for is dropped, never squeezed through a wall. A room that could not stand one of
its essentials (a lounge, a bed, a toilet, the bathing, a kitchen, a dining table…) is composed again with that piece first,
and a tight wet room's fixtures are then solved together; if it still cannot, the result names what is `missing` and the
`missing-anchor` lint says so — an unfurnished room is never passed as furnished. **Sizes are the built geometry's own**:
`assets/props/measured.ts` (written by `pnpm run catalog` with the catalog) holds every type's measured box and how it grows
with `w`, `d`, `l`, `r` and `h` — a bed's headboard is wider than its `w`, a plant's leaves stand off its pot — and
`scripts/test-compose-parity.mts` builds every composed item in the page and fails when its box is not the composer's.
The composition is cached per spec *content*, so an edit in place is a new composition; house-wide state (a house's picks,
its bedroom palettes) is shared between its rooms, so adding furniture to one room can re-roll another unless it is `lock`ed.

**Output.** The composer's items carry `src: "compose@1"`. `node --experimental-strip-types scripts/compose-house.mts
--house <id | path> [--infer [--replace]] [--rooms a,b] [--style k] [--seed s] [--density n] [--write [--out f]] [--lint]`
reports a house's composition, and `--write` bakes it into the room's `items` and sets `lock: true`: the room is then
hand-tunable, and `--rebake` redoes it (an item without `src` is yours and stays). `--infer` reads a program off a
room's name (the dry run), `--replace` drops the hand-typed filler first (a copy to look at) but keeps the hearth and the
wall TV the composer arranges round (`--keep a,b` names other types to keep, `--keep none` drops even those).

**Helpers** (`assets/room-composer.ts`). `lanes(spec, level, room)` returns the room's door-to-door circulation corridors
(0.9 m, plan rectangles: S5's soft nav bias). `snapWallMount(item, geo)` moves a wall-mounted item authored inside the
wall out to its face, and `stackOnSurface(item, items)` puts a surface item (a lamp, a vase) on the top of what stands under
it instead of the desk default (0.77 m); the builder applies both to authored items under `"defaults": 2`, and the lints
report them either way.

**The dress phase** (`assets/room-dress.ts`, plan 5.6). A second, additive pass over a frozen layout: it reads a room's final items as pins and adds
`src: "dress@1"` items — the small goods of `assets/props/dress-*.ts`, lamps, towels, a door mat — to the surfaces the layout made. It never moves a piece
(`composeHouse` is bit-identical with or without it: a baked `dress@1` item is no pin and no usage of the composer) and it is **opt-in**:

| | |
|---|---|
| `"dress": { "level": 0..1, "off": ["lamp"] }` on a room | the build dresses the room live: level 0 is the program's never-bare floor and its lamp (tier 1), 0.3 and up adds tier 2, 0.6 tier 3, all inside a budget `base x (0.55 + 0.45 x area / ref) x (0.6 + 0.8 x level)`; `off` skips slots by id (`assets/dress-recipes.ts`) |
| `"dress": false` | never dressed, not even by the bake tool |
| no `dress` field | not dressed by the build: **every shipped house builds as it always did** (a `dress@1` item already in `items` builds either way) |
| `?dress=0` on the page | leaves every dress item out, baked or live: the exact BEFORE of a dressed house (`scripts/test-dress-neutral.mts` proves it object for object and frame for frame) |
| `compose-house.mts --house <id> --dress [--level n] [--rooms a,b] --write` | bakes the live phase's items into `items` (idempotent: every `dress@1` item is stripped first); `--undress` strips them. Dress items build last in their room, so a baked room builds what the live phase builds |

A **host** (`assets/room-dress-hosts.ts`) is a catalog type with a top the page builds as declared: the height, and the flat clear *rects* of it (so a dress
footprint fitting its host is the contract; `scripts/test-dress-hosts.mts` samples every rect at 2 cm and fails past 1 cm). Coffee, side and dining tables,
dressers, desks, counters, the island, a range, the strip between a double vanity's basins, a toilet tank and a machine's top are hosts. A console's bowl and a
sideboard's vases stand at seeded spots the phase cannot know, so those types (and a nightstand, a media credenza, a chest, the single vanity and the tubs) are
**not** hosts (`DROPPED`, each with its reason). A small good is packed into the host's free area (the rects less everything on it, less a margin) at an anchor
(centre, a quarter from an end, the back edge, a corner), never past 60 % cover; the floor (a floor lamp, a door mat) and the walls (a towel ring, a robe hook, a roll
holder) go through the composer's own `place`, so lanes, door swings, windows and stair run-ins hold. Nothing the phase places stands in the way of the review rig's corner
cameras (`scripts/review/cameras.mts` `cornerCam`, the eye 1.5 m up, inset 0.55 m or a fifth of the shorter side, at all four corners): no piece within 0.3 m of an eye,
and no floor piece taller than 0.8 m in a 0.5 m square at a room corner (a shorter piece may stand there); a floor lamp the keep-out leaves no floor for becomes a small
lamp on a side table in a corner. A café curtain hangs on the lower half of a kitchen window only (hem 3 cm over the sill, rod at most sill + 0.55 x the window's height,
clear of the 1.45-1.55 m eye line wherever the window leaves room), in the house's pale cloth. The curtain is planned before the first slot runs (`assets/dress-curtains.ts`),
and nothing may pass through its cloth: it is lifted over what stands low under the window (a counter higher than the sill, at most 0.22 m), parted into two panels round what
stands narrow (the sink's tap, a lamp), left off where cabinets or a pantry cover the window, and every dress item keeps out of the volume it takes (a lamp or a canister that
would reach the cloth moves along the counter). Two windows side by side each get a curtain whose box ends 1.25 cm from the middle of the wall between them (2.5 cm
between the two rods and finials), and a curtain keeps 2.5 cm from a blind or curtain the layout hung and never runs past the end of its wall.

| Program | Recipe (tier 1 = always; the lamp only where the layout placed none) |
|---|---|
| living, den, media, sunroom | a tray vignette or a centrepiece on the coffee table; a book, coaster and glass on a side table; **lamp**: a table lamp on a side table or console, else a floor lamp in a corner (a wall when no corner) |
| bed-primary, bed-guest, bed-kid, nursery | **lamp**: one on each bedside (a pair in the primary) or the dresser, else a floor lamp; a book, glass and candle on a bedside; a tray with scent bottles, a box and a frame on a dresser |
| kitchen, kitchen-dining | a pot on the range; a small **lamp** at the end of a run (a mushroom, globe or tripod lamp); a café curtain on the lower half of a bare window (sill 0.6 m or more); clusters on the counters, those by the range first (boards, canisters, a bread bin, a crock, a tea towel, oils, a kettle), a dish rack beside the basin; a bowl, a carafe and plates on the island; an eat-in table laid |
| dining | the table laid: a centrepiece, candles, a place for each chair (as many as keep 40 % of the top free); a floor **lamp** |
| bath, ensuite, powder | soap, a cup and a dish on the strip between a double vanity's basins; a tissue box and a candle on the tank; a towel ring (when there is no rail or ladder), a robe hook, a roll holder |
| hall, foyer | at the entry: a door mat, an umbrella stand, a shoe row; a console arrangement on a demilune console; a **lamp**; a leaning mirror; a floor plant |
| study, library, studio | a **desk lamp** on the desk; a book and a glass |
| laundry | folded towels on the dryer, a tea towel on the washer, a cluster on a counter |
| garage, gym, greenhouse, outdoor | nothing: no dress type exists for them yet (BAKE's types) |

The never-bare rule of a program (`bareViolation`): a bath, ensuite or powder has 3 dress items and a towel object, a dining room a set table, a kitchen 4 counter
clusters, a hall of 8 m2 or more 3 dress items. The layout lints add `dress-floating` (not on a registry host, over its edge, not at its top), `dress-overlap` (a dress item under 1.5 cm from another item on its surface, authored, composed or dressed; the packer keeps 2 cm plus how far each piece's built mesh reaches past its measured box, `REACH`),
`dress-lane` and `dress-bare`. Every choice draws from `mulberry32(fnv1a("<spec id>:<room>:dress:<slot>:<n>"))`, and the page seeds a dress item from `kit.itemRng("dress:" + dk)`:
a stream keyed by the item alone that never takes a `propIndex`, so adding, moving or removing a dress item moves no other prop's colour or jitter.

**New furniture** (`content/house-catalog.json` lists every type's measured footprint, height, draw calls (`meshes`),
honoured params and `place`ment: what it backs onto, the clear floor it needs, what it faces, its programs and styles).

| Family | Types (params beyond `w` `d` `color`) |
|---|---|
| Sofas | `sofa` `slipcover-sofa` `chesterfield-sofa` `mid-century-sofa` `tuxedo-sofa` (`w`, `d`); `loveseat` |
| Sectionals, by size | `modular-sectional` (compact, low), `l-sectional` (standard), `u-sectional` (big room): `w` the run, `l` the chaise's reach, `hand` `"left"` \| `"right"` — the chaise's side, as you sit facing +z (not on the U) |
| Armchairs, chairs | `mission-armchair` `barrel-chair` `slipper-chair` `lounge-chair` `rattan-armchair` `nursery-glider`; `windsor-chair` `bentwood-chair` `ladderback-chair` `shell-chair`; stools `wood-stool` `saddle-stool` |
| Tables | dining `trestle-table` `glass-dining-table` `oval-dining-table` (`w`, `d`), `pedestal-dining-table` (`r`); `round-coffee-table` (`r`) `trunk-coffee-table`; side `drum-table` `c-table`; consoles `demilune-console` `sofa-table` |
| Beds, storage | `sleigh-bed` `upholstered-bed` `house-bed` (`quilt` a rug pattern); `armoire` `chest-of-drawers` `lowboy-dresser` `drum-nightstand` `bedside-cabinet` `bedside-table` `bar-cart` `workbench` `potting-bench` |
| Bath | `clawfoot-tub` `soaking-tub` (freestanding), `pedestal-sink`, `double-vanity`, `towel-ladder`, `bath-rug` `bath-runner` |
| Kitchen | `corner-run` (`hand`), worktop `top` on `counter-run` `sink-run` `breakfast-bar` `corner-run`: `stone` (default) `marble` `butcher` `concrete` `quartz` `terrazzo`; `glass: true` on `upper-cabinets`; `toaster` `kettle` |
| Music, gym, kids | `grand-piano` `upright-piano`; `exercise-bike` `weight-bench` `yoga-mat`; `changing-table` `kids-desk` |
| Rugs | `patterned-rug` (`pattern`: `solid border stripe check diamond kilim medallion dots abstract play shag jute flatweave hide`; `shape: "round"`); `shag-rug` `flatweave-rug` `hide-rug` `play-rug` |
| Art | `wall-art` and `framed-print` `canvas-art` `triptych` (`motif`: `abstract geometric line landscape botanical seascape sunset sunburst map animal story-moon story-whale story-balloon mountains floral arches colourfield skyline lemons`; `frame` colour), `gallery-wall` (`motifs`), `plate-set`, `arch-mirror` |
| Lamps, decor | table lamps `ginger-lamp` `column-lamp` `globe-lamp` `mushroom-lamp` `tripod-table-lamp`; `ceramic-bowl` `sculpture` `candelabra` `flower-jug` `terrarium` `table-clock` `desk-globe` |
| Plants | `bird-of-paradise` `rubber-plant` `zz-plant` `dracaena` `peace-lily` `aloe-pot` `ponytail-palm` `jade-plant` `calathea` |

**Layout lints** (`pnpm run validate --layout`, and `scripts/test-room-composer.mts` prints the fleet's counts): warnings
until the layout pass promotes them. `overlap`, `wall-pierce`, `outside-room`, `door-swing` (a leaf's arc), `lane` (0.8 m from
every way in to every other and to the middle), `core-walk` (the walk from the entry to the Core narrows under 1.2 m,
doorways excepted), `stair-run-in` (under 1.6 m clear at a flight's foot or head), `facing` (seating that faces a wall or
turns its back on the focus), `silent-param`, `mount-in-wall`, `surface-height`, `repetition` (one type in more than two
rooms of a storey or more than five in a house; rugs, lamps, decor, fitted units and chairs excepted), `kitchen-backwards`,
`foyer` (the entry opens onto a wall closer than 2.5 m, or sees no feature within 6 m), `empty-half` (a room of 12 m² or more
with every piece in one half), `missing-anchor` (a room with a `program` that lacks what the program cannot do without: seating,
a bed, a toilet, sink and range, a dining table and its chairs, bathing, bookcases, a desk, a washer and dryer — the table
`ANCHORS` in `assets/layout-lint.ts`), `surface-kind` (an item standing on another its placement does not allow). `<id>.plan.json` carries a `compose` key — each composed room's level, name, program, style
and items — for the isometric twin and `fleet-audit --built`.

**Fixtures**: `s3-compose-house` (six program rooms with pins: a living room round a fireplace, an L kitchen with island,
a library round the Core, a dining room, a primary bedroom, a bath with a freestanding tub, a kid's room, a nursery, a
study), `s3-compose-kitchens` (every layout and worktop, and a room whose south wall is glass), `s3-compose-baths` (every tub, vanity and shower),
`s3-compose-styles` (one living room in each of the nine styles, and one style in two seeds — the second a living-dining room), `s3-compose-props` (every new
sofa, sectional, table, rug pattern and art motif, authored by hand), `s3-compose-tidy` (`defaults: 2`: a wall mount authored inside
its wall, a lamp at the desk default, `focus.bed` and `focus.island`).

### Site (S4)

Planting generators, curves, hardscape, water, fences, structures, the lot and its world (`assets/spec/site.ts`,
`scripts/validate/site.mts`, `assets/scene-qa/site.ts`; fixtures `test/fixtures/houses/s4-site-*.json`; metrics
`scripts/test-site.mts`, `scripts/test-site-species.mts` (the species' silhouettes and triangle costs held to the geometry), `scripts/test-site-iso.mts`, which draws every fixture through the isometric twin, and `scripts/test-site-fuzz.mts`, which builds seeded random lots). Every field is optional: a lot that uses none builds exactly as before.

**The planting generator** — `{ "type": "planting", "kind", "along" | "poly" | "at", "depth", "layers", "mix",
"density", "bloom", "side", "edge", "mulch", "seed" }` lays out beds and plants them back to front: a back layer
1.2–2 m, a mid layer 0.6–1 m and groundcover about 0.3 m, each placed by Poisson-disk sampling (no two plants on a
grid, none on top of another), the species in drifts along the bed. The layers are rows, not tokens: each layer of a mix
holds species of its own height (a back row stands 1.1 m and up), a bed against a wall divides its depth from a crown
off the wall out, and a bed holds at least one plant over 1.1 m for every 1.5 m of its run and one to 1.1 m for every
1.2 m. What still shows mulch is then filled from the mix's fill palette — a few low, leafy species, in sweeps — until the
bed is as bare as its mix says (`bare`: 5 % of the bed; a formal bed 30 %, a desert bed 35 %; `density` below 1 thins it:
0.3 leaves it two-thirds bare, above 1 a bed is as full as the mix allows). "Bare" is measured on what is drawn: each
species' top-down silhouette (foliage, blooms and stems, measured on its geometry: `assets/site-species-masks.ts`,
regenerated by `scripts/measure-species.mts --write`) hides the mulch under it, not the disc of its crown — a grass
tuft hides 5 % of its disc, a mound 74 %. Plants shrink to the room they have before a wall and never reach into the
house; nothing is planted past the lot line (plants shrink to it, beds are cut at it: the sidewalk starts there).

| `kind` | lays out | `along` |
|---|---|---|
| `foundation` | a band along the facade, rounded at its ends, broken at doors, paths and porches; the back row a crown off the wall | `facade:S`, `facade:S,E`, `facade:all` |
| `walk` | beds both sides of a path, meeting its edge with no lawn between | `path:<site index or id>` (or a polyline and `w`) |
| `border` | a band on one `side` (`left` of travel by default) of a line — a fence, a lot line | a polyline |
| `terrace` | a band inside a terrace's edge, trailing plants at the coping | `terrace:<index or id>` (or a polyline and `side`) |
| `meadow` | grasses and perennials over a `poly` (or `at`, `r`), heights in drifts, on a meadow floor, no mulch | — |
| `grove` | trees spaced by their crowns (`species`, `spread`, `n`) with an understorey and a woodland floor | — |

`depth` is the band's depth in metres (foundation 1.8, border 1.7, walk 1.0, terrace 1.1); `layers` 1–3 (3);
`density` multiplies the mix's own; `bloom` pins the flower colours (`["#hex", …]`); `mulch` is `none` or a colour;
`edge` is the beds' edging (below); `seed` gives another layout of the same beds (the outline has its own stream: another
`seed` plants them differently). `mix` — named, or else the one the lot implies (`lot.context`: `desert` → desert,
`forest` → woodland, `city` → modern, `hillside` → mediterranean, `rural` → cottage, `waterfront` and `lot.water` →
woodland, tropical for the sea, modern for a canal; a `desert` or `forest` `lot.ground` likewise), else the kind's own
(foundation, border and walk cottage, terrace mediterranean, grove woodland; a `meadow` is a meadow anywhere):

| mix | back | mid | front |
|---|---|---|---|
| `cottage` | hydrangea, delphinium spikes, roses | lavender, roses, allium, daisies | daisies, blooms, tulips |
| `modern` | tall grasses, clipped cones, columnar yew | grasses, topiary balls, box | low grasses, groundcover, sedum |
| `mediterranean` | rosemary, cypress, clipped cones | lavender, agave, grasses | silver groundcover, sedum (lavender fills the gaps) |
| `desert` | yucca, cactus, tall grasses | agave, grasses | succulents, rocks, sedum (light gravel mulch, a third bare) |
| `woodland` | hydrangea, shrubs | ferns, spreading shrubs | groundcover, hosta, daisies (under birch and maple in a grove) |
| `tropical` | broadleaf (banana, elephant ear), yucca | ferns, agave, grasses | groundcover, blooms, hosta (fan palms in a grove) |
| `formal` | topiary cones in a row | topiary balls in a row | a box edging (gravel between) |
| `meadow` | tall grasses, spikes | grasses, allium, daisies | low grasses, daisies, blooms |

or your own: `{ "kinds": ["lavender", "agave", "rosemary", …], "weights": [3, 1, 2, …] }`, sorted into layers by
height (its gaps are filled from the low, leafy kinds it names — never a rock or a grass — else groundcover). The species: hydrangea, shrub, spreading, topiary-cone, topiary-ball, columnar, boxwood, box-edging, yucca,
agave, succulent, cactus, rosemary, broadleaf, fern, hosta, grass, grass-tall, grass-low, groundcover, silver, sedum,
lavender, spike, rose, allium, daisy, tulip, bloom, rock; and in a grove olive, maple, birch, cherry, fan-palm,
cypress, broad, oval, conical, willow.

**Species on their own.** `tree.species` adds `willow` (a curtain of hanging strands), `cherry` (a pink cloud),
`olive` (gnarled stems, a silver crown), `fan-palm`, `shade` (9 m broad), `maple` (layered); `spread` widens or
narrows a crown (0.5–2). `shrub.form` adds `hydrangea`, `fern`, `topiary-ball`, `topiary-cone`, `agave`, `yucca`,
`columnar`, `rosemary`, `hosta`, `broadleaf`, `succulent`, `cactus`, `groundcover`, `silver`, `sedum` (`r` its crown,
`h` its height). `flowers.kind`: `lavender` | `daisy` | `tulip` | `allium` | `rose` | `bloom` | `spike` — independent
of `color`, which pins the bloom.

**Curves and surfaces.** `smooth: true` (or a tension 0–0.95) runs a centripetal Catmull-Rom through the points of a
`bed.poly`, `path.path`, `hedge.path`, a fence's or `wall-low`'s `path`, a `terrace.poly`, a `pool.poly`, a patio's
`poly`, resampled every 0.25 m. `path.surface`: `gravel` | `flagstone` (crazy paving) | `stepping` (stepping
stones) | `brick` | `decking` (boards across the walk) | `terracotta` | `concrete`, with `color`. `smooth` cannot bend a
two-point path (a curve needs points to run through): `meander: 0.5` sways a straight or gently bent path into S-curves that far
either side of its line, its ends fixed, seeded by its own points. A path with
`smooth` or `surface` is a ribbon along its line. `bed.edge`: `{ "color", "h", "w" }` or `"none"` — a kerb as a true
offset of the outline (a smoothed bed, and every bed under `defaults: 2`, gets one). `scatter.layout: "poisson"`
spaces its items evenly at random. `patio` and `driveway` take `poly`, `smooth`, `surface` (concrete, gravel, brick,
terracotta, stone) and `color`, and are cut round the water inside them.

**Water.** A `pool` with a `shape` — `rect` | `lap` (lane lines) | `kidney` | `free` | `round` | `poly` (its `poly`) |
`basin` — or with `coping` or a `poly` is a basin you can see into (walls, floor, water), `depth` deep, its rim at
its `y` (else the ground under it), a `coping: { "w", "material", "color" }` round it (false: none). The lawn, a
patio, a deck or a terrace over it is cut round its outline. `basin` is a formal reflecting basin (dark, 0.45 m):
`island: { "w", "d", "h", "plants": "topiary-ball" | "lavender" | "tree" | …, "color" }` and `fountains: n` jets
along its long axis (`jetH`: jet height in metres, default 0.9). `rill` (0.45 m) and `channel` (1.2 m) are narrow runs of water: `at`, `w`, `d` (its length),
`rot`. A `pond` with a `poly` (or `shape: "organic"`) has a noise shore, seeded rocks of varied size and count,
marginal tufts and lily pads. A pool with none of these is the old slab pool, unchanged.

**Terrain (A3).** `{ "type": "terrace", "poly" (or at, w, d, rot), "y", "edge", "surface", "smooth", "id" }` raises
the ground over its outline to `y`. The ground follows it: a tree, a shrub, a bed, a planting, a patio, a prop or a
pool on it stands on it unless it gives its own `y`, and a terrace inside another stands on that one — on it and on the
ground corner by corner: a terrace only partly over a lower one has its wall (or bank) start at the lower terrace's top where it
overhangs it, at the ground where it does not. `y` is the height above the ground (over 0: a sunken court is not built and
the validator refuses it). What is made of many
pieces follows piece by piece — each plant of a planting, scatter or grove, each run of a hedge, fence or wall stands on the
ground at its own spot — but a slab, a deck, a pool, a bed, a path or a structure stands at one height (the ground at its
centre), so one that spans a terrace's edge is linted (`terrace-straddle`): give it a `y`, or place it wholly on or off. `edge`:
`retaining` (vertical faces in `material` — stone, stucco, brick, concrete, timber — and `color`, under a coping,
the default), `rail` (the same with a rail round it: `rail` a style, `railColor`), `planted` (a bank falling
outward at 1:1.6, planted; `mix: "desert"` for succulents), `slope` (a grass bank). The part of an edge along the house has
no face, rail or bank (an edge that runs along the house for only part of its length has them for the rest). `surface` is its top (the lot's own ground by default: the ground follows). `steps` with no `h` climb
the terrace their flight reaches: the rise and the count follow (an authored `n` is honoured; on a terraced lot a plain `steps
{ n }` that climbs nothing is the old flight). A flight's top tread stands 8 mm under the terrace, deck or landing it runs into, so an overrun is
covered, not coplanar. A storey standing on a terrace at its height keeps
its floor (the terrace drops a centimetre under it).

**Structures.**
- `steps`: `h` (the rise; the risers follow at about 0.17 m), `d` (the run), `rail` (true, a style, or
  `{ style, color }`), `style` (stone, brick, timber), `color`; on a terraced lot a flight is solid to the ground.
- `stair`: `{ "from": [x, z, y0], "to": [x, z, y1], "w", "style": "stone" | "concrete" | "timber" | "steel",
  "rail", "color", "landing" }` — an exterior flight (open treads on stringers for timber and steel), a landing half
  way when it climbs more than 16 risers; `y0` / `y1` default to the ground there.
- `deck`: `posts` (true: posts from its underside to the ground; false: none — a balcony, a roof deck; unset: the old
  rule), `rails` (`["S", "E", …]` deck-local sides before `rot`, `"all"`, `"none"`, or `{ sides, style, color }`),
  `railStyle`, `railColor`, `color` (its boards). A deck cuts the water it would bury.
- `fence`: `style` `picket` | `privacy` | `slat-h` | `post-rail` | `metal` | `glass` | `stone-wall`, `color`, `h`,
  `y`, and `from` / `to` at any angle or a `path` (curved with `smooth`; a bend is closed: each run reaches past
  its end by half the thickness). `wall-low`: `surface` (stone, brick, stucco, render, concrete), `color`, `cap`
  (its coping's colour), `t` (thickness), a `path`, `y`. A `path` stands 4 mm above the one before it in the spec (up to
  2 cm): where two cross, the later is on top.
- `pergola` is an open frame — posts, two beams, rafters (and fine slats for `style: "modern"`), `color` its frame,
  `climber`: `wisteria` (hanging racemes) | `vine` | `rose` | `none`, `h`. The old curtained build is `cabana`.
- `gazebo`: `color` roofs it, `trim` paints its columns and rails.
- `climber`: a wall climber (`species`: `ivy` | `wisteria` | `rose`) from `from` to `to`, `h` high, at `y`.
- `string-lights`: festoon lights along `path` at `h`, sagging (`sag`) between posts (`posts: false`: none).
- Every outdoor registry prop is a site item: `patio-set`, `lounger-set`, `hammock`, `bbq-grill`, `fire-bowl`,
  `outdoor-sofa`, `umbrella-table`, `bird-bath`, `mailbox`, `bicycle`, `swing-set`, `sandbox`, `trampoline`,
  `dog-house`, `wheelbarrow`, `garden-fountain`, `picnic-table`, `patio-heater` (`at`, `rot`, `y`, `color`).

**The lot and its world.**
- `lot.street`: `S` | `N` | `E` | `W` | `none` — the street's side, decoupled from the entry's (a lake-side entry
  with the street behind the house); `none` builds no street.
- `lot.context`: `suburb` (the default) | `city` (narrow two- to four-storey houses close to the walk, brick and
  render, flat roofs and gables, a skyline) | `forest` (conifer woods, one neighbour a side) | `desert` (a sparse road
  of stucco houses under hip and flat roofs) | `rural` (fields, hedgerows, a barn, a far neighbour) | `hillside` (the
  ground rises behind the lot, houses and trees stepped up it) | `waterfront` (a lake behind).
- `lot.water`: `lake` | `river` | `canal` | `sea`, or `{ "kind", "sides": ["N", …] (default ["N"], at most three),
  "width" (river 26, canal 11, a lake or the sea to the horizon), "farBank": "trees" | "houses" | "hills" | "none",
  "edge": "bank" | "wall" | "beach" }` — water below the lot on those sides. An item over it (a jetty) is not off the lot.
  The water of two or three sides is one surface: where they meet the banks join in a mitre and a quay wall stands only where land
  meets water. Water on the street's own side lies across the street (the road runs along its bank).
- `lot.setback`: the neighbours' street line (m). `lot.ground` adds `meadow` and `gravel`.
- `lot.sidewalk`: the walk beside the street — `concrete` (the default) | `brick` | `stone` | `flagstone` | `pavers` |
  `gravel` | `slate` (a tint over the kit's concrete flags), `none`, or `{ "material", "color", "width" }` (a colour pins
  the tint). A `rural` lot has none and a gravel shoulder in place of the curb unless you name one.
- `lot.streetFurniture`: what stands along the near walk — `["bench", "hydrant", "bollard", "bike-rack"]`, or `"none"`. A
  `city` lot has all four by default. Both are placed off every driveway apron, the camera paths and the lamps.
- The contexts also change the ground: a `city` block is paved beyond its lot (the lot keeps its lawn), a `hillside`
  rises 24 m over 58 m from 5 m behind the lot (each back-row house stands on a level pad, cut behind and filled in front,
  blended into the slope; fences follow the ground in raked bays), `rural` lots have
  crop fields, hedgerows and a barn in the ring beyond the neighbours.
- Under `defaults: 2` (and in any context but the plain suburb) the neighbours vary in palette and style.

**What the builder records.** `anchors.siteSolids` — `{ kind, x, z, r | w, d, rot, yMin, yMax, site }` (`site`: the item's index in
`spec.site`; and `poly` for a terrace or shaped water): trunks and crowns, posts, fences, walls, hedges, structures (a rotated one's box
in its own frame, turned by `rot`), water, decks, stairs, terraces (`{ kind: 'terrace', poly, x, z, w, d, rot: 0, yMin, yMax }`, and
`bank`: how far a slope or planted bank falls off it — the bank itself is not solid) and their retaining faces — for the shot planner (S5). `anchors.siteEdges` — bed, planting and path outlines as
built. Both, with the instances the isometric twin draws, go to `<id>.plan.json`'s `site` key (`{ instances, solids,
edges }`). An item no builder built is recorded (`anchors.siteDropped`) and reported by the scene QA
(`site-dropped`), never dropped silently. The isometric twin draws a fence or wall at any angle or along a path, and any prop it has no
drawing of its own for, from those solids, and a ribbon path, a planting's beds, water and a terrace from their built outlines.

**Lints** (`scripts/validate/site.mts`, warnings): `unknown-name` (a lot sidewalk or furniture too), `planting-ref`, `planting-empty` (a planting with no room to lay out anything), `planting-heavy` (over 800 000 triangles), `front-crates` (vegetable crates in
the front garden), `in-house`, `off-lot` (its centre, or any point of a path, hedge, fence or polyline), `buried-water`, `bed-on-slab`, `bed-overlap` (two beds
on the same ground), `straight-edge` (8 m of a path or bed running straight along an axis: a garden path bends — `meander`, or waypoints and `smooth`), `steep-stair`,
`stair-end` (an exterior stair whose top ends where nothing stands at its height), `terrace-straddle`, `water-sides`. Scene QA:
`site-dropped`, `site-in-house`, `site-buried`, `site-sunk` (a trunk buried in a terrace).

### Shots (S5)

Spline planner v2 and what steers it (`assets/spec/shots.ts`, `scripts/validate/shots.mts`). Every field is optional; a house
that uses none plans exactly as before, on planner v1.

**Switching planners.** `shots[].planner: "v2"` on a `door-to-core`, `hero-reveal` or `walkthrough` shot plans that shot on
v2; the page's global switch does it for every house: `room-creator.html?planner=v2` (or `window.__houseShotPlanner = 'v2'`
before the house loads; `--planner v2` on `render-house-shots`, `test-frame-hash` and `perf-house`). A shot's own `planner`
wins over the switch; without either, v1. A v2 shot that cannot be planned (no route, no Core) falls back to v1 and the QA
says why (`v2Error`).

| Field | Meaning |
|---|---|
| `shots[].duration` | seconds, or `"auto"` (the walk at its speed caps plus a breath, never under 12 s, and long enough that the opening is at most 30 % of it; the base's number stays a floor on v1 and a minimum on v2 when a number). An auto film is as long as its walk needs at the plan's caps: 17–36 s on the 30 houses, 25 s the median. §3.0's 12 s cannot hold together with the plan's own other numbers — §3.3 budgets no orbit and a 5 m walk, a house's door is 6–20 m from its Core, 0.9 m/s across the door, a whole-house opening — so QA holds a film to a budget instead (`filmBudget` in `assets/shot-spec.ts`: the plan's 12 s (13 for three storeys) plus the orbit plus what each metre beyond the plan's walk, opening and approach costs at the pace the caps allow): `film-length` warns over 1.15 ×. Pinning a number shorter than the walk needs runs the beats past their caps (QA `beat-speed` says which) |
| `shots[].establish` | the opening move: `"auto"`, a style (`axial`, `corner-left`, `corner-right`, `garden`, `dollhouse`), or `{ bearing, height, dist }` (degrees off the door's axis, eye height, metres from the facade; 0 or absent: as far as the frame needs). The film opens on the whole house and its garden (a 42–49° lens, the roof and the sides inside the frame with an 8 % margin, the eye 5–8 m up and as far out as the house needs, over the street if it must); `dollhouse` is a high three-quarter aerial, roofs on |
| `shots[].via` | rooms (name or number) the route passes through, in order (QA `via-missed` if it does not) |
| `shots[].beats` | seconds a beat is held to at least, by beat name (`reveal`, `roomReveal`, `hero`, `power` …) |
| `shots[].route` | `"auto"` \| `"scenic"` (detours up to 9 m to rooms worth seeing) \| `"shortest"` |
| `showcase` | rooms (name or number) and item types (`"kitchen-island"`) worth a film's time: the route detours to them, and their interest doubles |
| `hero.view` | `{ azimuth, dist, height }` — the finale's eye off the Core's front (degrees, + toward its right), its distance (m) and height over its top (m); the orbit ends there when the room lets it (a note says when it does not) |

**The film** is one baked track (`assets/shot-planner.ts`, 120 Hz: eye, look, lens, roof fade, doors) of beats —
`establish, extStair, approach, threshold, reveal, route, stair, descend, roomReveal, hero, orbit, power` — each with a speed
cap (walking pace through doors: ≤ 0.9 m/s within 0.45 m of the entry plane, ≤ 1.2 in doorways, the interior route at most 2.2, the push-in 0.4, a flight's in plan), a yaw cap (the plan's: 12 establishing … 15 on the push-in, 20 on the room reveal, 5 on the press), a lens range (exterior 30–35 — the planner opens at 40–49°, a `fov-range` warning on every film, DEVIATIONS.establishLens —, interior 55–60, the finale's 38–44 wherever the Core is no more than a quarter of the frame at it — a room too tight for that and for an orbit of 90°, to 56°, is a QA warning) and a pitch clamp (the
limits are smoothed across beat seams, so the view never snaps); the plan's numbers are `assets/shot-spec.ts` — the planner builds to them and QA v2 holds the film to them, neither reading the other's constants; the duration is solved from the caps, never by slowing a beat to fill the film. The look
leaves a wall it would stare at before it fills the frame (a path search over the yaw), and never turns more than 55° off the way the eye is going. A doorway
is crossed through its middle, square to it. The orbit builds to 30°/s, holds about 26°/s on average (the v1 orbit's pace) and eases to half of that into the press; the push-in is the hero beat while it closes on the Core and the orbit's from where it turns to run round it. It routes on a distance-field nav grid
(`shot-nav.ts`), takes stairs up and down (a spiral follows its treads as built; an L or U flight follows S2's `path`), opens
shut door leaves ahead of the eye (`track.doors`, applied by the page through `visibility.shotPose`), and ends on an orbit
round the Core — 90° wherever the room allows it (27 of the 30 houses: the fleet gate is strict; mesamariposa's and valleyview's rooms allow 75–85° at a radius the Core can be framed from, and vanilla's 135° free run has no way in that keeps the Core in the frame) — before the press. The finale is planned over the orbit's radii and eye heights, not one: a plan whose way in swings round the Core against the sweep, or arrives facing away from it so the Core is out of the frame for seconds (QA `hero-core-off`, `reveal-core-off`), loses to any sound one whatever its sweep. The walk-in is chosen with its sharpest turn in mind (no U-turn the view cannot follow at its turn rate), the carry-on sweep of the press stays inside ±65° of the Core's front and off the chair, and where an exact segment (a flight, the orbit, the power beat) meets a walked one the corner is rounded with a cubic Bézier on the walked side. A frame narrower than 16:9
(the phone player, a square still) widens its lens where the Core is in it (`track.tanHReq`), just enough to keep the Core inside. `hero-reveal` lands on the same finale framing;
`walkthrough` is routed on the nav grid.

**Checking it.** `node --experimental-strip-types scripts/test-shot-planner.mts` (all 30 houses planned twice, byte-identical;
QA v2; the fleet targets; the page's track hash equal to Node's with `--parity`), `test-shot-qa.mts` (a fault injected for
every QA code), `camera-audit.mts` (a contact strip per house and planner, v1 beside v2), `pnpm run fleet-audit --built`
(the camera metrics in the fleet report). QA v2 (`assets/shot-qa.ts`) reports every code in `QA_CODES` with its level — beside the geometry and the pacing it reads the speed profile (`stall`: a dip to under 40 % of the pace either side; `cold-start`), the path's shape (`hairpin`), the Core in the frame while the film closes on it, and the chair at the lens (clipped, so a chair back 0.3 m from the eye counts); the
world it and the planner read is `plan.json`'s `shots.world` (`assets/shot-world.ts`), so Node bakes the track the page bakes: the planner and QA use
`assets/detmath.ts` (sin, cos, atan2 … built from + − × ÷ and sqrt) instead of `Math`'s, because two engines' last bits differ and a last bit flips a probe;
`test-shot-planner.mts` plans every world's three films in Node and in Chromium's engine and compares the whole track's hash. The recorded track hashes
(`test/shots/<id>.track.json`) and the establishing salt (`ESTABLISH_SALT` in `framing.ts`, fitted by `scripts/fit-establish-salt.mts`) are re-recorded whenever the
worlds or the planner change: at integration. `anchors.nav` (the storeys' walkable grid and the route a shot flies) is for the plan inset.

## Authoring rules

1. Footprint rects **must overlap or share edges** if they are meant to be one building; detached garages are separate rects that don't touch (they get their own perimeter).
2. Opening centres must be ≥ `w/2 + 0.2` from a wall end and must not overlap each other on the same side.
3. Every level with `y > 0` needs a `stairs` entry on the level below and a `voids` cut-out over the stair run (≈ `1.2 × 3.4`).
4. Keep furniture inside `rooms[].bounds`; the CAD generator lists `items` under each room.
5. Interiors are stylised: 5–12 items per room, colours from `palette`.
6. Faithfulness priority: massing (storeys, footprint shape, roof type/colour) → key exterior features (pool, garage, porch, deck, fence, trees) → interior room layout → furniture.
