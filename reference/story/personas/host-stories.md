# Host (`host`): ten new user stories

Draft for the owner, written 2026-10-20. Companion OS, Companion Memory and Companion Agents are in beta. Nobody here is a customer: every name, age and household below is a design choice for a fictional character, and the example names are not cast members yet. Read for this file: chapter 3.6 of [persona-bible.md](../persona-bible.md), the `host` row of `content/story/personas.json`, the 30 family files in `content/families/` (the six apartments are not in `content/houses/` yet, so they have no family file), `catalog-apps.json` and `services.json` (both as of 2026-10-19), `claims.json` and [validator.md](../validator.md). The law for every word is `content/story/claims.json`.

**One line.** The person who knows where the passports are and that Thursday is bin day: they see that everyone is fed, is where they should be and can find what the house holds.

**What this file adds.** The chapter and the ten shipped hosts live in the kitchen, the garden and the sofa: a shared list, a plant journal, a photo album, a lamp. These ten stories take the host to the hall, the laundry, a child's room, the driveway, a guest bedroom and the patio, and to the weeks that decide a household: the first Monday of the summer holidays, the night before a trip, a late August evening of forms, a first night with a guest. Four of the ten hosts are working parents of school-age children, the case the chapter calls commonest and missing. None of the ten pairs is used by any family yet, and six of the ten apps have no more than one beat in the 30 files.

---

## 1. What the chapter and the families already show

- **The chapter (3.6).** Juma (36) and Yoshiko (67). Ranked replacements: KitchenOwl, Mealie, Immich, Yuvomi, Radicale, Home Assistant. The hooks are "Twelve for Sunday lunch" and "Gran's recipe tin gets a copy". Rules that bind every story below: waist height, hands and objects first, the paper list first and the app chip second; never a host who is always the mother in an apron; no school channel moves; no list at hand in a shop aisle (outside reach is not claimed); one named chore for a model, never a child's homework.
- **The families.** Ten hosts in 30 files: Tiago (35), Imran (38), Greet (69), Harpreet (61), Juma (36), Thandi (44), Nikolai (36), Yoshiko (67), Callum (37) and Emeka (70). They have 70 beats. The apps: KitchenOwl 15, Hermes 9, Immich 6, HortusFox 6, Home Assistant 6, Nextcloud 4, Frigate 3, Jellyfin 3, OpenClaw 3, ntfy 2, Yuvomi 2, HomeHub 2, Foldergram 2, and one each of Pi-hole, VaultWarden, Gitea, Akaunting, Companion Planning, Navidrome and Paperless-ngx.
- **The old places they name.** Google Photos, Google Home, iCloud, AdGuard, Nest Cam, Ring, Plex, Spotify, Evernote, LastPass, QuickBooks, GitHub, Cozi.
- **Rooms and moments.** The kitchen, the living room, the garden, a nursery, a greenhouse. A shared list at the island, a plant watered on Tuesday, a baby's first steps, a lamp on a rule. Nobody packs for a trip, keeps a car's history, welcomes a guest or sets up a game of chores; the hosts are 35 to 70 and, as the chapter notes, nobody is between 45 and 60.

## 2. How the ten differ

| # | App, service | Room, anchor | Moment | Who acts, who is helped |
|---|---|---|---|---|
| US1 | Jotty, Todoist | `living`, `room` | The Thursday before a week at the coast | Obinna (47) packs with two children (11 and 8) |
| US2 | Habitica, Habitify | `kids`, `room` | First Monday of the summer holidays | Halima (50) and two children (12 and 9) |
| US3 | Grocy, OurGroceries | `kitchen`, `fridge` | A Sunday of batch cooking in October | Beatrix (53) counts the chest freezer |
| US4 | LibreTranslate, DeepL | `bedroom`, `desk` | The first evening of an exchange | Bronwyn (49) and her guest Yusuf (16) |
| US5 | Home Assistant, Apple HomeKit | `entry`, `front-door` | Wednesday at six, in autumn | Cyrus (38) sets it; Wilhelmina (79) sees it |
| US6 | LubeLogger, Fuelly | `garage`, `driveway` | The Saturday after the yearly service | Delphine (51) keeps the car's history |
| US7 | Baikal, iCloud Calendar | `kitchen`, `fridge` | A late August evening | Kwame (45) loads the school's term dates |
| US8 | AdventureLog, Polarsteps | `patio`, `patio-seat` | A Saturday of October half-term | Tobias (71) and Greta (10) log the places they have been |
| US9 | Nextcloud, OneDrive | `living`, `bookshelf` | A late August evening of forms | Elodie (56) keeps two grandchildren's forms |
| US10 | Donetick, Tody | `laundry`, `laundry` | A Saturday morning in spring | Ranjit (43) with his father and sister |

