# The story bake

`pnpm run story:bake` turns a family's authored story (`content/families/<slug>.json`) into its camera: a safe pose for every beat, the walk between poses, the time of every beat and the whole tour's track. It writes `content/families/<slug>.bake.json` (a `BakeLock`) beside the story. The modules are `assets/story/{roles,anchors,poses,route,track,place,runtime}.ts`: all THREE-free, all importable in Node and in the page, none of them editing the planner (`assets/shot-*.ts`), so the goldens cannot move.

```
pnpm run story:bake -- <slug>                  bake one family
pnpm run story:bake -- --all                   every story in content/families/
pnpm run story:bake -- <slug> --stills <dir>   also render the contact sheets (one GPU process)
pnpm run story:bake -- --all --check           say whether each lock is fresh; write nothing
pnpm run story:bake -- <slug> --estimated      ignore the voice lock (draft durations at 150 words a minute)
```

Exit 1 when a beat loses its anchor (none of its role, its `nth` and its fallbacks can be framed), and then no lock is written: a lock with a lost anchor would be a camera that holds still. A lock with `durations: "estimated"` is a draft; a release build refuses it.

## How a beat becomes a shot

1. **Role to piece** (`anchors.ts`). A beat names a role, never a coordinate. `content/story/roles.json` lists, for every role, the HouseSpec item types (`rooms[].items[].type`), lot items and lot zones that answer it, in preference order. `resolveAnchor` tries the role, then each fallback in order, over the pieces in a stable order (type preference, then the rooms the role lives in, then storey, then the spec's order). `anchor.room` narrows to rooms of that kind first; `anchor.nth` indexes what is left. The spec gives rooms no program, so a room's kinds are read off its name by `kindNames`.
2. **Piece to pose** (`poses.ts`). The solver stands a camera on a free cell of the storey's 0.2 m grid and keeps the best-scoring one. Hard rules: 0.42/0.32 m of clearance to walls and furniture (then 0.30/0.20, then 0.22/0.12 with a looser sight line: `Pose.tier` 0, 1, 2); the eye in or at the door of the anchor's room; eight of nine sight rays clear (the anchor's own boxes skipped); the anchor's whole projected box inside +-0.9 NDC at 16:9; nothing within 0.8 m of the lens over more than 12% of the frame; no wall plane over half of it. Soft rules: the size the framing hint asks for, seeing the front of the thing, open depth behind it, a clearance to spare, and not the same shot twice for one anchor. Outdoors it also prefers the house behind the anchor, seen 25 to 60 degrees off the wall's normal, over bare scenery, and when no eye on the ground works it retries from the air.
3. **Pose to compose table.** A pose carries the anchor's offset and the lens per aspect (16:9, square, a phone): on a third of a wide frame, nearer the middle in a square, centred above the bottom sheet in a phone, with the lens widened until the whole anchor is inside. `trackFrameAt(track, t, aspect)` re-aims for the aspect it is asked for, so one lock serves the desktop, the phone and the 9:16 film.
4. **Pose to walk** (`route.ts`). From one beat's rest eye to the next: a leg on the storey's grid (A*, string-pulled, corners rounded by the planner's fillet), a chain of flights between storeys, through the entry door in or out. No route, an entry up exterior steps (a floor above 0.9 m), or a walk over 24 m is a **cut**: the new beat starts at its pose and `events.cuts` lists the time, for the player or the film to cross-fade. The walk is first asked of the planner's own grid, exactly as it always was; only a walk that grid refuses is asked again, on **the rescue ladder** below.
5. **Time** (`track.ts`, `runtime.ts`). A beat lasts `max(voice starts + speech + 0.6 s, popup reading time at 200 words a minute, minSeconds, walk + 1.2 s at rest)`. The voice starts 0.25 s into a beat, or, after a long walk, 1.5 s before the camera arrives. Speech is the voice lock's real durations, or an estimate (150 words a minute) the lock marks.
6. **First run.** The FTUE chapter plays the planner's own door-to-core track (the establishing move, the walk to the Core's room, the hero ring and the orbit), time-warped so each beat holds the part of the film that tells it: delivery is the walk in, unbox the arrival in the Core's room, plug-in the hero ring (the Core wakes during it: `events.press`), join, pick and hello the orbit in thirds. The planner's closing push-in is dropped.

## The rescue ladder (why a camera could not walk where a person can)

The planner's navigation grid (`assets/shot-nav.ts`) reads the digest's boxes at eye height (1.2 to 1.8 m over the floor) and treats a wall box as a wall. The digest is boxes, not meshes, and
four things in the shipped homes are drawn as boxes that close a way a person walks through. Six homes (kovacs, adeniran, nguyen, dekker, tesfaye, quintero) were "not connected for the camera"
for these reasons (`story:spline`: `cuts`, `no walkable leg on l1`). `routeBetween` therefore tries the planner's grid first, and only a walk it refuses (no leg, a leg over 24 m, an entry it
will not take) goes up the ladder; the first rung that gives a walk within 24 m wins and `Route.rescued` says which. A walk the planner's grid makes is kept unless it goes more than 2 cm into a wall or a hard piece (`crossesSolid`, below), so a tour that had no cut and no such crossing keeps its bytes.

Two things have changed since that first pass, both from the digest (`assets/features.ts` `archRise`, `assets/shot-world.ts`): the spandrels of a partition's arch are boxed from their crown, not
from the springline (2.15 to 2.49 m over the floor, above the eye band), so the planner's grid walks those doorways itself and the rung 1 row below for an arch is for a digest made before that, an arched
head in a facade wall and any other header; and **a walk the planner's grid makes that goes more than 2 cm into a wall or a hard piece of furniture is asked again on the ladder** (`crossesSolid`, `route.ts`:
the planner's own hard bands, 1.1 to 2.0 m for furniture, 1.2 to 1.8 m for walls; the stretch to a snapped end is the one it does not check) and stands only if the ladder has nothing. In the 30
families that moves one lock, kovacs' tv-steam walk, whose last hop went through the bird of paradise beside the TV room's arch once the planner could reach that arch.

| Rung | What it reads differently | The cause it answers |
|---|---|---|
| 1 | **Doorways opened.** For each doorway of the plan's partitions (`nav.doorsOn`: centre, normal, width) the wall distance of the cells in and in front of the gap is taken again from the wall boxes without the ones hanging over the gap (underside at least 1.2 m up, centred in the gap, no thicker than a wall and not running past the jambs by more than 0.1 m: a long soffit over a whole wall is not a header). The jambs, and any wall that really stands in the gap, stay. | An **arched doorway** is drawn as the arch's bounding boxes: one box across the whole gap from the springline up (an underside 1.4 to 1.5 m over the floor), and the grid's eye band ends at 1.8 m. The mediterranean (kovacs) and onestory (dekker) homes have a dozen of them, and every room behind one was sealed. |
| 1 | **A spiral stair is walked as the planner's film walks it** (`spiral()`): a helix round the column at the void's radius less 0.3 m, over the treads as built (`stairs[].spin`), the eye 1.55 m over the tread under it, stepping on from clear floor outside the footprint and off to clear floor outside the void, at the first spot that the rest of the storey can reach. | A spiral's `bottom` and `top` are the one column and the grid blocks its whole footprint, so there was **no cell within a metre of its foot** and every walk up or down one (adeniran l3-l4, tesfaye l3-l4) failed. |
| 1 | **The entry takes the planner's limit.** The router refused any entry floor above 0.3 m (a threshold); the planner walks the ground grid up to 0.9 m and draws exterior steps only above it (`shot-planner.ts`, `e.y > 0.9`). `ENTRY_STEP_M` = 0.9. | A **plinth entry** (0.34 m in the mediterranean home) was "above the ground". |
| 1 | **A leg is walked to where it is going.** The planner's `leg` tries the tiers in turn and snaps an end to the nearest passable cell within a metre, so a pose over a sofa (which the first three tiers call blocked) is reached a metre away and the last hop is a straight line nobody checked. A rescued leg asks for the first tier at which both its own ends are passable. | The camera clipped a plant in kovacs' den walk. |
| 2 | **Low furniture passed over.** A hard piece whose top is under `PASS_OVER_M` = 1.4 m (the eye is 1.55 m up) is soft: the first three tiers avoid it, the last two walk over it. | A **bed** is its hull (1.35 m, the width of the room): in adeniran's green bedroom it sealed the window half of the room, where two beats stand. |

`walkGrid(ctx, level, rung)` builds these grids (cached per nav, the planner's own grid never touched); `smoothRoute` rounds a rescued walk on the grid it was walked on and
`scripts/story/spline-report.mts` reads the clearance of a walk the router rescued (and only of those: it asks the router again, as the track did) on the better of the two grids; every other walk is read on the planner's grid, as before. The tests are `scripts/test-story-route.mts` (fixture worlds: an arch, a bed, a spiral, a plinth, a wall with
no door that must stay a cut). What the ladder does **not** do, on purpose: cross a wall (a room with no door is a cut), open a closed garage door, climb exterior steps (an entry above 0.9 m is a cut),
walk the lot past a closed gate, or raise the 24 m cap. Those are the house's or the story's: record them (spline.md, "Fixing a failing home").

## Reading a lock

`content/families/<slug>.bake.json`, one line per beat or segment:

| Key | What |
|---|---|
| `specSha`, `worldSha`, `rolesSha`, `anchorsSha`, `voiceSha` | what the lock was made from. Spec bytes; the plan.json world digest; the whole roles table; the story's beats, anchors, camera hints, flags and word counts; the voice clips' hashes and durations (null when estimated). `story:bake --check` recomputes them and says which moved. |
| `durations` | `voice` or `estimated` |
| `poses` | per beat: `eye`, `target`, `fov` (16:9), `level` (null outside), `tier`, `resolved` = the role, the spec type and how many fallbacks deep it answered |
| `timeline` | `beats` (`t0`, `t1`, `travel` = the walk-in inside the beat or null), `filmBeats`, `filmDuration`, `trackSha` |
| `track.segs` | the camera. `hold` = a beat at rest (the eye drifts a few centimetres toward the anchor); `move` = a walk (samples at 10 Hz); `ftue` = the first-run chapter |
| `track.beats` | per beat: the anchor's box, aim point, compose table, `rest` (the time it settles: reduced motion cuts to it) |
| `track.events` | `press` (the Core wakes), `cuts` |
| `track.film` | the parts of the tour the film plays, where each lands in the film |
| `track.stats` | the fastest the look turns (degrees a second), cuts, walks, notes |

A re-bake of an unchanged tree writes the same bytes.

## Reviewing the contact sheet (a human, per family)

`--stills <dir>` renders every beat's rest frame through the stock offline path (`__houseRenderBegin` and `__houseRenderFrames`, one GPU process, the same frames a film is made of) at 16:9 and 9:16 into `<dir>/<slug>/<beat>.<aspect>.jpg`, and a sheet `<dir>/<slug>.<aspect>.sheet.jpg`. Each tile is outlined: green is the anchor, dashed green the anchor grown 12%, orange the Core, blue where the popup card would sit (the real placer, a typical card size). Flags in red: `CARD OVERLAPS`, `PHONE CROP` (the narrow frame cannot hold all of the anchor), `tier 1` or `tier 2`, `aerial`.

Look for, in this order:

1. **Is the anchor the thing the beat is about?** A fallback that landed on a counter instead of a range reads in the tile's second line (`range/counter-run (fallback 1)`). Reword the beat or pick a different fallback in the story, not a coordinate.
2. **Cropped.** Any edge of the green box on or past a frame edge.
3. **Faces scenery.** A garden or deck beat whose background is the lot's edge, a fence, a neighbour's tree, instead of the house.
4. **Looks into a wall.** A tile that is mostly one flat colour. The solver rejects a wall plane over half the frame within 1.5 m, so this means a window or a curtain; say so in the notes.
5. **The same shot twice.** Two beats on one anchor should differ in distance or bearing.
6. **The card.** Blue never on the green box; never on an orange one.
7. **The phone tile** (9:16): the anchor above the lower third, where the sheet goes.

A finding is a fix in the story (another anchor, a fallback, a `camera` hint: `framing`, `from`, `side`, `eye`) or, if the solver is wrong everywhere, in `poses.ts`. Never a hand-written coordinate: a lock is regenerated, not edited.

**The camera gate.** `pnpm run story:spline` grades every lock automatically (a lost anchor, tiers, the fastest look turn, cuts, walks, clearances, the anchor's size, the pieces the casting keeps out of frame such as the crib, the exterior bookends) and `pnpm run story:spline:sheets -- <slug>` makes the sheets of this section for several families into one review page; `--stills` takes `--gl default|software` (`BAKE_GL`), the GPU through ANGLE or SwiftShader, as the ad-cut renderer does. A film is rendered only from a family that passes both: [spline.md](spline.md).

## Adding a role (a showrunner decision)

The role names are a contract: `ROLE_IDS` in `assets/story/types.ts`, the schema's enum and the keys of `content/story/roles.json`. A new role needs all three, in one commit with the validator's owner, and then:

1. `items[<role>]` (spec item types, preference order) or `zones[<role>]` (spec lot types) in `roles.json`, with `siteItems`, `zoneRooms` and `home` (the room kinds it lives in, most at home first) where they apply.
2. A line in `casting.json` per house (`roles[<role>]`: how many it has) from `pnpm run story:bake`'s counts, and `eyelessAnchors` for houses where the solver cannot frame it.
3. `scripts/test-story-bake.mts` already asserts that every role in `ROLE_IDS` is in `roles.json` and the reverse.

A new TYPE for an existing role is not a showrunner decision: add it to the list in `roles.json`, re-bake (every lock's `rolesSha` moves, so all go stale on purpose).

## Known limits

* Poses are checked against the digest the planner reads (boxes, no meshes). A pose that clears the digest can still stand a few centimetres inside a plant or a curtain: the contact sheet is the check.
* A closed door leaf is not in the digest (the planner opens leaves ahead of the eye). A pose that looks through a doorway with a closed leaf sees the leaf. Only five houses have a closed leaf; interior leaves are open.
* The Core's set (desk, monitor) is the Core's frame; a phone frame holds the Core and 0.3 m around it, not always the whole desk (`partial`).
* The planner's first-run film is the Core's: its composition and lens are the planner's. A beat's own `camera` hints do not apply to the FTUE chapter.
