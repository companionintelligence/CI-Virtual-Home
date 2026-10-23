# The Archivist (`archivist`)

Draft deep dive for a new, fifteenth archetype. Category: Make and keep (`make`). Nearest existing persona: the Maker (`maker`). Status: draft for the owner's review; nothing here is wired into `personas.json`, the schema, `ARCHETYPES` or the cast plan yet.

The Archivist scans the family's slides, letters and home films and files them where the family's later readers can find them. Nobody here is a customer: ages, places, jobs and lines are design choices for fictional characters. Real-world statements are tagged **[?]** (inference or generalisation, not read from a source for this file); nothing in this file is a statistic. Every app and service id below was checked against `content/story/catalog-apps.json` and `content/story/services.json` (see "Checks run" at the end).

## 0. Why this persona, and how it differs from the Maker

The Maker makes new work and keeps it. The Archivist keeps what cannot be remade: the only print of a wedding, a grandmother's letters, a tape of a voice. That is the strongest keepsake argument for a Core, and it is a different job from a hobby. The Maker's chip is "my work"; the Archivist's is "their things".

What this changes in the rules the Maker already has:

- The Maker is about process and the evening's making. The Archivist is about order, dates, names and the next reader.
- The Maker's words to avoid include "generate" and "prompt". The Archivist's list is longer and tenderer: no "restore", "enhance", "colourise" or "colorize", "animate", "bring to life" or "relive". Nothing in this persona's story changes a picture or a voice. Files are filed and tagged, and the originals stay as they were.
- The Maker may have a creative tool hero (Immich, Navidrome). The Archivist's hero is a plain, boring act: a name written on a folder, a date set on a letter.
- No camera, scanner or capture claim. The family scans or films with whatever it already has. The Core holds the files afterwards. See section 9.

## 1. Who

**A day in the life, in daylight.** It is early afternoon and the light comes in low across the dining table, which has been cleared for the third weekend running. On it are a shoebox of loose prints, two carousels of slides still in their trays, a bundle of letters held with a rubber band that has gone brittle, and a laptop with a flatbed scanner beside it. The Archivist works slowly and says the dates aloud as they write them: the year from the stamp on the border, the street from the back of the card, a name they have to ask someone else about. A phone call to an aunt settles who is standing second from the left. Then the scans go into a folder named for the year, the letters get a tag for who wrote them and who they were written to, and a short note goes beside each box that says what was in it and where the original is now. Before dusk the originals go back into their sleeves and the box goes back on the shelf. The Core on the shelf beside the books holds the files; the shoebox is still the original and nobody has thrown anything out.

**Who they are.** Whoever inherited the shoebox. It might be a retired relative with the time and the patience, an adult sibling who lives nearest, a grandchild who was handed the box at a funeral and did not know how to say no, a couple clearing a late parent's flat, or a sixteen-year-old who is simply the one who asks questions. Ages run from 16 to the eighties and nothing in this persona is assumed by age, gender or culture. The household might be one person, a couple, a family with older children, or three generations under one roof, in a flat, a cottage or a house with a long hallway of framed photographs. They are careful, a little slow on purpose, and sceptical of anything that cannot be backed up or does not say what it did to the file. They keep a list of what has been done and what has not. They do not trust a service that might close, change its terms or lose the order in which they sorted things, because they have seen a drawer of photographs outlive three of those. [?]

## 2. What they are responsible for

- The family's originals: prints, negatives, slides, letters, certificates, home films and tapes. They cannot be remade, so the Archivist's first job is to keep them and the second is to copy them.
- The order of things: which box came from which house, which year, who is in which picture. The order is the work; a pile of scans with no names is half a job.
- Other people's stories. A relative who said the name of the village once, at a funeral. A cassette of a voice. The Archivist is the person who writes down what was said before the person who said it is gone. [?]
- The next reader. A cousin in twenty years who opens a folder and needs to understand it without asking anyone. This is why they name folders plainly and keep notes beside the files.
- A second copy, and a third. They know that one disk is not an archive.
- What not to publish. Some letters are for the family only, and some people in the pictures did not agree to be shown. The Archivist decides and the software does not.

