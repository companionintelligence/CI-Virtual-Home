# Maker (`maker`): ten new user stories

Draft for the owner, written 2026-10-20. Companion OS, Companion Memory and Companion Agents are in beta. Nobody here is a customer: every name, age and household below is a design choice for a fictional character, and the example names are not cast members yet. Read for this file: chapter 3.5 of [persona-bible.md](../persona-bible.md), the `maker` row of `content/story/personas.json`, the 30 family files in `content/families/` (the six apartments are not in `content/houses/` yet, so they have no family file), `catalog-apps.json` and `services.json` (both as of 2026-10-19), `claims.json` and [validator.md](../validator.md). The law for every word is `content/story/claims.json`.

**One line.** A person with a day job who paints, photographs, writes, plays or builds in the margins of the week, and keeps what they make as files in a place they can open.

**What this file adds.** The chapter and the eight shipped makers lean on four apps and one idea: a library that sorts itself. These ten stories move the maker to a different room, a different month and a different hand: a novel in November, a clay film in July, a violin plan on a school night, a railway on a garage board. None of the ten pairs is used by any family yet, and seven of the ten apps have no beat at all in the 30 files.

---

## 1. What the chapter and the families already show

- **The chapter (3.5).** Bruk (19) and Haruo (70). Ranked replacements: Immich, Obsidian, Navidrome, Inkscape, AudioMass, Penpot. Rules that bind every story below: AI is a chore-doer and never a maker; originals untouched; lead with files; hands at work before the app appears; never "generate", "prompt" or "AI art"; the Core is not a backup; no public portfolio.
- **The families.** Eight makers in 30 files: Ravi (47, sound designer), Bao (8), Mateo (7), Kian (43, guitarist and teacher), Valeria (36, painter), Bruk (19), Malia (44, illustrator) and Haruo (70). Together they have 44 beats. The apps: Navidrome 4, Jellyfin 4, Immich 3, Obsidian 3, Hermes 3, OpenClaw 3, AudioMass 2, Inkscape 2, HomeHub 2, Grocy 2, and one each of Companion Planning, ntfy, n8n, Excalidraw, PairDrop, LibrePhotos, Blockbench, HortusFox, Mazanoke, Wanderer, PhotoPrism, CryptPad, Joplin Server, Vikunja, WordPress and BookStack.
- **The old places they name.** Spotify, Plex, Google Photos, Adobe Audition, Adobe Illustrator, Notion, Evernote, MagicaVoxel, Miro, AirDrop, Microsoft Office, Wix, Zapier, AnyList, Todoist.
- **Rooms and moments.** Mostly the living room, with a records room, a loft, a sunroom, a den, a garden. The moments are a weekend shoot, Thursday practice, critique day, Saturday lessons, a school fair. Nobody writes a book, edits a film, reads a long article or keeps a plan for a school night.
- **What is not there.** No maker is a teenager who writes songs, no maker is a grandparent with a child at the workbench, and nobody keeps notes as plain files for a long project.

## 2. How the ten differ

| # | App, service | Room, anchor | Moment | Who acts, who is helped |
|---|---|---|---|---|
| US1 | Logseq, Notion | `office`, `desk` | First week of November, before the house wakes | Marit (47) writes a novel |
| US2 | Memos, Apple Notes | `bedroom`, `music` | Sunday evening before the school week | Ioan (17) writes lyrics |
| US3 | Readeck, Instapaper | `living`, `couch` | A January afternoon | Samina (52) reads a technique with her hands busy |
| US4 | Koodo Reader, Kindle | `garage`, `room` | A February Sunday | Gustavo (68) and Amara (9) at the railway board |
| US5 | Blockbench, Autodesk Maya | `patio`, `patio-seat` | A May evening | Rhiannon (31) builds figures for a board game |
| US6 | Collabora Online, Microsoft Office | `dining`, `dining-table` | The weekend before a ninetieth birthday | Dagny (61) and Stellan (30) edit; Bettina (88) proofs |
| US7 | OpenCut, CapCut | `kids`, `desk` | A July afternoon of school holiday | Ezra (13) cuts a clay film |
| US8 | copyparty, Dropbox | `living`, `music` | A Tuesday after supper | Kofi (19) and Anneke (22) play back a take |
| US9 | Photoview, Google Photos | `garden`, `garden` | First Saturday of May, after the dawn hour | Rajiv (44) culls raw files |
| US10 | Super Productivity, Todoist | `kids`, `music` | School evenings in October | Tavita (14) plans her violin practice |

