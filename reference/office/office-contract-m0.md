# The office contract, refreshed for M0 (2026-10-23)

> **Status: the contract for the tree, milestone M0 only. Off by default, nothing public, counsel has cleared nothing.** The other files in this folder are the design record of 2026-10-19 and 2026-10-20, written against PR #35's head (`a431fe6`). This file is written against `ec69acb` (36 homes, 36 families, the apartments, story v2 and v3, the lander, app media, the ad kit and the film plates are all on main) and wins over them wherever it says something.

**Order of precedence:** this file, then section 16 of [`office-build-contract.md`](office-build-contract.md) (the skeptic amendments), then the briefs as amended (not in the tree: rebuild them from [`office-plan.md`](office-plan.md) section 2), then everything older. [`README.md`](README.md) says what the folder holds.

## 1. Decisions

Confirmed by the user, in chat, on **2026-10-23**. Source for every row: *user, in chat, 2026-10-23*. The four marked ▲ gate any public showing; the user named the value of O2, O4, O6 and O7 in that chat, and told the build to take the plan's section 5.1 default for the others. Three rows (marked ✎) are the plan's default **as the build reconciled it**, because of the nothing-public rule or because no story is written yet: that reconciliation is the author's, to be confirmed, not the user's words (O1: no `_redirects` line yet; O9: the switcher and the sitemap row are deferred; O14: "at most three stories" where the plan says "the three").

