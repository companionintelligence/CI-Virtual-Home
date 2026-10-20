# The Collector (`collector`)

Draft deep dive for a fifteenth archetype, written on 2026-10-20 for the front page's Play filter chip. It is a proposal, not yet part of the contract: `personas.md`, `content/story/personas.json`, the schema, `assets/story/types.ts`, `scripts/story/build-casting.mts`, `scripts/story/cast-lint.mts` and `scripts/portal-front.mts` do not know it until the owner adds it (the checklist is at the end). Companion OS, Companion Agents and Companion Memory are in beta.

Shape and depth follow the Gamer chapter of [persona-bible.md](../persona-bible.md) (3.3) and the Gamer table of [persona-apps.md](../persona-apps.md). Nobody here is a customer. Ages, homes, jobs and lines are design choices for fictional characters. Every statement about how collectors live is an editorial synthesis, tagged [?] in the bible's evidence key; no statistic is quoted and none is needed. Home ids are crew-only; print display names.

**One line.** Keeps a library of records, books, comics and films and knows where every one is.

**Why a fifteenth.** The fourteen cover work, study, making and running a house. None of them is a person whose free time is spent reading, listening and watching, and whose proof of care is a catalogue. Play today has one kind of person, the gamer. The collector is the second kind. Six of its eight apps have a "replaces" name from the store's own table, and four of those six (BookLore, Audiobookshelf, Navidrome, Jellyfin) have a QA screenshot, so the persona can lead with apps that have the most headroom in the fleet.

## 1. Who

On a Saturday in late morning the light comes low across the shelf and the collector is already there with a mug, a pencil and a stack from last week's book sale. Some of the stack goes on the shelf. Some of it is a pressing that matches one already owned, and the question that matters is whether to keep both. At the dining table a box of discs sits beside a laptop, and the folder the family holds of the same albums is open next to it, because the collector wants to know which copy is which. In the afternoon the television in the living room plays a film the household has watched most winters, from files they keep, and an audiobook carries on from the chapter someone stopped at the evening before. By golden hour the pencil is back in the mug and the shelf is a little more right than it was. The pleasure is not owning more. It is knowing what is there and where it is.

The collector is any age. A ten-year-old with a run of comics and a parent who lets them keep the good ones on the low shelf. A sixteen-year-old who reads everything by one author and keeps a list. Someone in their thirties with more records than wall. Someone in their seventies who has catalogued films for decades and does not call it a collection. A couple who combined two libraries and are still arguing about the order. A person who has listened to audiobooks for years in the kitchen and on the couch, and who counts it as reading. They live in houses and flats of any size, in towns and cities, alone, in couples, with children, with grandparents, with flatmates. What they share is a catalogue in their head and a few formats they hold opinions about. The Companion Core, in their story, is where the library sits: the book and comic files, the albums, the films, the audiobooks, and the list of what is on which shelf.

## 2. What they are responsible for

- The library itself: every title, album, film and audiobook the household holds, in the format it holds it in.
- The catalogue: knowing what is owned, what is a duplicate, which edition or pressing it is, and where it sits (shelf, box, folder).
- The shelves and the boxes: paper books, comics, records and discs are objects with places, and somebody carries the list.
- Passing on and lending: what stays in the house, what is lent to a friend, what goes to a younger relative or to a sale.
- Keeping the household's shared media working for everyone: the film night, the kitchen speaker, the audiobook for the long drive that someone else will also start.
- Staying honest about what is held: a file the family holds is not the same as a title a service lets them play for a while.

## 3. What they rent today

From the registry (`content/story/services.json`). All eight carry no flag, `alternativeToForm: ok` and `storyStatus: ok`. The "Fleet" column is how many current families already use the service in `services.json`'s `fleetHomes`; the cap is 12 of 30 homes (14 of 36).

