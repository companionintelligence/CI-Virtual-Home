# Tech family (`tech-family`): ten new user stories

Draft for the owner, written 2026-10-20. Nobody here is a customer: every name, age and household below is a design choice for a fictional character, and the example names are not cast members yet. Read for this file: chapter 3.7 of [persona-bible.md](../persona-bible.md), the `tech-family` row of `content/story/personas.json`, the 30 family files in `content/families/` (the six apartments are not in `content/houses/` yet, so they have no family file), `catalog-apps.json` and `services.json` (both as of 2026-10-19), `claims.json` and [validator.md](../validator.md). The law for every word is `content/story/claims.json`.

**One line.** The household lead of a family that already runs its own network, its lamp rules and a few apps, and who is judged by the people in the house who do not tinker.

**What this file adds.** No family of the 30 has a `tech-family` member yet; the persona's apps show up today in builder and organiser beats (Pi-hole, Forgejo, Home Assistant, Uptime Kuma). The chapter's own hooks are the DNS list, the lamp that comes on and the Wi-Fi fixer. These ten stories keep the persona's rule, that every tinkerer scene is paired with someone who does not tinker, and move it to things a house needs besides a lamp: a runbook on paper, a history of a changed rule, a sign-in that fills in at the counter, a shelf of cables with numbers, a search page on the Core. The lead is a woman in five of the ten, because the data describes who answers surveys and not who keeps the house online. None of the ten pairs is used by any family yet, and four of the ten apps have no beat at all in the 30 files.

---

## 1. What the chapter and the families already show

- **The chapter (3.7).** Andres (40), Samir (48), Tomasz (44). Ranked replacements: Home Assistant, Pi-hole, Forgejo, ntfy, Uptime Kuma, Open WebUI. Rules that bind every story below: call them the household lead, never admin or owner; pair every tinkerer shot with a reaction from someone who does not tinker; never a readable screen, a hooded figure or a benchmark; the model is the third beat and its limit is said once; nothing that reaches the Core from outside the house (the claims file bans a long list of words for it); Pi-hole is only ever a DNS filter; no Zigbee stick; never describe an install as quick or light; never open on a breach.
- **The families.** No member of the 30 files is `tech-family` (the cast plan has none). The persona's pool shows in other archetypes' beats: Home Assistant 15, Forgejo 13, VaultWarden 12, Open WebUI 8, Pi-hole 7, ntfy 5, n8n 5, Uptime Kuma 3; Syncthing and Ollama have none. The builders who run them are Jiho (Pi-hole), Samir (Uptime Kuma), Rohan (Uptime Kuma), John (Pi-hole, Gitea), Noam (Pi-hole), Gabor (Pi-hole), Etienne (Pi-hole) and others.
- **The old places they name.** NextDNS, AdGuard, GitHub, Cursor, Datadog, Google Home, ChatGPT, LastPass, Zapier, Carbonite.
- **What is not there.** The partner or teenager who tests the house. The runbook on paper. A change history for the lamp rules. A search page. A shelf of cables with numbers. A house sitter or a visiting parent reading how the house works.

## 2. How the ten differ

| # | App, service | Room, anchor | Moment | Who acts, who tests |
|---|---|---|---|---|
| US1 | Uptime Kuma, New Relic | `entry`, `core` | Sunday evening after a router update | Tendai (41) checks; her partner Jomo (44) asks about the film |
| US2 | BookStack, Confluence | `living`, `bookshelf` | A week in April when the lead is at a conference | Naveen (45) writes; Imogen (44) reads |
| US3 | Gitea, Bitbucket | `office`, `desk` | Monday morning after a strange weekend | Mariam (37) rolls back; Osei (39) brings the evidence |
| US4 | VaultWarden, 1Password | `kitchen`, `counter` | A Thursday at the supermarket's checkout page | Nilufar (46) sets it up; Henrik (48) tests it |
| US5 | Syncthing, Resilio Sync | `garage`, `room` | A November Saturday, the old laptop retires | Dev (50) and Pilar (16) |
| US6 | Vikunja, Asana | `living`, `couch` | Saturday morning with coffee | Sunniva (44) and Emre (42) share a board |
| US7 | SearXNG, Bing | `kitchen`, `kitchen-island` | A January Thursday evening | Hamid (53) changes the tablet's search; Miriam (51) tests it |
| US8 | Open WebUI, Claude | `office`, `desk` | The last day of the month | Farah (43) drafts a note from a model on the Core |
| US9 | HomeBox, Sortly | `garage`, `bookshelf` | A Sunday of tidying | Mehmet (47) numbers tubs; his daughter finds a charger |
| US10 | PrivateBin, Pastebin | `bedroom`, `desk` | A school evening | Oluwaseun (15) pastes an error; Aziz (49) reads it once |

