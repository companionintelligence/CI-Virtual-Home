# Lawyer: ten more user stories (`lawyer`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.12 of [persona-bible.md](../persona-bible.md) and the `lawyer` row of `content/story/personas.json`. Nobody here is a customer: ages, households, roles and lines are design choices for fictional characters. The law for every word is `content/story/claims.json`.

**What this file is for.** The chapter shows one kind of lawyer day: the stack scanned and searchable (Paperless-ngx), the engagement letter signed (Docuseal), folders (Nextcloud), a model draft with the original under the pencil (Open WebUI) and a Word file (LibreOffice). These ten stories leave that ground. They are about other rooms of the house, other moments of the week and the year, and other people at the table, and each is tied to a catalog app and a registry service that the chapter does not use.

**Regulated domain.** The work is legal. No story says or implies that an app makes anyone compliant, that anything is privileged, that a signature or a saved copy would stand up anywhere, or that a file is safe. No story gives legal advice, and no story shows a client name, a case number or an answer in a chat window. Each says only what the app does and where the files live. Remote access is not claimed: every scene is on the home network, with the client or the other reader in the house.

## 1. What the chapter and the families already show

**The chapter (3.12).** Top apps: Paperless-ngx, Nextcloud, Docuseal, Open WebUI, LibreOffice, VaultWarden, Radicale. Services named: Evernote, Google Drive, Dropbox, DocuSign, ChatGPT, Claude, Microsoft Office, Google Workspace, LastPass, 1Password, Google Calendar, iCloud Calendar. Rooms: the study or office, the dining table, the Library Nook.

**The thirty current families (read 2026-10-20).** No member of any family has the `lawyer` archetype (`casting.json` has none), so a lawyer's pool shows up only through other people's beats. How often each pool app already appears in the thirty families:

| App in the lawyer pool | Families | | App in the lawyer pool | Families |
|---|---|---|---|---|
| Paperless-ngx | 15 | | Stirling-PDF | 5 |
| VaultWarden | 12 | | Twenty | 5 |
| Nextcloud | 11 | | BookStack | 3 |
| Open WebUI | 8 | | Companion Memory | 3 |
| LibreOffice | 7 | | Docuseal | 2 |
| Invoice Ninja | 1 | | Cryptgeon, Radicale, Solidtime, Ollama, Whisper-WebUI | 0 |

Paperless-ngx, VaultWarden and Nextcloud are at or over the fleet cap, and the app cap is 12 of 30 families (14 of 36). The ten stories below therefore use Paperless-ngx, Nextcloud, VaultWarden, Open WebUI, LibreOffice, Docuseal and Radicale in none of their pairs. Seven of the ten apps are in no more than one family today; draw.io (2) and Akaunting (4) are reused with a service no family has paired them with, and Stirling-PDF (5) is the one reuse of a pair that already appears in one family, so keep story 10 behind the others.

## 2. How the ten differ

| # | Room, anchor | When | Who is at the table | App (families) | Service (families) |
|---|---|---|---|---|---|
| 1 | `living`, `couch` | A Saturday morning visit | A client, on the sofa | Cryptgeon (0) | WeTransfer (0) |
| 2 | `dining`, `dining-table` | Sunday evening | A partner who is not a lawyer | Collabora Online (0) | Google Workspace (0) |
| 3 | `kitchen`, `kitchen-island` | Sunday afternoon | An adult child home on a break | draw.io (2) | Microsoft Visio (0) |
| 4 | `office`, `bookshelf` | A weeknight | An older relative who worked in a court office | NocoDB (0) | Airtable (1) |
| 5 | `bedroom`, `desk` | Early Monday | Nobody; two machines | Syncthing (0) | Resilio Sync (0) |
| 6 | `dining`, `dining-table` | January | An adult child on a break | Akaunting (4) | Xero (0) |
| 7 | `office`, `desk` | Friday, late afternoon | The lawyer alone | Solidtime (0) | Toggl Track (0) |
| 8 | `kitchen`, `fridge` | Sunday night before a hearing week | The whole house, including a fifteen-year-old | Donetick (1) | Tody (0) |
| 9 | `office`, `desk` | The day a phone is replaced | The lawyer alone | Baikal (1) | iCloud Calendar (0) |
| 10 | `dining`, `dining-table` | The evening before a filing | The lawyer alone | Stirling-PDF (5) | Smallpdf (1) |

Seven different room and anchor pairs, ten different moments, and five kinds of person beside the lawyer (a client, a partner, an adult child, an older relative and a teen). No story uses a chat model, and nobody under sixteen uses one anywhere in this file; the fifteen-year-old in story 8 reads a rota and picks a job.

## 3. Ten user stories

Format: "As a lawyer, I want <job> so that <outcome>". Each is tied to one catalog app (`id`) and one registry service (`id`), with the honest caveat from the catalog and a one-line moment. The chip pair today is the app name, then "replaces <Service>"; prose says "an alternative to". The first sentence is what a visitor reads: sentence case, at most 20 words, no digit, no dash, no exclamation mark, and no company named in the sentence (the chip names it). `{name}` is the member's first name from the cast, so no pronoun implies a gender.

