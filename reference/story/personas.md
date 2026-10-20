# Persona homes (the contract)

Every one of the 30 homes is lived in by a fictional family. Each member has an **archetype**: the job they do on the
family's one Companion Core. A room tells that member's story: what they do there, which Companion Hub store app does
it, and which cloud service it replaces. The tour is the argument for uncloud: the same life, on your own hardware.

This file is the brief for casting, writing, the validator and the film. Read it with [validator.md](validator.md),
[bake.md](bake.md) and `content/story/claims.json`.

## Archetypes

`member.archetype` (schema enum, mirrored in `assets/story/types.ts`):

| Archetype | Who | Where they are (anchor roles, in preference order) | App pool (store ids) |
|---|---|---|---|
| `organiser` | Runs the household and often a small business from a home office. Sally. | `desk` in the `office` room; fallback `dining-table`, `couch`, `room` | `ci-planning`, `nextcloud`, `libreoffice`, `paperless`, `stirling-pdf`, `vaultwarden`, `joplin`, `bookstack`, `n8n`, `yuvomi` |
| `builder` | Writes software for a living, laptop on the desk. John. | `desk` (laptop, dual monitors) in `office`, `bedroom` or `living`; fallback `dining-table`, `room` | `code-server`, `forgejo`, `gitea`, `ollama`, `open-webui`, `ci-openclaw`, `jupyterlab`, `n8n` |
| `gamer` | Plays on the Core, from the couch or from the bedroom. Steve. | `tv`, `bed`, `desk` in `kids`, `bedroom` or `living`; fallback `couch`, `room` | `steam-headless`, `jellyfin`, `immich` |
| `learner` | Studies and reads; homework, languages, exams. Jean. | `desk`, `bookshelf` in `kids`, `bedroom`, `office`; fallback `couch`, `room` | `open-webui`, `calibre-web`, `libretranslate`, `obsidian`, `jupyterlab`, `ci-spellbook`, `koodo-reader`, `booklore`, `kokoro`, `razzia`, `readeck`, `linkwarden` |
| `maker` | Paints, photographs, writes, plays. | `easel`, `music`, `desk` | `immich`, `ci-planning`, `obsidian`, `jellyfin` |
| `host` | Feeds, ferries, waters and tidies the house; the household's shared beats. | `kitchen-island`, `fridge`, `range`, `garden`, `couch`, `tv` | `immich`, `jellyfin`, `home-assistant`, `mealie` or `kitchenowl`, `hortusfox`, `yuvomi` |
| `tech-family` | The household lead of a family that runs its own network and lamps; the family is the acceptance test. Andres. | `room`, `desk`, `core`, `counter` in `garage`, `office`, `entry`, `living`; fallback `couch`, `tv`, `kitchen-island`, `bookshelf` | `home-assistant`, `pi-hole`, `forgejo`, `ntfy`, `uptime-kuma`, `open-webui`, `ollama`, `vaultwarden`, `n8n`, `syncthing` |
| `business-owner` | Runs a shop, studio, agency or practice of one to fifteen people: quotes, invoices, contracts. Ruth. | `desk`, `dining-table`, `counter`, `bookshelf` in `office`, `dining`, `living`, `kitchen`; fallback `kitchen-island`, `couch`, `room` | `nextcloud`, `invoice-ninja`, `paperless`, `docuseal`, `akaunting`, `twenty`, `vaultwarden`, `anything-llm`, `solidtime`, `grist`, `bookstack`, `baikal`, `libreoffice`, `stirling-pdf`, `whisper-webui`, `ci-memory` |
| `creative` | A working designer, photographer, filmmaker or musician: client work and a confidential brief. Dalia. | `easel`, `desk`, `music`, `bookshelf` in `office`, `living`, `bedroom`, `garage`, `dining`; fallback `dining-table`, `tv`, `couch`, `room` | `immich`, `nextcloud`, `penpot`, `inkscape`, `open-webui`, `invoice-ninja`, `vaultwarden`, `whisper-webui`, `docuseal`, `freecut`, `audiomass`, `photoview`, `pingvin-share`, `syncthing`, `navidrome` |
| `contractor` | A self-employed tradesperson: the quote, the site photos and the tools, from the garage bench. Kunle. | `room`, `desk`, `driveway`, `laundry` in `garage`, `office`, `entry`, `laundry`; fallback `bookshelf`, `kitchen-island`, `dining-table`, `core` | `invoice-ninja`, `immich`, `homebox`, `lubelogger`, `paperless`, `docuseal`, `solidtime`, `vaultwarden`, `nextcloud`, `radicale`, `stirling-pdf`, `open-webui`, `planka`, `akaunting` |
| `marketer` | A freelance or in-house digital marketer: the client's list, files and briefs. Elena. | `desk`, `kitchen-island`, `counter`, `dining-table` in `office`, `living`, `dining`, `kitchen`; fallback `bookshelf`, `couch`, `room` | `open-webui`, `ci-memory`, `nextcloud`, `ghost`, `penpot`, `vaultwarden`, `twenty`, `whisper-webui`, `listmonk`, `plausible`, `n8n`, `inkscape`, `freecut`, `mixpost`, `solidtime`, `grist` |
| `lawyer` | A solo or small-firm attorney: the client file and the engagement letter. Ingrid. | `desk`, `bookshelf`, `dining-table` in `office`, `dining`, `living`; fallback `couch`, `kitchen-island`, `room` | `paperless`, `nextcloud`, `docuseal`, `open-webui`, `libreoffice`, `vaultwarden`, `stirling-pdf`, `cryptgeon`, `ollama`, `whisper-webui`, `radicale`, `solidtime`, `invoice-ninja`, `bookstack`, `twenty`, `ci-memory` |
| `journalist` | A reporter or researcher: the tape, the notes and the records. Noor. | `desk`, `bookshelf`, `dining-table` in `office`, `dining`, `kitchen`, `living`; fallback `couch`, `kitchen-island`, `room` | `whisper-webui`, `paperless`, `obsidian`, `open-webui`, `nextcloud`, `vaultwarden`, `ci-memory`, `stirling-pdf`, `libretranslate`, `linkwarden`, `libreoffice`, `cryptgeon`, `joplin`, `anything-llm`, `miniflux`, `element` |
| `educator` | A teacher, tutor or homeschooling parent: lesson folders and report comments. Eszter. | `dining-table`, `desk`, `bookshelf`, `kitchen-island` in `dining`, `office`, `living`, `kitchen`, `kids`; fallback `easel`, `couch`, `room` | `open-webui`, `paperless`, `nextcloud`, `libreoffice`, `libretranslate`, `joplin`, `stirling-pdf`, `vaultwarden`, `razzia`, `excalidraw`, `ci-planning`, `radicale`, `calibre-web` |
| `money-keeper` | Owns the household ledger: bills, subscriptions, shared costs and the receipts behind them. Padma. | `dining-table`, `desk`, `kitchen-island`, `bookshelf` in `dining`, `office`, `kitchen`, `living`; fallback rooms `bedroom`, `laundry`, anchors `counter`, `fridge`, `couch`, `laundry`, `room` | `firefly-iii`, `wallos`, `spliit`, `monetr`, `papra`, `grist`, `homebox`, `vaultwarden` |
| `housemate` | Shares a rented flat on one Core: the bills, the chores, the shelf and the telly. Tamsin. | `fridge`, `kitchen-island`, `dining-table`, `couch`, `tv` in `kitchen`, `living`, `dining`; fallback rooms `entry`, `laundry`, `bedroom`, anchors `counter`, `bookshelf`, `bicycle`, `laundry`, `desk`, `room` | `spliit`, `donetick`, `wallos`, `pairdrop`, `jellyfin`, `kitchenowl`, `homebox` |
| `carer` | Keeps the post, the calendar and the notes for a parent, partner or relative they look after, with that person's say. Idris. | `dining-table`, `desk`, `counter`, `fridge`, `bookshelf` in `dining`, `office`, `kitchen`; fallback rooms `living`, `entry`, anchors `couch`, `front-door`, `room` | `radicale`, `homehub`, `paperless`, `donetick`, `audiobookshelf`, `immich`, `vaultwarden`, `medikeep` |
| `community-lead` | Runs a club, choir, tenants' group or committee from the kitchen table: roll, minutes, rota and small budget. | `dining-table`, `desk`, `bookshelf`, `counter`, `fridge` in `dining`, `kitchen`, `office`, `living`; fallback rooms `entry`, `bedroom`, anchors `kitchen-island`, `couch`, `room` | `grist`, `radicale`, `bookstack`, `vikunja`, `planka`, `akaunting`, `papra`, `nextcloud` |
| `researcher` | Reads, cites and writes up from sources: papers, archives and translated texts, with the reading, the notes and the drafts kept on the Core. | `desk`, `bookshelf`, `dining-table` in `office`, `dining`, `living`, `bedroom`; fallback rooms `kitchen`, anchors `couch`, `kitchen-island`, `room` | `linkwarden`, `readeck`, `logseq`, `obsidian`, `libretranslate`, `paperless`, `anything-llm`, `grist`, `jupyterlab` |
| `seller` | Sells what they make or find at a stall and by message, and keeps the stock, photos and invoices at home. Wren. | `dining-table`, `desk`, `bookshelf`, `room` in `dining`, `office`, `garage`, `kitchen`; fallback rooms `living`, `bedroom`, `entry`, anchors `counter`, `kitchen-island`, `couch` | `baserow`, `homebox`, `invoice-ninja`, `invio`, `photoview`, `immich`, `activepieces`, `vaultwarden` |
| `translator` | A freelance translator or subtitler: the draft, the notes and the client's PDFs sit on the Core, and every line is rewritten by hand. Noa. | `desk`, `bookshelf`, `dining-table` in `office`, `bedroom`, `dining`, `living`; fallback rooms `kitchen`, anchors `couch`, `kitchen-island`, `room` | `libretranslate`, `stirling-pdf`, `solidtime`, `invio`, `joplin`, `akaunting`, `paperless`, `libreoffice`, `whisper-webui`, `kokoro` |
| `archivist` | Scans and files the family's slides, letters and home films, and keeps them where the family's later readers can find them. Odalys. | `dining-table`, `bookshelf`, `desk`, `music` in `dining`, `living`, `office`, `bedroom`; fallback rooms `kitchen`, `garage`, anchors `tv`, `couch`, `room` | `photoprism`, `librephotos`, `papra`, `duplicati`, `archivebox`, `memos`, `navidrome`, `jellyfin`, `immich`, `paperless` |
| `traveller` | Plans trips at the table and files the itinerary, the flight log and the photos once home. Rune. | `dining-table`, `bookshelf`, `desk` in `dining`, `living`, `office`, `bedroom`; fallback rooms `kitchen`, `entry`, anchors `couch`, `counter`, `room` | `airtrail`, `spliit`, `adventurelog`, `trip`, `libretranslate`, `vaultwarden`, `paperless`, `immich` |
| `athlete` | Trains most days, as a runner, a cyclist, a swimmer or a lifter: the runs, rides and sessions, the routes, the daily habits and the music sit on the Core. Ilse. | `bicycle`, `pool`, `front-door`, `bed` in `garage`, `entry`, `bedroom`, `living`, `patio`; fallback rooms `garden`, `laundry`, `dining`, anchors `desk`, `couch`, `patio-seat`, `room` | `endurain`, `wingfit`, `wanderer`, `habitica`, `navidrome`, `immich` |
| `collector` | Keeps a library of books, comics, records and films and knows where every one is: the files and the catalogue sit on the Core. | `bookshelf`, `music`, `tv` in `living`, `office`, `bedroom`; fallback rooms `dining`, `kids`, anchors `couch`, `desk`, `bed`, `dining-table`, `room` | `booklore`, `calibre-web`, `audiobookshelf`, `navidrome`, `jellyfin`, `homebox`, `komga`, `dvinyl` |
| `shift-worker` | Works early, late or rotating shifts that do not match the household's day, and keeps one shared week across different clocks. | `counter`, `fridge`, `dining-table`, `front-door`, `couch` in `kitchen`, `dining`, `entry`, `living`; fallback rooms `laundry`, `bedroom`, `patio`, `garden`, anchors `kitchen-island`, `laundry`, `tv`, `desk`, `patio-seat`, `room` | `radicale`, `donetick`, `vikunja`, `homehub`, `audiobookshelf`, `jellyfin`, `mealie` |

