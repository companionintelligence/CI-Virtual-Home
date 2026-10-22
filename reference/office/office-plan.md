# The /office plan (key `plan`)

> **Status: design only, stale versus main, not shipped.** Written 2026-10-19 and 2026-10-20 against PR #35's head (`a431fe6`), before the apartments, pass 2 and the lander reached main.
> Main has no `/office` page, no `company/v1` schema, no `use: "office"` spec field and none of the files this document calls new. Owner decisions **O2** (per-person accounts), **O4** (the label and fictional staff), **O6** (company names) and **O7** (naming services) gate any public showing, and counsel has cleared none of the company names or licence readings.
> Read it as the record of a design and its skeptic review, not as a contract for the tree. Directories in angle brackets (`<scratch>`, `<repo>`, `<office-worktree>`) stand for the author's local ones. See [`README.md`](README.md) in this folder for what was left out.

Read-only phase, 2026-10-19. Nothing in any repository was changed. Build tree: `<office-worktree>`, branch `feat/office-page`, stacked on PR #35's head `a431fe6`. Everything is in `$W20` = `<scratch>/w20` (a RAM disk: WP1.1 copies what the work needs into the repo, below, so nothing depends on `/tmp`). Companion files in this folder: `office-build-contract.md` (the exact delta), `company-briefs/<slug>.json` (eight, for the story writers), the proposed data files (`company.schema.proposed.json`, `functions.proposed.json`, `roles-office.proposed.json`, `claims-office.proposed.json`, `office-cast-plan.proposed.json`), the four specialist reports (`office-bible.md`, `engine.md`, `site.md`/`office-contract.md`, `claims.md`) and `gen/` (the scripts that lint, count and check everything below).

## Skeptic pass, 2026-10-19 (read this first)

A sceptical marketing lead, a trade-practices lawyer and a principal engineer attacked this plan, the build contract and the eight briefs against the live store (`curl https://hub.ci.computer/api/store`: 580 apps, all `available`, byte-identical to the snapshot the plan used, sha256 `db42c2ea717cfcf8`), the store packages' own compose files, the upstream LICENSE files and the repository. The full report is `skeptic.md` beside this file; every edit is listed in Appendix C.

**Verdict: the plan stands, with defects fixed in place.** What held: all 46 Hub app ids exist, are published and available, and every `replaces` a brief prints is the store's own; the counts, the three-of-eight cap, the names, slugs, titles, first names and film quotas recompute; the engine route and the site route are sound. What did not hold, and is now fixed: four lines said an Excalidraw sketch is "saved" or "kept on the Core" (the package has no storage volume); Pi-hole was the office's name server (the package publishes DNS on port 8053 only); Hermes "read" commits and help pages (it runs isolated and works from pasted text); an accountant reached the Core in three beats; a monitor checked the machine it runs on; Akaunting's two-user free-use cap was missing; a Core room was 0.96 m2 under its own rule; two taglines printed a head count next to "one Core"; the spoken-word totals left out the 3-word sign-off; and the effort total left out the 30 percent rework the schedule says it adds (about 570 agent-hours, not 420). Open risks are in section 5.2 below and `skeptic.md` section 3; the things nobody can verify from here are in `skeptic.md` section 7. `gen/` is stale against these edits: do not run `gen/build.mjs` or `gen/assemble.mjs`, they would overwrite them.

---

## The verdict, in nine lines

1. **Build it.** `/office` is a second page of the portal: eight fictional companies in eight 3D workplaces, three startups, three small businesses, two medium businesses, each told as a tour by role. The argument is the families' argument at work: the company's files, handbook, invoices, contracts and logins on one Companion Core in the back room, each person's job done by a Companion Hub store app that replaces a rented service, and what comes along when you bring your data home, and what does not.
2. **It fits the engine and the site.** An office is a HouseSpec (`use: "office"`); a company story is a sibling schema (`company/v1`); the 30 homes, the 30 families, their locks, `claims.json` and the baselines are not edited. Nothing in the eight companies needs a new engine construct beyond furniture, six composer programs and gates; the spikes prove it: a 6-person loft and a 792 m2 floor render and pass shot QA with 0 errors, and a florist's shop front validates and reads as a shop from the street.
3. **The eight briefs are written and lint-clean.** 46 distinct apps (42 third party), no app in more than three of eight, 43 rented services named in chips (47 before the skeptic pass dropped four stretched or contradicted pairs), 54 bring-your-data-home beats (24 distinct moves), every app in the catalog with a QA screenshot (no `reviewed.json` entry needed), 25 to 28 beats a company, 8 or 9 film beats at 188 to 205 spoken words against the limit of 215 (the sign-off's 3 words included).
4. **A medium business is told as one site or one department**, never as "the company": Hartnoll Joinery (one office block of a firm of about ninety) and Loamfield (one department of a firm of about a hundred), each with a systems administrator who is allowed to be the sceptic.
5. **Nothing in the plan needs the owner before work starts.** Defaults are given for every decision. Four must be answered before the first page is shown to anyone outside: per-person accounts (O2), the label and the fictional-staff question (O4), the company names (O6) and naming services the store does not pair (O7).
6. **The long poles are the buildings and the props**: about 34 person-days of engine work (range 28 to 41) and about 21 of spec work. Total about 420 agent-hours before rework and about 570 with the 30 percent rework the schedule's own method adds (range 400 to 720; the skeptic pass added 22 hours for the props line items and the app-facts rule) over three milestones: the page with two offices (about 90 agent-hours on the critical path, 5 to 7 working days with 6 to 8 agents and one review loop), six offices, eight.
7. **Owner-gated, not agent-gated:** the macOS goldens (8 buildings, 40 frames), counsel on names and licences, the Kokoro install (films wait for the voice; silent ad cuts do not), a preview deploy (never pushed without a go-ahead).
8. **Two things the reports got wrong or left open, fixed here:** the engine's own props line items add to 23 days against 13.5 in its table, and the story schema's address pattern rejects "Unit 2" (the briefs used it). Section 5 and the verification log have the rest.
9. **Start here:** WP1.1 (a contract commit), then in parallel the page on fixture companies (WP5), the engine's minimum for the loft and the townhouse (WP2), and the tour changes (WP6). The first thing to look at, in about 10 agent-hours, is `/office` with two cards (a draft from fixtures, not a deliverable).

---

## 1. The product in one page

**What /office is.** A second page of the virtual-home portal, at `https://homes.ci.computer/office`, that is a gallery of offices: 3D workplaces for startups, small businesses and a floor or a department of a medium one. Each office has a fictional company in it. A visitor takes a company's tour (the same player as the homes, a card per beat, captions, chapters) and reads its page (`/company/<slug>`, an ad's landing page that reads with no JavaScript). The stories are about teams at work: what each role runs, which rented service it used to depend on, which Companion Hub store app does the job now on the one Companion Core in the back room, and what happened to the data when it came home.

**Who it is for.**

| Reader | What they are deciding | What they look for | Where they land |
|---|---|---|---|
| A **founder** (3 to 12 people) | whether the company's working memory (code, customer list, contracts, logins) can sit on one machine they own | "Where does your customer list live?"; the CTO who installs the apps; what stays out there (the product itself, the bank, email) | Reelwick, Pannierwell, Curatory |
| An **office manager** (10 to 30 people), often the accidental IT person | whether fewer logins and one handbook are worth one shelf in the back room | the new starter's first morning, the post scanned at the desk, the invoices on Friday, who closes sign-up | Lintel & Sill, Gutterfold, Posy & Pail |
| An **IT administrator** in a medium firm | whether to let one team run its own tools | the sceptic who reads a status page each morning and approves a list; what one machine does not do | Hartnoll Joinery, Loamfield |
| (indirectly) the Kickstarter audience that runs a small team | whether the argument holds at work | LinkedIn and feed cuts, 15 to 25 seconds, one person and one job | the role cuts |

**The argument it makes.** The same life, on your own hardware, at work. One owner looks after one Companion Core on a shelf in the back room. The team's apps run on it, and each app keeps its own sign-ins. For each job the story shows the app, the rented service it replaces (the chip row: the app name, then "replaces <service>" from the store's own list), where the data sits now, and one thing that did not come along when it moved. An agent prepares and a person approves. Email, the bank and the pay service stay with the services that run them. Companion OS, Companion Memory and Companion Agents are in beta, and the Core itself is a stylised drawing.

**What it is not.**

- **Not an enterprise pitch.** No "SMB", "mid-market", "enterprise", "company-wide", no headcount a Core serves, no seats. A medium firm is a setting (one site, one department), never an audience claim, and no sentence puts a head count next to "one Core" (two taglines did and were reworded); the sanctioned audience is "individuals, families and small teams".
- **Not a compliance, security, uptime, support or savings page.** No GDPR, HIPAA, SOC 2, ISO, audit, certification, privilege, "legally binding", tax or accounting correctness; no "private", "secure", "safe", "encrypted", "backed up", "always on"; no price, saving, ROI, time saved; no SLA or "someone to call" as a Companion promise.
- **Not a multi-user platform claim.** Multi-user is not on the box. Per-app accounts (Mattermost, Nextcloud, EspoCRM, Forgejo) are that app's own feature, said as such; no scene shows or implies a separate Companion account, memory or agent per colleague. One companion per company, on the Core's owner.
- **Not remote or hybrid.** Every scene is in the building, on the office network: no work from home, no field team, no client portal, no booking page, no public link, no mobile app, no signer outside the room.
- **Not a case study.** The companies and people are invented and labelled; nobody is a customer; no character says the product is good; no result is stated.
- **Not a parity or migration promise.** "Mattermost replaces Slack" is the store's chip, never "does everything Slack does"; every bring-your-data-home beat names what did not come along; no effort band, no vendor link, no "weekend".

---

## 2. The eight offices

Eight invented companies in eight buildings. **Names are invented and not cleared**: a web search for each exact name found no company of that name, after one replacement (a weak check, recorded in the verification log); `company-names.json` is a deny-list, not a clearance, and counsel clears each name before it ships. **Everything below is generated from the same data as the briefs** (`gen/`), so the tables and the JSON cannot drift.

**At a glance** (wave: 1 = the first two offices, 2 = the other four of the first six, 3 = the last two, which need the business lot context).

| # | Company | Size, scope | People (floor) | Building | m2 | Core owner (function) | Core room | Agent | Narrator | Wave |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Reelwick | Startup, company | 6 (6) | startup-loft | 96 | Anselm (engineering) | Comms Room | Hermes Rivet | `v-clear-f` | 1 |
| 2 | Pannierwell | Startup, company | 5 (5) | garage-lab | 90 | Haldis (owner) | Back Room | OpenClaw Gantry | `v-steady-m` | 2 |
| 3 | Curatory | Startup, company | 11 (11) | dev-shop-unit | 260 | Ilse (support) | Comms Room | Hermes Tally | `v-warm-f` | 3 |
| 4 | Gutterfold | Small business, company | 14 (14) | agency-printworks | 290 | Priya (operations) | Comms Room | Hermes Bobbin | `v-storyteller-m` | 2 |
| 5 | Lintel & Sill | Small business, company | 11 (11) | practice-townhouse | 215 | Delphine (finance) | Comms Room | Hermes Rafter | `v-warm-f` | 1 |
| 6 | Posy & Pail | Small business, company | 10 (10) | shop-backoffice | 125 | Katya (marketing) | Back Office | Hermes Pennant | `v-clear-f` | 2 |
| 7 | Hartnoll Joinery | Medium business, site | 90 (22) | contractor-yard | 310 | Wei (it) | Comms Room | OpenClaw Lathe | `v-steady-m` | 3 |
| 8 | Loamfield | Medium business, department | 110 (24) | hub-courtyard | 380 | Chiara (engineering) | Comms Room | Hermes Sprocket | `v-storyteller-m` | 2 |

**How the eight stay different.** The families took a similar shape; an office needs more than a change of nouns. Each company has its own arc, hook, Core owner (seven different functions among the eight), room for the Core, chat, wiki and CRM, and a thing on the wall.

| Company | The arc in one line | Hook (lander and ad) | The thing on the wall | Chat, wiki, CRM | Honest edge |
|---|---|---|---|---|---|
| Reelwick | six people, one list: the founder writes what the company rents, the CTO moves its working memory onto one shelf | "Where does your customer list live?" | a whiteboard list of rented tools | Campfire, Docmost, Twenty | the product runs where it runs; a security questionnaire is a different problem |
| Pannierwell | a hardware startup that is also a bench: the parts list, the datasheets, the firmware and the test photos beside the rig | "The parts list, the firmware and the test photos, in one back room." | a bench run, a parts rack, a cargo bike | none (a calendar), BookStack, none | supplier sites are on the internet; the agent fills forms, the founder sends |
| Curatory | the support lead owns the Core, behind a glass wall onto the floor | "The support lead owns the Core." | a shelf of test devices | Rocket.Chat, BookStack, Twenty | the guides are hosted elsewhere; nothing faces the museums |
| Gutterfold | a studio told through objects: brand folders, proofs, the pin-up wall, Friday hours | "Design files sit on the Core, in the studio." | the pin-up wall under the mezzanine | Mattermost, a handbook folder, EspoCRM | clients outside cannot reach the Core |
| Lintel & Sill | the best-fit small business: the post scanned at the front desk, the appointment signed at the table, drawings that sit on the Core | "Drawings sit on the Core, in the office." | a plan chest and a printed register | none (a calendar), BookStack, none | email, the bank and the pay service stay out there; the site is out of frame |
| Posy & Pail | a florist whose Core stands on a desk in the back office; the person who holds the list owns it | "The newsletter list sits on the Core, in the shop." | buckets of stems, recipe sheets, a green awning | none (a calendar), none, EspoCRM | nothing is sold, booked or paid online in these scenes |
| Hartnoll Joinery | one office block of a firm of about ninety: the systems administrator owns the Core and writes down what runs where | "One office block keeps its own tools." | a printed job board, a rack shelf in a windowless room | Mattermost, Docmost, EspoCRM | the company's suites, accounts package and pay service stay where they are |
| Loamfield | one department of a firm of about a hundred: IT agreed on one condition and reads a status page each morning | "IT agreed to the department's Core on one condition." | a timber courtyard, a test bench, a printed sprint board | Mattermost, Docmost, none | the company keeps its own suites; IT decides what runs |

### 2.1 Reelwick: startup, 6 people (`reelwick`, building `startup-loft`, wave 1)

**What it is.** Reelwick writes schedule and rota software for independent cinemas. Six people share one brick bay. The code, the handbook, the contact list and the logins all sit on one Companion Core. Sector: Software for independent cinemas. Tagline: "Six people, one product, and one Companion Core in the comms room." Address: 2 Maltings Yard, Ostley Wick (invented). Narrator `v-clear-f`.

