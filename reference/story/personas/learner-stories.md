# Learner: ten more user stories (`learner`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.4 of [persona-bible.md](../persona-bible.md) and the `learner` row of `content/story/personas.json`; it changes no source file. Nobody here is a customer: ages, rooms and lines are design choices for fictional characters, and the first names are working names that the cast plan may replace (none is in `casting.json`, the retired families or on the avoid list). Companion OS, Companion Memory and Companion Agents are in beta. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**What this file is for.** The learner of the chapter is Jean, 14: a student on a school login, with study chores at home and a model on the Core for one named step. The thirty families repeat that picture, and most of them in the same three ways: a child looks something up, a child checks a translation, a child keeps a reading log. These ten stories widen who learns and how: a mother and a child with a library book, a university student on vacation, a sixteen-year-old with a family film, a debate captain choosing her sources, a nine-year-old's reading quest, an adult learner of a language, a seventeen-year-old setting her own quiz, a final-year student citing a page, a bean plant photographed each Saturday and two siblings drawing one village. The learners are 9 to 58. Each uses a catalog app and a registry service that no family beat pairs today.

**Rules that hold in every story** (bible 4.2). Never grades, time saved, "kid-safe", hiding things from parents, a child speaking, slang or a student discount; never a school, exam-board or platform mark; nothing that writes the learner's work. The school platform, flashcard schedulers (there is no Anki or Quizlet in the store) and anything on the move do not move to the Core. Kiwix is `avoid` in the catalog (it ships an empty library): no story uses it. The 15 learner beats in the families that still name Kiwix are a gap that story 1 fills honestly.

**Regulated domain.** Children's data and education records. No story shows or names a mark, a grade, a report, a class list, a safeguarding note or a pupil's work, and none says that anything is allowed under a data rule or safe for a child. They say only what the app does and where the files live. A child appears with an adult nearby, never alone at night, and the faces in a scene are hands and backs. No story gives advice.

**Age rule.** Nobody under sixteen uses a chat model or an agent. Story 7 is the only chat app (AnythingLLM) and its learner is 17. The other nine apps are tools, not chat models: a search box, a note app, a media server, a feed reader, a habit game, a translator, a web archive, a photo library and a whiteboard. Children are the actors in stories 1, 5, 9 and 10 with those tools, and an adult is beside them. Remote access is not claimed: every scene is on the home network.

## 1. What the chapter and the families already show

**The chapter (3.4).** Jean, 14, comfort 2 of 5. Ranked Hub apps: Open WebUI (ChatGPT, Claude), Kiwix (Google Search, Bing), LibreTranslate (Google Translate, DeepL), Obsidian (Notion, Evernote), LibreOffice (Microsoft Office, Google Workspace), JupyterLab. The honest limits: the school platform and flashcard schedulers cannot move, Kiwix installs empty, and a model is "a study helper, not a teacher, and it can be wrong". The shots are hands, not faces, seated eye level, window light, one tight shot on a printed page.

**The pool** (`personas.json`, 12 apps): Open WebUI, Calibre-Web, LibreTranslate, Obsidian, JupyterLab, Spellbook, Koodo Reader, BookLore, Kokoro, Razzia, Readeck and Linkwarden.

**The families** (a count of beats that name an app, read from `content/families/*.json`, 2026-10-20). There are 18 learners in the 30 family files, aged 6 to 20. They have 78 app beats: Kiwix 15, LibreTranslate 12, Obsidian 8, HortusFox 7, Koodo Reader 5, HomeHub 4, Audiobookshelf 3, BookLore 2, Jellyfin 2, JupyterLab 2, Open WebUI 2. The services named: Google Search 15, Google Translate 13, Notion 9, Kindle 7, OurHome 3, Audible 3, Figma 2, Google Keep 2, Lucidchart 2, Apple Books 2. Where they stand: the desk 18, the bed 12, the bookshelf 10, `room` 7, the garden 6, the fridge 5, the toys 4; the chapters sit in the kids' room 30, the bedroom 17, living 11, kitchen 9 and garden 8.

