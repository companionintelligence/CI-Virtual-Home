# Gamer: ten more user stories (`gamer`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.3 of [persona-bible.md](../persona-bible.md) and the `gamer` row of `content/story/personas.json`; it changes no source file. Nobody here is a customer: ages, rooms and lines are design choices for fictional characters, and the first names are working names that the cast plan may replace (none is in `casting.json` or on the avoid list). Companion OS, Companion Memory and Companion Agents are in beta. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**What this file is for.** The gamer of the chapter is Steve, 16: a teen who plays most days, with a Valve account that stays Valve's and a session that runs on the Core. The thirty families show seven near-identical Steam beats and every gamer is a boy aged 15 to 17 in his bedroom. These ten stories keep play at the centre but change who plays and what the rest of the life holds: a grandfather in the second seat, a short film for an aunt, supper for four cousins, a television that stops asking for banners, a homework list the player writes himself, a tabletop campaign on the patio, a model for a coursework module, a sibling rota, a lamp that says a session is on, and a first moped. The players are girls and boys, 13 to 72. Each uses a catalog app and a registry service that no family beat pairs today.

**Rules that hold in every story** (bible 4.2 and `persona-apps.md`). No game title, no game count, no frame rate, no "smooth", no "gaming PC", no "console replacement"; the Valve account and library stay Valve's and Steam is never "no account"; a given Core may not run a given game well (the Hub package declares no GPU), so a story says what the Core does, never how a game plays; the stream stays on the home network; kernel anti-cheat games are not promised; Discord and the friends' servers do not move; no teen talks to an AI companion; nobody is shown watched or filtered. Pi-hole and AdGuard Home are not parental control (`sec-safety-people`).

**Regulated domain.** Children's accounts and data. No story asks a child to sign in alone: a player's Valve account is hers (or his) and Valve's, and the household lead types any password. No story makes a claim about age rules, privacy law or child safety. Nothing is "kid-safe". No story shows a child's name on a screen or a readable detail.

**Age rule.** Nobody under sixteen uses a chat model or an agent. None of the ten apps is a chat or agent app; younger players (15 and 13) appear in story 8 with an ordinary tool. Remote access is not claimed: every scene is on the home network.

## 1. What the chapter and the families already show

**The chapter (3.3).** Steve, 16. Ranked Hub apps: Steam Headless (GeForce Now, Xbox Cloud Gaming), Jellyfin (Plex, Netflix), Immich (Google Photos, iCloud Photos), PairDrop (AirDrop), FreeCut and Open WebUI for one homework step. The honest limits: the Valve library stays Valve's, kernel anti-cheat games do not run, no GPU is declared and it streams a desktop in a browser. Pew 2024 is cited for 85% of US teens playing, 97% of boys and 75% of girls; the chapter itself flags that the files carry only boys.

**The pool** (`personas.json`, 3 apps): Steam Headless, Jellyfin and Immich.

**The families** (a count of beats that name an app, read from `content/families/*.json`, 2026-10-20). There are 7 gamers in the 30 family files: Tobi, Steve three times, Arjun, Bence and Hugo, aged 15 to 17, all boys. They have 28 app beats: Steam Headless 7, Immich 4, HomeHub 2, Blockbench 2, Jellyfin 2, and one each for mStream, LubeLogger, Navidrome, PairDrop, AudioMass, Habitica, VaultWarden, Yuvomi, Home Assistant, KitchenOwl and Forgejo. The services named: GeForce Now 10, Google Photos 5, MagicaVoxel 3, Plex 3, Apple Music 2, Drivvo 2, Spotify 2, AirDrop 2, TwistedWave 2, Todoist 2. Where they stand: the bed 7, the television 4, `room` 4, the fridge 3, the couch 2, the desk 2; the chapters sit in the bedroom 8, living 8, kitchen 5, kids 4, garden 2 and dining 1.

**What that leaves.** A gamer who is a girl, who is 13 or 72, who plays on the living-room screen with someone else, who plays tabletop, who cooks for visitors or who has a moped is not in the 28. Neither is a Steam story that is not Steve's bedroom.

