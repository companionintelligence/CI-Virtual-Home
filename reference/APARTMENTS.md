# Apartments: a home that is one unit in a block

The gallery's homes are houses on lots. Six more are apartments: a family's flat inside a building that other people live in.
They are original pieces authored by CI (no builder, no game, no gallery they came from, anywhere: not in `name`, `style`, a
room name or a comment). This file is the recipe. **`content/houses/studio-loft.json` is the exemplar**: build the next one
the way it is built. Read [HOUSE-SPEC.md](HOUSE-SPEC.md) first; this file only says what is different for a unit in a block,
and what was measured. Everything below was tried in the engine; "measured" means a QA or test number from this tree.

| id | public name | what | m² | storeys |
|---|---|---|---|---|
| `studio-loft` | Warehouse Loft | converted brick warehouse, double-height loft with a sleeping platform | 52 | 3 |
| `city-one-bed` | City One-Bedroom | one-bed on the first floor up of a pale-render mid-rise | 58 | 6 (five floors and a roof stair head) |
| `two-bed-flat` | Two-Bedroom Flat | walk-up tenement flat, closed kitchen, kid's room, slate hip roof | 84 | 3 |
| `corner-penthouse` | Corner Penthouse | white pavilion on a podium roof, wraparound terrace | 134 | 3 |
| `garden-flat` | Garden Flat | ground-level flat in a low timber block, private garden | 96 | 2 |
| `walkup-duplex` | Walk-up Duplex | two levels in a dark-brick deck-access block | 110 (both levels) | 4 |

All six are built, baked, in the gallery (`Apartment` tag) and recorded (plans, isometrics, CAD sheets, planner tracks, thumbnails and
link previews). None has a family yet (`homesWithoutFamily` in `content/story/cast-plan.json`); none has a golden baseline yet
(section 8). `studio-loft` is the exemplar: build the next one the way it is built.

---

## 1. How the engine expresses a unit in a block, and why this way

The engine builds **a building on a lot**: storeys, each a union of rectangles, walls derived from the outline, rooms by bounds.
There is no "unit" object. Three ways to make a flat read as one unit of a block were weighed against the schema, the builders,
the shot planner, the twins and the gates:

**(a) A single-unit spec whose massing only suggests a block** (party walls, flat roof, a balcony band, a podium). Cheapest, and
the first render of the loft (two storeys, two blank neighbour bays) already read as a block. But a lone volume has nothing
to hold the street frontage together, and the lot's own neighbours (below) start 3 to 6 m beyond the lot edge, never touching it.

**(b) The plate: model the building, compose only the featured unit.** Every storey the building has is drawn as one rectangle
per *bay* with shared edges; the unit's bay is composed room by room; the other bays are **closed volumes** (walls, windows with
the blind down, one authored room, no door in the party wall); one bay is a **stair core** with a street door. **Chosen.**
It uses only fields every house already uses, needs no engine change, and its failure modes are all known and listed below.

**(c) A loft conversion in a warehouse shell.** Not a third mechanism: it is (b) with a double-height room and a mezzanine
inside the unit's bay and a brick facade. The loft is (b) + (c).

Evidence for (b), from the code and from runs:

- **Bays are footprint rectangles with their own cladding.** `levels[].footprint[i]` takes `material`, `color`, `h`
  (HOUSE-SPEC: Architecture S2, Sections); a perimeter edge is split where two volumes with different cladding meet
  (`assets/arch-plan.ts` `splitEdges`). One long S wall carries every bay's windows; the three bay colours of the loft are
  what make it read as a street of separate lofts and not one long box.
- **A party wall is a partition with `door: null`** on every storey. A bay with no door in its wall is closed, and the
  composer, the camera route and the lints treat it as another building.
- **Plain bays cost one authored room each.** `scripts/test-floorplan-graph.mts` (line 251) fails a level that has more
  detected rooms than authored `rooms[]` (`studio-loft/l3: more rooms than authored (3 > 0)` was the first failure). A closed
  bay is a detected cycle, so it needs a `{ no, name, bounds }` row (no `program`, no items: it renders exactly as authored,
  empty). Give them real, unique names ("Neighbour Loft", "Upper Loft West"); the CAD sheet prints them.
- **A blind makes a window read as a neighbour's.** `openings[].blinds: { color, drop }` (S2) hangs a drawn blind in the
  window (`assets/facade.ts` line 282). Our own windows stay clear glass and show the furnished room: the unit is the one lit
  room in the facade. Measured (orbit and street stills of the loft): reads at once.
- **The lot already brings a city.** `lot.context: "city"` builds 2 to 4 storey flat-roofed or gabled neighbours 1.4 to 2.6 m
  apart and 1.5 m off the walk (`assets/world.ts` `cityPlan`, lines 354 to 359, 393 to 399), and `lot.ground: "urban"` paves the
  lot. The neighbours stand outside the lot, so the block's own party walls come from the plate, not from them.
- **Every raised storey needs a flight to it** (`scripts/validate/arch.mts` rule `raised-level`, lines 89 to 113), except the
  lowest modelled storey. So a block with storeys above the unit needs a stair core: it is real geometry and it is a real room
  the street door opens into. Voids come from `autoVoid: true` on each flight.