## 3. What they rent today

Named services, with the registry id (`content/story/services.json`). All eleven have no flag, `alternativeToForm: ok` and `storyStatus: ok`. Described by kind of service, not by what a company does to anyone: the story never accuses (claims `incumbent-attack`).

| Registry id | Name | What the Archivist keeps in it | Hub app(s) in the registry |
|---|---|---|---|
| `google-photos` | Google Photos | Scans of prints and slides, uploaded under one relative's account | Immich, LibrePhotos, PhotoPrism, Photoview |
| `icloud-photos` | iCloud Photos | The phone pictures of the last decade, the family's recent history | Immich, LibrePhotos, PhotoPrism |
| `evernote` | Evernote | Transcribed letters, notes about who is who, scans of certificates | Paperless-ngx, Papra, Joplin, Obsidian, Standard Notes |
| `google-drive` | Google Drive | Shared folders of scanned documents, the family tree spreadsheet | Paperless-ngx, Papra, Nextcloud, others |
| `backblaze` | Backblaze | A second copy, for as long as the plan is paid | Duplicati |
| `carbonite` | Carbonite | The same job, on an older machine | Duplicati |
| `instapaper` | Instapaper | Saved pages about the village, the regiment, the shipping line | ArchiveBox, Readeck |
| `google-keep` | Google Keep | Captions typed on a phone at a family table | Memos, Blinko |
| `apple-notes` | Apple Notes | The same, on an Apple phone | Memos, Blinko |
| `plex` | Plex | A media server running on an old laptop, playing the transferred home films | Jellyfin, Emby |
| `spotify` | Spotify | The playlist that sits beside the transferred cassette of a voice | Navidrome, mStream |

Notes for writers.

- Pocket is a replaced service of ArchiveBox in the catalog, but it carries the registry flag `stale`. Do not use it. Instapaper is the pair.
- Netflix and Apple Music are replaced services of Jellyfin and Navidrome. They fit a living-room scene about films and music and are allowed by the registry, but the Archivist's own media is the family's own files, so lead with Plex and Spotify and leave the others out.
- The Archivist almost always rents several of these, small, in a spread that was not planned: one relative's photo account, a note app notebook, a free storage folder, a backup that auto-renews. The story is the spread, not a company.

## 4. What the Hub offers them

Each app is in `catalog-apps.json`, `storySafe: yes`, `inLiveStore: true`. The first chip is the display name exactly; the second is `replaces <X>` with X from the app's own `replaces`. The caveat is the catalog's, paraphrased where the claims lint would stop the original (for example a minute count).

