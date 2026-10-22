# Organiser: ten more user stories (`organiser`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.1 of [persona-bible.md](../persona-bible.md) and the `organiser` row of `content/story/personas.json`; it changes no source file. Nobody here is a customer: ages, jobs, rooms and lines are design choices for fictional characters, and the first names are working names that the cast plan may replace (none is in `casting.json` or on the avoid list). The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**What this file is for.** The organiser of the chapter is Sally: the records office of a household and the back office of a practice of one, from one desk. The thirty families repeat that picture 162 times: one adult, one desk or table, paper that arrives and is scanned, filed, found or signed. These ten stories leave that ground. They are about the other lives an organiser leads: the calendar of a house of three generations, the volunteer list, a house move, the handover to a sitter, a parent's appointment letters, the hours of a freelancer, a family reunion, a wedding, a shared rented house and a garden society's invoices. Each uses a catalog app and a registry service that no family beat pairs today.

**Regulated domain.** Story 5 is about a parent's appointment letters (health), stories 6 and 10 touch invoices and stories 3, 4 and 8 touch household papers. They are written without any compliance, certification or security guarantee and without advice: they say only what the app does and where the files live. No story says what a document proves, what to keep or for how long, or who may see it. No amount, tax, price or saving appears. The Core is never the only copy of a paper.

**Age rule.** Nobody under sixteen uses a chat model or an agent, and none of the ten apps is a chat or agent app. A 13-year-old appears in story 1 as one of the people who read the calendar on her phone, and a 20-year-old is the sitter in story 4; no child acts on an app in this file. Remote access is not claimed: every scene is on the home network.

## 1. What the chapter and the families already show

**The chapter (3.1).** Sally, 43, consultant. Ranked Hub apps: Paperless-ngx (Evernote, Google Drive), Nextcloud (Google Drive, Dropbox), Companion Planning (first party), Hermes, VaultWarden (LastPass, 1Password), Akaunting (QuickBooks, Xero) and Docuseal (DocuSign). Her shots are a pile of paper beside a closed laptop and a hand moving a document into a client's folder; her triggers are a client clause on where documents sit, a vendor changing terms and the spring renewal list.

**The pool** (`personas.json`, 10 apps): Companion Planning, Nextcloud, LibreOffice, Paperless-ngx, Stirling-PDF, VaultWarden, Joplin Server, BookStack, n8n and Yuvomi.

**The families** (a count of beats that name an app, read from `content/families/*.json`, 2026-10-20). There are 24 organisers in the 30 family files, aged 33 to 71: a bookkeeper, designers, consultants, a charity coordinator, retired professionals, a translator, school and hospital administrators, a clinic office manager, a music-school owner. They have 162 app beats. The apps: Hermes 33, Paperless-ngx 13, VaultWarden 9, Companion Planning 9, Nextcloud 8, OpenClaw 8, Yuvomi 6, LibreOffice 6, Twenty 5, Akaunting 4, Stirling-PDF 4, Wallos 4, HomeHub 4, Joplin Server 3, Companion Memory 3, Firefly III 3. The services named: Google Drive 13, LastPass 10, Evernote 10, Microsoft Office 8, Salesforce 7, Rocket Money 5, QuickBooks 4, Adobe Acrobat 4, Dropbox 4, DocuSign 3, YNAB 3, Cozi 3. Where they stand: the Core 40, the dining table 23, the couch 22, `room` 18, the desk 15, the counter 7, the bookshelf 7; the chapters sit in the office 37, living 32, dining 25, kitchen 23 and garden 12.

**What that leaves.** A family, a calendar, a trip, a move, a parent who is looked after, a house shared by adults who are not related, work paid by the hour and unpaid civic work are not in the 162. Neither are the apps below: none is named by any family beat (Spliit is named once, with Splitwise).

## 2. How the ten were chosen

