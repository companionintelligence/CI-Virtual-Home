# Builder: ten more user stories (`builder`)

Draft, written 2026-10-20 for the owner. It extends chapter 3.2 of [persona-bible.md](../persona-bible.md) and the `builder` row of `content/story/personas.json`; it changes no source file. Nobody here is a customer: ages, jobs, rooms and lines are design choices for fictional characters, and the first names are working names that the cast plan may replace (none is in `casting.json` or on the avoid list). Companion OS, Companion Memory and Companion Agents are in beta. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**What this file is for.** The builder of the chapter is John: a software engineer at a desk, with his own repositories on a shelf in the house, a local model he reads before he approves, and an employer whose code does not move. The thirty families repeat that picture: a laptop, a Git host, a stack trace, a bit of Home Assistant. These ten stories keep the maker of software but change the life around it: a retired surveyor learning to code, a market-stall owner whose script is also her shop, a freelancer's first Monday, a code club at the dining table, a cricket club's season, a repair café's lending list, a handover to a younger sister, a mother-in-law's kitchen, an old laptop on a dryer and a choir's website. Each uses a catalog app and a registry service that no family beat pairs today.

**Employer and client code.** The chapter's honest limit holds in every story: an employer's or a client's repositories, Actions workflows and chat do not move to the Core, and the story says so where it matters (story 3). Nothing here shows a terminal, legible code, a key field, a CI run or a speed meter.

**Age rule.** Nobody under sixteen uses a chat model or an agent. Stories 1 and 2 use a coding agent and a model; their builders are adults who approve the result. Children appear in stories 4 and 7 as the ones helped; they use no chat or agent app, and the beat belongs to the adult. Remote access is not claimed: every scene is on the home network.

## 1. What the chapter and the families already show

**The chapter (3.2).** John, 45. Ranked Hub apps: Forgejo and Gitea (GitHub, GitLab), Code Server (VS Code, Cursor), Ollama and Open WebUI (ChatGPT, Claude), VaultWarden. Shots are behind or beside the screen, never over the shoulder, with a hold on the approval gesture; the limits are that work repositories and employer chat do not move and that the model is capable, not the best this month. Hoppscotch, IT-Tools and Woodpecker CI are live but not in the story catalog.

**The pool** (`personas.json`, 8 apps): Code Server, Forgejo, Gitea, Ollama, Open WebUI, OpenClaw, JupyterLab and n8n. The catalog admits Aider and OpenCode for the builder (2026-10-15, wired to the local model) but the pool does not list them and no family names either.

**The families** (a count of beats that name an app, read from `content/families/*.json`, 2026-10-20). There are 22 builders in the 30 family files, aged 34 to 70: firmware, robotics, mobile and backend developers, a technical lead, an IoT consultant, a game-engine programmer, a cloud engineer, a devops engineer, a retired developer. They have 130 app beats. The apps: Gitea 12, Hermes 11, Forgejo 11, OpenClaw 9, Yuvomi 8, JupyterLab 7, Frigate 6, Pi-hole 6, Navidrome 5, Open WebUI 5, Home Assistant 5, Grocy 4. The services named: GitHub 25, Ring 6, ChatGPT 6, Google Home 6, Spotify 5, NextDNS 5, Zapier 4, AnyList 4, Cursor 4, Datadog 3. Where they stand: `room` 30, the couch 18, the desk 14, the Core 12, the dining table 12, the garden 7; the chapters sit in the office 45, living 26, garden 17, kitchen 14, garage 11, bedroom 8 and dining 6.

**What that leaves.** A builder who is retired, who is a parent running a club, who is leaving a job, who is writing for a sister or a mother-in-law, or who builds with data and tables rather than code is not in the 130. Neither is a coding agent, a script that calls the model, a dashboard, a table app, a wiki handover or a watched website.

## 2. How the ten were chosen