Place fit. US2, US3, US4, US7 and US9 need only rooms an apartment has. US1 and US5 fit an apartment with a hall. US6 needs a garage and a drive, US8 a patio, US10 a laundry: houses, or apartments with a utility room.

## 3. Ten user stories

Format: "As a host, I want <job> so that <outcome>." Each story is tied to one catalog app and one registry service, with the honest caveat, a one-line moment and the first sentence a visitor would read (20 words or fewer, sentence case, no dash, no exclamation mark; the service is named only as the old place). The chip pair is the app name, then "alternative to <Service>". Rooms and anchors are the closed sets of `schema/family.schema.json` and `roles.json`. No story here uses a chat model or an agent, so the age rule of 16 does not bite; the children use a checklist, a game of chores and a log, none of them a chat app.

**US1. Jotty, Todoist.** As a host, I want a packing checklist each person ticks their own part of, so that the night before a trip is not me asking who has packed what.
- Who and when: Obinna (47, depot planner and parent of two, 11 and 8), the Thursday evening before a week at the coast in July.
- App `jotty`. Service `todoist`. Caveat: the list is read on the home Wi-Fi and is not at hand once the family has left the house, so the paper list goes in the bag; nothing is said about reminders. One household, one Core: the children tick their own items on one shared list, not in an account each. A household keeps one board app (Jotty, Planka).
- Moment: `living` room, anchor `room` (fallback `couch`). The first thing: Obinna reads the paper list aloud from the bag before anyone touches a screen; then each child ticks their own column.
- First sentence: "The packing list lived in Todoist under one name; Jotty lets each child tick their own on the Core." (19 words)
- Why it differs: a trip, at the door, with children as actors; a checklist, not a list of food; the paper list stays first.
- Check: QA screenshot yes; fleet use 0.

**US2. Habitica, Habitify.** As a host, I want the summer jobs to read like a game the children choose, so that Monday's list is a quest and not a nag.
- Who and when: Halima (50, librarian), her children of 12 and 9, the first Monday of the summer holidays.
- App `habitica`. Service `habitify`. Caveat: levels and quests are points in a game and nothing else; no claim that it changes behaviour or that it keeps a child on task. A household keeps one chores app (Habitica, Donetick, HomeHub, Yuvomi). Say only what the app does and where the data sits; the children use a game of chores, not a chat app.
- Moment: `kids` room, anchor `room` (fallback `desk`). The first thing: Halima and the children write the quest names on a card and stick it to the wall; only then are they entered.
- First sentence: "The summer jobs lived in Habitify on one phone; Habitica turns them into quests on the Core." (17 words)
- Why it differs: the children choose, in their own room, at the start of the holiday; chores as a game and not a rota. The `kids` room is not in the host row today.
- Check: QA screenshot yes; fleet use 1.

**US3. Grocy, OurGroceries.** As a host, I want to know what is in the chest freezer without lifting every lid, so that Sunday's batch cooking adds to the stock instead of repeating it.
- Who and when: Beatrix (53, part-time garden centre worker), a Sunday in October after a day of cooking.
- App `grocy`. Service `ourgroceries`. Caveat: the catalog's note on Grocy is that the listing is short, so describe pantry stock, shopping lists, recipes and chores only: no best-before wording and no food-safety wording. The shop list is copied to paper because the app is not in the shop. A household keeps one list app (Grocy, Mealie, Tandoor, KitchenOwl, HomeHub, Yuvomi).
- Moment: `kitchen` room, anchor `fridge` (fallback `counter`). The first thing: she writes the date on masking tape on each tub, then types it.
- First sentence: "The freezer's contents lived in an OurGroceries note; Grocy keeps the stock on the Core, tub by tub." (18 words)
- Why it differs: stock and not a shopping list; the host's autumn cook-ahead rather than Sunday lunch for twelve; a quiet end of day. The pair is new even though Grocy already has seven beats; use it where Grocy is not already the family's pantry beat.
- Check: QA screenshot yes; fleet use 7.

