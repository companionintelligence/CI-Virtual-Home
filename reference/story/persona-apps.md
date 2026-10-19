# Persona apps (what each archetype may name)

The app guide for [personas.md](personas.md). It lists, per archetype, the Companion Hub store apps a persona beat may use,
what each one replaces, the caveats the text must respect, and sentences that are allowed and one that is not.

The source is `content/story/catalog-apps.json` (the validator reads it; an id that is not in it fails `app-unknown`).
Facts here were checked on 2026-10-15 against the live store (`https://hub.ci.computer/api/store`, 579 published apps) and
the manifests on CI-Marketplace `origin/main` e9477219 (2026-10-13). Re-check on publish day:

```bash
node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --fetch
```

## Rules that apply to every app

- **Name it exactly.** The first chip is the display name in the tables below, character for character. The validator
  matches the whole name, so the text must use it too: "Joplin Server" (not "Joplin"), "ONLYOFFICE Desktop Editors" (not
  "ONLYOFFICE"), "Paperless-ngx" (never bare "Paperless"), "OpenClaw WebCLI" or "OpenClaw", "VaultWarden". Say "the
  Bitwarden apps" or "Bitwarden-compatible" for VaultWarden, never "Bitwarden" alone.
- **Chips.** The app name, then `replaces <X>` where X is in the Replaces column. Where the column says "none", there is
  no replaces chip. Never invent a replaces name: a name is allowed only if the manifest or the store's own alternatives
  table says so.
- **One beat, one app.** Any other app the text names goes in `with`. A name in the tagline, story, closing, a member's
  `work` or a chapter title must be shown by some beat.
- **Where the work happens.** Say what the cloud service would have held and where it sits now. Never "private",
  "secure" or "safe" on their own. The safe verbs are "sits on the Core", "stays on your Core by default", "runs on the
  Core".
- **Honest edges that ride along (every family).** Companion OS is in beta. Installing apps uses the internet. Crash
  reports go to Companion Intelligence from the first-party apps unless switched off (see the first-party row in the
  maker and host table). Remote access is not claimed: set every scene on the home network. A coding or chat agent is
  private only on the Core's local model, so never mention a cloud key.
- **No screens.** The popup, chips and camera tell the story. No app screenshot, no UI mock, no invented interface.
- **QA column.** `shot` means a QA screenshot exists on `origin/main` (`e2e/screenshots`). `none` means the validator
  raises `app-qa-screenshot` (review), so the owner must list the beat in `content/story/reviewed.json`. Prefer `shot`.

## Organiser (Sally)

Files, calendar, paperwork and the small business, from the home office.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `ci-planning` | Companion Planning | none | Two-way Google Calendar sync exists but is off by default: never "never touches Google". Local briefings need a local model running. Crash reports on by default. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | None. Do not use it for away-from-home sync scenes. | shot |
| `libreoffice` | LibreOffice | Microsoft Office, Google Workspace | Listing is generic: name the suite, not features. | shot |
| `onlyoffice` | ONLYOFFICE Desktop Editors | Microsoft Office, Google Workspace | The standalone suite, not Document Server or Workspace. amd64 only. One suite per household (LibreOffice or this, not both). | shot |
| `paperless` | Paperless-ngx | Evernote, Google Drive | AI features off by default. Office conversion not wired: scans and PDFs only. Never bare "Paperless". | shot |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | None. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | Bitwarden-compatible, unofficial. | shot |
| `joplin` | Joplin Server | Evernote | The server only; the Joplin apps are separate. | shot |
| `bookstack` | BookStack | Confluence, Notion | None. | shot |
| `n8n` | n8n | Zapier, Make | Fair-code licence: say "source-available", never "open source". | shot |
| `yuvomi` | Yuvomi | none | Data in SQLite on the Core. One household planner, not an account per person. | shot |

**Companion Planning**
- Say: "Sally plans the week in Companion Planning, one local file on the Core."
- Say: "The planner sits on the Core. Sally reads it on the desk screen."
- Never: "Companion Planning never touches Google." (An optional Google sync exists.)

