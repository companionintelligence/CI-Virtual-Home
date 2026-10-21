# Vision review: brennan-merrow (house familyhouse-nora)

> **Status: record of the 2026-10 video and camera work, historical.** A reviewer's read of the contact sheets of the third Brennan tour. Read it against `reference/story/film.md`, `bake.md` and `ads.md`, which are the contracts on main. Directories in angle brackets (`<scratch>`) stand for the author's local ones; the sheets and reports it names were not kept.

Sheets: <scratch>/video/sheets-brennan-merrow (16:9 and 9:16 sheets and strips, per-beat stills in brennan-merrow/)
Report: <scratch>/video/sheets-brennan-merrow/brennan-merrow.report.json (0 fail, 3 warn: kitchen-board anchor size at 16:9, 1:1, 9:16)
Fresh sheets on the final tracks: 28 beats, tiers 28/0/0, 1 cut (garden-lavender), look 53 deg/s.
Casting: no crib in this house (crib 0, bed 3: the Kids Bedroom has two made single beds shared by Steve and Jean). Roles `kids` also match the l0 Playroom (toys 3).
Caveat: the sheets are lit by the house's own preset (`dusk`, sun bearing 235), so the outro sky and the garden are dusk-toned here. The tour and the ads open in daylight (CLAUDE.md), so the pink sky and the dim garden are not judged as defects; re-check them in the daylight render.

Verdict: FIX (no BLOCKER; 7 MAJOR groups below).

## Per beat

