# Seller (`seller`)

Deep dive for one proposed persona, written 2026-10-20 as a draft for the owner. Category: Run a business (`run-a-business`). Nobody here is a customer: ages, households, crafts, names and lines are design choices for fictional characters. The shape follows the business-owner chapter of [persona-bible.md](../persona-bible.md) and the tables of [persona-apps.md](../persona-apps.md); the contract is [personas.md](../personas.md) and the wording law is `content/story/claims.json`.

**One line.** Sells what they make or find at a stall and by message, and keeps the stock, photos and invoices at home.

**Not the business owner.** The business owner runs a service firm with premises, staff, books and quotes for clients; Ruth's folder is a client folder. The seller has physical stock: a shelf of mugs, a tray of loaves, a rail of coats, a stack of prints. The paperwork follows the goods, not the other way round. **Not the creative**, who serves a client against a brief and holds a confidential archive. **Not the maker**, who keeps and gives away; the seller wraps, labels and posts. **Not the contractor**, whose work is a job at someone else's address. **Not the host**, whose logistics are the family's. A family can hold a seller and any of these; none is the seller's boss.

**Evidence key** (as in the bible). Nothing in this chapter is a statistic, and no research was done for it beyond the repository's own files. Everything about how people behave is an editorial synthesis [?] of how a person who sells small batches tends to work; only the catalog and registry facts are checked, and the checking is listed in section 14.

---

## 1. Who

It is a Sunday evening in the light of the last hour before dusk, and the stall has come home. Two crates sit by the door, the trestle table is folded against the wall, and a shoebox on the dining table holds the day: slips of paper with a name and a thing, a few messages on a phone that said "can you hold the blue one", a tray of unsold pieces. They sit down with a cup of tea and start turning the paper into rows. Nobody taught them to do this and nobody enjoys it, but the stock has to be right before Wednesday's parcels and the invoice for the café that takes a dozen each month has been waiting since Friday. They are quick with their hands and slow to forgive a tool that takes longer than the job it was meant to ease. On Saturday they were a seller; tonight they are the whole back office, and the back office is a dining table, a laptop and a shelf.

The role has no craft, age or gender. It can be a potter in a garage, a baker working from the kitchen before the market, a vintage trader whose spare room is a rail of coats, a print maker with a small press and a drawer of cards, a woodturner, a bookbinder, a seller of second-hand records or tools. They may have a day job and sell on weekends, or sell for a living, or do both by turns. Some rent a pitch at a weekend market, some a corner of a shared studio or a small office, some only sell by message to people who found them once. They are an adult, from their twenties to their seventies. They live alone, with a partner, with housemates, with teenagers who carry crates, or with a grandchild who does homework at the same table. The Core sits at home, and so does the records work; the stall is where the goods go, not where the Core is.

## 2. What they are responsible for

- **The stock.** What exists, how many of each, which shelf or crate, which is a second, which is reserved. If the list is wrong they sell the same piece twice or fail to bring the thing a regular came for.
- **The orders.** Who asked for what, by when, whether it is made, packed, collected or posted. Orders arrive as messages, slips at the stall and notes in a notebook; one list is the goal.
- **The photographs.** The pictures that sell the thing: the piece on a plain table by the window, the same piece in a hand, the stall at the market. They also double as the record of what was made in which batch.
- **The invoices.** For the trade customer who takes a regular order (a café, a shop, a gallery corner) and for the one-off buyer who wants a paper trail. They answer to the customer, and, through an accountant or a form they fill in themselves, to the tax office. This persona does not give that advice and the Core does not either.
- **The equipment and supplies.** The press, the kiln shelves, the scales, the display stands, the labels, the spare blades, the packing paper. Knowing what they have and where it is.
- **The passwords.** The accounts they use to order supplies, book pitches and list goods, which tend to be shared between a few people by habit.

## 3. What they rent today

Named services that exist in `content/story/services.json` (no flag, `alternativeToForm` ok, `storyStatus` ok). The pairing is the catalog's own `replaces` list as confirmed by each service's `apps` array. A story writes "<App> is an alternative to <Service>", the second chip reads "alternative to <Service>", and the sentence never says what the company does to anyone (`incumbent-attack`, `f-incumbent-claims`).