**Nextcloud**
- Say: "Sally's contracts sit in Nextcloud on the Core, not in a rented drive."
- Say: "Her calendar and contacts are served from the Core."
- Never: "Sally opens her Nextcloud files from the road." (Remote access is not claimed.)

**LibreOffice**
- Say: "Sally writes the quarterly report in LibreOffice, in her browser."
- Say: "The document is saved on the Core."
- Never: "LibreOffice opens every Word file perfectly." (The listing says nothing about features.)

**ONLYOFFICE Desktop Editors**
- Say: "Sally builds the client slides in ONLYOFFICE Desktop Editors, which runs on the Core and shows in her browser."
- Say: "The slides are saved on the Core."
- Never: "ONLYOFFICE lets the whole family edit one file together." (That is Document Server, a different listing.)

**Paperless-ngx**
- Say: "Receipts and school forms go through Paperless-ngx on the Core. Every page is read and tagged."
- Say: "Sally finds last year's invoice by searching the words on it."
- Never: "Paperless-ngx files your taxes for you." (Legal and autonomy claim.)

**Stirling-PDF**
- Say: "Sally merges the contract and its schedule in Stirling-PDF on the Core."
- Say: "The PDFs are merged, split and compressed on the Core, not on a PDF website."
- Never: "Stirling-PDF makes the contract legally binding." (Not in the listing.)

**VaultWarden**
- Say: "The family's passwords sit in a VaultWarden vault on the Core."
- Say: "VaultWarden works with the Bitwarden apps."
- Never: "The family's passwords sit on a Bitwarden server."

**Joplin Server**
- Say: "Sally's meeting notes sync to Joplin Server on the Core."
- Say: "The notes sit on the Core, not in a note service."
- Never: "Joplin Server keeps her notes unhackable." (No absolute security wording.)

**BookStack**
- Say: "Sally writes the household manual in BookStack: books, chapters and pages."
- Say: "The wiki sits on the Core, with search and page history."
- Never: "BookStack is better than Notion." (The chip says replaces Notion and stops there.)

**n8n**
- Say: "n8n links Sally's order form to her spreadsheet with a workflow that runs on the Core."
- Say: "The workflows run on the Core, so the data does not pass through a connector service."
- Never: "n8n is open source." (Say source-available.)

**Yuvomi**
- Say: "The family planner is Yuvomi: one calendar, one shopping list, one task board."
- Say: "Yuvomi keeps its data in a database on the Core."
- Never: "Each family member has a separate private Yuvomi account." (One household, one Core.)

## Builder (John)

Code on the laptop, repositories and a local model on the Core. Two rules govern this table. A coding agent is private
only on the Core's local model. Never claim parity with a hosted model and never a speed figure.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `code-server` | Code Server | VS Code (Proprietary), Cursor | No cloud key, but extensions come from an outside registry and a coding agent extension can call a cloud model. Never "from anywhere". One shared password. | none |
| `forgejo` | Forgejo | GitHub, GitLab (SaaS) | One Git host per household (Forgejo or Gitea). The package ships no CI runner: do not show a CI run. Never "syncs with GitHub". | shot |
| `gitea` | Gitea | GitHub, GitLab (SaaS), Bitbucket | As Forgejo. Gitea Mirror is a different app: never name it. | shot |
| `ollama` | Ollama | OpenAI, ChatGPT | CPU unless the host passes a GPU in: say nothing about speed. No chat window of its own. The Hub also has a built-in Ollama service. | none |
| `open-webui` | Open WebUI | ChatGPT, Claude | Wired to the local model by the Hub. It can connect to cloud models with a key: leave that out of the scene. | shot |
| `ci-openclaw` | OpenClaw WebCLI | none | Beta. Errands and browser automation, not a coder. Cloud provider keys saved in Hub can reach it: say "the model on your Core" only when none are saved, and never mention a key. Phone use away from home is not claimed. | shot |
| `opencode` | OpenCode | GitHub Copilot, Cursor | Wired to the local model; it can add cloud providers with a key inside the app. The person approves the change. No sign-in unless a password is set. Name only OpenCode, never OpenCode Web. | none |
| `aider` | Aider | GitHub Copilot, Cursor | Wired to the Hub model; a model override can point elsewhere. Every edit is a git commit, which is the approval. Browser interface is experimental upstream. | none |
| `jupyterlab` | JupyterLab | none | One password. Packages install from the internet. The store names nothing it replaces: no replaces chip. | shot |
| `n8n` | n8n | Zapier, Make | See the organiser table. | shot |