**What that leaves.** A learner who is an adult or a university student, who reads the news, who learns through a film, who is helped to a quiz by a model they set up themselves, who works with a sibling on one canvas or who keeps a photo diary is not in the 78. Neither is a feed reader, a search box that is honest about where it goes, a habit game or a web archive.

## 2. How the ten were chosen

- Each differs in kind: a different room, a different moment of the week or the year, a different person who learns or helps, and a different kind of learning.
- Each is one catalog app (`storySafe` yes, or with-caveat for SearXNG and Miniflux; never `avoid`) with one registry service (no flag, `alternativeToForm` ok, `storyStatus` ok, the app is in the service's `storyApps` and has its name in its own `replaces`). Five of the ten apps are named by no family beat (SearXNG, Logseq, Miniflux, AnythingLLM, ArchiveBox); the other five are named by 1 to 14 beats (Jellyfin 14, Habitica 1, LibreTranslate 13, LibrePhotos 1, Excalidraw 2) but never with the service used here. Six of the ten services are named by no family beat (Netflix, Inoreader, Habitify, DeepL, Instapaper, Mural); the rest by some (Google Search 15, Notion 14, ChatGPT 8, iCloud Photos 1). No pair repeats a pair of any family beat.
- The chip pair of every story is the app's display name, then `alternative to <Service>` (story v3 D5). The first sentence says what a rented tool held or changed and what the Core does instead; no company is named in it and none is accused of anything.
- The one model beat (story 7) carries the chapter's rule: a named study chore the school accepts, the model never writes the learner's work, and it is described as a study helper, not a teacher, that can be wrong.
- The fleet cap is 40% of homes (14 of 36). Open WebUI (17), Kiwix (18) and the photo app Immich (19) are over it; none is used here, and LibrePhotos (story 9) is the photo app with headroom.
- Fresh against the other persona drafts of 2026-10-20 where it could be: six of the ten pairs are in no other draft, and the caveat of each of the other four names the drafts that share it.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first), who learns and who is helped, and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation mark, no figure, no company named).

| # | App and service | Who (working name, age) | Room and anchor | When |
|---|---|---|---|---|
| 1 | SearXNG, alternative to Google Search | Kamal, 11, with his mother Noura, 41 | `kitchen`, `kitchen-island` | Saturday morning |
| 2 | Logseq, alternative to Notion | Hyun-woo, 19, home from university | `office`, `desk` | A weekday in the vacation |
| 3 | Jellyfin, alternative to Netflix | Calla, 16, and her grandfather | `living`, `tv` | Sunday afternoon |
| 4 | Miniflux, alternative to Inoreader | Sigrid, 16, debate captain | `dining`, `dining-table` | Sunday morning |
| 5 | Habitica, alternative to Habitify | Kalinda, 9, with her father Amadou, 43 | `kids`, `bookshelf` | A Wednesday morning in July |
| 6 | LibreTranslate, alternative to DeepL | Gunnar, 58, an evening-class learner | `patio`, `patio-seat` | Wednesday, golden hour |
| 7 | AnythingLLM, alternative to ChatGPT | Hoa, 17 | `bedroom`, `desk` | Saturday afternoon before mock exams |
| 8 | ArchiveBox, alternative to Instapaper | Isolde, 21, a final-year student | `office`, `bookshelf` | A Sunday afternoon in term |
| 9 | LibrePhotos, alternative to iCloud Photos | Jaan, 10, with his aunt Birgit | `garden`, `garden` | A Saturday in May |
| 10 | Excalidraw, alternative to Mural | Maelle, 14, and Teo, 12 | `kids`, `room` | Saturday afternoon |

**1. SearXNG, alternative to Google Search.** As a parent beside a child's question, I want the search to go through the Core and to say honestly where it goes, so that she sees the question travel and chooses the page with him.
- App `searxng`, service `google-search`. Caveat: SearXNG asks outside search engines on the Core's behalf, so the question still leaves the house, sent by the Core. Say "private search", never "offline" (`sec-offline`). It does not make a search anonymous or a result right; no "kid-safe" or filter claim (`sec-safety-people`). The answers are web pages and need an adult's eye. It succeeds Kiwix for the lookup beats (Kiwix is `avoid`). The tech-family draft uses SearXNG with Bing.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `counter`, `dining-table`). Saturday morning. First: a library book on lighthouses open beside the laptop and a question typed in the box.
- Who: Kamal, 11, types; his mother Noura, 41, sits beside him. The child acts with a tool, not a chat model.
- First sentence: "Kamal types his lighthouse question into the family's own search box, and the Core passes it on to outside search engines."
- Popup title: "Where a question goes next".
- Different in kind: a lookup told truthfully rather than as "nothing leaves"; a parent beside the child; the kitchen island.
- Category `kids`.

