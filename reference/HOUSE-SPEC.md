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
Every new field is optional: a spec that uses none of them renders exactly as it does today.

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
                                          // stucco trim band, painted eaves and default interior — NOT its cladding,
                                          // which is palette.wall's, one material a house
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
                     // color (default the storey's interior colour) — the door leaf stays teal
  ],
  "stairs":  { "type": "timber", "at": [3, 0], "rot": 180, "to": "l2", "w": 1.1, "run": 3.36 },
                     // timber | colonial | spiral ; at = bottom step; rot = ascent direction (0 = ascends toward +Z);
                     // w width (timber 1.1, colonial 1.2), run plan length (3.36; a spiral has none). One flight a level
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
(a planter on a deck, a pool on a terrace; default 0). A type the builder does not know is dropped without a word
— the validator refuses it.

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
| `pergola`, `gazebo`, `greenhouse`, `garden-beds`, `monkeybars`, `firepit`, `loungers`, `bench`, `car`, `planter` | props (`pergola` builds a curtained cabana; `garden-beds` are raised vegetable crates, `count`) |
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
- Shot types: `door-to-core` (establishing → approach entry → through door → an orbit round the Core, climbs stairs when hero is on an upper level), `orbit` (360° around the lot), `hero-reveal`, `walkthrough`, `core-orbit` (8 s: a slow product orbit round the Core alone, powered on). The builder derives waypoints from the spec; no hand-authored coordinates.
- **The Core orbit** (`assets/core-orbit.ts`) — door-to-core's last third and all of core-orbit. The builder probes a circle round the Core every 5° (radius 0.8 m for a shelf Core, 0.9 m on a desk, 0.2 m wider for core-orbit; eye 0.45 → 0.36 m above the Core's centre, lower under a low ceiling): an angle is free where the eye is 0.3 m off every wall, clear of every piece of furniture (0.22 m from one standing at eye height, like the monitor), under the ceiling, and a ray to the Core meets nothing. The orbit takes the free run through the Core's front and **ends on the front** — 15–45° past straight-on, so the last frames hold the button and LED ring at a three-quarter with the room (or the monitor) behind — core-orbit starts as far round as the run allows (up to 200°; the QA gate warns under 120°), and where nothing round the Core is free at any radius it falls back to a slow push-in on its front (`note` says so; the gate warns `core-orbit-fallback`). door-to-core's finale **starts where the walk arrives**: it weighs both directions round the Core and every start from the longest sweep (150°) down to 45° against the curve the walk will actually fly — above all the degrees its last 4 m and the push-in travel round the Core *against* the orbit while the Core is in sight (circling one way for the orbit to sweep back over the same arc is the one thing a long sweep must never cost), then how near it passes the Core's dark front and how hard it turns into the push-in and the orbit. A walk that arrives from one side gets a long sweep that carries on round; one that comes straight at the front gets 45–60° from the front to a three-quarter (60–125° across the 30 houses). Its walk ends at an **approach** 1.2–2 m out on the orbit's starting side, then pushes in along a line that keeps the Core in sight. A flight that lands beside the Core (lakecabin, modernhouse1, payorote) has carried the eye round it before the walk starts, and no orbit that ends on the front can undo that; the gate warns `orbit-swing-back` over 20° in the 2.5 s before the orbit, and `orbit-short` under 60°. Waypoints every ≤ 15° keep the Catmull-Rom circular; the look is locked on the Core, turned so it sits off-centre (door-to-core ~a quarter of the frame, core-orbit slightly) with the room it is heading into on the other side.
- **Timing** (`assets/shot-path.ts`): door-to-core and core-orbit pin each waypoint to a moment in the shot instead of spreading one ease over the path's arc length. door-to-core gives the orbit a third of its 12 s at 25–40°/s (about 4 s: 30 % of a 14 s shot), the push-in about a second, and the rest to the travel — the fly-in and the street at 2.2× and 1.5× the indoor pace, the doorway and the stairs a little under it — and moves from its first frame. The look turns against time, and no leg turns it faster than 110°/s at any moment: a leg that swings it round (the turn just inside a door, the U-turn at the foot of a switchback stair) is given the seconds that keep its *peak* rate — yaw and pitch together, as the monotone cubic through the waypoints' looks turns it — under 110°/s, and the straight legs make them up. A shot too short for all that runs its orbit at 40°/s, then raises the budget for every turning leg alike rather than leaving one a whip (the gate warns `look-whip` over 125°/s and fails it over 300°/s; `validate` refuses a door-to-core under 8 s). The Core's off-centre framing turns in over the push-in; core-orbit eases in and out of a steady turn. The timing is laid out for the duration the spec pins (`shots[]`), 12 s by default; a house whose walk is long (three storeys, or 40 m+ that would take the indoor pace past ~4 m/s — asymmetry, bgfamily, mirage, palms, palnknoll) pins door-to-core at 14 s, the most it should take. A monotone cubic through the (time, distance) knots keeps the speed smooth, and the look direction turns by heading and pitch between waypoints, so it never flips over the eye. Frames stay random access: `shot.frameAt(t, aspect)` is a pure function of t. Inside the house `door-to-core` **walks each storey** on a 0.25 m nav grid — through partition doorways, off the perimeter, and around anything taller than 1.1 m (wardrobes, bookshelves, ensuites, big plants) — from the door to the stair foot, landing to landing, and the last landing to the desk; a leg whose straight line is already clear stays straight. A flight is an obstacle on the storey it climbs from — the walk goes round it to its foot, never under it — and a flight whose first step is against a wall (nowhere to stand in line with it) is reached from the side of its first steps. The walk also keeps 0.2 m off the walls as built (the jambs, and an open door's leaf standing out into the room); where the furnished storey leaves no way through it eases the margins, then squeezes between the pieces of furniture at eye height, then keeps to walls and stairs alone, then squeezes past an open door standing across a corridor (0.16 m off its edge) — never the straight line through a partition. The finished curve is then checked every 3 cm against the walls, the stairs' treads and spine and the furniture, and a waypoint goes on the chord wherever the Catmull-Rom swings into one. So furniture never has to be arranged around the camera (the QA gate's `item-clip` warning names anything the eye still meets).
- Shots render the house **complete**: full-height walls and roofs on, whatever wall mode the editor is in. Once the eye passes under a ceiling the roofs fade out over the last 5 % of the approach and stay off; walls stay full, so every interior leg goes through doorways (the QA gate tests full walls — a `wall-clip` is an error). Offline frames go through GTAO (ambient occlusion) + SMAA; the editor's live view does not. Frames are deterministic — seeded procedural textures and AO noise, no wall-clock animation while a shot records — and `scripts/test-frame-hash.mts` proves it (two fresh contexts, pixel-compared) before goldens or a re-lay are trusted.
- Doors: a hinged leaf hangs on the wall's local −x jamb (the `from` end of an along-X partition, the `to` end of an along-Z one) and stands open 88° flat to the wall; openings wider than 1.1 m are cased openings with no leaf; an entry `slider` parks both panels on its local +x half and the shot enters through the other.
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
  the compile if it narrows. `scripts/test-spec-types.mts` type-checks the 30 specs and every fixture against
  `HouseSpec`, so a fixture that uses a field no fragment declares fails the gate.