**The building.** Converted brick warehouse bay: red brick, arched steel windows, parapet, closed neighbour bay (spike exists, 0 shot errors). 96 m2, 1 storey, about 8 seats for 6 people on the floor (display name "Brickworks Bay", never in story text). **The Core's place:** Comms Room, wall shelf, chalk Core on a blue-grey wall, no books on the shelf. Make the Comms Room 3.6 x 3.6 m (the spike's 3 x 3 m gave foreground-occluder 31 percent and a 51.5 degree finale lens). No openings on its perimeter walls. **Route:** street door (double leaf with transom), Entry Lobby, along the bench of the Open Office, a glimpse of the glass Meeting Room, the Comms Room door, orbit.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Entry Lobby (entry) | 9 |  |  |
| Phone Booth (meeting) | 6 |  |  |
| Comms Room (the Core) (server) | 13 |  |  |
| Open Office (workfloor, office) | 44 | workspace |  8 seats |
| Meeting Room (meeting) | 10.5 | meeting | glass partition 6 seats |
| Kitchenette (kitchen) | 13.5 | kitchen |  |
| Neighbour Workshop (none) | 48 |  | closed bay, blinds, party wall door null |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Marit | Founder and chief executive | owner | founder_owner (business-owner) | 2 of 5 |  | 3 |
| Anselm | Chief technology officer | engineering | cto_eng_lead (builder) | 5 of 5 | yes, agent Rivet (Hermes) | 4 |
| Femi | Software engineer | engineering | software_engineer (builder) | 4 of 5 |  | 3 |
| Anika | Product designer | design | designer (creative) | 3 of 5 |  | 3 |
| Kofi | Sales and partnerships | sales | sales_bd (business-owner and marketer) | 3 of 5 |  | 3 |
| Odile | People and office lead | people | office_manager (organiser) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Marit) | Wallos | (none listed) | meet-list |
| owner (Marit) | Companion Planning | (none listed) | kitchen-week |
| owner (Marit) | Companion Memory | (none listed) | kitchen-notes |
| engineering (Anselm, Femi) | Hermes | (none listed) | ftue-hello, open-review |
| engineering (Anselm, Femi) | Uptime Kuma | (none: the market review calls Datadog a stretch) | comms-status |
| engineering (Anselm, Femi) | VaultWarden | 1Password | comms-vault **BH** |
| engineering (Anselm, Femi) | Forgejo | GitHub | open-repos **BH** |
| engineering (Anselm, Femi) | Planka | Trello | open-board **BH** |
| engineering (Anselm, Femi) | n8n | Zapier | open-hand-off **BH** |
| design (Anika) | Penpot | Figma | open-design **BH** |
| design (Anika) | Nextcloud | Google Drive, Dropbox | open-drive **BH** |
| design (Anika) | Excalidraw | Miro | meet-draw **BH** |
| sales (Kofi) | Twenty | Salesforce | open-crm **BH** |
| sales (Kofi) | Docuseal | DocuSign | meet-sign |
| sales (Kofi) | AnythingLLM | ChatGPT | meet-ask |
| people (Odile) | Campfire | Slack, Microsoft Teams | open-chat **BH** |
| people (Odile) | Docmost | Notion | meet-wiki **BH** |
| people (Odile) | Paperless-ngx | Evernote | kitchen-paper |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| comms-vault | 1Password to VaultWarden | logins, notes and cards the import maps | file attachments; item history; shared-vault structure |
| open-repos | GitHub to Forgejo | repository code and history; issues and pull requests when a token allows | Actions workflows; stars and followers; Discussions, Projects, Pages |
| open-design | Figma to Penpot | nothing automatic; Anika rebuilt the components by hand | Figma files, plugins, prototypes |
| open-crm | Salesforce to Twenty | accounts, contacts and opportunities as CSV rows with relations mapped | flows and triggers; reports and dashboards; sharing rules; activity history |
| open-board | Trello to Planka | lists, cards, labels, checklists, comments | Power-Ups and automations; attachments and members (check one board first) |
| open-chat | Slack to Campfire | nothing: no verified importer for Campfire | channel history stays at the old service |
| open-drive | Google Drive to Nextcloud | files and folders with names and structure | sharing settings; comments and suggestion history; version history |
| open-hand-off | Zapier to n8n | the idea of each automation, rebuilt | Zap definitions, run history, connection tokens |
| meet-wiki | Notion to Docmost | page text and nested structure; images and files in the export | comments and page history; sharing; databases (arrive as CSV) |

**The beat outline** (25 beats: 6 first-run, 18 in rooms, 1 outro; 9 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Anselm, does the first run; Rivet says hello.
- **The comms room** (Comms Room, server): A status page by the router (Anselm, Uptime Kuma); One vault for shared logins* (Anselm, VaultWarden).
- **The open office** (Open Office, workfloor): The code moves in* (Anselm, Forgejo); The note and the diff (Femi, Hermes); The screens sit on the Core (Anika, Penpot); Every lead in one list* (Kofi, Twenty); The sprint board (Femi, Planka); The office channel* (Odile, Campfire); The shared drive moves in (Anika, Nextcloud); A hand-off, built by hand (Femi, n8n).
- **The meeting room** (Meeting Room, meeting): Everything the company rents* (Marit, Wallos); Day one, one handbook (Odile, Docmost); The flow, sketched (Anika, Excalidraw); Signed at the table (Kofi, Docuseal).
- **The phone booth** (Phone Booth, meeting): A question for the files (Kofi, AnythingLLM).
- **The kitchenette** (Kitchenette, kitchen): Receipts, searchable (Odile, Paperless-ngx); The week by the kettle (Marit, Companion Planning); Her own notes, her own file (Marit, Companion Memory).
- **Your turn**: Your turn next*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-vault, open-repos, open-crm, open-chat, meet-list, outro-close (about 201 spoken words, limit 215, sign-off included). Role cuts: Marit, Founder and chief executive: "Everything the company rents" (Wallos); Kofi, Sales and partnerships: "Every lead in one list" (Twenty, replaces Salesforce); Anselm, Chief technology officer: "The code moves in" (Forgejo, replaces GitHub).

**The arc.** Six people, one list. The founder writes what the company rents on the whiteboard; the CTO, who is the one who installs the apps, moves the working memory of the company (code, contacts, handbook, logins) onto one shelf. Edge: the product itself runs where it runs; a security questionnaire from a first big customer is a different problem and is not touched.

**Honest edge** (printed or said once): The product runs in a cloud account that the Core does not replace. What moved is the company's own working memory. **Never say:** hybrid, remote or distributed team; a security questionnaire answered; SSO, roles; the product is hosted on the Core. **Hook line for the lander and the ad:** "Where does your customer list live?"

**Counts.** 18 apps (15 third party), 15 rented services named, 9 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.2 Pannierwell: startup, 5 people (`pannierwell`, building `garage-lab`, wave 2)

**What it is.** Pannierwell builds a swappable battery pack for cargo bikes. Five people share a converted garage, with the bench on one side and the desks on the other. Firmware, parts lists and supplier papers sit on one Companion Core. Sector: Battery packs for cargo bikes. Tagline: "Five people, one battery pack, and a Companion Core by the parts shelves." Address: 5 Cooper's Row, Brackenmere (invented). Narrator `v-steady-m`.

**The building.** Converted two-bay garage with a side annex: a gable or flat garage volume, one garage opening 4.8 m wide, a side door, driveway, a cargo bike. No new engine construct, low risk (engine report section 4.1 "garage startup" variant). 90 m2, 1 storey, about 6 seats for 5 people on the floor (display name "Tackroom", never in story text). **The Core's place:** Back Room, steel-topped shelf above the router and parts bins, no books, chalk Core. Back Room 3.6 x 3.6 m, no windows on its perimeter walls, floor concrete. Beside the Workshop Bay so the route is short. **Route:** garage door and side door, Workshop Bay past the bench, the Back Room door, orbit.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Workshop Bay (workshop) | 30 | garage | bench run, tool wall, parts rack, test rig (P2 trades set); two bench positions count as seats |
| Desk Room (workfloor, office) | 20 | workspace |  4 seats |
| Meeting Nook (meeting) | 9 | meeting | glass partition 4 seats |
| Back Room (the Core) (server) | 13 |  |  |
| Kitchenette (kitchen) | 9 | kitchen |  |
| Entry (entry) | 7 |  |  |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Haldis | Founder and electrical engineer | owner | founder_owner (business-owner) | 2 of 5 | yes, agent Gantry (OpenClaw) | 7 |
| Teodor | Firmware engineer | engineering | software_engineer (builder) | 4 of 5 |  | 3 |
| Saoirse | Mechanical designer | design | designer (creative) | 3 of 5 |  | 3 |
| Lior | Supply and operations | operations | office_manager (organiser) | 3 of 5 |  | 3 |
| Quentin | Test and support lead | support | customer_support (new research) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Haldis) | OpenClaw WebCLI | (none listed) | ftue-hello, back-lookup, back-order |
| owner (Haldis) | LibreOffice | Microsoft Office | desk-letter |
| owner (Haldis) | Papra | Evernote | nook-sign |
| owner (Haldis) | Akaunting | QuickBooks | kitchen-books **BH** |
| owner (Haldis) | Companion Planning | (none listed) | kitchen-week |
| engineering (Teodor) | Gitea | GitHub | bench-firmware **BH** |
| engineering (Teodor) | draw.io | Lucidchart | bench-wiring **BH** |
| engineering (Teodor) | JupyterLab | (none listed) | bench-notebook |
| design (Saoirse) | Immich | Google Photos | bench-photos **BH** |
| design (Saoirse) | Inkscape | Adobe Illustrator | bench-label |
| design (Saoirse) | Stirling-PDF | Adobe Acrobat | desk-pack |
| operations (Lior) | VaultWarden | LastPass | back-vault **BH** |
| operations (Lior) | Grist | Airtable | desk-parts **BH** |
| operations (Lior) | Papra | Evernote, Google Drive | desk-datasheets |
| support (Quentin) | Vikunja | Todoist, Asana | bench-builds |
| support (Quentin) | BookStack | Confluence | nook-wiki **BH** |
| support (Quentin) | Baikal | Google Calendar | kitchen-calendar **BH** |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| back-vault | LastPass to VaultWarden | logins, notes and form data the CSV carries | attachments; one-time-code seeds; shared-folder structure |
| bench-firmware | GitHub to Gitea | repository code and history; issues and pull requests with a token | Actions workflows; Discussions; Projects; Pages |
| bench-wiring | Lucidchart to draw.io | shapes, connectors and text in most diagrams | data-linked shapes; comments and revision history; draw.io keeps no copy, the file is saved by the person |
| bench-photos | Google Photos to Immich | photos and videos with capture dates; named albums | sharing and comments; untitled albums; faces and memories |
| desk-parts | Airtable to Grist | tables rebuilt by hand or by CSV; no importer claimed for Grist | automations and interfaces; row comments; revision history |
| nook-wiki | Confluence to BookStack | nothing automatic; HTML or Word pages can be brought in by hand | macros; page history; the old space settings |
| kitchen-calendar | Google Calendar to Baikal | events, times, recurrence and attendees from the .ics file | sharing settings; Meet links; Tasks |
| kitchen-books | QuickBooks to Akaunting | customers, transactions, bank transactions from CSV or Excel | the full books; the pay service; bank feeds |

**The beat outline** (25 beats: 6 first-run, 18 in rooms, 1 outro; 9 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Haldis, does the first run; Gantry says hello.
- **The back room** (Back Room, server): Supplier logins, one vault (Lior, VaultWarden); A part number, looked up* (Haldis, OpenClaw WebCLI); The order form, filled (Haldis, OpenClaw WebCLI).
- **The workshop bay** (Workshop Bay, workshop): Firmware beside the test rig* (Teodor, Gitea); Wiring, drawn once (Teodor, draw.io); The test logs, in a notebook (Teodor, JupyterLab); Every cracked casing, filed (Saoirse, Immich); The pack label, drawn (Saoirse, Inkscape); The build board (Quentin, Vikunja).
- **The desk room** (Desk Room, workfloor): The parts list in one table* (Lior, Grist); Datasheets, searchable (Lior, Papra); One assembly pack (Saoirse, Stirling-PDF); The pilot letter, drafted (Haldis, LibreOffice).
- **The meeting nook** (Meeting Nook, meeting): Assembly notes, in order* (Quentin, BookStack); The pilot, signed on paper (Haldis, Papra).
- **The kitchenette** (Kitchenette, kitchen): The test rig, on a calendar (Quentin, Baikal); Friday, the books* (Haldis, Akaunting); The build weeks, on one page (Haldis, Companion Planning).
- **Your turn**: Over to you*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, back-lookup, bench-firmware, desk-parts, nook-wiki, kitchen-books, outro-close (about 199 spoken words, limit 215, sign-off included). Role cuts: Haldis, Founder and electrical engineer: "A part number, looked up" (OpenClaw); Teodor, Firmware engineer: "Firmware beside the test rig" (Gitea, replaces GitHub); Lior, Supply and operations: "The parts list in one table" (Grist, replaces Airtable).

**The arc.** A hardware startup that is also a bench. The founder owns the Core and the errands; the parts list, the datasheets, the firmware and the test photos sit next to the rig that made them. Edge: supplier websites are on the internet, so the agent beats say so; the product is hardware and ships from the bench, not from the Core.

**Honest edge** (printed or said once): Ordering parts means visiting supplier websites over the office internet. The agent fills forms; Haldis reads and sends. **Never say:** the product is sold online; a customer portal; the van or the courier reaching the Core; a CI run. **Hook line for the lander and the ad:** "The parts list, the firmware and the test photos, in one back room."

**Counts.** 16 apps (14 third party), 15 rented services named, 8 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.3 Curatory: startup, 11 people (`curatory`, building `dev-shop-unit`, wave 3)

**What it is.** Curatory makes audio and text guides for small museums. Eleven people share one business-park unit. The code, the help pages, the device tests and the logins sit on one Companion Core behind a glass wall. Sector: Visitor guides for small museums. Tagline: "Visitor guides for small museums, and one Companion Core behind glass." Address: 6 Cartwheel Park, Sallowfold (invented). Narrator `v-warm-f`.

**The building.** Business-park unit: corrugated steel and glass front, flat roof, covered deck, bike store. Needs the business lot context (2 d) and a blank fascia board (0.5 d); no curtain wall. 260 m2, 1 storey, about 14 seats for 11 people on the floor (display name "The Steel Unit", never in story text). **The Core's place:** Comms Room, rack shelf (steel), chalk Core, no books. Comms Room 13 m2 with a glass wall onto the Open Office so the establishing walk sees the Core room; but no windows to the street (office-comms-blind). **Route:** street door, Reception, along the Open Office bench, the glass wall, the Comms Room door, orbit. Short route.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Reception (reception) | 12 | reception |  |
| Open Office (workfloor, office) | 110 | workspace |  14 seats |
| Meeting Room (meeting) | 18 | meeting |  8 seats |
| Huddle Room (meeting) | 8 | meeting |  4 seats |
| Phone Booth (meeting) | 4 |  |  |
| Kitchenette (kitchen) | 22 | kitchen | long table |
| Device Lab (workshop) | 14 |  | bench, device shelves, monitors (P2 dev set) |
| Comms Room (the Core) (server) | 13 |  | at least 3.6 x 3.6 m = 12.96 m2 (it was 12) |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Yara | Founder and chief executive | owner | founder_owner (business-owner) | 2 of 5 |  | 3 |
| Ilse | Customer success lead | support | customer_support (new research) | 3 of 5 | yes, agent Tally (Hermes) | 4 |
| Dmitri | Backend engineer | engineering | software_engineer (builder) | 4 of 5 |  | 3 |
| Naledi | App engineer | engineering | software_engineer (builder) | 4 of 5 |  | 3 |
| Rashida | Product designer | design | designer (creative) | 3 of 5 |  | 3 |
| Joaquin | Partnerships manager | sales | sales_bd (business-owner and marketer) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Yara) | Akaunting | Xero | open-books |
| owner (Yara) | Open WebUI | ChatGPT | meet-ask |
| owner (Yara) | BookStack | Notion | kitchen-first-day |
| support (Ilse) | Hermes | (none listed) | ftue-hello, comms-draft |
| support (Ilse) | VaultWarden | 1Password | comms-vault **BH** |
| support (Ilse) | BookStack | Confluence | open-wiki **BH** |
| engineering (Dmitri, Naledi) | Forgejo | GitHub | open-repos **BH**, open-review |
| engineering (Dmitri, Naledi) | Rocket.Chat | Slack, Discord | open-chat |
| engineering (Dmitri, Naledi) | Baserow | Airtable | lab-matrix **BH** |
| engineering (Dmitri, Naledi) | JupyterLab | (none listed) | lab-trace |
| engineering (Dmitri, Naledi) | LibreTranslate | Google Translate, DeepL | lab-text |
| design (Rashida) | Penpot | Figma | open-design **BH**, meet-wall |
| design (Rashida) | Inkscape | Adobe Illustrator | open-icons |
| sales (Joaquin) | Twenty | Salesforce | open-crm **BH** |
| sales (Joaquin) | Papra | Evernote, Google Drive | meet-paper |
| sales (Joaquin) | Open WebUI | ChatGPT, Claude | kitchen-follow |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| comms-vault | 1Password to VaultWarden | logins, cards, identities and notes the import maps | some item types; item history; shared-vault structure; attachments added again by hand |
| open-repos | GitHub to Forgejo | repository code and history; issues and pull requests with a token | Actions workflows; stars and followers; Discussions, Projects, Pages |
| open-design | Figma to Penpot | nothing automatic; components rebuilt by hand | plugins; prototypes; comment history |
| open-crm | Salesforce to Twenty | accounts, contacts and opportunities as CSV rows with relations mapped | flows and triggers; reports and dashboards; sharing rules; activity history |
| open-wiki | Confluence to BookStack | HTML or Word pages by hand | macros; page history and comments; the old space settings |
| lab-matrix | Airtable to Baserow | tables, rows, field types, links and grid views | automations and interfaces; row comments; revision history |

