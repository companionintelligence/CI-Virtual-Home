# The Traveller (`traveller`)

Deep dive for one proposed persona, the fifteenth archetype. Draft for the owner; nothing here is wired yet (the schema enum, `ARCHETYPES`, `content/story/personas.json`, `PERSONAS` in `scripts/portal-front.mts` and `content/story/cast-plan.json` are unchanged). Written on 2026-10-20 against `content/story/catalog-apps.json`, `services.json`, `claims.json` and `roles.json` as they stand in this tree.

Home chip: **Play** (category `play`, "Play and explore"). Nobody here is a customer. Ages, homes, jobs and lines are design choices for fictional characters. The only tagged statements describe the world, and none was read from a page for this chapter, so every statement about habits, communities or attitudes carries **[?]** (inference or lived-experience generalisation). Do not present a [?] line as a fact. Statements about the catalog, the registry, the claims file and the roles file were read from this tree on 2026-10-20 and are tagged **[repo]**. There is no statistic in this file on purpose. The example name is a placeholder (`Rune`, unused in the cast, the retired families, the avoid list and the other persona files); a household's real traveller gets a name from the cast step.

**Why this persona.** Travel is a whole area of life with a cluster of Hub apps that no existing pool names: AirTrail (a flight log), AdventureLog (trip planning and a journal), Spliit (shared costs), TRIP (places on a map), plus LibreTranslate for a message in another language. Today the closest persona is the host, who runs the household's logistics all year round at the fridge door. A traveller is episodic: a trip has a dreaming stage, a planning stage, a going stage and a filing stage, and the Core earns its place in the first, second and fourth only. That is also what makes the persona safe to write: remote access is not claimed (`cap-remote-access`), so every scene is set at home, before the trip is booked or after it is over. The story is "plan at the table, file when home", never "on the road".

**Where it differs from the host (the nearest archetype).** The host feeds, ferries, waters and tidies (the bible, chapter 3.6). The traveller plans and remembers: a map on the table, a stack of confirmations, a jar of stubs. They share the dining table and Immich, and nothing else. Do not make the host the one who plans the trips by reflex, and do not cast the two as one person.

---

## 1. Who

A Saturday morning in late winter, a little after ten. Light comes low across the dining table. A paper map is held flat by a mug, a laptop is open to a calendar, and three half-written lists lie beside a pencil. The person at the table is choosing between two ways to cross a country for a week in the spring, and keeps asking whoever walks past, "which week works?" There is no hurry. For this person the planning is a pleasure in its own right [?]: the timetable read twice, the guesthouse short-listed and dropped, the friend's cousin's advice weighed against a guidebook. A jar on the bookshelf holds old boarding-pass stubs and ticket halves, and next to it sits a binder of the printed confirmations from three earlier trips. Nothing on the table is clever. It is a lot of small facts that have to agree: dates, names, a booking reference, who has paid for what.

The Sunday after a trip is the other half of the day. The bag is half unpacked in the hall, a coat pocket has a folded receipt, and the memory cards and phones are about to be emptied. Over a pot of tea the traveller types the week's flights into the log, adds the receipts to the shared costs, scans the confirmations and puts the photos where the family will find them. This filing is the part the Core is for. Who they are is deliberately wide [?]. Ages run from about seventeen to the mid seventies. Some live alone in a flat with a shelf and no garage, some are a couple who go somewhere twice a year, some are a family planning the one summer visit to relatives, some are three housemates who take a single trip together, and some are grandparents arranging a long-promised visit. They live in any country and in any kind of home. What they share is that they travel a few times a year, enjoy the planning as much as the trip, and keep records because they like to look back.

## 2. What they are responsible for

- **The plan.** Dates that suit everyone, the route, where each night is spent, and the fixed points (a wedding, a ferry) the rest has to fit around. The traveller is the person who has the whole thing in their head and, ideally, in one place.
- **The paperwork of a trip.** Booking confirmations, tickets, reservations and the insurance letter. These are the household's own documents; the story only says where the files sit.
- **The shared costs.** In a group, someone keeps track of who paid for what, so that the settling up afterwards is one calm evening. The app moves no money.
- **The words.** A message from a host, a letter from a landlord, a menu or a form in a language the family does not read. They want to understand it before they answer.
- **The logins and loyalty numbers.** The airline, the rail account and the booking site each want an account. A household that travels has a dozen of them and one person who is asked, "what was the password for the ferry?"
- **The record.** A flight list, a journal of where they went and the photos. The traveller is the family's memory keeper for the places they have been [?].
- **Not responsible for.** Visa and entry rules, health requirements, safety on the trip and anything legal or financial. The Core holds files; it advises on none of these, and neither does the story.

## 3. What they rent today

Registry ids are from `content/story/services.json` [repo]. Every row below has no `stale` or `story-excluded` flag and `alternativeToForm: ok`. Chips read `alternative to <Service>`, never `replaces <Service>` (rule `chips-legacy`). A service is named in a chip or in a `detail.before`, never in a sentence that says what the company does to the reader (`incumbent-attack`).