**Code Server**
- Say: "John codes in Code Server: the editor runs on the Core and shows in his laptop's browser."
- Say: "His repositories and his editor both sit on the Core."
- Never: "John opens Code Server from anywhere." (The listing says it; the sheet does not. Remote access is not claimed.)

**Forgejo**
- Say: "John's repositories live in Forgejo on the Core, not on a rented code host."
- Say: "Issues and pull requests sit with the code."
- Never: "Forgejo syncs his repositories with GitHub."

**Gitea**
- Say: "John's private repositories live in Gitea on the Core."
- Say: "Pull requests, issues and packages stay with the code."
- Never: "Gitea mirrors his GitHub repositories." (That is Gitea Mirror, a different app.)

**Ollama**
- Say: "Ollama runs an open-weight model on the Core."
- Say: "John's questions to the model stay on the Core by default."
- Never: "Ollama is as good as ChatGPT." (Also never a tokens-per-second figure.)

**Open WebUI**
- Say: "John asks a model on the Core through Open WebUI, in his browser."
- Say: "The conversation sits on the Core."
- Never: "Open WebUI connects to John's OpenAI key." (Never mention a cloud key.)

**OpenClaw WebCLI**
- Say: "John asks OpenClaw to fill in the supplier form, then reads it before it is sent."
- Say: "OpenClaw prepares the errand and John approves it."
- Never: "OpenClaw books the flight on its own." (Agents prepare, people approve.)

**OpenCode**
- Say: "OpenCode reads John's repository and proposes a change using the model on his Core."
- Say: "John reads the diff and approves it."
- Never: "OpenCode works as well as a hosted coding model."

**Aider**
- Say: "Aider edits the code and commits each change, so John can read it and undo it with git."
- Say: "The model it asks is the one on the Core."
- Never: "Aider finishes a refactor in seconds."

**JupyterLab**
- Say: "John tries an idea in a JupyterLab notebook, on the Core."
- Say: "The notebook runs its code on the Core."
- Never: "JupyterLab replaces MATLAB." (No source in the manifest, the live store or the shipped alternatives table.)

## Gamer (Steve)

Plays on the Core, from the couch or the bedroom. The privacy point is where the session runs, not that Steam is private.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `steam-headless` | Steam Headless | GeForce Now, Xbox Cloud Gaming | Needs a Valve account; the library is Valve's. The Core may not have the GPU a game wants. No frame rate, resolution, latency, "smooth", "gaming PC" or "console replacement". No game titles. Privileged container: not "sandboxed". Home network only. | shot |
| `jellyfin` | Jellyfin | Plex, Netflix | Plays your own files. Never "streams any movie". | shot |
| `immich` | Immich | Google Photos, iCloud Photos | First start is slow (bundled database and machine-learning service). Web interface only for agents. | shot |

**Steam Headless** (the one listing the old catalog excluded: re-admitted by the owner on 2026-10-15, with these caveats)
- Say: "Steve plays his own Steam library, streamed from the Core to the screen in his room."
- Say: "Steam Headless runs on the Core and shows in a browser on his screen."
- Say: "Steve signs in with his own Valve account."
- Never: "Steve plays without a Steam account." Also never "gaming PC", "console replacement", any frame rate, "smooth", or
  "play anywhere".