The pools are a starting point. The catalog (`content/story/catalog-apps.json`) decides what may be named at all: an id
that is not in it fails `app-unknown`. `reference/story/persona-apps.md` lists, per archetype, each app's `replaces`
names, caveats and the wording that is allowed.

A member has exactly one archetype. A family is 2 to 6 members and covers at least two archetypes. There are twenty-six: the
original six, the eight of story v3 (`tech-family`, `business-owner`, `creative`, `contractor`, `marketer`, `lawyer`,
`journalist`, `educator`, in the owner's order) and the twelve of the persona expansion (`money-keeper`, `housemate`, `carer`,
`community-lead`, `researcher`, `seller`, `translator`, `archivist`, `traveller`, `athlete`, `collector`, `shift-worker`). The
twelve are written up one by one in [personas/index.md](personas/index.md); their rows here are `content/story/personas.json`'s,
and no home is cast with one until the re-cast (`content/story/cast-plan.json`) does it. Regulated ground (a carer's post, a
researcher's sources, a club's member list) is told as record keeping only: what the app does and where the files live, with no
advice and no compliance, safety or security wording.

The front page does not filter by archetype but by **category** (`content/story/categories.json`, eight of them, each archetype in
exactly one; the chips are drawn for the categories that have a family). The list is in [personas/index.md](personas/index.md). No member under 16 has an agent companion or uses a chat model or an agent
in their own beat (age rule 16, below); a baby has no companion.