- Each differs in kind: a different room, a different moment of the week or the year, a different person who acts or is helped, and a different thing being built.
- Each is one catalog app (`storySafe` yes, or with-caveat for Aider and copyparty; never `avoid`) with one registry service (no flag, `alternativeToForm` ok, `storyStatus` ok, the app is in the service's `storyApps` and has its name in its own `replaces`). Six of the ten apps are named by no family beat (Aider, Ollama, copyparty, Metabase, Baserow, Syncthing); the other four are named by 3 to 15 beats (Gitea 13, BookStack 3, Home Assistant 15, Uptime Kuma 3) but never with the service used here. Seven of the ten services are named by no family beat (GitHub Copilot, OpenAI, GitLab, Tableau, Confluence, Amazon Alexa, New Relic); Google Drive is named in 14, Airtable once and Dropbox three times, always with other apps. No pair repeats a pair of any family beat.
- The chip pair of every story is the app's display name, then `alternative to <Service>` (story v3 D5). The first sentence says what a rented tool held or changed and what the Core does instead; no company is named in it and none is accused of anything.
- The model beats (1 and 2) carry the chapter's rule: one named, checkable chore, then the person reads and approves; "the model on the Core"; no hosted-model name, key, parity, speed or size (`cap-parity`, `num-tokens`, `cap-cloud-model`). The coding agent is described only as "a model on the Core".
- The fleet cap is 40% of homes (14 of 36). Forgejo is at 12 homes and Gitea at 9 (bible table 3.2): Forgejo is not used, and Gitea appears once, in story 3.
- Fresh against the other persona drafts of 2026-10-20 where it could be: eight of the ten pairs are in no other draft, and the caveats of stories 7 and 10 name the drafts that share theirs.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first), who acts and who is helped, and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation mark, no figure, no company named).

| # | App and service | Who (working name, age) | Room and anchor | When |
|---|---|---|---|---|
| 1 | Aider, alternative to GitHub Copilot | Cornelius, 67, a retired land surveyor | `patio`, `patio-seat` | Sunday late afternoon |
| 2 | Ollama, alternative to OpenAI | Lucia, 35, a market-stall owner | `kitchen`, `counter` | Saturday, early light before the market |
| 3 | Gitea, alternative to GitLab | Wiremu, 40, a freelancer from today | `office`, `desk` | The first Monday after leaving a job |
| 4 | copyparty, alternative to Google Drive | Torsten, 44, with Pippa, 12, and two cousins | `dining`, `dining-table` | Saturday morning |
| 5 | Metabase, alternative to Tableau | Ravindra, 45, scorer of a village cricket club | `living`, `couch` | Sunday, golden hour |
| 6 | Baserow, alternative to Airtable | Niamh, 48, a volunteer at a repair café | `garage`, `room` | Friday afternoon |
| 7 | BookStack, alternative to Confluence | Felix, 19, with his sister Liv, 14 | `bedroom`, `desk` | A week before he leaves for university |
| 8 | Home Assistant, alternative to Amazon Alexa | Vasco, 39, with his mother-in-law Soledad, 68 | `kitchen`, `range` | Saturday morning during her stay |
| 9 | Syncthing, alternative to Dropbox | Quentin, 31, in a small flat | `laundry`, `laundry` | Wednesday late morning |
| 10 | Uptime Kuma, alternative to New Relic | Hanne, 62, webmaster of a village choir | `living`, `fireplace` | Sunday morning |

**1. Aider, alternative to GitHub Copilot.** As a builder who writes for himself, I want a model on the Core to change my code and commit each change, so that I read every change before I keep it and can undo it.
- App `aider`, service `github-copilot`. Caveat: Aider is an agent: it edits files and commits each change to git using the model on the Core, and the commit is the approval step; he reads the diff and can undo it with git (agents prepare, people approve; `cap-autonomy`). The browser interface is marked experimental upstream: do not call it finished. No key, no hosted-model name, no parity or speed claim (`cap-parity`). The member is sixteen or older (age rule 16). Companion Agents are in beta. No QA screenshot (owner entry). Only the catalog admits it; the builder pool does not list it.
- Moment: `patio`, anchor `patio-seat` (fallback `garden`, `deck`, `room`). Sunday late afternoon, golden light. First: a laptop on the garden table beside a mug, and a finger on one changed line.
- Who: Cornelius, 67, a retired land surveyor, writes a small tool that turns plot measurements into a planting plan. He does not write software for a living: the tool is the job on the Core.
- First sentence: "Cornelius lets a model on the Core change his code, and he keeps only the commits he has read."
- Popup title: "He reads the commit first".
- Different in kind: the first agent story that is not a drafted message; a retiree builder; the patio, not the desk.
- Category `productivity`.