**The beat outline** (25 beats: 6 first-run, 18 in rooms, 1 outro; 8 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Ilse, does the first run; Tally says hello.
- **Behind the glass wall** (Comms Room, server): Shared logins, one vault (Ilse, VaultWarden); A reply, drafted* (Ilse, Hermes).
- **The open office** (Open Office, workfloor): The guide player moves in* (Dmitri, Forgejo); A pull request, read closely (Naledi, Forgejo); Gallery maps, drawn here (Rashida, Penpot); The icon set, in a browser (Rashida, Inkscape); Museum partners, one table* (Joaquin, Twenty); The floor's own channel (Dmitri, Rocket.Chat); The annual invoices (Yara, Akaunting); The help pages she answers from (Ilse, BookStack).
- **The device lab** (Device Lab, workshop): Every test device, one table* (Naledi, Baserow); A crash trace, in a notebook (Dmitri, JupyterLab); Guide text in four languages (Naledi, LibreTranslate).
- **The meeting room** (Meeting Room, meeting): The agreement, signed on paper (Joaquin, Papra); The layout, on the wall screen (Rashida, Penpot); A summary, then the clause (Yara, Open WebUI).
- **The kitchenette** (Kitchenette, kitchen): A first day, as a page (Yara, BookStack); A follow-up note, tightened (Joaquin, Open WebUI).
- **Your turn**: Over to your floor*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-draft, open-repos, open-crm, lab-matrix, outro-close (about 190 spoken words, limit 215, sign-off included). Role cuts: Ilse, Customer success lead: "A reply, drafted" (Hermes); Joaquin, Partnerships manager: "Museum partners, one table" (Twenty, replaces Salesforce); Naledi, App engineer: "Every test device, one table" (Baserow, replaces Airtable).

**The arc.** A startup of eleven where the person who answers the museums owns the Core: support is the thin role, and here it is the one who installs the apps. The Core room has a glass wall onto the floor, so everyone can see where the work sits. Edge: the guides themselves are hosted elsewhere; nothing on the Core faces the museums.

**Honest edge** (printed or said once): Museums reach the guides on hosting the company already uses. The Core holds the company's own working memory and the help pages the support lead answers from. **Never say:** help centre for museums; live chat; customer portal; the guides are served from the Core; a mobile app on the Core. **Hook line for the lander and the ad:** "The support lead owns the Core."

**Counts.** 14 apps (13 third party), 17 rented services named, 6 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.4 Gutterfold: small business, 14 people (`gutterfold`, building `agency-printworks`, wave 2)

**What it is.** Gutterfold designs brands and packaging for food and drink makers. Fourteen people work in a former printworks, under a double-height studio floor. Files, proofs, hours and invoices sit on one Companion Core. Sector: Brand and packaging studio. Tagline: "Fourteen people design the packaging for food and drink makers." Address: 11 Bindery Lane, Pardew Cross (invented). Narrator `v-storyteller-m`.

**The building.** Dark-brick two-storey printworks conversion: tall steel windows, a glazed former loading door, a double-height studio floor with a mezzanine over about 40 percent of the plate. 290 m2, 2 storeys, about 18 seats for 14 people on the floor (display name "The Old Printworks", never in story text). **The Core's place:** Comms Room, wall shelf, chalk Core. Comms Room 3.6 x 3.6 m on level one, at the back of the studio floor. The stair to the mezzanine is not on the route (reached by story walks only). Rails across the stair step-off need a check (APARTMENTS 2.6). **Route:** glazed loading door, Reception, past the long table under the mezzanine, the Comms Room at the back.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Reception (reception) | 14 | reception |  |
| Studio Floor (workfloor) | 62 | workspace | double height, pin-up wall 8 seats |
| Pitch Room (meeting) | 16 | meeting |  8 seats |
| Studio Kitchen (kitchen) | 18 | kitchen |  |
| Print Room (workshop) | 9 | supply | plan table, large-format printer (P2 agency set) |
| Phone Booth (meeting) | 4 |  |  |
| Comms Room (the Core) (server) | 13 |  |  |
| Open Office Mezzanine (workfloor, office) | 40 (level 2) | workspace |  8 seats |
| Producer Office (office) | 10 (level 2) | study |  |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Freya | Founder and creative director | owner | founder_owner (business-owner) | 2 of 5 |  | 3 |
| Amara | Art director | design | designer (creative) | 3 of 5 |  | 3 |
| Luca | Senior designer | design | designer (creative) | 3 of 5 |  | 3 |
| Tamsin | Studio producer | projects | field_project_lead (contractor) | 3 of 5 |  | 3 |
| Imani | Studio marketing lead | marketing | marketing (marketer) | 3 of 5 |  | 3 |
| Priya | Studio manager | operations | office_manager (organiser) | 3 of 5 | yes, agent Bobbin (Hermes) | 4 |
| Bilal | Part-time bookkeeper | finance | finance_bookkeeping (business-owner and organiser) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Freya) | EspoCRM | Salesforce | studio-clients **BH** |
| owner (Freya) | Open WebUI | ChatGPT | studio-brief |
| owner (Freya) | Documenso | DocuSign | pitch-sign |
| design (Amara, Luca) | Nextcloud | Google Drive, Dropbox | studio-files **BH**, print-swatch |
| design (Amara, Luca) | Penpot | Figma | studio-layout **BH** |
| design (Amara, Luca) | Inkscape | Adobe Illustrator | studio-vector |
| design (Amara, Luca) | Stirling-PDF | Adobe Acrobat | print-proofs |
| design (Amara, Luca) | Immich | Google Photos | print-photos **BH** |
| projects (Tamsin) | Planka | Trello | studio-board **BH** |
| projects (Tamsin) | Excalidraw | Miro | pitch-wall **BH** |
| projects (Tamsin) | Kimai | (none listed) | kitchen-hours |
| marketing (Imani) | Mattermost | Slack, Discord | studio-chat **BH** |
| marketing (Imani) | Listmonk | Mailchimp | mezz-news **BH** |
| marketing (Imani) | Open WebUI | ChatGPT | mezz-draft |
| operations (Priya) | Hermes | (none listed) | ftue-hello, comms-late |
| operations (Priya) | Pi-hole | AdGuard, NextDNS | comms-dns |
| operations (Priya) | Nextcloud | Google Drive | kitchen-handbook |
| finance (Bilal) | Invoice Ninja | QuickBooks, FreshBooks | mezz-invoices **BH** |
| finance (Bilal) | Nextcloud | Google Drive, Dropbox | mezz-books |
| finance (Bilal) | Wallos | (none listed) | kitchen-rents |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| studio-files | Dropbox to Nextcloud | files and folders with names and structure | share links and shared-folder membership; version history; Paper docs; file requests and comments |
| studio-layout | Figma to Penpot | nothing automatic; components rebuilt by hand | plugins; prototypes; comment history |
| studio-board | Trello to Planka | lists, cards, labels, checklists, comments | Power-Ups and automations; attachments and members (check one board first) |
| studio-clients | Salesforce to EspoCRM | accounts and contacts as CSV rows with fields mapped | automations and reports; sharing rules; activity history |
| studio-chat | Slack to Mattermost | users, channels, direct messages, threads, files and reactions per the Mattermost mapping | Slack Connect channels; canvases; custom emoji images; integrations and workflows |
| print-photos | Google Photos to Immich | photos and videos with dates; named albums | sharing and comments; untitled albums; faces and memories |
| mezz-invoices | QuickBooks to Invoice Ninja | customers, invoices and related lists as CSV per data type | the full books; the pay service; bank feeds |
| mezz-news | Mailchimp to Listmonk | subscriber emails and CSV fields (Ghost's migrator; Listmonk imports CSV too) | campaigns and templates; automations and segments; reports |

**The beat outline** (28 beats: 6 first-run, 21 in rooms, 1 outro; 8 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Priya, does the first run; Bobbin says hello.
- **The comms room** (Comms Room, server): Ads and trackers, blocked (Priya, Pi-hole); A late payer, politely* (Priya, Hermes).
- **The studio floor** (Studio Floor, workfloor): Brand files sit on the Core* (Amara, Nextcloud); Layouts, drawn on the Core (Luca, Penpot); The mark, redrawn (Luca, Inkscape); The job board, in the studio* (Tamsin, Planka); The client list, kept here (Freya, EspoCRM); The studio's own channel (Imani, Mattermost); A long brief, summarised (Freya, Open WebUI).
- **The pitch room** (Pitch Room, meeting): The week, sketched on the wall (Tamsin, Excalidraw); The brief, signed at the table (Freya, Documenso).
- **The print room** (Print Room, workshop): Proofs, merged into one pack (Amara, Stirling-PDF); Shoot references, filed (Luca, Immich); Colour swatches, scanned in (Amara, Nextcloud).
- **The mezzanine** (Open Office Mezzanine, workfloor): Invoices, from the jobs* (Bilal, Invoice Ninja); The year-end folder (Bilal, Nextcloud); Newsletter list, kept on the Core (Imani, Listmonk); An intro, drafted and rewritten (Imani, Open WebUI).
- **The studio kitchen** (Studio Kitchen, kitchen): Friday hours, one table (Tamsin, Kimai); What the studio rents (Bilal, Wallos); The handbook, a folder (Priya, Nextcloud).
- **Your turn**: Over to your studio*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-late, studio-files, studio-board, mezz-invoices, outro-close (about 188 spoken words, limit 215, sign-off included). Role cuts: Tamsin, Studio producer: "The job board, in the studio" (Planka, replaces Trello); Amara, Art director: "Brand files sit on the Core" (Nextcloud, replaces Google Drive, replaces Dropbox); Bilal, Part-time bookkeeper: "Invoices, from the jobs" (Invoice Ninja, replaces QuickBooks, replaces FreshBooks).

**The arc.** A studio told through objects: the brand folders, the pin-up wall, the proofs from the printer, the Friday hours. The studio manager touches every app and owns the Core, so she narrates the office. Designers stay conflicted about AI: one small beat, a summary she checks. Edge: clients outside cannot reach the Core; proofs reach clients the way they always have.

**Honest edge** (printed or said once): Clients outside the studio cannot reach the Core. Files leave the way they always left: carried, printed or sent through the mail provider. **Never say:** share a folder with a client; client portal; Photoshop equivalent; AI-generated artwork; a result for the studio. **Hook line for the lander and the ad:** "Design files sit on the Core, in the studio."

**Counts.** 17 apps (16 third party), 18 rented services named, 8 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.5 Lintel & Sill: small business, 11 people (`lintel-and-sill`, building `practice-townhouse`, wave 1)

**What it is.** Lintel & Sill is a small architecture practice in a Georgian terrace house. Eleven people draw house extensions and shopfronts across three floors. Drawings, the post, hours and fee invoices sit on one Companion Core. Sector: Architecture practice. Tagline: "Eleven people draw extensions and shopfronts. The paper lives on one Core." Address: 9 Tanyard Terrace, Quenby Green (invented). Narrator `v-warm-f`.

**The building.** Georgian stone-coloured terrace house of three storeys: sash windows (grid 2x2), columned porch with fanlight (features.porch), hip roof, dormers, chimney. The house builder at its strongest: no new engine construct. Cheapest concept (about 2 d). 215 m2, 3 storeys, about 12 seats for 11 people on the floor (display name "Fanlight House", never in story text). **The Core's place:** Comms Room, wall shelf, chalk Core. The former pantry off the hall on level one, enlarged to 3.6 x 3.6 m (the engine report's 6 m2 pantry is too small for the finale lens). No windows. **Route:** porch, hall, Reception, corridor, Comms Room (short; film length by the budget formula about 18 s, an estimate).

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Reception (reception) | 14 (level 1) | reception |  |
| Waiting Room (reception) | 8 (level 1) | living |  |
| Meeting Room (meeting) | 20 (level 1) | meeting | the front room 8 seats |
| Kitchenette (kitchen) | 10 (level 1) | kitchen |  |
| Comms Room (the Core) (server) | 13 (level 1) |  |  |
| Partner Office North (office) | 16 (level 2) | study |  |
| Partner Office South (office) | 16 (level 2) | study | the practice manager's office |
| Open Office (workfloor, office) | 24 (level 2) | workspace |  4 seats |
| Archive Room (store) | 16 (level 3) | library | filing cabinets, plan chest |
| Quiet Room (none) | 12 (level 3) | den |  |
| Supply Room (store) | 6 (level 3) | supply |  |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Gideon | Principal architect | owner | founder_owner (business-owner) | 2 of 5 |  | 4 |
| Hira | Architect | design | designer (creative) | 3 of 5 |  | 3 |
| Reuben | Project architect | projects | field_project_lead (contractor) | 3 of 5 |  | 3 |
| Delphine | Practice manager | finance | finance_bookkeeping (business-owner and organiser) | 3 of 5 | yes, agent Rafter (Hermes) | 3 |
| Oskar | Appointments and contracts coordinator | legal | legal_contracts (lawyer) | 3 of 5 |  | 3 |
| Rhys | Office and people coordinator | people | office_manager (organiser) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Gideon) | Docuseal | DocuSign | front-sign |
| owner (Gideon) | AnythingLLM | ChatGPT | front-ask |
| owner (Gideon) | LibreOffice | Microsoft Office | manager-letter |
| owner (Gideon) | Companion Memory | (none listed) | kitchen-notes |
| design (Hira) | Stirling-PDF | Adobe Acrobat | front-plans |
| design (Hira) | draw.io | Microsoft Visio | open-sketch **BH** |
| design (Hira) | Immich | Google Photos | open-photos **BH** |
| projects (Reuben) | Kimai | (none listed) | open-hours |
| projects (Reuben) | LibreOffice | Microsoft Office | open-spec |
| projects (Reuben) | Paperless-ngx | Google Drive | archive-search |
| finance (Delphine) | Hermes | (none listed) | ftue-hello, comms-rafter |
| finance (Delphine) | Invoice Ninja | QuickBooks, FreshBooks | manager-fees **BH** |
| legal (Oskar) | Cryptgeon | Privnote | comms-note |
| legal (Oskar) | Paperless-ngx | Evernote | desk-post |
| legal (Oskar) | AnythingLLM | Claude | archive-ask |
| people (Rhys) | Baikal | Google Calendar, iCloud Calendar | desk-calendar **BH** |
| people (Rhys) | Nextcloud | Google Drive, Dropbox | open-drawings **BH** |
| people (Rhys) | BookStack | Confluence, Notion | kitchen-standards |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| desk-calendar | Google Calendar to Baikal | events, times, recurrence and attendees from the .ics file | sharing settings; Meet links; Tasks |
| manager-fees | QuickBooks to Invoice Ninja | customers and invoices as CSV per data type | the full books; the pay service; bank feeds |
| open-sketch | Microsoft Visio to draw.io | shapes, connectors and text in most diagrams | data graphics, macros and some stencils; layers and page behaviour; draw.io keeps no copy, the file is saved by the person |
| open-photos | Google Photos to Immich | photos and videos with capture dates; named albums | sharing and comments; untitled albums; faces and memories |
| open-drawings | Google Drive to Nextcloud | files and folders with names and structure; Docs and Sheets as Office files | sharing and access settings; comments and suggestion history; version history |

