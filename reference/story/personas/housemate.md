# Housemate (`housemate`)

Deep dive for one proposed archetype, written 2026-10-20 as a draft for the owner. Category: Run the household (`household`). Nearest existing archetype: `organiser`, with `host` beside it. Companion OS, Companion Memory and Companion Agents are in beta.

Nobody here is a customer. Ages, households, flats and lines are design choices for fictional characters. Statements about how people live are editorial synthesis, tagged [?] where a reader could take them for a fact; nothing below is a statistic. Only the catalog, registry, role and room facts are checked, and the checking is listed in section 14. Read this with [personas.md](../personas.md), [persona-apps.md](../persona-apps.md) and [persona-bible.md](../persona-bible.md), which win wherever they disagree, and with `content/story/claims.json`, which is the wording law.

**One line.** Shares a rented flat with friends or a partner: the bills, the chores, the shelf and the telly.

**Not the organiser.** The organiser is the records office of a household and a practice of one, working from a desk. The housemate has no desk job on the Core and no paperwork empire. Their job is the shared edges of a flat: who owes whom this month, whose turn it is, what is on the shelf and what plays on the telly. **Not the host** either: the host feeds, ferries and waters a family house with children and guests. The housemate lives with adults, expects to move again, and has a shelf rather than a house. **Not the money keeper** (`personas/money-keeper.md`): that persona owns a household ledger with receipts and renewals. The housemate only needs the shared part of the money, between two or three adults, and it ends when the tenancy does.

---

## 1. Who

It is a Sunday in late morning and the light is on the fridge door. Someone has put the kettle on, someone else is carrying the recycling down, and the third person is on the sofa with a phone, working out that the broadband went out of one account and the shopping went out of another. Nobody has asked who owes whom since the last time it got awkward, and nobody wants to be the one who asks. A rota is stuck on the fridge in two different handwritings. The telly is on with something that three people chose together, because only one of them has the plan that has it. At the back of the cupboard are two kettles, a slow cooker nobody is sure belongs to anyone, and a crate with the name of a person who moved out in the spring. The flat is rented. They like it, they will not be here in three years, and they would like what they set up to come with them.

The role has no age and no gender. The cast can give it to a twenty-two-year-old on a first tenancy, to two friends in their late thirties who have shared for ten years, to a partner pair in a one-bedroom flat, to a fifty-six-year-old who shares their flat with a lodger, to someone in their forties who shares with a cousin, or to two siblings in their fifties who kept the family flat. Households are two or three adults, never children; the flat is any of the six apartments, or one of the thirty homes that is small enough to be shared. Some are keen early adopters who set the Core up for the flat and are quietly proud of it. Others only want the shared things to work and the group chat to stop being the filing system. What they share is the habit of splitting things fairly, and for most of them the expectation of moving again.

## 2. What they are responsible for

- **The shared money, by the month.** The broadband, the energy, the cleaning supplies, the kitchen roll. Who paid what, who owes whom, settled up with as few payments as the sums allow. The stake is the peace of the flat. The app does not move money, and the story gives no advice about money.
- **The chores.** The bins, the communal stairs, the oven, the bathroom. A fair turn, a visible rota and no scoreboard. The tool is a reminder, not a judge.
- **The shelf.** The shared kettle, the drill, the extension lead, the toolkit, the things that belong to the flat rather than to a person. Where they are and which box they go in when the lease ends.
- **The shared plans.** The streaming plan, the music plan, the broadband contract, the cleaner someone books by app. What renews when and who covers it.
- **The telly and the speakers.** What the flat watches and plays on its own screen, from files the housemates themselves have.
- **The grocery list and the cooking turns.** What is running low, whose night it is to cook, what the leftovers are for.
- **Getting a file across the room.** The picture of a receipt, the PDF of a recipe, the sign-up form for the new meter. From one person's phone to another's laptop, whatever make each is.
- **The move.** When someone leaves or the tenancy ends: the tally closed, the shelf packed, the plans ended, the Core wrapped up and taken to the next flat. They answer to the other adults in the flat, not to a regulator.