- **A mezzanine is a double-height room under a partial upper storey**, not `floorOffset` (a raised platform "needs a storey
  under it", HOUSE-SPEC S2). `rooms[].ceiling: { kind: "double" }` opens the slab above that room
  (`assets/arch-plan.ts` `doubleRoomsUnder`, line 28) and rails the gallery
  (`assets/room-finish.ts` `galleryRails`, line 352). The upper storey's footprint is the whole plate; the platform is the part
  of its slab the opening leaves.
- **The planner walks it.** `door-to-core` v2 takes any entry level, climbs `steps` site items to an upper entry (the
  `extStair` beat, `assets/shot-planner.ts` lines 899 to 935), and walks stair flights including a 0.6 m ladder-stair (measured below).
- **The twins draw it.** `generate_floor_plans.py` prints the plate, the closed bays (unlabelled voids unless authored),
  "DOUBLE HEIGHT" markers and every flight; `generate_house_iso.py` draws the hero storey and what is below it and **drops the
  storeys above the hero storey** (it printed `level l2 removed: above the hero storey` for the loft: the isometric shows the
  ground floor only; this is the twin's rule for every house with a ground-floor Core). Both ran on the loft in a scratch copy
  with no errors.

**Where the block stops.** Anything the visitor cannot see or walk is not modelled: storeys below a unit that sits on a
raised first storey are a plinth (`levels[].plinth`), storeys above it are plain shells. Do not furnish a neighbour.

---

## 2. The recipe

### 2.1 The plate

1. Draw the building, not the flat: a rectangle per bay, same rectangles on every storey (the top storey may be set back for a
   terrace). The loft plate is 16 x 8 m: unit bay 6.5 m, neighbour bay 5 m, stair core 4.5 m.
2. `+z` is the street. Bays run along it, so the facade is one wall and the party walls run street to back.
3. Party walls: `{ "from": [x, zBack], "to": [x, zFront], "door": null }` on **every** storey that has the bay.
4. A closed bay: its windows (with `blinds`), one authored room, nothing else. A closed bay on a storey above the unit is the
   same.
5. The core bay: a street door (`style: entry`, its own colour), a `hall` room per storey, the flight(s). It is also where
   the flights the validator demands live; the camera need not walk them (2.4).
6. The unit's rooms cover its bay, with a `program` on every one and unique names.
7. `areaSqm` is the unit's footprint (the loft: 6.5 x 8 = 52), not the building's.

### 2.2 A minimal skeleton that passes every gate

Measured on this tree: `validate` 0 errors and 0 warnings with `--layout`, `compose-house --lint` none, shot QA 0 errors
(warnings only), `test-floorplan-graph` 16 of 16. It is a throwaway generator (write the JSON with it, then bake: 2.9); the JSON it
writes is the source, never the script.

```js
// skeleton.cjs: node skeleton.cjs content/houses/<id>.json <id>
const fs = require('fs');
const [, , out, id = 'skeleton'] = process.argv;
const H = 2.8;                                        // storey height
const FRAME = '#2f3438', PAINT = '#ece7dd', BRICK = '#a45f4a';
// 1. THE PLATE: one rectangle per bay, shared edges, the same on every storey. +z is the street.
//    bay A (x -6..0) is the unit, bay B (0..4) a neighbour (closed), bay C (4..7.5) the stair core.
const plate = [
  { x: -6, z: -4, w: 6, d: 9, material: 'brick', color: BRICK },
  { x: 0, z: -4, w: 4, d: 9, material: 'brick', color: '#935645' },
  { x: 4, z: -4, w: 3.5, d: 9, material: 'brick', color: '#b06d55' },
];
// 2. OPENINGS. `at` is the world x (S/N walls) or z (E/W walls) of the centre. A neighbour's window gets a blind.
const BLIND = { color: '#d9d2c3', drop: 0.9 };
const win = (side, at, w, h, sill, o = {}) => ({ side, at, type: 'window', w, h, sill, frame: FRAME, grid: 'vertical', ...o });
const nwin = (side, at, w, h, sill) => win(side, at, w, h, sill, { blinds: BLIND });
// 3. PARTY WALLS: full-depth partitions with no door, on EVERY storey, or the bay is not closed.
const party = x => ({ from: [x, -4], to: [x, 5], door: null, color: PAINT });

const spec = {
  $schema: 'house-spec/v1', id, name: 'Skeleton Flat',
  author: 'Companion Intelligence',                   // the company's own name: the credit guard knows it is not a builder (scripts/own-authors.mts)
  source: 'original piece: CI apartments',
  style: 'A two-storey brick block on a city street with a stair core and a closed neighbour bay; the flat is the west bay of the ground floor',
  emoji: '🏢', styleKey: 'modern',
  defaults: 2,                                        // the look the 30 homes ship with
  lot: { w: 20, d: 16, ground: 'urban', context: 'city', street: 'S', sidewalk: { material: 'brick', width: 2.2 }, streetFurniture: ['bollard', 'bike-rack'] },
  palette: { wall: BRICK, trim: FRAME, roof: '#4b4947', accent: '#c9772e', material: 'brick', door: FRAME, interior: PAINT, keep: ['wall', 'trim', 'accent', 'door'] },
  lighting: { preset: 'day', sunBearing: 200 },
  levels: [
    {
      id: 'l1', name: 'Ground Floor', sheet: 'A-101', y: 0, height: H, floor: 'oak', interior: PAINT, trimColor: FRAME, footprint: plate,
      openings: [
        { side: 'S', at: -4.5, type: 'door', w: 1.1, h: 2.2, style: 'entry', color: FRAME, id: 'front' },   // the flat's own street door
        win('S', -2.0, 1.6, 1.5, 0.9), nwin('S', 1.5, 1.4, 1.5, 0.9),
        { side: 'S', at: 5.7, type: 'door', w: 1.2, h: 2.2, style: 'entry', color: '#3f5a52' },             // the core's street door
        { side: 'W', at: 1.9, type: 'glass', w: 1.6, h: 2.4, frame: FRAME },   // glass in the entry's line of sight (foyer lint, 2.6)
        win('N', -3.0, 1.4, 1.5, 0.9), nwin('N', 2.0, 1.4, 1.5, 0.9), win('N', 5.5, 1.0, 1.5, 0.9),
      ],
      partitions: [party(0), party(4), { from: [-6, 0.5], to: [-1.8, 0.5], door: 3.0, doorW: 0.8 }],   // a bedroom block behind a door
      stairs: { type: 'timber', at: [5.7, 3.3], rot: 180, to: 'l2', w: 1.1, run: 3.36, autoVoid: true },   // every raised storey needs a flight to it
      rooms: [
        { no: '01', name: 'Living Room', bounds: { x: -6, z: 0.5, w: 6, d: 4.5 }, program: 'living', style: 'modern' },
        { no: '02', name: 'Bedroom', bounds: { x: -6, z: -4, w: 6, d: 4.5 }, program: 'bed-primary', style: 'modern' },
        { no: '03', name: 'Neighbour Flat', bounds: { x: 0, z: -4, w: 4, d: 9 } },   // a closed bay still needs an authored room (test-floorplan-graph)
        { no: '04', name: 'Stair Hall', bounds: { x: 4, z: -4, w: 3.5, d: 9 }, program: 'hall', style: 'modern' },
      ],
    },
    {
      id: 'l2', name: 'First Floor', sheet: 'A-102', y: H, height: H, floor: 'oak', interior: PAINT, trimColor: FRAME, footprint: plate,
      openings: [nwin('S', -2.0, 1.6, 1.5, 0.9), nwin('S', 1.5, 1.4, 1.5, 0.9), win('S', 5.7, 1.0, 1.5, 0.9), nwin('W', 1.0, 1.4, 1.5, 0.9), nwin('N', -3.0, 1.4, 1.5, 0.9), nwin('N', 2.0, 1.4, 1.5, 0.9), win('N', 5.5, 1.0, 1.5, 0.9)],
      partitions: [party(0), party(4)],
      rooms: [
        { no: '05', name: 'Upper Flat West', bounds: { x: -6, z: -4, w: 6, d: 9 } },
        { no: '06', name: 'Upper Flat East', bounds: { x: 0, z: -4, w: 4, d: 9 } },
        { no: '07', name: 'Upper Landing', bounds: { x: 4, z: -4, w: 3.5, d: 9 } },
      ],
    },
  ],
  roofs: [{ over: { x: -6, z: -4, w: 13.5, d: 9 }, y: 2 * H, type: 'flat', parapet: 0.5, overhang: 0, color: '#4b4947', trim: '#8f8a82', finish: 'membrane' }],
  site: [{ type: 'path', path: [[-4.5, 5.1], [-4.5, 6.6]], w: 1.4, surface: 'concrete' }, { type: 'tree', at: [8.8, 6.6], species: 'birch', h: 5 }],
  hero: { level: 'l1', at: [-0.48, 3.8], rot: 270, device: 'chalk', pose: 'prone', surface: 'desk', desk: { style: 'oak', w: 1.4 }, monitor: 'flat', chair: { kind: 'task', pose: 'turned' } },
  entry: { level: 'l1', side: 'S', at: -4.5 },           // must match a door in levels[].openings
  shots: [{ id: 'door-to-core', type: 'door-to-core', planner: 'v2', duration: 'auto' }, { id: 'orbit', type: 'orbit', duration: 10 }],
  areaSqm: 54,                                           // the unit's footprint (6 x 9), not the building's
};
fs.writeFileSync(out, JSON.stringify(spec, null, 2));    // NO final newline: the 30 homes have none (test-dress-phase S)
```

### 2.3 The exterior of an apartment

What makes the building read as a block and not a big house, in the order it mattered in the loft's stills:

1. **A flat roof behind a parapet** (`roofs[].type: flat`, `parapet: 0.5` to `0.6`) and a coping band
   (`facade.bands`, `proud: 0.05`). No gables unless the concept is a tenement (two-bed-flat).
2. **A regular window grid across the whole facade,** the unit's bay and the neighbours' alike, with the same lintel
   (`head: "segmental"`, `surround: { kind: "brick-soldier" }` for brick), string courses between storeys (`facade.bands`
   at each floor line, `sides: ["S", "W"]`).
3. **Bays in different tints of the one material** (`footprint[i].color`), each with its own door or loading door
   (`type: garage`, `w` 2.2): the facade stops being one house.
4. **A street door for the core** next to the unit's own door, in a different colour, with `surround`.
5. **Blinds on every window that is not the unit's.**
6. **A frontage that is a street, not a lawn:** `lot: { ground: "urban", context: "city", street: "S", sidewalk: {...},
   streetFurniture: [...] }`, a path to each door, a planter, a bike.
7. **The back is a court:** `wall-low` brick walls (`h` 2.4) on the three lot edges behind the building, a `patio`
   (`surface: brick`), a `bed`, a bench, `string-lights`. The side walls stop at the building's front line.
8. **No hedge, no fence-and-gate, no garage.**

The street door and the unit's door are different openings: `entry` names the unit's.

### 2.4 Access patterns, measured

Every number is `render-house-shots --qa-only` on this machine: the door-to-core film's length against the planner's budget
for the house (over 1.15 x warns, `film-length`), and errors. The patterns other than the loft were throwaway spikes (ids
`spike-*`, not in the tree).

| pattern | used by | film | QA errors |
|---|---|---|---|
| street door, the unit on the ground storey | studio-loft, garden-flat | **21.5 s** (loft, 3 storeys; budget 18.0) | 0 |
| ladder-stair (`w` 0.6, `run` 2.2, open risers) to a platform, Core upstairs | studio-loft | planner climbed it; `stair` warnings only (jerk, speed 1.33 against 1.2) | 0 |
| interior core, **one** U flight, unit on `l2`, Core on `l2` | city-one-bed, two-bed-flat | 33.5 s (budget 25.0) | 0 |
| interior core, two U flights (unit on `l3`) | avoid | 42.5 s | **blank-frame** at the landing |
| interior core, three U flights (unit on `l4`) | avoid | 54.0 s (budget 32.5) | **blank-frame** x5 |
| exterior `steps` perpendicular to the facade (19 risers) to a gallery deck, entry on `l2` | walkup-duplex | 36.0 s (budget 22.9) | 0 |
| exterior `steps` running parallel to the facade | avoid | 38.0 s | **dead-air** x2 |
| two exterior flights (landing deck at 3.04 m, 19 + 19 risers) to a terrace door at 6.0 m | corner-penthouse | 38.0 s (budget 25.5) | 0 |
| spiral flights stacked in a core | avoid | route failed (the arrival is inside the next flight) | `route-failed` |

Rules that follow:

- **One storey of climbing at most on the route.** A second flight costs 9 s and puts the camera against a landing wall.
- **Put the entry on the Core's storey when the unit is up:** a gallery or terrace door at the unit's level reached by `steps`.
  The planner climbs the last flight of the `steps` item whose top is within 0.6 m of the entry's `y` and 3.2 m of the point 3 m
  out from the door (`assets/shot-planner.ts` line 901, `world.steps` from `assets/shot-world.ts` line 257): only `steps` items
  count, not a `stair` item (a `stair` is scenery). Set `steps[].y` to the landing it rises from.
- **If the Core is not on the entry storey** (the unit up an interior core), set `hero.upstairs: true` or `hero:storey` warns.
- **The core's flights need not be on the route.** The loft's core flights (`l1` to `l3`) are never walked (the Core is on the
  entry storey); they exist because `raised-level` demands them.
- **U flights stacked in one core** need the arrival clear of the next foot and of the unit's door: the unit's door must be
  south of the stair void (at z 5.3 in the spike), or the planner says `no way to the Core`.
- **Film-length is a warning, not an error.** Do not pin a shorter `duration` to hide it: pinning under the walk runs the beats past their caps.

### 2.5 Balcony and terrace patterns

- **A real balcony:** `features: [{ type: "balcony", level, side, from, to, depth: 1.2, rail: "metal", railColor, floorColor }]`
  plus a `slider` (or `door` with `leaf: french`) in the wall behind it, plus an **outdoor room** row whose bounds lie outside the
  wall: `{ name: "Back Balcony", bounds: {...}, program: "outdoor", fixtures: { fan: false, pendants: 0, ceiling: "none" } }`. The room
  is 1.2 m² or more, so the `fixtures` line is mandatory (else it gets cans, a fan and a light hanging in the air); the validator
  then warns "bounds extend outside footprint", which is expected and the fleet's. Measured: the loft's balcony reads from the
  court stills and from the platform inside.
- **A wraparound terrace** (penthouse): `features: [{ type: "terrace", level: "<the set-back storey>", rect: <the podium roof>,
  rail: "glass" }]` on the roof below a set-back top storey. It is a deck on the roof, it fades with the roofs, and a pavilion
  on a two-storey podium rendered correctly in the spike (rails round the podium edge, the pavilion standing in it).
- **A garden:** `patio` or `deck` flush with the floor, `bed`, `planting`, `shrub`, `planter`: zones the story roles read
  (`deck`/`patio`/`garden` in `content/story/roles.json`).
- **A loggia** is a recessed, floored, railed outdoor room under the storey above (`features: [{ type: "loggia", level, rect, rail }]`); give it the same outdoor-room row.

### 2.6 The mezzanine and the ladder-stair (the loft's own recipe)

- Lower storey: one or two rooms with `ceiling: { kind: "double", rail: false }`, bounds = the tall zone; height 2.9.
- Upper storey: `footprint` = the whole plate, same height; the platform room covers the part the opening does not.
- **`rail: false` plus manual `balustrades`**, because the automatic rail goes round the whole opening, and so across the
  stair's arrival and along the shared edge of two adjacent double rooms. The validator errors on a rail across a flight's
  step-off (`crosses the stair step-off`): start the rail 0.6 m (half a tread width plus a hand) off the stair axis on each side.
- Stair: `{ type: "timber", w: 0.6, run: 2.2, riser: "open", stringer: <steel colour>, treadWood: "oak", autoVoid: true }`
  from the tall floor, `at` the bottom step, `rot` 180 to climb north. `autoVoid: true` is required even though the slab
  is already open there: the `stair-void` lint does not know about double-height openings.
- Keep the stair out of the review rig's corners (2.8).

### 2.7 How the Core's place is chosen

- On the **entry storey**, in the room a visitor reaches first or can see from the door's axis (HOUSE-SPEC: Hero / entry / shots;
  `scripts/validate/hero.mts`).
- On a desk (`hero.surface: "desk"`) in the study or desk zone, or a `shelf`/`console` in a living room or library.
  `hero.at` is the desk centre **0.4 m from the wall face** (the wall face is the footprint edge 0.08 m in), `rot` the wall it
  backs onto (90 west, 270 east, 0 north, 180 south). Not in front of a window, not in the only doorway, 2 m clear in front.
- **Device against wall:** chalk (white) on brick or a dark wall; on a pale wall use `charcoal` for the look, but know that QA's
  `core-contrast` does not read `hero.device`: `assets/shot-world.ts` gives the Core one constant colour (`0xe7e3dc`) and compares it
  with the box behind it (`assets/shot-qa.ts`), so charcoal and chalk both measured 1.06 against a white bookcase carcass. What clears
  the number is a dark box behind the Core (the penthouse: a walnut carcass `#4a3626` at 1.25 and over), not the device.
- Leave `hero.view` alone. Four settings were tried on the loft (`azimuth` 30, -35, 40 and 25, `dist` 1.45 to 1.8): each made the finale
  worse (`chair-share` 16 %, `crab`, `look-error`, a 175 degree `hairpin`) than the default, whose only finale warning is
  `monitor-cut`.

### 2.8 Rooms, names and the story

- Room names are unique inside the home (story files key on them). The story system finds a room's kind from its name
  (`content/story/roles.json`, `kindNames`): `living|lounge|den|^loft$|library`, `kitchen`, `dining`, `bed|sleeping|suite|dressing`,
  `bath|shower|ensuite`, `study|office|\bdesk|craft|library`, `workshop`, `laundry|storage|closet|utility`, entry
  `entry|foyer|mudroom|porch|vestibule`, hall `hall|landing|passage|foyer|entry|lobby|stair`. Name for the kind: "Living Loft",
  "Sleeping Platform", "Desk & Workshop".
- Furniture roles the stories use (same file): a couch, tv, bookshelf, fridge, range, counter, dining-table, a `desk` (writing-desk,
  standing-desk, vanity-desk, kids-desk, laptop), bed, laundry (`washing-machine`, `dryer`), `bicycle`, easel, patio seat. A room
  the family lives in must be able to answer a role: a desk or study, a balcony/terrace/garden, an entry.
- Measured on the loft with `assets/story/roles.js` `roomRoles` and `content/story/roles.json`: Living Loft is `living`; Desk & Workshop is
  `office` and `garage` (the workshop role); Kitchen `kitchen`; Bath `bath`; Sleeping Platform `bedroom`; Back Balcony answers the
  `patio` zone room (`balcony` in `zoneRooms.deck`); the halls are circulation; the neighbours' rooms answer no role. The loft has no
  room named Entry (the street door opens into the Living Loft: `front-door` is a builtin role that always resolves); a flat with
  a hall should name it "Entry Hall" so the `entry` room role (`entry|foyer|mudroom|porch|vestibule`) resolves.
- Rooms of the neighbours are not family rooms: name them so no kind pattern matches a person's room ("Neighbour Loft",
  "Upper Flat West", "Top Stair Hall"; not "Bedroom 2").
