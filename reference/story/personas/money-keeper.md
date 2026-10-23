# Money keeper (`money-keeper`)

Deep dive for one proposed persona, written 2026-10-20 as a draft for the owner. Category: Run the household (`household`). Nobody here is a customer: ages, households, names and lines are design choices for fictional characters. The shape follows the organiser chapter of [persona-bible.md](../persona-bible.md) and the tables of [persona-apps.md](../persona-apps.md); the contract is [personas.md](../personas.md), the wording law is `content/story/claims.json`.

**One line.** Owns the household ledger: bills, subscriptions, shared costs and the receipts behind them.

**Not the organiser.** The organiser files paperwork and runs a practice of one from a desk. The money keeper owns the numbers and the dates: what comes out, when it renews, who owes whom, where the receipt for the dishwasher is. A family can hold both; neither is the other's boss. **Not the business owner** either: Akaunting and invoices belong to people with premises, staff and books. This persona's books are the home's.

**Distinct from the neighbours in the new set.** Not the archivist (family papers kept for their history; Papra there holds heritage documents, here it holds bills, receipts and the lease). Not the collector (HomeBox there lists a physical library; here it lists what the house owns and where). Not the researcher or the community lead (Grist there holds sources or a group's tables; here it holds the household's own table). Not the housemate (who lives in a shared flat and takes part in splitting costs; the keeper is the one who runs the ledger, and a flatshare is only one of the shapes it takes). Spliit and Papra are shared pool apps across these personas, so a family casts each app once.

**Evidence key** (as in the bible). Nothing in this chapter is a statistic. Everything about how people behave is an editorial synthesis [?] of how a person who keeps a home's books tends to work; only the catalog and registry facts are checked, and the checking is listed in section 14.

---

## 1. Who

It is a Saturday in late morning and the light is on the table. Someone has made tea, pushed the fruit bowl aside and put out the month's statements, three envelopes and a phone with a calendar full of renewals. They are not an accountant and have never wanted to be. They keep the books for the home because someone has to, and they turned out to be the one who notices when a charge appears twice or a plan has quietly become a different plan. They work through the pile in the same order every month: what came out, what renews in the next four weeks, who put money in the shared pot and who is owed, and which receipt needs filing before it goes missing. It takes an hour or two. When it is done they say so, and the household carries on; most of the year nobody asks what they did.

The role has no age or gender. The cast can give it to a nineteen-year-old who runs a flatshare of three because nobody else would, to someone in their thirties who keeps a joint account with a partner, to a parent of teenagers, to a sixty-eight-year-old who has always done the household books by hand and now shares a house with a grandchild, or to the quiet sceptic of a family who trusts a number more than a tool. Households vary: a couple, a flat of friends, a family with teens or adult children, three generations under one roof, two siblings in a parent's old house. The place is any of the thirty homes' towns. What they share is the job, a mild dislike of being surprised by a renewal, and a habit of keeping paper "just in case".

## 2. What they are responsible for

- **The month.** What came out of the accounts, in categories the household recognises, and the plan for the bills still to come. They answer to the people who live there, not to a regulator.
- **The renewals.** Every plan and subscription the household still pays for, the date it renews and whether anyone still uses it. They decide nothing alone: cancelling is a conversation, and the app never cancels for anyone.
- **Shared costs.** Who bought the shopping, the broadband, the shared gift or the holiday cabin, and who owes whom. Fairness is the point; the household's peace is the stake.
- **The receipts and letters.** The receipts for things that break, the lease, the insurance letter, the contract with the energy supplier. Kept in one place, so they are to hand in the week they are needed.
- **The household's sign-ins to its bills.** The accounts the bills come from. This is the part most often shared by habit; the persona would like one place for it.
- **A tidy folder for whoever prepares the year's return**, which might be them or someone they pay. The apps keep records. They do not prepare, file or check a return, and no story says they do.

## 3. What they rent today