Place fit. US1, US2, US3, US4, US6, US7 and US8 need only rooms an apartment has. US5 and US9 need a garage, US10 a teenager's bedroom: a house, or an apartment with a storage room.

## 3. Ten user stories

Format: "As the household lead, I want <job> so that <outcome>." Each story is tied to one catalog app and one registry service, with the honest caveat, a one-line moment and the first sentence a visitor would read (20 words or fewer, sentence case, no dash, no exclamation mark; the service is named only as the old place). The chip pair is the app name, then "alternative to <Service>". Rooms and anchors are the closed sets of `schema/family.schema.json` and `roles.json`. Every story has a non-tinkerer in it, and their reaction comes first.

**US1. Uptime Kuma, New Relic.** As the household lead, I want one list of what the house runs and whether it answers, so that after an update I know before anyone asks.
- Who and when: Tendai (41, test engineer) and her partner Jomo (44, joiner), a Sunday evening after the router's update.
- App `uptime-kuma`. Service `new-relic`. Caveat: Uptime Kuma watches sites and services; it is not a full monitoring platform like the old tool. An alert goes wherever the lead points it; if that is a messenger, the message passes through the messenger. No uptime claim and no readable screen.
- Moment: `entry` room, anchor `core` (fallback `room@entry`). The first thing: Jomo flicks the lamp switch and asks if the film will play; Tendai says yes, and only then looks at the monitor.
- First sentence: "Her Sunday check was a New Relic tab; Uptime Kuma now watches the house's services from the Core." (18 words)
- Why it differs: the question comes from the partner, not from the lead; the hall shelf, not the workbench; a check after an update, not a build.
- Check: QA screenshot yes; fleet use 3.

**US2. BookStack, Confluence.** As the household lead, I want the runbook for the house written where my partner can read it, so that when I am out at a conference the fix is a page and not a phone call.
- Who and when: Naveen (45, systems analyst) and his partner Imogen (44, primary teacher), a week in April.
- App `bookstack`. Service `confluence`. Caveat: BookStack runs on the Core and opens on the home Wi-Fi. If the Wi-Fi itself is down the page cannot open, so page one is printed and sits in a binder; the lead says the limit once. One wiki per household (BookStack, Docmost).
- Moment: `living` room, anchor `bookshelf` (fallback `couch`). The first thing: Imogen reads the printed first page ("If the Wi-Fi is down, start here") before she opens anything.
- First sentence: "The runbook sat in a Confluence space; BookStack keeps it on the Core, with page one on paper." (18 words)
- Why it differs: the partner is the reader and the acceptance test; the honest limit is built into the story; paper is the first page.
- Check: QA screenshot yes; fleet use 3.

**US3. Gitea, Bitbucket.** As the household lead, I want the lamp rules kept as a history of changes, so that when the porch lamp misbehaves I can go back to Friday's version.
- Who and when: Mariam (37, software tester) and her partner Osei (39, plumber), Monday morning after a weekend when the porch lamp came on at noon.
- App `gitea`. Service `bitbucket`. Caveat: name one Git host per household (Gitea or Forgejo). The package ships no runner, so no pipeline is shown. Do not say it syncs with, or is compatible with, the old host. Say where the repositories are: on the Core. No readable screen.
- Moment: `office` room, anchor `desk` (fallback `room@office`). The first thing: Osei holds up his phone with the lamp lit at noon and says "that again"; Mariam opens the list of changes, not the editor.
- First sentence: "The lamp rules lived in a Bitbucket repository; Gitea keeps them, with their history, on the Core." (17 words)
- Why it differs: the story is a rollback after a complaint, not a release; the lead is a tester; Gitea is the builder's app, here used for house rules.
- Check: QA screenshot yes; fleet use 13.

