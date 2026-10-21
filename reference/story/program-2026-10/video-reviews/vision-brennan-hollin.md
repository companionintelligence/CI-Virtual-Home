# Vision review: brennan-hollin (house bgfamily)

> **Status: record of the 2026-10 video and camera work, historical.** A reviewer's read of the contact sheets of the second Brennan tour. Read it against `reference/story/film.md`, `bake.md` and `ads.md`, which are the contracts on main. Directories in angle brackets (`<scratch>`) stand for the author's local ones; the sheets and reports it names were not kept.

Fresh sheets: <scratch>/video/sheets-brennan-hollin/ (16x9 and 9x16 sheet and strip, per-beat stills in brennan-hollin/, report in brennan-hollin.report.json).
Report: 0 fail, 3 warn (never-framed toddler bed: ftue-delivery at rest, and on the walks to living-session and front-run). 26 beats, 2 cuts (study-code 31 m, outro-street 40 m), look 54.8 deg/s.
Keep-out for this family: the Study has a toddler bed (a teddy bear sits in it), the Kids Room a crib and a rocking horse; sleeping is never told.

Verdict: FIX (no BLOCKER, 10 MAJOR, several MINOR). The vision review found more than the report: the report is green on all of the MAJORs below.

Note on light: every exterior frame (front-run, front-camera, front-car, back-tracker, outro-street) is rendered at the house's own dusk (pink sky, near-black lawn and road). Interiors are well lit, no window is blown out and no room is black. If the film renders with `?lighting=day` (ADS.md) the exteriors will be brighter than these sheets; judge the exterior MAJORs below on composition, not on brightness.

## Per beat

