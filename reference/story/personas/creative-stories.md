# Creative (`creative`): ten more user stories

Draft written 2026-10-20 for the owner. It widens the stories of an archetype that already exists (`creative`, bible chapter 3.9, `personas.json`, `persona-apps.md`); it changes no source file. Companion OS, Companion Memory and Companion Agents are in beta. Nobody here is a customer: ages, jobs, rooms and lines are design choices for fictional characters. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**One line.** A working designer, photographer, filmmaker, illustrator or musician whose client work, archive and brief are confidential. This file adds the creatives the chapter does not show: the songwriter at the piano, the picture-book illustrator with an editor at the table, the ceramicist before an open studio, the sound designer, the novelist at a signing, the second shooter, the composer with two machines, the studio with a new hire and the game artist.

---

## 1. What the chapter and the stories already show

**The chapter (3.9).** The seven Hub replacements it ranks: Immich (a shoot archive), Nextcloud (the client brief), Penpot (the poster), Inkscape (the logo), Open WebUI (the model reads the brief back), Invoice Ninja (the card-payments limit) and Whisper-WebUI. Its shots are an easel and a closed laptop, proofs on a trestle table, a wall TV tiling a shoot folder. Its triggers are a terms change, a client clause on unreleased material and a failed restore that shows sync is not a backup.

**The pool** (`personas.json`, 15 apps) and `persona-apps.md` add FreeCut, AudioMass, Photoview, Pingvin Share, Syncthing, Navidrome, VaultWarden and Docuseal with say lines. Beats that name each pool app in the 30 family files today (a count of beats, not of homes): Immich 18, Nextcloud 13, Navidrome 13, VaultWarden 12, Open WebUI 8, AudioMass 3, Penpot 2, Inkscape 2, Docuseal 2, Invoice Ninja 1, and none for Whisper-WebUI, FreeCut, Photoview, Pingvin Share and Syncthing.

**The cast.** No member of the 30 family files carries `creative` (`cast-plan.json` and `casting.json` have none), so there is no creative's story to repeat; the closest are the makers, who use Inkscape, Penpot, AudioMass and Immich for their own pleasure. The six apartments are cast later. Every story below is a candidate for the next recast.

**What this file avoids on purpose.** The chapter's pairs (Immich with Google Photos, Nextcloud with Dropbox, Penpot with Figma, Inkscape with Adobe Illustrator, Invoice Ninja with QuickBooks, Open WebUI with ChatGPT) are not used. Only one pool app appears below (Syncthing), in a moment the chapter does not show.

## 2. How the ten were chosen

- Each differs in kind: a different room, a different moment of the week or the year, a different person who acts or is helped, a different discipline of creative work.
- Each is one catalog app (`app.id`, `storySafe` yes or with-caveat, never `avoid`) with one registry service (no flag `stale` or `story-excluded`, `alternativeToForm` not `blocked`). Nine of the ten services have no family using them today (`fleetHomes` is empty); Apple Podcasts is used by one family (Kamau).
- The chip pair for every story is the app's display name, then `alternative to <Service>`. The first sentence names what a rented tool held or changed and what the Core does instead; it never says what a company does to anyone.
- No story needs a chat model or an agent. One story has a 15-year-old as the actor (OpenCut, an editor, not a chat model). Nothing is generative: no picture, no music.
- Nothing is a compliance, safety or legal promise. The Core is not a backup. Remote access is not claimed: every scene is at home on the home network.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first) and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation, no figure, no company named in it).

**1. Memos, alternative to Apple Notes.** As a creative, I want the half line that arrives at the piano written down where it was found so that it does not get lost between a napkin, a phone and a rented notes app.
- App `memos`, service `apple-notes`. Caveat: text notes in Markdown only; no recording, no voice capture and no "remembers everything"; typed on the home Wi-Fi, no phone capture away from home; the Core is not a backup.
- Moment: `living`, anchor `music` (fallback `couch`, `room`). Early Sunday, window light on the keys. First: a line for the chorus becomes a dated note under the song's title.
- Who: the songwriter (mid forties). The note is read later by a co-writer at the same piano.
- First sentence: "The line for the chorus used to land in a rented notes app; now it lands in Memos, on the Core, beside the piano."
- Different in kind: a place (the piano), the quietest hour, a scrap of text instead of a file or a photograph.

