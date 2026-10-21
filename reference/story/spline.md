# The camera spline gate

A family's camera is the track its bake lock holds ([bake.md](bake.md)): holds (a beat at rest), moves (the walk to the next beat) and the first-run chapter. The tour plays it, the film
([film.md](film.md)) and the ad cuts ([ads.md](ads.md)) play parts of it. The bake says when it cannot make a camera at all (a lost anchor); it does not say whether the camera it made is
**good**. The spline gate does, for every home, before a film is rendered: an automatic report from the lock (`story:spline`) and a set of contact sheets and film strips for a person
(or a vision-capable reviewer) to look at (`story:spline:sheets`).

```bash
pnpm run build                                                  # the page modules the report reads (assets/**/*.ts -> .js)
pnpm run story:spline                                           # every family, a table on stdout
pnpm run story:spline -- brennan brennan-hollin                 # these families
pnpm run story:spline -- --all --json fleet.json --md fleet.md  # the fleet as JSON and as a markdown table, worst homes first
pnpm run story:spline -- <slug> --strict                        # exit 1 when the family has a failing defect (what a film render asks first)
pnpm run story:spline:sheets -- brennan --out video/sheets      # bake + stills + strips (one GPU process, one family at a time), then <out>/index.html
pnpm run story:spline:sheets -- brennan --res 540 --strip 8 --gl default
pnpm run story:spline:sheets -- brennan --no-render             # rebuild index.html from the sheets already in <out>
pnpm run test:node                                              # includes scripts/test-spline-report.mts (no GPU)
```

`story:spline` needs no browser and no GPU: it reads `content/families/<slug>.json`, `<slug>.bake.json`, the house's spec and `plan.json`, `content/story/casting.json` and `roles.json`, and uses
the repo's own functions for everything geometric (`trackFrameAt`, the solver's clearance grid, the projection and the sight lines in `assets/shot-*.ts`). A run over the thirty families takes
seconds, and the same tree gives the same report byte for byte. `--dir`, `--houses`, `--casting` and `--roles` point it at other inputs (the tests use a temp dir).

## The rules

Each rule gives a **defect**: a severity, the rule, the beat id and a sentence. `fail` stops a film from rendering (a family with one is not good yet); `warn` is for a human to look at on the
sheet. The thresholds are the object `T` at the top of `scripts/story/spline-report.mts`, printed with every report (the markdown has a Thresholds table; the JSON has `thresholds`).