**US4. LibreTranslate, DeepL.** As a host, I want the house card in my guest's language, so that the Wi-Fi name, the bin days and the key hook make sense on the first night.
- Who and when: Bronwyn (49, council clerk) hosts Yusuf (16, an exchange student) for a month; the first evening of the exchange.
- App `libretranslate`. Service `deepl`. Caveat: a machine translation can be wrong, so Yusuf reads the card and corrects it before it is pinned. The language models are fetched while the Core is connected, so do not say the app needs no network. LibreTranslate is not a chat model; a visitor reads the card, and no companion or agent is involved.
- Moment: `bedroom` room (the guest room), anchor `desk` (fallback `bed`). The first thing: Yusuf reads the card in his room and crosses out one line with a pen; then Bronwyn fixes it.
- First sentence: "The house card used to go through DeepL; LibreTranslate translates it on the Core and Yusuf checks it." (18 words)
- Why it differs: a guest, a language, a first evening; the guest corrects the host. The visitor keeps no profile and has no beats of their own. The `bedroom` is not in the host row today.
- Check: QA screenshot yes; fleet use 13 (the learner's translator).

**US5. Home Assistant, Apple HomeKit.** As a host, I want the hall lamp to say it is bin night, so that nobody has to be told on Wednesday evening.
- Who and when: Cyrus (38, dispatcher and parent) sets the rule one Sunday; Wilhelmina (79, his grandmother) lives with the family. Wednesday at six, in autumn.
- App `home-assistant`. Service `apple-homekit`. Caveat: it needs a smart bulb or plug the family already has; Home Assistant runs the rule on the Core and its own part needs no cloud account; a device that uses its maker's cloud keeps it. No Zigbee stick by default, no energy figure, and re-adding devices is hand work.
- Moment: `entry` room, anchor `front-door` (fallback `room@entry`). The first thing: the lamp turns amber by itself while Wilhelmina puts her shoes on; nobody says a word and a teenager carries out the bin.
- First sentence: "Bin night was a HomeKit automation on one iPhone; Home Assistant turns the hall lamp amber on the Core." (18 words)
- Why it differs: the household's weekly job as a light in the hall, noticed by the person who never opens an app; the shipped lamp rules are for comfort (a warm lamp before reading) and this one is for a chore. Home Assistant has six host beats already; place this where it has none.
- Check: QA screenshot yes; fleet use 15.

**US6. LubeLogger, Fuelly.** As a host, I want each car's service history and fuel in one place, so that the garage gets the right date when I ring and the fuel log reads true.
- Who and when: Delphine (51, council planner), the Saturday after the car's yearly service.
- App `lubelogger`. Service `fuelly`. Caveat: records only; no word of safety, roadworthiness, a legal check or a saving. The reminders stay inside the app and nothing is sent to anyone. Fuel figures are typed by hand.
- Moment: `garage` room, anchor `driveway` (fallback `room@garage`). The first thing: she reads the odometer at the car and writes it on the paper tag on the key hook, then types it.
- First sentence: "The fuel log lived in Fuelly on one phone; LubeLogger keeps every car's service history on the Core." (18 words)
- Why it differs: the host who ferries, on the drive; a record about a thing and not about a person; a Saturday errand. The garage is not in the host row today.
- Check: QA screenshot yes; fleet use 1.

**US7. Baikal, iCloud Calendar.** As a host, I want the school's term dates in the calendar the whole house reads, so that the half-term week is on every phone before the letter arrives.
- Who and when: Kwame (45, warehouse supervisor and single parent of two, 14 and 10), a late August evening.
- App `baikal`. Service `icloud-calendar`. Caveat: Baikal serves calendars and contacts; each phone needs a calendar app pointed at it, and the school's file is imported through that app. No sharing carries over from the old calendar. School channels stay with the school. A household keeps one calendar (Baikal, Radicale, Nextcloud, Yuvomi, HomeHub, Companion Planning): use this only in a home without Yuvomi.
- Moment: `kitchen` room, anchor `fridge` (fallback `counter`). The first thing: the printed term sheet goes on the fridge door; then the dates go in.
- First sentence: "Term dates lived in one iCloud Calendar; Baikal serves the household's calendar from the Core." (15 words)
- Why it differs: a single working parent at the start of the school year; the file is imported once and the paper stays on the fridge. The chapter's Radicale is untouched.
- Check: QA screenshot yes; fleet use 1.

**US8. AdventureLog, Polarsteps.** As a host, I want the places we have been in one log the children can add to, so that the map on the wall is not the only record.
- Who and when: Tobias (71, retired postman) and his granddaughter Greta (10), a Saturday of October half-term.
- App `adventurelog`. Service `polarsteps`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. The log is typed by hand; do not show a map until you confirm whether the Hub package calls an outside map service. No claim is made that it follows anyone's phone. A household keeps one route app (Wanderer, Trip, AdventureLog, Endurain).
- Moment: `patio` room, anchor `patio-seat` (fallback `garden`). The first thing: Greta pins this year's lake on the paper map on the wall; Tobias types the name.
- First sentence: "The family's trips lived in a Polarsteps account; AdventureLog keeps the log of places on the Core, entered by hand." (20 words)
- Why it differs: a grandparent and a child doing the record together, with the child as the actor; memory, not planning. The patio is in the host row.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US9. Nextcloud, OneDrive.** As a host, I want the after-school forms in one folder every laptop in the house can open, so that the swimming form is found the night it is due.
- Who and when: Elodie (56, gallery attendant), after-school carer for two grandchildren, a late August evening.
- App `nextcloud`. Service `onedrive`. Caveat: the files app on the home Wi-Fi; share links do not carry to anyone outside, and nothing is said about who can open what. Only the files are shown; calendar and contacts are other beats. Nextcloud is already in many homes: place this where the family has no Nextcloud beat.
- Moment: `living` room, anchor `bookshelf` (fallback `couch`). The first thing: she empties the carrier bag of forms onto the shelf and makes three piles; only then does she photograph them into the folder.
- First sentence: "The school folder sat in OneDrive on the old laptop; Nextcloud keeps it on the Core, open to each laptop." (20 words)
- Why it differs: the host's paperwork, for a school year, kept by a grandparent in a role the chapter does not show (a working grandparent at 56); the bag of paper comes first.
- Check: QA screenshot yes; fleet use 13.

**US10. Donetick, Tody.** As a host, I want the Saturday jobs to have names against them and a tap to finish them, so that nobody argues about whose turn the wash was.
- Who and when: Ranjit (43, plasterer), his father Leopold (70) and his sister Chiara (40), who share a home; a Saturday morning in spring.
- App `donetick`. Service `tody`. Caveat: notifications use Telegram or Pushover, both outside services, so the rota is also on paper; the tap needs an NFC tag and a phone that reads one. The jobs are house jobs and never about a person's whereabouts. A household keeps one chores app. The Carer draft (`personas/carer.md`) uses the same pair; pick one.
- Moment: `laundry` room, anchor `laundry` (fallback `room`). The first thing: Ranjit tapes the tag to the machine door; Chiara taps it with her phone after the first wash.
- First sentence: "The Saturday rota lived in Tody on one phone; Donetick keeps the names and the tags on the Core." (19 words)
- Why it differs: three adults of two generations sharing the work; a tag on a machine; the laundry, not the kitchen.
- Check: QA screenshot yes; fleet use 1.

## 4. Boundaries these stories keep

- **A role is not a reflex.** Five of the ten hosts are men and five are women; the ages run from 38 to 71; one is a single parent, one a grandparent who keeps a job, one a grandfather, one a brother in a shared home. None is "the mother in an apron".
- **Regulated words.** None of the ten touches health, legal, finance, children's records or education records. The car, the freezer and the forms are described by what the app does and where the files sit, with no safety, food-safety or roadworthiness wording and no claim that the Core meets a rule.
- **The children.** The children in US1, US2 and US8 use a checklist, a game of chores and a log; none uses a chat model or an agent. The guest in US4 is a visitor and has no companion.
- **The old places.** A service is named only as the old place and in the chip "alternative to <Service>". No sentence says what a company does, charges, learns or watches.
- **One household, one Core.** Nothing reaches the Core from outside the house; the shop-aisle list and the road are off the table, so the paper goes first in every story.
- **The honest caveats that ride along on every story:** Companion OS is in beta; installing apps uses the internet; the Core is not a backup; no price, no saving, no time saved, no speed.

## 5. Open items for the owner

- **Owner entries in `reviewed.json`** (rule `app-qa-screenshot`) are needed before a beat can use AdventureLog (US8). The other nine apps have a QA screenshot.
- **Rooms outside the row.** The `host` row lists `kitchen`, `dining`, `garden`, `patio`, `living`. These stories use `entry` (US5), `kids` (US2), `bedroom` (US4), `garage` (US6) and `laundry` (US10), and the anchors `room`, `front-door`, `driveway`, `laundry`, `bookshelf` and `patio-seat` are valid role ids that the row does not list. If the stories are cast, widen the row or let the cast plan carry the exception. The cast plan must also give a host between 45 and 60 and a host who is a working parent.
- **Household kinds.** Board (US1), chores (US2, US10), list (US3), calendar (US7) and route (US8, with trips) are kinds with one app per household in `HOUSEHOLD_KINDS`; Habitica and Donetick are never both in one family, and Baikal never beside Yuvomi, HomeHub or a Nextcloud calendar. Home Assistant, LibreTranslate and LubeLogger are in no kind.
- **Fleet headroom.** Grocy (7), Home Assistant (15), LibreTranslate (13) and Nextcloud (13) already have many beats. Place US3, US4, US5 and US9 where the family does not already show that app.
- **Registry check, 2026-10-20.** Each of the ten pairs is listed in `services.json` (service with no flag, `alternativeToForm` ok, `storyStatus` ok, the app under its `storyApps`) and in `catalog-apps.json` (in the live store, `storySafe` yes except Grocy and AdventureLog which are with-caveat, none avoid, none tagged as a chat app). No pair is used by any of the 30 family files. The first sentences were checked against the error-severity banned phrases of `claims.json`.
