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
| `learner` | Studies and reads; homework, languages, exams. Jean. | `desk`, `bookshelf` in `kids`, `bedroom`, `office`; fallback `couch`, `room` | `open-webui`, `kiwix`, `calibre-web`, `libretranslate`, `obsidian`, `jupyterlab`, `ci-spellbook` |
| `maker` | Paints, photographs, writes, plays. | `easel`, `music`, `desk` | `immich`, `ci-planning`, `obsidian`, `jellyfin` |
| `host` | Feeds, ferries, waters and tidies the house; the household's shared beats. | `kitchen-island`, `fridge`, `range`, `garden`, `couch`, `tv` | `immich`, `jellyfin`, `home-assistant`, `mealie` or `kitchenowl`, `hortusfox`, `yuvomi` |

The pools are a starting point. The catalog (`content/story/catalog-apps.json`) decides what may be named at all: an id
that is not in it fails `app-unknown`. `reference/story/persona-apps.md` lists, per archetype, each app's `replaces`
names, caveats and the wording that is allowed.

A member has exactly one archetype. A family is 2 to 6 members and covers at least two archetypes. A member under 13 is
never given an agent companion (schema), a baby has none.

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
   interface. The story lives in the popup, the chips and the camera; props and rooms carry the rest.
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
- **learner.** Questions asked of a local model stay on the Core; Kiwix is Wikipedia without a search engine watching;
  Calibre-Web holds the family's own books; LibreTranslate keeps translation local. A child's questions are the privacy
  stake, told without fear (`sec-fear`).
- **host and maker.** The household's shared beats (photos, films, food, plants, the lights) carry the remaining
  categories the validator asks for. Immich replaces Google Photos; Jellyfin replaces Plex and Netflix for your own media.

## Ads

The same file feeds the lander and every ad cut, so the ad rules are story rules (CI-Common `ADS.md`, Kickstarter
campaign):

- Label: **"Fictional family. Real software."** First two seconds of any cut and the end card.
- No UI mockups, no screen recordings, no render that could pass for a photograph, no invented person presented as a
  customer. Characters are named, drawn and labelled as characters.
- Daylight and warm light only. No neon, no glow, no RGB. Day or golden hour, never night bloom.
- A software claim carries the beta line. App count, if printed: "300+ apps and agents available in the Companion Hub
  store." Never a price.
- Third-party software is named in text, never as a logo. The homes are the product's own pieces: no builder credit and
  no mention of any game or gallery they came from appears on the lander, in a story or in an ad. The home is named by
  its display name only.
- CTAs are awareness: See Companion Core (`https://ci.computer/core`). Not "Buy".