**Jellyfin**
- Say: "Steve's film collection plays from Jellyfin on the Core to the living-room TV."
- Say: "Jellyfin plays your own movies, shows and music."
- Never: "Jellyfin streams any movie you want."

**Immich**
- Say: "The family's photos sit in Immich on the Core, not in a photo cloud."
- Say: "The first start takes a while, because Immich sorts the pictures on the Core."
- Never: "Immich keeps your photos 100% private."

## Learner (Jean)

Homework, reading, languages and exams. A child's questions are the privacy stake, told without fear.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `kiwix` | Kiwix | Google Search, Bing | Content files (ZIM) are downloaded once. | shot |
| `calibre-web` | Calibre-Web | Kindle, Apple Books | Your own books only. | none |
| `libretranslate` | LibreTranslate | Google Translate, DeepL | Language models are downloaded once. | shot |
| `obsidian` | Obsidian | Notion, Evernote | Not open source: never say so. Notes are Markdown files. | shot |
| `jupyterlab` | JupyterLab | none | See the builder table. | shot |
| `ci-spellbook` | Spellbook | none | A catalog of local-AI and self-hosting tools. Crash reports on by default. | shot |

**Open WebUI** (learner)
- Say: "Jean asks a model on the Core to explain the proof, and the question stays on the Core by default."
- Say: "Her homework chat sits on the Core."
- Never: "Open WebUI is as smart as ChatGPT."

**Kiwix**
- Say: "Jean looks things up in Kiwix, which serves Wikipedia from the Core, so no search engine sees the question."
- Say: "The Wikipedia file was downloaded once. After that Kiwix serves it from the Core."
- Never: "Kiwix works offline anywhere in the world."

**Calibre-Web**
- Say: "The family's own ebooks sit in Calibre-Web on the Core."
- Say: "Jean reads her set text in the browser."
- Never: "Calibre-Web gets you any book you want."

**LibreTranslate**
- Say: "Jean checks her French homework in LibreTranslate on the Core."
- Say: "The words are translated on the Core, not sent to a translation website."
- Never: "LibreTranslate translates everything perfectly."

**Obsidian**
- Say: "Jean keeps her study notes in Obsidian, as plain Markdown files on the Core."
- Say: "Obsidian runs in a browser session; the notes are files on the Core."
- Never: "Obsidian is open source."

**JupyterLab** (learner)
- Say: "Jean runs her statistics homework in JupyterLab, on the Core."
- Say: "Her notebooks sit on the Core."
- Never: "JupyterLab keeps every notebook safe." (No bare "safe".)

**Spellbook**
- Say: "Jean browses Spellbook, a searchable catalog of local-AI and self-hosting tools, for a project idea."
- Say: "Spellbook runs on the Core like every other app."
- Never: "Spellbook lists 797 tools." (No app or tool counts.)

## Maker and host

The household's shared beats. Photos, films, food, plants and the lights carry the categories the validator asks for.
Maker anchors are `easel`, `music` and `desk`; host anchors are `kitchen-island`, `fridge`, `range`, `garden`, `couch`
and `tv`.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `immich` | Immich | Google Photos, iCloud Photos | See the gamer table. | shot |
| `jellyfin` | Jellyfin | Plex, Netflix | See the gamer table. | shot |
| `ci-planning` | Companion Planning | none | See the organiser table. | shot |
| `obsidian` | Obsidian | Notion, Evernote | See the learner table. | shot |
| `home-assistant` | Home Assistant | Google Home, Amazon Alexa, Apple HomeKit | A Zigbee or Bluetooth stick is not enabled by default: network devices, the TV and cameras only. No energy-saving claim. | shot |
| `mealie` | Mealie | Paprika, AnyList | Listed and installable, no recorded QA run. KitchenOwl (screenshot) is the verified fallback. | none |
| `kitchenowl` | KitchenOwl | none | None. | shot |
| `hortusfox` | HortusFox | none | None. | shot |
| `yuvomi` | Yuvomi | none | See the organiser table. | shot |