**2. tldraw, alternative to Mural.** As a creative, I want every spread of the picture book on one canvas that the editor can point at so that the round of changes happens at the table in one sitting.
- App `tldraw`, service `mural`. Caveat: overlaps Excalidraw, so name one board tool per household; the editor sits at the table and points, a client outside the house cannot open the canvas and there is no live co-editing with them; the canvas is a file on the Core; no AI.
- Moment: `dining`, anchor `dining-table` (fallback `desk`, `couch`). Midweek afternoon, the editor is a visitor, not a member. First: the first spread is dragged beside the last so the editor sees the rhythm of the book.
- Who: the picture-book illustrator (mid thirties) acts; the editor points.
- First sentence: "Every spread of the picture book sat on a rented whiteboard; tldraw keeps the same canvas on the Core, open on the dining table."
- Different in kind: a client at the table (the bible's shot, never a story), a collaborative tool used by one household and one visitor in one room.

**3. draw.io, alternative to Microsoft Visio.** As a creative, I want a floor plan of the open studio so that I know where each plinth and each pot goes before the doors open.
- App `drawio`, service `microsoft-visio`. Caveat: browser diagram tool; say nothing about opening or saving Visio files; the plan is saved to the Core as a file; the open studio is a public weekend but the Core takes no visitors and no one outside sees the plan.
- Moment: `garage`, anchor `room` (room garage; fallback `bookshelf`). Thursday evening before the weekend, the trestle table cleared. First: the garage's outline is drawn at the bench and the first plinth is placed.
- Who: the ceramicist (early fifties) draws; the teenage child (14) calls out the tape measurements. No chat model is involved.
- First sentence: "The floor plan for the open studio lived in a rented diagram tool; draw.io keeps it on the Core, drawn at the garage bench."
- Different in kind: a garage studio, the night before a public event, a child helping with a tape.

**4. Audiobookshelf, alternative to Apple Podcasts.** As a creative, I want the rough cut of an audio drama in a library that remembers where I stopped so that I hear it the way an audience would.
- App `audiobookshelf`, service `apple-podcasts`. Caveat: the person's own audio files only; not a podcast host and no public feed; per-listener progress is the app's own feature and nothing more is claimed; home network only. The service is used by one family (Kamau); the app by seven beats.
- Moment: `bedroom`, anchor `room` (fallback `desk`). A Saturday afternoon with the curtains half drawn, headphones on. First: episode three of the rough cut shows up in the library at last week's stopping place.
- Who: the sound designer (late thirties) acts; the partner listens next, with their own place kept.
- First sentence: "A rented podcast app held the rough cuts; Audiobookshelf plays the same files from the Core and remembers where each listener stopped."
- Different in kind: a bedroom studio, a work-in-progress listen, per-listener progress as a feature, not a family hobby.

**5. Keila, alternative to ConvertKit.** As a creative, I want the names from the signing-table sheet in one reader list so that news of the next book goes to the people who asked for it.
- App `keila`, service `convertkit`. Caveat: Keila needs an outside mail server to send, so say the list is kept here and do not promise delivery or a private send; overlaps Listmonk, so name one newsletter app; no consent or compliance wording; amd64 only (fine on the Core).
- Moment: `dining`, anchor `dining-table` (fallback `desk`, `couch`). Sunday evening after a bookshop signing, the clipboard still on the table. First: the first name on the sheet becomes a row in the list.
- Who: the novelist (mid forties) types; the partner reads the handwriting aloud.
- First sentence: "The reader list sat in a rented mailing tool; Keila holds the same list on the Core, typed in from the signing-table clipboard."
- Different in kind: a paper sheet becoming a list, a partner reading aloud, a signing instead of a client job.

**6. Cryptgeon, alternative to Privnote.** As a creative, I want the gate code for tomorrow's embargoed shoot handed over in a note that opens once so that it does not sit in a message thread afterwards.
- App `cryptgeon`, service `privnote`. Caveat: a one-time note from the app's own listing; someone outside the home network cannot reach the Core, so show the handover in the room, on one laptop; never "secure", "privileged", "encrypted end to end" or "nobody can see it"; whoever opens the note holds the code.
- Moment: `living`, anchor `couch` (fallback `room`). Wednesday morning, the day before an embargoed product shoot. First: the note is made and the second shooter opens it once.
- Who: the photographer's adult child (twenty-three), the second shooter, is the actor; the photographer made the note.
- First sentence: "A message thread kept the shoot's gate code for good; a Cryptgeon note on the Core opens once and is gone."
- Different in kind: the creative's own trigger (an embargo), a young colleague who is also family, a hand-off rather than storage.

**7. OpenCut, alternative to CapCut.** As a creative, I want my child to cut the school film about the studio on a machine at home so that the footage stays on our own laptop.
- App `opencut`, service `capcut`. Caveat: a browser editor; its listing says the footage stays in the browser on the machine used, and nothing more is claimed about where a finished file goes; no formats, no speed, no AI; no QA screenshot, so it needs a `reviewed.json` line before it is shown.
- Moment: `kids`, anchor `desk` (kids-desk; fallback `room`). Saturday morning, the film's sign is propped against the monitor. First: the first clip of the studio sign lands on the timeline.
- Who: the 15-year-old child of the creative is the actor. OpenCut is an editor, not a chat model, so the age rule is met.
- First sentence: "The school film was cut in a rented editor; OpenCut runs from the Core, and the footage stays in the browser on the laptop."
- Different in kind: a child as the actor, a school task, the creative's work seen by a child.

**8. Syncthing, alternative to Resilio Sync.** As a creative, I want the session folder identical on the bedroom laptop and the garage tower so that I mix wherever the light is better.
- App `syncthing`, service `resilio-sync`. Caveat: sync is not a backup, because a deleted file goes from both machines, and the Core is not a backup either; sync across the internet is a remote-access claim, so home network only; no QA screenshot, so it needs a `reviewed.json` line. The bible names the "sync is not backup" trigger; this story states the limit in plain words.
- Moment: `bedroom`, anchor `desk` (fallback `room`). Tuesday afternoon. First: the song's folder appears on the second machine after the first save.
- Who: the composer (early forties).
- First sentence: "The session folder lived on a rented sync service; Syncthing keeps the laptop and the tower in step over the home network."
- Different in kind: two machines in two rooms, a limit stated as the story's honest edge, a pool app in a moment no chapter shows.

**9. Docmost, alternative to Confluence.** As a creative, I want the studio's way of working written down so that a new hire's first Monday starts with pages, not questions.
- App `docmost`, service `confluence`. Caveat: a wiki for the studio's own pages; overlaps BookStack, so one wiki per household; the new hire reads it at the house on the home network; no outside accounts, no permission model, no multi-user promise.
- Moment: `office`, anchor `bookshelf` (fallback `desk`). The first Monday of the month. First: the page "How we name a file" is opened beside the binder of proofs.
- Who: the animation studio's owner (late forties) wrote the pages; the new apprentice (eighteen) reads them.
- First sentence: "The studio's handbook sat in a rented wiki; Docmost keeps the same pages on the Core, ready for the new hire's first Monday."
- Different in kind: onboarding, a person arriving rather than leaving, writing for someone else.

**10. Blockbench, alternative to Autodesk Maya.** As a creative, I want the low-poly fox for the game jam kept as files on the Core so that I can pick it up on Monday.
- App `blockbench`, service `autodesk-maya`. Caveat: low-poly and Minecraft-style models in the browser only; it is not Maya and nothing is said about formats, imports or speed; files are saved where the person chooses.
- Moment: `office`, anchor `desk` (fallback `room`). Friday afternoon of a game jam weekend. First: the fox's body block is rotated for the turntable view.
- Who: the game artist (early thirties).
- First sentence: "A rented modelling package held the fox model; Blockbench keeps the low-poly files on the Core, edited in the browser at the desk."
- Different in kind: a weekend deadline, a discipline the chapter does not name (game art), a model as a file.

## 4. At a glance

| # | App | Alternative to | Room, anchor | Moment | Actor | Beats naming the app today | Family fleet for the service |
|---|---|---|---|---|---|---|---|
| 1 | `memos` | Apple Notes | living, music | early Sunday | songwriter | 1 | 0 |
| 2 | `tldraw` | Mural | dining, dining-table | midweek afternoon | illustrator, editor visits | 1 | 0 |
| 3 | `drawio` | Microsoft Visio | garage, room | night before an open studio | ceramicist, child (14) | 2 | 0 |
| 4 | `audiobookshelf` | Apple Podcasts | bedroom, room | Saturday afternoon | sound designer, partner | 7 | 1 |
| 5 | `keila` | ConvertKit | dining, dining-table | Sunday after a signing | novelist, partner | 0 | 0 |
| 6 | `cryptgeon` | Privnote | living, couch | day before an embargoed shoot | second shooter | 0 | 0 |
| 7 | `opencut` | CapCut | kids, desk | Saturday morning | child (15) | 0 | 0 |
| 8 | `syncthing` | Resilio Sync | bedroom, desk | Tuesday afternoon | composer | 0 | 0 |
| 9 | `docmost` | Confluence | office, bookshelf | first Monday of the month | studio owner, apprentice | 0 | 0 |
| 10 | `blockbench` | Autodesk Maya | office, desk | Friday of a game jam | game artist | 3 | 0 |

## 5. For the owner

- **No recorded QA screenshot** for `opencut` and `syncthing`: each needs a `reviewed.json` line (the `app-qa-screenshot` rule) before a beat shows it. Keila, Docmost, tldraw, draw.io, Audiobookshelf, Cryptgeon, Memos and Blockbench each have one.
- **The pool gate.** `persona-cover` asks every `creative` member for one beat in a pool app. Nine of these ten apps are outside the pool, so a member who gets one of these stories also needs a pool beat (Immich, Penpot, Inkscape and the like). Widening the pool in `personas.json` is the owner's call; this file does not make it.
- **One per household** where the catalog says they overlap: tldraw with Excalidraw (story 2), Keila with Listmonk (5), Docmost with BookStack (9).
- **Rooms.** Stories 4 and 8 use the bedroom, 7 the kids' room and 6 the living room by the couch. The persona-cover room test needs only one beat in a primary room (office, living, bedroom, garage, dining); kids is a fallback room.
- **Left out on purpose:** ComfyUI (a generative picture, against the chapter's rule), Convert and VERT (their services are blocked or absent), Linkstack, Owncast and Hi.Events (they need outside reach), Jellyfin with Netflix (its listing tells writers to say "your own files", not Netflix).

## 6. What was checked

- Every app id is in `catalog-apps.json`, in the live store, `storySafe` yes or with-caveat, none `avoid`, none `ai: chat`.
- Every service id is in `services.json` with `storyStatus` ok, no `stale` or `story-excluded` flag and `alternativeToForm` ok, and the app is listed under that service's `apps`.
- Nine services have an empty `fleetHomes`; Apple Podcasts has one (Kamau). Counts of beats are from `content/families/*.json` on 2026-10-20 and exclude `.bake.json`, `.voice.json` and `films.json`.
- The ten first sentences are 25 words or fewer, with no digit, no dash, no exclamation, no company name and no "replaces". No story names a price, a speed, a compliance word or a remote-access promise.
