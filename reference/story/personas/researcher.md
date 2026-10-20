# The Researcher (`researcher`)

Draft deep dive for one proposed fifteenth archetype. Category: Study and research (`study`). Not yet in `content/story/personas.json`, the schema enum or `ARCHETYPES`; the row to add is at the end of this file. Written for the persona bible's chapter shape (`persona-bible.md` section 3) and the app guide of `persona-apps.md`. Companion OS, Companion Agents and Companion Memory are in beta.

Nobody here is a customer. Ages, homes, jobs and sample lines are design choices for fictional characters. Statements about how researchers work are editorial syntheses and are tagged **[?]** (inference, not a fact to print). No statistic is quoted. Nothing here is advice of any kind, and no app is claimed to make anyone follow any rule.

One line: **reads, cites and writes up, from sources, on a Core that holds the reading, the notes and the drafts.**

---

## 1. Who

**A day in the life, in daylight.** A postgraduate in his early thirties is writing up a doctorate in soil science at the dining table of a two-bedroom flat. The window faces east and the table is clear by nine. He prints the papers he is citing, because he reads a printed page differently, and the printed pages sit in a stack beside the laptop. Before he writes he opens the note he keeps for each paper, as a plain file in a folder. If a paper cites a dataset page that has since moved, he opens the copy he took on the day he read it. In the afternoon he runs the analysis in a notebook and compares the figure with last week's. One of the key methods papers is in Portuguese. He runs the paragraph through a translation tool on the Core, only to see which pages he needs a human translator for. His partner is at the other end of the table with their own work. The Core sits on the shelf behind them. By evening the draft chapter is in a folder he can copy.

**A second life, same job.** A woman of fifty-eight came back to study part time after a career in transport planning. She is doing a master's in local history and keeps the parish and borough records for a small historical society. On Tuesdays she is at the record office with a camera and a pencil, because the reading room allows both and not much else. At home she photographs and files the ledgers on the trestle table in the dining room, adds a line to each entry in her notes, and builds a table of names, dates and where each came from. On Sunday morning she reads the week's saved articles on the couch, in the light from the front window. She lives with her partner and an adult son, who games in the next room and does not care about any of this. The same job also covers an independent scientist writing up fieldwork without an institution, a mature student on a distance degree, and a translator-scholar who reads sources in three languages. Ages run from the early twenties to the late seventies. The cast range of 24 to 70 is a design choice [?]. The two examples are not a rule about who the researcher is: the casting step picks gender, age and place from the cast plan, never from this text.

**What they have in common.** They work from sources they did not make, and they are accountable for how they used them. They are careful, and they are wary of putting unpublished work in a place they cannot name. They are not gadget people. The Core earns its place on the shelf by holding the reading, the notes and the drafts in files they can open without one particular app.

## 2. What they are responsible for

- **The argument and the text.** The claim, how it is made and what it rests on. Nobody else writes it.
- **The sources.** That a citation points at something that exists, says what is claimed and can be found again. A page that has moved, a scan that is unreadable or a translation that is wrong all fall on them.
- **Other people's credit.** Authors cited, collaborators named, archivists thanked, the society whose records they keep.
- **The people in the sources.** In history and fieldwork, the names and lives in a ledger or a field notebook. They treat that as a duty of care and not as a feature of the Core. See sections 8 and 9.
- **Deadlines owed to others.** A supervisor, a journal, an editor, a funder, a society's newsletter.
- **A trail.** Being able to say how a figure was made, what was read and when. The Core holds the files. It does not hold the discipline.

They are not responsible for the household's other jobs. In a family the researcher is never "the one who knows things". Another member runs the lamps, another feeds the house, and the researcher still forgets the milk.

## 3. What they rent today

Only services in `content/story/services.json` with no `stale` or `story-excluded` flag and `alternativeToForm: ok`. The registry id is in the first column.