**US4. VaultWarden, 1Password.** As the household lead, I want the family's sign-ins filled in by the phone in the hand that needs them, so that the vault is judged at the supermarket checkout and not at my desk.
- Who and when: Nilufar (46, network engineer) and her partner Henrik (48, carpenter), a Thursday evening at the grocery site.
- App `vaultwarden`. Service `1password`. Caveat: VaultWarden is an unofficial server that works with the Bitwarden apps; no security superlative and no claim about who can open what. A household keeps one password vault (VaultWarden, TeamPass). The first move of sign-ins is hand work and no importer is claimed. VaultWarden has twelve beats in the 30 files and is at the cap: reserve this for a family that drops another vault beat.
- Moment: `kitchen` room (the anchor `counter` is in the row, the room is not), anchor `counter`. The first thing: Henrik says the grocery sign-in is "never there"; Nilufar asks him to open the phone app, not the vault.
- First sentence: "The sign-ins sat in 1Password; VaultWarden keeps the vault on the Core, and the family's phones fill them in." (19 words)
- Why it differs: the test is a partner at a counter, with his own phone, not a lead at a desk.
- Check: QA screenshot yes; fleet use 12 (at the cap).

**US5. Syncthing, Resilio Sync.** As the household lead, I want the retired workshop laptop's folders kept in step with the Core, so that the 3D-printer files are where the new machine looks.
- Who and when: Dev (50, electronics repairer) and his daughter Pilar (16), a Saturday in November.
- App `syncthing`. Service `resilio-sync`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. Syncthing keeps folders in step between devices with no cloud in the middle; the devices are at home. A deleted file is deleted on the other side too: sync is not a backup, said once.
- Moment: `garage` room, anchor `room` (fallback `desk`). The first thing: Pilar chooses which folder she wants on her laptop; Dev tapes a label on the old laptop that says it retires on Sunday.
- First sentence: "The workshop folders were shared through Resilio Sync; Syncthing keeps them in step with the Core, no cloud between." (19 words)
- Why it differs: a teenager chooses; retiring a machine is a ceremony; the workbench with old hardware, which is the chapter's own shot.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US6. Vikunja, Asana.** As the household lead, I want one Saturday board that my partner writes on as much as I do, so that her jobs are not a list in my head.
- Who and when: Sunniva (44, IT support) and her partner Emre (42, chef), Saturday morning with coffee.
- App `vikunja`. Service `asana`. Caveat: tasks, boards and reminders; a job is a house job and never about a person. The listing says it supports CalDAV sync, which no story shows. One tasks app per household (Vikunja, Super Productivity, Yuvomi, HomeHub).
- Moment: `living` room, anchor `couch` (fallback `tv`). The first thing: Emre adds "fix the gate latch" in his own words before Sunniva says anything.
- First sentence: "The weekend jobs sat in an Asana project; Vikunja gives both of them a board on the Core." (18 words)
- Why it differs: the non-tinkerer is the author and the one who sets the order of work; no lamp, no router; the lead listens.
- Check: QA screenshot yes; fleet use 3.

**US7. SearXNG, Bing.** As the household lead, I want the family's browsers to start from a search page on the Core, so that what the house searches goes out through one place I can describe.
- Who and when: Hamid (53, systems administrator) and his partner Miriam (51, optician), a Thursday evening in January.
- App `searxng`. Service `bing`. Caveat: SearXNG queries outside search engines for you; call it private search, never offline search, and make no claim about what those engines do. The catalog marks it with-caveat.
- Moment: `kitchen` room, anchor `kitchen-island` (a fallback anchor of the row; the room is not in the row). The first thing: Miriam types the question she always does and Hamid watches her face, not the page.
- First sentence: "The tablet's search went through Bing; SearXNG asks the engines from the Core and hands back one page." (18 words)
- Why it differs: a decision about the whole house's habit, tested by one person's glance; the caveat is the story.
- Check: QA screenshot yes; fleet use 0.

**US8. Open WebUI, Claude.** As the household lead, I want a model on the Core to draft one named chore from my own notes, so that the page of what changed this month is drafted and I only correct it.
- Who and when: Farah (43, data engineer), the last day of the month. Her partner reads the page and says whether it is plain enough.
- App `open-webui`. Service `claude`. Caveat: a chat app, so the member is 16 or older (rule `age-chat`; Farah is an adult). Say "a model on the Core"; never claim it matches a hosted model and never give a speed. Leave cloud models off and show no key. The limit is said once: it can be wrong, so the household lead checks. This is the third beat of a family, never the first.
- Moment: `office` room, anchor `desk` (fallback `room@office`). The first thing: she reads last month's page herself and marks one sentence with a pen; only then does she ask the model for the next draft.
- First sentence: "Her change note was drafted in Claude; Open WebUI drafts it on the Core's model, and she checks it." (19 words)
- Why it differs: an AI beat with a bounded chore and a hand on the pen; the chore is documentation, not code or a house control.
- Check: QA screenshot yes; fleet use 8.

