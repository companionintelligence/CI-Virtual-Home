# Business owner (`business-owner`): ten new user stories

Draft for the owner, written 2026-10-20. Nobody here is a customer: every name, age, business and household below is a design choice for a fictional character, and the example names are not cast members yet. Read for this file: chapter 3.8 of [persona-bible.md](../persona-bible.md), the `business-owner` row of `content/story/personas.json`, the 30 family files in `content/families/` (the six apartments are not in `content/houses/` yet, so they have no family file), `catalog-apps.json` and `services.json` (both as of 2026-10-19), `claims.json` and [validator.md](../validator.md). The law for every word is `content/story/claims.json`.

**One line.** Runs a shop, workshop, studio or kitchen of one to fifteen people from the house or beside it: quotes, invoices, stock, the diary and the customer list.

**What this file adds.** No family of the 30 has a `business-owner` member yet. Sixteen families are marked as a business, and most of the businesses are desks: a design agency, a product design studio, a consultancy, a visualisation studio, an events consultancy, a translation agency, an online music school, a bookkeeping service, a plant seller, a print seller. The `business-owner` persona is the one with premises, stock and staff, and the persona's apps (Nextcloud, Paperless-ngx, Akaunting, Twenty) appear only in organisers' beats. These ten stories put the owner among things you can touch: frames leaning on dining chairs, a counter of candle jars, a bike tag on a hook, a dog groomer's wall sheet, a kitchen before a wedding. None of the ten pairs is used by any family yet, and nine of the ten apps have no beat at all in the 30 files.

---

## 1. What the chapter and the families already show

- **The chapter (3.8).** Ruth (39) and Agnieszka (42). Ranked replacements: Nextcloud, Invoice Ninja, Paperless-ngx, Docuseal, Akaunting, Twenty, AnythingLLM. Rules that bind every story below: no payroll, point of sale, card processing or bank feeds; no advice on tax or accounts and no claim about what a signed paper means; staff, clients and signers outside the home network are out, and so are web shops; one household lead, one machine; show the job and skip the pitch; never an invoice mock-up, real company names or amounts on paper, or work from the road; a model on the Core does one named chore and the owner reads it first.
- **The families.** The 16 business families (Adeniran, Adler, Banerjee, three Brennan homes, Haddad, Halvorsen, Hovsepian, Iyer, Jankowski, Mbatha, Rahimi, Salazar, Tuala, Whitaker) give the persona's apps to organisers and builders. Counted over every file: Paperless-ngx 15, Nextcloud 13, Twenty 7, LibreOffice 7, Akaunting 5, Stirling-PDF 5, BookStack 3, Docuseal 2, Invoice Ninja 1, Baikal 1, Grist 1. AnythingLLM, Solidtime and Whisper-WebUI have no beat.
- **The old places they name.** Google Drive, iCloud, Dropbox, QuickBooks, FreshBooks, Salesforce, DocuSign, Microsoft Office, Evernote, Smallpdf, Mailchimp, Wix, Airtable, Zapier.
- **What is not there.** A business of things: stock, jobs, appointments, a menu, a price list. Staff who work the same house and the same Wi-Fi. A newsletter from a shop list. A handbook for a Saturday helper.

## 2. How the ten differ

| # | App, service | Room, anchor | Moment | The business, the owner |
|---|---|---|---|---|
| US1 | Invio, QuickBooks | `dining`, `dining-table` | Thursday evening | A picture framer: Mirela (55) |
| US2 | Solidtime, Toggl Track | `dining`, `dining-table` | The last Friday of the month | An upholstery workshop with two staff: Anh (38) |
| US3 | NocoDB, Airtable | `kitchen`, `counter` | Friday evening before a Saturday market | A candle maker: Inés (34) |
| US4 | Keila, Mailchimp | `living`, `couch` | Sunday evening | A yarn shop: Lioba (49) |
| US5 | Docmost, Notion | `office`, `bookshelf` | Sunday evening after closing | A café and bookshop with three part-timers: Bartek (60) |
| US6 | Collabora Online, Google Workspace | `kitchen`, `kitchen-island` | A Tuesday morning | A sign-writing pair: Thuy (44) and her partner |
| US7 | Akaunting, Xero | `office`, `desk` | The Friday a quarter closes | A garden design firm with five staff: Saoirse (46) |
| US8 | Tandoor Recipes, Paprika | `kitchen`, `range` | The Thursday before a wedding | A small catering firm with two cooks: Carlos (41) |
| US9 | Jotty, Trello | `entry`, `room` | Monday morning | A bike repair shop: Lucho (59) |
| US10 | Radicale, Google Calendar | `office`, `desk` | Sunday evening | A dog groomer with one helper: Katya (37) |