## The flagship family

Sally, John, Steve and Jean (surname `Brennan`) are the flagship family. They live in the three homes that suit all four
archetypes best: `seraphine`, `bgfamily`, `familyhouse-nora`. `casting.json` marks them `flagship: true`; the fleet's
"first name used at most twice" and "no repeated surname or companion name" rules do not apply between flagship
families, and nowhere else. Their beat text still differs per home, because their rooms do.

| Member | Age | Role | Archetype | Does |
|---|---|---|---|---|
| Sally | 43 | parent | organiser | Planning, files and paperwork for the household and her consultancy, from her office. |
| John | 45 | parent | builder | Writes code for work on his laptop; his repos and a local model on the Core. |
| Steve | 16 | teen | gamer | Games on Steam Headless, streamed from the Core to his room. |
| Jean | 14 | teen | learner | Study, reading and languages with local tools. |

Every other home has its own family on the same archetypes, trimmed or doubled to fit its rooms and bedrooms: a studio
flat gets a couple (organiser plus builder); a house with a nursery gets a baby and a host. Cast sizes follow
`story-affordances.json` (the 94 persona rooms the 30 houses can honestly host). Names are invented, varied in
heritage, and never tied to the architecture.

## What a persona beat must do

1. **One member, one room, one app.** `beat.member` is the persona; `beat.anchor` is where they are; `beat.app` is the
   one store app that does the thing. Each member has at least three beats, a persona with an archetype at least one in
   its own room.
