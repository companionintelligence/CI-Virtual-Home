# Story v2: details, homes, days, and real app media (the contract for the second pass)

Everything here is OPTIONAL on `family/v1` (the schema id does not change; every existing family keeps validating) and is read by the
validator, the family page, the front page, the tour card and the persona map. The narration limits of a popup (title at most 6 words, body at
most 30) stay as they are: a card is what a viewer takes in at a glance and what the film and the ads read. The new fields are what a
visitor who stays opens up.

## New authored fields

### `beat.detail` (per beat, optional)

```json
"detail": {
  "before": "Receipts sat in a shoebox, then in a cloud drive that indexed every page.",
  "after": "Paperless-ngx reads each page on the Core and files it by what it says.",
  "steps": ["Scan the stack", "Check the tags", "Search by one word"],
  "fact": "Paperless-ngx turns scanned paper into a searchable archive."
}
```

| Field | Limit | Rule |
|---|---|---|
| `before` | at most 28 words | How it works with the service it replaces: neutral and factual. Never an attack on a named company; name a service only if it is in the beat's `app.replaces`. |
| `after` | at most 28 words | What the person does now and where it lives (the mechanism), not an adjective. |
| `steps` | 2 to 4 items (the schema), each at most 12 words | What the person actually does, in order. No UI described as seen on a screen (`persona-no-ui` applies). |
| `fact` | at most 28 words | One true fact about the app, in the words of its catalog description (the validator warns when it shares no word with it). |

A `detail`, when present, has all four fields (the schema refuses a partial one and any other key). All of them follow the copy rules (no dashes, no exclamation,
no emoji, no digits except inside an app name, banned phrases, vocabulary) and the claims rules (they are scanned like a body, and the app-name rules,
`text-role` and `persona-no-ui` read them too). Every beat of an adult or teen persona SHOULD have a `detail`: `detail-missing` warns, once the story has at
least one `detail`. `before` and `after` may name only a service the beat's app replaces (`detail-replaces`, an error).

### `family.home` (optional)

```json
"home": {
  "lede": "Two storeys of white clapboard, a porch that runs the width of the house, and a library with a grand piano.",
  "spots": [
    { "room": "Library", "line": "Shelves to the ceiling, and the Core on the writing desk." }
  ]
}
```

`lede`: at most 50 words in two or three sentences, true to the house spec (storeys, materials, rooms, garden, light). `spots`: 2 to 5; `room` is an
exact room name of the house (the validator checks it); `line` at most 16 words and true to that room's furniture (the `text-role` checks apply). No
builder, no game, no real place, no address, and not the house's id or name (`home-lede` checks the id and the display name; a sentence is at most 22 words;
the lede is two or three sentences). The page adds the auto facts (storeys, area, rooms) itself from the spec; never type numbers here (`digits`). A room appears at most once in `spots`.

### `family.day` (optional)

A day in the house: 5 to 10 entries `{ "at", "beat", "line" }`; `at` is one of `morning`, `midday`, `afternoon`, `after-school`, `weekend` (daylight only, in
this order, never decreasing); `beat` is an existing beat id; `line` at most 14 words, a different sentence from the beat's own title and body (an error when equal). The beat's member is the one who appears; each adult or teen
member (13 or older) appears at least once (warning `day` otherwise).

### `member.profile` (optional)

`{ "bio": "..." }`, at most 45 words: who they are and how they use the Core, third person, present tense, no age (the page shows it), no health or
legal or financial claim.

### Limits widened