| Registry id | Name | What it holds for them | Fleet | Notes for the writer |
|---|---|---|---|---|
| `kindle` | Kindle (alias Amazon Kindle) | The ebook shelf and the place the reading is | 9 | Titles bought there stay in that service. Do not say anything moves from it. |
| `apple-books` | Apple Books | The ebook and PDF shelf | 1 | Plenty of headroom. Same limit as `kindle`. |
| `audible` | Audible | The audiobook membership and the listening position | 6 | Headroom. Do not say purchases import. |
| `spotify` | Spotify | The music catalogue and the mix built from what the house plays | 12 | At the cap. Prefer `apple-music` for a new chip. |
| `apple-music` | Apple Music | The music catalogue and the playlists | 1 | Headroom. |
| `plex` | Plex | The server and the app for the family's films and shows | 13 | Past the cap. Prefer `netflix` for a new Jellyfin chip. |
| `netflix` | Netflix | A rented film and series catalogue | 0 | Headroom. The catalog's note: Jellyfin plays your own files, so say that, not "Netflix". The chip is allowed, the sentence is not a comparison. |
| `sortly` | Sortly | A rented inventory of things, places and photos | 0 | Headroom. The honest fit is a physical library, which is what HomeBox is for. |

The rented pattern the story names is the same in all eight: the service holds a shelf, a position, a list or a catalogue, charges for the right to keep it, and can change what is on it. The villain is the pattern. A sentence never accuses a company (`f-incumbent-claims`), and a story shows a chip, not a logo beside an accusation.

## 4. What the Hub offers them

Eight apps, all in the live store, none of them `ai: "chat"`. Six are strong beat apps (`storySafe: yes` or with a caveat the story can carry, and a store "replaces" name). Two are background only.

| Catalog id | Display name | What it does for this person | Replaces (store table) | Honest caveat from the catalog | QA |
|---|---|---|---|---|---|
| `booklore` | BookLore | Holds the family's book, comic and PDF files and shows them with covers and metadata. The reading shelf. | Kindle, Apple Books | Fetches metadata and covers from outside (so never "nothing leaves"). Your own files only. | screenshot |
| `calibre-web` | Calibre-Web | Browse and read an ebook library from a browser. A second reading view next to BookLore. | Kindle, Apple Books | Listed and installable, no recorded QA run: needs an entry in `reviewed.json`, or prefer BookLore. Your own books only. | none |
| `audiobookshelf` | Audiobookshelf | Organises audiobooks and podcasts and remembers where each listener stopped. | Audible, Apple Podcasts | The per-listener position is this app's feature, not a platform one (`f-multi-user`). Do not say audiobook purchases import. | screenshot |
| `navidrome` | Navidrome | Serves the family's own music collection to the devices in the house. | Spotify, Apple Music | Your own collection only. No catalogue comes with it. | screenshot |
| `jellyfin` | Jellyfin | Plays the movies, shows and music the family already has to the screens in the house. | Plex, Netflix | Plays your own files. Never "any film", never a service's content, never anything that reads as pirated. | screenshot |
| `homebox` | HomeBox | A home inventory: items, locations, categories and photos. For the physical shelf, box and sleeve. | Sortly | Barcode and Open Food Facts lookups call outside services. Do not say it tracks warranties (the manifest text was cut). Listed and installable, no recorded QA run. | none |
| `komga` | Komga | Reads comics, manga and magazines in the browser. Background app. | none | `with-caveat`, no QA screenshot. No replaces chip. Mention in a `with`, never as the hero beat. | none |
| `dvinyl` | DVinyl | Catalogues vinyl and other physical media. Background app. | none | `with-caveat`, not boot-tested on a live Hub device: never show a verified run, never a hero beat. No replaces chip. | not-boot-tested |

Two things a writer should know. First, `claims.json`'s own `apps` list does not carry BookLore, Calibre-Web, Komga or DVinyl (the validator reads `catalog-apps.json`, as the Learner chapter's use of the first two shows), so their caveats are the catalog's and this table's. Second, `lexicon.json` has no pronunciation pin for Navidrome, BookLore, Komga, DVinyl or Audiobookshelf; add them before the voice runs.

## 5. Where they spend time

Kinds of places and media, not named sites; all [?].

