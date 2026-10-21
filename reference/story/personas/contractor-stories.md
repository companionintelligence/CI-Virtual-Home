# Contractor (`contractor`): ten more user stories

Draft written 2026-10-20 for the owner. It widens the stories of an archetype that already exists (`contractor`, bible chapter 3.10, `personas.json`, `persona-apps.md`); it changes no source file. Companion OS, Companion Memory and Companion Agents are in beta. Nobody here is a customer: ages, trades, rooms and lines are design choices for fictional characters. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**One line.** A self-employed tradesperson or small building contractor: a trade is two jobs, the hands on site and then the firm at the end of the day. This file adds the contractor's other hours: the order sheet at 6:30, a delivery on the driveway, the snag sheet by the work jackets, a letter in a language read slowly, the diary by the door, the Friday client note, the apprentice's Saturday, the January folder, a tile saw shared with a neighbour and the week's site lunches.

---

## 1. What the chapter and the stories already show

**The chapter (3.10).** The seven Hub replacements it ranks: Invoice Ninja (the quote at the bench), Immich (site photos, the same wall photographed twice), HomeBox (the tools), LubeLogger (the van), Docuseal (the change order), Open WebUI (site notes into a draft the contractor fixes) and Paperless-ngx (warranty and permit scans). Its shots are the bench and tool wall at 6:30 and the quote at the desk in golden hour. Its limits: remote access is not claimed, never "tax ready", no payments, no dispatch.

**The pool** (`personas.json`, 14 apps) and `persona-apps.md` add Solidtime, Radicale, Stirling-PDF, VaultWarden, Nextcloud, Planka and Akaunting. Beats that name each pool app in the 30 family files today (a count of beats, not of homes): Immich 18, Paperless-ngx 15, Nextcloud 13, VaultWarden 12, Open WebUI 8, Stirling-PDF 5, Akaunting 5, Docuseal 2, Planka 2, Invoice Ninja 1, LubeLogger 1, and none for HomeBox, Solidtime and Radicale.

**The cast.** No member of the 30 family files carries `contractor` (`cast-plan.json` and `casting.json` have none). The nearest stories are organisers and hosts who were electricians, builders and the like before they retired (the Gills' Harpreet is a retired electrician), and none shows a trade in work. The six apartments are cast later. Every story below is a candidate for the next recast.

**What this file avoids on purpose.** The chapter's pairs (Invoice Ninja with QuickBooks, Immich with Google Photos, HomeBox with Sortly, LubeLogger with Drivvo, Docuseal with DocuSign, Open WebUI with ChatGPT, Paperless-ngx with Evernote) are not repeated. Only two pool apps appear below (Solidtime and Akaunting), each with a service the chapter does not name.

## 2. How the ten were chosen

- Each differs in kind: a different room or place (the driveway, the laundry, the entry), a different moment of the week or the year (6:30 on a Tuesday, a Saturday afternoon, January), a different person who acts or is helped (the partner, the apprentice, a child, a neighbour), a different app and service.
- Each is one catalog app (`app.id`, `storySafe` yes or with-caveat, never `avoid`) with one registry service (no flag `stale` or `story-excluded`, `alternativeToForm` not `blocked`). Nine of the ten services have no family using them today (`fleetHomes` is empty); Airtable is used by one (Brennan-Hollin).
- The chip pair for every story is the app's display name, then `alternative to <Service>`. The first sentence names what a rented tool held or changed and what the Core does instead; it never says what a company does to anyone.
- One story uses a chat model (AnythingLLM, story 6) and its actor is an adult. Two stories have a young person near the work (a 17-year-old apprentice at a timer, a 14-year-old at a recipe list); neither app is a chat model or an agent.
- The contractor's rules hold: the model drafts, the contractor fixes it first; a model never prices a job and never does field work; no payments, no dispatch, no advice on tax, insurance or inspection; nothing is a safety or compliance claim.
- Remote access is not claimed: a crew on site or a quote from the van cannot be shown. Every scene is at home on the home network.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first) and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation, no figure, no company named in it).