- **Validation.** The validator's core never changes for a stream. Its plugin `extend`s a vocabulary the core checks
  against (a new roof type, floor, ground, hero surface, shot type) and `replaces` a core rule whose meaning it
  changes (`stairs`, `raised-level`, `site-needs`, `shot-duration`); item and site types are read off the builders,
  so a new builder is a valid type at once. The contract is `scripts/validate/_types.mts`.

### Kit (S1)

Doors, palette restraint, per-level cladding, room fixtures, hero surfaces and lighting (`assets/spec/kit.ts`,
`scripts/validate/kit.mts`). Nothing yet.

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
Any flight takes `treadWood`, `riser` (`open`|`closed`), `stringer` (colour), `handrailSide` and `autoVoid: true`, which cuts
the void the climb needs in the storey above from the flight itself (`voids[]` need not list it).

**Room finishes.** `rooms[].floor` is a kind or `{ kind, color?, pattern?, scale?, run? }` (`oak`, `honey-oak`, `walnut`,
`herringbone`, `tile`, `hex-tile`, `checker`, `terracotta`, `stone`, `carpet`, `marble`, `terrazzo`, `deck` …); it is an overlay on
the storey's slab, clipped to the room's `bounds`. `rooms[].walls` is `{ kind?, color?, h?, lower?, feature? }`: liners on the
inner faces of the walls round the room (`paint`, `plaster`, `painted-brick`, `brick`, `stone`, `wainscot`, `board-and-batten`,
`shiplap`, `timber`, `tile` …), tagged role `finish` so the cutaway lifts them with the wall; `feature` gives one side (or one
`partitions[]` index) its own finish. `rooms[].ceiling` is always an object — `{ kind: 'flat'|'timber'|'beams'|'vault'|'tray'|'double',
color?, rise?, ridge?, rail? }`; `double` makes the room double height (the storey above opens over it and rails the gallery).
`rooms[].floorOffset` raises (+) or sinks (−) the floor over the room's bounds. Under `defaults: 2` a room with no floor gets a
seeded one for its program (kitchen and bath tile, living rooms warm wood, bedrooms wood or carpet) that its neighbours do not share.

