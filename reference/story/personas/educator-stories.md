# Educator: ten more user stories (`educator`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.14 of [persona-bible.md](../persona-bible.md) and the `educator` row of `content/story/personas.json`. Nobody here is a customer: ages, households, roles and lines are design choices for fictional characters. Companion OS, Companion Memory and Companion Agents are in beta. The law for every word is `content/story/claims.json`.

**What this file is for.** The chapter shows the teacher's marking week: the Sunday pile, handouts in Paperless-ngx, a parent's note in LibreTranslate, report comments drafted by a model on the Core and rewritten by hand, Joplin Server, LibreOffice, Nextcloud and Razzia for the Friday quiz. These ten stories leave that ground. They are about the other lives that teaching covers: the lesson diagram drawn again each autumn, a retired teacher writing down a scheme of work for a newcomer, a Wednesday evening with a plan that has a break in it, the note after the last lesson, a practical lesson's recipe, a worked example recorded at a child's desk, a lecturer's set texts, a music tutor's backing tracks, a private tutor's invoices and a family's reading chart. Each is tied to a catalog app and a registry service that the chapter does not use.

**Regulated domain.** This is children's data and education records. No story shows or names a class list, a mark, a grade, a report, a pupil's name or work, a safeguarding note or a slip with a name on it, and none says that anything is compliant with any rule, allowed under any data policy, or safe. There is no learning platform, gradebook or student information system in the store, and the stories do not pretend there is; the school keeps those. Every story is about the teacher's own materials, or a family's own papers at home, and says only what the app does and where the files live. No story gives advice. Remote access is not claimed: every scene is on the home network.

**Age rule.** Nobody under sixteen uses a chat model or an agent, and none of the ten apps is one. Children appear in four stories (5, 6, 8 and 10); in each, the beat belongs to the adult, the child is named in the body as the one being helped, and the child never acts on a chat or agent app.

## 1. What the chapter and the families already show

**The chapter (3.14).** Top apps: Open WebUI, Paperless-ngx, Nextcloud, LibreOffice, LibreTranslate, Joplin Server, Razzia. Services named: ChatGPT, Claude, Evernote, Google Drive, Dropbox, Microsoft Office, Google Workspace, Google Translate, DeepL. Homes: the Villa (a Dining Room trestle table), Palm Knoll, Twin Gable House, Walk-up Duplex and Modern Pavilion; a playroom for a homeschool home.

**The thirty current families (read 2026-10-20).** No member of any family has the `educator` archetype (`casting.json` has none), so the pool shows up only through other people's beats. How often each pool app already appears in the thirty families:

| App in the educator pool | Families | | App in the educator pool | Families |
|---|---|---|---|---|
| Paperless-ngx | 15 | | Joplin | 5 |
| LibreTranslate | 12 | | Stirling-PDF | 5 |
| VaultWarden | 12 | | Excalidraw | 2 |
| Companion Planning | 12 | | Razzia | 1 |
| Nextcloud | 11 | | Radicale | 0 |
| Open WebUI | 8 | | Calibre-Web | 0 |
| LibreOffice | 7 | | | |

Paperless-ngx, LibreTranslate, VaultWarden, Companion Planning and Nextcloud are at or over the fleet cap (12 of 30 families, 14 of 36), so none of them is in a pair below. Companion Planning is in twelve families, so a family with a planner already has a calendar and a task list; story 3 uses a different planner app and a family takes only one. Eight of the ten apps are in no family or one family today; BookStack (3) is reused with a service no family has paired it with, and Excalidraw (2) is the one reuse of a pair (Miro appears in three families, two of them with Excalidraw or tldraw), so keep story 1 behind the others.

## 2. How the ten differ