| Registry id | Name | Category | What the seller keeps there | Hub app that is an alternative |
|---|---|---|---|---|
| `airtable` | Airtable | data | The orders list, the market days, the catalogue of variants | Baserow |
| `sortly` | Sortly | home | What is on which shelf, and the equipment list | HomeBox |
| `quickbooks` | QuickBooks | finance | Invoices for trade customers, quotes | Invoice Ninja, Invio |
| `freshbooks` | FreshBooks | finance | Invoices for one-off buyers and small commissions | Invoice Ninja, Invio |
| `google-photos` | Google Photos | photos | The pictures of every piece and every stall | Immich, Photoview |
| `zapier` | Zapier | automation | The small steps between an order and a packing slip | Activepieces |
| `lastpass` | LastPass | identity | The passwords to suppliers, pitch booking and listing sites | VaultWarden |

A typical stack is a spreadsheet or two, a marketplace account, a payment reader, a phone full of photos, a messaging app and a notebook [?]. Nobody here has all seven. **Not replaced and not touched:** the marketplace where goods are listed, the payment reader and its provider, the courier's label tool, the messaging apps, a social media account. None of them is in the registry as something a Hub app stands in for, and the persona does not pretend otherwise. `shopify`, `squarespace` and `wix` are in the registry but their store apps need the public to reach the Core (`cap-remote-access`), so a web shop is not part of this persona.

## 4. What the Hub offers them

Store ids and display names are the catalog's (`content/story/catalog-apps.json`, all in the live store, none an `ai: "chat"` app, none `storySafe: "avoid"`). The caveat column is the catalog entry's own text, plus what `claims.json` adds. A story must stay inside it. QA is the catalog's `qa` field. "Fleet" is the count of the 30 family files in which the app is a beat's app or a `with` app, counted by a read-only script on 2026-10-20 (re-count with the validator).

| Catalog id | Display name | What it does for this person | Replaces (catalog) | Honest caveat | QA | Fleet |
|---|---|---|---|---|---|---|
| `homebox` | HomeBox | Catalogues what the seller has, where it is and a photo of it: the crates in the garage, the spare stands, the equipment. | Sortly | Barcode and Open Food Facts lookups call outside services (leave them out of the story). No QA screenshot on origin/main, so a beat needs a line in `content/story/reviewed.json` (`app-qa-screenshot`). `claims.json` (older) says do not say it tracks warranties until the listing is re-read, although the catalog description mentions the warranty end date: say "what it is, where it is, a photo". | no-screenshot | 0 |
| `baserow` | Baserow | A no-code database with tables that link: orders, stock lines, market days, variants. | Airtable | Overlaps NocoDB, Grist and Teable; one table app per household. The catalog says orders, inventory and projects; nothing about bank, payment or tax. No `claims.json` apps entry yet. | screenshot | 0 |
| `invoice-ninja` | Invoice Ninja | Invoices, quotes, expenses and time for the trade customer who orders in batches. | FreshBooks, QuickBooks | Taking card payments needs a payment provider: say invoicing, not payment processing; `claims.json`: claim no private payments. Invoicing, not a ledger, payroll or tax filing. Leave out the listing's "get paid". `storySafe: "with-caveat"`: the caveat must be on the screen text. | screenshot | 1 |
| `invio` | Invio | A light invoice for the one-off buyer, made in a few lines at the desk. | FreshBooks, QuickBooks | Client links only work for people who can reach the Core (`public-access`): a buyer outside the home cannot open one. Do not use the listing's word "secure" or "in seconds" (a time claim, `num-minutes`). One invoicing app per household: Invio or Invoice Ninja, not both. No `claims.json` apps entry yet. | screenshot | 0 |
| `photoview` | Photoview | A gallery over the photo folders already on disk, RAW files included, so the per-piece folders the seller already keeps become a catalogue. | Google Photos | Map view uses a Mapbox token you can add; leave it off. The listing also says "face grouping and share links" and "fast": leave all three out (no face-recognition claim, share links need the public to reach the Core, no performance claim). No QA screenshot, so a beat needs a `reviewed.json` line. Not a photo editor. No `claims.json` apps entry yet. | no-screenshot | 0 |
| `immich` | Immich | Backs up, organises and searches the phone's camera roll: the stall, the batch, the first firing. | Google Photos, iCloud Photos | Bundles its own database and a machine-learning service, so first start takes a while. Phone backup needs the Immich phone app on the home network; no away-from-home claim, no store badge. No face-recognition or "AI sorts your photos" claim (`claims.json`). | screenshot | 18 (over the cap) |
| `activepieces` | Activepieces | Joins two apps with a visual step: a row marked packed adds a line to the packing list. | Zapier, Make | Overlaps n8n. Web interface only for agent purposes. A step that reaches a buyer (an email, a message) would pass through that service (`cap-messaging-private`) and must be approved by a person (`cap-autonomy`): keep every story's steps inside the house. No `claims.json` apps entry yet. | screenshot | 1 |
| `vaultwarden` | VaultWarden | Keeps the seller's supplier, pitch and listing passwords in a vault the household hosts. | LastPass, 1Password | Bitwarden-compatible server, unofficial: say "works with the Bitwarden apps", never "Bitwarden" alone. No security superlative. Phone use away from home is not claimed. | screenshot | 12 (at the cap) |

