# The fine print each surface owes

`content/story/claims.json` lists the disclosures the site and the films must carry (`disclosures[]`, each with a `where` in prose). One rule table
turns that prose into code, and one helper prints it, so a page cannot forget a line and two pages cannot say it two ways.

| Piece | File | Job |
|---|---|---|
| rule table | `assets/story/fine-print.ts` | `SURFACES`: for each surface, the disclosure ids it prints, in order, with the fact that switches one on (`agents`, `narration`, `logos`, `tour`). No imports, so the page writers (Node) and the player (browser) load the same file |
| Node helper | `scripts/story/lib/fine-print.mts` | reads `claims.json`: `finePrint(surface, facts)` -> `{ items, html }`, `finePrintItems`, `coreLine`, `disclosureText`, `missingFinePrint(html, surface, facts)` (the ids a page leaves out, word for word) |
| player's copy | `CLAIMS_SNAPSHOT` in `assets/story/fine-print.ts` | the few fields of `claims.json` the player needs (it cannot read the file). `node --experimental-strip-types scripts/story/lib/fine-print.mts --write` rewrites it after a change to `claims.json`; `--check` and `scripts/test-fine-print.mts` fail when it is stale |

The words are never typed in a page writer: they are `claims.json`'s, verbatim. `launch-not-offer` is marked `volatile` there; when the campaign wording
changes, the owner changes `claims.json`, the snapshot is rewritten, and every page follows.

## Surfaces

| Surface | Carried by | Prints (when) |
|---|---|---|
| `family-fold` | `scripts/story/pages.mts` | `fictional-family` as the header chip (printed once), `beta-short` as the strip |
| `family-start` | `scripts/story/pages.mts`, under "How the Core starts" | `internet-steps` (an agent is named) |
| `family-footer` | `footer()` in `scripts/story/pages.mts` | `launch-not-offer`, `beta-full`, `scripted-scenes`, `stylised-art`, `synthetic-voice` (the tour has a voice), `attribution-agents` and `not-frontier` (an agent is named), `apps-availability`, `names-owners`, `names-logos-owners` (the page shows an app's logo) |
| `home-band`, `home-footer` | `scripts/portal-pages.mts` (every `homes/<id>`) | `beta-short` in the Core band; `launch-not-offer` and `beta-full` in the footer |
| `not-found` | `scripts/portal-pages.mts` (`404.html`) | `launch-not-offer` (the page offers Buy Companion Core) |
| `player-about`, `player-end` | `assets/viewer.ts` | the About panel: `launch-not-offer`, `beta-full`, `not-frontier`, and for a tour `fictional-family`, `scripted-scenes`, `stylised-art`, `attribution-agents`, `names-logos-owners`; the end card: `beta-short`. A family tour also shows `fictional-family` as a chip that stays on screen (`.vh-fiction`) |
| `tour-start` | `FINE_PRINT` in `assets/story/popup.ts` | `scripted-scenes`, `synthetic-voice` (a voice), `stylised-art`, `beta-short`; `scripts/test-fine-print.mts` holds the list to the table |
| `lander-hero`, `lander-core`, `lander-footer` | `index.html`, `scripts/portal-front.mts` (markers `<!-- fine-hero: -->`, `<!-- fine-core: -->`, `<!-- fine-foot: -->`; the line `stylised-art` is the caption of the Core's picture) | `fictional-family` and `beta-short`; `beta-short`, `not-frontier` and `stylised-art`; `launch-not-offer`, `beta-full`, `scripted-scenes`, `names-logos-owners` and `third-party-apps` |

Every printed line carries `data-fine="<disclosure id>"`, so a test, a build step or a screen reader's rotor finds it by id. The Core band's sentence is
`coreLine()`: "The small computer on your desk is a Companion Core." and then claims.json's `local-by-default`, verbatim. "Your own AI, apps and memory" is
retired (rule `cap-own-apps`).

## Adding a surface

1. Add a row to `SURFACES` (and, if claims.json places a new disclosure, make sure the row follows its `where`: `scripts/test-fine-print.mts` checks the prose).
2. Call `finePrint('<surface>', facts)` where the page writes that surface. Run `--write` if `claims.json` changed.
3. Add the surface to the test: `missingFinePrint(page, surface, facts)` must return `[]`.

`scripts/test-fine-print.mts` (a quick node test) fails when a page lacks a disclosure its facts owe, when the table drops a disclosure `claims.json`
requires, when the snapshot is stale, and when a sentence breaks a banned-phrase rule of severity `error`.