**1. NocoDB, alternative to Airtable.** As a contractor, I want the order sheet for the next job in one table so that the trade counter list is ready before the counter opens.
- App `nocodb`, service `airtable`. Caveat: a table, not a stock system; no supplier link, no reorder and no price shown anywhere in the table; overlaps Baserow and Grist, so one table app per household; no claims entry yet for NocoDB.
- Moment: `garage`, anchor `room` (room garage; fallback `bookshelf`). Tuesday at half past six, the garage door up. First: last job's table is duplicated and the new job's name typed over it.
- Who: the contractor (late forties).
- First sentence: "The order sheet for the job lived in a rented database; NocoDB keeps the same table on the Core, filled in at the bench."
- Different in kind: a table instead of a list or a quote, the first hour of the day.

**2. Frigate, alternative to Arlo.** As a contractor, I want the clip of the morning timber drop kept at home so that a missing delivery is settled by a recording, not by memory.
- App `frigate`, service `arlo`. Caveat: needs an IP camera, which is not part of the Core; the household's own camera on its own property only; no detection speed or accuracy, no "catches", no safety or security promise; no watching from away from home. The app is used by nine beats; the service by none.
- Moment: outside, anchor `driveway` (zone; no room). Early on a Tuesday, the van not yet moved. First: the clip of the delivery opens, with the time it was dropped.
- Who: the partner, who was first up, finds the clip; the contractor settles with the supplier by phone.
- First sentence: "The clip of the timber drop sat with a rented camera service; Frigate keeps the same clip on the Core."
- Different in kind: the driveway, an outdoor zone anchor, a record of an event that is nobody's fault.

**3. Vikunja, alternative to Asana.** As a contractor, I want each snag from the walkthrough as a task so that none is forgotten before the callback.
- App `vikunja`, service `asana`. Caveat: a to-do app with list and board views; not dispatch and not a crew tool, so no assigning a crew on site; the paper sheet is copied by hand.
- Moment: `laundry`, anchor `laundry` (washer or dryer; fallback `room`). Friday at six, work jackets on the hooks, the paper snag sheet clipped beside them. First: the first snag on the sheet becomes a task.
- Who: the contractor.
- First sentence: "The snag list sat in a rented task tool; Vikunja holds each snag as a task on the Core, copied from the paper sheet."
- Different in kind: the mudroom and laundry (the chapter's Riverbend), the end of a job, a hand-copied list.

**4. LibreTranslate, alternative to DeepL.** As a contractor, I want a first pass at a client's letter in a language I read slowly so that I understand it before I phone back.
- App `libretranslate`, service `deepl`. Caveat: a draft the contractor checks by phone, with no accuracy claim; the language files are downloaded first, which uses the internet; do not name a culture or a country; the tool is for a client letter only, never a contract or advice.
- Moment: `office`, anchor `desk` (fallback `room`). Wednesday, the post on the desk. First: one paragraph of the letter is pasted and a first pass appears beside it.
- Who: the contractor. The app is used by thirteen beats; the service by none.
- First sentence: "The client's letter went to a rented translator first; LibreTranslate does the first pass on the Core, and the contractor checks the meaning."
- Different in kind: a client in a different language, a task that is not about money.

**5. Baikal, alternative to iCloud Calendar.** As a contractor, I want job days and school runs on one calendar so that they stop colliding.
- App `baikal`, service `icloud-calendar`. Caveat: calendars and contacts for the household's phones on the home Wi-Fi only; no sharing with a crew on site; overlaps Radicale, so name one calendar app.
- Moment: `entry`, anchor `room` (room entry; fallback `bookshelf`). Sunday evening, the paper diary on the hall table. First: Monday's two jobs are copied from the diary onto the calendar.
- Who: the contractor and the partner, with the 12-year-old reading the week off the calendar.
- First sentence: "Job days and school runs shared one rented calendar; Baikal keeps both on the Core, copied from the diary by the door."
- Different in kind: the family calendar, not the firm's; the hall, not the garage.

**6. AnythingLLM, alternative to Claude.** As a contractor, I want a draft of the week's client note from the site notes so that the note is written on Friday, and I fix it before it is sent.
- App `anything-llm`, service `claude`. Caveat: a chat app, so the actor is an adult; show only the local model path, never a cloud model; the model drafts and the contractor corrects it first, and nothing is sent by the model; no price in the note and no pricing by the model; no accuracy or parity claim.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `dining-table`). Friday afternoon, the site notes in a notebook. First: the notebook's first line is typed and a draft note appears beside it.
- Who: the partner, who types the notes, is the actor; the contractor reads and fixes the draft.
- First sentence: "The weekly client note was drafted in a rented chat tool; AnythingLLM drafts it on the Core, and the contractor fixes it first."
- Different in kind: the partner as the actor, the kitchen, the AI chore the chapter names but with a different person and a different app.