| Catalog id | Display name | What it does for the Archivist | Honest caveat |
|---|---|---|---|
| `immich` | Immich | Keeps the scanned photographs and phone pictures in one library the family holds, by year and place. Replaces Google Photos, iCloud Photos. | Bundles its own database and a machine-learning service, so first start takes a while. Web interface only for agent purposes. It holds a copy; the originals still need their own keeping, so never present the Core as the only copy. Over the fleet cap (19 homes): lead with another photo app when the tour allows. |
| `photoprism` | PhotoPrism | Browses and shares the library with automatic tagging, which the Archivist reviews. Replaces Google Photos, iCloud Photos. | Web interface only for agent purposes. Automatic tags are suggestions; the Archivist writes the real captions. Claims file: pick Immich or PhotoPrism per family, never both in one home. |
| `librephotos` | LibrePhotos | Finds pictures by face, object and place, with albums built by date and location. Replaces Google Photos, iCloud Photos. | First setup takes a while while models and migrations start; give no duration in copy. A face grouped wrongly is the Archivist's to correct. Web interface only. |
| `paperless` | Paperless-ngx | Takes scanned letters, certificates and papers and files and tags them: sender, date, who it concerns. Replaces Evernote, Google Drive. | AI features are off by default; if turned on they can use a local model. Office document conversion is not wired up in this build; scans and PDFs are archived. Say filed and tagged. Do not say the pages become searchable text; do not claim the handwriting is read. Over the fleet cap (17 homes). |
| `papra` | Papra | Archives the papers rarely looked at until the day they are needed: warranty cards, house deeds, receipts, contracts. Replaces Evernote, Google Drive. | None in the catalog. State what it holds and where it sits. No legal or tax statement about what is stored. |
| `duplicati` | Duplicati | Writes a second, encrypted copy of the archive folders to a disk. Replaces Backblaze, Carbonite. | Destinations can be a local disk, a network share or a cloud provider. Name a local disk. A copy is not a guarantee: no "never lose", no "forever". |
| `archivebox` | ArchiveBox | Keeps a copy of the web pages the family history leans on, so the source is still there when the site changes. Replaces Pocket (stale, do not use), Instapaper. | None in the catalog. It keeps what the Archivist asked it to; it does not know which pages matter. |
| `memos` | Memos | Short captions, notes and a journal in Markdown beside the files: who is in the picture, what an uncle said. Replaces Google Keep, Apple Notes. | None in the catalog. A note app: it does not attach to a file or a folder by itself. |
| `jellyfin` | Jellyfin | Plays the family's own transferred films and recordings to the screens in the house. Replaces Plex, Netflix. | Plays your own files. Say that, not "Netflix". Do not say it plays copyrighted material from anywhere. Plays on the home network only (no remote access claim). |
| `navidrome` | Navidrome | Plays the family's own music files and recorded voices to any device in the house. Replaces Spotify, Apple Music. | Files you hold only. Rights belong to someone: the story is a family recording, a cassette, a concert tape the family made, never a catalogue. |

Two further store apps are in the live store and fit the job (`photoview` is story-safe, `ci-photo-time-machine` is story-safe with a caveat), but are left out of this persona's row on purpose:

- `ci-photo-time-machine` (Photo Time Machine). It is a background app with no recorded QA screenshot and a caveat that no speed or hardware claim is allowed. It cannot carry a beat. It may be named, if a writer must, as a background app that the Archivist does not need to look at.
- `photoview` (Photoview). No recorded QA screenshot, and its map view uses a token the family would have to add. Leave it as a fallback for a PhotoPrism beat that needs a second photo app.

Companion Memory (`ci-memory`) is a chat app (`ai: chat`). It is left out of the pool: the persona's whole argument is that the Archivist does the filing and a human reads the result. A family that casts an Archivist with a companion of 16 or older may use it for one named chore (see section 7), never as the hero.

## 5. Where they spend time

Kinds of places and media, not a list of quotes. All **[?]**.

- The dining table on a weekend, and the front room by the window. The shoebox, the flatbed scanner, the label on a folder, a cup of tea going cold.
- The phone call: an older relative, a cousin in the next town, someone who was there. The archivist is often the person who rings.
- Local and family history societies, parish and village halls where people bring their boxes, public library local-studies rooms, a county archive's reading room, the volunteer digitisation days some libraries run.
- Genealogy forums and family trees, which are mostly other people with the same box. The Archivist reads them to learn the order of things and does not publish to them.
- Self-hosting and data-keeping communities that talk about disks, copies and file formats: the kind of forum where a post begins "my drive failed". The Archivist reads these with attention and distrust of anything that cannot be exported.
- The cousin's wedding, the funeral, the reunion: occasions where someone hands over a box.
- Podcasts and radio about memory and family history; documentaries about home film; the library's own guidance on caring for papers. No individual source is quoted here.
- Offline: repair cafes, camera clubs, community scanning days.

What this means for the lander: show hands, labels, sleeves and a folder named for a year, not a screen. The Archivist reads the actual caption and notices a made-up one.

## 6. How they talk

