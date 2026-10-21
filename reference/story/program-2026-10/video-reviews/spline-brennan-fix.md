# Camera spline report

> **Status: record of the 2026-10 video and camera work, historical.** The camera spline report for the Brennan tour alone, after the first fixes. Read it against `reference/story/film.md`, `bake.md` and `ads.md`, which are the contracts on main. Directories in angle brackets (`<scratch>`) stand for the author's local ones; the sheets and reports it names were not kept.

1 families: 0 pass, 0 with warnings only, 1 fail (1 failing defects, 1 warnings). Worst first. A film renders only from a family that passes (reference/story/spline.md).

| # | family | home | beats | tour s | film s | tiers 0/1/2 | fallbacks | cuts | look deg/s | fails | warns | first failing rule (beat) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | brennan | seraphine | 27 | 416.3 | 84.4 | 27/0/0 | 1 | 3 | 57.8 / 24.3 | 1 | 1 | look-rate (office-week) |

## Defects

### brennan (seraphine): 1 fail, 1 warn

| severity | rule | beat | what |
|---|---|---|---|
| fail | look-rate | office-week | the look turns at 57.8 deg/s at 81.4 s (the tour's limit is 55, fail over 57.8) |
| warn | fallback | office-draft | desk was answered by a fallback 1 deep (room/room): the beat shows room, not desk |

Cuts: garden-pump: the entry is above the ground; garden-listen: route is 25 m; outro-street: route is 24 m

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
