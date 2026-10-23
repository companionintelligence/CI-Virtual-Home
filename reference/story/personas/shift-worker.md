# Shift worker (`shift-worker`)

Deep dive for one proposed archetype. Draft for the repo, written 2026-10-20. Category: Run the household (`household`). Nearest existing archetype: `organiser`.

Nobody here is a customer. Ages, jobs, homes and lines are design choices for fictional characters. Statements about how people live are editorial synthesis, tagged [?] when a reader could take them for a fact; nothing below is a statistic and nothing is a quotation. Statements about the registry and the catalog are checked against `content/story/services.json`, `content/story/catalog-apps.json` and `content/story/claims.json` as read on 2026-10-20. Read this with [personas.md](../personas.md), [persona-apps.md](../persona-apps.md) and [persona-bible.md](../persona-bible.md), which win wherever they disagree.

The case for this persona in one paragraph. None of the fourteen archetypes is defined by a rota. A shift worker has a different problem from an organiser: not paper, but time. The household has one week and the person on the rota keeps a different clock inside it. Seven apps the catalog calls story safe do exactly this job, each with a replaced service the registry lets a story name, and none of them is a chat model, so the persona adds no age-16 rule and no AI hook. The story must be told in daylight: coming home in the morning, a free afternoon, an early finish. It never needs a night scene and it never needs sleep, fatigue or health wording.

## 1. Who

The shift worker is an adult whose working week is set by somebody else's rota and does not match the household's day. This fortnight it is earlies, so the keys go on the hook at the end of the morning and the afternoon is free; next fortnight it is lates, so the morning belongs to the house and the front door shuts behind them at midday. Some weeks the pattern is fixed and some weeks it moves with a swap. The job is one anyone might do: driving a route, cooking in a kitchen that opens early, picking orders in a warehouse, working on a ward, stacking a shop floor, running a depot counter. The story names none of it in detail and never names an employer. What it shows is the hour they come in by the front door in daylight, put the keys down, and look for what the house expects of them today: whose turn it is for the pick-up, what is for dinner, which chore has landed on a day they are out, and which of the four clocks in the house the plan runs on.

What makes this a persona and not just a calendar is that the household runs on several clocks at once. A partner works office hours, a teenager has college days that start late on Tuesdays, a grandparent minds the youngest on Thursdays, and the person on the rota is the one who has to translate between them. They are pragmatic and a little dry about it: the week has seven days and four clocks. They want the week to be readable at a glance, by everyone, without asking them. The age range is wide: an adult of nineteen in a shared flat, a parent of thirty-eight with a rota that changes every four weeks, a grandparent of sixty-four who works a counter on three shifts a week. The place is any town with a depot, a market, a kitchen or a hospital in it, which is every town. Households are every shape the fleet has: a person alone, housemates on two different rotas, a couple with one office worker and one rota, a family with small children, a family with teenagers, a three-generation home. The persona is a job and not a type of person: gender, age, culture and income do not decide who has it, and the cast plan gives it to people for the household's reasons, not by reflex.

## 2. What they are responsible for

- The household's week as it meets their rota: the early and the late, the days off, the swap that was agreed in the corridor on Monday.
- The handover: what the person coming in next needs to know, the note that used to be on the fridge or a message in a group chat.
- The chores that fall due on the days they are out, and the ones they do on the days they are in.
- The meals on the days they are home to cook, and the plate that is ready on the days they are not.
- The errands that need an open counter and a free afternoon: the garage, the post office, the form.
- The jobs that need two people at home on the same day: the repaint, the car, the flat-pack, the family visit.
- Their own free hours: an audiobook, a show, a film, a seat in the afternoon light.
- The employer's rota, which stays the employer's. The household copy is theirs; the source is not, and the story never says it replaces or reaches into it.

## 3. What they rent today