| Rule | Severity | What it checks | Threshold and why |
|---|---|---|---|
| `lock-missing`, `lock-stale` | fail | there is a lock, and it is made from this story, house, roles and voice (`staleReasons`, the same shas `story:bake --check` uses; the lock's beats are the story's beats) | a report on a stale lock grades a camera nobody will see |
| `anchor-lost` | fail | every beat has a pose and its track frame is not `none` | the bake refuses to write a lock with a lost anchor; this catches a hand-edited or old one |
| `pose-tier` | fail | every pose is tier 0 or 1 | tier 2 is the solver's last resort (0.22 m from a wall, 0.12 m from furniture, a looser sight line): the camera is jammed in |
| `fallback`, `fallback-share` | warn, fail | a beat whose anchor was answered by a fallback (it shows `counter`, not `fridge`); too many of them | warn per beat; warn over 35 percent of the tour, fail over 60 percent: the story asks for things this house does not have |
| `look-rate` | warn, fail | the fastest the look turns (yaw) or tilts (pitch), degrees a second over 0.1 s, measured over the whole track at 16:9, square and 9:16 | the tour's own limit is `YAW_RATE_CAP` = 55 (`assets/story/track.ts`; the test keeps the two equal). Over 55 warns, over 57.75 (a 5 percent margin: the gate measures all three frames, the bake measures the walks at its own) fails. A cut is not a turn |
| `cuts`, `cut-reason` | fail, warn | at most 3 cuts in a tour; each cut named with its reason (`route is 45 m`, `the entry is above the ground`, `no walkable leg on l1`); a cut because the camera cannot walk there is also a note | a cut is a crossfade where a walk should be: three is the entry, the long way round to the street and one more; more means the house's rooms are not connected for the camera |
| `walk-long` | fail, warn | no move whose path is longer than the cut threshold (24 m, `MAX_ROUTE_M`, plus half a metre); a warning for a walk that takes over 30 s on screen | a longer walk is a cut in the bake: finding one means the lock is old or edited |
| `eye-clearance` | fail | the rest eye is clear of walls and furniture by its own tier's clearance (0.42 / 0.32, 0.30 / 0.20); the dwell's drift and every sample of a walk by 0.15 / 0.03 m, the walker's last tier less 3 cm; read off the same 0.2 m grid the solver and the walker use | catches a lock made for a house that has since been re-laid, and a walk that clips a corner. A flight of stairs (within 0.5 m of its plan box) and the front door (within 1.2 m of it) are the walker's own lines and are not checked |
| `anchor-size` | fail, warn | the anchor's longest side, in pixels of a film frame at the 1080 px short edge, at rest, in 16:9, square and 9:16 | at least 2 times the type floor (`CANVAS_TYPE_MIN` 36 px: 72 px, two lines of card type) or it is a speck; a warning under 4 times (144 px). Not checked for the first-run chapter (the planner's film), the house from the street, the front door or a room (it is framed by what is in it) |
| `anchor-frame` | fail, warn | more than 12 percent of the anchor's projected box outside the frame, or the lens inside its box | a `partial` anchor (the bake says a narrow frame holds only the essential part) is a warning |
| `never-framed` | fail, warn | no pieces the casting keeps out of frame (below) in any film frame at the beat's rest pose, 16:9, square and 9:16: their box takes at least 0.2 percent of the frame and a sight line to it is clear. A piece that only crosses the frame during a walk is `never-framed-walk` (warn) | the crib in the Kids Room of bgfamily is the known case: with the committed `brennan-hollin.json` it passes; with `kids-notes` and `kids-photos` anchored on the desk in the Kids Room (their anchors before the fix) it fails on both. In the first-run chapter it is a warning: the planner's camera has no hint a story can change, so it is a note for the geometry stream |
| `never-stage` | fail | no beat's anchor in a room the casting says is never a stage ("the Nursery is a spare room and is never a stage") | a room, not a piece: the rocking horse in a child's room is another matter |
| `exterior-first`, `exterior-last` | fail, warn | the eye is outdoors in the tour's first second and last second (the exterior move: the approach to the front door, and the street at the end); the eye goes indoors after the film's 4 s title card | the film opens on the tour's first seconds under its title card and closes on the same move played backwards |