- The camera does not climb to an upper storey on its own: `shots[].via` for a room on another storey errors `via-missed`.
  The upper room is reached by putting the Core there (measured: a Core on the platform makes `door-to-core` climb the
  ladder, 0 errors) or by the family tour's own walks (`story:bake`).

### 2.9 Authoring order

```bash
# 1. write the JSON (by hand, or with a throwaway generator like 2.2): programs on the unit's rooms, pins only where the composer cannot know
node --experimental-strip-types scripts/validate-house-spec.mts content/houses/<id>.json          # 0 errors
node --experimental-strip-types scripts/compose-house.mts --house <id> --lint                       # a dry run: what it would place, the layout lints
# 2. bake the layout, then the dress (small goods), then drop the final newline (compose --write adds one; the 30 homes have none)
node --experimental-strip-types scripts/compose-house.mts --house <id> --write
node --experimental-strip-types scripts/compose-house.mts --house <id> --dress --write
printf %s "$(cat content/houses/<id>.json)" > content/houses/<id>.json
node --experimental-strip-types scripts/validate-house-spec.mts --layout content/houses/<id>.json
```

A layout change means: regenerate, `--write` (a re-bake replaces `compose@1` and `dress@1` items, keeps yours), `--dress
--write` again, strip the newline again. Bake at the default dress level (no `--level`): `test-dress-phase` S proves a baked
house is what `--dress` writes today. Never put a `dress` field on a room.