Registry ids are in `content/story/services.json`. All twelve below exist with no `stale` or `story-excluded` flag, `alternativeToForm` ok and `storyStatus` ok. Four carry `incumbentNameList: true` (Google Calendar, iCloud Calendar, Netflix, Apple Podcasts), so only the neutral second chip "alternative to <Service>" may name them, never beside an accusing verb (`incumbent-attack`). Every mark is a neutral badge with the service's name; no service logo is cleared.

| Registry id | Service | What it holds for this person today |
|---|---|---|
| `google-calendar` | Google Calendar | The rota, copied in by hand, in the calendar that one phone in the house reads. |
| `icloud-calendar` | iCloud Calendar | The same week on the other make of phone, kept by whoever is on that phone. |
| `tody` | Tody | The cleaning schedule, counting days since a room was last done. |
| `cozi` | Cozi | The family board: shopping list, notes and the household calendar. |
| `todoist` | Todoist | The personal list, with dates that a rota keeps moving. |
| `asana` | Asana | A board of bigger jobs, set up once and carried home from a workplace habit. |
| `audible` | Audible | The audiobook shelf the person listens to in short pieces. |
| `apple-podcasts` | Apple Podcasts | The shows followed on the way to or from the job. |
| `plex` | Plex | A library of the family's own films and shows, if somebody set it up. |
| `netflix` | Netflix | The evening queue, built around an evening a person on earlies does not sit through. |
| `paprika` | Paprika | The recipes the person cooks, saved one at a time. |
| `anylist` | AnyList | The shopping list that goes with them to the supermarket. |

Not named, not replaced: the employer's rota system, timekeeping or messaging, and any roster or timesheet product (none is in the registry, and the persona's honest limit is that none moves). `ourhome` is in the registry with a `stale` flag and is also on the catalog's `replaces` list for Donetick and HomeHub: never use it. Donetick's story pair is Tody, HomeHub's is Cozi.

## 4. What the Hub offers them

All seven apps are in `content/story/catalog-apps.json` with `storySafe: "yes"`, all are in the live store, and none carries `ai: "chat"`, so any member aged 16 or older, or younger, may appear beside them (the age rule is not triggered). Display names are the first chip, character for character. Fleet use now, from `casting.json`: Radicale 0 of 30 homes, Mealie 0, Donetick 1, Vikunja 1, Audiobookshelf 3, Jellyfin 4, HomeHub 7. The fleet cap is 12 of 30 (14 of 36), so every one has room, HomeHub the least (five).

| Catalog id | Display name | What it does for this person | Honest caveat (catalog entry; ours marked) | QA | Registry services |
|---|---|---|---|---|---|
| `radicale` | Radicale | Holds the household calendar and to-do lists that every device in the house syncs with, so the rota is typed once. | No QA screenshot on origin/main: listed and installable, nobody has recorded a verified run. Ours: it is the sync server; the week is drawn by the calendar app each person already uses, pointed at the Core; home network only. | none | `google-calendar`, `icloud-calendar` |
| `donetick` | Donetick | Assigns and tracks recurring chores, so each chore has a name against it and is ticked off by whoever is at home. | Notifications use Telegram or Pushover, both outside services. Ours: write no reminder that arrives on a phone, and no chore that moves by itself: a person assigns it. | shot | `tody` |
| `vikunja` | Vikunja | Lists, boards and calendars for tasks, with reminders and recurring jobs: the short list for the days at home, and the board of two-person jobs. | Supports CalDAV sync. Ours: shared with the people in the house only. | shot | `todoist`, `asana` |
| `homehub` | HomeHub | One household board of notes and shopping, so the handover note is read by the whole house. | None in the catalog. Ours: one household's board on the home network; the listing also has chores, expenses, a recipe book and an expiry tracker, which this persona's stories leave alone. | shot | `cozi` |
| `audiobookshelf` | Audiobookshelf | Keeps the family's own audiobooks and podcasts in one library and remembers where each listener stopped, so a listener picks up where they left off. | None in the catalog; claims.json: per-user progress is this app's feature. Ours: the family's own files; no Audible library import is claimed. | shot | `audible`, `apple-podcasts` |
| `jellyfin` | Jellyfin | Plays the family's own films, shows and music on the living-room television. | Plays your own files; say that, not "Netflix". Do not say it plays copyrighted material from anywhere. | shot | `plex`, `netflix` |
| `mealie` | Mealie | A recipe manager, meal planner and shopping list: the week's meals planned around who is home. | Pasting a recipe URL fetches that web page; everything it saves stays on the Core. No QA screenshot on origin/main. | none | `paprika`, `anylist` |