| # | Room, anchor | When | Who is there | App (families) | Service (families) |
|---|---|---|---|---|---|
| 1 | `living`, `tv` | A Sunday afternoon, before a new term | A partner who is not a teacher, asking why | Excalidraw (2) | Miro (3) |
| 2 | `dining`, `dining-table` | The quiet week of the summer holiday | A retired teacher writing for a newcomer | BookStack (3) | Confluence (0) |
| 3 | `dining`, `dining-table` | A Wednesday evening | The teacher alone, with a cup of tea | Super Productivity (0) | Asana (0) |
| 4 | `living`, `couch` | A Friday, after the last lesson | A trainee teacher who lives in the house | Memos (1) | Apple Notes (0) |
| 5 | `kitchen`, `kitchen-island` | The Sunday before a practical lesson | A fifteen-year-old who measures the flour | Mealie (0) | Paprika (0) |
| 6 | `kids`, `desk` | A rainy Wednesday in a homeschool week | A nine-year-old, who is helped | OpenCut (0) | Clipchamp (0) |
| 7 | `office`, `bookshelf` | The week before a lecturer's term | The lecturer alone | Calibre-Web (0) | Apple Books (1) |
| 8 | `living`, `music` | A Tuesday at teatime | A ten-year-old at the piano, who is helped | mStream (1) | Apple Music (1) |
| 9 | `office`, `desk` | The last Friday of a term | A private tutor alone | Invoice Ninja (1) | FreshBooks (1) |
| 10 | `kitchen`, `fridge` | A Saturday morning | A family that keeps a reading chart | Habitica (1) | Habitify (0) |

Nine different room and anchor pairs (stories 2 and 3 share the dining table, and they differ in the week and the person), ten different moments, and kinds of person beside the educator that the chapter does not show: a partner, a retired teacher, a trainee, a teen, a young child, a lecturer, a pupil at a piano and a tutor.

## 3. Ten user stories

Format: "As a teacher, I want <job> so that <outcome>", with the kind of educator named where it matters (a retired teacher, a tutor, a homeschooling parent, a lecturer). Each is tied to one catalog app (`id`) and one registry service (`id`), with the honest caveat from the catalog and a one-line moment. The chip pair today is the app name, then "replaces <Service>"; prose says "an alternative to". The first sentence is what a visitor reads: sentence case, at most 20 words, no digit, no dash, no exclamation mark, and no company named in the sentence (the chip names it). `{name}` is the member's first name from the cast, so no pronoun implies a gender.

**US1. Excalidraw, Miro.** As a teacher, I want the diagram I redraw every September kept as a sketch I can change, so that I start the term from last year's drawing and not from a blank board.
- App `excalidraw`. Service `miro`. Caveat: amd64 only; a sketch for the teacher's own preparation, never a whiteboard for a live class and never anything about a pupil; it overlaps tldraw, so a household has one whiteboard app; no sharing is claimed.
- Moment: `living` room, anchor `tv` (fallbacks `couch`, `room@living`). The first thing: a partner who is not a teacher sits on the sofa and says "why?" at each arrow, and the teacher redraws the arrow on the wall screen.
- First sentence: "{name} redraws the same lesson diagram every September; Excalidraw now keeps the sketch on the Core."

**US2. BookStack, Confluence.** As a retired teacher, I want my scheme of work written down in books, chapters and pages, so that a newcomer to the school can read how I teach a unit without sitting next to me.
- App `bookstack`. Service `confluence`. Caveat: pages the teacher wrote, never a pupil's name, a mark or a class list; page history is the app's own and no claim is made about it; one household, no account per person is promised; the home is on the home network, so the newcomer reads it at the table.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `bookshelf`). The first thing: the retired teacher turns the first page of an old paper scheme of work face down beside the laptop and types the heading of the first chapter.
- First sentence: "A scheme of work sat in scattered folders; BookStack sets it out as books and chapters on the Core."

**US3. Super Productivity, Asana.** As a teacher, I want an evening's work laid out in blocks with a break written in, so that the plan has an end and tea is on it before the marking starts.
- App `super-productivity`. Service `asana`. Caveat: a day planner, a time log and a timer, on the Core; no hours figure and no claim about workload, wellbeing or what the plan saves; the blocks are the teacher's own words.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `counter@kitchen`). The first thing: a block labelled tea goes onto the plan before any block of work, and the kettle goes on.
- First sentence: "A long evening of marking becomes blocks with a break in them; Super Productivity plans them on the Core."