| Registry id | Service | What a researcher keeps in it | Hub app (catalog id) |
|---|---|---|---|
| `raindrop-io` | Raindrop.io | Years of bookmarks: the pages cited, the dataset descriptions, the tabs they could not bear to close | Linkwarden (`linkwarden`) |
| `instapaper` | Instapaper | The reading list: long articles, essays and reports saved to read later | Readeck (`readeck`) |
| `notion` | Notion | A literature table, a reading log, chapter outlines | Logseq (`logseq`) |
| `evernote` | Evernote | Years of notes from archives, lectures and seminars | Obsidian (`obsidian`) |
| `google-translate` | Google Translate | A rough gloss of a paragraph in a language they read slowly | LibreTranslate (`libretranslate`) |
| `deepl` | DeepL | A draft sentence or an abstract put into another language | LibreTranslate (`libretranslate`) |
| `google-drive` | Google Drive | Scans, photographs of pages, PDFs of papers and a folder per chapter | Paperless-ngx (`paperless`) |
| `chatgpt` | ChatGPT | A question put to a model about a paper or a draft | AnythingLLM (`anything-llm`) |
| `airtable` | Airtable | A table of sources, dates and observations | Grist (`grist`) |
| none | (no service) | Notebooks and analysis scripts | JupyterLab (`jupyterlab`), no replaces chip |

Notes. `google-drive` is included because Paperless-ngx's catalog entry names it and the registry entry passes every check. `pocket` carries the `stale` flag and is never named, although Linkwarden's and Readeck's catalog entries list it. The NotebookLM chip is left out because its registry entry carries a `renamed` flag. Say "an alternative to <Service>" in prose and use today's chip, `replaces <Service>`, from the app's own list. Never state what a company does with the person's data; name the service only in the comparative form (`incumbent-attack`).

## 4. What the Hub offers them

Display names are exact. One beat, one app. Every app here is `storySafe: yes` in `catalog-apps.json` and in the live store.

| Catalog id | Display name | What it does for this person | The honest caveat | A line that is allowed |
|---|---|---|---|---|
| `linkwarden` | Linkwarden | Saves a page with a screenshot and a PDF, so the page cited in the draft still has a copy. | The copy is for the person's own reading. It does not keep every page for ever, and a copy is the page as it was when the copy was taken. | "Linkwarden saves a page with a screenshot and a PDF, so the copy is still there if the link rots." |
| `readeck` | Readeck | A reading list of saved articles, kept apart from the desk. | Your own saved pages only. It does not find or rank the articles. | "Readeck keeps the week's saved articles on the Core." |
| `logseq` | Logseq | A daily journal and notes in plain Markdown files. | Say "notes", never "knowledge base" or "second brain" (`vocab-knowledge-base`). Name Logseq or Obsidian in a beat, not both. | "The journal is a folder of Markdown files on the Core." |
| `obsidian` | Obsidian | Notes per paper and per chapter, as Markdown files, in a browser session. | Not open source: never say so. The notes are files. An MCP entry exists, so an agent can read the vault; do not show it unless the person approves. | "The notes are Markdown files on the Core." |
| `libretranslate` | LibreTranslate | Translates text and documents on the Core, for a rough gloss or a draft sentence. | Language models are downloaded once, over the internet. Say nothing of quality. Never "works offline" (`sec-offline`). | "The words are translated on the Core, not sent to a translation website." |
| `paperless` | Paperless-ngx | Files scans and PDFs; every page is read and tagged, so the lot can be searched. | Scans and PDFs only; office documents are not converted. AI features are off by default. Say nothing of OCR for scanned PDFs and nothing of handwriting (a ledger beat says "filed and tagged" and not "searchable"): `f-box-to-box` lists OCR as roadmap. Never bare "Paperless". | "Every page is read and tagged, and the lot is searchable." |
| `anything-llm` | AnythingLLM | A chat about the person's own documents, with a model on the Core. | A chat app: the member is 16 or older (age rule 16), and in this persona an adult. It can also use cloud models: show only the local path and never a key. Not a frontier model; it can be wrong. Never mention its "several users and permissions" (`cap-multi-user`). | "A model on the Core answers a question about the PDFs, and a person reads the page itself." |
| `grist` | Grist | A spreadsheet-database for sources, dates and observations, stored as a SQLite file that can be copied. | Not a statistics package. It holds the table; the analysis is elsewhere. | "The table of sources is a Grist file on the Core." |
| `jupyterlab` | JupyterLab | Notebooks, code and data, run in a browser on the Core. | One password set at install. The kernel runs the code on the Core; installing a Python package reaches the internet. The catalog names nothing it replaces: no replaces chip, and never "replaces MATLAB". | "The notebook runs on the Core." |