**2. Logseq, alternative to Notion.** As a university student, I want my course notes as linked pages in plain files, so that a topic opens onto the three lectures that touch it.
- App `logseq`, service `notion`. Caveat: Logseq keeps notes as plain Markdown files. The university's own systems (lecture portal, shared drive) do not move. Never "knowledge base" or "second brain" (the vocabulary rule); no grades or tutoring claim. Notion is named in 14 family beats, always with other apps; the maker draft uses this pair for a journal.
- Moment: `office`, anchor `desk` (fallback `bookshelf`, `room`). A weekday in the vacation, window light. First: a printed reading list with three titles ticked and a stack of notebooks.
- Who: Hyun-woo, 19, home from university for the vacation.
- First sentence: "Hyun-woo writes his course notes as linked pages in Logseq on the Core, and the files stay plain text."
- Popup title: "Notes that link to each other".
- Different in kind: an adult-age student; vacation, not term; the links between notes are the point.
- Category `productivity`.

**3. Jellyfin, alternative to Netflix.** As a student of a language, I want to watch the film my family made in it, so that my homework is my grandfather's voice and not a drill.
- App `jellyfin`, service `netflix`. Caveat: Jellyfin plays the family's own files; say that, and never name the streaming service in prose. Do not say it plays copyrighted material from anywhere. Home network only. The catalog says nothing of subtitle files, so none is claimed. The people on screen are family and agreed. No claim that it helps an exam.
- Moment: `living`, anchor `tv` (fallback `couch`, `room`). Sunday afternoon. First: the screen paused on a face and her grandfather's voice in the room.
- Who: Calla, 16, is learning her grandfather's first language; the family watches the old film together.
- First sentence: "Calla's language homework is a film the family made, played on the living-room screen from the Core."
- Popup title: "Homework is a family film".
- Different in kind: study as a family evening; a grandparent is the source; the whole family, not one desk.
- Category `media`.

**4. Miniflux, alternative to Inoreader.** As a debater, I want to read the sources I chose before the motion, so that Thursday's argument rests on reading and not on a feed that chose for me.
- App `miniflux`, service `inoreader`. Caveat: `with-caveat`; no QA screenshot (owner entry). Miniflux fetches the feeds from the sites themselves, so the Core reaches out. It overlaps FreshRSS: one reader per household. No ranking, summary or "fast" claim. She chooses the sources and reads them; no chat model. The school's debate rules decide the rest. The journalist and marketer drafts use Miniflux with Feedly.
- Moment: `dining`, anchor `dining-table`. Sunday morning. First: five printed headlines in a row, a pencil and a closed laptop.
- Who: Sigrid, 16, captain of the debate team, prepares Thursday's motion.
- First sentence: "Sigrid reads five sources she chose herself before Thursday's debate, in a feed reader on the Core."
- Popup title: "Five sources, chosen herself".
- Different in kind: current affairs, not homework; a teen choosing what to read.
- Category `kids`.