Named services that exist in `content/story/services.json` (no `stale` or `story-excluded` flag, `alternativeToForm` ok, `storyStatus` ok). The pairing is the catalog's own `replaces` list; a story writes "<App> is an alternative to <Service>", the second chip reads "alternative to <Service>", and the sentence never says what the company does to anyone (`incumbent-attack`).

| Registry id | Name | Category | What the household keeps there | Hub app that is an alternative |
|---|---|---|---|---|
| `ynab` | YNAB | finance | The budget and its categories | Firefly III, monetr, Wallos |
| `rocket-money` | Rocket Money | finance | The list of subscriptions and renewals | Wallos |
| `splitwise` | Splitwise | finance | Who owes whom in the flat or the family | Spliit |
| `tricount` | Tricount | finance | A trip's or a group's shared costs | Spliit |
| `evernote` | Evernote | notes | Receipts, warranty cards, scanned letters | Papra |
| `google-drive` | Google Drive | data | The lease, the insurance letter, contracts | Papra |
| `airtable` | Airtable | data | The household's own table (meters, who pays what) | Grist |
| `sortly` | Sortly | home | A list of what the house owns and where it is | HomeBox |
| `lastpass` | LastPass | identity | The sign-ins to the accounts the bills come from | VaultWarden |

Also in the registry and allowed: `1password` (VaultWarden). **Not to be named:** `mint` carries the flag `stale` in the registry although Firefly III and monetr list it in their catalog `replaces`; use `ynab` for those two apps. Typical stacks are a budgeting app plus a split-costs app plus a drive folder plus a notes app for receipts [?]; nobody here has all nine.

## 4. What the Hub offers them

Store ids and display names are the catalog's (`content/story/catalog-apps.json`, all `storySafe: "yes"`, all in the live store). The caveat column is the catalog entry's own text; a story must stay inside it. QA is the catalog's `qa` field.

| Catalog id | Display name | What it does for this person | Replaces (catalog) | Honest caveat from the catalog | QA |
|---|---|---|---|---|---|
| `firefly-iii` | Firefly III | Keeps the ledger: accounts, budgets, bills and goals, with rules that sort transactions into the household's own categories. | YNAB (Mint is stale) | Bank import through GoCardless or Spectre is an outside service; CSV import stays local. Bookkeeping tool. No financial advice and no savings promises. | screenshot |
| `wallos` | Wallos | Lists every subscription the household still pays for and reminds before each renews. | Rocket Money, YNAB | Fetches logos for popular services from outside. Do not promise savings. claims.json adds: no "cancels for you". | screenshot |
| `spliit` | Spliit | Splits shared costs among housemates or family and settles up with the fewest payments. | Splitwise, Tricount | None in the catalog. claims.json: it does not move money. | screenshot |
| `monetr` | monetr | Budgets around recurring expenses by setting money aside, on paper, for the bills coming. | YNAB (Mint is stale) | No financial advice. The catalog says nothing about bank sync, so no story shows or promises it. | screenshot |
| `papra` | Papra | Archives the receipts, warranties and contracts nobody looks at until they need one. | Evernote, Google Drive | None in the catalog. OCR of scanned PDFs is roadmap (`f-box-to-box`): never say it reads a scan. | screenshot |
| `grist` | Grist | A spreadsheet-database with Python formulas, stored as a SQLite file the household can copy. For the person who thinks in tables. | Airtable | None in the catalog. Do not call it easy; do not claim a tax, bank or accounting feature. | screenshot |
| `homebox` | HomeBox | Catalogues what the house owns, where it is and its photos. | Sortly | Barcode and Open Food Facts lookups call outside services. **No QA screenshot** on origin/main: a beat needs a line in `content/story/reviewed.json` (`app-qa-screenshot`). The catalog description mentions the warranty end date; claims.json (older) says do not say it tracks warranties until the listing is re-read. Say "what it is, where it is, a photo" until the owner rules. | no-screenshot |
| `vaultwarden` | VaultWarden | Keeps the household's sign-ins in a vault the household hosts. | LastPass, 1Password | Bitwarden-compatible server, unofficial. Say "works with the Bitwarden apps", never "Bitwarden" alone. Phone use away from home is not claimed. | screenshot |