**Left out, on purpose.** Open Notebook and SurfSense (`storySafe: with-caveat`, many cloud providers, and the NotebookLM chip is renamed). PDFMathTranslate (`with-caveat`: backends include cloud translators; no QA run) can be a background app on the Core but is not named in a beat. Kiwix is `avoid` (empty library). Karakeep, ArchiveBox and other bookmark tools are in the store, but a persona beat names one of the nine.

## 5. Where they spend time

No quotes and no statistics. Kinds of places and media only [?].

- **Reading rooms.** A university library, a record office, a county archive, a museum's study room. Pencils, a camera if the room allows one, a trolley of boxes.
- **Seminar rooms and corridors.** Supervision meetings, reading groups, a conference poster session, a society's evening talk.
- **The shared desk at home.** The dining table with the stack, the study with the shelf, the end of a bed with a laptop.
- **Online, in small rooms.** Preprint servers, institutional repositories, a department's or society's mailing list, a field-specific forum, a translators' list, a local history society's page. Long essays and reports more than short feeds.
- **Media.** Journals and their newsletters, books (often second-hand), podcasts that interview authors, radio talks, a newspaper's long weekend section.
- **Offline.** A field site, a graveyard, a quarry, a coastline, an allotment with a notebook.

Film them at a table or a shelf, with a printed page in the frame. The camera rule from the journalist chapter carries over: eye level, no whip pans, no face at a screen for longer than a beat.

## 6. How they talk

- **Pace.** 140 to 155 words a minute as a design band [?]. The house voice is fixed at 150, so pace is sentence length and the pause before a figure.
- **Sentences.** 8 to 16 words, cap 20. Plain verbs. A figure is stated once, with its source.
- **Tone.** Exact, dry, a little guarded. Pleased by a good source and not afraid to say "I do not know yet". They hedge honestly and not as a habit: "I think this is the earlier ledger" is a researcher; "it could be anything" is not.
- **Vocabulary they own.** Source, primary and secondary, reference, citation, draft, chapter, corpus, ledger, provenance, footnote, version, field notes, dataset, supervisor, reviewer, "as cited in".
- **What turns them off.** Anything that says research is "faster", "automatic" or "in seconds". "Summarises papers for you." "Discover insights." "Your second brain." "Game-changer", "unlock", "supercharge". A tool that reads for them. A tone that treats a long document as a problem to be removed.
- **What makes them lean in.** Where the file is. Whether it opens without the app that made it. Whether the copy of the page is the page they cited. A caveat said first.
- **Plain scripting.** Third person in captions, as in every chapter. A quoted line is first person, an adult, labelled scripted, and short.

Lines that are fit to print, all checked against `claims.json`:

- Caption: "He takes a copy of the page when he reads it. The copy sits on the Core, with its own PDF."
- Caption: "She files the ledger pages she photographed at the record office, each under its own tag."
- Quote (adult, scripted): "I want the note, the source and the draft in one folder that I can copy."

## 7. Comfort with technology and attitude to AI