---

## 3. Pitfalls met, and what fixed them

| symptom | cause | fix |
|---|---|---|
| `level l2: floor "honey-oak"` (error) | `levels[].floor` has its own vocabulary (oak, herringbone, terrazzo, concrete, tile, deck...); `honey-oak` is a room floor | level `oak`; `rooms[].floor: { kind: "honey-oak" }` |
| `stair-void` on a stair under a double-height opening | the lint reads `voids` and `autoVoid` only | `autoVoid: true` on the flight |
| error `balustrade ... crosses the stair step-off` | a rail along the whole void edge | `ceiling.rail: false`, rails in two pieces with a gap at the stair |
| a glass rail across the stair top, or along the party wall | `galleryRails` rails every non-perimeter edge of every double room | one double room, or `rail: false` + `balustrades` |
| `hero:wall` "desk stands 0.52 m off" | `hero.at` is the centre, not the wall | wall face (edge ± 0.08) + 0.4 m |
| `foyer` "nothing to see from the entry" | the lint wants a flight, `glass`/`slider` opening, hearth or island within 6 m, 35 degrees either side of the door's axis | move the entry so a flight is in the cone, or add a `glass` opening on a side wall (the skeleton does) |
| `stair-run-in` | under 1.6 m of floor at a flight's foot or head | move the flight 1.6 m off the wall (the skeleton's foot is at z 3.3 in a 9 m deep bay) |
| `test-floorplan-graph` `more rooms than authored` | a closed bay is a detected room | an authored room per bay per storey |
| `test-dress-phase` S "6 files end with a newline" | `compose-house --write` appends `\n` | strip it (2.9) |
| `core-contrast` | the box behind the Core is pale (QA ignores `hero.device`, section 2.7) | a dark wall or carcass behind the Core |
| planner `no way to the Core on l4` | the unit's door opens into the stair void, or the arrival is inside the next flight | door clear of the void; one flight only (2.4) |
| `blank-frame` at a U landing | the camera faces the landing's wall | one flight on the route |
| `dead-air` on exterior steps | steps parallel to the facade | perpendicular to it |
| the review rig's NW corner is inside the stair | the rig's eye is 0.55 m in from the room's corner | do not put a stair or a tall pin in a room's NW or SE corner (the rig's two corners), or look from NE and SW |
| neighbour windows show a bare room | an unfurnished bay seen through clear glass | `blinds` |
| a tan wall where a party wall was painted | a partition's `color` shows where no room liner covers it | `color` = the interior paint |
| `hero.view` made the finale worse | a hand-set eye fights the planner's | leave it |
| `monitor-cut` on the final frame | the desk monitor's top edge leaves the close-up | left as a warning (the default view) |
| spec `author` | the portal's credit guard reads every `author` as a builder handle and fails the build if a page contains it | the company's own name, `Companion Intelligence`, which `scripts/own-authors.mts` exempts (whole, case-insensitive); any other value is a handle |
| a home's name read in a family's words | `scripts/story/check-leaks.mts` fails a family whose text says a home's display name: the Salazar family's "studio loft" stopped a home called "Studio Loft" | pick a name no family's text contains (the loft is "Warehouse Loft"); `pnpm run story:validate` and `node --experimental-strip-types scripts/story/check-leaks.mts` say |
| the card says "6 storeys" for a five-floor block | `index.json`'s `storeys` is the number of `levels[]`, and a roof stair head is a level | say it in the `style` ("five floors under a flat roof with a stair head") or build the head as a taller footprint rect (the duplex's tower) |