**Fleet headroom.** The cap is 40 percent of homes (`FLEET.appShareMax`: 12 of 30, 14 of 36). Immich (18) is over it already and VaultWarden (12) is at it: a seller story may not add either without the owner. Lead with HomeBox, Baserow, Invio and Photoview, which are in no family today, then Invoice Ninja and Activepieces (one each). Photoview takes the load that Immich cannot. That makes three of the four strongest apps for this persona ones with no recorded QA run or no `claims.json` entry; section 14 lists what the owner must settle.

**Considered and left out of the row.** Listmonk (Mailchimp, ConvertKit): a list of buyers who asked to hear about the next market is real, but sending needs an outside mail provider and `claims.json` says do not claim a private send or promise delivery. It can be named as a `with` app once and carries the caveat. Postiz, LinkStack, Ghost, Medusa and any storefront or link page: they need the public to reach the Core (`cap-remote-access`, trap T6). Akaunting, Nextcloud, Paperless-ngx, Docuseal and Twenty belong to the business owner's pool; a family that holds a seller and a business owner can use them in the other member's beats.

**Age rule 16.** Nothing in this persona's eight apps is a chat model or an agent, so the rule never binds a seller beat. A teen can carry a crate or hold the tape in a parent-led beat, named in the body as the helper and never the actor, and never in a photograph of the stock.

## 5. Where they spend time

Editorial syntheses [?]; no figure, no named community, no quote.

- **Places.** Weekend and seasonal markets, craft fairs, car-boot and flea sales; the market organiser's pitch list and the notice board beside the stalls; a shared studio, a rented shelf in a small shop, a corner of a small office. The post office counter on a Monday, the supplier's trade counter, the café that takes a regular order. The dining table after the market. The garage or spare room on a weekday evening.
- **Communities.** Other sellers on the next pitch; the local makers' group that meets in a hall; the quiet network of people who pass on a good supplier. Online, forums and groups for one craft or one kind of find, and the seller communities of the marketplaces they use. Messages with buyers, one thread per person.
- **Media.** Tutorials on photographing a small thing in window light; a newsletter from the market organiser or a craft body; video of someone else's workshop; a podcast about running a small shop; the craft's trade magazine. They learn tools from the seller in the next pitch before they read a review.
- **Not here.** Business-school content, "side hustle" influencers and growth threads. They are wary of anyone selling them a way to sell.

## 6. How they talk

Pace 140 to 150 wpm, scripted at the 150 wpm house voice (`claims.json`); the pace is sentence length and pauses. Sentences run 6 to 12 words, fragments fine, none past 20. Practical, warm with a customer and dry about admin. A half-smile at the shoebox of slips. Open on a concrete noun: crate, batch, pitch, parcel, slip, shelf, rail, tray, order.

- **Owns:** stock, batch, run, pitch, pack down, restock, seconds, order, parcel, postage, listing, wholesale, regulars, sold out, hold it for you.
- **Eye-rolls:** scale, brand, passive income, hustle, monetise, e-commerce solution, "turn your passion into", self-hosted, container, dashboard, automation platform, anything with "AI-powered".
- **What turns them off:** setup that eats a Sunday, a screen shown before the problem, a promise of ease (`buzz-simple-claims`), a number about money (`num-savings`, `num-dollar`), a "journey". Show the steps; skip the claim that they are easy.
- **Humour:** about the spare room taken over by crates, the receipts in a biscuit tin, the thing that sold on the day it was priced for the last time. Never at a customer's expense and never about the craft.
- **Quote lane.** If a first-person line is used it is an adult's, labelled, at most one per cut and 30 words or fewer; never praise for the product (bible rule 4.1.8). This chapter invents none.