- Each differs in kind: a different room, a different moment of the week or the year, a different person who acts or is helped, and a different job for the Core.
- Each is one catalog app (`storySafe` yes, or with-caveat for MediKeep and AdventureLog; never `avoid`) with one registry service (no flag, `alternativeToForm` ok, `storyStatus` ok, and the app is in the service's `storyApps` and has its name in its own `replaces`). Nine of the ten apps are named by no family beat; the tenth (Spliit) is named once, with a different service. Seven of the ten services are named by no family beat (Apple Health, Asana, Sortly, Pastebin, Toggl Track, TripIt, Tricount); three are named by one or more (Google Calendar once, FreshBooks once, Notion in 14). No pair repeats a pair of any family beat.
- The chip pair of every story is the app's display name, then `alternative to <Service>` (story v3 D5). The first sentence says what a rented tool held or changed and what the Core does instead; no company is named in it and none is accused of anything (`incumbent-attack`).
- Nothing here needs a chat model or an agent, so the age rule never bites. The Core is not a backup, and a copy is not a guarantee.
- The fleet cap is 40% of homes (14 of 36). None of the ten apps is at or over it; Paperless-ngx, Nextcloud, VaultWarden and Companion Planning, which the chapter leads with, are not used here.
- Fresh against the other persona drafts of 2026-10-20 where it could be. The catalog has few pairs that no family uses, so the drafts reached for some of the same ones; four of these ten pairs are in no other draft, and the caveat of each of the other six names the drafts that share it, so the owner can give a pair to one persona.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first), who acts and who is helped, and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation mark, no figure, no company named).

| # | App and service | Who (working name, age) | Room and anchor | When |
|---|---|---|---|---|
| 1 | Radicale, alternative to Google Calendar | Kwabena, 74, with a daughter-in-law and a granddaughter | `living`, `couch` | Sunday after lunch |
| 2 | Super Productivity, alternative to Asana | Ottilie, 29 | `bedroom`, `desk` | Saturday before a street clean-up |
| 3 | HomeBox, alternative to Sortly | Rasmus, 36, with his partner and a baby | `garage`, `room` | The week before the removal van |
| 4 | PrivateBin, alternative to Pastebin | Leilani, 41, and Fatou, 20, a house sitter | `entry`, `front-door` | The day before a flight |
| 5 | MediKeep, alternative to Apple Health | Gideon, 52, with his mother Mireille, 81 | `kitchen`, `kitchen-island` | Thursday morning |
| 6 | Solidtime, alternative to Toggl Track | Ines, 33, freelance book indexer | `office`, `desk` | Friday afternoon |
| 7 | AdventureLog, alternative to TripIt | Cormac, 38, with his great-aunt Concetta, 83 | `patio`, `patio-seat` | A spring Sunday |
| 8 | Affine, alternative to Notion | Palesa, 31, with her mother | `dining`, `dining-table` | A Saturday, two months before a wedding |
| 9 | Spliit, alternative to Tricount | Yetunde, 26, with three housemates | `kitchen`, `counter` | The first Sunday of the month |
| 10 | Invio, alternative to FreshBooks | Ansgar, 59, treasurer of a garden society | `office`, `bookshelf` | A late-summer afternoon |

**1. Radicale, alternative to Google Calendar.** As the calendar keeper of a house of three generations, I want one family calendar served from the Core to the calendar app already on each phone, so that nobody learns a new app to read the week.
- App `radicale`, service `google-calendar`. Caveat: Radicale serves calendars (and contacts); the calendar app on each phone shows them, and a phone reaches it while it is on the home Wi-Fi, so nothing is claimed for away from home (`cap-remote-access`). It is one family calendar, not a calendar for each person (`cap-multi-user`). No QA screenshot on `origin/main`: a beat that names it needs an owner entry in `reviewed.json` (`app-qa-screenshot`). Baikal does the same job and Rahimi's "moves two lessons" beat uses it: name one calendar server per household. The business-owner draft takes this pair for a shop's calendar; give it to one persona.
- Moment: `living`, anchor `couch` (fallback `room`). Sunday after lunch, window light on the arm of the sofa. First: a paper wall calendar is lifted off its nail and laid beside a phone, and one line is copied across.
- Who: Kwabena, 74, retired, keeps the calendar for a three-generation house. His daughter-in-law and his 13-year-old granddaughter read it on their own phones; the granddaughter uses no chat model. The oldest member is the keeper, not the one who is helped.
- First sentence: "Three generations read the same week from the calendar app already on their phones, and the calendar behind it sits on the Core."
- Popup title: "One calendar, every phone".
- Different in kind: the first story where the Core serves the tool people already hold instead of showing a planner on a screen; the Sunday-afternoon couch; the keeper is the eldest.
- Category `home`.