**Sections.** `footprint[i].h` gives a volume its own wall height (a tower, a low wing); `footprint[i].material` / `.color` its own
cladding. `levels[].knee` stops the perimeter walls at a knee height (the roof's underside is the ceiling above). `levels[].split:
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
taller storey rises through it and trim eaves against parapets; on under `defaults: 2`), `dormers[].style` (`gable`, `shed`,
`flat`, `eyebrow`, `glazed`) and `.side`, `type: 'pent'` (a shed along a wall), and a `chimney` of `{ at, w, d, h, material:
'brick'|'stone'|'stucco'|'metal', color, cap: 'stone'|'pots'|'metal' }` on any roof, flat ones included (`h` is how far it stands over
the highest roof point it rises through).

**Features.** `features: []` holds what stands on or beside the walls — each has a `type` and, where it belongs to a storey, `level`
(default the entry's):
- `porch` — `{ side, from, to, depth, roof: 'shed'|'hip'|'gable'|'flat'|'none', pitch?, roofColor?, finish?, posts: { spacing|n, style:
  'square'|'round'|'turned'|'tapered'|'steel', size, color }, rail, floorY, steps, ceiling }`. The roof is built by `roofs.ts` (eaves,
  fascia, gutters) and abuts the house wall; posts are kept out of every doorway on the wall and off the steps.
- `balcony` / `terrace` / `loggia` — `{ level, side, from, to, depth }` or `{ level, rect }`, `rail: 'glass'|'metal'|'timber'|'parapet'|
  'none'`. A balcony is a slab out of the wall; a terrace is a deck on the roof below (it fades with the roofs); a loggia is recessed
  under the storey above (`posts` along its open side).
- `bay` — `{ level, side, at, w, depth, form: 'box'|'canted', roof, sill, head, h }`: the host wall is opened over the bay, which has a
  floor, glazed walls (canted at 45° for `canted`), a ceiling and its own roof.
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
its headroom), `stair-step-off` (0.3 m past the top step is a void, outside the slab, or a wall), `roof-storey` (a roof slices through
a taller storey's walls), `roof-y` (its eave meets no storey top under it), `chimney-hearth`, `porch-door`, `feature-opening`. Errors:
an unknown kind in any S2 field, a flight with no `at`, a `to` that is not a higher storey, an `edgeZ` that names no edge.

### Rooms & composition (S3)

Room programs and the composer's inputs (`assets/spec/compose.ts`, `scripts/validate/layout.mts`, run with
`pnpm run validate --layout`). Nothing yet.

### Site (S4)

Planting generators, curves, hardscape, water, fences, structures, the lot and its world (`assets/spec/site.ts`,
`scripts/validate/site.mts`). Nothing yet.

### Shots (S5)

Showcase, planner v2 knobs and the hero view (`assets/spec/shots.ts`, `scripts/validate/shots.mts`). Nothing yet.

## Authoring rules

1. Footprint rects **must overlap or share edges** if they are meant to be one building; detached garages are separate rects that don't touch (they get their own perimeter).
2. Opening centres must be ≥ `w/2 + 0.2` from a wall end and must not overlap each other on the same side.
3. Every level with `y > 0` needs a `stairs` entry on the level below and a `voids` cut-out over the stair run (≈ `1.2 × 3.4`).
4. Keep furniture inside `rooms[].bounds`; the CAD generator lists `items` under each room.
5. Interiors are stylised: 5–12 items per room, colours from `palette`.
6. Faithfulness priority: massing (storeys, footprint shape, roof type/colour) → key exterior features (pool, garage, porch, deck, fence, trees) → interior room layout → furniture.