2. **Name what it replaces.** The chip row is the app name, then `replaces <X>` where X is one of the app's catalog
   `replaces` names. That is the uncloud argument in four words; do not add adjectives to it.
3. **Name the mechanism, calmly.** Say what the cloud service would have held and where it lives now: "Sally's contracts
   sit in Nextcloud on the Core, not in a rented drive." Never "private", "secure" or "safe" on their own.
4. **Persona activity is told, not faked.** No app screenshots, no UI mockups on any screen in the scene, no invented app
   interface. The story lives in the popup, the chips and the camera; props and rooms carry the rest. (Real, labelled screenshots live on the
   pages beside the story, never in a scene: see Ads below.)
5. **One household, one Core.** Per-app logins exist only where the app has them. Never a "separate account" per person
   on the platform (`cap-multi-user`).
6. **Agents prepare, people approve.** An agent beat has `agent` and `approval`; at most six `say` lines a family.
   Children never speak. An agent is private only on the Core's local model: never mention a cloud key.
7. **The ordinary honest caveats ride along:** Companion OS is in beta, installing apps uses the internet, Steam needs a
   Valve account, remote access is not claimed, messages pass through the chat service the family picks.

### Archetype specifics

- **organiser.** Files, calendar and paperwork are what a cloud drive and a document suite would have held. Good chips:
  Nextcloud replaces Google Drive; LibreOffice replaces Microsoft Office; Paperless-ngx replaces Evernote;
  VaultWarden replaces LastPass; Companion Planning is first party (no `replaces`).