**US1. Cryptgeon, WeTransfer.** As a lawyer, I want to show a client one short note that is gone once it has been read, so that the figure we agreed is not left in an inbox when the visit ends.
- App `cryptgeon`. Service `wetransfer`. Caveat: the note opens once, for a reader who can reach the Core, so on the home Wi-Fi and only during a visit; the lawyer keeps a paper note of the figure, because the app's note is meant to disappear; no word about secrecy, safety or privilege; it is a note, not a record or a file transfer to people elsewhere.
- Moment: `living` room, anchor `couch` (fallbacks `dining-table@dining`, `room@living`). The first thing: the client reads the note on a tablet while the lawyer looks out of the window, then writes the figure on a pad by hand.
- First sentence: "A client's figure used to travel as an attachment; Cryptgeon shows it once and then it is gone."

**US2. Collabora Online, Google Workspace.** As a lawyer, I want my partner at home, who is not a lawyer, to read each clause aloud while we mark one shared copy, so that a clause that sounds unclear is fixed before the draft goes out.
- App `collabora-online`. Service `google-workspace`. Caveat: documents open and edit in a browser tab for the people at the table on the home network; the .docx is opened and the redline is checked by eye before it leaves, because tracked changes and some Word features can differ; no live co-editing with a client who is elsewhere; one office suite per household, so a family with LibreOffice or ONLYOFFICE chooses one.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `room@dining`). The first thing: two laptops open on one paragraph, the partner reading the clause aloud with a printed copy and a pencil beside them.
- First sentence: "Emailed copies of one agreement drifted apart; Collabora Online keeps one copy on the Core for both to mark."

**US3. draw.io, Microsoft Visio.** As a lawyer, I want to draw who owns what, or what happened when, on one page before I write the first line, so that the gaps show in the drawing and not in the middle of the draft.
- App `drawio`. Service `microsoft-visio`. Caveat: flowcharts, org charts and timelines only; a drawing is a sketch of what the lawyer has read, never a statement of fact; no template library or import from another tool is claimed; the file is saved to the Core; no name readable on screen.
- Moment: `kitchen` room, anchor `kitchen-island` (fallbacks `counter`, `room@kitchen`). The first thing: an adult child home on a break calls out the names from printed pages, and the lawyer draws a rectangle for each before any line joins two of them.
- First sentence: "A chart of who owns what used to live in a rented drawing tool; draw.io draws it on the Core."

**US4. NocoDB, Airtable.** As a lawyer, I want every exhibit listed by letter and page in a table I can sort, so that a page a witness mentions is one lookup and not a flip through the binder.
- App `nocodb`. Service `airtable`. Caveat: a table, not a matter workspace; no conflict check, no deadline, no filing and no case number on screen; the paper binder stays the master; no claim about speed.
- Moment: `office` room, anchor `bookshelf` (fallbacks `desk`, `room@office`). The first thing: an older relative who once worked in a court office keys the rows from the lawyer's read-out, beside the shelf where the binders stand, one tab letter at a time.
- First sentence: "The exhibit binder has tabs and letters; NocoDB keeps the same list as a table on the Core."

**US5. Syncthing, Resilio Sync.** As a lawyer, I want the working folder on my laptop and the one on my desktop to match, so that the draft I open on Monday is the one I closed on Sunday.
- App `syncthing`. Service `resilio-sync`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; folders sync between machines that are on at the same time and can reach each other at home; syncing is not a backup, and a deletion on one machine reaches the other; no word about encryption or safety.
- Moment: `bedroom` room, anchor `desk` (fallback `room@bedroom`; the home needs a desk alcove there, or the beat moves to `office`/`desk`). The first thing: the laptop comes upstairs at the end of the evening and the same file name, with the same last line, is already on the desktop.
- First sentence: "{name} wrote on the laptop and the desktop held an older draft; Syncthing matches the two folders directly."

**US6. Akaunting, Xero.** As a lawyer in a two-person practice, I want the year's receipts and invoices in one set of books, so that January starts from the books and not from a shoebox.
- App `akaunting`. Service `xero`. Caveat: a bookkeeping tool; no accounting, tax or legal advice; no client-money or trust accounting, no bank feed, no payroll, no figure for any total; the pair is new but the app is in four families, so reserve it behind apps with fewer.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `kitchen-island`). The first thing: an adult child on a break from study reads receipts from the shoebox, one at a time, and the lawyer keys each into the book.
- First sentence: "Receipts for the practice sat in a shoebox until January; Akaunting keeps the year's books on the Core."

**US7. Solidtime, Toggl Track.** As a lawyer, I want to log time against each matter as I work, so that Friday's sheet is built from entries and not from memory.
- App `solidtime`. Service `toggl-track`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; time only, it bills no one and keeps no client money; a matter is a short code or an initial, never a client name on screen; no hours figure and no claim about what the time is worth.
- Moment: `office` room, anchor `desk` (fallbacks `dining-table`, `room@office`). The first thing: the timer starts as the pencil comes down on a legal pad, and a sticky note carries the matter's short code.
- First sentence: "Hours for each matter were kept in a rented timer; Solidtime keeps them on the Core, matter by matter."