---

## 4. Commands that work on this machine (Linux, node 22, Intel iGPU + NVIDIA)

```bash
cd <your worktree>
# Chromium: the pinned build is not installed; a symlink shim finds the one that is (once)
SHIM=<scratch>/pw-shim; mkdir -p $SHIM
ln -sfn ~/.cache/ms-playwright/chromium-1234 $SHIM/chromium-1246
ln -sfn ~/.cache/ms-playwright/chromium_headless_shell-1234 $SHIM/chromium_headless_shell-1246
ln -sfn ~/.cache/ms-playwright/ffmpeg-1011 $SHIM/ffmpeg-1011
export PLAYWRIGHT_BROWSERS_PATH=$SHIM

pnpm run validate                                   # every spec; 0 errors for yours, each warning explained
node --experimental-strip-types scripts/validate-house-spec.mts --layout content/houses/<id>.json
node --experimental-strip-types scripts/render-house-shots.mts --house <id> --qa-only \
     --shot door-to-core,orbit,core-orbit,hero-reveal --out <scratch>/qa            # ~25 s; errors fixed, warnings read
node --experimental-strip-types scripts/render-house-shots.mts --house <id> --shot door-to-core --res 540 --fps 12 --out <scratch>/vid
ffmpeg -v error -y -i <scratch>/vid/<id>/door-to-core.mp4 -vf "fps=1,scale=480:-1,tile=5x4" -frames:v 1 strip.jpg   # look at the film
node --experimental-strip-types --test scripts/test-floorplan-graph.mts             # 16 pass
node --experimental-strip-types scripts/test-spec-types.mts                          # 0 type errors
node --experimental-strip-types scripts/test-dress-phase.mts                         # 27 pass; K fails only on the lamp-less census count (a fleet constant)
node --experimental-strip-types scripts/build-house-plan.mts --house <id> --out <scratch>/plans   # a plan.json to look at; the tree's own is the integrator's
```