## 7. Comfort with technology and attitude to AI

**Comfort 2 of 5 (range 1 to 4).** The low end keeps a paper diary and a phone camera and lets a partner or a teenager type it up. The middle works a spreadsheet, a marketplace and a messaging app confidently and has never opened a settings file. The high end automates the labels. All of them judge a tool by whether it is faster than the notebook it replaces, and impatience with setup is the common trait: a hidden wizard is suspicious, a long form is the end of the evening. They can follow the Core's own onboarding and install an app from the Companion Hub store, which uses the internet (`internet-steps`). They call a partner, a friend at the next pitch or the maker's group when it breaks.

**Attitude to AI.** An honest range, not an answer.

- **Wary.** Customers buy the person and the thing. Text in their voice that a machine wrote, or an image of a piece that was never made, reads to them as a small lie to a regular. A familiar stance for a maker-seller [?].
- **Curious.** Would let a model draft a polite reply about postage from their own notes, if they read it first and sent it themselves. Has not tried it.
- **Quietly using a hosted model already** for a product description, and not proud of it. The Core's value to them is a model they can switch off.
- **Not interested, and right.** None of the ten stories needs a model, and the persona's row has no chat app. The seller is the persona the fleet should not push AI at.

The rule if a model appears anywhere near a seller: one bounded chore on their own notes by a model on the Core (`cap-parity`: no parity with a hosted model, no speed), the seller reads the result and sends it, and the message passes through the messaging service they chose (`cap-messaging-private`). No generative image of a piece, ever: the picture is of the thing made.

## 8. Objections and the honest limits

Objections, in their own words as design [?], not quotes:

- "I am at the stall all weekend. Is it with me?" No. The Core stays at home and remote access is not claimed (`cap-remote-access`). What happens at the stall goes on paper or in the phone's camera and comes home to be entered; that is the beat that opens the persona.
- "Does it take payments?" No. Invoicing is not payment processing. The payment reader and its provider stay where they are.
- "I already pay for the thing I list on." The listing site and the marketplace do not move. This persona is the back office.
- "What about my accountant?" The Core gives no tax or accounting advice (`legal-claims`, `f-legal-tax-fin`) and no app here is a ledger.
- "Can my stall helper use it?" Per-app sign-ins exist only where the app has them; the Core is one household's, with no separate account, space or memory per person (`cap-multi-user`). Nothing here promises access from outside the house.
- "What if the drive fails?" The story makes no promise about backups or about what survives a failed drive, and the Core is not described as safe. Say only where the files live.

The limits, said once and said plainly:

