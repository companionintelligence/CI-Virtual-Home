# Shots and Scripts Playbook

Fourteen personas, 86 bakeable shots, 70 scripts and 36 casting notes, written read-only on 2026-10-19 for Companion Intelligence from `persona-bible.md` and the engine's own references. Data twin: `shots-and-scripts-playbook.json`. Checker: `lint-playbook.mjs`.

**Contents.** 0 How to use. 1 Engine vocabulary. 2 Global grammar: 2.1 hooks, 2.2 the Core, 2.3 bring your data home, 2.4 rented before, 2.5 cards and type, 2.6 disclosure, 2.7 daylight, 2.8 lint. 3 The fourteen playbooks: 3.1 Organiser, 3.2 Builder, 3.3 Gamer, 3.4 Learner, 3.5 Maker, 3.6 Host, 3.7 Tech Family, 3.8 Business Owner, 3.9 Creative, 3.10 Contractor, 3.11 Marketer, 3.12 Lawyer, 3.13 Journalist, 3.14 Educator. 4 Casting notes for the 36 homes. 5 Open items. Appendix: cited URLs.

## 0. How to use this playbook

**Who reads what.** Cinematographers: sections 1, 2.1 to 2.4, each persona's Shots, and 4. Writers: 2.5 to 2.8 and each persona's Hooks, AI and Scripts. Everyone: section 5.

**A shot is a beat you can bake:** the room, an anchor chain, soft camera hints, the prop it dwells on, the card, why it is there and what its popup never shows. No coordinates; `story:bake` finds the eye. In the schema the first anchor is the beat's `anchor` and the rest are its `fallback` list (three at most).

**One source of words.** The card body is the narration and the caption. Every script line is a whole sentence lifted from the start of a card body, so a cut and the live tour agree; the checker enforces it. A body is three short sentences: the chore with the app named, where it sits, the limit or payoff. The first sentence is the 15 second caption.

**Names.** Cards carry the lead name. Swap it for the cast member's; bodies never use he, she, his or her for the lead, so the swap is safe for pronouns. It is not enough for the uniqueness gate: every beat title and body must differ across the fleet (section 4).

**Evidence.** [V] verified in a page read; [S] secondary; [?] inference. The persona bible's Appendix A carries the tags, URLs and the read date (2026-10-19); this playbook re-checked only that each cited URL answers: 58 of 62 answer 200, 2 refuse a bot check (403) and 2 gave no answer from this machine (appendix). On a hook line the tag is the venue's (it exists and answers); the tone words in brackets are [?], an editorial reading, and no hook formula has been tested on an audience. A skeptic pass on 2026-10-19 re-read 62 of the bible's factual claims, checked every app against the live store, every anchor chain against the 36 house specs and the timing against the engine's own arithmetic; its changes are in `skeptic.md`. Nobody here is a customer: archetypes in scripted scenes.

**Engine fact, house rule, playbook field.** Section 1 is read from the engine. Rules marked [house] come from the bible's twelve rules for cinematographers (its 4.3). `beatType`, `dwell`, `why`, `never` and `altCategory` are this playbook's fields and are not in `family.schema.json`.

**Shorthand.** `role@room#nth` is an anchor; camera is `framing/side/from/eye`, `-` for no hint; "(to author)" marks a prop the item library lacks (request it, never composite it). A kicker such as SALLY is capitals drawn over the string "Sally".

## 1. The engine's vocabulary on one page

Read from the CI-Virtual-Home working tree on 2026-10-19 (it held uncommitted edits; re-read before a shoot): `bake.md`, `film.md`, `ads.md`, `player.md`, `validator.md`, `roles.json`, `family.schema.json`, `claims.json`, `poses.ts`.

**Anchor roles (27).** street, front-door, core, room, couch, tv, fireplace, bookshelf, fridge, range, kitchen-island, counter, dining-table, desk, bed, crib, toys, music, laundry, bicycle, easel, telescope, patio-seat, garden, driveway, pool, deck. Universal in all 36 homes (couch, counter and garden checked against the 36 house specs on 2026-10-19): street, front-door, core, room, couch, counter, garden. `room` needs `anchor.room` and a room of that role in the house, read off the room names: 19 of the 36 homes have no room named like a kids' room and 9 none like an office, so a `room@kids` or `room@office` tail can fail; the kids chains now end in `room@bedroom`. A role outside the seven must end its chain in one of them.

**Room roles (13).** entry, living, kitchen, dining, office, bedroom, kids, garage, laundry, bath, garden, patio, street. There is no workbench role: a garage bench is `room@garage`. A "Shop" in the apartment buildings has no program and no items: it is scenery.

**Camera.** framing wide, medium, close. from front, left, right, behind, above. side left, right, auto (the third of the frame the subject takes; the card takes the other). eye standing (1.5 m), seated (1.1 m), low (0.75 m, desk and bench height), aerial (+6.2 m). A card stays under 2% off the subject.

**Card limits.** Title six words, no digits. Body thirty words, sentences twenty or fewer, no digits, a full stop at the end. Chips: the catalog name, then `replaces <X>` from the app's own list; three at most, 28 characters each. Note 90 characters. No script here uses a `say` line. Aim for a body of 26 words or fewer, so it sets in the 36 px canvas type [?].

**Quotas.** A business family needs five small-business beats and at most 45%; any other family at most two (`validator.md`, rule `segment`). `altCategory` is this playbook's field: on a household that is not a business family, a small-business shot past the second takes its `altCategory` as `category` and `consumer` as `segment`. The family-level rules (couch, TV, garden and kitchen beats, eight of eleven categories, the first-run chapter) still bind a generator; this playbook supplies member beats only.

**Cut anatomy.** 2 s hook (the title, the name kicker above it); each beat at rest with card and caption strip; 0.35 s dips; a 3.5 s end card. `story:ads` floors a cut at 15 s and caps it at 25 s. Its arithmetic (`plan.ts`, `lay()`): for each beat a lead (2.0 s before the first, 0.6 s before every later one), the caption at 2.5 words a second, a 0.8 s tail and a 0.35 s dip, the last dip falling before the end card; then 3.5 s, rounded up to a frame at 30 fps. A cut under 15 s first holds its tails (to 1.4 s) and its end card (to 4 s). The seconds printed with each script are that figure. The 30 and 60 second slots sit past the 25 s cap: they need the cap raised or a hand edit (section 5). A first version of this playbook left out the 0.6 s leads and the last dip and printed about 1 to 4 s too little.

## 2. Global grammar

### 2.1 Opening hook shots

The hook is the title of a member's first flagged room beat, set big for two seconds over the room the camera is about to settle on.

- **Persona noun first.** Open on what the persona handles: an invoice, a repository, a quote, a recipe tin. Never "Meet X". Six words or fewer, third person.
- **Four shapes.** The pile (org-1, bo-3, edu-1). The question as a noun phrase (law-1, cre-1, mkt-1). The limit first (gmr-6, edu-6). The ordinary object (tf-3, hst-2, con-2).
- **Hands and objects.** Waist or bench height, a prop in window light, no readable screen; people are monogram discs, backs and hands.
- **Never AI.** The hook and the first beat of any script are not the AI chore.
- **Match the feed.** Each persona lists three hook formulas with the feed they suit. They are an editorial reading of the bible's hangout notes [?]: test them. The bracketed tag on each line is the venue's (it exists and answers on 2026-10-19); the tone words are [?].

### 2.2 The Core beat

The Core appears once per cut, on a shelf or desk, stylised, never a hero and never a render that could pass for a photograph. Pair a wide of desk and Core with a close of hands before it. The card carries where it sits, one limit. Placement: between two binders (lawyer), by the router on the hall shelf (tech family), on a garage shelf (contractor), over the desk (builder), by the door (learner), with the drives (creative), in daylight (journalist). No emissive LED, glow, padlock or shield.

**Pace [house].** Slow moves, and a three to four second hold on the prop before the card. The baked walk is 1.5 m/s indoors (`track.ts`) and the eye rests on a beat, so a slow shot comes from anchors close together, not from a setting [?].

### 2.3 The "bring your data home" beat

