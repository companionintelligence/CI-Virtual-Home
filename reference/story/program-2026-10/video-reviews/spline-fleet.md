# Camera spline report

> **Status: record of the 2026-10 video and camera work, historical.** The first fleet run of the camera spline report (30 families, 2026-10-20 15:07). Read it against `reference/story/film.md`, `bake.md` and `ads.md`, which are the contracts on main. Directories in angle brackets (`<scratch>`) stand for the author's local ones; the sheets and reports it names were not kept.

30 families: 11 pass, 13 with warnings only, 6 fail (6 failing defects, 54 warnings). Worst first. A film renders only from a family that passes (reference/story/spline.md).

| # | family | home | beats | tour s | film s | tiers 0/1/2 | fallbacks | cuts | look deg/s | fails | warns | first failing rule (beat) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | kovacs | mediterranean | 24 | 325.8 | 93.8 | 24/0/0 | 0 | 8 | 52.1 / 47.5 | 1 | 7 | cuts |
| 2 | adeniran | asymmetry | 24 | 319.3 | 101.1 | 24/0/0 | 0 | 7 | 53 / 25.9 | 1 | 5 | cuts |
| 3 | nguyen | modernhome-nora | 24 | 328.5 | 89.1 | 24/0/0 | 0 | 4 | 51 / 38.2 | 1 | 4 | cuts |
| 4 | dekker | onestory | 23 | 325.5 | 91.9 | 23/0/0 | 0 | 4 | 53.2 / 40.9 | 1 | 3 | cuts |
| 5 | quintero | cocoon | 24 | 360.6 | 87 | 23/0/1 | 0 | 2 | 53.8 / 37.6 | 1 | 2 | pose-tier (mateo-blocks) |
| 6 | tesfaye | mirage | 23 | 345.5 | 106.7 | 23/0/0 | 0 | 4 | 54.3 / 33.6 | 1 | 2 | cuts |
| 7 | hovsepian | bghouse-olcia | 22 | 322.5 | 99.5 | 19/3/0 | 3 | 2 | 54.6 / 24.6 | 0 | 4 | - |
| 8 | rahimi | modernhouse-nora | 23 | 330.6 | 94.1 | 23/0/0 | 2 | 3 | 53.9 / 27.5 | 0 | 4 | - |
| 9 | brennan | seraphine | 27 | 435.3 | 84.4 | 27/0/0 | 0 | 2 | 54.2 / 24.7 | 0 | 3 | - |
| 10 | brennan-hollin | bgfamily | 26 | 411.6 | 96 | 26/0/0 | 0 | 2 | 54.8 / 36.8 | 0 | 3 | - |
| 11 | brennan-merrow | familyhouse-nora | 28 | 451.8 | 89.2 | 28/0/0 | 0 | 1 | 52.6 / 25.1 | 0 | 3 | - |
| 12 | chaudhry | lakecabin | 23 | 307.6 | 90.8 | 23/0/0 | 1 | 3 | 54.6 / 26.3 | 0 | 2 | - |
| 13 | gill | valleyview | 23 | 329.8 | 87.6 | 23/0/0 | 0 | 3 | 51.4 / 24.5 | 0 | 2 | - |
| 14 | iyer | mesamariposa | 25 | 353.3 | 86.3 | 25/0/0 | 0 | 2 | 52.1 / 35.8 | 0 | 2 | - |
| 15 | salazar | payorote | 23 | 310.9 | 91.7 | 23/0/0 | 1 | 2 | 51.3 / 24.5 | 0 | 2 | - |
| 16 | tuala | flowerycottage | 22 | 300.6 | 91.4 | 22/0/0 | 0 | 2 | 55.1 / 35.2 | 0 | 2 | - |
| 17 | watanabe | riverbend | 23 | 355.3 | 98.7 | 23/0/0 | 0 | 3 | 51 / 27.7 | 0 | 2 | - |
| 18 | banerjee | palms | 23 | 307.1 | 92 | 23/0/0 | 0 | 2 | 54.7 / 22.9 | 0 | 1 | - |
| 19 | whitaker | familyhome | 24 | 341.1 | 89.2 | 24/0/0 | 1 | 3 | 49.9 / 24.3 | 0 | 1 | - |
| 20 | adler | sunnyhome | 24 | 379.2 | 117.4 | 24/0/0 | 0 | 2 | 51.3 / 27.4 | 0 | 0 | - |
| 21 | cardoso | starter18k | 22 | 296.9 | 93.1 | 22/0/0 | 0 | 2 | 52.6 / 23.5 | 0 | 0 | - |
| 22 | haddad | epiphany | 22 | 310.2 | 96.9 | 22/0/0 | 0 | 3 | 55 / 24 | 0 | 0 | - |
| 23 | halvorsen | aurora | 22 | 322 | 87.8 | 22/0/0 | 0 | 2 | 53.4 / 27.4 | 0 | 0 | - |
| 24 | hwang | palnknoll | 23 | 345 | 89.3 | 22/1/0 | 0 | 3 | 50.4 / 26.4 | 0 | 0 | - |
| 25 | jankowski | neweco | 23 | 334.8 | 97.2 | 23/0/0 | 0 | 3 | 51.6 / 22.4 | 0 | 0 | - |
| 26 | kamau | gardennook | 22 | 303.1 | 89.5 | 22/0/0 | 0 | 3 | 50.1 / 27.1 | 0 | 0 | - |
| 27 | mbatha | vanilla | 23 | 323.9 | 104.1 | 23/0/0 | 0 | 2 | 54.4 / 27.4 | 0 | 0 | - |
| 28 | moreau | modernhouse1 | 24 | 328.9 | 89.6 | 24/0/0 | 0 | 3 | 54 / 50.9 | 0 | 0 | - |
| 29 | nwachukwu | cutestarter | 22 | 328.6 | 89.7 | 22/0/0 | 0 | 2 | 53.2 / 37.7 | 0 | 0 | - |
| 30 | petrov | newcrest | 23 | 378.3 | 96.7 | 23/0/0 | 0 | 3 | 52.4 / 21.6 | 0 | 0 | - |