| # | beat | 16:9 | 9:16 | walk (strip) |
|---|---|---|---|---|
| 1 | ftue-delivery | MAJOR: the rest frame is the living room seen from 12 m; the front door (the anchor) is a sliver at the far right edge, and the toddler bed with its teddy bear sits at the left edge (the report's warn) | MAJOR: the anchor door is not in the rest frame at all; on the walk, frame 7 holds the toddler bed and teddy bear large and centred (never-framed) | walk in is good: house from the street, porch, hall, living room. It then runs on into the Study past the toddler bed |
| 2 | ftue-unbox | ok: Core small but clear, card slot clear | ok | static, near twin of ftue-pick and ftue-hello |
| 3 | ftue-plug-in | ok: close, ring and wake legible | ok | smooth push in |
| 4 | ftue-join | ok (fov 66, a little wide, monitor text cropped, acceptable) | ok | ok |
| 5 | ftue-pick | MINOR: same pose as ftue-unbox (d 4.87, fov 54, left) | ok | static |
| 6 | ftue-hello | MINOR: same pose as ftue-unbox and ftue-pick | ok | static |
| 7 | living-session | MINOR: a door jamb fills the right 15 percent of the frame (camera stands in the doorway) and the TV is small at the left | ok | walk through two doorways is a walk, not a lurch |
| 8 | living-blocks | ok: sectional and coffee table well framed | MAJOR: the bottom 12 to 15 percent of every rest frame is a black band (a dark piece of furniture next to the lens); the 16:9 tile shows the same black wedge at the bottom edge | ok |
| 9 | lounge-poster | ok: nesting tables and two chairs, card clear | ok: tables just above the card slot | MAJOR in 16:9: frame 4 is a blank white wall with a sink edge, the lens against a wall mid turn (the 9:16 walk is fine) |
| 10 | kids-notes | MAJOR: pixel-identical to lounge-poster (same anchor, same hints): same shot twice | MAJOR: identical to lounge-poster | no move at all |
| 11 | kitchen-calendar | ok: fridge whole, glare on its left face is soft | ok | ok |
| 12 | kitchen-demo | ok: range small but clear, card over the counters | ok | ok |
| 13 | office-desks | MINOR: fov 62 stretches the shelf at the right edge, floor is 40 percent of the frame | ok | MINOR: frame 2 looks straight down the stairwell rails (pitch tips down a flight) |
| 14 | office-follow | MAJOR: a floor lamp shade, a big plant and an armchair back fill the centre and lower left; the anchor (vanity desk) is small at the right edge | ok: vanity desk centred | ok |
| 15 | office-intake | MINOR: d 1.9, lens very close, the same white desk as office-desks from the same side | ok | ok |
| 16 | office-renewals | MAJOR: a plant's leaves hang right in front of the lens (left third) with the lamp and an armchair; the bookshelf is readable but the view is cluttered | MINOR: an armchair back takes the lower right | ok |
| 17 | kids-photos | ok: clean, well lit (same vanity anchor as office-follow) | ok | ok |
| 18 | study-code | MAJOR: the Core is not visible (hidden behind chair and monitor); the half wall and the living-room TV fill the lower right | MAJOR: no Core, half wall fills the right third | ok, but 31 m cut in |
| 19 | study-quill | MAJOR: near twin of study-code, Core is a few pixels | MAJOR: same, the two beats are the same picture | none |
| 20 | study-board | MINOR: the shelf is behind the half wall and the TV, a third study shot from the same side | MINOR: half wall and TV take 60 percent of the frame, shelf small at the top | ok |
| 21 | dining-quiz | MINOR: the table is cropped at the left edge, chairs dominate, a globe lamp is blown white | MINOR: blown lamp globes, a red stool cropped at the bottom | ok |
| 22 | front-run | MAJOR: the door (the anchor) is about 4 percent of the width, half hidden behind the car and a topiary, a big tree takes the left | MAJOR: the door is cut by the right edge, the car fills the lower left | MINOR: leaves the house, looks along the road away from the house (frame 3), a garden light blows out at the lens (frame 4), then swings back |
| 23 | front-camera | MINOR: the anchor shrub is 30 px wide, the black road is 40 percent of the frame | MINOR: black road takes the lower 45 percent, shrub is fine | MINOR: frame 2 looks down the street away from the house |
| 24 | front-car | MINOR: car readable, a mailbox post stands next to the lens at the bottom left, black road at the right | ok | MAJOR: frames 2 and 3 look straight down the road away from the house (about 150 degree swing, street lamp and bollards in view) and then swing back |
| 25 | back-tracker | MAJOR: the deck is a sliver at the right edge, 12 m away behind the white fence, 70 percent of the frame is dark lawn, no pool, no sense of a seat | MAJOR: the deck is a thin strip above the card slot, lawn and trees dominate | walk goes round the side of the house on the lawn and lands on this dark view |
| 26 | outro-street | MAJOR: a street lamp head hangs in the right centre of the frame and covers the willow; the house is pushed to the left third and cropped at the left edge; the move is a cut to eight identical frames (no move, no aerial pull) | ok: house well framed, the lamp is only an edge sliver | cut, static |

## Defects and the smallest fixes

- ftue-delivery: the toddler bed. Hint: `camera.side: "right"` and `camera.framing: "medium"` (the door as the subject, from the front, so the camera is not turning back toward the Study). The Study's toddler bed is on the planner's walk to the Core, so also a note for the geometry stream (the first-run chapter is the planner's film).
- kids-notes: `camera: { "framing": "medium", "side": "right" }` (or `from: "right"`), so it differs from lounge-poster in bearing and distance.
- living-blocks: `camera.from: "right"` (or `framing: "wide"`) to step off the dark piece at the lens.
- lounge-poster: try `camera.from: "right"`; if the white wall frame stays in the 16:9 walk, a note for the geometry stream.
- office-follow: `camera: { "framing": "close", "side": "left" }`, and give kids-photos (same vanity desk) `camera.side: "right"` so the pair are not a repeat.
- office-renewals: `camera.side: "left"` (or `from: "front"`), to look at the shelf from beyond the plant.
- study-code: `camera: { "framing": "close", "side": "right" }` (the Core is hidden from the left); study-quill: `camera: { "framing": "medium", "from": "front" }`; study-board: `camera.side: "right"`. The aim is three different views of the Study that do not all shoot across the half wall and the living-room TV.
- back-tracker: `camera: { "framing": "close", "side": "right" }`; if the fence still blocks it, `anchor.role` pool (already first fallback) and a note for the geometry stream (closed fence, no gate to the garden).
- front-run: `camera.framing: "medium"`, `camera.side: "left"` (the car is on the right of the door).
- front-car: `camera.from: "front"` so the walk arrives facing the house; `camera.side: "right"`.
- outro-street: `camera: { "framing": "wide", "from": "front", "side": "left" }` (or `"right"`) to move off the lamp head and centre the house; keep `eye: aerial`.
- front-camera (MINOR): `camera.framing: "medium"`.
- dining-quiz (MINOR): `camera.framing: "wide"`.
- living-session (MINOR): `camera.framing: "medium"`.
- ftue-pick and ftue-hello (MINOR): `camera.side: "right"` on one of them.