**2. Super Productivity, alternative to Asana.** As the chair of a residents' association, I want the block's open jobs in one list that I plan my Saturday from, so that the clean-up starts with a plan and not with an inbox.
- App `super-productivity`, service `asana`. Caveat: Super Productivity plans one person's day and times it. It is not a shared board: nothing is claimed about other volunteers using it (`cap-multi-user`), and the committee's mail and meetings stay where they are. No time-saved or hours figure (`num-time-saved`). The educator draft takes this pair for a teacher's week.
- Moment: `bedroom`, anchor `desk` (fallback `room`). Saturday morning before the street clean-up, light from a side window. First: a printed agenda with three jobs ringed in pencil beside the laptop.
- Who: Ottilie, 29, chairs the residents' association of her block and lives with her partner. The volunteers do not use the Core.
- First sentence: "The residents' association has one list of jobs, and Ottilie works through it from the Core before the street clean-up."
- Popup title: "One list for the whole block".
- Different in kind: unpaid civic work, not a paid practice; the youngest organiser here; a list that is hers alone.
- Category `productivity`.

**3. HomeBox, alternative to Sortly.** As the person moving the household, I want every box and what is in it written down, so that nobody opens six cartons to find the kettle.
- App `homebox`, service `sortly`. Caveat: barcode and Open Food Facts look-ups call outside services, so the scene has no barcode. No QA screenshot (owner entry). It is a list of what is where, not a valuation, an insurance record or advice. Three drafts (journalist, marketer, tech-family) use this pair for other jobs; this is the house-move story.
- Moment: `garage`, anchor `room` set to the garage (fallback `driveway`). The week before the removal van, mid-morning light at the open door. First: a roll of tape, a marker and a pile of flat boxes, and a label written before the lid closes.
- Who: Rasmus, 36, is moving flats with his partner and their baby. He keeps the list; she reads it on the laptop at the kitchen end.
- First sentence: "Before the removal van comes, every box in the garage gets a name and a shelf in HomeBox on the Core."
- Popup title: "Every box gets a name".
- Different in kind: a once-in-years event; the garage; a whole home inventoried in a week.
- Category `home`.

**4. PrivateBin, alternative to Pastebin.** As the person leaving for a flight, I want the cat's routine in a note that clears once the sitter has read it, so that the routine is not left in three chat threads.
- App `privatebin`, service `pastebin`. Caveat: PrivateBin holds text and can clear it after it is read. The note opens on a phone on the home Wi-Fi, so the handover happens at the house, not by a link sent elsewhere (`cap-remote-access`). No "encrypted", "secure" or "private" on their own (`sec-absolute`). Anything needed twice is written down before it clears. Cryptgeon does the same job: name one per household. The tech-family draft uses this pair.
- Moment: `entry`, anchor `front-door` (fallback `room`). Late afternoon the day before, low light across the hall. First: a key changes hands and a phone is held up beside the door.
- Who: Leilani, 41, leaves for the airport in the morning. Fatou, 20, a student, house-sits and feeds the cat. The sitter is a visitor, not a member of the household.
- First sentence: "The cat's routine sits in a note on the Core that is cleared once the sitter has read it."
- Popup title: "A note that opens once".
- Different in kind: the entry hall; a guest is the one helped; a single-use note instead of a kept file; the hour before leaving.
- Category `privacy`.

**5. MediKeep, alternative to Apple Health.** As the person who keeps a parent's appointments, I want the dates from the letters written in one place with her beside me, so that I am not the only one who knows what is coming.
- App `medikeep`, service `apple-health`. Caveat: record keeping only: no medical claim, no advice, no reminder or dosage wording (`sec-medical`), no compliance word. MediKeep's own listing says it has not been boot-tested on a live Hub device, so a beat needs an owner entry in `reviewed.json` and may not be ready for a tour. The catalog also names MyChart; that is a clinic's patient portal and the Core does not replace it, so it is not used. The clinic's own records stay the clinic's. His mother is in the room and agrees; the Core is not the only copy of a letter.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `counter`, `dining-table`). Thursday morning, light across the island. First: a small stack of appointment letters beside a mug; she slides one across and reads the date aloud.
- Who: Gideon, 52, works part time and keeps the dates for his mother Mireille, 81, who lives with the family. A man in his fifties is the carer; the older person is present and decides.
- First sentence: "Gideon writes his mother's appointment dates in MediKeep on the Core, at the kitchen island, with her beside him."
- Popup title: "Her dates, written down together".
- Different in kind: care for a parent told as letters and dates, with the person cared for at the table; a regulated area told without a single claim.
- Category `home`.