Place fit. The kitchen, dining and office stories (US1 to US3, US5 to US8, US10) need only rooms an apartment has; US4 needs a couch and US9 a hall. When the eight offices arrive (a separate type of place), US5, US7 and US9 move there naturally; the rest are about a business that sits beside a home.

## 3. Ten user stories

Format: "As a business owner, I want <job> so that <outcome>." Each story is tied to one catalog app and one registry service, with the honest caveat, a one-line moment and the first sentence a visitor would read (20 words or fewer, sentence case, no dash, no exclamation mark; the service is named only as the old place). The chip pair is the app name, then "alternative to <Service>". Rooms and anchors are the closed sets of `schema/family.schema.json` and `roles.json`. No story here uses a chat model or an agent; staff are people who work in the house on the home Wi-Fi, or the owner types from paper.

**US1. Invio, QuickBooks.** As a business owner, I want each invoice ready to hand over with the frame, so that the customer leaves with the paper and I do not chase a link.
- Who and when: Mirela (55, runs a picture-framing workshop with two part-time staff), Thursday evening.
- App `invio`. Service `quickbooks`. Caveat: Invio's client links only work for people who can reach the Core, so each invoice is handed over on paper at the counter, never sent as a link. Invoicing only: no ledger, no card payment, no tax wording. A household keeps one invoicing app (Invoice Ninja, Akaunting, Invio).
- Moment: `dining` room, anchor `dining-table` (fallback `desk@office`). The first thing: the finished frames lean against the dining chairs with a tag each; she writes the total on the tag, then raises the invoice.
- First sentence: "The framing invoices sat in QuickBooks; Invio keeps them on the Core, ready to hand over with each frame." (19 words)
- Why it differs: a maker of things with a customer at the door; the chapter's hand-over is a link, here it is paper.
- Check: QA screenshot yes; fleet use 0.

**US2. Solidtime, Toggl Track.** As a business owner, I want each job's hours added up from the day sheets my two staff fill in, so that the quote for the next sofa starts from what the last one took.
- Who and when: Anh (38, runs an upholstery workshop with two staff), the last Friday of the month.
- App `solidtime`. Service `toggl-track`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. A time tracker only: no payroll, no tax, no advice on rates. The staff do not sign in; Anh types from their paper day sheets, because staff outside the home network are out.
- Moment: `dining` room, anchor `dining-table` (fallback `desk@office`). The first thing: the three day sheets are laid out on the table and totalled by pencil; only then does Solidtime open.
- First sentence: "The workshop's hours sat in Toggl Track; Solidtime keeps each job's time on the Core." (14 words)
- Why it differs: hours per job in a workshop, not per client in a studio; the paper sheet is the source and the Core is the copy.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US3. NocoDB, Airtable.** As a business owner, I want the stock of jars, wax and wicks in one table I can read at the counter, so that Friday night's count decides what gets poured.
- Who and when: Inés (34, makes candles and sells at two weekend markets), Friday evening before a Saturday market.
- App `nocodb`. Service `airtable`. Caveat: a spreadsheet-style database; it is not a web shop, a card reader or a point of sale, and no sales figure is claimed. The counts are typed by hand. A household keeps one database app (Grist, NocoDB, Baserow).
- Moment: `kitchen` room, anchor `counter` (fallback `kitchen-island`). The first thing: she counts the jars aloud and writes the count on a card, then types it.
- First sentence: "The candle stock sat in an Airtable base; NocoDB keeps the stock table on the Core." (16 words)
- Why it differs: stock, not a client list; the eve of a market; the kitchen counter is the shop's back room.
- Check: QA screenshot yes; fleet use 0.

