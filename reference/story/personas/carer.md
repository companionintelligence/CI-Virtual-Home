# Carer (`carer`)

Deep dive for one proposed persona, written 2026-10-20 as a draft for the owner. Category: Host and care (`care`). Companion OS, Companion Memory and Companion Agents are in beta. Nobody here is a customer: ages, households, names and lines are design choices for fictional characters. The shape follows the Host chapter of [persona-bible.md](../persona-bible.md) (3.6) and the tables of [persona-apps.md](../persona-apps.md); the law for every word is `content/story/claims.json`.

**One line.** Looks after a parent, partner or relative and keeps the letters, the calendar and the notes in one place, with that person's say.

**Not the host.** The host runs the house for all who live in it: meals, plants, guests, the shared list. The carer does one other person's practical side: their post, their dates, their accounts and their photos, always at their pace. A family can have both; a household has one list app and one calendar app, so the two share them (section 10).

**Not the organiser.** The organiser keeps the household's own records and a practice of one. The carer keeps someone else's paperwork, and the first rule of the persona is that the other person decides what goes in.

**Evidence key.** Nothing in this file is a statistic and no outside page was read for it. Everything about how people behave is an editorial synthesis [?] of how someone who looks after a relative's paperwork tends to work. Only the catalog and registry facts are checked, and the checking is listed in section 14.

**The first rule, said once.** This persona is written as record keeping only. The stories show the post, the diary, the list, the photographs and the passwords of a home. They never show or claim the care itself: no medication, monitoring, safety or advice wording, no claim that the Core meets a rule (section 9), no condition named, no clinic or hospital. The person looked after makes their own choices and is never a plot device.

| Field | Value |
|---|---|
| id, label | `carer`, Carer |
| Category | `care` (Host and care) |
| Comfort with technology | 2 of 5 (range 1 to 4) |
| AI stance | wary to curious; not proud, not hiding |
| Pace and sentences | 135 to 150 words a minute; 6 to 12 words, plain, in short lists |
| Top three Hub apps by story strength | Radicale, HomeHub, Paperless-ngx |
| Best homes | Cute Starter Cottage, Blue Dormer Cottage, Valley-View Villa, Twin Gable House (display names; section 10) |
| Most similar existing archetype | `host` |

---

## 1. Who

It is a Tuesday in late morning and the light is on the dining table. Idris (57), who is the example name for this file and not a cast member yet, has carried the week's post in from the front door and put it down between his mother and himself. She opens her own envelopes. She says which ones go in the tray and which go in the bin, and he writes the date of anything that has one on the paper calendar by the fridge, in her handwriting if she wants to write it. Two letters are about appointments, one is from the council and one is a catalogue. Before the scanner there was a carrier bag, and before the carrier bag a drawer. He works three days a week and does not want to be the person who knows where everything is, but he is, and what he wants is to stop being the only one. At the counter in the afternoon light he reads out the week's list, and in the half hour he keeps for himself he listens to a book. Nothing in the day is dramatic, and nothing in the stories should be.

The role has no age or gender. It can be a woman of seventy-four whose husband stopped being able to face the post, a man of fifty-eight with his mother in the next room, a twenty-four-year-old grandson who moved in, a sister, a brother, a friend who shares a house, a husband of forty with a wife of thirty-eight. The person looked after can be sixty or ninety, or any age over eighteen; a child is never the person looked after in these stories, and nobody under eighteen is cast as the carer. They live in the same home or close by, but the stories keep the care to the one home, because remote access is not claimed. Many are reluctant adopters: they did not ask for a computer on a shelf, they asked for the paperwork to be in one place, and they will judge the Core by whether the letter they need is found. Some have a paid job, children or both, and some do not think of themselves as a carer at all. These are design choices for fictional characters, not a finding about real people.

## 2. What they are responsible for

- **The post and the forms.** Opening it with the person, deciding with them what to keep, filing it, and knowing which letter is the one that mentions a date.
- **The dates.** The calendar of appointments and visits, kept so that the person can read it too and the paper copy on the fridge matches the file.
- **The practical week.** The shopping list, the house jobs, who does Thursday and who does Saturday, shared with a sister, a neighbour or a partner who also helps.
- **The accounts, only with the person's say.** The sign-ins to the accounts the person has asked them to manage, written down once, with the person choosing which ones go in the vault and which stay out of it.
- **The photographs and the books.** The person's photographs, gathered into albums the person picks; the book they follow together in the evening.
- **A page of the person's own notes.** Their questions for the next appointment, in their own words. Record keeping only.
- **Their own life.** A job, a house of their own, other people who need them. Every carer in the cast has at least one beat that is theirs and is not about the person looked after.