Place fit. US1, US2, US3, US7 and US10 need only rooms an apartment has. US4 needs a garage, US5 a patio, US9 a garden: houses only. US6 and US8 need a dining table and a shelf and fit either.

## 3. Ten user stories

Format: "As a maker, I want <job> so that <outcome>." Each story is tied to one catalog app and one registry service, with the honest caveat, a one-line moment and the first sentence a visitor would read (20 words or fewer, sentence case, no dash, no exclamation mark; the service is named only as the old place). The chip pair is the app name, then "alternative to <Service>". Rooms and anchors are the closed sets of `schema/family.schema.json` and `roles.json`.

**US1. Logseq, Notion.** As a maker, I want a page for each day's writing and a page for each character, kept as plain files, so that a book written in the margins of a working week does not sit in a workspace I cannot open.
- Who and when: Marit (47, payroll clerk and parent), the first week of November, before the house wakes.
- App `logseq`. Service `notion`. Caveat: no importer from Notion is claimed; she copies across only the pages she wants. The chapters stay in her word processor and Logseq holds the notes. The pages are Markdown files. The Core is not a backup. A household keeps one notes app, and Logseq is not on the validator's list of that kind yet, so the check will not warn; keep one by hand.
- Moment: `office` room, anchor `desk` (fallback `room@office`). The first thing: she writes the day's target on a sticky note by hand, then opens today's page.
- First sentence: "Her novel's notes lived in a Notion workspace; Logseq keeps each day's page as a Markdown file on the Core." (20 words)
- Why it differs: a long project told as a daily habit, in a month, by a writer; no shipped maker writes.
- Check: QA screenshot yes; fleet use 0.