**The beat outline** (25 beats: 6 first-run, 18 in rooms, 1 outro; 9 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Delphine, does the first run; Rafter says hello.
- **The old pantry** (Comms Room, server): A password that opens once (Oskar, Cryptgeon); The monthly note, drafted* (Delphine, Hermes).
- **The front desk** (Reception, reception): The post, scanned at the desk* (Oskar, Paperless-ngx); The front room, on a calendar (Rhys, Baikal).
- **The front room** (Meeting Room, meeting): The appointment, signed at the table (Gideon, Docuseal); One set of drawings (Hira, Stirling-PDF); A question for the standards (Gideon, AnythingLLM).
- **The practice manager's desk** (Partner Office South, office): Fee invoices, by stage* (Delphine, Invoice Ninja); A fee letter, drafted (Gideon, LibreOffice).
- **The open office** (Open Office, workfloor): A diagram, saved with the job (Hira, draw.io); Site photos, filed on return* (Hira, Immich); Each person logs their hours (Reuben, Kimai); The specification, drafted (Reuben, LibreOffice); Drawings sit on the Core (Rhys, Nextcloud).
- **The archive** (Archive Room, store): The old drawing register* (Reuben, Paperless-ngx); Which letters mention a stage (Oskar, AnythingLLM).
- **The kitchenette** (Kitchenette, kitchen): The office standards, in a book (Rhys, BookStack); His own notes, kept close (Gideon, Companion Memory).
- **Your turn**: Over to your practice*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-rafter, desk-post, manager-fees, open-photos, archive-search, outro-close (about 204 spoken words, limit 215, sign-off included). Role cuts: Oskar, Appointments and contracts coordinator: "The post, scanned at the desk" (Paperless-ngx, replaces Evernote); Delphine, Practice manager: "Fee invoices, by stage" (Invoice Ninja, replaces QuickBooks, replaces FreshBooks); Hira, Architect: "Site photos, filed on return" (Immich, replaces Google Photos).

**The arc.** The best-fit small business: one building, one network, an owner who decides and paper everywhere. The practice manager owns the Core in the old pantry; the story is the post scanned at the front desk, the appointment signed at the front-room table, the drawings that sit on the Core. Edge: the site visit, the planning authority and the clients are out of frame; email, the bank and the accountant stay with the services that run them.

**Honest edge** (printed or said once): Email, the bank and the pay service stay with the services that run them. The site is out of frame; clients and consultants outside cannot reach the Core. **Never say:** planning or building-regulation compliance; a statement that a signature is valid; share drawings with a consultant outside; client portal; tax. **Hook line for the lander and the ad:** "Drawings sit on the Core, in the office."

**Counts.** 15 apps (13 third party), 17 rented services named, 5 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.6 Posy & Pail: small business, 10 people (`posy-and-pail`, building `shop-backoffice`, wave 2)

**What it is.** Posy & Pail is a florist with a workroom behind the shop. Ten people sell flowers, arrange weddings and keep the books. The orders, the supplier papers and the contracts sit on one Companion Core in the back office. Sector: Florist and wedding workroom. Tagline: "A flower shop and a wedding workroom, with one Core on the back-office desk." Address: 14 Market Parade, Tarnmouth (invented). Narrator `v-clear-f`.

**The building.** High-street brick terrace unit: glazed shop front with green awnings, a fascia strip (blank, no lettering), a closed neighbour unit (spike exists, reads as a shop from the street). Interior needs retail props (P2, about 3 d); fans off. 125 m2, 1 storey, about 8 seats for 10 people on the floor (display name "Awning Corner", never in story text). **The Core's place:** Back Office, desk (hero.surface: desk), chalk Core, no books. The contract's office-rooms rule must accept a Back Office holding the Core for retail (engine decision 4). 3.6 x 3.6 m minimum. The spike's back office reads as a home study: dress it as a desk with files and a printer. **Route:** double glazed door under the awning, Shop Floor, the Back Office door, orbit.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Shop Floor (workfloor) | 52 | shop | wall shelving, display tables, cash counter near the door |
| Consultation Room (meeting) | 12 | meeting | glass partition from the shop floor 4 seats |
| Back Office (the Core) (server, office) | 14 | study |  |
| Workroom (workshop) | 22 | garage | workbench run, buckets, recipe sheets |
| Stockroom (store) | 10 | supply |  |
| Staff Kitchenette (kitchen) | 12 | kitchen |  |
| Neighbour Unit (none) | 48 |  | closed, blinds |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Rosa | Owner and head florist | owner | founder_owner (business-owner) | 2 of 5 |  | 3 |
| Katya | Shop and newsletter lead | marketing | marketing (marketer) | 3 of 5 | yes, agent Pennant (Hermes) | 5 |
| Olu | Shop manager | operations | office_manager (organiser) | 3 of 5 |  | 3 |
| Eamon | Events consultant | sales | sales_bd (business-owner and marketer) | 3 of 5 |  | 5 |
| Maren | Part-time bookkeeper | finance | finance_bookkeeping (business-owner and organiser) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Rosa) | Docuseal | DocuSign | consult-sign |
| owner (Rosa) | LibreOffice | Microsoft Office | work-recipes |
| owner (Rosa) | Planka | Trello | work-board **BH** |
| marketing (Katya) | Hermes | (none listed) | ftue-hello, back-pennant |
| marketing (Katya) | Pi-hole | AdGuard, NextDNS | back-dns |
| marketing (Katya) | Listmonk | Mailchimp | shop-list **BH** |
| marketing (Katya) | Companion Planning | (none listed) | kitchen-season |
| operations (Olu) | Grist | Airtable | shop-orders **BH**, shop-stock |
| operations (Olu) | Baikal | Google Calendar | kitchen-rota |
| sales (Eamon) | EspoCRM | Salesforce | shop-clients **BH**, shop-follow |
| sales (Eamon) | Invoice Ninja | QuickBooks, FreshBooks | consult-quote |
| sales (Eamon) | LibreOffice | Microsoft Office | consult-letter |
| sales (Eamon) | Baikal | Google Calendar, iCloud Calendar | consult-diary **BH** |
| finance (Maren) | Papra | Evernote, Google Drive | back-invoices, stock-notes |
| finance (Maren) | Invoice Ninja | QuickBooks, FreshBooks | back-statement **BH** |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| back-statement | QuickBooks to Invoice Ninja | customers and invoices as CSV per data type | the full books; the pay service; bank feeds |
| shop-orders | Airtable to Grist | tables rebuilt by hand or by CSV; no importer claimed for Grist | automations and interfaces; row comments; revision history |
| shop-list | Mailchimp to Listmonk | subscriber emails and CSV fields | campaigns and templates; automations and segments; reports; sending reputation starts again |
| shop-clients | Salesforce to EspoCRM | accounts and contacts as CSV rows with fields mapped | automations and reports; sharing rules; activity history |
| consult-diary | Google Calendar to Baikal | events, times, recurrence and attendees from the .ics file | sharing settings; Meet links; Tasks |
| work-board | Trello to Planka | lists, cards, labels, checklists, comments | Power-Ups and automations; attachments and members (check one board first) |