A migration is three beats and no interface: the export (a hand and the old thing leaving its place), the import (the Core's shelf and one honest sentence), the day it works (a find, a lamp, a quote). Ads may not fake app screens (ADS.md 9.1), so no screen appears.

1. **Export.** Frame the pile the old service stood in for, from above or at bench height: a shoebox of receipts, stacked notebooks, a wall of prints. The caption says what leaves in plain words.
2. **Import.** Cut to the Core, anchor `core`, close or medium, held. The card names the app, what carried over and what did not. No progress bar, status light or dialog. A migration card says nothing about how long or how easy it was.
3. **The day it works.** The next shot in the room is the payoff as an action: a hand finding the page, the lamp coming on. Order the set export, import, chore.

Caption pattern: "<Person> exports <thing> as one file." Then "<App> takes it in on the Core." Then what carried over and what did not. Then "<Thing> comes up from one word."

Eleven of the fourteen paths below are rows of the bring-home map (`w8/bring-home.json`): the vendor's help page for the export and the importer's docs for the import, read 2026-10-18; the appendix gives each address's status on 2026-10-19. The Notion to Obsidian path (lrn-4, mkr-4) is not a map row (the map sends Notion to Docmost): it is the bible's research, and the Obsidian help site renders by script and could not be machine-read. The Figma to Penpot path (cre-3) has no importer. What carries over comes from those pages; none was run.

- **org-4** LastPass to VaultWarden: carries logins, notes and form data; not attachments or one-time-code seeds. https://support.lastpass.com/s/document-item?language=en_US&bundleId=lastpass&topicId=LastPass%2Fexport-generic-csv.html&_LANG=enus https://bitwarden.com/help/import-from-lastpass/
- **bld-4** GitHub to Gitea: carries code and history, and issues with a token; not Actions workflows. https://docs.github.com/en/get-started/archiving-your-github-personal-account-and-public-repositories/requesting-an-archive-of-your-personal-accounts-data https://docs.gitea.com/usage/repository/migration/
- **gmr-5** Google Photos to Immich: carries photos and videos with dates and GPS, and named albums; not untitled albums or sharing. https://support.google.com/photos/answer/3024190 https://github.com/simulot/immich-go
- **lrn-4** Notion to Obsidian: carries page text; not comments, history or live databases. https://www.notion.com/help/export-your-content https://obsidian.md/help/import
- **mkr-4** Notion to Obsidian: same path as lrn-4.
- **hst-6** Google Calendar to Radicale: carries events, times and recurrence; not sharing or Meet links. https://support.google.com/calendar/answer/37111 https://radicale.org/v3.html
- **tf-5** Plex to Jellyfin: carries the media files; not watched flags, ratings or collections. https://support.plex.tv/articles/201154527-move-viewstate-ratings-from-one-install-to-another/ https://jellyfin.org/docs/general/server/libraries/
- **bo-6** QuickBooks to Invoice Ninja: carries customers and invoices; not the ledger, payroll or bank feeds. https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US https://invoiceninja.github.io/docs/advanced-topics/import-and-export
- **cre-3** Figma to Penpot: carries nothing automatically; frames export as SVG or PNG and are rebuilt. https://help.penpot.app/
- **con-6** QuickBooks to Invoice Ninja: same path as bo-6.
- **mkt-6** Mailchimp to Ghost: carries subscribers; not campaigns, automations or sending reputation. https://mailchimp.com/help/view-export-contacts/ https://ghost.org/docs/migration/mailchimp/
- **law-3** Dropbox to Nextcloud: carries files and folders; not share links or version history. https://help.dropbox.com/sync/download-entire-folders https://github.com/nextcloud/integration_dropbox
- **jou-5** Raindrop.io to Linkwarden: carries bookmarks and folders as collections; not saved page copies. https://help.raindrop.io/export https://docs.linkwarden.app/usage/import-and-export
- **edu-5** Evernote to Joplin Server: carries notebooks, notes, tags and attachments; not text-recognition data or fonts. https://help.evernote.com/hc/en-us/articles/209005557-Export-notes-and-notebooks-as-ENEX-or-HTML https://joplinapp.org/help/apps/import_export

### 2.4 "Rented before, on the Core now"

Each chip row is one ledger line (`Invoice Ninja`, `replaces QuickBooks`). The world is static, so nothing in a room changes between beats; the structure is told in sequence, never as a split screen.

- **Before** is a prop that stands for the rented thing (the paper stack, the calendar on the wall) and a neutral noun: a rented drive, a photo cloud, a mailing service, a transcription site.
- **On the Core now** is the Core or the app's home prop and one sentence: "<Person> keeps <thing> in <App> on the Core, not in <the rented place>."
- A company is named only in the chip. The villain is a pattern, never a company. "Before and after" is banned in user-facing copy, so cards say "now".
- A 30 second cut runs the pile, the chore, the Core, the limit.

### 2.5 Cards, captions and type

- **Type.** 36 design px is the floor on the 1080 px canvas of every film and ad (`CANVAS_TYPE_MIN`, `place.ts`). The live card is another case: `player.md` records the owner's "36 px text minimum", then "30 percent too big", and the live floor is now 25.5 px from 768 px wide. This playbook's brief asks for 36 px in the live card too: an open conflict (section 5). Copy is written for the tighter case.
- **Name as a kicker.** The name sits above the title in capitals, bold, tracked at 0.2em, in the accent colour, at the card's reading size. The capitals come from CSS; the string and every aria-label keep "Sally".
- **Fit.** Title six words, 40 characters or fewer. Body 26 words or fewer. Captions run 42 characters a line, two lines, sentence case, 150 words a minute (`claims.json`, `style`).
- **Safe areas** (`ads.md`, top / sides / bottom). 9:16 keeps 200 / 72 / 340 px clear; 1:1 keeps 84 / 84 / 120; 4:5 keeps 110 / 72 / 150; 16:9 keeps 54 / 96 / 54. Put the subject in the upper two thirds of a 9:16 frame.
- **Budgets** (the engine's arithmetic). 15 s: about 16 caption words over two beats. 30 s: about 45 over four. 60 s: about 108 over six or seven. Half a second of quiet, and no camera move, after each honest limit [house].

### 2.6 The disclosure strip

Printed from `claims.json`, never typed into a card. Every frame: **Fictional family. Real software.** The end card always adds the scripted-scenes line and the stylised-art line. A `replaces` chip adds the names-owners line. An agent beat adds "Hermes is from Nous Research. OpenClaw is from the OpenClaw Foundation. Companion Hub packages both." The first Hermes card notes "Messages pass through the chat service you choose." The sign-off "UnCloud your life." and the one call to action, See Companion Core at ci.computer/core, are added by the renderer. No price, ship date, performance number or customer quote.

### 2.7 Daylight only

Day or golden hour: the renderer opens with `?lighting=day`; `--lighting golden` is the one other hour. Two flagship houses (`bgfamily`, `familyhouse-nora`) carry a dusk preset and must not be filmed as authored. No night, neon, glow or RGB, even for the developer, lawyer and teacher: shoot the hour before dusk. Copper appears only on the Core.

### 2.8 The lint checklist writers run

Run `node lint-playbook.mjs` (exit 1 on any error). It applies the 72 banned phrases of `claims.json` to every title, body, chip, note, caption and sample line, then checks:

1. Title six words, no digit; body 30 words (26 preferred), sentences 20 or fewer, a full stop at the end.
2. No em dash, en dash, double hyphen or exclamation mark anywhere.
3. Vocabulary: agent, never assistant or bot; sign in; Companion Core, never home server, box or NAS; Companion Memory; "the Bitwarden apps"; Paperless-ngx never bare; catalog casing.
4. Never: private, secure, safe, offline, never leaves, remote, from anywhere, prices, savings, time saved, speeds, parity, "legally binding", "compliant", "easy", a testimonial, "before and after".
5. Third person, present tense; children and teens never speak.
6. Chips: app name first, then `replaces <X>` from its own list.
7. Every Hub app named is the shot's app or in `with`.
8. Anchors: valid roles, a universal role ending the chain; camera hints from the schema's enums.
9. Every script line is a whole sentence from the start of a card body, fits its slot, and never opens on the AI chore.
10. Each persona has a shot in an archetype room and one with a pool app.
11. Not covered by the lint: the fleet rules (`fleet-unique`, the 40% app cap), whether each chain resolves in each home, and age fit; section 4 states them. The lint's timing check uses the first-pass model (`estimatedSeconds`); `engineSeconds` is the engine's figure.

## 3. The fourteen playbooks

Fixed order: lead and tone, hooks that suit the feed, AI, shots, scripts. Shots are the bakeable beats; scripts are lifted from them.

### 3.1 The Organiser (`organiser`)

**Lead Sally.** The records office of a household and the back office of a practice of one. Comfort 3 of 5; AI pragmatic. **Tone:** pace 140 to 150 wpm, a pause at each full stop; sentences 8 to 14 words, then a fragment; humour dry, about paper. Owns: deliverable, scope, net 30. Never: self-hosted, container, LLM.

**Hooks for the feed.**
- Mumsnet Talk, Work board [V] https://www.mumsnet.com/talk/work (tone [?]: casual, supportive: a plain question): A paper noun she owns, then where it sits now. "Last year's invoice, found." (org-1).
- SBA business guide and SCORE [V] https://www.sba.gov/business-guide (tone [?]: plain and official: a deadline reads as help): The yearly chore, named as a list she already makes. "Every spring, a renewal list." (org-4).
- LinkedIn (own feed, local business groups) [?] https://www.linkedin.com/ (tone [?]: calm adult ads are normal): The sentence she can give a client about where the file sits. "The contract stays on the Core." (org-3).

**AI.** Never first; she reads, then sends. Chore: A client reply from three lines of notes (Hermes). Words: "The agent drafts the reply on the Core's local model. Sally reads it, then sends the reply." Absent: All other shots; no client file in a chat window.

**Shots.**
- **org-1 hook** office `desk@office, bookshelf@office, dining-table, room@office` `medium/left/front/standing` [small-business, alt productivity]. Dwell: Paper stack on the shelf by the closed laptop. Card: **Last year's invoice, found.** Sally feeds receipts and forms to Paperless-ngx. Every page is read and indexed. Last year's invoice comes up from one word. Chips `Paperless-ngx` + `replaces Google Drive`. Why: Paper in, one word out. Never: A scanner screen, a client name.
- **org-2 chore** kitchen `kitchen-island, fridge, counter` `medium/right/front/seated`. Dwell: Fridge door, wall-clock, two mugs. Card: **Two columns, one week.** Companion Planning holds Sally's week on the Core. Client calls and school pickups share one file. Chips `Companion Planning`. Why: One week, two jobs, one file. Never: A calendar screen.
- **org-3 core** office `core, bookshelf@office, desk@office` `medium/right/front/-` [small-business, alt productivity]. Dwell: The Core between two binders, once, in daylight. Card: **The contract stays on the Core.** Sally files the signed contract in Nextcloud. It sits in the client's folder, on the Core. It is not in a rented drive. Chips `Nextcloud` + `replaces Google Drive`. Why: A house shelf holds the client folder. Never: A client name, a padlock.
- **org-4 bring-home** office `desk@office, bookshelf@office, room@office` `close/-/above/seated`. Dwell: A handwritten renewal list (to author). Card: **Every spring, a renewal list.** Sally moves the old password file into VaultWarden. VaultWarden works with the Bitwarden apps. Some renewals stay. Chips `VaultWarden` + `replaces LastPass`. Note: Password attachments stay behind. Why: Export, import, an honest ending. Never: A password field, an account number.
- **org-5 ai** office `desk@office, dining-table, couch, room@office` `medium/left/behind/seated` [small-business, alt productivity; agent, member approves]. Dwell: A hand on the closed lid; a printed draft. Card: **A reply, drafted and read.** Sally sends Hermes three lines about a moved deadline. The agent drafts the reply on the Core's local model. Sally reads it, then sends the reply. Chips `Hermes`. Note: Messages pass through the chat service you choose. Why: The one AI chore she approves. Never: A chat window, the word assistant.
- **org-6 limit** living `couch@living, room@living` `wide/auto/front/seated`. Dwell: Sofa and window held still, no move. Card: **Email stays where it is.** Sally's inbox does not move to the Core. The folders, forms and week do. Why: Saying the limit aloud earns the claims. Never: A mail client, a promise.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.0 s. Hook "Last year's invoice, found." · (org-1) Sally feeds receipts and forms to Paperless-ngx. · (org-5) Sally sends Hermes three lines about a moved deadline. · end card. Names: Paperless-ngx, replaces Google Drive; Hermes.
- **15B** 15.0 s. Hook "Every spring, a renewal list." · (org-4) Sally moves the old password file into VaultWarden. · (org-2) Companion Planning holds Sally's week on the Core. · end card. Names: VaultWarden, replaces LastPass; Companion Planning.
- **15C** 15.1 s. Hook "The contract stays on the Core." · (org-3) Sally files the signed contract in Nextcloud. · (org-6) Sally's inbox does not move to the Core. · end card. Names: Nextcloud, replaces Google Drive.
- **30** 30.3 s. Hook "Last year's invoice, found." · (org-1) Sally feeds receipts and forms to Paperless-ngx. · (org-3) Sally files the signed contract in Nextcloud. It sits in the client's folder, on the Core. · (org-5) Sally sends Hermes three lines about a moved deadline. · (org-6) Sally's inbox does not move to the Core. The folders, forms and week do. · end card. Names: Paperless-ngx, replaces Google Drive; Nextcloud, replaces Google Drive; Hermes.
- **60 tour** 61.4 s (1.4 s over the slot), 115 words: all 6 shots in order, sentences kept 3,2,3,3,2,3, one beat every 8 s. Names: Paperless-ngx, replaces Google Drive; Companion Planning; Nextcloud, replaces Google Drive; VaultWarden, replaces LastPass; Hermes.

### 3.2 The Builder (`builder`)

**Lead John.** A software engineer who brings home side projects, the editor and a drafting model; work code stays at work. Comfort 4 of 5; AI pragmatic. **Tone:** pace 150 to 165 wpm, a beat after each sentence; sentences 5 to 12 words, fragments; humour deadpan, aimed at himself. Owns: repo, diff, rebase. Never: AI-powered, supercharge, seamless, 10x.

**Hooks for the feed.**
- Hacker News [V] https://news.ycombinator.com/ (tone [?]: specifics win, adjectives lose): One falsifiable sentence naming where the thing lives. "The repository lives on a shelf." (bld-1).
- r/selfhosted [S] https://www.reddit.com/r/selfhosted/ (tone [?]: civil: a table of limits beats a slogan): What does not carry over, said first. "Side projects come home." (bld-4).
- Lobsters [V] https://lobste.rs/ (tone [?]: kind and narrow: no sneering): A tool that does one thing, plainly, no adjectives. "The editor is already there." (bld-2).

**AI.** Never first; the diff is read. Chore: A commit message, rewritten by hand. Words: "A model on the Core drafts the commit message. John reads the diff, then rewrites the message." Absent: All other shots; no hosted-model name, key or speed.

**Shots.**
- **bld-1 hook** office `desk@office, desk@bedroom, dining-table, room@office` `medium/right/left/seated`. Dwell: Laptop and monitor arm from the side, desk-lamp lit. Card: **The repository lives on a shelf.** John's side projects live in Gitea on the Core. Work code stays where work keeps it. Issues and pull requests sit beside them. Chips `Gitea` + `replaces GitHub`. Why: He says what stays at work first. Never: Legible code, a terminal, RGB.
- **bld-2 chore** office `desk@office#1, desk@office, desk@bedroom, room@office` `close/left/left/seated` [reviewed.json]. Dwell: A hand lifting the laptop lid; monitor arm soft. Card: **The editor is already there.** Code Server puts the editor on the Core. John opens the laptop and the files sit at home. Chips `Code Server` + `replaces Cursor`. Note: Installing an extension uses the internet. Why: The files live at home. Never: From anywhere, an extension list.
- **bld-3 ai** office `desk@office, desk@bedroom, room@office` `close/left/left/seated`. Dwell: A hand over the trackpad, approving. Card: **The model drafts. John decides.** A model on the Core drafts the commit message. John reads the diff, then rewrites the message. Nothing merges until the diff is read. Chips `Open WebUI` + `replaces ChatGPT`. Why: Hold on the approval, not the interface. Never: A readable diff, a speed meter.
- **bld-4 bring-home** office `bookshelf@office, desk@office, core` `medium/left/front/standing`. Dwell: A shelf of binders; the Core small in frame. Card: **Side projects come home.** John moves the side projects with Gitea's migration form. Issues come across with a token. Actions workflows do not. Chips `Gitea` + `replaces GitHub`. Why: A form and a token; the loss named. Never: A token, a CI run.
- **bld-5 chore** office `desk@office, desk@bedroom, room@office` `medium/right/front/seated`. Dwell: A pad of handwritten triggers (to author). Card: **Three automations, rebuilt.** John rebuilds three automations in n8n on the Core. The old triggers do not export, so each is retyped. n8n is source-available, not open source. Chips `n8n` + `replaces Zapier`. Why: A rebuild, not a migration. Never: A node graph, the word seamless.
- **bld-6 core** office `core, bookshelf@office, desk@office` `wide/auto/front/standing`. Dwell: Desk and Core on one wall. Card: **One shelf, one model.** The Core sits on the shelf over the desk. It runs a capable model, not the best one this month. John picks the chore. Why: Desk and Core together; the limit spoken. Never: A benchmark, a glowing LED.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.6 s. Hook "The repository lives on a shelf." · (bld-1) John's side projects live in Gitea on the Core. · (bld-3) A model on the Core drafts the commit message. · end card. Names: Gitea, replaces GitHub; Open WebUI, replaces ChatGPT.
- **15B** 15.6 s. Hook "Side projects come home." · (bld-4) John moves the side projects with Gitea's migration form. · (bld-5) John rebuilds three automations in n8n on the Core. · end card. Names: Gitea, replaces GitHub; n8n, replaces Zapier.
- **15C** 15.2 s. Hook "The editor is already there." · (bld-2) Code Server puts the editor on the Core. · (bld-6) The Core sits on the shelf over the desk. · end card. Names: Code Server, replaces Cursor.
- **30** 31.9 s (1.9 s over the slot). Hook "The repository lives on a shelf." · (bld-1) John's side projects live in Gitea on the Core. · (bld-2) Code Server puts the editor on the Core. · (bld-3) A model on the Core drafts the commit message. · (bld-6) The Core sits on the shelf over the desk. It runs a capable model, not the best one this month. John picks the chore. · end card. Names: Gitea, replaces GitHub; Code Server, replaces Cursor; Open WebUI, replaces ChatGPT.
- **60 tour** 60.6 s, 113 words: all 6 shots in order, sentences kept 2,2,2,3,2,3, one beat every 8 s. Names: Gitea, replaces GitHub; Code Server, replaces Cursor; Open WebUI, replaces ChatGPT; n8n, replaces Zapier.

### 3.3 The Gamer (`gamer`)

**Lead Steve.** A teenager who plays most days; the ad speaks to the adult and the teen never speaks. Comfort 3 of 5; AI split. **Tone:** pace 150 to 165 wpm in an adult caption voice; sentences 5 to 12 words, clipped; humour deadpan about habits. Owns: session, queue, lobby, clip. Never: homelab, frame rate, level up, gaming PC.

**Hooks for the feed.**
- YouTube (gaming creators, clips, tech reviews) [V] https://www.youtube.com/ (tone [?]: creator-led: land the hook in two seconds): What he already does, moved one floor down. "The game runs on the Core." (gmr-1).
- Discord (friend servers and voice) [S] https://discord.com/ (tone [?]: fast and loose: brand nothing): The Saturday plan with the cousins, as logistics. "A clip crosses the room." (gmr-3).
- GamingOnLinux and ProtonDB [V] https://www.gamingonlinux.com/ (tone [?]: readers check limits first): Who keeps the account, said before the claim. "Valve keeps the account." (gmr-6).

**AI.** Homework only, never inside a game. Chore: One step explained; Steve writes the answer. Words: "A model on the Core explains one homework step. Steve asks it to explain, not to write." Absent: All other shots; no AI companion.

**Shots.**
- **gmr-1 hook** kids `bed@kids, desk@kids, room@kids, room@bedroom` `medium/right/behind/seated`. Dwell: Steve from behind at a desk, screen turned away. Card: **The game runs on the Core.** Steve signs in to Steam with a Valve account. Steam Headless runs the session on the Core. A Core may lack the graphics a game wants. Chips `Steam Headless` + `replaces GeForce Now`. Note: Steam needs a Valve account. Why: The session moved; the account did not. Never: A game title, a frame rate.
- **gmr-2 chore** living `tv, couch@living, room@living` `wide/left/front/seated`. Dwell: Sofa and TV in window light; cushions, a throw. Card: **Friday film night, family files.** Jellyfin plays Friday's film from files the family holds. The family fills the sofa and Steve picks it. Chips `Jellyfin` + `replaces Plex`. Note: Only files the family holds play here. Why: The shared-room half of the gamer. Never: A streaming logo, a film poster.
- **gmr-3 chore** kids `desk@kids, bed@kids, room@kids, room@bedroom` `medium/left/behind/seated`. Dwell: Two phones on a desk, one tilted. Card: **A clip crosses the room.** PairDrop sends the best clip to the sofa. It uses the home Wi-Fi, with no chat app between. Chips `PairDrop` + `replaces AirDrop`. Why: A small win a teen would repeat. Never: A chat app, a readable clip.
- **gmr-4 ai** kids `desk@kids, room@kids, room@bedroom` `close/-/above/seated`. Dwell: A pencil and a worksheet by the closed laptop. Card: **One homework step, explained.** A model on the Core explains one homework step. Steve asks it to explain, not to write. Then Steve writes the answer. Chips `Open WebUI` + `replaces ChatGPT`. Note: A study helper, not a teacher. It can be wrong. Why: A chore a school accepts. Never: A teen talking to an AI.
- **gmr-5 bring-home** kids `desk@kids, room@kids, room@bedroom` `wide/left/front/seated`. Dwell: A charging phone; albums on a shelf. Card: **A full phone, emptied.** Steve's photos move into Immich on the Core. The first sort takes a while, because Immich reads every picture. Chips `Immich` + `replaces Google Photos`. Note: Keep the originals. Immich is not a backup. Why: Export, import, payoff for a full phone. Never: A photo grid, a storage meter.
- **gmr-6 core** living `core, couch@living` `close/auto/front/-`. Dwell: The Core on its shelf, daylight on top. Card: **Valve keeps the account.** Steam Headless runs the session on the Core. A cloud gaming service runs it on its own servers. Valve keeps the account and the library. Chips `Steam Headless` + `replaces GeForce Now`. Why: The limit and the mechanism together. Never: A console-replacement look.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.2 s. Hook "The game runs on the Core." · (gmr-1) Steve signs in to Steam with a Valve account. · (gmr-3) PairDrop sends the best clip to the sofa. · end card. Names: Steam Headless, replaces GeForce Now; PairDrop, replaces AirDrop.
- **15B** 15.2 s. Hook "A clip crosses the room." · (gmr-3) PairDrop sends the best clip to the sofa. · (gmr-2) Jellyfin plays Friday's film from files the family holds. · end card. Names: PairDrop, replaces AirDrop; Jellyfin, replaces Plex.
- **15C** 15.0 s. Hook "Valve keeps the account." · (gmr-6) Steam Headless runs the session on the Core. · (gmr-5) Steve's photos move into Immich on the Core. · end card. Names: Steam Headless, replaces GeForce Now; Immich, replaces Google Photos.
- **30** 29.5 s. Hook "The game runs on the Core." · (gmr-1) Steve signs in to Steam with a Valve account. · (gmr-3) PairDrop sends the best clip to the sofa. · (gmr-4) A model on the Core explains one homework step. · (gmr-6) Steam Headless runs the session on the Core. A cloud gaming service runs it on its own servers. · end card. Names: Steam Headless, replaces GeForce Now; PairDrop, replaces AirDrop; Open WebUI, replaces ChatGPT.
- **60 tour** 63.0 s (3.0 s over the slot), 119 words: all 6 shots in order, sentences kept 2,2,2,3,2,3, one beat every 9 s. Names: Steam Headless, replaces GeForce Now; Jellyfin, replaces Plex; PairDrop, replaces AirDrop; Open WebUI, replaces ChatGPT; Immich, replaces Google Photos.

### 3.4 The Learner (`learner`)

**Lead Jean.** A student with study chores at home; the ad speaks to the adult who runs the Core. Comfort 2 of 5; AI split. **Tone:** pace 150 to 165 wpm in an adult caption voice; sentences 3 to 9 words with peers, 8 to 14 explaining; humour self-mocking about stress. Owns: revision, mark scheme, set text. Never: edtech, ace your exams, kid-safe.

**Hooks for the feed.**
- YouTube study and revision channels [V] https://www.youtube.com/ (tone [?]: patient and jokey: hands and paper): The work first, the check second. "French first, then checked." (lrn-1).
- TikTok study content [S] https://www.tiktok.com/ (tone [?]: fast, deadpan: check the under-18 policy): One lookup, one source, in one breath. "A date, looked up at home." (lrn-3).
- Obsidian forum [V] https://forum.obsidian.md/ (tone [?]: how-to tone: notes as files): The folder that moves with the student. "Study notes as plain files." (lrn-4).

**AI.** Second shot, never the hook. Chore: One proof step explained; Jean writes the answer. Words: "A model on the Core answers, and the question stays there by default. Jean writes the answer." Absent: All other shots; never writes or grades.

**Shots.**
- **lrn-1 hook** kids `desk@kids, bookshelf@kids, room@kids, room@bedroom` `close/-/above/seated`. Dwell: A handwritten French paragraph with two margin corrections. Card: **French first, then checked.** Jean checks the French paragraph in LibreTranslate. Jean writes it first, then checks it. The Core does the translating, not a website. Chips `LibreTranslate` + `replaces Google Translate`. Why: The work comes before the check. Never: A claim about translation quality.
- **lrn-2 ai** kids `desk@kids, bookshelf@kids, room@kids, room@bedroom` `close/-/above/seated`. Dwell: A pencil on a printed proof. Card: **The question goes to the Core.** Jean asks Open WebUI to explain one proof step. A model on the Core answers, and the question stays there by default. Jean writes the answer. Chips `Open WebUI` + `replaces ChatGPT`. Note: A study helper, not a teacher. It can be wrong. Why: Where the question goes, without fear. Never: A close face, a child alone.
- **lrn-3 chore** kids `desk@kids, bookshelf@kids, room@kids, room@bedroom` `medium/right/front/seated`. Dwell: An open textbook and an essay plan. Card: **A date, looked up at home.** Jean looks up a date in Kiwix. The Wikipedia file sits on the Core, downloaded once. Chips `Kiwix` + `replaces Google Search`. Note: Kiwix is empty until content is downloaded. Why: A lookup that asks no search engine. Never: A results page, a map.
- **lrn-4 bring-home** kids `desk@kids, bookshelf@kids, room@kids, room@bedroom` `medium/left/front/seated`. Dwell: Exercise books with coloured tabs, stacked. Card: **Study notes as plain files.** Jean moves the term's notes into Obsidian. They are plain Markdown files on the Core. If the app changes, the folder moves with Jean. Chips `Obsidian` + `replaces Notion`. Why: A student keeps the folder. Never: An open-source claim.
- **lrn-5 chore** kids `bookshelf@kids, desk@kids, room@kids, room@bedroom` `medium/auto/front/seated`. Dwell: The set text, a ribbon in it. Card: **Sources, saved for the essay.** Jean saves the essay's sources in Linkwarden. Each page is kept on the Core, in one collection. Chips `Linkwarden` + `replaces Raindrop.io`. Why: A reading list that survives dead links. Never: A browser window, a headline.
- **lrn-6 core** kids `core, bookshelf@kids` `wide/auto/front/-`. Dwell: The Core by the door; a coat on a hook. Card: **A parent can point to it.** The Core sits on the shelf by the door. A parent can point to the machine. The household lead runs it. Why: The adult sees where the questions go. Never: A child speaking, a padlock.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.0 s. Hook "French first, then checked." · (lrn-1) Jean checks the French paragraph in LibreTranslate. · (lrn-2) Jean asks Open WebUI to explain one proof step. · end card. Names: LibreTranslate, replaces Google Translate; Open WebUI, replaces ChatGPT.
- **15B** 15.5 s. Hook "A date, looked up at home." · (lrn-3) Jean looks up a date in Kiwix. · (lrn-5) Jean saves the essay's sources in Linkwarden. · end card. Names: Kiwix, replaces Google Search; Linkwarden, replaces Raindrop.io.
- **15C** 15.0 s. Hook "Study notes as plain files." · (lrn-4) Jean moves the term's notes into Obsidian. · (lrn-6) The Core sits on the shelf by the door. · end card. Names: Obsidian, replaces Notion.
- **30** 29.5 s. Hook "French first, then checked." · (lrn-1) Jean checks the French paragraph in LibreTranslate. · (lrn-3) Jean looks up a date in Kiwix. · (lrn-2) Jean asks Open WebUI to explain one proof step. · (lrn-6) The Core sits on the shelf by the door. A parent can point to the machine. The household lead runs it. · end card. Names: LibreTranslate, replaces Google Translate; Kiwix, replaces Google Search; Open WebUI, replaces ChatGPT.
- **60 tour** 60.6 s, 113 words: all 6 shots in order, sentences kept 3,2,2,2,2,3, one beat every 8 s. Names: LibreTranslate, replaces Google Translate; Open WebUI, replaces ChatGPT; Kiwix, replaces Google Search; Obsidian, replaces Notion; Linkwarden, replaces Raindrop.io.

### 3.5 The Maker (`maker`)

**Lead Bruk.** A hobbyist with a day job who makes things in the evenings and keeps the family archive. Comfort 3 of 5; AI split. **Tone:** pace 125 to 145 wpm, a full beat between thoughts; sentences 6 to 14 words; humour light, rarely about themselves. Owns: RAW, XMP, stems, cull. Never: content creator, unlock, NAS, generate, prompt.

**Hooks for the feed.**
- Obsidian Forum [V] https://forum.obsidian.md/ (tone [?]: plain how-to tone): The thing that comes with you if the app changes. "Drafts as plain files." (mkr-4).
- Cara [V] https://cara.app/ (tone [?]: refuses AI portfolios: files first): A sorted folder; the work stays theirs. "The painting is still Bruk's." (mkr-6).
- FM Forums (Fred Miranda) [V] https://www.fredmiranda.com/forum/ (tone [?]: critique and workflow talk): A weekend of RAW files and where they sit now. "The weekend's shoot, sorted." (mkr-1).

**AI.** Does not appear. Chore: None; the Core holds the files, it does not paint. Words: "The Core holds the sorted folders. It does not paint, write or play." Absent: All six shots; no generate, prompt or AI art.

**Shots.**
- **mkr-1 hook** living `easel@living, music@living, desk, room@living` `medium/right/front/seated`. Dwell: Prints on a line, window light. Card: **The weekend's shoot, sorted.** Bruk's weekend pictures sit in Immich on the Core. They are not in a photo cloud. The first sort takes a while. Chips `Immich` + `replaces Google Photos`. Note: Keep the originals. Immich is not a backup. Why: Hands first; the archive is the stake. Never: A prompt box, real artworks.
- **mkr-2 chore** living `music@living, couch@living, room@living` `medium/left/front/seated`. Dwell: A record player, a sleeve leaning on it. Card: **Records, rips and demos.** Navidrome plays Bruk's records, rips and demos. It plays files the family holds, nothing else. Chips `Navidrome` + `replaces Spotify`. Why: Music as files, a maker's habit. Never: A streaming logo.
- **mkr-3 chore** living `music@living, desk, room@living` `close/-/front/seated`. Dwell: Headphones on the piano lid (to author); window light. Card: **A take, trimmed and saved.** Bruk trims the take in AudioMass. The Core serves the editor, and the file is saved where Bruk chooses. No audio website holds a copy. Chips `AudioMass` + `replaces Adobe Audition`. Note: Edits stay in the browser until saved. Why: A local edit, a chosen save. Never: A waveform, a DAW.
- **mkr-4 bring-home** office `desk@office, bookshelf@office, room@office` `close/left/above/seated`. Dwell: A notebook, one line crossed out. Card: **Drafts as plain files.** Bruk's drafts are plain Markdown in Obsidian. If the app changes, the pages come along. Chips `Obsidian` + `replaces Notion`. Why: Files outlive the app. Never: An open-source claim.
- **mkr-5 chore** living `easel@living, desk, room@living` `medium/auto/front/seated`. Dwell: An easel with a line drawing. Card: **Line art in a browser tab.** Bruk draws the line art in Inkscape. The Core serves the browser tab. It is vector work only. Chips `Inkscape` + `replaces Adobe Illustrator`. Why: A real tool, its limit said. Never: Generated art, a brand mark.
- **mkr-6 core** living `core, music@living, couch@living` `medium/auto/front/-`. Dwell: The Core on a shelf by a plant. Card: **The painting is still Bruk's.** The Core holds the sorted folders. It does not paint, write or play. The originals stay untouched. Note: The Core is not a backup. Why: A chore-doer, never a maker. Never: A model hero, a split screen.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.3 s. Hook "Drafts as plain files." · (mkr-4) Bruk's drafts are plain Markdown in Obsidian. · (mkr-3) Bruk trims the take in AudioMass. · end card. Names: Obsidian, replaces Notion; AudioMass, replaces Adobe Audition.
- **15B** 15.1 s. Hook "The painting is still Bruk's." · (mkr-6) The Core holds the sorted folders. · (mkr-1) Bruk's weekend pictures sit in Immich on the Core. · end card. Names: Immich, replaces Google Photos.
- **15C** 15.0 s. Hook "The weekend's shoot, sorted." · (mkr-1) Bruk's weekend pictures sit in Immich on the Core. · (mkr-2) Navidrome plays Bruk's records, rips and demos. · end card. Names: Immich, replaces Google Photos; Navidrome, replaces Spotify.
- **30** 31.1 s (1.1 s over the slot). Hook "The weekend's shoot, sorted." · (mkr-1) Bruk's weekend pictures sit in Immich on the Core. · (mkr-2) Navidrome plays Bruk's records, rips and demos. · (mkr-4) Bruk's drafts are plain Markdown in Obsidian. If the app changes, the pages come along. · (mkr-6) The Core holds the sorted folders. It does not paint, write or play. The originals stay untouched. · end card. Names: Immich, replaces Google Photos; Navidrome, replaces Spotify; Obsidian, replaces Notion.
- **60 tour** 60.2 s, 109 words: all 6 shots in order, sentences kept 3,2,3,2,3,3, one beat every 8 s. Names: Immich, replaces Google Photos; Navidrome, replaces Spotify; AudioMass, replaces Adobe Audition; Obsidian, replaces Notion; Inkscape, replaces Adobe Illustrator.

### 3.6 The Host (`host`)

**Lead Juma.** The person who knows where the passports are and that Thursday is bin day. Comfort 2 of 5; AI split. **Tone:** pace 140 to 155 wpm, steady list beats; sentences 6 to 12 words in list rhythm; humour domestic, self-aware. Owns: meal plan, batch cooking, carpool, RSVP. Never: self-hosted, SSO, LLM, supermom.

**Hooks for the feed.**
- Mumsnet Talk [V] https://www.mumsnet.com/talk (tone [?]: casual and frank: a dilemma beats a pitch): A number of guests and the list that holds them. "Twelve for Sunday lunch." (hst-1).
- Home Assistant Community forum [V] https://community.home-assistant.io/ (tone [?]: practical, patient: the household tech person): A rule the host would never write, with its limit said. "The porch light has a rule." (hst-4).
- Royal Horticultural Society advice [V] https://www.rhs.org.uk/advice/grow-your-own (tone [?]: approachable: a recipe is a gentle opener): A kept thing, a recipe tin, given a second copy. "Gran's recipe tin, copied." (hst-2).

**AI.** Never first; she decides. Chore: Two dishes from leeks and cheese ends (Hermes). Words: "It suggests two dishes on the Core's local model. Juma decides." Absent: All other shots; never books, pays or judges a recipe safe.

**Shots.**
- **hst-1 hook** kitchen `kitchen-island, fridge, counter` `medium/right/front/seated`. Dwell: A paper list, then the fridge door. Card: **Twelve for Sunday lunch.** Sunday's list sits in KitchenOwl on the Core. Everyone at home adds to it. Chips `KitchenOwl`. Why: The paper list first, the app second. Never: A phone in a shop aisle.
- **hst-2 chore** kitchen `counter, range, fridge` `close/left/above/seated` [reviewed.json]. Dwell: A recipe tin and handwritten cards on the counter. Card: **Gran's recipe tin, copied.** Gran's recipe cards are in Mealie now. They are typed once, on the Core, and searchable after. Chips `Mealie` + `replaces Paprika`. Note: Paprika exports can be imported. Why: A kept thing gets a second copy. Never: A safe-recipe claim, an AnyList export.
- **hst-3 chore** kitchen `fridge, counter` `close/-/front/seated`. Dwell: The fridge door with a paper rota. Card: **Thursday is bin day.** The bin-day rota lives in Yuvomi on the Core. Swaps land on one board the whole house shares. Chips `Yuvomi`. Why: The shared beat: one household, one board. Never: Separate accounts, a nagging parent.
- **hst-4 chore** entry `front-door` `medium/auto/front/standing`. Dwell: The porch light by the front door in daylight. Card: **The porch light has a rule.** Home Assistant runs the porch light rule. Devices that need their own cloud still use it. Chips `Home Assistant` + `replaces Google Home`. Note: Cloud devices keep their cloud. Why: The rule runs itself. Never: A Zigbee stick, an energy promise.
- **hst-5 ai** kitchen `counter, range, fridge` `medium/left/front/seated` [agent, member approves]. Dwell: Leeks and a heel of cheese on a board. Card: **What to cook with leeks.** Juma asks Hermes what to cook with leeks. It suggests two dishes on the Core's local model. Juma decides. Chips `Hermes`. Note: Messages pass through the chat service you choose. Why: One household chore; the host decides. Never: Booking, paying, homework.
- **hst-6 bring-home** kitchen `core, fridge, counter` `medium/auto/front/seated` [reviewed.json]. Dwell: The Core on its shelf by the paper calendar. Card: **Calendars move, sharing does not.** Juma imports the family calendar into Radicale. Sharing links do not carry over. The shop-aisle list stays on paper. Chips `Radicale` + `replaces Google Calendar`. Why: The move and its limit. Never: A shop-aisle phone, remote access.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.1 s. Hook "Twelve for Sunday lunch." · (hst-1) Sunday's list sits in KitchenOwl on the Core. · (hst-2) Gran's recipe cards are in Mealie now. · end card. Names: KitchenOwl; Mealie, replaces Paprika.
- **15B** 15.0 s. Hook "The porch light has a rule." · (hst-4) Home Assistant runs the porch light rule. · (hst-3) The bin-day rota lives in Yuvomi on the Core. · end card. Names: Home Assistant, replaces Google Home; Yuvomi.
- **15C** 15.5 s. Hook "Gran's recipe tin, copied." · (hst-2) Gran's recipe cards are in Mealie now. · (hst-6) Juma imports the family calendar into Radicale. · end card. Names: Mealie, replaces Paprika; Radicale, replaces Google Calendar.
- **30** 28.7 s. Hook "Twelve for Sunday lunch." · (hst-1) Sunday's list sits in KitchenOwl on the Core. Everyone at home adds to it. · (hst-2) Gran's recipe cards are in Mealie now. · (hst-5) Juma asks Hermes what to cook with leeks. · (hst-6) Juma imports the family calendar into Radicale. Sharing links do not carry over. · end card. Names: KitchenOwl; Mealie, replaces Paprika; Hermes; Radicale, replaces Google Calendar.
- **60 tour** 56.6 s, 103 words: all 6 shots in order, sentences kept 2,2,2,2,3,3, one beat every 8 s. Names: KitchenOwl; Mealie, replaces Paprika; Yuvomi; Home Assistant, replaces Google Home; Hermes; Radicale, replaces Google Calendar.

### 3.7 The Tech Family (`tech-family`)

**Lead Andres.** The household lead of a family that runs its own network; the family is the acceptance test. Comfort 4 of 5; AI split. **Tone:** pace 150 wpm, hold on each proper noun; sentences 8 to 14 words, one fact each; humour deadpan, in-group. Owns: DNS, allow list, commit, scene, restore. Never: AI-powered, plug and play, easy, VPN, remote.

**Hooks for the feed.**
- Home Assistant Community forum [V] https://community.home-assistant.io/ (tone [?]: patient: use-at-your-own-risk notes): The partner's one requirement, as the lamp rule. "The lamp comes on." (tf-3).
- Pi-hole Discourse [V] https://discourse.pi-hole.net/ (tone [?]: procedural: read the FAQ first): The one allow-list entry that ends a family complaint. "One entry, and the page opens." (tf-2).
- Lemmy c/selfhosted (lemmy.world) [V] https://lemmy.world/c/selfhosted (tone [?]: civil: disclose, wait 30 days): What the router asks first, stated as a fact. "Every family has one fixer." (tf-1).

**AI.** Optional third beat, never the partner's or a child's. Chore: A dropped hall sensor explained; the lead checks. Words: "It can be wrong, so the household lead checks." Absent: All other shots; no child with an AI.

**Shots.**
- **tf-1 hook** entry `core, counter, room@entry` `close/right/front/standing`. Dwell: Hands taping a label on a cable. Card: **Every family has one fixer.** Every family has one person who fixes the Wi-Fi. Here, the router asks Pi-hole on the Core first. Chips `Pi-hole` + `replaces NextDNS`. Note: Pi-hole blocks domains, nothing more. Why: The tinkerer's hands, the family implied. Never: A hooded hacker, a readable screen.
- **tf-2 chore** living `couch@living, room@living` `medium/auto/front/seated`. Dwell: Two people on a sofa, one looks up. Card: **One entry, and the page opens.** The homework site stops loading. The household lead adds one domain to the Pi-hole allow list. The page opens. Chips `Pi-hole` + `replaces NextDNS`. Why: Pair the tinkerer with a non-tinkerer reaction. Never: A query log, a block list.
- **tf-3 chore** living `couch@living, room@living` `wide/left/front/seated`. Dwell: A floor-lamp by the sofa, a hand reaching. Card: **The lamp comes on.** Home Assistant on the Core turns the lamp on. The partner only has to ask. Devices that need their own cloud still use it. Chips `Home Assistant` + `replaces Google Home`. Why: The acceptance test, within the partner's reach. Never: A scene editor, YAML.
- **tf-4 chore** garage `room@garage, core` `wide/left/left/standing`. Dwell: The garage bench with retired hardware in labelled crates. Card: **The house config has a history.** The household lead keeps the house config in Forgejo. Every change gets a commit. The repository sits on the Core. Chips `Forgejo` + `replaces GitHub`. Why: A commit history earns a fixer trust. Never: A CI run, a terminal.
- **tf-5 bring-home** living `tv, couch@living, room@living` `wide/right/front/seated`. Dwell: A media cabinet beside the TV, shelves of discs. Card: **The film shelf, scanned again.** Jellyfin scans the same folders the old server used. Watched flags do not carry over. Chips `Jellyfin` + `replaces Plex`. Why: A move that costs something small, named. Never: A poster wall, a streaming logo.
- **tf-6 ai** office `desk@office, desk@bedroom, room@office` `medium/left/left/seated`. Dwell: A notebook of sensor names by a closed laptop. Card: **Why the hall sensor dropped.** A model on the Core explains the dropped sensor. It can be wrong, so the household lead checks. Chips `Open WebUI` + `replaces ChatGPT`. Why: A third beat, its limit said once. Never: A chat window.
- **tf-7 core** entry `core, counter` `wide/auto/front/standing`. Dwell: The Core on the hall shelf by the router. Card: **The router sits beside the Core.** The Core sits on the hall shelf. The router is beside it. Backups are the household lead's job. The Core is not a backup. Why: The Core once, last, backup answered. Never: A server rack, an emissive LED.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.5 s. Hook "The lamp comes on." · (tf-3) Home Assistant on the Core turns the lamp on. · (tf-2) The homework site stops loading. · end card. Names: Home Assistant, replaces Google Home; Pi-hole, replaces NextDNS.
- **15B** 15.5 s. Hook "One entry, and the page opens." · (tf-2) The homework site stops loading. · (tf-4) The household lead keeps the house config in Forgejo. · end card. Names: Pi-hole, replaces NextDNS; Forgejo, replaces GitHub.
- **15C** 15.6 s. Hook "Every family has one fixer." · (tf-1) Every family has one person who fixes the Wi-Fi. · (tf-5) Jellyfin scans the same folders the old server used. · end card. Names: Pi-hole, replaces NextDNS; Jellyfin, replaces Plex.
- **30** 30.7 s. Hook "Every family has one fixer." · (tf-1) Every family has one person who fixes the Wi-Fi. · (tf-2) The homework site stops loading. · (tf-3) Home Assistant on the Core turns the lamp on. · (tf-7) The Core sits on the hall shelf. The router is beside it. Backups are the household lead's job. The Core is not a backup. · end card. Names: Pi-hole, replaces NextDNS; Home Assistant, replaces Google Home.
- **60 tour** 61.6 s (1.6 s over the slot), 111 words: all 7 shots in order, sentences kept 1,2,2,2,2,2,4, one beat every 7 s. Names: Pi-hole, replaces NextDNS; Home Assistant, replaces Google Home; Forgejo, replaces GitHub; Jellyfin, replaces Plex; Open WebUI, replaces ChatGPT.

### 3.8 The Business Owner (`business-owner`)

**Lead Ruth.** Runs a shop, studio or practice of up to fifteen: quotes, invoices, contracts, the customer list. Comfort 2 of 5; AI pragmatic. **Tone:** pace 150 wpm, half a second after each burst; sentences 10 to 12 words, ceiling 20; humour a half-smile at renewal day. Owns: cash flow, margin, net 30, no-show. Never: stack, SaaS, data sovereignty.

**Hooks for the feed.**
- r/smallbusiness [S] https://www.reddit.com/r/smallbusiness/ (tone [?]: blunt and anecdotal: bans promotion): A concrete noun and the question where it lives. "The client folder lives at home." (bo-2).
- Alignable [V] https://www.alignable.com (tone [?]: friendly, professional, anti-spam): The Friday job, named as a time of the week. "Friday is for the books." (bo-1).
- Shopify Community [V] https://community.shopify.com (tone [?]: supportive, peer to peer): The receipt shoebox and the one folder after it. "The receipt shoebox, emptied." (bo-3).

**AI.** Never first; the owner reads before anything reaches a client. Chore: A late-payer reminder (AnythingLLM, name-only chip). Words: "Ruth reads it, changes a line, and presses send." Absent: All other shots; nothing emails or pays alone.

**Shots.**
- **bo-1 hook** dining `dining-table, desk@office, counter` `medium/left/front/seated` [small-business, alt money]. Dwell: A printed quote and pencil, golden hour. Card: **Friday is for the books.** Ruth closes the week with Invoice Ninja. Quotes and invoices sit on the Core. It is invoicing, not a ledger. Chips `Invoice Ninja` + `replaces QuickBooks`. Note: Invoicing only. Card payments need a provider. Why: The Friday money hour owners recognise. Never: An invoice mock-up, real amounts.
- **bo-2 core** office `core, bookshelf@office, desk@office` `medium/right/front/standing` [small-business, alt productivity]. Dwell: Labelled folders on the shelf, the Core between two. Card: **The client folder lives at home.** Nextcloud holds the quotes, invoices and signed contracts. They sit in one client folder, on the Core. Four places become one folder. Chips `Nextcloud` + `replaces Google Drive`. Why: The customer list is the stake. Never: A client name, a rented-drive logo.
- **bo-3 chore** dining `dining-table, counter, room@dining` `close/-/above/seated` [small-business, alt money]. Dwell: A shoebox of receipts (to author). Card: **The receipt shoebox, emptied.** A shoebox of receipts goes through Paperless-ngx. Every page is read and indexed. The accountant gets one folder. Chips `Paperless-ngx` + `replaces Evernote`. Why: The shoebox is the owner's own joke. Never: A tax figure, a deduction claim.
- **bo-4 chore** living `counter, desk@office, room@living` `medium/right/front/standing` [small-business, alt productivity]. Dwell: A pen on an order form at the counter. Card: **A signature at the counter.** A customer signs the order form at the counter. Docuseal holds the PDF on the Core. Signers outside the home need outside reach. Chips `Docuseal` + `replaces DocuSign`. Why: Signed in person, as the Core allows. Never: The words legally binding.
- **bo-5 ai** office `desk@office, dining-table, counter` `medium/left/left/seated` [small-business, alt productivity]. Dwell: A printed draft and a pen; laptop closed. Card: **A late-payer reminder, read first.** AnythingLLM drafts the late-payer reminder on the Core. Ruth reads it, changes a line, and presses send. Chips `AnythingLLM`. Why: The model drafts; the owner sends. Never: A send button, a customer name.
- **bo-6 bring-home** office `desk@office, dining-table, counter` `close/-/above/seated`. Dwell: Two paper stacks, one tied with string. Card: **A year of invoices, moved.** Ruth exports last year's customers and invoices. Invoice Ninja takes them in as spreadsheets. The ledger stays with the accountant. Chips `Invoice Ninja` + `replaces QuickBooks`. Why: Spreadsheets in; the accountant stays. Never: Payroll, a tax claim.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.1 s. Hook "The client folder lives at home." · (bo-2) Nextcloud holds the quotes, invoices and signed contracts. · (bo-3) A shoebox of receipts goes through Paperless-ngx. · end card. Names: Nextcloud, replaces Google Drive; Paperless-ngx, replaces Evernote.
- **15B** 15.5 s. Hook "Friday is for the books." · (bo-1) Ruth closes the week with Invoice Ninja. · (bo-6) Ruth exports last year's customers and invoices. · end card. Names: Invoice Ninja, replaces QuickBooks.
- **15C** 15.0 s. Hook "The receipt shoebox, emptied." · (bo-3) A shoebox of receipts goes through Paperless-ngx. · (bo-4) A customer signs the order form at the counter. · end card. Names: Paperless-ngx, replaces Evernote; Docuseal, replaces DocuSign.
- **30** 31.9 s (1.9 s over the slot). Hook "Friday is for the books." · (bo-1) Ruth closes the week with Invoice Ninja. · (bo-2) Nextcloud holds the quotes, invoices and signed contracts. They sit in one client folder, on the Core. Four places become one folder. · (bo-3) A shoebox of receipts goes through Paperless-ngx. Every page is read and indexed. · (bo-5) AnythingLLM drafts the late-payer reminder on the Core. · end card. Names: Invoice Ninja, replaces QuickBooks; Nextcloud, replaces Google Drive; Paperless-ngx, replaces Evernote; AnythingLLM.
- **60 tour** 60.6 s, 113 words: all 6 shots in order, sentences kept 3,3,3,2,2,3, one beat every 8 s. Names: Invoice Ninja, replaces QuickBooks; Nextcloud, replaces Google Drive; Paperless-ngx, replaces Evernote; Docuseal, replaces DocuSign; AnythingLLM.

### 3.9 The Creative (`creative`)

**Lead Dalia.** A working designer, photographer, filmmaker or musician with client work under NDA. Comfort 3 of 5; AI split. **Tone:** pace 135 to 145 wpm, a pause after each sentence; sentences 9 to 12 words, none over 20; humour self-deprecating about clients. Owns: brief, proof, NDA, embargoed. Never: private, secure, easy, AI-powered.

**Hooks for the feed.**
- Lift Gamma Gain (colourist forum) [V] https://www.liftgammagain.com/forum/index.php (tone [?]: technical, at home with storage): The clause that says confidential, and the folder where the draft sits. "The brief says confidential." (cre-1).
- Freelancers Union (SPARK chapters, member community) [V] https://freelancersunion.org/ (tone [?]: mutual aid: contracts, unpaid invoices): The invoice that follows the job. "The invoice follows the job." (cre-4).
- Graphic Artists Guild (chapters, 'Show Off & Tell') [V] https://graphicartistsguild.org/ (tone [?]: firm on AI and contracts: no vendor-bashing): The files move, the tools stay, no model near the picture. "The tools stay, the files move." (cre-7).

**AI.** Late; may be absent. Chore: The brief read back with its gaps (name-only chip). Words: "It does not make the picture." Absent: All other shots; no generated image or music.

**Shots.**
- **cre-1 hook** office `easel@office, desk@office, dining-table, room@office` `medium/left/front/seated`. Dwell: An easel with a half-finished poster. Card: **The brief says confidential.** Dalia keeps the drafts in Nextcloud on the Core. The brief is confidential, and Dalia knows which folder. Chips `Nextcloud` + `replaces Dropbox`. Why: Under NDA, not private: the folder answers. Never: Logos, AI-made art, a screen.
- **cre-2 chore** office `bookshelf@office, desk@office, couch, room@office` `wide/right/front/seated`. Dwell: A wall of prints (gallery-wall) in window light. Card: **Seven years of shoots, one search.** Dalia's shoots sit in Immich on the Core. Search by place and by album, not by old folder names. Chips `Immich` + `replaces Google Photos`. Note: Immich is a library, not a RAW developer. Why: An archive that outlives the job. Never: A wall TV, real photographs.
- **cre-3 bring-home** office `easel@office, desk@office, room@office` `medium/auto/front/seated` [with inkscape]. Dwell: A printed layout pinned beside a paper logo sketch. Card: **Layouts rebuilt in Penpot.** Dalia rebuilds the poster layout in Penpot. The logo is drawn in Inkscape. Both open in a browser tab served from the Core. Chips `Penpot` + `replaces Figma`. Note: No Figma importer was found. Why: No importer was found: a rebuild. Never: A Figma frame, a vendor accusation.
- **cre-4 chore** office `desk@office, dining-table, counter` `close/-/above/seated` [small-business, alt money]. Dwell: A printed invoice draft under a paperweight (to author). Card: **The invoice follows the job.** Dalia sends the invoice from Invoice Ninja. It keeps the clients and line items on the Core. Chips `Invoice Ninja` + `replaces FreshBooks`. Note: Card payments need a payment provider. Why: Getting paid is half the job. Never: An amount, a client name.
- **cre-5 chore** dining `dining-table, desk, counter` `medium/auto/front/seated` [small-business, alt creative]. Dwell: Proofs on a trestle table, a pen. Card: **A release, signed at the table.** The client signs the release at the dining table. Docuseal holds the PDF on the Core. Chips `Docuseal` + `replaces DocuSign`. Why: A moment of trust at the table. Never: Legally binding, a client face.
- **cre-6 ai** office `desk@office, easel@office, room@office` `close/-/above/seated`. Dwell: A printed brief with two lines marked in pencil. Card: **The brief, read back.** Open WebUI reads the brief back to Dalia. A model on the Core lists the gaps. It does not make the picture. Chips `Open WebUI`. Why: One chore; the picture stays the creative's. Never: A generated image, a chat window.
- **cre-7 core** office `core, bookshelf@office, desk@office` `wide/auto/front/-`. Dwell: The Core by a stack of drives (to author). Card: **The tools stay, the files move.** The editing tools stay on the laptop. The files, folders and invoices sit on the Core. The Core is not a backup. Why: The honest edge: no backup claim. Never: Software logos, a split screen.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.2 s. Hook "The brief says confidential." · (cre-1) Dalia keeps the drafts in Nextcloud on the Core. · (cre-2) Dalia's shoots sit in Immich on the Core. · end card. Names: Nextcloud, replaces Dropbox; Immich, replaces Google Photos.
- **15B** 15.0 s. Hook "The invoice follows the job." · (cre-4) Dalia sends the invoice from Invoice Ninja. · (cre-5) The client signs the release at the dining table. · end card. Names: Invoice Ninja, replaces FreshBooks; Docuseal, replaces DocuSign.
- **15C** 15.5 s. Hook "The tools stay, the files move." · (cre-7) The editing tools stay on the laptop. · (cre-3) Dalia rebuilds the poster layout in Penpot. · end card. Names: Penpot, replaces Figma.
- **30** 30.3 s. Hook "The brief says confidential." · (cre-1) Dalia keeps the drafts in Nextcloud on the Core. · (cre-2) Dalia's shoots sit in Immich on the Core. · (cre-3) Dalia rebuilds the poster layout in Penpot. · (cre-7) The editing tools stay on the laptop. The files, folders and invoices sit on the Core. The Core is not a backup. · end card. Names: Nextcloud, replaces Dropbox; Immich, replaces Google Photos; Penpot, replaces Figma.
- **60 tour** 61.2 s (1.2 s over the slot), 110 words: all 7 shots in order, sentences kept 2,1,2,2,2,2,3, one beat every 7 s. Names: Nextcloud, replaces Dropbox; Immich, replaces Google Photos; Penpot, replaces Figma; Invoice Ninja, replaces FreshBooks; Docuseal, replaces DocuSign; Open WebUI.

### 3.10 The Contractor (`contractor`)

**Lead Kunle.** A self-employed tradesperson: the work all day, the firm from the garage bench at night. Comfort 3 of 5; AI pragmatic. **Tone:** pace 135 to 145 wpm, 0.4 s after each key noun; sentences 6 to 12 words, mean nine; humour wry about paperwork and clients who remember the quote differently. Owns: quote, change order, snag list, callback. Never: workflow, ecosystem, stack, easy, save.

**Hooks for the feed.**
- r/Construction [S] https://www.reddit.com/r/Construction/ (tone [?]: candid, funny, safety-aware): A seat fee for every pair of hands, and a way to count yours. "The quote is done by supper." (con-1).
- Mike Holt's Forum [V] https://forums.mikeholt.com/ (tone [?]: code-focused, formal register): The warranty card found the day after the warranty ended. "Where the drill is." (con-3).
- Matt Risinger, YouTube (the Build Show channel; a podcast of the same name is likely but unverified) [V] https://www.youtube.com/@BuildShow (tone [?]: craft first: hook before the first cut): The same wall, photographed twice, a date on both. "The same wall, twice." (con-2).

**AI.** Never first; the contractor fixes the draft. Chore: A job summary from site notes (no API bill). Words: "The model on the Core drafts the job summary. Kunle fixes it first." Absent: All other shots; never field work or pricing alone.

**Shots.**
- **con-1 hook** garage `room@garage, desk@office, counter` `medium/-/left/low` [small-business, alt money]. Dwell: Bench and tool wall at 6:30, a kettle. Card: **The quote is done by supper.** Kunle writes the quote at the bench, same evening. Invoice Ninja keeps the line items on the Core. Chips `Invoice Ninja` + `replaces QuickBooks`. Why: A trade is two jobs. Never: A van or ladder as hero.
- **con-2 chore** garage `room@garage, bicycle, core` `close/auto/front/low`. Dwell: The wall-hooks wall in raking light. Card: **The same wall, twice.** Immich keeps the wall before the plaster and after. Both photos sit on the Core, with the date on each. Chips `Immich` + `replaces Google Photos`. Note: Immich is not CompanyCam, and not a backup. Why: The proof the trade already trusts. Never: A client face, an address.
- **con-3 chore** garage `room@garage, laundry, core` `medium/left/left/low` [reviewed.json]. Dwell: Labelled crates on a shelf, one pulled forward. Card: **Where the drill is.** HomeBox lists the drill and when its warranty ends. Kunle stops guessing at the counter. Chips `HomeBox` + `replaces Sortly`. Why: The warranty card found in time. Never: A tool brand, a barcode screen.
- **con-4 chore** office `desk@office, dining-table, counter` `medium/right/front/seated` [small-business, alt productivity]. Dwell: A quote and change order clipped together. Card: **Quote and change order, together.** Docuseal keeps the quote and change order together. The March agreement is in one place. Chips `Docuseal` + `replaces DocuSign`. Note: Signers outside the home need outside reach. Why: The argument every contractor has had. Never: The words legally binding.
- **con-5 ai** office `desk@office, dining-table, counter` `close/-/above/seated`. Dwell: Site notes with a pencil across them. Card: **Site notes, drafted as a summary.** Kunle pastes the site notes into Open WebUI. The model on the Core drafts the job summary. Kunle fixes it first. Chips `Open WebUI` + `replaces ChatGPT`. Why: The admin chore a trade dislikes most. Never: Pricing alone, field work.
- **con-6 bring-home** garage `core, room@garage` `medium/right/front/low`. Dwell: The Core on a garage shelf by the router. Card: **A year of quotes, moved.** Kunle exports the client list and invoices. Invoice Ninja takes them in as spreadsheets. The books stay with the accountant. Chips `Invoice Ninja` + `replaces QuickBooks`. Why: Spreadsheets in; the accountant keeps the books. Never: Tax ready, a crew reaching it.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.6 s. Hook "The quote is done by supper." · (con-1) Kunle writes the quote at the bench, same evening. · (con-3) HomeBox lists the drill and when its warranty ends. · end card. Names: Invoice Ninja, replaces QuickBooks; HomeBox, replaces Sortly.
- **15B** 15.6 s. Hook "Where the drill is." · (con-3) HomeBox lists the drill and when its warranty ends. · (con-2) Immich keeps the wall before the plaster and after. · end card. Names: HomeBox, replaces Sortly; Immich, replaces Google Photos.
- **15C** 15.2 s. Hook "The same wall, twice." · (con-2) Immich keeps the wall before the plaster and after. · (con-4) Docuseal keeps the quote and change order together. · end card. Names: Immich, replaces Google Photos; Docuseal, replaces DocuSign.
- **30** 31.5 s (1.5 s over the slot). Hook "The quote is done by supper." · (con-1) Kunle writes the quote at the bench, same evening. · (con-2) Immich keeps the wall before the plaster and after. · (con-5) Kunle pastes the site notes into Open WebUI. The model on the Core drafts the job summary. · (con-6) Kunle exports the client list and invoices. Invoice Ninja takes them in as spreadsheets. · end card. Names: Invoice Ninja, replaces QuickBooks; Immich, replaces Google Photos; Open WebUI, replaces ChatGPT.
- **60 tour** 59.0 s, 108 words: all 6 shots in order, sentences kept 2,2,2,2,3,3, one beat every 8 s. Names: Invoice Ninja, replaces QuickBooks; Immich, replaces Google Photos; HomeBox, replaces Sortly; Docuseal, replaces DocuSign; Open WebUI, replaces ChatGPT.

### 3.11 The Marketer (`marketer`)

**Lead Elena.** A digital marketer holding a client's list, files and briefs, and drafting from them. Comfort 3 of 5; AI pragmatic. **Tone:** pace 150 wpm, leave silence; sentences 6 to 12 words; humour one beat, about the job. Owns: CTR, deliverability, UTM, flows. Never: synergy, thought leader, game-changer, 10x.

**Hooks for the feed.**
- Superpath (content marketers, Slack) [V] https://superpath.co (tone [?]: conversational: learn and share): The client's list, and the question where it lives. "The client's list, at home." (mkt-1).
- Measure Slack (digital analytics) [V] https://measure.chat (tone [?]: informal: jokes welcome): The call, transcribed, and where the audio went. "The client call, transcribed." (mkt-4).
- Demand Curve (The Frontier newsletter and community) [V] https://www.demandcurve.com (tone [?]: casual: proof, not promises): Version history as the proof a client asks for. "Campaign files keep their history." (mkt-3).

**AI.** Never first; she edits and approves. Chore: The brief through a model; a call through Whisper-WebUI. Words: "Elena edits and approves every line." Absent: All other shots; no better-copy or time-saved claim.

**Shots.**
- **mkt-1 hook** office `desk@office, kitchen-island, counter` `medium/left/front/seated` [small-business, alt productivity]. Dwell: A wall of paper cards as a calendar. Card: **The client's list, at home.** Elena sends the campaigns from a list in Ghost. The list sits on the Core, not in a rented service. Chips `Ghost` + `replaces Mailchimp`. Note: Sending email needs an outside mail service. Why: The client's list is her asset. Never: A readable chart, logos as decoration.
- **mkt-2 ai** office `desk@office, dining-table, counter` `close/-/above/seated` [small-business, alt privacy]. Dwell: A red pen on a printed brief. Card: **The brief stays on the desk.** Elena puts the brief through Open WebUI. The model runs on the Core, beside the desk. Elena edits and approves every line. Chips `Open WebUI` + `replaces ChatGPT`. Why: A chore on NDA material; she approves. Never: A readable screen, a better-copy claim.
- **mkt-3 chore** dining `dining-table, desk@office, counter` `medium/auto/front/seated`. Dwell: Printed proofs on the dining table. Card: **Campaign files keep their history.** Penpot keeps the campaign files and their history. Elena opens them in a browser tab on the Core. Chips `Penpot` + `replaces Figma`. Note: No Figma importer was found. Why: Version history is what clients ask about. Never: A Figma frame, a vendor accusation.
- **mkt-4 chore** office `desk@office, counter, room@office` `close/-/front/seated` [reviewed.json]. Dwell: A headset on a notebook (to author); a mug. Card: **The client call, transcribed.** Elena runs the client call through Whisper-WebUI. The audio goes to the Core, not to a transcription site. Chips `Whisper-WebUI`. Note: Whisper-WebUI downloads its model first. Why: Calls are where details get said aloud. Never: A transcript on screen.
- **mkt-5 chore** office `bookshelf@office, desk@office, room@office` `medium/right/front/standing` [small-business, alt productivity]. Dwell: Labelled folders beside campaign books. Card: **Each client gets one folder.** Nextcloud holds Elena's deliverables on the Core. Drafts and final files sit in one folder per client. Chips `Nextcloud` + `replaces Dropbox`. Note: Clients outside the home cannot reach it. Why: Offboarding a client is a folder. Never: A client name, a rented-drive logo.
- **mkt-6 bring-home** office `core, bookshelf@office, desk@office` `wide/auto/front/-` [small-business, alt productivity]. Dwell: The Core on a shelf beside the campaign books. Card: **Subscribers move, history stays.** Elena exports the subscribers and imports them into Ghost. Campaign history and sending reputation stay behind. Chips `Ghost` + `replaces Mailchimp`. Why: A list moves; a reputation does not. Never: A deliverability promise, a sender score.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.0 s. Hook "The client's list, at home." · (mkt-1) Elena sends the campaigns from a list in Ghost. · (mkt-5) Nextcloud holds Elena's deliverables on the Core. · end card. Names: Ghost, replaces Mailchimp; Nextcloud, replaces Dropbox.
- **15B** 15.5 s. Hook "The client call, transcribed." · (mkt-4) Elena runs the client call through Whisper-WebUI. · (mkt-2) Elena puts the brief through Open WebUI. · end card. Names: Whisper-WebUI; Open WebUI, replaces ChatGPT.
- **15C** 15.2 s. Hook "Campaign files keep their history." · (mkt-3) Penpot keeps the campaign files and their history. · (mkt-6) Elena exports the subscribers and imports them into Ghost. · end card. Names: Penpot, replaces Figma; Ghost, replaces Mailchimp.
- **30** 31.1 s (1.1 s over the slot). Hook "The client's list, at home." · (mkt-1) Elena sends the campaigns from a list in Ghost. · (mkt-2) Elena puts the brief through Open WebUI. The model runs on the Core, beside the desk. · (mkt-4) Elena runs the client call through Whisper-WebUI. · (mkt-6) Elena exports the subscribers and imports them into Ghost. Campaign history and sending reputation stay behind. · end card. Names: Ghost, replaces Mailchimp; Open WebUI, replaces ChatGPT; Whisper-WebUI.
- **60 tour** 59.8 s, 111 words: all 6 shots in order, sentences kept 2,3,2,2,2,2, one beat every 8 s. Names: Ghost, replaces Mailchimp; Open WebUI, replaces ChatGPT; Penpot, replaces Figma; Whisper-WebUI; Nextcloud, replaces Dropbox.

### 3.12 The Lawyer (`lawyer`)

**Lead Ingrid.** A solo or small-firm attorney who wants a mechanism she can explain in two sentences. Comfort 3 of 5; AI split. **Tone:** pace 140 to 150 wpm, silence before the limit; sentences 8 to 16 words, none over 20; humour understated; allergic to promises. Owns: matter, engagement letter, exhibit, redline. Never: game-changer, supercharge, disrupt, privileged.

**Hooks for the feed.**
- Lawyerist (site, Lawyerist Lab, weekly podcast) [V] https://lawyerist.com (tone [?]: practical, for solos and small firms): The question a client asks, answered with a location. "Where the client file sits." (law-1).
- Legal Talk Network [V] https://www.legaltalknetwork.com (tone [?]: professional: AI has its own shows): A mechanism she can explain in two sentences. "The folders come home." (law-3).
- Above the Law [V] https://abovethelaw.com (tone [?]: dry and irreverent: short headlines): A signature at the desk, a PDF on the Core. "A signature at the desk." (law-2).

**AI.** Never the headline; she reads the source. Chore: A first summary of a transcript, read line by line. Words: "A draft only. Ingrid checks every cite." Absent: All other shots; never accuracy, parity or privileged.

**Shots.**
- **law-1 hook** office `desk@office, bookshelf@office, dining-table, room@office` `medium/auto/behind/seated` [small-business, alt productivity]. Dwell: Binders and a legal pad (to author). Card: **Where the client file sits.** Paperless-ngx reads the stack of client pages. Ingrid finds the exhibit by a word on the page. Chips `Paperless-ngx` + `replaces Google Drive`. Why: The first question a client asks, answered. Never: Scales, a gavel, a case number.
- **law-2 chore** office `desk@office, dining-table, room@office` `medium/right/behind/seated` [small-business, alt productivity]. Dwell: A pen on an engagement letter. Card: **A signature at the desk.** The engagement letter is signed at the desk. Docuseal holds the PDF on the Core, beside the client's folder. Chips `Docuseal` + `replaces DocuSign`. Note: Signers outside the office need outside reach. Why: Signed in person; kept in the office. Never: The words legally binding.
- **law-3 bring-home** office `core, bookshelf@office, desk@office` `medium/left/front/standing` [small-business, alt privacy]. Dwell: The Core between two binders; daylight on the spines. Card: **The folders come home.** Ingrid imports the client folders into Nextcloud. They sit on the Core, on a shelf in the office. Share links do not carry over. Chips `Nextcloud` + `replaces Dropbox`. Why: A client asks; she can point. Never: A padlock, a render.
- **law-4 ai** office `desk@office, dining-table, room@office` `close/-/behind/seated`. Dwell: A pencil moving down a printed transcript. Card: **The model drafts. Ingrid signs.** A model on the Core drafts the first summary. Ingrid reads the transcript, line by line, before anything goes in a letter. Chips `Open WebUI` + `replaces ChatGPT`. Note: A draft only. Ingrid checks every cite. Why: The model drafts; the person signs. Never: A chat window, an invented answer.
- **law-5 chore** dining `dining-table, desk@office, room@dining` `medium/left/front/seated` [reviewed.json]. Dwell: A paper wall calendar and a diary. Card: **Hearings in one calendar file.** Radicale holds Ingrid's calendar as a file. The calendar exports as a file, so it can move again. Sharing does not carry over. Chips `Radicale` + `replaces Google Calendar`. Why: Every January the subscriptions get counted. Never: A court name, a docket number.
- **law-6 chore** office `desk@office, bookshelf@office, room@office` `close/-/above/seated` [small-business, alt productivity]. Dwell: Printed exhibits fanned on the desk. Card: **Exhibits merged into one file.** Ingrid merges the exhibits with Stirling-PDF. The merge happens on the Core. Every page is still checked by eye. Chips `Stirling-PDF` + `replaces Adobe Acrobat`. Why: A concrete chore with the check named. Never: Redaction is complete.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.0 s. Hook "Where the client file sits." · (law-1) Paperless-ngx reads the stack of client pages. · (law-4) A model on the Core drafts the first summary. · end card. Names: Paperless-ngx, replaces Google Drive; Open WebUI, replaces ChatGPT.
- **15B** 15.3 s. Hook "The folders come home." · (law-3) Ingrid imports the client folders into Nextcloud. · (law-6) Ingrid merges the exhibits with Stirling-PDF. · end card. Names: Nextcloud, replaces Dropbox; Stirling-PDF, replaces Adobe Acrobat.
- **15C** 15.1 s. Hook "A signature at the desk." · (law-2) The engagement letter is signed at the desk. · (law-5) Radicale holds Ingrid's calendar as a file. · end card. Names: Docuseal, replaces DocuSign; Radicale, replaces Google Calendar.
- **30** 28.3 s. Hook "Where the client file sits." · (law-1) Paperless-ngx reads the stack of client pages. Ingrid finds the exhibit by a word on the page. · (law-2) The engagement letter is signed at the desk. · (law-3) Ingrid imports the client folders into Nextcloud. · (law-4) A model on the Core drafts the first summary. · end card. Names: Paperless-ngx, replaces Google Drive; Docuseal, replaces DocuSign; Nextcloud, replaces Dropbox; Open WebUI, replaces ChatGPT.
- **60 tour** 62.6 s (2.6 s over the slot), 118 words: all 6 shots in order, sentences kept 2,2,2,2,3,3, one beat every 8 s. Names: Paperless-ngx, replaces Google Drive; Docuseal, replaces DocuSign; Nextcloud, replaces Dropbox; Open WebUI, replaces ChatGPT; Radicale, replaces Google Calendar; Stirling-PDF, replaces Adobe Acrobat.

### 3.13 The Journalist (`journalist`)

**Lead Noor.** A reporter holding tapes, notes and records, who asks where a file lives before anyone else. Comfort 3 of 5; AI split. **Tone:** pace 145 to 155 wpm, a pause before any number; sentences 8 to 14 words, cap 20; humour an understated aside, no puns. Owns: source, on the record, tape, verify. Never: game-changer, unlock, bulletproof, secure.

**Hooks for the feed.**
- IRE and NICAR-L (listserv, Slack channels, local meetups) [V] https://www.ire.org/ (tone [?]: tool-sharing is normal): The tape, and the sentence where it sits tonight. "Transcribe the interview, keep it." (jou-1).
- The Open Notebook [V] https://www.theopennotebook.com/ (tone [?]: generous and practical): Eighty pages and one question, answered by a word. "Eighty pages, one question." (jou-3).
- Freedom of the Press Foundation digital security [V] https://freedom.press/digisec/ (tone [?]: educational, not alarmist): What the Core is not, said first. "Sources choose the channel." (jou-6).

**AI.** Transcription opens; the model only points. Chore: A recording to text; a pointer to a page. Words: "It points to a page. Noor reads the page." Absent: Notes, records, links and the Core; never AI writing a byline.

**Shots.**
- **jou-1 hook** dining `dining-table, desk@office, room@dining` `medium/left/front/seated` [reviewed.json]. Dwell: A handheld recorder (to author) by a notebook. Card: **Transcribe the interview, keep it.** Whisper-WebUI turns the interview into text on the Core. Noor finishes at the kitchen table. Noor checks every quote against the audio. Chips `Whisper-WebUI`. Note: Whisper-WebUI downloads its model first. Why: A source's recording; it sits here. Never: Outlet logos, seizure drama.
- **jou-2 chore** office `desk@office, bookshelf@office, dining-table, room@office` `medium/right/front/seated`. Dwell: A shelf of notebooks, a ribbon marker. Card: **Notes as plain files.** Noor keeps the story notes in Obsidian. They are plain Markdown files on the Core. If the app changes, the folder comes along. Chips `Obsidian` + `replaces Evernote`. Why: Notes outlive the tool. Never: An open-source claim, a story title.
- **jou-3 chore** office `desk@office, bookshelf@office, room@office` `close/-/above/seated`. Dwell: A hand flattening a printed records packet. Card: **Eighty pages, one question.** Records arrive as paper, and Paperless-ngx reads them. Noor finds the paragraph by a word on it. Chips `Paperless-ngx` + `replaces Google Drive`. Why: Records are evidence; paper becomes searchable. Never: A legible record, a case number.
- **jou-4 ai** office `desk@office, room@office` `close/-/behind/seated`. Dwell: A finger on a printed page. Card: **The model finds. Noor reads.** Noor asks Open WebUI which page mentions the contract. A model on the Core points to a page. Noor reads the page. Chips `Open WebUI` + `replaces ChatGPT`. Note: A pointer only. Verify against the page. Why: The model points; the reporter verifies. Never: A chat window, a model-written quote.
- **jou-5 bring-home** dining `dining-table, desk@office, room@dining` `medium/auto/front/seated`. Dwell: Clipped articles and a mug on the table. Card: **Saved sources, kept as pages.** Noor imports the saved links into Linkwarden. Each page is kept on the Core, beside its link. Chips `Linkwarden` + `replaces Raindrop.io`. Why: A dead link ends nothing. Never: A browser window, a headline.
- **jou-6 core** office `core, bookshelf@office, desk@office` `wide/auto/front/-`. Dwell: The Core in daylight, a notebook leaning against it. Card: **Sources choose the channel.** Sources choose how they talk to Noor. Their messages stay in whatever app they pick. The Core holds the tape and the notes. Note: The Core is not a vault. Why: The honest edge: sources pick the channel. Never: Source protection, immunity, a vault.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.2 s. Hook "Transcribe the interview, keep it." · (jou-1) Whisper-WebUI turns the interview into text on the Core. · (jou-3) Records arrive as paper, and Paperless-ngx reads them. · end card. Names: Whisper-WebUI; Paperless-ngx, replaces Google Drive.
- **15B** 15.1 s. Hook "Eighty pages, one question." · (jou-3) Records arrive as paper, and Paperless-ngx reads them. · (jou-5) Noor imports the saved links into Linkwarden. · end card. Names: Paperless-ngx, replaces Google Drive; Linkwarden, replaces Raindrop.io.
- **15C** 15.5 s. Hook "Sources choose the channel." · (jou-6) Sources choose how they talk to Noor. · (jou-2) Noor keeps the story notes in Obsidian. · end card. Names: Obsidian, replaces Evernote.
- **30** 31.5 s (1.5 s over the slot). Hook "Transcribe the interview, keep it." · (jou-1) Whisper-WebUI turns the interview into text on the Core. · (jou-3) Records arrive as paper, and Paperless-ngx reads them. · (jou-4) Noor asks Open WebUI which page mentions the contract. · (jou-6) Sources choose how they talk to Noor. Their messages stay in whatever app they pick. The Core holds the tape and the notes. · end card. Names: Whisper-WebUI; Paperless-ngx, replaces Google Drive; Open WebUI, replaces ChatGPT.
- **60 tour** 61.8 s (1.8 s over the slot), 116 words: all 6 shots in order, sentences kept 3,2,2,3,2,3, one beat every 8 s. Names: Whisper-WebUI; Obsidian, replaces Evernote; Paperless-ngx, replaces Google Drive; Open WebUI, replaces ChatGPT; Linkwarden, replaces Raindrop.io.

### 3.14 The Educator (`educator`)

**Lead Eszter.** A teacher, tutor or homeschooling parent: lesson folders, handouts, report comments. Comfort 3 of 5; AI pragmatic. **Tone:** pace 140 to 150 wpm, a beat after each sentence; sentences 8 to 14 words, never past 20; humour gallows; protective of the children. Owns: scheme of work, rubric, exit ticket. Never: digital natives, AI-powered, saves you hours.

**Hooks for the feed.**
- Truth for Teachers community and Facebook group [V] https://www.truthforteachers.com/ (tone [?]: practical, no hype): The Sunday pile, and the one place it goes. "The Sunday pile gets a home." (edu-1).
- Tes community (UK) [V] https://www.tes.com/community (tone [?]: professional, safeguarding-minded): Lesson materials in a folder, not a bag. "Lesson folders in one place." (edu-4).
- Teacher Tapp (England) [V] https://teachertapp.com/ (tone [?]: peers' numbers come first): What the school keeps, said before what the Core does. "The school keeps the gradebook." (edu-6).

**AI.** Never first; she rewrites every line. Chore: Report comments from her rubric, rewritten by hand. Words: "Eszter rewrites every comment by hand." Absent: All other shots; never grading, ranking or an hours figure.

**Shots.**
- **edu-1 hook** dining `dining-table, desk@office, room@dining` `medium/left/above/seated`. Dwell: The Sunday pile in low sun, a red pen. Card: **The Sunday pile gets a home.** Paperless-ngx takes Eszter's handouts on the Core. Eszter marks at the dining table on Sunday. Chips `Paperless-ngx` + `replaces Evernote`. Note: The school keeps the gradebook. Why: Six lessons a day, then the pile. Never: A class list, a child's name.
- **edu-2 ai** dining `dining-table, desk@office, room@dining` `close/-/above/seated`. Dwell: A hand crossing out a draft sentence. Card: **Report comments, rewritten by hand.** A model on the Core drafts each report comment. It starts from the rubric. Eszter rewrites every comment by hand. Chips `Open WebUI` + `replaces ChatGPT`. Note: A draft only. The teacher decides. Why: The paperwork, never the child. Never: Grading, ranking, a child's name.
- **edu-3 chore** office `desk@office, bookshelf@office, room@office` `medium/right/front/seated`. Dwell: A folded note in another script. Card: **A parent's note, translated.** A parent writes in another language. LibreTranslate reads the note on the Core. Eszter checks the reply the same way. Chips `LibreTranslate` + `replaces Google Translate`. Note: School data rules come first. Why: Parents write in many languages. Never: A claim about translation quality.
- **edu-4 chore** dining `dining-table, bookshelf, room@dining` `wide/auto/front/seated` [with libreoffice]. Dwell: Lesson folders on a shelf; worksheets in a stack. Card: **Lesson folders in one place.** Nextcloud holds Eszter's lesson folders on the Core. Worksheets are written in LibreOffice. Chips `Nextcloud` + `replaces Google Drive`. Note: Class lists and grades stay with the school. Why: The teacher's own materials in one home. Never: A class list, a grade.
- **edu-5 bring-home** office `desk@office, bookshelf@office, room@office` `close/-/above/seated`. Dwell: Old notebooks with coloured tabs, stacked. Card: **Years of notes, moved once.** Eszter imports the old notebooks into Joplin Server. Titles and text carry over. Some formatting may not. Chips `Joplin Server` + `replaces Evernote`. Why: Years of notes, with the loss named. Never: A note title, a pupil's name.
- **edu-6 core** dining `core, bookshelf, room@dining` `wide/auto/front/-`. Dwell: The Core on a shelf in the dining room. Card: **The school keeps the gradebook.** The school keeps the gradebook and class lists. The Core holds Eszter's own lesson files. Why: The honest edge first. Never: A compliance claim, a school logo.

**Scripts** (captions are card sentences; the end card is fixed; Names lists each Hub app and the service its chip row replaces).
- **15A** 15.0 s. Hook "The Sunday pile gets a home." · (edu-1) Paperless-ngx takes Eszter's handouts on the Core. · (edu-2) A model on the Core drafts each report comment. · end card. Names: Paperless-ngx, replaces Evernote; Open WebUI, replaces ChatGPT.
- **15B** 15.1 s. Hook "Lesson folders in one place." · (edu-4) Nextcloud holds Eszter's lesson folders on the Core. · (edu-1) Paperless-ngx takes Eszter's handouts on the Core. · end card. Names: Nextcloud, replaces Google Drive; Paperless-ngx, replaces Evernote.
- **15C** 15.0 s. Hook "The school keeps the gradebook." · (edu-6) The school keeps the gradebook and class lists. · (edu-5) Eszter imports the old notebooks into Joplin Server. · end card. Names: Joplin Server, replaces Evernote.
- **30** 31.5 s (1.5 s over the slot). Hook "The Sunday pile gets a home." · (edu-1) Paperless-ngx takes Eszter's handouts on the Core. · (edu-2) A model on the Core drafts each report comment. · (edu-3) A parent writes in another language. LibreTranslate reads the note on the Core. · (edu-6) The school keeps the gradebook and class lists. The Core holds Eszter's own lesson files. · end card. Names: Paperless-ngx, replaces Evernote; Open WebUI, replaces ChatGPT; LibreTranslate, replaces Google Translate.
- **60 tour** 57.4 s, 106 words: all 6 shots in order, sentences kept 2,3,3,2,3,3, one beat every 8 s. Names: Paperless-ngx, replaces Evernote; Open WebUI, replaces ChatGPT; LibreTranslate, replaces Google Translate; Nextcloud, replaces Google Drive; Joplin Server, replaces Evernote.

## 4. Casting notes for the 36 homes

Display names only on public surfaces; ids are crew-only. "Business" is the casting flag behind the small-business quota; "no flag" households may carry two small-business beats.

**Rules that govern every note** (added by the skeptic pass; checked by script against the 36 specs on 2026-10-19).

1. **A note's room wins.** The chain printed with each shot is the default; a note that names a room overrides it. Set the chain's `@room` to the role of the named room, read off its name by `roles.json`, and keep a fallback. With the chains as printed now, all 237 assignments below resolve to something; 23 fall to a bare room centre with no prop (an easel in a kids' room, a desk that is the Core's) and are covered by the room the note names.
2. **Titles and bodies must be unique across the fleet.** `fleet-unique` is an error in every run: no beat title outside the first-run chapter and no beat body may repeat in any two homes. The cards in section 3 are patterns, not text to paste. The notes below use 54 of the 86 shots, 237 times; 43 of those shots are used in two or more homes, and for 41 the title carries no name, so 221 beats would repeat a title. Org-1, org-3 and bld-1 are wanted in 16 homes each, hst-1 to hst-3 in 11 each. Write each home's own title and body (keep the chore, the app, the limit and the order of the sentences; change the object and the wording; put the cast member's name in the title). Three flagship homes share one cast: their bodies must differ too. The lead's name already separates most bodies; hst-1 to hst-4, cre-5, con-2, con-4 and law-2 carry no name and need a rewrite.
3. **Fleet app cap.** At 36 homes no third-party app may sit in more than 14 (40%). Taken literally, the notes put Paperless-ngx in 26 homes, Nextcloud in 24, Gitea in 16, Open WebUI in 15 and LibreTranslate in 15. Rotate the first-choice shot with the persona's other app shots (each persona has three to six) until each app is at 14 or fewer.
4. **One of a kind per household.** One Git host (Forgejo or Gitea) per household, one chat front end (Open WebUI or AnythingLLM), one office suite. Split-Level Family House has John on both hosts: its watch line fixes it.
5. **Under 13.** Twelve learners (6 to 12) and three makers (6 to 8) in the cast are under 13. Their shots are parent-led reading: no chat-model beat (lrn-2, gmr-4), no French paragraph under 10, no child at an app on screen. Under 10 the learner shot is lrn-3 or lrn-6, with a parent in frame.
6. **Casting skew.** By given name (a heuristic: names do not fix a gender), all seven gamers and all three tech-family leads read as male, all three lawyers and all three marketers as female, and 12 or 13 of 14 organisers as female. The cards are name-swappable and gender-neutral; swapping a name is safe. Decide in casting whether to recast one lead per persona (bible section 6, item 13).

- **Seraphine** (`seraphine`; flagship, business). Sally: org-1, 2, 3, 5 in the Library. John: bld-1 to 3 at the Master Suite desk. Steve: gmr-1 in the Boy's Room, gmr-2 at the Living Room TV. Jean: lrn-1 to 4 at the Girl's Room desk. Watch: No easel or laundry; the Nursery is never a stage.
- **Stone Gable House** (`bgfamily`; flagship, business). Sally and John share the Front Study's two desks: org-1, 3 and bld-1, 2. Steve: gmr-1 in the Kids Room, gmr-2 at the Living Room TV. Jean: lrn-1, 4 at the Kids Room desk. Watch: The Core's Study holds a toddler bed: frame shelf and desk only. No island, so org-2 uses the counter.
- **Split-Level Family House** (`familyhouse-nora`; flagship, business). Sally: org-1, 3 in the Craft Room. John, the native tech-family stage: tf-4 at the Garage bench, bld-1, 2 at the Craft Room desk. Steve: gmr-2 at the Den TV. Jean: lrn-1 at the Kids Bedroom desk. Watch: The fleet's only whiteboard is in Kitchen & Dining. No driveway or island. One Git host per household: John's tf-4 names Forgejo, so name Forgejo on bld-1 and bld-2 here (swap the app id, chip and body).
- **Modern Asymmetry House** (`asymmetry`; business). Folake: org-1 at the Green Bedroom desk, org-3 on the Living credenza. Kunle: con-1 to 3 at the Garage bench, con-4 at the Dining table. Tobi: gmr-1 in the Loft Bedroom. Ife: lrn-1 at the Green Bedroom desk (stagger with org-1). Watch: No TV, shelf, easel or music item; the Laundry is free for con-3.
- **Mediterranean Villa** (`mediterranean`; no flag). Eszter: edu-1, 2, 4 at the Dining Room trestle table, edu-6 on the Salon shelf. Gabor: bld-1 at the Games Den table. Bence: gmr-2 at the TV Room. Reka: lrn-1 at the West Bedroom. Watch: No desk beyond the Core's shelf, no island; the piano stands in the Stair Hall.
- **Epiphany** (`epiphany`; business). Dalia: cre-1, 2, 3, 6 in the Den, cre-5 at the Dining Room table. Samir: tf-4 at the Garage bench, tf-2 on the Lounge couch. Yasmin: lrn-1 in Bedroom Two. Watch: No TV, easel or driveway; the Den desk is the Core's.
- **Villa Mesa Mariposa** (`mesamariposa`; business). Meenakshi: org-1, 3 at the Conservatory Dining table, org-2 at the counter. Ravi: cre-1, 5 there, cre-2 beside the record player. Arjun: gmr-1 at the Kids' Room desk. Kavya: lrn-1, from the other side. Watch: No TV, island or shelf; garage and driveway are free.
- **The Mirage** (`mirage`; no flag). Hana: org-1 at the Reading Loft shelf, org-3 with the Core on the breakfast bar. Dawit: bld-1 at the Loggia Dining table. Selam: lrn-1 at the Stair Landing shelf. Bruk: mkr-1, 2 at the upright piano. Watch: No desk, TV, island or driveway.
- **Modern Studio House** (`modernhouse1`; no flag). Claire: org-1, 3 in the Library Lounge, org-2 at the Kitchen island; as a lawyer, law-1 at the Dining Room table. Etienne: bld-1 at the Dining Room table. Hugo: gmr-1 and Lea: lrn-1, both at the Kids Room desk. Watch: Only one desk; no TV, easel or music item.
- **Cocoon** (`cocoon`; no flag). Marisol: org-1, 3 in the Living Room. Andres: tf-1 in the Foyer, tf-4 at the Garage bench, tf-2 in the Den. Camila: lrn-1 at the Kids Room desk. Mateo, seven: mkr-1 at the Kids Bedroom easel, as a parent-led scene. Watch: No music item, so mkr-2 uses the couch; the Den TV carries tf-5.
- **Black Tower Modern** (`modernhome-nora`; no flag). Linh: org-1 in Kitchen & Dining, org-3 on the Living Room credenza. Duc: bld-1 at the Dressing Room desk, or tf-4 in the Garage. Mai: lrn-1, 3 at the Kids' Room desk. Bao, eight: mkr-1 as a parent-led scene. Watch: Mai is 11: no chat-model beat (lrn-2). No TV, shelf or easel.
- **Palm Knoll** (`palnknoll`; no flag). Minjung: edu-1, 2 at the Dining table, edu-4 at the Study desk, edu-6 on the Living Room credenza. Jiho: bld-1 at the Study desk, bld-6 in the Undercroft. Yuna, eight: lrn-3 at the Kids Room shelf, parent-led. Watch: No TV, easel or driveway; avoid the gaming chair.
- **Garden Nook** (`gardennook`; no flag). Wanjiru: bld-1 at the Dining table, bld-2 on the Living Room console. Juma: hst-1, 2 at the Kitchen counter, hst-3 at the fridge, hst-4 at the front door. Watch: Never invent a desk; no TV, island or driveway.
- **Lake Cabin** (`lakecabin`; no flag). Noor: jou-1 at the Dining table; jou-2, 3, 4, 6 in the Study (the Core's desk, shelf, easel). Imran: hst-1 to 3 at the Kitchen island and fridge. Watch: No second desk, driveway or music; the Nursery is never a stage.
- **Newcrest House** (`newcrest`; no flag). Elena: mkt-1 at the Loft desk, mkt-2, 4 at the Living Room desk, mkt-3 at the Dining table, mkt-6 on the Kitchen shelf. Nikolai: hst-1 to 3 at the island. Watch: Not flagged business: use altCategory on mkt-1, 2, 5, 6. No driveway.
- **Grey Starter Cottage** (`starter18k`; no flag). Beatriz: org-1, 3 at the Dining table, org-5 on the couch. Tiago: hst-1 to 3 at the Kitchen island. Leo, six: lrn-3 at the Kids Zone, parent-led. Watch: No office; the Family Bedroom desk is the Core's alone.
- **Yellow Family Home** (`familyhome`; business). Hannah, a practice of one: org-1, 3 at the Living Room console and the Dining Room table. Callum: hst-1 to 3 at the Kitchen island. Nell, seven: lrn-3 at the Kids' Bedroom desk, parent-led. Watch: No TV (couch film night) or driveway; the Wrap Porch easel is outdoors.
- **Twin Gable House** (`bghouse-olcia`; business). Araxi: edu-1, 2 at the Living & Dining trestle table, edu-6 on the Study desk. Hagop: bld-1 in the Study. Nare: lrn-1 at the Family Room shelf. Watch: No desk beyond the Core's; the Garage bench and driveway are free.
- **Cute Starter Cottage** (`cutestarter`; no flag). Ngozi: org-1, 3 at the Dining table. Emeka: hst-1 to 3 at the Kitchen counter. Chidi, eight: lrn-3 at the Kids Corner shelf, parent-led. Watch: No desk, island or driveway; the only TV is in the bedroom.
- **Blue Dormer Cottage** (`onestory`; no flag). Willem: org-1, 3 at the Dining Room table; as a tutor, edu-1 there. Greet: hst-1 to 3 at the Kitchen island. Joris: lrn-1 at the Fireside Nook shelf. Watch: No desk, TV or fireplace item; do not write a fireplace.
- **Riverbend Drive** (`riverbend`; no flag). Emi: con-1 to 3 in the Two-Car Garage, con-4 at the Bedroom Two desk, con-6 on the Family Room credenza. Yoshiko: hst-1 to 3. Haruo: mkr-2 at the record player. Kenji, nine: lrn-3 at the Bedroom Three desk, parent-led. Watch: Not flagged business: flip it for Emi or use altCategory on con-1, 4. No TV or island.
- **Aurora** (`aurora`; business). Ingrid: law-1, 6 in the ground-floor Study, law-2, 4 at the Study@l2 desk, law-5 at the Dining table. Mats: bld-1, 2 at the other Study@l2 desk, bld-6 with the Core. Watch: Write Study@l1 and Study@l2. No music or fireplace.
- **Modern Pavilion** (`modernhouse-nora`; business). Parisa: org-1, 3 at the Desk Hall desk, org-2 at the Kitchen counter. Kian: edu-1, 2 at the Dining table, edu-6 with the Core at the Desk Hall. Watch: The Core's desk is the only desk; no shelf or easel.
- **Payorote** (`payorote`; business). Valeria: cre-1, 3, 4 in the Dressing Loft, cre-2 on the Living & Hearth couch, cre-5 at the counter. Rafael: bld-1 at the Sleeping Nook & Study desk. Watch: No dining table, island, shelf or driveway.
- **Sunny Home** (`sunnyhome`; business). Ruth: bo-1, 3, 6 at the Dining trestle table, bo-2 on the Library Lounge credenza, bo-4 at the Kitchen counter, bo-5 at the Upper Landing desk. Noam: bld-1 at the Loft shelf. Watch: No TV, island or driveway.
- **The Palms** (`palms`; business). Ananya: org-1, 3 at the Stair Study desk; the Core sits on the Living Room desk. Rohan: bld-1 at the Stair Study laptop, from the other side. Watch: No shelf or easel; the piano shares the Stair Study.
- **New Eco House** (`neweco`; business). Agnieszka: bo-1, 3 at the Breakfast Nook and Dining Room tables, bo-2 on the Sunroom Lounge shelf, bo-6 at the Bedroom 2 desk. Tomasz: tf-4 at the Garage bench, tf-1 on the Sunroom shelf. Watch: No TV, shelf or fireplace.
- **Flowery Cottage** (`flowerycottage`; business). Malia: cre-1, 3 in the Sunroom, cre-2 on the Living Room couch, cre-5 at the Dining Room table. Sione: con-1, 3 at the Garage bench, con-2 at the driveway, con-6 on the Study desk. Watch: The Core's desk is the only desk; no shelf or island.
- **Valley-View Villa** (`valleyview`; no flag). Jaswinder: org-1, 3 at the Reading Lounge shelf, org-2 at the Kitchen island. Harpreet: hst-1 to 3 at the island, hst-4 at the front door. Watch: The TV is in the hall only; no driveway or easel.
- **Vanilla House** (`vanilla`; business). Thandi: hst-1 to 3 in the Kitchen, hst-4 at the front door. Sipho: bld-1 at the Library desk, bld-2 at the Bedroom Three desk. Watch: No shelf, easel, fireplace or driveway; the Greenhouse carries plant beats.
- **Warehouse Loft** (`studio-loft`; no flag). Zainab: mkt-1, 2, 4 at the Desk & Workshop desk, mkt-5 on the Living Loft shelf. Joaquin: cre-1, 3 at the same bench, from the other side, cre-2 on the shelf. Watch: The only desk is the Core's; no dining table or TV. Two freelancers: set the business flag or use altCategory.
- **City One-Bedroom** (`city-one-bed`; business). Dara: bo-1, 2 at the Desk Nook, bo-4 at the Kitchen counter. Soraya: jou-1 on the Living Room couch, jou-2, 3, 4 at the Desk Nook. Watch: No dining table, island or TV. The Shops are empty scenery: frame the street.
- **Two-Bedroom Flat** (`two-bed-flat`; no flag). Lindiwe: mkt-1, 2, 4 at the Study Alcove in close framing, mkt-3 at the Dining Room table. Matthias: jou-1 at the Dining Room, jou-2, 3 at the Alcove, from the other side. Tomi, six: mkr-5 at the Kids' Room easel, as a parent-led scene. Watch: Not flagged business: altCategory on mkt-1, 2. No island or TV.
- **Corner Penthouse** (`corner-penthouse`; business). Esperanza: law-1, 4, 6 in the Office, law-3 with the Core on the Living Room console. Takumi: bo-1 at the Kitchen island, bo-2 at the Library Nook. Anselm: gmr-1 in Bedroom Two. Yara: lrn-1 at the Library Nook desk. Watch: No dining table or TV. The Corner Shop is empty scenery.
- **Garden Flat** (`garden-flat`; no flag). Winifred: law-1, 2 in the Study, law-4 at the Living & Dining table. Anwar: hst-1 to 3 at the Kitchen counter, hst-4 on the Garden Terrace. Petra, nine: lrn-3 at the Grandchild's Bedroom desk, parent-led. Watch: Petra gets no chat-model beat. Not flagged business. No island.
- **Walk-up Duplex** (`walkup-duplex`; no flag). Ferdinand: edu-1, 2, 4 at the Kitchen & Dining table, edu-5 at the Study Landing. Chinwe: bld-1, 2 at the Study Landing, bld-6 with the Core on the Living Room desk. Ayaan, thirteen: lrn-1, 3 in Bedroom Three. Dmitri, sixteen: gmr-1 in Bedroom Two. Watch: The Study Landing is tight: stagger the desks. No TV or easel.

## 5. Open items and what is not verified

1. **36 px in the live card.** The brief asks for it; `player.md` records pass 3 cutting it to 25.5 px at 768 px and wider, and keeps 36 design px for film and ad canvases. Decide which stands; the copy fits either.
2. **Chip grammar.** The contract is `replaces <X>`; story v3 wants `alternative to <X>`. The JSON uses `replaces`.
3. **Quotes.** The scripts are third-person captions. First-person adult quotes live only in the bible's Appendix B for voiced narration; ads.md allows none in a silent cut.
4. **30 and 60 second slots.** `story:ads` caps a cut at 25 s and the film is 90 s with a voice. By the engine's own arithmetic the 30 s scripts run 28.3 to 31.9 s and the tours 56.6 to 63.0 s: seven ads and six tours run more than a second past their slot (marked in section 3). The cap must be raised or the cut edited by hand; trim the last sentence that is not an honest limit.
5. **Apps with no QA screenshot** need a `reviewed.json` entry before a beat names them: Code Server, HomeBox, Mealie, Radicale, Whisper-WebUI.
6. **Props to author.** Scanner, receipt shoebox, recorder, binder, legal pad, headset, handwritten list, paperweight, stack of drives. No item type in the 36 specs is a van, ladder or toolbox; none is asked for.
7. **Business flags.** Riverbend, Newcrest, Warehouse Loft, Two-Bedroom Flat and Garden Flat carry a persona with small-business shots in a household not flagged business. Flip the flag (an owner decision) or use `altCategory`.
8. **Under-13.** Mai (11), Petra (nine) and Tomi (six) get no chat-model beat until the owner rules on the age of 13 [S, bible open question 9].
9. **Open WebUI is over the fleet cap** (17 of 30 homes). AI shots naming it can swap to AnythingLLM (chip is the name alone) or Hermes with its note: change the app id, chips and note only.
10. **Evidence was carried; the skeptic re-read part of it.** Hangout notes and tags come from the bible, where Reddit and several vendor pages refused reads. The appendix says which addresses answer today, not that their text was re-read. A skeptic pass re-read 62 of the bible's factual claims against the pages and corrected the ones that did not hold (`skeptic.md`). No hook formula has been tested on an audience.
11. **No frame has been rendered.** Anchors were resolved against `roles.json` and the specs by script, not through `story:bake`. Run `story:bake --stills` per home before a shoot.
12. **Uniqueness gate.** See section 4, rule 2: every use of a card needs its own title and body. No script here has been checked against `fleet-unique`.
13. **Fleet app cap.** See section 4, rule 3. The casting notes put five apps above 14 homes.
14. **Under-13 age fit.** See section 4, rule 5. Owner decision still open: the age of 13 for any chat model (bible, open question 9).
15. **Casting skew.** See section 4, rule 6. Owner decision.
16. **Engine fit not proved.** Chains were resolved by a port of `anchors.ts` and `roles.ts` written for the skeptic pass, not by `story:bake`; the 15 s scripts reach the 15 s floor by the engine's stretch rule, not by their own length.

## Appendix. Cited URLs and their status

HTTP result of a HEAD or GET on 2026-10-19 by this playbook; the skeptic pass repeated the check for the bible's 607 cited addresses (581 answer 200, 2 are dead, 22 are bot walls, 1 fails the certificate check, 1 answers 202) and found none of the playbook's addresses changed. A status says the address answers, not that its text was re-read; bot walls (403, 429) are reported as they came back.

- 200 https://www.mumsnet.com/talk/work
- 200 https://www.sba.gov/business-guide
- 200 https://www.linkedin.com/
- 200 https://news.ycombinator.com/
- 200 https://www.reddit.com/r/selfhosted/
- 200 https://lobste.rs/
- 200 https://www.youtube.com/
- 200 https://discord.com/
- 200 https://www.gamingonlinux.com/
- 200 https://www.tiktok.com/
- 200 https://forum.obsidian.md/
- 200 https://cara.app/
- 200 https://www.fredmiranda.com/forum/
- 200 https://www.mumsnet.com/talk
- 200 https://community.home-assistant.io/
- 200 https://www.rhs.org.uk/advice/grow-your-own
- 200 https://discourse.pi-hole.net/
- 403 bot wall https://lemmy.world/c/selfhosted
- 200 https://www.reddit.com/r/smallbusiness/
- 200 https://www.alignable.com
- 200 https://community.shopify.com
- 200 https://www.liftgammagain.com/forum/index.php
- 200 https://freelancersunion.org/
- 200 https://graphicartistsguild.org/
- 200 https://www.reddit.com/r/Construction/
- 200 https://forums.mikeholt.com/
- 200 https://www.youtube.com/@BuildShow
- 200 https://superpath.co
- 200 https://measure.chat
- 200 https://www.demandcurve.com
- 200 https://lawyerist.com
- 200 https://www.legaltalknetwork.com
- 200 https://abovethelaw.com
- 200 https://www.ire.org/
- 200 https://www.theopennotebook.com/
- 200 https://freedom.press/digisec/
- 200 https://www.truthforteachers.com/
- 200 https://www.tes.com/community
- 200 https://teachertapp.com/
- no answer (this machine cannot verify the site certificate; not bypassed) https://support.lastpass.com/s/document-item?language=en_US&bundleId=lastpass&topicId=LastPass%2Fexport-generic-csv.html&_LANG=enus
- 200 https://bitwarden.com/help/import-from-lastpass/
- 200 https://docs.github.com/en/get-started/archiving-your-github-personal-account-and-public-repositories/requesting-an-archive-of-your-personal-accounts-data
- 200 https://docs.gitea.com/usage/repository/migration/
- 200 https://support.google.com/photos/answer/3024190
- 200 https://github.com/simulot/immich-go
- 200 https://www.notion.com/help/export-your-content
- 200 https://obsidian.md/help/import
- 200 https://support.google.com/calendar/answer/37111
- 200 https://radicale.org/v3.html
- 200 https://support.plex.tv/articles/201154527-move-viewstate-ratings-from-one-install-to-another/
- 200 https://jellyfin.org/docs/general/server/libraries/
- no answer (connection closed by the site) https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US
- 200 https://invoiceninja.github.io/docs/advanced-topics/import-and-export
- 200 https://help.penpot.app/
- 200 https://mailchimp.com/help/view-export-contacts/
- 200 https://ghost.org/docs/migration/mailchimp/
- 200 https://help.dropbox.com/sync/download-entire-folders
- 200 https://github.com/nextcloud/integration_dropbox
- 200 https://help.raindrop.io/export
- 200 https://docs.linkwarden.app/usage/import-and-export
- 403 bot wall https://help.evernote.com/hc/en-us/articles/209005557-Export-notes-and-notebooks-as-ENEX-or-HTML
- 200 https://joplinapp.org/help/apps/import_export