## 2. How the ten were chosen

- Each differs in kind: a different room, a different moment of the week or the year, a different person who plays or is helped, and a different thing in the player's life.
- Each is one catalog app (`storySafe` yes, or with-caveat for Steam Headless, OpenCut and Tandoor Recipes; never `avoid`) with one registry service (no flag, `alternativeToForm` ok, `storyStatus` ok, the app is in the service's `storyApps` and has its name in its own `replaces`). Five of the ten apps are named by no family beat (OpenCut, Tandoor Recipes, AdGuard Home, Jotty, Blinko); the other five are named by 1 to 15 beats (Steam Headless 7, Blockbench 3, Donetick 1, Home Assistant 15, LubeLogger 1) but never with the service used here. Six of the ten services are named by no family beat (Xbox Cloud Gaming, Clipchamp, Autodesk Maya, Tody, Apple HomeKit, Fuelly); the other four are named by a few (AnyList 7, NextDNS 4, Trello 2, Google Keep 1). No pair repeats a pair of any family beat.
- The chip pair of every story is the app's display name, then `alternative to <Service>` (story v3 D5). The first sentence says what a rented tool held or changed and what the Core does instead; no company is named in it and none is accused of anything.
- Steam Headless appears once, in story 1; the chapter's other lead apps (Jellyfin, Immich, PairDrop) are not used here, so the gamer is not only a stream.
- Fresh against the other persona drafts of 2026-10-20 where it could be: four of the ten pairs are in no other draft, and the caveat of each of the other six names the drafts that share it.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first), who plays or acts and who is helped, and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation mark, no figure, no company named, no game title).

| # | App and service | Who (working name, age) | Room and anchor | When |
|---|---|---|---|---|
| 1 | Steam Headless, alternative to Xbox Cloud Gaming | Femke, 15, and her grandfather Pelle, 72 | `living`, `tv` | Sunday afternoon |
| 2 | OpenCut, alternative to Clipchamp | Thandiwe, 16 | `bedroom`, `desk` | Saturday morning |
| 3 | Tandoor Recipes, alternative to AnyList | Yaw, 17, with four cousins | `kitchen`, `range` | Friday afternoon, before they arrive |
| 4 | AdGuard Home, alternative to NextDNS | Nasrin, 16, with her mother | `living`, `couch` | Saturday morning |
| 5 | Jotty, alternative to Trello | Lorcan, 15 | `kids`, `desk` | Wednesday after school |
| 6 | Blinko, alternative to Google Keep | Zdenek, 17, with five friends | `patio`, `patio-seat` | A summer afternoon |
| 7 | Blockbench, alternative to Autodesk Maya | Ximena, 17 | `office`, `desk` | Thursday after school |
| 8 | Donetick, alternative to Tody | Soane, 15, and Mele, 13 | `kitchen`, `fridge` | Saturday midday |
| 9 | Home Assistant, alternative to Apple HomeKit | Imke, 16, with her father | `entry`, `room` | Saturday afternoon |
| 10 | LubeLogger, alternative to Fuelly | Amira, 17 | `garage`, `driveway` | Saturday morning, first week of a moped |

**1. Steam Headless, alternative to Xbox Cloud Gaming.** As a teen who plays, I want my grandfather to take the second seat on his own Steam account, so that the visit is a game and not a screen to stay away from.
- App `steam-headless`, service `xbox-cloud-gaming`. Caveat: Steam needs a Valve account to sign in, and the library and purchases are Valve's; the Core runs the session, the account stays with Valve, and the text never says "no account". A given Core may not run a given game well because the Hub package declares no GPU: say what the Core does (it runs the session at home), never how a game plays. No title, frame rate or "smooth"; not "gaming PC" or "console replacement"; the screen needs a browser; the stream stays on the home network; the container is not sandboxed. The chip uses the listing's own name for the alternative.
- Moment: `living`, anchor `tv` (fallback `couch`, `room`). Sunday afternoon, window light on the screen. First: two cushions side by side and a keyboard handed across.
- Who: Femke, 15, shows her grandfather Pelle, 72, who visits on Sundays and has signed in to his own Valve account himself.
- First sentence: "Femke's grandfather plays his own Steam library on the living-room screen, and the session runs on the Core."
- Popup title: "Granddad takes the second seat".
- Different in kind: a grandparent is a player; a living room, not a bedroom; two generations on one screen; a girl who teaches.
- Category `media`.