`render-house-shots.mts` launches with `--use-gl=angle --use-angle=default` on Linux: the Intel GPU, frames are not blank.
Never `--use-angle=vulkan` (blank frames), never re-bless goldens (the committed ones are macOS).
A film at 540p and 12 fps takes about 45 s.

**Stills of every room and the exterior** (a throwaway script: it serves the repo with `scripts/portal-lib.mts`, opens
`room-creator.html?house=<id>&mode=review`, waits for `houseReady`, `__houseComposerWarm`, then sets the camera and calls
`__houseSnapshot`; `cornerCam` is `scripts/review/cameras.mts`):

```ts
const { serve, loadPlaywright, stubGoogleFonts } = await import(`${REPO}/scripts/portal-lib.mts`);
const { cornerCam } = await import(`${REPO}/scripts/review/cameras.mts`);
const srv = await serve(REPO, '/'), pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium', args: ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await stubGoogleFonts(page, srv.origin);
await page.goto(srv.url(`room-creator.html?house=${id}&mode=review`), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(h => document.documentElement.dataset.houseReady === h, id);
await page.evaluate(r => { window.__houseSupersample = 2; return window.__houseComposerWarm({ res: r }); }, '720');
// per room: cam = cornerCam(room.bounds, level.y, 'NW' | 'SE' | 'NE' | 'SW')   (eye 1.5 m, 60 degrees); exterior: any pos/target/fov
const url = await page.evaluate(({ cam }) => { const W = window, c = W.__houseDebug().camera;
  c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.updateProjectionMatrix();
  return W.__houseSnapshot({ res: '720', dressing: { walls: 'up', roof: 'on' }, quality: 0.93 }); }, { cam });   // a data: URL (JPEG)
// walls: 'cutaway' with roof: 'off' for a doll-house look at the plan
```

Look at: every room from two corners, the exterior from the street, the SE and the back, the orbit, the door-to-core strip.
There is no `rsvg-convert` here: rasterise the twins' SVGs with the same Chromium.

**The twins on one house, without touching the tree's derived files:** copy `scripts/`, `content/house-catalog.json` and your
spec and its `plan.json` into a scratch root with a one-house `content/houses/index.json`, then
`python3 scripts/generate_house_iso.py --only <id>` and `python3 scripts/generate_floor_plans.py --only <id> --no-png`
there. Both ran clean on the loft (the only notices are catalog footprints missing for a few small goods, `drawn 0.6 x 0.6`).

---

## 5. Checklist an author must pass