- Second-hand bookshops, library sales, charity shops and record fairs: the weekend hunt, with a bag over the shoulder.
- Specialist shops for comics, records and films, and the conventions and swap meets around them.
- Film societies, local cinemas that show older prints, and a friend's living room on a Friday.
- Community radio, long-running music and film podcasts, and the magazines and newsletters that argue about editions and remasters.
- Online forums and catalogue sites for a single format, where the conversation is about a pressing, an edition or a print run. They are read for facts, not for opinions about services.
- Libraries and the people who work in them, who know what a catalogue is for.
- At home: the shelf, the dining table, the floor with the sleeves out, the car on a long drive.

The collector trusts people who know their format over any ranking or recommendation.

## 6. How they talk

- **Tone.** Warm, particular, a little opinionated, never smug. Corrects an edition and apologises for it. Enthusiastic about a format without telling anyone else to share it.
- **Pace.** 135 to 155 wpm in the house voice; in sentence terms, unhurried with a pause after a title. Sentences of 6 to 14 words, a fragment for a name.
- **Vocabulary (owns).** Edition, pressing, issue, run, back issue, first printing, box set, dust jacket, sleeve, spine, cut, shelf, volume, side one, catalogue, the whole series, duplicate.
- **Humour.** Fond and about themselves: one more shelf, a duplicate bought on purpose, a filing system that only works in their head.
- **What turns them off.** "Content", "consume", "binge", "curated for you", "your taste profile", "library of millions", "never run out", "unlimited" (the claims rule agrees), "declutter", "hoarder", "digital shelf" used as a metaphor, any pitch that tells them the shelf is the problem. Also anyone who says a format is dead. Praise for the Core as a gadget.
- **What lands.** Naming the thing: "the second pressing", "volume three", "the director's cut". Saying where it sits. Saying plainly what the app does not do.

## 7. Comfort with technology and attitude to AI

**Comfort 2 to 3 of 5, range 1 to 4.** The range is wide because the collector is any age. A catalogue spreadsheet kept for ten years is a skill; so is writing labels by hand. Many have already run a media folder, a tagging tool or a spreadsheet of their shelves. Few have run a server. The one who runs the Core in a household of collectors is often not the collector, which is why the story shows both.

**Attitude to AI, the honest range.**

- Proud of the curation: the catalogue is theirs and no model should rename the collection. Some are proud of wanting the Core precisely because it takes nothing and tags nothing for them.
- Wary: auto-tagging that gets an edition wrong is a real annoyance, so "it identified it for you" is not a selling line. They distrust recommendations from the service that also sells the next title.
- Curious: some are interested in a model on the Core that reads a spine or matches a pressing, and a few would use it. This is a minority view in the range, not the lead.
- Indifferent: most collectors never touch a chat model. That is fine and it is the default.

**Rule for the writer.** None of the eight collector apps is a chat or agent app. A collector beat has no AI in it, so the age rule 16 does not bite: a collector of any age, including a child, can be the subject. AI is never the hook, never the first beat, and never "an AI-organised library". Nothing in a collector beat claims that a model identifies, tags, grades or values anything. If a household has a builder or an organiser who runs a local model, it is theirs and it is in their beat.

## 8. Objections and the honest limits

- "My streaming catalogue is bigger than anything I own." True. Navidrome and Jellyfin play what the family holds, not a catalogue. No "any album, any film". A Core is not a replacement for a catalogue; it is a place for what the family keeps.
- "I bought all of this in a store." Things bought in a service stay in that service and play there. These apps do not open protected store purchases. The catalog already says it for Koodo Reader (do not say it reads protected store purchases); it holds here for BookLore, Calibre-Web and Audiobookshelf. Do not say a library "moves" from a service.
- "My records are on vinyl." The Core does not play a record or turn it into a file. A physical collection is a list and a place; HomeBox, and the background DVinyl, are catalogues, nothing more.
- "I want recommendations." None come with these apps. There is no "you may also like".
- "What if I lose it?" The Core holds the library; it is not a backup. A collector with one copy of anything irreplaceable needs another one, and the story says the Core is not that. This is a limit stated plainly, not advice.
- "Can I listen on the road?" Not claimed. Every scene is on the home network (`cap-remote-access`).
- "Does my partner get their own library?" Audiobookshelf remembers where each listener stopped; that is the app. Do not say each person on the Core gets a private shelf (`cap-multi-user`).
- "Are the covers local?" BookLore fetches metadata and covers from outside; HomeBox's barcode and food lookups call outside services. Never "nothing leaves".
- "Is Companion OS finished?" It is in beta, and the site says so beside any software claim.
- "How fast?" No number: no bitrate, no file size, no start-up time, no "lossless" claim, no latency.
- "Which film, which album?" The story never names a real title, an artist or a game, a book, an author or a label. Props and spines are unreadable.