**2. OpenCut, alternative to Clipchamp.** As the one in the family who edits, I want the wedding clips cut into one short film for my aunt, so that she watches it together with the family and not as twelve phone videos.
- App `opencut`, service `clipchamp`. Caveat: OpenCut edits video in the browser of the device in use, and the footage stays on the Core. No QA screenshot (owner entry); `with-caveat`. No speed claim. No music rights claim: the soundtrack is whatever the family holds. The people filmed are family and agreed. The educator draft takes this pair for a lesson; the creative and maker drafts use OpenCut with CapCut.
- Moment: `bedroom`, anchor `desk` (fallback `room`). Saturday morning, light across the desk. First: a phone propped against a book, one clip trimmed, a name on a sticky note.
- Who: Thandiwe, 16, cuts her cousin's wedding clips for her aunt.
- First sentence: "Thandiwe cuts her cousin's wedding clips into a short film in her browser, and the footage sits on the Core."
- Popup title: "A short film for her aunt".
- Different in kind: the gamer as the family's editor; making something for someone else; a wedding, not a match.
- Category `creative`.

**3. Tandoor Recipes, alternative to AnyList.** As the host of the weekend, I want supper planned from the family recipe book and the list made from it, so that the cousins arrive to a table and not to a question.
- App `tandoor`, service `anylist`. Caveat: no QA screenshot (owner entry); `with-caveat`. Tandoor overlaps Mealie: one recipe app per household. Web interface only. Pasting a recipe address fetches that page from outside; what is saved stays on the Core. No nutrition, allergy or "safe to eat" claim. The business-owner draft uses the app with another service.
- Moment: `kitchen`, anchor `range` (fallback `kitchen-island`, `counter`). Friday afternoon, before they arrive. First: a stained recipe card from his grandmother propped against the spice jars.
- Who: Yaw, 17, hosts four cousins for the weekend and cooks their favourites.
- First sentence: "Yaw plans supper for four cousins from the family recipe book, kept in Tandoor Recipes on the Core."
- Popup title: "Supper for four cousins".
- Different in kind: the gamer as host and cook; a kitchen; visitors are the point.
- Category `food`.

**4. AdGuard Home, alternative to NextDNS.** As the one who knows the router, I want the living-room television to stop loading its banners, so that the whole house gets a quieter screen.
- App `adguardhome`, service `nextdns`. Caveat: no QA screenshot (owner entry). AdGuard Home blocks ads and trackers at DNS for every device on the network, with no software on the devices. It is not parental control and promises no safety (`sec-safety-people`). It overlaps Pi-hole: one per home. The router change is the household's and her mother approves it. No claim about faster pages.
- Moment: `living`, anchor `couch` (fallback `tv`, `room`). Saturday morning. First: a sticky note with the Core's address held beside the router.
- Who: Nasrin, 16, changes the router's DNS entry; her mother, an adult, watches and approves.
- First sentence: "Nasrin points the router at the Core, and the living-room television stops loading its banners."
- Popup title: "The TV stops asking for banners".
- Different in kind: the gamer as the family's tinkerer helping everyone else; the living-room screen, not her own.
- Category `iot`.

**5. Jotty, alternative to Trello.** As a player who wants to keep the session, I want my own evening in a list with homework first, so that I choose the order and nobody has to remind me.
- App `jotty`, service `trello`. Caveat: it is his own list, not a rule the house sets; no parental-control claim. Jotty is lightweight checklists and notes with Kanban boards; sharing is not claimed. No claim about grades, focus or habits. The journalist and business-owner drafts use the pair for other jobs.
- Moment: `kids`, anchor `desk` (fallback `room`). Wednesday after school, window light. First: a handwritten list is copied into the app and two items are ticked before the session starts.
- Who: Lorcan, 15, writes his own evening; his father passes with a snack and says nothing.
- First sentence: "Lorcan lists the evening on the Core, homework first and the session second, and he ticks each one himself."
- Popup title: "Homework first, then the session".
- Different in kind: discipline told as the player's own choice, not a parent's rule.
- Category `kids`.