Sentences each app allows, and one it does not. They are written for this persona and keep to the catalog.

- **Radicale.** Say: "The rota is typed once into the household calendar on the Core." Say: "Every phone in the house reads the same week." Never: "Radicale shows the rota at work." (home network only.) Never: "Radicale imports the employer's roster."
- **Donetick.** Say: "Donetick on the Core tracks each chore and who it is given to." Say: "Whoever is at home ticks it off." Never: "Donetick reminds you on your phone." (the notification route is an outside service.)
- **Vikunja.** Say: "Vikunja keeps one list for the next free day at home." Say: "The board of bigger jobs is read by the people in the house." Never: "Vikunja invites your colleagues." (reach.)
- **HomeHub.** Say: "HomeHub keeps the shopping list and the handover notes on the Core." Say: "The whole house reads one board." Never: "HomeHub knows who is home." (presence or location is not claimed.)
- **Audiobookshelf.** Say: "Audiobookshelf remembers where each listener stopped." Say: "The family's own audiobooks sit on the Core." Never: "Audiobookshelf brings your Audible library over." (no importer is claimed.)
- **Jellyfin.** Say: "The family's own films play from Jellyfin on the Core to the television." Never: "Jellyfin streams any film you want."
- **Mealie.** Say: "Mealie holds the family's recipes and the week's meal plan on the Core." Say: "The shopping list is shared by everyone at home." Never: "Mealie orders the groceries for you." (`cap-autonomy`.)

## 5. Where they spend time

Kinds of places, not named ones, because none can be verified from the files this draft reads. All of it is [?].

- The kitchen at the odd hour: the counter, the fridge door, the table where the rota sheet is laid out when a new one arrives.
- The front door and the hall: the place where the day changes hands, keys on the hook, shoes off, who is next out.
- The break room, the staff room, the depot yard, the bus stop and the car park: places where swaps are agreed and where the source rota lives. None of it is shown.
- A team group chat for swaps and cover, and a family group chat for who is picking up. These are the real shared calendars of the persona's life, and they stay where they are. Messengers are someone else's servers (`cap-messaging-private`).
- The family's living room on a free afternoon, the patio seat in the sun, the garden, the local library or market. The persona does not come home to a dark room; the stories keep to morning light and the afternoon.
- Local radio, podcasts and audiobooks in short pieces, a film on a free weekday, cooking from a handful of recipes cooked often. Media is chosen for fitting into a gap, not for a binge.
- A trade or union branch, a neighbourhood group, a parents' group at a school with different pick-up times. Named only as kinds; no group is quoted and none is endorsed.
- Not the self-hosting scene. The persona is not found where people compare containers, and no story relies on a forum. Trust comes from the household's own kitchen: somebody in the house set it up and the week reads at a glance.

## 6. How they talk

| Feature | Shift worker |
|---|---|
| Tone | plain, practical, a little dry; exact about days and times, easy about everything else |
| Pace | 140 to 150 words a minute; the house voice is fixed, so pace is sentence length and a beat after each day or time |
| Sentence length | 6 to 12 words, one fact each, the day or time first |
| Humour | dry, about the calendar: seven days and four clocks; never about being worn out |
| Owns (vocabulary) | rota or roster, earlies, lates, swap, cover, handover, days off, the pattern, a turn-round |
| Eye-rolls | work-life balance, hustle, optimise your day, productivity hack, self-hosted, homelab, smart |
| Turned off by | being told how to manage time; an app that sets the week for them; a long form; the idea that they are the household's problem |
| Opens with | their own noun inside three seconds: the rota, the swap, the handover, the free Tuesday |

