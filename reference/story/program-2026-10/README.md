# The October 2026 marketing program: records

> **Status: historical records, kept for the reasoning. None of this is a contract for the tree.** The contracts are the other files in `reference/story/` (`personas.md`, `story-v3.md`, `lander.md`, `film.md`, `bake.md`, `ads.md`, `validator.md`, `player.md`) and `CLAUDE.md`. Where a record here disagrees with them, they win.

Between 2026-10-18 and 2026-10-20 a set of agent sessions audited the immersive Companion Core marketing experience, rewrote the family stories to the story-v3 shape, specified the lander that is now on main, and planned the video and camera work. The working files lived in scratch folders on the author's machine; the ones below are the ones worth keeping. Directories in angle brackets (`<scratch>`) stand for those folders.

## The records

| File | Written | What it is | State on main (`2b2e584`) |
|---|---|---|---|
| [`GAP-ANALYSIS.md`](GAP-ANALYSIS.md) | 2026-10-20, against `b0910be` | The synthesis of 16 lens reports and 9 workstream registers: 231 gaps (12 blocker, 141 major, 59 minor, 19 opportunity) across lander, tour, content, video, compliance, technical, funnel, product truth and home pages; the Companion Core story the pitch needs; the 20 owner decisions with a recommendation each; the sequencing and token estimates; the conflicts with `CLAUDE.md`. | A snapshot. Many rows are fixed (the lander, the Kiwix beats, the CI story gates); re-check before acting. The banner lists what was checked. |
| [`LANDER-SPEC.md`](LANDER-SPEC.md) | 2026-10-20 | The buildable spec the lander was built from: the verdict between three designs, the page block by block, the plan file and pair index, the ad-ready gate, acceptance tests, the exact `CLAUDE.md` and README edits, the copy check, the risks. | Built. The contract is [`../lander.md`](../lander.md); phase C (the turnable Core) is not. |
| [`VIDEO-PLAN.md`](VIDEO-PLAN.md) | 2026-10-20 | The plan for a film of every home's story with a camera spline checked in every home: silent captioned films first, a spline gate, phases V1 to V6. | Not done on main: the spline report tool is on the owner's local branches `liam/video-and-families` and `liam/film-and-camera-pr`, not on main, and there are no voice locks or films. |
| [`video-reviews/`](video-reviews/) | 2026-10-20 | Vision reviews of the three Brennan tours' camera contact sheets (`vision-brennan*.md`), the camera spline reports (`spline-brennan-fix.md`, and the first and a later fleet run `spline-fleet.md`, `spline-fleet-int.md`) with the thresholds used. | The tool that produced the reports is not on main (see `VIDEO-PLAN.md`); the findings and thresholds are the record. |
| [`stage2-reviews/`](stage2-reviews/) | 2026-10-20 | Stage-2 reviews of the three Brennan stories as drafted: claims checks against the catalog, defects with exact replacement text, pointedness and duplicate checks. | The stories have moved on; the review method and its findings are the record. |
| [`v3-inputs/`](v3-inputs/) | 2026-10-18 and 2026-10-19 | The inputs to the story-v3 rewrite: 30 family briefs, the recast cast plan, the six apartments' cast, the casting review and the decisions record. See its [`README.md`](v3-inputs/README.md). | Superseded: the cast plan on main is `content/story/cast-plan.json`. |

## What was left out

- The nine **registers** (`register-W1-lander.json` to `register-W9-homes-pages.json`, about 400 KB) and the sixteen **lens reports** that `GAP-ANALYSIS.md` cites. They are large, and the analysis already carries each gap's id, severity, summary, shortened fix, effort and owner gate; the rows that say "full text in the register" point at files that are not here.
- The lander's **companion scripts and drafts**: `final-copy.mjs`, `final-lint.mjs`, `final-probe.mjs`, the three design documents it judges (`message-match`, `show-dont-tell`, `search-led`), and their outputs.
- The video work's **data and drafts**: `spline-fleet.json` and `m.json` (the data behind `spline-fleet.md` and `spline-brennan-fix.md`) and a draft pull-request body for the spline gate and the silent-film mode.
- Everything the v3 inputs README lists as not kept (generators, checks, the story-v3 contract and plan drafts that now live as `story-v3.md`).
- Screenshots, contact sheets, renders and logs.

## How it relates to the public site

None of it ships. `portal:build` copies specific trees (`assets`, `content`, `portal` and the generated pages) and never `reference/`; the credit guard and `story:copy` read `dist/`, not these files. The house ids that appear here are the file names under `content/houses/`, which `reference/story/cast.md` and `content/story/cast-plan.json` already list; the specs' `author` and `source` fields are not repeated.