First-party apps (Companion Memory, Hermes, OpenClaw WebCLI, Companion Planning, Spellbook) share one more caveat, from
their manifests: "Share crash reports" is on by default and sends crash reports to Companion Intelligence, with
credentials, file paths, request bodies and memories stripped. Never write that nothing leaves the Core.

**Home Assistant**
- Say: "Home Assistant runs the porch light from the Core, with no cloud account."
- Say: "The hall lights and the TV are one scene in Home Assistant."
- Never: "Home Assistant cuts the energy bill by a fifth."

**Mealie**
- Say: "Mealie holds the family recipes and the week's meal plan on the Core."
- Say: "The shopping list is shared by everyone at home."
- Never: "Mealie orders the groceries for you."

**KitchenOwl**
- Say: "KitchenOwl keeps the shared grocery list and the week's meals on the Core."
- Say: "Everyone at home adds to the same list."
- Never: "KitchenOwl replaces AnyList." (The catalog has no replaces name for it.)

**HortusFox**
- Say: "HortusFox tracks the plants, the watering and the garden jobs."
- Say: "The plant journal sits on the Core."
- Never: "HortusFox keeps your plants alive."

Immich, Jellyfin, Obsidian, Companion Planning and Yuvomi use the sentences above.

## Apps that look like persona apps but must not be named

| Store id / name | Why not |
|---|---|
| `emulatorjs` EmulatorJS, `romm` RomM | Retro emulation needs ROM files. No story shows or implies where game files come from. Kept excluded. |
| `claude-code` Claude Code | `visibility: dev_only` on main (it lingers in the live store until the next prune) and the form asks for an Anthropic API key. A cloud key is the opposite of the argument. |
| `opencode-web` OpenCode Web | Superseded by OpenCode (`opencode`); kept running for existing installs only. |
| `librechat`, `litellm`, `bifrost`, `louter`, `paperclip`, `deerflow`, `openshell-*` | Cloud model gateways and agents that need OpenAI, Anthropic or Google keys. |
| `github-mcp`, `notion-mcp`, `reddit-mcp`, `onlyoffice-docspace-mcp` | Bridges to third-party cloud services. |
| `steam-mcp` Steam MCP | Calls the Steam Web API with a Steam API key. A cloud link, not a Core app. Steam Headless is the gamer app. |
| `sunshine` Sunshine, `kavita` Kavita | `visibility: dev_only`: not in the live store. A customer cannot install them. |
| `gitea-mirror` Gitea Mirror | A different listing: it copies GitHub repositories into Gitea. Name only Gitea. |
| `onlyoffice-documentserver`, `onlyoffice-workspace` | The editing engine and a portal that needs it. The persona suite is ONLYOFFICE Desktop Editors. |
| `plex`, `emby` | Closed-source, account-based. Use Jellyfin. |
| `lingva-translate` Lingva Translate | It scrapes Google Translate, so it is not local. Use LibreTranslate. (SearXNG, which queries other search engines, is in the catalog with a cloud-link caveat; it is not a Kiwix substitute.) |
| `openclaw` (third-party), `hermes-agent` | The first-party pair is `ci-openclaw` and `ci-hermes`. |
| The *arr apps, torrent and Usenet clients | Copyright exposure. Keep out of family stories. |

## Words that trip the validator in ordinary prose

Handle these in the copy until the validator is tuned (the matcher lives in `scripts/story/lib/context.mts`):

- **"sunshine"** matches the not-in-store app Sunshine (a game-stream host) and fails `app-not-in-store`. The ads use
  daylight, so write "daylight" or "morning light", not "sunshine".
- **"code server"** (the phrase) matches the app Code Server. Use the words only for the app, with its chip.
- **"Gitea Mirror"** still names Gitea to the validator. Do not write it (it is a different app).
- Plain "ONLYOFFICE" does not name the app (the full name is matched), so the beat cannot show the app by that word alone.
  Write the full display name.