Regional word: "rota" suits a British or Irish voice and "roster" an American one; the family file picks by its place and uses one word throughout. Never "night shift" as a hook (daylight only); say "lates", "earlies" or "a shift that ends in the morning".

Sample register, as captions in the third person, not as quotation: "The new rota goes in once." "The swap is on the board before the kettle is." Third person, present tense; first person only in a labelled adult quote if the family file has one, never praise for the product.

## 7. Comfort with technology and attitude to AI

Comfort runs from 1 to 4 and is set per person, never by the job or the age [?]. Typical is 3: sure with the calendar on a phone and the group chats, able to follow a short setup guide; the household's Core is set up by whoever in the house is most comfortable, which is not decided by the rota. What the persona is quietly proud of is a week that reads at a glance, and of not being the household's switchboard.

Attitude to AI runs from not interested, since little in this persona's week is a language task [?], through wary of anything that decides for them, because the rota itself often arrives from software they did not choose [?], to a few who are curious about an agent that reads the week out. The story does not take a side and does not write a gap by gender, age or job into any character.

Rule: no chat or agent app is in this persona's pool and no beat opens on AI. If the household has Hermes, the swap message is the person's to read and send, an agent prepares and the person approves (`cap-autonomy`), the message travels through the messenger the family picks (`cap-messaging-private`), and nobody under 16 has a companion (age rule 16). The chore is the hero, never the tool.

## 8. Objections and the honest limits

| Objection (paraphrased) | Honest answer |
|---|---|
| The rota changes while they are at work. | The Core is on the home network. Remote access is not claimed (`cap-remote-access`), so nothing here reads the household calendar, the chores or the audiobook from the job. The copy ends at the front door. This is the biggest limit of the persona and the stories say it in the voice of someone who knows it. |
| The employer's rota is the only one that counts. | It is. The household copy is typed in by the person; nothing imports from an employer's system and the story never says so. |
| Swaps are agreed with colleagues, in a chat. | Those stay in the chat. Outside people cannot be invited to a household calendar or board (reach, `cap-multi-user`); the person adds the agreed swap themselves. |
| A reminder should reach their phone. | Donetick's notifications use Telegram or Pushover, outside services. The stories write no reminder. Radicale is a sync server, not a push alert. |
| They do not want to be tracked. | HomeHub is a board, not a presence tracker. No location, no "who is home", no camera is claimed (`f-surveillance`). |
| It sounds like an extra job for them. | Somebody in the house sets it up. The persona is the user, not the installer. Installing apps uses the internet. |
| What if the Core is off? | The Core is not a backup. Nothing is said about uptime (`cap-uptime`). |
| Audiobooks and films: from where? | The family's own files only. Neither Audiobookshelf nor Jellyfin is a store; no Audible or streaming library is brought across and no content is implied from anywhere. |
| Everyone sees everything. | One household, one Core. Per-app accounts exist only where the app has them; platform-level separation between people is not claimed (`cap-multi-user`). |

Also true and stated once: Radicale and Mealie have no recorded QA run, so every beat that shows either needs an entry in `content/story/reviewed.json` (rule `app-qa-screenshot`); HomeHub, Donetick, Vikunja, Audiobookshelf and Jellyfin have a screenshot.

## 9. Claims boundary

What must never be said for this persona. Ids are from `content/story/claims.json`; `f-` ids are `forbiddenClaims`, the others `bannedPhrases`.