## 9. Claims boundary

What must never be said for this persona. Ids are from `content/story/claims.json`.

| Never say or imply | Rule |
|---|---|
| Any price, savings, "stop paying", "cheaper than", "pays for itself", or a time saved while cataloguing | `f-prices`, `f-savings`, banned `num-dollar`, `num-savings`, `num-time-saved` |
| "Unlimited", "everything you love in one place", "any album, any film, any book" | banned `buzz-unlimited` (warn), the catalog caveats for Navidrome and Jellyfin |
| Pirated or copied-from-a-service content: no "download", "rip", "torrent", "get it for free", nothing that reads as copying a rental | the Jellyfin catalog caveat; `f-incumbent-claims` |
| A purchase from a service moving to the Core ("bring your Audible books", "your Kindle library comes with you") | the Koodo Reader and Audiobookshelf caveats; `f-incumbent-claims` |
| Playing a record, ripping a disc, digitising a shelf; DVinyl or Komga working end to end | DVinyl is not boot-tested, Komga has no screenshot; `f-photoreal-core` for any invented interface |
| Audio or picture quality: "hi-fi", "lossless", "studio sound", a bitrate, a resolution, "4K" | `f-unmeasured`, banned `num-tokens` (latency, milliseconds) |
| "Nothing leaves the Core", "offline", "private" on its own | `f-never-leaves`, banned `sec-never-leaves`, `sec-offline` (BookLore and HomeBox fetch from outside) |
| Listening or viewing from anywhere, on a trip, on a train, over the internet | `f-remote-access`, banned `cap-remote-access` |
| A private library per person, per child, per household member, "the kids cannot see" | `f-multi-user`, banned `cap-multi-user` |
| Recommendations, "it notices what you like", "learns your taste", "never forgets" | `f-proactive`, banned `cap-omniscient` |
| An agent that buys, lends, lists or posts for the person | `f-agent-autonomy`, banned `cap-autonomy` |
| Value, appraisal, investment, insurance cover, what a record is worth, "grade" as a price | `f-legal-tax-fin` |
| Warranties tracked by HomeBox | the HomeBox caveat in `claims.json` (manifest text cut) |
| Kid-safe, parental control, keeping a child away from anything | `f-medical-care`, banned `sec-safety-people` |
| "Your collection is safe", "protected", "never lost", "backed up" | `f-security-guarantee`; the Core is not a backup |
| A testimonial, a review, a rating, a count of collectors, "real collectors" | `f-testimonial`, banned `fake-social-proof` |
| "We own the apps", "your own apps", "own outright" | `f-own-apps`, banned `cap-own-apps` |
| Companion Core drawn as a photograph or a product hero | `f-photoreal-core` |
| A named incumbent beside a verb of spying, selling data or lying | `f-incumbent-claims`, banned `incumbent-attack` |

**The regulated-domain rule.** The collector sits mostly outside the regulated domains, so the rule is short. A child's reading, listening and viewing list is children's data: write only that the files sit on the Core and say nothing of protection, safety, privacy law or parental control. A film, comic or book is never described as age-suitable by the Core. No Core, no app, and no line of a collector beat gives advice about the value, valuation, tax treatment or insurance of a collection. No compliance, certification or security-guarantee claim appears anywhere for this persona.

**Standing lines that ride along.** Fictional family, real software. Companion OS is in beta. Installing apps uses the internet. Remote access is not claimed. Daylight and warm light only. One household, one Core.

## 10. Fit

**Rooms and anchors (from `roles.json`).**