**What the casting keeps out of frame.** `casting.json` records it in words (a family's `reason`, `fitNote`, `household_text`, `care`), and `neverFramedPieces` reads them: "never frame a crib or a
toddler bed", "no beat frames a rocking horse" (those pieces); "sleeping is not told", "never shown asleep" (every bed); and, if the casting ever carries it, an explicit `neverFramed: ["crib",
"room:Nursery"]` on the family's entry (spec types, or every piece in a room). To keep a piece out of a home's films, say so in `cast-plan.json` (`reason` or `fitNote`) and run `pnpm run story:cast`.

### How the thresholds were set

The three Brennan tours were reviewed and accepted by people; the gate had to pass them, and it does, with these calibrations of its first draft:

* the look-rate warning at 95 percent of the cap was dropped (the bake aims at the cap, so 19 of 30 families warned; brennan-hollin's fastest turn is 54.8): warn at the cap, fail 5 percent over it;
* the anchor size floor was 3 and 5 times the type floor; the accepted Brennan Core beats are 76 to 91 px (`kitchen-board`, `office-week`), so it is 2 and 4 times;
* a room anchor is not projected (the camera stands inside its box: every corner is "behind the lens");
* the eye checks leave out a flight and its foot, and the front door (the grid counts a flight's footprint as a wall);
* a never-framed piece seen in the first-run chapter is a warning, and "the Nursery is never a stage" is the rule about beats in the room, not about the room's furniture being visible.

The first run over the thirty families found the fleet's real faults: cuts (`no walkable leg`: the camera cannot walk between two rooms of the house), one tier 2 pose, and nothing else failing.
Most of those cuts were the router's, not the houses': six homes failed `cuts` because the planner's grid took the digest's boxes for walls (an arch's bounding box, a bed's hull, a spiral's blocked
footprint, a plinth). `route.ts` now has a rescue ladder for them (bake.md), the fleet went from 11 pass and 6 fail to 13 pass and 2 fail, and the 24 families that passed kept their bytes.
`eye-clearance` reads the samples of a walk the router rescued on the better of the planner's grid and the walker's (`clearanceAt(..., rung)`, the rung from asking `routeBetween` again): a walk through an arched door is read at its jambs, not at the arch's bounding box. A walk the planner's grid made is read on the planner's grid, so the rescue loosens the gate for no other walk.
That is the kind of finding the gate exists for; the thresholds were not set to hide any of them.

## Reading the report

`--json` writes `{ v, thresholds, totals, families: [...] }`; each family: `slug`, `house` (internal: never on a public surface), `status` (`pass`, `warn`, `fail`), `fails`, `warns`, `stats`
(beats, film beats, tour and film seconds, tiers `[0, 1, 2]`, fallbacks, cuts and their reasons, the fastest look yaw and pitch, the bake's own yaw, aerial poses, durations) and `defects`
(`{ rule, beat, sev, msg, value }`). Families are ordered worst first: most failing defects, then most warnings, then name. `--md` writes the same as a markdown fleet table (one row a family,
with the first failing rule and its beat) and a section per family with every defect.

Read a fail first, and its beat id second: the beat id is in the story (`content/families/<slug>.json`), in the lock (`poses`, `track.beats`, `timeline.beats`) and on the contact sheet tile
(`7. office-split`).

## The contact sheets

`story:spline:sheets -- <slug> ...` runs, for each family in turn (one GPU process at a time, `--gl default`, the machine's own GPU through ANGLE; `--gl software` or `BAKE_GL=software` is the
repo's SwiftShader, hours a family), `story:bake -- <slug> --stills <out> --strip 8 --res 540 --gl default`, grades the lock the bake wrote and writes `<out>/index.html`.

```
<out>/index.html                        the review page: per family the sheets and strips (16:9 and 9:16), the report's defects and the beat list with ids, tiers and times
<out>/<slug>.16x9.sheet.jpg  <slug>.9x16.sheet.jpg   one tile per beat, at its rest frame
<out>/<slug>.16x9.strip.jpg  <slug>.9x16.strip.jpg   a row per beat, 8 frames across it (its walk and its rest): the camera's move
<out>/<slug>/<beat>.<aspect>.jpg        each beat's rest frame on its own
<out>/<slug>.report.json                the family's report
```

A tile is outlined: green is the anchor, dashed green the anchor grown 12 percent, orange the Core, blue where the popup card would sit (the real placer). Red flags: `CARD OVERLAPS`, `PHONE CROP`,
`tier 1` or `tier 2`, `aerial`. The second line of a tile is what the camera got: `role/type`, `(fallback n)`, the distance and the lens. The page says when the bake changed a family's lock file
(it writes the lock; an unchanged tree gives the same bytes), and marks a family whose bake lost an anchor.

## Fixing a failing home

Fix the story or, when the cause is the house, record it. Never a coordinate: a lock is regenerated, not edited. After any change: `pnpm run story:validate -- <slug>`, `pnpm run story:bake -- <slug>`,
`pnpm run story:spline -- <slug>`, and sheets for a look.

| Defect | What to do |
|---|---|
| `anchor-lost`, `fallback`, `fallback-share` | the role does not exist in this house, or the instance asked for (`nth`) does not. Pick a role the house has (`casting.json`'s `roles` counts, `content/story/roles.json`), put the best fallback first, use `room` to narrow, or `nth` to pick another one |
| `pose-tier` | the thing is hard to stand in front of: give the beat a wider `camera.framing`, another `camera.from` (`front`, `left`, `right`, `behind`) or `eye` (`seated`, `low`), or another anchor in the room |
| `look-rate` | two beats far apart in bearing: reorder the chapters so neighbours are neighbours, or give a beat a `camera.from` that faces the way the walk arrives |
| `cuts`, `cut-reason`, `walk-long` | reorder the beats of a chapter so a walk is short (living, kitchen, dining, then upstairs, then outside); fewer cuts than three is the aim. `no walkable leg`, `no flights connect the storeys`: the camera cannot walk there. Before blaming the house, know that the router has a rescue ladder ([bake.md](bake.md), "The rescue ladder"): an arched doorway, a spiral stair, a bed across a room, an entry on a plinth are walked, not cut. What still stops a walk is a **wall with no door** (a sealed garage), furniture that fills a passage (a 1.5 m plant in a 0.7 m landing corridor), a **closed gate** across the lot, an entry up exterior steps, or a walk over 24 m (a four-storey home whose beats go from the loft to the garage). **Record it for the geometry stream**: a line in the family's `notes` (the beat, the rule and the home) and the report row |
| `eye-clearance` | the lock is for another version of the house: re-bake. If it still fails on a fresh bake, the planner's grid and the solver disagree: a note for the geometry stream |
| `anchor-size`, `anchor-frame` | `camera.framing: "close"` for a small thing, `"wide"` for one that does not fit, `side` to move it off the popup; a Core beat is small by nature (76 px is the least the accepted tours show) |
| `never-framed` | move the beat to a `room` with another anchor, a `camera.from` that looks away from the piece, or another `nth`. The two Brennan beats were moved out of the Kids Room. In the first-run chapter: record it for the geometry stream (the hero's room) |
| `never-stage` | the anchor is in a room the casting keeps out of the story: pick another room |
| `lock-stale` | `pnpm run story:bake -- <slug>` |

## The vision review

The report cannot see. After a family passes it, someone with eyes (a person, or a reviewer that can read images) looks at its sheets and writes down defects with the beat id. A home passes when
the report passes and the review finds nothing, and its report and sheets are kept (`--out` somewhere durable, the index and `<slug>.report.json`).

Procedure: open `index.html`; for each family read the 16:9 sheet tile by tile, then the 9:16 sheet, then the strips; list every defect as `beat id, what, which frame`; a fixer changes the story (the
table above), re-bakes and re-renders the sheets; a second reviewer confirms on the new sheets. Do not review a family whose text is about to be rewritten: a rewrite changes its camera.

What to look for, in this order:

1. **The wrong thing.** Is the green box the thing the popup is about? A `(fallback 1)` in the tile's second line, a counter where the story says range, a bed where it says desk.
2. **Something that must not be in frame.** A crib, a toddler bed, an unmade bed, a rocking horse, a toilet, a person's papers. The casting's keep-out pieces are checked by the report; the sheet finds the rest.
3. **Clipping.** An edge of the frame inside a wall, a door leaf, a plant or a lamp shade; the eye so near a surface that one flat colour fills the tile (a curtain or a window).
4. **A blocked view.** The anchor behind a pillar, a half wall, a door frame or a stair rail; the green box on something that is not what the picture shows.
5. **Windows.** A blown-out window taking a third of the frame; the 9:16 tile especially.
6. **The anchor's place.** Cropped (any edge of the green box on or past a frame edge), too small to read, or under the blue card; in 9:16 above the lower third.
7. **Turns and walks (the strip).** A row whose first frame and last frame look in nearly opposite directions with nothing between (a whip), a walk that stares at a wall, one that looks at the floor, a pitch that
   tips down a flight of stairs without looking at it. Eight frames across a beat show it.
8. **A jump cut that reads as a mistake.** A cut (the report lists them) between two views of one room, or one that lands somewhere that is not the next beat's room.
9. **The same shot twice.** Two beats on one anchor that differ in neither distance nor bearing.
10. **The ends.** The first frame of the first row (the front door from the street) and the last (the house from the air): is the house in them, and is the sky not a blank band.

A defect is `beat id`, the frame (16:9 or 9:16), what is wrong, and either the change to try (a hint, a role, a fallback) or "geometry stream: <what the house does>".

## Limits

The report checks the camera against the plan's boxes (the digest), not meshes: a pose that clears the digest can stand a few centimetres inside a plant or a curtain, which only the sheet shows. A closed
door leaf is not in the digest (only five homes have one). The first-run chapter is the planner's film: its composition and lens are the planner's, so the size and crop rules skip it and a keep-out
piece in it is a warning. The gate does not judge the words, the card or the voice: those are the validator's, the placer's and the film's own gates.