- [ ] `content/houses/<id>.json` is new; no existing house, no fixture, no assets edited. `id` = file name, kebab-case.
- [ ] `name`, `style` (one paragraph, sentence case, describes the building), room names: no builder, no game, no gallery, no
      "Base Game", "Sims", "BG ". `author: "Companion Intelligence"`, `source: "original piece: CI apartments"`. The `style` paragraph says "apartment" once (the gallery's `Apartment` tag matches that word only). `defaults: 2`. No final newline.
- [ ] It reads as an apartment from the street: plate, party walls on every storey, flat roof or a deliberate tenement roof,
      bays tinted, a street door for the core, blinds on neighbours, a city lot (2.3).
- [ ] An `entry` that matches a `door` in `levels[].openings`; an `entry` side that faces the street or a gallery.
- [ ] Every storey's detected rooms are authored (closed bays included); room names unique; every unit room has a `program`.
- [ ] Every raised storey has a flight to it (`autoVoid: true`); the camera route climbs at most one (2.4).
- [ ] Hero: on the entry storey (or `hero.upstairs: true` with the reason), desk 0.4 m off the wall face, not in front of
      glass, contrast with its wall, 2 m clear in front.
- [ ] The unit has what the family needs: living, kitchen, a bedroom per person, a desk or study, an outdoor room or garden, an entry.
- [ ] `areaSqm` true to the unit's footprint (+- 2 m²).
- [ ] Baked: composed, dressed, newline stripped (2.9). `validate` 0 errors; `--layout` clean or each warning explained
      (in the report: the loft has four, all `dress-bare` and the outside-room note, explained in section 7).
- [ ] `--qa-only` for the four shots: 0 errors; every warning read.
- [ ] Stills: every room from two corners, the exterior, the orbit, the film strip: nothing floating, no blocked door, no empty
      room, no wall through a window, the Core visible in the last frame, no room too dark, reads as an apartment.
- [ ] `test-floorplan-graph` and `test-spec-types` pass; `test-dress-phase` K's lamp-less census for the apartments (31 today) moves by what you add.
- [ ] The derived files are the integration's (section 7): `<id>.plan.json`, `index.json`, `scenes/`, thumbs, the cast plan's `homesWithoutFamily`,
      the planner track, the compose baseline, the goldens (macOS).

---

## 6. The other five (the proposals the authors started from)

These are the briefs the five authors were given. The specs are the record of what was built: where a number or a pattern here
differs from `content/houses/<id>.json` (the city one-bed's plate is 16 x 12 and its roof stair head is a level; the duplex's
`areaSqm` is 110 over two levels; the penthouse is 134 m² and its stair is two exterior flights; the flat's core desk is in the
living room), the spec wins.

Each differs in massing, material, roof, access and what the camera meets, so the six read as six buildings in the gallery.
Dimensions are plate dimensions; room areas are targets. All set `defaults: 2`, `styleKey` as noted, daylight.

### city-one-bed: first floor up in a pale mid-rise (58 m²)

*A couple who both work from home.* **Exterior:** five storeys of pale render (`stucco`, `#ece6da`) with charcoal frames, a tall
glazed ground floor (3.8 m, shopfront windows, a teal lobby door), continuous balcony bands (`features.balcony`, one per storey
on the street side, `rail: "metal"`), a thin parapet and a roof plant box (a footprint rect with `h`). Street: city, concrete
walk, bike racks, a bench. `styleKey: scandi`. **Plate:** 14 x 12 m; unit bay 8.5 x 6.8 m (57.8 m²) at the south-west corner,
core 3 m wide, a closed bay east. Storeys `l1` (lobby + closed shop, tall), `l2` the unit, `l3` to `l5` plain with core flights.
**Access:** street door, lobby, **one** U flight to `l2` (measured 33.5 s, 0 errors), `hero.upstairs: true`.
**Rooms:** Entry Hall (foyer 3.5), Living Room (living 15.8), Kitchen (kitchen 12.3, open to the living room: bounds without a
partition), Desk Nook (study 4.8, a window on the west wall, the Core on a desk, charcoal device on the pale wall), Bedroom
(bed-primary 13.7), Bath (bath 4.8), Laundry Closet (laundry 2.2); a real balcony 1.3 m deep on the south with its outdoor room.
**Watch:** the unit door must be south of the stair void; the neighbour storeys need an authored room per bay.

### two-bed-flat: walk-up tenement flat (84 m²)

*A parent and children; one room is a kid's or teen's.* **Exterior:** three storeys of warm yellow-stock brick, white-framed
windows, canted bay windows on the street side of `l1` and `l2` (`features.bay`, `form: canted`), a stone stoop with steps to
the core door (`entry.stoop`: a landing and steps at the core's door), **a pitched roof** (hip, slate-grey, with two dormers
on the attic storey) so it is the one block that is not flat-topped, a rear gallery balcony. `styleKey: cottage` or
`craftsman`. **Plate:** 12 x 9 m, unit bay 10.5 x 8 m on `l2`, core 3 m, `l1` ground (closed flat + lobby), `l3` an attic flat
(plain). **Access:** stoop, hall, one U flight to `l2` (the same pattern and cost as city-one-bed, measured 33.5 s, 0 errors), `hero.upstairs: true`. **Rooms:** Hall (foyer 5),
Living Room (living 20), Dining Room (dining 9, a bay window), Kitchen (closed, kitchen 9), Primary Bedroom (13), Kids' Room
(bed-kid 11, a name the story roles read as kids), Bath (6), Laundry (laundry 3), Study Alcove (study 4, the Core), a
balcony. **Watch:** the roof rule (`roof-storey`, eaves meeting the storey top), a hip roof over three bays needs three
roof rects or one wide rect; the bays' `feature-opening` lint.

### corner-penthouse: pavilion on a podium (130 m²)

*An older couple.* **Exterior:** a white-render pavilion (`#f1eee6`) with a deep flat overhang and floor-to-ceiling glass,
standing on a two-storey podium (`l1` lobby and closed shop, `l2` plain flats), the podium roof a **wraparound terrace**
(`features.terrace`, `rail: "glass"`, `floorColor` stone, planters and trees with `y`). The pavilion is pushed to the south-east corner of the podium, so the terrace is widest on its south and east sides. `styleKey: mid-century`. **Plate:** podium 18 x 13, pavilion 14 x 9.3 (130 m²) on `l3`. **Access:** two
flights of exterior steps (landing deck at 3.04 m, `steps` with `y: 3.04`) to the terrace door on `l3`: **measured 38.0 s, 0
errors** (spike). The Core is on the entry storey, no `hero:storey` warning. **Rooms:** Great Room (living 38, a `fireplace`
feature `style: modern`, a media wall), Kitchen (kitchen 18, island), Primary Suite (bed-primary 24) with Ensuite (ensuite 8)
and Dressing Room, Bedroom Two (bed-guest 13), Bedroom Three (bed-guest 12), Office (study 11, a desk), Library Nook
(library 7, the Core on a `console`/`shelf`, charcoal), Powder Room, the Terrace (outdoor room under 1.2 m² marker, or none).
**Watch:** the interior of the podium is two plain stacked storeys with a core: its flights still need autoVoid and a
clear arrival; keep the pavilion's stair opening away from the entry door (the spike's first try put the stairwell under
the door and `void-clip` fired).

### garden-flat: ground floor of a low timber courtyard block (96 m²)

*Grandparents with a visiting grandchild.* **Exterior:** two storeys of vertical timber (`board-and-batten` on a stone
plinth, `levels[].plinth`), a mono-pitch (`shed`) roof, large sliding glass to the garden, a **ramped, step-free path** to the
door, a communal cycle shelter. The block is long and low and not brick, so it does not look like the other five.
`styleKey: scandi` or `craftsman`. Lot: `context: "city"` with `ground: "lawn"` (a garden), a brick wall at the back. **Plate:** 16 x 8 m; the unit takes the east 12 m (96 m²) of the ground floor; a closed bay west; the upper storey plain
(a maisonette) with a core flight. **Access:** street door at grade (no step: `y: 0`, a path), the loft's pattern, about 21 s.
**Rooms:** Entry (foyer), Living Room (living 22) and Kitchen (kitchen 12) open to the garden, Primary Bedroom (13), Bedroom
Two (11, the grandchild's), Bathroom (bath 7, **level-access shower**: `bath: { tub: "none", shower: true }`, tile floor,
no sill), Utility (laundry 5), Study (study 6, the Core). **Garden:** a `deck` or `patio` flush with the floor, raised
`garden-beds`, `planting` border, a bench, a low wall, `string-lights`. **Watch:** `lot.ground: "lawn"` in a city context keeps
the garden green while the street beyond the lot is paved.

### walkup-duplex: two levels in a dark-brick deck-access block (110 m²)

*A family with teenagers.* **Exterior:** dark brick (`#4a3b30`), four storeys, white metal-railed **access galleries** across
the street face (`features.balcony` bands or `deck` items with `rails`), an exterior steel stair, a roof terrace; the heaviest
and darkest block of the six. `styleKey: industrial` or `modern`. **Plate:** 14 x 8 m; the duplex takes 110 m² over `l2` and
`l3`; `l1` is garages and storage (closed), `l4` plain. **Access:** a gallery door on `l2` reached by **perpendicular
steps** (19 risers; measured 36.0 s, 0 errors; steps parallel to the facade failed with `dead-air`). The entry and the Core are
on `l2`. The internal stair (`l2` to `l3`, straight timber with `autoVoid`) is the family's own and is not on the route.
**Rooms `l2`:** Entry (foyer), Kitchen-Living (kitchen-dining 28, the Core on a desk by the window), Dining (dining 9), Study
Corner or Cloakroom, Powder Room. **`l3`:** Primary Bedroom (bed-primary 14), Bedroom Two and Three (bed-kid 11 each), Family Bath
(bath 7), Study Landing (study, 5, on the landing), a balcony over the gallery side or a roof terrace on `l3`.
**Watch:** `stair-run-in` (1.6 m clear at the foot and head of the family stair); steps need 6 m of lot in front, so set
`lot.d` to at least 26 and keep the walk in front clear of site items.

