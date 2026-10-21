# reference/

Design contracts, plans and records for ci-virtual-home. None of it ships: `portal:build` copies specific trees (never this one) and the credit guard and `story:copy` read `dist/`. The first three rows are the live contracts (the project [`README.md`](../README.md) says when to read each); the rest is a plan, history or parked design, and says so at the top of each file.

| Where | What | State |
|---|---|---|
| [`HOUSE-SPEC.md`](HOUSE-SPEC.md) | The HouseSpec schema, the single source of truth for 3D, CAD plans and isometrics. | Live contract |
| [`APARTMENTS.md`](APARTMENTS.md) | A home that is one unit in a block: the recipe, the six, what adding a home changes. | Live |
| [`story/`](story/) | The story system: `personas.md` (the contract), `story-v3.md`, `lander.md`, `ads.md`, `film.md`, `bake.md`, `voice.md`, `player.md`, `validator.md`, `fine-print.md`, `persona-bible.md`, `persona-apps.md`, `personas/`, the derived `cast.md`. | Live contracts |
| [`PARAMETRIC-INTERIORS-PLAN.md`](PARAMETRIC-INTERIORS-PLAN.md) | The parametric and procedural interiors plan and roadmap. | Design plus roadmap |
| [`HOUSE-SYSTEM-REVIEW-2026-09-15.md`](HOUSE-SYSTEM-REVIEW-2026-09-15.md) | The September 2026 design verdict and work plan, written in CI-Common. | Historical |
| [`geometry/detectors-baseline.md`](geometry/detectors-baseline.md) | The z-fighting and collision detectors: thresholds, false-positive classes, self-tests and the first results on `aurora` and `seraphine`. The detectors themselves are on main (README, "Geometry detectors"). | Baseline record |
| [`office/`](office/) | The `/office` page: eight fictional companies in eight 3D offices. Brief, plan, build contract and skeptic review. | Parked design, stale, not shipped; four owner decisions gate any showing |
| [`story/program-2026-10/`](story/program-2026-10/) | Records of the October 2026 marketing program: the gap analysis, the lander spec, the video plan and camera reviews, the stage-2 story reviews, the story-v3 inputs. | Historical |