**US4. Keila, Mailchimp.** As a business owner, I want the shop's monthly note written and sent from my own list, so that the people who asked to hear from us do.
- Who and when: Lioba (49, owns a yarn shop with one part-time helper), Sunday evening.
- App `keila`. Service `mailchimp`. Caveat: Keila needs an SMTP server to send, so the sending goes through the mail host she picks and the story says so; the list stays on the Core. No claim about delivery, no wording about consent rules. The catalog marks it with-caveat and notes that it overlaps Listmonk: one newsletter app per household.
- Moment: `living` room, anchor `couch` (a fallback anchor of the row). The first thing: she reads out the handwritten sign-up sheet from the counter and types the new names; then she writes the note.
- First sentence: "The shop's mailing list lived in Mailchimp; Keila keeps it on the Core and sends through her mail host." (19 words)
- Why it differs: the list is built from a paper sheet at a real counter; the story admits the outside step.
- Check: QA screenshot yes; fleet use 0 (Listmonk has one).

**US5. Docmost, Notion.** As a business owner, I want "how we open" written once, so that Saturday's helper has a page by the till and I am not the page.
- Who and when: Bartek (60, runs a café and bookshop with three part-time staff), Sunday evening after closing.
- App `docmost`. Service `notion`. Caveat: Docmost is a wiki on the Core; the staff cannot open it from their own homes, so the handbook is printed for the till. No HR, pay or employment wording. The catalog notes that it overlaps BookStack: one wiki per household.
- Moment: `office` room, anchor `bookshelf` (fallback `desk`). The first thing: he walks the shop with a clipboard at closing and writes the steps in order; then he types them.
- First sentence: "The opening checklist sat in a Notion page; Docmost keeps the shop handbook on the Core, printed for the till." (20 words)
- Why it differs: knowledge that lives in one person's head, handed to a helper on paper.
- Check: QA screenshot yes; fleet use 0.

**US6. Collabora Online, Google Workspace.** As a business owner, I want my partner and me to edit one price list together, so that a change made at the island is the change on the printed sheet.
- Who and when: Thuy (44, sign-writer) and her partner, who works the other half of the job; a Tuesday morning.
- App `collabora-online`. Service `google-workspace`. Caveat: both editors are on the home Wi-Fi and no customer or outside helper can open it; the print route is to be confirmed before shooting. A household keeps one office suite (LibreOffice, ONLYOFFICE, Collabora Online).
- Moment: `kitchen` room, anchor `kitchen-island` (a fallback anchor of the row). The first thing: the old printed price list lies on the island with three prices circled in pen; only then do they open the file.
- First sentence: "The price list sat in Google Workspace; Collabora Online lets two people edit the one file on the Core." (19 words)
- Why it differs: a pair who run the business together at one surface; the printed sheet is the end product.
- Check: QA screenshot yes; fleet use 0.

**US7. Akaunting, Xero.** As a business owner, I want the quarter's invoices and expenses on a printed page for my accountant, so that the hand-over is paper and not a sign-in.
- Who and when: Saoirse (46, runs a garden design firm with five staff), the Friday a quarter closes.
- App `akaunting`. Service `xero`. Caveat: a bookkeeping tool; no advice of any kind on accounts, tax or law, no bank feeds, no card processing. The accountant gets paper or a file, not access from outside. Akaunting already has five beats: place this where the family has no Akaunting beat.
- Moment: `office` room, anchor `desk` (fallback `bookshelf`). The first thing: the receipts envelope is tipped out and she sorts it into three piles.
- First sentence: "The firm's books sat in Xero; Akaunting keeps invoices and expenses on the Core, printed for the accountant." (17 words)
- Why it differs: the quarter-end hand-over to someone outside, told without a link; the largest firm of the ten.
- Check: QA screenshot yes; fleet use 5.