| Never say or imply | Why | Claims id |
|---|---|---|
| Reading the rota, the chores or the audiobook from the job, the cab, the depot, the ward or the road; "wherever your shift takes you" | Remote access is not finalised | `cap-remote-access`, `f-remote-access` |
| Sleep, fatigue, rest, alertness, recovery, "safe to drive", wellbeing, "keeps you healthy" | No medical claim and no safety-of-people claim; the persona has no sleep, fatigue or health wording at all | `sec-medical`, `f-medical-care`, `sec-safety-people` |
| Hours, minutes or days saved; "less admin"; any count of clashes avoided | No time-saved figure exists | `num-time-saved`, `num-minutes`, `f-savings` |
| Pay, overtime, entitlement, working-time rules, union or employment-law advice, "know your rota rights" | No legal, tax or financial advice | `legal-claims`, `f-legal-tax-fin` |
| Imports or syncs the employer's roster; "swaps shifts for you"; "contacts your colleagues"; any agent that books, cancels or messages without the person approving | Nothing imports; agents prepare and people approve | `cap-autonomy`, `f-agent-autonomy`, `f-box-to-box` |
| A colleague, a babysitter or a relative outside the house edits or reads the calendar or board; "share the link" | Reach is not claimed | `cap-remote-access`, `cap-multi-user` |
| "Each person has their own private calendar, list or board" | Per-app accounts only; no platform separation | `cap-multi-user`, `f-multi-user` |
| "Knows when you are home", "notices when your rota changes", "predicts your week", a location or presence feature | Not claimed; no proactive or omniscient claim | `cap-omniscient`, `f-proactive`, `f-surveillance`, `cap-camera-capture` |
| A reminder or notification that lands on a phone | Donetick uses outside services for notifications | `cap-messaging-private` |
| "Your Audible library", "your Netflix shows", streaming-service content, anything copied from anywhere | The family's own files only | catalog caveats for `jellyfin`, `audiobookshelf` |
| A patient, a resident, a client, a safeguarding note, a school record or a child's data held on the Core; "confidential", "compliant", "certified" about anything | Regulated domains are written without any claim; the Core holds household items only, work records stay at work | `sec-compliance`, `f-compliance`, `f-medical-care` |
| A named company doing something wrong; "the old calendar spies", "locks you in" | The villain is a pattern, never a company | `incumbent-attack`, `f-incumbent-claims` |
| A real person, a testimonial, "shift workers love it", "real families" | The families are fiction | `fake-social-proof`, `f-testimonial`, `f-real-person` |
| "Easy", "simple", "effortless", "seamless"; "private", "secure", "safe" on their own; "works offline"; "nothing leaves" | Unmeasured or unsupportable | `buzz-simple-claims`, `buzz-core`, `sec-absolute`, `sec-offline`, `sec-never-leaves` |
| A price, a saving, "no subscription", a tier | Money claims | `num-dollar`, `num-savings`, `no-subscription`, `campaign-terms` |
| Night, a person worn out or slumped, the absent parent, the martyr | Daylight only; stereotype | ADS.md; personas.md "Ads" |

Always carry: "Fictional family. Real software."; the scripted-scenes line on the page footer; no app screen is readable. Copy voice: sentence case, no em or en dash, no exclamation mark, "Companion Core" in full on first mention and "the Core" after.

## 10. Fit

**Rooms and anchors.** Room roles (schema `roomRole`): `kitchen`, `dining`, `entry`, `living` first; `laundry`, `bedroom`, `patio`, `garden` as fallbacks. Anchor roles (`roles.json`, schema `roleId`): `counter`, `fridge`, `dining-table`, `front-door`, `couch` first; `kitchen-island`, `laundry`, `tv`, `desk`, `patio-seat`, `room` as fallbacks. `counter`, `front-door`, `couch` and `room` resolve in all thirty homes (`universal`); `fridge` and `kitchen-island` come from the kitchen, `dining-table` from dining or kitchen, `laundry` from the laundry or garage, `tv` from living, `desk` from office or bedroom, `patio-seat` from the patio or garden.

