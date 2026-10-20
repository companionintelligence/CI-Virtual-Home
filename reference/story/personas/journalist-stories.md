# Journalist: ten more user stories (`journalist`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.13 of [persona-bible.md](../persona-bible.md) and the `journalist` row of `content/story/personas.json`. Nobody here is a customer: ages, households, roles and lines are design choices for fictional characters. Companion OS, Companion Memory and Companion Agents are in beta. The law for every word is `content/story/claims.json`.

**What this file is for.** The chapter shows the interview day: the recording turned into text (Whisper-WebUI), the notes (Obsidian), the records (Paperless-ngx), the model that finds the page (Open WebUI), Nextcloud, a PDF tool and a translator. These ten stories leave that ground. They are about the rest of a working writer's week: the morning list, the page that changes overnight, the spreadsheet that arrives, the structure of a long piece, the voice-over, the listening back, the borrowed kit, the pitch board, the Sunday read and the photo from the records office. Each is tied to a catalog app and a registry service that the chapter does not use.

**What the work is, and is not.** The reporter keeps a promise to sources that outlives the story, and answers to an editor. The Core is where the reporter's own files live at home. It is not a vault: no story implies protection from a search, a seizure or a leak, and none shows police, a hooded figure, a press card or an outlet logo. Signal, WhatsApp and iMessage do not move to the Core, and the sources choose the channel. Remote access is not claimed: every scene is on the home network. A model is not used here at all; if the owner wants another model story, use the chapter's rule (one bounded chore on the reporter's own material, checked by hand, never anything with a byline).

## 1. What the chapter and the families already show

**The chapter (3.13).** Top apps: Whisper-WebUI, Paperless-ngx, Obsidian, Open WebUI, Nextcloud, Stirling-PDF, LibreTranslate. Services named: Evernote, Google Drive, Notion, ChatGPT, Claude, Dropbox, Adobe Acrobat, Smallpdf, Google Translate, DeepL. "Uses now" also names Trello, Scrivener, Otter, Trint, Rev and Pocket. Homes: Lake Cabin (Study and Glass Prow), City One-Bedroom (Desk Nook), Two-Bedroom Flat (Study Alcove).

**The thirty current families (read 2026-10-20).** No member of any family has the `journalist` archetype (`casting.json` has none), so the pool shows up only through other people's beats. How often each pool app already appears in the thirty families:

| App in the journalist pool | Families | | App in the journalist pool | Families |
|---|---|---|---|---|
| Paperless-ngx | 15 | | Companion Memory | 3 |
| VaultWarden | 12 | | Linkwarden | 1 |
| LibreTranslate | 12 | | Whisper-WebUI | 0 |
| Obsidian | 11 | | Cryptgeon | 0 |
| Nextcloud | 11 | | AnythingLLM | 0 |
| Open WebUI | 8 | | Miniflux | 0 |
| LibreOffice | 7 | | Element | 0 |
| Joplin | 5 | | Stirling-PDF | 5 |

Paperless-ngx, VaultWarden, LibreTranslate, Obsidian and Nextcloud are at or over the fleet cap (12 of 30 families, 14 of 36), so none of them is in a pair below. Seven of the ten apps are in no family or one family today; AudioMass (3), PairDrop (2) and Audiobookshelf (7) are reuses of the app, and each of their pairs already appears in one or two families (PairDrop with AirDrop in two), so keep stories 5, 6 and 10 behind the others.

## 2. How the ten differ

| # | Room, anchor | When | Who is there | App (families) | Service (families) |
|---|---|---|---|---|---|
| 1 | `dining`, `dining-table` | The morning of a council meeting, at breakfast | The reporter alone | Miniflux (0) | Feedly (0) |
| 2 | `office`, `desk` | The evening before a page is reworded | The reporter alone | Linkwarden (1) | Raindrop.io (1) |
| 3 | `dining`, `dining-table` | The week a records response arrives | A flatmate who reads totals aloud | Grist (1) | Airtable (1) |
| 4 | `living`, `tv` | A Sunday, a long piece to structure | A sixteen-year-old, the first reader | tldraw (1) | Mural (0) |
| 5 | `bedroom`, `room` | Late evening, the voice-over night | A partner waiting outside the door | AudioMass (3) | TwistedWave (1) |
| 6 | `kitchen`, `counter` | A weeknight, supper on the stove | The house, which hears the pan and not the tape | Audiobookshelf (7) | Apple Podcasts (1) |
| 7 | `office`, `bookshelf` | The morning borrowed kit comes back | An adult child who borrowed the spare recorder | HomeBox (0) | Sortly (0) |
| 8 | `kitchen`, `fridge` | A Sunday, pitch day | A partner who also freelances | Jotty (0) | Trello (2) |
| 9 | `living`, `couch` | A Sunday morning | A retired editor reading the same piece in print | Readeck (0) | Instapaper (0) |
| 10 | `kitchen`, `kitchen-island` | Back from the records office, coat still on | The reporter alone | PairDrop (2) | AirDrop (2) |

Nine different room and anchor pairs, ten different moments and five kinds of person beside the reporter (a flatmate, a teen, a partner, an adult child, a retired editor). Nobody under sixteen uses a chat model or an agent; none of the ten is a chat or agent app, and the one minor in the file is sixteen and reads a board.

## 3. Ten user stories

Format: "As a journalist, I want <job> so that <outcome>". Each is tied to one catalog app (`id`) and one registry service (`id`), with the honest caveat from the catalog and a one-line moment. The chip pair today is the app name, then "replaces <Service>"; prose says "an alternative to". The first sentence is what a visitor reads: sentence case, at most 20 words, no digit, no dash, no exclamation mark, and no company named in the sentence (the chip names it). `{name}` is the member's first name from the cast, so no pronoun implies a gender.

**US1. Miniflux, Feedly.** As a journalist, I want the pages I follow gathered into one list each morning, so that the day starts from the list I chose and not from a row of open tabs.
- App `miniflux`. Service `feedly`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; it overlaps FreshRSS, so a household has one feed reader; it lists the pages the reporter chose and ranks, summarises and flags nothing; an item is a lead to check, never a source.
- Moment: `dining` room, anchor `dining-table` (fallbacks `kitchen-island`, `desk@office`). The first thing: the council's agenda page is the top item, and the reporter writes its date in the paper notebook before reading on.
- First sentence: "A morning of open tabs becomes one list; Miniflux gathers the feeds {name} follows on the Core."

**US2. Linkwarden, Raindrop.io.** As a journalist, I want a page saved as it looked today, with a PDF and a screenshot, so that when an editor asks what it said on Tuesday I can open the copy and not guess.
- App `linkwarden`. Service `raindrop-io`. Caveat: it keeps what the page showed to this Core at the time of saving; it is not proof, not an official copy and not a record anywhere else; a page behind a sign-in or a paywall is whatever the browser could see; it saves link rot, nothing more.
- Moment: `office` room, anchor `desk` (fallbacks `dining-table`, `room@office`). The first thing: a press release is open on the screen, the save button is pressed, and the reporter writes the date and time on the notebook page beside the web address.
- First sentence: "A page can change overnight; Linkwarden saves how it looked as a PDF and a screenshot on the Core."

**US3. Grist, Airtable.** As a journalist, I want a records response that arrives as a large spreadsheet sorted and added up with the working in view, so that every figure I print can be traced to a cell.
- App `grist`. Service `airtable`. Caveat: a spreadsheet and database stored as one file that can be copied; the formulas stay visible beside the figures, which is the point; no claim that a total is correct, so the reporter checks it against the paper and against the response's own totals; no name of a person readable on screen.
- Moment: `dining` room, anchor `dining-table` (fallbacks `desk@office`, `room@dining`). The first thing: a flatmate reads totals aloud from the printed response while the reporter ticks each against the screen with a pencil.
- First sentence: "A records response arrives as one big spreadsheet; Grist adds it up on the Core with the working in view."

**US4. tldraw, Mural.** As a journalist, I want the shape of a long piece laid out as cards on one big canvas, so that a reader who does not know the story can show me where it loses them.
- App `tldraw`. Service `mural`. Caveat: a canvas for the reporter's own structure; it overlaps Excalidraw, so a household has one whiteboard app; no sharing or live co-editing with an editor is claimed; the cards hold no source's name.
- Moment: `living` room, anchor `tv` (fallbacks `couch`, `room@living`). The first thing: a sixteen-year-old reads the cards on the wall screen from left to right and puts a finger on the card where the thread breaks; the teen reads, does not use a chat model, and writes nothing.
- First sentence: "{name} lays out a long feature on a wall of index cards; tldraw keeps the layout on the Core."

**US5. AudioMass, TwistedWave.** As a journalist, I want to cut one quote out of a long tape for the audio piece, so that the clip is exactly what was said and the whole tape stays as it was.
- App `audiomass`. Service `twistedwave`. Caveat: cut, fade, normalise and export in a browser tab; the cut is made on a copy and the original recording is left alone; it does not transcribe, and the quote is still checked against the audio by ear; no word about sound quality.
- Moment: `bedroom` room, anchor `room` (fallback `desk@office`). The first thing: the reporter sits in a wardrobe doorway with headphones on while a partner waits outside the door; the clip's name is typed from the notebook, and the original file is left in its folder.
- First sentence: "AudioMass cuts one quote from a long tape on the Core; the whole tape stays as it was."

**US6. Audiobookshelf, Apple Podcasts.** As a journalist, I want a long recording to remember where I stopped, so that I can listen back in the kitchen without hunting for the place I left off.
- App `audiobookshelf`. Service `apple-podcasts`. Caveat: it plays audio files the household holds; no podcast subscription import is claimed; the place is remembered for each listener and no word is said about who can open what; the reporter listens on headphones, so the rest of the house hears the pan and not the source. The app sits in seven families, so reserve this behind apps with fewer.
- Moment: `kitchen` room, anchor `counter` (fallbacks `kitchen-island`, `couch@living`). The first thing: the headphones go on, the file opens at the place it was left, and a pencil marks the time on a paper pad.
- First sentence: "A long tape plays on headphones in the kitchen, and Audiobookshelf remembers where the listener stopped."

**US7. HomeBox, Sortly.** As a journalist, I want a list of the recorder, microphones and cables with where each is kept, so that the kit that went out with someone comes back to the shelf it belongs on.
- App `homebox`. Service `sortly`. Caveat: no recorded QA run, so a beat needs an owner entry in `reviewed.json`; barcode and product lookups call outside services, so the beat does not use them; a catalogue and a place, nothing about value, insurance or warranty.
- Moment: `office` room, anchor `bookshelf` (fallbacks `desk`, `room@office`). The first thing: an adult child who borrowed the spare recorder puts it back on the shelf, and the label on its box is read aloud and ticked in the list.
- First sentence: "The recorder's spare cable is somewhere in the house; HomeBox lists where each piece of kit is kept."

**US8. Jotty, Trello.** As a journalist, I want my pitches on a board with a column for each stage, so that Sunday's decision about what to pitch next is made from the board and not from a memory of it.
- App `jotty`. Service `trello`. Caveat: lightweight lists and boards; sharing is not claimed, and the board is the household's one board app; stages are the reporter's own words (pitched, commissioned, filed); no outlet name or logo, no editor's name and no real byline appears.
- Moment: `kitchen` room, anchor `fridge` (fallbacks `kitchen-island`, `counter`). The first thing: two freelancers in the house move paper cards across the fridge door, and the same columns are typed into the board.
- First sentence: "Pitches sat on a card board in a rented account; Jotty keeps the same columns on the Core."

**US9. Readeck, Instapaper.** As a journalist, I want the long reads I put aside through the week waiting for me on Sunday, so that reading is a morning on the couch and not a scramble between jobs.
- App `readeck`. Service `instapaper`. Caveat: it saves articles to read later and keeps the saved text on the Core; what it saves is what the page served at the time; it is not an archive (US2 is the page-copy story, and a household takes one of the two); no recommendation or summary is claimed.
- Moment: `living` room, anchor `couch` (fallbacks `bookshelf`, `room@living`). The first thing: a retired editor reads the same piece in print, pencil in hand, and the reporter opens the saved copy to follow along.
- First sentence: "{name} saves the long reads for Sunday; Readeck keeps the saved articles on the Core, ready to read."

**US10. PairDrop, AirDrop.** As a journalist, I want a page I photographed at the records office to reach the laptop at once, so that the page is in the working folder before the coat is off.
- App `pairdrop`. Service `airdrop`. Caveat: both devices must be on the home Wi-Fi, so the beat starts at the door and not at the counter; a photographed page is a working copy, never the record; the beat says "phone" and "laptop", names no app for the phone and shows no screen.
- Moment: `kitchen` room, anchor `kitchen-island` (fallbacks `dining-table`, `desk@office`). The first thing: the reporter comes in, puts the phone beside the laptop, and the photo lands in the folder; the paper copy stays in its envelope on the island.
- First sentence: "A records page taken on a phone used to detour through a cloud album; PairDrop sends it across the room."

## 4. Rules these stories keep

- **The tape is checked, the quote is the reporter's.** No story has an app write, decide or check a quote. The chapter's rule stands: one bounded chore, checked by hand, never anything with a byline.
- **No vault.** No story says secure, private, protected, confidential or leak-proof, and none implies that a recording on the Core is out of anyone's reach. The headline is where the file lives.
- **Sources stay off screen.** No name, no outlet, no logo, no press card, no case number and no readable record in a shot. Hands, notebook, headphones, a binder, the Core on a shelf in daylight; eye level, no whip pans.
- **No chat model or agent for anyone under sixteen.** The only minor in this file is sixteen and reads a canvas.
- **Pairs.** All ten are registry pairs, so the 80 percent pair share holds. The pair-less apps (Whisper-WebUI, Companion Memory) stay in the chapter.
- **Gender and role.** The flatmate, the partner, the adult child and the retired editor are not given the role by reflex, and `{name}` carries no pronoun. A fleet that casts these stories should vary who plays each.
- **No UI.** No story describes a screen.

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json` and `personas.json`):

- Every app id is in the catalog, is in the live store and is not `avoid`. Miniflux is `with-caveat`; the other nine are `yes`.
- Every service id is in `services.json` with no flag (not `stale`, `story-excluded`, `ordinary-word` or `renamed`), `alternativeToForm` ok, and the app is in that service's `storyApps` and has the service's name in its own `replaces`.
- No service is used twice in this file and no pair repeats one the chapter shows.
- The ten first sentences are 15 to 20 words each, with no digit, dash or exclamation mark, and no company name.

Open items for the owner:

- **`reviewed.json`.** Miniflux (US1) and HomeBox (US7) have no QA screenshot on `origin/main`; a beat that names either needs an owner entry (`app-qa-screenshot`).
- **Pool.** Eight of the ten apps are not in the `journalist` pool in `personas.json` (`grist`, `tldraw`, `audiomass`, `audiobookshelf`, `homebox`, `jotty`, `readeck`, `pairdrop`). `persona-cover` needs only one pool app in a journalist's beats, so this is not a blocker.
- **Overlaps.** tldraw overlaps Excalidraw (the educator file uses Excalidraw) and Miniflux overlaps FreshRSS; a family takes one of each pair.
- **Reuse.** Audiobookshelf is in seven families; keep US6 as a reserve story unless a family drops it elsewhere.