**2. Ollama, alternative to OpenAI.** As a builder who also runs a stall, I want my script to ask the model on the Core to sort the week's order notes, so that the pick list is ready and I check it by hand.
- App `ollama`, service `openai`. Caveat: Ollama is the engine only: it has no chat window and sits behind a script or another app. It serves on the CPU unless the host passes a GPU in, so nothing is said about speed. No model name or size, no parity, no key (`cap-cloud-model`). The output can be wrong and she checks it. The member is sixteen or older. Companion OS is in beta. No QA screenshot (owner entry).
- Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`, `dining-table`). Saturday, early light before the market. First: a printed pick list is laid on the counter and checked against the order notes line by line with a pencil.
- Who: Lucia, 35, sells preserves at a weekend market and writes the stall's small scripts.
- First sentence: "Lucia's order script sends the week's notes to the model on the Core, and she checks the pick list by hand."
- Popup title: "The pick list, checked by hand".
- Different in kind: the builder is also the shop; a script calls the model, there is no chat window; the kitchen counter.
- Category `small-business`.

**3. Gitea, alternative to GitLab.** As a builder starting out alone, I want my own starter code on the Core on my first morning, so that the agency's work stays the agency's and mine is mine.
- App `gitea`, service `gitlab`. Caveat: only his own repositories move. The agency's and its clients' repositories stay where they are, and the first comment on the first repository says so. Gitea says where the repositories are (on the Core) and does not claim to sync with or be compatible with another host. The package ships the forge and its database only, so no CI run is shown. One Git host per household: Gitea or Forgejo. The catalog's own name for the old service is "GitLab (SaaS)".
- Moment: `office`, anchor `desk`. The first Monday after leaving a job, morning light. First: a box of personal things on the floor and the laptop open to an empty repository.
- Who: Wiremu, 40, left an agency on Friday and starts as a freelancer today.
- First sentence: "On his first Monday as a freelancer, Wiremu brings his own starter code to the Core and leaves the agency's where it is."
- Popup title: "His own code comes home".
- Different in kind: a career moment; the line between own and employer's is the whole story.
- Category `small-business`.

**4. copyparty, alternative to Google Drive.** As a builder who runs a code club, I want every child's finished work in one folder, so that I read it with them on the day and not later on my own.
- App `copyparty`, service `google-drive`. Caveat: copyparty is a file server with a media player, search and a Markdown editor in the browser; it reaches only devices on the home Wi-Fi, so the cousins use it while they are in the house. The children use no chat model or agent, and their work is theirs. No children's-data or safety claim. The maker draft also uses copyparty, with another service.
- Moment: `dining`, anchor `dining-table`. Saturday morning. First: three children's laptops on the table and a folder named for the week.
- Who: Torsten, 44, hosts a Saturday code club for his daughter Pippa, 12, and two cousins, 11 and 13. The children are helped; the beat belongs to the adult.
- First sentence: "Each child at the code club drops finished work into one folder on the Core, and Torsten reads it with them."
- Popup title: "A folder for the code club".
- Different in kind: the builder as a teacher; children are present and active with a plain tool; a shared folder, not a repository.
- Category `kids`.

**5. Metabase, alternative to Tableau.** As a builder who keeps a club's scores, I want to ask the season a question and get a chart from the file, so that I stop counting fixtures on the back of a programme.
- App `metabase`, service `tableau`. Caveat: Metabase asks questions of data you give it; web interface only. No QA screenshot (owner entry). No insight, accuracy or speed claim, and no chart on a screen. The questions are his. The data is adults' scores, not children's. Power BI is also in the catalog's list; this story names Tableau.
- Moment: `living`, anchor `couch` (fallback `room`). Sunday, golden hour. First: a laptop on the arm of the couch and a printed fixture list on a cushion.
- Who: Ravindra, 45, keeps the results of a village cricket club.
- First sentence: "Ravindra asks the club's season a question, and the chart comes from a file on the Core."
- Popup title: "A question for the season".
- Different in kind: a builder who builds with data, not code; a hobby club; the couch.
- Category `productivity`.

**6. Baserow, alternative to Airtable.** As a volunteer who can build, I want the repair café's lending list to be a table, so that Saturday's sheet is printed from it and nobody guesses who has the drill.
- App `baserow`, service `airtable`. Caveat: Baserow turns a database into a spreadsheet-style app and overlaps NocoDB and Grist: one table app per household. It is on the home network only, so the other volunteers get the printed sheet, not a sign-in. First names of volunteers only. Airtable is named in one family beat, with Grist.
- Moment: `garage`, anchor `room` set to the garage (fallback `driveway`). Friday afternoon. First: a shelf of labelled drills and a clipboard; she types the loans from the clipboard.
- Who: Niamh, 48, a backend developer, volunteers at a repair café and keeps its tool list at home.
- First sentence: "Niamh turns the repair café's lending list into a table on the Core, and prints Saturday's sheet from it."
- Popup title: "The lending list is a table".
- Different in kind: unpaid community work; a table, not code; the garage shelf.
- Category `productivity`.

**7. BookStack, alternative to Confluence.** As an older brother leaving home, I want to write down how the house scripts work for the one who will keep them going, so that she is not alone with them.
- App `bookstack`, service `confluence`. Caveat: BookStack is a wiki of books, chapters and pages, with search and history. The pages are for his sister at home: no promise of help from university (`cap-remote-access`). No employer documents. John's "What only John knows" (Brennan) is a BookStack beat with Notion; the educator and tech-family drafts use this pair for other jobs. The sister reads and uses no chat model.
- Moment: `bedroom`, anchor `desk` (fallback `room`). A Sunday afternoon, a week before he leaves. First: a half-packed suitcase beside the laptop; he starts a new book and names the first chapter.
- Who: Felix, 19, writes for his sister Liv, 14, who will keep the scripts running.
- First sentence: "Before Felix leaves for university, he writes how the house scripts work, in books and pages on the Core."
- Popup title: "Written down for his sister".
- Different in kind: a handover to a younger sibling; a leaving; writing for a reader who knows less.
- Category `home`.

**8. Home Assistant, alternative to Amazon Alexa.** As a builder staying with in-laws, I want my mother-in-law's kitchen routine rebuilt as she describes it, so that the lamp and the timer do what she asked.
- App `home-assistant`, service `amazon-alexa`. Caveat: it needs devices Home Assistant can reach on the home network (a Wi-Fi lamp). There is no Zigbee stick and no voice speaker by default; Home Assistant Voice is a separate app with its own hardware. No energy-saving claim. She approves every rule. The voice product's name appears only in the chip. The host draft uses the app with other services.
- Moment: `kitchen`, anchor `range` (fallback `kitchen-island`, `counter`). Saturday morning during her stay. First: her hand on the kettle, a lamp over the range and a card with her timer rules in her own words.
- Who: Vasco, 39, builds; Soledad, 68, his mother-in-law, says what each rule should do and tests it. She is the one who specifies, not the one who is helped.
- First sentence: "Vasco rebuilds his mother-in-law's kitchen routine in Home Assistant, so the lamp over the range does what she asked."
- Popup title: "Her kitchen routine, rebuilt".
- Different in kind: a builder building to a guest's spec; an older person who sets the requirements; hardware-light.
- Category `iot`.

**9. Syncthing, alternative to Dropbox.** As a builder with two laptops, I want one folder kept in step between them, so that my notes are where I am without a service in the middle.
- App `syncthing`, service `dropbox`. Caveat: no QA screenshot (owner entry). Syncthing keeps folders in step between devices on the home network. A sync is not a backup: a delete on one reaches the other, and Duplicati is a separate job. Employer files do not move. The Core can be one of the devices. The creative, lawyer and tech-family drafts use Syncthing with other services.
- Moment: `laundry`, anchor `laundry` (fallback `room`). Wednesday late morning. First: an old laptop on the dryer, and a folder name appears on it.
- Who: Quentin, 31, builds from a small flat with a new laptop and an old one that lives in the laundry nook.
- First sentence: "Quentin's notes follow him from the study laptop to the old one on the dryer, with no cloud in the middle."
- Popup title: "One folder, two laptops".
- Different in kind: a tiny flat; the laundry nook; device to device rather than a server.
- Category `productivity`.

**10. Uptime Kuma, alternative to New Relic.** As a volunteer webmaster, I want to see from home whether the choir's website answers before I post a notice, so that I do not post into a page that is down.
- App `uptime-kuma`, service `new-relic`. Caveat: Uptime Kuma watches sites and services and tells her when one stops answering. It knows that a page answers, not how well; no uptime, speed or "never goes down" claim (`cap-uptime`). Alerts that need a phone push use an outside relay, so the scene shows none. The choir's site is hosted elsewhere and stays there. The tech-family draft uses this pair; Rohan, Samir and Andres use the app with Datadog.
- Moment: `living`, anchor `fireplace` (fallback `couch`, `room`). Sunday morning by the cold hearth, window light. First: a printed concert notice leaned against a mug while she checks that the page answers.
- Who: Hanne, 62, builds and keeps the village choir's site as a volunteer.
- First sentence: "Hanne checks from the Core whether the choir's website answers, before she posts the concert notice."
- Popup title: "The choir's website, checked at home".
- Different in kind: an older woman as the webmaster; a community site; the Core watches something that lives elsewhere.
- Category `productivity`.

## 4. How the ten differ from each other

| Axis | Spread |
|---|---|
| Age of the person who acts | 19, 31, 35, 39, 40, 44, 45, 48, 62, 67 |
| Who is helped | a younger sister, a mother-in-law, a daughter and two cousins, a club, a café's volunteers, a choir, a market stall's customers |
| Rooms | patio, kitchen (twice), office, dining, living (twice), garage, bedroom, laundry |
| Moment | Sunday late afternoon, Saturday early light, a first Monday, Saturday morning, golden hour, Friday afternoon, the week before a leaving, a guest's stay, a Wednesday late morning, a Sunday morning |
| What is built | a planting tool, an order script, starter repositories, children's code, a club's season, a lending table, a handover wiki, a kitchen routine, a synced notes folder, a website's watch |

## 5. Checks run and open items

Checked on 2026-10-20 against the files in this tree (a script read `catalog-apps.json`, `services.json`, `casting.json`, the 30 family files and the other persona drafts):

- Every app id is in the catalog, is in the live store and is not `avoid`. Aider and copyparty are `with-caveat`; the other eight are `yes`. No app or service repeats inside this file.
- Every service id is in `services.json` with no flag, `alternativeToForm` ok and `storyStatus` ok; the app is in that service's `storyApps` and the service is among the app's own `replaces`.
- No pair appears in any family beat. Eight of the ten pairs are in no other persona draft read on the same day; BookStack with Confluence (educator, tech-family) and Uptime Kuma with New Relic (tech-family) are shared, and their caveats say so. Four apps are also in another draft with a different service (Gitea, copyparty, Syncthing, Home Assistant).
- The ten first sentences are 16 to 23 words, with no digit, dash or exclamation mark, no company name and none of the `claims.json` error patterns.

Open items for the owner:

- **`reviewed.json`.** Aider, Ollama, Metabase and Syncthing have no QA screenshot on `origin/main`; a beat that names any of them needs an owner entry (`app-qa-screenshot`).
- **Pool.** Two of the ten apps (Ollama and Gitea) are in the `builder` row of `personas.json`; `cast-lint.mts` has a wider builder pool that lists Aider, Gitea and Uptime Kuma. `persona-cover` needs only one pool app in a builder's beats, so this is not a blocker.
- **Coding agents.** Story 1 is the only coding-agent story; the catalog's rule is that the beat shows the person approving the change. A second (OpenCode, alternative to Cursor) was left out so that the agent does not become the hero (bible rule 2).
- **Beyond the home.** An employer's, an agency's or a client's repositories, a club's or a café's other volunteers, and the host of the choir's website are outside what a home Core holds; none is told here beyond the one person at the table.
