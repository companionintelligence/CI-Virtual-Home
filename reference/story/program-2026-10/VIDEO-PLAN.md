# Plan: a film of every home's story, with a camera spline checked in every home

> **Status: record of the 2026-10 video and camera work, historical.** The plan for a film of every home's story with a camera spline checked in every home, written 2026-10-20. The spline report tool (`scripts/story/spline-report.mts`) and `reference/story/spline.md` it names are not on main at import (they exist on the owner's local branches `liam/video-and-families` and `liam/film-and-camera-pr`), and `pnpm run story:film` on main still refuses estimated durations (no voice locks). Read it against `reference/story/film.md`, `bake.md` and `ads.md`, which are the contracts on main. Directories in angle brackets (`<scratch>`) stand for the author's local ones; the sheets and reports it names were not kept.

Owner ask (2026-10-20, after the foundation work): "start plan to create a video of each home story using video pipeline. Make sure video camera
spline is good in each home then render videos."

## What exists (read, not assumed)

- `pnpm run story:film -- <slug>` (scripts/render-family-film.mts, reference/story/film.md) makes one ~90 s film per family in 16:9 (1920x1080) and
  9:16 (1080x1920), 30 fps, from the family's own files. Its camera is the live tour's camera (`trackFrameAt` on the bake lock's track): a spline per
  home made of holds (a beat at rest) and moves (A*, string-pulled walks, rounded by the planner's fillet), cuts when the route is too long or the
  entry is above the ground. It plays only the beats the story flags `"film": true`, draws title card, popup cards, karaoke captions and an end card
  ("UnCloud your life.", ci.computer/core, the fiction line, the disclosures) on a 2D overlay.
- It REFUSES estimated durations: it needs `<slug>.voice.json` (Kokoro, not installed: a 3 GB model download that needs the owner's yes) and a bake
  made from that voice lock, and its gates demand one AAC stream at -14 LUFS and no 2 s silence. Today: 0 voice locks, 0 films.
- It launches Chromium with the repo's Linux flags = SwiftShader (software GL: hours per film). The ad-cut renderer (`render-persona-cuts.mts`) already
  has `--gl default` (the machine's Intel GPU through ANGLE; about 1.5 h for 12 cuts). `story-bake.mts --stills --strip` also uses the software flags.
- Camera quality today is only what the bake reports (`tiers`, `fallbacks`, `cuts`, `look deg/s`, notes) plus a human looking at contact sheets
  (`story:bake -- <slug> --stills <dir>`); nothing grades a spline across 30 homes. Known: Brennan in bgfamily kept a crib in frame (found and fixed by
  hand on 2026-10-20); several beats are `cut` because the entry is above the ground; every `outro-street` is "framed from the air".
- Films never go in git or on Pages (about 18 MiB each); `video/` is gitignored; posters, captions (.vtt) and `films.json` are committed; hosting is
  the owner's (FILM_BASE_URL).

## Decisions made for you (change any of them)

1. **Silent, captioned films first.** Voice needs the Kokoro download (owner only). The tours already run on captions; ads are silent-first. Films get a
   silent mode: burned captions timed from the bake's estimated durations, no audio track, `sound: false` in `films.json`. When you approve Kokoro the
   same films are re-rendered with voice (the pipeline already does it).
2. **GPU path for film and bake stills**, copied from the cut renderer (`--gl default`, with its software fallback warning).
3. **Render a family only after its text is final.** 27 of 30 families are about to be rewritten (Phase 4); rendering them now would be thrown away.
   So the pilot is the three Brennan tours (already v3, reviewed); the rest follow in tiers as each rewrite lands.
4. **A film must pass the spline gate before it renders** (below), then the film gates (frames, length, freeze, size; sound gates only when voiced).

## The spline gate ("good" camera, per home)

Automated (scripts/story/spline-report.mts, new): from each bake lock, per family, with thresholds checked into the script and printed:
no lost anchor; every beat tier 0 or 1 (no fallback pose); fastest look turn <= the tour's own limit with a margin; cuts <= 3 per tour and each named;
no walk longer than the cut threshold shown as a move; no pose inside a wall or inside furniture (re-checked against the house plan); an
anchor never smaller than the type floor in any aspect; no frame of a "never framed" object (nursery pieces: the casting's `fitNote`); first and
last seconds are the exterior move. Output: one JSON + one markdown table for the fleet, worst homes first.

Visual (contact sheets + strips at 16:9 and 9:16, `story:bake --stills <dir> --strip 8`, one GPU process): each home's sheets are read by a
vision-capable reviewer who lists defects with the beat id: clipping through a wall or furniture, a blocked view, a turn too fast or an
uncomfortable angle, over-exposed windows, the wrong object framed, a crib or an unmade bed in frame, a jump cut that reads as a mistake. A fixer
changes the story's camera hints (`camera.framing/side/from`, anchor `role/nth/fallback`) or, when the cause is the house, records it for the
geometry stream. Re-bake, re-render the sheets, a second reviewer confirms. A home passes when both gates pass and its report is stored.

## Phases

| Phase | What | Tokens (est.) | Machine time |
|---|---|---|---|
| V1 (now) | silent film mode + GPU path (render-family-film, film/lib, mux, qa, layout), tests, docs; the spline report tool + contact-sheet runner; independent verify | 2 to 3 M | minutes |
| V2 | run the spline report on all 30 homes and sheets for the three Brennan homes; vision review and fixes for those three | 1 to 1.5 M | about 20 min GPU |
| V3 | pilot render: Brennan (seraphine) at 540 p to look, then 1080 p both aspects; measure time and size; gates; look at frames; then bgfamily, familyhouse-nora | small | about 1 h each on the iGPU (measured in V3) |
| V4 | tiered batches as the rewrites land: bake from final text, spline gate, film, gates; `--jobs 1`, background, resumable (films.json skips current films) | about 0.3 M per family (review + fixes) | about 1 h per film, overnight batches |
| V5 | a local review page of all films, poster and caption commit, claims check of the burned text, owner approval before any hosting | 0.3 M | seconds |
| V6 | apartments (after they have stories), the 89 persona ad cuts (separate kit, W4), offices | later | later |

## Risks

- GPU time: 30 films x 2 aspects is about 30 h on this machine (to be measured); it competes with other sessions' browsers. Run `nice`, one process.
- Determinism: a different GPU or ffmpeg gives different bytes; the films are made on this machine profile and are not goldens.
- Burned-in text must pass `claims.json` (the end card's disclosures come from the fine-print helper); the film refuses a family whose beats the validator rejects.
- Rewrites change camera tracks: always bake after the last text edit, and re-run the spline gate.
- Owner decisions: Kokoro voice (3 GB), the film host (R2 or Stream), and whether a silent 90 s film is enough for the family page.