**Comfort: 2 to 4 out of 5, and the range is the point.** A postgraduate in a quantitative field may run R or Python daily and keep a notebook, and still not administer a server. A mature student may be comfortable with a word processor and a library catalogue and nothing more. A local historian often builds a careful table by hand. An independent scientist may be the strongest of the lot and also the least trusting of a tool they did not set up. None of them is the household lead of the Core by reflex. Where the family has a household lead, that is another member, and the researcher asks them. The researcher installs an app from a tile and chooses where the notes go.

**Attitude to AI, honest range.** Some are proud of not using it on their own writing, and the story respects that. Some use a model for one bounded chore on their own material: a question across their own PDFs, a rough gloss of a paragraph in another language. Some are curious and unsure about what their department, their journal or their society allows, and they follow that rule and not a feature list. A few reject it altogether, and no one is pushed at them. The rules, in the order the persona uses them:

1. A model is a reading aid, never a source. The researcher opens the page and reads it.
2. One named chore, on the person's own files, with the answer checked by hand.
3. Never writing text that carries their name, and never choosing what to cite.
4. Never accuracy, speed or parity with a hosted model. A Core runs a capable open-weight model; it is not the best model in the world this month (`not-frontier`, `cap-parity`).
5. A chat model is for a member of 16 or older. In this persona, an adult.
6. The researcher decides what is shown to the model. The beat shows the approval.

## 8. Objections and the honest limits

| Objection a visitor might raise | What the story says, calmly |
|---|---|
| "My university already gives me storage." | It may be the right place for some files. The Core is where the person keeps what they want in their own folder. The story does not argue the university out. |
| "My supervisor and my co-author need the draft." | Sharing beyond the home network is not claimed (`f-remote-access`). The draft leaves the Core when the person sends it, like any other file. Live co-writing with others in other houses stays where it is. |
| "I get papers through my library sign-in." | That access does not move. The Core holds the person's own saved copies, not a licence to anything. |
| "Is a saved copy of a page allowed?" | The person reads the terms of what they save. The story says what the app does and never says what is permitted. |
| "A model on a home machine can be wrong." | Yes. It is a reading aid, the answer is checked against the page, and it is not a frontier model. |
| "What if the disk fails or I lose the Core?" | The Core holds one copy of the work. A second copy elsewhere is the person's job. The Core is not a backup and not a vault. |
| "Does this meet my ethics approval, my data plan or my funder's rule?" | The story cannot answer. Those rules belong to the institution, and the Core is not a statement about any of them. Nobody on screen says it is. |
| "Will it import my reference manager, my Overleaf drafts, my university's repository?" | No. Those do not move. The reference manager and the LaTeX editor stay where they are. |
| "Does a notebook make my work reproducible?" | The story does not say so. It says where the notebook runs. |
| "What about the participants, the people in the ledgers?" | The story names no participant data and no health, legal, finance or children's record. If a home Core holds anything about the people named in the records, the researcher's institution decides what may be held. The Core does not decide. |

What the Core and the apps cannot do for them: move the reference manager, the institutional library access, the live co-writing, the publisher's PDF licence, the preprint server or the journal's submission system; read a scanned page to the standard of a person; promise a translation is right; replace a supervisor; make a model right; survive a fire in the same house.

## 9. Claims boundary

What must never be said for this persona. The ids are in `content/story/claims.json`.

