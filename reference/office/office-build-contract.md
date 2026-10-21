# The office build contract (key `plan`)

> **Status: design only, stale versus main, not shipped.** Written 2026-10-19 and 2026-10-20 against PR #35's head (`a431fe6`), before the apartments, pass 2 and the lander reached main.
> Main has no `/office` page, no `company/v1` schema, no `use: "office"` spec field and none of the files this document calls new. Owner decisions **O2** (per-person accounts), **O4** (the label and fictional staff), **O6** (company names) and **O7** (naming services) gate any public showing, and counsel has cleared none of the company names or licence readings.
> Read it as the record of a design and its skeptic review, not as a contract for the tree. Directories in angle brackets (`<scratch>`, `<repo>`, `<office-worktree>`) stand for the author's local ones. See [`README.md`](README.md) in this folder for what was left out.

Read-only phase, 2026-10-19. Nothing in any repository was changed to write this. The build tree is `<office-worktree>` (branch `feat/office-page`, stacked on PR #35's head `a431fe6`: 30 homes, 30 families, the story system, no pass 2, no apartments). This file is the exact delta the work packages build from; the reasoning, the eight offices and the owner decisions are in `office-plan.md` beside it.

**Where it comes from.** It reconciles the four specialist reports in this folder: `office-contract.md` and `site.md` (the page, the schema, the pipeline), `engine.md` (buildings, props, gates), `claims.md` (what a business story may say) and `office-bible.md` (market, roles, team-scale truth). Where they disagree, section 0 says which one wins and why. Where this file says nothing, the older contract (`office-contract.md`) stands.

**Ready inputs (checked, in this folder; WP1.1 copies them into the repo).**

| File | What it is | How it was checked |
|---|---|---|
| `company.schema.proposed.json` | the draft `company/v1` schema plus `workshop` and `store` room roles and the `workbench` item role | all eight briefs fit its length and pattern limits (`gen/schemacheck.mjs`) |
| `functions.proposed.json` | the 12 functions: rooms, fallback rooms, app pools | every person of the eight briefs passes `co-functions`; no pool app is `avoid` |
| `roles-office.proposed.json` | the office extension of `roles.json` | every room of the eight buildings resolves to the intended role, no home kind misfires (`gen/rooms.mjs`) |
| `claims-office.proposed.json` | 28 added rules, two base rules replaced for company copy, 12 disclosures | 100 merged rules compile, ids unique, none global; every string of the briefs and the page copy is clean under them; run over the 30 family files they hit 34 strings (reproduced), so they never load for a family |
| `office-cast-plan.proposed.json` | the authored seed of `office-cast-plan.json` | built from the briefs |
| `company-briefs/<slug>.json` (8) + `index.json` | cast, stack, beat outline, rooms, film beats for the story writers | every string linted (banned phrases, shape rules, app matcher); 46 distinct apps, no app in more than three of eight, 43 rented services named (47 before the skeptic pass, section 16) |

---

## 0. Reconciliation: what this contract decides where the reports differ

| # | Question | The reports | This contract | Why | Reversible by |
|---|---|---|---|---|---|
| R1 | Where an office building lives | `engine.md`: one tree, spec field `kind`, `index.json` gains an `offices` array; `site.md`: one `houses` array with `kind: office` rows, spec field `use` | **One tree. Spec field `use: "office"`. `index.json` keeps `houses` byte for byte and gains a sibling `offices` array.** Helper `allHouses(index)` for the readers that must see both | Every reader written without offices in mind (the apartments PR, pass 2, `gallery.js`, `cast-lint`, the 30-literal tests, the credit guard's home count) stays correct by default. A forgotten reader misses an office (caught by the office tests) instead of showing it on the homes page (public). `use` does not collide with the many `kind` fields (room kinds, opening kinds, canopy kinds) | one-day rename and a filter at about 20 places |
| R2 | Schema | sibling `company/v1` (both agree) | sibling, adapted at the edge by `subjectOf()`; family files, locks, `claims.json`, `roles.json`, `casting.json`, `ads.json` untouched (I1, I2) | about 25 family-specific branches avoided; zero risk to the 30 locks | no |
| R3 | How many companies, which sizes | `site.md`: 12 (4/4/4), `engine.md`: 8 concepts | **Eight: 3 startups, 3 small businesses, 2 medium** (the brief). Three milestones: two, six, eight | the owner asked for it; six is a complete first release and covers all three sizes | no |
| R4 | A medium business | `smb`: not a small team, tell as a floor; `site.md`: site or department, `FLOOR_MAX` 25; `engine.md`: a 72-seat glass floor | **A medium business is told as one site or one department of a larger company: `scope` is `site` or `department`, `floor` at most 25, building seats 1.0 to 1.6 times the floor.** The 72-seat floor and the curtain wall are dropped | no capacity claim is made or implied; the 72-seat floor was the costliest build (4 d, a new facade, 5,100 meshes) and the weakest story | owner may cap the gallery at six (3 and 3) |
| R5 | `cap-remote-access` | `site.md`: replace it for company copy to allow "from the office"; `claims.md`: keep the ban, write "at the office" | **Keep the base rule unchanged.** Writers say "at the office". The plan-note copy was rewritten to avoid the phrase | a rule that is weakened for one collection is a rule someone later reads as weakened for all; "from the office" is never needed | one `replace` entry |
| R6 | Claims rule set | `site.md`: 8 `biz-*` rules; `claims.md`: 25 | the 25 (tested on 97 positive, 143 clean and 48 ordinary sentences) plus three of the 8 (`biz-outcomes`, `biz-people-replaced`, `biz-hr-records`): **28 rows**, in `claims-office.json`, loaded only for company copy; two base rules replaced for company copy (`incumbent-attack` gains the business incumbents; `cap-autonomy` gains invoices, sends, signs, chases) | the 25 cover the other five of the 8 | no |
| R7 | The printed limits | `site.md`: `one-core-office` ("One Companion Core runs the office."), `per-app-signins`, `office-inside`; `claims.md`: the frame "One Companion Core sits on a shelf in the back room. The team's apps run on it. Each app keeps its own sign-ins." | the claims frame wording (`core-back-room`, `team-sign-ins`, `office-scope`), HOLD until the owner rules on D1 and D3. "runs the office" is dropped: it reads as a capacity claim | the lint cannot see an implication; the page prints the limit | owner wording |
| R8 | Engine effort | `engine.md` table E1 to E9: about 32 person-days; its own line items (section 3.2) add to more: P0 5.2 + P1 8.3 + P2 9.5 = 23 d for props against 13.5 d in its table | **Plan 34 person-days, range 28 to 41**: the 22-script gate sweep and the guard work unchanged; props at 18 d (the P1 items only the eight offices use, K2 or K1 Kenney for seating); the curtain wall and `room-clip` (a 26 m floor) dropped, the business context and signage kept for wave 3 | the table understates the props by up to 9 d; dropping the scale-up floor removes about 5 d | a props audit at the end of WP2C |
| R9 | The apartments and pass 2 | `site.md`: sequence the office work after both, or port; `engine.md`: merge apartments first | **Do not wait.** `company/v1` is additive to pass 2's optional blocks (`detail`, `day`, `profile`, `home`); the page ships Phase A on the a431fe6 shapes and gains Phase B (swap panels, day, plan pins) after the rebase. Under R1 the apartments' count copy and index rows do not touch offices. `scripts/own-authors.mts` is not needed (R10) | three branches that all edit `director`, `popup`, `runtime`, `pages`, `portal-front` must not become a serial queue | owner merge order |
| R10 | The credit guard and `author` | `engine.md`, `site.md`: `author: "Companion Intelligence"` and port `own-authors.mts` from the apartments tree | **Default: `author` is an internal token that no shipped text contains (`ci-offices-internal`), `source` is `original piece: CI offices`.** If the owner merges the apartments PR first, switch to `Companion Intelligence` and `own-authors.mts` in one commit | `author` is a required spec key (`validate-house-spec.mts:105`) and the guard (`portal-redact.mts:75-100`) reads every spec's and every index row's `author` as a builder handle, then fails the build if a shipped file contains it. The company's own name is on every page, so it cannot be a handle. A token that appears nowhere is a handle that guards nothing, which is correct: offices have no builder | one commit |
| R11 | Functions or lenses | `smb` D8: extend the archetype enum with 14 roles, or adopt story v3 lenses | **`function` (12 values, `functions.json`)** for company/v1; the archetype enum is untouched. Each person also carries a `lens` (one of the bible's 14 role ids) in the brief only: it steers the writer and is never shipped. If story v3 lands, `functions.json` gains a lens column | the 14 roles collapse onto 12 functions (section 5.4); archetypes are household jobs | a mapping column |
| R12 | Catalog | `smb` D5: admit ten office apps | **No admission is needed for the eight.** All 46 apps they name are in `catalog-apps.json`, all 46 have a QA screenshot, no entry in `reviewed.json` is needed, three are `with-caveat` (Documenso, Invoice Ninja, Listmonk) and their caveats ride in the briefs. Admission of OpenProject, Plane and the others is a later, separate decision | the briefs were written to the catalog as it is | later |
| R13 | `AMBIGUOUS` | `claims.md` 3.3: add `twenty`, `campfire`, `synapse`, `medusa` | **WP1.2 adds them to `AMBIGUOUS` in `scripts/story/lib/context.mts`** with an `ok-*` fixture, and proves the 30 families validate identically (`story:validate -- --complete` before and after). It is the one edit to a shared file that can change a family's result, so it is gated on that proof; if the proof is not clean the writers use "a twenty-person" and the edit is dropped | the word "twenty" is ordinary office prose | drop the edit |
| R14 | Reception beat | `office-contract.md` 10.2 `co-beats`: a beat at reception if the building has a desk | a reception beat is required only when the story has a reception chapter | four of the eight buildings have a reception room and a story is not obliged to tell it | no |
| R15 | Room chapters | `co-chapters`: workfloor, meeting, kitchen plus two further | **at least five room chapters**, including (workfloor or workshop), meeting and kitchen | the retail and trades offices have a workroom or a shop floor, not an open office | no |

---

## 1. Invariants

| # | Invariant | Held by |
|---|---|---|
| I1 | The 30 families stay byte for byte. After the whole job `git diff --stat main -- content/families content/story/{claims,roles,casting,cast-plan,personas,voices,ads}.json content/story/schema/family.schema.json reference/story/cast.md` is empty (except the `AMBIGUOUS` line if R13 is taken, which changes no family's validation result), and no `*.bake.json` of a family moved | acceptance of WP1.1 and WP7 |
| I2 | Extension, not edit: `roles.json` (hashed whole into every lock's `rolesSha`), `claims.json` (hashed into every film's `inputsSha`; 72 rules pinned by a test) and `personas.json` are not edited. `roles-office.json`, `claims-office.json` and `functions.json` are merged by `scripts/story/lib/kinds.mts` for company work only | `test-company-contract.mts` |
| I3 | A building is a house: an office is a HouseSpec in `content/houses/<id>.json` with `use: "office"`, listed in `index.json` under `offices`. The credit guard, the leak scan, determinism, the shot QA, the twins, the planner tracks all read that one folder | `scripts/validate/office.mts`, `test-office-buildings.mts` |
| I4 | Homes and offices never mix on a page: `index.houses` is the homes (the gallery, its count, its footer list, its sitemap rows); `index.offices` is the offices; the /office page lists companies, not buildings. A building under `offices` that no company uses, or a company whose building is a home, fails the build | `test-office-front.mts`, build step 5o |
| I5 | One slug namespace: a company slug is not a family slug and not a house id (`family/<slug>`, `company/<slug>`, `byFamily`, `byCompany`, `portal/og/<slug>.jpg` all key on it) | `co-casting`, `fleet-unique` |
| I6 | Every claim rule that holds for a family holds for a company, plus 28 business rows. Nobody is a customer. The Core has one owner; apps have their own sign-ins; the stories stay in the building | `check-copy`, the validator |
| I7 | No builder, no game: offices are CI's own pieces; no building name (`displayName`) appears in any story's words; the credit guard reads `content/offices` and the new pages | `check-leaks.mts`, step 8 |
| I8 | Determinism: a frame is a pure function of the tree. No wall clock, no `Math.random`; seeds from `mulberry32`/`fnv1a`; a new prop is registered after every existing module (seeds follow registration order) and under a new role | `test-compose-stability`, `test-build-neutrality`, `test-dress-neutral` |
| I9 | Shared-code edits are inert for a home: every change to `NAMES`, `PROGRAMS`, `fanPlan`, finish defaults, `INTEREST`, dress recipes is gated on `use === 'office'` and proved by the neutrality tests and (owner, macOS) the 150 goldens not moving | WP2B acceptance |

---

## 2. Names and spellings

| Thing | Family | Company |
|---|---|---|
| authored file | `content/families/<slug>.json`, `schema: "family/v1"` | `content/offices/<slug>.json`, `schema: "company/v1"` |
| generated beside it | `<slug>.voice.json`, `<slug>.bake.json`, `<slug>/audio/`, `<slug>/film/`, `films.json` | the same in `content/offices/` |
| the people | `members[]`: role, age, archetype | `members[]`: function, title, ownsCore (no role, no age) |
| the building | the house | the office, `use: "office"`, `index.offices` |
| casting | `cast-plan.json` -> `casting.json` -> `cast.md` | `office-cast-plan.json` -> `office-casting.json` -> `office-cast.md` |
| the page | `family/<slug>` | `company/<slug>` |
| the front page | `/` (`index.html`) | `/office` (`office.html`, served extensionless like `/room-creator`) |
| tour parameter / manifest map | `&family=<slug>` / `byFamily` | `&company=<slug>` / `byCompany` |
| the label | Fictional family. Real software. | Fictional company. Real software. |
| extension tables | (the base tables) | `roles-office.json`, `claims-office.json`, `functions.json` |
| ads manifest | `content/story/ads.json` | `content/story/ads-office.json` |

Why `office.html` and `company/` and not `office/`: `scripts/portal-lib.mts` `serve()` takes the directory branch first (`fs.statSync(file).isDirectory()` then `index.html`); with a file `office.html` beside a directory `office/` the request for `/office` answers 404 and Cloudflare's precedence cannot be checked from here. `room-creator.html` already proves a root-level page is served extensionless. (Verified by reading `serve()`; the live precedence is unverified until the first preview deploy.)

---

## 3. company/v1

Draft: `company.schema.proposed.json` (`$id https://homes.ci.computer/schema/company-v1.json`, 22 defs). Shared byte for byte with the family schema ignoring `description` (a test strips and compares): `id`, `appId`, `voiceKey`, `companion`, `camera`, `anchorLeaf`, `anchor`, `popup`, `detail`, `say`, `profile`, `closing`, `spot`, `chapter`.

| Part | family/v1 | company/v1 |
|---|---|---|
| top level | `family`; 2 to 6 members; 7 to 12 chapters; 22 to 40 beats | `company`; **3 to 8** members (the eight briefs use 5 to 7); 7 to 12 chapters; **24 to 40** beats (the briefs use 25 to 28) |
| the subject | surname, tagline, household, business, story, address, narrator, `home`, `day` | name, tagline, **sector, size, scope, headcount, floor**, story, address, narrator, `office`, `day` |
| member | id, name, age, role (9), work, colour, archetype, profile, companion | id, name, **function (12), title** (at most 40), colour, **ownsCore**, profile, companion. No age, no role |
| companions | 1 to 3, none under 13 | **exactly one, on the member who `ownsCore`** (validator `co-companions`); the agent belongs to the person who approves its work |
| beat | `category` (11 home topics), `segment` required | `category` (11 office topics: setup, documents, communication, customers, money, projects, engineering, design, marketing, people, it), no segment |
| `roomRole` | 13 | the 13 plus `reception`, `workfloor`, `meeting`, `server`, **`workshop`, `store`** |
| `roleId` | 27 | the 27 plus `workstation`, `meeting-table`, `whiteboard`, `server-rack`, `reception-desk`, `printer`, **`workbench`** |
| `address.line` | `^[0-9]{1,3} [A-Z][A-Za-z' ]{3,30}$` | the same: a house number and an invented street ("9 Tanyard Terrace"); the briefs use it (the draft briefs said "Unit 2", which fails; fixed) |
| `company.name` | surname | `^[A-Z][A-Za-z&'’ -]{2,38}[A-Za-z]$`, no digit, not in `company-names.json`, not a family surname |

`FICTIONAL_COMPANY_LINE = 'Fictional company. Real software.'` is a constant in `assets/story/types.ts`, held equal to the `fictional-company` row of `claims-office.json` by a test. Enum constants (`SIZES`, `SCOPES`, `FUNCTIONS`, `CO_CATEGORIES`, `CO_DAY_PARTS`, `OFFICE_ROOM_ROLES`, `OFFICE_ROLE_IDS`) are in `types.ts` and mirrored by `test-company-contract.mts` against the schema twin. `ROLE_IDS` and `ROOM_ROLES` keep their values.

**Size bands (`co-size`).** startup: headcount 3 to 12, scope `company`. small: headcount 10 to 30, scope `company`. medium: headcount 50 to 250, scope `site` or `department`, never `company`. `floor` at most `OFFICE_FLEET.floorMax` (**25**, owner decision) and at most `headcount`. The card line comes from scope and size and is written with `numberWord`: "About eleven people, all in this office" (company, floor equals headcount), "One site of a firm of about ninety", "One department of a firm of about a hundred". When `floor` is less than `headcount` for a `company` scope the line is "About fourteen people, six of them in this office" (a small delta to the card generator; none of the eight needs it).

**The adapter** `assets/story/subject.ts` (pure, browser and Node): `subjectOf(story)` returns `{ kind, slug, house, narrator, name, tagline, address, place ('home' | 'office'), fictionalLine, fictionalId, startTitle, fromTour, endLead, nextLabel, shareLabel, canvasLabel, pageDir, param }` and `memberLabel(story, id)` (archetype word or job title). `RuntimeStory` gains `about: Subject` (strings only, shipped in `story/<slug>.<hash10>.json`); its members become `Pick<Member, 'id'|'name'|'colour'|'companion'|'profile'> & { archetype?: string }` where for a company `archetype` carries the job title. `RuntimeStory.family` stays for one release. Print sites that read `about` after: `popup.ts:96,193,195,198,246,256,257`; `director.ts:124,324,638`; `a11y.ts:49`; `film/lib.mts:80`; `film/cut/plan.ts:328,276`. (Line numbers are the site report's; four were checked and found at those lines: `popup.ts:96`, `popup.ts:198`, `film/lib.mts:80`, `film/cut/plan.ts:328`. The skeptic pass found two more print sites of the family line, both in files WP5.2 owns: `scripts/story/build-og.mts:113` (the link-preview pill, `pill: FICTIONAL_LINE`) and `scripts/story/pages.mts:110` (the family page's footer sentence, "The families on this site are made up"). `assets/site/identity.ts:33` holds a fifth copy of the string but nothing imports that module (grep), so it needs no change.)

---

## 4. Roles, rooms and anchors

### 4.1 `content/story/roles-office.json` (proposed file in this folder)

Merged over `roles.json` by `mergeRoles(base, ext)` (a pure function in `assets/story/roles.ts`) for company stories and for `deriveHouseFacts(..., 'office')` only. Three rules of the merge: (a) `items`, `home`, `rooms` and `kindNames` keys of the extension override or extend; (b) **for an office the home-only room roles (`living`, `dining`, `bedroom`, `kids`, `garage`, `laundry`, `bath`, `garden`, `patio`) are dropped from `rooms`**, so a workshop is `workshop` and not also `garage` (the verified misfire: with the base table "Workshop" resolves to `garage` and `workshop`); (c) a family lock hashes the base table, an office lock the merged one, so no family lock goes stale.

| Room role | Matches (case-insensitive) | Rooms of the eight that use it |
|---|---|---|
| `reception` | reception, front desk, welcome, waiting | Reception, Waiting Room |
| `workfloor` | open office, open plan, workfloor, work floor, studio floor, team floor, bullpen, desk room, shop floor, sales floor | Open Office (with Mezzanine and Gallery variants), Studio Floor, Desk Room, Shop Floor |
| `meeting` | meeting, conference, boardroom, huddle, phone booth, focus room, pitch room, consultation, team room | Meeting Room, Meeting Nook, Pitch Room, Consultation Room, Phone Booth, Huddle Room |
| `kitchen` | kitchen, pantry, break room | Kitchenette, Studio Kitchen, Break Room |
| `server` (the Core's room) | server room, comms room, network room, it room, patch, back room, back office | Comms Room, Back Room, Back Office |
| `workshop` | workshop, print room, test lab, device lab, workroom, bench bay | Workshop Bay, Workshop, Print Room, Test Lab, Device Lab, Workroom |
| `store` | stockroom, stock room, supply room, archive room, store room | Archive Room, Supply Room, Stockroom |
| `office` (base) | study, office, den, desk, library ... | Partner Office, Estimating Office, Producer Office |

Item roles added: `workstation` (standing-desk, walnut-desk, writing-desk, dual-monitor-arm, laptop, office-desk), `meeting-table` (conference-table first), `whiteboard` (whiteboard, pin-board), `server-rack`, `reception-desk` (reception-desk, counter-run, bar-table, console-table), `printer`, `workbench` (workbench, tool-wall), and `bookshelf` widened (filing-cabinet). `universalBy.office` is `street, front-door, core, room, counter`: `couch`, `tv` and `garden` are **not** universal in an office, and `deriveHouseFacts` stops adding `garden` for `use: office`. The rule `co-anchor` holds every fallback chain to that list: every anchor in the briefs ends in `{ role: 'room', room }`.

**Landmines found by running the eight buildings' room names through the merged table** (all eight buildings now resolve): "Server Closet" is also a utility room (closet), "Edit Suite" a bedroom (`\bsuite`), "Hot Desk Hall" circulation and office, "Town Hall Lounge" living and circulation, "Entry Lobby" circulation (kept, it also matches the `entry` role). "Open Office Gallery" is circulation as well as office and workfloor: harmless because only `rooms` roles are used by chapters, but do not name a chapter room "Gallery". Every new name goes through `roomRoles` before a spec is frozen (a test, `test-office-roles.mts`).

### 4.2 `content/story/functions.json` (proposed file in this folder)

Twelve functions, each with a label (the filter word), the rooms and fallback rooms its people use, anchor roles and an app pool. The pools were widened to every app a brief gives a person of that function; the rooms gained `workshop` and `store`. `needsReview` lists pool apps with **no QA screenshot** (solidtime, rallly, homebox, formbricks, chatwoot, code-server, ollama): none is used by any brief.

| Function | Filter word | Rooms | People in the eight | Pool size |
|---|---|---|---|---|
| owner | Run the company | office, workfloor, server | 7 companies | 21 |
| operations | Operations | workfloor, reception, kitchen, store, workshop | 4 | 18 |
| finance | Money | office, workfloor | 4 | 12 |
| sales | Sell | workfloor, meeting, office | 4 | 12 |
| marketing | Market | workfloor, meeting | 2 | 16 |
| support | Support | workfloor, reception | 2 | 15 |
| engineering | Build | workfloor, server, office, workshop | 4 | 16 |
| design | Design | workfloor, meeting | 6 | 11 |
| projects | Projects | meeting, workfloor, workshop | 3 | 15 |
| people | People | meeting, reception, kitchen | 2 | 9 |
| legal | Contracts | office, meeting | 2 | 13 |
| it | IT | server, workfloor | 2 | 12 |

Kiwix is removed from the people pool (the owner's 2026-10-19 decision: Kiwix leaves all stories). The rule `co-functions`: each member has a beat in a room of its function (any of the room's roles counts: "Back Office" is `office` and `server`) and a beat whose app, or whose `with`, is in the function's pool.

### 4.3 The fourteen bible roles onto the twelve functions

founder_owner to owner; office_manager to operations (or people, when handbook and onboarding are the person's work); executive_support to operations (title "Executive support"; the word "assistant" is banned); cto_eng_lead and software_engineer to engineering; designer to design; sales_bd to sales; marketing to marketing; finance_bookkeeping to finance; people_hr to people; customer_support to support; it_admin to it; legal_contracts to legal; field_project_lead to projects. `member.title` carries the finer title. A brief person's `lens` is one of the fourteen ids (steers tone, comfort, AI stance and honest limit; never shipped).

### 4.4 The office text roles

`TEXT_ROLES` in `scripts/story/lib/anchors.mts` gains whiteboard, server rack, reception desk, meeting table, printer and wall screen, each tied to its role and to the building's `officeFlags` (the counterpart of `homeFlags`): the rule `co-text-role` fails a story that names one the building lacks. The eight briefs name a whiteboard (every meeting room), a wall screen (Reelwick, Curatory, Loamfield), a printer (Gutterfold's print room, the offices' printer station) and a reception desk (Lintel and Sill): the building specs must carry them (rule `office-meeting`).

---

## 5. The buildings

### 5.1 Spec field, index, guard

- `HouseSpec.use?: 'home' | 'office'` (default `home`), declared in `assets/spec/base.ts`, the office fragment `office?: { headcount?: number; company?: string }` and `rooms[].seats?: number` in `assets/spec/compose.ts` (`test-spec-types` fails the gate on any undeclared top-level field: verified by the engine spike). `reference/HOUSE-SPEC.md` documents them.
- `scripts/build-house-index.mts` writes `{ generated, houses: [homes, unchanged], offices: [{ id, name, author, emoji, style, storeys, areaSqm, headcount, source }] }`. A home's row is byte-identical (a test). `redactIndex` redacts both arrays; `builderHandles` reads both arrays and every spec.
- `allHouses(index)` (in `scripts/lib/list-specs.mts` for Node and a three-line copy in `assets/viewer.ts` and the head script of `room-creator.html`) is read by: `scripts/render-house-shots.mts:52`, `scripts/build-house-plan.mts:16`, `scripts/portal-lib.mts:103` (`houseIds`), `scripts/build-portal.mts:145,163` (step 5 ships both; 5c, 5d, the sitemap and the foot list stay on `houses`), `scripts/portal-redact.mts:65,83`, `scripts/story/check-leaks.mts:25`, `assets/viewer.ts:320`, `room-creator.html:53,7818,8039`. Verified by grep: these are the readers of `index.houses` that must see an office. The readers that must **not** (the gallery `portal/gallery.js:220`, `scripts/story/cast-lint.mts:41,96`, `index.html`'s counts, the 30-literal tests) are left as they are, which is the point of R1.
- `listSpecs({ kind: 'home' | 'office' | 'all' })` replaces the 22 `readdirSync(content/houses)` globs: homes by default for the fleet metrics (`fleet-audit`, `dress-*`, `test-dress-phase` K census, `test-compose-stability`, `test-light-rules`, `test-interior-light`, `test-shot-planner` ratchets, the `test-goldens` default list), `all` for the quality gates (`validate`, shot QA in `check`, `test-frame-hash`, `test-spec-types`, `test-floorplan-graph`, `test-twins`, `portal-redact`, `check-leaks`, `perf-house`). Office baselines are separate files (`test/fleet/baseline-offices.json`, `test/fixtures/hashes/compose-baseline-offices.json`) so no home baseline moves.
- `author`: see R10. `spec.name` is the internal filed name; the portal shows `displayName` from `assets/home-names.ts` (WP3.0 pins the eight). A display name must not appear in any story's words (checked: none of the eight does).

### 5.2 `scripts/validate/office.mts` (plugin, active when `use: "office"`)

| Rule | Severity | Meaning |
|---|---|---|
| `office-rooms` | error | the building has: a floor where work happens (`workfloor` or `workshop` room), a meeting room, a kitchenette, the Core's room (`server`: a comms or back room, or a back office holding the Core), and an entry or a reception |
| `office-seats` | error | work positions (desks and benches in workfloor, office and workshop rooms, 2 per workbench run, 1 per counter position) at least 0.7 and at most 1.6 times the company's `floor` (read from `office-casting.json`); 4 to 14 m2 of workfloor per seat (the engine's guidance is 6 to 9 gross for pods; a small startup room may be denser because the composer seats along walls) |
| `office-meeting` | error | a meeting table and a whiteboard or a wall screen in the meeting room; the table must be clearable (the spike's 3 x 3.5 m room with a 3 m table put the chairs against the window): table to wall at least 1.5 m on the chair sides |
| `office-core` | error | the hero (the Core) stands on a desk or a steel rack shelf in the `server` room, 2 m clear in front, not in front of glass; the Core's room is at least 3.6 x 3.6 m, which is 12.96 m2 (the 3 x 3 m room gave `foreground-occluder` 31 percent and a 51.5 degree finale lens); the check is on the two sides, not the area, and a 12 m2 room fails (Curatory's Comms Room was 12 m2 and is now 13) |
| `office-comms-blind` | error | the Core's room has no opening on a perimeter wall to the street (the scale-up spike put racks in a barred window); an interior glass wall onto the floor is allowed (Curatory) |
| `office-counter` | error | a counter run in the kitchenette or at reception (the `counter` role is universal) |
| `office-light` | error | `lighting.preset` is `day` (an ad may not show night) |
| `office-names` | error | room names resolve through `roomRoles` to an office role, are unique, contain no home word (bedroom, garage, suite, hall, lobby, lounge, closet) and no building or builder name |
| `office-author` | error | `author` is the internal token (R10) and `source` is `original piece: CI offices` |
| `office-newline` | error | no final newline (the homes' convention) |

### 5.3 The engine contract (WP2)

- **Programs** (`assets/room-programs.ts`, `assets/kit-rules.ts`: `PROGRAM_KIND` and `KIND` must agree): `workspace` (desk pods; the prototype composed 56 desks in 0.56 s), `meeting`, `reception`, `server`, `supply`, `shop` (retail only), `garage` extended (bench run, tool wall, parts rack). Name inference `NAMES` (first match wins, so inserted **before** `study`): `meeting: /meeting|conference|board ?room|huddle|war room|pitch room|consultation/i`, `workspace: /open[- ]?(plan|office)|work ?(space|floor)|bullpen|team (floor|area)|desk (area|zone|room)|hot[- ]desk|studio floor/i`, `server: /server|comms|network room|\bit room\b|patch|back (room|office)/i`, `supply: /print room|copy|supply|stock ?room/i`, `reception: /reception|front desk|welcome|waiting/i`. **Checked here against the 193 distinct room names of the 30 homes: no shipped room matches any of the five** (so inference, the dress phase and `shot-nav`'s `roomProgram` do not move for a home). **Gap (skeptic):** none of the five matches "Phone Booth". The roles table maps it to the `meeting` story role, but the composer program is inferred separately, and with no match the room falls through to `study`: the spike drew a closet with a bookshelf and a rug (`phone-SE.jpg`). Pin `program: 'meeting'` on the booth rooms (Reelwick, Curatory, Gutterfold) and give them the booth set (P1), or add `phone booth|focus room` to the `meeting` regex and re-run the check against the 193 names. `ANCHORS` (`layout-lint.ts`), `INTEREST` (`shot-nav.ts`: workspace 1.0, meeting 0.8, reception 0.5, server 0.3, supply 0.05, shop 0.9) and the dress recipes get rows. All gated on `use === 'office'` (I9).
- **Office look defaults** (`defaults: 2` only): no ceiling fans (`fanPlan` false), carpet or concrete floors by program (not the seeded walnut of the `work` kind), `styleKey` modern, daylight, `lot.context: city`; a new `business` context for the two wave-3 buildings.
- **Props**, by priority and by who needs them. P0, every building: office desk, light task chair (at most 8 meshes: the prototype's 19-mesh chair is too heavy), conference table, workstation kit, 42U rack (the 12U rack is 34 meshes), a shelf without books for the Core, reception desk, wall display width. P1, as listed per building below. P2, the building's own character. A new type goes under a **new role** (`office-desk`, `office-chair`, `meeting-table`, `reception-desk`, `server`), never an existing one, and is registered after every existing module (`baked.ts` stays last). **Never run `pnpm run catalog` on Linux**: from the pristine tree it rewrites 35 lines of `measured.ts` (17 plant boxes drift); give `build-prop-catalog.mts` an `--only <types>` mode that appends (0.5 d), or run it on the Mac.
- **Kenney** (CC0, 140 models, 26,737 triangles in all): default **K2, a Node GLB baker (+1 d), so no Mac and no Blender is needed**; K1 (the Blender pipeline on the owner's Mac) is the alternative. Used for seating, tables, shelving, plants only (the look is chunky, in the family of the 30 homes' low poly). Budget per office: at most 5,000 meshes and 11,000 offline draw calls, at most 12 meshes per seat, a prop at most 60 draw calls (the existing gate). With the 72-seat floor dropped the eight stay under it with procedural seats (the largest, Loamfield at 30 seats, about 1,100 meshes of seats); Kenney becomes an option, not a requirement.
- **World** (wave 3 only): `lot.context: 'business'` (low commercial neighbours, flat roofs, a car park, no gabled houses; 2 d), a blank fascia board and totem (0.5 d, no lettering: a company name is a claim and a collision risk), blinds drawn 40 percent on our own windows (0.3 d). No curtain wall, no `room-clip` change (no room is wider than 20.46 m: the largest, Loamfield's Open Office, is 96 m2).
- **Never** in WP2: edit `content/houses/`. Streams prove a feature on `test/fixtures/houses/office-*.json`; WP3, the layout pass, bakes into `content/houses/` (CLAUDE.md, "Streams never edit content/houses").

### 5.4 The eight buildings

| Building id (working) | Company | Concept | m2, storeys, seats | Rooms | Needs beyond P0 | Wave | Days |
|---|---|---|---|---|---|---|---|
| `startup-loft` | Reelwick | converted brick warehouse bay, arched steel windows, closed neighbour bay (spike exists: 0 shot errors) | 96, 1, 8 | 7 | Core room to 3.6 x 3.6; phone booth; blinds | 1 | 1.5 |
| `practice-townhouse` | Lintel & Sill | Georgian terrace: sash windows, columned porch with fanlight, hip roof, dormers, chimney | 215, 3, 12 | 11 | reception desk (counter-run stands in at P0); executive desk variant; filing cabinets (exist); plan chest | 1 | 2 |
| `garage-lab` | Pannierwell | converted two-bay garage with a side annex, one 4.8 m garage opening, driveway, cargo bike | 90, 1, 6 | 6 | trades set: bench run, tool wall, parts rack; test rig | 2 | 1.5 |
| `agency-printworks` | Gutterfold | dark-brick printworks, glazed former loading door, double-height studio floor, mezzanine over 40 percent | 290, 2, 18 | 9 | pin-up wall, plotter and plan table (agency set); mezzanine rails (APARTMENTS 2.6); two stairs | 2 | 3 |
| `shop-backoffice` | Posy & Pail | high-street brick unit, glazed shop front, green awnings, blank fascia, closed neighbour unit (spike exists) | 125, 1, 8 | 6 | retail set: wall shelving, display tables, cash counter, buckets (3 d); fans off; the back office as a desk-and-printer room, not a home study | 2 | 1.5 + 3 props |
| `hub-courtyard` | Loamfield | two-storey vertical-timber building on a stone plinth, mono-pitch roof, sliding glass to a planted courtyard, pergola (garden-flat pattern), scaled down from 520 to 380 m2 | 380, 2, 30 | 12 | dev set: device shelves, test bench (1 d); courtyard under 8 m; many rooms | 2 | 2.5 |
| `dev-shop-unit` | Curatory | business-park unit, corrugated steel and glass front, flat roof, covered deck, bike store; Comms Room with a glass wall onto the floor | 260, 1, 14 | 8 | business context; fascia board; steel shelving; dev set (device lab) | 3 | 2 |
| `contractor-yard` | Hartnoll Joinery | corrugated workshop shed 5.2 m high plus a two-storey office block, two roller doors, a van in the yard | 310, 1 and 2, 24 | 9 | business context; per-volume roofs and clip (untested); trades set (tool wall, pallet rack) | 3 | 3 |

Total about 17.5 d of spec work plus 3.2 d of integration (0.4 d a building: index, twins, plans, tracks, thumbnails, previews, names) plus the retail set. The engine report's concept 7 (the 72-seat glass floor, 4 d) is **dropped** and the garage startup (no new engine construct) added.

### 5.5 Goldens, baselines, gates

`test-goldens.mts` exits 1 for a house with no baseline (profiles exist for `macos-metal` only). Until the owner blesses on the Mac (`pnpm run goldens:update --house <id>`: 5 frames a building, 40 in all; never on Linux, never re-bless the 30), `use: office` ids are skipped by the default list and reported as "unbaselined" by `check`. The fleet audit, the compose baseline, the planner tracks (`pnpm run shot-planner -- --house <id> --update` writes `test/shots/<id>.track.json`), the dress baselines and the `test-ui` home count are office-specific files or `listSpecs({ kind: 'home' })`, so the home baselines are not re-recorded. Shot QA (`render-house-shots --qa-only --shot door-to-core,orbit,core-orbit,hero-reveal`) must show 0 errors for each office; warnings are listed and each explained (the spikes' known ones: `fov-range`, `door-funnel`, `foreground-occluder`, `look-error`). The route is one storey of climbing at most; the Core is on the entry storey; film length is controlled by the Core's place (put the comms room near the entry), not by the planner.

**Skeptic notes on the engine.** (a) `hero:contrast` warned in two of the three spikes (1.06 against 1.25: a charcoal Core on a wood shelf); chalk on blue-grey passed. Three buildings put a chalk Core on a steel rack shelf (Curatory, Hartnoll, Loamfield): pick the wall colour in the first render, do not assume it. (b) The Python twins (`generate_house_iso.py`, `generate_floor_plans.py`) loop every file in `content/houses/`; a plain `pnpm run iso` or `floorplans` after the first office lands rewrites `scenes/manifest.json` and `floorplans.json`, so WP3 and WP3.Z must always pass `--only <id>`; say so in `reference/OFFICES.md`. (c) The contractor yard's per-volume roofs and clip are untested and the plan says "plan a spike day" without costing it: carry +1 day on WP3.contractor-yard. (d) Posy and Pail's hero objects are buckets of stems; the retail set lists buckets but no stems or flower bunches: price one flower-bucket prop (cylinder plus at most 40 stems, one role, one `HOSTS` entry) at 0.5 day. (e) The visible desks of the two medium buildings (24 and 30 seats) are a capacity cue (plan risk 14): the Open Office stays at 14 and 16 seats and the other seats go in the rooms the story does not visit, or the owner accepts it under O3.

---

## 6. Claims: `content/story/claims-office.json` (proposed file in this folder)

`claimsFor('company')` is `claims.json` with `replace` applied plus the added rows and disclosures; used by the company validator, `check-copy.mts` for `company/*` pages and the /office page, the film and the cuts.

**Added rows (28, all `error` except `biz-tax-payroll`, `biz-call-recording` and `biz-audience`, which are `review`):** `biz-capacity`, `biz-access-roles`, `biz-availability`, `biz-backup`, `biz-residency`, `biz-encryption`, `biz-compliance-words`, `biz-compliance-acronyms`, `biz-privilege`, `biz-esign-valid`, `biz-books-correct`, `biz-tax-payroll`, `biz-surveillance`, `biz-call-recording`, `biz-remote-work`, `biz-mobile`, `biz-support`, `biz-licence`, `biz-cost`, `biz-ai-claims`, `biz-migration`, `biz-domain-contact`, `biz-testimonial`, `biz-audience`, `biz-secure-private`, `biz-outcomes`, `biz-people-replaced`, `biz-hr-records`. Each needs a case in `scripts/story/lib/bad-cases-company.mts` and a fixture; the false positives of `claims.md` 3.3 get `ok-co-*` fixtures ("a plant nursery", "scale" the object, "twenty desks", "Memos go out on Monday").

**Replaced for company copy:** `incumbent-attack` (the list gains QuickBooks, Intuit, Xero, FreshBooks, DocuSign, HubSpot, Zendesk, Intercom, Atlassian, Confluence, Jira, Asana, Trello, Okta, GitHub, GitLab, Figma, Miro, Airtable, Zapier, Datadog) and `cap-autonomy` (the verb list gains invoices, sends, signs, chases, reminds). `cap-remote-access` is **not** replaced (R5).

**The honest team form** (printed once per office, claims 2.1; HOLD on D1): "One Companion Core sits on a shelf in the back room. The team's apps run on it. Each app keeps its own sign-ins. Ines is the owner of the Core. She installs the apps." Per-app accounts are named as that app's own feature ("Mattermost has an account for each person. That is Mattermost's own feature."). Not allowed: "multi-user", "separate accounts", "every app has its own sign-in" (`num-app-counts`: say "each app"), "invite the team", "the whole company runs on one Core".

**Disclosures** (printed from the file, never typed in a story; every text passes every rule, tested):

| Id | Text | Where | Status |
|---|---|---|---|
| `fictional-company` | Fictional company. Real software. | /office hero, every company page, the player chrome, the first two seconds and last card of every film and cut, the corner mark, og:description | owner wording |
| `fictional-company` (long) | {company} is a fictional company. The people in it are characters, not customers. The software is real. | company page, share pages | owner sign-off (T15) |
| `not-customers` | The companies on this site are made up. They are not customers. | footers | |
| `core-back-room` | One Companion Core sits on a shelf in the back room. The team's apps run on it. Each app keeps its own sign-ins. | the strip of a company page, the tour start card | HOLD (D1) |
| `team-sign-ins` | One Companion Core belongs to one owner. The apps on it keep their own sign-ins. | footer, About | HOLD (D1) |
| `office-scope` | Every scene stays on the office network. | footer, end card | HOLD (D3) |
| `openclaw-office-internet` | OpenClaw reaches websites over the office internet. | an OpenClaw beat that opens a website (Pannierwell, Hartnoll) | replaces the home wording for offices |
| `first-party-crash` | First-party apps send crash reports to Companion Intelligence unless you switch that off. | footer, end card when a first-party app is named (all eight name one) | |
| `not-advice` | Nothing here is professional advice. Ask your accountant or your adviser. | footer of a page that names an invoicing or books app | |
| `licence-terms` | Some apps carry their own licence terms. Read an app's licence before the team relies on it. | credits; a beat naming n8n, Invoice Ninja, Akaunting, Planka, BentoPDF or Twenty. Akaunting's free production use is limited to two users, one company and one thousand invoices, so a story shows one person in it | counsel |
| `apps-by-others` | Apart from the first-party apps, the apps in these stories are made by other people. Companion Intelligence did not make them. | credits | replaces `third-party-apps` for offices (that text says open-source projects, untrue of four of the apps used) |
| `owner-backups` | A second copy of the files, kept somewhere else, is still the company's job. | company footer | HOLD, not printed by default (backup is banned until the owner rules) |

The base disclosures still print: `beta-short`, `scripted-scenes`, `stylised-art`, `names-owners`, `internet-steps`, `apps-availability`, `synthetic-voice` (when the tour has a voice), `attribution-agents` (when Hermes or OpenClaw is named). `check-copy.mts` scans the whole page text with only the copyright sign exempt, so a disclosure must pass the rules itself: a fixture keeps it so.

**Setting limits** (claims 3.6, applied): green: design and build studios, software and hardware startups, agencies, architecture practices, trades, retail back rooms, a product department. The eight are all green. Amber (accounting and bookkeeping practices, law practices, recruiters) and red (clinics, financial advisers and crypto, schools and children's services, security and defence) are not used; an accounting practice in the townhouse is a later, separate decision.

**Words writers trip on** (tested): "assistant" (write "office coordinator", "executive support"), "remote", "from the office", "multi-user", "roles", "permissions", "compliance", "certified" (write "qualified"), "audited", "guarantee", "case study", "marketplace" (write "platform"), "stand-up in five minutes" (write "stand-up is at nine"), "Q3", "24/7" (any digit fails `digits`), "knowledge base" (write "handbook", "help pages"), "private", "secure", "safe", "encrypted", "backed up", "payroll" (write "the pay service"), "customer" for anyone on the site (the briefs use "client", "museum", "couple" for the fiction's own people), "ledger" and "chart of accounts" (`biz-books-correct`: write "the full books"), "permissions" (write "sharing settings"), "payroll" (write "the pay service").

---

## 7. The validator

### 7.1 Shape

`loadContext(root, { world, kind })` loads for `kind: 'company'` the merged claims and roles, `functions.json`, `office-casting.json` as `officeCastBySlug`, `company.schema.json`. `validateCompany(data, ctx)` sits beside `validateStory`; `validateAny` routes on `data.schema`. The shared modules (`text`, `shape`, `apps`, `agents`, `ftue`, `anchors` with a kind-aware universal list, `persona-no-ui`, the film quotas) take a story core (`slug`, `house`, `members`, `chapters`, `beats`, `closing`, `narrator`, `subject`) so they run unchanged; the differences live in `scripts/story/lib/co/`. `userStrings()` gains the company strings (name, tagline, sector, story, address, office lede and spots, day lines, member titles, profile bios). `scripts/validate-stories.mts` gains `--kind family|office` (default both, families first), looks a positional slug up in `content/families` then `content/offices`, and `--complete` counts each kind's fleet separately.

### 7.2 Rules (company only; every shared rule keeps its id)

| Rule | Sev | Meaning |
|---|---|---|
| `schema` | error | the file does not match `company.schema.json` |
| `co-casting` | error | slug, house, name, place, address, size, scope, headcount, floor, narrator and each member (id, name, function, title, ownsCore, companion name) equal `office-casting.json` |
| `co-size` | error | the bands of section 3; `floor` at most 25 and at most `headcount`; featured members at most `floor` |
| `co-members` | error | 3 to 8; ids and names unique; the first-run beats are the owner's; each member has at least 3 beats |
| `co-owner` | error | exactly one `ownsCore`, with a beat in the `server`, `office` or `workfloor` room |
| `co-companions` | error | exactly one companion, on the owner; an agent beat has an `approval`; at most six `say` lines |
| `co-functions` | error | at least 3 distinct functions; each member has a beat in a room of its function and a beat whose app is in its pool |
| `co-rooms` | error | a chapter or anchor `room` is an office room or `street` / `patio` / `entry`; never `bedroom`, `kids`, `garage`, `laundry`, `bath`, `living`, `dining`, `garden` |
| `co-chapters` | error | first ftue, last outro; **at least five room chapters** including (workfloor or workshop), meeting and kitchen; the building has each room (warning otherwise) |
| `co-beats` | error | 18 to 34 room beats; a beat on `meeting-table` or `whiteboard`; the owner has a beat on `server-rack` or in the Core's room; two beats in the kitchen; a reception beat only if there is a reception chapter |
| `co-categories` | error | setup, documents, communication, money and it in every company; at least 8 of 11 |
| `co-anchor` | error | every chain ends in a role of `universalBy.office` |
| `co-text-role` | error | text names a whiteboard, server rack, reception desk, meeting table, printer or wall screen the building lacks |
| `co-app-facts` | error | a beat contradicts the app-facts table of section 16.2: a stateless or storage-less app (draw.io, Excalidraw, Inkscape, Stirling-PDF, BentoPDF) "saved", "kept", "stored" or "sits" on the Core; Excalidraw with a `bringHome`; Pi-hole as "name lookups", "resolver", the router's or the network's DNS; a Hermes beat that "reads" another app's data; Akaunting in beats of three or more different people; "each person" with a Grist, draw.io or Excalidraw sign-in; Uptime Kuma "checks the Core" |
| `co-day`, `co-office` | error/warn | the pass-2 `day` and `home` rules with the office parts (Phase B) |
| `co-names` | error | `company.name` is not in `company-names.json` (real and sample names: Northwind, Contoso, Acme, Globex, Initech, and the replaced services' own names) and is not a family surname; no house id, no building display name in any string |
| `co-bring-home` | warn | a swap whose service has no entry in `bring-home.json` |
| `co-limit` | review | a bring-your-data-home beat whose text claims the move was whole (backed by `biz-migration`) |

### 7.3 Fleet (`--fleet`, `--complete`): `OFFICE_FLEET` in `scripts/story/lib/co/limits.mts`

| Constant | Value | Plan holds |
|---|---|---|
| companies | 8 (3 startup, 3 small, 2 medium) | 8 (3/3/2) |
| `floorMax` | 25 | 24 largest |
| members per company | 3 to 8 | 5 to 7 |
| beats per company | 24 to 40 | 25 to 28 |
| distinct apps | at least 40 | 46 (42 third party) |
| third-party app share | at most 37.5 percent (three of eight); first-party exempt | every app at most 3 |
| functions | each function in at least 2 companies; owner in at least 6; engineering, design, sales, operations, finance in at least 4 | owner 7, design 6, engineering 4, sales 4, operations 4, finance 4, all others 2 or 3 |
| topics | setup, documents, communication, money, it in all 8; every other topic in at least 2 | marketing 2, engineering 4 |
| rented services named | at least 40 distinct | 43 (47 before the skeptic pass dropped Datadog, New Relic, WeTransfer and Google Workspace) |
| narrators | at most 2 per voice key | 2 each on four keys |
| uniqueness | company name, place, companion name, beat title outside the first run, beat body: unique across the eight; **a first name at most twice across the 30 families and the 8 companies**; company name not a family surname | all unique; no first name shared with a family |
| film | 8 to 12 flagged beats, at most 215 spoken words, estimated 75 to 115 s | 8 or 9 flagged, 188 to 205 words with the 3-word sign-off (`filmWords` adds it; the briefs' earlier figures left it out) |

Gates `fleet-co-count`, `fleet-co-sizes`, `fleet-co-topics`, `fleet-co-apps`, `fleet-co-functions`, `fleet-co-services`, `fleet-co-voices`, `fleet-unique`, `fleet-cross`; count gates are "partial" until `--complete`, uniqueness gates always gate.

### 7.4 Fixtures

`test/fixtures/stories/company/` holds an exemplar (a trimmed 24-beat company with its own `world/`, `office-casting.json` and one frozen office building), `bad-co-*` fixtures (each the exemplar plus one mutation, written by `make-bad-fixtures.mts --kind office` from `bad-cases-company.mts`) and `ok-co-*` guards. The exemplar passes with 0 errors, 0 review, 0 warnings. `scripts/test-company-validator.mts` asserts each fixture is the exemplar plus its mutation. Each row of the app-facts table (16.2) gets one `bad-co-app-facts-<app>` fixture and one `ok-co-app-facts-<app>` guard ("Excalidraw exports a picture" passes; "the sketch is saved on the Core" fails).

---

## 8. Cast: `office-cast-plan.json` and the fleet

`content/story/office-cast-plan.json` (authored; seed in `office-cast-plan.proposed.json`): per company `slug`, `house`, `name`, `place`, `address`, `size`, `scope`, `headcount`, `floor`, `sector`, `narrator`, `signatureApps`, `beatApps`, `reviewNeeded`, `members[]` (id, name, function, title, room, ownsCore, companion name, runtime, voice). `scripts/story/office/build-casting.mts` derives `office-casting.json` (rooms, kinds, role counts via `deriveHouseFacts(..., 'office')`, the Core's room, each member's anchor chain from `functions.json`, `officeFlags`) and `reference/story/office-cast.md`; `--check` fails when stale; `cast-lint.mts` holds the plan to the fleet rules. The room names in the plan are the real rooms of the baked building: update them when WP3 freezes a building. The cast plan is the **only** source of who is who: a company file tells exactly its people, and to change a person you change the plan and run `story:cast:office`.

---

## 9. The pipeline

| Step | Command | Change |
|---|---|---|
| cast | `pnpm run story:cast:office`, `story:cast:office-lint` | new |
| validate | `pnpm run story:validate -- <slug>` | resolves the slug in either folder; `-- --kind office --complete` |
| voice | `pnpm run story:voice -- <slug>` | `listSlugs()/storyPath()/lockPath()/audioDir()` in `scripts/voice/lib.mts` use `scripts/story/dirs.mts` (`storyDirOf(slug)`); `CI_STORY_FAMILIES_DIR` still points all tools at one folder for tests. A company with no voice lock is a captions-only tour, as every family is today. **Kokoro is not installed (3 GB, owner approval)**: the first release has no voice |
| bake | `pnpm run story:bake -- <slug>` | `story-bake.mts:30` `FAMILIES` to `dirs.mts`; `rolesFor(kind)` supplies the merged table |
| film | `pnpm run story:film -- <slug>` | refused while durations are estimated, so **films wait for the voice**; `filmText()` (`film/lib.mts:79`) uses `subjectOf` |
| ads | `pnpm run story:ads -- --family <slug>` | reads both folders; `ads-office.json` is the office manifest; `--check` checks both; silent cuts need no voice |
| og | `pnpm run portal:og` | companies and `office.jpg` (kicker COMPANION CORE · FICTIONAL COMPANY); rows in `portal/og/manifest.json` |
| index | `pnpm run index`, `pnpm run office:index` | `index.json` offices array; `office.html`'s count words |
| build | `pnpm run portal:build` | step 5o (section 10) |

**Derived files** (never hand-edited): `content/houses/<id>.plan.json` (`pnpm run plans`), `content/houses/index.json` (`pnpm run index`), `scenes/svg`, `scenes/lottie-scenes`, `scenes/manifest.json` (`pnpm run iso -- --only <id> --no-manifest`, then WP3.Z writes the manifest), `scenes/floorplans` (`pnpm run floorplans -- --only <id> --out <tmp>`, copy the building's own sheets; `floorplans.json` is WP3.Z's), `test/shots/<id>.track.json`, `portal/thumbs/<id>.webp` and `portal/previews/<id>.jpg` (`pnpm run portal:thumbs -- --house <id>`), `content/story/office-casting.json` and `reference/story/office-cast.md`, `content/offices/<slug>.bake.json`, `.voice.json`, `<slug>/audio`, `<slug>/film`, `films.json`, `content/story/ads-office.json`, `portal/og/*`, `dist/`.

---

## 10. The site

### 10.1 Routes and files

`dist/office.html` (`/office`), `dist/company/<slug>.html` (`/company/<slug>`), `dist/story/companies.<hash10>.json` (the cards), `dist/story/<slug>.<hash10>.json` (the tours, by the existing ship step), `dist/portal/office.*.js|css` and `company.css` hashed by step 5e, `dist/portal/og/<slug>.<hash10>.jpg`, the sitemap rows. Every URL relative and extensionless; four company links on every page (`https://ci.computer`, `/core`, `/download`, the docs); one `<h1>` and one `<main>`; titles at most 60 characters, descriptions at most 160; `data-cfasync="false"` on every executable script; content-hashed modules; no analytics change (the footer never says "no analytics": the deployed site injects Google Analytics).

### 10.2 Build (`scripts/build-portal.mts`; WP7 edits it once)

| Step | Today | Change |
|---|---|---|
| top | `OWNED` (line 111) | add `office.html`, `company` |
| 5 | `houses = index.houses` | ships specs for `index.offices` as well (redacted); thumbnails and previews are checked for both |
| 5b, 5c, 5d | static stats and the "thirty" word, `homes/<id>.html`, the families' front cards | **unchanged** (they read `houses`, the homes): this is what R1 buys |
| 5c2 | `buildStorySite(...)` | unchanged |
| **5o** | (new) | `buildOfficeSite({ ROOT, OUT, SITE, args, problems, offices })`: company pages, `byCompany` and the cards file added to the manifest `buildStorySite` wrote (`site.mts` is not edited), the ship steps for companies, `office.html` written from its source with cards, buttons, stats, foot list, hero tour (`OFFICE_HERO`: Lintel & Sill); `countCopy(html, { noun: 'offices', n })` |
| 5d2 | `seo()` for index, player, homes | `seo('office.html', …)` and `seo('company/<slug>.html', …)` (WebPage and BreadcrumbList; `CollectionPage` + `ItemList` for /office; never an `Organization` for a fictional company); sitemap rows; `notFoundPage` offers both galleries |
| 5e | hashes index.html and the `homes/`, `family/` dirs | plus `office.html` (one level up) and `company/` (one level down) |
| 6, 7 | scans and page rules | `pages` gains `office.html` and every `company/*`; company pages also: tour link carries `house` and `company`, the fine print names the office (display name, no link, no credit), canonical is `company/<slug>`, `og:title` equals `<title>`, unique titles; `office.html`: the static cards equal the current companies in order, the size and function buttons are present, the foot list equals the companies |
| 8 | the credit guard over every text file of `dist/` | unchanged: it now also reads `office.html` and `company/*`, and the author token |

**Count words.** `numberWord` and `capital` stay in `portal-pages.mts`. `office.html`'s heading ("Eight offices."), description, og:description and its two figures (offices; square metres of floor) are written by `pnpm run office:index` from `office-casting.json`; the build compares the page to the companies that are **current**: in production (`--strict-families`) a difference is an error; in a development build it rewrites the built page's words to the built number and prints a note. `index.html` is not touched (the apartments PR owns its count copy). No count appears in the player's description ("a virtual home or office"), the 404 page or the web manifest.

### 10.3 The /office page (all static HTML; the script only filters)

1. **Hero.** The label; h1; a lede that names three people and what the company keeps on the Core; one action `Take the tour` (the flagship's tour); a pointer `Meet the companies`; the Core card ("Every office has a Companion Core in it. Take a tour to find it.", `See Companion Core`, "Companion OS is in beta."); two stats; the flagship building's 1200 px preview (a phone gets the 640 px thumbnail, `fetchpriority="high"`).
2. **Pick a role.** Four cards for the functions the companies share most (owner in 7, design in 6, then a four-way tie of finance, sales, engineering and operations, of which the page takes finance and engineering; the other functions are in the filter buttons), each with its three most-used apps and "In 7 of the 8 fictional companies", plus one panel per function: **Rented before, on the Core now** (Phase B; Phase A shows the apps as chips).
3. **Meet the companies.** Search; size buttons (Any size, Startup, Small business, Medium business with counts); function buttons for the functions some company has, with counts; the grid of eight cards; the empty state; a `<noscript>` line.
4. **What the offices run.** The wall of the 46 apps the stories name, text beside (Phase B: vetted real) logos, filtered by the function chosen.
5. **How it runs.** The Hub and the Companion account with labelled real screenshots (Phase B), plus the held lines `core-back-room`, `team-sign-ins`, `office-scope`.
6. **The one Core band** (`#core`): `Buy Companion Core`, `Download Companion`, `Read the docs`, the beta line.
7. **Footer.** The six company links; "Every company, on its own page"; the fictional and `not-customers` lines; the copyright.

**Copy deck** (every string linted under the merged rules: `gen/strings-plan.json`, 35 of 35 clean, titles at most 60, descriptions at most 160): `<title>` "Virtual offices · Companion Intelligence" (40); description "Eight offices, each with a fictional company on one Companion Core. Tour them to see chat, books, customers and code. Fictional company. Real software."; h1 "Eight offices. Each with a fictional company and a Companion Core." (the earlier h1, "Each team's work, on one Companion Core", printed the held `core-back-room` sentence as a headline; `gen/strings-plan.json` still has the old one); label "Fictional company. Real software."; lede "The people at Lintel & Sill keep their drawings, post, hours and fee invoices on the one Companion Core in the old pantry."; second sentence "Take the tour to see which Companion Hub store app does each job, and which rented service it replaces."; "Pick a role" / "Every office has people who do different jobs. Choose a role to see the companies and the apps they run."; size buttons Startup, Small business, Medium business; the function words of `functions.json`; footer "The companies on this site are made up. They are not customers."; tour note "The tour draws the office in 3D in your browser."; card scope lines of section 3. Words kept out: "SaaS", "seat", "workspace", "team member" for a character, "customer" for anyone on the site, "remote", "assistant", "log in", any figure of money, time saved or capacity.

**The card** reuses `.card-family`'s rules by selector (a two-selector edit in `site.css`), shows the size tag, the name as a stretched link, "Sector · place", the scope line, up to six people with their titles, up to four apps with "replaces <service>" (text, and logos only in Phase B). **`portal/office.js`** (about 120 lines, no fetch) adopts the static cards and keeps state in the address (`?q=&size=&fn=`), keeping every other parameter byte for byte (a campaign's tags); counts follow the other filters; a button that would show nothing is disabled unless pressed; `/` focuses the search; Escape clears it. Header: `Homes | Offices` as two nav links with `aria-current="page"` on every page type; the footer is untouched (a test pins its six links); at 360 and 390 px Homes, Offices and Buy Core stay and nothing scrolls sideways.

### 10.4 A company's page: `/company/<slug>` (reads with no JavaScript and no WebGL; an ad's landing page)

Above the fold: the label; h1 = the company's name; the tagline; "Sector · place · Size"; the building's picture as the poster; `Take the tour` and `See Companion Core` (exactly `https://ci.computer/core`); "The tour draws the office in 3D in your browser." The strip: `fictional-company`, `beta-short`, `scripted-scenes`, `stylised-art`, and (HOLD) `core-back-room`, `team-sign-ins`, `office-scope`. Then: **Meet the company** (the story; one disc per person with name and job title; the scope line); **Rented before, on the Core now** (Phase B); one section per person (id anchor `#anselm`; disc, name, title, function word, room; their moments with chips "App" then "replaces Service", each "Watch this moment" = `&beat=<id>`; "Start with <name>" = `&member=<id>`); **A day at work** (Phase B); **The office** (the lede and spots, the facts from the building, the plan with a pin per person, Phase B; the plan note "A diagram of the rooms, drawn from the layout. It leaves out walls, doors and stairs. The pins show the room each person works in, and the small mark shows the Companion Core."); **Bring your data home** (for each rented service in the stories that has a row in `content/story/bring-home.json`, curated from the 60-service research: how the data leaves the service, where it lands, what comes along and **what does not**; no effort band, no vendor link in the first release, no claim that a move is whole); **What runs on the Core** (each distinct app with what it replaces and its Companion Hub store page; `apps-by-others`, `licence-terms`); next and previous company; the close; the footer (the label, `not-customers`, `beta-short`, `apps-availability`, `names-owners`, `first-party-crash`, `attribution-agents`, `synthetic-voice`, `not-advice`, and "The office is Brickworks Bay." with no link and no credit). Title "<Company> · Virtual offices · Companion Intelligence", the brand dropped over 60 characters, distinct across the site. JSON-LD `WebPage` + `BreadcrumbList`.

**Phase A and Phase B.** Phase A uses only what a431fe6 has (the v1 beat shape, chips as text, no logos, no screenshots, no day, no plan pins). Phase B (after the rebase on pass 2) switches on `detail`, `swapHtml`, `dayHtml`, the plan block, `runsInner`, the vetted media. `company/v1` carries those blocks as optional, so a Phase A story file stays valid and gains them in a later commit.

---

## 11. Tour, film and ads

**Tour.** `assets/viewer.ts:155` imports `story/mount.js` for `family` or `company`; `OWN_PARAMS` (`viewer.ts:137`, `url.ts:19`, held equal by `test-story-url.mts`) gains `company`; `mount.ts familyOf()` reads `byCompany` when the address has `company`; `nextTour()` takes the map it is given, so "Next company" stays inside offices; `tourHref()` takes the parameter name. The head script of `room-creator.html` (the `fam` regex, the failure card, the back link, the title) reads `company` the same way and links `./company/<slug>` ("Read the company's story") and `./office` ("See all offices"); an office opened with no company says "offices" on every back link and card. The start card reads "<Name> at work" and "Start with Anselm, Chief technology officer"; the end card "This company is fictional. The software is real."; share goes to `company/<slug>`. A tour opens in daylight. With `family=` nothing changes: the player leg of `portal:test` passes untouched, and the `__house*` hooks do not change.

**Film and ads.** Label `Fictional company. Real software.` from the disclosure `fictional-company`: the corner mark of every frame, the pill on the end card, in view within the first half second of the title card. The renderers already take the badge and end strings as parameters, so the change is `filmText()` and the cut plan's first disclosure id (`film/cut/plan.ts:328`; `:276` `no archetype` becomes `no function`); the frames are untouched, so no golden moves. The end card keeps "UnCloud your life.", `ci.computer/core`, and the plain disclosures. A cut is one member's story, 15 to 25 seconds, silent, four shapes; **three cuts a company render first** (the plan names them: the owner, a money or sales person, an engineer or the support person; 24 cuts), in 1:1, 4:5 and 16:9 for LinkedIn and the feed and 9:16 for Reels, Shorts and TikTok; the card names the person and the title ("Oskar, Appointments and contracts coordinator"), the chips are the app and "replaces <service>", the end card is `See Companion Core` with `ci.computer/core`. `story:ads -- --check` checks `ads.json` (families) and `ads-office.json` (companies) separately; a company cut whose words fail the merged rules or the credit guard is `blocked`, as a family's is. The hook rule is unchanged (the first flagged beat in a room or outside chapter, else the first beat with a `replaces`); the eight briefs name the hook beat of each cut and the hook line of each company (for example "Drawings sit on the Core, in the office"). A 90-second company film needs the voice lock and so waits for Kokoro.

---

## 12. Counts and guard changes (under R1)

| File | What | Action |
|---|---|---|
| `content/houses/index.json` | `houses` (30 rows) | **byte-identical**; gains `offices` (8 rows) |
| `index.html:7,12,86,97-99` | "Thirty homes" in two descriptions and the h1, `data-stat` figures | none (counts read `houses`); gains the `Offices` nav link only |
| `portal/gallery.js:220` | `homes = index.houses` | none; a test asserts no office row appears |
| `scripts/portal-pages.mts` | `numberWord`, `galleryLd`, `header()`, `footer()`, `notFoundPage(site, word)` | `header()` switcher, `countCopy()`, `notFoundPage` takes both words, `officeLd()` |
| `scripts/story/pages.mts` | `header()` | the Offices link (a 4-line change) |
| `scripts/build-portal.mts` | steps 5 to 8 | section 10.2 (WP7, once) |
| `scripts/portal-redact.mts:65,75-100` | `redactIndex`, `builderHandles`, the guard | both arrays; the author token is a handle that must appear nowhere |
| `scripts/story/check-leaks.mts:25` | scans `content/families` and `index.houses` | also `content/offices` and `index.offices`; building display names are leak terms |
| `scripts/story/cast-lint.mts:41,48,96` | `N = 30`, "has no family" per index row | **none** (`index.houses` is the homes) |
| `scripts/story/lib/fleet.mts:17` | `FLEET.families = 30` | none; `OFFICE_FLEET` is separate |
| `scripts/test-portal.mts` (the 30 literals, the "thirty" h1) | | none; an `office` leg is auto-loaded from `portal-tests/office-front.mts` |
| `scripts/test-story-pages.mts:50`, `test-portal-redact.mts:28,57`, `test-campaign.mts:197`, `test-story-bake.mts:65-66`, `test-stories.mts:206-210,517` | 30 literals | none for the families; `test-portal-redact` also asserts 30 + 8 rows and no `author` or `source` in either array; `test-campaign` gains `office.html` and a company page |
| `scripts/story/lib/{context,validate,text,house,anchors}.mts`, `scripts/validate-stories.mts` | family-only | kind routing (WP1.2, WP1.3) |
| `scripts/voice/lib.mts:14-37`, `scripts/build-voiceover.mts`, `scripts/film/{lib,ads-lib}.mts`, `scripts/render-*.mts`, `scripts/story/ship/*.mts` | `familiesDir()` | `dirs.mts` (WP6.2); `ship/player.mts:40-45` `familyDir`, `:57` roles (WP6.1) |
| `assets/story/types.ts` | `HOUSEHOLDS`, `FamilyInfo`, `Story`, `FICTIONAL_LINE`, `FamiliesIndex`, `SiteManifest.byFamily` | additive types |
| `portal/_headers` | immutable `/story/families.*` | plus `/story/companies.*` |
| `scripts/check-house.mts`, `package.json`, `README.md`, `CLAUDE.md` | the quick-test list, scripts, the portal rules | `test:office`, `story:cast:office`, `story:cast:office-lint`, `office:index`; an `<!-- offices -->` rules block naming `/office`, `company/<slug>`, `byCompany`, the extension files and invariants I1 to I9; the count of quick tests |
| `.github/workflows/ci.yml`, `deploy.yml` | build, smoke test | none |
| the credit guard | handles from `author` | the token (R10); a test that `ci-offices-internal` appears in no file of `dist/` |

---

## 13. Tests

**Existing, unchanged and must stay green:** `pnpm run build`, `typecheck`, `validate` (30 homes + 8 offices), `test` (floor-plan graph and story validator tests), `test:node`, `story:validate -- --complete` (30 families; the I1 proof), `portal:build` and `portal:test`.

**New** (each marked `// @check-house node-test` and quick unless it needs a GPU): `test-company-contract.mts` (WP1.1), `test-company-validator.mts` (WP1.2), `test-office-roles.mts` (WP1.3), `test-office-buildings.mts` (WP2A, WP3), `test-office-cast.mts` (WP4.0), `test-company-tour.mts` and `portal-tests/company-tour.mts` (WP6.1), `test-company-film.mts` and `test-company-ads.mts` (WP6.2), `test-company-pages.mts` and `portal-tests/company-pages.mts` (WP5.2), `test-office-front.mts` and `portal-tests/office-front.mts` (WP5.1), `test-world-business.mts` (WP2D). The browser legs are auto-loaded by `portal:test`'s `hooks` leg: they serve `dist/` under the sub-path and fail on any console error, with and without JavaScript, at 1440, 768, 390 and 360 px, one h1 and one main, 44 px targets, the switcher on every page type, no horizontal scroll.

**Owner, macOS:** the goldens for the eight offices (40 frames), the compose, dress and planner baselines for offices, a Blender bake only if K1 is chosen.

**Not run in this phase:** `portal:build`, `portal:test` (they write `dist/` and `test/portal/`), any GPU render, any Hub app, any counsel review; the live precedence of `office.html` on Cloudflare Pages.

---

## 14. Work packages: files owned (disjoint)

32 packages, 274 owned path patterns, 0 overlaps (`node gen/wps.mjs`, in this folder). Paths are repo-relative. A path is written by its package and read by every other.

**WP1**

- `WP1.1 contract commit` (13): `assets/story/types.ts`, `assets/story/subject.ts`, `assets/story/roles.ts`, `content/story/schema/company.schema.json`, `content/story/functions.json`, `content/story/roles-office.json`, `content/story/claims-office.json`, `content/story/company-names.json`, `scripts/story/lib/kinds.mts`, `scripts/test-company-contract.mts`, `reference/story/offices.md`, `reference/story/company-voice.md`, `reference/story/office-briefs/**`
- `WP1.2 validator` (11): `scripts/story/lib/co/**`, `scripts/story/lib/context.mts`, `scripts/story/lib/validate.mts`, `scripts/story/lib/text.mts`, `scripts/story/lib/anchors.mts`, `scripts/story/lib/bad-cases-company.mts`, `scripts/story/make-bad-fixtures.mts`, `scripts/validate-stories.mts`, `test/fixtures/stories/company/**`, `scripts/test-company-validator.mts`, `reference/story/validator.md`
- `WP1.3 roles and bake` (5): `scripts/story/lib/house.mts`, `scripts/story-bake.mts`, `scripts/test-office-roles.mts`, `test/fixtures/stories/bake-world/houses/office-*`, `reference/story/bake.md`
**WP2A**

- `WP2A engine: field, index, plugin, gate sweep` (28): `assets/spec/base.ts`, `assets/spec/compose.ts`, `scripts/build-house-index.mts`, `scripts/build-house-plan.mts`, `scripts/render-house-shots.mts`, `scripts/validate/office.mts`, `scripts/validate-house-spec.mts`, `scripts/lib/list-specs.mts`, `scripts/test-spec-types.mts`, `scripts/test-office-buildings.mts`, `scripts/dress-project.mts`, `scripts/dress-census.mts`, `scripts/dress-fleet.mts`, `scripts/fleet-audit.mts`, `scripts/perf-house.mts`, `scripts/test-baked.mts`, `scripts/test-goldens.mts`, `scripts/test-kit.mts`, `scripts/test-light-rules.mts`, `scripts/test-room-clip.mts`, `scripts/test-floorplan-graph.mts`, `scripts/test-interior-light.mts`, `scripts/test-dress-phase.mts`, `scripts/test-dress-kit.mts`, `scripts/test-softkit.mts`, `scripts/test-fixtures.mts`, `scripts/fleet/_compose-dry.mts`, `reference/HOUSE-SPEC.md`
**WP2B**

- `WP2B engine: programs, look, dress, lints` (18): `assets/room-programs.ts`, `assets/kit-rules.ts`, `assets/room-finish.ts`, `assets/house-styles.ts`, `assets/layout-lint.ts`, `assets/shot-nav.ts`, `assets/dress-recipes.ts`, `assets/room-dress.ts`, `assets/room-dress-hosts.ts`, `assets/room-composer.ts`, `assets/props/place-kit.ts`, `scripts/test-room-composer.mts`, `scripts/test-compose-stability.mts`, `scripts/test-compose-parity.mts`, `scripts/test-dress-neutral.mts`, `scripts/test-build-neutrality.mts`, `scripts/test-dress-hosts.mts`, `scripts/test-shot-planner.mts`
**WP2C**

- `WP2C engine: props and Kenney` (15): `assets/props/office.ts`, `assets/props/office-*.ts`, `assets/props/registry.ts`, `assets/props/index.ts`, `assets/props/placement.ts`, `assets/props/measured.ts`, `assets/props/baked.ts`, `assets/props/baked/**`, `content/house-catalog.json`, `scripts/build-prop-catalog.mts`, `models/**`, `scripts/bake/**`, `ATTRIBUTION.md`, `THIRD_PARTY.md`, `scripts/test-no-third-party-bytes.mts`
**WP2D**

- `WP2D engine: world and facade` (5): `assets/world.ts`, `assets/facade.ts`, `assets/room-clip.ts`, `assets/site-structures.ts`, `scripts/test-world-business.mts`
**WP3**

- `WP3.0 building coordinator` (2): `assets/home-names.ts`, `reference/OFFICES.md`
- `WP3.startup-loft` (8): `content/houses/startup-loft.json`, `content/houses/startup-loft.plan.json`, `scenes/svg/house-startup-loft*`, `scenes/lottie-scenes/house-startup-loft*`, `scenes/floorplans/fp-startup-loft-*`, `portal/thumbs/startup-loft.webp`, `portal/previews/startup-loft.jpg`, `test/shots/startup-loft.track.json`
- `WP3.garage-lab` (8): `content/houses/garage-lab.json`, `content/houses/garage-lab.plan.json`, `scenes/svg/house-garage-lab*`, `scenes/lottie-scenes/house-garage-lab*`, `scenes/floorplans/fp-garage-lab-*`, `portal/thumbs/garage-lab.webp`, `portal/previews/garage-lab.jpg`, `test/shots/garage-lab.track.json`
- `WP3.dev-shop-unit` (8): `content/houses/dev-shop-unit.json`, `content/houses/dev-shop-unit.plan.json`, `scenes/svg/house-dev-shop-unit*`, `scenes/lottie-scenes/house-dev-shop-unit*`, `scenes/floorplans/fp-dev-shop-unit-*`, `portal/thumbs/dev-shop-unit.webp`, `portal/previews/dev-shop-unit.jpg`, `test/shots/dev-shop-unit.track.json`
- `WP3.agency-printworks` (8): `content/houses/agency-printworks.json`, `content/houses/agency-printworks.plan.json`, `scenes/svg/house-agency-printworks*`, `scenes/lottie-scenes/house-agency-printworks*`, `scenes/floorplans/fp-agency-printworks-*`, `portal/thumbs/agency-printworks.webp`, `portal/previews/agency-printworks.jpg`, `test/shots/agency-printworks.track.json`
- `WP3.practice-townhouse` (8): `content/houses/practice-townhouse.json`, `content/houses/practice-townhouse.plan.json`, `scenes/svg/house-practice-townhouse*`, `scenes/lottie-scenes/house-practice-townhouse*`, `scenes/floorplans/fp-practice-townhouse-*`, `portal/thumbs/practice-townhouse.webp`, `portal/previews/practice-townhouse.jpg`, `test/shots/practice-townhouse.track.json`
- `WP3.shop-backoffice` (8): `content/houses/shop-backoffice.json`, `content/houses/shop-backoffice.plan.json`, `scenes/svg/house-shop-backoffice*`, `scenes/lottie-scenes/house-shop-backoffice*`, `scenes/floorplans/fp-shop-backoffice-*`, `portal/thumbs/shop-backoffice.webp`, `portal/previews/shop-backoffice.jpg`, `test/shots/shop-backoffice.track.json`
- `WP3.contractor-yard` (8): `content/houses/contractor-yard.json`, `content/houses/contractor-yard.plan.json`, `scenes/svg/house-contractor-yard*`, `scenes/lottie-scenes/house-contractor-yard*`, `scenes/floorplans/fp-contractor-yard-*`, `portal/thumbs/contractor-yard.webp`, `portal/previews/contractor-yard.jpg`, `test/shots/contractor-yard.track.json`
- `WP3.hub-courtyard` (8): `content/houses/hub-courtyard.json`, `content/houses/hub-courtyard.plan.json`, `scenes/svg/house-hub-courtyard*`, `scenes/lottie-scenes/house-hub-courtyard*`, `scenes/floorplans/fp-hub-courtyard-*`, `portal/thumbs/hub-courtyard.webp`, `portal/previews/hub-courtyard.jpg`, `test/shots/hub-courtyard.track.json`
- `WP3.Z aggregates (after all eight)` (6): `content/houses/index.json`, `scenes/manifest.json`, `scenes/floorplans/floorplans.json`, `test/fixtures/hashes/compose-baseline.json`, `test/fleet/baseline.json`, `test/review/baselines/**`
**WP4**

- `WP4.0 casting` (6): `content/story/office-cast-plan.json`, `content/story/office-casting.json`, `reference/story/office-cast.md`, `scripts/story/office/build-casting.mts`, `scripts/story/office/cast-lint.mts`, `scripts/test-office-cast.mts`
- `WP4.reelwick` (4): `content/offices/reelwick.json`, `content/offices/reelwick.bake.json`, `content/offices/reelwick.voice.json`, `content/offices/reelwick/**`
- `WP4.pannierwell` (4): `content/offices/pannierwell.json`, `content/offices/pannierwell.bake.json`, `content/offices/pannierwell.voice.json`, `content/offices/pannierwell/**`
- `WP4.curatory` (4): `content/offices/curatory.json`, `content/offices/curatory.bake.json`, `content/offices/curatory.voice.json`, `content/offices/curatory/**`
- `WP4.gutterfold` (4): `content/offices/gutterfold.json`, `content/offices/gutterfold.bake.json`, `content/offices/gutterfold.voice.json`, `content/offices/gutterfold/**`
- `WP4.lintel-and-sill` (4): `content/offices/lintel-and-sill.json`, `content/offices/lintel-and-sill.bake.json`, `content/offices/lintel-and-sill.voice.json`, `content/offices/lintel-and-sill/**`
- `WP4.posy-and-pail` (4): `content/offices/posy-and-pail.json`, `content/offices/posy-and-pail.bake.json`, `content/offices/posy-and-pail.voice.json`, `content/offices/posy-and-pail/**`
- `WP4.hartnoll-joinery` (4): `content/offices/hartnoll-joinery.json`, `content/offices/hartnoll-joinery.bake.json`, `content/offices/hartnoll-joinery.voice.json`, `content/offices/hartnoll-joinery/**`
- `WP4.loamfield` (4): `content/offices/loamfield.json`, `content/offices/loamfield.bake.json`, `content/offices/loamfield.voice.json`, `content/offices/loamfield/**`
**WP5**

- `WP5.1 /office page` (6): `office.html`, `portal/office.js`, `portal/office.css`, `scripts/office-front.mts`, `scripts/test-office-front.mts`, `scripts/story/portal-tests/office-front.mts`
- `WP5.2 company page` (13): `scripts/story/office/pages.mts`, `scripts/story/office/site.mts`, `scripts/story/office/site-lib.mts`, `portal/company.css`, `content/story/bring-home.json`, `scripts/story/lib/bring-home.mts`, `scripts/story/check-copy.mts`, `scripts/story/check-leaks.mts`, `scripts/story/build-og.mts`, `portal/og/**`, `scripts/test-company-pages.mts`, `scripts/story/portal-tests/company-pages.mts`, `test/fixtures/site/offices/**`
- `WP5.3 shared chrome` (5): `scripts/portal-pages.mts`, `scripts/story/pages.mts`, `index.html`, `portal/site.css`, `portal/family.css`
**WP6**

- `WP6.1 tour and player` (16): `assets/story/runtime.ts`, `assets/story/popup.ts`, `assets/story/director.ts`, `assets/story/a11y.ts`, `assets/story/url.ts`, `assets/story/mount.ts`, `assets/story/keys.ts`, `assets/viewer.ts`, `room-creator.html`, `portal/story.css`, `scripts/story/ship/player.mts`, `scripts/story/hooks.ts`, `scripts/test-company-tour.mts`, `scripts/story/portal-tests/company-tour.mts`, `scripts/test-story-url.mts`, `reference/story/player.md`
- `WP6.2 film, ads, voice` (15): `scripts/story/dirs.mts`, `scripts/voice/**`, `scripts/build-voiceover.mts`, `scripts/film/**`, `scripts/render-family-film.mts`, `scripts/render-persona-cuts.mts`, `scripts/story/ship/audio.mts`, `scripts/story/ship/films.mts`, `assets/story/film/**`, `content/story/ads-office.json`, `content/offices/films.json`, `scripts/test-company-film.mts`, `scripts/test-company-ads.mts`, `reference/story/film.md`, `reference/story/ads.md`
**WP7**

- `WP7 integration` (14): `scripts/build-portal.mts`, `scripts/test-portal.mts`, `scripts/test-portal-redact.mts`, `scripts/test-campaign.mts`, `scripts/test-story-pages.mts`, `scripts/test-stories.mts`, `scripts/test-story-bake.mts`, `scripts/portal-lib.mts`, `scripts/portal-redact.mts`, `portal/_headers`, `package.json`, `README.md`, `CLAUDE.md`, `scripts/check-house.mts`

**Hand-offs.**

| From | To | What | Acceptance |
|---|---|---|---|
| WP1.1 | everything | the contract commit: types, subject adapter, schema, functions, roles, claims, names, `kinds.mts`, contract test | `pnpm run build && pnpm run typecheck` green; `node --experimental-strip-types --test scripts/test-company-contract.mts` green; I1 diff empty |
| WP1.2 | WP4 | the validator and fixtures | the exemplar passes 0/0/0; every `bad-co-*` fails with exactly its rule; `story:validate -- --complete` shows 30 families unchanged |
| WP2A | WP2B, WP2C, WP3 | `use`, the `offices` index, `listSpecs`, the office plugin, the gate sweep | `pnpm run validate` accepts an office fixture; the 30 home rows byte-identical; `test-spec-types` 0 errors |
| WP2B + WP2C | WP3 | programs, look defaults, P0 props, dress recipes | `test-room-composer`, `test-compose-stability`, `test-build-neutrality`, `test-dress-neutral` green; the prototype loft composes and passes shot QA with 0 errors |
| WP3 (a building) | WP4.0 | a frozen building plus its plan | `validate` 0 errors, `--layout` clean or each warning explained, QA 0 errors, twins pass, thumbnails and previews exist |
| WP4.0 | WP4.<slug> | `office-casting.json` | `story:cast:office --check` current, `story:cast:office-lint` 0 errors |
| WP5.1, WP5.2, WP5.3 | WP7 | pages, generators, tests on fixture companies | tests green on `test/fixtures/site/offices/` |
| WP6.1, WP6.2 | WP7 | tour, film, ads | a `company=` tour plays; `ads.json` byte-identical |
| WP7 | the owner | a preview build | `portal:build --strict-families` and `portal:test` green; I1 diff empty; the browser walk-through of section 14 of the plan |

---

## 15. Open items, holds, and their defaults

1. Per-person Companion accounts (D1): until ruled, offices say only "each app keeps its own sign-ins"; `core-back-room`, `team-sign-ins` HOLD.
2. `FLOOR_MAX` 25 and the medium businesses (D2): default as built.
3. Remote access and "share apps through a web link" (D3): every scene stays on the office network; `office-scope` HOLD.
4. The label (D4) and fictional people with job titles (T15): default as written.
5. The company names: invented, searched for exact matches (none found), not cleared. `company-names.json` is a deny-list, not a clearance.
6. Naming services the store does not pair (D7): default no.
7. `owner-backups` and the three shipped Duplicati family beats (hwang `dining-backup`, kamau `living-backup`, nwachukwu `living-backup`): default: not printed for offices; the family beats are the owner's call and are not touched.
8. Counsel: Elastic 2.0, Business Source 1.1, Sustainable Use and AGPL-plus-commercial licences against "an office uses the app"; the comparative naming of business incumbents.
9. Kokoro install (voice); the film host (R2 or Stream); the ad GPU time.
10. `AMBIGUOUS` edit (R13) and the `author` token (R10).
11. Whether the first release is two offices (M1), six (M2) or all eight (M3).
12. (skeptic) Package gaps for the Hub team: EspoCRM and Inkscape declare no storage volume; Pi-hole publishes DNS on 8053, not 53; Grist has one default sign-in; Excalidraw keeps nothing. Until fixed, section 16.2 governs the wording.
13. (skeptic) Unverified free-edition limits: Mattermost (`mattermost-team-edition:latest`) and Rocket.Chat. Check the running version's users and history limits before either appears in a business story (Mattermost is in three of the eight).
14. (skeptic) Stretched `replaces` pairs (plan O13), Akaunting's two-user cap (plan O14) and the capacity-by-implication risk (plan risk 14).

---

## 16. Skeptic amendments (2026-10-19; these win)

### 16.1 Precedence

Where this section, the eight briefs as amended (`company-briefs/*.json`, each with a `skeptic` block) and any older line disagree, **this section and the briefs win**. The files this pass could not edit are stale on exactly these points: `office-cast-plan.proposed.json` (Rivet's and Tally's `job`, the Curatory and Posy and Pail taglines, Curatory's Comms Room area), `gen/` (every data file and template; do not run `gen/build.mjs` or `gen/assemble.mjs`), `strings-plan.json` (the /office h1) and the four specialist reports. WP1.1 and WP4.0 copy from the briefs, not from those files.

### 16.2 App facts the stories must respect

Source: the live store (`https://hub.ci.computer/api/store`, 580 apps, fetched 2026-10-19, sha256 `db42c2ea717cfcf8`), the compose file of each package inside it, the upstream LICENSE files read the same day, `catalog-apps.json` and the market review. "Compose" means the package's own `compose` field in the store.

| App | Fact | Writers must | Writers must not |
|---|---|---|---|
| draw.io | stateless: no volume, no account; diagrams live in the browser or as a file on the person's device | say the person saves the file, into the repository or the job folder | "saved", "kept" or "sits on the Core"; any bring-your-data-home row without "draw.io keeps no copy, the file is saved by the person" |
| Excalidraw | editor plus a collaboration relay; compose has no storage volume (only an nginx.conf mount); amd64 only | show people sketching on a wall screen; "exports a picture" | "saved", "kept" or "stored" on the Core; a bring-your-data-home beat (Miro boards are redrawn, nothing lands on the Core) |
| Inkscape | a streamed desktop (KasmVNC) with a VNC password and no volume | "in a browser tab"; a person files the result | "goes straight into" another app; any claim the file persists on the Core |
| LibreOffice | a streamed desktop session, `/config` only; whoever opens it shares one desktop | one document at a time; a person saves and files it | co-editing; "his own copy"; "saves to the job folder" by itself |
| Stirling-PDF, BentoPDF | process and return; keep nothing. BentoPDF loads its heavier engines from a public CDN on first use; AGPL-3.0 for internal use or a paid commercial licence | "merges ... into one pack" | "redaction is complete"; "nothing is uploaded"; the sign-in wall |
| Pi-hole | DNS is published on host port 8053, not 53; unblocked lookups still go to an upstream resolver | "blocks known ad and tracker domains for the devices pointed at it" | "answers the name lookups", the router, the office or shop network's DNS; any safety or protection promise; if the Core is off those devices lose lookups |
| Uptime Kuma | one admin; runs on the Core, so it cannot report the Core itself down | "checks its apps / the printer / the staging site", the sceptic reads the page | "monitors the Core"; any uptime claim; "replaces Datadog / New Relic" (full observability suites) |
| ntfy | no sign-in in this package: anyone on the network can publish and subscribe; browser notifications need a secure address, unverified on a local HTTP address | "a nudge" | delivery, phone push, remote |
| Grist | `GRIST_DEFAULT_EMAIL` and no login provider: one default sign-in | a shared table | per-person Grist accounts; who sees which rows |
| Akaunting | Business Source License 1.1: free production use up to two users, one company and one thousand invoices | one person in it; bookkeeping only | a team using it; "the books are right"; an accountant on the Core ("a printout goes to the accountant") |
| Planka | PLANKA Community License, Fair Use License 1.1: internal use in an organisation; accounts may not be shared with outsiders; source-available | the board in the office | "open source"; a client with an account |
| Invoice Ninja | Elastic License 2.0; emailing an invoice needs SMTP; card payments need a provider | "invoicing"; print and post | "payments"; "open source"; a ledger |
| Documenso | a MailHog catcher is bundled, so signing email is delivered nowhere until SMTP is set; the manifest's "legally-binding" is never repeated | both signers in the room | "valid", "binding", "certified" |
| Listmonk | SMTP is set inside the app; a moved list carries addresses, not consent | "the mail leaves through the sender she picks" | delivery, opens, "consent came across" |
| Twenty | no email or calendar provider without the owner's OAuth credentials; AGPL plus commercial files | the pipeline table | "emails sync"; "open source" in the same sentence |
| Hermes | runs isolated from the other apps; trusts one messaging ID; the channel is not local; beta | "from text X pastes or gives it"; the person sends | "reads the repository / the help pages / the drive"; "private"; "assistant" |
| OpenClaw WebCLI | browser errands over the office internet; beta; Hub Settings, AI may hold cloud keys | "fills the form, the person sends" | "books", "buys", "sends"; a coding task; a key |
| Cryptgeon | notes live in RAM and open once; no accounts | "opens once, on the office network, and is gone" | "replaces WeTransfer" (it cannot send a file to an outsider); "encrypted" |
| Gitea, Forgejo | registration is open by default; the first account is admin; no CI runner ships | "the admin closes sign-up" | a CI run; "syncs with GitHub" |
| EspoCRM | the compose declares no volume for the app or its database: durability across an update is **unverified** | "on the Core" only after the Hub team confirms | "kept here" and similar as a promise until then |
| Mattermost, Rocket.Chat | free-edition limits on users or history **unverified** (`mattermost-team-edition:latest`, MIT compiled licence per upstream) | per-app accounts named as the app's own feature | any head count served |
| Wallos | fetches logos from outside; the store pairs it with Rocket Money and YNAB, and YNAB is a stretch | no chip beyond the name | a price, a saving, a total |
| Paperless-ngx, Papra | scans and PDFs only; the pairing with Evernote and Google Drive is a loose fit (plan O13) | "finds it by one word" | "archive of record"; "encrypted"; text-recognition quality |
| Companion Planning, Companion Memory | an owner's planner (one owner account); one person's beta file | "(beta)" at first mention of Memory | "team calendar"; "company brain" |

### 16.3 `co-app-facts` (WP1.2)

A table-driven rule in `scripts/story/lib/co/app-facts.mts`: each row of 16.2 with a "must not" is one entry `{ app, test(beat, story) -> boolean, why, fix }`. Examples: `/\b(saved|kept|stored|sits?|lands?|lives?)\b[^.]{0,30}\b(on|in) the Core\b/i` on a beat whose `app` is draw.io, Excalidraw or Inkscape; `beat.bringHome` on an Excalidraw beat; `/\b(name lookups|resolver|router|network's DNS)\b/i` on a Pi-hole beat; `/\b(reads?|opens?)\b[^.]{0,40}\b(commits?|repositor\w+|help pages?|wiki|drive)\b/i` on a Hermes beat; three or more different `member` values across the Akaunting beats; `/\bchecks? (it|the Core)\b/i` on an Uptime Kuma beat. Severity error. It reads `popup.title`, `popup.body`, `popup.note` and `detail`. Fixtures as in 7.4. The rule fails nothing in the amended briefs (checked by hand against every seed; WP1.2 re-checks mechanically).

### 16.4 Paid cuts

A cut's chips are the hook beat's chips. Where a beat's pair is marked a stretch by the market review (Paperless-ngx and Papra against Evernote and Google Drive, Wallos against YNAB, Cryptgeon) the owner decides (plan O13). Default: print the store's pair, as the 30 families do. The pairs the briefs' own limits contradict were removed (plan Appendix C, C6 and C7).

### 16.5 Numbers after this pass

46 distinct apps (42 third party, 4 first party), no third-party app in more than three of eight (30 at exactly three, 6 at two, 6 at one); 43 distinct rented services; 54 bring-your-data-home beats in 24 distinct moves; 25 to 28 beats a company; 8 or 9 film beats at 188 to 205 spoken words (limit 215); every company in the film covers at least five chapters (Posy and Pail, Reelwick, Curatory, Gutterfold and Hartnoll sit exactly at five, so a film beat swapped out must keep its chapter). Recomputed from the briefs by `skeptic/counts.py`.