What it does not include, in the stories: the care itself, anything medical, anything legal or financial that needs a professional, and anything that decides for the person.

## 3. What they rent today

Registry ids are from `content/story/services.json` (read 2026-10-20). All ten have no flags, `alternativeToForm` ok and `storyStatus` ok. Every one is named only in the form "<App> is an alternative to <Service>" and never in a sentence about what the company does.

| Service (registry id) | Category | What it held for this persona | Hub app that is an alternative to it |
|---|---|---|---|
| Google Drive (`google-drive`) | data | The scans of letters, in one folder named for the person, beside the holiday album | Paperless-ngx |
| Evernote (`evernote`) | notes | A notebook of pages about calls made and forms filled in, one per person or per agency | Paperless-ngx (as PDF files only) |
| Google Calendar (`google-calendar`) | productivity | The person's appointments, mixed in among the carer's own meetings | Radicale |
| Cozi (`cozi`) | home | The family's shared list and notes, in one person's account | HomeHub |
| Tody (`tody`) | home | The cleaning and house-jobs rota, on one phone | Donetick |
| Google Photos (`google-photos`) | photos | The person's photographs, scattered over phones | Immich |
| Audible (`audible`) | books | The evening book, in one listener's library | Audiobookshelf |
| LastPass (`lastpass`) | identity | The sign-ins for the accounts the carer manages with the person's say | VaultWarden |
| Apple Health (`apple-health`) | health | A place on the person's phone for entries they chose to keep, which the carer does not read or manage | MediKeep (background only) |
| MyChart (`mychart`) | health | The clinic's own portal, where the clinic sends its messages | MediKeep (background only) |

**What stays where it is.** The clinic's portal, the bank, the council and benefits websites, the pharmacy, the family message group and the postal service do not move to the Core, and the stories never suggest they do. They are institutions' channels. The Core holds the family's copy of what came through them. One service listed beside these apps is never named: OurHome is flagged stale in the registry, and both HomeHub and Donetick list it.

## 4. What the Hub offers them