**US8. Tandoor Recipes, Paprika.** As a business owner, I want Saturday's menu and its shopping list in one place, so that the order goes in complete on Thursday.
- Who and when: Carlos (41, runs a small catering firm with two cooks), the Thursday before a wedding.
- App `tandoor`. Service `paprika`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`; it is with-caveat and overlaps Mealie, so name one per story. No allergen wording and no food-safety wording. The list is printed for the market run. The cooks work in the house and the owner types.
- Moment: `kitchen` room, anchor `range` (not in the row's anchors; fallback `kitchen-island`). The first thing: he writes the wedding's head count on the whiteboard, then opens the recipes.
- First sentence: "The wedding menu lived in Paprika on one phone; Tandoor keeps the recipes and the shopping list on the Core." (20 words)
- Why it differs: a kitchen that is a business, not a household; recipes as a product.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US9. Jotty, Trello.** As a business owner, I want every bike in the shop to have a job tag and a place on the board, so that when a customer rings I can say where it is.
- Who and when: Lucho (59, runs a bike repair shop with one apprentice), Monday morning.
- App `jotty`. Service `trello`. Caveat: Jotty is a checklist and board app; the apprentice reads the tag on the hook, not the board, because staff outside the home network are out. The tag is the truth and the board is the copy. No scheduling or dispatch.
- Moment: `entry` room, anchor `room` (fallback `bookshelf`). The first thing: he writes the job number on the tag and hangs it by the bike, then he moves the card.
- First sentence: "The repair jobs sat on a Trello board; Jotty keeps the three columns on the Core, beside the tag hooks." (20 words)
- Why it differs: physical objects with tags; the paper tag first, the board second; the hall as a workshop front.
- Check: QA screenshot yes; fleet use 0.

**US10. Radicale, Google Calendar.** As a business owner, I want the week's appointments in one diary on the Core that I read at home and copy to the wall, so that Monday's call is answered from the page.
- Who and when: Katya (37, a dog groomer with one helper), Sunday evening.
- App `radicale`. Service `google-calendar`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. Calendars and contacts only; customers cannot book themselves, they ring or message. Each device needs a calendar app. No sharing carries over. The wall sheet is paper.
- Moment: `office` room, anchor `desk` (fallback `bookshelf`). The first thing: she writes Saturday's names on the wall sheet in pencil, then enters them.
- First sentence: "The grooming diary sat in Google Calendar; Radicale keeps it on the Core, and the wall copy is still paper." (20 words)
- Why it differs: appointments with animals and not meetings; the wall sheet is first and the diary is the copy.
- Check: QA screenshot no (owner entry needed); fleet use 0.

## 4. Boundaries these stories keep

- **The chapter's limits.** No payroll, point of sale, card processing or bank feeds appear. No story says what a signed paper means, gives advice on tax or accounts, or shows an invoice with a real name or amount. No customer, supplier or signer outside the home network is part of any story, and no web shop.
- **Regulated words.** US7 (the books) and US4 (a mailing list) touch finance and personal data. They say only what the app does and where the files live. No story claims that the Core meets a rule, and none gives a safety or security promise or says anything about consent rules.
- **No model beats.** The persona's one bounded model chore is in the chapter (a late-payer reminder she reads and sends); these ten stories leave it there. The age rule of 16 never bites.
- **A role is not a reflex.** Six of the owners are women and four are men; the ages run from 34 to 60; the businesses are a workshop, a stall, a shop, a café, a kitchen, a garden firm, a grooming room and a pair of sign-writers.
- **The old places.** A service is named only as the old place and in the chip "alternative to <Service>". No sentence says what a company does, charges, learns or watches.
- **The honest caveats that ride along on every story:** installing apps uses the internet; the Core is not a backup; no price, no saving, no time saved, no speed.

## 5. Open items for the owner

- **Owner entries in `reviewed.json`** (rule `app-qa-screenshot`) are needed before a beat can use Solidtime (US2), Tandoor Recipes (US8) or Radicale (US10). The other seven apps have a QA screenshot.
- **Rooms outside the row.** The `business-owner` row lists `office`, `dining`, `living`, `kitchen` (fallback `bedroom`, `entry`). US9 uses `entry` as its main room, which is a fallback. The anchors `range` (US8) and `room` (US9) are valid role ids that the row does not list.
- **Household kinds.** Invoicing (US1, US7), newsletter (US4), wiki (US5), database (US3), calendar (US10) and office suite (US6) are kinds with one app per household. In the validator's lists Radicale is a calendar, Akaunting a budget app, Jotty a board and Tandoor Recipes a list app; Invio, NocoDB, Keila, Docmost, Collabora Online and Solidtime are in no list, so the check will not warn if a family shows a second invoicing, database, newsletter, wiki or office-suite app. Keep one of each by hand.
- **Fleet headroom.** Only Akaunting (US7) has beats already. The other nine apps have none in the 30 files.
- **Registry check, 2026-10-20.** Each of the ten pairs is listed in `services.json` (service with no flag, `alternativeToForm` ok, `storyStatus` ok, the app under its `storyApps`) and in `catalog-apps.json` (in the live store, `storySafe` yes except Keila and Tandoor Recipes which are with-caveat, none avoid, none tagged as a chat app). No pair is used by any of the 30 family files. The first sentences were checked against the error-severity banned phrases of `claims.json`.