**6. Blinko, alternative to Google Keep.** As the one who runs the game, I want my campaign notes captured on my phone between rounds and read later on the laptop, so that the story is not lost when the dice roll.
- App `blinko`, service `google-keep`. Caveat: Blinko captures quick notes; no QA screenshot (owner entry). The phone reaches it while it is on the home Wi-Fi. The listing's "find by meaning" may rely on a model: leave it out and say only that notes are found later. The characters are invented; no friend's detail is stored. No game title; Discord friend servers stay where they are.
- Moment: `patio`, anchor `patio-seat` (fallback `garden`, `deck`, `room`). A summer afternoon. First: dice, a hand-drawn map and a phone propped on a mug while he types a villain's name.
- Who: Zdenek, 17, runs a tabletop campaign for five friends at the patio table; the friends are visitors and the notes are his.
- First sentence: "Zdenek keeps his campaign notes on the Core, typed on his phone between rounds at the patio table."
- Popup title: "The campaign, noted between rounds".
- Different in kind: tabletop, not a screen; the patio; the gamer as host and storyteller.
- Category `creative`.

**7. Blockbench, alternative to Autodesk Maya.** As a student on a 3D module, I want the model built first and the render after, so that the coursework is a real place and not a deadline.
- App `blockbench`, service `autodesk-maya`. Caveat: Blockbench models low-poly 3D in the browser; the coursework is submitted by the school's own route and the school's platform stays the school's. No game title (the listing mentions a block-building game: do not repeat it). Blockbench is in three family beats (Steve and Hugo, with MagicaVoxel); the creative and maker drafts use this pair for other jobs.
- Moment: `office`, anchor `desk` (fallback `kids`, `room`). Thursday after school. First: a sketch on squared paper by the window, then blocks appear.
- Who: Ximena, 17, takes a 3D module at sixth form and builds a model of her grandmother's market stall.
- First sentence: "Ximena builds the model of her grandmother's market stall in a browser tab, and the files sit on the Core."
- Popup title: "Model first, render second".
- Different in kind: a girl's coursework; a model of a real place; the father's spare desk, not a bedroom.
- Category `creative`.

**8. Donetick, alternative to Tody.** As the elder of two, I want the turns on the family screen to follow who did the kitchen job last, so that the argument ends at the fridge.
- App `donetick`, service `tody`. Caveat: Donetick assigns and tracks household chores; its notifications use Telegram or Pushover, outside services, so the scene leaves them off and reads the list at the fridge. Not parental control; no fairness or behaviour claim. Donetick is named in one family beat (Yuna and the fruit bowl); the host and lawyer drafts use this pair for other jobs.
- Moment: `kitchen`, anchor `fridge` (fallback `kitchen-island`, `counter`). Saturday midday. First: two siblings disagree about whose turn it is and look up at the tablet beside the fridge.
- Who: Soane, 15, and his sister Mele, 13, with their father in the next room. Both use an ordinary tool, not a chat app. Mele is 13 because `cast-lint.mts` lets a child under 13 be only a learner or a maker.
- First sentence: "Soane and Mele let the chore list on the Core decide whose turn it is, and the dishes decide who plays first."
- Popup title: "The dishes decide who plays first".
- Different in kind: younger players; siblings; fairness; the kitchen.
- Category `kids`.