| Service | Registry id | Rank | What the traveller keeps in it [?] | Hub app that can sit in its place (`storyApps`) |
|---|---|---|---|---|
| Flighty | `flighty` | 136 | The list of flights taken, and the history over the years | `airtrail` |
| ForeFlight | `foreflight` | 137 | An aviation app. In the catalog it is a name AirTrail lists as replaced. See the warning below | `airtrail` |
| TripIt | `tripit` | 84 | One itinerary assembled from many confirmations | `adventurelog`, `surmai` |
| Wanderlog | `wanderlog` | 85 | A shared plan of places and days | `adventurelog`, `surmai` |
| Polarsteps | `polarsteps` | 156 | A trip journal with the route and the photos | `adventurelog` |
| Splitwise | `splitwise` | 165 | Who paid for what on a group trip | `spliit` |
| Google Translate | `google-translate` | 92 | A message or a menu pasted in to be understood | `libretranslate` |
| DeepL | `deepl` | 130 | A longer text or a document pasted in | `libretranslate` |
| Google Photos | `google-photos` | 18 | The trip's photos from several phones | `immich`, `librephotos`, `photoprism`, `photoview` |
| LastPass | `lastpass` | 33 | The airline, rail and booking-site accounts | `vaultwarden`, `passbolt`, `teampass` |
| Google Drive | `google-drive` | 4 | The folder of confirmations and receipts | `paperless` (also `nextcloud`, `copyparty`, `papra`) |
| Evernote | `evernote` | 12 | Scans and notes about a trip | `paperless` (also `joplin`, `obsidian`, `papra`, `standard-notes`) |
| iCloud Photos | `icloud-photos` | 32 | The same as Google Photos, for an Apple household | `immich` |
| 1Password | `1password` | 27 | The same as LastPass | `vaultwarden` |

**Warnings on this table.**