**US9. HomeBox, Sortly.** As the household lead, I want to know which cable, charger or spare drive is in which tub on the shelf, so that nobody opens six tubs for one USB lead.
- Who and when: Mehmet (47, marine engineer) and his daughter, who looks for a charger. A Sunday of tidying.
- App `homebox`. Service `sortly`. Caveat: the catalog lists no recorded QA run, so each beat needs an owner entry in `reviewed.json`. Barcode and food-database lookups call outside services; leave them off. It catalogues; warranty dates are typed by hand.
- Moment: `garage` room, anchor `bookshelf` (fallback `room@garage`). The first thing: he writes a number on a tub with tape, then his daughter finds the charger by that number, before the app opens.
- First sentence: "Spare cables sat in a Sortly list on one phone; HomeBox keeps the tubs and shelf on the Core." (19 words)
- Why it differs: an inventory of the house's hardware, found by a number on a tub; the child finds, the lead numbers.
- Check: QA screenshot no (owner entry needed); fleet use 0.

**US10. PrivateBin, Pastebin.** As the household lead, I want a pasted error to be read once and gone, so that a log with the house's addresses in it does not sit on a page.
- Who and when: Oluwaseun (15, school laptop trouble) pastes; Aziz (49, network technician) reads. A school evening.
- App `privatebin`. Service `pastebin`. Caveat: the paste burns after one read; the link opens on the home Wi-Fi only. No claim about encryption or about who can open it. A household keeps one burn-after-reading note app (PrivateBin, Cryptgeon, Enclosed). Oluwaseun is under 16 and uses no chat model or agent.
- Moment: `bedroom` room, anchor `desk` (fallback `bed`). The first thing: Oluwaseun pastes the error and calls down the hall rather than sending it; Aziz reads it once at his own desk.
- First sentence: "Error text used to go into Pastebin; PrivateBin takes it on the Core and lets it burn after one read." (20 words)
- Why it differs: the teenager is the actor, and the lead is the one who waits; a quick fix, not a project.
- Check: QA screenshot yes; fleet use 0.

## 4. Boundaries these stories keep

- **The household lead, not the admin.** Five of the ten leads are women and the names run across heritage; the partners and the teenagers are the testers. Nobody is a hooded figure, no screen is readable and no benchmark appears.
- **No way in from outside.** Every scene is at home on the home Wi-Fi; no story reaches the Core from outside the house. The words the validator bans for that are absent from the sentences above.
- **Regulated words.** None touches health, legal, finance, children's records or education records. The one teenager's school laptop (US10) is mentioned only as the place an error appeared.
- **The model.** US8 is the only chat beat, with an adult, a named chore and the limit said once. Pi-hole does not appear (the chapter owns it), and where it is meant it is only a DNS filter.
- **The old places.** A service is named only as the old place and in the chip "alternative to <Service>". No sentence says what a company does, charges, learns or watches.
- **The honest caveats that ride along on every story:** installing apps uses the internet; the Core is not a backup; no price, no saving, no time saved, no speed.

## 5. Open items for the owner

- **Owner entries in `reviewed.json`** (rule `app-qa-screenshot`) are needed before a beat can use Syncthing (US5) or HomeBox (US9). The other eight apps have a QA screenshot.
- **Rooms outside the row.** The `tech-family` row lists `garage`, `office`, `entry`, `living` (fallback `bedroom`, `dining`). US4 and US7 use `kitchen`, which is not in the row; US10's `bedroom` is one of its fallback rooms. The anchors `counter`, `kitchen-island` and `bookshelf` are all in the row's lists. If the stories are cast, widen the row's rooms or let the cast plan carry the exception.
- **Household kinds.** Tasks (US6), wiki (US2), burn-after-reading note (US10) and password vault (US4) are kinds with one app per household in `HOUSEHOLD_KINDS`; Syncthing, SearXNG, Gitea, Uptime Kuma, HomeBox and Open WebUI are in none, so the check will not warn on a second one.
- **Fleet headroom.** VaultWarden is at the cap (US4), Gitea has thirteen beats and Open WebUI eight (US3, US8): use those two only where the family has none.
- **Registry check, 2026-10-20.** Each of the ten pairs is listed in `services.json` (service with no flag, `alternativeToForm` ok, `storyStatus` ok, the app under its `storyApps`) and in `catalog-apps.json` (in the live store, `storySafe` yes except SearXNG which is with-caveat, none avoid; Open WebUI is the only chat app). No pair is used by any of the 30 family files. The first sentences were checked against the error-severity banned phrases of `claims.json`.