**Fleet headroom.** Counting the 30 family files by text search on 2026-10-20 (re-count with the validator): VaultWarden is in 12 of 30 (at the 40% cap, so this persona may not add a thirteenth without the owner), Wallos 5, Firefly III 3, monetr 2, Papra 2, Grist 2, Spliit 1, HomeBox 0. Lead with Spliit, Papra, monetr, Grist and HomeBox; they have the room. Papra also relieves Paperless-ngx (15 of 30, over the cap) for any family that needs a receipt archive.

**Not offered:** investment tools (Ghostfolio, Wealthfolio) stay out; so do `actual` (claims.json lists it but it is not in the catalog snapshot, so it fails `app-unknown`) and the duplicate `fireflyiii` listing (name Firefly III once, id `firefly-iii`). Akaunting is the business owner's. Nothing in this persona's eight apps is a chat model or an agent, so the age rule 16 never binds a beat of theirs.

## 5. Where they spend time

Kinds of places, not names or numbers [?]:

- The kitchen table and the dining table, on a weekend morning. The place the work actually happens.
- Group chats of a flat, a family or a set of siblings, where the question "who paid for that?" is asked.
- Consumer-money programmes on radio and television, the money pages of a local paper, and library or council sessions on household budgeting, where those exist.
- Public-library and community-centre notice boards; tenants' and residents' associations; parent groups at a school.
- Household-budgeting newsletters and videos, and spreadsheet templates passed between friends. Many of this persona's tools began as a friend's template.
- Online forums for personal finance and for renters. The self-hosting scene is not their home: they are more likely to be the household member the tinkerer lives with. (Surveys of self-hosters describe who answers surveys, not who keeps the books.)
- Adjacent roles that are not this persona and must not be merged into it: the volunteer treasurer of a club (not a household's Core) and the person who runs a business's books (the business owner).

## 6. How they talk

Even, a little dry, exact about dates and amounts, never smug [?]. Pace 140 to 150 words a minute; sentences of 8 to 14 words, then a fragment. Warm with the people they live with, short with a renewal email. Reads the small print.

- **Owns (vocabulary).** Statement, ledger, renewal, standing order, direct debit, autopay, shared pot, settle up, receipt, "it came out twice". Regional words vary: use the home's country.
- **Humour.** Dry and domestic, about the renewal nobody remembers agreeing to.
- **Turns them off.** "Financial freedom", "wealth", "hack your money", "smart", "bank-grade", "passive income", "never worry again", "save thousands", any app screen with a graph that goes up, and being told it is easy. Also being treated as the family nag.
- **What they say about the Core.** The thing is dull on purpose: a list, a file, a folder. The Core is where the household's copy sits, not a clever trick.

Sample first-person lines are allowed only as a labelled adult quote, one per cut at most, and never praise for the product; see the seeds in section 12 for the third-person form.

## 7. Comfort with technology and attitude to AI

**Comfort 3 of 5 (range 2 to 4).** Fluent with a spreadsheet, a banking site and a CSV export; has no need of a terminal. Installs an app from a tile if the household lead has set the Core up; calls the household tech person, a flatmate, or a video. The Core is the household's: one household, one Core, no per-person isolation of memory or agents (`cap-multi-user`).

**AI stance: wary to pragmatic, and often indifferent.** The honest range runs from "I want my numbers where I can read them and no model near them" to "a model on the Core could draft the reminder, and I would read it first". Nothing in this book is a survey of this audience [?]. Pride is not the point: the person is proud of the tidy month, not of the tool. In the ten stories no AI is the hook, the first beat or required, and no member under 16 is the actor in any of them. If a family wants an optional agent beat, it is Hermes or OpenClaw preparing a reminder or a draft that the person approves; an agent never spends money, contacts a third party or cancels a service (`f-agent-autonomy`, `cap-autonomy`), and the model is private only on the Core's local model (`cap-cloud-model`). Not part of this persona's app set; not written here.

## 8. Objections and the honest limits

| They ask | The honest answer |
|---|---|
| Does it connect to my bank? | Firefly III can import through GoCardless or Spectre, which are outside services; a CSV import stays local. The other apps carry no bank statement in the catalog, so none is shown or promised. |
| Will it cancel the plan for me? | No. Wallos lists and reminds. A person cancels. Nothing is "cancelled for you". |
| Will it save us money? | Nothing says so. The apps keep records. No saving figure, no payback, no "replaces $X" (`num-savings`, `f-savings`). |
| Is this tax software? | No. Firefly III is bookkeeping and Papra is an archive. No tax, filing or advice claim, and no "tax ready". |
| Can we use it when we are out? | Remote access is not claimed (`cap-remote-access`). Set every scene on the home Wi-Fi. A flatmate who is away cannot add an expense from outside; Spliit's people are in the house. |
| Is it a backup? | No claim is made that the Core is a backup. Say where the file sits; Grist's file is one the household can copy. Do not promise it cannot be lost. |
| Is it safe? | State where the data sits, not that it is unbreakable (`sec-absolute`, `sec-never-leaves`). Installing apps uses the internet. |
| Does the phone have an app? | Mobile is closed preview (`cap-mobile-app`). Say "your phone" and the browser; no store badges. |
| Does my partner need a separate account on the Core? | One household, one Core. Per-app sign-ins exist only where the app has them. |
| Is the setup hard? | Show the steps. Never "easy" (`buzz-simple-claims`). |

What the Core and the apps cannot do for this person: pay anything, move money, read a scan automatically, sync a bank without an outside service, file a return, give advice, or reach the bill from anywhere other than the house.

## 9. Claims boundary

Never for this persona (ids are `bannedPhrases` or `forbiddenClaims` in `content/story/claims.json`):

- **Money.** No savings, payback, ROI or "cheaper" (`num-savings`, `f-savings`); no price or dollar figure (`num-dollar`, `f-prices`); no time saved ("an hour back", `num-time-saved`); no "budget app saves you money" (`f-legal-tax-fin`, `legal-claims`); no subscription count or percentage as a result.
- **Regulated domain: finance (the household's money).** No financial, tax or investment advice, no bookkeeping-as-accounting claim, no "audit-ready", "tax ready", "compliant" or "certified" (`sec-compliance`, `f-compliance`), and no guarantee of accuracy. Say only what the app does and where the files live. The catalog's own caveats ride along: "Bookkeeping tool. No financial advice and no savings promises." (Firefly III), "No financial advice." (monetr), "Do not promise savings." (Wallos).
- **Regulated adjacent domains.** A story about a household's money does not touch a child's data, a health bill or a legal dispute. Nothing about an elder's accounts (`f-medical-care`, `sec-medical`). A teen can be named in a body as the one being helped; they never keep the ledger and never appear with a balance.
- **Security.** No "private", "secure" or "safe" on their own (`personas.md` rule 3), no unbreakable, no "nothing leaves" (`sec-absolute`, `sec-never-leaves`, `sec-offline`); VaultWarden is "works with the Bitwarden apps".
- **Reach.** No "from anywhere", no tunnel, no travelling (`cap-remote-access`); no Companion mobile app (`cap-mobile-app`); no per-person isolation (`cap-multi-user`).
- **Honesty.** No testimonial, rating, user count or "real family" (`fake-social-proof`); no agent that moves money or cancels (`cap-autonomy`); "your Core, your data, no API bill" rather than "own" (`cap-own-apps`); no house id or builder name in a story's words (`internal-ids`).
- **Brand and register.** No attack sentence about a named company and no unsourced allegation (`incumbent-attack`, `f-incumbent-claims`): the beat names the Hub app first and the service in the comparative chip only. No exclamation, no em or en dash, no ease claim, no "assistant", "bot" or "home server".
- **Fear.** Do not open on a breach, a scam or a surprise charge as a threat; name the mechanism calmly (`sec-fear`).

Gaps to close before this persona ships (see open questions): claims.json `apps[]` has entries for Spliit, Wallos, HomeBox and VaultWarden only. Firefly III, monetr, Papra and Grist have none, so `mayDescribeAs` falls back to the catalog description; `fireflyiii` and `actual` have entries that do not match the catalog.

## 10. Fit: homes, rooms, furniture, casting

**Rooms** (roles.json room ids): `dining` first, because the work happens at a table; then `office`, `kitchen`, `living`. Fallbacks: `bedroom` (a desk in a bedroom is where many flatshare books are kept), `laundry` (the drawer of manuals).

**Anchor roles** (roles.json, with the room the role resolves to):

| Anchor | Resolves in | Used for |
|---|---|---|
| `dining-table` | dining, kitchen | The monthly sit-down: statements, the tea, the pile |
| `desk` | office, bedroom | The ledger or table on a screen |
| `kitchen-island` | kitchen, dining | The shared-shopping settle-up |
| `bookshelf` | living, office | The folder shelf and the receipt box |
| `fridge` | kitchen | The renewal list that used to hang on the door |
| `counter` | kitchen (universal) | Fallback; always resolves |
| `couch` | living (universal) | Fallback; always resolves |
| `laundry` | laundry, garage | The manuals drawer by the washing machine |
| `room` | any (universal; needs `anchor.room`) | Final fallback |

Every chain ends in a universal role (`counter`, `couch`, `room`, `core`, `street`, `front-door`, `garden`), as the validator requires.

**Homes.** Prefer a home with a real dining table and either an office corner or a bedroom with a desk. A kitchen island suits the settle-up; a laundry room or utility cupboard suits HomeBox. A studio flat gets a couple or two friends; a house with teens or adult children gets the keeper and an organiser or builder. Props that exist: desk, laptop, bookshelf, dining table, fridge, kitchen island, washing machine. To author if wanted: a receipt box, a wall calendar (props not in the 226 item types).

**Ages and household shapes to cast.** Adults only as the keeper (18 and over; the fleet's under-16 rules are untouched). Spread across the ages: one in their late teens or twenties (flatshare), several in their thirties to fifties (couple, family), one or two in their sixties or seventies. Shapes from `casting.json` households: `solo-or-couple`, `older-kids`, `grandparents`; `young-family` only with the keeper an adult and no child in the beat. Pair the keeper with someone who does not keep books; let the housemate be the person the settle-up is about.

**Casting warning.** Do not give this role to the mother by reflex, to the older woman who "has always done the sums", to the immigrant grandparent, to the accountant, or to the person with a disability as a "good with money" trope. Do not make the keeper the family killjoy. Do not make the sceptic the foolish one. The cast plan should hand it out so that over the fleet it is not mostly one gender, one age or one culture, and no household is shown with one person in a controlling role over another's money. The role is a job, not a trait (`persona-bible.md` §0, "Archetype versus fact"). A proposed example name, not yet cast: Padma. The cast plan decides; check `casting.json` for repeats.

## 11. Ten user stories

Each tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along and a one-line story moment. Chips for every story: the app's display name, then "alternative to <Service>".

**1. Firefly III, alternative to YNAB.** As a money keeper, I want to see a month of spending in my household's own categories so that I can talk about the month without hunting through three statements.
- App `firefly-iii`, service `ynab`. Caveat: bank import is an outside service, CSV stays local; bookkeeping, no advice, no savings promises.
- Moment: `dining`, anchor `dining-table` (fallback `desk`, `couch`). A statement is laid beside the laptop and the Saturday pile becomes one list. First: the month's file goes in.

**2. Wallos, alternative to Rocket Money.** As a money keeper, I want one list of every plan the household still pays for, with its renewal date, so that nothing renews by surprise.
- App `wallos`, service `rocket-money`. Caveat: fetches logos from outside; no savings promise, nothing cancelled for anyone.
- Moment: `kitchen`, anchor `fridge` (fallback `counter`, `couch`). The paper renewals list comes down from the fridge door. First: a reminder before a renewal date.

**3. Spliit, alternative to Splitwise.** As a money keeper, I want to split the flat's shared bills so that nobody has to ask who owes whom.
- App `spliit`, service `splitwise`. Caveat: it does not move money; the people in the group are in the house on the home network.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `dining-table`, `counter`). Three housemates, one shared shop. First: the receipts from the week are entered and the tally settles up.

**4. Spliit, alternative to Tricount.** As a money keeper, I want one place for the costs a family group shares, a cabin week included, so that the shares are divided in a way everyone agreed to.
- App `spliit`, service `tricount`. Caveat: same as story 3; only people in the home enter costs.
- Moment: `living`, anchor `couch` (fallback `room`, `counter`). A grandparent, an adult grandchild and a parent talk it through. First: the cost of the cabin week is divided and the family settles the shares.

**5. monetr, alternative to YNAB.** As a money keeper, I want to set money aside, on paper, for the bills coming up so that the rent month does not catch the household short.
- App `monetr`, service `ynab`. Caveat: no advice of any kind; no bank-sync statement in the catalog, so none is shown.
- Moment: `office`, anchor `desk` (fallback `dining-table`, `room`). A wall calendar and a laptop. First: the next three bills are set against the month.

**6. Papra, alternative to Evernote.** As a money keeper, I want the dishwasher receipt and the warranty card in one archive so that the one needed is found the week the machine breaks.
- App `papra`, service `evernote`. Caveat: Papra archives; it does not read a scan on its own; no claim about how a document is found.
- Moment: `office`, anchor `bookshelf` (fallback `desk`, `room`). The shoebox of receipts beside the folders. First: one receipt is filed and the shoebox is lighter.

**7. Papra, alternative to Google Drive.** As a money keeper, I want the lease and the insurance letter to sit in one folder on the Core so that the next renewal does not start with a search.
- App `papra`, service `google-drive`. Caveat: as story 6; no claim that a document is valid or binding, and no compliance wording.
- Moment: `living`, anchor `bookshelf` (fallback `couch`, `room`). The shelf of folders by the window. First: a letter is filed as a person puts it in the archive.

**8. Grist, alternative to Airtable.** As a money keeper, I want my household's own table, meters, shares and notes included, so that I can shape it the way my head works.
- App `grist`, service `airtable`. Caveat: a spreadsheet-database stored as a SQLite file the household can copy; not accounting, not tax; no ease claim.
- Moment: `bedroom`, anchor `desk` (fallback `dining-table`, `room`). A keeper who thinks in tables, in the quiet of the afternoon. First: a new column is added to the household table.

**9. HomeBox, alternative to Sortly.** As a money keeper, I want a list of what the house owns and where each thing is so that I know where each thing is, the washing machine and its manual drawer included, without turning the cupboard out.
- App `homebox`, service `sortly`. Caveat: barcode and Open Food Facts lookups call outside services; no QA screenshot, needs a `reviewed.json` line; do not say it tracks warranties until the owner rules.
- Moment: `laundry`, anchor `laundry` (fallback `bookshelf`, `room`). By the washing machine, the drawer of manuals. First: the machine is entered with its room and a photo.

**10. VaultWarden, alternative to LastPass.** As a money keeper, I want the sign-ins to the accounts the bills come from kept in one place the household hosts so that they are not scattered across phones and a sticky note.
- App `vaultwarden`, service `lastpass`. Caveat: unofficial Bitwarden-compatible server (say "works with the Bitwarden apps"); no security superlative; no phone use outside the home network. The fleet cap is reached (12 of 30): use only with the owner's say-so.
- Moment: `office`, anchor `desk` (fallback `dining-table`, `room`). A sticky note comes off the monitor. First: the electricity sign-in moves into the vault.

## 12. Six beat seeds

The first sentence a visitor reads. Each is 20 words or fewer, sentence case, no dash, no exclamation, no figure about money. They name what the rented service held, charged or changed and what the family's own copy does instead, and none says what a company does to anyone. Not used: "learned". There is no honest, sourced sentence about what a service learns, and the rule of `sec-fear` forbids implying it.

1. **Wallos / `rocket-money` (charged).** Three plans renewed on the same Tuesday and nobody had the dates; Wallos now lists them on the Core.
2. **Firefly III / `ynab` (held).** Years of spending sat in a budgeting app; Firefly III keeps that ledger on the Core.
3. **Spliit / `splitwise` (held).** Who owes whom in the flat lived in a split-costs app; Spliit keeps the tally on the Core.
4. **Papra / `google-drive` (held).** The lease, the dishwasher receipt and the insurance letter sat in a rented drive; Papra files them on the Core.
5. **monetr / `ynab` (held).** The household's bills were set against the month in a rented budgeting app; monetr now does it on the Core.
6. **Grist / `airtable` (held).** The household's own table sat in a rented database; Grist keeps it as a file the family can copy.

## 13. The `personas.json` row

For `content/story/personas.json` (`archetypes["money-keeper"]`). Every room is a room id in `roles.json` and the schema's `roomRole`; every anchor role is a `roleId`; every app is a catalog id with `storySafe: "yes"`. The row is the proposal only: adding the archetype also touches the schema enum, `assets/story/types.ts`, `scripts/story/build-casting.mts` and `scripts/story/cast-lint.mts`, which this draft does not do.

```json
"money-keeper": {
  "label": "Money keeper",
  "description": "Owns the household ledger: bills, subscriptions, shared costs and the receipts behind them.",
  "example": "Padma",
  "rooms": ["dining", "office", "kitchen", "living"],
  "fallbackRooms": ["bedroom", "laundry"],
  "anchorRoles": ["dining-table", "desk", "kitchen-island", "bookshelf"],
  "fallbackAnchorRoles": ["counter", "fridge", "couch", "laundry", "room"],
  "apps": ["firefly-iii", "wallos", "spliit", "monetr", "papra", "grist", "homebox", "vaultwarden"]
}
```

## 14. What was checked

On 2026-10-20, by reading the files (read-only script): all eight app ids exist in `catalog-apps.json`, are `storySafe: "yes"` and are in the live store; all nine service ids exist in `services.json` with no flag and `alternativeToForm: "ok"` (`mint` carries `stale` and is left out); each service id lists the app it is paired with in its `apps` array; every room id is in the schema's `roomRole` and every anchor role in `roles.json` `roleId`; and the seeds and stories were linted against the `bannedPhrases` patterns of `claims.json` with no hit. Open items for the owner: section 9 (claims entries missing for four apps), section 4 (HomeBox warranty wording and its QA line, VaultWarden at the cap), and whether `money-keeper` is a new archetype or a named variant of the organiser's pool.

Review pass on 2026-10-20: re-checked every app and service id, the room and anchor ids, the fleet counts (VaultWarden 12, Wallos 5, Firefly III 3, Papra 2, Paperless-ngx 15) and the banned-phrase patterns. Edits: neutral wording for the household examples, removed capability wording the listings do not support (Papra search and tags, HomeBox finding a manual, a HomeBox card), reworded beat seed 5 (it implied what a rented app does), swapped story 4 to a shared cabin week so the Tricount pairing fits, and added the distinctness note. The `personas.json` row is unchanged.