| Room id | Anchor role (preference) | What it resolves to | Why it fits |
|---|---|---|---|
| `living` | `bookshelf`, `music`, `tv`, `couch` | bookshelf, low-bookshelf, ladder-shelf, open-shelving; record-player, guitar-stand and the other music items; tv-stand, wall-tv; sofas | The shelf, the record player, the film night, the audiobook on the couch. The collector's home room. |
| `office` | `bookshelf`, `desk` | the same shelves; writing-desk, standing-desk, laptop | Cataloguing at a desk; the library as work, the pencil and the labels. |
| `bedroom` | `desk`, `bed` | desk items; bed | The audiobook on a quiet afternoon, the reader's shelf. |
| `dining` | `dining-table` | farmhouse and other tables | The Sunday sort, the stack from the sale, the shared list. |
| `kids` (fallback) | `bookshelf`, `desk` | low-bookshelf and kids-desk | A child's comics and chapter books on the low shelf. Parent-led, no chat. |
| `kitchen` (fallback) | `counter`, `kitchen-island` | counter-run, kitchen-island | The kitchen speaker and the radio on while cooking. |

The row below uses `living`, `office` and `bedroom` as primary rooms, `dining` and `kids` as fallbacks, and `bookshelf`, `music`, `tv` as the anchors. `couch`, `desk`, `bed`, `dining-table` and `room` are the fallbacks (`bed` for the bedroom beat, `dining-table` for the dining fallback) and `room` always resolves. The `home` table in `roles.json` lists a bookshelf in `living` and `office`, a `music` item in `living` only and a `tv` in `living`: the resolver prefers those rooms and falls back to other rooms when they hold the item, which several homes do.

**Homes whose spec already gives the collector a real prop (read from `content/houses/*.json` on 2026-10-20, 30 homes; the six apartments are not in that folder and were not checked).**

- A record-player: riverbend (Family Room, beside a low-bookshelf, a strong first choice), mesamariposa (Primary Bedroom).
- A shelf-led library: seraphine (Library), bgfamily (Front Study, Living Room, Study, Upper Landing, Family Corner), valleyview (Garden Room, Reading Lounge), mirage (Reading Loft, Stair Landing), cocoon (Den, Living Room), epiphany (Den), bghouse-olcia (Family Room, a ladder-shelf), mediterranean (West Bedroom), lakecabin (Study), aurora (Study), sunnyhome (Loft, Upper Landing), onestory (Fireside Nook), gardennook (Living Room).
- A low shelf for a child: cutestarter (Kids Corner), familyhome (Playroom), modernhouse1 (Kids Room), palnknoll (Kids Room), familyhouse-nora (Kids Bedroom, Playroom), seraphine (Nursery).
- Homes with no bookshelf or record-player among their room items: asymmetry, flowerycottage, modernhome-nora, modernhouse-nora, newcrest, neweco, palms, payorote, starter18k, vanilla. Do not make one of these the home of a collector unless the beats sit at the dining table and the couch, which always resolve.

The bible's own best-home list for neighbouring personas (Learner, Maker) already uses seraphine, riverbend, mirage and epiphany. Do not stack a collector on a Brennan by default: the flagship family has its own four, and the fleet rule on first names and surnames is strict.

**Ages and household shapes to cast.** One collector in a household of two to six, usually not more than one. Any age from the primary-school child with a run of comics to the oldest member of the house. Single adult; a couple; two generations under one roof; an adult and a child; flatmates; siblings. The collector is not the household's builder or organiser and rarely the business owner. Pair the collector with a person who does not collect, and give that person a reaction shot, per bible rule 4.3-7 ("pair every tinkerer shot with a reaction from someone who does not tinker").

**Casting warning against stereotype.** The collector is not an older man, not a nerd, not a hoarder, not a reflex of the format: vinyl is not for men, audiobooks are not for women, comics are not for boys, cookery shelves are not for mothers, and a person who listens to audiobooks is not coded as blind, old or tired. A disability is never the reason a role is given. A child's collection is as serious as an adult's. Name the person for the household (heritage varied, first names at most twice in the fleet), not for the format. Never present a collector as a customer or as a real person. A collector under 16 has no companion and no chat (age rule 16); no collector beat needs either, and a child is shown in third-person captions only.

## 11. Ten user stories