**6. Solidtime, alternative to Toggl Track.** As a freelancer paid by the hour, I want my hours kept by client as I work, so that Friday's invoice starts from a list and not from memory.
- App `solidtime`, service `toggl-track`. Caveat: tracks time across projects and clients, then invoices from it. No payroll, tax or accounting advice (`legal-claims`); no hour or money figure. Harvest carries the registry flag `ordinary-word`: do not name it. No QA screenshot (owner entry). Three drafts (business-owner, contractor, lawyer) use this pair for their own trades.
- Moment: `office`, anchor `desk`. Friday afternoon, low light along the desk. First: a timer is stopped on the last client of the week and the day's lines are read back.
- Who: Ines, 33, a freelance book indexer who works for three publishers, alone at home.
- First sentence: "Ines stops the timer on her last client of the week, and the hours for each publisher are on the Core."
- Popup title: "Friday's hours, by client".
- Different in kind: a craft done alone and paid by the hour, not by the project; the quiet close of a week.
- Category `small-business`.

**7. AdventureLog, alternative to TripIt.** As the family's planner, I want the reunion's places and dates in one plan that I print for the relative who checks it in pencil, so that the whole weekend is settled before anyone travels.
- App `adventurelog`, service `tripit`. Caveat: no QA screenshot (owner entry). Planning at the table only: nothing is claimed for use on the trip (`cap-remote-access`). Place and map look-ups may call outside services: check the listing before saying more and do not say fully local. Surmai does the same job but is not boot-tested. Polarsteps and Wanderlog are not named. The host draft also uses AdventureLog, with a different service.
- Moment: `patio`, anchor `patio-seat` (fallback `garden`, `deck`, `room`). A spring Sunday, midday light on the table. First: a paper map is spread under a mug, a pencil beside it, and the plan comes off the printer and is laid by one place.
- Who: Cormac, 38, plans the family reunion. Concetta, 83, his great-aunt, who ran the first one, checks each date on the printed plan and marks changes in pencil: she is the one who knows, not the one who struggles.
- First sentence: "Cormac plans the family reunion in AdventureLog on the Core, then prints it for the relative who ran the first one."
- Popup title: "A reunion planned at the table".
- Different in kind: an event that comes once a year; printing is the sharing; the oldest relative holds the facts.
- Category `home`.

**8. Affine, alternative to Notion.** As the sister planning a wedding, I want the guest list, the budget table and the seating plan in one workspace, so that a name moved on the plan is moved everywhere.
- App `affine`, service `notion`. Caveat: Affine holds notes, whiteboards and databases in one workspace; it is one person's workspace at home and the guests do not open it. No figures. No AI claim. Notion is named in 14 family beats, but with other apps; this pair is in none.
- Moment: `dining`, anchor `dining-table`. A Saturday morning two months before the day, light across a large sheet of paper. First: place cards in two piles and a pencil that moves one name from one table to another.
- Who: Palesa, 31, plans her brother's wedding; her mother has views on the seating and sits across the table.
- First sentence: "Palesa keeps the guest list, the budget table and the seating plan for her brother's wedding in one workspace on the Core."
- Popup title: "One workspace for the wedding".
- Different in kind: a one-off project with a date; a whiteboard, a table and notes together; a sibling's event.
- Category `productivity`.