## 3. What they rent today

Named services that exist in `content/story/services.json` (no `stale` or `story-excluded` flag, `alternativeToForm` ok, `storyStatus` ok). The pairing is the catalog's own `replaces` list, and each registry entry lists the app in its `apps` field. A story writes "<App> is an alternative to <Service>", the second chip reads "alternative to <Service>", and the sentence never says what the company does to anyone (`incumbent-attack`, `f-incumbent-claims`).

| Registry id | Name | Category | What the household keeps there | Hub app that is an alternative |
|---|---|---|---|---|
| `splitwise` | Splitwise | finance | Who owes whom in the flat, month after month | Spliit |
| `tricount` | Tricount | finance | A group tally with an end date: a purchase, an event, a leaver | Spliit |
| `tody` | Tody | home | The cleaning and chore rota | Donetick |
| `rocket-money` | Rocket Money | finance | The list of plans and subscriptions that renew | Wallos |
| `ynab` | YNAB | finance | Recurring costs, in someone's old budget | Wallos |
| `airdrop` | AirDrop | utilities | A photo or a file sent between devices in the room | PairDrop |
| `plex` | Plex | media | A film and music library, often served from one person's laptop | Jellyfin |
| `netflix` | Netflix | media | The household's shared viewing | Jellyfin |
| `sortly` | Sortly | home | A list of what is in which box | HomeBox |