- **Tone.** Unhurried, exact, a little dry, always about the thing in the hand. They describe the object before the app: "a print, 1971, written on the back".
- **Pace.** Slow, like the Maker: 125 to 140 words a minute scripted against the 150 words a minute house voice, which means short sentences and a pause after each date. A full beat of quiet before a name they are not sure of.
- **Sentence length.** 6 to 14 words, none over 20, often a fragment: "Second from the left. Aunt Nell, perhaps."
- **Vocabulary they own.** Print, negative, slide, sleeve, tray, reel, tape, cassette, transfer, caption, date on the back, who is this, fold, foxing, label, folder, year, box. File names. "Original" and "copy".
- **Humour.** Dry, about themselves and the backlog. "The shoebox has been on my list since before the move."
- **What turns them off.** "Memories" (as an ad word), "preserve your memories forever", "never lose a moment", "relive", "bring to life", "cherish", "digital legacy", "unlock", "treasure", "AI-enhanced", "magic". Any promise of permanence. Any suggestion that software knows who is in a picture. Hurry. A tool that does not say what it changed.
- **What they like.** The word "originals". A list of what did not come across. A folder name that makes sense in twenty years. Credit for the person who wrote on the back.
- **Say** "keeps", "files", "tags", "sits on the Core", "the family's copy". Never "private", "secure" or "safe" on their own.

## 7. Comfort with technology and attitude to AI

**Comfort: 2 to 3 out of 5** (needs the steps set out; some are stronger). They install desktop apps and plug in a scanner, run a flatbed's own software, keep a spreadsheet of boxes. Docker, a command line and reading a log are outside the range. The honest range inside the persona:

Comfort is set per person, never by age:

- An Archivist at 2: wants the steps in order and a clear list of what did not import. Could be 17 or 78.
- An Archivist at 3: keeps their own backups and reads about file formats, wants to know exactly where the files sit and how to get them out.
- An Archivist at 4: has set up a media server before; still does not decide for anyone else what is kept.

**Attitude to AI: wary to curious, never proud.** Most Archivists dislike the idea that software would guess who is in a picture or alter a face. A model that restores, colourises, animates or invents is the opposite of the job, and a minority feel real distress at the idea of a synthetic voice of someone who has died. [?] The honest range:

- *Wary.* "I do not want it to decide who this is." Accepts machine labels only if they stay suggestions the person reviews.
- *Curious.* Willing to let a local model sort by place or suggest a tag, reading every result, with the original untouched.
- *Not interested.* No part of this persona needs a model. Paperless-ngx's AI features are off by default.

The rule: AI is a chore-doer, never a maker. Nothing is generated, enhanced or animated. A face grouping or an automatic tag is a suggestion from the library app (Immich, PhotoPrism, LibrePhotos), reviewed by hand. There is no chat app in the Archivist's pool. If a family casts an Archivist aged 16 or older with a companion, one bounded chore on the family's own files is the ceiling (age rule 16, claim `cap-autonomy`: the agent prepares, the person approves).

## 8. Objections and the honest limits

What the Archivist will say, and what the story answers:

- "Is this my backup?" Not on its own. The Core holds a copy and Duplicati writes a second one to a disk; the copies are the Archivist's to check. Keep the originals. Say a disk in the house; do not say a cloud.
- "Does it keep my dates and my albums?" There is an import step for each app, and a list of what did not come across. Ask the app. The story does not promise a clean move.
- "Will it read my grandmother's handwriting?" Not claimed. Paperless-ngx files and tags the scan; the Archivist writes who and when. Say filed and tagged, never "searchable text".
- "Who is in this picture?" The Archivist knows. A library app may suggest a face or a place; the suggestion can be wrong and is theirs to correct.
- "Can my cousin overseas open it?" No remote-access claim (`cap-remote-access`). Set every scene on the home network. The family copy lives in the house; a cousin visits, or is sent a file the usual way.
- "What happens to it when I am gone?" There is no inheritance, succession or handover feature, and the story says nothing about one. What is true is only that the files are in ordinary folders that a later reader can open.
- "Can it make the old film sharper?" No. Nothing is restored or enhanced. Jellyfin plays the file as it is.
- "Will it scan for me?" No. The Core does not scan, film or capture. The family does that with its own scanner or phone, and the Core holds the result.
- "Is it a vault?" No. Say where the files sit. Never "secure", "safe", "protected" or "forever".