| Never | Why (claims id) |
|---|---|
| That a model, a translation or a search is accurate, as good as, or better than a hosted model or a person. | `cap-parity`, `f-parity`, `not-frontier` |
| That an AI summary replaces reading, writes the text or chooses the citations. | Persona rule; also `cap-omniscient` (it does not read, know or remember everything) |
| That anything is faster, saves hours or finds sources. | `num-time-saved`, `f-unmeasured`, `f-savings` |
| A price, a saving, a plan or a tier. | `f-prices`, `num-dollar`, `f-tiers-ship` |
| That nothing leaves the Core, that it works offline, or any security or privacy guarantee. | `f-never-leaves`, `sec-never-leaves`, `sec-offline`, `f-security-guarantee`, `sec-absolute`. Installing apps, saving a page and downloading translation models use the internet. |
| That the Core is a vault, a backup, or safe from a search or a seizure. | `f-security-guarantee`; the journalist chapter's rule |
| Any remote access, a link shared outside the house, or work "from the road". | `f-remote-access`, `cap-remote-access` |
| That each person has their own private space or that the Core separates people. | `f-multi-user`, `cap-multi-user`. Do not name AnythingLLM's users and permissions. |
| OCR of scanned PDFs, an app reading a scan or handwriting, or a ledger "searchable by its words". | `f-box-to-box`. Say "every page is read and tagged" and nothing more. |
| That users own the apps. | `f-own-apps`, `cap-own-apps`. Say "your Core, your files, no API bill". |
| Any compliance, certification, audit or "approved by" wording; any claim about ethics approval, data protection, records or research integrity. | `sec-compliance`, `f-compliance`. The regulated-domain rule: health, legal, finance, children's data and education records are written without a compliance, certification, safety or security claim and without advice. Say only what the app does and where the files live. |
| Medical, legal, tax or financial statements built on the research. | `f-medical-care`, `f-legal-tax-fin`, `legal-claims` |
| A real researcher, a real paper's title as a "case", a testimonial or a user count. | `f-testimonial`, `f-real-person`. Fictional sources only, and no real archive, society or university is named as a customer. |
| What a named company does with a person's data. | `incumbent-attack` |
| "Knowledge base", "second brain", "assistant", "chatbot", "home server", "marketplace", "log in". | `vocab-knowledge-base`, `vocab-assistant`, `vocab-chatbot`, `vocab-home-server`, `vocab-app-store`, `vocab-log-in` |
| Em or en dashes, exclamation marks, "easy" or "simple". | `dash-em-en`, `exclamation`, `buzz-simple-claims` |

## 10. Fit: homes, rooms, furniture, ages, households

**Rooms (engine ids).** `office`, `dining`, `living`, `bedroom`; fallback `kitchen`. These are the roles in `content/story/roles.json`.

**Anchor roles.** `desk` (home: office, bedroom), `bookshelf` (home: living, office), `dining-table` (home: dining, kitchen). Fallbacks: `couch` (living), `kitchen-island` (kitchen, dining), `room` with an explicit `anchor.room`. This is the same set as the journalist and for the same reason: the work happens at a surface with paper on it. The researcher differs from the journalist in props and apps, and in the absence of a tape, a recorder or a source to protect.

**Furniture that suits.** `desk`: writing-desk, standing-desk, laptop, dual-monitor-arm. `bookshelf`: bookshelf, low-bookshelf, ladder-shelf, open-shelving. `dining-table`: trestle-table, farmhouse-table, oval-dining-table. `couch`: sofa, loveseat, daybed for the Sunday reading beat. `fireplace` as light only.

**Props to add** (overlays, not apps): a stack of printed articles, a box file, a pencil and a notebook, a magnifier on a tray, a stack of photographs in an envelope, a mug. No white coat, no beaker, no lab bench, no globe, no chalkboard. These are the reflex props; use them rarely.

**Homes that carry it today** (from the house files: rooms that hold a shelf, some with a desk beside it). Seraphine (Library), Valley-View Villa (Reading Lounge, Garden Room), Blue Dormer Cottage (Fireside Nook), The Mirage (Reading Loft, Stair Landing), Epiphany (Den), Cocoon (Den). Stone Gable House has a Front Study with a shelf and a desk, and Aurora has two Studies. Lake Cabin's Study already tells the journalist, and the apartments are not yet files, so the Study Alcove, Desk Nook and Library Nook of the planned six are for the casting step to check. Never a room without a shelf or a desk that holds paper.

**Ages.** Cast 24 to 70 [?]. A 16 or 17 year old doing a school research project is a learner, not a researcher, and uses the non-chat apps only. A child is never the researcher.