Also true of a typical flat, and not offered by this persona: a group chat on a messaging service (the registry has `whatsapp` but marks it `uncurated-only` with no story apps, so it is never named as replaced; the flat's group chat stays where it is), a shared calendar and a shared grocery list on a service the registry does not pair with KitchenOwl. **Not to be named:** `ourhome` carries the flag `stale`, although Donetick lists "OurHome" in its catalog `replaces`; use `tody` for Donetick. KitchenOwl lists no `replaces` name and no registry service lists KitchenOwl, so its story is a pair-less beat (section 11, story 9) and must not say "replaces AnyList" (persona-apps.md). Typical stacks are a split-costs app plus a chore app plus a streaming plan plus a group chat; nobody has all nine [?].

## 4. What the Hub offers them

Store ids and display names are the catalog's (`content/story/catalog-apps.json`, all `storySafe: "yes"`, all in the live store, none tagged `ai: "chat"`). The caveat column is the catalog entry's own text plus what `claims.json` adds; a story must stay inside it. QA is the catalog's `qa` field.

| Catalog id | Display name | What it does for this person | Replaces (catalog) | Honest caveat from the catalog | QA |
|---|---|---|---|---|---|
| `spliit` | Spliit | Splits shared costs among housemates and settles up with the fewest payments. | Splitwise, Tricount | None in the catalog. claims.json: it does not move money. | screenshot |
| `donetick` | Donetick | Assigns and tracks chores and recurring tasks; a task can be completed by tapping an NFC tag. | Tody (OurHome is stale) | Notifications use Telegram or Pushover, both outside services. | screenshot |
| `wallos` | Wallos | Lists every subscription the flat still pays for and reminds before each renews. | Rocket Money, YNAB | Fetches logos for popular services from outside. Do not promise savings. claims.json adds: no "cancels for you". | screenshot |
| `pairdrop` | PairDrop | Sends files between phones and laptops on the same Wi-Fi. | AirDrop | None in the catalog. The catalog names only the same Wi-Fi, so a story stays inside the flat. | screenshot |
| `jellyfin` | Jellyfin | Streams the flat's own movies, shows and music to every screen in the house. | Plex, Netflix | Plays your own files. Say that, not "Netflix". Never imply copyrighted or pirated material, or streaming-service content. | screenshot |
| `kitchenowl` | KitchenOwl | A shared grocery list, recipe book and meal planner for the household; the catalog description adds an expense tracker, which Spliit already covers, so this persona leaves it. | none | Learns from your list habits per its manifest. | screenshot |
| `homebox` | HomeBox | Catalogues what the flat owns, where it is and its photos. | Sortly | Barcode and Open Food Facts lookups call outside services. **No QA screenshot** on origin/main: a beat needs a line in `content/story/reviewed.json` (`app-qa-screenshot`). The catalog description mentions the warranty end date; claims.json says do not say it tracks warranties until the listing is re-read. Say "what it is, where it is, a photo". | no-screenshot |

**Fleet headroom.** Counting the 30 family files by text search on 2026-10-20 (the app in a beat's `app.id` or `with`; re-count with the validator): Jellyfin is in 13 of 30 (43 percent, already over the 40 percent cap), KitchenOwl in 10 (33 percent), Wallos 5, PairDrop 2, Spliit 1, Donetick 1, HomeBox 0. Lead with Donetick, Spliit, PairDrop and HomeBox. A Housemate family should take at most one of Jellyfin and KitchenOwl, and only when another family gives one up; the stories in section 11 that use them (7, 8 and 9) are alternatives to each other, not a set.

**Gaps in the wording law.** `claims.json` `apps[]` has entries for Jellyfin, Spliit, Wallos and HomeBox. It has none for Donetick, PairDrop or KitchenOwl, so `mayDescribeAs` for those three falls back to the catalog description. The owner may want entries added before a family is written.

**Not offered:** Rallly (polls need outside reach, trap T6), Mealie (no QA screenshot; KitchenOwl is the verified list app), Yuvomi and HomeHub (they hold a family planner and would give the flat a second app of the kind `chores` and `list`; the `household-kind` rule allows one per household), Immich (a photo library is the maker's and the host's, and a flat has little shared photography), Home Assistant (the flat is rented and a lamp rule is not this persona's), VaultWarden (at the fleet cap, and a flat should not share one vault by reflex). Nothing in the seven is a chat model or an agent, so the age rule 16 never binds a beat of theirs.

## 5. Where they spend time

Kinds of places and media, with nothing invented and no figures [?].

- **The flat's own corners.** The fridge door, the hall by the front door where the bike and the post live, the sofa on a weekend afternoon, the dining table on a Sunday, the washing line or the laundry cupboard.
- **The group chat.** The flat's thread is where the bins, the bills and the "who ate the last one" live. It stays; the persona does not try to move it.
- **Flatshare listings and the groups around them.** The people who find a room through a listing site or a friend of a friend, and the neighbourhood groups where someone advertises a spare room, a sofa or a bike.
- **Second-hand furniture and kitchenware.** Charity shops, local classified-ad pages, a neighbour's skip. A flat is furnished in increments, and the shelf is where the increments end up.
- **Supermarkets, a laundrette or a corner shop**, the places the list is used and the receipt is born.
- **The telly and the speaker.** Films and series chosen together, a playlist for cleaning, a friend's film, a stack of home videos. Streaming plans are shared by habit.
- **Money and living advice.** Personal-finance podcasts, tenants' guides from advice charities and local councils, video channels about living in small spaces. The persona reads them as a tenant, not as a customer, and nothing on this site gives advice of that kind.
- **For the keen early adopter, the self-hosting forums**, the Home Assistant and self-hosted communities, and the video channels about small-home networking. For the others, none of them; "Reddit or the manual" is for the person who set it up.

## 6. How they talk

Pace is the house voice at 150 words a minute (`claims.json`); the persona's pace is therefore sentence length and pauses. Six to twelve words, a pause after the number or the name. Warm, wry, plain and fair-minded: the register of a group chat that has learned to be kind. Humour is domestic and in the open: the rota, the fridge shelf, the thermostat, the kettle that nobody owns. Never at a person's expense and never the housemate who "never cleans" as a type.

- **Owns (jargon):** rota, tally, split, settle up, kitty, my shelf, the group chat, sublet, move-out, box, the Wi-Fi, the telly.
- **Turn-offs:** "family" said of friends; "smart home"; "home lab"; "self-hosted"; "container"; "digital transformation"; fear about landlords or strangers; any hint that the flat is a lesser kind of home. Also "seamless", "effortless" and "easy" (`buzz-core`, `buzz-simple-claims`), and "household management", which sounds like a job.
- **Say what is true and small:** "The tally sits on the Core." "Three of us, one list." "Whose turn is the bin." Not "powerful", "all-in-one" or "keep everyone in sync".
- **Never** a joke that sorts people by who cleans, who cooks or who sets up the technology. The one who sets it up is the household lead, never the admin.

## 7. Comfort with technology and attitude to AI

Comfort runs from 1 (needs everything set up) to 5 (runs servers). Typical is 3, with a spread that matters: the person who set up the Core is 4, the person who only wants the telly to work is 2. [?] A flat of three has all of them. The story must give the 2 a reaction, not the 4 a speech.

**Attitude to AI: the honest range.** A keen early adopter is proud of the Core and happy to say a local model exists, but would not choose it as the headline. Someone who just wants it to work will use an app and not ask what is under it. A wary housemate may dislike the word "AI" and does not need it for any of the seven apps here. Another has used a chat model for work and does not want it near the flat's money. None of them is wrong, and none of them is the audience for a pitch. The rule is the bible's: the hero is the chore (the tally, the rota, the list), never a model. No beat for this persona needs a chat model or an agent; if a family wants one, the member is 16 or older (all housemates here are adults), the one named chore is bounded, the person approves, and the beta line rides along. An agent that texts through the flat's group chat passes through that chat service (`cap-messaging-private`) and is not private on a cloud model (`cap-cloud-model`). One household, one Core: never an agent or a memory "for each of us" (`cap-multi-user`).

## 8. Objections and the honest limits

Objections a Housemate raises, in their own register:

- "I am not paying to look after something the others will not use." The answer is the tally and the rota: the other two only open one thing, and the person who set it up is the household lead, not the flat's IT.
- "We will move." The Core goes with the household. The story says nothing about transfer or export beyond what the apps list.
- "What if we fall out?" A Core belongs to one household and cannot be divided. When the household ends, someone takes the Core and the others take what they copied out. No story promises a clean split.
- "I want to see my share." The tally shows who owes whom, the same list for each of them. Nothing is said about who can see what beyond that (`cap-multi-user`).

Honest limits:

- **Remote access is not claimed.** A cost cannot be entered at the till, a list cannot be opened in the shop aisle and a chore cannot be ticked on the bus. Every scene is at home, on the home Wi-Fi (`cap-remote-access`). Entries are made from the receipt, at the flat.
- **One household, one Core.** The Core does not give each housemate a private space, a private memory or a private agent, and no story says it does (`cap-multi-user`). A person who wants their files hidden from a housemate should not rely on the Core for that. Some apps have their own logins; stories do not lean on that.
- **No story calls the Core a backup.** It holds the flat's tally and files; nothing is claimed about losing them.
- **Spliit does not move money.** The sum is settled by the people, through their banks.
- **Donetick notifications use Telegram or Pushover,** which are outside services.
- **Wallos tracks; it does not cancel, negotiate or save.** And its list is not a YNAB budget.
- **PairDrop needs the same Wi-Fi.** The catalog says nothing more, so a story stays in one flat.
- **Jellyfin plays the flat's own files.** It is not a streaming catalogue, and the Netflix chip is a comparison, not a promise that any title is there.
- **HomeBox is an inventory, not a record of the flat's condition,** and no story says it protects a deposit or settles a dispute.
- **Setup uses the internet.** Installing apps from the Companion Hub store, and any outside service an app calls, does (`internet-steps`).
- **The Core needs a shelf and a socket,** and the flat's home network. Nothing is claimed about a landlord's or a building's network.

## 9. Claims boundary

Never for this persona (ids are `bannedPhrases` or `forbiddenClaims` in `content/story/claims.json`):

- **Money.** No savings, payback or "cheaper" (`num-savings`, `f-savings`); no price, rent figure or dollar amount (`num-dollar`, `f-prices`); no time saved (`num-time-saved`); no "saves you money" or "fairer" as a measured result.
- **Regulated domain: finance (shared costs).** No financial, tax or investment advice, no claim that a tally is accurate or complete, no "audit-ready" or "compliant" (`legal-claims`, `f-legal-tax-fin`, `sec-compliance`, `f-compliance`). Say only what the app does and where the files live: "The tally sits on the Core."
- **Regulated adjacent domain: tenancy and the law.** No tenancy, deposit, landlord, eviction or consumer-rights advice, no "evidence", "proof of condition" or "protects your deposit", and no statement about what a lease permits. HomeBox lists what is where. Nothing more (`legal-claims`).
- **Regulated adjacent domains, otherwise.** No children's data (every member here is an adult), no health or diet claim in a recipe or meal plan (`sec-medical`, `f-medical-care`), no allergen or "safe to eat" line. A cooking rota is a rota.
- **Security.** No "private", "secure" or "safe" on their own (personas.md rule 3); no unbreakable, no "nothing leaves", no "works offline" (`sec-absolute`, `sec-never-leaves`, `sec-offline`). Wallos fetches logos from outside, HomeBox lookups call outside services and Donetick notifications use outside services, so "nothing leaves the Core" is false for them.
- **Reach.** No "from anywhere", no "on the road", no "while you are away", no VPN, tunnel or share link (`cap-remote-access`); no Companion mobile app (`cap-mobile-app`); no per-person isolation, no "roommates cannot see", no separate accounts or spaces per housemate (`cap-multi-user`).
- **Media.** Jellyfin streams the flat's own movies, shows and music. Never a streaming catalogue, never a title, never a pirated or ripped-on-the-side hint, never "cancel Netflix" (`cap-own-apps`, `incumbent-attack`, catalog and claims caveats).
- **Honesty.** No testimonial, rating, user count or "real flatmates" (`fake-social-proof`, `f-testimonial`); no agent that moves money, cancels a plan or contacts a landlord (`cap-autonomy`, `f-agent-autonomy`); no house id or builder name in a story's words (`internal-ids`).
- **Brand and register.** No attack sentence about a named company and no unsourced allegation about one (`incumbent-attack`): the beat names the Hub app first and the service only in the comparative chip. Companion Core, Companion Hub, Companion OS and Companion Memory in Title Case. No exclamation, no em or en dash, no ease claim, no "assistant", "bot", "home server", "NAS" or "app store".
- **The word "family".** The disclosure "Fictional family. Real software." is fixed text (`fictional-family`). The persona does not call friends a family in its own copy; see the open question in section 14.
- **Fear.** Do not open on a landlord, a lost deposit, a scam or a surprise charge as a threat; name the mechanism calmly (`sec-fear`).

## 10. Fit: homes, rooms, furniture, casting

**Homes.** A small place with a shared living room and a kitchen, two or three bedrooms (or one, for a partner pair), and `tenure: "renter"` in the cast plan. The schema already has a member role `housemate` (`MEMBER_ROLES`, the schema enum and the page label), and no member of the current cast uses it: the 30 homes carry parent, partner, teen, child, grandparent, baby and adult-child only. The six apartments fit best (`reference/story/persona-bible.md` 5.2). By their rooms:

- **Two-Bedroom Flat (`two-bed-flat`)**: Dining Room, a Study Alcove, two bedrooms. The closest fit for two or three adults. Its present cast is a young family, so a Housemate household would replace it or be an extra row.
- **Walk-up Duplex (`walkup-duplex`)**: Kitchen and Dining of 28 m2 and a Study Landing desk. A good kitchen-island and dining-table home; its present cast is four.
- **City One-Bedroom (`city-one-bed`)**: a Desk Nook and the buildings' shops. A partner pair as a household of two, with the living room as the shelf.
- **Warehouse Loft (`studio-loft`)**: a loft that could hold two friends or a partner pair, with the workshop desk and a record player on the platform (the record player is the `music` anchor).

Of the 30 homes, the renters are `modernhome-nora`, `starter18k`, `cutestarter`, `payorote` and `flowerycottage`; all have a cast already. Do not recast them for this persona without the owner.

**Rooms and furniture** (room ids from the schema's `roomRole`, anchor roles from `roles.json`):

| Room | Anchors, in preference order | What happens there |
|---|---|---|
| `kitchen` | `kitchen-island`, `fridge`, `counter`, `range` | The month's receipts, the rota on the fridge door, the grocery list |
| `dining` | `dining-table` | The Sunday pile: renewals, the plan list, the settle-up |
| `living` | `couch`, `tv`, `bookshelf`, `music` | The telly, the shelf, the Core on its shared shelf |
| `entry` | `bicycle`, `front-door` | A leaver's box, the flat's bike, the post |
| `laundry` | `laundry` | The bin rota, the cupboard where the chore tag lives |
| `bedroom` | `desk`, `bed` | A person's own corner for a one-off, not their private archive |

Fallback anchors in any room: `room`, `core`. The Core sits on a shared shelf in the living room, not in a bedroom, so the story of the flat is the story of a shared object. There is no role for a hallway shelf, a bin or a fridge shelf; use the nearest anchor. Pair every tinkerer scene with a reaction from someone who does not tinker.

**Ages and household shapes to cast.** All members are adults of 18 or more; the cast plan's youngest adult is 19 today. Ages 22 to 58 across the fleet. Shapes: two friends; three friends; a partner pair; a pair of friends and a partner; an older person who shares their flat with a lodger; two siblings who share a flat. Not every household needs a Housemate to be 25: give the role to a fifty-year-old before a second twenty-five-year-old. A family of this persona covers at least two archetypes, so pair it with another: a builder, a learner (an adult student or a night-school learner), a maker, a marketer or an educator. The rule that a business home keeps an organiser, builder or business-owner does not apply to a flat of friends.

**Casting warning against stereotype.** The role is never given to a person by reflex. Not to the youngest, not to the woman because she keeps the rota, not to the man because he set the Core up, not to the immigrant, the student or the "low earner" by assumption, not to the person with a disability as a plot point. The one who runs the tally is not always the same gender as the one who runs the telly. The household lead is not a gender and is not the Housemate by default. The name set stays balanced (no archetype with three or more members may be more than 65 percent one gender-coded name set), and the flat is told as an ordinary home, not as a phase to grow out of.

## 11. Ten user stories

Each tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along and a one-line story moment. Chips for every story with a service: the app's display name, then "alternative to <Service>". Story 9 has no service and one chip. The stories are from the persona's side, without a name. Seven apps and nine registry services carry ten stories, so Spliit, Wallos and Jellyfin each carry two with different services and different moments; stories 7, 8 and 9 compete for the same fleet slot (section 4).

**1. Spliit, alternative to Splitwise.** As a housemate, I want the flat's shared bills in one tally so that nobody has to ask who owes whom.
- App `spliit`, service `splitwise`. Caveat: it does not move money; costs are entered at home from the receipt.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `fridge`, `counter`, `room`). Three receipts lie on the island beside the laptop. First: the receipts are entered and the tally comes out with the fewest payments.

**2. Spliit, alternative to Tricount.** As a housemate who is leaving, I want to close the flat's shared tally with everyone settled so that I walk out with nothing left to chase.
- App `spliit`, service `tricount`. Caveat: it does not move money; no promise of an export or a transfer, and no tenancy or deposit advice.
- Moment: `entry`, anchor `bicycle` (fallback `front-door`, `room`). A moving crate and a bike by the door. First: the last tally is looked at and the balance is paid by hand.

**3. Donetick, alternative to Tody.** As a housemate, I want a fair rota for the bins and the cleaning so that nobody keeps the count in their head.
- App `donetick`, service `tody`. Caveat: notifications use Telegram or Pushover, both outside services; no league table of who did most.
- Moment: `laundry`, anchor `laundry` (fallback `counter`, `fridge`, `room`). A tag by the bin cupboard. First: someone taps the tag and the rota moves to the next person.

**4. Wallos, alternative to Rocket Money.** As a housemate, I want one list of the plans the flat shares, with who covers each and when it renews, so that nothing renews on a date only one person knows.
- App `wallos`, service `rocket-money`. Caveat: fetches logos from outside; no savings promise, nothing cancelled for anyone.
- Moment: `dining`, anchor `dining-table` (fallback `couch`, `desk`, `room`). A Sunday and a pen. First: a reminder comes up before the broadband renews.

**5. PairDrop, alternative to AirDrop.** As a housemate whose phone is a different make from the others', I want to send a picture or a PDF to a laptop in the room so that nobody has to message it to themselves.
- App `pairdrop`, service `airdrop`. Caveat: the same Wi-Fi only; the flat is the whole scene.
- Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`, `couch`, `room`). A receipt on the counter. First: a picture of the receipt lands on the laptop open at the tally.

**6. HomeBox, alternative to Sortly.** As a housemate, I want a list of the flat's shared things with a picture and a place so that the right box gets packed when we leave.
- App `homebox`, service `sortly`. Caveat: barcode lookups call outside services; no QA screenshot (a `reviewed.json` line); no warranty claim; not a record of the flat's condition.
- Moment: `living`, anchor `bookshelf` (fallback `couch`, `room`). The drill, the extension lead and the spare bulbs on the lower shelf. First: a picture of the tool kit goes in, with a place named.

**7. Jellyfin, alternative to Plex.** As a housemate, I want the flat's film and music library off one person's laptop so that it does not leave when they do.
- App `jellyfin`, service `plex`. Caveat: plays your own files; no streaming content, no title, nothing pirated.
- Moment: `living`, anchor `tv` (fallback `couch`, `room`). A laptop with a sticker of a band, a Core on a shelf. First: the library is copied across and plays on the telly.

**8. Jellyfin, alternative to Netflix.** As a housemate, I want the flat's own films, music and home videos on the telly so that a weekend afternoon does not depend on whose plan we are on.
- App `jellyfin`, service `netflix`. Caveat: it is a library of your own files, not a catalogue; the chip is a comparison, never a promise that any title is there.
- Moment: `living`, anchor `couch` (fallback `tv`, `music`, `room`). A friend's short film and a playlist for cleaning. First: the three of them pick what plays, from the flat's own shelf.

**9. KitchenOwl, no registry service.** As a housemate, I want one grocery list and one meal plan for the flat so that two of us do not buy the same oat milk.
- App `kitchenowl`, no service (a pair-less beat; one chip). Caveat: learns from your list habits per its manifest; the list is used at home, not in the shop aisle; no diet, allergen or "safe to eat" line.
- Moment: `kitchen`, anchor `fridge` (fallback `counter`, `kitchen-island`, `room`). The paper list on the fridge door is going soft. First: the first week's list is typed into KitchenOwl and the door is clear.

**10. Wallos, alternative to YNAB.** As a housemate who budgeted in an old app mostly to remember what recurs, I want the flat's recurring costs listed with their dates so that we know which to end or hand on when we move.
- App `wallos`, service `ynab`. Caveat: Wallos lists and reminds; no budget is claimed and no move of an old budget; no savings promise, nothing cancelled for anyone.
- Moment: `bedroom`, anchor `desk` (fallback `dining-table`, `room`). A moving date on the calendar. First: the broadband and the shared plan are listed with their renewal dates, ready to be ended or handed on.

## 12. Six beat seeds

The first sentence a visitor reads. Each is 20 words or fewer, sentence case, no dash, no exclamation. They name what the rented service held, charged or changed and what the household's own copy does instead, and none says what a company does to anyone. Not used: "learned". There is no honest, sourced sentence about what a service learns, and `sec-fear` forbids implying it.

1. **Spliit / `splitwise` (held).** Who owed whom in the flat sat in a split-costs app; Spliit now keeps the tally on the Core.
2. **Donetick / `tody` (held).** The bin rota lived in Tody and one person's phone; Donetick now keeps it on the Core for all three.
3. **Wallos / `rocket-money` (charged).** Three plans renewed in one week, each from a different housemate's account; Wallos now lists them on the Core.
4. **Jellyfin / `plex` (changed).** The flat's films ran through Plex on a laptop that is moving out; Jellyfin now serves them from the Core.
5. **HomeBox / `sortly` (held).** Which crate held the drill sat in Sortly; HomeBox now lists every crate, with a picture, on the Core.
6. **PairDrop / `airdrop` (changed).** Sending a picture to a laptop of another make meant a chat message; PairDrop sends it across the flat's Wi-Fi.

## 13. The `personas.json` row

For `content/story/personas.json` (`archetypes["housemate"]`). Every room is a room id in `roles.json` and the schema's `roomRole`; every anchor role is a `roleId`; each app is a catalog id with `storySafe: "yes"`. `rooms` and `fallbackRooms` do not overlap. The row is the proposal only: adding the archetype also touches the schema enum, `assets/story/types.ts` (`ARCHETYPES`), `scripts/story/build-casting.mts`, `scripts/story/cast-lint.mts` (its pools) and the fourteen-archetype tests in `scripts/test-stories.mts`, which this draft does not do. The example name is a proposal; the cast step checks it against the fleet.

```json
"housemate": {
  "label": "Housemate",
  "description": "Shares a rented flat on one Core: the bills, the chores, the shelf and the telly.",
  "example": "Tamsin",
  "rooms": ["kitchen", "living", "dining"],
  "fallbackRooms": ["entry", "laundry", "bedroom"],
  "anchorRoles": ["fridge", "kitchen-island", "dining-table", "couch", "tv"],
  "fallbackAnchorRoles": ["counter", "bookshelf", "bicycle", "laundry", "desk", "room"],
  "apps": ["spliit", "donetick", "wallos", "pairdrop", "jellyfin", "kitchenowl", "homebox"]
}
```

## 14. What was checked

On 2026-10-20, by reading the files (a read-only script): all seven app ids exist in `catalog-apps.json`, are `storySafe: "yes"`, are in the live store and carry no `ai` tag; all nine service ids exist in `services.json` with no flag and `alternativeToForm: "ok"` (`ourhome` carries `stale` and is left out); each service lists its paired app in `apps` (`splitwise` and `tricount` list `spliit`; `tody` lists `donetick`; `rocket-money` and `ynab` list `wallos`; `airdrop` lists `pairdrop`; `plex` and `netflix` list `jellyfin`; `sortly` lists `homebox`); each paired app lists the service name in its catalog `replaces`; every room id is in the schema's `roomRole` and every anchor role in `roles.json` `roleId`, each story's room and anchor is a pairing `roles.json` `home` allows; and the stories, seeds and row description were linted against the `bannedPhrases` patterns of `claims.json` and `extra-bans.mts` with no hit. Sections 6 and 9 name banned words on purpose, as things not to say, and are exempt.

Open items for the owner:

1. **"Fictional family. Real software." for a flat of friends.** The disclosure text is fixed (`fictional-family`) and the households in `cast-plan.json` are the four of `solo-or-couple`, `young-family`, `older-kids`, `grandparents`; there is no household kind for housemates. A flat of two or three adults maps to `solo-or-couple` at a stretch. Decide whether to add a kind, and whether the disclosure may say "household" for this persona.
2. **Which home.** The six apartments are cast with families in the bible's table and are folded in later; a Housemate household needs a slot there, and `two-bed-flat` is the closest. No member of the 30 homes has the role `housemate`.
3. **Fleet cap.** Jellyfin is already at 43 percent. Stories 7, 8 and 9 compete for one slot; the writer picks one per household and the owner decides whether Jellyfin may grow.
4. **HomeBox** needs a `reviewed.json` line and a ruling on the warranty wording; **claims.json** has no `apps[]` entry for Donetick, PairDrop or KitchenOwl.
5. **Overlap with `money-keeper`.** Spliit, Wallos and HomeBox appear in both. The split here is the lifetime of a tenancy and the shared edges; the ledger belongs to the money keeper. The `household-kind` rule allows one app of a kind per household: a flat with both personas tells one `budget`, one `chores` and one `list` beat, not two.
6. **Wiring.** The row above is a proposal. Adding a fifteenth archetype touches the schema, types, casting and lint, and the fourteen-archetype tests in `scripts/test-stories.mts` fix the number.