- **builder.** Source code and prompts. code-server, Forgejo or Gitea hold the code; Ollama with Open WebUI is the
  local model he asks. Say that the model runs on the Core. Never claim parity with a hosted frontier model
  (`cap-parity`) and never a tokens-per-second figure (`num-tokens`). OpenClaw is browser automation, not a coder.
- **gamer.** Steam Headless runs Steam on the Core and the family streams it to a screen in the house. It needs a Valve
  account and a GPU the Core may not have; say neither a frame rate nor "gaming PC" nor "console replacement". Keep it
  inside the home network. The privacy point is where the session runs, not that Steam is private.
- **learner.** Questions asked of a local model stay on the Core; Koodo Reader, BookLore and Calibre-Web hold the family's
  own books and Kokoro reads them aloud; Readeck and Linkwarden keep what was read for the essay; LibreTranslate keeps
  translation local. Kiwix is NOT used: it ships with an empty library. A child's questions are the privacy stake, told
  without fear (`sec-fear`); the model beats are for a learner of 16 or older (age rule 16).
- **host and maker.** The household's shared beats (photos, films, food, plants, the lights) carry the remaining
  categories the validator asks for. Immich replaces Google Photos; Jellyfin replaces Plex and Netflix for your own media.
- **tech-family.** The household lead of a family that already runs its network: Home Assistant for the lamps, Pi-hole for
  the house's DNS, Forgejo for the code, ntfy and Uptime Kuma for what broke, Syncthing for the folders. Pair every
  tinkerer scene with someone who does not tinker; call them the household lead, never admin. Pi-hole is not parental
  control, there is no Zigbee stick by default, remote access is not claimed (no VPN, tunnel or "remote"), and the model
  is the third beat with its limit said once. Never "easy", never a breach as the opening.
- **business-owner.** Quotes, invoices, signed contracts and the customer list, which used to live in four places and now sit
  in one client folder on the Core: Invoice Ninja, Nextcloud, Paperless-ngx, Docuseal, Akaunting, Twenty. Not the organiser:
  a business owner has premises, staff and books. No payroll, point of sale, card processing or bank feeds; no tax advice;
  never "legally binding". A model on the Core does one named chore on the owner's files and she reads it first.
- **creative.** Client work, an archive that outlives the job and a brief that is confidential: Immich for the shoots,
  Nextcloud for the brief, Penpot, Inkscape and FreeCut for the work. Say "under NDA" or "embargoed", not "privacy". It cannot
  move Lightroom, Photoshop, Premiere, Resolve, Ableton or Logic, and the Core is not a backup. No generative image or music
  hero, and no AI pushed at someone who rejects it.
- **contractor.** The quote written at the bench the same evening, the site photos, the tool wall: Invoice Ninja, Immich,
  HomeBox, LubeLogger, Docuseal. The anchor is `room` set to the garage (there is no workbench role), then `desk`,
  `driveway` and `laundry`. No crew on site, no quote from the van (remote access is not claimed), never "tax ready",
  no payments or dispatch.