**The beat outline** (25 beats: 6 first-run, 18 in rooms, 1 outro; 9 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Katya, does the first run; Pennant says hello.
- **The back office** (Back Office, server): Known trackers, blocked at the shop (Katya, Pi-hole); A note to the grower* (Katya, Hermes); Supplier invoices, scanned* (Maren, Papra); The hotel's monthly statement (Maren, Invoice Ninja).
- **The shop floor** (Shop Floor, workfloor): The week's order, one table* (Olu, Grist); Monday's stem counts (Olu, Grist); The list sits on the Core* (Katya, Listmonk); Each wedding, one row (Eamon, EspoCRM); After the tasting, a note (Eamon, EspoCRM).
- **The consultation room** (Consultation Room, meeting): The contract, signed at the table* (Rosa, Docuseal); A quote, written while they choose (Eamon, Invoice Ninja); The order of the day, typed (Eamon, LibreOffice); The consultation diary (Eamon, Baikal).
- **The workroom** (Workroom, workshop): Each arrangement, a recipe sheet (Rosa, LibreOffice); The wedding week, on a board (Rosa, Planka).
- **The stockroom** (Stockroom, store): Delivery notes, filed by grower (Maren, Papra).
- **The staff kitchenette** (Staff Kitchenette, kitchen): The delivery rota, by the kettle (Olu, Baikal); The season, on one page (Katya, Companion Planning).
- **Your turn**: Over to your shop*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, back-pennant, back-invoices, shop-orders, shop-list, consult-sign, outro-close (about 204 spoken words, limit 215, sign-off included). Role cuts: Katya, Shop and newsletter lead: "The list sits on the Core" (Listmonk, replaces Mailchimp); Rosa, Owner and head florist: "The contract, signed at the table" (Docuseal, replaces DocuSign); Maren, Part-time bookkeeper: "Supplier invoices, scanned" (Papra, replaces Evernote, replaces Google Drive).

**The arc.** The visual small business: a florist whose Core stands on a desk in the back office. Orders by phone and email, contracts at the consultation table, supplier papers scanned, the newsletter list kept in the shop. The person who "holds the list" owns the Core. Edge: no web shop, no online booking, no payments, no deliveries on screen; the van and the street are out of frame.

**Honest edge** (printed or said once): Nothing is sold, booked or paid online in these scenes. Orders come by phone and email, and the mail leaves through the provider the shop already uses. **Never say:** web shop; online booking; payments; delivery tracking; prices or totals. **Hook line for the lander and the ad:** "The newsletter list sits on the Core, in the shop."

**Counts.** 12 apps (10 third party), 14 rented services named, 6 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.7 Hartnoll Joinery: medium business, one site of a firm of about ninety (`hartnoll-joinery`, building `contractor-yard`, wave 3)

**What it is.** Hartnoll Joinery builds fitted interiors for shops and restaurants. About ninety people work for the firm, most of them in the workshop. This story is the office block, where planning, estimating and accounts keep their own tools on one Companion Core. Sector: Joinery and shopfitting firm. Tagline: "A joinery firm of about ninety, and one office block with its own Core." Address: 4 Sawpit Lane, Hollowmere (invented). Narrator `v-steady-m`.

**The building.** Corrugated steel workshop shed (high bay 5.2 m) plus a two-storey office block: two roller doors, a van in the yard. Needs per-volume roofs and clip (untested), the business lot context (2 d), a blank fascia board. 310 m2, 2 storeys, about 24 seats for 22 people on the floor (display name "Timber Yard Works", never in story text). **The Core's place:** Comms Room, rack shelf (steel), chalk Core, no books. Comms Room 3.6 x 3.6 m on level one of the office block beside Reception. No windows. The workshop is a hand-pinned garage-program room reached by story walks only. **Route:** street door to Reception, short corridor, the Comms Room door, orbit.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Reception (reception) | 12 (level 1) | reception |  |
| Open Office (workfloor, office) | 56 (level 1) | workspace |  14 seats |
| Break Room (kitchen) | 14 (level 1) | kitchen |  |
| Comms Room (the Core) (server) | 13 (level 1) |  |  |
| Estimating Office (office) | 24 (level 2) | workspace |  5 seats |
| Meeting Room (meeting) | 16 (level 2) | meeting |  8 seats |
| Supply Room (store) | 6 (level 2) | supply |  |
| Workshop (workshop) | 120 (level 1) | garage | high bay, benches, tool wall, racks (P2 trades set) |
| Stockroom (store) | 30 (level 1) | supply |  |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Cormac | Managing director | owner | founder_owner (business-owner) | 2 of 5 |  | 3 |
| Wei | Systems administrator | it | it_admin (new research, builder household chores) | 5 of 5 | yes, agent Lathe (OpenClaw) | 5 |
| Stellan | Production planner | operations | office_manager (organiser) | 3 of 5 |  | 3 |
| Lucia | Contracts manager | legal | legal_contracts (lawyer) | 3 of 5 |  | 3 |
| Tariq | Estimator | sales | sales_bd (business-owner and marketer) | 3 of 5 |  | 3 |
| Una | Finance manager | finance | finance_bookkeeping (business-owner and organiser) | 3 of 5 |  | 3 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| owner (Cormac) | Mattermost | Slack, Discord | open-chat **BH** |
| owner (Cormac) | Documenso | DocuSign | est-sign |
| owner (Cormac) | Companion Memory | (none listed) | kitchen-notes |
| it (Wei) | OpenClaw WebCLI | (none listed) | ftue-hello, comms-lathe |
| it (Wei) | Uptime Kuma | (none: Datadog and New Relic are full observability suites) | comms-status |
| it (Wei) | Pi-hole | AdGuard, NextDNS | comms-dns |
| it (Wei) | Docmost | Notion, Confluence | meet-where **BH** |
| operations (Stellan) | Vikunja | Todoist, Asana | open-board |
| operations (Stellan) | Grist | Airtable | open-sheet **BH**, workshop-print |
| legal (Lucia) | Paperless-ngx | Evernote | open-scan |
| legal (Lucia) | BentoPDF | Adobe Acrobat, Smallpdf | open-drawings |
| legal (Lucia) | Docmost | Notion | kitchen-first-day |
| sales (Tariq) | EspoCRM | Salesforce | est-leads **BH** |
| sales (Tariq) | Grist | Airtable | est-sheet |
| sales (Tariq) | n8n | Zapier, Make | est-hand-off **BH** |
| finance (Una) | Kimai | (none listed) | open-hours |
| finance (Una) | Paperless-ngx | Google Drive | open-notes |
| finance (Una) | Akaunting | QuickBooks | open-books **BH** |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| open-chat | Slack to Mattermost | users, channels, direct messages, threads, files and reactions via mmetl then mmctl | Slack Connect channels; canvases; custom emoji images; integrations and workflows |
| open-sheet | Airtable to Grist | tables rebuilt by hand or by CSV; no importer claimed for Grist | automations and interfaces; row comments; revision history |
| open-books | QuickBooks to Akaunting | customers, transactions and bank transactions from CSV or Excel (Akaunting import) | the full books; the pay service; bank feeds |
| est-leads | Salesforce to EspoCRM | accounts and contacts as CSV rows with fields mapped | automations and reports; sharing rules; activity history |
| est-hand-off | Zapier to n8n | the idea of each automation, rebuilt | Zap definitions, run history, connection tokens |
| meet-where | Notion to Docmost | page text and nested structure; images and files in the export | comments and page history; sharing; databases (arrive as CSV) |

**The beat outline** (26 beats: 6 first-run, 19 in rooms, 1 outro; 8 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Wei, does the first run; Lathe says hello.
- **The comms room** (Comms Room, server): A status page, read each morning* (Wei, Uptime Kuma); Wei's block list (Wei, Pi-hole); A firmware page, read for him* (Wei, OpenClaw WebCLI).
- **The open office** (Open Office, workfloor): The office block's channel (Cormac, Mattermost); Every job on one board* (Stellan, Vikunja); The cutting list, one table (Stellan, Grist); Delivery notes, scanned and found (Lucia, Paperless-ngx); One pack of tender drawings (Lucia, BentoPDF); Hours, logged by the job (Una, Kimai); The note behind an invoice (Una, Paperless-ngx); Job costs, for the accountant (Una, Akaunting).
- **The estimating office** (Estimating Office, office): Every tender in one list* (Tariq, EspoCRM); The estimating sheet, kept (Tariq, Grist); A won tender becomes a card (Tariq, n8n); A variation, signed at the desk (Cormac, Documenso).
- **The meeting room** (Meeting Room, meeting): What runs where (Wei, Docmost).
- **The workshop window** (Workshop, workshop): The list, printed for the bench (Stellan, Grist).
- **The break room** (Break Room, kitchen): The new starter's first week (Lucia, Docmost); His own notes, his own file (Cormac, Companion Memory).
- **Your turn**: Over to your office block*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-status, comms-lathe, open-board, est-leads, outro-close (about 189 spoken words, limit 215, sign-off included). Role cuts: Wei, Systems administrator: "A status page, read each morning" (Uptime Kuma); Stellan, Production planner: "Every job on one board" (Vikunja, replaces Todoist, replaces Asana); Tariq, Estimator: "Every tender in one list" (EspoCRM, replaces Salesforce).

**The arc.** The medium business, told as one site of a firm of about ninety. The office block (planning, estimating, accounts) runs its own tools on one Core; the workshop and the rest of the company stay on their own. The systems administrator owns the Core and is the respected sceptic: he reads a status page each morning, closes sign-up on day one, and writes down what runs where. Edge: one machine is one machine; the company suites, the main accounts package and the pay service stay where they are.

**Honest edge** (printed or said once): The office block's tools run on one Core; the company's own suites, the main accounts package and the pay service stay where they are. IT decides what the block runs. **Never say:** the whole company runs on one Core; single sign-on, audit or roles; a headcount served; failover or uptime; a second site. **Hook line for the lander and the ad:** "One office block keeps its own tools."

**Counts.** 15 apps (13 third party), 18 rented services named, 6 bring-your-data-home beats, no app needing a `reviewed.json` entry.

### 2.8 Loamfield: medium business, one department of a firm of about a hundred (`loamfield`, building `hub-courtyard`, wave 2)

**What it is.** Loamfield makes soil-moisture sensors for market gardens. About a hundred people work for the firm. This story is the product department, in its own timber building. Firmware, test notes and manuals sit on one Companion Core. Sector: Soil-moisture sensor maker. Tagline: "The product department of a sensor maker keeps its own tools on one Core." Address: 12 Furrow Lane, Ruddock Vale (invented). Narrator `v-storyteller-m`.

**The building.** Two-storey vertical-timber building on a stone plinth, mono-pitch roof, sliding glass to a planted courtyard, pergola, bike store (garden-flat pattern, APARTMENTS section 6), scaled down from the engine's 520 m2 coworking hub to about 380 m2 and about 30 seats. No curtain wall, no business context: a timber building in a landscaped plot. 380 m2, 2 storeys, about 30 seats for 24 people on the floor (display name "The Courtyard Building", never in story text). **The Core's place:** Comms Room, rack shelf (steel), chalk Core, no books. Comms Room 3.6 x 3.6 m beside Reception, no windows. The courtyard route is long: keep the courtyard path under 8 m. **Route:** street gate, courtyard path, the glass slider into Reception, the Comms Room door beside it, orbit.

| Room (role) | m2 | Program | Note |
|---|---|---|---|
| Reception (reception) | 24 (level 1) | reception |  |
| Open Office (workfloor, office) | 96 (level 1) | workspace |  16 seats |
| Meeting Room A (meeting) | 18 (level 1) | meeting |  8 seats |
| Meeting Room B (meeting) | 12 (level 1) | meeting |  4 seats |
| Test Lab (workshop) | 24 (level 1) |  | benches, device shelves, monitors (P2 dev set) |
| Kitchen (kitchen) | 22 (level 1) | kitchen |  |
| Supply Room (store) | 9 (level 1) | supply |  |
| Comms Room (the Core) (server) | 13 (level 1) |  |  |
| Open Office Gallery (workfloor, office) | 40 (level 2) | workspace |  8 seats |
| Team Room One (meeting) | 14 (level 2) | meeting |  4 seats |
| Team Room Two (meeting) | 14 (level 2) | meeting |  4 seats |
| Courtyard (none) |  |  | outdoor, planting, pergola |

**The cast** (featured people; the other desks are unnamed).

| Person | Title | Function | Lens (persona research) | Comfort | Core owner | Beats |
|---|---|---|---|---|---|---|
| Chiara | Firmware lead | engineering | cto_eng_lead (builder) | 5 of 5 | yes, agent Sprocket (Hermes) | 5 |
| Yusuf | Test engineer | engineering | software_engineer (builder) | 4 of 5 |  | 3 |
| Oona | Product designer | design | designer (creative) | 3 of 5 |  | 3 |
| Dilnoza | Technical writer | design | designer (creative) | 3 of 5 |  | 3 |
| Ewa | Company systems administrator | it | it_admin (new research, builder household chores) | 5 of 5 |  | 3 |
| Hester | Programme manager | projects | field_project_lead (contractor) | 3 of 5 |  | 4 |

**The stack by function** (app, the rented service its chip names, the beat; a bring-your-data-home beat is marked **BH**).

| Function (people) | App | Replaces (chip) | Beat |
|---|---|---|---|
| engineering (Chiara, Yusuf) | Hermes | (none listed) | ftue-hello, meet-summary |
| engineering (Chiara, Yusuf) | Forgejo | GitHub, GitLab (SaaS) | open-repos **BH** |
| engineering (Chiara, Yusuf) | Open WebUI | ChatGPT | open-ask |
| engineering (Chiara, Yusuf) | n8n | Zapier, Make | open-hand-off **BH** |
| engineering (Chiara, Yusuf) | Baserow | Airtable | lab-results **BH** |
| engineering (Chiara, Yusuf) | JupyterLab | (none listed) | lab-notebook |
| engineering (Chiara, Yusuf) | draw.io | Lucidchart | lab-diagram **BH** |
| design (Oona, Dilnoza) | Excalidraw | Miro, Mural | open-sketch, meet-demo |
| design (Oona, Dilnoza) | Docmost | Confluence, Notion | gal-manual, kitchen-first-week |
| design (Oona, Dilnoza) | LibreTranslate | Google Translate, DeepL | gal-translate |
| design (Oona, Dilnoza) | draw.io | Microsoft Visio | gal-diagrams **BH** |
| it (Ewa) | Uptime Kuma | (none: Datadog is a full observability suite) | comms-status |
| it (Ewa) | ntfy | (none listed) | comms-nudge |
| it (Ewa) | Docmost | Notion, Confluence | meet-list **BH** |
| projects (Hester) | Mattermost | Slack, Discord | open-chat |
| projects (Hester) | Vikunja | Todoist, Asana | open-board, kitchen-wall |
| projects (Hester) | Wallos | (none listed) | kitchen-rents |

**Bring your data home** (what the beat says comes along, and the one thing that does not; the writer names the move, then the limit, never a time or a whole migration).

| Beat | Move | Comes along | Does not come along |
|---|---|---|---|
| open-repos | GitHub to Forgejo | repository code and history; issues and pull requests with a token | Actions workflows; stars; Discussions; Projects; Pages |
| open-hand-off | Zapier to n8n | the idea of each automation, rebuilt | Zap definitions, run history, connection tokens |
| lab-results | Airtable to Baserow | tables, rows, field types, links and grid views | automations and interfaces; row comments; revision history |
| lab-diagram | Lucidchart to draw.io | shapes, connectors and text in most diagrams | data-linked shapes; comments and revision history; draw.io keeps no copy, the file is saved by the person |
| meet-list | Notion to Docmost | page text and nested structure; images and files in the export | comments and page history; sharing; databases (arrive as CSV) |
| gal-diagrams | Microsoft Visio to draw.io | shapes, connectors and text in most diagrams | data graphics, macros and some stencils; layers and page behaviour; draw.io keeps no copy, the file is saved by the person |

**The beat outline** (27 beats: 6 first-run, 20 in rooms, 1 outro; 9 flagged for the film, marked *).

- **First run** (the Core arrives): delivery, unbox, plug-in*, join*, pick, hello*. The owner, Chiara, does the first run; Sprocket says hello.
- **The comms room** (Comms Room, server): Her condition for the Core* (Ewa, Uptime Kuma); A nudge when a check fails (Ewa, ntfy).
- **The open office** (Open Office, workfloor): The firmware sits on the Core* (Chiara, Forgejo); The department's own channel (Hester, Mattermost); The sprint wall board* (Hester, Vikunja); The enclosure, sketched first (Oona, Excalidraw); A log line, explained (Yusuf, Open WebUI); A finished run, a new row (Yusuf, n8n).
- **The test lab** (Test Lab, workshop): Every test run, one table* (Yusuf, Baserow); Field data, in a notebook (Chiara, JupyterLab); The sensor wiring, drawn (Chiara, draw.io).
- **The meeting room** (Meeting Room A, meeting): Ewa reads every line (Ewa, Docmost); Friday's summary, drafted* (Chiara, Hermes); The design, walked through (Oona, Excalidraw).
- **The gallery desks** (Open Office Gallery, workfloor): The manual, as pages (Dilnoza, Docmost); The manual in three languages (Dilnoza, LibreTranslate); Diagrams for the manual (Oona, draw.io).
- **The kitchen** (Kitchen, kitchen): The first week, as pages (Dilnoza, Docmost); The sprint, printed for the wall (Hester, Vikunja); What the department rents (Hester, Wallos).
- **Your turn**: Over to your department*.

**Film and cuts.** Flagged beats: ftue-plug-in, ftue-join, ftue-hello, comms-status, open-repos, open-board, lab-results, meet-summary, outro-close (about 205 spoken words, limit 215, sign-off included). Role cuts: Ewa, Company systems administrator: "Her condition for the Core" (Uptime Kuma); Chiara, Firmware lead: "The firmware sits on the Core" (Forgejo, replaces GitHub, replaces GitLab (SaaS)); Yusuf, Test engineer: "Every test run, one table" (Baserow, replaces Airtable).

**The arc.** The second medium: a department inside a company of about a hundred. The department head wanted its own tools; the systems administrator agreed on one condition, reads a status page each morning and approves the list of what the Core runs. The engineering lead owns the Core. Edge: the company keeps its own suites; one department, one Core; no capacity or headcount claim.

**Honest edge** (printed or said once): The department keeps its own tools; the company keeps its own suites. IT agreed to the Core, reads its page each morning and decides what runs. **Never say:** single sign-on; audit trail; support contract; the company runs on it; uptime or failover; a certification. **Hook line for the lander and the ad:** "IT agreed to the department's Core on one condition."

**Counts.** 15 apps (14 third party), 18 rented services named, 6 bring-your-data-home beats, no app needing a `reviewed.json` entry.


### 2.9 The fleet, checked

**Apps by company** (x = named in at least one beat; the cap is three of eight for a third-party app).

| App | Reelwick | Pannierwell | Curatory | Gutterfold | Lintel and Sill | Posy and Pail | Hartnoll Joinery | Loamfield | Companies |
|---|---|---|---|---|---|---|---|---|---|
| Akaunting |  | x | x |  |  |  | x |  | 3 |
| Baikal |  | x |  |  | x | x |  |  | 3 |
| BookStack |  | x | x |  | x |  |  |  | 3 |
| Docmost | x |  |  |  |  |  | x | x | 3 |
| Docuseal | x |  |  |  | x | x |  |  | 3 |
| draw.io |  | x |  |  | x |  |  | x | 3 |
| EspoCRM |  |  |  | x |  | x | x |  | 3 |
| Excalidraw | x |  |  | x |  |  |  | x | 3 |
| Forgejo | x |  | x |  |  |  |  | x | 3 |
| Grist |  | x |  |  |  | x | x |  | 3 |
| Immich |  | x |  | x | x |  |  |  | 3 |
| Inkscape |  | x | x | x |  |  |  |  | 3 |
| Invoice Ninja |  |  |  | x | x | x |  |  | 3 |
| JupyterLab |  | x | x |  |  |  |  | x | 3 |
| Kimai |  |  |  | x | x |  | x |  | 3 |
| LibreOffice |  | x |  |  | x | x |  |  | 3 |
| Mattermost |  |  |  | x |  |  | x | x | 3 |
| n8n | x |  |  |  |  |  | x | x | 3 |
| Nextcloud | x |  |  | x | x |  |  |  | 3 |
| Open WebUI |  |  | x | x |  |  |  | x | 3 |
| Paperless-ngx | x |  |  |  | x |  | x |  | 3 |
| Papra |  | x | x |  |  | x |  |  | 3 |
| Penpot | x |  | x | x |  |  |  |  | 3 |
| Pi-hole |  |  |  | x |  | x | x |  | 3 |
| Planka | x |  |  | x |  | x |  |  | 3 |
| Stirling-PDF |  | x |  | x | x |  |  |  | 3 |
| Uptime Kuma | x |  |  |  |  |  | x | x | 3 |
| VaultWarden | x | x | x |  |  |  |  |  | 3 |
| Vikunja |  | x |  |  |  |  | x | x | 3 |
| Wallos | x |  |  | x |  |  |  | x | 3 |
| AnythingLLM | x |  |  |  | x |  |  |  | 2 |
| Baserow |  |  | x |  |  |  |  | x | 2 |
| Documenso |  |  |  | x |  |  | x |  | 2 |
| LibreTranslate |  |  | x |  |  |  |  | x | 2 |
| Listmonk |  |  |  | x |  | x |  |  | 2 |
| Twenty | x |  | x |  |  |  |  |  | 2 |
| BentoPDF |  |  |  |  |  |  | x |  | 1 |
| Campfire | x |  |  |  |  |  |  |  | 1 |
| Cryptgeon |  |  |  |  | x |  |  |  | 1 |
| Gitea |  | x |  |  |  |  |  |  | 1 |
| ntfy |  |  |  |  |  |  |  | x | 1 |
| Rocket.Chat |  |  | x |  |  |  |  |  | 1 |
| Hermes (first party) | x |  | x | x | x | x |  | x | 6 |
| Companion Memory (first party) | x |  |  |  | x |  | x |  | 3 |
| Companion Planning (first party) | x | x |  |  |  | x |  |  | 3 |
| OpenClaw WebCLI (first party) |  | x |  |  |  |  | x |  | 2 |

**Functions by company** (who holds each; the filter buttons on /office).

| Function | Reelwick | Pannierwell | Curatory | Gutterfold | Lintel and Sill | Posy and Pail | Hartnoll Joinery | Loamfield | Companies |
|---|---|---|---|---|---|---|---|---|---|
| owner | Marit | Haldis | Yara | Freya | Gideon | Rosa | Cormac |  | 7 |
| operations |  | Lior |  | Priya |  | Olu | Stellan |  | 4 |
| finance |  |  |  | Bilal | Delphine | Maren | Una |  | 4 |
| sales | Kofi |  | Joaquin |  |  | Eamon | Tariq |  | 4 |
| marketing |  |  |  | Imani |  | Katya |  |  | 2 |
| support |  | Quentin | Ilse |  |  |  |  |  | 2 |
| engineering | Anselm, Femi | Teodor | Dmitri, Naledi |  |  |  |  | Chiara, Yusuf | 4 |
| design | Anika | Saoirse | Rashida | Amara, Luca | Hira |  |  | Oona, Dilnoza | 6 |
| projects |  |  |  | Tamsin | Reuben |  |  | Hester | 3 |
| people | Odile |  |  |  | Rhys |  |  |  | 2 |
| legal |  |  |  |  | Oskar |  | Lucia |  | 2 |
| it |  |  |  |  |  |  | Wei | Ewa | 2 |

**Topics by company** (beats per category).

| Topic | Reelwick | Pannierwell | Curatory | Gutterfold | Lintel and Sill | Posy and Pail | Hartnoll Joinery | Loamfield | Companies |
|---|---|---|---|---|---|---|---|---|---|
| setup | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 8 |
| documents | 2 | 4 | 2 | 4 | 8 | 3 | 3 | 2 | 8 |
| communication | 2 | 1 | 2 | 1 | 2 | 3 | 2 | 2 | 8 |
| customers | 2 | 1 | 4 | 2 | 1 | 3 | 2 |  | 7 |
| money | 2 | 2 | 1 | 5 | 3 | 3 | 3 | 1 | 8 |
| projects | 3 | 3 |  | 2 | 1 | 4 | 4 | 3 | 7 |
| engineering | 2 | 3 | 4 |  |  |  |  | 5 | 4 |
| design | 2 | 2 | 3 | 3 | 1 |  |  | 3 | 6 |
| marketing |  |  |  | 2 |  | 1 |  |  | 2 |
| people | 1 | 1 | 1 | 1 | 1 |  | 1 | 1 | 7 |
| it | 2 | 1 | 1 | 1 | 1 | 1 | 4 | 3 | 8 |

**Rented services named in chips** (43 distinct; the pairs dropped by the skeptic pass are Datadog, New Relic, WeTransfer and Google Workspace): 1Password, AdGuard, Adobe Acrobat, Adobe Illustrator, Airtable, Asana, ChatGPT, Claude, Confluence, DeepL, Discord, DocuSign, Dropbox, Evernote, Figma, FreshBooks, GitHub, GitLab (SaaS), Google Calendar, Google Drive, Google Photos, Google Translate, iCloud Calendar, LastPass, Lucidchart, Mailchimp, Make, Microsoft Office, Microsoft Teams, Microsoft Visio, Miro, Mural, NextDNS, Notion, Privnote, QuickBooks, Salesforce, Slack, Smallpdf, Todoist, Trello, Xero, Zapier.

**Bring-your-data-home paths shown** (24 distinct service-to-app moves and 54 beats, each with its "does not come along" line; Miro to Excalidraw is gone because Excalidraw keeps nothing on the Core): 1Password to VaultWarden (2); Airtable to Baserow (2); Airtable to Grist (3); Confluence to BookStack (2); Dropbox to Nextcloud (1); Figma to Penpot (3); GitHub to Forgejo (3); GitHub to Gitea (1); Google Calendar to Baikal (3); Google Drive to Nextcloud (2); Google Photos to Immich (3); LastPass to VaultWarden (1); Lucidchart to draw.io (2); Mailchimp to Listmonk (2); Microsoft Visio to draw.io (2); Notion to Docmost (3); QuickBooks to Akaunting (2); QuickBooks to Invoice Ninja (3); Salesforce to EspoCRM (3); Salesforce to Twenty (2); Slack to Campfire (1); Slack to Mattermost (2); Trello to Planka (3); Zapier to n8n (3).

**What the numbers prove.** Distinct apps 46 (42 third party; the plan asked for at least 40). No third-party app in more than three of eight (37.5 percent; 30 apps sit exactly at the cap, so a writer who adds an app must drop one: the fleet gate fails otherwise). First-party: Hermes in six (the trio is exempt), Companion Memory and Companion Planning in three each, OpenClaw in two. Every function in at least two companies; every topic in at least two (setup, documents, communication, money and it in all eight). First names unique across the eight and not shared with any of the 30 families; companion names unique and not in the families' list; company names, places and streets collide with no family and no house id; no building display name appears in any story's words. Four narrator voices, two companies each.

---

## 3. The contract, in short

The full delta is `office-build-contract.md` (15 sections, 15 reconciliations). The decisions that matter:

| Decision | Choice |
|---|---|
| Building placement | one tree; spec field `use: "office"`; `index.json` keeps `houses` byte for byte and gains an `offices` array; `allHouses(index)` for the ten readers that must see both |
| Schema | sibling `company/v1`; `function` (12) instead of archetype; one companion, on the Core's owner; `scope` company, site or department; `floor` at most 25 |
| URLs | `/office` (`office.html`, extensionless like `/room-creator`), `/company/<slug>`; no `office/` directory (the local server answers 404 for a file and a directory of one name) |
| Claims | `claims-office.json` (28 rows, two base rules replaced, 12 disclosures), loaded for companies only; `cap-remote-access` kept as it is; the printed limits are the claims frame, HOLD |
| Label | "Fictional company. Real software." from the disclosure `fictional-company` |
| Roles | `roles-office.json` adds `workshop` and `store` room roles and seven item roles; the home-only room roles are dropped for an office |
| Credit guard | `author` is an internal token that appears nowhere; no port of `own-authors.mts` needed |
| Branch debt | do not wait for pass 2 or the apartments; Phase A on the a431fe6 shapes, Phase B after the rebase |
| Engine | six composer programs, office look defaults, props (K2 Node baker for seating), a business lot context for wave 3; no curtain wall; no 72-seat floor |
| Build | step 5o, a sibling of the family story build; `site.mts` not edited |

---

## 4. Work packages

Thirty-two packages in seven groups, 273 owned path patterns, zero overlaps (`gen/wps.mjs`; the full list is section 14 of the contract). **Order:** WP0 (decisions and a baseline), then WP1.1 first, then WP1.2, WP1.3, WP2A, WP5 and WP6 in parallel, WP2B to WP2D after WP2A, WP3 after the engine minimum, WP4 after a building is frozen, WP7 last of each milestone.

**Rules for every agent** (CLAUDE.md, applied): work in your own git worktree off `feat/office-page` (`git worktree add ../CI-Virtual-Home-office-<wp> -b feat/office-<wp> feat/office-page`); edit only the paths your package owns; never `git reset --hard`, `git clean -f`, force-push or delete work you did not create; never push or open a PR (the owner's go-ahead is required); never touch `<repo>`; no `Math.random`, `Date.now` or wall clock anywhere a frame depends on; never hand-edit a derived file; never run `pnpm run catalog` on Linux; never bless goldens; no builder credit, no mention of a game, no em or en dash, no exclamation mark in any shipped string; report the commands you ran and their results.

### WP0. Decisions and baseline (owner and coordinator; no code)

1. Answer O1 to O12 of section 5 (defaults apply if unanswered, except the four that gate the first public showing).
2. Record the **before** numbers in the worktree, because invariant I1 compares after with before, not with green: `pnpm run build && pnpm run typecheck && pnpm run validate && pnpm run test && pnpm run test:node`, `pnpm run story:validate -- --complete` (the families' fleet gate is known to fail today: 11 apps over the 40 percent cap and a small-business share of 15.7 against 18 percent; record exactly what it prints), `pnpm run story:bake -- --all --check` (30 fresh), `pnpm run story:ads -- --check`, `pnpm run portal:build` and `pnpm run portal:test` where a GPU is available. Save the outputs under the scratchpad.
3. Create the worktrees and the branch order; nothing is pushed.

### WP1.1. The contract commit (agent; 8 agent-hours)

Reads: `$W20/office-build-contract.md` sections 0 to 4, 6, the five `$W20/*.proposed.json` files. Owns: see section 14 of the contract. Do: apply `office-build-contract.md` section 16 (the skeptic amendments win over the proposed JSON files where they differ); copy the proposed schema, functions, roles and claims files to `content/story/schema/company.schema.json`, `functions.json`, `roles-office.json`, `claims-office.json`; write `company-names.json` (a deny-list: the sample and real names such as Northwind, Contoso, Acme, Globex, Initech, plus every service name in the store's `replaces` rows); add the company types, enum constants and `FICTIONAL_COMPANY_LINE` to `assets/story/types.ts` additively; write `assets/story/subject.ts` (`subjectOf`, `memberLabel`) and `mergeRoles` in `assets/story/roles.ts` (rule (b) of contract 4.1: drop the home-only room roles for an office); write `scripts/story/lib/kinds.mts` (`rolesFor(kind)`, `claimsFor(kind)` applying `replace` then the added rows, `functionsFor`); write `scripts/test-company-contract.mts` (the schema stays inside the `schema-lite` keyword subset; the shared defs equal the family schema's ignoring `description`; each enum constant equals its schema twin; `roles-office.json` keys equal `OFFICE_ROLE_IDS`, each item type is in `content/house-catalog.json`; every claims regex compiles, is not global, has `why` and `fix`; the merged set has 100 rules with unique ids; every `functions.json` pool id is in the catalog and none is `avoid`; the disclosure texts pass every rule; `FICTIONAL_COMPANY_LINE` equals the claims row; `subjectOf` returns the strings of contract section 3); write `reference/story/offices.md` and `company-voice.md` (from contract section 6 and the voice rules of `office-bible.md` 5.1); **copy the eight briefs and `index.json` verbatim to `reference/story/office-briefs/`** (the writers and WP4 read them there, not from `/tmp`). Commands: `pnpm run build && pnpm run typecheck`; `node --experimental-strip-types --test scripts/test-company-contract.mts`; `pnpm run test`. Acceptance: all green; **`git diff --stat main -- content/families content/story/claims.json content/story/roles.json content/story/casting.json content/story/cast-plan.json content/story/personas.json content/story/voices.json content/story/ads.json content/story/schema/family.schema.json reference/story/cast.md` is empty**; the WP0 before-numbers are unchanged. Do not: edit `claims.json`, `roles.json` or `family.schema.json`.

### WP1.2. The company validator (agent; 14 agent-hours; after WP1.1)

Owns: `scripts/story/lib/co/**` and the shared validator files of contract section 14. Do: `loadContext(root, { world, kind })`; `validateCompany`; the rules of contract 7.2 (each its own module in `co/`, including `co-app-facts`, contract 16.3), the fleet gates and `OFFICE_FLEET` in `co/limits.mts` (7.3); kind-aware `anchors.mts` (the universal list `universalBy.office`; `TEXT_ROLES` additions and `officeFlags`); `userStrings()` for the company strings; `--kind` in `validate-stories.mts`; the **`AMBIGUOUS` additions** (`twenty`, `campfire`, `synapse`, `medusa`) with an `ok-co-*` fixture, **only after** proving `pnpm run story:validate -- --complete` prints the same findings for the 30 families as before (else drop it and say so); `bad-cases-company.mts` with one case for each of the 28 `biz-*` rows and each `co-*` rule and the `ok-co-*` false-positive guards of claims.md 3.3; `make-bad-fixtures.mts --kind office`; the exemplar (a trimmed 24-beat company with its own `world/`, `office-casting.json` and one frozen office building). Commands: `node --experimental-strip-types scripts/story/make-bad-fixtures.mts --kind office`; `pnpm run story:validate -- test/fixtures/stories/company/exemplar.json`; `node --experimental-strip-types --test scripts/test-company-validator.mts`; `pnpm run test`. Acceptance: the exemplar is 0 errors, 0 review, 0 warnings; every `bad-co-*` fixture fails with exactly its rule and is the exemplar plus its mutation; every `ok-co-*` passes with its `absent` rule; the 30 families still validate identically; every rule is in `reference/story/validator.md`.

### WP1.3. Roles, anchors and the bake (agent; 6 agent-hours; after WP1.1)

Do: `deriveHouseFacts(dir, id, roles, cast, kind)` (`kind: 'office'` adds no `garden`, uses the merged table); `story-bake.mts` resolves the slug through `dirs.mts` (a stub until WP6.2 lands: read `content/offices/` when the slug is not in `content/families/`) and `rolesFor(kind)`; `test-office-roles.mts` on a frozen office building in `test/fixtures/stories/bake-world/houses/office-*` (counts, `nth`, `room` narrowing, fallbacks; every room name of the eight buildings resolves to the intended role: `gen/rooms.mjs` is the oracle). Acceptance: a company bake is byte-stable (run twice, the same bytes); a lock goes stale when the office table changes and a **family lock does not** (`pnpm run story:bake -- --all --check` reports 30 fresh).

### WP2A. Engine: the field, the index, the plugin, the gate sweep (agent; 12 agent-hours; first of WP2)

Do: `use` in `assets/spec/base.ts`, the office fragment and `rooms[].seats` in `assets/spec/compose.ts`; `scripts/lib/list-specs.mts` (`listSpecs`, `allHouses`); `build-house-index.mts` writes `offices` and leaves `houses` byte-identical; `scripts/validate/office.mts` (contract 5.2); the 22 directory-glob scripts and `build-house-plan.mts`, `render-house-shots.mts` use `listSpecs` or `allHouses` as the contract says; `test-goldens.mts` skips `use: office` ids by default and reports them "unbaselined"; `reference/HOUSE-SPEC.md`; a fixture office under `test/fixtures/houses/office-*.json` (never `content/houses/`). Commands: `pnpm run build && pnpm run typecheck && pnpm run validate && node --experimental-strip-types scripts/test-spec-types.mts && pnpm run test:node`. Acceptance: `index.json`'s 30 home rows byte-identical (a test); the fixture office is accepted; every home baseline unchanged.

### WP2B. Engine: programs, look defaults, dress, lints (agent; 43 agent-hours; after WP2A)

Do (all gated on `use === 'office'`): the six programs and their groups (contract 5.3); `PROGRAM_KIND` and `KIND` agree; `NAMES` inserted before `study` (the five regexes of 5.3, checked against 193 home room names); `ANCHORS`, `INTEREST`, dress recipes and `bareViolation` rules for workspace, meeting, reception; no fans, program floors, `styleKey` modern; the lints (`layout:repetition` exempts the office desk, board and screen groups; `layout:foyer` counts a reception desk or a reception room; `layout:core-walk` accepts 1.0 m inside a service room); the composer refuses a table the room cannot clear. Start from `$W20/spike/engine-prototype.patch` (282 lines, re-verified by the engine report; apply with `patch -p1`, then `node --experimental-strip-types scripts/build-house-assets.mts`). Commands: `node --experimental-strip-types scripts/test-room-composer.mts`, `test-compose-stability.mts`, `test-compose-parity.mts`, `test-dress-neutral.mts`, `pnpm run test:neutrality`, `pnpm run test:dress-hosts`, `pnpm run shot-planner -- --no-fixtures`. Acceptance: all green with the 30 homes' results unchanged; the prototype loft composes in under a second and passes QA with 0 errors; (owner, macOS) the 150 goldens do not move.

### WP2C. Engine: props and the Kenney path (agent; 72 agent-hours, two agents; after WP2A)

Do: P0 props (office desk 7 meshes, light chair at most 8, conference table, workstation kit, 42U rack, shelf without books, reception desk, display width), P1 and P2 sets per building (contract 5.4: phone booth, copier, steel shelving, water cooler and fridge, plan chest and plotter, pin-up wall, retail set, trades set, dev set); each under a **new role**, registered after every existing module with its `placement.ts` entry, iso hint and catalog row **appended by hand** (add `build-prop-catalog.mts --only <types>`; do not regenerate the catalog); `HOSTS` entries where a type carries goods; Kenney K2: a Node GLB baker reading `models/` (never committed: geometry plus role-named materials only), a `models/roles/kenney.json` role table, `ATTRIBUTION.md` and `THIRD_PARTY.md` rows (CC0). Commands: `node --experimental-strip-types scripts/test-room-composer.mts` (0 stale), `test-no-third-party-bytes.mts`, `pnpm run typecheck`. Acceptance: every type is at most 60 draw calls; the 30 homes' composition sizes unchanged (`measured.ts` diff is only appended lines); a 30-seat floor is at most 5,000 meshes.

### WP2D. Engine: world (agent; 11 agent-hours; before wave 3)

Do: `lot.context: 'business'` in `assets/world.ts`, a blank fascia board and totem (no lettering), blinds on our own windows, `test-world-business.mts`. Not: a curtain wall, `room-clip`. Acceptance: the business context renders for a fixture and shot QA is 0 errors; homes unchanged.

### WP3.0. Building coordinator (agent; 3 agent-hours; before the buildings)

Do: pin the eight display names in `assets/home-names.ts` (Brickworks Bay, Tackroom, The Steel Unit, The Old Printworks, Fanlight House, Awning Corner, Timber Yard Works, The Courtyard Building), none of which appears in any story's words; write `reference/OFFICES.md` (the recipe: the plate for a unit, the Core room, the route, the seat rule of contract 5.2, the room names of contract 4.1, the commands below, the credit token). Acceptance: `scripts/story/check-leaks.mts` finds no display name in the briefs.

### WP3.[building]. One agent each (eight; 8 to 14 agent-hours each; after the engine minimum)

The same brief, run for each building id in the table of contract 5.4 (**startup-loft, practice-townhouse, garage-lab, agency-printworks, shop-backoffice, hub-courtyard, dev-shop-unit, contractor-yard**). Inputs: the company's `company-briefs/<slug>.json` (`building`: rooms with m2, program and seats; the Core's place; the route), the spikes (`$W20/spike/gen-startup-loft.cjs`, `gen-shopfront.cjs`, `startup-loft-v2.json`, `shopfront.json`), `reference/APARTMENTS.md` (the plate, closed neighbour bays, party walls with `door: null`), `reference/OFFICES.md`. Owns only that building's files (contract 14). Do: author the spec (`use: "office"`, `defaults: 2`, `lighting.preset: "day"`, the internal author token, one flat hero: the Core, 3.6 x 3.6 m room, no openings on its perimeter walls to the street, 2 m clear in front, on a steel shelf or a desk); compose (`node --experimental-strip-types scripts/compose-house.mts --house <id> --write`, then `--dress --write`; strip the final newline); validate (`pnpm run validate --layout content/houses/<id>.json`; the office plugin runs by itself); shot QA (`node --experimental-strip-types scripts/render-house-shots.mts --house <id> --qa-only --shot door-to-core,orbit,core-orbit,hero-reveal` must show 0 errors, each warning explained in a note); `pnpm run plans -- --house <id>`; `python3 scripts/generate_house_iso.py --only <id> --no-manifest`; floorplans with `--only <id> --out <tmp>` and copy that building's own sheets; `pnpm run shot-planner -- --house <id> --update`; `pnpm run portal:thumbs -- --house <id>`; stills of each room for a contact sheet. Acceptance: 0 errors in validate and QA; `test-floorplan-graph` and `test-twins` pass; every room name resolves (`gen/rooms.mjs`); the Core room and the rooms the briefs' chapters name exist; one seat rule satisfied; thumbnails and previews exist. **Per building:** startup-loft (spike exists; productionise; Core room to 3.6 x 3.6; add a phone booth), practice-townhouse (the cheapest: the house builder at its strongest; the former pantry becomes the 3.6 x 3.6 Comms Room), garage-lab (new; two-bay garage with a side annex; bench run, parts rack), agency-printworks (double height, a mezzanine, rails across the stair step-off; the stair is not on the route), shop-backoffice (spike exists; add a Consultation Room; the Back Office is a desk-and-printer room, not a home study; fans off), hub-courtyard (scale the recipe to 380 m2, 30 seats; keep the courtyard path under 8 m), dev-shop-unit and contractor-yard (wave 3: need WP2D; per-volume roofs and clip for the yard are untested: plan a spike day).

### WP3.Z. Aggregates (agent; 3 agent-hours; after all buildings of a milestone)

Do: `pnpm run index` (offices array), `scenes/manifest.json` and `scenes/floorplans/floorplans.json`, `test/fixtures/hashes/compose-baseline-offices.json`, `test/fleet/baseline-offices.json`, `test/review/baselines/**` for offices. Acceptance: the home baselines are unchanged byte for byte; the owner receives the exact command for the goldens: `pnpm run goldens:update --house <ids>` on the Mac.

### WP4.0. Casting (agent; 6 agent-hours; after the first building is frozen)

Do: copy `office-cast-plan.proposed.json` to `content/story/office-cast-plan.json`, correct each room name to the baked building's; write `scripts/story/office/build-casting.mts` and `cast-lint.mts` and `scripts/test-office-cast.mts`; derive `office-casting.json` and `reference/story/office-cast.md`. Commands: `pnpm run story:cast:office`, `story:cast:office-lint`, `story:cast:office -- --check`. Acceptance: 0 errors: sizes 3/3/2 (partial until all eight), every signature app in the catalog and story-safe, each person's room exists in the building and answers their function, names unique across both collections.

### WP4.[slug]. A company story (eight pipelines; about 9.5 agent-hours each: writer 4, two adversarial reviewers 1.5 each, reviser 1.5, verifier 1)

**Writer** reads `company-briefs/<slug>.json` first, then `reference/story/personas.md`, `validator.md`, `company-voice.md`, `claims-office.json`. Writes `content/offices/<slug>.json` exactly the people `office-casting.json` lists, the chapters and beats of the brief (the seeds are lint-clean examples, to be rewritten in the people's own voices, never pasted), the `closing`, the notes. Rules: the writer rules in the brief's `writerRules` (the last five were added by the skeptic pass) and the app-facts table of contract section 16.2; every app beat carries `capability` (a phrase from the catalog description, the brief's `capabilityHint`), a body that names an app other than the beat's own lists it in `with` (the brief's `with`: the first-run `ftue-pick` names the apps the team adds), and the first-run `ftue-hello` carries `agent` and `approval`; at most six `say` lines; the one companion is the owner's; agent beats have an approval; the first mention of Companion Memory reads "Companion Memory (beta)"; the ftue notes (`Companion OS is in beta.`, `Installing apps uses the internet.`, `Messages pass through the chat service you choose.`, or the OpenClaw office line); no app outside the brief's list (the fleet gate counts). Loop: `pnpm run story:validate -- <slug>` until 0 errors, 0 review, 0 warnings; read the file aloud at 150 words a minute. **Reviewer one (honesty):** every sentence against `claims-office.json`, the disclosures and the briefs' `doNotSay`: does anything imply a capacity, a per-person account, a result, a remote scene, a whole migration, a customer? **Reviewer two (voice and truth):** is it a real day in this kind of company; is each person's tone their lens (`lens` card); does the app do what the beat says (catalog caveats); is the story different from the other seven (no shared first three beats, no shared hook). **Reviser** applies findings. **Verifier** runs `pnpm run story:validate -- <slug>`, `pnpm run story:bake -- <slug> --estimated`, `node --experimental-strip-types scripts/story/check-leaks.mts` (`check-copy.mts` lints built pages and runs in WP5.2 and WP7), and confirms the fleet numbers with `pnpm run story:validate -- --kind office --fleet`. Acceptance: validate 0/0/0; bake lock written; the briefs' counts held (apps within the cap, 8 to 12 film beats, at most 215 spoken words). Phase B (after the rebase): add `day`, `office` and `profile` blocks.

### WP5.1. The /office page (agent; 12 agent-hours)

Owns `office.html`, `portal/office.{js,css}`, `scripts/office-front.mts`, `test-office-front.mts`, `portal-tests/office-front.mts`. Do: the page of contract 10.3 on `test/fixtures/site/offices/` (three companies of three sizes) first, then on the real list; `office:index` writes the count words; the cards are static HTML; the script only filters. Acceptance: the static cards equal the companies in order; size and function buttons filter, count, set `?size=` and `?fn=` and keep every other parameter; no console error with JavaScript off or on; one h1, one main; 44 px targets; no horizontal scroll at 360 and 390; the count word follows the data for 1, 8 and 99; `gallery.js` shows no office.

### WP5.2. The company page (agent; 18 agent-hours)

Owns `scripts/story/office/{pages,site,site-lib}.mts`, `portal/company.css`, `content/story/bring-home.json`, `scripts/story/lib/bring-home.mts`, `check-copy.mts`, `check-leaks.mts`, `build-og.mts`, the og images, the page tests. Do: the page of contract 10.4 (Phase A sections first); `bring-home.json` curated from the 60-service research (`w8/bring-home.json`; the briefs' 25 distinct `bringHome` moves are the first entries), with no effort band, no vendor link and an honest "does not come along" line each; the leak scan covers `content/offices` and the building display names; the og image at most 150 KB. Acceptance: the page obeys the homes' pages' rules on the fixture offices; no JavaScript is needed to read it; `check-copy` is clean under the merged rules; the leak scan finds no building name.

### WP5.3. Shared chrome (agent; 8 agent-hours)

Owns `scripts/portal-pages.mts`, `scripts/story/pages.mts`, `index.html` (the nav link only), `portal/site.css`, `portal/family.css`. Do: the `Homes | Offices` switcher with `aria-current` on every page type; `countCopy`; `notFoundPage` offering both; `officeLd`; the two-selector `.card-company` rule. Acceptance: the footer still holds exactly its six links; the homes page is otherwise byte-identical; no horizontal scroll at 360 and 390.

### WP6.1. Tour and player (agent; 8 agent-hours)

Owns `assets/story/{runtime,popup,director,a11y,url,mount,keys}.ts`, `assets/viewer.ts`, the head script of `room-creator.html`, `portal/story.css`, `ship/player.mts`, `hooks.ts`, the tests. Do: contract section 11 (the `about` subject, `company` in `OWN_PARAMS` in both lists, `byCompany`, "Next company" stays inside offices, the failure card's "Read the company's story", an office opened with no company says "offices"). Acceptance: with `company=<slug>` the tour mounts from `byCompany`, the start card reads "<Name> at work" and "Start with Anselm, Chief technology officer"; with `family=` nothing changes (the player leg of `portal:test` passes untouched); `test-story-url.mts` keeps the two `OWN_PARAMS` lists equal.

### WP6.2. Film, ads and voice (agent; 10 agent-hours)

Owns `scripts/story/dirs.mts`, `scripts/voice/**`, `scripts/film/**`, the renderers, `ship/{audio,films}.mts`, `assets/story/film/**`, `ads-office.json`. Do: `dirs.mts` (`storyDirOf(slug)`; `CI_STORY_FAMILIES_DIR` still overrides), the label from the model not a constant, `subjectOf` in `filmText()` and the cut plan, `ads-office.json`, a company film refused while durations are estimated. Commands: `pnpm run story:ads -- --dry-run`, `--stills <dir>`, `pnpm run story:ads:test`, `pnpm run test:node`. Acceptance: the badge reads `Fictional company. Real software.` on every frame of every cut (`--stills`); the end card lists the right disclosure ids; **`content/story/ads.json` is byte-identical**; `test-film` and `test-ads` pass for families unchanged.

### WP7. Integration, the browser walk-through, the gates (agent; 24 agent-hours over three milestones)

Owns `scripts/build-portal.mts`, `test-portal*.mts`, `portal-lib.mts`, `portal-redact.mts`, `_headers`, `package.json`, `README.md`, `CLAUDE.md`, `check-house.mts`. Do: step 5o and the checks of contract 10.2; the guard changes of contract 12; the `package.json` commands; the README and CLAUDE rules block. **The browser walk-through** (the built site served under the sub-path, a real browser, at 1440, 768 and 390 px): `/` shows homes only and the Offices link; `/office` shows the cards, filters work, JavaScript off still shows everything; each `/company/<slug>` reads with no JavaScript, its tour link opens the player with `house` and `company`, the tour plays in daylight with captions, "Start with <name>" opens at that person's room, "Next company" stays inside offices, the share link goes to the company page; the 404 offers both galleries; the sitemap lists `/office` and the companies; the footer's six links; no console error; view the contact sheet of each building and the role cuts' stills by eye. Commands: `pnpm run build && pnpm run typecheck && pnpm run validate && pnpm run test && pnpm run test:node`, `pnpm run portal:build -- --strict-families`, `pnpm run portal:test`. Acceptance: all green; the I1 diff empty; the numbers equal the WP0 before-numbers for everything that is not an office.

---

## 5. Risks and owner decisions

### 5.1 Owner decisions, with the recommended default

No decision blocks the start. **Four gate the first public showing (marked ▲).**

| # | Decision | Recommended default | If you say otherwise |
|---|---|---|---|
| O1 | The URL: `/office` or `/business` | **`/office`** (what you asked for); `/company/<slug>` for a company; optional `_redirects` line `/offices /office 301` | a rename in `office.html`, the sitemap, the tests; the player's back links |
| O2 ▲ | Per-person Companion accounts: the docs' Organizations page says each person signs in with their own CI Account; the fact sheet and the claims canon say multi-user is not on the box | **The canon wins.** Offices say only "each app keeps its own sign-ins" and never mention Organizations or a Companion account per colleague; the three limits are HOLD until you rule | if the docs are right, the claims canon (`cap-multi-user`), the `biz-access-roles` row and the disclosures change first; then the stories may show colleagues signing in to the Hub |
| O3 | A medium business | **One site or one department of a larger firm, floor at most 25** (two of the eight) | cap the gallery at six (three and three) and drop Hartnoll and Loamfield; or raise `FLOOR_MAX` |
| O4 ▲ | The label "Fictional company. Real software." and whether fictional staff with job titles are allowed under "nobody is invented, cast, generated or composited as a team member" (ADS.md 9.1, written about Companion's own team) | **Approve the label and the long line "The people in it are characters, not customers."** Read ADS 9.1 as about Companion's own team (the same reading the families already rely on) | a different label; or no job titles on the cards |
| O5 | Remote access and the "share apps through a web link" line (ADS 9.5) | **Every scene stays inside the building**; the ban on "from the office" is kept (writers say "at the office") | a company-scoped copy of the rule; and the web-link line only with its relay and account stated |
| O6 ▲ | The company names (section 2) | **Use them as proposals**; counsel clears each; a web search found no exact match for any (limited evidence) | rename in `company-names.json`, the briefs, the cast plan; a day of rework at most before stories exist |
| O7 ▲ | Naming real SaaS products beyond the chips | **Only the services the store's own `replaces` rows name, in the chips and the "Rented before" panels, with `names-owners` and no attack verb**; no text-only mention of services the store does not pair (HubSpot, Gusto, Teams, Canva, PandaDoc, BambooHR): the stories say "the pay service", "the mail provider" | allow text-only mentions in "stays out there" lines; the `incumbent-attack` list already covers the names |
| O8 | Compliance wording and the setting limits | **None.** No compliance word anywhere; `not-advice` on pages naming invoicing or books; all eight settings are green (design, software, hardware, architecture, retail back room, trades, a product department); amber (accounting, law, recruiting) and red (clinics, advisers, schools, security) are not used | an accounting practice later, with its own review |
| O9 | Same sitemap and nav as the homes | **Yes**: `/office` and every `/company/<slug>` in the one sitemap; header with two links, Homes and Offices; footer untouched; JSON-LD `WebSite` stays "Virtual homes" with a second `CollectionPage` | a separate nav entry only; or rename the site "Virtual homes and offices" |
| O10 | The team multi-user boundary | one Core, one owner, per-app sign-ins named as that app's feature; one companion per company, on the owner; the claims frame (HOLD) | see O2 |
| O11 | Backups | **Not printed.** `owner-backups` stays HOLD; the three shipped Duplicati backup beats in the families (hwang, kamau, nwachukwu) are your call and are not touched | add one sentence about Hub's per-app backup to the fact sheet first |
| O12 | Merge order | **Do not wait** for the apartments or pass 2; build on PR #35's head; Phase A now, Phase B after the rebase; nothing is pushed without your go-ahead | merge the apartments first and switch the `author` token to `own-authors.mts` (one commit) |
| O13 | Stretched `replaces` pairs. The store lists Evernote and Google Drive against Paperless-ngx and Papra, and the market review calls both a loose fit (ten beats, two of them cut hooks: Lintel and Sill `desk-post`, Posy and Pail `back-invoices`); the families already print Paperless-ngx replaces Evernote | **Keep the store's pair on the tours and cuts, as the families do; counsel reads it with O7.** The skeptic pass already dropped the pairs the briefs' own limits contradict (Uptime Kuma with Datadog and New Relic, Cryptgeon with WeTransfer, LibreOffice with Google Workspace) | set `replaces: []` on the ten beats (app name only); the strongest ad hook becomes the app's job, not the swap |
| O14 | Akaunting's free production use is capped at two users, one company and one thousand invoices (BSL 1.1 Additional Use Grant, upstream LICENSE.txt, read 2026-10-19) | **Keep Akaunting in the three stories that use it, one person each, with the cap in the brief and in `licence-terms`** | swap to Invoice Ninja (an ELv2 pick) and lose the Xero and QuickBooks books move |
| O15 | Package gaps to raise with the Hub team before the stories ship: EspoCRM declares no volume for the app or its database; Inkscape declares none; Pi-hole publishes DNS on 8053 only; Grist has one default sign-in; Excalidraw keeps nothing | **The stories avoid every one of them** (briefs amended) and say "on the Core" only where the package keeps data | fix the packages, then relax the amended beats |

Smaller calls with defaults: the `author` token (R10); the `AMBIGUOUS` edit (R13); Kenney K2 (no Mac, no Blender) over K1 and the chunky look for seating, tables, shelving and plants; blank unlettered fascia signage; planner v2 with `duration: auto` for every office; first release at two (M1), six (M2) or eight (M3) offices (default: show M1 to you, ship M2).

### 5.2 Risks, in order of cost

| # | Risk | What breaks | Mitigation | Owner |
|---|---|---|---|---|
| 1 | **Honesty by implication.** An office story invites the reader to infer one Core serving a team, a login for each colleague, a floor that never goes down, a result for the business. No regex sees an implication | a claim the product cannot back, a business reader who acts on it | the briefs' `honestEdge` and `doNotSay`; reviewer one's job; the three printed limits (HOLD); medium told as a site or department; the agent belongs to one owner; every move names what did not come along | O2, reviewers |
| 2 | Fictional staff read as customers or team members (CAMPAIGN 17, ADS 9.1, trap T15) | a Kickstarter manual-review finding | the label, the long line, the footer line; characters are drawn as monograms, never faces | O4 |
| 3 | **Engine effort and platform-sensitive generated files**: 28 to 41 person-days; regenerating the prop catalog on Linux drifts 17 plant boxes; shared-code edits can move a home's picture, a dress bake or a compose baseline; goldens cannot be blessed on Linux | a home's golden or baseline moves | everything gated on `use === 'office'`; new props under new roles, appended; `--only` catalog mode; the neutrality tests; owner blesses on the Mac | WP2, owner |
| 4 | Branch debt: pass 2 and the apartments edit the same files (director, popup, runtime, pages, portal-front, index.html, CSS) | a long rebase | Phase A/B; `company/v1` additive; R1 keeps the count copy and the index away from the apartments' edits | WP7 |
| 5 | Business-claim exposure: comparative naming of incumbents is commercial speech; four apps carry licence limits (Elastic 2.0, BSL 1.1, Sustainable Use, AGPL plus commercial files); three shipped family beats already claim a backup | a counsel finding | `names-owners`, `licence-terms`, `apps-by-others`, no attack verbs, "source-available" never "open source"; counsel reads the licences | O7, counsel |
| 6 | The Core in the back room is fiction today: Companion Core launches on Kickstarter in October 2026 and ships from 2027 | a reader thinks it is shipping | the label on every surface; "Companion Hub runs today on other machines"; no date in copy | label |
| 7 | **Room-name landmines and the Core room**: Suite, Hall, Lobby, Lounge, Storage, Closet are home kinds; a 3 x 3 m Core room gives a 31 percent occluder and a 51.5 degree finale; a comms room on a glass facade shows racks in a barred window | a story that cannot anchor; a bad finale | `gen/rooms.mjs` as the oracle; rules `office-names`, `office-core`, `office-comms-blind`; 3.6 x 3.6 m | WP3 |
| 8 | **Sameness**: eight stories with the same shape | a gallery that reads as one story eight times | different arcs, Core owners, Core rooms, chat and wiki choices, honest edges; reviewer two checks it | WP4 |
| 9 | The fleet cap bites: 30 of 42 third-party apps sit exactly at three of eight | a writer who adds an app fails the fleet gate | the validator's fleet gate; writers keep to the brief's app list | WP4 |
| 10 | Usage limit: about 420 agent-hours; the weekly account limit already killed agents once, and the scratchpad is RAM (`/tmp` is a 16 GB tmpfs: two OOM kills on 2026-10-19) | killed runs | stagger the waves; M1 first; keep renders and scratch on disk, not `/tmp` | coordinator |
| 11 | Names are invented, not cleared; the deny-list is not a clearance | a collision with a real business | counsel; a rename costs a day before stories exist | O6 |
| 12 | The deployed site injects Google Analytics (a repository variable), which sits badly with a privacy lander; offices are for a business audience | a reader notices | no page says "no analytics" or "no third-party requests"; the owner's call (it is already open for the homes) | owner |
| 13 | **Package and licence facts the briefs got wrong or missed.** A beat that says "saved on the Core" for a stateless editor, Pi-hole as the office's DNS, Hermes reading another app, an accountant on the Core, a monitor on the machine it watches, Akaunting for a team | a false product claim on a business reader's screen, a licence breach by a reader who copies the story | briefs amended (Appendix C); contract 16.2 app-facts table and the `co-app-facts` rule with a fixture per row; reviewer two checks each app beat against the table | WP1.2, WP4 |
| 14 | **Capacity by implication.** The medium buildings show 24 to 30 seats and a floor of 22 to 24 people sharing one Core; five to eleven people use 12 to 18 apps; no capacity or performance statement exists (`f-unmeasured`) | a reader infers a headcount a Core serves | the floor figure is never printed on a page or in a cut; taglines carry no number beside "Core"; O3 stays an owner decision; ask for a capacity statement before M3 | O3, reviewers |
| 15 | **Comparative claims in paid cuts.** Ten Paperless-ngx and Papra beats carry Evernote or Google Drive; the research calls the fit loose | a misleading-comparison finding on a paid ad | O13 | counsel |
| 16 | **The estimate.** 420 agent-hours is the sum of person-days times four; the schedule says 30 percent rework is added and the headline omits it; the props line items sum to 23 days and the plan carries 18; M1's critical path ignores the plan's own "after WP2A" edges | the owner plans a week and gets a month | section 6 recalculated: 570 agent-hours with rework, M1 critical path 59 hours (77 with rework) | coordinator |
| 17 | **Facts nobody can verify from here** (`skeptic.md` section 7): Mattermost and Rocket.Chat free-edition limits, EspoCRM persistence, ntfy notifications on a local HTTP address, the live precedence of `office.html`, counsel on names and licences, trademark registers | a story ships a claim the product cannot back | each is a named check before the milestone that needs it | owner, Hub team, counsel |

---

## 6. Schedule

**Assumptions.** An agent-hour is one agent working continuously for an hour on a well-specified brief. A person-day of engine work is taken as 4 agent-hours (the GPU render loops are slower, the data work faster); 30 percent is added for rework and review. Six to eight agents run at once; the packages have disjoint files, so merges are mechanical. Owner time (decisions, the Mac, counsel) is listed separately and does not count as agent-hours.

| Package | Person-days | Agent-hours | Starts after |
|---|---|---|---|
| WP1.1 contract | 2 | 8 | WP0 |
| WP1.2 validator | 3.5 | 14 | WP1.1 |
| WP1.3 roles and bake | 1.5 | 6 | WP1.1 |
| WP2A field, index, plugin, sweep | 3 | 12 | WP0 |
| WP2B programs, look, dress, lints | 10.75 | 43 | WP2A |
| WP2C props and Kenney (range 14 to 23 d) | 18 | 72 | WP2A |
| WP2D world (wave 3 only) | 2.8 | 11 | WP2A |
| WP3.0 coordinator | 0.75 | 3 | WP2A |
| WP3 eight buildings (1.5 to 3 d each plus 0.4 integration) | 21 | 84 | WP2B and WP2C minimum |
| WP3.Z aggregates | 0.75 | 3 | each milestone |
| WP4.0 casting | 1.5 | 6 | the first building |
| WP4 eight stories (9.5 each) | 19 | 76 | casting |
| WP5.1 /office page | 3 | 12 | WP0 (fixtures) |
| WP5.2 company page | 4.5 | 18 | WP1.1 |
| WP5.3 shared chrome | 2 | 8 | WP0 |
| WP6.1 tour and player | 2 | 8 | WP1.1 |
| WP6.2 film, ads, voice | 2.5 | 10 | WP1.1 |
| WP7 integration (8 + 6 + 10) | 6 | 24 | each milestone |
| **Total** | **about 105** | **about 420 before rework; about 570 with the 30 percent rework below** (range 400 to 720) | |

Engine total: 34.5 person-days (WP2A to WP2D), inside the range 28 to 41 given in R8.

**Skeptic recalculation.** (1) The assumptions above add 30 percent for rework and review, but the 420 is 105 person-days times 4 and leaves it out: with it the total is 546. (2) WP2C carries props at 18 person-days; the engine report's own line items sum to 23 (P0 5.2, P1 8.3, P2 9.5) and the plan cut 5 days by dropping "P1 items only the eight offices use", yet five of the eight buildings need a P2 set (retail, trades, agency, dev, hub) and the line items price them at 9.5 days against the table's 4. The skeptic pass puts props at 23 days: +20 agent-hours. (3) The new `co-app-facts` rule and its fixtures: +2 agent-hours. Raw 442, with rework 575. The range is 400 (every spike transfers, no rework loop) to 720 (a second facade or roof construct fails in the first building that uses it, the likeliest being Hartnoll's per-volume roofs and Gutterfold's mezzanine rails). (4) The critical path to M1 below lists WP2A, WP2B-min and WP2C-min "in parallel", but the packages table says WP2B and WP2C start after WP2A: with the plan's own edges the path is WP0 1 + WP2A 12 + WP2C P0 props 18 + WP3 loft and townhouse 10 + WP4.0 3 + two stories 9 + WP7 6 = 59 agent-hours, 77 with rework, not 45 plus 30 percent.

**Milestones and the order that gives something to look at early.**

| Milestone | What you can look at | Agent-hours (cumulative) | Wall-clock from the start |
|---|---|---|---|
| **M0, about 10 agent-hours in** | `/office` on the built site with **two cards** (Reelwick and Lintel & Sill), the header switcher, the filters, the company pages' skeleton, drawn from fixture data and the spike stills (clearly draft; not committed). WP1.1, WP5.1, WP5.3 and the first cut of WP5.2 only | about 40 | about 10 hours |
| **M1, the page with two real offices** | the loft and the townhouse built with the new programs and props, their casting, two stories, two tours that play (captions only), the company pages, the three role cuts of each as stills, the preview build | about 200 before rework, about 260 with it | 77 hours of critical path: about 3 elapsed days if agents run around the clock and nothing waits for a person, 5 to 7 working days with one review loop |
| **M2, six offices** | + Pannierwell, Gutterfold, Posy & Pail, Loamfield: retail, trades, agency and dev prop sets; four buildings, four stories; sizes 2, 3, 1 (all three present); the first role cuts rendered | about 350 | + 60 to 80 hours |
| **M3, eight offices** | + Curatory and Hartnoll (the business lot context); fleet gate `--complete` green; all 24 role cuts planned | about 420 | + 30 hours |

Why the loft and the townhouse first: the loft's spike already exists (a 6-person startup, 0 shot errors, the Core room to enlarge) and the townhouse is the cheapest build (the house builder at its strongest, no new construct, the best-fit small business); together they show two sizes, two exteriors and the P0 props only. The florist's spike also exists but needs the retail set (about 3 days), so it waits for M2.

**Critical path to M1 (corrected by the skeptic pass):** WP0 (1 h owner) -> WP2A (12 h; WP1.1's 6 h runs beside it) -> WP2C P0 props (18 h; WP2B-min runs beside it) -> WP3 loft and townhouse in parallel (about 10 h) -> WP4.0 (3 h) -> two stories (about 9 h) -> WP7 (6 h) = about 59 hours, 77 with the 30 percent. The plan's earlier figure, 45 plus 30 percent, put WP2B and WP2C beside WP2A although the packages table starts them after it. WP5 and WP6 run beside it and are done before the stories are.

**Owner-gated (not agent-hours):** the decisions O1 to O12 (about an hour); the macOS goldens for each milestone's buildings (about an hour a milestone, on the Mac, `pnpm run goldens:update --house <ids>`); counsel on names and licences; approving the Kokoro install (about 3 GB) before any voice; choosing the film host; the ad GPU (24 cuts in four shapes is 96 renders; a few hours of the owner's GPU); a preview deploy by PR when you say so.

**What waits for what, and is therefore not in M1:** voiced tours and the 90-second films (the voice); the vetted real screenshots, logos, "Rented before" panels, the day and the plan pins (pass 2, Phase B); the goldens (the Mac); the catalog admission of OpenProject and the others (not needed).

---

## Appendix A. What I ran and what I did not

**Ran (read-only on every repo):** the lint harness over every user-facing string of the eight briefs (72 base banned phrases with the claims rows replaced for company copy, 28 added rows, the shape rules, the app matcher with `AMBIGUOUS` and the not-in-store names, the schema length and pattern limits): all clean; the same over 35 page strings and disclosures: clean (and `A move never carries everything` fails `biz-migration`, as it should). The 28 added rows over the 30 families: 34 strings hit (reproduces the claims report), which is why they load for companies only. The catalog: all 46 apps present, `storySafe` yes or with-caveat (Documenso, Invoice Ninja, Listmonk), all with a QA screenshot. Room names of the eight buildings through the merged role table: all resolve; the five `NAMES` regexes against the 193 distinct room names of the 30 homes: no match. Names against the 30 families (surnames, first names, companions, places, streets), the house ids, the building display names and the credit-guard words: no collision. The function pools against every cast member: clean after widening. The work packages: 32 packages, 273 patterns, 0 overlaps; every existing path exists, new ones are expected. Web search (read-only, weak evidence): each of the eight names, searched as an exact string, returned no company of that name, except that the first printworks name (Overprint) matched a real French packaging firm and was replaced by Gutterfold, which returned nothing; near matches that exist and are different: Lintel Studio for Architecture, Hartland Joinery, Posy Flowers.

**Verified in the tree** (so cited as fact): `scripts/own-authors.mts` does not exist; `author` is a required spec key and the guard reads every spec's and index row's `author`; `serve()` takes the directory branch first; the readers of `index.houses` (ten that must see an office, the others that must not); `FLEET.families = 30`, `cast-lint` `N = 30` and the "has no family" loop; `OWN_PARAMS` is duplicated in `viewer.ts:137` and `url.ts:19`; `FICTIONAL_LINE` at `types.ts:75`, `popup.ts:96,198`, `film/lib.mts:80`, `film/cut/plan.ts:328`; the family schema's `companion.name` pattern, `popup.title` and `body` limits and `address.line` pattern; `compose-house.mts`, `render-house-shots.mts`, `generate_house_iso.py --only/--no-manifest`, `generate_floor_plans.py --only/--out` and `test-shot-planner.mts --update` flags.

**Skeptic pass additions (2026-10-19):** the store was fetched again (580 apps, same bytes); upstream LICENSE files of Planka, Akaunting, Invoice Ninja, n8n and Mattermost were read; the compose of all 46 store packages was scanned for storage, sign-in and mail settings (about 35 read in detail); the eight company names were searched again (four searches, US-only tool, no trademark register); counts, caps, slugs, titles, first names and film quotas were recomputed from the briefs. Not run: any GPU render, any Hub app, any portal build or test.

**Not run:** `portal:build` and `portal:test` (they write `dist/`), any GPU render (I looked at the spike's stills: the loft reads as an office once the prototype's desks and conference table are in, the shop front reads as a shop at once, the 56-desk floor reads as a call centre and its glass front as a cage), any Hub app, a counsel review, Cloudflare's precedence for `office.html`.

**Found wrong in the inputs.** (1) The engine report's props line items add to 23 days against 13.5 in its table. (2) The draft schema's `address.line` pattern needs a house number: "Unit 2" fails (my briefs used it; fixed). (3) The draft claims set's `one-core-office` ("One Companion Core runs the office.") reads as a capacity claim; replaced by the claims frame. (4) Two function pools lacked apps the casts use, and four room names would have failed the home-kind check; the proposed tables fix them. (5) A hub of 520 m2 for 24 seats is sparse; scaled to 380 m2 and 30 seats. (6) The honest limit of a books move cannot be said in the research's words: 'ledger', 'chart of accounts', 'payroll' and 'permissions' all hit the rules, so the briefs say "the full books", "the pay service" and "sharing settings" (six rows rewritten; every bring-your-data-home row now lints clean).

## Appendix B. Files in this folder

`office-plan.md` (this), `office-build-contract.md`, `company-briefs/{reelwick,pannierwell,curatory,gutterfold,lintel-and-sill,posy-and-pail,hartnoll-joinery,loamfield}.json` and `index.json`, `company.schema.proposed.json`, `functions.proposed.json`, `roles-office.proposed.json`, `claims-office.proposed.json`, `office-cast-plan.proposed.json`, `gen/` (`common.mjs` lint harness, `check.mjs`, `rooms.mjs`, `names.mjs`, `schemacheck.mjs`, `fnpools.mjs`, `wps.mjs`, the eight `c<n>-*.mjs` data files, `build.mjs`, `mkfrag.mjs`, and the templates). Re-run `node gen/check.mjs && node gen/build.mjs` after any edit.

## Appendix C. Skeptic change log (2026-10-19)

Edits are to this file, `office-build-contract.md` and `company-briefs/*.json` only. The originals are kept in `skeptic/orig/`; the scripts that made the edits are `skeptic/apply_briefs.py`, `apply_plan.py` and `apply_contract.py`. Everything else in this folder (the five `*.proposed.json` files, `gen/`, the four specialist reports) is unedited and **stale where it disagrees**: contract section 16.1 says the briefs and section 16 win.

| # | Where | Defect | Fix |
|---|---|---|---|
| C1 | Reelwick `meet-draw`; Gutterfold `pitch-wall`; Loamfield `open-sketch`, `meet-demo` | "The sketch is saved / kept on the Core" for Excalidraw. The package is an editor and a collaboration relay with no storage volume (compose: `excalidraw`, `excalidraw-room`, an nginx.conf mount) | seeds rewritten; Miro to Excalidraw bring-your-data-home rows removed (2 beats); limit added |
| C2 | Gutterfold `comms-dns`; Posy and Pail `back-dns`; Hartnoll `comms-dns` | Pi-hole "answers the studio's / shop's / office block's name lookups ... beside the router". The package publishes DNS on host port 8053 only (compose `addPorts`); no router can use that, and the sentence made the whole network depend on the Core | "blocks known ad and tracker domains for the devices pointed at it" |
| C3 | Reelwick `open-review` and Rivet's job; Curatory `comms-draft`, `open-wiki` and Tally's job | Hermes "drafts from the commits / the help pages". The store says Hermes runs isolated from other apps; the catalog gives Forgejo and BookStack no agent path | "from commit messages Femi pastes", "from help text Ilse gives it" |
| C4 | Pannierwell `kitchen-books`; Curatory `open-books`; Hartnoll `open-books` | "a form the accountant can read", "the accountant reads the same books": an outsider on the Core, against "clients and consultants outside cannot reach the Core" | "a printout goes to the accountant" or the clause removed |
| C5 | Pannierwell, Curatory, Hartnoll (`apps.thirdParty`, beat limits) | Akaunting's licence note said only "BSL 1.1 (source-available)". Upstream LICENSE.txt: free production use up to two users, one company and one thousand invoices | licence note and limit carry the cap; O14 |
| C6 | Reelwick, Hartnoll, Loamfield `comms-status` and the Wei and Ewa cuts | "Uptime Kuma replaces Datadog / New Relic" on the IT sceptics' own beats (market review: stretched; full observability suites); Loamfield's monitor "checks it" (the Core) though it runs on the Core and cannot report it down | chips removed (cuts follow); "checks its apps" |
| C7 | Lintel and Sill `comms-note`, `open-spec`; Posy and Pail `work-recipes` | Cryptgeon "replaces WeTransfer" (a note that opens once on the office network cannot send a file to an outsider); LibreOffice "replaces Google Workspace" (documents only; Baikal already carries the calendar swap) | chips removed |
| C8 | Planka (3 briefs), BentoPDF (Hartnoll), Grist (5 beats), draw.io (4 rows), Inkscape (Gutterfold) | Planka's licence is the PLANKA Community License (Fair Use License 1.1), not "unasserted"; BentoPDF is dual-licensed; Grist here has one default sign-in; draw.io keeps no copy; Inkscape has no storage volume ("goes straight into the brand folder") | notes, limits and one seed |
| C9 | Reelwick arc; Curatory and Posy and Pail taglines; Curatory Comms Room | "Seven people become six" reads as a person replaced; "Eleven / Ten people ... on one Core" puts a head count and the Core together; a 12 m2 Core room is under the 3.6 x 3.6 m rule (12.96 m2) | "Six people, one list."; two taglines reworded; 13 m2 |
| C10 | every brief, `film.spokenWordsEstimate`; plan section 2 | the totals left out the 3-word sign-off (`quotas.mts filmWords`): 198, 200, 184, 185, 201, 201, 186, 201 | 201, 199, 190, 188, 204, 204, 189, 205 (limit 215; Loamfield's margin is 10 words) |
| C11 | briefs, index, plan | counts after C1 to C7 | rented services 47 to 43; bring-your-data-home beats 56 to 54, moves 25 to 24; per company in each Counts line |
| C12 | every brief | writers could copy `capabilityHint` (never scanned) into shipped text; file hand-offs implied integrations; head count beside "Core" | five writer rules appended; a `skeptic` block (changes, unverified) in each brief |
| C13 | this file | the effort total omitted the 30 percent rework and priced props 5 days under the engine report; the M1 critical path ignored the plan's own dependencies | section 6 recalculated; risks 13 to 17; owner decisions O13 to O15 |
| C14 | `office-build-contract.md` | no app-facts table, no rule for it; the gallery h1 "Each team's work, on one Companion Core" prints the held sentence; two `FICTIONAL_LINE` print sites missing from section 11 (`build-og.mts:113`, `pages.mts:110`); `office-core` area not stated | new section 16, `co-app-facts`, h1 reworded, sites added |
| C15 | hook lines and titles: Gutterfold, Lintel and Sill, Posy and Pail, Reelwick | "Design files stay in the studio", "Drawings stay in the office", "The newsletter list stays in the shop", "The screens stay in the office": a place claim wider than the canon's "sits on the Core", and a sent newsletter hands every address to the mail provider | "sit on the Core" (Posy and Pail: "The newsletter list sits on the Core, in the shop") |