**7. Solidtime, alternative to Toggl Track.** As a contractor, I want the hours of a job noted at the bench so that the next quote starts from what the last job took, and the quote stays my call.
- App `solidtime`, service `toggl-track`. Caveat: no QA screenshot, so it needs a `reviewed.json` line; no figure of any kind in the story, and no payroll, wage or invoicing claim; the timer is for the job, never a measure of a person.
- Moment: `garage`, anchor `room` (fallback `bookshelf`). Saturday afternoon, a cutting day. First: the apprentice starts the timer when the first cut begins.
- Who: the apprentice (17) acts; the contractor reads the entry when the next quote is written. No chat model is involved.
- First sentence: "A rented timer held the hours of every job; Solidtime keeps them on the Core, started at the bench."
- Different in kind: an apprentice, a Saturday, a pool app used in a moment the chapter does not show.

**8. Akaunting, alternative to Xero.** As a contractor, I want the year's invoices and expenses together so that the accountant's folder is ready in January.
- App `akaunting`, service `xero`. Caveat: a bookkeeping tool; no accounting, tax or legal advice, never "tax ready" and never a filing claim; no ledger, payroll or bank-feed promise; the accountant's own software is not replaced. The app is used by five beats; the service by none.
- Moment: `office`, anchor `bookshelf` (fallback `desk`). A January morning, the year's folder on the shelf. First: the first invoice of the year is marked as done.
- Who: the contractor.
- First sentence: "The year's invoices and expenses sat in a rented books tool; Akaunting keeps them on the Core, ready for the accountant's folder."
- Different in kind: the moment of the year, not the week; a folder, not a quote.

**9. Spliit, alternative to Tricount.** As a contractor, I want the cost of a tile saw shared with a neighbour written down so that we both know who owes whom.
- App `spliit`, service `tricount`. Caveat: Spliit does not move money, and its tally is not advice; the neighbour cannot reach the Core from their own house, so the entries are made at the table with both present.
- Moment: `dining`, anchor `dining-table` (fallback `kitchen-island`). A weekday evening, the hire slip on the table. First: the hire slip becomes the first line of the tally.
- Who: a neighbour who is a tradesperson sits across from the contractor.
- First sentence: "The tally for the shared tile saw sat in a rented splitting app; Spliit keeps it on the Core and shows who owes whom."
- Different in kind: a neighbour at the table, a handshake arrangement between trades, no firm involved.

**10. Mealie, alternative to Paprika.** As a contractor, I want the week's site lunches planned so that the list for the shop is done on Sunday.
- App `mealie`, service `paprika`. Caveat: no QA screenshot, so it needs a `reviewed.json` line; pasting a recipe address uses the internet; nothing about nutrition or health.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `dining-table`). Sunday evening. First: Monday's lunch is picked from the saved recipes.
- Who: the contractor and the 14-year-old child, who picks the Thursday lunch. Mealie is not a chat model.
- First sentence: "The week's site lunches lived in a rented recipe app; Mealie keeps the recipes and the plan on the Core."
- Different in kind: a trade in the kitchen, a child choosing, a plan for the working week rather than the job.