## Defects

### kovacs (mediterranean): 1 fail, 7 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | cuts | - | 8 cuts in one tour (at most 3): den-repos (no walkable leg on l1); tv-steam (no walkable leg on l1); tv-films (no walkable leg on l1); tv-photos (no walkable leg on l1); west-kiwix (to the foot of l1-l2: no walkable leg on l1); kitchen-supper (to the foot of l1-l2: no walkable leg on l2); garden-fountain (the entry is above the ground); outro-street (no walkable leg on the lot) |
| warn | cut-reason | den-repos | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | tv-steam | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | tv-films | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | tv-photos | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | west-kiwix | a cut because the camera cannot walk there (to the foot of l1-l2: no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | kitchen-supper | a cut because the camera cannot walk there (to the foot of l1-l2: no walkable leg on l2): a house or stair problem to record for the geometry stream |
| warn | cut-reason | outro-street | a cut because the camera cannot walk there (no walkable leg on the lot): a house or stair problem to record for the geometry stream |

Cuts: den-repos: no walkable leg on l1; tv-steam: no walkable leg on l1; tv-films: no walkable leg on l1; tv-photos: no walkable leg on l1; west-kiwix: to the foot of l1-l2: no walkable leg on l1; kitchen-supper: to the foot of l1-l2: no walkable leg on l2; garden-fountain: the entry is above the ground; outro-street: no walkable leg on the lot

### adeniran (asymmetry): 1 fail, 5 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | cuts | - | 7 cuts in one tour (at most 3): green-lookup (no walkable leg on l2); green-translate (no walkable leg on l2); loft-play (to the foot of l3-l4: no walkable leg on l3); garage-repos (to the foot of l3-l4: no walkable leg on l4); garden-planters (the entry is above the ground); garden-drive (no walkable leg on the lot); outro-street (route is 27 m) |
| warn | cut-reason | green-lookup | a cut because the camera cannot walk there (no walkable leg on l2): a house or stair problem to record for the geometry stream |
| warn | cut-reason | green-translate | a cut because the camera cannot walk there (no walkable leg on l2): a house or stair problem to record for the geometry stream |
| warn | cut-reason | loft-play | a cut because the camera cannot walk there (to the foot of l3-l4: no walkable leg on l3): a house or stair problem to record for the geometry stream |
| warn | cut-reason | garage-repos | a cut because the camera cannot walk there (to the foot of l3-l4: no walkable leg on l4): a house or stair problem to record for the geometry stream |
| warn | cut-reason | garden-drive | a cut because the camera cannot walk there (no walkable leg on the lot): a house or stair problem to record for the geometry stream |

Cuts: green-lookup: no walkable leg on l2; green-translate: no walkable leg on l2; loft-play: to the foot of l3-l4: no walkable leg on l3; garage-repos: to the foot of l3-l4: no walkable leg on l4; garden-planters: the entry is above the ground; garden-drive: no walkable leg on the lot; outro-street: route is 27 m

### nguyen (modernhome-nora): 1 fail, 4 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | cuts | - | 4 cuts in one tour (at most 3): garage-repo (no walkable leg on l1); kitchen-chores (no walkable leg on l1); kids-tides (route is 26 m); garden-hydrangea (route is 27 m) |
| warn | cut-reason | garage-repo | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | kitchen-chores | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | anchor-size | kids-reading | at 16:9 the anchor (desk) is 134 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | kids-reading | at 1:1 the anchor (desk) is 120 px across, under 144 px (4 x the type floor) |

Cuts: garage-repo: no walkable leg on l1; kitchen-chores: no walkable leg on l1; kids-tides: route is 26 m; garden-hydrangea: route is 27 m

### dekker (onestory): 1 fail, 3 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | cuts | - | 4 cuts in one tour (at most 3): kitchen-apples (no walkable leg on l1); dining-vault (no walkable leg on l1); garden-seeds (inside: no walkable leg on l1); outro-street (route is 47 m) |
| warn | cut-reason | kitchen-apples | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | dining-vault | a cut because the camera cannot walk there (no walkable leg on l1): a house or stair problem to record for the geometry stream |
| warn | cut-reason | garden-seeds | a cut because the camera cannot walk there (inside: no walkable leg on l1): a house or stair problem to record for the geometry stream |

Cuts: kitchen-apples: no walkable leg on l1; dining-vault: no walkable leg on l1; garden-seeds: inside: no walkable leg on l1; outro-street: route is 47 m

### quintero (cocoon): 1 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | pose-tier | mateo-blocks | tier 2 pose: the solver found no eye with the comfortable clearance (0.30 / 0.20 m or better); say it differently or pick another anchor |
| warn | cut-reason | garden-beans | a cut because the camera cannot walk there (outside: no walkable leg on the lot): a house or stair problem to record for the geometry stream |
| warn | cut-reason | outro-street | a cut because the camera cannot walk there (no walkable leg on the lot): a house or stair problem to record for the geometry stream |

Cuts: garden-beans: outside: no walkable leg on the lot; outro-street: no walkable leg on the lot

### tesfaye (mirage): 1 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | cuts | - | 4 cuts in one tour (at most 3): garden-herbs (inside: route is 27 m); living-photos (route is 69 m); loft-coots (to the foot of l3-l4: no walkable leg on l3); outro-street (inside: to the foot of l3-l4: no walkable leg on l4) |
| warn | cut-reason | loft-coots | a cut because the camera cannot walk there (to the foot of l3-l4: no walkable leg on l3): a house or stair problem to record for the geometry stream |
| warn | cut-reason | outro-street | a cut because the camera cannot walk there (inside: to the foot of l3-l4: no walkable leg on l4): a house or stair problem to record for the geometry stream |

Cuts: garden-herbs: inside: route is 27 m; living-photos: route is 69 m; loft-coots: to the foot of l3-l4: no walkable leg on l3; outro-street: inside: to the foot of l3-l4: no walkable leg on l4

### hovsepian (bghouse-olcia): 0 fail, 4 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | fallback | kitchen-dinners | kitchen-island was answered by a fallback 1 deep (counter/counter-run): the beat shows counter, not kitchen-island |
| warn | fallback | nare-lookup | bed was answered by a fallback 1 deep (room/room): the beat shows room, not bed |
| warn | fallback | nare-letter | bed was answered by a fallback 1 deep (room/room): the beat shows room, not bed |
| warn | anchor-frame | office-contract | at 9:16 39% of the anchor (core) is outside the frame (the bake marks it partial) |

Cuts: garden-drive: the entry is above the ground; outro-street: route is 28 m

### rahimi (modernhouse-nora): 0 fail, 4 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | fallback | office-slots | desk was answered by a fallback 1 deep (room/room): the beat shows room, not desk |
| warn | fallback | kitchen-fridge | fridge was answered by a fallback 1 deep (counter/counter-run): the beat shows counter, not fridge |
| warn | anchor-size | garden-flowers | at 16:9 the anchor (garden) is 109 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | garden-flowers | at 1:1 the anchor (garden) is 98 px across, under 144 px (4 x the type floor) |

Cuts: garden-ntfy: the entry is above the ground; bed-demo: the entry is above the ground; outro-street: the entry is above the ground

### brennan (seraphine): 0 fail, 3 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | anchor-size | office-week | at 16:9 the anchor (core) is 91 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | office-week | at 1:1 the anchor (core) is 81 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | office-week | at 9:16 the anchor (core) is 143 px across, under 144 px (4 x the type floor) |

Cuts: garden-pump: the entry is above the ground; outro-street: route is 45 m

### brennan-hollin (bgfamily): 0 fail, 3 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | never-framed | ftue-delivery | a toddler-bed (Study) is in the 16:9 frame at rest, and the casting says sleeping is not told (first-run chapter: the planner's camera, a note for the geometry stream) |
| warn | never-framed-walk | living-session | a toddler-bed (Study) crosses the 16:9 frame on the walk to this beat, 65 s |
| warn | never-framed-walk | front-run | a toddler-bed (Study) crosses the 16:9 frame on the walk to this beat, 322.7 s |

Cuts: study-code: route is 31 m; outro-street: route is 40 m

### brennan-merrow (familyhouse-nora): 0 fail, 3 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | anchor-size | kitchen-board | at 16:9 the anchor (core) is 81 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | kitchen-board | at 1:1 the anchor (core) is 76 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | kitchen-board | at 9:16 the anchor (core) is 137 px across, under 144 px (4 x the type floor) |

Cuts: garden-lavender: the entry is above the ground

### chaudhry (lakecabin): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | fallback | garden-heron | telescope was answered by a fallback 1 deep (garden/flowers): the beat shows garden, not telescope |
| warn | anchor-frame | study-triage | at 9:16 23% of the anchor (core) is outside the frame (the bake marks it partial) |

Cuts: garden-camera: the entry is above the ground; living-tv: the entry is above the ground; outro-street: the entry is above the ground

### gill (valleyview): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | anchor-size | garden-planters | at 16:9 the anchor (garden) is 136 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | garden-planters | at 1:1 the anchor (garden) is 130 px across, under 144 px (4 x the type floor) |

Cuts: garden-planters: the entry is above the ground; bedroom-trip: the entry is above the ground; outro-street: the entry is above the ground

### iyer (mesamariposa): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | cut-reason | garden-planter | a cut because the camera cannot walk there (outside: no walkable leg on the lot): a house or stair problem to record for the geometry stream |
| warn | cut-reason | outro-street | a cut because the camera cannot walk there (no walkable leg on the lot): a house or stair problem to record for the geometry stream |

Cuts: garden-planter: outside: no walkable leg on the lot; outro-street: no walkable leg on the lot

### salazar (payorote): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | fallback | nook-tag | desk was answered by a fallback 1 deep (core/core): the beat shows core, not desk |
| warn | anchor-frame | nook-model | at 9:16 33% of the anchor (core) is outside the frame (the bake marks it partial) |

Cuts: garden-statement: the entry is above the ground; outro-street: route is 32 m

### tuala (flowerycottage): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | look-rate | ftue-delivery | the look turns at 55.1 deg/s at 11.8 s, over the tour's limit of 55 but inside the 5% margin |
| warn | anchor-size | study-site | at 1:1 the anchor (core) is 133 px across, under 144 px (4 x the type floor) |

Cuts: garden-alliums: the entry is above the ground; outro-street: route is 38 m

### watanabe (riverbend): 0 fail, 2 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | anchor-size | garden-geese | at 16:9 the anchor (garden) is 125 px across, under 144 px (4 x the type floor) |
| warn | anchor-size | garden-geese | at 1:1 the anchor (garden) is 113 px across, under 144 px (4 x the type floor) |

Cuts: kitchen-pickles: route is 24 m; garden-willow: the entry is above the ground; outro-street: route is 35 m

### banerjee (palms): 0 fail, 1 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | anchor-frame | living-board | at 9:16 27% of the anchor (core) is outside the frame (the bake marks it partial) |

Cuts: garden-swatches: the entry is above the ground; garden-court: route is 31 m

### whitaker (familyhome): 0 fail, 1 warn

| severity | rule | beat | what |
|---|---|---|---|
| warn | fallback | kids-story | bed was answered by a fallback 1 deep (desk/kids-desk): the beat shows desk, not bed |

Cuts: garden-bed: the entry is above the ground; kids-lookup: the entry is above the ground; outro-street: the entry is above the ground

## Thresholds

| rule | value |
|---|---|
| maxCuts | `3` |
| lookCapDegPerS | `55` |
| lookFailAt | `1.05` |
| lookWarnAt | `1` |
| maxRouteM | `24` |
| routeSlackM | `0.5` |
| maxMoveS | `30` |
| maxTier | `1` |
| fallbackWarnShare | `0.35` |
| fallbackFailShare | `0.6` |
| clear | `[{"wall":0.42,"item":0.32},{"wall":0.3,"item":0.2},{"wall":0.22,"item":0.12}]` |
| clearEps | `0.01` |
| moveClear | `{"wall":0.15,"item":0.03}` |
| anchorFailMult | `2` |
| anchorWarnMult | `4` |
| cropMaxShare | `0.12` |
| neverFramedShare | `0.002` |
| neverFramedRays | `0.2222222222222222` |
| exteriorFirstS | `1` |
| exteriorLastS | `1` |
| titleCardS | `4` |