---

## 7. What adding an apartment (or any home) changes: the integration of the six, as run

Done once for the six; the same list for the next home, in this order. Commands run from the repository root; no `rsvg-convert` is
needed except for the CAD sheets' PNGs.

| step | command | what it writes |
|---|---|---|
| validate and bake | section 2.9 | the spec, baked (composed, dressed, no final newline) |
| the index, and the count copy | `pnpm run index` | `content/houses/index.json`, and **`index.html`'s count** (the heading's and the descriptions' "Thirty-six homes", the hero's two figures: `galleryCountCopy`, `scripts/portal-pages.mts`) |
| the plan | `pnpm run plans -- --house <id>` | `content/houses/<id>.plan.json` (a browser; the GPU is not used) |
| the twins | `pnpm run iso` and `pnpm run floorplans` (`--no-png` without `rsvg-convert`) | `scenes/svg/`, `scenes/lottie-scenes/`, `scenes/manifest.json`, `scenes/floorplans/`; the 30 existing sheets come out byte for byte |
| the planner's track | `pnpm run shot-planner -- --house <id> --update` | `test/shots/<id>.track.json` (the page and Node bake the same track) |
| the composer's baseline | `node --experimental-strip-types scripts/compose-baseline.mts --write` | `test/fixtures/hashes/compose-baseline.json`; the 30 houses' hashes must not move, only the fleet totals and the new rows |
| the names | `assets/home-names.ts` | the home's public name, pinned; **not a name any family's words contain** (`check-leaks.mts`) |
| the picture | `pnpm run portal:thumbs -- --house <id> --no-hero [--gl default]` | `portal/thumbs/<id>.webp`, `portal/previews/<id>.jpg`; a tall block needs a line in `FRAME` (`scripts/build-thumbs.mts`) |
| the story's side | `content/story/cast-plan.json` `homesWithoutFamily` (or a family), then `pnpm run story:cast` | `reference/story/cast.md`; `casting.json` stays the families' |
| the goldens | `pnpm run goldens:update --house <id>` **on the Mac** (`macos-metal`), then look at the frames | `test/goldens/macos-metal/<id>/` (five frames) |

Fleet constants that count homes, and what changed for the six: `test-portal-redact` (the list is read from the specs, no number),
`test-portal` and `test-ui` (the number of homes is the built list's), `test-story-pages` (the homes are the list's), `test-dress-phase` K
(the lamp-less census is held for the 30 and for the apartments apart: 132 and 31), `test-compose-stability` (the baseline above),
`test-shot-planner` (the ratchets scale with the number of homes). The credit guard knows the company's own name (`scripts/own-authors.mts`).

The loft's layout lints, all warnings: `dress-bare` for the Kitchen (2 of 4 counter clusters: a single run and an island in a
3 m deep band), for Stair Hall and Upper Stair Hall (the hall recipe dresses a hall at the *spec's entry*; these are the
building's, not the unit's), and "bounds extend outside footprint" for the outdoor room Back Balcony (expected, section 2.5).
The fleet itself has 52 `dress-bare` warnings.

---

## 8. Open: what the engine does not do yet, and what the owner runs

Engine behaviours the authors met and worked around in the specs (none changed in this pass; each has a repro in the author's notes):

1. **`partitions[].doors[]`** is read by the structure builder, the floor-plan graph and the layout lint, but not by the composer
   (`assets/room-geo.ts`), the planner (`assets/shot-world.ts`, `assets/shot-nav.ts`) or the dress phase (`assets/dress-leaves.ts`);
   its leaves ignore `doorColor`, `doorSwing` and the defaults-2 parking (`assets/structure-build.ts` passes `leafColor`, which
   `partitionParams` does not return). Use one partition segment per doorway, each with `door` and `doorW`.
2. **`layout:core-walk`** treats the seam between two footprint rects as outside (a partition door on it reports "no walk at all"; overlap
   the rects by 0.2 to 0.3 m), blocks the hero as a fixed 1.8 x 0.85 m box for any surface but a shelf, credenza or island, and names a
   pinch that is not the pinch.
3. **QA `core-contrast`** ignores `hero.device` (2.7). **`film-length`**'s budget shrinks with a short route while the establishing, orbit and
   press beats do not, so a compact home warns (21.5 s against 18); a long climb (two exterior flights, a U flight) warns a lot more.
4. **A hinged exterior door that is not the entry** cannot be drawn shut (`kit-build.ts` passes `style: op.style || 'entry'` and the page opens every `entry` leaf): use `type: glass` with `blinds`.
5. **`generate_house_iso.py` `site_deck`** ignores `posts: false` and `rails` on a deck over 0.35 m; **`generate_floor_plans.py`** labels every gallery slab BALCONY.
6. `features[].bay` under defaults 2 hangs a leaf pair beside a bay 1.4 to 2.0 m wide; dormers on a hip roof are dropped silently under 0.65 m of roof;
   the composer drops a bed or a washer when a glazed door sits in the wall of a 3 m bedroom or a 1.5 m laundry.
7. The planner climbs a `steps` item as `n * 0.16` rise and `(n - 1) * 0.32` run, whatever the item's `h` and `d` say.

What the owner runs (the Mac is the committed golden profile, so nothing below is run or blessed on a Linux box):

```bash
pnpm run goldens:update --house studio-loft,city-one-bed,two-bed-flat,corner-penthouse,garden-flat,walkup-duplex   # five frames each; LOOK at test/goldens/macos-metal/<id>/, then commit
pnpm run floorplans --only <id>                                                                                     # for each apartment, where rsvg-convert is installed: the CAD sheets' PNGs
pnpm run portal:thumbs -- --house <id> --no-hero                                                                    # optional: the six pictures were made on a Linux GPU; the Mac's are the 30's profile
```