Each is "As a collector, I want <job> so that <outcome>", tied to one catalog app and one registry service, with the caveat and a one-line story moment. A collector is shown with no name here. In every moment the shelf, the sleeve or the table is the hero and the screen is never readable (bible rule 4.3-1). Services at or past the fleet cap (`spotify`, `plex`) are used once each; prefer the headroom services in new casts.

1. **As a collector, I want one shelf for every book file the household holds so that I know which editions we already have.**
   App: `booklore`. Service: `kindle`. Caveat: covers and metadata are fetched from outside; the family's own files only; nothing from a store moves.
   Moment: `office`, `desk`. First: a hand sets a tablet beside a laptop and a stack of paperbacks, and the camera holds on the stack, not the screen.

2. **As a collector, I want the comics and PDFs in the house on one shelf with their covers so that I can see at a glance which volumes we hold.**
   App: `booklore` (with `komga` as the background reader). Service: `apple-books`. Caveat: the same BookLore caveat; Komga is background only and has no screenshot.
   Moment: `kids`, `bookshelf`. First: a child's hand pulls a volume from the low shelf while a parent stands by, third-person caption, no one speaks.

3. **As a collector, I want to open the ebook library in a browser on whatever screen is nearest so that the books are on any screen in the house.**
   App: `calibre-web`. Service: `kindle`. Caveat: listed and installable, no recorded QA run (needs a `reviewed.json` entry or use story 1 instead); your own books only; home network only.
   Moment: `living`, `couch`. First: someone settles on the couch with a tablet and opens the library in a browser.

4. **As a collector, I want the audiobook to pick up where I stopped so that I never go looking for my place.**
   App: `audiobookshelf`. Service: `audible`. Caveat: the per-listener position is this app's feature, not a platform one; audiobook purchases do not import.
   Moment: `bedroom`, `bed`. First: the audiobook resumes at the chapter stopped in the kitchen the day before; the window is bright and the book on the bed is shut.

5. **As a collector, I want the albums the family holds to play on the speakers in the house so that the shelf of discs is a library, not a museum.**
   App: `navidrome` (with `dvinyl` as the background catalogue of the physical sleeves). Service: `spotify`. Caveat: your own collection only, no catalogue comes with it; DVinyl is not boot-tested, so never a verified run.
   Moment: `living`, `music`. First: a hand lifts the needle at the end of side one and slides the sleeve back on the shelf; in the kitchen, a different album plays from the folder the family holds. The record is not played through the Core and is not turned into a file.

6. **As a collector, I want the music I keep to stay in the order I chose so that the album I know is the album that plays.**
   App: `navidrome`. Service: `apple-music`. Caveat: your own collection only; no recommendations; no audio quality claim.
   Moment: `dining`, `dining-table`. First: a stack of discs sits beside a laptop and the folder the family holds is open next to it.

7. **As a collector, I want a film night from the films the family keeps so that the titles we love do not depend on a catalogue.**
   App: `jellyfin`. Service: `plex`. Caveat: plays your own files; never "any film", never a service's content.
   Moment: `living`, `tv`. First: the television wakes with the family's film folder, a shelf of disc cases beside it.

8. **As a collector, I want the series and box sets the household holds on one screen in the house so that a change in a rented catalogue leaves no gap in the run.**
   App: `jellyfin`. Service: `netflix`. Caveat: plays your own files, so say that, not "Netflix"; nothing from a rented catalogue moves.
   Moment: `living`, `couch`. First: someone holds up a box set, then a cut to the television as the first episode starts.

9. **As a collector, I want to know which shelf, which box and which sleeve every physical item sits in so that finding it takes a minute with a pencil, not an afternoon.**
   App: `homebox`. Service: `sortly`. Caveat: barcode and food lookups call outside services; listed and installable, no recorded QA run; nothing about warranty.
   Moment: `office`, `bookshelf`. First: a hand writes a label for the third shelf and sets it on the crate.

10. **As a collector, I want a photo of each rarer piece beside where it sits so that I know what I have when the light is bad.**
    App: `homebox`. Service: `sortly`. Caveat: same HomeBox caveat; the photos are the family's; no valuation, no grade as a price, no warranty.
    Moment: `living`, `bookshelf`. First: a sleeve lies on the windowsill in daylight and a hand photographs it.