Limits that must ride along (the persona's own):

1. The Core is never presented as the only copy. A disk can fail and a format can age (say it as a plain limit, never as the opening of a scene: `sec-fear`).
2. No scanner or capture claim, no camera claim (`cap-camera-capture`).
3. No remote access, no sharing with someone outside the house.
4. No search over the words on a page. Filed and tagged.
5. Machine labels are suggestions.
6. Installing apps uses the internet.
7. Crash reports from first-party apps go to Companion Intelligence unless switched off. Never write that nothing leaves the Core.

## 9. Claims boundary

What must never be said for this persona. Ids are from `content/story/claims.json`.

| Never | Why | Id |
|---|---|---|
| "Never lose a photo", "forever", "for generations", "always safe", "can't be lost" | Unmeasured permanence, a reliability promise | `cap-uptime`, `f-security-guarantee` |
| "Private", "secure", "protected", "safe" on their own; "nothing leaves the Core"; "off the cloud for good" | Absolute security and privacy wording | `sec-absolute`, `sec-never-leaves` |
| Any compliance, certification or record-keeping-standard word (GDPR, FERPA, "compliant", "certified", "audited") | No compliance claim | `sec-compliance` |
| "Searchable" or "readable" for scanned letters or handwriting; "OCR" as a promise | The store listing says it, but `claims.json` treats OCR for scanned PDFs as roadmap (do not show it working); say filed and tagged | `f-box-to-box` |
| "Admissible", "legally binding", "court ready", "proves", "evidence of ownership" about wills, deeds, certificates or contracts | No legal, tax or financial claim | `legal-claims` |
| Medical, memory-care or therapy framing: "helps with dementia", "reminiscence", "healing grief" | No medical claim | `sec-medical` |
| "Protects the family", "keeps your family's history safe" | No safety guarantee | `sec-safety-people` |
| "From anywhere", "from your cousin's house", "while away", "share with relatives abroad" | Remote access is not claimed | `cap-remote-access` |
| "Everyone in the family has their own library", "separate accounts" | One household, one Core | `cap-multi-user` |
| "Records the family", "captures every conversation", "listens to grandma" | No blanket recording; consent explicit or left out | `cap-camera-capture`, `f-surveillance` |
| Any scanner, film transfer or camera capture as a feature of the Core or of Companion Memory | There is no capture claim | `cap-camera-capture` |
| "Own", "owns the apps", "own outright" | Retired claim | `cap-own-apps` |
| "As good as", "better than", "beats" a photo or music service | No parity or superiority claim | `cap-parity` |
| A named service plus a verb about what it does to you (spies, sells, mines, trained on, holds hostage, lies) | No unsourced factual claim about a named company; the chip carries the comparison | `incumbent-attack`, `f-incumbent-claims` |
| "A real family", "a customer", a testimonial, a review, a user count | The families are fiction | `f-testimonial`, `fake-social-proof` |
| Prices, per-month figures, savings, "no subscription" without the qualifier | No price or savings claim | `num-dollar`, `num-savings`, `no-subscription` |
| "Easy", "simple", "in minutes" | Show the steps instead | `buzz-simple-claims`, `num-minutes` |
| Opening on a fire, a flood, a failed disk or a lost box | Empower, do not frighten | `sec-fear` |
| "Restore", "enhance", "colourise", "bring to life", "relive", "animate", "generate", "voice of" a person who has died | Persona rule, not in the lint: nothing is altered, nothing is synthesised | house rule, section 7 |
| Netflix named as what Jellyfin plays; copyrighted films or music "from anywhere" | Plays your own files | Jellyfin caveats |
| A readable photograph, letter, certificate or address in a scene | Scenes show hands, sleeves and labels; no readable family content or real address | `fake-photo`, `fake-address-real` |

**The regulated-domain rule.** Certificates of birth, marriage and death, wills, deeds, adoption papers, medical letters, school reports and records of children are all things an Archivist files. Write them without any compliance, certification or security guarantee and without advice. Say only what the app does and where the files sit: "The certificates are filed in Paperless-ngx on the Core." Never what the document proves, whether it is valid, how long to keep it or who may see it. Children's pictures are children's data: show them as a household's own prints, not as a service for children, and never "child-safe".

**Under 16.** Nobody under 16 uses a chat model or an agent, and none is in this persona's pool. A younger member can be named in a parent-led beat as the one being helped.

## 10. Fit

**Rooms and anchors.** From `content/story/roles.json`.

- **Rooms (real room ids):** `dining` (the table where the box is spread out), `living` (the shelf and the television for the films), `office` (a desk), `bedroom` (a desk or a chair by the window). Fallback rooms: `kitchen` and `garage` (a carton on a shelf, with the anchor `room`).
- **Anchor roles:** `dining-table` (trestle, farmhouse and round tables), `bookshelf` (the shoebox on a shelf, the albums), `desk` (writing desk, laptop beside a flatbed), `music` (record-player, upright or grand piano: the records and the cassettes). Fallbacks: `tv` (the films), `couch`, and then `room`, which resolves everywhere and needs `anchor.room`.
- **Props the engine has:** trestle table, farmhouse table, bookshelf, ladder shelf, writing desk, laptop, record-player, upright piano, tv-stand. **To author, if the owner agrees:** a shoebox, a carousel tray, a flatbed scanner, a bundle of letters, a folder label. Ask only for props that sit without clipping walls (the bible's cinematographer rule 8).

**Homes that suit (proposals; the cast plan decides).** The table is cleared and the shelf is full in homes with a dining room and a bookshelf, and the family sits across generations. From the bible's table of 36:

- Blue Dormer Cottage (`onestory`): a fireside shelf and a kitchen, a household that can span generations.
- Cute Starter Cottage (`cutestarter`): a dining trestle table in a small house.
- Riverbend Drive (`riverbend`): three generations and a record player. The Maker is there already, so the Archivist is a different person in the same house, or the house stays with the Maker.
- Valley-View Villa (`valleyview`): a reading lounge, a couple.
- Garden Flat (`garden-flat`, one of the six apartments in the bible's table; no spec file in `content/houses/` yet): a study and a bedroom with a desk.
- Vanilla House (`vanilla`): a 36 m2 library.
- The Mirage (`mirage`): an upright piano and no desk; the table does the work.
- Twin Gable House (`bghouse-olcia`): a study and a family room with a television.

**Household shapes to cast.** Solo adult; a couple; a couple and one adult child; grandparents with a grandchild; an adult sibling who lives nearest; three generations. The Archivist can be any of the people in these, and the family does not need to be an old one.

**Ages.** 16 and older for this persona. The cast lint (`cast-lint.mts` line 165) lets a child under 13 only be a learner or a maker, so an Archivist under 13 is not allowed without changing that rule. Any adult age, and 16 or older for a younger keeper. The role is never given by age: the person who inherited the box can be 29, 48 or 80.

**Casting warning against stereotype.** The retiree with a shoebox is the lazy reading, and the person most likely to be cast that way is an older woman. Do not do it by default. Cast the Archivist across ages and genders: a man in his forties who took the box at his mother's funeral; a woman of 29 who is the family's only reader of cursive; a seventeen-year-old who ends up the keeper of three households' papers. A disabled person can be the Archivist without it being the story. Do not give the role to the person from a certain culture because it is "traditional" or "has a strong sense of heritage". Pair the Archivist with someone who does not do the filing, and let the one who does not use the Core still end up with something that works for them (the television plays the film).

**The household beside them.** The Archivist works across the archetypes in the family: the Organiser files today's papers, the Maker takes tomorrow's pictures, the Learner reads the letters for a school project. A family must cover at least two archetypes (`personas.md`).

## 11. Ten user stories

Each is tied to one catalog app and one registry service. The caveat is the catalog's. The moment is a line a writer can start from: room, anchor role and what happens first. Names are left out on purpose: the cast gives them.

**US1. Immich and Google Photos.**
As an archivist, I want the scans of the shoebox in one library the family holds, by year and place, so that the cousin who opens it in twenty years can see which house each print came from.
App `immich`; service `google-photos`; chips: Immich, replaces Google Photos. Caveat: first start takes a while; web interface only; the originals still need their own care and the Core is not the only copy.
Moment: `dining`, anchor `dining-table`. The first thing seen is a print turned over and a pencil date copied onto a folder named for the year.

**US2. PhotoPrism and iCloud Photos.**
As an archivist, I want the phone pictures of the last decade browsed beside the scans, with tags I review, so that the old and the recent sit in one place and I decide what each is called.
App `photoprism`; service `icloud-photos`; chips: PhotoPrism, replaces iCloud Photos. Caveat: web interface only; automatic tags are suggestions to review; a home uses Immich (US1) or PhotoPrism, not both.
Moment: `living`, anchor `bookshelf`. A laptop on the arm of a couch; a hand rewrites a suggested tag in the person's own word.

**US3. LibrePhotos and Google Photos.**
As an archivist, I want faces and places grouped into albums by date and location, so that the picture that no one can name is found next to the three others from the same afternoon.
App `librephotos`; service `google-photos`; chips: LibrePhotos, replaces Google Photos. Caveat: first setup takes a while (no duration in copy); a face grouped wrongly is for the person to correct.
Moment: `office`, anchor `desk`. A group of unnamed faces is shown and the person leans forward to write a name that only they know.

**US4. Paperless-ngx and Evernote.**
As an archivist, I want my grandmother's letters filed and tagged by who wrote them and who they were for, so that a later reader finds the whole correspondence in one place.
App `paperless`; service `evernote`; chips: Paperless-ngx, replaces Evernote. Caveat: AI features are off by default; the pages are filed and tagged, not claimed as searchable text; no handwriting claim; over the fleet cap, so use sparingly.
Moment: `office`, anchor `desk`. A bundle of letters, the band taken off, one envelope held to the window to read the postmark before it goes in the scanner.

**US5. Papra and Google Drive.**
As an archivist, I want the warranty cards, the house deeds and the forms nobody reads until they are needed kept in one archive, so that the next person to clear the house finds them without asking.
App `papra`; service `google-drive`; chips: Papra, replaces Google Drive. Caveat: none in the catalog; state what it holds and where, no statement about what any document proves.
Moment: `living`, anchor `bookshelf`. A folder labelled in marker is lifted off a shelf and the label is copied to a name on the Core.

**US6. Duplicati and Backblaze.**
As an archivist, I want a second, encrypted copy of the archive written to a disk in the house, so that the archive does not depend on one disk.
App `duplicati`; service `backblaze`; chips: Duplicati, replaces Backblaze. Caveat: destinations can be a cloud provider, so name a local disk; a copy is not a guarantee.
Moment: `office`, anchor `desk`. A disk is plugged in and its label is written on a strip of tape, the date beside it.

**US7. ArchiveBox and Instapaper.**
As an archivist, I want the web pages the family history rests on kept as copies, so that the village's page is still there after the site changes.
App `archivebox`; service `instapaper`; chips: ArchiveBox, replaces Instapaper. Caveat: none in the catalog; it keeps what the person tells it to keep.
Moment: `bedroom`, anchor `desk`. A page about the old shipping line, open on the laptop at the window; the person pastes its address and moves on to the next.

**US8. Memos and Google Keep.**
As an archivist, I want the short captions and the things an uncle said written down beside the files, so that the name and the story are not only in my head.
App `memos`; service `google-keep`; chips: Memos, replaces Google Keep. Caveat: none in the catalog; Markdown notes, not attached to a file by themselves.
Moment: `dining`, anchor `dining-table`. A relative says a name aloud and the person writes a line, then a second line for the street.

**US9. Jellyfin and Plex.**
As an archivist, I want the transferred home films to play on the television in the living room, so that the family watches them together without anyone starting a laptop.
App `jellyfin`; service `plex`; chips: Jellyfin, replaces Plex. Caveat: plays the family's own files; do not say it plays anything from anywhere; home network only.
Moment: `living`, anchor `tv`. Light from the window across a stand and a screen; a hand puts down the remote and a film starts from the top.

**US10. Navidrome and Spotify.**
As an archivist, I want a cassette of a voice singing and a tape of the wedding band to play to the house like any other song, so that a recording the family made sits next to everything else the family plays.
App `navidrome`; service `spotify`; chips: Navidrome, replaces Spotify. Caveat: files you hold only; the family's own recordings, not a catalogue.
Moment: `living`, anchor `music`. A record-player in the window and a cassette in a hand, the label read aloud before the file is played.

## 12. Six beat seeds

Each is the first sentence a visitor reads: it says what the rented place held, what the family's own copy does instead, in sentence case with no dash. No company is named in a sentence; the chip carries the comparison.

1. **Immich.** The shoebox scans sat in one cousin's photo account; now they sit in the family's own library on the Core, by year.
2. **Paperless-ngx.** Grandmother's letters were notes in a notebook app; now they are filed and tagged in Paperless-ngx, by who wrote them.
3. **Jellyfin.** The home films played from a laptop in the hall; now Jellyfin plays the family's own files to the living room television.
4. **ArchiveBox.** The village history page closed last spring; its copy still opens, kept in ArchiveBox on the Core.
5. **Navidrome.** The wedding band's tape sat in a drawer; now Navidrome plays it from a file the family holds.
6. **Duplicati.** The home films had one copy and a plan with a renewal date; Duplicati writes a second to a disk in the house.

Each seed is a first line and needs "Fictional family. Real software." in the first two seconds, as the contract says. A seed is 25 words or fewer here; the popup body limit is 30 words, the headline six.

## Checks run

A read-only script over the repo's own files confirmed on 2026-10-20: every app id in the row exists in `catalog-apps.json` with `storySafe: yes`; the apps' `replaces` names are in the registry; every service id exists in `services.json` with no `flags`, `alternativeToForm: ok` and `storyStatus: ok`; every room is in the schema's `roomRole` enum; every anchor role is in the schema's `roleId` enum and `roles.json`. `pocket` carries the flag `stale` and is excluded. `kiwix` (avoid) is not used.

## personas.json row

The proposed row for the `archetypes` object in `content/story/personas.json`, the same fields as the existing rows. `example` is a placeholder name to be reserved by `story:cast`, or removed (the Maker has none). The app order puts the apps with fleet headroom first; Immich and Paperless-ngx are over the 40% cap and stay in the pool for the cases where they are the honest app.

```json
"archivist": {
  "label": "Archivist",
  "description": "Scans and files the family's slides, letters and home films, and keeps them where the family's later readers can find them.",
  "example": "Odalys",
  "rooms": ["dining", "living", "office", "bedroom"],
  "fallbackRooms": ["kitchen", "garage"],
  "anchorRoles": ["dining-table", "bookshelf", "desk", "music"],
  "fallbackAnchorRoles": ["tv", "couch", "room"],
  "apps": ["photoprism", "librephotos", "papra", "duplicati", "archivebox", "memos", "navidrome", "jellyfin", "immich", "paperless"]
}
```

Files that would change if the owner adopts the persona (not edited here): `content/story/personas.json`, `content/story/schema/family.schema.json` (`member.archetype` enum), `assets/story/types.ts` (`ARCHETYPES`), `scripts/story/cast-lint.mts` (`POOLS`, and the under-13 rule), `scripts/story/build-casting.mts`, `reference/story/persona-bible.md` and `persona-apps.md`.