`beats` 22 to 40 (was 30), `chapters` 7 to 12 (was 10), room beats 15 to 34 (was 24; the schema's 40 beats caps them at 33 with six ftue beats and 34 with five). The film
quotas do not move (8 to 12 film beats, at most 215 spoken words, 75 to 115 s). A persona has 3 to 7 beats of its own (`beat.member`) as a writing guide: the `members` rule
asks for at least 3 (1 for a child) and sets no upper bound, and `persona-cover` asks for one beat in its room and one with an app of its pool. The ceiling of 7 cannot hold at 32 to 36 beats for every household (a household has 6 beats without a member; pass 1 already has Ruth at 11, Parisa at 10, Elena at 9), so the balance plan proposes 4 to 7 for everyone in a household of four or more except a business owner (up to 11) and up to 14 in a household of two or three. Story v3 settles it ([story-v3.md](story-v3.md)): in a v3 family the `persona-band` rule enforces a band by household (a couple 10 to 12 each, three people 8 to 11, four or more 4 to 7, 8 for a business organiser, a child under 13 3 to 7, a baby 1 to 3) and the household beats are capped at 6 (8 for a couple); a family that is not v3 meets the bands as warnings.

The rules that read the new fields, their severities and fixtures are in [validator.md](validator.md#story-v2-optional-fields-story-v2md). The sample that exercises every field is
`test/fixtures/stories/ok-6-story-v2.json` (the Brennan family, 0 errors, 0 review, 0 warnings in the test world).

## Derived on the page (never authored)

Per person, "Rented before, on the Core now": the distinct `replaces` names of their beats' apps and the distinct apps. For the home: storeys, floor area,
room count, and a schematic floor plan with one pin per person (SVG built at build time from the spec's room bounds: `scripts/story/lib/plan-map.mts`).

## App media (real logos and real screenshots)

Source: CI-Marketplace (`apps/<id>/metadata/logo.*`, `e2e/screenshots/<id>.png`: real captures of the app from Companion Hub QA runs, which capture an
app's first-run page), the Companion Hub repo (`screenshots/appstore.png`, `screenshots/darkmode.png`, `videos/ci-tutorial-video/public/screens/*`), the Companion
Portal repo (`docs/screenshots/*`) and CI-Docs (`public/screenshots/*`: real captures of our own apps with sample data, taken for the documentation; a first-party
app's screen comes from there), each read with `git cat-file` at the commit the manifest pins, never from a working tree. Built by `pnpm run story:media` into
content-hashed WebP files under `portal/apps/<id>/` and `portal/ci/` and the manifest `content/story/app-media.json`:

```json
{ "v": 1, "sources": { "marketplace": "<sha>", "hub": "<sha>", "portal": "<sha>", "docs": "<sha>" },
  "apps": { "<appId>": {
    "name": "Nextcloud",
    "logo": { "file": "portal/apps/nextcloud/logo.<hash10>.webp", "w": 128, "h": 128, "alt": "Nextcloud logo",
              "source": "CI-Marketplace apps/nextcloud/metadata/logo.png@<sha>" },
    "shot": { "file": "portal/apps/nextcloud/shot.<hash10>.webp", "w": 960, "h": 600, "alt": "Nextcloud in a browser",
              "caption": "Real screenshot of Nextcloud from a Companion Hub QA run. Not a recording of this family.",
              "source": "CI-Marketplace e2e/screenshots/nextcloud.png@<sha>" } } },
  "ci": { "hub": [ { "id": "store", "file": "...", "w": 0, "h": 0, "alt": "...", "caption": "...", "source": "..." } ],
          "portal": [ { "id": "...", "file": "...", "w": 0, "h": 0, "alt": "...", "caption": "...", "source": "..." } ] } }
```

`logo` or `shot` is `null` when the source has none (code-server and Ollama have no screenshot). Rules: a screenshot shown on the site is REAL (never edited,
never composited into a scene or the tour, never with a family's data on it) and carries its caption; a screenshot that shows personal data, a login secret, a real email
or an internal host is NOT used (the agent checks each one by eye and records the reason in a `rejected` list). Logos identify the app they name and
carry the alt text; every logo and screenshot is a third-party mark or capture and has a THIRD_PARTY.md row (a grouped row per source is enough).
Pages load them lazily with width and height set (no layout shift); the front page loads none above the fold except the hero.

**Captions, by source.** A QA capture (CI-Marketplace): "Real screenshot of <Name> from a Companion Hub QA run. Not a recording of this family." A first-party app's
capture from CI-Docs (`source` starts `CI-Docs`, the app id starts `ci-`; the documentation's captures are taken of sample data, not in a QA run): "Real screenshot of
<Name> with sample data. Not a recording of this family." `checkManifest` insists on the one that matches the source. A CI-Docs capture is chosen in `DOCS_SHOTS`
(`scripts/story/lib/media-docs.mts`) with its git blob id; every other file of its `public/screenshots/` folder is listed in `rejected` with the reason from a rule in that
file, and a file no rule names stops the build. An app whose store mark does not identify it is held back in `REJECT_LOGO` (the app is then in `noMedia`).

**Complete, and gated.** The manifest covers every app a family, a persona pool or the cast plan names (and `PREPARED_APPS`): an app with no entry, and not in `noMedia`, fails
`pnpm run story:media:test` (it reads the committed manifest only, so it holds in CI with no sibling repo) and `portal:build --strict-families`.

Ads and films: **the owner's ruling of 2026-10-22 is that logos and labelled screenshots are wanted on family pages, in the ad cuts and in the films as inserts, and never inside
the 3D tour or a scene.** In a cut or a film the logo stands inside the chip that names its app (beside the name, never alone, never a service the Core replaces), and a
real screenshot is an inset beside the card or a full-frame proof beat, for that beat only, whole, with its whole caption at the type floor, never over the subject or the burned
captions; the end card may carry a row of logos with names. The renderers do not draw these yet (a later track: `assets/story/film/cards.ts`, `film/cut/draw.ts`,
`--screenshots` in `scripts/render-persona-cuts.mts`); the lander stays text only. The 3D frame, the goldens and the tour never see them.

## What did not change

The persona contract (personas.md), the ad rules (label, beta line, no prices, daylight, no per-person accounts, nobody presented as a customer), the
credit rule (no builder, no game it came from, anywhere), the 40 percent app share, the validator's claims lint, and `__house*` hooks.