- **ForeFlight.** It is an aviation app for pilots (charts, flight planning, a pilot's logbook) [?]. The catalog lists it in AirTrail's `replaces`, and the registry allows it, but a story must not present AirTrail as a pilot's logbook or as anything to fly or navigate by. Use Flighty for AirTrail. Do not use ForeFlight as a pair unless the owner decides otherwise.
- **App in the Air** is in AirTrail's catalog `replaces` and is a registry service flagged `stale`. Never use it (`service-status`).
- **What stays rented.** Nothing here is the airline's app, the booking site's account, the ticket wallet on the phone, the maps and navigation, or the messaging thread the group plans in. The Core replaces the notebook and the shoebox, not the airline. Say so lightly in one beat per family.
- **No fact about any service's price, terms or changes is in the registry.** A seed that says a named service "charged" or "changed" something has no source. The seeds below say what the person put in and where the family's copy now sits.

## 4. What the Hub offers them

Names are the catalog's display names, character for character. "Replaces" is the catalog `replaces` list; the registry id of the story pair is in section 11. QA is the catalog `qa` field, `storySafe` the catalog flag [repo].

| App | Catalog id | What it does for this person | The honest caveat from the catalog | QA / storySafe |
|---|---|---|---|---|
| AirTrail | `airtrail` | Logs the flights the household has taken and shows the whole travel history on a world map. The family types the flights in once and the history grows over the years. | None in the catalog. Honest limit from the listing: it is a log and a map. It does not claim live flight status, delay alerts or boarding passes, so a story never shows one. Its replaces list includes a `stale` service (App in the Air): chip Flighty only. | screenshot / yes |
| AdventureLog | `adventurelog` | Logs where the family has been and plans the next trip with the family. The catalog gives it two jobs: a journal and a plan. | "No QA screenshot on origin/main (e2e/screenshots). It is listed and installable, but nobody has recorded a verified run." Each beat needs an owner entry in `reviewed.json` (rule `app-qa-screenshot`). amd64 only. Stays in the background. | no-screenshot / with-caveat |
| Spliit | `spliit` | Splits the shared costs of a trip among friends, housemates or family and settles up with the fewest payments. | None in the catalog. Claims file: "It does not move money." The people who share costs must reach the app, and remote access is not claimed, so the story is an evening at the table at home. | screenshot / yes |
| LibreTranslate | `libretranslate` | Translates text and documents on the Core, so the message from a host or the form in another language is read at home. | The catalog line is quoted here and is not to be repeated in copy: "Works offline once language models are downloaded." (`sec-offline` bans the words works offline; the downloading uses the internet, so a story says which step does.) No quality, speed or language list is claimed. It is a tool, not a chat model, so a member under 16 may use it. | screenshot / yes |
| Immich | `immich` | Backs up, organises and searches the family's photos and videos on the Core, so the trip's pictures from several phones land in one album. | "Bundles its own database and a machine-learning service, so first start takes a while." Claims file: phone backup needs the Immich phone app on the home network; no away-from-home claim; no store badge; no face-recognition or "AI sorts your photos" claim. The Core is not a backup. Over the fleet cap (below). | screenshot / yes |
| Paperless-ngx | `paperless` | Scans and files the printed confirmations, receipts and letters, reads every page, tags it and makes the lot searchable. | "AI features are off by default. If you turn them on they can use a local model." "Office document conversion is not wired up in this build; OCR and archiving of PDFs and scans works." Never bare "Paperless". Over the fleet cap (below). | screenshot / yes |
| VaultWarden | `vaultwarden` | Keeps the household's airline, rail and booking-site accounts and loyalty numbers in one vault, and works with the Bitwarden apps. | "Bitwarden-compatible server, unofficial. Do not say Bitwarden." Say "the Bitwarden apps" or "Bitwarden-compatible". No security superlative. Phone use away from home needs remote access (held). | screenshot / yes |
| TRIP | `trip` | Saves places on a map and plans multi-day trips with a budget. | None. It has no `replaces`, so a beat on it is pair-less and counts against the 20 percent budget (`pair-budget`). The name is matched case-sensitively as `TRIP`: write "the trip" in lower case in prose and the app only when it is the app. | screenshot / yes |
| Surmai | `surmai` | Keeps the family itinerary, bookings and documents for a trip together. | "Its own listing notes say it has not been boot-tested on a live Hub device." Background only; a beat needs an owner entry. Not in the persona's pool. | not-boot-tested / with-caveat |

**Fleet headroom matters more here than for most personas** [repo, counted in `content/families/*.json` on 2026-10-20]. A third-party app may be in at most 40 percent of the families (12 of 30 today, 14 of 36 later). Counted by home: Immich 18, Paperless-ngx 15, LibreTranslate 12 and VaultWarden 12; AirTrail 1, Spliit 1, AdventureLog 0, TRIP 0. In practice a new traveller's beats lean on AirTrail, Spliit, AdventureLog and TRIP, and Immich, Paperless-ngx, LibreTranslate and VaultWarden come in only where a home's other beats leave room (`FLEET.appShareMax`). That is the point of the persona: it brings four rare apps into the fleet.

**Not in the pool, on purpose.**

- Wanderer (`wanderer`) is a route planner for hiking and biking from GPX files, with no replaces and a name the validator matches as a whole word. A hiking story belongs to the maker or a later outdoor persona; the word "wanderer" must not appear in traveller prose because it names that app.
- Kiwix is `avoid` (an empty library). LibreTranslate is the only language tool.
- Lingva Translate scrapes Google Translate, so the text goes to Google: excluded (`lingva-translate`).
- Maps, navigation, ticket wallets and airline apps have no Hub equivalent that the catalog lists. Nothing in the story claims one.

## 5. Where they spend time

All of this is an editorial reading [?]. No community was read for this chapter, and no thread, post or figure is quoted.

- **Kinds of places.** The guidebook and travel section of a bookshop or library; map shops and the atlas on a family shelf; museums; language classes and conversation groups; train, ferry and cycling clubs; hiking and walking groups; the kitchen table with a paper timetable; the printed photo book that comes back after the trip.
- **Communities.** Trip-report threads and planning forums for a region or a way of travelling (rail, long ferries, walking routes, overlanding by coach); loyalty-programme and flight-log hobby forums for the people who keep a count; photography and journalling communities; and the project pages and discussion boards of the open-source tools themselves, where AirTrail, AdventureLog and Spliit are known to people who already like to run software themselves.
- **Media.** Guidebooks and travel memoirs; timetables and route maps; podcasts and long videos about a place; the airline or rail operator's own booking pages; a friend's printed itinerary photographed into the group chat.
- **The group chat.** The messaging thread where the trip is argued over. It stays where it is: the Core does not move a messaging service (`cap-messaging-private`).
- **Offline.** The dining table, the shelf with the atlas, the hall where the bag waits, a relative's kitchen where the trip is first suggested.

## 6. How they talk

**Tone.** Unhurried, specific and a little dry about their own thoroughness [?]. Pace 140 to 155 words a minute; sentences 7 to 13 words, one fact each. Humour: the spreadsheet with seven tabs, the second pencil. Warm, never breathless.

**Their own nouns (use these).** Itinerary, connection, booking reference, confirmation, timetable, boarding-pass stub, the shared costs, the phrase list, the leg, the night in the middle, the week. Use plain verbs: plan, file, add, type in, scan, settle up.

**What turns them off.**

- Travel-marketing clichés: wanderlust, bucket list, hidden gem, off the beaten path, authentic, curated, must-see, live like a local, globetrotter, jet-setter, "explore the world".
- "Hack", "life hack", "points hack". The tone of a deal-hunting feed [?].
- Anything that implies the Core is in their pocket on the trip. They know it is not.
- A voice that tells them how to travel, or what is safe or allowed.
- The word "digital nomad". Working while travelling is a different persona and a remote-access promise.

**Sample lines (labelled scripted, third person, captions).** No first-person quote is offered here; the writer may use one labelled adult quote per cut (persona-bible rule 8) and none is needed.

- "Last year's flights go into AirTrail on the Core." (caption)
- "The shared costs are settled at the table, in Spliit." (caption)

## 7. Comfort with technology and attitude to AI

**Comfort.** 3 of 5, range 2 to 4 [?]. A traveller is used to booking sites, calendars, maps and spreadsheets and is often the person in the household who already keeps a tidy list. Few have edited a config file. The most comfortable keep a flight log by hand and like seeing the world map fill in. The least comfortable want the Core set up once by someone else and will ask the household's tech person. Who they call: a partner, a friend in the group or a forum.

**Attitude to AI. The honest range.**

- *Proud of wanting it.* Some use a model to turn a pile of notes into a draft day-by-day list and say so openly. They are comfortable with a model that runs on the Core and are quick to correct its mistakes.
- *Curious.* Many have tried a model for ideas and keep it at arm's length, because they enjoy choosing for themselves.
- *Wary or opposed.* Some find that planning is the pleasure and an AI plan takes it away. Others distrust a model's facts about times, places and rules, and they are right to.
- *No view.* Some have not thought about it. The persona does not need AI.

**Ceiling for a story.** AI is never the hook and never the first beat (rule 2 of the bible). At most one beat per traveller: the household's agent turns the rough notes from a planning evening into a day-by-day list, the traveller checks every line against the booking, and nothing is booked, paid, sent or cancelled by it (`cap-autonomy`). It never states an opening time, a price, an entry rule, a health requirement or what is safe, because a model on the Core can be wrong and travel facts change. Use Hermes (`ci-hermes`) or OpenClaw (`ci-openclaw`), not named in the pool. The age rule applies: only a member aged 16 or older uses an agent, and a younger family member appears only as the one being helped. LibreTranslate is a tool, not a chat model, and stays open to a younger member. No survey of travellers' attitudes to AI was read for this chapter; treat the range as a design choice [?].

## 8. Objections and the honest limits

| Objection a traveller would raise [?] | The honest answer | Who says it |
|---|---|---|
| "I need the itinerary with me on the trip." | Remote access is not claimed (`cap-remote-access`). The Core is at home and nothing about it is reachable from elsewhere. A printed itinerary and the airline's own pass are the traveller's habit, and the story never shows the trip itself. | The traveller, lightly, in the planning beat: a printed copy goes in the bag. No claim about a phone copy. |
| "Does it track my flight?" | No. AirTrail is a log of flights taken and a map of the history. It does not claim live status, alerts or gate changes. | A single limit line in the AirTrail beat. |
| "Can the whole group use it?" | The shared costs are added at the table at home, by people who are at the house. Friends who are elsewhere cannot reach the Core, and the app moves no money (the claims file). | Held still on the limit. No "share a link" (`cap-remote-access`). |
| "Is it accurate?" | No accuracy or quality claim is made for LibreTranslate. It gives a reading of a message; the person decides what to answer. | The traveller, in one sentence. |
| "Where do my photos go?" | The Core is not a backup. First start of Immich takes a while. Phone backup needs the phone on the home network. | The beat that files the photos, or none. |
| "I do not want to run software." | The Core is the household's, not a service. Setup is the household's tech person's job, as with the host. | The household's tech person, not the traveller. |
| "What about my booking site accounts?" | They stay with the airline, the rail operator and the booking site. The Core holds the family's own copy of the plan, the log, the costs and the files. | One honest line per family. |
| "Does it find me the best fare?" | No. Nothing in the Hub finds, compares or books a fare. | Never raised in a beat. |

**Limits the Core and the apps cannot cross, in one list.** No live flight data. No booking, payment or check-in. No maps or navigation on a trip. No access away from home. No backup (the Core is not a backup). No translation quality claim, no live or camera translation. No face-recognition or smart-sorting claim for photos. No advice on visas, health, insurance or safety. One household and one Core: friends outside the house cannot be given a place on it.

## 9. Claims boundary (what must never be said for this persona)

Ids are `bannedPhrases` in `content/story/claims.json`, unless noted. This list adds to the global ones; it does not replace them.

1. **Regulated domains are written without any compliance, certification, safety or security-guarantee claim and without advice.** Travel touches four: health (vaccinations, medication, a doctor's letter), legal and immigration (visas, entry rules, a passport), finance (travel insurance, money moved or exchanged, the cost of a trip) and children's data (a child's passport or photos). Say only what the app does and where the files live. `sec-compliance` bans compliant, certified and GDPR; `sec-medical` bans anything clinical; `legal-claims` bans advice and "legally valid". A story never shows a passport, a visa, a vaccination record, an insurance policy number or a child's identity document, and never states what a country requires.
2. **Never remote access** (`cap-remote-access`). The persona's whole subject invites it, so this is the strictest rule. The pattern bans: from anywhere, anywhere in the world, on the road, on holiday, while away or travelling, away from home, "from the airport / hotel / train / car / office", VPN, tunnel, "share a link", "public link", "reachable from the internet". Write the plan as made at home and the filing as done after the return. The trip itself is never a scene; say "after the trip", "when everyone is home", "at the table".
3. **Never live data or an agent that acts** (`cap-autonomy`, `cap-omniscient`). No flight status, no price watch, no "books for you", "checks you in", "emails the host", "files the receipts for you", "anticipates your next trip". An agent prepares; the person approves and sends.
4. **Never a price, a fare, a saving or a payback** (`num-dollar`, `num-savings`, `num-time-saved`, `no-subscription`). A "budget" is the app's word for a feature (TRIP) and never carries a number. No "cheaper than", "saves hours".
5. **Never a duration** (`num-minutes`): no "in two hours", "takes a few minutes", flight times, or time zones as a number.
6. **Never "private", "secure", "safe", "offline" or "never leaves" on their own** (`sec-absolute`, `sec-never-leaves`, `sec-offline`). Use "stays on the Core by default", "sits on the Core", "runs on the Core". "Keeps the family safe on the trip" is `sec-safety-people` and has no place anywhere.
7. **Never a translation, photo or password quality claim** (`cap-parity`): no accurate, fluent, "as good as", no "understands", no "sorts your photos by who is in them" (not in the Immich listing), no "unhackable".
8. **Never a named company doing something to the reader** (`incumbent-attack`), and never an unsourced fact about a named service (price, terms, a change). The registry holds names and links only. The sanctioned form is the chip: "AirTrail", "alternative to Flighty".
9. **Never a testimonial, a review count or a star** (`fake-social-proof`): this includes "five-star hotel", "rated", "travellers love", "reviews". Never present a person as a customer.
10. **Never multi-user or separate vaults** (`cap-multi-user`). The shared costs are one household's, plus visiting friends at the table; say nothing about each person having a private space. VaultWarden is the household's vault.
11. **Never "own", "yours forever"** (`cap-own-apps`), never "enterprise", never a business trip, an expense policy or a team of travellers. This is not an office persona.
12. **Never covert capture** (`cap-camera-capture`): photos of the family on a trip are the family's own; a story never records guests or children "all day".
13. **Never an app name that is an ordinary word used wrongly.** `TRIP` matches case-sensitively; `Wanderer` matches as a whole word; `Surmai` and `AdventureLog` only for the apps. Check the story with the validator, not by eye.
14. **Never a real address, a real person's trip or a real company's logo** (`fake-address-real`, `logo-trademark`). A city or a country is fine as a destination; a real street address is not.
15. "Fictional family. Real software." where a family is; no exclamation mark; no em or en dash; sentence case; daylight only.

## 10. Fit: homes, rooms, furniture and casting

**Rooms and anchors** (real ids from `roles.json`; room ids are the schema's `roomRole`).

| | Ids |
|---|---|
| Rooms, in preference order | `dining`, `living`, `office`, `bedroom` |
| Fallback rooms | `kitchen`, `entry` |
| Anchor roles, in preference order | `dining-table`, `bookshelf`, `desk` |
| Fallback anchors | `couch`, `counter`, `room` |

`dining-table` is where the map is held flat and the receipts are laid out; it resolves to a farmhouse, round, oval, trestle, bar or glass table. `bookshelf` is the shelf with the atlas and the jar of stubs; it lives in `living` or `office`. `desk` is the laptop corner in `office` or `bedroom`. `couch` is where the photos are looked through together. Every chain ends in a universal role (`couch`, `counter`, `room`), so the validator's anchor check holds in any home. A garden or patio beat (`patio-seat`, `garden`) is possible for planning in morning light where the house has one, with `couch` as the last fallback. A `bicycle` anchor (garage or entry) is a variant for a cycling trip and is not in the pool, because a traveller is not a cyclist by default.

**Props.** In the engine's item list [repo, 226 types]: `pin-board` (the itinerary pinned), `book-stack`, `bookshelf`, `trunk-coffee-table`, `printer`, `console-table` and `storage-bench` (the hall where the bag waits), `coat-rack`, `shoe-rack`, `umbrella-stand`, `globe-lamp`, `table-clock`. To author (not in the item list): a paper atlas and a folded map, a jar of boarding-pass stubs, a binder of printed confirmations, a suitcase, luggage tags, a phrase list on a card. No passport, no ticket with a legible name, no readable screen. The Core appears once, on a shelf, as a stylised drawing.

**Homes that suit** (from `casting.json` and the specs in `content/houses/`; the casting is the owner's call, and a household still covers two or more archetypes):

- *The closest thing in the thirty to a flat with a shelf.* Cute Starter Cottage (`cutestarter`; a small home with a living room, a bookshelf and a couch). Then Blue Dormer Cottage (`onestory`, a dining table in a dining room), Grey Starter Cottage (`starter18k`) and Garden Nook (`gardennook`), both small.
- *Houses with a dining table and a shelf.* Palm Knoll (`palnknoll`), Mirage (`mirage`), Mediterranean Villa (`mediterranean`), Cocoon (`cocoon`), Villa Mesa Mariposa (`mesamariposa`), New Eco House (`neweco`), Modern Studio House (`modernhouse1`).
- *Apartments* (in the bible's casting, not yet in `content/houses/`, so not usable until folded in): City One-Bedroom, Two-Bedroom Flat, Garden Flat, Walk-up Duplex, Warehouse Loft, Corner Penthouse. These are the natural homes, because the brief for this persona is a dweller with a shelf, not a garage.
- *Offices (a later type of place).* Not a traveller's place. A person who works in an office is cast by their other archetype. Do not cast a business trip, an expense policy or a travel desk, which would invite "enterprise" and multi-user promises.
- *Avoid.* The flagship Brennan homes (their four archetypes are fixed). A child's room or a nursery as the traveller's room. A garage as a hero room.

**Households and ages to cast.** The family has two to six members and at least two archetypes, so the traveller is one member among others. Shapes that read as real, not as a pattern:

| Shape | Age of the traveller | Note |
|---|---|---|
| A person living alone or with a partner, in a small home | 24 to 72 | The default. A shelf, a laptop, a jar of stubs. |
| A couple who go somewhere twice a year | late 20s to 60s | Two travellers, or one traveller and one non-traveller; the second person has a different archetype. |
| A parent planning the family's one summer visit to relatives | 38 to 55 | Parent-led. A child is named in the body as the one being helped and is never the actor. |
| Grandparents arranging a long-promised visit | 63 to 76 | No assumption about their comfort with technology either way; they are not made "bad with tech" and do not need a younger person to set anything up. |
| Housemates who take a single trip together | 22 to 40 | Role `housemate`. The Spliit story. Needs no children. |
| A teen preparing an exchange or a language trip | 16 or 17 | LibreTranslate only. No chat model, no agent. A parent approves anything bigger. |
| An adult child who comes home to plan with a parent | 30 to 50 | Two travellers of different ages at one table. |
| A person who plans a trip around a long-term condition or a mobility need | any | Never the story's only trait, never an accessibility claim or advice. |

**Fleet suggestion.** No more than five of the 36 homes have a traveller, so the four rare apps stay rare. Never in a flagship home. One traveller per household unless the story needs two.

**Casting warning against stereotype.**

- The traveller is never cast because of a name, an accent, a look or a family background. Do not tie a destination to a person's name, culture or the home's décor. A person with a surname that signals one place can plan a week somewhere else, and a person who visits relatives is not a "diaspora" shorthand for a place.
- No gender, age, income or disability makes the role. Not a young woman backpacker; not a wealthy retired couple; not a "digital nomad"; not an influencer; not a man who "does the maps" while a woman "does the packing". A traveller of 24 or 74 can plan; a man or a woman or a person the cast does not label can be the planner; the one who keeps the shared costs is not the man by reflex.
- A child is never the household's translator or interpreter, and a bilingual teen is never made the go-between.
- Do not pair the traveller with "the stay-at-home who is left behind". Give the other person their own archetype and their own beat in their own room.
- Pair a traveller with a host only if each has their own beats. Do not make the host the person who "also" books the trip.

## 11. Ten user stories

Format: "As a traveller, I want ... so that ..." (no name). Each is tied to one catalog app and one registry service, with the catalog caveat and a one-line story moment (room, anchor role, what happens first). Nine are pairs, which is the 80 percent rule's side of the budget; story 10 is a pair-less beat on TRIP (no `replaces`), which the budget allows once. Every moment is a house-beat seed for the writer; the beat's own member, title, body and chips come from the writer and the validator. All stories are set at home, in daylight, before a trip or after it.

| # | User story | App (id) | Service (id) | Caveat that rides along | Moment: room, anchor, what happens first |
|---|---|---|---|---|---|
| 1 | As a traveller, I want the flights I have taken kept in one log so that the whole history of where I have been is a map I can look at together with the family. | AirTrail (`airtrail`) | Flighty (`flighty`) | A log and a map only: no live status, alerts or boarding passes. Chip Flighty only; its list also holds a `stale` service. | `living`, `bookshelf` (fallback `couch`, `room@living`): a jar of old boarding-pass stubs beside the atlas; the first thing is a hand typing last year's flights from the stubs. |
| 2 | As a traveller who goes with friends or housemates, I want the shared costs of the trip added in one place so that settling up is one calm evening and not a string of messages. | Spliit (`spliit`) | Splitwise (`splitwise`) | Moves no money. Everyone adds their share at the table at home; friends elsewhere cannot reach the Core. | `kitchen`, `kitchen-island` (fallback `dining-table`, `counter`): a pile of receipts and three mugs; the first thing is a receipt being read out and added. |
| 3 | As a traveller, I want to plan the next trip with the whole family in one place so that everyone sees the same itinerary and the same dates. | AdventureLog (`adventurelog`) | TripIt (`tripit`) | No QA screenshot; owner entry in `reviewed.json`; amd64 only. Do not say it reads confirmation emails; the family types the plan in. | `patio`, `patio-seat` (fallback `garden`, `couch`): a morning on the patio with a paper map under a cup; the first thing is two dates chosen and written down. |
| 4 | As a traveller, I want to understand a message from a host before I answer it so that I reply with care. | LibreTranslate (`libretranslate`) | Google Translate (`google-translate`) | Language models are downloaded first, which uses the internet. No quality, speed or language claim. The person decides what to answer. | `office`, `desk` (fallback `dining-table`, `room@office`): a printed message from a guesthouse beside the laptop; the first thing is the message read in the person's own language, and a short reply drafted by hand. |
| 5 | As a traveller, I want a long document from a host, such as a house-rules sheet, read on the Core so that everyone going knows what it says before we reply. | LibreTranslate (`libretranslate`) | DeepL (`deepl`) | Same caveat. No legal or immigration advice; a story never shows a visa form, an identity document or a contract, only a host's house-rules sheet. Differs from story 4: a document read by the group at the table, not one message read alone. | `dining`, `dining-table` (fallback `desk`, `room@dining`): two adults at the table with a printed house-rules sheet from a host; the first thing is the sheet laid beside the laptop. |
| 6 | As a traveller, I want the trip's photos from several phones in one album so that the family looks at them together instead of in four separate places. | Immich (`immich`) | Google Photos (`google-photos`) | First start takes a while; phone backup needs the phone on the home network; not a backup; no face-recognition claim. Over the fleet cap: use only where a home has room. | `living`, `couch` (fallback `tv`, `room@living`): the family on a couch with a printed photo book beside the laptop; the first thing is the first album opening. |
| 7 | As a traveller, I want the printed confirmations and receipts scanned and filed by trip so that I find a guesthouse's name years later with one word. | Paperless-ngx (`paperless`) | Google Drive (`google-drive`) | AI features off by default; no office document conversion; never bare "Paperless". Never a passport or insurance scan on screen. Over the fleet cap. | `office`, `bookshelf` (fallback `desk`, `dining-table`): a binder of old confirmations on the shelf; the first thing is one page going into the scanner tray. |
| 8 | As a traveller, I want the household's airline, rail and booking-site accounts and loyalty numbers in one vault so that nobody has to hunt for a password the week before. | VaultWarden (`vaultwarden`) | LastPass (`lastpass`) | Say "the Bitwarden apps", never "Bitwarden" alone; no security superlative; phone use outside the house needs remote access (held), so the scene is the table before the trip. | `office`, `desk` (fallback `dining-table`, `room@office`): the account for a booking is looked up in the vault at the table before the week begins; the first thing is a loyalty number found on a card. |
| 9 | As a traveller, I want to write up the trip after it ends, place by place, so that the journal of where we went lives in one place the family keeps. | AdventureLog (`adventurelog`) | Polarsteps (`polarsteps`) | Same caveats as story 3. The journal is written after the trip, at home. | `living`, `couch` (fallback `bookshelf`, `room@living`): two members of the family on a couch with a photo book open; the first thing is a place name typed in and a photo chosen. |
| 10 | As a traveller, I want to save places on a map and sketch a multi-day trip so that a week of ideas becomes a route and not a dozen open tabs. | TRIP (`trip`) | none (pair-less beat) | No `replaces` in the catalog; counts against the 20 percent pair-less budget. A "budget" in the listing never carries a number. Write TRIP only for the app. | `dining`, `dining-table` (fallback `couch`, `room@dining`): a map weighed down by a mug; the first thing is three pins chosen from a paper list and two crossed out. |

**Checks done on the stories.** Each app is in the catalog and in the registry service's `apps` and `storyApps`, and the service's name is in the app's catalog `replaces` (`service-app`). No story uses a `stale`, `story-excluded` or blocked service. Stories 4 to 8 are on apps over or at the fleet cap (stories 4 and 5 are both LibreTranslate); use at most one of them in a family.

## 12. Six beat seeds

Each is the first sentence a visitor reads: one pointed line on what the family put in the rented place, or on what the person did, and what the family's own copy does instead. Sentence case, no dash, no digit, at most 20 words, and no company named in the sentence (the chip carries "alternative to <Service>"). `{name}` is the member's first name from the cast; pronouns are avoided so no gender is implied. They say what the person put in and where it sits now, not what a company did: the registry holds no sourced fact about a service's price, terms or changes.

1. AirTrail, alternative to Flighty. Title: "Last year's flights, filed". "{name} types last year's flights into AirTrail, so the travel history sits on the Core, not in a rented tracker."
2. Spliit, alternative to Splitwise. Title: "The costs, settled at the table". "The group's trip costs live in Spliit on the Core now, added at the table, not in a rented ledger."
3. AdventureLog, alternative to TripIt. Title: "The next trip, planned together". "{name} plans the next trip in AdventureLog with the whole family, not in a rented itinerary app." Needs a `reviewed.json` entry.
4. LibreTranslate, alternative to Google Translate. Title: "A host's message, read at home". "A host's message that {name} once pasted into a rented translator is now read in LibreTranslate on the Core."
5. VaultWarden, alternative to LastPass. Title: "Every account in one vault". "The airline and rail accounts sit in one VaultWarden vault on the Core, not in a rented password manager."
6. Paperless-ngx, alternative to Google Drive. Title: "One word finds the guesthouse". "One word finds the guesthouse's name years later, because {name} scans each confirmation into Paperless-ngx, not a rented drive."

**Alternates if a fleet cap closes a seed** (Immich and Paperless-ngx are over it):

- Immich, alternative to Google Photos. Title: "Three phones, one album". "Photos from three phones land in one Immich album on the Core, not in three rented libraries." Needs a home with Immich headroom.
- AdventureLog, alternative to Polarsteps. Title: "The trip, written up at home". "{name} writes up the week in AdventureLog on the Core, place by place, not in a rented travel journal." Needs a `reviewed.json` entry; use it instead of seed 3 in a home where the journal is the better story.

Each seed is a single claim about where the family's copy sits, not about a company. Check each against `check-copy` and the validator's `detail-replaces` before it becomes a beat's `detail`.

## 13. Open items for the owner

- **Wiring.** Adding the persona means: a `traveller` value in the schema enum and `ARCHETYPES` (a test keeps schema, constant and `personas.json` equal); the row below in `content/story/personas.json`; the same id in the pools in `scripts/story/build-casting.mts` and `scripts/story/cast-lint.mts`; an entry in `PERSONAS` in `scripts/portal-front.mts` (`{ archetype: 'traveller', filter: 'Play' }` would put it with the gamer and the maker, or a new chip "Travel"); a chapter in the persona bible and the app table in `persona-apps.md`; and a place in `cast-plan.json`. None was done here.
- **`reviewed.json`.** AdventureLog has no QA screenshot (seed 3, stories 3 and 9). Surmai is not boot-tested and is left out of the pool.
- **Fleet cap.** Immich (18 homes) and Paperless-ngx (15) are over the 40 percent cap; VaultWarden and LibreTranslate (12) sit at it. The pool lists them last, so a cast step that applies the cap naturally gives a traveller AirTrail, Spliit, AdventureLog and TRIP first.
- **ForeFlight and App in the Air.** ForeFlight is an aviation app and should stay out of stories. App in the Air is stale and appears in AirTrail's catalog `replaces`. Decide whether to trim the catalog `replaces` for AirTrail.
- **TRIP.** It has no `replaces`. Decide whether a pair-less beat on it is acceptable, or whether `alternatives.json` should name a service for it.
- **Claims file.** `claims.json` `apps` has no entry for airtrail, trip, libretranslate or paperless (it has adventurelog, spliit, immich and vaultwarden), so the wording law for those four is the catalog description. This is a blocker for any beat on AirTrail, TRIP, LibreTranslate or Paperless-ngx: `appCheck` fails an app name it does not know, so those four need a `claims.json` entry (with `mayDescribeAs`) before a story names them.
- **Pronunciation.** `Spliit` is already pinned in `lexicon.json`. AirTrail, AdventureLog and LibreTranslate read correctly by default [?]; TRIP in capitals may be read as an acronym, so check `story:voice` on first use.
- **Sources.** Sections 5 to 7 are inference. Before a chapter in the persona bible, read primary sources (a travel-planning survey, the open-source projects' own pages) and tag them [V] or [S].
- **Name.** The persona is "Traveller" (British, matching "organiser"). The visible filter label is the owner's call.

---

## personas.json row

Same fields as the existing rows in `content/story/personas.json` (`label`, `description`, `example`, `rooms`, `fallbackRooms`, `anchorRoles`, `fallbackAnchorRoles`, `apps`), keyed by the archetype id. The app order puts the rare apps first (AirTrail, Spliit, AdventureLog, TRIP) and the apps over or at the fleet cap last. `ci-hermes` is not in the pool: an agent beat is a separate beat, not a pool beat.

```json
{
  "traveller": {
    "label": "Traveller",
    "description": "Plans trips at the table and files the itinerary, the flight log and the photos once home.",
    "example": "Rune",
    "rooms": ["dining", "living", "office", "bedroom"],
    "fallbackRooms": ["kitchen", "entry"],
    "anchorRoles": ["dining-table", "bookshelf", "desk"],
    "fallbackAnchorRoles": ["couch", "counter", "room"],
    "apps": [
      "airtrail",
      "spliit",
      "adventurelog",
      "trip",
      "libretranslate",
      "vaultwarden",
      "paperless",
      "immich"
    ]
  }
}
```

## Verification run

A read-only script (kept in the session scratchpad, not in the repo) checked this file on 2026-10-20 and passed:

- All eight pool apps are in `catalog-apps.json`, `inLiveStore: true`, `storySafe` `yes` except AdventureLog (`with-caveat`, `qa: no-screenshot`). None is `avoid`.
- All fourteen services in section 3 exist in `services.json` with no `stale` or `story-excluded` flag and `alternativeToForm: ok`.
- All nine story pairs are valid: the app is in the service's `apps` and `storyApps`, and the service's name is in the app's catalog `replaces` (the `service-app` rule). Story 10 is the pair-less TRIP beat (empty `replaces`).
- Rooms are in the schema's `roomRole` enum and anchor roles in `ROLE_IDS`; every row anchor is in `roles.json`.
- Six seeds and two alternates, each at most 20 words, no digit, titles at most six words, and none matches an error pattern in `claims.json` `bannedPhrases`; the ten user stories and moments match none either. The reference prose (sections 1 to 8, 10, 13) names banned phrases only to forbid them or to quote the catalog, and section 9 is the list of them. No em or en dash, double hyphen, exclamation mark or emoji anywhere in this file.
- No other repo file was created or edited for this persona.