- Home network only. No selling from the stall, no invoice link a buyer opens outside the house (Invio's `public-access` caveat), no staff or customers signing in from elsewhere.
- No public storefront, no booking page, no shop (trap T6).
- No card processing, payroll, point of sale or bank feeds; no tax, accounting or legal advice; never "tax ready".
- No sales figure, no revenue, no price, no "saves hours". The persona is a person with stock, not a dashboard.
- HomeBox and Photoview have no recorded QA run and no `claims.json` entry; Baserow, Invio and Activepieces have no `claims.json` entry. They are fit to use only after the owner lists them (section 14).
- Installing an app uses the internet.

## 9. Claims boundary

What must never be said for this persona, with the `claims.json` ids that stop it. The validator's own patterns decide; this list is what writers should not reach for.

| Never say or imply | Ids |
|---|---|
| Any price, fee, sales figure, revenue, margin, what an invoice is worth, "saves money", "pays for itself", a month or a percentage of cost | `f-prices`, `f-savings`, `num-dollar`, `num-savings` |
| Time saved on admin, an hours figure, "in minutes", "in five minutes" | `num-time-saved`, `f-duration`, `num-minutes` |
| Tax ready, tax advice, deductible, VAT or sales tax handled, "your accountant can", a legal or accounting statement, "legally valid" about any invoice | `legal-claims`, `f-legal-tax-fin` |
| Compliant, certified, audited, covered by any rule; anything about food hygiene, allergens, labelling, product safety, electrical safety or children's product rules for the goods. A baker, candle maker, jeweller or toy maker may exist, but nothing in the story speaks to ingredients, labels, safety or testing | `sec-compliance`, `f-compliance`; regulated-domain rule (below) |
| A child's name, face or data in the stock photographs, a child in the listing; a child as a seller or as the actor in any business beat | `f-surveillance`; regulated-domain rule; age rule 16 |
| Selling or invoicing from the stall, the van, the road or a holiday; "from anywhere", a public link, a buyer opening an invoice; a store front, booking page or newsletter signup page the public can reach | `f-remote-access`, `cap-remote-access`, trap T6 |
| Card payments, "get paid", payment processing, bank feeds, a ledger, payroll, point of sale | `claims.json` Invoice Ninja caveat; `f-box-to-box`; business-owner honest edges |
| "Private", "secure", "safe", "locked", "encrypted", "nothing leaves", "offline", "unhackable", "bank-grade" about the stock list, photos, invoices or passwords | `sec-absolute`, `f-security-guarantee`, `sec-never-leaves`, `sec-offline`; say "sits on the Core" |
| Separate accounts, spaces or memory for helpers, partners or staff; "multi-user"; "enterprise"; single sign-on | `f-multi-user`, `cap-multi-user` |
| An automation that emails, messages, books or pays a buyer by itself; an agent that does it for the seller | `f-agent-autonomy`, `cap-autonomy`, `cap-messaging-private` |
| What a named company does to the seller: holds back, locks in, sells, mines, changes terms. The pair is only "<App> is an alternative to <Service>" | `incumbent-attack`, `f-incumbent-claims` |
| A real seller, shop or market; a testimonial, a review, a count of sellers or orders; a person presented as a customer | `f-testimonial`, `fake-social-proof`, `f-real-person` |
| A generative image of a piece, an AI-written listing, "AI-powered", "assistant", a parity or speed claim | `buzz-ai-powered`, `vocab-assistant`, `cap-parity`, `f-parity` |
| "Easy", "simple", "plug and play", "effortless", "seamless", "unlimited", "game-changer" | `buzz-simple-claims`, `buzz-core`, `buzz-unlimited` |
| "Home server", "NAS", "box" (for anything but the Core), "app store", "log in" | `vocab-home-server`, `vocab-box`, `vocab-app-store`, `vocab-log-in` |
| An em or en dash, a spaced hyphen, an exclamation mark, an emoji, an ellipsis | `dash-em-en`, `dash-spaced-hyphen`, `exclamation`, `emoji`, `ellipsis-hype` |

**Regulated-domain rule.** Health, legal, finance, children's data and education records are written without any compliance, certification, safety or security-guarantee claim and without advice. For the seller this bites in three places. **Food, cosmetics, candles, toys, electricals and anything worn or swallowed** may be someone's stock: the story names the thing, never the rules around it. **Money** is a record of an invoice, not a statement of what is owed to a tax office. **Children** are not in the pictures of stock or stall and do not appear as sellers; a young relative can be named in a parent-led beat as the one carrying a crate.

"Fictional family. Real software." sits where a family is, and the Core is always drawn stylised. Every page that carries a seller beat sends a visitor to exactly `https://ci.computer/core` for "See Companion Core".

## 10. Fit: homes, rooms, furniture, casting

**Rooms** (`roles.json` room ids, also the schema's `roomRole`): `dining` (the pack-up table), `office` (the desk, a craft room), `garage` (the workshop or stock room; the cast's `garage` room covers `garage` and `workshop` kinds), `kitchen` (a baker's counter). Fallbacks: `living` (the couch and the camera roll), `bedroom` (a rail of stock, a desk), `entry` (parcels by the door). The fallbacks count only when the house has none of the preferred rooms.

**Anchor roles** (`roles.json`, with the room each resolves to):

| Anchor | Resolves in | Used for |
|---|---|---|
| `dining-table` | dining, kitchen | The Sunday sit-down; the pack-up table; a trestle table when the house has one (`trestle-table` is in this role's type list) |
| `desk` | office, bedroom | The laptop: invoices, orders, the table app |
| `bookshelf` | living, office | The shelves of stock and folders (`open-shelving`, `ladder-shelf`) |
| `room` | any; needs `anchor.room` | The garage stock room and workbench: there is no workbench role, so set `room` to the garage, as the contractor does |
| `counter` | kitchen (universal) | Fallback; a baker's pass |
| `kitchen-island` | kitchen, dining | Fallback |
| `couch` | living (universal) | Fallback; the camera roll after the market |

Every chain ends in a universal role (`counter`, `couch`, `room`, `core`, `street`, `front-door`, `garden`). The front door (builtin, always resolves) is a good last moment for a parcel leaving.

**Homes** (crew-only ids; print display names, never the id on a public surface, `internal-ids`). The cast files show these houses with a garage and a dining table: `asymmetry` (four dining tables, a garage), `neweco` (three dining tables, a garage), `familyhouse-nora` (a craft room and a garage), `riverbend`, `cocoon`, `bghouse-olcia`, `mesamariposa`, `palnknoll`, `flowerycottage`, `epiphany`. Without a garage, the strong fits are `sunnyhome` and `mirage` (shelves and two dining tables) and `seraphine`, `aurora`, `bgfamily` (an office and shelves). The six apartments have a dining table and a shelf; a seller there keeps stock in a bedroom corner and works at the table (use the `bedroom` fallback), so the garage beats do not travel. Avoid a house whose only workshop is the Core's room; the persona's stock should not share a shelf with the Core.

**Props.** Available in the item list: workbench, trestle-table, open-shelving, ladder-shelf, desk, laptop, printer, cabinet, storage. To author if wanted: crates, a roll of packing paper, parcel boxes, display stands, a stack of cards, a window-light table for photographing a piece. No van, no stall frame, no card reader. No price tag may be legible. No app screen is readable.

**Ages and household shapes to cast.** Adults, 18 and over: aim at one in their twenties, several in their thirties to fifties, one or two in their sixties or seventies. Shapes from `casting.json` households: `solo-or-couple`, `older-kids` (a teen who helps in the body of a parent-led beat), `grandparents`, and `young-family` only with the seller an adult and no child in the beat. Pair the seller with a member who does not sell: a builder who laughs at the shoebox, a learner at the other end of the table, a host who makes the tea.

**Casting warning.** Do not give this role to the woman who "has a craft hobby that got out of hand", to the retired grandmother with knitting, to the young man flipping trainers, to the immigrant family with a market stall, to the stay-at-home parent as a pin-money cliché, or to a person with a disability as an inspiration story. Do not assign the craft by the character's gender, age or culture: draw the craft from the list in section 1 and rotate it so that over the fleet the potter is not always a woman or the woodturner always a man. A role is a job, not a trait (`persona-bible.md` section 0). Do not make the seller the family's money worrier or its failed entrepreneur. A proposed example name, not yet cast: Wren (unisex; `casting.json` has no member of that name, only the place Wrenfield). The cast plan decides; check `casting.json` for repeats and the avoid list in the bible (4.1 rule 12).

**Cast-lint note.** `scripts/story/cast-lint.mts` holds `BUSINESS_LEADS` to organiser, builder and business-owner: a family that is a business needs one of them. A seller alone does not satisfy it, so a seller's family also carries one, or the owner decides to add `seller` to the set. `JOBS` (a couple needs an adult who does one) should include `seller`. See section 14.

## 11. Ten user stories

Each tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along and a one-line story moment. Chips for every story: the app's display name, then "alternative to <Service>". "As a seller" is the persona, no name.

**1. HomeBox, alternative to Sortly.** As a seller, I want to know which crate holds which pieces so that I bring the right ones to the pitch.
- App `homebox`, service `sortly`. Caveat: barcode and Open Food Facts lookups call outside services (leave out); no QA screenshot, needs a `reviewed.json` line; say what it is, where it is, a photo, never warranties.
- Moment: `garage`, anchor `room` (room garage; fallback `bookshelf`, `couch`). The crates on the open shelves. First: a crate gets a card with its shelf and a photo.

**2. Baserow, alternative to Airtable.** As a seller, I want every order in one table so that nothing promised at the stall is forgotten.
- App `baserow`, service `airtable`. Caveat: overlaps NocoDB, Grist and Teable; one table app per household; no claims entry yet.
- Moment: `dining`, anchor `dining-table` (fallback `desk`, `counter`, `couch`). The shoebox of slips beside the laptop. First: the first slip becomes a row with a name, a thing and a date.

**3. Invoice Ninja, alternative to QuickBooks.** As a seller, I want a quote and an invoice for the café that orders a dozen a month so that each batch has a paper trail.
- App `invoice-ninja`, service `quickbooks`. Caveat: invoicing, not payment processing; not a ledger or tax filing; `with-caveat` text on screen.
- Moment: `office`, anchor `desk` (fallback `dining-table`, `room`, `couch`). A printed invoice sits beside the batch list. First: last month's invoice is copied for the new batch.

**4. Invio, alternative to FreshBooks.** As a seller, I want a one-page invoice for a buyer who asked for a receipt so that I do not write it by hand after a market.
- App `invio`, service `freshbooks`. Caveat: client links only work for people who can reach the Core; the invoice goes to the buyer the way the seller already sends things (a printout or their own mail, a choice the Core makes no claim about); do not say "secure"; no claims entry yet.
- Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`, `dining-table`, `couch`). A baker's counter in the evening. First: a few lines make the invoice for a birthday order.

**5. Photoview, alternative to Google Photos.** As a seller, I want the picture of each finished piece to sit in a folder by its name so that I find the right picture when a buyer asks.
- App `photoview`, service `google-photos`. Caveat: Mapbox map view stays off; no face grouping, share links or "fast"; no QA screenshot, needs a `reviewed.json` line; a gallery, not an editor; no claims entry yet.
- Moment: `office`, anchor `desk` (fallback `bookshelf`, `room`, `couch`). A plain table by the window with a piece on it. First: the afternoon's pictures are in the right folder.

**6. Immich, alternative to Google Photos.** As a seller, I want the stall pictures from my phone to land on the Core so that I can see how last season's stall looked before I set up this one.
- App `immich`, service `google-photos`. Caveat: first start takes a while; phone backup needs the Immich phone app on the home network and nothing away from home; no face-recognition or "AI sorts" claim. Over the fleet cap: use only where the owner allows it.
- Moment: `living`, anchor `couch` (fallback `room`, `counter`). The phone on the arm of the couch after the market. First: the day's photos arrive on the Core.

**7. Activepieces, alternative to Zapier.** As a seller, I want a row marked packed to add a line to the week's packing list so that I do not copy it by hand.
- App `activepieces`, service `zapier`. Caveat: overlaps n8n; the step stays inside the house; nothing is sent to a buyer; no claims entry yet.
- Moment: `office`, anchor `desk` (fallback `dining-table`, `room`, `couch`). Two tabs on the laptop. First: the packed order appears on the list.

**8. VaultWarden, alternative to LastPass.** As a seller, I want the passwords for my supplier, the pitch booking page and the listing site kept in one vault so that I stop keeping them on a sticky note.
- App `vaultwarden`, service `lastpass`. Caveat: unofficial Bitwarden-compatible server (say "works with the Bitwarden apps"); no security superlative; no phone use away from home. At the fleet cap (12 of 30): use only with the owner's say-so.
- Moment: `office`, anchor `bookshelf` (fallback `desk`, `room`, `couch`). A sticky note by the shelf of folders. First: the supplier password moves off the note.

**9. HomeBox, alternative to Sortly.** As a seller, I want a list of the equipment and supplies I own and where each sits so that I can find the spare blades and the display stands on the morning of a market.
- App `homebox`, service `sortly`. Caveat: as story 1; do not promise warranty tracking; a family uses story 1 or 9, not both as a pair of beats about the same shelf.
- Moment: `garage`, anchor `room` (room garage; fallback `bookshelf`, `couch`). The display stands stacked by the workbench. First: the stands get a card and a photo.

**10. Baserow, alternative to Airtable.** As a seller, I want a list of which market, which pitch and what to bring so that I load the right crates.
- App `baserow`, service `airtable`. Caveat: as story 2; no figure of any kind in the table the story shows.
- Moment: `dining`, anchor `dining-table` (fallback `desk`, `counter`, `couch`). The market organiser's paper pitch list beside the laptop. First: next Saturday's pitch gets a row with its bring list.

## 12. Six beat seeds

The first sentence a visitor reads. Each is 25 words or fewer, sentence case, no dash, no exclamation, no figure about money. They name what the rented service held or charged or what a rented tool can change, and what the family's own copy does instead; none says what a company does to anyone. Not used: "learned". There is no honest, sourced sentence about what a service learns, and `sec-fear` forbids implying it. The events are story events, not facts about a company.

1. **HomeBox / `sortly` (held).** Every crate and what was in it sat in a rented stock list; HomeBox now keeps the list on the Core, shelf by shelf.
2. **Baserow / `airtable` (held).** Last season's orders lived in a rented table; this season's sit in Baserow on the Core, where the shoebox slips end up.
3. **Invoice Ninja / `quickbooks` (charged).** Quotes and invoices sat in a rented plan; Invoice Ninja keeps the same quotes and invoices on the Core.
4. **Invio / `freshbooks` (changed).** A rented invoicing tool can change under you; Invio keeps each invoice as it was made, on the Core.
5. **Photoview / `google-photos` (held).** Pictures of every piece sat in a rented photo library; Photoview shows the same folders from the Core.
6. **Activepieces / `zapier` (charged).** The week the stall was busiest, the automations reached the limit of their plan; Activepieces runs the same steps on the Core.

## 13. The `personas.json` row

For `content/story/personas.json` (`archetypes.seller`). Every room is a room id in `roles.json` and the schema's `roomRole`; every anchor role is a `roleId` in `assets/story/types.ts`; every app is a catalog id with `storySafe` of "yes" or "with-caveat" (Invoice Ninja). The row is the proposal only: adding the archetype also touches the schema enum, `ARCHETYPES` in `assets/story/types.ts` (a test keeps the three equal), `scripts/story/build-casting.mts`, `scripts/story/cast-lint.mts` (the `POOLS`, `JOBS` and `BUSINESS_LEADS` sets), the archetype table in `personas.md`, `persona-apps.md` and `PERSONAS` in `scripts/portal-front.mts`. None of that is done here.

```json
"seller": {
  "label": "Seller",
  "description": "Sells what they make or find at a stall and by message, and keeps the stock, photos and invoices at home.",
  "example": "Wren",
  "rooms": ["dining", "office", "garage", "kitchen"],
  "fallbackRooms": ["living", "bedroom", "entry"],
  "anchorRoles": ["dining-table", "desk", "bookshelf", "room"],
  "fallbackAnchorRoles": ["counter", "kitchen-island", "couch"],
  "apps": ["baserow", "homebox", "invoice-ninja", "invio", "photoview", "immich", "activepieces", "vaultwarden"]
}
```

## 14. What was checked

On 2026-10-20, by a read-only script (`verify-seller.mts`, in the session scratchpad, not in the repository), against the files in this worktree: all eight app ids exist in `catalog-apps.json`, are in the live store, are not `storySafe: "avoid"` and carry no `ai` tag; all seven service ids exist in `services.json` with no flag, `alternativeToForm` ok and `storyStatus` ok; each of the ten story pairs is in both the service's `storyApps` and the app's catalog `replaces` list; every room is in the schema's `roomRole` and in `roles.json` `rooms`; every anchor role is in `ROLE_IDS`; and the fleet counts in section 4 were read from the 30 family files. The seeds and stories were linted against the `bannedPhrases` patterns of `claims.json` (the dash, exclamation, buzzword, vocabulary and number patterns) with no hit in sections 11 and 12.

**Open items for the owner.**

1. **Claims entries.** `claims.json` has no `apps` entry for Baserow, Invio, Photoview or Activepieces, and the Invoice Ninja, HomeBox and VaultWarden entries carry the caveats in section 4. Writers need `mayDescribeAs` lines for the four before any seller beat ships.
2. **QA lines.** HomeBox and Photoview have no recorded QA screenshot: each beat needs a line in `content/story/reviewed.json`.
3. **HomeBox warranty wording.** The catalog description mentions the warranty end date and `claims.json` says not to. This chapter says "what it is, where it is, a photo" until the owner rules.
4. **Fleet cap.** Immich (18 of 30) and VaultWarden (12 of 30) leave this persona no room. Stories 6 and 8 need the owner's say-so, or are held back.
5. **Business lead.** `BUSINESS_LEADS` in `cast-lint.mts` does not include `seller`; decide whether a seller can be a family's business lead.
6. **New archetype or named variant.** Whether `seller` is a fifteenth archetype or a named variant of `business-owner`'s pool, which would avoid the schema, types and casting changes. The persona is different enough in rooms and stock to earn its own row, and the rooms and anchors differ from the business owner's.
7. **Stall helper.** If a family wants a partner or a teenager to help at the stall, the wording must stay inside `cap-multi-user` and age rule 16.