**9. Home Assistant, alternative to Apple HomeKit.** As a player who shares the house, I want the hall lamp to glow while my session runs, so that the family knows without knocking and I am not interrupted.
- App `home-assistant`, service `apple-homekit`. Caveat: it needs a lamp Home Assistant can reach on the home network. There is no Zigbee stick by default. No energy claim. The rule is hers and the family's: they agreed it, and nobody is watched. The session is a Steam session on the Core; the Valve account stays Valve's. Home Assistant is in 15 family beats, always with other services; the host draft uses this pair.
- Moment: `entry`, anchor `room` (fallback `core`). Saturday afternoon. First: a hand turns a lamp on the landing and sets it to a warm colour.
- Who: Imke, 16, sets the rule; her father, an adult, nods.
- First sentence: "Imke sets the hall lamp to glow while her session runs, so the family knows without knocking."
- Popup title: "A lamp that says session".
- Different in kind: a teen negotiating shared space; light as a signal; the hall.
- Category `iot`.

**10. LubeLogger, alternative to Fuelly.** As the owner of a first moped, I want its fill-ups and service dates written down from the first week, so that the history is there when I need it.
- App `lubelogger`, service `fuelly`. Caveat: records only: service dates, fuel entries and reminders she types. No mileage or fuel-saving claim; no safety, helmet or licence statement. LubeLogger is in one family beat (Steve's oil check, with Drivvo); the host draft uses this pair.
- Moment: `garage`, anchor `driveway` (fallback `room`). Saturday morning in the first week. First: a helmet on the saddle and a receipt flattened on the seat.
- Who: Amira, 17, has her first moped.
- First sentence: "Amira's first moped has a service history from its first week, kept in LubeLogger on the Core."
- Popup title: "The first fill-up, written down".
- Different in kind: a girl with her own vehicle; a driveway; a life outside the screen.
- Category `home`.

## 4. How the ten differ from each other

| Axis | Spread |
|---|---|
| Age of the player | 13, 15, 15, 15, 16, 16, 16, 17, 17, 17, 17, 72 |
| Who is helped or plays beside | a grandfather, an aunt, four cousins, a mother, a father, five friends, a sibling, a family |
| Rooms | living (twice), bedroom, kitchen (twice), kids, patio, office, entry, garage |
| Moment | Sunday afternoon, Saturday morning (three times), Friday before guests, Wednesday after school, a summer afternoon, Thursday after school, Saturday midday, a first week |
| Girls and boys | seven girls, four boys and a grandfather; the thirty families have no girl and no grandparent who plays |

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json`, `casting.json`, the 30 family files and the other persona drafts):

- Every app id is in the catalog, is in the live store and is not `avoid`. Steam Headless, OpenCut and Tandoor Recipes are `with-caveat`; the other seven are `yes`. No app or service repeats inside this file.
- Every service id is in `services.json` with no flag, `alternativeToForm` ok and `storyStatus` ok; the app is in that service's `storyApps` and the service is among the app's own `replaces`.
- No pair appears in any family beat. Four of the ten pairs (stories 1, 3, 4 and 6) are in no other persona draft read on the same day. The other six are also in one to three drafts: OpenCut with Clipchamp (educator), Jotty with Trello (business-owner, journalist), Blockbench with Autodesk Maya (creative, maker), Donetick with Tody (host, lawyer), Home Assistant with Apple HomeKit (host) and LubeLogger with Fuelly (host); each caveat says so.
- The ten first sentences are 15 to 22 words, with no digit, dash or exclamation mark, no company name, no game title and none of the `claims.json` error patterns.

Open items for the owner:

- **`reviewed.json`.** OpenCut, Tandoor Recipes, AdGuard Home and Blinko have no QA screenshot on `origin/main`; a beat that names any of them needs an owner entry (`app-qa-screenshot`).
- **Pool.** Only Steam Headless is in the `gamer` pool (`personas.json` and `cast-lint.mts` agree). `persona-cover` needs only one pool app in a gamer's beats, so this is not a blocker; the stories above show that a gamer's day has more apps in it than three.
- **Casting.** The thirty families cast every gamer as a boy. These stories need girls and a grandparent who plays; the cast plan decides who.
- **Beyond the home.** Valve's account rules, the school's platform, the router's maker and the friends' servers are outside what a home Core holds; none is told here.
