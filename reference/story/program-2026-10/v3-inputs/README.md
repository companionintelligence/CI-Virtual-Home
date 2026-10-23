# Story v3 inputs (2026-10-18 and 2026-10-19)

> **Status: inputs to the story-v3 rewrite, superseded.** The cast plan on main is **`content/story/cast-plan.json`** (`reference/story/cast.md` is its derived table, `content/story/casting.json` the machine form); the contracts are `reference/story/story-v3.md`, `persona-bible.md` and `personas.md`. At import (`2b2e584`) the recast in `cast-plan.v3.json` differs from the cast plan on main in 22 of the 30 families (compared by member name and archetype), so do not apply it; use it to see what was proposed and why.

## What is here

| Path | What it is |
|---|---|
| [`family-briefs/<slug>.json`](family-briefs/) | Thirty writer's briefs, one per family, generated 2026-10-18 for the story-v3 rewrite (`"v": 3`). Each holds: `basedOn` (the family file and its `sha1` the brief was written against), `cast` (the cast-plan changes it assumed), `targets` (beat counts, pair share, household beats), `members`, `character` (the house's lede, spots, facts and what a scene must not show), `signatureStack`, `swaps`, `drops`, `adds`, `chapters`, `scenes`, `day`, `ledger` (rented services before and after), `details` (the facts each app's beat must carry), and the catalog and review entries it needed. |
| [`cast-plan.v3.json`](cast-plan.v3.json) | The 30 homes recast for story v3 (people, workrooms, signature apps, beat apps, `reviewNeeded`) in the layout of `content/story/cast-plan.json`. Zero cast-lint errors against a scratch copy at the time. |
| [`apartments-cast.json`](apartments-cast.json) | The six apartments cast the same way. Applied on 2026-10-22: its six families are rows of `content/story/cast-plan.json` (copied as drafted, `homesWithoutFamily` is empty now), with the narrator quotas of `voices.json` retotalled to 36. The 30-home recast above is still not applied. The file keeps its own note ("NOT applied anywhere") as it was written. |
| [`casting.md`](casting.md) | The review of the two plans: method and rules, old cast to new cast home by home, archetype and name-reading tables before and after, first-name reuse, app rotation (128 distinct apps across the 30 homes), how each name reads, and the unresolved points that needed the owner. |
| [`v3-decisions.md`](v3-decisions.md) | The owner's answers of 2026-10-19 (rewrite the stories, rework the casting skew, age 16 for chat models and agents, unreadable sources stay unread) and the judgment calls on scope, archetypes, the age rule, casting and "varied and pointed". |

## How to read the briefs against main

- A brief's `basedOn.sha1` is the hash of the family file when the brief was written. At import, 12 of the 30 family files on main still have that hash (adler, banerjee, chaudhry, gill, halvorsen, jankowski, kamau, mbatha, petrov, rahimi, salazar, tuala); the other 18 have changed since (the three Brennan families were rewritten to the story-v3 shape; the rest carry edits of varying size), so check a brief's beat ids against the file before using it.
- 18 of the 30 briefs mention Kiwix, which the catalog marks `avoid` and no family on main names. Run the validator rather than trusting a brief.
- Some strings quote catalog and marketplace caveats about third-party apps; one default admin address in those caveats is replaced by a description of it.

## What was not kept

The generators and checks behind these files (`build-v3.mjs`, `build-apt.mjs`, `apply-cast.mjs`, `verify.mjs`, `lint-v3.sh`, `partial-test.sh`, `locks.mjs`, `alloc-lib.mjs`, `make-md.mjs`, `v3-spec.mjs`), their scratch repos and run logs, `apartments-gender.json`, `summary.json`, the story-v3 contract and plan drafts of 2026-10-18 (their content is `reference/story/story-v3.md` now) and the other per-wave reports. `casting.md` names several of them.