**5. Habitica, alternative to Habitify.** As a parent and a nine-year-old, we want the summer reading to be a quest she ticks off herself, so that the shelf is where the plan is.
- App `habitica`, service `habitify`. Caveat: Habitica turns habits and chores into a game with levels and quests. No claim about reading progress, grades or health. The parent enters the password; the child never uses a chat model. The educator and host drafts use this pair; Habitica is in one family beat (Steve's bin day).
- Moment: `kids`, anchor `bookshelf` (fallback `toys`, `room`). A Wednesday morning in July. First: a row of library books and a hand-drawn quest map taped to the end of the shelf.
- Who: Kalinda, 9, ticks; her father Amadou, 43, sets the quest up and types the password.
- First sentence: "Kalinda's summer reading is a quest now, kept on the Core, and she ticks off each chapter herself."
- Popup title: "The summer reading quest".
- Different in kind: the youngest actor; a parent-led setup; summer break.
- Category `kids`.

**6. LibreTranslate, alternative to DeepL.** As an adult in an evening class, I want to read a letter in the language I am learning first and check the lines I missed, so that I answer the family in their own words.
- App `libretranslate`, service `deepl`. Caveat: LibreTranslate translates text and documents on the Core. Say nothing of quality; it checks, it does not teach. Do not say it works offline (`sec-offline`) or that nothing leaves (`sec-never-leaves`). LibreTranslate is in 13 family beats, mostly children's; the contractor and host drafts use this pair.
- Moment: `patio`, anchor `patio-seat` (fallback `garden`, `deck`, `room`). Wednesday late afternoon, golden light. First: a second-hand grammar book and a mug on the patio table, a pen over a letter.
- Who: Gunnar, 58, learns Portuguese in an evening class so that he can write to his daughter-in-law's mother.
- First sentence: "Gunnar reads his in-law's letter in Portuguese first, then checks the lines he missed on the Core."
- Popup title: "A letter read first, then checked".
- Different in kind: an adult learner; reading, not writing; a letter from family.
- Category `productivity`.

**7. AnythingLLM, alternative to ChatGPT.** As a student before mock exams, I want to be asked questions drawn from my own notes, so that I find the gaps myself and write every answer in my own words.
- App `anything-llm`, service `chatgpt`. Caveat: a study helper, not a teacher, and it can be wrong; she checks each answer against her own notes. It works with local or cloud models: it is set to the model on the Core and the text never mentions a key (`cap-cloud-model`). The listing's "several users and permissions" is not claimed (`cap-multi-user`). The school's own rule on AI decides whether she may. Member sixteen or older (age rule 16). No grades, no "ace your exams", no time saved. Companion OS is in beta. The contractor draft names AnythingLLM with another service.
- Moment: `bedroom`, anchor `desk` (fallback `room`; never a bed for a minor). Saturday afternoon, window light. First: a stack of handwritten notes and a pencil; the laptop stays closed until the notes are sorted.
- Who: Hoa, 17, prepares for mock exams.
- First sentence: "Hoa asks the model on the Core for questions drawn from her own notes, then writes every answer herself."
- Popup title: "She sets the quiz, then answers".
- Different in kind: a model used for retrieval from her own notes, not for answers; she writes everything.
- Category `kids`.

**8. ArchiveBox, alternative to Instapaper.** As a final-year student, I want a copy of each page I cite as I read it, so that the footnote still means something after the site changes.
- App `archivebox`, service `instapaper`. Caveat: ArchiveBox keeps what she tells it to keep; the copy is for her reading and checking, not for republishing. Her university's citation rules decide what she cites and how. Pocket is a catalog replaced name but carries the registry flag `stale`: not used. The marketer draft uses this pair for a campaign page.
- Moment: `office`, anchor `bookshelf` (fallback `desk`). A Sunday afternoon in term. First: library books with coloured flags, and the address of the page she is about to cite pasted in.
- Who: Isolde, 21, writes her dissertation.
- First sentence: "Isolde keeps a copy of each page she cites as she read it, so her footnote still means something after the site changes."
- Popup title: "The page as she read it".
- Different in kind: citation integrity; a final-year student; the shelf as the setting.
- Category `productivity`.

**9. LibrePhotos, alternative to iCloud Photos.** As a child with a science project, I want the weekly photograph of my bean plant lined up by date, so that the growth is a row and not a guess.
- App `librephotos`, service `icloud-photos`. Caveat: first setup takes a while while models and migrations start (give no duration in copy). Albums by date and location; the scene has no faces, only the plant. Web interface only. Immich is over the fleet cap, so this is the photo app with headroom. LibrePhotos is in one family beat (Quintero's dragon).
- Moment: `garden`, anchor `garden` (fallback `patio-seat`, `room`). A Saturday in May. First: a row of pots on a bench and a phone laid beside the tallest.
- Who: Jaan, 10, with his aunt Birgit, who holds the phone and does not choose for him.
- First sentence: "Jaan's science project is a bean plant photographed every Saturday, and LibrePhotos on the Core lines the weeks up."
- Popup title: "The bean diary".
- Different in kind: a photo timeline as evidence; the garden; an aunt, not a parent.
- Category `kids`.

**10. Excalidraw, alternative to Mural.** As two siblings with one project, we want to draw one village on one canvas, so that the streets meet where we each stopped.
- App `excalidraw`, service `mural`. Caveat: Excalidraw overlaps tldraw: one board tool per household. Amd64 only (fine on the Core). Both laptops are on the home Wi-Fi. No chat model or agent (an Excalidraw MCP entry exists for agents: do not use it). The school's own route submits the work. The educator draft names Excalidraw with Miro.
- Moment: `kids`, anchor `room` (fallback `desk`, `toys`). Saturday afternoon. First: two laptops on the carpet and a squared sheet showing a village plan.
- Who: Maelle, 14, and Teo, 12, plan a model village for geography.
- First sentence: "Maelle and Teo draw one village on one canvas, each at their own laptop, and the canvas lives on the Core."
- Popup title: "One village, two laptops".
- Different in kind: siblings working together; a shared canvas; the floor of the kids' room.
- Category `kids`.

## 4. How the ten differ from each other

| Axis | Spread |
|---|---|
| Age of the learner | 9, 10, 11, 12, 14, 16, 16, 17, 19, 21, 58 |
| Who is beside them | a mother, a father, an aunt, a grandfather, a sibling, a debate team, a university, a daughter-in-law's mother |
| Rooms | kitchen, office (twice), living, dining, kids (twice), patio, bedroom, garden |
| Moment | Saturday morning, a vacation weekday, a Sunday film afternoon, Sunday morning, a July Wednesday, golden hour, a Saturday before mocks, a Sunday in term, a Saturday in May, a Saturday afternoon |
| Kind of learning | a lookup, linked notes, a language through film, reading the news, a reading quest, a letter in a second language, a self-set quiz, a cited page, a photo diary, a shared drawing |

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json`, `casting.json`, the 30 family files and the other persona drafts):

- Every app id is in the catalog, is in the live store and is not `avoid`. SearXNG and Miniflux are `with-caveat`; the other eight are `yes`. No app or service repeats inside this file.
- Every service id is in `services.json` with no flag, `alternativeToForm` ok and `storyStatus` ok; the app is in that service's `storyApps` and the service is among the app's own `replaces`.
- No pair appears in any family beat. Six of the ten pairs (stories 1, 3, 4, 7, 9 and 10) are in no other persona draft read on the same day. The other four are also in one to two drafts: Logseq with Notion (maker), Habitica with Habitify (educator, host), LibreTranslate with DeepL (contractor, host) and ArchiveBox with Instapaper (marketer); each caveat says so.
- The ten first sentences are 17 to 23 words, with no digit, dash or exclamation mark, no company name and none of the `claims.json` error patterns.

Open items for the owner:

- **`reviewed.json`.** Miniflux has no QA screenshot on `origin/main`; a beat that names it needs an owner entry (`app-qa-screenshot`). The other nine have a screenshot.
- **Pool.** Only LibreTranslate is in the `learner` row of `personas.json`; `cast-lint.mts` has a wider learner pool that also lists AnythingLLM and Logseq. `persona-cover` needs only one pool app in a learner's beats, so this is not a blocker.
- **Kiwix.** 15 learner beats in the family files still name Kiwix, which the catalog marks `avoid`. Story 1 is the lookup beat that can replace them; the re-cast is the owner's.
- **Casting.** The 18 learners in the families are 6 to 20. Stories 2, 6 and 8 have learners of 19, 58 and 21; nothing in `cast-lint.mts` forbids that, but the member's `role` (adult-child, parent, housemate) and the household type decide who they are in a family. Stories 1, 5, 9 and 10 have children of 9 to 14 who need an adult beside them in the scene.
- **Beyond the home.** The school's platform, the university's systems, the exam board and the debate league are outside what a home Core holds; none is told here.