**Homes that suit.** The persona needs an entry that a person comes in through, a kitchen with a fridge and a counter, and ideally a laundry or mudroom. Best: The Palms (Mudroom, Laundry, Kitchen with an island), Twin Gable House (Mud Room, Laundry, Kitchen with an island), Modern Asymmetry House (Entry, Laundry, Kitchen with an island), Newcrest House (Entry Vestibule, Laundry, Kitchen with an island), Riverbend Drive and Cocoon (Mudroom and Laundry), Yellow Family Home (Mudroom, no laundry item, so its chore beat falls back to the counter). A `patio-seat` resolves in twenty-seven of the thirty homes (a patio set, lounger set, bench, loungers, firepit or gazebo, in a room or on the lot); in the other three (Newcrest House and two others with no outdoor seat) US8 moves to the couch. `laundry` resolves where the house has a washing machine or dryer item (fourteen of the thirty), and `desk` in a bedroom is not assumed: US5 falls back to the dining table. A home with a nursery room (Garden Nook, Yellow Family Home) does not suit the bedroom stories, and no story needs a bed. The six apartments (crew ids `garden-flat`, `city-one-bed`, `two-bed-flat`, `walkup-duplex` and others) have a shorter chain, front-door, counter and couch; their room lists are not in this repo yet, so nothing beyond the universal anchors is promised there. A city one-bed suits a person alone or housemates; a two-bed flat or garden flat suits two adults on different clocks.

**Props.** From the item list: fridge, range, kitchen-island, couch, tv, laundry, desk, bed, dining-table, patio-seat. To author, if wanted: a printed rota sheet, a key hook, a headset. No uniform, no vehicle, no logo and no legible phone screen. Frame at counter height, hands and the held sheet; a wide of door and hall, a close of a hand on the fridge door. The Core appears once per cut, on its shelf, last where the script allows.

**Casting.** Adults, 18 and older, by editorial choice. Suggested spread across the thirty-six homes: six to eight shift workers (about one household in five), never more than one per household except one couple in the fleet who are both on rotas. Each is cast beside members of other archetypes, chosen in `cast-plan.json` for the household's story and never by relation, age or gender. Ages and shapes to cast:

| Household | Ages and shape | Why |
|---|---|---|
| `solo-or-couple` | a person alone, 27; two housemates, 24 and 31, on different rotas; a couple, 39 and 41, one on a rota | the week with the fewest clocks and the clearest stake |
| `young-family` | a parent, 33, on lates, with a partner and a small child | the pick-up and the meal are the stake |
| `older-kids` | a parent, 46, on a rotating pattern, with a teenager in college | different clocks, different days |
| `grandparents` | a grandparent, 64, on three shifts a week; or an adult child, 41, living with their parents | a three-generation home with the week most at stake |

Casting warning against stereotype. The job is never given by reflex. Not every shift worker is a man at a depot or a woman on a ward; the cast mixes kitchens, routes, warehouses, shops and wards across genders, ages and cultures, and the family file picks the job for the household's story, not for the person's category. No one is cast as low-income, absent, overworked, the family's problem or the household's martyr; the persona is capable, practical and the person who holds the week together. No ill-health, no sleep and no tiredness is shown or said. A ward worker is shown at home only; nothing from the ward is named or held on the Core.

## 11. Ten user stories

Format: "As a shift worker, I want <job> so that <outcome>". The persona is never named in a story. Each has one app, one service, the caveat that rides with it, the chips, and a moment: a room, an anchor role with fallback, and what happens first. Hands and objects come first; no screen is readable. Every pair is valid in the registry and the catalog (the app lists the service, the service lists the app) and `app.replaces` in the beat is set to the service's name so the second chip reads "alternative to <Service>".