Coverage check: six strong apps are the hero of a story (BookLore twice, Calibre-Web once, Audiobookshelf once, Navidrome twice, Jellyfin twice, HomeBox twice); the two background apps appear only inside a `with`; all eight registry services are used (`kindle` twice, `sortly` twice, the other six once each).

## 12. Six beat seeds

Each is the first sentence a visitor reads. They are about what the rented service held, learned, charged or changed and what the family's own copy does instead. Sentence case, no dash, no digit, no exclamation mark, 20 words or fewer. The villain is a pattern; no company is named in a sentence and no attack verb is used. Chips carry the comparison. Each is a seed for the writer, not shipped copy, and the two marked "review" (seeds 2 and 5) want the owner's eye for the incumbent rules.

| # | Seed | Angle | Chip | App | Story |
|---|---|---|---|---|---|
| 1 | The reading app showed only what was bought there, and BookLore shows every book file the family holds. | held | BookLore, replaces Kindle | `booklore` | 1 |
| 2 | The audiobook membership renewed each month, and Audiobookshelf plays the files already on the Core. | charged (review) | Audiobookshelf, replaces Audible | `audiobookshelf` | 4 |
| 3 | The album they loved left the catalogue, and the family's own copy stays where they put it. | changed | Navidrome, replaces Apple Music | `navidrome` | 6 |
| 4 | The series the house watched every winter dropped out of the rented catalogue, and Jellyfin plays the family's copy. | changed | Jellyfin, replaces Netflix | `jellyfin` | 8 |
| 5 | The music service built a mix from what the house played, and Navidrome plays the albums the family chose. | learned (review) | Navidrome, replaces Spotify | `navidrome` | 5 |
| 6 | The crate list lived in a rented inventory app, and HomeBox holds which shelf and which box on the Core. | held | HomeBox, replaces Sortly | `homebox` | 9 |

Notes on the six. Seeds 3 and 4 describe a change in a rented catalogue as something that happens in the story; they name no service and no title. Seed 5 says what a recommendation does in general; if the owner finds "built a mix from what the house played" too close to an accusation, replace it with seed 2's pattern of a recurring bill. Seed 2 says "renewed each month", never an amount. Seeds 1 and 6 are the two that open on a physical object: a stack of paperbacks, a labelled crate.

## Appendix: the `personas.json` row

To be added under `archetypes` in `content/story/personas.json`. The row has no `example`, as `maker` and `host` have none (the cast plan supplies the name). Every room is in the schema's `roomRole` enum, every anchor role is in `roles.json` (`items` or `universal`), and every app is a catalog id in the live store. The first six apps are the beat apps; `komga` and `dvinyl` are background apps (a `with` only).

```json
"collector": {
  "label": "Collector",
  "description": "Keeps a library of books, comics, records and films and knows where every one is: the files and the catalogue sit on the Core.",
  "rooms": ["living", "office", "bedroom"],
  "fallbackRooms": ["dining", "kids"],
  "anchorRoles": ["bookshelf", "music", "tv"],
  "fallbackAnchorRoles": ["couch", "desk", "bed", "dining-table", "room"],
  "apps": ["booklore", "calibre-web", "audiobookshelf", "navidrome", "jellyfin", "homebox", "komga", "dvinyl"]
}
```

**Checklist when the owner adopts it (this file touches none of these).** Add `collector` to `member.archetype` in `content/story/schema/family.schema.json` and to `ARCHETYPES` in `assets/story/types.ts` (a test keeps the three equal); add the row to `content/story/personas.json`; add a POOLS entry in `scripts/story/cast-lint.mts` and the pool and rooms in `scripts/story/build-casting.mts`; add a row to the table in `personas.md` and a section to `persona-apps.md`; add `collector` to `PERSONAS` in `scripts/portal-front.mts` (filter Play, or a new chip, the owner's call); add lexicon pins for the five app names; list a `reviewed.json` entry for any Calibre-Web or HomeBox beat that has no QA screenshot; run `pnpm run story:cast` and `pnpm run story:validate`.