**Household shapes.** Couple (one researcher, one other job), young family (a parent writing up while a baby sleeps, daylight only), older kids (a parent on a part-time degree at the dining table), grandparents (a person who has taken up a degree late and is not the family's historian by default). A family covers two or more archetypes, so the researcher shares a house with a builder, a host, a maker, a gamer or a contractor. Never two researchers in one family.

**Casting warning against stereotype.**
- Not by age: the researcher is not the grandparent by reflex, and not the youngest adult.
- Not by gender: the careful, quiet, bookish person is not cast as a woman by default, and the technical researcher is not cast as a man by default.
- Not by culture or origin: reading sources in other languages is a skill, not a heritage. A researcher who translates is not the one with a migration story, and a historian of a place is not from it by default.
- Not by disability, class or accent. No white coat, no spectacles as shorthand for study.
- Not as the family's fixer: do not make the researcher the household's adviser on its health, law or money, and do not make the learner in the same house a copy of them. The researcher can be wrong about the milk.
- Not as a gatekeeper: the household lead of the Core may be someone else.

**Proposed count** [?]: four to six researchers across the 36 homes, none in a home that already tells a journalist in the same room.

## 11. Ten user stories

Written without a name. Each story is tied to one catalog app and one registry service and carries its caveat. The service `id` is from `content/story/services.json`. The story moment is the first thing the beat shows. Rooms and anchors are ids from `roles.json`.

**1. Linkwarden, `linkwarden`, an alternative to `raindrop-io`.**
As a researcher, I want the pages I cite saved as a copy with a screenshot and a PDF, so that a citation still has something to point at when the page has moved.
Caveat: the copy is for my own reading, and a page is saved as it was when the copy was taken. Not "every page for ever".
Moment: office, anchor `desk`. A reference in the draft links to a page that has moved, and the saved copy is opened beside it.

**2. Readeck, `readeck`, an alternative to `instapaper`.**
As a researcher, I want a reading list of saved articles that I read away from the desk, so that reading and writing happen in different places.
Caveat: your own saved pages only; it does not find articles for me.
Moment: living room, anchor `couch`. Sunday morning light, the week's saved articles, and the laptop shut on the desk down the hall.

**3. Logseq, `logseq`, an alternative to `notion`.**
As a researcher, I want a daily journal of what I read and what I thought about it, so that I can trace how the argument was reached.
Caveat: say "notes", never "knowledge base". Plain Markdown files on the Core.
Moment: bedroom, anchor `desk`. In a flat with no study, the first thing at the desk is yesterday's page of the journal.

**4. Obsidian, `obsidian`, an alternative to `evernote`.**
As a researcher, I want my notes on each paper and chapter kept as Markdown files, so that they are not locked inside one app.
Caveat: Obsidian is not open source; the notes are files and the app runs in a browser session.
Moment: office, anchor `bookshelf`. A printed article is pulled from the shelf and the note for the same paper is opened beside it.

**5. LibreTranslate, `libretranslate`, an alternative to `google-translate`.**
As a researcher, I want a rough gloss of a paragraph in a language I read slowly, so that I know which pages need a person to translate them properly.
Caveat: say nothing of quality; language models are downloaded once over the internet. The gloss is never quoted.
Moment: dining room, anchor `dining-table`. A photographed page of an old letter lies beside the laptop, and one paragraph is pasted in.

**6. LibreTranslate, `libretranslate`, an alternative to `deepl`.**
As a researcher, I want an unpublished abstract put into a second language, so that a co-author or a conference can read it without my draft going into a translation website.
Caveat: say nothing of quality; a person who reads that language checks it before it goes anywhere.
Moment: office, anchor `desk`. The abstract is in its own file, and the translation is saved beside it for the co-author to correct.

**7. Paperless-ngx, `paperless`, an alternative to `google-drive`.**
As a researcher, I want the scans and photographs from the record office filed and tagged in one place, so that a page is found by the visit and the ledger it came from.
Caveat: scans and PDFs only; no office conversion; AI features are off by default. No claim about reading scans, and none about handwriting.
Moment: dining room, anchor `dining-table`. The day's photographed pages of a ledger go in after the Tuesday visit.

**8. AnythingLLM, `anything-llm`, an alternative to `chatgpt`.**
As a researcher, I want to ask a model on the Core a question about my own PDFs, so that I know which paper to open and read myself.
Caveat: a chat app, adult only here; local model only, no key shown; not a frontier model; it can be wrong and it is never the source.
Moment: office, anchor `desk`. The question is typed, the answer is read, and then the paper is pulled from the shelf and opened to the page.

**9. Grist, `grist`, an alternative to `airtable`.**
As a researcher, I want a table of sources, dates and observations, so that the evidence behind each claim sits in one place.
Caveat: a spreadsheet-database stored as a SQLite file you can copy; not a statistics package; it holds the table and the analysis is elsewhere.
Moment: living room, anchor `bookshelf`. The names from the ledger, in a table, with a column for where each came from.

**10. JupyterLab, `jupyterlab`, no registry service (no replaces chip).**
As a researcher, I want to run the analysis in a notebook next to my notes, so that I can re-run a figure on the Core when the data changes.
Caveat: one password set at install; the kernel runs the code on the Core; installing a package reaches the internet. No outcome claim such as "reproducible".
Moment: bedroom, anchor `desk`. A figure is re-run after a small correction to the data, and the notebook is saved beside the chapter.

## 12. Six beat seeds

Each is the first sentence a visitor would read, at most 20 words, sentence case, no dash. Pointed means it says what the rented arrangement held or changed and what the family's own copy does. The chip is today's grammar (app, then `replaces <Service>`); the service is named only on the chip, never in the sentence.

1. The page you cited has moved, and the copy you took is a PDF on your Core. Chip: Linkwarden | replaces Raindrop.io
2. Notes are only as readable as the app that holds them; these are Markdown files in a folder. Chip: Obsidian | replaces Evernote
3. An unpublished abstract does not have to be pasted into a translation website to be read in another language. Chip: LibreTranslate | replaces DeepL
4. A morning's photographs of a ledger are filed and tagged in one place on the Core. Chip: Paperless-ngx | replaces Google Drive
5. You ask a model on the Core about your own PDFs, then open the paper and read it yourself. Chip: AnythingLLM | replaces ChatGPT
6. The evidence for chapter three used to live in a hosted table; now it is one file you can copy. Chip: Grist | replaces Airtable

## The `personas.json` row

To land the persona the owner must also add `researcher` to the `member.archetype` enum in `content/story/schema/family.schema.json`, to `ARCHETYPES` in `assets/story/types.ts` (a test keeps the three equal), to `scripts/story/build-casting.mts` (type, order list, anchor and room maps), to the pools and `JOBS` set in `scripts/story/cast-lint.mts`, to `scripts/story/lib/fleet.mts` (quotas) and to `scripts/story/lib/persona.mts` (the spread message), then re-run `pnpm run story:cast`. The row has no `example`, as `maker` and `host` have none; a name is chosen at casting from names not yet used.

```json
"researcher": {
  "label": "Researcher",
  "description": "Reads, cites and writes up from sources: papers, archives and translated texts, with the reading, the notes and the drafts kept on the Core.",
  "rooms": ["office", "dining", "living", "bedroom"],
  "fallbackRooms": ["kitchen"],
  "anchorRoles": ["desk", "bookshelf", "dining-table"],
  "fallbackAnchorRoles": ["couch", "kitchen-island", "room"],
  "apps": ["linkwarden", "readeck", "logseq", "obsidian", "libretranslate", "paperless", "anything-llm", "grist", "jupyterlab"]
}
```
