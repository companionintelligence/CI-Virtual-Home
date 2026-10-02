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
4. **Pose to walk** (`route.ts`). From one beat's rest eye to the next: a leg on the storey's grid (A*, string-pulled, corners rounded by the planner's fillet), a chain of flights between storeys, through the entry door in or out. No route, an entry above the ground, or a walk over 24 m is a **cut**: the new beat starts at its pose and `events.cuts` lists the time, for the player or the film to cross-fade.
5. **Time** (`track.ts`, `runtime.ts`). A beat lasts `max(voice starts + speech + 0.6 s, popup reading time at 200 words a minute, minSeconds, walk + 1.2 s at rest)`. The voice starts 0.25 s into a beat, or, after a long walk, 1.5 s before the camera arrives. Speech is the voice lock's real durations, or an estimate (150 words a minute) the lock marks.
6. **First run.** The FTUE chapter plays the planner's own door-to-core track (the establishing move, the walk to the Core's room, the hero ring and the orbit), time-warped so each beat holds the part of the film that tells it: delivery is the walk in, unbox the arrival in the Core's room, plug-in the hero ring (the Core wakes during it: `events.press`), join, pick and hello the orbit in thirds. The planner's closing push-in is dropped.

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