| # | Decision | Value in force | Notes for the build |
|---|---|---|---|
| O1 ✎ | The URL | `/office`, and `/company/<slug>` for a company. In `dist/`: `office.html` and `company/<slug>.html`; no `office/` directory (the local server answers 404 for a file and a directory of one name) | no `_redirects` line yet |
| O2 ▲ | Per-person Companion accounts | **The claims canon wins.** Offices say only "each app keeps its own sign-ins". No page mentions Organizations or a Companion account per colleague; `cap-multi-user` of `claims.json` holds | the docs' Organizations page is not followed |
| O3 | A medium business | Told as one site or one department of a larger firm, `floor` at most 25 | no medium company in M0 |
| O4 ▲ | The label and fictional staff | The label is **"Fictional company. Real software."** and the long line is **"The people in it are characters, not customers."** ADS.md 9.1 is read as about Companion's own team, the reading the families already rely on | in `content/story/claims.json`, disclosure `fictional-company` (section 3). Characters are drawn as monograms, never faces |
| O5 | Remote access, "share apps through a web link" | Every scene stays inside the building; writers say "at the office", never "from the office" | `cap-remote-access` is not touched |
| O6 ▲ | The eight company names | **Proposals only.** Counsel clears each. M0 uses two of them (Reelwick, Lintel & Sill) as placeholder fixtures; `company-names.json` is a deny-list, never a clearance | a rename is a day's work at most before stories exist |
| O7 ▲ | Naming real services | Only the services the store's own `replaces` rows name, in chips and "Rented before" panels, with the owners-of-names line; **never as text-only mentions** (the pay service, the mail provider). A pair reads "<app>, alternative to <service>", never "replaces" | in M0 the chips are checked against `content/story/services.json` and the `hold` list of `content/story/lander.json`. The pages print `names-logos-owners` ("Product names, logos and brands are the property of their owners...", the front page's own line), not `names-owners`, whose words say "what each app replaces", which the house rule forbids; M1's "Rented before" panel prints the same |
| O8 | Compliance wording, setting limits | None; the eight settings are the green ones | |
| O9 ✎ | Sitemap and navigation | The plan's default (one sitemap, two header links) is **deferred by the nothing-public rule**: the Homes and Offices switcher exists only in a build made with `--offices`; there is no sitemap row, no `robots.txt` change and the pages are `noindex, nofollow` | the default build is byte for byte today's |
| O10 | The team boundary | One Core, one owner, per-app sign-ins named as that app's own feature, one companion per company, on the owner | |
| O11 | Backups | Not printed. `owner-backups` is **not** added to `claims.json`. The three shipped family backup beats are untouched | open question 2 below |
| O12 | Merge order | Moot: the apartments, pass 2, story v3 and the lander are on main. The `author` of an office is **`Companion Intelligence`** through `scripts/own-authors.mts` (the design's token `ci-offices-internal` is dropped) | |
| O13 | Stretched `replaces` pairs | The store's pair is kept on tours and cuts later, as the families do. The M0 cards do not use the two loose ones (Paperless-ngx with Evernote, with Google Drive) | counsel reads it with O7 |
| O14 ✎ | Akaunting's cap | Keep it in at most three stories, one person each | no M0 impact |
| O15 | Package gaps | The stories avoid every gap and say "on the Core" only where the package keeps data | no M0 impact |

The smaller calls of plan 5.1 (Kenney K2 for seating, blank unlettered fascia signage, planner v2 with `duration: auto`, the first release at two, six or eight offices) are M1 and later.

## 2. What changed on main since the design

| The design said | Main now | Decision |
|---|---|---|
| `author` is the internal token `ci-offices-internal` (R10) | `scripts/own-authors.mts` exists; the apartments are credited to `Companion Intelligence` | an office's `author` is `Companion Intelligence`; the credit guard skips it by that module |
| the label is a row of a new `claims-office.json` | the user asked for it in `claims.json`; the film pin (`toolSha`) now hashes only the disclosures a film prints, so a new disclosure moves no film | `fictional-company` lives in `claims.json`, flagged `collection: "office"` so the player's mirror (`CLAIMS_SNAPSHOT`) and its shipped bytes do not change. `claims-office.json` (the 28 `biz-*` rows) is M1, with the story validator |
| chips read "replaces <service>" | story v3: "<app>, alternative to <service>", a `service` id on a beat, a registry of services (`services.json`), a `hold` list of pairs counsel has not cleared | company/v1 takes the v3 beat; chips are checked against the registry |
| the lander has no office hook | `scripts/story/lib/lander.mts` `officeProblem` expects a home of `type: "office"` in `index.houses` and a `fictional-team` disclosure | not used: offices are rows of `index.offices` (R1), so that check cannot fire. If the owner ever wants offices in the lander, point `officeProblem` at `fictional-company`, a one-line change |
| company constants in `assets/story/types.ts`, sources in `portal/` | every `assets/**/*.js` and every `portal/**/*.css|js` is copied to `dist/` | M0 adds **no new or changed shipped file**: the constants live in `scripts/story/lib/co/`, the page's script and style in `scripts/office/assets/`. M1 moves what the player needs into `assets/story/types.ts` on purpose |
| the 22 directory-glob scripts are swept in WP2A | no office building exists yet | M0 ships the helper (`scripts/lib/list-specs.mts`) and the index builder; the sweep is the first job of M1, before the first building lands in `content/houses/` (section 6) |
| phone-booth, props, programs, the loft spike | not in the tree | M1 |

## 3. M0: what it is

"What you can look at": `/office` with two cards on fixtures (the brick loft and the Georgian townhouse companies), a header switcher between Homes and Offices, filters, a company page for each card, and the seams M1 builds on. The packages of the plan that make it:

| Plan package | M0 share |
|---|---|
| WP0 decisions and baseline | this file; the before-numbers (base `ec69acb`: `typecheck`, `validate`, the story gates, `portal:build` and `story:copy` pass; `test` 140/141; `test:node` 4 of 53 red, none of them the office's) and a fingerprint of the default build's 601 files |
| WP1.1 contract commit | the `company/v1` schema, `functions.json`, `roles-office.json` with its merge, `company-names.json`, `scripts/story/lib/kinds.mts`, the label in `claims.json`, the contract test. **Not** `claims-office.json`, `subject.ts`, the briefs, `company-voice.md` (M1) |
| WP1.2 company validator | `validateCompany` for the schema and the structural rules that need no building (size band, members, owner, one companion, names, the copy lint over the user strings), reached through `story:validate -- --kind office`. The beat, anchor, room and app-facts rules are M1 |
| WP2A engine seams | `use` and `office` on the spec type, `list-specs.mts`, the `offices` array in the index, `scripts/validate/office.mts`, `HOUSE-SPEC.md`. Not the sweep, not a building |
| WP5.1 the /office page | on `test/fixtures/site/offices/`, static cards, a script that only filters |
| WP5.2 the company page | a skeleton on the same fixtures: the label, the people, the apps as chips, the honest limits; no tour, no plan, no bring-home panel |
| WP5.3 shared chrome | the switcher, injected at build time into the built pages of a flagged build; no edit to `portal-pages.mts`, `story/pages.mts`, `index.html` or a shared stylesheet |

Out of M0 (the user's rule and the plan's order): buildings, composer programs, props, tours, films, ads, voice, casting, stories, the engine's neutrality work, goldens.

### The label

`claims.json` gains one disclosure, id `fictional-company`: `text` "Fictional company. Real software."; `long` "{company} is a fictional company. The people in it are characters, not customers. The software is real."; `required` false (the families' surfaces do not owe it); `collection` "office"; `notes` saying what is approved (O4, 2026-10-23, in chat) and what is not (counsel). The three words of `long` beyond the approved sentence ("is a fictional company", "The software is real") are the family disclosure's own pattern and are marked for sign-off. No other disclosure is added: the pages print the base ones (`launch-not-offer`, `scripted-scenes`, `stylised-art`, `names-owners`, `names-logos-owners`, `third-party-apps`, `apps-availability`) in the places the families' pages print them.

## 4. Nothing public

| Mechanism | Pinned by |
|---|---|
| `portal:build` writes no office file without `--offices`, and its output is byte for byte the base commit's (601 files, one fingerprint) | the independent inertness review pins it to `ec69acb` (nothing in the tree can); `scripts/test-office-front.mts` holds that a flagged build differs from a default one by the office's pieces only, and that a default build clears a flagged one |
| `--offices` together with `--strict-families` (what a push to main builds) or `CI_STORY_STRICT=1` **fails the build**, before any work | `scripts/test-office-front.mts` |
| the index a build ships has **no `offices` key** (`redactIndex` drops it), so the first office indexed in `content/houses/` is not named by a public build; only `index.houses` has specs, thumbnails and pages shipped | `scripts/test-office-spec.mts` |
| no env var and no other spelling enables it: the exact flag only (`--offices`, which `parseArgs` also reads as `--offices true`) | `scripts/test-office-front.mts` |
| `OWNED` in `build-portal.mts` lists `office.html` and `company`, so a default build clears what a flagged build left | the same |
| the pages are `noindex, nofollow`, have no canonical, are not in `sitemap.xml` and `robots.txt` is the default's | the same |
| no change to `.github/workflows/ci.yml` or `deploy.yml` | `git diff --stat` in the review |
| nothing is pushed, no PR, no deploy, nothing posted | |

## 5. Invariants (the design's I1 to I9, held, plus two)

I1 to I9 of the build contract stand. In particular: the 36 families stay byte for byte (no change to `content/families`, `roles.json`, `casting.json`, `cast-plan.json`, `personas.json`, `ads.json`, `family.schema.json`; `claims.json` gains one disclosure and nothing else); an office is a HouseSpec in `content/houses/` with `use: "office"` listed under `index.offices`; homes and offices never mix on a page; one slug namespace; no builder credit, no game; determinism.

- **I10 (M0).** The default build is unchanged: `portal:build` without `--offices` produces the same 601 files with the same hashes as `ec69acb`, and `pnpm run index` on today's `content/houses/` writes the same `houses` rows and no `offices` key.
- **I11 (M0).** No file under `assets/` or `portal/` is added, and no `.ts` under `assets/` changes except the type-only fragments (`assets/spec/base.ts`, `assets/spec/compose.ts`), whose compiled `.js` is an empty file before and after.

## 6. The first job of M1

M0 already stops the shipped index from naming an office (`redactIndex` drops `offices`; the independent review found that a plain default build would otherwise have shipped the array as soon as one office was indexed). `scripts/lib/list-specs.mts` is imported by the index builder and by the office plugin (which every validator run loads; it reads the office's role table only when it meets an office).

The scripts that glob `content/houses/` count every spec as a home (the design said 22; the inventory finds about 30, in the hand-over notes). Before the first building is committed there, sweep them onto `listSpecs({ kind: 'home' })` or `allHouses()` (the inventory and the choice for each is in the status notes of the M0 hand-over), and add the office baselines (`compose`, `fleet`, `planner`) as separate files. Only then does `content/houses/<office>.json` land. The two Python twins loop every spec: always pass `--only <id>`.

## 7. Open items

Counsel: the eight company names (and a trademark search), the label under ADS.md 9.1, the licences of Elastic 2.0, BSL 1.1, Sustainable Use and AGPL-plus-commercial apps against "an office uses the app", comparative naming of business incumbents (O7, O13). Owner or Hub team: **(1)** a capacity statement for one Core and a floor of 22 to 24 people (none exists; so no figure is printed and no medium company ships a floor figure); **(2)** whether Hub's per-app backup deserves one sentence in the fact sheet (until then `owner-backups` stays out); the free-edition limits of Mattermost and Rocket.Chat; EspoCRM's persistence; ntfy on a local HTTP address; Cloudflare's precedence for `office.html` against `/office`; the Kokoro install before any voiced tour; macOS goldens for every building. The page copy and the fixtures' people, titles, taglines and sectors are placeholders written for M0.

## 8. What M0 added, how to look at it, how it is checked

| Where | What |
|---|---|
| `assets/spec/base.ts`, `compose.ts` | `use`, `office`, `rooms[].seats` (types only: the compiled files are empty before and after) |
| `scripts/lib/list-specs.mts` | `listSpecs({ kind })`, `allHouses(index)`, `specUse(spec)` |
| `scripts/build-house-index.mts` | an `offices` array beside `houses`, no key when there is none; `--dir` and `--out` for the tests |
| `scripts/validate/office.mts`, `test/fixtures/offices/` | the office plugin (silent for a home), a fixture office (never rendered) and the room-name oracle of the eight planned buildings |
| `content/story/` | `schema/company.schema.json`, `functions.json`, `roles-office.json`, `company-names.json`, and one disclosure in `claims.json` |
| `scripts/story/lib/kinds.mts`, `co/` | the merged role table; the company gate (`context`, `validate`, `strings`, `consts`, `types`, `exemplar`, `cli`) behind `pnpm run story:validate -- --kind office` |
| `scripts/office/` | the draft page: `data.mts` (the cards), `pages.mts`, `site.mts` (the build, the switcher, the checks), `fine-print.mts`, `assets/office.css|js`, `browser-check.mts` |
| `test/fixtures/site/offices/` | the two fixture companies (placeholders: see section 1, O6) |
| `scripts/build-portal.mts` | 17 lines: the flag, the early refusal, `office.html` and `company` in `OWNED`, one call |
| `scripts/story/lib/site-copy.mts`, `fine-print.mts` | the copy lint reads the office pages; the player's mirror of the claims skips the office disclosure |
| `scripts/validate-stories.mts` | 12 lines: `--kind office` hands over to the company gate before anything of the family gate loads |
| tests (`@check-house quick`, so `pnpm run test:node` runs them) | `test-office-spec.mts`, `test-company-contract.mts`, `test-company-validator.mts`, `test-office-front.mts` |
| docs | this file, `reference/HOUSE-SPEC.md`, `reference/story/validator.md`, `CLAUDE.md` (the office block), `THIRD_PARTY.md` (one more file inlines three Lucide icons) |

**To look at it:** `pnpm run portal:preview -- --offices` builds the site with the draft office and serves it at `http://127.0.0.1:8081/ci-virtual-home/` (the office is `/office`, a company `/company/reelwick`; add `--port` if 8081 is taken). The default `pnpm run portal:preview` has no office. **To check it:** `pnpm run test:node` (the four tests above), `pnpm run story:validate -- --kind office`, and by hand, with a browser, `node --experimental-strip-types scripts/office/browser-check.mts`.

**Checked on 2026-10-23 at `0fe0e87`, against the base `ec69acb`** (a full run of the gates on the finished branch, each output compared with the one the base gave): the default `portal:build` is byte for byte the base's (601 files, the same sha256 list); `typecheck`, `validate`, `story:cast -- --check`, `story:cast-lint`, `story:services:check`, `story:bake -- --check --all`, `story:ads -- --check` and `story:copy -- dist` print the same bytes; `pnpm run test` is 140 of 141 as at the base (the 141st, the cast CLI test about a casting family without a file, fails at `ec69acb` too); `pnpm run test:node` runs 57 checks against the base's 53 with the same four red (`film`, `film-plates`, `film-wrap`, `stories`: the same five failing assertions, all present at the base) and the four new suites green. An independent review (a fresh agent working in its own extracts of the base and of the branch) reached the same result and found one latent leak, `redactIndex` shipping an `offices` key, which `0fe0e87` fixes. Not run, because they need the pinned Chromium r1246 that this Mac lacks: `portal:test`, `check`, the goldens; the by-hand browser check ran against a Chromium r1243 stand-in and is indicative only.

**Not in M0 and not pretended:** a building, a tour, a story, a film, an ad, a company page's plan or "Rented before" panel, a logo or a screenshot, a count that is not the fixtures', the `portal:test` browser leg for the office (the by-hand script stands in until the pinned Chromium is installed), `claims-office.json`.