**US4. Memos, Apple Notes.** As a teacher, I want a short note on what to change next term written the day I notice it, so that the lesson is better next year because I wrote it down on Friday.
- App `memos`. Service `apple-notes`. Caveat: quick notes in Markdown, kept on the Core; the note is about the lesson, never about a child, and no pupil's name or work is in it; a household takes one quick-notes app.
- Moment: `living` room, anchor `couch` (fallbacks `bookshelf`, `room@living`). The first thing: a trainee teacher in the house, back from a lesson, types one line about the lesson and the teacher reads it over a shoulder.
- First sentence: "The note on what to change next term went into a phone; Memos keeps it on the Core."

**US5. Mealie, Paprika.** As a food technology teacher, I want Monday's practical recipe and its shopping list kept together, so that the ingredients are measured out on Sunday and not hunted on Monday.
- App `mealie`. Service `paprika`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; pasting a recipe web address fetches that page, and the recipe it saves stays on the Core; recipes and a list only, no allergy, nutrition or food-safety claim; a household has one recipe app, so a family that already uses KitchenOwl or Mealie for its meals uses the same one.
- Moment: `kitchen` room, anchor `kitchen-island` (fallbacks `counter`, `range`). The first thing: a fifteen-year-old reads the quantity of flour off the recipe card and measures it out; the teen reads and measures, and uses no chat model.
- First sentence: "Monday's practical recipe lived in a phone app; Mealie keeps it, and its shopping list, on the Core."