**9. Spliit, alternative to Tricount.** As one of four adults in a rented house, I want the month's shared costs worked out in one go, so that the settling up takes one evening and not one argument.
- App `spliit`, service `tricount`. Caveat: Spliit works out who owes whom with the fewest payments and nothing else: no money moves through the Core and no payment is promised. The housemates open it in a browser on the home Wi-Fi, because they live there. It is one group, not an account for each person (`cap-multi-user`). No amounts. Casting note: the schema's `household` has no value for adult housemates; the nearest is `solo-or-couple` with lodgers, and the `housemate` draft is the persona that would hold this. Spliit is named in one family beat (Halvorsen's crew lunch, with Splitwise); the contractor draft uses this pair for a shared tile saw.
- Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`, `dining-table`). The first Sunday of the month, mid-morning. First: a jar of receipts is tipped onto the counter and the corners are flattened.
- Who: Yetunde, 26, and three housemates, none related. There is no household lead.
- First sentence: "On the first Sunday, the house tips out the receipt jar, and Spliit on the Core works out who owes whom."
- Popup title: "Bills night, settled at the counter".
- Different in kind: peers, not a family; a monthly ritual; equal footing.
- Category `money`.

**10. Invio, alternative to FreshBooks.** As the treasurer of a garden society, I want the yearly plot-fee invoices made at home and printed, so that the chair has the pages in hand at the meeting.
- App `invio`, service `freshbooks`. Caveat: Invio creates and shares invoices, but its client links only work for people who can reach the Core, so the pages are printed and handed over. No payment processing, no accounting or tax advice, no amounts. FreshBooks is named by one family beat, with a different app.
- Moment: `office`, anchor `bookshelf` (fallback `desk`). A late-summer afternoon. First: a box file with the society's name on its spine is lifted off the shelf and opened beside the laptop.
- Who: Ansgar, 59, treasurer of the allotment and garden society, prepares the invoices at home; the chair collects the printed pages.
- First sentence: "Ansgar prints the garden society's plot-fee invoices from Invio on the Core, one page for each plot holder."
- Popup title: "Plot fees, printed for the society".
- Different in kind: a volunteer's invoices without a business; a seasonal job; printed sharing.
- Category `money`.

## 4. How the ten differ from each other

| Axis | Spread |
|---|---|
| Age of the person who acts | 26, 29, 31, 33, 36, 38, 41, 52, 59, 74 |
| Who is helped | a three-generation house, a partner and a baby, a sitter, a mother, a great-aunt, a brother, three housemates, a chair |
| Rooms | living, bedroom, garage, entry, kitchen (twice), office (twice), patio, dining |
| Moment | Sunday afternoon, Saturday morning, the move week, the evening before a flight, a Thursday morning, Friday afternoon, a spring Sunday, two months before a wedding, the first Sunday of the month, late summer |
| Kind of work | household calendar, civic list, inventory, handover, care paperwork, hourly work, family event, a wedding, shared costs, a society's invoices |

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json`, `casting.json`, the 30 family files and the other persona drafts):

- Every app id is in the catalog, is in the live store and is not `avoid`. MediKeep and AdventureLog are `with-caveat`; the other eight are `yes`.
- Every service id is in `services.json` with no flag, `alternativeToForm` ok and `storyStatus` ok; the app is in that service's `storyApps` and the service is among the app's own `replaces`. No app or service repeats inside this file.
- No pair appears in any family beat. Four of the ten pairs (MediKeep, AdventureLog, Affine and Invio, stories 5, 7, 8 and 10) are in no other persona draft read on the same day. The other six are also in one to three drafts: Radicale (business-owner), Super Productivity (educator), HomeBox (journalist, marketer, tech-family), PrivateBin (tech-family), Solidtime (business-owner, contractor, lawyer) and Spliit (contractor); each caveat says so.
- The ten first sentences are 16 to 24 words, with no digit, dash or exclamation mark, no company name and none of the `claims.json` error patterns.

Open items for the owner:

- **`reviewed.json`.** Radicale, HomeBox, Solidtime and AdventureLog have no QA screenshot on `origin/main`, and MediKeep has not been boot-tested; a beat that names any of them needs an owner entry (`app-qa-screenshot`). MediKeep is the one to look at twice.
- **Pool.** None of the ten apps is in the `organiser` row of `personas.json`; `cast-lint.mts` has a wider organiser pool that lists Spliit and Invio. `persona-cover` needs only one pool app in an organiser's beats, so this is not a blocker; the owner may add the ones worth keeping.
- **Household shapes.** Story 9 needs a household of adult housemates, which the schema's `household` enum does not name. Story 4 and 5 need a visitor and an older parent living with the family.
- **Beyond the home.** The committee, the publishers, the clinic, the society and the removal firm are outside what a home Core holds; none is told here beyond the one person at the table.