**US1. Radicale, alternative to Google Calendar (`radicale`, `google-calendar`).**
As a shift worker, I want each new rota typed once into one household calendar so that everyone in the house reads the same week.
Caveat: the Core is the sync server; the week is drawn by the calendar app on each device; home network only; no QA screenshot, so the beat is listed in `reviewed.json`. Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`, `room`). The new rota sheet is flat on the counter first; a hand copies the first early into the calendar and a second phone on the counter shows it.

**US2. Radicale, alternative to iCloud Calendar (`radicale`, `icloud-calendar`).**
As a shift worker, I want my days off to sit beside the household's fixed plans so that a family day starts from the real gap in the week.
Caveat: as US1; the other adults read the week on their own devices, not on one shared screen. Moment: `dining`, anchor `dining-table` (fallback `counter`, `room`). The month is talked through at the table first and the first thing anyone points to is the one free Saturday.

**US3. Donetick, alternative to Tody (`donetick`, `tody`).**
As a shift worker, I want chores assigned to whoever is at home so that the bins and the laundry stop landing on a late shift.
Caveat: notifications use Telegram or Pushover, which are outside services, so no reminder is shown. Moment: `laundry`, anchor `laundry` (fallback `counter`, `room`). The full basket is by the machine first; the chore goes to the person who is in and they tick it off.

**US4. Vikunja, alternative to Todoist (`vikunja`, `todoist`).**
As a shift worker, I want a short list for the days I am home so that the garage booking and the post office wait for a free afternoon, not a fixed date.
Caveat: supports CalDAV sync; the list sits on the Core and is read at home. Moment: `entry`, anchor `front-door` (fallback `room`). The keys go on the hook after an early finish first; the list for today starts with the form.

**US5. Vikunja, alternative to Asana (`vikunja`, `asana`).**
As a shift worker, I want the bigger jobs on a board so that the ones that need two people land on a day two people are home.
Caveat: the board is read by the people in the house; colleagues and contractors outside cannot be invited; one household's Core. Moment: `bedroom`, anchor `desk` (fallback `dining-table`, `room`). A hand moves a card to the Sunday both adults are in first; the repaint is no longer a someday.

**US6. HomeHub, alternative to Cozi (`homehub`, `cozi`).**
As a shift worker, I want one board of notes and shopping so that the note for whoever comes in next is read by the whole house, whatever clock they keep.
Caveat: none in the catalog; ours: one household's board on the home network, no presence or location, the expiry tracker and expenses are not used. Moment: `kitchen`, anchor `fridge` (fallback `counter`, `room`). A paper note comes off the fridge door first; the same note is typed on the board and the shopping list beside it has one more line.

**US7. Audiobookshelf, alternative to Audible (`audiobookshelf`, `audible`).**
As a shift worker, I want my audiobooks to remember where I stopped so that a chapter cut short by the start of a shift carries on from the same place.
Caveat: the family's own files; per-user progress is the app's feature; no Audible library import is claimed. Moment: `living`, anchor `couch` (fallback `room`). A pair of headphones lies on the arm of the couch first; the book starts again at the place where it stopped in the kitchen.

**US8. Audiobookshelf, alternative to Apple Podcasts (`audiobookshelf`, `apple-podcasts`).**
As a shift worker, I want the shows I follow kept in one library so that a free afternoon starts from where the last episode stopped.
Caveat: as US7; the catalog says only that podcasts are kept and that the listener's place is remembered, so nothing is written about fetching new episodes. Moment: `patio`, anchor `patio-seat` (fallback `couch`, `room`). A chair in the afternoon sun is first; the next episode begins where the last one stopped.

**US9. Jellyfin, alternative to Plex (`jellyfin`, `plex`).**
As a shift worker, I want the family's own films and shows on the living-room television so that a free weekday afternoon has something ready that someone at home chose.
Caveat: plays the family's own files; never "streams any film"; never any hint of copyrighted material. Moment: `living`, anchor `tv` (fallback `couch`, `room`). The television is first, then a hand with the handset; the family's own film, not a catalogue, is the one that starts. `tv` resolves in seventeen of the thirty homes, so most fall back to the couch.

**US10. Mealie, alternative to Paprika (`mealie`, `paprika`).**
As a shift worker, I want the week's meals planned around who is home so that the days of early starts have a plate ready.
Caveat: pasting a recipe URL fetches that web page and what it saves stays on the Core; no QA screenshot, so the beat is listed in `reviewed.json`. Moment: `kitchen`, anchor `kitchen-island` (fallback `counter`, `range`, `room`). A hand pastes a recipe address first; the recipe drops onto the day the cook is home.

Pairs held back. `jellyfin` with `netflix` (the catalog says to say "your own files", not Netflix, so only the neutral chip could carry it; use it where the family's own files are the point) and `mealie` with `anylist` (the shopping list pairs better with HomeHub's board). Both exist, are allowed and are free to use in the beat seeds or a second family.

## 12. Six beat seeds

Each is the first sentence a visitor reads. Each is 20 words or fewer, in sentence case, with no dash, digit or exclamation mark. Chips follow the grammar "<App> | alternative to <Service>". The seeds say where the thing sits; they accuse nobody and name no company.

1. The rota lived in a rented calendar on one phone; now the whole house reads one week from the Core.
   Chip: Radicale | alternative to iCloud Calendar. Room: kitchen, `counter`.
2. A rented chore schedule counted days and not people; each chore on the Core is given to someone at home.
   Chip: Donetick | alternative to Tody. Room: laundry, `laundry`.
3. A rented to-do list hung on dates; the list on the Core waits for the next free day at home.
   Chip: Vikunja | alternative to Todoist. Room: entry, `front-door`.
4. The handover notes sat in a rented family planner; now one board on the Core is read by the house.
   Chip: HomeHub | alternative to Cozi. Room: kitchen, `fridge`.
5. Recipes sat in a rented app and the week's meals in one head; the Core holds both as one plan.
   Chip: Mealie | alternative to Paprika. Room: kitchen, `kitchen-island`.
6. Shows lived in a rented podcast app on one phone; the Core keeps one library and each listener's place.
   Chip: Audiobookshelf | alternative to Apple Podcasts. Room: living, `couch`.

## 13. The personas.json row

What the engine needs to carry a fifteenth archetype, listed and not done in this draft. Add the row below under `archetypes` in `content/story/personas.json` (after `educator`, so `Object.keys` stays in the order of `ARCHETYPES`). Then mirror `shift-worker` in `content/story/schema/family.schema.json` (`member.archetype`), in `ARCHETYPES` in `assets/story/types.ts`, in the archetype list of `scripts/story/build-casting.mts` and in the pools in `scripts/story/cast-lint.mts` (the `JOBS` set and a pool of `radicale donetick vikunja homehub audiobookshelf jellyfin mealie`). `scripts/test-stories.mts` and `reference/story/personas.md` state "fourteen" and the order; both change with the row. The front page filter chip comes from `PERSONAS` in `scripts/portal-front.mts`. No `example` name: the cast plan picks the names, as for `maker` and `host`.

Verified against the files: every room is a `roomRole`, every anchor a `roleId` (and in `roles.json` or `universal`), rooms and fallback rooms are disjoint, every app is in `catalog-apps.json` with `storySafe: "yes"` and in the live store, every service in sections 3 and 11 is in `services.json` with no `stale` or `story-excluded` flag and `alternativeToForm` ok.

```json
"shift-worker": {
  "label": "Shift worker",
  "description": "Works early, late or rotating shifts that do not match the household's day, and keeps one shared week across different clocks.",
  "rooms": ["kitchen", "dining", "entry", "living"],
  "fallbackRooms": ["laundry", "bedroom", "patio", "garden"],
  "anchorRoles": ["counter", "fridge", "dining-table", "front-door", "couch"],
  "fallbackAnchorRoles": ["kitchen-island", "laundry", "tv", "desk", "patio-seat", "room"],
  "apps": ["radicale", "donetick", "vikunja", "homehub", "audiobookshelf", "jellyfin", "mealie"]
}
```