**US6. OpenCut, Clipchamp.** As a homeschooling parent, I want a worked example filmed once and trimmed, so that a child can watch it again tomorrow when the question comes back.
- App `opencut`. Service `clipchamp`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; the footage stays on the machine it was made on; the camera sees hands and paper only, never a face; the child watches afterwards and is the one helped, not the actor of the beat; no claim about what a child learns or how long a lesson takes.
- Moment: `kids` room, anchor `desk` (the kids' desk; fallbacks `toys`, `room@kids`). The first thing: a nine-year-old watches from a stool as the parent's pencil writes the first line of a sum on the page, and the camera above the desk looks only at the page.
- First sentence: "A worked example is filmed once, hands and paper only; OpenCut trims it on the Core."

**US7. Calibre-Web, Apple Books.** As a lecturer, I want the set texts on one shelf that opens in any browser at home, so that the whole seminar reads the same edition of the text, and my table has it too.
- App `calibre-web`. Service `apple-books`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; the shelf holds files the lecturer holds without a lock on them (editions out of copyright, or the lecturer's own files); no import from a store library is claimed; the beat shows a shelf and a spine, never a page of text.
- Moment: `office` room, anchor `bookshelf` (fallbacks `desk`, `room@office`). The first thing: the lecturer takes a paper copy off the shelf, opens it to the first page, and finds the same title waiting on the laptop's shelf.
- First sentence: "The set texts sat on one tablet; Calibre-Web puts the whole shelf in any browser at home."

**US8. mStream, Apple Music.** As a music tutor, I want the backing tracks I recorded for lessons in one folder that plays beside the piano, so that a pupil can play along without a phone propped against the music stand.
- App `mstream`. Service `apple-music`. Caveat: it streams music files the family holds; it overlaps Navidrome, which sits in twelve families, so a household with Navidrome uses that and this story moves to it; no import from a streaming library is claimed; no pupil's name or recording is kept.
- Moment: `living` room, anchor `music` (the piano; fallbacks `bookshelf`, `room@living`). The first thing: a ten-year-old sits at the keys and the first track starts from a speaker on the shelf; the tutor's hand beats time on the lid; the pupil is the one helped.
- First sentence: "Backing tracks for lessons were scattered across phones; mStream plays them from one folder on the Core."

**US9. Invoice Ninja, FreshBooks.** As a private tutor, I want the term's lessons written up as invoices on my own Core, so that the last Friday of term ends with the invoices made and not with a search for the dates.
- App `invoice-ninja`. Service `freshbooks`. Caveat: invoicing, not payment processing (taking card payments needs a payment provider, so the beat does not show it); no tax or accounting advice; a client link needs reach to the Core, so the story ends with the invoice made, not opened; a parent's first name at most, never a pupil's name; no amount on screen.
- Moment: `office` room, anchor `desk` (fallbacks `dining-table`, `room@office`). The first thing: the term's lesson diary, a paper one, is opened to its last page, and the first invoice takes its heading from it.
- First sentence: "The term's lessons were billed from a rented account; Invoice Ninja writes the invoices on the Core."

**US10. Habitica, Habitify.** As a homeschooling parent, I want a reading chart that the family fills in a day at a time, so that the days we read are a row on a chart and not a feeling.
- App `habitica`. Service `habitify`. Caveat: habits and a game of levels and quests, and nothing more; days read only, never a grade, a progress report or a record about a child; the beat is the parent's and the child ticks the paper chart; no claim about what a chart does for a child.
- Moment: `kitchen` room, anchor `fridge` (fallbacks `counter`, `kitchen-island`). The first thing: a child ticks a day on the paper chart on the fridge door with a marker, and the parent types the same day into the Core.
- First sentence: "The reading chart on the fridge has a twin on the Core; Habitica keeps the days the family read."

## 4. Rules these stories keep

- **No record about a child.** No class list, mark, grade, safeguarding note, pupil name, pupil work or slip with a name, in a shot, a caption or a popup. The tutor's invoice and the family's chart carry a first name at most, and not on screen. A clearly fictional name (a disc monogram) stands for anyone in a shot.
- **No compliance, no policy, no advice.** Never "compliant", "allowed under", "safe", "secure", "private" or "safeguarded", and no word about any education law. The headline is where the file lives and what the app does.
- **No learning platform.** It does not work with Google Classroom or a gradebook, and no story shows one. The school keeps those.
- **The teacher decides.** No story has an app mark, grade, decide or report on a child, and none has an agent speak for the teacher. The chapter's report-comment chore is not repeated; if the owner wants another model story, use Open WebUI with the chapter's rule (a model on the Core does one named chore from the teacher's own materials, then the teacher rewrites it) and no minor in the scene.
- **No chat model or agent for anyone under sixteen.** None of the ten apps is a chat or agent app.
- **Pairs.** All ten are registry pairs, so the 80 percent pair share holds.
- **Gender and role.** The partner, the retired teacher, the trainee, the lecturer and the tutor are not given the role by reflex, and `{name}` carries no pronoun. A fleet that casts these stories should vary who plays each, and no story assumes the parent who homeschools.
- **No UI.** No story describes a screen. Shots are the chapter's: the pile in low sun, a worksheet in a scanner tray, a hand crossing out a draft sentence; no real children, no school logo.

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json` and `personas.json`):

- Every app id is in the catalog, is in the live store and is not `avoid`. OpenCut, Calibre-Web and Invoice Ninja are `with-caveat`; the other seven are `yes`.
- Every service id is in `services.json` with no flag (not `stale`, `story-excluded`, `ordinary-word` or `renamed`), `alternativeToForm` ok, and the app is in that service's `storyApps` and has the service's name in its own `replaces`.
- No service is used twice in this file and no pair repeats one the chapter shows.
- The ten first sentences are 15 to 20 words each, with no digit, dash or exclamation mark, and no company name.

Open items for the owner:

- **`reviewed.json`.** Mealie (US5), OpenCut (US6) and Calibre-Web (US7) have no QA screenshot on `origin/main`; a beat that names any of them needs an owner entry (`app-qa-screenshot`).
- **Pool.** Eight of the ten apps are not in the `educator` pool in `personas.json` (`bookstack`, `super-productivity`, `memos`, `mealie`, `opencut`, `mstream`, `invoice-ninja`, `habitica`). `persona-cover` needs only one pool app in an educator's beats, so this is not a blocker.
- **Overlaps.** Excalidraw overlaps tldraw (the journalist file uses tldraw), mStream overlaps Navidrome, and Mealie overlaps the other recipe apps the host persona uses; a family takes one of each.
- **Beyond the home.** A teacher whose school sends work home, a school trip or a pupil's file is outside what a home Core holds; none of those is told here.