## 4. At a glance

| # | App | Alternative to | Room, anchor | Moment | Actor | Beats naming the app today | Family fleet for the service |
|---|---|---|---|---|---|---|---|
| 1 | `nocodb` | Airtable | garage, room | Tuesday 6:30 | contractor | 0 | 1 |
| 2 | `frigate` | Arlo | outside, driveway | Tuesday early | partner | 9 | 0 |
| 3 | `vikunja` | Asana | laundry, laundry | Friday at six | contractor | 3 | 0 |
| 4 | `libretranslate` | DeepL | office, desk | Wednesday | contractor | 13 | 0 |
| 5 | `baikal` | iCloud Calendar | entry, room | Sunday evening | contractor, partner, child (12) | 1 | 0 |
| 6 | `anything-llm` | Claude | kitchen, kitchen-island | Friday afternoon | partner | 0 | 0 |
| 7 | `solidtime` | Toggl Track | garage, room | Saturday afternoon | apprentice (17) | 0 | 0 |
| 8 | `akaunting` | Xero | office, bookshelf | January | contractor | 5 | 0 |
| 9 | `spliit` | Tricount | dining, dining-table | weekday evening | neighbour | 1 | 0 |
| 10 | `mealie` | Paprika | kitchen, kitchen-island | Sunday evening | contractor, child (14) | 0 | 0 |

The service in story 1 has one family in the old chip data (Airtable, Brennan-Hollin); the other nine have none. Stories 2 and 4 use apps that already have many beats (nine and thirteen); their services are unused and their moments are new.

## 5. For the owner

- **No recorded QA screenshot** for `solidtime` and `mealie`: each needs a `reviewed.json` line (the `app-qa-screenshot` rule) before a beat shows it. NocoDB, Frigate, Vikunja, LibreTranslate, Baikal, AnythingLLM, Akaunting and Spliit each have one.
- **The pool gate.** `persona-cover` asks every `contractor` member for one beat in a pool app. Only stories 7 (Solidtime) and 8 (Akaunting) are in the pool; the rest need a pool beat beside them (Invoice Ninja, Immich, HomeBox and the like). Widening the pool in `personas.json` is the owner's call; this file does not make it.
- **One per household** where the catalog says they overlap: NocoDB with Baserow and Grist (story 1), Baikal with Radicale (5).
- **Rooms.** The contractor's primary rooms are garage, office, entry and laundry; stories 6, 9 and 10 sit in the kitchen or dining room, which count only as fallbacks (or as the member's own cast room).
- **Age.** AnythingLLM is the only chat app, and its actor is an adult. The 17-year-old at the timer and the 12- and 14-year-olds near the calendar and the recipes use no chat model and no agent.
- **Hardware.** Story 2 needs an IP camera that the Core does not include; the home must have one on its driveway.
- **Left out on purpose:** Grocy (its listing allows only pantry, shopping list, recipes and chores), PairDrop (its AirDrop service is already in a family story), BentoPDF (Smallpdf is already used), a van or fleet tracker (no fleet claim), a crew chat (no multi-user), a booking page (needs outside reach).

## 6. What was checked

- Every app id is in `catalog-apps.json`, in the live store, `storySafe` yes or with-caveat, none `avoid`; only `anything-llm` carries `ai: chat`.
- Every service id is in `services.json` with `storyStatus` ok, no `stale` or `story-excluded` flag and `alternativeToForm` ok, and the app is listed under that service's `apps`.
- Counts of beats and the fleet are from `content/families/*.json` and `services.json` on 2026-10-20 and exclude `.bake.json`, `.voice.json` and `films.json`.
- The ten first sentences are 25 words or fewer, with no digit, no dash, no exclamation, no company name and no "replaces". No story names a price, a speed, a compliance word or a remote-access promise.