**US8. Donetick, Tody.** As a lawyer going into a hearing week, I want the house jobs to have a name against them on a rota, so that the week runs because people agreed to it on Sunday and not because someone remembered.
- App `donetick`. Service `tody`. Caveat: notifications use Telegram or Pushover, which are outside services, so the beat shows the rota and says nothing about the alert; house jobs only (the bins, the shop, the lift to practice), never a job about a person's care, health or whereabouts; one list app per household.
- Moment: `kitchen` room, anchor `fridge` (fallbacks `kitchen-island`, `counter`). The first thing: a sheet on the fridge door gets a name against each job in the family's own handwriting, a fifteen-year-old picks Thursday's bins, then the same rota goes onto the Core. The teen reads and picks; no chat model, no agent.
- First sentence: "Hearing week used to run on whoever remembered; Donetick puts a name against each house job."

**US9. Baikal, iCloud Calendar.** As a lawyer, I want the contacts of the interpreters, experts and court reporters I call in one address book that my phone and my laptop both read, so that a name is found by its role and not by a hunt through an old phone.
- App `baikal`. Service `icloud-calendar`. Caveat: calendars and contacts only; a calendar and contacts app on each device does the reading, on the home Wi-Fi; Baikal overlaps Radicale, so a household has one of the two; no sharing carries over; the book holds professionals the lawyer calls, never a client list.
- Moment: `office` room, anchor `desk` (fallbacks `bookshelf`, `room@office`). The first thing: the day the old phone is replaced, the lawyer copies one card at a time from the paper address book, then the new phone reads the book from the Core.
- First sentence: "The interpreters and experts {name} calls lived in one phone's contacts; Baikal keeps the address book on the Core."

**US10. Stirling-PDF, Smallpdf.** As a lawyer, I want loose exhibit PDFs merged into one bundle in the order I set, so that one file goes to the printer and the order is the one I chose.
- App `stirling-pdf`. Service `smallpdf`. Caveat: merge, split, compress and convert only; no editing, no redaction and no signing; a scanned page needs its text read first, and the beat claims no text recognition; nothing about the bundle being accepted by anyone.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `room@dining`). The first thing: the paper index of exhibits is laid across the table the evening before a filing, and the order on screen is set from it, one file at a time.
- First sentence: "Loose PDFs become one bundle in {name}'s order; Stirling-PDF does the merge on the Core."

## 4. Rules these stories keep

- **Where the file lives, not what it promises.** Each story says what the app does and where the files sit. Never "secure", "private", "privileged", "confidential by design", "compliant", "court ready", "legally binding" or "valid", and never a claim that a saved copy, a bundle or a note counts for anything outside the house.
- **The lawyer decides, the app holds.** No story has an app or an agent decide, send, file, sign, pay or advise. The model chore from the chapter is not repeated here; if the owner wants one more model story, use Open WebUI with the chapter's rule (the model drafts, the person signs) and no minor in the scene.
- **No chat model or agent for anyone under sixteen.** Story 8 has a fifteen-year-old who reads a rota; no other story has a minor in it.
- **Pairs.** All ten are registry pairs, so the 80 percent pair share holds. Pair-less apps (Whisper-WebUI, Companion Memory) stay in the chapter.
- **Gender and role.** The partner, the adult children and the older relative are not given the role by reflex: none is "the wife", "the daughter" or "the secretary" by default, and `{name}` carries no pronoun. A fleet that casts these stories should vary who plays each.
- **No UI.** No story describes a screen. Shots are the chapter's: hands, paper, a pause, the Core between two binders, no gavel, no scales, no readable client name or case number.

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json` and `personas.json`):

- Every app id is in the catalog, is in the live store, and is `storySafe` yes (none is `avoid`).
- Every service id is in `services.json` with no flag (not `stale`, `story-excluded`, `ordinary-word` or `renamed`), `alternativeToForm` ok, and the app is in that service's `storyApps` and has the service's name in its own `replaces`.
- No pair repeats one the chapter shows, and no service is used twice in this file.
- The ten first sentences are 15 to 20 words each, with no digit, dash or exclamation mark, and no company name.

Open items for the owner:

- **`reviewed.json`.** Syncthing (US5) and Solidtime (US7) have no QA screenshot on `origin/main`; a beat that names either needs an owner entry (`app-qa-screenshot`).
- **Pool.** Seven of the ten apps are not in the `lawyer` pool in `personas.json` (`collabora-online`, `drawio`, `nocodb`, `syncthing`, `akaunting`, `donetick`, `baikal`). `persona-cover` needs only one pool app in a lawyer's beats, so this is not a blocker; add them if the owner wants the pool to match the stories.
- **Room fit.** US5 needs a desk in a bedroom; most homes have one only as a fallback. If the cast home has no such desk, the beat moves to `office`/`desk` and keeps its moment.
- **Fleet cap.** If a fleet casts more than one lawyer, spread these apps: Akaunting and Stirling-PDF already sit in four and five families.