Eight apps, all live in the store and `inLiveStore`, listed in order of story strength (this is also the order of the pool in the `personas.json` row, which decides which app a family's card shows first). "Fleet" is how many of the thirty families use the app as a beat's `app` in the working tree on 2026-10-20; the cap is 12 of 30 (14 of 36). The twenty-seven older families change when they are rewritten.

**Radicale** (`radicale`). Replaces Google Calendar, iCloud Calendar. Fleet 0.
- For the carer: the person's appointments in one calendar on the Core, read at home by both of them and by a sibling who lives there too.
- Say: "Radicale keeps the appointments calendar on the Core."
- Caveat from the catalog: no QA screenshot on `origin/main`, so a beat that names it needs an owner entry in `content/story/reviewed.json`. Added here: it serves calendars and contacts, and a calendar app on each device does the reading. No sharing carries over from Google Calendar (persona-apps.md). Calendar is one kind per household (`household-kind`).

**HomeHub** (`homehub`). Replaces Cozi, OurHome (never name OurHome, it is stale). Fleet 7.
- For the carer: the week's list and the handover notes, shared by the people who share the week.
- Say: "HomeHub keeps the week's list and notes on the Core."
- Caveat from the catalog: none listed. Added here: its listing names notes, shopping, chores, expenses, a recipe book and an expiry tracker, and does not name a calendar, so no beat calls it one. One household, not an account for each person. The shopping list is not at hand in a shop aisle, because remote access is not claimed: the carer copies it onto paper.

**Donetick** (`donetick`). Replaces Tody, OurHome (never name OurHome). Fleet 1.
- For the carer: a rota of the house jobs among the adults who share the week.
- Say: "Donetick keeps the rota for the house jobs on the Core."
- Caveat from the catalog: notifications use Telegram or Pushover, which are outside services, so no beat says a reminder stays on the Core. Added here: a job on the rota is a house job. Never a task about a person, a medicine, a check or a whereabouts.

**Audiobookshelf** (`audiobookshelf`). Replaces Audible, Apple Podcasts. Fleet 7.
- For the carer: a book two people follow, with the app remembering where each listener stopped.
- Say: "Audiobookshelf plays the family's audio files and remembers each listener's place."
- Caveat from the catalog: none listed; the claims entry says per-user progress is this app's feature, and nothing more. Added here: it plays files the family holds. No importer from an Audible library is claimed, so no beat says a purchased library moves across.

**Paperless-ngx** (`paperless`). Replaces Evernote, Google Drive. Fleet 15, over the cap. Never bare "Paperless".
- For the carer: the post, scanned, tagged and searchable, filed on the Core.
- Say: "Paperless-ngx files the scans on the Core."
- Caveat from the catalog: AI features are off by default; office document conversion is not wired up, so scans and PDFs only. Added here: a scanner is a prop to author, and no beat says a scan is a valid or official copy of anything.

**Immich** (`immich`). Replaces Google Photos, iCloud Photos. Fleet 18, over the cap.
- For the carer: the person's photographs in albums the person picks.
- Say: "Immich keeps the photographs on the Core, in albums the family picks."
- Caveat from the catalog and claims: the first start takes a while; phone backup needs the Immich phone app on the home network; no face recognition and no "sorts your photos" claim. Added here: the Core is not a backup.

**VaultWarden** (`vaultwarden`). Replaces LastPass, 1Password. Fleet 12, at the cap. Written "VaultWarden"; "works with the Bitwarden apps", never "Bitwarden" alone.
- For the carer: the sign-ins for the accounts the person has asked them to manage, in one vault.
- Say: "VaultWarden holds the sign-ins on the Core and works with the Bitwarden apps."
- Caveat from the catalog and claims: an unofficial Bitwarden-compatible server; no security superlative; phone use away from home needs remote access, which is held, so the scene stays at home. Added here: it says nothing about who may open the vault, so no legal-authority claim.

**MediKeep** (`medikeep`). Replaces Apple Health, MyChart. Fleet 0. Catalog `storySafe` is `with-caveat`, `qa` is `not-boot-tested`.
- For the carer: a page for the person's own notes, in their own words.
- Say: "MediKeep keeps the notes on the Core."
- Caveat from the catalog: record keeping only; no medical claims, no HIPAA or similar language; its own listing notes say it has not been boot-tested on a live Hub device. Added here: background app only. It is named in a beat's `with`, never as a beat's `app`, never as a hero, and a beat that names it needs an owner entry in `content/story/reviewed.json`.

**Do not reach for these** (on a carer's beat):
- Frigate, cameras, motion or presence: `f-surveillance`, `cap-camera-capture`. Watching a person in their home is the opposite of the persona.
- Home Assistant for anything about the person's whereabouts, doors, falls or night: `f-medical-care`, `sec-safety-people`.
- Companion Memory holding a person's life as a timeline, and any agent that "notices": `f-proactive`, `cap-omniscient`. Memory is beta and is about the carer's own context at most.
- Hermes or OpenClaw contacting a clinic, a council or a shop: `f-agent-autonomy`.
- Kiwix (`storySafe` avoid), OurHome (stale), the Audible and MyChart accounts themselves (nothing is imported).

## 5. Where they spend time

Kinds of places, not a list of sources. All of it is editorial [?]. No community, forum or organisation was read for this file; no quote or number is invented.

- **At home:** the hall table where the post lands, the dining table, the fridge door with the paper calendar, the kitchen counter, the sofa with a book.
- **In queues:** waiting rooms, the post office, the pharmacy counter, the council office. Waiting, with a phone, is when they read.
- **Support:** the national carers' charity in the family's country, its local meet-ups and its phone line; a community centre or a library; a faith or neighbourhood group; a sibling or a friend who also helps. They trust people who have done it, and the household's tech person (a niece, a colleague, a neighbour) is who they call when something breaks.
- **Media:** the radio, podcasts and audiobooks for the half hour that is theirs; the local paper; the forms' own plain-language guides. They do not read tech blogs.
- **Never:** a feed that calls them a hero or an angel, or a product page that says "peace of mind".

## 6. How they talk

Pace 135 to 150 words a minute, sentences of 6 to 12 words, none past 20. Plain, patient, a little dry; understated; lists with a steady beat ("letters, dates, the shop"). Humour is mild and about the forms: the form that asks for the other form. Warm toward the person looked after, brisk about the system. They say "my mother", "he", "she" and the person's name, never "the patient", "the elderly", "a senior", "my loved one" or "my charge".

**Owns:** post, letter, form, reference number, appointment, the week, rota, handover, "with his say", "her pile", the tray. **Eye-rolls:** caregiver journey, burden, hero, angel, respite as a sales word, ageing in place, smart home for seniors, empower, solutions, peace of mind, "so easy". **Turns them off:** pity, praise for being brave, jargon (container, self-hosted, stack), any promise of time saved, and any line that talks over the person looked after.

One scripted adult line in caption voice is allowed per cut at most and never praises the product. A scripted caption-voice line would be: "The letters go in one place now. My mother opens them, and the dates go on the fridge." (about 18 words; no outside quote.)

## 7. Comfort with technology and attitude to AI

**Comfort.** 2 of 5, range 1 to 4. A carer at 1 needs the scanner and the list set up and is helped by the household's tech person. A carer at 4 runs the family's other hobby server and does this chore the same way. Some can use a phone calendar and a scanner app; few have edited a setting. They call a niece, a colleague or the school's IT ticket line.

**AI stance, the honest range.**
- *Wary.* "Not near my father's letters." They want a scanner and a search box and nothing that reads anything. This is the commonest stance and the fleet should show it.
- *Curious about one chore.* They would let a model on the Core write a first-pass plain-words summary of a utility notice, and they would read the notice against it.
- *Already uses a chat model for a hard email.* They would rather it ran on the Core, and they say so in one sentence.
Nobody is proud of wanting it. None is hiding it either; the persona is a reluctant adopter, not a secret one.

**Rule.** AI is never the hook or the first beat. A model on the Core does one named chore on the carer's own paperwork, the carer reads the original against it, and then the carer decides. It never speaks to the person looked after, never reads the notes in MediKeep, never decides anything about a person's care, never contacts a third party and never advises. An agent beat has an `agent` and an adult as `approval` (rule `age-chat`; every carer is 18 or older). The age rule 16 changes nothing here: no one under eighteen is cast.

## 8. Objections and the honest limits

| Objection (in the persona's words, written for this file, not quoted) | Honest answer |
|---|---|
| "I do not want to be the IT department." | Nothing makes you one. Companion OS is in beta; someone sets the Core up once, and the household's tech person is the one called when it breaks. |
| "Can I get at it from the waiting room?" | No. Remote access is not claimed, so every scene is at home on the home Wi-Fi. The paper list and the paper calendar stay on the fridge. |
| "Who else can see my father's letters?" | One household, one Core. The apps have their own sign-ins where they have any, and nothing here promises that one person cannot see another's. Who may open what is a family agreement, not a feature. |
| "What if the Core breaks?" | The Core is not a backup. Keep the paper. Say it lightly and early. |
| "Does it talk to the clinic or the council?" | No. Their portals stay where they are. The Core holds the family's own copy. |
| "Does it remind him about anything?" | No story claims a reminder, a check or a watch. Donetick's notifications use Telegram or Pushover, which are outside services. |
| "Am I allowed to hold his papers?" | We do not answer that. It is not advice and no story gives it. |
| "Will my sister be able to open it?" | At home, on the home Wi-Fi, yes. From her own house, no. |
| "Is it safe?" | Say where the files sit: on the Core, by default. Never "safe", never "secure". |
| "I had my photos in the cloud already." | Immich is a slow first start and not a backup; the cloud library does not move on its own. |
| "Can it take over my audio books?" | It plays audio files the family holds. No importer is claimed. |
| "Does Companion Memory help?" | Not in this persona. Memory is beta, and a person's life as a timeline is not a carer's tool. |

Always, on every carer beat: Companion OS is in beta; installing apps uses the internet; remote access is not claimed; the Core is not a backup; one household, one Core.

## 9. Claims boundary

This section quotes banned words in full. Sections 5 and 6 name a few of them only as the words this persona rolls its eyes at, and no line a visitor reads may use any of them. The rules are the ids of `content/story/claims.json`; the regulated-domain rule is that health, legal, finance, children's data and education records are written without any compliance, certification, safety or security-guarantee claim and without advice, and say only what the app does and where the files live.

| Never say or imply | Claim ids | Say instead |
|---|---|---|
| Medication, reminders for medicine, dosage, a diagnosis, "clinical", "therapy", "heals", "medical records are", falls prevented | `f-medical-care`, `sec-medical` | "MediKeep keeps the person's own notes on the Core." (background only) |
| That the software looks after, protects, keeps safe or watches a person; "peace of mind", "safe for" an older person, "keeps Dad safe", alarms, check-ins | `f-medical-care`, `sec-safety-people`, `f-surveillance`, `cap-camera-capture` | Describe the record: the post, the dates, the list |
| HIPAA, GDPR, "compliant", "certified", "audited", "privileged"; any claim that the Core meets a rule for health, legal or finance data | `f-compliance`, `sec-compliance` | "Paperless-ngx files the scans on the Core." |
| Legal validity of a scan, a signature or a power of attorney; "court-ready"; tax or benefits eligibility; "financial advice" | `f-legal-tax-fin`, `legal-claims` | Describe the document workflow only. Name no legal instrument and no benefit |
| From the clinic, the waiting room, the road, "while you are away", a sibling in another town, a shared link, VPN | `f-remote-access`, `cap-remote-access` | "On the home Wi-Fi" or no place at all |
| A separate private space for each person; "only Mum can open this"; "your sister cannot see it" | `f-multi-user`, `cap-multi-user` | One household, one Core. Say nothing of isolation |
| Never leaves, nothing goes to the cloud, offline, off the grid, zero telemetry | `f-never-leaves`, `sec-never-leaves`, `sec-offline` | "Stays on the Core by default." |
| Unhackable, secure, private, safe on their own; "bank-grade"; fear of fraud, hackers, a breach or identity theft | `f-security-guarantee`, `sec-absolute`, `sec-fear` | State the mechanism: where the file sits. Never open on a threat |
| An agent that books, pays, emails, orders, cancels or phones for the carer; an agent that notices | `f-agent-autonomy`, `cap-autonomy`, `f-proactive` | The agent prepares; the adult approves. Not in the first beat |
| A cloud model key; messages "private" in a messenger | `f-cloud-model`, `f-messenger-private` | Use only the Core's local model, if any |
| A price, a saving, a time saved ("saves hours", "in minutes"), a number of apps, a speed | `f-prices`, `f-savings`, `f-duration`, `f-unmeasured` | Describe the app, not the arithmetic |
| A testimonial, a case study, "real families", a real carer, a customer | `f-testimonial`, `f-real-person` | "Fictional family. Real software." |
| What the old service does to people: spies, sells, steals, watches, holds hostage | `incumbent-attack`, `f-incumbent-claims` | "<App> is an alternative to <Service>", the second chip |
| "Own" with an app ("your own apps"), "yours to keep" | `cap-own-apps` | "Your Core, your data, no API bill" |
| A home server, NAS, appliance, assistant, chatbot, "log in", the "app store", the "Portal", "easy", "simple" | `vocab-*`, `buzz-simple-claims` | Core, agent, "sign in", "the Companion Hub store" |
| A person as a "patient", a "burden", a "senior", an "elderly parent"; a condition by name | persona rule; `sec-safety-people` | The person's name, or "his mother" |
| Pointing the persona at a child as the person looked after, or a child as the carer | children's data; age rule 16 | Not cast |

Voice of everything a visitor can read: sentence case, no em or en dash, no exclamation mark, no ad-speak, daylight only, the beta line beside any software claim, the call to action "See Companion Core" at ci.computer/core.

## 10. Fit

**Rooms and anchors.** The persona's rooms are `dining`, `office` and `kitchen`, with `living` and `entry` as fallbacks. The anchor roles in preference order are `dining-table`, `desk`, `counter`, `fridge`, `bookshelf`; fallbacks are `couch`, `front-door` and `room`. All of them resolve in the closed set of `content/story/roles.json`: `dining-table` and `desk` for the post, `fridge` for the paper calendar, `counter` for the list and for the notes, `bookshelf` and `couch` for the book and the photographs, `front-door` (always resolves) for the post arriving. Do not use `bed`, `crib` or any bedroom for a carer beat: a carer in a bedroom reads as care, and the persona is the paperwork.

**Props.** From the home's item list: the dining table, a desk, a laptop, a bookshelf, the fridge, a counter. To author or confirm, one by one, without clipping walls or other props: a scanner, a paper tray, a wall calendar, a notepad, a speaker on a shelf, a shopping list on the fridge. Never: a pill box, a walking aid or wheelchair as a signal of the person's state, a hospital or bedside, a stethoscope, an old hand held in a young one, a phone held in a shop aisle.

**Shots.** Waist height, hands and objects first, two people in frame at the table, side by side. The person's hands choose, the carer's hands file. No screen is readable. The disc monogram for the person and the carer both; no face. The paper first, the app chip second.

**Homes.** Any home with a dining table, a kitchen and either an office or a corner with a desk. Candidates (the cast plan decides, and each recast must pass `cast-lint`):
- **Cute Starter Cottage, Blue Dormer Cottage, Twin Gable House** (grandparent households today; no adult whose job it is). One adult of 35 to 60 who lives there: an adult child, a partner or a sibling. Not by reflex a daughter.
- **Riverbend Drive** (grandparent household with a parent of 38 today): recast one adult as the carer rather than adding a person, so the family is not larger.
- **Valley-View Villa** (a couple in their sixties): one partner as the carer of the other, with the other's own beats as maker, host or builder.
- A couple in a younger home where one partner looks after the other: `solo-or-couple`.

**Household shapes and ages to cast.** A fleet of five to seven carers should show this spread:

| Shape | Household type | Carer's role and age | The person looked after, with their own archetype and beats |
|---|---|---|---|
| Partner looks after partner | `solo-or-couple` | `partner`, 40 to 80 | `maker`, `host` or `builder`, 40 to 85 |
| Adult child lives with a parent | `grandparents` or `older-kids` | `adult-child` or `parent`, 30 to 62 | `organiser`, `host` or `maker`, 65 to 90 |
| Adult grandchild lives with a grandparent | `grandparents` | `adult-child`, 20 to 28 | `maker`, `builder` or `host`, 70 to 90 |
| Sibling or friend shares the house | `solo-or-couple` | `housemate`, 25 to 70 | any, 25 to 85 |
| Parent with children at home also helps a parent | `older-kids` | `parent`, 38 to 55 | `host` or `maker`, 70 to 85 |

**One list app and one calendar app per household** (`household-kind`). A family that has a host with KitchenOwl or Mealie, or Companion Planning, Yuvomi or Nextcloud as its calendar, gives the carer a different app for those beats: Donetick for the rota, Audiobookshelf, VaultWarden, Paperless-ngx or Radicale where the family's calendar is not already something else.

**Fleet headroom.** Paperless-ngx (15 of 30), Immich (18) and VaultWarden (12) are at or over the cap of 12. Lead with Radicale (0), HomeHub (7), Donetick (1) and Audiobookshelf (7); use the other three only where a family drops one of them elsewhere.

**Casting warning.** A role is never given to a person by reflex. The carer is not the daughter, the wife or the eldest child by default; for any fleet of three or more carers no more than 65 percent come from one gender-coded name set, judged by the name and the pronouns, as for every archetype (story v3, decision 2). The person looked after has their own archetype and their own beats: they choose, they speak in their own captions where an adult may, and they are never the object of a beat. They are not defined by age or by a condition, and no condition is named anywhere. No culture is a role: a multi-generational home is not a "type", and nobody is cast as a carer because of a name. The person looked after is an adult; a child is never the person looked after, and nobody under eighteen is cast as a carer.

Candidate first names, unused in the cast on 2026-10-20 and off the avoid list: Idris, Nomvula, Teodor, Rosalind, Anselm, Farida, Kalani, Dorothea.

## 11. Ten user stories

Format: "As a carer, I want <job> so that <outcome>." Each story is tied to one catalog app and one registry service, with the honest caveat and a one-line moment. The chip pair is the app name, then "alternative to <Service>". Stories 9 and 10 both use MediKeep as a background app; a family uses at most one of them. Rooms and anchors are the closed sets of `schema/family.schema.json` and `roles.json`.

**US1. Paperless-ngx, Google Drive.** As a carer, I want to scan the post for the person I look after into one place, with their say, so that the letter we need is found by who sent it and not by a hunt through a pile.
- App `paperless`. Service `google-drive`. Caveat: scans and PDFs only; AI features off by default; never bare "Paperless"; no scan is called valid or official.
- Moment: `dining` room, anchor `dining-table` (fallback `desk@office`, `front-door@entry`). The first thing: the person opens the envelopes and says which ones go in the tray; only then does the scanner run.

**US2. Paperless-ngx, Evernote.** As a carer, I want the old pages I kept about the person's forms and calls to sit with the post, so that the history is one search and not two places.
- App `paperless`. Service `evernote`. Caveat: PDFs only; the notebook does not move as a notebook; no importer is claimed (the Joplin Server route is a different app and not part of this persona); the PDF export path should be checked before shooting.
- Moment: `office` room, anchor `desk` (fallback `dining-table`, `room@office`). The first thing: the carer drops a folder of exported pages into the same tray as the week's scans.

**US3. Radicale, Google Calendar.** As a carer, I want the person's appointments in one calendar on the Core that we can both read at home, so that the week starts from one list and the paper calendar on the fridge says the same.
- App `radicale`. Service `google-calendar`. Caveat: no recorded QA run (owner entry in `reviewed.json`); calendars and contacts only; a calendar app on each device does the reading; no sharing carries over; home Wi-Fi only.
- Moment: `kitchen` room, anchor `fridge` (fallback `counter`). The first thing: the date goes on the paper calendar by the fridge, in the person's handwriting, before it goes in the file.

**US4. HomeHub, Cozi.** As a carer, I want one list and one set of notes that everyone who shares the week can add to, so that the shopping and the handover are not in one person's head.
- App `homehub`. Service `cozi`. Caveat: a list, notes and chores, not a calendar; the list is not at hand in the shop aisle, so it is copied onto paper; one household, no account per person.
- Moment: `kitchen` room, anchor `counter` (universal). The first thing: the carer reads the list at the counter, then copies it onto the paper pad before leaving for the shop.

**US5. Immich, Google Photos.** As a carer, I want the person's photographs gathered into albums they pick, so that a birthday album is a search away and not a hunt through three phones.
- App `immich`. Service `google-photos`. Caveat: the first start takes a while; the phone app needs the home network; not a backup; no face recognition or "sorts your photos" claim. Over the cap: reserve.
- Moment: `living` room, anchor `couch` (fallback `bookshelf`, `room@living`). The first thing: the person chooses three photographs from a shoebox of prints, and the carer scans only those.

**US6. Audiobookshelf, Audible.** As a carer, I want a book we both follow at our own pace, so that each of us picks up where we stopped.
- App `audiobookshelf`. Service `audible`. Caveat: plays audio files the family holds; no importer from an Audible library is claimed; the claim is each listener's place and nothing about privacy or separation.
- Moment: `living` room, anchor `bookshelf` (fallback `couch`). The first thing: a speaker on the shelf starts at chapter twelve, and the carer's own place is a different chapter.

**US7. Donetick, Tody.** As a carer, I want a rota for the house jobs among the adults who share the week, so that Thursday's bins and Saturday's shop have a name against them.
- App `donetick`. Service `tody`. Caveat: notifications use Telegram or Pushover, which are outside services; a job on the rota is a house job and never a task about a person, a medicine or a whereabouts.
- Moment: `kitchen` room, anchor `kitchen-island` (fallback `fridge`, `counter`). The first thing: a sheet on the fridge with a name written against each job, then the same rota on the Core.

**US8. VaultWarden, LastPass.** As a carer, I want the sign-ins for the accounts I manage with the person's say in one vault, so that I do not ring them for a password every time and they know exactly which accounts are in it.
- App `vaultwarden`. Service `lastpass`. Caveat: an unofficial Bitwarden-compatible server; "works with the Bitwarden apps"; no security superlative; the scene stays at home; no claim about who may open it. At the cap: reserve.
- Moment: `office` room, anchor `desk` (fallback `dining-table`, `room@office`). The first thing: the person says which accounts go in and which stay out, and the carer writes only those.

**US9. MediKeep, Apple Health (background only).** As a carer, I want a page where the person writes their questions for the next appointment, so that the visit starts from their words.
- App `medikeep`. Service `apple-health`. Caveat: record keeping only; not boot-tested; named in `with`, never the beat's `app`; needs an owner entry in `reviewed.json`; no medical claim.
- Moment: `kitchen` room, anchor `counter`. The first thing: the person writes the questions by hand on the notepad, and types only what they ask to be typed.

**US10. MediKeep, MyChart (background only).** As a carer, I want the person's own notes after a visit kept in their words in one place at home, so that the next visit starts from them, while the clinic's own portal stays where the clinic sends its messages.
- App `medikeep`. Service `mychart`. Caveat: not connected to any clinic or portal; background only; record keeping only; a weaker use of the pair, since MyChart is a clinic's own channel. Reserve behind US9.
- Moment: `living` room, anchor `bookshelf` (fallback `couch`). The first thing: the person reads aloud what they wrote after the visit, and the carer keeps the paper original.

## 12. Six beat seeds

Each is the first sentence of a beat's body, 20 words or fewer, sentence case, no dash, no exclamation mark. They say what the service held and what the family's copy does instead on the Core. They name services only as the old place, never in a sentence about what a company does. No seed says "learned" or "charged": those would be claims about a company that `f-incumbent-claims` stops.

1. Her father's letters shared a Google Drive folder with the holiday photos; Paperless-ngx keeps each scan, tagged, on the Core. (20 words; US1)
2. His mother's appointments hid among his meetings in Google Calendar; Radicale gives them a calendar on the Core. (18; US3)
3. The week's list lived in one person's Cozi account; HomeHub keeps it on the Core for the whole house. (19; US4)
4. The house jobs sat in Tody on one phone; Donetick keeps the rota on the Core, shared by name. (19; US7)
5. The sign-ins for his uncle's accounts sat in LastPass; VaultWarden keeps them on the Core, and his uncle picks which. (20; US8)
6. The novel lived in one person's Audible app; Audiobookshelf plays the family's files from the Core and keeps each place. (20; US6)

## 13. The `personas.json` row

Add as `archetypes.carer` in `content/story/personas.json` when the owner decides. The `example` is a placeholder name until the cast plan casts the first carer.

```json
"carer": {
  "label": "Carer",
  "description": "Keeps the post, the calendar and the notes for a parent, partner or relative they look after, with that person's say.",
  "example": "Idris",
  "rooms": ["dining", "office", "kitchen"],
  "fallbackRooms": ["living", "entry"],
  "anchorRoles": ["dining-table", "desk", "counter", "fridge", "bookshelf"],
  "fallbackAnchorRoles": ["couch", "front-door", "room"],
  "apps": ["radicale", "homehub", "paperless", "donetick", "audiobookshelf", "immich", "vaultwarden", "medikeep"]
}
```

Wiring that goes with the row, for whoever adds the archetype (none of it done here): the `ARCHETYPES` list in `assets/story/types.ts`, the `member.archetype` enum in `content/story/schema/family.schema.json`, `ARCHETYPES`, `PREFS` and `ROOM_PREF` in `scripts/story/build-casting.mts`, `POOLS` and `JOBS` in `scripts/story/cast-lint.mts`, and the `PERSONAS` filter list in `scripts/portal-front.mts` (the chip for the `care` category). A test keeps the three archetype lists equal.

## 14. Checks and open questions

**Checked, 2026-10-20, by reading the files.** All eight apps in the row are catalog ids, `inLiveStore`, with `storySafe` yes except `medikeep` (with-caveat), and none is avoid. Every service in section 11 is in the registry with no flags, `alternativeToForm` ok, `storyStatus` ok and a link of yes; each app lists the service in its own `replaces` and the registry lists the app under the service (`storyApps`). The chip lines "<App> replaces <Service>" and "alternative to <Service>" for all ten pairs hit none of the error-severity banned phrases. Every room is in `roomRole` and every anchor role is in `roleId` of the schema. Sections 11 and 12 and the row were run through the error-severity banned phrases of `claims.json`.

**Open questions for the owner.**
1. **The label.** "Carer" is the British, Irish and Australian word; US readers say "caregiver". The brief fixed "Carer"; the lander chip for the category is "Host and care", so the persona word may stay in the family cards only. The word "caregiving" in `f-medical-care` bans a claim about care, not the persona.
2. **Is a carer a job?** `cast-lint` demands a job archetype for a couple. A couple of a carer and a retired maker fails it unless `JOBS` takes `carer` or the couple has a second adult with a job. The persona is unpaid work; decide.
3. **MediKeep in the pool.** It is not boot-tested. Keep it in the pool as a `with` only, or leave it out of the row until it is boot-tested. Stories 9 and 10 are reserve.
4. **Claims entries.** `claims.json` `apps` has no row for Paperless-ngx, Radicale, HomeHub, Donetick or MediKeep; the validator reads `catalog-apps.json`, so nothing fails, but the wording above is mine and should be added there if the owner approves.
5. **Unverified edges.** The Evernote-to-PDF export path (US2) and the claim that no Audible importer exists (US6) were not checked against a listing; the first should be checked before a shoot.
6. **The example name** "Idris" is a placeholder.