- **marketer.** The client's list, files and briefs sit in the house and the model that drafts from them runs on the Core:
  Open WebUI, Companion Memory (beta), Ghost, Penpot, Twenty. She edits and approves; never better copy, saved time or money.
  It cannot move the platforms, sending reputation or live co-editing with a client; Ghost holds the list and sending
  needs an outside mailer.
- **lawyer.** The client file, the engagement letter and a first-pass summary she checks line by line: Paperless-ngx,
  Nextcloud, Docuseal, LibreOffice. The model drafts and the person signs; the headline is where the file lives, never
  accuracy, speed or "privileged". Not a Clio, Westlaw or Lexis replacement; no compliance claim; Docuseal is never
  "legally binding".
- **journalist.** The tape, the notes and the records sit on the Core and every quote is checked against the audio:
  Whisper-WebUI, Paperless-ngx, Obsidian, Nextcloud. One bounded chore on her own material, verified by hand; never AI
  writing or deciding anything with a byline. Signal and WhatsApp do not move, and the Core is not a vault: never imply
  immunity from a search or a seizure.
- **educator.** Lesson folders, handouts and report comments the teacher rewrites by hand: Paperless-ngx, Nextcloud,
  LibreOffice, LibreTranslate, Joplin Server, Razzia for the Friday quiz. A model on the Core does one chore from the
  teacher's own materials; never grading or deciding about a child, never an hours figure. No learning platform or
  gradebook is in the store (it does not work with Google Classroom), and never a class list, a grade or a safeguarding
  note at a home Core.

### Age rule 16

Decided by the owner on 2026-10-19 (the bible's open question was 13).

- `member.companion` needs age 16 or older (rule `age-companion`); babies, children and visitors never have one.
- A beat whose app is a chat or agent app (catalog tag `ai: "chat"`: Open WebUI, Ollama, AnythingLLM, Companion Memory, Hermes,
  OpenClaw and the other chat and agent apps) needs a `member` aged 16 or older. A beat with an `agent` needs the agent's
  owner aged 16 or older and an adult as `approval` (rule `age-chat`).
- A child may appear in a parent-led beat: the beat's `member` is the adult, the child is named in the body as the one being
  helped, and the child is never the actor.
- Non-chat AI tools (LibreTranslate, Whisper-WebUI, Kokoro, Stirling-PDF OCR) are tools, not chat models: younger members may use them.
- Both rules are errors in a v3 family (one with at least one `beat.service`) and warnings in every other, so the families written
  before v3 stay valid until each is rewritten ([validator.md](validator.md), Story v3).

## Ads

The same file feeds the lander and every ad cut, so the ad rules are story rules (CI-Common `ADS.md`, Kickstarter
campaign):

- Label: **"Fictional family. Real software."** First two seconds of any cut and the end card.
- No UI mockups, no screen recordings, no render that could pass for a photograph, no invented person presented as a
  customer. Characters are named, drawn and labelled as characters.
- Daylight and warm light only. No neon, no glow, no RGB. Day or golden hour, never night bloom.
- A software claim carries the beta line. App count, if printed: "300+ apps and agents available in the Companion Hub
  store." Never a price.
- Third-party software is always named in text. Its real logo may identify it beside that name on the lander and the family pages and inside a
  chip of an ad cut, never alone and never as decoration. A real, unedited screenshot of an app, of Companion Hub or of the Companion account page
  may sit on the lander and the family pages with its label ("Real screenshot of <Name> from a Companion Hub QA run. Not a recording of this
  family."): the files, alt text, captions and the reasons for every refusal are `content/story/app-media.json` (`pnpm run story:media`,
  [story-v2.md](story-v2.md) "App media"). No screenshot is ever composited into a scene, the tour or a cut (a screenshot inset in a cut is off
  unless the owner says so: `--screenshots`). The homes are the product's own pieces: no builder credit and no mention of any game or gallery they
  came from appears on the lander, in a story or in an ad. The home is named by its display name only.
- CTAs are awareness: See Companion Core (`https://ci.computer/core`). Not "Buy".