**US2. Memos, Apple Notes.** As a maker, I want to catch a half-line the moment it comes, so that a lyric started on Tuesday is still there on Sunday when I sit down at the keyboard.
- Who and when: Ioan (17, sixth-form student), Sunday evening before the school week.
- App `memos`. Service `apple-notes`. Caveat: Memos keeps text notes in Markdown; it holds no audio and no tune, and the take stays where it was recorded. A household keeps one notes app (Memos, Obsidian, Joplin Server). Use the browser on the home Wi-Fi; no claim about syncing between devices.
- Moment: `bedroom` room, anchor `music` (fallback `desk`, `room@bedroom`). The first thing: he plays the four chords under the line twice, then types it.
- First sentence: "The lyric scraps sat in Apple Notes on one phone; Memos keeps them as Markdown on the Core." (18 words)
- Why it differs: a teenager who is the maker, not the helped one; the night before school; a text note, not a library.
- Check: QA screenshot yes; fleet use 1 (a learner's note, paired with Google Keep).

**US3. Readeck, Instapaper.** As a maker, I want the long article on a technique saved where I can read it with my hands busy, so that the one explanation I needed is on the couch with me and not lost in a queue.
- Who and when: Samina (52, postal worker and knitter), a January Sunday afternoon.
- App `readeck`. Service `instapaper`. Caveat: Readeck saves an article when told to, so the internet is needed at that moment; the saved article is for her own reading and nothing is shared. No importer from an Instapaper account is claimed. A household keeps one reader (Readeck, Miniflux, Linkwarden, Karakeep).
- Moment: `living` room, anchor `couch` (fallback `room@living`). The first thing: she winds the ball of wool, then saves the page on the tablet before the needles come out.
- First sentence: "The long reads sat in an Instapaper queue; Readeck holds what she picks on the Core, ready for the couch." (20 words)
- Why it differs: research for a craft, read with the hands busy; a quiet winter hour; the learner's app pool lists it and no family uses it yet.
- Check: QA screenshot yes; fleet use 0.

**US4. Koodo Reader, Kindle.** As a maker, I want my railway modelling books open in one reader on the workbench, so that the page with the signal diagram is where I put it down.
- Who and when: Gustavo (68, retired signalman) with his granddaughter Amara (9), a February Sunday.
- App `koodo-reader`. Service `kindle`. Caveat: Koodo Reader opens the ebook files the family holds; no Kindle library moves across and no importer is claimed. Its read-aloud feature is a reader feature, and Amara (9) uses no chat model or agent. A household keeps one books app (Calibre-Web, BookLore, Koodo Reader, Komga).
- Moment: `garage` room, anchor `room` (fallback `desk`). The first thing: Amara props the tablet against the edge of the layout board and Gustavo picks the page.
- First sentence: "The railway books sat in a Kindle app; Koodo Reader opens the files he holds from the Core." (18 words)
- Why it differs: a grandparent and a child at a workbench, in the garage; the maker's reference shelf, not their output. The garage is not in the maker row today.
- Check: QA screenshot yes; fleet use 8 (mostly learners' reading beats).

**US5. Blockbench, Autodesk Maya.** As a maker, I want to build the figures for my board game as low-poly blocks, so that the prototype's characters exist before the artwork is final.
- Who and when: Rhiannon (31, land surveyor), a May evening on the patio.
- App `blockbench`. Service `autodesk-maya`. Caveat: Blockbench makes low-poly models in a browser tab and is not a replacement for Maya; no rigging or rendering pipeline is claimed. She saves the file herself; confirm where the Hub package saves before shooting. Blockbench already has three beats (Mateo's dragon and two gamers'); place this where the family has none.
- Moment: `patio` room, anchor `patio-seat` (fallback `garden`). The first thing: she cuts the cardboard base for the first figure, then models its twin in the editor.
- First sentence: "Her figures started in Maya at college; Blockbench builds them in a tab, and the files sit on the Core." (20 words)
- Why it differs: an adult hobbyist who made things at college and picked it up again; a game, not a drawing; the patio in the evening light.
- Check: QA screenshot yes; fleet use 3 (one maker, two gamers).

**US6. Collabora Online, Microsoft Office.** As a maker, I want two of us to edit one booklet at the same time, so that her ninety years go into one file and we stop sending copies.
- Who and when: Dagny (61, school secretary) and her son Stellan (30) edit; Dagny's mother Bettina (88) proofs. A Saturday in October, the weekend before the birthday.
- App `collabora-online`. Service `microsoft-office`. Caveat: both editors are on the home Wi-Fi and no outside collaborator can open it; the print route (a PDF export or the home printer) is to be confirmed before shooting. A household keeps one office suite (LibreOffice, ONLYOFFICE, Collabora Online). Bettina reads the printed proof with a pen and uses no screen.
- Moment: `dining` room (the row's fallback), anchor `dining-table` (outside the row's anchors). The first thing: Bettina reads the printed first page aloud and corrects a date with a pen; only then do the other two open the file.
- First sentence: "The booklet sat in a Microsoft Office file on one laptop; Collabora Online keeps one copy on the Core." (19 words)
- Why it differs: three generations at one table, the oldest as the proofreader and not the helped one; a printed object at the end; a family history, not an archive.
- Check: QA screenshot yes; fleet use 0.

**US7. OpenCut, CapCut.** As a maker, I want to cut my clay film at home from the clips on the Core, so that the film I made does not live inside an app.
- Who and when: Ezra (13), a July afternoon in the school holidays.
- App `opencut`. Service `capcut`. Caveat: OpenCut edits video in a browser tab; the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json` (`app-qa-screenshot`). Edits stay in the tab until exported, to be confirmed. No effects pack and no AI feature is claimed. Ezra is under 16 and uses no chat model or agent.
- Moment: `kids` room, anchor `desk` (fallback `room@kids`). The first thing: he sets the clay figure on the desk for one last frame, then opens the editor.
- First sentence: "The clay film sat in a CapCut project on a phone; OpenCut edits the clips from the Core." (18 words)
- Why it differs: a child's project with a real beginning and end, in the summer holidays; video, which no shipped maker edits.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US8. copyparty, Dropbox.** As a maker, I want the week's rehearsal takes in one folder we can both play back, so that Thursday's best version is the one we both listen to.
- Who and when: Kofi (19, apprentice electrician) and his sister Anneke (22, lab technician), a Tuesday after supper; their band is the two of them.
- App `copyparty`. Service `dropbox`. Caveat: copyparty is a file server with a media player in the browser; both play on the home Wi-Fi and no outside bandmate can open it. The Core is not a backup, so the recorder keeps the originals. The catalog marks it with-caveat and lists no caveat text; read the listing again before shooting.
- Moment: `living` room, anchor `music` (fallback `desk`). The first thing: Kofi drags the take into the folder, then Anneke plays it back from the tablet on the shelf.
- First sentence: "Rehearsal takes went round in a Dropbox folder; copyparty keeps them on the Core and plays them in a browser." (20 words)
- Why it differs: two adult siblings making something together, in the evening; the file is audio, handed between two devices, not sorted.
- Check: QA screenshot yes; fleet use 0.

**US9. Photoview, Google Photos.** As a maker, I want the raw files from the morning's birds listed from the folder they sit in, so that I choose the keepers without importing anything twice.
- Who and when: Rajiv (44, electrician), the first Saturday of May, after the dawn hour at the feeder.
- App `photoview`. Service `google-photos`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. Photoview lists files already on disk; it does not edit or move them. Leave the map token off, as the listing advises, and show no share links, because outside reach is not claimed. Not a backup. A household keeps one album app (Photoview, PhotoPrism, LibrePhotos, Immich, Foldergram).
- Moment: `garden` room, anchor `garden` (fallback `patio-seat`). The first thing: he swaps the card into the reader on the garden table and puts the kettle on before anything opens.
- First sentence: "His raw files sat in Google Photos; Photoview lists them straight from a folder on the Core." (17 words)
- Why it differs: raw files already on disk, so no import; the garden at dawn; an electrician who photographs birds, with no sorting library at all.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US10. Super Productivity, Todoist.** As a maker, I want my practice plan and timer in one place, so that scales and the new piece are blocks I can see before I pick up the violin.
- Who and when: Tavita (14, school orchestra), weekday evenings in October.
- App `super-productivity`. Service `todoist`. Caveat: a plan and a timer; no claim that it improves practice or measures progress, and no teacher can see it (sharing is not claimed). The plan is hers, a tool for her routine and not a way to watch her. A household keeps one tasks app (Super Productivity, Vikunja, Yuvomi, HomeHub). Tavita is under 16 and uses no chat model or agent.
- Moment: `kids` room, anchor `music` (fallback `desk`). The first thing: she sets the music stand and writes the order of three pieces on a card, then enters them as blocks.
- First sentence: "Her practice plan lived in Todoist on a phone; Super Productivity keeps the day's blocks and timer on the Core." (20 words)
- Why it differs: a child who plans her own making, on a school night, with a timer; the plan is the story, not a library.
- Check: QA screenshot yes; fleet use 0.

## 4. Boundaries these stories keep

- **Make, never generate.** No story has a prompt box, an image or a song that a model made. Nothing here uses a chat model or an agent; the age rule of 16 therefore never bites, and the three people under 16 (Amara, Ezra, Tavita) use tools that are not chat apps.
- **Regulated words.** None of the ten touches health, legal, finance, children's records or education records. Amara, Ezra and Tavita are named only as makers; no claim is made about children's data beyond where the files sit.
- **The old places.** A service is named only as the old place and in the chip "alternative to <Service>". No sentence says what a company does, charges, learns or watches.
- **One household, one Core.** No story says who can open what. Everything happens on the home Wi-Fi; no story reaches the Core from outside.
- **The honest caveats that ride along on every story:** Companion OS is in beta; installing apps uses the internet; the Core is not a backup; no price, no saving, no time saved, no speed.

## 5. Open items for the owner

- **Owner entries in `reviewed.json`** (rule `app-qa-screenshot`) are needed before a beat can use OpenCut (US7) or Photoview (US9). The other eight apps have a QA screenshot.
- **Rooms outside the row.** The `maker` row lists `office`, `living`, `bedroom`, `kids`, `garden`, `patio` (fallback `dining`). US4 uses `garage`; US6 uses `dining` as its main room; the anchors `room`, `dining-table` and `patio-seat` are valid role ids but not in the row's anchor list. If the stories are cast, widen the row or let the cast plan carry the exception.
- **Household kinds.** In `HOUSEHOLD_KINDS`, Memos is a notes app, Readeck a reader, Koodo Reader a books app, Photoview an album and Super Productivity a tasks app: one of each per household. Logseq is not in the notes-app list, and Collabora Online, OpenCut, copyparty and Blockbench are in no list; adding Logseq next to Memos and Obsidian would let the check warn when a family has two.
- **Fleet headroom.** Koodo Reader already has eight beats and Blockbench three; place US4 and US5 where those apps are not already in the family. Readeck, Logseq, Collabora Online, OpenCut, copyparty, Photoview and Super Productivity have none; Memos has one.
- **Registry check, 2026-10-20.** Each of the ten pairs is listed in `services.json` (service with no flag, `alternativeToForm` ok, `storyStatus` ok, the app under its `storyApps`) and in `catalog-apps.json` (in the live store, `storySafe` yes except OpenCut and copyparty, which are with-caveat; none avoid, none tagged as a chat app). No pair is used by any of the 30 family files. The first sentences were checked against the error-severity banned phrases of `claims.json`.