| # | beat | verdict | what is wrong / smallest fix |
|---|------|---------|------------------------------|
| 1 | ftue-delivery | MINOR | Opening move reads well (roof, stoop stairs, door, loggia, kitchen). Rest frame is the door jamb with brick filling about 40 percent and no anchor box (the door is small); frame 4 of the strip swings to the street. Hint: none needed, optionally `camera.from: "front"` kept and `framing: "wide"` kept; only check the daylight render. |
| 2 | ftue-unbox | MINOR | Core is small (about 45 px at 16:9) next to a very bright globe lamp; the card slot covers the counter. Same view as ftue-join (see 4). Hint: `camera.framing: "close"` is taken by plug-in, so use `camera.side: "left"`. |
| 3 | ftue-plug-in | ok | Close on the Core, ring visible, lamp bulb not near the lens. d=0.93 is tight but fine. |
| 4 | ftue-join | MINOR | Almost the same rest frame as ftue-unbox (d 1.77 vs 1.79) and the strip is an orbit with little change. Hint: `camera.from: "right"` (or side right to left) so the five Core beats do not repeat a spot. |
| 5 | ftue-pick | ok | Core upright, whiteboard behind, card slot on the counter front. |
| 6 | ftue-hello | ok | Core is lit and bright but not clipped to a flat white block; fine. |
| 7 | kitchen-board | MAJOR | The Core is 81 px across at 16:9 (137 at 9:16) and the report warns on all aspects. The subject (the planner twin, whiteboard and Core) is a small glow in a wide kitchen; the floor is 40 to 45 percent of the 9:16 frame. Hint: `camera.framing: "close"`, drop `from: "left"` (use `from: "front"`, `side: "left"` as ftue-pick does so the whiteboard stays in frame). |
| 8 | kitchen-hood | ok | Hood large and centred, plain wall for the card at 16:9; the 9:16 card sits on the stove, not the hood. Camera looks slightly up, acceptable. |
| 9 | kitchen-vocab | MINOR | The anchor is the glass dining table: it is nearly invisible, so the beat reads as two chair backs and a lot of floor (9:16 bottom half is empty tile). Hint: `camera.framing: "close"` or change the anchor to `{"role":"counter"}`. |
| 10 | living-dns | MINOR | Couch, coffee table and the lavender window are well framed. 9:16: a chair or ottoman edge cuts the bottom-left corner and the rug fills a third of the frame. Hint: `camera.side: "left"` or `framing: "close"`. |
| 11 | kids-headphones | MINOR | Bed (made) is the anchor of a Steve music beat, in a shared teen room; the walk in has a door leaf filling the frame for about one strip frame. Not a private unmade bed, so acceptable. Hint (optional): anchor the dresser or bookshelf instead of the bed. |
| 12 | kids-clip | ok | Desk, lamp, chair framed; window dark but not black. |
| 13 | kids-floorplan | MINOR | The made bed fills the lower third of the 16:9 frame and a quarter of the 9:16 one, the desk is far and small (this is the same room for the fourth beat in a row). Hint: `camera.from: "left"` (or `"behind"`). |
| 14 | kids-spellbook | ok | Low bookshelf by the window, bed corner low; window black at the top but acceptable. Note: the strip shows the same room as the last four beats. |
| 15 | kids-reader | MAJOR | `bookshelf @kids nth 0` resolves to the l0 Playroom (green carpet, road play-mat, rocking horse, toy shelf), the wrong room for 14-year-old Jean reading ebooks, and the walk in is long (down the open stair, through the den past the drum kit). Hint: anchor `{"role":"bookshelf","room":"kids","nth":1,"fallback":[{"role":"desk","room":"kids"}]}` (the other shelf of the Kids Bedroom; check on the next sheet that nth 1 is on l1), with `camera.side: "left"`. |
| 16 | office-notes | MINOR | Desk seen from the doorway, with the door leaf and jamb taking 15 percent at the left; this exact eye (1.2, 1.5, -4.6) is reused by office-newsletter. Fine on its own; keep this one and change newsletter. |
| 17 | office-draft | MAJOR | Strip: the camera leaves the office through the door (the dark garage visible through the doorway), shows a blank wall frame, then re-enters (passing the same doorway twice), and rests about 5 m away, a small desk beside a big empty wall; 16:9 desk is about 90 px. Hint: `camera.from: "left"` and `camera.framing: "close"` (it is `medium` with no `from`), so it settles at the desk's side from inside the room. |
| 18 | office-vault | ok | Desk from the right, frosted glass door at the left, good. |
| 19 | office-invoice | ok | Ladder shelf tall and clear at 9:16; at 16:9 the desk is cut at the left edge but is not the anchor. |
| 20 | office-newsletter | MAJOR | Same camera eye as office-notes ([1.2, 1.5, -4.6]) and the same desk position, with a brown door leaf covering a quarter of the frame and the open stair beside it (blocks the view, repeats the shot). Hint: `camera.from: "behind"` (the 16:9 card sits on the door leaf), or `framing: "medium"` with `from: "right"` and move office-vault to `from: "front"`. |
| 21 | garage-code | MINOR | `room/room` anchor: the black overhead door fills the upper left and the card slot sits on it; the workbench is not in frame; floor and ceiling about 60 percent. Hint: `camera.from: "left"` does not help on a room anchor; turn the camera toward the workbench wall by anchoring `{"role":"bicycle"}` with fallback `room garage`. |
| 22 | garage-repos | MAJOR | Rest frame is the same as garage-errand and garage-backup (camera near (-0.8, 1.5, 5.4), looking at the workbench wall): the workbench, the one thing about John, is about 60 px tall and the floor is half of the 9:16 frame. Hint: anchor a real object, `{"role":"bicycle","fallback":[{"role":"room","room":"garage"}]}` with `framing: "close"`. |
| 23 | garage-errand | MAJOR | Third near-identical still of the garage in a row (repos, errand, backup); `from: behind`, `wide` made no difference on a `room` anchor. Hint: a different anchor object, or `framing: "close"` on `{"role":"laundry"}` or `{"role":"room","room":"laundry"}`; failing that, one of the three beats must take the bicycle, one the room and one the workbench side. |
| 24 | garage-backup | MAJOR | Same still as garage-errand (see 23). Hint: keep `room` here with `camera.from: "right"` and `framing: "close"` only after the two beats above use other anchors. |
| 25 | den-steam | MAJOR | A table lamp with a big shade sits about 1 m from the lens and covers the TV and sofa; at 9:16 the TV is a 90 px blue rectangle behind it and the side table fills the bottom. Hint: `camera.from: "front"` (the camera moves off the back of the sofa) and `framing: "medium"`. |
| 26 | den-take | ok | Drum kit large and clear, door leaf and glass doors in frame, not blown out. |
| 27 | garden-lavender | MINOR | Cut in (documented: "the entry is above the ground"). Flowers are clear but cropped at the top at 9:16, the frame is dim in the dusk preset and static for the whole beat. Hint: `camera.framing: "wide"` so the spikes stay in a 9:16 crop; re-check in daylight. |
| 28 | outro-street | MAJOR | Closing move: the strip leaves the garden, passes a dark neighbour facade close to the lens (frame 2), swings away from the house to look down the street for 3 to 4 of 8 frames, then returns, so the house is shown at the start and the last third only (the report notes "framed from the air", lookYaw 52.6). At 9:16 the house is wider than the frame (left and right cut). Hint: keep `eye: "aerial"` and `framing: "wide"`, change `from: "front"` to `from: "left"` (or `"right"`) so the arc stays on the house side and the facade is not passed; check that the house fits a 9:16 crop. |

## Cross-beat

- The five FTUE beats and the five office beats are the same spot with small changes; the kids room runs five beats; the garage three identical ones (rule i). Spread the hints as above.
- Rule g: no crib or toddler bed is framed. The beds in kids-headphones and kids-floorplan are made single beds of the two teens; the toy playroom is framed in kids-reader (fix above).
- Rule f: nothing is black or blown out in the dusk preset; the window in den-steam at the top left is nearly white (MINOR) and the kids-room windows are dark.
