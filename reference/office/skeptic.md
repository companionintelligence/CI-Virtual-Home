# The /office plan, attacked (key `skeptic`)

> **Status: design only, stale versus main, not shipped.** Written 2026-10-19 and 2026-10-20 against PR #35's head (`a431fe6`), before the apartments, pass 2 and the lander reached main.
> Main has no `/office` page, no `company/v1` schema, no `use: "office"` spec field and none of the files this document calls new. Owner decisions **O2** (per-person accounts), **O4** (the label and fictional staff), **O6** (company names) and **O7** (naming services) gate any public showing, and counsel has cleared none of the company names or licence readings.
> Read it as the record of a design and its skeptic review, not as a contract for the tree. Directories in angle brackets (`<scratch>`, `<repo>`, `<office-worktree>`) stand for the author's local ones. See [`README.md`](README.md) in this folder for what was left out.

Read-only phase, 2026-10-19. Nothing in any repository was changed. I wrote only under `$W20` = `<scratch>/w20/`. Edited in place: `office-plan.md`, `office-build-contract.md`, `company-briefs/*.json` (nine files). Originals are in `skeptic/orig/`, my scripts in `skeptic/`. Every edit is listed in plan Appendix C.

## 0. The verdict, in ten lines

1. **The plan stands. Build it, with the briefs as amended.** Its architecture (an office is a HouseSpec with `use: "office"`, a sibling `company/v1` schema, extension tables, the `offices` array beside an untouched `houses`) survives every check I ran against the tree.
2. **The 46 apps are real.** Every id is in the live store (`curl https://hub.ci.computer/api/store`, 580 apps, all `available`, all `priceModel: free`, sha256 `db42c2ea717cfcf8`, byte-identical to the snapshot the plan used), every `replaces` a brief prints is the store's own, all 46 are in the catalog with a QA screenshot, three are `with-caveat` (Documenso, Invoice Ninja, Listmonk).
3. **Counts recompute.** 46 distinct apps (42 third party, 4 first party); no third-party app in more than three of eight (30 at exactly three); three startups, three small businesses, two medium; slugs, titles (51 to 59 characters), first names, companion names, places and streets collide with nothing in the 30 families or the 30 houses.
4. **The briefs were not "lint-clean" in the sense that matters.** The regexes (100 merged rules) hit nothing, before or after, because the defects are not wording: I found fifteen groups of factual or implication defects against the store's own packages and licences (plan Appendix C). The worst: four lines say an Excalidraw sketch is "saved" or "kept on the Core" (the package has no storage volume); Pi-hole is the office's DNS (the package publishes it on port 8053 only, so no router can use it); Hermes "reads" commits and help pages (the store says it runs isolated); an accountant reads the books on the Core in three beats (outsiders cannot reach the Core); Akaunting appears with no mention that its free production use is capped at two users, one company and one thousand invoices (upstream LICENSE.txt, read today).
5. **All fixed in the files** (section 2.2), and a mechanical `co-app-facts` rule specified so they cannot come back (contract 16.3). Positive control: the rule's prototype hits 14 times on the original briefs and 0 on the amended ones.
6. **Numbers that were wrong:** spoken words (the 3-word sign-off was left out: 201, 199, 190, 188, 204, 204, 189, 205 against the limit of 215, so Loamfield has 10 words of margin, not 14); rented services 47 to 43; bring-your-data-home beats 56 to 54 and moves 25 to 24; a Core room of 12 m2 under its own 3.6 x 3.6 m rule (12.96 m2).
7. **The effort is understated by about a third.** The plan's 420 agent-hours is 105 person-days times four; its own method adds 30 percent rework and the headline leaves it out (546). The props line items sum to 23 days and it carries 18. The M1 critical path puts WP2B and WP2C beside WP2A although its packages table starts them after it. Corrected: about 570 agent-hours (range 400 to 720); M1's critical path is 59 hours, 77 with rework, which is 5 to 7 working days with one review loop, not 2 to 3.
8. **Implication is where this fails, not wording.** Two taglines printed a head count beside "one Core"; the gallery h1 printed the held team sentence as a headline; four hooks said files "stay in the office/studio/shop"; the medium buildings show 24 to 30 desks. Reworded or flagged (sections 3 and 4).
9. **Three owner calls were added** (O13 stretched `replaces` pairs, O14 Akaunting's cap, O15 package gaps to raise with the Hub team) and **ten things cannot be verified from here** (section 7). The three that matter before a story ships: EspoCRM declares no storage volume; Mattermost's and Rocket.Chat's free-edition limits; and the gallery's silent capacity cue.
10. **Do not run `gen/build.mjs` or `gen/assemble.mjs`.** They regenerate the plan, the contract and the briefs from the old data files and would erase this pass.

---

## 1. What I did, and with what evidence

| Check | How | Result |
|---|---|---|
| Live store | `curl -sS https://hub.ci.computer/api/store` into `skeptic/store-now.json` (4,066,089 bytes) | 580 apps; `cmp` equal to the plan's `store-live.json`; 580 `available`, 580 `priceModel: free` |
| App ids, replaces, availability | `skeptic/apps1.py`: every app id in every brief against the store and `catalog-apps.json` | 46 of 46 present, `status: published`; every chip's service is in the store's `replaces`; 43 `storySafe: yes`, 3 `with-caveat`, all `qa: screenshot` |
| Packages | scanned the `compose` field of all 46 store packages for storage volumes, ports, auth and mail settings (`apps2.py`, `apptable.py`) and read about 35 in detail | findings A1 to A12 |
| Licences | `curl` of the upstream LICENSE files of Planka, Akaunting, Invoice Ninja, n8n, Mattermost, Twenty (`skeptic/lic/`) | A5, A6; Twenty's 39 KB file was fetched but not read in full |
| Counts | `skeptic/counts.py`: distinct apps, caps, services, bring-your-data-home beats and moves, film words and seconds, film chapters, members, categories, the brief's own `metrics` | all agree except spoken words (omitted sign-off) and, after my edits, the changed counts |
| Claims | `skeptic/claimscan.mjs`: `claims.json` (72 rules, two replaced) plus the 28 proposed rows = 100 rules, over every string of every brief (shipped fields), over the copy deck and the 12 disclosures (`copyscan.mjs`) | 0 hits before and after. The old h1 "Each team's work, on one Companion Core" also passes: no regex sees an implication |
| Shape rules | `skeptic/relint.mjs` (the earlier harness, plus title and body uniqueness across the eight) | clean after the edits |
| Names | `skeptic/names.py`: slug pattern, collisions with 30 family slugs, 30 house ids, surnames, first names, companion names, places, streets | none; titles 51 to 59 characters |
| Engine | read `engine.md`, the spike logs (`qa3.log`, `qa4.log`, `perf-*`), viewed three spike stills, read the repo's roles, bake and quota code | section 4 |
| Site | grepped the tree for the 22 directory globs, `index.json` readers, `FICTIONAL_LINE` print sites, `OWN_PARAMS`, the credit guard, `serve()` | section 5 |
| Names, web | four web searches covering all eight names (US-only search tool) | same result as the plan: no company of that name. Weak: no trademark register was searched |

Not run: any GPU render, any Hub app, `portal:build`, `portal:test`, any test in the repo.

---

## 2. (1) Every Hub app in every brief

### 2.1 The table

The multi-user column says "yes" when the store description says it or the app is known to be multi-user upstream (not verified here for the ones the listing does not state). "Max people" is the most distinct featured people who use the app in one company's beats. Licences marked (read) were read from the upstream file today; (review) comes from the marketplace review in `claims.md` 4.1; the rest were not read.

(Verdict column: FIXED means the briefs were amended for that app; Ready with care means the caveat travels in the beat's limit.)

| App (store id) | Store: available, replaces | Brief chips (after pass) | Companies | Max people in one company | Multi-user | SMTP | Licence limit | Caveat | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Akaunting (`akaunting`) | available; QuickBooks, Xero, FreshBooks | QuickBooks, Xero | 3 | 1 | 2 users max free (BSL) | no | BSL 1.1 (read): free production use up to 2 users, 1 company, 1,000 invoices | bookkeeping only; accountant not on the Core | FIXED: cap carried, one person |
| AnythingLLM (`anything-llm`) | available; ChatGPT, Claude | ChatGPT, Claude | 2 | 2 | yes (listing: multi-user with permissions) | no | not in the review; listing words private and multi-user not repeated | local model only | Ready with care |
| Baikal (`baikal`) | available; Google Calendar, iCloud Calendar | Google Calendar, iCloud Calendar | 3 | 2 | yes (admin UI for users) | no | not in the review | first visitor runs the install wizard; CalDAV client needed | Ready with care |
| Baserow (`baserow`) | available; Airtable | Airtable | 2 | 1 | yes | no | MIT core plus premium (review) | Airtable import reads a shared link | Ready |
| BentoPDF (`bentopdf`) | available; Adobe Acrobat, Smallpdf | Adobe Acrobat, Smallpdf | 1 | 1 | n/a (client-side, no accounts) | no | AGPL-3.0 internal or paid commercial (store listing) | heavier engines load from a public CDN on first use | FIXED: licence note |
| BookStack (`bookstack`) | available; Confluence, Notion | Confluence, Notion | 3 | 2 | yes (permissions) | optional | MIT (review) | change default credentials | Ready |
| Campfire (`campfire`) | available; Slack, Microsoft Teams | Microsoft Teams, Slack | 1 | 1 | yes (rooms with access controls) | no | not in the review | everyone on the office network; no importer | Ready with care |
| Hermes (`ci-hermes`) | available; (none) | (none) | 6 | 2 | one messaging ID (by design) | no | n/a (first party) | isolated; beta; channel not local | FIXED: no cross-app reading |
| Companion Memory (`ci-memory`) | available; (none) | (none) | 3 | 1 | one person (by design) | no | n/a (first party) | beta; crash reports on by default | Ready with care |
| OpenClaw WebCLI (`ci-openclaw`) | available; (none) | (none) | 2 | 1 | one owner | no | n/a (first party) | beta; office internet; cloud keys | Ready with care |
| Companion Planning (`ci-planning`) | available; (none) | (none) | 3 | 1 | owner account (by design) | no | n/a (first party) | one owner; Google sync off | Ready with care |
| Cryptgeon (`cryptgeon`) | available; Privnote, WeTransfer | Privnote | 1 | 1 | n/a (no accounts) | no | not in the review | RAM only; cannot reach outsiders | FIXED: WeTransfer chip dropped |
| Docmost (`docmost`) | available; Confluence, Notion | Confluence, Notion | 3 | 2 | yes | optional (invites) | AGPL-3.0 (review); enterprise module separate | overlaps BookStack | Ready |
| Documenso (`documenso`) | available; DocuSign | DocuSign | 2 | 1 | yes | YES (MailHog catcher by default) | not in the review; manifest says legally-binding (never repeated) | signing email needs SMTP | Ready with care |
| Docuseal (`docuseal`) | available; DocuSign | DocuSign | 3 | 1 | yes | optional | not in the review | signers must be in the room | Ready with care |
| draw.io (`drawio`) | available; Lucidchart, Microsoft Visio | Lucidchart, Microsoft Visio | 3 | 2 | n/a (stateless, no accounts) | no | not in the review | keeps nothing on the Core | FIXED: no "saved on Core"; BH note |
| EspoCRM (`espocrm`) | available; Salesforce | Salesforce | 3 | 1 | yes | optional | AGPL-3.0 (review) | compose declares no volume: durability UNVERIFIED | Ready with care; ASK HUB TEAM |
| Excalidraw (`excalidraw`) | available; Miro, Mural | Miro, Mural | 3 | 1 | no accounts; live collab via relay | no | not in the review; package wraps a 105-star repo (review) | no storage volume; amd64 only | FIXED: no "saved on Core"; BH removed |
| Forgejo (`forgejo`) | available; GitHub, GitLab (SaaS) | GitHub, GitLab (SaaS) | 3 | 2 | yes | optional | not in the review | registration open, first account admin; no CI runner | Ready |
| Gitea (`gitea`) | available; GitHub, GitLab (SaaS), Bitbucket | GitHub | 1 | 1 | yes | optional | not in the review | registration open by default | Ready |
| Grist (`grist`) | available; Airtable | Airtable | 3 | 2 | ONE default sign-in in this package | no | Apache-2.0 (review) | no login provider configured | FIXED: limit added |
| Immich (`immich`) | available; Google Photos, iCloud Photos | Google Photos | 3 | 1 | yes | no | not in the review | first start slow; phones on office network only | Ready |
| Inkscape (`inkscape`) | available; Adobe Illustrator | Adobe Illustrator | 3 | 1 | one shared desktop (VNC password) | no | not in the review | no storage volume; KasmVNC | FIXED: no "straight into" |
| Invoice Ninja (`invoice-ninja`) | available; FreshBooks, QuickBooks | FreshBooks, QuickBooks | 3 | 2 | yes | YES to email invoices | Elastic License 2.0 (read): no hosted service for third parties, keep notices | payments need a provider; print and post | Ready with care |
| JupyterLab (`jupyterlab`) | available; (none) | (none) | 3 | 1 | one shared password | no | not in the review | one password; packages reach the internet | Ready with care |
| Kimai (`kimai`) | available; (none) | (none) | 3 | 1 | yes (roles) | optional | not in the review | not a billing tool | Ready |
| LibreOffice (`libreoffice`) | available; Microsoft Office, Google Workspace | Microsoft Office | 3 | 2 | one shared streamed desktop | no | MPL 2.0 (review) | one session, no co-editing | Ready with care |
| LibreTranslate (`libretranslate`) | available; Google Translate, DeepL | DeepL, Google Translate | 2 | 1 | n/a (no accounts) | no | not in the review | model download uses the internet | Ready |
| Listmonk (`listmonk`) | available; Mailchimp, ConvertKit | Mailchimp | 2 | 1 | yes | YES (set inside the app) | not in the review | delivery not promised; list is not consent | Ready with care |
| Mattermost (`mattermost`) | available; Slack, Discord | Discord, Slack | 3 | 1 | yes | optional | MIT compiled build (read); free-edition user or history limits NOT verified | amd64; team-edition:latest | Ready with care; VERIFY |
| n8n (`n8n`) | available; Zapier, Make | Make, Zapier | 3 | 1 | single builder in the stories | no | Sustainable Use (read): internal business use only; .ee files excluded | source-available wording | Ready with care |
| Nextcloud (`nextcloud`) | available; Google Drive, Dropbox, OneDrive, iCloud | Dropbox, Google Drive | 3 | 3 | yes | optional | AGPL-3.0 (review) | no co-editing; no outsiders | Ready |
| ntfy (`ntfy`) | available; (none) | (none) | 1 | 1 | none (no sign-in) | no | not in the review | anyone on the network can publish/subscribe | FIXED: limit added |
| Open WebUI (`open-webui`) | available; ChatGPT, Claude | ChatGPT, Claude | 3 | 2 | yes | no | not in the review | local model only; cloud-key field | Ready with care |
| Paperless-ngx (`paperless`) | available; Evernote, Google Drive | Evernote, Google Drive | 3 | 2 | yes | optional (mail fetch) | GPL-3.0 (review) | scans/PDF only; Evernote/Drive pair is a loose fit | Ready; O13 |
| Papra (`papra`) | available; Evernote, Google Drive | Evernote, Google Drive | 3 | 2 | yes (orgs) | no | AGPL-3.0 (review) | loose fit pair | Ready; O13 |
| Penpot (`penpot`) | available; Figma, Sketch | Figma | 3 | 1 | yes (teams) | default verification mail (unchecked) | not in the review | five containers | Ready |
| Pi-hole (`pi-hole`) | available; AdGuard, NextDNS | AdGuard, NextDNS | 3 | 1 | one admin password | no | not in the review | DNS on port 8053 only | FIXED: devices pointed at it |
| Planka (`planka`) | available; Trello | Trello | 3 | 1 | yes | no | PLANKA Community License / Fair Use 1.1 (read): internal organisation use; no account sharing with outsiders | internal organisation use; admin default | FIXED: licence note |
| Rocket.Chat (`rocketchat`) | available; Slack, Discord | Discord, Slack | 1 | 1 | yes | optional | not in the review; free-edition limits NOT verified | amd64; overlaps Mattermost | Ready with care; VERIFY |
| Stirling-PDF (`stirling-pdf`) | available; Adobe Acrobat, Smallpdf | Adobe Acrobat | 3 | 1 | no accounts unless security enabled | no | not in the review | processes and returns | Ready |
| Twenty (`twenty`) | available; Salesforce | Salesforce | 2 | 1 | yes | no (needs OAuth for email) | AGPL plus commercial files (review) | QA capture shows real names | Ready |
| Uptime Kuma (`uptime-kuma`) | available; Datadog, New Relic | (none) | 3 | 1 | one admin | no | not in the review | runs on the Core: cannot report the Core down; stretched Datadog pair | FIXED: chip dropped |
| VaultWarden (`vaultwarden`) | available; LastPass, 1Password | 1Password, LastPass | 3 | 1 | yes | optional | AGPL-3.0 (review) | unofficial; Bitwarden clients | Ready with care |
| Vikunja (`vikunja`) | available; Todoist, Asana | Asana, Todoist | 3 | 1 | yes (share project with team) | optional | not in the review | sign-in wall in QA shot | Ready |
| Wallos (`wallos`) | available; Rocket Money, YNAB | (none) | 3 | 1 | yes | no | not in the review | fetches logos from outside; YNAB stretch | Ready |


### 2.2 Findings (all fixed in the briefs unless marked)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **Excalidraw keeps nothing on the Core.** Four beats said the sketch is "saved" or "kept on the Core" (Reelwick `meet-draw`, Gutterfold `pitch-wall`, Loamfield `open-sketch`, `meet-demo`) and two carried a Miro to Excalidraw bring-your-data-home row | compose: services `excalidraw`, `excalidraw-room` (a collaboration relay) and nginx; the only volume is `nginx.conf`. Manifest source is a wrapper repo (review), but the compose uses the stock images | seeds rewritten, two bring-your-data-home rows removed, limit added |
| A2 | **Pi-hole cannot be the office's DNS as shipped.** Three beats said it "answers the name lookups ... beside the router" | compose `addPorts`: container 53 to host 8053, tcp and udp. A router's DNS field takes an address, not a port. It also made the whole network depend on one box | "blocks known ad and tracker domains for the devices pointed at it"; three titles changed; limit says the Core off means those devices lose lookups |
| A3 | **Hermes does not read other apps.** Reelwick `open-review` and Rivet's job, Curatory `comms-draft`, `open-wiki` and Tally's job | store listing: "runs in its own sandboxed containers, isolated from other CI apps"; catalog gives Forgejo and BookStack agent link `ui` only | "from commit messages Femi pastes", "from help text Ilse gives it" |
| A4 | **An accountant reads the books on the Core** in three beats (Pannierwell `kitchen-books`, Curatory `open-books`, Hartnoll `open-books`) | the briefs' own honest edge: "clients and consultants outside cannot reach the Core". `claims.md` allows "holds the books for the accountant to read"; in a scene it reads as access | "a printout goes to the accountant" or the clause removed |
| A5 | **Akaunting is not a team tool.** The briefs flagged "BSL 1.1" and nothing else | upstream LICENSE.txt, Additional Use Grant, as written: production use allowed provided you do not use it "with a total of more than two users or one company or one thousand invoices" (counsel should read the sentence; I quote it) | cap in the three briefs' licence notes and limits; one person in it; plan O14 |
| A6 | **Planka's licence is named, not "unasserted".** | upstream LICENSE.md: PLANKA Community License v1.1 with a Fair Use License 1.1: internal use in an organisation permitted; sharing accounts with third parties for business purposes prohibited; "PLANKA Pro/Enterprise" files separate | note in three briefs; never "open source" (already a rule) |
| A7 | **Uptime Kuma checks the Core it runs on** (Loamfield `comms-status`: "Uptime Kuma checks it") and carries "replaces Datadog / New Relic" on the two IT sceptics' own beats and cuts | a monitor on the machine cannot report that machine down; the market review: "the honest comparator is Uptime Robot; Datadog and New Relic are full observability suites" | "checks its apps"; Datadog and New Relic chips removed on three beats and two cuts |
| A8 | **Cryptgeon "replaces WeTransfer" and LibreOffice "replaces Google Workspace"** contradict their own limits | Cryptgeon's note opens once on the office network (it cannot send a file to an outsider); LibreOffice is documents only and Baikal already carries the calendar swap | chips removed (3 beats) |
| A9 | **Grist has one default sign-in; draw.io, Inkscape keep nothing; ntfy has no sign-in; LibreOffice is one shared desktop** | compose: Grist `GRIST_DEFAULT_EMAIL` and no login provider; draw.io no volume; Inkscape no volume (KasmVNC, VNC password); ntfy listing: "anyone who can reach this app's URL can publish to and subscribe"; LibreOffice linuxserver image, `/config` only | limits on every affected beat; draw.io bring-your-data-home rows say "draw.io keeps no copy, the file is saved by the person"; Inkscape "goes straight into" removed |
| A10 | **Documenso, Invoice Ninja, Listmonk need mail** and the briefs already say so | Documenso compose bundles MailHog (signing email is caught, not delivered, until SMTP is set); Invoice Ninja review: SMTP to email invoices; Listmonk: SMTP is set inside the app | no change; contract 16.2 repeats them; Posy and Pail prints and posts its statement |
| A11 | **EspoCRM declares no volume for the app or its database** (compose has none). Three stories hold customer data in it ("The client list, kept here") | store compose for `espocrm`: no `volumes` key on either service | **not fixed, cannot be from here**: plan O15, `skeptic.unverified`, contract 16.2 |
| A12 | **Mattermost (3 companies) and Rocket.Chat (1) free-edition limits are unverified** | image `mattermost/mattermost-team-edition:latest`; the upstream licence says compiled builds are MIT, which says nothing about user or history caps in the current build | **not fixed**: contract open item 13, `skeptic.unverified` |

Not changed, on purpose: Paperless-ngx and Papra with Evernote and Google Drive (ten beats, two of them cut hooks). The market review calls the fit loose, but `personas.md` names "Paperless-ngx replaces Evernote" as a good chip and the 30 families print it nine times. That is the owner's and counsel's call: plan O13.

### 2.3 The recomputed fleet

| Number | Plan said | Now | Check |
|---|---|---|---|
| distinct apps | 46 (42 third party) | 46 (42) | recomputed |
| third-party apps in more than 3 of 8 | none | none (30 at 3, 6 at 2, 6 at 1) | recomputed |
| first party | Hermes 6, Memory 3, Planning 3, OpenClaw 2 | same | recomputed |
| distinct rented services in chips | 47 | **43** | Datadog, New Relic, WeTransfer, Google Workspace dropped |
| bring-your-data-home beats / moves | 56 / 25 | **54 / 24** | Miro to Excalidraw gone (2 beats) |
| beats per company | 25 to 28 | 25, 25, 25, 28, 25, 25, 26, 27 | unchanged |
| film beats, spoken words (limit 215, sign-off included) | 8 or 9, 184 to 201 | 8 or 9, **188 to 205** | `quotas.mts filmWords` adds 3 |
| film chapters (needs 5) | not stated | Reelwick, Curatory, Gutterfold, Posy and Pail, Hartnoll sit at exactly 5 | a swapped film beat must keep its chapter |

---

## 3. (2) Every sentence against the claims canon

**Result of the regexes:** 100 rules (the 72 in `claims.json` with `incumbent-attack` and `cap-autonomy` replaced, plus the 28 proposed `biz-*` rows) over every shipped string of the eight briefs (titles, bodies, say lines, taglines, stories, member titles, companion jobs, hook titles, title cards), the copy deck and the 12 disclosures: **0 hits before, 0 after.** Over all fields including the writers' own `limit` notes the hits are all negative instructions ("never 'open source'"), which is what they should be.

What the regexes cannot see, as three readers:

### 3.1 The marketing lead

| # | Problem | What I did |
|---|---|---|
| M1 | **The gallery h1 prints a held sentence.** "Each team's work, on one Companion Core" is the content of `core-back-room` ("The team's apps run on it"), which the plan itself holds pending O2, yet it is the headline of the page and the lander | h1 reworded in the contract to "Eight offices. Each with a fictional company and a Companion Core." (66 characters). The description keeps the homes' own grammar ("each with a fictional company on one Companion Core") |
| M2 | **Two taglines put a head count beside the Core**: "Eleven people make visitor guides ..., on one Companion Core." and "Ten people run a flower shop ... on one Core." Plan section 1 says no sentence may | Curatory: "Visitor guides for small museums, and one Companion Core behind glass."; Posy and Pail: "A flower shop and a wedding workroom, with one Core on the back-office desk." Lists such as "Six people, one product, and one Companion Core" were left: a list, not a claim |
| M3 | **"Seven people become six"** (Reelwick's arc) reads as a person replaced (`biz-people-replaced` by implication) | "Six people, one list." |
| M4 | **Four hooks say files "stay in the office / studio / shop"** ("Drawings stay in the office", "Design files stay in the studio", "The newsletter list stays in the shop", "The screens stay in the office"). The canon's phrase is "sits on the Core" or "stays on your Core by default". A sent newsletter hands every address to the mail provider, so "the list stays in the shop" is a half-truth in a headline | "sit on the Core" in the titles and hooks (Posy and Pail: "The newsletter list sits on the Core, in the shop"); the seeds already said "sits ... on the Core" |
| M5 | **App density reads as an admin burden.** Five to eleven featured people use 12 to 18 apps (Reelwick 18 apps for 6 people, Pannierwell 16 for 5). A small-business reader asks who patches fifteen services | not changed: the fleet needs at least 40 distinct apps at three of eight. Flagged: the page should show three or four apps a person, never the company's total |
| M6 | **Sameness is handled** (arcs, Core owners, Core rooms, chat and wiki choices, narrators) but 30 of 42 third-party apps sit exactly at the cap, so every writer edit is a fleet-gate failure | no change |
| M7 | **Ad cuts on stretched swaps.** The strongest ad hook of two cuts (Lintel `desk-post`, Posy `back-invoices`) is a swap the research calls loose | O13, default keep, as the families do |

### 3.2 The trade-practices lawyer

| # | Problem | Status |
|---|---|---|
| L1 | **Comparative naming of real products** (47, now 43, services) is commercial speech. Defences: only the store's own `replaces` pairs, chips not sentences, `names-owners`, no attack verb | holds; counsel (O7) |
| L2 | **Stretched pairs** in chips: Paperless-ngx and Papra with Evernote and Google Drive, Wallos with YNAB, Cryptgeon, Uptime Kuma with Datadog | the contradicted ones removed (A7, A8); the rest O13 |
| L3 | **Licence terms read today** (A5, A6; Invoice Ninja Elastic 2.0: no hosted service to third parties, keep notices; n8n Sustainable Use: internal business purposes only; Mattermost compiled MIT). A reader who copies a story can breach a licence | `licence-terms` disclosure widened (Planka, BentoPDF added, Akaunting's cap in the "where" column); counsel on all of them |
| L4 | **A model summarising a contract "before she signs"** (Curatory `meet-ask`, Reelwick `meet-ask`, Lintel `front-ask`, `archive-ask`) | each beat has the person read the clause or the letter herself; `biz-ai-claims` stands; reviewer one checks |
| L5 | **E-signature on consumer contracts** (Posy and Pail wedding contract) with DocuSeal | no validity word anywhere (`biz-esign-valid`); signer in the room |
| L6 | **A mailing list moved from Mailchimp** carries addresses, not proof of consent | no beat claims otherwise; recorded in `skeptic.unverified`; I did not add a consent sentence because no compliance word may appear |
| L7 | **Fictional staff with job titles** against ADS.md 9.1 ("Nobody is invented, cast, generated or composited as a team member") | owner decision O4, default as the plan reads it (the rule is about Companion's own team); unchanged |
| L8 | **Company names are invented and not cleared.** Four web searches (US-only tool) found no company of any of the eight names; no trademark register (USPTO, UK IPO, EUIPO) was searched. Near matches that exist and differ: Lintel Studio for Architecture, Hartland Joinery, Posy Flowers (the plan) | O6; counsel |
| L9 | **Capacity by implication** (the lawyer's and the marketer's meeting point): buildings with 24 and 30 desks and a floor of 22 to 24 people sharing one Core, with no capacity or performance statement in the canon (`f-unmeasured`) | plan risk 14; the floor figure is never printed; contract 5.5 notes |

### 3.3 The principal engineer

A1 to A12 above, plus: Gitea and Forgejo leave registration open and make the first account admin (the briefs say the admin closes it); `POSTGRES_HOST_AUTH_METHOD: trust` in Planka's database (internal network; not claimed); three apps are amd64 only (Mattermost, Rocket.Chat, Excalidraw; the catalog says that is fine on the Core); the Hermes channel is not local (the briefs say so); an OpenClaw beat that reads a supplier site needs the office internet (disclosure `openclaw-office-internet`).

---

## 4. (3) The engine plan

**It fits.** Every office is expressible with existing constructs plus six composer programs and a prop set; the spike (re-verified by the engine report and by me from its logs) validates a 96 m2 loft with 0 shot errors (8 shots, 38 s), an 800 m2 probe floor, a 792 m2 floor with 56 composed desks (0.56 s to compose, 4,502 meshes, 9,633 offline draw calls against 7,122 for `aurora` and 8,084 for `vanilla`) and a shop front. The 72-seat floor and the curtain wall are dropped; the largest remaining building (Loamfield, 30 seats) is far under both numbers. I looked at three spike stills: the prototype workspace reads as an office at once; the Core is a small box on a shelf with three books (so "shelf without books" is a real P0 item); the shop interior reads as a furniture shop (sideboards for display tables, a ceiling fan), so the retail set is real work.

| Check | Result |
|---|---|
| Room names resolve through the merged role table | yes (the plan's oracle `gen/rooms.mjs`); the five new name regexes match none of the 193 home room names (engine report) |
| **"Phone Booth" is missing from the program regexes** | **gap.** It falls through to `study`; the spike drew a closet with a bookshelf and a rug. Contract 5.3 now says to pin `program: 'meeting'` or add it to the regex |
| Core room at least 3.6 x 3.6 m | Curatory's was 12 m2 (under 12.96): **fixed to 13**; the other seven are 13 to 14 m2 |
| Seat rule (0.7 to 1.6 of the floor; 4 to 14 m2 per seat) | holds for all eight (Hartnoll's Open Office is 56 m2 for 14 seats, 4.0, at the edge) |
| `core-contrast` | warned (1.06 against 1.25) in two of three spikes; chalk on blue-grey passed. Three buildings put a chalk Core on a steel rack shelf: choose the wall in the first render (contract 5.5 note) |
| Curatory's glass wall onto the floor vs "the Core not in front of glass" | allowed by `office-comms-blind` (interior glass only); put the Core on a wall that is not the glass one |
| Layout lints (`repetition`, `foyer`, `core-walk`) | the proposed exemptions are the ones the spike needed; they are gated on `use: office` |
| Shot planner | loft film 20.5 s against a 18.1 s budget (ratio 1.13, under the 1.15 warn); the lever is the Core's place; the townhouse's Core is on its entry storey |
| Draw calls for a large open plan | not an issue after the 72-seat floor was dropped (above) |
| The sweep | the plan says 22 scripts read `content/houses`; my grep finds the same order (dress-census, dress-project, fleet-audit, `_compose-dry`, perf-house, test-baked, test-dress-phase, test-fixtures, test-floorplan-graph, test-goldens x2, test-interior-light x2, test-kit, test-light-rules, test-room-clip, validate-house-spec and others). **Missed:** the two Python twins `generate_house_iso.py` and `generate_floor_plans.py` glob every spec; a plain `pnpm run iso` after the first office lands rewrites the manifest. WP3 must always pass `--only <id>` (contract 5.5 note) |
| Untested constructs | Hartnoll's per-volume roofs and clip: "plan a spike day" is in the text but not in the days (+1 day); Gutterfold's mezzanine rails (APARTMENTS 2.6) |
| Hero objects with no prop | Posy and Pail's buckets of stems: the retail set lists buckets, not stems (0.5 day, contract 5.5 note) |
| Goldens | owner, macOS, 40 frames: unchanged; `use: office` ids are skipped by default |

---

## 5. (4) The site plan

| Check | Result |
|---|---|
| Count and guard changes under R1 | **hold**: `build-portal.mts` reads `houses.length` for `COUNT_WORD`; the gallery reads `index.houses` (`gallery.js:220`); `cast-lint` `N = 30` and `FLEET.families = 30` read the homes. An office under `offices` cannot appear on the homes page |
| The credit guard | **sound**: `builderHandles` reads `author` from every spec and from the list; `guardTerms` also derives the handle without its non-letters (`ciofficesinternal`); the token appears in no shipped file, so the guard finds nothing, which is correct for a piece with no builder. `redactIndex` must also redact the `offices` array (the plan says so) |
| `FICTIONAL_LINE` print sites | the plan listed four; **two more** are in files WP5.2 owns: `scripts/story/build-og.mts:113` (the link-preview pill) and `scripts/story/pages.mts:110` (the family footer sentence). `assets/site/identity.ts:33` holds a fifth copy that nothing imports (grep): no change. Contract section 11 now lists them |
| URL rules | `/office` (extensionless, like `/room-creator`) and `/company/<slug>` hold; titles 51 to 59 characters; the /office description is 151; slugs match `^[a-z]+(-[a-z]+){0,2}$`; no company slug is a family slug or a house id. `serve()` takes the directory branch first, so `office.html` beside a directory `office/` would 404: the plan avoids a directory. Cloudflare's live precedence is unverified (first preview deploy) |
| Four company links, one h1, one main, `data-cfasync`, content hashes, no analytics change | stated by the plan and enforced by `portal:build`; nothing in the plan breaks them |
| Credit words | the credit guard's words (the game name, the pack tag and the builder handles): no brief or page string contains them (scanned) |
| Schema choice vs the 30 families | `company/v1` is a sibling; `claims.json`, `roles.json`, `casting.json`, `ads.json` and `family.schema.json` are not edited, so no `rolesSha`, no film `inputsSha` and no family lock moves. `ROLE_IDS` keeps its values; `test-story-bake` asserts it equals the `roles.json` keys, which still holds |
| Tests | no 30-literal is touched; the office legs are auto-loaded by `portal:test`. Known today: the families' own fleet gate fails (11 apps over the 40 percent cap, small-business share 15.7 against 18); WP0 must record it before any edit so invariant I1 compares with before |
| Sitemap, nav, 404, JSON-LD | covered; never an `Organization` for a fictional company |

---

## 6. (5) Feasibility

| Claim | Check | Finding |
|---|---|---|
| About 420 agent-hours | sum of the table = 418; person-days 104.55 times 4 | the schedule's assumptions add 30 percent rework; the 420 omits it: **546** |
| Props 18 person-days | engine report line items 5.2 + 8.3 + 9.5 = 23 | five of eight buildings need a P2 set; **23 days: +20 hours** |
| `co-app-facts` | new | +2 hours |
| **Recalculated** | | raw 442, with rework **575**, range 400 to 720 |
| M1 in 2 to 3 working days | the critical path as written is WP2A, WP2B-min, WP2C-min "in parallel (about 14 h)" | the packages table says WP2B and WP2C start after WP2A. With the plan's own edges: 1 + 12 + 18 + 10 + 3 + 9 + 6 = **59 h**, 77 with rework. 3 elapsed days only if agents run around the clock and nothing waits for a person; **5 to 7 working days** with one review loop |
| Eight stories at 9.5 hours each | the 30 families took far longer to research and write (the surviving research is dozens of files) | plausible for a writer given a brief this complete, optimistic for the review loop; no change, but expect the two reviewers to find A-class defects (this pass found fifteen groups in the briefs) |
| Owner-gated, not agent-gated | Mac goldens (40 frames), counsel, Kokoro (about 3 GB), preview deploy, the ad GPU | as the plan says; none blocks M0 |
| Branch debt | pass 2 and the apartments edit the same files | Phase A and B is the right answer; expect a rebase of `director`, `popup`, `runtime`, `pages` |
| RAM disk | `/tmp` is a 16 GB tmpfs; two OOM kills on 2026-10-19 | WP1.1 copies the inputs into the repo; do not leave renders in `/tmp` |

The cheapest thing that proves the plan: M0 (the page with two fixture cards, about 10 agent-hours) and then the loft building with the prototype patch applied, which already exists.

---

## 7. (6) Honesty to the owner: what could not be verified

1. **Mattermost and Rocket.Chat free-edition limits** (users, history) against the images in the store. Mattermost is in three of eight companies.
2. **EspoCRM persistence.** The compose declares no volume. If the Hub keeps nothing across an update, three stories claim customer data "kept here" and the claim is false. Ask the Hub team before any CRM story ships.
3. **ntfy notifications on a local HTTP address.** Browser notifications need a secure address; whether the Core's address gives one is not known.
4. **The Core's capacity** for a floor of 22 to 24 people and 12 to 18 apps. No statement exists and none may be printed; the stories show it silently.
5. **Counsel**: company names (and a trademark register search), the five licences I read (I quote, I do not advise), comparative naming, the label under ADS.md 9.1.
6. **Cloudflare's precedence** for `office.html` against `/office`.
7. **Any Hub app actually running.** Every app fact comes from the store listing, the package compose, the catalog, the market review or an upstream licence file, not from a running Hub.
8. **Hermes isolation** rests on the store listing's text ("isolated from other CI apps"); the Hub's hub-integration wiring (local model, Companion Memory) is a different channel.
9. **Licence files were read from the default branch**, not from the tag each image ships; Twenty's 39 KB file was fetched, not read in full.
10. **Effort.** Every hour in sections 6 and the plan is an estimate; the 30 percent and the 4 hours a day are conventions, not measurements.

Also not independently re-verified: the persona and lens research (`w12`), the 60-service bring-home research (`w8`), and the plan's line-number citations other than the ones listed in section 5.

---

## 8. Decisions for the owner (defaults in brackets)

| # | Question | Default |
|---|---|---|
| O2 | per-person Companion accounts: docs and the canon disagree | the canon wins; offices say "each app keeps its own sign-ins" |
| O3 | medium businesses at a floor of 22 to 24 | keep, never print the floor; consider capping the open office seats (contract 5.5 note e) |
| O4, O6, O7 | label and fictional staff; company names; naming real SaaS | as the plan |
| **O13** | stretched `replaces` pairs in tours and paid cuts (ten beats) | keep the store's pair, counsel reads it |
| **O14** | Akaunting's two-user cap | keep in three stories, one person each |
| **O15** | package gaps to raise with the Hub team: EspoCRM and Inkscape declare no volume; Pi-hole on 8053; Grist one sign-in; Excalidraw keeps nothing | the stories avoid all of them |
| new | a capacity statement from the product team before M3 | none exists |

---

## 9. Files and how to reproduce

`skeptic/store-now.json` (the store), `skeptic/lic/*.txt` (upstream licences), `skeptic/orig/` (the originals of the nine briefs, the plan and the contract), `skeptic/collect.py`, `apps1.py`, `apps2.py` (caveats, forms, volumes), `apptable.py` (section 2.1), `counts.py` (section 2.3), `claimscan.mjs` and `copyscan.mjs` (section 3), `relint.mjs` (shape rules), `appfacts.py` (the `co-app-facts` prototype; run it with `skeptic/orig/company-briefs/` as the argument for the positive control), `apply_briefs.py`, `apply_plan.py`, `apply_contract.py` (the edits; they run from `orig/`).

The 15 numbered changes are Appendix C of the plan; the new rules are contract section 16.
